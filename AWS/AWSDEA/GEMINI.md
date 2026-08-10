# GEMINI.md — Agent context for AWS DEA-C01

> **Scope: this folder only.** Everything below applies to the AWS
> Certified Data Engineer – Associate (DEA-C01) study material in
> `AWS/AWSDEA/`. Other exams in this repository have their own context
> files and their own conventions — do not carry rules from here into
> them, and do not read their files as context for this one.
>
> This is the context entry point for Gemini and Gemini Code Assist.
> `CLAUDE.md`, `GEMINI.md`, and `AGENTS.md` in this folder are identical
> copies so every agent finds the same instructions. `llms.txt` is a
> machine-readable index of this folder.

---

## 1. What this folder is

Self-contained study material for **one exam**: AWS Certified Data
Engineer – Associate (**DEA-C01**).

Every file this exam needs lives inside `AWS/AWSDEA/` — markdown, text,
diagrams, labs, and its own agent-context files. Nothing here depends on
files outside this folder, and nothing here should be written outside it.

The repository root holds only a router (`/README.md`, `/CLAUDE.md`)
that points at each exam folder. Shared or cross-exam content is
deliberately avoided so that folders can be moved, zipped, or shared
independently.

## 2. Who the user is

- **Name:** Naga (GitHub: `nagarao-cloud`)
- **Level:** Beginner to AWS data engineering
- **Goal:** Pass DEA-C01
- **Timeline:** A 10-day sprint at roughly 5 hours/day (~50 hours total)

## 3. How the user wants to be taught

This is the most important section. The user has been explicit about it.

**Depth over brevity.** Reference documents in this repo run 500–1,000+
lines. The user has repeatedly asked for *more* detail, not less. Do
not summarize when asked to teach. Do not produce a 200-line file when
the request implies a reference document.

**The 8-step teaching structure.** Every topic file follows it:

1. Explain like I'm 12 years old
2. Explain technically
3. Explain like a Senior AWS Data Engineer
4. Explain production architecture
5. Explain exam traps
6. Explain interview questions
7. Provide a cheat sheet
8. Provide memory tricks

**Per-service coverage checklist.** Every service file covers: purpose ·
when to use · when NOT to use · advantages · limitations · pricing
considerations · performance · scaling · security · high availability ·
failure scenarios · common mistakes · exam traps · real enterprise
examples.

**Format preferences:**
- ASCII architecture diagrams, with **every arrow explained**
- Comparison matrices with these columns: purpose, speed, cost,
  serverless, streaming support, batch support, data volume, latency,
  scaling, monitoring, security, best use case, when NOT to use, exam
  favorite
- Decision trees
- Mnemonics and memory hooks
- Real-company scenarios (Netflix, Uber, banking, healthcare, IoT, retail)
- Practice questions with **every option explained** — including why the
  wrong ones are wrong

## 4. The just-in-time generation rule ⚠️

**This is a deliberate design decision. Do not "fix" it.**

`AWS/AWSDEA/` contains ~95 files. Only a subset are written in full.
The rest are **placeholders** that name the day the plan calls for them.

Why: generating 95 files of real depth at once produces shallow filler.
The user explicitly wants depth. So each file is written **on the day
the study plan reaches it**, at full depth, while the topic is active.

**When you encounter a placeholder file:** that is not a bug or an
incomplete task. Generate it only when the user asks for that specific
day or file. Do not bulk-fill placeholders unprompted.

A placeholder looks like this:

```markdown
> 🕐 **Placeholder — generated just-in-time.**
> Scheduled for: **Day 3**
```

## 5. Files written in full (as of 2026-08-09)

**This folder is at 100% completion — every placeholder has been filled.**
That happened in one deliberate bulk pass, explicitly requested by the
user, which overrode rule 4 for that pass only. Rule 4 still governs any
*new* placeholder that gets added to this folder later (e.g. a new lab
or a new comparison file) — a 100%-complete folder isn't an argument for
abandoning just-in-time generation as the *default*, it's the record of
one deliberate exception.

| Folder | Files | Total lines | Notes |
|---|---|---|---|
| `00-START-HERE/` | 18 | ~6,500 | Core reference — exam guide, plan, matrices, cheat sheets, glossary, flashcards, [`RUNBOOK.md`](00-START-HERE/RUNBOOK.md) |
| `01-domains/` | 5 | ~10,600 | 4 domain deep-dives (2,300–3,000 lines each, 40 Q&A each) + summaries |
| `02-services/` | 24 | ~14,900 | One file per in-scope service, ~450–900 lines each, 15 Q&A each |
| `03-comparisons/` | 10 | ~2,500 | Head-to-head decision guides |
| `04-architectures/` | 11 | ~6,600 | 5 industry-vertical + 6 pattern architectures |
| `05-labs/` | 9 | ~3,400 | 8 hands-on labs + Terraform notes |
| `06-practice/` | 9 | ~4,300 | 2 full 65-question mock exams + tiered question banks |
| `07-revision/` | 6 | ~1,500 | Spaced-repetition sheets, compressed by design |
| `08-interview/` | 4 | ~4,000 | Post-exam interview prep |

