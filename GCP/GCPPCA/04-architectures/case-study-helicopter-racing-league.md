# Case Study: Helicopter Racing League (HRL)

> One of the 4 case studies the exam draws 2-of-4 from (RUNBOOK §2).
> Reconstructed from the case study's well-established public profile
> (live global sports streaming, real-time analytics, 2026 AI-commentary
> addition) — see the accuracy note in `case-study-ehr-healthcare.md`'s
> header, same caveat applies here (RUNBOOK §1).

## Company profile

HRL streams live helicopter/drone racing events to a global audience,
with real-time telemetry from race vehicles and (2026-era addition)
AI-assisted commentary/highlight generation. Characteristics driving
the architecture:

- **Global, latency-sensitive live video**: viewers everywhere,
  streaming quality/latency is core to the product experience.
- **Real-time telemetry ingestion**: vehicle sensor data arriving
  continuously during live events, feeding both live overlays
  (speed/position graphics) and post-event analytics.
- **Bursty, event-driven load**: traffic spikes sharply during live
  races and drops to near-zero between events — very different load
  shape from EHR Healthcare's steady clinical usage.
- **AI-assisted commentary/highlights (2026 focus area)**: generative
  AI summarizing race moments, generating highlight reels, and
  augmenting live commentary — the Securing AI and Vertex AI cost/perf
  optimization material (Domain 3 §3.1, Domain 4 §4.3) leans on this
  case study specifically.
- **Venue-side edge presence**: races happen at physical venues with
  on-site camera/sensor rigs and local production trucks — a real,
  if secondary, hybrid-edge footprint that's easy to overlook next to
  the flashier global-streaming story.

## Primary constraints (rank order)

1. **Global low latency for live video** — the core product experience;
   architecture decisions bend around this first.
2. **Elastic scaling for bursty load** — must handle event-day spikes
   without over-provisioning for the 90%+ of time between events.
3. **Real-time data processing** — telemetry must feed live overlays
   within a tight latency budget, not just be durably stored for later.
4. **Cost efficiency between events** — a fixed, always-on capacity
   plan sized for race day wastes money the rest of the time.

## Reference architecture — steady-state request/ingest path

```
                         Global viewers
                              │
                              ▼
                ┌──────────────────────────┐
                │ Global External App LB    │  ◄── Cloud CDN (video
                │ + Cloud Armor             │      segment caching
                └──────────┬────────────────┘      at the edge)
                            │
              ┌──────────────┼──────────────┐
              ▼               ▼               ▼
      Region: US-based  Region: EU-based  Region: APAC-based
      viewers served    viewers served    viewers served
      from nearest      from nearest      from nearest
      regional edge     regional edge     regional edge

      Live video ingest (from race-vehicle cameras) →
      transcoding pipeline → CDN-distributed segments

                Vehicle telemetry (position, speed, biometrics)
                              │
                              ▼
                        Pub/Sub (global ingest,
                        ordering key = vehicle ID
                        for per-vehicle sequential
                        telemetry)
                              │
              ┌────────────────┼────────────────┐
              ▼                                 ▼
      Dataflow (streaming)              Bigtable (durable store,
      → windowed aggregates              row-key salted by
      → live overlay graphics            vehicle+time-bucket to
      (low-latency path)                 avoid hotspotting —
              │                          S.A.L.T. mnemonic)
              ▼
      Live broadcast graphics layer
      (speed/position overlays)

                Post-event: Vertex AI (Model Garden + Agent
                Builder) generates highlight reels and AI-
                assisted commentary from telemetry + video,
                grounded in the Bigtable/BigQuery historical
                data (RAG pattern) — private Vertex AI endpoint,
                inside a VPC-SC perimeter (Securing AI, Domain 3)

      Autoscaling: GKE Autopilot (app/API tier) with min-instance
      floors raised sharply in the hours before a scheduled race
      (predictable-schedule autoscaling, not purely reactive) and
      allowed to scale to near-zero between events
```

