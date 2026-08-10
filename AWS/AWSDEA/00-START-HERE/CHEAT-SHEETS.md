# Cheat Sheets — One Page Per Service

> **Purpose:** a 10-minute, top-to-bottom scan the morning of the exam.
> Each service gets one block: what it's for, the keyword that should
> make you reach for it, the trap AWS likes to set around it, and the
> one fact you must not lose under pressure. This is deliberately
> terse — for depth, go to the matching `02-services/*.md` file or the
> relevant `01-domains/DOMAIN-N-*.md`. For head-to-head comparisons,
> see `SERVICE-SELECTION-MATRIX.md`.

**Jump to:** [S3](#s3) · [Glue](#glue) · [Kinesis Data Streams](#kds) ·
[Amazon Data Firehose](#firehose) · [MSK](#msk) · [DMS](#dms) ·
[EMR](#emr) · [Lambda](#lambda) · [Redshift](#redshift) ·
[Athena](#athena) · [DynamoDB](#dynamodb) · [Aurora](#aurora) ·
[Step Functions](#sfn) · [EventBridge](#eventbridge) · [MWAA](#mwaa) ·
[IAM](#iam) · [KMS](#kms) · [Lake Formation](#lakeformation) ·
[Secrets Manager](#secretsmanager) · [CloudWatch](#cloudwatch) ·
[CloudTrail](#cloudtrail) · [Macie](#macie) · [QuickSight](#quicksight) ·
[S3 Tables](#s3tables)

---

<a name="s3"></a>
## Amazon S3

- **Purpose:** durable, cheap, infinitely-scaling object storage — the landing zone for almost every pipeline on this exam.
- **Trigger keyword:** "data lake," "cheapest storage," "land raw files," "object storage."
- **Never confuse with:** EFS/FSx (those are file systems with POSIX semantics; S3 is object storage, no in-place edits).
- **Signature numbers:** 11 nines durability · Standard is multi-AZ · Express One Zone is single-AZ, sub-10ms, for latency-sensitive high-throughput access.
- **Top exam trap:** picking a lifecycle transition that's cheaper on paper but violates a stated retrieval-time SLA (Glacier Deep Archive = up to 12h retrieval; if the question needs data back in minutes, that's disqualifying, not just costly).
- **Cost lever:** Intelligent-Tiering when access pattern is unknown/unpredictable; explicit lifecycle rules when it's known.
- **Never forget:** versioning + Object Lock (compliance mode) is the only true WORM answer — not IAM, not bucket policy.
- **Pairs with:** Glue Data Catalog (metadata), Athena/Redshift Spectrum (query), Lake Formation (fine-grained access).

---

<a name="glue"></a>
## AWS Glue

- **Purpose:** serverless, catalog-native ETL — the default transformation answer when nothing forces EMR or Lambda.
- **Trigger keyword:** "serverless ETL," "integrated with the Data Catalog," "DynamicFrame," "job bookmarks."
- **Never confuse with:** EMR (Glue = managed Spark/Python-shell with less framework flexibility, no cluster to manage); DataBrew (Glue = code/DAG-based, DataBrew = no-code visual).
- **Signature numbers:** worker types G.1X (16GB, default) → G.2X (32GB, **first OOM fix**) → G.4X/G.8X (64/128GB, big shuffles) → G.025X (streaming only, low volume).
- **Top exam trap:** "job keeps reprocessing the same data" → check/enable job **bookmarks**; "job needs to reprocess everything" → **reset**, don't disable, the bookmark.
- **Cost lever:** **Glue Flex** for non-urgent, schedule-flexible jobs (spare capacity, discounted, variable start time — never the answer if there's an SLA).
- **Never forget:** DynamicFrames handle schema flexibility/semi-structured data that DataFrames choke on; that's the reason Glue prefers them over raw Spark DataFrames.
- **Pairs with:** S3 (source/sink), Glue Data Catalog + Crawlers (metadata), Step Functions/MWAA (orchestration), Glue Data Quality/DQDL (validation).

---

<a name="kds"></a>
## Kinesis Data Streams

- **Purpose:** real-time, low-latency, ordered, replayable streaming ingestion with multiple independent consumers.
- **Trigger keyword:** "real-time," "sub-second," "multiple consumers need the same data," "replay," "ordering within a partition key."
- **Never confuse with:** Amazon Data Firehose (KDS = you manage consumers and get replay; Firehose = fully managed delivery, no consumer code, buffered).
- **Signature metric:** `GetRecords.IteratorAgeMilliseconds` rising = consumers falling behind the stream — the single most-tested KDS metric.
- **Top exam trap:** a "hot shard" (one partition key gets disproportionate traffic) is fixed by a **better partition key** or **resharding**, not by blindly adding more shards uniformly.
- **Never forget:** on-demand mode removes shard-capacity planning; provisioned mode requires you to do the throughput math (1MB/s or 1,000 records/s write, 2MB/s read per shard) and consider **enhanced fan-out** when many consumers need full read throughput without contention.
- **Pairs with:** Managed Service for Apache Flink (stream processing), Lambda (event source mapping), Firehose (as a KDS consumer for S3 delivery).

---

<a name="firehose"></a>
## Amazon Data Firehose

- **Purpose:** fully managed, near-real-time delivery of streaming data to S3/Redshift/OpenSearch/HTTP endpoints with zero consumer code.
- **Trigger keyword:** "land a stream in S3 with least operational overhead," "near real-time" (not real-time), "dynamic partitioning," "format conversion on the fly."
- **Never confuse with:** the 2023-era name **"Kinesis Data Firehose"** — that's a distractor; the current name is **Amazon Data Firehose**.
- **Signature metric:** `DeliveryToS3.Success` / `ThrottledRecords` — failures usually trace back to IAM or KMS permission problems on the destination.
- **Top exam trap:** "near real-time" licenses Firehose's ~60-second buffering; if the question insists on true real-time/sub-second, Firehose is wrong — go to Kinesis Data Streams.
- **Never forget:** Firehose has **no replay** — once delivered, it's the consumer's job (a Lambda transform runs inline, but there's no independent re-read like KDS).
- **Pairs with:** Kinesis Data Streams (as a source), Lambda (inline transformation), S3 (default destination), dynamic partitioning (auto-partitions by a JSON key — no separate Glue job needed).

---

<a name="msk"></a>
## Amazon MSK

- **Purpose:** fully managed Apache Kafka — the answer whenever an existing Kafka investment (producers, consumers, Kafka Connect) is in play.
- **Trigger keyword:** "existing Kafka," "Kafka Connect," "multi-cloud streaming," "Kafka API compatibility."
- **Never confuse with:** Kinesis Data Streams (MSK is chosen for Kafka-ecosystem compatibility, not because it's technically superior for greenfield AWS-only workloads — greenfield defaults to KDS).
- **Signature numbers:** Provisioned (you size brokers/storage) vs **MSK Serverless** (auto-scales, no broker sizing) — same decision shape as Redshift provisioned vs Serverless.
- **Top exam trap:** picking MSK for a brand-new, AWS-native, no-Kafka-history pipeline "because Kafka is popular" — that's operational overhead with no payoff; the exam rewards recognizing existing investment as the actual justification.
- **Never forget:** **MSK Connect** runs Kafka Connect connectors (including to S3, DMS-style CDC sources) without you managing the Connect cluster.
- **Pairs with:** MSK Connect (sink/source connectors), Managed Service for Apache Flink (stream processing on MSK topics).

---

<a name="dms"></a>
## AWS DMS

- **Purpose:** migrate/replicate **data** into or out of AWS — full load (one-time) and/or CDC (continuous, ongoing change capture).
- **Trigger keyword:** "continuously replicate an on-prem database," "one-time database migration," "change data capture," "minimal downtime cutover."
- **Never confuse with:** **DMS Schema Conversion** (converts schema DDL, stored procedures, views, functions between engines — DMS itself moves rows, not schema objects). ⚠️ As of the December 2025 exam guide revision, the standalone **"AWS SCT"** desktop product is retired and out of scope — the capability lives inside **DMS Schema Conversion**. Never answer "AWS SCT" as a current, separate product.
- **Signature numbers:** CDC requires **binlog/supplemental logging** enabled on the source; **limited LOB mode** is fast but truncates, **full LOB mode** is complete but slow.
- **Top exam trap:** a heterogeneous migration (Oracle → PostgreSQL) needs **schema conversion first** (DMS Schema Conversion), **then** DMS full load + CDC for the data — picking DMS alone is incomplete.
- **Never forget:** DMS can target **Kinesis or MSK**, turning a relational database into a live stream — this is the "database as a streaming source" pattern.
- **Pairs with:** zero-ETL (the newer, pipeline-free alternative for supported source/target pairs — prefer it when the question says "minimal operational overhead" and the pair is supported).

---

<a name="emr"></a>
## Amazon EMR

- **Purpose:** managed Hadoop/Spark/Hive/Presto/Trino/HBase clusters — the answer for existing big-data-framework code or the lowest cost per TB at petabyte scale.
- **Trigger keyword:** "existing Spark/Hive scripts," "framework beyond what Glue supports" (e.g., Presto specifically), "lowest cost at petabyte scale."
- **Never confuse with:** Glue (EMR wins when you need a framework Glue doesn't expose, or extreme-scale cost efficiency with Spot).
- **Signature numbers:** node types — **primary** (never Spot, losing it kills the cluster), **core** (holds HDFS data, Spot is risky), **task** (compute-only, **Spot goes here** — this is the exam's default correct answer).
- **Top exam trap:** any option offering "Spot instances for all node types" is wrong by construction — flag and eliminate immediately.
- **Never forget:** **EMR Serverless** removes cluster/instance-type decisions entirely (pay per job, auto-scales) — pick it when the scenario says "no cluster management" but still needs Spark/Hive.
- **Pairs with:** S3 via EMRFS (data), Glue Data Catalog (as an external Hive metastore), Spot (task nodes for cost).

---

<a name="lambda"></a>
## AWS Lambda

- **Purpose:** event-driven, serverless compute for small, short transforms and glue-code between services.
- **Trigger keyword:** "under 15 minutes," "event-driven," "lightweight transform," "no server to manage."
- **Never confuse with:** Glue (Lambda has hard ceilings Glue doesn't).
- **Signature numbers — memorize exactly:** **15-minute** max execution, **10 GB** max memory, **10 GB** `/tmp` ephemeral storage.
- **Top exam trap:** a transform described as "processes gigabytes of data" or "runs for 20+ minutes" disqualifies Lambda outright — no amount of memory tuning fixes a timeout problem.
- **Never forget:** concurrency is controlled by **reserved** (guarantees capacity, caps usage) vs **provisioned** (pre-warms to kill cold starts) concurrency — different problems, different knobs.
- **Pairs with:** Kinesis/DynamoDB Streams (event source mapping), Step Functions (orchestrated steps), S3 event notifications (trigger on object creation).

---

<a name="redshift"></a>
## Amazon Redshift

- **Purpose:** petabyte-scale SQL data warehouse for high-concurrency BI/analytics workloads.
- **Trigger keyword:** "data warehouse," "hundreds of BI users," "complex joins across large fact tables," "concurrency scaling."
- **Never confuse with:** Athena (Redshift = provisioned/serverless cluster with its own storage and users; Athena = serverless query engine directly over S3, no cluster).
- **Signature numbers:** RA3 nodes decouple compute/storage via Redshift Managed Storage; **Serverless** bills per **RPU-hour**, scales to zero when idle.
- **Top exam trap:** distribution style — **KEY** for large tables joined on a common column, **ALL** for small dimension tables, **EVEN**/**AUTO** as defaults; picking the wrong style shows up as "queries doing broadcast/network shuffles."
- **Never forget:** **Redshift Spectrum** queries S3 directly from an existing cluster (no data movement); **Redshift data sharing** shares live data cross-cluster/cross-account with zero copy — these are different tools for different "don't duplicate the data" scenarios.
- **Pairs with:** S3 (COPY/UNLOAD, Spectrum), zero-ETL (Aurora/DynamoDB landing directly), Glue/DMS (loading pipelines).

---

<a name="athena"></a>
## Amazon Athena

- **Purpose:** serverless, pay-per-query-scanned SQL directly over data in S3 (or federated sources) — no infrastructure to run or manage.
- **Trigger keyword:** "ad-hoc SQL on S3," "serverless query," "pay only for data scanned," "query without standing infrastructure."
- **Never confuse with:** Redshift (Athena has no persistent cluster or users to manage; it's query-on-demand).
- **Signature numbers:** cost = bytes scanned; **workgroups** enforce **per-query data-scanned limits** — this is the cost-guardrail mechanism the exam tests directly.
- **Top exam trap:** "too many small files" or "query timing out" on a huge partition count → the AWS answer is **partition projection** (compute partitions from a pattern, skip the Glue Catalog partition lookup/MSCK REPAIR entirely), not "add more DPUs" (Athena has no DPUs to add).
- **Never forget:** **CTAS** rewrites query results into a new, better-formatted/partitioned table (e.g., CSV → partitioned Parquet) — this is the standard "fix a slow, expensive table" answer.
- **Pairs with:** Glue Data Catalog (metadata), S3 (storage), Iceberg (ACID tables, time travel, row-level MERGE), Lambda (federated query connectors to RDS/DynamoDB).

---

<a name="dynamodb"></a>
## Amazon DynamoDB

- **Purpose:** fully managed, serverless key-value/document NoSQL store with single-digit-millisecond latency at any scale.
- **Trigger keyword:** "key-value lookup," "single-digit millisecond," "unpredictable/massive scale," "serverless NoSQL."
- **Never confuse with:** Aurora/RDS (DynamoDB has no joins, no ad-hoc query flexibility — access patterns must be designed **before** the table, not after).
- **Signature numbers:** **GSI** can be added anytime after table creation; **LSI** **cannot** — it must be defined at table creation. This asymmetry is tested directly and often.
- **Top exam trap:** "analyze DynamoDB data without impacting production app performance" → **export to S3, then query with Athena/Glue/Redshift Spectrum** — never a table `Scan` for analytics.
- **Never forget:** **TTL** auto-expires items for free (no WCU consumed on the delete); **DynamoDB Streams** feed change events downstream (Lambda, Kinesis-style processing) for CDC-like patterns.
- **Pairs with:** DynamoDB Streams (CDC), zero-ETL (→ Redshift/OpenSearch), Lambda (event-driven processing), DAX (microsecond read caching).

---

<a name="aurora"></a>
## Amazon Aurora

- **Purpose:** MySQL/PostgreSQL-compatible managed relational database with cloud-native storage — the default "operational SQL database" answer.
- **Trigger keyword:** "transactional SQL," "ACID," "relational joins," "operational database," "MySQL/PostgreSQL-compatible."
- **Never confuse with:** Redshift (Aurora is OLTP — operational, row-oriented, low-latency single-record transactions; Redshift is OLAP — analytical, columnar, big aggregate scans).
- **Signature numbers:** **Aurora Serverless v2** scales in fine-grained **ACUs**, no cluster resizing event, good for spiky/unpredictable operational load.
- **Top exam trap:** using Aurora as an analytics warehouse — a wide aggregate query across a huge Aurora table where the intended answer is "**zero-ETL** this into Redshift" or "use Redshift Federated Query," not "just query Aurora harder."
- **Never forget:** **zero-ETL integration** from Aurora → Redshift is the current, minimal-operational-overhead answer whenever a question pairs "operational database" with "near real-time analytics."
- **Pairs with:** Redshift (zero-ETL target), DMS (as a migration source/target), Aurora + pgvector (vector/RAG search alongside relational data).

---

<a name="sfn"></a>
## AWS Step Functions

- **Purpose:** serverless state-machine orchestration with built-in retries, error handling, and branching across AWS service calls.
- **Trigger keyword:** "stateful workflow," "retries with backoff," "branching logic," "coordinate multiple services."
- **Never confuse with:** Glue Workflows (Step Functions orchestrates **any** AWS service; Glue Workflows only chains Glue jobs/crawlers/triggers, but is free).
- **Signature numbers:** **Standard** (long-running, up to a year, exactly-once, full execution history, priced per state transition) vs **Express** (up to 5 min, at-least-once, high-throughput/high-volume events, priced per invocation+duration).
- **Top exam trap:** picking Standard for a very high-volume, sub-5-minute event-processing workload — Express is both cheaper and purpose-built there.
- **Never forget:** the **Map** state runs parallel iterations over a collection — this is the go-to for "process each item in this list independently."
- **Pairs with:** Lambda/Glue/EMR/SNS/SQS (service integrations), EventBridge (triggers), DLQs (poison-message handling).

---

<a name="eventbridge"></a>
## Amazon EventBridge

- **Purpose:** serverless event bus for content-based routing and scheduled triggers across AWS services and SaaS/custom sources.
- **Trigger keyword:** "event-driven routing," "route based on event content," "simple scheduled trigger," "decouple producers from many consumers."
- **Never confuse with:** SNS (EventBridge routes based on event **content/pattern matching** across many sources/schemas; SNS is simpler pub/sub fan-out on a single topic).
- **Signature numbers:** **EventBridge Scheduler** is the current answer for cron-style/one-time scheduled triggers (successor to plain scheduled rules for most new designs).
- **Top exam trap:** using Lambda + CloudWatch cron code for scheduling when the question just wants a "simple scheduled trigger" — that's EventBridge Scheduler with zero custom code.
- **Never forget:** EventBridge **Pipes** connects a source directly to a target with optional filter/enrich/transform steps — the newer point-to-point alternative to writing glue Lambdas.
- **Pairs with:** Step Functions (workflow triggers), Lambda (event targets), SQS/SNS (fan-out targets).

---

<a name="mwaa"></a>
## Amazon MWAA

- **Purpose:** managed Apache Airflow — DAG-based orchestration for teams with existing Airflow investment.
- **Trigger keyword:** "existing Airflow DAGs," "complex Python dependency graph," "team already knows Airflow."
- **Never confuse with:** Step Functions (MWAA is chosen for **existing Airflow** history, the same logic as MSK-for-Kafka — not because Airflow is technically superior for a greenfield AWS pipeline).
- **Signature numbers:** always-on **environment-hours** billing — there is no free/idle tier, unlike Step Functions' per-transition pricing.
- **Top exam trap:** MWAA is essentially **never the "cheapest" or "least operational overhead" answer** when there's no pre-existing Airflow investment; if cost or overhead is the stated constraint and Airflow isn't already in play, it's the wrong choice.
- **Never forget:** MWAA runs your DAGs on managed infrastructure, but you are still responsible for DAG code quality, Python dependencies (`requirements.txt`), and plugin management.
- **Pairs with:** any AWS service Airflow operators can call (Glue, EMR, Redshift, S3) — used when the orchestration logic itself already exists as DAGs.

---

<a name="iam"></a>
## AWS IAM

- **Purpose:** the identity and permission backbone for every AWS API call — users, roles, groups, and policies.
- **Trigger keyword:** "temporary access for a service," "least privilege," "cross-account role assumption," "who can call this API."
- **Never confuse with:** Lake Formation (IAM has **no concept of a column or row** — the moment a question asks for column/row/cell-level filtering, IAM alone is insufficient; reach for Lake Formation).
- **Signature numbers:** the six-stage **policy evaluation order**: explicit **Deny** → **SCP** → **Resource** policy → Permission **Boundary** → **Session** policy → **Identity** policy. (Mnemonic: "Deny Stops Really Powerful Session Identities.")
- **Top exam trap:** assuming the identity-based policy is evaluated first — it's actually evaluated **last**, after five other gates, and an explicit deny **anywhere** in the chain wins immediately regardless of any allow elsewhere.
- **Never forget:** an **SCP** is a ceiling only — it can never itself grant a permission, only restrict what identity policies are allowed to grant.
- **Pairs with:** Lake Formation (fine-grained data access), KMS (key policies layer on top of IAM), Secrets Manager (roles used to retrieve secrets).

---

<a name="kms"></a>
## AWS KMS

- **Purpose:** managed encryption key service — creates, controls, and audits the keys behind encryption at rest across nearly every AWS data service.
- **Trigger keyword:** "customer-managed key," "control/rotate the key," "cross-account encrypted access," "audit trail on key usage."
- **Never confuse with:** plain SSE-S3 (SSE-S3 = AWS fully manages the key, no rotation control, no per-use audit trail; SSE-**KMS** = you control policy, rotation, and get CloudTrail visibility into every key use).
- **Signature numbers:** **DSSE-KMS** = dual-layer server-side encryption (two independent encryption layers) for higher-assurance compliance needs.
- **Top exam trap:** cross-account encrypted data sharing **always** requires a **customer-managed key** with a key policy/grant — an AWS-managed key cannot be shared cross-account. (Mnemonic: "CMK = Cross-account, Mandatory Key control.")
- **Never forget:** **S3 Bucket Keys** reduce KMS API call volume/cost dramatically for high-request-rate S3+SSE-KMS workloads — this is the direct answer to "reduce our KMS costs."
- **Pairs with:** S3/EBS/Redshift/RDS (SSE-KMS at rest), IAM (key policies + grants), Secrets Manager (secrets are themselves KMS-encrypted).

---

<a name="lakeformation"></a>
## AWS Lake Formation

- **Purpose:** centralized, fine-grained (column/row/cell-level) governance and permissions layer on top of the Glue Data Catalog and S3.
- **Trigger keyword:** "column-level security," "row-level filter," "hide a specific field like SSN," "centralized data lake permissions," "LF-Tags."
- **Never confuse with:** plain IAM/S3 bucket policies (those only reach the whole-object/whole-table level, not inside a table).
- **Signature numbers:** **LF-Tags** implement tag-based access control (**TBAC**) at scale — the answer when permission management by individual grant becomes unmanageable as tables/users grow.
- **Top exam trap:** assuming an IAM policy alone can restrict access to specific columns — it structurally cannot; that's what makes this domain's "IAM can't count columns" mnemonic true.
- **Never forget:** Lake Formation permissions apply consistently across **Athena, Redshift Spectrum, EMR, and Glue** — it's the one governance layer that spans all the query engines.
- **Pairs with:** Glue Data Catalog (what it governs), IAM (underlying identity), Macie (discovers PII that LF then restricts).

---

<a name="secretsmanager"></a>
## AWS Secrets Manager

- **Purpose:** stores and automatically **rotates** genuine secrets — database credentials, API keys — with native rotation for RDS/Aurora/Redshift/DocumentDB.
- **Trigger keyword:** "automatic credential rotation," "database password," "rotate on a schedule."
- **Never confuse with:** Parameter Store (Secrets Manager = built-in rotation + higher per-secret cost; Parameter Store Standard tier = free, but no built-in rotation — you'd have to build it yourself).
- **Signature numbers:** up to **64 KB** per secret; supports **resource policies** for cross-account sharing.
- **Top exam trap:** picking Parameter Store for a scenario that explicitly needs scheduled, automatic rotation — Parameter Store has no native rotation engine.
- **Never forget:** the simple decision rule — **needs rotation or is a genuine credential → Secrets Manager; static config value → Parameter Store**. (Mnemonic: "Rotate = Manager.")
- **Pairs with:** RDS/Aurora/Redshift/DocumentDB (native rotation targets), Lambda/Glue (retrieve credentials at runtime instead of hardcoding), IAM (role-based retrieval permission).

---

<a name="cloudwatch"></a>
## Amazon CloudWatch

- **Purpose:** metrics, logs, alarms, and dashboards — the "how healthy is it" layer across every AWS service.
- **Trigger keyword:** "monitor pipeline health," "alert on a threshold," "application logs," "fast ad-hoc log search."
- **Never confuse with:** CloudTrail (CloudWatch = performance/health/**logs**; CloudTrail = **API call audit**, who did what).
- **Signature numbers per service (memorize):** Kinesis → `IteratorAgeMilliseconds`; DynamoDB → `ThrottledRequests`; Redshift → `WLMQueueLength`/`WLMQueueWaitTime`; Athena → `DataScannedInBytes`/`QueryQueueTime`; Lambda → `Throttles`/`Duration`/`Errors`; EMR → `YARNMemoryAvailablePercentage`.
- **Top exam trap:** confusing CloudWatch **Logs Insights** (fast, ad-hoc, in-place query language over log groups) with a full-text/Kibana-style search engine — for that, the answer is **OpenSearch Service**, not Logs Insights.
- **Never forget:** a **metric filter → alarm → SNS** is the standard "alert on an error pattern in logs with no code change" pattern.
- **Pairs with:** CloudTrail (logs feed CloudWatch Logs too), SNS (alarm notification), X-Ray (distributed tracing, the "where" to CloudWatch's "how").

---

<a name="cloudtrail"></a>
## AWS CloudTrail

- **Purpose:** records every API call made in the account — the definitive "who did what, when" audit trail.
- **Trigger keyword:** "audit API calls," "who deleted this resource," "compliance audit trail," "who read this object."
- **Never confuse with:** CloudWatch (CloudTrail = **actions**/API calls; CloudWatch = **metrics/health**). Also never confuse with AWS Config (CloudTrail = who called the API that changed something; Config = is the resource **configured correctly right now**).
- **Signature numbers:** **management events** = free, logged **by default**; **data events** (object-level S3 reads/writes, DynamoDB item-level activity) = cost extra and must be **explicitly enabled**.
- **Top exam trap:** assuming "who read this S3 object" is answered by default CloudTrail logging — it is not, until data events are turned on ahead of time. (Mnemonic: "Data events cost, management events don't.")
- **Never forget:** **CloudTrail Lake** provides a centralized, SQL-queryable store for historical trail data across accounts/regions — the answer when the question wants queryable, long-term, cross-account audit history.
- **Pairs with:** CloudWatch Logs (can also stream trail events there), CloudTrail Lake (SQL querying), S3 (log file storage).

---

<a name="macie"></a>
## Amazon Macie

- **Purpose:** ML-powered discovery of sensitive data (PII/PHI/credentials) in S3.
- **Trigger keyword:** "find PII automatically," "discover sensitive data in S3," "PII/PHI scanning."
- **Never confuse with:** Lake Formation (Macie **discovers**; Lake Formation **enforces** access to what's discovered — detection and enforcement are two separate services and both may appear in the same scenario). (Mnemonic: "Macie finds it, Lake Formation guards it.")
- **Signature numbers:** scans S3 buckets/objects specifically — it is not a general-purpose scanner for RDS/DynamoDB/Redshift content directly.
- **Top exam trap:** expecting Macie to also **restrict** access once it finds PII — it only reports/alerts; you still need Lake Formation, S3 policy, or KMS to actually restrict access.
- **Never forget:** Macie findings commonly feed into **EventBridge → Lambda/Step Functions** for automated remediation workflows.
- **Pairs with:** Lake Formation (enforcement after discovery), EventBridge (findings-driven automation), S3 (what it scans).

---

<a name="quicksight"></a>
## Amazon QuickSight

- **Purpose:** serverless BI and dashboarding service for enterprise-facing visualizations.
- **Trigger keyword:** "enterprise BI dashboard," "row-level security on a dashboard," "self-service visual analytics."
- **Never confuse with:** DataBrew (QuickSight = end-user dashboards/visuals; DataBrew = analyst-facing data prep/cleaning, not a dashboard tool).
- **Signature numbers:** **SPICE** = QuickSight's in-memory cache engine (fast, but data is a snapshot until refreshed) vs **direct query** (always current, but hits the source live on every view).
- **Top exam trap:** picking direct query for a workload that's read-heavy across many users hitting the same dashboard — that hammers the source database; SPICE is almost always the better default for repeated dashboard reads.
- **Never forget:** QuickSight supports **row-level security** so different viewers of the same dashboard see different rows based on their identity.
- **Pairs with:** Redshift/Athena/S3 (data sources), SPICE (caching layer).

---

<a name="s3tables"></a>
## Amazon S3 Tables

- **Purpose:** purpose-built S3 storage for **Apache Iceberg tables**, with automatic compaction, snapshot management, and optimization built in — the fully managed way to run Iceberg without hand-rolling maintenance jobs.
- **Trigger keyword:** "managed Iceberg storage," "automatic table maintenance/compaction," "Iceberg without operational overhead."
- **Never confuse with:** plain S3 + self-managed Iceberg via Glue/EMR (S3 Tables removes the need to build your own compaction/snapshot-expiration jobs — that maintenance is automatic).
- **Signature numbers:** organized into **table buckets**, a distinct S3 resource type from general-purpose buckets, optimized specifically for Iceberg table performance at scale.
- **Top exam trap:** treating S3 Tables as a completely different storage service from "S3" in general — it's still S3-backed object storage, just purpose-built and managed for the Iceberg table format.
- **Never forget:** it directly targets the operational pain of Iceberg on raw S3 — compaction, snapshot expiration, and unreferenced file cleanup all happen automatically instead of via scheduled Glue/EMR jobs.
- **Pairs with:** Athena/Redshift/EMR (Iceberg-aware query engines), Glue Data Catalog (metadata), Lake Formation (governance on top).

---

---

## Quick-reference: numbers that get tested directly

| Fact | Value |
|---|---|
| Lambda max execution time | **15 minutes** |
| Lambda max memory | **10 GB** |
| Lambda `/tmp` ephemeral storage | **10 GB** |
| Kinesis shard write throughput | 1 MB/s or 1,000 records/s |
| Kinesis shard read throughput (classic) | 2 MB/s |
| Glue G.1X worker | 4 vCPU / 16 GB — default |
| Glue G.2X worker | 8 vCPU / 32 GB — first OOM fix |
| Glue G.025X worker | 2 vCPU / 4 GB — low-volume streaming only |
| Secrets Manager max secret size | 64 KB |
| Parameter Store Standard max size | 4 KB |
| Parameter Store Advanced max size | 8 KB |
| Step Functions Standard max duration | up to 1 year |
| Step Functions Express max duration | 5 minutes |
| Glacier Flexible Retrieval minimum storage | 90 days |
| S3 durability | 11 nines (99.999999999%) |
| DynamoDB LSI | must be defined **at table creation** |
| DynamoDB GSI | can be added **anytime** |
| DEA-C01 pass score | 720 / 1000 |
| DEA-C01 questions / time | 65 questions / 130 minutes |

## Quick-reference: most-confused pairs

| Pair | The one-line differentiator |
|---|---|
| Kinesis Data Streams vs Amazon Data Firehose | KDS = you write consumer code + replay; Firehose = fully managed delivery, no consumer code, buffered |
| Glue vs EMR | Glue = serverless, catalog-native, Spark/Python-shell only; EMR = full framework choice, cluster to manage, cheapest at PB scale with Spot |
| Athena vs Redshift | Athena = serverless, pay-per-scan, no cluster; Redshift = provisioned/serverless cluster, own storage, high-concurrency BI |
| Secrets Manager vs Parameter Store | Needs rotation/is a real credential → Secrets Manager; static config value → Parameter Store |
| IAM vs Lake Formation | IAM has no concept of a column or row; Lake Formation adds column/row/cell-level filtering |
| CloudTrail vs CloudWatch | CloudTrail = who called which API (actions); CloudWatch = metrics/health/logs |
| CloudTrail vs AWS Config | CloudTrail = who changed it; Config = is it configured correctly right now |
| Macie vs Lake Formation | Macie discovers PII; Lake Formation enforces access to it |
| MSK vs Kinesis Data Streams | MSK wins only when existing Kafka investment exists; otherwise KDS is the AWS-native default |
| MWAA vs Step Functions | MWAA wins only when Airflow DAGs already exist; otherwise Step Functions is native and usually cheaper |
| DMS vs DMS Schema Conversion | DMS moves data (full load/CDC); DMS Schema Conversion converts schema/SQL/stored procedures (the retired "AWS SCT" capability) |
| SSE-S3 vs SSE-KMS | SSE-S3 = AWS manages the key, free, no audit trail; SSE-KMS = customer control, rotation, CloudTrail visibility |
| Redshift Spectrum vs Federated Query vs data sharing | Spectrum queries S3 from Redshift; Federated Query reaches into Aurora/RDS live; data sharing shares live Redshift-to-Redshift data cross-cluster/account |

---

**How to use this file the morning of the exam:** read top to bottom
once, out loud if possible. For every "Never confuse with" line, if you
can't immediately explain *why* the two services are different without
re-reading, that's your last-minute flag — go re-read that one
`02-services/*.md` file, not this whole document again.
