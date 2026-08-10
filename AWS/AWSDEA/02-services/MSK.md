# Amazon MSK (Managed Streaming for Apache Kafka)

> Deep-reference file for **Amazon MSK**, scoped narrower than a full
> domain file. Read alongside `00-START-HERE/SERVICE-SELECTION-MATRIX.md`
> Part 2 (streaming ingestion matrix) for the head-to-head against
> Kinesis Data Streams and Amazon Data Firehose — this file goes deeper
> on MSK's own internals: provisioned vs. Serverless, MSK Connect,
> Kafka Streams, cluster sizing, authentication options, and open
> monitoring. Primarily tested in **Domain 1 (Data Ingestion and
> Transformation, 34%)**, Task 1.1, with security/auth content also
> touching **Domain 4 (Data Security and Governance, 18%)**.

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

Imagine your school already has a very popular, very specific system for
passing notes around — every kid knows exactly how to fold the note, who
to hand it to, and there's a "note routing crew" (Kafka Connect) that
already knows how to grab notes from twenty different classrooms
automatically. Building a totally different note-passing system (like
Kinesis) would work fine for a brand-new school, but this school has
thousands of kids already trained on the old system, and retraining
everyone is a huge pain. Amazon MSK is Amazon saying: "keep your exact
same note-folding system — we'll just run the note-routing crew for
you, replace it when it gets tired, keep it healthy, and you never have
to interview and hire a new crew member yourself." It's not a new way
of passing notes; it's the *same* way, with Amazon quietly running the
crew behind the scenes.

<a name="step2"></a>
## 2. Explain technically

**Amazon MSK (Managed Streaming for Apache Kafka)** is a fully managed
service running **actual, wire-protocol-compatible Apache Kafka** —
brokers, topics, partitions, and the full Kafka ecosystem (Kafka
Connect, Kafka Streams, Schema Registry via integration) — with AWS
handling broker provisioning, patching, replacement, and (in
Serverless mode) capacity management. Unlike Kinesis Data Streams,
which is an AWS-proprietary API, **MSK is Kafka**, meaning existing
Kafka producers, consumers, Kafka Connect connectors, and Kafka Streams
applications work against it with **no protocol translation and
typically no code changes**. MSK offers two deployment modes:
**MSK Provisioned**, where you choose broker instance types, count, and
storage per broker, and **MSK Serverless**, which removes broker
sizing/patching entirely and scales automatically based on throughput,
billed per partition-hour and per GB. **MSK Connect** is the managed
runtime for Kafka Connect connectors (both source and sink), letting
data move between Kafka and other systems (S3, DynamoDB, RDS, and
hundreds of community connectors) without self-hosting Connect workers.

<a name="step3"></a>
## 3. Explain like a Senior AWS Data Engineer

A senior engineer treats "MSK vs. Kinesis Data Streams" as almost
entirely a question of **existing investment, not raw capability** —
both services solve durable, replayable, ordered streaming at
comparable latency ranges, and for a genuinely greenfield AWS-only
project, Kinesis is very often the lower-operational-overhead choice.
MSK becomes the correct answer the moment **any** of these are true:
(1) the organization has **existing Kafka producers/consumers that
speak the Kafka wire protocol and cannot be rewritten** — a hard
compatibility requirement, not a preference; (2) there's an **existing
library of Kafka Connect connectors** already built or configured
against specific systems, and rebuilding that integration layer in a
non-Kafka ecosystem is real, avoidable engineering cost; (3) there's a
**deliberate multi-cloud or hybrid Kafka strategy**, where portability
across cloud providers matters more than AWS-native simplicity; or (4)
the team has **existing Kafka Streams applications** performing
stream-native processing that would need a full rewrite to run against
a different streaming API. The senior framing worth stating out loud
in an interview or design review: *"MSK's Kafka compatibility is
valuable only if it's actually being used — otherwise it is strictly
more operational surface than Kinesis for the same outcome."*
**MSK Serverless** narrows, but doesn't eliminate, that operational gap
— it removes broker sizing and patching, but a senior engineer still
treats "does this workload genuinely need Kafka" as the first
question, not "which MSK mode is cheapest."

<a name="step4"></a>
## 4. Production architecture

