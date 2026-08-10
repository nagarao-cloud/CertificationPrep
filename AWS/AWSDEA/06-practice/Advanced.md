# Advanced Practice — DEA-C01 (25 questions)

> **Level:** hard, multi-constraint scenarios. Every stem has **two or
> more competing requirements**, and getting the right answer means
> correctly deciding which constraint dominates — not just recognizing
> a service from a keyword. Per Part 0 of
> `00-START-HERE/SERVICE-SELECTION-MATRIX.md`: "least operational
> overhead" usually outranks "lowest cost," but not always, and several
> questions below deliberately test the exception.
>
> **Domain split, skewed toward Domain 1 and 2** (hardest domains at
> this level): Domain 1 — 9 · Domain 2 — 7 · Domain 3 — 5 · Domain 4 — 4.
>
> Each explanation includes a **"Why this is hard"** note naming the
> decoy constraint — the requirement that looks dominant but isn't.
>
> Part 1 is questions only. Part 2 is the answer key with full
> explanations. Work all 25 before checking Part 2.

---

## Part 1 — Questions

**Q1.** A logistics company already runs a large, mission-critical Apache Kafka deployment on EC2, with dozens of existing Kafka Connect connectors it cannot rewrite. A new requirement asks for a durable, replayable event log AND a fully managed Confluent-compatible schema registry with automatic schema compatibility checking, with the lowest possible new infrastructure to operate.

A. Migrate everything to Kinesis Data Streams with a self-hosted schema registry on EC2.
B. Move to Amazon MSK, keep the existing Kafka Connect connectors via MSK Connect, and use AWS Glue Schema Registry for schema management.
C. Keep Kafka on EC2 as-is and add a self-managed Confluent Schema Registry cluster alongside it.
D. Replace Kafka entirely with Amazon Data Firehose and drop the schema registry requirement.

---

**Q2.** A stock-trading platform ingests order events that three independent internal systems (settlement, compliance, and risk) must each consume in full, with strict guarantees against data loss, and compliance must be able to reprocess any of the last 14 days after a rule change. Leadership also asked for "the most cost-effective option that meets these needs."

A. Amazon Data Firehose with three delivery streams, since "near real-time" phrasing usually means Firehose is cheapest.
B. Kinesis Data Streams with 14+ day retention and enhanced fan-out for each of the three consumers.
C. Kinesis Data Streams with standard (shared) throughput across all three consumers to minimize enhanced fan-out cost.
D. SQS Standard with three separate queues fed by a custom fan-out Lambda.

---

**Q3.** A retailer's nightly Glue Flex job normally finishes well within its window, but the finance team has now added a hard downstream SLA: the curated sales table must be ready by 5:00 AM every day without exception, and the job must also stay as cheap as possible.

A. Keep using Glue Flex execution class, since it's the cheapest option and usually finishes on time.
B. Switch the job to standard (non-Flex) Glue execution to guarantee predictable start time and meet the hard SLA, accepting the higher cost.
C. Move the job to AWS Lambda to reduce cost further.
D. Run the job on EMR with 100% Spot Instances across all node types to minimize cost.

---

**Q4.** A hospital system must migrate an on-premises Oracle database — including stored procedures — to Aurora PostgreSQL. The hospital's compliance policy forbids any planned downtime for this system, which serves live patient care 24/7, and the DBA team has never used AWS migration tooling before, so they also want the least operationally complex path.

A. Manually script the schema conversion, then run a DMS full-load-only task during a brief night-time maintenance window.
B. Use DMS Schema Conversion to convert schema and stored procedures, then run a DMS task with full load + CDC, cutting over only after CDC catches up to near-zero lag.
C. Use AWS Glue to extract from Oracle via JDBC nightly until the team is ready to cut over.
D. Use AWS SCT as a standalone tool to both convert the schema and continuously replicate data indefinitely, avoiding DMS entirely.

---

**Q5.** A media company's clickstream pipeline description says "near real-time is fine," which usually points straight to Firehose. But the same requirement also states that three separate downstream teams need full independent access to the raw event stream, and one of those teams performs stateful session-window aggregation that must survive to replay 48 hours of history after a bug fix.

A. Amazon Data Firehose with three delivery streams, since "near real-time" is stated explicitly.
B. Kinesis Data Streams with 48+ hour retention, enhanced fan-out for the three consumers, and Managed Service for Apache Flink performing the session-window aggregation for the team that needs it.
C. Amazon Data Firehose feeding a single S3 location, with each of the three teams running independent Athena queries against it.
D. Amazon MSK, since Kafka is always the safest choice when multiple consumers are involved.

---

**Q6.** An airline wants to modernize by moving order data from Aurora MySQL into both Amazon Redshift (for BI) and Amazon S3 (for its data lake, consumed by Spark ML jobs), with the least possible custom pipeline code and the lowest possible replication lag for both destinations.

A. A single zero-ETL integration from Aurora MySQL, since zero-ETL is "the least operational overhead" answer whenever it's available.
B. A zero-ETL integration from Aurora MySQL to Redshift for BI, plus a separate AWS DMS CDC task (or Aurora S3 export/CDC to S3) for the data lake, since zero-ETL to Redshift does not also deliver to S3.
C. A single AWS Glue JDBC job run every 5 minutes to populate both destinations.
D. AWS DMS targeting only Redshift, since DMS can fan data out to S3 automatically as a side effect.

---

**Q7.** A payments company has most telemetry that can tolerate ~60 seconds of latency, but a small, well-defined subset of "high-risk transaction" events must be scored for fraud in under 300 ms. The team has a strict monthly budget cap and does not want to pay Kinesis-level pricing for 100% of its traffic just to serve the small high-risk subset.

A. Route 100% of events through Kinesis Data Streams with enhanced fan-out to guarantee the SLA is always met.
B. Route 100% of events through Amazon Data Firehose, since it's cheapest, and accept that the fraud SLA will occasionally be missed.
C. Split the pipeline: route the high-risk event subset through Kinesis Data Streams for sub-second scoring, and route the remaining bulk telemetry through Amazon Data Firehose for cost-effective near-real-time delivery.
D. Route all events through Amazon MSK, since Kafka can theoretically satisfy both latency tiers with enough tuning.

---

**Q8.** An automotive supplier runs an on-premises Kafka Connect cluster with several custom-built connectors that cannot be modified, streaming sensor data whose schema evolves frequently as new sensor firmware ships. The team needs schema compatibility to be enforced automatically so an incompatible producer change fails fast instead of silently corrupting downstream consumers, while keeping the existing connectors unchanged.

