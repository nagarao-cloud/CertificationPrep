# End-to-End Architectures

> **This is the capstone file for `04-architectures/`.** Every other
> file in this folder — `Data-Lake.md`, `Lakehouse.md`, `CDC.md`,
> `Batch-Pipeline.md`, `Streaming-Pipeline.md` — teaches one pattern in
> isolation. Real exam scenarios, and real production platforms, rarely
> use exactly one pattern; they compose two, three, or all five of them
> into a single system that spans ingest → store → process → serve →
> govern. This file exists to show that composition explicitly: three
> full enterprise architectures, each one built by naming which sibling
> pattern contributed which piece, so you can see the individual files
> reassemble into something real rather than treating them as five
> disconnected topics to memorize separately.
>
> Read the five sibling files first if you haven't — this file assumes
> you know what "bronze/silver/gold," "MERGE INTO," "job bookmarks," and
> "enhanced fan-out" mean without re-explaining them.

---

## How to read this file

Each architecture below follows the same shape:

1. **The business problem** — why this platform exists
2. **Full reference diagram** — every box, every arrow explained
3. **Which sibling file contributed which piece** — the explicit
   cross-reference this file exists to provide
4. **Service rationale** — why each service, not a runner-up
5. **Scaling considerations**
6. **Failure scenarios and tolerance**
7. **Cost drivers**
8. **Security and governance layer**
9. **Real-company parallel**

---

# Architecture 1 — Unified Retail Platform

## 1. The business problem

A national omni-channel retailer needs one platform that unifies three
very different data shapes: **nightly financial/inventory batch feeds**
from its ERP system, **live clickstream events** from its website and
app (millions of events/day, bursty around sales events), and
**continuous order/customer changes** from its transactional order
database. Finance, marketing, fraud, and the recommendation team all
need to query a **consistent, current** view of this data — not three
disconnected copies that disagree with each other.

## 2. Full reference diagram

```
                    RETAIL PLATFORM — FULL END-TO-END ARCHITECTURE
                    ================================================

  BATCH SOURCE            STREAMING SOURCE            CDC SOURCE
  ERP nightly extract     Website/app clickstream      Orders DB (Aurora
  (finance, inventory,    (page views, cart adds,       PostgreSQL)
  supplier files)         search queries)                    |
        |                       |                             |
        v                       v                             v
  +-----------+       +-----------------+          +---------------------+
  | EventBridge|       | Kinesis Data     |          |   AWS DMS            |
  | Scheduler   |      | Streams (on-     |          |  (full load + CDC,   |
  | (cron, off-  |     | demand mode)     |          |   targets S3 in      |
  | peak hours)   |    | enhanced fan-out |          |   Parquet, LSN-      |
  +-----------+       | per consumer      |          |   tagged)            |
        |               +-----------------+          +---------------------+
        v                    |          |                        |
  +----------------+         v          v                        |
  | STEP FUNCTIONS   |  +--------+ +-------------+                |
  | STATE MACHINE     | | Lambda  | | Managed      |                |
  | [Extract]->[Xform] | |(cart/   | | Flink        |                |
  | ->[Load]->[Catalog]| | search  | |(sessionize,  |                |
  | Catch/Retry each   | | event   | | 5-min        |                |
  | step; failure ->   | | routing,| | windowed     |                |
  | SNS + SQS DLQ       | | fraud   | | aggregates)  |                |
  +----------------+     | signals)| +-------------+                |
        |                +--------+        |                       |
        |  Glue JDBC extract  |             |                       |
        |  (job bookmarks      v             v                       |
        |   enabled)      DynamoDB      S3 bronze                    |
        |                (idempotent,   (clickstream,                |
        |                 low-latency   batched ~60s)                |
        |                 cart state)        |                       |
        v                                    |                       |
  ===================================================================
                              ALL THREE CONVERGE HERE
  ===================================================================
                                    |
                                    v
  +---------------------------------------------------------------------+
  |     BRONZE — Iceberg tables, s3tables://retail/bronze/<source>/       |
  |     Raw ERP batch rows | raw clickstream events | raw CDC change rows |
  +---------------------------------------------------------------------+
                                    |
              Glue ETL: MERGE INTO (CDC/order upserts), dedupe by
              latest LSN, schema-conform clickstream, validate ERP
              extract against Glue Data Quality (DQDL) ruleset
                                    v
  +---------------------------------------------------------------------+
  |     SILVER — Iceberg tables, upserted, conformed, DQ-validated        |
  +---------------------------------------------------------------------+
                                    |
              Glue ETL: join orders + clickstream + inventory,
              compute customer lifetime value, daily sales aggregates
                                    v
  +---------------------------------------------------------------------+
  |     GOLD — Iceberg tables, business-ready                             |
  +---------------------------------------------------------------------+
                                    |
                     AWS GLUE DATA CATALOG (all reads resolve here)
                                    |
        +---------------------------+---------------------------+
        v                 v                    v                v
     Athena          Redshift               SageMaker         QuickSight
    (fraud team's   Spectrum               (recommendation    (BI dashboards,
     ad-hoc          (finance BI            model training,    reads via
     investigation)  dashboards,            reads gold          Redshift/Athena)
                      same snapshot          directly, no
                      Athena sees)           export step)

  =========================== GOVERNANCE LAYER ==========================
  Lake Formation (table/column grants, LF-Tags) wraps every table above.
  Column-level tags restrict PII (customer email, payment token) to
  the fraud and finance roles only; marketing sees a masked view.
  KMS (SSE-KMS) encrypts all S3 zones and Iceberg metadata.
  Amazon Macie scans bronze/silver for unexpected PII in the raw
  clickstream/ERP feeds. CloudTrail logs every Glue/Athena/Redshift
  Data API call against these tables for audit.
```

**Reading every arrow, source to sink:**

- **ERP → EventBridge Scheduler → Step Functions state machine.** The
  nightly financial/inventory extract is triggered on a cron schedule
  during off-peak hours; Step Functions orchestrates
  extract→transform→load→catalog-update with per-step retry/catch and
  a failure path to SNS + an SQS dead-letter queue holding failed-batch
  metadata for reprocessing — this entire block is lifted directly from
  `Batch-Pipeline.md`'s reference architecture.
- **Clickstream → Kinesis Data Streams (on-demand) → Lambda / Managed
  Flink.** Live browsing events fan out to two independent consumers
  with enhanced fan-out: Lambda handles low-latency, per-event routing
  (cart updates, real-time fraud signals) into DynamoDB with idempotent
  conditional writes, while Managed Flink performs stateful, windowed
  sessionization and writes 5-minute aggregates to S3 bronze — this
  whole block, including the consumer split and the delivery/ordering
  reasoning behind it, is `Streaming-Pipeline.md`'s reference
  architecture, reused wholesale.
- **Orders DB → AWS DMS → S3 bronze.** The transactional order database
  feeds CDC the same way `CDC.md` describes: DMS performs a full load
  of existing orders, then continuous CDC tailing the source
  transaction log, landing LSN-tagged change files in S3 — the
  Aurora-native engine here means this could equally have been drawn as
  a **zero-ETL integration** to Redshift for a no-transform sync (see
  `ZeroETL-vs-DMS-vs-Glue.md`); DMS is used here specifically because
  the change events need to land in the shared S3 bronze zone
  alongside the other two sources, not just sync into Redshift alone.
