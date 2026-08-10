# Streaming Pipeline Architecture

> The real-time counterpart to `Batch-Pipeline.md`. Streaming output
> commonly lands in the same bronze zone described in `Data-Lake.md`/
> `Lakehouse.md`, and a Managed Flink consumer merging continuously into
> an Iceberg gold table is the streaming half of the lakehouse pattern
> referenced in `Lakehouse.md`'s "EMR/Flink → writes back into
> silver/gold" arrow. `CDC.md` also produces stream-shaped output (DMS
> targeting Kinesis/MSK) that can feed directly into the patterns in
> this file.

## The shape of every streaming pipeline on this exam

A producer emits events continuously. Something durable and ordered
holds those events so multiple things can read them independently
without blocking each other. One or more consumers process the events
— either simply (route/transform one at a time) or with real
computation (windowed aggregation, joins, stateful logic) — and write
results to a sink. The exam tests whether you pick the right stream
backbone, the right consumer type, and understand the delivery/ordering
guarantees each piece actually provides (versus what it's often
assumed to provide).

---

## The reference architecture

```
                    STREAMING PIPELINE — REFERENCE ARCHITECTURE
                    ==============================================

  PRODUCERS
  (app servers, IoT devices, DMS CDC stream, DynamoDB Streams events)
        |
        v
  +---------------------------------------------------------------+
  |         STREAM BACKBONE — Kinesis Data Streams  (or MSK)         |
  |   Ordered per partition key / Kafka partition. Retention          |
  |   window (24h-365d) allows independent, replayable consumers.     |
  +---------------------------------------------------------------+
        |                    |                       |
        |  enhanced          |  enhanced              |  shared
        |  fan-out            |  fan-out                |  throughput
        v                    v                       v
  +-----------+       +---------------+       +----------------+
  | CONSUMER A |       |  CONSUMER B    |       |  CONSUMER C     |
  | Lambda      |       |  Managed Flink |       |  Amazon Data     |
  | (event source|      |  (stateful,     |       |  Firehose         |
  |  mapping,     |      |   windowed      |       |  (buffer + auto-  |
  |  per-shard,    |     |   aggregation,   |       |   deliver, near-  |
  |  batch size,    |    |   checkpointed   |       |   real-time, no   |
  |  bisect-on-error)|   |   for exactly-   |       |   consumer code)  |
  +-----------+       |   once-ish sink)|       +----------------+
        |               +---------------+                |
        v                      |                          v
  +-----------+                v                    +----------------+
  | DynamoDB   |         +----------------+          |  S3 (bronze —   |
  | (idempotent |        |  S3 / OpenSearch|          |  raw event       |
  |  conditional |       |  (windowed       |          |  archive, batched|
  |  writes)      |      |   aggregates,     |          |  every ~60s)     |
  +-----------+          |   search index)   |          +----------------+
                          +----------------+
```

**Reading every arrow:**

- **Producers → Stream backbone.** Whatever emits events — application
  servers, IoT devices via IoT Core, or a CDC-shaped source (DMS
  targeting Kinesis/MSK per `CDC.md`, or a DynamoDB Streams-driven
  Lambda republishing to Kinesis) — writes into **Kinesis Data Streams**
  or **MSK**, chosen per the Domain 1 reflex: Kinesis by default,
  MSK specifically when the team already runs Kafka or needs
  Kafka-wire-compatible tooling.
- **Stream backbone retains events** for a configurable window (24
  hours to 365 days for Kinesis), which is the feature that makes
  **multiple independent consumers** possible — each consumer tracks
  its own read position, so one consumer being slow or being restarted
  doesn't affect another, and any consumer can **replay** recent
  history if it needs to reprocess.
- **Stream → Consumer A (Lambda) via enhanced fan-out.** Lambda's Kinesis
  event source mapping polls (or, with enhanced fan-out, receives
  pushed) records per shard, in configurable batch sizes, and can run
  multiple batches in parallel per shard (parallelization factor).
  Lambda here is the "simple, per-record processing" consumer —
  enrichment, routing, writing to a low-latency sink like DynamoDB.
- **Stream → Consumer B (Managed Flink) via enhanced fan-out.** Flink is
  the **stateful** consumer: windowed aggregation (tumbling/sliding
  windows), joins across streams, and — critically — **checkpointing**,
  which is what lets Flink recover from failure and resume processing
  without losing or (with a transactional sink) duplicating state, the
  closest this stack gets to genuine exactly-once semantics end to end.
