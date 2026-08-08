# Full Mock Exam 1 — DEA-C01 (65 questions, 130 minutes)

## Instructions — read before starting

- **65 questions, 130 minutes.** That's 2 minutes per question — pace yourself.
- **No notes, no pausing, no looking anything up.** Simulate real exam conditions completely.
- **Do not open `Answer-Key.md` or `Explanations.md` until you have recorded a final answer for all 65 questions.** Use the answer grid at the bottom of this file to record your answers as you go.
- **Passing score is 720 out of a scaled 1000**, which works out to roughly 70–75% correct (~46+/65). Scoring is **compensatory** — there is no per-domain minimum, so a weak domain can be offset by strong performance elsewhere.
- **There is no penalty for a wrong answer.** Never leave a question blank — an educated guess beats a zero every time.
- Most questions have **four options, pick one**. Questions marked **"(Choose TWO)"** have five options and require exactly two answers — no partial credit for one right and one wrong.
- Questions are presented in **randomized order**, not grouped by domain. That's intentional — the real exam does the same, so you can't infer the topic from where a question sits.

When you finish, score yourself against `Answer-Key.md`, then work through every question — right and wrong — in `Explanations.md`.

---

**Q1.** A manufacturing company operates 4,000 factory-floor sensors. Under peak load, the fleet produces 6,000 telemetry records per second, with an average record size of 2.5 KB. A downstream anomaly-detection system needs sub-second access to this data, and the team wants to avoid manually managing streaming capacity as sensor count grows.

A. Provision a Kinesis Data Streams stream with 6 shards.
B. Provision a Kinesis Data Streams stream with 15 shards, and manually reshard as volume grows.
C. Create a Kinesis Data Streams stream in on-demand capacity mode.
D. Configure Amazon Data Firehose for real-time delivery to the anomaly-detection system.

---

**Q2.** A retail company's Amazon Redshift `products` fact table is distributed with `DISTKEY` on `country_code`, which has only 8 distinct values. Query performance has degraded because a small number of node slices handle most of the join work against an `orders` table joined on the same column.

A. Increase the number of nodes in the cluster.
B. Change the distribution style of the `products` table to `DISTSTYLE ALL`.
C. Change the distribution key to a higher-cardinality join column, or use `DISTSTYLE AUTO`.
D. Add an interleaved sort key on `country_code`.

---

**Q3.** A gaming company streams player-action events through Kinesis Data Streams, consumed by a Lambda function that enriches events before writing them to a data lake. `GetRecords.IteratorAgeMilliseconds` has been steadily climbing for the past hour, and player-facing stat dashboards are showing stale data.

A. Producers are exceeding the stream's write throughput; add more shards.
B. The consumer is falling behind; increase the Lambda parallelization factor, scale consumers, or enable enhanced fan-out.
C. The Lambda function's memory setting is too high, causing throttling.
D. Replace the stream with Amazon Data Firehose to remove the need for a consumer.

---

**Q4.** *(Choose TWO)* A telecom operator ingests call-detail records (CDRs) from network elements. Three independent downstream systems — billing, fraud detection, and archival — must each consume the full event stream independently, and the fraud team must be able to reprocess the last 3 days of events after a detection-rule change.

A. Use Amazon Data Firehose with three separate delivery streams, one per consumer.
B. Use Kinesis Data Streams with a retention period of at least 3 days.
C. Enable enhanced fan-out so each consumer gets a dedicated throughput pipe per shard.
D. Use SQS Standard queues, one per consumer, fed by a custom Lambda fan-out function.
E. Reduce the number of shards to lower cost, since Firehose scales automatically.

---

**Q5.** A healthcare analytics company stores patient records in a data lake cataloged in the Glue Data Catalog. Data analysts must be able to query every column except `ssn` and `date_of_birth`, and this restriction must apply consistently across both Athena and Redshift Spectrum without duplicating the underlying data.

A. Create an IAM policy that restricts access to the `ssn` and `date_of_birth` columns.
B. Use AWS Lake Formation column-level permissions to grant a data filter that excludes those columns.
C. Create a second S3 bucket containing a copy of the data with the sensitive columns removed.
D. Encrypt the two columns with client-side KMS and restrict key access via IAM.

---

**Q6.** A logistics company's shipment-events table in Athena has partitions by year/month/day/hour going back 5 years across thousands of trucks — tens of millions of partitions in total. An hourly Glue crawler keeps the catalog updated, but both crawler cost and query planning time have become a major operational burden. The partitioning scheme is fully predictable.

