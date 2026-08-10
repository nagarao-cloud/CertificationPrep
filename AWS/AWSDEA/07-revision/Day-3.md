# Revision — Day 3 (cumulative: Days 1–3)

> Rapid-recall checkpoint, not a teaching doc. Day 1 is compressed to
> its highest-yield facts (you've reviewed it once already); Days 2–3
> get full treatment since they're fresh. Full depth lives in
> `02-services/`, `00-START-HERE/SERVICE-SELECTION-MATRIX.md`.

---

## 1. Rapid recall — by day

### Day 1 recap — Storage layer (compressed)

| Topic | Recall |
|---|---|
| S3 class for unknown pattern | Intelligent-Tiering (monitoring fee) |
| S3 class for known pattern | Lifecycle policy (cheaper, no fee) |
| Archive, ms retrieval | Glacier Instant Retrieval |
| Archive, 12 h retrieval, cheapest | Glacier Deep Archive |
| WORM nobody can override | Object Lock, compliance mode |
| Min durations | IA 30 d · Glacier IR/Flex 90 d · Deep Archive 180 d |
| Analytics default format | Parquet, columnar, splittable |
| Best schema evolution | Avro |
| Default compression | Snappy (fast, splittable in Parquet); GZIP standalone = not splittable |
| Small-file fix | Compact to 128 MB–1 GB |
| Partition on | Low-cardinality date columns, not high-cardinality IDs |
| Glue Data Catalog | Central metadata; crawlers infer schema/partitions; no column security |
| Iceberg | ACID on S3 tables; row-level delete, time travel, safe concurrent writes |

### Day 2 — Streaming ingestion + CDC

**Kinesis Data Streams**

| Topic | Recall |
|---|---|
| Per-shard limits | 1 MB/s **or** 1,000 records/s in; 2 MB/s out (shared) |
| Enhanced fan-out (EFO) | 2 MB/s **per consumer** dedicated, ~70 ms latency |
| Standard latency | ~200 ms |
| Retention | 24 h default, up to 365 days — enables replay |
| On-demand mode | Auto-scales to 200 MB/s+, doubles capacity within 15 min of spike |
| `IteratorAge` rising | Consumers falling behind — scale consumers/EFO, not producers |
| `WriteProvisionedThroughputExceeded` | Producers throttled — add shards |
| Ordering | Guaranteed per shard, via partition key |
| Hot shard | One partition key gets disproportionate traffic — pick a better key or use on-demand |
| Resharding | Split (increase) or merge (decrease) shards |
| KCL | Kinesis Client Library — manages shard assignment for consumer apps |

**Amazon Data Firehose**

| Topic | Recall |
|---|---|
| Latency | Buffered — treat as ~60 seconds |
| Replay | **None. Ever.** |
| Destinations | Exactly one per delivery stream |
| Transformation | Inline Lambda + format conversion (Parquet/ORC) |
| Dynamic partitioning | Partitions data as it lands (e.g., by customer/date) |
| Error records | Delivered to an S3 error prefix for reprocessing |
| Ops burden | Lowest of all streaming options |

**Amazon MSK**

| Topic | Recall |
|---|---|
| What it is | Managed Apache Kafka — Kafka-wire-compatible |
| Provisioned vs Serverless | Provisioned = you manage brokers/partitions; Serverless = auto-scales |
| MSK Connect | Managed Kafka Connect for connectors |
| When it wins | Existing Kafka investment, Kafka Connect connectors, lift-and-shift |
| When it's a trap | Greenfield pipeline with no Kafka — added ops burden for nothing |

**AWS DMS**

| Topic | Recall |
|---|---|
| Full load | One-time migration, source can be quiesced |
| Full load + CDC | Minimal-downtime migration (default answer for that phrase) |
| CDC only | Target already seeded, keep it current |
| Requires | Supplemental logging / binlog enabled on source |
| LOB handling | Limited LOB mode = fast but truncates; full LOB mode = complete but slow |
| Schema/procs/indexes | **Not DMS** — that's SCT (Schema Conversion Tool) |
| Validation task | Verifies migration completeness/accuracy |
| Targets | Can target Kinesis or MSK — turns a DB into a stream |
| DMS Serverless | Auto-scales replication capacity, no instance sizing |

**Zero-ETL & messaging**

| Topic | Recall |
|---|---|
| Zero-ETL sources | Aurora MySQL/PostgreSQL, RDS for MySQL, DynamoDB |
| Zero-ETL targets | Redshift, OpenSearch |
| Zero-ETL value prop | No pipeline at all — seconds of lag, no Glue/DMS/code |
| SQS Standard | Decouple, one consumer, max throughput, no strict order |
| SQS FIFO | Decouple, one consumer, guaranteed order, lower throughput cap |
| SNS | Fan-out to many subscribers, basic filtering |
| EventBridge | Fan-out with **content-based routing rules** — richer than SNS |

### Day 3 — Transformation: Glue, EMR, Flink, Lambda

**Glue ETL**

| Topic | Recall |
|---|---|
| DynamicFrame | Self-describing, inferred per record, handles messy/drifting schema (`resolveChoice`) |
| DataFrame | Fixed schema, faster, needs clean known schema |
| Job bookmarks | Skip already-processed data — the incremental-processing mechanism |
| Reprocess history | **Reset** the bookmark, don't just "enable" it |
| Worker types | G.1X (default) → G.2X (first OOM fix) → G.4X (big joins) → G.8X (big shuffles) → G.025X (streaming only) |
| Glue Flex | Spare capacity, much cheaper, variable start time — non-urgent jobs only |
| Glue Studio | Visual job builder **for data engineers**, still produces Spark |

**Glue DataBrew**

| Topic | Recall |
|---|---|
| Audience | Business analysts, no-code |
| vs Glue Studio | Studio = engineers building Spark visually; DataBrew = analysts profiling/cleaning, no code at all |

**EMR**

| Topic | Recall |
|---|---|
| Primary node | Cluster coordinator — **never Spot**, losing it kills the cluster |
| Core nodes | Run tasks + store HDFS — Spot is risky, you can lose data |
| Task nodes | Run tasks only, no HDFS — **Spot goes here**, the exam answer |
| Instance fleets | Multiple instance types, EMR picks based on capacity/price — maximizes Spot availability |
| EMRFS | S3 as the Hadoop filesystem for EMR |
| EMR Serverless | Spark/Hive without cluster ops, seconds to start |
| EMR on EKS | Runs EMR on an existing Kubernetes cluster |
| Frameworks EMR has that Glue doesn't | Hive, Presto/Trino, HBase |

**Managed Service for Apache Flink**

| Topic | Recall |
|---|---|
| Purpose | Continuous stream *processing* — windowing, aggregation, CEP |
| Delivery semantics | Exactly-once via checkpointing |
| Cost | KPU-hours (1 KPU = 1 vCPU + 4 GB) |
| Exam trigger | "tumbling/sliding window", "exactly-once", "anomaly detection on a stream" |
| vs Glue Streaming | Flink = time-window computation; Glue Streaming = micro-batch enrich-and-land |

**Lambda for ETL**

| Topic | Recall |
|---|---|
| Hard limits | 15 min runtime, 10,240 MB memory, 10 GB `/tmp` |
| Best use | Light transforms, event-driven triggers, sub-15-min jobs |
| Trap | "Serverless" ≠ automatically right if the workload could exceed any limit |

**Data skew, pruning, pushdown**

| Topic | Recall |
|---|---|
| Data skew | One partition/key holds disproportionate data → one executor does all the work |
| Skew fix | Repartition, salt the key — **not** more workers (more workers = more parallelism, not more memory per executor) |
| Partition pruning | Query engine skips partitions that can't match the filter |
| Predicate pushdown | Filter applied at the storage/format layer (Parquet/ORC) before data is read into memory |

---

## 2. Keyword → service trigger table

| Trigger phrase | Answer |
|---|---|
| Near real-time + least operational overhead | Amazon Data Firehose |
| Real-time, sub-second | Kinesis Data Streams |
| Multiple independent consumers | Kinesis Data Streams |
| Replay / reprocess historical events | Kinesis Data Streams (extended retention) |
| Existing Kafka / Kafka Connect | Amazon MSK |
| Continuously replicate on-prem DB | AWS DMS (CDC) |
| One-time DB migration | AWS DMS (full load) |
| Heterogeneous migration (schema + procs) | DMS + SCT |
| Aurora/DynamoDB → Redshift, no pipeline | Zero-ETL integration |
| Route events based on content | EventBridge |
| Fan out, basic pub/sub | SNS |
| Serverless ETL, catalog-native | AWS Glue ETL |
| Process only new data since last run | Glue job bookmarks |
| Reprocess ALL historical data | Reset the Glue job bookmark |
| Business analysts, no code | Glue DataBrew |
| Existing Spark/Hive/Presto/HBase | Amazon EMR |
| Lowest cost at petabyte scale | EMR + Spot on task nodes |
| Spark without managing clusters | EMR Serverless |
| Kubernetes, already run EKS | EMR on EKS |
| Under 15 minutes, event-driven | AWS Lambda |
| Tumbling/sliding window aggregation | Managed Service for Apache Flink |
| Exactly-once stream processing | Managed Service for Apache Flink |
| Convert CSV/JSON to Parquet on arrival | Firehose format conversion |
| Partition data as it lands | Firehose dynamic partitioning |
| OOM in a Glue job | Bigger worker (G.2X) or fix skew — not more workers |

---

## 3. Top exam traps — Days 1–3 scope

1. **Setup:** "Near real-time, least operational overhead." → **Wrong:** Kinesis Data Streams + Lambda consumer. → **Right:** Amazon Data Firehose. "Near" licenses the ~60 s buffer; building Streams+Lambda is *more* overhead for a requirement Firehose already meets.
2. **Setup:** "8,000 records/sec, average record 3 KB — how many shards?" → **Wrong:** 8 (by record count). → **Right:** 24 (8,000 × 3 KB = 24 MB/s ÷ 1 MB/s). Always compute both limits, take the larger.
3. **Setup:** "Reprocess ALL historical data after a bug fix." → **Wrong:** enable job bookmarks. → **Right:** reset the bookmark. Enabling = incremental; resetting = full reprocess. AWS words these nearly identically on purpose.
4. **Setup:** "Reduce EMR cost as much as possible." → **Wrong:** Spot on all node types. → **Right:** Spot on task nodes only. Losing primary kills the cluster; losing core loses HDFS data.
5. **Setup:** "The team's jobs use Hive, Presto, and HBase." → **Wrong:** migrate to Glue (it's serverless!). → **Right:** EMR. Glue only runs Spark, Python shell, and Ray — not those frameworks.

---

## 4. Mnemonics recap

| Mnemonic | For |
|---|---|
| **SITS PG** | Pipeline spine: Source → Ingest → Transform → Store → Present → Govern |
| **F-R-E-D** | Ingestion picker: Firehose (fire-and-forget) → Replay = Streams → Existing Kafka = MSK → Database source = DMS/zero-ETL |
| **Kinesis = kinetic, motion, shard by shard** | Data Streams core identity |
| **A firehose only points one way** | No replay, no going back |
| **MSK = you already speak Kafka** | Only pick it when Kafka already exists |
| **DMS = full load then CDC keeps chasing** | Migration pattern |
| **EMR = the cluster you actually control (and pay Spot for)** | vs Glue's serverless model |

---

## 5. Self-test — rapid fire (14)

| # | Question | Answer |
|---|---|---|
| 1 | Firehose latency, treat as roughly how long? | ~60 seconds |
| 2 | Can Firehose replay data? | No, never |
| 3 | Metric that shows consumers falling behind a Kinesis stream? | `IteratorAge` (rising) |
| 4 | Fix for 5 consumers each needing full 2 MB/s per shard? | Enhanced fan-out, not more shards |
| 5 | DMS mode for minimal-downtime migration? | Full load + CDC |
| 6 | What does DMS NOT migrate? | Schemas, indexes, stored procedures (that's SCT) |
| 7 | Zero-ETL supported sources? | Aurora MySQL/PostgreSQL, RDS MySQL, DynamoDB |
| 8 | Route one event to 5 systems filtering on different attributes — SNS or EventBridge? | EventBridge (content-based rules) |
| 9 | Which EMR node type can safely use Spot? | Task nodes only |
| 10 | First fix for a Glue OOM error? | Bigger worker type (G.2X), or fix data skew |
| 11 | Lambda's three hard ETL limits? | 15 min runtime, 10,240 MB memory, 10 GB /tmp |
| 12 | Tool for a 5-minute rolling average per sensor on a stream? | Managed Service for Apache Flink |
| 13 | Why is Glue Streaming wrong for once-daily data? | It runs (and bills) continuously |
| 14 | DynamicFrame vs DataFrame — which handles schema drift? | DynamicFrame (`resolveChoice`) |
