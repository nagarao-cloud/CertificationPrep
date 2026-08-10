# Amazon Kinesis Data Streams

> Deep-reference file for **Kinesis Data Streams specifically** —
> Amazon Data Firehose and Amazon Managed Service for Apache Flink each
> have their own coverage elsewhere (Firehose is covered in
> `01-domains/DOMAIN-1-DATA-INGESTION.md`; Flink has its own file,
> `ManagedFlink.md`, in this folder). This file goes deep on Kinesis
> Data Streams internals: shard math, on-demand vs. provisioned mode,
> enhanced fan-out, retention, KCL, `IteratorAge`, the hot-shard
> problem, ordering guarantees, and producer paths. Primarily tested in
> **Domain 1 (Data Ingestion and Transformation, 34%)**, Task 1.1.

---

## CONTENTS

- [1. Explain like I'm 12](#step1)
- [2. Explain technically](#step2)
- [3. Explain like a Senior AWS Data Engineer](#step3)
- [4. Production architecture](#step4)
- [5. Per-service coverage checklist](#step5)
- [6. Exam traps](#step6)
- [7. Interview questions](#step7)
- [8. Cheat sheet](#step8)
- [9. Memory tricks](#step9)
- [10. Practice questions (15)](#step10)

---

<a name="step1"></a>
## 1. Explain like I'm 12

Picture a row of conveyor belts at a candy factory. Each belt (a
**shard**) can only carry so much candy per second before it jams — say,
1,000 pieces or 1 MB worth, whichever fills up first. If way more candy
arrives than one belt can handle, you add more belts side by side. Each
piece of candy has a little tag on it (a **partition key**) that decides
which belt it rides — same tag, same belt, every time, so candies with
the same tag always arrive in the order they were placed. At the end of
the belts, workers can grab candy off and inspect it, and — this is the
special part — the candy doesn't disappear the instant someone grabs it.
It stays on the belt for a while (**retention**, up to a full year) so
if a new worker shows up late, or an old worker wants to double-check
something from an hour ago, the candy is still right there to look at
again. That's Kinesis Data Streams: a bunch of ordered, replayable
conveyor belts for data that just showed up in real time.

<a name="step2"></a>
## 2. Explain technically

**Amazon Kinesis Data Streams (KDS)** is a durable, replayable,
real-time streaming data service. Data is organized into **shards**,
the base unit of both throughput and parallelism: each shard supports
**1 MB/sec or 1,000 records/sec ingoing (whichever limit is hit
first)**, and **2 MB/sec outgoing shared across standard consumers**
(or 2 MB/sec **per consumer** with Enhanced Fan-Out). Records are
written with a **partition key**, which KDS hashes to deterministically
route the record to a specific shard — this is what guarantees
**strict ordering within a partition key** (all records for the same
key land on the same shard, in write order) while allowing records
with different keys to be processed in parallel across shards. Unlike
Amazon Data Firehose (which buffers and delivers to exactly one
destination with no replay capability), KDS **retains data for a
configurable window — 24 hours by default, up to 365 days** — enabling
multiple independent consumers to read the same stream at their own
pace and enabling reprocessing after a downstream bug or outage. Two
capacity modes govern shard management: **provisioned** (you specify
and pay for a fixed shard count, and must reshard manually as volume
changes) and **on-demand** (Kinesis manages shard count automatically,
scaling to accommodate up to double the previous peak throughput within
roughly 15 minutes).

<a name="step3"></a>
## 3. Explain like a Senior AWS Data Engineer

A senior engineer's first move on any Kinesis Data Streams question is
to separate three things that get conflated: **throughput** (can the
stream absorb the write/read volume), **ordering** (does correctness
depend on strict per-key sequencing), and **replay** (does a downstream
failure or new consumer need to see historical data again). Kinesis is
the right tool specifically when **at least one** of those three is a
genuine, stated requirement — otherwise, Amazon Data Firehose (no
shard math, no replay, dramatically less to manage) is the lower-
overhead answer for simply "get this stream into S3." On capacity mode,
the senior default is **on-demand** unless the workload has a
**known, stable, predictable** throughput profile where manually
provisioned shards are meaningfully cheaper — on-demand removes the
single most error-prone piece of KDS operations (shard math done wrong
either throttles producers or wastes money on idle capacity). On fan-
out, the senior instinct is to watch for the phrase "multiple consumer
applications" and immediately compute whether standard consumers'
shared 2 MB/s per shard is enough — if there are three or more
consumers each needing meaningful throughput, **Enhanced Fan-Out (EFO)**
almost always becomes necessary, and the senior engineer states the
added cost explicitly rather than treating EFO as free. The most
important operational habit a senior engineer brings to any KDS
architecture is watching **`IteratorAge`** as the single signature
health metric — a rising `IteratorAge` means consumers are falling
behind producers, and the fix is never "restart the consumer" as a
first move; it's diagnosing *why* (a hot shard, an underpowered
consumer, a stuck poison record) before reshaping the architecture.

<a name="step4"></a>
## 4. Production architecture

```
   PRODUCERS                        KINESIS DATA STREAM                CONSUMERS
┌─────────────┐        PutRecord/PutRecords / KPL
│ Mobile app    │ ──┐
│ Web app       │ ──┤     ┌───────────────────────────────────┐
│ IoT devices   │ ──┼────▶│  SHARD 1  (partition keys A, D, G) │──┐
│ Backend svc   │ ──┘     ├───────────────────────────────────┤  │   Standard consumer:
└─────────────┘          │  SHARD 2  (partition keys B, E, H) │──┼──▶ shares 2 MB/s per
                          ├───────────────────────────────────┤  │   shard across ALL
                          │  SHARD 3  (partition keys C, F, I) │──┤   standard readers
                          └───────────────────────────────────┘  │
                          Each shard: 1 MB/s or 1,000 rec/s IN    │   GetRecords (KCL) →
                          Retention: 24 h default, up to 365 d    │   e.g. Lambda batch
                                                                   │   processor
                                                                   ▼
                          ┌───────────────────────────────────┐  ┌─────────────────┐
                          │   ENHANCED FAN-OUT (EFO) registered │  │ Fraud detection   │
                          │   consumers — each gets a DEDICATED │─▶│ (own 2 MB/s/shard)│
                          │   2 MB/s per shard, push-based (~70ms)│  └─────────────────┘
                          └───────────────────────────────────┘  ┌─────────────────┐
                                                                   │ Real-time         │─▶
                                                                   │ dashboard (own EFO)│
                                                                   └─────────────────┘
                                                                   ┌─────────────────┐
                                                                   │ Archival consumer │─▶ S3
                                                                   │ (own EFO)          │
                                                                   └─────────────────┘

  IteratorAge (CloudWatch metric): rising = consumer falling behind.
  If it climbs unbounded → hot shard, undersized consumer, or a
  poison record blocking progress on that shard.
```

**Reading the diagram, stage by stage:** producers write records via
**PutRecord** (one record per call), **PutRecords** (batched, higher
throughput per API call), or the **Kinesis Producer Library (KPL)**,
which adds client-side batching, compression, and automatic retry on
top of PutRecords for maximum producer-side efficiency. Every record
carries a **partition key**; Kinesis hashes that key to deterministically
assign the record to one of the stream's shards — records sharing a key
always land on the same shard, in the order they were written, which is
the entire mechanism behind Kinesis's ordering guarantee (**per
partition key, not globally across the stream**). Each shard
independently enforces the **1 MB/s or 1,000 records/s** ingest ceiling
— hitting either limit throttles further writes to that specific shard
(`WriteProvisionedThroughputExceeded`) even if other shards have spare
capacity, which is why a single very "hot" key (one customer ID
generating disproportionate traffic) can throttle writes to that key's
shard while the rest of the stream is fine — the **hot shard problem**.
On the read side, **standard consumers** (using GetRecords via the KCL,
or a Lambda event source mapping) **share 2 MB/s of read throughput per
shard across every standard consumer reading that shard** — with four
independent consumer applications all polling the same shard, that's
0.5 MB/s each in the worst case, which is rarely enough for anything
beyond light consumption. **Enhanced Fan-Out** solves this by having
Kinesis **push** data to each registered consumer over a dedicated
HTTP/2 connection, giving each EFO consumer its **own** 2 MB/s per shard
regardless of how many other consumers exist, at roughly 70ms latency
(versus ~200ms for standard polling) — at additional per-consumer,
per-shard cost. Wrapping the whole diagram, **`IteratorAge`** is the
metric a senior engineer watches first: it measures how far behind (in
milliseconds) a consumer's current read position is from the tip of the
stream — a healthy, caught-up consumer shows `IteratorAge` near zero; a
consumer that's falling behind shows it climbing, which is the earliest
and clearest signal that something downstream needs attention before
data starts approaching its retention-window expiry and is lost for
good.

<a name="step5"></a>
## 5. Per-service coverage checklist

### Purpose

Amazon Kinesis Data Streams is a **durable, ordered, replayable,
real-time streaming ingestion service**, purpose-built for scenarios
needing sub-second-to-low-second latency, strict per-key ordering,
multiple independent consumers, and the ability to reprocess historical
data within a configurable retention window.

### When to use

- **Real-time or near-real-time processing** with a genuine sub-second-
  to-few-second latency requirement (fraud detection, live metrics,
  anomaly detection feeding a downstream real-time system).
- **Multiple independent consumer applications** need to read the same
  stream, each at its own pace, for different purposes (analytics,
  archival, alerting, all reading the same events).
- **Replay / reprocessing** is a stated requirement — e.g., "if the
  downstream service is down for maintenance, no data should be lost,"
  or "must be able to reprocess the last 3 days after a bug fix."
- **Strict ordering per key** matters — e.g., all events for a single
  user, device, or order must be processed in the exact order they
  occurred.
- Custom, code-driven stream processing where you need full control
  over the consumer logic (via KCL, Lambda, or a custom application),
  rather than a purely managed delivery pipeline.

### When NOT to use

- **Simply landing a stream in S3/Redshift/OpenSearch with minimal
  code and no replay need** — Amazon Data Firehose is lower operational
  overhead and purpose-built for exactly that.
- **The team already runs Kafka and producers speak the Kafka wire
  protocol** — Kinesis is not Kafka-protocol-compatible; Amazon MSK is
  the correct answer when Kafka compatibility is a hard requirement.
- **Batch-shaped workloads with no genuine low-latency need** — polling
  an API hourly or processing a nightly file doesn't need a streaming
  service at all.
- **Sub-24-hour, single-table, implicit change feed** — DynamoDB
  Streams is purpose-built and simpler when the need is "react to
  changes on one DynamoDB table," not a general-purpose stream.

### Advantages

- **True replay** — up to 365 days of retention, letting new consumers
  or reprocessing jobs read historical data on demand.
- **Multiple independent consumers**, each with its own read position
  (checkpoint), reading the same data for different purposes without
  interfering with each other.
- **Strict per-partition-key ordering**, a guarantee neither Firehose
  nor most simple queueing systems provide.
- **On-demand mode** removes manual shard-management entirely for
  variable or unpredictable workloads.
- **Enhanced Fan-Out** removes the shared-throughput bottleneck for
  scenarios with several demanding consumers.
- Low latency: roughly 200ms for standard consumers, roughly 70ms with
  EFO.
- Integrates natively as a Lambda **event source**, removing the need
  to write a custom polling consumer for many use cases.

### Limitations

- **Per-shard throughput ceilings** (1 MB/s or 1,000 records/s in; 2
  MB/s out shared, or 2 MB/s per EFO consumer) mean throughput planning
  and shard math are unavoidable in provisioned mode.
- **Max record size is 1 MB.**
- **Hot shard problem** — a skewed partition-key distribution can
  throttle one shard while others sit idle, and simply adding shards
  doesn't fix it if the skew is in the key design itself.
- **On-demand mode's auto-scale-up is not instantaneous** — it can
  accommodate up to roughly double the previous peak within about 15
  minutes, not an unlimited instantaneous spike.
- **Ordering is per partition key, not global** — a common
  misunderstanding; there is no stream-wide total order across
  different keys.
- Requires either the **Kinesis Client Library (KCL)** or custom code
  to consume with proper checkpointing and shard-assignment handling —
  more consumer-side responsibility than Firehose's zero-code delivery.

### Pricing considerations

- **Provisioned mode**: billed per **shard-hour** plus a per-**PUT
  payload unit** charge (each unit = up to 25 KB) for data ingested —
  cost is predictable but requires correct shard sizing to avoid both
  throttling (under-provisioned) and wasted spend (over-provisioned).
- **On-demand mode**: billed per **GB ingested and retrieved**, plus a
  flat stream-hour charge — no shard-count decision required, but can
  cost more than well-tuned provisioned mode at very steady, predictable
  volume.
- **Extended retention** beyond the first 24 hours (up to 7 days, and
  beyond that to 365 days via long-term retention) adds storage cost.
- **Enhanced Fan-Out** adds a per-consumer, per-shard cost on top of
  base stream pricing — worth it only when multiple consumers genuinely
  need full independent throughput.
- **KPL/KCL themselves are free client libraries** — the cost is in
  the underlying stream usage they generate/consume, not the libraries.

### Performance

- Standard (polling) consumer latency: roughly 200ms from write to
  read availability.
- Enhanced Fan-Out consumer latency: roughly 70ms, because Kinesis
  pushes data to the consumer instead of the consumer polling.
- On-demand mode scales write capacity up to roughly double the prior
  peak within about 15 minutes of sustained increased load.

### Scaling

| Dimension | Mechanism |
|---|---|
| Write throughput | Add shards (provisioned mode: **resharding** — split/merge), or switch to on-demand for automatic scaling |
| Read throughput, single consumer | Bounded by 2 MB/s per shard (standard) |
| Read throughput, multiple consumers | Enhanced Fan-Out gives each registered consumer its own 2 MB/s per shard |
| Handling a hot key | Reshard (split the hot shard), or redesign the partition key to spread load more evenly (e.g., add a random suffix / composite key) |
| Retention window | Configurable 24 hours (default) up to 365 days |

### Security

- **IAM policies** control who can PutRecord/GetRecords and manage the
  stream (create, reshard, delete).
- **Encryption at rest** via **KMS** (server-side encryption, using
  either an AWS-managed or customer-managed key).
- **Encryption in transit** via TLS to the Kinesis API endpoint.
- **VPC endpoints (interface/PrivateLink)** allow producers/consumers
  inside a VPC to reach Kinesis without traversing the public internet.
- **Resource policies** and IAM condition keys can restrict actions to
  specific streams, consumers, or source IPs/VPCs.

### High availability

- Kinesis Data Streams is a **regional, managed service** — data is
  automatically replicated **synchronously across multiple
  Availability Zones** within the region; there is no customer-managed
  Multi-AZ configuration because it's built into the service by
  default.
- No single point of failure at the shard level from an AWS
  infrastructure standpoint — durability and availability are AWS's
  responsibility once data is acknowledged as written.
- **Cross-region resilience** is a customer-architected pattern (e.g.,
  producers dual-writing to streams in two regions, or a downstream
  process replicating processed output cross-region) — Kinesis Data
  Streams itself does not offer a native cross-region replication
  feature comparable to Aurora Global Database.

### Failure scenarios

| Scenario | Symptom | Fix |
|---|---|---|
| Consumer can't keep up with producer volume | `IteratorAge` climbing steadily | Scale out consumers (more Lambda concurrency / more KCL workers), or reshard for more parallelism, or use EFO if the bottleneck is shared read throughput |
| One partition key generates disproportionate traffic | One shard throttles (`WriteProvisionedThroughputExceeded`) while others are idle | Redesign the partition key (add randomness/composite key) to spread load; reshard won't fix a bad key design alone |
| A single malformed/poison record repeatedly fails processing | Consumer (esp. Lambda) retries the same batch forever, `IteratorAge` climbs unbounded on that shard | Configure `BisectBatchOnFunctionError` and an on-failure destination (SQS/SNS/DLQ) so poison records are set aside instead of blocking the shard |
| Multiple consumer apps compete for standard read throughput | Each consumer gets a fraction of 2 MB/s per shard, falls behind | Register consumers for **Enhanced Fan-Out** |
| Retention window expires before a slow consumer catches up | Data permanently lost for that consumer | Extend retention window, or fix the underlying consumer lag before it approaches the retention boundary |

### Common mistakes

- Assuming a stream-wide **total order** exists — ordering is only
  guaranteed **per partition key**, not across the whole stream.
- Choosing **provisioned mode with a guessed shard count** for a
  workload with unpredictable or spiky volume, causing either
  throttling or wasted spend — on-demand is usually the safer default
  absent a specific reason to hand-tune shards.
- Forgetting that **standard consumers share 2 MB/s per shard across
  all of them** — adding a third or fourth consumer application without
  considering EFO silently starves every consumer of throughput.
- Not handling **poison records**, letting one bad record block an
  entire shard's progress indefinitely via naive infinite retries.
- Treating Kinesis as Kafka-compatible — it is **not** wire-protocol
  compatible; existing Kafka producers cannot point at a Kinesis stream
  without being rewritten.
- Sizing shards using only the records-per-second number and
  forgetting to also check the MB/s number (or vice versa) — always
  take the **larger** of the two shard counts required.

### Exam traps

⚠️ **Shard math: always take the larger of the two limits.** A scenario
giving records/sec and average record size requires computing shard
count **both** ways (records/sec ÷ 1,000, and total MB/s ÷ 1) and
choosing the larger result — the trap answer is the smaller number from
whichever calculation the question emphasizes.

⚠️ **"Existing Kafka producers, cannot rewrite" rules out Kinesis.**
Kinesis Data Streams does not speak the Kafka protocol. If code cannot
change, Amazon MSK is the only correct answer among AWS-native
options.

⚠️ **Firehose has zero replay. Kinesis Data Streams has up to 365
days.** Any requirement combining "land data with least overhead" and
"must be able to reprocess/replay" disqualifies Firehose even though it
would otherwise be the lower-overhead default.

⚠️ **"Multiple consumer applications, each needs full throughput"
signals Enhanced Fan-Out**, not just "add more shards." Adding shards
increases total throughput but doesn't solve the *shared* 2 MB/s per
shard problem among standard consumers reading the *same* shard.

⚠️ **`IteratorAge` is the signature Kinesis health metric on this
exam.** Any scenario describing "consumers falling behind" or "data
processed with increasing delay" should trigger `IteratorAge` as the
metric to check — not a generic "check CloudWatch" answer.

⚠️ **On-demand mode's scale-up is not instant.** It accommodates
roughly double the previous peak within about 15 minutes — a scenario
describing an enormous, sudden, unprecedented spike (more than double
recent peak, arriving immediately) can still throttle briefly even in
on-demand mode.

<a name="step7"></a>
## 7. Interview questions

- *"Walk me through how you'd size shards for a stream ingesting 8,000
  records/sec at an average of 3 KB each."* Strong answer: by record
  count, 8,000 ÷ 1,000 = 8 shards; by throughput, 8,000 × 3 KB = 24
  MB/s ÷ 1 MB/s = 24 shards; take the larger, 24 shards — and note
  that on-demand mode would remove the need to compute or maintain this
  by hand.
- *"A consumer's `IteratorAge` is climbing steadily. Walk me through
  your diagnostic process."* Strong answer: first check whether it's
  isolated to one shard (suggesting a hot key or a poison record on
  that shard specifically) or across all shards (suggesting the
  consumer itself is underpowered or under-scaled); then check consumer
  concurrency/throughput limits; then check for a specific record
  repeatedly failing and blocking progress.
- *"Why would you choose Enhanced Fan-Out over just adding more
  shards?"* Strong answer: adding shards increases total stream
  capacity but doesn't change the fact that standard consumers *share*
  each shard's 2 MB/s read throughput — EFO is the fix specifically
  when the bottleneck is multiple consumers competing for the same
  shard's read bandwidth, not total ingest capacity.
- *"Explain Kinesis Data Streams' ordering guarantee precisely — what
  does it *not* guarantee?"* Strong answer: ordering is guaranteed only
  **within a single partition key** (records with the same key are
  processed in write order because they always land on the same
  shard); there is no guarantee of order **across different keys** or
  across the stream as a whole.
- *"How would you handle a 'poison record' that keeps crashing your
  Lambda consumer?"* Strong answer: configure `BisectBatchOnFunctionError`
  to narrow down to the specific failing record instead of retrying
  the whole batch, and configure an on-failure destination (SQS/SNS)
  so the poison record is set aside for later inspection instead of
  blocking the shard indefinitely.

<a name="step8"></a>
## 8. Cheat sheet

| If the scenario says... | Reach for... |
|---|---|
| real-time, sub-second, ordered per key | Kinesis Data Streams |
| multiple independent consumers, each needs full throughput | KDS + Enhanced Fan-Out |
| must be able to replay/reprocess historical events | KDS (retention up to 365 d) |
| unpredictable/spiky throughput, no shard management wanted | KDS on-demand mode |
| known, steady, predictable throughput, cost-sensitive | KDS provisioned mode (right-sized) |
| existing Kafka producers, protocol compatibility required | NOT KDS — Amazon MSK |
| just land it in S3/Redshift, no replay, least overhead | NOT KDS — Amazon Data Firehose |
| consumers falling behind | Check `IteratorAge` |
| one shard throttled, others idle | Hot shard — redesign partition key or reshard |
| poison record blocking a shard | `BisectBatchOnFunctionError` + DLQ/on-failure destination |
| producer needs batching/compression client-side | Kinesis Producer Library (KPL) |
| consumer needs managed checkpointing/shard assignment | Kinesis Client Library (KCL) |

### 14-column snapshot: Kinesis Data Streams vs. Amazon Data Firehose

| Column | Kinesis Data Streams | Amazon Data Firehose |
|---|---|---|
| Purpose | Durable, replayable real-time stream | Managed delivery to one destination |
| Speed | ~200 ms (~70 ms w/ EFO) | Buffered, ~60 s typical |
| Cost | Shard-hours + PUT units, or on-demand GB | Per GB ingested |
| Serverless | On-demand mode ≈ yes | ✅ Fully |
| Streaming support | ✅ Core purpose | ✅ Delivery only |
| Batch support | ❌ | ❌ |
| Data volume | 1 MB/s/shard in; on-demand scales automatically | Auto-scales |
| Latency | Real-time | Near real-time |
| Scaling | Reshard, or on-demand auto | Fully automatic |
| Monitoring | `IteratorAge`, `WriteProvisionedThroughputExceeded` | `DeliveryToS3.Success`, `ThrottledRecords` |
| Security | IAM, KMS, VPC endpoint | IAM, KMS, VPC endpoint |
| HA | Multi-AZ by default, regional service | Multi-AZ by default, regional service |
| Best use case | Multiple consumers, replay, strict ordering | Land raw events in S3/Redshift/OpenSearch, minimal code |
| When NOT to use | Just need data in S3, no replay need | Need replay, sub-second latency, or multiple full-throughput consumers |

<a name="step9"></a>
## 9. Memory tricks

**"1-1-2"** — **1** MB/s or **1**,000 records/s in per shard; **2**
MB/s out per shard (shared, or per-consumer with EFO).

**"Bigger number wins."** — when computing shard count both by
record-rate and by throughput, always take the larger result.

**"Order lives on the key, not the stream."** — ordering is guaranteed
per partition key, never stream-wide.

**"IteratorAge = the odometer of consumer lag."** — rising number,
falling behind; it's the first metric to check, every time.

**"Firehose forgets, Kinesis remembers."** — Firehose has zero replay;
Kinesis retains up to 365 days.

<a name="step10"></a>
## 10. Practice questions (15)

**Q1.** A stream must ingest 6,500 records/sec, with an average record
size of 1.5 KB. How many shards are required, at minimum, in
provisioned mode?

A) 7 shards (based on record count)
B) 10 shards (based on throughput: 6,500 × 1.5 KB ≈ 9.75 MB/s → round up)
C) 5 shards
D) 15 shards

**Answer: B.** By record count: 6,500 ÷ 1,000 = 6.5 → 7 shards. By
throughput: 6,500 × 1.5 KB ≈ 9,750 KB/s ≈ 9.5–10 MB/s ÷ 1 MB/s ≈ 10
shards. Taking the **larger** of the two results gives 10 shards.
**A** is the record-count-only calculation — the classic trap of using
only one of the two limits. **C** and **D** don't match either
calculation correctly.

**Q2.** A stream has 4 independent consumer applications, each needing
full 2 MB/s per-shard read throughput, reading from a 10-shard stream.
Using only standard consumers, what is the actual maximum throughput
each application can reliably expect per shard?

A) 2 MB/s each, since Kinesis provides that per shard by design
B) 0.5 MB/s each, since standard consumers share the shard's 2 MB/s read throughput across all of them
C) 8 MB/s each, since there are 4 consumers
D) Unlimited, because read throughput isn't capped

