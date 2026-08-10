# Architecture / System-Design Interview Questions — Data Engineering

> **Job-interview prep, not exam prep.** These are the "design a
> pipeline for..." prompts that show up in senior and staff data
> engineering loops. A system-design interview is not "name the right
> AWS services" — it's watching how you think: what you ask before you
> design anything, what trade-offs you name out loud, and how you
> defend the design when the interviewer starts poking at it.
>
> Format for each of the 13 prompts below: **clarifying questions** a
> strong candidate asks first, a **full worked architecture** (ASCII
> diagram, every arrow explained in prose — same convention as the rest
> of this repo), **key design decisions and the alternatives
> considered**, **how it scales**, and **2-3 follow-up questions** an
> interviewer is likely to probe with, plus how to answer them.

---

## 1. Real-time fraud detection for a bank processing 50,000 transactions/second

**Prompt:** *"Design a real-time fraud detection pipeline for a bank
processing 50,000 transactions per second. Every transaction must be
scored before it's approved."*

**Clarifying questions to ask first:**
- What's the actual latency budget for a scoring decision — is this
  synchronous (blocking the transaction) or can approval proceed while
  scoring happens in parallel with a claw-back path?
- Is a false negative (missed fraud) or a false positive (blocked
  legitimate transaction) more costly to this bank's business — that
  changes how aggressively the model should decline vs. flag for review?
- Does scoring need the customer's recent transaction history (stateful,
  windowed) or can each transaction be scored independently (stateless)?
- What are the regulatory/audit requirements — does every scoring
  decision need to be explainable and retained for examiners?
- Is there an existing fraud model, or is this a new system where the
  model itself is still being developed and needs a feedback loop from
  investigator outcomes?

**Worked architecture:**

```
Card networks / mobile app / ATM
              |
              v
     Kinesis Data Streams (on-demand mode, 24h+ retention)
              |
   +----------+-----------+
   |                       |
   v                       v
Managed Service          Lambda (event source mapping,
for Apache Flink         enhanced fan-out consumer)
(stateful scoring:        |
 rolling spend/velocity   v
 features per account,   DynamoDB (account velocity /
 windowed aggregation)    recent-transaction state, single-
   |                      digit ms reads for real-time lookup)
   v
Score >= threshold?
   |               |
  YES              NO
   |               |
   v               v
SNS -> decline/    Approve, write transaction to
review queue        raw S3 zone (bronze, immutable)
   |                     |
   v                     v
Fraud analyst UI    Glue ETL (nightly, batch) -> curated
(SQS-backed          Iceberg tables -> Redshift (compliance
review workflow)     reporting, model retraining feature store)
```

Reading the diagram: transactions arrive from card networks, the
mobile app, and ATMs and land on **Kinesis Data Streams** in on-demand
mode — on-demand removes shard-management burden and the stream's
durability means a downstream consumer outage doesn't lose transactions
mid-scoring. Two consumers read the same stream via **Enhanced
Fan-Out** so neither competes with the other for the shard's read
throughput: **Managed Service for Apache Flink** maintains the
stateful, windowed features (a rolling 10-minute spend velocity per
account, for example) that a single transaction alone can't tell you,
because "is this abnormal for this account" is inherently a
comparison against recent history, not a property of one event in
isolation. In parallel, a **Lambda** consumer does the low-latency
per-transaction lookup against **DynamoDB**, which holds precomputed
account-state and velocity features Flink continuously writes back to
it, giving Lambda a single-digit-millisecond read instead of
recomputing a window on the hot path. If the combined score clears the
fraud threshold, the transaction is declined or routed to a fraud
analyst's review queue via SNS/SQS; either way, every transaction — fraud
or not — is written to an immutable raw S3 zone, because that's what
lets a nightly Glue job rebuild curated Iceberg tables for compliance
reporting and lets the model retraining pipeline pull ground-truth
labels (confirmed fraud vs. false positive) from analyst outcomes
later.

**Key design decisions and alternatives considered:**
- **Kinesis over MSK:** no existing Kafka investment stated in the
  prompt, and Kinesis's native EFO + Lambda event source mapping
  integration avoids operating a broker fleet for a bank team that
  would rather not own Kafka patching on top of everything else in
  scope.
- **Flink for stateful features, Lambda for the synchronous decision
  path:** splitting these matters because Flink's windowed
  computation and Lambda's single-transaction latency have different
  jobs — trying to do both in one component either makes the
  synchronous path too slow (waiting on a live window computation) or
  makes the windowed computation stateless and wrong.
- **DynamoDB as the feature store for the hot path, not Redshift or
  S3:** the synchronous scoring decision cannot wait on a warehouse
  query; DynamoDB's latency profile is the only one of the candidate
  stores that fits inside a real-time decision budget.
- **At-least-once + idempotent writes, not exactly-once:** chasing
  exactly-once across Kinesis, Flink, and DynamoDB is expensive and
  largely unnecessary here — the fraud score itself is deterministic
  given the same input state, so a duplicate scoring event produces the
  same score, and the write to DynamoDB (or an audit log) is a
  conditional write keyed on transaction ID to prevent double-counting
  a duplicated event as two transactions.

**How it scales:** Kinesis on-demand mode scales shard count
automatically with throughput; Flink scales by adding parallelism
(task slots) and is checkpointed so a task failure recomputes from the
last checkpoint rather than losing in-flight state; DynamoDB on-demand
capacity absorbs the read/write burst from 50,000 TPS without manual
provisioning. The one component worth calling out explicitly in an
interview: Lambda concurrency needs a reserved-concurrency floor sized
to worst-case burst so scoring never gets throttled at exactly the
moment fraud volume spikes (which, not coincidentally, is often when
fraud actually happens — attackers probe for exactly these gaps).

