# Batch Pipeline Architecture

> The canonical "scheduled, multi-step ETL" pattern. It feeds the same
> bronze/silver/gold zones described in `Data-Lake.md` and
> `Lakehouse.md`; the difference in this file is entirely about **how
> the work gets triggered, sequenced, retried, and processed at
> scale**, not about the storage zones themselves. Where a source is a
> live database rather than files, see `CDC.md` for the ingestion
> half — this file picks up from "data has landed" through "data is
> served."

## The shape of every batch pipeline on this exam

Whatever the specific scenario, a batch pipeline is always some
version of: **something triggers it on a schedule or condition, it
extracts from a source, it transforms the data, it writes to a
destination zone, and something else notices if any step failed and
reacts.** The exam tests whether you know which AWS service plays each
of those five roles and why.

---

## The reference architecture

```
                    BATCH PIPELINE — REFERENCE ARCHITECTURE
                    ==========================================

  +----------------+
  |  EventBridge    |   Scheduled rule (cron/rate expression) OR
  |  Scheduler      |   event pattern (e.g., "new file landed" via
  +----------------+   S3 EventBridge notifications)
        |
        v
  +---------------------------------------------------------------+
  |                    STEP FUNCTIONS STATE MACHINE                 |
  |                                                                   |
  |   [Extract] -> [Transform] -> [Load] -> [Catalog Update]          |
  |       |             |            |             |                  |
  |    Catch/Retry   Catch/Retry  Catch/Retry   Catch/Retry            |
  |       |             |            |             |                  |
  |       +-------------+------------+-------------+                  |
  |                          |  (any step exhausts retries)            |
  |                          v                                        |
  |                 [Failure Handler] --> SNS (alert) + SQS DLQ         |
  |                                        (failed batch metadata,      |
  |                                         for reprocessing)           |
  +---------------------------------------------------------------+
        |                    |                    |
        v                    v                    v
  +-----------+       +--------------+      +----------------+
  |  EXTRACT   |       |  TRANSFORM   |      |  LOAD/CATALOG   |
  |  Glue JDBC |       |  Glue ETL     |      |  S3 write +      |
  |  or DMS full |     |  (bookmark    |      |  Glue Crawler /   |
  |  load, or    |     |   enabled)    |      |  partition        |
  |  raw file      |    |  or EMR for   |      |  registration      |
  |  landing        |   |  heavy jobs    |      |                    |
  +-----------+       +--------------+      +----------------+
                              |
                       job.init() reads bookmark state
                       job.commit() persists new bookmark
                       (only NEW data since last successful
                        run gets processed)
                              |
                              v
                       CURATED S3 ZONE (see Data-Lake.md / Lakehouse.md)
                              |
                              v
                    Athena / Redshift Spectrum / QuickSight
```

**Reading every arrow:**

- **EventBridge Scheduler → Step Functions.** EventBridge is the
  **central trigger**, not the orchestrator — it fires on a schedule
  (`cron(0 2 * * ? *)` for "2am daily") or in response to an event
  (an S3 `Object Created` notification routed through EventBridge).
  What it triggers is a **Step Functions state machine**, which owns
  sequencing, branching, and retry logic. Using EventBridge as the
  single, central scheduling entry point — rather than scattering cron
  schedules across individual Glue triggers, Lambda schedules, and EC2
  cron jobs — is the "senior engineer" answer whenever a scenario
  emphasizes a unified, auditable trigger layer across multiple
  services.
- **Step Functions → Extract/Transform/Load/Catalog steps, each with
  Catch/Retry.** Step Functions expresses the pipeline as an explicit
  **state machine**: each step is a distinct state, each state has its
  own retry policy (exponential backoff, max attempts) and its own
  `Catch` block routing to a failure handler if retries are exhausted.
  This is what "multi-step batch DAG with proper failure handling"
  means concretely on this exam — not a single monolithic script that
  either fully succeeds or fully fails with no visibility into which
  step broke.