**Answer: B.** Standard (non-EFO) consumers share a shard's 2 MB/s read
throughput across all consumers reading that shard — with 4 competing
consumers, worst case is 2 ÷ 4 = 0.5 MB/s each. **A** describes what
Enhanced Fan-Out would provide, not standard consumption. **C** and
**D** are not how Kinesis throughput allocation works.

**Q3.** Given the situation in Q2, what change would let all 4
consumer applications each reliably get their own full 2 MB/s per
shard?

A) Add more shards to the stream
B) Switch all 4 consumers to Enhanced Fan-Out
C) Switch the stream to on-demand mode
D) Increase the stream's retention period

**Answer: B.** Enhanced Fan-Out gives each **registered** consumer its
own dedicated 2 MB/s per shard via a push-based connection, independent
of how many other consumers exist — directly solving the shared-
throughput bottleneck. **A** increases total stream capacity but
doesn't change the fact that each shard's read bandwidth is still
shared among standard consumers reading it. **C** changes write
capacity management, not the standard-consumer read-sharing behavior.
**D** affects how long data is retained, not read throughput
allocation.

**Q4.** A fraud-detection system built on Kinesis Data Streams uses
`customer_id` as the partition key. One extremely high-volume customer
(a large corporate account) generates far more traffic than any other
customer, causing that specific shard to throttle while other shards
sit nearly idle. What is happening, and what is the most effective
long-term fix?

