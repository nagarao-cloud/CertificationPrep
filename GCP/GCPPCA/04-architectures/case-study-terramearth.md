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

## Reference architecture

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

## Question patterns this case study tends to produce

| Question shape | What it's really testing |
|---|---|
| "How should TerramEarth ingest telemetry from millions of intermittently-connected devices?" | Pub/Sub as the durable, elastic ingest buffer — not a direct database write path that assumes steady connectivity |
| "A device reconnects after being offline for hours — how does its data get processed correctly?" | Dataflow watermarks/triggers configured for late data, not default window-close-drops-late-data behavior |
| "Bigtable writes are hotspotting despite device count being huge" | Row-key design (salting/hashing), not simply adding more Bigtable nodes (Domain 6 exam trap #3) |
| "How should TerramEarth's dealer network connect to GCP?" | Tree 3 (`00-START-HERE/DECISION-TREES.md`) — match connectivity tier to each site's actual bandwidth/timeline need, not one-size-fits-all |
| "How should TerramEarth turn telemetry into maintenance predictions?" | Vertex AI training on BigQuery-aggregated data, feeding a serving endpoint into operational systems — a full pipeline answer, not "just store the data" |

## Exam trap specific to this case study

The "steady-stream assumption" trap: applying a pipeline design that
assumes devices report continuously and on time (default watermark
behavior, no explicit late-data handling) silently drops or
misprocesses exactly the data from TerramEarth's most disconnected
devices — the case study is specifically testing whether you design
for intermittent, bursty, out-of-order arrival as the *normal* case,
not an exception to handle later.
