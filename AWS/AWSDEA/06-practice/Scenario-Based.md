# Scenario-Based Practice — DEA-C01 (20 mini case studies)

> **Level:** long-form scenario reasoning. Every stem here is a small
> case study — 3–5 sentences of company/system context, sometimes with
> **2–3 sub-questions against the same scenario** — rather than a
> single tight paragraph with one clean answer. This is deliberately
> closer to how the hardest real exam questions read: you have to hold
> more context in your head before the actual question even shows up.
>
> Fully self-contained: question, options, and full explanation for
> every option (right and wrong) sit together. No separate answer key
> — work each scenario, then read the explanation immediately below it.
>
> **Coverage note:** these scenarios deliberately explore combinations
> and follow-up angles not covered in `Beginner.md`, `Intermediate.md`,
> `Advanced.md`, `Full-Mock-Exam-1.md`, or the `01-domains/` question
> banks — new companies, new constraint combinations, new services in
> combination. If a service reappears (some will — it's a 4-domain
> exam, not an infinite one), the scenario and the reasoning path are
> new.

---

## Scenario 1 — A weather-sensor network scales past its original design

A climate-research nonprofit operates 2,200 weather stations, each
reporting a reading every 2 seconds (record size ~1.2 KB). The
nonprofit's engineering team is three people, none of whom want to
own shard math as the network grows toward a planned 10,000 stations
over the next 18 months. A university partner needs to independently
replay the last 5 days of raw readings whenever they publish a new
calibration model, without affecting the nonprofit's live dashboard
consumer.

**Q1.1** What ingestion configuration best fits both the operational
constraint (no shard math) and the university partner's replay need?

- A. Amazon Data Firehose with a 5-day buffer configured for delayed delivery.
- B. Kinesis Data Streams in on-demand capacity mode, with retention set to at least 5 days, and enhanced fan-out for the university's independent consumer.
- C. Amazon MSK Serverless, since Kafka's default retention already covers replay.
- D. Kinesis Data Streams in provisioned mode, sized for 10,000 stations today to avoid resharding later.

> **Answer: B.** On-demand removes the shard-math burden as the
> network scales (matching the three-person team's constraint), 5+ day
> retention satisfies the university's replay window, and enhanced
> fan-out gives their consumer dedicated throughput independent of the
> live dashboard consumer — exactly the "two independent readers of
> the same stream" pattern Kinesis Data Streams is built for.
> **A** is wrong — Firehose has no replay capability at all, delayed
> delivery or not; once delivered, there's no re-reading a window from
> the stream itself. **C** is wrong — MSK Serverless is a real option
> for replay, but it introduces Kafka operational concepts (topics,
> consumer groups, partition rebalancing) for a three-person team that
> explicitly doesn't want to own that complexity, and nothing in the
> scenario states an existing Kafka investment (the actual trigger for
> choosing MSK). **D** is wrong — pre-sizing shards for 18-months-away
> volume today means paying for unused capacity now and still requires
> the team to actively manage resharding as the plan unfolds; it
> directly contradicts "none of whom want to own shard math."

**Q1.2** Six months later, the nonprofit's dashboard consumer (a
Lambda function) starts showing rising latency, and `GetRecords.
IteratorAgeMilliseconds` climbs steadily while `WriteProvisionedThroughputExceeded`
stays at zero. What's the most likely cause and fix?

- A. The stream needs more capacity for writes; since it's on-demand, nothing can be done.
- B. The dashboard's Lambda consumer is falling behind reads; increase its parallelization factor or add consumers, independent of the university's separate enhanced fan-out consumer.
- C. The university's replay activity is starving the dashboard consumer of throughput.
- D. Retention needs to be shortened to reduce IteratorAge.

> **Answer: B.** `IteratorAge` rising with zero write throttling is
> the textbook signature of a lagging consumer, not a capacity
> problem — this is true regardless of capacity mode. **A** is wrong
> on two counts: write throughput isn't the bottleneck here (per the
> zero throttling metric), and on-demand mode does still scale, so
> "nothing can be done" is false regardless. **C** is wrong — this is
> exactly why Q1.1 specified enhanced fan-out for the university's
> consumer: EFO gives each consumer a dedicated 2 MB/s-per-shard pipe,
> so their replay activity does not compete with the dashboard's
> throughput. **D** is wrong — retention governs how much history is
> available to read, not how fast a consumer processes what's already
> arrived; shortening it doesn't address consumer lag at all.

---

## Scenario 2 — A SaaS company's heterogeneous database migration

A project-management SaaS company runs its primary application
database on self-managed PostgreSQL on EC2, with several stored
procedures and custom PL/pgSQL functions handling billing logic. The
company is migrating to Aurora PostgreSQL for reduced operational
overhead, and separately wants a permanent, ongoing analytics feed of
the same tables into S3 for a data science team, with minimal
replication lag on both.

**Q2.1** Since source and target are both PostgreSQL (a homogeneous
migration), what's the most accurate statement about the migration
tooling needed?

- A. Schema conversion tooling (like DMS Schema Conversion) is unnecessary here since PostgreSQL-to-PostgreSQL requires no code translation; a DMS full load + CDC task can migrate schema and data directly, with stored procedures brought over via native `pg_dump`/`pg_restore` or manual scripting.
- B. DMS Schema Conversion is mandatory for any migration involving stored procedures, regardless of source/target engine match.
- C. AWS SCT must be used as a standalone tool since DMS cannot handle PostgreSQL sources.
- D. Homogeneous migrations always require AWS Glue instead of DMS.

> **Answer: A.** DMS Schema Conversion (and its predecessor, standalone
> SCT) earns its keep on *heterogeneous* migrations where SQL dialects
> differ (Oracle → PostgreSQL, for example); a same-engine migration's
> tables/indexes/basic schema transfer natively without dialect
> translation, and PL/pgSQL functions typically move via standard
> PostgreSQL tooling (`pg_dump`/`pg_restore`) rather than a
> conversion step built for cross-dialect code translation. **B** is
> wrong — the need for schema conversion tooling is driven by whether
> source and target *dialects* differ, not merely by the presence of
> stored procedures. **C** is wrong on two counts — standalone SCT is
> not the current-scope answer for this repo (DMS Schema Conversion
> is), and DMS fully supports PostgreSQL as both source and target
> regardless. **D** is a fabricated rule; Glue is not a database
> migration tool with DMS's fidelity guarantees for this use case.

**Q2.2** For the ongoing, low-lag analytics feed into S3 for the data
science team, which approach best fits "permanent, ongoing, minimal
lag"?

