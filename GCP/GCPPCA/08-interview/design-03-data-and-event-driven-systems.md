# Design Interviews — Data and Event-Driven Systems

> Seventeen whiteboard questions on the *data and correctness* axis: can
> you move a record through a distributed system and still be able to say
> what it means when it lands? Written for Staff and Principal Cloud
> Architect interviews in the 2026 market, not for exam prep. Every
> answer here is what a candidate **says out loud** — first person,
> sequenced, committing to a choice and naming the constraint that forced
> it.

**How to use this file:** answer each question out loud before reading
past the clarifying-questions block. On this axis the panel is listening
for one thing above all others — whether you distinguish the *mechanism*
(at-least-once delivery, arrival-time ordering, eventual consistency)
from the *outcome* the business asked for (one charge, one ledger entry,
one correct number). The tradeoff table's last column is where that
distinction gets tested; if you can't say when your own choice is wrong,
you haven't made a choice. Org structure, security controls and platform
operations are named here but designed elsewhere — follow the
cross-references rather than redesigning them mid-answer.

## Question index

| ID | Question | Band | Axis | Domain leaves |
|---|---|---|---|---|
| D3-Q01 | Telemetry ingestion for ~2 million intermittently connected devices | Staff | data | 1.3, 2.2, 6.2 |
| D3-Q02 | Event-driven order fulfillment across six services — saga and compensation | Staff+ | data | 1.3, 4.1, 6.2 |
| D3-Q03 | Idempotency end to end — exactly-once as outcome, at-least-once as mechanism | Staff+ | data | 1.3, 6.2 |
| D3-Q04 | Real-time analytics where late data is common and materially valuable | Staff | data | 1.3, 6.2, 4.3 |
| D3-Q05 | Lakehouse/medallion serving BI and ML from one source of truth | Staff | data | 1.3, 2.2, 4.3 |
| D3-Q06 | Change data capture from 30 operational databases into analytics | Staff+ | data | 1.3, 1.4, 2.2 |
| D3-Q07 | Schema evolution so producers can change without breaking consumers | Staff | data | 1.3, 5.1 |
| D3-Q08 | "We need real-time" — interrogate the requirement, design what's needed | Staff | data | 1.2, 1.3, 4.3 |
| D3-Q09 | Multi-tenant data platform where tenants must not see each other's rows | Staff+ | data | 3.2, 1.2, 2.2 |
| D3-Q10 | Retention and erasure architecture for GDPR-style deletion requests | Staff+ | data | 3.2, 2.2 |
| D3-Q11 | Feature store and the online/offline serving split | Staff+ | data | 1.3, 2.2, 4.3 |
| D3-Q12 | Message-ordering guarantees for a payments ledger | Staff+ | data | 1.3, 6.2 |
| D3-Q13 | Dead-letter and replay an on-call engineer can actually use at 3am | Staff | data | 6.2, 4.1 |
| D3-Q14 | Cross-region analytics replication under a residency constraint | Staff+ | data | 3.2, 1.3 |
| D3-Q15 | Hot-path/cold-path split — live dashboards plus year-scale history | Staff | data | 1.3, 2.2, 4.3 |
| D3-Q16 | Designing against hotspotting — Bigtable row key and GCS prefix scheme | Staff | data | 6.2, 2.2 |
| D3-Q17 | Data contracts and the quality layer between producer and consumer teams | Principal | data | 4.1, 5.1, 1.2 |

---

### D3-Q01 — "We have about two million machines in the field and most of them are offline most of the time. Design the telemetry ingestion."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 1.3, 2.2, 6.2 |
| **Axis** | data |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D3-Q04` |

**What the interviewer is actually testing**

Whether you separate *event time* from *arrival time* in the first
sentence rather than the fortieth. At this fleet size and this
connectivity profile the pipeline is not really a stream — it's a queue
of backfills that occasionally looks like a stream. Candidates who draw
the happy path first and bolt late-data handling on at the end have
already made the mistake the scenario is built around.

**Clarifying questions to ask before drawing anything**

- **What's the distribution of offline gaps — median and worst case?** A
  median of ten minutes and a worst case of three days are the same
  sentence in a requirements document and two completely different
  pipelines. That one number sizes the on-device buffer, the allowed
  lateness, and how large a reconnect burst I have to absorb.
- **Does anything actuate on this telemetry in seconds, or is all of it
  analytics?** If a human or a machine reacts within seconds to a single
  reading, I need a genuine hot path. If the output is a maintenance
  prediction reviewed daily, I don't — and I'd rather not build one.
  That interrogation is `D3-Q08` in full.
- **How many payload versions are in the field right now?** Long-lived
  equipment means old firmware is permanent, not transitional. The
  answer decides whether schema handling is day-one work (`D3-Q07`) or
  something I can defer.
- **Who owns device identity today — are there factory-provisioned
  certificates?** Nothing downstream can be trusted without an answer,
  and there is no longer a managed device registry on the platform to
  fall back on. I want this settled before I draw the first box.
- **Is any of this personal data?** Operator identifiers, precise
  location on private land, anything that identifies a customer — that
  turns this into a residency and erasure problem (`D3-Q10`, `D3-Q14`)
  rather than a pure throughput problem.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| ~2M devices, intermittent connectivity | Stated | — | Late and bursty arrival is the normal case, not an exception path |
| Device stamps its own event time | Assumed | "I'm assuming the device clock is roughly correct and the reading carries its own timestamp — if it doesn't, that's the first thing I'd fix" | Every window, dedup and correction depends on it |
| Delivery is at-least-once | Assumed | "I'll make the sinks tolerate duplicates rather than chase exactly-once delivery" | Pushes correctness into dedup keys and sink semantics (`D3-Q03`) |
| Raw telemetry retained for years | Assumed | "Warranty and failure investigations need the raw readings, not just aggregates" | Forces an immutable raw landing zone separate from serving stores |
| Per-device lookups AND fleet-wide analysis | Assumed | "Field service asks about one machine; data science asks about the fleet" | Two access patterns, so two serving stores, not one compromise store |
| No managed device registry available | Stated | — | Device identity and credential rotation become a component we own |

**The answer, out loud**

The first thing I'd say is that I'm not designing a stream. Two million
devices that are mostly offline produce a workload where the typical
message arrives hours after the event it describes, in a batch of a few
hundred readings, from a device that just found signal. Every decision
follows from that: I timestamp on the device, I window on event time,
and I treat arrival time as metadata I keep for debugging and never for
correctness.

At the device edge I want store-and-forward. A ring buffer sized to the
worst-case offline gap, readings batched into envelopes with a
monotonically increasing per-device sequence number, and upload with
exponential backoff *and jitter*. The jitter isn't decoration — when a
regional network comes back, tens of thousands of devices reconnect
inside the same minute and the fleet performs a synchronised
denial-of-service on our own front door. I'd also cap the device: if the
buffer overflows, drop the oldest low-value readings, keep the fault
codes, and mark the envelope so the gap is visible downstream rather
than silently absent.

Device identity is the part I'd raise before drawing anything else,
because the managed IoT registry that used to solve it is gone, and I'd
say that plainly rather than sketching a box for a service that no
longer exists. My default is a thin ingest service — Cloud Run behind a
global load balancer — that terminates the device connection, validates
a factory-provisioned client certificate or a signed device token, and
exchanges it for permission to publish. I do not hand Pub/Sub publisher
IAM to two million devices; a credential on a machine in a field is a
credential that will eventually be extracted from a machine in a field.
If the fleet already speaks MQTT and re-flashing firmware is off the
table, a partner broker fronting Pub/Sub is the honest alternative, and
I'd price that against the rewrite rather than pretend the choice isn't
there.

The ingest hop stays deliberately stupid. It authenticates, checks that
the envelope parses and the device is known, stamps a receipt time next
to the device's event time, and publishes. It does not transform,
enrich, or aggregate, because anything it does is something I cannot
redo later when I find a bug. Malformed envelopes go to a quarantine
topic rather than a 400 back to a device that will retry the same bad
payload forever.

Pub/Sub is the shock absorber, with the ordering key set to the device
ID. Per-device ordering is the only ordering that means anything here —
global ordering across two million devices is a guarantee nobody needs
and everybody pays for. I'd extend message retention well past the
default so a bad pipeline deploy is recoverable by seek-and-replay
rather than by apology, and I'd wire a dead-letter topic on day one
(`D3-Q13`).

Processing is one Dataflow streaming job on event-time windows, with
allowed lateness sized from that worst-case reconnect gap and a trigger
that emits an early provisional pane plus corrected panes as late data
lands. Deduplication is on the tuple of device ID and sequence number,
not on the Pub/Sub message ID, because the duplicate I actually care
about is a device re-uploading a batch it wasn't sure landed — that's a
fresh message ID carrying the same reading. Anything arriving beyond
allowed lateness goes to a side output and into a reprocessing path
rather than to the floor; for this business the most disconnected
machines are often the most valuable ones to monitor, so silent loss is
biased loss.

Then three sinks, for three different reasons. Raw envelopes land in
Cloud Storage as an immutable archive, lifecycle-tiered as they age,
because that's what lets me reprocess a year of telemetry when I find a
transformation bug. Bigtable holds per-device series for field service,
with a salted row key — that's `D3-Q16`, and it is the single most
common way this design fails in production. BigQuery holds the
aggregates, partitioned on event date and clustered on device, for
fleet-wide analysis. I'd use Bigtable specifically because the question
is "this machine, this time range"; I would *not* use it for fleet-wide
ad hoc questions, which belong in BigQuery.

The thing I'd flag unprompted is per-device quota. One firmware bug that
turns a reading-per-minute device into a reading-per-second device,
multiplied across a model line, is an incident that looks exactly like
success on a throughput dashboard. I want per-device and per-model rate
limits at the ingest hop, and an alert on fleet-wide publish rate
deviating from its own trailing baseline.

**Architecture**

```
  ~2,000,000 field units — days offline is normal, not exceptional
        │
        │  on-device ring buffer, batched envelopes, per-device
        │  sequence numbers, backoff WITH jitter              ◄── (1)
        ▼
  ┌──────────────────────────────────────────────┐
  │ Ingest hop: Cloud Run behind global ext. LB  │  ◄── (2)
  │  - device cert / signed token → publish right│
  │  - stamps receipt_time NEXT TO event_time    │
  │  - parse failures → quarantine topic         │
  └───────────────────┬──────────────────────────┘
                      ▼
  ┌──────────────────────────────────────────────┐
  │ Pub/Sub  topic: tlm-raw                      │  ◄── (3)
  │  ordering key = device_id, retention extended│
  └───┬──────────────────────────────────┬───────┘
      │                                  │
      ▼                                  ▼
  sub: tlm-archive                  sub: tlm-process
      │                                  │
      ▼                                  ▼
  GCS raw envelopes              ┌──────────────────────────┐
  immutable, lifecycle-          │ Dataflow streaming       │  ◄── (5)
  tiered, the reprocess          │  event-time windows      │
  source            ◄── (4)      │  allowed lateness = tail │
                                 │  dedup on (device, seq)  │
                                 └───┬──────────┬───────┬───┘
                                     ▼          ▼       ▼
                              Bigtable      BigQuery   too-late
                              per-device    aggregates side output
                              salted key    part+clust     │
                                 ◄── (6)      ◄── (7)      ▼
                                                      reprocess
                                                       path ◄── (8)

  Cross-cutting: per-device and per-model publish quotas at the
  ingest hop, alerted against a trailing fleet baseline (9); a
  dead-letter topic on every subscription from day one, never
  added after the first incident (10); event_time is the only
  clock any window, dedup or correction reads — receipt_time
  exists for debugging and for measuring the offline gap (11).
```

**Every arrow explained:**

1. **On-device store-and-forward** — the buffer is the first tier of the
   pipeline and the cheapest one. Per-device sequence numbers are what
   make downstream deduplication possible at all; jitter is what stops a
   regional reconnect becoming a self-inflicted traffic spike.
2. **Thin ingest hop** — authenticates the device and does nothing else.
   The wrong alternative is an ingest service that enriches or
   aggregates, because any transformation here is one you cannot redo
   when you later discover it was wrong.
3. **Pub/Sub with per-device ordering keys** — per-device order is the
   only order with meaning. Don't enable broader ordering to feel safer;
   it costs throughput and buys a guarantee no consumer here asks for.
4. **Immutable raw archive in Cloud Storage** — the reprocessing source
   of truth. Without it, a bug in the Dataflow transform is
   unrecoverable for everything processed before the fix.
5. **Dataflow on event time** — windows, allowed lateness, and dedup on
   `(device_id, seq)`. Deduplicating on message ID instead is the subtle
   failure: the duplicate that matters is a device re-uploading, which
   produces a brand-new message ID.
6. **Bigtable for per-device reads** — field service asks "this machine,
   last thirty days." Use it for that; don't use it for fleet-wide ad hoc
   questions, which belong in BigQuery. Key design is `D3-Q16`.
7. **BigQuery for fleet analytics** — partitioned on event date,
   clustered on device. This is the table analysts and any downstream
   training job actually touch.
8. **Too-late side output** — data beyond allowed lateness is routed,
   not dropped. The worst-connected machines are often the highest-value
   ones to monitor, so dropping late data biases the fleet picture.
9. **Per-device quota** — a firmware bug that multiplies publish rate
   looks like healthy growth on a throughput chart. Rate-limit at the
   ingest hop and alert on deviation from the fleet's own baseline.
10. **Dead-letter topics from day one** — retrofitting them during an
    incident means you have already lost the messages you most wanted to
    inspect (`D3-Q13`).
11. **Event time as the only correctness clock** — receipt time is kept
    for diagnostics and for measuring connectivity, never to window,
    order or deduplicate.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Device→cloud path | Thin ingest service in front of Pub/Sub | Devices publish directly to Pub/Sub with their own credentials | Device credentials never carry publish IAM; rate limiting and quarantine have somewhere to live | When devices are few, physically secured, and credential rotation is easy — then the extra hop is pure latency and cost |
| Ordering | Ordering key = device ID | No ordering key at all | Per-device sequence lets the pipeline detect gaps and reorder cheaply | When the payload is fully commutative and sequence gaps carry no meaning — then skip ordering and take the throughput |
| Dedup identity | `(device_id, seq)` carried in the envelope | Broker message ID / built-in dedup | Catches device-level re-upload, which broker dedup structurally cannot see | When producers genuinely publish once and only broker redelivery is possible — then built-in dedup is less code for the same outcome |
| Raw retention | Immutable raw archive in Cloud Storage | Keep only processed output | Makes every transformation bug recoverable by replay | When raw data is regulated such that holding it is the liability (`D3-Q10`) — then process-and-discard, accepting that bugs become permanent |
| Serving stores | Bigtable + BigQuery, split by access pattern | One store serving both | Per-device range scans and fleet-wide aggregation have irreconcilable shapes | When the fleet is small enough that BigQuery alone meets the latency budget — then one store is less to operate |
| Late data | Allowed lateness plus a routed side output | Drop after window close | Loses nothing from the worst-connected, most valuable machines | When lateness genuinely carries no value (a live scoreboard) — then dropping is honest and keeps state bounded |

**Making it concrete**

```hcl
# Ingest topic with an attached schema, extended retention so a bad
# pipeline deploy is recoverable by seek-and-replay, and a DLQ wired
# before the first incident rather than during it.
resource "google_pubsub_topic" "tlm_raw" {
  project                    = "PROJECT_ID"
  name                       = "tlm-raw"
  message_retention_duration = "604800s"   # replay window, not a buffer
  schema_settings {
    schema   = "projects/PROJECT_ID/schemas/telemetry-envelope-v1"
    encoding = "BINARY"
  }
}

resource "google_pubsub_subscription" "tlm_process" {
  project                 = "PROJECT_ID"
  name                    = "tlm-process"
  topic                   = google_pubsub_topic.tlm_raw.id
  enable_message_ordering = true            # ordered per device_id key
  dead_letter_policy {
    dead_letter_topic     = "projects/PROJECT_ID/topics/tlm-dlq"
    max_delivery_attempts = 10
  }
}
```

The retention duration is the line that matters: it is the width of the
window in which a bad deploy is a replay rather than a data-loss
incident.

**What a weak answer sounds like**

- "Devices publish straight into Pub/Sub and Dataflow writes to
  BigQuery." — it's the tutorial diagram, and it silently assumes
  devices are online, trustworthy, and stamping nothing. The panel is
  waiting to see whether you notice which of those three assumptions is
  false.
- "We'd use a managed device registry for identity." — naming a retired
  service tells the panel you last looked at this space several years
  ago. "There isn't a managed one any more, so here's how I'd own it" is
  the strong version of the same instinct.
- "Late data is an edge case we'd handle later." — for this fleet late
  data is the median case, and handling it later means rebuilding the
  windowing model after dashboards already have consumers.
- "We'd add Bigtable nodes if it gets hot." — throughput bought to cover
  a row-key mistake is money spent on not fixing the problem
  (`D3-Q16`).

**Common wrong turns**

- **Windowing on arrival time because it's the SDK default.** It
  produces plausible, wrong aggregates that nobody catches for months.
  Recover by saying "windows are on the device's event timestamp" while
  you're still drawing the Dataflow box.
- **Designing a hot path nobody consumes.** Streaming is the fun part to
  draw. Recover by asking who reads the fresh number and what they do
  differently because of it; if there's no answer, it's `D3-Q08`'s
  over-engineering trap.
- **Forgetting the reconnect burst.** Capacity planned against average
  fleet rate falls over on the first regional restoration. Recover by
  adding jitter at the device and admission control at the ingest hop.
- **Making the ingest hop smart.** Enrichment there feels efficient and
  quietly makes the raw archive non-raw. Recover by moving every
  transformation behind Pub/Sub, where it can be replayed.

**Follow-up probes the interviewer asks next**

1. **"Two million devices today. What breaks at twenty million?"** — not
   Pub/Sub and not Cloud Storage. What breaks first is per-device state
   in the Dataflow job, since dedup and windowing state scale with
   active keys rather than with message rate, and then the Bigtable node
   count needed to absorb write throughput. I'd shard the pipeline by
   device-ID hash range into several jobs before trying to scale one job
   that far.
2. **"A firmware release doubles reporting frequency across one model
   line overnight. Walk me through what happens."** — the publish-rate
   alert fires against the trailing baseline, the per-model quota at the
   ingest hop sheds the excess into quarantine rather than into the
   pipeline, and we make an explicit decision about raising the quota or
   rolling the firmware back. Without the quota, the first symptom is
   Bigtable latency, which is three hops from the cause.
3. **"How do you reprocess a year of telemetry after finding a bug in
   the transform?"** — from the Cloud Storage raw archive, through the
   same pipeline code running in batch, writing to a shadow dataset
   that's compared before it's promoted. That is the whole reason the
   raw archive exists.
4. **"Who owns this pipeline in two years, and how do they know it's
   healthy?"** — a data platform team, with watermark lag as the
   headline indicator rather than throughput, because throughput looks
   fine while the pipeline quietly falls behind on the slowest devices.
   How that team is staffed and paged is `design-06`'s territory, not
   something I'd design at this whiteboard.
5. **"The device team wants to change the payload format. What's the
   process?"** — an additive change against a registered schema,
   validated in their CI before firmware ships, with the pipeline
   running a tolerant reader. That's `D3-Q07` mechanically and `D3-Q17`
   organizationally.
6. **"What would you cut if you had six weeks?"** — the Bigtable serving
   path and the reprocessing tooling. I'd ship ingest, the raw archive
   and event-time windowing into BigQuery, because those are the
   decisions that are expensive to reverse; serving stores can be added
   over a pipeline that's already correct.

**Cross-references**

- `04-architectures/case-study-terramearth.md` — the case-study version
  of this fleet, including why watermark lag is the headline metric.
- `03-comparisons/02-storage-database-options.md` — the Bigtable and
  BigQuery rows back callouts (6) and (7); don't re-derive them.
- `D3-Q04` for late-data mechanics, `D3-Q16` for the row key, `D3-Q13`
  for the dead-letter path, `D3-Q08` for whether a hot path should exist
  at all.

---

### D3-Q02 — "An order touches six services before it ships. Design the flow, then tell me what happens when the fourth one fails."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 1.3, 4.1, 6.2 |
| **Axis** | data |
| **Whiteboard time** | 45–55 min |
| **Reads well after** | `D3-Q03` |

**What the interviewer is actually testing**

Whether you can hold a distributed transaction in your head without
having a distributed transaction. The specific skills are: naming the
pivot point past which rollback stops being possible, designing
compensations that are themselves fallible, and choosing between
choreography and orchestration for a stated reason rather than a
preference.

**Clarifying questions to ask before drawing anything**

- **Which step is the point of no return?** Somewhere in this chain
  something physical or financial happens that cannot be undone — a
  warehouse picks stock, a card is captured, a carrier is booked. Every
  step before it compensates backward; every step after it can only roll
  forward. That single boundary shapes the whole design.
- **What is the customer promised, and when?** If the confirmation goes
  out at step one, we've made a promise before we know we can keep it.
  If it goes out at step six, we've made the flow synchronous in the
  customer's perception even though it isn't.
- **How long may an order sit in flight?** Seconds means the saga is
  nearly invisible. Hours — because the warehouse batches — means every
  intermediate state needs a name, a timeout, and a sweeper.
- **Do the six services belong to six teams?** Six teams means the
  interfaces are contracts and the failure modes are organizational as
  much as technical (`D3-Q17`). One team gives me more freedom to
  centralise the state machine.
- **Is oversell ever acceptable?** A retailer that can backorder has a
  very different design from a ticketing system where two people holding
  one seat is a lawsuit. This decides soft hold versus hard, strongly
  consistent decrement.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Six services participate in one business transaction | Stated | — | No cross-service ACID transaction exists; this is a saga by definition |
| Money is authorized up front, captured later | Assumed | "I'll assume we authorize a hold and capture at handoff — if we capture immediately, compensation becomes a refund and that's a worse story" | Makes the pivot explicit and moves it later in the sequence |
| Every step is idempotent under retry | Assumed | "If any participant isn't safe to call twice, that's the first thing I'd fix" | The saga's correctness rests entirely on it (`D3-Q03`) |
| An order may be in flight for hours | Assumed | "Warehouses batch; I'll design for hours, not seconds" | Forces a durable saga log and named intermediate states |
| Oversell unacceptable, backorder allowed | Assumed | "Tell me if a seat/ticket model applies instead — that changes the reservation entirely" | Decides soft hold vs strongly consistent decrement |
| Customer-visible status must always be truthful | Assumed | "Never show 'confirmed' before the pivot" | The state machine becomes a customer-facing artifact |

**The answer, out loud**

I'd start by naming the pivot, because everything else is downstream of
it. In this flow the pivot is the handoff to fulfilment: once the
warehouse claims the order and a picker touches stock, I can no longer
pretend the order didn't happen. Before that point, failure means
compensate backward and the customer sees "we couldn't complete your
order." After it, failure means roll forward — retry, escalate, and
failing that, a human exception queue — because a compensating action
past the pivot is a return, a refund and a phone call, not a database
write.

Second, I'd choose orchestration over choreography, and give the reason
rather than the preference. Six services, real money, and a compensation
path that has to run in reverse order means somebody needs to know the
whole sequence. In choreography that knowledge is smeared across six
event handlers and nobody can answer "where is order 12345 and what does
it still owe." So I'd run the saga in Cloud Workflows, one execution per
order, with saga state persisted in Spanner keyed by order ID. I'd keep
choreography for the things that genuinely don't participate in the
transaction — analytics, search indexing, marketing — which subscribe to
order events through Pub/Sub and Eventarc and are allowed to fail
without anyone caring. Orchestration for the transaction, choreography
for the observers, and I'd say that split out loud, because "events
everywhere" and "orchestrate everything" are both answers that stopped
thinking too early.

Third, the reservation. Inventory gets a semantic lock — a reservation
row with a TTL, not a decrement. The reservation is what makes the saga
safe to abandon: if the saga dies between step four and step five, the
reservation expires on its own and stock returns to available without
any compensation running. I'd pair that with a sweeper that reaps
expired reservations and emits an event, because a TTL nobody watches is
a silent inventory leak. If this were ticketing rather than retail, I'd
swap the soft hold for a strongly consistent decrement in Spanner and
accept the throughput cost, because oversell there isn't a
customer-service problem.

Fourth, compensations, which is the part candidates skip. A compensating
action is a distributed call and can fail exactly like the action it
undoes. Voiding an authorization can time out. Releasing a reservation
can hit a service that's down. So compensations get their own retry
policy, their own dead-letter topic, and — this is the part I insist on
— a page, not a dashboard. A failed forward step leaves a customer
without an order. A failed compensation leaves money held against a
customer who has no order, and that is a different severity.

Fifth, idempotency, which is what makes all of the above legal. Every
call carries the order ID as its idempotency key, and every participant
treats a repeat as a no-op returning the original result. Workflows will
retry, Pub/Sub will redeliver, and an on-call engineer will re-run
something manually at 3am. The full treatment is `D3-Q03`; here I'd just
state the invariant plainly — the saga is only correct because every
step is safe to run twice.

The last thing I'd flag unprompted is that the order state machine is a
customer-facing artifact, not an internal one. Names like "pending,"
"reserved," "confirmed," "picking," "shipped" end up in emails and
support screens. I'd write the state machine down with the support team
in the room, because the expensive failure here isn't a lost message —
it's a customer told "confirmed" at a moment when we could still cancel.

**Architecture**

```
  ORDER SAGA — orchestrated; saga key = order_id, state in Spanner
  ════════════════════════════════════════════════════════════════

  order-svc: accept, write order PENDING, publish OrderPlaced  ◄── (1)
                         │
                         ▼
  Cloud Workflows execution, one per order_id, durable
  and resumable, reads and writes the saga log                 ◄── (2)
                         │
      ┌──────────────────┴───────────────────────────────┐
      │ FORWARD PATH                                     │
      ├─► payment-svc    AUTHORIZE   hold, no capture    │  ◄── (3)
      ├─► inventory-svc  RESERVE     semantic lock + TTL │  ◄── (4)
      ├═► fulfil-svc     CLAIM   ═══ PIVOT POINT ═══     │  ◄── (5)
      ├─► payment-svc    CAPTURE                         │  ◄── (6)
      ├─► ship-svc       LABEL                           │  ◄── (7)
      └─► notify-svc     CONFIRM    best-effort only     │  ◄── (8)
      └──────────────────────────────────────────────────┘

  FAILURE BEFORE THE PIVOT → compensate in REVERSE order:         ◄── (9)
      inventory RELEASE ─► payment VOID ─► order CANCELLED

  FAILURE AFTER THE PIVOT → roll FORWARD, never backward:        ◄── (10)
      bounded retry ─► exception queue ─► human decision

  OBSERVERS (choreographed, structurally unable to block):       ◄── (11)
      OrderPlaced / OrderConfirmed ──► Pub/Sub ──► analytics,
      search index, marketing — allowed to fail silently

  Cross-cutting: every participant call carries order_id as its
  idempotency key, so a Workflows retry is a no-op (12); a failed
  compensation goes to comp-dlq and PAGES, because money held
  against a cancelled order is a different severity from a stalled
  order (13); a sweeper reaps reservations whose TTL passed with
  neither a CLAIM nor a RELEASE, and emits an event, so the leak is
  visible rather than merely absent (14).
