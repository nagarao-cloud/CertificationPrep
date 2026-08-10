# AWS Glue

> The serverless ETL and cataloging backbone of DEA-C01. If a question
> mentions "serverless ETL," "job bookmarks," "data catalog," "crawler,"
> or "data quality rules," Glue is almost always the answer. This file
> covers Glue ETL (DynamicFrames vs DataFrames), job bookmarks, worker
> types/DPUs, Glue Studio, Glue Flex, Glue Streaming, the Data Catalog +
> crawlers, Glue Data Quality (DQDL), Glue Schema Registry, and Glue
> workflows/triggers.

## CONTENTS

- [1. Explain like I'm 12](#eli12)
- [2. Explain technically](#technical)
- [3. Explain like a Senior AWS Data Engineer](#senior)
- [4. Production architecture](#architecture)
- [5. DynamicFrames vs DataFrames](#frames)
- [6. Job bookmarks](#bookmarks)
- [7. Worker types and DPUs](#workers)
- [8. Glue Studio](#studio)
- [9. Glue Flex](#flex)
- [10. Glue Streaming ETL](#streaming)
- [11. Glue Data Catalog and crawlers](#catalog)
- [12. Glue Data Quality (DQDL)](#dq)
- [13. Glue Schema Registry](#schemaregistry)
- [14. Glue workflows and triggers](#workflows)
- [15. When to use / when NOT to use](#whentouse)
- [16. Advantages and limitations](#advlim)
- [17. Pricing](#pricing)
- [18. Performance, scaling, and high availability](#perfscale)
- [19. Security](#security)
- [20. Failure scenarios and common mistakes](#failures)
- [21. Exam traps](#examtraps)
- [22. Interview questions](#interview)
- [23. Cheat sheet](#cheatsheet)
- [24. Memory tricks](#mnemonics)
- [25. Practice questions (15)](#practice)

---

<a name="eli12"></a>
## 1. Explain like I'm 12

Imagine you have a giant pile of mismatched LEGO bricks from ten
different sets, and you need to sort them into neat matching boxes —
without buying a sorting machine, plugging it in, or maintaining it
yourself. You just say "sort these, using these rules," and it happens,
then the machine turns itself off so you don't pay for it while it's
idle. That's AWS Glue: serverless ETL (Extract, Transform, Load) that
reads messy data, cleans and reshapes it, and writes it back out — and
Glue also keeps a **card catalog** (the Data Catalog) so every other
tool in the library (Athena, Redshift, EMR) knows what boxes exist and
what's inside them without you re-explaining it every time.

<a name="technical"></a>
## 2. Explain technically

AWS Glue is a serverless data integration service built on Apache Spark
(for ETL jobs) and Python shell (for lightweight scripts), paired with
a persistent, Hive-metastore-compatible **Data Catalog** that stores
table definitions (schema, location, partitions, format) used by Glue
jobs themselves and by Athena, Redshift Spectrum, EMR, and third-party
engines. Glue eliminates cluster provisioning: you specify a number of
**workers** and a **worker type**, submit a job, and AWS handles the
underlying Spark cluster lifecycle — spin-up, execution, teardown. Glue
also ships **crawlers** (infer schema from S3/JDBC sources and populate
the catalog), **Glue Data Quality** (declarative rule evaluation via
DQDL), **Glue Schema Registry** (centralized schema versioning and
compatibility enforcement for streaming producers/consumers), and
**Glue Studio** (a visual, no-code/low-code job authoring canvas).

<a name="senior"></a>
## 3. Explain like a Senior AWS Data Engineer

A senior engineer picks Glue as the "serverless-first" default for ETL
and reaches for EMR only when a scenario specifically demands something
Glue doesn't do well — custom Spark tuning at extreme scale, non-Spark
frameworks (Hive, Presto, HBase), or a bring-your-own-cluster-lifecycle
requirement. The senior-level nuance the exam rewards is **DynamicFrame
vs DataFrame** as a *deliberate* choice, not a default: DynamicFrames
handle schema inconsistency gracefully (mismatched or evolving fields
across files) at some performance cost, while DataFrames are faster and
more Spark-idiomatic but assume a fixed, known schema and will error or
silently mis-cast on drift. A second senior-level habit: **treat job
bookmarks as a correctness feature, not just a convenience** — without
them, a scheduled incremental job silently reprocesses (and potentially
double-counts) previously seen data, which is a data-quality incident
waiting to happen, not merely wasted compute. Third: choosing **Glue
Flex** for non-urgent batch jobs (nightly/weekly aggregations with no
tight SLA) is a real cost lever many teams miss — it can cut compute
cost meaningfully in exchange for a less-guaranteed start time, and the
exam expects you to recognize "not time-sensitive" as the trigger phrase
for it.

<a name="architecture"></a>
## 4. Production architecture

```
        ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
        │  S3 raw zone │     │  JDBC (RDS)  │     │ Kinesis / MSK│
        └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
               │                    │                    │
               v                    v                    v
        ┌────────────────────────────────────────────────────────┐
        │                     GLUE CRAWLER(S)                      │
        │   infers schema, registers/updates tables in the         │
        │              GLUE DATA CATALOG                           │
        └───────────────────────┬────────────────────────────────-┘
                                 │  jobs read catalog table defs
                                 v
        ┌────────────────────────────────────────────────────────┐
        │                  GLUE ETL JOB (Spark)                    │
        │  DynamicFrame read → transforms (map, join, filter,      │
        │  Relationalize) → Glue Data Quality ruleset evaluation → │
        │  DynamicFrame/DataFrame write                            │
        │  Job bookmark tracks processed state between runs        │
        └───────────────────────┬────────────────────────────────-┘
                                 │  writes
                                 v
        ┌────────────────────────────────────────────────────────┐
        │              S3 curated/silver zone (Parquet)             │
        │              Catalog updated with new partitions          │
        └───────────────────────┬────────────────────────────────-┘
                                 │  triggers next step
                                 v
              GLUE WORKFLOW (chains crawler → job → job,
              triggered on schedule or on completion of prior step)
```

Reading the diagram: raw sources (S3, JDBC, streaming) are first made
queryable by a **crawler**, which infers schema and writes/updates table
definitions in the **Data Catalog** — this catalog is the shared
metadata layer every downstream tool reads. A **Glue ETL job** then
reads catalog-registered tables as DynamicFrames, applies
transformations, optionally validates the result against a **Glue Data
Quality** ruleset, and writes curated output back to S3 — with the
**job bookmark** recording exactly which source data was already
processed so the next scheduled run only picks up new records. The
catalog is updated with new partitions on write. A **Glue workflow**
wraps the whole sequence (crawler → job → job) with triggers, so the
pipeline runs end-to-end on a schedule or in response to the prior
step's completion, with dependency management and failure handling
built in.

---

<a name="frames"></a>
## 5. DynamicFrames vs DataFrames

| | DynamicFrame (Glue-native) | DataFrame (Spark-native) |
|---|---|---|
| Schema handling | Flexible — tolerates missing/extra/mismatched-type fields per record via a `choice` type | Fixed, inferred or explicit schema; mismatches error or silently mis-cast |
| Performance | Some overhead from per-record schema flexibility | Faster — standard Spark execution |
| Best for | Semi-structured or evolving-schema sources (JSON logs, nested/irregular data) | Well-defined, stable schemas; heavy Spark-native transformation logic |
| Special operations | `Relationalize` (flatten nested JSON into relational tables), `ResolveChoice` (resolve schema ambiguity) | Standard Spark SQL/DataFrame API |
| Catalog integration | Native — reads/writes directly against Glue Data Catalog tables | Requires conversion (`toDF()` / `fromDF()`) to interoperate with DynamicFrame-based catalog I/O |
| Typical pattern | Read with DynamicFrame → `.toDF()` to DataFrame for complex transforms → `.fromDF()` back for catalog-aware write | — |

⚠️ **Exam trap:** "semi-structured source with an evolving or
inconsistent schema" points to DynamicFrame; "need maximum Spark
transformation performance on a known, stable schema" points to
DataFrame (or converting early). Picking DataFrame for a genuinely messy
source is a common wrong answer because it looks "more standard."

<a name="bookmarks"></a>
## 6. Job bookmarks

Job bookmarks let a Glue job track which S3 objects or JDBC rows (by a
monotonically increasing/timestamp column) were already processed, so a
rerun only processes new data — the mechanism that turns a Glue job into
a safe, idempotent **incremental** pipeline instead of reprocessing the
full source every run. Bookmarks are enabled per job (`--job-bookmark-
option job-bookmark-enable`) and persist state keyed to the job name;
**resetting** a bookmark (via console/API or `job-bookmark-disable` for
one run) forces a full reprocess — deliberately used for backfills or
after fixing an upstream bug. For JDBC sources, bookmarks require a
monotonically increasing column to track progress; for S3, bookmarks
track object modification time and path.

⚠️ **Exam trap:** "the same records are being processed and written
multiple times / metrics are inflated" on a scheduled Glue job is the
signature symptom of a **disabled or never-configured job bookmark** —
not a job-scheduling problem.

<a name="workers"></a>
## 7. Worker types and DPUs

| Worker type | vCPU | Memory | Disk | Typical use |
|---|---|---|---|---|
| **G.1X** | 4 | 16 GB | 64 GB | Standard ETL, memory-intensive jobs, most workloads |
| **G.2X** | 8 | 32 GB | 128 GB | Larger transforms, ML transforms, memory-intensive joins |
| **G.4X** | 16 | 64 GB | 256 GB | Very large-memory workloads |
| **G.8X** | 32 | 128 GB | 512 GB | Largest single-worker memory footprint Glue offers |
| **G.025X** | fractional | fractional | — | Glue Flex-eligible small/dev/test jobs, lowest cost per DPU |
| **Standard** (legacy) | — | — | — | Older default before G.1X/G.2X became standard recommendation |

A **DPU** (Data Processing Unit) is Glue's billing/capacity unit;
larger worker types consume more DPUs per worker, and cost scales with
`(number of workers) x (DPU per worker) x (duration)`. Glue
auto-scaling (within a job run) can adjust the number of workers up to
the configured maximum based on the Spark execution's actual parallelism
needs, avoiding both over-provisioning idle workers and under-
provisioning a data-skewed stage.

<a name="studio"></a>
## 8. Glue Studio

A visual, drag-and-drop canvas for building ETL jobs (source → transform
nodes → target) that generates the underlying PySpark script, viewable
and editable. Useful for teams that want a lower barrier to entry than
hand-written Spark, for quickly prototyping a pipeline, or for
documentation-by-diagram of what a job does. It also provides a visual
job-run monitoring dashboard (metrics, logs, DPU usage per run) even for
jobs not originally authored in the visual canvas.

<a name="flex"></a>
## 9. Glue Flex

An execution class for Glue jobs (and Glue for Ray/Spark) that runs on
spare compute capacity at a lower price than standard execution, in
exchange for a less predictable start time (jobs may wait longer to
start, and total runtime can vary more). It's explicitly designed for
**non-time-critical** batch jobs — nightly aggregation, weekly reports,
backfills — where "cheaper, sometimes slower to start" beats "guaranteed
prompt start, full price." It is not appropriate for jobs with a tight
SLA or that are part of a time-sensitive pipeline chain.

⚠️ **Exam trap:** "reduce ETL cost for a job with no strict time
requirement" is the Glue Flex trigger phrase. If the scenario adds "must
complete within X minutes" or is part of a real-time pipeline, Flex is
disqualified — use standard execution.

<a name="streaming"></a>
## 10. Glue Streaming ETL

Glue can run **streaming ETL jobs** — Spark Structured Streaming jobs
that continuously consume from Kinesis Data Streams or Amazon MSK,
apply micro-batch transformations (windowing, aggregation, enrichment,
schema application), and write continuously to S3, a data warehouse, or
another downstream store. It fills the "I have a stream but want
Spark-style transformation logic and Glue's serverless operational model
rather than standing up a Managed Flink application" niche — appropriate
when the transformation logic is naturally batch-of-micro-batches rather
than true low-latency stream processing (Managed Service for Apache
Flink is the answer when sub-second/true event-at-a-time processing is
required).

<a name="catalog"></a>
## 11. Glue Data Catalog and crawlers

The **Data Catalog** is a persistent, Hive-metastore-compatible metadata
store — one catalog per account per Region by default — holding
databases, tables, partitions, and schema versions. It's the metadata
layer Athena, Redshift Spectrum, EMR (via the Glue Catalog connector),
and Glue jobs all read, which is what lets you define a table's schema
once and query it consistently from multiple engines without
re-declaring it.

A **crawler** connects to a data store (S3, JDBC, DynamoDB), infers
schema (and detects partition structure from S3 key patterns like
`year=2026/month=08/`), and creates or updates catalog table
definitions — including detecting schema drift on rerun and optionally
versioning schema changes. Crawlers can be scheduled or triggered as
part of a workflow.

⚠️ **Exam trap:** running a crawler on every single job execution "just
to be safe" is often an anti-pattern the exam flags as unnecessary cost
and latency — if the schema is stable and partitions are added
predictably, updating the catalog directly from the Glue job
(`enableUpdateCatalog`) or via a scheduled (not every-run) crawler is
the leaner answer.

<a name="dq"></a>
## 12. Glue Data Quality (DQDL)

Glue Data Quality evaluates datasets against declarative rules written
in **DQDL** (Data Quality Definition Language), either authored manually
or recommended automatically by Glue's rule-recommendation feature
based on profiling the data. Rules run as part of a Glue job or a
standalone Data Quality evaluation, produce a **data quality score**,
and can be configured to **fail the job** (halt the pipeline) or just
**log/alert** when thresholds aren't met — a common pattern is to fail
loudly on critical rules (e.g., primary key uniqueness) and only warn on
soft rules (e.g., a completeness threshold on an optional field).

Example DQDL ruleset:

```
Rules = [
    RowCount > 1000,
    IsComplete "order_id",
    IsUnique "order_id",
    IsComplete "customer_id",
    ColumnValues "order_status" in ["PENDING","SHIPPED","DELIVERED","CANCELLED"],
    ColumnValues "order_total" > 0,
    ColumnCorrelation "order_total" "tax_amount" > 0.1,
    Completeness "email" > 0.95
]
```

Reading this ruleset: it requires more than 1,000 rows (a sanity check
against an empty or truncated load), requires `order_id` to be both
present on every row and unique (a primary-key-style constraint),
requires `order_status` to be one of a fixed enumerated set (a domain
constraint that catches upstream schema/value drift), requires
`order_total` to be strictly positive (a business-logic sanity check),
and requires `email` to be populated on at least 95% of rows (a
completeness threshold that tolerates some missingness rather than
requiring perfection).

<a name="schemaregistry"></a>
## 13. Glue Schema Registry

A centralized registry for Avro/JSON Schema/Protobuf schemas used by
streaming producers and consumers (typically paired with Kinesis Data
Streams or MSK/Kafka producers), enforcing **compatibility modes**
(backward, forward, full, none) so a producer can't push a breaking
schema change without the registry rejecting it or flagging it,
depending on the configured mode. This is the exam's answer to "how do
we prevent a schema-breaking change in a streaming producer from
silently breaking every downstream consumer" — centralized, versioned,
compatibility-checked schema governance rather than each consumer
independently guessing the shape of incoming records.

<a name="workflows"></a>
## 14. Glue workflows and triggers

A **workflow** orchestrates multiple crawlers and jobs as a single unit
with dependency management — e.g., "run crawler A, then on success run
job B, then on job B's success run job C and job D in parallel." A
**trigger** is what starts a workflow or an individual job: **scheduled**
(cron-like), **on-demand**, **event-based/conditional** (start when a
prior job/crawler completes successfully, or on a combination of
conditions). For more complex cross-service orchestration (a pipeline
that spans Glue, Lambda, EMR, and human-approval steps), Step Functions
or MWAA is the better fit — Glue workflows are best when the
orchestration is entirely within Glue's own crawlers and jobs.

---

<a name="whentouse"></a>
## 15. When to use / when NOT to use

**Use Glue when:** you need serverless, catalog-native ETL with no
cluster to manage; the workload is Spark-shaped (joins, aggregations,
format conversion) or lightweight Python-shell-shaped; you need a shared
metadata catalog other engines (Athena, Redshift Spectrum, EMR) will
also read; you need declarative, trackable data quality checks as part
of the pipeline.

**Do NOT use Glue when:** you need sub-second/true streaming event
processing (use Managed Service for Apache Flink); you need
non-Spark big-data frameworks (Presto, Hive, HBase) or deep low-level
cluster tuning control (use EMR); the job is a simple, short,
event-triggered piece of logic with no Spark need (use Lambda — faster
cold start, cheaper for small workloads, and avoids Spark startup
overhead entirely); you need a hard real-time SLA and Flex-style
variable start latency is unacceptable even at standard execution
(standard execution is fine, but budget for Spark cluster startup time,
which is not instant).

<a name="advlim"></a>
## 16. Advantages and limitations

**Advantages:** no cluster provisioning or patching; pay only for job
run time (by DPU-hour, and Flex for cheaper non-urgent runs); native,
deep integration with the Data Catalog used across the analytics stack;
job bookmarks give free incremental-processing correctness; Data Quality
and Schema Registry provide governance primitives without bolting on
third-party tools.

**Limitations:** Spark job startup has real overhead (tens of seconds to
low minutes) — not ideal for latency-sensitive, small, frequent jobs;
less low-level tuning control than a self-managed EMR/Spark cluster;
DynamicFrame flexibility has a real performance cost versus DataFrames;
Glue Flex trades cost for unpredictable start time, unsuitable for
tightly-SLA'd work.

<a name="pricing"></a>
## 17. Pricing

Billed per **DPU-hour**, by the second (with a 1-minute minimum for
Spark jobs), scaled by the number of workers and the DPU size of the
chosen worker type. Glue Flex execution is priced lower per DPU-hour
than standard execution in exchange for variable start latency. Crawlers
are billed by DPU-hour of crawl time. The Data Catalog itself has a free
tier for the first million objects stored and first million requests per
month, with charges beyond that. Glue Data Quality rule evaluation is
billed as part of the DPU-hours consumed running the evaluation.

<a name="perfscale"></a>
## 18. Performance, scaling, and high availability

Glue auto-scales workers within a job run (up to the configured maximum)
based on Spark's actual parallelism needs at each stage, which helps
with uneven or skewed workloads without manual tuning. Glue jobs are
Regional and stateless between runs except for the job bookmark's
tracked state; there's no cluster to keep highly available because
there's no persistent cluster — each run provisions and tears down its
own Spark environment. For very large, sustained, highly-tuned workloads
at extreme scale, EMR (with persistent or transient clusters and full
Spark configuration control) can outperform Glue on raw cost-efficiency,
which is the standard "EMR vs Glue at PB scale" exam trade-off.

<a name="security"></a>
## 19. Security

Glue jobs run with an **IAM role** scoped to the specific S3
prefixes, catalog databases/tables, and other resources the job needs
(least privilege, not a broad `s3:*`/`glue:*` role). Glue connections to
JDBC sources support storing credentials in **Secrets Manager** rather
than plaintext job parameters. Data Catalog access can be scoped
further with **Lake Formation** permissions (table- and column-level,
via LF-Tags) layered on top of IAM. Glue jobs typically run inside a VPC
when connecting to resources like RDS in a private subnet, requiring a
Glue connection with the right subnet/security-group configuration and,
for S3 access from within the VPC without traversing the internet, an
S3 gateway VPC endpoint.

<a name="failures"></a>
## 20. Failure scenarios and common mistakes

- **Job bookmark never enabled** — every scheduled run reprocesses the
  full source, inflating cost and, worse, duplicating records
  downstream if the write isn't idempotent.
- **Crawler run on every single job execution** — unnecessary crawl
  cost and latency when the schema/partition pattern is already known
  and stable.
- **DynamicFrame used for a huge, stable-schema dataset purely out of
  habit** — pays the schema-flexibility performance tax with no benefit.
- **Wrong worker type for a memory-intensive join** — using G.1X for a
  large skewed join that needs G.2X/G.4X memory headroom leads to
  executor OOM failures.
- **Glue Flex used for an SLA-bound pipeline stage** — unpredictable
  start latency breaks a downstream dependency's timing assumption.
- **IAM role over-scoped to `s3:*`** — a Glue job with unnecessarily
  broad permissions is a data-governance and security-audit finding.

<a name="examtraps"></a>
## 21. Exam traps

⚠️ **"Reprocessing/duplicate records on a scheduled job" = job bookmark
disabled**, not an orchestration bug. This is one of the most frequently
tested Glue symptoms.

⚠️ **"Least operational overhead, serverless, catalog-native ETL" =
Glue.** "Existing Spark/Hive investment, PB-scale, need full cluster
tuning control" = EMR. Confusing these two is the single most common
Glue-vs-EMR wrong answer.

⚠️ **"Non-time-critical, reduce cost" = Glue Flex.** If the same
sentence also says "must complete by a fixed deadline" or is part of a
real-time chain, Flex is wrong — use standard execution.

⚠️ **DQDL rule failures can be configured to halt the pipeline or just
alert** — a scenario emphasizing "must not let bad data reach production
under any circumstances" wants a rule configured to **fail the job**, not
merely log a warning.

<a name="interview"></a>
## 22. Interview questions

- *"When would you choose DynamicFrame over DataFrame, and vice
  versa?"* Strong answer: DynamicFrame for schema-inconsistent or
  evolving semi-structured sources where graceful handling of
  missing/extra fields matters more than raw speed; DataFrame (or an
  early conversion) once the schema is known and stable and performance
  matters more.
- *"How do you prevent a scheduled Glue job from reprocessing the same
  data every run?"* Strong answer: enable job bookmarks, and for JDBC
  sources ensure there's a monotonically increasing/timestamp column
  bookmarks can track against.
- *"How would you enforce that bad data never reaches your curated
  zone?"* Strong answer: a Glue Data Quality ruleset with critical rules
  configured to fail the job on violation, placed between the raw read
  and the curated write, plus alerting on soft-rule warnings that
  shouldn't block the pipeline but should notify the team.

<a name="cheatsheet"></a>
## 23. Cheat sheet

| If the scenario says... | Reach for... |
|---|---|
| serverless catalog-native ETL, no cluster to manage | AWS Glue ETL job |
| schema inconsistent / evolving semi-structured source | DynamicFrame |
| known stable schema, max Spark performance | DataFrame |
| avoid reprocessing already-seen data | Job bookmarks |
| memory-intensive join / large transform | G.2X or larger worker type |
| non-urgent batch, minimize cost | Glue Flex |
| continuous Spark-style transform on a stream | Glue Streaming ETL |
| true sub-second stream processing | Managed Service for Apache Flink (not Glue) |
| shared metadata for Athena/Redshift Spectrum/EMR | Glue Data Catalog |
| infer schema/partitions from S3 or JDBC | Glue Crawler |
| declarative data quality rules, can block bad data | Glue Data Quality (DQDL) |
| enforce schema compatibility for stream producers | Glue Schema Registry |
| chain crawler → job → job with dependencies | Glue Workflow |
| existing Spark/Hive, PB-scale, full tuning control | Amazon EMR (not Glue) |

<a name="mnemonics"></a>
## 24. Memory tricks

**"DynamicFrames forgive, DataFrames demand"** — DynamicFrames tolerate
schema mess; DataFrames expect a known, fixed schema. **"Bookmarks
remember, so you don't repeat"** — the one-line reason job bookmarks
exist. **"Flex is for what can wait"** — the trigger for choosing Glue
Flex is exactly "not time-critical."

---

<a name="practice"></a>
## 25. Practice questions (15)

**Q1.** A Glue job ingests daily JSON files from an IoT fleet where new
devices occasionally send extra, previously unseen fields. Which read
approach handles this most gracefully?

A) DataFrame with an explicit fixed schema
B) DynamicFrame
C) A Python shell job with manual JSON parsing
D) A crawler run before every job execution to force a schema match

**Answer: B.** DynamicFrames tolerate per-record schema variation
(missing/extra fields) without erroring, which fits an evolving IoT
schema. (A) a fixed DataFrame schema will error or drop unexpected
fields. (C) technically possible but reinvents what DynamicFrame already
does, with more code to maintain. (D) re-crawling doesn't make a Spark
DataFrame tolerant of per-record schema drift within a single run.

**Q2.** A scheduled nightly Glue job appears to reprocess the entire
source dataset every run instead of only new data, and downstream
metrics are becoming inflated with duplicates. What is the most likely
cause?

A) The crawler is not scheduled frequently enough
B) Job bookmarks are not enabled on the job
C) The worker type is too small
D) Glue Flex is enabled

**Answer: B.** This is the textbook symptom of a missing/disabled job
bookmark — without it, every run has no memory of what was already
processed. (A) crawler frequency affects catalog freshness, not
reprocessing. (C) worker sizing affects performance/OOM risk, not
whether old data is reprocessed. (D) Flex affects cost/start latency,
not incremental-processing behavior.

**Q3.** Which Glue worker type provides the largest memory footprint per
worker for a very large, memory-intensive join?

A) G.1X
B) G.025X
C) G.8X
D) Standard (legacy)

**Answer: C.** G.8X offers the largest vCPU/memory/disk footprint among
Glue worker types. (A) G.1X is the smaller standard default (16 GB).
(B) G.025X is a fractional, Flex-oriented small worker type — the
opposite of what's needed here. (D) legacy Standard predates and is
smaller than the G.1X/G.2X/G.4X/G.8X family.

**Q4.** A team wants to reduce the cost of a nightly Glue aggregation
job that has no fixed completion deadline. What should they configure?

A) Reserved concurrency
B) Glue Flex execution class
C) Provisioned capacity
D) A crawler running before the job

**Answer: B.** Glue Flex runs on spare capacity at a lower price in
exchange for a less predictable start time — exactly suited to a
non-time-critical nightly job. (A) and (C) are Lambda concepts, not
applicable to Glue jobs. (D) crawling doesn't affect job cost/pricing
tier.

**Q5.** Which Glue feature lets you declaratively define rules such as
"order_id must be unique" and "order_total must be greater than zero,"
and optionally fail the job when violated?

A) Glue Schema Registry
B) Glue Data Quality (DQDL)
C) Glue crawlers
D) Glue job bookmarks

**Answer: B.** DQDL (Data Quality Definition Language) is exactly this
declarative rule syntax, evaluated as part of Glue Data Quality, with
the option to fail the job on rule violation. (A) Schema Registry
governs schema compatibility for streaming producers/consumers, not
row-level data value rules. (C) crawlers infer schema, not data quality
rules. (D) bookmarks track processed state, unrelated to data quality
rules.

**Q6.** A Glue crawler is currently configured to run before every
single job execution, even though the source schema and partition
pattern have been stable for months. What is the main concern with this
setup?

A) It will corrupt the Data Catalog over time
B) It adds unnecessary cost and latency to every job run
C) It disables job bookmarks
D) It forces the job to use DataFrame instead of DynamicFrame

**Answer: B.** Crawling on every run when nothing has changed is pure
overhead — cost and time — with no catalog benefit; a scheduled crawl or
direct catalog update from the job (`enableUpdateCatalog`) is leaner.
(A), (C), and (D) are not accurate effects of frequent crawling.

**Q7.** Which statement correctly distinguishes Glue Streaming ETL from
Amazon Managed Service for Apache Flink?

A) Glue Streaming ETL is for true sub-second, event-at-a-time processing; Flink is micro-batch only
B) Glue Streaming ETL runs Spark Structured Streaming micro-batches; Flink is built for lower-latency, event-driven stream processing
C) They are functionally identical and interchangeable in all scenarios
D) Glue Streaming ETL cannot read from Kinesis or MSK

