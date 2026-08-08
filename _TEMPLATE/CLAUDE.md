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
