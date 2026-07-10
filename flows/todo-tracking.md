# Todo Tracking — visualized workflow steps

**Purpose.** Give the user a live, at-a-glance view of where the workflow is, using the **Task\* tools** (`TaskCreate` / `TaskUpdate` / `TaskList` — the checklist the user sees in the UI). Without this, a long multi-phase run with per-Task subagent dispatches is opaque — the user can't tell whether we're brainstorming, on Task 3 of 5, or waiting on their approval.

**This list is a presentation mirror, not a control surface.** `tasks.md` checkboxes remain the source of truth for Phase-4 progress, and the phase/flow files drive control flow. The todo list is *derived* from that state — never read it back to decide what to do next, and never let it diverge silently. If the two disagree, `tasks.md` wins and you re-sync the todo list to match.

---

## Tool mechanics

This harness exposes the **Task\* family**, not a single `TodoWrite` call. The difference matters:

- **`TaskCreate`** adds **one** task at a time and returns its id. There is **no replace-whole-list call** — you build the list with one `TaskCreate` per item. Every task is created with status `pending`.
  - `subject` = the imperative label, e.g. `Phase 3 · Plan tasks`.
  - `activeForm` = present-continuous shown while active, e.g. `Planning tasks`.
  - `description` = one short line of context (e.g. `Phase 3 of the super-spec workflow`). Required field; keep it terse.
- **`TaskUpdate`** changes one task's `status` (`pending` / `in_progress` / `completed` / `deleted`) by `taskId`.
- **`TaskList`** returns every task with its `id` + `subject` + `status`. Use it to **resolve a task's id from its subject** before a `TaskUpdate`, since transitions below name items by label, not id. (If you still hold the id from the `TaskCreate` that made it, you can skip the lookup.)
- Keep **exactly one** item `in_progress` at any moment (this is what the UI highlights). Everything else is `pending` or `completed`.

> Because Task\* updates are per-item, the old "always resend the full list" caveat does **not** apply — touch only the task whose state changed.

---

## Item model (flat list; phase grouping lives in the label text)

**Shape A — before Phase 4 task expansion** (a fresh run, or any resume that hasn't reached Phase 4 yet):

1. `Phase 1 · Brainstorm design`
2. `Phase 2 · Write proposal & spec deltas`
3. `Phase 3 · Plan tasks`
4. `Phase 4 · Apply tasks`
5. `Phase 5 · Final review`
6. `Phase 6 · Archive`

**Shape B — from Phase 4 entry onward** (`tasks.md` exists, so we know the real Tasks). Replace the single `Phase 4 · Apply tasks` placeholder with one item per Task:

- `Phase 1 · Brainstorm design`
- `Phase 2 · Write proposal & spec deltas`
- `Phase 3 · Plan tasks`
- `Phase 4 · Task 1: <short title>`
- `Phase 4 · Task 2: <short title>`
- … one per Task in `tasks.md` …
- `Phase 5 · Final review`
- `Phase 6 · Archive`

`<short title>` = the Task header text from `tasks.md`, trimmed to a concise label.

---

## Initialization (run once per invocation)

Called from `SKILL.md` Invocation, after pre-flight and after the **entry phase** is determined (fresh start → Phase 1; resume → the phase `flows/resume-detection.md` selected):

1. Before creating anything, run **`TaskList`**. If items from a prior run of this change already exist, do **not** duplicate them — re-sync their statuses per the rules below and skip creation; only create what's missing. (A clean session returns an empty list.)
2. Decide the shape: if the entry phase is **Phase 4 or later** (so `tasks.md` exists), build **Shape B**; otherwise build **Shape A**.
3. Create the items **in order** with one `TaskCreate` per item (all land as `pending`). Keep the ids returned, or re-resolve them later via `TaskList`.
4. Set statuses from current on-disk state with `TaskUpdate`:
   - Every phase strictly **before** the entry phase → `completed`.
   - In Shape B, set each Phase-4 Task item from its `tasks.md` checkbox: `- [x]` → `completed`, `- [ ]` → leave `pending`.
   - The entry phase's first **incomplete** actionable item → `in_progress`; everything after it stays `pending`.

This makes a resume show its true history (earlier phases / done Tasks already checked) instead of restarting the visualization from zero.

---

## Per-phase transitions

Update individual items at each boundary the phase files point back to here for. Resolve the item's id via `TaskList` (by `subject`) when you don't already hold it, then `TaskUpdate`:

- **Enter a phase** → mark its item `in_progress`. (In Phase 4, this means the current Task item.)
- **Leave a phase** (the `→ Continue to Phase N` line) → mark its item `completed`.
- **Phase 4 entry** (`phases/04-apply.md`, after the entry sweep and before the Task loop) → rewrite the list from Shape A to **Shape B**: `TaskUpdate` the `Phase 4 · Apply tasks` placeholder to `status: deleted`, then `TaskCreate` one `Phase 4 · Task N: <title>` item per Task. Tasks already `- [x]` in `tasks.md` get `TaskUpdate`d to `completed`.
- **Phase 4, per Task**: mark the Task item `in_progress` at dispatch (step 1); mark it `completed` only when the Task is flipped to `- [x]` in `tasks.md` (step 3). Re-dispatches and FAIL rounds keep it `in_progress` — the work isn't done yet.

---

## Gates that wait on the user keep the item `in_progress`

These are points where the workflow legitimately blocks on a human, not finishes work. Leave the relevant item `in_progress` so the list reads "paused here", not "done":

- HARD-GATE A (design approval) — `Phase 1` item stays `in_progress`.
- HARD-GATE B (mode selection) — `Phase 2` item stays `in_progress`.
- A `Blocked:` return or the 3-consecutive-FAIL cap pause — the current `Phase 4 · Task N` item stays `in_progress`.

**Exception — Phase 5 `APPROVED`:** mark `Phase 5 · Final review` **`completed`** and leave `Phase 6 · Archive` `pending`. The review work is genuinely finished; the workflow is only waiting for the user's explicit "archive" instruction, which the `Phase 6` pending item already conveys.

---

## Revisions (CHANGES REQUESTED / NEEDS DESIGN UPDATE)

When the recover flow or a CHANGES REQUESTED round appends `### Revision N - Task M:` blocks to `tasks.md`:

1. `TaskCreate` a `Phase 4 · Revision N Task M: <title>` item (lands `pending`) for each new Task.
2. `TaskUpdate` `Phase 5 · Final review` back to `pending`; `Phase 6 · Archive` stays `pending`.
3. Re-enter Phase 4; the new items track exactly like ordinary Task items.

---

## Abort

- **pause** → leave the list untouched; its `in_progress` item records where you stopped, which matches the resume story.
- **discard** → clear the list: run `TaskList` and `TaskUpdate` every item to `status: deleted`. The change no longer exists, so neither should its visualization.
