# Phase 4 — Apply

> **Todo:** at Phase 4 entry, rewrite the list from Shape A to **Shape B** — expand `Phase 4 · Apply tasks` into one `Phase 4 · Task N: <title>` item per Task in `tasks.md`, with already-`- [x]` Tasks marked `completed` (see `flows/todo-tracking.md`). Do this once, after the sweep below and before the Task loop.

## 0. Phase-entry sweep — purge superpowers artifacts (idempotent)

Run **once at Phase 4 entry, before the first Task iteration**. Idempotent on resume. This is the last safe window for history rewrite — no implementation commit exists yet, so `git rebase --onto` cannot conflict on overlapping paths.

**All git commands in this section must be delegated to a haiku Agent subagent** (same rule as Phase 3's absorb) — describe the full conditional logic in the subagent prompt and have it report the result. History rewrite is involved: on any rebase conflict the subagent must halt and report stderr verbatim instead of resolving or aborting on its own.

If `git status --porcelain` shows uncommitted tracked changes, `git stash push --keep-index -m "super-spec phase-4-sweep"` first; `git stash pop` after the sweep.

### 0.1 File sweep

```
ls docs/superpowers/specs/ docs/superpowers/plans/ 2>/dev/null
```

If anything exists: `rm -rf docs/superpowers/specs/ docs/superpowers/plans/` then `rmdir docs/superpowers 2>/dev/null` (only if empty).

### 0.2 Determine baseline

Baseline = the commit immediately before `openspec(<name>): planning`:

```
PLANNING_HASH=$(git log --oneline --grep="openspec(<name>): planning" --format="%H" -n 1)
BASELINE=$(git rev-parse "${PLANNING_HASH}~1")
```

If `PLANNING_HASH` is empty, halt and report (sweep should never run before the Phase-3 planning commit).

### 0.3 Scan baseline..HEAD for rogue commits

For each commit in `git log --format="%H" "$BASELINE"..HEAD`, mark it **rogue** if **every** path under `git show --name-only --format= "$HASH"` lies inside `docs/superpowers/specs/` or `docs/superpowers/plans/`. Build the rogue list oldest → newest.

### 0.4 Drop rogue commits via rebase

For each rogue hash (oldest first):

```
git rebase --onto "${HASH}^" "$HASH" HEAD
```

Drops one commit and replays the rest onto its parent. No conflict risk: any later commit touching `docs/superpowers/...` would itself be rogue and excluded from the replay set. After each rebase HEAD shifts, so re-scan `$BASELINE..HEAD` and repeat until no rogues remain.

### 0.5 Final verification

`git log "$BASELINE"..HEAD --format="%H %s"` and `ls docs/superpowers/ 2>/dev/null` must show zero `docs:` rogue subjects and no `docs/superpowers/` directory. Otherwise halt and report.

---

## Engine routing (after the sweep, before the Task loop)

Read `## Engine` from `openspec/changes/<name>/proposal.md`:

- **`ultracode`** → Read `flows/ultracode-apply.md` and execute it **instead of** the Task loop below (steps 1–5 are the native path; do not run them). The section-0 sweep above runs in BOTH engines — it is orchestrator-side and never moves inside a Workflow.
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