A) This is normal behavior and requires no fix
B) This is the hot shard problem; adding more shards alone won't fix it — the partition key design needs to change (e.g., add randomness/composite key for that customer's records)
C) Switch to Amazon Data Firehose, which doesn't have this issue
D) Increase the retention period to 365 days

**Answer: B.** A single partition key generating disproportionate
traffic is the textbook hot shard problem — because all records for
that key land on one shard by design, simply adding shards elsewhere in
the stream doesn't relieve pressure on the hot key's shard. The
durable fix is redesigning the key (e.g., appending a random suffix or
using a composite key) to spread that customer's traffic across
multiple shards. **A** ignores a real throttling problem. **C**
sidesteps the question rather than fixing it, and Firehose doesn't
offer partition-key-based ordering at all, changing the architecture's
guarantees. **D** addresses retention, unrelated to the throttling
symptom.

**Q5.** A Lambda function consuming from a Kinesis Data Streams event
source mapping has been failing to process a specific record for
several hours; `IteratorAge` on that shard is climbing without bound,
while other shards remain healthy. What is most likely happening, and
what should be configured to prevent it going forward?

A) The stream is out of retention; increase the retention window
B) A poison record is blocking the shard because Lambda retries the whole batch on failure; configure `BisectBatchOnFunctionError` and an on-failure destination
C) The consumer needs Enhanced Fan-Out
D) The partition key design needs to change