```

**Every arrow explained:**

1. **Accept and persist before publishing** — the order row exists
   before any event does, so a crash between the two is a stuck order we
   can find rather than an event referring to nothing. Publishing first
   and writing second is the classic dual-write bug; when the two must
   be atomic, use an outbox table drained by CDC (`D3-Q06`).
2. **Workflows as the orchestrator** — one durable execution per order,
   holding the sequence and the compensation order in one readable
   place. Don't use it for high-frequency per-event fan-out; that's
   Pub/Sub's job, and Workflows is for the long-running, few-per-order
   case.
3. **AUTHORIZE, not charge** — a hold is cheap to void. Capturing here
   would move the pivot earlier and turn every later failure into a
   refund, which is slower, customer-visible, and sometimes fee-bearing.
4. **RESERVE as a semantic lock with a TTL** — the reservation is
   self-healing: an abandoned saga releases stock by expiry with no
   compensation running at all. A hard decrement would require a
   guaranteed compensating increment, which is a weaker guarantee.
5. **CLAIM is the pivot** — the first step whose effect is physical.
   Everything before it is reversible by software; nothing after it is.
   Drawing this line explicitly is the highest-value mark on the board.
6. **CAPTURE after the pivot** — money moves once goods are committed.
   This ordering keeps the common failure cases on the cheap side.
7. **LABEL** — carrier booking, retryable; if it fails permanently the
   order is already claimed, so resolution is operational (rebook,
   different carrier), not a rollback.
8. **CONFIRM is best-effort** — a notification failure must never fail
   the saga. A customer not getting an email is a support ticket; an
   order cancelled because the email service was down is an outage we
   inflicted on ourselves.
9. **Backward compensation in reverse order** — each step idempotent,
   each with its own retry. Running compensations forward is a real bug:
   releasing inventory before voiding payment opens a window where stock
   is sellable against money still held.
10. **Forward-only past the pivot** — bounded retry, then an exception
    queue a human owns. Pretending a post-pivot saga can roll back is
    how you ship goods you've already refunded.
11. **Choreographed observers** — analytics, search and marketing
    subscribe to events and cannot block an order. Don't put a
    transaction participant on this path because it's easier to wire.
12. **Idempotency keys everywhere** — the saga is correct only because
    every step is safe to repeat (`D3-Q03`).
13. **Compensation dead-letter pages** — a failed compensation is money
    held against nothing; it gets a human immediately, not a morning
    dashboard.
14. **Reservation sweeper** — makes the TTL observable. Without it, a
    slow leak of reserved-but-never-claimed stock looks like demand.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Coordination style | Orchestration for the transaction | Choreography — each service reacts to events | One place knows the sequence and its reverse; "where is this order" is answerable | When steps are genuinely independent with no rollback semantics — then choreography removes a central dependency |
| Payment timing | Authorize early, capture after the pivot | Capture at order placement | Keeps most failures on the reversible side of the pivot | When authorizations expire faster than fulfilment takes — then capture early and accept refunds as the compensation |
| Inventory | Soft reservation with TTL | Hard decrement at reserve time | Abandoned sagas self-heal; no compensation needed in the common case | When oversell is unacceptable at any probability (seats, tickets) — then a strongly consistent decrement is worth the throughput cost |
| Saga state | Durable log in Spanner, keyed by order ID | Rely on orchestrator execution history alone | Queryable by support and by sweepers; survives orchestrator changes | When volume is low and the orchestrator's own history suffices — then a second store is duplicated state to keep in sync |
| Compensation failures | Own dead-letter queue, paged | Same treatment as forward-step failures | Held money against a cancelled order outranks a stalled order | When no step has an external financial or physical effect — then uniform treatment is simpler and adequate |
| Notification timing | After the pivot only | Confirm at acceptance for perceived speed | Never tells a customer something we can still undo | When the business prefers optimistic confirmation and can absorb occasional retractions — some marketplaces do exactly this |

**What a weak answer sounds like**

- "We'd use a distributed transaction across the six services." — there
  isn't one, and proposing two-phase commit across independently
  deployed services tells the panel you're describing a system you
  haven't operated.
- "Each service publishes an event and the next one picks it up." — fine
  until step four fails, at which point nobody owns running steps three
  and two backward, in that order, with retries.
- "If something fails we roll back." — the follow-up is always "roll
  back the warehouse pick?" A candidate who hasn't located the pivot
  can't answer it.
- "Compensations are just the inverse calls." — they're inverse calls
  that can fail, time out, and be delivered twice. The design lives in
  that sentence, not in the list of inverses.

**Common wrong turns**

- **Drawing the happy path and stopping.** The question's real content
  is after the word "fails." Recover by drawing the failure branch
  before you finish the forward one.
- **Putting the notification inside the transaction.** It's the easiest
  step to wire and the worst to couple. Recover by moving it to the
  observer lane and saying why.
- **Compensating in forward order.** It reads naturally and opens a
  window where stock is free while money is still held. Recover
  immediately — a one-word fix while drawing, an incident in production.
- **Treating the saga log as internal plumbing.** Support will ask where
  an order is. Recover by making the state names customer-facing and
  writing them down with the people who read them.

**Follow-up probes the interviewer asks next**

1. **"Authorization succeeds but the response is lost and the saga
   retries. Now what?"** — the idempotency key means the second
   authorize returns the first authorization instead of creating a
   second hold. If the provider doesn't support idempotency keys, I'd
   record intent before the call and reconcile by query-then-act, and
   I'd treat that provider as a design constraint worth renegotiating.
2. **"A hundred orders a minute today. What breaks at ten thousand a
   minute?"** — not the saga shape. What breaks is one orchestrator
   execution per order as a cost and quota line, and the inventory hot
   row for a popular item. I'd route high-volume low-value orders
   through a simplified fast path with no reservation step, keep
   orchestration where real money is involved, and shard inventory by
   location to break the hot row.
3. **"A compensation fails permanently. Who finds out, and how fast?"**
   — an on-call engineer, immediately, from the compensation DLQ alarm.
   The runbook is `D3-Q13`, and its first line is "how much money is
   held, against how many orders," because that number decides whether
   this is an incident or a ticket.
4. **"Six services, six teams. How do you stop one team's deploy from
   breaking the saga?"** — versioned interface contracts with
   compatibility tested in each team's CI, plus an integration
   environment that runs the saga end to end against release candidates.
   Who owns the contract and who gets paged when it breaks is `D3-Q17`
   and `design-06`; I'd plug into that rather than invent a process at
   the whiteboard.
5. **"The warehouse system is a mainframe with a nightly batch. Does
   your design survive?"** — yes, but the pivot moves and the in-flight
   window becomes a day. That makes the reservation TTL longer, the
   sweeper more important, and the customer-facing status names matter
   far more, because the customer now lives inside the saga's duration.
6. **"Escalate this: what's the worst outcome your design allows?"** — a
   post-pivot failure where capture succeeds and shipping never happens,
   and nobody notices because the exception queue isn't watched. I'd put
   an objective on exception-queue age and treat "oldest item in the
   queue" as a first-class reliability signal rather than an operations
   detail.

**Cross-references**

- `D3-Q03` — the idempotency mechanics this saga rests on; assumed here,
  derived there.
- `D3-Q13` — the dead-letter and replay tooling behind callout (13).
- `D3-Q12` — ordering guarantees for the financial events this saga
  emits into the ledger.
- `03-comparisons/02-storage-database-options.md` — the Spanner row
  backs both the saga-log and hard-decrement choices.

---

### D3-Q03 — "Our platform is at-least-once everywhere and finance says customers are being double-charged. Design idempotency end to end."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 1.3, 6.2 |
| **Axis** | data |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D3-Q02` |

**What the interviewer is actually testing**

Whether you understand that exactly-once is a property of the *outcome*
and at-least-once is a property of the *transport*, and that the gap
between them is closed by keys and sinks rather than by a configuration
flag. The strongest signal is whether you can point at the exact
boundaries where a duplicate can be born, and say which mechanism
absorbs it at each one.

**Clarifying questions to ask before drawing anything**

- **Where is the duplicate actually being created — client, broker, or
  processor?** A user double-clicking, a retried HTTP request, a Pub/Sub
  redelivery, and a pipeline replay are four different duplicates and
  only one of them is fixed inside the pipeline. I'd want the evidence
  before the design.
- **Is the effect reversible?** A duplicate row is a cleanup job. A
  duplicate charge is a refund, a support call, and possibly a
  regulator. The cost of a duplicate decides how much machinery is
  justified.
- **What is the natural business key?** If there's already something
  that identifies the intent — an order ID, a payment request ID, a
  device reading's sequence number — I'd use it rather than invent a new
  identifier that only the platform understands.
- **How long must the dedup memory last?** Seconds of broker redelivery
  is a small in-pipeline window. A client retrying tomorrow after a
  failed upload needs durable, indefinite memory in the sink. These are
  different components.
- **Which downstream effects are external and non-idempotent?** Emails,
  SMS, third-party payment calls, webhook deliveries to customers. These
  can't be fixed by our storage design and need their own treatment.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Transport is at-least-once | Stated | — | Duplicates are a certainty to absorb, not a bug to eliminate |
| Duplicate charges are business-critical | Stated | — | The sink must be transactionally deduplicated, not best-effort |
| Clients can retry after arbitrary delays | Assumed | "Mobile clients retry after reconnect; I'll assume the dedup window is effectively unbounded at the sink" | Rules out purely windowed, in-memory deduplication |
| Idempotency key is generated at intent time | Assumed | "The key is minted when the user commits to the action, not when the HTTP call is made" | A key minted per attempt deduplicates nothing |
| Processing may be replayed deliberately | Assumed | "We will replay from the raw archive after bug fixes" | Replay must be a no-op for already-applied effects |
| Some effects are external and irreversible | Assumed | "Payment provider calls and customer emails" | Needs provider-side keys and a send-ledger |

**The answer, out loud**

I'd frame it in one sentence first: I'm not going to try to make delivery
exactly-once, because no useful distributed system offers that; I'm going
to make every *effect* idempotent, so that at-least-once delivery
produces exactly-once outcomes. That reframing is the whole answer, and
everything after it is where the keys live.

The key is minted at intent, by the client, and it travels with the
request for its whole life. That's the part teams get wrong. If the
mobile app generates a UUID when it sends the HTTP request, then the
retry after a timeout generates a second UUID and the server correctly
processes two distinct payments. The key must be created when the user
taps "pay" and reused on every retry of that same intent, which means it
is also the key the client can use to ask "did my thing happen?" I'd put
it in a header, persist it, and refuse requests that arrive without one
rather than generating a server-side fallback that silently defeats the
mechanism.

Then I'd walk the path and name the mechanism at each hop. At the API
edge, the write is an insert of the idempotency key into a table with a
unique constraint, in the same transaction as the business effect. If
the insert collides, we return the stored original response instead of
re-executing. That's it — that's the entire trick, and it works because
the uniqueness check and the effect commit atomically. Doing the check
first and the write second is a race that shows up exactly under the
load conditions that cause retries in the first place.

Across Pub/Sub, I keep the same key as a message attribute. I'd say
plainly that Pub/Sub's exactly-once delivery setting narrows the window
for broker-side redelivery within a subscription and is worth enabling
where it applies, but it does not and cannot deduplicate a client that
published the same intent twice, and it doesn't survive a deliberate
replay. So I treat it as a helpful reduction in duplicate volume, never
as the correctness mechanism.

Inside Dataflow, the runner gives me consistent processing semantics for
the pipeline's own internal state — if a worker dies mid-bundle, my
counters don't double. That's real and valuable, and it stops at the
sink boundary. The moment the pipeline writes to something outside
itself, exactly-once becomes the sink's problem. So the design work is
in the sinks:

For BigQuery, either a `MERGE` on the event key from a staging table, or
the Storage Write API in a mode where each stream's offsets make a
retried append a no-op. I'd pick the MERGE pattern when the data volume
per batch is moderate and the semantics need to be obvious to analysts;
I'd pick offset-based appends when volume is high enough that MERGE cost
is the dominant line. For Bigtable, I'd make the row key contain the
event identity so a duplicate write is an overwrite of the same cell
rather than a second row — this is the cheapest idempotency in the whole
stack, and it's free if the key design is right (`D3-Q16`). For a
relational sink, it's the unique-constraint pattern again, inside the
transaction.

Then the hard part, which is the effects I don't own. A payment provider
call gets the provider's own idempotency key header, set to our key so
their retry semantics align with ours. An email gets a send ledger: a
row keyed by the idempotency key written before the send, checked before
the send, so a replay of six months of events doesn't re-notify every
customer about orders from last spring. I'd call that out explicitly,
because the most memorable idempotency failure I've seen is not a double
charge — it's a replay that emails the entire customer base.

The last piece is ordering's interaction with idempotency, which is
where people get subtly wrong answers. Deduplication makes repeats safe;
it does not make *stale* writes safe. If an update for a record arrives
twice out of order, dedup lets the old one through as a distinct event.
So for any last-writer-wins sink, I carry a version or event timestamp
and write conditionally — apply only if the incoming version is newer.
That's a different mechanism from the dedup key, and a design that has
one but not the other looks correct until the day the network reorders
two updates.

**Architecture**

```
  ONE PAYMENT INTENT, FOLLOWED THROUGH EVERY RETRY BOUNDARY
  ═════════════════════════════════════════════════════════

  (1) user taps PAY
      client mints idem_key = UUID  ── stored locally, reused
      on EVERY retry of this intent                          ◄── (1)
          │
          │  attempt 1 ─► timeout (server actually succeeded)
          │  attempt 2 ─► same idem_key
          ▼
  (2) API edge / payment-svc
      BEGIN TX
        INSERT idem_key INTO idempotency (UNIQUE)  ──┐
        apply business effect                        │ same TX  ◄── (2)
        store response payload                       │
      COMMIT                                        ─┘
      on unique violation ─► return STORED response, do nothing ◄── (3)
          │
          ▼
  (3) Pub/Sub  attributes: idem_key, event_version              ◄── (4)
          │   broker redelivery possible; exactly-once setting
          │   narrows it, never eliminates the client duplicate
          ▼
  (4) Dataflow — consistent internal state across worker
      failure; that guarantee STOPS at the sink boundary        ◄── (5)
          │
          ├─► BigQuery: MERGE on idem_key, or Storage Write
          │   API offsets ─► retried append is a no-op          ◄── (6)
          ├─► Bigtable: idem_key inside the row key ─► duplicate
          │   write overwrites the same cell                    ◄── (7)
          └─► external effects (provider call, email, webhook)
              ─► provider idempotency header + send ledger      ◄── (8)

  Cross-cutting: dedup makes REPEATS safe; a monotonic
  event_version compared at write time is what makes STALE
  writes safe, and a design with only one of the two fails on
  reordering (9); a deliberate replay from the raw archive must
  traverse every one of these boundaries unchanged, which is the
  real test of whether the keys are right (10).
```

**Every arrow explained:**

1. **Key minted at intent, not per attempt** — the single most common
   defect. A key generated inside the HTTP client's retry loop changes on
   every retry and deduplicates nothing.
2. **Unique insert and effect in one transaction** — atomicity is the
   mechanism. Checking for the key and then writing in a second step is a
   race that fires precisely under retry-heavy load.
3. **Return the stored response on collision** — the retry must see the
   original outcome, not a generic "duplicate" error, or the client will
   treat it as a failure and retry again.
4. **Key carried as a message attribute** — it must survive the hop.
   Pub/Sub's exactly-once setting reduces broker redelivery within a
   subscription; use it, and don't use it as the correctness argument,
   because it cannot see a client-level duplicate or a replay.
5. **Runner-level consistency stops at the sink** — Dataflow keeps its
   own state consistent across worker failure. Everything it writes
   outside itself is governed by the sink's semantics, not the runner's.
6. **BigQuery MERGE or offset-based append** — use MERGE when volume is
   moderate and analyst-visible semantics matter; don't use MERGE at very
   high volume where its cost dominates — use stream offsets instead.
7. **Identity in the Bigtable row key** — makes duplicate writes
   overwrites. The cheapest idempotency available, and free if the key
   design was done properly (`D3-Q16`).
8. **External effects need their own ledger** — the provider's
   idempotency header for money, a written-before-send ledger for
   notifications. Without the latter, a replay spams every customer.
9. **Version-conditional writes** — dedup handles repeats, versions
   handle reordering. Two mechanisms, two failure modes; carrying only
   one is a design that fails the first time the network reorders.
10. **Replay as the acceptance test** — if replaying a day of raw data
    changes any balance, sends any email, or double-counts any metric,
    the idempotency design is not finished.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Key origin | Client mints at intent, server requires it | Server derives a key by hashing the payload | Survives client retries and payload-identical-but-distinct intents | When clients can't be changed — then payload hashing plus a short window is the pragmatic fallback, with its false-merge risk stated |
| Dedup storage | Unique constraint in the same transaction as the effect | Separate dedup service consulted before the write | Atomic, no race, no extra dependency on the critical path | When the effect spans systems that cannot share a transaction — then a dedup service plus a reconciliation job is the honest compromise |
| Broker semantics | Enable exactly-once delivery where available, rely on it for nothing | Treat the broker setting as the solution | Keeps correctness in the sink, where replays and client duplicates are also covered | When the only duplicate source is genuinely broker redelivery and effects are cheap — then the setting alone is proportionate |
| BigQuery sink | MERGE on the event key from staging | Streaming append and deduplicate at read time with a view | Storage stays clean; consumers can't forget the dedup clause | When ingest volume makes MERGE the dominant cost — then append plus a dedup view, with the view enforced as the only interface |
| Notifications | Send ledger written before the send | Trust the notification provider's own dedup | Protects against replay across arbitrary time, which provider-side windows don't | When the provider guarantees dedup over a window longer than any replay you would ever run — rare, and worth verifying rather than assuming |
| Stale updates | Version-conditional writes | Last-writer-wins on arrival | Reordering is common and silent; arrival order is not authority | When the payload is a full-state snapshot and staleness self-corrects on the next update — then simple overwrite is fine |

**Making it concrete**

```hcl
# The dedup record and the effect must commit together. Expressed as
# schema rather than prose: a unique key plus the stored response, so a
# retry returns the original outcome instead of re-executing it.
resource "google_spanner_database" "payments" {
  project  = "PROJECT_ID"
  instance = "INSTANCE_ID"
  name     = "payments"

  ddl = [
    <<-SQL
    CREATE TABLE idempotency (
      idem_key      STRING(64) NOT NULL,
      request_hash  STRING(64) NOT NULL,
      response_json STRING(MAX),
      applied_at    TIMESTAMP NOT NULL OPTIONS (allow_commit_timestamp=true),
    ) PRIMARY KEY (idem_key)
    SQL
    ,
  ]
}
```

`request_hash` is there for one reason: if the same key arrives with a
materially different payload, that is a client bug and I want it to
error loudly rather than silently return someone else's response.

**What a weak answer sounds like**

- "We'd turn on exactly-once delivery." — it narrows broker redelivery
  inside one subscription and does nothing about the client that
  published twice or the replay you will eventually run.
- "Dataflow gives exactly-once processing, so we're covered." — it gives
  consistent internal state. Every external write is governed by the
  sink, and that's where the double charge happened.
- "We'd deduplicate on a five-minute window." — correct for broker
  redelivery, wrong for a mobile client that retries on reconnect
  tomorrow, and wrong for every replay.
- "We'd clean up duplicates with a nightly job." — reconciliation is a
  good safety net and a terrible primary mechanism; the customer already
  saw two charges on their statement.

**Common wrong turns**

- **Generating the key server-side.** It feels safer and it defeats the
  entire mechanism, because each retry looks like a new intent. Recover
  by making the key a required request header.
- **Check-then-write.** Reads clean, races under exactly the load that
  produces retries. Recover by folding the uniqueness check into the
  same transaction as the effect.
- **Forgetting the notification path.** Storage is deduplicated, emails
  aren't, and the first big replay tells every customer about an order
  from last year. Recover by adding the send ledger while you're still
  listing sinks.
- **Conflating dedup with ordering.** Two different problems, two
  different mechanisms. Recover by saying "dedup for repeats, versions
  for staleness" out loud and drawing both.

**Follow-up probes the interviewer asks next**

1. **"Your idempotency table is now billions of rows. What do you do?"**
   — partition it by time and expire old keys deliberately, with the
   retention chosen from the longest plausible client retry plus the
   longest replay window, not from storage convenience. I'd also say
   that expiring keys re-opens the duplicate window for anything older,
   so the retention number is a correctness decision that needs a named
   owner, not a cleanup default.
2. **"A replay of six months of events is requested. Walk me through
   it."** — dry run against a shadow dataset first, confirm the sinks
   are dedup-keyed, disable or hard-gate the external-effect stage, then
   replay rate-limited with the send ledger in place. The external
   effects are the part that cannot be un-done, so they get the gate.
