# Data, Analytics & AI Services Reference

> Cost/performance optimization for these services: Domain 4 §4.3.
> Securing AI patterns: Domain 3 §3.1, `04-security-iam.md`. This file
> is per-service configuration depth. Every service below follows the
> same checklist: purpose, when to use, when **not** to use (paired
> with the alternative that wins instead), configuration surface,
> cost, performance, scaling, security, HA/failure behavior, common
> mistakes, and exam scenario cues.

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

**Purpose:** global, durable, at-least-once messaging — the
decoupling backbone between producers and consumers across GCP data
pipelines.

**When to use:**
- Decoupling producers from consumers in an event-driven architecture
  (fan-out to multiple independent subscribers, buffering against
  consumer slowdowns).
- The ingestion front door for streaming pipelines (device telemetry,
  clickstream, application events) feeding Dataflow/BigQuery.

**When NOT to use — use something else instead:**
- The scenario needs strict global message ordering across all
  messages, not just within a defined key → **redesign around
  ordering keys** (below) rather than assuming Pub/Sub gives you
  total order by default; if true total order across everything is
  required, that's a fundamentally different (and much lower-
  throughput) architecture than Pub/Sub is built for.
- A synchronous request/response pattern where the caller needs an
  immediate result → **a direct API call (Cloud Run/GKE service)**,
  not Pub/Sub — Pub/Sub is asynchronous decoupling, not an RPC
  mechanism.

**Key configuration surface:**
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
- **Schema enforcement**: attach an Avro/protobuf schema to a topic so
  publishers/subscribers agree on message shape — reduces the class of
  downstream pipeline failures caused by malformed/unexpected message
  structure.

**Pricing / cost considerations:** billed on data volume published
and delivered (per-GB), not per-message-count directly — very high
message-rate, small-payload workloads should consider batching
publishes to reduce per-request overhead; unused/forgotten
subscriptions still accrue storage cost for undelivered/unacked
messages, worth cleaning up in a cost-optimization pass.

**Performance characteristics:** designed for very high sustained
throughput with low publish/delivery latency at global scale;
ordering keys reduce achievable throughput for that key's messages
(a consistency/throughput tradeoff worth naming when a scenario asks
about strict ordering at very high volume).

**Scaling behavior:** scales automatically and transparently with
publish/subscribe volume — no capacity to provision, unlike
Bigtable/Spanner's node-based scaling.

**Security posture:** IAM controls per-topic/subscription publish and
subscribe permissions; CMEK support for at-rest encryption of message
data; private connectivity available via Private Google Access/VPC-SC
for workloads that must avoid the public internet.

**HA / failure-mode behavior:** messages are stored durably and
replicated across zones within the chosen region(s) automatically; a
consumer outage doesn't lose messages (they remain available for
redelivery up to the configured retention window) — dead-letter
topics specifically handle the "this message keeps failing
processing" failure mode rather than blocking the whole subscription
indefinitely.

**Common mistakes / misconfigurations:** assuming exactly-once
delivery without designing idempotent consumers; using a single
global ordering assumption when only per-entity ordering was actually
needed (unnecessarily throttling throughput); leaving unused
subscriptions accumulating undelivered messages and cost; no
dead-letter topic configured, letting a poison message block
processing indefinitely.

**Common exam scenario cues:** "decouple producers from consumers,"
"fan-out to multiple independent subscribers," "buffer against
downstream slowdowns," "per-device/per-entity ordering required" →
ordering keys; "poison message resilience" → dead-letter topics.

---

## Dataflow

**Purpose:** unified batch + streaming pipeline execution, based on
Apache Beam, fully managed and autoscaling.

**When to use:**
- Greenfield batch or streaming data pipelines where the team doesn't
  need (or want) to manage cluster lifecycle.
- Pipelines needing unified batch/streaming code (the same Beam
  pipeline definition runs in either mode) or sophisticated event-time
  windowing over out-of-order/late-arriving data.

**When NOT to use — use something else instead:**
- The scenario describes *existing* Spark/Hadoop/Hive jobs or team
  skills being migrated, not a greenfield pipeline → **Dataproc** —
  rewriting existing Spark jobs into Beam purely to use Dataflow isn't
  justified when Dataproc runs them with minimal change.
