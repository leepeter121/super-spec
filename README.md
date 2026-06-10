# super-spec

Single-entry slash command that orchestrates a non-trivial change end-to-end through:

```
brainstorm → propose → plan → apply (per-task subagent + review) → final review → archive
```

All artifacts live in `openspec/changes/<name>/`. Defaults: TDD mode is offered, no merge / push / PR.

## Trigger

```
/super-spec [<name | short description>]
```

- No argument → asks what you want to build
- New `<name>` → starts at brainstorm
- Existing `<name>` → resumes from current state

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
│   └── abort.md
├── prompts/                      # subagent prompt templates
│   ├── _isolation-preamble.md    # shared by every prompt below
│   ├── implementer.md
│   ├── task-reviewer.md          # single per-task reviewer: spec compliance + code quality
│   ├── final-reviewer.md
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
