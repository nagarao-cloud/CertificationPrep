# Full Explanations — Mock Exam 1 (every option, right and wrong)

> Matches `Full-Mock-Exam-1.md` question-for-question and
> `Answer-Key.md` answer-for-answer. For each question: a one-line
> recap of the scenario, why every option is right or wrong, and the
> keyword that should have tipped you off.

---

### Q1 — Sensor fleet needs sub-second access, no manual capacity management
**Correct: C**

- **A. 6 shards.** Wrong — that's only the record-count math (6,000 ÷ 1,000). By throughput, 6,000 records/sec × 2.5 KB = 15 MB/s, which needs 15 shards. This is the classic "smaller, tempting number" trap.
- **B. 15 shards, manually resharded as volume grows.** Wrong — the throughput math is right, but manual resharding is exactly the operational burden the scenario wants to avoid as sensor count grows.
- **C. On-demand capacity mode.** Correct — on-demand scales automatically to the required throughput (well past 15 MB/s) without the team ever computing or managing shard counts.
- **D. Amazon Data Firehose configured for "real-time."** Wrong — Firehose has no real-time configuration; it buffers for tens of seconds at minimum, which fails the sub-second requirement.

**Keyword that should have tipped you off:** "avoid manually managing streaming capacity" → on-demand mode.

---

### Q2 — Redshift join skew from a low-cardinality DISTKEY
**Correct: C**

- **A. Add more nodes.** Wrong — more nodes doesn't fix an uneven distribution; the same few slices still absorb most of the work, just on a bigger cluster.
- **B. `DISTSTYLE ALL`.** Wrong — ALL replicates the entire table to every node, which is right for small dimension tables and disastrous for a large fact table.
- **C. Higher-cardinality DISTKEY or `AUTO`.** Correct — a low-cardinality key (8 values) is the direct cause of the skew; a higher-cardinality join column spreads rows evenly across slices.
- **D. Interleaved sort key.** Wrong — sort keys accelerate range filters via zone maps; they have nothing to do with join co-location or distribution skew.

**Keyword that should have tipped you off:** "8 distinct values" as the DISTKEY → skew, not a sort-key problem.

---

### Q3 — `IteratorAge` climbing, dashboards showing stale data
**Correct: B**

- **A. Producers exceeding throughput; add shards.** Wrong — producer throttling shows up as `WriteProvisionedThroughputExceeded`, a different metric entirely.
- **B. Consumer falling behind; scale consumers / EFO / parallelization factor.** Correct — `IteratorAge` specifically measures how far behind the consumer is reading.
- **C. Lambda memory too high causing throttling.** Wrong — high memory doesn't cause throttling; this isn't a real failure mode tied to `IteratorAge`.
- **D. Replace the stream with Firehose.** Wrong — doesn't fix the underlying consumer lag, and removes real-time enrichment and replay capability the architecture needs.

**Keyword that should have tipped you off:** `IteratorAge` = consumer-side lag, always.

---

### Q4 — CDRs need three independent full-stream consumers, plus 3-day replay
**Correct: B, C**

- **A. Three separate Firehose delivery streams.** Wrong — a Firehose delivery stream has exactly one destination and no replay; this doesn't give independent full-stream access or reprocessing.
- **B. Kinesis Data Streams with ≥3-day retention.** Correct — retention is what makes the fraud team's reprocessing requirement possible.
- **C. Enhanced fan-out for dedicated per-consumer throughput.** Correct — with three independent consumers each needing the full stream, EFO avoids them sharing the standard 2 MB/s per shard.
- **D. SQS Standard with a custom Lambda fan-out function.** Wrong — custom fan-out code is unnecessary operational overhead, and SQS doesn't provide multi-day replay the way Kinesis retention does.
- **E. Reduce shard count to save cost.** Wrong — directly contradicts the throughput and replay requirements; also the claim about Firehose auto-scaling is irrelevant here.

**Keyword that should have tipped you off:** "each consume the full event stream independently" + "reprocess" → Kinesis retention + enhanced fan-out, not Firehose.

---

### Q5 — Analysts must see all columns except SSN and DOB, across Athena and Spectrum
**Correct: B**

- **A. IAM policy restricting the columns.** Wrong — IAM has no concept of a column; it operates on buckets, prefixes, and API actions.
- **B. Lake Formation column-level data filter.** Correct — this is the only mechanism that applies sub-table, column-level restrictions consistently to both Athena and Redshift Spectrum through the shared catalog.
- **C. Duplicate the data into a second bucket without the sensitive columns.** Wrong — creates an ongoing sync burden and data duplication the requirement doesn't ask for.
- **D. Client-side KMS encryption on the two columns.** Wrong — doesn't cleanly hide the columns from query results and adds key-management complexity for a problem Lake Formation solves natively.

**Keyword that should have tipped you off:** "all columns except" → Lake Formation column-level permissions.

---

### Q6 — Tens of millions of predictable partitions, crawler cost and planning time high
**Correct: B**

- **A. Run the crawler less often.** Wrong — reduces crawler cost slightly but leaves query planning slow and the catalog stale; doesn't address the root cause.
- **B. Athena partition projection.** Correct — computes partition locations from a configured pattern instead of looking them up in the catalog, eliminating both crawler runs and planning latency.
- **C. Migrate to Redshift Spectrum.** Wrong — Spectrum still uses the Glue Catalog and partitioning; it doesn't remove the problem and adds an unnecessary cluster.
- **D. More crawler DPUs.** Wrong — crawlers aren't sized with DPUs the way Glue ETL jobs are, and this doesn't address catalog lookup overhead.

**Keyword that should have tipped you off:** "predictable" partition scheme + "millions of partitions" → partition projection.

---

### Q7 — Clickstream must land in S3, queryable within ~2 minutes, least overhead
**Correct: B**

- **A. Kinesis Data Streams + Lambda consumer.** Wrong — more moving parts than the requirement calls for; no replay or multi-consumer need was stated, so this is over-engineered.
- **B. Amazon Data Firehose, dynamic partitioning + Parquet conversion.** Correct — a ~60-second buffer comfortably meets "within about 2 minutes," with the least operational overhead of any option.
- **C. Glue streaming job writing every 2 minutes.** Wrong — Glue Streaming bills continuously and is heavier to operate than a managed delivery stream for a pure land-in-S3 requirement.
- **D. Hourly cron batch export.** Wrong — fails the 2-minute freshness requirement outright.

