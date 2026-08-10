# Case Study: Mountkirk Games

> One of the 4 case studies the exam draws 2-of-4 from (RUNBOOK §2).
> Reconstructed from the case study's well-established public profile
> (multiplayer online game launch, global low-latency, leaderboards) —
> see the accuracy note in `case-study-ehr-healthcare.md`'s header, same
> caveat applies here (RUNBOOK §1).

## Company profile

Mountkirk Games is launching a new multiplayer online game with a
global player base. Characteristics driving the architecture:

- **Launch-day uncertainty**: traffic could be modest or could spike
  far beyond forecast — the architecture must handle both without
  either overspending upfront or falling over at launch.
- **Low-latency, real-time multiplayer**: player actions need
  near-real-time propagation to other players in the same match —
  latency budget is tight and global.
- **Global player base, regional matchmaking**: players should be
  matched with/served from nearby infrastructure to minimize latency,
  while shared systems (accounts, leaderboards, matchmaking) need
  global consistency.
- **Real-time leaderboards and analytics**: player stats, rankings, and
  in-game economy data need both a fast read path (live leaderboard UI)
  and an analytical path (game-balance/business analytics).

## Primary constraints (rank order)

1. **Elastic scale for unpredictable, possibly extreme launch traffic**
   — the architecture must not assume a known ceiling.
2. **Low, consistent latency for real-time gameplay** — regional
   placement of the game-session tier is non-negotiable.
3. **Global consistency for shared state** (accounts, leaderboards)
   without sacrificing regional latency for gameplay itself — these two
   needs point at different services for different parts of the system,
   which is the case study's core architectural lesson.
4. **Cost discipline post-launch** — once initial demand stabilizes,
   the architecture should right-size rather than staying provisioned
   for worst-case launch-day uncertainty forever.

## Reference architecture

```
                         Global players
                              │
                              ▼
                ┌──────────────────────────┐
                │ Global External App LB    │  ◄── routes players
                │ (matchmaking/API entry)   │      to nearest region
                └──────────┬────────────────┘
                            │
              ┌──────────────┼──────────────┐
              ▼               ▼               ▼
      Region: NA         Region: EU         Region: APAC
      ┌───────────┐      ┌───────────┐      ┌───────────┐
      │Game session│      │Game session│      │Game session│
      │servers     │      │servers     │      │servers     │
      │(GKE or     │      │(GKE or     │      │(GKE or     │
      │ Compute    │      │ Compute    │      │ Compute    │
      │ Engine     │      │ Engine     │      │ Engine     │
      │ MIGs,      │      │ MIGs,      │      │ MIGs,      │
      │ aggressive │      │ aggressive │      │ aggressive │
      │ autoscaling│      │ autoscaling│      │ autoscaling│
      │ + overprov-│      │ + overprov-│      │ + overprov-│
      │ isioning   │      │ isioning   │      │ isioning   │
      │ buffer)    │      │ buffer)    │      │ buffer)    │
      └─────┬─────┘      └─────┬─────┘      └─────┬─────┘
            │                   │                   │
            └───────────────────┼───────────────────┘
                                 ▼
                    Global shared services layer
                ┌─────────────────────────────────┐
                │ Cloud Spanner (multi-region)      │  ◄── accounts,
                │  — strong consistency needed      │      player
                │    globally                        │      identity
                └─────────────────────────────────┘
                ┌─────────────────────────────────┐
                │ Memorystore (per-region, cache    │  ◄── live
                │  of the leaderboard's hot data)   │      leaderboard
                └─────────────┬───────────────────┘       reads
                               ▼
                ┌─────────────────────────────────┐
                │ Bigtable / Firestore (leaderboard  │  ◄── durable
                │  and player-stats system of        │      leaderboard
                │  record — high write throughput)   │      state
                └─────────────────────────────────┘
                               │
                               ▼
                ┌─────────────────────────────────┐
                │ Pub/Sub → Dataflow → BigQuery      │  ◄── game
                │  (game telemetry/event pipeline)   │      analytics,
                └─────────────────────────────────┘       balance data
```

**Why regional game-session servers but a global Spanner for accounts:**
this is the case study's signature lesson — not every part of the
system has the same consistency/latency tradeoff. Gameplay itself needs
regional placement for latency (a global database in the hot path of
every player action would add unacceptable round-trip time); account
identity and cross-region leaderboards need Spanner's global strong
consistency because a player's account/rank must be correct everywhere,
immediately. Splitting the system this way — instead of picking one
service for everything — is exactly what Domain 1 §1.3's "compute and
storage design" is testing.

**Why overprovisioning + aggressive autoscaling, not autoscaling
alone:** launch-day traffic is uncertain in a way HRL's scheduled-event
traffic isn't — Mountkirk doesn't know the exact spike shape in
advance. A capacity buffer (Domain 6 §6.2's overprovisioning technique)
absorbs the reaction-time gap of pure autoscaling during an
unpredictable, possibly extreme launch spike.

## Question patterns this case study tends to produce

| Question shape | What it's really testing |
|---|---|
| "How should Mountkirk Games handle uncertain launch-day traffic?" | Domain 6 §6.2 — autoscaling + capacity buffer, not fixed reserved capacity sized to a guess |
| "How should real-time player actions be synchronized with low latency?" | Domain 1 §1.3 — regional game-session placement, not routing every action through a global service |
| "How should the leaderboard stay fast to read but consistent globally?" | Domain 1 §1.3 / comparisons — Memorystore cache + Bigtable/Firestore backing store, Spanner reserved for identity/account data specifically |
| "How should Mountkirk analyze game-balance data after launch?" | Data/analytics pipeline — Pub/Sub → Dataflow → BigQuery, separate from the low-latency gameplay path |
| "Cost is spiraling after the initial launch spike subsided — what should change?" | Domain 4 §4.3 — Recommender API rightsizing, scaling the overprovisioning buffer back down now that real traffic patterns are known |

## Exam trap specific to this case study

The "one database for everything" trap: routing gameplay-critical,
latency-sensitive actions through the same global Spanner instance used
for account data seems consistent and simple, but it reintroduces the
cross-region latency the regional game-session design was built to
avoid. The correct pattern splits *which* data needs global strong
consistency (accounts/identity) from *which* needs regional low latency
(live gameplay state) — treating "consistency" as a single global
requirement for the whole system is the trap.
