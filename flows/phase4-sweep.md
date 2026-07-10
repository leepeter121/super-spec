# Phase-4 Entry Sweep — purge superpowers artifacts (idempotent)

Run **once at Phase 4 entry, before the first Task iteration** (invoked from `phases/04-apply.md` step 0). Idempotent on resume. This is the last safe window for history rewrite — no implementation commit exists yet, so `git rebase --onto` cannot conflict on overlapping paths. The sweep runs in BOTH engines (native and ultracode) — it is orchestrator-side and never moves inside a Workflow.

**All git commands in this flow must be delegated to a haiku Agent subagent** (same rule as Phase 3's absorb) — describe the full conditional logic in the subagent prompt and have it report the result. History rewrite is involved: on any rebase conflict the subagent must halt and report stderr verbatim instead of resolving or aborting on its own.

If `git status --porcelain` shows uncommitted tracked changes, `git stash push --keep-index -m "super-spec phase-4-sweep"` first; `git stash pop` after the sweep.

## 1. File sweep

```
ls docs/superpowers/specs/ docs/superpowers/plans/ 2>/dev/null
```

If anything exists: `rm -rf docs/superpowers/specs/ docs/superpowers/plans/` then `rmdir docs/superpowers 2>/dev/null` (only if empty).

## 2. Determine baseline

Baseline = the commit immediately before `openspec(<name>): planning`:

```
PLANNING_HASH=$(git log --oneline --grep="openspec(<name>): planning" --format="%H" -n 1)
BASELINE=$(git rev-parse "${PLANNING_HASH}~1")
```

If `PLANNING_HASH` is empty, halt and report (the sweep should never run before the Phase-3 planning commit).

## 3. Scan baseline..HEAD for rogue commits

For each commit in `git log --format="%H" "$BASELINE"..HEAD`, mark it **rogue** if **every** path under `git show --name-only --format= "$HASH"` lies inside `docs/superpowers/specs/` or `docs/superpowers/plans/`. Build the rogue list oldest → newest.

## 4. Drop rogue commits via rebase

For each rogue hash (oldest first):

```
git rebase --onto "${HASH}^" "$HASH" HEAD
```

Drops one commit and replays the rest onto its parent. No conflict risk: any later commit touching `docs/superpowers/...` would itself be rogue and excluded from the replay set. After each rebase HEAD shifts, so re-scan `$BASELINE..HEAD` and repeat until no rogues remain.

## 5. Final verification

`git log "$BASELINE"..HEAD --format="%H %s"` and `ls docs/superpowers/ 2>/dev/null` must show zero `docs:` rogue subjects and no `docs/superpowers/` directory. Otherwise halt and report.

→ Return to `phases/04-apply.md` (Engine routing step).
