# Flashcards — Drill Deck

> 180 terse Q/A pairs for pure recall drilling. Not prose — if you want
> the explanation behind an answer, that lives in the matching
> `01-domains/DOMAIN-N-*.md` or `02-services/*.md` file. Cover the
> answer, read the question, say the answer out loud, then check.
> Organized by domain, with a final cross-cutting numbers section.

---

## Domain 1 — Data Ingestion and Transformation (55 cards)

**Q:** What is the current name for what used to be called "Kinesis Data Firehose"?
**A:** Amazon Data Firehose.

**Q:** What is the current name for what used to be called "Kinesis Data Analytics"?
**A:** Amazon Managed Service for Apache Flink.

**Q:** Which CloudWatch metric indicates Kinesis Data Streams consumers are falling behind?
**A:** `GetRecords.IteratorAgeMilliseconds`.

**Q:** How do you fix a Kinesis "hot shard"?
**A:** Improve the partition key distribution and/or reshard — not just add shards uniformly.

**Q:** What write throughput does one Kinesis shard support?
**A:** 1 MB/s or 1,000 records/second.

**Q:** What read throughput does one classic (non-enhanced-fan-out) Kinesis shard support?
**A:** 2 MB/s.

**Q:** When should you use Kinesis enhanced fan-out?
**A:** When multiple consumers each need dedicated, full read throughput without contention.

**Q:** Kinesis Data Streams vs Amazon Data Firehose — key difference?
**A:** KDS = you write consumer code, supports replay; Firehose = fully managed delivery, no consumer code, buffered, no replay.

**Q:** What does "near real-time" license on this exam?
**A:** Buffered/batched delivery — Amazon Data Firehose, zero-ETL — as opposed to "real-time"/"sub-second," which licenses Kinesis Data Streams or Managed Flink.

**Q:** When is Amazon MSK the right answer over Kinesis Data Streams?
**A:** When there's an existing Kafka investment (producers, consumers, Kafka Connect) — not for greenfield AWS-only workloads.

**Q:** What does MSK Connect do?
**A:** Runs Kafka Connect connectors without you managing the Connect cluster.

**Q:** AWS DMS full load vs CDC?
**A:** Full load = one-time historical data copy; CDC = continuous, ongoing change capture after the full load.

**Q:** What does DMS require enabled on the source database for CDC?
**A:** Binlog / supplemental logging.

**Q:** What converts schema DDL, stored procedures, and views between database engines?
**A:** DMS Schema Conversion (the capability formerly shipped as the standalone "AWS SCT" desktop tool, now retired/out of scope).

**Q:** Limited LOB mode vs full LOB mode in DMS?
**A:** Limited = fast but truncates large objects; full = complete but slow.

**Q:** What is zero-ETL?
**A:** A direct, pipeline-free integration (e.g., Aurora/DynamoDB → Redshift) with no Glue job or custom code required.

**Q:** When does zero-ETL become the exam's preferred answer?
**A:** When a question pairs "operational database" + "near real-time analytics" + "minimal operational overhead."

**Q:** DMS can target which streaming services?
**A:** Kinesis Data Streams or Amazon MSK.

**Q:** What's the Lambda max execution time?
**A:** 15 minutes.

**Q:** What's the Lambda max memory?
**A:** 10 GB.

**Q:** What's the Lambda `/tmp` ephemeral storage limit?
**A:** 10 GB.

**Q:** Reserved vs provisioned Lambda concurrency?
**A:** Reserved = guarantees and caps capacity for a function; provisioned = pre-warms execution environments to eliminate cold starts.

**Q:** What's the relative cost ordering for transform compute at small/medium scale?
**A:** Lambda < Glue < EMR (this flips at petabyte scale with Spot task nodes, where EMR becomes cheapest per TB).

**Q:** Which Glue worker type fixes a job OOM by default?
**A:** G.2X (8 vCPU / 32 GB) — the standard first upgrade from the G.1X default.

