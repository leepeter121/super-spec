# Abort (user-initiated)

When the user says "abort", "stop this change", or similar:

Use AskUserQuestion:
> "Choose abort mode:
>  - **pause**: keep all artifacts; you can resume with `/super-spec <name>` later
>  - **discard**: delete `openspec/changes/<name>/`; code commits stay (you'll need to revert them manually if desired)"

## pause

Output:
```
Paused <name>. Resume with /super-spec <name>.
```
Stop.

## discard

Confirm one more time (free-form: "Confirm discard? This cannot be undone for the openspec artifacts."). On confirmation:

1. `rm -rf openspec/changes/<name>/`
2. Commit: `openspec(<name>): discard`
3. Identify code commits made during this change:
   ```
   git log --oneline <baseline_hash>..HEAD
   ```
   (baseline = commit before `openspec(<name>): planning`; if the planning commit no longer exists in history, ask the user for the starting point.)
4. Output:
   ```
   Discarded openspec/changes/<name>/.

   Code commits made during this change were NOT reverted:
     <list of hashes from step 3, excluding the planning / discard scaffolding commits>

   To revert them: git revert <hash> [<hash> ...]
   ```
