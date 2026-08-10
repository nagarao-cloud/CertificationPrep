# Amazon EventBridge

> Service file. Domain coverage: primarily **Domain 1** (event-driven
> ingestion/orchestration triggers) with a secondary role in **Domain 3**
> (operational alerting — "notify when a Glue job fails").
>
> One-line identity: **the content-aware event router of AWS** — it
> decides *which* downstream target gets *which* event, based on the
> event's own payload, not just "who's subscribed."

## CONTENTS

1. [8-step teaching pass](#steps)
2. [Per-service coverage checklist](#checklist)
3. [Core concepts — buses, rules, targets](#core)
4. [EventBridge Scheduler (distinct from rules)](#scheduler)
5. [EventBridge Pipes](#pipes)
6. [Archive and replay](#archive)
7. [EventBridge vs Step Functions vs SNS vs SQS](#comparison)
8. [Decision tree](#tree)
9. [Production architecture](#prod)
10. [Exam traps](#traps)
11. [Interview questions](#interview)
12. [Cheat sheet](#cheat)
13. [Mnemonics](#mnemonics)
14. [15 practice questions](#questions)

---

<a name="steps"></a>
## 1. 8-step teaching pass

### Step 1 — Explain like I'm 12

Imagine a school office that gets messages all day — "Sarah is sick,"
"the gym is booked," "a new student enrolled." A dumb office would
just yell every message to every teacher in the building. EventBridge
is a **smart office assistant**: it reads each message and decides,
based on *what the message actually says*, exactly which teachers need
to hear it. "New student enrolled" goes to the homeroom teacher and
the registrar. "Gym is booked" goes only to the PE teacher. Nobody
gets messages that don't apply to them, and the assistant can also
follow a clock — "every morning at 8 AM, remind the janitor to unlock
the gym" — even if nobody sent a message about it at all.

### Step 2 — Explain technically

Amazon EventBridge is a **serverless event bus** service. Producers
(AWS services, your own applications, or 40+ SaaS partners) publish
JSON events onto an **event bus**. **Rules** attached to that bus
evaluate an **event pattern** (a JSON matching expression) against
every incoming event and, on a match, invoke one or more **targets**
(Lambda, Step Functions, SQS, SNS, Kinesis, Firehose, ECS tasks, API
destinations, and 20+ others). A separate capability, **EventBridge
Scheduler**, generates events purely from **time** (cron/rate
expressions or one-time schedules), with no event pattern involved at
all. EventBridge is fundamentally a **routing and filtering** layer —
it holds no state about a multi-step process and does not track
whether a downstream target ultimately "completed" anything.

### Step 3 — Explain like a Senior AWS Data Engineer

The instinct a senior engineer has is: **EventBridge is the nervous
system, not the brain.** It's the right tool the instant a
requirement is phrased as "when X happens, route it to Y" or "on this
schedule, kick off Z" — with **no need to track state across multiple
steps**. The moment a requirement adds "and if step 2 fails, retry
with backoff, then branch to a different path depending on the
result," that's a **workflow**, and EventBridge should hand off to
**Step Functions** rather than try to encode branching logic inside
event rules themselves. A second instinct: EventBridge's content-based
filtering is what separates it from **SNS** — SNS delivers *everything*
published to a topic to *every* subscriber (topic-based fan-out only);
EventBridge inspects the event body itself and only routes matching
events to matching targets, which is a fundamentally more expressive
model for "notify Team A only when `orderTotal > 10000` and
`region = "us-east-1"`."

### Step 4 — Production architecture

See [section 9](#prod) for the full annotated diagram — it covers a
realistic pipeline: S3 upload → EventBridge → content-filtered fan-out
to Step Functions (complex path) and Lambda (simple path) → archive
for replay → DLQ for failed target invocations.

### Step 5 — Exam traps

See [section 10](#traps).

### Step 6 — Interview questions

See [section 11](#interview).

### Step 7 — Cheat sheet

See [section 12](#cheat).

### Step 8 — Memory tricks

See [section 13](#mnemonics).

---

<a name="checklist"></a>
## 2. Per-service coverage checklist — EventBridge

| Dimension | Detail |
|---|---|
| **Purpose** | Serverless event bus for content-based routing between AWS services, custom apps, and SaaS partners; plus a separate scheduling engine (EventBridge Scheduler) |
| **When to use** | Decoupled event-driven architectures; routing based on event *content*, not just topic; scheduled/cron-based triggers; reacting to AWS service state changes (Glue job SUCCEEDED/FAILED, EC2 state change, S3 object created) |
| **When NOT to use** | Multi-step workflows needing state tracking, retries-with-branching, or a visual execution history (use Step Functions); simple "broadcast to every subscriber" pub/sub with no filtering need (plain SNS is cheaper/simpler); sub-millisecond ordering guarantees (not EventBridge's design goal) |
| **Advantages** | Fully serverless, no infrastructure; native integration with 200+ AWS services as event sources; content-based filtering (not just topic matching); SaaS partner event sources built in; archive & replay; schema registry/discovery |
| **Limitations** | At-least-once delivery (your target must be idempotent); default bus quota of ~2,400 `PutEvents` per second per Region per bus (soft limit, raisable); events must be ≤ 256 KB; rules per bus quota (soft, raisable); no built-in state tracking across a chain of targets |
| **Pricing** | Custom/partner events: **billed per million events published** (default bus for AWS-service-generated events is free — you don't pay to *receive* AWS service events, only to publish custom events); archive storage billed per GB; Scheduler invocations billed per million; Pipes billed separately per throughput |
| **Performance** | Typical delivery latency under a second for rule matching + target invocation; Scheduler can fire with sub-minute precision |
| **Scaling** | Fully automatic — no shards, no partitions, no capacity to plan |
| **Security** | IAM resource policies on the event bus (cross-account), IAM policy on `PutEvents`/rule management, KMS encryption for archives, VPC endpoint (interface) for private `PutEvents` |
| **High availability** | Regional managed service, multi-AZ by design, no single point of failure to architect around |
| **Failure scenarios** | Target invocation fails repeatedly → after retry policy exhausts, event goes to a configured **DLQ** (if set) or is dropped (if not) — forgetting to attach a DLQ is the single most common production gap |
| **Common mistakes** | Not attaching a DLQ to a rule target and silently losing failed events; writing an overly broad event pattern that matches unintended events; assuming EventBridge guarantees ordering (it does not); using EventBridge to replace a workflow that actually needs Step Functions' state and branching |
| **Exam traps** | Picking EventBridge when the scenario needs state/branching (Step Functions is correct); picking SNS when the scenario needs content filtering (EventBridge is correct); confusing EventBridge Scheduler with a "rule with a schedule expression" — Scheduler is the newer, purpose-built, higher-scale answer |
| **Enterprise example** | A logistics company publishes a `ShipmentStatusChanged` event on every warehouse scan; EventBridge rules route `status = "DELAYED"` events to a Lambda that pages the ops team, `status = "DELIVERED"` events to a Step Functions workflow that triggers customer billing and satisfaction survey, and archives every event for 90 days for replay during a post-incident review |

---

<a name="core"></a>
## 3. Core concepts — buses, rules, targets

```
   Event Source                Event Bus              Rule                    Target(s)
   -------------                ---------              ----                    ---------
   AWS service   ----publish--->  default bus  --pattern match-->  Lambda
   Your app      ----PutEvents--> custom bus   --pattern match-->  Step Functions
   SaaS partner  ----------------> partner bus --pattern match-->  SQS / SNS / Firehose
                                                                     API destination
                                                                     ECS RunTask
                                                                     CloudWatch Logs
```

Reading left to right: every event lands on exactly **one bus** —
the **default bus** (pre-created in every account, automatically
receives events from 200+ AWS services with zero configuration), a
**custom bus** (you create it, typically to isolate one application
or team's events, or to receive events from another AWS account), or
a **partner bus** (created when you activate a SaaS integration —
Zendesk, Datadog, PagerDuty, Salesforce, etc.). Each bus has its own
independent set of **rules**. A rule contains an **event pattern** — a
JSON structure that is matched, field by field, against incoming
events — and one or more **targets** invoked when the pattern matches.

**Event pattern example (content-based filtering, the feature that
distinguishes EventBridge from plain pub/sub):**

```json
{
  "source": ["custom.orders"],
  "detail-type": ["OrderPlaced"],
  "detail": {
    "orderTotal": [{"numeric": [">", 10000]}],
    "region": ["us-east-1", "us-west-2"]
  }
}
```

This rule fires **only** for events where the source and detail-type
match **and** the nested `detail.orderTotal` is numerically greater
than 10,000 **and** `detail.region` is one of two listed values. This
is the mechanic that IAM, SNS topic subscriptions, and SQS cannot
replicate on their own — filtering on arbitrary fields *inside* the
event payload, including numeric comparisons, prefix matching, and
exists/does-not-exist checks. SNS message filtering can filter on
**message attributes** (metadata set alongside the message), but
EventBridge filters on the **event body itself**, which is a richer
and more natural fit when the event is already structured JSON from
an AWS service or another system.

**Multiple targets per rule.** A single rule can fan out to **up to 5
targets**, each invoked independently and in parallel — this is the
built-in "fan out based on content" pattern: one `OrderPlaced` event,
matched by one rule, simultaneously triggers a billing Lambda, an
inventory-decrement Step Functions execution, and an SQS message for
the fulfillment queue, with no code gluing those together.

**Retry and dead-letter queue (DLQ).** Every rule target has a
configurable **retry policy** (max retry attempts, maximum event age)
and an optional **DLQ** (an SQS queue) that receives the event if all
retries are exhausted. Without a DLQ configured, an event that
repeatedly fails to reach its target is **silently dropped** after
retries expire — this is the single most tested operational gap for
this service.

---

<a name="scheduler"></a>
## 4. EventBridge Scheduler (distinct from basic rules)

**This is a genuinely separate capability from a rule with a schedule
expression, and the exam wants you to know the difference.**

Historically, the only way to get a time-based trigger out of
EventBridge was a **rule** with a `schedule` event pattern (cron or
rate expression) instead of an event pattern — this still exists and
still works, and is what the older term "CloudWatch Events" (the
predecessor product) originally offered.

**EventBridge Scheduler** is a newer, purpose-built, separate feature
that solves the same problem at much larger scale and with more
flexibility:

| Attribute | Schedule expression on a **rule** | **EventBridge Scheduler** |
|---|---|---|
| Max schedules per account/Region | Low thousands (bus rule quota) | **Millions** — designed for massive fleets of one-off and recurring schedules |
| One-time schedules | Awkward (rule stays live forever unless manually deleted) | **Native** — "run once at 2026-08-20 14:00 UTC," auto-deletes after firing (optional) |
| Recurring (cron/rate) | ✅ | ✅ |
| Flexible time windows | ❌ | ✅ Spread invocations across a window to avoid a thundering herd |
| Per-schedule retry/DLQ config | Rule-level only | **Per-schedule** configuration |
| Time zone support | UTC only | ✅ Native time zone support (fires at 9 AM **local** time, handles DST) |
| Target types | Any rule target | Any EventBridge target, same target catalog |
| Typical use case | A handful of fixed cron jobs | Per-customer, per-tenant, or per-resource individual schedules generated programmatically (e.g., "schedule a reminder for every one of our 2 million customer trial expirations") |

**The exam-relevant distinction, stated once:** if the scenario says
**"run this once a day at 2 AM, cheapest, simplest"** — a plain rule
with a schedule expression, or EventBridge Scheduler, both work, but
Scheduler is the modern default answer AWS now steers toward. If the
scenario says **"generate a unique, one-time schedule per customer
event, potentially millions of them,"** the answer is unambiguously
**EventBridge Scheduler** — a rule-based schedule cannot scale to that
cardinality gracefully (you'd need one rule per schedule, hitting the
low-thousands rule quota fast).

```
   Rule + schedule expression:  a few fixed, org-known cron jobs
   EventBridge Scheduler:       programmatically created, high-cardinality,
                                 per-entity, one-time-capable schedules
```

---

<a name="pipes"></a>
## 5. EventBridge Pipes

**Purpose.** Pipes is a **point-to-point** integration that connects
one **source** (Kinesis, DynamoDB Streams, SQS, MSK, Amazon MQ, or
self-managed Kafka) to one **target**, with optional **filtering** and
optional **enrichment** (a Lambda, Step Functions, or API Gateway call
that transforms the payload) in between.

```
   Source (e.g. Kinesis stream / DynamoDB Streams)
        |
        v
   [ optional FILTER ]  -- only matching records continue
        |
        v
   [ optional ENRICHMENT ]  -- Lambda/Step Functions/API Destination
        |                       transforms or augments the payload
        v
   Target (any EventBridge target: Step Functions, Lambda, SQS, ...)
```

**Pipes vs a rule on the default bus.** A standard EventBridge rule
reacts to events already published to a bus. **Pipes exists to remove
the polling/consumer code** you would otherwise have to write to read
from a stream (Kinesis/DynamoDB Streams/SQS/MSK) and manually call
`PutEvents`. Pipes handles that polling natively and pushes matching,
optionally-enriched records straight to a target — no Lambda consumer
function required just to bridge a stream into EventBridge or another
target. This is the answer whenever a scenario says **"consume from a
Kinesis stream / DynamoDB Streams and route to Step Functions with
minimal code, optionally transforming the payload first."**

| Attribute | EventBridge Rule | EventBridge Pipes |
|---|---|---|
| Trigger | Event already on a bus | Pulls directly from a stream/queue source |
| Fan-out | ✅ Up to 5 targets | ❌ **One target only** (point-to-point) |
| Filtering | ✅ Event pattern | ✅ Filter pattern |
| Enrichment (transform before delivery) | ❌ (target must do its own transform) | ✅ Built-in enrichment step |
| Best use case | Content-based fan-out from a bus | Stream-to-target integration without writing a consumer |

---

<a name="archive"></a>
## 6. Archive and replay

```
   Event Bus  --(archive rule, all or filtered events)-->  Archive (S3-backed, managed)
                                                                    |
                                                          Replay(startTime, endTime)
                                                                    |
                                                                    v
                                                          Re-delivers matching events
                                                          through the SAME rules,
                                                          to the SAME targets, as if
                                                          they arrived again NOW
```

**Archive** captures a copy of events flowing through a bus (all
events, or filtered to a subset) and retains them for a configurable
period (or indefinitely). **Replay** re-injects archived events for a
chosen time range back through the bus's rules, hitting live targets
again. This is the mechanism for:

- **Disaster recovery / bug fix reprocessing** — a Lambda target had a
  bug for 3 hours; after deploying the fix, replay that 3-hour window
  to reprocess the events correctly, without asking the source system
  to resend anything.
- **New consumer backfill** — a new target/rule is added and needs to
  process the last 30 days of historical events to build its own
  state.
- **Audit / debugging** — replaying into a non-production bus to
  reproduce and diagnose an incident.

**Exam trap.** ⚠️ Replay does **not** guarantee original ordering or
original timing — events are replayed as fast as targets can consume
them, and interleaving with live traffic on the same bus is possible.
Replay is for **reprocessing**, not for reconstructing an exact
historical timeline.

---

<a name="comparison"></a>
## 7. EventBridge vs Step Functions vs SNS vs SQS

The required 14-column comparison matrix:

| Column | **EventBridge** | **Step Functions** | **SNS** | **SQS** |
|---|---|---|---|---|
| **Purpose** | Content-based event routing | Stateful multi-step workflow orchestration | Simple pub/sub fan-out | Point-to-point decoupling queue |
| **Speed** | Sub-second rule match + dispatch | Depends on workflow (ms–days) | Near-instant fan-out | Near-instant enqueue/dequeue |
| **Cost** | Per million custom events published | Per state transition (Standard) or per request+duration (Express) | Per million publishes/deliveries | Per million requests |
| **Serverless** | ✅ | ✅ | ✅ | ✅ |
| **Streaming support** | Via Pipes (source integration) | Via service integrations (e.g., Kinesis) | ❌ | ❌ (queue, not a stream) |
| **Batch support** | ❌ (event-at-a-time routing) | ✅ (Map/Distributed Map over large batches) | ❌ | ✅ (batch send/receive) |
| **Data volume** | High (thousands of events/sec per bus, scales automatically) | Bounded by state-transition/API throughput | High | Very high |
| **Latency** | Milliseconds to low seconds | Depends on states/waits in the workflow | Milliseconds | Milliseconds |
| **Scaling** | Fully automatic | Fully automatic | Fully automatic | Fully automatic |
| **Monitoring** | CloudWatch metrics, EventBridge event archive | Execution history (Standard), CloudWatch (Express) | CloudWatch delivery metrics | CloudWatch queue depth (`ApproximateNumberOfMessages`) |
| **Security** | IAM + resource-based bus policy, KMS on archive | IAM per-state-machine, KMS on execution data | IAM topic policy, KMS | IAM queue policy, KMS |
| **Best use case** | Route events by content to multiple decoupled targets; schedules | Multi-step processes needing retries, branching, state, human approval | Simple broadcast to many subscribers, no filtering logic needed | One producer, one (or a few) consumer(s), guaranteed decoupling |
| **When NOT to use** | Needs state tracking across steps | Extremely high-volume simple pass-through routing | Content-based filtering needed (use EventBridge) | Fan-out to many independent subscribers (use SNS or EventBridge) |
| **Exam favorite** | "route based on event content," "SaaS event source," "schedule at scale" | "state," "branching," "retries with backoff," "human approval," "parallel processing" | "simple pub/sub," "notify all subscribers" | "decouple producer from consumer," "buffer" |

### When EventBridge wins over Step Functions

EventBridge wins the moment the requirement is **simple routing or
scheduling with no need to track state across multiple steps**. If
the entire job is "when event X happens, invoke Y" — one hop, no
branching, no retries-with-different-paths, no need to know "we're
currently on step 3 of 7" — EventBridge alone is simpler, cheaper, and
has nothing extra to operate. The moment a requirement needs **any**
of: sequencing across multiple services, conditional branching based
on an intermediate result, a human-approval wait step, or a durable
execution history you can inspect step-by-step, **Step Functions**
is correct, typically **triggered by** an EventBridge rule (the two
are complementary, not exclusive — EventBridge is very often the
*entry point* into a Step Functions workflow).

```
   "When a file lands in S3, run one Lambda"        -->  EventBridge alone
   "When a file lands in S3, validate it, then       -->  EventBridge rule
    branch: valid -> load to Redshift,                    triggers a
    invalid -> quarantine + notify, with retries"          STEP FUNCTIONS
                                                            state machine
```

### When EventBridge wins over SNS

EventBridge wins whenever the requirement needs **content-based
filtering** — routing decisions made by inspecting fields *inside* the
event body (numeric comparisons, exists checks, prefix matches,
multi-field AND logic). SNS routes based on **topic subscription**
(and, at best, coarse **message-attribute** filtering set by the
publisher) — it has no concept of matching against nested JSON in the
message body itself. If the scenario is genuinely **"broadcast this
exact message to every subscriber, no conditional logic"**, plain SNS
is simpler and often cheaper. If the scenario says **"route
differently depending on what's inside the event,"** EventBridge is
correct.

---

<a name="tree"></a>
## 8. Decision tree

```
                    Do you need to trigger something based on an EVENT
                    or on a SCHEDULE?
                              |
              +---------------+----------------+
           EVENT                            SCHEDULE
              |                                  |
   Does routing depend on          Millions of unique/one-time
   content INSIDE the event?       schedules, or per-tenant?
              |                                  |
      +-------+-------+                 +--------+--------+
     YES              NO                YES               NO
      |                |                 |                 |
  EVENTBRIDGE    Plain SNS/SQS    EVENTBRIDGE          Rule + schedule
  rule with           |           SCHEDULER            expression (fine
  event pattern   (simple                              for a handful of
      |            fan-out or                          fixed cron jobs)
      |            decouple)
      v
   Does the downstream work need
   MULTIPLE STEPS, STATE, or BRANCHING?
              |
      +-------+-------+
     YES              NO
      |                |
  EventBridge     EventBridge
  rule TRIGGERS   invokes the
  STEP FUNCTIONS  target directly
  (not EventBridge  (Lambda/SQS/etc.)
   alone)
```

---

<a name="prod"></a>
## 9. Production architecture

```
   +----------------+
   | S3 Data Lake    |---(S3 Event Notification)--+
   +----------------+                              |
                                                    v
   +----------------+                    +--------------------+
   | Custom App      |--PutEvents------->|   Custom Event Bus   |
   | ("order-service")|                   |   ("orders-bus")     |
   +----------------+                    +----------+-----------+
                                                     |
                          +--------------------------+--------------------------+
                          |                           |                          |
                 Rule A: detail-type =         Rule B: detail.total    Rule C: (archive rule,
                 "ObjectCreated" AND           > 10000                  catches ALL events)
                 key prefix = "raw/"                  |                          |
                          |                           v                          v
                          v                  +-----------------+        +----------------+
                 +-----------------+         | Step Functions   |        | Archive (S3-   |
                 | Lambda: validate |         | (multi-step:     |        | backed, 90-day |
                 | schema           |         | fraud check ->   |        | retention)     |
                 +--------+---------+         | approval wait -> |        +----------------+
                          |                    | billing)         |
                    on failure:                +-----------------+
                          v
                 +-----------------+
                 | DLQ (SQS)        |
                 | -> paged on-call |
                 +-----------------+
```

**Reading the diagram.** An **S3 Event Notification** publishes
directly onto the **custom event bus** the moment a new object lands
under `raw/`. A **custom application** independently publishes
business events (`OrderPlaced`, `OrderCancelled`) onto the same bus
via `PutEvents`. Three **rules** evaluate every event landing on the
bus in parallel: **Rule A** matches only S3-object-created events
under the `raw/` prefix and invokes a validation **Lambda** — if that
Lambda's invocation ultimately fails after retries, the event lands in
a **DLQ**, which pages the on-call engineer so a failed validation is
never silently lost. **Rule B** matches only `OrderPlaced` events
where the nested `detail.total` exceeds a threshold, and routes those
(and only those) into a **Step Functions** state machine that runs a
multi-step process — fraud check, a human-approval wait state, then
billing — because that downstream process needs **state, branching,
and a wait step**, which EventBridge alone cannot express. **Rule C**
is an **archive rule** matching every event on the bus, feeding the
**archive**, so that if Rule B's Step Functions logic has a bug
discovered next week, the affected time window can be **replayed**
through the bus to reprocess correctly without asking the order
service to resend anything.

---

<a name="traps"></a>
## 10. Exam traps

- ⚠️ Picking EventBridge for a scenario that clearly needs **branching,
  retries with different paths, or a human-approval step** — that's
  **Step Functions**, often triggered *by* an EventBridge rule.
- ⚠️ Picking **SNS** when the scenario says "route based on the
  contents of the message" — SNS filters on message **attributes**,
  not deep event-body content the way EventBridge's event pattern
  does; when the filter needs to inspect nested JSON fields with
  numeric/prefix operators, EventBridge is correct.
- ⚠️ Assuming EventBridge guarantees **exactly-once** delivery or
  strict **ordering** — it is **at-least-once**, unordered across
  events; targets must be idempotent.
- ⚠️ Forgetting that a rule target **without a configured DLQ** simply
  **drops the event** after retries are exhausted — no error surfaces
  unless you explicitly wired a DLQ and an alarm on it.
- ⚠️ Using a basic rule schedule expression for a scenario describing
  **millions of individual, per-customer, or one-time schedules** —
  that cardinality is **EventBridge Scheduler**'s specific reason to
  exist, not a rule-per-schedule pattern.
- ⚠️ Assuming events published by AWS services onto the **default
  bus** cost money to receive — receiving is free; you pay to
  **publish custom events**, and to store **archives**.
- ⚠️ Choosing EventBridge Pipes when the requirement is **fan-out to
  multiple targets** — Pipes is strictly **one source → one target**;
  fan-out to several targets is a **rule's** job.
- ⚠️ Confusing **archive/replay** with guaranteed exact-timing
  reconstruction — replay reprocesses events, it does not reproduce
  the original timeline precisely.

---

<a name="interview"></a>
## 11. Interview questions

- *"How would you design a system where different teams need to react
  differently to the same stream of order events, without each team
  writing their own filtering logic?"* — One event bus, multiple
  rules, each rule's event pattern doing the content-based filtering
  for that team, each pointed at that team's own target (Lambda, SQS
  queue, Step Functions workflow). No team writes filtering code; the
  rule's JSON pattern *is* the filter.
- *"A Lambda target behind an EventBridge rule started silently
  failing last week and nobody noticed until a customer complained.
  How do you prevent that recurrence?"* — Attach a DLQ to the rule
  target, put a CloudWatch alarm on the DLQ's `ApproximateNumberOfMessagesVisible`,
  and alert on it; also review the retry policy (max attempts,
  max event age) to ensure it's appropriate for the workload.
- *"When would you choose EventBridge Pipes over a Lambda function
  that polls a Kinesis stream and calls PutEvents itself?"* — Pipes
  removes the operational burden of writing/maintaining that polling
  Lambda; it natively handles the source-poll-filter-enrich-target
  chain with less code and one less Lambda to monitor, deploy, and pay
  for on every batch.
- *"Why might you choose a rule with a schedule expression over
  EventBridge Scheduler, even though Scheduler is newer?"* — For a
  small, fixed number of well-known cron jobs, a rule is simpler to
  reason about and doesn't introduce a second scheduling primitive
  into the architecture; Scheduler's advantages (millions of
  schedules, per-schedule flexible time windows, native time zones)
  only matter once you're generating schedules programmatically at
  scale.

---

<a name="cheat"></a>
## 12. Cheat sheet

```
EVENTBRIDGE ONE-LINERS
  route by content, no state needed .......... EventBridge rule
  route by content, THEN multi-step ........... EventBridge rule -> Step Functions
  simple broadcast, no content filtering ...... SNS
  decouple one producer/consumer .............. SQS
  cron job, small fixed number ................ Rule + schedule expression
  millions of per-tenant/one-time schedules ... EventBridge Scheduler
  stream -> target, no consumer code, 1 target  EventBridge Pipes
  reprocess a historical window of events ..... Archive + Replay
  failed target invocation, don't lose it ..... Attach a DLQ to the target
  cross-account event routing ................. Custom bus + resource policy
  SaaS event source (Zendesk, PagerDuty...) ... Partner event bus
```

---

<a name="mnemonics"></a>
## 13. Mnemonics

- **"EventBridge routes, Step Functions remembers."** EventBridge has
  no memory of prior events or steps; Step Functions tracks state
  across an entire execution.
- **"Pipes = one to one. Rules = one to five."** Pipes is strictly
  point-to-point; a rule can fan out to up to 5 targets.
- **SNS = shout to a list. EventBridge = read the letter first.** SNS
  fans out to everyone on a topic; EventBridge inspects the content
  before deciding who gets it.
- **"No DLQ, no evidence."** A rule target with no DLQ that fails
  repeatedly leaves no trace of the dropped event.

---

<a name="questions"></a>
## 14. Practice questions (15, scenario-style, every option explained)

**1.** A retail company wants different teams to be notified only when
an `OrderPlaced` event's `detail.total` exceeds their team's specific
threshold, without each team writing custom filtering code. Which
EventBridge feature enables this directly?

- A) EventBridge Pipes with an enrichment Lambda per team
- B) Multiple rules on the same bus, each with its own event pattern **← correct**
- C) A single rule with five different targets and no event pattern
- D) SNS message attributes with subscription filter policies

*A is wrong — Pipes is one-source-to-one-target and isn't designed for
multi-team fan-out with independent filters. B is correct — each
team's rule expresses its own numeric-comparison event pattern against
`detail.total`, requiring zero custom filtering code. C is wrong — a
rule without an event pattern matches everything, defeating the
requirement. D is a plausible alternative architecture using SNS
message-attribute filtering, but the scenario is explicitly about
EventBridge's content-based routing of the event body, which SNS
attribute filtering does not do as naturally for nested JSON fields.*

**2.** A data engineering team needs to trigger a Lambda function
whenever a new object lands in a specific S3 prefix, with no need to
track any downstream state. What's the simplest correct architecture?

- A) S3 Event Notification → EventBridge rule → Lambda **← correct**
- B) S3 Event Notification → Step Functions → Lambda
- C) CloudTrail data event → EventBridge rule → Step Functions → Lambda
- D) S3 → SQS → Step Functions Express → Lambda

*A is correct — simple, one-hop, content-filtered (by key prefix)
routing with no state tracking need is EventBridge's exact use case.
B adds unnecessary orchestration overhead for a single-step reaction.
C is a needlessly complex, higher-latency path (data events, extra
hop) for a simple trigger. D adds two unnecessary hops (SQS, Step
Functions) for a task that needs neither queuing nor state.*

**3.** An engineering team needs to schedule a one-time reminder event
for each of 3 million customer trial expirations, each at a different,
individually computed timestamp. Which service is purpose-built for
this?

- A) A single EventBridge rule with a schedule expression
- B) EventBridge Scheduler **← correct**
- C) 3 million individual EventBridge rules, one per customer
- D) AWS Batch with a cron-scheduled job array

*A is wrong — one schedule expression fires on one recurring pattern,
not 3 million independent one-time timestamps. B is correct —
Scheduler is designed exactly for high-cardinality, per-entity,
one-time-capable schedules at millions of scale. C would hit the
per-bus rule quota almost immediately and is operationally
unmanageable. D is a batch-processing service with no native
per-entity time-based triggering model at this granularity.*

**4.** A rule's Lambda target has been failing silently for two weeks;
no error was surfaced anywhere and the team only found out from a
customer complaint. What was most likely missing from the rule
configuration?

- A) A larger Lambda memory allocation
- B) An event pattern with tighter filtering
- C) A dead-letter queue (DLQ) on the target, with an alarm **← correct**
- D) Enabling the default event bus instead of a custom bus

*A addresses a performance issue, not silent failure. B changes what
matches the rule, not what happens when a match fails downstream. C is
correct — without a DLQ, an event whose target invocation fails after
retries is simply dropped with no persisted evidence; a DLQ plus a
CloudWatch alarm on it is exactly what surfaces this. D is unrelated
to failure visibility.*

**5.** Which statement correctly distinguishes EventBridge from SNS
for a routing requirement?

- A) SNS can filter on fields nested inside the JSON message body;
  EventBridge cannot
- B) EventBridge can filter based on content inside the event body,
  including numeric comparisons; SNS filters primarily on message
  attributes **← correct**
- C) EventBridge only supports a single target per rule; SNS supports
  unlimited targets per topic
- D) SNS is serverless; EventBridge requires provisioned throughput

