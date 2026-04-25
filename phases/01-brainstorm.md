# Phase 1 — Brainstorm

**Do not write any artifact files in this phase.**

Invoke `superpowers:brainstorming` via the Skill tool. Pass through the user's initial description (if any).

## ORCHESTRATOR OVERRIDES — include verbatim in the Skill `args`

Prepend the following block to the Skill `args` (above the user's description). These overrides take precedence over the brainstorming SKILL.md defaults — the brainstorming skill itself documents that user/orchestrator instructions override its defaults.

```
ORCHESTRATOR OVERRIDES (super-spec skill, Phase 1):

You are being invoked from the super-spec workflow, which owns all artifact creation
and git commits. Apply these overrides to your default checklist:

1. SKIP step 6 "Write design doc". Do NOT create any file under docs/superpowers/specs/
   or anywhere else. Deliver the validated design content as plain text in your final
   message instead. The orchestrator will write design.md from your message.

2. SKIP step 7 "Spec self-review" as a written-file review. Run the same checks
   (placeholder/consistency/scope/ambiguity) mentally over your in-message design
   content and fix inline before sending.

3. SKIP step 8 "User reviews written spec". The super-spec orchestrator runs its
   own approval gate (HARD-GATE A) on the in-message design content. Do not ask the
   user to review a file.

4. SKIP step 9 "Transition to implementation". Do NOT invoke writing-plans (or any
   other skill). Return control to the super-spec orchestrator.

5. Do NOT run `git add`, `git commit`, or any other git command that mutates state.
   The orchestrator owns all commits.

All other steps (explore context, clarifying questions, propose approaches, present
design, get user approval) run as normal.
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
