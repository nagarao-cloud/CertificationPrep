# Beginner Practice — DEA-C01 (30 questions)

> **Level:** single-concept recall. Each question tests whether you know
> what one service does, or can match a one-line description to the
> right service — not multi-constraint scenario reasoning. That's
> `Intermediate.md` and `Advanced.md`.
>
> **Domain split (proportional to exam weight):** Domain 1 (Data
> Ingestion & Transformation) 10 · Domain 2 (Data Store Management) 8 ·
> Domain 3 (Data Operations & Support) 7 · Domain 4 (Data Security &
> Governance) 5.
>
> Part 1 is questions only — no answers visible. Part 2 is the answer
> key with every option explained. Don't peek until you've answered all 30.

---

## Part 1 — Questions

**Q1.** Which AWS service is purpose-built to deliver streaming data into S3, Redshift, or OpenSearch Service with the least operational overhead, but provides no replay capability?

A. Kinesis Data Streams
B. Amazon Data Firehose
C. Amazon MSK
D. Amazon Managed Service for Apache Flink

---

**Q2.** A team needs a stream that supports multiple independent consumers reading the same data and the ability to replay the last several days of events. Which service?

A. Amazon Data Firehose
B. Amazon SNS
C. Kinesis Data Streams
D. Amazon SQS Standard

---

**Q3.** Which AWS service continuously replicates changes from an on-premises Oracle database to an AWS target using change data capture (CDC)?

A. AWS Glue
B. AWS DMS
C. AWS Snowball
D. AWS Transfer Family

---

**Q4.** Which serverless AWS service runs Apache Spark ETL jobs and is natively integrated with the AWS Glue Data Catalog?

A. Amazon EMR
B. AWS Glue ETL
C. AWS Lambda
D. Amazon Redshift

---

**Q5.** Which service lets business analysts visually explore, clean, and normalize a dataset without writing code?

A. AWS Glue Studio
B. AWS Glue DataBrew
C. Amazon Athena
D. Amazon QuickSight

---

**Q6.** A company must transfer 300 TB of archival data into AWS from a site with limited and unreliable internet bandwidth, as a one-time migration. Which service is designed for exactly this?

A. AWS DataSync
B. AWS Transfer Family
C. AWS Snowball Edge
D. Amazon S3 Transfer Acceleration

---

**Q7.** Which AWS service is a fully managed, Kafka-protocol-compatible streaming platform, used when a team wants to lift-and-shift an existing Kafka workload?

A. Kinesis Data Streams
B. Amazon MSK
C. Amazon Data Firehose
D. Amazon Managed Service for Apache Flink

---

**Q8.** Which AWS service provides a fully managed SFTP/FTPS/FTP endpoint so external partners can upload files directly into S3?

A. AWS DataSync
B. AWS Transfer Family
C. AWS Snowball
D. Amazon API Gateway

---

**Q9.** A financial firm wants to subscribe to a licensed, regularly updated third-party dataset and have it delivered directly into S3 or Redshift, without writing or maintaining any custom ingestion code. Which service?

A. AWS AppFlow
B. AWS Data Exchange
C. Amazon Kendra
D. Amazon API Gateway

---

**Q10.** Which AWS service routes a single event to multiple downstream targets based on filtering rules that inspect the event's content?

A. Amazon SQS
B. Amazon SNS
C. Amazon EventBridge
D. AWS Step Functions

---

**Q11.** Which AWS service is a fully managed, petabyte-scale cloud data warehouse designed for complex SQL joins and BI dashboards used by many concurrent analysts?

A. Amazon Athena
B. Amazon Redshift
C. Amazon DynamoDB
D. Amazon OpenSearch Service

---

**Q12.** Which AWS service lets you run ad-hoc SQL queries directly against data stored in S3, with no infrastructure to provision, paying only per query?

A. Amazon Redshift Spectrum
B. Amazon Athena
C. Amazon EMR
D. Amazon RDS