3. **"Scale this up: every service in the company adopts your pattern.
   What's the blast radius of getting it wrong in one of them?"** — a
   service that generates keys per attempt becomes a duplicate source
   for everything downstream of it, and the symptom appears in the
   consumer, not the producer. I'd make the key contract part of the
   platform's request standard and test it, rather than documenting it
   and hoping (`D3-Q17`).
4. **"How do you prove to finance that this works?"** — a continuous
   reconciliation job that compares intent count to effect count per
   key, published as a data-quality metric with a threshold of zero.
   Provable, boring, and it's the artifact that ends the conversation.
5. **"Who owns the idempotency standard across forty teams?"** — the
   platform team owns the mechanism and the test; product teams own
   applying it. Governance shape is `design-01`'s `D1-Q16` and
   `design-06`; I'd plug into it rather than invent a parallel process.
6. **"What would you do first on Monday?"** — instrument, not redesign.
   Find where the duplicates are actually created by keying on intent
   and counting collisions per boundary, because the fix at the client
   and the fix at the sink are different work and the evidence decides
   which one is urgent.

**Cross-references**

- `04-architectures/pattern-data-analytics-pipeline.md` — its
  exactly-once section is the compressed version of this answer; this
  question is the design conversation around it.
- `D3-Q02` — the saga whose correctness rests on these keys.
- `D3-Q12` for ordering, `D3-Q13` for replay mechanics, `D3-Q16` for
  making the Bigtable sink idempotent by key design.

---

### D3-Q04 — "Our dashboards are always slightly wrong because data keeps arriving late — and the late data is the data our analysts care most about. Fix it."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 1.3, 6.2, 4.3 |
| **Axis** | data |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D3-Q01` |

**What the interviewer is actually testing**

Whether you know that "late data" is a design parameter with a business
answer, not a technical annoyance with a technical default. The skill is
translating a tolerance — how long we wait, how long we keep correcting
— into windowing, watermarks, triggers and a restatement policy, and
then making the resulting provisionality visible to the people reading
the number.

**Clarifying questions to ask before drawing anything**

- **How late is late, and with what distribution?** A tail at ten
  minutes and a tail at three days are different systems. I want the
  histogram of event-time-to-arrival-time, because that single chart
  sets allowed lateness and therefore cost.
- **What decision is made on the fresh number, and is it reversible?**
  If someone dispatches a truck on it, provisional is dangerous. If
  someone watches a trend, provisional is fine as long as it's labelled.
- **Does a corrected number need to reach people who already saw the
  wrong one?** That's the difference between quietly restating a table
  and running a notification workflow. It's usually a compliance or
  finance answer, not an engineering one.
- **Is there a point after which the number is frozen?** Financial
  close, regulatory submission, contractual settlement. That date is the
  real boundary between "still correcting" and "immutable," and it
  belongs in the schema.
- **Why is data late — one known source, or the general shape of the
  business?** A single misbehaving upstream is a bug to fix. Genuinely
  disconnected producers (`D3-Q01`) mean lateness is permanent and must
  be designed for.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Late arrival is common and valuable | Stated | — | Dropping late data is off the table; the design is about correcting, not discarding |
| Events carry a trustworthy event time | Assumed | "If producers stamp event time badly, that's the first fix — nothing downstream can compensate for it" | Every window and watermark depends on it |
| Dashboards tolerate provisional numbers if labelled | Assumed | "I'll assume we can show 'as of' and a completeness indicator rather than a bare figure" | Allows early triggers instead of waiting for completeness |
| Some reports must eventually be frozen | Assumed | "Finance closes a period; after close, corrections become adjustments" | Introduces a freeze boundary and an adjustment path |
| Corrections must be auditable | Assumed | "Someone will ask why last Tuesday's number changed" | Favours append-with-version over in-place overwrite |
| Reprocessing from raw is available | Assumed | "We keep raw events, so a deep correction is possible" | Makes very-late data a batch problem, not a streaming one |

**The answer, out loud**

I'd start by refusing the framing that the dashboards are wrong. They're
provisional, and the defect is that they present a provisional number as
if it were final. Half of this problem is solved by making completeness
visible; the other half is making the pipeline keep correcting for as
long as the business says corrections matter.

Mechanically, I'd set three parameters and say what each one costs.
First, windows on event time — fixed windows sized to the reporting
grain, say hourly, with the window keyed by when the event happened, not
when it showed up. Second, triggers: fire early and repeatedly so a
dashboard has a number within seconds, then fire again on watermark
passage, then fire on every late element within allowed lateness. Third,
allowed lateness, set from the arrival-lag histogram rather than from a
round number somebody liked. Allowed lateness is the expensive knob,
because the pipeline holds window state for that whole duration, and
state is what makes a streaming job's cost and failure characteristics
what they are. I'd size it to cover the bulk of the tail and route the
rest elsewhere rather than buying a week of state to catch a fraction of
a percent.

Then accumulation mode, which is the detail that decides whether the
downstream is easy or awful. I'd use accumulating panes, where each
firing emits the complete current value of the window, and I'd have the
sink treat the window key as an upsert target. Discarding panes — where
each firing emits only the delta — are cheaper in flight and put the
burden of summing partials on every consumer forever. I'd only choose
discarding when the sink is genuinely additive and I control every
consumer of it.

Beyond allowed lateness, data goes to a side output, not to the floor.
That stream lands in a "very late" table with its event time intact, and
a scheduled job folds it into the affected partitions on a cadence —
daily is usually right. This is the structural version of a Lambda
architecture's correction layer, and I'd name it as such: the streaming
path is the speed layer that is allowed to be provisional, and a batch
pass over the raw archive is what makes the number authoritative.

The serving model is where I'd spend the rest of the whiteboard.
Aggregates go into BigQuery partitioned on event date, and every row
carries a version and a `computed_at`. Consumers read a view that
selects the latest version per key, so a restatement is an append plus a
view resolution rather than a mutation of history. That gives me the
audit trail for "why did Tuesday change" for free, and it makes the
freeze boundary implementable: after financial close, the view pins to
the version as of the close timestamp, and later corrections flow into
an explicit adjustments table instead of silently rewriting a closed
period.

And I'd put completeness on the dashboard itself. Every tile shows an
"as of" watermark and a completeness estimate — what fraction of
expected producers have reported for that window, derived from the
producer roster rather than from the data's own volume, because the data
cannot tell you about the producer that sent nothing. That one indicator
converts an argument about whether the pipeline is broken into a shared
understanding of how complete the picture currently is.

Where I'd push back: if the panel says "we need it exact and immediate,"
I'd say those are two requirements that trade against each other and ask
which one has the money behind it. You can have a fast provisional
number and a slow exact one, and you can converge them, but you cannot
have completeness before the data has arrived.

**Architecture**

```
  LATE-TOLERANT PIPELINE — three time horizons, one source of truth
  ═════════════════════════════════════════════════════════════════

  events (event_time stamped at the source)                   ◄── (1)
        │
        ▼
   Pub/Sub ──────────────────┬──────────────────────────────┐
        │                    │                              │
        ▼                    ▼                              ▼
  ┌───────────────────────────────────┐              GCS raw archive
  │ Dataflow streaming                │              (replay source)
  │  fixed windows on EVENT TIME      │  ◄── (2)          ◄── (6)
  │  trigger: early + on-watermark    │  ◄── (3)
  │           + on every late element │
  │  allowed lateness = tail of the   │  ◄── (4)
  │           arrival-lag histogram   │
  │  ACCUMULATING panes               │  ◄── (5)
  └───────┬───────────────────┬───────┘
          │                   │ beyond allowed lateness
          ▼                   ▼
   BigQuery agg table    very_late side output ──► daily fold-in  ◄── (7)
   partition=event_date       │                     job over the
   + version + computed_at ◄──┘                     raw archive
          │
          ▼
   consumer VIEW: latest version per (window_key)             ◄── (8)
   after period close, view PINS to the close version;
   later corrections go to an adjustments table              ◄── (9)
          │
          ▼
   dashboard tile: value + "as of" watermark + completeness   ◄── (10)
   (completeness measured against the PRODUCER ROSTER, because
    missing data cannot report its own absence)

  Cross-cutting: allowed lateness is the expensive parameter —
  it is how long the job holds window state, so it is sized from
  the histogram and not from a round number (11); every restatement
  is an APPEND with a new version, never an in-place update, so
  "why did Tuesday change" is answerable without a forensic
  exercise (12).
```

**Every arrow explained:**

1. **Event time stamped at the source** — if the producer can't be
   trusted to stamp it, fix that before anything else; no downstream
   mechanism recovers a wrong event time.
2. **Fixed windows on event time** — the window a record belongs to is
   decided by when it happened. Windowing on processing time is the
   default that produces the exact symptom in the question.
3. **Early, on-watermark and late triggers** — gives a fast provisional
   number and a converging corrected one. Use repeated triggers when
   consumers can absorb updates; don't use them when the sink is
   append-only and every firing becomes a duplicate row nobody resolves.
4. **Allowed lateness from the histogram** — the tail you choose to
   catch in-stream. Everything beyond it is handled in batch, on purpose.
5. **Accumulating panes** — each firing emits the window's full current
   value, so the sink upserts. Use discarding panes only when the sink is
   additive and you control every consumer.
6. **Raw archive as the correction source** — the deep restatement path.
   Without it, "very late" data has nothing authoritative to be folded
   into.
7. **Very-late side output plus a scheduled fold-in** — keeps the
   streaming job's state bounded while still never losing a record.
8. **Latest-version view** — consumers never see raw versions. The view
   is the interface; the table is storage.
9. **Freeze at period close** — after close, the view pins and
   corrections become explicit adjustments. Silent restatement of a
   closed period is how a data platform loses finance's trust
   permanently.
10. **Completeness against a producer roster** — the only way to see a
    producer that sent nothing at all. Volume-based heuristics cannot
    detect silence.
11. **State cost of allowed lateness** — the parameter is a cost and
    reliability decision as much as a correctness one; say that out loud
    rather than setting it generously and discovering it in an incident.
12. **Append-only restatement** — history is evidence. In-place updates
    destroy the audit trail exactly where auditors look.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Window basis | Event time | Processing time | The only basis under which a late record lands in the period it belongs to | When events genuinely have no meaningful time of their own (synthetic load, system heartbeats) — then processing time is honest |
| Pane accumulation | Accumulating | Discarding | Consumers upsert a complete value; no partial-sum logic leaks downstream | When the sink is strictly additive and fully controlled — then discarding panes cut state and volume |
| Lateness handling | Bounded allowed lateness + batch fold-in for the rest | One very long allowed lateness covering everything | Bounds streaming state; deep corrections happen where they're cheap | When the tail is short and uniform — then a single generous window is simpler than maintaining two paths |
| Correction model | Append with version, resolve in a view | Update rows in place | Auditable, replay-safe, and it makes the freeze boundary implementable | When storage cost dominates and no audit requirement exists — then in-place update with a change log is leaner |
| Freeze policy | Pin at period close; adjustments thereafter | Keep correcting forever | Finance needs a number that stops moving; auditors need to see what changed after it stopped | When no period concept exists (pure operational telemetry) — then continuous correction is correct and a freeze would be artificial |
| Completeness signal | Producer roster comparison | Volume anomaly detection on arrivals | Detects total silence from a producer, which volume-based checks structurally cannot | When the producer set is unbounded or anonymous (public web events) — then volume anomaly detection is the only available signal |

**What a weak answer sounds like**

- "We'd increase the window size." — bigger windows change the reporting
  grain, not the lateness tolerance; the two knobs are independent and
  confusing them is a giveaway.
- "We'd drop anything more than five minutes late." — this is the
  current behaviour causing the complaint, restated as a policy, and it
  discards exactly the records the question says are most valuable.
- "Just use batch, it's simpler." — sometimes right, but here it trades
  one complaint for another and doesn't address why corrections need to
  be visible.
- "The dashboard should just refresh more often." — refresh rate is
  about staleness of the query; the problem is completeness of the
  underlying window, which refreshing cannot fix.

**Common wrong turns**

- **Setting allowed lateness generously "to be safe."** It's a state
  cost and a failure-recovery cost, and it silently changes the job's
  operational profile. Recover by tying it to the histogram out loud.
- **Restating in place.** It's the natural SQL instinct and it destroys
  the evidence trail. Recover by switching to append-with-version while
  drawing the sink.
- **Forgetting downstream consumers of the provisional number.** A
  corrected table is useless if an extract was taken at noon and mailed
  to a regulator. Recover by asking who copies data out of this system.
- **Treating completeness as a data property.** The data cannot report a
  producer that sent nothing. Recover by introducing the roster.

**Follow-up probes the interviewer asks next**

1. **"A producer has been silently offline for three days. When do you
   find out?"** — within the roster's expected-reporting interval,
   because completeness is measured against who should have reported,
   not against what arrived. This is the probe that separates a
   completeness design from a volume-alert design.
2. **"You now have ten thousand of these windowed aggregations across
   fifty pipelines. What breaks?"** — state size and job restart time
   first, then the cost of repeated triggers writing to BigQuery. I'd
   consolidate to fewer pipelines with keyed aggregation rather than many
   jobs, and I'd move the low-value aggregations to batch, since most
   aggregates in a portfolio that size have no real-time consumer at all
   (`D3-Q08`).
3. **"Finance closed the quarter and then a week of late data arrived.
   What happens?"** — it lands in the adjustments table, the closed
   period's view does not move, and a named human decides whether the
   adjustment is material enough to restate. That decision is
   deliberately not automated.
4. **"Who owns the decision about how long we keep correcting?"** — the
   data owner for that domain, written into the dataset's contract
   alongside freshness and completeness targets (`D3-Q17`). If nobody
   owns it, engineering ends up choosing a number that finance later
   disputes.
5. **"Can you get the provisional number to sub-second?"** — yes, by
   moving the early-trigger output to a low-latency serving store and
   leaving BigQuery for the converged value. That's the hot/cold split in
   `D3-Q15`, and I'd only build it if someone acts on the sub-second
   number.
6. **"What if the event timestamps themselves are wrong?"** — then
   nothing in this design works, and I'd say so plainly. The mitigation
   is a clock-skew check at ingest that flags events whose event time is
   implausible relative to receipt time, quarantining rather than
   silently windowing them into the wrong period.

**Cross-references**

- `04-architectures/case-study-terramearth.md` — the case study where
  late arrival is the normal case, and the watermark-lag metric that
  goes with it.
- `04-architectures/pattern-data-analytics-pipeline.md` — Lambda's
  speed/batch split is what callouts (6) and (7) implement.
- `D3-Q01` for why the data is late, `D3-Q15` for the serving split,
  `D3-Q17` for who owns the correction window.

---

### D3-Q05 — "Our BI team and our ML team have built two different copies of the same data and the numbers disagree. Design one source of truth that serves both."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 1.3, 2.2, 4.3 |
| **Axis** | data |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D3-Q06` |

**What the interviewer is actually testing**

Whether you know which parts of the divergence are a defect and which
parts are legitimate. BI asks "what is true now," modelling asks "what
was knowable at the moment of the decision" — those are different
questions that must not be answered from the same table, but they must
be derived from the same layer. A candidate who promises one table for
everything has misunderstood the problem; so has one who accepts two
pipelines.

**Clarifying questions to ask before drawing anything**

- **Where exactly do the numbers disagree — the input data, the
  filters, or the definition?** Nine times in ten it's the definition of
  a metric, not the data. That changes the answer from a storage design
  to a semantic-layer design.
- **Does the ML side need point-in-time correctness?** If features are
  computed from the current state of a record but the label came from
  six months ago, the model is learning from the future. That single
  question decides whether the Gold layer forks.
- **How much of the current duplication is organizational?** Two teams,
  two budgets, two tools. If the cause is ownership, a shared table
  doesn't fix it and I'd say so.
- **What's the existing transformation estate?** A large Spark codebase
  and a SQL-first team lead to different engines for the same
  architecture, and rewriting working transformation logic is rarely the
  best first move.
- **Is any of this data regulated?** If the raw layer carries personal
  data, retention and erasure (`D3-Q10`) constrain how long Bronze can
  live, which is otherwise the layer people keep forever by default.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| One conformed layer both sides derive from | Stated | — | Silver becomes the contract, not the dashboards |
| Raw data is retained and reprocessable | Assumed | "I'll assume we can keep raw; if regulation forbids it, the design loses its correction path" | Bronze is what makes a transformation bug recoverable |
| ML needs point-in-time correct training data | Assumed | "If features are read as-of-now against historical labels, we're leaking the future into training" | Forces a separate Gold branch with as-of semantics |
| Metric definitions are contested today | Assumed | "Two teams each have a definition of 'active customer' and both are defended" | Needs a single definition layer with an owner, not two SQL files |
| Both sides tolerate hours-old data | Assumed | "If either needs minutes, say so — it changes the refresh model, not the layering" | Keeps this batch-shaped; streaming would be `D3-Q04` |
| Existing transformation code has value | Assumed | "I won't propose rewriting working Spark for aesthetic consistency" | Engine choice becomes per-workload, not global |

**The answer, out loud**

I'd draw three layers and then immediately complicate the top one,
because that's where the real answer is.

Bronze is the raw landing zone — data exactly as it arrived, immutable,
partitioned by ingest date, with the source system and extraction time
recorded on every row. No cleaning, no type coercion, no deduplication.
It lives in Cloud Storage with BigLake tables over it, or in BigQuery
native storage if the volume and query pattern justify it. The reason
Bronze exists is not tidiness — it's that every transformation below it
is a hypothesis I will eventually discover is wrong, and Bronze is what
lets me re-derive everything from scratch when that happens.

Silver is the conformed layer, and this is the source of truth both
teams share. Deduplicated, typed, keys resolved across systems, late
records folded in, quality rules applied at promotion rather than at
ingest. One table per business entity — customer, order, shipment — with
an explicit grain stated in the table description, because most
"disagreeing numbers" incidents are two people aggregating at different
grains and neither knowing it. Silver is what a data contract points at
(`D3-Q17`).

Gold is where I'd stop pretending one shape serves everyone. It forks.
The BI branch is denormalized marts built for known questions, with
metric definitions expressed once — "active customer" is defined in one
place, and both a dashboard and a model read that definition rather than
each re-implementing it. The ML branch is training datasets built with
as-of semantics: every feature value joined to the label using the value
that was knowable at the label's timestamp, not the current value. That
join is the difference between a model that works in evaluation and one
that fails in production, and it cannot be retrofitted onto a BI mart.
The feature-store mechanics for the serving side are `D3-Q11`, and the
model itself is `design-07`'s problem, not mine at this whiteboard.

Then the part candidates skip: training datasets have to be immutable
and versioned. When someone asks in a year why a model behaved a certain
way, "we retrained on the Gold table" is not an answer if that table has
been overwritten sixty times since. So a training dataset is a snapshot,
tagged with a version, retained for as long as the model it produced is
in service. BigQuery table snapshots make this nearly free in storage
terms compared with copying, and the discipline is worth far more than
it costs.

On engines, I'd be deliberately unexciting. SQL transformations inside
BigQuery are the default, orchestrated as a dependency graph with tests
attached to each model. Where there's a large working Spark estate, that
runs on Dataproc and writes into the same Silver layer — I wouldn't
rewrite working transformation logic to make a diagram uniform. Cloud
Composer orchestrates across systems, where dependencies span an
external load, a Spark job and a SQL graph; I would *not* use Composer
to schedule a pure SQL graph that a SQL transformation tool already
resolves, because that's two dependency graphs disagreeing at 3am.

The last thing, and I'd say it unprompted: this architecture fails for
organizational reasons far more often than technical ones. If the ML
team can't get a change into Silver within a sprint, they will fork it
again, and the fork will be justified. So Silver needs an owner with
capacity, a contribution path for consumers, and a service level on
changes. That's `D3-Q17` and `design-06`, and it's the half of this
problem a diagram can't solve.

**Architecture**

```
  sources: CDC (D3-Q06), events (D3-Q01), files, SaaS extracts
        │
        ▼
  ┌───────────────────────────────────────────────┐
  │ BRONZE — raw, immutable, as-arrived           │  ◄── (1)
  │ GCS + BigLake (or BQ native), partition =     │
  │ ingest_date, columns: source, extracted_at    │
  └───────────────────┬───────────────────────────┘
                      ▼
  ┌───────────────────────────────────────────────┐
  │ SILVER — conformed, deduplicated, typed       │  ◄── (2)
  │ one table per business entity, GRAIN STATED   │
  │ quality rules run at promotion, failures to   │  ◄── (3)
  │ a quarantine table, never silently dropped    │
  └──────────┬─────────────────────────┬──────────┘
             │                         │
             ▼                         ▼
  ┌────────────────────┐    ┌──────────────────────────────┐
  │ GOLD / BI          │    │ GOLD / ML                    │
  │ denormalized marts │    │ AS-OF joins: feature value   │
  │ metric definitions │    │ as it was at label time      │  ◄── (5)
  │ defined ONCE ◄──(4)│    │ snapshots, versioned,        │
  │                    │    │ retained for model lifetime  │  ◄── (6)
  └─────────┬──────────┘    └──────────┬───────────────────┘
            ▼                          ▼
     dashboards, reports        training jobs / feature store
                                (serving split → D3-Q11,
                                 model side → design-07)  ◄── (7)

  Cross-cutting: the shared truth is SILVER, not Gold — the two Gold
  branches are legitimately different questions and forcing them into
  one table is what produced the original disagreement (8); Bronze is
  the only thing that makes a bad transformation recoverable, so its
  retention is a correctness decision, not a storage one (9).
```

**Every arrow explained:**

1. **Bronze as immutable raw** — no cleaning, no coercion. Use it when
   you will ever need to re-derive; don't keep it when regulation makes
   holding raw personal data the larger risk (`D3-Q10`) — then land,
   transform and discard, and accept that bugs become permanent.
2. **Silver as the conformed contract** — one entity per table, grain
   written down. Most "the numbers disagree" incidents are a grain
   mismatch nobody documented.
3. **Quality at promotion, quarantine on failure** — rows that fail
   validation go to a quarantine table with the rule that rejected them.
   Failing the whole job instead turns one bad record into an outage;
   dropping silently turns it into a wrong number.
4. **Metric definitions in one place** — "active customer" is defined
   once and consumed by both branches. Two SQL files with the same
   metric name is the actual root cause in most versions of this
   scenario.
5. **As-of joins in the ML branch** — features joined at the label's
   timestamp. Without this the model trains on information that did not
   exist at prediction time and performs far worse in production than in
   evaluation.
6. **Versioned, immutable training snapshots** — retained for the
   service life of the model they produced, so "why did it behave that
   way" is answerable.
7. **Handoff, not ownership** — serving-side mechanics are `D3-Q11` and
   model design is `design-07`. This layer's job ends at producing
   correct, reproducible training data.
8. **Shared truth is Silver** — the forked Gold layer is the design,
   not a compromise. A single table serving both is what created the
   disagreement in the first place.
9. **Bronze retention as correctness** — how far back you can re-derive
   is exactly how far back you can fix a bug.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Shared layer | Silver as the single conformed source, forked Gold | One unified Gold table for BI and ML | Serves two genuinely different questions without duplicating ingestion or cleaning | When ML only needs current-state features (no historical labels) — then one Gold table is simpler and honest |
| Bronze storage | Cloud Storage + BigLake tables | BigQuery native storage for everything | Cheap at raw volume, and reprocessing reads files rather than re-exporting | When Bronze is queried constantly or is modest in size — then native storage is faster and simpler to govern |
| Transformation engine | SQL-in-BigQuery by default | Spark on Dataproc for everything | Fewer moving parts, tests live with the models, no cluster lifecycle | When a large working Spark codebase exists — then keep it on Dataproc and write into the same Silver layer |
| Orchestration | Composer across systems only | Composer schedules every SQL model too | One dependency graph per concern instead of two graphs disagreeing at 3am | When there is no SQL-native transformation framework in play — then Composer is the only graph you have |
| Training data | Immutable versioned snapshots | Retrain against the live Gold table | Reproducibility, and an answer when a model's behaviour is questioned | When models are retrained continuously and never audited — rare, and usually an assumption worth challenging |

