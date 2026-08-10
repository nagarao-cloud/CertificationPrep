# Glossary

> Every AWS service and key term used across this repo, alphabetically,
> one to three sentences each. This is a reference for looking a term
> up fast — for teaching depth, go to the matching `01-domains/` or
> `02-services/` file. Terms follow the currency corrections in
> `CLAUDE.md` §7 (e.g., Amazon Data Firehose, not "Kinesis Data
> Firehose"; DMS Schema Conversion, not standalone "AWS SCT").

**Jump to:** [A](#a) [B](#b) [C](#c) [D](#d) [E](#e) [F](#f) [G](#g)
[H](#h) [I](#i) [J](#j) [K](#k) [L](#l) [M](#m) [N](#n) [O](#o) [P](#p)
[Q](#q) [R](#r) [S](#s) [T](#t) [U](#u) [V](#v) [W](#w) [Z](#z)

---

<a name="a"></a>
## A

**ABAC (Attribute-Based Access Control)** — authorization driven by
tags/attributes on the principal and resource (e.g., IAM PrincipalTag,
LF-Tags) rather than a fixed role. Preferred over RBAC at large or
fast-growing scale where a stable role list becomes unmanageable.

**Access pattern (DynamoDB)** — the specific queries an application
will run against a table. In DynamoDB, the table/key schema must be
designed around known access patterns *before* creation, unlike a
relational database where queries can be added flexibly afterward.

**Amazon Aurora** — a MySQL/PostgreSQL-compatible managed relational
database with cloud-native, auto-scaling storage. The default OLTP
answer on this exam when a scenario needs transactional SQL and ACID
guarantees.

**Amazon Athena** — a serverless SQL query engine that reads directly
from S3 (and federated sources) with no persistent infrastructure,
billed per byte scanned.

**Amazon Data Firehose** — fully managed, near-real-time delivery of
streaming data to S3, Redshift, OpenSearch, or HTTP endpoints, with
buffering, inline Lambda transformation, and dynamic partitioning.
Current name for what was formerly called "Kinesis Data Firehose."

**Amazon DataZone** — a data management/governance service for
business-facing data discovery, cataloging, and access workflows across
an organization, distinct from the technical Glue Data Catalog.

**Amazon EMR** — managed Hadoop/Spark/Hive/Presto/Trino/HBase clusters.
Chosen for existing big-data-framework code or lowest cost per TB at
petabyte scale (with Spot on task nodes).

**Amazon EMR Serverless** — a deployment option for EMR that removes
cluster and instance-type sizing entirely; billed per job resource use.

**Amazon Kinesis Data Streams (KDS)** — a real-time, ordered, replayable
streaming ingestion service where consumers are self-managed. The
answer for "sub-second," "multiple independent consumers," or "replay"
scenarios.

**Amazon Managed Service for Apache Flink** — the current name for
what was formerly "Kinesis Data Analytics." Provides continuous stream
processing with windowing and exactly-once semantics.

**Amazon Managed Workflows for Apache Airflow (MWAA)** — managed Apache
Airflow. The right answer only when existing Airflow DAGs/investment
already exist; billed as always-on environment-hours with no idle tier.

**Amazon MSK (Managed Streaming for Apache Kafka)** — fully managed
Kafka. Chosen for existing Kafka investment (producers, Kafka Connect),
not for greenfield AWS-native streaming.

**Amazon OpenSearch Service** — full-text search and log analytics
engine with Kibana-style dashboards. Current name for what was formerly
"Amazon Elasticsearch Service."

**Amazon QuickSight** — serverless BI/dashboarding service with an
in-memory cache engine (SPICE) and row-level security for multi-tenant
dashboards.

**Amazon Redshift** — a petabyte-scale, columnar SQL data warehouse for
high-concurrency BI/analytics workloads, available as provisioned (RA3)
or Redshift Serverless (RPU-hour billing).

**Amazon S3 (Simple Storage Service)** — durable (11 nines), highly
available object storage; the default landing zone for data lakes on
this exam.

**Amazon S3 Tables** — purpose-built S3 storage for Apache Iceberg
tables with automatic compaction, snapshot management, and file cleanup
built in, removing the need to run manual Iceberg maintenance jobs.

**Amazon SNS (Simple Notification Service)** — pub/sub messaging that
immediately pushes to all subscribers of a topic.

**Amazon SQS (Simple Queue Service)** — a message queue that holds
messages until a consumer pulls them; supports standard (at-least-once,
best-effort order) and FIFO (exactly-once, strict order) queues.

**Apache Iceberg** — an open table format bringing ACID transactions,
row-level UPDATE/DELETE/MERGE, schema evolution, and time travel to
data lake tables stored on S3. The modern answer whenever a scenario
needs upserts, deletes, or point-in-time table snapshots on a data lake.

**ASCII diagram** — a plain-text architecture diagram used throughout
this repo instead of Mermaid, because it renders in every viewer.

**AWS AppFlow** — a managed integration service for moving data between
SaaS applications (Salesforce, ServiceNow, etc.) and AWS services
without custom code.

**AWS Batch** — a managed service for running batch computing jobs at
scale, provisioning the optimal compute resources automatically. Low
depth rating on this exam (recognize what it does, not deep expertise).

**AWS CloudFormation** — AWS's native Infrastructure-as-Code service,
defining resources declaratively in JSON/YAML templates.

**AWS CloudTrail** — records every API call in an account. Management
events (config-changing calls) are free and on by default; data events
(object/item-level activity) cost extra and must be explicitly enabled.

**AWS CloudTrail Lake** — a centralized, SQL-queryable store for
historical CloudTrail event data across accounts and regions.

**AWS Cloud Development Kit (CDK)** — an Infrastructure-as-Code
framework that lets you define AWS resources using general-purpose
programming languages, which synthesize to CloudFormation.

**AWS Config** — continuously evaluates whether resource configurations
comply with defined rules; answers "is this resource configured
correctly right now," distinct from CloudTrail's "who changed it."

**AWS DataSync** — a managed data transfer service for moving large
amounts of data between on-premises storage and AWS, or between AWS
storage services.

**AWS DMS (Database Migration Service)** — migrates and replicates
**data** into or out of AWS via full load (one-time) and/or CDC
(continuous change capture). Does not convert schema/stored
procedures — that's DMS Schema Conversion.

**AWS Data Exchange** — a marketplace/service for subscribing to and
using third-party data products directly within AWS.

**AWS Data Pipeline** — **retired**; no longer a valid current-exam
answer for orchestration. Use Step Functions, MWAA, or Glue workflows
instead.

**AWS Glue** — serverless, catalog-native ETL. Includes ETL jobs
(DynamicFrames, job bookmarks, worker types G.1X–G.8X plus G.025X),
Glue Streaming, Glue Studio, Glue DataBrew, Glue Data Quality (DQDL),
Glue Workflows, and the Glue Data Catalog.

**AWS Glue Data Catalog** — the central, Hive-metastore-compatible
technical metadata store used by Athena, Redshift Spectrum, EMR, and
Glue jobs alike.

**AWS Glue DataBrew** — a no-code, analyst-facing visual tool for data
profiling, cleaning, and transformation rules.

**AWS Glue Data Quality (DQDL)** — automated, codified data quality
rule checks (written in DQDL — Data Quality Definition Language) run
inline as part of a Glue job DAG, as opposed to DataBrew's manual,
interactive rules.

**AWS Glue Elastic Views** — **discontinued**; not a valid current-exam
answer.

**AWS Glue Flex** — a Glue execution class for non-urgent,
schedule-flexible jobs that runs on spare capacity at a discount with a
variable start time; never the right answer when an SLA is stated.

**AWS Glue Schema Registry** — a central registry for managing and
validating stream/message schemas (e.g., for Kafka/Kinesis payloads) as
they evolve.

**AWS Glue Workflows** — a free orchestration feature that chains only
Glue jobs, crawlers, and triggers — narrower in scope than Step
Functions, which can call any AWS service.

**AWS IAM (Identity and Access Management)** — the identity and
permission backbone for AWS API calls: users, roles, groups, and
policies. Has no concept of column/row-level restriction (that's Lake
Formation's job).

**AWS Key Management Service (KMS)** — managed encryption key service
controlling and auditing the keys behind encryption at rest across most
AWS data services; supports AWS-managed, customer-managed, and imported
keys.

**AWS Lake Formation** — a centralized governance layer providing
column/row/cell-level permissions on top of the Glue Data Catalog and
S3, consistently enforced across Athena, Redshift Spectrum, EMR, and
Glue.

**AWS Lambda** — event-driven serverless compute with hard ceilings:
15-minute max execution, 10 GB max memory, 10 GB `/tmp` ephemeral
storage.

**AWS Macie** — an ML-powered service that discovers sensitive data
(PII/PHI) in S3. Discovers; does not enforce access — that's Lake
Formation's job.

**AWS SAM (Serverless Application Model)** — an extension of
CloudFormation for packaging and deploying serverless applications,
centered on Lambda.

**AWS SCT (Schema Conversion Tool)** — **retired as a standalone
product** (December 2025 exam guide revision, v1.1). The schema/SQL/
stored-procedure conversion capability now lives inside **DMS Schema
Conversion**. Never answer "AWS SCT" as a current, separate product on
this exam.

**AWS Secrets Manager** — stores and automatically rotates genuine
secrets (database credentials, API keys), with native rotation
integration for RDS/Aurora/Redshift/DocumentDB. Max secret size 64 KB.

**AWS Step Functions** — serverless state-machine orchestration with
built-in retries, error handling, and branching. Standard (long-running,
exactly-once) and Express (short, high-volume, at-least-once) workflow
types.

**AWS Systems Manager Parameter Store** — stores configuration
values/secrets. Standard tier is free (4 KB max), Advanced tier holds
up to 8 KB. No built-in rotation engine — pick Secrets Manager when
rotation is required.

**AWS Transfer Family** — a managed SFTP/FTPS/FTP service for
transferring files into and out of S3 or EFS.

---

<a name="b"></a>
## B

**Backpressure** — the condition where a downstream consumer can't keep
up with an upstream producer's rate, requiring buffering, throttling,
or scaling to avoid data loss.

**Binlog / supplemental logging** — database change-logging mechanisms
that AWS DMS requires enabled on a source database in order to perform
CDC (change data capture).

**Broadcast join** — a join strategy that sends a small table's full
contents to every worker node, avoiding an expensive shuffle when
joining a tiny table against a huge one. One of the standard fixes for
data skew.

**Bronze/silver/gold (medallion architecture)** — a lakehouse data
organization pattern: bronze = raw/immutable ingested data, silver =
cleaned/conformed data, gold = business-level aggregated/curated data.

---

<a name="c"></a>
## C

**CDC (Change Data Capture)** — continuously capturing and propagating
row-level changes (inserts/updates/deletes) from a source database,
typically via DMS or a database's native change stream.

**Cell-level security** — the finest grain of Lake Formation
permission, restricting access to individual cell values within a
table, beyond just columns or rows.

**Columnar format** — a storage layout (e.g., Parquet, ORC) that groups
values by column rather than by row, enabling query engines to read
only the columns needed and compress similar values more effectively.

**Compound sort key (Redshift)** — a sort key type prioritizing the
leading column(s) in order; fastest for queries filtering on those
leading columns specifically, degrades for other filter patterns.

**Concurrency scaling (Redshift)** — automatically adding transient
compute capacity during bursts of concurrent queries instead of
permanently over-provisioning the cluster.

**CTAS (CREATE TABLE AS SELECT)** — an Athena SQL pattern that rewrites
query results into a new table, the standard way to convert
unpartitioned CSV into partitioned, compressed Parquet.

---

<a name="d"></a>
## D

**Data event (CloudTrail)** — object/item-level API activity logging
(e.g., S3 `GetObject`, DynamoDB item reads) — costs extra, must be
explicitly enabled, off by default. Contrast with management events.

**Data lineage** — tracking where data came from and how it was
transformed across a pipeline, for trust and auditability (e.g.,
SageMaker Lineage Tracking for ML datasets).

**Data mesh** — a decentralized data architecture pattern where
domain teams own and publish their own data products, typically
implemented on AWS with Lake Formation + Glue Catalog + DataZone/
SageMaker Catalog together.

**Data sharing (Redshift)** — live, zero-copy sharing of Redshift data
across clusters or accounts, without ETL or data duplication.

**Data skew** — an imbalance in how data is distributed across
partitions/workers, causing one task to take far longer than the rest.
Fixed via repartitioning, salting a hot key, or a broadcast join.

**DAX (DynamoDB Accelerator)** — an in-memory, microsecond-latency
read-through cache sitting in front of DynamoDB.

**Denormalization** — restructuring data to reduce joins (often by
duplicating data), common in analytics schemas (star schema) for query
speed at the cost of storage and update complexity.

**DISTKEY** — the Redshift distribution key column, used with `KEY`
distribution style to co-locate matching rows on the same compute
slice for efficient joins.

**Distribution style (Redshift)** — how table rows are physically
spread across compute nodes: `KEY` (co-locate on a join column), `ALL`
(full copy on every node, for small dimension tables), `EVEN`/`AUTO`
(spread evenly, general default).

**DLQ (Dead-Letter Queue)** — a queue that captures messages/events
that repeatedly fail processing, preventing "poison messages" from
blocking a pipeline indefinitely.

**DMS Schema Conversion** — the current name for schema/SQL/stored-
procedure conversion between database engines during a heterogeneous
DMS migration (e.g., Oracle → PostgreSQL); the capability formerly
shipped as the standalone desktop tool "AWS SCT."

**DPU (Data Processing Unit)** — the billing/capacity unit for AWS
Glue jobs; roughly 4 vCPU + 16 GB memory per DPU in the classic model,
now expressed through Glue worker types (G.1X, G.2X, etc.).

**DynamicFrame** — a Glue-specific, self-describing data structure
(built on top of Spark DataFrames) that tolerates schema
inconsistencies and integrates natively with the Glue Catalog and job
bookmarks.

**DSSE-KMS** — dual-layer server-side encryption using two independent
encryption layers, for compliance regimes requiring defense in depth
beyond single-layer SSE-KMS.

---

<a name="e"></a>
## E

**Enhanced fan-out (Kinesis)** — a Kinesis Data Streams feature giving
each registered consumer a dedicated 2 MB/s read throughput pipe per
shard, eliminating contention among multiple consumers reading the same
stream.

**Envelope encryption** — the pattern where KMS encrypts a per-object
data key, which in turn encrypts the actual data — avoids sending large
payloads to KMS directly and is how most AWS server-side encryption
works internally.

**Event source mapping (Lambda)** — the mechanism connecting Lambda to
a streaming/queue source (Kinesis, DynamoDB Streams, SQS) so Lambda is
invoked automatically as new records arrive.

**Exactly-once (semantics)** — a delivery/processing guarantee that
each message is processed exactly one time, no duplicates, no loss —
expensive/hard to guarantee end-to-end; often achieved practically via
idempotent writes instead of true exactly-once transport.

**Explicit deny** — an IAM policy statement that denies an action; an
explicit deny anywhere in the policy evaluation chain wins immediately,
overriding any allow elsewhere.

---

<a name="f"></a>
## F

**Fact table** — the central table in a star schema holding
quantitative, transactional measurements (e.g., sales amount), joined
to surrounding dimension tables.

**Fan-in / fan-out** — architectural patterns where many sources
converge into one pipeline (fan-in) or one source's data is distributed
to many consumers (fan-out).

**FIFO queue (SQS)** — a queue variant guaranteeing strict message
order and exactly-once processing within a message group, at lower
throughput than a standard queue.

**Full load (DMS)** — a one-time copy of all existing source data to
the target, typically followed by CDC to keep the target current going
forward.

---

<a name="g"></a>
## G

**G.1X / G.2X / G.4X / G.8X / G.025X** — AWS Glue worker types.
G.1X (4 vCPU/16 GB) is the default; G.2X (8 vCPU/32 GB) is the standard
first fix for an out-of-memory job; G.4X/G.8X handle large joins/
shuffles; G.025X is for low-volume streaming jobs only.

**Glue Crawler** — a Glue component that scans a data source, infers
schema, and populates/updates the Glue Data Catalog with tables and
partitions.

**Glue job bookmark** — Glue's mechanism for tracking already-processed
data so incremental jobs don't reprocess it; reset (not disabled) to
force full historical reprocessing.

**GSI (Global Secondary Index)** — a DynamoDB index with a different
partition/sort key than the base table; can be added at any time after
table creation.

---

<a name="h"></a>
## H

**Hidden partitioning (Iceberg)** — Apache Iceberg's ability to manage
physical partition transforms internally, so queries don't need to
reference partition columns explicitly to benefit from partition
pruning.

**HNSW (Hierarchical Navigable Small World)** — a vector index type
offering high recall for similarity search, at the cost of higher
memory usage, used in RAG/semantic search workloads.

**Hot shard (Kinesis)** — a shard receiving disproportionate traffic
due to a skewed partition key, causing throttling; fixed by a better
partition key design and/or resharding, not by uniformly adding shards.

---

<a name="i"></a>
## I

**Idempotency** — designing an operation (e.g., a conditional write or
upsert with a dedup key) so that processing the same event multiple
times produces the same end state as processing it once — the practical
way pipelines achieve correctness without needing true exactly-once
delivery.

**Identity-based policy** — an IAM policy attached directly to a user,
group, or role; evaluated last in the IAM policy evaluation order,
after deny, SCP, resource policy, permission boundary, and session
policy checks.

**Implicit deny** — the default IAM outcome when no policy explicitly
allows an action — AWS denies by default.

**Interleaved sort key (Redshift)** — a sort key type giving roughly
equal weight to multiple columns, better than a compound key for
varied filter patterns, at a higher VACUUM/maintenance cost.

**IteratorAge (`GetRecords.IteratorAgeMilliseconds`)** — the signature
Kinesis Data Streams CloudWatch metric; a rising value means consumers
are falling behind the stream.

**IVF (Inverted File index)** — a vector index type offering lower
memory use and faster index build than HNSW, at somewhat lower recall.

---

<a name="j"></a>
## J

**JDBC / ODBC** — standard database connectivity protocols used by
Glue, EMR, and other AWS services to connect to relational data
sources.

---

<a name="k"></a>
## K

**Key salting** — appending random data to a value before hashing, used
in data masking/anonymization to prevent re-identification via
dictionary or rainbow-table attacks.

**KPU-hour** — the billing unit for Amazon Managed Service for Apache
Flink (Kinesis Processing Unit-hour), analogous to Glue's DPU-hour.

---

<a name="l"></a>
## L

**Lakehouse** — an architecture combining data-lake flexibility (S3,
open formats) with data-warehouse features (ACID transactions, schema
enforcement) — typically implemented today via Apache Iceberg on S3.

**Least privilege** — the security principle of granting only the
minimum permissions required for a task, typically implemented via
narrowly scoped custom IAM policies.

**LF-Tags** — Lake Formation's tag-based access control (TBAC)
mechanism, used to manage permissions at scale instead of granting
individually per table/column.

**LSI (Local Secondary Index)** — a DynamoDB index sharing the base
table's partition key but with a different sort key; must be defined
at table creation and cannot be added later.

---

<a name="m"></a>
## M

**Management event (CloudTrail)** — control-plane API activity (e.g.,
creating/deleting resources); free and logged by default, distinct from
data events.

**MERGE** — a SQL operation performing conditional insert/update/delete
in one statement, supported natively by Apache Iceberg tables for
upsert workloads.

**Materialized view (Redshift)** — a pre-computed, cached query result
that avoids re-scanning and re-joining base tables on every execution
of a frequently repeated expensive query.

**Medallion architecture** — see bronze/silver/gold.

**MSCK REPAIR TABLE** — a Hive/Athena SQL command that syncs partition
metadata with the Glue Data Catalog by scanning the underlying storage;
expensive at high partition counts, which is why partition projection
often replaces it.

---

<a name="n"></a>
## N

**Near real-time** — AWS's term licensing buffered, batched delivery
(e.g., Amazon Data Firehose's ~60-second buffer, zero-ETL's
seconds-to-minutes lag) — distinct from "real-time"/"sub-second," which
licenses Kinesis Data Streams or Managed Flink. One of the most
frequently tested word-choice traps on this exam.

**Normalization** — structuring relational data to minimize redundancy
(e.g., snowflake schema); traded off against denormalization for
analytics query speed.

---

<a name="o"></a>
## O

**On-demand mode (DynamoDB)** — a capacity mode billing per request
with no capacity planning, best for unpredictable/spiky traffic.

---

<a name="p"></a>
## P

**Partition projection (Athena)** — computing partition values from a
defined pattern instead of looking them up in the Glue Data Catalog,
eliminating the need for crawlers/MSCK REPAIR at very high partition
counts (millions of partitions).

**Partition pruning** — skipping irrelevant data partitions entirely
based on a query filter, instead of scanning them — the single highest-
leverage cost/performance lever for partitioned data.

**Permission boundary** — an IAM feature setting the maximum
permissions an identity-based policy can grant to a specific principal;
a ceiling scoped to that principal, not org-wide like an SCP.

**PII / PHI** — Personally Identifiable Information / Protected Health
Information; the categories of sensitive data Amazon Macie is built to
discover in S3.

**Poison message** — a message that repeatedly fails processing and
would block a queue/stream indefinitely if not diverted to a DLQ.

**Predicate pushdown** — applying query filters at the storage/format
layer (e.g., Parquet row-group statistics, Redshift zone maps) instead
of after data is pulled into compute.

---

<a name="q"></a>
## Q

**Quorum / consistency** — general distributed-systems concepts
underlying S3's strong read-after-write consistency and DynamoDB's
choice between eventually consistent and strongly consistent reads.

---

<a name="r"></a>
## R

**RA3 nodes (Redshift)** — Redshift's provisioned node type using
Redshift Managed Storage, decoupling compute scaling from storage
scaling.

**RBAC (Role-Based Access Control)** — authorization based on a small,
stable set of job-function roles (Analyst, Engineer, Admin); contrast
with ABAC for dynamic, attribute-driven access at scale.

**Replayability** — the ability to re-process historical stream data
after the fact; a native Kinesis Data Streams capability (bounded by
retention period), not available in Amazon Data Firehose.

**Reserved concurrency (Lambda)** — a Lambda setting that guarantees
and caps the concurrent execution capacity available to a specific
function.

**Resource-based policy** — an IAM policy attached directly to a
resource (e.g., an S3 bucket policy, a KMS key policy) rather than to
an identity; can independently grant access, including cross-account.

**Row-level security** — restricting which rows a user can see within
a table, implemented via Lake Formation data filters, Redshift dynamic
data masking, or QuickSight row-level security depending on the layer.

**RPU (Redshift Processing Unit)** — the billing/capacity unit for
Redshift Serverless, billed per RPU-hour, scaling to zero when idle.

---

<a name="s"></a>
## S

**SCD (Slowly Changing Dimension)** — a data-modeling pattern for
tracking how dimension values change over time. Type 1 overwrites (no
history), Type 2 adds a new row per change (full history), Type 3 adds
a column for the previous value (limited history).

**SCP (Service Control Policy)** — an AWS Organizations-level policy
acting as a ceiling on what identity policies in member accounts may
grant; can never itself grant a permission.

**Session policy** — a policy passed when assuming a role (temporary
credentials) that further restricts what the session may do below what
the role's own identity policy allows.

**Shard (Kinesis)** — the base unit of throughput in Kinesis Data
Streams; each shard supports 1 MB/s (or 1,000 records/s) write and
2 MB/s read (without enhanced fan-out).

**Snapshot (Iceberg)** — a versioned, point-in-time view of an Iceberg
table's state, enabling time travel (querying the table as of a
previous snapshot) and safe schema/data evolution.

**Snowflake schema** — a normalized variant of the star schema where
dimension tables are further broken into sub-dimensions, reducing
redundancy at the cost of more joins.

**Sort key** — the Redshift column(s) determining physical row
ordering on disk, enabling zone-map-based block skipping; compound
(leading-column priority) or interleaved (equal multi-column weight).

**SPICE (QuickSight)** — QuickSight's in-memory caching engine,
producing fast dashboard queries against a snapshot of the data that
must be explicitly refreshed to stay current.

**SSE-C / SSE-KMS / SSE-S3** — S3 server-side encryption variants:
customer-provided key (SSE-C), AWS KMS-managed key with rotation/audit
control (SSE-KMS), and AWS-fully-managed key with no rotation control
(SSE-S3).

**Star schema** — a denormalized analytics schema with a central fact
table joined directly (one hop) to surrounding dimension tables;
optimized for query simplicity and speed.

**Stateful vs stateless (data transactions)** — stateful transactions
depend on prior context/history (e.g., running aggregates, sessions);
stateless transactions are independently processable with no memory of
prior events.

---

<a name="t"></a>
## T

**TBAC (Tag-Based Access Control)** — see LF-Tags; access control
driven by tags applied to resources and principals rather than
individual grants.

**Time travel (Iceberg)** — querying an Iceberg table as of a previous
snapshot, enabled by Iceberg's snapshot versioning.

**TTL (Time to Live)** — a DynamoDB feature that automatically deletes
items after a specified timestamp, at zero write-capacity cost.

---

<a name="u"></a>
## U

**UNLOAD** — a Redshift SQL command that exports query results from
the cluster to S3, typically in Parquet or delimited format.

**Upsert** — an operation that inserts a row if it doesn't exist or
updates it if it does; natively supported by Iceberg's MERGE and by
DynamoDB conditional writes.

---

<a name="v"></a>
## V

**Vector index** — a data structure (e.g., HNSW, IVF) enabling fast
approximate nearest-neighbor similarity search over embedding vectors,
used for RAG/semantic search.

**VPC endpoint (gateway)** — a free routing mechanism for private
traffic to S3 or DynamoDB that avoids NAT Gateway data-processing
charges.

**VPC endpoint (interface / PrivateLink)** — a private connection to
most other AWS services via an ENI in your VPC; incurs hourly and data
processing charges, unlike the free gateway endpoint type.

---

<a name="w"></a>
## W

**WLM (Workload Management, Redshift)** — Redshift's query queue
management system controlling how concurrent queries are prioritized
and resourced; available as manual WLM or Auto WLM.

**WORM (Write Once, Read Many)** — a compliance storage requirement
implemented in S3 via Versioning + Object Lock in compliance mode, not
achievable through IAM or bucket policy alone.

---

<a name="z"></a>
## Z

**Zero-ETL** — a direct, pipeline-free integration between two AWS
services (e.g., Aurora → Redshift, DynamoDB → OpenSearch) requiring no
Glue job or custom code; the preferred answer when a scenario pairs
"operational database" with "near real-time analytics" and "minimal
operational overhead."

**Zone map (Redshift)** — per-block min/max value metadata that lets
Redshift skip blocks that can't satisfy a query filter, the mechanism
underlying sort-key performance gains.