```
   PRODUCERS                            MSK CLUSTER                          CONSUMERS
┌───────────────┐   Kafka wire protocol
│ Existing Kafka   │ ──┐
│ producers        │ ──┤    ┌──────────────────────────────────────┐
│ (unmodified)     │ ──┼───▶│  BROKER 1  (topic partitions, leader/  │──┐
└───────────────┘        │  follower replicas across brokers)     │  │
                          ├──────────────────────────────────────┤  │
                          │  BROKER 2  ... spread across 3 AZs     │  │  Existing Kafka
                          ├──────────────────────────────────────┤  ├─▶ consumer groups
                          │  BROKER 3                               │  │  (unmodified)
                          └──────────────────────────────────────┘  │
                          Replication factor (typ. 3) across brokers/AZs
                          Retention: configurable, + tiered storage for
                          very long/cheap retention                  │
                                                                       ▼
                          ┌──────────────────────────────────────┐  ┌─────────────┐
                          │            MSK CONNECT                  │  │ Kafka Streams │
                          │  Managed Kafka Connect runtime.          │─▶│ application    │
                          │  SOURCE connectors pull data IN          │  │ (stateful       │
                          │  (e.g., DynamoDB CDC → topic)            │  │ stream           │
                          │  SINK connectors push data OUT           │  │ processing)      │
                          │  (e.g., topic → S3, topic → RDS)         │  └─────────────┘
                          └──────────────────────────────────────┘

        ───────────────────  AUTHENTICATION OPTIONS  ───────────────────

  IAM access control  |  SASL/SCRAM (username/password)  |  mutual TLS (mTLS, cert-based)
  Any combination configurable per cluster/listener.

        ─────────────────────  OPEN MONITORING  ─────────────────────

  MSK ──▶ Prometheus-compatible metrics endpoint ──▶ self-hosted or
  managed Prometheus/Grafana stack, in addition to native CloudWatch
  metrics — the answer whenever a scenario names Prometheus/Grafana
  specifically rather than generic "monitoring."
```

**Reading the diagram, layer by layer:** because MSK brokers speak the
**actual Kafka wire protocol**, existing producers and consumer groups
connect **without any client-side code changes** — this is the entire
value proposition versus Kinesis, which requires the AWS SDK/KPL/KCL
and does not understand Kafka clients at all. Topics are partitioned
and replicated across brokers, which AWS spreads across **multiple
Availability Zones** (typically 3) with a configurable **replication
factor** (commonly 3) — a partition's leader handles reads/writes while
follower replicas on other brokers/AZs stay in sync, so losing a broker
or an AZ doesn't lose data as long as the replication factor and
in-sync replica count are configured sensibly. **MSK Connect** sits
beside the cluster as a managed runtime for Kafka Connect — the Kafka
ecosystem's standard integration layer — running **source connectors**
(pulling data into a topic from an external system, e.g., a database's
CDC stream) and **sink connectors** (pushing topic data out to a
destination, e.g., continuously writing a topic to S3) without the team
having to self-host and patch Connect worker nodes. **Kafka Streams**
applications — a client-side stream-processing library that's part of
the Kafka ecosystem, distinct from AWS's own Managed Service for Apache
Flink — read from and write to MSK topics for stateful, in-application
stream transformations, and are a strong signal for MSK specifically
when a scenario mentions them, since Kafka Streams only runs against
Kafka-protocol brokers. **Authentication** is configurable per cluster
and can combine **IAM-based access control** (fitting naturally into
existing AWS IAM policies), **SASL/SCRAM** (traditional username/
password Kafka authentication), and **mutual TLS (mTLS)**
(certificate-based, mutually-authenticated connections) — the choice
usually driven by what the existing Kafka ecosystem's tooling already
expects. Finally, **open monitoring** exposes cluster metrics in a
**Prometheus-compatible format**, in addition to standard CloudWatch
metrics — this matters specifically for organizations that already run
Prometheus/Grafana observability stacks and want MSK to plug into that
existing tooling rather than migrating monitoring to CloudWatch alone.

<a name="step5"></a>
## 5. Per-service coverage checklist

### Purpose

Amazon MSK is a fully managed service for running Apache Kafka —
providing wire-protocol-compatible brokers, managed Kafka Connect (MSK
Connect), and support for the broader Kafka ecosystem (Kafka Streams,
schema registries) — removing the operational burden of broker
provisioning, patching, and replacement while preserving full Kafka
compatibility for existing tooling.

### When to use

- **Existing Kafka producers, consumers, or Kafka Connect connectors**
  that cannot be rewritten, or where rewriting represents significant
  avoidable engineering cost.
- **Migrating a self-managed Kafka cluster to AWS** ("lift and shift")
  while preserving the exact same client-side integration surface.
- **Existing Kafka Streams applications** performing stateful
  stream processing that depends on Kafka-protocol semantics.
- **Multi-cloud or hybrid Kafka strategy**, where portability of the
  streaming layer across cloud providers is a deliberate architectural
  requirement.
- Teams needing **Kafka Connect's mature, large connector ecosystem**
  (hundreds of community and commercial connectors) rather than
  building custom integration code.
- Organizations with **existing Prometheus/Grafana observability**
  wanting native, protocol-compatible metrics rather than adopting a
  new monitoring stack.

### When NOT to use

- **Greenfield AWS-only streaming with no Kafka investment or
  requirement** — Kinesis Data Streams is typically lower operational
  overhead for the same outcome (replay, ordering, multiple consumers)
  without broker-level concerns.
- **Simple "land this stream in S3" delivery with no processing need**
  — Amazon Data Firehose is dramatically less operational surface.
