# Phase 2 — Propose

> **Todo:** mark `Phase 2 · Write proposal & spec deltas` `in_progress` (see `flows/todo-tracking.md`). It stays `in_progress` through HARD-GATE B — mode selection is a user gate.

## HARD-GATE B — Mode Selection

Use AskUserQuestion to ask:
> "Choose mode for this change:
>  - **TDD (Sonnet)**: write failing test first, then code (full discipline); implementer runs on Sonnet — the default, cheaper option
>  - **TDD (Opus)**: same TDD discipline, but the implementer runs on Opus — use for harder changes where stronger implementation reasoning is worth the cost
>  - **Simple**: skip new tests, but existing tests must still pass"

Record the answer. The TDD/Simple part is the **discipline**; the parenthetical is the **implementer model**. Both `TDD (Sonnet)` and `TDD (Opus)` carry identical TDD discipline — they differ only in which model implements each Task in Phase 4.

## HARD-GATE B2 — Engine Selection

Immediately after the mode answer, settle the **execution engine** (orthogonal to mode — mode is discipline × implementer model; engine is *how Phase 4 dispatches*).

**Determine the default:**
- Invocation had `--ultra`, OR the user explicitly asked for ultracode/Workflow during Phase 1 (see `phases/01-brainstorm.md`) → default = `ultracode`.
- Otherwise → default = `native`.
- **Override:** if pre-flight's check 4 announced the Workflow tool unavailable, the default is `native` regardless of the above (this precedence resolves the two rules; the gate still offers `ultracode` — the choice persists in `proposal.md` and simply falls back to native at Phase 4 entry in sessions where the tool is missing).

**Derive the agent-model table automatically** — it follows super-spec's existing assignment logic and is NOT a user choice (the engine splits the work across agents; models stay governed by Mode):
- `implementer`: from the Mode parenthetical — `TDD (Sonnet)` → `sonnet`, `TDD (Opus)` → `opus`, `Simple` → `inherit`
- `implementer (3rd dispatch after 2 consecutive FAILs)`: `opus` (fixed escalation rule)
- `task-reviewer`: `sonnet` (fixed)
- `git-ops (checkbox fold-in / amend)`: `haiku` (fixed)
- Phase-5 panel roles (used only when the panel threshold in `flows/ultracode-review.md` is met): `final-lens ×3` = `sonnet`, `final-reviewer (holistic lens / sole reviewer)` = `opus`, `final-skeptic` = `sonnet`, `final-judge` = `sonnet` (all fixed)

**Ask** (use AskUserQuestion; put the default first):
> "Choose execution engine for Phase 4:
>  - **native**: orchestrator dispatches each Task's implementer/reviewer one by one (current behavior, the default)
>  - **ultracode**: the Task loop runs as a deterministic Workflow script that splits the work — one fresh implementer + reviewer agent per Task from tasks.md; severity routing, FAIL counting, and model escalation become code paths; supports journal-based resume. Dispatch count (and cost) is roughly the same as native. Agent models (auto-derived from Mode): <show the derived table>"

Even when the default is `ultracode` (pre-answered via `--ultra` or Phase 1), still show the derived model table in the question — cost/model transparency is not skippable. Do NOT silently enable ultracode from session state alone.

Record the engine answer; the derived table is written into `proposal.md` below.

## Derive change name

If the user already supplied an explicit `<name>` in the `/super-spec <name>` invocation, use it verbatim — do not re-derive or re-confirm. Otherwise, propose a kebab-case name from the brainstorming conversation (e.g., "add user auth" → `add-user-auth`) and ask the user to confirm or suggest a different name.

## Pre-commit absorb — neutralize superpowers spec residue

Before creating the change directory, clean up artifacts brainstorming may have produced despite Phase 1 overrides. Each step is a no-op if its trigger is absent. **All git commands in this section must be delegated to a haiku Agent subagent** (same rule as Phase 3's absorb) — describe the full conditional logic in the subagent prompt and have it report the result.

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

Structure: see `templates/proposal.md`. Fill in `## What` and `## Why` from the brainstorming conversation; set `## Mode` to the choice from HARD-GATE B; set `## Engine` to the choice from HARD-GATE B2. When Engine is `ultracode`, also write the `## Ultracode Agent Models` table (as confirmed/overridden at the gate); when `native`, omit that table entirely.

## Write `design.md`

Path: `openspec/changes/<name>/design.md`

Structure: see `templates/design.md`. Fill in from the design content delivered in the brainstorming skill's final message (no spec file exists — the design lives in the conversation).

## Write spec deltas

Path: `openspec/changes/<name>/specs/<capability>/spec.md` — one file per affected capability.

Structure: see `templates/spec-delta.md`. Derive the requirements and scenarios from the approved design: every behavior the change adds, modifies, or removes gets a `### Requirement:` with at least one `#### Scenario:`. These deltas are the change's acceptance criteria (the final-reviewer walks them) and are what `openspec archive` later merges into `openspec/specs/` — without them the archive updates nothing.

After writing, run `openspec validate <name> --strict`. If validation fails, fix the deltas before continuing. (If the installed CLI version lacks this subcommand, note that and continue.)

→ **Todo:** mark `Phase 2 · Write proposal & spec deltas` `completed`. Continue to Phase 3. (No commit here — Phase 3 commits proposal, design, spec deltas, and tasks together as one planning commit.)
