# Amazon Managed Service for Apache Flink

> **Currency note:** this service was formerly called "Kinesis Data
> Analytics." That name is retired — say **Amazon Managed Service for
> Apache Flink** on this exam. It is the stateful streaming compute
> engine for complex, event-time-aware stream processing: windowed
> aggregations, exactly-once semantics via checkpointing, and pattern/
> anomaly detection that outgrows what Lambda or a Glue Streaming job
> can reasonably do.

## CONTENTS

- [1. Explain like I'm 12](#eli12)
- [2. Explain technically](#technical)
- [3. Explain like a Senior AWS Data Engineer](#senior)
- [4. Production architecture](#architecture)
- [5. Windowing — tumbling, sliding, session](#windowing)
- [6. Exactly-once semantics via checkpointing](#checkpointing)
- [7. Stateful stream processing](#stateful)
- [8. Flink SQL vs. the DataStream API](#sqlvsapi)
- [9. Scaling — parallelism](#scaling)
- [10. When it wins over Lambda / Glue Streaming ETL](#whenitwins)
- [11. When to use / when NOT to use](#whentouse)
- [12. Advantages and limitations](#advlim)
- [13. Pricing](#pricing)
- [14. Performance, scaling, and high availability](#perfscale)
- [15. Security](#security)
- [16. Failure scenarios and common mistakes](#failures)
- [17. Exam traps](#examtraps)
- [18. Interview questions](#interview)
- [19. Cheat sheet](#cheatsheet)
- [20. Memory tricks](#mnemonics)
- [21. Practice questions (15)](#practice)

---

<a name="eli12"></a>
## 1. Explain like I'm 12

Imagine you're standing at the end of a conveyor belt that never stops,
with new toy parts flying by every second, and you need to answer
questions like "how many red parts went by in the last 5 minutes?" or
"did three broken parts go by in a row?" You can't wait for the belt to
stop — it never does — so you need a worker who **remembers** what
they've seen recently (that's called *state*), groups parts into
time buckets as they go by (*windows*), and — if the power flickers for
a second — picks up **exactly** where they left off instead of
double-counting or losing track. **Amazon Managed Service for Apache
Flink** is that worker: a managed system built specifically for doing
smart math over a never-ending stream of events, in real time, without
losing count even when something goes wrong.

<a name="technical"></a>
## 2. Explain technically

Amazon Managed Service for Apache Flink is a **fully managed runtime
for Apache Flink**, an open-source distributed stream-processing
framework, letting you run **stateful, event-time-aware** streaming
applications without provisioning or managing the underlying compute
cluster. Applications are written in **Flink SQL** (declarative,
SQL-like) or the **DataStream API** (Java/Python/Scala, imperative,
full programmatic control), consume from sources like **Amazon Data
Firehose**, **Amazon Managed Streaming for Apache Kafka (MSK)**, or a
Kinesis data stream, and write to sinks including S3, DynamoDB, Redshift,
OpenSearch, or another stream. Flink's defining architectural feature
is **state** — the ability to remember information across events
(running counts, aggregations-in-progress, the contents of an open
window) — combined with **event-time processing** (reasoning about
when an event actually *occurred*, not when it happened to arrive,
which matters when events arrive out of order or late) and
**checkpointing**, a periodic, consistent snapshot of that state to
durable storage that enables automatic, **exactly-once** recovery from
a failure.

<a name="senior"></a>
## 3. Explain like a Senior AWS Data Engineer

A senior engineer reaches for Managed Flink specifically when the
processing logic **can't be expressed as a stateless, per-record
transformation** — the moment a requirement involves "compare this
event to what happened in the last 5 minutes," "detect a pattern across
a sequence of events," or "compute a running aggregate that must
survive a failure without double-counting or losing data," Lambda and
simple Glue Streaming ETL jobs start to strain, because they aren't
purpose-built for **long-lived, checkpointed state**. The second
senior instinct: **event-time vs. processing-time is not academic** —
in a real system, network delays and retries mean events **arrive**
out of order relative to when they **occurred**; Flink's
**watermarks** (a mechanism for reasoning about "how late can an event
be before I give up waiting for it") are the tool that makes windowed
aggregations *correct* under real-world, imperfect delivery, not just
convenient. Third: a senior engineer picks **Flink SQL** by default for
standard windowed aggregations and joins (faster to write, easier to
review, closer to how a data engineer already thinks in SQL) and drops
down to the **DataStream API** only when the logic genuinely needs
custom state management, complex event patterns (Flink's CEP library),
or fine-grained control SQL can't express — not as a default starting
point.

<a name="architecture"></a>
## 4. Production architecture

```
   ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
   │  Amazon Data      │   │  Amazon MSK       │   │  Kinesis Data     │
   │  Firehose          │   │  (Kafka)            │   │  Streams            │
   │  (as a source)      │   │                       │   │                      │
   └────────┬───────┘   └────────┬───────┘   └────────┬───────┘
            └─────────────────────┼─────────────────────┘
                                  v
              ┌───────────────────────────────────────┐
              │   AMAZON MANAGED SERVICE FOR               │
              │   APACHE FLINK                                │
              │                                                  │
              │   Flink SQL  or  DataStream API                  │
              │   - Windowing (tumbling/sliding/session)          │
              │   - Stateful aggregation / pattern detection       │
              │   - Watermarks for event-time correctness           │
              │   - Checkpointing --> exactly-once recovery           │
              │   - Parallelism auto-scales with KPUs                  │
              └───────┬───────────────────┬───────────────────-─┘
                      │                   │
                      v                   v
            ┌──────────────┐    ┌──────────────────┐
            │  S3 (curated,   │    │  DynamoDB / Redshift │
            │  windowed         │    │  (low-latency            │
            │  aggregates)       │    │  results/alerts)          │
            └──────────────┘    └──────────────────┘
                                          │
                                          v
                                 EventBridge / SNS
                                 (anomaly alert, e.g.
                                  fraud detected)
```

Reading the diagram: **Amazon Data Firehose, MSK, or Kinesis Data
Streams** feed raw events into Managed Flink as the **source**.
Inside Flink, the application — written in **Flink SQL** or the
**DataStream API** — applies **windowing** (grouping events into time
buckets), maintains **state** (running aggregations, pattern-matching
progress), and uses **watermarks** to correctly handle events that
arrive late relative to when they occurred. **Checkpointing** runs
continuously in the background, snapshotting state so that a failure
mid-stream resumes exactly where processing left off, with
**exactly-once** semantics — no duplicate or dropped results. Output
flows to **S3** for curated, windowed aggregates feeding the lake, or
to **DynamoDB/Redshift** for low-latency serving of results, with a
common downstream pattern of firing an **EventBridge/SNS** alert the
moment a Flink application detects an anomaly (e.g., a fraud pattern)
in near-real time.

---

<a name="windowing"></a>
## 5. Windowing — tumbling, sliding, session

| Window type | Behavior | Example |
|---|---|---|
| **Tumbling** | Fixed-size, **non-overlapping**, back-to-back windows | "Total sales every 5 minutes" — each event belongs to exactly one window |
| **Sliding** | Fixed-size windows that **overlap**, advancing by a step smaller than the window size | "A 10-minute moving average, recalculated every 1 minute" — each event can belong to multiple overlapping windows |
| **Session** | Dynamic-length windows based on a **gap of inactivity** — the window closes when no new event arrives within the configured gap | "Group a user's clickstream into a single session, closing the session after 30 minutes of no activity" |

```
Tumbling (5-min):  [0-5min][5-10min][10-15min]         <- no overlap
Sliding (10-min window, 1-min slide):
   [0-10min]
     [1-11min]
       [2-12min] ...                                    <- overlapping
Session (30-min gap):  [event...event...event]  <gap>  [event...event]
                        one session                      new session
```

⚠️ **Exam trap:** "a moving average recalculated frequently, where each
event can influence multiple overlapping results" points to
**sliding windows**, not tumbling — tumbling windows produce exactly
one, non-overlapping result per window per event. "Group activity by
user session with a variable, inactivity-based boundary" is the
textbook trigger for **session windows** specifically — not a fixed
tumbling/sliding window, which assumes a known, fixed duration.

<a name="checkpointing"></a>
## 6. Exactly-once semantics via checkpointing

**Checkpointing** is Flink's mechanism for periodically taking a
**consistent, distributed snapshot** of an application's entire state
(all in-flight windows, aggregation values, source read positions) and
persisting it durably. If a task fails, Flink automatically restarts
from the **most recent successful checkpoint**, replaying only the
events since that point — this is what delivers **exactly-once
processing semantics**: no event is processed twice (no duplicate
counting) and no event is silently dropped, even across a mid-stream
failure and restart. Achieving true end-to-end exactly-once also
depends on the **sink** supporting it (e.g., writing idempotently or
transactionally) — Flink's checkpointing guarantees exactly-once
**processing** within Flink itself; the sink's own delivery guarantee
determines whether that extends all the way to "exactly-once written
to the destination."

⚠️ **Exam trap:** "our streaming aggregation must never double-count an
event, even if a node fails mid-processing" is the direct trigger for
**Flink's checkpointing-based exactly-once semantics** — this is a
capability Lambda's simpler at-least-once retry model does not provide
natively for stateful, multi-event aggregation.

<a name="stateful"></a>
## 7. Stateful stream processing

**State** is any information a Flink application retains **across**
multiple events — a running count, the set of items seen in an open
window, the last N events for pattern matching. This is the
fundamental capability that distinguishes Flink from a **stateless**
per-record transform (like a simple Lambda function that processes one
record at a time with no memory of prior records): a requirement like
"alert if the same account attempts 3 failed logins within 10
minutes" is inherently stateful — answering it requires remembering
prior events, not just reacting to the current one in isolation.
Flink manages state **automatically and durably** (backed by
checkpointing), scaling state alongside application parallelism,
which is precisely the operational burden a hand-rolled
stateful-Lambda-plus-DynamoDB workaround would otherwise have to
reimplement manually.

<a name="sqlvsapi"></a>
## 8. Flink SQL vs. the DataStream API

| | **Flink SQL** | **DataStream API** |
|---|---|---|
| Interface | Declarative SQL-like queries | Imperative code (Java, Python, Scala) |
| Learning curve | Lower — familiar to SQL-fluent data engineers | Higher — requires programming in a supported language |
| Best for | Standard windowed aggregations, joins, filters expressible in SQL | Custom state management, complex event pattern detection (CEP), fine-grained control SQL can't express |
| Iteration speed | Fast for common patterns | Slower to write, but unlimited flexibility |
| Exam favorite trigger | "SQL-based streaming analytics," "data analysts building streaming queries" | "custom complex event processing," "fine-grained control over state," "pattern detection across event sequences" |

**Senior default:** start with Flink SQL for anything expressible as a
windowed aggregation, join, or filter — it's faster to write, easier to
review, and closer to how most data engineers already think. Reach for
the **DataStream API** specifically when the logic needs custom state
objects, Flink's **CEP (Complex Event Processing)** library for
matching sequences of events against a defined pattern, or control SQL
genuinely cannot express.

<a name="scaling"></a>
## 9. Scaling — parallelism

Managed Flink applications scale via **parallelism** — the number of
parallel task instances processing the stream — measured in **Kinesis
Processing Units (KPUs)**, each KPU providing a fixed amount of compute
and memory. The service can be configured for **automatic scaling**,
adjusting parallelism (and therefore KPU count) based on observed
resource utilization (CPU, throughput), or run with a manually fixed
parallelism for predictable, steady workloads. Scaling parallelism
increases how many partitions/shards of the source stream can be
consumed and processed concurrently — the same underlying scaling
lever as Kinesis Data Streams' shard count or MSK's partition count on
the source side.

⚠️ **Exam trap:** parallelism/KPU scaling in Flink is analogous to,
but a **separate configuration** from, the source stream's own
shard/partition count — under-provisioned Flink parallelism can
bottleneck processing even if the source stream itself has ample
shard-level throughput, and vice versa; both need to be sized together.

<a name="whenitwins"></a>
## 10. When it wins over Lambda / Glue Streaming ETL

| Requirement in the scenario | Best fit |
|---|---|
| Simple, stateless per-record transformation (reformat, filter, enrich from a lookup) | **Lambda** — simpler, cheaper, no state/windowing needed |
| Batch-oriented micro-batch ETL with Spark-based transforms, some streaming support | **Glue Streaming ETL** — Spark Structured Streaming under the hood, good for moderate-complexity streaming ETL into the lake |
| Complex, stateful windowed aggregation (tumbling/sliding/session) over continuous events | **Managed Flink** |
| Anomaly/fraud detection requiring pattern matching across a sequence of events | **Managed Flink** (CEP via DataStream API) |
| Exactly-once semantics required for a stateful aggregation surviving node failure | **Managed Flink** (checkpointing) |
| Event-time processing with out-of-order/late-arriving events that must still be handled correctly | **Managed Flink** (watermarks) |

**The one-line rule:** if the processing logic needs to **remember**
something across events (state) and get the timing/correctness
guarantees right even under failure and out-of-order delivery, that's
Managed Flink. If each event can be handled **independently**, Lambda
(or Glue Streaming ETL for Spark-based, moderate-complexity streaming
transforms) is simpler, cheaper, and sufficient.

---

<a name="whentouse"></a>
## 11. When to use / when NOT to use

**Use Managed Flink when:** the workload requires stateful,
event-time-aware stream processing — windowed aggregations, session
tracking, complex event pattern detection, anomaly detection; exactly-
once processing semantics are a hard requirement; the team wants a
managed runtime for genuine Apache Flink applications (open-source
compatible, portable logic) rather than a proprietary streaming
abstraction.

**Do NOT use Managed Flink when:** each event can be processed
independently with no memory of prior events — a simple Lambda function
is cheaper and simpler; the workload is fundamentally batch, not
streaming — Glue ETL or EMR batch jobs fit better; the team has no
Flink/streaming expertise and the simpler alternative (Lambda, Glue
Streaming ETL) already meets the requirement without the added
conceptual overhead of windowing/state/watermarks.

<a name="advlim"></a>
## 12. Advantages and limitations

**Advantages:** fully managed Apache Flink runtime — no cluster
provisioning/patching; native support for tumbling/sliding/session
windowing; exactly-once semantics via automatic checkpointing;
event-time processing with watermarks handles out-of-order/late data
correctly; Flink SQL lowers the barrier for SQL-fluent engineers;
auto-scaling parallelism (KPUs) adapts to throughput; integrates
natively with Kinesis, MSK, Amazon Data Firehose, S3, DynamoDB,
Redshift.

**Limitations:** genuinely more conceptual overhead (state, windowing,
watermarks, checkpointing) than a stateless Lambda function; billing is
based on KPU-hours, which can exceed simpler alternatives' cost for
workloads that didn't actually need statefulness; requires some
Flink-specific expertise even in the managed form (writing correct
Flink SQL/DataStream logic is a real skill); not the right tool for
pure batch workloads.

<a name="pricing"></a>
## 13. Pricing

Managed Flink is billed per **KPU-hour** (Kinesis Processing Unit,
combining a fixed amount of compute and memory) consumed by the
running application, scaling with configured/auto-scaled parallelism,
plus a separate charge for the **application's durable state storage**
(checkpoint/state backend storage). There is no charge for idle
capacity beyond what's actively provisioned to run the application —
but unlike some serverless-per-invocation services, a Managed Flink
application is generally **continuously running** (it's a persistent
streaming job, not an event-triggered function), so cost accrues for
as long as the application runs, not per discrete invocation.

<a name="perfscale"></a>
## 14. Performance, scaling, and high availability

Performance and correctness both hinge on **parallelism sizing**
(KPUs) relative to source stream throughput, and on **checkpoint
interval** tuning (more frequent checkpoints reduce reprocessing time
after a failure but add overhead; less frequent checkpoints reduce
overhead but increase the amount of state to replay on recovery).
Scaling is automatic (optional) or manually configured parallelism.
High availability comes from Flink's own **automatic recovery from
checkpoints** — a failed task restarts and resumes from the last
successful checkpoint without manual intervention, and the managed
service itself runs across multiple Availability Zones within the
Region.

<a name="security"></a>
## 15. Security

Managed Flink applications run under an **IAM role** scoped to the
source stream(s) it reads from and the sink(s) it writes to (S3,
DynamoDB, Redshift, etc.) — the same "every service assumes its own
role" pattern as Glue, Lambda, and EMR. Application code and
checkpoint/state data can be encrypted at rest (KMS); data in transit
between Flink and its sources/sinks uses TLS. VPC deployment is
supported for applications that need to reach resources inside a
private VPC (e.g., an RDS database as an enrichment lookup source).

<a name="failures"></a>
## 16. Failure scenarios and common mistakes

- **Choosing Lambda for a genuinely stateful, windowed aggregation**
  requirement — Lambda has no native concept of a multi-event window or
  checkpointed state; the team ends up hand-rolling a fragile
  DynamoDB-based state workaround that Flink already solves natively.
- **Using tumbling windows when the requirement is really a moving,
  overlapping average** — produces non-overlapping, coarser results
  than intended; the fix is sliding windows.
- **Under-sizing parallelism (KPUs) relative to source stream
  throughput** — creates a processing bottleneck even though the
  source stream itself has ample shard/partition capacity.
- **Checkpoint interval set too infrequently** for the workload's
  failure-recovery tolerance — a failure forces replaying a large
  amount of state/events, increasing recovery time.
- **Assuming exactly-once processing automatically means exactly-once
  end-to-end delivery** — the sink itself must also support
  idempotent/transactional writes for the guarantee to hold all the
  way through to the destination.
- **Reaching for the DataStream API by default** when the logic is a
  standard windowed aggregation expressible in Flink SQL — adds
  unnecessary development complexity.

<a name="examtraps"></a>
## 17. Exam traps

⚠️ **"Kinesis Data Analytics" is retired terminology** — the exam-
correct name is **Amazon Managed Service for Apache Flink**. Don't be
thrown by older material or distractor options using the old name as
if it were still current and distinct.

⚠️ **Stateless, per-record logic = Lambda/Glue Streaming ETL, not
Flink.** Flink is the answer specifically when state, windowing, or
event-time correctness under out-of-order delivery is required — don't
over-select Flink for simple transform-and-forward scenarios.

⚠️ **Tumbling = non-overlapping, fixed. Sliding = overlapping, fixed
size with a smaller step. Session = variable length, gap-based.**
Confusing these three is the most common wrong-answer pattern on
windowing questions.

⚠️ **Exactly-once via checkpointing is a Flink-native capability that
a simple Lambda-based streaming pipeline does not provide out of the
box** for multi-event, stateful aggregation — this is often the
deciding factor between the two services in a scenario.

⚠️ **Flink SQL is not "less capable" than the DataStream API for the
common case** — it's the right *default* choice for standard windowed
aggregations; DataStream API is for genuinely custom/complex needs, not
a strictly "more powerful, always preferred" option.

<a name="interview"></a>
## 18. Interview questions

- *"When would you choose Managed Flink over a simple Lambda-based
  streaming pipeline?"* Strong answer: when the processing logic needs
  to remember information across multiple events — windowed
  aggregations, session tracking, pattern detection across a sequence —
  and when exactly-once processing semantics under failure are a hard
  requirement that a stateless Lambda function can't provide natively.
- *"Explain the difference between tumbling, sliding, and session
  windows, with an example of when you'd use each."* Strong answer:
  tumbling for fixed, non-overlapping periodic aggregates (e.g., sales
  every 5 minutes); sliding for a frequently-recalculated moving metric
  (e.g., a 10-minute moving average updated every minute); session for
  variable-length, activity-based grouping (e.g., a user's clickstream
  session, closed after a period of inactivity).
- *"How does Flink guarantee exactly-once processing, and does that
  guarantee extend all the way to the destination?"* Strong answer:
  via periodic, consistent checkpointing of all application state,
  enabling automatic recovery to the last successful checkpoint on
  failure with no duplication or loss within Flink itself; true
  end-to-end exactly-once additionally depends on the sink supporting
  idempotent or transactional writes.
- *"Why does event-time processing matter more than processing-time for
  many real-world streaming use cases?"* Strong answer: events often
  arrive out of order or delayed relative to when they actually
  occurred (network delays, retries, mobile connectivity gaps);
  event-time processing with watermarks lets windowed calculations
  reflect when things *actually happened*, producing correct results
  even when arrival order doesn't match occurrence order.

<a name="cheatsheet"></a>
## 19. Cheat sheet

| If the scenario says... | Reach for... |
|---|---|
| complex, stateful stream processing, windowed aggregation | Managed Flink |
| fixed, non-overlapping time buckets | Tumbling window |
| overlapping, frequently-recalculated moving metric | Sliding window |
| variable-length, gap/inactivity-based grouping | Session window |
| must never double-count under node failure | Checkpointing / exactly-once semantics |
| SQL-based streaming analytics, familiar syntax | Flink SQL |
| custom state / complex event pattern detection | DataStream API (+ CEP) |
| simple, stateless per-record transform | Lambda (not Flink) |
| moderate Spark-based streaming ETL into the lake | Glue Streaming ETL |
| out-of-order / late-arriving events must be handled correctly | Event-time processing + watermarks |
| scaling processing throughput | Parallelism / KPUs |
| "Kinesis Data Analytics" (old name) appears | Read as Amazon Managed Service for Apache Flink |

<a name="mnemonics"></a>
## 20. Memory tricks

**"Flink remembers, Lambda forgets."** The stateful-vs-stateless
boundary in one line. **"Tumbling never overlaps, sliding always
does, session never knows its own length until the gap says so."**
The three window types in order. **"Checkpoint now, replay less
later."** The tuning trade-off for checkpoint interval. **"SQL first,
DataStream when SQL runs out."** The default-to-Flink-SQL philosophy.

---

<a name="practice"></a>
## 21. Practice questions (15)

**Q1.** A fraud detection team needs to flag when the same account has
3 failed login attempts within any 10-minute period, using a streaming
pipeline that must not lose count even if a processing node fails
mid-stream. What is the best-fit service?

A) AWS Lambda with no state management
B) Amazon Managed Service for Apache Flink, using windowed, stateful aggregation with checkpointing
C) A Glue crawler scheduled every 10 minutes
D) Amazon Data Firehose alone

**Answer: B.** This requires stateful counting across events within a
time window, with failure-resilient exactly-once semantics —
precisely what Flink's checkpointing and windowing provide. (A) Lambda
alone has no native multi-event state/window concept. (C) a crawler
only infers schema metadata, it doesn't process streaming events. (D)
Firehose delivers/buffers data; it doesn't perform stateful
aggregation.

**Q2.** Which window type should be used to compute a 10-minute moving
average that is recalculated every minute, where each event can
contribute to multiple overlapping results?

A) Tumbling window
B) Sliding window
C) Session window
D) Global window with no boundaries

**Answer: B.** Sliding windows are fixed-size and overlapping,
advancing by a step smaller than the window size — exactly matching a
moving average recalculated more frequently than the window length.
(A) tumbling windows are non-overlapping, producing one distinct
window per period, not overlapping recalculation. (C) session windows
are gap/inactivity-based, not fixed-duration. (D) is not a standard
Flink window construct for this pattern.

**Q3.** Which mechanism allows a Managed Flink application to
automatically recover from a node failure without duplicating or
losing processed events?

A) DynamoDB Streams
B) Checkpointing, enabling exactly-once recovery to the last consistent snapshot
C) S3 versioning
D) A Glue job bookmark

**Answer: B.** Checkpointing is Flink's native mechanism for
consistent state snapshots enabling exactly-once recovery. (A)
DynamoDB Streams is an unrelated change-capture feature for DynamoDB
tables. (C) S3 versioning protects object history, unrelated to Flink
application state recovery. (D) Glue job bookmarks track processed
files/rows for Glue ETL jobs, a different mechanism for a different
service.

**Q4.** A data engineering team wants to group a user's clickstream
events into a single logical session that closes automatically after
30 minutes of inactivity, with no fixed session duration known in
advance. Which windowing approach fits?

A) Tumbling window, 30 minutes
B) Sliding window, 30-minute window with a 5-minute slide
C) Session window with a 30-minute inactivity gap
D) No windowing needed; process each event independently

**Answer: C.** Session windows are specifically designed for
variable-length grouping based on an inactivity gap. (A) a tumbling
window assumes a fixed period, not variable session length. (B)
sliding windows are also fixed-size, just overlapping — not what's
needed here. (D) processing events independently loses the required
session-grouping context entirely.

**Q5.** Which name is the currently correct, exam-relevant name for
the AWS service that provides a managed Apache Flink runtime for
stream processing?

A) Kinesis Data Analytics
B) Amazon Managed Service for Apache Flink
C) Amazon Data Analytics Streaming
D) AWS Flink Pipelines

**Answer: B.** This is the current, correct name — "Kinesis Data
Analytics" is retired terminology. (A) is the outdated name. (C) and
(D) are fabricated names not used by AWS.

**Q6.** A team needs to implement complex event pattern detection —
matching a specific sequence of events (e.g., login, then password
change, then large withdrawal, all within 15 minutes) — with
fine-grained custom logic beyond what standard SQL aggregation
expresses. What should they use within Managed Flink?

A) Flink SQL exclusively
B) The DataStream API, potentially with Flink's CEP (Complex Event Processing) capability
C) A tumbling window with a simple COUNT aggregation
D) AWS Step Functions instead of Flink entirely

