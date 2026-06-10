---
name: super-spec
description: Spec-driven workflow combining superpowers (brainstorm/plan/subagent/TDD/review) with openspec (lifecycle). Triggered by /super-spec, or when user wants a structured multi-phase workflow for a non-trivial change with subagent isolation, per-task review, and final holistic review before archive.
---

# /super-spec

Single-entry workflow for a non-trivial change. End-to-end:

```
brainstorm → propose → plan → apply (per-task subagent + spec/quality review) → final review → archive
```

All artifacts live in `openspec/changes/<name>/`. Defaults: TDD mode is offered, no merge / no push / no PR.

---

## ⚠ EXECUTION MODEL

This file is an **index only** — all phase, flow, and template content lives in sibling files. You MUST Read each sibling file at the moment you enter its step, every invocation, with **no skipping, paraphrasing, or inferring contents from file names**. If a Read fails, halt and report the path; do not improvise. A correct run produces a long sequence of Read calls.

---

## Invocation

User runs `/super-spec [<name | short description>]`.

1. **Read `flows/pre-flight.md` and execute it.** Halt on any failure.
2. Then decide based on argument:
   - **No argument** → ask: "What change do you want to work on? Describe what to build or fix."
   - **`<name>` matches existing `openspec/changes/<name>/`** → **Read `flows/resume-detection.md` and execute it**, then jump to the phase it indicates.
   - **`<name>` is new, or only a description was given** → enter Phase 1 (Read `phases/01-brainstorm.md`).

---

## Phase index

Phases run sequentially unless a flow directs otherwise. Each row is an instruction: when you enter the phase, Read the file and execute it line-by-line.

| Phase | Action |
|---|---|
| 1. Brainstorm | Read `phases/01-brainstorm.md`. |
| 2. Propose | Read `phases/02-propose.md`. |
| 3. Plan | Read `phases/03-plan.md`. |
| 4. Apply (per-Task loop) | Read `phases/04-apply.md`. Re-Read at the top of every Task iteration — do not loop from memory. |
| 5. Final Review | Read `phases/05-final-review.md`. |
| 6. Archive | Read `phases/06-archive.md`. |

## Flow index (non-linear)

Enter only when the trigger fires; Read the file and execute it.

| Trigger | Action |
|---|---|
| Every invocation start (mandatory) | Read `flows/pre-flight.md`. |
| Resuming an existing change | Read `flows/resume-detection.md`. |
| Phase 5 verdict = `NEEDS DESIGN UPDATE` | Read `flows/recover.md`. |
| User says "abort" / "stop this change" | Read `flows/abort.md`. |

## Template index

When a phase file tells you to write an artifact, Read the matching template first for its exact structure — do not invent.

| Artifact | Template |
|---|---|
| `proposal.md` | `templates/proposal.md` |
| `design.md` | `templates/design.md` |
| `specs/<capability>/spec.md` (spec delta) | `templates/spec-delta.md` |
| `review.md` | `templates/review.md` |
| `## Revisions` block (Recover flow) | `templates/revision-block.md` |

---

## Context Isolation Rules (NON-NEGOTIABLE)

These deliver the actual isolation between phases. Apply to every Phase-4 dispatch and to Phase 5.

1. **Subagent dispatch always uses the Agent tool, never Skill.** Skill runs in the current context (no isolation); Agent spawns a fresh context. Skill is only for invoking other skills' interactive logic inside the orchestrator (e.g., `superpowers:brainstorming`, `superpowers:writing-plans`, `/code-review` inside the final-reviewer).
2. **Build every subagent prompt from `prompts/*.md`.** Read at dispatch time, substitute variables, pass verbatim. No freehand. No extra context unless a `{...}` placeholder invites it. The shared `prompts/_isolation-preamble.md` is referenced by every per-role prompt — do not strip it.
3. **Reviewers see git, not implementer narrative.** Implementer returns `Done: <commit_hash>`; reviewer prompts contain only the hash and fetch the diff themselves. Never paste implementer narrative into a reviewer prompt.
4. **Per-task fresh subagent.** Never reuse a subagent across Tasks — fresh implementer + reviewer per dispatch.
5. **Strip orchestrator context.** Brainstorming conversation, prior Task outputs, reviewer reports — none of these go into a subagent prompt unless the template has a placeholder for them.
6. **Final-reviewer is also fresh.** Reads files from disk and runs git itself; receives no per-task summaries.

---

## Dependencies

Documented in `README.md`. Pre-flight checks the openspec CLI binary only; plugins are not pre-checked. If a `Skill` invocation fails because a plugin is missing, output:

```
Skill `<name>` not found. This workflow depends on the `superpowers` plugin.
Install via Claude Code plugin manager.
```

then halt.