- **Stream → Consumer C (Firehose) via shared throughput.** Firehose
  is not a "processing" consumer in the same sense as Lambda/Flink —
  it's a **fully managed buffer-and-deliver** mechanism: no consumer
  code, no shard-level polling to manage, buffers records for a
  configurable interval (commonly up to ~60 seconds, hence "near-real-
  time" rather than "real-time"), optionally transforms via an inline
  Lambda, and delivers batches to S3 (or Redshift, OpenSearch, HTTP
  endpoints, third-party destinations).
- **Enhanced fan-out vs. shared throughput (the arrows' labels
  matter).** Each **enhanced fan-out** consumer gets its own dedicated
  2 MB/sec-per-shard throughput, independent of other consumers — this
  is what lets Consumer A and Consumer B both read the *full* stream at
  full speed without contending with each other. Consumers sharing the
  **classic/shared** throughput model instead split a single 2
  MB/sec-per-shard budget across however many consumers are reading
  that way — fine for one or two light consumers, a bottleneck once
  several consumers need full throughput simultaneously. Firehose,
  notably, does not compete for enhanced fan-out slots the way custom
  consumers do — it has its own dedicated read path into the stream.
- **Lambda → DynamoDB (idempotent conditional writes).** Because
  Lambda's event source mapping delivers **at-least-once**, the write
  into DynamoDB must be idempotent — typically a conditional write
  keyed on an event ID, so redelivery of the same record doesn't
  double-apply its effect.
- **Flink → S3/OpenSearch.** Flink's windowed aggregates or enriched
  events land in whichever sink fits the consumer — S3 for
  further analytics (feeding into the lakehouse gold layer per
  `Lakehouse.md`), OpenSearch for search/log-analytics use cases.
- **Firehose → S3 bronze.** This is the "near-real-time variant"
  explicitly called out in this file's scope: instead of a Lambda/KCL
  consumer writing individual records to S3 (operationally heavier, and
  usually unnecessary), Firehose handles batching, format conversion
  (e.g., JSON → Parquet), and dynamic partitioning inline, landing
  ready-to-query files directly in bronze with no consumer code to
  write or maintain.

---

## Service-by-service rationale, with runner-up alternatives

### Stream backbone: Kinesis Data Streams vs. MSK vs. Firehose (as a backbone, not just a sink)

| | **Kinesis Data Streams** | **MSK** | **Firehose** |
|---|---|---|---|
| Multiple independent consumers, replay | ✅ | ✅ | ❌ — exactly one destination, no replay |
| Ordering guarantee | Per partition key / shard | Per Kafka partition | N/A — delivery only |
| Existing Kafka investment | Not applicable | ✅ the reason to choose it | Not applicable |
| Consumer code required | Yes (Lambda/KCL/Flink) | Yes | No — fully managed delivery |
| Exam signal | "Real-time," "sub-second," "multiple consumers," "replay" | "Existing Kafka," "Kafka APIs," "lift-and-shift Kafka cluster" | "Least operational overhead," "near-real-time," "just land it in S3" |

**Runner-up worth naming: EventBridge Pipes.** For simple
point-to-point stream-to-target routing (no real transformation logic,
just "take records from this stream and put them on that target," with
optional lightweight filtering/enrichment) EventBridge Pipes can
replace a small hand-written Lambda consumer — a legitimate lower-code
alternative to Consumer A above when the logic really is that simple.

### Consumer: Lambda vs. Managed Flink vs. KCL-based custom consumers

| | **Lambda** | **Managed Service for Apache Flink** | **KCL on EC2/ECS (custom)** |
|---|---|---|---|
| Best for | Per-record processing, enrichment, routing, simple business logic | Stateful windowed aggregation, joins across streams, sub-second exactly-once-ish pipelines | Full control over consumer behavior, custom checkpointing logic, workloads that don't fit Lambda's execution model |
| State across records | ❌ stateless per invocation (state must live externally, e.g., DynamoDB) | ✅ built-in, checkpointed | Depends entirely on what you build |
| Delivery semantics achievable | At-least-once; correctness requires idempotent writes | Can achieve effectively-exactly-once end-to-end with checkpointing + transactional sink | Whatever you implement — more work, more control |
| Operational overhead | Very low | Low (managed service) but requires understanding Flink concepts (windows, checkpoints, watermarks) | High — you own scaling, checkpointing, failure recovery |

### Near-real-time variant: Firehose instead of a raw consumer

When the actual requirement is **"get this stream into S3 (or
Redshift/OpenSearch) reliably, with minimal operational code, and a
delivery delay of up to roughly a minute is acceptable,"** Firehose
replaces the entire Consumer + Sink pairing shown for Consumer A/B
above with a single managed service. This is a distinct and common
architecture in its own right — not a lesser version of the Lambda/
Flink path, but the correct default whenever the scenario doesn't
actually need sub-second processing or complex stateful logic.