**Answer: B.** A single shard with unbounded, climbing `IteratorAge`
while a Lambda consumer repeatedly fails is the classic poison-record
signature — Lambda's default behavior retries the entire batch
indefinitely on a persistent failure, blocking all progress on that
shard. `BisectBatchOnFunctionError` narrows retries down to isolate the
bad record, and an on-failure destination (SQS/SNS) lets it be set
aside instead of blocking forever. **A** is unrelated — retention
governs how long unread data survives, not consumer failure handling.
**C**, EFO, addresses shared-throughput contention, not a stuck poison
record. **D** addresses hot-shard throttling, a different symptom than
a stuck, failing consumer.

**Q6.** Which capacity mode should a team choose for a brand-new stream
whose traffic pattern is completely unknown and expected to be highly
variable week to week, with a strong preference to avoid manual shard
management?

A) Provisioned mode, sized conservatively low to start
B) Provisioned mode, sized conservatively high to start
C) On-demand mode
D) Amazon Data Firehose, since shard management is never needed there

**Answer: C.** On-demand mode is purpose-built for unknown or highly
variable throughput, automatically managing shard count without
requiring the team to guess and repeatedly resize. **A** risks
throttling if traffic exceeds the conservative estimate. **B** wastes
money on unused provisioned capacity. **D** changes the architecture
entirely (no replay, single destination) rather than addressing the
stated shard-management concern within Kinesis Data Streams itself —
not a valid substitute if KDS's other properties (replay, multiple
consumers, ordering) are still needed.

