export const meta = {
  name: 'super-spec-final-review',
  description: 'super-spec Phase 5 multi-lens panel：4 個平行 lens → skeptic 投票 → verdict 由 script deterministic 計算 → judge 只組稿；全程 read-only',
  phases: [
    { title: 'Lenses', detail: '4 個平行視角各自審整個 change' },
    { title: 'Verify', detail: '每個 Critical/Important 候選 2 個 skeptic 反證投票' },
    { title: 'Compose', detail: 'verdict 計算 + judge 組稿' },
  ],
}

// ============================================================================
// args 契約 — 由 flows/ultracode-review.md 的 orchestrator 步驟組裝後傳入。
// 本 script 為靜態檔且 read-only：不含任何 git 寫入；中途死掉直接整個重跑即可。
//
//   changeName  : string
//   mode        : 'TDD' | 'Simple'（純 discipline）
//   commitRange : string — <baseline>..HEAD（推導方式同 phases/05-final-review.md）
//   paths       : { proposal, design, tasks, specsDir }
//   models      : { lens: 'sonnet', holistic: 'opus', skeptic: 'sonnet', judge: 'sonnet' }
//                 ← 來源是 proposal.md 的 ## Ultracode Agent Models 表（缺列時用
//                   flows/ultracode-review.md 規定的預設值），非本檔
//   templates   : {
//     isolationPreamble : prompts/_isolation-preamble.md 全文（逐字）,
//     lensSpec          : prompts/final-lens-spec.md 全文,
//     lensLifecycle     : prompts/final-lens-lifecycle.md 全文,
//     lensCoherence     : prompts/final-lens-coherence.md 全文,
//     holistic          : prompts/final-reviewer.md 全文（現行 final-reviewer 原樣重用）,
//     skeptic           : prompts/final-skeptic.md 全文,
//     judge             : prompts/final-judge.md 全文,
//   }
// ============================================================================

const { changeName, mode, commitRange, paths, models, templates } = args

// ---- fail-fast：模板 placeholder 契約檢查 ----
const REQUIRED_PLACEHOLDERS = {
  lensSpec: ['{CHANGE_NAME}', '{SPECS_DIR}', '{DESIGN_PATH}', '{COMMIT_RANGE}'],
  lensLifecycle: ['{CHANGE_NAME}', '{DESIGN_PATH}', '{COMMIT_RANGE}'],
  lensCoherence: ['{CHANGE_NAME}', '{DESIGN_PATH}', '{TASKS_PATH}', '{MODE}', '{COMMIT_RANGE}'],
  holistic: ['{CHANGE_NAME}', '{PROPOSAL_PATH}', '{DESIGN_PATH}', '{TASKS_PATH}', '{SPECS_DIR}', '{COMMIT_RANGE}'],
  skeptic: ['{ISSUE_SEVERITY}', '{ISSUE_FILE}', '{ISSUE_DESCRIPTION}', '{DESIGN_PATH}', '{COMMIT_RANGE}'],
  judge: ['{CHANGE_NAME}', '{VERDICT}', '{CONFIRMED_ISSUES}', '{NOTES}'],
}
for (const [name, placeholders] of Object.entries(REQUIRED_PLACEHOLDERS)) {
  if (!templates || !templates[name]) return { error: `args.templates.${name} 缺失 — orchestrator 未依 flows/ultracode-review.md 組裝 args` }
  for (const ph of placeholders) {
    if (!templates[name].includes(ph)) return { error: `模板 ${name} 缺少 placeholder ${ph} — prompts/*.md 與本 script 的契約已失準，停止` }
  }
}
if (!templates.isolationPreamble) return { error: 'args.templates.isolationPreamble 缺失' }

const fill = (tpl, vars) => Object.entries(vars).reduce((s, [k, v]) => s.split('{' + k + '}').join(String(v)), tpl)
const preamble = templates.isolationPreamble + '\n\n---\n\n'