**Keyword that should have tipped you off:** "near real-time" + "least possible operational overhead" → Firehose.

---

### Q8 — Automated null/uniqueness/range checks before promoting to curated zone
**Correct: B**

- **A. Custom PySpark assertions.** Wrong — more code to write and maintain, contradicting "minimal custom code."
- **B. Glue Data Quality with a DQDL ruleset, fail on violation.** Correct — purpose-built for exactly this: declarative rules, automatic evaluation, and pipeline-halting on failure.
- **C. Amazon Macie.** Wrong — Macie discovers sensitive data (PII), not business rule violations like nulls or out-of-range values.
- **D. Glue DataBrew manual profiling.** Wrong — DataBrew profiling is exploratory and analyst-driven, not an automated pass/fail gate inside a scheduled pipeline.

**Keyword that should have tipped you off:** "nulls, uniqueness, range" + "halt the pipeline" → Glue Data Quality (DQDL).

---

### Q9 — Known access pattern, but occasional hours-notice audit retrieval
**Correct: C**

- **A. S3 Intelligent-Tiering.** Wrong — the pattern is explicitly known and stable; Intelligent-Tiering's monitoring fee exists to discover *unknown* patterns, which is wasted cost here.
- **B. Lifecycle to Glacier Deep Archive.** Wrong — Deep Archive's standard retrieval takes up to 12 hours, which can miss "a few hours' notice."
- **C. Lifecycle to Glacier Flexible Retrieval.** Correct — standard retrieval (3–5 hours) comfortably fits "a few hours," and it's cheaper than Standard-IA for rarely-accessed, long-lived data.
- **D. Lifecycle to Standard-IA indefinitely.** Wrong — more expensive long-term than a Glacier tier for data that's almost never read.

**Keyword that should have tipped you off:** "well understood" pattern rules out Intelligent-Tiering; "a few hours' notice" rules out Deep Archive.

---

### Q10 — Heterogeneous Oracle → Aurora PostgreSQL migration, minimal downtime
**Correct: B**

- **A. DMS alone for schema and data.** Wrong — DMS migrates data; it does not convert schemas, stored procedures, or views.
- **B. DMS Schema Conversion, then DMS full load + CDC.** Correct — DMS Schema Conversion (built into the DMS console) converts the schema and code objects; full load + CDC then migrates the data with minimal downtime by keeping the target in sync until cutover.
- **C. Manual schema export + DMS full-load-only.** Wrong — full-load-only requires quiescing the source (a downtime window), and manual schema scripting doesn't scale or verify conversion correctness.
- **D. Nightly Glue JDBC extracts.** Wrong — doesn't convert schema/procedures, and a nightly batch is not continuous, minimal-downtime replication.

**Keyword that should have tipped you off:** "schema, stored procedures, and views" + "minimal downtime" → DMS Schema Conversion + full load/CDC.

---

### Q11 — Glue job gets `AccessDenied` on SSE-KMS objects despite correct S3 permissions
**Correct: B**

- **A. Grant broader S3 permissions.** Wrong — S3 permissions aren't the blocker here; the role and bucket policy already allow the access.
- **B. Grant `kms:Decrypt` in the KMS key policy.** Correct — SSE-KMS objects require both S3 permissions *and* a KMS key policy grant; this is the single most-tested troubleshooting scenario in Domain 4.
- **C. Disable encryption on the bucket.** Wrong — removes required protection instead of fixing the actual missing permission.
- **D. Attach `AdministratorAccess`.** Wrong — doesn't address a key-policy-level restriction, and violates least privilege.

**Keyword that should have tipped you off:** "IAM role has `s3:GetObject`... bucket policy allows" already true → the gap is the KMS key policy.

---

### Q12 — DynamoDB GSI vs LSI for two different access patterns
**Correct: A, C**

- **A. GSI for `region`, added a year later.** Correct — GSIs can be added at any time, and eventual consistency is acceptable here.
- **B. LSI for `region`.** Wrong — LSIs must be created at table creation time; the table has been running for a year, so this is no longer possible.
- **C. LSI for `item_rarity`, known at creation, strong consistency.** Correct — this is exactly the LSI use case: defined up front, supports strong consistency.
- **D. GSI for `item_rarity` for strong consistency.** Wrong — GSIs only support eventual consistency; they cannot satisfy this requirement.
- **E. DynamoDB Streams into a second table.** Wrong — unnecessary complexity when native indexes solve both patterns directly.

**Keyword that should have tipped you off:** "added...after the table has been in production" (GSI) vs. "known before the table was created" (LSI).

---

### Q13 — Ongoing audit trail of who reads/writes specific S3 objects
**Correct: B**

- **A. Rely on existing CloudTrail management events.** Wrong — object-level `GetObject`/`PutObject` calls are data events, not covered by management events.
- **B. Enable CloudTrail data events for the bucket.** Correct — data events are the only mechanism that records object-level API activity by principal, and they're off by default.
- **C. VPC Flow Logs.** Wrong — records network traffic metadata, not S3 API-level identity attribution.
- **D. S3 versioning.** Wrong — tracks object versions, not who accessed them.

**Keyword that should have tipped you off:** "which IAM principal accesses... specific... objects" → CloudTrail data events.

---

### Q14 — Aurora MySQL app, near-real-time reporting in Redshift, no custom pipeline
**Correct: C**

- **A. Scheduled Glue JDBC extract.** Wrong — a custom, scheduled pipeline to build and maintain, and batch-scheduled rather than near-real-time.
- **B. DMS CDC → S3 → Redshift.** Wrong — more moving parts (DMS + S3 + COPY) than necessary when a native zero-ETL path exists for exactly this source/target pair.
- **C. Zero-ETL integration, Aurora MySQL → Redshift.** Correct — no pipeline, no Glue job, no code; seconds of lag.
- **D. Amazon Data Firehose streaming database changes.** Wrong — Firehose isn't a database CDC mechanism; it ingests streamed records, not native DB change capture this way.

**Keyword that should have tipped you off:** "operational database" + "near real-time" + "no custom pipeline code" → zero-ETL.

---

### Q15 — Bug found; must reprocess 10 days of bookmarked history
**Correct: B**