**Q7.** A team's existing on-prem application produces events using
native Apache Kafka producer libraries and cannot be modified due to a
vendor support contract. The team wants to move this event stream into
AWS with the least code change. What should they use?

A) Kinesis Data Streams, since it's AWS's flagship streaming service
B) Amazon MSK, since it is wire-protocol compatible with Kafka
C) Amazon Data Firehose
D) Amazon Managed Service for Apache Flink

**Answer: B.** MSK is the only AWS-native streaming option that speaks
the actual Kafka wire protocol, allowing existing, unmodified Kafka
producers to connect directly. **A** is the classic trap — Kinesis
Data Streams does not support the Kafka protocol despite being AWS's
primary streaming service; producers would need to be rewritten. **C**
is a delivery service, not a Kafka-protocol-compatible ingestion point.
**D** is a stream *processing* engine, not an ingestion endpoint for
producers.

**Q8.** An analytics team needs to reprocess the last 5 days of raw
clickstream events after discovering a bug in their transformation
logic that has been silently corrupting derived metrics since data
started flowing. The raw events were only ever sent to Amazon Data
Firehose, which delivered them to S3 with no other copy retained. Can
the team replay the last 5 days directly from Firehose?

A) Yes, Firehose retains up to 7 days by default
B) No — Firehose has no replay capability at all; however, since Firehose already delivered the raw events to S3, the team can reprocess directly from the S3 objects instead
C) Yes, by re-registering an Enhanced Fan-Out consumer on the Firehose delivery stream
D) No, and the data cannot be recovered under any circumstances

