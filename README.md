# super-spec

Single-entry slash command that orchestrates a non-trivial change end-to-end through:

```
brainstorm → propose → plan → apply (per-task subagent + review) → final review → archive
```

All artifacts live in `openspec/changes/<name>/`. Defaults: TDD mode is offered, no merge / push / PR.

## Trigger

```
/super-spec [--ultra] [<name | short description>]
```

- No argument → asks what you want to build
- New `<name>` → starts at brainstorm
- Existing `<name>` → resumes from current state
- `--ultra` → pre-answers the Phase-2 engine gate with `ultracode` (see "Execution engines" below)

## Dependencies

Required on every machine that runs this skill:

| Dependency | Install |
|---|---|
| `openspec` CLI | `npm i -g @openspec/cli` (see https://openspec.dev) |
| `superpowers` plugin | Claude Code plugin manager — provides `superpowers:brainstorming`, `superpowers:writing-plans`, etc. |
| `code-review` skill | Built-in to Claude Code — no install needed |

The skill checks `openspec --version` at startup and halts with install instructions if missing. Plugin presence is **not** pre-checked; a missing plugin surfaces as a clear error when its skill is first invoked.

## Project requirements

The current project must have `openspec/` initialized. If not, the skill will offer to run `openspec init`.

The skill works on whatever git branch is currently checked out — it does **not** create a new branch. All commits go on the current branch.

The skill refuses to start if there are tracked-file changes (modified or staged). Untracked files are allowed and do not block startup.

## Layout

```
super-spec/
├── SKILL.md                      # entry point — an INDEX ONLY; logic lives in the sibling files below
├── phases/
│   ├── 01-brainstorm.md
│   ├── 02-propose.md
│   ├── 03-plan.md
│   ├── 04-apply.md
│   ├── 05-final-review.md
│   └── 06-archive.md
├── flows/                        # non-linear paths
│   ├── pre-flight.md
│   ├── resume-detection.md
│   ├── recover.md                # NEEDS DESIGN UPDATE loop
│   ├── ultracode-apply.md        # Phase 4 via Workflow engine (orchestrator side)
│   ├── ultracode-review.md       # Phase 5 multi-lens panel (orchestrator side)
│   └── abort.md
├── workflows/
│   ├── apply.js                  # static Workflow script for the ultracode Phase-4 Task loop
│   └── final-review.js           # static Workflow script for the Phase-5 panel
├── prompts/                      # subagent prompt templates
│   ├── _isolation-preamble.md    # shared by every prompt below
│   ├── implementer.md
│   ├── task-reviewer.md          # single per-task reviewer: spec compliance + code quality
│   ├── final-reviewer.md         # sole reviewer (native / below threshold); holistic lens (panel)
│   ├── final-lens-spec.md        # panel lens: spec-scenario walking
│   ├── final-lens-lifecycle.md   # panel lens: resource/lifecycle/threading
│   ├── final-lens-coherence.md   # panel lens: cross-task DRY / interface / gaps
│   ├── final-skeptic.md          # panel: adversarial verify of one gating issue
│   ├── final-judge.md            # panel: compose-only (verdict is read-only input)
│   └── archive-committer.md
├── templates/                    # artifact structures
│   ├── proposal.md
│   ├── design.md
│   ├── spec-delta.md             # openspec requirement deltas (merged into living spec at archive)
│   ├── review.md
│   └── revision-block.md
└── README.md                     # this file
```

`SKILL.md` is an index: each phase/flow/template file is Read at the moment it is entered, never paraphrased from memory.

## Subagent model assignment

Model parameters use Agent-tool **aliases** (`sonnet` / `opus` / `haiku`), not pinned model IDs — aliases track the latest version automatically.

| Subagent | Model |
|---|---|
| implementer (TDD (Sonnet) mode) | `sonnet` |
| implementer (TDD (Opus) mode) | `opus` |
| implementer (Simple mode) | inherit (parent's model) |
| implementer (3rd dispatch after 2 consecutive FAILs) | escalated to `opus` regardless of mode |
| task-reviewer | `sonnet` |
| final-reviewer | `opus` |
| archive-committer | `haiku` |

With the **ultracode** engine, the same assignments apply: the table above is auto-derived at HARD-GATE B2, persisted as `## Ultracode Agent Models` in `proposal.md`, and read into the Workflow args — `workflows/apply.js` hardcodes no model names.

## Execution engines (Phase 4)

Chosen per change at Phase 2's **HARD-GATE B2**, persisted as `## Engine` in `proposal.md` (resume never re-asks and never depends on session state):

| Engine | How Phase 4 runs |
|---|---|
| `native` (default) | The orchestrator dispatches each Task's implementer/reviewer one by one — current behavior. |
| `ultracode` | The Task loop runs as one deterministic Workflow script (`workflows/apply.js`): the script splits the work — one fresh implementer + reviewer agent per Task from `tasks.md` — and severity routing / FAIL counting / model escalation are code paths. Structured (schema) outputs replace the `Done:`/`PASS`/`FAIL` string contracts; journal-based resume within a session. User gates (Blocked, 3-FAIL cap) surface as workflow pauses routed back to the orchestrator. **Phase 5**: above a size threshold (≥ 4 Tasks or ≥ 800 diff lines), the final review upgrades to a multi-lens panel (`workflows/final-review.js`): 3 sonnet lenses + the opus holistic reviewer in parallel → 2 skeptics vote on every Critical/Important candidate (downgraded items stay in Notes with their original severity) → the VERDICT is computed by the script, a compose-only judge writes the prose. Below threshold, Phase 5 stays single-reviewer. Read-only — a dead panel run is simply re-run. |

Ways to enable ultracode: the `--ultra` flag, answering the gate, or asking for it during brainstorming (flips the gate's default). Resume reads `## Engine` from `proposal.md`. Ground rules: git + `tasks.md` remain the only truth source (the workflow journal is cache); the Phase-4 sweep and every history rewrite stay orchestrator-side; Phases 1–3, 5, 6 are unchanged in v1. Details: `flows/ultracode-apply.md`.

## Design principles

- **Project-agnostic**: works on any project that has `openspec/` initialized
- **No copying of upstream skills**: depends on `superpowers:*` via the Skill tool, so they keep getting upstream updates
- **Strong context isolation**: each subagent dispatch uses the Agent tool with a dedicated prompt template; reviewers see git diffs, never implementer narrative; per-task fresh subagent — see `SKILL.md` `## Context Isolation Rules`
- **Spec-driven, not just design-doc-driven**: Phase 2 writes openspec requirement deltas (`specs/<capability>/spec.md` with scenarios) that serve as acceptance criteria for the final-reviewer and are merged into the living spec by `openspec archive`
- **Conservative defaults**: no auto-merge, no auto-push, no PR; `archive` only on explicit user instruction after `APPROVED`
- **Honest abort**: `discard` deletes openspec artifacts but reports (not reverts) any code commits accumulated during the change

## Quick reference: the six phases

| Phase | What happens | Who writes |
|---|---|---|
| 1. Brainstorm | Pure dialogue via `superpowers:brainstorming`. No files written. | (none) |
| 2. Propose | HARD-GATE: TDD (Sonnet) / TDD (Opus) / Simple? Then `openspec new change`, write `proposal.md` + `design.md` + `specs/<capability>/spec.md` deltas. | orchestrator |
| 3. Plan | Invoke `superpowers:writing-plans`, write `tasks.md` with TDD or Simple sub-steps. One `openspec(<name>): planning` commit covers all planning artifacts. | orchestrator |
| 4. Apply | Loop per Task: implementer → task-reviewer (spec compliance + quality, severity-tagged). Each is a fresh subagent. TDD Tasks leave red-phase evidence as a separate `test(...)` commit. | implementer subagent |
| 5. Final Review | One Opus subagent reviews the whole change holistically; walks the spec-delta scenarios; invokes `/code-review` (report-only) for correctness + cross-task DRY. Writes `review.md`. | final-reviewer subagent |
| 6. Archive | Only on explicit user instruction after `APPROVED`. `openspec archive` merges spec deltas into `openspec/specs/`; Haiku subagent commits. STOP — no merge / push / PR. | archive-committer subagent |

## Recovery paths

| Situation | Handling |
|---|---|
| implementer returns `Blocked: <reason>` | pause, surface the reason, ask the user how to proceed |
| task-reviewer FAILs 2× consecutively on same Task | 3rd implementer dispatch escalates to `opus` |
| task-reviewer FAILs 3× on same Task | pause, surface latest reviewer report to user |
| task-reviewer output malformed | re-dispatch reviewer once with a note; still malformed → pause and surface |
| final-reviewer = `CHANGES REQUESTED` | append `### Revision N - Task M:` to tasks.md, loop back to Phase 4 |
| final-reviewer = `NEEDS DESIGN UPDATE` | append `## Revisions` to design.md, update spec deltas, regenerate tasks.md, loop back to Phase 4 |
| User aborts | choose pause (keep everything) or discard (delete openspec artifacts; code commits left for user to revert manually) |

See `SKILL.md` for full details.
