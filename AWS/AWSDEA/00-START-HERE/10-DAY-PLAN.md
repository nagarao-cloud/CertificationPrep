# 10-DAY-PLAN.md

## The shape of every day (~5 hours)

| Block | Time | What |
|---|---|---|
| **A. Recall** | 45 min | Flashcards + yesterday's mnemonics. No re-reading — force recall first, *then* check. |
| **B. New material** | 2 h 15 min | The day's topics, taught in the 8-step structure. |
| **C. Anchor lab or diagram-drawing** | 45 min | Days with a lab: do it. Days without: redraw the day's architecture from memory on paper. |
| **D. Practice questions** | 1 h 15 min | 30 scenario questions + dissect **every** option, right and wrong. |

**Block D is non-negotiable.** If a day runs long, cut Block C, never D.
Reading is where confidence comes from; questions are where the score
comes from, and those two feelings are not correlated.

---

## Day-by-day

### DAY 1 — Foundations + Storage Layer
*Domain 2 core, plus the vocabulary everything else depends on*

- Exam format, domain weights, how AWS writes questions
- **S3 deep**: storage classes, lifecycle, versioning, replication (CRR/SRR),
  Object Lock, Express One Zone, consistency, request costs
- **File formats & compression**: Parquet vs ORC vs Avro vs CSV/JSON;
  Snappy vs GZIP vs ZSTD vs BZIP2 (splittability!)
- **Partitioning** strategy and the small-file problem
- **Glue Data Catalog**: databases, tables, crawlers, classifiers, partitions
- Intro to **Apache Iceberg** — why it exists, what it fixes

📁 `services/S3.md`, `services/Glue.md` (catalog section), `comparisons/Iceberg-vs-Hive.md`
🧪 **LAB-01**: S3 + partitioned Parquet + crawler + first Athena query
🎯 Practice: 30 questions on storage & formats

---

### DAY 2 — Ingestion: Streaming + CDC
*Domain 1, the heaviest single day*

- **Kinesis Data Streams**: shards, throughput math, on-demand mode,
  enhanced fan-out, retention, KCL, `IteratorAge`, hot shards, resharding
- **Amazon Data Firehose**: buffering hints, Lambda transformation,
  dynamic partitioning, format conversion, destinations, error records
- **Amazon MSK**: provisioned vs Serverless, MSK Connect, when Kafka wins
- **AWS DMS**: full load vs CDC, replication instance sizing, DMS Serverless,
  source/target combos, LOB handling
- **Zero-ETL** integrations — the modern "no pipeline" answer
- SQS vs SNS vs EventBridge

📁 `services/Kinesis.md`, `services/MSK.md`, `comparisons/Kinesis-vs-MSK.md`, `architectures/CDC.md`
🧪 **LAB-05**: Firehose → S3 with dynamic partitioning
🎯 Practice: 30 questions on ingestion
🔁 **Spaced repetition #1**: Day 1 flashcards

---

### DAY 3 — Transformation: Glue, EMR, Flink, Lambda
*Domain 1 continued*

- **Glue ETL**: DynamicFrames vs DataFrames, job bookmarks, worker types
  (G.1X/G.2X/G.4X/G.8X), DPUs, Glue Studio, Glue versions
- **Glue Streaming** jobs vs Glue batch jobs
- **Glue DataBrew** — the no-code answer
- **EMR**: instance fleets, primary/core/task nodes, Spot strategy, EMRFS,
  **EMR Serverless**, EMR on EKS
- **Managed Service for Apache Flink**: windowing, exactly-once
- **Lambda for ETL** — and its hard walls (15 min, 10 GB, /tmp 10 GB)
- Data skew, partition pruning, predicate pushdown

📁 `services/Glue.md`, `services/EMR.md`, `services/Lambda.md`, `comparisons/Glue-vs-EMR.md`, `comparisons/Glue-vs-Lambda.md`
🧪 **LAB-02**: Glue job with bookmarks, CSV → partitioned Parquet
🎯 Practice: 30 questions on transformation

---

### DAY 4 — Orchestration + Programming Concepts
*Rest of Domain 1*

- **Step Functions**: Standard vs Express, Map state, error handling,
  retries with backoff, service integrations
- **MWAA**: when Airflow is the answer (existing DAGs, complex Python deps)
- **EventBridge** rules, schedules, Scheduler, pipes
- Glue workflows and triggers
- **Idempotency**, exactly-once vs at-least-once, DLQs, poison messages
- CI/CD for data pipelines: CloudFormation, CDK, SAM, Git integration
- SQL and Python fundamentals AWS expects (window functions, CTEs, joins)

📁 `services/StepFunctions.md`, `services/MWAA.md`, `services/EventBridge.md`
🎯 Practice: 30 questions on orchestration
🔁 **Spaced repetition #2**: Days 1–2

---

### DAY 5 — REVIEW + Redshift Deep Dive
*Half review, half Domain 2's biggest service*

**Morning — review (2 h):** Days 1–4 flashcards, redraw all architectures
from memory, re-attempt every question you got wrong so far.

