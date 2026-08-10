# Case Study: TerramEarth

> One of the 4 case studies the exam draws 2-of-4 from (RUNBOOK §2).
> Reconstructed from the case study's well-established public profile
> (heavy equipment manufacturer, ~2M connected IoT devices,
> intermittent connectivity, hybrid dealer network) — see the accuracy
> note in `case-study-ehr-healthcare.md`'s header, same caveat applies
> here (RUNBOOK §1).

## Company profile

TerramEarth manufactures heavy farm and construction equipment, with
roughly 2 million vehicles/machines in the field reporting telemetry.
Characteristics driving the architecture:

- **Massive IoT device fleet**: ~2 million devices, each periodically
  reporting sensor data (engine health, location, usage hours,
  diagnostics) — the scale signal that should immediately suggest
  Bigtable/Pub/Sub-tier services, not Cloud SQL-tier ones.
- **Intermittent connectivity**: equipment operates in remote
  locations (farms, construction sites) without reliable network
  access — data arrives in bursts when connectivity is available, not
  as a smooth continuous stream, which has direct implications for
  out-of-order/late-arriving data handling.
- **Predictive maintenance analytics**: the business value driver is
  turning telemetry into predictions (failure prediction, maintenance
  scheduling) — an ML/analytics pipeline is central, not incidental.
- **Hybrid dealer network**: a real, ongoing hybrid footprint (dealers,
  manufacturing sites) rather than a temporary migration-in-progress
  state — hybrid connectivity is a permanent architectural feature
  here, distinct from EHR Healthcare's migration-in-progress framing.
- **Long equipment lifespan**: heavy equipment stays in the field for
  decades — older machines may run older, more limited telemetry
  hardware than new ones, meaning the ingestion layer has to tolerate
  a heterogeneous device fleet, not a uniform one.

## Primary constraints (rank order)

1. **Massive-scale, intermittent-arrival telemetry ingestion** — the
   architecture must handle both huge device counts and bursty,
   out-of-order data arrival gracefully.
2. **Predictive analytics value delivery** — the pipeline exists to
   produce maintenance predictions, not just store data; storage-only
   answers under-deliver on the actual business need.
3. **Durable hybrid connectivity** — dealer networks and manufacturing
   sites need reliable, ongoing (not migration-phase) hybrid access.
4. **Cost at fleet scale** — with millions of devices, small
   per-device inefficiencies compound; storage-tiering and
   pipeline-efficiency questions are common.

## Reference architecture — steady-state ingest/analytics path

```
      ~2 million field devices (intermittent connectivity —
      report in bursts when a connection is available)
                    │
                    ▼
      Pub/Sub (global ingest endpoint, absorbs bursty arrival
      without requiring devices to be online continuously;
      ordering key = device ID for per-device sequential
      telemetry where order matters)
                    │
                    ▼
      Dataflow (streaming pipeline)
       - Watermarks + triggers configured for LATE-ARRIVING data
         (a device reconnecting hours later still gets processed
         into the correct time window, not dropped or misordered)
       - Windowed aggregation → per-device health summaries
                    │
        ┌───────────┼───────────┐
        ▼                       ▼
  Bigtable (raw telemetry,   BigQuery (aggregated/processed
  row-key salted by           telemetry for analytics + as
  device-ID-hash + time       a Vertex AI training data source)
  bucket — avoids
  hotspotting despite
  device-ID-sequential
  reporting patterns)
                                 │
                                 ▼
                    Vertex AI (predictive maintenance model
                    — training on historical BigQuery data,
                    serving predictions via an endpoint that
                    feeds back into dealer/maintenance
                    scheduling systems)

      Hybrid dealer/manufacturing network:
      ┌─────────────────┐
      │ Manufacturing     │────── Dedicated/Partner Interconnect
      │ sites (steady,     │      (durable, ongoing hybrid link —
      │ high-bandwidth      │     not a temporary migration bridge)
      │ needs)               │
      └─────────────────┘
      ┌─────────────────┐
      │ Dealer network     │────── Cloud VPN or Partner Interconnect
      │ (smaller sites,    │      depending on individual dealer's
      │ variable bandwidth) │      bandwidth/latency needs (Tree 3)
      └─────────────────┘
```

**Why Bigtable for raw telemetry with a hashed/salted key, not a
device-ID-only key:** device IDs reporting in sequence would otherwise
concentrate writes on adjacent key ranges even though each device
itself reports infrequently — at 2 million devices, the aggregate
write pattern across the whole fleet still needs deliberate key design
to avoid hotspotting on whichever range is "currently reporting" (see
the S.A.L.T. mnemonic in `00-START-HERE/EXAM-TRAPS-AND-MNEMONICS.md`).