- The team wants a no-code/low-code visual authoring experience with
  no dedicated pipeline engineers → **Cloud Data Fusion** — Dataflow
  (and raw Beam) assumes engineering capability to write and maintain
  pipeline code.
- The workload is expressible entirely as a SQL query over data
  already in the warehouse (no streaming/complex transform need) →
  **BigQuery** directly — standing up a Dataflow pipeline for what's
  really just a scheduled SQL query is unnecessary complexity.

**Key configuration surface:**
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
- **Flexible Resource Scheduling (FlexRS)**: batch-only, cost-optimized
  scheduling that trades a delayed start window for lower cost using
  a mix of regular and Spot-like capacity — the answer for
  non-time-critical batch jobs where cost matters more than
  immediate execution.

**Pricing / cost considerations:** billed on worker resources
(vCPU/memory/storage) actually consumed during pipeline execution,
autoscaled to load — `max workers` is the direct lever against a cost
runaway during an unexpected spike; FlexRS trades schedule flexibility
for a lower per-job cost on batch workloads.

**Performance characteristics:** autoscaling adjusts worker count to
throughput; pipeline latency for streaming workloads is a function of
windowing/trigger configuration as much as raw worker capacity —
overly conservative watermark/trigger settings can introduce
avoidable end-to-end latency even with ample compute.

**Scaling behavior:** fully managed autoscaling of workers based on
backlog/throughput — no cluster to size or pre-provision, the direct
contrast with Dataproc's cluster-based model.

**Security posture:** supports VPC-native worker deployment (no
public IP), CMEK for pipeline data, and IAM scoping on pipeline
management operations — consistent with the rest of this file's
private-by-default posture.

**HA / failure-mode behavior:** autoscaling and Beam's built-in
fault-tolerance (checkpointing, automatic retry of failed work items)
handle worker failures transparently; watermark/trigger configuration
is what determines correct handling of late-arriving data rather than
data loss — a scenario about "late IoT telemetry must still be
correctly counted in the right time window" is testing this
configuration, not raw infrastructure reliability.

**Common mistakes / misconfigurations:** rewriting an existing,
working Spark job into Beam purely to standardize on Dataflow, adding
migration risk/cost without a clear benefit; leaving `max workers`
unbounded and absorbing an unexpected cost spike; misconfigured
watermark/trigger settings silently dropping or mishandling
late-arriving data.

**Common exam scenario cues:** "unified batch and streaming
pipeline," "late-arriving/out-of-order IoT data must still be counted
correctly," "greenfield pipeline, no existing Spark/Hadoop
investment," "cost-optimize a non-time-critical batch job" → FlexRS.

---

## Dataproc

**Purpose:** managed Spark/Hadoop — for lift-and-shift of existing
big-data jobs rather than a rewrite.

**When to use:** a scenario describing *existing* Spark, Hive, or
Hadoop jobs/skills being migrated to GCP, where rewriting into a
different framework isn't in scope.

**When NOT to use — use something else instead:**
- A greenfield pipeline with no existing Spark/Hadoop investment →
  **Dataflow** — managed, no cluster lifecycle to think about, and
  the unified batch/streaming model is a better fit for new
  development than standing up Spark clusters from scratch.
- A team wanting no-code/low-code visual pipeline authoring →
  **Cloud Data Fusion** — though note Data Fusion itself runs on
  Dataproc under the hood, so this is a UX-layer distinction, not a
  totally different execution engine.

**Key configuration surface:**
- **Ephemeral clusters**: spin up a cluster for a job, tear it down
  after — the recommended pattern over long-lived clusters, since it
  avoids paying for idle capacity and simplifies version management.
- **Autoscaling policies**: scale worker nodes within a job's run based
  on YARN pending-work metrics.
- **When it's the answer over Dataflow**: the scenario describes
  *existing* Spark/Hive/Hadoop jobs/skills being migrated, not a
  greenfield pipeline — greenfield streaming/batch work defaults to
  Dataflow (managed, no cluster lifecycle to think about).

**Pricing / cost considerations:** billed on cluster compute (and,
if used, Persistent Disk) for however long the cluster is running —
ephemeral, job-scoped clusters directly control cost by eliminating
idle-cluster spend; a long-lived cluster left running between jobs is
a common, avoidable cost trap.

