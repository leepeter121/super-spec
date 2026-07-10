# Phase 4 — Apply

> **Todo:** at Phase 4 entry, rewrite the list from Shape A to **Shape B** — expand `Phase 4 · Apply tasks` into one `Phase 4 · Task N: <title>` item per Task in `tasks.md`, with already-`- [x]` Tasks marked `completed` (see `flows/todo-tracking.md`). Do this once, after the sweep below and before the Task loop.

## 0. Phase-entry sweep (once, at entry only)

**Only at Phase 4 entry** (fresh or resumed — not on per-Task re-Reads of this file): Read `flows/phase4-sweep.md` and execute it — it purges superpowers artifacts and may rewrite history, so it runs orchestrator-side in BOTH engines, before anything else in this phase. If this Read happens at the top of a Task iteration (the sweep already ran at entry), skip straight to the Task loop below.

---

## Engine routing (after the sweep, before the Task loop)

Read `## Engine` from `openspec/changes/<name>/proposal.md`:

- **`ultracode`** → Read `flows/ultracode-apply.md` and execute it **instead of** the Task loop below (steps 1–5 are the native path; do not run them).
- **`native` or the section is absent** (changes created before engines existed) → continue with the Task loop below.

## Task loop

Loop over each Task in `tasks.md` that is not yet complete (`- [ ]` at the Task header level).

For each Task, do steps 1 → 4 in order.

## 1. Dispatch the implementer subagent

> **Todo:** mark this Task's `Phase 4 · Task N` item `in_progress` before dispatching. Re-dispatches and FAIL rounds keep it `in_progress`.

Use the **Agent** tool (not Skill — we need fresh-context isolation).