**Why watermarks/triggers are a first-class design decision here, not
an afterthought:** intermittent connectivity means "late-arriving data"
isn't an edge case for TerramEarth, it's the normal case — a pipeline
using default/naive windowing (drop anything after the window closes)
would systematically lose data from exactly the devices with the worst
connectivity, which also tend to be the ones in the most remote,
highest-value-to-monitor locations (predictive maintenance value is
often highest for hard-to-reach equipment).

## Reference architecture — the other three paths

### CI/CD path

```
  Developer commits ──► Cloud Build (Dataflow pipeline
                          code, Vertex AI model training/
                          serving code, dealer-portal API)
                                │
                                ▼
                     Artifact Registry
                                │
                                ▼
                     Cloud Deploy — pipeline changes are
                     deployed with a DUAL-RUN validation
                     step specific to this case study: a
                     new Dataflow pipeline version runs
                     alongside the current production
                     version against a replayed slice of
                     real (late-arriving-heavy) telemetry
                     before fully cutting over, since a
                     silent watermark/windowing regression
                     here would misprocess data invisibly
                     rather than throw an obvious error
                                │
                                ▼
                     Cloud Composer DAG updates for the
                     batch/training orchestration layer,
                     version-controlled alongside the
                     pipeline code, not edited ad hoc
```

**Why dual-run validation matters specifically here:** a broken
watermark/trigger configuration doesn't crash — it silently produces
plausible-looking but wrong aggregates (dropped late data, misassigned
windows). For a company whose entire predictive-maintenance value
proposition depends on correct historical aggregates, catching that
class of regression before full cutover is a distinguishing detail
this case study rewards recognizing.

### Observability path

```
  Ingestion tier:
        │
        ▼
  Cloud Monitoring — fleet-health metrics distinct from
  typical app metrics: percentage of the ~2M device fleet
  reporting within the expected window, Pub/Sub
  unacknowledged-message age (a proxy for whether the
  pipeline is keeping up with bursty arrival), Dataflow
  watermark lag specifically (how far behind "now" the
  pipeline's processing watermark sits — the single most
  case-study-relevant custom metric to alert on)
        │
        ▼
  Cloud Logging → BigQuery sink (pipeline-run diagnostics,
  per-device ingestion anomalies) + Cloud Storage (Coldline/
  Archive-tiered raw-log retention at fleet scale, where
  storage-class discipline meaningfully affects cost, unlike
  a smaller-scale case study)

  Predictive-maintenance serving tier:
        │
        ▼
  Vertex AI Model Monitoring — tracks prediction-quality
  drift over time (equipment ages, usage patterns shift,
  new equipment models are introduced) — without this,
  predictions silently degrade as the fleet's real-world
  behavior diverges from the training data's era
```

**Why watermark lag is the headline metric, not generic pipeline
throughput:** throughput alone can look healthy while the pipeline
quietly falls behind on specific slow-to-report devices — watermark
lag is what actually reflects whether TerramEarth's core "handle
late-arriving data correctly" requirement is being met in production.

### DR / failover path

```
  Scenario: a regional GCP outage affecting the primary
  ingest/processing region

  Pub/Sub: global service, unaffected by a single region's
  compute outage in the way that matters most — messages
  already in Pub/Sub aren't lost; they wait for a healthy
  Dataflow worker pool

  Dataflow: pipeline jobs in the affected region fail over
  to a secondary region's worker pool (job definitions are
  redeployed via the same Cloud Deploy path used for normal
  releases) — because of the WATERMARK/LATE-DATA design
  already in place, a processing gap during failover doesn't
  silently lose device data the way it would for a naive
  pipeline; delayed devices simply get correctly windowed
  once processing resumes

  Bigtable / BigQuery: cross-region replication (if
  configured) or restore-from-backup depending on the
  stated RTO/RPO (Tree 5) — at TerramEarth's data volume,
  the cost difference between replication tiers is large
  enough that this case study specifically tests matching
  the DR tier to the ACTUAL business impact of a delay in
  predictive-maintenance predictions (usually tolerant of
  hours, rarely needs near-zero RTO) rather than defaulting
  to the most expensive tier "because IoT sounds critical"

  Hybrid network: Interconnect/VPN links to manufacturing
  and dealer sites are provisioned with redundant paths
  (dual Interconnect connections or Interconnect + VPN as
  fallback) — this is the one part of TerramEarth's DR
  story that isn't about GCP regional failover at all, but
  about not losing the hybrid link itself
```

## Alternatives considered and rejected

### 1. Cloud SQL (or another single-writer relational store) for raw telemetry instead of Bigtable

