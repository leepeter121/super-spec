# Phase 1 — Brainstorm

> **Todo:** mark `Phase 1 · Brainstorm design` `in_progress` (see `flows/todo-tracking.md`). It stays `in_progress` through HARD-GATE A — design approval is a user gate, not completion.

**Do not write any artifact files in this phase.**

Invoke `superpowers:brainstorming` via the Skill tool. Pass through the user's initial description (if any).

## ORCHESTRATOR OVERRIDES — include verbatim in the Skill `args`

Prepend the following block to the Skill `args` (above the user's description). These take precedence over brainstorming's defaults.

```
ORCHESTRATOR OVERRIDES (super-spec skill, Phase 1):

You are invoked from the super-spec workflow, which owns all artifact creation
and git commits. Apply these overrides.

Steps below are identified by NAME, not number — the parenthetical numbers
reflect the brainstorming skill's checklist as of this writing (superpowers
6.0.x) and may drift in future versions. Match on the step's name / intent; if
a number no longer lines up, the name wins.

1. SKIP the "Write design doc" step (≈ step 6). Do NOT create any file under
   `docs/superpowers/specs/` or anywhere else. Deliver the validated design as
   plain text in your final message; the orchestrator will write design.md.

2. SKIP the "Spec self-review" step (≈ step 7) as a file review. Run the same
   checks (placeholder/consistency/scope/ambiguity) mentally on the in-message
   content and fix inline before sending.

3. SKIP the "User reviews written spec" step (≈ step 8). The orchestrator runs
   its own approval gate (HARD-GATE A) on the in-message design. Do not ask the
   user to review a file.

4. SKIP the "Transition to implementation" step (≈ step 9). Do NOT invoke
   writing-plans or any other skill. Return control to the orchestrator.

5. SKIP the "Offer the visual companion" step (≈ step 2). Do NOT offer or open
   the browser-based Visual Companion and do NOT start the brainstorm server.
   This is an orchestrated, non-interactive brainstorm — keep the entire
   exchange in the terminal. If a question would read better shown than told,
   describe it in text (ASCII sketch / bullet comparison) instead.

6. Do NOT run `git add` / `git commit` / any state-mutating git command. The
   orchestrator owns all commits.

7. For the "explore context" step: delegate codebase investigation to Explore
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

## Engine mention during brainstorming

If at any point the user says they want this change run with **ultracode** / the Workflow engine, record that fact (no file writes). It becomes the **default answer** at Phase 2's HARD-GATE B2 — never a silent enablement; the gate still shows the agent-model table for confirmation.

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

→ **Todo:** mark `Phase 1 · Brainstorm design` `completed`. Continue to Phase 2.
