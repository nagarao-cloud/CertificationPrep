# RUNBOOK.md — the discovered DEA-C01 structure and generation map

> This file is the Step-0 deliverable described in
> `_TEMPLATE/CLAUDE.md` §12: the concrete, this-exam-specific record of
> what the official exam guide actually defines, produced by reading
> that guide directly rather than assuming it looks like any other
> exam. It's the source of truth every generation batch in this folder
> was built against. If this exam guide revises again, re-run Step 0,
> diff the result against this file, and update both.

---

## 1. Source

- **Exam guide (current):** `docs.aws.amazon.com/aws-certification/latest/data-engineer-associate-01/data-engineer-associate-01.html`
- **Revisions page:** `docs.aws.amazon.com/aws-certification/latest/data-engineer-associate-01/dea-01-revisions.html`
- **Version at time of generation:** **1.1**, published **2025-12-12**
- **Fetched and verified:** 2026-08-09, via live `WebFetch` against both
  pages above — not from the user's pasted source material alone, which
  predated the v1.1 revision (see §4).

## 2. The discovered hierarchy

AWS's own numbering scheme for this exam is `domain.task.subskill`
(e.g. "Skill 2.4.6") — confirmed directly from the official revisions
page, which references skills by that exact notation. This is **AWS's
real numbering**, not a convention invented for this repo.

| Domain | Weight | Tasks | Sub-skills generated | Domain file |
|---|---|---|---|---|
| 1 — Data Ingestion and Transformation | 34% | 1.1–1.4 (4) | 1.1.1–1.4.11 (48) | `01-domains/DOMAIN-1-DATA-INGESTION.md` |
| 2 — Data Store Management | 26% | 2.1–2.4 (4) | 2.1.1–2.4.6 (26) | `01-domains/DOMAIN-2-DATA-STORE-MANAGEMENT.md` |
| 3 — Data Operations and Support | 22% | 3.1–3.4 (4) | 3.1.1–3.4.5 (30)* | `01-domains/DOMAIN-3-DATA-OPERATIONS.md` |
| 4 — Data Security and Governance | 18% | 4.1–4.5 (5) | 4.1.1–4.5.7 (29) | `01-domains/DOMAIN-4-DATA-SECURITY.md` |

\* Domain 3 carries 2 extra sub-skills (3.1.10 IaC-for-repeatable-deployment,
3.3.9 Macie) beyond what the original source material enumerated,
because the official skill list under 3.1 and 3.3 names them explicitly
even though the earlier source draft didn't break them out as their own
numbered items. When source material and the official guide disagree on
granularity, the official guide wins — that's the whole point of this
file existing.

**4 domains total, 34+26+22+18 = 100%, 65 questions split ≈22/17/14/12.**
This is specific to DEA-C01 — do not assume the next exam folder in this
repo also has 4 domains or this weighting. Re-run Step 0 for it.

### Task statements, verbatim from the guide

**Domain 1** — 1.1 Perform data ingestion · 1.2 Transform and process
data · 1.3 Orchestrate data pipelines · 1.4 Apply programming concepts

**Domain 2** — 2.1 Choose a data store · 2.2 Understand data cataloging
systems · 2.3 Manage the lifecycle of data · 2.4 Design data models and
schema evolution

**Domain 3** — 3.1 Automate data processing by using AWS services ·
3.2 Analyze data by using AWS services · 3.3 Maintain and monitor data
pipelines · 3.4 Ensure data quality

**Domain 4** — 4.1 Apply authentication mechanisms · 4.2 Apply
authorization mechanisms · 4.3 Ensure data encryption and masking ·
4.4 Prepare logs for audit · 4.5 Understand data privacy and governance

(Full knowledge/skills detail per task is in `EXAM-GUIDE.md` Parts 4–7
and in each domain file's own intro — not repeated here, this file is
the map, not the territory.)

## 3. Coverage map — which file covers which leaf

Every domain/task pair below has content in this repo. This is the
audit trail; if a future revision adds a new task or sub-skill, add its
row here and confirm it lands somewhere before considering the folder
complete again.

