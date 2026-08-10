# AWS Glue DataBrew

> The "no-code for business analysts" tool that keeps showing up as a
> distractor and a correct answer in the same exam. DataBrew is a
> **visual data preparation** service — 250+ built-in transformations,
> point-and-click profiling, and reusable **recipes** — aimed at people
> who want to clean and explore data **without writing Spark/Python
> code**. This file covers what DataBrew actually is, when it wins over
> a hand-written Glue ETL script, and how it relates to (and differs
> from) **Glue Data Quality (DQDL)**, its more code/rules-oriented
> sibling.

## CONTENTS

- [1. Explain like I'm 12](#eli12)
- [2. Explain technically](#technical)
- [3. Explain like a Senior AWS Data Engineer](#senior)
- [4. Production architecture](#architecture)
- [5. Core concepts — datasets, projects, recipes, jobs](#coreconcepts)
- [6. Transformations and profiling jobs](#transformations)
- [7. DataBrew vs. a hand-written Glue ETL script](#vsgluescript)
- [8. DataBrew vs. Glue Data Quality (DQDL)](#vsdqdl)
- [9. Output formats and job outputs](#outputs)
- [10. When to use / when NOT to use](#whentouse)
- [11. Advantages and limitations](#advlim)
- [12. Pricing](#pricing)
- [13. Performance, scaling, and high availability](#perfscale)
- [14. Security](#security)
- [15. Failure scenarios and common mistakes](#failures)
- [16. Exam traps](#examtraps)
- [17. Interview questions](#interview)
- [18. Cheat sheet](#cheatsheet)
- [19. Memory tricks](#mnemonics)
- [20. Practice questions (15)](#practice)

---

<a name="eli12"></a>
## 1. Explain like I'm 12

Imagine you're handed a huge messy spreadsheet — some names are in ALL
CAPS, some phone numbers have dashes and some don't, some rows are
totally blank, and one column mixes dollar amounts with plain numbers.
A programmer would write code to fix all that. **AWS Glue DataBrew**
is like a magic spreadsheet app instead: you click on a messy column,
it *shows you* a menu of 250+ fixes ("remove blank rows," "make
everything uppercase," "split this column into two"), you click the
ones you want, and it remembers your clicks as a recipe card you can
reuse on the next messy spreadsheet — all without typing a single line
of code. It also automatically looks at your data and tells you things
like "23% of this column is empty" and "this column has 4 weird
outlier values," before you even ask.

<a name="technical"></a>
## 2. Explain technically

AWS Glue DataBrew is a **visual, no-code/low-code data preparation**
service built on the Glue family, aimed at data analysts and data
scientists rather than engineers. It operates on **datasets** pulled
from S3, the Glue Data Catalog, Redshift, RDS, or a snapshot upload,
and lets a user build a **recipe** — an ordered, reusable list of
**transformation steps** (250+ pre-built transforms: type conversion,
filtering, joins, pivots, PII handling, outlier detection, text/date/
number formatting) — interactively through a spreadsheet-like UI, with
live preview on a data sample. A **profiling job** runs statistical
analysis (completeness, distinct-value counts, correlation, data type
inference, PII detection hints, value distributions) over the full
dataset or a configurable sample, producing a visual data-quality
report. A **recipe job** applies a finished recipe to the full dataset
(not just the preview sample), executing under the hood on managed
Spark infrastructure — the user never sees or manages Spark, DPUs, or
cluster configuration directly.

<a name="senior"></a>
## 3. Explain like a Senior AWS Data Engineer

A senior engineer treats DataBrew as a **tool-selection question about
who is doing the work and why**, not a technical capability question.
DataBrew and a hand-written Glue ETL script (PySpark or Python Shell)
can both clean, join, filter, and reshape data — the deciding factor
is **who owns the transformation logic long-term**. If a business
analyst or data steward — someone who understands the *business*
meaning of "this column should never be negative" but doesn't write
Spark — needs to iterate quickly and visually, DataBrew is correct even
if an engineer *could* write the equivalent PySpark in an afternoon,
because the analyst can maintain it themselves afterward. The second
senior instinct: DataBrew shines specifically for **exploratory
profiling** — "I've just received a new data source and I don't yet
know its quality issues" — because the profiling job surfaces problems
before anyone writes a line of transformation logic. Third: a senior
engineer knows DataBrew recipes can be **exported as a Glue job**
(recipe steps convert into a runnable Glue ETL job), which is the
bridge pattern for "an analyst prototypes visually, an engineer
promotes it into the production pipeline" — a very common exam
scenario framing.

<a name="architecture"></a>
## 4. Production architecture

```
        ┌───────────────┐   ┌───────────────┐   ┌──────────────────┐
        │  S3 raw zone   │   │ Glue Data      │   │ Redshift / RDS    │
        │  (CSV/JSON)    │   │ Catalog table  │   │ table              │
        └───────┬───────┘   └───────┬───────┘   └─────────┬─────────┘
                │                   │                     │
                └───────────────────┼─────────────────────┘
                                    v
                        ┌─────────────────────────┐
                        │   DataBrew DATASET        │
                        │   (points at the source,   │
                        │    doesn't copy it yet)     │
                        └────────────┬────────────-┘
                                     │  analyst opens a PROJECT
                                     v
                        ┌─────────────────────────┐
                        │   PROFILING JOB            │
                        │   (data quality report:     │
                        │    completeness, distinct    │
                        │    values, PII hints,        │
                        │    correlations)              │
                        └────────────┬────────────-┘
                                     │  informs recipe design
                                     v
                        ┌─────────────────────────┐
                        │   RECIPE (reusable,        │
                        │   ordered transform steps) │
                        │   built via point-and-click │
                        └────────────┬────────────-┘
                                     │  run at scale
                                     v
                        ┌─────────────────────────┐
                        │   RECIPE JOB (managed       │
                        │   Spark under the hood)     │
                        └────────────┬────────────-┘
                                     v
                        ┌─────────────────────────┐
                        │   S3 curated zone            │
                        │   (Parquet/CSV/JSON/ORC/       │
                        │    Avro, optionally registered  │
                        │    back to the Glue Catalog)     │
                        └─────────────────────────┘
```

Reading the diagram: a **dataset** is a pointer to a source — S3, the
Glue Data Catalog, Redshift, or RDS — and does not copy data until a
job actually runs. Opening a **project** against that dataset launches
an interactive session where the analyst can optionally run a
**profiling job** first to understand data quality before touching
anything, then builds a **recipe** by clicking through transformation
steps with live preview on a sample. Once satisfied, a **recipe job**
applies every step to the full dataset on managed Spark compute the
analyst never configures, writing curated output to S3 (or back to a
database) in the analyst's chosen format — commonly Parquet, to feed
directly into Athena, Redshift Spectrum, or further Glue ETL downstream.

---

<a name="coreconcepts"></a>
## 5. Core concepts — datasets, projects, recipes, jobs

| Concept | What it is | Analogy |
|---|---|---|
| **Dataset** | A named pointer to a data source (S3 object/prefix, Glue Catalog table, Redshift/RDS table, or an uploaded file) | The "which spreadsheet" |
| **Project** | The interactive workspace where an analyst explores a dataset (on a sample, not the full dataset) and builds a recipe | The "workbench" |
| **Recipe** | An ordered, named, **reusable** list of transformation steps — independent of any one dataset, can be applied to other datasets later | The "saved macro" |
| **Recipe version** | Recipes are versioned; publishing a new version doesn't destroy the old one — jobs can pin to a specific version | Git-like history for a recipe |
| **Profiling job** | Runs statistical analysis over a dataset (full or sampled) and produces a visual data-quality report | The "health checkup" |
| **Recipe job** | Applies a published recipe to the **full** dataset at scale, writing output to a destination | The "batch run" |

⚠️ **Exam-relevant distinction:** interactive work inside a *project*
happens against a **sample** of the data (for responsiveness); only
a **recipe job** actually processes the full dataset. A question about
"the recipe worked fine in the project but the job output looks
different" is often pointing at sample-vs-full-dataset edge cases
(e.g., data the sample didn't happen to include).

<a name="transformations"></a>
## 6. Transformations and profiling jobs

DataBrew ships **250+ built-in transformations**, grouped roughly into:

| Category | Examples |
|---|---|
| **Structural** | Split/merge columns, pivot/unpivot, flatten nested JSON, filter rows, deduplicate |
| **Cleaning** | Fill/remove missing values, trim whitespace, standardize case, remove special characters |
| **Type & format** | Convert data types, reformat dates, parse currency/number formats |
| **PII handling** | Mask, replace, encrypt, or delete columns flagged as PII (redaction and tokenization-style recipe steps) |
| **Advanced** | Outlier detection and handling, custom formulas (spreadsheet-function-like expressions), joins/unions across datasets |
| **ML-powered** | Automatic PII/entity detection, schema inference, recommended transformations based on detected data shape |

**Profiling jobs** produce a report covering: row/column counts, data
type inference per column, completeness (% missing), uniqueness/
distinct-value counts, min/max/mean/median for numeric columns,
**value distribution histograms**, **correlation** between numeric
columns, and **PII hints** (flags columns that look like names, emails,
SSNs, etc. based on pattern matching). This report is the artifact a
data steward hands to an engineer to justify a cleaning/masking
requirement, and it is exactly what makes DataBrew the answer for
**"exploratory data profiling before anyone writes transformation
logic."**

<a name="vsgluescript"></a>
## 7. DataBrew vs. a hand-written Glue ETL script

| Dimension | **AWS Glue DataBrew** | **Glue ETL script (PySpark/Python Shell)** |
|---|---|---|
| Who writes it | Business analyst, data steward — **no code** | Data engineer — Python/Spark code |
| Interface | Visual, point-and-click, live preview on a sample | Script editor / notebook, code-first |
| Iteration speed | Fast for common cleaning patterns (250+ ready transforms) | Fast for anything the 250+ transforms don't cover — full programming flexibility |
| Custom/complex logic | Limited to built-in transforms + simple formulas | Unlimited — any Spark/Python logic |
| Reusability | Recipes (versioned, reusable across datasets) | Reusable scripts/modules, job bookmarks |
| Underlying compute | Managed Spark, fully hidden from the user | Spark (or Python Shell) — DPU/worker type explicitly configured |
| Version control / CI-CD fit | Weaker — recipes live in the DataBrew console/API | Strong — scripts are plain text, fit standard git workflows |
| Exam favorite trigger | "business analysts," "no-code," "visual data prep," "exploratory profiling" | "custom transformation logic," "complex joins across many sources," "engineer-owned production pipeline" |

⚠️ **Exam trap:** "a team of business analysts with no coding
background needs to clean and explore a new data source" is the
textbook DataBrew scenario. "A data engineering team needs a
production pipeline with complex, custom business logic and CI/CD"
points to a Glue ETL script — DataBrew is not the "more powerful"
option in that framing, it's simply the wrong tool for code-owned,
version-controlled production logic.

**Bridge pattern (a favorite scenario):** an analyst prototypes and
validates a cleaning recipe in DataBrew, then the recipe is
**exported/promoted into a Glue ETL job** so an engineer can fold it
into a larger, version-controlled production pipeline — this is the
correct answer whenever a scenario describes "an analyst builds it,
engineering productionizes it."

<a name="vsdqdl"></a>
## 8. DataBrew vs. Glue Data Quality (DQDL)

Both live under the "Glue family" umbrella and both can flag/act on
data problems, but they solve **different problems** and are graded on
**different axes** on this exam.

| Dimension | **AWS Glue DataBrew** | **Glue Data Quality (DQDL)** |
|---|---|---|
| Core purpose | **Prepare/transform** data — clean, reshape, mask, join | **Validate/enforce** data quality rules against a defined standard |
| Interface | Visual, point-and-click | **DQDL** — a declarative, code-like rule language (`Rules = [ ColumnCount = 5, IsComplete "id", ColumnValues "amount" > 0 ]`) |
| Output | A transformed dataset (curated data) | A **pass/fail result set** per rule, plus a data quality score |
| Who typically owns it | Business analyst / data steward | Data engineer — rules are code, checked into version control |
| Where it runs | DataBrew recipe/profiling jobs | Inside a **Glue ETL job** (as a data quality transform node) or as a standalone Glue Data Quality ruleset evaluation |
| Best fit | "Clean and reshape this messy source before it's usable" | "Enforce that this pipeline never lets bad data (nulls in a required field, negative amounts, out-of-range values) reach the curated zone" |
| Relationship | The more exploratory, business-facing, **code-light** sibling | The more rules-based, engineer-facing, **code-like** sibling |
| Exam favorite trigger | "no-code," "visual," "business analyst," "profiling/exploration" | "enforce a rule," "block bad records from loading," "data quality score/threshold," "DQDL" |

**Senior framing:** DataBrew answers *"how do I fix this data"* (a
transformation problem). Glue Data Quality answers *"how do I stop bad
data from ever reaching production"* (a validation/gatekeeping
problem). They frequently sit **back-to-back** in a real pipeline —
DataBrew (or a Glue ETL job) cleans the data, and a Glue Data Quality
ruleset gates whether the cleaned output is allowed to proceed
downstream. Picking one when the scenario clearly wants the other's
job (e.g., choosing DataBrew to "enforce that a column can never be
null in production," which is a DQDL rule-enforcement job, not a
one-time cleaning job) is a common wrong-answer pattern.

<a name="outputs"></a>
## 9. Output formats and job outputs

Recipe jobs can write output as **CSV, JSON, Parquet, ORC, Avro, or
XLSX**, to **S3** (most common), or directly back to a **JDBC
target** (Redshift, RDS) or the **Glue Data Catalog** (registering the
output as a queryable table for Athena/Redshift Spectrum). Multiple
output formats/destinations can be configured from a single recipe
job run. For analytics-facing curated output, **Parquet** is the
typical choice — same reasoning as any other Glue/Athena/Redshift
Spectrum pipeline: columnar, compressed, partition-friendly.

---

<a name="whentouse"></a>
## 10. When to use / when NOT to use

**Use DataBrew when:** business analysts or data stewards (not
engineers) need to explore, clean, or reshape data without writing
code; you need fast, visual **exploratory profiling** of a newly
received data source before building anything downstream; you need to
apply common, well-known cleaning patterns (dedupe, type conversion,
PII masking, missing-value handling) without custom logic; you want a
prototyping step that later exports into a Glue ETL job.

**Do NOT use DataBrew when:** the transformation logic is complex,
custom, or requires arbitrary code (joins across many sources with
conditional business logic, iterative/recursive processing) — a Glue
ETL script fits better; the requirement is to **enforce** ongoing data
quality rules in a production pipeline with pass/fail gating — that's
Glue Data Quality (DQDL); you need tight CI/CD, code review, and git
version control over the transformation logic itself — recipes are
weaker for that workflow than plain scripts; near-real-time/streaming
transformation is required — DataBrew is a **batch** tool.

<a name="advlim"></a>
## 11. Advantages and limitations

**Advantages:** no code required; 250+ ready-made transformations;
live preview on a sample speeds iteration; built-in profiling surfaces
data quality issues before any cleaning logic is written; recipes are
reusable and versioned; managed Spark under the hood means no cluster
management; PII detection and masking are built in as recipe steps;
recipes can be exported to a Glue ETL job for productionization.

**Limitations:** limited to the built-in transform library plus simple
formulas — no arbitrary custom code; interactive project work operates
on a **sample**, not the full dataset, which can hide edge cases;
batch-only, not suited to streaming; less natural fit for strict
CI/CD/version-control workflows than a script-based Glue job;
performance and scale tuning (worker count, DPUs) is largely hidden
from the user, which is convenient but offers less manual control than
a hand-tuned Glue ETL job.

<a name="pricing"></a>
## 12. Pricing

DataBrew bills **per session** for interactive project work (a
session is a bounded period of interactive use) and **per node-hour**
for recipe/profiling **jobs** run at scale — there is no separate
charge for the transformations or recipes themselves, and no
infrastructure to provision or pay for when idle. This makes DataBrew
attractive for intermittent, analyst-driven work compared to standing
up and maintaining dedicated Spark infrastructure.

<a name="perfscale"></a>
## 13. Performance, scaling, and high availability

DataBrew jobs run on **managed Spark infrastructure** that scales
automatically to the size of the dataset — the user never selects
worker types or DPU counts the way they would for a hand-written Glue
ETL job. Interactive project sessions use a **sampled** subset of the
data (configurable sample size/strategy) so the UI stays responsive
even against very large datasets; the full dataset is only processed
when a recipe or profiling **job** actually runs. As a fully managed
service, there is no cluster to fail over — job retries and scaling
are handled by the service.

<a name="security"></a>
## 14. Security

DataBrew integrates with standard AWS security controls: **IAM roles**
scope what a DataBrew job/project can read and write (source S3
buckets, Catalog databases, Redshift/RDS connections); data at rest in
S3 is protected by the bucket's own SSE-S3/SSE-KMS configuration, and
DataBrew respects KMS key permissions like any other Glue-family
service; **PII-handling transforms** (masking, redaction) operate
within a recipe and can be combined with **Lake Formation** grants on
the resulting curated table to further restrict who can see the
un-redacted (or redacted) output. DataBrew itself does not replace
column-level governance — Lake Formation still governs who can query
the *output* table.

<a name="failures"></a>
## 15. Failure scenarios and common mistakes

- **Validating a recipe against the interactive sample only, then
  discovering edge cases in the full dataset** — a value or format
  present in the untouched 95% of rows but absent from the sample
  breaks a transformation step that "worked fine" in the project.
- **Using DataBrew for a requirement that's really about ongoing
  enforcement** ("this column must never be null going forward") —
  that is Glue Data Quality's job, not a one-time DataBrew recipe run.
- **Treating DataBrew as a substitute for a data engineer's production
  pipeline** when the transformation logic is genuinely complex or
  needs strict version control — this creates an unmaintainable,
  analyst-owned "shadow ETL" pipeline in a production data flow.
- **Forgetting to export/promote a validated recipe into a Glue ETL
  job** when the workload needs to become a scheduled, orchestrated,
  production pipeline component rather than a one-off manual run.
- **Not scoping a profiling job's sample/target appropriately** on a
  very large dataset, leading to longer-than-expected job run time and
  cost for a task that was meant to be a quick exploratory check.

<a name="examtraps"></a>
## 16. Exam traps

⚠️ **"No-code," "visual," "business analyst" = DataBrew.** Don't
pick a Glue ETL script answer when the stem explicitly says the person
doing the work has no coding background.

⚠️ **"Enforce a data quality rule" / "block bad records" / DQDL
syntax mentioned = Glue Data Quality, not DataBrew.** DataBrew cleans
and reshapes; it does not gate a pipeline on pass/fail rule
evaluation the way DQDL does.

⚠️ **Interactive project work is on a SAMPLE, not the full dataset.**
A question about a recipe behaving differently between the project
preview and the full job run is testing this distinction.

⚠️ **DataBrew is batch, not streaming.** A requirement for real-time
transformation should point to Amazon Managed Service for Apache
Flink, Lambda, or Glue Streaming ETL, not DataBrew.

⚠️ **DataBrew recipes can be exported into a Glue ETL job.** This is
the "analyst prototypes, engineer productionizes" bridge — know it as
an explicit capability, not just a vague notion of "they're related."

<a name="interview"></a>
## 17. Interview questions

- *"When would you recommend DataBrew over having an engineer write a
  Glue ETL script?"* Strong answer: when the person doing the work is
  a business analyst without coding skills, the transformations needed
  are common patterns already covered by the 250+ built-in transforms,
  and speed of iteration matters more than deep customization or strict
  CI/CD ownership of the logic.
- *"How do DataBrew and Glue Data Quality complement each other in a
  pipeline?"* Strong answer: DataBrew (or a Glue ETL job) prepares and
  cleans the data; Glue Data Quality then validates the output against
  declarative DQDL rules before it's allowed to proceed downstream —
  one transforms, the other gates.
- *"A business team built a DataBrew recipe that's now core to a daily
  production pipeline. What would you do?"* Strong answer: evaluate
  exporting the recipe into a version-controlled Glue ETL job owned by
  engineering, so it gets proper CI/CD, testing, and on-call ownership
  rather than remaining a manually-triggered analyst artifact.

<a name="cheatsheet"></a>
## 18. Cheat sheet

| If the scenario says... | Reach for... |
|---|---|
| business analyst, no coding background | DataBrew |
| visual, point-and-click data cleaning | DataBrew |
| explore/profile a brand-new data source first | DataBrew profiling job |
| 250+ ready-made transformations, reusable recipe | DataBrew |
| custom/complex transformation logic, engineer-owned | Glue ETL script |
| enforce a rule, block bad records, data quality score | Glue Data Quality (DQDL) |
| analyst prototypes, engineering productionizes | Export DataBrew recipe → Glue ETL job |
| real-time/streaming transformation | Not DataBrew (Flink / Glue Streaming / Lambda) |
| mask/redact PII visually as a transform step | DataBrew PII transforms |

<a name="mnemonics"></a>
## 19. Memory tricks

**"Brew cleans, DQDL judges."** DataBrew transforms/cleans data;
Glue Data Quality validates/enforces rules against it. **"No code,
no problem"** — DataBrew's entire value proposition in four words.
**"Sample in the project, full in the job"** — the interactive-vs-job
data-scope distinction that trips people up.

---

<a name="practice"></a>
## 20. Practice questions (15)

**Q1.** A team of business analysts with no programming experience
needs to explore and clean a newly received CSV dataset before it's
loaded into a data warehouse. Which service is the best fit?

A) AWS Glue ETL script (PySpark)
B) AWS Glue DataBrew
C) Amazon EMR with a custom Spark job
D) AWS Lambda with a Python script

**Answer: B.** DataBrew is purpose-built for non-coding analysts to
visually explore and clean data. (A), (C), and (D) all require
programming skills the team doesn't have.

**Q2.** A data engineer needs to enforce that a specific column can
never contain null values before data is allowed to load into the
curated zone, as an ongoing pipeline rule. What should they use?

A) AWS Glue DataBrew profiling job
B) AWS Glue Data Quality (DQDL) rule
C) Amazon Macie
D) A DataBrew recipe with a "remove nulls" transform

**Answer: B.** Enforcing an ongoing pass/fail rule is exactly what
Glue Data Quality/DQDL is for. (A) profiling reports on data quality
but doesn't enforce/block anything. (C) Macie detects sensitive data,
unrelated to null enforcement. (D) a DataBrew transform removes or
fills nulls once during a specific job run — it isn't an ongoing
enforcement gate for a production pipeline.

**Q3.** What is the primary purpose of a DataBrew profiling job?

A) To transform data and write curated output
B) To statistically analyze a dataset and produce a data-quality report (completeness, distinct values, correlations, PII hints)
C) To enforce declarative data quality rules
D) To convert a recipe into a Glue ETL script

**Answer: B.** Profiling jobs analyze and report on data quality; they
don't transform or enforce anything. (A) describes a recipe job. (C)
describes Glue Data Quality. (D) describes recipe export, a separate
capability.

**Q4.** In DataBrew, interactive work inside a project is performed
against what?

A) The full dataset, always
B) A configurable sample of the dataset
C) Only the first 10 rows, non-configurable
D) A cached copy in DynamoDB

**Answer: B.** Project interactivity uses a sample for responsiveness;
only a recipe/profiling job processes the full dataset. (A) is
incorrect — that's what makes preview fast. (C) overstates a fixed,
non-configurable limit. (D) DataBrew doesn't cache samples in
DynamoDB.

**Q5.** Which best describes the relationship between AWS Glue
DataBrew and Glue Data Quality (DQDL)?

A) They are the same service with different names
B) DataBrew prepares/transforms data; Glue Data Quality validates data against declarative rules — they are complementary, not interchangeable
C) DQDL is a transformation language used only inside DataBrew recipes
D) DataBrew replaced Glue Data Quality and DQDL is deprecated

**Answer: B.** This is the core distinction the exam tests: one
transforms, the other enforces/validates. (A), (C), and (D) all
misstate the relationship — both services are current, distinct, and
often used together in the same pipeline.

**Q6.** A validated DataBrew recipe needs to become part of a
version-controlled, engineer-owned production pipeline with CI/CD.
What is the recommended path?

A) Keep running the DataBrew recipe job manually forever
B) Export/promote the recipe into a Glue ETL job
C) Rebuild the entire logic from scratch in Amazon Macie
D) Migrate the recipe into IAM policy conditions

