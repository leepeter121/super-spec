# Phase 6 — Archive

> **Todo:** mark `Phase 6 · Archive` `in_progress` (see `flows/todo-tracking.md`); mark it `completed` at the STOP step.

Only enter when the user gives an explicit "archive" instruction after `APPROVED`.

## 1. Compose the archive commit message

Build the PR-ready summary that the archive commit will carry. Do this before running `openspec archive`.

### 1a. Gather inputs

- From `proposal.md`: extract `## What`, `## Why`, `## Mode`.
- Baseline = parent of the `openspec(<name>): planning` commit:
  ```
  BASELINE=$(git rev-parse "$(git log --grep='openspec(<name>): planning' --format='%H' -n 1)~1")
  ```
- Implementation commits: `git log "$BASELINE"..HEAD --format='%h %s' --no-merges`, excluding `openspec(<name>):` scaffolding (keep `feat`/`fix`/`refactor`/etc.).
- Count implementation commits and tasks (from final `tasks.md`).
- Confirm `review.md` verdict = `APPROVED`.

### 1b. Build the message (HARD CAP: 15 lines total, including blanks)

Use this exact structure:

```
chore(openspec): archive <name>

<one or two sentences distilled from proposal ## What>

Why: <one sentence from proposal ## Why>

Key changes:
- <bullet summarizing key implementation area 1>
- <bullet summarizing key implementation area 2>
- <bullet summarizing key implementation area 3>

Mode: <TDD (Sonnet)|TDD (Opus)|Simple> · Tasks: <N> · Commits: <M> · Review: APPROVED
```

Bullet rules: 3 ideal (max 4), ≤ 80 chars each, lead with a verb, group by area not 1:1 to commits. If the message exceeds the 15-line cap, tighten What/Why/bullets — never drop the `Mode: ...` line.

Store the final message as `{COMMIT_MESSAGE}` for the next step.

## 2. Run the archive command

```
openspec archive <name>
```

This moves `openspec/changes/<name>/` into `openspec/changes/archive/` and merges the change's spec deltas into `openspec/specs/` (the living spec). The uncommitted `review.md` from Phase 5 gets moved along and is absorbed by step 3's `git add openspec/`.

## 3. Dispatch the archive-committer subagent

Use the **Agent** tool. Read `prompts/archive-committer.md` and substitute:
- `{CHANGE_NAME}`: `<name>`
- `{COMMIT_MESSAGE}`: the multi-line message from step 1b (pass verbatim, preserve newlines)

**Model:** `haiku`

**Forbidden:** any phase conversation; reviewer reports. (`proposal.md` is allowed — already distilled into `{COMMIT_MESSAGE}`.)

The subagent stages the archive file moves with `git add openspec/` and commits using `{COMMIT_MESSAGE}` verbatim.

## 4. Squash all commits since baseline

Delegate to a **haiku** Agent subagent. Include the standard CLAUDE.md delegating preamble, then:

```
你是被主 session 委派的子代理，可以直接用 Bash 執行 git 命令，不需要再往下委派。
```

Subagent job:

1. Locate the baseline:
   ```
   PLANNING_HASH=$(git log --oneline --grep="openspec(<name>): planning" --format="%H" -n 1)
   BASELINE=$(git rev-parse "${PLANNING_HASH}~1")
   ```
2. Count commits: `COUNT=$(git rev-list --count "$BASELINE"..HEAD)`
3. If `COUNT` ≤ 1, output `Skipped: only 1 commit since baseline` and stop.
4. Soft-reset to baseline (keeps all changes staged):
   ```
   git reset --soft "$BASELINE"
   ```
5. Re-commit with `{COMMIT_MESSAGE}` verbatim (use a heredoc):
   ```
   git commit -m "$(cat <<'CMEOF'
   {COMMIT_MESSAGE}
   CMEOF
   )"
   ```
6. Output: `Done: <new_commit_hash> (squashed <COUNT> commits)`

On any git failure, report stderr verbatim and halt — no `restore`/`reset --hard`/hook-bypass recovery.

Before dispatching, substitute in the subagent prompt:
- Every `<name>` → the actual change name (same name used in steps 2 and 3).
- `{COMMIT_MESSAGE}` → the exact multi-line message from step 1b.

## 5. STOP

> **Todo:** mark `Phase 6 · Archive` `completed` — all items are now done.

Do not merge. Do not push. Do not open a PR.

Output to user:
```
Archive complete for <name>.
Commit: <hash>
Current branch: <branch>. No merge / push / PR performed (per design).
The archive commit message is PR-ready — paste it into the PR body when you open one.
```
