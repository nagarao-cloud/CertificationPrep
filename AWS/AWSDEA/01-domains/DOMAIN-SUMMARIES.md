# Domain Summaries — One Page Each

> Four domains, one condensed page each: task statements, the
> highest-yield facts, top 3 exam traps, and a pointer back to the full
> file. Use this file for Day 10 final revision or a quick pre-exam
> refresh — not as a substitute for the full domain files the first
> time through. Each full file runs 1,000–2,000+ lines with the
> complete 8-step teaching pass, decision trees, and a 40-question bank;
> this page assumes you've already read it once.

---

## Domain 1 — Data Ingestion and Transformation (34%)

**Full file:** [`DOMAIN-1-DATA-INGESTION.md`](DOMAIN-1-DATA-INGESTION.md)

**Task statements**

| Task | Covers |
|---|---|
| 1.1 — Perform data ingestion | Streaming/batch sources, schedulers, event triggers, throttling/backpressure, fan-in/fan-out, replayability |
| 1.2 — Transform and process data | Container choice (ECS/EKS/Fargate), JDBC/ODBC, multi-source integration, transformation service selection, format conversion |
| 1.3 — Orchestrate data pipelines | Workflow service selection, resilient pipeline design, serverless workflows, alerting |
| 1.4 — Apply programming concepts | Runtime optimization, Lambda concurrency, IaC, CI/CD, distributed computing, data structures |

**Highest-yield facts**