Read `prompts/implementer.md` (relative to this skill's directory) and substitute the variables. Pass the resulting text as the agent's prompt.

Variables:
- `{TASK_NUMBER}`: Task index (e.g., 3)
- `{TASK_BODY}`: This Task's section from tasks.md only (header + sub-steps)
- `{DESIGN_PATH}`: `openspec/changes/<name>/design.md`
- `{MODE}`: `TDD` or `Simple` — the **discipline** only. Strip any model qualifier from `proposal.md`'s `## Mode` line: both `TDD (Sonnet)` and `TDD (Opus)` map to `TDD` here.
- `{RELEVANT_FILES}`: list of existing files this Task touches (extract from the Task body's `**Files:**` section)

**Model:** read the parenthetical on `proposal.md`'s `## Mode` line (use Agent-tool aliases, not full model IDs — aliases track the latest version automatically):
- `TDD (Sonnet)` → `sonnet`
- `TDD (Opus)` → `opus`
- `Simple` → inherit (omit the `model` parameter)

**Escalation override:** if this dispatch is a re-dispatch after the **2nd consecutive FAIL** on this Task, use `opus` regardless of the Mode line (see "Model escalation on consecutive FAIL" below).

**Forbidden in this prompt** (do not include):
- Brainstorming conversation
- `proposal.md` content (apart from the Mode flag, which is passed via `{MODE}`)
- Other Tasks' content
- Other Tasks' reviewer reports
- Any other implementer's response or narrative

The implementer is contractually required to return one line: `Done: <commit_hash>` or `Blocked: <reason>`.

### Blocked routing

If the implementer returns `Blocked: <reason>`, do NOT dispatch a reviewer. Pause the workflow: surface the reason verbatim and ask the user how to proceed (e.g., adjust the design, rewrite this Task's body, skip it, intervene manually). A `Blocked` return does not count toward the consecutive-FAIL counter.

## 2. Dispatch the task-reviewer subagent

Use the **Agent** tool. Read `prompts/task-reviewer.md` and substitute:
- `{COMMIT_HASH}`: the hash from the implementer's response
- `{DESIGN_PATH}`: `openspec/changes/<name>/design.md`
- `{TASK_BODY}`: the same Task section
- `{MODE}`: the same discipline flag passed to the implementer (`TDD` or `Simple`)

**Model:** `sonnet`

**Forbidden:** the implementer's narrative; other Tasks' content.

The reviewer returns one of:

- `PASS` — no issues at all.
- `PASS` followed by a bullet list of `[Minor]`-tagged advisory items — Task passes; record the Minor list (see "Recording Minor advisories" below) but do NOT re-dispatch.
- `FAIL` followed by a bullet list — at least one `[Critical]` or `[Important]` issue exists; re-dispatch (see below). The bullet list is severity-ordered: `[Critical]` first, then `[Important]`, then any `[Minor]`.

### Severity-based routing

- **No `[Critical]` and no `[Important]`** → Task passes. If the reviewer surfaced any `[Minor]` items, record them per "Recording Minor advisories", then proceed to step 3 (mark complete) and step 4 (fold into the implementer commit).
- **Any `[Critical]` or `[Important]`** → re-dispatch the implementer (step 1) with the **full reviewer output** (including any `[Minor]` items so the implementer can address them opportunistically) appended under a `## Previous review failed with these issues` section, plus a `Previous commit: <commit_hash>` line. The re-dispatched implementer fixes by **amending** that commit (it sits at HEAD), so each Task still ends with a single implementation commit; the amended hash becomes the new `{COMMIT_HASH}` for re-review. Track the failure count.

The implementer is required to address every `[Critical]` and `[Important]` issue. `[Minor]` items are advisory — addressing them is encouraged but not gating.

### Malformed reviewer output

If the reviewer's output does not start with `PASS` or `FAIL`, or contradicts the severity rules (e.g., `FAIL` with only `[Minor]` items, or `PASS` listing a `[Critical]`/`[Important]`), do not silently reinterpret it: re-dispatch the task-reviewer once with a note pointing out the inconsistency. If the second output is still malformed, pause and surface both outputs to the user. Malformed rounds do not count toward the consecutive-FAIL counter.

### Model escalation on consecutive FAIL

Track consecutive FAILs per Task. The implementer model per attempt:

- **1st FAIL → 2nd dispatch:** same model as the Mode line (a re-try with the reviewer report is usually enough).
- **2nd FAIL → 3rd dispatch:** escalate the implementer to `opus` (if not already `opus`). A model stuck twice on the same blind spot rarely fixes it on the third identical attempt — one `opus` dispatch is cheaper than burning another failed round plus the human-intervention pause.
- The task-reviewer stays on `sonnet` throughout — only the implementer escalates.
- The escalation is per-Task and resets on the next Task. It does NOT modify `proposal.md`'s `## Mode` line.

### Recording Minor advisories

When a Task passes with `[Minor]` items, append them to the Task's section in `tasks.md` under a `**Reviewer advisories ([Minor]):**` sub-heading (one bullet per item, verbatim from the reviewer). This carries the items forward to Phase 5 so the final-reviewer can decide whether they accumulate into a real problem.

### Failure cap

After the **3rd consecutive FAIL** on the same Task, **pause** the workflow:
- Output the latest reviewer report to the user
- Ask: "Reviewer has failed 3 times. How would you like to proceed? (e.g., adjust the design, skip this task, manually intervene)"
- Wait for user direction

## 3. Mark Task complete

> **Todo:** after flipping the checkboxes below, mark this Task's `Phase 4 · Task N` item `completed`.

Use the Edit tool to flip `- [ ]` → `- [x]` for:
- Each sub-step under this Task (if not already done by the implementer)
- The Task header itself

## 4. Fold tasks.md into the implementer commit

If `tasks.md` has uncommitted changes after steps 2–3, **amend them into the implementer's feat commit**. Do NOT create a separate `openspec(<name>): record ...` commit. Skip this step if `git status --porcelain openspec/changes/<name>/tasks.md` is empty.

Delegate to a haiku Agent subagent. Prompt must contain:
- Opening: `你是被主 session 委派的子代理，可以直接用 Bash 執行 git 命令，不需要再往下委派。`
- Commands: `git add openspec/changes/<name>/tasks.md && git commit --amend --no-edit`
- On failure: report stderr verbatim and halt; no `restore` / `reset --hard` / hook-bypass recovery.

Safe to amend: the task-reviewer's verdict is already in; no downstream step references the pre-amend hash.

## 5. Loop

If more Tasks remain with `- [ ]`, return to step 1 with the next Task. Otherwise → Phase 5.