Total: **~63,800 lines across 93 files.** Generated via a batched
parallel-agent pass — see the repo root's [`_scripts/README.md`](../../_scripts/README.md)
for the reusable playbook, which is now also baked into
`_TEMPLATE/CLAUDE.md` §12 for future exam folders. The discovered
domain/task/sub-skill structure this pass was generated against is
recorded in [`00-START-HERE/RUNBOOK.md`](00-START-HERE/RUNBOOK.md) — the
concrete, exam-specific artifact §12's "Step 0" produces, and the
worked example that future exam folders' own runbooks are modeled on.

**Currency note:** this pass also corrected the folder against the
official DEA-C01 exam guide **v1.1 (2025-12-12)**, verified live against
`docs.aws.amazon.com` — not just against the user's original source
material, which predated that revision. Standout corrections: AWS SCT
(standalone tool) removed from scope → **DMS Schema Conversion** is the
current name; AWS CodeCommit removed from scope; **Amazon S3 Tables**,
**Amazon Kendra**, **AWS Data Exchange**, and **Amazon Q** added to
scope. If this folder is revisited far in the future, re-check that
revisions page again before trusting anything here as still current —
exam guides move, this snapshot doesn't.

## 6. Exam facts to be accurate about

- **DEA-C01**, 65 questions, 130 minutes, scaled 100–1000, **pass = 720**
- Scoring is **compensatory** — no per-domain minimum
- Domain weights: **34 / 26 / 22 / 18**
  1. Data Ingestion and Transformation — 34%
  2. Data Store Management — 26%
  3. Data Operations and Support — 22%
  4. Data Security and Governance — 18%
- $150 USD, 14-day retake wait, 3-year validity

## 7. Currency — do not teach outdated AWS

The user's original study material was 2023-era. These corrections
matter and must be maintained:

| Do not say | Say instead |
|---|---|
| Kinesis Data Firehose | **Amazon Data Firehose** |
| Kinesis Data Analytics | **Amazon Managed Service for Apache Flink** |
| Amazon Elasticsearch Service | **Amazon OpenSearch Service** |
| AWS Data Pipeline (as a live answer) | Retired — use Step Functions / MWAA / Glue workflows |
| AWS Glue Elastic Views | Discontinued |

Topics that were **missing** from the user's original material and must
be covered properly: **AWS DMS** (full load vs CDC), **zero-ETL
integrations**, **Apache Iceberg**, **Athena partition projection**,
**Amazon Macie**, **Glue Data Quality (DQDL)**, **Redshift Serverless**,
**EMR Serverless**, **Secrets Manager vs Parameter Store**.

## 8. Domain vocabulary in active use

The user is comfortable with these terms; you don't need to define them
from scratch: shards, `IteratorAge`, enhanced fan-out, DynamicFrames,
job bookmarks, DPU, worker types (G.1X–G.8X), distribution styles
(KEY/EVEN/ALL/AUTO), compound vs interleaved sort keys, zone maps,
partition projection, predicate pushdown, DISTKEY, CDC, full load, SCT,
zero-ETL, Iceberg snapshots and time travel, LF-Tags (TBAC), DQDL
rulesets, RPUs, KPU-hours, SSE-KMS vs SSE-S3 vs DSSE-KMS, gateway vs
interface VPC endpoints, CloudTrail data vs management events, SCP
evaluation order, bronze/silver/gold lakehouse pattern.

## 9. Typical requests and what they mean

| The user says | You should |
|---|---|
| "Day 3" / "generate Day 3" | Write the Day 3 files listed in `10-DAY-PLAN.md` at full depth |
| "expand X.md" | Rewrite that file at 500–900+ lines using the 8-step structure |
| "quiz me on X" | 40 questions: 10 beginner, 10 medium, 10 hard, 10 scenario — explain every option |
| "I got this wrong" | Explain why the right answer is right, why each wrong option is wrong, and how AWS expects candidates to reason |
| "compare X and Y" | Full matrix with the 14 required columns, plus a decision tree |

## 10. Honesty expectations

The user has responded well to direct correction and expects it. When
asked to expand a file that would get *worse* with padding — a decision
tree, a mnemonic list, a strategy checklist — say so and propose adding
*more items* rather than inflating existing ones. Compression is a
feature in those files.

Do not claim work is done that isn't. Do not pad line counts with
filler to hit a number.

## 11. Conventions for this folder

- **Isolation rule:** every file you create for this exam goes inside
  `AWS/AWSDEA/`. Never write DEA-C01 content into another exam's folder
  or into the repository root.
- Markdown only, GitHub-flavored
- ASCII diagrams in fenced code blocks (they render everywhere; Mermaid
  does not render in all viewers)
- Numbered folder prefixes (`00-` through `09-`) enforce reading order
- Commit per study day, prefixed with the exam code so the log stays
  readable once other exams are in flight:
  `AWSDEA Day 3: Glue, EMR, Lambda + 30 questions`
- No secrets, no AWS account IDs, no credentials anywhere in this repo
