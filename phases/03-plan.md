# Phase 3 — Plan

Invoke `superpowers:writing-plans` via the Skill tool.

## ORCHESTRATOR OVERRIDES — include verbatim in the Skill `args`

Prepend the following block to the Skill `args` (above any other instructions). These overrides take precedence over the writing-plans SKILL.md defaults — the writing-plans skill itself documents that user/orchestrator preferences for plan location override its defaults.

```
ORCHESTRATOR OVERRIDES (super-spec skill, Phase 3):

You are being invoked from the super-spec workflow, which owns all artifact paths
and git commits. Apply these overrides to your default behavior:

1. Plan target path: write the plan DIRECTLY to
   `openspec/changes/<name>/tasks.md`
   Do NOT write to docs/superpowers/plans/. Do NOT write any auxiliary file in that
   directory. The header line about `docs/superpowers/plans/<filename>.md` does not
   apply here.

2. Do NOT run `git add`, `git commit`, or any other git command that mutates state.
   The orchestrator owns all commits.

3. SKIP the "Execution Handoff" section at the end. Do NOT offer
   subagent-driven-development or executing-plans choices. Do NOT invoke any
   sub-skill. Return control to the super-spec orchestrator after writing tasks.md.

All other plan-writing behavior (file structure, bite-sized tasks, no placeholders,
self-review) runs as normal.
```

## Per-mode task structure (append to the Skill `args` after the override block)

- Read the design from `openspec/changes/<name>/design.md`
- Read the mode from `openspec/changes/<name>/proposal.md`'s `## Mode` section
- For **TDD** mode: each Task includes explicit "write failing test → run to confirm fail → implement minimal code → run to confirm pass → commit" sub-steps
- For **Simple** mode: omit test-writing sub-steps; include "verify existing tests still pass" as a final sub-step in each Task

Each Task is a unit of subagent work (~15min – 2hr). Sub-steps within a Task are 2–5 minute atomic actions with `- [ ]` checkboxes.

## Pre-commit absorb — neutralize any superpowers plan residue

After `writing-plans` returns and before staging `tasks.md`, deal with any residue. Each step is a no-op if its trigger is absent.

### A. Rogue commit at HEAD

```
git log -1 --format="%H %s"
git show --name-only --format= HEAD
```

If HEAD's diff touches **only** paths under `docs/superpowers/plans/` (no other paths), it is a rogue writing-plans commit. Absorb it:

```
PARENT=$(git rev-parse HEAD~1)
git reset --soft "$PARENT"
git reset HEAD -- docs/superpowers/plans/
rm -rf docs/superpowers/plans/
```

If the rogue commit also touched files **outside** `docs/superpowers/plans/`, do NOT absorb — halt and report.

### B. Staged but uncommitted residue

```
git diff --cached --name-only docs/superpowers/plans/
```

If non-empty:

```
git reset HEAD -- docs/superpowers/plans/
rm -rf docs/superpowers/plans/
```

### C. Untracked file in working tree

```
ls docs/superpowers/plans/ 2>/dev/null
```

If non-empty:

```
rm -rf docs/superpowers/plans/
```

### D. Empty parent directory cleanup

```
rmdir docs/superpowers 2>/dev/null  # only succeeds if empty
```

After A–D, `git status --porcelain docs/superpowers/` and `git log -1 --format=%s` together must not reference `docs/superpowers/plans/`. If they still do, halt and report.

## Commit

Stage `openspec/changes/<name>/tasks.md`. Commit message:
```
openspec(<name>): plan
```

→ Continue to Phase 4.
