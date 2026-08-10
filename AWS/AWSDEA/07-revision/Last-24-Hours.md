# Last 24 Hours — Final Revision Sheet

> Rapid-recall only — not a teaching doc. This is the one sheet you read
> the night before and the morning of the exam. Organized by **domain**
> (not by day) because that's how the exam is actually weighted and
> scored. If any single line doesn't click instantly, that's a Weak
> Topics Dashboard entry, not something to re-derive here at 11 pm.
>
> Domain weights to keep in your head: **34 / 26 / 22 / 18** — Ingestion
> is worth nearly twice Security. Spend your remaining energy accordingly.

---

## 0. Exam-day logistics — read this once, then stop

| Item | Fact |
|---|---|
| Format | 65 questions, 130 minutes, scaled 100–1000, **pass = 720** |
| Scoring | **Compensatory** — no per-domain minimum. A weak Domain 4 can be offset by a strong Domain 1. |
| 720 ≈ | ~70–75% correct. You can miss ~16–18 questions and still pass. |
| Guessing | **No penalty for wrong answers.** Never leave a question blank. |
| Pilot questions | Some of the 65 are unscored trial items, indistinguishable from real ones. If one seems bizarre, flag it and move on — it may not even count. |
| Pacing | Pass 1 (0–95 min): answer everything you know in ≤90 s, flag the rest. Pass 2 (95–120 min): return to flagged items. Pass 3 (120–130 min): final sweep, check nothing is blank, verify multi-select counts. |
| Multi-response | Wrong **count** = wrong answer, no partial credit. Usual pattern: one service choice + one configuration detail, not two competing services. |
| Every question routine | Read the **last sentence first** (the actual ask) → underline the constraint (cost/ops/latency/"existing X"/compliance) → find the pipeline stage → eliminate 2 options → choose between the final 2 using the constraint. |
| Test center | Two forms of ID, one photo, arrive 30 min early. |
| Online proctored | Join 30 min early. Clear desk, closed door, no second monitor, no phone, no notes. |
| Night before | Only review matrices/mnemonics/your mistake list. **No new material.** Stop by 6 pm — sleep outperforms cramming. |
| Morning of | Eat something — 130 minutes of scenario reading burns real glucose. |
| Panic moment | 5 hard questions in a row: flag all 5, move on immediately, don't fight them. Remember: compensatory scoring, some may be unscored pilots. |

---

## 1. DOMAIN 1 — Data Ingestion and Transformation (34%)

### Streaming ingestion

| Service | One-line identity |
|---|---|
| Kinesis Data Streams | Real-time, replayable, multi-consumer. 1 MB/s or 1,000 rec/s per shard (take the larger). Retention up to 365 d. |
| Enhanced fan-out (EFO) | Dedicated 2 MB/s **per consumer**, ~70 ms latency, fixes "N consumers each need full throughput." |
| Amazon Data Firehose | Near real-time (~60 s buffer), **no replay ever**, exactly one destination, least ops. Dynamic partitioning + inline Lambda/format conversion. |
| Amazon MSK | Managed Kafka — only the right answer when Kafka/Kafka Connect already exists. Provisioned vs Serverless. |
| AWS DMS | Full load (one-time) / full load+CDC (minimal downtime, default answer) / CDC-only (keep seeded target current). Requires binlog/supplemental logging. Schema/procs = SCT's job, not DMS's. Can target Kinesis/MSK. |
| Zero-ETL | Aurora MySQL/PostgreSQL, RDS MySQL, DynamoDB → Redshift/OpenSearch. No pipeline, seconds of lag — beats DMS/Glue when the source is on the supported list. |
| SQS Standard / FIFO | Decouple + max throughput vs decouple + guaranteed order (lower cap) |
| SNS | Simple pub/sub fan-out, basic filtering |
| EventBridge | Fan-out with **content-based routing rules** — richer than SNS |

**Shard math (memorize the method, not just the answer):**
```
Per shard: 1 MB/s IN  or  1,000 records/s IN  (whichever binds first)
           2 MB/s OUT shared, or 2 MB/s OUT per consumer with EFO
Always compute BOTH the record-count and throughput math. Take the LARGER.
AWS deliberately picks numbers where record-count math looks smaller and tempting.
```

### Transformation & compute

