# EXAM-TRAPS.md — 60 traps AWS reuses

Each trap follows the same shape:
**THE SETUP** (how the question is worded) →
**THE TEMPTING WRONG ANSWER** →
**THE RIGHT ANSWER** →
**WHY** (the underlying principle).

---

## SECTION A — Streaming & ingestion traps (1–14)

### TRAP 1 — "Near real-time" vs "real-time"
**Setup:** "...must be available for analysis in near real-time, with
the least operational overhead."
**Tempting wrong:** Kinesis Data Streams + Lambda consumer + S3 writer.
**Right:** Amazon Data Firehose → S3.
**Why:** "Near real-time" is AWS's explicit licence for a ~60-second
buffer. Building a Streams + Lambda pipeline is *more* operational
overhead for a requirement Firehose already satisfies. When both
phrases appear together, Firehose wins.

### TRAP 2 — Firehose cannot replay
**Setup:** "...the team must be able to reprocess the last 7 days of
events if a bug is found in the transformation logic."
**Tempting wrong:** Firehose (because the question also says "minimal
overhead").
**Right:** Kinesis Data Streams with extended retention.
**Why:** Firehose has **no retention and no replay**. Any mention of
reprocessing, replaying, or recovering from a downstream bug eliminates
Firehose regardless of other constraints.

### TRAP 3 — Multiple consumers
**Setup:** "Three separate teams need to consume the same event stream
independently."
**Tempting wrong:** Firehose with three destinations.
**Right:** Kinesis Data Streams (with enhanced fan-out if each needs
full throughput).
**Why:** A Firehose delivery stream has **exactly one destination**.
Multiple independent consumers is a Data Streams (or MSK) feature.

### TRAP 4 — The shard math
**Setup:** "8,000 records per second, average record size 3 KB."
**Tempting wrong:** 8 shards (8,000 ÷ 1,000).
**Right:** 24 shards (8,000 × 3 KB = 24 MB/s ÷ 1 MB/s).
**Why:** A shard is limited by **1 MB/s OR 1,000 records/s, whichever
binds first**. AWS deliberately picks numbers where the record-count
math gives a smaller, more tempting answer. Always compute both.

### TRAP 5 — Enhanced fan-out
**Setup:** "Five consuming applications each need the full 2 MB/s per
shard."
**Tempting wrong:** Add more shards.
**Right:** Enable **enhanced fan-out**.
**Why:** Standard consumers *share* 2 MB/s per shard. EFO gives each
consumer its own dedicated 2 MB/s pipe and drops latency to ~70 ms.
Adding shards multiplies cost without solving the sharing problem.

### TRAP 6 — `IteratorAge` is a consumer problem
**Setup:** "`GetRecords.IteratorAgeMilliseconds` is steadily increasing."
**Tempting wrong:** The producers are sending too fast; add shards.
**Right:** Consumers can't keep up — scale consumers, use EFO,
increase Lambda parallelization factor, or optimize processing.
**Why:** `IteratorAge` measures how far **behind** the consumer is. A
producer-side throttle shows up as `WriteProvisionedThroughputExceeded`
instead. Two different metrics, two different fixes.

### TRAP 7 — Ordering
**Setup:** "Events for the same device must be processed in order."
**Tempting wrong:** SQS Standard (high throughput).
**Right:** Kinesis Data Streams with `deviceId` as the partition key
(or SQS FIFO with a message group ID).
**Right-adjacent trap:** SQS FIFO caps throughput far below Standard.
**Why:** Ordering in Kinesis is guaranteed **per shard**, and the
partition key determines the shard. Same key → same shard → order held.

### TRAP 8 — MSK when there's no Kafka
**Setup:** A greenfield streaming pipeline with no legacy systems.
**Tempting wrong:** MSK (it sounds enterprise-grade).
**Right:** Kinesis Data Streams or Firehose.
**Why:** MSK is the answer **only** when the scenario mentions existing
Kafka, Kafka APIs, Kafka Connect, or an open-source requirement. With
no Kafka investment, MSK is pure added operational burden.

### TRAP 9 — DMS is missing from your mental model
**Setup:** "Continuously replicate an on-premises Oracle database to S3
with minimal downtime."
**Tempting wrong:** Glue JDBC job on a schedule.
**Right:** DMS with full load + CDC.
**Why:** A scheduled JDBC extract cannot give minimal downtime or
continuous replication. DMS is purpose-built for exactly this and is
the only first-class answer for ongoing database replication.

### TRAP 10 — DMS doesn't migrate schemas
**Setup:** "Migrate Oracle to Aurora PostgreSQL, including stored
procedures."
**Tempting wrong:** DMS alone.
**Right:** **SCT** (Schema Conversion Tool) for schema/procedures, then
DMS for the data.
**Why:** DMS migrates **data**. Schemas, indexes, views, stored
procedures, and functions are SCT's job.

### TRAP 11 — Zero-ETL beats a pipeline
**Setup:** "Aurora MySQL powers the app. Analysts need near real-time
reporting in Redshift with minimal operational overhead."
**Tempting wrong:** DMS CDC → S3 → Glue → Redshift COPY.
**Right:** **Zero-ETL integration** Aurora → Redshift.
**Why:** Zero-ETL removes the pipeline entirely. When the source is
Aurora MySQL/PostgreSQL, RDS MySQL, or DynamoDB and the target is
Redshift (or OpenSearch), zero-ETL is the minimal-overhead answer and
every pipeline-based option is a distractor.

### TRAP 12 — Zero-ETL when the source isn't supported
**Setup:** Source is on-prem SQL Server.
**Tempting wrong:** Zero-ETL (you just learned it).
**Right:** DMS.
**Why:** Zero-ETL supports a **specific list** of sources. Learn the
list, not just the concept — AWS tests the boundary.

### TRAP 13 — Firehose buffer tuning
**Setup:** "Files landing in S3 are too small and Athena queries are slow."
**Tempting wrong:** Add a Glue job to compact files.
**Right (first):** Increase the Firehose **buffer size/interval**.
**Why:** Both work, but fixing the source is simpler and cheaper than
adding a compaction job. AWS prefers the answer that prevents the
problem rather than cleaning up after it. (If the question says the
files *already exist*, then compaction is right.)

### TRAP 14 — SQS vs SNS vs EventBridge
**Setup:** "One event must trigger five different downstream systems,
each filtering on different attributes."
**Tempting wrong:** SNS to five SQS queues.
**Right:** **EventBridge** with content-based rules.
**Why:** SNS fans out to all subscribers with only basic filtering.
EventBridge routes on event *content* with rich rules. "Route based
on content" is the EventBridge trigger phrase.

---

## SECTION B — Transformation & compute traps (15–26)

### TRAP 15 — Lambda's 15-minute wall
**Setup:** "Process a 50 GB daily file."
**Tempting wrong:** Lambda (serverless, minimal overhead).
**Right:** Glue ETL or EMR Serverless.
**Why:** Lambda maxes at **15 minutes, 10 GB memory, 10 GB /tmp**. If
the workload could plausibly exceed any of those, Lambda is a
distractor no matter how "serverless" the constraint sounds.

### TRAP 16 — Job bookmarks direction
**Setup:** "A bug was found. Reprocess all historical data."
**Tempting wrong:** Enable job bookmarks.
**Right:** **Reset** the job bookmark (or disable it for this run).
**Why:** Bookmarks make Glue skip already-processed data. Enabling them
is the answer for *incremental*; resetting them is the answer for
*reprocess everything*. AWS words these almost identically.

### TRAP 17 — Glue OOM
**Setup:** "The Glue job fails with an out-of-memory error."
**Tempting wrong:** Increase the number of workers.
**Right:** Move to a larger worker type (G.1X → **G.2X**), or fix data
skew / repartition.
**Why:** More workers gives more *parallelism*, not more memory per
executor. OOM is a per-executor memory problem. If one partition is
huge (skew), even G.8X won't help — you must repartition or salt the key.

### TRAP 18 — Spot on the wrong nodes
**Setup:** "Reduce EMR costs as much as possible."
**Tempting wrong:** Use Spot Instances for all node types.
**Right:** Spot for **task nodes**, On-Demand for primary and core.
**Why:** Losing the primary node kills the cluster. Losing core nodes
loses HDFS data. Task nodes hold no data and are safely interruptible.

### TRAP 19 — EMR when the question says "no cluster management"
**Setup:** "Run existing Spark jobs without managing infrastructure."
**Tempting wrong:** EMR on EC2 with managed scaling.
**Right:** **EMR Serverless** (or Glue if it's catalog-driven ETL).
**Why:** "Managed scaling" still leaves you owning a cluster. EMR
Serverless removes the cluster concept entirely.

### TRAP 20 — Glue vs EMR when frameworks matter
**Setup:** "The team's existing jobs use Hive, Presto, and HBase."
**Tempting wrong:** Migrate to Glue (serverless!).
**Right:** EMR.
**Why:** Glue runs **Spark, Python shell, and Ray** — not Hive/Presto/
HBase. When the scenario names a framework Glue doesn't support, EMR is
the only option.

### TRAP 21 — Glue Streaming always bills
**Setup:** "Data arrives once daily. Minimize cost."
**Tempting wrong:** Glue Streaming job.
**Right:** Scheduled Glue batch job (or Glue **Flex** for extra savings).
**Why:** Glue Streaming runs continuously and bills continuously. For
batch-arriving data it's pure waste.

### TRAP 22 — DataBrew vs Glue Studio
**Setup:** "Business analysts with no coding experience need to clean data."
**Tempting wrong:** AWS Glue Studio (it's visual too).
**Right:** **Glue DataBrew**.
**Why:** Glue Studio is a visual job builder **for data engineers** —
it still produces Spark jobs and assumes ETL knowledge. DataBrew is the
no-code tool aimed at analysts. The words "business analysts" or "no
coding" point at DataBrew.

### TRAP 23 — Managed Flink vs Glue Streaming
**Setup:** "Compute a 5-minute rolling average per sensor."
**Tempting wrong:** Glue Streaming.
**Right:** **Managed Service for Apache Flink**.
**Why:** Windowed aggregations, event-time semantics, and exactly-once
processing are Flink's domain. Glue Streaming is micro-batch ETL —
good for enrich-and-land, weak for time-window computation.

### TRAP 24 — Retired service names
**Setup:** Options include "AWS Data Pipeline" or "AWS Glue Elastic Views."
**Right:** Eliminate immediately.
**Why:** AWS uses retired and discontinued services as distractors.
Also watch for old names: Kinesis Data Analytics (now **Managed Service
for Apache Flink**) and Kinesis Data Firehose (now **Amazon Data
Firehose**).

### TRAP 25 — "Write a custom application"
**Setup:** An option begins "Develop a custom application that..."
**Right:** Usually wrong.
**Why:** If a managed AWS service does the job, AWS's exam philosophy
never prefers custom code. The exception is when the question
explicitly rules out managed options or describes a genuinely unusual
requirement.

### TRAP 26 — Over-engineering
**Setup:** "Land IoT telemetry in S3 for later analysis."
**Tempting wrong:** IoT Core → Kinesis Data Streams → Managed Flink →
Lambda → S3.
**Right:** IoT Core → Amazon Data Firehose → S3.
**Why:** The longest, most sophisticated option is rarely correct on a
"least operational overhead" question. Count the moving parts; each one
is operational burden the question told you to avoid.

---

## SECTION C — Storage & query traps (27–40)

### TRAP 27 — Athena chosen because data is in S3
**Setup:** "Data is in S3. 500 analysts run dashboards continuously."
**Tempting wrong:** Athena (the data is in S3!).
**Right:** Redshift (or Redshift Serverless).
**Why:** **Data location does not decide the query engine — access
pattern does.** Athena has a concurrency quota and degrades under
sustained dashboard load. High concurrency + complex joins + sub-second
= Redshift.

### TRAP 28 — Redshift for occasional queries
**Setup:** "Analysts query the archive a few times per month."
**Tempting wrong:** Provision a Redshift cluster.
**Right:** Athena.
**Why:** A provisioned cluster bills 24/7 for a workload that runs
minutes per month. This is the mirror image of Trap 27 — same
principle, opposite direction.

### TRAP 29 — Spectrum without a cluster
**Setup:** "Query 5 years of Parquet in S3. No existing warehouse."
**Tempting wrong:** Redshift Spectrum.
**Right:** Athena.
**Why:** Spectrum **requires a Redshift cluster**. If the scenario
doesn't already have one, choosing Spectrum means paying for a cluster
just to query S3 — which is what Athena does for free.

### TRAP 30 — Crawlers vs partition projection
**Setup:** "The table has millions of date-based partitions. Crawler
runs are slow and expensive."
**Tempting wrong:** Run the crawler more frequently / on a schedule.
**Right:** **Athena partition projection**.
**Why:** Partition projection computes partition locations from a
configured pattern, eliminating catalog lookups and crawler runs
entirely. It's the answer whenever partitions follow a predictable
scheme (dates, integer ranges, enums).

### TRAP 31 — GZIP CSV is not splittable
**Setup:** "Athena queries over 10 GB gzipped CSV files are very slow."
**Tempting wrong:** Increase Athena's concurrency / add more capacity.
**Right:** Convert to **Parquet + Snappy** and **partition**.
**Why:** A gzipped CSV cannot be split, so a single worker reads the
whole file — no parallelism is possible regardless of capacity. This is
a *format* problem, not a *capacity* problem.

### TRAP 32 — The small-file problem
**Setup:** "Millions of 100 KB files in S3; queries are slow."
**Tempting wrong:** Add more partitions.
**Right:** **Compact** into 128 MB–1 GB files.
**Why:** More partitions makes it worse — you get more, smaller files.
Per-file open overhead dominates when files are tiny.

### TRAP 33 — Over-partitioning
**Setup:** "Partition the table by `customer_id` (2 million customers)."
**Tempting wrong:** Yes, more partitions = more pruning.
**Right:** Partition by date; use **bucketing** for high-cardinality keys.
**Why:** Partitioning on a high-cardinality column creates millions of
tiny partitions and directories — catalog bloat plus the small-file
problem. Partition on **low-cardinality columns you filter by**.

### TRAP 34 — Intelligent-Tiering vs lifecycle
**Setup:** "Objects are accessed frequently for 30 days, then rarely."
**Tempting wrong:** S3 Intelligent-Tiering.
**Right:** **Lifecycle policy** Standard → Standard-IA → Glacier.
**Why:** The pattern is **known and stated**. Intelligent-Tiering
charges a per-object monitoring fee to *discover* a pattern you already
know. Intelligent-Tiering is for **unknown or changing** patterns.

### TRAP 35 — Intelligent-Tiering with tiny objects
**Setup:** "Billions of small objects, unpredictable access."
**Tempting wrong:** Intelligent-Tiering (unknown pattern!).
**Right:** Compact the objects first, then Intelligent-Tiering or
lifecycle.
**Why:** The per-object monitoring fee scales with object *count*. With
billions of tiny objects it can exceed the storage savings.

### TRAP 36 — Deep Archive retrieval time
**Setup:** "Archive for compliance, but auditors may request data with
4 hours' notice."
**Tempting wrong:** Glacier Deep Archive (cheapest).
**Right:** Glacier Flexible Retrieval (standard = 3–5 h) or Glacier
Instant Retrieval.
**Why:** Deep Archive standard retrieval is **12 hours**. Any stated
retrieval SLA under 12 hours rules it out. Cheapest-to-store is not
cheapest-to-use.

### TRAP 37 — Minimum storage durations
**Setup:** "Move objects to Standard-IA after 7 days."
**Tempting wrong:** Sure, that saves money.
**Right:** Flag it — Standard-IA has a **30-day minimum billing
duration**; deleting or transitioning earlier incurs a charge.
**Why:** Min durations: IA 30 days, Glacier IR/Flexible 90 days, Deep
Archive 180 days. Transitioning too aggressively costs *more*.

### TRAP 38 — DynamoDB Scan for analytics
**Setup:** "Run analytics on DynamoDB data without impacting the app."
**Tempting wrong:** Scheduled Scan into S3.
**Right:** **DynamoDB export to S3**, then Athena.
**Why:** Scan consumes read capacity and will throttle the production
application. Export to S3 **consumes no RCUs** — that's its entire
reason for existing.

### TRAP 39 — LSI after the fact
**Setup:** "Add a local secondary index to an existing table."
**Tempting wrong:** Create the LSI.
**Right:** You can't — LSIs must be created **with the table**. Use a
**GSI**, or recreate the table.
**Why:** GSI = add anytime, own capacity, eventually consistent.
LSI = creation-time only, shares capacity, supports strong consistency,
10 GB per partition key limit.

### TRAP 40 — Hive tables and GDPR
**Setup:** "Delete all records for a specific customer to comply with
a deletion request."
**Tempting wrong:** Run a Glue job to rewrite the affected partitions.
**Right:** Use **Apache Iceberg** tables with row-level `DELETE`.
**Why:** Hive-style tables have no row-level delete — you must rewrite
whole partitions, which is slow, expensive, and error-prone. Iceberg
does this natively. Same reasoning for upserts (`MERGE`) and time travel.

---

## SECTION D — Redshift-specific traps (41–47)

### TRAP 41 — DISTKEY on a low-cardinality column
**Setup:** "The table is distributed on `country_code` and some nodes
are much busier than others."
**Tempting wrong:** Add more nodes.
**Right:** Change the distribution style — the low-cardinality DISTKEY
**is** the cause of the skew.
**Why:** KEY distribution sends equal keys to the same slice. Few
distinct values = few slices doing all the work. Use a high-cardinality
join key, EVEN, or AUTO.

### TRAP 42 — DISTSTYLE ALL on a big table
**Setup:** "Improve join performance on a 2 TB fact table."
**Tempting wrong:** `DISTSTYLE ALL`.
**Right:** `DISTSTYLE KEY` on the join column.
**Why:** ALL replicates the **entire table to every node**. That's
correct for small dimension tables and disastrous for large facts.

### TRAP 43 — Sort key vs distribution key
**Setup:** "Queries filtering `WHERE event_date BETWEEN ...` are slow."
**Tempting wrong:** Change the distribution key.
**Right:** Add/change the **sort key** on `event_date`.
**Why:** Sort keys drive zone-map pruning for range filters.
Distribution keys drive join co-location. Different problems.

### TRAP 44 — Interleaved sort keys by default
**Setup:** "Queries always filter on `customer_id` first."
**Tempting wrong:** Interleaved sort key.
**Right:** **Compound** sort key with `customer_id` leading.
**Why:** Interleaved gives equal weight to all sort columns — useful
only when filter patterns are unpredictable. It also carries expensive
maintenance (`VACUUM REINDEX`).

### TRAP 45 — Queries queuing at peak
**Setup:** "During business hours, queries wait in the queue."
**Tempting wrong:** Resize the cluster permanently.
**Right:** Enable **concurrency scaling** (and/or auto-WLM).
**Why:** Concurrency scaling adds transient capacity only during
spikes, with one free hour of credits per 24 hours per cluster.
Permanently resizing pays for peak capacity 24/7.

### TRAP 46 — COPY from one giant file
**Setup:** "Loading a 500 GB file into Redshift takes hours."
**Tempting wrong:** Use a bigger cluster.
**Right:** **Split into multiple files**, ideally a multiple of the
slice count, each 1 MB–1 GB compressed.
**Why:** COPY parallelizes across slices by file. One file = one slice
doing all the work; the rest of the cluster idles.

### TRAP 47 — Redshift for OLTP
**Setup:** "Thousands of small single-row inserts per second."
**Tempting wrong:** Redshift.
**Right:** Aurora/RDS or DynamoDB; batch into Redshift later.
**Why:** Redshift is columnar MPP built for bulk loads and analytical
scans. Row-by-row inserts are pathologically slow. Use COPY, streaming
ingestion, or zero-ETL instead.

---

## SECTION E — Security & governance traps (48–56)

### TRAP 48 — IAM for column-level security
**Setup:** "Analysts may see all columns except `ssn` and `salary`."
**Tempting wrong:** A carefully scoped IAM policy.
**Right:** **Lake Formation** column-level permissions.
**Why:** IAM operates on buckets, prefixes, and API actions. It has no
concept of a column. Sub-table granularity on cataloged lake data is
exclusively Lake Formation.

### TRAP 49 — The forgotten KMS key policy
**Setup:** "A Glue job gets `AccessDenied` on S3. The IAM role has
`s3:GetObject` and the bucket policy allows the role."
**Tempting wrong:** Add more S3 permissions.
**Right:** Grant the role `kms:Decrypt` in the **KMS key policy**.
**Why:** For SSE-KMS objects you need **both** S3 permissions and KMS
key access. This is the single most-tested troubleshooting scenario in
Domain 4. Check order: IAM → bucket policy → **KMS** → Lake Formation →
SCP → VPC endpoint policy.

### TRAP 50 — Explicit deny wins
**Setup:** "The identity policy allows it, but the SCP has a deny."
**Right:** Denied.
**Why:** An explicit deny **anywhere** in the evaluation chain wins,
full stop. No allow can override it.

### TRAP 51 — AWS-managed keys cross-account
**Setup:** "Share encrypted S3 data with a partner account."
**Tempting wrong:** SSE-KMS with the AWS-managed `aws/s3` key.
**Right:** SSE-KMS with a **customer-managed key** whose key policy
grants the partner account.
**Why:** AWS-managed keys have policies you cannot edit and cannot be
shared cross-account.

### TRAP 52 — SSE-S3 for compliance
**Setup:** "Regulators require auditable key usage and controlled rotation."
**Tempting wrong:** SSE-S3 (it's encryption, and it's free).
**Right:** SSE-KMS with a customer-managed key.
**Why:** SSE-S3 gives you no key policy, no rotation control, and no
CloudTrail record of key usage. Compliance language means CMK.

### TRAP 53 — CloudTrail management vs data events
**Setup:** "Determine which user downloaded a specific S3 object."
**Tempting wrong:** Check CloudTrail (it's already enabled).
**Right:** Enable CloudTrail **data events** for that bucket.
**Why:** Object-level `GetObject`/`PutObject` are **data events**,
which are off by default and billed separately. Management events only
cover bucket-level API calls like `CreateBucket`.

### TRAP 54 — Interface endpoint where a gateway works
**Setup:** "Private access to S3 from a VPC at no additional cost."
**Tempting wrong:** Interface endpoint (PrivateLink).
**Right:** **Gateway endpoint**.
**Why:** Gateway endpoints exist only for **S3 and DynamoDB** and are
**free**. Interface endpoints cost per hour plus per GB. "No additional
cost" is the tell.

### TRAP 55 — Secrets Manager when cost is the constraint
**Setup:** "Store 500 application configuration values as cheaply as
possible."
**Tempting wrong:** Secrets Manager.
**Right:** **SSM Parameter Store** (Standard tier, free).
**Why:** Secrets Manager charges ~$0.40 per secret per month. It earns
that only when you need **automatic rotation**, cross-account resource
policies, or >4 KB values.

### TRAP 56 — Macie vs Glue Data Quality
**Setup A:** "Identify which S3 buckets contain PII." → **Macie**.
**Setup B:** "Verify that no rows have null customer IDs." → **Glue
Data Quality**.
**Why:** Macie **discovers sensitive data**; Glue Data Quality
**validates business rules**. AWS pairs these as distractors.

---

## SECTION F — Orchestration & operations traps (57–60)

### TRAP 57 — MWAA as "least operational overhead"
**Setup:** "Orchestrate a pipeline with the least operational overhead."
**Tempting wrong:** MWAA (it's *managed* Airflow).
**Right:** Step Functions.
**Why:** MWAA runs an **always-on environment you size, pay for, patch,
and version-upgrade**. It's managed, not overhead-free. MWAA wins only
when the question mentions existing Airflow DAGs or complex Python
dependencies.

### TRAP 58 — Step Functions Standard vs Express
**Setup:** "Process 10 million short events per day through a workflow."
**Tempting wrong:** Standard.
**Right:** **Express**.
**Why:** Standard bills **per state transition** — at that volume the
cost is enormous. Express bills on requests + duration and is far
cheaper at high volume, capped at 5 minutes with at-least-once
semantics.

### TRAP 59 — Retries without idempotency
**Setup:** "The pipeline retries failed writes, and duplicate records
are appearing."
**Tempting wrong:** Reduce the retry count.
**Right:** Make the operation **idempotent** (deduplication key,
conditional write, or Iceberg `MERGE`).
**Why:** At-least-once delivery plus retries **guarantees** duplicates.
The fix is downstream idempotency, not fewer retries — fewer retries
just trades duplicates for data loss.

### TRAP 60 — Multi-response questions
**Setup:** "Select TWO answers."
**Tempting wrong:** Selecting three because three look right.
**Right:** Exactly two.
**Why:** Wrong **count** = wrong answer, with **no partial credit**.
Also note the common pattern: the correct pair is usually one *service
choice* plus one *configuration detail*, not two competing services.

---

## THE FIVE PHRASES THAT DECIDE MOST QUESTIONS

| Phrase | What AWS wants |
|---|---|
| "least / minimal operational overhead" | Serverless, fully managed, zero-ETL |
| "most cost-effective" / "lowest cost" | Spot, lifecycle, per-query pricing, Parameter Store |
| "near real-time" | Firehose is acceptable (~60 s) |
| "real-time" / "sub-second" | Kinesis Data Streams, Flink, DynamoDB |
| "existing" (Kafka/Airflow/Spark/Hadoop) | Migrate in place: MSK, MWAA, EMR |

**Underline these in every question before you read the options.**

---

## ELIMINATION HEURISTICS

Tiebreakers, not laws — but right far more often than a coin flip.

- Retired or renamed services → wrong
- Options requiring server management when the question says
  "operational overhead" → wrong
- Options that move data unnecessarily (S3 → EBS → process → S3) → wrong
- "Write a custom application/script" when a managed service exists → usually wrong
- Absolute claims ("guarantees zero latency," "ensures no data loss ever") → usually wrong
- Two options that are functionally identical → **both** wrong; the
  answer is one of the other two
- The longest, most complex option → rarely right on "least operational
  overhead," often right on "lowest cost at petabyte scale"

---

## THE TEN MOST-MISSED FACTS

1. Firehose has **no replay**.
2. Lambda stops at **15 minutes / 10 GB**.
3. Spot goes on **task nodes only**.
4. Gateway endpoints exist only for **S3 and DynamoDB**, and are free.
5. CloudTrail **data events** are off by default.
6. Standard-IA has a **30-day** minimum; Deep Archive **180 days**.
7. Glacier Deep Archive standard retrieval is **12 hours**.
8. LSIs can only be created **with the table**.
9. DynamoDB **export to S3 consumes no RCUs**; Scan does.
10. A shard is **1 MB/s OR 1,000 records/s** — compute both.
