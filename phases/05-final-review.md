# Phase 5 — Final Review

> **Todo:** mark `Phase 5 · Final review` `in_progress` (see `flows/todo-tracking.md`).

Dispatch the final-reviewer subagent.

Use the **Agent** tool. Read `prompts/final-reviewer.md` and substitute:
- `{CHANGE_NAME}`: `<name>`
- `{PROPOSAL_PATH}`: `openspec/changes/<name>/proposal.md`
- `{DESIGN_PATH}`: `openspec/changes/<name>/design.md`
- `{TASKS_PATH}`: `openspec/changes/<name>/tasks.md`
- `{SPECS_DIR}`: `openspec/changes/<name>/specs/`
- `{COMMIT_RANGE}`: `<baseline_hash>..HEAD` where baseline = the commit immediately **before** `openspec(<name>): planning`. Find with: `git log --oneline --grep="openspec(<name>): planning" --format="%H" -n 1` then `git rev-parse <hash>~1`.

**Model:** `opus`

**Forbidden:** per-task reviewer reports; implementer narratives; the brainstorming conversation.

The prompt instructs the reviewer to invoke the `/code-review` skill (report-only, e.g. `/code-review high`) internally for correctness, cross-task DRY, and efficiency analysis.

The reviewer returns one of:
- `VERDICT: APPROVED` + summary + optional `## Notes` of `[Minor]` items
- `VERDICT: CHANGES REQUESTED` + severity-tagged issues + suggested revision tasks
- `VERDICT: NEEDS DESIGN UPDATE` + severity-tagged design issues + suggested resolutions

### Severity rule (the reviewer applies this; orchestrator should re-validate)

- `APPROVED` ⇔ zero `[Critical]` and zero `[Important]` issues. `[Minor]` items belong under `## Notes`.
- `CHANGES REQUESTED` ⇔ at least one `[Critical]` or `[Important]` issue, design itself is sound.
- `NEEDS DESIGN UPDATE` ⇔ design itself is flawed.

If the reviewer's output contradicts this rule (e.g., reports `APPROVED` while listing `[Critical]` issues, or `CHANGES REQUESTED` with only `[Minor]` items), **do not silently rewrite it**: re-dispatch the final-reviewer once with a note pointing out the inconsistency, then go with the corrected output.

## Write `review.md`

Path: `openspec/changes/<name>/review.md`

Structure: see `templates/review.md`. Fill in `Verdict`, `Summary` (from reviewer), and the relevant body section (severity-tagged).

Write `review.md` to disk but **do NOT commit it here**. It stays uncommitted in the working tree; Phase 6's archive-committer absorbs it into the single `chore(openspec): archive <name>` commit alongside the archived file moves. This keeps the branch from accumulating a stand-alone `openspec(<name>): final review` scaffolding commit when no further code changes follow.

(Exception — `CHANGES REQUESTED` path: the `openspec(<name>): revision N tasks` commit described below remains as a separate commit because it precedes new feat work and acts as the planning commit for the revision round.)

## Route by verdict

- **APPROVED** → **Todo:** mark `Phase 5 · Final review` `completed`; leave `Phase 6 · Archive` `pending` (see `flows/todo-tracking.md`). Show user the verdict (including any `## Notes` `[Minor]` items). Wait for the user's explicit "archive" instruction. Do NOT auto-archive.
- **CHANGES REQUESTED** → Use AskUserQuestion: "Reviewer requested changes. Add revision tasks now?"
  - `yes` → append `### Revision N - Task M:` blocks to `tasks.md` addressing every `[Critical]` and `[Important]` issue (omit `[Minor]` from revision tasks; they're recorded but not gating), commit `openspec(<name>): revision N tasks`, then loop back to Phase 4 for the new tasks only. **Todo:** append a `Phase 4 · Revision N Task M: <title>` item (`pending`) per new Task and set `Phase 5 · Final review` back to `pending`.
  - `no` → pause; user can resume later
- **NEEDS DESIGN UPDATE** → Jump to `flows/recover.md`