- **Any step's exhausted retries → Failure Handler → SNS + SQS DLQ.**
  When a step fails and its retries are exhausted, the state machine
  transitions to a failure-handling branch: **SNS** notifies a human
  (on-call, Slack via SNS subscription), and the failed batch's
  identifying metadata (which file, which partition, which run) goes
  onto an **SQS dead-letter queue** so it can be inspected and
  reprocessed deliberately rather than silently lost or endlessly
  retried against a persistently broken input.
- **Extract step → Glue JDBC / DMS full load / raw file landing.**
  Depending on the source: a relational database extract typically uses
  Glue's JDBC connection (or, for a live source with a DMS pipeline
  already established, DMS full-load output); a file-based source is
  simply "land the files," feeding the transform step directly.
- **Transform step → Glue ETL (bookmark-enabled) or EMR.** This is
  where cleansing, deduplication, joins, and business logic happen —
  see the Glue-vs-EMR comparison below for how to choose between them.
  **Job bookmarks** are the mechanism that makes this step
  *incremental*: `job.init()` reads the persisted bookmark state (which
  files/partitions were already processed as of the last successful
  run), the job processes only what's new, and `job.commit()` persists
  the updated bookmark — this is what prevents a nightly job from
  reprocessing the entire dataset every single night.
- **Load/Catalog step → S3 write + Glue Crawler/partition
  registration.** Writing the transformed output to the curated zone is
  only half the step — the other half is making the new partition
  **visible to query engines**, either via a crawler run or explicit
  partition registration (same choice discussed in `Data-Lake.md`).
  Skipping this half is the single most common "the data landed but
  nobody can query it" failure in batch pipelines.
- **Curated zone → Athena/Redshift Spectrum/QuickSight.** Standard
  consumption, identical to `Data-Lake.md`/`Lakehouse.md`.

---

## Service-by-service rationale, with runner-up alternatives

### Trigger layer: EventBridge Scheduler vs. Glue triggers vs. cron-on-EC2

| | **EventBridge Scheduler** | **Native Glue triggers** | **Cron on EC2/self-managed** |
|---|---|---|---|
| Central, cross-service visibility | ✅ one place for schedules across Glue/Lambda/Step Functions/ECS | ❌ scoped to Glue only | ❌ scattered, invisible to the rest of the platform |
| Event-pattern triggering (not just schedule) | ✅ (e.g., react to S3 object creation) | Limited (job-completion chaining only) | Requires custom polling code |
| Operational overhead | Low — fully managed | Low, but Glue-only | High — patch, monitor, secure the instance yourself |
| Exam signal | "Centralized scheduling across services," "event-driven trigger on file arrival" | Simple, Glue-only job chaining | Almost never the correct answer on this exam |

**Runner-up worth knowing:** chaining Glue triggers directly
(job-completion-triggers-next-job) is a legitimate lightweight answer
for a simple two- or three-step, Glue-only pipeline with no need for
complex branching or non-Glue steps — but as soon as the scenario
introduces conditional branching, non-Glue steps (Lambda, ECS, DMS), or
explicit retry/catch requirements, Step Functions is the correct
upgrade.

### Orchestration: Step Functions vs. Amazon MWAA

| | **Step Functions** | **MWAA (Managed Apache Airflow)** |
|---|---|---|
| Best for | AWS-native state machines, service-to-service orchestration, visual retry/catch logic | Existing Airflow DAGs, complex Python-defined workflows, teams already invested in Airflow operators/plugins |
| Pricing model | Pay per state transition | Pay for environment uptime (worker capacity) regardless of DAG frequency |
| Exam signal | "Native AWS orchestration," "visual workflow," "retry/catch between AWS service calls" | "Existing Airflow," "migrate our DAGs," "Python-heavy custom operators" |

**Exam trap:** don't default to MWAA just because a scenario says
"orchestrate a complex pipeline" — complexity alone isn't the signal;
**existing Airflow investment** is. A complex but AWS-native pipeline
with no mention of Airflow is still a Step Functions scenario.

