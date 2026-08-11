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
- **A small, fast-moving engineering team**: a studio launching its
  first global title typically doesn't have a large platform/SRE
  organization yet — operational-burden questions (how much undifferentiated
  infrastructure work the team must own) recur throughout this case
  study more than in the larger, more established companies in the
  other three case studies.

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

## Reference architecture — steady-state request path

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

## Reference architecture — the other three paths

### CI/CD path

```
  Developer commits ──► Cloud Build (game-session server
                          image, matchmaking API, telemetry
                          consumers — separate pipelines per
                          service so a matchmaking hotfix
                          doesn't require rebuilding/re-
                          testing the game-session binary)
                                │
                                ▼
                     Artifact Registry
                                │
                                ▼
                     Cloud Deploy — canary rollout per
                     region, with a launch-specific twist:
                     pre-launch, releases go through a
                     LOAD-TESTED staging environment sized
                     to simulate an extreme spike (given
                     the team can't rely on real launch-day
                     traffic to validate capacity beforehand)
                                │
                                ▼
                     GKE / MIGs, one region at a time,
                     automatic rollback on session-drop-
                     rate or matchmaking-latency SLO burn
```

**Why pre-launch load testing is a named step here, not an
afterthought:** unlike EHR Healthcare or TerramEarth, where production
traffic patterns are already known from existing operations, Mountkirk
is launching a *new* title with no production history — the case
study rewards recognizing that the CI/CD pipeline itself needs a
load-simulation gate before the real, unpredictable launch traffic
arrives, since there's no other way to validate the overprovisioning
buffer is correctly sized.

### Observability path

```
  Game-session tier (per region):
        │
        ▼
  Cloud Monitoring — custom metrics specific to multiplayer
  gaming (match-join latency, in-match tick/update latency,
  session-drop rate) — generic CPU/memory metrics alone
  don't capture what "degraded" means for real-time gameplay
        │
        ▼
  Cloud Trace — traces a player action from client → LB →
  regional game-session server → shared-state write, used
  to find where cross-region calls are accidentally leaking
  into the gameplay hot path (a common post-launch bug class:
  a "just call the global service, it's easier" shortcut that
  quietly reintroduces the latency the regional design avoided)

  Shared services tier (Spanner, leaderboard):
        │
        ▼
  Cloud Monitoring — Spanner-specific signals (CPU
  utilization per node, which drives read/write latency
  directly) feed an autoscaling/rightsizing decision distinct
  from the game-session tier's player-count-driven scaling

  Launch-specific: dashboards and alerting policies are
  deliberately over-provisioned with tighter thresholds and
  a larger on-call rotation for the first 48-72 hours post-
  launch, then relaxed to steady-state thresholds once real
  traffic patterns are established — an explicit example of
  "operational posture changes over the product lifecycle,"
  not a fixed one-time setup
```

### DR / failover path

```
  Scenario: a regional outage during active play

  Game-session tier: players connected to the failed
  region's servers lose their current match (state is
  regional, in-memory/near-real-time — accepting match loss
  on a rare regional outage is a reasonable tradeoff Mountkirk
  is expected to state explicitly, rather than engineering
  expensive cross-region session replication for gameplay
  state that changes many times per second)
        │
        ▼
  Global LB reroutes new connection attempts to the nearest
  healthy region — a disconnected player reconnects into a
  new match in a healthy region within seconds

  Shared services tier: Spanner multi-region config already
  tolerates a full regional outage without manual failover
  (that's what the multi-region config is *for* — the one
  part of the architecture that doesn't need an additional
  DR runbook, unlike the regional game-session tier above)

  Leaderboard/stats: Bigtable/Firestore replication (if
  configured) plus the Pub/Sub → Dataflow → BigQuery
  analytics path is durable and replay-tolerant — a regional
  outage delays analytics freshness but doesn't lose data,
  since Pub/Sub retains unacknowledged messages
```

## Alternatives considered and rejected

### 1. Cloud Spanner (or one global database) for game-session state too, not just accounts