**Making it concrete**

```bash
# A training dataset is a snapshot with a name, not a query someone
# re-ran. Cheap to create, and it is the artifact that makes a model's
# behaviour explainable a year later.
bq cp --snapshot --no_clobber \
  PROJECT_ID:gold_ml.customer_features \
  PROJECT_ID:gold_ml.customer_features_v2026_09_12

# Retention is set from the service life of the model it trained,
# not from a storage-cleanup default.
bq update --expiration 63072000 \
  PROJECT_ID:gold_ml.customer_features_v2026_09_12
```

**What a weak answer sounds like**

- "Everyone reads from one Gold table." — it collapses two different
  questions into one and reproduces the disagreement the question is
  about, just with fewer tables.
- "We'd put a data catalog on it." — cataloguing two divergent copies
  documents the problem rather than fixing it; the catalog is useful
  after the layering, not instead of it.
- "The ML team can just query the warehouse." — they can, and without
  as-of semantics they'll build a model that leaks future information
  and looks excellent until it ships.
- "We'd standardize everything on one engine." — engine uniformity is a
  diagram property; rewriting working transformation logic to get it is
  a cost with no stated benefit.

**Common wrong turns**

- **Treating medallion as three folders rather than three contracts.**
  Layers with no stated grain and no quality gate are just staging
  areas. Recover by writing the grain on the whiteboard next to Silver.
- **Cleaning at ingest.** It feels efficient and destroys the thing that
  makes a bad rule recoverable. Recover by moving validation to the
  Bronze-to-Silver promotion.
- **Letting Gold tables be authored by their consumers ad hoc.** It's
  how you get sixty definitions of one metric. Recover by naming who
  owns the metric layer.
- **Forgetting that the ML branch needs history, not just current
  state.** Recover by asking what timestamp the label came from.

**Follow-up probes the interviewer asks next**

1. **"A transformation bug ran for three months. Walk me through the
   fix."** — fix the model, re-derive Silver and Gold from Bronze for
   the affected range into a shadow dataset, diff against the current
   output so the blast radius is a number rather than a guess, then
   promote and notify every consumer whose reported figures moved.
2. **"You have twelve source systems now. What breaks at two hundred?"**
   — not the layering; what breaks is per-source bespoke code and the
   review capacity of whoever owns Silver. I'd make source onboarding
   config-driven against a template (`D3-Q06`) and push conformance
   rules into shared, tested macros rather than hand-written SQL per
   source.
3. **"Who decides what 'active customer' means?"** — a named business
   owner, with the definition versioned in the metric layer and a
   changelog, because changing it silently moves every historical
   report. The governance mechanics live in `D3-Q17` and `design-01`'s
   `D1-Q16`, not in this pipeline.
4. **"The ML team says Silver is too slow to change for them. What do
   you do?"** — give them a sanctioned contribution path into Silver
   with review, plus a clearly-labelled experimental zone that is
   explicitly not a source of truth and cannot feed a dashboard. Denying
   the need is how the second copy gets built again.
5. **"How do you stop personal data leaking into training datasets?"** —
   column-level policy tags applied at Silver and inherited downstream,
   plus de-identification before the ML branch, with the control design
   itself owned by `design-04`. I'd name the integration point rather
   than design the control here.

**Cross-references**

- `04-architectures/pattern-data-analytics-pipeline.md` — the medallion
  section is the compressed reference; this question is the design
  conversation and the Gold fork it doesn't cover.
- `03-comparisons/02-storage-database-options.md` — BigQuery's row backs
  the storage choices for Silver and Gold.
- `D3-Q06` for how data arrives, `D3-Q11` for the serving split,
  `D3-Q17` for who owns Silver, `design-07` for anything about models.

---

### D3-Q06 — "Thirty production databases, four different engines, and analytics wants all of them. Design the change data capture."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 1.3, 1.4, 2.2 |
| **Axis** | data |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D3-Q05` |

**What the interviewer is actually testing**

Whether you design a fleet or thirty snowflakes. The technical content —
log-based capture, snapshot-then-stream, merge into a current-state
table — is well-trodden; what separates candidates is whether they build
one templated pipeline with a source registry, and whether they know the
operational failure that actually takes CDC down, which is source log
retention, not throughput.

**Clarifying questions to ask before drawing anything**

- **Which engines, and are they all managed?** Log-based capture is
  available for the mainstream relational engines; anything outside that
  set needs a different mechanism and I'd rather find the exceptions now
  than in month three.
- **Can I read from replicas?** Capturing from a primary that's already
  under load is a conversation with the owning team. Replica capture is
  usually the answer, and it changes the lag budget.
- **How long do the sources retain their transaction logs?** This is the
  question nobody asks and everybody regrets. If the log holds six hours
  and my pipeline can be down for eight, every outage becomes a full
  re-snapshot of a production database.
- **Do the sources hard-delete?** If rows disappear, a timestamp-based
  incremental extract cannot see it, and the analytics side will report
  customers who left as if they were still here.
- **Which of the thirty actually have a consumer?** I'd rather onboard
  the eight that someone is waiting for than all thirty on principle,
  and the difference is usually a quarter of elapsed time.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| 30 sources, 4 engines | Stated | — | Forces a templated fleet approach over per-source pipelines |
| Analytics tolerates minutes of lag | Assumed | "If anything needs sub-second source replication, that's a different design and probably a different requirement" | Keeps this CDC rather than dual-write or read-replica routing |
| Capture must not destabilise production | Assumed | "I'll capture from replicas and treat source load as a hard constraint" | Rules out trigger-based and aggressive polling |
| Hard deletes occur | Assumed | "Most operational systems delete something; I'll design for tombstones" | Rules out timestamp-only incremental extraction as the default |
| Schema changes happen without notice | Assumed | "Source teams will add columns on their own schedule" | Requires drift detection and quarantine, not auto-apply |
| Not every column may be replicated | Assumed | "Some source columns are personal data with no analytical use" | Column allow-lists at the stream, not filtering after landing |

**The answer, out loud**

The first decision is that I'm building one pipeline thirty times, not
thirty pipelines. A source is a row in a registry — engine, connection,
replica endpoint, table and column allow-list, target dataset, owner,
sensitivity class — and onboarding a source is a configuration change
that goes through review. If onboarding requires writing code, the
thirty-first source costs as much as the first and the platform team
becomes the bottleneck forever.

Then I'd triage by mechanism, because the four engines won't all get the
same treatment. Log-based capture is the default: Datastream reading the
transaction log from a replica, landing changes into Cloud Storage or
directly into BigQuery. It's the only mechanism that sees deletes, sees
every intermediate update, and imposes near-zero query load on the
source. For engines Datastream doesn't cover, I'd go to the application:
an outbox table written in the same transaction as the business change,
drained by a simple reader. That's more work for the owning team, and
it's honest work — it also solves their dual-write problem
(`D3-Q02`). The fallback I'd accept only with the caveats stated is
query-based incremental extraction on an updated-at column, and I'd name
its three holes out loud: it cannot see hard deletes, it misses
intermediate states between polls, and it silently loses rows when
source clocks drift or transactions commit out of timestamp order. What
I would not do is trigger-based capture — it puts my correctness
requirements inside someone else's write path and breaks on their next
schema change.

The load pattern per source is snapshot then stream. Take a consistent
initial snapshot, record the log position it corresponds to, and start
streaming from exactly that position. Getting that handoff wrong in
either direction is the classic CDC bug: overlap gives duplicates, which
the merge absorbs, and a gap gives silent permanent data loss, which
nothing absorbs. So I'd deliberately choose overlap and let dedup clean
it up, and I'd say that out loud as a conscious asymmetry — duplicates
are recoverable, gaps are not.

On the landing model, I keep two tables per source table. The first is
an append-only change log: every change event with its operation type,
source commit timestamp, log position, and the full row image,
partitioned by ingest date. The second is the current-state table,
produced by merging the change log on primary key, keeping the highest
log position per key. Consumers read current state; investigators read
the change log. Deletes become a tombstone in the change log and a
soft-delete flag in current state, because "this customer is gone" and
"this customer never existed" are different facts and analytics needs to
tell them apart.

Schema drift gets detected, not absorbed. A new nullable column is
additive and can flow through automatically. A type change, a dropped
column, or a primary key change is a breaking event: the pipeline
quarantines and alerts the source owner rather than guessing. That's
`D3-Q07` mechanically and `D3-Q17` organizationally — the source team
must know their schema is a published interface, because the failure
mode of "analytics broke and nobody told the team who changed
something" is a trust problem, not a pipeline problem.

Finally, the operational reality I'd put on the board unprompted: the
thing that takes CDC down is source log retention. If a stream is paused
for longer than the source retains its transaction log, the position it
needs is gone and the only recovery is a fresh snapshot of a production
database — which is exactly the load event we designed the whole thing
to avoid, now happening during an incident. So I'd monitor replication
slot lag and log-retention headroom per source as first-class alerts,
and I'd negotiate retention windows with the database owners as part of
onboarding rather than discovering them the hard way.

**Architecture**

```
  SOURCE REGISTRY (config, reviewed)  ── engine, replica endpoint,
  table + COLUMN allow-list, target, owner, sensitivity   ◄── (1)
        │  one templated pipeline, instantiated per row
        ▼
  ┌──────────────┬───────────────────┬────────────────────┐
  │ log-based    │ outbox table      │ query-based        │
  │ (default)    │ (unsupported      │ incremental        │  ◄── (2)
  │ Datastream   │  engines)         │ (last resort —     │
  │ FROM REPLICA │  written in the   │  no deletes, no    │
  │              │  business TX      │  intermediates)    │
  └──────┬───────┴────────┬──────────┴─────────┬──────────┘
         └────────────────┴────────────────────┘
                          ▼
        snapshot ──► recorded log position ──► stream       ◄── (3)
        (deliberate OVERLAP; duplicates are recoverable,
         gaps are not)
                          ▼
  ┌────────────────────────────────────────────────────────┐
  │ change log table  (append-only)                        │  ◄── (4)
  │  op, commit_ts, log_position, full row image           │
  │  partition = ingest_date                               │
  └───────────────────────┬────────────────────────────────┘
                          │ MERGE on PK, keep MAX(log_position)
                          ▼
  ┌────────────────────────────────────────────────────────┐
  │ current-state table  — deletes become soft-delete      │  ◄── (5)
  │ flags, so "gone" and "never existed" stay distinct     │
  └───────────────────────┬────────────────────────────────┘
                          ▼
                    SILVER layer (D3-Q05)                    ◄── (6)

  schema drift ─► additive = flow through; breaking = QUARANTINE
  and alert the source owner, never auto-apply                ◄── (7)

  Cross-cutting: the failure that actually kills CDC is source
  transaction-log retention — if a stream is down longer than the
  log is kept, recovery is a full re-snapshot of production during
  an incident, so slot lag and retention headroom are first-class
  alerts negotiated at onboarding (8); column allow-lists are set at
  the stream so personal data never lands, rather than being deleted
  after it does (9).
```

**Every arrow explained:**

1. **Source registry as the unit of work** — onboarding is a reviewed
   config change. If it requires code, the platform team becomes a
   permanent queue and source thirty costs what source one cost.
2. **Mechanism triage** — log-based by default; outbox where the engine
   isn't supported; query-based incremental only with its holes stated.
   Don't use trigger-based capture: it puts your correctness inside
   someone else's write path and breaks on their next schema change.
3. **Snapshot, position, stream, with deliberate overlap** — duplicates
   are absorbed by the merge; a gap is silent permanent loss. Choosing
   the recoverable failure on purpose is the point.
4. **Append-only change log** — the forensic record. Investigators and
   reprocessing read this; it is also what lets you rebuild current
   state after a merge bug.
5. **Current state via merge on log position** — highest position per
   key wins, not latest arrival. Deletes become soft-delete flags so
   downstream can distinguish departure from absence.
6. **Feeds Silver, doesn't replace it** — CDC output is a source, not a
   conformed layer; entity conformance happens in `D3-Q05`.
7. **Drift detection with quarantine** — additive changes flow;
   breaking changes stop and page the source owner. Auto-applying a type
   change is how a silent corruption starts.
8. **Log-retention headroom as an alert** — the real operational
   failure mode, and the one that turns a small outage into a production
   re-snapshot.
9. **Column allow-list at the stream** — personal data that never lands
   needs no erasure workflow later (`D3-Q10`).

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Capture mechanism | Log-based from a replica | Query-based incremental on updated-at | Sees deletes and every intermediate state, minimal source load | When the engine has no accessible log and no appetite for an outbox — then accept incremental extraction with its holes documented |
| Unsupported engines | Application outbox in the business transaction | Dual-write from the application to the bus | Atomic with the business change; no lost-or-phantom events | When the source is read-only or third-party and cannot be modified — then a periodic full extract with diffing is the remaining option |
| Fleet shape | One templated pipeline plus a source registry | Bespoke pipeline per source | Onboarding is a config review, not an engineering project | When sources are genuinely heterogeneous in semantics rather than just in engine — a handful of true specials is fine, thirty is not |
| Landing model | Append-only change log plus merged current state | Merge directly into a single table | Forensics, reprocessing and audit all come free from the log | When storage cost dominates and no audit need exists — then merge-only, accepting that mistakes are unrecoverable |
| Delete handling | Tombstone plus soft-delete flag | Physically delete from current state | Downstream can distinguish "left" from "never existed" | When downstream must not retain any trace of the record (`D3-Q10`) — then hard delete and record only the fact of erasure |
| Schema drift | Additive flows, breaking quarantines | Auto-apply all source schema changes | A wrong type change caught at the boundary instead of in a report | When the source and target are owned by the same team with shared tests — then auto-apply is acceptable and faster |

**Making it concrete**

```bash
# One stream per registry row. The column allow-list matters as much
# as the table list: data that never lands needs no erasure workflow.
gcloud datastream streams create stream-orders-prod \
  --location=REGION \
  --display-name="orders-prod -> analytics" \
  --source-config=source-orders-replica.json \
  --destination-config=dest-bq-raw.json \
  --backfill-all

# The alert that actually matters, per source, set at onboarding:
#   replication slot lag  <  source log retention  minus  the longest
#   outage the pipeline is allowed to have.
```

**What a weak answer sounds like**

- "We'd run a nightly extract of each table." — misses deletes, misses
  intermediate states, and puts a heavy scan on thirty production
  databases at the same hour.
- "We'd add triggers to capture changes." — moves your correctness
  requirement into someone else's write path and breaks the first time
  they alter a table.
- "Datastream handles it." — naming the service isn't the design; the
  interesting parts are the snapshot handoff, the merge semantics, the
  drift policy and log retention.
- "We'll merge straight into the target table." — works until the merge
  logic is wrong, at which point there is no record of what the source
  actually said.

**Common wrong turns**

- **Ignoring source log retention.** It's invisible until the first
  extended outage, then it's a production re-snapshot mid-incident.
  Recover by making it an onboarding negotiation and an alert.
- **Capturing from the primary because it's easier to get access.**
  Recover by treating source load as a hard constraint and asking for a
  replica before anything else.
- **Treating a schema change as a pipeline bug.** It's an interface
  change by a team that didn't know they had an interface. Recover by
  routing the alert to them, not to your own on-call.
- **Onboarding all thirty because the mandate says thirty.** Recover by
  ordering by who is actually waiting; unused replication is pure cost
  and pure surface area.

**Follow-up probes the interviewer asks next**

1. **"A source team renames a column on Friday afternoon. What
   happens?"** — the drift check quarantines the stream, the source
   owner is alerted, and the current-state table stops updating while
   the change log keeps the raw events. Nothing silently changes type or
   goes null, which is the outcome I care about most.
2. **"Thirty sources today. What breaks at three hundred?"** — not the
   pattern; what breaks is quota and concurrency on the streams, merge
   job cost if every source merges on its own schedule, and human review
   of registry changes. I'd batch merges by tier, move low-value sources
   to a slower cadence, and automate the registry review for sources
   that carry no sensitive columns.
3. **"Your CDC pipeline is down for twelve hours. Walk me through the
   recovery."** — check retention headroom per source first, because
   that splits the fleet into "resume from position" and "needs
   re-snapshot." Resume the first group, schedule the second group's
   snapshots off-peak with the owning teams informed, and communicate
   which datasets are stale rather than letting dashboards quietly show
   old numbers.
4. **"Who owns the contract between a source database and analytics?"** —
   the source team owns the schema and its change policy, the platform
   team owns the mechanism, and a written contract sits between them
   (`D3-Q17`). Without that, analytics owns a dependency nobody agreed
   to provide, which is the organizational failure mode of every CDC
   programme I've seen.
5. **"One of the thirty databases holds personal data you can't move to
   analytics. Now what?"** — column allow-list at the stream so it never
   leaves, or tokenisation in the pipeline if the analytical need is
   joinability rather than the value itself. The control catalogue is
   `design-04`'s; my job is to make sure the data doesn't land first and
   get cleaned up later.

**Cross-references**

- `04-architectures/pattern-data-analytics-pipeline.md` — the CDC row of
  its variant table is the compressed version of the mechanism triage.
- `D3-Q05` for where this output lands, `D3-Q07` for schema evolution
  mechanics, `D3-Q10` for why column allow-lists matter, `D3-Q17` for
  the source-team contract.
- `03-comparisons/02-storage-database-options.md` for the target-store
  positioning; don't re-derive it here.

---

### D3-Q07 — "Every time a producer team adds a field, something downstream breaks. Design schema evolution so producers can move without asking permission."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 1.3, 5.1 |
| **Axis** | data |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D3-Q06` |

**What the interviewer is actually testing**

Whether you can state compatibility directions precisely and then build
enforcement that runs before the change ships rather than after it
breaks something. The tell is whether you distinguish a *structural*
change a registry can check from a *semantic* change it cannot — the
second one is where the expensive incidents come from.

**Clarifying questions to ask before drawing anything**

- **Who breaks — the pipeline, or the consumer's logic?** A pipeline
  that rejects a new field is a configuration problem. A consumer that
  computes a wrong number because a field's meaning changed is a
  different and much worse problem, and only one of them is fixed by a
  registry.
- **Can consumers be upgraded on demand?** If every consumer is in-house
  and deployable within a day, I can require forward compatibility only
  briefly. Embedded devices or external partners mean old readers exist
  forever and the constraint is permanent.
- **Is there a format already in use?** Retrofitting a schema onto
  free-form JSON in a live system is a migration in itself, and I'd
  rather sequence that deliberately than pretend the registry solves it.
- **How many consumers does a typical topic have, and does the producer
  know who they are?** If a producer can't enumerate their consumers,
  they cannot reason about impact, and the fix is a consumer registry
  before anything technical.
- **What's the tolerance for a dual-publish period?** Breaking changes
  need one, and its length is decided by the slowest consumer, which is
  usually an organizational answer.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Producers must ship without coordination | Stated | — | Compatibility must be machine-checked, not meeting-checked |
| Old consumers will exist during any change | Assumed | "There's always one consumer nobody can upgrade this quarter" | Forces full compatibility for routine changes |
| Structured, schema-bearing payloads are acceptable | Assumed | "If we're locked into free-form JSON, step one is a format migration" | Decides whether a registry can enforce anything at all |
| Breaking changes will eventually be necessary | Assumed | "Additive-only forever is a fiction; I'd rather have a good breaking-change path" | Requires versioned subjects and a dual-publish procedure |
| Consumers are enumerable | Assumed | "If producers can't see their consumers, no impact analysis is possible" | Makes the consumer registry part of the design, not paperwork |
| Analytics sinks must absorb additions | Assumed | "A new field shouldn't fail a load job" | Drives explicit field-addition settings rather than auto-detection |

**The answer, out loud**

I'd separate the problem into three layers, because "schema" is doing
too much work in the question. There's the envelope, the payload, and
the meaning, and each has a different enforcement mechanism.

The envelope is fixed and boring on purpose: event ID, event time,
producer, event type, schema version, and a correlation or idempotency
key. It never changes shape. Everything routing, deduplicating,
ordering, replaying or auditing reads only the envelope, which means
those systems are immune to payload evolution entirely. That single
decision removes most of the coupling people are complaining about when
they say "adding a field broke things."

The payload is where schemas live, registered as Avro or Protobuf with a
registry — Pub/Sub schemas attached to the topic for in-transit
enforcement, with the canonical definitions living in a repository the
producer owns. The compatibility rule I'd set as the platform default is
full compatibility: a new schema must be readable by old consumers and
able to read old data. In practice that means additive changes with
defaults, no required fields added, no field removed until its
deprecation window has passed, and no field number ever reused — that
last one matters more than it sounds, because reusing a field number in
a binary format silently reinterprets old bytes as a new meaning, and
nothing about that failure looks like an error.

Enforcement runs in the producer's own pipeline, not mine. The
compatibility check is a step in their CI against the registered
version, so a breaking change fails their build in the branch, before
anyone downstream is affected. I'd say plainly that a check running in
the platform team's pipeline is a check that fails after the change has
already shipped, and that turns the platform team into a blocker rather
than a guardrail. The registry is the arbiter; CI is where it speaks.

Consumers hold up their end by being tolerant readers: ignore unknown
fields, tolerate missing optional ones, never fail on the presence of
something new. That sounds obvious and is routinely violated by strict
deserializers configured to reject unknown properties, which is a
one-line setting that converts every producer's additive change into a
downstream outage. On the analytics side, the equivalent is enabling
field addition and relaxation on load rather than relying on schema
auto-detection, which will happily infer a different type from a
different day's data and change a column's meaning without anyone
deciding to.

Then breaking changes, which will happen no matter how good the rules
are. A breaking change is a new major version with its own subject and
its own topic. The producer publishes to both for a defined window,
consumers migrate on their own schedule inside it, and the old topic is
retired on a date that was agreed when the window opened, not
negotiated when it closes. The consumer registry is what makes this
workable — the producer can see who is still reading version one, and
the deadline conversation is with three named teams rather than with the
whole company.

The thing I'd flag unprompted is the failure a registry cannot catch. If
a producer keeps the field name `amount` but changes it from gross to
net, every compatibility check passes and every downstream number is
quietly wrong. The only defences are semantic: the field's meaning is
part of the contract and documented with it, semantic changes require a
new field name rather than a redefinition, and data-quality assertions
downstream catch distribution shifts (`D3-Q17`). I'd rather say that
out loud than let the panel assume I think a registry is sufficient.

**Architecture**

```
  PRODUCER REPO                          PLATFORM
  ═════════════                          ════════
  schema .proto/.avsc (producer owns)
        │
        ▼
  producer CI: compatibility check against the registered
  version — FULL by default; failing build stops the change
  in the branch, not in production                        ◄── (1)
        │  pass
        ▼
  schema registry / Pub/Sub topic schema_settings         ◄── (2)
        │
        ▼
  ┌──────────────────────────────────────────────────┐
  │ EVENT ENVELOPE — never changes shape             │  ◄── (3)
  │  event_id, event_time, type, schema_version,     │
  │  producer, idempotency_key                       │
  │ ──────────────────────────────────────────────── │
  │ PAYLOAD — versioned, additive, defaults on new   │  ◄── (4)
  │  fields, field numbers RESERVED, never reused    │
  └───────────────┬──────────────────────────────────┘
                  ▼
        consumers = TOLERANT READERS: ignore unknown,
        tolerate missing-optional, never fail on new     ◄── (5)
                  │
                  ├─► BigQuery load: ALLOW_FIELD_ADDITION +
                  │   relaxation; NOT schema auto-detect      ◄── (6)
                  └─► stream processors keyed off the envelope

  BREAKING CHANGE PATH:                                      ◄── (7)
    v2 subject + v2 topic ─► producer DUAL-PUBLISHES ─►
    consumer registry shows who still reads v1 ─►
    retirement date agreed when the window OPENS       ◄── (8)

  Cross-cutting: a registry checks STRUCTURE, never MEANING —
  renaming gross to net under the same field name passes every
  check and corrupts every downstream number, so semantic change
  requires a new field name plus distribution assertions (9).
```

