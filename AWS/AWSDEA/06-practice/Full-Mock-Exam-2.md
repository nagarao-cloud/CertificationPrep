# Full Mock Exam 2 — DEA-C01 (65 questions, 130 minutes)

> **Self-contained.** Unlike Mock Exam 1 (which splits into
> `Full-Mock-Exam-1.md` + `Answer-Key.md` + `Explanations.md`), this
> file holds all three parts on its own: **Part 1** is the 65
> questions with no answers visible, **Part 2** is a compact answer
> key, **Part 3** is the full explanation for every option of every
> question. Domain weighting is **22/17/14/12** (Domain 1/2/3/4),
> matching the same 34/26/22/18% split scaled to 65 questions that
> Mock Exam 1 used — but every scenario below is new, and questions
> are shuffled with no domain grouping visible, exactly like the real
> exam.

## Instructions — read before starting

- **65 questions, 130 minutes.** Two minutes per question — pace
  yourself.
- **No notes, no pausing, no looking anything up.** Simulate real exam
  conditions completely.
- **Do not scroll to Part 2 or Part 3 until you've recorded an answer
  for all 65 questions.** Write your answers on paper or in a separate
  document as you go.
- **Passing is 720/1000 (scaled), roughly 70–75% correct (~46+/65).**
  Scoring is compensatory — no per-domain minimum.
- **No penalty for a wrong answer.** Never leave a question blank.
- Most questions have **four options, pick one**. Questions marked
  **"(Choose TWO)"** have five options and require exactly two answers
  — no partial credit.
- Questions are in **randomized order**, not grouped by domain.

When you finish, jump to Part 2 to score yourself, then read every
explanation in Part 3 — right and wrong answers alike, per the 10-Day
Plan's Day 9 review discipline.

---

# Part 1 — Questions

**Q1.** A hospital's wearable patient-vitals monitors report readings
continuously across a 900-bed campus, with the fleet size changing
week to week as units are added or taken offline for maintenance. The
clinical alerting team needs sub-second access to new readings and
explicitly does not want nursing informatics staff calculating or
adjusting stream capacity as the fleet changes.

A. Kinesis Data Streams in provisioned mode, sized generously to leave headroom.
B. Kinesis Data Streams in on-demand capacity mode.
C. Amazon Data Firehose, since it removes all capacity planning.
D. Amazon MSK Serverless, since Kafka scales automatically by default.

---

**Q2.** A proprietary trading desk's risk-scoring service reads and
writes a small, extremely hot working set of position data thousands
of times per second, entirely within a single Availability Zone, and
needs the lowest possible single-digit-millisecond-to-microsecond S3
access latency for this specific workload. Data outside this hot
working set has normal multi-AZ durability needs and stays elsewhere.

A. S3 Standard with S3 Transfer Acceleration enabled.
B. S3 Express One Zone for the hot working set specifically.
C. S3 Intelligent-Tiering for the hot working set.
D. S3 Standard-IA, since infrequent access has the lowest per-request latency.

---

**Q3.** A retail company's checkout API has been intermittently
throwing errors for two days. The on-call engineer wants to search
across several Lambda functions' CloudWatch Logs for all `ERROR`-level
entries containing a specific `order_id` from the last 48 hours, using
a query language, without first exporting anything to another service.

A. AWS X-Ray annotations search.
B. CloudWatch Logs Insights.
C. Amazon Athena with a manual export step first.
D. AWS Config resource timeline.

---

**Q4.** *(Choose TWO)* A bank's trade-settlement platform requires
that three independent systems — clearing, regulatory reporting, and
internal risk — each read the full stream of trade events
independently, and regulatory reporting must be able to reprocess the
last 10 days of trades after a rule change, without any system's
consumption pattern affecting another's throughput.

A. Configure the stream's retention period to at least 10 days.
B. Enable enhanced fan-out so each of the three consumers gets a dedicated throughput pipe.
C. Route all three systems through a single Amazon Data Firehose delivery stream.
D. Use SQS FIFO queues, one per consumer, fed by the trade-processing application directly.
E. Reduce shard count to the minimum to lower cost, since retention alone satisfies replay.

---

**Q5.** A hospital's Glue ETL jobs run inside a VPC with no NAT gateway
or internet gateway and must reach S3 privately with no added hourly
or per-GB data-processing charge for that connectivity.

A. A NAT gateway configured for outbound-only S3 access.
B. A gateway VPC endpoint for S3.
C. An interface VPC endpoint (AWS PrivateLink) for S3.
D. A public S3 endpoint reached through a restrictive security group.

---

**Q6.** An industrial IoT company ingests turbine-sensor telemetry
into an Apache Iceberg data lake and currently spends significant
engineer-hours each month manually scheduling compaction, snapshot
expiration, and orphan-file cleanup jobs. They want AWS to manage this
table maintenance automatically, with full Athena and EMR
compatibility preserved.

A. Continue with Iceberg on a standard S3 bucket, but schedule the maintenance jobs on EventBridge instead of manually.
B. Migrate to Amazon S3 Tables for Iceberg-native storage with automatic compaction, snapshot management, and cleanup.
C. Move the tables into Amazon Redshift managed storage.
D. Switch to Delta Lake on a Databricks-managed cluster for its automated maintenance.

---

**Q7.** A parcel-logistics company needs delivery-scan events queryable
in S3 within roughly 2 minutes, partitioned by carrier, with the least
operational overhead. There is exactly one downstream consumer and no
replay requirement.

A. Kinesis Data Streams with a Lambda consumer writing partitioned files every 2 minutes.
B. Amazon Data Firehose with dynamic partitioning on `carrier`.
C. Amazon MSK with a Kafka Connect S3 sink connector.
D. An AWS Glue streaming job polling the source every 2 minutes.

---

**Q8.** A telecom's compliance officer needs an ongoing, queryable
record of exactly which IAM principal reads or writes specific
subscriber-billing objects in an S3 bucket, going forward. CloudTrail
management events are already enabled account-wide but have never
captured this kind of object-level activity.

A. Continue relying on the existing management event history.
B. Enable CloudTrail data events for the specific S3 bucket.
C. Enable S3 Server Access Logging only, since it's simpler than CloudTrail.
D. Enable VPC Flow Logs on the VPC hosting the analytics workloads.

---

**Q9.** *(Choose TWO)* An insurance company's underwriting team in
Account A must share SSE-KMS-encrypted (customer-managed key) claims
data in S3 with a reinsurance partner's Account B for a joint risk
model, without duplicating the data.

A. Grant the partner account's IAM role `s3:GetObject` via the bucket policy.
B. Add a statement to the KMS key policy granting the partner account's role `kms:Decrypt`.
C. Make the bucket public and rely on the key policy alone for protection.
D. Re-encrypt the data with SSE-S3 first to simplify cross-account access.
E. Ask the partner to assume a role with `s3:*` and `kms:*` in their own account only.

---

**Q10.** A government tax-records data warehouse in Redshift
distributes its `filings` fact table with `DISTKEY` on `filing_state`
(51 distinct values including territories). Query plans increasingly
show a small number of slices absorbing most of the join work against
a `taxpayers` dimension table joined on the same column, because
filing volume is heavily concentrated in a handful of large states.

A. Add more nodes to spread the existing distribution across more slices.
B. Change `filings`' distribution key to a higher-cardinality join column, or use `DISTSTYLE AUTO`.
C. Add a sort key on `filing_state` to accelerate the join.
D. Change `taxpayers` to `DISTSTYLE KEY` on `filing_state` to match.

---

**Q11.** A hospital network's on-premises Kafka cluster streams
medical-device telemetry through several custom Kafka Connect
connectors the team cannot rewrite on short notice. They want a
managed AWS service to host the equivalent event bus without touching
producers, consumers, or connectors.

A. Migrate to Kinesis Data Streams and rebuild the connectors as Lambda consumers.
B. Amazon MSK, using MSK Connect to run the existing connectors unmodified.
C. Amazon Data Firehose, since it can absorb any Kafka workload with configuration only.
D. Amazon Managed Service for Apache Flink, replacing Kafka Connect with Flink connectors.

---

**Q12.** *(Choose TWO)* A government agency's nightly Glue job that
processes tax-filing PDFs metadata begins failing intermittently this
week with executor out-of-memory errors. The failures started the same
week a new filing category was introduced whose records are, on
average, far larger (more attached schedules) than typical filings,
though total data volume only grew modestly.

A. Investigate data skew — a subset of tasks handling the new category's disproportionately large records may be overwhelmed even though overall volume looks normal.
B. Check whether the job's worker type (e.g., G.1X) has enough per-worker memory for the new category's larger individual records, and consider a larger worker type if so.
C. Immediately delete job bookmarks to force a clean state.
D. Assume the job needs Lambda instead of Glue, since OOM errors are unique to Spark.
E. Disable the job's IAM role permissions to force a security-related failure signal instead.

---

**Q13.** A national retail chain migrates its point-of-sale product
database from on-premises MySQL to RDS for MySQL as a one-time cutover
during a scheduled overnight maintenance window when stores are
closed and the source can be safely taken offline.

A. AWS DMS with a full-load-only task.
B. AWS DMS with full load + CDC, cutting over after CDC catches up.
C. AWS Glue Studio's visual ETL job to extract and load the tables.
D. AWS Transfer Family to move a database export file.

---

**Q14.** A media conglomerate's shared Glue Catalog `subscribers`
table is queried by four regional business units, each of which must
see only their own region's subscriber rows — never another region's
— with no physical duplication of the table and minimal ongoing grant
maintenance as new regional units are added.

A. Physically split the table into four S3 locations, one per region, with separate crawlers.
B. Use Lake Formation named row-level data filters, one per regional business unit, on the single shared table.
C. Rely on each business unit's application code to filter query results client-side after receiving the full table.
D. Encrypt each region's rows with a region-specific KMS key and distribute keys accordingly.

---

**Q15.** A fleet-telematics company's DynamoDB `vehicles` table, keyed
by `vehicle_id`, has run in production for two years. A new dashboard
needs to look up all vehicles for a given `fleet_operator_id`,
eventual consistency is acceptable, and this exact need was never
anticipated when the table was designed.

A. Add a Local Secondary Index for `fleet_operator_id`.
B. Add a Global Secondary Index for `fleet_operator_id`.
C. Recreate the table with `fleet_operator_id` in the primary key.
D. Use a `Scan` with a filter expression, since the table is not extremely large.

---

**Q16.** A mobile game studio's player database runs on Aurora MySQL,
and the analytics team wants near-real-time player-behavior data in
Redshift for BI dashboards, with the least custom pipeline code and
lowest operational overhead possible.

A. A scheduled Glue JDBC job extracting from Aurora into Redshift.
B. AWS DMS with CDC replicating Aurora changes into Redshift via S3.
C. A zero-ETL integration from Aurora MySQL to Amazon Redshift.
D. Amazon Data Firehose streaming database change events into Redshift.