- **The tempting case for it:** telemetry readings have an obvious
  per-device schema, and a relational model feels like the "safe,
  familiar" choice for structured sensor data.
- **Why it's rejected here:** at ~2 million devices reporting
  telemetry, the aggregate write throughput is far beyond what a
  single-writer relational instance can sustain, and the dominant
  access pattern (time-series range scans per device, high-throughput
  writes) is exactly Bigtable's design center, not a relational
  database's. This is the case study RUNBOOK/EXAM-TRAPS material
  explicitly calls out: "2 million IoT devices" is a scale signal that
  should immediately steer away from Cloud SQL-tier thinking.
- **What's used instead:** Bigtable, with a salted/hashed row key.

### 2. Default (no late-data handling) windowing instead of explicit watermarks/triggers

- **The tempting case for it:** simpler pipeline configuration, and
  default windowing behavior is what most getting-started Dataflow
  tutorials show — it "just works" for the common case of
  continuously-connected sources.
- **Why it's rejected here:** TerramEarth's connectivity model makes
  late-arriving data the *normal* case, not an edge case — default
  windowing that drops data after the window closes would
  systematically and silently under-report exactly the devices with
  the worst (often most remote, highest predictive-maintenance value)
  connectivity. A predictive-maintenance business built on
  systematically incomplete data for its hardest-to-reach equipment
  undermines its own value proposition.
- **What's used instead:** explicit watermark and trigger
  configuration tuned for late data, validated via the dual-run CI/CD
  step described above.

### 3. GKE Enterprise fleet management for dealer/manufacturing-site compute instead of independently managed on-prem/edge deployments per site

- **The tempting case for it:** independently managing each site
  avoids taking on a new platform dependency, and a smaller company
  might reasonably ask whether centralized fleet management is worth
  the added complexity.
- **Why GKE Enterprise fits well here instead:** TerramEarth's hybrid
  footprint isn't a handful of sites — it's a durable, ongoing network
  of many manufacturing and dealer locations, each potentially running
  local edge compute (e.g. local diagnostics, buffering telemetry
  during a connectivity gap before forwarding to Pub/Sub). GKE
  Enterprise's fleet management gives centrally-defined
  configuration/policy sync and a consistent hybrid-connectivity
  operating model across many independently-located clusters —
  exactly the "manage one pattern repeated at many sites" shape GKE
  Enterprise is built for, and it's explicitly named in RUNBOOK §7 as
  a natural fit for this case study's hybrid footprint.
- **The tradeoff to name:** this adds a platform dependency and some
  learning curve versus letting each site's IT team manage its own
  compute independently — the case study's answer depends on whether
  the scenario emphasizes centralized consistency/governance (GKE
  Enterprise wins) or site-level autonomy/minimal central dependency
  (independent management, though this is the less commonly rewarded
  answer for a company this size and this hybrid-permanent).

## Cost and tradeoff discussion

TerramEarth's priority order — ingest at massive/bursty scale,
deliver predictive-analytics value, maintain durable hybrid
connectivity, then fleet-scale cost discipline — makes cost questions
here mostly about *pipeline and storage efficiency at scale*, not
about elastic scaling (contrast with Mountkirk/HRL) or compliance
tradeoffs (contrast with EHR Healthcare):

| Lever | Saves | Risk if misapplied here |
|---|---|---|
| Cloud Storage/BigQuery lifecycle tiering (Coldline/Archive for aged raw telemetry) | Very large at fleet scale — small per-record savings compound across billions of readings from 2M devices over years | Low risk if retrieval-time needs for older data (e.g. a warranty investigation into equipment from 5 years ago) are checked against Archive-tier retrieval latency first |
| Bigtable node-count rightsizing based on actual (not assumed) write throughput | Meaningful — Bigtable cost scales with provisioned nodes | **Risk if used to paper over a hotspotting problem** — adding nodes without fixing a bad row-key design (Domain 6 exam trap) wastes money without fixing the underlying issue; fix the key design first, then rightsize |
| BigQuery partitioning/clustering on the aggregated telemetry tables | Large query-cost reduction for the predictive-maintenance training pipeline, which repeatedly queries historical data | Low risk — a clear, close-to-free win any time BigQuery is queried repeatedly against historical data, exactly this pipeline's pattern |
| Reducing the DR tier for Bigtable/BigQuery replication to match actual RTO/RPO tolerance | Meaningful at this data volume — full active replication across regions for billions of records is expensive | Low risk if the actual predictive-maintenance business-impact tolerance (usually hours, not seconds) is confirmed per Tree 5, rather than assuming "IoT" implies near-zero RTO by default |
| Skipping GKE Enterprise fleet management to avoid the platform-dependency cost | Avoids a licensing/operational cost line item | **Depends on scenario emphasis** — if the scenario stresses centralized governance across many hybrid sites, skipping this reintroduces per-site operational drift and inconsistent policy enforcement, a real ongoing cost even if it doesn't show up as a line item |

