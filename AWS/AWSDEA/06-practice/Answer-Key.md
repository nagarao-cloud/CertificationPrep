# Answer Key — Full Mock Exam 1

> Score yourself here first. For the full reasoning behind every option —
> right and wrong — go to `Explanations.md`. Domain labels below use:
> **D1** = Data Ingestion and Transformation (34%) · **D2** = Data Store
> Management (26%) · **D3** = Data Operations and Support (22%) ·
> **D4** = Data Security and Governance (18%).

## Answer table

| Q | Domain | Answer | Why (one line) |
|---|---|---|---|
| 1 | D1 | C | On-demand mode auto-scales past the 15 MB/s need; no manual shard math |
| 2 | D2 | C | Low-cardinality DISTKEY *causes* skew — use higher-cardinality key or AUTO |
| 3 | D3 | B | `IteratorAge` rising = consumer is behind, not the producer |
| 4 | D1 | B, C | Retention enables replay; enhanced fan-out gives each consumer full throughput |
| 5 | D4 | B | Column-level security on cataloged data is Lake Formation-only |
| 6 | D2 | B | Predictable scheme + millions of partitions = partition projection |
| 7 | D1 | B | "Near real-time" + least overhead = Firehose + dynamic partitioning |
| 8 | D3 | B | Automated null/uniqueness/range checks with a fail gate = Glue DQDL |
| 9 | D2 | C | Known pattern rules out Intelligent-Tiering; hours-notice rules out Deep Archive |
| 10 | D1 | B | DMS Schema Conversion for schema/code; DMS full load + CDC for minimal-downtime data |
| 11 | D4 | B | SSE-KMS needs both S3 permissions *and* a KMS key policy grant |
| 12 | D2 | A, C | GSI added anytime (eventual); LSI must exist at creation (strong consistency) |
| 13 | D3 | B | Object-level reads are data events — off by default |
| 14 | D1 | C | Aurora MySQL → Redshift, no pipeline, is the textbook zero-ETL case |
| 15 | D1 | B | Reprocessing history requires *resetting*, not enabling, the bookmark |
| 16 | D4 | B | No rotation + cost-sensitive = Parameter Store Standard (free) |
| 17 | D1 | B | Spot on task nodes only; primary/core stay On-Demand |
| 18 | D3 | B | OOM without skew = per-executor memory problem; upsize the worker |
| 19 | D2 | A, C | Bursty/idle → Serverless; steady 24/7 → provisioned + RIs |
| 20 | D1 | B | 25 minutes exceeds Lambda's 15-minute ceiling |
| 21 | D4 | B | Discovering unknown PII across many buckets is exactly what Macie does |
| 22 | D2 | B | Time travel + safe schema evolution = Apache Iceberg |
| 23 | D1 | C | Real-time rolling-window aggregation is Managed Flink's specialty |
| 24 | D3 | B | High concurrency, fast dashboards, no warehouse hit = QuickSight + SPICE + RLS |
| 25 | D1 | B | "Business analysts, no code" is the DataBrew trigger phrase |
| 26 | D1 | B | Millions of short daily executions favors Express over Standard's per-transition cost |
| 27 | D4 | A, B | Cross-account KMS-encrypted access needs a resource grant *and* a key-policy grant |
| 28 | D3 | B | SQL-like ad hoc log querying built into CloudWatch is Logs Insights |
| 29 | D2 | B | Automatic Iceberg maintenance, least overhead = Amazon S3 Tables |
| 30 | D1 | B | Existing Airflow DAGs + custom Python deps point to MWAA, not a rewrite |
| 31 | D2 | B | Export-to-S3 consumes no RCUs; `Scan` does |
| 32 | D4 | B | Free, private S3 access from a VPC is a gateway endpoint |
| 33 | D1 | B | Content-based routing to multiple filtered targets is EventBridge's job |
| 34 | D3 | B, C | Transient concurrency scaling + tuned WLM handle a brief predictable spike |
| 35 | D2 | B | Redshift already exists and needs to join S3 data — Spectrum's exact use case |
| 36 | D1 | B | Licensed third-party dataset, no custom pipeline = AWS Data Exchange |
| 37 | D4 | B | An explicit deny anywhere, including an SCP, always wins |
| 38 | D2 | A | Kibana-style full-text search and log analytics = OpenSearch Service |
| 39 | D3 | B | Pinpointing latency across a distributed request chain is X-Ray's purpose |
| 40 | D1 | B | Existing Kafka + Kafka Connect, unchanged = MSK + MSK Connect |
| 41 | D2 | A, B | Slice-aligned file count + 1 MB–1 GB files parallelize `COPY` |
| 42 | D1 | B | Keep using Spark, no cluster ops, pay only while running = EMR Serverless |
| 43 | D4 | B | Sensitivity-based access across thousands of tables = LF-Tags (TBAC) |
| 44 | D3 | B | Exploratory, no-code profiling before rules exist = DataBrew profiling |
| 45 | D3 | B | Guardrail against runaway scan cost without losing self-service = workgroup limit |
| 46 | D1 | B | Daily batch data doesn't justify Glue Streaming's continuous billing |
| 47 | D2 | B | Microsecond reads with minimal app changes = DAX |
| 48 | D4 | B | Org-wide, unbypassable guardrail is an SCP, not per-role IAM policies |
| 49 | D1 | B | At-least-once + retries guarantees duplicates; fix with idempotency, not fewer retries |
| 50 | D3 | A, B | Hot shard from an uneven key: split the hot shard *and* add key entropy |
| 51 | D2 | B | Same-day retrieval rules out Deep Archive; use Flexible Retrieval's expedited tier |
| 52 | D1 | B | Inconsistent, drifting partner schemas are exactly what `resolveChoice` handles |
| 53 | D4 | B | True WORM against every principal, including root, is Object Lock compliance mode |
| 54 | D2 | B | Same daily 30-minute spike pattern — transient concurrency scaling, not a resize |
| 55 | D3 | B | Glue emits job state-change events; route FAILED to SNS via EventBridge |
| 56 | D1 | B | 400 TB over limited/unreliable bandwidth is the classic Snowball Edge case |
| 57 | D2 | C | LSIs can only be created at table creation; recreate the table to get one |
| 58 | D1 | A, B | Distributed Map iterates S3 objects with built-in per-item retry/catch |
| 59 | D4 | C | A mandate for two independent encryption layers is DSSE-KMS by definition |
| 60 | D3 | B | Native per-step Retry with backoff + Catch for escalation is Step Functions' job |
| 61 | D2 | B | Natural-language Q&A over enterprise documents is Kendra, not a search index |
| 62 | D1 | A | An in-IDE AI coding assistant for AWS code is Amazon Q Developer |
| 63 | D4 | B | Row-level, no-copy cross-account sharing of cataloged data = Lake Formation + RAM |
| 64 | D3 | A, B | Hot partition from popular items: add key entropy *and* cache with DAX |
| 65 | D2 | C | Broad native AWS support without Databricks lock-in = Apache Iceberg |