---

## Exactly-once vs. at-least-once — the tradeoffs

- **Kinesis and MSK both provide at-least-once delivery** to
  consumers by default. A shard/partition rebalance, a consumer
  restart, or a checkpoint that lags slightly behind actual processing
  can all cause the same record to be delivered again.
- **Lambda consumers inherit at-least-once** and must be designed
  idempotently (conditional writes keyed on an event ID, as shown in
  the diagram) — there is no way to make a plain Lambda-based Kinesis
  consumer truly exactly-once on its own.
- **Managed Flink can achieve effectively-exactly-once end to end**,
  but only through the combination of **checkpointing** (Flink's
  internal state is snapshotted consistently) **and a transactional or
  idempotent sink** (e.g., a Kafka transactional producer, or an
  idempotent S3/database write) — the exactly-once property is a
  property of the *whole pipeline design*, not something Flink grants
  automatically just by being used.
- **Firehose does not offer exactly-once semantics** — it's a
  best-effort, retry-with-backoff delivery mechanism; duplicates are
  possible on retry, which is generally acceptable for its use case
  (bulk landing in S3 for later batch analytics) but matters if a
  scenario claims strict exactly-once delivery is required alongside a
  Firehose-based design.
- **The exam-relevant conclusion:** "exactly-once" as a hard
  requirement should make you look specifically for **Flink with
  checkpointing and a transactional/idempotent sink**, or for
  application-level idempotency layered on top of an at-least-once
  mechanism — never assume Kinesis, MSK, Lambda, or Firehose alone
  provide it.

---

## Backpressure and throttling

- **`ProvisionedThroughputExceededException`** on Kinesis means a
  shard's write or read throughput limit (1 MB/sec write, 2 MB/sec read
  per shard in the classic model) has been exceeded — the fix is
  **resharding** (splitting hot shards) or switching to **on-demand
  capacity mode**, which scales shard count automatically based on
  observed traffic.
- **Hot shard skew** happens when a partition key distributes unevenly
  (e.g., partitioning by a low-cardinality customer tier instead of
  customer ID) — one shard gets throttled while others sit idle;
  choosing a higher-cardinality, evenly-distributed partition key is
  the fix, not just adding more shards.
- **Lambda concurrency limits** can throttle a Kinesis-triggered
  Lambda consumer independently of the stream itself — reserved
  concurrency and the parallelization factor setting need to be sized
  to actual throughput needs.
- **MSK partition scaling** works similarly to Kinesis resharding —
  more partitions allow more parallel consumers, but partitions can
  only be increased, never decreased, on an existing topic.
- **Firehose auto-scales its buffer/delivery** without the caller
  needing to manage shard-level concerns at all — this operational
  simplicity is a major part of its appeal for the near-real-time
  variant.

## Scaling considerations

- **Shard/partition count** is the primary scaling lever for both
  Kinesis and MSK — sized to peak expected throughput, with headroom
  for bursts, or delegated to on-demand mode for unpredictable traffic.
- **Enhanced fan-out consumer count** — each registered fan-out
  consumer gets its own dedicated throughput, but there's a per-shard
  limit on the number of registered fan-out consumers; a design with
  many independent consumers needing full throughput should evaluate
  whether some can share throughput or be consolidated.
- **Flink parallelism** (task slots) scales processing capacity
  independently of shard count, up to the point where shard count
  itself becomes the bottleneck for how much data can be read in
  parallel.
- **Firehose scales transparently** — no explicit shard-equivalent
  concept for the caller to manage.

## Failure scenarios and tolerance

