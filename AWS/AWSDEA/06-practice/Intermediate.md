# Intermediate Practice — DEA-C01 (30 questions)

> **Level:** real scenario-based questions, one step up from `Beginner.md`.
> Each stem describes a company and a situation with **one clear
> constraint** that decides the answer — not the multi-constraint,
> competing-requirements reasoning of `Advanced.md`.
>
> **Domain split:** Domain 1 — 10 · Domain 2 — 8 · Domain 3 — 7 ·
> Domain 4 — 5.
>
> Part 1 is questions only. Part 2 is the answer key with every option
> explained. Answer all 30 before checking Part 2.

---

## Part 1 — Questions

**Q1.** A wearable-device company ingests 12,000 heart-rate readings per second, average record size 900 bytes, from a fleet that grows unpredictably month to month. The team does not want to calculate or manage shard counts as the fleet scales.

A. Provision a Kinesis Data Streams stream with 11 shards.
B. Provision a Kinesis Data Streams stream with 12 shards and enable auto-scaling via a Lambda-based scaling utility.
C. Create the stream in on-demand capacity mode.
D. Use Amazon Data Firehose instead, since it removes shard management entirely.

---

**Q2.** A parking-payments startup needs clickstream-style transaction events to be queryable in S3 within about 90 seconds of being generated, partitioned by `garage_id`. There is exactly one downstream consumer and no requirement to replay historical events.

A. Kinesis Data Streams with a Lambda consumer writing to S3 every 90 seconds.
B. Amazon Data Firehose with dynamic partitioning on `garage_id`.
C. An EMR Serverless streaming job checkpointing every 90 seconds.
D. Amazon MSK with a Kafka Connect S3 sink connector.

---

**Q3.** A retailer needs to migrate its on-premises MySQL product catalog into RDS for MySQL as a one-time cutover. The source database can be taken offline for a short maintenance window during the migration.

A. AWS DMS with a full-load-only task.
B. AWS DMS with full load + CDC, then a cutover.
C. AWS Glue Studio's visual ETL job to extract and load the tables.
D. AWS Transfer Family to move a database export file.

---

**Q4.** A logistics company's operational data lives in DynamoDB and needs to power near-real-time full-text search and log-style analytics in OpenSearch Service, without the team writing or maintaining custom synchronization code.

A. Set up a DynamoDB Stream with a custom Lambda function writing to OpenSearch.
B. Configure a zero-ETL integration from DynamoDB to Amazon OpenSearch Service.
C. Export DynamoDB to S3 nightly and bulk-load OpenSearch from the export.
D. Use AWS DMS to replicate DynamoDB to OpenSearch.

---

**Q5.** A subscription-box company's nightly Glue ETL job uses job bookmarks. This week, the upstream vendor resent three days of files with corrected data using the same file names as before. The job's bookmark state means it will skip those files as "already processed," but the team needs the corrected versions reprocessed.

A. Delete and recreate the Glue job.
B. Reset the job bookmark and rerun the job against just the affected date range.
C. Rename the corrected files so bookmarks treat them as new.
D. Disable job bookmarks permanently going forward.

---

**Q6.** An online marketplace's "listing published" event must notify a search-indexing service, a moderation service, and an email service — but the moderation service should only receive events for listings in restricted categories, based on a category attribute in the event payload.

A. Publish to an SNS topic with all three services subscribed, using SNS message filtering only for the moderation subscription.
B. Publish to Amazon EventBridge with a content-filtering rule that routes to the moderation target only when the category attribute matches.
C. Publish to an SQS Standard queue and have each service poll and discard events it doesn't need.
D. Invoke a Lambda function that directly calls all three services with an if/else branch.

---

**Q7.** A payments company's platform team wants an AI assistant built directly into their developers' IDE that can generate AWS Glue PySpark boilerplate, explain unfamiliar error messages, and suggest security fixes as engineers write pipeline code — without switching to a separate chat interface.

A. Amazon Q in QuickSight.
B. Amazon Q Developer.
C. Amazon Kendra integrated with the internal wiki.
D. AWS CodeGuru Reviewer.

---

**Q8.** A hospital network needs to keep a growing set of on-premises NAS-hosted radiology-report files continuously and automatically synchronized into an S3 bucket as new files are added, on an ongoing basis (not a one-time cutover).