### Transform compute: Glue ETL vs. EMR vs. Lambda

| | **Glue ETL (Spark, serverless)** | **EMR** | **Lambda** |
|---|---|---|---|
| Best for | Most batch ETL — serverless, job bookmarks built in, DynamicFrames for schema flexibility | Very large, sustained, cost-sensitive batch workloads (reserved/spot economics); existing Hadoop-ecosystem tooling | Lightweight transforms, small payloads, sub-15-minute runtime, event-driven single-file processing |
| Bookmarks | ✅ native | Not built in — must implement your own watermarking (e.g., tracking processed partitions in DynamoDB) | N/A — typically stateless per invocation |
| Scaling | Auto (worker type G.1X–G.8X, auto-scaling) | Manual/auto-scaling cluster sizing | Auto, but bounded by 15-minute max duration and memory limits |
| Exam signal | Default answer for "serverless batch ETL" | "Existing Spark/Hadoop scripts," "reserved capacity," "very large sustained cluster workload" | "Small file," "simple transform," "triggered per S3 object," explicitly short-lived |

### Incremental processing: job bookmarks vs. manual watermarking

Job bookmarks require the job to actually call `job.commit()` on
success — a job that crashes before committing does **not** advance
its bookmark, so the next run correctly reprocesses that window (this
is a feature, not a bug: it's what keeps bookmarks crash-safe). Two
situations specifically require **disabling or resetting** bookmarks:
after a schema change that invalidates prior bookmark state, or when a
deliberate full reprocessing/backfill is needed — leaving bookmarks
enabled in either case causes the job to silently skip data it
shouldn't.

---

## Scaling considerations

- **Glue worker type and count** (G.1X through G.8X, with auto-scaling)
  should track data volume per run, not be fixed at a guess — under-
  provisioning stretches run time past the batch window; over-
  provisioning wastes DPU-hours.
- **EMR cluster sizing** — spot fleets for cost, on-demand for
  time-critical steps, instance fleets mixing both; cluster
  auto-termination after job completion to avoid paying for idle
  capacity between nightly runs.
- **Parallelizing across partitions** — a well-partitioned source
  (see `Data-Lake.md`'s partitioning strategy) lets Glue/EMR process
  multiple partitions concurrently rather than serially, shrinking the
  batch window.
- **Step Functions Map state** for fan-out — processing many
  independent files/partitions in parallel branches rather than one
  step handling all of them sequentially.
- **Athena/Redshift Spectrum concurrency at serve time** scales
  independently of the ingest pipeline — a heavier nightly load doesn't
  by itself strain query-time concurrency, but a badly-partitioned
  curated table (from the transform step) will.

## Failure scenarios and tolerance

| Failure | Effect | Mitigation |
|---|---|---|
| Job crashes mid-transform, before `job.commit()` | Bookmark doesn't advance; next run correctly reprocesses the same window | This is by design — don't "fix" it by manually advancing the bookmark |
| Job crashes mid-write to curated S3, after some files written | Curated zone left in a partially-written, inconsistent state for that partition | Write to a staging prefix and atomically "promote" (rename/move) only on full success, or use Iceberg (`Lakehouse.md`) for atomic snapshot commits instead of raw file writes |
| Bookmark reset accidentally left in place after a one-time backfill | Job reprocesses everything on every subsequent run — cost and time blowup | Re-enable bookmarks immediately after a deliberate backfill completes |
| Step Functions retries a permanently-broken step (bad input file) repeatedly | Wasted compute, delayed alerting, potential retry storm | Bounded max-attempt retry policy with exponential backoff, then route to Catch → DLQ, not infinite retry |
| Catalog update step skipped or fails silently | New data physically present but invisible to Athena/Redshift Spectrum | Make catalog update a first-class state in the state machine with its own Catch/Retry, not an afterthought bolted onto the transform step |
| SQS DLQ fills up unmonitored | Failed batches pile up unnoticed, no one reprocesses them | CloudWatch alarm on DLQ depth, routed to the same SNS on-call notification |

## Cost drivers

- **Glue DPU-hours** (transform step) — the dominant recurring cost for
  most batch pipelines; bookmarks directly reduce this by avoiding
  full reprocessing.
- **EMR cluster uptime** — on-demand vs. spot mix, and whether clusters
  auto-terminate after each run versus staying warm.
- **Step Functions state transitions** — usually a small line item, but
  a Map state fanning out to thousands of parallel branches can add up;
  worth watching in very high-fanout designs.
- **S3 storage and request costs** for staging/curated writes.
- **SNS/SQS** — negligible cost, but real value as an early-warning
  system that avoids much larger downstream costs (bad data propagating
  further before anyone notices).
- **Athena bytes scanned / Redshift Spectrum bytes scanned** at serve
  time — a direct payoff of good partitioning and Parquet output from
  the transform step.

## Exam traps

⚠️ **Cron schedules scattered across individual services** (a Glue
trigger here, an EC2 cron job there) versus **EventBridge as the
central schedule** — when a scenario emphasizes visibility/auditability
of "when does everything run," EventBridge Scheduler is the unifying
answer.

⚠️ **Job bookmarks silently reprocessing everything** after a schema
change is a real failure mode, not a bookmark bug — the fix is
deliberately resetting/disabling bookmarks around the schema change,
not treating bookmarks as broken.

⚠️ **MWAA is not the default "complex pipeline" answer** — it's the
answer specifically for existing Airflow investment; a complex but
AWS-native pipeline with no Airflow mention still points to Step
Functions.

⚠️ **A partially-written curated zone after a mid-write failure** is a
correctness trap distinct from `Data-Lake.md`'s concurrent-writer
problem — the fix here is atomic promotion (staging + rename) or
adopting Iceberg for snapshot-level atomicity, not "just retry the
write."

⚠️ **Catalog/partition registration treated as optional or automatic**
— it is neither; a scenario where "the pipeline succeeded but analysts
can't see new data" is pointing at a missing or failed catalog-update
step, not a query-engine bug.

⚠️ **EMR chosen reflexively for "big data"** when the scenario doesn't
actually call for reserved/spot cluster economics or existing
Hadoop-ecosystem tooling — Glue is the default serverless batch answer
unless the scenario gives a specific reason to prefer EMR.

## Real enterprise example

A national retailer runs a nightly batch pipeline to prepare data for
the next morning's BI dashboards. **EventBridge Scheduler** fires a
**Step Functions** state machine at 1am. The **Extract** state pulls
the prior day's POS transactions from an RDS replica via Glue JDBC; the
**Transform** state runs a bookmark-enabled Glue Spark job that dedupes
records, converts currency, and writes Parquet to a staging prefix; the
**Load/Catalog** state atomically promotes the staging prefix into the
curated zone and updates Glue Data Catalog partitions; a final health-
check state confirms row counts are within an expected range versus
the prior night before declaring success. If any state fails after
exhausting its retry policy, an **SNS** notification pages the on-call
data engineer and the failed run's metadata lands in an **SQS DLQ** for
deliberate reprocessing — critically, the retailer's morning dashboard
refresh is itself gated on the state machine's success signal, so a
failed pipeline blocks a stale dashboard from silently going live
rather than surfacing wrong numbers to store managers at 8am.

---

## Practice questions

**1. A team currently schedules its Glue jobs with individual Glue
triggers, its Lambda functions with individual EventBridge rules, and
one legacy step with a cron job on an EC2 instance. Leadership wants a
single place to see and manage every schedule across the platform.
What should change?**

A) Consolidate everything under Glue triggers, since Glue is already in
use
B) Consolidate scheduling under EventBridge Scheduler as the central
trigger layer, and orchestrate multi-step logic with Step Functions —
**correct**
C) Replace all scheduling with manual runs
D) Move everything to cron jobs on a single EC2 instance for simplicity