- **A. Enable job bookmarks before the next run.** Wrong — bookmarks are already enabled; this doesn't trigger reprocessing of already-marked data.
- **B. Reset the job bookmark, then rerun.** Correct — resetting clears the "already processed" marker so the corrected job reprocesses the full history.
- **C. Increase DPUs.** Wrong — affects performance, not which data is selected for processing.
- **D. Delete and recreate the Glue job.** Wrong — unnecessary; doesn't itself reset bookmark state, and adds churn for no benefit.

**Keyword that should have tipped you off:** "reprocess all... historical data" → reset the bookmark, don't enable it.

---

### Q16 — 800 non-sensitive config values, most cost-effective, no rotation needed
**Correct: B**

- **A. Secrets Manager.** Wrong — ~$0.40/secret/month adds real cost at 800 secrets for values that need no rotation; Secrets Manager earns its cost through rotation, not plain storage.
- **B. Parameter Store, Standard tier.** Correct — free, and purpose-built for configuration values without rotation needs.
- **C. DynamoDB table.** Wrong — more operational overhead (schema, access code) than a purpose-built config store, with no cost advantage.
- **D. Hardcode values in scripts.** Wrong — no central management, requires a code deployment for every config change.

**Keyword that should have tipped you off:** "most cost-effective" + no rotation → Parameter Store Standard.

---

### Q17 — Existing Spark/Hive on EMR, petabyte scale, minimize cost
**Correct: B**

- **A. Spot on all node types.** Wrong — losing the primary node kills the cluster; losing core nodes risks HDFS data loss.
- **B. On-Demand primary/core, Spot task nodes via instance fleets.** Correct — task nodes hold no data and are safely interruptible; this is the standard "minimize EMR cost" pattern.
- **C. Migrate to Glue.** Wrong — the team wants to keep the existing framework, and Glue doesn't natively run Hive the way EMR does.
- **D. Reserved Instances for all node types.** Wrong — RIs help with steady-state cost but don't approach Spot's savings for a "minimize cost as much as possible" ask.

**Keyword that should have tipped you off:** "minimize compute cost" + "existing framework" on EMR → Spot on task nodes only.

---

### Q18 — Glue OOM on G.1X with no apparent skew
**Correct: B**

- **A. More G.1X workers.** Wrong — adds parallelism, not memory per executor; doesn't fix a per-task OOM.
- **B. Larger worker type (G.2X).** Correct — the standard first fix for OOM: more memory per executor.
- **C. Enable job bookmarks.** Wrong — unrelated to memory; bookmarks control incremental data selection.
- **D. Switch to Flex execution class.** Wrong — Flex affects scheduling priority and cost, not available memory.

**Keyword that should have tipped you off:** "out-of-memory" + "not significantly skewed" → bigger worker type.

---

### Q19 — Bursty vs. steady Redshift workloads
**Correct: A, C**

- **A. Serverless for the bursty marketing workload.** Correct — pay-per-RPU with no idle cost fits unpredictable, sometimes-idle usage.
- **B. Serverless for the steady finance workload.** Wrong — RPU-hour billing on a constantly active workload costs more than provisioned + RIs.
- **C. Provisioned + Reserved Instances for the steady finance workload.** Correct — RIs discount steady-state, predictable, always-on usage significantly.
- **D. On-Demand provisioned cluster for the bursty marketing workload.** Wrong — pays for idle cluster time between bursts, which Serverless avoids.
- **E. Redshift Spectrum for both.** Wrong — Spectrum queries S3 from an existing cluster; it doesn't answer the compute-configuration question being asked.

**Keyword that should have tipped you off:** "unpredictable bursts, sometimes idle" vs. "steady, predictable 24/7."

---

### Q20 — 40 GB daily file, ~25-minute processing time
**Correct: B**

- **A. Lambda with max memory/timeout.** Wrong — Lambda's hard ceiling is 15 minutes; a 25-minute job will time out regardless of memory settings.
- **B. Glue ETL or EMR Serverless, sized appropriately.** Correct — purpose-built for jobs that exceed Lambda's time/memory ceilings.
- **C. Split into chunks across many Lambda invocations, merge with another Lambda.** Wrong — technically possible but massively over-engineered custom orchestration compared to a managed batch service.
- **D. Increase reserved concurrency.** Wrong — concurrency controls parallel invocations, not the per-invocation time/memory ceiling.

**Keyword that should have tipped you off:** "25 minutes" > Lambda's 15-minute wall.

---

### Q21 — Identify buckets/objects with unprotected PII, no manual inspection
**Correct: B**

- **A. AWS Config rules.** Wrong — evaluates resource *configuration* (e.g., is encryption enabled), not the *content* of objects for PII.
- **B. Amazon Macie.** Correct — purpose-built to scan S3 and classify sensitive data automatically.
- **C. Glue Data Quality.** Wrong — validates business rules the engineer defines; it's not a managed sensitive-data classifier and requires already knowing what to check for.
- **D. Amazon Kendra.** Wrong — a natural-language enterprise search service for finding documents/answers, not a sensitive-data classifier.

**Keyword that should have tipped you off:** "identify... unprotected personally identifiable... information" → Macie.

---

### Q22 — Regulatory "as of a date" query + add a column without rewriting data
**Correct: B**

- **A. Standard Hive-style Parquet table.** Wrong — no built-in time travel, and schema changes are limited/positional, often requiring rewrites.
- **B. Apache Iceberg, snapshots + schema evolution.** Correct — snapshots give point-in-time query semantics; schema evolution adds columns without rewriting files.
- **C. Manual daily S3 snapshots via Batch Operations.** Wrong — expensive, slow, and doesn't give query-time "as of" semantics.
- **D. DynamoDB PITR on an exported copy.** Wrong — wrong tool entirely; the data lives in S3/Athena/Redshift, not DynamoDB.

**Keyword that should have tipped you off:** "as it existed at close of business on a specific prior date" → time travel → Iceberg.

---

### Q23 — Real-time 5-minute rolling average per machine
**Correct: C**

- **A. Firehose + Lambda transformation.** Wrong — per-record/batch transforms, not stateful time-windowed aggregation across a rolling window.
- **B. Glue Streaming with a fixed micro-batch interval.** Wrong — a weaker fit for precise rolling/event-time windows than a purpose-built stream processor.
- **C. Managed Service for Apache Flink, sliding window.** Correct — exactly the windowed-aggregation use case Flink is built for.
- **D. Scheduled Athena queries every 5 minutes.** Wrong — introduces landing latency and isn't a continuous real-time computation.