A. AWS Snowball Edge, scheduled monthly.
B. AWS DataSync, configured with a recurring sync schedule.
C. AWS Transfer Family with a scheduled batch job.
D. Manual `aws s3 sync` runs from an administrator's laptop.

---

**Q9.** An agricultural-sensor company receives soil-moisture readings from hundreds of hardware vendors, each sending payloads with different field names, some fields sometimes missing, and inconsistent data types for the same logical field. The Glue ETL job needs to load this without failing on every schema mismatch.

A. Load the data using a fixed-schema Spark DataFrame.
B. Load the data as a Glue DynamicFrame and use `resolveChoice` to reconcile the type/schema inconsistencies.
C. Require every vendor to conform to one exact schema before ingestion is allowed.
D. Convert every vendor's payload to a single wide CSV file before the job runs.

---

**Q10.** A university's research-data platform ingests instrument readings via Kinesis Data Streams. A new requirement asks for continuous per-instrument 10-minute rolling averages and standard deviation, updated in real time as new readings arrive, feeding a live monitoring dashboard.

A. Amazon Data Firehose with a Lambda transformation computing the average.
B. A scheduled Athena query run every 10 minutes.
C. Amazon Managed Service for Apache Flink with a sliding window aggregation.
D. An AWS Glue batch job scheduled hourly.

---

**Q11.** A regional airline's data team has a few dozen internal analysts who run occasional, unpredictable ad-hoc queries against Parquet files in S3, sometimes going a full week without running any query at all. They want to avoid paying for idle compute.

A. A small provisioned Redshift cluster running continuously.
B. Amazon Athena.
C. Amazon EMR with a persistent cluster.
D. Redshift Serverless with a minimum base capacity always running.

---

**Q12.** A telehealth company's DynamoDB `appointments` table is keyed by `appointment_id`. A new feature needs to look up all appointments for a given `doctor_id`, a pattern that was not anticipated when the table was designed two years ago, and eventual consistency for this lookup is acceptable.

A. Add a Local Secondary Index on `doctor_id`.
B. Add a Global Secondary Index on `doctor_id`.
C. Recreate the table with `doctor_id` as part of the primary key.
D. Use a `Scan` with a filter expression on `doctor_id`.

---

**Q13.** A photo-sharing app stores user-uploaded images in S3. Access data shows images are viewed heavily for about 14 days after upload, then access drops close to zero, though a small number of images are unpredictably viewed again months later when they go viral. The team doesn't want to build a custom lifecycle rule for a pattern they aren't fully sure about.

A. A lifecycle policy transitioning to S3 Glacier Deep Archive after 14 days.
B. S3 Intelligent-Tiering.
C. A lifecycle policy transitioning to S3 Standard-IA after 14 days.
D. Leave all images in S3 Standard indefinitely.

---

**Q14.** A ride-hailing company's Redshift `trips` fact table uses `DISTKEY` on `payment_method`, which has only 4 distinct values. Query performance has degraded, with a small number of slices doing most of the join work against a `drivers` dimension table.

A. Add more nodes to the cluster to spread the load.
B. Change the `trips` table's distribution key to `driver_id` (high cardinality) or set `DISTSTYLE AUTO`.
C. Add a sort key on `payment_method` to speed up the join.
D. Change the `drivers` table's distribution style to `KEY` on `driver_id`.

---

**Q15.** A law firm's document-retention data lake table must let compliance officers query the exact state of the table as it existed on the last day of the previous fiscal quarter, for a specific audit.

A. Restore the entire S3 bucket from a point-in-time backup.
B. Query the table using Apache Iceberg's snapshot/time-travel feature for that date.
C. Ask the team to have kept a manual copy of the data from that date.
D. Use S3 versioning to find the object versions from that date.

---

**Q16.** A freight company already operates a provisioned Redshift cluster for its core shipment-billing tables and now needs analysts to join those tables against 3 years of archived shipment-event Parquet files sitting in S3, without loading the archive into the cluster.

A. Load the 3 years of Parquet files into Redshift using `COPY`.
B. Use Redshift Spectrum to create an external schema over the S3 archive and join it to warehouse tables.
C. Query the archive with Athena and manually merge the results with a Redshift export.
D. Use a zero-ETL integration to bring the S3 archive into Redshift.

---

**Q17.** A mobile game's live tournament leaderboard reads the same handful of "top 100" DynamoDB items an extremely high number of times per second during finals, and the team wants those reads served in microseconds without significant application changes.