**Answer: B.** Firehose itself has zero replay capability — once
delivered, there's no "go back and re-read" option on the delivery
stream. However, because Firehose already wrote the raw events durably
to S3, the team isn't actually stuck: they can reprocess from the S3
objects directly, which functions as their replay mechanism in this
specific case (this is *why* keeping an immutable raw zone in S3 is
best practice, as covered in Domain 1). **A** and **C** both
incorrectly attribute Kinesis Data Streams replay/EFO features to
Firehose, which doesn't have them. **D** is overly pessimistic — the
S3 raw copy is recoverable.

**Q9.** Which statement about Kinesis Data Streams ordering is
accurate?

A) All records in the stream are processed in strict global order regardless of partition key
B) Records are only ordered within a given partition key, because all records sharing a key are routed to the same shard
C) Ordering is only guaranteed when Enhanced Fan-Out is enabled
D) Kinesis Data Streams provides no ordering guarantees under any configuration

**Answer: B.** Ordering is guaranteed **per partition key** — since a
given key's records always hash to the same shard and shards process
records in write order, that specific key's history stays in order.
There's no global, stream-wide order across different keys. **A**
overstates the guarantee. **C** is false — ordering behavior is
identical for standard and EFO consumers; EFO only changes delivery
throughput/latency, not ordering semantics. **D** understates the
actual (per-key) guarantee that does exist.