**Answer: B.** Glue Streaming ETL is Spark-based micro-batch processing
— good for Spark-style transformation logic on a stream without standing
up a separate cluster. Managed Service for Apache Flink is purpose-built
for lower-latency, more event-driven stream processing. (A) reverses the
actual characteristics. (C) they serve different latency/processing-model
needs and aren't interchangeable when latency requirements are strict.
(D) Glue Streaming ETL can read from both Kinesis Data Streams and MSK.

**Q8.** A company's streaming producers occasionally push a schema
change that breaks downstream consumers without warning. What Glue
feature directly addresses this?

A) Glue Data Quality
B) Glue Schema Registry with a compatibility mode enforced
C) Glue job bookmarks
D) Glue Studio

**Answer: B.** Schema Registry with backward/forward/full compatibility
enforcement rejects or flags breaking schema changes before they reach
consumers. (A) Data Quality validates data values/rows, not producer
schema compatibility. (C) bookmarks are about incremental processing
state. (D) Glue Studio is a visual job-authoring tool, unrelated to
schema governance.

**Q9.** A Glue job needs to connect to an RDS instance in a private
subnet with no direct internet access. What is required for this to
work?

A) The job must run in Python shell mode only
B) A Glue connection configured with the correct VPC subnet and security group
C) The RDS instance must be made publicly accessible
D) The job must use DynamicFrame instead of DataFrame