**Answer: B.** DataBrew recipes can be exported into a Glue ETL job,
the standard bridge from analyst prototyping to engineer-owned
production code. (A) doesn't provide CI/CD or version control. (C)
Macie is unrelated to transformation logic. (D) is nonsensical — IAM
policies don't hold transformation logic.

**Q7.** Which output format is typically preferred for DataBrew recipe
job output that will be queried by Athena and Redshift Spectrum?

A) XLSX
B) Parquet
C) Plain text
D) BSON

**Answer: B.** Parquet's columnar, compressed format is the standard
choice for analytics engines like Athena and Redshift Spectrum. (A)
XLSX is a spreadsheet format, not suited for large-scale analytical
querying. (C) plain text lacks schema/columnar benefits. (D) BSON
isn't a DataBrew output option and isn't the analytics-standard format
here.

**Q8.** Which of the following is NOT a capability of AWS Glue
DataBrew?

A) Detecting and masking PII columns via built-in transforms
B) Producing a statistical profiling report on a dataset
C) Real-time, sub-second stream processing of continuously arriving events
D) Applying a reusable, versioned recipe to a full dataset via a job

**Answer: C.** DataBrew is a batch data preparation tool, not a
streaming engine. (A), (B), and (D) are all genuine DataBrew
capabilities.

