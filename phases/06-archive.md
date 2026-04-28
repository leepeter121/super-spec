# Phase 6 — Archive

Only enter when the user gives an explicit "archive" instruction after `APPROVED`.

## 1. Compose the archive commit message

Before running `openspec archive`, build the summary message that the archive commit will carry. This message is the PR-ready record of the whole change.

### 1a. Gather inputs

- Read `openspec/changes/<name>/proposal.md` — extract `## What` and `## Why` content, plus `## Mode`.
- Determine baseline (commit immediately before `openspec(<name>): propose`):
  ```
  PROPOSE_HASH=$(git log --oneline --grep="openspec(<name>): propose" --format="%H" -n 1)
  BASELINE=$(git rev-parse "${PROPOSE_HASH}~1")
  ```
- List implementation commits between baseline and HEAD, filtered to substantive work:
  ```
  git log "$BASELINE"..HEAD --format="%h %s" --no-merges
  ```
  Exclude commits matching `openspec(<name>):` (those are workflow scaffolding, not implementation). Keep `feat(...)`, `fix(...)`, `refactor(...)`, etc.
- Count implementation commits and total tasks (from `tasks.md` final state).
- Read `openspec/changes/<name>/review.md` to confirm verdict (should be `APPROVED`).

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

Mode: <TDD|Simple> · Tasks: <N> · Commits: <M> · Review: APPROVED
```

Bullet rules:
- 3 bullets ideal, max 4. Each bullet ≤ 80 chars.
- Group implementation commits by component/file area, not 1:1 mapping. The reader wants "what shipped", not the commit graph.
- Lead each bullet with a verb ("add", "wire", "refactor", "fix").

If the assembled message exceeds 15 lines, tighten the What/Why/bullets — do NOT drop the trailing `Mode: ...` line.

Store the final message as `{COMMIT_MESSAGE}` for the next step.

## 2. Run the archive command

```
openspec archive <name>
```

This moves `openspec/changes/<name>/` into `openspec/changes/archive/` and may update `openspec/specs/`.

## 3. Dispatch the archive-committer subagent

Use the **Agent** tool. Read `prompts/archive-committer.md` and substitute:
- `{CHANGE_NAME}`: `<name>`
- `{COMMIT_MESSAGE}`: the multi-line message from step 1b (pass verbatim, preserve newlines)

**Model:** `claude-haiku-4-5-20251001`

**Forbidden:** any phase conversation; reviewer reports. (`proposal.md` content is now allowed because it has been distilled into `{COMMIT_MESSAGE}` and the subagent only treats it as opaque text.)

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
