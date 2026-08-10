# CLAUDE.md — Agent context for {{EXAM_CODE}}

> **Scope: this folder only.** Everything below applies to
> {{EXAM_NAME}} ({{EXAM_CODE}}) in `{{VENDOR}}/{{FOLDER}}/`. Other exams
> in this repository have their own context files and their own
> conventions — do not carry rules from here into them, and do not read
> their files as context for this one.
>
> `GEMINI.md` and `AGENTS.md` in this folder are identical copies.
> `llms.txt` is a machine-readable index of this folder.

---

## 1. What this folder is

Self-contained study material for **one exam**: {{EXAM_NAME}}
(**{{EXAM_CODE}}**).

Every file this exam needs lives inside this folder — markdown, text,
diagrams, labs, and its own agent-context files. Nothing here depends on
files outside this folder, and nothing here should be written outside it.

## 2. Who the user is

- **Name:** Naga (GitHub: `nagarao-cloud`)
- **Level:** _(fill in: beginner / intermediate / experienced)_
- **Goal:** Pass {{EXAM_CODE}}
- **Timeline:** _(fill in: e.g. 10-day sprint at ~5 h/day)_

## 3. How the user wants to be taught

_(Fill this in for THIS exam. Do not assume it matches another exam's
folder — formats and difficulty differ.)_

Default preferences carried across all exams:
- **Depth over brevity.** Reference documents run 500–1,000+ lines.
- Comparison matrices, decision trees, ASCII diagrams with every arrow
  explained, mnemonics, and practice questions where **every option** is
  explained — including why the wrong ones are wrong.

## 4. The just-in-time generation rule ⚠️

Placeholder files marked 🕐 are **scheduled**, not missing. Generate a
file on the day the study plan reaches it, at full depth. Do not bulk-fill
placeholders unprompted — doing so produces shallow filler.

## 5. Files written in full

| File | Lines | Purpose |
|---|---|---|
| _(none yet)_ | | |

## 6. Exam facts

- **Code:** {{EXAM_CODE}}
- **Questions:** _(fill in)_
- **Time:** _(fill in)_
- **Pass score:** _(fill in)_
- **Domain weights:** _(fill in)_
- **Cost:** _(fill in)_

## 7. Currency — do not teach outdated material

_(List renamed/retired services and any gaps in older study material.)_

| Do not say | Say instead |
|---|---|
| | |

## 8. Domain vocabulary in active use