**Answer: B.** Complex, custom event-sequence pattern matching is
exactly the DataStream API (and CEP) use case, beyond what declarative
SQL windowing alone expresses well. (A) Flink SQL is well-suited to
standard aggregations, not this level of custom sequence-pattern
logic. (C) a simple count doesn't capture ordered, multi-condition
pattern matching. (D) Step Functions orchestrates workflows; it isn't
built for continuous stream event-pattern detection.

**Q7.** What unit does AWS use to measure and bill compute/memory
capacity for a Managed Flink application?

A) DPU-hours
B) RPU-seconds
C) KPU-hours (Kinesis Processing Units)
D) vCPU-minutes

**Answer: C.** Managed Flink is billed per KPU-hour, combining a fixed
compute/memory allocation. (A) DPU-hours are a Glue billing unit. (B)
RPU-seconds are a Redshift Serverless billing unit. (D) vCPU-minutes
is not the actual billing unit used for this service.

**Q8.** Which statement correctly distinguishes event-time processing
from processing-time processing in a streaming context?

A) Event-time and processing-time always produce identical results
B) Event-time processing uses the timestamp of when an event actually occurred, correctly handling out-of-order/late arrivals via watermarks; processing-time uses the time the event is handled by the system
C) Processing-time is only available in Flink SQL, not the DataStream API
D) Event-time processing is unavailable in Managed Flink and only exists in self-managed Flink

