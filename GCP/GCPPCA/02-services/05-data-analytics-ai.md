# Data, Analytics & AI Services Reference

> Cost/performance optimization for these services: Domain 4 §4.3.
> Securing AI patterns: Domain 3 §3.1. This file is per-service
> configuration depth.

## Contents

- [Pub/Sub](#pubsub)
- [Dataflow](#dataflow)
- [Dataproc](#dataproc)
- [Cloud Data Fusion](#cloud-data-fusion)
- [Cloud Composer](#cloud-composer)
- [BigQuery (analytics surface)](#bigquery-analytics-surface)
- [Vertex AI (ML platform surface)](#vertex-ai-ml-platform-surface)

---

## Pub/Sub

Global, durable, at-least-once messaging — the decoupling backbone
between producers and consumers across GCP data pipelines.

- **Topics and subscriptions**: publishers write to topics; subscribers
  pull (or receive push) from subscriptions — multiple subscriptions
  per topic support fan-out to independent consumers.
- **At-least-once delivery**: consumers must be idempotent or dedupe
  downstream — a scenario assuming exactly-once semantics at the
  Pub/Sub layer alone is a trap; exactly-once processing is achieved by
  pairing Pub/Sub with a downstream system that dedupes (or via
  Pub/Sub's newer exactly-once delivery feature within specific
  constraints, and Dataflow's windowing/state for pipeline-level
  exactly-once outcomes).
- **Ordering keys**: optional, scoped ordering within a key — needed
  whenever a scenario requires strict event order for a given entity
  (e.g. per-device telemetry ordering for TerramEarth) without forcing
  global ordering across all messages.
- **Dead-letter topics**: route repeatedly-failed messages aside for
  investigation instead of blocking the subscription — the answer for
  "poison message" resilience questions.

---

## Dataflow

Unified batch + streaming pipeline execution, based on Apache Beam,
fully managed and autoscaling.

- **Windowing and triggers**: fixed, sliding, or session windows group
  streaming events for aggregation; triggers control when a window's
  results are emitted (including early/late firing for
  out-of-order/late-arriving data) — the mechanism referenced in
  Domain 6 §6.2's data-integrity discussion.
- **Watermarks**: Dataflow's estimate of "how complete is the data for
  time T so far" — drives when a window is considered closed; a
  scenario about late-arriving IoT data (TerramEarth-shaped) is testing
  watermark/trigger configuration, not a storage-tier change.
- **Autoscaling**: worker count scales to throughput automatically;
  cap `max workers` to bound cost during unexpected load spikes.
- **Templates**: Google-provided templates (e.g. Pub/Sub → BigQuery)
  for common patterns without writing custom Beam code — the answer
  for straightforward, well-known pipeline shapes.

---

## Dataproc

Managed Spark/Hadoop — for lift-and-shift of existing big-data jobs
rather than a rewrite.

- **Ephemeral clusters**: spin up a cluster for a job, tear it down
  after — the recommended pattern over long-lived clusters, since it
  avoids paying for idle capacity and simplifies version management.
- **Autoscaling policies**: scale worker nodes within a job's run based
  on YARN pending-work metrics.
- **When it's the answer over Dataflow**: the scenario describes
  *existing* Spark/Hive/Hadoop jobs/skills being migrated, not a
  greenfield pipeline — greenfield streaming/batch work defaults to
  Dataflow (managed, no cluster lifecycle to think about).

---

## Cloud Data Fusion

No-code/low-code visual pipeline builder, running on Dataproc under the
hood.

- **When it's the answer**: a scenario emphasizing a team *without*
  dedicated data-pipeline engineers, wanting a GUI-driven ETL/ELT
  authoring experience — not the default choice when the team already
  has Beam/Spark engineering capability (Dataflow/Dataproc directly
  give more control at that point).

---

## Cloud Composer

Managed Apache Airflow — DAG-based orchestration across GCP and
external systems.

- **When it's the answer**: multi-step workflows with dependencies
  spanning several services/systems (e.g. "load from an external SaaS,
  transform in Dataflow, load into BigQuery, then trigger a downstream
  notification") — distinct from a single pipeline tool; Composer
  orchestrates *across* tools, it doesn't replace Dataflow/Dataproc
  themselves.

---

## BigQuery (analytics surface)

Serverless SQL analytics warehouse — storage-relevant details in
`02-services/02-storage-databases.md`; this section is the analytics/
compute surface.

- **On-demand vs. capacity (slot-based) pricing**: on-demand bills per
  bytes scanned (good for unpredictable/ad hoc usage); capacity pricing
  reserves slots for predictable cost at high, steady query volume —
  the same "predictable load → commitment discount" pattern as Compute
  Engine CUDs (Domain 4 §4.3).
- **Materialized views**: precomputed, incrementally-maintained query
  results — the answer for "the same expensive aggregation query runs
  repeatedly," reducing both cost and latency versus re-running the
  full query each time.
- **BigQuery ML**: train and run ML models using SQL directly against
  BigQuery data — the answer when a scenario wants "simple ML without
  moving data out of the warehouse or standing up a separate ML
  platform."
- **Federated queries / external tables**: query Cloud Storage,
  Bigtable, or Cloud SQL data without loading it — for data-lake
  architectures that keep the canonical copy outside BigQuery-managed
  storage.

---

## Vertex AI (ML platform surface)

Unified ML platform — compute-relevant training/serving details in
`02-services/01-compute.md`; this section covers the broader MLOps/
platform surface.

- **Model Garden**: catalog of foundation models (Google's Gemini
  family and partner/open models) available for direct use or
  fine-tuning — the starting point for "we want to use generative AI"
  scenarios rather than building a model from scratch.
- **Feature Store**: centralized, versioned feature management with an
  online store (low-latency serving) and offline store (training/
  batch) — the answer for "avoid training/serving skew" and "reuse
  features across multiple models," and a Domain 4 §4.3 cost/latency
  optimization target.
- **Model Monitoring**: detects training/serving skew and data drift
  in production, triggering retraining or alerting — the operational
  reliability layer for ML models, conceptually parallel to Cloud
  Monitoring/SLOs for traditional services (Domain 6 crossover).
- **Vertex AI Pipelines**: managed, reproducible ML workflow
  orchestration (built on Kubeflow Pipelines) — the MLOps equivalent
  of Cloud Composer/Cloud Build for the ML lifecycle specifically.
- **Agent Builder / grounding**: tooling for building retrieval-
  augmented generation (RAG) and agentic applications atop Model
  Garden models — the 2026-era answer for "ground our AI feature in
  our own data" scenarios (e.g. HRL's AI-assisted commentary drawing on
  live race data).
- **Securing AI configuration** (see Domain 3 §3.1): private endpoints,
  VPC-SC perimeters around the Vertex AI project, DLP integration on
  prompts/training data, and Workload Identity Federation for any
  external/partner access to models.