- **All three sources → Bronze.** This convergence point is the crux of
  the whole architecture: batch, streaming, and CDC all land as
  **Iceberg tables** in the same bronze zone, using the exact
  zone/catalog/governance structure from `Data-Lake.md`, upgraded to
  Iceberg's table format per `Lakehouse.md`.
- **Bronze → Silver via `MERGE INTO` + Glue Data Quality.** CDC rows
  upsert via key-based merge (deduped by latest LSN, exactly as in
  `CDC.md`); clickstream rows are schema-conformed; the ERP batch
  extract is validated against a **Glue Data Quality (DQDL)** ruleset
  before promotion — a batch-specific governance step layered on top of
  the base `Lakehouse.md` bronze→silver pattern.
- **Silver → Gold via joins/aggregation.** Orders, clickstream sessions,
  and inventory are joined to compute customer lifetime value and daily
  sales aggregates — standard `Lakehouse.md` gold-layer construction.
- **Gold → Glue Data Catalog → four consumers.** Athena, Redshift
  Spectrum, SageMaker, and QuickSight all resolve the same current
  Iceberg snapshot with zero data duplication — this is `Lakehouse.md`'s
  single most important arrow, reused here with four concrete named
  consumer teams (fraud, finance, recommendations, BI) instead of
  generic placeholders.
- **Governance layer wraps everything.** Lake Formation grants,
  LF-Tags, KMS encryption, Macie scanning, and CloudTrail logging apply
  uniformly across bronze/silver/gold — the `Data-Lake.md` governance
  layer, extended with Macie (PII discovery) and LF-Tags (column-level
  masking) because this platform handles customer PII and payment data.

## 3. Sibling-file contribution map

| Piece of this architecture | Sourced from |
|---|---|
| Nightly ERP extract orchestration (Step Functions, retry/DLQ pattern) | `Batch-Pipeline.md` |
| Clickstream ingestion, enhanced fan-out, Lambda vs. Flink consumer split | `Streaming-Pipeline.md` |
| Order database replication, full load + CDC, LSN dedup, DMS vs. zero-ETL judgment call | `CDC.md`, `ZeroETL-vs-DMS-vs-Glue.md` |
| Bronze/silver/gold zones, Glue Data Catalog, Lake Formation governance skeleton | `Data-Lake.md` |
| Iceberg table format, `MERGE INTO` upserts, multi-engine read consistency | `Lakehouse.md` |

## 4. Service rationale (selected decisions)

| Decision | Choice | Why not the alternative |
|---|---|---|
| Order DB replication mechanism | DMS (not zero-ETL) | Change events need to land in the shared S3 bronze zone alongside batch/streaming sources for unified Iceberg processing; zero-ETL only syncs into Redshift directly, bypassing the lake entirely |
| Clickstream stream backbone | Kinesis Data Streams (not MSK) | No existing Kafka investment anywhere in this platform; Kinesis's tighter native Lambda/Flink integration wins on ops simplicity (see `Serverless-vs-Cluster.md` and `Kinesis-vs-MSK.md`) |
| Merge/transform compute | Glue (not EMR on EC2) | Merge/transform volume is moderate and event/schedule-driven, not sustained 24/7 at extreme scale — Glue's serverless model fits better than owning a cluster (`Serverless-vs-Cluster.md`) |
| BI query path | Redshift Spectrum over gold Iceberg (not loading a Redshift copy) | Finance and marketing need the same current snapshot SageMaker and Athena see — loading a separate Redshift copy reintroduces the staleness/duplication problem `Lakehouse.md` exists to eliminate |

## 5. Scaling considerations

- Kinesis on-demand mode absorbs clickstream spikes around sales events
  automatically, without manual shard management.
- Managed Flink's KPU autoscaling handles sessionization load
  proportional to event volume without a capacity-planning exercise.
- Iceberg's optimistic concurrency control lets the nightly batch merge,
  the streaming Flink writer, and the CDC merge job all commit to
  bronze/silver concurrently without corrupting each other — the same
  concurrent-writer safety documented in `Lakehouse.md`.
- Compaction cadence must scale with the *fastest* writer in this
  platform (the streaming Flink job, committing every 5 minutes), not
  the slowest (nightly batch) — under-compacting for the busiest table
  degrades every consumer's query latency.

## 6. Failure scenarios and tolerance

| Failure | Effect | Mitigation |
|---|---|---|
| Nightly ERP Step Functions job fails at the Transform step | Retried per-step; if retries exhaust, failure handler routes to SNS + SQS DLQ holding the failed batch for reprocessing (`Batch-Pipeline.md` pattern) | On-call reprocesses from the DLQ once root cause is fixed; gold tables simply don't advance for that source until resolved |
| DMS replication instance falls behind during a flash sale traffic spike | CDC lag grows; near-real-time order visibility becomes stale | Monitor `CDCLatencySource`/`CDCLatencyTarget`; DMS Serverless or a larger instance class absorbs bursts better than a fixed small instance |
| Two concurrent merges (CDC + streaming Flink) hit silver at nearly the same moment | One commit succeeds, one retries automatically under Iceberg optimistic concurrency — safe, adds latency | Acceptable at this platform's write frequency; would need batching/serialization only if retry rates climbed materially |
| Clickstream Lambda consumer throttles under extreme burst | Cart-update events delayed | Enhanced fan-out gives this consumer dedicated per-shard throughput independent of the Flink consumer, isolating the two failure domains |

## 7. Cost drivers

- Storage: one Iceberg copy in S3 versus the old lake+warehouse
  duplication pattern (`Lakehouse.md`'s headline saving).
- Kinesis on-demand GB-ingested pricing, scaling with clickstream
  volume — no idle shard cost between sales events.
- Glue DPU-hours for nightly batch and merge jobs; Flink KPU-hours for
  continuous sessionization.
- Redshift Spectrum and Athena per-TB-scanned charges for BI/ad-hoc
  queries against gold.
- Eliminated cost: no separate Redshift-native copy, no dedicated
  SageMaker export pipeline — both retired by the lakehouse pattern.

## 8. Security and governance layer

- **Lake Formation** grants table- and column-level access; **LF-Tags**
  mark `customer_email` and `payment_token` columns as restricted,
  visible only to fraud/finance roles, masked for marketing.
- **KMS (SSE-KMS)** encrypts all S3 zones and Iceberg metadata at rest.
- **Amazon Macie** continuously scans bronze/silver for PII that
  shouldn't be there (e.g., a support-ticket free-text field
  accidentally containing a credit card number in the ERP extract).
- **CloudTrail data events** log every Glue/Athena/Redshift Data API
  call against these tables, satisfying the audit trail finance and
  compliance require.
- **VPC endpoints** (gateway for S3, interface for Glue/DMS/Kinesis)
  keep all traffic between services off the public internet.