*B is correct — this is precisely the "centralized, cross-service
schedule visibility" signal for EventBridge Scheduler described above.
A doesn't solve the cross-service visibility problem — Glue triggers
are Glue-only. C removes automation entirely. D reintroduces
self-managed infrastructure and loses cross-service visibility, the
opposite of the stated goal.*

**2. A nightly Glue ETL job with bookmarks enabled crashes two minutes
before completion, before calling `job.commit()`. The next scheduled
run begins. What happens to the data from the failed run's window?**

A) It is permanently lost
B) The bookmark never advanced, so the next run correctly reprocesses
that same window along with any new data — **correct**
C) The job automatically resumes from the exact row it crashed on
D) The next run skips that window entirely, assuming it was already
processed

*B is correct — this is exactly how bookmarks provide crash safety, as
explained in this file: no `job.commit()` means no bookmark advance. A
is false — nothing is lost, it's simply reprocessed. C overstates
Glue's granularity — bookmarks track files/partitions processed, not a
mid-file row position. D is the actual bug this design prevents.*

**3. A batch job's transform step writes directly into the curated S3
prefix that Athena queries, and a query happens to run while the job is
mid-write. Some analysts see partial/inconsistent results. What
architectural change fixes this?**

A) Run the query less frequently
B) Write to a staging prefix and atomically promote only on full
success, or adopt Iceberg for snapshot-level atomic commits —
**correct**
C) Increase the Glue job's DPU count
D) Disable job bookmarks

