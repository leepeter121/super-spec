# Phase 2 — Propose

## HARD-GATE B — Mode Selection

Use AskUserQuestion to ask:
> "Choose mode for this change:
>  - **TDD**: write failing test first, then code (full discipline)
>  - **Simple**: skip new tests, but existing tests must still pass"

Record the answer.

## Derive change name

From the brainstorming conversation, propose a kebab-case name (e.g., "add user auth" → `add-user-auth`). Ask the user to confirm or suggest a different name.

## Pre-commit absorb — neutralize superpowers spec residue

Before creating the change directory, clean up artifacts brainstorming may have produced despite Phase 1 overrides. Each step is a no-op if its trigger is absent.

**A. Rogue commit at HEAD.** Check `git show --name-only --format= HEAD`. If every path lies under `docs/superpowers/specs/`:

```
PARENT=$(git rev-parse HEAD~1)
git reset --soft "$PARENT"
git reset HEAD -- docs/superpowers/specs/
rm -rf docs/superpowers/specs/
```

If the rogue commit also touched files **outside** `docs/superpowers/specs/`, do NOT absorb — halt and report (warrants human judgement).

**B. Staged residue.** If `git diff --cached --name-only docs/superpowers/specs/` is non-empty: `git reset HEAD -- docs/superpowers/specs/ && rm -rf docs/superpowers/specs/`.

**C. Untracked residue.** If `ls docs/superpowers/specs/ 2>/dev/null` is non-empty: `rm -rf docs/superpowers/specs/`.

**D. Empty parent cleanup.** `rmdir docs/superpowers 2>/dev/null` (errors if non-empty — fine).

After A–D, neither `git status --porcelain docs/superpowers/` nor `git log -1 --format=%s` may reference `docs/superpowers/specs/`. Otherwise halt and report.

## Create the change directory

Run: `openspec new change <name>`

## Write `proposal.md`

Path: `openspec/changes/<name>/proposal.md`

Structure: see `templates/proposal.md`. Fill in `## What` and `## Why` from the brainstorming conversation; set `## Mode` to the choice from HARD-GATE B.

## Write `design.md`

Path: `openspec/changes/<name>/design.md`

Structure: see `templates/design.md`. Fill in from the design content delivered in the brainstorming skill's final message (no spec file exists — the design lives in the conversation).

→ Continue to Phase 3. (No commit here — Phase 3 commits proposal, design, and tasks together as one planning commit.)