| Service | One-line identity |
|---|---|
| Glue ETL | Serverless Spark, catalog-native. DynamicFrame (messy/drifting schema) vs DataFrame (clean/fast). Job bookmarks = incremental; **reset** to reprocess history. |
| Glue worker types | G.1X default → G.2X first OOM fix → G.4X big joins → G.8X big shuffles → G.025X streaming-only |
| Glue Flex | Spare capacity, cheap, variable start — non-urgent jobs only |
| Glue DataBrew | No-code, for **business analysts** (not Glue Studio, which is for engineers) |
| Glue Streaming | Micro-batch on Kinesis/MSK sources; **bills continuously** — wrong answer for once-daily data |
| Amazon EMR | Full cluster control; only option with Hive/Presto/Trino/HBase. Spot on **task nodes only** — never primary, risky on core. Instance fleets maximize Spot availability. |
| EMR Serverless | Spark/Hive, zero cluster ops |
| EMR on EKS | Runs EMR on an existing Kubernetes cluster |
| Managed Service for Apache Flink | Continuous stream *processing* — tumbling/sliding windows, exactly-once via checkpointing, anomaly detection |
| AWS Lambda | Event-driven, sub-15-min transforms. Hard limits: **15 min / 10,240 MB / 10 GB `/tmp`** |
| Data skew | One key/partition overloaded → repartition or salt the key, **not** more workers |
| Partition pruning | Query engine skips partitions that can't match the filter |
| Predicate pushdown | Filter applied at the storage/format layer (Parquet/ORC) before reading into memory |

### Orchestration

| Service | One-line identity |
|---|---|
| Step Functions Standard | Up to 1 year, **exactly-once**, per-state-transition billing, 90-day history |
| Step Functions Express | Up to 5 min, **at-least-once**, cheap at high volume (millions/day) |
| Distributed Map | Parallelize up to 10,000 items |
| MWAA | Managed Airflow. **Never** the "least operational overhead" answer — always-on, sized, patched. Wins only with existing Airflow DAGs / complex Python deps. |
| Glue Workflows | Free, chains Glue jobs/crawlers only |
| EventBridge Scheduler | Cron replacement — "run daily at 02:00, cheapest" |
| S3 Event Notification | Triggers Lambda/SQS/EventBridge on object arrival |

### Programming concepts & reliability

| Topic | Recall |
|---|---|
| Idempotency | Same op applied twice = same effect as once (dedup key, conditional write, Iceberg MERGE) |
| At-least-once + retries | Guarantees duplicates unless the consumer is idempotent — the fix is idempotency, not fewer retries |
| DLQ | Captures poison messages after max retries |
| IaC | CloudFormation, CDK, SAM |
| SQL fluency expected | Window functions, CTEs, joins — conceptual, not syntax memorization |
| ETL vs ELT | Transform-before-load vs transform-after-load (modern lakehouse favors ELT) |

---

## 2. DOMAIN 2 — Data Store Management (26%)

### S3

| Class | Retrieval | Min duration | Use when |
|---|---|---|---|
| Standard | Instant | None | Hot, frequent |
| Intelligent-Tiering | Instant | None | Unknown/changing pattern (monitoring fee) |
| Standard-IA / One Zone-IA | Instant | 30 d | Known cold, still instant |
| Glacier Instant Retrieval | ms | 90 d | Archive, instant access |
| Glacier Flexible Retrieval | 1–5 min / 3–5 h / 5–12 h | 90 d | Archive, occasional |
| Glacier Deep Archive | 12 h / 48 h | 180 d | 7–10 yr compliance, cheapest storage |
| Express One Zone | Single-digit ms | None | Very high request rate |

| S3 mechanic | Recall |
|---|---|
| Lifecycle policy | Known pattern → transitions/expirations, no monitoring fee |
| Versioning | Precondition for CRR/SRR and MFA delete |
| Object Lock — governance / compliance | Overridable by privileged users / **nobody, ever, including root** |
| CRR / SRR | Needs versioning on source + destination; RTC = 15-min SLA |
| Consistency | Strong read-after-write for all operations |
| Request limits | ~5,500 GET / 3,500 PUT per sec **per prefix** |

### File formats & compression