| Failure | Effect | Mitigation |
|---|---|---|
| Hot shard from skewed partition key | That shard throttles while others are idle; growing `IteratorAge` on that shard | Choose a higher-cardinality partition key; monitor per-shard metrics, not just aggregate |
| Consumer falls behind (growing `IteratorAge`) | Processing lag grows; in the worst case, records age out of the retention window before being read | Scale consumer concurrency/parallelism; extend retention as a buffer, not a permanent fix |
| Lambda batch contains one malformed "poison pill" record | Without bisect-on-error, the whole batch retries repeatedly and blocks progress on all records after it | Enable bisect-on-error batch splitting and configure a destination for failed records (DLQ) so one bad record doesn't halt the shard |
| Flink checkpoint fails | Job restarts from the last successful checkpoint, reprocessing since then — effectively at-least-once in practice during recovery, not lost data | Tune checkpoint interval to balance recovery-window size against checkpointing overhead |
| Firehose destination (S3/Redshift) is unreachable or throttled | Firehose retries per its configured retry duration, then can be configured to fail over to an S3 backup bucket for undelivered records | Configure and monitor the S3 backup/error-output prefix; alert on `DeliveryToS3.Success` dropping |
| Duplicate delivery reaches an unprotected sink | Double-counted aggregates, duplicate rows | Idempotent writes (conditional DynamoDB writes, upsert/merge patterns) everywhere at-least-once delivery is in play |

## Cost drivers

- **Kinesis**: shard-hours plus PUT payload units (billed per 25 KB
  chunk written); enhanced fan-out adds a per-consumer, per-shard
  charge on top.
- **MSK**: broker instance-hours plus storage; provisioned mode charges
  for capacity whether or not it's fully used, which is why "steady,
  predictable" workloads suit it better than bursty ones.
- **Firehose**: charged per GB ingested — compressing before ingest
  directly reduces this.
- **Lambda**: invocation count plus duration — a very "chatty" small-
  batch configuration can cost more than a well-tuned larger-batch-size
  configuration processing the same total volume.
- **Managed Flink**: KPU-hours (Kinesis Processing Units), scaling with
  configured parallelism — right-sizing parallelism to actual
  throughput avoids paying for idle processing capacity.

## Exam traps

⚠️ **"Multiple independent consumers need full throughput"** is the
enhanced fan-out signal — the shared-throughput model becomes a
bottleneck once more than one or two consumers need full read speed
simultaneously.

⚠️ **"Least operational overhead, just land it in S3"** → **Firehose**,
not a hand-written Lambda/KCL consumer writing to S3 — this exact
phrase pattern is called out in the Service Selection Matrix and
repeats constantly across streaming scenarios.

⚠️ **"Ordering guaranteed"** only ever means **per partition key /
shard (Kinesis) or per partition (MSK)** — never global ordering across
the whole stream. An answer implying global ordering across all
partition keys is wrong.

⚠️ **"Exactly-once" claimed for a plain Kinesis+Lambda design** is a
trap — that combination is at-least-once; true (or effectively)
exactly-once needs Flink with checkpointing and a transactional/
idempotent sink, or explicit idempotency built into the consumer.

⚠️ **Firehose is not a replayable, multi-consumer backbone** — if a
scenario needs multiple independent consumers or the ability to
replay recent history, Firehose alone (with no underlying Kinesis
stream) is the wrong building block; it has exactly one destination and
no replay capability of its own.

⚠️ **A hot shard "fixed" by just adding more shards without changing
the partition key** doesn't actually fix skew — the new shards will be
just as unevenly loaded if the partition key itself is low-cardinality.

## Real enterprise example

A ride-share company streams GPS pings from every active driver's app
into a single Kinesis Data Stream, partitioned by driver ID (a
high-cardinality key chosen specifically to avoid hot-shard skew — an
earlier version partitioned by city and suffered exactly the skew
problem described above during rush hour in the largest markets).
**Consumer A**, a Managed Flink application with enhanced fan-out,
computes rolling ETA windows per active trip and writes results to
DynamoDB for the rider-facing app to read with single-digit-millisecond
latency. **Consumer B**, a Firehose delivery stream also reading the
same source stream at full independent throughput, buffers raw pings
for about 60 seconds and lands them as Parquet in the S3 bronze zone
for later batch analytics and model training — no consumer code
written or maintained for this second path at all. Both consumers read
the exact same underlying events, entirely independently, at full
throughput, because of enhanced fan-out — a design that would have
required careful throughput budgeting under the shared-throughput
model.