*A reverses the actual capability. B is correct — this is the core
distinguishing feature covered in this file. C is wrong — a rule
supports up to 5 targets, and SNS's "targets" are really independent
subscriber endpoints, not a comparable concept. D is wrong on both
counts — both are serverless with no provisioned throughput to manage.*

**6.** A team wants to reprocess all `PaymentFailed` events from the
last 6 hours after fixing a bug in the Lambda that handles them, without
asking the payment service to resend anything. What EventBridge
capability accomplishes this?

- A) Increase the rule's max event age and wait for automatic retry
- B) Archive and Replay for the affected 6-hour window **← correct**
- C) EventBridge Pipes with a backfill enrichment step
- D) Re-run the Lambda manually against CloudWatch Logs output

*A is wrong — max event age only affects events still within their
active retry window, not events from 6 hours ago that already
exhausted retries or succeeded/failed definitively. B is correct —
this is exactly what Archive + Replay exists for: re-inject a
historical window of events through the same rules/targets. C is
unrelated — Pipes doesn't have a "backfill" concept. D would require
reconstructing event payloads from log text, which is unreliable and
not how EventBridge intends this to be solved.*

**7.** A requirement states: "when a Glue job's state changes to
FAILED, notify the on-call engineer via SNS, and separately kick off a
Step Functions workflow that attempts an automated retry with
exponential backoff and, if that also fails, escalates." What's the
correct high-level design?