**Performance characteristics:** performance characteristics are
inherited from Spark/Hadoop itself (shuffle-heavy jobs, partitioning
strategy) — Dataproc's managed layer handles cluster provisioning/
patching but doesn't change fundamental Spark job-tuning
considerations.

**Scaling behavior:** autoscaling policies add/remove worker nodes
within a running cluster based on YARN pending work — bounded by the
policy's configured min/max worker counts.

**Security posture:** supports VPC-native deployment, CMEK, and
Kerberos-based authentication for enterprise Hadoop security
patterns migrated from on-prem — relevant whenever a scenario
describes an existing on-prem Hadoop security model needing to carry
over.

**HA / failure-mode behavior:** ephemeral, job-scoped clusters mean a
cluster-level failure is scoped to that one job's run, not a
long-lived shared resource affecting multiple teams/jobs
simultaneously — an argument for ephemeral clusters beyond pure cost.

**Common mistakes / misconfigurations:** running long-lived clusters
that sit idle between jobs instead of ephemeral, job-scoped clusters;
migrating a working Spark job to a from-scratch Dataflow/Beam rewrite
when Dataproc would have preserved the existing investment with far
less risk.

**Common exam scenario cues:** "existing Spark/Hadoop/Hive jobs being
migrated to the cloud," "team already has Spark engineering skills,"
"lift-and-shift a big-data workload," paired against a Dataflow
distractor whenever the scenario is actually greenfield.

---

## Cloud Data Fusion

**Purpose:** no-code/low-code visual pipeline builder, running on
Dataproc under the hood.

**When to use:** a team without dedicated data-pipeline engineers
wanting a GUI-driven ETL/ELT authoring experience, or an
organization standardizing on a visual-lineage/governance-friendly
pipeline tool.

**When NOT to use — use something else instead:**
- The team already has Beam/Spark engineering capability → **Dataflow
  or Dataproc directly** — hand-coding gives more control, and the
  visual-authoring layer's simplicity isn't worth the abstraction
  cost for a team that doesn't need it.
- The pipeline needs fine-grained custom transform logic beyond what
  the visual plugin ecosystem readily expresses → **Dataflow**
  directly, where arbitrary Beam code can implement exactly the
  needed transform.

**Key configuration surface:** visual pipeline canvas (drag-and-drop
sources/transforms/sinks), a plugin ecosystem for common connectors,
and built-in data lineage tracking — the lineage/governance angle is
a specific differentiator worth naming when a scenario emphasizes
regulatory traceability of data transformations, not just the
pipeline result.

**Pricing / cost considerations:** billed on the underlying Dataproc
cluster resources it provisions to execute pipelines, plus a Data
Fusion instance fee for the design/orchestration environment itself —
generally a higher total cost than hand-authored Dataflow/Dataproc
for the same logical pipeline, reflecting the value of the visual/
governance tooling layered on top.

**Performance characteristics:** inherits Dataproc's execution
performance characteristics underneath; the visual layer's abstraction
doesn't materially change runtime performance, only authoring
experience.

**Scaling behavior:** scales as the underlying Dataproc clusters it
provisions scale.

**Security posture:** consistent with Dataproc's security posture
(VPC-native deployment, IAM); the added value here is built-in data
lineage, which itself supports compliance/audit requirements around
"where did this data come from and what happened to it."

**HA / failure-mode behavior:** inherits Dataproc's ephemeral-cluster
execution model for pipeline runs; the Data Fusion design/
orchestration instance itself is the additional managed component
whose own availability is a Google-managed concern.

**Common mistakes / misconfigurations:** adopting Data Fusion for a
team that already has strong Spark/Beam engineering skills, paying
for abstraction the team doesn't need; underestimating cost versus
hand-authored Dataflow/Dataproc for the same pipeline logic.

**Common exam scenario cues:** "team without dedicated data
engineers," "GUI-driven ETL/ELT authoring," "need built-in data
lineage for compliance/governance."

---

## Cloud Composer

**Purpose:** managed Apache Airflow — DAG-based orchestration across
GCP and external systems.