A. Migrate to Kinesis Data Streams and rewrite the connectors as Lambda consumers, adding manual schema validation code.
B. Move to Amazon MSK with MSK Connect running the existing connectors unmodified, paired with AWS Glue Schema Registry enforcing compatibility rules.
C. Keep Kafka on EC2 and manually review every schema change in a pull request before deployment.
D. Switch to Amazon Data Firehose with schema-on-read at query time, deferring compatibility checks to Athena.

---

**Q9.** A manufacturer needs to load 50 TB of nightly sensor aggregates into its data lake. The team's top priority, stated explicitly by finance, is "the lowest possible compute cost." However, downstream financial close processes have a hard, contractually-bound requirement that the data must be available by 4:00 AM with no exceptions.

A. AWS Glue with the Flex execution class, because Flex is unambiguously the cheapest Glue option.
B. Amazon EMR sized with On-Demand primary/core nodes and Spot Instances on task nodes only, right-sized so the job reliably completes before 4:00 AM even with occasional Spot interruptions.
C. AWS Lambda, split across many short invocations, since Lambda has no idle cost.
D. Amazon EMR with 100% Spot Instances across every node type to minimize cost as much as possible.

---

**Q10.** A retail data lake receives continuous streaming upserts from a CDC pipeline into a table that must support ACID transactions, time travel, and schema evolution, be broadly queryable from Athena, Glue, EMR, and Redshift, and require the absolute least ongoing engineering effort for file compaction, snapshot expiration, and orphan-file cleanup.

A. A plain Hive-style partitioned Parquet table with a nightly Glue compaction job maintained by the team.
B. An Apache Iceberg table on a standard S3 bucket, with the team scheduling and maintaining their own compaction and snapshot-expiration Glue jobs.
C. Amazon S3 Tables, providing Iceberg-native storage with automatic compaction, snapshot management, and cleanup, with broad engine compatibility and no maintenance jobs to build.
D. Delta Lake tables queried through a Databricks-managed cluster.

---

**Q11.** A subscription analytics company has ~500 concurrent BI users running complex joins during business hours on weekdays, and near-zero usage nights and weekends. Leadership wants both minimal idle cost and no manual capacity planning, but is skeptical that any serverless warehouse can really handle 500 concurrent complex-join users well.

A. Amazon Athena, since it has zero idle cost and requires no capacity planning at all.
B. A provisioned Redshift cluster sized for 500 users, running 24/7, to guarantee consistent performance.
C. Amazon Redshift Serverless, which auto-scales RPUs to the concurrent business-hours load and scales to near-zero cost during nights and weekends, avoiding both idle cost and manual capacity planning.
D. A provisioned Redshift cluster with Reserved Instances, since RIs are always the cheapest option for a warehouse.

---

**Q12.** A telecom's DynamoDB table was designed with `subscriber_id` as the partition key. A new fraud-detection pattern needs strongly consistent lookups of a subscriber's records by `device_imei`, a requirement that only emerged after 18 months in production. Separately, monitoring shows one specific subscriber (a corporate account with thousands of devices) is causing throttling on a small subset of partitions despite the table's overall metrics looking healthy.