- **Teams wanting the absolute lowest operational burden and no
  existing Kafka dependency** — even MSK Serverless still carries more
  conceptual/API surface (topics, partitions, consumer groups, Kafka
  client configuration) than Kinesis on-demand mode.
- **Workloads needing AWS-native features that only exist in the
  Kinesis ecosystem** (e.g., certain native Lambda event-source-mapping
  behaviors are simpler and more mature against Kinesis than against
  MSK, though MSK Lambda triggers do exist).

### Advantages

- **True Kafka protocol compatibility** — zero client-side rewrite for
  existing Kafka investments.
- **MSK Connect** removes the operational burden of self-hosting Kafka
  Connect workers while preserving the connector ecosystem.
- **MSK Serverless** removes broker sizing, patching, and capacity
  planning entirely, while still speaking full Kafka protocol.
- **Tiered storage** (provisioned clusters) enables very long, cheap
  retention beyond what's practical to keep on broker-local storage,
  without a separate archival pipeline.
- **Open monitoring (Prometheus-compatible)** integrates directly with
  existing observability tooling many Kafka shops already run.
- Multiple authentication mechanisms (IAM, SASL/SCRAM, mTLS)
  accommodate varied enterprise security requirements and existing
  Kafka client configurations.

### Limitations

- **Higher operational surface than Kinesis** even when managed —
  brokers, partitions, replication factor, and consumer group behavior
  all require Kafka-specific operational knowledge.
- **MSK Provisioned requires broker sizing decisions** (instance type,
  broker count, storage per broker) — get this wrong and you either
  overpay for idle capacity or under-provision and risk
  `UnderReplicatedPartitions` and consumer lag under load.
- **MSK Serverless has its own constraints** — throughput quotas,
  partition limits, and a narrower feature set than fully provisioned
  clusters for advanced Kafka configuration tuning.
- **Cost is typically higher than Kinesis for equivalent throughput**
  at moderate scale, when the Kafka-specific features aren't actually
  being used to justify it.
- Cross-region replication for DR requires **MSK Replicator** (a
  managed cross-cluster replication feature) or self-managed MirrorMaker
  — not automatic the way some other AWS data stores' cross-region
  options are.

### Pricing considerations

- **MSK Provisioned**: billed per **broker-hour** (by instance type)
  plus **storage** (per GB-month) plus **data transfer**; cost is
  predictable but requires correct broker sizing to avoid both
  overpaying (over-provisioned) and throttling/instability
  (under-provisioned).
- **MSK Serverless**: billed per **cluster-hour, per partition-hour,
  and per GB of data in/out** — no broker sizing decision, but can be
  more expensive than well-tuned provisioned clusters at steady, high,
  predictable volume.
- **MSK Connect**: billed by **MCU (MSK Connect Unit) hours** consumed
  by running connectors, separate from the underlying cluster's own
  billing.
- **Tiered storage** on provisioned clusters is priced to be
  significantly cheaper than primary broker storage for long-retention
  data, similar in spirit to S3 lifecycle tiering.
- Compare against Kinesis on a **per-equivalent-throughput** basis —
  MSK's cost only "wins" when Kafka-specific capabilities (existing
  connectors, Kafka Streams, protocol compatibility) are genuinely
  needed; on pure cost-per-GB alone at moderate scale, Kinesis
  on-demand is often cheaper due to lower operational surface.

### Performance

- Typical broker-to-consumer latency is in the low tens of
  milliseconds range (often cited around ~10ms under healthy
  conditions) — generally lower raw latency than Kinesis standard
  consumers, though both are "real-time-class" services for exam
  purposes.
- Throughput scales with broker count/instance size (provisioned) or
  automatically within Serverless's quota limits.
- **Partition count** is the Kafka-native lever for consumer
  parallelism — analogous to Kinesis shards, more partitions allow more
  parallel consumers within a consumer group.

### Scaling

| Dimension | Mechanism |
|---|---|
| Broker capacity (Provisioned) | Add brokers, or resize broker instance type; storage auto-expands per broker if configured |
| Capacity (Serverless) | Fully automatic, within service quotas |
| Consumer parallelism | Increase partition count per topic (analogous to Kinesis shard count) |
| Connector throughput | Scale MSK Connect worker/task count for a given connector |
| Long-term retention without broker cost growth | Enable **tiered storage** (provisioned only) |
| Cross-cluster/cross-region replication | **MSK Replicator** (managed) or MirrorMaker 2 (self-managed) |

### Security

- **Authentication**: IAM access control, SASL/SCRAM (username/
  password), and mutual TLS (mTLS) — configurable per cluster/listener,
  and combinable.
- **Encryption at rest** via KMS; **encryption in transit** via TLS
  between clients and brokers, and between brokers themselves.
- **VPC-only deployment** — MSK clusters run inside a VPC, with
  security groups controlling broker network access; no public
  endpoint by default.
- **IAM access control** specifically lets you express Kafka ACL-like
  permissions (which principal can produce/consume which topic) using
  native IAM policies instead of managing a separate Kafka ACL system.