**Q10.** A team is producing a very high volume of small records
(hundreds of bytes each) to Kinesis Data Streams and wants to reduce
API call overhead and improve producer-side throughput efficiency.
What should they use?

A) Individual PutRecord calls for every record
B) The Kinesis Producer Library (KPL), which batches and compresses records client-side
C) Increase the number of shards without changing producer behavior
D) Amazon Data Firehose's built-in batching

**Answer: B.** The KPL is purpose-built to batch multiple small records
into fewer, larger API calls (via PutRecords under the hood) and
supports client-side compression, meaningfully reducing per-record API
overhead for high-volume, small-record producers. **A** is the
inefficient baseline the team wants to move away from. **C** doesn't
address producer-side call efficiency at all — it only affects total
stream capacity. **D** is describing a different service; the scenario
is explicitly about Kinesis Data Streams producers.

**Q11.** A consumer application built with the Kinesis Client Library
(KCL) needs to track which records it has already successfully
processed, so that if the application restarts, it resumes from the
correct position rather than reprocessing everything or skipping data.
What KCL concept handles this?

A) Enhanced Fan-Out
B) Checkpointing
C) Resharding
D) On-demand mode

**Answer: B.** Checkpointing is the KCL mechanism that records how far
a consumer has progressed through each shard, so a restarted or
newly-launched worker resumes from the last checkpoint instead of
reprocessing from the beginning or losing its place. **A** governs
read-throughput allocation, not consumer position tracking. **C**
governs shard count changes, unrelated to progress tracking. **D**
governs write-capacity management.