**Why Bigtable for telemetry, not Cloud SQL:** the ingestion rate
(many vehicles, high-frequency sensor readings during a live event) and
access pattern (time-series, per-vehicle range scans) match Bigtable's
strengths directly — see the storage decision tree
(`00-START-HERE/DECISION-TREES.md` Tree 2) and the row-key hotspotting
guidance in Domain 6 §6.2.

**Why predictable-schedule autoscaling, not purely reactive:** live
races have a known schedule — the case study's signature "smart"
answer is pre-scaling ahead of a known event start time (a scheduled
floor increase) combined with reactive autoscaling for in-event
variance, rather than relying on reactive autoscaling alone to catch up
fast enough for a sudden, large, *predictable* spike.

## Reference architecture — the other three paths

### CI/CD path

```
  Developer commits ──► Cloud Build (builds transcoding-
                          pipeline containers, overlay-
                          graphics service, API tier images)
                                │
                                ▼
                     Artifact Registry
                                │
                                ▼
                     Cloud Deploy — staged rollout gated
                     on a hard business rule this case
                     study is built to test: NEVER deploy
                     a new release to the live-video or
                     telemetry path during a scheduled race
                     window — deployments happen in the
                     gap between events, validated against
                     a replay of a prior race's telemetry
                     stream first (canary against recorded
                     data, not live traffic, given the
                     cost of a mid-race regression)
                                │
                                ▼
                     GKE Autopilot / Cloud Run revisions,
                     traffic-split rollout with automatic
                     rollback on error-rate/latency SLO burn
```

**Why "never deploy during a live event" is a first-class rule here:**
unlike EHR Healthcare (continuous clinical load, no natural deployment
window) or Mountkirk (continuous online play), HRL has a genuinely
quiet period between scheduled events — the case study rewards
recognizing that natural deployment window rather than defaulting to
always-on continuous-delivery cadence.

### Observability path

```
  Live event path (video + telemetry + overlays):
        │
        ▼
  Cloud Monitoring — tight, low-latency-budget SLOs
  (e.g. p99 overlay-graphic latency, telemetry-to-
  broadcast delay) monitored in real time DURING events,
  with pager thresholds tuned tighter than the between-
  events baseline (an SLO breach during a live broadcast
  is a different severity than the same breach at 3am
  with no race running)
        │
        ▼
  Cloud Trace — end-to-end trace from vehicle sensor
  ingest through Dataflow to the overlay-graphics
  render, used to find where in the pipeline latency
  budget is being spent when it creeps up

  Between-events path (analytics, AI highlight generation):
        │
        ▼
  Cloud Logging → BigQuery sink (race-by-race analytics,
  historical performance trends) — looser latency
  tolerance, cost-optimized batch-style log export is
  fine here unlike the live path
```

**Why the same observability stack needs two different postures:** the
live-event path and the between-events analytics path have wildly
different latency/cost tradeoffs — treating all of HRL's monitoring
uniformly (either all real-time-tight, or all cost-optimized-loose)
misses the case study's bursty, bimodal operating profile.

### DR / failover path

```
  Scenario: a regional outage during a live, in-progress race

  Region: primary broadcast region (nearest the venue)
        │
        ▼
  Global External LB already load-balances viewers across
  regions — video/CDN path fails over near-instantly to
  healthy regions (this part behaves like the generic
  multi-region pattern's Active-Active data-serving tier)

  Telemetry path: Pub/Sub is a global, durable service —
  a regional Dataflow worker pool failure doesn't lose
  in-flight messages (they're redelivered once a healthy
  worker pool picks them up), but DOES risk a live-overlay
  gap for the duration of failover — an accepted tradeoff
  this case study expects you to name explicitly: the
  video broadcast keeps running even if overlay graphics
  briefly drop out, because video continuity outranks
  overlay completeness in HRL's stated priority order

  Bigtable: cluster replication (if configured multi-
  cluster) keeps the durable telemetry store available;
  the LIVE overlay path degrades gracefully rather than
  the whole broadcast going down — no single point of
  total-outage failure for the live product
```

