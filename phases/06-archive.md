# Phase 6 — Archive

Only enter when the user gives an explicit "archive" instruction after `APPROVED`.

## 1. Compose the archive commit message

Build the PR-ready summary that the archive commit will carry. Do this before running `openspec archive`.

### 1a. Gather inputs

- From `proposal.md`: extract `## What`, `## Why`, `## Mode`.
- Baseline = parent of the `openspec(<name>): propose` commit:
  ```
  BASELINE=$(git rev-parse "$(git log --grep='openspec(<name>): propose' --format='%H' -n 1)~1")
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

This moves `openspec/changes/<name>/` into `openspec/changes/archive/` and may update `openspec/specs/`. The uncommitted `review.md` from Phase 5 gets moved along and is absorbed by step 3's `git add openspec/`.

## 3. Dispatch the archive-committer subagent

Use the **Agent** tool. Read `prompts/archive-committer.md` and substitute:
- `{CHANGE_NAME}`: `<name>`
- `{COMMIT_MESSAGE}`: the multi-line message from step 1b (pass verbatim, preserve newlines)

**Model:** `haiku`

**Forbidden:** any phase conversation; reviewer reports. (`proposal.md` is allowed — already distilled into `{COMMIT_MESSAGE}`.)

The subagent stages the archive file moves with `git add openspec/` and commits using `{COMMIT_MESSAGE}` verbatim.

## 4. STOP

Do not merge. Do not push. Do not open a PR.

Output to user:
```
Archive complete for <name>.
Commit: <hash>
Current branch: <branch>. No merge / push / PR performed (per design).
The archive commit message is PR-ready — paste it into the PR body when you open one.
```