## 9. Real-company parallel

A national omni-channel retailer (Target/Walmart-scale) unifying
in-store POS batch feeds, e-commerce clickstream, and order-management
CDC onto exactly this shape of platform: before migrating, the fraud
team's Athena queries, the finance team's nightly Redshift load, and
the recommendation team's SageMaker training pulls were three
independently-stale views of "today's orders." After unifying onto
Iceberg bronze/silver/gold with Lake Formation governance, all three
teams query the same current snapshot, and the previously separate
nightly Redshift COPY job is retired entirely.

---

# Architecture 2 — Banking Fraud & Regulatory Platform

## 1. The business problem

A regional bank needs **real-time fraud scoring** on card-swipe events
(sub-second), **continuous replication** of its on-premises,
heterogeneous core-banking database (Oracle) for analytics, and
**nightly regulatory reporting** that must be complete, auditable, and
reproducible — all while satisfying strict data-security and
governance requirements (encryption, fine-grained access control, full
audit trail) that a regulator can inspect at any time.

## 2. Full reference diagram

```
                BANKING FRAUD & REGULATORY PLATFORM — FULL ARCHITECTURE
                =========================================================

  CARD-SWIPE EVENTS          CORE BANKING DB              REGULATORY BATCH
  (existing on-prem          (on-prem Oracle,               SOURCES (loan
  Kafka cluster, Kafka        heterogeneous target)          servicing files,
  Connect already deployed)        |                          branch extracts)
        |                          v                                 |
        v                    +-------------------+                    |
  +---------------+          |  DMS Schema        |                    |
  |   Amazon MSK    |         |  Conversion         |                    |
  | (Kafka-wire      |        |  (Oracle -> PG-      |                    |
  |  compatible —     |       |  compatible schema/   |                    |
  |  reuses existing    |     |  DDL conversion)        |                    |
  |  Kafka Connect       |    +-------------------+                    |
  |  connectors           |            |                                 |
  |  unmodified)            |          v                                 v
  +---------------+        +---------------------+          +----------------+
        |                  |   AWS DMS             |          | EventBridge     |
        v                  |  REPLICATION INSTANCE  |          | Scheduler        |
  +---------------+        |  Phase 1: Full load     |          | (cron, off-peak)  |
  | Managed Flink   |       |  Phase 2: CDC — reads    |          +----------------+
  | (stateful,       |      |  Oracle redo log w/       |                  |
  |  windowed fraud   |     |  supplemental logging      |                  v
  |  scoring, sub-     |    +---------------------+          +----------------+
  |  second, exactly-   |             |                       | STEP FUNCTIONS   |
  |  once-ish sink)      |            v                       | STATE MACHINE      |
  +---------------+       +----------------------+            | [Extract]->[Xform]  |
        |                 | S3 BRONZE — CDC files, |            | ->[Load]->[Catalog]  |
        v                 | LSN/SCN-tagged          |            | Catch/Retry; failure  |
  +---------------+       +----------------------+            | -> SNS + SQS DLQ         |
  | DynamoDB        |                |                        +----------------+
  | (real-time       |                v                                 |
  |  fraud flag,      |     Glue: dedupe by latest SCN,                 v
  |  idempotent       |     MERGE INTO silver                    Glue JDBC extract
  |  conditional       |     (5-min cadence)                     (job bookmarks)
  |  writes)            |            |                                 |
  +---------------+                  |                                 |
        |                            |                                 |
        v                            v                                 v
  =========================================================================
                              ALL THREE CONVERGE HERE
  =========================================================================
                                      |
                                      v
  +-----------------------------------------------------------------------+
  |     BRONZE — Iceberg, s3tables://bank/bronze/<source>/                  |
  +-----------------------------------------------------------------------+
                                      |
       Glue ETL: MERGE INTO (CDC upserts), schema-conform card-swipe
       aggregates, validate regulatory batch against Glue Data Quality
                                      v
  +-----------------------------------------------------------------------+
  |     SILVER — Iceberg, upserted, DQ-validated                            |
  +-----------------------------------------------------------------------+
                                      |
             Glue ETL: join accounts + transactions + fraud flags,
             compute regulatory aggregates (reserve ratios, exposure)
                                      v
  +-----------------------------------------------------------------------+
  |     GOLD — Iceberg, business- and regulator-ready                       |
  +-----------------------------------------------------------------------+
                                      |
                       AWS GLUE DATA CATALOG
                                      |
              +------------------------+------------------------+
              v                        v                        v
       Redshift Serverless       Athena                  QuickSight
       (fraud analyst ad-hoc,   (regulatory report        (compliance
        unpredictable query      generation, auditable      officer
        volume)                  SQL history)                dashboards)

  ============================ GOVERNANCE LAYER ============================
  Lake Formation + LF-Tags: account-number and SSN columns restricted to
  fraud/compliance roles; branch staff see masked views only.
  KMS (SSE-KMS, customer-managed keys) encrypts everything at rest.
  Amazon Macie scans bronze/silver for unexpected PII beyond the tagged
  columns (e.g., an SSN typed into a free-text notes field).
  CloudTrail (management + data events) logs every access for regulator
  audit; retained per compliance policy.
  VPC interface endpoints keep DMS/Glue/MSK/Redshift traffic off the
  public internet; SCPs at the organization level prevent disabling
  encryption or logging in any account under this platform.
```

**Reading every arrow, source to sink:**

- **Existing on-prem Kafka → Amazon MSK.** The card-swipe event pipeline
  already runs on Kafka with Kafka Connect connectors deployed —
  exactly the trigger phrase from `Kinesis-vs-MSK.md` that makes **MSK**
  the only realistic choice: it's wire-compatible, so the existing
  Kafka Connect connectors and producer code migrate largely unmodified.
- **MSK → Managed Flink → DynamoDB.** Managed Flink performs stateful,
  windowed, sub-second fraud scoring directly against the card-swipe
  stream and writes flags to DynamoDB with idempotent conditional
  writes — the exact consumer pattern from `Streaming-Pipeline.md`,
  chosen here over Lambda because fraud scoring needs **stateful,
  windowed** computation (comparing a swipe against recent history),
  not simple per-event routing.
- **On-prem Oracle → DMS Schema Conversion → DMS → S3 bronze.** This is
  `CDC.md`'s reference architecture reused exactly: DMS Schema
  Conversion handles the heterogeneous structural conversion (Oracle →
  a PostgreSQL-compatible schema) since the target analytics tooling
  assumes PostgreSQL-compatible semantics; DMS performs full load then
  CDC reading Oracle's redo log (with supplemental logging enabled),
  landing SCN-tagged change files in bronze.
- **Regulatory batch sources → EventBridge Scheduler → Step Functions.**
  Loan servicing files and branch extracts are pulled on a scheduled,
  auditable cadence via the exact `Batch-Pipeline.md` orchestration
  pattern — extract/transform/load/catalog-update with retry and a
  DLQ, because regulatory reporting cannot silently skip a failed
  batch; every failure must be visible and reprocessable.
