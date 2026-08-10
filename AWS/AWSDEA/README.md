# AWS Certified Data Engineer – Associate (DEA-C01)
## 10-Day Sprint Repository — 2026 exam version

---

## Read this first

This folder has **93 files, ~63,800 lines, all written in full** — see
[`CLAUDE.md`](CLAUDE.md) §5 for the per-folder breakdown and
[`00-START-HERE/RUNBOOK.md`](00-START-HERE/RUNBOOK.md) for exactly which
official exam-guide domain/task/sub-skill each file covers.

**You still do not have time to read 93 files in 10 days.** Completeness
of the material isn't a license to read all of it — at 5 hours/day you
have ~50 hours, and roughly 60% of that must still go to *scenario
practice questions*, not reading. Reading feels like progress. Answering
30 scenario questions and dissecting every wrong option **is** progress.
Use [`00-START-HERE/RUNBOOK.md`](00-START-HERE/RUNBOOK.md) and the
[`10-DAY-PLAN.md`](00-START-HERE/10-DAY-PLAN.md) to navigate to what a
given day actually needs, rather than reading top to bottom.

This folder reached 100% completion on 2026-08-09 via one explicit,
user-requested bulk-generation pass (normally exam folders in this repo
fill placeholders **just-in-time**, one file at a time, as the study
plan reaches them — see `CLAUDE.md` §4). If you're looking at this
folder as a reference for how to bootstrap a *new* exam folder, the
reusable process lives in the repo root's `_scripts/README.md` and
`_TEMPLATE/CLAUDE.md` §12, not here — this file is the finished result,
not the recipe.

---

## Reading order

### 1. Core reference — [`00-START-HERE/`](00-START-HERE/)

1. **[RUNBOOK.md](00-START-HERE/RUNBOOK.md)** — the official exam-guide structure this whole folder was generated against, and the coverage map showing which file answers which domain/task/sub-skill
2. **[EXAM-GUIDE.md](00-START-HERE/EXAM-GUIDE.md)** — format, all 17 task statements, service depth ratings, self-assessment checklist
3. **[10-DAY-PLAN.md](00-START-HERE/10-DAY-PLAN.md)** — your daily schedule. Print this.
4. **[SERVICE-SELECTION-MATRIX.md](00-START-HERE/SERVICE-SELECTION-MATRIX.md)** ⭐ — the highest-value file. ~110 keyword→service triggers and 16 comparison matrices.
5. **[DECISION-TREES.md](00-START-HERE/DECISION-TREES.md)** — 16 trees plus 17 worked questions with every option dissected
6. **[EXAM-TRAPS.md](00-START-HERE/EXAM-TRAPS.md)** — 60 distractors AWS reuses
7. **[MNEMONICS.md](00-START-HERE/MNEMONICS.md)** — memory hooks
8. **[EXAM-STRATEGY.md](00-START-HERE/EXAM-STRATEGY.md)** — working the 130 minutes
9. **[50-TIPS.md](00-START-HERE/50-TIPS.md)** — the original tip list, audited and re-weighted

`00-START-HERE/` also has, all now written in full: `TROUBLESHOOTING.md`,
`COST-OPTIMIZATION.md`, `SECURITY.md`, `WELL-ARCHITECTED.md`,
`CHEAT-SHEETS.md`, `FLASHCARDS.md`, `GLOSSARY.md`, `STUDY-ROADMAP.md`.

### 2. Study material

| Folder | Contents | When |
|---|---|---|
| [`01-domains/`](01-domains/) | Per-domain deep dives | Throughout |
| [`02-services/`](02-services/) | 24 per-service reference files | Days 1–8 |
| [`03-comparisons/`](03-comparisons/) | 10 head-to-head comparisons | Days 1–6 |
| [`04-architectures/`](04-architectures/) | 11 production patterns | Days 1–9 |
| [`05-labs/`](05-labs/) | 8 hands-on walkthroughs | Days 1–8 |
| [`06-practice/`](06-practice/) | Question banks + 2 mock exams | Daily + Day 9 |
| [`07-revision/`](07-revision/) | Spaced-repetition sheets | Days 1, 3, 5, 7, 9, 10 |
| [`08-interview/`](08-interview/) | Interview-level questions | After the exam |
| [`09-assets/`](09-assets/) | Diagrams and mind maps | Throughout |

