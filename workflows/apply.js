export const meta = {
  name: 'super-spec-apply',
  description: 'super-spec Phase 4 Task loop：逐 Task 派發 implementer → task-reviewer，嚴重度路由 + 連續 FAIL 模型升級；git 與 tasks.md 為唯一真相源',
  phases: [{ title: 'Apply' }],
}

// ============================================================================
// args 契約 — 由 flows/ultracode-apply.md 的 orchestrator 步驟組裝後傳入。
// 本 script 為靜態檔：所有模板、模型、Task 內容一律經 args 進來，script 內
// 不 hardcode 任何 prompt 內文或模型名（唯一例外：git-ops prompt 的固定守則，
// 鏡像 phases/04-apply.md step 4 的原文規則）。
//
//   changeName : string — change 名稱（組 tasks.md 路徑用）
//   designPath : string — openspec/changes/<name>/design.md
//   mode       : 'TDD' | 'Simple' — 純 discipline，不含模型括號
//   models     : {
//     implementer          : 'sonnet' | 'opus' | 'inherit',
//     implementerEscalated : 'opus',      // 2 連 FAIL 後第 3 次 dispatch
//     taskReviewer         : 'sonnet',
//     gitOps               : 'haiku',
//   }   ← 來源是 proposal.md 的 ## Ultracode Agent Models 表，非本檔
//   templates  : {
//     isolationPreamble : prompts/_isolation-preamble.md 全文（逐字）,
//     implementer       : prompts/implementer.md 全文（逐字，含 {PLACEHOLDER}）,
//     taskReviewer      : prompts/task-reviewer.md 全文（逐字，含 {PLACEHOLDER}）,
//   }
//   tasks      : [{ number, title, body, relevantFiles }]
//                — tasks.md 中 Task 標頭仍為 "- [ ]" 的每個 Task；body 是該
//                  Task 區段逐字全文，relevantFiles 取自其 **Files:** 清單
//   decisions  : [{ taskNumber, action: 'skip' | 'note', note? }]
//                — resume 時使用者裁決的物化副本（首次啟動為 []）
// ============================================================================

const { changeName, designPath, mode, models, templates, tasks, decisions = [] } = args

// ---- fail-fast：模板 placeholder 契約檢查（跨檔隱式耦合的守門）----
const REQUIRED_PLACEHOLDERS = {
  implementer: ['{TASK_NUMBER}', '{TASK_BODY}', '{DESIGN_PATH}', '{MODE}', '{RELEVANT_FILES}'],
  taskReviewer: ['{COMMIT_HASH}', '{DESIGN_PATH}', '{TASK_BODY}', '{MODE}'],
}
for (const [name, placeholders] of Object.entries(REQUIRED_PLACEHOLDERS)) {
  if (!templates || !templates[name]) return { error: `args.templates.${name} 缺失 — orchestrator 未依 flows/ultracode-apply.md 組裝 args` }
  for (const ph of placeholders) {
    if (!templates[name].includes(ph)) return { error: `模板 ${name} 缺少 placeholder ${ph} — prompts/*.md 與本 script 的契約已失準，停止` }
  }
}
if (!templates.isolationPreamble) return { error: 'args.templates.isolationPreamble 缺失' }
if (!Array.isArray(tasks) || tasks.length === 0) return { error: 'args.tasks 為空 — 無待執行 Task，不應啟動本 workflow' }

// ---- 工具函式 ----
// 變數替換用 split/join（非 regex、非 template literal），模板內任何字元都安全
const fill = (tpl, vars) => Object.entries(vars).reduce((s, [k, v]) => s.split('{' + k + '}').join(String(v)), tpl)
const preamble = templates.isolationPreamble + '\n\n---\n\n'

const skipSet = new Set(decisions.filter(d => d.action === 'skip').map(d => d.taskNumber))
const noteFor = n => (decisions.find(d => d.action === 'note' && d.taskNumber === n) || {}).note