---

**Q17.** A logistics company's package-tracking API spans API
Gateway, several Lambda functions, and a downstream DynamoDB call.
Customers occasionally report a tracking lookup that takes several
seconds to return, and the team cannot tell which component in the
chain is responsible.

A. Search each component's CloudWatch Logs manually and cross-reference timestamps.
B. Enable AWS X-Ray to trace requests end-to-end across the chain.
C. Review AWS CloudTrail for API call history around the reported times.
D. Set a CloudWatch alarm on the API Gateway 5xx error rate.

---

**Q18.** A government agency wants citizens to ask natural-language
questions like "What's the deadline to appeal a property tax
assessment?" against a large collection of PDF regulations, public
notices, and FAQ documents, and receive a direct answer or highlighted
passage rather than a list of documents to open and read.

A. Amazon OpenSearch Service with a custom full-text index.
B. Amazon Kendra.
C. Amazon Athena with full-text search extensions over converted text files.
D. AWS Glue Data Catalog search.

---

**Q19.** An insurance claims-intake pipeline receives files from
dozens of independent adjuster firms, each with slightly different
field names, occasional missing fields, and inconsistent data types
for logically identical fields, changing gradually over time as firms
update their own systems.

A. Load with a fixed-schema Spark DataFrame that rejects any file with an unexpected structure.
B. Load as a Glue DynamicFrame and use `resolveChoice` to reconcile schema/type inconsistencies.
C. Require every adjuster firm to conform to one exact schema before ingestion.
D. Convert every firm's files to one flattened CSV format before the job runs.

---

**Q20.** A state government's cloud platform team attaches an SCP at
the OU level explicitly denying `iam:CreateUser` for every account in
that OU, to enforce a role-based-access-only policy. A data engineer's
IAM role in one of those accounts has an identity-based policy
explicitly allowing `iam:CreateUser` with a wildcard resource.

A. The engineer can create a user, since identity-based allows take precedence over SCPs.
B. The engineer cannot create a user; the SCP's explicit deny overrides the identity-based allow.
C. The outcome depends on whether the SCP or the IAM policy was created first.
D. The engineer can create a user only by using the account root user.

---

**Q21.** A hospital's nightly Glue job processing lab-result files uses
job bookmarks. A defect in a unit-conversion step is discovered after
running correctly-seeming for 12 days, and the team must reprocess all
12 days of historical files through the corrected logic.

A. Re-enable job bookmarks before the next scheduled run.
B. Reset the job bookmark, then rerun the job against the historical date range.
C. Increase the number of DPUs assigned to the job.
D. Delete and recreate the Glue job with the corrected script.

---

**Q22.** *(Choose TWO)* A bank's mobile-banking app reads and writes
one specific high-net-worth customer's DynamoDB profile item far more
often than any other customer's, during a promotional event, causing
`ThrottledRequests` to spike for that specific item while the table's
aggregate consumed capacity looks unremarkable.

A. Add a randomized or calculated suffix to that customer's partition key to spread writes across more physical partitions.
B. Add DynamoDB Accelerator (DAX) in front of the table to absorb the repeated reads.
C. Switch the entire table from provisioned to on-demand mode, expecting it to rebalance the hot item automatically.
D. Increase the table's overall provisioned capacity substantially across every item.
E. Add a Global Secondary Index to spread that customer's traffic automatically.

---

**Q23.** A retail chain's merchandising team wants to type plain-
English questions like "which product category had the biggest
week-over-week sales drop?" directly into a QuickSight dashboard and
get an answer, without writing SQL or asking a data analyst.

A. Amazon Q Developer integrated into the merchandising team's IDE.
B. Amazon Q in QuickSight, using its natural-language query capability.
C. Amazon Athena with saved queries for common questions.
D. Amazon Kendra connected to the QuickSight dataset.

---

**Q24.** A documentary streaming platform's Glue ETL job joins a 300 GB
viewer-events dataset against a 600 MB title-metadata dataset on 8
G.1X workers. The job ran reliably for a year, but began failing with
executor OOM errors the same week the platform added a single new
blockbuster title whose viewer-events volume alone now represents
roughly 35% of total daily events.

A. Add more G.1X workers of the same size to increase total capacity.
B. Recognize data skew from the blockbuster title's disproportionate share of events, and mitigate with key salting or an available skew-join optimization rather than uniform scale-out.
C. Disable the join with the 600 MB metadata dataset entirely to reduce memory pressure.
D. Switch the job's execution class to Flex to reduce memory allocation per worker.

---

**Q25.** An IoT fleet-management company must retain vehicle-telemetry
compliance logs in S3 for 6 years such that no principal, including
account administrators, can delete or alter them before the retention
period expires.

A. S3 versioning combined with an IAM policy denying delete actions.
B. S3 Object Lock in compliance mode with a 6-year retention period.
C. S3 Object Lock in governance mode with a 6-year retention period.
D. A nightly backup of the bucket to a second, access-restricted bucket.

---

**Q26.** A mobile game studio runs BI queries against Redshift in
sharp, unpredictable bursts around major in-game events, with days of
near-zero query activity between events, and wants to avoid both
manual capacity planning and idle-time cost.

A. A provisioned Redshift cluster sized for peak event traffic, running 24/7.
B. Redshift Serverless, auto-scaling RPUs to the event traffic and scaling down between events.
C. A provisioned cluster with Reserved Instances, since RIs are always cheapest.
D. Amazon Athena, since the workload is described as a data warehouse need.

---

**Q27.** An insurance underwriting team wants to enrich flood-risk
models with a commercial catastrophe-modeling dataset, licensed and
updated weekly by a third-party provider, delivered directly into
their S3 bucket, without building or maintaining any custom API
polling code against the provider.

A. A scheduled Lambda function polling the provider's REST API weekly.
B. AWS Data Exchange, subscribing to the dataset with delivery configured directly into S3.
C. AWS AppFlow, connecting to the provider as a generic SaaS source.
D. AWS DMS, replicating directly from the provider's internal systems.

---

**Q28.** A telecom's Redshift cluster runs a steady 24/7 billing-
reconciliation workload, but on the last business day of every month,
concurrent report queries spike sharply for roughly 90 minutes, and
`WLMQueueWaitTime` rises noticeably during that window before
returning to normal.

A. Permanently resize the cluster to handle the monthly peak.
B. Enable concurrency scaling to add transient capacity automatically during the spike.
C. Ask the reporting team to spread queries across the whole week instead.
D. Move all monthly reporting to DynamoDB to avoid the concurrency limit.

---

**Q29.** *(Choose TWO)* A hospital system wants its Aurora PostgreSQL
cluster's database credentials rotated automatically on a schedule
with native AWS integration and no custom rotation code to write or
maintain.

A. Store the credentials in AWS Secrets Manager with automatic rotation enabled for the Aurora cluster.
B. Ensure the KMS key protecting the secret's encryption grants the Secrets Manager rotation Lambda (or native rotation mechanism) the necessary `kms:Decrypt`/`kms:GenerateDataKey` access.
C. Store the credentials in SSM Parameter Store as SecureString parameters with no rotation configuration.
D. Hardcode the rotated credentials into each Glue job script quarterly.
E. Disable encryption on the secret to simplify the rotation Lambda's access.

---

**Q30.** A government open-data team wants to publish a curated,
downloadable extract (Parquet, partitioned by agency and year) derived
from a much larger internal Athena-queried dataset, using SQL rather
than standing up a separate ETL job.

A. Use Athena `CTAS` (`CREATE TABLE AS SELECT`) with `partitioned_by` to materialize the curated extract directly.
B. Use `UNLOAD` from a Redshift cluster that doesn't currently hold this data.
C. Manually export query results from the Athena console repeatedly.
D. Build a full Glue ETL job for what is fundamentally a single SQL transformation.

---

**Q31.** A hospital genomics-research group runs nightly Spark batch
jobs on Amazon EMR to align sequencing data, and wants to minimize
compute cost as much as possible without changing their existing
Spark/Hadoop toolchain.

A. Run every node type, including primary and core, on Spot Instances.
B. Run primary and core nodes On-Demand, and run task nodes on Spot Instances via instance fleets.
C. Migrate the jobs to AWS Glue to eliminate infrastructure cost entirely.
D. Purchase Reserved Instances for every node type.

---

**Q32.** A government benefits-eligibility pipeline promotes applicant
data nightly into a curated zone feeding an eligibility-determination
service. The team wants an automated, no-code check that
`applicant_id` is always present and unique, and that `household_size`
falls within an expected numeric range, halting the pipeline on
violation.

A. Write custom PySpark assertions for each rule inside the Glue job.
B. Attach an AWS Glue Data Quality (DQDL) ruleset to the job, configured to fail on violation.
C. Use Amazon Macie to flag anomalous applicant records.
D. Manually review a sample of records after each nightly run.

---

**Q33.** *(Choose TWO)* A national retailer needs to run the same
image-classification Lambda function against 80,000 return-photo
files already in S3, with built-in per-file retry/error handling and
massive parallelism, without writing custom parallelization or retry
code.

A. Use AWS Step Functions with a Distributed Map state iterating over the S3 objects.
B. Configure per-item retry/error handling via the Distributed Map state's built-in Catch/Retry configuration.
C. Write one Lambda function that lists and loops through all 80,000 objects sequentially in a single invocation.
D. Trigger a separate Lambda invocation per object via an S3 event notification with no orchestration layer.
E. Use Step Functions Express workflows without Distributed Map to reduce cost for this workload.

---

**Q34.** A retail company's customer-support call-transcription
pipeline has accumulated years of transcripts across a dozen S3
buckets with no central inventory, and the compliance team needs to
find every location containing unmasked credit-card numbers before an
upcoming PCI audit, without manually inspecting each transcript.

A. AWS Config rules evaluating bucket configuration compliance.
B. Amazon Macie, scanning the buckets to discover and classify sensitive data patterns.
C. AWS Glue Data Quality, checking for card-number format violations.
D. Amazon Kendra, searching transcripts for the phrase "credit card."

---

**Q35.** A utility company's smart-meter billing table must (1) be
queryable exactly as it existed on the last day of the previous
billing cycle, for a customer dispute, and (2) support adding a new
column for a regulatory surcharge field without rewriting existing
data files.

A. Convert the table to a standard Hive-style partitioned Parquet table.
B. Convert the table to Apache Iceberg and use its snapshot/time-travel and schema evolution features.
C. Take manual daily S3 snapshots of the entire table using S3 Batch Operations.
D. Use DynamoDB point-in-time recovery on an exported copy of the table.

---

**Q36.** A gaming platform operator already runs ~40 complex Apache
Airflow DAGs with custom Python operators on self-managed EC2, and
wants a managed AWS service that runs the existing DAGs largely
unchanged.