- **The tempting case for it:** "we already have Spanner for global
  consistency, why not use it everywhere and simplify the stack to one
  database technology."
- **Why it's rejected here:** routing every real-time player action
  (many updates per second, per active match) through a globally
  consistent database reintroduces cross-region round-trip latency
  into the gameplay hot path — the exact problem the regional
  game-session design exists to avoid. Spanner's consistency guarantee
  is the wrong tool for data that's inherently regional and
  short-lived (a single match's live state), even though it's the
  right tool for data that's inherently global and durable (accounts).
- **What's used instead:** regional game-session state (in-memory or a
  regional low-latency store) kept separate from the global Spanner
  layer, which is reserved for account identity and cross-region
  leaderboard/rank data specifically.

### 2. Fixed, pre-provisioned capacity sized to a launch-day traffic forecast instead of autoscaling + overprovisioning buffer

- **The tempting case for it:** predictable cost, no risk of
  autoscaling lag during the highest-stakes traffic event the company
  will face, "just provision for the worst case we can imagine."
- **Why it's rejected here:** the case study's stated constraint is
  that launch traffic is *genuinely uncertain* — a fixed forecast-based
  plan either overspends dramatically if the guess is too high, or
  falls over publicly on launch day (reputationally the worst possible
  outcome for a game launch) if the guess is too low. Neither failure
  mode is acceptable, and there's no forecast confident enough to
  justify betting the whole launch on one fixed number.
- **What's used instead:** aggressive autoscaling with a deliberate
  capacity buffer/overprovisioning margin ahead of the launch window,
  scaled back down once real post-launch traffic patterns are known
  (see cost table below).

### 3. A single global leaderboard read path (query the durable Bigtable/Firestore store directly) instead of a regional Memorystore cache in front of it

- **The tempting case for it:** fewer moving parts — one system of
  record, one thing to keep consistent, no cache-invalidation logic to
  build.
- **Why it's rejected here:** a live, frequently-refreshed leaderboard
  UI is a read-heavy, latency-sensitive access pattern — querying the
  durable store directly on every player's leaderboard view would
  create unnecessary load on the system of record and add latency the
  cached path avoids. This is a standard cache-aside pattern, and the
  case study uses it to test whether candidates recognize when a
  caching layer belongs in front of a durable store versus when it's
  unnecessary complexity (contrast with EHR Healthcare, where no case
  study path calls for a Memorystore-style cache at all).
- **What's used instead:** Memorystore per region as a read-through
  cache in front of the Bigtable/Firestore leaderboard system of
  record.

## Cost and tradeoff discussion

Mountkirk's priority order — elastic launch-day scale, low regional
gameplay latency, split global/regional consistency, then post-launch
cost discipline — plus its smaller engineering team changes which
levers make sense compared to the other three case studies:

| Lever | Saves | Risk if misapplied here |
|---|---|---|
| Pre-launch overprovisioning buffer | Costs money *before* it's known to be needed | Necessary, not optional — the case study explicitly ranks avoiding a launch-day outage above pre-launch cost efficiency; the real cost discipline opportunity is post-launch, not pre-launch |
| Recommender API-driven rightsizing after real traffic is observed | Removes the launch buffer once actual demand is known, potentially the single largest post-launch savings | Low risk — this is the correct, case-study-intended lever; the trap is *not* revisiting the buffer once real data exists and leaving launch-day capacity running indefinitely |
| GKE Autopilot instead of self-managed GKE Standard node pools | Removes node-level ops burden from a small team that doesn't have a large platform organization | Low risk given the stated team-size constraint — this case study is one of the stronger signals in the whole exam for "reduce ops burden" pointing at Autopilot over Standard, contrast with a scenario stating deep existing K8s expertise (Tree 1's trap) |
| Using Spanner broadly instead of only for the shared-state layer that needs it | Simpler mental model | **High risk** — reintroduces the latency problem in Alternatives §1; Spanner's cost and latency profile are only justified for the data that actually needs global strong consistency |
| Skipping pre-launch load testing to ship faster | Faster time-to-launch | **High risk** — without empirical validation, the overprovisioning buffer is a guess, undermining constraint #1 the buffer exists to satisfy |