**Keyword that should have tipped you off:** "rolling average," "in real time" → Managed Flink.

---

### Q24 — Regional dashboards, many concurrent viewers, no warehouse hit per interaction
**Correct: B**

- **A. Separate Redshift DB users with RLS views.** Wrong — doesn't solve dashboard performance/concurrency load on the warehouse from many interactive viewers.
- **B. QuickSight + SPICE + row-level security.** Correct — in-memory SPICE handles concurrent viewers without repeatedly hitting Redshift, and RLS restricts each manager to their region.
- **C. QuickSight direct query + IAM restrictions.** Wrong — direct query hits the warehouse on every interaction, and IAM can't filter rows.
- **D. Separate dashboards per region with exported files.** Wrong — high operational overhead maintaining many pipelines/dashboards instead of one with RLS.

**Keyword that should have tipped you off:** "large number of concurrent viewers" + "without hitting the warehouse" → SPICE.

---

### Q25 — Non-coding business analysts need to explore/clean a new dataset
**Correct: B**

- **A. Glue Studio visual editor.** Wrong — still generates Spark ETL jobs aimed at engineers; assumes ETL concepts.
- **B. Glue DataBrew.** Correct — the no-code tool explicitly aimed at business analysts.
- **C. Athena with SQL.** Wrong — requires SQL knowledge, which the analysts don't have.
- **D. Lambda with a Python script.** Wrong — requires coding, directly contradicting the requirement.

**Keyword that should have tipped you off:** "business analysts... do not write code" → DataBrew.

---

### Q26 — 15 million short workflow executions per day, most cost-effective
**Correct: B**

- **A. Step Functions Standard.** Wrong — billed per state transition, which becomes very expensive at this execution volume.
- **B. Step Functions Express.** Correct — billed on requests + duration, far cheaper at high volume of short executions.
- **C. MWAA scheduled continuously.** Wrong — always-on environment cost, and a poor fit for millions of independent short executions.
- **D. Glue Workflows.** Wrong — designed to chain Glue jobs/crawlers, not general-purpose high-volume short workflows.

**Keyword that should have tipped you off:** "15 million... per day" + "most cost-effective" → Express, not Standard.

---

### Q27 — Sharing KMS-encrypted S3 objects with a partner account
**Correct: A, B**

- **A. Update the bucket policy/ACL for the partner principal.** Correct — resource-level S3 access is one required piece.
- **B. Update the KMS key policy for the partner principal.** Correct — the second required piece; without `kms:Decrypt` in the key policy, S3 access alone isn't enough.
- **C. Have the partner assume a role in their own account.** Wrong — a role in the partner's own account grants nothing in your bucket or key.
- **D. Make the bucket public.** Wrong — unnecessary and violates least privilege.
- **E. Switch to SSE-S3.** Wrong — SSE-S3 uses AWS-managed keys that can't be scoped for cross-account sharing at all, making this worse, not simpler.

**Keyword that should have tipped you off:** cross-account + KMS → both a resource grant *and* a key-policy grant are needed.

---

### Q28 — SQL-like search across a Lambda function's logs for the last 24 hours
**Correct: B**

- **A. Athena with a Lambda federated query connector.** Wrong — more setup than necessary for a capability built directly into CloudWatch.
- **B. CloudWatch Logs Insights.** Correct — SQL-like queries against CloudWatch Logs natively, no export needed.
- **C. AWS X-Ray.** Wrong — distributed tracing/latency analysis, not full-text/structured log search.
- **D. Export to S3 then query with Athena.** Wrong — an unnecessary extra step and delay when Logs Insights queries logs directly.

**Keyword that should have tipped you off:** "SQL-like query syntax" + "without exporting" → Logs Insights.

---

### Q29 — Manual Iceberg compaction/cleanup burden, wants automatic maintenance
**Correct: B**

- **A. Standard S3 + nightly Glue compaction job.** Wrong — this is the current, manual approach the team wants to move away from.
- **B. Amazon S3 Tables.** Correct — Iceberg-native table storage with automatic compaction, snapshot management, and cleanup built in.
- **C. Redshift managed storage instead of S3.** Wrong — changes the storage paradigm entirely and doesn't address Iceberg-specific lake maintenance.
- **D. EMR with a weekly cron `OPTIMIZE` job.** Wrong — still manual, self-managed maintenance — not "least operational overhead."

**Keyword that should have tipped you off:** "automatic compaction... least operational overhead" on an Iceberg lake → Amazon S3 Tables.

---

### Q30 — 60 existing Airflow DAGs with custom Python operators, keep unchanged
**Correct: B**

- **A. Rewrite as Step Functions.** Wrong — contradicts "keeping DAGs largely unchanged."
- **B. MWAA.** Correct — managed Airflow, purpose-built for migrating existing DAGs and Python dependencies with minimal rework.
- **C. Glue Workflows.** Wrong — limited to chaining Glue jobs/crawlers; can't run arbitrary custom Python operators.
- **D. EventBridge Scheduler + per-task Lambdas.** Wrong — requires re-architecting the DAGs into a different orchestration model entirely.

**Keyword that should have tipped you off:** "existing Airflow DAGs... complex Python deps" → MWAA.

---

### Q31 — Analytics on DynamoDB data without impacting the live game backend
**Correct: B**

- **A. Scheduled `Scan` into S3.** Wrong — `Scan` consumes read capacity and can throttle production traffic.
- **B. Export-to-S3, then Athena.** Correct — export-to-S3 consumes no RCUs, which is its entire reason for existing.
- **C. Increase read capacity to absorb both workloads.** Wrong — more expensive, and still risks contention during the scan; doesn't remove the impact.
- **D. DynamoDB Streams, manually replayed to S3.** Wrong — Streams captures ongoing changes with 24-hour retention, not a full snapshot export mechanism; far more custom code than the native export feature.

**Keyword that should have tipped you off:** "without... consuming... capacity or risking throttling" → export to S3, not `Scan`.

---

### Q32 — Private S3 access from a VPC with no internet/NAT gateway, no additional cost
**Correct: B**