**Answer: B.** This is the core distinction — event-time with
watermarks lets windowed results reflect actual occurrence order even
under network delay/out-of-order arrival; processing-time simply uses
arrival/handling time, which can produce different, less
"real-world-correct" results under delay. (A) is false — they can
diverge significantly under out-of-order delivery. (C) is a fabricated
restriction. (D) is false — Managed Flink fully supports event-time
processing.

**Q9.** A simple pipeline needs to reformat individual JSON events and
write them to S3, with no need to remember anything about prior
events. Which is the most cost-effective, appropriately-scoped choice?

A) Amazon Managed Service for Apache Flink with a stateful DataStream application
B) AWS Lambda, processing each record independently
C) A Flink SQL application with a 24-hour session window
D) EMR with a persistent long-running cluster

**Answer: B.** Stateless, per-record transformation is exactly
Lambda's sweet spot — simpler and cheaper than standing up a Flink
application for logic that needs no memory across events. (A) and (C)
introduce unnecessary statefulness/windowing overhead for a stateless
requirement. (D) a persistent EMR cluster is far heavier
infrastructure than this simple transform requires.

**Q10.** Which factor most directly determines a Managed Flink
application's processing throughput ceiling?

A) The AWS Region the application runs in
B) The configured/auto-scaled parallelism (KPUs), sized relative to the source stream's shard/partition throughput
C) The S3 storage class of the output bucket
D) The IAM policy attached to the application's role