A. Switch the table to on-demand capacity mode.
B. Add Amazon DynamoDB Accelerator (DAX) in front of the table.
C. Increase provisioned read capacity units substantially.
D. Add a Global Secondary Index to spread the read load.

---

**Q18.** A parcel-tracking company's Athena table is partitioned by carrier, year, month, and day, with a fully predictable partition scheme going back 8 years across dozens of carriers — tens of millions of partitions. An hourly Glue crawler updates the catalog, and both crawler cost and query planning latency have become significant.

A. Reduce the crawler schedule to run weekly instead of hourly.
B. Configure Athena partition projection using the known, predictable partitioning pattern.
C. Convert the table to a single unpartitioned table to remove partition overhead.
D. Move the table into DynamoDB instead of Athena.

---

**Q19.** A podcast platform's Kinesis Data Streams-based Lambda consumer processes listen events, and the team notices `GetRecords.IteratorAgeMilliseconds` is steadily rising while `WriteProvisionedThroughputExceeded` remains at zero.

A. The shard count is too low for the producers; add more shards for write capacity.
B. The consumer is falling behind; increase the Lambda parallelization factor or scale out consumers.
C. The stream's retention period is too short and needs to be increased.
D. Switch the stream to Amazon Data Firehose to eliminate the need for a consumer.

---

**Q20.** A public-sector analytics team gives dozens of analysts self-service Athena access. Last month, a single misconfigured query scanned several petabytes in one run and produced an unusually large bill, and the team wants to cap the damage any single query can do without removing self-service access.

A. Remove Athena access from all analysts except two senior staff.
B. Configure a per-query data usage control (bytes-scanned limit) on the Athena workgroup.
C. Convert every table to uncompressed CSV so scans fail faster.
D. Require every analyst to email a query for manual approval before running it.

---

**Q21.** An insurance claims workflow built in Step Functions calls a third-party document-OCR API that occasionally throws a transient 503 error. The team wants the specific OCR step to automatically retry a few times with exponential backoff before the workflow gives up, without adding retry logic inside the Lambda function that calls the API.

A. Wrap the Lambda's API call in a manual `try`/`except` retry loop inside the function code.
B. Configure a `Retry` field with a backoff rate on the OCR task state in the state machine definition.
C. Reduce the Step Functions workflow's overall timeout so it fails faster.
D. Switch the workflow to Express type, which retries automatically by default.

---

**Q22.** A city government's traffic-sensor API experiences an intermittent slowdown that customers occasionally notice, but the team cannot tell whether the delay originates in API Gateway, the Lambda function, or a downstream DynamoDB call.

A. Search CloudWatch Logs manually across each component's log group.
B. Enable AWS X-Ray tracing across the request path to see per-segment latency.
C. Review AWS CloudTrail for API call history around the reported times.
D. Set a CloudWatch composite alarm on overall error rate.

---

**Q23.** A used-car marketplace's nightly Glue job promotes listing data to a curated zone, and the team wants an automated, no-code check that `vin` values are always exactly 17 characters and never null before promotion proceeds, halting the job if violated.

A. Write a custom PySpark `assert` statement for the check.
B. Attach an AWS Glue Data Quality ruleset (DQDL) with the relevant rules, configured to fail the job on violation.
C. Use Amazon Macie to flag invalid VINs.
D. Manually review a sample of records after each run.

---

**Q24.** A franchise restaurant chain wants each franchise owner to see a QuickSight dashboard sourced from Redshift showing only their own location's sales, with fast performance for hundreds of concurrent owners checking the dashboard at open and close each day, without hitting Redshift on every view.

A. Give each owner a separate Redshift database user with a row-filtering view.
B. Use QuickSight with SPICE and row-level security scoped to each owner's location.
C. Export each location's data to a separate CSV and email it daily.
D. Use QuickSight in direct query mode against Redshift for all owners.

---

**Q25.** A subscription-analytics company's Redshift cluster runs fine most of the month, but on the first business day of each month, when finance closes the books, concurrent report queries spike sharply and `WLMQueueWaitTime` rises for about an hour before returning to normal.

A. Permanently resize the cluster to handle the monthly peak.
B. Enable concurrency scaling to add transient capacity automatically during the spike.
C. Ask the finance team to spread their reports across the whole week.
D. Move all finance reporting to DynamoDB to avoid the concurrency limit.