- Integrates with **AWS Secrets Manager** for storing SASL/SCRAM
  credentials securely with rotation support.

### High availability

- Brokers are distributed across **multiple Availability Zones**
  (typically 3) within a region; a properly configured **replication
  factor** (commonly 3, spread across AZs) means losing a broker or an
  entire AZ does not lose data, as long as enough in-sync replicas
  remain.
- **Automatic broker replacement** — AWS detects and replaces unhealthy
  brokers without manual intervention, preserving the cluster's
  configured broker count.
- **MSK Serverless** abstracts AZ/broker placement entirely, with AWS
  managing redundancy transparently.
- **Cross-region DR** is not automatic — achieved via **MSK
  Replicator** or self-managed MirrorMaker replicating topics to a
  cluster in a second region.

### Failure scenarios

| Scenario | Symptom | Fix |
|---|---|---|
| Broker becomes unhealthy | `UnderReplicatedPartitions` rises; AWS auto-replaces the broker | Monitor and confirm auto-replacement; ensure replication factor ≥3 so no data loss occurs during replacement |
| Consumer group falls behind | Rising consumer lag metric | Add more partitions (more parallelism) and/or scale out consumer instances within the group |
| Single partition has disproportionate traffic (Kafka's version of a hot shard) | One partition's consumers overloaded while others idle | Redesign the message key used for partitioning to spread load more evenly |
| MSK Connect connector falls behind or fails | Connector task errors, lag on the connector's topic | Scale connector tasks, check source/sink system health, review connector-specific error logs |
| Broker storage nearing capacity | Disk usage alarms | Increase provisioned storage per broker, or enable tiered storage for older data |

### Common mistakes

- Choosing MSK for a **greenfield workload with no Kafka requirement**,
  taking on unnecessary operational surface versus Kinesis.
- **Under-sizing broker count or instance type** in Provisioned mode,
  causing `UnderReplicatedPartitions` and consumer lag under real
  production load.
- Forgetting that **cross-region replication is not automatic** —
  assuming MSK behaves like a globally-replicated service by default.
- Self-hosting Kafka Connect workers on EC2 instead of using **MSK
  Connect**, re-introducing the exact operational burden MSK was
  chosen to remove.
- Confusing **Kafka Streams** (a Kafka-ecosystem client library) with
  **Amazon Managed Service for Apache Flink** (a separate AWS
  stream-processing service) — they are not interchangeable, and a
  scenario naming one specifically should not be answered with the
  other.
- Not enabling **tiered storage** for workloads needing long retention,
  instead over-provisioning primary broker storage at high cost.

### Exam traps

⚠️ **"Existing Kafka" is the single strongest signal for MSK.** If a
scenario states producers/consumers/connectors already speak Kafka and
cannot be rewritten, MSK is correct even if Kinesis would otherwise be
"less operational overhead" — protocol compatibility is a hard
constraint, not a preference, in these scenarios.

⚠️ **MSK Serverless still isn't "no Kafka knowledge required."** Unlike
choosing Kinesis on-demand (which requires essentially zero Kafka-
equivalent concepts), MSK Serverless still requires understanding
topics, partitions, and consumer groups — don't treat "Serverless" as
making MSK operationally equivalent to Kinesis.

⚠️ **Kafka Connect connectors point to MSK Connect, not custom Lambda
code.** A scenario describing "move data continuously between our
Kafka cluster and S3/RDS/DynamoDB using existing Kafka Connect
connectors" should trigger MSK Connect specifically — building custom
Lambda/Glue code to replicate that functionality is unnecessary
reinvention.

⚠️ **Kafka Streams ≠ Managed Service for Apache Flink.** These are two
separate AWS answers to "stream processing," and a scenario naming
"Kafka Streams" specifically is describing a Kafka-ecosystem client
library that runs against MSK (or any Kafka), not AWS's managed Flink
service.

⚠️ **Cross-region MSK resilience requires an explicit answer (MSK
Replicator or MirrorMaker) — it is not automatic.** Don't assume MSK
behaves like Aurora Global Database or S3 cross-region replication out
of the box.

⚠️ **"Open monitoring" or "Prometheus/Grafana" in a scenario points to
MSK's open monitoring feature specifically**, not a generic "use
CloudWatch" answer — this is a differentiator worth recognizing by
name.

<a name="step7"></a>
## 7. Interview questions

- *"When would you recommend MSK over Kinesis Data Streams for a new
  project?"* Strong answer: almost never for a truly greenfield,
  AWS-only project with no Kafka dependency — MSK earns its place when
  there's existing Kafka-protocol producers/consumers, existing Kafka
  Connect connectors, existing Kafka Streams applications, or a
  deliberate multi-cloud Kafka strategy; otherwise it's strictly more
  operational surface for the same core streaming guarantees.
- *"Explain the trade-off between MSK Provisioned and MSK Serverless."*
  Strong answer: Provisioned gives full control over broker sizing,
  instance types, and advanced configuration (and can be cheaper at
  steady high volume) but requires the team to size and monitor
  brokers; Serverless removes that sizing/patching burden and scales
  automatically, at a cost premium and with narrower configuration
  flexibility, appropriate when operational simplicity matters more
  than fine-grained control or absolute lowest cost at scale.
- *"How does MSK Connect compare to building a custom Lambda function to
  move data from Kafka to S3?"* Strong answer: MSK Connect runs the
  same battle-tested, community-maintained Kafka Connect connectors the
  team may already use elsewhere, with managed scaling and fewer
  moving parts to build and maintain than custom integration code —
  reach for custom code only when no suitable connector exists.
- *"What does 'replication factor 3 across 3 AZs' actually protect
  against, and what doesn't it protect against?"* Strong answer: it
  protects against losing an individual broker or an entire AZ without
  losing data (as long as enough in-sync replicas remain); it does
  **not** protect against a regional outage — that requires MSK
  Replicator or MirrorMaker to a cluster in a second region.
- *"A team says 'we're already deep into Prometheus-based monitoring
  and don't want to adopt CloudWatch as our primary observability
  tool for streaming.' How does MSK address that?"* Strong answer:
  MSK's open monitoring feature exposes cluster metrics in a
  Prometheus-compatible format, letting the existing Prometheus/Grafana
  stack scrape MSK directly without forcing a switch to CloudWatch as
  the primary dashboarding tool.

<a name="step8"></a>
## 8. Cheat sheet

| If the scenario says... | Reach for... |
|---|---|
| existing Kafka producers/consumers, can't rewrite | Amazon MSK |
| migrating a self-managed Kafka cluster to AWS | Amazon MSK (lift-and-shift) |
| existing Kafka Connect connectors | MSK Connect |
| existing Kafka Streams application | Amazon MSK (Kafka Streams runs against it) |
| multi-cloud Kafka strategy | Amazon MSK |
| no broker sizing/patching wanted, still need Kafka protocol | MSK Serverless |
| fine-grained broker control, steady high volume, cost-sensitive | MSK Provisioned |
| very long, cheap topic retention | MSK tiered storage (provisioned) |
| Prometheus/Grafana observability stack already in place | MSK open monitoring |
| cross-region Kafka DR | MSK Replicator (or MirrorMaker) |
| IAM-native topic-level access control | MSK IAM access control |
| username/password Kafka auth | SASL/SCRAM |
| certificate-based mutual auth | mTLS |
| no Kafka investment, greenfield, least overhead | NOT MSK — Kinesis Data Streams |
| just land stream in S3, no processing | NOT MSK — Amazon Data Firehose |

### 14-column snapshot: MSK vs. Kinesis Data Streams

| Column | Amazon MSK | Kinesis Data Streams |
|---|---|---|
| Purpose | Managed Apache Kafka | AWS-native durable stream |
| Speed | ~10 ms typical | ~200 ms (~70 ms w/ EFO) |
| Cost | Broker-hours + storage, or Serverless partition-hours | Shard-hours + PUT units, or on-demand GB |
| Serverless | MSK Serverless option | On-demand mode ≈ yes |
| Streaming support | ✅ Core purpose | ✅ Core purpose |
| Batch support | ❌ | ❌ |
| Data volume | Scales with brokers/partitions | Scales with shards, or automatic on-demand |
| Latency | Lower raw latency, real-time class | Real-time class |
| Scaling | Add brokers/partitions; Serverless auto | Reshard, or on-demand auto |
| Monitoring | CloudWatch + open monitoring (Prometheus) | CloudWatch (`IteratorAge`, throttling) |
| Security | IAM / SASL-SCRAM / mTLS, in-VPC only | IAM, KMS, VPC endpoint |
| HA | Multi-AZ, replication factor, auto broker replacement | Multi-AZ by default, regional service |
| Best use case | Kafka migration, Kafka ecosystem, connectors, Kafka Streams | Multiple consumers, replay, ordering, AWS-native simplicity |
| When NOT to use | No Kafka investment, want lowest ops overhead | Existing Kafka protocol requirement |

<a name="step9"></a>
## 9. Memory tricks

**"MSK is Kafka. Kinesis is Kinesis."** — the whole decision in five
words; if the scenario needs the actual Kafka protocol, only MSK
qualifies.

**"Connect needs Connect."** — Kafka Connect connectors run on **MSK
Connect**, not custom Lambda code.

**"Streams ≠ Flink."** — Kafka Streams is a Kafka-ecosystem library
running against MSK; Managed Service for Apache Flink is a separate
AWS service. Don't swap them.

**"Serverless removes brokers, not Kafka concepts."** — MSK Serverless
still has topics, partitions, and consumer groups; it isn't
Kinesis-simple.

**"Replication factor protects AZs, not regions."** — cross-region
needs MSK Replicator/MirrorMaker explicitly.

<a name="step10"></a>
## 10. Practice questions (15)

**Q1.** A financial services company operates a large, existing Apache
Kafka deployment on-premises, with dozens of producer applications and
custom Kafka Connect connectors integrated with internal systems. They
want to migrate to AWS with the least possible re-engineering of
client applications. What should they choose?

A) Kinesis Data Streams, rewriting producers with the Kinesis SDK
B) Amazon MSK, preserving existing Kafka producers, consumers, and connectors largely unchanged
C) Amazon Data Firehose, since it's the least operational overhead
D) Amazon Managed Service for Apache Flink, since it processes streams

