# Revision — Day 7 (cumulative: Days 1–7)

> Rapid-recall checkpoint, not a teaching doc. Days 1–3 are collapsed
> into one dense table; Days 4–5 get a medium pass; Days 6–7 (freshest)
> get full treatment. Domain 3 (Operations) is now fully covered —
> this is the first sheet where all of Domains 1–3 are represented.

---

## 1. Rapid recall — by day

### Days 1–3 recap — Storage, Streaming, Transformation (heavily compressed)

| Topic | Recall |
|---|---|
| S3 classes | Standard → Intelligent-Tiering (unknown pattern) → IA (known, 30 d min) → Glacier IR/Flex/Deep (90/90/180 d min) |
| Object Lock | Governance = overridable by privileged users; Compliance = nobody, ever |
| Formats | Parquet/ORC columnar+splittable; Avro best schema evolution; CSV/JSON landing only |
| Compression | Snappy = fast+splittable-in-Parquet default; GZIP standalone = not splittable |
| Small files | Compact to 128 MB–1 GB; partition low-cardinality date columns, bucket high-cardinality IDs |
| Glue Catalog | Metadata + crawlers; no column security |
| Iceberg (intro) | ACID on S3: row-level delete, time travel, safe concurrent writes |
| Firehose | ~60 s buffer, no replay, one destination |
| Kinesis Data Streams | 1 MB/s or 1,000 rec/s per shard; `IteratorAge` = consumer lag; EFO = dedicated 2 MB/s/consumer |
| MSK | Only when Kafka already exists |
| DMS | Full load = one-time; +CDC = minimal downtime; SCT handles schema/procs |
| Zero-ETL | Aurora/RDS-MySQL/DynamoDB → Redshift/OpenSearch, no pipeline |
| SQS/SNS/EventBridge | FIFO order vs Standard throughput; SNS simple fan-out; EventBridge content-routing |
| Glue ETL | Job bookmarks = incremental; reset to reprocess; G.1X→G.8X worker ladder; Flex = cheap, non-urgent |
| EMR | Spot on task nodes only; EMR Serverless = no cluster ops; has Hive/Presto/HBase Glue lacks |
| Managed Flink | Windowed aggregation, exactly-once |
| Lambda ETL | 15 min / 10,240 MB / 10 GB `/tmp` |
| Skew / pruning / pushdown | Repartition to fix skew; pruning skips partitions; pushdown filters at storage layer |

### Days 4–5 recap — Orchestration, Redshift (medium)

| Topic | Recall |
|---|---|
| Step Functions Standard | 1 year max, exactly-once, per-state-transition billing |
| Step Functions Express | 5 min max, at-least-once, cheap at high volume |
| MWAA | Never "least ops" — always-on; wins only with existing Airflow DAGs |
| Glue Workflows | Free, Glue-jobs-and-crawlers only |
| EventBridge Scheduler | Cron replacement |
| Idempotency | Fixes duplicate-record problems caused by at-least-once + retries |
| DLQ | Catches poison messages |
| Redshift distribution | AUTO (least ops) / KEY (big facts) / EVEN (no clear key) / ALL (small dims) |
| Sort keys | Compound (default, leading filter column) vs Interleaved (unpredictable filters, costly maintenance) |
| Redshift Serverless | RPU-based, scales to zero, unpredictable usage |
| Spectrum | Requires an existing cluster |
| Concurrency scaling | Transient clusters at peak, 1 free credit-hour/24h |
| COPY | Split files to a multiple of slice count, 1 MB–1 GB each |

### Day 6 — Athena, DynamoDB, Modeling, Lakehouse

**Athena**