---

**Q26.** A Glue ETL job that reads SSE-KMS-encrypted objects from an S3 bucket fails with `AccessDenied`, even though the job's IAM role has `s3:GetObject` granted via both an identity policy and the bucket policy.

A. Grant the role `s3:*` to rule out a missing S3 permission.
B. Add a statement to the KMS key's key policy granting the job's IAM role `kms:Decrypt`.
C. Turn off encryption on the source bucket.
D. Move the data to an unencrypted bucket temporarily.

---

**Q27.** A university's shared research data lake has one Glue Data Catalog database used by multiple departments. The Economics department must see all columns of the `survey_responses` table except `respondent_income`, while other departments should see none of that table at all.

A. Create separate IAM policies per department listing exact table names.
B. Use Lake Formation to grant the Economics department a column-level data filter excluding `respondent_income`, and grant no access to other departments.
C. Physically split the table into two S3 locations, one per department.
D. Encrypt the `respondent_income` column with a department-specific KMS key.

---

**Q28.** A fintech startup stores database credentials for its Aurora PostgreSQL cluster and wants them automatically rotated on a schedule without any custom rotation code, using native AWS integration.

A. Store the credentials in SSM Parameter Store as SecureString parameters.
B. Store the credentials in AWS Secrets Manager with automatic rotation enabled.
C. Hardcode the credentials in an encrypted config file in S3.
D. Store the credentials in a DynamoDB table with client-side encryption.

---

**Q29.** A multinational bank's security team has an SCP attached at the OU level that explicitly denies `s3:DeleteBucket` across every account in that OU. A data engineer's IAM role in one of those accounts has an identity-based policy explicitly allowing `s3:DeleteBucket` with a wildcard resource.

A. The engineer can delete the bucket, because identity-based allows take precedence over SCPs.
B. The engineer cannot delete the bucket; the SCP's explicit deny overrides the IAM allow.
C. The outcome depends on which was created first, the SCP or the IAM policy.
D. The engineer can delete the bucket only if they use the root user.

---

**Q30.** A pharmaceutical company must retain clinical-trial result files in S3 for 6 years in a way that guarantees no one — including account administrators — can delete or modify them before the retention period expires, to satisfy a regulatory requirement.

A. S3 versioning combined with an IAM policy denying delete actions.
B. S3 Object Lock in compliance mode with a 6-year retention period.
C. S3 Object Lock in governance mode with a 6-year retention period.
D. A daily backup of the bucket to a second, access-restricted bucket.

---

## Part 2 — Answer Key & Explanations

### Q1 — Correct: C
- **A. 11 shards.** Wrong — 12,000 × 900 bytes ≈ 10.8 MB/s → needs 11 shards by throughput, but the fleet "grows unpredictably," which is exactly what the requirement wants to avoid managing manually.
- **B. 12 shards + custom auto-scaling utility.** Wrong — building and maintaining a custom scaling utility is itself the operational burden the team wants to avoid.
- **C. On-demand capacity mode.** Correct — scales automatically to the required throughput with no shard math or scaling utility to build, matching "does not want to calculate or manage shard counts."
- **D. Switch to Firehose.** Wrong — nothing in the scenario asks for delivery-only or removes the need for a consumer/replay; the question is about capacity management, not delivery.

### Q2 — Correct: B
- **A. Kinesis + Lambda consumer.** Wrong — more moving parts than needed; no replay or multi-consumer requirement was stated.
- **B. Firehose with dynamic partitioning.** Correct — a single consumer, no replay, ~90-second freshness target is squarely within Firehose's buffering window, with dynamic partitioning handling the `garage_id` split automatically.
- **C. EMR Serverless streaming job.** Wrong — heavier to build and operate than a managed delivery stream for this simple land-in-S3 need.
- **D. MSK + Kafka Connect.** Wrong — introduces a Kafka cluster to operate for a workload with no stated Kafka requirement.

### Q3 — Correct: A
- **A. DMS full-load-only.** Correct — a one-time cutover where the source can go offline briefly is exactly the full-load-only use case; no CDC is needed since there's no requirement to keep syncing after the maintenance window.
- **B. DMS full load + CDC.** Wrong — CDC is for minimizing downtime by keeping the target in sync while the source stays live; here the source can simply be quiesced, so CDC is unnecessary overhead.
- **C. Glue Studio visual ETL.** Wrong — not purpose-built for database migration with schema/data fidelity guarantees the way DMS is.
- **D. Transfer Family with an export file.** Wrong — manual export/import isn't the managed, purpose-built migration path.

