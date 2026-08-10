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

## Primary constraints (rank order)

1. **Global low latency for live video** — the core product experience;
   architecture decisions bend around this first.
2. **Elastic scaling for bursty load** — must handle event-day spikes
   without over-provisioning for the 90%+ of time between events.
3. **Real-time data processing** — telemetry must feed live overlays
   within a tight latency budget, not just be durably stored for later.
4. **Cost efficiency between events** — a fixed, always-on capacity
   plan sized for race day wastes money the rest of the time.

## Reference architecture

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

## Question patterns this case study tends to produce

| Question shape | What it's really testing |
|---|---|
| "How should HRL reduce video start latency for global viewers?" | Cloud CDN + Global LB + regional edge presence (Domain 1 §1.3 network topology) |
| "How should HRL process vehicle telemetry for live overlays with minimal delay?" | Pub/Sub → Dataflow streaming (windowing/triggers) → low-latency serving path, not a batch pipeline |
| "How should HRL avoid overpaying for capacity between race events?" | Domain 4 §4.3 — autoscaling with scheduled pre-scaling, scale-to-zero-capable tiers (Cloud Run/GKE Autopilot) over fixed reserved capacity |
| "How should HRL secure their new AI commentary feature?" | Domain 3 §3.1 Securing AI — private Vertex AI endpoints, VPC-SC, DLP on any user-generated content flowing into prompts |
| "Vehicle telemetry writes are hotspotting on one Bigtable node — why?" | Domain 6 §6.2 — row-key design (sequential vehicle-ID-only keys), needs salting/hashing |

## Exam trap specific to this case study

The "always-on capacity" trap: sizing infrastructure for race-day peak
load and running it that way continuously is the wrong answer for a
company whose load is this bursty — the case study is testing whether
you recognize the schedule-driven autoscaling pattern (Domain 4's cost
optimization) rather than defaulting to "provision for peak, always."
