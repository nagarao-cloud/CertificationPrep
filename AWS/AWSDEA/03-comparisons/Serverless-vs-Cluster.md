# Serverless vs Cluster

> This is not a single service comparison — it's the **meta-pattern
> underneath half the service-choice questions on this exam**. Athena,
> Glue, Lambda, Redshift Serverless, and EMR Serverless all share one
> operating model. Redshift provisioned, EMR on EC2, and self-managed
> Kafka on EC2 (as opposed to MSK) share the opposite one. Once you see
> the pattern, you stop re-deriving it service by service and start
> recognizing it instantly: **"least operational overhead" and "most
> cost-effective at scale" are two different phrases that often point
> at two different answers**, and the exam uses both deliberately.

---

## 1. ELI12

Imagine you need a car.

**Serverless is calling a taxi.** You don't own it, insure it, park it,
or maintain it. You tap a button, one shows up, you pay for exactly the
ride you took, and when you're done it's gone and costs you nothing
until you need it again. If you only need a ride twice a week, this is
obviously cheaper and easier than owning a car. But there's a catch:
when you tap the button, the taxi isn't instantly teleported to your
door — there's a few seconds to a few minutes of **wait time** before
it arrives. That wait is called a **cold start**, and if you need a car
*right now, every single time, all day, every day*, that wait adds up
and starts to feel like the wrong tool.

**Cluster (provisioned) is owning a car.** You pay for insurance, a
parking spot, and gas whether you drive it or not — that's **idle
cost**. You're responsible for maintenance (patching, upgrades,
"sizing" — do you buy a compact or a truck?). But once it's yours, it's
sitting in your driveway, warmed up, ready the instant you need it, and
if you drive 200 miles every single day, owning is almost always
cheaper per mile than calling a taxi 200 miles a day would ever be.

**The exam's one-line filter:** if the workload is spiky, unpredictable,
intermittent, or the team explicitly wants to avoid managing
infrastructure, that's the taxi (serverless) — "least operational
overhead" is the tell. If the workload is steady, large, and running
nearly 24/7 at predictable volume, that's the owned car (cluster/
provisioned) — "most cost-effective at scale" or "highest sustained
throughput" is the tell. **These two tells sometimes appear in the same
question pointing at different answers on purpose** — that's the whole
trap this file exists to defuse.

---

## 2. Comparison matrix

### 2a. Paradigm-level comparison

| Attribute | **Serverless** (Athena, Glue, Lambda, Redshift Serverless, EMR Serverless) | **Cluster / Provisioned** (Redshift provisioned, EMR on EC2, self-managed Kafka on EC2) |
|---|---|---|
| **Purpose** | Run work without provisioning or managing infrastructure | Run work on infrastructure you size, provision, and keep running |
| **Cost model** | Pay-per-use: per-query TB scanned (Athena), DPU-hours/KPU-hours (Glue/Flink), invocation+duration (Lambda), RPU-hours (Redshift Serverless), vCPU-hours (EMR Serverless) | Pay-for-capacity: hourly node/instance cost regardless of utilization, or Reserved Instances/Savings Plans for steep discounts at sustained usage |
| **Cost predictability** | Variable — scales with actual usage, can spike unexpectedly on a runaway query or job | Fixed and highly predictable once sized — the same bill whether idle or fully loaded |
| **Idle cost** | ✅ Near-zero — you pay nothing when nothing runs | ❌ Full cost accrues 24/7 whether or not the cluster is doing work |
| **Cold start** | ❌ Real, measurable delay before first work begins (Lambda: ms–seconds; Glue/EMR Serverless: tens of seconds to a few minutes for workers to provision) | ✅ None — the cluster is already warm and waiting |
| **Ops overhead** | ✅ **Lowest** — no patching, no capacity planning, no node failures to babysit | ❌ **Highest** — you own instance patching, cluster right-sizing, scaling policy, node failure recovery |
| **Scaling** | ✅ Automatic, near-instant, effectively unbounded within account quotas | Manual (resize) or auto-scaling policies you configure and tune yourself |
| **Cost at high, sustained, predictable volume** | ❌ Often **more expensive** than provisioned capacity running the same workload 24/7 | ✅ **Often cheaper** — especially with Reserved Instances/Savings Plans, once utilization is consistently high |
| **Cost at low, spiky, unpredictable volume** | ✅ **Almost always cheaper** — you're not paying for idle capacity between bursts | ❌ Wasteful — capacity sits idle most of the time but is billed continuously |
| **Latency for the very first request after idle** | ❌ Cold-start penalty | ✅ Instant |
| **Monitoring** | CloudWatch metrics per invocation/job/query; less "infrastructure health," more "job health" | CloudWatch + node-level metrics (CPU, memory, disk, network) — you're monitoring both the job AND the machine it runs on |
| **Security model** | IAM execution roles per function/job; no OS/network layer to secure directly | IAM + you also own OS patching, security groups, and (for self-managed Kafka) broker-level hardening |
| **High availability** | Built in — AWS manages multi-AZ redundancy for you | You configure and pay for multi-AZ/multi-node redundancy yourself |
| **Best use case** | Intermittent, unpredictable, or bursty workloads; teams wanting minimal infrastructure ownership; new/uncertain workloads before volume is known | Steady, large, predictable, sustained workloads; teams with existing ops capability; cost optimization once volume is well understood |
| **When NOT to use** | Sustained, high, predictable 24/7 volume where idle-cost-avoidance no longer matters and the pay-per-use premium adds up | Spiky/unpredictable workloads, or teams that explicitly want to avoid infrastructure management overhead |
| **Exam favorite phrase** | "least operational overhead," "no infrastructure to manage," "unpredictable/spiky traffic," "pay only for what you use" | "most cost-effective at scale," "sustained high throughput," "already have Kafka/Spark expertise," "predictable, steady workload" |