A. Rewrite the DAGs as AWS Step Functions state machines.
B. Amazon Managed Workflows for Apache Airflow (MWAA).
C. AWS Glue Workflows.
D. Amazon EventBridge Scheduler with individual Lambda functions per task.

---

**Q37.** A healthcare imaging pipeline's Glue job suddenly fails with
`403 Forbidden` reading SSE-KMS-encrypted DICOM metadata objects from
S3, despite the job's IAM role having `s3:GetObject` granted in both
an identity policy and the bucket policy.

A. Check whether the KMS key policy grants the job's IAM role `kms:Decrypt` — a common, independently required layer for SSE-KMS objects.
B. Immediately grant the role `s3:*` and `kms:*` to rule out granularity issues without further diagnosis.
C. Assume the objects are corrupted and re-upload them.
D. Assume Glue cannot read SSE-KMS objects under any configuration.

---

**Q38.** A telecom already runs a provisioned Redshift cluster for its
billing warehouse and now needs analysts to join those tables against
5 years of archived call-detail records stored as Parquet in S3,
without loading the archive into the cluster.

A. Load the 5 years of archive into Redshift using `COPY`.
B. Use Redshift Spectrum to create an external schema over the archive and join it to warehouse tables.
C. Query the archive with Athena and manually merge results with a Redshift export.
D. Use a zero-ETL integration to bring the archive into Redshift.

---

**Q39.** An actuarial team at an insurance company wants to keep
running its existing Spark jobs without provisioning, patching, or
managing EC2 clusters, paying only for compute while jobs actually
run, with minimal changes to the existing codebase.

A. Amazon EMR on EC2 with managed scaling enabled.
B. Amazon EMR Serverless.
C. AWS Glue ETL, rewriting the Spark jobs to use DynamicFrames.
D. AWS Lambda, refactoring the Spark jobs into smaller functions.

---

**Q40.** A federal agency's security team must guarantee that no
principal in any account under a specific OU can ever weaken an S3
bucket's public-access-block settings, regardless of what permissions
individual roles are granted within those accounts.

A. Add an IAM policy to every role denying the relevant `s3:PutPublicAccessBlock`-adjacent actions.
B. Attach an SCP at the OU level explicitly denying those actions.
C. Enable AWS Config to detect and alert on the change after it happens.
D. Grant public-access-block administration only to a single "break-glass" IAM user.

---

**Q41.** *(Choose TWO)* An industrial-sensor manufacturer's Kinesis
Data Streams pipeline uses `device_id` as the partition key.
Monitoring shows `WriteProvisionedThroughputExceeded` errors
concentrated on a small number of shards, while most shards are
lightly loaded, traced to a handful of high-frequency industrial
devices producing far more events than the rest of the fleet.

A. Add a random or calculated suffix to the partition key specifically for the high-volume devices, to spread their events across more shards.
B. Split the affected hot shards to add capacity for those key ranges.
C. Increase the stream's retention period to 365 days.
D. Enable enhanced fan-out on all consumers.
E. Switch to on-demand capacity mode, which automatically rebalances any hot key without further action.

---

**Q42.** A national bank's transaction-log Athena table is partitioned
by branch, year, month, and day going back 12 years across thousands
of branches — tens of millions of partitions — following a fully
predictable naming scheme. An hourly crawler keeps the catalog
current, but crawler cost and query-planning latency have become a
significant operational burden.

A. Reduce the crawler's schedule to run weekly instead of hourly.
B. Configure Athena partition projection using the known, predictable partition pattern.
C. Convert the table to a single unpartitioned table to remove partition overhead.
D. Move the table into DynamoDB instead of Athena.

---

**Q43.** A mobile game studio's `player_profile` table needs to
preserve a full history of certain attribute changes over time (for
example, tracking every prior in-game "guild" a player belonged to,
with effective date ranges), rather than only the current value,
for later cohort analysis.

A. Overwrite the attribute in place on every change, since only current state matters for analytics.
B. Model the attribute using a Slowly Changing Dimension (SCD) Type 2 pattern — inserting a new row with effective-date bounds on each change rather than overwriting the existing one.
C. Store every historical value as a single denormalized comma-separated string in one column.
D. Use DynamoDB TTL to automatically expire old attribute values.

---

**Q44.** A media company's real-time ad-exchange fraud system needs a
continuously updated 2-minute sliding-window count of ad-impression
events per publisher ID, updated as new events arrive, feeding a live
fraud-scoring dashboard.

A. Amazon Data Firehose with a Lambda transformation computing the count.
B. A scheduled Athena query run every 2 minutes.
C. Amazon Managed Service for Apache Flink with a sliding window aggregation.
D. An hourly AWS Glue batch job.

---

**Q45.** A federal cloud platform team must prevent any IAM role in a
sensitive OU from using a permissions boundary or identity policy to
grant itself `iam:PutRolePolicy` and escalate its own privileges,
while still allowing normal role management elsewhere in the
organization.

A. Rely solely on training engineers not to self-escalate privileges.
B. Attach an SCP at the sensitive OU level explicitly denying `iam:PutRolePolicy` (and related self-modification actions) for roles in that OU, since no identity-based policy or permissions boundary inside the OU can override an SCP's explicit deny.
C. Grant every role a permissions boundary that omits `iam:PutRolePolicy`, trusting that this alone is sufficient without an SCP.
D. Use only resource-based policies on the IAM roles themselves, since IAM roles support resource-based policies for this purpose.

---

**Q46.** A gaming platform's live in-game economy dashboard reads the
same "top spender leaderboard" DynamoDB items an extremely high number
of times per second during a limited-time event, and the team wants
those reads served in microseconds with minimal application changes.

A. Switch the table to on-demand capacity mode.
B. Add DynamoDB Accelerator (DAX) in front of the table.
C. Increase provisioned read capacity units substantially.
D. Add a Global Secondary Index to spread the read load.

---

**Q47.** A telecom's monthly billing-cycle aggregation job processes a
60 GB batch of call-detail records with multiple joins and
aggregations, taking roughly 35 minutes when run locally for testing.
A junior engineer proposes running it on AWS Lambda "since it's
serverless and simple."

A. Use Lambda with maximum memory and timeout settings.
B. Use AWS Glue ETL (or EMR Serverless), sized appropriately for the job.
C. Split the file into many chunks, process each with a separate Lambda invocation, and merge results with another Lambda.
D. Increase Lambda's reserved concurrency to speed up processing.

---

**Q48.** A telecom's Redshift-based reporting pipeline pages on-call
for every long-running query that exceeds a fixed duration threshold,
including ones that are automatically retried by the application layer
and succeed on the next attempt seconds later, causing significant
alert fatigue.

A. Remove the alerting entirely and rely on manual dashboard checks each morning.
B. Scope the alert to fire only after the application's retry logic is exhausted (final failure), rather than on every individual long-running attempt, and separately review whether the duration threshold itself is well-calibrated.
C. Increase the SNS topic's batching window so fewer notifications are sent regardless of whether the query ultimately succeeded.
D. Disable the application's retry logic entirely so every slow query pages immediately.

---

**Q49.** An IoT fleet-management company's compliance team needs to
know exactly which IAM principal read or modified specific
device-registration objects in an S3 bucket going forward, for an
upcoming ISO audit. CloudTrail management events are already enabled
account-wide.

A. Continue relying on the existing CloudTrail management event history.
B. Enable CloudTrail data events for the specific S3 bucket.
C. Enable AWS Config change history for the bucket.
D. Enable S3 Transfer Acceleration logging.

---

**Q50.** *(Choose TWO)* A government benefits agency's analytics team
needs to run periodic Athena queries over a DynamoDB `applications`
table's historical data for reporting, without consuming the table's
provisioned capacity or risking throttling the live benefits-
processing application that also reads and writes the table.

A. Use DynamoDB's export-to-S3 feature to produce a snapshot, then query the export with Athena.
B. Schedule the export to run during low-traffic hours, and confirm via the table's consumed-capacity metrics that the live application is unaffected.
C. Run a scheduled `Scan` operation directly against the live table and write results to S3.
D. Increase the table's read capacity to accommodate both the live application and the analytics `Scan`.
E. Enable DynamoDB Streams and manually replay every item into S3 for each report.

---

**Q51.** An insurance claims analyst who does not write code needs to
explore a newly onboarded partner's claims dataset — understanding
value distributions, spotting outliers, and identifying inconsistent
formats — before deciding what validation rules to formalize into the
production pipeline.

A. AWS Glue Studio's visual job editor.
B. AWS Glue DataBrew.
C. Amazon Athena with manually written aggregate SQL queries.
D. AWS Lambda with a custom Python profiling script.

---

**Q52.** An insurance company's operations dashboard needs a single
alert that fires only when **both** Redshift query latency is
elevated **and** the underlying cluster's CPU utilization is
simultaneously high — because either condition alone is common and
not actionable, but the combination reliably indicates a real incident.

A. Two separate CloudWatch alarms, each independently notifying on-call.
B. A CloudWatch composite alarm combining both underlying metric alarms with an AND condition.
C. A single alarm on CPU utilization alone, since it's the more fundamental metric.
D. AWS X-Ray tracing configured to alert on latency thresholds.

---

**Q53.** A national retail chain needs to move 500 TB of historical
loyalty-program transaction archives from an on-premises data center
with a slow, unreliable internet connection into S3, as a one-time
migration.

A. AWS DataSync over the existing internet connection.
B. AWS Snowball Edge, shipped to the data center and returned to AWS for import.
C. AWS Transfer Family with SFTP over the internet connection.
D. Compress the data and upload via the S3 console over several weeks.

---

**Q54.** A media rights-management company grants a third-party
contractor temporary, time-limited access to decrypt specific
SSE-KMS-encrypted archival footage objects for a two-week project,
without permanently modifying the KMS key's key policy and without
manually removing an access statement afterward.

A. Add a permanent statement to the key policy granting the contractor's role `kms:Decrypt`, then manually remove it after two weeks.
B. Issue a time-limited KMS grant to the contractor's role for `kms:Decrypt` (an explicitly temporary, revocable, programmatic mechanism distinct from editing the key policy), which can be allowed to expire or be explicitly revoked without touching the key policy at all.
C. Share the KMS key's underlying key material directly with the contractor.
D. Disable encryption on the objects for the duration of the project.

---

**Q55.** A fleet-management company's operations team needs
Kibana-style full-text search and near-real-time dashboards over
terabytes of vehicle-diagnostic log data, with fast aggregations and
free-text search across log fields.

A. Amazon OpenSearch Service.
B. Amazon Kendra.
C. Amazon Athena with a scheduled dashboard refresh.
D. Amazon Redshift with materialized views over the log data.

---

**Q56.** A mobile game studio's in-app purchase service retries failed
downstream writes automatically after transient errors. Players have
begun reporting occasional duplicate charges for a single purchase
after a brief network blip.