A. Run the crawler less frequently, such as once daily.
B. Configure Athena partition projection on the table so partition locations are computed instead of looked up.
C. Migrate the table to Redshift Spectrum, which does not use partitions.
D. Increase the number of DPUs assigned to the crawler.

---

**Q7.** An e-commerce company captures clickstream events that must land in S3, partitioned by `customer_region` and event date, queryable within about 2 minutes, with the least possible operational overhead. No replay and no multiple independent consumers are required.

A. Kinesis Data Streams with a Lambda consumer that writes partitioned Parquet files to S3.
B. Amazon Data Firehose with dynamic partitioning on `customer_region` and Parquet format conversion enabled.
C. An AWS Glue streaming job reading directly from the application and writing to S3 every 2 minutes.
D. A cron job that batch-exports clickstream logs from the application server to S3 every hour.

---

**Q8.** An insurance company ingests daily policy and claims files into its data lake. Before a nightly Glue ETL job promotes data to the curated zone, the team wants to automatically verify that `policy_id` has no nulls, values are unique, and claim amounts fall within an expected range — and halt the pipeline on violations, with minimal custom code.

A. Write custom PySpark assertions inside the Glue job for each condition.
B. Use AWS Glue Data Quality with a DQDL ruleset attached to the job, configured to fail on violations.
C. Use Amazon Macie to scan the files for anomalies before the job runs.
D. Use Glue DataBrew to manually profile the data before each run.

---

**Q9.** A media streaming company stores viewer-interaction logs in S3. The access pattern is well understood: logs are read frequently for the first 30 days for recommendation-engine training, then almost never accessed again, except that auditors may occasionally request specific logs with only a few hours' notice for compliance reviews. The team wants the lowest-cost storage approach for this known pattern.

A. Enable S3 Intelligent-Tiering on the bucket.
B. Configure a lifecycle policy transitioning objects to S3 Glacier Deep Archive after 30 days.
C. Configure a lifecycle policy transitioning objects to S3 Glacier Flexible Retrieval after 30 days.
D. Configure a lifecycle policy transitioning objects to S3 Standard-IA indefinitely after 30 days.

---

**Q10.** A bank is migrating an on-premises Oracle database — including its schema, stored procedures, and views — to Amazon Aurora PostgreSQL. Application traffic must keep running against Oracle until cutover, with minimal downtime.

A. Use AWS DMS alone to migrate both the schema and the data.
B. Use DMS Schema Conversion to convert the schema and code objects, then run a DMS task with full load + CDC to migrate and keep data in sync until cutover.
C. Export the Oracle schema manually using SQL scripts, then run a DMS full-load-only task.
D. Use AWS Glue to read from Oracle via JDBC on a nightly schedule until cutover.

---

**Q11.** A government agency's Glue ETL job fails with `AccessDenied` when reading SSE-KMS-encrypted objects from S3. The job's IAM role already has `s3:GetObject` on the bucket, and the bucket policy allows the role.

A. Grant the IAM role broader S3 permissions, such as `s3:*`.
B. Add a statement to the KMS key policy granting the job's IAM role `kms:Decrypt`.
C. Disable encryption on the bucket.
D. Attach the `AdministratorAccess` managed policy to the role.

---

**Q12.** *(Choose TWO)* A gaming company's DynamoDB table stores player profiles keyed by `player_id`. Two new access patterns are needed: (1) query players by `region`, eventual consistency acceptable, added after the table has been in production for a year; (2) query a player's items by `item_rarity` with strong consistency, a pattern known before the table was created.

A. Use a Global Secondary Index for the `region` pattern, since GSIs can be added at any time.
B. Use a Local Secondary Index for the `region` pattern, since it shares the table's read capacity.
C. Use a Local Secondary Index for the `item_rarity` pattern, since it was defined at table creation and supports strong consistency.
D. Use a Global Secondary Index for the `item_rarity` pattern to support strong consistency.
E. Use DynamoDB Streams to replicate data into a second table with a different key schema for both patterns.

---

**Q13.** A bank's compliance team needs an ongoing audit trail of exactly which IAM principal accesses (reads or writes) specific customer statement objects in an S3 bucket, going forward, for regulatory purposes. CloudTrail management events are already enabled account-wide.

A. Rely on the existing CloudTrail management event history.
B. Enable CloudTrail data events for the specific S3 bucket.
C. Enable VPC Flow Logs on the VPC hosting the analytics workloads.
D. Enable S3 versioning on the bucket.

---

**Q14.** An e-commerce company runs its order-management application on Aurora MySQL. The BI team wants near-real-time reporting on order data in Amazon Redshift, with the least possible operational overhead and no custom pipeline code to build or maintain.

