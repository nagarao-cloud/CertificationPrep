# Media Streaming Architecture — Viewer Engagement, Content Metadata, and QoS at Massive Fan-Out

> Video/audio streaming platform analytics: viewer engagement events
> consumed simultaneously by recommendations, billing, and QoS
> monitoring; a content metadata catalog; real-time stream-health
> dashboards; and cost control at petabyte-scale log volume. Built from
> the same service vocabulary as the rest of this repo — see
> `00-START-HERE/SERVICE-SELECTION-MATRIX.md` Part 0 for how exam
> questions are assembled from scenario → requirement → constraint.

## CONTENTS

1. [Business context](#context)
2. [End-to-end architecture](#architecture)
3. [Service-by-service rationale](#rationale)
4. [Security and governance — content licensing and DRM-adjacent controls](#security)
5. [Scaling at 10x and 100x](#scaling)
6. [Failure scenarios](#failure)
7. [Cost drivers and optimization](#cost)
8. [Real-company parallel](#company)
9. [Exam traps specific to media/streaming scenarios](#traps)
10. [Practice questions](#questions)

---

<a name="context"></a>
## 1. Business context

A media streaming platform generates an almost pure event-stream
workload at a scale few other verticals match. Every play, pause,
seek, buffer stall, bitrate switch, and stop event from every device
streaming content — a heartbeat event every few seconds per active
viewer — produces a continuous firehose of small, semi-structured
records. At even moderate scale (a few million concurrent viewers), this
is billions of events per day; at the scale of a major streaming
platform, it's trillions of events across a year, and the log volume
this produces is measured in **petabytes**, not terabytes. Unlike
retail clickstream, which mostly feeds one consumption path
(personalization), a single viewer-engagement event in media needs to
be read by **several independent consumer systems simultaneously**:
a recommendation engine wants it for personalization, a billing/rights
system wants it to track entitlement and royalty/residual calculations
per stream, and a Quality-of-Service (QoS) monitoring system wants it
in near-real-time to detect regional playback degradation before it
becomes a customer-facing incident. This is a defining shape difference
from the other verticals in this repo: the architecture must support
**one event, many independent readers, each at their own pace**, which
is precisely what Kinesis's **enhanced fan-out (EFO)** exists to solve.

Content metadata is the platform's second data domain, and it behaves
completely differently from the engagement-event stream: comparatively
low volume, highly structured (title, genre, cast, licensing windows,
available regions, encoding profiles), updated by editorial/licensing
workflows rather than continuously by viewers, and it's the join key
that turns raw engagement events into anything meaningful — "viewer
watched title X for 40 minutes" only becomes a personalization feature
or a royalty calculation once it's joined against the metadata catalog
describing what title X actually is, who owns the rights, and in which
regions it's licensed to stream. Getting this catalog right — using
the **Glue Data Catalog** as the single shared schema/metadata registry
that every downstream consumer references — is what keeps engagement-
event processing, recommendations, and billing from drifting into
inconsistent, duplicated understandings of the content library.

Cost is a first-order design constraint here in a way it isn't for
lower-volume verticals, precisely because of the log volume. A
platform generating petabytes of engagement-event logs annually pays
real, material money for every inefficiency in compression, file size,
partitioning, and storage-class choice — a 20% improvement in
compression ratio or a fix to a small-file problem isn't a rounding
error at this scale, it's a meaningful line item on the AWS bill. This
is why compression codec choice, partition strategy, and S3 storage-
class tiering appear as first-class architectural decisions in this
file rather than an afterthought, and why the exam tests media-shaped
scenarios specifically to check whether a candidate treats petabyte-
scale cost engineering as a design requirement, not an optimization to
defer.

---

<a name="architecture"></a>
## 2. End-to-end architecture

```
     PLAYER / CDN EDGE EVENTS                      CONTENT LICENSING / EDITORIAL
 ┌─────────────────────────────┐                ┌───────────────────────────────┐
 │ Play/pause/seek/buffer/stop  │                │ Title metadata, cast, genre,   │
 │ heartbeats from every device │                │ licensing windows, regions     │
 └───────────────┬───────────────┘                └────────────────┬────────────--┘
                  │ (1)                                             │ (2)
                  v                                                 v
        Kinesis Data Streams                            AWS Glue Data Catalog
      (partition key = session_id)                      (crawler + manual registration)
                  │
      ┌───────────┼─────────────────────┬───────────────────────────┐
      │ (3)       │ (4)                 │ (5)                       │
      v           v                     v                           │
  Enhanced    Enhanced              Enhanced                        │
  Fan-Out     Fan-Out               Fan-Out                         │
  consumer:   consumer:             consumer:                       │
  Recommend-  Billing /             QoS Monitoring                  │
  ation       Rights engine         (Managed Flink —                │
  feature     (idempotent           buffer-stall rate,               │
  pipeline    entitlement           bitrate-switch                   │
  (Flink/     writes to             anomaly detection                │
  Glue)       DynamoDB)             per region/CDN edge)              │
      │           │                     │                            │
      v           v                     v                            │
 ┌────────────────────────────────────────────────┐                  │
 │        RAW / BRONZE ZONE — Amazon S3             │◀─────────────────┘
 │  Compressed (ZSTD), partitioned by date+region   │  (metadata joined in
 │  Intelligent-Tiering / lifecycle to Glacier       │   at the curated step)
 └──────────────────────┬───────────────────────--─┘
                         │ (6)
              Glue ETL / EMR — dedup, join engagement
              events to content metadata catalog
                         │
                         v
 ┌────────────────────────────────────────────────────────────────--─┐
 │       CURATED / SILVER ZONE — Apache Iceberg on S3 (Parquet)       │
 │   Unified viewer-session + content-metadata table, compacted        │
 └──────────────────────┬───────────────────────────────────────--─--┘
                         │ (7)
                         v
 ┌────────────────────────────────────────────────────────────────--─┐
 │  GOLD ZONE — Redshift (royalty/billing reporting) · Athena (ad hoc  │
 │  content performance analysis) · OpenSearch (real-time QoS          │
 │  dashboards, stream-health alerting) · QuickSight (exec dashboards) │
 └────────────────────────────────────────────────────────────────--─┘

        GOVERNANCE LAYER:
        Lake Formation (region-scoped access — a regional licensing
        team sees only titles licensed in their region) ── KMS (encrypt
        billing/rights data specifically; engagement events are lower-
        sensitivity) ── CloudTrail (audit access to royalty/billing
        calculations) ── VPC endpoints for internal service-to-service
        traffic

        ORCHESTRATION LAYER:
        EventBridge (schedule catalog crawler refresh, nightly
        aggregation) ──▶ Step Functions (sequence Glue jobs) ── Kinesis
        on-demand + EFO auto-scale to absorb concurrent-viewer surges
        (major live events, new-season drops)
```

**Arrow-by-arrow explanation:**

**(1) Player/CDN edge events → Kinesis Data Streams, partitioned by
session ID.** Every device streaming content emits play/pause/seek/
buffer/stop heartbeat events into a single Kinesis stream. Partitioning
by session ID (rather than title or user) keeps one viewing session's
events in order on the same shard, which QoS anomaly detection depends
on to reconstruct a coherent playback timeline per session.

**(2) Content licensing/editorial systems → Glue Data Catalog.**
Metadata about titles — cast, genre, licensing windows, available
regions — is registered into the Glue Data Catalog, either via a
crawler against an editorial system's export or direct registration
from a licensing workflow tool. This catalog is the schema registry
every downstream consumer (recommendations, billing, QoS) references
so "what is this title" means the same thing everywhere.

**(3), (4), (5) Kinesis → three independent Enhanced Fan-Out
consumers.** This is the architectural heart of the media vertical.
**Enhanced fan-out** gives each consumer its own dedicated 2 MB/sec-
per-shard throughput, rather than three consumers sharing one 2 MB/sec
pipe under standard consumption — without EFO, the QoS anomaly-
detection consumer competing for bandwidth with the billing consumer
during a traffic spike would starve one or both. The **recommendation
pipeline** extracts viewing-behavior features; the **billing/rights
engine** performs idempotent entitlement writes to DynamoDB (idempotent
specifically because Kinesis is at-least-once delivery, and double-
counting a viewing session would directly corrupt royalty
calculations); the **QoS monitoring** path runs through **Managed
Service for Apache Flink**, computing buffer-stall rate and bitrate-
switch anomaly scores per region/CDN edge in near-real time.

**(6) Raw zone → Glue ETL/EMR joins engagement events to the content
metadata catalog.** This is where the two data domains from Section 1
converge — a raw "session played for 40 minutes" event becomes a
meaningful record once joined against the catalog's title/rights/region
data, producing the curated table every downstream consumption tool
reads from.

**(7) Curated zone → gold consumption paths.** **Redshift** serves
royalty/billing reporting (financially authoritative, needs complex
joins and strong query performance for finance teams); **Athena** serves
ad hoc content-performance analysis by content strategy teams;
**Amazon OpenSearch Service** serves the real-time QoS dashboards and
stream-health alerting (chosen specifically for its strength at
log-style, full-text/near-real-time analytics over the Flink-computed
anomaly stream); **QuickSight** serves executive-level content
performance dashboards.

---

<a name="rationale"></a>
## 3. Service-by-service rationale

| Layer | Service chosen | Why it won | Runner-up | Why the runner-up lost |
|---|---|---|---|---|
| Engagement-event ingest | **Kinesis Data Streams with Enhanced Fan-Out** | Three independent consumers (recommendations, billing, QoS) each need dedicated, non-competing throughput off the same stream | Amazon Data Firehose | Single-destination only — cannot serve three independent, differently-paced consumers off one stream at all |
| Content metadata | **AWS Glue Data Catalog** | Serverless, shared schema registry every consumer (recommendations, billing, ETL, Athena) references consistently | A custom metadata microservice/database | Reinvents a schema registry AWS already provides natively integrated with Glue ETL, Athena, and Lake Formation |
| QoS anomaly detection | **Amazon Managed Service for Apache Flink** | Windowed, stateful computation (buffer-stall rate per region over a rolling window) with sub-second-to-second latency | AWS Lambda per-event | Lambda can't hold windowed state across events without external storage, reinventing what Flink does natively |
| Billing/rights entitlement writes | **DynamoDB, with idempotent conditional writes** | Sub-millisecond key-value writes at massive scale, with conditional-write support enforcing exactly-once entitlement accounting despite Kinesis's at-least-once delivery | Aurora relational writes | Works, but doesn't scale to the same per-second write throughput as DynamoDB at this event volume without significant sharding effort |
| Real-time QoS dashboards | **Amazon OpenSearch Service** | Purpose-built for log-style, near-real-time search and dashboarding (Kibana-style) over the Flink-computed anomaly stream | CloudWatch dashboards | CloudWatch is the right tool for infrastructure/service metrics, but OpenSearch's full-text search and flexible aggregation better fit exploring per-region, per-CDN-edge QoS log data |
| Raw zone compression | **ZSTD** | Best compression-ratio-to-speed trade-off at this log volume, and splittable for parallel Spark/Glue reads | GZIP | Higher CPU cost per MB compressed at this scale and — depending on implementation — less splittable than ZSTD for large files, hurting parallel read performance |
| Royalty/billing reporting | **Amazon Redshift** | Financially authoritative reporting needs complex joins and strong concurrent-query performance for finance/rights teams | Athena | Athena is the right complement for ad hoc analysis, but a standing, always-on royalty reporting workload with recurring complex joins is Redshift's use case |
| Content performance ad hoc analysis | **Amazon Athena** | Pay-per-query for occasional content-strategy team investigation | Provisioned Redshift for every analyst | Wasteful to provision always-on compute for infrequent querying |
| Cold storage of historical engagement logs | **S3 Lifecycle to Glacier / Glacier Deep Archive** | Petabyte-scale historical logs are rarely re-read after their active analysis window but must be retained for royalty audit purposes | S3 Standard indefinitely | Pays full Standard pricing on a data volume where the cost difference at petabyte scale is enormous |
| Orchestration | **AWS Step Functions** | Explicit sequencing/retry for catalog refresh and nightly aggregation jobs | Amazon MWAA | No existing Airflow investment stated; Step Functions is lower-ops for this job shape |

---

<a name="security"></a>
## 4. Security and governance — content licensing and DRM-adjacent controls

| Requirement | AWS control |
|---|---|
| A title only appears in recommendations/catalog queries for regions where it's actually licensed | **Lake Formation row-level filters** on the curated catalog table, scoped by region, enforced consistently across Athena/Redshift/QuickSight |
| Billing/rights entitlement data is more sensitive than raw engagement events and needs stronger controls | **Separate KMS CMK** for the DynamoDB billing table and Redshift royalty-reporting tables, distinct from the lower-sensitivity engagement-event bronze zone |
| Regional licensing teams see only their region's contractual/licensing data | **Lake Formation row-level security** combined with **QuickSight row-level security** for dashboard-layer enforcement |
| Audit trail for who accessed royalty/billing calculations (frequently subject to contractual audit by rights holders) | **CloudTrail data events** on the S3 prefixes and Redshift tables holding billing/royalty data |
| Internal service-to-service traffic (Flink to DynamoDB, Glue to Redshift) never traverses the public internet | **VPC interface endpoints (PrivateLink)** for DynamoDB, Redshift, Kinesis; **Gateway VPC endpoint** for S3 |
| Credential hygiene for any external rights-management system integration | **AWS Secrets Manager** with automatic rotation |
| Tag-based governance as the content catalog grows across many territories/labels | **Lake Formation LF-Tags (TBAC)** — tag tables by region/label once, inherited automatically by new tables |

⚠️ **This vertical's compliance driver is contractual (licensing/rights
agreements), not a named regulation like HIPAA or PCI-DSS** — the exam
tests this by describing "content must not be recommended in a region
where it isn't licensed" as a data-governance requirement, which maps
to Lake Formation row-level security exactly the same way a
regulatory row-filter requirement does in banking or healthcare. Don't
assume governance controls only apply under a named compliance
framework.

---

<a name="scaling"></a>
## 5. Scaling considerations

**Baseline assumed:** ~5M concurrent viewers at peak, ~50 TB/day of
engagement-event logs.

**At 10x (~50M concurrent viewers, ~500 TB/day, e.g., a major live
sporting event or a hit series' global-simultaneous release):**
- Kinesis Data Streams moves to **on-demand mode** to absorb the surge
  without pre-provisioning shards for an event whose exact peak is hard
  to forecast precisely.
- **Enhanced fan-out throughput per consumer** needs explicit capacity
  planning at this scale — three consumers each independently need
  2 MB/sec per shard, so shard count must be sized against the busiest
  consumer's needs, not just aggregate ingest volume.
- The QoS Flink application's **checkpoint interval and parallelism**
  need tuning — a 10x increase in session count means substantially
  more windowed state to checkpoint, and default settings sized for
  baseline volume can start to lag behind real-time.
- Glue/EMR aggregation jobs move to larger worker counts (or EMR over
  Glue, for the flexibility to tune Spark shuffle behavior) to keep the
  nightly curated-zone build within its batch window.

**At 100x (~500M concurrent viewers, ~5 PB/day — a global platform's
scale during its largest simultaneous events):**
- A single Kinesis stream is no longer sufficient; engagement events
  are **sharded by region or CDN edge**, each with its own EFO consumer
  set, both for throughput and to bound the blast radius of one
  region's traffic anomaly.
- The curated Iceberg tables require **partition strategy revisited**
  from date-only to `date + region + title_id` (or similar compound
  key) to keep partition pruning effective at this scale.
- OpenSearch Service scales to a **multi-node, dedicated-master
  cluster** with UltraWarm/cold-tier storage for the QoS log data, since
  keeping months of raw QoS logs on hot storage nodes becomes cost-
  prohibitive at petabyte daily volume.
- Redshift moves to a **data-sharing architecture** — a producer
  cluster for the ETL/write path, separate read-only consumer clusters
  for finance/royalty reporting versus content-strategy analytics, so
  the two workloads don't contend.
- Compression and file-size optimization stop being "an optimization"
  and become **the dominant cost lever** — at 5 PB/day, even a few
  percentage points of compression-ratio improvement is a material
  line item on the monthly bill.

---

<a name="failure"></a>
## 6. Failure scenarios and tolerance

| Failure | Architecture's response |
|---|---|
| The QoS Flink application falls behind during a viewership surge | Kinesis retention (with EFO) holds the backlog; Flink resumes from its last checkpoint — QoS alerting is delayed, not lost, though a sustained lag itself becomes an operational alert (`IteratorAge` rising on that consumer) |
| The billing/rights DynamoDB writer receives duplicate events (Kinesis at-least-once) | **Idempotent conditional writes** (a dedup key per session-event) ensure a duplicate delivery never double-counts entitlement or royalty accounting |
| One EFO consumer (e.g., recommendations) crashes | Because EFO gives each consumer dedicated throughput and independent checkpoint state, the billing and QoS consumers are **completely unaffected** — this isolation is the specific benefit EFO provides over standard shared-throughput consumption |
| Glue Data Catalog crawler fails to pick up a newly licensed title | Downstream joins (arrow 6) simply won't match that title's engagement events until the catalog is corrected — engagement events themselves are never lost, since the raw zone retains them for reprocessing once the catalog is fixed |
| An OpenSearch cluster node fails during peak QoS monitoring | Multi-AZ OpenSearch deployment with replica shards continues serving dashboards; no monitoring blackout during exactly the high-traffic period when QoS visibility matters most |
| A regional CDN edge experiences a real playback-quality incident | This is precisely the scenario the QoS Flink pipeline is designed to detect within seconds-to-minutes, routing an alert before it becomes a broad customer-facing outage — the architecture's value is measured by how fast this loop closes |

---

<a name="cost"></a>
## 7. Cost drivers and optimization levers

**Top cost drivers:**
1. **Sheer engagement-event volume** — Kinesis shard-hours (x3 for EFO
   throughput per consumer), S3 PUT/storage, and Glue/EMR compute all
   scale with an event count that's inherently massive at streaming-
   platform scale.
2. **Petabyte-scale storage retained for royalty-audit purposes**, even
   though most of it is never re-read after the active analysis window.
3. **OpenSearch cluster sizing** for real-time QoS dashboards, if kept
   entirely on hot-tier nodes rather than tiered storage.

**Optimization levers:**
- **Compression codec choice (ZSTD over GZIP or uncompressed) and
  Parquet/Iceberg file-size tuning** — at petabyte scale, this is the
  single highest-leverage cost lever in the entire architecture, larger
  in dollar impact than almost any compute optimization.
- **S3 storage-class tiering** — active engagement logs on S3 Standard
  for the current analysis window, lifecycle-transitioned to
  Infrequent Access and then Glacier/Glacier Deep Archive for
  royalty-audit-retention-only historical data.
- **OpenSearch UltraWarm/cold tiers** for QoS log data beyond the
  real-time dashboard window, keeping only the most recent hours/days
  on expensive hot-tier nodes.

---

<a name="company"></a>
## 8. Real-company parallel

This mirrors how major video streaming platforms architect viewer-
engagement analytics on AWS: a durable, replayable stream absorbing
massive per-second event volume, **enhanced fan-out** feeding multiple
independent downstream systems (personalization, billing/rights, and
operational QoS monitoring) without one consumer starving another, and
aggressive compression/partitioning discipline because the underlying
event volume is genuinely petabyte-scale. Netflix's publicly discussed
approach to viewing-event pipelines and stream-health monitoring
follows this same shape: one durable event backbone, many independent
readers, real-time anomaly detection feeding operational alerting
separate from the batch-oriented billing and analytics paths.

---

<a name="traps"></a>
## 9. Exam traps specific to media/streaming scenarios

⚠️ **"Multiple independent consumers reading the same stream at their
own pace, without competing for throughput" is the Enhanced Fan-Out
signal specifically — not just "Kinesis Data Streams."** A question
describing three systems (recommendations, billing, QoS) all reading
engagement events, with a constraint that one consumer's load shouldn't
degrade another's, is testing EFO specifically, not just standard
Kinesis consumption.

⚠️ **Don't default to Timestream for "time-series QoS metrics."** This
repo flags Timestream as recognize-only (see
`01-domains/DOMAIN-2-DATA-STORE-MANAGEMENT.md`); a "design a new
pipeline" QoS monitoring scenario in current material points to
OpenSearch Service (for log/dashboard-style near-real-time analytics)
or Managed Flink + a curated Iceberg table, not a new Timestream
deployment.

⚠️ **Petabyte-scale cost questions in this vertical usually test
compression/partitioning/storage-class discipline, not just "which
compute service is cheapest."** A question describing runaway S3
storage costs at a streaming platform is far more often testing
whether you'd fix compression codec, file size, and lifecycle policy
before reaching for a bigger architectural change.

⚠️ **Billing/rights entitlement writes must be idempotent because
Kinesis is at-least-once delivery.** A question describing "duplicate
royalty payments were calculated" is testing whether you recognize the
fix is idempotent writes (a dedup key, conditional PutItem), not
switching to a different streaming service — no AWS streaming service
in this exam's scope guarantees exactly-once delivery end-to-end
without application-level idempotency, except Flink's internal
processing guarantees, which don't extend to the downstream sink by
themselves.

---

<a name="questions"></a>
## 10. Practice questions

**Q1.** Recommendations, billing, and QoS monitoring all need to read
every viewer engagement event independently, and the QoS system's load
during a viewership surge must not degrade the billing system's
throughput. What Kinesis feature specifically addresses this?

- A. Increasing the shard count alone — **Wrong.** More shards increase
  aggregate throughput but don't by themselves give each consumer
  dedicated, non-competing throughput — standard consumers still share
  the 2 MB/sec-per-shard pipe.
- B. **Enhanced fan-out (EFO)** — **Correct.** Gives each registered
  consumer its own dedicated 2 MB/sec-per-shard throughput, so one
  consumer's load never competes with another's.
- C. Switching to Amazon Data Firehose — **Wrong.** Firehose has exactly
  one destination; it cannot serve three independent consumers at all.
- D. SNS fan-out to three SQS queues — **Wrong.** Works for simple
  fan-out but loses Kinesis's ordering-per-partition-key and replay
  capabilities that this pipeline (and QoS session reconstruction
  specifically) depends on.

**Q2.** The billing/rights engine occasionally receives the same
engagement event twice due to Kinesis's at-least-once delivery model.
What prevents this from double-counting royalty calculations?

- A. Switching Kinesis to exactly-once mode — **Wrong.** Kinesis Data
  Streams does not offer an exactly-once delivery mode; this isn't a
  configuration option that exists.
- B. **Idempotent writes using a dedup key (e.g., conditional PutItem
  in DynamoDB keyed on session+event ID)** — **Correct.** Makes a
  duplicate delivery a no-op rather than a double-counted write,
  achieving correctness without requiring exactly-once transport.
- C. Deduplicate manually once a day via a batch job before reporting —
  **Wrong.** Doesn't prevent the double-write from happening in the
  first place, and adds a fragile downstream correction step instead of
  solving the actual problem at the write layer.
- D. Reduce the number of shards to lower duplicate probability —
  **Wrong.** Shard count has no bearing on Kinesis's at-least-once
  delivery semantics; duplicates can occur regardless of shard count.

**Q3.** A content strategy analyst wants to know how many viewers in a
specific region watched a specific title, joined against licensing
metadata, on an occasional/ad hoc basis. What should they use?

- A. Amazon Redshift, with a dedicated always-on cluster provisioned
  for this analyst — **Wrong.** Provisioning always-on compute for
  occasional, unpredictable ad hoc querying wastes spend.
- B. **Amazon Athena against the curated Iceberg table** — **Correct.**
  Pay-per-query, no infrastructure to provision, ideal for occasional
  ad hoc analysis against data already unified in the curated zone.
- C. Query the raw Kinesis stream directly — **Wrong.** Kinesis isn't a
  queryable analytical store, and raw events haven't yet been joined
  against the content metadata catalog.
- D. DynamoDB Scan across the billing table — **Wrong.** The billing
  table holds entitlement records, not a general-purpose analytical
  join of engagement and metadata; DynamoDB Scan is also a poor fit for
  ad hoc analytical queries at this volume.

**Q4.** A title is licensed for streaming in the US and Canada only, but
must never appear in recommendations or catalog search results for
viewers in other regions. What enforces this?

- A. Filter titles client-side in the player application — **Wrong.**
  Relies on client-side logic that could be bypassed or misconfigured;
  not an enforced server-side data-governance control.
- B. **Lake Formation row-level filters on the curated content-metadata
  table, scoped by licensed region, enforced consistently across all
  query engines** — **Correct.** Provides a centrally enforced,
  server-side row filter that every consumer (Athena, Redshift,
  recommendations pipeline) respects consistently.
- C. Encrypt the metadata for non-licensed regions with a key those
  regions don't have — **Wrong.** Massively overcomplicates a filtering
  requirement into a key-management problem, and doesn't scale as
  licensing windows change frequently.
- D. Maintain a separate, fully duplicated catalog per region — **Wrong.**
  Multiplies storage and creates a data-consistency risk as licensing
  windows change; row-level filtering on one shared catalog is the
  standard pattern for exactly this requirement.

**Q5.** The platform's engagement-event logs are growing toward 5
petabytes/day, and storage cost has become the dominant line item on
the AWS bill. What should be evaluated first?

- A. Immediately move all compute from Glue to EMR — **Wrong.** Compute
  engine choice isn't the primary driver of a storage-cost problem;
  this doesn't address the actual bottleneck described.
- B. **Compression codec (ZSTD vs. current), file-size/partitioning
  strategy, and S3 lifecycle policy to colder storage classes for aged
  data** — **Correct.** At petabyte scale, compression ratio and
  storage-class tiering are the highest-leverage cost levers, larger in
  dollar impact than most compute changes.
- C. Switch the curated zone from Iceberg back to plain Parquet —
  **Wrong.** Removes upsert/schema-evolution capability without
  addressing the actual cost driver (compression/tiering), and Iceberg
  itself doesn't materially increase storage cost over plain Parquet.
- D. Reduce Kinesis retention to the minimum 24 hours — **Wrong.**
  Kinesis retention affects in-stream storage cost, not the S3-resident
  petabyte-scale historical log volume that's actually driving the
  bill.
- (Explanatory note: option D is a real, valid lever for a different
  problem — Kinesis storage cost — but doesn't address the S3 storage
  cost the question specifically describes.)

**Q6.** A major live sporting event is expected to bring 10x the normal
concurrent-viewer count for a few hours. What Kinesis configuration
should be in place beforehand?

- A. Manually calculate and pre-provision exactly 10x the normal shard
  count the week before — **Wrong, though workable if forecasting is
  precise.** Risky if the actual multiplier differs from forecast, and
  requires manual resharding effort before and after the event.
- B. **On-demand mode**, which automatically scales throughput capacity
  in response to actual traffic — **Correct.** Removes the need for
  precise advance forecasting and manual shard management around a
  known but hard-to-predict-exactly traffic event.
- C. No changes — Kinesis scales automatically in provisioned mode by
  default — **Wrong.** Provisioned mode does not auto-scale shard count;
  it requires manual resharding or an external scaling utility.
- D. Switch to Amazon Data Firehose for the duration of the event —
  **Wrong.** Loses the multi-consumer EFO architecture the pipeline
  depends on for recommendations, billing, and QoS simultaneously.

**Q7.** The QoS monitoring pipeline needs to detect a regional playback-
quality degradation (rising buffer-stall rate) within seconds of it
starting, computed over a rolling 2-minute window per CDN edge. What
computes this?

- A. Amazon Data Firehose with a Lambda transform — **Wrong.** No
  stateful, multi-record windowed computation capability.
- B. **Amazon Managed Service for Apache Flink** — **Correct.** Native
  windowed, stateful stream processing computes the rolling buffer-
  stall rate continuously with sub-second-to-second latency.
- C. A CloudWatch Logs Insights query run every 2 minutes — **Wrong.**
  Query-on-schedule against logs introduces latency inconsistent with
  "detect within seconds," and isn't a continuous streaming computation.
- D. AWS Glue batch job scheduled every 2 minutes — **Wrong.** Glue job
  startup overhead alone is typically longer than the detection window
  required, and it's not a genuinely continuous computation.

**Q8.** Finance needs complex, always-on royalty reporting joining
engagement, billing, and content-metadata tables for hundreds of
concurrent internal users. What should serve this workload?

- A. Amazon Athena — **Wrong for this specific pattern.** Athena is
  the right complement for ad hoc queries, but degrades under sustained,
  high-concurrency, heavy-join BI workloads.
- B. **Amazon Redshift** — **Correct.** Purpose-built for complex,
  concurrent, multi-table joins at BI scale for a standing reporting
  workload.
- C. DynamoDB with Global Secondary Indexes — **Wrong.** Not suited to
  ad hoc complex multi-table analytical joins across engagement,
  billing, and metadata simultaneously.
- D. Query the raw S3 bronze zone directly with Spark on demand for
  each report — **Wrong.** Recomputing from raw, unjoined data for
  every report is far slower and more expensive than querying a
  pre-aggregated curated/gold table designed for this purpose.

**Q9.** A question describes QoS metrics as "time-series sensor-like
data" and asks what the textbook AWS answer is for purpose-built time-
series storage with automatic tiering, purely as a recognition-level
question. What's the intended answer per this repo's currency
guidance?

- A. **Amazon Timestream** — **Correct for recognition purposes only.**
  This repo flags Timestream as recognize-only given AWS's wind-down
  for new customers, but as a pure "what is this service for"
  recognition question, Timestream remains the textbook match.
- B. Apache Iceberg on S3 — **Wrong for this specific recognition
  question**, though it is the actual recommendation this architecture
  uses for a new QoS pipeline design — the question as posed is testing
  recall of Timestream's description, not a new-build recommendation.
- C. DynamoDB — **Wrong.** Not purpose-built for time-series data or
  automatic tiering.
- D. Redshift — **Wrong.** Not a time-series-specialized store.

**Q10.** A rights holder's audit clause requires the platform to prove
who accessed royalty/billing calculation data and when, going back
several years. What satisfies this?

- A. S3 server access logs alone — **Wrong.** Provides some access
  information but is not the primary, recommended mechanism for
  object-level data-access audit trails at this granularity.
- B. **CloudTrail data events enabled on the S3 prefixes and Redshift
  tables holding billing/royalty data, with logs retained per the audit
  requirement's retention period** — **Correct.** Data events capture
  every `GetObject`/query-level access with principal and timestamp,
  which is exactly what "who accessed this and when" requires.
- C. CloudTrail management events only — **Wrong.** Management events
  capture control-plane actions (e.g., who changed a Glue job
  configuration), not who read the actual billing data — that requires
  data events specifically.
- D. AWS Config compliance history — **Wrong.** Config tracks resource
  configuration changes over time, not who accessed data within those
  resources.
