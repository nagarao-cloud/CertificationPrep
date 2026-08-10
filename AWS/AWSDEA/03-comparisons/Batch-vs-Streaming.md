# Batch vs Streaming (and the Near-Real-Time Middle Ground)

> This is a **pattern** comparison, not a service comparison. Batch and
> streaming are two different answers to "when does data get
> processed relative to when it was created?" Almost every AWS service
> can be pointed at either pattern — the exam tests whether you can
> read a scenario's **latency budget, replay needs, and cost model**
> and place it correctly, especially in the "near real-time" middle
> zone where most wrong answers live.

---

## 1. ELI12

**Batch** is doing your laundry once a week. You let dirty clothes pile
up, then run one big load Sunday night. Efficient per-item cost (one
run washes everything), but if you need a clean shirt Tuesday, you're
out of luck — you have to wait for the next scheduled wash, or dig
through the hamper.

**Streaming** is a dry cleaner that presses each shirt the moment you
drop it off and hands it back in twenty minutes. Every item gets
handled individually and fast, but you're paying for that individual
attention — a machine running and staffed, ready to go at any moment,
whether or not anyone drops off a shirt.

**Near real-time** is a laundromat that runs a load every time the
machine has been sitting for 60 seconds *or* has enough clothes to fill
it, whichever comes first. Not instant like the dry cleaner, not "once
a week" like batch — a small buffer that trades a little delay for a
lot of efficiency. This is where **Amazon Data Firehose** and
**zero-ETL integrations** live, and it's the zone AWS loves to test
because "near real-time" sounds like streaming but behaves like small,
frequent batch.

---

## 2. Defining the boundary