---

**Q13.** Which AWS service is a fully managed, key-value and document NoSQL database offering single-digit-millisecond latency at virtually unlimited scale?

A. Amazon Aurora
B. Amazon DynamoDB
C. Amazon DocumentDB
D. Amazon Neptune

---

**Q14.** Which S3 storage class is intended for data that is almost never accessed, needs to be retained for 7–10 years for compliance, and can tolerate up to 12 hours to retrieve?

A. S3 Standard-IA
B. S3 Glacier Instant Retrieval
C. S3 Glacier Deep Archive
D. S3 Intelligent-Tiering

---

**Q15.** Which open table format, when used on top of S3, adds ACID transactions, schema evolution, and time-travel/snapshot querying to data lake tables?

A. Plain Hive-style partitioned Parquet
B. Apache Iceberg
C. Apache Avro
D. ORC

---

**Q16.** A media company wants Iceberg-native table storage in S3 with automatic compaction, snapshot management, and file cleanup handled by AWS, without scheduling any maintenance jobs themselves. Which service?

A. Amazon Redshift managed storage
B. Amazon S3 Tables
C. Amazon EMR with a scheduled Spark job
D. AWS Glue DataBrew

---

**Q17.** Which AWS service provides a cloud data warehouse with no capacity to provision or manage, automatically scaling and billing only for compute actually used, ideal for unpredictable or intermittent workloads?

A. Amazon Redshift with Reserved Instances
B. Amazon Redshift Serverless
C. Amazon Athena
D. Amazon RDS

---

**Q18.** Which AWS service provides intelligent, natural-language search across a company's internal documents (PDFs, wikis, file shares), returning direct answers or highlighted passages rather than a list of matching files?

A. Amazon OpenSearch Service
B. Amazon Kendra
C. Amazon Athena
D. AWS Glue Data Catalog

---

**Q19.** Which AWS service lets you run Apache Spark and Hive jobs without provisioning or managing any EC2 clusters, billing only while a job is actually running?

A. Amazon EMR on EC2
B. Amazon EMR Serverless
C. AWS Glue DataBrew
D. Amazon Redshift Spectrum

---

**Q20.** Which AWS service provides a SQL-like query interface for interactively searching and analyzing CloudWatch Logs, without exporting logs to another tool?

A. AWS X-Ray
B. CloudWatch Logs Insights
C. Amazon Athena
D. AWS Config

---

**Q21.** Which AWS service traces a single request end-to-end as it flows across multiple services (such as API Gateway, Lambda, and Step Functions), helping pinpoint exactly where latency is introduced?

A. AWS CloudTrail
B. AWS X-Ray
C. Amazon CloudWatch Alarms
D. AWS Config

---

**Q22.** Which AWS service lets you build serverless workflows with visual branching logic, built-in retries with backoff, and a durable execution history?

A. Amazon EventBridge Scheduler
B. AWS Step Functions
C. AWS Glue Workflows
D. Amazon SQS

---

**Q23.** A team already has dozens of complex Apache Airflow DAGs with custom Python dependencies and wants a managed AWS service that runs them largely unchanged. Which service?

A. AWS Step Functions
B. Amazon Managed Workflows for Apache Airflow (MWAA)
C. AWS Glue Workflows
D. Amazon EventBridge Scheduler

---

**Q24.** Which AWS service lets a team define declarative data quality rules (checking things like completeness, uniqueness, and value ranges) and automatically fail a pipeline when those rules are violated?

A. Amazon Macie
B. AWS Glue Data Quality (DQDL)
C. AWS Glue DataBrew
D. AWS Config

---

**Q25.** Which AWS business intelligence service offers an in-memory caching layer (SPICE) so dashboards stay fast for many concurrent viewers without repeatedly hitting the underlying data warehouse?

A. Amazon Athena
B. Amazon QuickSight
C. Amazon Redshift materialized views
D. Amazon Managed Grafana

---

