# Ultracode Review flow — Phase 5 以 multi-lens panel 執行

**進入條件**：Phase 5 entry，且 `proposal.md` 的 `## Engine` 為 `ultracode`，**且達規模門檻**（見第 1 節）。未達門檻或 engine 為 native → 走 `phases/05-final-review.md` 現行單 final-reviewer 路徑。

**授權聲明**：同 `flows/ultracode-apply.md` — 使用者在 HARD-GATE B2 的 engine 選擇（落盤於 proposal.md）即為 Workflow 工具的合法 opt-in。

**本 flow 全程 read-only**：workflow 不做任何 git 寫入，中途死掉或結果異常直接**整個重跑**即可——無 pause/resume 協議、無 HEAD 指紋需求。

---

## 1. 規模門檻（雙軌判定）

Panel 成本約單 reviewer 的 3–5 倍，小 change 不划算。計算：

- Task 數 = `tasks.md` 中 Task 標頭總數（含 revision tasks）
- diff 行數 = `git diff --shortstat <baseline>..HEAD` 的 insertions + deletions（baseline 推導同 `phases/05-final-review.md` 的 `{COMMIT_RANGE}`）

**Task 數 ≥ 4 或 diff ≥ 800 行** → 啟用 panel（本 flow）。否則 → announce「未達 panel 門檻（Task N、diff M 行），Phase 5 走單 final-reviewer」並回到 `phases/05-final-review.md` 現行流程。判定結果一律 announce 給使用者。

## 2. Pre-check — Workflow 工具可用性

若目前 toolset 沒有 Workflow 工具：announce「Workflow 工具不可用，Phase 5 退回單 final-reviewer」，回 `phases/05-final-review.md` 現行流程。不 halt。

## 3. 組裝 args（白名單制）

以實際 JSON 值傳入（不是 JSON 字串）：

| 欄位 | 來源 | 規則 |
|---|---|---|
| `changeName` | `<name>` | — |
| `mode` | `proposal.md` `## Mode` | 只留 discipline（`TDD` / `Simple`） |
| `commitRange` | 同 `phases/05-final-review.md` 的 `{COMMIT_RANGE}` 推導 | `<baseline>..HEAD` |
| `paths` | change 目錄 | `{proposal, design, tasks, specsDir}` 四個路徑 |
| `models` | `proposal.md` `## Ultracode Agent Models` 表的 panel 列 | 對映 `{lens, holistic, skeptic, judge}`；**表中缺 panel 列時（v1 建立的 proposal）用預設：lens=sonnet、holistic=opus、skeptic=sonnet、judge=sonnet** |
| `templates` | Read 七個檔（逐字全文，`{PLACEHOLDER}` 原樣保留） | `_isolation-preamble.md`、`final-lens-spec.md`、`final-lens-lifecycle.md`、`final-lens-coherence.md`、`final-reviewer.md`（holistic lens 原樣重用）、`final-skeptic.md`、`final-judge.md` |

**args 禁入清單**（Isolation Rule 5/6）：per-task reviewer 報告、implementer 敘事、brainstorming 對話。lens 們跟現行 final-reviewer 一樣，一切從磁碟 artifacts 與 git 自取。

## 4. 啟動與結果處理

呼叫 Workflow：`scriptPath` = 本 skill 目錄的 `workflows/final-review.js`。

script 回傳 `{verdict, summary, issues, notes, suggestions, panelStats}`。處理順序：

1. **Sanity 重算**（orchestrator 對 script 的最後防線，對應 05 的 severity rule 再驗證）：`verdict` 必須滿足——`APPROVED` ⇔ `issues` 為空；`CHANGES REQUESTED` ⇔ `issues` 非空且無 `is_design_flaw=true`；`NEEDS DESIGN UPDATE` ⇔ 存在 `is_design_flaw=true`。不符（理論上不可能，script 是 deterministic）→ 不採用該結果，整個 workflow 重跑一次；再不符 → 暫停，把 script 回傳的 JSON 原文完整呈給使用者並等待指示（不自行改寫或挑選其中一次的結果）。
2. **組 `review.md`**：依 `templates/review.md` 結構與 `phases/05-final-review.md` 的三種 block 逐字格式組稿——`Verdict` = verdict、`Summary` = summary、`## Issues` = issues（severity 排序、含 design-level flaw 標註）、`## Notes` = notes（含降級標註）、`## Suggested revision tasks` / `## Suggested resolutions` = suggestions。寫入磁碟但**不 commit**（照舊由 Phase 6 吸收）。
3. **回到 `phases/05-final-review.md` 的「Route by verdict」節**照現行規則路由（APPROVED 等使用者、CHANGES REQUESTED 問 revision tasks、NEEDS DESIGN UPDATE 走 recover）。下游 recover / revision 流程零改動。

`{error: ...}` 回傳（模板契約 fail-fast / judge 中止）→ 修正後整個重跑（read-only 無副作用）。

## 5. 已知取捨與 fallback

- **skeptic 只讀 diff 不跑 build**，可能誤殺真 bug——投票降級的去向分兩種：降一級後**仍是 Critical/Important 者留在 `## Issues`（照樣 gating）**；降到 Minor 者才移入 `## Notes`，並以原 severity + confirms 標註供使用者複核（script 已自動做，組稿時不得省略）。
- **design-flaw 也服從投票**（既定語意）：`is_design_flaw` 只在投票後仍 gating 的 issue 上觸發 `NEEDS DESIGN UPDATE`；被 0 票反證降為 Minor 的 design-flaw 進 Notes、不觸發——兩個獨立 skeptic 都反證不成立的「設計缺陷」大概率是誤報，人工複核仍可從 Notes 撿回。
- **holistic lens 的 `/code-review`**：`final-reviewer.md` 模板指示經 Skill 呼叫 `/code-review`；若 workflow 子代理環境無 Skill 工具，script 附加的 override 已指示它自行做 correctness/DRY/efficiency 分析，不會 fail。
- **skeptic 上限 12 個候選**：超過時 script 會 `log()` 明示「其餘以原 severity 未驗證保留」——寧嚴勿漏，不做靜默截斷。
- Panel 模式下 `phases/05-final-review.md` 的「reviewer 輸出違反 severity rule → 重派」補救段不適用（verdict 是算出來的，不是模型說的）。