**When to use:** multi-step workflows with dependencies spanning
several services/systems (e.g. "load from an external SaaS, transform
in Dataflow, load into BigQuery, then trigger a downstream
notification").

**When NOT to use — use something else instead:**
- A single pipeline tool's own internal scheduling suffices (e.g. a
  Dataflow streaming job that just runs continuously, or a scheduled
  BigQuery query via BigQuery's own scheduler) → **the tool's own
  native scheduling**, not Composer — orchestrating *across* tools is
  Composer's job; it doesn't replace a single tool's own internal
  execution.
- The requirement is simple event-driven triggering (one event →
  one action) rather than a multi-step DAG with dependencies →
  **Eventarc/Pub/Sub + Cloud Functions/Cloud Run**, not Composer —
  standing up Airflow for a single-hop trigger is unnecessary
  operational overhead.

**Key configuration surface:** DAG (directed acyclic graph)
definitions in Python; operators/hooks for GCP services and external
systems; scheduling (cron-like or event-driven via sensors);
environment sizing (Airflow worker/scheduler capacity).

**Pricing / cost considerations:** billed on the underlying managed
Airflow environment's provisioned resources (schedulers, workers, web
server) — a standing cost regardless of how many DAGs are actively
running, unlike Dataflow/Dataproc's job-scoped billing; right-sizing
the environment to actual DAG concurrency needs is the main cost
lever.

**Performance characteristics:** orchestration/scheduling latency
(time from a DAG being triggered to its tasks starting) is a function
of environment sizing (scheduler/worker capacity) relative to DAG
concurrency and task count.

**Scaling behavior:** environment resources (scheduler, worker pool)
can be resized to handle a growing number of concurrent DAGs/tasks;
this is manual/configured scaling, not the fully automatic scaling
model Dataflow/Pub/Sub offer.

**Security posture:** IAM governs environment access; DAGs
themselves often need service-account credentials/Workload Identity
Federation to call the various GCP/external systems they orchestrate
— consistent with the "no static keys" principle in
`04-security-iam.md`.

**HA / failure-mode behavior:** Airflow's own retry/dependency
semantics (task-level retries, DAG-level failure handling) govern
individual task failure; the Composer environment itself can be
configured for higher availability (multiple schedulers) for
production-critical orchestration.

**Common mistakes / misconfigurations:** using Composer for a
single-hop trigger better served by Eventarc/Pub/Sub directly, paying
for a standing orchestration environment unnecessarily; under-sizing
the environment for the actual DAG concurrency, causing scheduling
delays.

**Common exam scenario cues:** "multi-step workflow spanning several
services," "load from external SaaS, transform, load, then notify,"
"dependency-based scheduling across tools" — distinct from a
single-tool internal schedule.

---

## BigQuery (analytics surface)

**Purpose:** serverless SQL analytics warehouse — storage-relevant
details in `02-services/02-storage-databases.md`; this section is the
analytics/compute surface.

**When to use:** large-scale SQL analytics/reporting/BI workloads,
ad hoc exploratory analysis, or simple ML expressible directly in
SQL against warehouse data.

**When NOT to use — use something else instead:**
- Low-latency, row-level transactional application access → **Cloud
  SQL/AlloyDB/Spanner/Firestore** — BigQuery's architecture optimizes
  for scanning large volumes of data, not point-lookup/transactional
  latency.
- Live operational-data analytics that must stay tightly coupled to a
  transactional workload without an ETL step → **AlloyDB's columnar
  engine** — see `02-storage-databases.md`'s AlloyDB section for the
  full tradeoff.

**Key configuration surface:**
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

**Pricing / cost considerations:** on-demand pricing scales with
bytes scanned per query — partitioning/clustering (see
`02-storage-databases.md`) directly control this; capacity pricing
converts variable per-query cost into a fixed reserved-slot cost,
favoring workloads with steady, predictable, high query volume the
same way a CUD favors a steady compute fleet.

**Performance characteristics:** query performance is dominated by
bytes scanned (controlled by partitioning/clustering) and query
complexity (joins, window functions); materialized views trade
storage/maintenance cost for dramatically lower latency on repeated
expensive aggregations.

**Scaling behavior:** compute (query execution) scales transparently
per query under on-demand pricing; under capacity pricing, query
concurrency is bounded by reserved slot capacity, which can itself be
scaled up/down as a deliberate provisioning decision.

**Security posture:** column-level and row-level security policies,
IAM at dataset/table level, CMEK, VPC-SC perimeter support, and Data
Access audit logging together give fine-grained, auditable control
over who can query what — pairs directly with DLP (`04-security-
iam.md`) for pre-classifying/de-identifying sensitive columns before
they're queryable.