**Answer: B.** Glue connections carry the VPC/subnet/security-group
configuration a job needs to reach resources inside a private VPC. (A)
job type (Spark vs Python shell) is unrelated to VPC connectivity. (C)
making RDS public defeats the purpose of a private subnet and is a
security anti-pattern, not the correct fix. (D) DynamicFrame vs
DataFrame is unrelated to network connectivity.

**Q10.** Which is the most accurate reason to choose Amazon EMR over
AWS Glue for a given ETL workload?

A) The workload needs a persistent, catalog-registered metadata store
B) The workload needs low-level Spark cluster tuning control at petabyte scale, or uses a non-Spark framework like Hive/Presto
C) The workload needs to fail the job when a data quality rule is violated
D) The workload needs to track incremental processing state between runs

**Answer: B.** EMR gives full cluster configuration control and
supports frameworks beyond Spark; that's the classic trigger for
choosing it over Glue. (A) the Glue Data Catalog is available to and
shared with EMR anyway — not an EMR-only capability, and not a reason to
prefer EMR. (C) that's a Glue Data Quality capability. (D) that's job
bookmarks, a Glue feature.

**Q11.** A Glue DPU-hour cost review shows a job consistently exceeds
its expected budget. Which two levers most directly control Glue job
cost?

A) The AWS Region and the S3 storage class of the output
B) The number of workers/worker type (DPUs consumed) and the job's execution class (standard vs Flex)
C) The Data Catalog's total table count
D) Whether job bookmarks are enabled