### 2b. Per-service quick reference

| Service pair | Serverless option | Cluster/provisioned option | Where the line is drawn |
|---|---|---|---|
| **Ad-hoc SQL on S3** | **Athena** — no cluster to choose, ever | *(no cluster equivalent — Athena has no provisioned mode)* | Athena is serverless by definition; the real comparison for this row is Athena (serverless SQL) vs. Redshift (loading data into a warehouse) — see `ZeroETL-vs-DMS-vs-Glue.md`'s and `Lakehouse.md`'s discussions of that boundary |
| **ETL / Spark jobs** | **Glue** (serverless Spark, DPU-based) or **EMR Serverless** | **EMR on EC2** (self-managed cluster sizing, or with Managed Scaling) | Glue/EMR Serverless win on ops simplicity and spiky job schedules; EMR on EC2 wins on very large, steady, cost-tuned (reserved/spot) workloads and when you need control over Spark/Hadoop ecosystem versions and low-level tuning |
| **Event-driven compute** | **Lambda** | *(no direct cluster equivalent — closest is a persistently running EC2/ECS service)* | Lambda is the default for short (≤15 min), event-triggered compute; anything longer-running or requiring specialized runtime/GPU belongs on EC2/ECS/EMR, not forced into Lambda |
| **Data warehouse** | **Redshift Serverless** (RPU-hours) | **Redshift provisioned** (node-hours, Reserved Instances) | Serverless wins for unpredictable/intermittent BI load and dev/test; provisioned wins for large, steady, highly concurrent, cost-optimized production BI at scale |
| **Streaming platform** | **Kinesis Data Streams (on-demand)**, **MSK Serverless** | **Kinesis (provisioned shards)**, **MSK (provisioned brokers)**, **self-managed Kafka on EC2** | Self-managed Kafka on EC2 is the extreme cluster end — maximum control, maximum ops burden, and almost never the "least operational overhead" answer unless the scenario explicitly forces it (rare, and usually a distractor) |
| **Stream processing** | **Amazon Managed Service for Apache Flink** (serverless-ish, KPU-based autoscaling) | Self-managed Flink/Spark Streaming on EMR on EC2 | Managed Flink handles scaling and checkpointing infrastructure for you; EMR on EC2 gives full control at the cost of operating the cluster |

---

## 3. Decision tree