**Answer: B.** MSK is wire-protocol compatible with Kafka, allowing the
existing producers, consumers, and Kafka Connect connectors to migrate
with minimal to no changes — exactly the "least re-engineering" goal
stated. **A** requires exactly the rewrite the company wants to avoid.
**C** is a delivery-only service and doesn't preserve Kafka's
protocol, topics, or consumer-group semantics. **D** is a stream
*processing* engine, not a Kafka-protocol-compatible broker/ingestion
layer.

**Q2.** Which AWS service is the correct managed home for running
existing Kafka Connect source and sink connectors, without self-hosting
Connect worker nodes on EC2?

A) AWS Glue
B) MSK Connect
C) AWS Lambda
D) Amazon EMR

**Answer: B.** MSK Connect is the managed runtime purpose-built for
running Kafka Connect connectors (both source and sink) without
self-managing Connect workers. **A**, Glue, doesn't run Kafka Connect
connectors. **C**, Lambda, could theoretically be used to write custom
integration code, but that reintroduces the exact operational and
re-engineering burden MSK Connect exists to remove. **D**, EMR, is a
general big-data cluster platform, not a managed Kafka Connect runtime.

**Q3.** A team is deciding between MSK Provisioned and MSK Serverless
for a new Kafka-based pipeline with genuinely unpredictable throughput,
and a strong preference to avoid broker sizing and patching decisions.
What should they choose?

