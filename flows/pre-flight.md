# Pre-flight

Run on every `/super-spec` invocation. Halt on first failure.

## 1. openspec CLI present

Run: `openspec --version`

If non-zero exit, halt with:
```
openspec CLI not installed. Install:
  npm i -g @openspec/cli
See https://openspec.dev for details.
```

## 2. openspec/ initialized in current project

Run: `openspec list`

If it errors (exit non-zero), ask the user (use AskUserQuestion):
> "openspec is not initialized in this project. Initialize now?"
Options: `yes` / `no`.
- `yes` → run `openspec init`, continue
- `no` → halt

## 3. No tracked-file changes (untracked files are allowed)

Run: `git status --porcelain --untracked-files=no`

If non-empty, halt with:
```
Tracked files have uncommitted changes. Please commit, stash, or discard them before /super-spec.
(Untracked files are OK and do not block.)

<output of `git status --short --untracked-files=no`>
```

## 4. `--ultra` flag → Workflow tool availability (conditional)

Only when the invocation included `--ultra`: check whether the **Workflow** tool is available in the current toolset. If it is not, announce:

```
Workflow tool unavailable in this session — the ultracode engine cannot run.
HARD-GATE B2 will default to native (you can still pick ultracode for a later session; the choice persists in proposal.md).
```

and continue (do **not** halt). This is a soft check — the authoritative fallback happens again at Phase 4 entry (`flows/ultracode-apply.md` step 1).

## Branch policy

Do **NOT** check the current branch. Do **NOT** create a new branch. All commits go on the current branch.
