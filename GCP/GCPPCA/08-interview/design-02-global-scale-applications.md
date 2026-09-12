# Design Interviews — Global-Scale Applications

> Seventeen whiteboard questions on the *scale* axis: can you build one
> system that serves the world? Written for Staff and Principal Cloud
> Architect interviews in the 2026 market, not for exam prep. Every
> "answer" here is what a candidate **says out loud** in the room —
> first person, sequenced, committing to a choice and naming the
> constraint that forced it.

**How to use this file:** answer each question out loud before you read
past the clarifying-questions block — the value is in rehearsing the
sequence, not in recognising the diagram. The tradeoff table's last
column is where panels actually push; if you can't say when your own
choice is wrong, you haven't made a choice. Org structure, security
controls and migration sequencing get *named* here and *designed*
elsewhere — `design-01`, `design-04`, `design-05` respectively — and
the CANON block at the top of `design-01` owns hierarchy, naming and
tenancy vocabulary, which this file uses without restating.

## Question index

| ID | Question | Band | Axis | Domain leaves |
|---|---|---|---|---|
| D2-Q01 | Globally available e-commerce platform from scratch | Staff | scale | 1.2, 1.3, 6.2 |
| D2-Q02 | The checkout and inventory path — consistency, oversell, what you'd accept losing | Staff+ | scale | 1.2, 1.3, 6.2 |
| D2-Q03 | Global multiplayer game backend for spiky, unpredictable launch load | Staff | scale | 1.3, 6.2 |
| D2-Q04 | Low-latency global live-video ingest and distribution | Staff+ | scale | 1.3, 1.2 |
| D2-Q05 | Caching strategy for a read-heavy global app — layers, invalidation, what you never cache | Staff | scale | 1.3, 6.2 |
| D2-Q06 | Session and identity state for a multi-region active-active application | Staff | scale | 1.2, 1.3 |
| D2-Q07 | Partner-facing public API platform — gateway, quotas, versioning, auth, deprecation | Staff+ | scale | 5.1, 1.3 |
| D2-Q08 | Designing for a 10x traffic event with a known date | Staff | scale | 6.2, 1.2 |
| D2-Q09 | Global rate-limiting and abuse-protection layer | Staff+ | scale | 1.3, 6.2 |
| D2-Q10 | Multi-region write topology — active-active vs active-passive, and how you decide | Principal | scale | 1.2, 6.2 |
| D2-Q11 | Read path for a feed with a 100:1 read/write ratio | Staff | scale | 1.3, 6.2 |
| D2-Q12 | Media upload and processing pipeline at consumer scale | Staff | scale | 1.3, 6.2 |
| D2-Q13 | Meeting a contractual 99.99% when three dependencies only offer 99.9% | Principal | scale | 1.2, 6.2 |
| D2-Q14 | Mobile backend for offline-first clients, including conflict resolution | Staff+ | scale | 1.3, 5.1 |
| D2-Q15 | Arguing the single-region case to a leader who has already decided on multi-region | Principal | scale | 1.2, 6.2 |
| D2-Q16 | Internal search/recommendation serving against a strict p99 budget | Staff+ | scale | 1.2, 1.3 |
| D2-Q17 | Batch-heavy workload sharing a platform with latency-sensitive services | Staff+ | scale | 1.3, 6.2 |

---

### D2-Q01 — "Greenfield. Design me an e-commerce platform that serves customers everywhere. Whiteboard is yours."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 1.2, 1.3, 6.2 |
| **Axis** | scale |
| **Whiteboard time** | 45–55 min |
| **Reads well after** | — (the anchor question for this file) |

**What the interviewer is actually testing**

Whether "global" means anything specific to you. The weak version of
this answer draws a load balancer, three regions and a database, and is
finished in eight minutes. The strong version notices that "globally
available" is four requirements wearing one word — latency,
availability, consistency and residency — and that they pull in
opposite directions at the data layer. The panel is listening for
whether you split the data layer by requirement instead of picking one
database for the whole company.

**Clarifying questions to ask before drawing anything**

- **What availability number is in a contract, and what's aspiration?**
  A contractual figure changes the compute topology and forces the
  dependency analysis in `D2-Q13`. An aspiration lets me start in fewer
  regions and grow on evidence.
- **Where are the customers, and where is the money?** "Global" usually
  means three concentrations and a long tail. I'd rather serve three
  regions well than nine adequately, and the region list should follow
  revenue, not a map.
- **Are we handling card data ourselves or delegating to a processor?**
  Handling it drags a compliance perimeter into the middle of checkout
  and constrains where the app tier can run. Delegating turns it into an
  external dependency instead.
- **Is there any residency obligation on customer or order data?** If
  yes, this stops being one pooled data layer and becomes the
  per-region-isolated shape, and I need to know before I draw a single
  global store.
- **What's the catalogue-change rate versus the order rate?** That ratio
  decides how much of this is a caching problem and how much is a
  transactional one — and they get very different designs.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Genuinely multi-region user base | Stated | — | Justifies a global anycast edge rather than regional endpoints |
| Orders never double-charged or double-committed | Assumed | "I'll assume the order ledger needs global strong consistency; everything else doesn't" | Isolates the one slice that needs Spanner |
| Browsing may show slightly stale stock | Assumed | "I'll assume the product page can be approximate as long as checkout is exact" | Lets the read path be cached aggressively |
| No data-residency obligation yet | Assumed | "If there is one, the pooled data layer is wrong and I'd redraw" | Pooled vs per-region is the biggest fork here |
| Payments delegated to an external processor | Assumed | "I'd push card handling out of our perimeter unless there's a reason not to" | Turns a compliance problem into a dependency problem |
| Peaky traffic with known commercial events | Stated | — | Capacity strategy is event-driven, not steady-state (`D2-Q08`) |

**The answer, out loud**

I'd build this as four layers, and I'd say up front that only one of
them is hard. The edge, the app tier and the async spine are largely
the same at every company that does this. The data layer is where the
design actually lives, and that's where I'd spend the time.

The edge first. One global external Application Load Balancer with a
single anycast address, Cloud Armor attached as the policy surface, and
Cloud CDN enabled on the backend services that serve cacheable content.
I want the Application tier of Cloud Load Balancing specifically, not
the Proxy Network tier, because I need host and path routing,
header-based routing for canaries, and the CDN and Armor integrations —
those exist only on the HTTP-aware tier. If a slice of this platform
later carries a non-HTTP protocol, that slice gets the global external
Proxy Network LB and does not get CDN or L7 Armor rules; I'd rather
state that limitation than pretend one load balancer covers every
protocol. What I would not do is geo-DNS. DNS failover is bounded by
resolver caching and client TTL behaviour, which converts a
seconds-scale failover into a minutes-scale one, and the point of the
anycast frontend is that the health check makes the routing decision.

The app tier is stateless and regional, one deployment per serving
region, and I'd default to Cloud Run. The reason is the traffic shape:
retail is peaky, and per-request billing with fast horizontal scaling
matches peaky far better than a node pool I have to size. I'd switch to
GKE Autopilot if the org has already standardised on Kubernetes
primitives, because fighting an org standard to save per-unit cost is a
bad trade, and to GKE Standard only if the workload genuinely needs
node-level control. Statelessness here is load-bearing, not a
preference: the moment a session lives in app-tier memory, the LB's
latency routing starts destroying carts, and the fix is externalising
the state (`D2-Q06`), never turning on session affinity.

The data layer gets three consistency classes rather than one database.
Class one is the order and inventory ledger — where a wrong answer
costs money and trust. That's Cloud Spanner in a multi-region
configuration, because it gives me SQL semantics and strongly
consistent cross-region writes with no promotion step in the failover
path. I would *not* put the whole platform on Spanner; that's the
reflex this question is built to catch, and it's expensive exactly
where the strength buys nothing. Class two is catalogue, pricing and
merchandising — high read volume, low write volume, tolerant of seconds
of staleness. That's a regional relational store with read replicas and
Memorystore in front of it per region; if the team is on PostgreSQL and
wants live analytics over the same transactional rows without standing
up a second pipeline, it's AlloyDB, and if there's no analytical
requirement it's plain Cloud SQL and AlloyDB's premium isn't earned.
Class three is everything derived — sessions, carts, recently-viewed.
Memorystore or Firestore depending on whether the client reads it
directly, all reconstructable, all regional.

The fourth layer is the async spine, and I'd draw it early because
candidates bolt it on. Pub/Sub sits between order placement and
everything downstream — fulfilment, email, analytics, search indexing.
The reason isn't throughput, it's blast radius: if the search indexer
is down, orders should still complete. What's left on the synchronous
path is the shortlist I have to defend in `D2-Q13`.

The thing I'd flag unprompted is sequencing. I would not build three
regions on day one. I'd build the *global* frontend and the split data
layer on day one, because those are the expensive-to-reverse decisions,
and run one serving region until there's a named reason for a second.
Adding a region to a design that already has an anycast edge, a
stateless app tier and externalised state is a week. Retrofitting
statelessness into a platform that grew up single-region is a quarter.

**Architecture**

```
                       Customers (global)
                               │
                               ▼
       ┌──────────────────────────────────────────┐
       │ Cloud Armor policy (WAF, bot, geo, rate)  │ ◄── (1)
       └──────────────────────┬───────────────────┘
                              ▼
       ┌──────────────────────────────────────────┐
       │ Global external Application LB — one      │ ◄── (2)
       │ anycast IP, health-check-driven routing   │
       │   └─ Cloud CDN on cacheable backends      │ ◄── (3)
       └──────────────────────┬───────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
    region A             region B             region C
  ┌────────────┐      ┌────────────┐      ┌────────────┐
  │ Cloud Run  │      │ Cloud Run  │      │ Cloud Run  │ ◄── (4)
  │ stateless  │      │ stateless  │      │ stateless  │
  └─────┬──────┘      └─────┬──────┘      └─────┬──────┘
        ▼                   ▼                   ▼
  Memorystore         Memorystore         Memorystore    ◄── (5)
  (regional, disposable, never the system of record)
        │                   │                   │
        └─────────┬─────────┴─────────┬─────────┘
                  ▼                   ▼
      ┌────────────────────┐ ┌──────────────────────┐
      │ CLASS 1 — ledger    │ │ CLASS 2 — catalogue   │
      │ Spanner multi-region│ │ Cloud SQL / AlloyDB   │
      │ orders + inventory  │ │ regional + replicas   │
      └─────────┬──────────┘ └──────────┬───────────┘
                │  ◄── (6)              │  ◄── (7)
                ▼                       ▼
      ┌─────────────────────────────────────────────┐
      │ Pub/Sub — async spine off the checkout path  │ ◄── (8)
      └──┬──────────┬──────────┬──────────┬─────────┘
         ▼          ▼          ▼          ▼
    fulfilment   search     analytics   email        ◄── (9)
                 index

  Cross-cutting: multi-region Cloud Storage for product media, served
  through the same CDN (10); per-region SLOs evaluated independently
  so one sick region isn't averaged away by two healthy ones (11);
  sequential rollout, lowest-traffic region first, never all at once (12).
```

**Every arrow explained:**

1. **Cloud Armor as the first hop** — a policy attached to the LB's
   backend services, not a separate box, so it costs no extra hop.
   Don't filter abusive traffic in the app tier: you pay to scale the
   app tier for traffic you were always going to reject (`D2-Q09`).
2. **One global anycast frontend** — routes to the nearest *healthy*
   region on health-check evidence. Don't use geo-DNS when you need
   fast failover; it runs minutes behind reality.
3. **Cloud CDN on cacheable backends only** — enabled per backend
   service, so the checkout backend is never accidentally cacheable.
   Don't enable CDN on an authenticated dynamic backend and trust cache
   headers to save you (`D2-Q05`).
4. **Stateless regional app tier** — any instance in any region serves
   any request, which is what makes (2)'s latency routing safe. Don't
   use LB session affinity to work around statefulness; it pins a user
   to one region and restores the failure mode the topology removed.
5. **Regional Memorystore, explicitly disposable** — a cache, never a
   store. Always pair it with a durable backing store; the failure mode
   where it quietly becomes the system of record is discovered during a
   restart, at the worst possible moment.
6. **Spanner scoped to the ledger only** — strongly consistent
   multi-region writes with no promotion step in the failover path.
   Don't use it platform-wide: it earns its premium only where a
   cross-region consistency violation is a financial event.
7. **Regional catalogue store with replicas** — reads scale through
   replicas and cache, writes are low-rate. Don't use read replicas to
   fake global consistency; they're asynchronous, and "see the latest
   write everywhere immediately" is a Spanner requirement.
8. **Pub/Sub between order placement and downstream** — chosen for
   blast radius, not throughput. Don't put a consumer on this spine
   that the checkout response waits on; that's a synchronous dependency
   in an async costume.
9. **Independent downstream consumers** — each can fail, lag or be
   replayed without touching the order path. Don't collapse them into
   one subscriber "for simplicity"; you re-couple four failure domains
   under one retry policy.
10. **Multi-region Cloud Storage for media** — cheapest home for this
    content and it fronts naturally onto the CDN. Don't serve media
    from the app tier; that's compute pricing to move bytes.
11. **Per-region SLOs** — a global average hides a regional outage
    behind two healthy regions. Don't report one blended availability
    number and call it observability.
12. **Sequenced regional rollout** — the LB cannot route around a bug
    that is identical in all three regions, so deployment has to
    respect the boundary the runtime topology created.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Frontend | One global anycast Application LB | Regional LBs plus geo-DNS | Failover is health-check-driven in seconds, not TTL-driven in minutes | When the protocol isn't HTTP and you need the Proxy Network tier, or when residency forbids a shared global frontend for some markets |
| Data layer shape | Split into three consistency classes | One database for the whole platform | Each class gets the guarantee it needs and nothing pays for guarantees it doesn't use | When the team is small enough that operating three data technologies costs more than over-using one — then pick the strictest and accept the cost |
| Ledger store | Spanner multi-region | Regional primary with cross-region replica and promotion | No promotion step means no untested runbook in the failover path | When the business genuinely tolerates a minutes-scale RTO and seconds of RPO on orders — then Active-Passive is materially cheaper and honest |
| App tier | Cloud Run | GKE Autopilot | Peaky retail traffic matches per-request billing and fast horizontal scale | When the org has standardised on Kubernetes primitives, or the workload needs sidecars, operators or a mesh the serverless model can't express |
| Region count at launch | One serving region, global frontend | Three serving regions from day one | The irreversible decisions are the frontend and the data split, not the region count | When a contractual availability number or a launch market list already requires multi-region — then build two, not three, and add the third on evidence |

**Making it concrete**

```hcl
# CDN is a property of a BACKEND SERVICE, not of the load balancer.
# That is precisely why catalogue and checkout can share one anycast
# frontend safely — and why the decision is reviewable in code.
resource "google_compute_backend_service" "catalogue" {
  project         = "PROJECT_ID"
  name            = "bes-catalogue"
  enable_cdn      = true
  cdn_policy { cache_mode = "CACHE_ALL_STATIC", default_ttl = 300 }
  security_policy = google_compute_security_policy.edge.id
}

resource "google_compute_backend_service" "checkout" {
  project         = "PROJECT_ID"
  name            = "bes-checkout"
  enable_cdn      = false   # deliberate; re-reviewed on every change
  security_policy = google_compute_security_policy.edge.id
}
```

**What a weak answer sounds like**

- "Global load balancer, Kubernetes in three regions, Spanner." — every
  noun is defensible and no decision has been made. The follow-up is
  always "why Spanner for the product catalogue," and there's nowhere
  to stand.
- "I'd put everything in Spanner so I don't have to think about
  consistency." — you've bought the strongest guarantee for the ninety
  percent of the platform that never needed it.
- "We'd use DNS to send users to their nearest region." — describes
  routing and quietly gives up on failover, because DNS failover is
  paced by client caches.
- "Cache everything aggressively." — said without naming what is never
  cached, which is the actual content of a caching answer (`D2-Q05`).

**Common wrong turns**

- **Drawing the regions before the data classes.** Region boxes are the
  fun part, so the data layer becomes whatever fits the picture.
  Recover by saying "let me classify the data first, because that
  decides how many regions can actually write."
- **Treating "global" as one requirement.** Latency, availability,
  consistency and residency have different and sometimes conflicting
  answers. Recover by separating them out loud early — it also earns
  you the residency clarifying question.
- **Putting the cache in front of the wrong thing.** A cache in front
  of the ledger is a correctness bug; a cache in front of the catalogue
  is the whole design. Recover by drawing the cache boundary explicitly
  rather than sprinkling caches.
- **Forgetting that deployment is part of availability.** A
  three-region runtime with a simultaneous three-region rollout has one
  failure domain. Recover by adding the rollout sequence to the diagram
  before the panel asks for it.

**Follow-up probes the interviewer asks next**

1. **"You're at three regions. What breaks at twelve?"** — not the
   frontend; anycast and health checks hold. What breaks is the Spanner
   configuration's cost and write latency, the number of caches needing
   warming, and the human cost of a twelve-step rollout. At that point
   I'd stop adding serving regions and ask whether the long-tail
   markets need a region or just a CDN edge — usually the latter.
2. **"A whole region goes dark during a commercial peak. First five
   minutes?"** — the LB drains it on health-check evidence with no
   human involved; Spanner keeps serving writes from the remaining
   regions with no promotion; the dead region's cache contents are gone
   and the survivors take a cold-cache hit, which is the part I'd have
   load-tested in advance.
3. **"Who owns this in two years?"** — one team owns the edge and the
   platform contract, product teams own their backend services behind
   it. If the edge has no owner, the Armor policy and the CDN rules
   become a graveyard of exceptions nobody dares delete.
4. **"What would you cut with eight weeks instead of six months?"** —
   the third region, the non-essential async consumers, and AlloyDB in
   favour of plain Cloud SQL. I would not cut the global frontend, the
   stateless app tier or the ledger/catalogue split, because those
   three can't be retrofitted cheaply.
5. **"A residency rule lands mid-build for one market."** — the edge
   survives, the app tier survives, the pooled data layer does not.
   That market becomes an isolated stack with its own store, and I'd
   resist replicating that shape to markets that don't need it — in
   `design-01`'s tenancy terms this is a promotion from T1 Pooled to T4
   Sovereign for one market, not a platform-wide redesign.

**Cross-references**

- `04-architectures/pattern-multi-region-web-app.md` — the underlying
  pattern and its data-layer decision table; this answer commits to a
  specific split rather than restating it.
- `03-comparisons/02-storage-database-options.md` — the Spanner /
  AlloyDB / Cloud SQL positioning behind callouts (6) and (7).
- `03-comparisons/03-networking-connectivity.md` — the load-balancer
  tier matrix behind callout (2).
- `D2-Q02` for checkout in detail, `D2-Q05` for the cache layers,
  `D2-Q10` for how the write topology is actually decided, `D2-Q15` for
  when this entire answer is too much.

---

### D2-Q02 — "Zoom in on checkout and inventory. Two customers buy the last unit at the same moment, in different regions. What happens?"

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 1.2, 1.3, 6.2 |
| **Axis** | scale |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D2-Q01` |

**What the interviewer is actually testing**

Whether you can hold a consistency argument without retreating into
either "we'd use transactions" or "it's eventually consistent, it's
fine." The real skill is naming what you are prepared to lose. Every
answer here loses something — display accuracy, reservation certainty,
conversion rate, or money — and a Staff+ candidate says which one,
deliberately, and says who signed off on it.

**Clarifying questions to ask before drawing anything**

- **Are these units fungible or serialised?** A thousand identical
  units of a commodity item and one signed collectible are different
  problems. The first tolerates a small oversell with a compensating
  flow; the second cannot oversell by one, ever.
- **What does the business do today when it oversells?** If there's
  already a refund-and-apologise path with a known cost, deliberate
  oversell is a business lever I can design to. If there isn't, I'm
  designing to zero and the cost lands on the data layer.
- **How long is the window between "add to cart" and "pay"?** Thirty
  seconds and three days imply completely different reservation
  semantics, and the three-day one usually means no reservation at all.
- **Does the payment processor guarantee idempotency on retry?** If it
  does, my retry story is simple. If it doesn't, I own deduplication,
  and that's a design element rather than an implementation detail.
- **Is the displayed stock count a promise or a hint?** The single most
  useful question in the room, because most businesses answer "a hint"
  and then act surprised when you design to that.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| No double-charge, ever | Assumed | "I'll treat a duplicate charge as the one unrecoverable failure" | Forces idempotency keys and a single committed ledger write |
| A committed order always decrements stock | Stated | — | Order and inventory must move in one transaction, not two |
| Product-page stock count may be stale | Assumed | "I'll assume the number on the page is a hint — tell me if it's contractual" | Frees the read path to be cached and regional |
| Carts survive a region failure | Assumed | "Carts live outside the app tier, so a lost region is a latency event, not data loss" | Externalised state, per `D2-Q06` |
| Some items are serialised/unique | Assumed | "If any item is one-of-a-kind, zero oversell is the target for that class" | Splits policy by item class instead of one global rule |
| Payment is an external call | Stated | — | Introduces a timeout and an unknown-outcome state that must be modelled |

**The answer, out loud**

The direct answer to the question as asked: one of them wins, the other
is told no before their card is charged, and both saw the same "1 left"
a second earlier. That last part is not a bug I'm going to design away
— it's the thing I'm choosing to lose.

Here's the reasoning. I split this path into three states with
different guarantees: browsing is approximate, reservation is soft, and
commitment is exact. The mistake I want to avoid is applying one
guarantee across all three in either direction. Making browsing exact
is ruinous at read volume; making commitment approximate is how you
charge two people for one item.

Browsing reads a cached, regional, deliberately stale stock figure —
Memorystore in each region with a short time-to-live, refreshed from
the ledger. It can be seconds behind and I'm fine with that, because
the page is not where the promise is made. What I *would* change is the
language: below a threshold, stop showing a number and show "low
stock." That costs nothing, removes most of the perceived-inaccuracy
complaints, and offering it is part of the architect's job here.

Commitment is one transaction in Spanner, and this is where multi-region
strong consistency is genuinely earned. Placing an order and
decrementing inventory are the same write — not two writes with a saga
between them, not a write plus a compensating event. The failure mode I
refuse to accept is a committed order with no stock movement, and a
saga makes that state reachable during any partition. If this
requirement weren't here I'd have said a regional store was enough, and
`D2-Q01` would have had a cheaper data layer.

Reservation is where the interesting choice lives. Between "buy" and
"paid" there's an external payment call that can take seconds and can
end in an unknown state. I'd take a *soft reservation* with an expiry —
a row that decrements available stock and carries a timeout, written in
the same transaction that creates the pending order. If payment
succeeds, the reservation converts; if it fails or times out, a sweeper
releases it. The cost is real: abandoned checkouts hold stock for the
reservation window, so under contention I'm showing less availability
than physically exists. I'd keep that window short, measure abandonment,
and say out loud that a two-minute hold on a hot item is a deliberate
conversion tax paid for correctness.

Idempotency is the other half. The client generates a key per checkout
attempt, it travels with the order write and with the payment call, and
the ledger enforces uniqueness on it. That one mechanism covers the
retry storm, the double-click, the mobile app that resends on network
flap, and the unknown-outcome payment timeout. Without it every retry
path in the system is a potential duplicate charge — and retries are
the one thing you can guarantee will happen at scale.

Now the part I'd volunteer, because it separates a Staff answer from a
Staff+ one. Zero oversell is not always the right target. For fungible
stock with a replenishment pipeline, a small deliberate oversell buffer
with an automatic compensating flow can be worth more than the
conversion lost to strict reservation holds. That's a business decision
with a real number attached, and I'd bring it to the business rather
than making it silently in the data layer. For serialised or unique
items the buffer is zero and there's no conversation. So the policy is
per item class, configured, and visible — not a constant buried in a
service.

What I'd accept losing, plainly: display accuracy on the product page,
some conversion on hot items during the reservation window, and
read-your-writes on any surface other than the order confirmation. What
I won't lose: a duplicate charge, a committed order without stock
movement, and a customer who paid and has no order.

**Architecture**

```
  STATE 1 — BROWSE (approximate, regional, cached)
  ┌─────────────────────────────────────────────────┐
  │ product page ← Memorystore (short TTL)           │ ◄── (1)
  │ below threshold: show "low stock", not a number  │ ◄── (2)
  └──────────────────────┬──────────────────────────┘
                         │  customer clicks BUY
                         ▼
  STATE 2 — RESERVE (soft, expiring, exact at write time)
  ┌─────────────────────────────────────────────────┐
  │ ONE Spanner transaction:                         │
  │   • insert order  status = PENDING               │
  │   • decrement available, write reservation + TTL │ ◄── (3)
  │   • enforce UNIQUE(idempotency_key)              │ ◄── (4)
  └──────────────────────┬──────────────────────────┘
                         │  same key travels onward
                         ▼
  ┌─────────────────────────────────────────────────┐
  │ external payment processor call                  │ ◄── (5)
  │   success │ failure │ TIMEOUT = unknown outcome   │
  └────┬──────────┬──────────────┬──────────────────┘
       ▼          ▼              ▼
  STATE 3 — COMMIT / RELEASE / RECONCILE
  ┌─────────────┐ ┌──────────────┐ ┌────────────────┐
  │ order = PAID│ │ release res. │ │ reconcile via  │
  │ res. → firm │ │ restore stock│ │ processor query│ ◄── (6)
  └──────┬──────┘ └──────────────┘ └────────────────┘
         ▼
  ┌─────────────────────────────────────────────────┐
  │ Pub/Sub → fulfilment, email, analytics, and the  │ ◄── (7)
  │ refresh of the browse cache                      │
  └─────────────────────────────────────────────────┘

  Sweeper expires stale PENDING reservations on a timer and returns
  stock to available                                     ◄── (8)

  Cross-cutting: oversell target is per item class, configured, not a
  global constant (9); the browse cache is refreshed FROM the ledger
  and never written directly by the app tier (10); every retry path in
  the system carries the same idempotency key (11).