The three questions that actually separate batch from streaming:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. LATENCY BUDGET                                                │
│    How long after an event occurs can it wait before being      │
│    processed or queried?                                        │
│      Milliseconds–seconds ........ STREAMING                    │
│      Seconds–minutes ............. NEAR REAL-TIME (the trap zone)│
│      Hours–days .................. BATCH                        │
├─────────────────────────────────────────────────────────────────┤
│ 2. REPLAY / REPROCESSING NEED                                    │
│    If something downstream breaks, do you need to go back and   │
│    reprocess exactly what happened, in order, later?            │
│      Yes, and ordering/retention matters ... STREAMING           │
│        (Kinesis Data Streams / MSK — both retain and replay)     │
│      No, source files still exist in S3 .... BATCH is fine       │
│        (just rerun the job against the files)                   │
├─────────────────────────────────────────────────────────────────┤
│ 3. COST MODEL                                                    │
│    Streaming infrastructure runs continuously — you pay whether  │
│    or not events are flowing (shard-hours, KPU-hours, broker-    │
│    hours). Batch runs on a schedule or trigger — you pay only    │
│    for the run itself (DPU-hours per invocation, instance-hours  │
│    per cluster session).                                         │
│      Continuous, always-on cost is acceptable ... STREAMING       │
│      Cost should track actual data volume/runs ... BATCH          │
└─────────────────────────────────────────────────────────────────┘
```

None of these questions is "is the data technically flowing
continuously." Data can arrive continuously (IoT telemetry, clickstream)
and still be *processed* in batch (Firehose buffers it 60s, or a Glue
job runs every 15 minutes against accumulated S3 files). The pattern is
about the **processing cadence and guarantees**, not the arrival shape.

---

## 3. Where AWS services fall

| Service | Pattern | Why |
|---|---|---|
| **Kinesis Data Streams** | **Streaming** | Millisecond-to-~200ms latency, durable retention (24h–365d), replay, ordered per shard, multiple independent consumers |
| **Amazon MSK** | **Streaming** | Kafka-compatible; same replay/ordering/multi-consumer properties as Data Streams |
| **Amazon Managed Service for Apache Flink** | **Streaming** | Continuous stream *processing* — windowed aggregation, CEP, exactly-once, always running |
| **Glue Streaming ETL** | **Streaming** | Runs continuously against Kinesis/MSK, micro-batches as small as 100ms, **bills continuously** |
| **Amazon Data Firehose** | **Near real-time** (the trap) | Buffers ~60s (or by size) before delivery; no replay; feels like streaming, architecturally behaves like tiny frequent batch |
| **Zero-ETL integrations** | **Near real-time** | Seconds-to-minutes replication lag from source to Redshift/OpenSearch; no pipeline code, but not sub-second either |
| **DMS with CDC** | **Near real-time / streaming-ish** | Continuous change capture, seconds of lag — closer to streaming than batch, but delivered as a replication stream, not a durable replayable topic |
| **Glue ETL (batch job)** | **Batch** | Scheduled/triggered runs, job bookmarks track incremental progress, no continuous billing |
| **EMR (standard Spark job)** | **Batch** | Cluster spins up, processes accumulated data, spins down (or runs on a fixed schedule) |
| **AWS Lambda (S3 event-triggered)** | Usually **near real-time / micro-batch** | Fires per object or per batch of records — fast, but each invocation processes what's accumulated since the last trigger, not a continuous stream |
| **Athena / Redshift queries** | **Batch (query-time)** | Query against data that was already landed; the *query* is instant, but the underlying data's freshness depends on what fed it |
| **Step Functions / MWAA schedules** | **Batch (orchestration)** | Cron-like triggers coordinating batch jobs |

---

## 4. Comparison matrix

| Attribute | **Batch** | **Near Real-Time** | **Streaming** |
|---|---|---|---|
| **Purpose** | Process accumulated data on a schedule or trigger | Process small buffers frequently, minimize pipeline code | Process each event individually as it arrives |
| **Latency** | Minutes–hours (sometimes days) | **Seconds to ~15 minutes** | Milliseconds–seconds |
| **Cost model** | Per-run (DPU-hours, instance-hours) — **tracks actual usage** | Per-GB delivered (Firehose) or effectively free pipeline (zero-ETL) | **Continuous** shard/broker/KPU-hours — pay even when idle |
| **Idle cost** | **Zero between runs** | Low — buffering, not standing compute | **High** — infrastructure runs 24/7 |
| **Replay / reprocessing** | ✅ Trivial — rerun against source files still in S3 | ❌ (Firehose) / N/A (zero-ETL re-syncs, doesn't "replay" a log) | ✅ **Native** — retention window, replay from any offset |
| **Ordering guarantees** | Whatever the source files/table give you | Best-effort, not guaranteed | ✅ Per-partition/per-shard ordering |
| **Multiple independent consumers** | ✅ (multiple jobs can read the same S3 data) | ❌ Firehose = exactly one destination | ✅ Kinesis/MSK support many consumer groups |
| **Operational overhead** | Low — scheduled, hands-off | **Lowest** — fully managed buffering/delivery | Medium–high — shard/partition/broker management (unless Serverless variants) |
| **Best use case** | Nightly reports, historical backfills, cost-sensitive ETL | Land raw events into S3/Redshift/OpenSearch without writing pipeline code | Fraud detection, live dashboards, multi-team fan-out, anything needing replay |
| **When NOT to use** | Sub-minute freshness required | Strict ordering, replay, or true sub-second latency required | Data genuinely only needs to be processed once a day — continuous billing is wasted money |
| **Exam favorite** | "nightly," "scheduled," "process new files since last run" | "near real-time," "minimal pipeline code," "land in S3/Redshift automatically" | "real-time," "sub-second," "replay," "multiple consumers," "exactly-once" |

---

## 5. Decision tree

```
┌───────────────────────────────────────────────────────────────┐
│ START: What does the scenario's LATENCY REQUIREMENT say,       │
│ literally, in the stem?                                        │
└───────────────────────────────┬────────────────────────────────┘
                                 │
      "real-time" / "sub-second" / "immediately" appears
                                 │
                ┌────────────────┴────────────────┐
               YES                                NO
                │                                   │
     Does it also need REPLAY or                    │
     MULTIPLE INDEPENDENT CONSUMERS?      "near real-time" / "within
                │                          minutes" / "as soon as
     ┌──────────┴──────────┐               possible without building
    YES                    NO              a pipeline" appears?
     │                      │                          │