| Format | Splittable | Best for |
|---|---|---|
| Parquet | Yes | Analytics default — columnar, predicate pushdown |
| ORC | Yes | Hive-heavy legacy, best compression |
| Avro | Yes | Best schema evolution, streaming ingest |
| CSV / JSON | Yes / conditional | Landing zone only |

Compression: **Snappy** (fast, splittable-in-Parquet, default) · **ZSTD** (better ratio, modern default) · **GZIP** (not splittable standalone — kills parallelism) · **BZIP2** (rarely correct). Small-file fix: compact to **128 MB–1 GB**; partition on low-cardinality date columns, bucket high-cardinality IDs.

### Glue Data Catalog & Iceberg

| Topic | Recall |
|---|---|
| Glue Data Catalog | Central metadata (DB/table/partition); crawlers infer schema; **zero fine-grained security** |
| Apache Iceberg | ACID on S3 tables — row-level UPDATE/DELETE, MERGE/upsert, time travel via snapshots, schema evolution, **partition evolution with no rewrite**, hidden partitioning, optimistic concurrency for safe concurrent writers |
| Iceberg vs Hive | Hive = no ACID, rewrite whole partitions to update/delete, no time travel, unsafe concurrent writes. Iceberg fixes all of it — the default 2026 answer for "upsert/GDPR delete/time travel." |
| Compaction | `rewrite_data_files` / OPTIMIZE — rewrites small files into larger ones |

### Redshift

| Topic | Recall |
|---|---|
| RA3 + RMS | Compute/storage decoupled via Redshift Managed Storage |
| Redshift Serverless | RPU-based, scales to zero — unpredictable/spiky usage |
| Distribution — AUTO/KEY/EVEN/ALL | AUTO=least ops; KEY=big facts on join key; EVEN=no clear key; ALL=small dims only. Low-cardinality KEY **causes** skew. |
| Sort keys | Compound (default, leading filter col) vs Interleaved (unpredictable filters, costly `VACUUM REINDEX`) |
| Sort key vs dist key | Sort key → range-filter speed via zone maps. Dist key → join co-location. Not interchangeable. |
| COPY | Split into files, multiple of slice count, 1 MB–1 GB compressed each |
| WLM / concurrency scaling | Manual queues vs auto-WLM; concurrency scaling adds transient clusters at peak (1 free credit-hr/24h) |
| Spectrum | Query S3 from Redshift — **requires an existing cluster** |
| Data sharing | Live cross-cluster/cross-account sharing, no copy |
| VACUUM/ANALYZE | Reclaim space+resort / refresh stats — much now automatic |

### Athena, DynamoDB, other stores

| Topic | Recall |
|---|---|
| Athena | ~$5/TB scanned, workgroups=cost guardrails, CTAS materializes results, partition projection removes crawler dependency, ACID only via Iceberg, concurrency quota (~20–25 DML) |
| Athena vs Redshift | **Access pattern decides, not data location.** Occasional/exploratory → Athena. Constant/concurrent/complex joins → Redshift. |
| Athena vs Spectrum | Spectrum needs an existing cluster; pick it only when Redshift already exists and you're joining warehouse+S3 |
| DynamoDB | 400 KB item limit; GSI=own capacity/add anytime/eventually consistent; LSI=creation-time only/10 GB per key/can be strongly consistent; Streams=24h retention; TTL=free auto-delete; PITR=35-day; **export to S3 consumes no RCUs** (never Scan for analytics) |
| DAX | Microsecond DynamoDB read cache |
| Aurora/RDS | Operational/transactional source feeding pipelines |
| OpenSearch | Full-text search, log analytics, Kibana-style dashboards |

### Data modeling & lakehouse

| Topic | Recall |
|---|---|
| Star vs Snowflake | Denormalized/simple joins vs normalized dimensions/more joins |
| SCD 1 / 2 / 3 | Overwrite (no history) / new row per change (full history, most common) / extra column (limited history) |
| Normalization | OLTP favors it; analytics favors denormalization |
| Lakehouse | Bronze (raw) → Silver (cleaned/conformed) → Gold (business-ready). Iceberg is what makes the lake behave like a warehouse. |

---

## 3. DOMAIN 3 — Data Operations and Support (22%)

### Monitoring — one metric per service