A) MSK Provisioned, sized conservatively high
B) MSK Serverless
C) Kinesis Data Streams instead, since it's always simpler
D) Self-managed Kafka on EC2 for maximum control

**Answer: B.** MSK Serverless removes broker sizing and patching
entirely while scaling automatically with throughput — directly
matching "unpredictable throughput" and "avoid broker sizing/patching"
in the stem. **A** reintroduces the exact sizing burden the team wants
to avoid. **C** is plausible in a vacuum, but the scenario is scoped to
"Kafka-based pipeline" (implying an existing or required Kafka
dependency isn't stated as absent) — within the MSK-vs-MSK decision
being asked, Serverless is the correct answer; if the scenario had no
Kafka requirement at all, Kinesis would be worth raising, but that's
not what's being asked here. **D** reintroduces maximum, not minimum,
operational burden.

**Q4.** An organization runs a Kafka Streams application that performs
stateful aggregation directly against Kafka topics as part of their
existing streaming architecture. They are migrating their Kafka
infrastructure to AWS. Which AWS service continues to support this
Kafka Streams application with the least disruption?

A) Amazon Managed Service for Apache Flink, since it also does stream processing
B) Amazon MSK, since Kafka Streams applications run against Kafka-protocol brokers, which only MSK provides
C) AWS Glue Streaming
D) Amazon Kinesis Data Analytics (legacy name for Flink)

**Answer: B.** Kafka Streams is a client library that runs against
actual Kafka-protocol brokers — only MSK provides that compatibility
among AWS-native options, so migrating the brokers to MSK lets the
existing Kafka Streams application continue working with minimal
change. **A** is the classic Kafka-Streams-vs-Managed-Flink confusion
trap — they are different technologies from different ecosystems; you
cannot point an existing Kafka Streams application at Managed Flink
without a rewrite. **C** is a Glue-specific streaming ETL feature, not
Kafka-protocol compatible. **D** is an outdated service name (see
currency correction) and also not the correct concept here regardless.

**Q5.** A company already operates a mature Prometheus and Grafana
observability stack across all of their infrastructure and wants their
new streaming platform's metrics to integrate directly with that
existing tooling, rather than adopting CloudWatch as their primary
streaming dashboard. Which MSK feature addresses this directly?

A) MSK Connect
B) Open monitoring (Prometheus-compatible metrics)
C) Tiered storage
D) IAM access control

**Answer: B.** MSK's open monitoring feature exposes cluster metrics in
a Prometheus-compatible format specifically so that existing
Prometheus/Grafana stacks can scrape MSK directly, without switching
primary observability tooling to CloudWatch. **A** is for connector
management, unrelated to metrics/observability. **C** is a
storage-retention feature. **D** is an authentication mechanism.

**Q6.** A cluster review shows `UnderReplicatedPartitions` climbing on
an MSK Provisioned cluster following a broker failure event. What is
the expected AWS-managed behavior, and what should the team verify to
ensure no data was lost?

A) MSK does not automatically recover from broker failures; manual broker replacement is required
B) AWS automatically detects and replaces the unhealthy broker; the team should verify the replication factor and in-sync replica count were sufficient to avoid data loss during the replacement window
C) The cluster must be manually failed over to a secondary region
D) `UnderReplicatedPartitions` is a normal steady-state metric and requires no action