**Q:** What's G.025X used for?
**A:** Low-volume Glue streaming jobs only.

**Q:** DynamicFrame vs DataFrame in Glue?
**A:** DynamicFrame handles schema flexibility/semi-structured data and integrates natively with the Glue Catalog and job bookmarks; DataFrame is the standard rigid-schema Spark structure.

**Q:** What are Glue job bookmarks for?
**A:** Tracking already-processed data so incremental jobs don't reprocess it.

**Q:** How do you force a Glue job to reprocess all historical data?
**A:** Reset the bookmark — don't just disable it.

**Q:** What is Glue Flex execution class for?
**A:** Non-urgent, schedule-flexible jobs run on spare capacity at a discount, with variable start time — never use it when there's an SLA.

**Q:** EMR primary node Spot rule?
**A:** Never use Spot on the primary node — losing it kills the whole cluster.

**Q:** EMR core node Spot rule?
**A:** Risky — core nodes hold HDFS data; losing them risks data loss.

**Q:** EMR task node Spot rule?
**A:** This is where Spot goes — task nodes are compute-only, no HDFS data, and this is the exam's default correct answer.

**Q:** What removes EMR cluster/instance-sizing decisions entirely?
**A:** EMR Serverless.

**Q:** When is EMR the right choice over Glue?
**A:** Existing Spark/Hive/Presto code, or a framework Glue doesn't expose, or lowest cost per TB at petabyte scale with Spot.

**Q:** What does Managed Service for Apache Flink specialize in?
**A:** Continuous stream processing with windowing and exactly-once semantics.

**Q:** Standard vs Express Step Functions?
**A:** Standard = long-running (up to 1 year), exactly-once, priced per state transition; Express = up to 5 min, at-least-once, high-volume, priced per invocation+duration.

**Q:** What Step Functions state runs parallel iterations over a collection?
**A:** The Map state.

**Q:** When is MWAA the right answer?
**A:** When existing Airflow DAGs/investment already exist — not for greenfield orchestration.

**Q:** How is MWAA billed?
**A:** Always-on environment-hours — no idle/free tier.

**Q:** Glue Workflows vs Step Functions?
**A:** Glue Workflows only chains Glue jobs/crawlers/triggers (free); Step Functions orchestrates any AWS service.

**Q:** EventBridge vs SNS?
**A:** EventBridge routes based on event content/pattern matching from many sources; SNS is simpler pub/sub fan-out on a single topic.

**Q:** What's the current answer for "simple scheduled trigger"?
**A:** EventBridge Scheduler.

**Q:** What does EventBridge Pipes do?
**A:** Connects a source directly to a target with optional filter/enrich/transform steps, without a custom glue Lambda.

**Q:** What is idempotency, in pipeline terms?
**A:** Designing writes (conditional PutItem, upsert/MERGE, dedup key) so repeated delivery of the same event doesn't corrupt state — solving correctness without needing true exactly-once delivery.

**Q:** SQS FIFO vs standard queue?
**A:** FIFO guarantees order and exactly-once processing within a message group; standard is best-effort ordering, at-least-once, higher throughput.

**Q:** What is a DLQ for?
**A:** Capturing messages/events that fail repeated processing attempts ("poison messages") so they don't block the queue indefinitely.

**Q:** SNS vs SQS, one-line?
**A:** SNS pushes immediately to subscribers; SQS parks messages until a consumer pulls them.

**Q:** What causes the "small file problem"?
**A:** Over-partitioning or high-frequency small writes producing many tiny files, which hurts both storage efficiency and query engine overhead.

**Q:** What is predicate pushdown?
**A:** Applying filters at the storage/format layer (e.g., Parquet row-group stats) instead of after data is pulled into compute.

**Q:** What is partition pruning?
**A:** Skipping irrelevant partitions entirely based on a query filter, instead of scanning them.

**Q:** ETL vs ELT, in one line?
**A:** ETL transforms before loading into the target; ELT loads raw data first and transforms inside the target (e.g., Redshift SQL).