## Alternatives considered and rejected

### 1. Cloud SQL (or another relational store) for vehicle telemetry instead of Bigtable

- **The tempting case for it:** telemetry has a clear per-vehicle
  schema, and relational databases are the "default" answer many
  candidates reach for when they see structured, schema-shaped data.
- **Why it's rejected here:** the write throughput during a live event
  (many vehicles, high-frequency readings, all arriving concurrently)
  and the access pattern (time-series range scans per vehicle, not
  transactional joins) are exactly Bigtable's design center and
  exactly where Cloud SQL's single-writer-instance model would become
  the bottleneck. This is Tree 2's core lesson: "structured-looking
  data" doesn't automatically mean "relational database" once the
  scale/throughput numbers are in view.
- **What's used instead:** Bigtable with a salted row key.

### 2. Purely reactive autoscaling instead of scheduled pre-scaling

- **The tempting case for it:** reactive (metric-driven) autoscaling
  is simpler to configure — one policy, no manual schedule to maintain
  — and is the textbook default for "handle variable load."
- **Why it's rejected here:** HRL's load spikes are large, sudden, and
  *known in advance* (a race has a published start time). Reactive
  autoscaling reacts to a metric crossing a threshold, which for a
  step-function spike this large and this fast means real users hit
  underprovisioned capacity during the scale-up lag — unacceptable for
  a live broadcast's opening moments. This is precisely the "scenario
  gives you a predictable schedule, use it" pattern the exam rewards
  over defaulting to "autoscaling solves everything."
- **What's used instead:** scheduled minimum-instance floor increases
  ahead of each race's start time, combined with reactive autoscaling
  layered on top for in-event variance beyond the pre-scaled floor.

### 3. Public, unrestricted Vertex AI endpoint for the AI commentary feature instead of a private, VPC-SC-wrapped one

- **The tempting case for it:** simpler network setup, faster to stand
  up, and HRL's core product (live video) is public-facing anyway, so
  it can feel consistent to keep the new AI feature public too.
- **Why it's rejected here:** the AI commentary/highlight feature is
  grounded (RAG) against HRL's proprietary telemetry and historical
  race data — a public endpoint widens the exposure surface for that
  proprietary data and for prompt/output governance (what the model
  is allowed to say on a live broadcast is a real business-risk
  concern, not just a security checkbox). Domain 3's Securing AI
  material specifically tests this "public-facing product ≠ public
  AI endpoint" distinction.
- **What's used instead:** a private Vertex AI endpoint inside the
  same VPC-SC perimeter as the telemetry data it's grounded on, with
  DLP/output governance in front of anything that reaches the live
  broadcast.

## Cost and tradeoff discussion

HRL's priority order — global low latency, elastic bursty scaling,
real-time processing, then between-event cost efficiency — shapes
which levers are safe to pull:

| Lever | Saves | Risk if misapplied here |
|---|---|---|
| Scale-to-zero-capable compute (Cloud Run / GKE Autopilot) between events | The single biggest lever — HRL's load is genuinely near-zero most of the time, unlike EHR Healthcare's steady clinical baseline | Low risk if the scheduled pre-scaling floor is respected before each event — the trap is scaling to zero and relying on purely reactive scale-up for race day (see Alternatives §2) |
| Cloud CDN caching for video segments | Reduces egress and origin load dramatically for a global audience | Low risk — this is close to a free win for any global video product; the trap would be *not* using it |
| Committed Use Discounts on baseline capacity | Some savings on the always-on control-plane/API tier | Limited upside — HRL's baseline (non-event) footprint is intentionally small, so CUDs matter less here than for EHR Healthcare's steady-state fleet |
| Batch-style (loose-latency) processing for post-event AI highlight generation | Cheaper Vertex AI/Dataflow usage by not requiring real-time SLAs for a task that doesn't need them | Low risk — correctly matches the between-events path's looser latency tolerance (see Observability path above); the trap is applying this same loose posture to the LIVE overlay path by mistake |
| Reducing regional redundancy for the live-video LB tier to save cost | Fewer regions to run edge presence in | **High risk** — directly undermines constraint #1 (global low latency); a viewer far from the remaining regions gets a worse experience, which is the one thing this case study says must not happen |