- A) One EventBridge rule matching the Glue job state-change event,
  with two targets: an SNS topic and a Step Functions state machine **← correct**
- B) A single Lambda function polling Glue job status every minute
- C) CloudWatch Logs Insights query scheduled hourly to detect failures
- D) SNS topic subscribed directly to Glue's internal failure events

*A is correct — Glue emits state-change events natively to
EventBridge; one rule with a FAILED-state event pattern can fan out to
both an SNS notification and a Step Functions workflow (which is
needed here specifically because of the backoff-retry-then-escalate
branching logic). B reintroduces polling overhead that EventBridge's
native event emission avoids. C is a detection mechanism with
built-in delay (hourly) unsuited to timely alerting. D is not how
Glue exposes failure events — there's no such direct SNS integration
bypassing EventBridge.*

**8.** Which of the following is at-least-once, not exactly-once, and
therefore requires idempotent targets?

- A) DynamoDB Streams
- B) EventBridge event delivery **← correct**
- C) Step Functions Standard workflow state transitions
- D) S3 strong read-after-write consistency

*A is a separate stream mechanism with its own delivery semantics
(also at-least-once, but not what's being tested here). B is
correct — EventBridge explicitly guarantees at-least-once delivery to
targets, meaning duplicate deliveries are possible and targets must
tolerate reprocessing the same event safely. C describes Step
Functions Standard's actual guarantee of exactly-once state
transitions, which is a different service and a different guarantee.
D is an unrelated consistency guarantee about object reads, not event
delivery.*

**9.** A company wants to route events from a partner SaaS tool
(PagerDuty) into their own custom processing pipeline without building
a webhook receiver themselves. What EventBridge feature enables this?

- A) EventBridge Pipes with an HTTP source
- B) A partner event bus via the SaaS integration **← correct**
- C) EventBridge Scheduler with a partner target
- D) An interface VPC endpoint configured for PagerDuty