const SEVERITY_ORDER = { Critical: 0, Important: 1, Minor: 2 }
const fmtReport = review => review.issues
  .slice()
  .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  .map(i => `- [${i.severity}] ${i.text}`)
  .join('\n')

function paused(kind, taskNumber, extra, completed, lastCommit) {
  // orchestrator 依 flows/ultracode-apply.md 的路由表處理；resume 前必須
  // 物化使用者裁決並通過 HEAD 指紋比對（lastCommit）。
  return Object.assign({ paused: kind, taskNumber, completed, lastCommit }, extra)
}

// git-ops prompt：workflow 模式下 phases/04-apply.md step 3（翻 checkbox）+
// step 4（fold 進實作 commit）的等價物。固定守則逐字鏡像 04-apply.md step 4。
function gitOpsPrompt(name, n, title, minors) {
  const advisories = minors.length
    ? `1b. 在該 Task 區段下新增（或補進既有的）「**Reviewer advisories ([Minor]):**」小節，逐字加入以下 bullet：\n${minors.map(i => `- ${i.text}`).join('\n')}`
    : ''
  return [
    '你是被主 session 委派的子代理，可以直接用 Bash 執行 git 命令，不需要再往下委派。',
    `任務：super-spec change「${name}」的 Task ${n}（${title}）已通過審查。把 tasks.md 的進度折入 HEAD 的實作 commit：`,
    `1. 編輯 openspec/changes/${name}/tasks.md：把 Task ${n} 區段的每個 sub-step checkbox 與 Task 標頭本身由 "- [ ]" 翻成 "- [x]"（已是 [x] 的不動）。`,
    advisories,
    `2. 若 git status --porcelain openspec/changes/${name}/tasks.md 為空 → 回報 ok=true 並結束（無事可做）。`,
    `3. 否則執行：git add openspec/changes/${name}/tasks.md && git commit --amend --no-edit`,
    '規則：git add 只准列出上述具體檔案，禁 git add -A / git add .；禁用 --no-verify 等任何 hook bypass 旗標；任何 git 失敗時把 stderr 逐字放進 error 欄回報並停止，禁止自行 git restore / reset --hard / checkout -- / clean。',
    '完成後回報 ok=true 與 amend 後的 commit hash（git rev-parse HEAD 的輸出）。',
  ].filter(Boolean).join('\n')
}

// ---- schemas：結構化輸出取代 04-apply.md 的字串契約解析 ----
const IMPL_SCHEMA = {
  type: 'object',
  required: ['status'],
  properties: {
    status: { type: 'string', enum: ['done', 'blocked'] },
    commit_hash: { type: 'string', description: 'status=done 時必填：實作 commit 的 hash（TDD 模式回報實作 commit，test commit 是其 parent）' },
    reason: { type: 'string', description: 'status=blocked 時必填：一句話原因' },
  },
}
const REVIEW_SCHEMA = {
  type: 'object',
  required: ['verdict', 'issues'],
  properties: {
    verdict: { type: 'string', enum: ['PASS', 'FAIL'] },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'text'],
        properties: {
          severity: { type: 'string', enum: ['Critical', 'Important', 'Minor'] },
          text: { type: 'string' },
        },
      },
    },
  },
}
const GIT_SCHEMA = {
  type: 'object',
  required: ['ok'],
  properties: {
    ok: { type: 'boolean' },
    commit_hash: { type: 'string' },
    error: { type: 'string', description: '失敗時：stderr 逐字' },
  },
}

