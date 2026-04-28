# super-spec

Single-entry slash command that orchestrates a non-trivial change end-to-end through:

```
brainstorm → propose → plan → apply (per-task subagent + spec/quality review) → final review → archive
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
| `opsx` plugin | Claude Code plugin manager — provides openspec CLI skill wrappers |
| `simplify` skill | Built-in to Claude Code — no install needed |

The skill checks `openspec --version` at startup and halts with install instructions if missing. Plugin presence is **not** pre-checked; missing plugins surface as a clear error when their skill is first invoked.

## Project requirements

The current project must have `openspec/` initialized. If not, the skill will offer to run `openspec init`.

The skill works on whatever git branch is currently checked out — it does **not** create a new branch. All commits go on the current branch.

The skill refuses to start if there are tracked-file changes (modified or staged). Untracked files are allowed and do not block startup.

## Layout

```
super-spec/
├── SKILL.md              # entry point; full orchestration logic for all phases
├── prompts/
│   ├── implementer.md
│   ├── spec-reviewer.md
│   ├── quality-reviewer.md
│   ├── final-reviewer.md
│   └── archive-committer.md
└── README.md             # this file
```

## Subagent model assignment

| Subagent | Model |
|---|---|
| implementer | inherit (parent's model) |
| spec-reviewer | Sonnet (`claude-sonnet-4-6`) |
| code-quality-reviewer | Sonnet (`claude-sonnet-4-6`) |
| final-reviewer | Opus (`claude-opus-4-7`) |
| archive-committer | Haiku (`claude-haiku-4-5-20251001`) |

## Design principles

- **Project-agnostic**: works on any project that has `openspec/` initialized
- **No copying of upstream skills**: depends on `superpowers:*` and `opsx:*` via the Skill tool, so they keep getting upstream updates
- **Strong context isolation**: each subagent dispatch uses the Agent tool with a dedicated prompt template; reviewers see git diffs, never implementer narrative; per-task fresh subagent — see `SKILL.md` `## Context Isolation Rules`
- **Conservative defaults**: no auto-merge, no auto-push, no PR; `archive` only on explicit user instruction after `APPROVED`
- **Honest abort**: `discard` deletes openspec artifacts but reports (not reverts) any code commits accumulated during the change

## Quick reference: the six phases

| Phase | What happens | Who writes |
|---|---|---|
| 1. Brainstorm | Pure dialogue via `superpowers:brainstorming`. No files written. | (none) |
| 2. Propose | HARD-GATE: TDD or Simple? Then `openspec new change`, write `proposal.md` + `design.md`. | orchestrator |
| 3. Plan | Invoke `superpowers:writing-plans`, write `tasks.md` with TDD or Simple sub-steps. | orchestrator |
| 4. Apply | Loop per Task: implementer → spec-reviewer → quality-reviewer. Each is a fresh subagent. | implementer subagent |
| 5. Final Review | One Opus subagent reviews the whole change holistically; invokes `/simplify` for cross-task DRY. Writes `review.md`. | final-reviewer subagent |
| 6. Archive | Only on explicit user instruction after `APPROVED`. `openspec archive` + Haiku subagent commits. STOP — no merge / push / PR. | archive-committer subagent |

## Recovery paths

| Situation | Handling |
|---|---|
| spec / quality reviewer FAILs 3× on same Task | pause, surface latest reviewer report to user |
| final-reviewer = `CHANGES REQUESTED` | append `### Revision N - Task M:` to tasks.md, loop back to Phase 4 |
| final-reviewer = `NEEDS DESIGN UPDATE` | append `## Revisions` to design.md, regenerate tasks.md, loop back to Phase 4 |
| User aborts | choose pause (keep everything) or discard (delete openspec artifacts; code commits left for user to revert manually) |

See `SKILL.md` for full details.