```
┌────────────────────────────────────────────────────────────────┐
│ START: Is the workload's volume STEADY, LARGE, and PREDICTABLE,  │
│ running at high utilization nearly continuously (e.g., a 24/7    │
│ production warehouse, a constant multi-TB/day ETL pipeline)?      │
└───────────────────────────────┬───────────────────────────────┘
                                 │
                ┌─────────────────┴─────────────────┐
               YES                                   NO — spiky,
                │                                     intermittent,
                │                                     unpredictable,
                │                                     or unknown volume
    Is "least operational overhead"                    │
    or "no infrastructure to manage"                    │
    an EXPLICIT stated requirement                        │
    even at this scale?                                    │
        │                                                    │
   ┌──────┴──────┐                                  ┌──────────▼──────────┐
  YES             NO                                │      SERVERLESS       │
   │               │                                │ (Athena / Glue /      │
   │        ┌──────▼──────┐                         │  Lambda / Redshift    │
   │        │   CLUSTER /  │                         │  Serverless / EMR     │
   │        │  PROVISIONED │                         │  Serverless)          │
   │        │ (cheapest at │                         │ Cold start and per-   │
   │        │ sustained    │                         │ use pricing are both  │
   │        │ scale, esp.  │                         │ acceptable trade-offs │
   │        │ w/ Reserved  │                         │ against near-zero     │
   │        │ Instances)   │                         │ idle cost and zero    │
   │        └─────────────┘                         │ ops burden             │
   │                                                  └───────────────────────┘
┌──▼───────────────────────────────────────────────┐
│  CONFLICT CASE — the two signals point opposite     │
│  ways. Read which phrase the question actually       │
│  used, and whether it's asking for "least ops" or     │
│  "most cost-effective." If both appear together,      │
│  the exam usually wants you to recognize this AS THE  │
│  TRAP and pick whichever the scenario weights harder  │
│  (usually cost, if a specific $ or utilization number  │
│  is given; ops, if only qualitative language is used). │
└───────────────────────────────────────────────────┘
```

---

## 4. Worked scenarios

**Scenario A — An analyst runs ad-hoc SQL queries against S3 data a few
times a week, volume and timing unpredictable, and the team has no one
dedicated to managing a warehouse.** *Winner: Athena.* Zero
infrastructure, pay only per query, no cluster ever sized or idle.
There's no "provisioned" competitor here at all — this is the cleanest
possible serverless case.

**Scenario B — A retail company runs a multi-TB nightly Spark ETL job,
every single night, at a consistent and well-understood data volume,
and cost efficiency at that predictable scale is the stated priority.**
*Winner: EMR on EC2 with Reserved Instances or Spot for non-critical
stages.* The workload is steady and predictable — exactly the profile
where paying for capacity 24/7 (discounted via Reserved Instances) beats
paying the serverless per-DPU premium on a job that runs at full tilt
every night regardless. Glue or EMR Serverless would work correctly,
just not as cheaply at this specific scale and cadence.

**Scenario C — A gaming company's IoT telemetry ingestion is wildly
spiky: near zero traffic most of the day, 50x spikes during peak
evening play sessions, and the team wants to avoid managing any
servers.** *Winner: Lambda (event processing) + Glue (batch
transformation) + Redshift Serverless or Athena (analytics) — the full
serverless stack.* Paying for idle capacity 20 hours a day to be ready
for 4 hours of spikes is the exact waste that serverless pay-per-use
pricing eliminates, and "avoid managing servers" is an explicit,
stated requirement here.

**Scenario D — A large bank runs a Redshift-backed BI platform with
hundreds of concurrent analysts querying nearly around the clock,
utilization consistently high, and finance has explicitly asked for
the lowest possible three-year total cost of ownership.** *Winner:
Redshift provisioned with Reserved Instances (or a Reserved-Instance-
backed Redshift Serverless commitment, if usage patterns still vary
enough to want auto-scaling on top of a cost commitment).* "Explicitly
asked for lowest 3-year TCO" plus "consistently high utilization" is
the textbook signal for provisioned capacity with a Reserved Instance
discount over pure on-demand serverless RPU pricing.

---

## 5. Exam traps