**Answer: B.** Parallelism (KPU count) determines how much of the
source stream's throughput the application can consume and process
concurrently — under-sizing it bottlenecks processing even with ample
source throughput. (A) Region choice doesn't determine throughput
capacity. (C) storage class affects cost/retrieval characteristics of
output, not processing throughput. (D) IAM governs permissions, not
processing capacity.

**Q11.** True end-to-end exactly-once delivery from a Managed Flink
application to its sink additionally requires what?

A) Nothing further — Flink's checkpointing alone guarantees end-to-end exactly-once regardless of the sink
B) The sink itself must support idempotent or transactional writes
C) The source stream must be Amazon Data Firehose specifically
D) The application must use the DataStream API, not Flink SQL

**Answer: B.** Flink's checkpointing guarantees exactly-once
processing within Flink; extending that guarantee all the way to the
destination requires the sink to also support idempotent/transactional
writes. (A) overstates what checkpointing alone guarantees. (C) is a
fabricated source restriction unrelated to sink delivery guarantees.
(D) API choice (SQL vs. DataStream) doesn't determine the sink's
delivery guarantee.

**Q12.** Which scenario is the clearest fit for Flink SQL rather than
the DataStream API?

A) Implementing a fully custom state machine tracking dozens of
   interdependent variables per key
