# Ultracode Apply flow — Phase 4 以 Workflow script 執行

**進入條件**：Phase 4 entry，且 `proposal.md` 的 `## Engine` 為 `ultracode`，且 `flows/phase4-sweep.md` 的 entry sweep **已在 orchestrator 側跑完**（sweep 含歷史重寫，永遠不進 Workflow）。

**授權聲明**：使用者已在 HARD-GATE B2 選擇 ultracode engine（落盤於 `proposal.md`），此即 Workflow 工具的合法 opt-in——啟動 Workflow 前**不需**再次向使用者確認，不論當下訊息是否含 "ultracode" 關鍵字。

**真相源規則（貫穿全 flow）**：git 歷史 + `tasks.md` checkbox 是進度的**唯一**真相源；Workflow 的 journal.jsonl 只是執行快取。兩者矛盾時信 git + tasks.md。

---

## 1. Pre-check — Workflow 工具可用性

若目前 toolset 沒有 Workflow 工具：向使用者announce「Workflow 工具不可用，此 change 退回 native engine 執行」，然後回到 `phases/04-apply.md` 的 Task loop（native 路徑）。不 halt。

## 2. 組裝 args（白名單制）

依下列清單組 JSON，**以實際 JSON 值傳入 Workflow 的 `args` 參數（不是 JSON 字串）**：

| 欄位 | 來源 | 規則 |
|---|---|---|
| `changeName` | `<name>` | — |
| `designPath` | `openspec/changes/<name>/design.md` | — |
| `mode` | `proposal.md` `## Mode` 行 | 只留 discipline：`TDD (Sonnet)` / `TDD (Opus)` → `TDD`；`Simple` → `Simple` |
| `models` | `proposal.md` `## Ultracode Agent Models` 表 | 逐列對映 `{implementer, implementerEscalated, taskReviewer, gitOps}`；Simple mode 的 implementer 記 `inherit` |
| `templates.isolationPreamble` | Read `prompts/_isolation-preamble.md` | **逐字全文**，不改寫不摘要 |
| `templates.implementer` | Read `prompts/implementer.md` | 逐字全文，`{PLACEHOLDER}` 原樣保留——變數替換由 script 內 split/join 執行，不在此處 |
| `templates.taskReviewer` | Read `prompts/task-reviewer.md` | 同上 |
| `tasks` | 解析 `tasks.md` | Task 標頭仍為 `- [ ]` 的每個 Task → `{number, title, body, relevantFiles}`；`body` 是該 Task 區段逐字全文（標頭 + Interfaces + sub-steps + Files），`relevantFiles` 取自 `**Files:**`。Phase 5 `CHANGES REQUESTED` 後追加的 `### Revision N - Task M:` 區塊同樣以 `- [ ]` 標頭出現——視為一般 Task 解析（number 用其在檔中的識別，如 `R1-T2`） |
| `decisions` | 首次啟動 = `[]` | resume 時見第 5 節 |

**args 禁入清單（Isolation Rule 5 的 workflow 對應）**：brainstorming 對話、`proposal.md` 其餘內容（What/Why）、其他 Task 的 reviewer 報告、任何 implementer 敘事。模板 + Task 陣列 + 路徑 + 模型表，僅此而已。

## 3. 啟動

啟動前先執行 `git rev-parse HEAD` 並記下（第 5 節 rule 2 的指紋基準）。然後呼叫 Workflow 工具：`scriptPath` = 本 skill 目錄的 `workflows/apply.js`，`args` = 上節 JSON。記下回傳的 `runId`（與指紋基準一樣只存在對話中即可——見第 5 節 cross-session 規則）。

> **Todo：**啟動前把第一個 pending Task 的 `Phase 4 · Task N` 項標 `in_progress`。Workflow 背景執行期間 todo 清單凍結，之後只在每次 return/pause 邊界依 `results`/`completed` 同步（`flows/todo-tracking.md` 的逐 Task 更新在此模式下退化為邊界批次更新——已知的可觀測性代價）。

## 4. 回傳路由

| 回傳 | 處理 |
|---|---|
| `{completed: true, results}` | 用 `git log` 與 `tasks.md` 覆核每個 Task 都有實作 commit 且 checkbox 全 `- [x]`（真相源覆核，不只信 results）。同步 todo → 全部 `completed`。→ Phase 5。 |
| `{paused: 'blocked', taskNumber, reason}` | 等同 04-apply.md 的 Blocked routing：把 reason 逐字呈現，AskUserQuestion 問使用者如何進行（調整 design / 改寫 Task body / skip / 手動介入）。 |
| `{paused: 'fail_cap', taskNumber, reviewerReport}` | 等同 04-apply.md 的 Failure cap：把 reviewerReport 逐字輸出，問使用者如何進行。 |
| `{paused: 'git_error', stderr}` / `{paused: 'agent_error', detail}` | 逐字呈現，暫停等使用者指示。禁止自行以 git 破壞性命令「修復」。 |
| `{error: ...}` | script 的 fail-fast 契約檢查失敗（模板/placeholder/args 缺失）。修正 args 組裝後重新啟動全新 run，不 resume。 |