| Trap | The correction |
|---|---|
| **Assuming serverless is always cheaper** | False at sustained, high, predictable utilization — provisioned/Reserved capacity frequently wins on raw cost once idle-time waste stops being the dominant factor. |
| **Assuming "least operational overhead" always wins regardless of cost signals** | Not when the question gives you a specific cost, TCO, or "cost-effective at scale" requirement — that phrase is a deliberate pivot toward the provisioned answer even if it means more ops burden. |
| **Ignoring cold start when "real-time" or "sub-second" appears alongside a serverless option** | Lambda/Glue/EMR Serverless cold starts (milliseconds to a few minutes depending on the service) can violate a strict low-latency requirement; a scenario emphasizing consistent sub-second response at all times may need a warm, provisioned resource instead. |
| **Treating self-managed Kafka on EC2 as ever being the "least operational overhead" answer** | It almost never is — it's the maximum-ops-burden end of the entire spectrum in this file. If the scenario says "least operational overhead" for streaming, the answer is Kinesis on-demand or MSK Serverless, never self-managed Kafka on EC2. |
| **Forgetting Redshift Serverless exists and defaulting to "must choose provisioned Redshift for any Redshift question"** | Redshift Serverless is a fully valid, current, exam-relevant option — pick it whenever usage is unpredictable/intermittent or the scenario stresses low ops overhead, even for production BI. |
| **Assuming EMR Serverless and EMR on EC2 are interchangeable with identical cost behavior** | They are not — EMR Serverless bills per vCPU/memory-second actually used (no idle cost, but has a cold-start ramp), while EMR on EC2 bills per instance-hour regardless of utilization (no cold start once running, but pays for idle capacity between jobs unless carefully scheduled/terminated). |
| **Missing that Reserved Instances/Savings Plans change the cost comparison entirely** | A "cluster is always more predictable but serverless is always cheaper for spiky work" mental model breaks once Reserved Instances enter the picture — always check whether the scenario mentions long-term/steady commitment, which unlocks provisioned discount pricing that flips the cost comparison. |
| **Assuming Lambda can run any batch job "serverlessly" given enough patience** | Lambda has a hard 15-minute execution timeout — a long-running batch transform belongs on Glue, EMR (Serverless or EC2), or Step Functions orchestrating longer-running compute, not Lambda, regardless of how "serverless" the scenario wants to sound. |

---

## 6. Real-company examples

**Serverless side — a seed-stage fintech startup's fraud-scoring
pipeline.** Traffic is unpredictable (dependent on marketing campaigns
and merchant partner volume), the team is three engineers with no
dedicated infrastructure staff, and monthly cloud spend needs to track
actual usage closely for runway planning. The full stack — Lambda for
event processing, Glue for batch enrichment, Athena for ad-hoc
investigation, Redshift Serverless for the compliance team's reporting
— means the company pays close to nothing during quiet periods and
scales automatically during a viral spike, with zero dedicated platform
engineers required.

**Cluster side — a national telecom's nightly call-detail-record (CDR)
processing pipeline.** Volume is enormous (billions of records nightly)
but also extremely predictable — the same volume profile, night after
night, year after year. Running this on EMR on EC2 with a mix of
Reserved Instances for the baseline and Spot Instances for
burst-tolerant stages costs a fraction of what running the same nightly
volume through EMR Serverless would, because the workload never
benefits from serverless's "pay for idle avoidance" value proposition —
it's never idle during its run window, and its run window is the same
every single night.

---

## 7. Practice questions (12)

**Q1.** A team runs ad-hoc SQL queries against S3 data a few times a
week with no predictable schedule, and has no dedicated infrastructure
staff. What is the best-fit service?

- A. **Amazon Athena — ✓** Serverless, pay-per-query, zero
  infrastructure to size or manage — matches an unpredictable, low-
  frequency access pattern exactly.
- B. Redshift provisioned — ✗ Requires sizing and paying for a cluster
  that would sit idle most of the week; wrong fit for infrequent,
  unpredictable access.
- C. EMR on EC2 — ✗ A cluster-management burden for a use case that
  needs none; also the wrong tool for SQL analytics.
- D. Self-managed Kafka on EC2 — ✗ Unrelated to SQL querying entirely;
  a streaming platform, not a query engine.

**Q2.** A nightly Spark ETL job processes a consistent, well-understood
multi-TB volume every night, and the team explicitly wants the lowest
possible cost at that predictable scale. What should they choose?

- A. AWS Glue (serverless) — ✗ Works correctly but typically costs more
  at this specific steady, high-utilization profile than a properly
  discounted provisioned cluster.
- B. **EMR on EC2 with Reserved Instances (and Spot for tolerant
  stages) — ✓** Steady, predictable, high volume is exactly the profile
  where provisioned + Reserved Instance discounts beat serverless
  pay-per-use pricing.
- C. Lambda — ✗ 15-minute execution timeout makes it unsuitable for a
  multi-TB batch Spark job regardless of cost considerations.
- D. EMR Serverless — ✗ Removes ops burden but, like Glue, typically
  costs more than a Reserved-Instance-backed cluster at this exact
  steady, high-utilization profile.

