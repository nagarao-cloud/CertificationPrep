# Kinesis Data Streams vs Amazon MSK

> Both are durable, replayable, real-time streaming services — which is
> exactly why the exam likes to pit them against each other. This file
> isolates the one question that actually decides between them:
> **does Kafka already exist somewhere in this story?**

---

## 1. ELI12

Both services are basically the same idea: a conveyor belt of numbered
boxes that multiple people can watch and rewind. The difference is
which *rulebook* the conveyor belt follows.

**Kinesis Data Streams** is AWS's own, purpose-built conveyor belt.
It's simple to bolt onto other AWS services, and AWS operates every
gear and bolt of it — you never see the machinery, just shards.

**Amazon MSK** is a conveyor belt built to run the exact same
blueprints as **Apache Kafka**, the open-source standard used by
thousands of companies outside AWS. If a company already has workers
(producers/consumers) trained on the Kafka rulebook — Kafka client
libraries, Kafka Connect connectors, Kafka Streams applications — MSK
lets them keep using that exact rulebook while AWS manages the physical
brokers underneath. Rip out Kinesis and drop in Kafka-speaking code,
and none of it works without a rewrite — that's the whole reason MSK
exists.

**The exam's one-line filter:** if the scenario says "Kafka" anywhere —
existing Kafka cluster, Kafka Connect, Kafka Streams, "Kafka APIs" —
the answer is MSK. If it doesn't, and there's no other AWS-ecosystem
reason to avoid it, Kinesis Data Streams is the default, simpler,
lower-ops choice.

---

## 2. Comparison matrix

| Attribute | **Kinesis Data Streams** | **Amazon MSK** |
|---|---|---|
| **Purpose** | AWS-native durable, replayable stream | Managed, Kafka-wire-compatible streaming platform |
| **Protocol / API compatibility** | AWS proprietary API (SDK/KPL/KCL) | ✅ **Full Apache Kafka wire-protocol compatibility** — existing Kafka clients work unmodified |
| **Latency** | ~200ms typical; ~70ms with Enhanced Fan-Out | ~10ms typical |
| **Cost model** | Shard-hours + PUT payload units (25KB), or on-demand GB-based | Broker-hours + storage (provisioned); or cluster + partition-hours (**MSK Serverless**) |
| **Serverless option** | ✅ On-demand mode | ✅ MSK Serverless |
| **Ops burden (provisioned)** | Medium — shard splitting/merging | **Highest** of the two — broker patching, partition rebalancing, Kafka version upgrades, unless Serverless |
| **Scaling** | Shard split/merge (manual) or on-demand auto-scale | Add brokers/partitions (provisioned) or automatic (Serverless) |
| **Retention / replay** | ✅ 24 hours default, extendable to **365 days** | ✅ Configurable, plus **tiered storage** for long, cheap retention |
| **Ordering** | Per shard, via partition key | Per Kafka partition |
| **Consumers** | Many consumer apps; 2MB/s shared per shard standard, or **2MB/s per consumer with Enhanced Fan-Out** | Many independent **consumer groups** — Kafka's native model |
| **Delivery semantics** | At-least-once | Configurable — Kafka's rich semantics (at-least-once, effectively exactly-once with idempotent producers/transactions) |
| **Ecosystem tooling** | AWS SDKs, KPL/KCL, Lambda/Firehose/Glue integrations | **Kafka Connect** (MSK Connect), Kafka Streams, ksqlDB, Schema Registry, the entire existing Kafka tooling ecosystem |
| **Transformation** | Consumer code, or Managed Flink downstream | Consumers, MSK Connect, or Managed Flink downstream |
| **Migration story** | N/A — you build on Kinesis from scratch | ✅ **Lift-and-shift** for a self-managed Kafka cluster — minimal producer/consumer code changes |
| **Monitoring** | `IteratorAge`, `WriteProvisionedThroughputExceeded` | Consumer lag, `UnderReplicatedPartitions`, broker-level JMX metrics via CloudWatch |
| **Security** | IAM, KMS, VPC endpoint | IAM / SASL-SCRAM / mTLS, runs inside your VPC directly (broker-level network control) |
| **Best use case** | New AWS-native streaming apps; simplest ops for teams without Kafka investment | Existing Kafka workloads; teams needing Kafka-specific tooling (Kafka Connect, ksqlDB, Kafka Streams); multi-cloud/portable architectures |
| **When NOT to use** | Team has deep existing Kafka tooling/skills investment | No existing Kafka investment and a simpler, more AWS-native option (Kinesis) would do the job with less ops overhead |
| **Exam favorite** | "real-time," "multiple consumers," "replay," generic streaming needs | **"existing Kafka," "Kafka APIs," "migrating a self-managed Kafka cluster," "Kafka Connect connectors"** |

---

## 3. Decision tree