1. **Amazon Data Firehose** (current name — not "Kinesis Data
   Firehose") is the default answer for "land a stream in S3, least
   operational overhead"; **Kinesis Data Streams** is the answer the
   moment the scenario needs replay, multiple independent consumers, or
   sub-second custom processing.
2. **AWS DMS** is the only first-class answer for continuous
   replication out of a database you don't control — full load seeds
   history, CDC keeps it current. Schema conversion now happens via
   **DMS Schema Conversion**, not the retired AWS SCT.
3. **Zero-ETL** integrations (Aurora/DynamoDB → Redshift) are the
   correct answer whenever a scenario pairs "operational database,"
   "near real-time analytics," and "minimal operational overhead" —
   no pipeline, no Glue job.
4. **Glue vs. EMR vs. Lambda** split on three axes: serverless
   catalog-native ETL → Glue; existing Spark/Hive code or PB-scale at
   lowest cost → EMR (+ Spot on task nodes); under 15 minutes,
   event-driven, lightweight → Lambda (hard walls: 15 min, 10 GB
   memory, 10 GB `/tmp`).
5. **Amazon Managed Service for Apache Flink** (current name — not
   "Kinesis Data Analytics") is the answer for windowed, stateful
   aggregation on a live stream.
6. **Job bookmarks** make Glue jobs incremental; disabling them or
   never enabling them is why a job silently starts reprocessing full
   history.
7. **Step Functions vs. MWAA**: Step Functions for serverless workflows
   with native retry/branching; MWAA specifically when existing Airflow
   DAGs or complex Python dependencies already exist — don't introduce
   MWAA for a greenfield pipeline that Step Functions could handle.
8. **AWS Data Pipeline is retired** — never the live answer; the exam's
   modern equivalents are Step Functions, MWAA, or Glue workflows.

**Top 3 exam traps**

1. Picking **streaming** for a requirement that's actually
   next-day/batch-shaped — read the actual latency requirement in the
   business's own words, not "streaming sounds more modern."
2. Confusing **Firehose** (managed delivery, buffering, at-least-once,
   simplest ops) with **Kinesis Data Streams** (replay, multiple
   consumers, more operational control) — the exam tests this
   distinction constantly.
3. Assuming **Lambda** can run any transformation job — the 15-minute
   and 10 GB memory/`/tmp` ceilings are exam-favorite disqualifiers
   that push the correct answer to Glue or EMR instead.

---

## Domain 2 — Data Store Management (26%)

**Full file:** [`DOMAIN-2-DATA-STORE-MANAGEMENT.md`](DOMAIN-2-DATA-STORE-MANAGEMENT.md)

**Task statements**

| Task | Covers |
|---|---|
| 2.1 — Choose a data store | Storage service selection, access-pattern configuration, migration tools, locking, open table formats (Iceberg), vector indexes |
| 2.2 — Understand data cataloging systems | Glue Data Catalog, crawlers/classifiers, partition sync, business catalogs |
| 2.3 — Manage the lifecycle of data | S3↔Redshift load/unload, lifecycle policies, versioning, DynamoDB TTL, deletion/legal requirements |
| 2.4 — Design data models and schema evolution | Star/snowflake schemas, SCD types, schema conversion, lineage, indexing/partitioning/compression optimization |

**Highest-yield facts**

1. **"Access pattern first, entity-relationship second"** is the
   domain's headline principle — most wrong answers come from designing
   storage before asking how the data will be read.
2. **Redshift distribution styles**: KEY (co-locate join columns),
   EVEN (spread evenly, no dominant join pattern), ALL (small
   dimension tables, replicated everywhere), AUTO (let Redshift decide
   — the safe default absent a strong reason otherwise).
3. **Compound vs. interleaved sort keys**: compound favors queries that
   filter on a prefix of the sort key columns in order (and speeds up
   `VACUUM`/merge joins); interleaved gives equal weight to each column
   for varied filter patterns but costs more to maintain — compound is
   the more common correct answer.
4. **Apache Iceberg** fixes what Hive-style partitioned tables can't:
   ACID transactions, safe concurrent writes, schema evolution without
   rewriting data, time travel via snapshots, and hidden partitioning
   that removes the need to know the physical partition scheme to
   query efficiently.
5. **Athena partition projection** removes Glue Data Catalog
   partition-metadata lookups entirely for high-cardinality partition
   schemes (e.g., per-customer, per-hour at scale) — the answer
   whenever a scenario says "too many partitions" is slowing catalog
   operations.
6. **The small-file problem**: many tiny files cost more in per-file
   open/read overhead than the data itself takes to scan; the fix is
   compaction, not more partitioning.
7. **Redshift Spectrum vs. federated query vs. materialized view vs.
   data sharing** are four different ways to reach data outside a
   single cluster — Spectrum for S3 data via external tables,
   federated query for live operational databases, materialized views
   to pre-compute expensive repeated aggregations, data sharing for
   live zero-copy access between Redshift clusters/accounts.
8. **S3 storage classes and lifecycle policies** transition data by
   access pattern (Standard → IA → Glacier tiers) — the exam tests
   matching retrieval time/cost tolerance to the class, not just
   "cheapest wins."

**Top 3 exam traps**

1. Choosing a distribution/sort key strategy based on table size alone
   instead of actual join and filter patterns — DISTKEY/sort key
   questions are really query-pattern questions in disguise.
2. Treating Hive-style partitioned tables and Iceberg tables as
   interchangeable — a scenario mentioning concurrent writes, time
   travel, or schema evolution without a full rewrite is signaling
   Iceberg specifically.
3. Forgetting that encryption cannot be toggled on an existing live
   Redshift/RDS resource — the correct path is always snapshot → copy
   with encryption enabled → restore.

---

## Domain 3 — Data Operations and Support (22%)

**Full file:** [`DOMAIN-3-DATA-OPERATIONS.md`](DOMAIN-3-DATA-OPERATIONS.md)

**Task statements**

| Task | Covers |
|---|---|
| 3.1 — Automate data processing | Orchestration, MWAA troubleshooting, SDKs, EMR/Redshift/Glue scripting, data APIs, DataBrew, Athena queries, Lambda automation, IaC |
| 3.2 — Analyze data | Visualization (QuickSight), data verification/cleaning, SQL in Redshift/Athena, Athena for Apache Spark notebooks, provisioned vs. serverless, aggregation patterns |
| 3.3 — Maintain and monitor data pipelines | Log extraction/audits, logging/monitoring deployment, notifications, performance troubleshooting, CloudTrail, CloudWatch Logs, log analysis, Macie |
| 3.4 — Ensure data quality | Quality checks, DQDL rules, data consistency investigation, sampling techniques, data skew mitigation |

**Highest-yield facts**

1. **The signature CloudWatch metric per service** is directly tested —
   memorize at minimum: Kinesis `IteratorAgeMilliseconds`, Lambda
   `Throttles`/`ConcurrentExecutions`, Redshift WLM queue metrics, DMS
   `CDCLatencyTarget`/`CDCLatencySource`, Glue job memory/task
   completion metrics.
2. **CloudTrail management events vs. data events**: management events
   (on by default) answer "who changed this resource"; data events
   (opt-in, extra cost) answer "who read/wrote this specific object" —
   this distinction is one of the most-reused exam traps across
   Domains 3 and 4.
3. **Glue Data Quality (DQDL)** is the codified, in-pipeline quality
   gate; **DataBrew** is the no-code profiling/prep tool for analysts —
   pick DQDL when the scenario says "automated" or "part of the job,"
   DataBrew when it says "no-code" or "for analysts."
4. **Provisioned vs. serverless** is a recurring Domain 3 decision:
   steady, predictable, high-utilization → provisioned + Reserved;
   spiky, unpredictable → serverless.
5. **Data skew** shows up operationally as one task taking far longer
   than its peers — fix via repartitioning, salting, or broadcast
   joins, not by just adding more workers.
6. **Job bookmark troubleshooting**: reprocessing the same data
   repeatedly → check bookmark state; need to reprocess *all* history →
   **reset** the bookmark explicitly, never just "disable" it.
7. **Stratified sampling** represents a small but critical subgroup
   fairly; **cluster sampling** cheaply profiles a huge partitioned
   dataset without scanning all of it — the exam names the sampling
   goal, not the technique, so map the goal to the technique.
8. **Amazon Macie** (current name — not "Elasticsearch"-adjacent
   anything) is the automated PII/sensitive-data discovery answer
   across S3; it appears in both Domain 3 (monitoring) and Domain 4
   (governance) framing.

**Top 3 exam traps**

1. Reaching for CloudTrail alone to answer "who read this object" —
   without data events explicitly enabled, that question is
   unanswerable from management events.
2. Treating a rising CloudWatch metric as automatically meaning "add
   more capacity" — several of the most-tested scenarios (hot shard,
   data skew) require a redesign, not more raw compute.
