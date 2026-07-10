# Phase 6 — Archive

> **Todo:** mark `Phase 6 · Archive` `in_progress` (see `flows/todo-tracking.md`); mark it `completed` at the STOP step.

Only enter when the user gives an explicit "archive" instruction after `APPROVED`.

## 1. Compose the archive commit message

Build the PR-ready summary that the archive commit will carry. Do this before running `openspec archive`.

### 1a. Gather inputs

Step 4 squashes **all** implementation commits into this one commit, so the message must describe **what was actually delivered** — the delivered commits are the PRIMARY source, not the plan.

- Baseline = parent of the `openspec(<name>): planning` commit:
  ```
  BASELINE=$(git rev-parse "$(git log --grep='openspec(<name>): planning' --format='%H' -n 1)~1")
  ```
- **Implementation commits (PRIMARY source — read subject AND body, not just subject):**
  ```
  git log "$BASELINE"..HEAD --format='%h %s%n%b%n---' --no-merges
  ```
  Exclude `openspec(<name>):` scaffolding (planning / final-review commits); keep `feat`/`fix`/`refactor`/`perf`/etc. These commit messages are what you condense the title and Key changes from.
- From `proposal.md`: extract `## Why` and `## Mode` only. `## Why` seeds the `Why:` line; `## Mode` seeds the footer. **Do NOT source `What`/title from `proposal.md`** — the plan may have drifted from what shipped; describe the delivery.
- Count implementation commits (`M`) and tasks (from final `tasks.md`, `N`).
- Confirm `review.md` verdict = `APPROVED`.

### 1b. Build the message (HARD CAP: 16 lines total, including blanks)

#### Title — derive from the delivered commits, do NOT hardcode

The squashed commit **is the feature delivery** (all the `feat`/`fix`/`refactor` code, not just the openspec file moves), so its title must read like the feature — not like a `chore`. Compose `<type>(<scope>): <subject>` from the implementation commits gathered in 1a:

- **type**: the single Conventional Commit type that best represents the whole delivery. Priority: any new user-facing capability → `feat`; else predominantly bug fixes → `fix`; else restructuring → `refactor`; else the dominant type (`perf`/etc.).
- **scope**: the module/area touched by most of the diff (e.g. `classswift`, `annotation`, `app`). Omit the scope if the work genuinely spans many modules with no dominant one.
- **subject**: a Traditional Chinese phrase (≤ ~60 chars) distilling *what shipped*, condensed from the implementation commit subjects — not copied from one commit, and not from `proposal.md`.

**Fallback (docs/spec-only changes):** if 1a found **no** substantive implementation commits (only `openspec`/`docs` scaffolding, so step 4 will skip the squash), the commit really is just an archive — title it `chore(openspec): archive <name>` and skip the `Key changes` block.

#### Structure

```
<type>(<scope>): <subject distilled from delivered commits>

<one or two sentences condensed from the actual implementation commits — what shipped>

Why: <one sentence (may draw from proposal ## Why)>

Key changes:
- <bullet condensed from the delivered commits, area 1>
- <bullet condensed from the delivered commits, area 2>
- <bullet condensed from the delivered commits, area 3>

Archive: openspec/changes/<name>
Mode: <TDD (Sonnet)|TDD (Opus)|Simple> · Tasks: <N> · Commits: <M> · Review: APPROVED
```

Body rules: condense from the commit subjects+bodies read in 1a (group by area, **not** 1:1 to commits). Bullets: 3 ideal (max 4), ≤ 80 chars each, lead with a verb. Note any intentionally-skipped tasks in one extra line if relevant. If the message exceeds the 16-line cap, tighten the What/Why/bullets — never drop the `Archive:` or `Mode: ...` lines.

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

**Forbidden:** any phase conversation; reviewer reports; `proposal.md`. Everything the subagent needs is already condensed into `{COMMIT_MESSAGE}` — it must not re-derive or edit the message.

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