**Answer: B.** MSK automatically detects and replaces unhealthy
brokers without manual intervention; whether data was actually at risk
during that window depends on whether the configured replication
factor and in-sync replica requirements were sufficient to tolerate the
loss of that one broker. **A** is false — automatic broker replacement
is a core MSK-managed capability. **C** conflates broker-level failure
(single-region, AZ-level resilience) with regional disaster recovery,
which is a separate concern (MSK Replicator). **D** is wrong — a
climbing `UnderReplicatedPartitions` metric is a meaningful signal to
investigate, not steady-state noise.

**Q7.** A team needs long-term retention (many months) of Kafka topic
data on MSK for compliance purposes, but wants to avoid the cost of
keeping all of that data on primary broker storage indefinitely. What
feature should they use?

A) Increase broker instance size to add more local storage
B) Enable tiered storage on the provisioned cluster
C) Switch to MSK Serverless, which has unlimited retention by default
D) Export all data to DynamoDB for long-term storage

**Answer: B.** Tiered storage (available on MSK Provisioned) is
purpose-built to hold older topic data cost-effectively outside primary
broker storage while remaining queryable through the same Kafka
interface. **A** is a much more expensive way to solve a retention
problem, scaling primary (expensive) storage rather than using the
cheaper tier. **C** is not an accurate characterization of MSK
Serverless retention behavior and doesn't address the cost goal. **D**
introduces an entirely separate service and data model rather than
using the mechanism designed for this within MSK itself.

**Q8.** Which authentication mechanism would a security team most
likely choose for an MSK cluster if they want to express Kafka
topic-level access permissions using the organization's existing AWS
IAM policies, rather than managing a separate Kafka ACL system?

A) SASL/SCRAM
B) Mutual TLS (mTLS)
C) IAM access control
D) No authentication, relying solely on VPC security groups

**Answer: C.** MSK's IAM access control option lets you express which
IAM principals can produce to or consume from specific topics using
native IAM policies, avoiding a separate Kafka ACL management system.
**A** and **B** are both valid, commonly used Kafka-native
authentication mechanisms, but they don't integrate with IAM policy
management the way IAM access control does — they'd require managing
separate credential/certificate systems. **D** is a weaker security
posture that doesn't provide authentication at the Kafka
principal/topic level at all.

**Q9.** A company operating an MSK cluster in `us-east-1` needs a
disaster-recovery plan that keeps a continuously up-to-date copy of
critical topics in `us-west-2`, ready to take over if the primary
region becomes unavailable. What should they implement?

A) Nothing additional — MSK automatically replicates across regions by default
B) MSK Replicator (or self-managed MirrorMaker) to continuously replicate topics to a cluster in the second region
C) Increase the replication factor to 6 within the single cluster
D) Enable tiered storage, which automatically spans regions

**Answer: B.** Cross-region resilience for MSK is not automatic — it
requires an explicit replication mechanism, either the managed **MSK
Replicator** or self-managed MirrorMaker, continuously copying topics
to a cluster in the target region. **A** is the exam trap — MSK
replication is AZ-level within a region by default, not cross-region.
**C** only affects durability within the existing region/cluster, not
DR to a separate region. **D**, tiered storage, is a retention-cost
feature within a single cluster, unrelated to cross-region
replication.

**Q10.** A data engineering team is deciding how to move data
continuously from an MSK topic into Amazon S3 for long-term analytics
storage in Parquet format. What is the most operationally efficient,
Kafka-idiomatic approach?

A) Write a custom Lambda function triggered on a schedule to poll and export topic data
B) Use an MSK Connect sink connector (e.g., the Kafka Connect S3 sink connector) to continuously stream topic data to S3
C) Manually export data using the Kafka CLI on a cron job
D) Use Amazon Data Firehose, which reads natively from any MSK topic with zero configuration

**Answer: B.** MSK Connect running a standard, community-maintained
Kafka Connect S3 sink connector is the purpose-built, managed way to
continuously move Kafka topic data into S3 — no custom polling code, no
self-hosted Connect workers. **A** reinvents functionality a mature
connector already provides, adding unnecessary custom code to build and
maintain. **C** is manual, fragile, and not how production Kafka data
movement is typically operated. **D** overstates Firehose's native MSK
integration — while Firehose does support MSK as a source in some
configurations, describing it as "zero configuration" native reading
misrepresents the setup involved, and MSK Connect remains the more
Kafka-idiomatic, connector-ecosystem-native answer for this specific
"continuous topic-to-S3" pattern.

**Q11.** Which statement correctly compares typical latency
characteristics between Amazon MSK and Kinesis Data Streams for exam
purposes?

A) MSK is always slower because it requires broker coordination
B) MSK typically offers lower raw latency (around 10 ms) compared to Kinesis standard consumers (around 200 ms), though both are considered real-time-class services
C) Kinesis Data Streams has no measurable latency at all
D) Latency is identical between the two services in all configurations