**Q:** What are the three EMR node roles?
**A:** Primary (coordinator), core (compute + HDFS data), task (compute only).

**Q:** What connects containers (ECS/EKS/Fargate) to this domain?
**A:** They're used to optimize/scale containerized transformation workloads when Glue/Lambda/EMR don't fit the workload shape.

**Q:** What is AWS SAM used for?
**A:** Packaging and deploying serverless applications (Lambda-centric), an extension of CloudFormation.

**Q:** Is AWS CodeCommit still in scope for DEA-C01?
**A:** No — removed from the in-scope services list in the December 2025 exam guide revision (v1.1).

---

## Domain 2 — Data Store Management (45 cards)

**Q:** S3 durability?
**A:** 11 nines (99.999999999%).

**Q:** S3 Standard vs S3 Express One Zone?
**A:** Standard = multi-AZ; Express One Zone = single-AZ, sub-10ms latency, for latency-sensitive high-throughput access.

**Q:** True WORM answer in S3?
**A:** Versioning + Object Lock in compliance mode — not IAM, not bucket policy alone.

**Q:** S3 Intelligent-Tiering vs explicit lifecycle rules?
**A:** Intelligent-Tiering for unknown/unpredictable access patterns; lifecycle rules when the access pattern/schedule is known.

**Q:** Glacier Deep Archive retrieval time?
**A:** Up to 12 hours.

**Q:** Glacier Flexible Retrieval minimum storage duration?
**A:** 90 days.

**Q:** Redshift RA3 nodes' key feature?
**A:** Redshift Managed Storage — decouples compute and storage scaling.

**Q:** Redshift Serverless billing unit?
**A:** RPU-hours; scales to zero when idle.

**Q:** Distribution style KEY — when?
**A:** Large tables frequently joined on a common column.

**Q:** Distribution style ALL — when?
**A:** Small dimension tables.

**Q:** Distribution style EVEN/AUTO — when?
**A:** Default/general-purpose distribution when no single join key dominates.

**Q:** Compound vs interleaved sort keys?
**A:** Compound = fast for queries filtering on the leading column(s), in order; interleaved = equal weight to multiple columns, better for varied filter patterns, higher maintenance cost.

**Q:** What are zone maps?
**A:** Per-block min/max value metadata Redshift uses to skip blocks that can't match a filter — the mechanism behind sort key performance.

**Q:** Redshift Spectrum vs Federated Query vs data sharing?
**A:** Spectrum queries S3 from Redshift; Federated Query reaches live into Aurora/RDS; data sharing shares live Redshift data cross-cluster/account with zero copy.

**Q:** What speeds up a repeated expensive Redshift aggregate query?
**A:** A materialized view.

**Q:** Redshift concurrency scaling — purpose?
**A:** Adds transient capacity during query bursts instead of permanently over-provisioning for peak concurrency.

**Q:** Athena billing model?
**A:** Pay per byte scanned — no persistent infrastructure.

**Q:** What enforces a per-query data-scanned cost cap in Athena?
**A:** Athena workgroup query limits.

**Q:** Fix for "too many partitions" / slow Athena partition discovery?
**A:** Athena partition projection — compute partition values from a pattern, skip Glue Catalog lookups and MSCK REPAIR.

**Q:** What does Athena CTAS do?
**A:** Rewrites query results into a new table — the standard fix for converting raw CSV into partitioned Parquet.

**Q:** DynamoDB GSI vs LSI — creation timing?
**A:** GSI can be added anytime after table creation; LSI must be defined at table creation.

**Q:** Correct way to analyze DynamoDB data for BI without hurting production?
**A:** Export to S3, then query with Athena/Glue/Redshift Spectrum — never a live table Scan.

**Q:** DynamoDB TTL cost characteristic?
**A:** Auto-expires items at zero write-capacity cost.

**Q:** DynamoDB Streams use case?
**A:** Change-event feed for CDC-like downstream processing (Lambda, etc.).