A. Reduce the number of automatic retries to lower duplicate risk.
B. Make the write idempotent — for example, a deterministic dedup key per purchase attempt, or a conditional write that fails harmlessly if the purchase was already recorded.
C. Switch to Amazon Data Firehose, which guarantees exactly-once delivery.
D. Disable retries entirely so each purchase attempt is processed exactly once.

---

**Q57.** A multi-agency government portal gives each of six agencies a
QuickSight dashboard sourced from a shared Redshift warehouse, showing
only that agency's own program data, with fast performance for
hundreds of concurrent viewers checking dashboards at the start of
each business day, without querying Redshift on every view.

A. A separate Redshift database user per agency with row-filtering views.
B. QuickSight with SPICE and row-level security scoped to each agency.
C. A daily CSV export per agency, emailed each morning.
D. QuickSight in direct query mode against Redshift for all agencies.

---

**Q58.** *(Choose TWO)* An insurance company loads a 400 GB nightly
claims extract into Redshift via `COPY`, but the load currently comes
from a single large gzip file and takes several hours despite the
cluster having many slices.

A. Split the input into multiple files, ideally a multiple of the number of slices.
B. Keep each split file compressed and roughly in the 1 MB–1 GB range.
C. Switch to individual `INSERT` statements instead of `COPY` for finer per-row control.
D. Increase the number of sort keys defined on the target table to speed up the load.
E. Disable compression on the split files to reduce CPU overhead during load.

---

**Q59.** An insurance actuarial team's platform engineers want an AI
assistant embedded directly in their IDE that can generate AWS Glue
PySpark boilerplate, explain unfamiliar Spark error messages, and
suggest fixes as they write pipeline code, without switching to a
separate chat tool.

A. Amazon Q in QuickSight.
B. Amazon Q Developer.
C. Amazon Kendra connected to the team's internal wiki.
D. AWS CodeGuru Reviewer.

---

**Q60.** *(Choose TWO)* A bank must satisfy a disaster-recovery and
regulatory mandate for a specific S3 dataset requiring both (1) the
ability to recover any accidentally overwritten or deleted object to
its prior state, and (2) a true write-once-read-many guarantee for a
7-year retention window that no principal, including administrators,
can bypass.

A. Enable S3 versioning on the bucket, which preserves prior object versions when overwritten or deleted.
B. Enable S3 Object Lock in compliance mode with a 7-year retention period (which itself requires versioning to be enabled).
C. Rely on IAM policies denying delete actions as the sole protection mechanism.
D. Enable S3 Object Lock in governance mode only, since it is simpler to administer.
E. Configure Cross-Region Replication as a substitute for both requirements.

---

**Q61.** A hospital network must retain diagnostic-imaging metadata
records in S3 for 10 years for regulatory compliance, at the lowest
possible storage cost, but auditors occasionally request specific
older records with only a few hours' notice.

A. S3 Glacier Deep Archive for all records for the full 10 years.
B. S3 Glacier Flexible Retrieval, using expedited retrieval for same-day audit requests.
C. S3 Standard-IA for the full 10 years.
D. S3 Intelligent-Tiering, since it automatically optimizes any access pattern.

---

**Q62.** A bank's Redshift reporting queries have begun queuing and
`WLMQueueWaitTime` is elevated during business hours, but unlike a
typical concurrency spike, investigation shows a single long-running,
uncommitted transaction from a stuck ETL session is holding locks on a
frequently queried table, blocking other queries regardless of WLM
queue configuration.