A. Build a Glue ETL job that extracts from Aurora via JDBC on a schedule and loads into Redshift.
B. Use AWS DMS with CDC to continuously replicate Aurora changes into Redshift via S3.
C. Configure a zero-ETL integration from Aurora MySQL to Amazon Redshift.
D. Use Amazon Data Firehose to stream database changes into Redshift.

---

**Q15.** A telecom's nightly Glue ETL job uses job bookmarks to process only new usage-detail files since the last run. A bug is discovered in the transformation logic that has been running for the past 10 days, and the team must reprocess all 10 days of historical files through the corrected job.

A. Enable job bookmarks on the job before the next run.
B. Reset the job bookmark for the job, then rerun it against the historical data.
C. Increase the number of DPUs assigned to the job.
D. Delete and recreate the Glue job with the corrected script.

---

**Q16.** An insurance company needs to store around 800 non-sensitive application configuration values (feature flags, thresholds) used by its Glue jobs, at the most cost-effective price point. No automatic rotation is required.

A. AWS Secrets Manager.
B. AWS Systems Manager Parameter Store, Standard tier.
C. A DynamoDB table with on-demand capacity.
D. Hardcode the values directly in the Glue job scripts.

---

**Q17.** A media company runs existing Apache Spark and Hive jobs on Amazon EMR to process petabytes of viewing data nightly. The team wants to minimize compute cost as much as possible without changing the existing framework.

A. Run all cluster nodes, including the primary and core nodes, on Spot Instances.
B. Run the primary and core nodes on On-Demand Instances, and run task nodes on Spot Instances using instance fleets.
C. Migrate the jobs to AWS Glue to remove infrastructure costs entirely.
D. Purchase Reserved Instances for all node types.

---

**Q18.** A healthcare data engineering team's Glue ETL job, running on G.1X workers, consistently fails with out-of-memory errors during a large join between two clinical datasets. The data does not appear to be significantly skewed.

A. Increase the number of G.1X workers.
B. Switch the job to a larger worker type, such as G.2X.
C. Enable job bookmarks on the job.
D. Switch the job's execution class to Flex.

---

**Q19.** *(Choose TWO)* A retail analytics team runs two Redshift workloads: a marketing team that queries the warehouse in unpredictable bursts, sometimes idle for days, and a finance team with a steady, predictable 24/7 workload. The team wants the most cost-appropriate configuration for each.

A. Use Redshift Serverless for the marketing team's unpredictable, bursty workload.
B. Use Redshift Serverless for the finance team's steady 24/7 workload.
C. Use a provisioned Redshift cluster with Reserved Instances for the finance team's steady workload.
D. Use a provisioned Redshift cluster with On-Demand pricing for the marketing team's bursty workload.
E. Use Redshift Spectrum instead of Redshift for both teams.

---

**Q20.** A logistics company needs to process a daily 40 GB file of delivery-route data, involving joins and aggregations that take roughly 25 minutes locally. The team initially proposed AWS Lambda for its serverless simplicity.

A. Use AWS Lambda with maximum memory and timeout settings.
B. Use AWS Glue ETL (or EMR Serverless), sized appropriately for the job.
C. Split the file into many small chunks, process each with a separate Lambda invocation, and merge results with another Lambda.
D. Increase Lambda's reserved concurrency.

---

**Q21.** A healthcare company has dozens of S3 buckets accumulated over several years from various teams and needs to identify which buckets and objects contain unprotected personally identifiable health information before applying stricter controls, without manually inspecting each object.

A. Use AWS Config rules to flag non-compliant bucket configurations.
B. Use Amazon Macie to scan the buckets and identify sensitive data.
C. Use Glue Data Quality to run rules checking for PII patterns.
D. Use Amazon Kendra to search the objects for sensitive terms.

---

**Q22.** A bank's risk-reporting data lake table needs to (1) be queryable exactly as it existed at the close of business on a specific prior date, for regulatory reconciliation, and (2) support adding a new column without rewriting existing data files.

A. Convert the table to a standard Hive-style partitioned Parquet table.
B. Convert the table to an Apache Iceberg table and use its snapshot/time-travel and schema evolution features.
C. Take manual daily S3 snapshots of the entire table using S3 Batch Operations.
D. Use DynamoDB point-in-time recovery on an exported copy of the table.

---

**Q23.** A manufacturing company streams sensor readings from production-line equipment and needs a continuously updated 5-minute rolling average of vibration readings per machine, in real time, feeding an anomaly-detection dashboard.