**Q:** Aurora vs Redshift, in one line?
**A:** Aurora = OLTP, operational, row-oriented, low-latency transactions; Redshift = OLAP, analytical, columnar, big aggregate scans.

**Q:** Aurora Serverless v2 scaling unit?
**A:** ACUs (Aurora Capacity Units), fine-grained, no disruptive resize event.

**Q:** Central technical metadata store on AWS?
**A:** Glue Data Catalog.

**Q:** What auto-discovers schema and partitions for the Glue Catalog?
**A:** Glue Crawlers.

**Q:** What open table format enables upsert/delete/time-travel on S3 data?
**A:** Apache Iceberg.

**Q:** Iceberg vs Hive-style tables — row-level updates?
**A:** Iceberg supports row-level UPDATE/DELETE/MERGE natively; Hive-style requires rewriting whole partitions.

**Q:** What is Amazon S3 Tables?
**A:** Purpose-built S3 storage for Iceberg tables with automatic compaction, snapshot management, and maintenance built in.

**Q:** What does the Iceberg feature "hidden partitioning" avoid?
**A:** Requiring users to know/specify physical partition columns in every query — Iceberg manages the partition transform internally.

**Q:** Star schema vs snowflake schema?
**A:** Star = denormalized dimensions, one join hop to facts, faster/simpler; snowflake = normalized dimensions, more joins, less redundancy.

**Q:** SCD Type 1 vs Type 2 vs Type 3?
**A:** Type 1 = overwrite (no history); Type 2 = new row per change (full history); Type 3 = new column for previous value (limited history).

**Q:** What converts a schema/SQL/stored-procedures during a heterogeneous DMS migration?
**A:** DMS Schema Conversion (Oracle → PostgreSQL is the classic example).

**Q:** What tracks ML dataset-to-model relationships as AWS data lineage?
**A:** SageMaker Lineage Tracking.

**Q:** Fast bulk load into Redshift from S3?
**A:** The COPY command.

**Q:** Export Redshift data to S3?
**A:** The UNLOAD command.

**Q:** Best NoSQL schema design starting point?
**A:** Access-pattern-first design — define query patterns before the table/key schema.

**Q:** DAX purpose?
**A:** Microsecond-latency, in-memory read caching in front of DynamoDB.

**Q:** HNSW vs IVF vector index?
**A:** HNSW = highest recall, more memory; IVF = lower memory, faster build, somewhat lower recall.

**Q:** Aurora PostgreSQL + pgvector use case?
**A:** Semantic/RAG vector search alongside relational data in one database.

**Q:** Fully managed end-to-end RAG pipeline service?
**A:** Amazon Bedrock Knowledge Bases.

**Q:** What protects against accidental object overwrite/delete in S3?
**A:** S3 Versioning.

**Q:** OpenSearch Service's role in this domain?
**A:** Full-text/log search and analytics, often as a downstream target from Kinesis/Firehose/DMS.

---

## Domain 3 — Data Operations and Support (40 cards)

**Q:** CloudWatch metric for Kinesis consumer lag?
**A:** `GetRecords.IteratorAgeMilliseconds`.

**Q:** CloudWatch metric for DynamoDB capacity problems?
**A:** `ThrottledRequests` / `ConsumedReadCapacityUnits`.

**Q:** CloudWatch metric for Redshift query queuing?
**A:** `WLMQueueLength`, `WLMQueueWaitTime`.

**Q:** CloudWatch metric for Athena cost/concurrency issues?
**A:** `DataScannedInBytes`, `QueryQueueTime`.

**Q:** CloudWatch metrics for Lambda health?
**A:** `Throttles`, `Duration`, `Errors`.

**Q:** CloudWatch metric for undersized EMR clusters?
**A:** `YARNMemoryAvailablePercentage`, `ContainerPending`.

**Q:** CloudWatch metric for Glue OOM/skew?
**A:** Driver/executor memory utilization, `numFailedTasks`.