| Guide leaf | Primary coverage | Supporting coverage |
|---|---|---|
| 1.1 Perform data ingestion | `DOMAIN-1...md` §1.1 | `02-services/{Kinesis,MSK,DMS,EventBridge}.md`, `03-comparisons/Kinesis-vs-MSK.md`, `04-architectures/{CDC,Streaming-Pipeline}.md`, `05-labs/{LAB-05,LAB-06}.md` |
| 1.2 Transform and process data | `DOMAIN-1...md` §1.2 | `02-services/{Glue,EMR,Lambda,ManagedFlink,DataBrew}.md`, `03-comparisons/{Glue-vs-EMR,Glue-vs-Lambda}.md`, `05-labs/{LAB-02,LAB-07}.md` |
| 1.3 Orchestrate data pipelines | `DOMAIN-1...md` §1.3 | `02-services/{StepFunctions,EventBridge,MWAA}.md` |
| 1.4 Apply programming concepts | `DOMAIN-1...md` §1.4 | `00-START-HERE/{CHEAT-SHEETS,GLOSSARY}.md` |
| 2.1 Choose a data store | `DOMAIN-2...md` §2.1 | `02-services/{S3,Redshift,DynamoDB,Aurora}.md`, `03-comparisons/{S3-vs-EFS-vs-FSx,DynamoDB-vs-Aurora,Serverless-vs-Cluster}.md`, `04-architectures/{Data-Lake,Lakehouse}.md`, `05-labs/{LAB-01,LAB-04}.md` |
| 2.2 Understand data cataloging systems | `DOMAIN-2...md` §2.2 | `02-services/Glue.md` (Data Catalog + crawler sections) |
| 2.3 Manage the lifecycle of data | `DOMAIN-2...md` §2.3 | `02-services/S3.md` (lifecycle/versioning) |
| 2.4 Design data models and schema evolution | `DOMAIN-2...md` §2.4 | `03-comparisons/{Iceberg-vs-Hive,ZeroETL-vs-DMS-vs-Glue}.md`, `02-services/DMS.md` (DMS Schema Conversion) |
| 3.1 Automate data processing | `DOMAIN-3...md` §3.1 | `02-services/{StepFunctions,MWAA,Lambda,DataBrew,Athena}.md` |
| 3.2 Analyze data | `DOMAIN-3...md` §3.2 | `02-services/{QuickSight,Athena}.md` |
| 3.3 Maintain and monitor data pipelines | `DOMAIN-3...md` §3.3 | `02-services/{CloudWatch,CloudTrail,Macie,OpenSearch}.md`, `00-START-HERE/TROUBLESHOOTING.md`, `08-interview/Troubleshooting.md` |
| 3.4 Ensure data quality | `DOMAIN-3...md` §3.4 | `02-services/DataBrew.md` (Glue Data Quality/DQDL) |
| 4.1 Apply authentication mechanisms | `DOMAIN-4...md` §4.1 | `02-services/IAM.md` |
| 4.2 Apply authorization mechanisms | `DOMAIN-4...md` §4.2 | `02-services/Lake-Formation.md`, `00-START-HERE/SECURITY.md` |
| 4.3 Ensure data encryption and masking | `DOMAIN-4...md` §4.3 | `02-services/KMS.md` |
| 4.4 Prepare logs for audit | `DOMAIN-4...md` §4.4 | `02-services/{CloudTrail,CloudWatch}.md` |
| 4.5 Understand data privacy and governance | `DOMAIN-4...md` §4.5 | `02-services/{Macie,Lake-Formation}.md`, `04-architectures/{Banking,Healthcare}.md` |

Cross-cutting (not tied to one domain): `03-comparisons/Batch-vs-Streaming.md`,
`04-architectures/{Retail,Media,IoT,Batch-Pipeline,End-to-End-Architectures}.md`,
all of `06-practice/`, `07-revision/`, `08-interview/`.

## 4. Currency corrections (feeds `CLAUDE.md` §7)

Verified by diffing the official guide's **Change History** (v1.0 → v1.1,
2025-12-12) against the user's original source material, which predated
that revision:

**Removed from in-scope services:** AWS Schema Conversion Tool (SCT,
standalone product — folded into **DMS Schema Conversion**), AWS
CodeCommit, AWS Cloud9.

**Added to in-scope services:** Amazon Aurora, Amazon Q, Amazon Bedrock,
Amazon Kendra, AWS Data Exchange, **Amazon S3 Tables**.

**Removed from out-of-scope list** (i.e. these are being wound down by
AWS entirely, not "now fair game" — treat as recognize-only):
Amazon Timestream, Amazon Honeycode, Amazon WorkDocs, Amazon
CodeWhisperer.

**New skills added in v1.1** (all now covered in the relevant domain
file): 1.2.10 LLM integration for data processing · 2.1.7 Open table
formats (Iceberg) · 2.1.8 Vector index types (HNSW, IVF) · 2.2.6
Business data catalogs (SageMaker Catalog) · 2.4.6 Vectorization
concepts (Bedrock Knowledge Bases) · 4.1.7 SageMaker Unified Studio
domains/units/projects · 4.5.6 SageMaker Catalog project access · 4.5.7
Governance framework and data-sharing patterns.

## 5. Generation checklist (completed 2026-08-09)

| Folder | Files | Status |
|---|---|---|
| `00-START-HERE/` | 18 (incl. this file) | ✅ |
| `01-domains/` | 5 | ✅ |
| `02-services/` | 24 | ✅ |
| `03-comparisons/` | 10 | ✅ |
| `04-architectures/` | 11 | ✅ |
| `05-labs/` | 9 | ✅ |
| `06-practice/` | 9 | ✅ |
| `07-revision/` | 6 | ✅ |
| `08-interview/` | 4 | ✅ |

All 92 content files generated, cross-checked for internal consistency
(IAM policy evaluation order, Lake Formation vs. IAM boundary, Iceberg/
lakehouse conclusions), and swept for zero remaining placeholder
markers. See `CLAUDE.md` §5 for the line-count summary.

## 6. If this guide revises again

1. Re-fetch the revisions page. Diff its Change History table against
   §4 above.
2. Update §2's hierarchy if any domain/task/sub-skill was added,
   renamed, removed, or reweighted.
3. Update §4 with any newly in-/out-of-scope services.
4. Regenerate only the affected sub-skill sections in the relevant
   domain file(s) and any `02-services/` files for a changed service —
   not the whole folder. This is now a targeted update, not a bulk pass.
5. Update this file's §1 fetch date and §5 checklist, and bump the
   version note in `CLAUDE.md` §5.