**Q26.** Which mechanism lets a message-processing system set aside messages that repeatedly fail to process, so they don't block the rest of the queue?

A. A visibility timeout increase
B. A dead-letter queue (DLQ)
C. Increasing the number of retries indefinitely
D. Deleting and recreating the queue

---

**Q27.** Which AWS service centrally manages fine-grained (including column- and row-level) permissions on data cataloged in the AWS Glue Data Catalog, applying consistently across Athena, Redshift Spectrum, and EMR?

A. IAM policies alone
B. AWS Lake Formation
C. Amazon Macie
D. Amazon Cognito

---

**Q28.** Which AWS service automatically discovers and classifies sensitive data, such as PII, across S3 buckets using machine learning and pattern matching?

A. AWS Config
B. Amazon Macie
C. AWS Glue Data Quality
D. Amazon Inspector

---

**Q29.** Which AWS service is purpose-built to store and automatically rotate database credentials such as usernames and passwords, with native integration for services like RDS?

A. AWS Systems Manager Parameter Store
B. AWS Secrets Manager
C. AWS KMS
D. AWS IAM Identity Center

---

**Q30.** Which type of AWS CloudTrail event must be explicitly enabled to record individual object-level reads and writes on an S3 bucket (they are not recorded by default)?

A. Management events
B. Data events
C. Insight events
D. Console sign-in events

---

## Part 2 — Answer Key & Explanations

### Q1 — Correct: B (Amazon Data Firehose)
- **A. Kinesis Data Streams.** Wrong — Data Streams *does* support replay via configurable retention; the question describes the service that has *no* replay, which is Firehose.
- **B. Amazon Data Firehose.** Correct — Firehose is a fully managed delivery service: point it at S3/Redshift/OpenSearch and it handles buffering, batching, and delivery with no infrastructure to manage, but it retains nothing once delivered — no replay.
- **C. Amazon MSK.** Wrong — MSK is a managed Kafka cluster; it has ongoing broker infrastructure and does support replay via topic retention, the opposite of what's described.
- **D. Amazon Managed Service for Apache Flink.** Wrong — Flink is a stream *processing* engine, not a delivery service; it doesn't natively land raw data into S3.
**Memory hook:** Firehose = "fire and forget," never a replay answer.

### Q2 — Correct: C (Kinesis Data Streams)
- **A. Amazon Data Firehose.** Wrong — one destination only, no replay.
- **B. Amazon SNS.** Wrong — pub/sub fan-out to subscribers, but no built-in multi-day replay of past messages.
- **C. Kinesis Data Streams.** Correct — supports many independent consumers (via shards, or dedicated throughput with enhanced fan-out) and configurable retention up to 365 days for replay.
- **D. Amazon SQS Standard.** Wrong — a message is deleted once consumed; it isn't designed for multiple independent full-stream consumers or replay.

### Q3 — Correct: B (AWS DMS)
- **A. AWS Glue.** Wrong — Glue is an ETL/transformation service; it can extract from a database but isn't built around continuous CDC replication.
- **B. AWS DMS.** Correct — DMS is purpose-built for one-time full-load migrations and continuous CDC replication from a huge range of source databases.
- **C. AWS Snowball.** Wrong — Snowball is a physical device for bulk offline data transfer, not continuous database replication.
- **D. AWS Transfer Family.** Wrong — Transfer Family provides managed SFTP/FTPS file transfer, unrelated to database CDC.

### Q4 — Correct: B (AWS Glue ETL)
- **A. Amazon EMR.** Wrong — EMR runs Spark too, but requires managing (or at minimum configuring) a cluster; it isn't the "serverless, catalog-native" answer.
- **B. AWS Glue ETL.** Correct — serverless Spark jobs that read/write through the Glue Data Catalog by default.
- **C. AWS Lambda.** Wrong — Lambda doesn't run Spark; it's a general-purpose function-execution service with a 15-minute ceiling.
- **D. Amazon Redshift.** Wrong — a data warehouse, not an ETL engine.

