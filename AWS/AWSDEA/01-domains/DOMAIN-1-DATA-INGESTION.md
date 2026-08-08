# Domain 1 — Data Ingestion and Transformation (34%)

> The largest domain on DEA-C01. Roughly 22 of 65 questions. Four task
> statements: **1.1 Perform data ingestion · 1.2 Transform and process
> data · 1.3 Orchestrate data pipelines · 1.4 Apply programming
> concepts.** This file covers all 48 sub-skills (1.1.1–1.4.11) at full
> depth, plus decision trees, mnemonics, and a 40-question practice bank.

## CONTENTS

- [Part 0 — The 8-step lens, applied to this whole domain](#p0)
- [Part 1 — The five guard rails](#p1)
- [Task 1.1 — Perform data ingestion](#t11)
- [Task 1.2 — Transform and process data](#t12)
- [Task 1.3 — Orchestrate data pipelines](#t13)
- [Task 1.4 — Apply programming concepts](#t14)
- [Decision trees](#trees)
- [Mnemonics](#mnemonics)
- [Practice question bank (40 questions)](#bank)

---

<a name="p0"></a>
## PART 0 — The 8-step lens, applied to this whole domain

### 1. Explain like I'm 12

Imagine your school has one mailbox for the whole building (that's a
**data lake in S3**). Every classroom generates paper — some rooms
hand you a stack of forms once a day (**batch**), some rooms have a kid
running notes to you every few seconds all day long (**streaming**).
You can't just dump every note straight into the filing cabinet as it
arrives — some notes are in the wrong language, some are missing a
name, some need stapling to other notes. So before filing, you sort,
translate, and staple (**transform**). And because a school has way too
many moving parts for you to remember every step yourself, you write a
checklist on the wall that says "when the bell rings, do X, then Y,
then Z, and if Y fails, try it two more times before telling the
principal" (**orchestration**). Domain 1 is: how do notes get to you,
how do you clean them up, and how do you make sure the whole process
runs itself correctly every single day without you standing there.

### 2. Explain technically

Domain 1 covers the **ingress and transformation layer** of a data
platform: acquiring data from streaming sources (Kinesis Data Streams,
MSK, DynamoDB Streams), batch sources (S3, JDBC databases, SaaS APIs),
and change-data-capture sources (DMS, zero-ETL); applying
transformations (format conversion, joins, cleansing, enrichment)
using serverless (Glue, Lambda) or cluster-based (EMR) compute; and
wiring the whole thing together with orchestration (Step Functions,
MWAA, EventBridge) so that jobs run on schedule or in response to
events, retry safely on failure, and alert humans when they can't
recover on their own. Underneath all of it sits a layer of programming
fundamentals — SQL, IaC, distributed computing, and basic algorithms —
that the exam tests as applied skills, not trivia.

### 3. Explain like a Senior AWS Data Engineer

A senior engineer does not start by picking a service. They start by
asking five questions, in this order: **(1) What is the actual latency
requirement, in the customer's words, not the marketing words?** ("Near
real-time" almost never means sub-second. "Real-time" for a fraud team
usually does.) **(2) What is the replay/audit requirement?** If a
downstream job breaks and needs to reprocess three days of data, does
the pipeline support that, or did we build something that can only
consume each event once, ever? **(3) What is the blast radius of
getting this wrong?** A dropped analytics event is a shrug. A dropped
payment event is an incident report. **(4) What is the operational
cost over three years, not the sticker price today** — an MSK cluster
someone has to patch, monitor, and right-size is a standing liability
even when the AWS bill looks reasonable. **(5) Who is going to
maintain this after I leave the team?** This is why the "senior"
answer on this exam is so often the boring, managed, serverless one —
not because it's always technically superior, but because it is the
answer that survives contact with a different engineer six months from
now. Every sub-section below returns to this lens explicitly.

### 4. Explain production architecture

The canonical Domain-1 shaped pipeline, referenced throughout this file:

```
                     BATCH SOURCES                    STREAMING SOURCES
                 ┌───────────────────┐          ┌──────────────────────────┐
                 │ RDS / SaaS APIs / │          │ Clickstream / IoT / App  │
                 │ On-prem files     │          │ logs / DB change events  │
                 └─────────┬─────────┘          └────────────┬─────────────┘
                           |                                  |
                    DMS / Glue / AppFlow          Kinesis Data Streams / MSK
                           |                                  |
                           v                                  v
                 ┌─────────────────────────────────────────────────────┐
                 │            RAW / BRONZE ZONE  (Amazon S3)            │
                 │   Immutable, unmodified, retained for REPLAY         │
                 └───────────────────────┬───────────────────────────-─┘
                                          |
                             Glue ETL / EMR / Managed Flink
                                          |
                                          v
                 ┌───────────────────────────────────────────────────-─┐
                 │          CURATED / SILVER ZONE  (Parquet + Iceberg)  │
                 │   Cleaned, deduplicated, schema-conformed            │
                 └───────────────────────┬───────────────────────────-─┘
                                          |
                              Glue ETL (joins, aggregation)
                                          |
                                          v
                 ┌───────────────────────────────────────────────────-─┐
                 │            CONSUMPTION / GOLD ZONE                   │
                 │   Athena / Redshift / QuickSight / Data API           │
                 └───────────────────────────────────────────────────-─┘

        ORCHESTRATION LAYER (runs the whole thing, wraps every arrow above):
        EventBridge (triggers) ──▶ Step Functions / MWAA (sequencing,
        retries, branching) ──▶ SNS/SQS (alerts + dead-letter handling)
```

Reading the diagram: batch sources land through DMS, Glue, or AppFlow;
streaming sources land through Kinesis or MSK — both paths converge on
a **raw/bronze S3 zone that is never modified**, which is what makes
the whole pipeline replayable. From there, Glue ETL, EMR, or Managed
Flink read the raw zone and write a **curated/silver zone** in Parquet
(often as Iceberg tables) with cleansing and deduplication applied. A
second transformation pass joins and aggregates into a **gold/
consumption zone** that Athena, Redshift, or QuickSight read directly,
or that's exposed as a data API. Wrapped around every arrow in this
diagram is the orchestration layer: EventBridge fires triggers (a
schedule or an S3 event), Step Functions or MWAA sequences the steps
and handles retries/branching, and SNS/SQS deliver failure alerts and
catch poison messages in a dead-letter queue. This bronze→silver→gold
shape (the "medallion" or "lakehouse" pattern) is the mental model to
hold while reading every sub-section below — each sub-skill is really
just "how do I build one arrow in this diagram correctly."

### 5. Exam traps (domain-level — see also each sub-section)

⚠️ **"Near real-time" is not "real-time."** AWS uses "near real-time" to
license buffered, batched delivery (Amazon Data Firehose's ~60-second
buffer, zero-ETL's seconds-to-minutes lag). "Real-time" or "sub-second"
licenses Kinesis Data Streams or Managed Flink. Confusing these two
phrases is the single most common way this domain's questions are
missed.

⚠️ **"Least operational overhead" beats "cheapest," when both appear.**
AWS's house style consistently prefers the fully-managed, serverless
answer even when a self-managed cluster would technically cost less at
extreme scale. The exception is when the question is explicitly and
only about cost at petabyte scale — there, EMR + Spot wins.

⚠️ **Old service names are distractors.** "Kinesis Data Firehose" and
"Kinesis Data Analytics" are 2023-era names. If an option uses them
verbatim, the option was written to look familiar to someone who
studied outdated material — the current names are **Amazon Data
Firehose** and **Amazon Managed Service for Apache Flink**.

### 6. Interview questions (domain-level)

- *"Walk me through how you'd design an ingestion pipeline for a source
  you know will occasionally send duplicate or out-of-order events."*
  Strong answer: separate the transport guarantee (at-least-once is
  fine and standard) from the processing guarantee — achieve
  correctness with idempotent writes (conditional PutItem, upsert via
  MERGE, dedup key), not by trying to force exactly-once delivery
  everywhere, because that's expensive and often impossible across
  service boundaries.
- *"When would you choose a self-managed Kafka-compatible service over
  a fully AWS-native stream?"* Strong answer: when there's an existing
  Kafka investment — producers, consumers, Kafka Connect connectors, or
  a multi-cloud requirement — not because Kafka is technically superior
  for a greenfield AWS-only use case.
- *"How do you decide when a batch pipeline should become a streaming
  one?"* Strong answer: don't default to streaming because it sounds
  more advanced. Convert only when the business genuinely needs a
  latency budget streaming buys you, because streaming pipelines carry
  real, continuous operational and cost overhead that batch doesn't.

### 7. Cheat sheet

| If the scenario says... | Reach for... |
|---|---|
| land a stream in S3, least overhead | Amazon Data Firehose |
| real-time, multiple consumers, replay | Kinesis Data Streams |
| existing Kafka | Amazon MSK |
| continuously replicate a database | AWS DMS (CDC) |
| Aurora/DynamoDB → Redshift, no pipeline | zero-ETL integration |
| serverless catalog-native ETL | AWS Glue |
| existing Spark/Hive, or PB-scale + lowest cost | Amazon EMR (+ Spot on task nodes) |
| under 15 minutes, event-driven, lightweight | AWS Lambda |
| windowed aggregation on a live stream | Managed Service for Apache Flink |
| serverless workflow, retries, branching | AWS Step Functions |
| existing Airflow DAGs | Amazon MWAA |
| simple cron | EventBridge Scheduler |
| decouple + buffer + guaranteed order | SQS FIFO |
| decouple + fan-out to many subscribers | SNS / EventBridge |

### 8. Memory tricks

**"BRTO"** — every ingestion decision runs through **B**atch-or-stream,
**R**eplay needs, **T**hroughput/latency, **O**perational overhead, in
that order. **"Bronze never changes"** — the raw zone is immutable;
that single fact is what makes replay, audit, and reprocessing possible
everywhere else in the pipeline.

---

<a name="p1"></a>
## PART 1 — The five guard rails

Before naming a service in *any* Domain 1 question, run the scenario
through these five filters. They are listed in the order that
eliminates the most wrong answers fastest.

```
GUARD RAIL 1 — DATA CHARACTERISTICS
  Batch or streaming?  Structured, semi-structured, or unstructured?
  Data size (GB / TB / PB)?  Velocity (daily batch vs continuous)?

GUARD RAIL 2 — SLA / LATENCY BUDGET
  Milliseconds?  Seconds?  Minutes?  Hours?  "Near" real-time is
  seconds-to-minutes. "Real-time" is sub-second.

GUARD RAIL 3 — OPERATIONAL OVERHEAD
  Serverless (Glue, Lambda, Firehose)?  Managed (EMR, MSK, RDS)?
  Self-managed (rare — usually a wrong answer on this exam)?

GUARD RAIL 4 — COST MODEL
  Always-running (pay for idle) vs event-driven (pay per invocation)
  vs pay-per-use (pay per GB/TB processed)?

GUARD RAIL 5 — RECOVERY REQUIREMENTS
  Need replay?  Need retries?  Need checkpointing?  Need exactly-once,
  or is at-least-once + idempotency good enough (usually is)?
```

Applying all five to a single scenario, worked example: *"A healthcare
company needs to ingest HL7 patient monitoring events from bedside
devices. Events must be available for a fraud/anomaly detection model
within 2 seconds, must never be lost even if the detection service is
down for maintenance, and the platform team has one part-time
engineer."*

- **Guard rail 1** — streaming, semi-structured (HL7), moderate volume.
- **Guard rail 2** — 2 seconds = real-time, not near-real-time. Rules
  out Amazon Data Firehose immediately.
- **Guard rail 3** — one part-time engineer = must be low-ops. Rules
  out self-managed Kafka; leans against provisioned MSK.
- **Guard rail 4** — continuous device stream = always-on cost is
  acceptable and expected here.
- **Guard rail 5** — "must never be lost even during downstream
  downtime" = need retention/replay, not fire-and-forget.

**Answer: Kinesis Data Streams**, in on-demand mode (removes shard
management for the one-person team), with 24-hour-plus retention so the
detection service can catch up after maintenance. This is the pattern
to run on every ingestion question in this domain: five filters, in
order, before you look at the options.

---

<a name="t11"></a>
## TASK 1.1 — PERFORM DATA INGESTION

### 1.1.1 Read data from streaming sources

**Senior engineer framing:** the question is never "which streaming
service is best" — it's "what does this specific stream need that the
others don't provide." Four real candidates, four different answers to
"what makes this one necessary":

| Attribute | **Kinesis Data Streams** | **Amazon MSK** | **DynamoDB Streams** | **DMS (CDC mode)** |
|---|---|---|---|---|
| Purpose | Durable, replayable, multi-consumer stream | Managed Apache Kafka | Table change feed | Database change feed |
| AWS-native protocol | ✅ | ❌ (Kafka wire protocol) | ✅ | ✅ |
| Kafka compatibility | ❌ | ✅ Only option | ❌ | ❌ |
| Change data capture | ❌ (you stream events yourself) | ❌ (unless source pushes CDC into it) | ✅ Table-scoped only | ✅ Purpose-built |
| Latency | ~200 ms (~70 ms w/ EFO) | ~10 ms | Near real-time, seconds | Seconds (CDC lag) |
| Ops experience | Low (esp. on-demand mode) | Medium–high | Lowest (fully implicit) | Low–medium |
| Replay | ✅ 24 h–365 d | ✅ Configurable + tiered storage | ✅ 24 h only | ⚠️ Depends on target |
| Best use case | Clickstream, IoT telemetry, fraud events, app logs | Kafka migration, existing Kafka ecosystem | React to item-level table changes | Continuous DB replication |

**Select Kinesis Data Streams when** the scenario is native AWS,
real-time, and needs replay or multiple independent consumers reading
at their own pace. Architecture: `Producer(s) → Kinesis Data Streams →
Lambda / KCL consumer → S3 or downstream service`. Producers write with
the PutRecord/PutRecords API or the Kinesis Producer Library (KPL,
which batches and compresses for you); consumers read with
GetRecords, the Kinesis Client Library (KCL, which manages shard
assignment and checkpointing), or an event source mapping straight into
Lambda.

**Select MSK when** the organization already runs Kafka — existing
producers speaking the Kafka wire protocol, existing Kafka Connect
connectors, existing Kafka Streams applications, or a deliberate
multi-cloud Kafka strategy. The trade-off a senior engineer states out
loud: MSK is Kafka-compatible, which is valuable *only* if that
compatibility is actually being used — otherwise it's strictly more
operational surface than Kinesis for the same outcome. MSK Serverless
removes broker sizing/patching; MSK provisioned is cheaper at steady,
predictable volume.

**Select DynamoDB Streams when** you need to react to changes in a
specific table — not a general-purpose event bus, a change feed scoped
to one table's inserts/updates/deletes. Example: `Customer record
updated → DynamoDB Stream → Lambda → send welcome email / update search
index`. Retention is fixed at 24 hours — if you need longer retention
or fan-out to many consumers, pair it with Kinesis Data Streams for
DynamoDB (a table-level toggle that gives DynamoDB changes Kinesis's
retention and consumer model).

**Select DMS (CDC mode) when** the source of truth is a relational or
NoSQL database you don't want to modify application code to
instrument — DMS reads the database's native change log (binlog,
redo log, oplog) and streams changes out without touching the
application. This is the only one of the four that requires **zero
producer-side code changes**.

**Common mistake:** treating DynamoDB Streams as a general-purpose
event bus for arbitrary application events — it only fires on writes to
the specific table it's attached to. **Exam trap:** a question
describing "existing Kafka producers, cannot be rewritten" with Kinesis
Data Streams as a tempting option — Kinesis does **not** speak the
Kafka protocol; producers would need code changes. MSK is the only
protocol-compatible answer.

### 1.1.2 Read data from batch sources

Batch reads pull from a source at an interval rather than reacting to
individual events. The decision here is less about "which service" and
more about "what shape is the source."

| Source shape | Reach for | Why |
|---|---|---|
| Files already in S3 | Glue ETL / Athena directly | No extraction step needed |
| Relational DB via JDBC (RDS, on-prem Oracle/SQL Server) | Glue JDBC connection or DMS full load | Glue for ETL-shaped extracts; DMS for migration-shaped extracts |
| Data warehouse export | Redshift UNLOAD to S3 | Native, parallelized, writes Parquet directly |
| Metadata catalog only (schema/partitions) | Glue Data Catalog + crawler | Not itself a data mover |
| Massive historical dataset (TB–PB) | EMR (Spark/Hive reading from S3 or HDFS) | Distributed read at scale |
| SaaS application (Salesforce, ServiceNow, Zendesk) | AppFlow | Purpose-built connectors, no custom code |
| Third-party data product you subscribe to/license (financial, geospatial, healthcare data feeds) | AWS Data Exchange | Delivers subscribed datasets straight into S3/Redshift — no custom pipeline against an external API/FTP |

The single most common Domain-1 batch pattern, and worth memorizing as
a default: `S3 (raw) → Glue ETL job → Parquet (curated) → Athena`. When
a question doesn't specify anything unusual about the source, this is
the shape the "least operational overhead" answer usually takes.

**Senior engineer note:** "batch ingestion" and "batch source" are
different ideas that get conflated. A source can be inherently batchy
(a nightly SFTP drop) or you can choose to *treat* a streaming-capable
source as batch (querying an API every hour instead of subscribing to
its webhook). The second case is a legitimate cost/complexity trade-off
— don't reach for Kinesis just because a source theoretically supports
real-time if the business requirement is genuinely "once an hour is
fine."

### 1.1.3 Configure batch ingestion

Guard rails specific to configuring a batch job well: **partitioning?
compression? incremental or full load? parallel read?**

Best practices, and why each matters:

- **Partition on arrival**, using a date hierarchy like
  `s3://bucket/table/year=2026/month=08/day=07/`. This lets every
  downstream reader (Athena, Glue, Redshift Spectrum) skip irrelevant
  data via partition pruning instead of scanning the whole dataset.
- **Write Parquet + Snappy** at the ingestion boundary rather than
  ingesting as raw CSV/JSON and converting later — every hour spent
  querying uncompressed row-based data multiplies cost downstream.
- **Prefer incremental extraction over full reload** once a table is
  large: use a watermark column (`updated_at > last_run_timestamp`) or,
  for Glue, **job bookmarks**, so a nightly job processes only new or
  changed rows instead of re-reading the entire source every run.
- **Read with parallelism matched to the source's own partitioning.**
  Glue's JDBC connections support a `hashfield`/`hashpartitions` or
  bounded-query split so a single 500 GB table extract fans out across
  many workers instead of pulling serially through one JDBC connection.
- **Avoid millions of tiny files.** A batch job configured to write one
  file per micro-batch, run every minute, for a year, produces exactly
  the small-file problem covered in 1.2.7 and Domain 2 — batch the
  writes or add a compaction step.

⚠️ **Exam trap:** "process only new data since the last run" almost
always means **Glue job bookmarks**, and "we need to reprocess all
historical data" means **reset the bookmark** — not "enable bookmarks,"
which is already the default assumption once the job is bookmark-aware.

### 1.1.4 Consume APIs

| Scenario | Service |
|---|---|
| Lightweight, occasional API calls | AWS Lambda |
| Scheduled API polling (e.g., hourly) | EventBridge Scheduler + Lambda |
| Large-volume API extract requiring ETL logic | AWS Glue job (Python shell or Spark) |
| Ongoing, managed integration with a named SaaS app | Amazon AppFlow |

**AppFlow deserves the most attention here** because it's frequently
the "least operational overhead" trap-avoider: for named SaaS sources
(Salesforce, Slack, Zendesk, ServiceNow, Google Analytics, and dozens
more), AppFlow provides scheduled or event-driven data transfer with
built-in field mapping, filtering, and validation — no Lambda code, no
API client library to maintain, no pagination/retry logic to write by
hand. The exam trap: a question describing "integrate Salesforce data
into S3 with minimal custom code" tempts you toward Lambda (because
"API integration" sounds like a coding task) when AppFlow is purpose-
built and requires none.

Common architecture for a non-AppFlow-supported API: `Third-party API →
Lambda (auth, pagination, retry) → S3 (raw JSON) → Glue crawler →
Glue ETL → curated Parquet`.

**Common mistake:** writing custom Lambda code to poll a SaaS API that
AppFlow already has a native connector for — this is extra code to
maintain for a solved problem, a red flag in any "least operational
overhead" scenario.

**AWS Data Exchange** solves a different ingestion problem than AppFlow
and is worth distinguishing clearly: **AppFlow moves data from a SaaS
app your own organization already uses** (Salesforce, Slack) into AWS.
**AWS Data Exchange delivers a data product someone else publishes** —
a third-party provider's financial, geospatial, healthcare, or
demographic dataset you subscribe to or license — automatically into
S3 or Redshift, refreshed on the provider's schedule, with no API
client, pagination logic, or FTP polling to build. When a scenario says
a team wants to **subscribe/license a third-party data provider's
dataset** and have it land in S3 or Redshift, AWS Data Exchange is the
answer, not a custom Lambda/API-poller and not AppFlow.

### 1.1.5 Set up schedulers

| Need | Service | Why |
|---|---|---|
| Simple time-based trigger ("run at 2 AM daily") | **EventBridge Scheduler** | Purpose-built cron/rate replacement, cheapest, simplest |
| Multi-step DAG with dependencies and branching | **MWAA** | Only one of the three with real DAG semantics |
| Chain only Glue jobs and crawlers | **Glue Workflows** | Native, free, but Glue-scoped only |

**Exam rule, stated plainly:** a *simple* schedule is EventBridge; a
*complex, branching, dependency-aware* schedule across heterogeneous
services is MWAA; a schedule that touches *only* Glue resources is
Glue Workflows. MWAA is never the "least operational overhead" answer
by itself — it runs an always-on environment — but it becomes correct
the moment the scenario says "existing Airflow DAGs" or "complex Python
dependencies in the orchestration layer," because rewriting an
established DAG library into Step Functions state machines is real,
avoidable engineering cost.

### 1.1.6 Set up event triggers

| Event source | Reach for |
|---|---|
| Object lands in S3 | S3 Event Notification → Lambda / SQS / SNS / EventBridge |
| Any AWS service state change (Glue job SUCCEEDED, EC2 instance state) | EventBridge rule |
| Row/item changes in a DynamoDB table | DynamoDB Streams → Lambda |
| New records on a Kinesis/MSK stream | Kinesis/MSK event source mapping → Lambda |

Common architecture: `S3 upload → S3 Event Notification → Lambda →
downstream processing`. The distinguishing question between S3 Event
Notifications and EventBridge for S3 events specifically: use the
native S3 notification for simple single-destination cases; use
**EventBridge (with S3 EventBridge notifications enabled on the
bucket)** when you need content-based filtering, multiple independent
targets, or to combine the S3 event with rules from other services in
one place.

### 1.1.7 Call Lambda from Kinesis

Architecture: `Producer → Kinesis Data Streams → Lambda (event source
mapping) → destination`. Lambda polls the stream via an internal
process and invokes your function synchronously with a batch of
records — you don't write the polling loop yourself.

Three tuning knobs a senior engineer treats as a single trade-off, not
three independent settings:

| Setting | Turning it up... | Turning it down... |
|---|---|---|
| **Batch size** | Higher throughput per invocation, but higher latency to see the first record processed, and a bigger blast radius if one bad record fails the whole batch | Lower latency, more invocations (more cost), smaller blast radius |
| **Parallelization factor** (1–10 per shard) | Faster processing of a single hot shard, more concurrent Lambda invocations (more cost, and can exhaust concurrency limits) | Slower catch-up if a shard falls behind, cheaper |
| **Retry / bisect-on-error** | Protects against data loss from a transient failure | Without it, a permanently failing record can block the whole shard indefinitely (the "poison pill" problem — see 1.3.2) |

⚠️ **Exam trap:** a single bad record in a batch, without
`BisectBatchOnFunctionError` configured and a destination for failed
records (an on-failure destination — SQS or SNS — or a DLQ), can block
the entire shard from making progress, because Lambda's default
behavior retries the *whole batch* forever. This is the classic
"consumer stuck, `IteratorAge` climbing forever" scenario.

### 1.1.8 IP allow lists

Network-level ingestion controls used when a partner, vendor, or
external system needs restricted access:

| Mechanism | Scope | Use when |
|---|---|---|
| **Security Groups** | Instance/ENI-level, stateful | Restrict which IPs can reach an EC2/RDS/Redshift endpoint |
| **Network ACLs** | Subnet-level, stateless | Coarse subnet-wide allow/deny, defense in depth |
| **Redshift cluster security / VPC security groups** | Cluster endpoint | Only named IP ranges can connect to the warehouse |
| **RDS security groups** | DB instance endpoint | Same idea for RDS/Aurora |

**Common mistake:** relying on a security group alone for "public
partner access" without also considering whether the resource should
be in a private subnet behind a VPC endpoint instead — a security group
restricts *who* can connect, but doesn't remove the exposure of having
a public endpoint at all. For DEA-C01 purposes, know that IP allow
lists are implemented at the security-group/NACL layer, not as an
application-level feature of the analytics services themselves.

### 1.1.9 Throttling, rate limits, and backpressure

| Symptom | Root cause | Fix |
|---|---|---|
| DynamoDB `ThrottledRequests` rising | RCU/WCU exceeded, or hot partition | Switch to on-demand capacity, or enable auto-scaling, or fix the partition key design |
| Kinesis `WriteProvisionedThroughputExceeded` | Shard limit exceeded (1 MB/s or 1,000 records/s per shard) | Add shards (reshard), or move to on-demand mode |
| RDS "too many connections" | Connection pool exhaustion under load | Put **RDS Proxy** in front to pool and multiplex connections |
| Third-party API returning HTTP 429 | You're exceeding the API's own rate limit | Exponential backoff with jitter, and respect `Retry-After` |

**The golden rule tested repeatedly on this exam: retry with
exponential backoff, not fixed-interval retry, and not infinite retry.**
A naive retry loop that fires again every second during a throttling
event makes the throttling *worse* — it adds load right when the
downstream system is signaling it's overwhelmed. Exponential backoff
(1s, 2s, 4s, 8s...) combined with jitter (a small random offset) avoids
synchronized retry storms across many clients.

**Backpressure**, conceptually: when a downstream consumer can't keep
up with an upstream producer, the system needs *some* mechanism to
absorb the gap rather than dropping data or crashing. Kinesis and SQS
absorb backpressure naturally because they're durable buffers — the
producer keeps writing, the consumer catches up on its own schedule,
and nothing is lost as long as retention/visibility windows are long
enough. This is the underlying reason "add a queue or stream between
two systems with mismatched throughput" is so often the right answer
architecture on this exam.

### 1.1.10 Fan-in and fan-out patterns

```
FAN-IN                                  FAN-OUT
Mobile app ──┐                                       ┌──▶ Real-time analytics
Web app ─────┼──▶ Kinesis Data Streams ──▶ (1 stream) ┼──▶ Fraud detection
IoT devices ─┘         (many producers,               ├──▶ Monitoring dashboard
Backend svc ─┘          one durable stream)            └──▶ Long-term archive (S3)
```

**Fan-in**: many independent producers write into a single durable
stream or queue — the pattern any time a scenario mentions "multiple
applications," "mobile and web clients," or "several IoT device types"
all sending data that needs to land in one place.

**Fan-out**: one stream serves many independent consumers, each reading
at its own pace for its own purpose. The trap to know cold: Kinesis
Data Streams' **standard consumers share 2 MB/s of read throughput per
shard across all of them** — with four consumer applications, that's
0.5 MB/s each in the worst case. **Enhanced Fan-Out (EFO)** gives each
registered consumer its own dedicated 2 MB/s per shard, independent of
how many other consumers exist, at additional cost. The exam signal:
"multiple consumer applications, each needs full throughput" or
"consumers competing for read capacity" → Enhanced Fan-Out.

### 1.1.11 Replayability

**Best practice, stated as a rule: always keep the raw, unmodified
data.** Architecture: `Streaming or batch source → Raw S3 zone
(immutable) → Transformation → Curated zone`. The raw zone is what
makes every one of the following possible: reprocessing after a bug is
found in the transformation logic, satisfying an audit that asks "show
me exactly what we received on this date," and disaster recovery if a
downstream table is corrupted.

| Mechanism | Replay window |
|---|---|
| S3 (raw zone retained indefinitely, or per lifecycle policy) | As long as you keep the objects |
| Kinesis Data Streams retention | 24 hours default, up to 365 days |
| MSK / Kafka retention | Configurable, plus **tiered storage** for very long, cheap retention |
| Amazon Data Firehose | **None — no replay capability at all** |

⚠️ **Exam trap, high-frequency:** Firehose has zero replay capability.
If a scenario combines "land data in S3 with minimal operational
overhead" with **any** mention of needing to reprocess or replay,
Firehose is disqualified even though it's usually the "least overhead"
default — the replay requirement wins.

### 1.1.12 Stateful vs. stateless data transactions

| | Stateful | Stateless |
|---|---|---|
| Definition | Processing depends on data seen previously | Each event processed independently, no memory of prior events |
| Examples | Session analysis, running totals, fraud detection scoring across a user's recent history, windowed aggregation | Field validation, PII masking, format conversion, simple filtering |
| AWS tools | Managed Service for Apache Flink (checkpointed state), Lambda with an external state store (DynamoDB) | Lambda, Glue (per-record transforms), Firehose transformation |
| Failure recovery | Needs checkpointing — losing in-memory state on a crash loses the running computation | Trivial to retry — reprocessing the same event twice (with idempotency) causes no correctness issue |

**Senior engineer framing:** the decision of stateful vs. stateless
isn't really a service choice, it's a design admission about what the
transformation logic actually needs to know. A running 5-minute average
of transaction amounts per account is inherently stateful — you cannot
compute it by looking at one event in isolation, so the engine
(Managed Flink) must maintain and checkpoint that state safely across
restarts. A currency-code normalization step is inherently stateless —
you can run it in Lambda, kill and restart it mid-stream, and lose
nothing, because every invocation is self-contained.

---

<a name="t12"></a>
## TASK 1.2 — TRANSFORM AND PROCESS DATA

### 1.2.1 Optimize container usage (ECS vs. EKS vs. Fargate)

| Attribute | **ECS** | **EKS** | **Fargate (mode, not a separate service)** |
|---|---|---|---|
| Orchestrator | AWS-proprietary | Kubernetes | Applies to either ECS or EKS |
| Operational overhead | **Lowest** of the two orchestrators | Higher — Kubernetes control plane concepts | Removes node management entirely |
| Best fit | AWS-native container workloads, teams without existing Kubernetes investment | Teams already running Kubernetes elsewhere, need portability | Bursty or unpredictable container workloads where you don't want to size EC2 capacity |
| Data engineering relevance | Running containerized transformation microservices, custom connectors | EMR on EKS, portable Spark workloads across clouds | Removing capacity planning for either orchestrator |

**Senior engineer take:** for a pure data engineering pipeline, this
choice rarely leads — EMR, Glue, and Lambda cover the vast majority of
processing needs without touching a container orchestrator directly.
Containers become relevant when (a) the team is running **EMR on EKS**
specifically because Kubernetes is the org's standard deployment
target for everything, or (b) a custom connector/microservice needs
packaging that doesn't fit Lambda's 15-minute/10 GB ceiling but doesn't
need a full Spark cluster either. Default to ECS with Fargate unless
the scenario names an existing Kubernetes investment — then EKS is
correct specifically *because* of that existing investment, the same
logic as MSK vs. Kinesis.

### 1.2.2 Connect to data sources (JDBC / ODBC)

| Protocol | Typical sources | AWS usage |
|---|---|---|
| **JDBC** | RDS, Aurora, on-prem Oracle/SQL Server/MySQL/PostgreSQL, Redshift | Glue JDBC connections, EMR Spark JDBC reads, Athena JDBC driver for BI tools |
| **ODBC** | Legacy Windows/BI applications | Athena/Redshift ODBC drivers for tools like Excel, Tableau |

Glue **connections** store the JDBC URL, credentials (via Secrets
Manager), and VPC/subnet/security-group configuration once, so every
job that needs that source reuses the same tested configuration instead
of re-embedding connection strings and passwords in job code. **Common
mistake:** hardcoding database credentials in a Glue script instead of
referencing a Glue connection backed by Secrets Manager — this fails
both the "least operational overhead" and the security-domain
expectations of the exam simultaneously.

### 1.2.3 Integrate data from multiple sources

Architecture: `RDS (JDBC) + third-party API (via AppFlow) + S3 (raw
files) + CRM export → Glue ETL job (joins across DynamicFrames) →
Unified curated dataset in S3`.

The core skill being tested is recognizing that Glue's **DynamicFrame**
abstraction (rather than a strict Spark DataFrame) is what makes
merging heterogeneous, semi-structured, and evolving-schema sources
tractable in one job — `resolveChoice()` lets you handle a column that
is sometimes a string and sometimes a number across different source
batches without the job failing outright. **When NOT to use
DynamicFrames:** once schema is fixed and known and performance matters
more than schema flexibility, converting to a native Spark DataFrame
partway through the job (`.toDF()`) is faster for the compute-heavy
parts of the transformation.

### 1.2.4 Optimize processing cost

Relative cost ordering for transformation compute, cheapest-to-most-
expensive at *small* job sizes (this ordering flips at very large
scale, which is the trap):

```
Lambda (small, short jobs)  <  Glue (medium ETL, serverless Spark)  <  EMR (large-scale, cluster)

...EXCEPT at petabyte scale with Spot on task nodes, where EMR
   becomes the cheapest per-TB-processed option, because Glue's
   per-DPU pricing and Lambda's ceiling stop being competitive.
```

Cost levers, roughly in order of typical impact:

1. **Partition pruning** — don't scan data you don't need.
2. **Spot instances** on EMR **task nodes only** (never primary, rarely
   core — see 1.2.5).
3. **Parquet + compression** — smaller data means less to read, less
   to shuffle, less to pay for.
4. **Right-size compute** — a G.1X Glue worker doing a job that needs
   G.2X just OOMs and retries, which is *more* expensive than sizing
   correctly the first time; an oversized cluster just idles.
5. **Glue Flex execution class** for non-urgent, schedule-flexible
   jobs — runs on spare capacity at a discount with variable start
   time; never the answer when there's an SLA.

### 1.2.5 Transformation service selection

| Attribute | **Lambda** | **Glue ETL** | **EMR** | **Managed Flink** | **Redshift (COPY/UNLOAD, transform-in-warehouse)** |
|---|---|---|---|---|---|
| Purpose | Small, event-driven transforms | Serverless, catalog-native Spark ETL | Full big-data cluster, any framework | Continuous stream processing | Load/transform inside the warehouse |
| Serverless | ✅ | ✅ | EMR Serverless option | ✅ | Serverless option |
| Streaming | ✅ (via event source mapping) | ✅ Glue Streaming | ✅ Spark Structured Streaming | ✅ Core purpose | ❌ |
| Batch | ⚠️ 15-min ceiling | ✅ | ✅ | ❌ | ✅ |
| Max runtime | **15 minutes** | Unlimited | Unlimited | Continuous | N/A |
| Frameworks | Your code, any supported runtime | Spark, Python shell, Ray | **Spark, Hive, Presto/Trino, HBase, Flink** | Flink | SQL |
| Cheapest at PB scale | ❌ | ❌ | ✅ with Spot task nodes | ❌ | N/A (different purpose) |
| Best use case | Light transform, format conversion of individual objects, glue-code between services | Catalog-driven batch/streaming ETL | Existing Hadoop ecosystem workloads, extreme cost optimization at scale | Windowed aggregation, anomaly detection on a live stream | Bulk load/unload plus SQL-based transformation already inside the warehouse |
| When NOT to use | >15 min runtime or >10 GB memory need | Non-Spark framework requirement (e.g., need Presto specifically) | Want zero cluster management | Batch-shaped workload | Data isn't already in or headed to Redshift |
| Exam favorite phrase | "under 15 minutes" | "serverless ETL integrated with the Data Catalog" | "existing Spark scripts" / "lowest cost at petabyte scale" | "tumbling window", "exactly-once" | "load/unload between S3 and Redshift" |

**Senior engineer decision process, worked out loud:** *"Is this
Spark/Hive/Presto code that already exists and works? Don't rewrite it
— EMR. Is it new ETL that needs to interact with the Glue Catalog and
doesn't need a framework EMR-only provides? Glue. Is it a single small
transform triggered by an event, done in under 15 minutes? Lambda. Does
correctness genuinely depend on a time window over the live stream
itself, not a batch of files? Managed Flink. Is the data already
sitting in Redshift and the transform is expressible as SQL? Just write
the SQL — don't build a whole external pipeline to do what a `CREATE
TABLE AS SELECT` already does."* That's the actual reasoning chain, and
it's what separates a fast, correct answer from guessing based on
keyword matching.

**Glue worker types**, memorize the OOM fix:

| Worker | vCPU | Memory | Use for |
|---|---|---|---|
| G.1X | 4 | 16 GB | Default; most ETL |
| G.2X | 8 | 32 GB | **First fix when a job runs out of memory** |
| G.4X / G.8X | 16 / 32 | 64 / 128 GB | Large joins, big shuffles |
| G.025X | 2 | 4 GB | Low-volume streaming only |

**EMR node types**, the recurring Spot trap:

```
PRIMARY NODE  — cluster coordinator.  NEVER Spot — losing it kills the cluster.
CORE NODES    — run tasks AND hold HDFS data.  Spot here risks losing data.
TASK NODES    — run tasks only, no HDFS.  SPOT GOES HERE. This is the exam answer.
```

Any answer option that says "use Spot instances for all node types" is
wrong by construction — flag it immediately.

### 1.2.6 Transform data between formats

The most-tested conversions: **CSV → Parquet** and **JSON → Parquet**.
Why this appears constantly: row-based text formats (CSV, JSON) are
easy to write but expensive to read at scale — every query re-parses
every field of every row. Parquet is columnar, so a query touching 3 of
40 columns physically reads only those 3 columns' data, and it supports
predicate pushdown (skip whole row groups that can't match a filter)
and strong compression. The typical benefit range: 30–90% storage
reduction and a proportional reduction in Athena/Redshift Spectrum scan
cost, because both are billed per byte scanned.

Where the conversion happens matters: Glue ETL jobs converting on
write, Firehose's **built-in format conversion** (JSON → Parquet/ORC
inline during delivery, no separate job needed), and Athena **CTAS**
(`CREATE TABLE AS SELECT`) to materialize a Parquet copy of a query
result are the three mechanisms tested. Firehose format conversion is
the "least operational overhead" answer specifically when the source is
already flowing through Firehose — no separate Glue job needed.

### 1.2.7 Troubleshoot transformation failures

| Symptom | Root cause | Fix |
|---|---|---|
| Job fails with out-of-memory / executor lost | Insufficient worker memory for the shuffle/join size | Increase worker type (G.1X → G.2X), or repartition to reduce per-task data volume |
| Some tasks take far longer than others | **Data skew** — one partition key has disproportionately more rows | Salt the key, repartition, or use adaptive query execution |
| Crawler/job fails after upstream added a column | **Schema drift** | Update the crawler, use `resolveChoice`, or design for schema evolution up front (Iceberg) |
| Job runs correctly but is slow and expensive | **Small-file problem** — too many tiny objects | Compact via `coalesce()`/`repartition()` before write, or a scheduled compaction job |
| Job "succeeds" but reprocesses everything every run | Job bookmark not enabled, or was reset unintentionally | Enable/verify bookmarks; confirm the source supports them (not every JDBC source does) |

**Interview question:** *"A nightly Glue job that used to take 12
minutes now takes 3 hours and sometimes fails. What do you check
first?"* Strong answer, in order: check whether upstream data volume
or shape actually changed (new column, sudden skew in a key), check the
Spark UI / Glue job metrics for a small number of tasks dominating
total runtime (skew signature), check worker type and DPU count against
current data volume, and only after ruling those out consider a genuine
code regression.

### 1.2.8 Create data APIs

Architecture: `API Gateway → Lambda → S3 / DynamoDB / Redshift Data
API`. This pattern exposes curated data to other systems or teams
without giving them direct data-store access — useful for data
products, microservice architectures, and controlled external sharing.
API Gateway handles auth (IAM, Cognito, or API keys), throttling, and
request validation; Lambda executes the query/lookup logic; the
backing store depends on the access pattern (DynamoDB for key-value
lookups, Redshift Data API for SQL-shaped access to warehouse data
without managing a persistent JDBC connection from Lambda).

**Common mistake:** using a traditional JDBC connection from a Lambda
function to Redshift for a data API — this leaks connections under
concurrency and doesn't scale. The **Redshift Data API** is
purpose-built for this: it's HTTP-based, asynchronous-friendly, and
doesn't require managing connection pools or VPC networking from
Lambda.

### 1.2.9 Volume, velocity, variety

The three V's, applied concretely rather than as an abstract mnemonic:

| V | Means | Data engineering consequence |
|---|---|---|
| **Volume** | How much data (GB/TB/PB) | Drives the choice between Lambda/Glue (moderate) and EMR (extreme) |
| **Velocity** | How fast it arrives (daily batch vs. continuous stream) | Drives streaming vs. batch ingestion service selection |
| **Variety** | Structured (relational), semi-structured (JSON, XML, Avro), unstructured (images, free text, logs) | Drives schema handling — DynamicFrames for variety, strict DataFrames for known structure |

**Why this matters practically, not just as vocabulary:** a scenario
that emphasizes high volume *and* high velocity *and* high variety
simultaneously is describing a use case where no single simple answer
(just Lambda, just a small Glue job) will hold up — that combination is
the signal for EMR or a more sophisticated Glue Streaming + Iceberg
architecture, and the exam uses this combination to justify a more
"heavyweight" correct answer than the pattern-matching instinct
("small job, use Lambda") would suggest.

### 1.2.10 LLM integration in data pipelines

This is 2026-era exam content that didn't exist in older material.
Where large language models fit into a *data engineering* pipeline
(not a data science one):

| Use case | How it fits the pipeline |
|---|---|
| Classification of unstructured text (support tickets, reviews) | A transformation step that enriches a record with a category before it lands in the curated zone |
| Metadata generation (auto-summarizing a document, tagging an image) | Populates catalog/metadata fields that would otherwise require manual tagging |
| PII detection as a transformation step | Complements Macie (which scans data at rest in S3) by flagging PII inline during ETL |
| Content enrichment | Adding derived fields — sentiment, entities, translated text — during the curated-zone transform |

**Services:** **Amazon Bedrock** (managed access to foundation models
via API, the typical answer for "call an LLM from a Glue/Lambda step
without hosting a model") and **SageMaker** (when the scenario needs a
custom-trained or fine-tuned model rather than an off-the-shelf
foundation model). **Exam framing:** DEA-C01 does not test ML model
training — it tests recognizing that Bedrock is invoked *as a step
within* an existing ingestion/transformation pipeline (e.g., a Lambda
function calling the Bedrock API mid-ETL to classify a record), not as
a replacement for the pipeline itself.

---

<a name="t13"></a>
## TASK 1.3 — ORCHESTRATE DATA PIPELINES

### 1.3.1 Workflow service selection

| Attribute | **EventBridge** | **Step Functions** | **MWAA** | **Glue Workflows** |
|---|---|---|---|---|
| Scheduling | ✅ (Scheduler) | ❌ (triggered, not itself a scheduler) | ✅ | ✅ |
| State management across steps | ❌ | ✅ Native | ✅ Native (Airflow) | ⚠️ Basic |
| Branching / conditional logic | ⚠️ Rule-based only | ✅ Rich (Choice states) | ✅ Rich (Python) | ⚠️ Limited |
| ETL orchestration across many AWS services | ⚠️ Limited (routing only) | ✅ | ✅ | ⚠️ Glue-scoped only |
| Cost when idle | Near zero | Zero | **High — always-on environment** | Zero |
| Best use case | Event routing, simple triggers | Serverless multi-step pipelines needing retries and audit history | Existing Airflow DAGs, complex Python dependencies | Pure-Glue job/crawler chains |

**Senior engineer decision process:** *"Does this pipeline touch only
Glue jobs and crawlers, with simple sequencing? Glue Workflows — it's
free and purpose-fit. Does it touch multiple AWS services (Lambda,
Glue, EMR, SNS) with real branching and needs a durable execution
history for audit? Step Functions — this is the default 'serverless
orchestration' answer on the exam. Does the team already have Airflow
DAGs, or need Python-native operators/hooks that Step Functions'
state-machine JSON can't express cleanly? MWAA — and only then, because
it is never the low-overhead answer on its own merits."* EventBridge is
usually the *trigger* that kicks off one of the other three, not a
full orchestrator by itself.

### 1.3.2 Build resilient pipelines

The non-negotiable checklist a senior engineer applies to any pipeline
before calling it production-ready:

| Element | What it protects against |
|---|---|
| **Retry with exponential backoff** | Transient failures (network blips, momentary throttling) |
| **Checkpointing** | Losing progress on a long-running job after a crash |
| **Idempotency** | Duplicate processing from at-least-once delivery causing double-counted or corrupted results |
| **Dead-letter queue (DLQ)** | A single malformed/poison record blocking an entire stream or queue forever |
| **Monitoring and alerting** | Silent failures — a job that fails at 2 AM and nobody knows until a stakeholder asks where the report is |

**Idempotency, explained concretely:** if a pipeline might process the
same event twice (which at-least-once delivery guarantees will
eventually happen), the *processing* needs to produce the same result
whether it runs once or five times — a conditional write keyed on a
unique event ID (`PutItem` with a condition expression, or an upsert/
`MERGE` keyed on a natural key) achieves this without needing the
transport layer to guarantee exactly-once, which is expensive or
impossible across many service boundaries.

**DLQs and poison messages:** a "poison message" is one that will never
process successfully no matter how many times it's retried (malformed
JSON, a record referencing a foreign key that doesn't exist). Without a
DLQ, a naive retry loop retries it forever, blocking everything behind
it (this is the same underlying mechanism as the Lambda/Kinesis
"stuck shard" trap in 1.1.7). With a DLQ, the poison message is set
aside after N attempts, the rest of the queue/stream keeps moving, and
a human or a separate remediation process handles the DLQ contents
later.

### 1.3.3 Implement serverless workflows

Best-practice pattern: `EventBridge (trigger) → Step Functions (branch,
retry, sequence) → Lambda (execute) → S3 (land result)`. Benefits: no
infrastructure to patch or scale, pay only for actual executions/state
transitions, and Step Functions gives you a visual, auditable execution
history for free — genuinely useful when a scenario mentions needing to
prove *what happened and when* for an audit.

**Step Functions Standard vs. Express**, the recurring head-to-head:

| | Standard | Express |
|---|---|---|
| Max duration | 1 year | 5 minutes |
| Semantics | Exactly-once | At-least-once |
| Cost model | Per state transition | Per request + duration, cheaper at very high volume |
| Execution history | Full, 90 days, in-console | CloudWatch Logs only |
| Best for | Long-running, needs full audit trail | Millions of short, high-volume executions (e.g., one per IoT event) |

### 1.3.4 Use notification services for alerts

| | **SNS** | **SQS** |
|---|---|---|
| Delivery model | Push (fan-out to many subscribers) | Pull (consumer polls the queue) |
| Purpose | Notify — email, SMS, Lambda, HTTP endpoints, other queues | Buffer/decouple — hold work until a consumer is ready |
| Decoupling | ❌ Not really — subscribers must be ready to receive | ✅ Core purpose |
| Ordering | ❌ (unless FIFO topic) | FIFO queues guarantee order; standard queues don't |
| Typical pipeline role | "A Glue job failed — email/page the on-call engineer" | "Buffer incoming work so a slow consumer doesn't lose it" |

Common pattern for pipeline alerting: `Glue job state change →
EventBridge rule (matches FAILED state) → SNS topic → email/Slack/
PagerDuty`. This is the standard answer whenever a scenario says
"notify the team when a job fails" — EventBridge captures the state
change event natively (Glue, Step Functions, and most AWS services
emit these), and SNS delivers it to humans.

---

<a name="t14"></a>
## TASK 1.4 — APPLY PROGRAMMING CONCEPTS

### 1.4.1 Optimize code to reduce runtime

Techniques the exam expects you to recognize, not implement from
scratch: **parallel processing** (partition work across workers instead
of a single-threaded loop — this is the entire reason Spark/EMR/Glue
exist rather than everyone writing pandas scripts), **batch processing**
(one API call for 500 records instead of 500 individual calls — e.g.,
`PutRecords` instead of 500 `PutRecord` calls, or DynamoDB
`BatchWriteItem`), **efficient algorithms** (an O(n log n) sort beats an
O(n²) one at any real scale — see 1.4.11), and **avoiding unnecessary
full scans** (a `Scan` against DynamoDB or an unpartitioned Athena query
against a huge table both do far more work than a targeted `Query` or a
partition-pruned query).

### 1.4.2 Configure Lambda for concurrency and performance

| Setting | Solves | Trade-off |
|---|---|---|
| **Reserved concurrency** | Guarantees a function always has capacity available, and caps it so one function can't starve others in the account | Capacity you reserve is unavailable to other functions even when idle |
| **Provisioned concurrency** | Eliminates cold starts by keeping N execution environments warm | You pay for that warm capacity whether or not it's invoked |
| **Concurrency limits (account/function level)** | Controls cost and protects downstream systems (e.g., a database) from being overwhelmed by a burst of parallel invocations | Excess invocations beyond the limit are throttled, not queued (for synchronous invokes) |

**Memory setting is also a performance lever, not just a cost one** —
Lambda allocates CPU proportionally to configured memory, so a
CPU-bound function can sometimes run *faster and cheaper overall* at a
higher memory setting because the higher price-per-millisecond is more
than offset by the shorter duration.

### 1.4.3 Languages relevant to DEA-C01

Priority order, reflecting what actually appears in scenarios and code
snippets on the exam: **SQL** (by far the most tested — window
functions, CTEs, MERGE), **Python** (Glue scripts, Lambda handlers,
PySpark), **Scala** (occasionally, in EMR/Spark-native contexts), then
Java, Bash, PowerShell, and R appear rarely if at all. You will not be
asked to write or debug a large program from scratch — you'll be asked
to recognize what a short snippet does or which language fits a stated
constraint (e.g., "the team's existing Spark jobs are written in
Scala").

### 1.4.4 Software engineering best practices

Git for version control, CloudWatch for logging and monitoring,
automated testing (unit tests for transformation logic before it ships),
and CI/CD (see 1.4.9) are all treated as baseline professional practice
the exam expects a candidate to recognize as correct answers when
offered against sloppier alternatives ("manually edit the job in the
console and save," "SSH into the box and run the script by hand" are
reliable distractors).

**Amazon Q Developer** is an AI coding assistant integrated into IDEs
(VS Code, JetBrains) and the AWS console that generates, explains, and
debugs code faster — Glue scripts, Lambda handlers, SQL, and IaC
templates (CloudFormation/CDK) included. For the exam this is
recognize-level knowledge only: know it exists and what class of
problem it solves (accelerating code authoring and troubleshooting for
a human developer), not a data processing or orchestration service, so
it never competes with Glue/EMR/Lambda in a "which service processes
this data" question.

### 1.4.5 Infrastructure as code

| Tool | AWS-native | Multi-cloud | Full programming language |
|---|---|---|---|
| **CloudFormation** | ✅ | ❌ | ❌ (declarative YAML/JSON) |
| **AWS CDK** | ✅ | ❌ | ✅ (TypeScript, Python, Java, etc. — compiles to CloudFormation) |
| **Terraform** | ⚠️ Works, not native | ✅ | ❌ (declarative HCL, but provider-agnostic) |

CDK is the exam's preferred answer when a scenario wants both AWS-
native deployment *and* the expressiveness of a real programming
language (loops, conditionals, reusable constructs) — CloudFormation
alone can't loop cleanly, and Terraform, while capable, is the answer
specifically when multi-cloud portability is stated as a requirement.

### 1.4.6 AWS SAM

**AWS SAM** (Serverless Application Model) is a CloudFormation
extension purpose-built for deploying serverless applications — Lambda
functions, API Gateway, DynamoDB tables, Step Functions state machines
— with a much shorter, more declarative syntax than raw CloudFormation
for these specific resource types, plus a local testing/invoke CLI.
**Use when** the architecture is serverless-first and the team wants
less boilerplate than raw CloudFormation. **When NOT to use:** the
architecture includes significant non-serverless infrastructure (EMR
clusters, VPC networking, RDS) — plain CloudFormation or CDK handles
the full resource surface better.

### 1.4.7 Storage volumes in Lambda

Lambda's default `/tmp` is ephemeral, private to a single execution
environment, and capped (up to 10 GB configurable). **Use Amazon EFS
when** a Lambda function needs persistent storage shared across
concurrent invocations — loading a large ML model file once and
sharing it across many warm invocations, or when multiple functions
need to read/write the same file set. EFS mounts into a VPC, so this
also brings VPC networking considerations (cold-start latency, ENI
limits) that a pure `/tmp`-based function avoids.

### 1.4.8 Repeatable resource deployment

| Attribute | CloudFormation | CDK | Terraform |
|---|---|---|---|
| AWS-native | ✅ | ✅ | ⚠️ Provider-based |
| Uses a real programming language | ❌ | ✅ | ❌ |
| Multi-cloud | ❌ | ❌ | ✅ |
| Best use case | Simple, AWS-only, declarative stacks | AWS-only stacks needing loops/abstraction/reuse | Multi-cloud or hybrid infrastructure |

This is the same matrix as 1.4.5 — it appears twice in the task
statements because "apply programming concepts" and "package/deploy"
are tested from both a conceptual-knowledge angle and a hands-on-skill
angle. Expect it to surface as both a "which tool" question and a
"here's a CDK snippet, what does it deploy" question.

### 1.4.9 CI/CD

Standard pipeline shape: `Git → Build → Test → Deploy`. AWS-native
tooling: **CodeBuild** (compile/test/package), **CodePipeline**
(orchestrates the stages), **CodeDeploy** (deployment strategies
including blue/green). The source-control step is Git-based, typically
**GitHub, GitLab, or Bitbucket** in 2026 practice, feeding into
CodePipeline/CodeBuild/CodeDeploy.

⚠️ **Exam-guide update:** **AWS CodeCommit was removed from the
DEA-C01 in-scope services list in the December 2025 exam guide
revision (v1.1)** — do not pick it as a current exam answer. The
CI/CD pipeline shape itself is still tested; only the source-control
service named in it has changed. For a data engineering pipeline
specifically, CI/CD typically means: lint/test Glue and Lambda code on
every commit, package and validate CloudFormation/CDK/SAM templates,
and deploy to a lower environment automatically before a gated
promotion to production — the same discipline applied to infrastructure
that a software team applies to application code.

### 1.4.10 Distributed computing concepts

Core idea: split a large workload across many machines so it completes
faster than on one machine, and survives individual machine failure.
**Apache Spark** (the engine behind Glue ETL and most EMR jobs) and
**Hadoop/HDFS** (the storage layer EMR clusters traditionally used
before S3-native reads became standard) are the concrete
implementations tested. Benefits a senior engineer names explicitly:
**horizontal scalability** (add more, cheaper nodes rather than one
increasingly expensive node), **parallel processing** (many partitions
of data transformed simultaneously), and **fault tolerance** (Spark's
lineage-based recomputation means losing one executor doesn't lose the
whole job — it just recomputes the lost partition). **Common mistake
that shows up as an exam trap:** assuming more nodes always means
faster — if the job is dominated by a shuffle on a skewed key (1.2.7),
adding nodes doesn't help until the skew itself is fixed.

### 1.4.11 Data structures and algorithms

Tested only at a conceptual, "when would you reach for this" level —
not implementation:

| Structure | Data engineering application |
|---|---|
| **Hash tables** | Fast O(1) lookups; the mechanism behind deduplication (has this event ID been seen?) and join optimization (hash joins) |
| **Trees** | Representing hierarchies — organizational structures, partition directory trees, B-tree indexes underlying most relational databases |
| **Graphs** | Relationship analysis — recommendation engines, fraud ring detection (Neptune's core use case), lineage tracking (which upstream tables feed this report) |

**Interview-style framing:** *"Why would a fraud detection team choose
a graph database over a relational one for this problem?"* Strong
answer: fraud rings are fundamentally about relationships between
entities (shared devices, shared addresses, transaction chains) — a
graph structure makes "find all accounts within 3 hops of this flagged
account" a natural traversal, while the equivalent in SQL is a chain of
increasingly expensive self-joins.

---

<a name="trees"></a>
## DECISION TREES

### Tree 1 — Which ingestion service?

```
Is the source a database you want to replicate continuously
without touching the application?
   │
  YES ──▶ Is it Aurora/RDS-MySQL/DynamoDB going straight to
   │       Redshift or OpenSearch, no transformation needed?
   │           │
   │          YES ──▶ ZERO-ETL INTEGRATION
   │           │
   │           NO ──▶ AWS DMS (CDC, or full-load+CDC for migration)
   │
  NO
   │
   ▼
Does data arrive continuously and need sub-second processing,
replay, or multiple independent consumers?
   │
  YES ──▶ Does the producer already speak the Kafka protocol
   │       and must not be rewritten?
   │           │
   │          YES ──▶ AMAZON MSK
   │           │
   │           NO ──▶ KINESIS DATA STREAMS
   │
  NO
   │
   ▼
Does data arrive continuously but only needs to land in S3/
Redshift/OpenSearch within roughly a minute, least overhead?
   │
  YES ──▶ AMAZON DATA FIREHOSE
   │
  NO ──▶ It's batch. Is it a named SaaS app? ──▶ APPFLOW
          Is it files/JDBC on a schedule?     ──▶ GLUE / DMS FULL LOAD
```

Reading this tree: the first fork separates "replicate a database" from
everything else, because zero-ETL and DMS are purpose-built and should
be reached for before considering generic streaming services. The
second fork is the real-time-vs-near-real-time-vs-batch split — Kafka
compatibility breaks the tie between MSK and Kinesis when both would
otherwise work, replay/multi-consumer needs push toward Kinesis over
Firehose, and "least overhead, ~60 second lag is fine" pushes toward
Firehose. Anything left over is batch, split by whether it's a
recognized SaaS connector (AppFlow) or generic files/JDBC (Glue/DMS).

### Tree 2 — Which transformation service?

```
Is this an existing Spark/Hive/Presto/HBase codebase, or does
petabyte-scale cost optimization matter more than anything else?
   │
  YES ──▶ AMAZON EMR (Spot on TASK nodes only)
   │
  NO
   │
   ▼
Does correctness depend on a time window over the LIVE stream
itself (not a batch of files already landed)?
   │
  YES ──▶ MANAGED SERVICE FOR APACHE FLINK
   │
  NO
   │
   ▼
Is the job under 15 minutes, event-triggered, and lightweight
(no heavy Spark-only framework need)?
   │
  YES ──▶ AWS LAMBDA
   │
  NO
   │
   ▼
Is the data already inside Redshift and expressible as SQL?
   │
  YES ──▶ REDSHIFT (COPY/UNLOAD, CTAS-style transform)
   │
  NO ──▶ AWS GLUE ETL (the serverless, catalog-native default)
```

Reading this tree: it deliberately checks for the two "special case"
answers first (EMR for existing-framework/extreme-cost scenarios,
Flink for genuine stream-time-window logic) before falling through to
the two general-purpose defaults (Lambda for small/fast, Glue for
everything else) — because those two special cases are the ones exam
questions use to trap people into picking Glue reflexively when EMR or
Flink is actually required by a stated constraint.

### Tree 3 — Which orchestration service?

```
Does this pipeline touch ONLY Glue jobs and crawlers, with
simple linear or basic conditional sequencing?
   │
  YES ──▶ GLUE WORKFLOWS (free)
   │
  NO
   │
   ▼
Does the team have EXISTING Airflow DAGs, or need complex
Python-native operators/dependencies in the orchestrator itself?
   │
  YES ──▶ MWAA
   │
  NO
   │
   ▼
Is this "run this cron/rate schedule" with no branching,
retries, or multi-step state needed?
   │
  YES ──▶ EVENTBRIDGE SCHEDULER
   │
  NO ──▶ STEP FUNCTIONS
          (Standard if >5 min or needs full audit history;
           Express if millions of short, high-volume executions)
```

Reading this tree: MWAA is checked early but only wins on the explicit
"existing Airflow" signal — never on generic "we need orchestration."
Simple time-only triggers go to EventBridge Scheduler; anything needing
real state, branching, or retries across multiple services falls
through to Step Functions, which is the domain's general-purpose
serverless orchestration default.

---

<a name="mnemonics"></a>
## MNEMONICS

- **"BRTO"** — **B**atch-or-stream, **R**eplay needs, **T**hroughput/
  latency, **O**perational overhead: the four-question filter to run
  before naming any ingestion service.
- **"Bronze never changes"** — the raw S3 zone is immutable; this one
  fact is what makes replay, audit, and reprocessing possible
  everywhere downstream.
- **"Firehose forgets"** — Firehose has no replay capability; if replay
  matters, it's disqualified regardless of how good a "least overhead"
  fit it otherwise looks like.
- **"Task nodes take the risk"** — Spot instances go on EMR task nodes
  only; primary and core nodes hold state or coordinate the cluster and
  should not be interrupted.
- **"MWAA only wins on 'existing'"** — MWAA is never the default
  low-overhead orchestration answer; it wins specifically when the
  scenario names an existing Airflow investment.
- **"Retry slower, not harder"** — exponential backoff with jitter, not
  fixed-interval or infinite retry, is the answer to throttling.
- **"DLQ catches poison, not headaches"** — a dead-letter queue exists
  to isolate the one record that will never succeed so it doesn't block
  everything behind it.
- **"Columnar for consumption, row for receiving"** — land raw data in
  row-based formats if that's how it arrives, but convert to Parquet
  before anything queries it repeatedly.

---

<a name="bank"></a>
## PRACTICE QUESTION BANK — 40 QUESTIONS

Mix: questions 1–10 straightforward, 11–30 scenario-based, 31–40 hard /
multi-constraint. Every option is explained — including why the wrong
ones are wrong — because eliminating distractors correctly is the real
skill this exam tests.

---

**Q1.** A team needs to land clickstream events into S3 with the least
possible operational overhead. A short delay of about a minute before
the data is queryable is acceptable, and no replay capability is
needed.

A. Kinesis Data Streams with a Lambda consumer
B. Amazon Data Firehose
C. Amazon MSK with a custom S3 sink connector
D. AWS DMS in CDC mode

**Answer: B.** Firehose is fully managed, requires no consumer code or
shard management, and its buffered delivery (default up to ~60 s or a
size threshold) is exactly what "about a minute" and "least overhead"
describe.
- A is wrong: Kinesis Data Streams requires you to write and operate a
  consumer; it's more operational surface than the requirement needs.
- C is wrong: MSK requires managing brokers and a connector — far more
  overhead than justified here, and there's no mention of existing
  Kafka.
- D is wrong: DMS CDC replicates database changes, not application
  clickstream events; wrong tool for this source type entirely.

---

**Q2.** A company needs multiple independent applications — fraud
detection, real-time analytics, and long-term archival — to each read
the same event stream at their own pace, and one team requires the
ability to reprocess the last 5 days of events after fixing a bug.

A. Amazon Data Firehose
B. Kinesis Data Streams with a 7-day retention period
C. Amazon SNS
D. Amazon SQS Standard queue

**Answer: B.** Kinesis Data Streams supports many independent
consumers reading at their own offsets, and configurable retention
(here 7 days, comfortably covering the 5-day replay need) enables
reprocessing.
- A is wrong: Firehose delivers to exactly one destination and has no
  replay capability at all.
- C is wrong: SNS pushes to subscribers immediately; it has no
  retention or replay — once delivered (or failed), the message is
  gone.
- D is wrong: SQS is a point-to-point queue — once a consumer deletes a
  message it's gone, and it doesn't natively support multiple
  independent consumers each reading the full stream.

---

**Q3.** A data engineering team is migrating an existing on-premises
Apache Kafka deployment to AWS. Producers and consumers use the Kafka
protocol directly and cannot be rewritten in the migration timeline.

A. Kinesis Data Streams with the Kinesis Producer Library
B. Amazon MSK
C. Amazon Data Firehose
D. Amazon EventBridge

**Answer: B.** MSK is the only AWS streaming service that speaks the
native Kafka wire protocol, so existing producers and consumers connect
with no code changes.
- A is wrong: Kinesis Data Streams uses its own API; even with the KPL,
  producer code would need to be rewritten to speak Kinesis rather than
  Kafka.
- C is wrong: Firehose is a delivery service, not a Kafka-compatible
  ingestion endpoint.
- D is wrong: EventBridge is an event bus for routing AWS/SaaS events,
  not a Kafka-compatible streaming platform.

---

**Q4.** Which AWS change-data-capture mechanism requires zero
modification to the producing application because it reads directly
from the database's native transaction log?

A. DynamoDB Streams
B. Amazon Kinesis Data Streams
C. AWS DMS in CDC mode
D. AWS Glue crawler

**Answer: C.** DMS reads the source database's native change log
(binlog, redo log, oplog depending on engine) without requiring any
application-level instrumentation.
- A is wrong: DynamoDB Streams is scoped to DynamoDB tables specifically
  and requires the table to be a DynamoDB table with streams enabled —
  not a general relational CDC mechanism.
- B is wrong: Kinesis Data Streams requires a producer to actively write
  events to it; it doesn't read a database's change log on its own.
- D is wrong: a Glue crawler discovers and catalogs schema/partition
  metadata — it does not capture ongoing data changes.

---

**Q5.** A nightly job needs to extract data from an on-premises SQL
Server database via JDBC and land it as Parquet in S3, processing only
rows that changed since the previous run.

A. AWS Lambda with a JDBC driver layer, re-querying the full table
   every run
B. AWS Glue ETL job with a JDBC connection and job bookmarks enabled
C. Amazon Kinesis Data Streams reading directly from SQL Server
D. Amazon SNS publishing table rows on a schedule

**Answer: B.** Glue's JDBC connections handle the extraction, and job
bookmarks track what's already been processed so only new/changed rows
are picked up on subsequent runs — exactly the "only changed since last
run" requirement.
- A is wrong: Lambda's 15-minute ceiling makes it a poor fit for a
  potentially large nightly extract, and re-querying the full table
  every run ignores the incremental requirement entirely.
- C is wrong: Kinesis Data Streams has no native mechanism to read from
  a relational database via JDBC.
- D is wrong: SNS is a notification/pub-sub service, not a data
  extraction or ETL mechanism.

---

**Q6.** A company wants to bring Salesforce opportunity data into S3
on a daily schedule with minimal custom code to maintain.

A. Write a Lambda function using the Salesforce REST API with custom
   pagination and retry logic
B. Use Amazon AppFlow with its native Salesforce connector
C. Deploy an EC2 instance running a cron job with a Python script
D. Use AWS DMS to connect to Salesforce as a database source

**Answer: B.** AppFlow has a purpose-built Salesforce connector with
scheduling, field mapping, and error handling built in — no custom
integration code required.
- A is wrong: this works but requires writing and maintaining custom
  API client code, directly contradicting "minimal custom code."
- C is wrong: this is the most operationally heavy option — a
  self-managed EC2 instance is neither serverless nor low-maintenance.
- D is wrong: DMS connects to relational/NoSQL databases via native
  drivers, not to SaaS REST APIs like Salesforce.

---

**Q7.** A pipeline needs to run at exactly 2:00 AM UTC every day, with
no branching logic or dependency management required.

A. AWS Step Functions with a scheduled Standard workflow
B. Amazon MWAA with a daily-scheduled DAG
C. Amazon EventBridge Scheduler
D. AWS Glue Workflows with a time-based trigger

**Answer: C.** EventBridge Scheduler is purpose-built for exactly this
case — a simple, cost-minimal cron/rate-based trigger with no need for
state management or branching.
- A is wrong: Step Functions is capable of this but is over-engineered
  for a plain schedule with no branching — it adds cost and complexity
  the requirement doesn't need.
- B is wrong: MWAA runs an always-on Airflow environment, incurring
  ongoing cost that a simple daily trigger doesn't justify.
- D is wrong: Glue Workflows can schedule, but it's scoped to
  orchestrating Glue jobs/crawlers specifically — appropriate only if
  the pipeline is Glue-only, which isn't stated here.

---

**Q8.** An application must react within seconds whenever a new object
is uploaded to a specific S3 prefix, invoking a Lambda function to
process it.

A. Schedule a Lambda function to run every minute and list new objects
B. Configure an S3 Event Notification to invoke Lambda directly on
   `s3:ObjectCreated:*`
C. Use AWS Config to detect the new object and trigger a remediation
   action
D. Enable a DynamoDB Stream on a table tracking uploaded file names

**Answer: B.** S3 Event Notifications fire immediately on object
creation and can invoke Lambda directly — the standard, lowest-latency,
lowest-overhead mechanism for this exact requirement.
- A is wrong: polling every minute adds unnecessary latency and cost
  compared to an event-driven trigger, and requires custom logic to
  track "new" objects.
- C is wrong: AWS Config tracks resource configuration compliance, not
  S3 object uploads — it's the wrong service category entirely.
- D is wrong: this requires a separate DynamoDB table and a process to
  populate it on upload, which is more complex than triggering directly
  off the S3 event.

---

**Q9.** A Lambda function consuming from a Kinesis Data Streams shard
occasionally receives one malformed record that causes the function to
throw an exception every time it's retried, and the shard's
`IteratorAge` metric is climbing without bound.

A. Increase the shard's parallelization factor
B. Configure a failure destination (or DLQ) and enable
   `BisectBatchOnFunctionError` so the poison record is isolated
C. Increase the Lambda function's memory allocation
D. Switch the stream from provisioned to on-demand capacity mode

**Answer: B.** Without an on-failure destination and batch-bisecting
enabled, Lambda retries the entire batch containing the bad record
indefinitely, blocking the shard. Isolating the poison record (via
bisecting and routing it to a DLQ/destination) lets processing resume
past it.
- A is wrong: parallelization factor increases concurrency across
  shards/sub-shards but does nothing to resolve a record that always
  fails — the same poison record still blocks progress.
- C is wrong: more memory doesn't fix a logic/data error that throws
  regardless of resources available.
- D is wrong: capacity mode affects throughput scaling, not error
  handling for a specific malformed record.

---

**Q10.** Which statement about Amazon Data Firehose is accurate and
frequently tested?

A. Firehose retains data for up to 365 days, enabling replay
B. Firehose supports exactly-once delivery semantics by default
C. Firehose has no replay capability — once delivered, data cannot be
   reprocessed through Firehose itself
D. Firehose requires manually managed shards like Kinesis Data Streams

**Answer: C.** This is Firehose's defining limitation relative to
Kinesis Data Streams — it is a delivery pipe with no retention or
replay mechanism of its own.
- A is wrong: that 365-day retention figure describes Kinesis Data
  Streams, not Firehose, which has no retention concept at all.
- B is wrong: Firehose provides at-least-once delivery, not
  exactly-once.
- D is wrong: Firehose is fully managed and auto-scaling with no shard
  concept — that manual/scalable shard model belongs to Kinesis Data
  Streams.

---

**Q11.** A retail company's operational database is Aurora MySQL. They
want near-real-time analytics in Redshift with the least possible
pipeline engineering, and they don't need any transformation of the
data before it lands in the warehouse.

A. Build a Glue ETL job that runs every 5 minutes reading from Aurora
   via JDBC
B. Configure a zero-ETL integration from Aurora MySQL to Redshift
C. Use AWS DMS with full load and CDC into Redshift
D. Set up Aurora read replicas and query them directly from Redshift
   Spectrum

**Answer: B.** Aurora MySQL to Redshift is exactly the supported
zero-ETL pairing — it replicates changes within seconds with no
pipeline to build, monitor, or maintain, satisfying "least possible
pipeline engineering."
- A is wrong: this requires building, scheduling, and maintaining a
  custom extraction job — real ongoing engineering effort the
  requirement explicitly wants to avoid.
- C is wrong: DMS works and is a legitimate CDC tool, but it's more
  operational surface (replication instance, task monitoring) than
  zero-ETL when the source/target pair is directly supported.
- D is wrong: Redshift Spectrum queries data in S3, not live data in
  Aurora read replicas — this isn't how Spectrum functions.

---

**Q12.** An IoT platform ingests telemetry from 200,000 devices at a
sustained 25,000 records/second, average record size 3 KB. Four
separate internal teams each need to consume the full stream at full
throughput independently. What must the design include?

A. A single Kinesis Data Streams shard with on-demand mode
B. Enough shards to cover the throughput, plus Enhanced Fan-Out so
   each of the 4 consumers gets a dedicated 2 MB/s per shard
C. Amazon Data Firehose with four separate delivery streams
D. A single SQS Standard queue with four consumers polling it

**Answer: B.** 25,000 rec/s × 3 KB ≈ 75 MB/s, requiring at least 75
shards by throughput (compare to 25 shards by record count — take the
larger). Standard consumers share 2 MB/s per shard across all
consumers, which isn't enough for 4 consumers each needing full
throughput — Enhanced Fan-Out gives each consumer its own dedicated 2
MB/s per shard.
- A is wrong: one shard handles only 1 MB/s or 1,000 records/s — wildly
  insufficient for 75 MB/s of ingest, regardless of on-demand mode
  (which still has ceilings and ramp time).
- C is wrong: Firehose has exactly one destination per delivery stream
  and no concept of multiple independent full-throughput consumers of
  the same data.
- D is wrong: SQS doesn't support multiple consumers each independently
  reading every message at full throughput — messages are typically
  consumed once and removed.

---

**Q13.** A healthcare company must retain the ability to prove exactly
what raw data was received from a partner on any given day for
compliance audits, even years later, while also running daily
transformations on that data.

A. Delete raw files after successful transformation to save storage
   costs
B. Land and permanently retain raw, unmodified data in a dedicated S3
   "raw" zone before any transformation occurs
C. Transform data in-place, overwriting the original files
D. Rely on CloudTrail logs as the record of what data was received

**Answer: B.** An immutable raw zone is the standard mechanism for
audit and replay — retaining the unmodified originals means you can
always answer "what did we actually receive" independent of any bugs
or changes in downstream transformation logic.
- A is wrong: deleting raw data after transformation removes the exact
  audit trail the requirement needs — if a transformation bug is later
  found, there's nothing to reprocess or verify against.
- C is wrong: overwriting originals destroys the very evidence a
  compliance audit would need to inspect.
- D is wrong: CloudTrail records API activity (who called what), not
  the content of the data itself — it cannot answer "what data did we
  receive."

---

**Q14.** A streaming pipeline computes a 10-minute rolling average of
transaction amounts per account to flag anomalies in real time. Which
characteristic correctly describes this workload, and which service
fits it best?

A. Stateless; AWS Lambda is sufficient
B. Stateful; Managed Service for Apache Flink, because the computation
   depends on a window of prior events
C. Stateless; Amazon Data Firehose with inline transformation
D. Stateful; Amazon SQS with visibility timeout tuning

**Answer: B.** A rolling average over a window requires remembering
prior events within that window — inherently stateful — and Managed
Flink is purpose-built for exactly this kind of checkpointed, windowed
stream computation.
- A is wrong: this workload cannot be computed by looking at one event
  in isolation, which is what "stateless" and a bare Lambda invocation
  imply; you'd need to bolt on an external state store to fake
  statefulness, reinventing what Flink already provides.
- C is wrong: Firehose's inline transformation is a stateless,
  per-record Lambda transform — it has no windowing or state
  management capability.
- D is wrong: SQS visibility timeout controls message redelivery
  behavior, not stream state or windowed computation — unrelated
  mechanism.

---

**Q15.** A team runs Spark and Presto jobs that already exist and work
well in an on-premises Hadoop cluster. Leadership wants to move to AWS
with the lowest possible reengineering effort, and cost at large scale
is the top priority.

A. Rewrite all jobs as AWS Glue ETL scripts
B. Amazon EMR, using Spot Instances on task nodes
C. AWS Lambda functions triggered per file
D. Amazon Managed Service for Apache Flink

**Answer: B.** EMR is the only option that runs the existing
Spark/Hive/Presto code with minimal rewriting, and Spot Instances on
task nodes (never primary or core) deliver the lowest cost at scale
without risking cluster stability or data loss.
- A is wrong: Glue supports Spark but not Presto/Trino, and migrating
  working code to Glue's execution model is real reengineering effort
  the requirement wants to avoid.
- C is wrong: Lambda cannot run Presto at all and has a 15-minute
  runtime ceiling entirely unsuited to large Spark/Hadoop-scale
  workloads.
- D is wrong: Flink is a stream-processing engine, not a drop-in
  replacement for existing batch Spark/Presto jobs.

---

**Q16.** A Glue ETL job needs to read from an on-premises Oracle
database and requires the connection string, credentials, and network
configuration to be reused consistently and securely across multiple
jobs.

A. Hardcode the connection string and password directly in each job
   script
B. Store credentials in plaintext in an S3 configuration file read by
   each job
C. Create a Glue connection backed by Secrets Manager for credentials
D. Pass the password as a Lambda environment variable invoked by each
   Glue job

**Answer: C.** A Glue connection centralizes the JDBC URL, VPC/subnet/
security-group settings, and references credentials stored securely in
Secrets Manager — reused consistently across every job without
duplicating sensitive values.
- A is wrong: hardcoding credentials in script code is a security
  anti-pattern and fails "securely," plus it must be duplicated and
  kept in sync across every job.
- B is wrong: plaintext credentials in S3 are not secure, regardless of
  bucket permissions, and don't provide rotation or centralized
  management.
- D is wrong: this introduces an unrelated Lambda function and
  environment variable as an unnecessary indirection; Glue jobs
  reference Glue connections directly, not via Lambda.

---

**Q17.** A company wants to build a single curated dataset by joining
customer records from Aurora (via JDBC), support ticket data from a
third-party API integrated through AppFlow, and historical order files
already sitting in S3 as JSON with an evolving schema.

A. Write separate hardcoded Spark DataFrame scripts assuming a fixed
   schema for each source
B. Use a Glue ETL job with DynamicFrames, applying `resolveChoice` to
   handle the evolving JSON schema before joining
C. Manually export every source to CSV and merge them in Excel
D. Use Amazon SNS to combine all three sources into one topic

**Answer: B.** DynamicFrames are designed for exactly this kind of
multi-source, schema-flexible integration — `resolveChoice` lets the
job tolerate the evolving JSON schema from the order files instead of
failing when a field's type changes between batches.
- A is wrong: a fixed-schema DataFrame approach breaks the moment the
  JSON schema evolves, which is explicitly called out as happening
  here.
- C is wrong: manual Excel merging isn't a repeatable, automatable data
  engineering solution and doesn't scale to production pipelines.
- D is wrong: SNS is a pub/sub notification service with no capability
  to join or merge datasets.

---

**Q18.** A team's Glue ETL jobs are costing more than expected. Data
volume has grown, jobs are reading full source tables every run, and
files are stored as uncompressed JSON. Which combination of changes
would most reduce cost?

A. Switch all jobs to G.8X workers for maximum performance
B. Enable job bookmarks for incremental processing, convert storage to
   partitioned Parquet with Snappy compression
C. Disable job bookmarks to ensure no data is ever missed
D. Increase the number of DPUs without changing data format or
   incremental logic

**Answer: B.** Incremental processing (bookmarks) avoids re-reading
unchanged data every run, and Parquet + partitioning + compression
directly reduces the bytes scanned and processed — the two biggest
cost levers available here.
- A is wrong: bigger workers increase cost per hour without addressing
  the root causes (full re-reads, uncompressed row-based format) —
  this makes the bill worse, not better.
- C is wrong: disabling bookmarks guarantees full reprocessing every
  run, which is the opposite of what reduces cost.
- D is wrong: more DPUs increases parallelism but also increases direct
  cost, and does nothing to fix the underlying inefficiency of
  re-reading full uncompressed data every run.

---

**Q19.** Data must be transformed from streaming Kinesis events into
partitioned Parquet files in a data lake, continuously, as events
arrive, with the transformation logic managed centrally in the Glue
Data Catalog.

A. AWS Lambda triggered per-record from Kinesis, writing individual
   Parquet files
B. AWS Glue Streaming ETL job reading from the Kinesis stream
C. Amazon EMR provisioned fresh for every batch of incoming records
D. Amazon Redshift COPY command scheduled hourly

**Answer: B.** Glue Streaming ETL is purpose-built for continuous
micro-batch processing directly from Kinesis/MSK into the data lake,
integrated natively with the Glue Data Catalog for schema/partition
management.
- A is wrong: per-record Lambda writes would create enormous numbers of
  tiny files (the small-file problem) rather than well-sized Parquet
  output, and lacks the catalog-native batch/partition handling Glue
  Streaming provides.
- C is wrong: provisioning a fresh EMR cluster per batch is extremely
  high-overhead and slow compared to a continuously running Glue
  Streaming job — this isn't how EMR is typically operated for
  continuous ingestion.
- D is wrong: Redshift COPY on an hourly schedule is batch, not
  continuous, and doesn't match "as events arrive."

---

**Q20.** A finance team's nightly reconciliation job runs a Spark
transformation on EMR, and the team notices a handful of tasks take
10× longer than the rest, dominating total job runtime, while the
overall data volume hasn't changed much recently.

A. Add more task nodes to the cluster
B. Investigate for data skew on the join/grouping key and consider
   salting or repartitioning
C. Switch the job from EMR to Lambda
D. Increase the EMR primary node's instance size

**Answer: B.** A small number of disproportionately slow tasks against
roughly stable data volume is the classic signature of data skew — a
few partition keys holding far more data than others — and salting or
repartitioning redistributes the work evenly.
- A is wrong: adding more nodes increases available parallelism overall
  but does nothing for the specific skewed partitions, which remain
  bottlenecked on the same few oversized tasks.
- C is wrong: Lambda's 15-minute/10 GB ceiling makes it unsuitable for
  a Spark-scale reconciliation job, and switching engines doesn't fix a
  data distribution problem.
- D is wrong: the primary node coordinates the cluster; resizing it
  doesn't address a shuffle/task-level skew problem happening on
  worker nodes.

---

**Q21.** A logistics company needs to convert daily CSV drop files
(uncompressed, several GB each) into a format optimized for repeated
Athena queries filtering on shipment date and destination region.

A. Leave the files as CSV but add an Athena workgroup data limit
B. Convert to partitioned (by date, region) Parquet files with Snappy
   compression
C. Convert to a single large GZIP-compressed CSV file per day
D. Import the files into DynamoDB and query with Scan operations

**Answer: B.** Partitioning on the exact filter columns enables
partition pruning, and columnar Parquet with compression minimizes
bytes scanned — directly optimized for the stated repeated,
filtered-query access pattern.
- A is wrong: a workgroup data limit caps runaway cost but does nothing
  to make the underlying CSV scans cheaper or faster — it's a
  governance control, not a performance optimization.
- C is wrong: a single large GZIP file is not splittable, meaning one
  worker processes the entire file with no parallelism — worse for
  query performance than the current format in some respects.
- D is wrong: DynamoDB Scan operations read the entire table and are
  not designed for ad-hoc analytical filtering by date/region — the
  wrong store and the wrong access pattern for this use case.

---

**Q22.** A Glue Streaming job ingesting from MSK begins failing after
an upstream producer team adds a new optional field to their event
schema without any coordination.

A. Delete and recreate the Glue job from scratch
B. Update the crawler/schema handling to tolerate the new field, using
   `resolveChoice` or a schema-evolution-aware table format
C. Ask the upstream team to revert their change permanently
D. Switch the destination table engine from Parquet to CSV

**Answer: B.** This is schema drift — the job needs a mechanism that
tolerates evolving schemas gracefully, either through DynamicFrame
schema resolution or by using a table format like Iceberg that supports
safe schema evolution, rather than treating every producer change as a
breaking event.
- A is wrong: recreating the job doesn't address the underlying schema
  handling gap; the same failure recurs on the next unplanned schema
  change.
- C is wrong: relying on upstream teams to never evolve their schema is
  not a sustainable or scalable data engineering solution — schema
  evolution should be designed for, not prohibited.
- D is wrong: CSV doesn't solve schema evolution and gives up the
  performance/compression benefits of Parquet for no benefit.

---

**Q23.** An analytics team needs to expose a curated, aggregated
dataset stored in Redshift to an external partner via a simple,
authenticated HTTPS endpoint, without managing persistent database
connections from application code.

A. Give the partner direct database credentials to the Redshift
   cluster
B. API Gateway → Lambda → Redshift Data API
C. Open the Redshift cluster's security group to the partner's IP
   range
D. Export the entire dataset to a public S3 bucket

**Answer: B.** This is the standard data-API pattern: API Gateway
handles auth and throttling, Lambda executes the logic, and the
Redshift Data API provides HTTP-based, connection-pool-free access to
Redshift — no persistent JDBC connections to manage.
- A is wrong: sharing direct database credentials with an external
  party is a significant security risk and gives far more access than
  a curated, limited data export should.
- C is wrong: opening the cluster's security group to an external IP
  still requires direct database credentials and exposes the cluster
  network-level, without any of the auth/throttling/abstraction a data
  API provides.
- D is wrong: a public S3 bucket is unauthenticated and exposes the
  entire dataset rather than the curated, controlled deliverable
  described.

---

**Q24.** A media company's raw ingestion includes structured billing
records, semi-structured JSON clickstream events, and unstructured
video files, all arriving continuously at high volume. Which
combination of AWS characteristics does this scenario primarily
illustrate?

A. Only "volume" is relevant; velocity and variety don't apply to
   media companies
B. Volume (high data quantities), velocity (continuous arrival), and
   variety (structured, semi-structured, and unstructured data types)
   all apply simultaneously
C. This scenario describes only a batch processing pattern
D. This scenario is purely about orchestration, not data
   characteristics

**Answer: B.** The scenario explicitly describes large quantities
(volume), continuous arrival (velocity), and three different data
shapes (variety) at once — a textbook illustration of all three V's
appearing together, which signals a more sophisticated architecture is
warranted than a single simple ingestion path.
- A is wrong: velocity (continuous arrival) and variety (three distinct
  data types) are both explicitly present in the description — this
  option ignores stated facts.
- C is wrong: "continuously" describes streaming/near-real-time
  velocity, not a batch pattern.
- D is wrong: the scenario is about the nature of the incoming data
  itself, not how it's orchestrated — orchestration isn't mentioned.

---

**Q25.** A team wants to automatically classify inbound customer
support tickets (free-text) by topic as part of their ETL pipeline,
without training or hosting a custom machine learning model.

A. Write a rules-based keyword-matching Lambda function only
B. Call Amazon Bedrock from within the ETL step to classify each
   ticket using a foundation model
C. Store the raw text and defer classification indefinitely
D. Use Amazon Redshift Spectrum to classify the text via SQL

**Answer: B.** Bedrock provides managed API access to foundation
models, letting a pipeline step call an LLM for classification inline
without hosting or training a custom model — exactly matching "without
training or hosting a custom model."
- A is wrong: a rules-based keyword matcher can work as a baseline but
  is far less flexible/accurate for open-ended topic classification
  than an LLM, and the scenario's phrasing suggests wanting the more
  capable approach available in the domain content.
- C is wrong: deferring classification indefinitely doesn't fulfill the
  stated requirement to classify tickets as part of the pipeline.
- D is wrong: Redshift Spectrum is a query engine for S3 data; it has
  no built-in free-text classification/NLP capability.

---

**Q26.** A pipeline chains three steps: a Glue crawler, then a Glue ETL
job, then a second Glue ETL job that depends on the first job's output.
No other AWS services are involved, and the team wants the simplest,
free orchestration option.

A. Amazon MWAA
B. AWS Step Functions Standard
C. AWS Glue Workflows
D. Amazon EventBridge Scheduler with three independent schedules

**Answer: C.** Glue Workflows is purpose-built to chain Glue crawlers
and jobs with dependencies, is free, and is the least operationally
heavy option when the pipeline is Glue-only, as stated.
- A is wrong: MWAA introduces an always-on, non-free Airflow environment
  — far more overhead than justified for a Glue-only chain with no
  other services involved.
- B is wrong: Step Functions works but isn't free and is more general-
  purpose machinery than needed when the entire pipeline is Glue-native
  and Glue Workflows already handles this exact case.
- D is wrong: three independent schedules have no awareness of each
  step's success/failure or completion timing — this breaks the stated
  dependency ("second job depends on the first job's output") since a
  fixed schedule can't guarantee the first job finished.

---

**Q27.** A pipeline processes financial transactions and must
guarantee that even if a message is delivered and processed twice due
to a network retry, the final account balance is still correct.

A. Rely on the message queue to guarantee exactly-once delivery in all
   cases
B. Design the transaction write to be idempotent, e.g., using a unique
   transaction ID with a conditional write that rejects duplicates
C. Disable all retries across the entire pipeline
D. Increase the message visibility timeout indefinitely

**Answer: B.** Idempotent processing — keyed on a unique identifier
with a conditional write — guarantees correctness regardless of how
many times the same message is delivered, without depending on the
transport layer to provide a guarantee that's expensive or impossible
to enforce end-to-end.
- A is wrong: most AWS messaging services provide at-least-once
  delivery by default, and enforcing true exactly-once across
  distributed service boundaries is generally impractical — designing
  for idempotency is the standard, robust answer.
- C is wrong: disabling retries entirely reintroduces data-loss risk
  from transient failures, trading one correctness problem for a worse
  one.
- D is wrong: visibility timeout controls how long a message is hidden
  from other consumers after being received — it doesn't prevent
  duplicate processing across separate delivery attempts or systems.

---

**Q28.** A pipeline occasionally receives a record that will never
successfully process — for example, a JSON payload referencing a
customer ID that doesn't exist in the reference table. Left unhandled,
this record causes repeated failures that block subsequent records in
the same queue.

A. Increase the number of retries to guarantee eventual success
B. Configure a dead-letter queue so the poison record is set aside
   after a bounded number of attempts, letting the rest of the queue
   proceed
C. Delete the queue and recreate it whenever this happens
D. Ignore the failures; they will resolve automatically over time

**Answer: B.** A DLQ is the standard mechanism for isolating messages
that will never succeed, bounding retry attempts and unblocking
everything queued behind the poison message for separate, manual
remediation.
- A is wrong: increasing retries on a message that will never succeed
  (a permanent data problem, not a transient one) just delays the
  inevitable and continues blocking the queue longer.
- C is wrong: deleting and recreating the queue is a destructive, manual
  operation that isn't a sustainable or automatable fix, and risks
  losing other in-flight messages.
- D is wrong: a permanently failing record does not resolve itself —
  without intervention it continues blocking the queue indefinitely.

---

**Q29.** A team building a new serverless pipeline needs branching
logic ("if validation fails, go to a remediation step"), automatic
retries with backoff on transient errors, and a full, queryable
execution history for compliance review, across Lambda, Glue, and SNS
steps.

A. Chain the steps using only EventBridge rules
B. AWS Step Functions Standard workflow
C. A single large Lambda function containing all the logic
D. AWS Glue Workflows

**Answer: B.** Step Functions Standard natively provides branching
(Choice states), built-in retry/backoff configuration per step, and a
durable, queryable execution history for up to 90 days — matching every
stated requirement directly.
- A is wrong: EventBridge rules route events based on content but don't
  provide the stateful branching, per-step retry configuration, or
  execution history a multi-step audited workflow needs.
- C is wrong: cramming all logic into one Lambda function loses the
  visual/auditable step-by-step execution history, complicates error
  isolation, and risks hitting Lambda's 15-minute ceiling as complexity
  grows.
- D is wrong: Glue Workflows is scoped to Glue jobs/crawlers; it doesn't
  orchestrate Lambda and SNS steps with the branching/retry semantics
  described.

---

**Q30.** A Glue job's failure needs to page the on-call data engineer
within seconds of the failure occurring, without the team writing
custom polling code.

A. Have engineers manually check the Glue console every hour
B. EventBridge rule matching the Glue job FAILED state → SNS topic →
   on-call paging integration
C. Configure the Glue job to email itself on failure via a hardcoded
   SMTP call in the script
D. Use AWS Config to detect the failure

**Answer: B.** Glue emits job state-change events natively; an
EventBridge rule matching the FAILED state can trigger an SNS
notification immediately, with no custom polling and no code inside
the job itself — the standard, low-overhead alerting pattern.
- A is wrong: manual hourly checks are slow (violates "within seconds")
  and are not automated at all.
- C is wrong: embedding SMTP/emailing logic inside the job script is
  fragile (it only runs if the job gets far enough to execute that
  code, which may not be true for many failure modes) and isn't a
  managed, reusable pattern.
- D is wrong: AWS Config tracks resource configuration compliance
  changes, not application/job execution state — it wouldn't observe a
  Glue job failure at all.

---

**Q31.** A banking platform ingests 8,000 fraud-signal events/second,
average size 1.5 KB, from an application that cannot be modified to
speak the Kafka protocol. Fraud analysts need sub-second access, three
separate teams need independent full-throughput read access, and
compliance requires the ability to replay any day from the past 90
days. Cost is a secondary concern to correctness.

A. Amazon MSK, since Kafka is the industry standard for this use case
B. Kinesis Data Streams, sized by throughput (8,000 rec/s × 1.5 KB ≈
   12 MB/s → at least 12 shards, take the larger of the record-count
   and throughput calculations), retention set to 90 days, with
   Enhanced Fan-Out for the three independent consumer teams
C. Amazon Data Firehose with a 90-day S3 lifecycle policy for replay
D. DynamoDB Streams with a 90-day custom archival Lambda

**Answer: B.** The application can't speak Kafka, ruling out MSK's
compatibility advantage; Kinesis Data Streams supports sub-second
consumption, up to 365-day retention (covering the 90-day requirement),
and Enhanced Fan-Out gives each of the three teams dedicated
full-throughput access. By record count: 8,000/1,000 = 8 shards; by
throughput: 8,000 × 1.5 KB = 12 MB/s → 12 shards; the larger value (12)
is the correct shard count.
- A is wrong: MSK's core advantage is Kafka protocol compatibility,
  which is explicitly unusable here since the application can't be
  modified to speak Kafka — choosing it gains nothing while adding
  operational overhead.
- C is wrong: Firehose has no replay capability at all — an S3
  lifecycle policy manages storage tiering, not stream replay, and
  Firehose delivery doesn't provide sub-second access for multiple
  independent full-throughput consumers.
- D is wrong: DynamoDB Streams is scoped to table changes, not a
  general high-throughput event stream, and has a fixed 24-hour
  retention with no native 90-day replay — a custom archival Lambda
  would be significant added engineering the scenario doesn't ask for.

---

**Q32.** A pipeline must ingest data from an Aurora PostgreSQL database
into Redshift. The team initially assumes zero-ETL is the answer, but
the requirement also states that inbound records must be enriched with
a derived risk score computed via a custom Python model before landing
in Redshift. Which approach is correct, and why does zero-ETL not
apply here?

A. Zero-ETL integration, because Aurora PostgreSQL to Redshift is a
   supported pairing
B. AWS DMS or a Glue ETL pipeline with a transformation step for the
   custom enrichment logic, because zero-ETL performs no transformation
C. Amazon Data Firehose with inline Lambda transformation
D. Direct Redshift Spectrum queries against Aurora storage

**Answer: B.** Zero-ETL replicates data as-is with no transformation
step — the moment custom enrichment logic (a derived risk score) must
be applied before landing in the warehouse, a pipeline with an actual
transformation stage (DMS into a staging area followed by Glue, or a
Glue-based extract-transform-load) is required instead.
- A is wrong: while Aurora PostgreSQL → Redshift is indeed a supported
  zero-ETL pairing, zero-ETL only replicates data — it does not run
  custom transformation logic, which the scenario explicitly requires.
- C is wrong: Firehose reads from streaming sources (Kinesis, direct
  PutRecord, etc.), not directly from an Aurora database via CDC — it's
  the wrong ingestion mechanism for this source type.
- D is wrong: Redshift Spectrum queries data sitting in S3, not live
  operational data inside Aurora — this isn't a valid way to read from
  Aurora at all.

---

**Q33.** A team runs a Glue Streaming job continuously (24/7) ingesting
from Kinesis, but new analysis shows the source system actually only
produces meaningful new data twice a day, in two large bursts. Cost has
become a concern.

A. Keep Glue Streaming running continuously since streaming is always
   more "modern" than batch
B. Switch to a scheduled Glue batch ETL job (or EventBridge-triggered
   Glue job) that runs after each of the two daily bursts, since Glue
   Streaming bills continuously regardless of whether new data is
   arriving
C. Increase the Glue Streaming job's worker count to process bursts
   faster
D. Move the job to Amazon MWAA to reduce cost

**Answer: B.** Glue Streaming jobs run continuously and bill
continuously whether or not new data is arriving; if the actual arrival
pattern is twice-daily bursts, a scheduled batch job triggered after
each burst eliminates the idle-but-billing streaming cost entirely
while still meeting the actual data delivery pattern.
- A is wrong: "more modern" is not a valid technical justification, and
  this option explicitly ignores the stated cost concern and the
  revealed batch-shaped access pattern.
- C is wrong: increasing worker count on a continuously-running
  streaming job increases cost further — it doesn't address the root
  inefficiency of running continuously for a workload that is actually
  batch-shaped.
- D is wrong: MWAA is an orchestrator with its own always-on environment
  cost — it doesn't inherently reduce Glue's compute billing model at
  all, and introduces unrelated overhead.

---

**Q34.** A data engineering team needs to deploy a serverless pipeline
(Lambda functions, an API Gateway endpoint, and a DynamoDB table) using
AWS-native infrastructure as code, and wants concise, purpose-built
syntax for these specific serverless resource types rather than raw
CloudFormation boilerplate.

A. Terraform, for its multi-cloud support
B. AWS SAM
C. A shell script running the AWS CLI for each resource
D. Manually creating each resource through the console, then exporting
   to CloudFormation afterward

**Answer: B.** AWS SAM is a CloudFormation extension purpose-built for
serverless resource types (Lambda, API Gateway, DynamoDB, Step
Functions) with much less boilerplate than raw CloudFormation, plus a
local testing/invoke CLI — a direct match for the stated need.
- A is wrong: multi-cloud portability isn't a stated requirement here,
  and Terraform doesn't offer SAM's serverless-specific shorthand
  syntax or its local Lambda testing tooling.
- C is wrong: a CLI shell script is imperative, not declarative IaC —
  it isn't repeatable or idempotent in the way IaC tooling is expected
  to be, and doesn't track drift.
- D is wrong: creating resources manually first and exporting afterward
  is backwards from IaC best practice (define infrastructure as code
  first) and is error-prone and non-repeatable.

---

**Q35.** A Lambda function loads a 3 GB machine learning model file on
each cold start, adding significant latency, and multiple concurrent
invocations each redundantly load their own copy of the same file.

A. Increase the Lambda function's timeout setting
B. Mount an Amazon EFS file system to the Lambda function so the model
   file is loaded once and shared read-only across concurrent
   invocations
C. Store the model file in the Lambda deployment package itself
D. Switch the function to Amazon SQS-triggered invocation

**Answer: B.** EFS provides persistent, shared, POSIX file storage that
multiple concurrent Lambda execution environments can mount and read
from without each one independently downloading/loading a redundant
copy — directly solving both the cold-start load latency and the
redundant-loading problem.
- A is wrong: increasing timeout allows the slow load to complete
  without erroring out, but does nothing to reduce the actual latency
  or the redundant per-invocation loading — it treats the symptom, not
  the cause.
- C is wrong: Lambda deployment packages have size limits well below 3
  GB in many packaging paths, and bundling the model doesn't eliminate
  redundant loading across concurrent environments — each one still
  extracts its own copy.
- D is wrong: the invocation trigger type (SQS vs. something else) is
  unrelated to how the function loads and shares a large file — this
  doesn't address the described problem at all.

---

**Q36.** A pipeline ingests a stream and writes 1 file per micro-batch
every 10 seconds to S3, all day, every day. Athena queries against this
table have become slow and expensive despite the total data volume
being modest.

A. Increase the Athena workgroup's data limit
B. This is the small-file problem; add a compaction step (e.g.,
   scheduled Glue job with `coalesce()`/`repartition()`, or Iceberg
   table compaction) to merge small files into targets around 128 MB–1
   GB
C. Convert the table to CSV format for simpler parsing
D. Disable partitioning entirely to reduce file count

**Answer: B.** Writing a new small file every 10 seconds, all day,
produces thousands of tiny objects — per-file overhead (S3 API request
overhead, task startup cost) dominates query time even though total
data volume is modest. Compaction merges these into appropriately-sized
files, which is the standard fix.
- A is wrong: raising a data-scan limit doesn't address the actual root
  cause (excessive per-file overhead from too many tiny objects) and
  may just permit more expensive queries to run rather than making them
  cheaper.
- C is wrong: CSV is a row-based, larger, less efficient format than
  Parquet for analytical queries — this would make performance worse,
  not better, and doesn't address the file-count problem at all.
- D is wrong: disabling partitioning removes the ability to prune
  irrelevant data from scans, making queries slower and more expensive,
  and does nothing about the number of small files.

---

**Q37.** A pipeline reading a 10 GB gzip-compressed CSV file from S3
runs as a single task with no parallelism, and the team's first
instinct is to add more Glue workers to speed it up — but this doesn't
help.

A. Add even more workers until the runtime improves
B. Recognize that standalone GZIP is not splittable — the whole file
   must be read by one task regardless of worker count; convert to
   Parquet with Snappy compression and partition the data instead
C. Convert the file to BZIP2 for faster decompression
D. Increase the Glue job timeout so the single task has more time to
   finish

**Answer: B.** GZIP as a standalone file format is not splittable —
Spark/Glue cannot divide a single gzip file across multiple tasks, so
no amount of additional workers increases parallelism for reading it.
The fix is converting to a splittable, columnar, compressed format
(Parquet + Snappy) and partitioning, not adding compute.
- A is wrong: this is the trap the question is built around — more
  workers do not help a non-splittable single-file read; the
  bottleneck is the file format's lack of splittability, not available
  compute.
- C is wrong: BZIP2 is in fact splittable but is also the slowest
  compression codec of the common options — trading one problem
  (splittability) for a worse one (very slow decompression) instead of
  fixing both by moving to Parquet+Snappy.
- D is wrong: a longer timeout lets the single slow task eventually
  finish, but does nothing to introduce parallelism or reduce actual
  processing time.

---

**Q38.** A team needs to choose between Step Functions Standard and
Express for a new pipeline: millions of short-lived, sub-minute
executions per day are expected (one per IoT device ping), and a full
90-day execution history in the console is not required — CloudWatch
Logs are sufficient for troubleshooting.

A. Step Functions Standard, because it has better execution history
B. Step Functions Express, because its cost model is more efficient at
   very high volumes of short executions and the console history
   requirement is explicitly waived
C. Amazon MWAA, since it can also handle high-volume workflows
D. AWS Glue Workflows, since it's free

**Answer: B.** Express is specifically designed for high-volume, short-
duration (under 5 minutes) workloads with a more cost-efficient pricing
model at that scale; the scenario explicitly states the 90-day console
history isn't needed, removing Standard's main advantage.
- A is wrong: Standard's richer execution history is exactly the
  feature the scenario says isn't required — choosing Standard here
  ignores the stated requirements and picks the more expensive-at-scale
  option.
- C is wrong: MWAA is an Airflow environment with ongoing infrastructure
  cost, not designed around millions of sub-minute discrete executions
  the way Express Step Functions is, and there's no mention of existing
  Airflow DAGs.
- D is wrong: Glue Workflows orchestrates Glue jobs/crawlers
  specifically — it isn't designed for millions of general-purpose
  short executions like per-device IoT pings.

---

**Q39.** An e-commerce company's fraud team wants to identify accounts
connected through shared devices, shared shipping addresses, and
chained transactions, up to several hops away, to detect fraud rings.
Which data structure/service pairing is most appropriate, and why would
a purely relational approach be a poor fit?

A. DynamoDB with GSIs, because key-value lookups are fastest
B. Amazon Neptune (graph database), because fraud-ring detection is
   fundamentally a multi-hop relationship traversal problem that
   becomes a chain of increasingly expensive self-joins in SQL
C. Amazon Redshift with a heavily indexed star schema
D. Amazon OpenSearch, because full-text search is the primary need

**Answer: B.** Multi-hop relationship questions ("accounts within 3
hops of this flagged account, connected via shared devices/addresses")
are a natural graph traversal — Neptune is purpose-built for this,
while the equivalent query in a relational engine requires a growing
chain of self-joins that becomes expensive and unwieldy as hop count
increases.
- A is wrong: DynamoDB GSIs excel at fast key-based lookups, not at
  traversing arbitrary-depth relationship chains across entities — this
  is not what GSIs are designed to solve.
- C is wrong: a star schema is optimized for fact/dimension analytical
  aggregation (BI-style queries), not for open-ended, variable-depth
  relationship traversal — expressing multi-hop connections in SQL
  requires increasingly complex and costly self-joins.
- D is wrong: the scenario describes relationship/connection analysis
  between entities, not searching text content — full-text search
  capability is unrelated to this specific problem.

---

**Q40.** A global retailer's ingestion pipeline combines: (1) Kinesis
Data Streams for real-time point-of-sale events needing sub-second
fraud scoring, (2) a nightly DMS full-load-plus-CDC migration of a
legacy on-prem inventory database into Aurora, and (3) AppFlow pulling
daily marketing campaign data from a SaaS platform. A new requirement
states that if any of the three fails, an on-call engineer must be
paged within 1 minute, and the team wants one consistent, auditable
place to see the status of all three pipelines together.

A. Configure each service to send its own separate, differently
   formatted alert with no central visibility
B. Route each pipeline's failure/state-change events through
   EventBridge rules into a single Step Functions workflow (or a
   unified monitoring dashboard) with a shared SNS topic for paging,
   giving one consistent, auditable status view across all three
C. Manually check each service's console every hour
D. Since the three pipelines use different AWS services, they cannot
   be monitored or alerted on consistently and must remain fully
   separate

**Answer: B.** EventBridge captures state-change events natively from
Kinesis-consuming Lambda functions, DMS tasks (via CloudWatch alarms/
EventBridge), and AppFlow (which emits flow execution events) — routing
all three into one place (a Step Functions workflow for orchestrated
handling, and/or a shared SNS topic for paging) gives the single,
consistent, auditable cross-pipeline view the requirement asks for,
with the 1-minute paging requirement met by EventBridge's near-
immediate event delivery.
- A is wrong: separate, inconsistent alerts per service directly
  contradicts the stated requirement for "one consistent, auditable
  place" to see status across all three.
- C is wrong: hourly manual checks cannot meet a 1-minute paging
  requirement — it's roughly 60× too slow even in the best case.
- D is wrong: this is factually incorrect — EventBridge is specifically
  designed to unify events across heterogeneous AWS services into a
  single routing and monitoring layer, which is exactly the mechanism
  needed here.

---