- A. A DMS task with full load + CDC, targeting S3 as the endpoint, left running continuously after the initial cutover.
- B. A nightly Glue JDBC extract job.
- C. A one-time DMS full-load-only task, re-run manually whenever the data science team requests a refresh.
- D. Zero-ETL integration from Aurora PostgreSQL directly to S3.

> **Answer: A.** DMS supports S3 as a CDC target, and a full load +
> CDC task left running is exactly the pattern for continuous,
> low-lag replication into S3 for downstream analytics — this is a
> distinct, valid use of the same DMS CDC mechanism used for database-
> to-database migration, just with S3 as the endpoint. **B** is wrong
> — nightly batch introduces up to 24 hours of lag, failing "minimal
> replication lag." **C** is wrong — full-load-only captures a single
> point-in-time snapshot with no ongoing sync; "permanent, ongoing"
> rules this out explicitly. **D** is wrong — as of this exam's
> scope, zero-ETL integrations pair specific sources (Aurora, RDS,
> DynamoDB) with specific analytical targets (primarily Redshift, and
> OpenSearch for DynamoDB); S3 is not a zero-ETL target, so this
> option describes a capability that doesn't exist for this pairing.

---

## Scenario 3 — A logistics company's Glue job hits a wall at scale

A freight company's nightly Glue ETL job joins a 200 GB shipment-events
dataset against an 800 MB carrier-reference dataset, running on 10
G.1X workers. The job has run reliably for months, but this week it
started failing intermittently with executor out-of-memory errors,
coinciding with a new carrier onboarding that brought one carrier's
shipment volume to roughly 40% of the entire dataset overnight.

**Q3.1** What is the most likely root cause, and what's the most
targeted fix?