A. Amazon Data Firehose with a Lambda transformation.
B. An AWS Glue Streaming job with a fixed micro-batch interval.
C. Amazon Managed Service for Apache Flink with a sliding window.
D. Scheduled Athena queries run every 5 minutes against data landed in S3.

---

**Q24.** A retail chain's regional managers each need to see dashboards showing only their own region's sales data, sourced from Redshift, with fast interactive performance for a large number of concurrent viewers, without hitting the warehouse on every interaction.

A. Grant each manager a separate Redshift database user with row-level security views.
B. Use Amazon QuickSight with SPICE for in-memory performance and row-level security to restrict each manager to their region.
C. Use Amazon QuickSight in direct query mode against Redshift, with IAM policies restricting access.
D. Export data per region to separate S3 files and build a separate dashboard for each region.

---

**Q25.** An insurance company's business analysts, who do not write code, need to explore and clean a new claims dataset — handling missing values and standardizing formats — before handing it to data engineers for pipeline integration.

A. AWS Glue Studio's visual job editor.
B. AWS Glue DataBrew.
C. Amazon Athena with SQL transformation queries.
D. AWS Lambda with a Python data-cleaning script.

---

**Q26.** A telecom company processes around 15 million short-lived (a few seconds each) billing-validation workflow executions per day and needs the most cost-effective serverless orchestration for this volume.

A. AWS Step Functions Standard workflows.
B. AWS Step Functions Express workflows.
C. Amazon MWAA with a DAG scheduled to run continuously.
D. AWS Glue Workflows.

---

**Q27.** *(Choose TWO)* A bank needs to share objects in an S3 bucket, already encrypted with a customer-managed KMS key, with a trusted partner organization's AWS account for a joint analytics project.

A. Update the S3 bucket policy (or object ACL) to allow the partner account's principal `s3:GetObject`.
B. Update the customer-managed KMS key policy to allow the partner account's principal `kms:Decrypt`.
C. Ask the partner to assume an IAM role in their own account with `s3:*` permissions.
D. Make the S3 bucket public and rely on the KMS key policy alone.
E. Switch the encryption to SSE-S3 to simplify cross-account access.

---

**Q28.** A government agency's data engineers need to quickly find all error-level log entries containing a specific request ID across a Lambda function's CloudWatch Logs from the past 24 hours, using a SQL-like query syntax, without exporting logs to another tool.

A. Amazon Athena with a Lambda-based federated query connector for CloudWatch Logs.
B. CloudWatch Logs Insights.
C. AWS X-Ray.
D. Export the logs to S3 and query them with Athena.

---

**Q29.** A media streaming company maintains a large Apache Iceberg-based data lake in S3 that ingests viewing events continuously. The team spends significant engineering effort manually scheduling compaction, snapshot expiration, and unreferenced-file cleanup jobs, and wants AWS to manage this table maintenance automatically with the least operational overhead.

A. Continue using standard S3 buckets with Iceberg tables, and schedule a Glue job to run compaction and cleanup nightly.
B. Migrate the tables to Amazon S3 Tables, which provides Iceberg-native table storage with automatic compaction, snapshot management, and cleanup.
C. Move the tables to Amazon Redshift managed storage instead of S3.
D. Use Amazon EMR with a cron-scheduled Spark job to run `OPTIMIZE` on the tables weekly.

---

**Q30.** A bank's data engineering team currently runs about 60 complex Apache Airflow DAGs, with custom Python operators and third-party provider packages, on a self-managed EC2 cluster. They want to move to a managed AWS service while keeping their existing DAGs and Python dependencies largely unchanged.

A. Rewrite the DAGs as AWS Step Functions state machines.
B. Amazon Managed Workflows for Apache Airflow (MWAA).
C. AWS Glue Workflows.
D. Amazon EventBridge Scheduler with individual Lambda functions per task.

---

**Q31.** A gaming company wants to run periodic analytics over its DynamoDB player-inventory table in Athena, without consuming the table's provisioned read capacity or risking throttling the live game backend.

A. Run a scheduled `Scan` operation and write results to S3.
B. Use DynamoDB's export-to-S3 feature, then query the exported data with Athena.
C. Increase the table's read capacity units to accommodate both the game and the analytics `Scan`.
D. Enable DynamoDB Streams and manually replay all items into S3.

---

**Q32.** An insurance company's Glue jobs run inside a VPC with no internet gateway and no NAT gateway, and need private access to S3 at no additional hourly or data-processing cost.

A. Create an interface VPC endpoint (AWS PrivateLink) for S3.
B. Create a gateway VPC endpoint for S3.
C. Configure a NAT gateway for outbound access to S3.
D. Attach an internet gateway to the VPC and use a public S3 endpoint with a restrictive security group.