**Q:** CloudWatch Logs Insights vs OpenSearch Service?
**A:** Logs Insights = fast, ad-hoc, in-place query language over log groups; OpenSearch = full-text/Kibana-style search and dashboards.

**Q:** What pattern alerts on an error in logs with no code change?
**A:** CloudWatch Logs metric filter → alarm → SNS.

**Q:** CloudTrail management events vs data events?
**A:** Management events = free, on by default; data events (object/item-level) = cost extra, must be explicitly enabled.

**Q:** What answers "who read this specific S3 object"?
**A:** CloudTrail data events (only if enabled beforehand).

**Q:** What provides centralized, SQL-queryable historical CloudTrail data?
**A:** CloudTrail Lake.

**Q:** Glue Data Quality vs DataBrew rules?
**A:** Glue Data Quality (DQDL) is automated/codified inside a Glue job DAG; DataBrew rules are interactive/manual, defined by an analyst.

**Q:** What language defines Glue Data Quality rules?
**A:** DQDL (Data Quality Definition Language).

**Q:** What discovers PII/PHI in S3 automatically?
**A:** Amazon Macie.

**Q:** Macie vs Lake Formation, in one line?
**A:** Macie discovers PII; Lake Formation enforces access to it.

**Q:** QuickSight SPICE vs direct query?
**A:** SPICE = fast in-memory cache, snapshot until refreshed; direct query = always current, hits the source live on every view.

**Q:** What provides per-viewer row-level filtering on a QuickSight dashboard?
**A:** Row-level security.

**Q:** Provisioned vs serverless tradeoff — general rule?
**A:** Steady/predictable/high utilization → provisioned + reserved; spiky/unpredictable → serverless.

**Q:** What troubleshooting order do you follow for pipeline issues?
**A:** Problem → Metrics → Logs → Resource analysis → fix ("PMLR") — never skip straight to "add resources."

**Q:** Three fixes for data skew?
**A:** Repartition (general unevenness), salt-and-reaggregate (one hot key), broadcast join (tiny table + huge table).

**Q:** What indicates a Glue job is reprocessing the same data repeatedly?
**A:** Job bookmark not enabled or not persisting correctly.

**Q:** What's the fix to reprocess ALL historical data in Glue?
**A:** Reset (not disable) the bookmark.

**Q:** Stratified sampling — when?
**A:** To fairly represent a small but critical subgroup within a larger dataset sample.

**Q:** Cluster sampling — when?
**A:** To cheaply profile a huge partitioned dataset without reading everything.

**Q:** What extracts logs specifically for compliance audits?
**A:** CloudTrail (API-level) combined with CloudWatch Logs (application-level), often centralized via CloudTrail Lake.

**Q:** MWAA cost characteristic that makes it rarely the "cheap" answer?
**A:** Always-on environment-hours billing with no idle/free tier.

**Q:** SDK usage pattern tested in this domain?
**A:** Calling AWS services programmatically (e.g., boto3) rather than through the console for automation.

**Q:** What no-code tool profiles and cleans data for analysts?
**A:** AWS Glue DataBrew.

**Q:** What lets you run interactive Spark exploration without managing a cluster?
**A:** Athena for Apache Spark notebooks.

**Q:** What investigates data consistency issues across a pipeline?
**A:** Comparing source/target record counts and checksums, often via DMS validation tasks or Glue Data Quality rules.

**Q:** What four dimensions does data validation typically check?
**A:** Completeness, consistency, accuracy, integrity.

**Q:** Signature Redshift WLM problem symptom?
**A:** Rising `WLMQueueLength`/`WLMQueueWaitTime` — queries queuing, consider concurrency scaling or WLM tuning.

**Q:** What replaced manual WLM tuning for many workloads?
**A:** Auto WLM.

**Q:** X-Ray's role among monitoring tools?
**A:** Distributed tracing — answers "where" in a request's path the latency/failure occurred.