### Q5 — Correct: B (AWS Glue DataBrew)
- **A. AWS Glue Studio.** Wrong — Glue Studio is a visual *job-building* tool that still produces a Spark ETL job aimed at engineers, not a no-code exploration/cleaning tool for analysts.
- **B. AWS Glue DataBrew.** Correct — DataBrew is explicitly designed for non-coders to profile, clean, and normalize data through a point-and-click interface.
- **C. Amazon Athena.** Wrong — requires writing SQL.
- **D. Amazon QuickSight.** Wrong — a BI/visualization tool, not a data-cleaning tool.

### Q6 — Correct: C (AWS Snowball Edge)
- **A. AWS DataSync.** Wrong — DataSync moves data over a network connection; with "limited and unreliable" bandwidth, it's a poor fit for hundreds of terabytes.
- **B. AWS Transfer Family.** Wrong — SFTP/FTPS file transfer over the internet, same bandwidth problem.
- **C. AWS Snowball Edge.** Correct — a physical device shipped to the site, loaded locally, then shipped back to AWS for import — bypasses the network entirely for exactly this scenario.
- **D. S3 Transfer Acceleration.** Wrong — speeds up uploads over existing internet paths; doesn't solve a fundamentally limited/unreliable connection at this scale.

### Q7 — Correct: B (Amazon MSK)
- **A. Kinesis Data Streams.** Wrong — a similar concept but not Kafka-protocol-compatible; existing Kafka producers/consumers can't talk to it unchanged.
- **B. Amazon MSK.** Correct — wire-compatible with Apache Kafka, so existing producers, consumers, and Kafka Connect connectors work with minimal change.
- **C. Amazon Data Firehose.** Wrong — a delivery service, not a Kafka-compatible broker.
- **D. Amazon Managed Service for Apache Flink.** Wrong — a processing engine, not a message broker.

### Q8 — Correct: B (AWS Transfer Family)
- **A. AWS DataSync.** Wrong — DataSync is for scheduled/ongoing transfer between storage systems, not a partner-facing SFTP endpoint.
- **B. AWS Transfer Family.** Correct — managed SFTP/FTPS/FTP servers that land uploaded files directly in S3 (or EFS).
- **C. AWS Snowball.** Wrong — a physical bulk-transfer device, not an interactive upload endpoint.
- **D. Amazon API Gateway.** Wrong — built for API traffic, not file-transfer protocols like SFTP.

### Q9 — Correct: B (AWS Data Exchange)
- **A. AWS AppFlow.** Wrong — AppFlow connects to named SaaS applications (Salesforce, Slack, etc.) via their APIs; it isn't a marketplace for licensed third-party datasets.
- **B. AWS Data Exchange.** Correct — the AWS marketplace for subscribing to third-party data products, with delivery configured directly into S3 or Redshift and no custom ingestion pipeline to build.
- **C. Amazon Kendra.** Wrong — an intelligent search service over documents, unrelated to dataset subscriptions.
- **D. Amazon API Gateway.** Wrong — used to expose your *own* APIs, not to consume licensed datasets.

### Q10 — Correct: C (Amazon EventBridge)
- **A. Amazon SQS.** Wrong — a point-to-point queue with no built-in content-based routing to multiple targets.
- **B. Amazon SNS.** Wrong — supports fan-out to many subscribers and basic filter policies, but EventBridge's rule-based content routing across many targets and event buses is the more purpose-built answer for content-based multi-target routing.
- **C. Amazon EventBridge.** Correct — rules evaluate event content and route matching events to potentially many different targets.
- **D. AWS Step Functions.** Wrong — orchestrates a defined sequence of steps, not event-driven fan-out routing.