---

## The master mental map

Every DEA-C01 question lives somewhere on this diagram. Locate **which
box** it's asking about first — that eliminates half the options before
you've thought about anything else.

```
   SOURCES              INGEST              STORE            PROCESS           SERVE
 ┌──────────┐      ┌──────────────┐    ┌──────────┐    ┌────────────┐   ┌────────────┐
 │ On-prem  │─────▶│ DMS (CDC)    │───▶│          │    │            │   │            │
 │ DBs      │      └──────────────┘    │          │    │ Glue ETL   │   │  Athena    │
 ├──────────┤      ┌──────────────┐    │          │    │ EMR/Spark  │   │  Redshift  │
 │ Apps/API │─────▶│ Kinesis DS   │───▶│    S3    │◀──▶│ Lambda     │──▶│  OpenSearch│
 │          │      │ Data Firehose│    │ (Parquet │    │ Managed    │   │  QuickSight│
 ├──────────┤      │ MSK          │    │  + Iceberg)   │  Flink     │   │            │
 │ IoT/Logs │─────▶│              │    │          │    │            │   │            │
 ├──────────┤      └──────────────┘    │          │    └────────────┘   └────────────┘
 │ Aurora / │─ ─ ─ ─ zero-ETL ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─▶ Redshift
 │ DynamoDB │
 └──────────┘
       ▲                    ▲                 ▲              ▲              ▲
       └────────────────────┴─────────────────┴──────────────┴──────────────┘
                                      │
       CATALOG: Glue Data Catalog   ORCHESTRATE: Step Functions / MWAA / EventBridge
       GOVERN:  Lake Formation      OBSERVE: CloudWatch / CloudTrail    SECURE: IAM / KMS
```

**Every arrow explained:**

- `Sources → DMS` — DMS is the only first-class answer for continuous
  replication out of a database you don't control. Full load seeds
  history; CDC keeps it current.
- `Sources → Kinesis / Firehose / MSK` — unbounded event streams. Which
  one you pick is the single most-tested decision on the exam.
- `Aurora / DynamoDB ⇢ Redshift (dashed)` — **zero-ETL**. No pipeline,
  no Glue job, no code. Whenever a question pairs "operational
  database" with "near real-time analytics" and "minimal operational
  overhead," this dashed line is the answer.
- `Ingest → S3` — S3 is the gravity well. Almost every pipeline lands
  here in Parquet, partitioned, often as an Iceberg table.
- `S3 ⇄ Process` — bidirectional, because transform jobs read raw and
  write curated back (bronze → silver → gold).
- `Process → Serve` — the last mile. Ad-hoc SQL → Athena. Dashboards
  and joins at concurrency → Redshift. Log search → OpenSearch. Visuals
  → QuickSight.
- `Catalog / Govern / Observe / Secure` sit **underneath** everything.
  They're not a stage, they're a cross-cutting layer. Domain 4 (18%)
  lives entirely here.

---

## Weak Topics Dashboard

Update at the end of every day. This decides what you review on Days 5,
8, and 10.

| Topic | Confidence (1–5) | Practice accuracy | Times reviewed | Last reviewed | Difficulty |
|---|---|---|---|---|---|
| _(fill in from Day 1)_ | | | | | |

---

## Exam-day facts

- **65 questions, 130 minutes** (~2 min/question)
- Scaled score 100–1000, **pass = 720** (roughly 70–75% correct)
- Scoring is **compensatory** — no per-domain minimum
- Domain weights: **34% / 26% / 22% / 18%**
- $150 USD + tax
- No penalty for wrong answers — **never leave a blank**
- Free +30 minutes if English is your second language (request **before** booking)