```

**Every arrow explained:**

1. **Cached regional stock for browsing** — read volume here is orders
   of magnitude above write volume, and the page isn't where the
   promise is made. Don't read the ledger on every product view; you're
   paying strong-consistency prices for a number that's stale on
   arrival anyway.
2. **"Low stock" instead of a number** — removes the perceived-accuracy
   problem with no engineering. Don't display a precise count you can't
   honour; the count is what customers quote back to support.
3. **Order and decrement in one transaction** — makes "order exists,
   stock never moved" unreachable. Don't split this into a saga unless
   the two sides genuinely live in systems you don't control; a saga
   here buys distribution you don't need and an inconsistent window you
   can't explain to finance.
4. **Uniqueness on the idempotency key, in the ledger** — not in a
   cache and not in the app tier, because both lose the race under
   exactly the conditions that produce duplicates. Don't dedupe in
   Memorystore; an eviction becomes a double charge.
5. **The payment call has three outcomes, not two** — timeout is its
   own state and the design must name it. Don't treat a timeout as a
   failure and release the reservation; you may have charged them.
6. **Reconcile by querying the processor with the same key** — resolve
   the unknown state with the authority that knows. Don't resolve it by
   retrying the charge.
7. **Downstream work on Pub/Sub, including cache refresh** — makes
   cache freshness an event rather than a poll. Don't make fulfilment
   synchronous to the confirmation page.
8. **Expiry sweeper** — the TTL is only real if something enforces it.
   Don't rely on the customer's session ending; sessions don't end,
   they get abandoned.
9. **Per-class oversell policy** — fungible stock can carry a
   deliberate buffer, serialised stock cannot. Don't make this one
   global constant; one number can't be right for both classes.
10. **Cache refreshed from the ledger, never by the app tier** — one
    writer keeps the invalidation story explainable. Don't let checkout
    poke the cache; you get two sources of truth that disagree under
    load.
11. **One idempotency key across every hop** — the key identifies the
    *attempt*, not the request. Don't generate a fresh key on retry;
    that's the bug the whole mechanism exists to prevent.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Order + inventory write | One transaction in a globally consistent store | Saga with compensating transactions | Removes "order without stock movement" from the reachable state space | When order and inventory genuinely live in systems you don't control — then a saga is honest, and you staff the reconciliation it demands |
| Reservation model | Soft reservation with a short expiry | No reservation; check stock at payment success | Prevents charging a customer for stock that vanished during payment | When the checkout window is very long (quotes, B2B orders) — holding stock for days is worse than occasionally declining at the end |
| Browse accuracy | Deliberately stale, cached, regional | Strongly consistent read on every product view | Read volume is where the money goes; exactness there buys nothing | When the stock level is contractual — regulated allocations, ticketed seats — then the read path pays the consistency cost too |
| Oversell target | Per item class, with a compensating flow for fungible stock | Zero oversell everywhere | Strict holds on fungible stock cost more conversion than the oversell costs in refunds | When every item is unique, or the compensating experience is unacceptable to the brand — then zero everywhere, and accept the conversion cost |
| Duplicate prevention | Idempotency key unique-constrained in the ledger | Deduplicate at the gateway or in cache | Survives retries, evictions, restarts and partitions, because it lives where the commit lives | When there is no ledger write at all (pure read paths) — then gateway-level dedupe is the right and cheaper layer |

**What a weak answer sounds like**

- "We'd use a distributed transaction across services." — the panel
  asks which services and what happens during a partition, and the
  answer collapses. This is one transaction in one store, not one
  transaction across many.
- "Eventual consistency is fine, we'd reconcile later." — fine for the
  search index; not for the thing the customer's money moved through.
- "We'd lock the row." — said without naming the lock's duration or
  what happens when the payment call hangs inside it, which is exactly
  where this design fails.
- "Oversell can't happen if we use strong consistency." — conflates the
  database guarantee with the business outcome. Oversell also arrives
  through returns, damage, warehouse miscounts and reservations that
  never expired.

**Common wrong turns**

- **Designing the happy path and stopping.** The interesting content is
  entirely in the timeout and retry paths. Recover by drawing the three
  payment outcomes before anyone asks.
- **Treating oversell as purely technical.** It's a business policy with
  a cost curve, and an architect who never surfaces that is making the
  call silently. Recover by asking what the current refund cost is.
- **Putting the idempotency check in the wrong layer.** Cache and
  gateway both feel natural and both lose the race. Recover by moving
  the constraint next to the commit and saying why.
- **Forgetting that reservations leak.** Every soft-reservation design
  needs a sweeper, and the sweeper is the component that quietly never
  gets built. Recover by naming it as a first-class component with its
  own monitoring, not as a cron job.

**Follow-up probes the interviewer asks next**

1. **"Now it's a flash sale — ten thousand people, a hundred units, one
   second."** — the contention is a single hot row and no consistency
   model makes that fast. I'd move the contest out of the ledger: admit
   a bounded number of attempts through a token gate at the edge and
   let only those reach the transaction. Everyone else gets a fast,
   honest "sold out" instead of a slow timeout. That's `D2-Q09`'s
   machinery applied to a correctness problem.
2. **"Escalate it: blast radius if the ledger is unavailable for ten
   minutes?"** — browsing continues from cache, carts continue, and
   checkout fails cleanly. I'd make that failure explicit and fast
   rather than letting requests queue, because a slow failure converts
   a checkout outage into a site-wide one as connections pile up.
3. **"Who owns this in two years?"** — the payments-and-orders team
   owns the ledger schema and the idempotency contract, and it needs to
   be a team rather than a service with a former owner. The specific
   risk is that the reservation TTL and the oversell buffer are
   business parameters that drift without an owner who knows why they
   were set.
4. **"How do you test this?"** — by injecting the nasty states in
   pre-production: payment timeouts, duplicate submissions, a sweeper
   running behind, a partition during commit. A load test that only
   ramps traffic reaches none of them.
5. **"Would you use this design for a marketplace with third-party
   sellers?"** — no. Stock then lives in systems I don't control, the
   single-transaction guarantee is unavailable, and it genuinely
   becomes a saga with reconciliation and seller-facing SLAs. Naming
   that the design changes when authority moves outside my boundary is
   the point of the question.

**Cross-references**

- `03-comparisons/02-storage-database-options.md` — the Spanner
  positioning; the "must never double-sell" signal is this path
  specifically, not the whole platform.
- `04-architectures/pattern-multi-region-web-app.md` — its worked
  retailer example makes the same split; this answer extends it into
  the reservation and idempotency mechanics.
- `D2-Q01` for the platform this sits inside, `D2-Q05` for the browse
  cache's invalidation, `D2-Q09` for gating a flash sale, `D2-Q10` for
  why this slice forces the write topology.

---

### D2-Q03 — "We're launching a multiplayer game globally. We have no idea if we'll get ten thousand players or ten million on day one. Design the backend."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 1.3, 6.2 |
| **Axis** | scale |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D2-Q01` |

**What the interviewer is actually testing**

Whether you know that autoscaling does not solve a launch. Scaling is a
feedback loop and a launch spike outruns the loop, so the real answers
are headroom, quota, admission control and graceful degradation — none
of which appear on the architecture diagram most candidates draw. The
second thing being tested is whether you split the backend by
statefulness instead of treating "the game" as one workload.

**Clarifying questions to ask before drawing anything**

- **Is the gameplay session stateful and long-lived, or request/
  response?** A persistent match process with per-match memory is a
  completely different compute answer from a turn-based API, and the
  whole design hangs on this fork.
- **What protocol does the client speak?** Custom UDP or raw TCP rules
  out the HTTP-aware load-balancing tier for that path, and candidates
  routinely miss it.
- **What's the latency budget for an in-match action?** That number
  decides how many regions the session tier must exist in, and it's the
  only honest way to pick a region list.
- **Can we gate entry?** A queue in front of the lobby is the difference
  between a slow launch and a failed one, and it's a product decision I
  need made before launch day, not during it.
- **What's the marketing plan?** A simultaneous global release and a
  staggered regional release are different capacity problems, and the
  staggered one is dramatically cheaper to survive.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Launch volume unknown within two orders of magnitude | Stated | — | Rules out any capacity plan that assumes a ceiling |
| In-match latency is the core experience | Assumed | "I'll assume players must be served from a nearby region during a match" | Forces regional session placement |
| Accounts and progression are global and consistent | Assumed | "One account, one balance, wherever they log in" | Spanner for the account and entitlement store |
| Leaderboard may be lossy on restart | Assumed | "I'll treat the leaderboard as a cache over a durable score record" | Memorystore in front of a durable store |
| Small team, no large SRE organisation | Assumed | "Ops burden is a first-class constraint, not an afterthought" | Biases every tier toward the managed option |
| Cost must fall after the launch window | Stated | — | Headroom is temporary and must be explicitly unwound |

**The answer, out loud**

I'd start by refusing to treat this as one backend. There are three
planes here with different statefulness, different protocols and
different scaling behaviour, and mixing them is what makes launches
fail.

The session plane holds live matches. If matches are long-lived
processes with per-match memory — which for most multiplayer titles
they are — this is the one genuinely stateful tier, and that rules out
the serverless container model. I'd run it on GKE Standard with
node-level control, because I need specific machine shapes, control
over pod placement, and the ability to drain a node without killing
matches mid-play. That's a deliberate acceptance of more operations
burden for a small team, and I'd say so: it's the one place where the
workload's shape overrides the "prefer the most managed option"
default. If the client speaks a custom non-HTTP protocol, the front
door for this plane is the global external Proxy Network Load Balancer
rather than the Application tier — which means no Cloud CDN and no L7
Armor rules on that path. I'd rather state that limitation than draw an
Application LB in front of a UDP protocol and hope nobody notices.

The API plane is everything else the client talks to: login, lobby,
matchmaking requests, store, inventory, telemetry submission. It's
stateless HTTP, it's the spikiest thing in the system, and it goes on
Cloud Run behind the global external Application LB with Cloud Armor.
Cloud Run is right here specifically because of the spike: per-request
billing and fast horizontal scaling are what an unknown launch volume
wants. I would not fold this plane into the session cluster just to
have one cluster; that couples the scaling behaviour of the spikiest
tier to the most latency-sensitive one, which is the coupling I'm
trying to avoid.

The state plane splits again. Accounts, entitlements and currency go in
Spanner, because a player logging in from a different region must see
one balance and a duplicate purchase is a support incident. Progression
and match history are higher-volume and more forgiving; if the access
pattern is key-based and time-series-shaped that's Bigtable, with a row
key designed against hotspotting rather than the obvious
timestamp-prefixed key. The leaderboard is Memorystore in front of a
durable score record — explicitly a cache, rebuilt if lost, never the
system of record.

Now the part that actually decides whether launch day works, and it's
not on the diagram yet. First, quota. Regional CPU quota, load balancer
quota, Spanner capacity, Pub/Sub throughput — those are the real
ceilings, and they're raised through a request process with a lead
time, not an API call at 3am. I'd have the increases in place weeks
ahead, sized for the optimistic case, as a launch-blocking checklist
item.

Second, headroom. Minimum instances above zero on every
latency-critical Cloud Run service and a warm pool of session nodes,
because scaling from zero is exactly the wrong behaviour under a launch
curve. That's deliberately wasteful, it's temporary, and the plan to
unwind it has a date on it — otherwise launch headroom becomes the
permanent cost base, which is the failure mode *after* a successful
launch.

Third, admission control, and this is the one I'd push hardest on with
the product team. A login queue that admits players at a controlled
rate is not a failure — it converts "the game is broken" into "there's
a wait." Without it, overload becomes retry storms from clients that
all reconnect together, and the system never recovers on its own. Build
it before launch, test it, and hope not to use it.

Fourth, degradation order, decided in advance. If we're over capacity,
what turns off first? My order: cosmetic and social features, then
leaderboard freshness, then matchmaking quality — worse matches rather
than no matches — and last, never, actual gameplay and account
integrity. Writing that list down before launch is what stops it being
improvised by whoever happens to be awake.

**Architecture**

```
   players (global, unknown volume)
        │                    │
        │ HTTP               │ game protocol (may be non-HTTP)
        ▼                    ▼
  ┌──────────────┐   ┌────────────────────┐
  │ Cloud Armor +│   │ Global external     │ ◄── (2)
  │ global ext.  │   │ Proxy Network LB    │
  │ App LB       │   │ (no CDN, no L7 WAF) │
  └──────┬───────┘   └──────────┬─────────┘
    ◄── (1)                     │
         ▼                      ▼
  ┌──────────────┐     ┌────────────────────┐
  │ API PLANE    │     │ SESSION PLANE       │
  │ Cloud Run    │     │ GKE Standard,        │
  │ stateless,   │◄─(3)│ stateful matches,    │ ◄── (4)
  │ min-inst > 0 │     │ warm pool, drain-    │
  │ at launch    │     │ aware upgrades       │
  └──────┬───────┘     └──────────┬─────────┘
         │                        │
         └───────────┬────────────┘
                     ▼
  ┌──────────────────────────────────────────────┐
  │ STATE PLANE                                   │
  │  Spanner     — accounts, entitlements, wallet │ ◄── (5)
  │  Bigtable    — progression, match history     │ ◄── (6)
  │  Memorystore — leaderboard cache over a       │ ◄── (7)
  │                durable score record           │
  └──────────────────────────────────────────────┘

  LAUNCH CONTROLS — the part that decides whether this works
  ┌──────────────────────────────────────────────┐
  │ a. quota raised weeks ahead, sized optimistic │ ◄── (8)
  │ b. warm headroom, with an unwind DATE         │ ◄── (9)
  │ c. admission queue in front of login          │ ◄── (10)
  │ d. degradation order written down BEFORE      │ ◄── (11)
  │    launch: cosmetics → leaderboard freshness  │
  │    → match quality → (never) gameplay         │
  └──────────────────────────────────────────────┘

  Cross-cutting: telemetry leaves the hot path via Pub/Sub so an
  analytics backlog can never slow a match (12); staggered regional
  release where marketing allows, converting one unbounded spike into
  three bounded ones (13).
```

**Every arrow explained:**

1. **Application LB plus Armor for the API plane** — HTTP-aware
   routing, WAF and rate limiting all live here. Don't put the game
   protocol behind this tier if it isn't HTTP; it can't carry it.
2. **Proxy Network LB for a non-HTTP game protocol** — global reach and
   automatic cross-region failover without HTTP semantics. Don't expect
   CDN or L7 Armor rules here; if you need those, the traffic has to be
   HTTP.
3. **Minimum instances above zero at launch** — scale-to-zero is the
   wrong default when the first request of the day is a spike. Don't
   leave it set afterwards; that's the trap in callout (9).
4. **Session plane on GKE Standard** — node control, placement control,
   drain-aware upgrades for long-lived matches. Don't use a serverless
   container runtime for stateful long-lived sessions; the request
   model can't express a match that outlives a request.
5. **Spanner for accounts and wallet** — one balance globally, no
   duplicate purchases. Don't put progression telemetry here; it's
   high-volume and doesn't need this guarantee.
6. **Bigtable for progression and match history** — key-based,
   time-series-shaped, high write throughput. Don't use a monotonic
   timestamp row key; the whole fleet writes the same range and you
   build a hotspot on purpose.
7. **Memorystore leaderboard over a durable record** — sub-millisecond
   reads, rebuilt if lost. Don't treat it as the score of record; a
   restart would delete the thing players care most about.
8. **Quota raised in advance** — the real ceiling is administrative and
   has a lead time. Don't discover it during the spike, when the
   request queue is the slowest thing in your system.
9. **Warm headroom with an unwind date** — deliberate waste, bounded in
   time. Don't leave it permanent; a successful launch that never
   unwinds sets the cost base wrong for years.
10. **Admission queue in front of login** — converts overload into a
    wait instead of a retry storm. Don't rely on clients backing off
    politely; they reconnect together, which is the second spike.
11. **Degradation order decided in advance** — a design artefact, not
    an incident improvisation. Don't leave "what do we turn off" to
    whoever is on call at launch hour.
12. **Telemetry off the hot path via Pub/Sub** — an analytics backlog
    must never be able to slow a match. Don't write telemetry
    synchronously from the session tier.
13. **Staggered regional release where marketing allows** — three
    bounded spikes are survivable in a way one unbounded spike isn't.
    Don't assume it's available; it's a commercial decision to ask for
    early.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Session tier compute | GKE Standard | Cloud Run or GKE Autopilot | Long-lived stateful matches need node control and drain-aware upgrades | When matches are short and genuinely request/response — then Cloud Run is simpler and far cheaper to operate for a small team |
| Splitting API from session | Two separate planes | One cluster running everything | Decouples the spikiest tier from the most latency-sensitive one | When the team is tiny and the title small enough that one cluster's operational simplicity outweighs the coupling risk |
| Launch capacity | Warm headroom plus raised quota | Trust autoscaling | Autoscaling is a feedback loop and a launch curve outruns it | When traffic ramps over days rather than minutes — a soft launch genuinely can be autoscaled into |
| Overload behaviour | Admission queue | Let the system shed naturally | A queue degrades predictably; natural shedding produces synchronised client retries | When the client already has good jittered backoff and the product can't show a queue for brand reasons — then invest in the client instead |
| Account store | Spanner | Regional store with replicas | One wallet globally, no duplicate purchase during failover | When players are region-locked by design and accounts never move — then a regional store is honest and much cheaper |
| Leaderboard | Memorystore cache over a durable record | Query the durable store directly | Read rate is enormous and the data is reconstructable | When the leaderboard is contractual — esports prize standings — then read from the durable record and accept the latency |

**Making it concrete**

```bash
# The launch item that isn't architecture and decides the launch
# anyway. Quota raises have a lead time; run this weeks early.
gcloud compute project-info describe --project PROJECT_ID \
  --format="table(quotas.metric, quotas.limit, quotas.usage)"

# Warm headroom on the spikiest latency-critical service, with the
# unwind written into the description so the next engineer knows it
# was always meant to be temporary.
gcloud run services update api-lobby \
  --project PROJECT_ID --region REGION --min-instances=40 \
  --description="launch headroom; unwind to 2 after launch window"
```

**What a weak answer sounds like**

- "It autoscales, so any volume is fine." — autoscaling reacts to load
  that has already arrived; the launch curve is the one case where that
  lag is the entire problem.
- "We'd run everything on Kubernetes." — possible, but it couples the
  spiky stateless tier to the stateful latency-critical one and hands a
  small team the hardest version of both problems.
- "We'll add capacity if we need it." — capacity is bounded by quota
  with a lead time and by warm pool size, neither acquirable during the
  spike.
- "A queue would look bad, so we won't have one." — the alternative
  isn't no queue, it's an unmanaged one made of client retries, which
  looks considerably worse.

**Common wrong turns**

- **Designing for the optimistic number only.** Ten million is the fun
  case; ten thousand with a permanent headroom bill is the one that
  kills small studios. Recover by attaching an unwind date to every
  piece of headroom as you draw it.
- **Putting the game protocol behind the wrong LB tier.** It's an easy
  reflex because the Application LB is the one everyone draws. Recover
  by asking the protocol question early and splitting the front door.
- **Leaving degradation to incident time.** Everyone agrees there should
  be a degradation order and nobody writes it down. Recover by making
  it a numbered list on the whiteboard.