---

## Practice questions

**1. A stream needs to support three independent consumers, each
reading the full volume of events at full speed, without one consumer's
load affecting another's read throughput. What Kinesis feature is
required?**

A) Increasing the retention period
B) Enhanced fan-out, registered per consumer — **correct**
C) Switching to Firehose
D) Using a single consumer that fans out internally to three downstream
Lambda functions

*B is correct — enhanced fan-out is specifically designed to give each
registered consumer dedicated per-shard throughput, exactly matching
this requirement. A affects how long data is retained, not concurrent
read throughput. C removes the multi-consumer/replay capability
entirely — Firehose has exactly one destination. D introduces an
unnecessary extra hop and single point of contention rather than using
the native multi-consumer feature.*

**2. A team wants raw clickstream events landed in S3 as Parquet, with
minimal operational code, and can tolerate delivery delays of up to
about a minute. What is the best-fit design?**

A) A Lambda function triggered by Kinesis, writing each record
individually to S3
B) Amazon Data Firehose reading from the stream, with format conversion
to Parquet and dynamic partitioning configured inline — **correct**
C) A KCL-based consumer running on a fleet of EC2 instances
D) Managed Service for Apache Flink with a custom S3 sink connector

*B is correct — this is precisely the "near-real-time, least
operational overhead" Firehose signal: no consumer code, built-in
format conversion, and the stated ~60-second tolerance matches
Firehose's buffering model exactly. A creates the small-files problem
and requires writing/maintaining consumer code Firehose would replace.
C and D both introduce more operational overhead than the requirement
justifies.*

**3. A Kinesis-triggered Lambda consumer is repeatedly retrying the
same batch of records because one record in the batch is malformed and
throws an exception during processing. What should be configured to
prevent this from blocking all other records in that shard?**

A) Increase the Lambda's memory allocation
B) Enable bisect-on-error batch splitting and configure a failure
destination for records that ultimately fail, so the poison-pill record
doesn't block the rest of the batch indefinitely — **correct**
C) Delete and recreate the Kinesis stream
D) Switch the partition key

*B is correct — this is the exact poison-pill failure mode and
mitigation described in this file's Failure scenarios table. A doesn't
address a logic error in processing one record. C is drastic and loses
all stream data/state. D addresses shard distribution, not batch-level
error handling.*

**4. A scenario states a pipeline must guarantee exactly-once
processing end to end, including no duplicate writes to the sink even
after a consumer restart. Which design actually satisfies this, versus
one that only appears to?**

A) Kinesis Data Streams with a Lambda consumer — at-least-once by
default, satisfies the requirement as-is
B) Managed Service for Apache Flink with checkpointing enabled and a
transactional or idempotent sink — **correct**
C) Amazon Data Firehose delivering to S3
D) Any Kinesis consumer, since Kinesis guarantees exactly-once
internally

*B is correct — this is the only combination in this file's Exactly-
once section that can actually achieve the property, and only because
checkpointing and sink transactionality/idempotency work together. A
is the at-least-once trap explicitly called out. C offers no
exactly-once guarantee. D is a flatly false claim about Kinesis's
delivery semantics.*

**5. A Kinesis stream partitioned by a three-value "region" field
(east/west/central) shows one shard consistently throttling while the
other two sit nearly idle. What is the root cause, and what fixes it?**

A) The stream needs more retention
B) Low-cardinality partition key causing hot-shard skew; repartition by
a higher-cardinality key (e.g., device or session ID) rather than
simply adding more shards — **correct**
C) Enhanced fan-out needs to be enabled
D) The consumer's Lambda memory is too low

*B is correct — this is the exact hot-shard-skew scenario and fix
described in the Backpressure section: the partition key itself, not
shard count or consumer configuration, is the root cause. A doesn't
affect throughput distribution. C affects consumer read throughput
allocation, not the underlying write-side skew. D is unrelated to a
partition-key distribution problem.*

**6. A company already operates a large on-prem Kafka cluster and wants
to migrate producers and consumers to AWS with minimal code changes to
existing Kafka client applications. What is the best-fit stream
backbone?**