```
┌───────────────────────────────────────────────────────────────┐
│ START: Does the scenario mention Kafka anywhere — an existing   │
│ Kafka cluster, Kafka Connect, Kafka Streams, ksqlDB, or          │
│ "Kafka-compatible APIs" as a requirement?                        │
└───────────────────────────────┬──────────────────────────────┘
                                 │
                ┌─────────────────┴─────────────────┐
               YES                                   NO
                │                                     │
          ┌─────▼─────┐                Is portability/multi-cloud
          │    MSK    │                Kafka-standard compatibility
          │(the only  │                an EXPLICIT requirement, even
          │ Kafka-wire│                without an existing Kafka
          │ compatible│                deployment?
          │ option)   │                             │
          └───────────┘                ┌──────────────┴──────────────┐
                                       YES                            NO
                                        │                              │
                                  ┌──────▼──────┐        ┌──────────────▼──────────────┐
                                  │     MSK     │        │   KINESIS DATA STREAMS       │
                                  │ (standard-  │        │  (simpler ops, deepest AWS   │
                                  │  based, no  │        │   service integration,       │
                                  │  vendor     │        │   default choice absent a    │
                                  │  lock-in)   │        │   Kafka-specific reason)      │
                                  └─────────────┘        └────────────────────────────────┘
```

---

## 4. Worked scenarios

**Scenario A — A company is migrating a self-managed, on-prem Kafka
cluster to AWS. Producers and consumers use Kafka client libraries, and
several Kafka Connect connectors sync data to downstream systems.**
*Winner: MSK.* This is the textbook trigger — "existing Kafka" +
"Kafka Connect" together make MSK the only realistic option; rewriting
onto Kinesis would mean replacing every producer, consumer, and
connector.

**Scenario B — A greenfield startup is building a new order-processing
pipeline from scratch on AWS, needs multiple consumers (fulfillment,
analytics, fraud detection) to read the same event stream, and wants
the lowest possible operational overhead.** *Winner: Kinesis Data
Streams.* No existing Kafka investment, no Kafka-specific tooling need
— Kinesis's tighter native integration with Lambda, Firehose, and
Managed Flink, plus simpler operational model (especially in on-demand
mode), makes it the lower-overhead default.

**Scenario C — A financial services firm needs exactly-once processing
semantics with Kafka Streams-based stateful stream processing
applications they've already built and tested extensively over several
years.** *Winner: MSK.* Kafka Streams applications are Kafka-API-native
code; MSK lets them run largely unmodified, whereas porting them to
Kinesis would mean rewriting the entire processing layer.

**Scenario D — A team wants very low operational overhead streaming
ingestion with no Kafka requirement, but needs retention up to a full
year for compliance replay requirements.** *Winner: Kinesis Data
Streams (on-demand mode), with extended retention up to 365 days.* No
Kafka signal in the scenario, and Kinesis's extended retention setting
directly satisfies the year-long replay requirement without the
operational overhead of running/tuning Kafka brokers.

---

## 5. Exam traps

| Trap | The correction |
|---|---|
| **Assuming MSK is always "more powerful" and therefore preferred** | Power isn't the deciding factor — both are full-featured, durable, replayable streams. Absent a Kafka signal, Kinesis wins on operational simplicity, which the exam consistently favors ("least operational overhead"). |
| **Missing "Kafka Connect" as a Kafka signal** | Candidates fixate on "Kafka cluster" as the only trigger phrase and miss "Kafka Connect connectors," "Kafka Streams," or "ksqlDB" — all of which are equally strong MSK signals. |
| **Assuming Kinesis can run Kafka client code unmodified** | It cannot — Kinesis uses its own API (SDK/KPL/KCL). Only MSK is wire-protocol compatible with Kafka clients. |
| **Forgetting MSK Serverless exists** | Candidates sometimes assume MSK always requires broker management. MSK Serverless removes most of that ops burden — if the scenario wants "existing Kafka APIs" AND "least operational overhead," MSK Serverless (not provisioned MSK) is the precise answer. |
| **Confusing retention limits** | Kinesis: up to 365 days (extended retention). MSK: configurable retention plus **tiered storage** for very long, cost-effective retention at scale — don't assume one has a hard advantage over the other; both support long retention, via different mechanisms. |
| **Ignoring cost/ops tradeoff in "cheapest" framing** | MSK provisioned often costs more in operational overhead (patching, partition management, Kafka version upgrades) even if raw infrastructure cost is comparable — "cheapest" scenarios without a Kafka requirement usually favor Kinesis when total cost of ownership (including ops) is considered. |
| **Treating enhanced fan-out as MSK-only or Kinesis-only** | Enhanced Fan-Out is a **Kinesis Data Streams** feature (2MB/s dedicated throughput per consumer). MSK's equivalent is simply Kafka's native consumer-group model, which doesn't have an identical "fan-out" branded feature — don't cross-apply the term. |