- **Treating telemetry as free.** At launch volume the telemetry path
  can fall over and take the session tier with it. Recover by moving it
  behind Pub/Sub explicitly.

**Follow-up probes the interviewer asks next**

1. **"It's ten million, not ten thousand. What breaks first?"** — quota,
   before anything technical. After that, matchmaking, because it's the
   one intrinsically global and coordinating component; everything else
   shards cleanly by region or player. I'd degrade match quality before
   match availability.
2. **"Escalate: one region's session tier fails mid-match."** — those
   matches are lost and I won't pretend otherwise; long-lived in-memory
   match state doesn't survive. What must survive is the account, the
   wallet and progression to the last checkpoint, which is exactly why
   those live in the state plane rather than in the match process.
   Players get reconnected into new matches in a healthy region.
3. **"Who owns this in two years?"** — the live-ops team, which will not
   be the launch team. The handover risk is the launch controls: quota
   headroom, min-instance settings and the queue's thresholds are all
   launch-shaped parameters needing an owner who knows they were meant
   to be temporary.
4. **"When do you unwind the headroom?"** — on a measured
   scaling-latency number, not a calendar date alone. If the autoscaler
   reaches steady-state demand within the latency budget's tolerance,
   headroom comes down in steps with the queue still in place as the
   safety net.
5. **"The game is a hit and you need a fourth region."** — a week for
   the API and session planes, because they're regional and
   stateless-per-match, and a real decision for the state plane:
   extending the Spanner configuration is a cost and write-latency
   change, not a copy. Regions are cheap until the globally consistent
   store is involved.
6. **"What changes for a turn-based mobile game?"** — drop the session
   plane entirely and let the API plane carry it, drop GKE, and move
   progression to Firestore for its offline behaviour (`D2-Q14`). The
   launch controls stay identical, because those are about the spike,
   not the genre.

**Cross-references**

- `04-architectures/case-study-mountkirk-games.md` — the named case
  study with this shape; use its stated constraints rather than these
  generic ones when a panel is quoting it.
- `03-comparisons/01-compute-options.md` — Tree 1's compute selection
  and the stateful-workload row behind callout (4).
- `03-comparisons/03-networking-connectivity.md` — the Application-vs-
  Proxy Network LB distinction behind callouts (1) and (2).
- `D2-Q08` for a spike with a known date, `D2-Q09` for the admission
  and abuse layer, `D2-Q17` for sharing a platform with batch work.

---

### D2-Q04 — "Live video, global audience, events happening on three continents. Design the ingest and the distribution."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 1.3, 1.2 |
| **Axis** | scale |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D2-Q01` |

**What the interviewer is actually testing**

Whether you understand that latency and scale are opposed in video
delivery. Every second you shave off glass-to-glass latency costs you
cacheability, and cacheability is the only reason a stream can serve
millions of viewers at all. Candidates who treat "low latency" as a
free adjective get taken apart here. The second test is whether you
separate contribution from distribution — they have opposite traffic
shapes and nearly nothing in common.

**Clarifying questions to ask before drawing anything**

- **What is the latency requirement actually for?** Sub-second matters
  if viewers are interacting live — betting, chat that references the
  action, second-screen stats. If they're just watching, single-digit
  seconds is invisible and buys enormous cacheability.
- **Are the venues permanent or per-event?** A permanent venue can
  justify a durable, provisioned circuit. A tent at a racetrack for one
  weekend cannot, and that single fact eliminates the connectivity
  option most people reach for first.
- **How many concurrent viewers at peak, and how concentrated?** A
  million viewers in one country and a million spread over forty are
  different distribution problems even though the number matches.
- **Is there a recording and archive obligation?** If yes, the origin
  becomes a durable store rather than a buffer, and that changes the
  packaging design rather than being bolted on later.
- **What happens if we lose the feed for ten seconds?** The answer
  ranges from "nobody notices" to "contractual penalty," and it decides
  whether I build one contribution path or two independent ones.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Events at temporary venues on several continents | Stated | — | Rules out provisioned physical circuits; transport is over the public internet, encrypted |
| Global viewership, heavily concentrated in event windows | Stated | — | Everything between events must cost near-nothing |
| Main broadcast tolerates a few seconds of latency | Assumed | "I'll assume the broadcast itself is not interactive — tell me if betting or live chat is in scope" | Lets the main path stay segmented and cacheable |
| A small interactive surface needs near-real-time | Assumed | "If there's a second-screen interactive product, it gets its own, smaller, expensive path" | Prevents one latency target being applied to everything |
| Feed loss is visible and costly | Assumed | "I'll assume contribution redundancy is worth paying for; distribution redundancy comes free with the CDN" | Two independent uplinks from the venue |
| Archive retained after the event | Assumed | "I'll assume highlights and replays are a product" | Origin is durable object storage, not a ring buffer |

**The answer, out loud**

I'd draw two systems, because contribution and distribution have
almost nothing in common. Contribution is a handful of very
high-value, very fragile streams from places with bad networks.
Distribution is millions of identical reads of the same bytes. The
mistake is designing one pipeline and letting the venue's constraints
leak into the viewer's experience or vice versa.

Contribution first. Venues are temporary, so a provisioned physical
circuit is off the table — the lead time alone kills it, and there's no
durable site to terminate it at. What I'd use is encrypted transport
over the public internet from the production truck into the *nearest*
Google Cloud region, with two independent uplinks from different
carriers, bonded at the encoder so a single path failure degrades
bitrate rather than dropping the feed. I'd make the ingest endpoint
regional and close to the venue rather than routing every venue to one
"main" region, because the first hop is the least reliable part of the
whole chain and I want it as short as possible. This is also the place
I'd disagree with a common instinct: the latency and reliability
language in a brief like this sounds like it demands a dedicated
circuit, and the *temporariness* of the venue is what actually rules
it out. Saying that out loud is most of the answer.

At the ingest region the stream is transcoded into a bitrate ladder and
packaged into segments. This is genuinely bursty, event-shaped compute
— near-zero between events, heavy during them — so it wants to scale
hard and then go away. The packaged segments land in a multi-region
Cloud Storage bucket that acts as the origin, which also gives me the
archive for free rather than as a separate pipeline.

Distribution is where scale lives, and it is entirely a caching
problem. Segments go out through Cloud CDN behind the global external
Application Load Balancer, with Cloud Armor on the same backend
services for the abuse and token-validation layer. The reason this
scales to millions is that every viewer in a region asks for the same
segment file, so the origin serves it once and the edge serves it a
million times. That property is fragile, and protecting it is the
actual design work: identical URLs for identical content, no per-user
query parameters in the path, no personalisation baked into the media
URL. If I let an analytics team append a viewer ID to segment requests,
I have just turned a cache hit rate near total into near zero and the
origin falls over. I'd put that in writing as a platform rule.

Now the latency conversation, which is the one worth having. There are
three delivery regimes and they cost very different amounts. Standard
segmented delivery with longer segments is the cheapest and most
cacheable and lands tens of seconds behind live. Low-latency segmented
delivery — shorter segments, chunked transfer — lands in the low single
digits of seconds and keeps most of the cacheability. Genuine
sub-second delivery uses a real-time transport, holds per-viewer
connections, and cannot be cached in the same way at all, so its cost
scales with viewers rather than with content. My commitment: the main
broadcast gets low-latency segmented delivery, because that's where the
millions are and the cacheability is worth more than the extra seconds.
Any interactive surface that genuinely needs sub-second gets its own
small real-time path, sized for the far smaller audience that pays for
it. What I won't do is apply the sub-second target to the whole
audience because one product surface asked for it — that's how a
streaming platform's costs become unrecoverable.

Telemetry from the venue — timing, positions, sensor data — I'd keep
entirely separate from the video path, ingested through Pub/Sub and
processed independently. It shares a deadline with the video but not a
pipeline, and coupling them means a backlog in analytics can stall the
broadcast.

Between events, everything scales to near zero except the origin
storage and the archive. That's the cost shape the business actually
needs, and it's the reason I'd resist any design element that requires
standing capacity to exist on a Tuesday when there's no race.

**Architecture**

```
  CONTRIBUTION — few streams, fragile networks, temporary venues
  venue A                venue B                venue C
  ┌────────────┐         ┌────────────┐         ┌────────────┐
  │ encoder,   │         │ encoder,   │         │ encoder,   │
  │ 2 carriers │ ◄── (1) │ 2 carriers │         │ 2 carriers │
  │ bonded     │         │ bonded     │         │ bonded     │
  └─────┬──────┘         └─────┬──────┘         └─────┬──────┘
        │ encrypted over the public internet          │
        ▼                      ▼                      ▼
   nearest region         nearest region         nearest region  ◄── (2)
  ┌──────────────────────────────────────────────────────────┐
  │ INGEST + TRANSCODE + PACKAGE (bursty, event-shaped)       │ ◄── (3)
  │   bitrate ladder → segments → manifests                   │
  └───────────────────────────┬──────────────────────────────┘
                              ▼
  ┌──────────────────────────────────────────────────────────┐
  │ ORIGIN — multi-region Cloud Storage; also the archive      │ ◄── (4)
  └───────────────────────────┬──────────────────────────────┘
                              ▼
  DISTRIBUTION — millions of identical reads of the same bytes
  ┌──────────────────────────────────────────────────────────┐
  │ Cloud Armor (token validation, geo, abuse)                 │ ◄── (5)
  │ Global external Application LB + Cloud CDN                 │ ◄── (6)
  │   segment URLs are IDENTICAL for identical content         │ ◄── (7)
  └──────┬────────────────────────────────┬──────────────────┘
         ▼                                ▼
  MAIN BROADCAST                    INTERACTIVE SURFACE
  low-latency segmented,            real-time transport,
  seconds behind live,              sub-second, per-viewer
  cacheable → millions       ◄──(8) connections, NOT cacheable  ◄── (9)

  Cross-cutting: venue telemetry rides Pub/Sub, never the video
  pipeline, so an analytics backlog can't stall the broadcast (10);
  everything except origin storage scales to near zero between
  events, which is the cost shape the business actually needs (11).
```

**Every arrow explained:**

1. **Two carriers bonded at the encoder** — a single path failure
   degrades bitrate instead of dropping the feed. Don't rely on one
   uplink because the venue "has good internet"; venue networks are the
   least reliable link in the chain and you get one take.
2. **Ingest at the nearest region, not a central one** — shortens the
   least reliable hop. Don't backhaul every venue to one home region
   for operational tidiness; you've made every event depend on one
   long, unmanaged internet path.
3. **Bursty transcode and packaging** — scales hard during events and
   vanishes between them. Don't provision standing transcode capacity
   for peak; the between-events cost is the dominant one over a season.
4. **Multi-region object storage as origin and archive** — one artefact
   serves live delivery and replay. Don't build a separate archive
   pipeline; you'll end up with two copies that disagree.
5. **Cloud Armor for entitlement-token validation and geo rules** —
   rejects unauthorised viewers at the edge. Don't validate entitlement
   at the origin; you're then paying origin egress for every request you
   intended to refuse.
6. **Cloud CDN behind the global Application LB** — the component that
   makes millions of viewers arithmetically possible. Don't treat the
   CDN as an optimisation here; it's the load-bearing element, and the
   origin is sized on the assumption it's working.
7. **Identical URLs for identical content** — the property that
   produces the cache hit rate. Don't allow per-viewer query parameters
   on media paths for analytics convenience; that single change
   collapses the hit rate and the origin with it.
8. **Main broadcast on low-latency segmented delivery** — a few seconds
   behind live, still cacheable, serves the whole audience. Don't push
   this path to sub-second for everyone; you'd trade the cacheability
   that makes the scale affordable.
9. **A separate real-time path for the interactive surface only** —
   per-viewer connections, cost scaling with audience. Don't put the
   main broadcast on it, and don't pretend it's cacheable.
10. **Telemetry on Pub/Sub, separate from video** — same deadline,
    different pipeline. Don't multiplex sensor data into the media
    path; a slow consumer then becomes a broadcast problem.
11. **Scale to near zero between events** — the architecture's cost
    shape must match the business's revenue shape. Don't leave
    event-sized capacity running between events because it's simpler.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Venue connectivity | Encrypted transport over the public internet, two carriers | A provisioned dedicated circuit to each venue | Venues are temporary; provisioning lead time exceeds the event's existence | When a venue is permanent and hosts events all season — then a provisioned circuit with a VPN failover path is better on both latency and predictability |
| Ingest placement | Nearest region per venue | One central ingest region | Shortens the least reliable hop in the chain | When production genuinely requires all feeds co-located for switching and mixing — then accept the long path and make it redundant |
| Main delivery latency | Low-latency segmented | Sub-second real-time for everyone | Keeps the cacheability that makes millions of viewers affordable | When the entire product is interactive — live auctions, live betting — and there is no passive audience to optimise for |
| Origin | Multi-region object storage doubling as archive | A dedicated streaming origin plus a separate archive pipeline | One artefact, one source of truth, replay is free | When the packaging format for live and for archive genuinely differ — then two pipelines are honest, and you own keeping them consistent |
| Entitlement enforcement | At the edge, in the Armor policy | In the application, at the origin | You stop paying for traffic you intended to refuse | When entitlement depends on live per-user state the edge cannot see — then validate at origin and accept the cost |

**What a weak answer sounds like**

- "We'd use a dedicated circuit from each venue for the lowest
  latency." — ignores that a venue existing for one weekend cannot be
  provisioned that way, which is the actual constraint in the brief.
- "Sub-second latency everywhere." — states a target without its price,
  and the price is the cacheability the whole distribution design rests
  on.
- "Put a CDN in front of it." — true and insufficient. The design work
  is in what makes the CDN effective, which is URL identity and
  cacheable segment shapes.
- "We'd scale the origin to handle peak viewers." — if the origin sees
  peak viewer load, the cache design has already failed and no amount
  of origin capacity fixes it.

**Common wrong turns**

- **Designing distribution first.** It's the impressive half, so people
  start there and the contribution path gets two minutes at the end —
  even though contribution is where the single points of failure are.
  Recover by drawing contribution first and saying why.
- **Letting analytics into the media URL.** It always arrives as a
  small, reasonable request. Recover by making URL identity an explicit
  platform rule with a named owner.
- **Applying one latency target to the whole product.** One interactive
  surface asks for sub-second and the whole platform inherits it.
  Recover by splitting the paths and sizing each to its own audience.
- **Forgetting the between-events cost.** A design that only makes
  sense on event day is a design that loses money for the other
  three-hundred-odd days. Recover by walking the idle state explicitly.

**Follow-up probes the interviewer asks next**

1. **"Three events on three continents at the same hour. What
   changes?"** — contribution is unaffected because each venue reaches
   its own nearest region independently; that's the payoff of callout
   (2). Distribution needs the transcode tiers in three regions running
   concurrently, which is a quota and capacity question I'd have pre-
   raised, and it's why I want the transcode tier elastic rather than
   provisioned.
2. **"Escalate: the CDN has a bad hour in one region."** — the origin
   sees a multiple of its designed load from that region and I need it
   to shed rather than collapse. I'd cap origin concurrency and degrade
   to a lower bitrate rung for that region rather than serve nobody, and
   I'd rehearse that rather than discover it live.
3. **"Who owns this in two years?"** — a media platform team owning the
   packaging contract and the URL-identity rule, separate from the
   product teams building viewer experiences. Without that ownership,
   the URL rule erodes one reasonable request at a time.
4. **"How do you know the archive is actually usable?"** — by replaying
   from it regularly rather than assuming. An archive nobody has
   replayed is a set of files with a hopeful name, which is the same
   failure mode as an untested backup.
5. **"The commentary team wants AI-generated highlights during the
   event. Where does that go?"** — on the telemetry and archive side,
   never in the contribution or distribution path, and the design for it
   belongs in `design-07` rather than here. What I'd protect is that its
   compute demand cannot contend with transcode during an event.

**Cross-references**

- `04-architectures/case-study-helicopter-racing-league.md` — the named
  case study with this shape, including its venue-side edge footprint.
- `03-comparisons/03-networking-connectivity.md` — worked scenario C
  makes the same temporary-venue argument behind callout (1).
- `D2-Q05` for the caching mechanics that callouts (6) and (7) depend
  on, `D2-Q08` for the event-day capacity discipline, `D2-Q12` for the
  non-live media pipeline.

---

### D2-Q05 — "The app is ninety-something percent reads and the users are everywhere. Design the caching. I want the layers, the invalidation, and what you refuse to cache."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 1.3, 6.2 |
| **Axis** | scale |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D2-Q01` |

**What the interviewer is actually testing**

Whether you have ever operated a cache. Anyone can name layers. The
questions that separate candidates are: what happens on a miss when ten
thousand requests miss simultaneously, how does a wrong entry get out,
and which responses must never be stored at a shared layer. The third
one is a correctness question wearing a performance costume, and it's
the one that ends careers when it's answered wrong.

**Clarifying questions to ask before drawing anything**

- **What is the cache actually for — latency or capacity?** If it's
  latency, I can fail open on a cache outage. If the origin cannot
  survive without it, the cache is a capacity dependency and it belongs
  in the availability budget (`D2-Q13`), which changes how I run it.
- **How stale can each class of content be, in seconds?** Not "fresh" —
  a number per class. Without it, every TTL becomes a guess and every
  argument about invalidation is unresolvable.
- **Is any response personalised, and at what granularity?** Per-user,
  per-segment and per-locale are three different cache keys and one of
  them is a security incident if you get it wrong.
- **How do writers learn that they changed something cacheable?** If
  invalidation depends on a human remembering, it will be wrong. I want
  an event, not a habit.
- **What's the worst thing a stale read could cause?** Price, stock,
  permission and entitlement all have different answers, and the ones
  with money or access attached come off the cacheable list.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Read:write ratio is heavily read-skewed | Stated | — | Caching is the primary scaling mechanism, not a tuning step |
| Global user base | Stated | — | Edge caching does the geography; regional caches do the shared misses |
| Most content tolerates seconds of staleness | Assumed | "I'll assume a small number of surfaces need freshness and most don't" | Lets TTL carry most of the invalidation load |
| Some responses are per-user | Assumed | "Anything authenticated is private-cache-only unless proven otherwise" | Default-deny on shared caching of personalised content |
| Origin cannot absorb full read load | Assumed | "If the cache is load-bearing, it's a dependency, not an optimisation" | Determines fail-open vs fail-closed behaviour |
| Content changes arrive as events | Assumed | "I'd rather invalidate on a publish event than on a timer alone" | Pub/Sub-driven purge for the freshness-sensitive classes |

**The answer, out loud**

I'd start with the part most people leave out: I'd write down the
classes of content and their staleness budget in seconds before I name
a single cache. Static assets, catalogue-style content, per-segment
content, per-user content, and never-cached. Everything else falls out
of that table, and without it the design is four boxes and an opinion.

Then four layers, each with a different job. The client cache handles
repeat views for one user and costs nothing — it's controlled purely by
response headers and content-addressed URLs for static assets, where
the filename carries a content hash so a change produces a new URL and
invalidation is structurally unnecessary. The CDN edge handles the
geography: identical content requested by many users near each other,
served from Google's edge without crossing to a region. The regional
shared cache — Memorystore — handles what the CDN can't, which is
anything computed rather than stored: rendered fragments, expensive
query results, per-segment content. And the in-process cache inside
each app instance handles the tiny, extremely hot, rarely-changing
things like feature flags and configuration, where even a
sub-millisecond network hop is too much to pay thousands of times per
second.

Invalidation gets three mechanisms, matched to the class. Content
addressing for static: no invalidation exists because the URL changes.
Time-to-live for the large middle: bounded staleness, no coordination,
and the operational advantage that it cannot leave a wrong entry
permanently. Event-driven purge for the freshness-sensitive minority: a
publish event on Pub/Sub, consumed in every region, that removes
specific keys. I'd lean hard on the first two and use the third
sparingly, because a purge system is itself a distributed system with
its own failure modes, and a purge that silently fails is worse than a
TTL that was slightly too long.

The stampede is the operational question I'd raise unprompted, because
it's where cached systems actually fall over. When a popular key
expires, every concurrent request for it misses at once and they all
hit the origin together — and the origin was sized on the assumption
that the cache was working. Three defences: jitter the TTLs so
neighbouring keys don't expire in lockstep; coalesce concurrent misses
so one request per key per instance goes to the origin and the rest
wait for it; and serve stale while revalidating, where an expired entry
is still returned while one background refresh runs. Together those
turn a thundering herd into a single request. Without them, a cache
makes the origin's peak load worse, not better, because it concentrates
the misses.

Negative caching matters too, and it's routinely missed. If a lookup
returns "not found," cache that — for a shorter time than a hit, but
cache it — or a hot missing key becomes an unthrottled origin load
generator. That's also a cheap abuse mitigation.

Now the refusal list, which is the part I'd make sure to say clearly.
I do not cache authenticated per-user responses at any shared layer.
Not at the CDN, not in the regional cache under a key that doesn't
include the user identity, and never with a default TTL applied by a
platform rule. The failure mode is serving one person's data to
another, and it's the kind of incident that ends with a disclosure
letter. I do not cache authorisation decisions beyond a very short
window, because a revoked permission that stays cached is a live
access-control bug (`D2-Q06`). I do not cache the write-critical state
— the ledger, the stock count at commit time — because a stale read
there is a financial event rather than a cosmetic one (`D2-Q02`). And
I do not cache anything whose staleness has a legal meaning: consent
state, regional availability, pricing where the displayed price is a
binding offer.

The last thing I'd name is the mode question. If the origin cannot
survive a cache outage, then the cache is a capacity dependency, and
that means it needs replicas, monitoring on hit rate as a primary
signal rather than a vanity metric, and a rehearsed answer for a cold
start. Failing open into an origin that can't take the load isn't
failing open — it's failing everything.

**Architecture**

