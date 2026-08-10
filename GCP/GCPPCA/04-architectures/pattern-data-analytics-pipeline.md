# Pattern: Data & Analytics Pipeline (Generic)

> A generic batch+streaming analytics reference pattern for scenario
> questions that describe a data pipeline without matching one of the
> 4 named case studies exactly. Draws on the Lambda/Kappa/Medallion
> architecture concepts referenced in Domain 1 §1.3.

## When this pattern applies

A scenario describing: data arriving from one or more sources (events,
files, database changes, external feeds), a need for both near-real-
time and historical/batch analysis, and a downstream consumer (BI
dashboard, ML training, operational alerting) that needs processed,
trustworthy data.

## Reference architecture (Lambda-style: batch + speed layers)

```
      Sources: application events, IoT/device telemetry,
      external feeds, database change streams (CDC)
                    │
                    ▼
              Pub/Sub (ingest, decouples producers from
              consumers, durable buffer)
                    │
        ┌───────────┼───────────┐
        ▼                       ▼
  SPEED LAYER               BATCH LAYER
  Dataflow (streaming)      Dataflow (batch) or Dataproc
  - Windowed aggregation    (for existing Spark/Hadoop jobs)
  - Low-latency output      - Full historical reprocessing
  - Approximate/incremental - Authoritative, complete results
    results                   (corrects any speed-layer
                               approximation over time)
        │                       │
        ▼                       ▼
  Bigtable/Firestore        BigQuery (curated tables,
  (low-latency serving      partitioned + clustered for
  layer for dashboards/     cost-efficient querying)
  operational use)
        │                       │
        └───────────┬───────────┘
                     ▼
          Serving/consumption layer:
          - BI dashboards (Looker Studio / BI tool via BigQuery)
          - Vertex AI training (BigQuery as feature source, or
            Vertex AI Feature Store for served features)
          - Operational alerting (Cloud Monitoring custom metrics
            derived from pipeline output)

      Orchestration: Cloud Composer coordinates multi-step
      dependencies across the batch layer, external system loads
      (e.g. BigQuery Data Transfer Service for SaaS sources), and
      downstream triggers — not needed for the speed layer itself,
      which runs continuously.
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

## Choosing Lambda vs. Kappa vs. Medallion-only

| Scenario signal | Prefer |
|---|---|
| Need both a fast-approximate view and a guaranteed-correct historical view | Lambda (batch + speed layers) |
| Team wants one codebase, comfortable replaying streams for reprocessing | Kappa |
| Primary need is organizing BigQuery-resident data for BI/ML consumption, less about real-time serving | Medallion layering (can sit inside either Lambda's batch layer or a Kappa pipeline's output) |

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