B) A standard 5-minute tumbling window computing SUM and COUNT aggregations grouped by product category
C) Matching an arbitrary, deeply nested sequence of business events using Flink's CEP library
D) Fine-grained control over exactly when and how state is serialized

**Answer: B.** Standard windowed SQL-style aggregations are exactly
Flink SQL's sweet spot — declarative, fast to write, easy to review.
(A), (C), and (D) all describe genuinely custom logic better suited to
the DataStream API's programmatic flexibility.

**Q13.** A streaming application reprocesses a large amount of state
after every failure, causing long recovery times. What configuration
change would most directly address this?

A) Increase the checkpoint interval (checkpoint less frequently)
B) Decrease the checkpoint interval (checkpoint more frequently)
C) Switch from Flink SQL to the DataStream API
D) Disable checkpointing entirely to reduce overhead

**Answer: B.** More frequent checkpoints reduce the amount of state
and events that must be replayed after a failure, shortening recovery
time (at the cost of more checkpointing overhead during normal
operation). (A) does the opposite — less frequent checkpoints mean
more to replay on failure. (C) API choice doesn't directly affect
checkpoint-driven recovery time. (D) disabling checkpointing removes
the exactly-once recovery guarantee entirely, making the problem far
worse, not better.

**Q14.** Which of these is a genuine advantage of Managed Flink over a
hand-rolled, Lambda-plus-DynamoDB approach to implementing windowed,
stateful stream aggregation?