- **A. Interface VPC endpoint (PrivateLink).** Wrong — incurs hourly and per-GB charges.
- **B. Gateway VPC endpoint.** Correct — free, and exists specifically for S3 and DynamoDB.
- **C. NAT gateway.** Wrong — charges hourly and per-GB, and isn't fully private (routes over the public S3 endpoint).
- **D. Internet gateway + public S3 endpoint.** Wrong — exposes the VPC to the internet; not private, and adds cost/risk.

**Keyword that should have tipped you off:** "private... at no additional cost" → gateway endpoint (S3/DynamoDB only, free).

---

### Q33 — One event, five downstream systems, each filtering on different attributes
**Correct: B**

- **A. SNS topic with five SQS subscribers.** Wrong — SNS filtering is more limited than EventBridge's content-based rules for varied attribute conditions across many targets.
- **B. EventBridge with content-based routing rules.** Correct — purpose-built for routing one event to many targets based on event content.
- **C. SQS Standard, self-filtered by each consumer.** Wrong — duplicates filtering logic five times and adds unnecessary coupling.
- **D. Lambda function with conditional logic calling all five systems.** Wrong — custom code replacing a managed routing service; higher maintenance burden.

**Keyword that should have tipped you off:** "route... based on... specific attribute conditions" → EventBridge.

---

### Q34 — Predictable monthly Redshift concurrency spike
**Correct: B, C**

- **A. Permanently resize for peak.** Wrong — pays for peak capacity all month for a problem lasting a brief period.
- **B. Concurrency scaling.** Correct — adds transient capacity automatically during the spike, with free credit hours.
- **C. Automatic WLM / tuned query queues.** Correct — better manages concurrent query slots without permanent over-provisioning.
- **D. Disable short query acceleration.** Wrong — SQA helps short queries jump the queue; disabling it wouldn't relieve overall pressure.
- **E. Move all analysts to Athena permanently.** Wrong — a far larger architectural change than the transient-spike problem requires.

**Keyword that should have tipped you off:** "predictable but temporary" spike → concurrency scaling + WLM tuning, not a permanent resize.

---

### Q35 — Existing Redshift cluster needs to join warehouse tables with S3 history
**Correct: B**

- **A. Athena, then manually merge with Redshift exports.** Wrong — clunky manual process when a native join option exists.
- **B. Redshift Spectrum external schema.** Correct — exactly Spectrum's use case: join existing warehouse tables to S3 data without loading it.
- **C. Load all 4 years into Redshift via `COPY`.** Wrong — contradicts "without loading the historical data into the cluster," and adds large storage cost.
- **D. Athena Federated Query connector to Redshift.** Wrong — unnecessarily inverts the relationship; Redshift already exists, so Spectrum is the native fit.

**Keyword that should have tipped you off:** "already operates a Redshift... cluster" + "join... without loading" → Spectrum.

---

### Q36 — Licensed third-party market data, no custom ingestion code
**Correct: B**

- **A. Lambda polling the provider's REST API.** Wrong — custom code to build and maintain, contradicting the requirement.
- **B. AWS Data Exchange subscription, landing in S3/Redshift.** Correct — purpose-built marketplace for licensed third-party data products delivered with no custom ingestion.
- **C. AppFlow as a generic SaaS connector.** Wrong — AppFlow connects to specific supported SaaS apps, not arbitrary licensed data-product providers.
- **D. DMS replicating from the provider's database.** Wrong — requires direct database access to a third party's system, which licensed data products don't offer.

**Keyword that should have tipped you off:** "third-party... dataset, licensed" + "without building... custom ingestion code" → AWS Data Exchange.

---

### Q37 — IAM allows, SCP explicitly denies
**Correct: B**

- **A. Identity policy takes precedence.** Wrong — an explicit deny anywhere in the evaluation chain always wins, no matter what an identity policy allows.
- **B. SCP's explicit deny overrides the allow.** Correct — this is the IAM evaluation order rule: explicit deny beats everything.
- **C. A permissions boundary allow would override the SCP.** Wrong — permissions boundaries cannot override an SCP deny.
- **D. A resource-based policy determines the outcome instead.** Wrong — an explicit deny anywhere, including an SCP, overrides any allow elsewhere.

**Keyword that should have tipped you off:** "explicit deny" + SCP → denied, full stop.

---

### Q38 — Kibana-style full-text search and log analytics dashboards
**Correct: A**

- **A. Amazon OpenSearch Service.** Correct — purpose-built for full-text search, aggregations, and Kibana-style dashboards.
- **B. Amazon Kendra.** Wrong — natural-language enterprise document search/Q&A, not a log-analytics/aggregation engine.
- **C. Athena with scheduled dashboard refresh.** Wrong — a weaker fit for near-real-time log search/visualization than a purpose-built engine.
- **D. Redshift with materialized views.** Wrong — not designed for full-text search or log-analytics-style dashboards.

**Keyword that should have tipped you off:** "full-text search," "similar to Kibana" → OpenSearch Service.

---

### Q39 — Identify which component in a distributed chain causes latency
**Correct: B**

- **A. CloudWatch Logs Insights across each log group.** Wrong — requires manually correlating timestamps across services; no end-to-end trace view.
- **B. AWS X-Ray.** Correct — traces requests end-to-end across API Gateway, Lambda, and Step Functions, pinpointing the slow segment.
- **C. CloudTrail.** Wrong — records who called what API, not per-request latency across a chain.
- **D. CloudWatch composite alarms.** Wrong — alarms notify on thresholds; they don't pinpoint which component caused latency.

**Keyword that should have tipped you off:** "identify exactly which component... is introducing... latency" → X-Ray.

---

### Q40 — Existing self-managed Kafka + Kafka Connect, migrate without rewriting
**Correct: B**

- **A. Kinesis Data Streams.** Wrong — not Kafka-wire-compatible; producers, consumers, and connectors would all need rewriting.
- **B. Amazon MSK + MSK Connect.** Correct — Kafka-API-compatible broker service, with MSK Connect supporting existing Kafka Connect connectors unchanged.
- **C. Amazon Data Firehose.** Wrong — not a Kafka-compatible platform; it's a single-destination delivery service.
- **D. Managed Service for Apache Flink.** Wrong — a stream *processing* engine, not a Kafka-compatible broker replacement.

**Keyword that should have tipped you off:** "existing Kafka," "Kafka Connect connectors... unchanged" → MSK.

---