*B is correct — this is the atomic-promotion/Iceberg-commit fix
described in the Failure scenarios table. A doesn't fix the underlying
race, it just makes it less likely to be observed. C addresses runtime
speed, not write atomicity. D is unrelated to this specific problem.*

**4. A scenario describes an existing team with dozens of production
Airflow DAGs using custom Python operators, migrating their workloads
to AWS. Which orchestration service best fits, and why not Step
Functions?**

A) Step Functions, because it's always the default AWS-native choice
B) MWAA, because it runs their existing Airflow DAGs and operators with
minimal rewrite, versus Step Functions requiring a full re-architecture
into state machine definitions — **correct**
C) EventBridge Scheduler alone, with no orchestration layer needed
D) Glue triggers, chained job-to-job

*B is correct — "existing Airflow DAGs/custom operators" is the exact
MWAA signal called out in this file's comparison table. A ignores the
specific existing-investment signal the scenario gives. C provides
triggering but no DAG-level orchestration/dependency logic. D can't
express arbitrary custom Python operator logic the way Airflow does.*

**5. A Glue transform job is disabled from using bookmarks during a
one-time historical backfill, as intended. Three weeks later, the team
notices every nightly run is reprocessing the entire multi-year
dataset instead of just new data. What is the most likely cause?**

A) Bookmarks are fundamentally unreliable and should not be trusted
B) Bookmarks were never re-enabled after the backfill completed, so the
job has been running in "process everything" mode ever since —
**correct**
C) The Glue Data Catalog was deleted
D) EventBridge is triggering the job too frequently

*B is correct — this is the exact "bookmark reset left in place"
failure mode and mitigation called out in this file. A mischaracterizes
a configuration mistake as a service defect. C and D don't match the
symptom (full reprocessing specifically, not catalog loss or
frequency issues).*

**6. A Step Functions state machine's Transform step fails repeatedly
against a permanently malformed input file, retrying five times with
exponential backoff before finally failing. What should happen next in
a well-designed pipeline, and what should NOT happen?**

A) The state machine should retry indefinitely until the file is fixed
B) The state machine's Catch block should route the failure to an SNS
alert and an SQS DLQ holding the failed batch's metadata for deliberate
reprocessing — it should NOT retry indefinitely — **correct**
C) The pipeline should silently skip the file and continue with no
record of the failure
D) The entire state machine should be deleted and recreated