### Q4 — Correct: B
- **A. DynamoDB Streams + custom Lambda.** Wrong — exactly the custom code the requirement says to avoid.
- **B. Zero-ETL integration DynamoDB → OpenSearch.** Correct — a supported zero-ETL pairing that keeps OpenSearch in near-real-time sync with DynamoDB without custom pipeline code.
- **C. Nightly S3 export + bulk load.** Wrong — batch, not near-real-time, and still requires building a load process.
- **D. AWS DMS.** Wrong — DMS's supported source/target list is not the mechanism for this pairing; zero-ETL is the direct, built-in answer.

### Q5 — Correct: B
- **A. Delete and recreate the job.** Wrong — unnecessary; doesn't specifically address reprocessing the affected files.
- **B. Reset the bookmark and rerun for the affected range.** Correct — bookmarks track "already processed" state by file; resetting (and, ideally, scoping the rerun) forces the corrected files to be read again.
- **C. Rename the files.** Wrong — a fragile workaround, not the designed mechanism, and could break downstream naming assumptions.
- **D. Disable bookmarks permanently.** Wrong — solves this one incident by breaking incremental processing going forward, causing every future run to reprocess everything.

### Q6 — Correct: B
- **A. SNS with filtering only on one subscription.** Wrong — works as a possible pattern, but EventBridge is the purpose-built content-routing service and does not require every consumer to be modeled as a raw SNS subscription filter; B is the more direct, standard answer for content-based routing to a specific target.
- **B. EventBridge with a content-filtering rule.** Correct — rules can match on the category attribute and route only to the moderation target when needed, exactly as required.
- **C. SQS with each service polling/discarding.** Wrong — wastes each service's compute on messages it doesn't need and pushes filtering logic to every consumer.
- **D. Lambda function with if/else calling all three.** Wrong — a bespoke, harder-to-maintain routing layer instead of using managed content-based routing.

### Q7 — Correct: B
- **A. Amazon Q in QuickSight.** Wrong — a natural-language BI assistant for QuickSight dashboards, not an IDE coding assistant.
- **B. Amazon Q Developer.** Correct — an AI coding assistant integrated into IDEs that generates/explains code, suggests fixes, and answers AWS questions inline while developers write code.
- **C. Amazon Kendra over the wiki.** Wrong — a document search tool, not an IDE-integrated coding assistant.
- **D. AWS CodeGuru Reviewer.** Wrong — performs automated code review on pull requests/repositories; it isn't an interactive in-IDE assistant for writing and explaining code as you type.

### Q8 — Correct: B
- **A. Snowball Edge monthly.** Wrong — Snowball is for bulk one-time or periodic large transfers via physical shipping, not continuous incremental sync.
- **B. AWS DataSync with a recurring schedule.** Correct — purpose-built for ongoing, automated synchronization between on-premises storage (including NAS) and S3.
- **C. Transfer Family scheduled batch.** Wrong — Transfer Family is an SFTP/FTPS endpoint for partner uploads, not an automated NAS-to-S3 sync tool.
- **D. Manual `aws s3 sync` runs.** Wrong — manual, error-prone, and not "continuously and automatically" synchronized.

### Q9 — Correct: B
- **A. Fixed-schema DataFrame.** Wrong — fails immediately on any missing field or type mismatch, which happens constantly here.
- **B. DynamicFrame + `resolveChoice`.** Correct — DynamicFrames tolerate schema variability record-by-record, and `resolveChoice` explicitly reconciles type/field inconsistencies.
- **C. Require one exact schema from every vendor.** Wrong — not realistic across "hundreds of hardware vendors" and doesn't solve the immediate ingestion problem.
- **D. Convert everything to one wide CSV first.** Wrong — pushes the same reconciliation problem earlier without solving it, and CSV loses type information.