### Q41 — 600 GB single gzipped file, slow `COPY` despite many slices
**Correct: A, B**

- **A. Split into files, ideally a multiple of slice count.** Correct — `COPY` parallelizes across slices by file; one giant file means one slice does all the work.
- **B. Compress each split file, 1 MB–1 GB range.** Correct — keeps files parallelizable and appropriately sized for efficient loading.
- **C. Individual `INSERT` statements instead of `COPY`.** Wrong — row-by-row inserts are dramatically slower than bulk `COPY`.
- **D. Increase sort key count.** Wrong — sort keys affect query performance, not `COPY` load parallelism.
- **E. Disable compression to reduce CPU overhead.** Wrong — increases I/O/network transfer significantly and doesn't fix the core one-file-one-slice bottleneck.

**Keyword that should have tipped you off:** "single large... file" + "many slices" idle → split into slice-aligned files.

---

### Q42 — Keep using Spark, no cluster management, pay only while running
**Correct: B**

- **A. EMR on EC2 with managed scaling.** Wrong — still an underlying cluster the team owns and configures, even with managed scaling.
- **B. EMR Serverless.** Correct — removes the cluster concept entirely while still running Spark as-is.
- **C. Rewrite as Glue DynamicFrames.** Wrong — requires rewriting existing Spark code, contradicting "keep using Spark."
- **D. Refactor into Lambda functions.** Wrong — Lambda's 15-minute/10 GB limits are a poor fit, and this requires a rewrite.

**Keyword that should have tipped you off:** "without... managing infrastructure" + existing Spark → EMR Serverless.

---

### Q43 — Thousands of tables, unmanageable per-table grants, need sensitivity-based access
**Correct: B**

- **A. Automate table-by-table grants with a script.** Wrong — still an object-by-object model; doesn't scale conceptually.
- **B. Lake Formation LF-Tags (TBAC).** Correct — attach tags by sensitivity, grant on tags instead of individual objects, scaling across thousands of tables.
- **C. Per-analyst IAM policy listing every table.** Wrong — IAM doesn't operate at Lake Formation's table-permission granularity, and doesn't scale either.
- **D. Merge all tables into one database, grant everyone access.** Wrong — eliminates the fine-grained, sensitivity-based control the requirement calls for.

**Keyword that should have tipped you off:** "sensitivity classifications... across many tables at once" → LF-Tags.

---

### Q44 — No-code exploration of a new supplier dataset before defining rules
**Correct: B**

- **A. Glue Data Quality with a DQDL ruleset.** Wrong — DQDL requires rules to already be known; this is the exploratory step before rules exist.
- **B. Glue DataBrew profiling.** Correct — purpose-built for no-code statistical profiling, distribution/outlier detection.
- **C. Athena with manual SQL queries.** Wrong — requires writing SQL/code, contradicting "without writing any code."
- **D. Amazon Macie.** Wrong — discovers sensitive/PII data, not general statistical profiling.

**Keyword that should have tipped you off:** "explore... without writing any code... before deciding what validation rules to build" → DataBrew profiling.

---

### Q45 — Runaway Athena query cost from a poorly written query, keep self-service
**Correct: B**

- **A. Revoke access except for senior staff.** Wrong — removes self-service access, which the requirement wants to keep.
- **B. Workgroup with a per-query data usage control.** Correct — a technical guardrail that caps data scanned per query without removing access.
- **C. Convert tables to CSV.** Wrong — unrelated and counterproductive; CSV is slower and more expensive to scan.
- **D. Peer review before running queries.** Wrong — a process control, not a reliable technical guardrail.

**Keyword that should have tipped you off:** "scanned petabytes... in a single run" + "without removing self-service" → workgroup data usage control.

---

### Q46 — Once-daily batch file, "future-proofed" with Glue Streaming, lowest cost
**Correct: B**

- **A. Glue Streaming job continuously polling.** Wrong — bills continuously (DPU-hours never stop), wasteful for once-daily data.
- **B. Scheduled Glue batch job (optionally Flex).** Correct — matches the actual batch cadence at the lowest cost.
- **C. Managed Flink watching for the file.** Wrong — an always-on stream processor for a once-daily file is unnecessary cost and complexity.
- **D. MSK with a daily topic.** Wrong — introduces a Kafka cluster for a simple daily file transfer; large overkill.

**Keyword that should have tipped you off:** "once per day" + "lowest-cost" → scheduled batch, not streaming.

---

### Q47 — Microsecond leaderboard reads, minimal app changes
**Correct: B**

- **A. Increase provisioned read capacity.** Wrong — addresses throughput/throttling, not latency; reads stay in the single-digit-millisecond range.
- **B. DynamoDB Accelerator (DAX).** Correct — purpose-built microsecond caching layer, largely transparent to existing DynamoDB API calls.
- **C. ElastiCache with manual invalidation.** Wrong — works, but requires building custom cache-invalidation logic — more operational overhead than DAX.
- **D. On-demand capacity mode.** Wrong — changes billing/scaling model, not read latency.

**Keyword that should have tipped you off:** "microseconds... without changing application read logic significantly" → DAX.

---

### Q48 — Org-wide, unbypassable guarantee that CloudTrail can never be disabled
**Correct: B**

- **A. IAM deny policy on every role.** Wrong — must be applied and maintained per role, and a sufficiently privileged principal could still remove it.
- **B. SCP at the OU level.** Correct — an organization-wide guardrail that no principal within the OU can bypass, regardless of their individual IAM permissions.
- **C. AWS Config detection + alert.** Wrong — a detective control after the fact, not a preventive guarantee.
- **D. Single break-glass admin user.** Wrong — still relies on trusting/managing individual credentials, not an unbypassable guardrail.

**Keyword that should have tipped you off:** "regardless of what permissions are granted" → SCP, not IAM.

---

### Q49 — Retries causing duplicate payment writes
**Correct: B**

- **A. Reduce retry count.** Wrong — trades duplicates for potential data loss; doesn't fix the root cause.
- **B. Make the write idempotent (dedup key / conditional write).** Correct — the standard fix for at-least-once delivery plus retries.
- **C. Switch to Firehose for "exactly-once."** Wrong — Firehose provides at-least-once delivery, not exactly-once; this claim is false.
- **D. Disable retries entirely.** Wrong — removes the safety net; a single transient failure now causes permanent data loss instead of a duplicate.