A. Enable concurrency scaling, since any WLM wait-time increase is a concurrency problem.
B. Identify and terminate the stuck, lock-holding session (for example, via `pg_terminate_backend` or the Redshift console's session view), since the root cause is a blocking transaction, not insufficient concurrent query slots.
C. Permanently resize the cluster to add more nodes.
D. Disable short query acceleration to free up queue slots.

---

**Q63.** An e-commerce marketplace's "listing published" event must
notify a search-indexing service, a fraud-review service, and a
seller-notification service — but the fraud-review service should only
receive events for listings priced above a threshold, based on a
`price` attribute in the event payload.

A. Publish to an SNS topic with all three services subscribed, applying SNS filtering only to the fraud-review subscription.
B. Publish to Amazon EventBridge with a content-filtering rule routing to the fraud-review target only when `price` exceeds the threshold.
C. Publish to an SQS Standard queue and have each service poll and discard events it doesn't need.
D. Write a Lambda function that receives the event and calls all three services with conditional logic.

---

**Q64.** A national news outlet's breaking-news article occasionally
gets read from the same DynamoDB `articles` item hundreds of thousands
of times within minutes of publication, then access drops sharply.
The team wants microsecond read latency during these spikes without
restructuring how articles are stored or read.

A. Increase the table's provisioned read capacity units ahead of every publication, just in case.
B. Add DynamoDB Accelerator (DAX) in front of the table to absorb the repeated hot-item reads.
C. Switch the table to on-demand mode, which the team believes eliminates hot-item latency entirely.
D. Add a Global Secondary Index on `published_at` to spread the read load.

---

**Q65.** An industrial IoT company keeps 4 years of turbine-sensor
telemetry in S3, queried through Athena. Storage costs are dominated
by older, rarely-accessed data still sitting in S3 Standard, and
Athena costs are dominated by a handful of dashboard queries that scan
entire years of data even when only a single month is relevant.

A. Move all data to S3 Glacier Deep Archive, since it's the cheapest storage tier available.
B. Apply an S3 lifecycle policy transitioning older telemetry to a cost-appropriate cold tier based on its known access pattern, and ensure the dashboard queries include partition (e.g., year/month) predicates so Athena can prune instead of scanning full years.
C. Increase the Athena workgroup's data usage control limit so the dashboard queries stop failing.
D. Migrate the entire dataset to DynamoDB to eliminate S3 storage tiering decisions.

---

# Part 2 — Answer Key

| Q | Domain | Correct Answer(s) | One-line reason |
|---|---|---|---|
| 1 | D1 | B | Fleet size changes weekly; on-demand removes shard math entirely |
| 2 | D2 | B | Single-AZ, microsecond-latency hot working set is S3 Express One Zone's exact case |
| 3 | D3 | B | SQL-like ad hoc log search with no export step is CloudWatch Logs Insights |
| 4 | D1 | A, B | Retention enables replay; EFO gives each of the three consumers independent throughput |
| 5 | D4 | B | Free, private S3 access from a VPC is a gateway endpoint |
| 6 | D2 | B | Automatic Iceberg maintenance with full engine compatibility = Amazon S3 Tables |
| 7 | D1 | B | ~2-minute latency, one consumer, no replay, least overhead = Firehose + dynamic partitioning |
| 8 | D3 | B | Object-level read/write auditing requires CloudTrail data events, off by default |
| 9 | D4 | A, B | Cross-account SSE-KMS sharing needs both an S3 grant and a KMS key-policy grant |
| 10 | D2 | B | Uneven volume across "enough" distinct values still causes skew; fix the DISTKEY/AUTO |
| 11 | D1 | B | Unmodifiable existing Kafka Connect connectors point to MSK + MSK Connect |
| 12 | D3 | A, B | New category's larger records = skew; also confirm worker type has enough memory |
| 13 | D1 | A | Source can go offline; one-time cutover is DMS full-load-only |
| 14 | D4 | B | Per-region row restriction on one shared table = Lake Formation row-level filter |
| 15 | D2 | B | New access pattern after 2 years, eventual consistency OK = GSI |
| 16 | D1 | C | Aurora MySQL → Redshift, least code, lowest lag = zero-ETL |
| 17 | D3 | B | Pinpointing latency across a distributed request chain = X-Ray |
| 18 | D2 | B | Natural-language Q&A with direct answers over documents = Kendra |
| 19 | D1 | B | Gradually drifting, inconsistent partner schemas = DynamicFrame + resolveChoice |
| 20 | D4 | B | SCP explicit deny always overrides an identity-based allow |
| 21 | D1 | B | Reprocessing history requires resetting, not enabling, the bookmark |
| 22 | D2 | A, B | Single hot item: write-sharding for writes, DAX for the repeated reads |
| 23 | D3 | B | Natural-language questions answered inside a QuickSight dashboard = Amazon Q in QuickSight |
| 24 | D1 | B | One title driving 35% of events is skew, not a capacity shortfall |
| 25 | D4 | B | WORM against every principal including admins, 6 years = Object Lock compliance mode |
| 26 | D2 | B | Sharp bursts, days of idle time = Redshift Serverless |
| 27 | D1 | B | Licensed third-party dataset landed in S3, no custom code = AWS Data Exchange |
| 28 | D3 | B | Predictable ~90-minute monthly spike = transient concurrency scaling |
| 29 | D4 | A, B | Secrets Manager native rotation, plus the KMS key must grant the rotation mechanism decrypt access |
| 30 | D1 | A | A single SQL statement to materialize a partitioned extract = Athena CTAS (SQL-based transformation) |
| 31 | D1 | B | Minimize EMR cost without changing the stack: Spot on task nodes only, On-Demand primary/core |
| 32 | D3 | B | No-code null/uniqueness/range checks with a fail gate = Glue Data Quality (DQDL) |
| 33 | D1 | A, B | Massive parallel per-file processing with built-in retry = Distributed Map + its Catch/Retry |
| 34 | D4 | B | Discovering unmasked card numbers across unindexed buckets = Amazon Macie |
| 35 | D2 | B | Point-in-time query plus in-place schema evolution = Apache Iceberg |
| 36 | D1 | B | Existing Airflow DAGs, largely unchanged = MWAA |
| 37 | D4 | A | S3 permissions are already sufficient per the scenario; the gap is the KMS key policy's `kms:Decrypt` grant |
| 38 | D2 | B | Redshift exists, needs to join S3 data without loading it = Redshift Spectrum |
| 39 | D1 | B | Keep Spark, no cluster management, pay only while running = EMR Serverless |
| 40 | D4 | B | Org-wide, unbypassable guardrail regardless of individual role grants = an SCP |
| 41 | D1 | A, B | Hot shards from a few high-volume keys: add key entropy and split the hot shards |
| 42 | D2 | B | Predictable scheme, tens of millions of partitions = Athena partition projection |
| 43 | D2 | B | Preserving attribute history with effective dates = SCD Type 2 |
| 44 | D1 | C | Continuous stateful sliding-window aggregation = Managed Service for Apache Flink |
| 45 | D4 | B | Preventing self-privilege-escalation org-wide requires an SCP; nothing inside the OU can override it |
| 46 | D2 | B | Microsecond reads, minimal app changes = DAX |
| 47 | D1 | B | 35-minute, multi-join, 60 GB batch job exceeds what Lambda is built for |
| 48 | D3 | B | Alert only once retries are exhausted, and recalibrate the threshold |
| 49 | D3 | B | Object-level read/modify auditing again requires CloudTrail data events |
| 50 | D2 | A, B | Export-to-S3 avoids consuming table capacity; scheduling/verifying protects the live app |
| 51 | D3 | B | No-code exploratory profiling before formalizing rules = Glue DataBrew |
| 52 | D3 | B | An alert that should fire only when two conditions co-occur = a composite alarm |
| 53 | D1 | B | 500 TB over an unreliable connection, one-time = Snowball Edge |
| 54 | D4 | B | Temporary, revocable, no key-policy edit needed = a time-limited KMS grant |
| 55 | D2 | A | Kibana-style full-text search and log dashboards = OpenSearch Service |
| 56 | D1 | B | Duplicate charges from retries mean the write itself needs to be idempotent |
| 57 | D3 | B | High-concurrency, fast, per-agency dashboards with no per-view warehouse hit = QuickSight + SPICE + RLS |
| 58 | D2 | A, B | Multiple, slice-aligned, appropriately-sized compressed files parallelize COPY |
| 59 | D1 | B | An in-IDE AI coding assistant for Glue PySpark = Amazon Q Developer |
| 60 | D4 | A, B | Versioning covers recovery; compliance-mode Object Lock (which requires versioning) covers true WORM |
| 61 | D2 | B | Lowest-cost long-term storage with occasional same-day retrieval = Glacier Flexible Retrieval expedited |
| 62 | D3 | B | A specific blocking transaction, not concurrency, must be terminated directly |
| 63 | D1 | B | Content-based routing to one of several targets = EventBridge rule |
| 64 | D2 | B | Extreme, transient hot-item reads at microsecond latency, no restructuring = DAX |
| 65 | D3 | B | Two independent cost levers: lifecycle-tier the cold data, and add partition predicates |

---

# Part 3 — Full Explanations

### Q1 — Hospital wearable fleet, no manual capacity management
**Correct: B**
- A. Provisioned, generously sized. Wrong — "generous headroom" is still manual sizing, and the fleet changes weekly; someone still has to watch and adjust it.
- B. On-demand. Correct — scales automatically to whatever throughput the current fleet needs, with zero shard math for nursing informatics to own.
- C. Firehose "removes all capacity planning." Wrong — Firehose has no sub-second delivery mode; it buffers before delivery, failing the clinical alerting team's latency need.
- D. MSK Serverless "scales automatically by default." Wrong — introduces full Kafka operational concepts for a workload with no stated existing Kafka investment; overkill relative to the stated need.

### Q2 — Trading desk hot working set, single-AZ microsecond latency
**Correct: B**
- A. Standard + Transfer Acceleration. Wrong — Transfer Acceleration speeds long-haul uploads over the internet; it doesn't deliver single-digit-millisecond-to-microsecond in-Region access.
- B. S3 Express One Zone. Correct — purpose-built for exactly this: single-AZ, ultra-low, consistent latency for a hot, frequently accessed working set, trading multi-AZ durability for speed on the specific data that needs it.
- C. Intelligent-Tiering. Wrong — optimizes storage cost by access frequency; it doesn't change the underlying latency characteristics of S3 Standard.
- D. Standard-IA "lowest latency." Wrong — IA is optimized for cost on infrequently accessed data and carries retrieval fees; it isn't a latency-optimized tier at all.

### Q3 — Retail checkout errors, cross-Lambda log search
**Correct: B**
- A. X-Ray annotations. Wrong — X-Ray traces requests across services; it isn't a general-purpose log-content query tool.
- B. CloudWatch Logs Insights. Correct — purpose-built, SQL-like querying directly over CloudWatch Logs, no export step.
- C. Athena with export first. Wrong — the requirement explicitly rules out an export step.
- D. AWS Config timeline. Wrong — tracks resource configuration history, not log content.

### Q4 — Bank trade-settlement, three independent full-stream consumers with replay
**Correct: A, B**
- A. 10+ day retention. Correct — directly satisfies regulatory reporting's replay requirement.
- B. Enhanced fan-out for all three. Correct — gives each consumer a dedicated 2 MB/s-per-shard pipe so none competes with another, satisfying "without affecting another's throughput."
- C. Single Firehose stream for all three. Wrong — Firehose delivers to one destination with no replay; fails both the independent-consumption and replay requirements.
- D. SQS FIFO per consumer, fed by the app directly. Wrong — no native multi-day replay, and building custom fan-out from the application is unnecessary engineering overhead versus native Kinesis multi-consumer support.
- E. Reduce shards "since retention alone satisfies replay." Wrong — retention enables replay, but shard count still governs throughput; reducing it risks throttling the three concurrent consumers.

### Q5 — Hospital Glue jobs, private S3 access with no added charge
**Correct: B**
- A. NAT gateway. Wrong — NAT gateways carry hourly and per-GB processing charges; the requirement explicitly rules that out.
- B. Gateway VPC endpoint for S3. Correct — no hourly charge and no per-GB data-processing charge, private route to S3 from inside the VPC.
- C. Interface endpoint (PrivateLink). Wrong — interface endpoints do carry hourly and per-GB charges, unlike the gateway endpoint type for S3.
- D. Public endpoint + security group. Wrong — routes through the public internet path conceptually and doesn't satisfy "no internet gateway" in the stated VPC.

### Q6 — Industrial IoT Iceberg maintenance automation
**Correct: B**
- A. Standard bucket + EventBridge-scheduled maintenance. Wrong — still self-managed maintenance, just on a different trigger; doesn't remove the engineering burden.
- B. Amazon S3 Tables. Correct — Iceberg-native storage with AWS-managed compaction, snapshot management, and cleanup, preserving Athena/EMR compatibility.
- C. Redshift managed storage. Wrong — a different storage system entirely, not S3-based Iceberg with the described engine compatibility.
- D. Delta Lake on Databricks. Wrong — introduces a Databricks-centric toolchain outside this team's existing AWS-native Athena/EMR stack.

### Q7 — Parcel-logistics 2-minute latency, one consumer, no replay
**Correct: B**
- A. Kinesis + Lambda consumer. Wrong — more operational moving parts than needed for a single-consumer, no-replay requirement.
- B. Firehose with dynamic partitioning on carrier. Correct — squarely within Firehose's buffering window, and dynamic partitioning handles the carrier split with no custom code.
- C. MSK + Kafka Connect. Wrong — introduces a Kafka cluster to operate with no stated Kafka requirement.
- D. Glue streaming job polling every 2 minutes. Wrong — heavier to build and operate than a managed delivery stream for this need.

### Q8 — Telecom object-level audit trail
**Correct: B**
- A. Existing management events. Wrong — management events don't capture object-level reads/writes; that's explicitly what's missing.
- B. CloudTrail data events for the bucket. Correct — the mechanism that specifically records object-level S3 API activity, off by default, must be explicitly enabled.
- C. S3 Server Access Logging alone. Wrong — a valid alternative logging mechanism in general, but doesn't integrate with the "ongoing, queryable... IAM principal" audit trail the way CloudTrail data events do, and isn't what the scenario is steering toward given CloudTrail is already the account's chosen mechanism.
- D. VPC Flow Logs. Wrong — records network traffic metadata, not S3 API-level object access.

### Q9 — Insurance cross-account SSE-KMS sharing
**Correct: A, B**
- A. Bucket policy `s3:GetObject`. Correct — the S3-layer grant required for cross-account object access.
- B. KMS key policy `kms:Decrypt`. Correct — the separate, independently required layer for SSE-KMS objects; S3 access alone doesn't grant decrypt capability.
- C. Public bucket + key policy alone. Wrong — makes the bucket public, a drastic overreach far beyond sharing with one named partner account, and is not how this sharing pattern should work.
- D. Re-encrypt with SSE-S3 first. Wrong — unnecessary and reduces the audit/key-control benefits of customer-managed KMS encryption for no real benefit.
- E. Partner assumes a role with `s3:*`/`kms:*` in their own account only. Wrong — permissions in the partner's own account don't grant access to a bucket/key in Account A at all; this doesn't address the actual grant needed.

### Q10 — Government tax filings DISTKEY skew despite 51 values
**Correct: B**
- A. Add more nodes. Wrong — spreads the same uneven distribution across more slices; doesn't fix the skew itself.
- B. Higher-cardinality DISTKEY or AUTO. Correct — distinct-value count (51) doesn't guarantee even data distribution when volume is concentrated in a few states; a better-distributing key or AUTO fixes the actual imbalance.
- C. Sort key on `filing_state`. Wrong — sort keys aid range filtering via zone maps, not join co-location/distribution skew.
- D. Change `taxpayers`' distribution to match. Wrong — doesn't address the larger `filings` table's own skewed distribution, the actual bottleneck.

### Q11 — Hospital Kafka Connect connectors, cannot rewrite
**Correct: B**
- A. Kinesis + rebuilt connectors. Wrong — explicitly rewrites the connectors, which the requirement rules out.
- B. MSK + MSK Connect. Correct — runs the existing Kafka Connect connectors unmodified via Kafka-protocol compatibility.
- C. Firehose "absorbs any Kafka workload." Wrong — Firehose is not Kafka-protocol compatible and cannot host existing Kafka Connect connectors.
- D. Managed Flink replacing connectors. Wrong — replaces rather than preserves the existing connectors, violating "without touching... connectors."

### Q12 — Government tax-filing Glue OOM after new large-record category
**Correct: A, B**
- A. Investigate data skew. Correct — a new category with disproportionately large individual records is a classic skew trigger even when total volume looks modest.
- B. Check worker memory sizing. Correct — larger individual records may simply need more per-worker memory (a larger worker type), independent of or alongside a skew fix.
- C. Delete bookmarks immediately. Wrong — bookmarks track processed state; deleting them doesn't address a memory/skew problem and risks reprocessing unrelated data.
- D. Assume Lambda is needed. Wrong — OOM errors aren't unique to Spark, and Lambda isn't a substitute for this kind of batch join workload regardless.
- E. Disable IAM permissions. Wrong — nonsensical; deliberately breaking access doesn't diagnose a memory problem.

### Q13 — Retail POS one-time cutover, source can go offline
**Correct: A**
- A. DMS full-load-only. Correct — a one-time cutover with the source safely offline is exactly the full-load-only use case; no ongoing sync is needed.
- B. DMS full load + CDC. Wrong — CDC exists to minimize downtime by keeping a live source in sync; unnecessary overhead when the source can simply be quiesced.
- C. Glue Studio visual ETL. Wrong — not purpose-built for database migration fidelity the way DMS is.
- D. Transfer Family with an export file. Wrong — manual export/import, not the managed migration path.

### Q14 — Media conglomerate per-region row restriction, single shared table
**Correct: B**
- A. Physically split by region. Wrong — creates duplication and ongoing sync burden, and doesn't scale cleanly as new units are added.
- B. Lake Formation row-level data filters. Correct — the purpose-built, per-principal row-restriction mechanism on a single shared table, with minimal added grant maintenance as units are added.
- C. Client-side filtering after full table delivery. Wrong — every business unit still receives (and could inspect) rows outside their region before filtering; doesn't actually restrict access.
- D. Per-region KMS keys. Wrong — doesn't cleanly restrict row visibility in query results and adds key-management complexity Lake Formation avoids.

### Q15 — Fleet-telematics new access pattern after 2 years, eventual consistency OK
**Correct: B**
- A. LSI. Wrong — LSIs can only be defined at table creation; this table is two years old.
- B. GSI. Correct — can be added at any time, and eventual consistency is explicitly acceptable here.
- C. Recreate the table. Wrong — unnecessarily disruptive when a GSI solves the pattern directly.
- D. `Scan` with filter. Wrong — scans the whole table, doesn't scale, wastes capacity.

### Q16 — Mobile game Aurora MySQL to Redshift, least code/lag
**Correct: C**
- A. Scheduled Glue JDBC job. Wrong — batch extraction introduces lag and more custom code than necessary.
- B. DMS CDC via S3. Wrong — more moving parts and custom pipeline configuration than the simpler, purpose-built option below.
- C. Zero-ETL Aurora MySQL → Redshift. Correct — the textbook "least custom code, lowest lag" pairing for this exact source/target combination.
- D. Firehose streaming DB changes. Wrong — Firehose isn't a database-change-capture mechanism; this pairing doesn't exist as described.

### Q17 — Logistics tracking API latency across API Gateway/Lambda/DynamoDB
**Correct: B**
- A. Manual log search. Wrong — slow, disconnected view across services with no request-level correlation.
- B. AWS X-Ray. Correct — traces a single request end-to-end, showing exactly which segment introduces latency.
- C. CloudTrail. Wrong — records API/management activity, not application-level request latency.
- D. CloudWatch alarm on 5xx rate. Wrong — alarms on aggregate error rate, not on tracing where latency in a successful (slow, not erroring) request originates.

### Q18 — Government citizen Q&A over regulations/FAQs
**Correct: B**
- A. OpenSearch custom index. Wrong — returns ranked search results a human still interprets, not Kendra's direct-answer/highlighted-passage behavior.
- B. Amazon Kendra. Correct — ML-powered natural-language search returning direct answers or highlighted passages from documents.
- C. Athena with full-text extensions. Wrong — a SQL engine, not a natural-language document Q&A tool.
- D. Glue Data Catalog search. Wrong — a metadata catalog for tables/schemas, unrelated to document content search.

### Q19 — Insurance claims from many drifting adjuster-firm schemas
**Correct: B**
- A. Fixed-schema DataFrame, reject mismatches. Wrong — fails immediately and constantly given the described ongoing drift.
- B. DynamicFrame + `resolveChoice`. Correct — tolerates per-record schema variability and reconciles type/field inconsistencies explicitly.
- C. Require one exact schema from every firm. Wrong — unrealistic across "dozens" of independent firms with evolving systems.
- D. Convert to one flattened CSV first. Wrong — pushes the same reconciliation problem earlier without solving it, and loses type information.

### Q20 — Government SCP deny iam:CreateUser vs identity allow
**Correct: B**
- A. Identity allow takes precedence. Wrong — exactly backwards; SCPs are guardrails that cap what's possible regardless of IAM grants.
- B. SCP's deny overrides. Correct — an explicit deny at any evaluated layer, including an SCP, always wins over an allow elsewhere.
- C. Depends on creation order. Wrong — evaluation isn't determined by which policy was authored first.
- D. Root user bypass. Wrong — SCPs apply to all principals in affected accounts, including root, with only narrow, unrelated exceptions.

### Q21 — Hospital lab-results bookmark reset for a 12-day defect
**Correct: B**
- A. Re-enable bookmarks. Wrong — bookmarks were presumably already enabled; re-enabling doesn't force reprocessing of already-marked-as-seen data.
- B. Reset bookmark, rerun against the historical range. Correct — the designed mechanism to force reprocessing of already-bookmarked data with corrected logic.
- C. Increase DPUs. Wrong — unrelated to whether the bookmark allows reprocessing; a resourcing change, not a state change.
- D. Delete and recreate the job. Wrong — unnecessary; doesn't specifically address reprocessing the affected files.

### Q22 — Bank mobile app single hot customer item
**Correct: A, B**
- A. Write-sharding via key suffix. Correct — spreads that one customer's disproportionate writes across more physical partitions without touching every other customer's key design.
- B. DAX for the repeated reads. Correct — absorbs the hot-item read volume at microsecond latency without application read-logic changes.
- C. On-demand mode "rebalances automatically." Wrong — a common misconception; on-demand changes overall table scaling/billing, not a single hot logical item's throttling by itself.
- D. Increase overall provisioned capacity. Wrong — the problem is isolated to one item, not table-wide; broad capacity increases are wasteful and don't target it.
- E. Add a GSI "to spread the hot item." Wrong — GSIs support new query patterns; they don't automatically shard or cache an existing hot item's traffic.

### Q23 — Retail merchandising natural-language QuickSight questions
**Correct: B**
- A. Amazon Q Developer. Wrong — an IDE-integrated coding assistant, not a BI natural-language query feature.
- B. Amazon Q in QuickSight. Correct — purpose-built natural-language querying directly inside QuickSight dashboards.
- C. Athena with saved queries. Wrong — still requires someone to have written SQL in advance; doesn't answer novel plain-English questions.
- D. Kendra connected to the dataset. Wrong — Kendra is a document search/Q&A service, not a BI-dashboard natural-language query engine over structured data.

### Q24 — Documentary platform blockbuster title causing join skew
**Correct: B**
- A. Add more G.1X workers. Wrong — adds uniform capacity; doesn't shrink the oversized tasks handling the blockbuster's disproportionate share.
- B. Recognize and mitigate skew. Correct — a sudden OOM onset coinciding with one title driving 35% of events is the classic skew signature; salting or skew-join optimization targets the actual imbalance.
- C. Disable the metadata join entirely. Wrong — removes needed functionality rather than fixing the imbalance, and the 600 MB metadata table isn't the actual problem (it's a good broadcast-join candidate).
- D. Switch to Flex execution class. Wrong — Flex affects job start-time predictability/cost, not per-worker memory allocation or skew.