## Question patterns this case study tends to produce

| Question shape | Domain | What it's really testing |
|---|---|---|
| "How should TerramEarth ingest telemetry from millions of intermittently-connected devices?" | 1 §1.3 | Pub/Sub as the durable, elastic ingest buffer — not a direct database write path that assumes steady connectivity |
| "A device reconnects after being offline for hours — how does its data get processed correctly?" | 6 §6.1 | Dataflow watermarks/triggers configured for late data, not default window-close-drops-late-data behavior |
| "Bigtable writes are hotspotting despite device count being huge" | 6 §6.2 | Row-key design (salting/hashing), not simply adding more Bigtable nodes |
| "How should TerramEarth's dealer network connect to GCP?" | 1 §1.3 / Tree 3 | match connectivity tier to each site's actual bandwidth/timeline need, not one-size-fits-all |
| "How should TerramEarth turn telemetry into maintenance predictions?" | 1 §1.3 / 4 §4.3 | Vertex AI training on BigQuery-aggregated data, feeding a serving endpoint into operational systems — a full pipeline answer, not "just store the data" |
| "How should TerramEarth validate a new version of their streaming pipeline before full rollout?" | 4 §4.1 / 6 §6.2 | dual-run/canary validation against replayed real (late-heavy) telemetry, since a windowing regression fails silently rather than crashing |
| "Predictive-maintenance model accuracy has quietly degraded over the past year — why, and what should catch it?" | 4 §4.3 / 6 §6.1 | Vertex AI Model Monitoring for prediction/data drift — equipment usage patterns and fleet composition change over time |
| "How should TerramEarth reduce storage costs at fleet scale without losing warranty-investigation data access?" | 4 §4.3 | Cloud Storage/BigQuery lifecycle tiering to Coldline/Archive, checked against actual retrieval-time requirements |
| "What RTO/RPO should TerramEarth target for their telemetry data store?" | 6 Tree 5 | matching the DR tier to the real business-impact tolerance of delayed predictions (usually hours), not assuming IoT automatically means near-zero RTO |
| "Older equipment in the field reports a more limited telemetry data format than new equipment — how should the pipeline handle this?" | 1 §1.3 / 4 §4.1 | schema evolution / tolerant parsing in the ingestion pipeline, not an assumption of a single uniform device schema across a fleet with decades-long equipment lifespan |
| "Should TerramEarth manage each dealer/manufacturing site's compute independently or centrally?" | 2 §2.1 / 1 §1.3 | GKE Enterprise fleet management for centrally-governed, consistently-configured hybrid sites — see Alternatives §3 |
| "How should the manufacturing sites' Interconnect link be protected against a single link failure?" | 1 §1.3 / Tree 3 | redundant hybrid connectivity (dual Interconnect, or Interconnect + VPN fallback), distinct from GCP-region-level DR |
| "How should TerramEarth structure IAM for dealers who need visibility into only their own equipment's telemetry?" | 3 §3.1 | scoped IAM/resource-hierarchy design (per-dealer project or fine-grained access), not blanket fleet-wide read access for every dealer |
| "What's the most cost-efficient way to run recurring model retraining as the fleet grows?" | 4 §4.3 | scheduled/orchestrated retraining (Cloud Composer-driven) against partitioned BigQuery data, not ad hoc manual retraining or retraining on the full unpartitioned historical dataset every time |

## Exam traps specific to this case study

1. **The "steady-stream assumption" trap.** Applying a pipeline design
   that assumes devices report continuously and on time (default
   watermark behavior, no explicit late-data handling) silently drops
   or misprocesses exactly the data from TerramEarth's most
   disconnected devices — the case study is specifically testing
   whether you design for intermittent, bursty, out-of-order arrival
   as the *normal* case, not an exception to handle later.
2. **The "IoT automatically means near-zero RTO" trap.** Because the
   scenario involves millions of connected devices and machine-learning
   predictions, candidates over-index on "critical infrastructure"
   framing and default to the most expensive DR tier (Active-Active or
   Active-Passive multi-region replication) without checking the
   actual stated business-impact tolerance — predictive-maintenance
   predictions being delayed by a few hours during a regional outage is
   usually acceptable, unlike EHR Healthcare's patient-care-critical
   framing. Match the DR tier to the number, not to how technically
   impressive "IoT at scale" sounds.