**Q12.** A scenario states: "Events must be available for a downstream
fraud model within 2 seconds, data must never be lost even if the
model service is offline for scheduled maintenance for up to 6 hours,
and there is only one part-time engineer to operate this pipeline."
Which configuration best satisfies all three constraints?

A) Amazon Data Firehose with a 60-second buffer
B) Kinesis Data Streams in on-demand mode, with retention extended beyond the default 24 hours to comfortably exceed the 6-hour maintenance window
C) Kinesis Data Streams in provisioned mode, manually sized and resharded as needed
D) Amazon MSK provisioned cluster, self-managed broker sizing

**Answer: B.** The 2-second requirement rules out Firehose's ~60-second
buffer (option A). The "must never be lost during 6 hours of downstream
downtime" requirement needs retention/replay — satisfied by KDS's
retention window (well within the 24-hour default, so no extension is
even strictly required, but on-demand mode is chosen specifically to
minimize the one part-time engineer's operational burden). **C**
technically could work but adds manual shard-sizing burden that
conflicts with "one part-time engineer." **D**, MSK, adds broker
management overhead inappropriate for a one-person team with no stated
Kafka requirement.

**Q13.** Which of the following correctly describes Kinesis Data
Streams' maximum data retention capability?

A) A fixed 24 hours, with no way to extend it
B) Up to 7 days maximum
C) Configurable from 24 hours (default) up to 365 days
D) Unlimited retention, similar to S3

**Answer: C.** Kinesis Data Streams supports configurable retention
from the 24-hour default up to 365 days (extended/long-term retention),
at additional cost for the extended period. **A** understates the
configurability. **B** understates the maximum. **D** overstates it —
retention is bounded, not unlimited like S3 object storage.

**Q14.** A monitoring dashboard shows `WriteProvisionedThroughputExceeded`
rising on a specific shard while overall stream-wide throughput is
well under total provisioned capacity. What is the most likely
explanation?

A) The stream needs Enhanced Fan-Out
B) A hot shard — traffic is unevenly distributed across partition keys, overloading one specific shard even though aggregate capacity is sufficient
C) The consumer application is under-provisioned
D) The stream's retention period has been exceeded

**Answer: B.** `WriteProvisionedThroughputExceeded` on one shard while
total stream throughput is fine is the textbook hot-shard signature —
uneven partition-key distribution is overwhelming one shard's 1 MB/s or
1,000 records/s ceiling even though other shards have headroom. **A**,
EFO, is a read-side (consumer) feature and has no effect on write-side
throttling. **C** describes a consumer-side symptom (`IteratorAge`),
not this write-side throttling metric. **D** is unrelated to write
throttling.

**Q15.** A company wants to migrate a workload from Amazon Data
Firehose to Kinesis Data Streams because they've realized they need
(a) the ability to replay the last 48 hours of events after downstream
failures, and (b) three separate consumer applications, each needing
guaranteed full read throughput. Which two Kinesis Data Streams
features directly satisfy these two new requirements, respectively?

A) On-demand mode; provisioned mode
B) Retention window (set beyond 24 hours if needed, or the 24-hour default already covers this); Enhanced Fan-Out for the three consumers
C) KPL; KCL
D) Resharding; checkpointing

**Answer: B.** The 48-hour replay requirement is satisfied by KDS's
configurable **retention window** (the default 24 hours would need to
be extended to cover 48 hours, or configured explicitly to a longer
period). The "three consumers, each needing guaranteed full
throughput" requirement is satisfied by registering each as an
**Enhanced Fan-Out** consumer, giving each its own dedicated 2 MB/s per
shard. **A** describes capacity modes, which govern write scaling, not
replay or multi-consumer throughput. **C** describes producer/consumer
libraries, not the specific features needed here. **D** describes
shard-count management and consumer position tracking, neither of
which directly satisfies "replay 48 hours" or "three consumers, full
throughput each."