## Question patterns this case study tends to produce

| Question shape | Domain | What it's really testing |
|---|---|---|
| "How should Mountkirk Games handle uncertain launch-day traffic?" | 6 §6.2 | autoscaling + capacity buffer, not fixed reserved capacity sized to a guess |
| "How should real-time player actions be synchronized with low latency?" | 1 §1.3 | regional game-session placement, not routing every action through a global service |
| "How should the leaderboard stay fast to read but consistent globally?" | 1 §1.3 / comparisons | Memorystore cache + Bigtable/Firestore backing store, Spanner reserved for identity/account data specifically |
| "How should Mountkirk analyze game-balance data after launch?" | 1 §1.3 / 4 §4.3 | Pub/Sub → Dataflow → BigQuery, separate from the low-latency gameplay path |
| "Cost is spiraling after the initial launch spike subsided — what should change?" | 4 §4.3 | Recommender API rightsizing, scaling the overprovisioning buffer back down now that real traffic patterns are known |
| "The team is small and doesn't want to manage Kubernetes node pools — what compute choice fits?" | 1 §1.3 / Tree 1 | GKE Autopilot over GKE Standard — reduced ops burden explicitly matches the stated small-team constraint |
| "How should Mountkirk validate their capacity plan before the actual launch?" | 4 §4.1 | pre-launch load testing built into the release process, not a one-time capacity estimate trusted blindly |
| "A regional outage drops active matches during peak play — is losing those matches acceptable?" | 6 (SLO/error budget) | yes, an explicit, reasonable tradeoff for real-time in-memory match state versus the cost/complexity of cross-region gameplay-state replication — tests recognizing what's NOT worth engineering around |
| "How should Mountkirk structure their CI/CD pipeline for the game-session server vs. the matchmaking API?" | 5 §5.1 / 2 §2.3 | separate build/deploy pipelines per service, so an unrelated hotfix doesn't force a full-system redeploy |
| "Should on-call staffing/alerting thresholds be the same in month 3 as they were on launch day?" | 6 §6.1 | no — explicit operational-posture change over the product lifecycle (tighter/larger during launch window, relaxed once traffic patterns stabilize) |
| "How should a new regional deployment for a newly popular market (e.g. South America) be added?" | 5 §5.2 / Tree 6 | Terraform/IaC-driven repeatable regional buildout, not a manual Console-built one-off, since Mountkirk will likely expand regions again |
| "How does Mountkirk prevent the matchmaking API from being overwhelmed by a traffic spike distinct from gameplay servers themselves?" | 1 §1.3 / 6 §6.2 | matchmaking as its own scaled tier with its own SLOs — recognizing it's a separate bottleneck from the game-session tier, not the same capacity problem twice |
| "What's the risk of skipping Cloud Armor on the public matchmaking/API entry point?" | 3 §3.1 | a newly launched, high-visibility game is a realistic DDoS/abuse target; Cloud Armor at the LB is expected, not optional, for a public launch |

## Exam trap specific to this case study

1. **The "one database for everything" trap.** Routing
   gameplay-critical, latency-sensitive actions through the same global
   Spanner instance used for account data seems consistent and simple,
   but it reintroduces the cross-region latency the regional
   game-session design was built to avoid. The correct pattern splits
   *which* data needs global strong consistency (accounts/identity)
   from *which* needs regional low latency (live gameplay state) —
   treating "consistency" as a single global requirement for the whole
   system is the trap.
2. **The "static launch-day plan" trap.** Treating the pre-launch
   overprovisioning buffer and alerting thresholds as a permanent
   configuration rather than a temporary posture tied to launch-day
   uncertainty specifically. Once real post-launch traffic data exists,
   leaving launch-week capacity and staffing running unchanged is a
   cost-optimization miss the case study expects you to catch — the
   correct answer revisits and rightsizes after the uncertainty that
   justified the buffer is gone.
