# SERVICE-SELECTION-MATRIX.md ⭐

> The single highest-value file in this repo. If you read one thing on
> the morning of the exam, read this.

## CONTENTS

0. [How DEA-C01 questions are actually built](#part-0)
1. [The keyword reflex table (~110 triggers)](#part-1)
2. [Streaming ingestion matrix](#part-2)
3. [Database migration & CDC matrix](#part-3)
4. [Processing / transformation matrix](#part-4)
5. [Query engine matrix](#part-5)
6. [Data store matrix](#part-6)
7. [S3 vs EFS vs FSx](#part-7)
8. [S3 storage class matrix](#part-8)
9. [Orchestration matrix](#part-9)
10. [Table format matrix — Iceberg vs Hive vs Hudi vs Delta](#part-10)
11. [File format & compression matrix](#part-11)
12. [Catalog matrix](#part-12)
13. [Governance & access matrix](#part-13)
14. [Encryption matrix](#part-14)
15. [Secrets & config matrix](#part-15)
16. [Monitoring matrix](#part-16)
17. [Glue batch vs Glue streaming](#part-17)
18. [Cost-driver cheat table](#part-18)
19. [The 25 head-to-heads](#part-19)
20. [90-second pre-exam scan](#part-20)

---

<a name="part-0"></a>
## PART 0 — How DEA-C01 questions are actually built

Every question is assembled from four parts. Learning to disassemble
them is worth more than any single service fact.

```
┌─────────────────────────────────────────────────────────────┐
│ 1. SCENARIO      "A retail company ingests clickstream data │
│                   from 50 million users..."                 │
│                   → Tells you the STAGE and the SCALE       │
├─────────────────────────────────────────────────────────────┤
│ 2. REQUIREMENT   "...must be available for analysis within  │
│                   one minute..."                            │
│                   → Tells you the LATENCY BUDGET            │
├─────────────────────────────────────────────────────────────┤
│ 3. CONSTRAINT    "...with the least operational overhead."  │
│                   → THE DECIDER. Almost always the last     │
│                     sentence of the stem.                   │
├─────────────────────────────────────────────────────────────┤
│ 4. OPTIONS       2 obviously wrong, 2 plausible.            │
│                   The constraint separates the final 2.     │
└─────────────────────────────────────────────────────────────┘
```

### The eight constraint families

| Constraint phrase | AWS wants you to PICK | AWS wants you to REJECT |
|---|---|---|
| "least/minimal operational overhead" | Serverless, fully managed, zero-ETL | Clusters, brokers, EC2, custom code |
| "most cost-effective" / "lowest cost" | Spot, lifecycle policies, per-query pricing, Parameter Store | Always-on clusters, over-provisioning |
| "real-time" / "sub-second" | Kinesis Data Streams, Managed Flink, DynamoDB | Firehose, batch Glue, Athena |
| "near real-time" (seconds–minutes) | **Amazon Data Firehose**, zero-ETL, Glue streaming | Kinesis + custom consumers (over-engineered) |
| "existing X" (Kafka/Airflow/Spark/Hadoop) | MSK, MWAA, EMR — migrate in place | Rewriting into Kinesis/Step Functions/Glue |
| "highly available" / "fault tolerant" | Multi-AZ, on-demand modes, managed services | Single-AZ, single-node |
| "must not lose data" | Retention, replay, DLQs, at-least-once + idempotency | Firehose alone, fire-and-forget |
| "compliance" / "audit" / "PII" | CloudTrail data events, Macie, Lake Formation, KMS CMK | SSE-S3, IAM-only |

⚠️ **When two constraints appear together, "least operational overhead"
outranks "lowest cost."** AWS's house style prefers managed services.
The exception: when the question says *only* "most cost-effective" and
describes petabyte scale — then EMR + Spot wins.

---

<a name="part-1"></a>
## PART 1 — The keyword reflex table

Read the trigger, produce the service in under two seconds.

### 1A. Ingestion triggers

| Trigger phrase | Answer | Why |
|---|---|---|
| "least operational overhead" + land stream in S3 | **Amazon Data Firehose** | Fully managed, no shards, no consumer code |
| "near real-time" + delivery | **Amazon Data Firehose** | ~60 s buffer is exactly what "near" licenses |
| "real-time", "sub-second" | **Kinesis Data Streams** | ~200 ms; ~70 ms with enhanced fan-out |
| "multiple independent consumers" | **Kinesis Data Streams** | Firehose has exactly one destination |
| "replay", "reprocess historical events" | **Kinesis Data Streams** | Retention 24 h–365 d; Firehose has none |
| "ordering guaranteed per user/device" | **Kinesis Data Streams** (partition key) or MSK | Order is per shard/partition |
| "existing Kafka", "Kafka APIs" | **Amazon MSK** | Only Kafka-wire-compatible service |
| "migrating a self-managed Kafka cluster" | **Amazon MSK** | Lift-and-shift |
| "Kafka Connect connectors" | **MSK Connect** | |
| "continuously replicate an on-prem database" | **AWS DMS** (CDC) | Purpose-built |
| "one-time database migration" | **AWS DMS** (full load) | |
| "heterogeneous migration" (Oracle → PostgreSQL) | **DMS + SCT** | Schema Conversion Tool |
| "Aurora/RDS/DynamoDB → Redshift, no pipeline" | **zero-ETL integration** | The modern answer |
| "DynamoDB → OpenSearch, keep in sync" | **zero-ETL integration** | |
| "SaaS app (Salesforce, Zendesk, Slack) → AWS" | **AppFlow** | |
| "petabytes, limited/no bandwidth" | **Snowball / Snow Family** | |
| "ongoing file sync from on-prem NAS" | **DataSync** | |
| "partners upload via SFTP/FTPS" | **Transfer Family** | |
| "IoT devices publish telemetry" | **IoT Core** → Kinesis/Firehose | |
| "decouple, one consumer, guaranteed order" | **SQS FIFO** | |
| "decouple, one consumer, max throughput" | **SQS Standard** | |
| "fan out one event to many subscribers" | **SNS** or **EventBridge** | SNS = simple pub/sub; EventBridge = filtering/routing |
| "route events based on content" | **EventBridge** | Rules with content filtering |

### 1B. Transformation triggers

| Trigger phrase | Answer | Why |
|---|---|---|
| "serverless ETL integrated with the Data Catalog" | **AWS Glue ETL** | |
| "process only new data since last run" | **Glue job bookmarks** | |
| "reprocess ALL historical data" | **Reset the job bookmark** | Not "enable bookmarks" |
| "business analysts, no coding, visual prep" | **Glue DataBrew** | |
| "existing Spark/Hive/Presto/HBase scripts" | **Amazon EMR** | Only option exposing the cluster |
| "lowest cost at petabyte scale" | **EMR + Spot on task nodes** | |
| "Spark without managing clusters" | **EMR Serverless** or Glue | Glue if ETL-shaped and catalog-integrated |
| "Kubernetes, already run EKS" | **EMR on EKS** | |
| "under 15 minutes, event-driven, lightweight" | **AWS Lambda** | |
| "tumbling/sliding window aggregation" | **Managed Service for Apache Flink** | |
| "anomaly detection on a stream" | **Managed Flink** | |
| "exactly-once stream processing" | **Managed Flink** (checkpointing) | |
| "streaming ETL into the data lake" | **Glue Streaming** | |
| "convert CSV/JSON to Parquet on arrival" | **Firehose format conversion** | Inline with delivery |
| "partition data as it lands by customer/date" | **Firehose dynamic partitioning** | |
| "non-urgent job, cheapest possible" | **Glue Flex execution class** | Spare capacity |

### 1C. Storage & query triggers

| Trigger phrase | Answer | Why |
|---|---|---|
| "ad-hoc SQL, pay per query, occasional" | **Athena** | |
| "data already in S3, no infrastructure" | **Athena** | |
| "hundreds of BI users, dashboards, complex joins" | **Amazon Redshift** | Athena degrades under concurrency |
| "sub-second query response for BI" | **Redshift** | |
| "unpredictable/intermittent warehouse usage" | **Redshift Serverless** | No idle cost |
| "join warehouse tables with archive in S3" | **Redshift Spectrum** | Only if Redshift already exists |
| "share data with another team/account, no copy" | **Redshift data sharing** | |
| "sub-millisecond key-value at massive scale" | **DynamoDB** | |
| "microsecond reads, caching layer" | **DAX** | |
| "full-text search, log analytics, Kibana" | **OpenSearch Service** | |
| "time-series sensor data at scale" | **Timestream** | |
| "graph relationships, fraud rings" | **Neptune** | |
| "MongoDB-compatible" | **DocumentDB** | |
| "Cassandra-compatible" | **Keyspaces** | |
| "upserts / MERGE / row-level deletes on S3" | **Apache Iceberg** | |
| "time travel, query data as of last Tuesday" | **Apache Iceberg** | |
| "GDPR right-to-be-forgotten on a data lake" | **Iceberg row-level delete** | |
| "schema evolution without rewriting data" | **Iceberg** (or Avro at ingest) | |
| "millions of partitions, avoid crawler cost" | **Athena partition projection** | |
| "limit how much data analysts can scan" | **Athena workgroups** + data usage controls | |
| "query RDS/DynamoDB from Athena" | **Athena Federated Query** | |
| "unknown/changing access pattern" | **S3 Intelligent-Tiering** | |
| "known pattern: hot 30 days then cold" | **S3 Lifecycle policy** | Cheaper, no monitoring fee |
| "archive 7 years, 12-hour retrieval OK" | **Glacier Deep Archive** | |
| "archive but need millisecond retrieval" | **Glacier Instant Retrieval** | |
| "WORM, regulatory, cannot be deleted" | **S3 Object Lock (compliance mode)** | |
| "single-digit ms object access, very high request rate" | **S3 Express One Zone** | |

### 1D. Orchestration triggers

| Trigger phrase | Answer | Why |
|---|---|---|
| "serverless workflow with branching and retries" | **Step Functions** | |
| "millions of short executions per second" | **Step Functions Express** | |
| "long-running workflow, up to a year" | **Step Functions Standard** | |
| "process 10,000 S3 objects in parallel" | **Step Functions Distributed Map** | |
| "existing Airflow DAGs", "team knows Airflow" | **MWAA** | |
| "complex Python dependencies in the orchestrator" | **MWAA** | |
| "chain Glue jobs and crawlers only" | **Glue Workflows** | Free |
| "run daily at 02:00 UTC, cheapest" | **EventBridge Scheduler** | |
| "trigger when an object lands in S3" | **S3 Event Notification** → Lambda/SQS/EventBridge | |

### 1E. Security & governance triggers

| Trigger phrase | Answer | Why |
|---|---|---|
| "analysts see all columns except SSN/salary" | **Lake Formation column-level** | IAM cannot do this |
| "each region's team sees only their rows" | **Lake Formation row-level filter** | |
| "tag-based access at scale across many tables" | **Lake Formation LF-Tags (TBAC)** | |
| "share catalog data cross-account" | **Lake Formation + AWS RAM** | |
| "find PII in S3 buckets" | **Amazon Macie** | |
| "auto-rotate database credentials" | **Secrets Manager** | |
| "store config values, cheapest" | **SSM Parameter Store** | |
| "customer-controlled key rotation and audit" | **KMS customer-managed key** | |
| "reduce KMS API costs on S3" | **S3 Bucket Keys** | Up to 99% fewer KMS calls |
| "private S3 access from VPC, no NAT, no cost" | **Gateway VPC endpoint** | Free; S3 + DynamoDB only |
| "private access to Kinesis/Glue/Redshift" | **Interface endpoint (PrivateLink)** | Hourly + data charges |
| "who read this object and when" | **CloudTrail data events** | Management events don't cover reads |
| "who changed this Glue job" | **CloudTrail management events** | |
| "detect non-compliant configuration" | **AWS Config** | |
| "business glossary, publish/subscribe datasets" | **Amazon DataZone / SageMaker Catalog** | |
| "temporary cross-account access" | **IAM role + sts:AssumeRole** | |

### 1F. Operations & quality triggers

| Trigger phrase | Answer | Why |
|---|---|---|
| "consumers falling behind the stream" | **`IteratorAge`** rising | |
| "validate completeness, uniqueness, freshness" | **Glue Data Quality (DQDL)** | |
| "profile a dataset, find anomalies, no code" | **Glue DataBrew profiling** | |
| "trace a request across services" | **AWS X-Ray** | |
| "query application logs with SQL-like syntax" | **CloudWatch Logs Insights** | |
| "alert when a Glue job fails" | **EventBridge rule → SNS** | Glue emits state-change events |
| "dashboards for business users, in-memory" | **QuickSight + SPICE** | |
| "each manager sees only their team's rows" | **QuickSight row-level security** | |
| "handle poison messages" | **Dead-letter queue (DLQ)** | |
| "retry safely without duplicates" | **Idempotency** (dedup key / conditional write) | |

---

<a name="part-2"></a>
## PART 2 — Streaming ingestion matrix

**The #1 most-tested comparison on DEA-C01.** Expect 4–7 questions.

| Attribute | **Kinesis Data Streams** | **Amazon Data Firehose** | **Amazon MSK** | **Managed Flink** |
|---|---|---|---|---|
| **Purpose** | Durable, replayable real-time stream | Deliver a stream to a destination | Managed Apache Kafka | Stream *processing* engine |
| **Latency** | ~200 ms; ~70 ms with EFO | **Buffered — treat as ~60 s** | ~10 ms | Sub-second processing |
| **Cost model** | Shard-hours + PUT payload units (25 KB), or on-demand GB | **Per GB ingested** | Broker-hours + storage; Serverless = cluster + partition-hours | KPU-hours (1 KPU = 1 vCPU + 4 GB) |
| **Serverless** | On-demand mode ≈ yes | ✅ Fully | Serverless mode available | ✅ |
| **Streaming** | ✅ Core | ✅ Delivery only | ✅ Core | ✅ Core |
| **Batch** | ❌ | ❌ | ❌ | ❌ |
| **Data volume** | 1 MB/s per shard in; on-demand to 200 MB/s+ | Auto-scales | Scales with brokers/partitions | Scales with KPUs |
| **Scaling** | Shard split/merge, or on-demand auto | Fully automatic | Add brokers/partitions | Auto-scale KPUs |
| **Retention / replay** | ✅ 24 h default, up to **365 days** | ❌ **None. No replay. Ever.** | ✅ Configurable + tiered storage | Depends on source |
| **Consumers** | Many (2 MB/s shared, or EFO 2 MB/s each) | **Exactly one destination** | Many consumer groups | N/A |
| **Transformation** | In consumer code | Lambda + Parquet/ORC conversion + dynamic partitioning | Consumers or MSK Connect | Rich: SQL, Java, Python, Scala |
| **Ordering** | Per shard (partition key) | Not guaranteed | Per partition | Event-time processing |
| **Delivery semantics** | At-least-once | At-least-once | Configurable | **Exactly-once** |
| **Monitoring** | `IteratorAge`, `WriteProvisionedThroughputExceeded` | `DeliveryToS3.Success`, `ThrottledRecords` | Consumer lag, `UnderReplicatedPartitions` | KPU util, `fullRestarts` |
| **Security** | IAM, KMS, VPC endpoint | IAM, KMS, VPC endpoint | IAM / SASL-SCRAM / mTLS, in-VPC | IAM, KMS, VPC |
| **Ops burden** | Medium (shard management) | **Lowest** | **Highest** | Low |
| **Best use case** | Multiple consumers, replay, strict ordering | Land raw events in S3/Redshift/OpenSearch | Kafka migration, Kafka ecosystem | Windowed aggregation, CEP |
| **When NOT to use** | You just need data in S3 | You need replay or sub-second | No Kafka investment | Simple pass-through |
| **Exam favorite** | "replay", "multiple consumers", "ordering" | "least operational overhead", "near real-time" | "existing Kafka" | "tumbling window", "exactly-once" |

### The shard math you must be able to do

```
PER SHARD:
  Ingest:  1 MB/sec   OR   1,000 records/sec   (whichever hits first)
  Egress:  2 MB/sec   shared across standard consumers
           2 MB/sec   PER CONSUMER with Enhanced Fan-Out

WORKED EXAMPLE
  "5,000 records/sec, average record 2 KB. How many shards?"

  By record count:  5,000 / 1,000          =  5 shards
  By throughput:    5,000 x 2 KB = 10 MB/s
                    10 MB/s / 1 MB/s       = 10 shards
  ANSWER: 10 shards   (always take the LARGER)

  The trap answer is 5. AWS picks numbers where the record-count
  math gives a smaller, tempting number.

SECOND EXAMPLE
  "20 MB/s ingest, 4 consuming applications, each needs full throughput."

  Ingest needs:  20 shards
  Standard egress: 20 shards x 2 MB/s = 40 MB/s shared across 4 apps
                   = 10 MB/s each. NOT ENOUGH.
  ANSWER: 20 shards + ENHANCED FAN-OUT (2 MB/s per consumer per shard)
```

**Other hard numbers:** max record size 1 MB. On-demand mode scales to
200 MB/s write and doubles capacity within 15 minutes of a spike.

### One sentence each

- **Firehose** — "Put this in S3 and never make me think about it again."
- **Data Streams** — "Multiple teams need this, and I may need to replay it."
- **MSK** — "We already run Kafka and we're not rewriting producers."
- **Managed Flink** — "I need to compute something *over time windows* on the stream itself."

---

<a name="part-3"></a>
## PART 3 — Database migration & CDC matrix

Expect 3–5 questions. This was the biggest gap in your original 50 tips.

| Attribute | **AWS DMS** | **Zero-ETL** | **Glue + JDBC** | **Custom CDC** |
|---|---|---|---|---|
| **Purpose** | Migrate + continuously replicate | Auto-sync operational DB → analytics | Scheduled batch extract | DIY change capture |
| **Latency** | Seconds (CDC lag) | Seconds to ~15 min | Minutes to hours | Seconds |
| **Cost** | Replication instance-hours, or Serverless DCUs | **No pipeline cost** | DPU-hours | Shards + compute |
| **Serverless** | DMS Serverless available | ✅ Fully | ✅ | Partially |
| **Streaming** | ✅ CDC mode | ✅ | ❌ | ✅ |
| **Batch** | ✅ Full load | Auto initial seed | ✅ | ❌ |
| **Sources** | Oracle, SQL Server, MySQL, PostgreSQL, MongoDB, SAP, DB2, S3 | Aurora MySQL/PostgreSQL, RDS MySQL, DynamoDB | Any JDBC | Any |
| **Targets** | S3, Redshift, Aurora/RDS, DynamoDB, Kinesis, MSK, OpenSearch, Neptune | Redshift, OpenSearch | Anything | Anything |
| **Heterogeneous** | ✅ with SCT | ❌ | ✅ | ✅ |
| **Ops burden** | Medium | **Lowest** | Medium | Highest |
| **Best use case** | On-prem → AWS; hybrid replication | Aurora/DynamoDB → Redshift analytics | Nightly JDBC extract | Almost never correct |
| **When NOT to use** | Source is Aurora + target Redshift (use zero-ETL) | Source not on the supported list | Sub-minute freshness needed | Any question where managed exists |
| **Exam favorite** | "continuously replicate", "minimal downtime migration" | "near real-time analytics without building a pipeline" | "nightly batch load" | distractor |

### DMS full load vs CDC

```
FULL LOAD ONLY     → one-time migration, source can be quiesced
FULL LOAD + CDC    → migration with MINIMAL DOWNTIME
                     (default answer for "minimal downtime")
CDC ONLY           → target already seeded; keep it current
```

**DMS gotchas AWS tests:**
- CDC requires **supplemental logging / binlog** enabled on the source.
- **LOB handling**: limited LOB mode is fast but truncates; full LOB mode is complete but slow.
- DMS does **not** migrate schemas, indexes, stored procedures, or functions — that's **SCT**.
- **DMS validation task** = "how do I verify the migration was complete and accurate?"
- DMS can target **Kinesis or MSK** — that's how you turn a database into a stream.

### Zero-ETL

```
   Aurora MySQL ─────┐
   Aurora PostgreSQL ─┼──── zero-ETL ────▶ Amazon Redshift
   RDS for MySQL ────┘                      (seconds of lag; no Glue,
                                             no DMS, no code, no infra)

   DynamoDB ──────────── zero-ETL ───┬──▶ Amazon Redshift
                                     └──▶ Amazon OpenSearch
```

If a question pairs **"operational database"** + **"near real-time
analytics"** + **"minimal operational overhead"** and the source is on
that list, zero-ETL is the answer; DMS and Glue are the distractors.

---

<a name="part-4"></a>
## PART 4 — Processing / transformation matrix

| Attribute | **Glue ETL** | **EMR (EC2)** | **EMR Serverless** | **Lambda** | **Managed Flink** |
|---|---|---|---|---|---|
| **Purpose** | Serverless Spark ETL, catalog-native | Full big-data cluster | Spark/Hive without cluster ops | Small event-driven tasks | Continuous stream processing |
| **Time to first task** | ~1 min | 5–10 min spin-up | Seconds | Milliseconds | Always running |
| **Cost model** | DPU-hour, per-second, 1-min min | Instance-hours (**Spot ≈ up to 90% off**) | vCPU-sec + GB-sec | Requests + GB-sec | KPU-hour |
| **Cheapest at PB scale** | ❌ | ✅ **with Spot task nodes** | Middle | ❌ | ❌ |
| **Serverless** | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Streaming** | ✅ Glue Streaming | ✅ Spark Structured Streaming | ✅ | ✅ (Kinesis/DDB triggers) | ✅ Core |
| **Batch** | ✅ | ✅ | ✅ | ⚠️ **15-min ceiling** | ❌ |
| **Max runtime** | Unlimited | Unlimited | Unlimited | **15 minutes** | Continuous |
| **Max memory** | G.8X = 128 GB/worker | Instance-dependent | Configurable | **10,240 MB** | Per KPU |
| **Frameworks** | Spark, Python shell, Ray | **Spark, Hive, Presto/Trino, HBase, Flink, Hudi** | Spark, Hive | Your code | Flink |
| **Catalog integration** | ✅ Native | ✅ Configurable | ✅ | Manual | via connectors |
| **Incremental processing** | ✅ **Job bookmarks** | Manual | Manual | Manual | Checkpoints |
| **Scaling** | Auto-scaling workers | Managed scaling, instance fleets | Automatic | Concurrency (1,000 default) | KPU auto-scale |
| **Monitoring** | Glue metrics, Spark UI | Ganglia/YARN + CloudWatch | CloudWatch | Duration, throttles, errors | KPU util, `fullRestarts` |
| **Security** | IAM, KMS, VPC connections, LF | IAM, EMRFS auth, Kerberos, LF | IAM, KMS, VPC | IAM, KMS, VPC | IAM, KMS, VPC |
| **Best use case** | Catalog-driven ETL | Existing Hadoop; extreme cost optimization | Spark without cluster babysitting | Light transforms, triggers | Windowed aggregation, real-time metrics |
| **When NOT to use** | Non-Spark frameworks | You want zero ops | You need Presto/HBase | >15 min or >10 GB | Batch workloads |
| **Exam favorite** | "serverless ETL + Data Catalog" | "existing Spark + lowest cost" | "Spark without managing infrastructure" | "under 15 minutes" | "tumbling window" |

### Glue worker types — memorize

| Worker | DPU | vCPU | Memory | Disk | Use for |
|---|---|---|---|---|---|
| **G.1X** | 1 | 4 | 16 GB | 64 GB | Default; most ETL |
| **G.2X** | 2 | 8 | 32 GB | 128 GB | **First fix for OOM** |
| **G.4X** | 4 | 16 | 64 GB | 256 GB | Memory-intensive joins |
| **G.8X** | 8 | 32 | 128 GB | 512 GB | Very large shuffles |
| **G.025X** | 0.25 | 2 | 4 GB | 84 GB | **Streaming, low volume only** |

**Glue Flex execution class** = spare capacity, much cheaper, variable
start time. The answer for *"non-urgent nightly jobs, lowest cost."*
Never the answer for SLA-bound jobs.

**DynamicFrame vs DataFrame:**

| | DynamicFrame | DataFrame |
|---|---|---|
| Schema | Inferred per record, self-describing | Fixed, must be known |
| Handles messy/inconsistent data | ✅ `resolveChoice` | ❌ Fails |
| Performance | Slightly slower | Faster |
| Use when | Semi-structured, schema drift | Clean, known schema |

### EMR node types — the Spot trap

```
┌──────────────────────────────────────────────┐
│  PRIMARY NODE  — cluster coordinator         │
│  ❌ NEVER Spot. Losing it kills the cluster. │
├──────────────────────────────────────────────┤
│  CORE NODES    — run tasks AND store HDFS    │
│  ⚠️  Spot is risky — losing them loses data. │
├──────────────────────────────────────────────┤
│  TASK NODES    — run tasks only, no HDFS     │
│  ✅ SPOT GOES HERE. This is the exam answer. │
└──────────────────────────────────────────────┘
```

Any option saying "use Spot for all node types" is wrong.

**Instance fleets vs instance groups:** fleets let you specify multiple
instance types and let EMR pick based on capacity/price — the answer
for "maximize Spot availability and minimize interruption."

---

<a name="part-5"></a>
## PART 5 — Query engine matrix

| Attribute | **Athena** | **Redshift (provisioned)** | **Redshift Serverless** | **Redshift Spectrum** | **EMR Trino/Presto** |
|---|---|---|---|---|---|
| **Purpose** | Ad-hoc SQL on S3 | MPP data warehouse | Warehouse, no capacity planning | Query S3 from Redshift | SQL on your own cluster |
| **Latency** | Seconds–minutes | **Sub-second–seconds** | Sub-second–seconds | Seconds | Seconds |
| **Concurrency** | Quota-limited (~20–25 DML) | High + **concurrency scaling** | Auto-scales RPUs | Inherits cluster | Cluster-dependent |
| **Cost model** | **~$5 per TB scanned** (10 MB min/query) | Node-hours (RIs available) | **RPU-hours**, scales to zero | ~$5 per TB scanned | Instance-hours |
| **Idle cost** | **Zero** | High | **Zero** | Cluster cost | High |
| **Serverless** | ✅ | ❌ | ✅ | Needs a cluster | ❌ |
| **Data location** | S3 (+ federated) | Redshift managed storage | RMS | S3 | S3 / HDFS |
| **Data volume** | Petabytes | Petabytes (RA3 + RMS) | Petabytes | Petabytes | Petabytes |
| **ACID / updates** | ✅ via **Iceberg** | ✅ Native | ✅ Native | ❌ Read-only | ✅ via Iceberg/Hudi |
| **Scaling** | Automatic, invisible | Elastic/classic resize, concurrency scaling | Automatic RPU | With cluster | Managed scaling |
| **Monitoring** | Query history, `DataScannedInBytes` | `WLMQueueLength`, STL/SVL tables | RPU usage | Spectrum scan bytes | YARN + CloudWatch |
| **Security** | IAM, LF, KMS, workgroups | IAM/DB users, RLS, masking, KMS | Same | LF + IAM | IAM, Ranger, LF |
| **Best use case** | Exploration, occasional, unpredictable | Recurring BI, many users, complex joins | Spiky warehouse workloads | Join hot warehouse to cold S3 | Custom engine needs |
| **When NOT to use** | High-concurrency dashboards | Rare queries (idle cost) | Steady 24/7 (RIs cheaper) | No Redshift exists | You want serverless |
| **Exam favorite** | "pay only for what you query" | "hundreds of BI users, sub-second" | "unpredictable usage" | "join current data with S3 archive" | rare |

### Athena vs Redshift — the decision that trips everyone

```
                    How often will this be queried?
                                │
        ┌───────────────────────┴────────────────────────┐
    Occasionally,                              Constantly,
    unpredictably,                             many concurrent users,
    exploratory                                dashboards, complex joins
        │                                               │
     ATHENA                                    ┌────────┴─────────┐
                                          Steady load?      Spiky load?
                                               │                 │
                                     REDSHIFT PROVISIONED   REDSHIFT
                                     (+ Reserved Instances)  SERVERLESS
```

**The trap:** the question says the data is in S3, so people pick
Athena reflexively. If it *also* says "500 concurrent analysts" or
"dashboards refreshing every 30 seconds," Athena's concurrency quota
makes it wrong. **Data location does not decide this — access pattern does.**

### Athena vs Redshift Spectrum

| | Athena | Spectrum |
|---|---|---|
| Requires a Redshift cluster | ❌ | ✅ |
| Price per TB scanned | ~$5 | ~$5 |
| Can join to warehouse tables | ❌ | ✅ |
| Uses Glue Data Catalog | ✅ | ✅ (external schema) |

Pick Spectrum **only** when Redshift already exists AND the question
wants a join between warehouse tables and S3 data.

### Redshift internals you must know

**Distribution styles:**

| Style | Data placement | Use when |
|---|---|---|
| **AUTO** | Redshift decides (ALL→EVEN as it grows) | "least operational overhead" |
| **KEY** | Rows with same key land on same slice | Large fact table joined on that key |
| **EVEN** | Round-robin | No clear join key |
| **ALL** | Full copy on every node | **Small dimension tables** |

⚠️ `DISTKEY` on a **low-cardinality** column *causes* skew. That's the
failure scenario, not the fix.

**Sort keys:**

| Type | Use when |
|---|---|
| **Compound** (default) | Filters usually include the leading column; most cases |
| **Interleaved** | Queries filter on *different* columns unpredictably; expensive to maintain |
| **AUTO** | Let Redshift decide |

Sort keys accelerate **range filters** via zone maps. Distribution keys
accelerate **joins**. They are not interchangeable.

**COPY best practice:** split input into a number of files that is a
**multiple of the number of slices**, each 1 MB–1 GB compressed. One
giant file = one slice does all the work.

**Concurrency scaling:** adds transient clusters during spikes. You get
1 free hour of credit per 24 hours per cluster. The answer for "queries
queue during peak hours."

### Athena cost levers

| Lever | Typical saving | Notes |
|---|---|---|
| CSV/JSON → **Parquet** | 30–90% | Columnar |
| **Partition** on filter columns | 50–99% | Partition pruning |
| **Compress** (Snappy/ZSTD) | 30–60% | Fewer bytes scanned |
| **Bucketing** on join keys | 10–40% | |
| `SELECT col1, col2` not `SELECT *` | Large | Columnar only |
| **Workgroup data limits** | Prevents runaway | Governance |
| **Partition projection** | Removes catalog latency | Millions of partitions |
| **CTAS** to materialize | Large | Pay once, query cheap |

---

<a name="part-6"></a>
## PART 6 — Data store matrix

| Attribute | **DynamoDB** | **Aurora / RDS** | **Redshift** | **OpenSearch** | **S3** |
|---|---|---|---|---|---|
| **Model** | Key-value / document | Relational (OLTP) | Columnar MPP (OLAP) | Inverted index | Object store |
| **Latency** | **Single-digit ms** (µs w/ DAX) | Low ms | Sub-second–seconds | Milliseconds | ~100 ms first byte |
| **Cost model** | RCU/WCU or per-request | Instance-hours + storage | Node-hours or RPU | Instance-hours + storage | **$/GB-month + requests** |
| **Serverless** | ✅ On-demand | Aurora Serverless v2 | Redshift Serverless | Serverless option | ✅ |
| **Data volume** | Unlimited | ~128 TB (Aurora) | Petabytes | Terabytes | **Effectively unlimited** |
| **Query flexibility** | ⚠️ **Key access only** (+ GSI) | Full SQL | Full SQL, complex joins | Full-text, aggregations | None (needs Athena) |
| **Joins** | ❌ | ✅ | ✅✅ | ⚠️ Limited | via query engine |
| **Scaling** | Automatic partitions | Read replicas, auto-scaling | Resize, concurrency scaling | Add nodes / UltraWarm | Infinite |
| **HA** | Multi-AZ default; Global Tables | Multi-AZ, cross-region replicas | Multi-AZ (RA3), snapshots | Multi-AZ | 11 nines durability |
| **Monitoring** | Throttles, `ConsumedCapacity` | CPU, connections, replica lag | Queue length, disk | Cluster health, JVM | Request metrics |
| **Security** | IAM (item-level via conditions), KMS | IAM DB auth, KMS, TLS | IAM/DB users, RLS, KMS | Fine-grained access | Bucket policy, LF, KMS |
| **Best use case** | Session state, carts, IoT device state | App backend | BI, reporting | Log/search analytics | Data lake, archive |
| **When NOT to use** | Ad-hoc analytics | PB analytics | OLTP writes | System of record | Low-latency point lookups |
| **Exam favorite** | "millions of req/sec, sub-ms" | "transactional workload" | "BI dashboards" | "Kibana", "log search" | "durable, cheap, any format" |

### DynamoDB details AWS tests

| Concept | Fact |
|---|---|
| Item size limit | **400 KB** |
| RCU | 1 strongly consistent read of 4 KB/sec (2 eventually consistent) |
| WCU | 1 write of 1 KB/sec |
| **GSI** | Different partition key, own capacity, **eventually consistent only**, add anytime |
| **LSI** | Same partition key, different sort key, **must exist at table creation**, 10 GB per partition key |
| **Streams** | 24-hour retention, triggers Lambda, ordered per item |
| **TTL** | Auto-delete expired items, free, appears in Streams |
| **PITR** | 35-day continuous backup |
| **Export to S3** | **Consumes no RCUs** |
| **DAX** | Microsecond read cache, DynamoDB only |

⚠️ **Classic trap:** "Analyze DynamoDB data without affecting
application performance" → **export to S3, then Athena**. The wrong
answer is "run a Scan," which consumes capacity and throttles the app.

---

<a name="part-7"></a>
## PART 7 — S3 vs EFS vs FSx

| Attribute | **S3** | **EFS** | **FSx for Lustre** | **FSx for Windows** | **EBS** |
|---|---|---|---|---|---|
| **Type** | Object | NFS file (Linux) | Parallel file (HPC) | SMB file (Windows) | Block |
| **Access** | HTTPS API | POSIX mount | POSIX mount | SMB share | Attached volume |
| **Latency** | ~100 ms | Low ms | **Sub-ms** | Low ms | Sub-ms |
| **Throughput** | Very high (parallel) | Scales with size/mode | **Hundreds of GB/s** | High | Volume-dependent |
| **Multi-AZ** | ✅ (except One Zone/Express) | ✅ | ⚠️ Single-AZ (scratch) | ✅ | ❌ |
| **Multi-attach** | N/A | ✅ Thousands of clients | ✅ | ✅ | ⚠️ Limited |
| **Cost** | **Cheapest per GB** | ~3–8× S3 | High | High | Medium |
| **S3 integration** | Native | ❌ | ✅ **Links to S3, lazy-loads** | ❌ | ❌ |
| **Best use case** | Data lake, archive | Shared Linux app storage | ML training, HPC, genomics | Windows/AD shares | Boot volumes, databases |
| **When NOT to use** | POSIX semantics required | Cheap bulk storage | Non-latency-critical work | Linux workloads | Shared access |
| **Exam favorite** | "durable, any format, cheapest" | "shared POSIX across instances" | "HPC needs S3 data at sub-ms" | "Active Directory" | rare here |

**For DEA-C01:** S3 is the answer ~95% of the time. FSx for Lustre
appears in ML-training scenarios needing S3 data at sub-ms speed. EFS
appears when Lambda/containers need shared POSIX state.

---

<a name="part-8"></a>
## PART 8 — S3 storage class matrix

| Class | Retrieval | Min duration | Min billable size | Availability | Use when |
|---|---|---|---|---|---|
| **Standard** | Instant | None | None | 99.99% | Hot, frequent |
| **Intelligent-Tiering** | Instant | None | None | 99.9% | **Pattern unknown/changing** |
| **Standard-IA** | Instant | **30 d** | 128 KB | 99.9% | Known cold, instant access |
| **One Zone-IA** | Instant | **30 d** | 128 KB | 99.5% | Reproducible data |
| **Glacier Instant Retrieval** | **Milliseconds** | **90 d** | 128 KB | 99.9% | Archive, instant access |
| **Glacier Flexible Retrieval** | 1–5 min expedited / 3–5 h standard / 5–12 h bulk | **90 d** | 40 KB | 99.99% | Archive, occasional |
| **Glacier Deep Archive** | **12 h** standard / 48 h bulk | **180 d** | 40 KB | 99.99% | 7–10 year compliance |
| **Express One Zone** | **Single-digit ms** | None | None | 99.95% | Very high request rates |

### Intelligent-Tiering vs Lifecycle

```
        Do you KNOW the access pattern?
                    │
       ┌────────────┴─────────────┐
      YES                     NO / it changes
       │                          │
  LIFECYCLE POLICY        S3 INTELLIGENT-TIERING
  (no monitoring fee,     (small per-object monitoring
   cheapest for known      fee, but never wrong)
   patterns)
```

⚠️ Intelligent-Tiering charges a **per-object monitoring fee**. For
**millions of tiny objects** that fee can exceed the savings — the
answer becomes "compact small files first, then lifecycle policies."

⚠️ Deep Archive is cheapest to *store*, most expensive and slowest to
*retrieve*. Any requirement to access within hours rules it out.

**Other S3 facts tested:** versioning + MFA delete; Object Lock
governance vs compliance mode; CRR/SRR (needs versioning enabled);
Replication Time Control (15-min SLA); ~5,500 GET / 3,500 PUT per
second **per prefix**; strong read-after-write consistency.

---

<a name="part-9"></a>
## PART 9 — Orchestration matrix

| Attribute | **SFN Standard** | **SFN Express** | **MWAA** | **Glue Workflows** | **EventBridge Scheduler** |
|---|---|---|---|---|---|
| **Purpose** | Durable serverless workflows | High-volume short workflows | Managed Apache Airflow | Chain Glue jobs/crawlers | Cron replacement |
| **Max duration** | **1 year** | **5 minutes** | Unlimited | Unlimited | N/A |
| **Semantics** | **Exactly-once** | At-least-once | Operator-dependent | At-least-once | At-least-once |
| **Cost** | Per state transition (~$25/M) | Requests + duration (cheaper at volume) | **Environment-hours (always on)** | **Free** | ~Free |
| **Idle cost** | Zero | Zero | **High** | Zero | Zero |
| **Serverless** | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Complex DAGs** | ✅ Good | ✅ Good | ✅✅ **Best** | ⚠️ Limited | ❌ |
| **Parallelism** | Map / **Distributed Map (10,000)** | Map | Dynamic task mapping | Limited | N/A |
| **Error handling** | ✅ Retry/Catch + backoff | ✅ | ✅ | Basic | ❌ |
| **Execution history** | ✅ 90 days | ⚠️ CloudWatch Logs only | ✅ Airflow UI | Glue console | N/A |
| **Integrations** | **200+ native** | Same | Operators/hooks | Glue only | Many targets |
| **Best use case** | Serverless pipelines needing retries + audit | Millions of short executions | Existing DAGs, complex Python deps | Pure-Glue pipelines | "Run at 2 am daily" |
| **When NOT to use** | Very high volume short runs | >5 min, need exactly-once | Cost-sensitive, no Airflow legacy | Non-Glue steps | Anything with branching |
| **Exam favorite** | "least operational overhead orchestration" | "millions of executions" | "migrate existing Airflow DAGs" | "only Glue jobs" | "simple schedule" |

⚠️ **MWAA is never the "least operational overhead" answer.** It runs an
always-on environment you size and pay for. It wins **only** when the
question mentions existing Airflow DAGs or complex Python dependencies.

---

<a name="part-10"></a>
## PART 10 — Table format matrix

| Attribute | **Apache Iceberg** | **Hive-style** | **Apache Hudi** | **Delta Lake** |
|---|---|---|---|---|
| **AWS support** | ✅✅ Athena, Glue, EMR, Redshift, S3 Tables | ✅ Legacy default | ✅ EMR, Glue | ✅ EMR, Glue |
| **ACID transactions** | ✅ | ❌ | ✅ | ✅ |
| **Row-level UPDATE/DELETE** | ✅ | ❌ **Rewrite whole partitions** | ✅ | ✅ |
| **MERGE / upsert** | ✅ | ❌ | ✅ | ✅ |
| **Time travel** | ✅ Snapshots | ❌ | ✅ | ✅ |
| **Schema evolution** | ✅ Add/drop/rename/reorder | ⚠️ Add-column, positional | ✅ | ✅ |
| **Partition evolution** | ✅ **No rewrite** | ❌ | ⚠️ | ⚠️ |
| **Hidden partitioning** | ✅ | ❌ Users must know the scheme | ❌ | ❌ |
| **Concurrent writers** | ✅ Optimistic concurrency | ❌ Unsafe | ✅ | ✅ |
| **Best use case** | **The default answer in 2026** | Legacy only | Streaming upserts, CDC-heavy | Databricks-centric shops |
| **When NOT to use** | Truly append-only and simple | Anything needing updates | AWS-native prefers Iceberg | AWS-native prefers Iceberg |
| **Exam favorite** | "GDPR delete", "upsert", "time travel" | usually the *wrong* answer now | occasional | occasional |

### Why Iceberg is the exam's favorite

```
PROBLEM                                 HIVE TABLE          ICEBERG
──────────────────────────────────────────────────────────────────────
Delete one customer's rows (GDPR)       Rewrite partition   DELETE ✅
Merge daily CDC changes                 Full reload         MERGE INTO ✅
Query yesterday's version               Impossible          Time travel ✅
Rename a column                         Breaks queries      Safe ✅
Change partitioning day → hour          Rewrite all data    Partition
                                                             evolution ✅
Two jobs writing at once                Corruption risk     Optimistic
                                                             concurrency ✅
Millions of partitions                  Slow S3 LIST        Metadata files ✅
```

---

<a name="part-11"></a>
## PART 11 — File format & compression matrix

### Formats

| Attribute | **Parquet** | **ORC** | **Avro** | **JSON** | **CSV** |
|---|---|---|---|---|---|
| **Layout** | Columnar | Columnar | Row | Row (text) | Row (text) |
| **Splittable** | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| **Compression ratio** | Excellent | **Best** | Good | Poor | Poor |
| **Schema evolution** | Good | Good | ✅ **Best** | N/A | ❌ |
| **Nested data** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Predicate pushdown** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Read speed (analytics)** | ✅✅ | ✅✅ | ⚠️ | ❌ | ❌ |
| **Write speed (ingest)** | ⚠️ | ⚠️ | ✅✅ | ✅ | ✅ |
| **Best use case** | **Default for analytics** | Hive-heavy legacy | Streaming ingest, schema registry | Raw landing | Raw landing |
| **Exam favorite** | "improve Athena performance and cost" | "Hive workloads" | "schema evolution at ingest" | wrong answer | wrong answer |

**Rule: Columnar for Consumption, Row for Receiving.**

### Compression

| Codec | Splittable | Ratio | Speed | Use when |
|---|---|---|---|---|
| **Snappy** | ✅ inside Parquet/ORC | Medium | **Fastest** | **Default with Parquet** |
| **ZSTD** | ✅ | High | Fast | Better ratio, modern default |
| **GZIP** | ❌ **standalone** | High | Slow | Small files, archival |
| **BZIP2** | ✅ | Highest | **Slowest** | Rarely correct |
| **LZO** | ✅ if indexed | Low | Fast | Legacy |

⚠️ **The splittability trap.** A 10 GB gzipped CSV cannot be split →
one task processes the whole file → no parallelism. The fix is **not**
"add more workers." It is **convert to Parquet + Snappy and partition**.

### The small-file problem

```
10,000 files x 1 MB     →  Slow. Per-file overhead dominates.
100 files x 100 MB      →  Fast. This is the target.

TARGET FILE SIZE: 128 MB – 1 GB

FIXES:
  • Glue:     coalesce() / repartition() before write
  • Firehose: increase buffer size
  • Athena:   CTAS with bucketing
  • Iceberg:  compaction (rewrite_data_files / OPTIMIZE)
  • Ongoing:  scheduled compaction job
```

### Partitioning strategy

| Do | Don't |
|---|---|
| Partition on columns used in `WHERE` | Partition on high-cardinality IDs |
| Use date hierarchies (`year=/month=/day=`) | Create millions of tiny partitions |
| Aim for ≥128 MB per partition | Partition on a column nobody filters by |
| Use partition projection for predictable schemes | Run crawlers constantly on huge tables |

---

<a name="part-12"></a>
## PART 12 — Catalog matrix

| Attribute | **Glue Data Catalog** | **Hive Metastore (self-managed)** | **Lake Formation** | **DataZone / SageMaker Catalog** |
|---|---|---|---|---|
| **Purpose** | Central technical metadata | Same, self-run | Permissions **on top of** the catalog | Business catalog & marketplace |
| **Managed** | ✅ Serverless | ❌ | ✅ | ✅ |
| **Used by** | Athena, EMR, Redshift Spectrum, Glue, LF | EMR, Spark | Athena, Redshift, EMR, Glue | Cross-org discovery |
| **Cost** | Per object + requests | EC2/RDS cost | Free (pay underlying) | Per user/project |
| **Fine-grained permissions** | ❌ (IAM at DB/table only) | ❌ | ✅ **Column, row, cell** | Via LF |
| **Business glossary** | ❌ | ❌ | ❌ | ✅ |
| **Best use case** | Default metadata layer | Migrating existing Hive | Governed data lake | Data mesh, publish/subscribe |
| **Exam favorite** | "central metadata for Athena and EMR" | "migrate existing metastore" | "column-level security" | "business users discover datasets" |

**Mental model:** the **Glue Data Catalog** says *what the data is*.
**Lake Formation** says *who may see which parts of it*. **DataZone**
says *who owns it and how to request access*.

---

<a name="part-13"></a>
## PART 13 — Governance & access matrix

| Attribute | **IAM** | **Lake Formation** | **S3 bucket policy** | **Redshift RLS/masking** | **AWS RAM** |
|---|---|---|---|---|---|
| **Granularity** | Bucket, prefix, API action | **DB, table, column, row, cell** | Bucket, prefix | Row, column | Resource share |
| **Catalog-aware** | ❌ | ✅ | ❌ | N/A | ❌ |
| **Cross-account** | Assume role | ✅ Native (+ RAM) | ✅ | Data sharing | ✅ Core purpose |
| **Tag-based** | ABAC via tags | ✅ **LF-Tags (TBAC)** | ⚠️ | ❌ | ✅ |
| **Best use case** | Service-to-service permissions | Lake governance at scale | Simple bucket rules | In-warehouse security | Share catalogs/subnets across accounts |
| **When NOT to use** | Column/row filtering | Data not in the catalog | Fine-grained lake access | Lake data | Fine-grained data access |
| **Exam favorite** | "least privilege" | "all columns except SSN" | "make the bucket private" | "each region sees own rows" | "share across accounts" |

### IAM policy evaluation order — memorize exactly

```
1. Is there an EXPLICIT DENY anywhere?       → DENY. Stop.
2. Does an SCP (Organizations) allow it?     → If no, DENY.
3. Does a resource-based policy allow it?    → If yes, may ALLOW.
4. Is it within the permissions boundary?    → If no, DENY.
5. Does a session policy allow it?           → If no, DENY.
6. Does an identity-based policy allow it?   → If yes, ALLOW.
7. Otherwise                                 → IMPLICIT DENY.
```

**Mnemonic: "Deny Stops Really Powerful Session Identities."**

### Lake Formation concepts

| Concept | What it does |
|---|---|
| **LF-Tags (TBAC)** | Attach tags to DBs/tables/columns; grant on tags, not objects. The answer for "manage access across thousands of tables." |
| **Data filters** | Named row/column/cell filters applied per principal |
| **Data location permissions** | Controls who can register/point at an S3 location |
| **Cross-account sharing** | Share catalog resources without copying data |
| **Hybrid access mode** | IAM and LF permissions coexist during migration |

---

<a name="part-14"></a>
## PART 14 — Encryption matrix

| Method | Key managed by | Rotation | Audit trail | Cost | Use when |
|---|---|---|---|---|---|
| **SSE-S3** (AES-256) | AWS, invisible | Automatic | ❌ No CloudTrail key events | **Free** | Default, no compliance need |
| **SSE-KMS** (AWS-managed) | AWS | Annual, automatic | ✅ | KMS request cost | Good default |
| **SSE-KMS** (customer-managed) | **You** | ✅ Configurable | ✅ Full | $1/mo per key + requests | **Compliance, audit, cross-account** |
| **DSSE-KMS** | You | ✅ | ✅ | Higher | Double-encryption mandates |
| **SSE-C** | **You entirely** | You | Partial | Free | Keys must live outside AWS |
| **Client-side** | You | You | ❌ | Free | Zero trust in provider |

**S3 Bucket Keys** reduce KMS API calls by up to 99% — the answer for
*"we use SSE-KMS but KMS request costs are too high."*

### KMS key types

| Type | Policy control | Rotation | Cross-account | Cost |
|---|---|---|---|---|
| **AWS owned** | AWS | AWS | ❌ | Free |
| **AWS managed** (`aws/s3`) | AWS | Annual | ❌ | Free (pay requests) |
| **Customer managed (CMK)** | **You** | ✅ Configurable | ✅ | $1/month + requests |
| **Imported (BYOK)** | You | Manual | ✅ | $1/month |

⚠️ Cross-account access to encrypted data **requires a customer-managed
key** — AWS-managed keys cannot be shared.

---

<a name="part-15"></a>
## PART 15 — Secrets & config matrix

| Attribute | **Secrets Manager** | **Parameter Store (Standard)** | **Parameter Store (Advanced)** |
|---|---|---|---|
| **Automatic rotation** | ✅ **Built-in for RDS/Redshift/DocumentDB** | ❌ | ❌ |
| **Cost** | ~$0.40/secret/month + API | **Free** | ~$0.05/param/month |
| **Max size** | 64 KB | 4 KB | 8 KB |
| **Cross-account** | ✅ Resource policy | ❌ | ❌ |
| **Encryption** | KMS always | Optional (SecureString) | Optional |
| **Best use case** | DB credentials, API keys needing rotation | Config values | Larger config |
| **Exam favorite** | "automatically rotate database credentials" | "**most cost-effective** configuration storage" | rare |

**Tiebreaker:** rotation → Secrets Manager. Cost → Parameter Store.

---

<a name="part-16"></a>
## PART 16 — Monitoring matrix

### The one metric that matters per service

| Service | Metric | What it means when bad |
|---|---|---|
| **Kinesis Data Streams** | `GetRecords.IteratorAgeMilliseconds` | **Consumers falling behind** |
| Kinesis Data Streams | `WriteProvisionedThroughputExceeded` | Producers throttled — add shards |
| **Amazon Data Firehose** | `DeliveryToS3.Success`, `ThrottledRecords` | Delivery failing; check IAM/KMS |
| **MSK** | Consumer lag, `UnderReplicatedPartitions` | Consumers behind; broker unhealthy |
| **Glue** | `numFailedTasks`, DPU utilization | Skew, OOM, mis-sized |
| **Lambda** | `Throttles`, `Duration`, `Errors`, `IteratorAge` | Concurrency limit, timeout risk |
| **Redshift** | `WLMQueueLength`, `WLMQueueWaitTime` | Queries queuing → concurrency scaling |
| Redshift | `PercentageDiskSpaceUsed` | Storage pressure |
| **Athena** | `DataScannedInBytes`, `QueryQueueTime` | Cost problem; concurrency limit |
| **DynamoDB** | `ThrottledRequests`, `ConsumedReadCapacityUnits` | Hot partition or under-provisioned |
| **Step Functions** | `ExecutionsFailed`, `ExecutionsTimedOut` | |
| **EMR** | `YARNMemoryAvailablePercentage`, `ContainerPending` | Cluster undersized |
| **S3** | `4xxErrors`, `5xxErrors`, `FirstByteLatency` | Permissions or throttling |

### CloudWatch vs CloudTrail vs X-Ray vs Config

| | **CloudWatch** | **CloudTrail** | **X-Ray** | **AWS Config** |
|---|---|---|---|---|
| **Answers** | "Is it healthy? How fast?" | "**Who** did what, when?" | "Where is the latency?" | "Is it configured correctly?" |
| **Data** | Metrics, logs, alarms | API audit log | Distributed traces | Config history |
| **Exam trigger** | "alert when", "monitor" | "audit", "who accessed" | "identify bottleneck across services" | "detect non-compliant resources" |

⚠️ **CloudTrail trap:** object-level reads/writes in S3 require **data
events**, which are **not enabled by default** and cost extra.
Management events alone will not tell you who read an object.

---

<a name="part-17"></a>
## PART 17 — Glue batch vs Glue streaming

| Attribute | **Glue ETL (batch)** | **Glue Streaming** |
|---|---|---|
| **Trigger** | Schedule, event, on-demand | Runs continuously |
| **Source** | S3, JDBC, Catalog | **Kinesis, MSK, Kafka** |
| **Processing model** | Full/incremental batch | **Micro-batch** (window ≥ 100 ms) |
| **Incremental mechanism** | **Job bookmarks** | Checkpointing |
| **Cost** | Per run (DPU-hours) | **Continuous DPU-hours — always billing** |
| **Worker types** | G.1X–G.8X | G.025X, G.1X, G.2X |
| **Best use case** | Nightly transforms, backfills | Continuous enrichment into the lake |
| **When NOT to use** | Sub-minute freshness needed | Data arrives once a day |
| **Exam favorite** | "process new files daily" | "continuously transform streaming data into the lake" |

⚠️ Glue Streaming **always costs money** because it never stops. If the
question emphasizes cost and data arrives in batches, scheduled batch
is correct and streaming is the trap.

---

<a name="part-18"></a>
## PART 18 — Cost-driver cheat table

| Service | Billed for | Biggest lever |
|---|---|---|
| **S3** | GB-month, requests, retrieval, transfer | Storage class + lifecycle + fewer, bigger objects |
| **Athena** | **TB scanned** | Parquet + partitioning + compression |
| **Glue** | DPU-hours (per second, 1-min min) | Right-size workers; **Flex** for non-urgent |
| **EMR** | Instance-hours | **Spot on task nodes** + managed scaling |
| **Redshift provisioned** | Node-hours | Reserved Instances (up to ~75% off) |
| **Redshift Serverless** | RPU-hours | Base capacity + auto-pause |
| **Kinesis Data Streams** | Shard-hours + PUT units | Right-size shards or on-demand |
| **Amazon Data Firehose** | GB ingested | Compress before ingest |
| **Lambda** | Requests + GB-seconds | Right-size memory |
| **DynamoDB** | RCU/WCU or per-request | On-demand for spiky; provisioned+autoscale for steady |
| **KMS** | $1/key/month + requests | **S3 Bucket Keys** |
| **MWAA** | Environment-hours | Use Step Functions instead |
| **Data transfer** | Cross-AZ, cross-region, egress | VPC endpoints, same-region, same-AZ |

**The universal cost answer for analytics:**
> **Partition + Parquet + Compress + Compact.**

---

<a name="part-19"></a>
## PART 19 — The 25 head-to-heads

1. **Firehose vs Data Streams** — Firehose delivers; Streams retains and replays.
2. **Data Streams vs MSK** — MSK only if Kafka already exists.
3. **MSK provisioned vs Serverless** — Serverless for unpredictable; provisioned for steady/cheaper.
4. **Glue vs EMR** — Glue for serverless catalog-driven ETL; EMR for existing Hadoop and Spot economics.
5. **EMR vs EMR Serverless** — Serverless unless you need Presto/HBase/custom bootstrap.
6. **Glue vs Lambda** — Lambda only under 15 minutes and 10 GB.
7. **Glue batch vs Glue streaming** — streaming bills continuously.
8. **Athena vs Redshift** — access pattern decides, not data location.
9. **Athena vs Spectrum** — Spectrum only if Redshift already exists.
10. **Redshift provisioned vs Serverless** — steady → provisioned + RIs; spiky → Serverless.
11. **DynamoDB vs Aurora** — key access vs relational queries.
12. **DynamoDB Scan vs Export-to-S3** — never Scan for analytics.
13. **GSI vs LSI** — LSI must exist at table creation; GSI can be added later.
14. **S3 vs EFS vs FSx** — object vs POSIX vs HPC.
15. **Intelligent-Tiering vs Lifecycle** — unknown pattern vs known pattern.
16. **Glacier Instant vs Flexible vs Deep** — ms vs hours vs 12+ hours.
17. **Iceberg vs Hive** — Iceberg wins on anything involving change.
18. **Parquet vs Avro** — read-optimized vs write/evolution-optimized.
19. **Snappy vs GZIP** — speed and splittability vs ratio.
20. **Step Functions vs MWAA** — serverless vs existing Airflow.
21. **SFN Standard vs Express** — duration/semantics vs volume/cost.
22. **IAM vs Lake Formation** — API permissions vs sub-table data permissions.
23. **Secrets Manager vs Parameter Store** — rotation vs cost.
24. **Gateway vs Interface endpoint** — S3/DynamoDB free vs everything else paid.
25. **DMS vs zero-ETL** — any source vs Aurora/RDS-MySQL/DynamoDB with no pipeline.

---

<a name="part-20"></a>
## PART 20 — The 90-second pre-exam scan

```
near real-time ......... Firehose
real-time .............. Kinesis Data Streams
existing Kafka ......... MSK
replicate a database ... DMS (CDC)
Aurora/DynamoDB→RS ..... zero-ETL
ad-hoc SQL on S3 ....... Athena
BI at concurrency ...... Redshift
existing Spark ......... EMR (+Spot on TASK nodes)
under 15 minutes ....... Lambda
no code, analysts ...... DataBrew
upsert/delete/GDPR ..... Iceberg
millions of partitions . partition projection
column/row security .... Lake Formation
find PII ............... Macie
rotate DB creds ........ Secrets Manager
cheap config ........... Parameter Store
private S3 from VPC .... Gateway endpoint (free)
who read the object .... CloudTrail DATA events
consumers behind ....... IteratorAge
orchestrate serverless . Step Functions
existing Airflow ....... MWAA
unknown access pattern . Intelligent-Tiering
known access pattern ... Lifecycle policy
slow gzipped CSV ....... convert to Parquet + partition
OOM in Glue ............ bigger worker (G.2X) or fix skew
queries queuing ........ concurrency scaling
Spot on all nodes ...... WRONG. Task nodes only.
```