**Q9.** A data steward runs a DataBrew profiling job on a newly
onboarded S3 dataset and finds 40% of a column named `customer_email`
is missing. What is the most appropriate immediate next step?

A) Immediately delete the column from the source data
B) Use the profiling insight to inform a recipe (e.g., filter, flag, or fill missing values) or escalate to the data owner about a possible upstream ingestion issue
C) Run a Glue crawler to fix the missing values automatically
D) Enable S3 Object Lock on the bucket

**Answer: B.** Profiling findings should inform either a cleaning
recipe decision or an upstream data-quality investigation — that's the
whole point of running the profile first. (A) is destructive and
premature without understanding the cause. (C) a crawler infers
schema/metadata; it does not fix data values. (D) Object Lock is a
retention/WORM feature, unrelated to missing values.

**Q10.** Which statement correctly distinguishes DataBrew from a
hand-written Glue ETL PySpark script?

A) DataBrew requires more Spark tuning expertise than a hand-written script
B) DataBrew is limited to built-in transforms and simple formulas, while a PySpark script supports arbitrary custom logic
C) A PySpark script cannot write to S3, only DataBrew can
D) DataBrew and PySpark scripts produce fundamentally different, incompatible output file formats

**Answer: B.** This is the core capability trade-off: DataBrew trades
custom-code flexibility for a no-code, ready-made transform library.
(A) is backwards — DataBrew hides Spark tuning entirely, the opposite
of requiring more expertise. (C) is false — Glue ETL scripts commonly
write to S3. (D) is false — both can produce standard formats like
Parquet, CSV, JSON.

