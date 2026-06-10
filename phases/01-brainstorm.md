# Phase 1 — Brainstorm

**Do not write any artifact files in this phase.**

Invoke `superpowers:brainstorming` via the Skill tool. Pass through the user's initial description (if any).

## ORCHESTRATOR OVERRIDES — include verbatim in the Skill `args`

Prepend the following block to the Skill `args` (above the user's description). These take precedence over brainstorming's defaults.

```
ORCHESTRATOR OVERRIDES (super-spec skill, Phase 1):

You are invoked from the super-spec workflow, which owns all artifact creation
and git commits. Apply these overrides:

1. SKIP step 6 "Write design doc". Do NOT create any file under
   `docs/superpowers/specs/` or anywhere else. Deliver the validated design as
   plain text in your final message; the orchestrator will write design.md.

2. SKIP step 7 "Spec self-review" as a file review. Run the same checks
   (placeholder/consistency/scope/ambiguity) mentally on the in-message content
   and fix inline before sending.

3. SKIP step 8 "User reviews written spec". The orchestrator runs its own
   approval gate (HARD-GATE A) on the in-message design. Do not ask the user
   to review a file.

4. SKIP step 9 "Transition to implementation". Do NOT invoke writing-plans or
   any other skill. Return control to the orchestrator.

5. Do NOT run `git add` / `git commit` / any state-mutating git command. The
   orchestrator owns all commits.

6. For the "explore context" step: delegate codebase investigation to Explore
   subagents instead of running grep/read sweeps in this context. Dispatch via
   the Agent tool with `subagent_type: "Explore"`, `model: "haiku"`; fire
   independent questions as parallel dispatches in one message. Each prompt
   must state the search breadth ("medium", or "very thorough" for wide sweeps)
   and require the return format "conclusions + file:line references only — no
   file content dumps". Use `model: "sonnet"` instead when the question needs
   judgment (comparing approaches, assessing architecture) rather than locating
   and enumerating. Reading a handful of specific files you already know the
   paths of does NOT need delegation — this is for open-ended searches.

All other steps (clarifying questions, propose approaches, present design,
get user approval) run as normal.
```

When brainstorming returns:

## HARD-GATE A — Design Approved

The user must explicitly approve the design before continuing. If brainstorming completed without explicit approval, ask the user to confirm.

## Sanity check — no superpowers artifacts leaked

Before continuing, verify the overrides held:

```
git status --porcelain docs/superpowers/ 2>/dev/null
ls docs/superpowers/specs/ 2>/dev/null
git log -1 --format="%H %s"
```

If any file appeared under `docs/superpowers/specs/` or HEAD looks like a rogue brainstorming commit (subject starts with `docs:` and touches only `docs/superpowers/specs/`), do NOT clean up here — Phase 2's pre-commit absorb step will handle it. Just note the situation and continue.

→ Continue to Phase 2.
