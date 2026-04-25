# Phase 2 — Propose

## HARD-GATE B — Mode Selection

Use AskUserQuestion to ask:
> "Choose mode for this change:
>  - **TDD**: write failing test first, then code (full discipline)
>  - **Simple**: skip new tests, but existing tests must still pass"

Record the answer.

## Derive change name

From the brainstorming conversation, propose a kebab-case name (e.g., "add user auth" → `add-user-auth`). Ask the user to confirm or suggest a different name.

## Pre-commit absorb — neutralize any superpowers spec residue

Before creating the change directory, deal with any artifacts the brainstorming skill may have produced despite the Phase 1 overrides. Run these checks in order; each step is a no-op if its trigger is absent.

### A. Rogue commit at HEAD

```
git log -1 --format="%H %s"
git show --name-only --format= HEAD
```

If HEAD's diff touches **only** paths under `docs/superpowers/specs/` (no other paths), it is a rogue brainstorming commit. Absorb it:

```
ROGUE_HASH=$(git rev-parse HEAD)
PARENT=$(git rev-parse HEAD~1)
git reset --soft "$PARENT"
# Files from the rogue commit are now staged. Unstage and remove the spec file(s):
git reset HEAD -- docs/superpowers/specs/
rm -rf docs/superpowers/specs/
```

If the rogue commit also touched files **outside** `docs/superpowers/specs/`, do NOT absorb — halt and report to the user (this is unexpected and warrants human judgement).

### B. Staged but uncommitted residue

```
git diff --cached --name-only docs/superpowers/specs/
```

If non-empty:

```
git reset HEAD -- docs/superpowers/specs/
rm -rf docs/superpowers/specs/
```

### C. Untracked file in working tree

```
ls docs/superpowers/specs/ 2>/dev/null
```

If non-empty:

```
rm -rf docs/superpowers/specs/
```

### D. Empty parent directory cleanup

```
rmdir docs/superpowers 2>/dev/null  # only succeeds if empty — fine if it errors
```

After A–D, `git status --porcelain docs/superpowers/` and `git log -1 --format=%s` together must not reference `docs/superpowers/specs/`. If they still do, halt and report.

## Create the change directory

Run: `openspec new change <name>`

## Write `proposal.md`

Path: `openspec/changes/<name>/proposal.md`

Structure: see `templates/proposal.md`. Fill in `## What` and `## Why` from the brainstorming conversation; set `## Mode` to the choice from HARD-GATE B.

## Write `design.md`

Path: `openspec/changes/<name>/design.md`

Structure: see `templates/design.md`. Fill in from the design content delivered in the brainstorming skill's final message (no spec file exists — the design lives in the conversation).

## Commit

Stage `openspec/changes/<name>/proposal.md` and `openspec/changes/<name>/design.md`. Commit message:
```
openspec(<name>): propose
```

→ Continue to Phase 3.