## Question patterns this case study tends to produce

| Question shape | Domain | What it's really testing |
|---|---|---|
| "How should HRL reduce video start latency for global viewers?" | 1 §1.3 | Cloud CDN + Global LB + regional edge presence |
| "How should HRL process vehicle telemetry for live overlays with minimal delay?" | 1 §1.3 / 6 §6.1 | Pub/Sub → Dataflow streaming (windowing/triggers) → low-latency serving path, not a batch pipeline |
| "How should HRL avoid overpaying for capacity between race events?" | 4 §4.3 | scheduled pre-scaling, scale-to-zero-capable tiers (Cloud Run/GKE Autopilot) over fixed reserved capacity |
| "How should HRL secure their new AI commentary feature?" | 3 §3.1 | Securing AI — private Vertex AI endpoints, VPC-SC, DLP on any user-generated content flowing into prompts |
| "Vehicle telemetry writes are hotspotting on one Bigtable node — why?" | 6 §6.2 | row-key design (sequential vehicle-ID-only keys), needs salting/hashing |
| "When should HRL deploy new releases to the live-broadcast pipeline?" | 4 §4.1 / 6 §6.2 | recognizing the natural between-events deployment window and gating deploys away from live race windows, canarying against replayed data |
| "A live overlay graphic briefly disappears during a regional failover but video keeps streaming — is that acceptable?" | 6 §6.1 (SLO/error budget) | yes — reflects HRL's stated priority order (video continuity over overlay completeness); tests whether you'll over-engineer full redundancy for a lower-priority component |
| "How should HRL structure on-call alerting differently during a live race vs. between events?" | 6 §6.1 | tighter SLO/pager thresholds during live windows (M.A.P.S. — Alerting layered on Monitoring), looser/batched thresholds between events |
| "How should venue-side production trucks connect to GCP during a race?" | 1 §1.3 / Tree 3 | match connectivity tier to the venue's timeline and bandwidth needs — likely Partner Interconnect or a fast-to-provision VPN for a temporary/mobile site, not a permanent Dedicated Interconnect build |
| "How should HRL keep AI-generated commentary from saying something inaccurate live on air?" | 3 §3.1 | prompt/output governance as a named control (not just endpoint privacy) — grounding in verified telemetry/historical data (RAG) plus a review/guardrail layer before output reaches the broadcast |
| "How should post-event analytics scale differently from the live telemetry pipeline?" | 1 §1.3 / 4 §4.3 | separate batch-tolerant path (BigQuery, looser SLA) from the low-latency streaming path — same telemetry, two different downstream consumption models |
| "A new region is added mid-season for a new race venue — what changes?" | 1 §1.3 / 5 §5.2 | Terraform-driven, repeatable regional buildout (Tree 6) rather than a manual one-off Console setup, given HRL will likely repeat this expansion |
| "How does HRL avoid a single Pub/Sub ordering key becoming a bottleneck under high message volume from one vehicle?" | 6 §6.2 | ordering keys guarantee per-key sequential delivery, not unlimited per-key throughput — recognizing the throughput/ordering tradeoff, same family of trap as Bigtable hotspotting |

## Exam traps specific to this case study

1. **The "always-on capacity" trap.** Sizing infrastructure for
   race-day peak load and running it that way continuously is the
   wrong answer for a company whose load is this bursty — the case
   study is testing whether you recognize the schedule-driven
   autoscaling pattern (Domain 4's cost optimization) rather than
   defaulting to "provision for peak, always."
2. **The "uniform observability posture" trap.** Applying the same
   tight, real-time-tuned SLO thresholds to the between-events
   analytics path (or the same loose, batch-friendly thresholds to the
   live-event path) misses that HRL genuinely needs two different
   operating postures for the same underlying telemetry data,
   depending on whether a race is currently live.