- **All three → Bronze, then MERGE INTO through silver to gold.**
  Identical `Lakehouse.md` mechanics to Architecture 1 — CDC rows
  upsert via key-based merge deduped by latest SCN (`CDC.md`), the
  regulatory batch extract is validated against Glue Data Quality
  before promotion, and gold aggregates (reserve ratios, exposure
  calculations) are computed via join/aggregation.
- **Gold → Redshift Serverless / Athena / QuickSight.** Fraud analyst
  query volume is unpredictable (spikes during active investigations),
  which is exactly the profile `Serverless-vs-Cluster.md` says favors
  **Redshift Serverless** over provisioned — no idle RPU cost between
  investigations, automatic scaling during one.
- **Governance layer wraps everything, more heavily than Architecture
  1.** Customer-managed KMS keys (not just SSE-KMS defaults), full
  CloudTrail data-event logging with compliance-driven retention, and
  organization-level SCPs preventing encryption/logging from being
  disabled reflect the higher regulatory bar a bank operates under
  versus a retailer.

## 3. Sibling-file contribution map

| Piece of this architecture | Sourced from |
|---|---|
| Card-swipe event backbone, Kafka Connect reuse via MSK | `CDC.md` cross-references `Kinesis-vs-MSK.md`'s decision rule directly |
| Managed Flink stateful fraud scoring, DynamoDB idempotent sink | `Streaming-Pipeline.md` |
| Oracle CDC, DMS Schema Conversion, LSN/SCN dedup + `MERGE INTO` | `CDC.md` |
| Regulatory batch extract orchestration, Step Functions retry/DLQ | `Batch-Pipeline.md` |
| Bronze/silver/gold, Glue Data Catalog, base governance skeleton | `Data-Lake.md` |
| Iceberg upserts, multi-engine consistent reads for fraud + compliance | `Lakehouse.md` |
| Redshift Serverless for unpredictable analyst query volume | `Serverless-vs-Cluster.md` |

## 4. Service rationale (selected decisions)

| Decision | Choice | Why not the alternative |
|---|---|---|
| Card-swipe stream backbone | MSK (not Kinesis) | Existing Kafka cluster + Kafka Connect connectors already deployed — the strongest possible MSK trigger per `Kinesis-vs-MSK.md`; rewriting onto Kinesis would mean replacing production connectors |
| Fraud scoring compute | Managed Flink (not Lambda) | Fraud scoring requires stateful, windowed comparison against recent transaction history — Lambda's per-event, largely stateless model doesn't fit this requirement the way Flink's checkpointed state does |
| Core banking replication | DMS + DMS Schema Conversion (not zero-ETL) | On-prem source disqualifies zero-ETL outright regardless of transformation needs; heterogeneous engine (Oracle → PostgreSQL-compatible) requires structural conversion DMS itself doesn't perform |
| Analyst query engine | Redshift Serverless (not provisioned) | Fraud investigation query volume is inherently unpredictable — spiky around active cases, idle otherwise — matching the serverless profile from `Serverless-vs-Cluster.md`, not the steady/predictable profile provisioned capacity rewards |

## 5. Scaling considerations

- MSK Serverless or provisioned broker count scales with card-swipe
  peak volume (holiday shopping season, for instance); the platform
  keeps the existing Kafka Connect connectors regardless of broker
  scaling mode.
- Managed Flink's KPU autoscaling must be tuned so fraud-scoring
  latency stays sub-second even during peak swipe volume — a scaling
  lag here has direct fraud-loss consequences, unlike most other
  latency-tolerant pipelines in this file.
- DMS replication instance sizing tracks Oracle transaction log volume,
  not account table size — high-write-volume periods (month-end
  batch posting) need headroom independent of total data size.
- Iceberg compaction on the fraud-flag and transaction silver tables
  must keep pace with the 5-minute CDC merge cadence to avoid
  degrading the sub-second query paths compliance and fraud both rely
  on.

## 6. Failure scenarios and tolerance

| Failure | Effect | Mitigation |
|---|---|---|
| Oracle source log retention exceeded during an extended DMS outage | CDC cannot resume; requires a fresh full load — a serious, auditable event for a bank | Monitor `CDCLatencySource`/`CDCLatencyTarget` aggressively; alert well before retention exhaustion, per `CDC.md`'s stated failure mode |
| Managed Flink fraud-scoring job falls behind under extreme swipe volume | Fraud detection latency degrades from sub-second toward seconds — a real risk window | KPU autoscaling headroom sized above historical peak; alerting on consumer lag |
| Regulatory batch Step Functions job fails at Load step | Retried per-step; failure routes to SNS + DLQ — the batch is NOT silently skipped, which is a regulatory requirement, not just an engineering preference | On-call must resolve and reprocess before the next reporting deadline; DLQ preserves the exact failed batch for audit |
| DMS delivers a duplicate change record after a replication instance restart | Silver stays correct because `MERGE INTO` is keyed and idempotent — no duplicate accounts/transactions | No action needed; this is the expected, tolerated at-least-once delivery behavior documented in `CDC.md` |

## 7. Cost drivers

- MSK broker-hours (or MSK Serverless partition-hours) for the
  card-swipe backbone — a standing cost since fraud detection runs
  continuously, unlike the retailer's more bursty clickstream.
- Managed Flink KPU-hours, sized to sustain sub-second scoring latency
  at peak — a cost the bank accepts as the price of fraud-loss
  prevention.
- DMS replication instance — a standing hourly cost for as long as CDC
  runs (effectively forever, per `CDC.md`).
- Redshift Serverless RPU-hours for unpredictable analyst query bursts
  — no idle cost between investigations, versus a provisioned
  cluster's 24/7 charge.
- Compliance-driven CloudTrail retention and Macie scanning add a real,
  non-optional cost line that a less-regulated platform (Architecture
  1) can size more loosely.

## 8. Security and governance layer

- **Lake Formation + LF-Tags** restrict account numbers and SSNs to
  fraud/compliance roles; branch staff querying the same tables see
  masked columns.
- **Customer-managed KMS keys** (not just AWS-managed defaults) give
  the bank explicit key-rotation and access-policy control demanded by
  banking regulators.
- **Amazon Macie** scans continuously for PII appearing outside its
  expected, tagged columns — a real risk in free-text fields like
  dispute notes.
- **CloudTrail** logs both management and data events, retained per
  the bank's regulatory retention policy, giving examiners a complete,
  queryable audit trail of who accessed what, when.
- **SCPs** at the AWS Organizations level prevent any account under
  this platform from disabling encryption or logging, even by an
  administrator with otherwise broad permissions — a defense-in-depth
  control appropriate to the regulatory stakes.

## 9. Real-company parallel