┌────▼─────┐      ┌─────────▼────────┐    ┌────────────┴────────────┐
│ KINESIS  │      │ Still choose      │   YES                        NO
│ DATA     │      │ Kinesis Data      │    │                          │
│ STREAMS  │      │ Streams — the     │    │              "nightly" / "scheduled" /
│ or MSK   │      │ "real-time"       │    │              "process new files since
│(replay,  │      │ keyword alone     │    │              last run" / cost-sensitive
│ordering, │      │ still rules out   │    │              appears?
│fan-out)  │      │ Firehose          │    │                          │
└──────────┘      └───────────────────┘    │              ┌───────────┴───────────┐
                                             │             YES                     NO
                              Is the source an operational  │                       │
                              database with a supported      │                 Re-examine the
                              zero-ETL pairing (Aurora/RDS-  │                 stem — you may be
                              MySQL/DynamoDB → Redshift/     │                 missing a
                              OpenSearch)?                   │                 requirement
                                             │                │
                              ┌───────────────┴───────────┐   │
                             YES                          NO  │
                              │                            │  │
                    ┌─────────▼─────────┐      ┌───────────▼──▼──────┐
                    │    ZERO-ETL        │      │  AMAZON DATA         │
                    │  INTEGRATION       │      │  FIREHOSE             │
                    │ (no pipeline code, │      │ (land stream in S3/  │
                    │  no DMS, no Glue)  │      │  Redshift/OpenSearch, │
                    └─────────────────────┘      │  ~60s buffer, no     │
                                                  │  ops burden)         │
                                                  └───────────────────────┘
                                                             │
                                              (if "nightly"/"scheduled" path
                                               taken instead) → GLUE ETL
                                               (batch) or EMR (batch,
                                               existing Spark/Hive)