### Q25 — IoT compliance logs, 6-year unbypassable retention
**Correct: B**
- A. Versioning + IAM deny. Wrong — an IAM policy can be changed by someone with sufficient permissions; not a true unbypassable guarantee.
- B. Object Lock compliance mode. Correct — blocks deletion/modification by every principal, including administrators, until retention expires.
- C. Object Lock governance mode. Wrong — can be overridden by a principal with `s3:BypassGovernanceRetention`, failing "including account administrators."
- D. Nightly backup to a second bucket. Wrong — the original objects in the primary bucket could still be altered/deleted; a backup copy doesn't enforce WORM on the source.

### Q26 — Mobile game bursty Redshift usage around events
**Correct: B**
- A. Provisioned, sized for peak, 24/7. Wrong — pays for peak size during the many idle days between events.
- B. Redshift Serverless. Correct — auto-scales RPUs to burst traffic and scales down between events, avoiding both manual planning and idle cost.
- C. Provisioned + RIs "always cheapest." Wrong — RIs discount steady, predictable usage; this workload is explicitly the opposite.
- D. Athena "since it's a data warehouse need." Wrong — the scenario describes warehouse-style BI querying, which Redshift Serverless is purpose-built for at this concurrency/complexity level; nothing in the stem suggests Athena's simple ad hoc model is preferred over a warehouse.

### Q27 — Insurance catastrophe dataset subscription
**Correct: B**
- A. Scheduled Lambda polling. Wrong — exactly the custom API-polling code the requirement wants avoided.
- B. AWS Data Exchange. Correct — the purpose-built marketplace for subscribing to licensed third-party datasets with direct S3/Redshift delivery, no custom pipeline.
- C. AppFlow as generic SaaS source. Wrong — AppFlow connects to named SaaS application APIs, not a dataset marketplace subscription.
- D. DMS from the provider's internal systems. Wrong — DMS replicates from databases you have access to migrate/replicate from, not a third-party's arbitrary internal systems via a licensing relationship.

### Q28 — Telecom predictable monthly 90-minute Redshift spike
**Correct: B**
- A. Permanently resize. Wrong — pays for peak capacity the other ~29+ days a month.
- B. Concurrency scaling. Correct — adds transient capacity automatically for the predictable, bounded spike, then returns to baseline.
- C. Ask the team to spread queries out. Wrong — a process workaround, not a reliable technical fix.
- D. Move reporting to DynamoDB. Wrong — not a substitute for SQL-based warehouse reporting.

### Q29 — Hospital Aurora PostgreSQL credential rotation
**Correct: A, B**
- A. Secrets Manager with automatic rotation. Correct — native, built-in rotation integration for Aurora, no custom rotation code.
- B. KMS key grants the rotation mechanism decrypt/data-key access. Correct — the secret's encryption key must permit the rotation mechanism to operate; a commonly overlooked prerequisite alongside enabling rotation itself.
- C. Parameter Store SecureString, no rotation. Wrong — explicitly no rotation configured, failing the stated requirement.
- D. Hardcode credentials quarterly. Wrong — manual, not automatic, and a security anti-pattern regardless.
- E. Disable encryption to simplify access. Wrong — removes required protection rather than correctly configuring key-policy access.

### Q30 — Government open-data curated Parquet extract via SQL
**Correct: A**
- A. Athena CTAS with `partitioned_by`. Correct — a single SQL statement both defines and materializes the partitioned extract, no separate ETL job.
- B. Redshift `UNLOAD` from a cluster that doesn't hold the data. Wrong — `UNLOAD` exports from an existing Redshift table; the data isn't described as being in Redshift at all.
- C. Manual repeated console exports. Wrong — manual and not a repeatable SQL-based process.
- D. A full Glue ETL job. Wrong — disproportionate engineering for what CTAS accomplishes in one statement.

### Q31 — Hospital genomics EMR cost minimization, unchanged toolchain
**Correct: B**
- A. Spot on every node type. Wrong — Spot interruption on primary/core risks losing the whole cluster mid-run.
- B. On-Demand primary/core, Spot task nodes. Correct — keeps cluster-critical nodes reliable while capturing real Spot savings on task nodes.
- C. Migrate to Glue. Wrong — contradicts "without changing their existing Spark/Hadoop toolchain."
- D. RIs for every node type. Wrong — doesn't minimize cost as aggressively as Spot on non-critical nodes, and is a poor fit if the workload isn't a stable 24/7 baseline.