**Q11.** Which DataBrew concept refers to an ordered, reusable,
versioned list of transformation steps that is independent of any one
specific dataset?

A) Project
B) Recipe
C) Profiling job
D) Connection

**Answer: B.** A recipe is the reusable, versioned transformation
definition that can be applied to multiple datasets. (A) a project is
the interactive workspace tied to exploring one dataset. (C) a
profiling job analyzes, it doesn't hold transformation steps. (D) a
connection is a data-source access configuration concept, not a
transform sequence.

**Q12.** A company wants to know, before writing any cleaning logic,
which columns in a newly acquired dataset contain likely PII and how
complete each column is. Which DataBrew feature addresses this most
directly?

A) A recipe job with masking transforms already applied
B) A profiling job
C) Exporting the dataset to Glue Data Quality
D) Enabling S3 Object Lock

**Answer: B.** Profiling jobs are specifically for pre-cleaning
statistical analysis, including PII hints and completeness metrics.
(A) a recipe job applies cleaning after decisions are made, not before
exploration. (C) Glue Data Quality validates against defined rules, it
doesn't perform exploratory profiling of an unfamiliar dataset. (D)
Object Lock is unrelated to profiling.

**Q13.** Which pricing model applies to AWS Glue DataBrew?

A) A flat monthly subscription regardless of usage
B) Billed per interactive session for project work, and per node-hour for recipe/profiling jobs
C) Billed only by the number of transformations applied
D) Free for unlimited use, monetized only through AWS Marketplace add-ons