```
  ONE READ, STEP BY STEP (time flows downward)

  (1) client issues GET /product/123
       │
       ▼
  (2) browser/app cache — content-addressed static? serve, done
       │  miss / not applicable
       ▼
  (3) Cloud Armor → global external Application LB
       │
       ▼
  (4) Cloud CDN edge — key = URL (+ allowed vary headers ONLY)
       │  HIT  → return, never touches a region          ◄── (a)
       │  MISS ↓
       ▼
  (5) regional app instance selected by latency routing
       │
       ▼
  (6) in-process cache — flags, config, tiny + very hot
       │  miss ↓
       ▼
  (7) Memorystore (regional shared) — rendered fragments,
       │  expensive query results, per-segment content
       │  HIT  → return + populate (6)                   ◄── (b)
       │  MISS ↓
       ▼
  (8) SINGLE-FLIGHT GATE — one origin call per key per
       │  instance; all other concurrent misses WAIT here ◄── (c)
       ▼
  (9) database / read replica
       │  found → populate (7),(6), return
       │  not found → cache the NEGATIVE, shorter TTL     ◄── (d)
       ▼
 (10) response; stale-while-revalidate refreshes (7) in the
       background without making this request wait         ◄── (e)

  NEVER CACHED AT A SHARED LAYER: authenticated per-user responses,
  authorisation decisions beyond a very short window, the order and
  inventory ledger at commit time, anything whose staleness has a
  legal meaning (consent, binding prices, regional availability).

  Cross-cutting: TTLs are jittered so neighbouring keys don't expire
  together (f); invalidation is content-addressing, then TTL, then
  event-driven purge — in that order of preference (g).
```

**Every arrow explained:**

- **(a) CDN hit returns without touching a region** — this is where the
  scale comes from. What fails here: a `Vary` header on something
  user-specific silently fragments or, worse, shares. Don't let the CDN
  key on anything you haven't enumerated; use an explicit allowlist of
  vary headers rather than passing them through.
- **(b) Memorystore hit populates the in-process cache above it** —
  each layer warms the one closer to the request. What fails here: an
  eviction storm under memory pressure turns every request into a
  step-(8) miss. Don't size the cache to the working set exactly; size
  it with headroom, or the cliff is vertical.
- **(c) Single-flight gate** — one origin call per key per instance;
  the rest wait on that call. What fails here: if the origin call hangs,
  every waiter hangs with it, so the gate needs its own timeout and the
  waiters need to fail fast rather than inherit an unbounded wait.
  Retries happen once, on the leader, with backoff — never on every
  waiter, which would recreate the stampede the gate exists to prevent.
- **(d) Negative caching with a shorter TTL** — a hot missing key stops
  being an unthrottled origin-load generator. Don't give negatives the
  same TTL as positives; a newly created item would then be invisible
  for the full window.
- **(e) Stale-while-revalidate** — the expired entry is served while one
  background refresh runs, so nobody waits for freshness they didn't
  ask for. What fails here: if the refresh keeps failing, you serve
  increasingly stale content silently, so it needs a hard staleness
  ceiling after which the layer starts missing honestly.
- **(f) Jittered TTLs** — neighbouring keys expiring in lockstep is how
  a cache converts a smooth load into a periodic spike. Don't use one
  round TTL constant everywhere.
- **(g) Invalidation preference order** — content addressing first
  because it needs no mechanism, TTL second because it can't leave a
  permanently wrong entry, purge last because it's a distributed system
  that can fail silently. Don't lead with purge; a purge-first design
  has the most moving parts and the quietest failure mode.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Primary invalidation | Content addressing, then TTL | Event-driven purge everywhere | No mechanism to fail, and no way to leave a permanently wrong entry | When staleness is genuinely intolerable within seconds for a specific class — then purge that class, and only that class |
| Shared regional cache | Memorystore in each region | One global cache tier | Cache data is disposable and regional; cross-region cache consistency is a cost with no matching benefit | When the cached artefact is extremely expensive to compute and rarely read — then a shared tier amortises the computation |
| Miss behaviour | Single-flight plus stale-while-revalidate | Let every miss go to the origin | The origin is sized assuming the cache works; concentrated misses are the actual failure mode | When the origin is genuinely over-provisioned and the content must never be stale — then simple misses are easier to reason about |
| Personalised responses | Never cached at a shared layer | Cache with the user identity in the key | Default-deny is the only posture that survives a config mistake | When the response is per-segment rather than per-user and the segment is coarse and non-sensitive — then key on the segment, explicitly |
| Cache role | Declared as either latency or capacity | Left unstated | Determines whether a cache outage is a slowdown or an outage, which changes how you run it | Never — this one has no alternative worth choosing; leaving it unstated is the failure |

**What a weak answer sounds like**

- "We'd use a CDN and Redis." — names two layers and answers none of
  the three questions that matter: stampede, invalidation, refusal.
- "Cache everything and invalidate when data changes." — describes the
  hardest possible invalidation strategy as though it were the easy
  one, and doesn't say what happens when the purge fails.
- "We'd set a long TTL for performance." — performance without a
  staleness budget per class, so the first freshness complaint turns
  into a blanket TTL reduction and the hit rate collapses.
- "The cache is just an optimisation." — occasionally true and usually
  false at this read ratio; if the origin can't take the load, the
  cache is a dependency and pretending otherwise is how a cache outage
  becomes a site outage.

**Common wrong turns**

- **Starting with layers instead of classes.** The layers are obvious;
  the class table is the design. Recover by writing the classes and
  their staleness budgets on the board first.
- **Forgetting the stampede.** Everything works until the hottest key
  expires. Recover by adding the single-flight gate explicitly and
  naming what it does on timeout.
- **Caching authenticated responses at a shared layer.** It's usually a
  platform default applied too broadly rather than a deliberate choice.
  Recover by stating the refusal list as a rule, not a preference.
- **Treating hit rate as a vanity metric.** It's the leading indicator
  for origin load and therefore for availability. Recover by putting it
  on the same dashboard as the origin's saturation.

**Follow-up probes the interviewer asks next**

1. **"Your regional cache is empty — a cold start after a failover.
   What happens?"** — every request becomes a step-(8) miss and the
   origin sees a multiple of its normal load. The single-flight gate is
   what makes this survivable rather than fatal, and I'd load-test
   exactly this case rather than the steady state, because it's the one
   that actually happens.
2. **"Escalate it: traffic goes up tenfold and the hit rate drops ten
   points. Which hurts more?"** — the hit-rate drop, easily. Tenfold
   traffic with an unchanged hit rate is tenfold origin load; a
   ten-point hit-rate drop at that traffic can be several times worse
   again. That asymmetry is why hit rate is a first-class alert.
3. **"Who owns this in two years?"** — cache policy needs a platform
   owner, because the refusal list and the vary-header allowlist decay
   under pressure from individual teams with individually reasonable
   requests. Without an owner, the personalised-response rule is the
   first one to go.
4. **"A product manager wants personalised recommendations on the home
   page. What changes?"** — the page splits: a cacheable shell and a
   small personalised fragment fetched separately and cached only in
   the client. I would not make the whole home page uncacheable to
   accommodate one module.
5. **"How would you prove the refusal list is being honoured?"** — an
   automated check in the pipeline that fails a deploy if a response
   carrying an authenticated identity also carries shared-cache
   headers. A rule with no enforcement is documentation.

**Cross-references**

- `04-architectures/pattern-multi-region-web-app.md` — the regional
  cache placement behind steps (5)–(7), including why it stays regional.
- `03-comparisons/02-storage-database-options.md` — the Memorystore
  positioning and the "never the system of record" pairing.
- `D2-Q01` for the platform this caches, `D2-Q02` for why the ledger is
  on the refusal list, `D2-Q11` for the read path this feeds, `D2-Q16`
  for caching under a hard p99 budget.

---

### D2-Q06 — "Active-active across three regions. Where does a user's session live, and what happens when their requests land in a different region mid-session?"

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 1.2, 1.3 |
| **Axis** | scale |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D2-Q01` |

**What the interviewer is actually testing**

Whether you reach for session affinity. That's the reflex, it works in
a demo, and it quietly undoes the entire reason for the multi-region
topology. The real answer is to shrink the mutable session to almost
nothing and make the rest verifiable anywhere without a lookup. The
second test is revocation: candidates who choose stateless tokens and
then can't explain how a compromised session gets killed have moved the
problem rather than solved it.

**Clarifying questions to ask before drawing anything**

- **What is actually in the session today?** Usually four things
  wearing one name: identity, entitlements, a bit of workflow state,
  and a pile of convenience data. They have different requirements and
  should stop sharing a store.
- **How fast must a revocation take effect?** Immediately, within a
  minute, or by next login are three different architectures. This is
  the question that decides the token lifetime.
- **Is there a regulatory obligation on session data location?** If
  session data is personal data with a residency rule, the replicated
  global store is off the table for those users.
- **Do users move regions mid-session in practice, or only during a
  failover?** Routine movement means the cost of a cross-region read is
  paid constantly; failover-only movement means I can accept a slower
  path in the rare case.
- **What's the worst outcome of losing a session?** Re-login is an
  annoyance; a lost half-completed multi-step form is a support call.
  That difference decides how much durability the workflow state needs.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| All regions serve all users | Stated | — | Any request may land anywhere; nothing can be pinned |
| Identity must be verifiable without a central lookup | Assumed | "Otherwise every request has a cross-region dependency" | Signed, short-lived tokens verified locally |
| Revocation within minutes is acceptable | Assumed | "If it must be instant, I need a different and more expensive design" | Sets token lifetime and the revocation-list refresh interval |
| In-progress workflow state must survive a region loss | Assumed | "A user halfway through checkout shouldn't start over" | That slice, and only that slice, gets a replicated store |
| Convenience data is disposable | Assumed | "Recently-viewed and UI preferences can be rebuilt" | Stays in regional cache, never replicated |
| No residency constraint on session data | Assumed | "If there is one, sessions for those users can't use a global store" | Would fork the design per market |

**The answer, out loud**

My first move is to stop calling it "the session," because that word is
hiding four different things with four different requirements. Once
they're separated, three of the four stop being hard.

Identity is the first. I'd carry it in a short-lived signed token that
any region can verify locally using a public key it already has. No
lookup, no shared store, no cross-region call on the hot path. That
single decision is what makes active-active actually active: a request
landing in a region that has never seen this user before can
authenticate it without talking to anyone. The token is deliberately
short-lived, and the client refreshes it against a longer-lived
credential.

Entitlements are the second, and they're the part people get wrong by
stuffing them into the token. Roles and permissions change, and a token
that carries them is a snapshot that can't be corrected until it
expires. I'd keep them out of the token and fetch them per region,
cached with a short time-to-live. That gives me a bounded correction
window and keeps the token small.

Workflow state is the third — the half-finished checkout, the multi-step
form, the cart. This is the only part that is genuinely mutable, and
it's small. It goes in a store that's readable and writable from every
region with the consistency the workflow actually needs. If the
workflow spans regions and must read its own writes — a user whose
requests bounce between regions mid-checkout — that's Spanner, and it's
a small enough dataset that the cost is easy to justify. If the client
is a mobile app that also needs offline behaviour, Firestore is the
better fit and brings its own sync model (`D2-Q14`). What it is *not*
is a regional cache, because losing a region would then lose every
in-flight checkout in it.

Convenience data is the fourth — recently viewed, UI preferences, the
things a user wouldn't notice regenerating. That stays in the regional
Memorystore, is never replicated, and is explicitly allowed to be lost.
Being clear about that is what keeps the replicated store small, and
keeping the replicated store small is the entire trick.

Now revocation, which is where a stateless-token design earns or loses
the room. A short-lived token means a revoked session dies when it
expires, and that's a real window. If the business can tolerate a
few minutes, I'd use token lifetime as the primary mechanism and add a
revocation list distributed to every region — a small set of identifiers
for sessions killed before their natural expiry, refreshed frequently
and checked locally. It stays small because entries age out at token
expiry. If revocation must be instant, then every request needs a
central check, I've reintroduced a global dependency on the hot path,
and I'd say plainly that this costs latency and availability and ask
whether "instant" is a requirement or a preference. Usually it applies
to a narrow set of high-privilege actions, and the right answer is to
make *those* actions re-verify centrally while ordinary reads don't.

The thing I'd reject explicitly is load-balancer session affinity. It
looks like it solves this, and what it actually does is pin a user to
one region — so that user's availability is now that region's
availability, which is precisely the property the multi-region topology
was built to eliminate. It also breaks silently: everything works until
the region fails, and then those users lose their sessions at the exact
moment the architecture was supposed to protect them. The honest
version of that tradeoff is externalising the state, which is what all
of the above is.

**Architecture**

```
        request from a user — may land in ANY region
                              │
                              ▼
        ┌──────────────────────────────────────────┐
        │ Global external Application LB — latency  │ ◄── (1)
        │ routing, NO session affinity              │
        └───────┬──────────────┬──────────────┬────┘
                ▼              ▼              ▼
           region A        region B       region C
        ┌────────────────────────────────────────────┐
        │ 1. IDENTITY — short-lived signed token,      │ ◄── (2)
        │    verified LOCALLY with a public key.       │
        │    No lookup. No cross-region call.          │
        ├────────────────────────────────────────────┤
        │ 2. ENTITLEMENTS — fetched per region,        │ ◄── (3)
        │    cached with a short TTL. NOT in the token.│
        ├────────────────────────────────────────────┤
        │ 4. CONVENIENCE — regional Memorystore,        │ ◄── (4)
        │    never replicated, allowed to be lost.      │
        └───────────────────────┬────────────────────┘
                                ▼
        ┌────────────────────────────────────────────┐
        │ 3. WORKFLOW STATE — the ONLY genuinely       │ ◄── (5)
        │    mutable, must-survive slice.              │
        │    Spanner (cross-region read-your-writes)   │
        │    or Firestore (offline-capable clients)    │
        └────────────────────────────────────────────┘

        REVOCATION
        ┌────────────────────────────────────────────┐
        │ short token lifetime is the primary control  │ ◄── (6)
        │ + revocation list pushed to every region,     │ ◄── (7)
        │   checked locally, entries age out at expiry  │
        │ + high-privilege actions re-verify centrally  │ ◄── (8)
        └────────────────────────────────────────────┘

  Cross-cutting: session affinity is deliberately OFF, because pinning
  a user to a region makes their availability that region's
  availability (9); the replicated slice is kept small on purpose —
  that smallness is what makes it affordable (10).
```

**Every arrow explained:**

1. **Latency routing with affinity off** — any region serves any
   request. Don't enable affinity to paper over statefulness; it
   silently converts a multi-region design into a per-user
   single-region one, and it fails exactly during a regional incident.
2. **Identity in a locally verifiable token** — no hot-path lookup, so
   a cold region can serve a user it has never seen. Don't use an
   opaque session ID requiring a central lookup; that's a global
   dependency on every single request.
3. **Entitlements outside the token, cached per region** — permissions
   change and a token is a snapshot. Don't embed roles in a
   long-lived token; you've made every permission change wait for
   expiry.
4. **Convenience data regional and disposable** — never replicated,
   explicitly allowed to vanish. Don't replicate it "for consistency";
   you're paying cross-region costs for recently-viewed items.
5. **Workflow state in a cross-region store** — the one slice where a
   region loss must not lose data. Don't put it in the regional cache;
   losing a region would lose every in-flight checkout inside it.
6. **Short token lifetime as the primary revocation control** — the
   mechanism with no moving parts. Don't set a long lifetime for
   convenience; the lifetime *is* the revocation window.
7. **Revocation list pushed to every region, checked locally** —
   handles kills before natural expiry without a hot-path central call.
   Don't let it grow unbounded; entries age out at token expiry, which
   is what keeps it small enough to distribute.
8. **High-privilege actions re-verify centrally** — the narrow set that
   genuinely needs immediacy pays the latency, and ordinary reads
   don't. Don't apply central re-verification to every request to
   satisfy a requirement that only applies to a few.
9. **Affinity off as a stated decision** — written down so a future
   engineer doesn't enable it during an incident as a quick fix. Don't
   leave it as an unexamined default either way.
10. **Deliberately small replicated slice** — the cost and latency of
    the cross-region store scale with what you put in it. Don't let
    "session" become a junk drawer; each new field is a recurring
    cross-region cost.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Identity | Short-lived locally verifiable token | Opaque session ID with a central lookup | No cross-region dependency on the hot path | When sessions must be killable instantly and the central store is genuinely global and fast — then pay the lookup and accept the dependency |
| Entitlements | Outside the token, cached per region | Embedded in the token | Permission changes take effect within the cache TTL, not at token expiry | When entitlements are effectively immutable for the token's lifetime — then embedding removes a fetch |
| Workflow state | Cross-region store, small by design | Regional store with replication | A region loss doesn't lose in-flight work | When a lost in-flight workflow is genuinely acceptable — a browsing session with no commitment — then regional is cheaper and simpler |
| Request routing | No session affinity | Affinity pinning a user to a region | Preserves the availability property the topology exists for | When the workload is genuinely unmoveable — a long-lived stateful connection like a live match (`D2-Q03`) — then pin, and own the failure mode |
| Revocation | Short lifetime plus a distributed list | Central check on every request | Bounded window with no hot-path global dependency | When any revocation lag is unacceptable for regulatory reasons — then central checks, and the latency and availability cost are the price |

**Making it concrete**

```hcl
# Affinity is a property of the backend service, so "we turned it off"
# is a reviewable fact rather than a claim. NONE is the deliberate
# choice here, not the leftover default.
resource "google_compute_backend_service" "app" {
  project        = "PROJECT_ID"
  name           = "bes-app"
  session_affinity = "NONE"   # deliberate: see D2-Q06
  locality_lb_policy = "ROUND_ROBIN"

  # Draining a region must not strand users; state lives outside
  # the instance, so a drain is a latency event, not data loss.
  connection_draining_timeout_sec = 30
}
```

**What a weak answer sounds like**

- "We'd use sticky sessions." — the fastest way to lose the room. It
  works until the region fails, which is the only moment it mattered.
- "Everything goes in a global session store." — makes every request
  cross-region, and quietly makes that store a single point of failure
  for the whole platform.
- "We'd put all the user's permissions in the token so it's fast." —
  fast and uncorrectable; a revoked admin stays an admin until expiry.
- "Sessions can just be in Redis in each region." — fine for the
  convenience slice, wrong for the in-flight workflow, and the answer
  doesn't distinguish them.

**Common wrong turns**

- **Treating "the session" as one thing.** Everything downstream gets
  harder because four requirements are being satisfied by one store.
  Recover by splitting it out loud before designing anything.
- **Choosing stateless tokens and stopping.** The panel's next question
  is always revocation, and an answer without one is incomplete.
  Recover by naming the window and how you'd shrink it for the actions
  that need it.
- **Letting the replicated slice grow.** Every field added to the
  cross-region store is a permanent cost, and they're added one
  reasonable field at a time. Recover by naming an owner for that
  schema.
- **Testing only the happy path.** Region-to-region movement mid-session
  is rare in testing and common during incidents. Recover by proposing a
  test that moves a user's traffic mid-workflow on purpose.

**Follow-up probes the interviewer asks next**

1. **"Take it to fifty million active sessions. What changes?"** — the
   identity design doesn't, which is its main virtue: verification cost
   is per-request and local, so it scales with compute. What changes is
   the revocation list, which now needs to be a compact probabilistic
   structure or a partitioned one rather than a flat list, and the
   workflow store, whose cost is now worth actively pruning.
2. **"Escalate: an entire region is lost mid-checkout for thousands of
   users."** — identity survives because it's verifiable anywhere,
   entitlements re-fetch in the new region, convenience data is gone and
   nobody notices, and the in-flight checkouts survive because that's
   the one slice in the cross-region store. That mapping is the whole
   design justifying itself.
3. **"Who owns this in two years?"** — an identity platform team owning
   token lifetime, the revocation mechanism and the entitlement cache
   TTL. These are three numbers that get quietly changed during
   incidents and never changed back, so they need an owner and a
   documented rationale.
4. **"Security wants instant revocation for everything. What do you
   say?"** — I'd separate the ask: instant for high-privilege actions,
   which I'll build, and bounded for ordinary reads, where instant
   means a global dependency on every request. Then I'd put the
   availability cost of the maximalist version next to the risk it
   removes and let them choose with the numbers visible.
5. **"How do you migrate an existing sticky-session application to
   this?"** — externalise the state first while affinity is still on,
   verify the application works with affinity disabled in one region,
   then turn it off everywhere. The sequencing matters because the
   reverse order breaks users; the migration mechanics belong in
   `design-05`.

**Cross-references**

- `04-architectures/pattern-multi-region-web-app.md` — its
  session-affinity section states the same refusal; this answer supplies
  the replacement design.
- `03-comparisons/02-storage-database-options.md` — Spanner vs Firestore
  for the workflow slice behind callout (5).
- `design-04` for the identity and authorisation controls themselves —
  this question owns only where the state lives at scale.
- `D2-Q01` for the platform, `D2-Q05` for the entitlement cache's
  invalidation, `D2-Q14` for the offline-capable variant.

---

### D2-Q07 — "We're opening our platform to partners. Design the public API: the gateway, the quotas, the versioning, the auth, and how we ever turn a version off."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 5.1, 1.3 |
| **Axis** | scale |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D2-Q01` |

**What the interviewer is actually testing**

Whether you treat the API as a product with a lifecycle rather than an
endpoint with a gateway in front. The technical half is easy; the half
that separates candidates is deprecation, because a public API you can
never turn off is a permanent tax on every future design. The panel is
also checking whether you'd reach for the heaviest API management
product reflexively or pick by what the API actually is.

**Clarifying questions to ask before drawing anything**

- **Is this a product we charge for, or an integration we give away?**
  Monetisation, a developer portal and per-plan quotas justify a full
  API management platform. A handful of integrations for named
  customers does not, and I'd rather not hand a small team a platform
  to operate.
- **How many partners, and how sophisticated are they?** Twenty
  enterprise integrators and twenty thousand self-serve developers have
  different onboarding, different auth, and very different support
  models.
- **Do partners have contractual rate entitlements?** If a contract
  promises throughput, quota enforcement is a legal surface and not a
  tuning knob, which changes how exact it has to be.
- **What's our current record for turning something off?** If the
  answer is "we never have," deprecation is an organisational problem
  before it's a technical one, and the design has to make sunsetting
  structurally easy.
- **Are partners calling us, or are we also calling them?** Outbound
  webhooks to partner endpoints are a completely different reliability
  problem and I'd want to know if they're in scope.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| External partners, outside our trust boundary | Stated | — | Every request is untrusted; the gateway is a real security boundary |
| The API is a product with plans and limits | Assumed | "I'll assume there are tiers — tell me if everyone gets the same" | Justifies a full API management layer rather than a thin gateway |
| Some partners have contractual throughput | Assumed | "If throughput is contractual, quota accuracy stops being a tuning detail" | Drives how exact distributed counting must be |
| We will need to retire versions | Assumed | "I'd rather design the off-ramp now than negotiate it later" | Sunset telemetry and policy are day-one scope |
| Partner traffic is global | Assumed | "I'll assume partners call from wherever they are" | Gateway must be regionally redundant behind the global frontend |
| No partner-specific business logic in the gateway | Assumed | "The gateway does policy; the backend does product" | Keeps the gateway a shared component rather than a monolith |