---

## 6. Real-company examples

**Kinesis side — a ride-sharing app's real-time trip-event pipeline.**
Built natively on AWS with no prior Kafka investment, using Kinesis
Data Streams to fan out ride events to fraud detection, pricing, and
analytics consumers simultaneously, each processing independently with
Enhanced Fan-Out for guaranteed per-consumer throughput.

**MSK side — a large financial institution migrating from on-prem
Kafka.** Years of Kafka Streams applications, Kafka Connect
connectors syncing to multiple downstream systems, and deep
operational Kafka expertise made MSK the only realistic lift-and-shift
path — rewriting onto a different streaming API would have meant
months of re-engineering business-critical, already-proven applications.

---

## 7. Practice questions (12)

**Q1.** A company is migrating an on-prem Kafka cluster with several
Kafka Connect connectors already configured. Which AWS service should
they use?

- A. Kinesis Data Streams — ✗ Not Kafka-wire-compatible; connectors and client code would need to be rewritten.
- B. **Amazon MSK — ✓** Kafka-wire-compatible, supports Kafka Connect (via MSK Connect) directly.
- C. Amazon Data Firehose — ✗ A delivery service, not a Kafka-compatible streaming platform.
- D. Managed Service for Apache Flink — ✗ A stream *processing* engine, not a message broker/streaming platform.

**Q2.** A greenfield startup needs multiple independent consumers
reading the same event stream with the lowest possible operational
overhead, and has no existing Kafka investment. Best fit?

- A. **Kinesis Data Streams (on-demand mode) — ✓** No Kafka requirement present; Kinesis offers simpler native AWS integration and lower ops burden.
- B. Amazon MSK provisioned — ✗ Higher operational overhead (broker management) without any Kafka-specific requirement to justify it.
- C. Amazon MSK Serverless — ✗ Reduces ops burden versus provisioned MSK, but still unnecessary complexity absent any Kafka signal; Kinesis remains simpler.
- D. Self-managed Kafka on EC2 — ✗ Maximum operational overhead; contradicts "lowest possible operational overhead."

**Q3.** What is the defining technical capability that MSK has and
Kinesis Data Streams does not?

- A. Message retention beyond 24 hours — ✗ Both support extended retention (Kinesis up to 365 days; MSK configurable + tiered storage).
- B. **Wire-protocol compatibility with Apache Kafka clients, letting existing Kafka producer/consumer code run largely unmodified — ✓** The core differentiator.
- C. Support for multiple consumers reading independently — ✗ Both support this (Kinesis via multiple consumer apps/EFO; MSK via consumer groups).
- D. Durable, replayable storage of events — ✗ Both are durable and replayable; not the differentiator.

**Q4.** A team wants Kafka API compatibility but with the least
possible broker management overhead. What should they choose?

- A. MSK provisioned with manual partition management — ✗ Highest ops burden among Kafka-compatible options.
- B. **MSK Serverless — ✓** Kafka-compatible with automatic scaling and no broker management.
- C. Kinesis Data Streams on-demand — ✗ Not Kafka-compatible; disqualified by the stated requirement.
- D. Self-managed Kafka on EKS — ✗ Maximum operational overhead; contradicts the requirement.

**Q5.** Which feature gives a Kinesis Data Streams consumer 2MB/s of
dedicated throughput, independent of other consumers on the same
shard?

- A. On-demand mode — ✗ Controls capacity scaling, not per-consumer dedicated throughput.
- B. **Enhanced Fan-Out (EFO) — ✓** Provides 2MB/s dedicated throughput per consumer per shard.
- C. Extended retention — ✗ Relates to how long data is retained, not per-consumer throughput.
- D. Kinesis Client Library (KCL) checkpointing — ✗ Manages consumer progress tracking, not dedicated throughput allocation.

**Q6.** A scenario states a team has built and validated Kafka Streams
stateful processing applications over several years and wants to run
them on AWS with minimal rework. What's correct, and why does Kinesis
not fit?

- A. **MSK — ✓; Kafka Streams applications are Kafka-API-native and MSK is the only Kafka-wire-compatible option, letting them run largely unmodified.** Correct and correctly reasoned.
- B. Kinesis Data Streams; Kafka Streams apps work on any streaming service — ✗ False; Kafka Streams is tightly coupled to the Kafka protocol.
- C. Managed Flink; it replaces the need for Kafka Streams entirely — ✗ Would still require significant rework and doesn't preserve the existing Kafka Streams applications as-is.
- D. Either service works equally well — ✗ Incorrect; only MSK offers the wire compatibility needed to avoid a rewrite.

**Q7.** True or false: both Kinesis Data Streams and MSK support
message retention well beyond the default 24 hours.