**Q3.** What is a "cold start," and which of these services is most
exposed to it?
- A. **The delay before a serverless resource's first unit of work
  begins after being idle — Lambda, Glue jobs, and EMR Serverless all
  exhibit it to varying degrees — ✓** Correct definition and correct
  category of affected services.
- B. The time it takes a provisioned cluster to boot for the very first
  time it's ever created — ✗ That's initial provisioning, a one-time
  event, not the repeating "idle-to-active" cold start this term
  describes.
- C. A security vulnerability present only in cluster-based services —
  ✗ Not a security concept at all.
- D. The natural performance degradation of an EC2 instance over time
  without patching — ✗ Unrelated; that's a maintenance/drift issue, not
  a cold start.

**Q4.** A large bank's BI platform runs near-continuous, high-
utilization Redshift queries around the clock, and finance has asked
for the lowest three-year total cost of ownership. Which is the
strongest signal in this scenario, and what does it point to?

- A. "BI platform" alone signals Redshift Serverless — ✗ Not the
  deciding signal; Redshift Serverless remains valid for BI generally,
  but this scenario's specific signals point elsewhere.
- B. **"Near-continuous, high-utilization" plus "lowest three-year TCO"
  signals Redshift provisioned with Reserved Instances — ✓** Sustained
  high utilization plus an explicit long-horizon cost commitment is the
  textbook provisioned/Reserved-Instance profile.
- C. "Around the clock" alone signals Lambda should replace Redshift —
  ✗ Lambda is not a data warehouse substitute.
- D. Nothing in the scenario changes the default recommendation of
  Redshift Serverless — ✗ Ignores the explicit sustained-utilization and
  long-term-cost signals that flip the recommendation.

**Q5.** Which statement correctly distinguishes EMR Serverless from EMR
on EC2 in terms of cost behavior?

- A. Both bill identically, per instance-hour regardless of utilization
  — ✗ False; this describes EMR on EC2 only.
- B. **EMR Serverless bills per vCPU/memory-second of actual usage with
  no idle cost, while EMR on EC2 bills per instance-hour whether or not
  the cluster is doing work — ✓** Correct cost-model distinction.
- C. EMR Serverless requires Reserved Instances to operate — ✗ Reserved
  Instances apply to EC2/provisioned capacity, not to the Serverless
  billing model.
- D. EMR on EC2 has no idle cost because it can be paused for free — ✗
  A running (even idle) EMR on EC2 cluster continues to accrue
  instance-hour charges unless explicitly terminated.

**Q6.** A scenario describes a streaming platform requirement with the
phrase "least operational overhead" and no mention of existing Kafka
tooling. Which of the following would be the WRONG choice, and why?

- A. Kinesis Data Streams on-demand — this is a valid, correct choice,
  not the wrong one — ✗ mislabeled; on-demand Kinesis is a strong fit
  for "least operational overhead."
- B. MSK Serverless — this is also a valid, correct choice — ✗
  mislabeled; MSK Serverless minimizes broker management overhead.
- C. **Self-managed Kafka on EC2 — ✓ Correct answer to "which is
  wrong."** This is the maximum-ops-burden option in the entire
  streaming spectrum and directly contradicts "least operational
  overhead" with no Kafka-tooling requirement to justify it.
- D. Amazon Data Firehose (for simple delivery, no custom processing
  needed) — a valid, correct choice for that narrower use case — ✗
  mislabeled; Firehose is also a low-ops option when its narrower
  feature set fits.

**Q7.** True or false: a workload with wildly spiky, unpredictable
traffic and no dedicated infrastructure staff is best served by a
provisioned cluster sized for peak load.

- A. False — ✓ Sizing a provisioned cluster for peak load while traffic
  is mostly idle wastes money on unused capacity most of the time; the
  serverless pay-per-use model matches spiky, unpredictable traffic far
  better, especially absent dedicated ops staff.
- B. True, because provisioned clusters have no cold start — ✗ True as
  a fact about cold starts, but doesn't outweigh the idle-cost waste and
  ops burden this scenario explicitly wants to avoid.
- C. True, because provisioned clusters are always cheaper — ✗ False in
  general, and specifically false for spiky/unpredictable workloads.
- D. False, because provisioned clusters cannot scale at all — ✗
  Overstated; provisioned clusters can scale (manually or via
  auto-scaling policy), it's just slower and less naturally suited to
  unpredictable spikes than serverless auto-scaling.