A) Managed Flink requires no IAM permissions at all
B) Managed Flink natively provides windowing, state management, and checkpointed exactly-once recovery, which a hand-rolled Lambda/DynamoDB approach would have to reimplement manually and less reliably
C) Managed Flink is always cheaper than Lambda regardless of workload
D) Managed Flink eliminates the need for any source stream (Kinesis/MSK/Firehose)

**Answer: B.** This is the core value proposition — Flink provides
these capabilities as first-class, battle-tested features instead of
requiring custom, error-prone reimplementation. (A) is false — Flink
applications still require IAM roles/permissions. (C) is an
overgeneralization — cost depends on workload shape; stateless
workloads are often cheaper on Lambda. (D) is false — Flink still
requires a source stream to consume from.

**Q15.** A batch-only nightly job that transforms a static dataset in
S3 with no streaming or state requirements is being considered for
Managed Flink. What is the most accurate assessment?

A) Managed Flink is the correct and required tool for any data transformation on AWS
B) Managed Flink is a streaming-focused service; a purely batch, non-streaming transformation is better served by Glue ETL or EMR batch processing
C) Managed Flink cannot read from S3 under any circumstances
D) Managed Flink and Glue ETL are functionally identical and interchangeable for all workloads

**Answer: B.** Flink is purpose-built for stream processing with state
and windowing; a purely batch, non-streaming nightly transform doesn't
need any of that and is better served by Glue ETL or EMR. (A)
overstates Flink's applicability — it isn't a universal
transformation tool. (C) is false — Flink can read from S3, notably as
a sink/source in various configurations, but that's not the point
here. (D) is false — the two services target different processing
paradigms (streaming/stateful vs. batch/Spark-based ETL).