### Q11 — Correct: B (Amazon Redshift)
- **A. Amazon Athena.** Wrong — great for ad-hoc, pay-per-query access to S3 data, but degrades under high concurrency and heavy joins compared to a warehouse.
- **B. Amazon Redshift.** Correct — the petabyte-scale MPP columnar warehouse purpose-built for complex joins and concurrent BI workloads.
- **C. Amazon DynamoDB.** Wrong — a NoSQL key-value store, not suited to complex analytical SQL joins.
- **D. Amazon OpenSearch Service.** Wrong — built for search and log analytics, not general BI/SQL warehousing.

### Q12 — Correct: B (Amazon Athena)
- **A. Amazon Redshift Spectrum.** Wrong — requires an existing Redshift cluster; the question describes needing *no* infrastructure at all.
- **B. Amazon Athena.** Correct — serverless, pay-per-query SQL directly over S3 data via the Glue Data Catalog.
- **C. Amazon EMR.** Wrong — requires cluster provisioning (or at least EMR Serverless configuration), more than "no infrastructure."
- **D. Amazon RDS.** Wrong — a relational database service; doesn't query data sitting in S3.

### Q13 — Correct: B (Amazon DynamoDB)
- **A. Amazon Aurora.** Wrong — a relational (SQL) database, not key-value/document.
- **B. Amazon DynamoDB.** Correct — fully managed NoSQL key-value/document store with single-digit-millisecond latency at any scale.
- **C. Amazon DocumentDB.** Wrong — a MongoDB-compatible document database; a real option but not the one AWS most associates with this exact one-line description on the exam, and it isn't a key-value store.
- **D. Amazon Neptune.** Wrong — a graph database for relationship traversal, not key-value access.

### Q14 — Correct: C (S3 Glacier Deep Archive)
- **A. S3 Standard-IA.** Wrong — much more expensive for 7–10 year retention than a Glacier tier, and doesn't have a 12-hour retrieval characteristic (it's instant).
- **B. S3 Glacier Instant Retrieval.** Wrong — retrieval is milliseconds, not up to 12 hours; also costs more to store than Deep Archive.
- **C. S3 Glacier Deep Archive.** Correct — the cheapest storage class, designed for 7–10+ year compliance retention, with standard retrieval up to about 12 hours.
- **D. S3 Intelligent-Tiering.** Wrong — designed for unknown/changing access patterns, not long-term known-cold archival, and carries a monitoring fee.

### Q15 — Correct: B (Apache Iceberg)
- **A. Plain Hive-style partitioned Parquet.** Wrong — no ACID transactions, no time travel, and schema changes generally require rewriting data.
- **B. Apache Iceberg.** Correct — an open table format adding ACID transactions, snapshot/time-travel querying, and in-place schema evolution over files in S3.
- **C. Apache Avro.** Wrong — a row-based serialization/file format, not a table format with transactions or time travel.
- **D. ORC.** Wrong — a columnar file format, same category error as Avro.

### Q16 — Correct: B (Amazon S3 Tables)
- **A. Amazon Redshift managed storage.** Wrong — this is Redshift's own internal storage, not S3-based Iceberg tables with automatic maintenance.
- **B. Amazon S3 Tables.** Correct — purpose-built Iceberg-native table storage in S3 with automatic compaction, snapshot management, and unreferenced-file cleanup, with no maintenance jobs to schedule.
- **C. Amazon EMR with a scheduled Spark job.** Wrong — this is exactly the manual maintenance the question says the team wants to avoid.
- **D. AWS Glue DataBrew.** Wrong — a data-prep tool, unrelated to table storage or Iceberg maintenance.

### Q17 — Correct: B (Amazon Redshift Serverless)
- **A. Redshift with Reserved Instances.** Wrong — RIs are a discount for steady, predictable usage, the opposite of "unpredictable or intermittent."
- **B. Amazon Redshift Serverless.** Correct — no capacity to provision, scales automatically, and bills for compute actually consumed — ideal for spiky/intermittent workloads.
- **C. Amazon Athena.** Wrong — a valid serverless query engine, but the question is specifically about a data *warehouse*, which points to Redshift Serverless.
- **D. Amazon RDS.** Wrong — an operational relational database, not an analytical warehouse.