**Follow-up questions and how to answer them:**
- *"What happens if Flink falls behind and the velocity feature is
  stale by the time Lambda reads it?"* Answer: state a explicit
  staleness tolerance up front (e.g., "500ms is acceptable, we alert if
  `IteratorAge`/Flink lag exceeds it") rather than pretending real-time
  systems are never stale — and note that DynamoDB always holds the
  *last successfully computed* feature value, so Lambda degrades to
  "slightly stale features" rather than failing outright.
- *"How would you handle a sudden 10x spike in transaction volume,
  like Black Friday?"* Answer: on-demand Kinesis and DynamoDB already
  absorb this; the thing to actually watch is Lambda concurrency limits
  and Flink parallelism headroom, both of which need pre-provisioned
  slack rather than reactive scaling, because reactive scaling on the
  fraud path during a legitimate traffic spike is exactly when you
  can't afford added latency.
- *"How do you avoid the model itself becoming stale as fraud patterns
  evolve?"* Answer: the analyst review outcomes feeding back into the
  curated zone aren't just for compliance reporting — they're labeled
  training data for periodic model retraining, which is why the
  architecture treats every decision (correct or wrong) as data to
  capture, not just the flagged ones.

---

## 2. Healthcare data platform: real-time alerts + quarterly compliance reporting

**Prompt:** *"Design a data platform for a healthcare company that
needs to support both real-time patient-monitoring alerts and quarterly
HIPAA compliance reporting."*

**Clarifying questions to ask first:**
- What actually counts as an "alert" — a bedside vital-signs threshold
  breach, or something requiring more context (trend over time, not a
  single reading)?
- What's the true latency requirement for an alert reaching a
  clinician — seconds, matching a life-safety requirement, or minutes?
- What's the retention requirement for raw clinical data — HIPAA and
  many state regulations require multi-year retention regardless of
  whether the data is still "useful" operationally.
- Who consumes the compliance report, and does it need full audit
  trail (who accessed what PHI, when) in addition to the clinical data
  itself?
- Is PHI required to stay within specific geographic/regulatory
  boundaries, and does access need field-level masking for different
  consumer roles (clinician vs. analyst vs. auditor)?

**Worked architecture:**

```
Bedside monitors / wearables (HL7 / FHIR events)
              |
              v
     Kinesis Data Streams (real-time, replay 7 days)
              |
   +----------+-----------------------+
   |                                   |
   v                                   v
Managed Flink                    Amazon Data Firehose
(threshold + trend                (buffered delivery,
 detection, sub-2-second)          format conversion to
   |                                Parquet)
   v                                   |
SNS -> clinician alert                 v
(paging system integration)      S3 RAW/BRONZE ZONE
                                  (immutable, encrypted
                                  SSE-KMS, Object Lock for
                                  compliance retention)
                                        |
                                  Glue ETL (nightly)
                                        |
                                        v
                                  S3 CURATED ZONE (Iceberg,
                                  PHI columns tagged via
                                  Lake Formation LF-Tags)
                                        |
                          +-------------+-------------+
                          v                             v
                    Athena / Redshift              CloudTrail data events
                    (quarterly compliance           (who accessed which
                    reports, row/column-level        PHI record, when)
                    security via Lake Formation)            |
                                                              v
                                                    Compliance audit report
```

Reading the diagram: the same HL7/FHIR event stream from bedside
devices feeds **two independent consumers off one Kinesis stream**,
which is the core design decision this prompt is testing — real-time
alerting and compliance reporting are different SLAs with different
failure tolerances, and coupling them into one pipeline would mean a
compliance-reporting slowdown could delay a life-safety alert.
**Managed Flink** handles the sub-2-second threshold and trend
detection (a single abnormal reading vs. a *trend* toward abnormal are
different clinical signals, which is why this needs stateful windowed
computation, not a stateless rule) and pages a clinician through SNS
the moment a threshold is crossed. In parallel, **Amazon Data
Firehose** buffers the same stream and delivers it to an S3 raw zone
with format conversion to Parquet built in — Firehose's ~60-second
buffer is completely acceptable here because this path serves quarterly
reporting, not real-time alerting, and using Firehose instead of a
custom Glue streaming job removes an entire class of operational
overhead for a path that doesn't need sub-second latency. The raw zone
uses **S3 Object Lock** for immutable, tamper-evident retention — a
real HIPAA/compliance requirement, not just a nice-to-have — and a
nightly Glue job curates it into **Iceberg** tables with PHI columns
tagged through **Lake Formation LF-Tags**, so column-level access
control (a clinician sees full records, an analyst sees a de-identified
view) is enforced centrally rather than duplicated per consuming
service. **CloudTrail data events** capture every read of PHI-tagged
S3 objects, which feeds directly into the audit trail half of the
quarterly compliance report — "who accessed this patient's record and
when" is as much a compliance deliverable as the clinical data itself.

**Key design decisions and alternatives considered:**
- **Two consumers off one stream, not two separate pipelines:** avoids
  duplicating ingestion logic and device-connection management while
  still fully decoupling the two SLAs downstream — this is the fan-out
  pattern, and it's the right call whenever two consumers need
  fundamentally different latency guarantees from the same source data.
- **Firehose for the compliance path, not a Glue streaming job:** the
  compliance path tolerates a 60-second buffer, so Firehose's built-in
  format conversion and zero-ops delivery beats hand-building
  equivalent logic in a Glue streaming job that would need to be
  operated and monitored continuously for no latency benefit anyone
  needs.
- **Lake Formation LF-Tags over per-service access logic:** with
  multiple downstream consumers (clinicians via a different app,
  analysts via Athena, auditors via reporting), enforcing PHI masking
  once at the catalog/lake level is dramatically less error-prone than
  reimplementing the same masking rule in every consuming application.
- **S3 Object Lock on the raw zone specifically, not the curated
  zone:** the raw zone is the system of record for "what did we
  actually receive" — that's what an auditor or a legal hold cares
  about; the curated zone can be rebuilt from raw at any time, so
  immutability matters most where reprocessing originates.

**How it scales:** Kinesis on-demand absorbs growth in the number of
monitored devices without a resharding conversation; Flink's
parallelism scales with shard count; Firehose scales transparently.
The dimension that actually strains at scale here is Lake Formation
policy management as the number of tables and consumer roles grows —
worth naming explicitly that LF-Tag-based policies (tag data once,
grant by tag) scale far better than per-table grants as the catalog
grows into hundreds of tables.

**Follow-up questions and how to answer them:**
- *"How do you make sure a real HIPAA incident — PHI landing somewhere
  it shouldn't — gets caught?"* Answer: Amazon Macie scanning the raw
  and curated zones for unexpected PHI patterns, run on a schedule and
  triggered on new object arrival, complementing (not replacing) the
  LF-Tag access controls — Macie catches *misclassified* data that
  landed outside the zones/tags it should have been tagged with.
- *"What if the alerting path (Flink) goes down — do patients lose
  monitoring?"* Answer: Kinesis's retention window means no data is
  lost even if Flink is down; the honest answer is that a real
  life-safety system needs a documented failover — either a redundant
  Flink application in a second AZ/region, or a fallback to a simpler
  threshold check running directly off the Kinesis event source
  mapping into Lambda as a degraded-but-functional backup.
- *"How would this change if the company needed multi-region
  disaster recovery?"* Answer: cross-region S3 replication for the raw
  zone (with Object Lock preserved), and a discussion of whether Kinesis
  needs multi-region producers or whether DR here really means
  "reporting keeps working," which has a much lower bar than "real-time
  alerting keeps working during a regional outage" — naming that
  distinction out loud is the senior-level answer.

---

## 3. Clickstream analytics platform for a large e-commerce retailer

**Prompt:** *"Design a platform that captures clickstream data from a
retailer's website and mobile app to power both real-time
personalization and next-day BI reporting."*

**Clarifying questions to ask first:**
- What does "real-time personalization" actually need — a
  recommendation shown on the *next* page view (needs sub-second), or
  a recommendation in tomorrow's email campaign (batch is fine)?
- What's the expected event volume and burst pattern — clickstream is
  famously bursty around sales events, not steady state.
- Does every event need to be retained for replay/reprocessing (a
  future ML feature might need historical clicks), or is this
  disposable telemetry?
- Who are the BI consumers, and how many concurrent dashboard users —
  this decides Athena vs. Redshift downstream.
- Are there privacy/consent requirements (GDPR-style) that require
  being able to delete an individual user's click history on request?

**Worked architecture:**

```
Website / mobile app (client-side event SDK)
              |
              v
     API Gateway -> Kinesis Data Streams (on-demand)
              |
   +----------+------------------------+
   |                                    |
   v                                    v
Lambda (event source mapping)     Amazon Data Firehose
  |                                 (dynamic partitioning
  v                                  by event_type/date,
DynamoDB (per-session recent        Parquet conversion)
click history, feeds real-time         |
recommendation lookup)                 v
  |                                S3 RAW ZONE (Iceberg
  v                                table, partitioned)
Recommendation service                 |
(reads session history,          Glue ETL (hourly)
returns next-best-item)                |
                                        v
                                  S3 CURATED ZONE (Iceberg,
                                  deduped, sessionized,
                                  bot traffic filtered)
                                        |
                              +---------+---------+
                              v                     v
                        Athena (ad-hoc          Redshift (nightly
                        product/marketing        BI dashboards,
                        analyst queries)          exec reporting)
```

Reading the diagram: client-side events hit **API Gateway** (handling
auth, throttling, and request validation at the edge) and land on
**Kinesis Data Streams**, fanning out to two consumers exactly as in
the fraud-detection and healthcare examples above — the pattern
repeats because it's the correct answer whenever real-time and batch
consumers need the same source data at different latencies. The
real-time path runs through **Lambda** into **DynamoDB**, which holds
a rolling window of each active session's recent clicks — the
recommendation service reads that session history directly from
DynamoDB for single-digit-millisecond lookups, because a
recommendation that takes 500ms to compute has already lost the user's
attention by the time it renders. The reporting path runs through
**Firehose with dynamic partitioning** — partitioning by `event_type`
and date at write time rather than requiring a downstream job to
reorganize files afterward — landing Parquet directly in an **Iceberg**
raw zone. An hourly Glue job produces a curated zone that's
deduplicated (clickstream SDKs routinely fire duplicate events on
flaky mobile connections), sessionized, and filtered for bot traffic,
because none of those three things belong in a raw zone (which should
mirror exactly what was received) but all three would corrupt
analytics if left unhandled. Analysts query the curated zone through
**Athena** for ad-hoc questions and through **Redshift** for the
recurring executive dashboards that need real concurrency.

**Key design decisions and alternatives considered:**
- **DynamoDB for session state, not a query back to the lake:** the
  real-time recommendation path cannot wait on an Athena/Redshift
  query; DynamoDB's latency and its natural fit for "look up by session
  ID" access pattern make it the only real candidate for this specific
  hop.
- **Iceberg from day one, not plain Hive-partitioned Parquet:** a
  GDPR-style "delete this user's history" request against a Hive table
  means rewriting whole partitions; Iceberg's row-level delete makes
  that request tractable at retailer scale where a popular SKU's click
  events could span thousands of files per day.
- **Dynamic partitioning in Firehose over a separate repartitioning
  job:** doing the partitioning at write time (Firehose feature) avoids
  running a whole extra Glue job whose only purpose is reorganizing
  files that could have been organized correctly on the way in.
- **Bot filtering and dedup in the curated layer, not the raw layer:**
  keeping the raw zone an unmodified mirror of what was actually
  received preserves the ability to re-derive the curated zone
  differently later (a better bot-detection heuristic, for instance)
  without needing to re-ingest.

**How it scales:** Kinesis on-demand and Firehose both absorb
clickstream's bursty sale-event traffic without manual resharding;
DynamoDB on-demand absorbs the session-write burst the same way. The
one place that needs explicit design for scale: Iceberg table
maintenance (compaction) has to keep pace with an hourly-partitioned,
high-volume table, or query performance degrades from accumulated small
files — this is a good place to mention **S3 Tables** as the managed
answer that removes that maintenance burden entirely.

**Follow-up questions and how to answer them:**
- *"How do you handle a user's GDPR deletion request against this
  architecture?"* Answer: the DynamoDB session record ages out or is
  deleted directly (it's short-lived by design); the Iceberg curated
  and raw tables support row-level delete keyed on user ID, which is
  exactly the capability that made Iceberg the right choice in the
  first place rather than a plain partitioned table.
- *"What happens if the recommendation service can't reach DynamoDB
  in time?"* Answer: define a strict timeout with a graceful fallback
  — serve a non-personalized "popular items" recommendation rather than
  blocking the page render, because a slow personalization is worse for
  the business than a generic one.
- *"How would you detect that the bot-filtering logic itself has
  started misclassifying real users?"* Answer: track the filtered-out
  volume as a monitored metric over time, not just a one-time rule —
  a sudden jump in bot-classified traffic is itself a signal worth
  alerting on, since it usually means either a real bot attack or a
  regression in the filter logic, and distinguishing those requires the
  metric to exist in the first place.

---

## 4. Predictive maintenance platform for a manufacturing company's factory sensors

**Prompt:** *"Design a platform for a manufacturing company that
ingests sensor data from thousands of machines across multiple
factories to predict equipment failures before they happen."*

**Clarifying questions to ask first:**
- What's the actual sensor volume and frequency per machine — this
  changes everything about shard/partition sizing.
- Is there reliable, high-bandwidth connectivity at every factory, or
  do some sites have intermittent/low-bandwidth connections that change
  the ingestion pattern?
- Does the prediction need to run at the edge (stop a machine before it
  fails, locally, without waiting on a round trip to the cloud) or is
  cloud-side batch prediction acceptable?
- What's the cost of a false positive (unnecessary maintenance,
  production downtime) vs. a false negative (equipment failure, safety
  risk)?
- Is there an existing historical dataset of sensor readings paired
  with known failure events to train against, or does this system need
  to start collecting that labeled data from scratch?

**Worked architecture:**

```
Factory floor sensors (thousands per site, multiple sites)
              |
   AWS IoT Core (device registry, MQTT ingestion, edge rules)
              |
              v
     Kinesis Data Streams (per-region stream, on-demand)
              |
   +----------+-----------------------+
   |                                   |
   v                                   v
Managed Flink                    Amazon Data Firehose
(rolling statistical features:    (buffered, Parquet
 vibration variance, temp          conversion)
 trend, sub-minute)                    |
   |                                   v
   v                             S3 RAW ZONE (Iceberg,
DynamoDB (per-machine             partitioned by site/
current health score)             machine/date)
   |                                   |
   v                             Glue ETL (nightly) ->
Threshold breach?                 curated feature tables
   |         |                         |
  YES        NO                        v
   |         |                   SageMaker (batch training,
   v         v                    failure-prediction model,
EventBridge  (continue             retrained weekly on
-> work order  monitoring)         growing labeled dataset)
in CMMS system                          |
                                         v
                                   Model deployed back to
                                   Flink job for scoring
```

Reading the diagram: **AWS IoT Core** is the entry point specifically
because it's purpose-built for device fleets — device registry,
certificate-based auth per machine, and MQTT protocol support that
factory-floor sensors and PLCs already speak, which a raw Kinesis
PutRecord call from thousands of heterogeneous devices would need to
reimplement badly. IoT Core forwards ingested telemetry into
**Kinesis Data Streams**, and the same fan-out pattern as the previous
three examples applies: **Managed Flink** computes rolling statistical
features per machine (vibration variance over a window, temperature
trend) because a single sensor reading rarely predicts failure — it's
the *trajectory* that matters, which is inherently a windowed,
stateful computation. Flink writes a current health score per machine
to **DynamoDB**, and a threshold breach fires an **EventBridge** event
that creates a work order directly in the factory's maintenance system
(CMMS) — closing the loop from "sensor data" to "actual maintenance
action" rather than stopping at a dashboard nobody watches in real
time. In parallel, **Firehose** lands the same raw telemetry in an
Iceberg data lake, partitioned by site, machine, and date; a nightly
Glue job curates feature tables, and **SageMaker** retrains the
failure-prediction model weekly against the growing labeled dataset
(labels come from actual maintenance/failure records joined back to
sensor history) — the retrained model is then redeployed into the
live Flink scoring job, closing the loop between "the model gets
smarter over time" and "the real-time detection uses the latest
model."

**Key design decisions and alternatives considered:**
- **IoT Core instead of raw Kinesis ingestion:** for a *fleet* of
  heterogeneous, potentially intermittently-connected devices, IoT
  Core's device management, per-device certificates, and MQTT support
  solve a real problem raw stream ingestion doesn't address at all —
  this is the same "purpose-built beats general-purpose" logic as
  AppFlow vs. hand-rolled API polling.
- **Per-region Kinesis streams, not one global stream:** multiple
  factory sites likely span regions or at least benefit from
  geographically closer ingestion endpoints to reduce latency and avoid
  a single stream becoming a cross-region bottleneck for a
  latency-sensitive detection path.
- **Rolling statistical features in Flink rather than raw-value
  thresholding:** a fixed threshold on a raw sensor value produces far
  more false positives/negatives than a trend-aware feature, because
  normal operating ranges vary by machine, age, and environment — this
  is the "stateful vs. stateless" distinction and predictive maintenance
  is fundamentally a stateful problem.
- **Weekly batch retraining, not online/continuous learning:** given
  the cost asymmetry of false negatives (safety) vs. the operational
  complexity of continuous model updates, a reviewed, weekly retraining
  cadence with human validation before redeployment is the more
  defensible choice for a safety-relevant model than an unsupervised
  continuously-updating one.

**How it scales:** IoT Core and Kinesis both scale with device count
and message rate largely automatically; the real scaling conversation
is around **shard/stream design per factory site** to avoid one noisy
site's sensor burst starving another site's stream, which argues for
per-site or per-region streams rather than one shared global stream.
SageMaker batch training scales by adjusting instance type/count for
the training job independent of the real-time path entirely.

**Follow-up questions and how to answer them:**
- *"What happens if a factory loses internet connectivity for six
  hours?"* Answer: IoT Core supports local rule processing and buffering
  at the edge (via AWS IoT Greengrass) so critical local alerting still
  functions offline, with a backlog syncing to the cloud on
  reconnection — the honest caveat to state is that this needs to be
  designed in explicitly, not assumed, because a naive "always connected"
  design fails badly at exactly the moment connectivity is worst.
- *"How do you validate the model isn't drifting as machines age or
  seasons change?"* Answer: track prediction accuracy against actual
  outcomes (a failure predicted vs. a failure that occurred) as a
  monitored metric over time, not just at initial training — model
  drift detection is itself a pipeline that needs to exist, comparing
  weekly retrained-model performance against a held-out validation set.
- *"Could this whole pipeline run on EMR instead of Flink/SageMaker?"*
  Answer: EMR could do the batch training and feature engineering side
  reasonably (and might, for the nightly Glue-adjacent steps), but the
  real-time windowed scoring specifically needs a stream-processing
  engine with checkpointed state — that's Flink's actual job, and
  EMR's batch-shaped execution model doesn't fit a continuous scoring
  requirement without essentially rebuilding Flink's capabilities badly.

---

## 5. Multi-tenant SaaS analytics platform with isolated customer dashboards

**Prompt:** *"Design a data platform for a B2B SaaS company that gives
each of its ~2,000 customers an embedded analytics dashboard showing
their own usage data, with strict tenant isolation."*

**Clarifying questions to ask first:**
- What does "strict isolation" mean concretely here — is this a
  contractual/compliance requirement (a customer must never even
  theoretically be able to see another customer's data via a bug), or
  a UX preference?
- What's the largest tenant's data volume relative to the smallest —
  is this a "long tail with a few whales" distribution, which changes
  how shared infrastructure needs to be designed to avoid one tenant's
  query load starving another's?
- Does each tenant need real-time usage data in their dashboard, or is
  next-day/hourly acceptable?
- Is there a requirement for per-tenant data residency (different
  tenants' data must stay in different geographic regions)?
- What's the actual query pattern — pre-built dashboard widgets only,
  or does the platform need to support tenant-defined custom queries?

**Worked architecture:**

```
Application services (per-tenant usage events)
              |
              v
     Kinesis Data Streams (partition key = tenant_id)
              |
              v
     Amazon Data Firehose (dynamic partitioning by
     tenant_id/date, Parquet conversion)
              |
              v
     S3 DATA LAKE (Iceberg, partitioned by tenant_id first,
     then date -- tenant_id as the leading partition key
     is the isolation mechanism)
              |
     Lake Formation (row-level security policy: every query
     is scoped to the requesting tenant_id, enforced centrally,
     not per-application-query)
              |
              v
     Redshift Serverless (multi-tenant, RLS-enforced) OR
     Athena (per-tenant workgroup, cost/query isolation)
              |
              v
     Embedded BI layer (QuickSight embedded dashboards,
     row-level security tied to the logged-in tenant's identity)
```

Reading the diagram: every usage event is tagged with `tenant_id` at
the source and that field becomes the **partition key on Kinesis**,
which matters for a subtle reason beyond storage layout — it keeps one
tenant's write burst from monopolizing the shard(s) another tenant's
events land on, an early form of the isolation the whole system is
built around. **Firehose's dynamic partitioning** writes each tenant's
data into its own partition prefix (`tenant_id=X/date=Y/`) automatically,
which is the physical foundation of isolation: a query scoped to one
tenant only ever touches that tenant's own S3 prefixes. The genuinely
load-bearing decision is putting isolation enforcement in **Lake
Formation row-level security**, not in each application's SQL — every
query, regardless of which service or analyst runs it, is
automatically scoped to the requesting tenant's ID at the catalog
layer, which means a bug in one dashboard's query logic cannot leak
another tenant's rows, because the enforcement doesn't depend on that
query being written correctly. Downstream, either **Redshift
Serverless** (if tenants need fast, concurrent BI-style queries) or
**Athena with per-tenant workgroups** (if cost/usage tracking per
tenant matters, since workgroups give clean cost attribution) serves
the actual dashboard queries, and **QuickSight embedded dashboards**
tie row-level security to the logged-in tenant's identity so the
embedded iframe a customer sees is provably scoped to just their data.

**Key design decisions and alternatives considered:**
- **`tenant_id` as the leading partition key, not date:** date-first
  partitioning is the default instinct for time-series data, but for a
  multi-tenant system the isolation requirement outranks the
  time-range-query convenience — tenant-first partitioning means a
  single tenant's query never has to filter out other tenants' data
  from a scanned partition, which is both a performance and a security
  property.
- **Centralized enforcement (Lake Formation) over per-service
  filtering:** the alternative — trusting every application team to
  correctly add `WHERE tenant_id = ?` to every query — is a real,
  repeated source of data leaks in multi-tenant systems industry-wide;
  centralizing the control removes the possibility of a single missed
  filter becoming a breach.
- **Redshift Serverless over provisioned Redshift for this workload
  specifically:** with ~2,000 tenants and an assumed long-tail usage
  distribution, most tenants generate light, bursty query load — paying
  for always-on provisioned capacity sized for the busiest tenant's
  peak would badly overpay for the other 1,999.
- **Considered and rejected: separate database per tenant.** Full
  physical isolation (a dedicated schema or cluster per tenant) gives
  the strongest isolation guarantee but doesn't scale operationally to
  2,000 tenants — schema migrations, monitoring, and cost all multiply
  by tenant count; shared infrastructure with enforced logical
  isolation is the more maintainable answer at this scale, reserved for
  a specific whale tenant only if their contract genuinely requires
  physical isolation.

**How it scales:** partitioning and RLS enforcement scale with tenant
count without a redesign; the actual risk at scale is a handful of
"whale" tenants generating disproportionate query load against shared
Redshift Serverless capacity, which argues for monitoring per-tenant
RPU consumption and potentially carving out dedicated capacity for the
handful of tenants who need it, while the long tail stays on shared
infrastructure.

**Follow-up questions and how to answer them:**
- *"How would you handle a tenant who wants their data permanently
  deleted (contract termination)?"* Answer: because the lake is
  Iceberg and partitioned by `tenant_id` first, deletion is a clean,
  bounded operation — drop that tenant's partitions rather than a
  scan-and-filter delete across a mixed-tenant table, which is exactly
  the kind of operation the tenant-first partitioning choice was
  designed to make cheap.
- *"What if one tenant's usage volume is 1000x every other tenant's?"*
  Answer: name it explicitly as a hot-partition risk analogous to a
  DynamoDB hot key, and propose giving that tenant dedicated
  provisioned Redshift capacity or a separate workgroup rather than
  letting their load degrade shared Serverless capacity for everyone
  else — this is a real operational conversation to have proactively,
  not something to discover from a complaint.
- *"How do you prove to an auditor that isolation actually works, not
  just that it's designed to?"* Answer: Lake Formation and CloudTrail
  data events provide an audit log of every query and the tenant scope
  it was executed under; a periodic automated test that attempts
  cross-tenant access and confirms it's denied is the concrete evidence
  an auditor (and a security review) will actually want to see, not just
  the architecture diagram.

---

## 6. Migrating a legacy on-prem data warehouse to a cloud-native lakehouse

**Prompt:** *"A retailer has run a 15-year-old on-prem Teradata
warehouse feeding hundreds of nightly reports. Design a migration to a
cloud-native lakehouse on AWS with minimal business disruption."*

**Clarifying questions to ask first:**
- How many of those "hundreds of reports" are actually still used
  regularly, versus legacy artifacts nobody's audited in years? This
  changes the scope enormously.
- Is this a lift-and-shift (same schema, same SQL, different
  infrastructure) or an opportunity to redesign the data model?
- What's the acceptable cutover risk — can the business tolerate a
  short reporting freeze, or does this need to run in parallel with
  zero interruption?
- Are there stored procedures, custom Teradata SQL extensions, or
  BTEQ scripts that need conversion, and who owns validating that
  converted logic is correct?
- What's actually driving the migration — cost, EOL support on the
  Teradata hardware, or a strategic move to enable capabilities
  Teradata can't provide (streaming, ML integration, data sharing)?

**Worked architecture:**

```
PHASE 1 -- Assessment & parallel run
  Teradata (existing, unchanged)              AWS (new, being built)
       |                                              |
       |  DMS Schema Conversion (schema, stored        |
       |  procs, views -- converts Teradata SQL         |
       |  dialect to Redshift-compatible SQL)            |
       +------------------------------------------------+
                            |
                            v
                 AWS DMS (full load, then CDC where
                 Teradata's change feed allows it)
                            |
                            v
                 S3 RAW ZONE (Iceberg) --------> Glue ETL
                            |                          |
                            v                          v
                 S3 CURATED ZONE (Iceberg)  <---  parallel-run
                            |                     validation job
                            v                     (row counts, checksums,
                 Redshift (new warehouse,          sampled report diffs
                 converted schema)                 vs. Teradata output)

PHASE 2 -- Cutover (per report group, staged)
  Reports repointed from Teradata to Redshift, one group at a time,
  validated against parallel-run output before each cutover.

PHASE 3 -- Decommission
  Teradata decommissioned only after every report group has run
  successfully against AWS for an agreed validation window.
```

Reading the diagram: the migration deliberately runs in three
sequential phases rather than a single cutover weekend, because the
actual risk in a 15-year-old warehouse migration isn't the technology,
it's the accumulated undocumented business logic living in stored
procedures nobody's touched since they were written. **Phase 1**
starts with **DMS Schema Conversion** translating Teradata's SQL
dialect (stored procedures, views, BTEQ-script logic) into
Redshift-compatible SQL — automated, but explicitly treated as a
starting draft requiring engineer review, not a trusted final output,
because dialect conversion tools reliably get the common cases right
and the edge cases wrong. **AWS DMS** then does the actual data
movement, full load first with CDC afterward wherever Teradata's
change-capture mechanism supports it, landing everything in an Iceberg
raw zone so the new platform is *replayable* from day one rather than
inheriting Teradata's "the warehouse is the only copy" model. A
parallel-run validation job compares row counts, checksums, and
sampled report output between the legacy Teradata reports and their
new Redshift equivalents — this is the step most migrations
under-invest in, and it's the one that actually determines whether
cutover is safe. **Phase 2** cuts reports over in staged groups, not
all at once, validated individually before each cutover, so a problem
surfaces against one report group instead of the entire reporting
estate simultaneously. **Phase 3** — decommissioning Teradata — happens
only after every group has run clean against AWS for an agreed
validation window, giving a real rollback path the entire way through.

**Key design decisions and alternatives considered:**
- **Staged, per-report-group cutover instead of a big-bang weekend
  migration:** a big-bang cutover concentrates all migration risk into
  one weekend with no partial-rollback option; staged cutover means a
  single report group's failure doesn't take down reporting for the
  whole business and gives the team a real, tested rollback path at
  every stage.
- **Landing in an S3/Iceberg raw zone before Redshift, not migrating
  straight into the warehouse:** this makes the new platform
  reversible in a way the old Teradata-only architecture never was —
  if the initial Redshift schema design turns out wrong, it can be
  rebuilt from the lake without re-extracting from a (soon to be
  decommissioned) Teradata source.
- **DMS Schema Conversion output treated as a draft, with a required
  human review pass** before any converted stored procedure ships to
  production — automated SQL dialect translation is genuinely useful
  but not something to trust blindly for 15 years of accumulated
  business logic, some of which almost certainly encodes undocumented
  edge cases.
- **A real parallel-run validation phase, not "spot-check a few
  reports and go":** this is explicitly the phase most migrations
  underinvest in under schedule pressure, and it's also the phase that
  determines whether the business actually trusts the new platform's
  numbers on day one of cutover.

**How it scales:** the migration's own "scale" concern is really about
the number of report groups and the review bandwidth to validate each
one — this argues for prioritizing cutover order by business criticality
and usage frequency (migrate the heavily-used, well-understood reports
first to build confidence and process muscle, save the obscure legacy
reports nobody's sure are still used for last, or for a "who actually
needs this" conversation before spending migration effort on them at
all).

**Follow-up questions and how to answer them:**
- *"What do you do if you find a report that's actually wrong in
  Teradata — should the migration reproduce the bug?"* Answer: this is
  a business decision to surface explicitly, not a technical one to
  make silently — document the discrepancy, get sign-off on whether the
  new platform should match Teradata's (wrong) output for continuity or
  fix it, because silently "fixing" a long-standing report changes
  numbers stakeholders may have built other decisions on.
- *"How would you handle a stored procedure DMS Schema Conversion
  can't translate at all?"* Answer: name it as an expected outcome, not
  a failure of the process — some genuinely Teradata-specific logic
  needs to be manually rewritten as a Glue job or Redshift stored
  procedure by an engineer who understands both the original intent and
  the target platform, and budgeting time for a known percentage of
  manual conversions up front avoids it becoming a surprise late in the
  project.
- *"The business wants this done in 6 weeks instead of 6 months — how
  do you respond?"* Answer: push back with the actual risk, specifically
  — name what gets cut (likely the parallel-run validation depth or the
  staged-cutover granularity) and what risk that introduces, and let the
  business make an informed trade-off rather than silently
  under-validating to hit the date; this is the same "surface the
  trade-off, don't hide it" instinct that shows up throughout senior-level
  judgment questions.

---

## 7. Real-time recommendation engine for a streaming media company

**Prompt:** *"Design a recommendation system for a video streaming
service with 40 million subscribers that updates recommendations based
on what a user just watched, within their current session."*

**Clarifying questions to ask first:**
- Does "within their current session" mean the homepage reorders
  during the same session after a watch event, or does it mean the
  *next* session's recommendations improve?
- What's the acceptable staleness for the underlying recommendation
  model itself — is it retrained daily, or does the request also need
  to reflect a model that's continuously updating?
- What's the read pattern at request time — every homepage load for 40M
  subscribers, or only on specific trigger events?
- Is there a cold-start requirement (new users/new content with no
  watch history) that needs a fallback strategy?
- What existing watch-history and content-metadata systems already
  exist that this needs to integrate with, rather than rebuild?

**Worked architecture:**

```
Playback client (watch events: play, pause, complete, skip)
              |
              v
     Kinesis Data Streams (on-demand, partition key = user_id)
              |
   +----------+----------------------------+
   |                                        |
   v                                        v
Lambda (event source mapping)          Amazon Data Firehose
   |                                    (buffered, Parquet)
   v                                        |
DynamoDB (per-user recent-watch                v
session state + candidate                 S3 RAW ZONE (Iceberg)
re-ranking signals)                            |
   |                                      Glue/EMR (nightly batch:
   v                                       collaborative filtering
Recommendation API                          model training, SageMaker)
(reads DynamoDB session state,                 |
 combined with precomputed                     v
 candidate list from the batch                Precomputed candidate
 model, re-ranks in real time)                lists, written to
   |                                          DynamoDB (per-user,
   v                                          refreshed nightly)
Homepage rail (updates on next
page navigation within session)
```

Reading the diagram: this design deliberately separates **what needs
to update in real time** from **what can stay batch-computed**,
because trying to make the whole recommendation stack real-time is
both unnecessary and far more expensive than the actual requirement.
Watch events stream through **Kinesis**, fanning out as in every
previous example, but the real-time path here does something
narrower and cheaper than full model inference: **Lambda** updates a
lightweight per-user session-state record in **DynamoDB** — "user just
finished episode 3 of show X" — and the **recommendation API**
combines that fresh signal with a **precomputed candidate list**
(computed nightly, offline, by a collaborative-filtering model trained
in SageMaker on the full watch-history lake) to re-rank in real time.
The heavy lifting — training a recommendation model against 40 million
users' full watch history — happens as a nightly batch job against the
Iceberg lake, because that computation is genuinely too expensive and
too slow to do per-request; what changes per request is only the
*re-ranking* of an already-computed candidate list based on what just
happened in this session, which is cheap enough to do live. This is
the architectural insight the prompt is really testing: "real-time
personalization" almost never means "real-time model training" — it
means real-time *application* of a mostly-precomputed model to a
freshly-updated signal.

**Key design decisions and alternatives considered:**
- **Precompute candidates offline, re-rank online — not full
  real-time inference:** running a full collaborative-filtering
  inference pass per homepage load for 40M subscribers would be
  enormously expensive and slow compared to a cheap re-rank of a
  nightly-precomputed shortlist; this split is the single highest-
  leverage design decision in the whole system.
- **DynamoDB for session state, not a cache in front of a
  warehouse:** the recommendation API's read has to be single-digit
  milliseconds at homepage-load scale for 40M users — nothing warehouse-
  shaped fits that latency budget, and DynamoDB's per-user key access
  pattern matches the read exactly.
- **SageMaker for the offline model training, EMR/Glue for the feature
  engineering feeding it:** keeping the heavy Spark-based feature
  engineering (aggregating watch history into training features) on
  EMR or Glue and handing off to SageMaker specifically for model
  training uses each service for what it's actually built for, rather
  than trying to do everything inside one.
- **Considered and rejected: fully online, continuously-retraining
  model.** Technically possible with a streaming ML architecture, but
  the operational complexity and cost is disproportionate to what the
  actual requirement ("session-aware re-ranking") needs — this is
  worth naming explicitly as a case where the impressive-sounding
  architecture is the wrong answer.

**How it scales:** Kinesis and DynamoDB scale with subscriber count and
event volume largely automatically in on-demand mode; the nightly batch
training job scales by adjusting EMR/SageMaker instance count and is
decoupled from the real-time path entirely, so a slow training run
never impacts homepage latency for a live user.

**Follow-up questions and how to answer them:**
- *"How do you handle a brand-new user with no watch history (cold
  start)?"* Answer: fall back to a non-personalized, popularity- or
  genre-preference-based candidate list (collected at signup) rather
  than an empty or broken recommendation rail — this needs to be an
  explicit fallback path in the recommendation API, not an
  afterthought discovered when a new user sees a blank homepage.
- *"What if the nightly batch training job fails?"* Answer: the
  precomputed candidate list from the previous successful run stays in
  DynamoDB and keeps serving — recommendations are one day staler, not
  broken, which is exactly the kind of graceful degradation this
  split design buys you for free; the alert is "training job failed,"
  not "recommendations are down."
- *"How would you A/B test a new ranking algorithm?"* Answer: run the
  new model's candidate generation in parallel with the existing one,
  writing to a separate DynamoDB attribute or table, and split live
  traffic between them at the recommendation API layer with results
  logged back to the lake for offline comparison — the architecture's
  clean separation between candidate generation and real-time re-rank
  makes this straightforward to bolt on without touching the real-time
  path's latency characteristics.

---

## 8. Global ride-sharing platform: real-time surge pricing and driver matching

**Prompt:** *"Design a data platform for a global ride-sharing company
that needs real-time surge pricing and driver-rider matching across
hundreds of cities."*

**Clarifying questions to ask first:**
- What's the geographic granularity of "surge" — city-wide, or
  neighborhood/geo-hash level, which changes the volume of independent
  pricing computations happening simultaneously?
- What's the actual latency budget for a match — the time between a
  rider requesting and a driver being offered the trip?
- Is pricing computed centrally per region, or does this need to run
  independently per city/region for data-residency or latency reasons?
- What's the acceptable staleness for the supply/demand signal driving
  surge — is a 30-second-old view of nearby driver availability
  acceptable, or does it need to be closer to instantaneous?
- How does this integrate with existing driver-app and rider-app
  location-update infrastructure — is location data already streaming
  somewhere, or does this design own that ingestion too?

**Worked architecture:**

```
Rider app (ride requests)        Driver app (location pings, ~every 4s)
        |                                  |
        v                                  v
API Gateway                        Kinesis Data Streams
        |                          (partitioned by geo-hash region)
        v                                  |
Lambda (match request)                     v
        |                          Managed Flink (per-geo-hash-cell
        v                          windowed aggregation: driver
DynamoDB (real-time driver          supply count, demand count,
availability by geo-hash cell,      surge multiplier computed
updated continuously by Flink)      per cell every ~10 seconds)
        |                                  |
        v                                  v
Match + surge price returned      DynamoDB (current surge
to rider, driver notified          multiplier per geo-hash cell)
via push notification                     |
        |                                  v
        v                          Amazon Data Firehose (all
Trip completed -> event                 pricing/matching decisions,
written to Kinesis                      Parquet, for audit + BI)
                                              |
                                              v
                                        S3 lake (Iceberg) ->
                                        Redshift (city-ops
                                        dashboards, pricing
                                        strategy analysis)
```

Reading the diagram: driver location pings and ride requests both flow
through **Kinesis**, but the design decision that makes this system
work at global scale is **partitioning the stream by geo-hash region**
rather than by driver ID or a global key — surge pricing and matching
are both inherently *local* computations (a surge in downtown Chicago
has nothing to do with driver supply in downtown Chicago's exact
counterpart happening simultaneously in Austin), so partitioning by
geography lets **Managed Flink** compute independent, parallel
windowed aggregations per cell without any cell's computation
depending on another's state. Flink continuously computes a supply
count, demand count, and resulting surge multiplier per geo-hash cell
roughly every 10 seconds and writes the current multiplier to
**DynamoDB**, keyed by cell — this is the store the match/pricing API
reads from on every ride request, because a rider requesting a price
cannot wait on a live aggregation to run; they read the *last
computed* multiplier, which is a small, deliberate, and clearly-stated
staleness trade-off (surge is a few seconds behind ground truth, which
is an acceptable and industry-standard trade-off for this problem).
Similarly, **DynamoDB holds real-time driver availability per cell**,
which the match request reads to find a nearby available driver. Every
pricing and matching decision is also written to **Firehose** for
downstream audit and BI — this matters for a ride-sharing business
specifically because pricing decisions face regulatory scrutiny in many
markets, and being able to reconstruct "why was this rider charged this
surge multiplier at this time" is a real operational and legal
requirement, not just a reporting nicety.

**Key design decisions and alternatives considered:**
- **Geo-hash partitioning over a global key:** this is the single
  decision that makes the whole system scale to hundreds of cities
  without cross-region contention — without it, every city's surge
  computation would compete for the same shard/partition capacity and
  a busy city could starve a quiet one's Flink processing.
  Alternative name: **H3 hexagonal indexing** instead of geo-hash
  rectangles works even better in practice for ride-sharing because
  it avoids the distance-distortion issues geo-hash rectangles have
  near cell boundaries — worth naming as a refinement if the
  interviewer pushes on precision.
- **DynamoDB for the read-time surge/availability lookup, not a live
  query against Flink's internal state:** the match/pricing API's read
  path has to be independent of Flink's own processing latency; writing
  Flink's output to DynamoDB decouples "how fast can Flink compute a
  new surge value" from "how fast can a rider get a price," which
  matters because those are genuinely different latency requirements.
- **~10-second recompute window, not sub-second:** an explicit,
  stated trade-off — surge pricing that changes every second would be
  confusing and arguably unfair to riders/drivers mid-decision; a
  ~10-second window is both computationally cheaper and a better
  product experience, which is worth naming as a deliberate choice
  rather than a limitation.

**How it scales:** geo-hash partitioning is what makes horizontal
scaling to more cities essentially "add more parallel Flink work,"
rather than a redesign — each new city or region is just more
partitions in an already-partitioned scheme. The place that needs
explicit design attention at true global scale is regional data
residency: some markets require rider/driver data to stay within
country borders, which argues for per-region Kinesis streams and
Flink jobs (not a single global stream) from the outset, rather than
retrofitting regional isolation later.

**Follow-up questions and how to answer them:**
- *"What happens at a geo-hash cell boundary — could a rider on one
  side see a very different price than a rider 50 feet away on the
  other side?"* Answer: yes, and that's a real, known edge case in this
  class of system — mitigations include cell overlap/smoothing in the
  aggregation, or blending a cell's price with its immediate neighbors'
  rather than a hard cutoff; naming this trade-off unprompted is a
  strong signal of having actually thought through the design rather
  than just describing components.
- *"How would you detect and prevent a bad actor artificially
  triggering surge (e.g., many drivers going offline simultaneously
  in a coordinated way)?"* Answer: this is an anomaly-detection problem
  layered on top of the existing pipeline — the same Iceberg lake
  feeding BI dashboards can feed a separate monitoring job that flags
  statistically unusual supply drops per cell, which is a defensible
  answer to name even without full detail, because it shows awareness
  that the system needs abuse-resistance, not just a happy-path design.
- *"What's your rollback plan if a bad pricing model deployment
  causes incorrect surge multipliers city-wide?"* Answer: version the
  pricing logic running inside the Flink job the same way you'd version
  any deployed service, keep the previous version's artifact ready for
  immediate redeploy, and treat a pricing anomaly (multipliers outside
  a sane bound) as an automatic circuit-breaker condition that falls
  back to no-surge (1.0x) rather than an unbounded bad value reaching
  riders.

---

## 9. Regulatory reporting platform for a financial services company

**Prompt:** *"Design a data platform for a financial services firm that
must produce regulatory reports (e.g., trade reporting, risk exposure)
with full data lineage and the ability to reconstruct exactly what was
reported and why, years later."*

**Clarifying questions to ask first:**
- Which specific regulatory regime(s) apply, and what's the required
  retention period — this varies from 5 to 10+ years depending on
  jurisdiction and report type, and directly drives storage design.
- Does "reconstruct exactly what was reported" mean the report output
  itself needs to be immutably archived, the inputs need to be
  reproducible, or both?
- What's the acceptable latency for the source trade/position data
  feeding these reports — same-day, T+1?
- Who needs to trace lineage — internal audit only, or does an external
  regulator need self-service access to trace a specific reported
  figure back to source?
- Are there corrections/restatements to account for — if a report is
  found wrong after submission, what's the process for amending it
  while preserving the original submitted version?

**Worked architecture:**

```
Trading systems / position systems (multiple, heterogeneous)
              |
   AWS DMS (CDC where available) / Glue JDBC (batch extracts)
              |
              v
     S3 RAW ZONE (Iceberg, Object Lock enabled,
     immutable, one snapshot per ingestion run)
              |
     Glue ETL (versioned job code, every run logged)
              |
              v
     S3 CURATED ZONE (Iceberg, every transformation
     step tagged with job version + run ID + source
     snapshot ID -- this triple IS the lineage record)
              |
     Glue Data Catalog + custom lineage metadata table
     (DynamoDB: report_id -> source_snapshot_ids,
     transform_job_versions, generation_timestamp)
              |
              v
     Redshift (report generation, SQL against a
     specific curated snapshot)
              |
              v
     Report output -> S3 REPORT ARCHIVE ZONE
     (Object Lock, WORM -- write once, read many,
     immutable once submitted to the regulator)
              |
              v
     CloudTrail (every access to raw/curated/report
     zones logged as a data event, feeding the audit trail)
```

Reading the diagram: the defining requirement here — reconstructing
*exactly* what was reported, years later — means lineage can't be an
afterthought bolted onto a normal pipeline; every stage has to be
independently addressable and immutable. Source data lands in **S3
raw zone with Object Lock**, and critically, **each ingestion run
produces its own Iceberg snapshot** rather than overwriting the
previous state — this is Iceberg's snapshot/time-travel feature used
for exactly the purpose it exists for: being able to query "the source
data as it looked at the moment this report was generated," not just
"the source data as it looks today." Every Glue transformation job is
versioned (via CI/CD, tagged releases, not "edited in the console"),
and each run is logged with its job version and which source snapshot
it read — this triple (source snapshot ID, transform job version, run
ID) *is* the lineage record, and it's captured in a dedicated
**DynamoDB lineage table**, not inferred after the fact from logs,
because after-the-fact log archaeology is exactly what breaks down
under regulatory scrutiny years later. Reports generated from a
specific curated snapshot land in a **separate report-archive zone**
with WORM (write-once-read-many) semantics via Object Lock — once a
report is submitted, that exact output is frozen, and any correction
produces a *new* versioned report referencing the original rather than
overwriting it, preserving the historical record of "what did we
actually tell the regulator, and when." **CloudTrail data events**
across every zone provide the access audit trail an examiner can pull
independently of the application layer.

**Key design decisions and alternatives considered:**
- **Iceberg snapshots as the lineage backbone, not a separate lineage
  tool bolted on:** using time travel for "what did the source data
  look like at report-generation time" is a natural fit for a
  capability Iceberg already provides, rather than building a custom
  point-in-time reconstruction mechanism from scratch.
- **A dedicated lineage metadata table, not log-mining after the
  fact:** capturing lineage as structured data (`report_id` ->
  snapshot IDs, job versions) at generation time is dramatically more
  reliable for a "reconstruct this years later" requirement than trying
  to reconstruct the same information by mining CloudWatch/Glue job
  logs retroactively, which may not even be retained that long by
  default.
- **WORM report archive, corrections as new versions:** treating a
  correction as an edit to the original would destroy the historical
  record of what was actually submitted at the time — regulators
  specifically care about that history, not just the current "best
  known" figure, so the architecture has to preserve both.
- **Versioned, CI/CD-deployed Glue jobs, not console-edited scripts:**
  "which exact transformation logic produced this report" is only
  answerable if the transformation code itself is versioned and that
  version is recorded alongside the run — an ad hoc console edit with
  no version history breaks the lineage chain at the transformation
  step even if source and output are both well-tracked.

**How it scales:** the lineage metadata table and Iceberg snapshot
approach both scale with report volume and retention period without
redesign — the real long-term cost driver to flag explicitly is
storage: years of retained raw snapshots, curated snapshots, and WORM
report archives accumulate, which argues for a tiered S3 lifecycle
policy (Standard for the active reporting period, transitioning to
Glacier for older snapshots that are retained for compliance but rarely
accessed) rather than leaving everything on S3 Standard indefinitely.

**Follow-up questions and how to answer them:**
- *"A regulator asks you to reconstruct a report from three years
  ago and explain a specific number. Walk me through what you'd
  actually do."* Answer: look up the report ID in the lineage table to
  get the source snapshot ID and transform job version, time-travel
  query the Iceberg curated table at that snapshot, and re-run (or
  inspect) the exact versioned transformation logic against it — the
  answer should walk through the mechanism concretely, because this is
  the scenario the entire architecture is built to answer.
- *"How do you keep the lineage table itself from becoming a
  bottleneck or single point of failure?"* Answer: it's a
  write-once-per-report-generation, read-rarely access pattern —
  DynamoDB fits that well, and the real mitigation is making sure the
  lineage write happens as part of the same transaction/step that
  generates the report, so a report can never exist without its
  lineage record also existing (rather than lineage being written by a
  separate, potentially-failing process afterward).
- *"What's the cost trade-off of keeping years of Iceberg snapshots
  versus expiring them?"* Answer: name the tension directly — Iceberg
  snapshot expiration is a normal maintenance operation for a typical
  lake table, but for this specific use case, expiring a snapshot that
  underlies a still-relevant regulatory report would break
  reconstructability, so the snapshot expiration policy here has to be
  driven by the regulatory retention requirement, not by the default
  storage-cost-minimization instinct that would apply to a normal
  analytics table.

---

## 10. CDC-based unified data platform for 200 microservices with no central data layer

**Prompt:** *"A company has grown to 200 microservices, each with its
own database, and has no central place to answer cross-service
analytical questions. Design a platform to fix that."*

**Clarifying questions to ask first:**
- Are the 200 services' databases homogeneous (all Postgres/MySQL) or a
  genuine mix of engines, which changes CDC tooling and effort per
  service enormously?
- Is there an existing event-driven architecture (services already
  publishing domain events) this can build on, or does everything need
  to be captured via database-level CDC?
- What's actually being asked for — a small set of specific
  cross-service questions (start narrow), or "give us everything," which
  is a much larger and slower-to-deliver ask?
- Who owns data quality/schema for each service's data once it leaves
  that service's boundary — does this need a data contract or governance
  layer, or is "best effort, as-is" acceptable initially?
- What's the organization's appetite for onboarding effort per
  service — is this a top-down mandate with engineering time allocated,
  or does the platform team need to make each integration nearly
  zero-effort for a busy service team to adopt?

**Worked architecture:**

```
Service A DB    Service B DB    ...    Service N DB (200 total,
(Postgres)      (MySQL)                mixed engines)
     |               |                        |
     v               v                        v
AWS DMS (CDC, per-source, reading each
service's native change log/binlog --
zero application code changes required)
     |               |                        |
     +-------+-------+------------------------+
             |
             v
  Kinesis Data Streams (per-domain streams,
  e.g. one stream per bounded context, not
  one stream per microservice)
             |
             v
  Amazon Data Firehose (format conversion,
  dynamic partitioning by source_service/date)
             |
             v
  S3 RAW ZONE (Iceberg, one table per source
  service, schema mirrors source at CDC time)
             |
  Glue Data Catalog (auto-registered via crawler,
  self-service discoverability for any team)
             |
  Glue ETL (per-domain, builds cross-service
  curated entities -- e.g. "customer 360" joining
  CRM + billing + support service data)
             |
             v
  S3 CURATED ZONE (Iceberg) -> Athena (self-service
  cross-service queries) + Redshift (recurring
  cross-service BI/reporting)
```

Reading the diagram: the core insight this design leans on is that
**AWS DMS's CDC mode requires zero application code changes in any of
the 200 services** — it reads each database's native change log
directly, which is the only realistic way to retrofit centralized data
access onto 200 already-built, independently-owned services without
asking every team to instrument application-level event publishing as
a prerequisite (a much slower, higher-friction path that would take
years to reach full coverage). Each service's changes stream through
**DMS into Kinesis**, grouped into **per-domain streams** (e.g., one
stream for the "commerce" bounded context, one for "support") rather
than one stream per microservice or one giant global stream — this
balances operational manageability (200 individual streams is its own
maintenance burden) against isolation (one shared global stream mixes
unrelated domains' throughput and makes per-domain access control
harder). Everything lands in an **Iceberg raw zone**, one table per
source service, auto-discovered via a **Glue crawler and registered in
the Data Catalog** so *any* team can find and understand what data
exists without filing a ticket to the platform team first — this
self-service discoverability is often the actual unlock the business
was missing, more than the data movement itself. A curated layer builds
genuinely cross-service entities — a "customer 360" view joining CRM,
billing, and support data that no single service's database could ever
answer alone — and that curated layer is what Athena and Redshift
serve to the rest of the business.

**Key design decisions and alternatives considered:**
- **CDC via DMS, not asking 200 teams to publish domain events:** this
  is the decision that makes the project tractable at all — event
  publishing is architecturally cleaner in the abstract, but requiring
  200 already-overloaded service teams to build and maintain outbound
  event publishing as a prerequisite would take years and depend on
  buy-in the platform team doesn't control; CDC reads what already
  exists.
- **Per-domain Kinesis streams, not per-service or one global stream:**
  named explicitly as a deliberate middle ground between two bad
  extremes — 200 streams is unmanageable operational surface, one
  global stream loses isolation and makes access control coarse; domain
  grouping (aligned to how the business actually thinks about its
  bounded contexts) is the practical answer.
- **Raw zone mirrors source schema exactly, curation happens
  separately:** resisting the temptation to "clean up" data on the way
  into the raw zone preserves the ability to rebuild curated views
  differently later, and — just as importantly — makes it obvious when
  a service's schema has drifted, because the raw zone is a faithful
  mirror rather than an already-adjusted version that could mask drift.
- **Glue Catalog self-service discovery as a first-class deliverable,
  not an afterthought:** the actual organizational failure being fixed
  here is "nobody knows what data exists or how to get it" as much as
  "the data isn't centrally accessible" — a catalog nobody can browse or
  understand solves only half the stated problem.

**How it scales:** onboarding a 201st microservice is a repeatable,
templated DMS + Kinesis + crawler pattern rather than a bespoke
integration, which is the actual scaling property this design needs —
"can a platform team keep up with a growing number of services"
matters more here than raw data-volume scaling, and the answer is yes
specifically because each new service follows the same onboarding
recipe rather than a custom design each time.

**Follow-up questions and how to answer them:**
- *"How do you handle a service team changing their database schema
  without warning anyone?"* Answer: this is exactly the schema-drift
  problem — a Glue crawler re-run detects the change, and the practical
  answer is a lightweight data-contract expectation (a schema
  registry or even just a Slack-bot alert on detected drift) rather
  than trying to prevent it entirely, since 200 independently-owned
  services will never fully coordinate schema changes with a central
  team.
- *"Some of these 200 services have databases that don't support
  CDC natively — what then?"* Answer: fall back to scheduled batch
  extraction (Glue JDBC) for those specific services rather than
  blocking the whole platform on 100% CDC coverage — a mixed-mode
  approach (CDC where supported, batch where not) is a reasonable,
  honest answer, and it's worth stating that batch-extracted services
  simply have coarser freshness, which should be communicated to
  consumers of that specific data.
- *"How do you prevent this platform from becoming a second source of
  truth that drifts from the actual services?"* Answer: the raw zone
  is explicitly read-only and derived — no write path exists back into
  it that could make it diverge into an independent system of record —
  and CDC's continuous nature means it's always converging toward the
  source's current state rather than being a one-time snapshot that
  ages; the discipline to maintain is never allowing an application to
  treat the analytics platform as anything but a read replica of the
  real source systems.

---

## 11. Data platform supporting batch ML training and real-time feature serving

**Prompt:** *"Design a data platform that supports both large-scale
batch ML model training and low-latency real-time feature serving for
online inference, using the same underlying feature definitions."*

**Clarifying questions to ask first:**
- What's the actual latency requirement for real-time inference — is
  this a synchronous API call blocking a user-facing response, or
  asynchronous?
- What's the risk/impact of **training-serving skew** — a feature
  computed slightly differently in batch training versus real-time
  serving — for this specific model's use case?
- How many models and feature sets need to be supported, and are they
  being built by a central ML platform team or many independent
  application teams?
- What's the acceptable staleness for features used in real-time
  inference — must they reflect the very latest event, or is a few
  minutes' lag acceptable?
- Is there an existing feature store or is this greenfield?

**Worked architecture:**

```
Event sources (transactions, clicks, app events)
              |
              v
     Kinesis Data Streams
              |
   +----------+-----------------------+
   |                                   |
   v                                   v
Managed Flink                    Amazon Data Firehose
(computes streaming features        (raw event archive,
 using the SAME feature              Parquet, Iceberg)
 definitions as the batch job             |
 below -- shared feature logic)           v
   |                                 S3 RAW ZONE
   v                                      |
SageMaker Feature Store           Glue/EMR (nightly batch:
(online store -- DynamoDB-backed,  computes the SAME features
 low-latency read for real-time    at scale over full history,
 inference)                        writes to offline store)
   |                                      |
   v                                      v
Real-time inference endpoint       SageMaker Feature Store
(reads online store, <10ms)        (offline store -- S3/Iceberg-
                                    backed, used for training)
                                          |
                                          v
                                    SageMaker training jobs
                                    (batch, reads offline
                                    store, produces model
                                    artifacts)
```

Reading the diagram: the entire design exists to solve one specific,
well-known ML-platform failure mode — **training-serving skew**, where
a feature is computed one way during offline model training and a
subtly different way during real-time inference, causing the model to
perform worse in production than its offline evaluation predicted,
often silently. **SageMaker Feature Store** is built specifically to
prevent this: it maintains an **online store** (DynamoDB-backed, for
sub-10ms reads at inference time) and an **offline store** (S3/Iceberg-
backed, for training) that are populated from the *same feature
definitions*, so "average transaction amount over the last 7 days" is
computed identically whether it's feeding a live inference request or a
training job. The real-time path computes streaming features in
**Managed Flink** using that shared feature logic and writes results
into the online store continuously; the batch path recomputes the same
feature definitions at full historical scale nightly via Glue or EMR
and writes into the offline store, which SageMaker training jobs read
from. Both paths ultimately derive from the same raw event stream, so
a feature's *definition* lives in one place conceptually even though it
executes in two different compute engines (Flink for streaming, Spark
via Glue/EMR for batch) — the discipline the architecture enforces is
that those two implementations are kept in sync deliberately, not that
skew is impossible by construction, which is worth stating honestly in
an interview rather than overclaiming.

**Key design decisions and alternatives considered:**
- **A feature store as the shared abstraction, not two independent
  pipelines that happen to compute similar features:** the alternative
  — a real-time team and an ML/batch team independently implementing
  "average spend last 7 days" in two different codebases — is exactly
  how training-serving skew happens in practice; centralizing the
  feature definition (even if the execution engines differ) is the
  actual fix.
- **DynamoDB-backed online store for the inference-time read:**
  inference latency requirements rule out anything warehouse-shaped for
  the online path, the same reasoning that applies in the fraud
  detection and personalization examples above — this is a recurring
  pattern worth naming explicitly when it comes up again.
- **Nightly batch recompute for the offline store, not a
  continuously-streamed offline store:** training doesn't need
  up-to-the-second freshness, and batch recomputation over the full
  history is more straightforward to validate and reproduce for a
  given model training run than trying to reconstruct "the offline
  feature values as of a specific point in time" from a purely
  streaming pipeline.
- **Considered and rejected: computing real-time features by directly
  querying the offline store per inference request.** This would blow
  the latency budget entirely — an S3/Iceberg-backed read at inference
  time cannot meet a sub-10ms requirement, which is exactly why the
  online/offline split with a dedicated low-latency store exists in
  the first place.

**How it scales:** the online store scales with DynamoDB's standard
scaling behavior against inference request volume; the offline
recompute job scales by adjusting EMR/Glue capacity against training
data volume, fully decoupled from the online path. As the number of
distinct models and feature sets grows, the thing that needs deliberate
scaling attention is feature *governance* — a shared feature registry
so teams reuse existing feature definitions instead of each building
a slightly different version of "customer lifetime value," which is
itself a source of both duplicated engineering effort and skew risk.

**Follow-up questions and how to answer them:**
- *"How do you actually detect training-serving skew if it happens
  despite this design?"* Answer: monitor the statistical distribution
  of feature values seen at inference time against the distribution
  used in the most recent training run — a significant, unexplained
  divergence is the signal, and it should be an automated, ongoing
  check, not something only discovered when model performance
  visibly degrades in production.
- *"What happens if Flink falls behind and the online store has a
  stale feature at the moment of an inference request?"* Answer: same
  answer as the fraud-detection scenario — state an explicit staleness
  tolerance, monitor lag against it, and have the inference path treat
  "feature is stale beyond tolerance" as a condition to potentially
  fall back to a simpler, less-personalized model rather than serving a
  confidently-wrong prediction on badly stale data.
- *"Would you use Bedrock or a self-hosted model here instead of
  SageMaker?"* Answer: it depends on the model type — SageMaker fits
  a custom-trained model on proprietary feature data, which is what
  this scenario describes; Bedrock's managed foundation models are the
  better fit when the task is more generic (classification, generation)
  and doesn't require training on this company's specific proprietary
  feature set from scratch — naming that distinction shows the choice
  wasn't reflexive.

---

## 12. Observability / log analytics platform for a large SaaS company

**Prompt:** *"Design a log analytics and observability platform for a
SaaS company with hundreds of services generating logs, metrics, and
traces, used by on-call engineers during incidents."*

**Clarifying questions to ask first:**
- What's the actual latency requirement during an incident — an
  engineer searching logs during a live outage needs results in
  seconds, not minutes, which rules out anything batch-shaped for that
  path.
- What's the expected log volume and retention requirement — "hot"
  recent data for active debugging versus "cold" historical data for
  post-incident analysis and compliance have very different cost/
  performance needs.
- Are logs, metrics, and traces already instrumented in a standard
  format (structured JSON, OpenTelemetry), or is this heterogeneous
  and needs normalization?
- Is there an existing observability tool (Datadog, Splunk) this needs
  to coexist with or eventually replace?
- What's the cost sensitivity — observability platforms are notorious
  for runaway cost as log volume grows, and that needs to be a design
  constraint from day one, not an afterthought.

**Worked architecture:**

```
Application services (structured logs, metrics, traces --
OpenTelemetry format)
              |
              v
     Kinesis Data Streams (or Firehose direct, depending
     on whether real-time processing is needed pre-landing)
              |
              v
     Amazon Data Firehose (buffered delivery, dynamic
     partitioning by service_name/date, format conversion)
              |
   +----------+-----------------------+
   |                                   |
   v                                   v
Amazon OpenSearch Service          S3 RAW ZONE (Iceberg,
(HOT tier -- last 7-14 days,        full history, cheap,
full-text search, near-real-time    long retention)
indexing, powers the live                |
incident-search UI)                 Glue ETL (nightly) ->
   |                                 curated aggregates
   v                                 (error rate trends,
On-call engineer searches           SLO compliance reports)
during an active incident                |
                                          v
                                    Athena / Redshift
                                    (post-incident analysis,
                                    trend reporting, capacity
                                    planning -- NOT the live
                                    incident-response path)
```

Reading the diagram: the design's central decision is a **hot/cold
tiering split**, because the incident-response use case and the
historical-analysis use case have almost opposite requirements — an
on-call engineer mid-outage needs full-text search across recent logs
in under a second, while a quarterly capacity-planning report can
tolerate minutes. **OpenSearch Service** is the hot tier, holding
roughly the last 1-2 weeks of logs indexed for fast full-text search —
this is exactly OpenSearch's purpose-built use case (log analytics,
Kibana-style dashboards) and it's what the live incident-search UI
queries directly. Everything also lands, unmodified, in an **S3/Iceberg
raw zone** with much longer (often compliance-driven) retention at a
fraction of OpenSearch's per-GB cost, because keeping years of logs
hot in a search index is prohibitively expensive and mostly unnecessary
— nobody full-text-searches two-year-old debug logs interactively. A
nightly Glue job builds curated aggregates (error-rate trends, SLO
compliance metrics) from the full history, queryable through Athena or
Redshift for post-incident retrospectives and longer-term reliability
reporting — explicitly **not** the path an on-call engineer touches
during a live incident, because introducing any batch-shaped latency
into the "someone's system is down right now" path defeats the entire
purpose of an observability platform.

**Key design decisions and alternatives considered:**
- **OpenSearch for hot/recent data, S3/Iceberg for the rest — not
  everything in OpenSearch:** this is the design's core cost lever;
  OpenSearch's per-GB cost for indexed, searchable storage is
  substantially higher than S3, and most log volume is only ever
  queried (if at all) in the days immediately following ingestion —
  paying OpenSearch-tier cost for logs nobody will search again is the
  single most common way observability platforms blow their budget.
- **Retention window on the hot tier set deliberately (e.g., 7-14
  days), not "keep everything searchable forever":** this is a direct,
  explicit trade-off to name in an interview — a shorter hot window
  saves real money but means an investigation into "what happened three
  weeks ago" has to fall back to a slower Athena query against the raw
  zone instead of instant OpenSearch search, and that trade-off should
  be a conscious, stated decision, not a silent cost-cutting move
  nobody agreed to.
- **Firehose for delivery, not a custom streaming job:** log delivery
  at this scale is a solved, high-volume, low-complexity-per-event
  problem that Firehose's dynamic partitioning and format conversion
  handle without a team having to operate custom streaming
  infrastructure whose only job is moving bytes from A to B.
- **Structured logging (OpenTelemetry) enforced at the source, not
  parsed downstream:** pushing structure to the producer rather than
  trying to regex-parse unstructured log lines downstream dramatically
  improves both OpenSearch indexing efficiency and the reliability of
  the curated aggregates built from it — this is worth naming as an
  organizational requirement (a logging standard every service must
  follow), not just a technical implementation detail.

**How it scales:** Firehose and S3 scale with log volume
transparently; OpenSearch requires active shard-count and instance-type
management as ingest volume grows, which is the component most likely
to need deliberate capacity planning and cost monitoring as the
company's service count grows into the hundreds — this is worth flagging
as an ongoing operational responsibility, not a "set it up once and
forget it" component.

**Follow-up questions and how to answer them:**
- *"An engineer needs to search logs from 45 days ago during a
  post-incident investigation — how does the platform handle that,
  given the hot tier is only 14 days?"* Answer: this is exactly the
  cold-tier fallback — a documented, if slower, path via Athena against
  the raw Iceberg zone; the honest answer is stating the latency
  trade-off explicitly (seconds in OpenSearch vs. tens of seconds to
  minutes in Athena) rather than pretending the fallback is equally
  fast.
- *"How do you keep OpenSearch costs from growing unbounded as the
  company adds more services?"* Answer: index lifecycle management
  policies that automatically age indices out of the hot tier on
  schedule (not manual cleanup), combined with per-service log-volume
  monitoring so a single noisy service logging excessively gets caught
  and addressed rather than silently inflating everyone's shared
  OpenSearch bill.
- *"What would you do differently if this needed to support
  sub-second alerting in addition to search?"* Answer: alerting is a
  different access pattern than search — OpenSearch supports alerting
  natively on indexed data, but for genuinely sub-second detection on
  specific known conditions (an error-rate threshold), a parallel
  lightweight path off the same Kinesis/Firehose stream (a Lambda or
  Flink job evaluating a specific metric threshold) is more appropriate
  than routing every alert condition through a full search-index query,
  the same real-time-vs-batch fan-out pattern used throughout this
  document.

---

## 13. Data mesh architecture for a large enterprise with many business units

**Prompt:** *"Design a data platform for a large enterprise with a
dozen largely-independent business units, each with their own data
needs, where a central data team has become a bottleneck for every
data request. Design something that scales past that bottleneck."*

**Clarifying questions to ask first:**
- What's actually creating the bottleneck — is the central team the
  only group with pipeline-building skills, the only group with access
  to source systems, or the only group who understands the business
  meaning of the data?
- Is there any data that genuinely needs central governance regardless
  of ownership model (PII, financial reporting data subject to SOX),
  versus data that's purely business-unit-internal?
- What's each business unit's existing technical capability — do they
  have engineers who could own a data pipeline, or does "decentralized"
  risk becoming "under-resourced and worse than centralized"?
- Is there a need for cross-business-unit analytics at all (a company-
  wide view), or is this purely about unblocking each unit's own needs?
- What's the organization's appetite for a genuine platform-team
  investment (tooling, self-service infrastructure) versus just
  "stop being the bottleneck" without added investment?

**Worked architecture:**

```
                    CENTRAL PLATFORM TEAM
        (provides self-service tooling, not pipelines)
    - Standard ingestion templates (DMS/Glue/Kinesis, IaC)
    - Central Glue Data Catalog + Lake Formation governance
    - Shared observability, cost dashboards per domain
    - LF-Tag-based access control framework
              |
   published as reusable templates / self-service portal
              |
   +----------+----------+----------+-----------------------+
   v                     v          v                        v
BUSINESS UNIT A     BUSINESS UNIT B  BUSINESS UNIT C  ...   BUSINESS UNIT N
(owns their own     (owns their own                          (owns their own
data products;      data products;                           data products;
domain team runs    domain team runs                         domain team runs
their own Glue/     their own Glue/                          their own Glue/
DMS pipelines        DMS pipelines                            DMS pipelines
using central         using central                            using central
templates)            templates)                               templates)
   |                     |          |                        |
   v                     v          v                        v
Domain-owned S3/Iceberg tables, registered in the CENTRAL
Glue Data Catalog with LF-Tags identifying domain ownership,
data classification, and access policy
              |
              v
   Cross-domain consumers (Athena/Redshift, self-service,
   governed by LF-Tag policy -- a consumer in Business Unit A
   can discover and query a published table from Business
   Unit B without filing a ticket with the central team,
   subject to the access policy the owning domain set)
```

Reading the diagram: this is the **data mesh** pattern, and the
architectural shift it represents is that the central team stops
being the group that *builds every pipeline* and becomes the group
that **builds the platform other teams build pipelines on** — reusable
ingestion templates (a standard, IaC-defined pattern for "stand up a
new DMS-to-S3 pipeline" that a business-unit engineer can instantiate
without reinventing it), a shared Glue Data Catalog every domain
registers into, and a governance framework (Lake Formation LF-Tags)
that lets each business unit own and publish their own data products
while still operating inside a consistent, centrally-defined access
control model. Each business unit's domain team builds and owns their
own pipelines using those templates, which removes the central team as
the bottleneck for the actual pipeline work, but every domain still
registers its tables into the **same central catalog** with **LF-Tags
identifying ownership, classification, and access policy** — this is
the piece that keeps a mesh from degenerating into a dozen
disconnected data silos: discoverability and governance stay
centralized even as pipeline ownership decentralizes. A consumer in
one business unit can find and query a table another business unit
published without filing a ticket, because the access decision is
encoded declaratively in LF-Tags rather than requiring a human in the
central team to grant access manually every time.

**Key design decisions and alternatives considered:**
- **Central team as platform-builder, not pipeline-builder:** this
  is the single reframing the entire design depends on, and it's worth
  stating explicitly why it fixes the actual bottleneck — the central
  team's throughput no longer gates every new pipeline request, because
  the central team isn't in the critical path of building each one
  anymore.
- **Centralized catalog and governance despite decentralized
  ownership:** the failure mode this specifically avoids is "data mesh"
  becoming a euphemism for a dozen ungoverned silos with no
  discoverability — LF-Tags let ownership decentralize while
  discoverability and policy enforcement stay centralized, which is the
  actual hard part of doing a mesh well.
- **Standard, reusable ingestion templates (IaC), not "figure it out
  yourselves":** decentralizing pipeline ownership without giving
  business-unit engineers a well-tested starting pattern risks each
  domain reinventing DMS/Glue configuration badly, with the central
  team fielding support tickets for problems the templates should have
  prevented — the templates are what make decentralization safe rather
  than just faster-and-worse.
- **A domain must classify and tag data as a condition of publishing
  it, not an optional step:** making classification (PII, financial,
  public) a required part of registering a table in the central catalog
  is what lets governance stay real without a human review gate on
  every publish — the domain team, who actually understands their own
  data, does the classification at the point closest to the knowledge,
  rather than a central team trying to infer it later.

**How it scales:** this is explicitly a design for *organizational*
scale, not just data volume — the pattern's whole point is that adding
a 13th business unit doesn't require the central team's headcount to
grow proportionally, because each domain owns its own build-and-
operate burden using shared templates. The place this needs ongoing
investment to keep working is the platform layer itself: templates,
catalog tooling, and governance framework need a dedicated (if small)
platform team maintaining them, or the mesh degrades back into ad hoc
per-domain pipelines with no shared discipline.

**Follow-up questions and how to answer them:**
- *"What stops a business unit from publishing badly-governed,
  low-quality data that other teams then rely on?"* Answer: this is a
  real risk in every data mesh implementation, and the honest answer
  names data-product ownership accountability as an organizational
  requirement, not just a technical one — publishing a table into the
  shared catalog should come with an explicit ownership contract (an
  owning team, an SLA/quality expectation, a point of contact), enforced
  socially and via a lightweight review gate for anything crossing into
  a "certified" or company-wide-relied-upon tier, rather than assuming
  self-service alone guarantees quality.
- *"How do you handle a business unit that doesn't have the technical
  capability to own a pipeline?"* Answer: acknowledge directly that
  decentralization isn't free — for a business unit without engineering
  capacity, the central platform team may still build and hand off
  operation of their initial pipeline, or that unit may simply remain
  centrally-supported longer than others; a mesh doesn't have to mean
  "every unit is equally self-sufficient on day one," and forcing that
  uniformly would just create worse-run pipelines in under-resourced
  units.
- *"How would you measure whether this actually fixed the bottleneck
  a year later?"* Answer: track a concrete metric like time-from-
  request-to-first-data-available per business unit before and after,
  and central-team ticket volume for "build me a pipeline" requests —
  a mesh that's working shows that metric dropping and central tickets
  shifting from "build this for us" to "help us use the platform,"
  which is a meaningfully different (and much more scalable) kind of
  central-team workload.