| Service | Metric | Bad value means |
|---|---|---|
| Kinesis Data Streams | `GetRecords.IteratorAgeMilliseconds` | Consumers falling behind |
| Kinesis Data Streams | `WriteProvisionedThroughputExceeded` | Producers throttled |
| Amazon Data Firehose | `DeliveryToS3.Success`, `ThrottledRecords` | Delivery failing — check IAM/KMS |
| MSK | Consumer lag, `UnderReplicatedPartitions` | Consumer/broker unhealthy |
| Glue | `numFailedTasks`, DPU utilization | Skew, OOM, mis-sizing |
| Lambda | `Throttles`, `Duration`, `Errors` | Concurrency limit, timeout risk |
| Redshift | `WLMQueueLength`, `WLMQueueWaitTime` | Queries queuing |
| Athena | `DataScannedInBytes`, `QueryQueueTime` | Cost problem, concurrency limit |
| DynamoDB | `ThrottledRequests`, `ConsumedReadCapacityUnits` | Hot partition, under-provisioned |
| EMR | `YARNMemoryAvailablePercentage` | Cluster undersized |
| S3 | `4xxErrors`, `5xxErrors` | Permissions or throttling |

### Auditing & quality

| Topic | Recall |
|---|---|
| CloudWatch | "Is it healthy? How fast?" — metrics, logs, alarms, Logs Insights (SQL-like queries), composite alarms |
| CloudTrail management events | "Who changed this Glue job?" — API-level audit |
| CloudTrail data events | "Who read this object?" — object-level, **off by default, costs extra** |
| X-Ray | "Where is the latency?" — distributed tracing across services |
| AWS Config | "Is it configured correctly?" — compliance/config history |
| Glue Data Quality (DQDL) | Rule-based validation — completeness, uniqueness, freshness |
| DataBrew profiling | No-code dataset profiling, anomaly discovery |
| Macie vs Glue DQ | Macie = discovers sensitive data; DQ = validates business rules — classic distractor pair |

### Troubleshooting playbooks

| Symptom | First move |
|---|---|
| Glue OOM | Bigger worker (G.2X) or fix skew — **not** more workers |
| Kinesis hot shard | Better partition key distribution, or on-demand mode |
| Redshift queue backup | Concurrency scaling; review WLM |
| S3 403 | IAM → bucket policy → **KMS key policy** (most forgotten) → Lake Formation → SCP |
| Lake Formation denial | Check LF grant — it governs on top of IAM, not instead of it |
| Lambda throttling | Check concurrency/reserved concurrency limits |

### QuickSight & cost optimization

| Topic | Recall |
|---|---|
| SPICE vs direct query | Cached/fast, scheduled refresh vs always-live/slower |
| Row-level security | Per-user/team row filtering in dashboards |
| Universal cost answer | **Partition + Parquet + Compress + Compact** |
| Other levers | Spot on EMR task nodes · Glue Flex · Reserved Instances for steady Redshift/EMR · auto-pause/scale-to-zero (Redshift/Aurora Serverless) · Athena workgroup data limits · **S3 Bucket Keys** (up to 99% fewer KMS calls) · on-demand vs provisioned DynamoDB |

---

## 4. DOMAIN 4 — Data Security and Governance (18%)

### IAM policy evaluation order

```
1. Explicit DENY anywhere?           → DENY. Stop.
2. SCP (Organizations) allows it?    → If no, DENY.
3. Resource-based policy allows it?  → If yes, may ALLOW.
4. Within the permissions boundary?  → If no, DENY.
5. Session policy allows it?         → If no, DENY.
6. Identity-based policy allows it?  → If yes, ALLOW.
7. Otherwise                         → Implicit DENY.
```
**"Deny Stops Really Powerful Session Identities."**

### Lake Formation