| Topic | Recall |
|---|---|
| Engine | Athena engine v3 (Trino/Presto-based) |
| Workgroups | Cost guardrails — per-query/per-workgroup data scan limits |
| CTAS | Create Table As Select — materializes query results, pay once query cheap after |
| UNLOAD | Export query results to S3 in a chosen format |
| Federated query | Query non-S3 sources (RDS, DynamoDB) via Lambda connectors |
| Partition projection | Computes partition locations from a pattern — no crawler, no catalog lookup latency |
| ACID / updates | Only via Iceberg tables — plain Hive-style Athena tables are read-only-ish |
| Concurrency | Quota-limited (~20–25 DML) — degrades under sustained dashboard load |
| Cost | ~$5 per TB scanned, 10 MB minimum per query |

**DynamoDB**

| Topic | Recall |
|---|---|
| Item size limit | 400 KB |
| RCU | 1 strongly consistent read of 4 KB/s (2 eventually consistent) |
| WCU | 1 write of 1 KB/s |
| GSI | Different partition key, own capacity, eventually consistent only, **add anytime** |
| LSI | Same partition key, different sort key, **must exist at table creation**, 10 GB per partition key |
| Streams | 24 h retention, triggers Lambda, ordered per item |
| TTL | Auto-deletes expired items, free, appears in Streams |
| PITR | 35-day continuous backup |
| Export to S3 | **Consumes no RCUs** — the answer for "analyze without affecting the app" |
| DAX | Microsecond read cache, DynamoDB only |
| Capacity modes | On-demand (spiky) vs provisioned+autoscale (steady) |

**Aurora/RDS & OpenSearch**

| Topic | Recall |
|---|---|
| Aurora/RDS role here | Operational/transactional source feeding pipelines, not the analytics target |
| OpenSearch | Full-text search, log analytics, Kibana-style dashboards |

**Data modeling**

| Topic | Recall |
|---|---|
| Star schema | One fact table + denormalized dimension tables — simpler, faster joins |
| Snowflake schema | Dimensions further normalized into sub-dimensions — less redundancy, more joins |
| SCD Type 1 | Overwrite — no history kept |
| SCD Type 2 | New row per change — full history, most common for analytics |
| SCD Type 3 | Add a column for "previous value" — limited history |
| Normalization vs denormalization | OLTP favors normalization; analytics favors denormalization (fewer joins) |

**Iceberg — deep dive**

| Topic | Recall |
|---|---|
| Snapshots | Every write creates a new snapshot — the basis for time travel |
| Time travel | Query the table as of a past snapshot/timestamp |
| Compaction | Rewrites small files into larger ones (`rewrite_data_files` / OPTIMIZE) |
| Row-level deletes | Native DELETE — no partition rewrite required |
| Schema evolution | Add/drop/rename/reorder columns safely |
| Hidden partitioning | Users query by timestamp; Iceberg manages the physical partition scheme itself |
| Partition evolution | Change partitioning scheme (day→hour) with **no rewrite of existing data** |
| Concurrent writers | Optimistic concurrency — safe simultaneous writes |

**Lakehouse**

| Topic | Recall |
|---|---|
| Bronze | Raw, ingested as-is |
| Silver | Cleaned, validated, conformed |
| Gold | Aggregated, business-ready, consumption layer |
| Why Iceberg matters here | Gives the lake ACID + schema evolution so it behaves like a warehouse |

### Day 7 — Operations, Monitoring, Data Quality, Cost

**CloudWatch**

| Service | Signature metric | Bad value means |
|---|---|---|
| Kinesis Data Streams | `GetRecords.IteratorAgeMilliseconds` | Consumers falling behind |
| Kinesis Data Streams | `WriteProvisionedThroughputExceeded` | Producers throttled |
| Amazon Data Firehose | `DeliveryToS3.Success`, `ThrottledRecords` | Delivery failing — check IAM/KMS |
| MSK | Consumer lag, `UnderReplicatedPartitions` | Consumers behind / broker unhealthy |
| Glue | `numFailedTasks`, DPU utilization | Skew, OOM, mis-sizing |
| Lambda | `Throttles`, `Duration`, `Errors`, `IteratorAge` | Concurrency limit, timeout risk |
| Redshift | `WLMQueueLength`, `WLMQueueWaitTime` | Queries queuing |
| Athena | `DataScannedInBytes`, `QueryQueueTime` | Cost problem, concurrency limit |
| DynamoDB | `ThrottledRequests`, `ConsumedReadCapacityUnits` | Hot partition / under-provisioned |
| EMR | `YARNMemoryAvailablePercentage`, `ContainerPending` | Cluster undersized |
| S3 | `4xxErrors`, `5xxErrors`, `FirstByteLatency` | Permissions or throttling |