const LENS_SCHEMA = {
  type: 'object',
  required: ['issues'],
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'description', 'file', 'is_design_flaw'],
        properties: {
          severity: { type: 'string', enum: ['Critical', 'Important', 'Minor'] },
          description: { type: 'string' },
          file: { type: 'string' },
          is_design_flaw: { type: 'boolean' },
        },
      },
    },
  },
}
const SKEPTIC_SCHEMA = {
  type: 'object',
  required: ['refuted', 'reasoning'],
  properties: { refuted: { type: 'boolean' }, reasoning: { type: 'string' } },
}
const JUDGE_SCHEMA = {
  type: 'object',
  required: ['summary', 'suggestions'],
  properties: { summary: { type: 'string' }, suggestions: { type: 'array', items: { type: 'string' } } },
}

// ---- Phase: Lenses（4 個平行視角）----
phase('Lenses')
const commonVars = {
  CHANGE_NAME: changeName,
  PROPOSAL_PATH: paths.proposal,
  DESIGN_PATH: paths.design,
  TASKS_PATH: paths.tasks,
  SPECS_DIR: paths.specsDir,
  MODE: mode,
  COMMIT_RANGE: commitRange,
}
// holistic lens 重用現行 final-reviewer.md 模板（逐字），但以附註覆寫其輸出段：
// panel 模式下 verdict 由 script 計算，holistic 只產 issues。
const HOLISTIC_OVERRIDE = [
  '',
  '## PANEL-MODE OUTPUT OVERRIDE (appended by the workflow script)',
  'You are running as the holistic lens of a review panel. IGNORE the "Output format" /',
  '"Verdict rule" sections above: do NOT emit a VERDICT block. Instead report every issue',
  'you find through the structured output schema as {issues: [{severity, description, file,',
  'is_design_flaw}]} — severity uses your rubric above verbatim; set is_design_flaw=true only',
  'for flaws that originate in design.md and cannot be fixed by revision tasks. The verdict',
  'is computed deterministically downstream from all lenses\' issues. Everything else in your',
  'instructions (what to read, /code-review invocation, rubric) still applies. If the',
  '/code-review Skill invocation is unavailable in this context, perform the correctness /',
  'cross-task DRY / efficiency analysis yourself instead of failing.',
].join('\n')

const lensCalls = [
  { key: 'spec', tpl: templates.lensSpec, model: models.lens, extra: '' },
  { key: 'lifecycle', tpl: templates.lensLifecycle, model: models.lens, extra: '' },
  { key: 'coherence', tpl: templates.lensCoherence, model: models.lens, extra: '' },
  { key: 'holistic', tpl: templates.holistic, model: models.holistic, extra: HOLISTIC_OVERRIDE },
]
const lensResults = await parallel(lensCalls.map(l => () =>
  agent(preamble + fill(l.tpl, commonVars) + l.extra, {
    label: `lens:${l.key}`,
    phase: 'Lenses',
    model: l.model,
    schema: LENS_SCHEMA,
  }).then(r => ({ key: l.key, issues: (r && r.issues) || [] }))
))
const lenses = lensResults.filter(Boolean)
// 覆蓋度 gate：任一 lens 掉線就不可信任 APPROVED——read-only、整個重跑便宜，直接 error
if (lenses.length < lensCalls.length) {
  return { error: `${lensCalls.length - lenses.length} 個 lens 未回傳（中止/被 skip），覆蓋度不完整 — 重跑整個 workflow（read-only，無副作用）` }
}

// 機械去重：同 file + 同 description 才視為重複（模糊相似交給 skeptic 票決吸收）
const seen = new Set()
const candidates = []
for (const l of lenses) {
  for (const i of l.issues) {
    const key = i.file + '||' + i.description
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push(Object.assign({}, i, { lens: l.key }))
  }
}
log(`4 lens 合計 ${candidates.length} 個候選 issue（去重後）`)

// ---- Phase: Verify（每個 Critical/Important 候選 → 2 skeptic 投票）----
phase('Verify')
const SEVERITY_ORDER = { Critical: 0, Important: 1, Minor: 2 }
const DOWNGRADE = { Critical: 'Important', Important: 'Minor', Minor: 'Minor' }
let gatingCandidates = candidates
  .filter(i => i.severity === 'Critical' || i.severity === 'Important')
  .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
const minorsFromLenses = candidates.filter(i => i.severity === 'Minor')