**The answer, out loud**

I'd start with the product choice, because the three options on this
platform are genuinely different tools and picking by reflex is the
most common mistake here. If this API is a product — plans, partner
onboarding, a developer portal, per-partner analytics, policy that
evolves independently of the backend — that's Apigee, and I'd commit to
it for this scenario. If it were a small number of managed endpoints in
front of serverless backends with simple key-based access, API Gateway
does that with a fraction of the operational surface and I would not
inflict a full API management platform on a team that needs a door. And
if the API were something we already run where we want a proxy
co-located with the service to handle authentication and telemetry,
Cloud Endpoints is the lighter answer. The deciding question is whether
the API has a *lifecycle and an audience*, not whether it has traffic.

Auth I'd tier by partner value. The baseline is an issued credential
exchanged for a short-lived token, scoped per partner and per product,
with the gateway doing the verification so no backend ever sees an
unauthenticated request. For high-value or regulated partners I'd add
mutual TLS, because it binds the call to a certificate the partner
controls rather than a secret that can be pasted into a support ticket.
What I'd refuse is a long-lived static key in a header as the only
mechanism — it will end up in a repository, and there is no rotation
story that survives contact with twenty thousand developers.

Quotas sit at the gateway and come in two flavours that people
conflate. There's the *entitlement* quota — what the partner's plan
allows over a billing period — and there's the *protection* limit —
what we'll accept per second regardless of entitlement, to keep one
partner from hurting the others. They're enforced differently: the
entitlement is accounted and can be slightly approximate, and the
protection limit has to bite immediately and locally. I'd be explicit
about the scale consequence: the gateway runs in several regions, so
counting is distributed, which means a per-second limit is enforced
close to exactly per location and approximately in aggregate. A partner
calling from three regions at once can briefly exceed a global limit. I
would tell the partner the limit as a rounded number with headroom
rather than pretend to an exactness the topology can't deliver — and if
a contract genuinely requires exact global accounting, that's a
centralised counter, extra latency on every call, and a new dependency
I'd want them to agree is worth it.

Versioning: major version in the path, and a hard rule that within a
major version changes are additive only. New optional fields yes;
changed meanings, removed fields, tightened validation, no. That rule
is what makes it possible to ship continuously without a version
explosion. I'd also version the *contract* rather than the
implementation — partners depend on the schema, not on our services —
and generate client artefacts from that schema so drift is caught in
the pipeline rather than by a partner.

Deprecation is the part I'd insist on designing on day one, because
it's the part that's impossible to add later. Three components. First,
per-partner per-version usage telemetry, so I can always answer "who is
still on v1" precisely rather than guessing. Second, a published
lifecycle policy — announcement, a deprecation period with a
machine-readable sunset signal in the response headers, and a hard
date — agreed with the business before the first partner signs, so it's
a term rather than a negotiation. Third, a rehearsal: brownouts, where
the old version returns errors for short scheduled windows near the
end, which converts "we didn't know" into a calendar invite. Without
those three, version one runs forever and every subsequent design pays
for it.

The gateway is a shared failure domain, so I'd treat it accordingly:
regionally redundant behind the same global external Application Load
Balancer and Cloud Armor as everything else, no partner-specific logic
inside it, and a hard rule that the gateway never makes a synchronous
call to anything except the backend it's fronting. The most common way
these platforms fall over is a policy that enriches every request from
some other service which then has a bad day.

**Architecture**

```
   partners (global, untrusted, contractual)
                     │
                     ▼
   ┌─────────────────────────────────────────────┐
   │ Cloud Armor — WAF, geo, IP allowlists for     │ ◄── (1)
   │ named enterprise partners, edge rate bans     │
   └──────────────────────┬──────────────────────┘
                          ▼
   ┌─────────────────────────────────────────────┐
   │ Global external Application LB                │ ◄── (2)
   └──────────────────────┬──────────────────────┘
                          ▼
   ┌─────────────────────────────────────────────┐
   │ APIGEE — regionally redundant                 │ ◄── (3)
   │  • verify token / mTLS, per-partner scope     │ ◄── (4)
   │  • PROTECTION limit: per-second, local, bites │ ◄── (5)
   │  • ENTITLEMENT quota: per-plan, accounted,    │ ◄── (6)
   │    approximate in global aggregate            │
   │  • version routing: /v1 /v2, additive-only    │ ◄── (7)
   │    within a major                             │
   │  • emit per-partner per-version usage         │ ◄── (8)
   └──────────────────────┬──────────────────────┘
                          ▼
   ┌─────────────────────────────────────────────┐
   │ backend services (Cloud Run / GKE) — no       │ ◄── (9)
   │ partner logic, no unauthenticated path        │
   └─────────────────────────────────────────────┘

   LIFECYCLE CONTROL PLANE — designed on day one, not later
   ┌─────────────────────────────────────────────┐
   │ developer portal + credential self-service    │ ◄── (10)
   │ published sunset policy + machine-readable    │ ◄── (11)
   │ deprecation headers + scheduled BROWNOUTS     │
   └─────────────────────────────────────────────┘

  Cross-cutting: the gateway never makes a synchronous call to any
  service other than the backend it fronts (12); the contract schema,
  not the implementation, is the versioned artefact, and clients are
  generated from it so drift fails in the pipeline (13).
```

**Every arrow explained:**

1. **Cloud Armor in front of the gateway** — cheap, coarse rejection
   before anything expensive runs, plus IP allowlists for named
   enterprise partners. Don't rely on it for per-partner quotas; it
   doesn't know who the partner is until the token is verified.
2. **The same global frontend as everything else** — one anycast
   address, health-check failover, no separate partner edge to operate.
   Don't give partners a distinct regional hostname; you've created a
   failover story they have to implement.
3. **Apigee, regionally redundant** — chosen because this API is a
   product with plans, a portal and a lifecycle. Don't use it when the
   API is a handful of managed endpoints over serverless backends; API
   Gateway does that with far less to operate, and Cloud Endpoints is
   lighter still for a proxy beside a service you already run.
4. **Auth terminated at the gateway** — no backend ever sees an
   unauthenticated request. Don't accept a long-lived static key as the
   only mechanism; it has no rotation story at partner scale.
5. **Protection limit, local and immediate** — keeps one partner from
   hurting the others, enforced per location. Don't make this one
   depend on a global counter; the latency would be paid by every call
   to protect against a rare case.
6. **Entitlement quota, accounted and approximate globally** — a
   billing-period allowance, not a per-second gate. Don't promise exact
   global per-second accounting unless you've built the central counter
   and accepted its cost.
7. **Major version in the path, additive-only within it** — the rule
   that prevents a version explosion. Don't tighten validation inside a
   major version; that's a breaking change wearing a bug-fix label.
8. **Per-partner, per-version usage telemetry** — the only way to
   answer "who is still on v1" with evidence. Don't try to reconstruct
   this later from logs; the question arrives under time pressure.
9. **Backends carry no partner-specific logic** — keeps the gateway a
   shared component and the backends a product. Don't let a partner
   special case land in the gateway; that's how a shared component
   becomes unmaintainable.
10. **Portal and self-service credentials** — onboarding that scales
    past a support queue. Don't issue credentials by hand beyond the
    first dozen partners.
11. **Published sunset policy, deprecation headers and brownouts** —
    machine-readable warning plus a rehearsal. Don't announce
    deprecation only by email; the person who integrated has usually
    left.
12. **No synchronous fan-out from the gateway** — a policy enriching
    every request from another service makes that service's bad day
    into a platform outage. Don't put enrichment in the gateway; put it
    in the backend where it can be degraded.
13. **The contract schema is the versioned artefact** — clients are
    generated from it, so drift fails in CI rather than at a partner.
    Don't version the implementation and hope the schema follows.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Gateway product | Apigee | API Gateway, or Cloud Endpoints | The API is a product with plans, a portal, partner analytics and a lifecycle | When it's a handful of managed endpoints over serverless backends with simple keys — API Gateway; or when you want a proxy beside a service you already operate — Cloud Endpoints |
| Auth | Short-lived token, mTLS for high-value partners | Long-lived static API key | Rotation and revocation are possible; a leaked credential expires | When partners are so unsophisticated that anything beyond a key blocks adoption — then keys, with short rotation and strict scoping |
| Global quota accuracy | Exact locally, approximate in aggregate | Centralised global counter | Avoids adding a synchronous global dependency to every partner call | When throughput is contractually exact and the partner will audit it — then build the counter and charge the latency to that plan |
| Versioning | Major in the path, additive-only within it | Version by header or content negotiation | Trivially visible in logs, telemetry and support conversations | When the client population is sophisticated and version sprawl in paths is genuinely painful — then negotiate, and accept harder debugging |
| Deprecation | Policy, telemetry and brownouts from day one | Handle it when the first version needs retiring | The off-ramp is impossible to add once partners have integrated without it | Never comfortably — but if the API has exactly one partner you control, the ceremony can wait |

**What a weak answer sounds like**

- "We'd put an API gateway in front of it." — names the box and skips
  every decision the box exists to make.
- "Partners get an API key." — no rotation, no scoping, no revocation
  story, and it ends up in a public repository within a year.
- "We'd version when we need to break something." — versioning is a
  contract with the consumer, not a reaction to a change you already
  made.
- "We'd tell partners to migrate off v1." — telling is not a mechanism.
  Without telemetry, a sunset date and a brownout rehearsal, v1 runs
  forever.

**Common wrong turns**

- **Picking the heaviest API product by default.** It's the impressive
  answer and it hands a small team a platform to run. Recover by
  stating the deciding question — does the API have a lifecycle and an
  audience — and answering it out loud.
- **Putting business logic in the gateway.** It starts as one partner
  special case. Recover by making "no partner logic in the gateway" a
  stated platform rule with the reason attached.
- **Treating quotas as one concept.** Entitlement and protection have
  different accuracy requirements and different enforcement points.
  Recover by separating them before discussing counting.
- **Leaving deprecation to the business.** It becomes a negotiation
  under pressure with no data. Recover by making usage telemetry and a
  published policy part of version one's scope.

**Follow-up probes the interviewer asks next**

1. **"Twenty partners becomes twenty thousand developers. What
   breaks?"** — not the data plane; it scales like any other HTTP
   service. What breaks is everything human: credential issuance,
   support, and the ability to contact people before a sunset. That's
   why the portal and self-service credentials are day-one scope rather
   than a later nicety.
2. **"Escalate: one partner starts sending a hundred times their normal
   volume."** — the protection limit bites locally and immediately,
   they get a clear rejection with retry guidance, and nobody else
   notices. If the limit had been global-only, the first thing to fail
   would have been the counter.
3. **"Who owns this in two years?"** — an API product team, with a
   product manager, not just an engineering owner. The specific thing
   that decays without one is the additive-only rule: it gets broken by
   a well-meaning change that nobody classified as breaking.
4. **"A major partner refuses to migrate off v1 by the sunset date."** —
   then it's a commercial conversation with evidence: exactly what
   they're calling, how often, and what the extension costs us. I'd
   offer a paid, time-boxed extension on a frozen version rather than
   an indefinite reprieve, because an indefinite one becomes the
   precedent for every future sunset.
5. **"How do you keep the gateway from becoming the bottleneck?"** — by
   keeping it stateless and policy-only, forbidding synchronous fan-out
   from it, and load-testing it independently of the backends. A
   gateway that's only ever tested with its backends hides its own
   ceiling.

**Cross-references**

- `01-domains/DOMAIN-5-managing-implementation.md` §5.1 — the API
  management comparison table behind the gateway choice; this answer
  commits to one rather than restating the matrix.
- `design-04` for the partner identity and credential controls
  themselves; this question owns only the scale and lifecycle surface.
- `D2-Q09` for the abuse layer in front of this, `D2-Q13` for what
  happens when a partner's SLA meets your dependency chain.

---

### D2-Q08 — "Marketing has committed to an event nine weeks out. They expect ten times normal traffic for about six hours. Go."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 6.2, 1.2 |
| **Axis** | scale |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D2-Q03` |

**What the interviewer is actually testing**

Whether you produce a dated programme or an architecture diagram. The
architecture is mostly already decided; what's being tested is whether
you know that "ten times" is not uniform, that the ceiling is
discovered by breaking things deliberately, and that some of the
binding constraints belong to other companies. A candidate who says
"we'd scale up" has not answered the question.

**Clarifying questions to ask before drawing anything**

- **Ten times what, measured where?** Ten times the front door is
  rarely ten times everywhere. I need the multiplier per component,
  because the ones that go up non-linearly are where this fails.
- **Is the traffic the same shape or a different one?** Ten times the
  usual browsing is a caching problem. Ten times concentrated on
  checkout is a data-layer problem, and they need different work.
- **Does it start at a known instant?** A six-hour ramp and a
  ten-second doors-open are different problems; the instant version
  needs admission control and pre-warming, the ramp version mostly
  needs headroom.
- **Which third parties are on the critical path, and have they been
  told?** Our payment processor, our fraud vendor and our shipping-rate
  API all have their own limits, and none of them have agreed to ten
  times anything yet.
- **Who can decide to degrade on the day, and are they awake?** If
  there's no named person with the authority to turn features off, the
  degradation plan is fiction.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Ten times normal, six hours, fixed date | Stated | — | This is a programme with a deadline, not an architecture change |
| Nine weeks of lead time | Stated | — | Enough for quota, load testing and one real rehearsal; not enough for re-architecture |
| Multiplier varies by component | Assumed | "I'll assume some things see far more than ten times — cache misses, search, anything per-item" | Focuses the work on the non-linear components |
| Third parties are on the critical path | Assumed | "I'll assume at least the payment path leaves our platform" | Makes partner limits a workstream, not a footnote |
| Cost may rise for the window | Assumed | "I'll assume we can spend for the event if we unwind afterwards" | Permits headroom, with a dated unwind |
| Business can degrade non-essentials | Assumed | "I need agreement in advance on what we'd turn off" | Degradation list must be signed before the day |

**The answer, out loud**

The first thing I'd say is that ten times at the front door is not ten
times everywhere, and finding the components where it's worse is the
actual work. Some things scale linearly — stateless request handling,
CDN-served content. Some scale better than linearly: if traffic
concentrates on the same popular items, cache hit rate goes *up* and
the origin sees less than ten times. And some scale far worse. Search
and any per-item lookup that misses cache go up more than traffic does.
Write paths that contend on hot rows degrade non-linearly under
contention rather than just getting busier. Anything with a per-request
external call inherits someone else's ceiling. I'd build a table of
components against expected multiplier before touching any
infrastructure, and I'd expect two or three surprises in it.

Then I'd find the ceiling by breaking things, not by extrapolating. A
load test that ramps to the target and passes tells me almost nothing;
a test that ramps until something fails tells me what fails first, at
what level, and how it fails — cleanly, or by taking neighbours with
it. I want that answer for each component, in a realistic environment,
with the real data volumes, because a ceiling measured against an empty
database is a fiction.

Nine weeks gives me a sequence. Weeks one and two: the multiplier
table, and a load test to failure on the current system. Weeks three
and four: fix the first two or three ceilings found — usually a
connection pool, a quota, and one query that was always bad but never
mattered — and raise every quota that has a lead time. Quota is the
constraint people discover last and it moves slowest, so it goes early.
Weeks five and six: third parties. I'd get written confirmation of the
limits our payment, fraud and logistics providers will honour on the
day, because "we assumed they could handle it" is the most common
external cause of these failures, and the fix is a commercial
conversation that takes weeks. Week seven: a full game day at target
load with a regional failure injected in the middle, because an event
day that coincides with an infrastructure problem is exactly when the
plan gets tested. Week eight: change freeze, pre-warm, and rehearse the
degradation list with the person who'll make the call. Week nine: the
event, and then an unwind with a date on it.

The capacity strategy itself is deliberately dumb: pre-provisioned
headroom, minimum instances raised well above steady state, caches
pre-warmed with the content the event will hit, database capacity
scaled ahead of time rather than reactively. Autoscaling is the safety
net, not the plan, because a doors-open event outruns the loop. Where
the event has a known content focus — a launch product, a specific
category — I'd warm those cache keys deliberately in advance, which is
one of the highest-value and least-used techniques available here.

Degradation has to be agreed in writing beforehand. My list would run:
personalisation and recommendations off first, then non-essential
analytics and enrichment, then reduced search sophistication, then
queue-based admission to checkout, and never the checkout path itself.
Each item gets a feature flag, each flag gets tested before the day,
and a named person can flip it without convening a meeting. A
degradation plan that requires consensus during an incident is not a
plan.

The last piece is the unwind, and I'd put it in the plan rather than
leave it to good intentions. Headroom comes down on a date, quotas stay
raised because they cost nothing, and the load-test harness and the
feature flags stay, because the next event is coming and they're the
expensive part of what we just built.

**Architecture**

```
  NINE WEEKS, AS A PROCESS — not an architecture change

  W1–W2  MEASURE
  ┌──────────────────────────────────────────────┐
  │ multiplier PER COMPONENT, not one global 10x  │ ◄── (1)
  │   linear: stateless handlers, CDN content     │
  │   better than linear: concentrated hot content│
  │   WORSE: search, per-item misses, hot-row     │
  │          writes, anything with an external hop│
  ├──────────────────────────────────────────────┤
  │ load test TO FAILURE, real data volumes       │ ◄── (2)
  │   record what fails first, at what level, and │
  │   whether it fails cleanly or takes neighbours│
  └────────────────────────┬─────────────────────┘
                           ▼
  W3–W4  FIX AND REQUEST
  ┌──────────────────────────────────────────────┐
  │ fix the top 2–3 ceilings found                │ ◄── (3)
  │ raise every quota with a lead time — FIRST,   │ ◄── (4)
  │ because quota moves slowest of anything here  │
  └────────────────────────┬─────────────────────┘
                           ▼
  W5–W6  THIRD PARTIES
  ┌──────────────────────────────────────────────┐
  │ written confirmation of limits from payment,  │ ◄── (5)
  │ fraud, logistics. Their ceiling is our ceiling│
  └────────────────────────┬─────────────────────┘
                           ▼
  W7  GAME DAY
  ┌──────────────────────────────────────────────┐
  │ target load WITH a regional failure injected  │ ◄── (6)
  └────────────────────────┬─────────────────────┘
                           ▼
  W8  FREEZE, WARM, REHEARSE
  ┌──────────────────────────────────────────────┐
  │ change freeze; pre-warm caches with the       │ ◄── (7)
  │ content the event will actually hit; rehearse │
  │ the degradation list with the named decider   │ ◄── (8)
  └────────────────────────┬─────────────────────┘
                           ▼
  W9  EVENT  →  then UNWIND, on a date               ◄── (9)

  Cross-cutting: headroom is pre-provisioned and autoscaling is the
  safety net, not the plan (10); every degradation step is a tested
  feature flag one named person can flip without a meeting (11).
```

**Every arrow explained:**

1. **Per-component multipliers** — the global number is marketing's;
   the useful numbers are per component. Don't apply one multiplier
   uniformly; you'll over-provision the linear parts and under-provision
   the ones that actually break.
2. **Load test to failure, not to target** — a passing test at target
   tells you nothing about margin or failure mode. Don't test against
   an empty dataset; the ceiling you measure won't be the one you meet.
3. **Fix the top few ceilings only** — with nine weeks, depth beats
   breadth. Don't attempt re-architecture on this timeline; you'll
   arrive at the event with something half-migrated.
4. **Quota requests go first** — they have lead time and no technical
   fix substitutes. Don't leave them to week eight; the request queue
   is the one thing you cannot accelerate on the day.
5. **Written third-party limits** — their ceiling becomes yours the
   moment they're on the critical path. Don't assume a vendor scales
   with you; they sized for your contract, not your event.
6. **Game day with an injected failure** — the event and an
   infrastructure problem co-occurring is the case worth rehearsing.
   Don't rehearse only the happy path; that's the one that needs no
   rehearsal.
7. **Pre-warm the caches the event will hit** — highest-value,
   least-used technique available here. Don't warm everything
   indiscriminately; warm the specific keys the campaign drives traffic
   to.
8. **Rehearse degradation with the decider present** — the flags must
   be tested and the authority must be pre-delegated. Don't leave the
   decision to consensus during the incident.
9. **Unwind with a date** — otherwise event headroom becomes the
   permanent cost base. Don't unwind the quotas or the test harness,
   though; those cost nothing and the next event is coming.
10. **Headroom pre-provisioned, autoscaling as the net** — a
    doors-open event outruns a feedback loop. Don't rely on
    autoscaling alone for an instant-onset event.
11. **Degradation as tested feature flags** — untested flags fail at
    the worst moment and are indistinguishable from no plan. Don't
    write the list without wiring it.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Capacity approach | Pre-provisioned headroom for the window | Rely on autoscaling | An instant-onset event outruns the scaling feedback loop | When the event ramps over hours rather than minutes — then autoscaling is cheaper and sufficient |
| Load testing | Test to failure | Test to target and stop | Reveals the failure mode and the margin, which is the actual information | When a failure test would damage shared production data and no realistic environment exists — then test to target and treat the margin as unknown |
| Scope of fixes | Top two or three ceilings | Fix everything the test surfaced | Nine weeks buys depth on the binding constraints, not breadth | When the list is short and all of it is cheap — then do it all and bank the margin |
| Third-party limits | Written confirmation weeks ahead | Assume they scale with us | Their ceiling becomes ours, and raising it is a commercial process with lead time | When every dependency is internal — then it's a quota conversation, not a contract one |
| Degradation | Pre-agreed, flag-driven, pre-delegated authority | Decide on the day with the people available | Preserves the checkout path by sacrificing things nobody will miss | When the business genuinely will not accept any degradation — then the capacity plan has to carry the whole load, and it must be sized for the pessimistic multiplier |

**Making it concrete**

```bash
# Warm the specific keys the campaign will drive traffic to, rather
# than hoping the first ten thousand customers warm them for you.
# The item list comes from marketing's campaign plan, not from
# yesterday's traffic.
while read -r ITEM_ID; do
  curl -s -o /dev/null -w "%{http_code} %{time_total} ${ITEM_ID}\n" \
    "https://www.example.com/product/${ITEM_ID}" \
    -H "X-Cache-Warm: 1"
done < campaign-items.txt

# Raise the floor before the event; the unwind date goes in the
# description so it is visible to whoever finds it later.
gcloud run services update storefront \
  --project PROJECT_ID --region REGION --min-instances=200 \
  --description="event headroom; unwind 3 days after event"