---

## Scoring guide

The real exam scales your raw score to 100–1000, with **720 as passing**
(roughly 70–75% correct). This mock doesn't have AWS's scaling formula, but
raw percentage is a reliable proxy at this question count.

| Raw score | Approx. % | Read as | What to do |
|---|---|---|---|
| **52–65 / 65** | 80–100% | Comfortably passing | Do a light final review of anything you missed; you're ready. |
| **46–51 / 65** | 71–78% | Passing, but thin | Review every miss in `Explanations.md`. Re-drill your single weakest domain below. |
| **39–45 / 65** | 60–69% | Borderline — likely failing | You have real gaps. Identify your two weakest domains below and spend a full study block re-reading those domain files before your next mock. |
| **Below 39 / 65** | <60% | Not ready | Don't schedule the real exam yet. Go back through `00-START-HERE/SERVICE-SELECTION-MATRIX.md` and `EXAM-TRAPS.md` in full, then redo the relevant `01-domains/` practice banks before attempting Mock Exam 2. |

**Remember:** scoring is compensatory — there's no per-domain minimum on the
real exam. But a domain score below 50% here means you're guessing on
roughly half that domain's real-exam questions, which is a lot of ground to
make up elsewhere.

---

## Per-domain breakdown

Fill in your raw hits per domain, then transfer the weak ones to the
**Weak Topics Dashboard** in the repo's `README.md`.

| Domain | Questions | Your score | % | Target | If below target, re-drill |
|---|---|---|---|---|---|
| **D1 — Data Ingestion and Transformation** | 22 (Q1,4,7,10,14,15,17,20,23,25,26,30,33,36,40,42,46,49,52,56,58,62) | ___ / 22 | ___% | 70%+ | `01-domains/DOMAIN-1-DATA-INGESTION.md` |
| **D2 — Data Store Management** | 17 (Q2,6,9,12,19,22,29,31,35,38,41,47,51,54,57,61,65) | ___ / 17 | ___% | 70%+ | `01-domains/DOMAIN-2-DATA-STORE-MANAGEMENT.md` |
| **D3 — Data Operations and Support** | 14 (Q3,8,13,18,24,28,34,39,44,45,50,55,60,64) | ___ / 14 | ___% | 70%+ | `01-domains/DOMAIN-3-DATA-OPERATIONS.md` |
| **D4 — Data Security and Governance** | 12 (Q5,11,16,21,27,32,37,43,48,53,59,63) | ___ / 12 | ___% | 70%+ | `01-domains/DOMAIN-4-DATA-SECURITY.md` |
| **Total** | 65 | ___ / 65 | ___% | 46+ (≈720) | — |

Per the 10-Day Plan (Day 9): for every question you missed, write down
**(a)** why the right answer is right, **(b)** why each wrong option is
wrong, and **(c)** what keyword should have tipped you off — all three are
already worked out for you in `Explanations.md`; the exercise is copying
them into your own words so they stick.