*A is wrong — Pipes sources are AWS-native streaming services
(Kinesis, DynamoDB Streams, SQS, MSK, MQ), not arbitrary SaaS HTTP
webhooks. B is correct — EventBridge has built-in partner integrations
that create a dedicated **partner event bus** receiving events
directly from the SaaS provider, with no webhook code to write. C is
unrelated — Scheduler generates time-based events, not partner
event ingestion. D is a private-networking construct unrelated to
receiving SaaS events.*

**10.** What is the primary functional difference between EventBridge
Pipes and a standard EventBridge rule?

- A) Pipes supports content-based filtering; rules do not
- B) Pipes connects one source to one target with optional
  enrichment; rules can fan out to up to 5 targets from events already
  on a bus **← correct**
- C) Rules require a Lambda; Pipes never invokes Lambda
- D) Pipes is regional; rules are global

*A is wrong — both support filtering. B is correct — this is the
structural difference: Pipes is a point-to-point pull-filter-enrich-push
pipeline typically fed by a stream/queue source, while rules react to
events already published on a bus and can fan out to multiple targets.
C is wrong — Lambda can be used in both (as a rule target, or as a
Pipes enrichment step). D is wrong — both are regional services.*

**11.** A data platform team is deciding whether a new requirement
belongs in an EventBridge rule alone or should hand off to Step
Functions. The requirement: "when a file is validated successfully,
load it to Redshift; if the load fails, retry twice with backoff, and
if it still fails, move the file to a quarantine prefix and notify the
team — track and expose the state of each file's processing." What's
the right call?