---

**Q33.** An e-commerce company needs a single "order placed" event to trigger five different downstream systems (inventory, shipping, fraud check, loyalty points, and email), each of which should receive the event only if it matches specific attribute conditions, such as order value or region.

A. Publish to an SNS topic with all five systems subscribed as SQS queues.
B. Publish the event to Amazon EventBridge with rules that route based on event content to each target.
C. Publish the event to an SQS Standard queue and have each of the five systems poll and filter it themselves.
D. Write a Lambda function that receives the event and calls each of the five downstream systems directly with conditional logic.

---

**Q34.** *(Choose TWO)* During month-end close, a bank's Redshift cluster experiences a predictable spike in concurrent analyst queries, and `WLMQueueLength` and `WLMQueueWaitTime` climb sharply during this brief period each month. The rest of the month, load is normal.

A. Permanently resize the cluster to handle month-end peak capacity.
B. Enable concurrency scaling to add transient capacity automatically during the spike.
C. Configure automatic WLM, or appropriately tuned query queues, to better manage concurrent query slots.
D. Disable short query acceleration to free up queue slots.
E. Move all analysts to Athena permanently instead of Redshift.

---

**Q35.** A telecom company already operates a Redshift provisioned cluster for its billing warehouse tables. Analysts now need to join those warehouse tables with 4 years of historical call-detail records stored as Parquet in S3, without loading the historical data into the cluster.

A. Use Amazon Athena to query the S3 data, then manually merge results with exports from Redshift.
B. Use Redshift Spectrum to create an external schema over the S3 data and join it directly with warehouse tables.
C. Load all 4 years of historical data into the Redshift cluster using `COPY`.
D. Set up an Athena Federated Query connector to Redshift.

---

**Q36.** A financial services firm wants to enrich its internal risk models with a third-party market-data provider's dataset, licensed and updated regularly by the provider, delivered directly into the firm's S3 bucket or Redshift cluster, without building and maintaining custom ingestion code against the provider's API.

A. Build a Lambda function that polls the provider's REST API on a schedule and writes results to S3.
B. Subscribe to the dataset on AWS Data Exchange and configure it to land directly in S3 or Redshift.
C. Use AWS AppFlow to connect to the provider as a generic SaaS source.
D. Use AWS DMS to replicate directly from the provider's internal database.

---

**Q37.** A government agency's data engineer has an IAM identity-based policy granting full access to a Redshift cluster, but an AWS Organizations service control policy (SCP) attached to the account explicitly denies the `redshift:*` action for that OU. The engineer cannot access the cluster.

A. The identity-based policy should take precedence, because it directly grants access.
B. Access is denied because the SCP's explicit deny overrides the identity-based policy's allow.
C. Adding an explicit allow in a permissions boundary would override the SCP.
D. The resource-based policy on the Redshift cluster determines the outcome, not the SCP.

---

**Q38.** A telecom company's operations team needs to run full-text search and near-real-time log analytics dashboards, similar to Kibana, over terabytes of application logs, with fast aggregations and visualizations.

A. Amazon OpenSearch Service.
B. Amazon Kendra.
C. Amazon Athena with a scheduled dashboard refresh.
D. Amazon Redshift with materialized views over log data.

---

**Q39.** An e-commerce company's order-processing pipeline spans API Gateway, several Lambda functions, and Step Functions. Customers report occasional slow order confirmations, and the team needs to identify exactly which component in the chain is introducing latency.

A. CloudWatch Logs Insights across each service's log group.
B. AWS X-Ray, to trace requests end-to-end across the services.
C. AWS CloudTrail, to review API call history.
D. Amazon CloudWatch composite alarms.

---

**Q40.** A manufacturing company already runs a self-managed Apache Kafka cluster on EC2 for its factory event bus, using several open-source Kafka Connect connectors. The team wants to migrate to a managed AWS service without rewriting producers, consumers, or the Kafka Connect connectors.

A. Amazon Kinesis Data Streams.
B. Amazon MSK, using MSK Connect for the existing Kafka Connect connectors.
C. Amazon Data Firehose.
D. Amazon Managed Service for Apache Flink.

---

**Q41.** *(Choose TWO)* A retail company loads a 600 GB daily extract into Redshift using `COPY`, but the load currently comes from a single large gzipped file and takes several hours, even though the cluster has many slices.

A. Split the input into multiple files, ideally a multiple of the number of slices.
B. Compress each split file and keep each file in the 1 MB–1 GB range.
C. Load the data using individual `INSERT` statements instead of `COPY` for finer control.
D. Increase the cluster's sort key count to speed up the load.
E. Disable compression on the files to reduce CPU overhead during load.