**Q:** AWS Config's role vs CloudTrail?
**A:** Config = is the resource configured correctly right now; CloudTrail = who called the API that changed it.

**Q:** What service chains only Glue jobs/crawlers/triggers for free?
**A:** Glue Workflows.

**Q:** Rolling average / grouping / pivoting — where are these typically done?
**A:** SQL in Redshift/Athena, or Spark in Glue/EMR, depending on data location and scale.

**Q:** What does "verify and clean data" typically map to on this exam?
**A:** Glue DataBrew profiling/transforms or Glue Data Quality rule checks.

**Q:** What's the standard fix when one Glue/Spark task takes far longer than the rest?
**A:** Data skew — repartition, salt the key, or use a broadcast join.

---

## Domain 4 — Data Security and Governance (35 cards)

**Q:** IAM policy evaluation order (top to bottom)?
**A:** Explicit Deny → SCP → Resource-based policy → Permission boundary → Session policy → Identity-based policy → (implicit deny if nothing allowed).

**Q:** Mnemonic for IAM evaluation order?
**A:** "Deny Stops Really Powerful Session Identities" — Deny, SCP, Resource, Boundary, Session, Identity.

**Q:** What always wins immediately in IAM evaluation, regardless of any allow?
**A:** An explicit deny, anywhere in the chain.

**Q:** Can an SCP grant a permission by itself?
**A:** No — it's a ceiling only; it can restrict or permit what identity policies are allowed to grant, never grant directly.

**Q:** Secrets Manager vs Parameter Store — the core question?
**A:** Does it need automatic rotation, or is it a genuine credential? → Secrets Manager. Static config value? → Parameter Store.

**Q:** Secrets Manager max secret size?
**A:** 64 KB.

**Q:** Parameter Store Standard tier max size / cost?
**A:** 4 KB, free.

**Q:** Parameter Store Advanced tier max size?
**A:** 8 KB.

**Q:** What has built-in native rotation for RDS/Aurora/Redshift/DocumentDB?
**A:** Secrets Manager.

**Q:** RBAC vs ABAC vs Lake Formation column/row security — decision driver?
**A:** Specific column/row filter needed → Lake Formation. Small stable set of job functions → RBAC. Dynamic/growing attribute-driven access → ABAC (IAM PrincipalTag or LF-Tags).

**Q:** What does IAM structurally lack that Lake Formation adds?
**A:** Any concept of a column or row — IAM only reaches whole-resource level.

**Q:** What are LF-Tags?
**A:** Tag-based access control (TBAC) for Lake Formation — the scalable alternative to individual per-table/per-column grants.

**Q:** SSE-S3 vs SSE-KMS?
**A:** SSE-S3 = AWS manages the key, free, no rotation/audit control; SSE-KMS = customer-managed policy, rotation control, CloudTrail visibility into key use.

**Q:** What is DSSE-KMS?
**A:** Dual-layer server-side encryption — two independent encryption layers for higher-assurance compliance needs.

**Q:** What reduces KMS API call cost for high-request-rate S3 workloads?
**A:** S3 Bucket Keys.

**Q:** Cross-account encrypted data sharing requirement?
**A:** Always needs a customer-managed KMS key with a key policy/grant — an AWS-managed key cannot be shared cross-account.

**Q:** Mnemonic for cross-account KMS?
**A:** "CMK = Cross-account, Mandatory Key control."

**Q:** Encryption in transit, standard mechanism?
**A:** TLS / HTTPS / SSL.

**Q:** CloudTrail management events — cost and default state?
**A:** Free, logged by default.

**Q:** CloudTrail data events — cost and default state?
**A:** Cost extra, must be explicitly enabled, off by default.

**Q:** What provides centralized, SQL-queryable audit history across accounts/regions?
**A:** CloudTrail Lake.

**Q:** Security Group vs Network ACL?
**A:** Security Group = stateful, instance/ENI-level; NACL = stateless, subnet-level.

**Q:** Mnemonic for Security Group vs NACL?
**A:** "SSSS" — Stateful Security groups vs Stateless subnet NACLs.