- A. The job needs more workers of the same type; add 10 more G.1X workers.
- B. Data skew — one carrier's disproportionate share of records means the partitions/tasks handling that carrier's data are far larger than others, overwhelming individual executors regardless of total cluster capacity; a targeted fix (salting the skewed join key, or using AQE's skew-join optimization if available) addresses the actual imbalance better than simply adding uniform capacity.
- C. The 800 MB reference dataset is too large for a broadcast join; disable broadcast joins entirely.
- D. Switch the job to Python shell type, which doesn't experience OOM errors.

> **Answer: B.** A sudden OOM onset that coincides with one entity's
> share jumping to 40% of the data is the classic signature of data
> skew, not insufficient total capacity — a handful of tasks are doing
> dramatically more work than the rest, and those specific tasks OOM
> regardless of how many *additional* uniformly-sized workers you add.
> **A** is wrong — more workers of the same type adds parallelism for
> *evenly distributed* work; it doesn't shrink the oversized partitions
> the skewed carrier is creating, so the same tasks can still OOM. **C**
> is backwards — an 800 MB reference table is actually a *good*
> broadcast-join candidate (small enough to replicate cheaply to every
> executor, avoiding a shuffle on the large side); disabling broadcast
> joins would likely make performance worse, not fix the skew, which
> is on the large dataset's join key distribution, not the reference
> table's size. **D** is wrong — Python shell jobs have their own
> resource ceilings and are meant for lightweight, non-Spark scripting,
> not large-scale Spark joins; they don't have some special immunity
> to memory pressure, and in fact aren't the right job type for this
> workload at all.

---

## Scenario 4 — A retailer replaces a fragile cron pipeline

A mid-size retailer's inventory-sync pipeline is currently a chain of
cron jobs on an EC2 instance: one script pulls from a supplier API,
a second transforms the data, a third loads it into the warehouse.
When any script fails, the next one runs anyway against stale or
missing input, and nobody notices until a downstream report looks
wrong days later. The retailer wants managed retries, a visual
execution history for debugging, and to be alerted immediately when a
step truly fails (not on every transient blip).

**Q4.1** What orchestration and monitoring combination best replaces
this pipeline?

- A. Migrate each script to a Lambda function, invoked directly by EventBridge Scheduler on the same cron-like intervals as before.
- B. AWS Step Functions with each stage as a task state (each with its own `Retry`/`Catch` configuration so a downstream stage can't silently run against a failed upstream stage), and an EventBridge rule on the state machine's execution-failed event driving an SNS alert.
- C. Keep the cron jobs, but add CloudWatch Logs to each script for after-the-fact debugging.
- D. Migrate to a single monolithic Lambda function containing all three steps' logic sequentially.

> **Answer: B.** Step Functions directly solves the stated problems:
> `Catch` on each state prevents a downstream stage from running after
> an upstream failure (unlike the current cron chain), the built-in
> execution history is the visual debugging tool requested, and wiring
> execution-failure events to an alert (rather than alerting on every
> individual retry attempt) satisfies "alert only on true failure."
> **A** is wrong — swapping cron-on-EC2 for EventBridge-Scheduler-on-
> Lambda preserves the same fundamental flaw: each invocation still
> runs independently on a schedule with no dependency awareness between
> steps, so a failed pull still lets the transform run against stale
> data. **C** is wrong — better logging helps you find out what went
> wrong *after the fact*, which doesn't address "nobody notices for
> days" or prevent a downstream stage from running against bad input;
> it's observability without orchestration. **D** is wrong — a single
> monolithic function loses per-stage retry granularity and visual
> execution history, and risks hitting Lambda's 15-minute ceiling as
> the combined logic grows, while making failure isolation harder, not
> easier, than three separate, orchestrated stages.

---

## Scenario 5 — A photo archive with three access tiers and a compliance twist

A stock-photo company stores 40 million images in S3. Roughly 20% are
"active catalog" images queried multiple times daily. Another 60% are
"seasonal" images whose access pattern genuinely is unpredictable —
dormant for months, then suddenly popular during a relevant season.
The remaining 20% are legally retained but essentially never accessed,
and a recent contract requires that these specific legal-hold images
be **provably unmodifiable and undeletable**, including by the
company's own AWS administrators, for 7 years.

**Q5.1** Which combination of S3 features best fits all three tiers?

- A. S3 Standard for active catalog, S3 Intelligent-Tiering for seasonal, S3 Glacier Deep Archive with Object Lock in compliance mode for the legal-hold tier.
- B. S3 Standard for all three tiers, since predicting exact access patterns is unreliable anyway.
- C. S3 Standard-IA for all three tiers as a single cost-effective middle ground.
- D. S3 Intelligent-Tiering for all three tiers, including the legal-hold images, since Intelligent-Tiering handles unknown access patterns automatically.

> **Answer: A.** Each tier gets the feature matched to its actual
> stated property: active catalog's frequent, predictable access fits
> plain Standard; seasonal's genuinely unpredictable access pattern is
> the textbook Intelligent-Tiering case (automatic tier movement based
> on real access, no manual lifecycle rule to maintain); and the
> legal-hold tier's "provably unmodifiable/undeletable, even by our
> own admins, for 7 years" requirement can only be satisfied by **S3
> Object Lock in compliance mode** — the one mechanism that blocks
> deletion/modification for every principal, including account
> administrators, until retention expires. **B** is wrong — leaving
> everything in Standard is needlessly expensive for the seasonal and
> legal-hold tiers, which don't need Standard's always-hot performance
> profile. **C** is wrong — Standard-IA doesn't solve the legal-hold
> tier's undeletable/unmodifiable requirement at all (nothing about
> Standard-IA prevents deletion), and it's a poor fit for the active
> catalog's frequent-access pattern (IA carries retrieval fees). **D**
> is wrong — Intelligent-Tiering optimizes storage *cost* based on
> access patterns, but it has no relationship to Object Lock's
> WORM guarantee; nothing about Intelligent-Tiering prevents an admin
> from deleting an object, which is the legal-hold tier's actual,
> non-negotiable requirement.

**Q5.2** A junior engineer proposes using **governance mode** instead
of compliance mode for the legal-hold tier, arguing "it's simpler to
set up and we can always adjust later if needed." What's the strongest
objection?

- A. Governance mode doesn't support a 7-year retention period; only compliance mode allows retention periods over 1 year.
- B. Governance mode retention can be overridden or shortened by any principal holding the `s3:BypassGovernanceRetention` permission — including, potentially, an account administrator — which directly fails the contract's "undeletable/unmodifiable including by our own administrators" requirement; compliance mode has no such bypass for any principal.
- C. Governance mode is more expensive than compliance mode at scale.
- D. Governance mode only works with S3 Standard, not Glacier Deep Archive.
- 
> **Answer: B.** This is the precise, contract-relevant distinction —
> "simpler, adjustable later" is exactly the property the legal
> requirement explicitly rules out; the whole point of the contract
> clause is that it must **not** be adjustable, even by the company's
> own admins. **A** is false — both modes support retention periods
> well beyond a year; the difference is enforcement strength, not
> maximum duration. **C** is false — there's no meaningful cost
> difference between the two lock modes themselves; the object's
> storage class (Deep Archive) drives storage cost, not the lock mode.
> **D** is false — Object Lock works across S3 storage classes,
> including Glacier Deep Archive, as configured in Q5.1's answer.

---

## Scenario 6 — A ride-share company's small-file problem compounds

A ride-share analytics team's Kinesis-to-S3 pipeline (via Firehose)
has been running for a year with a 1 MB/60-second buffer configuration
that was never revisited after the original proof-of-concept. The
table now has roughly 4 million tiny Parquet files across its
partitions, and both Athena query planning time and monthly S3
request-pricing costs have become noticeably significant line items,
even though total data volume is modest.

**Q6.1** What is the most direct, root-cause fix?

- A. Increase Firehose's buffer size and buffer interval (trading a small amount of ingestion latency for dramatically fewer, larger output files going forward), and separately run a one-time compaction job (Glue or EMR) to merge the 4 million existing small files into fewer, larger ones.
- B. Switch the Athena table to partition projection, which eliminates the small-file problem entirely.
- C. Increase the Athena workgroup's data usage control limit to accommodate the extra planning overhead.
- D. Move the table to DynamoDB, which has no small-file concept.

> **Answer: A.** This directly targets both the ongoing cause (buffer
> settings tuned for lab-speed feedback, never revisited for
> production — exactly the tradeoff called out across this repo's
> Firehose material) and the existing damage (4 million files already
> on disk, which raising the buffer going forward does nothing to
> fix retroactively) — a two-part fix for a two-part problem. **B**
> is wrong — partition projection addresses slow query *planning*
> caused by *too many partitions*/catalog lookups; it does nothing
> about *file count within* a partition or the underlying small-file
> read overhead, which is a different mechanism (open/read overhead
> per file at scan time, not partition metadata lookup). **C** is
> wrong — raising a cost guardrail doesn't fix the underlying
> performance/cost problem; it just tolerates more of it. **D** is
> wrong and off-topic — migrating the whole table to a fundamentally
> different database model is a wildly disproportionate response to a
> file-size tuning problem, and DynamoDB isn't a substitute for
> SQL-queried analytical Parquet data in the first place.

---

## Scenario 7 — A bank's Redshift cluster under two kinds of pressure at once

A bank's Redshift cluster serves a steady, RI-sized 24/7 regulatory-
reporting workload. Twice a year (fiscal half-close), a separate,
much larger ad-hoc reconciliation workload runs for about three days
straight, needing significantly more compute than the baseline
cluster. Separately, the bank's `transactions` fact table currently
uses `DISTKEY` on `branch_id` (140 distinct values across the whole
bank), and query plans show heavy join skew against a `customers`
dimension table on the same column.

**Q7.1** For the twice-yearly compute spike, without permanently
resizing the cluster, what's the appropriate mechanism?

- A. Elastic resize or concurrency scaling, engaged only for the 3-day half-close window each time, returning to baseline afterward.
- B. Cancel the Reserved Instance commitment entirely so the cluster can flex freely year-round.
- C. Run the reconciliation workload on the same fixed-size cluster and accept degraded performance for the regulatory workload during those 3 days.
- D. Permanently increase the cluster size to comfortably handle both workloads at all times.

> **Answer: A.** This is the standard pattern for a predictable,
> bounded, infrequent spike sitting on top of a steady RI-sized
> baseline — add capacity only for the window that needs it, then
> return to the RI-optimized baseline size. **B** is wrong — the RI
> commitment is well-matched to the steady 24/7 baseline; discarding
> it to handle a 6-days-a-year spike sacrifices real savings on the
> other 359 days. **C** is wrong — this technically avoids extra cost
> but directly degrades the regulatory-reporting workload's
> performance during the spike, which is exactly the outcome transient
> scaling exists to prevent. **D** is wrong — sizing the cluster
> permanently for a twice-a-year event means paying for that headroom
> the other ~359 days a year, the definition of unnecessary
> over-provisioning.

**Q7.2** For the `DISTKEY`/join-skew issue on `transactions`, is
`branch_id` (140 distinct values) actually a plausible cause of the
described skew, and what's the right fix?

- A. 140 distinct values is high-cardinality enough that DISTKEY isn't the problem; look at the sort key instead.
- B. 140 values can still produce meaningful skew if transaction volume per branch is uneven (a few flagship branches handling disproportionate volume) — a higher-cardinality, more evenly distributed join column (or `DISTSTYLE AUTO`, letting Redshift choose) is the fix; cardinality count alone doesn't guarantee even data distribution.
- C. Skew from a DISTKEY choice can never be fixed without adding cluster nodes.
- D. Switch `customers` to `DISTSTYLE KEY` on `branch_id` to match, which resolves the skew regardless of `transactions`' own distribution.

> **Answer: B.** This is a deliberately trickier version of the
> classic "low-cardinality DISTKEY causes skew" pattern — 140 values
> is a moderate cardinality, but **distinct value count and even data
> distribution are not the same thing**; if transaction volume itself
> is unevenly spread across those 140 branches (a handful of flagship
> branches driving disproportionate volume), the same node-slice skew
> shows up even though there are "enough" distinct values on paper. The
> deciding fix is still a distribution-style change (higher-cardinality
> key or `AUTO`), not adding nodes. **A** is wrong — the problem isn't
> the sort key; a sort key accelerates range filtering via zone maps
> and has no relationship to join co-location/skew, which is purely a
> distribution-style concern. **C** is wrong — this is exactly the
> class of problem a distribution-style change *does* fix, without
> needing more nodes (echoing Advanced.md Q14/Full-Mock-1 Q2's core
> lesson, now with the added nuance that cardinality alone doesn't
> guarantee even distribution). **D** is wrong — changing the *smaller*
> dimension table's distribution style doesn't address the *larger*
> fact table's own skewed distribution, which is the actual bottleneck
> described.

---

## Scenario 8 — A university research platform needs both fast dashboards and safe self-service

A university's research-computing group gives several hundred
graduate students self-service Athena access to a shared 50 TB dataset
of genomics results, partitioned by project and sample batch. Query
costs have historically been unpredictable because some student
scripts run unbounded exploratory scans. Separately, three specific
faculty labs need a curated, always-fast BI dashboard summarizing
active project statuses for weekly lab meetings, refreshed automatically,
without a live query hitting the underlying dataset on every dashboard
view.

**Q8.1** How should the group control the self-service Athena cost
risk without shutting off access?

- A. Require every student to submit their SQL to a faculty member for approval before running it.
- B. Configure an Athena workgroup with a per-query data usage control (bytes-scanned limit) scoped to the student-access workgroup, separate from any workgroup used for controlled, faculty-approved production queries.
- C. Convert the dataset to uncompressed CSV so runaway scans fail faster on I/O.
- D. Remove Athena access from students entirely and route all requests through a single research-computing staff member.

> **Answer: B.** A workgroup-scoped data usage control is the direct,
> self-service-preserving fix — it caps the damage of any single
> runaway query without requiring approval gates or removing access,
> and scoping it to a dedicated student workgroup (separate from any
> other workgroup with different needs) lets the group apply different
> policies to different populations. **A** and **D** both explicitly
> defeat "self-service," which the scenario wants preserved. **C** is
> wrong and counterproductive — uncompressed CSV increases the volume
> scanned per query (working against cost control, not for it) and
> degrades performance for every legitimate query too.

**Q8.2** For the three faculty labs' always-fast, auto-refreshed
dashboard that shouldn't hit the underlying dataset on every view,
what's the right choice?

- A. Amazon QuickSight with SPICE, refreshed on a schedule, so viewers see cached, fast results without querying the 50 TB dataset directly on every page load.
- B. Amazon QuickSight in direct query mode against Athena, since Athena is already serverless.
- C. A shared spreadsheet manually updated by a graduate student each week.
- D. Increase the Athena workgroup's data usage control limit for the faculty labs so their dashboard queries run faster.

> **Answer: A.** SPICE's in-memory caching is precisely the mechanism
> for "fast for viewers, refreshed on a schedule, not hitting the
> source on every view" — this is the same pattern as the franchise-
> dashboard and restaurant-chain scenarios elsewhere in this repo's
> practice material, applied to a different (research) context. **B**
> is wrong — direct query mode re-queries Athena (and by extension
> scans the underlying dataset) on every interaction, which is exactly
> what the requirement rules out, regardless of Athena being
> serverless. **C** is wrong — manual, error-prone, and not "automatic"
> in any sense. **D** is wrong — a larger scan limit doesn't create
> caching behavior or reduce how often the dashboard queries the
> source; it only raises the ceiling on how much a single query is
> allowed to scan.

---

## Scenario 9 — A telecom's DynamoDB table accumulates awkward access patterns over 3 years

A telecom's `devices` DynamoDB table, keyed by `device_id`, has been
in production for three years. Two new needs have emerged: (1) a
customer-support tool needs to look up all devices for a given
`account_number`, tolerating eventual consistency; (2) a fraud team
needs strongly consistent lookups of a device's records by `imei_hash`,
and this need was actually documented as a requirement back when the
table was first designed, but was deprioritized and never implemented.

**Q9.1** What's the correct indexing decision for each pattern, and
why does the three-year gap matter for one of them?

- A. Add a GSI for both `account_number` and `imei_hash`, since GSIs are always the simpler, more flexible choice regardless of timing or consistency needs.
- B. Add a GSI for `account_number` (eventual consistency is acceptable, and GSIs can be added at any time — the three-year gap doesn't block it); for `imei_hash`, since strong consistency is required, an LSI would have been the natural fit **if added at table creation**, but because it was never implemented back then and the table now exists in production, an LSI is no longer possible — the practical strong-consistency options now are a GSI (accepting eventual consistency, which the fraud team's requirement doesn't allow) or a broader redesign; this tension is the direct cost of the original deprioritization.
- C. Add an LSI for both patterns now, since LSIs are more efficient than GSIs.
- D. Use `Scan` with a filter expression for both patterns, since the table isn't extremely large.

> **Answer: B.** This scenario is built specifically to test whether
> you catch the timing trap: LSIs can **only** be defined at table
> creation, so "documented as a requirement back then, never built,
> and the table has been live for three years" is the exact condition
> that makes an LSI impossible now, not merely inconvenient — an
> important nuance beyond simply knowing "LSI = creation-time only" in
> the abstract. **A** is wrong — GSIs are flexible, but they only
> provide eventual consistency, which explicitly fails the fraud
> team's strong-consistency requirement; "always the simpler choice" is
> not a valid decision rule here. **C** is wrong and factually
> impossible for one of the two patterns (LSI can't be retrofitted onto
> a live table without recreating it entirely) and also wrong for
> `account_number`, which never needed strong consistency in the first
> place. **D** is wrong — `Scan` reads the entire table regardless of
> the filter, which doesn't scale and burns read capacity, exactly what
> indexes exist to avoid.

---

## Scenario 10 — A grocery chain builds a bronze/silver/gold lakehouse and hits a schema-evolution surprise

A grocery chain is building a lakehouse: raw POS transaction files land
in a bronze S3 zone untouched, a Glue job cleans and standardizes them
into a silver Iceberg table, and a second Glue job aggregates silver
into gold Iceberg tables consumed by both Athena dashboards and a
Redshift Spectrum BI tool. Three months in, a POS vendor firmware
update adds a new `loyalty_tier` field to some (not all) incoming
transaction files, and the nightly silver-layer job starts throwing
schema-mismatch errors.

**Q10.1** What's the most appropriate way to handle this at the
bronze-to-silver transform step, given the field is only present in
some files?

- A. Reject any file containing fields not in the originally defined schema.
- B. Read the bronze files as a Glue DynamicFrame (tolerant of per-record schema variation) and use `resolveChoice`/schema merging to reconcile the new optional field, then rely on the silver Iceberg table's schema evolution support (`ALTER TABLE ... ADD COLUMN`) to add `loyalty_tier` without rewriting existing data.
- C. Manually edit every historical file to backfill a `loyalty_tier` value before the job can run again.
- D. Switch the silver table from Iceberg back to plain Parquet, since Parquet handles new fields automatically.

> **Answer: B.** This combines two separate, complementary mechanisms
> correctly: DynamicFrames tolerate the *read-side* variability
> (some files have the field, some don't) the way earlier scenarios in
> this repo's material use them for cross-vendor schema drift, and
> Iceberg's schema evolution handles the *table-side* change (adding a
> column without rewriting existing data files) — exactly the
> capability plain Hive-style Parquet tables lack. **A** is wrong — it
> breaks the pipeline entirely for a routine, expected kind of change
> (a new optional field from an upstream firmware update), rather than
> accommodating it. **C** is wrong — manually rewriting historical
> files is disproportionate and unnecessary; existing rows simply don't
> need a value for a field that didn't exist when they were written
> (they can be null/absent for that column). **D** is backwards —
> plain Parquet does *not* provide in-place schema evolution the way
> Iceberg does; adding a column to an existing Hive-style Parquet
> table's schema generally requires care around how older files (that
> lack the column) are read, and it doesn't offer the same first-class
> `ALTER TABLE` experience Iceberg does — moving away from Iceberg
> here would make the problem harder, not easier.

---

## Scenario 11 — An automotive parts supplier automates a data-quality gate

An automotive parts supplier's nightly Glue job promotes vendor-
submitted parts-catalog files into a curated Redshift-fed zone. Quality
issues have slipped through repeatedly: duplicate `part_number` values,
`price` fields with negative values, and a `weight_kg` column that's
occasionally null when it shouldn't be. The data engineering team
wants automated rule enforcement with minimal custom code, and
wants exploratory profiling available to the analyst who's deciding
what new rules to add next, before those rules are hardened into the
pipeline.

**Q11.1** Which combination of services fits both stated needs?

- A. AWS Glue Data Quality (DQDL rulesets attached to the job, configured to fail on violation) for automated enforcement, and AWS Glue DataBrew for the analyst's exploratory profiling before new rules are finalized.
- B. Amazon Macie for automated enforcement, and Amazon Athena manual queries for profiling.
- C. Custom PySpark assertions inside the Glue job for enforcement, and AWS Glue Data Quality for profiling.
- D. AWS Config rules for automated enforcement, and AWS Glue Studio's visual editor for profiling.

> **Answer: A.** This is precisely the division of labor DQDL and
> DataBrew are each built for: DQDL rules (`IsComplete`,
> `ColumnValues "price" > 0`, `IsUnique "part_number"`, and similar)
> give declarative, no-custom-code enforcement with pass/fail gating,
> while DataBrew's point-and-click profiling is exactly the tool for
> an analyst exploring a dataset's distributions and anomalies *before*
> committing to which rules to formalize. **B** is wrong twice over —
> Macie discovers sensitive/PII data, not business-rule violations like
> negative prices or duplicate keys, and manual Athena queries are not
> the "minimal custom code" analyst-facing profiling tool the scenario
> asks for (that's exactly DataBrew's purpose). **C** is backwards —
> custom PySpark assertions is more code, not less, for the enforcement
> half, and Glue Data Quality is the automated *enforcement* tool, not
> primarily an ad-hoc exploratory profiling tool for a human deciding
> what rules to write next. **D** is wrong — AWS Config evaluates AWS
> *resource* configuration compliance (is this S3 bucket public, is
> this security group open), not dataset content like part numbers or
> prices, and Glue Studio's visual editor builds ETL job graphs, it
> isn't a profiling tool.

---

## Scenario 12 — A power utility's Glue job fails silently on weekends

A power utility's Glue ETL job processes meter readings nightly and
has a scheduled trigger. The operations team discovered, embarrassingly
late, that the job had been failing every Saturday for six weeks
because of a timezone-related edge case in a date filter that only
manifests when the batch spans a particular boundary — but because
their EventBridge alert was scoped to a general "any Glue API error"
CloudTrail-based rule that had grown noisy and was routinely ignored,
nobody noticed.

**Q12.1** What's the most targeted fix to both catch this specific
class of failure quickly *and* stop the general alert fatigue that let
it go unnoticed?

- A. Delete all Glue-related alerting entirely, since it wasn't working anyway.
- B. Replace the noisy CloudTrail-API-error-based rule with an EventBridge rule matching Glue's own job **state-change events** for `FAILED` (a purpose-built, job-outcome-specific event, not a generic API-call-error signal), routed to a dedicated SNS topic, and configure the job's built-in retry so only truly exhausted-retry failures page — narrowing both *what* triggers an alert and *how often*.
- C. Increase the frequency of the nightly schedule so failures are caught sooner.
- D. Switch monitoring entirely to AWS Config, which evaluates resource compliance daily.

> **Answer: B.** This addresses the actual root cause named in the
> scenario: the alert was scoped to the wrong signal (generic
> CloudTrail API errors, which fire for all sorts of noise unrelated
> to *job outcome*) rather than the purpose-built Glue job state-
> change event, which fires specifically and reliably on job success/
> failure. Combining that with retry-aware alerting (page only after
> retries are exhausted, not on every attempt) targets both problems
> at once. **A** is wrong — removing alerting entirely returns to
> "nobody notices until someone happens to look," the exact failure
> mode described. **C** is wrong — running the job more often doesn't
> fix a date-filter logic bug or a poorly scoped alert; it might even
> multiply the noise. **D** is wrong — AWS Config evaluates resource
> *configuration* compliance (is this bucket encrypted, is this
> security group open), not ETL job run outcomes; it's the wrong
> service category for this problem entirely.

---

## Scenario 13 — A biotech firm balances cost across three services at once

A biotech firm's data platform costs have grown faster than data
volume, and a cost review finds three contributing patterns at once:
(1) an Athena workgroup with no data usage control, where a handful of
unoptimized queries regularly scan far more than necessary; (2) a
Redshift provisioned cluster sized for month-end peak, running at that
size 24/7 even though month-end is only 4 days a month; (3) an S3
bucket holding 5 years of raw sequencing files, all still in S3
Standard, almost never accessed after the first 60 days.

**Q13.1** Addressing all three findings, which combination of fixes is
most appropriate?

- A. Set an Athena workgroup data usage control; move the Redshift cluster to Redshift Serverless (or use elastic resize/concurrency scaling around the predictable month-end spike instead of a permanently peak-sized cluster); apply an S3 lifecycle policy transitioning the sequencing files to a cold tier (e.g., S3 Glacier Flexible Retrieval or Deep Archive, depending on the firm's actual retrieval-time tolerance) after 60 days.
- B. Leave Athena unrestricted since query optimization is a developer problem, not a platform problem; keep Redshift sized for peak to avoid any risk of a slow query during month-end; enable S3 Intelligent-Tiering, which is always cheaper than lifecycle rules regardless of pattern predictability.
- C. Shut down Athena access entirely and force all analytics through Redshift; permanently increase Redshift's size further to "future-proof" it; delete sequencing files older than 60 days to save the most money.
- D. Address only the Redshift finding, since compute is typically the largest cost line item, and leave the other two findings for a future review.

> **Answer: A.** Each fix matches the specific, diagnosed pattern: a
> usage control caps runaway Athena scans without removing access;
> right-sizing Redshift to its actual steady load (with transient
> scaling for the *known, predictable* 4-day month-end spike, per this
> repo's repeated concurrency-scaling pattern) avoids paying for peak
> capacity the other 26+ days; and a lifecycle rule matches the
> sequencing files' *known* access pattern (hot for 60 days, then
> essentially cold) — since the pattern here is described as known and
> predictable rather than unpredictable, a lifecycle rule to a
> Glacier tier is a defensible, even more cost-optimal choice than
> Intelligent-Tiering's monitoring-fee-bearing automatic approach,
> though either is reasonable depending on the firm's exact retrieval
> needs. **B** is wrong across all three: unrestricted Athena access
> is precisely how "a handful of queries scan far more than necessary"
> keeps happening; permanently peak-sizing Redshift is exactly the
> over-provisioning the review flagged; and Intelligent-Tiering is not
> "always cheaper" — for a genuinely known, predictable pattern, a
> direct lifecycle rule to the right cold tier can beat Intelligent-
> Tiering's added per-object monitoring fee. **C** is wrong and
> disproportionate on every point — removing Athena entirely eliminates
> legitimate self-service, growing Redshift further makes the
> over-provisioning worse, and deleting 5-year-old sequencing data
> outright (rather than tiering it) likely destroys data the firm may
> be legally or scientifically obligated to retain, with no lifecycle
> alternative even considered. **D** is wrong — the review explicitly
> found three separate, independently-fixable patterns; addressing only
> the largest line item ignores two real, ongoing cost leaks.

---

## Scenario 14 — A cross-border bank moves encrypted data between two of its own accounts

A multinational bank has a "data-producer" AWS account where nightly
Glue jobs write SSE-KMS-encrypted Parquet files (customer-managed key)
to S3, and a separate "analytics" AWS account (different account ID,
same organization) where Redshift Spectrum needs to query that data.
The security team requires that key access be explicitly, individually
auditable per grant — no wildcard cross-account trust relationships.

**Q14.1** What's required, beyond a standard cross-account S3 bucket
policy granting the analytics account's role `s3:GetObject`, to make
this actually work end to end?

- A. Nothing further — an S3 bucket policy granting cross-account access is always sufficient regardless of the object's encryption.
- B. The customer-managed KMS key's key policy must also explicitly grant `kms:Decrypt` (and typically `kms:DescribeKey`) to the specific analytics-account principal — S3 permissions alone don't grant the ability to decrypt SSE-KMS objects; the KMS key policy is a separate, required layer, and scoping the grant to a specific role ARN (rather than a wildcard) satisfies the individually-auditable requirement.
- C. SSE-KMS objects cannot be shared cross-account under any configuration; the data must be re-encrypted with SSE-S3 first.
- D. The two accounts must be merged into one to allow cross-account KMS access.

> **Answer: B.** This is the standard "S3 permission granted, KMS
> permission missing" gap this repo covers repeatedly (LAB context and
> Intermediate.md Q26) applied specifically to the cross-account case —
> both the bucket policy (or equivalent) *and* the KMS key policy need
> to name the accessing principal, and scoping the key-policy grant to
> a specific role ARN (not a wildcard) is exactly what "individually
> auditable, no wildcard trust" requires. **A** is wrong — this is the
> exact trap the scenario is testing; S3-level access does not imply
> the ability to decrypt an SSE-KMS object without a separate KMS
> grant. **C** is wrong — SSE-KMS objects are routinely and safely
> shared cross-account; this is a standard, well-documented pattern
> (S3 bucket policy + KMS key policy), not an impossibility. **D** is
> wrong and absurd relative to the ask — merging accounts is a drastic,
> unrelated organizational change with no bearing on a KMS key-policy
> configuration problem.

---

## Scenario 15 — An insurance holding company scales governance across a growing catalog

An insurance holding company's shared data lake spans 40 subsidiaries
and roughly 1,800 tables, growing by dozens of tables monthly as new
data sources onboard. Governance requirements are twofold: (1) any
table classified "confidential" (a growing, dynamically-tagged set)
must be restricted to a small compliance group regardless of which
subsidiary owns it, applied automatically as new tables get classified
— not via a fresh grant every time; (2) three subsidiaries additionally
share one specific claims table but must each see only their own rows.

**Q15.1** What governance mechanism(s) satisfy both requirements with
the least ongoing administrative burden as the catalog keeps growing?

- A. LF-Tags (tag-based access control) granting the compliance group access wherever the "confidential" tag is applied — new tables inherit the restriction automatically once tagged — combined with a named row-level data filter on the shared claims table scoping each subsidiary to its own rows.
- B. A fresh, individually-scoped Lake Formation grant created manually every time a new table is classified "confidential," and a fully separate physical copy of the claims table per subsidiary.
- C. One broad IAM policy per subsidiary, manually updated whenever the catalog changes, covering both the confidentiality restriction and the row-level restriction.
- D. Move every "confidential" table into a single database with restricted database-level access, and require every subsidiary to submit a support ticket for row-level claims data.

> **Answer: A.** This is the tag-based-plus-row-filter combination this
> repo's material returns to repeatedly for exactly this shape of
> problem — LF-Tags let a growing, dynamically-tagged classification
> ("confidential") extend automatically to new tables without a fresh
> per-table grant, and a named row-level filter is the distinct,
> purpose-built mechanism for the separate per-subsidiary row-
> restriction requirement on one specific shared table; the two
> problems are genuinely different in shape and correctly get two
> different mechanisms rather than one mechanism stretched to cover
> both. **B** is wrong twice — manual per-table grants are precisely
> the growing administrative burden the requirement wants avoided, and
> physically duplicating the claims table per subsidiary creates
> ongoing sync burden and abandons the shared-table model the scenario
> describes. **C** is wrong — IAM has no native column/row-level
> concept for cataloged data, and "manually updated whenever the
> catalog changes" is the exact scaling failure mode being avoided.
> **D** is wrong — forcing all confidential data into one database
> loses per-table nuance (not every "confidential" table necessarily
> belongs in the same database for other operational reasons), and a
> manual ticket process for row-level access isn't an automated,
> governance-model solution at all.

---

## Scenario 16 — A defense contractor's SCP and permission-boundary puzzle

A defense contractor has an SCP attached at the OU level that denies
`ec2:TerminateInstances` for a specific tag condition
(`aws:ResourceTag/Environment = production`), applied org-wide. A data
engineer's IAM role has an identity-based policy explicitly allowing
`ec2:TerminateInstances` on all resources, plus a separately attached
permissions boundary that also allows the action broadly. The engineer
attempts to terminate a production-tagged EC2 instance being used for
an ad-hoc EMR primary node.

**Q16.1** What happens, and why?

- A. The action succeeds, because the identity-based policy and the permissions boundary both explicitly allow it, outvoting the single SCP deny.
- B. The action is denied — an explicit deny at any evaluated layer (here, the SCP) always wins over allows elsewhere in the evaluation, including both the identity-based policy and the permissions boundary; permissions boundaries and identity policies can only ever narrow what's possible relative to each other, and neither can override an SCP.
- C. The outcome depends on whether the permissions boundary or the SCP was attached more recently.
- D. Permissions boundaries specifically are designed to override SCPs, unlike ordinary identity-based policies, so the action succeeds.

> **Answer: B.** This is IAM policy evaluation's most consistently
> tested rule: an explicit deny, wherever it occurs in evaluation
> (SCP, resource policy, permission boundary, or identity policy),
> wins over any allow, and *nothing* — including a permissions boundary
> or an unusually generous identity policy — can override an SCP's
> explicit deny. **A** is wrong and describes evaluation as a vote
> count, which isn't how it works; a single explicit deny anywhere
> ends the evaluation in favor of denial. **C** is wrong — evaluation
> order isn't determined by attachment recency; it's a fixed hierarchy
> (organization-level guardrails like SCPs are evaluated as a hard cap
> regardless of when they were attached). **D** is a fabricated rule —
> permissions boundaries constrain what an identity's own policies can
> grant; they have no special standing to override an SCP, and in fact
> are themselves also subject to it.

---

## Scenario 17 — A hospital network locates and locks down PII sprawl

A hospital network's data platform has grown organically over six
years across 30+ S3 buckets owned by different clinical departments,
with inconsistent naming and no central inventory of what's actually
in each one. A new compliance officer needs to find every location
containing unprotected PHI (protected health information) before a
scheduled audit, and separately wants database credentials used by the
platform's various Aurora clusters rotated automatically going forward,
without hand-writing rotation Lambda functions for each cluster.

**Q17.1** Which combination of services addresses both needs?

- A. Amazon Macie to scan the buckets and automatically discover/classify sensitive data patterns (including PHI-adjacent patterns) across the sprawling, unindexed bucket set, and AWS Secrets Manager with native automatic-rotation integration for the Aurora clusters' credentials.
- B. AWS Config for both the PHI discovery and the credential rotation.
- C. Amazon Kendra to search bucket contents for PHI, and SSM Parameter Store for credential storage with built-in rotation.
- D. Manually audit each of the 30+ buckets department-by-department, and hardcode rotated credentials into each Glue job's script quarterly.

> **Answer: A.** Macie is purpose-built for exactly this discovery
> problem — ML- and pattern-based sensitive-data classification across
> S3 at scale, with no requirement to already know where to look, which
> matters directly given the described sprawl and lack of inventory;
> Secrets Manager's native Aurora rotation integration is the direct
> "no hand-written rotation Lambda per cluster" answer. **B** is wrong
> — AWS Config evaluates resource *configuration* compliance (is
> versioning enabled, is a bucket public), not the sensitive *content*
> of objects, and has no credential-rotation capability at all. **C**
> is wrong — Kendra is a natural-language document search/Q&A service
> for content like PDFs and wikis, not a purpose-built sensitive-data
> classifier; it's the wrong tool category for systematic PII/PHI
> discovery across raw data objects, and Parameter Store's rotation
> support is materially more limited than Secrets Manager's native
> RDS/Aurora integration. **D** is wrong on both counts — manual
> department-by-department audits don't scale to "before a scheduled
> audit" urgency across 30+ buckets, and hardcoding credentials
> (rotated or not) into scripts is a security anti-pattern the
> requirement explicitly wants automated away from.

---

## Scenario 18 — A subscription-box company chases the fastest path from Aurora to two different places

A subscription-box company's order data lives in Aurora PostgreSQL.
The BI team wants near-real-time order data in Redshift for dashboards,
and separately the data science team wants the same order data landing
continuously in S3 (as Parquet) to train a churn model with Spark on
EMR. Both teams want the lowest possible replication lag and the least
custom pipeline code, and leadership specifically asked whether a
single zero-ETL integration could cover both needs at once.

**Q18.1** What's the accurate answer to leadership's question, and the
right architecture?

- A. Yes — a single zero-ETL integration from Aurora PostgreSQL can deliver to both Redshift and S3 simultaneously, since zero-ETL is designed to be destination-agnostic.
- B. No — zero-ETL integrations from Aurora target Redshift specifically; the S3/data-lake leg needs its own mechanism (such as a DMS CDC task, or Aurora's own CDC/export capability feeding S3), configured separately alongside the zero-ETL-to-Redshift leg, since zero-ETL to Redshift doesn't also deliver to S3 as a side effect.
- C. No — zero-ETL cannot be used at all here since Aurora PostgreSQL (unlike Aurora MySQL) doesn't support any zero-ETL integrations.
- D. Yes, but only if the S3 data lake is configured as a Redshift Spectrum external location first.

> **Answer: B.** This is a direct application of a pattern this repo's
> material tests repeatedly (Advanced.md Q6): zero-ETL integrations
> pair a specific source with a specific target (Aurora → Redshift
> being the relevant one here); they are not a universal "deliver
> anywhere" mechanism, so the S3-bound leg for the data science team
> genuinely needs its own, separately configured low-latency
> replication mechanism. **A** is wrong — this is the exact
> misconception the scenario is testing; a single zero-ETL integration
> does not fan out to arbitrary additional destinations. **C** is
> wrong — Aurora PostgreSQL zero-ETL to Redshift is a supported
> pairing (zero-ETL support has expanded to include PostgreSQL-
> compatible Aurora, not just MySQL-compatible); the false claim here
> is about fan-out to multiple destinations, not about PostgreSQL
> support existing at all. **D** is wrong and describes an unrelated,
> non-functional configuration — Redshift Spectrum reads from S3
> *after* data is already there; it doesn't retroactively make a
> Redshift-targeted zero-ETL integration also write to S3.

---

## Scenario 19 — An enterprise legal team wants answers, not documents, and a data marketplace subscription

A law firm's internal knowledge-management team fields constant
questions like "what's our standard indemnification clause for
vendor contracts under $50K?" against a 40,000-document repository of
contracts, memos, and precedent files, and wants employees to get a
direct answer or highlighted passage instead of a ranked list of
documents to open and read themselves. Separately, the firm's
litigation-support team wants to subscribe to a commercial legal-
citations dataset that's updated weekly by a third-party provider,
landed automatically into S3, without building or maintaining any
custom ingestion code against that provider's delivery mechanism.

**Q19.1** Which two services, used together, satisfy both needs?

- A. Amazon OpenSearch Service for the document Q&A, and a custom Lambda function polling the provider's API for the citations dataset.
- B. Amazon Kendra for natural-language document search returning direct answers/highlighted passages, and AWS Data Exchange to subscribe to the third-party legal-citations dataset with delivery configured directly into S3.
- C. Amazon Athena with full-text extensions for the document Q&A, and Amazon Q Developer for the citations subscription.
- D. Amazon Macie for the document Q&A, and AWS AppFlow connecting to the provider as a generic SaaS source for the citations dataset.

> **Answer: B.** Kendra is precisely the ML-powered enterprise search
> service built to return direct answers/highlighted passages from a
> natural-language question against a document repository, rather than
> a ranked list a human still has to open and read; AWS Data Exchange
> is the AWS marketplace purpose-built for subscribing to licensed
> third-party datasets with delivery configured directly into S3 (or
> Redshift), with no custom ingestion pipeline against the provider's
> own delivery mechanism required. **A** is wrong — OpenSearch returns
> ranked, indexed search results a human still has to interpret, not
> Kendra's direct-answer/highlighted-passage behavior out of the box,
> and a custom polling Lambda is exactly the "build and maintain custom
> ingestion code" the litigation-support team wants to avoid. **C** is
> wrong — Athena is a SQL query engine over structured/semi-structured
> data, not a natural-language document Q&A tool, and Amazon Q
> Developer is an IDE-integrated coding assistant, unrelated to
> subscribing to a third-party dataset. **D** is wrong — Macie
> discovers and classifies sensitive data; it has no document-search or
> Q&A capability at all, and AppFlow connects to *named* SaaS
> application APIs (Salesforce, Slack, and similar), not a generic
> commercial dataset marketplace subscription.

---

## Scenario 20 — A mobile-gaming studio wants Iceberg without the maintenance tax, fast

A mobile-gaming studio's live-ops team ingests player-event telemetry
continuously via streaming upserts (correcting mis-attributed events
after the fact) into what they want to be an ACID-compliant, time-
travel-capable lake table, queryable from both Athena (for live-ops
dashboards) and EMR Serverless (for a nightly Spark churn-prediction
job). The team is two data engineers supporting a game with millions
of daily active players, and explicitly does not want to build or
operate their own compaction, snapshot-expiration, or orphan-file
cleanup jobs — that maintenance burden is the reason their *previous*
self-managed Iceberg-on-S3 setup at a prior company became unreliable.

**Q20.1** Given the team's explicit aversion to self-managed table
maintenance (informed by a real prior failure, not a hypothetical
preference), what's the best-fit storage choice?

- A. Apache Iceberg tables on a standard S3 bucket, with the two engineers writing and scheduling their own Glue compaction and snapshot-expiration jobs, since Iceberg itself provides the ACID/time-travel capability regardless of who runs maintenance.
- B. Amazon S3 Tables, providing Iceberg-native table storage with automatic compaction, snapshot management, and orphan-file cleanup handled by AWS — directly removing the specific maintenance burden the team says caused their prior setup's reliability problems, while still delivering full ACID/time-travel/streaming-upsert support and native Athena/EMR compatibility.
- C. A plain Hive-style partitioned Parquet table, since it requires no table-format-specific maintenance at all.
- D. Delta Lake tables on a Databricks-managed cluster, since Databricks handles all maintenance automatically.

> **Answer: B.** This scenario is explicitly built so the "textbook"
> Iceberg answer (A) is technically correct on ACID/time-travel
> capability but wrong on the actual deciding constraint: a two-person
> team that has *already been burned* by self-managed table
> maintenance is exactly who Amazon S3 Tables exists for — same
> Iceberg capabilities, but AWS operates compaction/snapshot-expiration/
> cleanup instead of the team. **A** is the near-miss — it satisfies
> the ACID/time-travel/streaming-upsert requirements, but reintroduces
> precisely the self-managed maintenance burden the scenario says
> already caused a reliability failure once; picking it ignores the
> most emotionally and technically weighted sentence in the stem. **C**
> is wrong — plain Parquet has no ACID transactions, no time travel,
> and no native row-level streaming-upsert support at all, failing the
> core functional requirements, not just the maintenance preference.
> **D** is wrong — introducing a Databricks-centric managed cluster
> pulls the team into a different, non-AWS-native toolchain and cost
> model for a two-person team already operating natively on
> Athena/EMR, and isn't the direction this repo's currency guidance
> favors when an AWS-native option (S3 Tables) meets the same
> requirements.