3. Confusing DataBrew (manual, exploratory, no-code) with Glue Data
   Quality/DQDL (automated, rule-based, runs inside a job) when a
   scenario says "automated quality gate."

---

## Domain 4 — Data Security and Governance (18%)

**Full file:** [`DOMAIN-4-DATA-SECURITY.md`](DOMAIN-4-DATA-SECURITY.md)
· **Cross-cutting companion:** [`00-START-HERE/SECURITY.md`](../00-START-HERE/SECURITY.md)

**Task statements**

| Task | Covers |
|---|---|
| 4.1 — Apply authentication mechanisms | VPC security groups, IAM groups/roles/endpoints, Secrets Manager rotation, IAM roles for access, managed vs. unmanaged services |
| 4.2 — Apply authorization mechanisms | Custom IAM policies, credential storage, database access grants, Lake Formation permissions, RBAC/ABAC, least privilege |
| 4.3 — Ensure data encryption and masking | Masking/anonymization/tokenization, KMS, cross-account encryption, encryption in transit |
| 4.4 — Prepare logs for audit | CloudTrail, CloudWatch Logs, CloudTrail Lake, log analysis, cross-service logging integration |
| 4.5 — Understand data privacy and governance | Redshift data sharing permissions, Macie + Lake Formation for PII, region restrictions, AWS Config, data sovereignty |

**Highest-yield facts**

1. **IAM policy evaluation order** (the single most-tested fact in this
   domain): explicit deny anywhere → SCP → resource-based policy →
   permission boundary → session policy → identity-based policy →
   implicit deny if nothing allowed. Mnemonic: *"Deny Stops Really
   Powerful Session Identities."*