### Q32 — Government eligibility pipeline no-code data quality gate
**Correct: B**
- A. Custom PySpark assertions. Wrong — more custom code than a no-code requirement calls for.
- B. Glue Data Quality (DQDL). Correct — declarative completeness/uniqueness/range rules with automatic fail-on-violation, no custom code.
- C. Amazon Macie. Wrong — discovers sensitive data; doesn't validate business rules like ID uniqueness or numeric ranges.
- D. Manual sample review. Wrong — not automated, doesn't halt the pipeline before it proceeds.

### Q33 — Retail 80,000-file parallel image classification with retry
**Correct: A, B**
- A. Step Functions Distributed Map over the S3 objects. Correct — massive native parallelism over an S3 object set with no custom parallelization code.
- B. Distributed Map's built-in Catch/Retry. Correct — the per-item retry/error handling mechanism the requirement asks for, built into the same state.
- C. One Lambda looping sequentially. Wrong — no parallelism at all, and risks the 15-minute Lambda ceiling regardless.
- D. Separate Lambda per S3 event, no orchestration. Wrong — no centralized retry/error visibility or coordination, and "no orchestration layer" contradicts the requirement for built-in retry handling.
- E. Express workflows without Distributed Map. Wrong — loses the native massive-parallel-iteration-over-S3-objects mechanism that's the actual fit here.

### Q34 — Retail unmasked card numbers across unindexed buckets
**Correct: B**
- A. AWS Config bucket compliance. Wrong — evaluates resource configuration, not object content.
- B. Amazon Macie. Correct — ML- and pattern-based sensitive-data discovery across S3 at scale, no manual inspection or existing inventory required.
- C. Glue Data Quality for card-number checks. Wrong — DQDL validates structured business rules against known schemas; not the purpose-built PII/PCI discovery tool.
- D. Kendra searching for the phrase "credit card." Wrong — a document search tool, not a systematic sensitive-pattern classifier, and unreliable for finding actual card-number strings versus the literal phrase.

### Q35 — Utility billing table point-in-time query + schema evolution
**Correct: B**
- A. Standard Hive-style Parquet. Wrong — no time travel, and adding columns generally requires care/rewrite rather than Iceberg's in-place evolution.
- B. Apache Iceberg. Correct — snapshot/time-travel for the point-in-time dispute, and native `ALTER TABLE ADD COLUMN` schema evolution without rewriting existing files.
- C. Manual daily S3 Batch Operations snapshots. Wrong — heavy-handed, error-prone, and not a native table-level point-in-time feature.
- D. DynamoDB PITR on an exported copy. Wrong — introduces an unrelated database and export process rather than solving this within the existing table.

### Q36 — Gaming platform's 40 existing Airflow DAGs, minimal changes
**Correct: B**
- A. Rewrite as Step Functions. Wrong — requires rewriting all 40 DAGs, contradicting "largely unchanged."
- B. MWAA. Correct — a managed Airflow environment running existing DAGs and Python dependencies with minimal change.
- C. Glue Workflows. Wrong — scoped to Glue jobs/crawlers, not general Airflow DAGs.
- D. EventBridge Scheduler + per-task Lambdas. Wrong — would require rebuilding the DAGs' logic entirely as separate scheduled functions.

### Q37 — Healthcare imaging 403 on SSE-KMS metadata despite S3 grants
**Correct: A**
- A. Check the KMS key policy for `kms:Decrypt`. Correct — S3 permissions alone don't grant decrypt capability for SSE-KMS objects; a separate KMS key-policy (or grant) statement is required, and the scenario already confirms both the identity policy and bucket policy grant S3 access, isolating the gap to the KMS layer.
- B. Immediately grant `s3:*`/`kms:*`. Wrong — over-broad, skips diagnosis, and poor security practice; the scenario asks what to check, not to brute-force permissions past the actual gap.
- C. Assume corruption, re-upload. Wrong — a 403 is an access-control signal, not a data-integrity signal; re-uploading doesn't address a permissions gap.
- D. "Glue cannot read SSE-KMS under any configuration." Wrong — factually false; Glue reads SSE-KMS objects routinely given correct S3 and KMS permissions.

### Q38 — Telecom joining Redshift warehouse to 5-year S3 archive
**Correct: B**
- A. Load 5 years via COPY. Wrong — directly contradicts "without loading the archive into the cluster."
- B. Redshift Spectrum external schema. Correct — Redshift already exists and needs to join S3 data without loading it, Spectrum's exact use case.
- C. Athena + manual merge. Wrong — more manual effort than Spectrum's direct in-warehouse join.
- D. Zero-ETL to bring the archive in. Wrong — zero-ETL targets operational database sources, not S3 files, and would load data in anyway, violating the requirement.

### Q39 — Insurance actuarial Spark, no cluster management, pay-per-run
**Correct: B**
- A. EMR on EC2 with managed scaling. Wrong — still requires provisioning/managing a cluster, even with managed scaling.
- B. EMR Serverless. Correct — runs existing Spark code without provisioning/patching/managing EC2, billed only while jobs run.
- C. Glue ETL, rewrite to DynamicFrames. Wrong — requires meaningful code changes, contradicting "minimal changes to the existing codebase."
- D. Lambda, refactor into smaller functions. Wrong — a substantial rewrite, and a poor fit for Spark-scale batch processing generally.

### Q40 — Federal OU-wide public-access-block guardrail
**Correct: B**
- A. Per-role IAM deny policies. Wrong — must be applied and maintained consistently across every role in every account; a single missed role breaks the guarantee.
- B. SCP at the OU level. Correct — a single, org-enforced guardrail applying regardless of what any individual role is otherwise granted.
- C. AWS Config detect-and-alert. Wrong — detects after the fact; doesn't prevent the change from happening, which the requirement demands.
- D. Single break-glass admin user. Wrong — doesn't prevent every other principal in every account under the OU from making the change; too narrow a control point.

### Q41 — Industrial sensor manufacturer hot shards from high-volume devices
**Correct: A, B**
- A. Key entropy for high-volume devices. Correct — spreads their disproportionate event volume across more shards without a table-wide/stream-wide redesign.
- B. Split the hot shards. Correct — directly adds capacity to the specific overloaded key ranges causing the throttling.
- C. Increase retention to 365 days. Wrong — retention governs replay window, not write throughput distribution.
- D. Enable EFO on all consumers. Wrong — EFO addresses consumer read throughput, not producer-side write throttling on hot shards.
- E. On-demand "automatically rebalances any hot key." Wrong — a common misconception; on-demand scales overall table/stream capacity, not a specific hot logical key's distribution by itself.

### Q42 — National bank 12-year, tens-of-millions-partition Athena table
**Correct: B**
- A. Weekly crawler. Wrong — reduces crawler cost somewhat but leaves query-planning latency unresolved.
- B. Partition projection. Correct — a fully predictable scheme with enormous partition counts is the textbook projection case, removing catalog dependency and planning latency.
- C. Remove partitioning entirely. Wrong — eliminates pruning, making most queries scan far more data.
- D. Move to DynamoDB. Wrong — not a substitute for a partitioned, SQL-queried analytical table.

### Q43 — Mobile game guild-history SCD Type 2
**Correct: B**
- A. Overwrite in place. Wrong — destroys the history the analytics requirement explicitly needs.
- B. SCD Type 2. Correct — the standard data-modeling pattern for preserving attribute history via new rows with effective-date ranges rather than overwriting.
- C. Denormalized comma-separated string. Wrong — not queryable/analyzable in any structured, reliable way, and a poor modeling practice.
- D. DynamoDB TTL to expire old values. Wrong — TTL deletes data; the requirement is to preserve history, the opposite of expiring it.

### Q44 — Media ad-exchange 2-minute sliding-window fraud counts
**Correct: C**
- A. Firehose + Lambda transform. Wrong — Firehose transformations act on individual records/batches during delivery, not continuous stateful windowed aggregation.
- B. Scheduled Athena every 2 minutes. Wrong — batch-y, re-scans repeatedly, not truly continuous/real-time.
- C. Managed Service for Apache Flink, sliding window. Correct — purpose-built for continuous, stateful windowed aggregation updated as events arrive.
- D. Hourly Glue batch job. Wrong — far too infrequent for a live, minute-scale fraud dashboard.

### Q45 — Federal OU preventing IAM self-privilege-escalation
**Correct: B**
- A. Training alone. Wrong — not an enforced technical control at all.
- B. SCP denying `iam:PutRolePolicy` at the sensitive OU. Correct — an org-level guardrail that no identity policy or permissions boundary inside the OU can override, directly preventing the described escalation path.
- C. Permissions boundaries alone, no SCP. Wrong — boundaries constrain what a role's *own* policies can grant, but a role could still be granted a *different* boundary or have its boundary removed by someone with sufficient IAM permissions; without an SCP backstop, this isn't a hard guarantee.
- D. Resource-based policies on the roles. Wrong — IAM roles are not typically governed by resource-based policies for this kind of self-modification control; this isn't the applicable mechanism.

### Q46 — Gaming leaderboard microsecond reads
**Correct: B**
- A. On-demand mode. Wrong — changes billing/scaling model, not read latency down to microseconds.
- B. DAX. Correct — DynamoDB-native microsecond-latency caching layer, minimal application changes.
- C. Increase provisioned RCUs. Wrong — more capacity doesn't change DynamoDB's baseline single-digit-millisecond latency floor.
- D. Add a GSI. Wrong — supports new query patterns, doesn't cache or reduce latency for an existing hot read pattern.

### Q47 — Telecom 60 GB, 35-minute batch job proposed for Lambda
**Correct: B**
- A. Lambda, max memory/timeout. Wrong — 35 minutes exceeds Lambda's 15-minute hard ceiling regardless of memory settings.
- B. Glue ETL or EMR Serverless, sized appropriately. Correct — purpose-built for this scale of batch join/aggregation workload, well within their design envelope.
- C. Split into chunks across many Lambda invocations, merge results. Wrong — significant custom orchestration complexity to work around Lambda's limits rather than using a service actually built for this workload.
- D. Increase reserved concurrency. Wrong — concurrency controls how many parallel invocations run, not the 15-minute per-invocation ceiling that's the actual blocker.

### Q48 — Telecom alert fatigue from retried long-running queries
**Correct: B**
- A. Remove alerting, check manually. Wrong — reintroduces slow manual monitoring rather than fixing the alert's scope.
- B. Alert only on exhausted retries, recalibrate threshold. Correct — targets the actual root cause (alerting on every attempt, and a possibly miscalibrated threshold) rather than removing alerting or blunt instruments.
- C. Increase SNS batching window. Wrong — delays/dedupes by time, not by whether the query ultimately succeeded; doesn't fix the underlying over-alerting logic.
- D. Disable retries entirely. Wrong — the opposite direction; maximizes pages rather than reducing noise from self-resolving cases.