**Q:** Gateway VPC endpoint — which services, cost?
**A:** S3 and DynamoDB only; free.

**Q:** Interface VPC endpoint (PrivateLink) — cost?
**A:** Hourly + data processing charges (not free), used for most other AWS services.

**Q:** What discovers PII across S3 with ML?
**A:** Amazon Macie.

**Q:** What enforces column/row/cell-level permissions consistently across Athena, Redshift Spectrum, EMR, and Glue?
**A:** Lake Formation.

**Q:** What detects configuration drift ("is this resource configured correctly")?
**A:** AWS Config.

**Q:** What provides live, zero-copy Redshift-to-Redshift data sharing?
**A:** Redshift data sharing.

**Q:** What prevents backups/replication to unauthorized regions, org-wide?
**A:** An SCP with a region condition (plus region-scoped AWS Backup vaults).

**Q:** What provides row-level masking that varies by querying user in Redshift?
**A:** Redshift dynamic data masking.

**Q:** Is standalone "AWS SCT" still a valid current-exam answer?
**A:** No — retired; the capability is now DMS Schema Conversion, part of the DMS console.

**Q:** Authentication vs Authorization, one line?
**A:** Authentication = proving who you are; authorization = what you're allowed to do once identified.

**Q:** What's the governance/discovery catalog for business users (vs the technical Glue Catalog)?
**A:** Amazon DataZone / SageMaker Catalog.

**Q:** Principle of least privilege — practical IAM implementation?
**A:** Custom, narrowly scoped IAM policies limiting both actions and resources to the minimum required, rather than managed/broad policies.

---

## Cross-cutting exam facts (15 cards)

**Q:** DEA-C01 number of questions and time limit?
**A:** 65 questions, 130 minutes.

**Q:** DEA-C01 passing score?
**A:** 720 out of a scaled 100–1000.

**Q:** Is DEA-C01 scoring compensatory or does each domain need a minimum?
**A:** Compensatory — no per-domain minimum, only the total matters.

**Q:** DEA-C01 domain weights?
**A:** Domain 1 (Ingestion & Transformation) 34%, Domain 2 (Data Store Management) 26%, Domain 3 (Operations & Support) 22%, Domain 4 (Security & Governance) 18%.

**Q:** DEA-C01 exam cost?
**A:** $150 USD + tax.

**Q:** DEA-C01 retake wait period?
**A:** 14 days between attempts.

**Q:** DEA-C01 certification validity period?
**A:** 3 years.

**Q:** Is there a penalty for a wrong answer on this exam?
**A:** No — never leave a question blank; guess if unsure.

**Q:** What accommodation can non-native English speakers request?
**A:** +30 minutes, requested and approved before booking.

**Q:** What retired AWS service should never be picked as a current pipeline-orchestration answer?
**A:** AWS Data Pipeline — retired; use Step Functions, MWAA, or Glue workflows instead.

**Q:** What Glue feature was discontinued and should never be picked?
**A:** Glue Elastic Views.

**Q:** Current name for "Amazon Elasticsearch Service"?
**A:** Amazon OpenSearch Service.

**Q:** House-style rule: "least operational overhead" vs "cheapest"?
**A:** AWS's exam style generally prefers the fully managed/serverless answer over a technically cheaper self-managed one, except when the question is explicitly about lowest cost at petabyte scale.

**Q:** What two AWS services were removed from the DEA-C01 in-scope list in the December 2025 exam guide revision (v1.1)?
**A:** The standalone AWS Schema Conversion Tool (SCT) and AWS CodeCommit.

**Q:** What master mental-map layer sits "underneath" the Sources → Ingest → Store → Process → Serve pipeline, cutting across all of it?
**A:** Catalog (Glue Data Catalog), Govern (Lake Formation), Observe (CloudWatch/CloudTrail), and Secure (IAM/KMS) — Domain 4 lives almost entirely in this cross-cutting layer.
