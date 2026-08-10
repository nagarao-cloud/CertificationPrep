# Pattern: Data & Analytics Pipeline (Generic)

> A generic batch+streaming analytics reference pattern for scenario
> questions that describe a data pipeline without matching one of the
> 4 named case studies exactly. Draws on the Lambda/Kappa/Medallion
> architecture concepts referenced in Domain 1 §1.3.

## When this pattern applies — and when a variant is the better fit

A scenario describing: data arriving from one or more sources (events,
files, database changes, external feeds), a need for both near-real-
time and historical/batch analysis, and a downstream consumer (BI
dashboard, ML training, operational alerting) that needs processed,
trustworthy data.

The exam frequently pairs this pattern with a near-miss alternative in
the answer choices — matching the scenario's actual latency/freshness
requirement to the right variant is the real skill being tested:

| Scenario signal | Right variant | Why the alternative is a distractor |
|---|---|---|
| "Reports run once a day/week against complete historical data, latency doesn't matter" | **Pure batch** (Dataflow batch or Dataproc, no speed layer at all) | A full Lambda architecture's speed layer is unneeded complexity/cost when nothing downstream consumes real-time results — over-engineering trap |
| "Dashboards need to reflect events within seconds, and a corrected historical view matters too" | **Lambda** (batch + speed layers, this file's primary diagram) | Pure batch can't meet the seconds-level freshness requirement; pure streaming (Kappa) can meet freshness but may not be the best fit if a fully separate, simpler-to-reason-about batch correction pass is explicitly wanted |
| "Team wants one codebase/one processing model, comfortable replaying data for reprocessing" | **Kappa** (streaming-first, replay for backfill) | Lambda's dual codebase (batch + speed, often different frameworks or at least different code paths) is exactly the operational complexity Kappa scenarios are explicitly trying to avoid |
| "Existing on-prem Spark/Hadoop jobs need to move to GCP with minimal rewrite" | **Dataproc**-based batch layer (lift-and-shift of existing Spark jobs) | Rewriting straight to Dataflow is higher migration risk/effort than the scenario's stated constraint justifies — a Tree 4 (Rehost/Replatform) judgment call layered onto this pattern |
| "Source is a transactional database and downstream needs near-real-time replicated changes, not new application events" | **CDC-based streaming** (Datastream or a CDC connector into Pub/Sub, feeding the speed layer) | Treating this as a generic "events" source and building a polling-based batch extraction misses that CDC gives lower latency and lower source-database load than periodic batch extraction |

## Reference architecture (Lambda-style: batch + speed layers)

```
      Sources: application events, IoT/device telemetry,
      external feeds, database change streams (CDC)              ◄── (1)
                    │
                    ▼
              Pub/Sub (ingest, decouples producers from            ◄── (2)
              consumers, durable buffer)
                    │
        ┌───────────┼───────────┐
        ▼                       ▼
  SPEED LAYER               BATCH LAYER
  Dataflow (streaming)      Dataflow (batch) or Dataproc            ◄── (3)
  - Windowed aggregation    (for existing Spark/Hadoop jobs)
  - Low-latency output      - Full historical reprocessing
  - Approximate/incremental - Authoritative, complete results
    results                   (corrects any speed-layer
                               approximation over time)
        │                       │
        ▼                       ▼
  Bigtable/Firestore        BigQuery (curated tables,               ◄── (4)
  (low-latency serving      partitioned + clustered for
  layer for dashboards/     cost-efficient querying)
  operational use)
        │                       │
        └───────────┬───────────┘
                     ▼
          Serving/consumption layer:                                ◄── (5)
          - BI dashboards (Looker Studio / BI tool via BigQuery)
          - Vertex AI training (BigQuery as feature source, or
            Vertex AI Feature Store for served features)
          - Operational alerting (Cloud Monitoring custom metrics
            derived from pipeline output)

      Orchestration: Cloud Composer coordinates multi-step             ◄── (6)
      dependencies across the batch layer, external system loads
      (e.g. BigQuery Data Transfer Service for SaaS sources), and
      downstream triggers — not needed for the speed layer itself,
      which runs continuously.
```

**Every arrow explained:**

1. **Sources** — the pattern deliberately shows multiple source types
   because real pipelines rarely have exactly one; a CDC source in
   particular needs a connector (e.g. Datastream) upstream of Pub/Sub,
   not the same client-side event-emission code as an application
   event source.
2. **Pub/Sub as the ingest buffer** — every source writes here first,
   *not* directly into Dataflow/Dataproc. This decouples producer
   availability from consumer processing — if the batch or speed layer
   is down or being redeployed, messages wait durably rather than
   being lost or blocking the source system.
3. **Speed layer vs. batch layer fork** — the same Pub/Sub topic (or a
   fan-out to two subscriptions) feeds both; the speed layer trades
   completeness for latency (approximate/incremental results available
   in seconds), the batch layer trades latency for completeness (a
   full, corrected pass over all data, run on a schedule).
4. **Divergent serving stores** — the speed layer writes to a
   low-latency serving store (Bigtable/Firestore) because dashboards
   or operational systems querying it need fast point/range reads; the
   batch layer writes to BigQuery because its consumers need flexible
   ad hoc SQL over large historical volumes, a different access
   pattern entirely.
5. **Serving/consumption layer** — the actual point of the whole
   pipeline; a design that stops at "data lands in BigQuery" without
   naming what consumes it is an incomplete answer to a scenario that
   states a specific downstream need (dashboard, ML training,
   alerting).
6. **Cloud Composer orchestration** — coordinates the batch layer's
   scheduled dependencies (e.g. "don't start the daily aggregation job
   until the SaaS data-transfer job has landed") — the speed layer
   doesn't need this because it runs continuously rather than as
   discrete scheduled steps.

## Failure and operational paths

```
  Pub/Sub consumer/processing outage (speed or batch layer down):
   - Pub/Sub retains unacknowledged messages up to the configured
     retention window (default 7 days, extendable) — no data loss
     as long as the outage is shorter than that window
   - On recovery, the speed layer resumes processing from where it
     left off; the batch layer's next scheduled run picks up
     everything that arrived, since batch reprocesses complete
     historical ranges rather than relying on continuous state

  Speed-layer approximate result later corrected by batch layer:
   - This is BY DESIGN in the Lambda pattern, not a bug — the speed
     layer's output is explicitly labeled/treated as provisional;
     dashboards or alerts consuming it should be built to tolerate
     later correction, or should read from the batch-corrected
     BigQuery tables once available if provisional results aren't
     acceptable for that specific use case

  Dataflow job failure mid-pipeline (either layer):
   - Dataflow's built-in checkpointing/retry handles transient
     worker failures without operator intervention; a fully failed
     job requires redeployment (via the same CI/CD path used for
     normal pipeline updates) and — critically for the streaming
     job — restarting from a saved job state/snapshot rather than
     from scratch, or the speed layer silently loses its
     accumulated windowing state

  Orchestration (Cloud Composer) failure:
   - A stalled DAG blocks downstream batch steps but does NOT stop
     the speed layer, which is independent — this is one reason the
     Lambda split is valuable operationally, not just architecturally:
     a batch-orchestration outage degrades freshness of the
     authoritative view without taking down the whole pipeline's
     real-time capability
```

## Medallion (Bronze/Silver/Gold) layering within BigQuery

An alternative/complementary way to organize the batch layer's output,
worth recognizing by name:

```
 Bronze (raw, as-ingested, minimal transformation)
        │
        ▼
 Silver (cleaned, deduplicated, conformed schema)
        │
        ▼
 Gold (business-level aggregates, ready for BI/ML consumption)
```

- **Bronze** tables are the untransformed landing zone — useful for
  reprocessing if a downstream transformation bug is discovered later.
- **Silver** tables apply data-quality rules and standard
  schema/naming — the layer most internal data-engineering consumers
  query directly.
- **Gold** tables are purpose-built for specific business
  questions/dashboards — denormalized, aggregated, optimized for the
  known consumption pattern rather than general-purpose querying.

## Kappa architecture (streaming-first, no separate batch layer)

For scenarios explicitly emphasizing simplicity over the Lambda
pattern's dual-code-path complexity: treat everything as a stream
(including historical reprocessing, done by replaying the stream from
an earlier offset) rather than maintaining separate batch and speed
codebases. The tradeoff: simpler operational model, but requires the
streaming engine (Dataflow) to handle full reprocessing workloads
adequately, which isn't always the better fit for very large historical
backfills.

```
      Sources ──► Pub/Sub (retained/replayable, or Pub/Sub Lite
                   with longer retention, or a durable log store
                   the stream can be replayed from)
                          │
                          ▼
                  Dataflow (streaming) — the ONLY processing
                  path; a backfill or correction is done by
                  replaying the source log from an earlier
                  offset through the SAME pipeline code, not a
                  separately-maintained batch pipeline
                          │
                          ▼
                  Bigtable/Firestore (serving) and/or BigQuery
                  (if streaming inserts are used for the
                  analytical store too)
```

**Kappa's operational tradeoff, made explicit:** a full historical
reprocessing run (e.g. replaying a year of data after a bug fix) puts
significant sustained load on the streaming engine and the source log's
retention — for very large backfills this can be slower or more
expensive than a purpose-built batch engine (Dataproc/Dataflow batch)
doing the same job, which is exactly why Lambda's separate batch layer
still wins for scenarios with large historical-correction needs despite
Kappa's simpler codebase story.

## Choosing Lambda vs. Kappa vs. Medallion-only vs. pure batch

| Scenario signal | Prefer |
|---|---|
| Need both a fast-approximate view and a guaranteed-correct historical view | Lambda (batch + speed layers) |
| Team wants one codebase, comfortable replaying streams for reprocessing, backfills are modest in size | Kappa |
| Primary need is organizing BigQuery-resident data for BI/ML consumption, less about real-time serving | Medallion layering (can sit inside either Lambda's batch layer or a Kappa pipeline's output) |
| No real-time consumer exists at all — reports/dashboards refresh daily/weekly | Pure batch (Dataflow batch or Dataproc), skip the speed layer entirely — the most common over-engineering trap on this pattern is building a speed layer nobody downstream reads from |
| Very large periodic historical reprocessing/backfill needs alongside real-time serving | Lambda over Kappa — Kappa's replay-based backfill doesn't scale as cleanly as a dedicated batch engine for large historical corrections |

## Batch vs. streaming — worked variation guidance

Beyond the Lambda/Kappa/batch-only choice above, two dimensions
repeatedly decide the correct variant on exam questions:

- **Freshness requirement stated in the scenario.** "Within seconds"
  or "real-time" language requires a streaming (speed-layer or Kappa)
  component; "daily," "nightly," or no freshness language at all is a
  batch-only signal. Don't infer a streaming requirement from the mere
  presence of continuously-arriving source data — TerramEarth's
  telemetry arrives continuously but its business need (predictive
  maintenance) tolerates a batch-trained model refreshed periodically,
  with only the *ingest* being stream-shaped, not necessarily every
  downstream consumer.
- **Correction/completeness requirement.** If the scenario cares about
  a guaranteed-correct historical number (financial reporting,
  compliance reporting), a batch (or Lambda's batch layer) pass that
  reprocesses complete data is required even if a streaming view also
  exists for operational dashboards — a pure-streaming/Kappa-only
  answer that never produces a fully-reprocessed, corrected view is a
  wrong answer for that class of requirement.

## Cost and operational-burden tradeoffs

| Component | Cost driver | Operational-burden driver |
|---|---|---|
| Pub/Sub ingest | Scales with message volume/throughput; generally modest relative to compute layers | Low — mostly topic/subscription configuration |
| Speed layer (Dataflow streaming) | Continuously running workers — the most persistent cost line in a Lambda design, since it never scales to zero the way a scheduled batch job's cost does | Moderate — requires monitoring watermark lag, autoscaling worker-pool configuration, and job-update/state-migration discipline on redeploy |
| Batch layer (Dataflow batch / Dataproc) | Runs only during scheduled windows — cheaper per-unit-of-data-processed than the always-on speed layer, but adds latency | Low-to-moderate — mostly scheduling/orchestration correctness (Cloud Composer DAG health) rather than continuous operation |
| BigQuery storage/query | Storage is cheap; query cost is the dominant, easily-runaway line item without partitioning/clustering discipline | Low if tables are well-designed; the burden is almost entirely at design time (schema, partition key choice), not day-to-day |
| Bigtable/Firestore serving layer | Scales with provisioned throughput/nodes (Bigtable) or usage (Firestore) | Moderate for Bigtable — row-key design and hotspot monitoring are ongoing concerns; low for Firestore |
| Cloud Composer orchestration | Fixed environment cost regardless of DAG complexity | Moderate — DAG authoring/maintenance and monitoring for stalled/failed runs is a recurring operational task |
| Kappa (vs. Lambda) overall | Removes the batch layer's separate cost line, but large backfills can spike streaming-engine cost unpredictably | Lower steady-state burden (one codebase) but higher burden/risk during a large replay/backfill event |

## Securing AI / DLP integration point

Whenever this pipeline feeds a Vertex AI training job and the source
data may contain PII, insert a Cloud DLP scan/de-identification step
between the Silver and Gold layers (or before training-data export) —
see Domain 3 §3.1's Securing AI material. This is a common
cross-domain question: "where in the pipeline should PII be
handled" — the answer is *before* it reaches the ML training path, not
as an afterthought on the trained model's output.

## Common mistakes when applying this generic pattern to a scenario

1. Building a full Lambda architecture (two code paths) when the
   scenario doesn't actually need both an approximate real-time view
   and a corrected historical view — unnecessary complexity if only one
   is required (over-engineering trap).
2. Skipping Pub/Sub and writing directly from sources into Dataflow —
   loses the durable-buffer decoupling that protects against a
   downstream processing outage causing data loss at the source.
3. Forgetting partitioning/clustering on the resulting BigQuery tables
   — a functionally correct but cost/performance-naive pipeline is
   still a wrong answer when the scenario emphasizes query cost or
   dashboard latency.
4. Treating the speed layer's provisional/approximate output as
   equivalent to the batch layer's corrected output when a scenario
   specifically needs guaranteed-correct numbers (e.g. financial or
   compliance reporting) — the two layers are not interchangeable
   just because they're both "real-time-ish."
5. Choosing Kappa for a scenario with large, infrequent-but-heavy
   historical backfill needs — Kappa's replay-based reprocessing
   doesn't scale as gracefully as a dedicated batch engine for that
   specific workload shape, even though Kappa's steady-state story is
   simpler.
6. Missing a CDC source's need for a dedicated change-capture connector
   (e.g. Datastream) and instead designing a polling-based batch
   extraction against a live transactional database — adds load to the
   source system and misses the freshness a CDC-based streaming path
   would deliver.