_(List terms the user already knows so they aren't re-explained.)_

## 9. Typical requests and what they mean

| The user says | You should |
|---|---|
| "Day N" | Write the Day N files listed in the study plan, at full depth |
| "expand X.md" | Rewrite that file at 500–900+ lines |
| "quiz me on X" | 40 questions (10 beginner / 10 medium / 10 hard / 10 scenario), every option explained |
| "I got this wrong" | Explain why the right answer is right, why each wrong option is wrong, and how the exam expects candidates to reason |

## 10. Honesty expectations

Direct correction is expected and welcome. If expanding a file would
make it *worse* (decision trees, mnemonics, checklists — where
compression is the point), say so and propose adding more items instead
of inflating existing ones. Never pad to hit a line count.

## 11. Conventions for this folder

- **Isolation rule:** every file you create for this exam goes inside
  `{{VENDOR}}/{{FOLDER}}/`. Never write into another exam's folder or
  the repository root.
- Markdown only, GitHub-flavored
- ASCII diagrams in fenced code blocks
- Numbered folder prefixes (`00-` through `09-`) enforce reading order
- Commit messages prefixed with the exam code: `{{FOLDER}} Day 3: ...`
- No secrets, no account IDs, no credentials

## 12. Bulk content-generation playbook (only when explicitly requested)

Rule 4 is the default: placeholders get filled just-in-time, one at a
time. **Do not run this playbook unprompted.** Run it only when the user
explicitly asks to fill some or all placeholders in one pass (e.g. "fill
every file to 100%," "generate everything now"). This section exists so
that request can be honored correctly on the first try, without the user
having to re-explain the process or re-supply source material — this is
the reusable part of what made the first exam folder in this repo
(AWS DEA-C01) go from ~4,000 to ~63,000 lines in one session without the
result being shallow filler.

**Step 0 — verify currency before writing anything.** Source material
(pasted by the user, or in this repo already) can predate the vendor's
most recent exam-guide revision. Before generating content, find and
fetch the vendor's official exam-guide changelog/revisions page (most
certification vendors publish one — AWS does, at
`docs.aws.amazon.com/aws-certification/.../<exam>-revisions.html`). Read
what actually changed: services added/removed from scope, skills
renamed or renumbered, tools deprecated. Fold every finding into section
7 (currency corrections) *before* the bulk pass, not after — an agent
regenerating 24 service files with a deprecated tool name baked in is a
worse outcome than a placeholder.

**Step 1 — batch by folder, not by file and not all-at-once.** One
agent per file is too slow (dozens of round-trips for a `02-services/`
folder with 24 files). One giant agent for the whole exam risks losing
the thread over such a large output and makes a mid-run failure costly
to recover from. The sweet spot demonstrated here: **4-8 files per
background agent**, grouped by folder or by clear topical adjacency
(e.g. streaming services together, security services together). Launch
the batches in parallel (multiple `Agent` calls in one turn) since
they're writing disjoint files with no dependencies between them.

**Step 2 — each agent reads this file, not a re-explanation of it.**
Tell every agent to start by reading this folder's own `CLAUDE.md` in
full for the audience, structure, and currency corrections, instead of
re-pasting all of that into every prompt. Only spell out what's specific
to that agent's batch: which files, what each must cover, and any
cross-file facts it must stay consistent with (see Step 4).

**Step 3 — match depth to file type, not one target for everything.**
Reference/teaching files (domains, services, comparisons, architectures)
want real depth — hundreds to low thousands of lines, per section 3's
"depth over brevity" default. Compressed-by-design files (revision
sheets, flashcards, glossaries, a study roadmap) want the *opposite* —
section 10 already says compression is a feature there; padding them to
hit a line-count target makes them worse, not better. Tell each agent
explicitly which kind of file it's writing.

**Step 4 — prevent cross-file contradictions.** When two files in this
folder will both cover the same cross-cutting fact (a policy evaluation
order, a deprecated-service call, a security model), have the later
agent read the earlier file and match its conclusion rather than
re-deriving it independently. Two reference files quietly disagreeing
with each other is worse than either being incomplete.

**Step 5 — recover from a failed batch by diffing, not restarting.**
Background agents can fail mid-stream from transient infrastructure
issues unrelated to the content itself. When one reports failed, don't
assume nothing happened — check actual file states first (line counts,
or grep for the placeholder marker) to see what that agent completed
before it stalled. Relaunch a smaller, consolidated agent covering only
the files that are still actually missing. Several small failures can
be swept into one cleanup batch rather than re-running the original
large batches from scratch.

**Step 6 — self-verify before reporting done.** Each agent should, at
the end of its own run: confirm no placeholder marker remains in any
file it touched; grep for terms that should have been corrected in Step
0 (e.g. a deprecated service name) to confirm none slipped through; and
for any file containing numbered questions with a separate answer key,
confirm the numbering and correct answers actually match between them.

**Step 7 — isolation still applies, especially now.** Never let an
agent working on this exam folder read another exam folder's files as
style or content reference, even mid-bulk-generation. If this exam's
folder is far along and another exam folder is just starting, that's
not a reason to shortcut — each exam's material is different enough
that borrowing conclusions across them produces exactly the kind of
folder this repo's structure exists to prevent.

After a bulk pass, update section 5 (files written in full) to reflect
the new state — a per-folder line-count summary, not a line-by-line
list of every file, matches this doc's own "compression is a feature"
principle for anything that isn't teaching content.

See the repo root's `_scripts/README.md` for the end-to-end version of
this workflow, including the exact kickoff prompt to use in a fresh
conversation.