**Every arrow explained:**

1. **Compatibility check in the producer's CI** — it fails in their
   branch, where it's cheap. A check that runs in the platform's
   pipeline fires after the change has shipped and makes the platform
   team the blocker.
2. **Registry as arbiter, schema attached to the topic** — in-transit
   validation rejects malformed publishes at the boundary rather than
   letting a consumer discover them.
3. **Fixed envelope** — routing, dedup, ordering, replay and audit read
   only this, so they are immune to payload evolution. This is the
   cheapest decoupling available and it's a day-one decision.
4. **Additive payload with reserved field numbers** — never reuse a
   number in a binary format; old bytes get reinterpreted with a new
   meaning and nothing raises an error.
5. **Tolerant readers** — a strict deserializer that rejects unknown
   properties turns every additive producer change into an outage. Use
   strict mode in tests; don't use it in production consumers.
6. **Explicit field-addition settings on load** — use them so a new
   field doesn't fail a job; don't rely on schema auto-detection, which
   can infer a different type from a different day's data.
7. **Breaking changes get a new version and a new topic** — attempting a
   breaking change in place is how consumers discover it by outage.
8. **Dual-publish plus a consumer registry** — the registry turns "who
   is still on v1" from an unanswerable question into three team names
   and a date.
9. **Semantics outside the registry's reach** — meaning changes must be
   new field names, backed by downstream distribution checks
   (`D3-Q17`).

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Compatibility mode | Full (both directions) as the platform default | Backward-only | Old consumers keep working *and* new consumers can read history | When every consumer is upgraded in lockstep with the producer — then backward-only is less restrictive for producers |
| Format | Schema-bearing binary (Avro/Protobuf) | JSON with an optional schema | Enforceable at the boundary, compact, and field numbering makes evolution explicit | When partners or debuggability dominate and payload volume is low — then JSON with a validated schema is the pragmatic pick |
| Enforcement point | Producer CI, before merge | Runtime validation only at the consumer | Breaks in the branch instead of in production | When producers are external and outside your CI — then runtime validation at the boundary plus quarantine is all you have |
| Envelope | Fixed envelope, versioned payload | One flat schema per event type | Platform machinery never has to change when payloads do | When there is exactly one consumer and one producer — then the envelope is ceremony with no payoff |
| Breaking change | New version, new topic, dual-publish | In-place change with a coordinated release | Consumers migrate on their own schedule; no synchronized deploy | When the producer and all consumers are one team with one pipeline — then a coordinated release is faster and cheaper |

**Making it concrete**

```hcl
# The schema is a first-class resource and the topic refuses payloads
# that do not conform, so a malformed publish fails at the boundary
# instead of being discovered by a consumer three hops away.
resource "google_pubsub_schema" "order_event" {
  project    = "PROJECT_ID"
  name       = "order-event-v1"
  type       = "AVRO"
  definition = file("${path.module}/schemas/order-event-v1.avsc")
}

resource "google_pubsub_topic" "order_events" {
  project = "PROJECT_ID"
  name    = "order-events-v1"
  schema_settings {
    schema   = google_pubsub_schema.order_event.id
    encoding = "BINARY"
  }
}
```

The version in both the schema name and the topic name is deliberate:
a breaking change is a new pair of resources, which makes the
dual-publish window a visible state rather than a branch in someone's
deployment script.

**What a weak answer sounds like**

- "We'd version the API and tell consumers to upgrade." — an unbounded
  migration with no registry of who is affected; the deadline arrives
  and nobody knows who breaks.
- "We use JSON so schema changes don't matter." — they matter exactly as
  much, you just find out later and in the consumer's code rather than
  at the boundary.
- "Auto-detect the schema on load." — convenient until a day's data
  makes a column look like a string, and then a numeric column changes
  type without anyone deciding.
- "Producers should just tell us before they change something." — that's
  the current process and it's the reason the question is being asked.

**Common wrong turns**

- **Putting enforcement in the platform's pipeline.** It converts a
  guardrail into a bottleneck and catches problems after the fact.
  Recover by moving the check into producer CI while drawing.
- **Allowing field-number reuse to keep a proto tidy.** Recover by
  reserving removed numbers permanently and saying why — silent
  reinterpretation of old bytes is the worst failure in this whole area.
- **Treating a semantic change as compatible because the check passed.**
  Recover by requiring a new field name for a new meaning.
- **Forgetting the analytics sink.** Producers stay compatible while the
  warehouse load job fails nightly. Recover by naming the field-addition
  settings as part of the same contract.

**Follow-up probes the interviewer asks next**

1. **"A producer needs to remove a field that three consumers still
   read. Walk me through it."** — deprecate it in the schema with a
   documented date, watch the consumer registry until reads stop, then
   remove and reserve its number. If a consumer can't move in the
   window, the window extends — the point of the registry is that this
   is a negotiation with named teams rather than a surprise.
2. **"Ten topics today, four hundred at scale. What breaks?"** — not the
   mechanism; what breaks is discovery and ownership. At four hundred
   topics, nobody knows which schemas matter, dead topics accumulate,
   and compatibility rules get exceptions granted by whoever is asked.
   I'd enforce ownership metadata on every schema and expire topics with
   no consumers, which is as much a governance problem as a technical
   one.
3. **"A partner outside your organization consumes these events. Does
   your design change?"** — yes: their migration window is measured in
   quarters, they cannot be in your CI, and their tolerant-reader
   behaviour cannot be assumed. I'd give external consumers their own
   versioned surface with a longer support commitment rather than
   exposing the internal topic directly.
4. **"Who owns the compatibility policy, and who grants exceptions?"** —
   the platform team owns the default, a data governance forum owns
   exceptions, and every exception has an expiry. Standing exceptions
   are how a policy becomes decorative; the governance shape itself is
   `design-01`'s `D1-Q16` and `design-06`'s.
5. **"Someone shipped a semantic change last month and reports have been
   wrong since. How do you catch the next one?"** — distribution
   assertions on the fields that matter, alerting the producer when a
   metric's shape moves beyond a threshold, plus a required review for
   changes to fields marked as financially material. That's the quality
   layer in `D3-Q17`, and it's the only real defence.

**Cross-references**

- `04-architectures/pattern-data-analytics-pipeline.md` — the
  schema-evolution section covers the Bronze-tolerance and BigQuery
  mechanics; this question is the producer-side contract around it.
- `D3-Q06` for CDC schema drift, which is the same problem with a
  database as the producer.
- `D3-Q17` for the contract and quality layer that catches what a
  registry structurally cannot.

---

### D3-Q08 — "Our exec team has decided every dashboard must be real-time. Tell me how you'd handle that conversation, and then what you'd actually build."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 1.2, 1.3, 4.3 |
| **Axis** | data |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D3-Q04` |

**What the interviewer is actually testing**

Whether you can turn a slogan into numbers without being obstructive.
Two failure modes are being watched for: the candidate who says yes and
builds a streaming platform nobody needed, and the candidate who
lectures the executive about how nothing is really real-time. The
expected behaviour is to decompose the word, find the one or two places
where seconds genuinely change an outcome, and build those properly
while giving everyone else something that feels fast.

**Clarifying questions to ask before drawing anything**

- **What decision gets made on this number, and how often?** If a human
  looks at it each morning, sub-second freshness changes nothing. If an
  automated system reprices or reroutes on it, seconds are the whole
  requirement.
- **What does 'real-time' mean to the person who said it?** Usually one
  of three complaints: the number is hours stale, the dashboard takes
  thirty seconds to load, or the number was wrong last week and now
  nobody trusts it. Only the first is a freshness problem.
- **Who is watching at 3am?** If the answer is nobody, the urgent case
  wants an alert, not a dashboard, and that is a much cheaper and more
  effective build.
- **What's the cost of being wrong versus being slow?** Fast provisional
  numbers are cheap; fast *and* complete is what costs, because
  completeness waits on arrival (`D3-Q04`).
- **Which specific dashboards are we talking about?** "Every dashboard"
  is never the real scope. Naming five turns an unbounded programme into
  a tractable one, and usually two of the five are already fast enough.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Leadership wants "real-time everywhere" | Stated | — | The deliverable includes a conversation, not only an architecture |
| Most consumers act on a daily or hourly cadence | Assumed | "I'd expect most of these to be reviewed in a morning meeting; correct me per dashboard" | Justifies a tiered design rather than a uniform one |
| A small number of use cases act within seconds | Assumed | "There's usually one or two — fraud, dispatch, capacity — that genuinely need it" | Those get a real streaming path, built properly |
| Streaming infrastructure is already partly present | Assumed | "Ingest is likely already stream-shaped even if serving isn't" | Means the cost is in serving and operations, not ingestion |
| Perceived speed matters as much as actual freshness | Assumed | "Query latency and a visible 'as of' time do most of the perception work" | Cheap wins available before any streaming build |
| Nobody has costed always-on streaming | Assumed | "Streaming never scales to zero and adds a permanent on-call surface" | Makes the tradeoff explicit rather than discovered later |

**The answer, out loud**

I'd start by saying I'm not going to argue with the requirement, I'm
going to split it into four numbers, because "real-time" is one word
covering four independent quantities and they have very different price
tags.

The first is freshness — how old the data is when you see it. The second
is query latency — how long the dashboard takes to answer once you ask.
The third is decision cadence — how often anyone actually acts on the
number. The fourth is the correction window — how long the number keeps
changing after you first see it. In most organizations the complaint
that produced this mandate is about the second or the fourth, and both
are much cheaper to fix than the first. A dashboard that takes forty
seconds to load feels stale regardless of how fresh the data is, and a
number that quietly changes after people have quoted it destroys trust
in a way that freshness never repairs.

So my first move is measurement, not architecture. For the named
dashboards, I'd put the actual numbers on the board: current freshness,
current query latency, and the cadence at which someone acts. Then I'd
ask, per dashboard, what would be done differently if the number were
sixty seconds old instead of six hours old. That question is where the
mandate resolves itself — for most dashboards the honest answer is
nothing, and the person who said "real-time" is usually satisfied by a
number that is minutes old and visibly labelled with when it was
computed.

Then I'd propose three tiers and put each named dashboard in one. Tier
three, which is most of them, is batch on a cadence measured in hours,
with query latency fixed by proper partitioning, clustering, and
pre-aggregated tables so the dashboard is instant even if the data is
hours old. Tier two is micro-batch — the same pipeline running every few
minutes into the same warehouse tables. This tier is the sweet spot and
it's under-used: it delivers a number that's minutes old with none of
the operational surface of a continuously running job, because a failed
run is retried rather than a job's accumulated state being lost.

Tier one is genuine streaming, and I'd hold the line that it must be
earned by a named decision with a stated reaction time. Where it's
earned, I'd build it properly — event-time windowing, watermarks, a
low-latency serving store for the fresh view, and the correction
semantics from `D3-Q04` — and I'd staff it, because a streaming pipeline
is a permanently running system with watermark lag as an on-call
concern, not a job that finishes.

For the genuinely urgent cases I'd also make a counter-offer that
usually lands better than the dashboard: push instead of pull. If
something needs a reaction within seconds at 3am, nobody is watching a
screen — the right build is an alert with the context embedded, fired by
the streaming path directly. That is cheaper than a real-time dashboard
and considerably more likely to produce the reaction the executive
actually wants.

The last thing I'd put on the board is what streaming costs, in terms
that aren't money. It runs continuously so it never scales to zero; its
failures are silent and partial rather than loud and total; deploying a
new version means migrating accumulated state; and every number becomes
provisional, which means downstream consumers must handle restatement.
I'd present that as the price of tier one and let the business decide
which dashboards are worth it. In my experience it's one or two, and
naming them makes everyone happier than a blanket mandate that gets
quietly abandoned in month four.

**Architecture**

```
  "EVERY DASHBOARD MUST BE REAL-TIME"
        │
        ▼
  TRIAGE — per named dashboard, measure three numbers and
  ask one question: what would be done differently?           ◄── (1)
        │  freshness | query latency | decision cadence
        │
        ├──────────────┬───────────────────┬─────────────────┐
        ▼              ▼                   ▼                 ▼
  ┌───────────┐  ┌────────────┐   ┌─────────────────┐  ┌───────────┐
  │ TIER 3    │  │ TIER 2     │   │ TIER 1          │  │ PUSH      │
  │ batch,    │  │ micro-batch│   │ true streaming  │  │ alert     │
  │ hours     │  │ minutes    │   │ seconds         │  │ instead   │
  │           │  │            │   │  EARNED by a    │  │ of a      │
  │ fix       │  │ same code  │   │  named decision │  │ dashboard │
  │ LATENCY   │  │ as batch,  │   │  with a stated  │  │ nobody    │
  │ not       │  │ run often  │   │  reaction time  │  │ watches   │
  │ freshness │  │            │   │                 │  │ at 3am    │
  │  ◄── (2)  │  │  ◄── (3)   │   │   ◄── (4)       │  │  ◄── (5)  │
  └─────┬─────┘  └─────┬──────┘   └────────┬────────┘  └─────┬─────┘
        └──────────────┴───────────┬───────┴─────────────────┘
                                   ▼
        every tile shows VALUE + "as of" timestamp, so
        provisional never masquerades as final                ◄── (6)

  Cross-cutting: tier 1 is a permanently running system — it never
  scales to zero, its failures are silent and partial, a new version
  means migrating accumulated state, and every number it produces is
  provisional until corrected (7); most complaints that trigger this
  mandate are query latency or a trust incident, neither of which
  freshness fixes (8).
```

**Every arrow explained:**

1. **Triage before architecture** — three measured numbers and one
   question per dashboard. Without this, "real-time" stays unbounded and
   the programme has no definition of done.
2. **Tier 3 fixes latency, not freshness** — partitioning, clustering
   and pre-aggregation make an hours-old number feel instant. This is
   where most of the perceived problem actually lives.
3. **Tier 2 micro-batch** — the same transformation code on a short
   schedule. Use it as the default upgrade; don't jump to streaming
   before trying it, because a failed run retries cleanly while a failed
   streaming job loses accumulated state.
4. **Tier 1 earned by a decision** — genuine streaming with event-time
   semantics, a low-latency serving store, and staffing. Use it where
   seconds change an outcome; don't use it because a dashboard sponsor
   asked for it in a meeting.
5. **Push over pull for the urgent case** — an alert with context beats
   a real-time dashboard nobody is looking at, and costs less to build.
6. **Visible "as of" timestamps everywhere** — the cheapest trust
   mechanism available, and it stops a provisional number from being
   quoted as final.
7. **The real price of tier 1** — continuous cost, silent partial
   failure modes, state migration on deploy, and restatement handling
   downstream. Say it before the build, not during the first incident.
8. **Diagnose the actual complaint** — slow dashboards and a
   trust-destroying wrong number both get described as "not real-time,"
   and neither is fixed by streaming.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Response to the mandate | Tier the dashboards, build streaming where earned | Build a streaming platform for everything | Spends the complexity budget where an outcome changes | When the organization genuinely operates on second-level decisions across the board — some trading and logistics firms do |
| Default upgrade path | Micro-batch on a short schedule | Continuous streaming | Same code, retryable failures, no state migration on deploy | When latency truly must be sub-minute — micro-batch cannot get there and the jump is justified |
| Fixing perceived slowness | Query-latency work first (partitioning, pre-aggregation) | Fresher data first | Cheaper, faster to deliver, and addresses the more common complaint | When the data is genuinely hours stale and the decision cadence is minutes — then freshness is the real gap |
| Urgent notification | Push alert with embedded context | Real-time dashboard | Reaches the person who isn't watching a screen | When a human operator is continuously monitoring by job design — then the live display is the right surface |
| Provisional numbers | Label with "as of" and a completeness indicator | Show a bare number | Preserves trust when the value later moves | When the number is final by construction — then the label is noise |

**What a weak answer sounds like**

- "Sure, we'll stream everything." — it takes the requirement literally,
  multiplies operational load across every pipeline, and the mandate
  quietly dies when the first bill and the first incident arrive.
- "Real-time isn't really possible, so we'll explain the constraints." —
  technically defensible, politically fatal, and it doesn't answer the
  underlying complaint.
- "We'll use streaming inserts into the warehouse for every table." — an
  expensive way to make dashboards slightly fresher while leaving the
  actual complaint, which is usually query latency, untouched.
- "We'll refresh dashboards every thirty seconds." — refresh rate is not
  freshness; you re-run the same query against the same stale table more
  often.

**Common wrong turns**

- **Accepting "every dashboard" as the scope.** It's never the real
  scope. Recover by asking which five, then measuring them.
- **Skipping the query-latency check.** Teams build streaming pipelines
  to fix dashboards that were slow, not stale. Recover by timing the
  dashboard before designing anything.
- **Not pricing the on-call surface.** Streaming's cost is an
  always-running system with subtle failure modes. Recover by naming
  watermark lag as a new on-call responsibility, out loud.
- **Treating this as purely a technical negotiation.** The executive has
  a real underlying concern, usually trust. Recover by asking what
  happened recently that prompted the mandate.

**Follow-up probes the interviewer asks next**

1. **"The executive doesn't accept the tiering. Now what?"** — I'd pick
   the dashboard they care most about, build the tier-one version of
   just that one, and show the cost and the operational profile against
   a tier-two version of the same thing. The argument is settled by one
   concrete comparison far more reliably than by a framework.
2. **"You build one streaming path. A year later there are thirty. What
   broke?"** — the tiering became advisory. At thirty streaming
   pipelines the failure is operational: watermark-lag alerts nobody
   triages, state migrations at every deploy, and a platform team whose
   entire capacity is absorbed. I'd make tier one require an explicit,
   renewable justification and a named on-call owner rather than a
   one-time approval.
3. **"How do you know if you got the tiering wrong?"** — instrument
   usage. A tier-three dashboard opened forty times a day by operations
   staff is telling me its cadence is wrong; a tier-one dashboard nobody
   has opened in a month is telling me the same thing in the other
   direction.
4. **"Who owns the decision about which tier a dashboard gets?"** — the
   business owner of the decision it supports, with the platform team
   holding the cost and operational reality. If engineering owns it
   alone, the answer becomes "whatever's cheapest"; if the business owns
   it alone, everything becomes tier one.
5. **"What if the requirement is real and you were wrong to push
   back?"** — then the triage tells me that quickly, because a decision
   with a stated reaction time in seconds passes the test immediately.
   The tiering isn't a way to say no; it's a way to say yes to the right
   two.

**Cross-references**

- `D3-Q04` — the correction semantics any tier-one build inherits.
- `D3-Q15` — the hot/cold serving split behind a genuine tier-one
  dashboard.
- `04-architectures/pattern-data-analytics-pipeline.md` — its
  "over-engineering trap" note is the compressed form of this argument;
  this question is the conversation you have before the diagram.

---

### D3-Q09 — "We're a multi-tenant platform. One tenant seeing another tenant's rows would end the company. Design the data layer."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 3.2, 1.2, 2.2 |
| **Axis** | data |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D3-Q05` |

**What the interviewer is actually testing**

Whether you'll reach for dedicated infrastructure as a substitute for
thinking. Pooled tenancy with row scoping is the default and it is
defensible — but only if you can name every layer that enforces it,
prove the enforcement is not developer discipline, and identify the leak
paths that aren't queries at all. The panel is listening for the export
path and the support tool, because that's where real cross-tenant
incidents come from.

**Clarifying questions to ask before drawing anything**

- **Where does tenant identity come from today?** If any code path reads
  a tenant identifier from a request body or a URL parameter, that's the
  vulnerability, and no amount of database configuration compensates for
  it.
- **Do any tenants have contractual isolation requirements?** That
  decides whether some of them are promoted out of the pooled tier, and
  the tiering model already exists — I'd use it rather than invent a
  parallel one.
- **Who can query production data outside the application?** Support
  staff, analysts, on-call engineers. Every one of those is a path that
  bypasses the application's enforcement, and each needs its own answer.
- **Is data ever exported — reports, extracts, webhooks?** Exports are
  the most common cross-tenant leak I've seen, because the scoping was
  applied to the query and forgotten in the file name.
- **Is there a whale tenant?** One tenant that is ten percent of the
  data changes the physical design — key distribution, query cost, and
  noisy-neighbour behaviour — even when the isolation model doesn't
  change.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Cross-tenant data exposure is existential | Stated | — | Enforcement must be layered, not single-point |
| Pooled tenancy is the default tier | Assumed | "T1 Pooled is where most tenants live; promotion to a higher tier is deliberate and one-directional" | Anchors the design in the existing tenancy taxonomy |
| A minority of tenants need stronger isolation | Assumed | "There's usually a contractual handful; they become T2 or T3" | Introduces per-tenant datastore and key without forking the platform |
| Tenant identity is available as a token claim | Assumed | "If tenant comes from the request payload anywhere, that's the first fix" | Makes server-side derivation the foundation |
| Analysts and support need production access | Assumed | "Someone always does; unscoped access is the usual quiet exception" | Forces an answer for the non-application paths |
| Noisy neighbours are a separate concern | Assumed | "Performance isolation and confidentiality isolation are different problems with different fixes" | Prevents quota problems being solved with dedicated infrastructure |

**The answer, out loud**

I'd start by naming the tier, because the taxonomy already exists and
the worst outcome here is inventing a second one. T1 Pooled is the
default: shared projects, shared stores, tenant identity carried as a
scoping column. That's where the overwhelming majority of tenants live,
and I'd defend it rather than apologise for it — it is the only tier
whose marginal cost per tenant is near zero, and the isolation guarantee
is a software guarantee, which I'd say plainly rather than dress up. T2
Partitioned keeps the shared runtime and gives a tenant their own
datastore and their own key. T3 Dedicated is a per-tenant project. T4
Sovereign adds region pinning. Promotion is one-directional and it's a
product decision; the structural design of those tiers is
`design-01`'s `D1-Q03`, and I'd point at it rather than redraw it.

So the interesting work is making T1 actually safe, and that's five
layers, not one.

Layer one is where the tenant identifier comes from. It is derived at
the edge from the authenticated principal's claim, injected into a
request context, and never read from the request body, a query
parameter, or a header the caller controls. If a single endpoint accepts
a tenant identifier as input, every other layer is decoration. I'd make
that a lint rule and a test, not a code-review convention.

Layer two is that no application code writes a tenant predicate by hand.
All data access goes through a shared library where the tenant scope is
applied from the request context — the query builder cannot produce an
unscoped query for a tenant-scoped table. Developer discipline is not an
enforcement mechanism at forty engineers, and hand-written predicates
are how the one forgotten join happens.

Layer three is the datastore's own enforcement, as a backstop for when
layers one and two are bypassed. In BigQuery that's row-level access
policies on tenant-scoped tables plus authorized views, so a query run
by a human in a console with no predicate returns nothing rather than
everything. In Bigtable it's the tenant identifier as the leading
component of the row key, which gives isolation and scan scoping in the
same decision — with the caveat that a whale tenant then owns a
contiguous key range, which is a hotspot problem I'd handle per
`D3-Q16`. In a relational store it's row-level security with the tenant
set from the session context.

Layer four is physical: tenant as a clustering key so scoped queries
prune, and per-tenant reservations or quotas where a tenant's workload
could otherwise starve others. I'd separate that from confidentiality
explicitly, because a noisy-neighbour complaint gets solved with quotas
and capacity, not with dedicated projects, and conflating the two is how
a platform ends up with fifty single-tenant deployments it can't
maintain.

Layer five is the paths that aren't application queries, and this is
where I'd spend real time because it's where the incidents actually
come from. Exports and reports carry tenant scope into the artifact
itself, with the tenant recorded in the file metadata and the delivery
destination bound to the tenant. Support tooling never runs unscoped
queries — a support engineer impersonates a tenant context through a
break-glass flow that is time-boxed and audited, which is `design-04`'s
control to design and mine to require. Analytics on cross-tenant data
happens on aggregates that have passed a minimum-cohort threshold, so a
"benchmark against similar customers" feature can't become a
single-customer disclosure.