### Q10 — Correct: C
- **A. Firehose + Lambda transform.** Wrong — Firehose transformations operate on individual records/batches during delivery, not continuous stateful windowed aggregation across a rolling time window.
- **B. Scheduled Athena query every 10 minutes.** Wrong — batch-y and not truly continuous/real-time; also re-scans data repeatedly.
- **C. Managed Flink with a sliding window.** Correct — purpose-built for continuous, stateful windowed aggregations like rolling averages and standard deviation, updated as new events arrive.
- **D. Hourly Glue batch job.** Wrong — far too infrequent for a "real time," "live monitoring" requirement.

### Q11 — Correct: B
- **A. Small provisioned Redshift cluster running continuously.** Wrong — bills for idle time during the frequent weeks-long gaps in usage.
- **B. Amazon Athena.** Correct — pay-per-query with zero idle cost, ideal for occasional, unpredictable, sometimes-idle-for-a-week query patterns.
- **C. Persistent EMR cluster.** Wrong — same idle-cost problem as a provisioned cluster, plus more operational overhead.
- **D. Redshift Serverless with an always-on minimum base capacity.** Wrong — a minimum base capacity that's always running reintroduces the idle-cost problem for a workload with no steady baseline demand.

### Q12 — Correct: B
- **A. Local Secondary Index.** Wrong — LSIs can only be created at table creation time; this table has existed for two years.
- **B. Global Secondary Index.** Correct — GSIs can be added at any time and support a new, previously unanticipated access pattern; eventual consistency is acceptable here.
- **C. Recreate the table.** Wrong — unnecessarily disruptive and costly compared to simply adding a GSI.
- **D. `Scan` with a filter expression.** Wrong — scans the entire table and filters afterward, wasting read capacity and scaling poorly — exactly what indexes exist to avoid.

### Q13 — Correct: B
- **A. Lifecycle to Deep Archive after 14 days.** Wrong — Deep Archive retrieval takes up to 12 hours; images that go viral again need fast access, which this doesn't provide, and the pattern isn't described as fully certain.
- **B. S3 Intelligent-Tiering.** Correct — the team explicitly isn't sure of the full pattern (occasional unpredictable re-access), which is exactly the "unknown/changing pattern" case Intelligent-Tiering is designed for, automatically moving objects between tiers based on actual access.
- **C. Lifecycle to Standard-IA after 14 days.** Wrong — works reasonably but doesn't adapt automatically to the unpredictable viral re-access spikes the way Intelligent-Tiering does, and the team specifically doesn't want to hand-build a fixed rule for an uncertain pattern.
- **D. Leave everything in Standard.** Wrong — needlessly expensive once access drops after day 14.

### Q14 — Correct: B
- **A. Add more nodes.** Wrong — doesn't fix the underlying skew; the same few slices still do the disproportionate work.
- **B. Higher-cardinality DISTKEY or DISTSTYLE AUTO.** Correct — a 4-value DISTKEY is a classic skew cause; a higher-cardinality key (or letting Redshift decide via AUTO) spreads rows evenly.
- **C. Sort key on `payment_method`.** Wrong — sort keys accelerate range filters via zone maps, not join co-location; this doesn't address distribution skew.
- **D. Change `drivers`' distribution to KEY on `driver_id`.** Wrong — doesn't fix the `trips` table's skewed distribution, which is the actual bottleneck described.

### Q15 — Correct: B
- **A. Restore the whole bucket from backup.** Wrong — heavy-handed, disruptive to the live table, and not how you'd non-destructively query a historical state.
- **B. Iceberg snapshot/time-travel.** Correct — Iceberg natively supports querying a table exactly as it existed at a prior snapshot/timestamp without disrupting current data.
- **C. Rely on a manual copy having been kept.** Wrong — not a designed or reliable mechanism; depends on someone having remembered to do it.
- **D. S3 versioning on individual objects.** Wrong — versions individual files, not a consistent table-level snapshot as of a point in time.

### Q16 — Correct: B
- **A. Load 3 years into Redshift via COPY.** Wrong — directly contradicts "without loading the archive into the cluster."
- **B. Redshift Spectrum external schema.** Correct — Redshift already exists and needs to join warehouse tables with S3 data without loading it — Spectrum's exact use case.
- **C. Athena + manual merge.** Wrong — more manual effort than necessary when Spectrum can join directly inside Redshift.
- **D. Zero-ETL to bring the archive into Redshift.** Wrong — zero-ETL is for operational database sources (like Aurora/RDS/DynamoDB), not S3 files, and would load data in anyway.