- A. **True — ✓** Kinesis supports extended retention up to 365 days; MSK supports configurable retention plus tiered storage for long-term, cost-effective retention.
- B. False, only MSK supports extended retention — ✗ Incorrect; Kinesis also supports up to 365 days of retention.
- C. False, only Kinesis supports extended retention — ✗ Incorrect; MSK also supports long retention via configuration and tiered storage.
- D. False, neither supports retention beyond 24 hours — ✗ Both explicitly support much longer retention than the 24-hour default.

**Q8.** A cost-conscious team with no Kafka requirement is comparing
Kinesis and MSK provisioned for a simple new streaming pipeline. Why
might Kinesis be the more cost-effective total choice, even if raw
infrastructure pricing looks similar?

- A. Kinesis charges nothing for data ingested — ✗ False; Kinesis has real, metered costs (shard-hours/PUT units or on-demand GB pricing).
- B. **MSK provisioned carries additional operational cost/effort (broker patching, partition rebalancing, version upgrades) that Kinesis's fully managed model avoids — ✓** Total cost of ownership, not just line-item infra pricing, favors Kinesis absent a Kafka need.
- C. MSK cannot scale below a fixed minimum broker count, unlike Kinesis's flexibility — ✗ True technically for provisioned MSK, but not the primary framing AWS tests; the ops-overhead argument is the key point.
- D. Kinesis has no data transfer charges while MSK does — ✗ Not a meaningfully tested distinction on this exam.

**Q9.** Which of the following is NOT a valid signal for choosing MSK
over Kinesis Data Streams?

- A. "Existing Kafka Connect connectors must continue functioning" — this IS a valid MSK signal, not a correct answer to "NOT valid" — ✗ mislabeled as "not valid"; it actually is a valid MSK trigger.
- B. **"The team wants the absolute lowest operational overhead with no other constraints" — ✓ Correct — this actually favors Kinesis, not MSK, making it the right pick for "NOT a valid MSK signal."**
- C. "ksqlDB is used for stream processing today" — this IS a valid MSK signal — ✗ mislabeled; ksqlDB is Kafka-ecosystem tooling, a real MSK trigger.
- D. "Producers use the Kafka client library directly" — this IS a valid MSK signal — ✗ mislabeled; direct Kafka client usage is a strong MSK trigger.

**Q10.** A scenario requires an event stream where consumer applications
must be able to rewind and reprocess the last 90 days of events after a
downstream bug is fixed, and there's no Kafka requirement. What
satisfies this on Kinesis?

- A. Enhanced Fan-Out — ✗ Solves per-consumer throughput, not retention/replay window length.
- B. **Extended data retention configured up to the required window (Kinesis supports up to 365 days) — ✓** Directly satisfies the 90-day replay requirement.
- C. DynamoDB Streams as an intermediary — ✗ Unnecessary added complexity; Kinesis's own retention setting solves this directly.
- D. On-demand mode alone — ✗ Controls capacity scaling, not retention/replay duration.

**Q11.** Why is "the team already knows Kafka operationally, but has no
existing Kafka deployment or code" a weaker signal for MSK than "an
existing Kafka cluster with Connect and Streams apps"?

- A. Team familiarity alone doesn't require wire-protocol compatibility — there's no existing code or connector investment forcing MSK; Kinesis remains a valid, often simpler choice — ✓ Correct reasoning: skills alone don't disqualify Kinesis the way existing Kafka-dependent code/tooling does.
- B. MSK requires Kafka-certified staff by AWS policy — ✗ No such requirement exists.
- C. Kinesis cannot be operated by anyone with Kafka experience — ✗ False; Kinesis is a different but learnable API, unrelated to prior Kafka knowledge.
- D. Team familiarity with Kafka is irrelevant to any AWS service choice — ✗ Overstated; familiarity can be a soft factor, but the exam weighs actual technical/code dependencies (existing Kafka clients/connectors) far more heavily.

**Q12.** A company needs Kafka Streams processing, exactly-once
semantics via Kafka transactions, and wants to avoid vendor lock-in to
a proprietary streaming API. Which service and which key reason?

- A. Kinesis Data Streams; it also supports exactly-once semantics — ✗ Kinesis alone doesn't provide Kafka's transactional exactly-once semantics or run Kafka Streams applications.
- B. **Amazon MSK; Kafka-wire compatibility preserves portability/avoids lock-in and directly supports Kafka Streams and Kafka's transactional semantics — ✓** Matches every stated requirement.
- C. Managed Service for Apache Flink alone, without any broker — ✗ Flink processes streams but still needs a Kafka-compatible source/sink to satisfy the Kafka Streams and portability requirements described.
- D. Amazon Data Firehose with Lambda transformation — ✗ Firehose is a delivery service with no replay, consumer-group model, or Kafka compatibility at all.