```

**What a weak answer sounds like**

- "We'd scale up before the event." — no measurement, no per-component
  multiplier, and no idea which component is the actual ceiling.
- "The system autoscales." — true and irrelevant for an instant-onset
  event, and it says nothing about quota, which autoscaling cannot
  raise.
- "We'd run a load test the week before." — too late to fix anything it
  finds, which makes it a ceremony rather than a control.
- "We'll turn things off if we need to." — without tested flags and a
  pre-delegated decision-maker, that's an intention, not a capability.

**Common wrong turns**

- **Treating the multiplier as uniform.** It's the single most common
  error, and it puts the work in the wrong places. Recover by building
  the per-component table out loud.
- **Leaving quota to the end.** It's the slowest-moving constraint and
  the one people think of last. Recover by moving it to week three
  explicitly and saying why.
- **Forgetting third parties.** They're outside the diagram, so they're
  outside the plan. Recover by naming every external hop on the
  critical path and making each one a workstream.
- **Skipping the unwind.** The event succeeds, everyone moves on, and
  the cost base is permanently higher. Recover by writing the unwind
  date into the same plan.

**Follow-up probes the interviewer asks next**

1. **"It's not ten times, it's a hundred. Same nine weeks."** — then I
   change the answer from "scale it" to "gate it." At that multiple I'd
   design admission control as the primary mechanism, accept that most
   arrivals wait, and protect completion rate for those admitted rather
   than degrade the experience for everyone. I'd also go back to the
   business, because a hundred times is a different product decision,
   not a bigger engineering task.
2. **"Escalate: a region fails at hour two of the event."** — that's
   exactly the week-seven rehearsal, which is why I put it there. The
   surviving regions take the load with cold caches, so the real
   question is whether they have the headroom for the traffic plus the
   cache-miss amplification, and that's a specific number I'd have
   measured rather than hoped for.
3. **"Who owns this in two years?"** — a recurring capability rather
   than a project: the load-test harness, the multiplier table and the
   degradation flags should belong to the platform team and be
   maintained between events. The failure mode is that the next event
   re-creates all of it from scratch under time pressure.
4. **"Marketing moves the date three weeks earlier."** — then quota and
   third-party confirmation stay, the game day stays, and the ceiling
   fixes get cut to the single worst one. I'd tell them explicitly what
   we're no longer able to verify, in writing, rather than absorb the
   compression silently.
5. **"What do you keep afterwards?"** — the harness, the flags, the
   multiplier table and the raised quotas. What I'd give back is the
   headroom, on the date already written in the plan.

**Cross-references**

- `03-comparisons/05-ha-dr-strategies.md` — the drill and validation
  discipline behind callout (6); an untested plan is not a validated
  one, which applies to capacity exactly as it does to failover.
- `D2-Q03` for a spike with no known date, `D2-Q09` for the admission
  and gating machinery, `D2-Q05` for the cache-miss amplification that
  makes the multiplier non-uniform.

---

### D2-Q09 — "Design the layer that stops abuse and stops us from being overwhelmed. Globally. Tell me where it enforces and how exact it is."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 1.3, 6.2 |
| **Axis** | scale |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D2-Q07` |

**What the interviewer is actually testing**

Two things candidates usually merge. Abuse is adversarial and the right
response is rejection; overload is often your own success and the right
response is prioritised shedding. Treating them as one problem produces
a system that blocks paying customers during a good day. The second
test is whether you'll admit that global rate limiting is approximate,
and say by how much, rather than claiming an exactness a distributed
enforcement layer cannot deliver.

**Clarifying questions to ask before drawing anything**

- **Are we defending against adversaries, or against ourselves?** Both,
  usually, but the balance decides where the effort goes: adversaries
  need identification and challenge, self-inflicted overload needs
  priority and fairness.
- **Is there a paying-customer signal we can trust early?** If I can
  distinguish an authenticated customer from anonymous traffic at the
  edge, I can shed the right things. If everything looks the same until
  deep in the stack, my options get much worse.
- **What does a legitimate burst look like?** Every abuse control has a
  false-positive cost, and the shape of a legitimate spike — a
  campaign, a partner batch job, a mobile app update — is what I tune
  against.
- **How exact do the limits need to be, contractually?** A published
  partner limit is a promise; an internal protection limit is not. Only
  one of them needs to be defensible in an audit.
- **What is the most expensive request we serve?** Rate limiting by
  request count treats a cheap read and an expensive search as equal,
  and at scale that's how you get overwhelmed while under the limit.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Global traffic, distributed enforcement | Stated | — | Exact global counting is not available for free; approximation must be stated |
| Both adversarial and organic overload | Assumed | "I'll design two responses — reject, and shed by priority" | Prevents one mechanism being used for both |
| Authenticated customers are identifiable early | Assumed | "If we can't tell a customer from a stranger at the edge, shedding gets much cruder" | Enables priority-based shedding |
| One tenant must not starve others | Assumed | "Fairness is a requirement, not an emergent property" | Per-tenant quotas inside shared pools |
| Cost of a false positive is high | Assumed | "A blocked customer is worse than an admitted bot, within limits" | Biases toward challenge over block for ambiguous traffic |
| Clients retry badly | Assumed | "I'll assume clients retry immediately and in lockstep unless we make them not" | Server-driven backoff and fast rejection |

**The answer, out loud**

I'd build this as a funnel with four enforcement points, each rejecting
what it can cheaply identify so the next one sees less. The principle
is that rejection should happen as early and as cheaply as possible,
because traffic you're going to refuse anyway should never reach
anything you pay to scale.

The first point is Cloud Armor at the edge, attached to the global load
balancer's backend services. This is where the cheap, coarse decisions
live: known-bad addresses, geography where we don't operate, request
signatures that are unambiguously hostile, and rate-based bans that
trip on volume from a single source. It's also where bot management
belongs — challenging traffic that looks automated rather than blocking
it outright, because the false-positive cost of blocking is a customer
and the false-positive cost of a challenge is a second of friction. The
critical property is that this layer costs almost nothing per rejected
request and runs before any of our compute does.

The second point is per-identity limits at the API gateway, which is
the first place we know *who* is asking. This is where partner
entitlements and per-customer limits are enforced (`D2-Q07`). It's more
expensive than the edge because a token has to be verified first, which
is exactly why it's second rather than first.

The third point is inside the application: per-tenant and per-resource
limits on shared pools. This is the fairness layer, and it's the one
most often missing. A single tenant running an unusual but legitimate
job can consume a shared connection pool or a shared worker pool and
starve everyone else without ever tripping a rate limit, because their
request *count* was fine. That's why I'd limit concurrency and cost,
not just rate — one expensive search and a thousand cheap reads are not
equivalent, and counting requests treats them as if they are.

The fourth point is backpressure at the data layer: bounded connection
pools, bounded queues, and fast rejection when they're full. The
failure I'm designing against is unbounded queuing, where a system
accepts everything, gets slower, and turns a capacity problem into a
total outage because every client is now waiting on a request that will
time out anyway. Rejecting quickly at a known limit is kinder to
everyone than accepting slowly.

Now the honest part about global exactness. Enforcement runs in many
places, so counting is distributed. A per-location limit is enforced
essentially exactly; a global limit is enforced approximately, and the
overshoot scales with how many locations a single caller can reach at
once. I'd size the published limit with headroom below the level where
overshoot actually hurts, tell partners a round number, and not claim
precision the topology can't provide. If someone needs exact global
accounting, that's a centralised counter on the request path, with its
latency and its availability implications, and I'd want them to agree
that's worth it for the specific case rather than adopt it everywhere.

The shedding policy is where abuse and overload separate. For abuse the
answer is rejection — fast, cheap, with no useful information in the
response. For overload the answer is priority: authenticated paying
customers before anonymous browsers, checkout before search, and
in-flight work before new work, because abandoning a nearly-complete
transaction wastes everything already spent on it. I'd write that
priority order down before the incident, the same way `D2-Q08` writes
down the degradation order.

The last piece is retry behaviour, which is how these systems turn a
manageable problem into a collapse. Rejected clients retry, and if they
retry immediately and together they produce a second peak larger than
the first. I'd return explicit retry guidance, reject fast so the
client learns quickly rather than timing out, and where we own the
client, require jittered exponential backoff. Where we don't own the
client, I'd assume it retries badly and size the rejection path for
that.

**Architecture**

```
  incoming traffic — legitimate, over-enthusiastic and hostile
                             │
                             ▼
  ┌──────────────────────────────────────────────────────┐
  │ 1. EDGE — Cloud Armor on the LB backend services       │
  │    geo, known-bad, hostile signatures, rate-based bans │ ◄── (1)
  │    bot management: CHALLENGE ambiguous, don't block    │ ◄── (2)
  │    cost per rejection: near zero, before any compute   │
  └────────────────────────────┬─────────────────────────┘
                               ▼  (much less traffic)
  ┌──────────────────────────────────────────────────────┐
  │ 2. GATEWAY — first point that knows WHO is asking      │ ◄── (3)
  │    per-partner / per-customer limits, plan entitlements│
  │    exact per location, APPROXIMATE globally            │ ◄── (4)
  └────────────────────────────┬─────────────────────────┘
                               ▼
  ┌──────────────────────────────────────────────────────┐
  │ 3. APPLICATION — fairness inside shared pools          │ ◄── (5)
  │    per-tenant CONCURRENCY and COST limits, not just    │
  │    request counts — one search ≠ one cheap read        │ ◄── (6)
  └────────────────────────────┬─────────────────────────┘
                               ▼
  ┌──────────────────────────────────────────────────────┐
  │ 4. DATA LAYER — bounded pools, bounded queues,         │ ◄── (7)
  │    FAST rejection when full. Never unbounded queuing.  │
  └──────────────────────────────────────────────────────┘

  TWO DIFFERENT RESPONSES, decided in advance
  ┌──────────────────────────────────────────────────────┐
  │ ABUSE (adversarial)  → reject, cheap, uninformative    │ ◄── (8)
  │ OVERLOAD (our own success) → shed BY PRIORITY:         │ ◄── (9)
  │   paying authenticated > anonymous;                    │
  │   checkout > search; in-flight > new                   │
  └──────────────────────────────────────────────────────┘

  Cross-cutting: every rejection carries explicit retry guidance and
  is returned FAST, so clients learn instead of timing out (10);
  where we own the client, jittered exponential backoff is mandatory,
  and where we don't, we size the rejection path assuming it retries
  badly (11).
```

**Every arrow explained:**

1. **Coarse rejection at the edge** — cheapest possible place to refuse
   traffic, ahead of all compute. Don't put identity-aware limits here;
   the edge doesn't know who the caller is until a token is verified.
2. **Challenge rather than block for ambiguous traffic** — a blocked
   customer costs more than a challenged bot. Don't blanket-block by
   geography or address range without checking what legitimate traffic
   lives there; the false-positive cost lands on revenue.
3. **Identity-aware limits at the gateway** — the first layer that can
   apply a per-customer rule. Don't move these to the application;
   you'd be paying full request cost to enforce a limit.
4. **Exact locally, approximate globally** — stated rather than hidden.
   Don't publish a precise global per-second limit you can't enforce;
   publish a rounded one with headroom.
5. **Per-tenant fairness inside shared pools** — the missing layer in
   most designs. Don't assume rate limits deliver fairness; a tenant
   can starve a shared pool while entirely within their request rate.
6. **Limit concurrency and cost, not only count** — one expensive
   search and a thousand cheap reads are not equivalent. Don't rate-
   limit purely by request count on a surface with wildly varying
   request cost.
7. **Bounded pools and fast rejection at the data layer** — prevents
   unbounded queuing turning a capacity problem into an outage. Don't
   let queues grow to absorb load; you're converting rejections you
   could have made into timeouts everyone pays for.
8. **Abuse response: reject, cheap, uninformative** — no detail that
   helps an adversary tune. Don't return a descriptive error explaining
   exactly which rule fired.
9. **Overload response: shed by written priority** — the order is
   decided before the incident, not during it. Don't shed uniformly;
   uniform shedding fails the most valuable requests at the same rate
   as the least.
10. **Fast, explicit rejection with retry guidance** — a client that
    learns quickly stops sooner. Don't reject by timing out; a timeout
    teaches the client nothing and holds a connection while it learns
    nothing.
11. **Backoff with jitter, assumed absent where not owned** — lockstep
    retries produce a second peak larger than the first. Don't trust
    third-party clients to back off politely.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Enforcement placement | Four layers, cheapest rejection first | One limiter at the application | Traffic you'll refuse never reaches anything you pay to scale | When the system is small and one enforcement point is genuinely comprehensible — then a single limiter beats four you can't reason about together |
| Global accuracy | Exact per location, approximate globally | Centralised global counter | No synchronous global dependency on every request | When a limit is contractual and auditable — then build the counter, and charge its latency to that contract |
| Ambiguous traffic | Challenge | Block | A blocked customer costs more than a challenged bot | When the surface is high-value and low-volume — a credential endpoint — then block, because the false-negative cost dominates |
| Limit dimension | Concurrency and cost | Request count | Protects against a small number of very expensive requests | When request cost is genuinely uniform — a simple key-value read path — then counting is simpler and sufficient |
| Overload response | Priority-based shedding | Uniform shedding, first-come-first-served | Preserves the requests the business most needs completed | When there's genuinely no priority signal available and inventing one would be arbitrary — then uniform, and say so plainly |

**What a weak answer sounds like**

- "We'd put rate limiting in the load balancer." — one layer, no
  fairness, no priority, and no statement of how exact it is.
- "Cloud Armor handles it." — names the product and skips the four
  decisions the product exposes.
- "We'd block anyone over the limit." — merges abuse and overload, so a
  successful marketing campaign gets treated as an attack.
- "Rate limits are per-second, globally, exactly." — not achievable
  with distributed enforcement, and claiming it is the fastest way to
  lose credibility with a panel that's operated one.

**Common wrong turns**

- **Merging abuse and overload.** One mechanism, two problems, and the
  wrong response to at least one of them. Recover by splitting the
  response paths explicitly.
- **Counting requests instead of cost.** Works until someone finds the
  expensive endpoint. Recover by adding concurrency and cost
  dimensions and naming the expensive surfaces.
- **Forgetting fairness inside shared pools.** Rate limits pass and one
  tenant still starves the others. Recover by adding the per-tenant
  concurrency layer.
- **Ignoring retry behaviour.** The second peak is the one that
  actually takes you down. Recover by adding retry guidance and fast
  rejection to the design before the panel asks.

**Follow-up probes the interviewer asks next**

1. **"A distributed attack from a million addresses, none of them
   individually above your limit."** — per-source limiting is useless
   there, so I'd shift to aggregate defence: challenge anonymous
   traffic broadly, prioritise authenticated sessions, and accept that
   anonymous browsing degrades while customers keep working. That's
   only possible because the priority order was written down before the
   incident.
2. **"Escalate: the challenge system itself is the bottleneck."** —
   then it becomes a dependency in the availability budget and needs
   its own capacity plan, and I'd want a static fallback — serve
   cacheable content without challenge and refuse writes — rather than
   a challenge layer that fails closed and blocks everyone.
3. **"Who owns this in two years?"** — a platform team with a direct
   line to whoever owns revenue, because every tightening has a
   false-positive cost that lands on customers and every loosening has
   a risk cost. Owned only by security, it drifts tight; owned only by
   product, it drifts open.
4. **"How do you tune it without breaking real customers?"** — run every
   new rule in a preview mode first, measure exactly what it *would*
   have rejected, and inspect that set before enforcing. A rule that
   goes straight to enforcement is an experiment on customers.
5. **"Marketing launches a campaign and the edge bans the traffic."** —
   that's a false positive with a revenue number, and it's why campaign
   plans need to reach the team owning this layer before launch. The
   technical fix is an allowance tied to the campaign; the real fix is
   the calendar, which is `D2-Q08`'s week eight.

**Cross-references**

- `03-comparisons/03-networking-connectivity.md` — Cloud Armor's
  placement on the Application LB tier behind callout (1).
- `D2-Q07` for the per-partner entitlement limits at layer two,
  `D2-Q08` for the planned-event version of the same machinery,
  `D2-Q02` for using it as a correctness gate on a flash sale.
- `design-04` for the threat model and security controls themselves;
  this question owns the scale and fairness surface only.

---

### D2-Q10 — "Active-active or active-passive. Don't tell me your preference — tell me how you actually decide."

| | |
|---|---|
| **Band** | Principal |
| **Primary domain leaves** | 1.2, 6.2 |
| **Axis** | scale |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D2-Q01`, `D2-Q02` |

**What the interviewer is actually testing**

Whether you have a procedure or a preference. Most candidates have a
default and dress it up as reasoning. The Principal-level answer starts
from the *write path's conflict semantics* rather than from the
availability number, because the availability number tells you what you
need and the conflict semantics tell you what you can have. The second
thing being tested is whether you'll admit that most systems described
as active-active are something else and cheaper.

**Clarifying questions to ask before drawing anything**

- **Can two regions legitimately write the same entity at the same
  instant?** This is the first question and it eliminates most of the
  difficulty when the answer is no. Writes partitioned by tenant, by
  user or by market are single-writer per partition, whatever the
  topology diagram says.
- **What's the stated recovery-time and recovery-point tolerance, as
  numbers?** Not adjectives. "Mission critical" with a four-hour
  recovery target is a different tier from "internal tool" with a
  zero-loss requirement, and the number rules.
- **Who executes a failover, and when did they last do it?** An
  active-passive design is only as good as the promotion runbook, and a
  runbook nobody has run is a hypothesis.
- **Is the read path's requirement the same as the write path's?** They
  usually aren't, and conflating them is how a design ends up paying
  for global write consistency to serve a catalogue.
- **What does the business lose per minute of write unavailability?**
  If nobody can answer, the requirement is aspirational and the
  cheapest tier that meets the stated number is the right answer.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Multi-region is already decided | Stated | — | The question is the write topology, not whether to be multi-region |
| Read path and write path differ | Assumed | "I'll assume reads must be local and fast; writes may not need to be" | Lets reads be active everywhere regardless of the write answer |
| Recovery targets exist as numbers | Assumed | "If they don't, I'll propose numbers and get them agreed" | Without numbers, tier selection is taste |
| Failover has never been drilled | Assumed | "I'll assume the runbook is untested until someone shows me a drill record" | Weights the decision against designs with a promotion step |
| Writes may be partitionable | Assumed | "I'll check whether two regions can genuinely write the same row" | The single highest-leverage question in this whole decision |
| Cost is a real constraint | Stated | — | Rules out choosing the strongest tier as a default |

**The answer, out loud**

I decide this with four questions in a fixed order, and the order
matters because each one can end the conversation.

Question one: can two regions legitimately write the same entity at the
same instant? Most of the time, when you look closely, the answer is
no. Writes are partitioned by something natural — tenant, account,
market, device — and a given entity only ever has one legitimate writer
at a time. If that's the case, then what people call "active-active" is
really *region-partitioned single-writer*: every region is actively
serving writes, but for its own partition, and no two regions ever
contend for the same row. That's dramatically cheaper and simpler than
true multi-master, it gives you the availability story people actually
wanted, and the failure handling is per-partition rather than global. I
raise this first because it converts a hard problem into an easy one
more often than any other question in this space, and because the term
"active-active" hides it.

Question two, only if the answer to one is yes: is there a natural
merge for concurrent writes? Some data types merge cleanly — counters,
sets, last-writer-wins on fields that are genuinely independent. Some
don't, and for those the only honest options are to serialise writes
through a store that gives cross-region strong consistency, or to
change the data model so concurrent writes become independent. If the
data can't merge and you can't serialise it, you don't have an
architecture problem, you have a product-semantics problem, and it
should go back to the product.

Question three: what's the stated recovery target, as numbers? Then I
map to the tiers as they're defined — Active-Active, Active-Passive,
Warm Standby, Backup & Restore — and I apply the number rather than the
adjectives. Near-zero on both dimensions is Active-Active. A
minutes-level recovery time with seconds of acceptable loss is
Active-Passive. Tens of minutes to hours, cost-sensitive, is Warm
Standby. The trap here is the scenario that sounds critical and states
a generous number, and the discipline is to read the number.

Question four: who runs the failover, and have they done it? This is
the question that actually moves my answer most often. Active-Passive
carries a promotion step, and the promotion step is a runbook, and an
undrilled runbook is the single most common reason a DR design fails
when it's needed. If the organisation won't commit to a drill cadence,
I weight heavily toward the design with no promotion step — because
Active-Active's structural advantage is that every region is exercised
by real traffic continuously, so it can't rot unnoticed. That's an
organisational argument for a technical choice, and stating it that way
is part of the answer.

Then I apply it. Take the order ledger in `D2-Q02`: two regions can
genuinely commit orders against the same stock row, there's no natural
merge for "who got the last one," and the recovery requirement is
near-zero on data loss. Questions one through three all push the same
way, so that's a globally consistent store and effectively Active-Active
at the data layer. Now take a per-market content management system:
each market's editors only ever write their own market's content, so
question one ends it — region-partitioned single-writer, each market
served locally, no cross-region write coordination at all, and a
failover story that's per-market rather than global.

The two failure modes I'd name explicitly, because a Principal panel
wants to hear that I know what each choice costs. Active-Active's
characteristic failure is the partition edge case: replication lag and
split-brain semantics that only show up under a network partition
between regions, which is rare, hard to test and expensive to reason
about. Active-Passive's characteristic failure is the untested
promotion: the plan is fine and the execution is the first time anyone
has done it, under pressure, at an unsociable hour. Those are genuinely
different risks, and which one an organisation is better equipped to
carry is a legitimate input to the decision.

The last thing I'd say: this decision is per data set, not per company.
A single platform can and usually should run different tiers for
different slices, and picking one tier for everything is how you either
overspend on the catalogue or under-protect the ledger.

**Architecture**

```
  THE DECISION, IN ORDER — each step can end it

  Q1. Can two regions legitimately write the SAME entity
      at the same instant?
       │
       ├── NO ──► REGION-PARTITIONED SINGLE-WRITER          ◄── (1)
       │          every region active, for ITS partition;
       │          no cross-region write coordination;
       │          failover is per-partition, not global.
       │          Most "active-active" systems are this.
       │          ── DECISION MADE, stop here ──
       ▼
      YES
       │
  Q2. Is there a natural merge for concurrent writes?
       │
       ├── NO, and the model can't change ──► serialise      ◄── (2)
       │     through a globally consistent store, or send
       │     it back to product as a semantics problem
       ▼
      YES / serialised
       │
  Q3. Stated recovery numbers → tier                         ◄── (3)
       near-zero RTO and RPO ............ Active-Active
       minutes RTO, seconds RPO ......... Active-Passive
       tens of minutes–hours, cost-led .. Warm Standby
       a day is fine .................... Backup & Restore
       (read the NUMBER, not the adjectives)                 ◄── (4)
       │
       ▼
  Q4. Who executes the failover, and when did they last
      actually do it?                                        ◄── (5)
       no drill cadence ──► weight AWAY from any design
                            with a promotion step, because
                            an undrilled runbook is a
                            hypothesis, not a plan
       │
       ▼
  APPLY PER DATA SET, NEVER PER COMPANY                      ◄── (6)
   ledger (contends, no merge, zero loss) ... Active-Active
   per-market content (partitions cleanly) .. single-writer
   analytics (rebuildable) .................. Backup & Restore

  Cross-cutting: the characteristic failure of Active-Active is the
  partition edge case — lag and split-brain under a rare, hard-to-test
  condition (7); the characteristic failure of Active-Passive is the
  promotion nobody has rehearsed (8).