**Q8.** Why can Lambda not be used for a 40-minute nightly batch
transformation job, regardless of how well it otherwise fits a
serverless architecture?

- A. Lambda does not support scheduled/triggered invocation — ✗ False;
  Lambda supports EventBridge-scheduled triggers.
- B. **Lambda has a hard 15-minute maximum execution timeout, which a
  40-minute job exceeds — ✓** The specific, hard technical constraint
  that rules Lambda out here.
- C. Lambda cannot read from S3 — ✗ False; Lambda commonly reads from S3.
- D. Lambda requires a provisioned cluster to run — ✗ False; Lambda is
  itself a serverless compute service with no cluster to provision.

**Q9.** A team wants a data warehouse workload where usage is
unpredictable and intermittent (dev/test environment, sporadic ad-hoc
analyst queries), and minimizing idle cost matters most. What's the
best fit?

- A. **Redshift Serverless — ✓** RPU-hours only accrue when queries
  actually run; matches unpredictable, intermittent usage with minimal
  idle cost.
- B. Redshift provisioned, always-on — ✗ Accrues full node-hour cost
  even during long idle stretches — the opposite of what's wanted here.
- C. Redshift provisioned with Reserved Instances — ✗ Reserved
  Instances optimize for steady, predictable, high utilization, the
  opposite profile of "unpredictable and intermittent."
- D. EMR on EC2 — ✗ Not a data warehouse service at all; a Spark/Hadoop
  processing platform.

**Q10.** What is the core reasoning error in the statement "serverless
services always have lower total cost than provisioned/cluster
services"?

- A. There is no error; the statement is always true — ✗ False as a
  general claim; disproven directly by sustained, high-utilization
  scenarios where Reserved Instance/Savings Plan-backed provisioned
  capacity is cheaper.
- B. **It ignores that pay-per-use pricing carries a premium that only
  pays off when idle time is significant; at sustained high utilization,
  that idle-avoidance benefit disappears and provisioned/Reserved
  pricing usually wins — ✓** Correct diagnosis of the reasoning error.
- C. Serverless services cannot process large data volumes at all — ✗
  False; serverless services (Glue, EMR Serverless, Athena) routinely
  process very large volumes.
- D. Provisioned services are always more secure — ✗ Not a cost
  argument, and not a generally true security claim either.

**Q11.** A gaming company's IoT telemetry pipeline sees near-zero
traffic most of the day and 50x spikes during evening peak play
sessions. The team wants to avoid managing any servers. Which
combination best fits?

- A. EMR on EC2 sized for peak load, running 24/7 — ✗ Massively wastes
  money on idle capacity during the 20 hours a day with near-zero
  traffic, and directly contradicts "avoid managing any servers."
- B. **Lambda for event processing plus Glue for batch transformation
  plus Redshift Serverless/Athena for analytics — ✓** A fully
  serverless stack that scales automatically with the spikes and costs
  almost nothing during the long idle stretches, with zero servers to
  manage.
- C. Self-managed Kafka on EC2 for ingestion, sized for peak — ✗ The
  highest-ops-burden option available, directly contradicting "avoid
  managing any servers," and also wastes money sized for a 4-hour peak
  running all day.
- D. Redshift provisioned, always-on, for both ingestion and analytics
  — ✗ Redshift is not an ingestion service, and an always-on cluster
  wastes money during 20 idle hours a day.

**Q12.** Which of the following is the clearest example of the exam
deliberately placing "least operational overhead" and "most
cost-effective at scale" in conflict within the same scenario?

- A. A scenario that only mentions cost, with no operational-overhead
  language at all — ✗ No conflict present; only one signal is given.
- B. A scenario that only mentions operational overhead, with no cost
  language at all — ✗ No conflict present; only one signal is given.
- C. **A scenario describing a steady, high-utilization, large-scale
  workload that ALSO explicitly states the team wants zero
  infrastructure to manage — ✓** This is exactly the conflict case from
  the decision tree: the scale/utilization profile favors provisioned/
  Reserved cost savings, while the explicit "zero infrastructure"
  requirement favors serverless — forcing a judgment call based on
  which phrase the question weights harder.
- D. A scenario with no volume, cost, or operational-overhead
  information at all — ✗ Nothing to evaluate; not a conflict, just an
  underspecified question.