**Keyword that should have tipped you off:** "retries" + "written twice" → idempotency, not fewer retries.

---

### Q50 — Hot Kinesis shard from a handful of high-volume devices
**Correct: A, B**

- **A. Split the hot shards.** Correct — directly increases capacity for the overloaded key ranges.
- **B. Add entropy/suffix to the partition key for high-volume devices.** Correct — spreads their events across more shards, addressing the root cause of the skew.
- **C. Increase retention to 365 days.** Wrong — retention affects replay window, not per-shard write throughput distribution.
- **D. Switch all consumers to enhanced fan-out.** Wrong — EFO addresses consumer read throughput, not producer-side write throttling.
- **E. Move to on-demand mode.** Wrong — scales overall stream capacity, but doesn't fix skew caused by a poorly distributed partition key; a small number of overloaded key ranges can still throttle.

**Keyword that should have tipped you off:** "concentrated on a small number of shards" from "a handful of devices" → hot key, needs entropy + split.

---

### Q51 — 10-year archive, lowest cost, but same-day retrieval sometimes required
**Correct: B**

- **A. Glacier Deep Archive for everything.** Wrong — standard retrieval is up to 12 hours (bulk up to 48), which can miss same-day turnaround; the 180-day minimum also adds inflexibility.
- **B. Glacier Flexible Retrieval, expedited tier when needed.** Correct — expedited retrieval (1–5 minutes) comfortably meets same-day requests while keeping long-term storage cheap.
- **C. Standard-IA for all 10 years.** Wrong — far more expensive long-term than a Glacier tier for data rarely accessed.
- **D. Intelligent-Tiering.** Wrong — this isn't an unknown/changing access pattern problem; it's "archive cheaply, retrieve fast occasionally," which Flexible Retrieval's expedited tier directly addresses.

**Keyword that should have tipped you off:** "lowest possible storage cost" + "same-day turnaround" → Flexible Retrieval, not Deep Archive.

---

### Q52 — Dozens of partners, inconsistent and drifting schemas
**Correct: B**

- **A. Fixed-schema Spark DataFrame.** Wrong — requires a known, fixed schema; inconsistent/missing fields across files would cause failures or data loss.
- **B. Glue DynamicFrame + `resolveChoice`.** Correct — purpose-built for handling schema inconsistency and drift gracefully.
- **C. Reject non-conforming files.** Wrong — would reject most legitimate partner files given known variability.
- **D. Force-flatten everything to CSV.** Wrong — doesn't resolve type/field mismatches, and strips useful structure.

**Keyword that should have tipped you off:** "slightly different and inconsistent schemas... that change over time" → DynamicFrame + `resolveChoice`.

---

### Q53 — True WORM against every principal, including root/admins
**Correct: B**

- **A. Versioning + IAM policies.** Wrong — IAM policies can be changed by sufficiently privileged users; no true WORM guarantee.
- **B. Object Lock, compliance mode.** Correct — the only mode no one, including the root user, can override or shorten.
- **C. Object Lock, governance mode.** Wrong — can still be overridden by users with `s3:BypassGovernanceRetention` permission.
- **D. MFA Delete.** Wrong — adds a second factor for deletion/versioning changes, but doesn't create true immutability against privileged users.

**Keyword that should have tipped you off:** "cannot be deleted... by any user, including... administrators" → compliance mode, not governance mode.

---

### Q54 — Same daily 30-minute Redshift concurrency spike at 9 AM
**Correct: B**

- **A. Permanently resize for the peak.** Wrong — pays for peak-sized capacity all day for a 30-minute daily spike.
- **B. Concurrency scaling.** Correct — adds transient capacity automatically only during the spike.
- **C. Ask managers to stagger logins.** Wrong — a process workaround outside the team's technical control, not reliable.
- **D. Migrate all reporting to Athena.** Wrong — a much larger architectural change than the transient-spike problem requires, and Athena has its own concurrency quotas.

**Keyword that should have tipped you off:** "every day at 9 AM... for about 30 minutes" → concurrency scaling.

---

### Q55 — Immediate alert on any nightly Glue job failure, no polling/custom code
**Correct: B**

- **A. Lambda polling the Glue API every minute.** Wrong — custom polling code is unnecessary when Glue emits state-change events natively.
- **B. EventBridge rule on Glue "FAILED" state → SNS.** Correct — Glue emits job state-change events; routing FAILED to SNS via EventBridge needs no custom code.
- **C. CloudWatch detailed monitoring.** Wrong — provides more granular metrics; doesn't itself send failure notifications.
- **D. AWS Config evaluating Glue job compliance.** Wrong — Config evaluates resource configuration state, not job run failures.

**Keyword that should have tipped you off:** "immediately... without polling... or building custom monitoring code" → EventBridge rule → SNS.

---

### Q56 — 400 TB one-time migration, limited/unreliable bandwidth
**Correct: B**

- **A. AWS DataSync over the existing connection.** Wrong — still bound by the limited/unreliable bandwidth; 400 TB could take far too long or fail repeatedly.
- **B. Snowball Edge device.** Correct — the classic offline bulk-transfer answer for large data over constrained connectivity.
- **C. Transfer Family SFTP.** Wrong — still constrained by the same bandwidth, and it's built for ongoing partner exchange, not bulk one-time offline transfer.
- **D. Console upload over several weeks.** Wrong — unreliable and impractical at 400 TB, with no resilience to interruption.

**Keyword that should have tipped you off:** "400 TB" + "limited, unreliable" bandwidth → Snowball Edge.

---

### Q57 — Six-months-old table needs a strongly consistent index by `call_type`
**Correct: C**

- **A. Add an LSI to the existing table.** Wrong — LSIs can only be created at table creation time, not added afterward.
- **B. Add a GSI for `call_type`.** Wrong — as the sole answer this fails, since GSIs only support eventual consistency, not the strong consistency required.
- **C. Recreate the table with the LSI defined at creation, migrate the data.** Correct — the only way to obtain an LSI (and its strong-consistency support) after the fact.
- **D. DynamoDB Streams building a materialized secondary table.** Wrong — far more operational overhead than simply recreating the table with a correctly defined LSI.

**Keyword that should have tipped you off:** "strong read consistency" + index added after table creation → must recreate for an LSI.

---

### Q58 — Process 50,000 existing S3 files in parallel with built-in per-item retry
**Correct: A, B**