```

---

## 6. Worked scenarios

**Scenario A — A fraud-detection system must flag a suspicious
transaction within 200ms of it occurring, and the fraud team needs to
replay the last hour of transactions whenever they retrain a detection
model.** *Winner: Kinesis Data Streams (streaming), likely paired with
Managed Flink for windowed scoring.* Sub-200ms latency and explicit
replay requirements both rule out Firehose (buffered, no replay) and
any batch approach.

**Scenario B — A retail company wants clickstream events delivered
into S3 as Parquet, partitioned by date, "with the least operational
overhead," and can tolerate data being up to two minutes stale.**
*Winner: Amazon Data Firehose (near real-time).* No shard management,
no consumer code, built-in format conversion and dynamic partitioning —
exactly what "least operational overhead" + "a couple minutes is fine"
signals. Kinesis Data Streams would be over-engineered (you'd have to
write and operate a consumer).

**Scenario C — Nightly batch files (50 GB) land in an S3 landing zone
from an on-prem system each night at 1am. They need to be cleaned,
joined against a dimension table, and written to a curated zone by
6am.** *Winner: Glue ETL (batch), scheduled via EventBridge Scheduler
or triggered by the file's arrival.* There's no continuous stream here
at all — one file, once a day. Running Glue Streaming or Kinesis for
this would bill continuously for a workload that only needs to run once
a day; a scheduled batch job is both operationally simpler and vastly
cheaper.

**Scenario D — An application uses Aurora PostgreSQL as its
operational database. The analytics team wants near-real-time reporting
in Redshift without writing or maintaining any ETL code, and no
transformation is needed on the way in.** *Winner: Zero-ETL
integration.* This is the textbook zero-ETL setup: supported source
(Aurora PostgreSQL), supported target (Redshift), no transformation
required, seconds-to-minutes lag acceptable. The moment the scenario
adds "…and must deduplicate/filter/join during load," zero-ETL is
disqualified (see the Iceberg/DMS/Glue comparison file) and DMS + Glue
becomes correct instead.

---

## 7. Exam traps

| Trap | The correction |
|---|---|
| **"Streaming source" ⇒ must use streaming service** | Data arriving continuously (IoT, clickstream) can still be *processed* as near-real-time (Firehose) or even batch (accumulate in S3, run Glue every 15 min). The arrival pattern and the processing pattern are independent. |
| **"Near real-time" mistaken for "real-time"** | "Near real-time" is the Firehose/zero-ETL trigger phrase (seconds-to-minutes). "Real-time" or "sub-second" is the Kinesis Data Streams/Flink trigger phrase. AWS uses these two phrases deliberately and differently. |
| **Firehose assumed to support replay** | It has **zero** retention and **zero** replay capability. Any requirement mentioning "reprocess historical events" or "multiple consumers" eliminates Firehose immediately regardless of latency tolerance. |
| **Choosing streaming for cost-sensitive, infrequent workloads** | Glue Streaming and Kinesis/MSK bill continuously whether or not data is flowing. If the question emphasizes "lowest cost" and data arrives in predictable daily/hourly batches, streaming infrastructure is the wrong (expensive) answer even if it would technically work. |
| **Zero-ETL assumed to support transformation** | Zero-ETL replicates data as-is. A stem that says "…apply business logic/filter/enrich during load" disqualifies zero-ETL — that requirement needs DMS + Glue or Glue alone. |
| **DMS CDC treated as identical to Kinesis streaming** | DMS CDC is continuous and low-latency, but it's a replication mechanism into a target, not a durable, replayable, multi-consumer log the way Kinesis/MSK are. Don't reach for DMS when the requirement is "multiple independent consumers need to read the same event stream." |
| **Lambda assumed to be "streaming"** | Lambda triggered by S3 events or a Kinesis/DynamoDB Streams shard processes in small batches per invocation — near-real-time/micro-batch, not a continuously running stream processor like Flink. |
| **Assuming "batch" means "slow is fine, no urgency at all"** | Batch can still have a tight SLA ("must be available for analysts by 6am") — batch just means the processing model is scheduled/triggered runs over accumulated data, not that the deadline is loose. |

---

## 8. Real-company examples

**Streaming — Uber (real-time surge pricing / ETA).** Ride and location
events are processed in near-real-time streaming pipelines so pricing
and ETAs reflect current conditions within seconds, not the next
scheduled batch run.

**Near real-time — a retail chain's point-of-sale pipeline.** Using
Amazon Data Firehose, sales transactions from thousands of stores are
buffered briefly and delivered to S3/Redshift automatically, giving
inventory dashboards data that's a minute or two stale — an acceptable
tradeoff for the operational simplicity of not running Kinesis
consumers.

**Batch — a healthcare provider's nightly claims processing.**
Insurance claims accumulate throughout the day and are processed once
overnight in a scheduled Glue/EMR batch job that joins against
reference data and produces the next morning's reconciliation reports —
no continuous infrastructure needed for a workload with a natural daily
cadence.

---

## 9. Practice questions (12)

**Q1.** A scenario requires transaction fraud scoring within 300ms and
the ability to replay the last 24 hours of events for model retraining.
Which pattern and service?

- A. Near real-time via Amazon Data Firehose — ✗ No replay capability at all; disqualified regardless of latency.
- B. **Streaming via Kinesis Data Streams (with retention enabled) — ✓** Sub-second latency and native replay via retention window both satisfied.
- C. Batch via nightly Glue job — ✗ Far too slow for a 300ms requirement.
- D. Near real-time via zero-ETL — ✗ Zero-ETL targets Redshift/OpenSearch replication, not sub-second event scoring with replay.

**Q2.** Clickstream events must land in S3 as Parquet with "the least
operational overhead" and up to 2 minutes of staleness is acceptable.
Best fit?

- A. Kinesis Data Streams with a custom Lambda consumer — ✗ Requires writing and operating consumer code; more overhead than needed.
- B. **Amazon Data Firehose — ✓** Fully managed buffering, format conversion, and delivery; matches "least operational overhead" and the latency tolerance exactly.
- C. Amazon MSK — ✗ Requires broker management; far more overhead than Firehose for a simple land-in-S3 use case.
- D. Batch Glue job every 24 hours — ✗ Doesn't meet the "within 2 minutes" implicit near-real-time expectation as well as Firehose.

**Q3.** A nightly 50GB file arrives from an on-prem system and must be
transformed and loaded by a fixed morning deadline. What pattern fits,
and why is continuous streaming infrastructure wrong here?

- A. Streaming, because data "flows" from on-prem — ✗ One file once a night is not a continuous flow; streaming infra would bill 24/7 for nothing.
- B. **Batch, via a scheduled/triggered Glue ETL job — ✓** Matches the actual cadence (once daily) and avoids paying for always-on streaming infrastructure.
- C. Near real-time via Firehose — ✗ Firehose is for continuous event delivery, not a single nightly file drop; adds no value here.
- D. Streaming via Managed Flink for windowed processing — ✗ There's no continuous stream or windowing need; this is a one-time nightly transform.

**Q4.** An application uses DynamoDB as its operational store and wants
near-real-time analytics in OpenSearch with no pipeline code and no
transformation needed. What should be used?

- A. DMS with CDC — ✗ Works but requires standing up and managing a replication instance; more than needed when zero-ETL directly supports this pairing.
- B. **Zero-ETL integration (DynamoDB → OpenSearch) — ✓** Purpose-built, no pipeline code, matches "no transformation needed."
- C. Glue Streaming ETL reading DynamoDB Streams — ✗ Requires writing and maintaining a streaming job; unnecessary given a direct zero-ETL pairing exists.
- D. Kinesis Data Streams fed by DynamoDB Streams — ✗ Adds infrastructure and code for a need zero-ETL already solves natively.

**Q5.** Which requirement, if added to a zero-ETL scenario, disqualifies
zero-ETL as the answer?

- A. "Replication lag under 5 minutes" — ✗ This is within zero-ETL's normal behavior, not a disqualifier.
- B. **"Filter out cancelled orders and enrich records with a lookup table during load" — ✓** Zero-ETL performs no transformation; any transform-during-load requirement disqualifies it.
- C. "Target is Amazon Redshift" — ✗ Redshift is a supported zero-ETL target, not a disqualifier.
- D. "Source is Aurora MySQL" — ✗ A supported zero-ETL source, not a disqualifier.

**Q6.** Why does Glue Streaming ETL cost more than expected for a
workload that only receives data during business hours?

- A. Glue Streaming charges a premium rate per DPU compared to batch — ✗ Not the real reason; the issue is billing duration, not rate.
- B. **Glue Streaming runs continuously and bills DPU-hours the entire time it's active, including idle periods overnight — ✓** Correct mechanism — continuous jobs bill continuously regardless of data flow.
- C. Streaming jobs require G.8X workers minimum — ✗ Not true; worker type is independently configurable.
- D. Glue Streaming re-processes the entire dataset on every micro-batch — ✗ Streaming uses checkpointing/incremental micro-batches, not full reprocessing.

**Q7.** A team needs multiple independent applications to each consume
the full stream of order events, with each app processing at its own
pace and needing to replay from the last hour if it crashes. Which
rules out Firehose specifically?

- A. Format conversion isn't available in Firehose — ✗ Firehose does support format conversion; not the relevant limitation here.
- B. **Firehose delivers to exactly one destination and has no replay/retention — ✓** Both "multiple independent consumers" and "replay" directly conflict with Firehose's architecture.
- C. Firehose can't write to S3 — ✗ S3 is Firehose's primary and most common destination.
- D. Firehose has a hard 24-hour retention limit that's too short — ✗ Wrong fact; Firehose has no retention/replay at all, not a 24-hour limit.

**Q8.** A batch ETL job processes only files that have arrived since
its last successful run, using Glue. What feature enables this
incremental behavior?

- A. Glue Streaming checkpoints — ✗ That's the streaming mechanism, not the batch one.
- B. **Glue job bookmarks — ✓** Track processed state between batch runs so only new data is processed.
- C. S3 Event Notifications — ✗ Trigger jobs but don't themselves track what's already been processed.
- D. Athena partition projection — ✗ A query-time optimization unrelated to ETL job state tracking.

**Q9.** A scenario says "the source is a self-managed Kafka cluster
already in production, and the team wants continuous low-latency
replication with the ability for multiple consumer groups to read
independently." What pattern and service?

- A. Near real-time via Amazon Data Firehose — ✗ Single destination, no consumer groups, no Kafka compatibility.
- B. **Streaming via Amazon MSK — ✓** Kafka-wire-compatible, supports multiple consumer groups, low latency, matches "existing Kafka" trigger phrase.
- C. Batch via scheduled Glue extract — ✗ Contradicts "continuous low-latency" requirement.
- D. Zero-ETL integration — ✗ Zero-ETL doesn't support self-managed Kafka as a source.

**Q10.** True or false: "near real-time" and "real-time" are
interchangeable phrases on the DEA-C01 exam.

- A. True — ✗ Incorrect; AWS uses them deliberately to point at different service families.
- B. **False — ✓** "Real-time"/"sub-second" points to Kinesis Data Streams/Flink; "near real-time" points to Firehose/zero-ETL. Treat them as distinct signals.
- C. True, both always mean sub-second — ✗ "Near real-time" specifically tolerates seconds-to-minutes, not sub-second.
- D. True, both always mean minutes-scale — ✗ "Real-time" specifically implies sub-second/millisecond, not minutes.

**Q11.** A workload ingests IoT sensor data continuously, 24/7, but the
analytics team only needs hourly aggregated summaries, not per-event
detail. What is the most cost-effective processing pattern?

- A. Streaming via Kinesis Data Streams with a Flink job computing hourly windows continuously — ✗ Works but keeps continuous streaming infrastructure running for a need that's really hourly, not per-event.
- B. **Near real-time landing via Firehose into S3, then a scheduled hourly batch job (Glue/Athena) to aggregate — ✓** Matches the actual need (hourly aggregates) at lower continuous-infrastructure cost than full streaming.
- C. Batch only, ingest raw files once a day — ✗ Doesn't match "continuously" arriving data or the need for hourly-level freshness.
- D. Zero-ETL integration from IoT Core to Redshift — ✗ Not a supported zero-ETL source/target pairing pattern for this use case.

**Q12.** Why is DMS with CDC generally categorized closer to
"near real-time/streaming" than to "batch," even though it isn't a
durable replayable log like Kinesis?

- A. DMS runs on a fixed nightly schedule — ✗ Incorrect; CDC mode runs continuously, not on a schedule.
- B. **DMS CDC continuously captures and applies changes with seconds of lag, unlike scheduled batch extracts — ✓** The continuous, low-latency nature is what places it in the near-real-time category despite lacking Kinesis's replay/multi-consumer properties.
- C. DMS stores all changes indefinitely for replay, like Kinesis — ✗ False; DMS is a replication mechanism, not a durable retained log.
- D. DMS requires Kinesis as an intermediate target, making it inherently streaming — ✗ DMS can target Kinesis/MSK, but that's optional, not a requirement of CDC mode.