**Afternoon — Redshift (3 h):**
- RA3 nodes + Redshift Managed Storage; **Redshift Serverless** (RPUs)
- **Distribution styles**: AUTO / EVEN / KEY / ALL — and when each
- **Sort keys**: compound vs interleaved; zone maps
- COPY and UNLOAD best practices, slice-aligned file counts
- WLM vs auto-WLM, query queues, **concurrency scaling**, short query acceleration
- Materialized views, **Redshift Spectrum**, data sharing, zero-ETL landing
- VACUUM / ANALYZE (and what's now automatic)

📁 `services/Redshift.md`, `comparisons/Athena-vs-Redshift.md`
🧪 **LAB-04**: Redshift Serverless + COPY from S3 + Spectrum external table
🎯 Practice: 30 questions on Redshift
🔁 **Spaced repetition #3**

---

### DAY 6 — Athena, DynamoDB, Modeling, Lakehouse
*Rest of Domain 2*

- **Athena**: engine v3, workgroups (cost guardrails), CTAS, UNLOAD,
  federated query (Lambda connectors), **partition projection**, ACID via Iceberg
- **DynamoDB**: key design, GSI vs LSI, Streams, TTL, capacity modes, PITR,
  export to S3 for analytics
- Aurora/RDS as sources; OpenSearch for log analytics
- **Data modeling**: star vs snowflake, fact/dimension, SCD Types 1/2/3,
  normalization vs denormalization for analytics
- **Iceberg deep**: snapshots, time travel, compaction, row-level deletes,
  schema evolution, hidden partitioning
- Lakehouse architecture: bronze/silver/gold

📁 `services/Athena.md`, `services/DynamoDB.md`, `services/Aurora.md`, `architectures/Lakehouse.md`
🧪 **LAB-03**: Athena partition projection + CTAS + Iceberg MERGE
🎯 Practice: 30 questions

---

### DAY 7 — Operations, Monitoring, Data Quality, Cost
*Domain 3, all of it*

- **CloudWatch**: the metric that matters per service (memorize the table)
- CloudWatch Logs Insights queries; alarms and composite alarms
- **CloudTrail**: management vs data events; who-did-what auditing
- X-Ray for distributed tracing
- **Glue Data Quality** (DQDL rulesets), DataBrew profiling
- Troubleshooting playbooks: Glue OOM, Kinesis hot shard, Redshift queue
  backup, S3 403, Lake Formation denial, Lambda throttle
- **QuickSight**: SPICE vs direct query, row-level security
- **Cost optimization**: compression, partitioning, file size, storage
  classes, Spot, Reserved/Serverless tradeoffs, Athena workgroup limits

📁 `TROUBLESHOOTING.md`, `COST-OPTIMIZATION.md`, `services/CloudWatch.md`, `services/CloudTrail.md`
🎯 Practice: 30 questions

---

### DAY 8 — Security & Governance + REVIEW
*Domain 4 + spaced repetition #4*

- **IAM**: policy evaluation logic (explicit deny → SCP → resource policy →
  permission boundary → identity policy), roles vs users, trust policies
- **Lake Formation**: LF-Tags, data filters, row/column/cell-level security,
  cross-account, hybrid access mode, **IAM vs LF permission model**
- **KMS**: AWS-managed vs customer-managed vs imported, key policies vs
  grants, rotation, cross-account key use, envelope encryption
- Encryption at rest: SSE-S3 / SSE-KMS / DSSE-KMS / SSE-C. In transit: TLS
- **Secrets Manager vs Parameter Store**
- **Macie** for PII discovery; masking and tokenization
- VPC endpoints: gateway (S3, DynamoDB) vs interface/PrivateLink
- Cross-account patterns: bucket policy, assume role, RAM, LF sharing

📁 `SECURITY.md`, `services/IAM.md`, `services/KMS.md`, `services/Lake-Formation.md`
🧪 **LAB-06**: Lake Formation column-level grant + verify denial
🎯 Practice: 30 questions
🔁 **Spaced repetition #4**: Days 1–7

---

### DAY 9 — Full Mock Exams
*The most valuable day in the plan*

- **Morning:** Full 65-question mock, strict 130-minute timer, no notes,
  no pausing. Simulate exam conditions completely.
- **Midday:** Score it. Then spend **3+ hours** reviewing — for every
  question, write down (a) why the right answer is right, (b) why each
  wrong option is wrong, (c) what keyword should have tipped you off.
- **Evening:** Second mock if the first went well; otherwise re-drill your
  two weakest domains.

📁 `practice/Full-Mock-Exam-1.md`, `practice/Full-Mock-Exam-2.md`
🎯 Target: 80%+ on the mock. Below 65% → consider rescheduling.

---

### DAY 10 — Final Revision Only
*No new material. None.*

- Morning: all comparison matrices, decision trees, mnemonics
- Midday: your Weak Topics Dashboard — only rows scored 1–3
- Afternoon: `EXAM-TRAPS.md` and your personal list of mistakes from Days 1–9
- Evening: **stop by 6 pm.** Sleep beats cramming. Confirm ID, test-center
  address or online-proctor system check.

📁 `revision/Last-24-Hours.md`
🔁 **Spaced repetition #5**: everything, lightly

---

## Spaced repetition schedule

| Review | Day | Covers |
|---|---|---|
| #1 | Day 2 | Day 1 |
| #2 | Day 4 | Days 1–2 |
| #3 | Day 5 | Days 1–4 |
| #4 | Day 8 | Days 1–7 |
| #5 | Day 10 | Everything |

---

## If you fall behind

Cut in this order — the list is ordered by what costs you the fewest points:

1. **Terraform labs** (cut first — zero exam value)
2. Console labs beyond LAB-01, LAB-02, LAB-05
3. Interview-level content (valuable, but not for *this* deadline)
4. Domain 4 depth beyond IAM + Lake Formation + KMS basics

**Never cut:** Block D practice questions, Day 9 mock, Day 10 revision.

---

## Honest calibration

Beginner + 10 days + 50 hours is *tight but doable* for this exam — it's
an Associate-level test that rewards pattern recognition over hands-on
depth. The people who fail this timeline fail because they spent 45 of
their 50 hours reading and 5 answering questions. Don't be that person.