**CloudWatch Logs, CloudTrail, X-Ray**

| Topic | Recall |
|---|---|
| Logs Insights | SQL-like queries over CloudWatch Logs |
| Alarms | Threshold-based; composite alarms combine multiple alarm states |
| CloudTrail management events | API-level audit — "who changed this Glue job" |
| CloudTrail data events | Object-level `GetObject`/`PutObject` — **off by default, cost extra** — "who read this object" |
| X-Ray | Distributed tracing — "identify a bottleneck across services" |

**Data quality**

| Topic | Recall |
|---|---|
| Glue Data Quality (DQDL) | Rule-based validation: completeness, uniqueness, freshness, custom rules |
| DataBrew profiling | No-code dataset profiling, finds anomalies |
| Macie vs Glue Data Quality | Macie discovers **sensitive data**; DQ validates **business rules** — different jobs, common distractor pair |

**Troubleshooting playbooks (first move each time)**

| Symptom | First check |
|---|---|
| Glue job OOM | Bigger worker type (G.2X) or fix data skew, not more workers |
| Kinesis hot shard | Better partition key distribution, or on-demand mode |
| Redshift queue backup | Enable concurrency scaling; check WLM queue config |
| S3 403 error | IAM → bucket policy → **KMS key policy** → Lake Formation → SCP (KMS is most forgotten) |
| Lake Formation access denial | Check LF permissions grant, not just IAM — LF governs on top of IAM |
| Lambda throttling | Check concurrency limits/reserved concurrency, not just code |

**QuickSight**

| Topic | Recall |
|---|---|
| SPICE | In-memory cache — fast, scheduled/manual refresh |
| Direct query | Always-live, slower, hits the source each time |
| Row-level security | Each manager/user sees only their own rows |

**Cost optimization**

| Lever | Applies to |
|---|---|
| Compression + partitioning + Parquet + compaction | Athena/S3 cost — the universal analytics cost answer |
| Spot on task nodes | EMR |
| Glue Flex | Non-urgent Glue jobs |
| Reserved Instances | Steady-state Redshift provisioned / EMR |
| Auto-pause / scale-to-zero | Redshift Serverless, Aurora Serverless v2 |
| Athena workgroup data limits | Prevent runaway scan costs |
| S3 Bucket Keys | Reduce KMS API costs up to 99% |
| On-demand vs provisioned | DynamoDB — spiky vs steady traffic |

---

## 2. Keyword → service trigger table

| Trigger phrase | Answer |
|---|---|
| Ad-hoc SQL, pay per query | Athena |
| Hundreds of BI users, dashboards | Redshift |
| Millions of partitions, avoid crawler cost | Athena partition projection |
| Query RDS/DynamoDB from Athena | Athena Federated Query |
| Sub-millisecond key-value at massive scale | DynamoDB |
| Add a secondary index after table creation | GSI (LSI is creation-time only) |
| Analyze DynamoDB data without impacting the app | Export to S3, then Athena — never Scan |
| Full-text search, log analytics, Kibana | OpenSearch Service |
| GDPR right-to-be-forgotten on a data lake | Iceberg row-level delete |
| Millions of req/sec, sub-ms reads | DynamoDB |
| Who read this object and when | CloudTrail data events |
| Who changed this Glue job | CloudTrail management events |
| Alert when a Glue job fails | EventBridge rule → SNS |
| Validate completeness/uniqueness/freshness | Glue Data Quality (DQDL) |
| Find PII in S3 buckets | Amazon Macie |
| Profile a dataset, no code | Glue DataBrew profiling |
| Trace a request across services | AWS X-Ray |
| Dashboards for business users, in-memory | QuickSight + SPICE |
| Each manager sees only their team's rows | QuickSight row-level security |
| Consumers falling behind the stream | `IteratorAge` rising |