```

**Every arrow explained:**

1. **Partitionable writes end the decision early** — every region
   active for its own partition, no contention, no coordination. Don't
   call this active-active in a design document without the
   qualification; the word invites someone to add cross-partition
   writes later and nobody notices the guarantee changed.
2. **Unmergeable concurrent writes** — serialise through a globally
   consistent store, or change the model. Don't invent a bespoke
   conflict resolver for business-meaningful data; you're building a
   consistency model you'll have to defend to finance.
3. **Tier selection from the stated numbers** — the tier names are
   fixed and so are their meanings. Don't downgrade the data layer
   while leaving the compute tier at a higher tier; the whole system's
   real recovery capability is its weakest layer.
4. **Read the number, not the adjectives** — "mission critical" with a
   four-hour target is Warm Standby. Don't let business language
   override a stated number in either direction.
5. **Drill cadence as a decision input** — an organisational fact that
   legitimately changes a technical choice. Don't choose Active-Passive
   for an organisation that won't drill; you've chosen a design whose
   critical path is a procedure nobody has performed.
6. **Per data set, never per company** — different slices earn
   different tiers. Don't standardise one tier platform-wide; you'll
   overspend on the rebuildable data and under-protect the ledger.
7. **Active-Active's characteristic failure** — partition-time lag and
   split-brain semantics, rare and hard to test. Don't claim it removes
   consistency reasoning; it relocates it to the hardest place to
   observe.
8. **Active-Passive's characteristic failure** — an untested promotion
   executed for the first time under pressure. Don't accept "we have a
   runbook" as evidence; ask for the date of the last drill.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Starting question | Conflict semantics of the write path | The stated availability number | The number says what you need; the semantics say what's achievable and at what price | When the number is extreme and non-negotiable — a regulator-set target — then start from the number and let it force the data model |
| Framing | Name region-partitioned single-writer as its own option | Treat everything as active-active or active-passive | It's the cheapest correct answer for most systems and the vocabulary hides it | When entities genuinely have no natural partition key — a global shared graph — then the binary framing is the honest one |
| Tier scope | Per data set | One tier for the whole platform | Matches spend to the actual consequence of loss per slice | When the operational cost of running several tiers exceeds the saving — a very small team — then standardise on the strictest and accept the overspend |
| Weighting drills | Organisational drill cadence changes the technical choice | Choose on technical merit alone | A promotion step that's never rehearsed is the most common real-world DR failure | When the organisation genuinely drills on a schedule and can show records — then Active-Passive's cost advantage is real and safe to take |
| Unmergeable concurrent writes | Serialise, or change the model | Build a custom conflict resolver | Bespoke resolution on business-meaningful data is a consistency model you must defend to finance | When the data type genuinely merges — counters, sets, independent fields — then merge logic is correct and cheap |

**What a weak answer sounds like**

- "Active-active, because it's the most available." — a preference, not
  a procedure, and it never asks whether the writes contend at all.
- "Active-passive is cheaper, so that." — cheaper only if the promotion
  works, which is exactly the thing nobody has verified.
- "It depends on the requirements." — at Principal level the panel is
  asking for the decision procedure; the hedge is the failure.
- "We'd use the same tier everywhere for consistency." — consistency of
  process, at the cost of both overspending and under-protecting
  simultaneously.

**Common wrong turns**

- **Starting from the availability number.** It feels rigorous and it
  skips the question that usually makes the problem easy. Recover by
  asking whether two regions can write the same entity.
- **Letting "active-active" stay undefined.** Everyone nods and two
  people mean different things. Recover by naming region-partitioned
  single-writer explicitly as a third option.
- **Downgrading one layer only.** Active-active compute over a
  single-writer database delivers neither. Recover by walking every
  layer against the chosen tier.
- **Treating drills as an operational detail.** They're the difference
  between a design and a hope. Recover by asking for the date of the
  last one and letting the answer move your choice.

**Follow-up probes the interviewer asks next**

1. **"Take it to twelve regions. Does the procedure change?"** — the
   procedure doesn't, but the answers do. Partitioned single-writer
   scales to twelve almost for free; globally consistent writes do not,
   because write latency and cost both grow with the configuration's
   span. At twelve I'd expect to find that only a small core genuinely
   needs global consistency, and the honest design shrinks that core
   rather than spreading it.
2. **"Escalate: a network partition between two of your active
   regions."** — for partitioned single-writer, both sides keep serving
   their own partitions and nothing contends; that's the main reason I
   look for it first. For a globally consistent store, writes continue
   where a quorum exists and fail where it doesn't, which is correct
   and unpopular, and I'd want that behaviour understood in advance
   rather than discovered.
3. **"Who owns this in two years?"** — whoever owns the data set, not a
   central DR function. The tier is a property of the data, and it
   decays when the team that chose it is not the team that operates it.
   I'd want the tier recorded next to the schema, with the numbers it
   was chosen against.
4. **"Leadership has decided on active-active everywhere. What do you
   do?"** — I'd apply question one to each data set and show how many
   of them are already partitioned single-writer, which usually means
   we can honour the decision as stated while spending a fraction of
   what they expected. That's agreeing with the goal and disagreeing
   with the implementation, which is the only version of this argument
   that lands (`D2-Q15`).
5. **"What evidence would change your mind about a tier you've
   chosen?"** — a drill record showing promotion reliably inside the
   stated recovery time would move me toward Active-Passive; a
   partition incident showing operational confusion about split-brain
   semantics would move me away from Active-Active for that slice. Both
   are evidence you only get by running the system, which is why I'd
   revisit tier choices annually rather than treat them as permanent.

**Cross-references**

- `03-comparisons/05-ha-dr-strategies.md` — the four tier names, their
  definitions and the by-layer table; this answer uses them exactly and
  invents none.
- `04-architectures/pattern-multi-region-web-app.md` — the
  active-active vs active-passive worked variations behind Q3.
- `D2-Q02` for the worked ledger case, `D2-Q13` for how the chosen tier
  interacts with dependency availability, `D2-Q15` for arguing the
  cheaper answer to a committed leader.

---

### D2-Q11 — "A social feed. A hundred reads for every write, and some accounts have millions of followers. Design the read path."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 1.3, 6.2 |
| **Axis** | scale |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D2-Q05` |

**What the interviewer is actually testing**

Whether you know that the read/write ratio tells you *where to do the
work*, and that the follower distribution tells you the ratio is a lie
for a small number of accounts. A hundred to one says pay at write
time. Millions of followers says that for those accounts, paying at
write time is a single write fanning out to millions of write
operations. The answer is not one strategy, it's two, joined at read
time — and candidates who commit to only one get taken apart by the
other case.

**Clarifying questions to ask before drawing anything**

- **Is the feed chronological or ranked?** Chronological can be
  precomputed and served as a page. Ranked has to score candidates at
  read time, which changes the entire budget.
- **What's the follower distribution?** Not the average — the shape.
  The design is driven entirely by the tail, and the average follower
  count is the least useful number available.
- **How fresh does the feed have to be?** Seconds, or is a minute fine?
  A minute of tolerance makes almost everything easier and is usually
  acceptable if nobody asks.
- **How deep do people actually scroll?** If most sessions read the
  first screen, I precompute a small head and page the rest lazily,
  which changes the storage cost by an order of magnitude.
- **Are deletions and privacy changes retroactive?** If a blocked user's
  posts must disappear from already-materialised timelines, the
  precomputed model needs a correction path and that's real work.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Roughly a hundred reads per write | Stated | — | Justifies doing work at write time for the common case |
| A small number of accounts have enormous reach | Stated | — | Breaks fan-out-on-write for exactly those accounts |
| Feed may be a minute behind | Assumed | "I'll assume near-real-time, not real-time — tell me if it's stricter" | Permits asynchronous fan-out |
| Most sessions read the first screen only | Assumed | "I'll precompute a head and page the rest on demand" | Bounds materialised storage sharply |
| Privacy and deletion are retroactive | Assumed | "A deleted or blocked item must not appear in a materialised timeline" | Requires a filter at read time regardless of precomputation |
| Media is served separately | Assumed | "Timelines carry references, not bytes" | Keeps timeline rows small and cacheable |

**The answer, out loud**

At a hundred reads per write, the general principle is clear: do the
work at write time, because you pay it once and it's read a hundred
times. So the default is fan-out on write — when someone posts, I
append a reference to that post into each of their followers'
materialised timelines. Reads then become a simple range scan on the
reader's own timeline, which is fast, cheap and scales horizontally.

That works beautifully until a poster has millions of followers, and
then one write becomes millions of writes, arriving in a burst, and the
system falls over on the write path it was supposed to have protected.
So those accounts get the opposite treatment: nothing is fanned out on
write, and their posts are pulled at read time by anyone who follows
them. The set of such accounts is small, so pulling from them is a
bounded number of extra fetches per read.

The design is therefore a hybrid, and the read is a merge: take the
reader's materialised timeline, take the small number of high-reach
accounts they follow, fetch recent posts from each, merge the two by
the ordering the product uses, filter, and return. The threshold
between the two modes is a tuning parameter I'd expect to move, and I'd
make it a configuration value with an owner rather than a constant,
because the follower distribution changes as the product grows.

Storage: materialised timelines go in Bigtable, keyed by reader with a
reverse-chronological ordering so the newest page is a prefix scan.
That's exactly the access pattern Bigtable is built for — known key,
range scan — and I'd be careful with the key design so the write load
spreads rather than concentrating, which is the standard way this
specific store gets misused. The head of each active reader's timeline
also sits in Memorystore, because the first screen is what almost every
session asks for and serving it from a cache removes most of the read
load from the store entirely.

The timeline rows hold references, not content. Post bodies and media
are hydrated separately from a content store with its own cache, and
media is served through the CDN. That separation matters for two
reasons: it keeps timeline rows small enough that a page fetch is one
cheap operation, and it means editing or deleting a post changes one
content record rather than millions of timeline entries.

Which brings me to the correction path, and it's the part most answers
skip. Precomputed timelines are a cache of a decision, and decisions
change — posts get deleted, accounts get blocked, privacy gets
tightened. I would not try to go back and edit millions of materialised
rows. Instead the read path filters against current state: the
hydration step checks whether each referenced post is still visible to
this reader, and drops what isn't. That makes deletion instant from the
reader's point of view and keeps the write path simple, at the cost of
a filter on every read — which is a cost I'm happy to pay, because it's
the difference between a correct system and a system that shows deleted
content forever.

Fan-out itself runs asynchronously off Pub/Sub, so posting returns as
soon as the post is durable and the follower writes happen behind it.
That makes posting fast, makes the fan-out retryable, and means a
fan-out backlog degrades freshness rather than breaking posting. I'd
monitor that backlog as a primary signal, because it's the thing that
silently turns a near-real-time feed into a stale one.

Degradation, decided in advance: if the high-reach pull is slow, serve
the materialised part without it and mark the feed as partial rather
than making the reader wait. If the content hydration cache is cold,
serve fewer items rather than a slow page. The feed is a surface where
a fast, slightly incomplete answer is much better than a complete slow
one, and saying that out loud is part of the design.

**Architecture**

```
  WRITE PATH (rare) — two modes, chosen by reach
  post created ──► durable content store ──► Pub/Sub          ◄── (1)
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
  ORDINARY ACCOUNT                 HIGH-REACH ACCOUNT
  fan out on write: append a       NO fan-out. Post stays        ◄── (3)
  reference into each follower's   in the author's own
  timeline, asynchronously  ◄─(2)  recent-posts list

  READ PATH (constant) — one request, step by step
  (1) reader requests feed page
       │
       ▼
  (2) Memorystore: head of THIS reader's timeline?
       │  HIT → skip step 3                              ◄── (a)
       │  MISS ↓
       ▼
  (3) Bigtable: prefix scan, key = reader + reverse time  ◄── (b)
       │
       ▼
  (4) pull recent posts from the SMALL set of high-reach
       accounts this reader follows                       ◄── (c)
       │
       ▼
  (5) MERGE materialised + pulled, by the product's order ◄── (d)
       │
       ▼
  (6) FILTER against current visibility — deleted, blocked,
       privacy changed. Timelines are never retro-edited.  ◄── (e)
       │
       ▼
  (7) hydrate bodies from the content store + cache;
       media references resolve to CDN URLs               ◄── (f)
       │
       ▼
  (8) return; deeper pages are fetched lazily, so only a
       small head is ever precomputed                     ◄── (g)

  Cross-cutting: the reach threshold between the two write modes is
  configuration with a named owner, not a constant (h); fan-out
  backlog is a primary alert, because it silently converts a
  near-real-time feed into a stale one (i).
```

**Every arrow explained:**

1. **Post durable first, fan-out asynchronously** — posting returns
   fast and fan-out becomes retryable. Don't fan out synchronously; a
   slow follower write becomes a slow post for the author.
2. **Fan-out on write for ordinary accounts** — pay once, read a
   hundred times. Don't apply it to every account; one high-reach post
   becomes a burst of millions of writes.
3. **No fan-out for high-reach accounts** — their posts are pulled at
   read time. Don't pull for everyone; ordinary accounts would turn
   every read into a large fan-in.
- **(a) Cached timeline head** — most sessions read the first screen,
  so this removes most read load from the store. What fails: a cold
  cache after failover sends every read to step (3); the store must be
  sized for that, or the single-flight discipline from `D2-Q05` applies.
- **(b) Bigtable prefix scan on reader plus reverse time** — the newest
  page is a contiguous range. What fails: a key design that
  concentrates writes creates a hotspot, which is the standard way this
  store is misused. Retries here are cheap and safe because the read is
  idempotent.
- **(c) Pull from high-reach accounts** — bounded, because the set is
  small. What fails: one slow author fetch delays the whole page, so
  this step gets a short deadline and, on timeout, is dropped rather
  than retried inline — the feed is served partial.
- **(d) Merge by the product's ordering** — chronological is trivial;
  ranked means scoring candidates here, which is a different latency
  budget (`D2-Q16`). Don't rank inside the store; rank on the merged
  candidate set.
- **(e) Filter against current visibility** — deletion and blocking
  take effect immediately without rewriting millions of rows. What
  fails: if the visibility source is unavailable, fail closed and drop
  the item rather than risk showing something that should be gone.
- **(f) Hydrate bodies and media separately** — keeps timeline rows
  small and makes editing a post a single-record change. What fails: a
  hydration miss for one item drops that item rather than the page, and
  retries are bounded to one attempt inside the request.
- **(g) Only a small head is precomputed** — deeper pages are fetched
  lazily. Don't materialise deep history for every reader; storage cost
  scales with followers times depth and almost nobody scrolls.
- **(h) Reach threshold as owned configuration** — it must move as the
  follower distribution changes. Don't leave it as a constant in code.
- **(i) Fan-out backlog as a primary alert** — the leading indicator of
  staleness. Don't monitor only errors; a healthy, slow fan-out is the
  failure people notice.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Work placement | Hybrid — fan-out on write plus pull for high reach | One strategy for all accounts | Each strategy fails exactly where the other works; the distribution demands both | When the follower distribution is genuinely flat with no tail — an enterprise tool — then pure fan-out on write is simpler |
| Correction of deleted content | Filter at read time | Rewrite materialised timelines | Instant effect, no write amplification, and it can't miss a row | When reads vastly outnumber corrections *and* the filter is expensive — then targeted rewrites for the rare case |
| Timeline storage | Bigtable, key = reader + reverse time | A relational store with an index | Known-key range scans at very high write throughput is exactly this access pattern | When volume is modest and the team already operates a relational store well — then don't add a second technology for a problem you don't have |
| Timeline contents | References only, bodies hydrated separately | Denormalise post bodies into timelines | Editing or deleting a post changes one record, not millions | When posts are immutable and tiny and hydration latency dominates — then denormalise and accept the rewrite cost on the rare change |
| Degradation | Serve partial fast | Wait for completeness | On a feed, a fast incomplete page beats a slow complete one | When completeness is contractual — a regulated notification feed — then wait, and make the wait visible |

**What a weak answer sounds like**

- "Fan out on write, it's the standard answer." — correct for most
  accounts and catastrophic for the ones the question specifically
  mentioned.
- "Fan out on read, it's simpler." — turns every read into a large
  fan-in at a hundred-to-one read skew, which is the worst possible
  place to put the work.
- "We'd use a queue." — true and empty; the queue is a mechanism, not a
  strategy, and it doesn't address the reach distribution at all.
- "Deleted posts get removed from all timelines." — describes millions
  of writes triggered by one deletion, and it can still miss rows.

**Common wrong turns**

- **Designing from the average follower count.** The average is
  meaningless; the tail is the design. Recover by asking for the
  distribution's shape explicitly.
- **Precomputing deep history.** Storage scales with followers times
  depth, and almost nobody scrolls. Recover by bounding the
  materialised head and paging lazily.
- **Skipping the correction path.** It's invisible until the first
  privacy incident. Recover by adding the read-time filter and
  explaining why it beats rewriting.
- **Forgetting the backlog signal.** Fan-out that's healthy but slow
  produces a stale feed with no errors. Recover by naming the backlog
  as a primary alert.

**Follow-up probes the interviewer asks next**

1. **"An account goes from ten thousand followers to ten million in a
   day."** — they cross the threshold and switch modes, which means the
   already-materialised entries stay valid and new posts stop fanning
   out. The transition has to be handled explicitly or readers see a
   gap; I'd overlap the modes briefly so both sources are consulted
   during the switch.
2. **"Escalate: the fan-out pipeline is six hours behind."** — the feed
   is stale but not broken, because reads still work. I'd shed fan-out
   for low-engagement readers first and prioritise active ones, which
   means the backlog drains in the order that matters rather than
   first-in-first-out. That prioritisation only exists if it was built
   before the backlog.
3. **"Who owns this in two years?"** — a feed team owning the
   threshold, the ranking and the degradation policy. The specific
   decay risk is the threshold: it's a number chosen against a
   distribution that has since changed, and nobody revisits it unless
   it's somebody's job.
4. **"How do you keep the read path inside its latency budget?"** — by
   making every optional step droppable with its own deadline: the
   high-reach pull, the hydration of any single item, and any ranking.
   The only non-negotiable steps are the timeline read and the
   visibility filter. That's the same budget discipline as `D2-Q16`.
5. **"What changes if the feed becomes ranked rather than
   chronological?"** — the merge step becomes a scoring step over a
   candidate set, which adds a real latency cost and a dependency on a
   model-serving path. The candidate generation stays exactly as
   designed here; the scoring belongs in `design-07`.

**Cross-references**

- `03-comparisons/02-storage-database-options.md` — the Bigtable row-key
  and hotspotting guidance behind step (b), and the Memorystore
  positioning behind step (a).
- `D2-Q05` for the cache layers this read path depends on, `D2-Q16` for
  the latency-budget discipline, `D2-Q12` for the media pipeline behind
  the references in step (f).

---