- A) EventBridge rule alone is sufficient — Lambda can implement the
  retry logic internally
- B) Step Functions, triggered by an EventBridge rule **← correct**
- C) SNS with a retry policy on the subscription
- D) EventBridge Scheduler running the Lambda every 5 minutes to check
  status

*A technically could be forced to work by writing retry logic inside
Lambda, but that reimplements exactly what Step Functions provides
natively (Retry/Catch, backoff, branching) and loses the built-in,
inspectable execution history the requirement's "track and expose
state" phrase is asking for. B is correct — multi-step branching,
retry-with-backoff, and state visibility per file is the textbook Step
Functions use case; EventBridge is still useful here only as the
trigger. C is wrong — SNS has no retry-with-backoff-then-branch
concept. D reintroduces inefficient polling instead of event-driven
design.*

**12.** Which pricing statement about EventBridge is accurate?

- A) You are billed per event for all AWS-service-generated events
  landing on the default bus
- B) You are billed per million custom/partner events published; AWS
  service events on the default bus are free to receive **← correct**
- C) EventBridge charges only for archive storage, all publishing is
  free
- D) EventBridge uses a fixed monthly platform fee regardless of
  volume

*A is wrong — receiving native AWS service events on the default bus
does not incur a publish charge. B is correct — the billing distinction
is specifically custom/partner event publishing (and archive storage,
and Scheduler invocations), not AWS-service-originated events on the
default bus. C is incomplete — publishing custom events is billed. D
is wrong — EventBridge is usage-based, not a flat platform fee.*

