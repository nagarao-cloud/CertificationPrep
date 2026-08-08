# Domain 3 — Data Operations and Support (22%)

> Task statements: **3.1** Automate data processing · **3.2** Analyze
> data · **3.3** Maintain and monitor pipelines · **3.4** Ensure data
> quality. ~14 of 65 questions, ~11 of your 50 study hours.

## CONTENTS

- [Part 0 — The 8-step primer for this domain](#p0)
- [Part 1 — Master guard rails](#p1)
- [3.1 Automate data processing](#s31)
  - [3.1.1 Orchestrate data pipelines](#311)
  - [3.1.2 Troubleshoot MWAA](#312)
  - [3.1.3 Call SDKs (boto3)](#313)
  - [3.1.4 Use AWS service features to process data](#314)
  - [3.1.5 Consume and maintain data APIs](#315)
  - [3.1.6 Prepare data for transformation (DataBrew)](#316)
  - [3.1.7 Query data (Athena)](#317)
  - [3.1.8 Use Lambda to automate processing](#318)
  - [3.1.9 Manage events and schedulers](#319)
  - [3.1.10 Infrastructure as code for repeatable deployments](#3110)
- [3.2 Analyze data](#s32)
  - [3.2.1 Visualize data](#321)
  - [3.2.2 Verify and clean data](#322)
  - [3.2.3 Use SQL in Redshift and Athena](#323)
  - [3.2.4 Athena notebooks with Apache Spark](#324)
  - [3.2.5 Provisioned vs serverless tradeoffs](#325)
  - [3.2.6 Aggregation, rolling average, grouping, pivoting](#326)
- [3.3 Maintain and monitor pipelines](#s33)
  - [3.3.1 Extract logs for audits](#331)
  - [3.3.2 Deploy logging and monitoring](#332)
  - [3.3.3 Notifications during monitoring](#333)
  - [3.3.4 Troubleshoot performance issues](#334)
  - [3.3.5 Use CloudTrail](#335)
  - [3.3.6 Troubleshoot and maintain pipelines](#336)
  - [3.3.7 Use CloudWatch Logs](#337)
  - [3.3.8 Analyze logs](#338)
  - [3.3.9 Amazon Macie for sensitive-data monitoring](#339)
- [3.4 Ensure data quality](#s34)
  - [3.4.1 Run data quality checks](#341)
  - [3.4.2 Define data quality rules (DataBrew + Glue Data Quality/DQDL)](#342)
  - [3.4.3 Investigate data consistency](#343)
  - [3.4.4 Data sampling techniques](#344)
  - [3.4.5 Implement data skew mechanisms](#345)
- [Decision trees](#trees)
- [Signature CloudWatch metric per service](#metrics)
- [Mnemonics](#mnemonics)
- [Domain 3 cheat sheet](#cheat)
- [Practice question bank — 40 questions](#questions)

---

<a name="p0"></a>
## PART 0 — The 8-step primer for this domain

**1. Explain like I'm 12.** Domain 3 is the "keep the lights on" part of
data engineering. Imagine you built a lemonade stand that now runs
itself — a robot squeezes lemons on a schedule (automation), a
dashboard shows how much lemonade sold today (analysis), a notebook
logs every time someone opens the fridge (monitoring), and you taste-
test each batch before selling it so nobody gets a cup of straight
vinegar (quality). Domain 3 is that robot, that dashboard, that
notebook, and that taste test.

**2. Explain technically.** Domains 1 and 2 build the pipeline and the
storage. Domain 3 is what happens *after* the pipeline exists: who
triggers it, how failures are detected and diagnosed, how the output is
queried and visualized, how every API call is audited, and how bad
records are caught before they poison a dashboard. It is the domain
most likely to test **operational judgment** rather than raw service
trivia — "the job is failing, what do you check first" is a Domain 3
question shape.

**3. Explain like a senior AWS data engineer.** A senior engineer reads
Domain 3 questions differently than a junior one. A junior engineer
sees "the pipeline is slow" and reaches for more compute. A senior
engineer reaches for **CloudWatch metrics and logs first, always** —
because the fix for "slow" is completely different depending on
whether the bottleneck is data skew (repartition), small files
(compaction), throttling (backoff/capacity), or a genuinely undersized
cluster (scale up). Guessing at a fix without reading the metric that
explains the symptom is the single most common wrong-answer pattern in
this domain.

**4. Explain production architecture.** In production, Domain 3 concerns
show up as a second, invisible pipeline running alongside the data
pipeline: CloudWatch Logs and Metrics collecting continuously,
CloudTrail recording every control-plane call, EventBridge routing
failure events to SNS, and a data-quality gate sitting between raw and
curated zones that can halt the pipeline before bad data reaches
consumers.

```
                DATA PIPELINE (the thing that moves data)
   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐
   │ Ingest │──▶│Transform│──▶│Quality │──▶│  Load  │──▶│ Serve  │
   └────────┘   └────────┘   │  Gate  │   └────────┘   └────────┘
        │            │       └────────┘        │            │
        v            v            v             v            v
   ┌─────────────────────────────────────────────────────────────┐
   │      OPERATIONS PIPELINE (Domain 3 — runs alongside)         │
   │  CloudWatch Logs/Metrics  │  CloudTrail  │  Alarms → SNS     │
   └─────────────────────────────────────────────────────────────┘
```

Every box in the top row emits into the bottom row. The exam expects
you to know **which signal in the bottom row tells you which box in
the top row is broken.**

**5. Explain exam traps.** The dominant trap in this domain is picking
the "impressive-sounding" service over the boring, correct one:
OpenSearch for a log search question that CloudWatch Logs Insights
already answers cheaper; EMR for a data-quality question that Glue
Data Quality already answers with no cluster; a custom Lambda script
for a scheduled trigger that EventBridge Scheduler already provides
for free. Domain 3 rewards knowing the smallest tool that satisfies the
requirement.

**6. Explain interview questions.** "Walk me through how you'd debug a
Glue job that suddenly takes 4x longer to run" is functionally a
Domain 3 exam question read aloud. The answer graders want: check
CloudWatch metrics (DPU utilization, executor memory), check the Spark
UI / job run logs for skew or spill-to-disk, check whether input data
volume or file count changed, and only then decide between repartition,
bigger workers, or salting.

**7. Cheat sheet.** See the [full cheat sheet](#cheat) at the end of this
file, plus the [signature-metric table](#metrics).

**8. Memory tricks.** See [Mnemonics](#mnemonics).

---

<a name="p1"></a>
## PART 1 — Master guard rails

Run every Domain 3 question stem through these five questions, in
order, before looking at the answer options.

```
┌──────────────────────────────────────────────────────────────────┐
│ #1  WHAT IS THE PROBLEM CATEGORY?                                 │
│     Automation → 3.1   Analytics → 3.2                            │
│     Monitoring → 3.3   Quality  → 3.4                              │
├──────────────────────────────────────────────────────────────────┤
│ #2  EVENT-DRIVEN OR SCHEDULED?                                    │
│     "Run now" (manual/API) · "Run later" (cron/schedule) ·        │
│     "Run on event" (S3 PUT, job state change, custom event)       │
├──────────────────────────────────────────────────────────────────┤
│ #3  DO YOU NEED STATE?                                            │
│     Simple trigger        → EventBridge (rule or Scheduler)       │
│     Stateful workflow      → Step Functions                       │
│     DAG with dependencies  → MWAA (or Glue Workflows if Glue-only)│
├──────────────────────────────────────────────────────────────────┤
│ #4  IS THIS AN OPERATIONAL (BROKEN) QUESTION?                     │
│     Always check, in this order:                                  │
│     CloudWatch Metrics → CloudWatch Logs → CloudTrail → the       │
│     service's own logs (Spark UI, Airflow task logs, STL tables)  │
├──────────────────────────────────────────────────────────────────┤
│ #5  IS THIS A DATA-QUALITY QUESTION?                               │
│     Check for: completeness, consistency, duplicates, data skew,  │
│     null/abnormal values — and whether the fix belongs at         │
│     ingest, in-flight (Glue Data Quality), or post-load (Athena/  │
│     DataBrew validation)                                           │
└──────────────────────────────────────────────────────────────────┘
```

⚠️ **Guard rail #4 is the most valuable one on the exam.** Any answer
option that jumps straight to "resize the cluster" or "rewrite the
job" without first mentioning logs or metrics is very often the
distractor, even when it would technically work. AWS's house style is
"diagnose before you treat."

---

<a name="s31"></a>
# TASK 3.1 — AUTOMATE DATA PROCESSING

<a name="311"></a>
## 3.1.1 Orchestrate data pipelines

**Explain like I'm 12.** You have three ways to get a robot to do a
chore: tell it to do the chore right now, tell it to do the chore every
day at 6 PM, or give it a whole checklist where step 4 only happens if
step 3 succeeded. Those are EventBridge, EventBridge Scheduler, and
Step Functions/MWAA.

**Explain technically.** Orchestration is the layer that decides *when*
and *in what order* your processing steps run, and what happens when
one of them fails. AWS gives you three tiers of increasing statefulness:

| Need | Service | Why |
|---|---|---|
| Fire on a schedule or an event, no branching | **EventBridge** (rules or Scheduler) | Simplest, cheapest, stateless |
| Multi-step workflow with retries, branching, parallelism, state tracking | **Step Functions** | Purpose-built state machine, 200+ service integrations |
| Complex DAG with cross-step dependencies, existing Airflow investment | **MWAA** | Full Airflow; steepest learning curve, highest idle cost |

**Explain like a senior AWS data engineer.** The senior engineer's
default is Step Functions, not MWAA. MWAA is an **always-on
environment** — you pay environment-hours whether or not a DAG is
running, and it requires real operational care (plugin management,
requirements.txt, worker autoscaling config). Step Functions is
serverless with the same power for most use cases (branching, retries,
parallel map, distributed map for 10,000 objects). MWAA only wins when
the question hands you something Step Functions can't replicate:
**existing Airflow DAGs**, **complex Python operator dependencies**, or
a team's sunk Airflow expertise. Picking MWAA when the scenario doesn't
mention Airflow is the single most common wrong-answer trap in 3.1.1.

**Explain production architecture.**

```
EVENTBRIDGE PATTERN (simple, stateless)
   ┌──────────────┐     ┌──────────┐     ┌────────┐
   │  EventBridge │────▶│ Glue Job │────▶│   S3   │
   │  Schedule    │     │          │     │ (curated)
   └──────────────┘     └──────────┘     └────────┘
Use when: one job, fixed cadence, no retries/branching needed.

STEP FUNCTIONS PATTERN (stateful, branching)
   ┌─────────┐   ┌──────────┐   ┌───────────┐   ┌──────┐
   │ Extract │──▶│ Validate │──▶│ Transform │──▶│ Load │
   └─────────┘   └──────────┘   └───────────┘   └──────┘
        │              │ fail         │ fail
        v              v              v
   ┌─────────────────────────────────────────┐
   │        Catch → SNS alert → DLQ           │
   └─────────────────────────────────────────┘
Use when: any step can fail independently and needs its own retry
policy, or later steps depend on earlier step output (state).

MWAA PATTERN (DAG, cross-service dependencies)
   Airflow DAG
      │
      ├──▶ Glue Job A ──┐
      ├──▶ Glue Job B ──┼──▶ EMR Step ──▶ Redshift COPY
      └──▶ sensor waits─┘
Use when: existing Airflow DAGs must be migrated, or dependencies span
many services with complex branching logic Python already expresses.
```

Each arrow above is a **state transition** that Step Functions logs to
its execution history (90 days, visible in the console) — this history
is itself a Domain 3 monitoring asset: "show me exactly which step
failed and why" is answered by the Step Functions execution graph
before you ever open CloudWatch.

**Explain exam traps.**
- ⚠️ MWAA is **never** the "least operational overhead" answer — it is
  an always-on environment you size and pay for continuously.
- ⚠️ "Chain only Glue jobs and crawlers, nothing else" → **Glue
  Workflows** (free), not Step Functions. If any non-Glue service
  appears in the chain, Glue Workflows is disqualified.
- ⚠️ EventBridge alone cannot retry a multi-step workflow with
  conditional branching — that phrase means Step Functions.

**Interview questions.**
- *"When would you choose Step Functions over MWAA?"* — Step Functions
  is serverless (no idle cost), has native retry/catch semantics per
  state, and integrates with 200+ AWS services directly via Amazon
  States Language. MWAA wins only when you have existing Airflow DAGs
  or need Python-heavy custom operators/sensors that don't map cleanly
  to States Language.
- *"How do you handle a step that fails intermittently?"* — Step
  Functions `Retry` field with exponential backoff and a `MaxAttempts`
  cap, followed by a `Catch` that routes to a failure-handling branch
  (SNS alert, DLQ, or compensating transaction) rather than letting the
  whole execution die silently.

<a name="312"></a>
## 3.1.2 Troubleshoot Amazon Managed Workflows for Apache Airflow (MWAA)

**Explain like I'm 12.** If the robot's whole daily checklist doesn't
even start, you check whether the alarm clock rang. If one item on the
checklist fails, you read what that item's note said. If the robot
seems tired and slow, you check whether it has enough battery.

**Explain technically.** MWAA problems fall into three buckets, and the
exam expects you to route symptom → log source correctly:

| Symptom | Where to look |
|---|---|
| **A single task fails** | Airflow **Task Logs** (per-task, in the Airflow UI, backed by CloudWatch Logs) |
| **The DAG never starts / doesn't appear** | **Scheduler Logs**, DAG parsing errors, IAM execution-role permissions, S3 DAG-bag sync delay |
| **Tasks queue but don't run / workers overloaded** | **Environment scaling** settings (min/max workers), worker CloudWatch metrics |

**Explain like a senior AWS data engineer.** The order matters. A
senior engineer never opens raw CloudWatch Logs first for MWAA — the
**Airflow UI** is the faster diagnostic surface because it shows task
state, retry count, and duration at a glance; CloudWatch is where you
go once the UI has narrowed the blast radius to "this specific task
failed with this specific traceback." Also: a DAG that "isn't showing
up" is overwhelmingly an **S3 sync delay or a Python import error**,
not an infrastructure problem — check the scheduler logs for parsing
exceptions before touching IAM.

```
   MWAA TROUBLESHOOTING FLOW
   ┌─────────┐   ┌──────────────────┐   ┌───────────────┐   ┌────────────┐
   │ Failure │──▶│ CloudWatch Logs  │──▶│ Airflow Logs   │──▶│ Root Cause │
   │ reported│   │ (env-level:      │   │ (task-level,   │   │ (fix DAG,  │
   │         │   │ scheduler, worker│   │ via Airflow UI)│   │ IAM, or    │
   │         │   │ webserver logs)  │   │                │   │ scaling)   │
   └─────────┘   └──────────────────┘   └───────────────┘   └────────────┘
```
Each stage narrows scope: CloudWatch Logs tells you *which component*
(scheduler/worker/webserver) is unhealthy; Airflow's own UI/logs tell
you *which task and why*; only then do you act on the actual root
cause (fix a bad import, widen an IAM policy, raise `max workers`).

**Explain production architecture.** MWAA environments publish
scheduler, worker, webserver, and DAG-processing logs to separate
CloudWatch log groups — enable **all** of them in production, not just
task logs, or you'll be blind to scheduler-level failures (e.g., DAG
parsing timeouts) that never produce a task log at all.

**Exam traps.**
- ⚠️ "DAG doesn't appear in the UI" is almost always a **Python
  parsing error or S3 sync lag**, not a permissions problem — don't
  jump straight to IAM.
- ⚠️ Tasks stuck in `queued` state for a long time → **worker capacity**
  (min/max workers too low), not a code bug.

**Interview question.** *"A DAG worked yesterday and fails today with
no code change — what do you check?"* — Check for an upstream data
dependency that didn't arrive (sensor timeout), a transient AWS API
throttle visible in task logs, or a connection/secret that expired
(check Secrets Manager/Connections backend) before assuming code
regression.

<a name="313"></a>
## 3.1.3 Call SDKs to access AWS features from code

**Explain like I'm 12.** Instead of clicking buttons in the AWS
console, you can write a note in Python that says "AWS, please do this
for me" — that note is the SDK.

**Explain technically.** **boto3** is the Python SDK and by far the
most common answer to "programmatically access AWS" on this exam. It
wraps every AWS service's API — S3, Glue, Athena, Lambda, DynamoDB,
Redshift Data API — as Python objects and methods, handling request
signing (SigV4), retries, and pagination for you.

```
   Python Script ──▶ AWS SDK (boto3) ──▶ AWS Service API
        │                                       │
        └── credentials from IAM role/profile ──┘
```
The script never holds long-lived credentials directly in production
code — it assumes an IAM role (Lambda execution role, EC2 instance
profile, or `sts:AssumeRole`), and boto3 resolves those credentials
automatically via the default credential chain.

**Explain like a senior AWS data engineer.** The exam-relevant judgment
here isn't "how do I call boto3" — it's **when calling the SDK directly
from custom code is the wrong answer** versus using a managed service
feature. If a question describes "trigger a Glue job when a file
lands," the correct answer is an **EventBridge rule → Glue job start**,
not "write a Lambda that polls S3 and calls
`glue_client.start_job_run()` every minute." Reach for direct SDK calls
inside Lambda/Glue Python-shell jobs for genuine custom logic (calling
a third-party API, doing programmatic validation), not to reinvent a
trigger AWS already provides natively.

**Production architecture.** The **Redshift Data API** (called via
boto3) lets Lambda or Step Functions run SQL against Redshift without
managing a persistent JDBC/ODBC connection or storing DB credentials in
the caller — it authenticates via IAM or a Secrets Manager-stored
secret and returns results asynchronously. This is the modern answer to
"run SQL against Redshift from a serverless function without managing
connections."

**Exam traps.**
- ⚠️ "Programmatically access AWS features" in a question stem is a
  reflex trigger for **AWS SDK** (boto3 for Python) — don't overthink it
  into a managed-service answer if the stem is explicitly about custom
  code.
- ⚠️ boto3 calls from Lambda inherit the function's **execution role**
  — a common failure mode is a missing IAM permission on that role, not
  a code bug.

**Interview question.** *"How would you call Redshift from a Lambda
function without hardcoding credentials?"* — Use the **Redshift Data
API** via boto3, authenticating either with a Secrets Manager ARN or
temporary IAM credentials, so no persistent DB password sits in code or
environment variables.

<a name="314"></a>
## 3.1.4 Use AWS service features to process data (EMR, Redshift, Glue scripting)

**Explain like I'm 12.** Some kitchen appliances let you write your own
recipe card instead of just pressing "start." Glue, EMR, and Redshift
all let you bring your own script (Spark, SQL, Python) instead of only
using a fixed built-in transform.

**Explain technically.** The exam explicitly calls out that Glue, EMR,
and Redshift **all accept custom scripting**:

| Service | Scripting surface | Language(s) |
|---|---|---|
| **Glue** | ETL job script, Glue Studio custom transform | Python (PySpark), Scala |
| **EMR** | Step scripts, bootstrap actions, notebooks | Spark, Hive, Presto/Trino, Python, Scala |
| **Redshift** | Stored procedures, UDFs | SQL, Python (UDFs) |

**Explain like a senior AWS data engineer.**

| Attribute | **Glue ETL** | **EMR (EC2)** | **Redshift** |
|---|---|---|---|
| Purpose | Serverless Spark ETL, catalog-native | Full big-data cluster (Spark/Hive/Trino/HBase) | MPP SQL warehouse |
| When to use | Catalog-driven ETL, job bookmarks for incremental loads | Existing Hadoop ecosystem, extreme cost optimization with Spot | In-warehouse transformation, stored procedures for ELT |
| When NOT to use | Non-Spark frameworks (Presto/HBase) needed | You want zero cluster management | Heavy row-by-row procedural logic — SQL isn't the right tool |
| Advantages | No infra, auto-scaling workers, DynamicFrames handle messy schema | Cheapest at PB scale with Spot task nodes, broadest framework support | Sub-second BI queries, mature SQL optimizer |
| Limitations | Cold-start ~1 min, Spark-only | Cluster spin-up 5–10 min, ops burden | Not designed for arbitrary code execution |
| Real example | Streaming retail clickstream enrichment (Glue Streaming) | Genomics batch pipeline reusing existing Spark jobs (healthcare) | Bank running nightly SCD Type 2 merge via stored procedure |

A senior engineer picks based on **where the compute should live**, not
which service sounds most "data engineering." If the transform logic is
naturally expressed as SQL and the data is already in the warehouse,
push it down as a Redshift stored procedure (ELT) rather than pulling
data out to Glue and back (ETL) — that round trip costs both time and
money.

```
GLUE ARCHITECTURE                 EMR ARCHITECTURE
Raw S3 ──▶ Glue ETL ──▶ Curated S3    Large Dataset ──▶ Spark Cluster ──▶ Output
(DynamicFrame handles                 (existing Spark/Hive/Trino code
 schema drift automatically)           runs largely unmodified)

REDSHIFT ARCHITECTURE
S3 ──▶ COPY ──▶ Redshift tables ──▶ stored procedure (transform in place) ──▶ Analytics
```
`COPY` parallel-loads files across all node slices; the stored
procedure then transforms data **inside** the warehouse (ELT) instead
of round-tripping to an external compute engine — the right call when
the transform is set-based SQL a Redshift cluster is already sized to
handle.

**Exam traps.**
- ⚠️ "Existing Spark/Hive/Presto scripts must run mostly unmodified" →
  **EMR**, not Glue — Glue's DynamicFrame API and job structure are not
  drop-in compatible with raw open-source Spark code.
- ⚠️ A stored procedure question emphasizing "minimize data movement" →
  keep the transform **in Redshift**, don't export to Glue.

**Interview question.** *"Why would you write a Redshift stored
procedure instead of a Glue job for a transformation?"* — When the
source and target are both in Redshift, doing the transform in-place
avoids extracting data out to S3/Spark and reloading it — less data
movement, less latency, and it reuses the warehouse's existing compute
allocation instead of provisioning separate DPUs.

<a name="315"></a>
## 3.1.5 Consume and maintain data APIs

**Explain like I'm 12.** Sometimes your data doesn't live in AWS at
all — it lives behind someone else's front door (a third-party API),
and you have to knock, wait politely if they're busy, and carry what
they hand you back home.

**Explain technically.**

```
   Third-Party API ──▶ Lambda (fetch + transform) ──▶ S3 (raw landing zone)
```
Lambda is the default consumer for external/SaaS APIs because it's
event-driven (schedule via EventBridge, or triggered on demand),
short-lived, and needs no persistent infrastructure to poll an
endpoint. For higher-volume, longer-running API consumption, Glue
Python shell jobs or Step Functions orchestrating multiple Lambda calls
are the next tier up.

**Explain like a senior AWS data engineer.** Production-grade API
consumption is never "call the endpoint and hope." A senior engineer
builds in, at minimum: **retry with exponential backoff and jitter**
(avoid thundering-herd retries against a rate-limited API), **API key
rotation** (store the key in Secrets Manager, not in code or plaintext
env vars), and **CloudWatch monitoring** on error rate and latency so a
silently-failing upstream API doesn't quietly starve the pipeline for
days before anyone notices.

For maintaining an API you **expose** (rather than consume), API
Gateway + Lambda in front of a data store (DynamoDB, S3, Redshift Data
API) is the standard serverless pattern for "make curated data
available to other systems" — a phrase this exam associates directly
with data APIs.

**Exam traps.**
- ⚠️ "Third-party rate limits are causing failures" → the fix is
  **exponential backoff / throttling on your side**, not "request a
  service quota increase" (that's an AWS-side lever and doesn't apply
  to someone else's API).
- ⚠️ Hardcoding an API key in Lambda environment variables in plaintext
  is always the wrong answer when Secrets Manager is an option.

**Interview question.** *"How do you protect a downstream system from
being overwhelmed by your own retries?"* — Exponential backoff with
jitter, a maximum retry cap, and a dead-letter queue for requests that
still fail after retries — so a bad batch degrades gracefully instead
of hammering the API into a worse outage.

<a name="316"></a>
## 3.1.6 Prepare data for transformation (DataBrew)

**Explain like I'm 12.** Before you cook, you wash the vegetables and
cut off the bad parts. DataBrew is the sink and cutting board for messy
data — no coding required.

**Explain technically.** **AWS Glue DataBrew** is a visual data-prep
tool: point it at a data source (S3, Redshift, RDS, Data Catalog
table), and it profiles the data and lets you apply 250+ prebuilt
transformations (handle nulls, standardize date formats, split/merge
columns, deduplicate) through a UI, without writing Spark code. It
outputs a **recipe** (a reusable, versioned list of transformation
steps) that can run as a scheduled DataBrew job.

```
Raw Data ──▶ DataBrew (profile → build recipe →
             null handling / cleansing / standardization) ──▶ Processed Data
```
Profiling happens first and automatically — DataBrew samples the
dataset and surfaces null percentages, distinct-value counts, and
outliers *before* you write a single transformation step, which is why
it doubles as a data-quality and data-profiling tool (see 3.4.2).

**Explain like a senior AWS data engineer.** DataBrew's ceiling is
lower than Glue ETL's — it's built for **business analysts and data
stewards**, not high-volume production pipelines. A senior engineer
picks DataBrew when the requirement is explicitly "no-code" or "self-
service for analysts," and picks Glue ETL/Spark when the transform
needs custom logic, joins across large datasets, or must run as a
tightly-scheduled production job at scale. AWS also references
**SageMaker Unified Studio** as a newer, broader workspace for data
prep and ML collaboration — know that it exists, but DataBrew remains
the exam's primary no-code prep answer.

**Exam traps.**
- ⚠️ "Business analysts need to clean data without writing code" →
  **DataBrew**, not Glue Studio visual editor (which still assumes some
  ETL/pipeline literacy) and not raw PySpark.
- ⚠️ DataBrew is not a substitute for Glue ETL at large scale or for
  complex multi-table joins — it's a prep and profiling tool.

**Interview question.** *"When would you use DataBrew instead of a Glue
job?"* — When the audience is non-engineers who need to interactively
explore and clean a dataset (fix nulls, standardize formats, dedupe)
without writing Spark code, and the output is a reusable recipe rather
than a hand-tuned production ETL pipeline.

<a name="317"></a>
## 3.1.7 Query data (Athena)

**Explain like I'm 12.** Athena lets you ask questions directly about
files sitting in a bucket, like asking a librarian a question without
having to check the book out first.

**Explain technically.** Athena is serverless, pay-per-TB-scanned SQL
over data registered in the Glue Data Catalog (typically pointing at S3
data). No cluster to provision, no idle cost — you pay only when a
query runs.

| Attribute | **Athena** | **Redshift** |
|---|---|---|
| Serverless | ✅ | ❌ (unless Serverless mode) |
| Ad-hoc queries | ✅ | ✅ |
| Frequent BI/dashboard queries at concurrency | ⚠️ Quota-limited | ✅ |
| Data lake native | ✅ | Needs Spectrum for S3 data |

**Explain like a senior AWS data engineer.** Athena in Domain 3 is
almost always the automation/analysis glue: kick off an Athena query
from a Step Functions state, from a Lambda function via boto3, or
schedule a CTAS query to materialize a curated table. The senior
engineer's judgment call is **when NOT to use Athena from automation
code**: high-frequency, low-latency lookups (use DynamoDB), or high-
concurrency dashboard refreshes (use Redshift) — Athena's per-query
quota (~20–25 concurrent DML queries by default) becomes the bottleneck
under either pattern.

```
S3 (Parquet, partitioned) ──▶ Athena (SQL, serverless) ──▶ Query results
                                    │
                                    └──▶ CTAS ──▶ new curated S3 table
```
CTAS ("CREATE TABLE AS SELECT") is the automation pattern worth
memorizing: it lets a scheduled job materialize an expensive query's
result once, so downstream consumers query cheap, pre-computed Parquet
instead of re-scanning raw data every time.

**Exam traps.**
- ⚠️ Calling Athena from Lambda/Step Functions for automation is a
  legitimate, common pattern — but a "sub-second, high-concurrency"
  requirement in the same stem should redirect you to Redshift instead.
- ⚠️ Athena query results land in an **S3 results bucket** by default —
  a question about "where do Athena query outputs go" is testing that,
  not some special managed store.

**Interview question.** *"How would you automate a daily Athena
query and store the summarized result?"* — EventBridge Scheduler
triggers a Lambda (or Step Functions state) that calls
`start_query_execution` via boto3 against a CTAS or INSERT INTO
statement, writing a compact, partitioned Parquet output table that
downstream jobs or QuickSight consume — cheaper and faster than
re-running the raw query each time.

<a name="318"></a>
## 3.1.8 Use Lambda to automate data processing

**Explain like I'm 12.** Lambda is a helper who appears the instant
something happens, does one quick job, and then disappears — no need to
keep it around and pay it to stand there all day.

**Explain technically.**

```
S3 Upload event ──▶ Lambda ──▶ Transform ──▶ Destination (S3 / DynamoDB / SNS)
```
Lambda's hard limits define when it's the right tool: **15-minute max
execution**, **10,240 MB max memory**, and a default concurrency
ceiling (1,000, raisable). Common Domain 3 use cases: file validation
on arrival, metadata extraction, sending notifications, small format
conversions, and invoking other services (Glue `start_job_run`, Step
Functions `start_execution`) as the glue between an event and a bigger
process.

**Explain like a senior AWS data engineer.** The senior engineer treats
Lambda's 15-minute ceiling and 10 GB memory limit as **hard
disqualifiers**, not soft preferences — any question describing a job
that could plausibly run long (large file transforms, big joins) should
route to Glue or EMR instead, even if Lambda's event-driven triggering
sounds convenient. Lambda's real strength in Domain 3 is as
**automation glue**, not as a transformation engine for anything beyond
small, fast, well-bounded work.

**Exam traps.**
- ⚠️ "Process a 50 GB file within a Lambda function" is *always* a
  wrong-answer setup — size or duration eventually breaks Lambda's
  limits, and the correct answer swaps in Glue/EMR.
- ⚠️ Lambda's default concurrency limit is **per-account**, not
  per-function — a burst of S3 events under-provisioned for reserved
  concurrency can throttle unrelated functions too.

**Interview question.** *"When do you split a task between Lambda and
Glue instead of doing it all in Lambda?"* — When the workload is
small/fast/event-triggered (validate a file, extract metadata), keep it
in Lambda; the moment the transform needs distributed compute, joins
across large datasets, or could run past 15 minutes, hand off to Glue
(often by having Lambda call `start_job_run`).

<a name="319"></a>
## 3.1.9 Manage events and schedulers

**Explain like I'm 12.** EventBridge is the office intercom — it
listens for announcements ("a new file arrived," "it's 2 AM") and pages
the right team.

**Explain technically.**

```
AWS Event (S3 PUT, Glue job state change, custom app event, cron time)
        │
        v
   EventBridge (rule matches event pattern, or Scheduler fires on cadence)
        │
        ├──▶ Lambda
        ├──▶ Step Functions
        └──▶ Glue (StartJobRun)
```
**EventBridge rules** match on event *content* (source, detail-type,
specific field values) — the answer for "route based on event
attributes." **EventBridge Scheduler** is the answer for pure
time-based triggers ("run at 2 AM daily," "run every 15 minutes") and
is effectively a modern, more flexible cron replacement, cheaper and
simpler than standing up a Step Functions state machine just to wait
for a clock.

**Explain like a senior AWS data engineer.** EventBridge is the
correct, cheap default for simple fan-out and scheduling. The moment a
question needs **state** — remembering that step 2 already ran, or
retrying step 3 with backoff while step 4 waits — EventBridge alone
cannot do it; that's the signal to escalate to Step Functions.
EventBridge's own retry behavior is limited to delivery retries to the
*target*, not workflow-level state tracking.

**Exam traps.**
- ⚠️ "Trigger a workflow whenever a Glue job fails" → EventBridge rule
  matching **Glue job state-change events** → SNS notification. This is
  a named, common exam pattern.
- ⚠️ Confusing EventBridge Scheduler with EventBridge rules: Scheduler
  is purpose-built for time-based cron/rate expressions and is the
  cheaper, simpler answer when there's no content-based filtering
  requirement.

**Interview question.** *"How do you alert the team the moment a Glue
job fails, without polling?"* — An EventBridge rule matching Glue's
`GlueJobStateChange` event with `state = FAILED`, routed to an SNS
topic subscribed by email/Slack integration — fully event-driven, no
polling loop required.

<a name="3110"></a>
## 3.1.10 Infrastructure as code for repeatable deployments

**Explain like I'm 12.** Instead of building the same LEGO set from
memory every time (and getting it slightly wrong), you follow the
instruction booklet — every time, identical.

**Explain technically.** **AWS CloudFormation** and **AWS CDK** both
declare infrastructure (Glue jobs, Step Functions state machines, S3
buckets, IAM roles) as versioned code instead of manual console clicks.
CDK compiles down to CloudFormation templates but lets you write
infrastructure in Python/TypeScript/Java with loops, conditionals, and
reusable constructs — the answer when a question wants **programmatic,
reusable** infrastructure definitions rather than raw YAML/JSON.

**Explain like a senior AWS data engineer.** In a Domain 3 context, IaC
matters because it makes pipeline **redeployment and rollback**
repeatable — spinning up an identical dev/staging/prod copy of a Glue
job + Step Functions workflow + IAM roles from one template, instead of
hand-recreating them and risking drift. A senior engineer also uses
IaC to encode **guardrails**: an IAM role scoped exactly to what a Glue
job needs, defined once in code and reused everywhere, instead of
re-typing permissions per environment and slowly over-granting them.

**Exam traps.**
- ⚠️ "Deploy the same pipeline consistently across three environments"
  → CDK/CloudFormation, not manual console configuration or ad-hoc CLI
  scripts.
- ⚠️ CDK vs raw CloudFormation is rarely tested at syntax level — know
  that CDK is a **code-first abstraction that generates**
  CloudFormation, not a competing deployment engine.

**Interview question.** *"Why use CDK over manually configuring Glue
jobs in the console?"* — Reproducibility (identical infra across
environments), version control (changes are reviewable diffs), and
safe rollback (revert to a previous template) — all things manual
console changes can't give you.

---

<a name="s32"></a>
# TASK 3.2 — ANALYZE DATA

<a name="321"></a>
## 3.2.1 Visualize data

**Explain like I'm 12.** A spreadsheet full of numbers is hard to read
at a glance. A chart turns those numbers into a picture your brain can
understand in one second.

**Explain technically.**

| Attribute | **QuickSight** | **DataBrew** |
|---|---|---|
| Purpose | BI dashboards for business users | Data profiling + light visual exploration during prep |
| Dashboards | ✅ Core purpose | ⚠️ Limited (profile charts only) |
| Data profiling | ⚠️ Basic | ✅ Purpose-built |
| Caching | **SPICE** (in-memory, fast) | N/A |
| Row-level security | ✅ | N/A |
| Best use case | KPI dashboards, executive reporting | Understanding a dataset's shape before cleaning it |

```
Athena / Redshift ──▶ QuickSight (SPICE cache) ──▶ Dashboard (KPIs, exec reporting)
```
SPICE is QuickSight's in-memory engine — importing data into SPICE
(instead of querying live every refresh) is what makes dashboards feel
instant and what removes per-view load from the underlying Athena/
Redshift source.

**Explain like a senior AWS data engineer.** DataBrew's "visualization"
is a profiling side-effect (histograms, distinct counts) meant to
inform cleaning decisions, not a dashboarding tool — conflating the two
is a common wrong-answer trap. If the requirement is "each regional
manager should see only their region's numbers," that's **QuickSight
row-level security**, layered on top of whatever underlying access
control (Lake Formation, IAM) already restricts the raw data.

**Amazon Q in QuickSight** is a generative-BI feature layered on top of
QuickSight, not a competing service — it lets business users type a
plain-English question against a QuickSight dashboard/dataset ("what
were our top 5 products by revenue last quarter?") and get back a
generated chart or written summary, with no SQL and no manual visual
building. For the exam, treat it as lowering the bar for self-service
analytics for non-technical users on top of QuickSight's existing
capabilities — it doesn't change the core "when do you pick
QuickSight" decision logic, just adds a natural-language layer on it.

**Exam traps.**
- ⚠️ "Business users need self-service dashboards" → QuickSight, never
  DataBrew.
- ⚠️ QuickSight SPICE has a **per-dataset row/storage limit** —
  extremely large datasets may need direct query mode instead of SPICE
  import; a question emphasizing near-real-time freshness over SPICE's
  refresh cadence points at direct query.

**Interview question.** *"How do you keep a QuickSight dashboard fast
without hammering Redshift on every page view?"* — Import into SPICE
with a scheduled refresh cadence appropriate to freshness needs,
instead of querying the warehouse live on every dashboard load.

<a name="322"></a>
## 3.2.2 Verify and clean data

**Explain like I'm 12.** Before you serve dinner, you check nothing's
missing from the plate and nothing looks spoiled.

**Explain technically.** Verification and cleaning span several tools
depending on where in the pipeline you are:

| Tool | Role |
|---|---|
| **Athena** | Ad-hoc SQL validation queries (row counts, null checks, range checks) |
| **Lambda** | Programmatic validation as part of an event-driven pipeline |
| **QuickSight** | Visual/manual spotting of anomalies via dashboards |
| **DataBrew** | Interactive, no-code cleaning + built-in data-quality rules |
| **Glue Data Quality** | Codified, automated rules (DQDL) enforced inside a Glue job |
| **Jupyter / SageMaker notebooks, Data Wrangler** | Exploratory, code-based validation for data scientists |

```
Source Data ──▶ Validation Rules (row count, null %, range, dupes) ──▶ Clean Dataset
```
A typical validation gate checks: **row count** against an expected
range (catches truncated loads), **null percentage** per critical
column, **duplicate key detection**, and **range validation** (e.g., a
negative "quantity_sold" is almost certainly bad data).

**Explain like a senior AWS data engineer.** The judgment call is
*where* verification happens: ad-hoc/manual (Athena/QuickSight) is fine
for exploration, but production pipelines need **automated, codified**
checks that can halt a pipeline — that's Glue Data Quality, not a
human periodically eyeballing a dashboard. See 3.4 for the full
treatment of automated quality gates.

**Exam traps.**
- ⚠️ "Verify data without affecting production performance" often
  points at **querying a read replica or an exported copy**, not
  running heavy validation directly against a live transactional
  source.

**Interview question.** *"What's the difference between ad-hoc data
verification and a production data-quality gate?"* — Ad-hoc
verification (Athena query, QuickSight chart) is manual and
exploratory; a production gate is automated, runs on every pipeline
execution, and can programmatically halt downstream processing when a
rule fails (Glue Data Quality's pass/fail actions).

<a name="323"></a>
## 3.2.3 Use SQL in Redshift and Athena, including views

**Explain like I'm 12.** A view is like a saved search — you write the
complicated question once, give it a name, and from then on you just
ask for it by name.

**Explain technically.** Both Athena and Redshift support standard SQL
(`SELECT`, `JOIN`, `GROUP BY`, `ORDER BY`, window functions, CTEs) plus
**views**, which the exam explicitly names as an in-scope skill.

```
S3 (Parquet) ──▶ Athena view (saved SQL) ──▶ BI tool / dashboard
Redshift base tables ──▶ Redshift view ──▶ BI tool
```
A view doesn't store data — it stores the *query*. Every time it's
selected from, the underlying SQL re-runs against current data. This
matters operationally: an Athena view over a huge unpartitioned table
is exactly as expensive to scan as running the raw query yourself; a
view does not add caching.

**Explain like a senior AWS data engineer.** Views are the go-to answer
for **simplifying access for downstream consumers without duplicating
data** — e.g., exposing a "sales_last_90_days" view instead of forcing
every analyst to re-write the same filter and join logic, or hiding
sensitive columns behind a view for less-privileged users (though
column-level security is better handled by Lake Formation for
governance-grade control — a view is a convenience layer, not a
security boundary by itself in Athena).

**Exam traps.**
- ⚠️ A view in Athena/Redshift is **not materialized by default** — it
  re-executes underlying SQL each query. If the question wants
  pre-computed, cheap-to-query results, that's a **materialized view**
  (Redshift supports these natively with auto-refresh) or a **CTAS**
  table in Athena, not a plain view.
- ⚠️ Redshift materialized views can auto-refresh on a schedule or on
  underlying data change — the exam favorite phrase is "reduce repeated
  computation of the same complex aggregation" → materialized view.

**Interview question.** *"When would you use a materialized view
instead of a regular view?"* — When the same expensive aggregation or
join is queried repeatedly and the data doesn't need to be up-to-the-
second fresh — a materialized view pre-computes and caches the result,
trading a bit of staleness for dramatically faster reads.

<a name="324"></a>
## 3.2.4 Use Athena notebooks with Apache Spark

**Explain like I'm 12.** Sometimes a single SQL question isn't enough —
you need to explore, try things, look at a chart, try again. A notebook
is a scratchpad that remembers everything you tried.

**Explain technically.** **Athena for Apache Spark** lets you run
interactive Spark notebooks directly against data cataloged in Glue,
without provisioning an EMR cluster — Athena manages the Spark
execution environment behind the scenes, spinning up in seconds.

```
S3 (data lake) ──▶ Athena Notebook (Spark) ──▶ interactive exploration ──▶ Insights
```
This is the exam's answer for **interactive, code-based (not pure SQL)
exploratory analysis on data lake data with minimal setup** — a
middle ground between Athena SQL (fast but SQL-only) and full EMR
(powerful but requires cluster management).

**Explain like a senior AWS data engineer.** The distinguishing signal
versus regular Athena SQL: the question mentions **Spark-specific
operations** (complex UDFs, ML feature engineering, multi-step
programmatic transforms) or explicitly says "notebook" / "interactive
Python/Spark session." If it's plain SQL exploration, standard Athena
querying is simpler and cheaper — don't reach for the Spark notebook
just because Spark sounds more capable.

**Exam traps.**
- ⚠️ Athena notebooks avoid **cluster management entirely** — a
  question implying "we don't want to manage EMR infrastructure but
  need Spark" is a strong signal for Athena Spark notebooks over EMR.
- ⚠️ Athena notebooks are for **interactive/exploratory** work, not
  production scheduled ETL — for a scheduled Spark job, Glue ETL or EMR
  is still the right production answer.

**Interview question.** *"How would you let a data scientist run
exploratory Spark analysis on lake data without spinning up an EMR
cluster?"* — Athena for Apache Spark notebooks: same underlying catalog
and S3 data, interactive Python/Spark session, no cluster provisioning
or teardown to manage.

<a name="325"></a>
## 3.2.5 Provisioned vs serverless tradeoffs

**Explain like I'm 12.** A serverless service is like a taxi — you pay
per ride, show up when you need it, no maintenance. A provisioned
service is like owning a car — a fixed monthly cost, but it's always
ready and cheaper per mile if you drive a lot.

**Explain technically.**

| Attribute | **Serverless** | **Provisioned** |
|---|---|---|
| Management overhead | **Low** | Higher — capacity planning required |
| Cost model | Pay-per-use | Fixed instance/node-hours (RIs available) |
| Variable/unpredictable load | ✅ Best fit | ❌ Over- or under-provisions |
| Predictable, steady, high-volume load | ⚠️ Can cost more than provisioned + RIs | ✅ Best fit — Reserved Instances save up to ~75% |
| Idle cost | **Zero** (mostly) | Runs (and bills) even when idle |
| Examples | Athena, Glue, Lambda, Redshift Serverless, EMR Serverless, DMS Serverless | Redshift provisioned clusters, EMR (EC2) clusters, RDS instances |

**Explain like a senior AWS data engineer.** This is a **cost-modeling**
judgment, not a technology preference. A senior engineer sizes it with
actual numbers: a workload running near-continuously at high, steady
utilization is almost always cheaper on provisioned capacity with
Reserved Instances than paying serverless's per-request premium at that
volume. A workload that's idle most of the day and spikes
unpredictably is almost always cheaper serverless, because provisioned
capacity would otherwise sit idle and billing.

```
        Is the workload STEADY and PREDICTABLE, high utilization?
                              │
              ┌───────────────┴────────────────┐
             YES                                NO / spiky / unknown
              │                                  │
     PROVISIONED + Reserved Instances       SERVERLESS
     (cheaper per unit at sustained volume)  (no idle cost, scales instantly)
```

**Exam traps.**
- ⚠️ "Least operational overhead" almost always still points serverless
  even when cost is a secondary concern — overhead and cost are
  different axes, and the question's last sentence decides which one
  wins (see the constraint-family table in SERVICE-SELECTION-MATRIX.md
  Part 0).
- ⚠️ Serverless is not "always cheaper" — a steady, 24/7, high-
  concurrency Redshift warehouse is frequently *more* expensive on
  Serverless RPU pricing than on a Reserved provisioned cluster. The
  exam does test this the "wrong" way to catch reflexive
  serverless-is-always-better thinking.

**Interview question.** *"A workload runs 24/7 at consistent high
utilization — would you choose Redshift Serverless or provisioned?"* —
Provisioned with Reserved Instances, because steady, predictable,
high-utilization workloads are the exact profile RIs are priced to
reward; Serverless's per-RPU-hour convenience premium isn't worth
paying when there's no variability to absorb.

<a name="326"></a>
## 3.2.6 Aggregation, rolling average, grouping, pivoting

**Explain like I'm 12.** If you have a jar of coins from every day this
month, aggregation is counting the total, grouping is sorting coins by
day, a rolling average is "how much have I earned on average over the
last 7 days," and pivoting is turning your day-by-day list sideways
into a calendar view.

**Explain technically.**

| Operation | SQL construct | Example |
|---|---|---|
| **Aggregation** | `SUM()`, `COUNT()`, `AVG()`, `MIN()`, `MAX()` | Total revenue this quarter |
| **Grouping** | `GROUP BY` | Sales by region |
| **Rolling average** | Window function: `AVG(x) OVER (ORDER BY date ROWS BETWEEN 29 PRECEDING AND CURRENT ROW)` | 30-day trailing average revenue |
| **Pivoting** | Conditional aggregation or Redshift `PIVOT` / DataBrew pivot transform | Rows of (month, category, amount) → columns per month |

**Explain like a senior AWS data engineer.** Window functions
(`OVER (PARTITION BY ... ORDER BY ...)`) are the tool that separates a
junior analyst's SQL from a senior data engineer's — a rolling average
computed with a **self-join** is both slower and more error-prone than
the same result with a window function, and this exam's Domain 1
"apply programming concepts" section explicitly calls out window
functions and CTEs as expected skills. Redshift and Athena (via
Trino/Presto engine) both support full ANSI window function syntax.

```
date        revenue     rolling_30d_avg
2026-08-01   1,200          —  (fewer than 30 rows yet, partial window)
2026-08-02   1,350          1,275.0
   ...
2026-08-30   1,410          1,298.7   ← AVG over the 30 rows ending here
```
Each row's rolling average is computed over the trailing window ending
at that row — this is exactly the pattern behind "30-day average
revenue" trend dashboards.

**Exam traps.**
- ⚠️ Pivoting large datasets purely in DataBrew (no-code) works for
  moderate volume; at very large scale, pivoting is better expressed as
  conditional aggregation in Redshift/Athena SQL or a Spark
  `groupBy().pivot()` in Glue — a "petabyte scale, pivot monthly sales"
  question is not a DataBrew answer.
- ⚠️ `GROUP BY` collapses rows; window functions (`OVER`) **do not** —
  a question needing both an aggregate *and* the original row-level
  detail side by side is a `OVER()` signal, not `GROUP BY`.

**Interview question.** *"How would you compute a 7-day rolling average
of daily active users in Redshift?"* — A window function:
`AVG(daily_users) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)`
— far more efficient than a self-join across the last 7 days for every
row, and it keeps row-level granularity intact.

---

<a name="s33"></a>
# TASK 3.3 — MAINTAIN AND MONITOR DATA PIPELINES

<a name="331"></a>
## 3.3.1 Extract logs for audits

**Explain like I'm 12.** An audit is like a teacher checking your
homework diary to see exactly what you did and when — you need the
diary to actually contain everything, or the check is useless.

**Explain technically.**

```
Applications/Services ──▶ Logs (CloudWatch Logs, CloudTrail, EMR Logs,
                                 Glue Logs) ──▶ Audit review
```
Audit-relevant log sources: **CloudWatch Logs** (application/job
output), **CloudTrail** (who called which API, when, from where), **EMR
step/application logs** (persisted to S3 for post-cluster-termination
review), and **Glue job run logs** (driver/executor output, also in
CloudWatch).

**Explain like a senior AWS data engineer.** Extraction for audit isn't
just "find the logs" — it's ensuring logs **survive long enough** and
are **queryable at scale**. A senior engineer sets CloudWatch Logs
retention deliberately (never leave it at "Never expire" by accident —
that's a cost trap — but also never leave it at a short default when
compliance requires years of retention), and routes high-volume audit
logs to **S3 + Athena** for cost-effective long-term query instead of
paying CloudWatch's per-GB-ingested and per-GB-stored rates indefinitely.

**Exam traps.**
- ⚠️ EMR logs are **ephemeral on the cluster** by default — if the
  cluster terminates before logs are archived to S3, they're gone.
  Configure the S3 log URI at cluster creation, always, for anything
  audit-relevant.
- ⚠️ "Extract and retain logs for 7 years for compliance" → export
  CloudWatch Logs to S3 (or route directly there) and apply lifecycle
  policies to Glacier — don't just raise CloudWatch retention
  indefinitely, which is far more expensive per GB long-term.

**Interview question.** *"How do you make months of CloudWatch Logs
cheaply queryable for an audit?"* — Export/subscribe logs to S3 (via a
subscription filter or scheduled export), catalog them with Glue, and
query with Athena — pennies per query versus CloudWatch Logs Insights'
per-GB-scanned pricing at that retention depth.

<a name="332"></a>
## 3.3.2 Deploy logging and monitoring solutions

**Explain like I'm 12.** You don't wait for the smoke alarm to go off
by accident — you install it on purpose, in the right room, before
there's ever a fire.

**Explain technically.**

```
Application ──▶ CloudWatch Logs ──▶ CloudWatch Metrics ──▶ CloudWatch Dashboard
```
Best practices: **centralize** logs (one log group strategy per
environment/service, not scattered ad hoc), define **retention
policies** explicitly per log group, build **metric filters** that
convert log patterns (e.g., the string `"ERROR"`) into numeric
CloudWatch metrics, and assemble **dashboards** that put related
metrics from ingestion, transformation, and load stages on one screen
for fast triage.

**Explain like a senior AWS data engineer.** The senior engineer
designs monitoring **before** the pipeline ships, not after the first
incident. That means: naming conventions for log groups that make
cross-service correlation possible (shared request/execution IDs
threaded through logs), alarms tied to the metrics that actually
predict failure (queue depth, IteratorAge, DPU utilization) rather than
only reactive ones (job failed), and a dashboard scoped to the whole
pipeline (see the Part 0 architecture diagram) — not just one service
in isolation.

**Exam traps.**
- ⚠️ "Deploy monitoring with least operational overhead" → CloudWatch
  (native, no infrastructure to run) beats standing up a self-managed
  Prometheus/Grafana stack, even though the latter is more flexible.
- ⚠️ A dashboard alone with no **alarms** doesn't satisfy "detect
  issues proactively" — dashboards are for humans watching; alarms are
  for automated detection.

**Interview question.** *"What's your first monitoring decision for a
new pipeline?"* — Instrument every stage to emit CloudWatch metrics and
logs from day one, define alarms on the metric that predicts failure
earliest for each stage (e.g., IteratorAge rather than only downstream
job failure), and route alarms to a notification channel — not bolt it
on after the first outage.

<a name="333"></a>
## 3.3.3 Notifications during monitoring

**Explain like I'm 12.** The smoke alarm is useless if it beeps in an
empty house — someone (or something) has to actually get the message
and act.

**Explain technically.**

```
CloudWatch Alarm ──▶ SNS ──▶ Email / SMS / Lambda (auto-remediation)
```
A CloudWatch alarm transitions state (OK → ALARM) based on a metric
crossing a threshold, and SNS fans that alarm out to one or many
subscribers — a human via email/SMS, or another Lambda function that
attempts automated remediation (e.g., restart a stuck Glue job, scale
up a resource).

**Explain like a senior AWS data engineer.** The senior-level nuance is
choosing SNS vs SQS for the notification target: **SNS** for
"immediately notify all subscribers" (fan-out, at-most-once delivery
attempt per subscriber), **SQS** when the receiving side needs
**durable, buffered, at-your-own-pace processing** (e.g., a
remediation Lambda that shouldn't be invoked in an unbounded burst).
A common production pattern is SNS → SQS fan-out, giving you both
immediate human notification and a durable queue for automated
follow-up.

**Exam traps.**
- ⚠️ SNS vs SQS is a classic 25-head-to-head exam pairing: **SNS**
  pushes to multiple subscribers immediately; **SQS** holds messages
  for a single consumer to pull at its own pace. A "guarantee no
  message is lost even if the consumer is briefly down" requirement
  points to SQS (or SNS→SQS), not plain SNS alone.
- ⚠️ Alarms configured on `Missing Data` treated as "not breaching" can
  silently mask an entirely stopped pipeline — a pipeline that emits
  *zero* data points looks the same as "not breaching" unless you
  explicitly configure missing-data treatment.

**Interview question.** *"How would you make sure an alert about a
failed job is never silently dropped?"* — CloudWatch alarm → SNS topic
with multiple subscription types (email + a Lambda for auto-
remediation), and route the same alarm to an SQS queue as a durable
backstop so a remediation consumer that's briefly unavailable doesn't
lose the message.

<a name="334"></a>
## 3.3.4 Troubleshoot performance issues

**Explain like I'm 12.** If your bike suddenly feels hard to pedal, you
don't just push harder — you check if the chain is stuck, a tire is
flat, or you're carrying too much in the basket.

**Explain technically.** Universal framework:

```
Problem ──▶ Metrics ──▶ Logs ──▶ Resource Analysis ──▶ Fix
```
This mirrors Guard Rail #4 from Part 1 — never skip straight to "add
more resources" without reading what the metrics and logs actually say
first.

**Common root causes by service:**

| Service | Common root cause | Signal | Fix |
|---|---|---|---|
| **Glue** | Insufficient workers / OOM | Executor memory near 100%, spill to disk in Spark UI | Bigger worker type (G.1X → G.2X) |
| Glue | Data skew | One task takes vastly longer than others | Repartition or salt the key |
| **EMR** | Small files | Many short tasks, high per-task overhead | Compact files before processing |
| EMR | Shuffle overhead | Long shuffle-read/write phases in Spark UI | Reduce shuffle partitions, broadcast small tables |
| EMR | Partition problems | Uneven task durations across executors | Repartition on a higher-cardinality key |
| **Athena** | No partitioning | `DataScannedInBytes` very high for a narrow query | Add partitioning on filter columns |
| Athena | CSV instead of Parquet | Slow scan, high cost per query | Convert to columnar Parquet + compression |

**Explain like a senior AWS data engineer.** The senior engineer treats
"add more compute" as a **last resort**, not a first response — it
often masks the real problem (skew, small files, missing partitioning)
and just makes the wasted work happen on more expensive hardware.
Correctly diagnosing *which* of the causes above applies (by reading
Spark UI stage timelines or `DataScannedInBytes`) before touching
capacity is the difference between a permanent fix and a recurring,
increasingly expensive symptom.

**Exam traps.**
- ⚠️ "Job is slow, resize the cluster" is the tempting-but-wrong answer
  whenever the stem also mentions symptoms of skew (one task/partition
  vastly larger than others) — the correct fix is repartitioning or
  salting, not scale.
- ⚠️ Athena "slow and expensive" nearly always traces to **format and
  partitioning**, not an Athena capacity limit (Athena has no capacity
  to tune — it's fully serverless).

**Interview question.** *"A Glue job that ran fine last week now takes
3x longer — what's your first move?"* — Check CloudWatch/Glue job
metrics for DPU/executor memory utilization and the Spark UI for skewed
stage durations or spill-to-disk, and check whether input data volume
or file count changed — only after that do you decide between bigger
workers, repartitioning, or fixing an upstream small-file problem.

<a name="335"></a>
## 3.3.5 Use CloudTrail

**Explain like I'm 12.** CloudTrail is the security camera at every
door in the building — it doesn't stop anyone, but it remembers exactly
who walked through which door and when.

**Explain technically.**

```
User / API caller ──▶ CloudTrail ──▶ Audit history (who, what, when, from where)
```
CloudTrail logs every AWS API call. **Management events** (create,
modify, delete a resource — e.g., "who changed this Glue job") are
logged **by default, free**. **Data events** (object-level operations —
e.g., "who read this specific S3 object," DynamoDB item-level API
calls) are **not enabled by default and cost extra** per event logged.

**Explain like a senior AWS data engineer.** This distinction is the
single most-tested CloudTrail fact on the exam. A senior engineer
knows precisely which question shape needs which event type: "who
changed the pipeline configuration" → management events (already on).
"Who read this specific sensitive object" or "prove nobody accessed
this PII file" → **data events, explicitly enabled**, because reads/
writes at the object level are invisible to management events alone.
**CloudTrail Lake** is the newer, SQL-queryable managed data store for
trail data — the answer when a question wants centralized, queryable
audit history across accounts/regions without standing up your own
Athena-over-S3 pipeline.

**Exam traps.**
- ⚠️ "Who accessed this S3 object" with CloudTrail **not** configured
  for data events → the honest answer is "you can't tell, retroactively
  — data events must be turned on in advance." This is frequently
  tested as a "what should have been configured beforehand" question.
- ⚠️ CloudTrail answers **who/what/when**, not **performance** — a
  question about latency or throughput is never a CloudTrail answer,
  even if it superficially mentions "tracking."

**Interview question.** *"How do you prove nobody read a specific
sensitive file in S3 last month?"* — Only possible if **S3 data
events** were enabled in CloudTrail *before* the period in question;
query CloudTrail (directly, via CloudTrail Lake, or via Athena over the
trail's S3 logs) filtered to `GetObject` calls on that key. If data
events weren't enabled, there is no retroactive answer — which is
itself the point a senior engineer makes proactively during design.

<a name="336"></a>
## 3.3.6 Troubleshoot and maintain pipelines

**Explain like I'm 12.** When the whole assembly line stops, you don't
guess — you walk the line from the start and find exactly which
machine jammed.

**Explain technically.**

| Service | First things to check |
|---|---|
| **Glue** | Job run logs, worker utilization/DPU metrics, **job bookmark** state (is it stuck pointing at an old position, or did someone reset it unintentionally) |
| **EMR** | Spark UI (stage/task timelines), YARN ResourceManager logs, executor metrics (memory, GC time) |

```
Failure ──▶ Logs ──▶ Metrics ──▶ Root Cause
```

**Explain like a senior AWS data engineer.** Job bookmarks deserve
special attention because they're a uniquely Glue-specific failure
mode: a bookmark that's **stuck** (not advancing) silently reprocesses
the same old data forever; a bookmark that was **reset accidentally**
causes a full historical reprocess that can blow through cost and time
budgets unexpectedly. A senior engineer checks bookmark state
explicitly as part of "why is this job producing wrong/duplicate
results," not just "why is it slow."

**Exam traps.**
- ⚠️ "Job keeps reprocessing the same data" → check whether **job
  bookmarks are even enabled** on the job — this is a configuration
  toggle, not automatic.
- ⚠️ "Need to reprocess all historical data after a bug fix" → **reset
  the bookmark**, not "disable bookmarks" (disabling just stops future
  tracking; it doesn't rewind state).

**Interview question.** *"A Glue job is producing duplicate records
after a rerun — what do you check?"* — Whether job bookmarks are
enabled and correctly tracking processed state; if bookmarks were
disabled or the job's transformation context changed, the job may be
reprocessing files it already handled, producing duplicates downstream.

<a name="337"></a>
## 3.3.7 Use CloudWatch Logs

**Explain like I'm 12.** CloudWatch Logs is a diary that every app
writes in automatically — every "something happened" gets a timestamped
entry.

**Explain technically.**

```
Application ──▶ CloudWatch Logs ──▶ Metric Filters ──▶ Alarms
```
A **metric filter** turns a text pattern in your logs (e.g., a line
containing `"ERROR"` or a specific exception class) into a numeric
CloudWatch metric you can alarm on — this is how unstructured log text
becomes something an alarm can watch.

```
AUTOMATION PATTERN:
   Error Log line appears ──▶ Metric Filter increments a counter
        ──▶ Alarm fires when count > threshold ──▶ SNS notification
```

**Explain like a senior AWS data engineer.** The senior-level insight:
metric filters + alarms let you get **CloudWatch-native alerting on
application-level errors** without needing the application to
explicitly call `PutMetricData` — the app just logs normally, and
CloudWatch does the pattern matching. This is significantly lower
effort than instrumenting custom metrics everywhere, and is the default
answer for "alert on application error patterns in existing logs."

**Exam traps.**
- ⚠️ CloudWatch Logs retention defaults to **never expire** unless you
  set it — a cost-conscious question about ballooning CloudWatch bills
  often traces back to this default being left unset.
- ⚠️ A metric filter counts **matching log events**, not something
  more exotic — don't overcomplicate; "alert when an error pattern
  appears N times in M minutes" is exactly this mechanism.

**Interview question.** *"How do you alert on a specific exception type
appearing in application logs, without changing application code?"* —
A CloudWatch Logs metric filter matching the exception pattern,
incrementing a custom metric, with an alarm on that metric routed to
SNS — zero code changes required.

<a name="338"></a>
## 3.3.8 Analyze logs

**Explain like I'm 12.** Different questions about your diary need
different tools — sometimes you just want to search this week's
entries fast, sometimes you want to run real math across years of
entries.

**Explain technically.**

| Need | Tool |
|---|---|
| Interactive, fast search across recent logs | **CloudWatch Logs Insights** |
| SQL-style analysis, cheap at large historical volume | **Athena** (over logs exported to S3) |
| Full-text search, fuzzy/relevance-ranked search | **Amazon OpenSearch Service** |
| Big-data-scale log analytics (joins, ML feature prep on log data) | **EMR** |

```
CloudWatch Logs ──▶ (a) Logs Insights (interactive query, recent data)
                 ──▶ (b) Export/subscribe ──▶ S3 ──▶ Athena (cheap, large-scale)
```
Path (a) is fast for "what happened in the last few hours/days" —
Logs Insights queries run directly against live log groups with a
purpose-built query language. Path (b) is the answer once you need
**months of history, complex joins, or dashboard integration at low
cost** — CloudWatch Logs Insights charges per GB scanned per query and
gets expensive at long retention depth; S3 + Athena is dramatically
cheaper for the same historical volume.

**Explain like a senior AWS data engineer.** OpenSearch enters the
picture specifically when the requirement is **full-text/fuzzy search**
or a **Kibana-style dashboard** over log data — not just "I need to
query logs." A question that says "SQL-style" or "cost-effective at
scale" points at Athena; a question that says "search," "relevance
ranking," or "Kibana" points at OpenSearch; a question wanting fast,
interactive, recent-log troubleshooting points at Logs Insights.

**Exam traps.**
- ⚠️ CloudWatch Logs Insights is **not** a long-term-cheap solution —
  it's priced per GB scanned per query, which adds up fast at high
  retention. Athena-over-S3 is the cost-optimized answer for large
  historical volumes.
- ⚠️ Don't reach for OpenSearch just because a question says "log
  analytics" — if there's no full-text search or Kibana requirement,
  it's over-engineering; Logs Insights or Athena is simpler and cheaper.

**Interview question.** *"You need to search a year of application logs
for a specific error signature, cost-effectively — what do you use?"*
— Export/route CloudWatch Logs to S3, catalog with Glue, and query with
Athena — far cheaper at that retention depth than scanning a year of
data through CloudWatch Logs Insights.

<a name="339"></a>
## 3.3.9 Amazon Macie for sensitive-data monitoring

**Explain like I'm 12.** Macie is a metal detector that walks through
every file in your bucket looking specifically for things like credit
card numbers and social security numbers, and waves a flag when it
finds one.

**Explain technically.** **Amazon Macie** uses machine learning and
pattern matching to automatically discover and classify **sensitive
data** (PII, PHI, credentials, financial data) in S3 buckets. It
produces findings you can route to EventBridge for automated response
(e.g., quarantine the object, alert the security team, trigger a Lake
Formation permission review).

```
S3 buckets ──▶ Macie (scan + classify) ──▶ Findings (PII/PHI detected)
                                                 │
                                                 v
                                    EventBridge ──▶ SNS / Lambda (remediate)
```

**Explain like a senior AWS data engineer.** Macie belongs firmly in
Domain 3's monitoring/audit story even though it's also a Domain 4
governance tool — the exam guide explicitly lists Macie under 3.3's
"maintain and monitor" skills. A senior engineer runs Macie
**continuously** (scheduled jobs), not as a one-time scan, because new
objects land in a data lake constantly and yesterday's clean bucket can
have PII in it tomorrow. Macie findings feeding into an automated
EventBridge → Lambda remediation loop is the production pattern — not
a human periodically reading a Macie report.

**Exam traps.**
- ⚠️ Macie discovers **sensitive data content**; it does not enforce
  access control by itself — pair it with Lake Formation or S3 bucket
  policies for the actual restriction. Macie tells you *what and
  where*; Lake Formation/IAM decide *who can see it*.
- ⚠️ "Find PII across all our S3 buckets automatically" is a direct
  reflex trigger for Macie — don't overthink into Glue Data Quality
  (which validates structured field-level rules, not unstructured
  PII discovery) or DataBrew (manual/interactive, not automated
  org-wide scanning).

**Interview question.** *"How would you continuously ensure no new PII
lands unencrypted in a shared data lake bucket?"* — Schedule recurring
Macie jobs against the bucket(s), route findings through EventBridge to
an automated response (quarantine object, alert, or trigger a policy
review) rather than relying on manual periodic audits.

---

<a name="s34"></a>
# TASK 3.4 — ENSURE DATA QUALITY

<a name="341"></a>
## 3.4.1 Run data quality checks

**Explain like I'm 12.** Before a batch of cookies goes out the door,
someone checks: are any missing chocolate chips, are any burnt, are any
the wrong size?

**Explain technically.** Core check categories:

| Check | Example |
|---|---|
| **Null validation** | `customer_id` should never be null |
| **Duplicate detection** | `order_id` should be unique |
| **Range validation** | `age` should be between 0 and 120 |
| **Format validation** | `email` should match a valid pattern |
| **Completeness** | Row count within expected daily range |

```
Source Data ──▶ Quality Rules ──▶ Pass / Fail (gate downstream processing)
```
The critical design decision is **where this gate sits**: at ingest
(reject bad records before they ever land), in-flight (Glue Data
Quality node inside an ETL job, halting the job on failure), or
post-load (a scheduled Athena/DataBrew check that flags but doesn't
block). Production-grade pipelines increasingly push the gate
**upstream**, catching bad data before it contaminates curated zones.

**Explain like a senior AWS data engineer.** The senior engineer's
question is never just "does this rule exist" but "**what happens when
it fails**." A check with no defined failure action (log-only) is
useful for observability but won't stop bad data from propagating; a
check wired to **halt the job / quarantine the batch** is what actually
protects downstream consumers. This distinction — detect vs. block —
is exactly what Glue Data Quality's pass/fail actions formalize (see
3.4.2).

**Exam traps.**
- ⚠️ "Catch bad data before it reaches the dashboard" implies the check
  must run **before** the load step, not as a nightly report reviewed
  after the fact.

**Interview question.** *"Where in a pipeline should data quality
checks run?"* — As early as feasible — ideally as a gate between raw
and curated zones — so a failing check halts propagation rather than
letting bad data reach a dashboard or downstream consumer before
anyone notices.

<a name="342"></a>
## 3.4.2 Define data quality rules — DataBrew and Glue Data Quality (DQDL)

**Explain like I'm 12.** Imagine two different quality inspectors at a
toy factory. One walks the floor with a clipboard, eyeballing toys and
making quick judgment calls (DataBrew). The other has a strict written
checklist bolted right onto the assembly line that automatically stops
the belt if a toy fails (Glue Data Quality) — a formal rulebook, not a
person's opinion.

**Explain technically — two different tools, two different jobs.**

**DataBrew data-quality rules** are defined interactively through the
DataBrew UI as part of profiling/cleaning — good for exploratory,
analyst-driven checks: "no null values," "valid email format," "unique
customer ID," "positive revenue." They're easy to set up without code
and pair naturally with DataBrew's profiling output, but they live
inside the DataBrew workflow, not natively inside a Glue Spark ETL job.

```
DataBrew Rules (UI-defined) ──▶ Validation (during a DataBrew job) ──▶ Clean Data
```

**AWS Glue Data Quality** is the exam-correct, production-grade answer
for **codified, automated rules enforced directly inside a Glue ETL
job** — expressed in **DQDL (Data Quality Definition Language)**, a
purpose-built rule syntax. This is explicitly named in the DEA-C01 exam
guide and deserves to be memorized at the syntax level.

**DQDL example ruleset:**

```
Rules = [
    Completeness "customer_id" > 0.99,
    IsUnique "order_id",
    ColumnValues "status" in ["PENDING", "SHIPPED", "DELIVERED", "CANCELLED"],
    ColumnValues "order_total" > 0,
    RowCount between 10000 and 500000,
    IsComplete "email",
    ColumnValues "email" matches "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$"
]
```

Reading this ruleset line by line: `Completeness "customer_id" > 0.99`
requires at least 99% of rows to have a non-null `customer_id`.
`IsUnique "order_id"` fails the rule if any `order_id` value repeats.
`ColumnValues "status" in [...]` enforces an enumerated set of valid
values — anything outside the list fails. `ColumnValues "order_total" >
0` catches negative or zero totals that indicate upstream corruption.
`RowCount between 10000 and 500000` catches both truncated loads (too
few rows) and duplicate/runaway loads (too many). `IsComplete "email"`
requires every row to have a non-null email. `matches` applies a regex
format check.

**How DQDL integrates with a Glue job — the pass/fail action:**

```
Glue ETL Job
   │
   ├──▶ Evaluate Data Quality node (DQDL ruleset applied to a DynamicFrame)
   │        │
   │        ├── PASS ──▶ continue to next transform/load step
   │        │
   │        └── FAIL ──▶ configurable action:
   │                        • Fail the job (halt entirely)
   │                        • Continue but write failed rows to a
   │                          separate "quarantine" output for review
   │                        • Publish a CloudWatch metric / EventBridge
   │                          event so downstream automation can react
   v
Curated S3 / Redshift (only receives data that passed the gate,
if configured to halt-on-fail)
```

The **Evaluate Data Quality** transform node sits inline in the Glue
job's DAG. Its outcome branches: a passing evaluation lets the
DynamicFrame continue downstream unchanged; a failing evaluation can be
configured to **fail the entire job run** (the strict, gate-the-
pipeline behavior), or to **route only the failing rows** to a
quarantine location while still loading everything that passed
(the permissive, don't-block-good-data behavior) — the choice depends
on whether the business would rather have late data or wrong data.

**Explain like a senior AWS data engineer.**

| Attribute | **DataBrew data quality** | **Glue Data Quality (DQDL)** |
|---|---|---|
| Purpose | Interactive, analyst-driven checks during data prep | Codified, automated rules enforced inside production ETL |
| When to use | Exploratory cleaning, business-analyst self-service | Production pipelines that must gate bad data automatically |
| When NOT to use | Production pipelines needing automated pass/fail gating at scale | One-off exploratory profiling by a non-engineer |
| Rule expression | UI-driven, prebuilt rule templates | **DQDL** — a dedicated rule language, version-controllable as code |
| Integrates with Glue Spark jobs natively | ❌ (separate workflow) | ✅ **Evaluate Data Quality** node inline in the job DAG |
| Pass/fail automation | Limited | ✅ Configurable: fail job, quarantine bad rows, or emit metrics |
| Real enterprise example | A retail analyst self-serving cleanup of a promo file before a one-off report | A bank's nightly loan-origination ETL halting automatically if `IsUnique "loan_id"` fails, preventing duplicate-loan records from ever reaching the warehouse |

A senior engineer picks Glue Data Quality whenever the requirement says
"**automatically**," "**as part of the ETL job**," or "**prevent bad
data from reaching**" a downstream target — DataBrew's rules are a
weaker, more manual answer to the same intent. DataBrew wins only when
the actor doing the defining is explicitly a **business analyst without
coding skills**, doing **interactive** prep work.

**Exam traps.**
- ⚠️ The exam guide names **both** DataBrew and Glue Data Quality/DQDL
  under 3.4 — don't assume only one is correct. Match the tool to the
  actor and context: analyst + interactive → DataBrew; automated +
  inside a Glue Spark job + codified rules → Glue Data Quality/DQDL.
- ⚠️ A question describing rule syntax, thresholds, or "the job should
  fail if 5% of rows are null" is a strong DQDL signal — DataBrew rules
  aren't expressed with that kind of precise, code-like threshold
  language.
- ⚠️ Glue Data Quality is **not** the same as Macie — DQDL validates
  **structured field-level correctness** (completeness, uniqueness,
  ranges, formats) that you define; Macie discovers **unstructured
  sensitive-data content** (PII patterns) you didn't necessarily know
  was there. They solve different problems and are not interchangeable
  in an answer.

**Interview questions.**
- *"How would you stop a Glue job from loading duplicate loan records
  into a banking data warehouse?"* — Add an **Evaluate Data Quality**
  node with a DQDL rule `IsUnique "loan_id"`, configured to fail the
  job run (or quarantine the offending rows) rather than let them
  reach the curated table — codified and automatic, not a manual
  post-load check.
- *"Why might you choose DataBrew rules over Glue Data Quality for a
  particular team?"* — When the team defining the rules is business
  analysts without Spark/DQDL experience and the workflow is
  interactive/exploratory rather than a scheduled production ETL job —
  DataBrew trades automation depth for accessibility.

<a name="343"></a>
## 3.4.3 Investigate data consistency

**Explain like I'm 12.** If you packed 100 apples into a truck, you'd
better count 100 apples when it arrives — if only 97 show up, something
went wrong on the way.

**Explain technically.**

```
Source ──▶ Compare ──▶ Target
```
Standard consistency checks: **source count vs target count**
(detect silent row loss), **duplicate detection** post-load (did a
retry or a bug double-insert rows), **missing records** (spot-check
specific known keys that should exist), and **transformation
accuracy** (does a sampled row's transformed value match hand-
calculated expectations).

**Explain like a senior AWS data engineer.** Consistency investigation
is where a senior engineer's instinct to distrust "it ran successfully"
pays off — a job can report SUCCESS while silently dropping rows (e.g.,
a bad join that turns an inner join into an accidental filter, or a
schema mismatch that DynamicFrame's `resolveChoice` quietly coerces).
The defense is an automated **count reconciliation step** appended to
every load: compare `SELECT COUNT(*)` on source vs target (or a hash/
checksum comparison for stronger guarantees) as a standard pipeline
step, not an ad-hoc afterthought.

**Exam traps.**
- ⚠️ "Job succeeded but the warehouse looks wrong" — the answer is
  almost never "check IAM permissions" (that would have failed the
  job outright); it's investigate **transformation logic and row
  counts** — permissions failures are loud, data-quality failures are
  silent.

**Interview question.** *"A nightly load reports success but the
Redshift table has fewer rows than the source table — how do you
investigate?"* — Compare source and target row counts as a standard
post-load check (should be automated, not manual); if counts diverge,
check the transformation step for an unintended filter (a join that
silently drops unmatched rows, a `WHERE` clause that's too strict, or a
Glue DynamicFrame schema-resolution choice dropping malformed records).

<a name="344"></a>
## 3.4.4 Describe data sampling techniques

**Explain like I'm 12.** You don't have to eat a whole pot of soup to
know if it needs more salt — a spoonful tells you enough, as long as
you stir first and grab a fair spoonful.

**Explain technically.**

| Technique | How it works | Use when |
|---|---|---|
| **Random sampling** | Every row has equal probability of selection | General-purpose validation, quick sanity check |
| **Stratified sampling** | Sample proportionally within each category/subgroup | Dataset has known categories and you need each represented fairly (e.g., sample equally across regions) |
| **Systematic sampling** | Take every Nth row | Very large datasets, simple to implement, assumes no periodic pattern in the data |
| **Cluster sampling** | Select entire groups/clusters wholesale (e.g., all records from a few randomly chosen partitions) | Data is naturally grouped/distributed (e.g., by date partition) and you want to validate whole slices cheaply |

**Explain like a senior AWS data engineer.** The exam-relevant judgment
is matching technique to **why you're sampling**. Validating overall
data health with no known subgroup bias → random sampling is simplest
and sufficient. Validating that a minority category (e.g., a small but
critical customer segment) isn't silently broken → stratified sampling,
because random sampling alone might barely touch that segment.
Profiling a massive dataset cheaply by only reading a few partitions →
cluster sampling, which is far cheaper on S3-partitioned data than a
full scan-based random sample.

**Exam traps.**
- ⚠️ "Ensure every category is represented fairly in validation" is a
  direct trigger for **stratified**, not random — random sampling can
  easily under-represent small categories by chance.
- ⚠️ Systematic sampling ("every Nth row") can produce misleading
  results if the data itself has a periodic pattern that aligns with N
  — a subtle trap if a question hints at cyclical data (e.g., every 7th
  row always being a Monday).

**Interview question.** *"You need to validate a dataset where 95% of
records are from one customer segment and 5% from a critical but small
segment — which sampling technique?"* — Stratified sampling, so the
small segment is proportionally represented in the sample instead of
being nearly invisible under pure random sampling.

<a name="345"></a>
## 3.4.5 Implement data skew mechanisms

**Explain like I'm 12.** If ten kids are supposed to carry ten boxes
each, but one kid gets assigned 990 boxes, that one kid finishes last
no matter how strong they are — the whole class waits on them.

**Explain technically — what data skew is.**

```
Partition 1:        10 records
Partition 2:        20 records
Partition 3:  1,000,000 records   ← one worker massively overloaded
```
One Spark task/executor gets a disproportionate share of the data
(usually because of an uneven join key or partition key), so the whole
job's runtime is bounded by that one slow task — adding more workers
doesn't help, because the other workers finish fast and sit idle while
the skewed one grinds on.

**Explain like a senior AWS data engineer — solutions and when each
applies.**

| Solution | Mechanism | Use when |
|---|---|---|
| **Repartition** | Redistribute records more evenly across partitions, ideally on a higher-cardinality key | General skew where no single key dominates |
| **Salting** | Append a random suffix to a hot key before grouping/joining, splitting one overloaded key into several (`Customer123` → `Customer123_A`, `Customer123_B`, `Customer123_C`), then aggregate results back together | One (or a few) specific keys are disproportionately hot — classic "celebrity user" or "top customer" skew |
| **Broadcast joins** | Send the small table's full data to every executor's memory instead of shuffling the large table across the network | Joining one very small table with one very large table — avoids shuffling the large side entirely |

```
SALTING, STEP BY STEP
  Before:  key = "Customer123"           (all rows land on ONE partition)
  Salt:    key = "Customer123_" + random(A,B,C)   (spreads rows across 3)
  Group:   aggregate per salted key on each partition (parallel, fast)
  Combine: re-aggregate the 3 partial results into the final total
           for "Customer123"
```
Salting works because Spark's shuffle groups by *exact* key — by
manufacturing several distinct keys out of one hot key, you force the
shuffle to distribute that customer's rows across multiple partitions
instead of funneling them all to one. The extra "combine" step is the
cost you pay for that parallelism.

A senior engineer reaches for **broadcast joins** first when
applicable — it's the cheapest fix (no shuffle of the large table at
all) but only works when one side is genuinely small enough to fit in
executor memory (Spark's default auto-broadcast threshold is
configurable). When the skew is inherent to the *data itself* rather
than a join-size mismatch (one customer genuinely has a million
events), salting is the correct, more surgical fix — plain
repartitioning alone won't help if the skew comes from one dominant
key value rather than uneven partition assignment.

**Explain production architecture.**

```
Symptom: EMR/Glue job's Spark UI shows one task taking 45 minutes
         while 199 other tasks finish in 90 seconds.
              │
              v
   Is it a JOIN with one tiny + one huge table? ──yes──▶ Broadcast join
              │ no
              v
   Is ONE specific key value dominating the data? ──yes──▶ Salting
              │ no
              v
   Just generally uneven partition sizes? ──────────────▶ Repartition
```

**Exam traps.**
- ⚠️ "The job is slow, one task is taking far longer than the rest" is
  the textbook skew symptom — the wrong answer is "add more workers";
  the right answer is one of repartition/salt/broadcast depending on
  the specific cause.
- ⚠️ Salting requires a **combine/re-aggregate** step afterward —
  a question that stops at "add a random suffix to the key" without
  addressing how the final aggregate is reassembled is describing an
  incomplete (and likely wrong-answer) implementation.
- ⚠️ Broadcast joins only work when one side is **small enough for
  executor memory** — "join two similarly massive tables" is not a
  broadcast-join scenario; that's repartitioning territory instead.

**Interview question.** *"You're joining a 2 TB clickstream table with
a 50 MB product-catalog table in Spark, and it's slow — what's the
first thing you try?"* — A broadcast join: send the 50 MB catalog table
to every executor's memory so the 2 TB table never has to be shuffled
across the network for the join — dramatically cheaper than a standard
shuffle join when the size asymmetry is this large.

---

<a name="trees"></a>
## DECISION TREES

### Tree 1 — Which orchestration service?

```
                    Does the workflow need STATE
                 (retries, branching, step dependencies)?
                              │
              ┌───────────────┴────────────────┐
             NO                                YES
              │                                  │
        Simple schedule                  Existing Airflow DAGs, or
        or content-based                 complex Python operator deps?
        routing only                              │
              │                     ┌───────────────┴────────────────┐
     EVENTBRIDGE (rule or          YES                                NO
     Scheduler)                     │                                  │
                                   MWAA                    Only chaining Glue
                                                             jobs/crawlers?
                                                                    │
                                                      ┌──────────────┴─────────────┐
                                                     YES                            NO
                                                      │                              │
                                              GLUE WORKFLOWS (free)          STEP FUNCTIONS
                                                                          (Standard for long-running
                                                                           + audit trail; Express for
                                                                           high-volume short executions)
```

### Tree 2 — Which log-analysis tool?

```
                         What do you need to do with the logs?
                                        │
        ┌───────────────┬───────────────┼───────────────────┐
   Fast, interactive   SQL-style,     Full-text /       Big-data-scale
   search on RECENT    cost-effective  relevance-ranked  analytics
   logs                at LARGE scale  search, Kibana    (joins, ML prep)
        │                   │               │                   │
  CLOUDWATCH LOGS      S3 + ATHENA    OPENSEARCH SERVICE      EMR
     INSIGHTS         (export/route
                        logs first)
```

### Tree 3 — DataBrew rules vs Glue Data Quality (DQDL)?

```
              Who defines the rule, and where does it run?
                              │
        ┌──────────────────────┴───────────────────────┐
  Business analyst,                          Must run automatically
  interactive, no code,                      INSIDE a Glue Spark ETL
  exploratory prep                           job, with a pass/fail
        │                                    gate on production data
   DATABREW RULES                                      │
                                              GLUE DATA QUALITY (DQDL)
                                        "fail the job if X% of rows
                                         are null / not unique / out
                                         of range" ← precise threshold
                                         language is the tell
```

---

<a name="metrics"></a>
## Signature CloudWatch metric per service (heavily tested)

| Service | Metric | Bad-value meaning |
|---|---|---|
| **Kinesis Data Streams** | `GetRecords.IteratorAgeMilliseconds` | Consumers falling behind the stream |
| **Amazon Data Firehose** | `DeliveryToS3.Success`, `ThrottledRecords` | Delivery failing — check IAM/KMS |
| **DynamoDB** | `ThrottledRequests`, `ConsumedReadCapacityUnits` | Hot partition or under-provisioned capacity |
| **AWS Glue** | Driver/executor memory utilization, `numFailedTasks` | Skew, OOM, undersized workers |
| **Amazon Redshift** | `WLMQueueLength`, `WLMQueueWaitTime` | Queries queuing — consider concurrency scaling |
| **Amazon Athena** | `DataScannedInBytes`, `QueryQueueTime` | Cost problem or concurrency-limit contention |
| **AWS Lambda** | `Throttles`, `Duration`, `Errors` | Concurrency limit hit, or approaching timeout |
| **Amazon EMR** | `YARNMemoryAvailablePercentage`, `ContainerPending` | Cluster undersized for the workload |
| **AWS Step Functions** | `ExecutionsFailed`, `ExecutionsTimedOut` | Workflow-level failures |
| **Amazon S3** | `4xxErrors`, `5xxErrors` | Permissions problems or client-side throttling |

---

<a name="mnemonics"></a>
## MNEMONICS

- **"Deny Stops Really Powerful Session Identities"** — IAM policy
  evaluation order: Deny → SCP → Resource policy → Permissions boundary
  → Session policy → Identity policy.
- **"PMLR"** for troubleshooting order — **P**roblem →
  **M**etrics → **L**ogs → **R**esource analysis → fix. Never skip
  straight to "add resources."
- **"3 R's of skew"** — **R**epartition (general unevenness),
  salt-and-**R**eaggregate (one hot key), b**R**oadcast (tiny table +
  huge table join).
- **"CloudTrail = WHO, CloudWatch = HOW, X-Ray = WHERE, Config =
  CORRECT"** — who did it, how healthy is it, where's the latency, is
  it configured correctly.
- **"DQDL bolts to the belt, DataBrew walks the floor"** — Glue Data
  Quality is automated and inline in the Glue job DAG; DataBrew rules
  are interactive/manual, defined by an analyst outside a coded
  pipeline.
- **"SNS pushes, SQS parks"** — SNS immediately fans out to
  subscribers; SQS holds messages until a consumer is ready to pull
  them.
- **"Data events cost, management events are free (and default-on)"**
  — for CloudTrail: management = who changed *config*, free, on by
  default; data = who touched *content* (S3 object, DynamoDB item),
  costs extra, off by default.
- **"MWAA is never the cheap answer"** — always-on environment-hours;
  only wins when Airflow already exists.

---

<a name="cheat"></a>
## DOMAIN 3 CHEAT SHEET (scenario → service)

| Scenario phrase | Answer |
|---|---|
| Simple scheduled trigger | EventBridge Scheduler |
| Event-content-based routing | EventBridge rule |
| Stateful workflow, retries, branching | Step Functions |
| Existing Airflow DAGs | MWAA |
| Chain only Glue jobs/crawlers | Glue Workflows (free) |
| Programmatic AWS access from code | AWS SDK (boto3) |
| No-code data prep for analysts | Glue DataBrew |
| Automated, codified quality gate inside a Glue job | Glue Data Quality (DQDL) |
| Ad-hoc SQL on S3 | Athena |
| Interactive Spark exploration, no cluster mgmt | Athena for Apache Spark notebooks |
| Enterprise BI dashboard | QuickSight (+ SPICE) |
| Pre-compute an expensive repeated aggregation | Materialized view (Redshift) |
| Audit who changed a resource | CloudTrail management events |
| Audit who read/wrote a specific object | CloudTrail **data events** (must be enabled ahead of time) |
| Centralize + cheaply query years of logs | CloudWatch Logs → export to S3 → Athena |
| Fast interactive search on recent logs | CloudWatch Logs Insights |
| Full-text/Kibana-style log search | OpenSearch Service |
| Alert on an error pattern in logs, no code change | CloudWatch Logs metric filter → alarm → SNS |
| Find PII across S3 automatically | Amazon Macie |
| Consumers falling behind a stream | Rising `IteratorAge` |
| One task in a job taking far longer than the rest | Data skew → repartition / salt / broadcast join |
| Job reprocessing the same data repeatedly | Check Glue job bookmark state |
| Reprocess ALL historical data | **Reset** the bookmark (not "disable") |
| Steady, predictable, high-utilization workload | Provisioned + Reserved Instances |
| Spiky, unpredictable workload | Serverless |
| Represent a small but critical subgroup fairly in a sample | Stratified sampling |
| Cheaply profile a huge partitioned dataset | Cluster sampling |

---

<a name="questions"></a>
## PRACTICE QUESTION BANK — 40 QUESTIONS

### Straightforward (Q1–Q10)

**Q1.** A data engineer needs to run a Glue job every day at 2:00 AM
with no branching logic and no need to track workflow state. Which
service provides this with the least operational overhead?

A. AWS Step Functions
B. Amazon MWAA
C. Amazon EventBridge Scheduler
D. AWS Glue Workflows

**Answer: C.** EventBridge Scheduler is purpose-built for pure
time-based triggers with no state tracking needed — cheapest and
simplest. **A** is wrong: Step Functions is for stateful, branching
workflows, which this scenario explicitly doesn't need. **B** is wrong:
MWAA is an always-on environment with real operational overhead —
never the "least overhead" answer for a single scheduled job. **D** is
wrong: Glue Workflows chains Glue jobs/crawlers together; here there's
only one job with no chaining, and even so it doesn't handle pure
time-based scheduling as its core purpose.

**Q2.** Which AWS service's Python SDK is the default answer whenever
an exam question says "programmatically access AWS features from
custom code"?

A. AWS CLI
B. boto3
C. AWS CDK
D. Glue Studio

**Answer: B.** boto3 is the Python SDK, wrapping every AWS service API
for use in custom scripts (Lambda, Glue Python shell, EC2, etc.). **A**
is wrong: the CLI is a command-line tool for interactive/scripted shell
use, not a programmatic SDK embedded in application code. **C** is
wrong: CDK defines infrastructure as code; it doesn't call AWS service
APIs at runtime for data processing. **D** is wrong: Glue Studio is a
visual ETL authoring tool, not an SDK.

**Q3.** A business analyst with no coding experience needs to
interactively clean a messy CSV file — fixing nulls, standardizing date
formats, and removing duplicates — before it's used in a report. Which
service fits best?

A. AWS Glue ETL (PySpark)
B. Amazon EMR
C. AWS Glue DataBrew
D. AWS Lambda

**Answer: C.** DataBrew is the visual, no-code data-prep tool designed
exactly for non-engineer analysts to interactively clean data. **A** is
wrong: Glue ETL requires writing Spark code, which contradicts "no
coding experience." **B** is wrong: EMR requires cluster management and
code — far too heavy and technical for this use case. **D** is wrong:
Lambda requires writing code and isn't an interactive prep tool at all.

**Q4.** Which CloudWatch metric indicates that Kinesis Data Streams
consumers are falling behind the incoming data?

A. `ThrottledRequests`
B. `GetRecords.IteratorAgeMilliseconds`
C. `WLMQueueLength`
D. `DataScannedInBytes`

**Answer: B.** Rising IteratorAge means consumers are processing data
increasingly later than when it was written — the signature "falling
behind" signal for Kinesis. **A** is wrong: `ThrottledRequests` is a
DynamoDB throttling metric, unrelated to Kinesis consumer lag. **C** is
wrong: `WLMQueueLength` is a Redshift workload-management queue metric.
**D** is wrong: `DataScannedInBytes` is an Athena cost/scan metric.

**Q5.** Which AWS service tracks "who called which API, when, and from
where" across an AWS account?

A. Amazon CloudWatch
B. AWS CloudTrail
C. AWS X-Ray
D. AWS Config

**Answer: B.** CloudTrail is purpose-built for API-level audit logging
— who, what, when, from where. **A** is wrong: CloudWatch answers
health/performance ("is it fast, is it healthy"), not who made an API
call. **C** is wrong: X-Ray traces request latency and bottlenecks
across distributed services, not API audit history. **D** is wrong:
AWS Config tracks resource configuration state and compliance over
time, not individual API calls.

**Q6.** A Glue job appears to be reprocessing the same S3 files every
run instead of only new files. What should the engineer check first?

A. IAM role permissions on the job
B. Whether job bookmarks are enabled and correctly tracking state
C. The VPC endpoint configuration
D. The Glue Data Catalog's crawler schedule

**Answer: B.** Job bookmarks track which data has already been
processed; if disabled or misbehaving, the job reprocesses everything
each run — the textbook cause of this exact symptom. **A** is wrong:
an IAM permissions problem would cause the job to fail outright, not
silently reprocess old data. **C** is wrong: VPC endpoints affect
network connectivity, not incremental-processing state. **D** is
wrong: crawler schedules affect metadata discovery, not which data a
Glue ETL job chooses to reprocess.

**Q7.** Which combination is required to make a CloudWatch alarm
proactively notify an on-call engineer by email?

A. CloudWatch alarm alone
B. CloudWatch alarm → SNS topic with an email subscription
C. CloudWatch Logs Insights query run manually
D. AWS Config rule

**Answer: B.** An alarm changes state based on a metric threshold, but
needs SNS to actually deliver a notification to a human via email. **A**
is wrong: an alarm with no target just changes state visibly in the
console — nobody is notified without a downstream action like SNS.
**C** is wrong: a manually run Logs Insights query is not proactive or
automated. **D** is wrong: AWS Config evaluates resource configuration
compliance, not metric-based operational alerting.

**Q8.** Which sampling technique ensures a small but important customer
segment (5% of records) is fairly represented in a validation sample,
rather than being nearly invisible?

A. Random sampling
B. Systematic sampling
C. Stratified sampling
D. Cluster sampling

**Answer: C.** Stratified sampling samples proportionally within each
known subgroup, guaranteeing the minority segment is represented. **A**
is wrong: pure random sampling could easily undersample a small
segment by chance. **B** is wrong: systematic sampling (every Nth row)
doesn't account for subgroup proportions and can also be biased by
periodic data patterns. **D** is wrong: cluster sampling selects whole
groups wholesale, which could easily miss the small segment entirely if
it isn't spread evenly across the selected clusters.

**Q9.** A Spark job in Glue is taking far longer than expected, and the
Spark UI shows one task processing dramatically more data than the
other 199 tasks. This is a symptom of what?

A. IAM misconfiguration
B. Data skew
C. A missing job bookmark
D. Insufficient CloudTrail data events

**Answer: B.** One task handling disproportionately more data than the
rest is the textbook symptom of data skew — often from an uneven join
or grouping key. **A** is wrong: IAM problems cause access failures,
not uneven task-level data distribution. **C** is wrong: job bookmarks
control incremental processing across runs, not intra-job task
balance. **D** is wrong: CloudTrail data events are an audit-logging
concept, unrelated to Spark task performance.

**Q10.** Which AWS service is the exam's default answer for
"automatically discover and classify PII across S3 buckets"?

A. AWS Glue Data Quality
B. Amazon Macie
C. AWS Config
D. Amazon Comprehend

**Answer: B.** Macie is purpose-built to scan S3 and automatically
classify sensitive data like PII using ML and pattern matching. **A**
is wrong: Glue Data Quality validates structured field-level rules you
define (completeness, uniqueness) — it doesn't discover unknown PII
patterns. **C** is wrong: AWS Config tracks resource configuration
compliance, not data content. **D** is wrong: Comprehend does NLP/text
analysis and can detect PII in text, but it isn't the purpose-built,
automated bucket-wide scanning service the exam associates with this
scenario — that's Macie.

### Scenario-based (Q11–Q30)

**Q11.** A retail company's Glue ETL job pulls from an existing set of
complex Spark, Hive, and Presto scripts that the data engineering team
wrote years ago and wants to reuse largely unmodified. Which processing
service should they choose?

A. AWS Glue ETL
B. Amazon EMR
C. AWS Lambda
D. Amazon Athena

**Answer: B.** EMR exposes the actual cluster and supports Spark,
Hive, and Presto/Trino natively, making it the only option where
existing multi-framework scripts can run largely unmodified. **A** is
wrong: Glue's DynamicFrame-based job structure isn't a drop-in
replacement for raw open-source Spark/Hive/Presto code. **C** is wrong:
Lambda's 15-minute/10 GB limits and lack of Spark/Hive/Presto runtime
make it unsuitable for full legacy script reuse. **D** is wrong: Athena
is a SQL query engine over S3, not a general-purpose Spark/Hive/Presto
execution environment for arbitrary scripts.

**Q12.** A logistics company needs to alert their on-call team the
instant any Glue job fails, without any polling loop. What's the best
design?

A. A Lambda function on a 1-minute schedule that checks job status via boto3
B. An EventBridge rule matching Glue job state-change events, routed to an SNS topic
C. A CloudWatch Logs Insights query run every 5 minutes
D. Manually checking the Glue console periodically

**Answer: B.** Glue emits job state-change events natively; an
EventBridge rule matching `state = FAILED` routed to SNS is fully
event-driven with zero polling. **A** is wrong: this works but is
explicitly a polling loop, which the requirement rules out, and is
also less efficient/timely than event-driven detection. **C** is
wrong: this is also polling-based and adds latency and cost compared
to instant event-driven detection. **D** is wrong: manual checking is
neither automated nor instant.

**Q13.** A healthcare company must prove, for a compliance audit, that
no unauthorized user read a specific patient record stored as an S3
object during the last six months. CloudTrail was configured with only
default settings at the time. What can the team conclude?

A. They can retroactively query CloudTrail management events to find every read
B. They cannot retroactively determine this — S3 object-level reads require data events, which are not enabled by default
C. Amazon Macie logs all S3 GetObject calls automatically
D. AWS Config tracks all object-level access by default

**Answer: B.** S3 object-level operations (like `GetObject`) are
**data events**, which must be explicitly enabled and cost extra —
they are not on by default. If they weren't enabled in advance, there
is no retroactive way to recover this history. **A** is wrong:
management events cover control-plane actions like creating/deleting
resources, not object-level reads. **C** is wrong: Macie classifies
sensitive data content; it does not log individual API read calls.
**D** is wrong: AWS Config tracks resource configuration state changes,
not object-level data access.

**Q14.** A media company runs a Redshift dashboard where a complex
aggregation query joining three large fact tables is run by dozens of
analysts throughout the day, always producing the same result until
the nightly ETL updates the source tables. How should they optimize
this?

A. Rewrite the query as an Athena CTAS
B. Create a Redshift materialized view over the aggregation
C. Create a regular (non-materialized) Redshift view
D. Increase the Redshift cluster's node count

**Answer: B.** A materialized view pre-computes and caches the
aggregation's result and can refresh on a schedule or on data change,
avoiding repeated expensive computation for identical, frequently
re-run queries. **A** is wrong: the data lives in Redshift, not S3, so
Athena CTAS isn't the natural fit here. **C** is wrong: a regular view
re-executes the full expensive query every single time it's selected
from — it provides no caching benefit for this repeated-query pattern.
**D** is wrong: scaling the cluster is a blunt, ongoing-cost fix for a
problem that a materialized view solves far more cheaply by avoiding
redundant computation entirely.

**Q15.** An IoT company ingests sensor data into S3 in raw CSV format
and queries it with Athena. Costs are unexpectedly high and queries are
slow. What is the most likely first fix?

A. Increase Athena's provisioned capacity
B. Convert the data to partitioned, compressed Parquet
C. Switch to Redshift Serverless
D. Add more Lambda functions to process the queries faster

**Answer: B.** CSV is row-based, uncompressed by default, and not
partition-pruning-friendly — converting to partitioned Parquet with
compression is the standard, highest-leverage fix for Athena cost and
speed. **A** is wrong: Athena is serverless with no "provisioned
capacity" to increase — this option describes something that doesn't
apply to Athena's architecture. **C** is wrong: swapping the entire
query engine is a much bigger change than fixing the underlying file
format problem, which would still hurt performance in Redshift too via
Spectrum. **D** is wrong: Lambda doesn't process Athena queries at all
— this option misunderstands the architecture.

**Q16.** A banking company's nightly Glue ETL job loads loan records
into a Redshift warehouse. They want the job to automatically halt
before loading if more than 1% of `loan_id` values are duplicated.
Which approach satisfies this?

A. A DataBrew profiling job run manually each morning
B. A Glue Data Quality (DQDL) rule using `IsUnique "loan_id"`, configured to fail the job on violation
C. A CloudWatch alarm on the Glue job's DPU utilization
D. An Athena query run after the load completes

**Answer: B.** Glue Data Quality's `IsUnique` DQDL rule, wired to an
Evaluate Data Quality node with a fail-the-job action, is precisely the
automated, in-line, pass/fail gate this requirement describes. **A** is
wrong: a manually run DataBrew job is neither automatic nor inline with
the ETL job, and doesn't halt loading. **C** is wrong: DPU utilization
is a performance metric, unrelated to duplicate-key detection. **D** is
wrong: a post-load Athena check happens *after* the data has already
been loaded, failing the "halt before loading" requirement.

**Q17.** A ride-sharing company's Spark job in EMR joins a 3 TB trip
events table with a 20 MB driver-status lookup table, and the join
stage is unexpectedly slow. What is the most effective fix?

A. Repartition the 3 TB table into more partitions
B. Use a broadcast join so the 20 MB table is sent to every executor
C. Increase the number of core nodes
D. Convert the join to a UNION

**Answer: B.** With one massively small table and one massively large
table, a broadcast join avoids shuffling the large table entirely by
replicating the tiny table to every executor's memory — the cheapest
fix for this specific size asymmetry. **A** is wrong: repartitioning
the large table doesn't address the root inefficiency of shuffling 3 TB
across the network for a join against a 20 MB table. **C** is wrong:
adding nodes increases cost without fixing the underlying shuffle
inefficiency. **D** is wrong: a UNION combines rows from two datasets
with the same schema — it isn't a substitute for a join and would
produce incorrect results.

**Q18.** A SaaS analytics company wants business users to build
executive dashboards from Athena query results, with fast repeated
load times regardless of how often the dashboard is refreshed during
the day. What should they use?

A. Direct Athena query on every dashboard load
B. QuickSight with SPICE
C. A Glue DataBrew visualization
D. CloudWatch dashboards

**Answer: B.** QuickSight's SPICE in-memory engine imports the data
once (on a refresh schedule) so dashboard views load instantly without
re-querying Athena on every page view. **A** is wrong: querying Athena
live on every dashboard load is slower and more costly at scale — the
opposite of "fast repeated load times." **C** is wrong: DataBrew's
visualization is a profiling side-effect, not a dashboarding tool for
business users. **D** is wrong: CloudWatch dashboards visualize
operational metrics/logs, not general business query results.

**Q19.** A pharmaceutical company needs years of application logs
queryable for compliance audits, at the lowest ongoing cost, without
sacrificing the ability to run SQL-style analysis. What should they do?

A. Keep all logs in CloudWatch Logs indefinitely and query with Logs Insights
B. Export/route CloudWatch Logs to S3, catalog with Glue, and query with Athena
C. Stream logs to Amazon OpenSearch Service permanently
D. Store logs only in EMR HDFS

**Answer: B.** S3 storage is far cheaper than long-term CloudWatch Logs
storage, and Athena provides the needed SQL-style querying over that
S3 data at a fraction of Logs Insights' per-GB-scanned pricing at this
retention depth. **A** is wrong: CloudWatch Logs Insights is priced per
GB scanned per query, which becomes very expensive at multi-year
retention. **C** is wrong: OpenSearch is well-suited to full-text/
Kibana-style search but is a comparatively expensive, operationally
heavier choice for years of compliance-archive-style storage. **D** is
wrong: EMR HDFS is ephemeral cluster storage, not designed for
long-term durable log archival.

**Q20.** A financial services firm wants to migrate its existing
Airflow DAGs, which use several custom Python operators, to AWS with
minimal rewriting. Which orchestration service should they choose?

A. AWS Step Functions
B. Amazon EventBridge
C. Amazon MWAA
D. AWS Glue Workflows

**Answer: C.** MWAA is managed Apache Airflow — existing DAGs and
custom Python operators can move with minimal rewriting, which is
exactly the scenario's constraint. **A** is wrong: migrating to Step
Functions would require rewriting DAG logic into Amazon States
Language — significant rework, contradicting "minimal rewriting." **B**
is wrong: EventBridge has no concept of DAGs or Python operators at
all. **D** is wrong: Glue Workflows only chains Glue jobs/crawlers, not
arbitrary custom Python-based Airflow DAGs.

**Q21.** A gaming company's DynamoDB table is being heavily used by a
live application, and the data team wants to run analytics over the
full table's history without impacting application latency. What
should they do?

A. Run a DynamoDB Scan directly from Athena Federated Query during off-peak hours
B. Export DynamoDB data to S3, then query with Athena
C. Increase DynamoDB's provisioned read capacity temporarily
D. Query DynamoDB directly from QuickSight

**Answer: B.** Exporting to S3 consumes no RCUs and fully decouples
analytics from the live application's read capacity — the standard,
zero-impact answer for this exact scenario. **A** is wrong: a Scan,
even off-peak, still consumes the table's read capacity and can affect
the live application. **C** is wrong: increasing provisioned capacity
raises cost and still means analytics workloads compete for the same
table's capacity as the application. **D** is wrong: QuickSight has no
native ability to run heavy analytical scans directly against DynamoDB
without impacting it — this isn't a standard integration pattern for
this use case.

**Q22.** An e-commerce company's Step Functions workflow orchestrates
extract, validate, transform, and load steps. The validate step
occasionally fails due to a transient upstream timeout. What is the
best way to handle this without failing the entire execution
immediately?

A. Manually re-run the workflow from the console each time it fails
B. Configure a `Retry` with exponential backoff on the validate state, with a `Catch` fallback
C. Remove the validate step entirely
D. Increase the Lambda timeout for the load step

**Answer: B.** Step Functions' native `Retry` (with backoff, max
attempts) directly handles transient failures automatically, and a
`Catch` provides a defined fallback if retries are exhausted — exactly
the built-in mechanism for this situation. **A** is wrong: manual
re-runs are not automated and don't scale operationally. **C** is
wrong: removing validation entirely trades reliability for convenience
and risks letting bad data through. **D** is wrong: the timeout issue
is in the validate step, not the load step — this doesn't address the
actual failure point.

**Q23.** A logistics company wants analysts to write simplified,
reusable SQL for a common "shipments delayed over 24 hours" filter
against Athena data, without duplicating the underlying join logic in
every analyst's query. What's the simplest solution?

A. Materialize the result nightly with CTAS
B. Create an Athena view encapsulating the filter and join logic
C. Rewrite the pipeline in Redshift
D. Ask every analyst to memorize the SQL

**Answer: B.** An Athena view stores the reusable SQL definition,
letting analysts simply `SELECT * FROM delayed_shipments` instead of
re-writing the join/filter logic each time — solving the duplication
problem directly. **A** is wrong: CTAS materializes a snapshot, which
is a valid alternative for cost/performance but isn't strictly needed
here since the ask is about reuse/simplification, not caching, and a
view is the more direct fit for "reusable SQL." **C** is wrong: this is
a large, unnecessary architectural change to solve a query-reuse
problem. **D** is wrong: memorization isn't a scalable or reliable
engineering solution.

**Q24.** A telecom company profiles a new dataset and finds it has 50
million rows spread unevenly across S3 date partitions — some
partitions have 10x more data than others. They want a cheap way to
spot-check overall data health without scanning everything. Which
sampling approach best fits querying whole partitions at a time?

A. Systematic sampling
B. Stratified sampling
C. Cluster sampling
D. Random sampling across all 50 million rows

**Answer: C.** Cluster sampling selects entire groups (here,
partitions) wholesale, which is cheap to query on partitioned S3 data
since you can target a few whole partitions instead of scanning
everything. **A** is wrong: systematic sampling (every Nth row) still
implies touching data broadly across all partitions, which is more
expensive on partitioned S3 data than reading a few whole partitions.
**B** is wrong: stratified sampling would require sampling
proportionally within every partition, still touching all of them,
which doesn't achieve the "cheap, whole-partition" goal as directly.
**D** is wrong: sampling randomly across all 50 million rows requires
scanning (or at least touching) the entire dataset, which is the
expensive approach the question is trying to avoid.

**Q25.** A retail company's data engineering team is deploying the same
Glue job, Step Functions workflow, and IAM roles identically across
dev, staging, and production accounts. Manual console setup has caused
configuration drift between environments. What should they adopt?

A. AWS Config rules
B. AWS CDK or CloudFormation templates
C. Manual runbooks with more detailed instructions
D. A shared IAM role reused literally across all three accounts

**Answer: B.** IaC (CDK/CloudFormation) makes deployments reproducible
and version-controlled, eliminating the drift caused by manual,
inconsistent console configuration across environments. **A** is
wrong: AWS Config detects and reports configuration drift after the
fact — it doesn't prevent it by driving consistent deployment. **C** is
wrong: more detailed manual instructions still rely on error-prone
human execution, the root cause of the drift. **D** is wrong: reusing
one literal IAM role across three separate accounts isn't how
cross-account IAM works, and doesn't address the deployment-consistency
problem at all.

**Q26.** A manufacturing company's EMR cluster is processing sensor
data stored as 500,000 small files (each ~200 KB) in S3. Job runtime is
dominated by per-file overhead. What is the most effective long-term
fix?

A. Add more core nodes to the cluster
B. Compact the small files into larger files (target 128 MB–1 GB) before/during processing
C. Convert the cluster to use Spot instances
D. Increase the EMR step's timeout

**Answer: B.** The small-file problem is fundamentally about per-file
overhead dominating runtime; compacting into properly sized files
(128 MB–1 GB) is the standard, durable fix. **A** is wrong: more nodes
add parallelism but don't reduce the fundamental per-file overhead —
the job stays inefficient, just spread across more hardware. **C** is
wrong: Spot instances are a cost lever, unrelated to the small-file
performance problem. **D** is wrong: increasing the timeout just lets
an inefficient job run longer; it doesn't fix the underlying
inefficiency.

**Q27.** A hospital system needs to continuously scan a shared S3 data
lake for any newly uploaded files containing unmasked patient SSNs, and
automatically alert the security team. Which combination of services
fits best?

A. Glue Data Quality DQDL rules checking for SSN patterns
B. Scheduled Amazon Macie jobs with findings routed through EventBridge to SNS
C. A CloudWatch Logs metric filter on S3 access logs
D. Athena queries run manually each week

**Answer: B.** Macie is purpose-built to continuously discover
sensitive data like SSNs in S3 and can route findings via EventBridge
to an automated alert — exactly the continuous, automated monitoring
this scenario needs. **A** is wrong: DQDL validates structured
field-level rules you already know to define; it's not designed for
open-ended sensitive-content discovery across arbitrary new files.
**C** is wrong: a metric filter on access logs would show who accessed
files, not whether file *content* contains unmasked SSNs. **D** is
wrong: manual weekly queries are neither continuous nor automated,
failing the "continuously scan" and "automatically alert" requirements.

**Q28.** A subscription streaming service runs a steady-state Redshift
warehouse 24/7 at consistently high utilization for BI reporting. Which
capacity model minimizes cost?

A. Redshift Serverless, since it scales automatically
B. Redshift provisioned cluster with Reserved Instances
C. Athena, since it has no idle cost
D. EMR with Trino, paid hourly

**Answer: B.** For steady, predictable, continuously high-utilization
workloads, Reserved Instances on a provisioned cluster are cheaper per
unit than paying Serverless's per-RPU-hour convenience premium with no
idle time to actually save on. **A** is wrong: Serverless's main
advantage is eliminating idle cost — but this workload has no idle
time, so that advantage doesn't apply, and RI pricing wins instead.
**C** is wrong: Athena is priced per TB scanned and isn't designed for
sustained, high-concurrency BI reporting workloads at this profile.
**D** is wrong: EMR with Trino requires cluster management overhead and
isn't the natural warehouse-replacement answer here.

**Q29.** A payments company wants to guarantee that a critical alert
about a failed reconciliation job is never lost, even if the automated
remediation Lambda is briefly unavailable. What notification design
best satisfies this?

A. SNS topic with only a Lambda subscription
B. SNS topic fanning out to both an email subscription and an SQS queue as a durable backstop
C. A CloudWatch dashboard reviewed manually each morning
D. Direct Lambda invocation with no queue or topic

**Answer: B.** SNS→SQS fan-out combines immediate human notification
with a durable, queued backstop that survives the remediation Lambda
being temporarily unavailable — messages sit in SQS until a consumer is
ready. **A** is wrong: if the Lambda subscriber is briefly unavailable
and SNS delivery to it fails without a durable queue behind it, the
notification can be effectively lost for that consumer. **C** is
wrong: manual dashboard review isn't proactive or guaranteed timely.
**D** is wrong: a direct invocation with no buffering has no
durability if the Lambda is unavailable at the moment of the call.

**Q30.** An automotive company's nightly Redshift load process
completes with a SUCCESS status, but a downstream analyst notices the
row count is lower than expected. What is the most likely first
investigative step?

A. Check IAM permissions on the Redshift cluster
B. Compare source and target row counts, and review the transformation logic for an unintended filter or join issue
C. Restart the Redshift cluster
D. Check the VPC endpoint configuration

**Answer: B.** A "successful" job with unexpectedly low row counts is
a classic silent data-quality issue — the fix starts with reconciling
counts and inspecting transformation logic (an overly strict filter, a
join that drops unmatched rows) rather than assuming infrastructure
failure. **A** is wrong: an IAM permissions problem would typically
cause the job to fail outright with an access-denied error, not
succeed with fewer rows. **C** is wrong: restarting the cluster doesn't
address a data-correctness issue and risks disrupting other workloads
for no diagnostic benefit. **D** is wrong: VPC endpoint misconfiguration
would likely cause connectivity failures, not a quietly reduced row
count on a job reporting SUCCESS.

### Hard / multi-constraint (Q31–Q40)

**Q31.** A global bank's fraud-detection pipeline ingests transaction
events, and a nightly Glue job merges CDC changes into a Redshift
warehouse. Compliance requires that (1) any job producing more than 2%
duplicate `transaction_id` values must halt before loading, (2) the
team must be alerted within seconds if this happens, and (3) the fix
must not require standing up new long-running infrastructure. Which
design satisfies all three constraints?

A. A nightly Athena query checking for duplicates after the load, emailing results manually
B. A Glue Data Quality DQDL rule (`Uniqueness "transaction_id" > 0.98`) configured to fail the job, combined with an EventBridge rule on the Glue job-failure event routed to SNS
C. An EMR cluster running a custom Spark job that checks for duplicates and pages the team via a custom-built API
D. A DataBrew job scheduled nightly with manual review of its quality report the next morning

**Answer: B.** DQDL's uniqueness threshold rule wired to fail the job
satisfies constraint 1 (halt before loading); the Glue job-failure event
via EventBridge → SNS satisfies constraint 2 (alert within seconds,
event-driven not polled); both use existing serverless services,
satisfying constraint 3 (no new long-running infrastructure). **A** is
wrong: this checks *after* the load (violates constraint 1, which
requires halting *before* loading) and "manual email" isn't a seconds-
scale automated alert (violates constraint 2). **C** is wrong: standing
up an EMR cluster and a custom paging API directly violates constraint
3's "no new long-running infrastructure." **D** is wrong: manual review
the next morning is neither immediate (violates constraint 2) nor does
it halt the load beforehand (violates constraint 1).

**Q32.** A media analytics company has an Athena-based reporting layer
over Parquet data in S3. Query costs have grown significantly even
though data volume has only grown modestly, and analysts complain some
dashboard queries take much longer than others despite scanning similar
data sizes. Investigation shows the slow queries all filter on a
`customer_region` column that isn't a partition key, while fast queries
filter on `event_date`, which is a Hive-style partition. What combination
of fixes addresses both the cost growth and the inconsistent query
times with the least re-architecture?

A. Migrate everything to Redshift Serverless
B. Add `customer_region` as an additional partition (or sub-partition) column, and ensure workgroup data-usage controls are in place to bound runaway costs
C. Convert the data back to CSV for simpler debugging
D. Increase the number of Athena "capacity units"

**Answer: B.** Partitioning on `customer_region` (or as a
sub-partition alongside `event_date`) restores partition pruning for
those slow queries, directly fixing both the inconsistent performance
and, combined with workgroup data-usage limits, addressing runaway
cost — all without a platform migration. **A** is wrong: migrating to
Redshift is a much larger architectural change than the problem
requires, and doesn't inherently fix a partitioning design issue — the
same modeling mistake could recur there too. **C** is wrong: converting
to CSV would make performance and cost *worse* (no columnar pruning,
worse compression), not better. **D** is wrong: Athena is serverless
and has no "capacity units" to provision — this option describes a
concept that doesn't apply to Athena's architecture.

**Q33.** A ride-hailing company's Step Functions Standard workflow
processes 50,000 driver-onboarding requests per day, each requiring
extract, background-check API call, validation, and load. The team now
needs to scale to 5 million short-lived executions per day while
keeping cost predictable, and each execution completes within seconds.
Retaining full execution history isn't required for this specific
workflow. What should they change?

A. Keep Step Functions Standard as-is — it already scales infinitely
B. Migrate to Step Functions Express workflows
C. Rewrite the workflow as a single large Lambda function processing all 5 million records sequentially
D. Migrate to Amazon MWAA for better throughput

**Answer: B.** Express workflows are priced and built for exactly this
profile — millions of short-duration executions per day, at much lower
cost per execution than Standard, trading full 90-day execution history
for throughput and cost efficiency (acceptable per the scenario's own
stated requirement). **A** is wrong: Standard's per-state-transition
pricing model becomes comparatively expensive at this volume, and
while it technically can run this many workflows, Express is the
purpose-built, cost-appropriate answer given the stated constraints.
**C** is wrong: sequential processing in a single Lambda would be
extremely slow at 5 million records/day and abandons the workflow's
parallelism and per-execution isolation entirely, plus risks hitting
Lambda's execution limits. **D** is wrong: MWAA is an always-on,
higher-overhead environment, not designed for or priced around
millions of short, independent executions per day, and would be a step
backward on both cost and operational simplicity here.

**Q34.** A pharmaceutical research pipeline processes genomic data in
EMR. A specific Spark stage repeatedly fails with out-of-memory errors
on exactly one executor while others complete quickly, and Spark UI
shows that executor handling a single `sample_id` value with 10x more
records than any other sample. The team has already tried increasing
executor memory twice, with the OOM persisting. What is the most
appropriate next step?

A. Continue increasing executor memory further
B. Salt the `sample_id` key to spread that sample's records across multiple partitions, then re-aggregate results
C. Switch the entire cluster to Spot instances
D. Disable Spark's shuffle service

**Answer: B.** Repeated OOM on one executor tied to a single dominant
key value, even after memory increases, is the signature case for
salting — the problem is data distribution, not raw memory, so
throwing more memory at it has diminishing (here, already demonstrated
zero) returns. **A** is wrong: the scenario explicitly states memory
increases have already failed to fix it twice — more memory doesn't
solve a fundamentally uneven data distribution problem. **C** is wrong:
Spot instances are a cost optimization, unrelated to fixing OOM caused
by data skew, and could even make the failure mode worse by
interrupting the already-struggling executor. **D** is wrong: disabling
the shuffle service would harm the job broadly and doesn't target the
actual root cause (one key value dominating the shuffle).

**Q35.** A logistics company wants to expose curated shipment data to
an external partner's system via a request/response API, sourced from
a mix of DynamoDB (real-time status) and S3 (historical records), with
minimal infrastructure to manage. What architecture best fits?

A. Give the partner direct IAM credentials to query DynamoDB and S3 directly
B. API Gateway + Lambda, with Lambda querying DynamoDB for real-time status and Athena for historical S3 data
C. Stand up a dedicated EC2 fleet running a custom REST API
D. Share a Redshift cluster's endpoint directly with the partner

**Answer: B.** API Gateway + Lambda is the standard serverless pattern
for exposing curated data via API with minimal infrastructure, and
Lambda can call boto3 against DynamoDB (real-time) and either Athena or
direct S3 reads (historical) behind a controlled interface. **A** is
wrong: giving an external partner direct IAM credentials to internal
data stores is a security anti-pattern and bypasses any control over
what's exposed or how. **C** is wrong: a dedicated EC2 fleet is
significant infrastructure to manage, directly violating "minimal
infrastructure." **D** is wrong: sharing a Redshift cluster endpoint
directly with an external partner is both a security risk and doesn't
address that some of the data (real-time status) lives in DynamoDB,
not Redshift.

**Q36.** A retail company's data quality gate uses Glue Data Quality
with a rule `Completeness "email" > 0.95`, configured to route failing
rows to a quarantine S3 location rather than fail the whole job. After
a schema change upstream, 40% of rows now fail this rule, and the
pipeline continues to run, quietly quarantining nearly half the data
every night without alerting anyone. What should the team add to
prevent this from going unnoticed again?

A. Nothing — quarantine-and-continue is already the correct permissive behavior
B. A CloudWatch metric/alarm on the Data Quality evaluation's pass rate or quarantined-row count, alerting when it crosses an unexpected threshold
C. Switch the rule to fail the entire job on any violation, regardless of severity
D. Remove the `Completeness` rule entirely since it's causing operational noise

**Answer: B.** The quarantine behavior itself is a legitimate design
choice, but it needs an accompanying alarm on the quarantine rate/pass
rate so a sudden, dramatic shift (40% failing) is surfaced immediately
rather than silently absorbed — this is exactly what Glue Data
Quality's metric publishing enables. **A** is wrong: "quietly
quarantining half the data every night" without anyone noticing is
precisely the failure mode the team needs to prevent — the current
setup is incomplete, not correct. **C** is wrong: always failing the
entire job on any violation is overly rigid and wasn't asked for; it
would also halt the pipeline for even minor, tolerable fluctuations,
which may not be desired. **D** is wrong: removing the rule entirely
eliminates the safety net rather than fixing the alerting gap — it
solves the symptom (noise) by creating a much bigger problem (no
quality gate at all).

**Q37.** A multinational retailer needs its data pipeline's Redshift
warehouse to support both (a) a small number of internal analysts
running complex, unpredictable ad-hoc joins across huge fact tables all
day, and (b) hundreds of external franchise partners querying a curated
subset of that same data through occasional, sporadic dashboard
refreshes throughout the week. Which combination of services and
Redshift features best fits both usage patterns with reasonable cost
control?

A. One shared Redshift Serverless warehouse for both groups
B. A provisioned Redshift cluster (with Reserved Instances) for the internal analysts, and Redshift data sharing to a separate Redshift Serverless warehouse (or Athena via Spectrum) for the franchise partners
C. Give franchise partners direct query access to the same provisioned cluster the analysts use
D. Export all data to S3 nightly and let both groups query Athena exclusively

**Answer: B.** Splitting workloads matches each group's actual usage
profile: the internal analysts' steady, complex, all-day workload fits
a provisioned cluster with RIs (cost-efficient at sustained utilization),
while the franchise partners' sporadic, occasional access fits
serverless/Spectrum (no idle cost) — and Redshift data sharing lets the
second group query curated data without copying it or contending for
the first group's compute. **A** is wrong: a single Serverless
warehouse would have the internal analysts' constant heavy usage
driving continuous RPU billing, losing the cost benefit Serverless is
meant to provide, and also risks cross-workload resource contention.
**C** is wrong: giving hundreds of external partners direct query
access to the same cluster the internal analysts depend on creates
resource contention risk and a governance/security concern (external
users on the primary internal cluster). **D** is wrong: routing the
internal analysts' complex, unpredictable, high-concurrency ad-hoc
joins exclusively through Athena ignores Athena's concurrency
limitations for that specific access pattern.

**Q38.** A healthcare data platform's compliance team wants a single
place to run SQL-style queries across CloudTrail activity spanning
multiple AWS accounts and regions, without building and maintaining a
custom Athena-over-S3 pipeline themselves. Which service best fits?

A. CloudWatch Logs Insights
B. AWS CloudTrail Lake
C. Amazon OpenSearch Service
D. AWS Config

**Answer: B.** CloudTrail Lake is the managed, SQL-queryable data store
purpose-built for centralized, cross-account/cross-region trail data
analysis — exactly removing the need to build a custom Athena-over-S3
pipeline. **A** is wrong: CloudWatch Logs Insights queries application/
service logs, not CloudTrail's structured API-event data specifically,
and doesn't natively aggregate across accounts the way CloudTrail Lake
does. **C** is wrong: OpenSearch would require the team to build and
maintain their own ingestion pipeline from CloudTrail into OpenSearch —
exactly the "custom pipeline" burden the requirement wants to avoid.
**D** is wrong: AWS Config tracks resource configuration state and
compliance, not API-call/audit-event history.

**Q39.** An insurance company's nightly pipeline: (1) extracts claims
data via DMS CDC from an on-prem Oracle database, (2) runs a Glue job
with a DQDL ruleset checking completeness and value ranges, (3) loads
passing data into Redshift, and (4) sends a summary report via
QuickSight. On a particular night, step 3's load silently inserts
significantly fewer rows than step 2's Data Quality evaluation reported
as passing. Assuming the DQDL rule correctly halted on any real
violations and none were reported, where should the team look next?

A. Re-run Amazon Macie against the source Oracle database
B. Review the Glue job's load/write logic (e.g., an unintended filter, a failed partial write, or a connection issue during the Redshift COPY/load step) between the passed-DQDL DynamicFrame and the final Redshift insert
C. Assume DQDL itself is broken and remove the ruleset
D. Increase the DMS replication instance size

**Answer: B.** Since the DQDL evaluation already confirmed the data
passing quality checks, the discrepancy must be introduced somewhere
between that point and the final Redshift write — reviewing the actual
load/write logic (filters, partial-write failures, connection issues)
is the correct next diagnostic step, consistent with the "investigate
data consistency" skill of comparing source/intermediate/target counts
stage by stage. **A** is wrong: Macie scans for sensitive data content
in S3; it has no relevance to a row-count discrepancy during a
Redshift load and doesn't even operate against an on-prem Oracle
database directly. **C** is wrong: nothing in the scenario indicates
DQDL is malfunctioning — the DQDL step behaved as expected (correctly
reported no violations); the discrepancy is happening downstream of it,
so removing it wouldn't address the actual problem and would eliminate
the quality gate entirely. **D** is wrong: DMS replication instance
sizing affects CDC replication performance/throughput out of Oracle,
not what happens later in a completely separate Glue-to-Redshift load
step — this doesn't address where the data was actually lost.

**Q40.** A manufacturing IoT company runs a Glue Streaming job
continuously ingesting sensor data from Kinesis Data Streams into S3.
Costs have grown because Glue Streaming bills continuously whether or
not new sensor events arrive. Investigation shows sensor data actually
only arrives in three predictable daily bursts (morning, midday,
evening shift changes), not truly continuously. Business tolerance for
freshness is "within 15 minutes of a shift change," not sub-second.
What is the most cost-effective redesign?

A. Keep Glue Streaming running continuously — it's the only way to read from Kinesis
B. Replace Glue Streaming with a scheduled batch Glue job (e.g., via EventBridge Scheduler) that reads accumulated Kinesis data around each known shift-change window
C. Switch from Kinesis Data Streams to Amazon Data Firehose only, with no processing at all
D. Increase the Glue Streaming job's worker count to process bursts faster

**Answer: B.** Since arrivals are predictable and bursty rather than
truly continuous, and the 15-minute freshness tolerance doesn't require
sub-second streaming, a scheduled batch job triggered around each known
burst window avoids Glue Streaming's continuous billing entirely while
still meeting the freshness requirement — matching cost to actual
traffic pattern. **A** is wrong: this is the premise's stated problem
(continuous billing for non-continuous traffic), and it's also not
true that Kinesis can only be read via a continuously running
consumer — a batch/scheduled read (e.g., via Kinesis Data Analytics
snapshot patterns, or by having Firehose/consumer buffer and Glue batch
process the landed S3 data) is entirely valid here. **C** is wrong:
this removes the processing/transformation step needed by the pipeline
entirely — it doesn't just optimize cost, it drops a required
capability. **D** is wrong: adding worker capacity only makes the
already-too-expensive continuous billing model more expensive; it
doesn't address the fundamental mismatch between continuous billing and
bursty traffic.

---

*End of Domain 3 — Data Operations and Support. Cross-reference with
`00-START-HERE/SERVICE-SELECTION-MATRIX.md` Parts 2, 4, 9, and 16 for
the streaming, processing, orchestration, and monitoring matrices that
underpin several of the scenarios above, and with
`00-START-HERE/EXAM-TRAPS.md` for the general trap-recognition patterns
this domain shares with Domains 1 and 4.*