| Topic | Recall |
|---|---|
| Core job | Permissions on top of the Catalog — DB/table/**column/row/cell** |
| IAM vs LF | IAM = bucket/prefix/API-action; LF = sub-table granularity. IAM cannot do column-level, period. |
| LF-Tags (TBAC) | Tag-based grants at scale — "thousands of tables" |
| Data filters | Named row/column/cell filters per principal |
| Cross-account sharing | Native + AWS RAM, no copy |
| Hybrid access mode | IAM and LF coexist during migration |

### Encryption

| Method | Key managed by | Cross-account | Use when |
|---|---|---|---|
| SSE-S3 | AWS | ❌ | Default, no compliance need, **no CloudTrail audit trail** |
| SSE-KMS (AWS-managed) | AWS | ❌ | Good default, audit trail exists |
| SSE-KMS (customer-managed / CMK) | You | ✅ | Compliance, audit, **cross-account required** |
| DSSE-KMS | You | ✅ | Double-encryption mandates |
| SSE-C | You entirely | — | Keys must live outside AWS |
| Client-side | You | — | Zero trust in provider |

Cross-account encrypted data access **requires a CMK** — AWS-managed keys can't be shared. S3 Bucket Keys cut KMS API costs up to 99%. In transit: TLS.

### Secrets, Macie, VPC endpoints, cross-account

| Topic | Recall |
|---|---|
| Secrets Manager | Automatic rotation (built-in for RDS/Redshift/DocumentDB), ~$0.40/secret/mo |
| Parameter Store | Free (Standard), no automatic rotation — cost-sensitive config |
| Tiebreaker | Rotation → Secrets Manager; cost → Parameter Store |
| Macie | Discovers/classifies PII in S3 |
| Gateway VPC endpoint | S3 + DynamoDB only, **free** |
| Interface VPC endpoint (PrivateLink) | Everything else, hourly + data charges |
| Cross-account patterns | Bucket policy (simple) · IAM role + `sts:AssumeRole` (temporary access) · AWS RAM (share resources) · LF sharing (governed catalog data) |

---

## 5. Master keyword → service scan (90 seconds, all domains)

```
near real-time ......... Firehose
real-time .............. Kinesis Data Streams
existing Kafka ......... MSK
replicate a database ... DMS (CDC)
Aurora/DynamoDB→RS ..... zero-ETL
ad-hoc SQL on S3 ....... Athena
BI at concurrency ...... Redshift
existing Spark .......... EMR (+Spot on TASK nodes)
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
who changed a resource . CloudTrail MANAGEMENT events
consumers behind ....... IteratorAge
orchestrate serverless . Step Functions
existing Airflow ....... MWAA
unknown access pattern . Intelligent-Tiering
known access pattern ... Lifecycle policy
slow gzipped CSV ....... convert to Parquet + partition
OOM in Glue ............ bigger worker (G.2X) or fix skew
queries queuing ......... concurrency scaling
Spot on all nodes ...... WRONG. Task nodes only.
analyze DynamoDB safely  export to S3, never Scan
add index after creation GSI (not LSI)
cross-account encrypted  customer-managed KMS key
sub-second key-value .... DynamoDB
tumbling window ......... Managed Service for Apache Flink
route by content ........ EventBridge
share w/o copying data .. Redshift data sharing / LF cross-account
```

---

## 6. Highest-yield traps — the 15 to not miss

1. "Near real-time" + least ops → **Firehose**, not Streams+Lambda.
2. Need replay/reprocessing → **Kinesis Data Streams**; Firehose has none, ever.
3. Shard math: compute **both** record-count and throughput, take the **larger**.
4. Reprocess ALL history → **reset** the Glue bookmark, don't just enable it.
5. Reduce EMR cost → Spot on **task nodes only**.
6. Data is in S3 ≠ Athena is right — **access pattern**, not location, decides Athena vs Redshift.
7. Millions of predictable partitions → **partition projection**, not more crawler runs.
8. DynamoDB analytics without app impact → **export to S3**, never Scan.
9. LSI cannot be added after table creation — use a **GSI**.
10. GDPR delete on a lake → **Iceberg** row-level DELETE, not a Hive partition rewrite.
11. Glue `AccessDenied` with correct IAM+bucket policy → check the **KMS key policy** first.
12. Cross-account encrypted sharing → needs a **customer-managed KMS key**, not AWS-managed.
13. "Who read this object" → **CloudTrail data events** (off by default), not management events.
14. "No additional cost" + private S3 access → **Gateway endpoint**, not Interface.
15. MWAA is *managed*, not *overhead-free* — never the default "least operational overhead" pick.

---

## 7. Mnemonics — full recap

| Mnemonic | For |
|---|---|
| SITS PG | Pipeline spine: Source → Ingest → Transform → Store → Present → Govern |
| F-R-E-D | Firehose (fire-and-forget) → Replay=Streams → Existing Kafka=MSK → Database=DMS/zero-ETL |
| KEA (the parrot) | Redshift distribution: KEY (big facts), EVEN (no key), ALL (small dims); AUTO for least ops |
| PACJ ("Pack J") | Format order: Parquet → Avro → CSV → JSON |
| Snappy is Speedy, GZIP is Greedy | Compression tradeoff |
| Sit In Glacier Deep | S3 ladder: Standard → Intelligent-Tiering → IA/One Zone-IA → Glacier Instant → Flexible → Deep Archive |
| Deny Stops Really Powerful Session Identities | IAM evaluation order |
| I Been Kicked Loose, Seriously | S3 403 order: IAM → Bucket → KMS → Lake Formation → SCP |
| SCROPS | Well-Architected pillars: Security, Cost, Reliability, Operational excellence, Performance, Sustainability |
| Macie finds All Confidential Information Everywhere | PII discovery vs rule validation |
| 34-26-22-18 | Domain weights — say it like a phone number |
| "Read the constraint before the options" | The exam-day mantra |

---

## 8. Final self-test — rapid fire across all domains (25)

| # | Question | Answer |
|---|---|---|
| 1 | Domain weights, in order? | 34 / 26 / 22 / 18 (Ingestion, Store Mgmt, Ops, Security) |
| 2 | Passing score? | 720 out of 1000 |
| 3 | Is scoring compensatory or per-domain minimum? | Compensatory — total score only |
| 4 | Firehose latency and replay capability? | ~60 s buffer, no replay ever |
| 5 | Shard math for 8,000 rec/s at 3 KB each? | 24 shards (throughput-bound, not record-count-bound) |
| 6 | DMS mode for minimal-downtime migration? | Full load + CDC |
| 7 | Zero-ETL supported sources? | Aurora MySQL/PostgreSQL, RDS MySQL, DynamoDB |
| 8 | Which EMR nodes can use Spot? | Task nodes only |
| 9 | Lambda's three hard ETL limits? | 15 min, 10,240 MB, 10 GB /tmp |
| 10 | Athena vs Redshift — what actually decides it? | Access pattern (concurrency, joins), not where the data sits |
| 11 | GSI vs LSI — which can be added after table creation? | GSI |
| 12 | What does DynamoDB export-to-S3 avoid consuming? | RCUs |
| 13 | What fixes Redshift skew from a low-cardinality DISTKEY? | Change distribution style (EVEN/AUTO or a higher-cardinality key) |
| 14 | Iceberg's answer to a GDPR deletion request? | Native row-level DELETE |
| 15 | First check on a Glue `AccessDenied` with correct IAM+bucket policy? | KMS key policy |
| 16 | Why can't AWS-managed KMS keys be shared cross-account? | Their key policy is not editable by you |
| 17 | Which CloudTrail event type is billed extra and off by default? | Data events |
| 18 | Gateway endpoint covers which two services, and at what cost? | S3 and DynamoDB, free |
| 19 | Tiebreaker between Secrets Manager and Parameter Store? | Rotation needed → Secrets Manager; cost-sensitive → Parameter Store |
| 20 | Is MWAA ever the "least operational overhead" answer? | No — it's always-on and you own its sizing/patching |
| 21 | What's the difference between a data lineage need and a data catalog need? | Lineage = where data came from and how it changed; catalog = what the data is and where it lives now |
| 22 | Redshift Reserved Instances vs Serverless — which wins for steady 24/7 load? | Reserved Instances (up to ~75% off) |
| 23 | What single change turns a Hive-style table into one that supports MERGE and time travel? | Convert it to an Apache Iceberg table |
| 24 | Two things AWS almost never wants you to pick when a managed service exists? | "Write a custom application" and self-managed clusters/servers |
| 25 | The exam-day mantra, in one sentence? | Read the constraint before the options |

---

## 9. If you only have 10 minutes left

Read, in this order: the domain-weight bar in Section 0, the Master
keyword scan (Section 5), the 15 highest-yield traps (Section 6). Skip
everything else. You already know it — this is retrieval practice, not
new learning. Stop reading by the time in your logistics block above.
Go eat something.