A. Add a Local Secondary Index for `device_imei`, and increase overall table-level provisioned capacity to fix the throttling.
B. Add a Global Secondary Index for `device_imei` (accepting eventual consistency, since LSIs can no longer be created on this table), and address the throttling by adding write-sharding (a calculated suffix) specifically for the high-traffic corporate account's key.
C. Recreate the entire table with an LSI defined for `device_imei` to get strong consistency, and switch the whole table to on-demand mode to fix throttling.
D. Use a `Scan` with a filter for `device_imei" lookups, and ignore the throttling since overall metrics are healthy.

---

**Q13.** A compliance team needs a data lake table where old, individual customer records can be deleted (for GDPR right-to-be-forgotten requests) without rewriting the entire dataset, while the same table is also ingesting high-volume streaming upserts every few seconds from a CDC source, and must remain natively queryable from Athena, Redshift, and EMR without a proprietary runtime.

A. Delta Lake, because it is the most mature open table format for row-level deletes.
B. Apache Hudi, because it was purpose-built around record-level upserts specifically.
C. Apache Iceberg, using its row-level delete and streaming upsert support, because it avoids the Databricks-centric tooling of Delta Lake while still offering first-class support across Athena, Glue, EMR, and Redshift.
D. A plain partitioned Parquet table with a monthly full-rewrite job to purge deleted customers.

---

**Q14.** A bank's Redshift cluster carries a steady 24/7 baseline reporting load sized to its Reserved Instance commitment, but once a quarter the risk team runs a one-off historical stress-test query needing far more temporary compute than the baseline cluster provides, and the budget explicitly forbids a permanent capacity increase.

A. Permanently resize the cluster upward to accommodate the quarterly stress test.
B. Use elastic resize or concurrency scaling to add transient additional capacity only during the quarterly stress test, then return to baseline.
C. Cancel the Reserved Instance commitment and switch entirely to On-Demand pricing so the cluster can flex freely.
D. Run the quarterly stress test on the same fixed-size cluster during business hours, accepting slower performance for everyone else that day.

---

**Q15.** A logistics company keeps 6 years of shipment-event history and needs both (1) the ability to join this archive against live Redshift warehouse tables for BI, and (2) the ability to query the archive exactly as it existed at a specific past date for a legal audit, without loading the full archive into the cluster.

A. Load all 6 years into Redshift with `COPY` so both requirements are trivially satisfied.
B. Use Redshift Spectrum to query an Apache Iceberg table in S3, since Spectrum can query Iceberg tables directly — satisfying the join requirement via Spectrum and the point-in-time requirement via Iceberg's snapshot/time-travel feature.
C. Use plain Redshift Spectrum over Hive-style partitioned Parquet, since Spectrum alone satisfies both requirements.
D. Export the Redshift warehouse tables to S3 nightly and query everything with Athena instead.

---

**Q16.** A gaming company's DynamoDB table uses a high-cardinality composite key, yet a single celebrity streamer's item is now receiving disproportionate reads and writes during live events, causing throttling on that item's partition specifically, while the application's read/write code cannot be substantially rewritten on short notice.

A. Switch the whole table from provisioned to on-demand mode, since on-demand automatically rebalances any hot key.
B. Add DAX in front of the table to absorb the repeated hot-item reads, and apply a small amount of write sharding (a deterministic suffix) specifically for that one item's writes, without changing the read/write logic for every other item.
C. Increase the table's overall provisioned RCU/WCU significantly across all items.
D. Add a Global Secondary Index to spread the hot item's traffic automatically.

---

**Q17.** A consumer-goods company needs an orchestration layer where a small set of critical, revenue-impacting workflows require a full 90-day queryable audit history for compliance review, while a much larger volume — millions of short, low-stakes per-event validation executions daily — needs the cheapest possible per-execution cost and has no audit-history requirement at all.

A. Run everything on Step Functions Standard, since a single consistent workflow type is simpler to operate.
B. Run everything on Step Functions Express, since it's cheaper at high volume and audit history isn't required for most executions.
C. Run the critical, audited workflows on Step Functions Standard, and run the high-volume, low-stakes validation executions on Step Functions Express, matching each workload to the engine suited for it.
D. Move all orchestration to Amazon MWAA, since Airflow can technically express any of these workflows.

---

**Q18.** A retail chain's Redshift cluster has a predictable heavy spike every month during close, and separately, analysts also trigger random, unpredictable heavy ad-hoc investigative queries throughout the month whenever an anomaly is flagged. The team wants both patterns handled without permanently over-provisioning the cluster.

A. Permanently resize the cluster to comfortably absorb the worst combined case of both patterns.
B. Enable concurrency scaling (covering both the predictable monthly spike and the unpredictable ad-hoc bursts) combined with well-tuned WLM queues so ad-hoc queries don't starve routine reporting.
C. Address only the predictable monthly spike with concurrency scaling, and tell analysts to avoid ad-hoc queries during busy periods.
D. Move all ad-hoc investigative querying to a second, separately provisioned Redshift cluster running 24/7.

---

**Q19.** A retailer's data platform team wants Glue job failures to page on-call within seconds, but the current EventBridge rule fires an alert on every single `FAILED` state transition — including transient failures that Glue's own built-in job retry configuration successfully resolves on the next attempt — and on-call is now suffering alert fatigue from pages that self-resolve.

A. Remove the EventBridge rule entirely and have the team check the Glue console manually each morning.
B. Configure the Glue job's built-in retry setting appropriately, and scope the EventBridge rule/alert to fire only after the job's configured retries are exhausted (i.e., final failure), rather than on every individual attempt.
C. Increase the SNS topic's message batching window so fewer notifications are sent, regardless of whether the underlying failure was transient.
D. Disable Glue's built-in retry mechanism entirely so every failure pages immediately and clearly.

---

**Q20.** A government agency gives broad self-service Athena access to hundreds of analysts, and last quarter an intern's query drove an unexpectedly large bill. However, the agency's executive oversight team also has a legitimate, occasional need to run very large historical queries without being capped by the same limit imposed on everyone else.

A. Apply one Athena workgroup with one data-usage limit low enough to prevent runaway costs, applying it uniformly to everyone including the executive team.
B. Create a standard workgroup with a conservative per-query data-usage limit for general analysts, and a separate workgroup with a higher or no limit for the executive oversight team, governed by workgroup-level IAM permissions.
C. Remove Athena access from all analysts except the executive team.
D. Rely on manual after-the-fact bill review with no preventive controls, since any limit would inconvenience the executive team.

---

**Q21.** A healthcare company's microservices architecture spans dozens of Lambda functions handling millions of requests per day. The team needs end-to-end distributed tracing to diagnose intermittent latency, but is also under strict cost pressure and doesn't want tracing overhead and cost scaling linearly with every single one of those millions of daily requests.

A. Enable AWS X-Ray with 100% request sampling to guarantee no problem is ever missed.
B. Enable AWS X-Ray with a sampling rule capturing a representative percentage of requests (with a higher fixed rate for error responses), balancing visibility against cost/overhead at high volume.
C. Skip X-Ray entirely and rely only on CloudWatch Logs Insights queries across each function's log group.
D. Enable X-Ray only on the single Lambda function that has been slowest historically, ignoring the rest of the request chain.

---

**Q22.** A bank shares Lake Formation-governed, KMS-encrypted tables with a partner organization's AWS account for a joint fraud-analytics project. The bank's data governance policy requires that (1) the partner must not be able to further re-share the data with any other account, and (2) every access must be centrally auditable from the bank's own account, without duplicating the underlying data.

A. Add the partner account's principal directly to the S3 bucket policy and the KMS key policy with `s3:GetObject` and `kms:Decrypt`.
B. Use Lake Formation cross-account grants (via AWS RAM) scoped to the specific table/columns needed, which are non-re-shareable by default and centrally auditable through Lake Formation's own permission model, combined with a scoped KMS key policy grant.
C. Create a cross-account IAM role in the partner's account with `s3:*` and `kms:*` on the resources, and trust the partner to self-govern re-sharing.
D. Copy the relevant data into a new S3 bucket in the partner's own account so they have full local control.

---

**Q23.** A bank's security team needs an SCP that blocks `iam:CreateAccessKey` and `iam:DeleteAccessKey` for every principal across an entire OU to prevent long-lived credential creation — except that a specific, tightly-controlled "break-glass" incident-response role must retain the ability to perform these actions during a declared emergency.

A. Attach an SCP at the OU level with a blanket explicit deny on both actions, with no exceptions, since SCPs cannot express conditional exceptions.
B. Attach an SCP at the OU level denying both actions, with a condition that excludes the specific break-glass role's ARN (e.g., via an `ArnNotLike` / `StringNotEquals` condition on the principal), so the deny applies to everyone except that named role.
C. Skip the SCP and instead rely only on an identity-based policy granting the break-glass role the actions, while informally asking other teams not to use them.
D. Attach the SCP, then separately grant `AdministratorAccess` to the break-glass role so it overrides the SCP.

---

**Q24.** A defense contractor's compliance mandate requires two independent layers of encryption at rest for a specific S3 dataset, and separately requires that the encryption keys be customer-controlled, with rotation and access fully auditable by the contractor — not just by AWS.

A. Enable SSE-S3, which already encrypts all objects by default, satisfying the mandate with no further action.
B. Use Dual-layer server-side encryption with KMS keys (DSSE-KMS), using a customer-managed KMS key so key rotation and access are both customer-controlled and auditable via CloudTrail/KMS key policy.
C. Use SSE-KMS with an AWS-managed key, since KMS always provides two layers of encryption internally.
D. Use client-side encryption only, with server-side encryption disabled, since client-side encryption is inherently "double" encryption.

---

**Q25.** An insurance holding company's shared data lake spans thousands of tables across dozens of databases, growing weekly, shared across many subsidiary accounts. The team needs (1) sensitivity-based access control that scales without per-table grants as new tables are added, and (2) specific subsidiaries restricted to only their own rows within certain shared tables — both with minimal ongoing administrative overhead as the catalog keeps growing.

A. Continue granting Lake Formation permissions table-by-table for every subsidiary as new tables appear, accepting the growing administrative burden.
B. Use Lake Formation LF-Tags (tag-based access control) to grant sensitivity-based access that automatically covers new tables tagged appropriately, combined with named row-level data filters for the subsidiary-specific row restrictions on the relevant shared tables.
C. Create one IAM policy per subsidiary manually listing every table and row condition, updated whenever the catalog changes.
D. Move every subsidiary's data into fully separate, physically isolated databases to avoid needing fine-grained permissions at all.

---

## Part 2 — Answer Key & Explanations

### Q1 — Correct: B
- **A. Kinesis + self-hosted registry.** Wrong — abandons the existing Kafka Connect connectors entirely (a rewrite), and self-hosting a registry on EC2 is more infrastructure, not less.
- **B. MSK + MSK Connect + Glue Schema Registry.** Correct — MSK Connect runs the existing connectors unmodified (Kafka-protocol compatible), and Glue Schema Registry is AWS's fully managed, no-infrastructure schema registry with compatibility enforcement — satisfying both the "don't rewrite connectors" and "lowest new infrastructure" constraints simultaneously.
- **C. Self-managed Confluent Schema Registry alongside existing Kafka.** Wrong — adds a new cluster to operate, directly violating "lowest possible new infrastructure."
- **D. Replace with Firehose, drop the schema registry requirement.** Wrong — abandons a stated hard requirement rather than satisfying it.
- **Why this is hard:** the "existing Kafka Connect connectors" pull toward MSK, but the "fully managed schema registry" pull could tempt a self-hosted Confluent registry (familiar name) over the AWS-native Glue Schema Registry. The decoy is assuming schema registry choice is independent from the "lowest new infrastructure" constraint — it isn't.

### Q2 — Correct: B
- **A. Firehose, three delivery streams.** Wrong — Firehose has no replay capability at all; "reprocess any of the last 14 days" is impossible with Firehose regardless of cost.
- **B. Kinesis Data Streams, 14+ day retention, EFO for all three.** Correct — all three systems need independent full-throughput access ("each consume in full") and the compliance team needs replay — EFO is required because three consumers sharing standard 2 MB/s/shard would bottleneck each other; this is the configuration that actually satisfies every stated requirement, making it "most cost-effective" in the sense of the cheapest option that still meets them all.
- **C. Kinesis with shared standard throughput to save EFO cost.** Wrong — three consumers is exactly the size where standard fan-out throughput (2 MB/s shared) becomes a bottleneck; saving EFO cost here risks failing the "each consume in full" requirement.
- **D. SQS + custom fan-out Lambda.** Wrong — no native multi-day replay, and custom fan-out code is unnecessary engineering overhead.
- **Why this is hard:** "most cost-effective" is a decoy that tempts picking the cheapest-sounding option (A or C) without checking it still satisfies every hard requirement first. Cost-effectiveness only applies among options that actually meet the bar — Firehose and shared-throughput Kinesis don't.

### Q3 — Correct: B
- **A. Keep Glue Flex.** Wrong — Flex explicitly trades a variable, non-guaranteed start time for lower cost; "must be ready by 5:00 AM without exception" is a hard SLA that Flex cannot guarantee.
- **B. Switch to standard Glue execution.** Correct — once the SLA became "hard... without exception," predictability must dominate cost; standard execution guarantees prompt start, satisfying the non-negotiable deadline even at higher cost.
- **C. Move to Lambda.** Wrong — doesn't address the SLA risk and introduces the 15-minute runtime ceiling as a new failure mode for what's presumably a substantial nightly job.
- **D. EMR with 100% Spot across all nodes.** Wrong — Spot instances can be interrupted at any time; running Spot on every node type (including primary/core) risks losing the whole cluster mid-run, the opposite of SLA reliability.
- **Why this is hard:** the scenario is explicitly built to look like a "lowest cost" question (Flex is the reflexive right answer for "cheap, non-urgent" jobs), but the newly added hard SLA silently promotes reliability above cost. The decoy is the leftover framing "as cheap as possible," which is now a secondary constraint, not the deciding one.

### Q4 — Correct: B
- **A. Manual schema scripting + DMS full-load-only.** Wrong — full-load-only requires quiescing the source, which directly violates the "no planned downtime" compliance requirement for a 24/7 patient-care system.
- **B. DMS Schema Conversion + DMS full load + CDC, cutover after CDC catches up.** Correct — Schema Conversion migrates stored procedures/schema; full load + CDC keeps the target continuously in sync with zero required downtime; this is also the standard, well-documented AWS Console-driven path, matching "least operationally complex" for a team new to AWS migration tooling.
- **C. Nightly Glue JDBC extracts.** Wrong — batch extraction isn't continuous replication and doesn't convert stored procedures at all.
- **D. Standalone SCT doing both conversion and continuous replication.** Wrong — factually incorrect; SCT converts schema/code, it does not perform ongoing data replication — that is DMS's job. This option also conflicts with the exam's current scope, where SCT functionality now lives inside DMS as DMS Schema Conversion, not as a standalone continuous-replication tool.
- **Why this is hard:** "no planned downtime" and "least operationally complex for a first-time team" pull in different directions — a first-time team might reach for the simplest-looking manual/nightly options (A, C), which both fail the zero-downtime requirement. The decoy is treating "least complex" as the dominant constraint when "no downtime" is actually the hard constraint that eliminates two otherwise-simpler-looking options outright.

### Q5 — Correct: B
- **A. Firehose, three delivery streams.** Wrong — "near real-time is fine" is true but incomplete; it ignores the independent-full-access and 48-hour-replay requirements that Firehose structurally cannot meet (one destination per stream, zero replay).
- **B. Kinesis + 48h retention + EFO + Managed Flink for the session-window team.** Correct — retention covers replay, EFO gives each of the three teams independent full-throughput access, and Flink is purpose-built for stateful session-window aggregation on top of the same durable stream.
- **C. Firehose to S3 + independent Athena queries per team.** Wrong — three teams querying the same S3 landing zone independently isn't the same as three independent full-stream consumers with replay, and Athena querying files doesn't provide stateful session-window aggregation.
- **D. MSK "because it's always safest with multiple consumers."** Wrong — a reflexive, unjustified choice; nothing in the scenario mentions an existing Kafka investment, which is MSK's actual differentiator, not "multiple consumers" in general (Kinesis handles that natively).
- **Why this is hard:** the stem is deliberately written to bait the "near real-time → Firehose" reflex from the keyword table, then immediately contradicts it with requirements (multi-consumer, replay, stateful windowing) Firehose cannot satisfy. The lesson: a single keyword never overrides requirements stated later in the same stem.

### Q6 — Correct: B
- **A. One zero-ETL integration "because zero-ETL = least overhead."** Wrong — zero-ETL from Aurora targets Redshift (and DynamoDB targets Redshift/OpenSearch); it does not also deliver to S3 as a side effect, so this single integration cannot satisfy the S3/data-lake requirement at all.
- **B. Zero-ETL to Redshift + separate DMS CDC (or CDC-based export) to S3.** Correct — recognizes that zero-ETL only covers one leg (Aurora → Redshift) and that the S3/data-lake leg needs its own low-latency mechanism; this combination minimizes custom code on both legs without assuming one tool magically covers both destinations.
- **C. Glue JDBC job every 5 minutes for both.** Wrong — more custom code and higher latency than either zero-ETL or CDC-based replication; doesn't meet "lowest possible replication lag."
- **D. DMS to Redshift only, "fanning out to S3 automatically."** Wrong — factually incorrect; DMS does not automatically fan a single task out to a second, unconfigured target — reaching both destinations requires configuring the pipeline for both.
- **Why this is hard:** "least operational overhead" is the well-known trigger for zero-ETL, and the decoy is applying that reflex to *both* destinations at once instead of checking that zero-ETL's supported target list only covers one of the two stated requirements.

### Q7 — Correct: C
- **A. 100% through Kinesis with EFO.** Wrong — technically meets the SLA for all traffic but blows the strict budget cap by paying premium per-shard/EFO pricing for the bulk of traffic that doesn't need it.
- **B. 100% through Firehose.** Wrong — cheap, but explicitly accepts missing the sub-300ms SLA for high-risk transactions, which is a hard requirement, not a nice-to-have.
- **C. Split pipeline — Kinesis for the high-risk subset, Firehose for the bulk.** Correct — matches each latency tier to the service actually built for it, satisfying the sub-300ms SLA where it matters and keeping cost down everywhere else, directly resolving the stated budget-vs-latency tension.
- **D. Route everything through MSK "with enough tuning."** Wrong — vague, and introduces a Kafka cluster to operate for a workload with no stated Kafka investment or expertise — the opposite of matching effort to the actual requirement.
- **Why this is hard:** both "sub-300ms SLA" and "strict budget cap" are real, hard constraints that point to opposite single-pipeline answers (A vs B) if you assume the pipeline must be architecturally uniform. The decoy is the unstated assumption that one pipeline design must serve 100% of traffic — splitting the pipeline by requirement is the resolution.

### Q8 — Correct: B
- **A. Kinesis + rewritten connectors + manual validation code.** Wrong — explicitly rewrites the connectors, which the scenario says cannot be modified.
- **B. MSK + MSK Connect (unmodified connectors) + Glue Schema Registry.** Correct — keeps the existing connectors completely unchanged while adding automated, fail-fast schema compatibility enforcement via a managed registry — satisfies both constraints without touching the connectors.
- **C. Manual PR review of every schema change.** Wrong — not automatic, doesn't "fail fast" at write time, and doesn't scale with frequent firmware-driven schema changes.
- **D. Firehose with schema-on-read at query time.** Wrong — defers/discovers incompatibility only when querying, long after ingestion — the opposite of "fail fast," and doesn't address the unmodifiable-connector requirement either.
- **Why this is hard:** "cannot be modified" (connectors) and "must enforce automatically" (schema) both need to be true simultaneously; a reader who only tracks one constraint might pick A (good schema handling, but violates the connector constraint) or C (satisfies the connector constraint, but not "automatic").

### Q9 — Correct: B
- **A. Glue Flex, "unambiguously cheapest."** Wrong — Flex's non-deterministic start time directly threatens the hard 4:00 AM deadline; "unambiguously cheapest" ignores the SLA constraint entirely.
- **B. EMR, On-Demand primary/core + Spot task nodes only, right-sized for the deadline.** Correct — keeps the cluster-critical nodes (primary/core) reliable while still capturing meaningful Spot savings on task nodes, and is explicitly sized to hit the SLA even accounting for occasional task-node interruption — the standard answer for "lowest cost that still meets a hard deadline" at this scale.
- **C. Many short Lambda invocations.** Wrong — 50 TB nightly aggregation is far outside Lambda's practical scope (memory/time ceilings, no native distributed Spark-style processing), risking both cost blowup from orchestration complexity and the deadline.
- **D. EMR with 100% Spot on every node type.** Wrong — Spot on the primary node risks losing the entire cluster mid-run with no recovery, which is incompatible with a "no exceptions" SLA regardless of cost savings.
- **Why this is hard:** "lowest possible compute cost, stated explicitly by finance" is a strong, prioritized-sounding decoy — it's tempting to pick whichever option is cheapest in isolation (A or D) without checking it against the hard, contractual deadline that must still be met. The correct answer optimizes cost *subject to* the deadline, not cost alone.

### Q10 — Correct: C
- **A. Hive-style Parquet + manually maintained nightly compaction.** Wrong — provides none of ACID, time travel, or schema evolution, and still requires the team to build and run the compaction job manually.
- **B. Iceberg on a standard bucket, self-maintained compaction/expiration.** Wrong — gets ACID/time-travel/schema-evolution right, but the team must still build and operate their own maintenance jobs, failing "least ongoing engineering effort."
- **C. Amazon S3 Tables.** Correct — Iceberg-native storage with automatic compaction, snapshot management, and cleanup built in, plus the broad Athena/Glue/EMR/Redshift compatibility Iceberg already provides — the only option meeting every stated requirement including "least ongoing engineering effort."
- **D. Delta Lake on Databricks.** Wrong — introduces a Databricks-centric toolchain and doesn't have the same first-class native breadth across Athena/Glue/EMR/Redshift that Iceberg (and S3 Tables specifically) has.
- **Why this is hard:** B looks fully correct at first glance because "Apache Iceberg" is the textbook answer for ACID + time travel + schema evolution — the decoy is stopping there and missing the final clause about maintenance effort, which is the actual differentiator that eliminates B in favor of C.

### Q11 — Correct: C
- **A. Athena, "zero idle cost, no capacity planning."** Wrong — true for occasional/exploratory querying, but Athena's per-query concurrency model degrades under 500 concurrent users running complex joins; it isn't designed as a high-concurrency BI warehouse substitute.
- **B. Provisioned cluster sized for 500 users, running 24/7.** Wrong — guarantees performance but runs at peak size around the clock, directly violating "minimal idle cost" during nights/weekends of near-zero usage.
- **C. Redshift Serverless.** Correct — auto-scales RPUs to match the business-hours concurrent load and scales down (near-zero billing) during idle nights/weekends, satisfying both "minimal idle cost" and "no manual capacity planning" while still being a full warehouse capable of complex joins at concurrency, addressing leadership's skepticism directly.
- **D. Provisioned + Reserved Instances "always cheapest."** Wrong — RIs are a discount for steady, predictable, always-on usage; this workload is explicitly spiky (weekday business hours only), so RIs pay for capacity that sits idle nights and weekends.
- **Why this is hard:** the stem plants a legitimate objection ("skeptical serverless can handle 500 concurrent complex-join users") that could tempt readers toward a provisioned answer (B or D) purely out of caution — the decoy is treating "skepticism" as a technical constraint rather than a framing device; Redshift Serverless is explicitly built to scale RPUs to concurrent demand.

### Q12 — Correct: B
- **A. LSI for `device_imei` + raise table-level capacity.** Wrong — LSIs can only be created at table creation time; the table is 18 months old, so this is impossible, and raising overall capacity doesn't fix a single hot partition's throttling.
- **B. GSI for `device_imei` + targeted write-sharding for the hot corporate account.** Correct — GSIs can be added anytime (matching the "emerged after 18 months" timing) and accept eventual consistency; the throttling is isolated to one account's partition, so a targeted sharding suffix for just that key fixes it without disrupting the rest of the table.
- **C. Recreate the table for an LSI + switch to on-demand.** Wrong — needlessly disruptive (a full table recreation/migration) when a GSI solves the query pattern, and on-demand mode does not rebalance a single hot logical key the way targeted sharding does.
- **D. `Scan` + ignore the throttling.** Wrong — scans are expensive and don't scale, and ignoring active throttling leaves a real production problem unaddressed.
- **Why this is hard:** this stem stacks two separate, independently-solvable problems (a new access pattern needing an index, and a hot-key throttling issue) into one question, and the decoy is assuming one broad fix (like "increase capacity" or "switch to on-demand") addresses both — neither does; each problem needs its own targeted solution.

### Q13 — Correct: C
- **A. Delta Lake "most mature for row-level deletes."** Wrong — while Delta Lake does support row-level deletes, it carries a materially more Databricks-centric toolchain than Iceberg, which the requirement explicitly wants to avoid ("without a proprietary runtime").
- **B. Apache Hudi "purpose-built for upserts."** Wrong — Hudi is a legitimate, capable choice for streaming upserts, but Iceberg is the option with the broadest, most consistently first-class native support specifically across Athena, Glue, EMR, *and* Redshift, which is the exact breadth the requirement asks for.
- **C. Apache Iceberg.** Correct — supports row-level deletes (satisfying GDPR erasure) and high-frequency streaming upserts, with broad native engine support across Athena/Glue/EMR/Redshift and no proprietary/Databricks-centric runtime requirement.
- **D. Plain partitioned Parquet with a monthly full-rewrite purge.** Wrong — a monthly full-rewrite directly contradicts "without rewriting the entire dataset," and doesn't support the concurrent high-frequency streaming upserts described.
- **Why this is hard:** B is a genuinely reasonable, defensible answer on upsert capability alone, which is what makes this hard — the deciding constraint isn't "which format handles upserts best" but the broad-engine-compatibility clause at the end of the stem, which favors Iceberg specifically for this repo's currency guidance (avoiding Databricks-centric lock-in).

### Q14 — Correct: B
- **A. Permanently resize upward.** Wrong — pays for the larger size 365 days a year to cover a workload that occurs roughly four times a year, and the budget explicitly forbids a permanent increase.
- **B. Elastic resize / concurrency scaling for the quarterly event only.** Correct — adds capacity only when needed and returns to baseline afterward, respecting both the RI-sized steady baseline and the explicit "no permanent increase" constraint.
- **C. Drop the RI commitment for full On-Demand flexibility.** Wrong — throws away the cost benefit of the RI for the 24/7 steady baseline, which the RI is specifically well-suited for, to solve a once-a-quarter problem.
- **D. Run the stress test on the same fixed cluster, degrading everyone's performance.** Wrong — technically avoids added cost but ignores that the stress test needs "far more temporary compute than the baseline cluster provides" — it wouldn't actually complete acceptably on unchanged capacity.
- **Why this is hard:** "steady 24/7 baseline load sized to an RI commitment" and "one-off spike needing far more compute" pull toward two different standard answers (RI-optimized permanent sizing vs. burst capacity) — the decoy is picking one architecture pattern for the *entire* cluster instead of recognizing the two patterns need two different mechanisms applied to the same cluster.

### Q15 — Correct: B
- **A. Load all 6 years into Redshift via COPY.** Wrong — explicitly contradicts "without loading the full archive into the cluster," even though it would technically satisfy both functional requirements.
- **B. Redshift Spectrum over an Iceberg table in S3.** Correct — Spectrum satisfies the join-without-loading requirement, and querying an Iceberg table (rather than plain Parquet) adds the snapshot/time-travel capability needed for the point-in-time legal audit — the only option that satisfies both requirements together without loading data into the cluster.
- **C. Plain Spectrum over Hive-style Parquet, "satisfies both."** Wrong — Spectrum over plain partitioned Parquet has no time-travel/snapshot capability; it can join without loading, but it cannot answer "as it existed on a specific past date."
- **D. Export Redshift to S3 nightly, query everything with Athena.** Wrong — abandons live warehouse joins entirely and doesn't provide point-in-time snapshot querying of the archive either.
- **Why this is hard:** this question tests whether the reader remembers that Spectrum's underlying table format matters — the "join without loading" requirement is satisfied by Spectrum regardless of format, which tempts stopping at C; the decoy is forgetting that the *second* requirement (point-in-time query) depends specifically on the table being Iceberg, not just on Spectrum being used.

### Q16 — Correct: B
- **A. Switch to on-demand, "automatically rebalances any hot key."** Wrong — a common misconception; on-demand capacity mode changes billing and overall table-level scaling, but it does not eliminate a single hot logical partition/item's throttling by itself.
- **B. DAX for hot reads + targeted write-sharding for that one item.** Correct — DAX absorbs the disproportionate read volume with microsecond latency and no query-logic changes, while a small, targeted sharding suffix applied specifically to the one hot item's writes spreads its write load — both without a broad rewrite of the application's read/write logic for every other (unaffected) item.
- **C. Increase overall table capacity significantly.** Wrong — the table's overall metrics were not the problem (already high-cardinality key); throwing more table-wide capacity at one item's hot partition is wasteful and doesn't target the actual bottleneck.
- **D. Add a GSI to "spread the hot item automatically."** Wrong — GSIs support new query patterns; they don't automatically distribute or shard a specific item's existing read/write hot spot.
- **Why this is hard:** "high-cardinality composite key" reads like it should already prevent hot partitions, which is the decoy — it's true in general, but a single outlier item (a celebrity streamer) can still become individually hot regardless of overall key cardinality, and the fix has to be targeted (caching + item-specific sharding), not a table-wide capacity or mode change.

### Q17 — Correct: C
- **A. Everything on Standard "for operational simplicity."** Wrong — Standard's per-state-transition pricing is markedly more expensive at the stated millions-of-short-executions-per-day scale, ignoring the explicit cost requirement for that workload.
- **B. Everything on Express "since audit history isn't required for most."** Wrong — "most" isn't "all"; the small set of critical, revenue-impacting workflows explicitly does need the 90-day audit history, which Express does not provide.
- **C. Split — Standard for the audited critical workflows, Express for the high-volume low-stakes executions.** Correct — matches each of the two genuinely different workload shapes (low-volume/audited vs. high-volume/cost-sensitive) to the Step Functions type built for it.
- **D. Move everything to MWAA "because Airflow can express any of these."** Wrong — technically flexible, but introduces an always-on Airflow environment cost and operational overhead disproportionate to either workload's actual needs, and doesn't natively solve the audit-history-for-a-subset requirement any more cleanly than Step Functions already does.
- **Why this is hard:** the temptation is architectural uniformity — "pick one engine for the whole orchestration layer" — but the two workloads described have genuinely opposite defining constraints (audit depth vs. per-execution cost at extreme volume), and no single Step Functions type satisfies both simultaneously; the fix is workload-appropriate splitting, the same pattern as Q7's ingestion split.

### Q18 — Correct: B
- **A. Permanently resize for the worst combined case.** Wrong — sizes for a rare worst-case combination that isn't the steady-state need, over-provisioning most of the month.
- **B. Concurrency scaling + well-tuned WLM for both patterns.** Correct — concurrency scaling adds transient capacity for both the predictable monthly spike and the unpredictable investigative bursts as they occur, while tuned WLM queues prevent the unpredictable ad-hoc queries from starving the routine monthly-close reporting when both happen to overlap.
- **C. Address only the predictable spike, ask analysts to avoid ad-hoc queries during busy periods.** Wrong — a process-only workaround for the unpredictable pattern, which by definition can't be reliably avoided by request, and doesn't solve the case where the two patterns overlap.
- **D. A second, separately provisioned 24/7 cluster for ad-hoc queries.** Wrong — a second always-on cluster reintroduces exactly the permanent over-provisioning cost the team wants to avoid, for traffic that's unpredictable and often idle.
- **Why this is hard:** the stem presents two distinct spike patterns (predictable/scheduled vs. unpredictable/event-driven), tempting a reader to pick a mechanism designed for only one of them (e.g., scheduling-based fixes for the predictable one) — the decoy is not realizing concurrency scaling handles *any* transient spike regardless of predictability, and that WLM tuning is what prevents the two patterns from colliding badly when they overlap.

### Q19 — Correct: B
- **A. Remove the rule, check manually each morning.** Wrong — reintroduces slow, manual monitoring and doesn't solve alert fatigue so much as remove alerting altogether — overcorrecting past the actual problem.
- **B. Configure job retries, scope the alert to final failure only.** Correct — lets Glue's own retry mechanism absorb transient failures silently, and only pages on-call once retries are truly exhausted — preserving "page within seconds of a real failure" while eliminating alerts for self-resolving transient issues.
- **C. Increase SNS batching window.** Wrong — delays and possibly deduplicates notifications by time rather than by whether the failure was actually terminal, which risks violating "page within seconds" for genuine failures while not reliably filtering out noise from transient ones either.
- **D. Disable retries entirely so every failure pages.** Wrong — the opposite direction; this maximizes alert volume/fatigue rather than reducing it, and abandons a resilience mechanism that was working correctly.
- **Why this is hard:** the two requirements — "page within seconds" and "stop paging for self-resolving failures" — look contradictory at first (faster alerting vs. fewer alerts), and the decoy is assuming they trade off against each other; the actual fix (alert on exhausted retries, not on every attempt) satisfies both simultaneously.

### Q20 — Correct: B
- **A. One uniform limit for everyone including executives.** Wrong — solves the runaway-cost problem but breaks the executive team's legitimate need for occasional large historical queries, which the scenario says must be preserved.
- **B. Separate workgroups — conservative limit for general analysts, higher/no limit for executives.** Correct — Athena workgroups can each carry their own data-usage control and be gated by IAM, so the same account supports both a strict guardrail for general self-service and an explicit, permissioned exception for the group that legitimately needs it.
- **C. Remove Athena access from all analysts except executives.** Wrong — eliminates self-service for the broad analyst population entirely, a far more disruptive fix than the scenario calls for.
- **D. No preventive controls at all.** Wrong — repeats exactly the mistake ("an intern's query drove an unexpectedly large bill") the scenario says already happened once and wants prevented.
- **Why this is hard:** the natural first instinct after a cost incident is "add one limit for everyone," but the scenario adds a second, competing requirement (an explicit executive exception) in the same breath — the decoy is treating governance as necessarily uniform across all users instead of using Athena's workgroup-level granularity to apply different policies to different groups.

### Q21 — Correct: B
- **A. 100% X-Ray sampling.** Wrong — guarantees maximum visibility but scales tracing cost and overhead linearly with all millions of daily requests, directly violating the stated cost pressure.
- **B. X-Ray with a tuned sampling rule (with a higher fixed rate for errors).** Correct — captures a statistically representative view of normal traffic at a fraction of the cost/overhead of full sampling, while still prioritizing visibility into the error cases most likely to need investigation — the standard way X-Ray is used at high request volume.
- **C. Skip X-Ray, rely only on CloudWatch Logs Insights per function.** Wrong — loses the cross-service, end-to-end view of a single request's path that the scenario specifically needs to diagnose latency; log-group-by-log-group searching doesn't reconstruct a distributed trace.
- **D. X-Ray on only the historically slowest single function.** Wrong — intermittent latency could originate anywhere in the chain on a given request; tracing only one fixed function misses the other services entirely and doesn't provide end-to-end tracing at all.
- **Why this is hard:** "end-to-end distributed tracing" strongly cues X-Ray, and the decoy is assuming that means capturing every request (100% sampling) to "guarantee no problem is ever missed" — but the stem's cost constraint is just as hard a requirement, and X-Ray's sampling configuration is specifically designed to satisfy both at once, which many candidates don't realize is configurable.

### Q22 — Correct: B
- **A. Direct bucket policy + KMS key policy grants to the partner principal.** Wrong — grants raw S3/KMS access directly; nothing stops the partner from further re-sharing that access from their own account, and there's no centralized, Lake-Formation-level audit of exactly what was granted and used.
- **B. Lake Formation cross-account grants via RAM + scoped KMS key policy.** Correct — Lake Formation's cross-account sharing model keeps the underlying grant and its scope centrally defined and auditable from the bank's own account, and grants made this way are not inherently re-shareable by the recipient the way a raw resource-policy grant would be — satisfying both the no-re-share and centralized-audit requirements without copying data.
- **C. Cross-account role with `s3:*`/`kms:*`, "trust the partner to self-govern."** Wrong — grants far broader access than needed and relies on the partner's own goodwill/governance rather than an AWS-enforced control, failing the "must not be able to re-share" requirement outright.
- **D. Copy the data into the partner's own account.** Wrong — explicitly contradicts "without duplicating the underlying data," and once copied, the bank loses any control over further re-sharing entirely.
- **Why this is hard:** A looks like the textbook answer for "cross-account KMS-encrypted S3 sharing" from the basic troubleshooting pattern (grant both the resource policy and the key policy) — the decoy is that this question adds two extra, easy-to-miss governance requirements (no re-sharing, centralized audit) that a raw resource-policy grant doesn't satisfy, which is exactly why Lake Formation's managed sharing model exists as the more complete answer.

### Q23 — Correct: B
- **A. Blanket deny, "SCPs cannot express exceptions."** Wrong — factually incorrect; SCPs can include conditions (such as excluding a specific principal ARN), so a blanket no-exceptions deny is not the only possible SCP design, and it fails the scenario's explicit break-glass requirement.
- **B. SCP deny with a condition excluding the break-glass role's ARN.** Correct — a conditional deny lets the SCP block the dangerous actions org-wide while carving out the one explicitly authorized exception, satisfying both the blanket-prevention goal and the incident-response need.
- **C. Skip the SCP, rely on informal policy.** Wrong — "informally asking other teams not to" is not an enforced guardrail at all, failing the org-wide blocking requirement the scenario demands.
- **D. SCP plus granting the break-glass role `AdministratorAccess` to "override" it.** Wrong — factually incorrect; an identity-based policy, including `AdministratorAccess`, cannot override an SCP's explicit deny — an explicit deny anywhere in the evaluation always wins, so this doesn't actually restore access for the break-glass role.
- **Why this is hard:** this tests a common misconception in two directions at once — that SCPs are always all-or-nothing (decoy toward A), and that a broad enough IAM grant can override an SCP (decoy toward D). The correct mechanism (a conditional deny that names the exception inside the SCP itself) is less commonly known than either misconception.

### Q24 — Correct: B
- **A. SSE-S3, "already encrypts everything by default."** Wrong — SSE-S3 is a single encryption layer with AWS-owned keys; it satisfies neither the two-independent-layers requirement nor the customer-controlled-key requirement.
- **B. DSSE-KMS with a customer-managed key.** Correct — DSSE-KMS applies two independent encryption layers by definition, and using a customer-managed KMS key (rather than an AWS-managed one) gives the contractor control over rotation and a fully auditable key policy/CloudTrail trail — satisfying both the double-layer and customer-control requirements together.
- **C. SSE-KMS with an AWS-managed key, "KMS always double-encrypts internally."** Wrong — factually incorrect as a way to satisfy an explicit two-independent-layers *compliance mandate*, and an AWS-managed key is not customer-controlled — the contractor can't manage its rotation policy.
- **D. Client-side encryption only, no server-side encryption.** Wrong — a single layer (client-side) with server-side encryption explicitly disabled does not provide two layers of protection at rest; it's arguably fewer effective layers, not more.
- **Why this is hard:** this stacks two separate mandates — a specific *technical* encryption-layer count and a *governance* requirement about who controls the keys — and several options satisfy one but not the other (C sounds like "KMS is strong" but misses customer control; A sounds like "already encrypted" but misses both). The decoy is treating "encrypted" as a single pass/fail property instead of checking each named sub-requirement independently.

### Q25 — Correct: B
- **A. Per-table grants for every subsidiary as tables appear.** Wrong — explicitly the growing administrative burden the scenario says must be avoided ("scales without per-table grants").
- **B. LF-Tags for sensitivity-based access + named row-level filters for subsidiary row restriction.** Correct — LF-Tags let new tables inherit access rules automatically once tagged appropriately (no per-table regrant needed), and row-level data filters handle the separate, per-subsidiary row-restriction requirement on the specific shared tables that need it — together covering both stated requirements with minimal ongoing administration.
- **C. One IAM policy per subsidiary, manually maintained.** Wrong — same scaling problem as A, expressed as IAM policies instead of Lake Formation grants; still requires manual updates as the catalog grows.
- **D. Fully separate physical databases per subsidiary.** Wrong — eliminates the *shared* data lake model the scenario describes, and doesn't scale either (still requires physically restructuring data as new subsidiaries or sharing needs emerge), while losing whatever benefit the shared catalog provided in the first place.
- **Why this is hard:** the scenario bundles two distinct governance needs (broad, scaling sensitivity classification, and narrow, per-subsidiary row filtering) that could each individually suggest a different mechanism — the decoy is picking a single mechanism (e.g., only LF-Tags, or only row filters) and assuming it covers both, when the correct answer is explicitly using both LF-Tags *and* row-level filters together for their respective, non-overlapping requirements.