2. **Secrets Manager vs. Parameter Store**: needs scheduled rotation →
   Secrets Manager (native rotation for RDS/Aurora/Redshift/DocumentDB);
   genuine secret without rotation need, or cross-account/>4KB → still
   Secrets Manager; plain config value → Parameter Store Standard
   (free). Mnemonic: *"Rotate = Manager."*
3. **SCPs are a ceiling, never a grant** — "SCP is the ceiling, IAM is
   the floor." No identity-based policy, however explicit, can override
   an SCP-level restriction.
4. **Lake Formation governs on top of IAM, not instead of it** — once a
   table is registered under Lake Formation, broad IAM S3 access no
   longer grants access; the fix for a denial despite correct-looking
   IAM is almost always a missing Lake Formation grant.
5. **RBAC vs. ABAC vs. Lake Formation column/row security**: a
   requirement naming a specific column or row filter → Lake Formation;
   small, stable set of job-function roles → RBAC; dynamic/growing
   attribute-driven access → ABAC (IAM PrincipalTag or LF-Tags).
6. **Security Groups are stateful and allow-only**; **NACLs are
   stateless and support explicit deny** — the only firewall layer in
   this stack capable of an explicit deny at the network level is the
   NACL.
7. **CloudTrail data events** must be explicitly enabled per resource
   and cost extra — they're the only way to answer "who read this
   specific object," and this is reused across Domains 3 and 4.
8. **AWS SCT is retired from exam scope (Dec 2025 revision)** — schema
   conversion is now **DMS Schema Conversion**; AWS CodeCommit is also
   out of scope.

**Top 3 exam traps**

1. Evaluating only the identity-based policy in a scenario and missing
   an explicit deny or SCP restriction buried in the details — always
   scan for an explicit deny first, since it wins immediately regardless
   of anything else in the policy chain.
2. Picking Secrets Manager for "lowest cost" scenarios — it is never
   the cheap answer; Parameter Store Standard is, whenever rotation
   isn't the actual requirement.
3. Trying to encrypt an existing live Redshift/RDS resource in place —
   the only path is snapshot → copy with encryption enabled → restore,
   the same trap as in Domain 2, reused here in a security framing.

---

## Where the domains overlap (questions rarely stay in one lane)

| Topic that spans domains | Domain 1 angle | Domain 2 angle | Domain 3 angle | Domain 4 angle |
|---|---|---|---|---|
| **AWS DMS** | Task 1.1 — CDC as an ingestion mechanism | Task 2.4.3 — schema conversion (DMS Schema Conversion) | 3.3.6 — troubleshooting replication lag | 4.1 — securing replication instance credentials |
| **Job bookmarks / incremental processing** | 1.2 — core Glue transformation behavior | 2.3 — lifecycle of processed data | 3.3.6 — the #1 reprocessing troubleshooting trap | — |
| **Amazon Macie** | — | — | 3.3.9 — sensitive-data monitoring | 4.5.2 — PII identification paired with Lake Formation |
| **Encryption at rest (KMS)** | — | 2.1 — storage service configuration | — | 4.3 — the domain's core task statement |
| **Partitioning strategy** | 1.2 — cost of processing unpartitioned data | 2.4.5 — indexing/partitioning/compression best practices | 3.4.5 — data skew from poor partitioning | — |
| **CloudTrail / CloudWatch** | — | — | 3.3 — the domain's core task statement | 4.4 — audit-specific framing of the same services |

A question that "feels like" it belongs to one domain based on the
service it names is frequently testing a task statement from a
different domain — DMS shows up under all four. Don't use "which
service is this" as a proxy for "which domain is this"; read what the
question is actually asking you to *do* with the service (ingest it?
secure it? troubleshoot it? model its schema?) to place it correctly,
though for exam purposes this placement barely matters — scoring is
compensatory across domains, so getting the *answer* right matters far
more than correctly labeling which domain it came from.

---

## How to use this file

Read it top to bottom on **Day 10 morning** as a first pass before
`EXAM-TRAPS.md` and the Weak Topics Dashboard. If any fact here feels
unfamiliar rather than just "a good reminder," that's a signal to open
the corresponding full domain file for that one sub-topic — not to
reread the whole domain from scratch.