- **A. Step Functions Distributed Map over the S3 objects.** Correct — purpose-built for large-scale, parallel iteration over S3 objects.
- **B. Distributed Map's built-in Catch/Retry per item.** Correct — provides per-item retry/error handling without custom code.
- **C. A single Lambda looping through all 50,000 objects.** Wrong — hits Lambda's 15-minute limit long before finishing, with no real parallelism.
- **D. EventBridge invoking a Lambda per new object.** Wrong — doesn't fit a "process 50,000 existing files" batch scenario, and provides no centralized retry/parallelism.
- **E. Express workflows without Distributed Map.** Wrong — Express alone doesn't provide Distributed Map's built-in large-scale S3 iteration and per-item retry semantics.

**Keyword that should have tipped you off:** "50,000... files already sitting in S3" + "built-in retry... per file" + "in parallel" → Distributed Map.

---

### Q59 — Mandate for two independent encryption layers at rest
**Correct: C**

- **A. SSE-S3.** Wrong — a single layer of AES-256 encryption with AWS-managed keys.
- **B. SSE-KMS with a customer-managed key.** Wrong — still a single layer of encryption, even with more control and auditability.
- **C. DSSE-KMS (dual-layer server-side encryption).** Correct — provides exactly the two independent encryption layers the mandate requires.
- **D. Client-side encryption only.** Wrong — a single layer (client-side), with no server-side layer enabled.

**Keyword that should have tipped you off:** "two independent layers of encryption" → DSSE-KMS, by definition.

---

### Q60 — Retry a flaky API call with backoff, escalate to human review after repeated failures
**Correct: B**

- **A. Try/except in the invoking Lambda.** Wrong — Step Functions state machines aren't wrapped this way, and it doesn't give per-step retry/backoff or a workflow-visible escalation path.
- **B. `Retry` with exponential backoff + `Catch` routing to a human-review state.** Correct — exactly the native Step Functions mechanism for this pattern.
- **C. Switch to Express to reduce timeout sensitivity.** Wrong — changes execution semantics/cost, not retry/backoff/error-routing behavior.
- **D. Have the Lambda loop and retry internally.** Wrong — works around the platform's native Retry/Catch instead of using it, and hides the escalation path from the visible workflow.

**Keyword that should have tipped you off:** "automatically retry... with exponential backoff" + "escalate... after repeated failures" → `Retry` + `Catch`.

---

### Q61 — Natural-language Q&A over internal policy PDFs
**Correct: B**

- **A. OpenSearch with a custom full-text index.** Wrong — keyword/full-text search requires significant extra work to approximate natural-language question answering.
- **B. Amazon Kendra.** Correct — purpose-built enterprise search that answers natural-language questions and highlights relevant passages, distinct from keyword search or vector search.
- **C. Athena with full-text extensions over converted text.** Wrong — Athena is a SQL query engine over structured/semi-structured data, not a document QA service.
- **D. Amazon Macie.** Wrong — discovers sensitive data; no search or question-answering capability.

**Keyword that should have tipped you off:** "natural-language questions... direct answers or highlighted passages" → Kendra.

---

### Q62 — AI coding assistant for Glue PySpark, in the IDE
**Correct: A**

- **A. Amazon Q Developer.** Correct — an in-IDE AI assistant for generating/explaining code, fixing errors, and answering AWS service questions.
- **B. Amazon Q in QuickSight.** Wrong — a natural-language BI/dashboard-question feature, not an IDE coding assistant.
- **C. Amazon Kendra.** Wrong — enterprise document search, not code generation.
- **D. Amazon CodeGuru Reviewer.** Wrong — automated code review recommendations on existing code/PRs, not an interactive IDE chat assistant that generates code conversationally.

**Keyword that should have tipped you off:** "AI coding assistant integrated into their IDE" → Amazon Q Developer.

---

### Q63 — Row-level, no-copy cross-account sharing of a shared claims table
**Correct: B**

- **A. Copy filtered subsets nightly into each account.** Wrong — requires data duplication and ongoing sync, contradicting "without copying the data."
- **B. Lake Formation cross-account sharing via RAM + row-level data filter.** Correct — shares the catalog resource without copying data, filtered per subsidiary at the row level.
- **C. Direct IAM `s3:GetObject` grants to each account.** Wrong — IAM/S3 policies can't express row-level filtering; would need duplicated data or expose all rows.
- **D. VPC peering between the accounts.** Wrong — addresses network connectivity, not data-access permissions or row-level filtering.

**Keyword that should have tipped you off:** "only see rows... belonging to their own subsidiary" + "without copying" → Lake Formation + RAM data filter.

---

### Q64 — Hot DynamoDB partition from a few extremely popular items
**Correct: A, B**

- **A. Add entropy/suffix to the partition key for high-traffic items.** Correct — spreads their data across more physical partitions, addressing the root skew.
- **B. Cache hot items with DAX.** Correct — absorbs repeated reads without hitting the table's physical partitions directly.
- **C. Switch to provisioned capacity.** Wrong — doesn't address key-design skew; provisioned mode can throttle just as easily on a hot partition.
- **D. Increase GSI count.** Wrong — doesn't address base-table hot-partition skew, and adds cost/complexity.
- **E. Enable point-in-time recovery.** Wrong — a backup/restore feature, unrelated to throttling or partition distribution.

**Keyword that should have tipped you off:** "disproportionate share... specific items" while "overall consumed capacity looks unremarkable" → hot partition, needs key entropy + caching.

---

### Q65 — New S3 lake table: streaming upserts, ACID, time travel, broad AWS support, no Databricks lock-in
**Correct: C**

- **A. Apache Hudi.** Wrong — capable of streaming upserts, but narrower native support across the AWS query-engine stack (especially Redshift) compared to Iceberg.
- **B. Delta Lake.** Wrong — a strong feature set, but Databricks-centric with less broad native AWS integration.
- **C. Apache Iceberg.** Correct — AWS's default modern table format, with the broadest native support across Athena, Glue, EMR, and Redshift.
- **D. Plain Hive-style Parquet.** Wrong — no ACID transactions, no time travel, and limited schema evolution — none of the stated requirements are met.

**Keyword that should have tipped you off:** "broad... support across Athena, Glue, EMR, and Redshift, without... a Databricks-centric toolchain" → Iceberg.