**13.** A rule's event pattern is: `{"source": ["aws.s3"], "detail-type":
["Object Created"]}` with no further filtering on `detail`. What will
this rule do?

- A) Match only S3 objects created under a specific prefix
- B) Match every S3 "Object Created" event across every bucket sending
  events to this bus, regardless of key or prefix **← correct**
- C) Fail validation because `detail` is required
- D) Match only the first Object Created event per day

*A is wrong — no key-prefix constraint was specified in `detail`, so
prefix isn't filtered. B is correct — the pattern only constrains
`source` and `detail-type`; with no `detail`-level filtering, every
matching Object Created event from any bucket configured to send
events to this bus will match, which is a common accidental
over-broad-matching mistake. C is wrong — `detail` is optional in an
event pattern. D is not how event pattern matching works — there's
no built-in daily throttle.*

**14.** Why might EventBridge Scheduler's flexible time window feature
matter for a large-scale IoT reporting job?

- A) It compresses report payloads to reduce cost
- B) It spreads a large batch of near-simultaneous invocations across
  a window to avoid a thundering-herd spike on downstream targets **← correct**
- C) It automatically retries failed IoT device connections
- D) It converts cron expressions into rate expressions

*A is unrelated to scheduling. B is correct — a flexible time window
lets Scheduler jitter thousands/millions of "fire at roughly this
time" invocations across a window instead of all at the exact same
second, protecting downstream targets from a synchronized burst. C
is unrelated — that's a device/connectivity concern, not a scheduling
feature. D misdescribes the feature; it has nothing to do with
expression format conversion.*

**15.** A finance team needs cross-account event routing: Account A
publishes billing events that Account B's Step Functions workflow must
consume, without copying data or building a custom API. What's the
correct approach?

- A) Account A publishes to its own custom event bus with a resource-based
  policy granting Account B's principal `PutEvents`/rule-management
  permission, and a rule on Account B's bus (or a rule in Account A
  targeting Account B's bus) routes the event across **← correct**
- B) Account A calls Account B's Step Functions `StartExecution` API
  directly using a shared IAM user's long-lived credentials
- C) Account A writes events to an S3 bucket that Account B polls hourly
- D) Cross-account EventBridge routing is not supported; a VPC peering
  connection must be established first

*A is correct — cross-account event bus sharing via a resource-based
policy on the bus, plus a rule that targets the other account's bus,
is EventBridge's native cross-account pattern; no data copy or custom
API required. B violates the "never hardcode long-lived credentials"
principle and bypasses EventBridge entirely. C reintroduces polling
delay and unnecessary storage. D is false — EventBridge natively
supports cross-account event bus permissions without requiring VPC
peering, which is a networking construct unrelated to this
account-to-account event routing feature.*
