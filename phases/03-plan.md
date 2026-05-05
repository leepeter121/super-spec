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

4. Task granularity is governed by the dispatch-cost model below — it OVERRIDES
   the writing-plans skill's "bite-sized tasks" default. Read it before drafting
   tasks.md.

All other plan-writing behavior (file structure, no placeholders, self-review)
runs as normal.
```

## Task granularity — dispatch-cost model (REQUIRED reading before drafting tasks)

A Task is **not** a human-onboarding chunk; it is **one full subagent dispatch + one reviewer dispatch + one git commit**. Each Task therefore carries a fixed overhead of ~15–25K tokens of cold-start context (preamble + role prompt + design.md + relevant files re-read by a fresh subagent). To justify that cost, a Task must contain enough substantive, reviewable work — otherwise you are paying dispatch overhead for trivial changes.

**Merge Tasks that share any of these properties:**
- Pure scaffolding (resources, manifest entries, dependency declarations, theme styles, dimen/string additions) — bundle into a single "setup" Task regardless of how many files they touch.
- Files that cannot independently compile or be verified without each other (e.g. ViewBinding consumers + their layout XMLs + the Activity that wires them together — splitting them only creates "build will fail until next Task" pseudo-checkpoints, which produce no reviewable signal).
- Single-file additions under ~50 lines that exist solely to support another Task — inline them into the consuming Task instead of giving them their own dispatch.
- Sequential edits to the same file or same logical concern with no independent testability between them.

**Keep Tasks separate when:**
- They cross independent layers/modules and each layer can be reviewed on its own.
- One contains genuine architectural decisions that warrant a focused review pass.
- One is a smoke/integration test that meaningfully gates the rest.

**Default target:** 3–6 Tasks for a feature change. **More than 8 Tasks is a smell** — re-examine whether adjacent Tasks are really independent dispatch units or just "steps a human might list."

**Verification placement:** within a Task, full `assembleRelease` / full test-suite runs go in the **final sub-step only**. Per-sub-step build verifications are wasteful (each remote build is minutes; intermediate states often can't compile anyway). Keep per-sub-step verifications only for cheap local checks (`Select-String`, file count, single targeted unit-test class).

**Generic merge pattern:**
- Over-fragmented draft: `add dependency` / `copy resource files` / `add string+dimen entries` / `add theme style` / `register in manifest` / `add base class` / `port file A` / `port file B` / `port layout A` / `port layout B` / `wire entry point` / `add smoke test` / `final build verify`
- Consolidated: 1 setup Task (deps + resources + theme + manifest) → 1 shared-infra Task (base class only if non-trivial; otherwise inline) → 1 feature Task (all interdependent code + layouts + entry point that must compile together) → 1 verify Task (smoke test + final build + manual checklist)

## Per-mode sub-step structure (append to the Skill `args` after the override block)

- Read the design from `openspec/changes/<name>/design.md`
- Read the mode from `openspec/changes/<name>/proposal.md`'s `## Mode` section
- For **TDD** mode: each Task includes explicit "write failing test → run to confirm fail → implement minimal code → run to confirm pass → commit" sub-steps
- For **Simple** mode: omit test-writing sub-steps; include "verify existing tests still pass" as a final sub-step **of the Task** (not after every sub-step)

Sub-steps within a Task are 2–5 minute atomic actions with `- [ ]` checkboxes. A Task itself should be sized so that the substantive work clears the dispatch-overhead break-even — typically 30min – 2hr of equivalent implementer work, not 5min.

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

Stage `openspec/changes/<name>/proposal.md`, `openspec/changes/<name>/design.md`, and `openspec/changes/<name>/tasks.md` together as a single integrated planning commit. Commit message:
```
openspec(<name>): planning
```

This is the only commit produced by Phases 2–3 combined. If `proposal.md` or `design.md` were already committed in a prior session (e.g., resuming Phase 3 after a previous run committed Phase 2 separately under the old workflow), only `tasks.md` will be staged — that is fine; the prior commit stays in history.

→ Continue to Phase 4.