The last thing I'd add is proof. I'd have a canary tenant with
recognisable synthetic data, and a continuous test that runs as every
other tenant and asserts the canary's rows never appear. Plus a CI test
that asserts an unscoped query against a tenant table returns zero rows
rather than all rows. Those two tests are what let me say the isolation
works today rather than that it worked when it was designed.

**Architecture**

```
  request ─► edge auth: tenant_id derived from the TOKEN CLAIM,
             never from body, query string or caller header    ◄── (1)
                  │  injected into request context
                  ▼
  ┌──────────────────────────────────────────────────────────┐
  │ shared data-access library — the query builder CANNOT    │  ◄── (2)
  │ emit an unscoped query for a tenant-scoped table         │
  └───────────┬──────────────────┬───────────────┬───────────┘
              ▼                  ▼               ▼
      BigQuery            Bigtable         relational store
      row access policy   tenant_id as     row-level security
      + authorized views  leading row-key  from session ctx
      ◄── (3)             component ◄──(4) ◄── (5)
              │                  │               │
              └──────────────────┴───────────────┘
                          │  tenant_id also a CLUSTERING key:
                          │  pruning + cost, not isolation    ◄── (6)
                          ▼
  NON-QUERY PATHS — where real incidents come from:           ◄── (7)
    exports   ─► tenant scope bound INTO the artifact + destination
    support   ─► impersonate a tenant context, time-boxed, audited
    analytics ─► cross-tenant only above a minimum-cohort threshold

  TIERS (one-directional promotion, taxonomy owned by design-01):  ◄── (8)
    T1 Pooled (default) ─► T2 Partitioned (own datastore + CMEK)
    ─► T3 Dedicated (own project) ─► T4 Sovereign (region-pinned)

  Cross-cutting: a canary tenant with recognisable synthetic rows,
  plus a continuous test asserting those rows never surface for any
  other tenant, is what proves isolation works TODAY rather than on
  the day it was designed (9); noisy neighbours are a quota and
  capacity problem, never a reason to promote a tenant a tier (10).
```

**Every arrow explained:**

1. **Tenant from the token claim only** — one endpoint that accepts a
   tenant identifier as input invalidates every layer beneath it. Make it
   a lint rule and a test, not a review convention.
2. **Scoping in a shared library** — hand-written predicates are how the
   forgotten join happens. The library is the enforcement; developer
   care is not a control.
3. **Row-level policies plus authorized views in BigQuery** — the
   backstop for console access and ad hoc queries. Use them so an
   unscoped query returns nothing; don't rely on them alone, because
   they don't cover exports or a service account with broad rights.
4. **Tenant as the leading Bigtable row-key component** — isolation and
   scan scoping in one decision. Watch for a whale tenant owning a
   contiguous range; that's a hotspot problem (`D3-Q16`), not an
   isolation one.
5. **Row-level security in relational stores** — session context sets
   the tenant; the same backstop logic as BigQuery.
6. **Clustering on tenant** — a cost and performance decision, not a
   security one. Saying which is which matters, because a clustering key
   enforces nothing.
7. **Non-query paths** — exports, support tooling and cross-tenant
   analytics. This is where cross-tenant incidents actually originate,
   and each needs its own explicit control.
8. **The existing tenancy tiers** — promotion is deliberate and
   one-directional; the structural design belongs to `design-01`'s
   `D1-Q03` and is referenced, not redrawn.
9. **Canary tenant plus continuous assertion** — converts "we designed
   it correctly" into "it is correct right now."
10. **Noisy neighbour is a capacity problem** — solved with quotas and
    reservations. Promoting a tenant a tier to fix performance produces
    a single-tenant deployment you must maintain forever.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Default tier | T1 Pooled with row scoping | Dedicated infrastructure per tenant from the start | Near-zero marginal cost per tenant; one platform to patch and operate | When contracts genuinely require separate infrastructure — then promote those specific tenants to T3, not the whole platform |
| Scope enforcement | Shared data-access library plus datastore policies | Rely on the datastore's row-level security alone | Covers the application path and the ad hoc path with different mechanisms | When there is no application layer at all (warehouse-only product) — then datastore policies are the whole control |
| Tenant in the key | Leading component of the Bigtable row key | Tenant as a column filtered at read time | Isolation and scan scoping come free; unscoped reads are structurally awkward | When one tenant dominates volume and the contiguous range hotspots — then salt within the tenant prefix (`D3-Q16`) |
| Support access | Time-boxed impersonation of a tenant context | A support role with unscoped read access | Every support view is attributable to a tenant and a reason | When regulatory obligations require an unscoped audit function — then it exists, is named, and is monitored as an exception |
| Cross-tenant analytics | Aggregates above a minimum-cohort threshold | Direct cross-tenant queries for benchmarking | Prevents a benchmark feature becoming a single-customer disclosure | When tenants have explicitly consented to named comparison — then it's a product feature with a contract behind it |

**Making it concrete**

```bash
# The backstop layer: a query with no tenant predicate returns nothing
# rather than everything. This is what protects the console path, which
# the application's data-access library never sees.
bq query --use_legacy_sql=false '
CREATE OR REPLACE ROW ACCESS POLICY tenant_scope
ON `PROJECT_ID.silver.orders`
GRANT TO ("group:grp-platform-prod-operator@example.com")
FILTER USING (tenant_id = SESSION_USER_TENANT());'

# And the test that keeps it honest, run continuously, not once:
#   assert: canary tenant rows are invisible to every other tenant
#   assert: an unscoped SELECT returns zero rows, not all rows
```

**What a weak answer sounds like**

- "Each tenant gets their own project." — solves the question by
  abolishing the platform; five hundred tenants means five hundred
  deployments to patch, and the tiering model exists precisely so this
  is the exception.
- "We filter by tenant ID in the application." — that's the mechanism
  that fails; the question is what enforces it when a developer forgets
  or a human opens a console.
- "We'd encrypt each tenant's data with their own key." — good at T2 and
  irrelevant to row scoping in a pooled store, where the application
  holds the keys to everything it can decrypt anyway.
- "Row-level security handles it." — it handles the query path. It does
  not handle the export, the support tool, or the service account with
  broad rights.

**Common wrong turns**

- **Trusting a tenant identifier from the request.** It looks like
  scoping and is actually an authorization bypass. Recover by deriving
  from the token claim in the first sentence.
- **Solving noisy neighbours with isolation.** It's a quota problem;
  promoting a tier is an expensive way to add capacity. Recover by
  separating the two concerns explicitly.
- **Forgetting the export path.** Scoping applied to the query and
  forgotten in the file is the classic incident. Recover by binding
  tenant scope to the artifact and its destination.
- **Treating clustering as security.** Recover by saying out loud which
  mechanisms enforce and which merely optimise.

**Follow-up probes the interviewer asks next**

1. **"A tenant asks for proof that no one else can see their data. What
   do you send them?"** — the enforcement layers, the audit log of every
   access to their data including support impersonations, and the
   continuous canary test results. Architecture diagrams don't satisfy
   this question; evidence does.
2. **"Five hundred tenants today, fifty thousand tomorrow. What
   breaks?"** — not row scoping. What breaks is per-tenant artifacts:
   policies, keys, reservations, and datasets if anyone promoted tenants
   casually. That's the argument for keeping T1 the default and making
   promotion require a contract, since each promoted tenant is permanent
   operational surface.
3. **"One tenant is now forty percent of your data. What changes?"** —
   physical design, not the isolation model: key distribution to avoid a
   hot contiguous range, possibly a dedicated reservation for query
   capacity, and a conversation about whether they should be T2 for
   operational reasons. The confidentiality model is unchanged.
4. **"An engineer needs to debug a production data issue for one
   tenant. Walk me through it."** — break-glass impersonation of that
   tenant's context, time-boxed, with the reason recorded and the tenant
   notified if their contract requires it. No path exists where the
   engineer gets unscoped read access, because that path is the one that
   ends up in an incident report.
5. **"Who signs off on promoting a tenant from T1 to T3?"** — a product
   decision with revenue attached, not an engineering one, because every
   promotion is permanent cost. The approval process belongs to
   `design-01`'s governance model; my job is to make sure the technical
   path exists and is one-directional.

**Cross-references**

- `design-01` `D1-Q03` and `D1-Q15` — the tenancy taxonomy, the
  promotion criteria and the offboarding lifecycle; this question uses
  those tiers and does not redefine them.
- `design-04` — the security control catalogue behind break-glass
  access and audit; named here, designed there.
- `D3-Q16` for whale-tenant key distribution, `D3-Q10` for tenant-scoped
  erasure.

---