*B is correct — this is the bounded-retry-then-Catch pattern described
in both the diagram and the Exam traps section. A causes exactly the
"retry storm" failure mode called out as a trap. C loses visibility
into a real data problem. D is a wildly disproportionate response to a
routine, expected failure mode.*

**7. A curated Parquet table exists in S3 with correctly written data,
but analysts report that queries return no rows for the most recent
three days. Investigation shows the data is physically present in S3.
What is the most likely missing step?**

A) The Glue ETL transform logic is broken
B) Partition registration/catalog update for the new data was skipped
or failed, leaving the catalog unaware of the new partitions —
**correct**
C) Athena's service quota was exceeded
D) The S3 bucket's encryption key was rotated

*B is correct — this is the "load/catalog update" step's importance,
called out explicitly in both the diagram's reading and the exam traps
section: physically-present data with no catalog registration is
invisible to query engines. A is contradicted by the premise (data is
correctly written). C and D don't match the specific symptom of "data
present, but unqueryable for specific new partitions only."*

**8. A batch pipeline processes 50 TB of data nightly on a fixed EMR
cluster sized for peak holiday volume year-round. Cost review flags
this as wasteful most of the year. What is a reasonable fix, staying
within the batch-pipeline pattern?**

A) Switch entirely to Lambda for all processing
B) Right-size or auto-scale the EMR cluster to actual nightly volume,
using spot instances where tolerable, and auto-terminate after each
run rather than keeping a peak-sized cluster running year-round —
**correct**
C) Remove EMR and process everything with a single Glue DPU
D) Stop running the pipeline on weekends

*B is correct — this directly addresses the described waste (fixed
peak-sized cluster used for average-case load) using the scaling
levers named in this file (spot mix, auto-scaling, auto-termination).
A is unrealistic for genuinely large sustained batch volume (50 TB) —
Lambda's runtime/memory limits make it a poor fit. C likely
under-provisions badly for the described volume. D doesn't address the
cost-efficiency problem and arbitrarily drops processing.*

**9. A pipeline's SQS dead-letter queue has been silently accumulating
failed batches for two weeks with no one noticing, because the only
alerting was a one-time SNS message per failure that got lost in a busy
channel. What should be added?**

A) Nothing — SQS DLQs don't need monitoring once configured
B) A CloudWatch alarm on DLQ depth/age, escalating if the queue isn't
being drained, in addition to the per-failure SNS notification —
**correct**
C) Delete the DLQ and let failures be silently dropped instead
D) Increase the SQS message retention period only

*B is correct — this is exactly the mitigation named in the Failure
scenarios table for an unmonitored, filling DLQ. A ignores a real
operational gap. C removes visibility into failures entirely, making
things worse. D extends how long failures sit unnoticed without adding
any actual monitoring.*

**10. A scenario describes a simple two-step pipeline: a Glue job that
extracts and transforms, followed immediately by a second Glue job that
loads the result — no branching, no non-Glue steps, no complex retry
logic beyond Glue's own built-in job retry. Is Step Functions required
here?**

A) Yes, Step Functions is always required for any multi-step pipeline
B) Not necessarily — a simple, Glue-only, linear two-job chain can
reasonably use a native Glue trigger to chain job completion to the
next job's start, reserving Step Functions for when branching, non-Glue
steps, or custom retry/catch logic are actually needed — **correct**
C) No, orchestration is never needed for two-step pipelines
D) Step Functions should be replaced by a cron job on EC2

*B is correct and reflects the explicit "runner-up" nuance in the
Trigger layer comparison table — Step Functions is the right upgrade
when complexity demands it, not a mandatory default for every
multi-step pipeline. A overstates Step Functions' necessity for
trivial cases. C swings too far the other way — some sequencing
mechanism is still needed, even if it's simple. D reintroduces
self-managed infrastructure for no benefit.*
