# CLAUDE.md — Repository router

> This is a **router only**. It tells you where things live. The real
> instructions are inside each exam folder.
>
> `GEMINI.md` and `AGENTS.md` at this level are identical copies.

---

## The one rule

**Each exam folder is self-contained and isolated.**

Every exam owns its own markdown, text files, diagrams, labs, and its
own agent-context files (`CLAUDE.md`, `GEMINI.md`, `AGENTS.md`,
`llms.txt`). Nothing in an exam folder depends on anything outside it.

When you work on an exam:

1. Open that exam's folder
2. Read the `CLAUDE.md` **inside that folder** — it overrides anything here
3. Write every file you create **inside that folder**

Do **not**:
- Read one exam's files as context for another
- Carry teaching conventions between exam folders (they differ per exam)
- Create shared/common folders across exams
- Write exam content at the repository root

Different exams have different formats, different domain weights, and
different study approaches. Isolation is deliberate so each folder can
be moved, zipped, or shared on its own.

---

## Layout

```
CertificationPrep/
├── README.md            ← human-readable index
├── CLAUDE.md            ← you are here (router)
├── GEMINI.md            ← identical copy
├── AGENTS.md            ← identical copy
├── _TEMPLATE/           ← scaffold for a new exam (copy, don't edit in place)
├── _scripts/            ← new-exam.sh
│
└── AWS/
    ├── AWSDEA/          ← AWS Data Engineer Associate (DEA-C01)
    │   ├── CLAUDE.md    ← ⭐ the real instructions for this exam
    │   ├── GEMINI.md
    │   ├── AGENTS.md
    │   ├── llms.txt
    │   ├── README.md
    │   └── 00-START-HERE/ … 09-assets/
    └── AWSAIF/          ← AWS Certified AI Practitioner (AIF-C01)
        └── (same layout)
```

---

## Exam registry

| Vendor | Code | Certification | Status | Folder |
|---|---|---|---|---|
| AWS | **DEA-C01** | Certified Data Engineer – Associate | 🟡 Active | [`AWS/AWSDEA/`](AWS/AWSDEA/) |
| AWS | **AIF-C01** | Certified AI Practitioner | 🟡 Active | [`AWS/AWSAIF/`](AWS/AWSAIF/) |

Add a row here when a new exam folder is created.

---

## Adding a new exam

```bash
./_scripts/new-exam.sh AWS AWSSAA "AWS Certified Solutions Architect – Associate" SAA-C03
```

This copies `_TEMPLATE/` into `AWS/AWSSAA/` with the placeholders filled
in. Then edit the new folder's `CLAUDE.md` to describe *that* exam's
domain weights, teaching preferences, and conventions — do not assume
they match DEA-C01's.

To then have an agent fill that folder's content, see
[`_scripts/README.md`](_scripts/README.md) — the scaffold's `CLAUDE.md`
already carries a reusable bulk-generation playbook (§12), so a fresh
conversation needs only a short kickoff prompt, not re-explained context
or pasted source material.

---

## About the user

- **Name:** Naga (GitHub: `nagarao-cloud`)
- General preference across all exams: **dense, structured reference
  material over conversational explanation**; comparison matrices,
  decision trees, ASCII diagrams, and practice questions where every
  option is explained.

Exam-specific preferences live in each exam's own `CLAUDE.md`.

---

## Repository-wide conventions

- Markdown only, GitHub-flavored
- ASCII diagrams in fenced code blocks (render everywhere; Mermaid does not)
- Commit messages prefixed with the exam code: `AWSDEA Day 3: ...`
- No secrets, no account IDs, no credentials — anywhere