**Answer: B.** DataBrew's billing is usage-based: interactive sessions
and job compute time, with no charge for the transformations/recipes
themselves and no standing infrastructure cost. (A), (C), and (D) all
misstate the actual pricing model.

**Q14.** A scenario describes a data pipeline where cleaned data must
never proceed downstream if more than 2% of rows fail a defined set of
validation rules, and the rules must be expressed in a declarative,
version-controlled format. Which combination best fits?

A) DataBrew alone, using its built-in transforms as the enforcement mechanism
B) A cleaning step (DataBrew or Glue ETL) followed by a Glue Data Quality ruleset (DQDL) that gates downstream flow based on a quality threshold
C) Amazon Macie configured with a custom threshold rule
D) A Redshift materialized view with a WHERE clause

**Answer: B.** This is the textbook "prepare then gate" pattern:
cleaning happens first (DataBrew or Glue ETL), then Glue Data Quality
enforces the declarative, version-controllable pass/fail threshold
that blocks downstream flow. (A) DataBrew alone has no rule-based
gating/enforcement mechanism. (C) Macie is for sensitive-data
discovery, not general data quality rule enforcement. (D) a
materialized view doesn't gate a pipeline's flow based on a quality
threshold.

**Q15.** Which statement about DataBrew's underlying compute is
accurate?

A) The user must select and configure Spark worker types and DPU counts explicitly, identical to a Glue ETL job
B) DataBrew runs on managed Spark infrastructure that is scaled and configured automatically, hidden from the user
C) DataBrew requires a persistently running EMR cluster provisioned by the user
D) DataBrew jobs run exclusively on AWS Lambda

**Answer: B.** DataBrew abstracts away Spark configuration entirely —
the user works visually and the service manages scaling. (A)
describes Glue ETL's more manual configuration model, not DataBrew's.
(C) DataBrew requires no user-provisioned cluster. (D) DataBrew jobs
do not run on Lambda; they run on managed Spark infrastructure.