### Q17 — Correct: B
- **A. On-demand capacity mode.** Wrong — changes billing/scaling model but does not reduce latency to microseconds.
- **B. DAX.** Correct — a DynamoDB-native, microsecond-latency caching layer that sits in front of the table with minimal application changes.
- **C. Increase provisioned RCUs substantially.** Wrong — more capacity doesn't change DynamoDB's baseline single-digit-millisecond latency to microseconds.
- **D. Add a GSI.** Wrong — GSIs support new query patterns; they don't provide caching or reduce latency for an existing hot-key read pattern.

### Q18 — Correct: B
- **A. Reduce crawler to weekly.** Wrong — reduces crawler cost somewhat but leaves query planning latency and catalog staleness unresolved.
- **B. Athena partition projection.** Correct — a fully predictable partition scheme with tens of millions of partitions is the textbook partition-projection case, removing both crawler dependency and catalog lookup latency.
- **C. Remove partitioning entirely.** Wrong — eliminates partition pruning, making most queries scan far more data.
- **D. Move the table to DynamoDB.** Wrong — DynamoDB isn't a substitute for a partitioned analytical table queried via SQL.

### Q19 — Correct: B
- **A. Add more shards for write capacity.** Wrong — `WriteProvisionedThroughputExceeded` at zero means producers aren't being throttled; the write side isn't the bottleneck.
- **B. Consumer falling behind; scale out.** Correct — rising `IteratorAge` with no write throttling is the signature of a lagging consumer; increasing Lambda parallelization or adding consumers addresses it directly.
- **C. Increase retention period.** Wrong — retention affects how long data is available for replay, not how fast the consumer processes records; it doesn't reduce lag.
- **D. Switch to Firehose.** Wrong — removes the consumer and any custom enrichment logic rather than fixing the lag, and loses replay capability.

### Q20 — Correct: B
- **A. Remove access from most analysts.** Wrong — explicitly contradicts "without removing self-service access."
- **B. Workgroup data usage control.** Correct — a per-query bytes-scanned limit on the workgroup caps the damage any single runaway query can do while preserving self-service.
- **C. Convert tables to uncompressed CSV.** Wrong — makes queries slower and more expensive to scan, the opposite of cost control.
- **D. Require manual approval per query.** Wrong — defeats the purpose of self-service and doesn't scale operationally.

### Q21 — Correct: B
- **A. Manual try/except retry loop in the Lambda.** Wrong — the requirement specifically says not to add retry logic inside the Lambda function; this also duplicates what Step Functions already provides natively.
- **B. `Retry` field with backoff on the task state.** Correct — Step Functions supports per-state retry configuration with exponential backoff, defined declaratively in the state machine, exactly matching the requirement.
- **C. Reduce the overall workflow timeout.** Wrong — makes the workflow fail faster, the opposite of allowing retries to happen.
- **D. Switch to Express.** Wrong — the workflow type doesn't automatically add retry-with-backoff behavior; `Retry` fields are configured the same way regardless of type, and this doesn't address the requirement.

### Q22 — Correct: B
- **A. Search logs manually across log groups.** Wrong — slow, disconnected view; doesn't show the relationship between segments across services.
- **B. AWS X-Ray.** Correct — traces a request end-to-end, showing exactly which segment (API Gateway, Lambda, DynamoDB) is contributing the latency.
- **C. CloudTrail.** Wrong — records management/API activity, not application request latency.
- **D. CloudWatch composite alarm on error rate.** Wrong — alarms on aggregate metrics, not on tracing where latency originates for individual requests.

### Q23 — Correct: B
- **A. Custom PySpark assert.** Wrong — more custom code than a no-code requirement calls for.
- **B. Glue Data Quality (DQDL) ruleset.** Correct — declarative length/null-check rules with automatic fail-on-violation behavior, no custom code.
- **C. Amazon Macie.** Wrong — discovers sensitive data; it doesn't validate business/format rules like VIN length.
- **D. Manual sample review.** Wrong — not automated and doesn't halt the pipeline before promotion.

### Q24 — Correct: B
- **A. Separate Redshift DB users with row-filtering views.** Wrong — works functionally but does not provide the fast, cached, high-concurrency performance requirement without repeatedly hitting Redshift.
- **B. QuickSight + SPICE + row-level security.** Correct — SPICE caches data in-memory for fast concurrent access, and row-level security restricts each owner to their own location, without hitting Redshift on every view.
- **C. Daily CSV export + email.** Wrong — not an interactive dashboard and not scoped to a security model at all.
- **D. QuickSight direct query mode.** Wrong — queries Redshift on every interaction, failing the "without hitting the warehouse on every interaction" requirement under hundreds of concurrent viewers.