### D3-Q10 — "A customer invokes their right to erasure. Design the architecture that makes that a routine operation rather than a project."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 3.2, 2.2 |
| **Axis** | data |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D3-Q09` |

**What the interviewer is actually testing**

Whether you treat erasure as a distributed, auditable workflow rather
than a delete statement — and whether you know the places data survives
a delete: time travel, backups, archives, logs, caches, downstream
extracts and derived aggregates. The strongest signal is a candidate who
designs so that most stores never hold the data in the first place.

**Clarifying questions to ask before drawing anything**

- **Is the obligation erasure, or restriction of processing?** They are
  different outcomes with different architectures, and the second is
  often what's actually required — anonymisation and suppression rather
  than physical deletion.
- **What's the completion deadline, and does it include backups?**
  Regulatory windows are usually generous enough to let backups age out
  naturally, but that has to be a stated, documented position rather
  than an oversight.
- **Can a subject be identified across systems?** If there's no
  consistent subject identifier, the first deliverable is an identity
  map, not a deletion pipeline.
- **Do derived aggregates still identify the subject?** A count over ten
  thousand rows doesn't; a per-customer summary table does. That line
  determines how far the erasure has to propagate.
- **Which data are we legally required to retain despite the request?**
  Financial records, fraud evidence, contractual obligations. Erasure
  and retention obligations collide, and the architecture must express
  both rather than pick one.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Subject erasure must complete within a defined window | Stated | — | Makes this a tracked workflow with an SLA, not a ticket |
| Some data must be retained for other legal reasons | Assumed | "There is always a retention obligation that survives an erasure request" | Forces a suppression path alongside the deletion path |
| Subjects are identifiable across stores | Assumed | "If not, an identity map is the first deliverable" | Erasure fan-out needs a resolvable key per store |
| Backups and archives exist | Assumed | "We can't selectively delete inside an immutable archive" | Drives crypto-shredding or documented age-out |
| Derived aggregates are mostly non-identifying | Assumed | "Anything per-customer is in scope; anything above a cohort threshold isn't" | Bounds how far propagation must reach |
| Erasure must be provable | Assumed | "Somebody will be asked to demonstrate completion" | Requires a per-store attestation, not a best-effort sweep |

**The answer, out loud**

I'd start with the principle that makes this tractable: the cheapest
erasure is data you never copied. Before designing a deletion fan-out
I'd cut the surface — column allow-lists at every ingestion boundary so
personal data doesn't enter analytics when only its existence matters
(`D3-Q06`), tokenisation where downstream needs joinability rather than
the value itself, and a hard rule that personal data never goes into
logs. Most erasure programmes are expensive because the data is
everywhere, and the reason it's everywhere is that nobody said no at
ingestion.

Then the architecture proper, which is three things: a map, a fan-out,
and an attestation.

The map is a data inventory that answers "for a given subject, which
stores hold their data and under what key." Not a documentation
exercise — a machine-readable registry with an entry per store, naming
the subject key, the deletion mechanism, the expected completion time,
and the owner. Every new store that holds personal data registers here
as a condition of going live, and a store that isn't registered can't
pass the data-class check. Without this the erasure programme degrades
into asking teams by email whether they have any of Mrs Smith's data.

The fan-out is an orchestrated workflow, keyed by the erasure request
ID, that dispatches a scoped deletion task per registered store and
tracks each one to completion. It's a saga in every meaningful sense —
long-running, partially failing, retried — so it inherits the patterns
from `D3-Q02` and `D3-Q03`: idempotent handlers, so a replayed erasure
is harmless; per-store retries; a dead-letter path for the store whose
handler fails; and no completion until every store reports.

Then the mechanisms per store type, which is where the honest detail
lives. In BigQuery, deleting rows from a partitioned table is
straightforward, but time travel means the data remains queryable for
the configured window — so either the window is short enough to fit
inside the erasure deadline and we document that, or the table's
retention is explicitly reduced. In Cloud Storage, lifecycle rules do
retention but not targeted erasure, so an object holding a single
subject's data must be deletable on its own or must have been written
encrypted under a key we can destroy. In Bigtable, the subject must be
addressable by row key, which is a design decision made long before the
request arrives. Caches and search indexes need explicit invalidation,
because a deleted record that's still in an index is still disclosed.
And backups are where I'd be most direct: you cannot selectively delete
inside an immutable backup, so the position is either documented
age-out inside the regulatory window, or crypto-shredding — the subject
or tenant's data encrypted under a key whose destruction renders it
unrecoverable. I'd choose crypto-shredding at tenant granularity where
the tenancy tier already gives per-tenant keys (`D3-Q09`), and I'd be
honest that per-subject keys inside a pooled store are usually
impractical.

The attestation is the deliverable. Each store's handler returns what it
deleted, how much, and when, and the workflow produces a signed record
that the request completed — retained itself, because the proof
outlives the data. That record is also the answer when a regulator or a
customer asks, and building it later is far harder than emitting it at
the time.

Finally, retention, which is the same architecture pointed the other
way. Every dataset carries a retention period as metadata, expressed as
partition expiration in BigQuery and lifecycle rules in Cloud Storage,
set from a policy rather than from a team's preference. The failure mode
I'd call out is the dataset with no stated retention, which defaults to
forever and silently expands the erasure surface every day it exists.

**Architecture**

```
  PREVENTION FIRST — the cheapest erasure is data never copied:
  column allow-lists at ingestion, tokenisation where only
  joinability is needed, personal data never in logs          ◄── (1)
        │
        ▼
  ┌──────────────────────────────────────────────────────────┐
  │ DATA INVENTORY (machine-readable, registration is a       │
  │ condition of go-live): per store — subject key, deletion  │  ◄── (2)
  │ mechanism, expected completion, owner, retention          │
  └───────────────────────┬──────────────────────────────────┘
                          ▼
  erasure request ─► orchestrated FAN-OUT keyed by request_id  ◄── (3)
                          │  idempotent handlers, per-store
                          │  retries, DLQ, no partial "done"
        ┌─────────────┬───┴─────────┬──────────────┬─────────────┐
        ▼             ▼             ▼              ▼             ▼
   BigQuery       Cloud Storage  Bigtable      caches +      backups
   delete rows;   object-level   addressable   search        immutable:
   TIME TRAVEL    delete, or     by row key    indexes:      age-out
   keeps them     crypto-shred   (decided at   explicit      documented,
   queryable for  under a key    design time,  invalidation  or CRYPTO-
   the configured you destroy    not at        ◄── (7)       SHRED
   window ◄──(4)  ◄── (5)        request time                ◄── (8)
                                 ◄── (6)
        └─────────────┴─────────────┴──────────────┴─────────────┘
                          ▼
  ATTESTATION: per-store result + signed completion record,
  retained AFTER the data is gone, because the proof outlives
  the subject's data                                          ◄── (9)

  Cross-cutting: erasure and retention obligations collide — some
  records must survive the request, so a suppression path (flagged,
  excluded from processing, not deleted) runs alongside the deletion
  path and both are recorded (10); a dataset with no stated retention
  defaults to forever and grows the erasure surface every day (11).
```

**Every arrow explained:**

1. **Prevention at ingestion** — allow-lists, tokenisation, and no
   personal data in logs. Every store that never receives the data is a
   store with no erasure handler to build, test and prove.
2. **Machine-readable inventory** — registration gated at go-live. A
   documentation-only inventory decays within a quarter and turns each
   request into an email survey.
3. **Orchestrated fan-out** — a saga with idempotent handlers, retries
   and a dead-letter path (`D3-Q02`, `D3-Q03`). Completion means every
   store reported, not that the job finished.
4. **BigQuery time travel** — deleted rows stay queryable for the
   configured window. Either it fits inside the deadline and is
   documented, or the window is explicitly reduced for that table.
5. **Cloud Storage granularity** — lifecycle rules handle retention, not
   targeted erasure. Objects must be individually deletable or
   encrypted under a destroyable key.
6. **Bigtable addressability** — whether a subject's data can be deleted
   is decided by the row key long before the request arrives. This is
   why `D3-Q16` is an erasure question as well as a performance one.
7. **Caches and indexes** — a record deleted from storage but present in
   a search index is still disclosed. Invalidation is part of the
   handler, not an afterthought.
8. **Backups** — you cannot selectively delete inside an immutable
   backup. Use documented age-out when the window allows; use
   crypto-shredding at tenant granularity where per-tenant keys already
   exist. Don't claim per-subject shredding in a pooled store.
9. **Attestation retained after deletion** — the proof outlives the
   data, and it is far cheaper to emit at the time than to reconstruct.
10. **Suppression path alongside deletion** — records retained for other
    legal obligations are flagged and excluded from processing rather
    than deleted, and that decision is recorded per record.
11. **Retention as mandatory metadata** — an unstated retention is
    "forever," which quietly expands the surface every day.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Primary strategy | Minimise what's stored, then fan out deletion | Comprehensive deletion tooling over everything | Each store avoided is a handler never built, tested or proved | When the data is genuinely needed everywhere it sits — then tooling breadth is the only path |
| Backups | Documented age-out within the regulatory window | Crypto-shredding per subject | Simple, provable, and no key-management burden per subject | When the window is shorter than backup retention — then crypto-shredding at tenant granularity is required |
| Analytics copies | Tokenise at the boundary | Replicate raw values and delete later | Erasure never has to reach the warehouse for those fields | When analysis genuinely requires the raw value (fraud investigation) — then it lands, and it carries an erasure handler |
| Derived aggregates | Exempt above a minimum-cohort threshold | Recompute every aggregate on erasure | Bounded, defensible, and avoids permanent recomputation cost | When an aggregate is per-customer by construction — then it is in scope and must be recomputed or deleted |
| Completion signal | Per-store attestation aggregated into a signed record | A job that finishes without per-store evidence | Provable to a regulator; failures are visible instead of assumed | When there is exactly one store — then the distinction is ceremony |

**What a weak answer sounds like**

- "We'd run a delete statement across the databases." — ignores time
  travel, backups, archives, caches, indexes and downstream extracts,
  which is most of where the data actually is.
- "Backups age out eventually, so it's fine." — probably true and
  unacceptable as an unexamined assumption; it needs the window
  compared against the deadline and written down.
- "We'd anonymise the data instead." — sometimes exactly right, and only
  if the result is genuinely non-identifying; a per-customer row with
  the name removed usually isn't.
- "The data team will handle requests as they come in." — that's a
  project per request, and it fails the first time volume rises or the
  person who knew where everything lives leaves.

**Common wrong turns**

- **Designing the deletion pipeline before the inventory.** You can't
  fan out to stores you can't enumerate. Recover by drawing the registry
  first.
- **Forgetting downstream extracts.** A file mailed to a partner last
  month is outside your fan-out entirely. Recover by making export
  destinations registered recipients with their own obligations.
- **Assuming erasure beats retention.** Some records must survive.
  Recover by adding the suppression path and recording both decisions.
- **Treating it as purely a compliance problem.** The engineering cost
  is set by how many stores hold the data, which is a design decision.
  Recover by pushing the fix upstream to ingestion.

**Follow-up probes the interviewer asks next**

1. **"How long does one erasure take end to end, and what's the
   bottleneck?"** — the slowest registered store, which is usually
   something batch-oriented or a partner extract. I'd publish the
   per-store expected completion in the inventory so the overall SLA is
   derived from evidence rather than hoped for.
2. **"Ten requests a month today. What happens at ten thousand a
   month?"** — per-request fan-out becomes a throughput problem and
   per-row deletes in analytical stores become expensive. I'd batch
   erasures into scheduled windows per store, keep the attestation
   per-request, and design tables so deletion is partition-aligned where
   possible rather than row-by-row.
3. **"A store's handler has been silently failing for two months. How do
   you know?"** — the attestation never completes, and an alert on
   incomplete erasure requests older than the deadline fires. Erasure
   completion rate is a compliance indicator that belongs on a
   dashboard someone owns, which is `design-06`'s operating model.
4. **"Who owns the inventory, and what stops it going stale?"** — the
   data governance function owns the registry, and it doesn't go stale
   because registration is enforced at go-live rather than requested
   afterwards. The organizational mechanism is `design-01`'s governance
   model; my contribution is making non-registration a hard block rather
   than a finding.
5. **"A tenant leaves entirely, not just one subject. Different
   answer?"** — easier, and materially so: tenant-scoped deletion plus
   destroying the tenant's key where the tier provides one, which is why
   `D3-Q09`'s tiering has a deletion story built into it. The full
   offboarding lifecycle is `design-01`'s `D1-Q15`.

**Cross-references**

- `design-01` `D1-Q15` — tenant offboarding and provable deletion at the
  project level; this question is the subject-level version.
- `design-04` — the compliance control catalogue and audit evidence;
  named here, owned there.
- `D3-Q06` for column allow-lists at ingestion, `D3-Q09` for tenant
  keys, `D3-Q16` for whether a subject is addressable by key at all.

---

### D3-Q11 — "Our models perform well in evaluation and badly in production. Design the feature layer that fixes it."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 1.3, 2.2, 4.3 |
| **Axis** | data |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D3-Q05` |

**What the interviewer is actually testing**

Whether you can name the two distinct causes of training/serving skew —
two implementations of the same transformation, and two different
freshness profiles for the same value — and design so that neither can
happen silently. This is a data-plumbing question wearing a machine
learning hat; the panel wants the plumbing, not opinions about models.

**Clarifying questions to ask before drawing anything**

- **Is the gap in the features, or in the labels?** Features computed
  differently at serving time is one problem; labels collected in a way
  that leaks future information is a completely different one, and both
  produce exactly this symptom.
- **How are features computed at serving time today?** If the answer is
  "the application computes them inline," there are already two
  implementations and the skew is structural rather than accidental.
- **What's the freshness requirement per feature, not per model?** Some
  features are stable for weeks, some are meaningful only within a
  session. A single refresh cadence across all of them is either wasteful
  or wrong.
- **What entity does inference key on, and is that key available at
  training time?** If the online lookup key doesn't exist in the
  historical data, the offline and online paths cannot be reconciled at
  all.
- **How long does a model stay in service?** That sets how long training
  snapshots and feature definitions must remain reproducible, which is a
  retention decision with a cost.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Evaluation and production performance diverge | Stated | — | Points at skew or leakage before it points at the model |
| Features are consumed by both training and inference | Assumed | "Otherwise there's no split to design" | Establishes the two materializations of one definition |
| Inference needs single-entity lookups at low latency | Assumed | "The latency budget itself belongs to the serving design, not here" | Justifies an online store separate from the warehouse |
| Historical labels exist with timestamps | Assumed | "Without label timestamps, point-in-time correctness is impossible to verify" | Required for as-of joins |
| New features must be usable immediately | Assumed | "A feature with no history is useless for a year unless it's backfilled" | Makes backfill a first-class capability |
| Feature definitions are shared across teams | Assumed | "Otherwise each team re-implements the same feature slightly differently" | Makes the definition a contract (`D3-Q17`) |

**The answer, out loud**

I'd start by naming the two skews separately, because they need
different fixes and teams usually only fix one.

Code skew is two implementations of the same feature — one in the
training pipeline, written in SQL, and one in the serving path, written
in application code by a different person six months later. They agree
on the name and disagree on the null handling, the time zone, or the
window boundary. The fix is structural: one definition, executed twice.
The definition lives in one repository with tests; the batch execution
materialises history into the offline store; the streaming or scheduled
execution materialises current values into the online store. Nobody
computes a feature by hand at serving time.

Data skew is the same definition producing different values because the
online store is stale. If a feature is defined as "orders in the last
thirty days" and the online store refreshes nightly, then at 6pm the
model sees a number that is up to eighteen hours behind what the
training data contained at the equivalent moment. That's not a bug in
either path — it's an unstated freshness contract. So every feature
carries a declared freshness, and the training data is constructed to
reflect the freshness the model will actually see in production, not the
freshness the warehouse could theoretically provide.

The offline side is the warehouse. Features live as a table per entity
with the entity key, the feature values, and a valid-from timestamp.
Training datasets are constructed with as-of joins: for each label at
time T, join the feature value that was valid at T — not the current
value. This is the single most important mechanic in the whole design,
and doing it wrong is the most common cause of the exact symptom in the
question. A model trained on current feature values against historical
labels is learning from information that didn't exist yet; it evaluates
beautifully and fails on day one.

The online side is a low-latency key-value store — Bigtable keyed by
entity, or a managed feature store's online serving layer. It holds
current values only, written by the same definition, with a TTL where
staleness is worse than absence. I'd be explicit that the online store
is a cache of a derived value, not a source of truth: it can be rebuilt
entirely from the offline side, and I'd make sure that rebuild is a
tested procedure rather than a theory, because it's the recovery path
for every online-store incident.

Freshness gets tiered per feature rather than per model. Some features
are batch-daily — lifetime value, tenure. Some need streaming updates
within minutes — session counts, recent activity. And some should never
be stored at all, because they're derived from the request itself: time
of day, device type, the contents of the current basket. Computing
request-time features from the request removes an entire class of skew
for free, and I'd push as many features into that category as the
definition allows.

Backfill is the capability teams forget to build, and it decides whether
the platform is usable. A new feature must be computable over history
from the raw layer (`D3-Q05`), so that a model can train on it the week
it's defined rather than a year later. That means feature definitions
must be expressible against historical raw data, which in turn means
they cannot depend on state that only exists at serving time. That's a
real constraint on how features may be defined, and it's worth stating
as a rule up front rather than discovering it per feature.

Finally, the thing that keeps it honest: a skew monitor. I'd sample the
feature vectors actually used at serving time, log them, and recompute
the same vectors offline for the same entities and timestamps. Any
systematic difference is skew, surfaced as a data-quality alert to the
team that owns the feature. Without that, skew is invisible until a
model underperforms and someone spends three weeks finding it. The
serving path's latency budget and the model's own behaviour are
`design-07`'s territory — specifically `D7-Q15` — and I'd hand off at
that boundary rather than design around it.

**Architecture**

```
  ONE FEATURE DEFINITION (repo, tested, owned)                ◄── (1)
        │  executed twice — never re-implemented by hand
        ├──────────────────────────┬──────────────────────────┐
        ▼                          ▼                          ▼
  BATCH over history       STREAMING / scheduled       REQUEST-TIME
  from the raw layer       materialisation             computed from
  (backfill capable)       of current values           the request,
        │                          │                   never stored
        ▼                          ▼                       ◄── (5)
  ┌──────────────────┐     ┌──────────────────┐
  │ OFFLINE store    │     │ ONLINE store     │
  │ BigQuery         │     │ Bigtable / feature│
  │ entity_key,      │     │ store online tier │
  │ value,           │     │ CURRENT values,   │
  │ valid_from  ◄─(2)│     │ TTL where stale   │
  │                  │     │ is worse than     │
  │                  │     │ absent      ◄─(4) │
  └────────┬─────────┘     └────────┬──────────┘
           │                        │
           ▼                        ▼
  TRAINING SET built with   inference lookup by entity key
  AS-OF JOINS: the value    (latency budget + model serving
  valid at the LABEL's      belong to design-07 / D7-Q15)
  timestamp, never the      ◄── (6)
  current value ◄── (3)
           │                        │
           └────────► SKEW MONITOR ◄┘                        ◄── (7)
        sample served vectors, recompute offline for the same
        entity+timestamp, alert the feature OWNER on divergence

  Cross-cutting: a feature's declared FRESHNESS is part of its
  definition, and training data is built to reflect the freshness
  production will actually see rather than the freshness the
  warehouse could provide (8); the online store is a rebuildable
  cache of a derived value, and that rebuild is a tested procedure,
  because it is the recovery path for every online incident (9).
```

**Every arrow explained:**

1. **One definition, two executions** — the structural fix for code
   skew. Any feature computed inline in application code is a second
   implementation that will drift, whatever the review process says.
2. **Offline store with valid-from timestamps** — history is what makes
   point-in-time joins possible. A features table holding only current
   values cannot train anything correctly.
3. **As-of joins at the label's timestamp** — the highest-value mechanic
   here. Joining current values to historical labels leaks the future
   and produces exactly the evaluation-versus-production gap described.
4. **Online store holds current values with a TTL** — use a TTL when
   stale is worse than missing (recent-activity features); don't use one
   where absence breaks inference and staleness is tolerable.
5. **Request-time features** — computed from the request, never stored,
   and structurally incapable of skew. Push as many features here as the
   definitions allow.
6. **Handoff at inference** — serving latency, model behaviour and
   rollout are `design-07`'s, specifically `D7-Q15`. This design ends at
   delivering a correct vector.
7. **Skew monitor** — sample what was actually served, recompute
   offline, alert the owner on divergence. Without it, skew is found by
   a model underperforming three months later.
8. **Freshness as part of the definition** — an undeclared freshness
   contract is the most common source of data skew.
9. **Online store as rebuildable cache** — it is derived, never
   authoritative, and the rebuild is tested rather than assumed.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Feature computation | One definition executed twice | Separate training and serving implementations | Removes code skew structurally rather than by review | When the serving path has constraints the batch engine can't express — then wrap the single implementation in both, never fork it |
| Online store | Managed feature store online tier | Build on Bigtable directly | Entity/feature metadata, freshness and serving come integrated | When feature access patterns are unusual or the fleet is small — then Bigtable directly is fewer moving parts and one less dependency |
| Training joins | Point-in-time as-of joins | Join current feature values to historical labels | Trains on what was knowable, which is what production will see | Never for supervised learning on historical labels; only acceptable when features are genuinely time-invariant |
| Freshness | Declared per feature, tiered | One refresh cadence for the whole store | Matches cost to the value's actual volatility | When every feature has similar volatility — then one cadence is simpler and the tiering is overhead |
| New features | Backfilled from the raw layer on definition | Start collecting forward from today | A model can use the feature this quarter rather than next year | When history genuinely doesn't exist (a new event type) — then forward-only is the only option and the wait is real |

**What a weak answer sounds like**

- "We'd add a feature store." — naming the component isn't the design;
  the as-of join, the freshness contract and the skew monitor are where
  the problem actually is.
- "The serving code computes features from the same logic." — "the same
  logic" written twice is two implementations; the design has to make
  the second one impossible, not discouraged.
- "We'd retrain more often." — treats a correctness bug as a staleness
  problem and buys a temporary improvement while the skew persists.
- "We'd copy the warehouse table into a cache each night." — sometimes
  exactly right, and it becomes wrong the moment a feature's definition
  implies freshness the nightly copy can't deliver.

**Common wrong turns**

- **Storing only current feature values.** It makes point-in-time
  training impossible and the mistake is discovered after the first
  model ships. Recover by putting valid-from on the offline table while
  drawing it.
- **Letting the serving path compute "just this one" feature inline.**
  It's always one, then four. Recover by naming the request-time
  category so legitimate inline computation has a sanctioned home.
- **Treating the online store as authoritative.** Then an outage is
  unrecoverable. Recover by asserting it's a rebuildable cache and
  describing the rebuild.
- **Designing model serving.** It's the adjacent question, not this one.
  Recover by handing off to `D7-Q15` explicitly.

**Follow-up probes the interviewer asks next**

1. **"How would you detect skew before a model degrades?"** — the
   sampled-and-recomputed comparison, run continuously, alerting the
   feature owner rather than the model owner, because the fix is in the
   pipeline. Model-quality monitoring catches it later and less
   specifically.
2. **"Fifty features today. What breaks at five thousand?"** — the
   online store's write amplification and the backfill cost first, then
   human comprehension. At that scale I'd require an owner and a
   declared consumer list per feature, expire features nothing reads,
   and group materialisation by freshness tier so one daily job doesn't
   rewrite everything.
3. **"A feature's definition changes. What happens to models trained on
   the old one?"** — the definition is versioned, the old version keeps
   materialising until no model in service depends on it, and training
   snapshots retain the version they used. Silently redefining a feature
   under a live model is the machine learning equivalent of the semantic
   schema change in `D3-Q07`.
4. **"Who owns a feature — the team that defined it or the platform?"** —
   the team with the domain knowledge owns the definition and its
   quality; the platform owns the materialisation and the freshness
   guarantee. If the platform owns definitions, it becomes a queue; if
   nobody owns them, duplicates proliferate under slightly different
   names. That's `D3-Q17`'s contract model applied to features.
5. **"The online store goes down during peak inference. What's the
   plan?"** — serve with the model's defined fallback behaviour for
   missing features, which is a modelling decision made in advance, and
   rebuild from offline. What I won't do is have inference fall back to
   computing features inline, because that reintroduces the skew this
   whole design exists to remove.

**Cross-references**

- `design-07` `D7-Q15` — real-time personalisation and the serving
  latency budget; this question stops at delivering a correct vector.
- `D3-Q05` — the Gold/ML branch that as-of joins are built from.
- `D3-Q17` — feature definitions as owned contracts with quality
  expectations.

---

### D3-Q12 — "This is a payments ledger. Two transfers for the same account arrive out of order. Tell me exactly what happens."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 1.3, 6.2 |
| **Axis** | data |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D3-Q03` |

**What the interviewer is actually testing**

Whether you'll make the message bus responsible for correctness. The
expected answer moves authority to a store that can give a total order
per account transactionally, and treats the bus as a notification
channel. A candidate who solves this with ordering keys alone has built
a ledger whose correctness depends on delivery semantics, and the
follow-up questions will dismantle it.

**Clarifying questions to ask before drawing anything**

- **Is the ledger the system of record, or a projection of one?** If
  another system already holds authoritative balances, I'm building a
  replica and the requirements are completely different.
- **Do we need to reject transactions on insufficient balance?** If yes,
  a balance read and a write must be atomic, which rules out deriving
  balance asynchronously from a stream.
- **What ordering does the business actually require — per account, or
  globally?** Almost always per account. Global ordering is a guarantee
  nobody needs and it costs throughput at every layer.
- **Is this multi-region, and do writers exist in more than one?** That
  decides whether I need external consistency across regions or can
  accept a single-region writer with cross-region reads.
- **What does the audit obligation require — current balances, or every
  movement forever?** That's the difference between a mutable balance
  field and an immutable entry log, and it's a compliance answer.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Correct balances are non-negotiable | Stated | — | Correctness cannot rest on delivery order |
| Ordering matters per account, not globally | Assumed | "Two different accounts' transfers have no required relative order" | Sets the ordering key and the sharding boundary |
| Overdraft must be prevented | Assumed | "If overdrafts are allowed and corrected later, this becomes much easier" | Forces read-and-write atomicity in one transaction |
| Every movement must be auditable forever | Assumed | "Financial systems keep entries, not just balances" | Immutable double-entry log rather than a mutable field |
| Downstream systems consume ledger events | Assumed | "Notifications, analytics, reconciliation all read from the bus" | The bus carries derived facts, not authority |
| Duplicates are possible | Assumed | "At-least-once everywhere; dedup on transaction ID" | Inherits `D3-Q03` |

**The answer, out loud**

The first thing I'd say is that the ordering problem as posed doesn't
get solved on the message bus, and trying to solve it there is the
mistake the question is probing for. The ledger's authority lives in a
store that can assign a total order per account inside a transaction —
Spanner, for the strong consistency and the multi-region story. The bus
carries notifications of what the ledger decided, not instructions the
ledger must obey in order.

So the write path is: a transfer request arrives, and in one transaction
we read the account's current position, validate it, append two entries
— double-entry, debit and credit, summing to zero — and assign a
per-account sequence number from the same transaction. That sequence is
authoritative. If two transfers for the same account race, the database
serialises them and one gets sequence 41 and the other 42, regardless of
which message arrived at which consumer first. Out-of-order arrival at
the edge becomes irrelevant, because arrival order never had authority.

Balance is derived from entries, not stored as a field people update. I
would hold a materialised balance alongside, updated in the same
transaction, because recomputing from millions of entries on every read
is impractical — but the entries are the truth and the materialised
balance is a cache that a reconciliation job re-derives and compares.
When those disagree, that's a page, not a dashboard, and the entries
win.

Then the bus. Every committed entry is published with the account ID,
the sequence number, the transaction ID and the resulting balance. I'd
set the Pub/Sub ordering key to the account ID, because per-account
order is genuinely useful to consumers and cheap at this granularity;
global ordering would be pointless and expensive. But I'd design every
consumer to not *need* that ordering, for one specific reason:
ordering-key delivery blocks at the head of the line when a message
can't be acknowledged, so a single poison message stalls that account's
stream entirely. Consumers therefore carry a small reorder buffer keyed
by account, apply sequence numbers in order when they can, hold briefly
when they see a gap, and — if the gap persists past a timeout — alert
and fetch the missing entries directly from the ledger rather than
waiting forever. That interaction between ordering keys and dead-letter
handling is the subtle part, and `D3-Q13` carries the operational side.

Idempotency is the other half. Every consumer deduplicates on
transaction ID, so a redelivery is a no-op, and the sequence number
gives the staleness check — an entry whose sequence is lower than what
the consumer already applied is discarded rather than re-applied. Those
are two distinct mechanisms doing two distinct jobs, exactly as in
`D3-Q03`.

Finally, reconciliation, which is what makes all of this defensible
rather than merely plausible. A scheduled job recomputes each account's
balance from its entries and compares it with the materialised balance
and with every downstream projection. The check runs daily at minimum,
the result is published as a data-quality metric with a tolerance of
zero, and a mismatch is an incident. In payments, the reconciliation job
is not a safety net bolted on afterwards — it's the control that lets
you tell a regulator your numbers are right, and I'd build it at the
same time as the write path rather than after the first discrepancy.

**Architecture**

```
  TWO TRANSFERS, SAME ACCOUNT, ARRIVING OUT OF ORDER
  ═══════════════════════════════════════════════════

  (1) transfer A and transfer B submitted, A first by wall clock
      — but B's request reaches the service first              ◄── (1)
            │
            ▼
  (2) ledger-svc, ONE Spanner transaction per transfer:
        read account position
        validate (overdraft check happens HERE, atomically)    ◄── (2)
        append double-entry rows, debit + credit, sum = 0      ◄── (3)
        assign per-account seq from the same transaction       ◄── (4)
        update materialised balance in the same transaction    ◄── (5)
      COMMIT
            │   B commits first ─► B = seq 41, A = seq 42.
            │   Arrival order never had authority.
            ▼
  (3) publish committed entries to Pub/Sub, ordering key =
      account_id, payload carries txn_id, seq, resulting balance ◄── (6)
            │
            ▼
  (4) consumers: dedup on txn_id (repeats), compare seq
      (staleness), small per-account REORDER BUFFER             ◄── (7)
        gap seen        ─► hold briefly
        gap persists    ─► alert + fetch missing entries from
                           the ledger directly, never wait forever ◄── (8)
            │
            ▼
  (5) reconciliation, scheduled: recompute balance FROM ENTRIES,
      compare to materialised balance and to every downstream
      projection; tolerance is zero; mismatch pages             ◄── (9)

  Cross-cutting: an ordering key blocks at the head of the line when
  a message cannot be acknowledged, so one poison message stalls that
  account's whole stream — which is why consumers are designed not to
  NEED ordering and why the dead-letter path (D3-Q13) is part of this
  design rather than adjacent to it (10).
```

**Every arrow explained:**

1. **Out-of-order arrival at the edge** — expected and harmless. The
   design's entire premise is that arrival order carries no authority,
   so nothing downstream has to compensate for it.
2. **Validation inside the transaction** — the overdraft check and the
   write are atomic. Deriving balance asynchronously from a stream and
   then validating against it is the design that permits a double-spend
   under concurrency.
3. **Double-entry rows** — every movement is two entries summing to
   zero, which makes a whole class of corruption detectable by
   arithmetic rather than by inspection.
4. **Per-account sequence assigned transactionally** — this is the total
   order that matters. It is produced by the store, not by a producer's
   clock and not by the broker.
5. **Materialised balance in the same transaction** — a cache for read
   performance, never the truth. Reconciliation re-derives it from
   entries.
6. **Publish after commit, ordering key per account** — the bus
   distributes decisions. Use the account as the ordering key; don't use
   a global ordering key, which buys a guarantee nobody needs and costs
   throughput everywhere.
7. **Dedup on transaction ID, staleness by sequence** — two mechanisms,
   two jobs: repeats versus reordering (`D3-Q03`).
8. **Bounded reorder buffer with an escape hatch** — hold briefly on a
   gap, then alert and read from the ledger. A consumer that waits
   indefinitely for a message that will never arrive is an outage with a
   very quiet start.
9. **Reconciliation as a control, not a safety net** — built with the
   write path, tolerance zero, mismatch pages. It is what makes the
   numbers defensible to someone outside engineering.
10. **Head-of-line blocking on ordering keys** — a poison message stalls
    that key's stream, which couples ordering to the dead-letter design
    (`D3-Q13`) whether you planned for it or not.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Source of order | Per-account sequence assigned transactionally in the ledger | Rely on broker ordering keys for correctness | Correctness stops depending on delivery semantics entirely | When there is no transactional store in the path (pure event-sourced pipeline) — then ordering keys plus sequence gaps are all you have, and reconciliation matters more |
| Ledger store | Spanner for transactional order and external consistency | Cloud SQL with a single writer | Multi-region writes stay strongly consistent without a promotion step | When the ledger is genuinely single-region and modest in volume — then Cloud SQL is cheaper and simpler, with a documented DR promotion |
| Balance | Derived from immutable entries, materialised as a cache | Mutable balance field updated per transfer | Auditable forever; corruption is detectable arithmetically | When no audit obligation exists and volume is enormous — rare in payments, and worth challenging when claimed |
| Bus ordering | Ordering key per account, consumers not dependent on it | No ordering key at all | Useful ordering where it's cheap, without coupling correctness to it | When head-of-line blocking is unacceptable for latency — then drop ordering keys and let the reorder buffer do all the work |
| Gap handling | Bounded buffer, then alert and read from the ledger | Wait for the missing sequence indefinitely | Failure surfaces in minutes rather than being discovered in a report | When missing sequences are impossible by construction — they aren't, in any system with a dead-letter path |

**What a weak answer sounds like**

- "We'd use ordering keys so messages arrive in order." — it makes
  correctness a property of the transport, and the next question is what
  happens when one message can't be processed.
- "Balances are eventually consistent; we correct discrepancies later."
  — acceptable in analytics, not in a ledger where a read decides
  whether a payment is allowed.
- "Each service keeps its own balance and we reconcile nightly." — the
  reconciliation will find the disagreement and nobody will know which
  copy is right.
- "We'd use timestamps to order the events." — producer clocks disagree,
  and two transfers in the same millisecond are exactly the case that
  matters.

**Common wrong turns**

- **Solving ordering on the bus.** It's the intuitive move and it makes
  correctness dependent on delivery. Recover by moving the sequence
  assignment into the ledger transaction.
- **Storing balance as a mutable field.** It works until the first
  partial failure, then there's no way to tell what happened. Recover by
  making entries immutable and the balance derived.
- **Forgetting head-of-line blocking.** Ordering keys and dead-letter
  queues interact badly and the first incident is a stalled account.
  Recover by naming it while drawing the bus.
- **Leaving reconciliation as future work.** It's the control that makes
  the design defensible. Recover by putting it in the first release.

**Follow-up probes the interviewer asks next**

1. **"A consumer has been stuck on a gap for an hour. What do you see,
   and what do you do?"** — an alert on buffer age per account, a
   dead-letter entry for the message that couldn't be acknowledged, and
   a decision: replay it if the failure was transient, or skip it and
   read the entries from the ledger if it's poison. The runbook is
   `D3-Q13`; the point is that both paths exist before the incident.
2. **"Your ledger does a thousand transactions a second. What breaks at
   a hundred thousand?"** — the hot account first, not the ledger
   overall. A small number of accounts (a merchant settlement account,
   the treasury account) will take a large share of writes and serialise
   on the same row. I'd shard hot accounts into sub-accounts that sum to
   a logical balance, which is a real complexity cost and the standard
   answer at that scale.
3. **"You need to operate in two regions with writers in both. Now
   what?"** — a multi-region configuration with external consistency,
   and I'd accept the write-latency cost rather than run two ledgers
   that reconcile. If the latency is unacceptable, the honest design is
   region-partitioned accounts — an account has a home region — not
   multi-master with conflict resolution on money.
4. **"Who owns the reconciliation result when it disagrees?"** — finance
   owns the number, engineering owns the discrepancy. I'd make the
   reconciliation output a report finance receives directly, because a
   control that only engineers see is a control the business can't rely
   on. The operating model around that belongs to `design-06`.
5. **"Escalate: what's the worst thing your design can do?"** — accept a
   payment that should have been declined, because the materialised
   balance was used for validation instead of the entries. That's why
   the overdraft check reads inside the transaction and why
   reconciliation compares the two continuously — the failure is
   plausible enough that it needs a standing detection mechanism, not a
   code review.

**Cross-references**

- `D3-Q03` — dedup and version-conditional writes, both used here.
- `D3-Q13` — dead-letter handling and its interaction with ordering
  keys.
- `03-comparisons/02-storage-database-options.md` — the Spanner row
  backs the ledger-store choice; the Cloud SQL alternative row backs the
  tradeoff.

---

### D3-Q13 — "It's 3am, you're on call, and a queue is backing up with failed messages. Design the dead-letter and replay system you'd want to have."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 6.2, 4.1 |
| **Axis** | data |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D3-Q03` |

**What the interviewer is actually testing**

Whether you design for the person under stress rather than for the happy
path. Most dead-letter designs are technically complete and operationally
useless: the messages are retained, and the only way to look at them is
to pull them one at a time. The panel is listening for a triage surface,
a categorisation, and a replay tool with a guard on it.

**Clarifying questions to ask before drawing anything**

- **What actually fails today — the message, or the thing it calls?** A
  malformed payload and a downstream outage produce the same queue depth
  and need opposite responses, so the design has to distinguish them
  before a human does.
- **Is replay safe?** If handlers aren't idempotent, replay is a second
  incident and the only honest answer is that we fix idempotency first
  (`D3-Q03`).
- **Are ordering keys in use?** If they are, a poison message blocks its
  key's whole stream, so the urgency is about one account or one device,
  not about aggregate depth.
- **Who is on call, and do they own this service?** A platform on-call
  engineer triaging another team's failed messages needs far more
  context embedded in the dead letter than the owning team would.
- **What's the retention on the source topic?** It determines whether
  replay-from-source is still possible or whether the dead-letter queue
  is the only copy left.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Failed messages must not be lost | Stated | — | A dead-letter path on every subscription, from day one |
| An on-call engineer must triage without the owning team | Assumed | "At 3am the expert is asleep; the dead letter has to carry its own context" | Error envelope, not just the original payload |
| Handlers are idempotent | Assumed | "If they aren't, replay is unsafe and that's the first fix" | Makes replay a routine operation rather than a risk |
| Some failures are permanent | Assumed | "A malformed payload will never succeed, no matter how many retries" | Requires categorisation, not uniform retry |
| Replay volume can be large | Assumed | "A downstream outage can dead-letter hours of traffic" | Replay needs rate limiting and a dry run |
| Ordering keys are in use somewhere | Assumed | "Payments and per-device streams both use them" | Head-of-line blocking changes the urgency calculus |

**The answer, out loud**

I'd design backwards from the 3am experience, because that's the only
test this system ever really takes.

At 3am the on-call engineer gets one alert, and it's on the *age* of the
oldest unprocessed message, not on queue depth. Depth is a number that
means nothing without context — a thousand messages during a traffic
spike is fine, ten messages stuck for an hour is an outage. Age tells
you something is not moving, which is the actual failure.

They open one place: a table. Every dead-lettered message lands in a
dead-letter topic whose subscription writes into BigQuery, so the first
thing on-call does is group by error class and count. That single
capability is the difference between a usable and a useless dead-letter
system — if triage requires pulling messages one at a time, nobody will
understand the shape of the failure before the incident is over. Ten
thousand messages with one error class is a downstream outage; ten
thousand messages with two hundred error classes is something much
worse.

For that to work, the dead letter must carry an envelope, not just the
original payload. The consumer catches the failure and publishes an
error envelope containing the original message and attributes, the
failure class, the exception detail, the attempt count, the subscription
it came from, the consumer version, and the time it was first seen. The
broker's own dead-letter routing catches the cases the consumer can't —
crashes, timeouts, messages that were never acknowledged — but those
arrive with less context, so I want both paths and I want to know which
one a given message came through.

Then categorisation, which is what turns triage into a decision. Four
buckets. Poison: the payload is wrong and will never succeed; replaying
it unchanged is pointless, so it needs a fix or a deliberate discard,
recorded. Downstream outage: the message is fine and the dependency
wasn't; replay after recovery, and this is the bulk of real volume.
Schema mismatch: the consumer can't parse what the producer sent; fix
the consumer or the producer, then replay (`D3-Q07`). Already applied: a
duplicate whose effect landed; drop it, and the fact that it's
distinguishable at all is thanks to idempotency keys.

The replay tool is one command with three properties I'd insist on.
First, it's filtered — by time range, error class, and source
subscription — because replaying everything in a dead-letter queue is
how you turn a small incident into a large one. Second, it dry-runs by
default: it tells you how many messages match before it sends anything.
Third, it's rate-limited and capped, with a threshold above which a
second person has to approve, because a replay at full speed into a
just-recovered downstream is how you knock it over again. Every replayed
message carries a replay marker attribute, so downstream metrics can
distinguish replayed traffic from live traffic and a duplicate-looking
spike in a dashboard has an explanation.

I'd distinguish two replay mechanisms explicitly, because they're used
for different things. Draining the dead-letter queue is surgical — these
specific failed messages, re-sent. Seeking a subscription back to a
timestamp or a snapshot is blunt — everything in that window, re-
delivered, including things that already succeeded. Seek is the right
tool after a consumer bug that silently mis-processed good messages;
drain is the right tool after a downstream outage. Using seek when you
meant drain is a large, self-inflicted duplicate storm, which is
survivable only because of `D3-Q03` and is still worth avoiding.

The last thing I'd flag is the ordering interaction. When ordering keys
are in use, a message that can't be acknowledged blocks its key — so one
poison message stalls one account or one device indefinitely while the
aggregate queue depth looks healthy. The alert for that is per-key
stall, not global depth, and the resolution is usually to dead-letter
the offending message quickly so the key unblocks. That's the argument
for a relatively low delivery-attempt limit on ordered subscriptions and
a higher one where ordering doesn't apply.

**Architecture**

```
  3AM PATH — designed backwards from what on-call actually does
  ═════════════════════════════════════════════════════════════

  (1) consumer processes a message and fails                   ◄── (1)
        ├─ known non-retryable  ─► publish ERROR ENVELOPE to
        │    the DLQ topic: original payload + attributes,
        │    error class, exception, attempt count, source
        │    subscription, consumer version, first-seen  ◄── (2)
        └─ crash / timeout / never acked ─► broker dead-letter
             routing after max attempts (less context)   ◄── (3)
                          │
                          ▼
  (2) DLQ topic ──► subscription ──► BigQuery dlq table        ◄── (4)
        so triage starts with GROUP BY error_class, COUNT(*)
        instead of pulling messages one at a time
                          │
                          ▼
  (3) ALERT fires on OLDEST MESSAGE AGE, not queue depth       ◄── (5)
        (depth without context means nothing; age means
         something has stopped moving)
                          │
                          ▼
  (4) triage into four buckets:                                ◄── (6)
        poison          ─► never replay unchanged; fix or
                           discard deliberately, recorded
        downstream out  ─► replay after recovery (most volume)
        schema mismatch ─► fix consumer/producer, then replay
        already applied ─► drop; idempotency made it visible
                          │
                          ▼
  (5) REPLAY TOOL — filtered by time range + error class +
      source; DRY RUN by default (count first); rate-limited
      and capped; second approval above a threshold; every
      replayed message carries a replay marker attribute   ◄── (7)
                          │
        ┌─────────────────┴─────────────────┐
        ▼                                   ▼
   DRAIN the DLQ (surgical:          SEEK the subscription
   these failed messages)            (blunt: everything in a
        ◄── (8)                      window, re-delivered) ◄── (9)

  Cross-cutting: with ordering keys, one unacknowledged message
  blocks its whole key — one account or one device stalls while
  aggregate depth looks healthy — so ordered subscriptions alert on
  per-key stall and use a LOWER delivery-attempt limit, to
  dead-letter fast and unblock the key (10); replay is only routine
  because handlers are idempotent (D3-Q03), and if they aren't, the
  first fix is there, not here (11).
```

**Every arrow explained:**

1. **Failure at the consumer** — the consumer knows more about why than
   the broker ever will, so it's the first place to capture context.
2. **Error envelope published by the consumer** — original message plus
   the reason. Without the reason, triage is archaeology.
3. **Broker dead-letter routing as the backstop** — catches crashes and
   unacknowledged messages the consumer couldn't report on. Keep both
   paths and record which one delivered a given message.
4. **Dead letters queryable in BigQuery** — the single most valuable
   property of the design. Use it so triage starts with a distribution;
   don't rely on pulling messages individually, which nobody can do at
   volume under stress.
5. **Alert on oldest-message age** — depth varies with traffic; age
   means something has stopped. Use age as the page; keep depth as a
   dashboard.
6. **Four-bucket categorisation** — poison, downstream outage, schema
   mismatch, already applied. Each has a different action, and uniform
   retry treats them all as the second one.
7. **Replay tool with dry run, filters, rate limit and a cap** — the
   guard against turning a small incident into a large one. The replay
   marker attribute keeps downstream metrics interpretable.
8. **Drain for surgical replay** — exactly the failed messages, nothing
   else. Use after a downstream outage.
9. **Seek for window replay** — everything in a time range, including
   messages that already succeeded. Use after a consumer bug that
   silently mis-processed; don't use it when drain would do.
10. **Ordering-key stalls** — one blocked message stalls one key. Alert
    per key, and dead-letter faster on ordered subscriptions so the key
    unblocks.
11. **Idempotency is the precondition** — replay is routine only because
    repeats are harmless (`D3-Q03`).

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Alerting signal | Oldest-message age | Queue depth threshold | Depth tracks traffic; age tracks "stopped," which is the failure | When throughput is perfectly steady and depth is a reliable proxy — rarely true, and it degrades silently when it stops being true |
| Dead-letter content | Error envelope written by the consumer | Broker dead-letter routing alone | Triage needs the reason, not just the payload | When consumers are third-party or can't be modified — then broker routing plus log correlation is what you have |
| Triage surface | Dead letters streamed into a queryable table | Inspect messages via the console or CLI | Grouping by error class in one query is the whole difference at 3am | When volume is genuinely tiny (a handful a week) — then the extra pipeline isn't worth maintaining |
| Replay default | Dry run, filtered, rate-limited, capped | Replay everything immediately | Prevents re-breaking a downstream that just recovered | When the queue is small and the failure cause is unambiguous — then the ceremony costs more than it saves |
| Delivery attempts | Low on ordered subscriptions, higher elsewhere | One value for every subscription | Ordered streams need fast dead-lettering to unblock a key | When ordering isn't used at all — then a single higher limit reduces avoidable dead-lettering |

**Making it concrete**

```bash
# Surgical: how many, before anything is re-sent. The count IS the
# decision — a hundred messages and ninety thousand are different
# incidents with different approval requirements.
bq query --use_legacy_sql=false '
SELECT error_class, COUNT(*) AS n, MIN(first_seen) AS oldest
FROM `PROJECT_ID.ops.dlq_messages`
WHERE source_subscription = "orders-process"
GROUP BY error_class ORDER BY n DESC'

# Blunt, and a different tool for a different failure: re-deliver
# everything in a window after a consumer bug mis-processed good
# messages. Never reach for this when a DLQ drain would do.
gcloud pubsub subscriptions seek orders-process \
  --time=2026-09-12T01:00:00Z
```

**What a weak answer sounds like**

- "Failed messages go to a dead-letter topic." — where they sit, unread,
  until someone notices a business metric is wrong. Retention isn't
  triage.
- "We'd alert when the queue gets deep." — depth tracks traffic; the
  failure you care about is that nothing is moving.
- "On-call can pull the messages and look at them." — at ten thousand
  messages that isn't a procedure, it's an aspiration.
- "We'd replay the dead-letter queue once the downstream recovers." —
  correct instinct, and without rate limiting it's how the downstream
  goes down a second time.

**Common wrong turns**

- **Designing dead-lettering without categorisation.** Everything gets
  retried the same way, including things that can never succeed. Recover
  by naming the four buckets and their actions.
- **Forgetting the error envelope.** The payload alone doesn't say why.
  Recover by having the consumer publish the reason it already knows.
- **Ignoring the ordering interaction.** A stalled key is invisible in
  aggregate metrics. Recover by adding a per-key stall alert.
- **Treating replay as a script someone writes during the incident.**
  Recover by making it a built, tested tool with a dry run — written
  when nobody is under pressure.

**Follow-up probes the interviewer asks next**

1. **"A downstream outage dead-letters four hours of traffic. Walk me
   through the recovery."** — confirm the downstream is healthy and has
   headroom, dry-run the count by error class, replay rate-limited at a
   fraction of normal throughput with the replay marker on, and watch
   both the downstream's latency and the dead-letter rate on the replay
   itself. If the replay starts dead-lettering again, stop immediately —
   that means the recovery was partial.
2. **"One subscription today, four hundred across the company. What
   changes?"** — the per-subscription tooling has to become platform
   tooling: one dead-letter table schema, one replay tool, one alerting
   standard, provisioned automatically when a subscription is created.
   Otherwise each team builds a worse version and on-call has to learn
   four hundred of them.
3. **"How do you stop the replay tool being the cause of the next
   incident?"** — the cap and the second approval above a threshold, the
   rate limit, and the dry run. It's a deliberately blunt guard and I'd
   keep it even when it's annoying, because replay is exactly the
   operation people run while tired and certain.
4. **"Who owns a dead-letter queue — the producing team or the consuming
   team?"** — the consuming team, because they own the handler that
   failed, with the producing team on the hook for schema and payload
   defects. That split has to be written down before an incident, not
   negotiated during one; the operating model belongs to `design-06`.
5. **"A message has been in the dead-letter queue for a month. What
   happened?"** — nobody owned it, which means the age alert either
   doesn't exist or is routed to a channel nobody reads. I'd treat
   dead-letter age as a service-level indicator with an explicit target
   and review it like any other, because a queue nobody drains is a
   queue that silently accumulates business impact.

**Cross-references**

- `D3-Q03` — idempotency, without which replay is unsafe.
- `D3-Q12` — the ordering-key interaction and per-key stalls.
- `D3-Q02` — the compensation dead-letter queue, which is the highest
  severity instance of this pattern.

---

### D3-Q14 — "Three of our markets have data residency laws and the executive team wants one global analytics view. Design it."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 3.2, 1.3 |
| **Axis** | data |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D3-Q10` |

**What the interviewer is actually testing**

Whether you move the question to the data instead of the data to the
question. The failure mode is a candidate who designs a global warehouse
and then tries to bolt controls onto it; the strong answer processes in
jurisdiction, exports only what is permitted to cross, and is explicit
about what the global layer can and cannot answer as a result.

**Clarifying questions to ask before drawing anything**

- **What exactly may not leave — the raw records, the identifiers, or
  any derived value?** These are three very different constraints, and
  the third one is rare but does exist. The answer determines whether a
  global aggregate layer is legal at all.
- **Is the obligation about storage location, or about access?** Some
  regimes are satisfied by in-region storage with controlled access;
  others restrict who may view data regardless of where it sits. The
  second brings personnel and support access into scope.
- **How many jurisdictions, and will there be more?** Three is a
  template; twelve is a platform. Designing the template so a fourth
  costs a configuration change is the difference between the two.
- **What questions does the global view actually need to answer?**
  Usually counts, revenue, and trends — all of which survive
  aggregation. If someone needs per-customer global records, that
  requirement collides with the law and the conversation moves.
- **Is there a single-region jurisdiction?** If a market permits only one
  region, cross-region disaster recovery isn't available there, and the
  achievable recovery objectives change accordingly.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Regulated data must remain in its jurisdiction | Stated | — | Processing is deployed per region; data doesn't travel |
| A global analytical view is required | Stated | — | Forces an aggregate layer with explicit crossing rules |
| Aggregates above a threshold may cross | Assumed | "Most regimes permit non-identifying aggregates; I'd want that confirmed by counsel per market" | Makes the global layer possible at all |
| One codebase, many deployments | Assumed | "I won't fork the pipeline per market — that's how three become three platforms" | Templated per-region deployment |
| Support and engineering access is in scope | Assumed | "Access controls matter as much as storage location for several regimes" | Brings perimeter and break-glass design into the picture |
| Recovery objectives may differ per market | Assumed | "A single-region jurisdiction cannot have cross-region DR" | Ties the DR tier to the residency constraint |

**The answer, out loud**

The organising principle is that the query travels and the data doesn't.
Each jurisdiction gets a complete, identical processing stack — the same
pipeline code, the same table definitions, deployed per region into
projects pinned by the resource-location org policy, with keys in an
in-region key ring. Identical, not similar: the moment markets get
bespoke pipelines, you have three platforms with one name, and the cost
of a fourth market is another platform rather than another deployment.
The structural residency work at the platform level — folder layout,
policy attachment, perimeters — is `design-01`'s `D1-Q10` and
`design-04`'s, and I'd build on it rather than redraw it.

Inside each region, the pipeline produces two families of output. The
first is the full detailed layer, which stays in region and is what
local analysts and local operational systems query. The second is the
export set: aggregates computed to a defined grain, with a minimum
cohort size so that a small group can't be re-identified by
intersection, plus pseudonymous keys where a global view needs to count
distinct entities without knowing who they are — with the mapping table
staying in region, always.

Those export sets are what crosses into a global dataset, and I'd be
precise about the mechanism, because BigQuery's location semantics are
not negotiable: a dataset's location is fixed when it's created, and a
query cannot join tables across locations. So the global layer is a
separate dataset in a designated location, populated by scheduled
cross-region copies or exports of the per-region aggregate tables, not
by a federated query reaching into the regions. That has a real
consequence I'd state plainly: the global view is periodic, not live,
and it answers aggregate questions only. If someone wants a live global
per-customer view, that requirement is in conflict with the constraint
and has to be resolved by the business and counsel rather than by
architecture.

The crossing itself should be a controlled gate rather than a pipeline
step nobody looks at. One job per region, producing a defined table set
with a schema that is reviewed, a minimum-cohort check enforced as an
assertion rather than a convention, and a log of exactly what crossed
and when. If a new column appears in an export table, that should
require the same review as a new data-sharing agreement, because in
substance that's what it is.

Recovery objectives come next, and this is where residency bites in a
way people miss. If a market permits only one region, then cross-region
replication is unavailable there and the honest tiering is Backup and
Restore, or at best a Warm Standby within the same region's zones —
which means the recovery time for that market is genuinely worse than
for markets with regional choice, and that difference needs to be
accepted in writing rather than discovered during an incident. Where a
jurisdiction spans multiple regions, Active-Passive across two in-region
choices is available and I'd use it for the markets whose business
impact justifies it. I'd use the standard tier names deliberately so
nobody has to guess what's being promised.

Finally, metadata, which is the leak nobody draws. Schemas, table names,
job metadata, catalog entries and monitoring labels often cross regions
by default, and they regularly contain identifiers — a table named after
a customer, a dashboard titled with an account name, an error message
containing a payload fragment. I'd audit the metadata path explicitly
and treat logs as in-scope data, because an error log with personal data
in it is the residency breach that no diagram shows.

**Architecture**

```
  ONE PIPELINE CODEBASE, DEPLOYED PER JURISDICTION             ◄── (1)

  ┌─── REGION A (regulated) ───┐ ┌─── REGION B ───┐ ┌─ REGION C ─┐
  │ ingest → transform → full  │ │  identical     │ │ identical  │
  │ detail layer STAYS HERE    │ │  stack         │ │ stack      │
  │ CMEK from an IN-REGION     │ │                │ │            │
  │ key ring, resourceLocations│ │                │ │            │
  │ org policy pins creation   │ │                │ │            │
  │        ◄── (2)             │ │                │ │            │
  │            │               │ │       │        │ │     │      │
  │            ▼               │ │       ▼        │ │     ▼      │
  │  EXPORT SET: aggregates at │ │  export set    │ │ export set │
  │  a defined grain, minimum- │ │                │ │            │
  │  cohort assertion, pseudo- │ │                │ │            │
  │  nymous keys — MAPPING     │ │                │ │            │
  │  TABLE NEVER LEAVES ◄──(3) │ │                │ │            │
  └──────────┬─────────────────┘ └───────┬────────┘ └─────┬──────┘
             │   scheduled copy/export, reviewed schema,
             │   logged: what crossed, when, under whose approval ◄── (4)
             └──────────────┬──────────────────┬──────────────────┘
                            ▼
            ┌──────────────────────────────────────────┐
            │ GLOBAL dataset — fixed location, holds   │  ◄── (5)
            │ ONLY export sets. Periodic, not live.    │
            │ Answers aggregate questions only.        │
            └──────────────────────────────────────────┘

  DR per market, named explicitly:                             ◄── (6)
    multi-region jurisdiction  → Active-Passive across regions
    single-region jurisdiction → Warm Standby in-zone, or
                                 Backup & Restore — and the
                                 worse recovery time is accepted
                                 in writing, not discovered

  Cross-cutting: metadata crosses by default — table names, job
  labels, catalog entries, and especially LOGS — and it routinely
  contains identifiers, so the metadata and logging paths are audited
  as in-scope data (7); a query cannot join across BigQuery locations,
  so the global layer is fed by copies, never by a federated query
  reaching into a region (8).
```

**Every arrow explained:**

1. **One codebase, many deployments** — the difference between three
   markets and three platforms. A fourth jurisdiction must be a
   configuration change, not a project.
2. **In-region keys and pinned resource creation** — the resource
   location constraint and an in-region key ring are what make the
   residency claim structural rather than procedural. Platform-level
   design of those controls is `design-01` and `design-04`.
3. **Pseudonymous keys with the mapping held in region** — lets the
   global layer count distinct entities without being able to identify
   them. If the mapping crosses, the pseudonymisation is decorative.
4. **A reviewed, logged crossing gate** — adding a column to an export
   table is, in substance, amending a data-sharing agreement, and should
   feel like it.
5. **Global dataset in a fixed location** — periodic and
   aggregate-only. State the consequence out loud: a live global
   per-customer view is not available under this constraint.
6. **DR tier per market, named** — Active-Passive where the jurisdiction
   has more than one region; Warm Standby or Backup and Restore where it
   doesn't, with the worse objective accepted explicitly.
7. **Metadata and logs as in-scope data** — the leak that no
   architecture diagram shows and that audits find first.
8. **No cross-location joins** — BigQuery's location semantics dictate
   copies rather than federation; designing around a federated global
   query is designing around something that isn't available.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Global view | Aggregate export sets copied to a global dataset | One global warehouse with row-level controls | Regulated rows never leave, so the control is structural rather than configurational | When the regime permits centralisation with access controls — some do — then one warehouse is far simpler to operate |
| Pipeline shape | One codebase deployed per region | A central pipeline reaching into each region | Keeps processing in jurisdiction and makes a new market a config change | When no residency constraint applies to processing, only to storage — then central processing with regional sinks is cheaper |
| Identity across regions | Pseudonymous keys, mapping stays in region | Share the real identifiers with the global layer | Global distinct counts without re-identification risk | When identifiers are already non-personal (product codes, store numbers) — then pseudonymisation adds nothing |
| Crossing control | Reviewed schema plus a minimum-cohort assertion | Trust the aggregation query to be non-identifying | Assertions fail loudly; conventions fail silently | When aggregates are coarse by construction and reviewed at design time — still worth the assertion, in my view |
| DR in a single-region market | Warm Standby in-zone or Backup and Restore, stated | Replicate to a nearby region for better recovery | Doesn't breach residency to buy recovery time | When the regulator explicitly permits a named adjacent region — then Active-Passive across that pair is available and better |

**Making it concrete**

```hcl
# Structural, not procedural: resources for this jurisdiction can only
# be created in its permitted locations, inherited by every project in
# the folder. Platform-level residency design lives in design-01.
resource "google_folder_organization_policy" "market_a_locations" {
  folder     = "folders/FOLDER_ID"
  constraint = "constraints/gcp.resourceLocations"
  list_policy {
    allow { values = ["in:REGION_A_LOCATIONS"] }
  }
}

# The dataset's location is immutable and cannot be joined across —
# which is exactly why the global layer is fed by copies.
resource "google_bigquery_dataset" "market_a_detail" {
  project    = "PROJECT_ID"
  dataset_id = "market_a_detail"
  location   = "REGION_A"
}
```

**What a weak answer sounds like**

- "We'd put everything in one global warehouse and use row-level
  security." — the rows have already crossed the border by the time the
  policy evaluates; the control is in the wrong place.
- "We'd replicate the regional data to a central region for analytics."
  — that replication is the thing the constraint forbids.
- "Federated queries can join across regions." — BigQuery's location
  semantics don't allow cross-location joins, and designing around a
  capability that isn't there wastes the whiteboard.
- "Residency only affects storage." — access, support tooling, logs and
  metadata are all in scope for several regimes, and those are where
  audits find problems.

**Common wrong turns**

- **Forking the pipeline per market.** It starts as a small local
  difference and ends as three platforms. Recover by insisting on one
  codebase and putting differences in configuration.
- **Forgetting logs.** An error log containing a payload fragment
  crosses regions by default. Recover by treating logging as a data path
  with its own residency requirement.
- **Promising a live global view.** It's the thing the executive asked
  for and it isn't available under the constraint. Recover by saying
  what the global layer *can* answer and how fresh it will be.
- **Ignoring the DR consequence.** A single-region market simply cannot
  have cross-region recovery. Recover by naming the tier and getting the
  weaker objective accepted in writing.

**Follow-up probes the interviewer asks next**

1. **"A fourth market is added with a stricter regime. How long does it
   take?"** — a configuration change plus a legal review of the export
   set, if the template held. If it takes a project, the template
   failed, and I'd treat the first new market as the test of whether the
   design actually generalised.
2. **"Scale this: twelve jurisdictions, each with its own stack. What
   breaks?"** — deployment and observability, not the data model.
   Twelve identical stacks need one release pipeline, one dashboard with
   a per-market dimension, and one on-call that can operate all of them.
   The platform operations shape is `design-06`; the thing I'd guard
   architecturally is that no market accumulates local modifications.
3. **"An engineer in one country needs to debug a pipeline in
   another. What happens?"** — depends on whether the regime restricts
   access as well as storage. Where it does, support is performed by
   in-jurisdiction personnel or through a break-glass path with
   in-region data never leaving the perimeter. The access control design
   is `design-04`'s; my job is to ensure the architecture makes that
   enforceable rather than aspirational.
4. **"Who decides what's allowed to cross?"** — counsel per market,
   recorded per column, reviewed when the export schema changes.
   Engineering proposes; legal decides; the assertion enforces. Without
   a named approver, the export set grows one convenient column at a
   time.
5. **"The global aggregates don't reconcile with a market's local
   numbers. What now?"** — almost always a timing difference between the
   copy schedule and the local correction window (`D3-Q04`), so the
   first thing I'd add is an as-of timestamp on every global table and a
   reconciliation check per market with a stated tolerance.

**Cross-references**

- `design-01` `D1-Q10` — the platform-level residency design this
  builds on; folder layout, policy attachment and exceptions belong
  there.
- `design-04` — perimeter, access and break-glass controls named here.
- `03-comparisons/05-ha-dr-strategies.md` — the tier names used in
  callout (6); use them exactly as defined there.

---