A regional bank replicating its on-prem Oracle core-banking system
into an AWS lakehouse for fraud analytics (the same scenario worked
through in `CDC.md`'s real-enterprise example), extended here with the
full platform view: the existing Kafka-based card-swipe pipeline stays
on MSK rather than being rewritten, Managed Flink scores transactions
in real time against a rolling window of recent history, and the same
Iceberg silver `transactions` table that feeds fraud detection also
feeds the nightly regulatory reporting pipeline — one governed dataset,
two very different consumers with very different latency requirements,
which is exactly the kind of platform-level composition this capstone
file exists to illustrate.

---

# Architecture 3 — Healthcare IoT Patient-Monitoring Platform

## 1. The business problem

A hospital network needs to ingest **continuous vital-sign telemetry**
from bedside monitors (streaming), keep an **up-to-date copy** of
patient records from its Electronic Health Records (EHR) system
(CDC), and run **nightly insurance-claims batch processing** — all
under HIPAA-grade security, with strict column-level access control
separating clinical staff (who need identifiable patient data) from
research/analytics staff (who should see de-identified data only).

## 2. Full reference diagram

```
              HEALTHCARE IoT PATIENT-MONITORING PLATFORM — ARCHITECTURE
              ===========================================================

  BEDSIDE MONITORS            EHR SYSTEM (patient           CLAIMS SOURCE
  (vitals: heart rate,        records, on RDS               (insurance claims
  SpO2, BP — continuous       PostgreSQL)                    batch files)
  telemetry)                        |                              |
        |                           v                              v
        v                    +---------------+            +----------------+
  +---------------+          | Zero-ETL       |            | EventBridge      |
  | Kinesis Data    |        | integration     |            | Scheduler          |
  | Streams (on-     |       | (RDS PostgreSQL |            | (cron, nightly)      |
  |  demand, enhanced |      |  -> Redshift,    |            +----------------+
  |  fan-out)          |     |  no transform,    |                    |
  +---------------+          |  least ops)        |                    v
        |          |         +---------------+          +----------------+
        v          v                  |                  | STEP FUNCTIONS   |
  +--------+ +-----------+            |                  | STATE MACHINE      |
  | Lambda  | | Managed    |          |                  | [Extract]->[Xform]  |
  |(threshold| | Flink      |          |                  | ->[Load]->[Catalog]  |
  | alert    | |(windowed   |          |                  | Catch/Retry; failure  |
  | routing, | | vitals      |          |                  | -> SNS + SQS DLQ         |
  | critical | | trend        |          |                  +----------------+
  | -value    | | detection,   |          |                            |
  | paging)   | | 1-min          |          |                            v
  +--------+ | windows)        |          |                    Glue JDBC extract
      |       +-----------+          |                    (job bookmarks)
      v             |                |                              |
  DynamoDB           v                |                              |
  (idempotent   S3 bronze              |                              |
   alert state,  (vitals,               |                              |
   patient-      batched ~30s)          |                              |
   session keyed)      |                |                              |
      |                |                |                              |
      v                v                v                              v
  =============================================================================
                              ALL THREE CONVERGE HERE
                  (note: EHR path also feeds Redshift directly via
                   zero-ETL for clinical dashboards — see note below)
  =============================================================================
                                      |
                                      v
  +---------------------------------------------------------------------+
  |     BRONZE — Iceberg, s3tables://health/bronze/<source>/               |
  +---------------------------------------------------------------------+
                                      |
        Glue ETL: MERGE INTO (patient record upserts where an EHR
        CDC path also lands here for research use), schema-conform
        vitals, validate claims batch against Glue Data Quality
                                      v
  +---------------------------------------------------------------------+
  |     SILVER — Iceberg, upserted, DQ-validated, PHI columns tagged       |
  +---------------------------------------------------------------------+
                                      |
             Glue ETL: join vitals + patient context, compute
             claims-ready aggregates, generate de-identified
             research extract (PHI columns dropped/tokenized)
                                      v
  +---------------------------------------------------------------------+
  |     GOLD — two views: clinical (full PHI) + research (de-identified)  |
  +---------------------------------------------------------------------+
                                      |
                       AWS GLUE DATA CATALOG
                                      |
              +------------------------+------------------------+
              v                        v                        v
       Redshift Spectrum          Athena                  SageMaker
       (clinical ops              (claims/billing           (research team,
        dashboards, full           reporting, full            de-identified
        PHI access, clinical        audit trail)               gold view only)
        roles only)

  ============================ GOVERNANCE LAYER ============================
  Lake Formation + LF-Tags: patient name/MRN/DOB tagged PHI, visible
  only to clinical roles; research role sees the de-identified gold
  view exclusively — enforced at the CATALOG level, not by convention.
  KMS (customer-managed keys) encrypts all PHI at rest and in transit.
  Amazon Macie continuously scans for PHI leaking into the
  de-identified research view (a genuine, tested failure mode).
  CloudTrail data events log every access to PHI-tagged tables for
  HIPAA audit. VPC interface endpoints keep all traffic private.
```

**Reading every arrow, source to sink:**

- **Bedside monitors → Kinesis Data Streams → Lambda / Managed Flink.**
  Continuous vitals telemetry is exactly `Streaming-Pipeline.md`'s
  reference shape: Lambda handles low-latency threshold-alert routing
  (a dangerously low SpO2 reading must page a nurse in seconds, not
  minutes) with idempotent DynamoDB writes, while Managed Flink
  performs windowed trend detection (a slow, sustained heart-rate drift
  over several minutes) that a single-event Lambda check would miss
  entirely — the same dual-consumer, enhanced-fan-out split as
  Architecture 1's clickstream path, applied to a life-safety use case
  instead of a marketing one.
- **EHR (RDS PostgreSQL) → zero-ETL → Redshift, AND EHR → (optional CDC
  path) → S3 bronze.** This platform deliberately shows **both**
  patterns from `ZeroETL-vs-DMS-vs-Glue.md` side by side: clinical
  dashboards need patient records synced into Redshift with zero
  transformation and the least possible operational overhead — a
  textbook zero-ETL case (RDS PostgreSQL → Redshift is a supported
  pair). Research use, by contrast, needs the data to land in the
  shared lake for de-identification processing that zero-ETL cannot
  perform (transformation disqualifies it per `ZeroETL-vs-DMS-vs-Glue.md`'s
  central trap) — so a **separate CDC path** (DMS, not shown in full
  detail here since it's mechanically identical to `CDC.md`'s reference
  architecture) feeds bronze for that purpose. Two different consumers
  of the same source data, two different correct mechanisms.
- **Claims batch → EventBridge Scheduler → Step Functions.** Nightly
  insurance-claims processing uses the exact `Batch-Pipeline.md`
  orchestration pattern — scheduled trigger, per-step retry, DLQ on
  failure — because a silently dropped claims batch is a billing and
  compliance problem, not just an engineering inconvenience.
- **Bronze → Silver → Gold, with a governance-driven fork at gold.**
  Standard `Lakehouse.md`/`Data-Lake.md` mechanics through silver, but
  gold deliberately produces **two views**: a full-PHI clinical view
  and a **de-identified research view** with PHI columns dropped or
  tokenized during the silver→gold transform — an explicit, tested
  governance requirement this architecture adds on top of the base
  lakehouse pattern.
- **Gold → Redshift Spectrum / Athena / SageMaker, each gated by
  role.** Clinical staff query the full-PHI view via Redshift Spectrum;
  billing/claims teams use Athena against claims-ready aggregates;
  research staff querying via SageMaker are restricted, at the
  **catalog level** via Lake Formation, to the de-identified view only
  — access control enforced by the platform, not by asking researchers
  to "just query the right table."

## 3. Sibling-file contribution map

| Piece of this architecture | Sourced from |
|---|---|
| Vitals telemetry ingestion, dual Lambda/Flink consumer split | `Streaming-Pipeline.md` |
| EHR clinical sync (zero-ETL) vs. EHR research sync (CDC) side by side | `ZeroETL-vs-DMS-vs-Glue.md`, `CDC.md` |
| Nightly claims batch orchestration, retry/DLQ | `Batch-Pipeline.md` |
| Bronze/silver/gold zones, catalog-enforced access control | `Data-Lake.md` |
| Iceberg upserts, two-view (clinical/research) gold layer | `Lakehouse.md` |

## 4. Service rationale (selected decisions)

| Decision | Choice | Why not the alternative |
|---|---|---|
| Clinical EHR sync | Zero-ETL (RDS PostgreSQL → Redshift) | No transformation needed for clinical dashboards, supported pair, "least operational overhead" — the textbook zero-ETL case per `ZeroETL-vs-DMS-vs-Glue.md` |
| Research EHR sync | CDC via DMS into the lake | De-identification is a transformation requirement that disqualifies zero-ETL outright; the data needs to land in the shared bronze zone alongside vitals for joined research analysis |
| Vitals trend detection | Managed Flink (not Lambda alone) | A slow, sustained physiological drift across minutes requires windowed, stateful comparison — a single-event Lambda check structurally cannot detect a trend across many events |
| Research access enforcement | Lake Formation catalog-level grants (not a "please only query this table" policy) | HIPAA-grade PHI protection requires enforcement the platform guarantees, not a convention that depends on every researcher's discipline |

## 5. Scaling considerations

- Kinesis on-demand absorbs hospital-wide monitor count growth (adding
  a new wing, a new ICU) without a manual shard-resizing exercise.
- Managed Flink's windowed trend detection must scale per-patient
  session state — the more concurrent monitored patients, the more
  parallel windowed state Flink tracks; KPU autoscaling handles this,
  but window size/state retention should be tuned deliberately rather
  than left at defaults, since excessive state retention per patient
  adds real cost at hospital-network scale.
- The de-identification transform (silver→gold research view) scales
  with total patient-record volume, not vitals event volume — a
  batch-shaped Glue job, not a streaming one, is the right compute
  profile for it.

## 6. Failure scenarios and tolerance

| Failure | Effect | Mitigation |
|---|---|---|
| Lambda threshold-alert consumer throttles during a mass-casualty surge in monitored patients | Life-safety alert latency degrades — the highest-stakes failure mode in this entire file | Enhanced fan-out gives this consumer dedicated throughput; alert-path Lambda concurrency should be provisioned/reserved, not left to default burst limits, given the stakes |
| Zero-ETL clinical sync experiences a service disruption | Clinical dashboards fall behind the EHR source | Monitor target-side integration status; this is why the research CDC path is architecturally independent — a zero-ETL disruption does not affect the DMS-fed research pipeline |
| De-identification transform bug leaks a PHI column into the research gold view | Serious HIPAA violation | Amazon Macie continuously scans the research view specifically for this failure mode, in addition to standard Lake Formation column grants — defense in depth, not reliance on one control |
| Nightly claims Step Functions job fails at Transform | Retried per-step; failure routes to DLQ, claims batch is never silently dropped | On-call reprocesses before billing deadlines; DLQ preserves the batch for audit, mirroring Architecture 2's regulatory batch handling |

## 7. Cost drivers

- Kinesis on-demand and Managed Flink KPU-hours scale with monitored-
  patient count and vitals sampling frequency — a real, monitored cost
  as the hospital network grows.
- Zero-ETL shifts EHR sync compute cost onto Redshift rather than a
  separate replication-instance line item, per `ZeroETL-vs-DMS-vs-Glue.md`.
- The parallel DMS-based research CDC path is a second, standing
  replication-instance cost — a deliberate tradeoff for keeping
  research and clinical sync paths independent.
- Glue DPU-hours for the de-identification transform and nightly
  claims batch.
- Compliance cost (Macie scanning, CloudTrail retention) is
  non-optional here, structurally identical in kind to Architecture 2's
  regulatory cost floor, driven by HIPAA rather than banking
  regulation.

## 8. Security and governance layer

- **Lake Formation + LF-Tags** tag patient name/MRN/date-of-birth as
  PHI; grants are enforced at the catalog level so a research-role
  query against the clinical gold view is denied outright, not merely
  discouraged.
- **Customer-managed KMS keys** encrypt PHI at rest; TLS in transit
  throughout.
- **Amazon Macie** scans the de-identified research view on an ongoing
  basis specifically to catch PHI leakage from a transform bug — this
  is the single most tested failure mode in a healthcare data
  architecture question.
- **CloudTrail data events** provide the access audit trail HIPAA
  requires, logging every read against PHI-tagged tables.
- **VPC interface endpoints** keep monitor telemetry, EHR sync, and
  claims processing traffic entirely off the public internet.

## 9. Real-company parallel

A hospital network standardizing bedside-monitor telemetry, EHR
records, and insurance claims onto one governed platform: before this
architecture, research staff requesting "de-identified" data received
manually scrubbed exports on an ad-hoc basis, a slow and
inconsistently-applied process. After building the catalog-enforced
two-view gold layer described here, research access to de-identified
data becomes self-service and consistently correct by construction —
the platform guarantees the de-identification, rather than depending on
whoever happened to prepare that week's export.

---

## Exam traps (capstone synthesis)

⚠️ **A scenario naming multiple source types (batch file, live event
stream, operational database) is not three separate questions — it's
one architecture question testing whether you can assign each source
to its correct ingestion pattern (`Batch-Pipeline.md` /
`Streaming-Pipeline.md` / `CDC.md`) and land all three in the same
governed lakehouse, not three disconnected systems.**

⚠️ **"Multiple teams need the same current data, no duplication" is
always a lakehouse/Iceberg signal**, regardless of how many different
ingestion patterns feed it — the convergence-at-bronze pattern shown in
all three architectures above is the direct answer to that phrase.

⚠️ **Don't assume the same source needs only one ingestion mechanism.**
Architecture 3 deliberately shows the EHR source feeding both a
zero-ETL clinical path and a separate DMS-based research path — the
correct mechanism depends on what the *consumer* needs (no-transform
sync vs. transformation for de-identification), not on the source
alone.

⚠️ **Serverless-vs-cluster reasoning applies inside these architectures
too**, not just in isolated service-choice questions — Redshift
Serverless for unpredictable fraud-investigation query volume
(Architecture 2), Glue over EMR on EC2 for moderate, event-driven merge
volume (Architecture 1) — the same "least ops overhead" vs.
"cost-effective at scale" tension from `Serverless-vs-Cluster.md` shows
up wherever a compute choice is made.

⚠️ **Governance is not a bolt-on step at the end — it wraps every zone,
every arrow.** All three architectures apply Lake Formation, LF-Tags,
KMS, Macie, and CloudTrail across bronze/silver/gold uniformly, not
just at the final "serving" layer; a scenario testing whether you'd
apply column-level PII protection only to the gold layer (leaving raw
PII sitting unprotected in bronze) is testing exactly this gap.

⚠️ **CDC's at-least-once delivery and idempotent `MERGE INTO` correctness
argument (from `CDC.md`) applies identically inside every one of these
larger architectures** — a duplicate DMS-delivered change record in the
banking or healthcare platform is handled the same way it's handled in
the standalone `CDC.md` reference architecture, because the merge logic
doesn't change just because the platform around it got bigger.

---

## Practice questions (15)

**Q1.** A platform ingests nightly ERP batch files, live clickstream
events, and continuous order-database changes, and three different
teams (finance, marketing, fraud) each need a current, consistent view
of the resulting data with no duplication. What is the architecturally
correct convergence point for these three source types?

- A. Three separate Redshift copies, one per team — ✗ Reintroduces the
  duplication/staleness problem `Lakehouse.md` exists to eliminate.
- B. **A shared Iceberg bronze/silver/gold lakehouse that all three
  ingestion patterns land in, queried by all three teams through the
  Glue Data Catalog — ✓** Matches Architecture 1's convergence pattern
  exactly; one copy, multiple engines, no duplication.
- C. Each team builds and maintains its own independent pipeline from
  the original sources — ✗ Triplicates engineering effort and
  guarantees the three views drift out of sync with each other.
- D. Only the marketing team gets access; finance and fraud query the
  ERP and order database directly — ✗ Defeats the purpose of building
  a unified platform at all, and leaves finance/fraud without access to
  the joined, enriched gold-layer data.

**Q2.** In Architecture 1, why is DMS used for the order database
replication instead of a zero-ETL integration, even though Aurora is a
zero-ETL-eligible source?

- A. Zero-ETL doesn't support Aurora as a source — ✗ False; Aurora
  MySQL/PostgreSQL are supported zero-ETL sources.
- B. **The change events need to land in the shared S3 bronze zone
  alongside the batch and streaming sources for unified Iceberg
  processing; zero-ETL syncs directly into Redshift only, bypassing the
  lake — ✓** The correct architectural reasoning given in the diagram
  walkthrough.
- C. DMS is always preferred over zero-ETL regardless of requirements —
  ✗ False; `ZeroETL-vs-DMS-vs-Glue.md` establishes zero-ETL as
  preferable when its narrower conditions are met.
- D. Zero-ETL cannot perform continuous replication, only one-time
  syncs — ✗ False; zero-ETL is near-real-time and continuous by design.

**Q3.** Architecture 2's card-swipe event pipeline uses MSK instead of
Kinesis Data Streams. What is the specific justification?

- A. MSK is always higher-performing than Kinesis — ✗ Not the stated or
  correct justification; both are full-featured streaming services.
- B. **An existing on-prem Kafka cluster with Kafka Connect connectors
  already deployed is present — the exact `Kinesis-vs-MSK.md` trigger
  phrase that makes MSK the only realistic choice without rewriting
  production connectors — ✓** Correct, matches the stated rationale.
- C. Kinesis cannot support sub-second fraud scoring latency — ✗ False;
  latency is driven by the consumer (Managed Flink) and stream
  configuration, not an inherent Kinesis limitation.
- D. MSK is required whenever the data involves financial transactions
  — ✗ Not a real AWS constraint; the deciding factor is the existing
  Kafka investment, not the data's subject matter.

**Q4.** Why does Architecture 2 use Managed Flink rather than Lambda for
fraud scoring?

- A. Lambda cannot process streaming data at all — ✗ False; Lambda is a
  valid Kinesis/MSK consumer for per-event processing.
- B. **Fraud scoring requires stateful, windowed comparison of a swipe
  against recent transaction history, which needs Flink's checkpointed
  state — a single-event Lambda invocation structurally can't compare
  against a rolling window — ✓** The correct architectural reasoning.
- C. Managed Flink is cheaper than Lambda at any volume — ✗ Not
  necessarily true and not the stated reason; the deciding factor is
  processing model fit, not raw cost.
- D. Lambda has a hard limit preventing it from ever writing to
  DynamoDB — ✗ False; Architecture 1 and 3 both show Lambda writing to
  DynamoDB successfully.

**Q5.** In Architecture 3, why does the EHR source feed two separate
pipelines (zero-ETL to Redshift AND a DMS-based CDC path into the
lake) instead of just one?

- A. This is a mistake; only one pipeline should exist per source — ✗
  Incorrect; the two pipelines serve two consumers with genuinely
  different requirements.
- B. **Clinical dashboards need a no-transform, near-real-time sync
  (zero-ETL fits exactly), while research use needs de-identification —
  a transformation that disqualifies zero-ETL — requiring a separate
  CDC path into the lake for that processing — ✓** Correct, matches the
  stated architectural reasoning directly.
- C. Zero-ETL is unreliable, so a backup DMS path is required for
  redundancy — ✗ Not the stated or correct reason; the two paths serve
  different consumers, not redundancy.
- D. DMS is required whenever PHI is involved — ✗ Not a real
  constraint; the deciding factor is the transformation requirement
  (de-identification), not the presence of PHI alone.

**Q6.** What governance control in Architecture 3 specifically catches
a bug where the de-identification transform accidentally leaves a PHI
column in the research gold view?

- A. CloudTrail — ✗ Logs access after the fact; doesn't detect PHI
  content itself.
- B. **Amazon Macie, scanning the research view on an ongoing basis for
  unexpected PHI — ✓** Macie's PII/PHI discovery capability is the
  specific control named for this exact failure mode.
- C. KMS encryption — ✗ Protects data at rest/in transit; doesn't
  detect whether the wrong columns were included in a view.
- D. VPC interface endpoints — ✗ Control network path, not data content.

**Q7.** Across all three architectures, what is the common purpose of
the Glue Data Catalog sitting between the gold layer and the multiple
query engines (Athena, Redshift Spectrum, SageMaker, QuickSight)?

- A. It converts Iceberg tables to a proprietary AWS-only format — ✗
  False; Iceberg remains an open table format throughout.
- B. **It lets every engine resolve the same current Iceberg snapshot
  independently, without any data movement between engines — the core
  lakehouse mechanic from `Lakehouse.md` — ✓** Correct and consistent
  across all three architectures.
- C. It replaces the need for Lake Formation governance entirely — ✗
  False; the catalog and Lake Formation grants work together, not as
  substitutes.
- D. It only supports read access from Athena; other engines need a
  separate copy — ✗ False; the entire point is multi-engine access
  without duplication.

**Q8.** In Architecture 1, why is Glue chosen over EMR on EC2 for the
merge/transform compute layer?

- A. EMR on EC2 cannot perform `MERGE INTO` operations against Iceberg
  tables — ✗ False; EMR on EC2 fully supports Iceberg `MERGE INTO`.
- B. **Merge/transform volume in this platform is moderate and event/
  schedule-driven rather than sustained 24/7 at extreme scale, which
  favors Glue's serverless model over owning and sizing a cluster — ✓**
  Matches the stated service-rationale reasoning and the general
  `Serverless-vs-Cluster.md` decision framework.
- C. Glue is always cheaper than EMR regardless of workload profile — ✗
  False in general — `Serverless-vs-Cluster.md` establishes that
  provisioned/cluster options can be cheaper at sustained, high,
  predictable volume.
- D. EMR on EC2 does not support the Glue Data Catalog — ✗ False; EMR
  integrates with the Glue Data Catalog directly.

**Q9.** Why does Architecture 2 choose Redshift Serverless over
provisioned Redshift for the fraud analyst query layer?

- A. Redshift Serverless is always the cheaper option — ✗ Not a general
  truth; `Serverless-vs-Cluster.md` shows provisioned/Reserved capacity
  can be cheaper at sustained, predictable volume.
- B. **Fraud investigation query volume is inherently unpredictable —
  spiky during active cases, idle otherwise — matching the workload
  profile Serverless is built for, rather than the steady/predictable
  profile provisioned capacity rewards — ✓** Correct, matches the
  stated rationale and the `Serverless-vs-Cluster.md` decision
  framework.
- C. Provisioned Redshift cannot be secured with customer-managed KMS
  keys — ✗ False; both provisioned and Serverless Redshift support
  customer-managed KMS encryption.
- D. Redshift Serverless is required for any workload involving
  financial fraud — ✗ Not a real constraint; the deciding factor is
  query volume predictability, not the data's subject matter.

**Q10.** What does the CDC merge logic in these architectures do when a
DMS replication instance restart causes a change record to be
redelivered?

- A. The silver table ends up with a duplicate row — ✗ Describes what
  would happen with a naive append-only `INSERT`, not the key-based
  `MERGE INTO` these architectures use.
- B. **Nothing incorrect happens — the key-based `MERGE INTO` is
  idempotent, so applying the same change twice produces the same end
  state, consistent with `CDC.md`'s stated behavior and reused
  unmodified in Architectures 1, 2, and 3 — ✓** Correct.
- C. The merge job crashes and requires manual intervention — ✗
  Unfounded; idempotent merge logic handles this gracefully by design.
- D. DMS guarantees this scenario cannot occur — ✗ False; DMS provides
  at-least-once delivery, not exactly-once — redelivery is expected and
  tolerated, not prevented.

**Q11.** A regulator asks a bank to prove exactly who accessed a
specific customer's account-level data over the past year. Which
component of Architecture 2 directly answers this?

- A. Amazon Macie — ✗ Discovers/classifies sensitive data; doesn't log
  who accessed it.
- B. Lake Formation LF-Tags — ✗ Enforces access control; doesn't itself
  provide a historical access log.
- C. **CloudTrail data events, logging every Glue/Athena/Redshift Data
  API call against the tagged tables, retained per compliance policy —
  ✓** The specific audit-trail mechanism named for this exact
  requirement.
- D. KMS encryption — ✗ Protects data confidentiality; doesn't log
  access history.

**Q12.** Why does Architecture 3's alert-routing Lambda function
warrant provisioned/reserved concurrency rather than relying on default
burst limits, unlike, say, Architecture 1's cart-update Lambda?

- A. Lambda concurrency configuration is unrelated to reliability in
  any scenario — ✗ False; concurrency limits directly affect whether
  invocations are throttled under load.
- B. **The alert-routing Lambda handles life-safety threshold alerts —
  a mass-casualty surge in monitored patients could throttle default
  burst capacity at exactly the moment alert latency matters most,
  making the stakes of a throttling event far higher than a marketing
  cart-update delay — ✓** Correct, matches the stated failure-scenario
  reasoning.
- C. Lambda cannot be used for healthcare data under any configuration
  — ✗ False; Lambda is used throughout Architecture 3 for healthcare
  data processing.
- D. Provisioned concurrency is required by HIPAA for all Lambda
  functions — ✗ Not a real HIPAA requirement; the reasoning here is
  operational risk, not a compliance mandate.

**Q13.** All three architectures apply Lake Formation, LF-Tags, KMS,
Macie, and CloudTrail across bronze, silver, AND gold zones rather than
only at the final gold/serving layer. Why does this matter?

- A. It doesn't matter; governance only needs to protect the final,
  business-facing data — ✗ Incorrect and the exact misconception this
  question tests against.
- B. **Raw PII/PHI already exists in bronze (and often silver) before
  any transformation happens — protecting only gold would leave raw
  sensitive data sitting unprotected earlier in the pipeline — ✓**
  Correct; matches the capstone exam-traps section's stated reasoning.
- C. Bronze and silver zones never contain sensitive data, only gold
  does — ✗ False; raw CDC/streaming/batch sources routinely contain
  full PII/PHI before any masking or de-identification transform runs.
- D. Applying governance to bronze and silver is optional and purely a
  best practice with no real risk if skipped — ✗ Understates the risk;
  skipping it leaves genuinely sensitive raw data exposed.

**Q14.** In Architecture 3, a researcher's SageMaker query against the
gold layer is denied access to the clinical (full-PHI) view. What
mechanism enforces this denial?

- A. A written policy document researchers are trained to follow — ✗
  Not an enforced technical control; relies on human compliance alone.
- B. **Lake Formation grants at the catalog level, restricting the
  research role to the de-identified gold view specifically — ✓**
  Correct; the architecture explicitly states this is enforced at the
  catalog level, not by convention.
- C. SageMaker's own built-in row-level security, independent of any
  AWS governance service — ✗ Not how this is implemented in the
  architecture; Lake Formation is the enforcement point across all
  query engines, including SageMaker.
- D. Network-level VPC security groups blocking SageMaker's IP range —
  ✗ Network controls don't express table/view-level access distinctions
  like "full-PHI view vs. de-identified view."

**Q15.** What is the single biggest structural lesson this capstone
file is built to teach, distinct from what any one sibling file (
`Data-Lake.md`, `Lakehouse.md`, `CDC.md`, `Batch-Pipeline.md`,
`Streaming-Pipeline.md`) teaches on its own?

- A. That Iceberg is always the correct table format — ✗ That's a
  `Lakehouse.md`/Domain 2 lesson, not this file's distinct
  contribution, and this file doesn't argue Iceberg is universally
  mandatory either.
- B. **That real platforms compose multiple ingestion patterns (batch +
  streaming + CDC) into ONE governed lakehouse, with the correct
  mechanism for each source chosen independently based on that
  source's specific consumers and requirements — not by picking one
  pattern and forcing every source through it — ✓** The explicit,
  stated purpose of this file, demonstrated three times across
  different industries.
- C. That every company should build all three of these exact
  architectures — ✗ Overstates the point; these are illustrative
  compositions, not a mandate to replicate all three.
- D. That governance should be applied only once a platform reaches
  banking or healthcare-level regulatory requirements — ✗ Contradicted
  directly by Architecture 1 (retail), which applies a full governance
  layer despite lighter regulatory stakes than Architectures 2 and 3.
