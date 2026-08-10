# Revision — Day 5 (cumulative: Days 1–5)

> Rapid-recall checkpoint, not a teaching doc. Days 1–2 are compressed
> hard (third review by now); Day 3 gets a medium pass; Days 4–5 get
> full treatment. This is also the plan's official review day —
> re-attempt every practice question you've gotten wrong so far before
> you rely on this sheet alone.

---

## 1. Rapid recall — by day

### Days 1–2 recap — Storage + Streaming (heavily compressed)

| Topic | Recall |
|---|---|
| S3 unknown pattern → | Intelligent-Tiering; known pattern → Lifecycle |
| Archive tiers, retrieval time | Instant Retrieval (ms) → Flexible (mins–hrs) → Deep Archive (12–48 h) |
| Min durations | IA 30 d, Glacier 90 d, Deep Archive 180 d |
| Analytics format/compression default | Parquet + Snappy; GZIP standalone not splittable |
| Small-file fix | Compact to 128 MB–1 GB; partition on low-cardinality date columns |
| Glue Catalog | Metadata only, no column security (that's Lake Formation) |
| Iceberg | ACID on S3: row-level delete, time travel, safe concurrent writes |
| Firehose | ~60 s buffer, **no replay**, one destination, least ops |
| Kinesis Data Streams | 1 MB/s or 1,000 rec/s per shard; replay via retention; `IteratorAge` = consumer lag |
| Enhanced fan-out | Dedicated 2 MB/s per consumer |
| MSK | Only when Kafka already exists |
| DMS | Full load = one-time; +CDC = minimal downtime; schemas are SCT's job, not DMS's |
| Zero-ETL | Aurora/RDS MySQL/DynamoDB → Redshift/OpenSearch, no pipeline |
| SQS vs SNS vs EventBridge | FIFO order vs Standard throughput; SNS = simple fan-out; EventBridge = content-routing |

### Day 3 recap — Transformation (medium)

| Topic | Recall |
|---|---|
| Glue job bookmarks | Incremental; **reset** to reprocess history |
| Glue worker types | G.1X default → G.2X first OOM fix → G.4X/G.8X big joins/shuffles |
| Glue Flex | Cheaper, variable start, non-urgent jobs only |
| DataBrew | No-code, business analysts |
| EMR Spot rule | Task nodes only — never primary, risky on core |
| EMR Serverless | Spark/Hive, no cluster ops |
| Managed Flink | Windowed aggregation, exactly-once, "tumbling window" trigger |
| Lambda ETL limits | 15 min / 10,240 MB / 10 GB `/tmp` |
| Data skew fix | Repartition/salt, not more workers |
| Partition pruning / predicate pushdown | Skip partitions / filter at storage layer before reading into memory |

### Day 4 — Orchestration + Programming Concepts

**Step Functions**

| Topic | Recall |
|---|---|
| Standard | Up to 1 year duration, **exactly-once**, billed per state transition, 90-day execution history |
| Express | Up to 5 minutes, **at-least-once**, billed on requests+duration — cheap at high volume |
| Map state | Iterate over a collection |
| Distributed Map | Parallelize up to 10,000 items (e.g., S3 objects) |
| Error handling | Retry with exponential backoff, Catch blocks |
| Integrations | 200+ native AWS service integrations |

**MWAA**

| Topic | Recall |
|---|---|
| What it is | Managed Apache Airflow |
| When it wins | Existing Airflow DAGs, complex Python dependencies |
| Cost trap | **Never** the "least operational overhead" answer — always-on environment you size, pay for, patch |

**EventBridge & Glue orchestration**

| Topic | Recall |
|---|---|
| EventBridge rules | Content-based filtering and routing |
| EventBridge Scheduler | Cron replacement — "run daily at 02:00, cheapest" |
| Pipes | Point-to-point event integration with filtering/enrichment |
| Glue Workflows | Chain Glue jobs/crawlers only, free, limited to Glue-only pipelines |
| S3 Event Notification | Triggers Lambda/SQS/EventBridge when an object lands |

**Idempotency & reliability**

| Topic | Recall |
|---|---|
| Idempotency | Same operation applied twice has the same effect as once (dedup key, conditional write) |
| At-least-once + retries | **Guarantees duplicates** unless the consumer is idempotent |
| Exactly-once | Step Functions Standard, Managed Flink checkpointing |
| DLQ | Captures poison messages after max retries so the pipeline doesn't stall |
| Fix for "retries are creating duplicates" | Make the operation idempotent — not "reduce retry count" |

**CI/CD & programming**

| Topic | Recall |
|---|---|
| IaC options | CloudFormation, CDK, SAM |
| Version control | Git integration for pipeline code |
| SQL AWS expects | Window functions, CTEs, joins — conceptual fluency, not syntax memorization |
| Distributed computing basics | Partitioning, shuffles, parallelism trade-offs |

### Day 5 — Redshift deep dive

| Topic | Recall |
|---|---|
| RA3 nodes | Compute/storage decoupled via Redshift Managed Storage (RMS) |
| Redshift Serverless | RPU-based, no capacity planning, scales to zero — for unpredictable usage |
| Distribution — AUTO | Redshift decides (ALL→EVEN as table grows) — "least operational overhead" answer |
| Distribution — KEY | Rows with same key land on same slice — large fact table joined on that key |
| Distribution — EVEN | Round-robin — no clear join key |
| Distribution — ALL | Full copy on every node — **small dimension tables only** |
| DISTKEY trap | Low-cardinality DISTKEY *causes* skew, doesn't fix it |
| Sort key — compound (default) | Filters usually lead with the same column; most cases |
| Sort key — interleaved | Filters hit different columns unpredictably; expensive to maintain (`VACUUM REINDEX`) |
| Zone maps | Sort keys accelerate range filters via zone maps; DISTKEY accelerates joins — not interchangeable |
| COPY best practice | Split into files ≈ multiple of slice count, each 1 MB–1 GB compressed |
| UNLOAD | Parallel export from Redshift to S3 |
| WLM vs auto-WLM | Manual queue config vs Redshift-managed queues |
| Concurrency scaling | Adds transient clusters at peak; 1 free hour of credit per 24 h per cluster |
| Short query acceleration (SQA) | Prioritizes short queries ahead of long-running ones |
| Materialized views | Precomputed query results, auto or manual refresh |
| Redshift Spectrum | Query S3 from Redshift — **requires an existing cluster** |
| Data sharing | Share live data cross-cluster/cross-account without copying |
| Zero-ETL landing | Aurora/RDS/DynamoDB land directly in Redshift, seconds of lag |
| VACUUM / ANALYZE | Reclaim space + resort rows / refresh statistics — much of this is now automatic |
| RA3 node sizes | ra3.xlplus → ra3.4xlarge → ra3.16xlarge — scale compute independently of the fixed RMS storage layer |
| Materialized view refresh | Manual or automatic; auto-refresh keeps it current without a scheduled job |
| Reserved Instances | Up to ~75% off provisioned node-hours for steady, predictable workloads — the tiebreaker vs Serverless |
| Federated query (Redshift) | Query RDS/Aurora directly from Redshift without moving the data first |
| Redshift Advisor | Built-in recommendations (distribution/sort key changes, WLM tuning) — "least-effort way to find optimization opportunities" |
| Auto-WLM query queue slots | Redshift dynamically allocates memory/concurrency per query instead of fixed manual slots |

---

## 2. Keyword → service trigger table

| Trigger phrase | Answer |
|---|---|
| Serverless workflow, branching, retries | Step Functions |
| Millions of short executions per second | Step Functions Express |
| Long-running workflow, up to a year | Step Functions Standard |
| Process 10,000 S3 objects in parallel | Step Functions Distributed Map |
| Existing Airflow DAGs | MWAA |
| Complex Python dependencies in orchestrator | MWAA |
| Chain Glue jobs and crawlers only | Glue Workflows (free) |
| Run daily at 02:00 UTC, cheapest | EventBridge Scheduler |
| Retries creating duplicate records | Make the operation idempotent |
| Handle poison messages | Dead-letter queue (DLQ) |
| Hundreds of BI users, dashboards, complex joins | Amazon Redshift |
| Sub-second BI query response | Redshift |
| Unpredictable/intermittent warehouse usage | Redshift Serverless |
| Join warehouse tables with S3 archive | Redshift Spectrum (only if cluster exists) |
| Share data cross-account, no copy | Redshift data sharing |
| Queries queuing during business hours | Concurrency scaling |
| Improve join performance, large fact table | DISTSTYLE KEY on the join column |
| Improve join performance, small dimension table | DISTSTYLE ALL |
| Queries filtering on a date range are slow | Add/change the sort key, not the distribution key |
| Loading one 500 GB file takes hours | Split into multiple files, multiple of slice count |

---

## 3. Top exam traps — Days 1–5 scope

1. **Setup:** "Orchestrate a pipeline with the least operational overhead." → **Wrong:** MWAA. → **Right:** Step Functions. MWAA runs an always-on environment you size and patch — it wins only with existing Airflow DAGs.
2. **Setup:** "Process 10 million short events per day through a workflow." → **Wrong:** Step Functions Standard. → **Right:** Express. Standard bills per state transition — enormous at that volume.
3. **Setup:** "Table distributed on `country_code`, some nodes much busier." → **Wrong:** add more nodes. → **Right:** change the distribution style — low-cardinality DISTKEY *is* the cause of the skew.
4. **Setup:** "Improve join performance on a 2 TB fact table." → **Wrong:** DISTSTYLE ALL. → **Right:** DISTSTYLE KEY on the join column. ALL replicates the entire table to every node — fine for small dims, disastrous for large facts.
5. **Setup:** "Queries always filter on `customer_id` first — pick a sort key." → **Wrong:** interleaved sort key. → **Right:** compound sort key with `customer_id` leading. Interleaved is for unpredictable filter patterns and carries expensive maintenance.

---

## 4. Mnemonics recap

| Mnemonic | For |
|---|---|
| **KEA** (like the parrot) | Redshift distribution: KEY (big facts), EVEN (no clear key), ALL (small dims) — plus AUTO for "least ops" |
| **Step Functions = flowchart AWS draws and retries for you** | Standard/Express core identity |
| **MWAA = Managed Workflows, Already Airflow** | Bring your existing DAGs — not a "least ops" default |
| **Red = fast; a warehouse with the lights always on** | Redshift's always-provisioned cost model (unless Serverless) |
| **Spectrum = Redshift's telescope** | Looks *out* at S3 without moving data — needs the cluster to exist first |
| **F-R-E-D** (carried over) | Firehose / Replay=Streams / Existing Kafka=MSK / Database=DMS-zeroETL |

---

## 5. Self-test — rapid fire (17)

| # | Question | Answer |
|---|---|---|
| 1 | Step Functions Standard max duration? | 1 year |
| 2 | Step Functions Express max duration and semantics? | 5 minutes, at-least-once |
| 3 | Is MWAA ever the "least operational overhead" answer? | No — always-on environment |
| 4 | What guarantees duplicates without a fix? | At-least-once delivery + retries, unless idempotent |
| 5 | Cheapest way to chain only Glue jobs/crawlers? | Glue Workflows |
| 6 | Redshift distribution style for a small dimension table? | ALL |
| 7 | What causes skew when DISTKEY is on a low-cardinality column? | Few distinct values → few slices do all the work |
| 8 | Sort key accelerates what kind of query? | Range filters, via zone maps |
| 9 | Does Spectrum require a Redshift cluster? | Yes, always |
| 10 | Fix for queries queuing at peak hours? | Concurrency scaling |
| 11 | COPY best practice for file count? | Multiple of the slice count, 1 MB–1 GB each |
| 12 | Redshift option for unpredictable/spiky usage? | Redshift Serverless |
| 13 | What replaces manual DMS+Glue pipelines from Aurora to Redshift? | Zero-ETL integration |
| 14 | Interleaved vs compound sort key — which is default and cheaper to maintain? | Compound |
| 15 | Distributed Map's parallel item limit? | 10,000 |
| 16 | Reserved Instances save roughly how much over on-demand node-hours? | Up to ~75% |
| 17 | How do you query Aurora/RDS directly from Redshift without copying data? | Redshift federated query |
