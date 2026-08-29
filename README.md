# CertificationPrep

> 📖 **[Browse online](https://nagarao-cloud.github.io/CertificationPrep/)** — searchable site, once GitHub Pages is enabled (see `_scripts/README.md`'s "Publishing to GitHub Pages" section). Until then this link 404s.

Study repositories for cloud certifications.

**Every exam is a self-contained folder.** Markdown, text files,
diagrams, labs, and AI-agent context all live inside the exam's own
directory. Nothing crosses between exams.

---

## Exam registry

| Vendor | Code | Certification | Status | Folder |
|---|---|---|---|---|
| AWS | **DEA-C01** | Certified Data Engineer – Associate | 🟡 Active | [`AWS/AWSDEA/`](AWS/AWSDEA/) |
| AWS | **AIF-C01** | Certified AI Practitioner | 🟡 Active | [`AWS/AWSAIF/`](AWS/AWSAIF/) |
| GCP | **PCA** | Professional Cloud Architect | 🟡 Active | [`GCP/GCPPCA/`](GCP/GCPPCA/) |
| GCP | **PAA** | Professional Agentic Architect | 🔵 Beta — registration opens 2026-09-03 | [`GCP/PAA/`](GCP/PAA/) |

---

## Layout

```
CertificationPrep/
├── README.md                you are here
├── CLAUDE.md                router for AI agents ─┐
├── GEMINI.md                identical copy        ├─ point to exam folders,
├── AGENTS.md                identical copy       ─┘  contain no exam content
│
├── _TEMPLATE/               scaffold for a new exam
├── _scripts/
│   └── new-exam.sh          creates a new isolated exam folder
│
└── AWS/
    ├── AWSDEA/                          ← everything DEA-C01 lives here
    │   ├── CLAUDE.md                    ⭐ real instructions for this exam
    │   ├── GEMINI.md                    identical copy
    │   ├── AGENTS.md                    identical copy
    │   ├── llms.txt                     machine-readable index
    │   ├── README.md                    index + master mental map
    │   ├── 00-START-HERE/               core reference, written in full
    │   ├── 01-domains/
    │   ├── 02-services/
    │   ├── 03-comparisons/
    │   ├── 04-architectures/
    │   ├── 05-labs/
    │   ├── 06-practice/
    │   ├── 07-revision/
    │   ├── 08-interview/
    │   └── 09-assets/
    │
    └── AWSAIF/                          ← everything AIF-C01 lives here
        └── (same ten-subfolder layout)

GCP/
├── GCPPCA/                              ← everything PCA lives here
│   └── (same ten-subfolder layout)
└── PAA/                                 ← everything PAA (Beta) lives here
    └── (same ten-subfolder layout)
```

Every exam folder gets the same ten numbered subfolders, so once you
learn one layout you know them all.

---

## Why isolation

Different exams have different domain weights, different question
formats, and different study approaches. A Solutions Architect exam is
not a Data Engineer exam with the nouns swapped.

Keeping folders independent means:

- **AI assistants don't cross-contaminate.** Each folder's `CLAUDE.md`
  describes only that exam. An assistant working on DEA-C01 won't apply
  SAA-C03 conventions, or read the wrong exam's notes as context.
- **Folders are portable.** Zip one and share it; it works standalone.
- **Finished exams can be archived** without disturbing active ones.
- **No shared-folder drift.** There is deliberately no `common/` or
  `shared/` directory — those become dumping grounds and break the
  guarantee above.

---

## Adding a new exam

```bash
./_scripts/new-exam.sh AWS AWSSAA "AWS Certified Solutions Architect – Associate" SAA-C03
```

This creates `AWS/AWSSAA/` from `_TEMPLATE/` with all ten subfolders and
its own `CLAUDE.md` / `GEMINI.md` / `AGENTS.md` / `llms.txt`, placeholders
already substituted.

Then:

1. Fill in that folder's `CLAUDE.md` — exam facts, domain weights,
   teaching preferences (sections 2, 3, 6, 7, 8)
2. Re-copy `CLAUDE.md` over `GEMINI.md` and `AGENTS.md` so all three stay
   identical
3. Add a row to the exam registry above and in `/CLAUDE.md`

Works for any vendor: `./_scripts/new-exam.sh Azure AZ104 "Microsoft Azure Administrator" AZ-104`

### Generating that folder's content

The scaffold's `CLAUDE.md` (and its copies) ship with a **bulk
content-generation playbook** (§12) — a proven, reusable process for
having an agent fill every placeholder in a new exam folder to full
depth in one pass, batching parallel background agents, verifying
currency against the vendor's official exam guide first, and recovering
cleanly if a batch fails partway through. It doesn't need to be
re-explained per exam; it travels with the template.

See [`_scripts/README.md`](_scripts/README.md) for the exact two-step
workflow and the kickoff prompt to use in a fresh conversation — no
source material or process explanation needs to be pasted in, since it
all already lives in the folder once it's scaffolded.

This is opt-in, not the default: day-to-day, exam folders are still
filled **just-in-time**, one placeholder at a time, as noted below.

---

## Working with AI assistants

Three filenames are used because the tools disagree on conventions:

| File | Read by |
|---|---|
| `CLAUDE.md` | Claude Code, Claude Desktop |
| `GEMINI.md` | Gemini, Gemini Code Assist |
| `AGENTS.md` | Cursor, GitHub Copilot, Codex, others |
| `llms.txt` | Crawlers and tools following the llmstxt.org convention |

They exist at **two levels**:

- **Root** — a router. Says where exams live and enforces the isolation
  rule. No exam content.
- **Inside each exam folder** — the real instructions: who the user is,
  how they want to be taught, exam facts, service-name corrections, and
  which files are placeholders on purpose.

When you open this repo with an assistant, point it at the **exam
folder's** context file, not the root one.

---

## A note on placeholder files

Many files are placeholders marked **🕐 generated just-in-time**, each
naming the study day it belongs to.

This is intentional, not incomplete work. Writing ~95 files of genuine
depth up front produces shallow filler; writing each one on the day the
plan reaches it produces material worth reading. A placeholder is a
scheduled item, not a missing one.

---

## License

Personal study notes. No warranty of accuracy — always verify against
the official exam guide and current vendor documentation.