**Answer: B.** MSK's typical broker-to-consumer latency is commonly
cited around 10ms, generally lower than Kinesis Data Streams' standard
consumer latency of roughly 200ms — though both remain firmly in the
"real-time" category for exam decision-making purposes (the deciding
factor between them is almost always Kafka-protocol compatibility, not
this latency difference). **A** is incorrect — broker coordination
doesn't make MSK "always slower." **C** is false; Kinesis has
measurable, well-documented latency. **D** is inaccurate — the two
have genuinely different typical latency profiles.

**Q12.** A company wants to run Kafka Connect connectors for both
ingesting change-data-capture events from a database into a Kafka
topic (source) and continuously exporting a different topic to Amazon
Redshift (sink), all managed with minimal operational overhead. Where
should both connectors run?

A) One on MSK Connect (source), one hand-built in Lambda (sink)
B) Both on MSK Connect — it supports both source and sink connector types
C) Source connectors only; sink connectors aren't supported by MSK Connect
D) Both must run on a self-managed EC2 fleet running Kafka Connect

**Answer: B.** MSK Connect supports running both **source** connectors
(pulling data into topics) and **sink** connectors (pushing topic data
out) — there's no need to split the architecture across MSK Connect and
custom code. **A** unnecessarily reintroduces custom-code operational
burden for the sink side. **C** is factually wrong — sink connectors
are fully supported. **D** reintroduces the exact self-hosting burden
MSK Connect is designed to remove.

**Q13.** A scenario describes a greenfield analytics pipeline with no
existing Kafka investment, no Kafka Connect connectors, and no Kafka
Streams applications — just a need to ingest clickstream events in
real time with replay capability for a new mobile app. Which service
is the better default choice, and why?

A) Amazon MSK, because Kafka is an industry standard
B) Kinesis Data Streams, because there's no Kafka-specific requirement, and it offers replay/ordering with lower operational overhead than standing up and operating Kafka
C) Amazon Data Firehose, because it's always the least operational overhead option regardless of requirements
D) Either service is equally appropriate with no meaningful trade-off

**Answer: B.** With no existing Kafka dependency stated anywhere in the
scenario, Kinesis Data Streams delivers the same core requirements
(real-time ingestion, replay) with meaningfully less operational
surface than standing up and operating an MSK cluster for no
Kafka-specific reason. **A** picks MSK for "industry standard" appeal
rather than an actual stated requirement — not how this exam expects
reasoning to work. **C** ignores the explicit replay requirement, which
Firehose cannot satisfy at all. **D** understates a real, exam-relevant
trade-off between the two services.

**Q14.** Which of the following is an accurate description of MSK's
default resilience characteristics within a single AWS region?

A) MSK provides no redundancy; a single broker failure causes data loss
B) MSK distributes brokers across multiple Availability Zones with a configurable replication factor, and automatically replaces unhealthy brokers
C) MSK requires manual broker replacement scripts to be written by the customer
D) MSK clusters can only ever run in a single Availability Zone

**Answer: B.** MSK spreads brokers across multiple AZs (typically 3),
supports a configurable replication factor for topic partitions
(commonly 3), and automatically detects and replaces unhealthy
brokers — all without customer-managed replacement automation. **A**
is false given the described replication and AZ distribution. **C** is
false — broker replacement is automatic. **D** is false — MSK is
explicitly designed to distribute brokers across multiple AZs.

**Q15.** A team weighing MSK Provisioned against MSK Serverless for a
steady, very high, predictable daily throughput workload — where they
also want fine-grained control over broker-level configuration for
performance tuning — should choose which option, and why?

A) MSK Serverless, because "serverless" is always the exam's preferred answer
B) MSK Provisioned, because steady predictable volume favors provisioned economics, and only Provisioned offers fine-grained broker-level configuration control
C) Kinesis Data Streams instead, since the workload is Kafka-based and therefore automatically disqualifies Kinesis regardless of other factors
D) Neither — this workload should not use streaming at all

**Answer: B.** Provisioned mode is the better fit here for two
independent reasons stated in the scenario: steady, predictable, high
volume tends to be more cost-efficient under Provisioned's broker-hour
model than Serverless's per-partition/per-GB model, and only
Provisioned exposes the fine-grained broker-level configuration control
the team explicitly wants. **A** misapplies the general "serverless
often wins" house-style preference without checking whether the
specific stated requirements (steady volume, fine-grained control)
actually favor it here — they don't. **C** incorrectly claims a
Kafka-based requirement disqualifies Kinesis as a category, when the
actual disqualifier for Kinesis would be an existing Kafka-protocol
dependency, not "Kafka-based" framing in the abstract — but more
importantly, the question is scoped to MSK Provisioned vs. Serverless,
not a re-litigation of MSK vs. Kinesis. **D** ignores that this is
explicitly a real-time streaming ingestion requirement.