### Q18 — Correct: B (Amazon Kendra)
- **A. Amazon OpenSearch Service.** Wrong — powerful full-text search, but it returns ranked documents/results from an index you build, not natural-language direct answers out of the box.
- **B. Amazon Kendra.** Correct — an ML-powered enterprise search service that understands natural-language questions and returns direct answers or highlighted passages from documents.
- **C. Amazon Athena.** Wrong — a SQL query engine, not a document search/Q&A service.
- **D. AWS Glue Data Catalog.** Wrong — a metadata catalog for tables/schemas, not a document search tool.

### Q19 — Correct: B (Amazon EMR Serverless)
- **A. Amazon EMR on EC2.** Wrong — still requires provisioning and configuring a cluster (even with managed scaling), unlike the "no clusters to manage" requirement.
- **B. Amazon EMR Serverless.** Correct — runs Spark/Hive without provisioning or managing EC2 clusters, billing only while jobs run.
- **C. AWS Glue DataBrew.** Wrong — a visual data-prep tool, not a Spark/Hive execution engine.
- **D. Amazon Redshift Spectrum.** Wrong — a query feature of Redshift, not a Spark/Hive runtime.

### Q20 — Correct: B (CloudWatch Logs Insights)
- **A. AWS X-Ray.** Wrong — traces requests across distributed services; it doesn't provide SQL-like search over log content.
- **B. CloudWatch Logs Insights.** Correct — a purpose-built, SQL-like interactive query language over CloudWatch Logs, with no export needed.
- **C. Amazon Athena.** Wrong — could query logs if they were exported to S3 first, which the question explicitly rules out ("without exporting logs to another tool").
- **D. AWS Config.** Wrong — tracks resource configuration compliance, not log content.

### Q21 — Correct: B (AWS X-Ray)
- **A. AWS CloudTrail.** Wrong — records API calls/account activity, not application-level request tracing across services.
- **B. AWS X-Ray.** Correct — purpose-built distributed tracing, showing exactly where latency accumulates across a request's path through multiple services.
- **C. Amazon CloudWatch Alarms.** Wrong — triggers on metric thresholds, doesn't trace individual requests.
- **D. AWS Config.** Wrong — configuration compliance tracking, unrelated to request tracing.

### Q22 — Correct: B (AWS Step Functions)
- **A. Amazon EventBridge Scheduler.** Wrong — triggers things on a schedule; no branching logic or execution history in the workflow sense.
- **B. AWS Step Functions.** Correct — visual state machines with Choice states for branching, native Retry/Catch configuration, and a durable execution history.
- **C. AWS Glue Workflows.** Wrong — scoped specifically to chaining Glue jobs/crawlers, not general-purpose branching workflows.
- **D. Amazon SQS.** Wrong — a queue, not an orchestration/workflow service.

### Q23 — Correct: B (Amazon MWAA)
- **A. AWS Step Functions.** Wrong — would require rewriting all the DAGs as state machines, not running them "largely unchanged."
- **B. Amazon MWAA.** Correct — a managed Apache Airflow environment that runs existing DAGs and Python dependencies with minimal changes.
- **C. AWS Glue Workflows.** Wrong — scoped to Glue jobs/crawlers, not general Airflow DAGs.
- **D. Amazon EventBridge Scheduler.** Wrong — a cron-like scheduler, not an Airflow-compatible orchestrator.

### Q24 — Correct: B (AWS Glue Data Quality / DQDL)
- **A. Amazon Macie.** Wrong — discovers and classifies sensitive data (PII); it doesn't evaluate business rules like completeness or ranges.
- **B. AWS Glue Data Quality (DQDL).** Correct — declarative Data Quality Definition Language rules with automatic pass/fail evaluation that can halt a pipeline.
- **C. AWS Glue DataBrew.** Wrong — exploratory profiling for humans, not an automated pass/fail gate.
- **D. AWS Config.** Wrong — evaluates AWS resource configuration compliance, not dataset content.