---

**Q42.** A healthcare analytics team runs existing Apache Spark jobs and wants to keep using Spark without provisioning, patching, or managing EC2 clusters, while paying only for compute while jobs are actually running.

A. Amazon EMR on EC2 with managed scaling enabled.
B. Amazon EMR Serverless.
C. AWS Glue ETL, rewriting the Spark jobs to use DynamicFrames.
D. AWS Lambda, with the Spark jobs refactored into smaller functions.

---

**Q43.** An insurance company's data lake has grown to thousands of tables across dozens of databases. Managing individual Lake Formation grants per table for each new analyst has become unmanageable, and the team wants to control access based on data-sensitivity classifications that apply consistently across many tables at once.

A. Continue granting Lake Formation permissions table-by-table, but automate the process with a script.
B. Use Lake Formation LF-Tags (tag-based access control) to tag resources by sensitivity and grant permissions on tags.
C. Create a separate IAM policy per analyst listing every table they may access.
D. Move all tables into a single database and grant database-level access to everyone.

---

**Q44.** A retail company's data quality analyst wants to explore a newly onboarded supplier's product-catalog dataset — understanding value distributions, detecting outliers, and spotting data-type inconsistencies — without writing any code, before deciding what validation rules to build into the production pipeline.

A. AWS Glue Data Quality with a DQDL ruleset.
B. AWS Glue DataBrew's data profiling feature.
C. Amazon Athena with manual `SELECT DISTINCT` and aggregate queries.
D. Amazon Macie.

---

**Q45.** A government data platform team gives many analysts self-service access to Athena, but an intern's poorly written query recently scanned petabytes of data in a single run, generating an unexpectedly large bill. The team wants to prevent this from happening again without removing self-service access.

A. Revoke Athena access for all analysts except senior staff.
B. Configure an Athena workgroup with a per-query data usage control (data scanned limit).
C. Convert all underlying tables to CSV to make queries fail faster.
D. Ask analysts to review their queries with a peer before running them.

---

**Q46.** A logistics company receives a batch file of delivery confirmations once per day from a partner system and needs to transform and load it into the data lake. A junior engineer proposes a Glue Streaming job to "future-proof" the pipeline. The team wants the lowest-cost solution for this workload.

A. An AWS Glue Streaming job continuously polling for the file.
B. A scheduled AWS Glue batch job (optionally using the Flex execution class) triggered when the file lands.
C. Amazon Managed Service for Apache Flink watching for the file.
D. Amazon MSK with a daily-produced topic.

---

**Q47.** A gaming company's live leaderboard reads the same "top players" DynamoDB items extremely frequently during peak play hours, and the team wants to reduce read latency to microseconds and offload repeated reads from the table, without changing application read logic significantly.

A. Increase the table's provisioned read capacity units.
B. Add Amazon DynamoDB Accelerator (DAX) as a caching layer in front of the table.
C. Migrate the leaderboard data to Amazon ElastiCache and manage cache invalidation manually against DynamoDB.
D. Switch the table to on-demand capacity mode.

---

**Q48.** A bank's security team must guarantee that no IAM principal in any account under a specific Organizational Unit can ever disable CloudTrail logging or delete CloudTrail logs, regardless of what permissions are granted to individual roles within those accounts.

A. Add an IAM policy to every role denying `cloudtrail:StopLogging` and `cloudtrail:DeleteTrail`.
B. Attach a Service Control Policy (SCP) at the OU level explicitly denying `cloudtrail:StopLogging` and `cloudtrail:DeleteTrail`.
C. Enable AWS Config to detect if CloudTrail is disabled and alert the security team.
D. Grant CloudTrail administration only to a single "break-glass" IAM user.

---

**Q49.** A bank's payment-event pipeline retries failed downstream writes automatically. The team has noticed that some payment records are being written twice to the target data store after transient failures and retries.

A. Reduce the number of automatic retries to lower the chance of duplicates.
B. Make the write operation idempotent, for example using a deterministic dedup key or a conditional write.
C. Switch to Amazon Data Firehose, which guarantees exactly-once delivery.
D. Disable retries entirely so each event is processed exactly once.

---

**Q50.** *(Choose TWO)* A manufacturing IoT pipeline uses a device ID as the Kinesis Data Streams partition key. Monitoring shows `WriteProvisionedThroughputExceeded` errors concentrated on a small number of shards, while most shards are lightly loaded, because a handful of devices produce far more events than the rest.