**Answer: B.** Glue job cost is driven directly by DPU-hours consumed
(worker count x worker-type DPU size x duration) and whether Flex
pricing applies. (A) Region can have minor pricing differences but isn't
the primary lever; output storage class doesn't affect Glue job compute
cost. (C) catalog table count affects Data Catalog pricing, not job
compute cost. (D) bookmarks affect how much data is processed (and
thus indirectly cost) but aren't a direct pricing lever like DPU
configuration — the intended primary answer is worker/DPU + execution
class.

**Q12.** Which best describes what a Glue workflow adds on top of
individual crawlers and jobs?

A) It provides a lower-cost execution tier equivalent to Flex
B) It orchestrates multiple crawlers/jobs as a unit with dependency-based triggers
C) It replaces the need for a Data Catalog
D) It automatically writes Glue Data Quality rules

**Answer: B.** A workflow chains and sequences crawlers and jobs with
conditional/dependency-based triggers (e.g., run job B only after
crawler A succeeds). (A) Flex is a separate, unrelated cost feature. (C)
workflows still rely on the Data Catalog; they don't replace it. (D)
DQDL rules are authored separately, not auto-generated by a workflow.

**Q13.** A team needs to backfill three months of historical data
through an existing Glue job that normally runs incrementally via job
bookmarks. What is the correct approach?

