# Retail and E-commerce Architecture — Clickstream, POS, Inventory, and Personalization

> Unifying web clickstream, point-of-sale transactions, and inventory
> systems into a lakehouse that drives personalization, demand
> forecasting, and merchandising dashboards — with seasonal traffic
> spikes (Black Friday / Cyber Monday) as a first-class design
> constraint. Built from the same service vocabulary as the rest of
> this repo — see `00-START-HERE/SERVICE-SELECTION-MATRIX.md` Part 0
> for how exam questions are assembled from scenario → requirement →
> constraint.

## CONTENTS

1. [Business context](#context)
2. [End-to-end architecture](#architecture)
3. [Service-by-service rationale](#rationale)
4. [Security and governance — PCI-DSS for payment data](#security)
5. [Scaling at 10x and 100x (seasonal peaks)](#scaling)
6. [Failure scenarios](#failure)
7. [Cost drivers and optimization](#cost)
8. [Real-company parallel](#company)
9. [Exam traps specific to retail scenarios](#traps)
10. [Practice questions](#questions)

---

<a name="context"></a>
## 1. Business context

A retailer's data estate spans three fundamentally different shapes.
**Clickstream data** — every page view, add-to-cart, search query, and
scroll event across web and mobile — is high-volume, semi-structured,
and only individually valuable in aggregate; one click doesn't matter,
but the pattern across millions of sessions drives personalization and
recommendation models. **Point-of-sale (POS) and order transactions**
are the opposite: low-volume per event relative to clickstream, but
each one is financially authoritative and must reconcile exactly with
inventory and revenue reporting — closer in spirit to the banking
transaction pattern than to clickstream. **Inventory and supply-chain
data** sits in between: warehouse management systems, supplier
EDI feeds, and store-level stock counts that update on their own
cadence (sometimes real-time from modern POS integrations, sometimes
batch nightly from legacy warehouse systems) and that demand forecasting
and replenishment models depend on being reasonably fresh, not
necessarily real-time.

The defining architectural pressure in retail, more than almost any
other vertical in this repo, is **extreme, predictable, and unpredictable
seasonality**. A retailer's traffic on Black Friday or during a flash
sale can run 10–50x a normal day's volume, concentrated into a handful
of hours — clickstream volume spikes first and hardest, POS transaction
volume spikes second (checkout conversion lags browsing), and inventory
update frequency spikes as stock depletes in near-real-time across
thousands of SKUs. A pipeline sized for steady-state traffic that can't
absorb this spike isn't a performance problem, it's a revenue-loss
event — a personalization service that falls over during peak traffic
directly costs conversions at the exact moment they matter most. This
is why "seasonal scaling" isn't a nice-to-have discussion for retail
architecture questions, it's the central design constraint the rest of
the choices flow from: serverless and auto-scaling services aren't just
"least operational overhead," they're the only pattern that survives a
50x traffic multiplier without a war-room.

Unifying these three data shapes — clickstream, POS, inventory — into a
single queryable model is where the **lakehouse pattern** earns its
keep in retail specifically. Personalization models need clickstream
joined with purchase history; demand forecasting needs POS transactions
joined with inventory levels and, often, external signals (weather,
local events); merchandising dashboards need all three at once,
sliced by store, region, and category. None of this works well as
three separate, siloed systems — it needs one unified curated layer
that different consumption tools (ML training, BI dashboards, ad hoc
analysis) can all read from without each building their own
integration pipeline.

---

<a name="architecture"></a>
## 2. End-to-end architecture

```
   WEB / MOBILE CLICKSTREAM          POS SYSTEMS (in-store)        INVENTORY / WMS
 ┌───────────────────────┐        ┌────────────────────────┐   ┌─────────────────────┐
 │ Page views, cart adds, │        │ Register transactions,  │   │ Warehouse mgmt sys,  │
 │ search queries, scroll │        │ store-level order data  │   │ supplier EDI feeds   │
 └───────────┬────────────┘        └────────────┬────────────┘   └──────────┬───────────┘
             │ (1)                              │ (2)                       │ (3)
             v                                  v                           v
   Kinesis Data Streams              AWS DMS (CDC) or zero-ETL      Glue ETL (nightly) or
   → Amazon Data Firehose            (Aurora/RDS POS DB → lake)     DMS CDC (real-time WMS)
   (buffer, convert to Parquet,             │                              │
    dynamic partitioning)                   │                              │
             │                              │                              │
             v                              v                              v
 ┌──────────────────────────────────────────────────────────────────────────────────┐
 │                    RAW / BRONZE ZONE — Amazon S3, KMS (SSE-KMS)                   │
 │          Partitioned by source/date; retained for replay & reprocessing           │
 └───────────────────────────────────┬────────────────────────────────────────────--┘
                                      │ (4)
                          AWS Glue ETL (Spark) — dedup, PCI
                          field masking on payment tokens, conform schema
                                      │
                                      v
 ┌────────────────────────────────────────────────────────────────────────────────--┐
 │        CURATED / SILVER ZONE — Apache Iceberg tables on S3 (lakehouse)            │
 │   Unified schema: sessions + orders + inventory, joinable by customer/SKU/store   │
 └───────────────────────────────────┬────────────────────────────────────────────--┘
                                      │ (5)
                ┌─────────────────────┴──────────────────────┐
                v                                              v
   Glue ETL / EMR (feature engineering            Glue ETL (aggregation: daily
   for personalization + demand                    sales, stock position by store)
   forecasting model training)                                │
                │                                              v
                v                              ┌────────────────────────────────────┐
 ┌──────────────────────────┐                  │   GOLD ZONE — Redshift / Athena     │
 │ SageMaker (recommendation │                  │   merchandising & demand tables      │
 │ + forecasting models)     │                  └──────────────────┬───────────────--┘
 └──────────────┬─────────────┘                                    │
                v                                                    v
   Personalization API (real-time                          QuickSight dashboards
   recommendations at checkout/browse)                      (merchandising, regional mgrs)

        GOVERNANCE LAYER (wraps every zone above):
        Lake Formation (mask payment tokens/PII columns for broad analyst
        access; LF-Tags for PCI-scoped tables) ── Amazon Macie (scan for
        stray card data in clickstream/POS raw zone) ── KMS CMK
        (encryption, S3 Bucket Keys for cost at high object volume) ──
        CloudTrail data events (audit access to payment-adjacent data)

        ORCHESTRATION + AUTO-SCALING LAYER:
        EventBridge (schedule nightly aggregation) ──▶ Step Functions
        (sequence Glue jobs, retry, branch) ── Kinesis on-demand mode +
        Firehose auto-scaling + Redshift Serverless / concurrency scaling
        absorb the 10–50x seasonal peak without manual intervention
```

**Arrow-by-arrow explanation:**

**(1) Web/mobile clickstream → Kinesis Data Streams → Amazon Data
Firehose.** Clickstream lands in Kinesis first (not straight to
Firehose) because personalization needs a **real-time consumer** (a
live "customers who viewed this also viewed" feature) in addition to
the archival path — Kinesis supports both a real-time Lambda/Flink
consumer and a Firehose consumer reading the same stream, whereas
Firehose alone would only support the archival path. Firehose then
buffers, converts to Parquet, and applies **dynamic partitioning** (by
event date and event type) as it lands data in the bronze zone,
avoiding a separate reformatting step later.

**(2) POS systems → AWS DMS (CDC) or a zero-ETL integration → bronze
zone.** Modern POS systems typically write to an Aurora or RDS backend
at the store or regional level; DMS captures changes continuously, or
— if the POS backend is Aurora and the destination is Redshift directly
— a **zero-ETL integration** skips the custom pipeline entirely,
landing near-real-time replicated data in Redshift with no ETL job to
build or maintain. Which one wins depends on whether the requirement is
"land in S3 for the lakehouse" (DMS) or "land in Redshift directly for
reporting" (zero-ETL) — both are legitimate answers to different
phrasings of the same underlying data.

**(3) Inventory/WMS → Glue ETL (nightly) or DMS CDC.** Legacy warehouse
management systems that only export nightly batch files use a
scheduled Glue JDBC extract; modern WMS platforms with a live database
backend use DMS CDC for real-time stock-level visibility, which
matters increasingly during peak seasonal selling when stockouts need
to be caught within minutes, not overnight.

**(4) Bronze zone → Glue ETL (Spark) → curated/silver zone.** A single
Glue Spark job (chosen over Lambda here because of the join complexity
across three heterogeneous sources at scale) deduplicates, masks
payment-token fields per PCI-DSS, and conforms clickstream, POS, and
inventory into a **unified schema** joinable by customer ID, SKU, and
store ID — this is the literal definition of the lakehouse pattern:
one queryable layer, not three siloed pipelines.

**(5) Curated zone → two parallel consumption paths.** Path A feeds
**SageMaker** model training for personalization (customer embeddings
from clickstream + purchase history) and demand forecasting (POS +
inventory history), with trained models served through a
**Personalization API** consumed at browse/checkout time. Path B feeds
a nightly Glue aggregation into **Redshift/Athena gold tables** — daily
sales by store/category, stock position — that **QuickSight** serves to
merchandising and regional management dashboards. Both paths read the
same curated Iceberg tables, avoiding duplicate transformation logic.

---

<a name="rationale"></a>
## 3. Service-by-service rationale

| Layer | Service chosen | Why it won | Runner-up | Why the runner-up lost |
|---|---|---|---|---|
| Clickstream real-time ingest | **Kinesis Data Streams** | Supports both a real-time personalization consumer and an archival consumer on the same stream | Amazon Data Firehose alone | Firehose has exactly one destination — can't simultaneously serve a live recommendation feature and land data in S3 without a Kinesis stream in front of it |
| Clickstream landing in S3 | **Amazon Data Firehose (as a Kinesis consumer)** | Automatic Parquet conversion + dynamic partitioning with no custom code | A custom Lambda writing to S3 | Reimplements format conversion and partitioning logic Firehose provides natively, for more code to maintain |
| POS replication | **AWS DMS (CDC) or zero-ETL integration** | Continuous, low-lag, no application changes to the POS backend | Nightly batch export | Fails same-day inventory/sales visibility during peak season, when stockouts need to be caught within minutes |
| Inventory (legacy WMS) | **Scheduled Glue JDBC extract** | Matches the source system's own nightly export cadence — no benefit to real-time polling a system that only updates nightly | DMS CDC against a system with no real-time change feed | Nothing to capture continuously if the source itself only updates in a nightly batch — CDC adds operational complexity with no latency benefit here |
| Lakehouse unification | **Apache Iceberg tables on S3** | Schema evolution as new clickstream event types are added over time; upsert support for late-arriving/corrected POS transactions | Plain Parquet with full-partition overwrite | No native schema evolution or upsert — every new event field or corrected transaction would require a full-table rewrite |
| Personalization/forecasting models | **Amazon SageMaker** | Native training against S3/Iceberg data, managed endpoints for real-time inference | Self-managed ML infrastructure on EC2 | Standing infrastructure to patch, scale, and monitor for a function SageMaker fully manages |
| Merchandising dashboards | **Amazon QuickSight (with SPICE)** | In-memory caching absorbs high-concurrency dashboard access from regional managers during peak reporting periods without hitting Redshift directly for every view | Direct BI tool query against Redshift per dashboard load | Every dashboard refresh becomes a live Redshift query, multiplying load during exactly the peak periods (post-Black-Friday reporting) when Redshift is also busiest |
| BI/reporting at scale | **Amazon Redshift** | Complex multi-table joins across sales/inventory for hundreds of concurrent merchandising analysts | Athena | Athena degrades under sustained heavy-join, high-concurrency BI load; Redshift is the right fit once usage moves past occasional ad hoc queries |
| Ad hoc analysis | **Amazon Athena** | Pay-per-query for occasional analyst investigation against the curated zone | Provisioned Redshift for every analyst | Wasteful to provision always-on compute for infrequent, unpredictable ad hoc access |
| Orchestration | **AWS Step Functions** | Explicit sequencing/retry/branching for nightly aggregation jobs, with visual audit trail | Amazon MWAA | No existing Airflow investment stated; Step Functions is lower-ops for this job shape |

---

<a name="security"></a>
## 4. Security and governance — PCI-DSS for payment data

| Requirement | AWS control |
|---|---|
| Payment card data (PAN, if ever transiently present) never stored unmasked outside the tokenization boundary | Mask/tokenize at the Glue ETL step (arrow 4) before data reaches the curated zone; POS systems ideally tokenize at swipe, but the pipeline defends in depth |
| Encryption at rest for payment-adjacent data | **SSE-KMS with a customer-managed CMK** on the bronze/silver zones holding POS transaction data |
| Reduce KMS API cost at high clickstream object volume | **S3 Bucket Keys** — clickstream alone can produce millions of small objects/day; Bucket Keys cut KMS call volume without weakening the CMK-based control |
| Column-level access — a marketing analyst sees clickstream and aggregate sales but never raw payment tokens | **Lake Formation column-level permissions**, with LF-Tags marking PCI-scoped columns/tables for consistent policy application as new tables are added |
| Continuous discovery of stray card data in clickstream logs (a common real-world mistake — a form field accidentally logs a card number) | **Amazon Macie** scheduled scans across the bronze zone |
| Network isolation for payment-adjacent processing | **VPC interface endpoints (PrivateLink)** for Glue jobs touching POS/payment data; **Gateway VPC endpoint** for S3 |
| Audit trail for who accessed payment-adjacent tables | **CloudTrail data events** on the S3 prefixes holding POS/transaction data |
| Least-privilege credential management for the POS database connection | **AWS Secrets Manager** with automatic rotation for DMS source-endpoint credentials |

⚠️ **Not all retail data is PCI-scoped.** Clickstream and inventory data
generally aren't cardholder data and don't need the full PCI-DSS
control set applied — over-applying PCI controls (e.g., tokenizing SKU
IDs) is itself a design smell the exam can test, since it adds
unnecessary cost/complexity without a compliance driver. Scope the
controls to the POS/payment path specifically.

---

<a name="scaling"></a>
## 5. Scaling considerations (seasonal peaks as the primary axis)

**Baseline assumed:** ~5M clickstream events/day, ~500K POS
transactions/day steady-state.

**At 10x (a strong promotional weekend, ~50M clickstream events/day,
~5M POS transactions/day, concentrated into a few hours):**
- Kinesis Data Streams **on-demand mode** absorbs the spike without
  manual shard resharding — this is the single most important scaling
  decision in retail architecture, since manually pre-provisioning
  shards for a promotional spike that may or may not hit forecast is
  both operationally risky and wasteful the other 360 days a year.
- Amazon Data Firehose auto-scales buffer throughput automatically —
  no configuration change needed, but **buffer interval tuning**
  matters: a shorter buffer window during peak trades slightly higher
  S3 PUT cost for fresher personalization-feature availability.
- Redshift moves to **concurrency scaling** or **Redshift Serverless**
  so merchandising dashboards stay responsive even as ETL load and BI
  query load both spike simultaneously post-event.

**At 100x (national flash-sale event or holiday peak across a large
chain, ~500M clickstream events/day, ~50M POS transactions/day):**
- A single Kinesis stream may need to be **split by traffic type**
  (page-view events vs. cart/checkout events) so a checkout-conversion-
  critical consumer isn't competing for shard throughput with high-
  volume, lower-priority browse events.
- The curated Iceberg tables need **partition strategy revisited** —
  date-only partitioning becomes too coarse; a compound partition of
  `date + region` or `date + event_type` restores effective partition
  pruning.
- SageMaker inference for real-time personalization needs **auto-
  scaling endpoints** provisioned ahead of the known peak window (unlike
  ingestion, inference auto-scaling has cold-start latency that
  benefits from pre-warming before a known event like Black Friday,
  rather than relying purely on reactive scaling).
- Multi-region active-active serving may enter the picture for the
  customer-facing personalization API specifically, since checkout-path
  latency during peak directly affects conversion — this is one of the
  few places in this repo's architectures where a regional failover
  pattern becomes a first-class concern rather than a DR afterthought.

---

<a name="failure"></a>
## 6. Failure scenarios and tolerance

| Failure | Architecture's response |
|---|---|
| Kinesis shard throttling during an unexpectedly larger-than-forecast spike | On-demand mode auto-scales; if still throttled, producers implement exponential backoff and retry — Kinesis's at-least-once delivery plus idempotent downstream writes prevent data loss even under transient throttling |
| Firehose delivery to S3 fails for a batch of records | Firehose retries automatically and, on sustained failure, writes failed records to an **error/backup S3 prefix** for reprocessing rather than dropping them |
| A Glue ETL job masking payment tokens fails mid-run during peak | Job bookmarks prevent reprocessing already-committed files on rerun; critically, downstream gold tables are only updated on full job success, so a failed run never exposes partially-masked payment data |
| SageMaker personalization endpoint is overwhelmed during a flash sale | Auto-scaling endpoint policy adds inference instances; a **circuit-breaker fallback** to a simpler, cached "trending items" recommendation set (rather than failing the checkout page entirely) keeps the customer experience degraded-but-functional rather than broken |
| Redshift concurrency scaling limits are hit during simultaneous ETL + peak dashboard load | Concurrency scaling clusters spin up automatically for read queries; the ETL write path is isolated on the main cluster so reporting contention doesn't block the ingestion pipeline |
| A single AZ fails during a peak sales event | Kinesis, Aurora/RDS behind DMS, and Redshift are all Multi-AZ; the personalization API's compute layer runs across multiple AZs behind a load balancer |

---

<a name="cost"></a>
## 7. Cost drivers and optimization levers

**Top cost drivers:**
1. **Clickstream volume dwarfs POS/inventory volume by orders of
   magnitude** — Kinesis/Firehose ingestion and S3 PUT/storage costs
   scale with page-view-level event counts, not transaction counts.
2. **Provisioning for peak year-round** — the single most common retail
   cost mistake is sizing Redshift or Kinesis for Black Friday capacity
   and leaving it there for the other 360 days.
3. **SageMaker endpoint over-provisioning** for personalization
   inference, sized for peak traffic but running at that size
   continuously.

**Optimization levers:**
- **On-demand/serverless everywhere seasonality is extreme** — Kinesis
  on-demand mode, Redshift Serverless or scheduled concurrency scaling,
  and SageMaker auto-scaling endpoints together mean the architecture
  pays for peak only during peak, not the rest of the year.
- **S3 storage class tiering on clickstream raw data** — raw clickstream
  older than the active model-training/feature window (commonly 30–90
  days) moves to Infrequent Access or Glacier via lifecycle policy,
  since it's rarely re-read once features are extracted.
- **Compact and right-size Iceberg files** — clickstream's high event
  volume, if written as many small files, produces exactly the small-
  file problem that inflates both storage overhead and Athena/Redshift
  Spectrum scan cost; scheduled compaction jobs during off-peak hours
  keep this in check.

---

<a name="company"></a>
## 8. Real-company parallel

This mirrors how large e-commerce and omnichannel retailers architect
their unified customer/inventory data platforms on AWS: a real-time
clickstream backbone feeding both live personalization and a lakehouse,
CDC or zero-ETL replication out of transactional POS/order databases
rather than batch-only exports, and elastic, serverless-first scaling
choices specifically because seasonal peak traffic (Black Friday/Cyber
Monday, Prime Day-style flash sales, or regional promotional events) is
a known, recurring, extreme spike rather than gradual organic growth —
the same reasoning that drives large retailers to lean on on-demand and
serverless AWS services rather than statically provisioned
infrastructure sized for an average day.

---

<a name="traps"></a>
## 9. Exam traps specific to retail scenarios

⚠️ **"Personalization" and "merchandising dashboards" have different
latency requirements — don't apply one architecture pattern to both.**
Personalization at browse/checkout is a real-time serving problem
(SageMaker endpoint, sub-second); merchandising dashboards are a batch/
BI problem (nightly aggregation into Redshift, QuickSight). A question
conflating the two into a single "just use Kinesis for everything"
answer is testing whether you separate them correctly.

⚠️ **Seasonal spike scenarios almost always signal on-demand/serverless
services as the correct answer, even if a provisioned option looks
cheaper at steady-state.** "Least operational overhead" and "must
absorb a 20x traffic spike without manual intervention" point the same
direction here — don't be tempted by a provisioned option's lower
steady-state sticker price.

⚠️ **Zero-ETL vs. DMS for POS data.** If the scenario says the POS
backend is Aurora/RDS/DynamoDB and the destination is directly
Redshift with "no pipeline to build or maintain," that's a **zero-ETL
integration** signal, not DMS — DMS is the answer when the destination
is the S3 lakehouse or a heterogeneous source/target combination.

⚠️ **Not every retail data source needs PCI-DSS controls applied.**
Clickstream and inventory data are not cardholder data; over-applying
payment-grade controls to non-payment data is a distractor pattern this
exam occasionally uses to test whether you scope compliance controls
correctly rather than applying them blanket-wide.

---

<a name="questions"></a>
## 10. Practice questions

**Q1.** A retailer needs both a live "customers who viewed this also
viewed" feature and an archival copy of every clickstream event in S3
as Parquet. What should sit in front of the archival path?

- A. Amazon Data Firehose only, with two separate delivery streams —
  **Wrong.** Firehose has no live-query/replay capability for the
  real-time recommendation consumer; it's a delivery-only service.
- B. **Kinesis Data Streams, with Firehose reading from it as one
  consumer and a Lambda/Flink live-recommendation consumer reading it
  as another** — **Correct.** Kinesis supports multiple independent
  consumers on the same stream, satisfying both the real-time and
  archival requirements from one source.
- C. SQS Standard queue — **Wrong.** SQS is a point-to-point queue,
  typically consumed once; it doesn't support multiple independent
  consumers reading the full event history at their own pace the way
  Kinesis does.
- D. Direct writes from the web application to S3 — **Wrong.** Loses
  the real-time consumption capability entirely and produces
  unmanaged, unbatched small-file writes.

**Q2.** A retailer's POS backend runs on Amazon Aurora, and the
requirement is "replicate near-real-time into Redshift for reporting,
with no ETL pipeline to build or maintain." What's the answer?

- A. AWS DMS with a Redshift target — **Wrong, though workable.** DMS
  requires configuring and maintaining a replication task/instance;
  the scenario specifically asks for no pipeline to maintain.
- B. **A zero-ETL integration from Aurora to Redshift** — **Correct.**
  Purpose-built for exactly this "no pipeline" Aurora/RDS/DynamoDB-to-
  Redshift requirement, replicating near-real-time with no ETL jobs or
  replication instances to manage.
- C. Nightly Glue JDBC extract — **Wrong.** Fails "near-real-time" and
  reintroduces a pipeline to maintain.
- D. Amazon AppFlow — **Wrong.** AppFlow connects to named SaaS
  applications, not a customer's own Aurora database.

**Q3.** During a flash sale, clickstream volume unexpectedly hits 15x
forecast. What Kinesis configuration absorbs this without a war-room?

- A. Provisioned mode sized at 2x forecast, set the week before —
  **Wrong.** Under-provisions relative to the actual 15x spike and
  requires accurate advance forecasting, which the scenario shows
  failed.
- B. **On-demand mode** — **Correct.** Automatically scales throughput
  capacity in response to actual traffic without manual shard
  management or advance forecasting.
- C. A single large provisioned shard count fixed year-round at peak
  sizing — **Wrong.** Technically absorbs the spike but pays peak cost
  365 days a year, which the "cost-effective" half of most such
  scenarios rules out.
- D. Amazon Data Firehose instead of Kinesis — **Wrong.** Doesn't
  address the underlying question of stream capacity, and loses the
  real-time consumer/replay capability the personalization feature
  needs.

**Q4.** A marketing analyst needs to query clickstream and aggregate
sales data but must never see raw payment tokens present in the POS
data joined into the same curated tables. What enforces this?

- A. A separate IAM policy restricting the S3 prefix — **Wrong.** IAM
  can't filter individual columns within a shared table.
- B. **Lake Formation column-level permissions, with LF-Tags marking
  PCI-scoped columns** — **Correct.** Grants column-level access so the
  analyst sees clickstream/sales fields but not payment token columns,
  scaling consistently as new tables are added.
- C. Two full duplicate copies of every curated table, one with tokens
  and one without — **Wrong.** Doubles storage and ETL cost, and is
  exactly the kind of duplication Lake Formation's column-level model
  avoids.
- D. Encrypt the payment token column with a separate KMS key and give
  the analyst the same IAM role — **Wrong.** If the analyst's role has
  decrypt permission on that key, encryption alone doesn't hide the
  column; this doesn't achieve column-level restriction.

**Q5.** Post-Black-Friday, hundreds of regional managers refresh
merchandising dashboards simultaneously while nightly ETL is also
running. What prevents dashboard load from competing with the ETL
write path on Redshift?

- A. Run ETL and dashboard queries on the same cluster with no
  isolation — **Wrong.** Exactly the contention scenario the question
  describes; this doesn't solve it.
- B. **QuickSight with SPICE caching, plus Redshift concurrency scaling
  for the read/dashboard workload separate from the ETL write path** —
  **Correct.** SPICE serves most dashboard refreshes from an in-memory
  cache rather than hitting Redshift live, and concurrency scaling
  isolates read spikes from the write-heavy ETL cluster.
- C. Move all dashboards to query DynamoDB instead — **Wrong.**
  DynamoDB isn't suited to the complex multi-table joins merchandising
  reporting requires.
- D. Disable ETL during business hours — **Wrong.** Delays data
  freshness for reporting and doesn't scale as the business grows;
  isolating the workloads is the correct fix, not scheduling around
  the conflict.

**Q6.** A legacy warehouse management system exports inventory data only
once nightly via a flat file and has no live change-log access. What
is the appropriate ingestion pattern?

- A. AWS DMS in CDC mode — **Wrong.** CDC requires reading a native
  change log; a system that only exports nightly batch files has
  nothing continuous for CDC to capture.
- B. **A scheduled AWS Glue job extracting the nightly file** —
  **Correct.** Matches the source's own update cadence; no benefit to
  building real-time infrastructure around a system that only changes
  once a day.
- C. Kinesis Data Streams with a custom producer — **Wrong.** Requires
  building producer code for a source that has no real-time event
  model to begin with; unnecessary complexity for nightly-only data.
- D. Amazon MSK — **Wrong.** No Kafka investment or streaming source
  exists here; this is purely a scheduled batch extraction problem.

**Q7.** As new clickstream event types are added over time and a late-
arriving corrected POS transaction needs to update a curated record
without rewriting the whole partition, what table format should the
curated zone use?

- A. Plain Parquet with full-partition overwrite on any change —
  **Wrong.** No native schema evolution or upsert; every new field or
  corrected record forces a full-partition rewrite.
- B. **Apache Iceberg** — **Correct.** Supports schema evolution as new
  event fields appear and MERGE/upsert for corrected records without
  rewriting entire partitions.
- C. CSV files, one per event type — **Wrong.** No transactional
  guarantees, poor query performance, and no upsert capability at all.
- D. DynamoDB as the curated analytical store — **Wrong.** Not designed
  for the large-scale analytical joins and BI/ML consumption this
  curated zone needs to support.

**Q8.** A retailer's checkout-path personalization API must stay
responsive during a national flash sale with a known start time. What
scaling approach should be used for the SageMaker inference endpoint?

- A. Rely purely on reactive auto-scaling with default settings —
  **Wrong.** Reactive scaling has cold-start latency; for a known peak
  start time, waiting for load to trigger scaling risks degraded
  checkout latency in the first minutes of the sale.
- B. **Pre-warm/pre-scale the endpoint ahead of the known event start
  time, in addition to auto-scaling for any unexpected additional
  load** — **Correct.** Combines proactive scaling for the known peak
  with reactive auto-scaling as a safety margin for forecast error.
- C. A single fixed-size endpoint sized for average daily traffic —
  **Wrong.** Under-provisions for the known spike and directly risks
  checkout-path failures during the highest-value traffic window.
- D. Disable personalization entirely during the flash sale to reduce
  load — **Wrong.** Removes a conversion-driving feature at the exact
  moment it matters most, when scaling (not disabling) is the correct
  response.

**Q9.** Which statement correctly scopes PCI-DSS controls in this
retail architecture?

- A. Every table in the curated zone, including clickstream and
  inventory, must be tokenized and access-restricted under PCI-DSS —
  **Wrong.** Clickstream and inventory data are not cardholder data;
  applying payment-grade controls blanket-wide adds unnecessary cost
  and complexity without a compliance driver.
- B. **Only the POS/payment-transaction path requires PCI-DSS controls
  — tokenization, column-level masking, and audit logging scoped to
  payment-adjacent tables** — **Correct.** Matches PCI-DSS's actual
  scope: cardholder data specifically, not the entire data estate.
- C. PCI-DSS doesn't apply to a data lake, only to the POS terminal
  itself — **Wrong.** Any system that stores, processes, or transmits
  cardholder data is in scope, including a data lake holding
  transaction records with payment tokens.
- D. Encrypting the entire S3 bucket with SSE-S3 satisfies PCI-DSS for
  payment data — **Wrong.** SSE-S3 gives no customer key-rotation or
  revocation control, which PCI-DSS assessors specifically look for via
  customer-managed KMS keys.

**Q10.** Raw clickstream data older than 90 days is rarely re-read once
personalization features have been extracted, but must still be
retained for historical model retraining. What's the most cost-
effective storage approach?

- A. Keep it in S3 Standard indefinitely — **Wrong.** Pays full Standard
  storage pricing for data that's rarely accessed after 90 days.
- B. **An S3 Lifecycle policy transitioning objects older than 90 days
  to Infrequent Access or Glacier** — **Correct.** Matches a known,
  predictable access pattern (hot for 90 days, then cold) with cheaper
  storage classes, without the monitoring overhead of Intelligent-
  Tiering, which is better suited to unpredictable access patterns.
- C. Delete clickstream data older than 90 days — **Wrong.** Loses data
  needed for historical model retraining, which the scenario says must
  be retained.
- D. S3 Intelligent-Tiering — **Wrong for this specific pattern.**
  Intelligent-Tiering is the right tool for *unknown/changing* access
  patterns; here the pattern (hot 90 days, then cold) is already known,
  so a direct Lifecycle policy is cheaper with no monitoring fee.