**HA / failure-mode behavior:** fully managed, no customer-facing
cluster/node failover to configure; multi-region datasets provide
broader redundancy at the storage layer (see
`02-storage-databases.md`).

**Common mistakes / misconfigurations:** running unpartitioned
`SELECT *`-shaped queries at scale under on-demand pricing, driving
up cost and latency together; choosing on-demand pricing for a
workload with genuinely steady, predictable high query volume where
capacity pricing would be cheaper; not using materialized views for a
repeatedly-run expensive aggregation.

**Common exam scenario cues:** "reduce BigQuery query cost/bytes
scanned," "predictable, steady high query volume" → capacity/slot
pricing; "same expensive aggregation runs repeatedly" → materialized
views; "simple ML without a separate ML platform" → BigQuery ML.

---

## Vertex AI (ML platform surface)

**Purpose:** unified ML platform — compute-relevant training/serving
details in `02-services/01-compute.md`; this section covers the
broader MLOps/platform surface.

**When to use:** any scenario needing to train, serve, monitor, or
orchestrate machine learning models on GCP, especially where a
managed platform is preferred over hand-built ML infrastructure.

**When NOT to use — use something else instead:**
- A problem that's simply expressible in SQL against warehouse data
  → **BigQuery ML** — avoids standing up a separate Vertex AI
  training job/pipeline for a problem the warehouse can already
  handle directly.
- A team with mature ML infrastructure wanting full control over
  training topology → **GKE with GPU node pools or Compute Engine
  A2/A3/G2 directly** (`01-compute.md`) — Vertex AI's managed layer
  trades some of that control for operational simplicity.

**Key configuration surface:**
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
- **Securing AI configuration** (see Domain 3 §3.1 and
  `04-security-iam.md`): private endpoints, VPC-SC perimeters around
  the Vertex AI project, DLP integration on prompts/training data, and
  Workload Identity Federation for any external/partner access to
  models.

**Pricing / cost considerations:** training is billed by compute
resource consumed (machine type, accelerator type/count, duration);
online endpoints bill for provisioned node capacity whether fully
utilized or not, while batch prediction bills only for the job's
actual run — the same "provisioned vs. on-demand" cost shape recurring
throughout this file; Feature Store's online store adds a standing
cost justified by avoiding redundant feature computation across
multiple models/services.

**Performance characteristics:** online endpoint latency is
dominated by model size/complexity and accelerator choice; Feature
Store's online store specifically targets low-latency feature
retrieval at serving time to avoid recomputing features in the
request path.

**Scaling behavior:** online endpoints autoscale on traffic/
utilization; Vertex AI Pipelines scale orchestration across
potentially many parallel training/evaluation steps without the team
managing that orchestration infrastructure directly.

**Security posture:** private endpoints and VPC-SC perimeters
restrict model access to inside the perimeter; DLP integration
supports the Securing AI focus area's prompt/training-data governance
requirement; Workload Identity Federation is the pattern for external/
partner systems needing to call a Vertex AI endpoint without a static
key — all consistent with `04-security-iam.md`'s broader patterns.

**HA / failure-mode behavior:** endpoints are regional; multi-region
serving resilience requires deploying the model to multiple regional
endpoints behind a global load balancer; Model Monitoring's drift/skew
detection is itself a failure-mode-detection mechanism specific to
ML — a model can be "up" (serving requests successfully) while
silently degrading in accuracy, which traditional infrastructure
health checks wouldn't catch.

**Common mistakes / misconfigurations:** skipping Feature Store and
recomputing the same features redundantly across multiple models,
risking training/serving skew; no Model Monitoring configured, so
data/concept drift goes undetected until a business metric visibly
suffers; leaving a prediction endpoint public when a scenario requires
private/partner-only access; using a full custom-training/Vertex AI
Pipelines setup for a problem BigQuery ML could solve directly in SQL.

**Common exam scenario cues:** "train/serve a machine learning
model," "avoid training/serving skew" → Feature Store; "detect model
degradation in production" → Model Monitoring; "ground our AI feature
in our own data" → Agent Builder/grounding (2026-era case-study
material, especially HRL's commentary/highlight generation).