### Q49 — IoT device-registration object-level audit
**Correct: B**
- A. Existing management events. Wrong — don't capture object-level read/modify activity.
- B. CloudTrail data events for the bucket. Correct — the mechanism for object-level S3 activity, explicitly opt-in.
- C. AWS Config change history. Wrong — tracks resource configuration state changes, not object-level data access.
- D. S3 Transfer Acceleration logging. Wrong — unrelated; Transfer Acceleration is a performance feature, not an access-audit mechanism.

### Q50 — Government benefits Athena over DynamoDB without impacting live app
**Correct: A, B**
- A. Export-to-S3, then query with Athena. Correct — consumes no table read/write capacity, unlike a `Scan`.
- B. Schedule for low-traffic hours, verify via consumed-capacity metrics. Correct — a reasonable operational practice reinforcing that the live application stays unaffected.
- C. Scheduled `Scan` against the live table. Wrong — directly consumes capacity and risks throttling the live application, exactly what the requirement rules out.
- D. Increase read capacity to accommodate both. Wrong — still couples analytics load to the live table's capacity, and increases cost rather than avoiding the coupling.
- E. DynamoDB Streams, manually replay every item per report. Wrong — Streams are for near-real-time change capture, not a practical mechanism for ad hoc periodic full-table reporting exports.

### Q51 — Insurance analyst no-code exploratory profiling
**Correct: B**
- A. Glue Studio visual editor. Wrong — builds ETL job graphs for engineers, not an exploratory profiling tool for a non-coding analyst.
- B. Glue DataBrew. Correct — point-and-click profiling and cleaning, purpose-built for non-coders exploring a new dataset.
- C. Athena with manual SQL. Wrong — requires writing SQL, contradicting "does not write code."
- D. Lambda with a custom script. Wrong — requires writing code, same problem as C.

### Q52 — Insurance dashboard alert requiring two co-occurring conditions
**Correct: B**
- A. Two independent alarms. Wrong — either alarm alone would notify, which the scenario explicitly says is not actionable/common and not desired.
- B. Composite alarm with an AND condition. Correct — fires only when both underlying alarms are simultaneously in alarm state, matching the stated requirement exactly.
- C. CPU alone. Wrong — explicitly described as common and not, by itself, actionable.
- D. X-Ray latency alerting. Wrong — X-Ray traces requests; it isn't the mechanism for combining a latency metric alarm with a CPU metric alarm.

### Q53 — Retail 500 TB over unreliable connection, one-time
**Correct: B**
- A. DataSync over the existing connection. Wrong — still bandwidth-bound; a poor fit for hundreds of terabytes over an unreliable link.
- B. Snowball Edge. Correct — physically ships and returns, bypassing the network entirely for exactly this scale/reliability profile.
- C. Transfer Family SFTP. Wrong — same bandwidth-dependency problem.
- D. Compress and upload via console over weeks. Wrong — impractical, error-prone, and still bandwidth-bound.

### Q54 — Media temporary contractor KMS decrypt access, no key-policy edit
**Correct: B**
- A. Permanent key-policy statement, manually removed later. Wrong — exactly the "manually remove it afterward" pattern the requirement wants to avoid, and risks being forgotten.
- B. Time-limited KMS grant. Correct — the explicitly temporary, revocable, programmatic access mechanism KMS provides distinct from key-policy edits, matching "without permanently modifying the key policy."
- C. Share key material directly. Wrong — KMS key material is never directly shared; this isn't how KMS access works and would be a severe security failure if it were possible.
- D. Disable encryption temporarily. Wrong — removes required protection rather than granting scoped, temporary access.

### Q55 — Fleet-management Kibana-style search and dashboards
**Correct: A**
- A. Amazon OpenSearch Service. Correct — purpose-built for full-text search and near-real-time log analytics/dashboards at this description.
- B. Amazon Kendra. Wrong — a document Q&A/search service, not a log-analytics/aggregation dashboard tool.
- C. Athena with scheduled refresh. Wrong — not built for free-text search or the fast aggregation/visualization experience described.
- D. Redshift materialized views. Wrong — a SQL warehouse feature, not a full-text search/Kibana-style analytics tool.

### Q56 — Gaming duplicate purchase charges from retries
**Correct: B**
- A. Reduce retry count. Wrong — reduces but doesn't eliminate duplicate risk; doesn't fix the underlying non-idempotent write.
- B. Make the write idempotent. Correct — the direct fix; a deterministic dedup key or conditional write prevents a retried write from double-applying.
- C. Firehose "guarantees exactly-once." Wrong — Firehose doesn't provide exactly-once delivery guarantees, and it's not even the service in play here (an in-app purchase write path, not a Firehose stream).
- D. Disable retries entirely. Wrong — trades duplicate risk for lost-write risk on genuinely transient failures; doesn't solve the actual idempotency gap.

### Q57 — Government multi-agency QuickSight dashboards, no per-view warehouse hit
**Correct: B**
- A. Separate DB users with row-filtering views. Wrong — functionally possible but doesn't deliver the fast, cached, high-concurrency performance without hitting Redshift on every view.
- B. QuickSight + SPICE + row-level security. Correct — SPICE caches for fast concurrent access; RLS restricts each agency to its own data, without hitting the warehouse per view.
- C. Daily CSV export, emailed. Wrong — not an interactive dashboard, and not centrally access-controlled.
- D. QuickSight direct query mode. Wrong — queries Redshift on every interaction, failing the stated requirement under hundreds of concurrent viewers.

### Q58 — Insurance 400 GB COPY, single large gzip file
**Correct: A, B**
- A. Split into multiple, slice-aligned files. Correct — enables Redshift to load in parallel across slices instead of serially through one file.
- B. Keep files compressed, 1 MB–1 GB range. Correct — the documented sweet spot balancing parallelism and per-file overhead.
- C. Individual `INSERT` statements. Wrong — dramatically slower than `COPY` for bulk loading; the opposite of the desired fix.
- D. More sort keys. Wrong — sort keys affect query performance via zone maps, not `COPY` load parallelism.
- E. Disable compression. Wrong — increases data volume moved and generally hurts, rather than helps, load performance at this scale.

### Q59 — Insurance actuarial in-IDE Glue PySpark AI assistant
**Correct: B**
- A. Amazon Q in QuickSight. Wrong — a BI natural-language assistant, not an IDE coding assistant.
- B. Amazon Q Developer. Correct — an AI coding assistant integrated into IDEs that generates/explains code and suggests fixes as engineers write pipeline code.
- C. Kendra over the internal wiki. Wrong — a document search tool, not an interactive in-IDE coding assistant.
- D. CodeGuru Reviewer. Wrong — automated code review on repositories/pull requests, not an interactive assistant while writing code.

### Q60 — Bank DR recovery + true 7-year WORM mandate
**Correct: A, B**
- A. S3 versioning. Correct — directly satisfies "recover any accidentally overwritten or deleted object to its prior state."
- B. Object Lock compliance mode (requires versioning). Correct — the only mechanism satisfying "no principal, including administrators, can bypass" for the 7-year window, and correctly notes its versioning prerequisite.
- C. IAM policy denial alone. Wrong — can be changed by a sufficiently privileged principal; not a true unbypassable guarantee.
- D. Governance mode only. Wrong — can be overridden by `s3:BypassGovernanceRetention`, failing the "including administrators" requirement.
- E. Cross-Region Replication as a substitute. Wrong — CRR provides geographic redundancy, not object-version recovery or WORM enforcement on the original objects.

### Q61 — Hospital 10-year imaging metadata, occasional same-day retrieval
**Correct: B**
- A. Deep Archive for all 10 years. Wrong — up to ~12-hour retrieval, failing "a few hours' notice" same-day requests.
- B. Glacier Flexible Retrieval, expedited for audits. Correct — low storage cost with an expedited retrieval tier (minutes) available for the occasional urgent request.
- C. Standard-IA for all 10 years. Wrong — meaningfully more expensive for long-term storage than a Glacier tier at this retention length.
- D. Intelligent-Tiering "optimizes any pattern." Wrong — the pattern here is known (long-term cold, rare urgent exceptions), which a directly chosen Glacier tier addresses more cost-effectively than Intelligent-Tiering's monitoring-fee-bearing automatic approach.

### Q62 — Bank Redshift blocked by a stuck uncommitted transaction
**Correct: B**
- A. Enable concurrency scaling. Wrong — concurrency scaling adds query *slots*; it doesn't release locks held by a specific stuck transaction, which will still block regardless of available slots.
- B. Identify and terminate the stuck session. Correct — directly addresses the actual root cause (a lock-holding transaction), which no amount of added concurrency capacity resolves.
- C. Permanently resize the cluster. Wrong — doesn't address a blocking-lock problem at all.
- D. Disable short query acceleration. Wrong — unrelated to a session holding locks on a table.

### Q63 — Marketplace conditional routing to fraud-review by price
**Correct: B**
- A. SNS with filtering only on one subscription. Wrong — works as a pattern in principle, but EventBridge's rule-based content routing is the more direct, purpose-built mechanism for content-based routing to a specific target here.
- B. EventBridge content-filtering rule. Correct — rules evaluate the `price` attribute and route to the fraud-review target only when it matches, exactly as required.
- C. SQS with each service polling/discarding. Wrong — wastes fraud-review's compute filtering out irrelevant events itself.
- D. Lambda with conditional logic calling all three. Wrong — a bespoke, harder-to-maintain routing layer instead of managed content-based routing.

### Q64 — News outlet breaking-news hot item, no restructuring
**Correct: B**
- A. Increase RCUs "just in case." Wrong — provisioning ahead of every publication for an unpredictable spike is wasteful and doesn't provide microsecond latency regardless.
- B. DAX. Correct — absorbs the extreme, transient hot-item read spike at microsecond latency without restructuring storage or read logic.
- C. On-demand "eliminates hot-item latency entirely." Wrong — a misconception; on-demand changes billing/scaling, not a specific hot item's latency floor.
- D. GSI on `published_at`. Wrong — supports a different query pattern; doesn't cache or reduce latency for repeated reads of the same hot item.

### Q65 — Industrial IoT combined storage-tier and query-pruning cost problem
**Correct: B**
- A. Move everything to Deep Archive. Wrong — makes frequently-relevant recent data (needed for the dashboards) slow/expensive to retrieve; ignores that only *older* data is the storage-cost problem.
- B. Lifecycle-tier older data appropriately, and add partition predicates to the dashboard queries. Correct — addresses both independently diagnosed causes: storage cost (via tiering matched to actual access pattern) and Athena scan cost (via letting partition pruning actually work instead of scanning full years).
- C. Increase the workgroup's usage control limit. Wrong — tolerates the wasteful scanning rather than fixing it; doesn't address storage cost at all.
- D. Migrate everything to DynamoDB. Wrong — a disproportionate, unrelated architectural change that doesn't address either diagnosed cause and isn't a fit for this analytical query pattern.
