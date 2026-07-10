# <Change Name>

## What
<2-4 sentences summarizing what this change does, derived from the brainstorming conversation>

## Why
<2-4 sentences summarizing the motivation, derived from the brainstorming conversation>

## Mode: <TDD (Sonnet) | TDD (Opus) | Simple>
<one-line note: e.g., "TDD (Sonnet): every Task starts with a failing test, implementer runs on Sonnet." / "TDD (Opus): every Task starts with a failing test, implementer runs on Opus." / "Simple: no new tests; existing tests must still pass.">
<!-- The parenthetical picks the implementer model; the TDD/Simple part is the discipline passed to the implementer prompt. -->

## Engine: <native | ultracode>
<one-line note: "native: orchestrator per-Task Agent dispatch (the default)." / "ultracode: Phase 4 Task loop runs as a Workflow script (workflows/apply.js); agent models below.">

<!-- Include the section below ONLY when Engine is ultracode. Model values use
     Agent-tool aliases and are AUTO-DERIVED from the Mode line + the fixed
     assignments in phases/02-propose.md (HARD-GATE B2) — super-spec's existing
     model logic; not a user choice. This table is the single source of truth
     the orchestrator reads into the Workflow args — scripts hardcode nothing. -->
## Ultracode Agent Models
| agent | model | source |
|---|---|---|
| implementer | <sonnet \| opus \| inherit> | Mode line parenthetical (Simple → inherit) |
| implementer — 3rd dispatch after 2 consecutive FAILs | opus | fixed escalation rule (04-apply.md) |
| task-reviewer | sonnet | fixed |
| git-ops (checkbox fold-in / amend) | haiku | fixed |
