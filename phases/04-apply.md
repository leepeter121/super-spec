# Phase 4 — Apply

## 0. Phase-entry sweep — purge any superpowers artifacts (idempotent)

Run this **once at Phase 4 entry, before the first Task iteration**. Idempotent — re-running on resume into Phase 4 mid-stream is a no-op when nothing is stale.

This is the last opportunity for safe history rewrite: no implementation commit exists yet, so `git rebase --onto` cannot conflict on overlapping paths.

### 0.1 File sweep

```
ls docs/superpowers/specs/ docs/superpowers/plans/ 2>/dev/null
```

If anything exists:

```
rm -rf docs/superpowers/specs/ docs/superpowers/plans/
rmdir docs/superpowers 2>/dev/null  # only if empty
```

### 0.2 Determine baseline

Baseline = the commit immediately **before** `openspec(<name>): propose`.

```
PROPOSE_HASH=$(git log --oneline --grep="openspec(<name>): propose" --format="%H" -n 1)
BASELINE=$(git rev-parse "${PROPOSE_HASH}~1")
```

If `PROPOSE_HASH` is empty, halt and report (Phase 4 sweep should never run before Phase 2).

### 0.3 Scan baseline..HEAD for rogue commits

For each commit in `git log --format="%H" "$BASELINE"..HEAD`:

```
HASH=<this commit>
PATHS=$(git show --name-only --format= "$HASH")
```

A commit is **rogue** if **every** path in `$PATHS` lies under `docs/superpowers/specs/` or `docs/superpowers/plans/`.

Build the list of rogue hashes (oldest → newest order matters for the rebase).

### 0.4 Drop rogue commits via rebase

For each rogue hash (process oldest first):

```
git rebase --onto "${HASH}^" "$HASH" HEAD
```

This drops one commit and replays everything above it onto the parent. Zero conflict risk because no later commit touches `docs/superpowers/...` paths (any that did would itself be rogue and excluded from the replay set).

After each rebase:
- HEAD shifts; remaining rogue hashes from the original list become invalid
- Re-scan with the updated `$BASELINE..HEAD` and repeat until no rogues remain

### 0.5 Final verification

```
git log "$BASELINE"..HEAD --format="%H %s"
ls docs/superpowers/ 2>/dev/null
```

Must show: zero `docs:` rogue subjects, no `docs/superpowers/` directory. If either fails, halt and report.

### 0.6 Stash protection

If `git status --porcelain` shows uncommitted tracked changes before the sweep, stash first:

```
git stash push --keep-index -m "super-spec phase-4-sweep"
```

Pop after the sweep:

```
git stash pop
```

(Untracked files unrelated to `docs/superpowers/` are left in place.)

---

## Task loop

Loop over each Task in `tasks.md` that is not yet complete (`- [ ]` at the Task header level).

For each Task, do steps 1 → 4 in order.

## 1. Dispatch the implementer subagent

Use the **Agent** tool (not Skill — we need fresh-context isolation).

Read `prompts/implementer.md` (relative to this skill's directory) and substitute the variables. Pass the resulting text as the agent's prompt.

Variables:
- `{TASK_NUMBER}`: Task index (e.g., 3)
- `{TASK_BODY}`: This Task's section from tasks.md only (header + sub-steps)
- `{DESIGN_PATH}`: `openspec/changes/<name>/design.md`
- `{MODE}`: `TDD` or `Simple`
- `{RELEVANT_FILES}`: list of existing files this Task touches (extract from the Task body's `**Files:**` section)

**Model:** `claude-sonnet-4-6` if `{MODE}` is `TDD`; otherwise inherit (omit the `model` parameter).

**Forbidden in this prompt** (do not include):
- Brainstorming conversation
- `proposal.md` content (apart from the Mode flag, which is passed via `{MODE}`)
- Other Tasks' content
- Other Tasks' reviewer reports
- Any other implementer's response or narrative

The implementer is contractually required to return one line: `Done: <commit_hash>` or `Blocked: <reason>`.

## 2. Dispatch the task-reviewer subagent

Use the **Agent** tool. Read `prompts/task-reviewer.md` and substitute:
- `{COMMIT_HASH}`: the hash from the implementer's response
- `{DESIGN_PATH}`: `openspec/changes/<name>/design.md`
- `{TASK_BODY}`: the same Task section

**Model:** `claude-sonnet-4-6`

**Forbidden:** the implementer's narrative; other Tasks' content.

The reviewer returns `PASS` or `FAIL\n- <issues>`.

If `FAIL`, re-dispatch the implementer (step 1) with the FAIL issues appended to the prompt under a `## Previous review failed with these issues` section. Track the failure count.

After the **3rd consecutive FAIL** on the same Task, **pause** the workflow:
- Output the latest reviewer report to the user
- Ask: "Reviewer has failed 3 times. How would you like to proceed? (e.g., adjust the design, skip this task, manually intervene)"
- Wait for user direction

## 4. Mark Task complete

Use the Edit tool to flip `- [ ]` → `- [x]` for:
- Each sub-step under this Task (if not already done by the implementer)
- The Task header itself

## 5. Loop

If more Tasks remain with `- [ ]`, return to step 1 with the next Task. Otherwise → Phase 5.