A) Delete and recreate the Glue job entirely
B) Temporarily disable/reset the job bookmark for a backfill run, then re-enable normal incremental behavior
C) Switch the job to Glue Flex
D) Run a crawler over the historical data first

**Answer: B.** Resetting or disabling the bookmark for one run forces
full reprocessing of the target range (the backfill), after which normal
incremental bookmark behavior resumes. (A) unnecessarily destructive and
loses job configuration/history. (C) Flex affects cost/start latency,
not what data gets processed. (D) a crawler updates catalog metadata; it
doesn't control what a job's bookmark considers "already processed."

**Q14.** Which scenario is the clearest fit for a Python shell Glue job
rather than a Spark ETL job?

A) Joining two 500 GB Parquet datasets with heavy shuffling
B) A lightweight script that calls an API and writes a small result set, with no need for distributed processing
C) Continuous streaming transformation from Kinesis
D) A job requiring DynamicFrame's schema-flexible read

**Answer: B.** Python shell jobs are for lightweight, non-distributed
scripts — no Spark cluster overhead needed. (A) large-scale joins with
shuffling need Spark's distributed engine. (C) streaming transformation
is a Glue Streaming ETL (Spark) use case. (D) DynamicFrame is a
Spark-ETL-job concept, not available in Python shell jobs.

**Q15.** For governance, a company wants column-level access control on
Glue Data Catalog tables (e.g., masking a `salary` column for most
analysts) layered on top of standard IAM. Which service should be paired
with Glue for this?

A) Glue Schema Registry
B) AWS Lake Formation
C) Glue Data Quality
D) Glue Studio

**Answer: B.** Lake Formation provides table- and column-level
permissions (via LF-Tags) on top of the Data Catalog and underlying S3
permissions — the standard answer for fine-grained data governance. (A)
Schema Registry governs schema compatibility, not access control. (C)
Data Quality validates data values, not access permissions. (D) Glue
Studio is a visual job-authoring tool, unrelated to access control.