const MAX_SKEPTIC_CANDIDATES = 12
if (gatingCandidates.length > MAX_SKEPTIC_CANDIDATES) {
  log(`候選 gating issue ${gatingCandidates.length} 個，超過 skeptic 上限 ${MAX_SKEPTIC_CANDIDATES}：只驗前 ${MAX_SKEPTIC_CANDIDATES} 個（severity 排序），其餘 ${gatingCandidates.length - MAX_SKEPTIC_CANDIDATES} 個以原 severity 直接保留（未驗證，寧嚴勿漏）`)
}
const toVerify = gatingCandidates.slice(0, MAX_SKEPTIC_CANDIDATES)
const unverified = gatingCandidates.slice(MAX_SKEPTIC_CANDIDATES)

const verified = await parallel(toVerify.map((issue, idx) => () =>
  parallel([0, 1].map(v => () =>
    agent(preamble + fill(templates.skeptic, {
      ISSUE_SEVERITY: issue.severity,
      ISSUE_FILE: issue.file,
      ISSUE_DESCRIPTION: issue.description,
      DESIGN_PATH: paths.design,
      COMMIT_RANGE: commitRange,
    }), { label: `skeptic:${idx + 1}.${v + 1}`, phase: 'Verify', model: models.skeptic, schema: SKEPTIC_SCHEMA })
  )).then(votes => {
    const confirms = votes.filter(Boolean).filter(x => !x.refuted).length
    // 2 票 confirm → 維持；1 票 → 降一級；0 票 → 降為 Minor
    const finalSeverity = confirms >= 2 ? issue.severity : confirms === 1 ? DOWNGRADE[issue.severity] : 'Minor'
    return Object.assign({}, issue, {
      originalSeverity: issue.severity,
      severity: finalSeverity,
      confirms,
      downgraded: finalSeverity !== issue.severity,
    })
  })
))

const settled = verified.filter(Boolean).concat(unverified.map(i => Object.assign({}, i, { originalSeverity: i.severity, confirms: null, downgraded: false })))

// ---- Phase: Compose（verdict deterministic 計算 + judge 組稿）----
phase('Compose')
const confirmed = settled
  .filter(i => i.severity === 'Critical' || i.severity === 'Important')
  .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
// Notes = lens 原生 Minor + 被投票降級者（降級者標註原 severity 供人工複核）
const notes = minorsFromLenses
  .map(i => ({ text: `[Minor] ${i.file} — ${i.description}`, downgraded: false }))
  .concat(settled.filter(i => i.severity === 'Minor').map(i =>
    ({ text: `[Minor] ${i.file} — ${i.description}（skeptic 投票自 [${i.originalSeverity}] 降級，confirms=${i.confirms}——請人工複核）`, downgraded: true })))

// Verdict rule（與 phases/05-final-review.md 完全同義，只是變成 code path）：
// 任一 confirmed 帶 is_design_flaw → NEEDS DESIGN UPDATE；
// 否則有 Critical/Important → CHANGES REQUESTED；否則 APPROVED。
const verdict = confirmed.some(i => i.is_design_flaw)
  ? 'NEEDS DESIGN UPDATE'
  : confirmed.length > 0
    ? 'CHANGES REQUESTED'
    : 'APPROVED'
log(`verdict = ${verdict}（confirmed gating: ${confirmed.length}，notes: ${notes.length}）`)

const confirmedText = confirmed.length
  ? confirmed.map(i => `- [${i.severity}] ${i.file} — ${i.description}${i.is_design_flaw ? '（design-level flaw）' : ''}`).join('\n')
  : '(none)'
const notesText = notes.length ? notes.map(n => `- ${n.text}`).join('\n') : '(none)'

const judge = await agent(preamble + fill(templates.judge, {
  CHANGE_NAME: changeName,
  VERDICT: verdict,
  CONFIRMED_ISSUES: confirmedText,
  NOTES: notesText,
}), { label: 'judge', phase: 'Compose', model: models.judge, schema: JUDGE_SCHEMA })
if (!judge) return { error: 'judge agent 中止 — 重跑整個 workflow（read-only，無副作用）' }

return {
  verdict,
  summary: judge.summary,
  issues: confirmed.map(i => ({ severity: i.severity, file: i.file, description: i.description, is_design_flaw: i.is_design_flaw, lens: i.lens, confirms: i.confirms })),
  notes: notes.map(n => n.text),
  suggestions: judge.suggestions,
  panelStats: { lensesReturned: lenses.length, candidates: candidates.length, verifiedCount: toVerify.length, unverifiedKept: unverified.length },
}