每個 paused 回傳都帶 `completed`（已完成 Task 的 results）與 `lastCommit`——先依 `completed` 同步 todo，再處理暫停本身。

## 5. Resume 協議（HARD RULES）

1. **裁決先物化，才准 resume。**使用者的決定必須先寫進 artifacts，且物化一律在 **orchestrator 側**執行（script 內的 git-ops agent 只服務 run 中的 PASS 折入，暫停後的物化不歸它）：
   - **skip** → 把該 Task 標頭改為 `- [x]`（加註 `（skipped by user）`）、由 orchestrator 委派 haiku Agent subagent commit 進 git（此 commit 是**已知位移**，計入 rule 2 的 EXPECTED_HEAD），然後 `decisions` 追加 `{taskNumber, action: 'skip'}`。
   - **給指引重試** → `decisions` 追加 `{taskNumber, action: 'note', note: '<使用者指引逐字>'}`。**不產生 commit、HEAD 不動**——這是唯一零 git 位移的裁決。script 會把 note 注入該 Task 的 implementer prompt，prompt 改變 → 該 Task 起快取失效、重新實跑（正是要的效果），之前已完成 Task 的快取全數保留。
   - **改寫 Task body / design** → 先改 `tasks.md`（或走 design 修訂路徑）並 commit（同樣計入 EXPECTED_HEAD），再**重組 args**（該 Task 的 body 已變 → 該 Task 起快取失效；之前完成的 Task prompt 未變，快取仍命中）。
   - 只存在對話中、未物化的裁決**不得**作為 resume 依據。
2. **EXPECTED_HEAD 指紋記帳。**目的：偵測 orchestrator **之外**的介入（使用者手動 commit / amend / reset）。做法：
   - 基準：EXPECTED_HEAD 初始 = paused payload 的 `lastCommit`（為 null 時 = 第 3 節啟動前記下的 HEAD）。
   - 記帳：orchestrator 每委派一筆物化 commit（rule 1 的 skip / body 修改），就把 EXPECTED_HEAD 更新為該 subagent 回報的新 hash。
   - 檢查：`resumeFromRunId` 前執行 `git rev-parse HEAD`，必須**等於** EXPECTED_HEAD。不等 → 有未知介入，禁用 `resumeFromRunId`，改依 `tasks.md` 剩餘 `- [ ]` 重組 args 啟動**全新** run。journal 快取只在 git 狀態未被未知介入時可信。
   - 本 rule 是 same-session 概念（基準只存在於對話中）；跨 session 一律走 rule 4，無需比對。
3. **無變更不 resume。**`fail_cap` / `blocked` 的暫停，若 resume 時沒有任何改變該 Task 流程的裁決（skip / note / body 修改），快取前綴會原樣重放並停在同一個暫停點——此種 resume 無效，禁止執行。
4. **同 session 才有 `resumeFromRunId`。**跨 session 恢復（走 `flows/resume-detection.md` 進來）一律依 `tasks.md` 剩餘任務組新 args 啟動新 run——因為真相源是 git + tasks.md，這永遠安全，只是損失快取。

## 6. Context Isolation Rules 在 workflow 模式的對應

| SKILL.md 規則 | workflow 模式的落實 |
|---|---|
| 1. Agent tool 隔離 | Workflow 的每個 `agent()` 就是 fresh-context 子代理 |
| 2. prompt 逐字來自 `prompts/*.md` | orchestrator 在**啟動時**逐字 Read 模板經 args 傳入；script 只做 `{PLACEHOLDER}` split/join 替換，不改寫模板文字 |
| 3. reviewer 只看 git 不看敘事 | script 內 reviewer prompt 僅由模板 + commit hash + Task body 組成；implementer 回傳是 schema 物件，敘事欄位在結構上進不了 reviewer prompt |
| 4. per-Task fresh subagent | 每次 `agent()` 呼叫都是新代理，迴圈內不重用 |
| 5. strip orchestrator context | 第 2 節的 args 白名單 |
| 6. final-reviewer fresh | Phase 5 不在本 flow 範圍（v1 維持 native），規則原樣適用 |

## 7. 與 native 路徑的行為差異（已接受的取捨）

- reviewer 輸出由 schema 強制結構化：04-apply.md 的「Malformed reviewer output」補救分支在此路徑**不存在**；verdict 與 severity 清單矛盾時，一律以 severity 清單路由（與 04-apply.md「Severity-based routing」同義）。
- 04-apply.md step 3（Edit 翻 checkbox）與 step 4（haiku fold-in）合併為 script 內單一 git-ops agent。
- 執行期間過程可觀測性下降（背景執行）：以 `log()` 訊息、journal.jsonl、與邊界 todo 同步補償為「事後可稽核」。