---

## 3. Top exam traps — Days 1–7 scope

1. **Setup:** "Data is in S3. 500 analysts run dashboards continuously." → **Wrong:** Athena (the data's in S3!). → **Right:** Redshift. Data location doesn't decide the query engine — access pattern does; Athena has a concurrency quota.
2. **Setup:** "Table has millions of date-based partitions, crawler runs slow/expensive." → **Wrong:** run the crawler more often. → **Right:** Athena partition projection — eliminates catalog lookups entirely.
3. **Setup:** "Run analytics on DynamoDB data without impacting the app." → **Wrong:** scheduled Scan into S3. → **Right:** DynamoDB export to S3 (consumes no RCUs), then Athena.
4. **Setup:** "Add a local secondary index to an existing table." → **Wrong:** create the LSI. → **Right:** you can't — LSIs are creation-time only; use a GSI or recreate the table.
5. **Setup:** "Glue job gets `AccessDenied` on S3; IAM role has `s3:GetObject`, bucket policy allows it." → **Wrong:** add more S3 permissions. → **Right:** grant `kms:Decrypt` in the **KMS key policy** — the most-forgotten step for SSE-KMS objects.

---

## 4. Mnemonics recap

| Mnemonic | For |
|---|---|
| **Athena = Goddess of wisdom, asks questions, owns nothing** | Ad-hoc SQL, no infrastructure |
| **Iceberg = most of it is under the surface** | Snapshots, history, time travel (deep dive now, not just intro) |
| **"I Been Kicked Loose, Seriously"** | S3 403 troubleshooting order: IAM → Bucket policy → KMS key policy → Lake Formation → SCP |
| **Macie finds All Confidential Information Everywhere** | PII discovery vs Glue Data Quality's rule validation |
| **Data location does not decide the engine — access pattern does** | Athena vs Redshift core lesson |

---

## 5. Self-test — rapid fire (15)

| # | Question | Answer |
|---|---|---|
| 1 | Why is Athena wrong for 500 concurrent dashboard users? | Concurrency quota — access pattern beats data location |
| 2 | Fix for millions of predictable date-based partitions? | Athena partition projection |
| 3 | Can you create an LSI after table creation? | No — creation-time only |
| 4 | Right way to analyze DynamoDB data without app impact? | Export to S3 (no RCUs), then Athena |
| 5 | Iceberg mechanism behind time travel? | Snapshots |
| 6 | SCD type that keeps full history via new rows? | Type 2 |
| 7 | Lakehouse layer that's business-ready and aggregated? | Gold |
| 8 | `IteratorAge` metric belongs to which service? | Kinesis Data Streams |
| 9 | Which CloudTrail event type is off by default and costs extra? | Data events |
| 10 | First check on a Glue job `AccessDenied` for SSE-KMS objects? | KMS key policy grants `kms:Decrypt` |
| 11 | Macie's job vs Glue Data Quality's job? | Macie finds sensitive data; DQ validates business rules |
| 12 | SPICE vs direct query in QuickSight? | SPICE = cached/fast; direct query = live/slower |
| 13 | Cheapest fix for small-file Athena slowness caused by Firehose? | Increase Firehose buffer size (or compact after the fact if files already exist) |
| 14 | What reduces KMS API cost on S3 by up to 99%? | S3 Bucket Keys |
| 15 | Redshift metric indicating queries are backing up? | `WLMQueueLength` / `WLMQueueWaitTime` |