A) Kinesis Data Streams, since it's the AWS-native option
B) Amazon MSK, because it's Kafka-wire-compatible and supports
lift-and-shift of existing Kafka producer/consumer code — **correct**
C) Amazon Data Firehose
D) DynamoDB Streams

*B is correct — "existing Kafka," "minimal code changes to Kafka
clients" is the direct MSK signal from both this file and the Domain 1
matrix. A would require rewriting Kafka-protocol clients to use the
Kinesis API, contradicting "minimal code changes." C is a delivery
service, not a Kafka-compatible backbone. D is unrelated — it's
DynamoDB's own internal change stream, not a general-purpose Kafka
replacement.*

**7. A Lambda consumer processing Kinesis records writes aggregated
totals to DynamoDB using plain `PutItem` calls (no conditional
expression). During a consumer restart, some records are redelivered.
What is the consequence, and what should have been done instead?**

A) No consequence — Lambda guarantees each record is processed exactly
once
B) The redelivered records are double-counted in the aggregate; the
write should instead use an idempotent, conditional write keyed on a
unique event ID — **correct**
C) DynamoDB automatically deduplicates identical writes
D) This can only be fixed by switching to Managed Flink

*B is correct — this is precisely the at-least-once-delivery-requires-
idempotent-writes point made throughout this file; a non-idempotent
`PutItem` aggregate write is exactly the wrong pattern here. A is the
false assumption this question is testing against. C is not how
DynamoDB works — it has no built-in semantic deduplication of
arbitrary writes. D is one valid fix among several (idempotent writes
on the existing Lambda path also solve it) — it's not the only path
forward.*

**8. A design uses Firehose as the sole ingestion path for a use case
that later turns out to need three independent consumers, each
replaying the last 24 hours of events on demand for reprocessing. Is
Firehose still the right backbone?**

A) Yes, Firehose supports unlimited consumers and full replay
B) No — Firehose has exactly one destination and no replay capability;
the backbone should be Kinesis Data Streams (or MSK) with the
appropriate retention window, and Firehose can remain as one of
multiple consumers off that stream if still useful — **correct**
C) Yes, as long as retention is increased on the Firehose delivery
stream
D) No — this requirement can only be met by DynamoDB Streams

*B is correct — this matches the explicit exam trap in this file:
Firehose is not a replayable, multi-consumer backbone. The fix is to
put a proper stream (Kinesis/MSK) underneath, with Firehose as one
consumer of it if S3 delivery is still needed. A and C both
misattribute replay/multi-consumer capability to Firehose, which it
doesn't have. D is unrelated — DynamoDB Streams applies to DynamoDB
table changes specifically, not general-purpose multi-consumer
replay for an arbitrary event stream.*

**9. A Managed Flink application's checkpoint fails during a
transient network issue. What happens to in-flight processing, and is
data lost?**

A) All unprocessed data is permanently lost
B) The job restarts from the last successful checkpoint and
reprocesses events since then — no data is lost, though some events may
be reprocessed (effectively at-least-once during recovery) — **correct**
C) The stream automatically deletes the affected records
D) Flink requires the entire pipeline to be manually redeployed

*B is correct — this is exactly how Flink's checkpoint-based recovery
model works, as described in the Failure scenarios table: recovery
resumes from the last good checkpoint, which may reprocess (not lose)
some events. A misdescribes checkpointing's entire purpose. C is not a
real behavior — Flink checkpoint failures don't delete source data. D
overstates the operational burden — recovery is automatic, not a
manual redeploy.*

**10. A scenario requires low-code, point-to-point routing of records
from a Kinesis stream to a target service, with only light filtering —
no stateful processing, no windowed aggregation. Writing a full Lambda
function feels like more code than the requirement needs. What is a
lighter-weight alternative worth considering?**

A) Managed Service for Apache Flink
B) EventBridge Pipes, for simple stream-to-target routing with optional
lightweight filtering/enrichment, without hand-written consumer code —
**correct**
C) A KCL-based custom consumer on EC2
D) AWS DMS

*B is correct — this is the runner-up alternative explicitly named in
this file's Service-by-service section for exactly this "simple
routing, no real transform logic" case. A brings unnecessary stateful-
processing machinery to a stateless routing problem. C is more
operational overhead than the requirement justifies. D is a database
migration/CDC service, unrelated to stream-to-target routing.*