A. Split the hot shards to increase capacity for the affected key ranges.
B. Add a random suffix or additional entropy to the partition key for high-volume devices to spread their events across more shards.
C. Increase the stream's retention period to 365 days.
D. Switch all consumers to enhanced fan-out.
E. Move the stream to on-demand capacity mode, which automatically rebalances hot keys.

---

**Q51.** A government records-retention program must archive documents for 10 years at the lowest possible storage cost. However, records requests under public disclosure law must sometimes be fulfilled within same-day turnaround.

A. S3 Glacier Deep Archive for all records.
B. S3 Glacier Flexible Retrieval, using expedited retrieval when a same-day request arrives.
C. S3 Standard-IA for all 10 years.
D. S3 Intelligent-Tiering.

---

**Q52.** An insurance company ingests claims files from dozens of external partners, each with slightly different and inconsistent schemas — some fields present, some missing, some with mismatched types — that change over time. The Glue ETL job needs to handle this schema variability gracefully.

A. Load the data directly as a Spark DataFrame with a fixed, predefined schema.
B. Load the data as a Glue DynamicFrame and use `resolveChoice` to handle schema inconsistencies.
C. Reject any file that doesn't exactly match the expected schema.
D. Convert all files to a single flattened CSV format before processing to force schema alignment.

---

**Q53.** A bank must retain certain transaction records in S3 for 7 years such that they cannot be deleted or overwritten by any user, including the account root user or administrators, to satisfy a regulatory write-once-read-many (WORM) requirement.

A. Enable S3 versioning and rely on IAM policies to prevent deletion.
B. Enable S3 Object Lock in compliance mode with a 7-year retention period.
C. Enable S3 Object Lock in governance mode with a 7-year retention period.
D. Use MFA Delete on the bucket.

---

**Q54.** A retail company's Redshift cluster runs smoothly most of the day, but every day at 9 AM, when store managers across the country log in and run reports simultaneously, queries begin queuing and `WLMQueueWaitTime` spikes for about 30 minutes before returning to normal.

A. Permanently resize the cluster to handle the 9 AM peak.
B. Enable concurrency scaling to add transient additional cluster capacity automatically during the spike.
C. Ask store managers to stagger their login times manually.
D. Migrate all reporting to Amazon Athena to avoid Redshift's concurrency limits entirely.

---

**Q55.** A healthcare data team wants to be notified via email/SMS immediately whenever any of their nightly Glue ETL jobs fails, without polling job status manually or building custom monitoring code.

A. Write a Lambda function that polls the Glue API every minute to check job status.
B. Create an Amazon EventBridge rule matching Glue job state-change events for "FAILED," targeting an SNS topic subscribed by email/SMS.
C. Enable CloudWatch detailed monitoring on the Glue job.
D. Configure AWS Config to evaluate Glue job compliance.

---

**Q56.** A manufacturing company needs to move 400 TB of historical sensor archives from an on-premises data center with limited, unreliable internet bandwidth into S3, as a one-time migration.

A. Use AWS DataSync over the existing internet connection.
B. Use an AWS Snowball Edge device shipped to the data center, then returned to AWS for import into S3.
C. Use AWS Transfer Family with SFTP over the internet connection.
D. Compress the data and upload it via the S3 console over several weeks.

---

**Q57.** A telecom company's DynamoDB table storing call records has been running in production for six months. The team now wants to add a new access pattern that queries a customer's calls by `call_type`, with strong read consistency, using the same partition key as the base table.

A. Add a Local Secondary Index to the existing table for `call_type`.
B. Add a Global Secondary Index for `call_type`.
C. Recreate the table with the desired Local Secondary Index defined at creation time, and migrate the data.
D. Use DynamoDB Streams to build a materialized secondary table, queried instead of an index.

---

**Q58.** *(Choose TWO)* A media company needs to process 50,000 video-metadata files already sitting in an S3 bucket, running the same transformation Lambda function against each file, with built-in retry handling per file, and the ability to run many files in parallel without writing custom parallelization code.

A. Use AWS Step Functions with a Distributed Map state iterating over the S3 objects.
B. Configure per-item retry and error handling using the Distributed Map state's built-in Catch/Retry configuration.
C. Write a single Lambda function that lists all 50,000 objects and loops through them sequentially in one invocation.
D. Use an EventBridge rule to invoke a separate Lambda for every object as it's created.
E. Use Step Functions Express workflows for the entire batch, without Distributed Map, to reduce cost.

---

**Q59.** A government contractor handling classified-adjacent data must satisfy a compliance mandate requiring data to be encrypted with two independent layers of encryption at rest in S3, not just one.

