# Phase 3 — Plan

> **Todo:** mark `Phase 3 · Plan tasks` `in_progress` (see `flows/todo-tracking.md`).

Invoke `superpowers:writing-plans` via the Skill tool.

## ORCHESTRATOR OVERRIDES — include verbatim in the Skill `args`

Prepend the following block to the Skill `args` (above any other instructions). These take precedence over writing-plans' defaults.

```
ORCHESTRATOR OVERRIDES (super-spec skill, Phase 3):

You are invoked from the super-spec workflow, which owns all artifact paths and
git commits. Apply these overrides:

1. Plan target path: write the plan DIRECTLY to `openspec/changes/<name>/tasks.md`.
   Do NOT write to `docs/superpowers/plans/` or any auxiliary file there. The
   default header line about `docs/superpowers/plans/<filename>.md` does not apply.

2. Do NOT emit the writing-plans "Plan Document Header" block that names a
   REQUIRED SUB-SKILL (the line telling readers to "Use
   superpowers:subagent-driven-development / executing-plans to implement this
   plan"). super-spec runs its OWN per-Task dispatch + review loop in Phase 4;
   that header would point readers at the wrong execution path. You MAY keep the
   header's "Global Constraints" block (project-wide rules copied verbatim from
   design.md) — it is useful context for the per-Task implementer / reviewer
   dispatches.

3. Keep each Task's "Interfaces" block (Consumes / Produces) when the
   writing-plans version emits one. super-spec dispatches each Task to a fresh
   implementer that sees ONLY its own Task body, so the neighbouring contracts
   in that block are exactly the context it needs — do not drop it during the
   granularity merges below.

4. Do NOT run `git add` / `git commit` / any state-mutating git command. The
   orchestrator owns all commits.

5. After self-review, signal completion to the orchestrator by outputting
   exactly this one line as the FINAL line of your Skill output —
   `tasks.md written — returning control to super-spec orchestrator`
   This line is a phase-boundary marker for the orchestrator, NOT an
   instruction to end the assistant turn. Do not perform any further actions
   inside this Skill invocation (no questions, no choices, no sub-skill
   invocation, no mention of "Subagent-Driven" or "Inline Execution"). The
   "Execution Handoff" section in writing-plans is suppressed — treat it as
   if it does not exist. Control returns to the orchestrator, which will
   immediately continue with the next section in the same turn.

6. Task granularity is governed by the dispatch-cost model below; it OVERRIDES
   writing-plans' granularity guidance — both its "Bite-Sized Task Granularity"
   default and its "Task Right-Sizing" section (the latter pushes the same
   direction as the cost model — fewer, larger tasks — but the cost model is the
   authority here). Read it before drafting tasks.md.

All other plan-writing behavior (file structure, no placeholders, self-review)
runs as normal.
```

## Task granularity — dispatch-cost model (REQUIRED reading before drafting tasks)

A Task = **one implementer dispatch + one reviewer dispatch + one commit**. Each carries ~15–25K tokens of cold-start overhead (preamble + role prompt + design.md + files re-read by a fresh subagent). The Task's substantive work must justify that overhead, or you are paying dispatch cost for trivial changes.

**Merge Tasks when any of these hold:**
- Pure scaffolding (resources, manifest entries, dependency declarations, theme/styles/dimens/strings) — bundle as one "setup" Task.
- Files that cannot independently compile or be verified without each other (e.g., ViewBinding consumers + their layouts + the Activity wiring them) — splitting yields "build fails until next Task" pseudo-checkpoints with no reviewable signal.
- Single-file additions under ~50 lines that only support another Task — inline into the consuming Task.
- Sequential edits to the same file/concern with no independent testability between them.

**Keep Tasks separate when:**
- They cross independent layers/modules and each layer reviews on its own.
- One contains a genuine architectural decision worth a focused review pass.
- One is a smoke/integration test that meaningfully gates the rest.

**Target:** 3–6 Tasks for a feature change; **> 8 Tasks is a smell** — re-examine whether adjacent Tasks are really independent dispatch units.

**Verification placement:** full `assembleRelease` / test-suite runs go in the Task's **final sub-step only** (remote builds take minutes; intermediate states often can't compile). Per-sub-step verifications stay only for cheap local checks (`Select-String`, file count, single targeted unit test).

**Merge example:**
- Over-fragmented: `add dependency` / `copy resources` / `add strings+dimens` / `add theme` / `register in manifest` / `add base class` / `port file A` / `port file B` / `port layout A` / `port layout B` / `wire entry point` / `add smoke test` / `final verify`
- Consolidated: setup Task (deps + resources + theme + manifest) → shared-infra Task (only if non-trivial) → feature Task (all interdependent code + layouts + entry point) → verify Task (smoke test + final build).

## Per-mode sub-step structure (append to the Skill `args` after the override block)

- Read the design from `openspec/changes/<name>/design.md`
- Read the mode from `openspec/changes/<name>/proposal.md`'s `## Mode` section
- For **TDD** mode: each Task includes explicit "write failing test → run to confirm fail → implement minimal code → run to confirm pass → commit" sub-steps
- For **Simple** mode: omit test-writing sub-steps; include "verify existing tests still pass" as a final sub-step **of the Task** (not after every sub-step)

Sub-steps within a Task are 2–5 minute atomic actions with `- [ ]` checkboxes. A Task itself should be sized so that the substantive work clears the dispatch-overhead break-even — typically 30min – 2hr of equivalent implementer work, not 5min.

## Pre-commit absorb — neutralize superpowers plan residue

After `writing-plans` returns and before staging `tasks.md`, clean any residue. Each step is a no-op if its trigger is absent. **All git commands in this section must be delegated to a haiku Agent subagent** — describe the full conditional logic in the subagent prompt and have it report the result.

**A. Rogue commit at HEAD.** Check `git show --name-only --format= HEAD`. If every path lies under `docs/superpowers/plans/`:

```
PARENT=$(git rev-parse HEAD~1)
git reset --soft "$PARENT"
git reset HEAD -- docs/superpowers/plans/
rm -rf docs/superpowers/plans/
```

If the rogue commit also touched files outside `docs/superpowers/plans/`, do NOT absorb — halt and report.

**B. Staged residue.** If `git diff --cached --name-only docs/superpowers/plans/` is non-empty: `git reset HEAD -- docs/superpowers/plans/ && rm -rf docs/superpowers/plans/`.

**C. Untracked residue.** If `docs/superpowers/plans/` is non-empty: `rm -rf docs/superpowers/plans/`.

**D. Empty parent cleanup.** `rmdir docs/superpowers 2>/dev/null`.

After A–D, neither `git status --porcelain docs/superpowers/` nor `git log -1 --format=%s` may reference `docs/superpowers/plans/`. Otherwise halt and report.

## Commit

Delegate to a haiku Agent subagent. Stage and commit:

- `openspec/changes/<name>/proposal.md`
- `openspec/changes/<name>/design.md`
- `openspec/changes/<name>/specs/` (all spec-delta files)
- `openspec/changes/<name>/tasks.md`

Message: `openspec(<name>): planning`

This is the only commit from Phases 2–3 combined. If `proposal.md` or `design.md` were already committed in a prior session, only `tasks.md` stages — fine; the prior commit stays.

→ **Todo:** mark `Phase 3 · Plan tasks` `completed`. Continue to Phase 4 (which rewrites the list into per-Task items — see `flows/todo-tracking.md`).