### D2-Q12 — "Users upload photos and video from phones, all day, everywhere. Design the upload and the processing."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 1.3, 6.2 |
| **Axis** | scale |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D2-Q04` |

**What the interviewer is actually testing**

Whether bytes go through your compute. The single decision that
determines whether this design scales is whether the application tier
ever touches the payload, and a candidate who draws an upload endpoint
on the app tier has already lost. After that, the test is whether you
know most uploads are never viewed, which changes the processing
strategy completely.

**Clarifying questions to ask before drawing anything**

- **What proportion of uploads are ever viewed by anyone?** For most
  consumer products it's a small fraction, and that single fact decides
  whether processing is eager or lazy.
- **How bad are the networks?** Mobile uploads fail partway constantly,
  so resumability isn't a nice-to-have — it's the difference between a
  working product and one that loses a wedding video at ninety percent.
- **Is there a moderation or safety obligation before content is
  visible?** If yes, there's a mandatory gate between upload and
  serving, and it's on the critical path for publication.
- **How many output variants does the product actually need?** Each
  variant is real compute per upload, and the list grows by habit
  rather than by need.
- **How long must originals be kept?** Originals dominate storage over
  time, and their retention policy is worth more than any compute
  optimisation.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Consumer-scale upload volume, mobile clients | Stated | — | Rules out proxying bytes through compute; forces resumable uploads |
| Most uploads are rarely or never viewed | Assumed | "If that's wrong, I'd shift more work to eager processing" | Makes lazy derivative generation the default for the long tail |
| Content must be validated before it is served | Assumed | "I'll assume there's a safety gate — it changes where the boundary is" | Two-bucket quarantine/validated split |
| Originals retained long-term | Assumed | "I'll assume we keep originals and tier them down by age" | Lifecycle policy is a first-class cost lever |
| Processing can tolerate interruption | Assumed | "Derivative generation is retryable, so it can run on interruptible capacity" | Enables much cheaper compute for the heavy tier |
| Duplicate events will occur | Assumed | "I'll design processing to be idempotent rather than chase exactly-once delivery" | Keyed on object name and generation |

**The answer, out loud**

The first decision is that bytes never pass through our application
tier. The client asks our API for permission to upload, gets back a
signed, time-limited, resumable upload URL, and writes directly to
Cloud Storage. Our compute handles a small authorisation request and
nothing else. If instead the app tier proxies the payload, every
concurrent upload holds a connection and memory in something we pay to
scale, and the cost curve is set by bandwidth rather than by requests.
Resumability is the second half of that: mobile uploads fail partway
constantly, and a resumable upload turns a dropped connection into a
continuation instead of a restart.

Uploads land in a quarantine bucket, not the serving one. That boundary
is doing real work: nothing that hasn't been validated is reachable by
a serving path, so a malformed or malicious object can't be served by
accident. Object finalisation publishes an event to Pub/Sub, and that
event is the trigger for everything downstream.

Validation runs first: is it the type it claims, is it within limits,
does it pass whatever safety scanning the product requires. Passing
objects move to the validated bucket; failing ones stay quarantined with
a reason, and a small number of objects will fail in ways nobody
anticipated, so there's a dead-letter path rather than an infinite
retry loop. A poison object that retries forever is the classic way
this pipeline burns capacity silently.

Then derivative generation, and here's the choice I'd make explicitly.
Most uploads are never viewed, so eagerly producing every variant for
every upload means paying for work nobody consumes. My commitment is
split: eagerly produce the small set that's almost certainly needed —
a thumbnail, and the one playback rendition the uploader will
immediately watch — and generate the rest of the ladder lazily, on
first request, then cache the result. The long tail costs nothing until
someone asks. For the small proportion of content that becomes popular,
the first viewer pays a one-off generation delay and everyone after
them hits cache.

The processing tier itself is the elastic part of the system and it's
interruption-tolerant, because any job can be retried from the
original. That makes it a good fit for Spot capacity — either Spot node
pools under GKE or a managed batch layer over Compute Engine for the
heavy parallel work. I'd keep the latency-sensitive sliver, the
uploader's own immediate playback rendition, on ordinary capacity so a
reclaim doesn't show up as a bad first experience, and put everything
else on the cheap interruptible tier. Naming which slice is which is
the design; putting it all on one tier wastes either money or
experience.

Idempotency is keyed on the object's name and its generation, not on
the message identifier, because the duplicate I actually care about is
a redelivered notification for the same object. Every derivative is
written to a deterministic path derived from that key, so a duplicate
job overwrites identical output rather than producing a second copy.

Serving is object storage behind Cloud CDN on the same global frontend
as everything else, with the same URL-identity discipline as `D2-Q04`:
derivative URLs are content-derived and identical for identical
content, so the cache hit rate stays high and the origin stays quiet.

Finally, lifecycle. Originals are the dominant storage cost over a
product's life, and they're rarely accessed after the first weeks. A
lifecycle policy tiering them down by age does more for the cost
picture than any compute tuning, and it's a few lines of configuration.
I'd set it on day one, because retrofitting a retention policy onto
years of accumulated objects is a project rather than a setting.

**Architecture**

```
   phone                                             our compute
     │  1. "may I upload?"  ──────────────────────►  API (tiny)
     │  2. signed, time-limited RESUMABLE URL  ◄───     ◄── (1)
     │
     │  3. bytes go DIRECTLY to storage, never through us
     ▼
  ┌──────────────────────────────────────────────────────┐
  │ QUARANTINE bucket — not reachable by any serving path │ ◄── (2)
  └──────────────────────────┬───────────────────────────┘
                             │ object finalize event
                             ▼
  ┌──────────────────────────────────────────────────────┐
  │ Pub/Sub  ── idempotency key = object name + generation│ ◄── (3)
  └──────────────────────────┬───────────────────────────┘
                             ▼
  ┌──────────────────────────────────────────────────────┐
  │ VALIDATE: type, limits, safety scan                   │ ◄── (4)
  │   pass → move to validated bucket                     │
  │   fail → stays quarantined, reason recorded           │
  │   unparseable → DEAD LETTER, never an infinite retry  │ ◄── (5)
  └──────────────────────────┬───────────────────────────┘
                             ▼
  ┌─────────────────────────┴────────────────────────────┐
  ▼                                                      ▼
 EAGER (small, certain)                    LAZY (the long tail)
 thumbnail + the ONE rendition             remaining ladder rungs
 the uploader will watch now               generated on FIRST
 ordinary capacity          ◄── (6)        request, then cached  ◄── (7)
                                           heavy work on SPOT    ◄── (8)
                             │
                             ▼
  ┌──────────────────────────────────────────────────────┐
  │ SERVING bucket → Cloud CDN → global external App LB   │ ◄── (9)
  │ derivative URLs are content-derived and identical     │
  └──────────────────────────────────────────────────────┘

  Cross-cutting: originals are the dominant long-run storage cost, so
  a lifecycle policy tiers them down by age from day one (10); every
  derivative path is deterministic, so a duplicate job overwrites
  identical output instead of creating a second copy (11).
```

**Every arrow explained:**

1. **Signed resumable upload URL** — our compute handles a small
   authorisation request, never the payload, and a dropped connection
   continues rather than restarts. Don't proxy uploads through the app
   tier; concurrency then costs memory and connections in the tier you
   pay to scale.
2. **Quarantine bucket as a real boundary** — unvalidated content is
   unreachable from any serving path. Don't upload straight into the
   serving bucket and validate afterwards; there's a window where a bad
   object is servable.
3. **Idempotency on object name plus generation** — the duplicate that
   matters is a redelivered notification for the same object. Don't key
   on the message identifier; a redelivery has a new one.
4. **Validation before anything expensive** — cheapest possible
   rejection point. Don't transcode first and validate later; you've
   paid for content you're about to discard.
5. **Dead-letter path for unparseable objects** — a poison object that
   retries forever burns capacity silently. Don't retry indefinitely;
   bound it and route the remainder somewhere a human will look.
6. **Eager generation for the small certain set, on ordinary
   capacity** — the uploader's immediate experience shouldn't be
   subject to a reclaim. Don't put this slice on interruptible capacity
   to save a little.
7. **Lazy generation for the long tail** — most uploads are never
   viewed, so the tail costs nothing until asked for. Don't generate
   every variant eagerly unless viewing rates are genuinely high.
8. **Heavy work on Spot capacity** — every job is retryable from the
   original, which is exactly the interruption-tolerant profile Spot is
   for. Don't use Spot for anything a user is waiting on.
9. **Serve from storage through the CDN with content-derived URLs** —
   identical content, identical URL, high hit rate. Don't add
   per-viewer parameters to derivative URLs; that collapses the cache.
10. **Lifecycle tiering on originals from day one** — the dominant
    long-run cost and the cheapest lever available. Don't retrofit
    retention later; it becomes a project instead of a setting.
11. **Deterministic derivative paths** — makes duplicate processing
    harmless. Don't generate unique output names per job; you'd
    accumulate duplicate derivatives that nobody ever cleans up.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Upload path | Direct to storage via signed resumable URL | Proxy bytes through the app tier | Compute cost scales with requests, not with bandwidth | When every upload needs synchronous inline inspection before it can be stored at all — a strict regulatory gate — then proxy, and size for it |
| Derivative generation | Eager for a small certain set, lazy for the tail | Eager for everything | Most uploads are never viewed, so eager work on the tail is unconsumed | When nearly all content is viewed quickly — a live-adjacent product — then eager everything and take the predictable latency |
| Heavy processing capacity | Spot / interruptible | Ordinary dedicated capacity | Jobs are retryable from the original, which is the ideal interruption-tolerant profile | When a user is waiting on the result — then ordinary capacity, because a reclaim is a visible failure |
| Validation boundary | Two buckets, quarantine and validated | One bucket with a status flag | Unvalidated content is structurally unreachable, not just marked | When the object count makes moves expensive and the serving path is provably flag-aware — then one bucket, carefully |
| Storage cost control | Lifecycle tiering set at day one | Revisit retention once storage becomes noticeable | Retrofitting retention across years of objects is a project, not a setting | When retention is legally fixed and tiering is forbidden — then it isn't a lever and the cost is simply owned |

**What a weak answer sounds like**

- "The API accepts the upload and writes it to storage." — the whole
  design fails here; compute now scales with bandwidth.
- "We'd transcode everything on upload." — pays for variants of content
  nobody will ever watch, which at consumer scale is most of it.
- "Cloud Functions triggered on upload, and that's the pipeline." — a
  trigger is not a pipeline; it says nothing about validation, poison
  objects, idempotency or the eager/lazy split.
- "We'd retry failures until they succeed." — a poison object then
  consumes capacity forever, and nobody notices because it isn't an
  error spike, it's a steady hum.

**Common wrong turns**

- **Proxying the bytes.** It's the intuitive shape because that's how a
  form post works. Recover immediately by moving to signed URLs; it's
  cheap to fix mid-answer and defining afterwards.
- **Forgetting resumability.** Works in the office, fails on a train.
  Recover by naming the mobile network reality as the reason.
- **One bucket for everything.** The quarantine boundary is the cheapest
  safety property available. Recover by splitting it and saying what it
  guarantees.
- **Ignoring originals.** All the attention goes to compute while
  storage quietly becomes the dominant line. Recover by adding the
  lifecycle policy while you're still drawing.

**Follow-up probes the interviewer asks next**

1. **"A single video goes viral. What happens?"** — the first viewer
   triggers lazy generation of the rungs they need and waits a moment;
   everyone after them is served from the CDN. The system's exposure is
   a brief burst of concurrent generation requests for the same object,
   which is why derivative generation needs the same single-flight
   discipline as a cache miss (`D2-Q05`).
2. **"Escalate: ten times the upload volume for a day."** — uploads
   themselves are fine, because they go straight to storage and don't
   touch anything we scale. The processing backlog grows, which is a
   freshness degradation rather than an outage, and the Spot tier
   absorbs it at whatever rate capacity allows. That decoupling is the
   main reason the design is shaped this way.
3. **"Who owns this in two years?"** — a media platform team owning the
   variant list and the retention policy. The variant list is the thing
   that decays: variants get added for a feature and never removed when
   the feature goes, and each one is permanent per-upload compute.
4. **"How do you add a new output format to years of content?"** — I
   don't, for the tail. New formats generate lazily on request like
   every other rung, and only the demonstrably popular subset gets a
   backfill. A blanket backfill over the full archive is the most
   expensive thing this system can be asked to do.
5. **"What if safety scanning must happen before anything is
   stored?"** — then the quarantine boundary moves in front of storage
   and uploads do have to pass through an inspection tier, with all the
   cost that implies. I'd push hard on whether "before stored" or
   "before served" is the actual requirement, because they differ by an
   order of magnitude in cost and only one of them is usually meant.

**Cross-references**

- `03-comparisons/01-compute-options.md` — the Spot and Cloud Batch
  positioning behind callout (8), and why a user-facing path stays off
  interruptible capacity.
- `D2-Q04` for the live-video sibling of this pipeline and the URL
  identity rule, `D2-Q05` for the single-flight discipline behind probe
  one, `D2-Q17` for sharing capacity with latency-sensitive work.

---

### D2-Q13 — "Our contract says 99.99%. Three services we depend on publish 99.9%, and two of them are third parties. Explain how that's possible."

| | |
|---|---|
| **Band** | Principal |
| **Primary domain leaves** | 1.2, 6.2 |
| **Axis** | scale |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D2-Q10` |

**What the interviewer is actually testing**

Whether you'll say the honest thing: as described, it isn't possible,
because dependencies in series compose downward rather than upward. The
test is what you do next. A Principal candidate doesn't stop at "we
can't" — they change the shape of the dependency graph, change what
counts as an outage, or change the contract, and they know which of
those is cheapest.

**Clarifying questions to ask before drawing anything**

- **What exactly does the contract define as unavailable?** Measured
  where, over what window, with what exclusions? Most availability
  contracts are won or lost on the definition rather than on the
  engineering.
- **Are all three dependencies on the critical path for every
  request?** Usually at least one isn't, and it's only there because
  someone made a synchronous call out of convenience.
- **What does the service actually promise the customer?** If the
  promise is "orders are accepted," a degraded read experience isn't an
  outage, and that distinction is worth more than any redundancy.
- **What's our own change-failure rate?** Most outages come from our
  deploys, not our dependencies, so an availability conversation that
  ignores the release process is aimed at the wrong risk.
- **Is there a second provider for any of the third parties?** Not
  always, but where there is, it changes the composition from serial to
  parallel for that hop.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Contractual target above what the chain supports | Stated | — | Something must change: the graph, the definition, or the contract |
| Three dependencies at a lower published target | Stated | — | Serial composition is the core problem to attack |
| Two are third parties | Stated | — | Their reliability isn't ours to improve; only our coupling to it is |
| The customer promise is narrower than "everything works" | Assumed | "I'll assume the contract's intent is the core transaction, not every feature" | Lets non-core paths degrade without counting as downtime |
| Our own releases cause outages too | Assumed | "I'll assume our change-failure rate is part of the budget, because it usually dominates" | Puts the release process in the availability design |
| Alternatives exist for at least one dependency | Assumed | "If not, that hop's reliability is a hard ceiling and I'd say so" | Determines whether parallel composition is available |

**The answer, out loud**

I'd open with the honest version, because a Principal panel is
listening for whether I'll say it: if all three dependencies sit in
series on the critical path, the composed availability is worse than
any one of them, and no amount of redundancy on *our* side fixes that.
Serial dependencies compose downward. So the first thing I'd tell
whoever signed the contract is that the current shape cannot deliver
it, and then I'd bring three ways to change the shape rather than
stopping at the bad news.

The first and best move is to get dependencies off the critical path
entirely. In practice at least one of the three is there because
somebody made a synchronous call where an asynchronous one would do —
a fraud check, an enrichment, a notification. If the result isn't
needed in the response, it goes behind Pub/Sub and stops being an
availability dependency at all. That's the highest-leverage change
available and it usually costs less than any redundancy work.

The second move is for dependencies that genuinely must be consulted
but don't have to be *live*. If I can cache their answers, or hold a
recent snapshot, or fall back to a conservative default, then their
outage becomes a degradation rather than a failure. A pricing service
that's down can be served from the last known good prices for a bounded
window. A recommendation service that's down returns a generic list.
The design rule is that every synchronous dependency needs a defined
behaviour when it's unavailable, and "the request fails" should be the
answer for as few of them as possible. Where a second provider exists,
that's the strongest version of the same idea: two providers in
parallel compose upward instead of downward, at the cost of running an
integration you use rarely and must therefore exercise deliberately.

The third move is the definition, and this is where most of these
contracts are actually settled. "Available" needs to mean something
specific: which operations, measured from where, over what window, with
which exclusions. If the contract means "customers can place orders,"
then a degraded browse experience isn't an outage and the three
dependencies may not all be in scope. If it means "every feature works
perfectly," nobody can hit four nines and the contract was written
without an engineer in the room. I'd bring proposed wording rather than
an objection — that's the difference between blocking and helping.

Then I'd widen it, because there's a risk in this conversation that
everyone is looking at the wrong thing. Most outages are caused by our
own changes, not by our dependencies. If the deploy process can take
the service down, the release pipeline is part of the availability
design: progressive rollout, one region at a time, automated rollback
on error-rate signal, and a change freeze around anything high-stakes.
Improving that usually buys more availability than hardening a
dependency, and it's entirely within our control.

Finally, whatever budget remains has to be visible. I'd define the SLO
below the contractual number so there's margin, track burn rate with
fast and slow alerting, and make it clear who is allowed to spend the
remaining budget on shipping features. An availability target with no
error budget and no named owner is a number in a document, and it will
be discovered to be untrue during the first bad quarter.

If after all of that the target still isn't reachable — a single
irreplaceable third party sitting synchronously on the core
transaction with a lower published target — then I'd say so plainly and
early, in writing, with the specific hop named. That's not a failure of
the architecture; it's the architecture telling the business something
it needs to hear before the penalty clause does.

**Architecture**

```
  THE PROBLEM
  request ──► [dep A] ──► [dep B] ──► [dep C] ──► response
              all SERIAL, all on the critical path.
              Serial dependencies compose DOWNWARD: the chain is
              worse than its weakest link, never better.     ◄── (1)

  MOVE 1 — REMOVE IT FROM THE PATH                            ◄── (2)
  request ──► [dep A] ──► response
                  │
                  └──► Pub/Sub ──► dep B (async)
        if the caller doesn't need the answer in the response,
        B stops being an availability dependency at all

  MOVE 2 — MAKE IT SURVIVABLE                                 ◄── (3)
  request ──► cache / last-known-good / conservative default
                  │  miss or stale-beyond-limit
                  ▼
              [dep C]   ── outage becomes DEGRADATION          ◄── (4)
  or, where a second provider exists:
  request ──► [dep C1] ∥ [dep C2]  ── parallel composes UPWARD ◄── (5)

  MOVE 3 — CHANGE THE DEFINITION                              ◄── (6)
  "available" = WHICH operations, measured WHERE, over WHAT
  window, with WHICH exclusions. Most of these contracts are
  settled here, not in engineering. Bring wording, not an objection.

  THE THING EVERYONE IS LOOKING AWAY FROM                     ◄── (7)
  our own releases cause more outages than our dependencies do:
  progressive rollout, one region at a time, automated rollback
  on error-rate signal, freeze around high-stakes windows

  WHAT'S LEFT — make it visible                               ◄── (8)
  SLO set BELOW the contractual number for margin; fast and slow
  burn-rate alerting; a named owner allowed to spend the budget  ◄── (9)

  Cross-cutting: every synchronous dependency needs a DEFINED
  behaviour when unavailable, and "the request fails" should be the
  answer for as few as possible (10); if one irreplaceable synchronous
  third party still caps the chain, say so early and in writing (11).
```

**Every arrow explained:**

1. **Serial composition goes the wrong way** — the chain is worse than
   its weakest member. Don't answer this question by adding redundancy
   on your own side; it doesn't touch the composition.
2. **Remove the dependency from the critical path** — the cheapest and
   most effective move available. Don't leave a call synchronous
   because it's already written that way; ask whether the response
   needs its answer.
3. **Cache, last-known-good, or a conservative default** — converts an
   outage into a degradation. Don't serve stale data past a bounded
   limit; beyond it, fail honestly rather than quietly serve something
   wrong.
4. **Degradation as a designed state** — named, tested and visible.
   Don't leave the unavailable behaviour undefined; undefined means
   whatever the timeout does, which is usually the worst option.
5. **Parallel providers compose upward** — two independent paths for
   one hop. Don't add a second provider you never exercise; an
   untested failover path is a decoration.
6. **Change the definition** — measured where, over what window, with
   what exclusions. Don't go into that conversation with an objection;
   go with proposed wording.
7. **Our own releases** — usually the dominant cause, and entirely
   within our control. Don't run an availability programme that only
   examines dependencies.
8. **SLO set below the contract** — margin between the number you
   manage to and the number you owe. Don't manage directly to the
   contractual figure; you'd have no room to absorb a bad week.
9. **Named owner for the error budget** — someone decides when to stop
   shipping. Don't leave the budget unowned; it will be spent by
   default and discovered when it's gone.
10. **Defined behaviour for every synchronous dependency** — the
    complete list is a design artefact. Don't accept "it returns an
    error" as a design for a dependency the customer's transaction
    needs.
11. **Say it early and in writing if the target is unreachable** — the
    architecture telling the business something true. Don't absorb an
    impossible commitment silently and hope.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| First move | Remove dependencies from the critical path | Add redundancy behind each dependency | Changes the composition itself, which redundancy on our side cannot | When every dependency genuinely must be live and synchronous — a real-time authorisation — then redundancy per hop is the only lever |
| Unavailable behaviour | Cached or conservative default with a bounded staleness limit | Fail the request | Turns an outage into a degradation for most dependency classes | When a stale or default answer would be wrong in a way that harms the customer — pricing on a binding offer, entitlement checks — then fail honestly |
| Second provider | Only where the integration will be exercised regularly | Add a fallback provider for every third party | An unexercised failover path is decoration that fails when used | When the dependency is critical enough to justify the cost of routinely running both — then dual-run and keep both warm |
| Contract | Renegotiate the definition, bringing wording | Accept the number and engineer toward it | Most of these targets are unachievable as written and achievable as intended | When the definition is already precise and narrow — then the engineering work is the real work and the wording won't help |
| Where to spend effort | Our own release process first | Dependency hardening first | Our changes usually cause more downtime, and we control them completely | When the change-failure rate is already low and measured — then the dependencies are genuinely the binding constraint |

**What a weak answer sounds like**

- "We'd add redundancy and monitoring." — neither changes serial
  composition, and the panel is specifically testing whether you know
  that.
- "We'd get the vendors to commit to a higher target." — occasionally
  possible, usually not, and it makes their reliability your plan.
- "Four nines is achievable with good engineering." — said without
  touching the dependency graph or the definition, which is where the
  achievability actually lives.
- "We'd exclude third-party outages from the SLA." — a reasonable
  clause stated as a trick rather than as a negotiated definition, and
  a customer will read it as evasion unless the degradation story is
  real.

**Common wrong turns**

- **Arguing the arithmetic and stopping.** Being right about
  composition is table stakes; the value is in what you change.
  Recover by moving straight to the three moves.
- **Treating the contract as immutable.** It was written by people who
  would generally rather have a precise achievable number than an
  impressive unachievable one. Recover by bringing wording.
- **Ignoring your own deploys.** The conversation is about vendors, so
  everyone looks outward. Recover by putting change-failure rate on the
  board next to the dependency chain.
- **Leaving degradation undefined.** Every dependency needs a named
  unavailable-behaviour. Recover by producing the list, because the
  gaps in it are the actual work.

**Follow-up probes the interviewer asks next**

1. **"Escalate: the one irreplaceable third party has a four-hour
   outage."** — the core transaction is unavailable for that window and
   I would have said so in advance, in writing, with that hop named.
   What I'd have built is the honest degradation: accept and queue the
   customer's intent where the business allows it, tell them clearly,
   and complete when the dependency returns — which converts a hard
   failure into a delay for at least some of the traffic.
2. **"You're at three dependencies now. What happens at thirty?"** — the
   composition gets much worse and the per-dependency approach stops
   scaling, so the design has to change shape: a small synchronous core
   with a defined, short dependency list, and everything else
   asynchronous behind it. At thirty, the discipline is a hard cap on
   how many hops the core transaction is allowed to make, enforced in
   review.
3. **"Who owns this in two years?"** — the service team owns the SLO and
   the error budget, and someone in the commercial function owns the
   contractual number. The failure mode is those two numbers drifting
   apart without anyone noticing until a penalty is claimed, so they
   belong in the same review.
4. **"How would you prove the degradation paths work?"** — by disabling
   each dependency deliberately in a rehearsal and confirming the
   defined behaviour actually occurs. A degradation path that has never
   been exercised is an assumption with a code path attached.
5. **"Sales wants to offer this target to a bigger customer."** — then
   the conversation happens before the signature, with the dependency
   list and the definition attached. I'd rather spend an hour on
   wording pre-sale than a quarter on penalties post-sale, and offering
   that hour is the most useful thing an architect does here.

**Cross-references**

- `03-comparisons/05-ha-dr-strategies.md` — burn-rate alerting and the
  distinction between tier selection and noticing degradation, behind
  callouts (8) and (9).
- `D2-Q10` for the tier decision this budget depends on, `D2-Q01` for
  the async spine that implements move one, `D2-Q15` for the same
  argument aimed at a leader who's already decided.

---