A. SSE-S3.
B. SSE-KMS with a customer-managed key.
C. Dual-layer server-side encryption with KMS keys (DSSE-KMS).
D. Client-side encryption only, with no server-side encryption enabled.

---

**Q60.** An insurance company's claims-processing Step Functions workflow calls a third-party fraud-scoring API that occasionally times out due to transient network issues. The team wants the workflow to automatically retry the failing step with exponential backoff, and only escalate to a human-review path after repeated failures, without failing the entire workflow immediately.

A. Wrap the entire state machine in a single try/except block in the invoking Lambda function.
B. Configure a `Retry` field with exponential backoff on the fraud-scoring task state, combined with a `Catch` field routing to a human-review state after retries are exhausted.
C. Set the Step Functions workflow type to Express to reduce timeout sensitivity.
D. Have the fraud-scoring Lambda function itself loop and retry internally before returning.

---

**Q61.** An insurance company wants employees to ask natural-language questions — for example, "What is the maximum claim payout for water damage in California?" — against a large collection of internal PDF policy documents, underwriting guidelines, and claims manuals, and receive direct answers or highlighted passages, not just a list of matching documents.

A. Amazon OpenSearch Service with a custom full-text index.
B. Amazon Kendra.
C. Amazon Athena with full-text search extensions over the documents converted to text.
D. Amazon Macie.

---

**Q62.** A telecom company's data engineering team wants an AI coding assistant integrated into their IDE that can generate and explain AWS Glue PySpark code, suggest fixes for errors, and answer questions about AWS service usage directly while they write pipeline code.

A. Amazon Q Developer.
B. Amazon Q in QuickSight.
C. Amazon Kendra.
D. Amazon CodeGuru Reviewer.

---

**Q63.** An insurance holding company has two AWS accounts, one per subsidiary, sharing a common data lake catalog owned by a central data platform account. Each subsidiary should only see rows in the shared claims table belonging to their own subsidiary, and the sharing must not require copying the data into each account.

A. Copy filtered subsets of the table into each subsidiary's own S3 bucket and account nightly.
B. Use Lake Formation cross-account sharing (via AWS RAM) with a named row-level data filter granted to each subsidiary account.
C. Grant each subsidiary account's IAM role direct `s3:GetObject` access to the underlying S3 bucket.
D. Create a VPC peering connection between the accounts and query the table directly.

---

**Q64.** *(Choose TWO)* A gaming company's DynamoDB table uses `player_id` as the partition key, but a small number of extremely popular streamers' player IDs receive a disproportionate share of reads and writes compared to millions of other players, causing `ThrottledRequests` to spike specifically for those items, while the table's overall consumed capacity looks unremarkable.

A. Add a randomized or calculated suffix to the partition key for high-traffic items to spread their data across more physical partitions.
B. Cache the hot items using DynamoDB Accelerator (DAX) to absorb repeated reads without hitting the table directly.
C. Switch the entire table's billing mode from on-demand to provisioned capacity.
D. Increase the table's global secondary index count.
E. Enable DynamoDB point-in-time recovery.

---

**Q65.** A retail company is designing a new S3-based data lake table that will receive frequent streaming upserts from a CDC pipeline, must support ACID transactions, time travel, and schema evolution, and needs first-class, broad support across Athena, Glue, EMR, and Redshift, without adopting a Databricks-centric toolchain.

A. Apache Hudi.
B. Delta Lake.
C. Apache Iceberg.
D. A plain Hive-style partitioned Parquet table.

---

## Answer-recording grid

Record your final answer for every question before checking `Answer-Key.md`.

| Q | Answer | Q | Answer | Q | Answer | Q | Answer | Q | Answer |
|---|---|---|---|---|---|---|---|---|---|
| 1 | | 14 | | 27 | | 40 | | 53 | |
| 2 | | 15 | | 28 | | 41 | | 54 | |
| 3 | | 16 | | 29 | | 42 | | 55 | |
| 4 | | 17 | | 30 | | 43 | | 56 | |
| 5 | | 18 | | 31 | | 44 | | 57 | |
| 6 | | 19 | | 32 | | 45 | | 58 | |
| 7 | | 20 | | 33 | | 46 | | 59 | |
| 8 | | 21 | | 34 | | 47 | | 60 | |
| 9 | | 22 | | 35 | | 48 | | 61 | |
| 10 | | 23 | | 36 | | 49 | | 62 | |
| 11 | | 24 | | 37 | | 50 | | 63 | |
| 12 | | 25 | | 38 | | 51 | | 64 | |
| 13 | | 26 | | 39 | | 52 | | 65 | |

**Score:** _____ / 65 correct → scaled estimate: see `Answer-Key.md` for the conversion guide.