// ---- Task loop（嚴格序列：per-Task 單一 commit + amend 語意假設線性 HEAD）----
const results = []
for (const task of tasks) {
  const n = task.number
  const ph = `Task ${n}`

  if (skipSet.has(n)) {
    results.push({ task: n, skipped: true })
    log(`Task ${n}：使用者裁決 skip（已物化於 tasks.md）`)
    continue
  }

  let failCount = 0
  let prevReport = null
  let prevCommit = null

  while (true) {
    const attempt = failCount + 1
    const escalated = failCount >= 2 // 2 連 FAIL → 第 3 次 dispatch 升級（04-apply.md 規則）
    const implModel = escalated ? models.implementerEscalated : models.implementer

    let implPrompt = preamble + fill(templates.implementer, {
      TASK_NUMBER: n,
      TASK_BODY: task.body,
      DESIGN_PATH: designPath,
      MODE: mode,
      RELEVANT_FILES: task.relevantFiles,
    })
    const note = noteFor(n)
    if (note) implPrompt += `\n\n## User guidance (injected after a workflow pause)\n${note}`
    if (prevReport) implPrompt += `\n\n## Previous review failed with these issues\n${prevReport}\n\nPrevious commit: ${prevCommit}\n(That commit sits at HEAD — fix by amending it, per your role instructions.)`

    const implOpts = { label: `implement:task${n}#${attempt}`, phase: ph, schema: IMPL_SCHEMA }
    if (implModel !== 'inherit') implOpts.model = implModel
    if (escalated) log(`Task ${n}：2 連 FAIL，第 ${attempt} 次 dispatch 升級為 ${models.implementerEscalated}`)

    const impl = await agent(implPrompt, implOpts)
    if (!impl) return paused('agent_error', n, { detail: 'implementer agent 中止或被使用者 skip' }, results, prevCommit)
    if (impl.status === 'blocked') return paused('blocked', n, { reason: impl.reason || '(未提供原因)' }, results, prevCommit)
    if (!impl.commit_hash) return paused('agent_error', n, { detail: 'implementer 回報 done 但缺 commit_hash' }, results, prevCommit)
    const commit = impl.commit_hash

    // Isolation Rule 3：reviewer prompt 只由模板 + hash + Task body 組成，
    // implementer 的任何敘事欄位（reason 等）在結構上進不來。
    const reviewPrompt = preamble + fill(templates.taskReviewer, {
      COMMIT_HASH: commit,
      DESIGN_PATH: designPath,
      TASK_BODY: task.body,
      MODE: mode,
    })
    const review = await agent(reviewPrompt, {
      label: `review:task${n}#${attempt}`,
      phase: ph,
      model: models.taskReviewer,
      schema: REVIEW_SCHEMA,
    })
    if (!review) return paused('agent_error', n, { detail: 'task-reviewer agent 中止' }, results, commit)

    // 路由唯一依據 = severity 清單（04-apply.md「Severity-based routing」）。
    // schema 已排除格式錯誤；verdict 與清單矛盾時以清單為準 —— 04-apply.md 的
    // 「Malformed reviewer output」補救分支在本路徑因此不存在。
    const gating = review.issues.filter(i => i.severity === 'Critical' || i.severity === 'Important')
    const minors = review.issues.filter(i => i.severity === 'Minor')

    if (gating.length === 0) {
      const git = await agent(gitOpsPrompt(changeName, n, task.title, minors), {
        label: `git-ops:task${n}`,
        phase: ph,
        model: models.gitOps,
        schema: GIT_SCHEMA,
      })
      if (!git || !git.ok) return paused('git_error', n, { stderr: (git && git.error) || 'git-ops agent 中止' }, results, commit)
      results.push({ task: n, commit: git.commit_hash || commit, attempts: attempt, minors: minors.map(i => i.text) })
      log(`Task ${n} PASS（attempt ${attempt}${minors.length ? `，${minors.length} 個 [Minor] 已記錄進 tasks.md` : ''}）`)
      break
    }

    failCount += 1
    log(`Task ${n} FAIL #${failCount}（${gating.length} 個 [Critical]/[Important]）`)
    if (failCount >= 3) return paused('fail_cap', n, { reviewerReport: fmtReport(review) }, results, commit)
    prevReport = fmtReport(review)
    prevCommit = commit
  }
}

return { completed: true, results }