### Q25 — Correct: B
- **A. Permanently resize the cluster.** Wrong — pays for extra capacity 29+ days a month that's idle outside the one-hour monthly spike.
- **B. Concurrency scaling.** Correct — automatically adds transient capacity during the predictable brief spike, then removes it, matching the pattern exactly.
- **C. Ask finance to spread reports out.** Wrong — a process workaround, not a technical solution, and unreliable to enforce.
- **D. Move reporting to DynamoDB.** Wrong — DynamoDB isn't a substitute for SQL-based financial reporting workloads.

### Q26 — Correct: B
- **A. Grant `s3:*`.** Wrong — S3 permissions are already sufficient per the scenario; the gap is at the KMS layer.
- **B. Add `kms:Decrypt` to the KMS key policy for the role.** Correct — SSE-KMS objects require both S3 permissions and a KMS key policy grant; this is the missing piece.
- **C. Turn off encryption.** Wrong — removes required protection rather than fixing the actual permission gap.
- **D. Move data to an unencrypted bucket.** Wrong — a workaround that abandons required encryption instead of fixing access.

### Q27 — Correct: B
- **A. IAM policies per department.** Wrong — IAM has no native column-level concept for cataloged data.
- **B. Lake Formation column-level data filter for Economics; no grant for others.** Correct — Lake Formation is the mechanism for sub-table, column-level permissions on catalog data, and simply not granting access covers the "no access" requirement for other departments.
- **C. Physically split the table by department.** Wrong — unnecessary duplication and ongoing sync burden.
- **D. Column-specific KMS key.** Wrong — doesn't cleanly hide the column from query results and adds key-management complexity Lake Formation avoids.

### Q28 — Correct: B
- **A. Parameter Store SecureString.** Wrong — can store encrypted values, but native, built-in automatic rotation with Aurora/RDS is Secrets Manager's defining capability, not Parameter Store's.
- **B. Secrets Manager with automatic rotation.** Correct — built-in rotation integration for Aurora PostgreSQL (and other RDS-family engines) with no custom rotation code required.
- **C. Hardcoded encrypted config file in S3.** Wrong — no automatic rotation at all, and hardcoding credentials is a poor practice regardless.
- **D. DynamoDB with client-side encryption.** Wrong — not a purpose-built secrets-rotation service; would require building custom rotation logic.

### Q29 — Correct: B
- **A. Identity-based allow takes precedence.** Wrong — this is exactly backwards; an SCP is a guardrail that caps what's possible regardless of IAM grants.
- **B. SCP's explicit deny overrides.** Correct — an explicit deny at any evaluated layer, including an SCP, always wins over an allow.
- **C. Depends on creation order.** Wrong — IAM/SCP evaluation isn't determined by which policy was authored first.
- **D. Root user can bypass.** Wrong — SCPs apply to all principals in affected accounts, including the root user (with very narrow, unrelated exceptions like the ability to leave the organization).

### Q30 — Correct: B
- **A. Versioning + IAM deny policy.** Wrong — an IAM policy can be changed or bypassed by someone with sufficient permissions (including admins); it isn't a true, unbypassable WORM guarantee.
- **B. S3 Object Lock in compliance mode.** Correct — compliance mode prevents deletion or modification by any principal, including the root/account administrators, until the retention period expires — a true regulatory WORM guarantee.
- **C. S3 Object Lock in governance mode.** Wrong — governance mode can be overridden by users with the `s3:BypassGovernanceRetention` permission, so it does not guarantee protection against administrators.
- **D. Daily backup to a second bucket.** Wrong — the original files in the primary bucket could still be deleted/modified; a backup copy doesn't enforce WORM on the source.

---

## Score yourself

| Score | Read as |
|---|---|
| 26–30 / 30 | Ready for `Advanced.md` |
| 20–25 / 30 | Solid, but revisit the specific misses against `00-START-HERE/DECISION-TREES.md` |
| Below 20 / 30 | Re-drill the relevant `01-domains/DOMAIN-*.md` question banks before advancing |