### Q25 — Correct: B (Amazon QuickSight)
- **A. Amazon Athena.** Wrong — a query engine with no in-memory caching layer for dashboards.
- **B. Amazon QuickSight.** Correct — SPICE is QuickSight's in-memory engine that keeps dashboards fast for many concurrent viewers without re-querying the source every time.
- **C. Redshift materialized views.** Wrong — speeds up queries inside Redshift, but isn't a BI dashboarding tool with its own caching layer for viewers.
- **D. Amazon Managed Grafana.** Wrong — a metrics/observability dashboarding tool, not the AWS-native BI service with SPICE.

### Q26 — Correct: B (Dead-letter queue)
- **A. Increase visibility timeout.** Wrong — controls how long a message is hidden after being received; doesn't isolate permanently failing messages.
- **B. Dead-letter queue (DLQ).** Correct — the standard mechanism to set aside messages that repeatedly fail, unblocking the rest of the queue.
- **C. Increase retries indefinitely.** Wrong — delays the problem and can block the queue longer for a message that will never succeed.
- **D. Delete and recreate the queue.** Wrong — destructive and not a sustainable, automatable pattern.

### Q27 — Correct: B (AWS Lake Formation)
- **A. IAM policies alone.** Wrong — IAM operates on buckets/prefixes/API actions; it has no native concept of column- or row-level restrictions on cataloged data.
- **B. AWS Lake Formation.** Correct — the governance layer that enforces fine-grained (table, column, row) permissions consistently across Athena, Redshift Spectrum, and EMR.
- **C. Amazon Macie.** Wrong — discovers sensitive data; it doesn't enforce access permissions.
- **D. Amazon Cognito.** Wrong — manages application user identities/authentication, not data-catalog permissions.

### Q28 — Correct: B (Amazon Macie)
- **A. AWS Config.** Wrong — tracks resource configuration compliance, not data content.
- **B. Amazon Macie.** Correct — purpose-built to use ML and pattern matching to discover and classify sensitive data like PII across S3.
- **C. AWS Glue Data Quality.** Wrong — evaluates data quality rules (nulls, ranges), not sensitive-data discovery.
- **D. Amazon Inspector.** Wrong — a vulnerability/security-posture scanner for compute resources, not a data-classification tool.

### Q29 — Correct: B (AWS Secrets Manager)
- **A. Parameter Store.** Wrong — can store secrets, but automatic rotation with native RDS/Aurora/DocumentDB/Redshift integration is Secrets Manager's defining feature; Parameter Store's built-in rotation support is far more limited.
- **B. AWS Secrets Manager.** Correct — purpose-built for secrets with native automatic rotation integrations.
- **C. AWS KMS.** Wrong — manages encryption keys, not credential storage/rotation itself.
- **D. AWS IAM Identity Center.** Wrong — manages human workforce access/SSO, not application database credentials.

### Q30 — Correct: B (Data events)
- **A. Management events.** Wrong — record control-plane actions (creating/deleting resources, changing configuration); they do not record individual object reads/writes and are on by default, which the question says isn't enough.
- **B. Data events.** Correct — must be explicitly enabled per resource and record object-level S3 API activity like `GetObject`/`PutObject`.
- **C. Insight events.** Wrong — detect unusual API call-volume patterns, not routine object-level access logging.
- **D. Console sign-in events.** Wrong — records authentication activity, unrelated to S3 object access.

---

## Score yourself

| Score | Read as |
|---|---|
| 27–30 / 30 | Solid recall foundation — move to `Intermediate.md` |
| 21–26 / 30 | Good, but review the specific services you missed in `00-START-HERE/SERVICE-SELECTION-MATRIX.md` |
| Below 21 / 30 | Revisit the relevant `01-domains/DOMAIN-*.md` file before continuing |
