# Domain 6 — Ensuring Solution and Operations Reliability (~12%)

> Source: `00-START-HERE/RUNBOOK.md` §3 (task wording reconstructed —
> see RUNBOOK §1). This domain is where Domain 1's stated RTO/RPO
> numbers and Domain 4's SLO/error-budget policy actually get
> implemented and kept healthy in production.

## Contents

1. [6.1 Monitoring/logging/profiling/alerting a solution](#61-monitoringloggingprofilingalerting-a-solution)
2. [6.2 Deployment and release management](#62-deployment-and-release-management)
3. [Production architecture pattern: multi-region HA/DR with observability](#production-architecture-pattern-multi-region-hadr-with-observability)
4. [Domain 6-specific exam traps](#domain-6-specific-exam-traps)

---

## 6.1 Monitoring/logging/profiling/alerting a solution

### Cloud Monitoring

- **Uptime checks**: synthetic, external checks against a public
  endpoint — the answer for "verify from outside our network that the
  service is actually reachable," distinct from internal metrics which
  can look healthy while the public path is broken.
- **Custom metrics**: application-emitted metrics (e.g. queue depth,
  business KPIs) beyond the built-in infrastructure metrics — needed
  whenever a scenario's SLO is defined in business terms ("95% of
  orders processed within 2 minutes") rather than raw infra terms.
- **SLO objects**: Cloud Monitoring lets you define an SLO directly
  (e.g. availability or latency SLI over a rolling window) and tracks
  error-budget burn automatically — this is the implementation of
  Domain 4 §4.1's error-budget *policy*.
- **Alerting policies**: threshold-, rate-of-change-, or
  absence-of-signal-based; route to the correct notification channel
  (email, Pub/Sub, PagerDuty-style integrations) matched to the
  incident's stated severity.

### Cloud Logging

- **Log Router and sinks**: route logs to BigQuery (ad hoc analysis),
  Cloud Storage (cheap long-term retention/compliance), or Pub/Sub
  (real-time downstream processing) — pick the sink by what you need to
  *do* with the logs, not by default.
- **Log-based metrics**: turn a log pattern (e.g. a specific error
  string) into a metric you can alert on, without changing application
  code to emit a new custom metric.
- **Exports for compliance**: a scenario requiring long-term immutable
  audit retention wants a Cloud Storage sink with a retention policy /
  Bucket Lock, not "logs stay in Cloud Logging forever" (which has
  default retention limits and isn't the durable-archive answer).

### Cloud Trace and Cloud Profiler

- **Cloud Trace**: distributed latency breakdown across service calls —
  the answer whenever a scenario asks "where is the time going" across
  a multi-service request path.
- **Cloud Profiler**: continuous, low-overhead CPU/heap profiling in
  production — the answer for "why is this specific service using so
  much CPU/memory," as opposed to Trace's cross-service latency focus.

### Tradeoffs — observability design

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "Verify the service is reachable from the outside, not just internally healthy" | Uptime checks | Only internal CPU/memory metrics | Internal metrics can look fine while DNS/LB/firewall misconfiguration blocks real users |
| "Need long-term, tamper-evident audit log retention for compliance" | Cloud Storage sink with retention policy/Bucket Lock | Relying on default Cloud Logging retention | Default retention is time-limited and not purpose-built for immutable compliance archives |
| "Business wants to track order-processing time as a reliability metric" | Custom metric + SLO object in Cloud Monitoring | Infra-only metrics (CPU, latency at the LB) | The business SLO is defined in business terms; infra metrics alone don't capture it |

---

## 6.2 Deployment and release management

### Compute resilience and autohealing

- **MIG autohealing**: a health check tied to the MIG automatically
  recreates unhealthy instances — the default answer for "self-heal a
  stateless compute tier" without custom scripting.
- **Active-standby architectural model**: a scaled-down (or zero-scale)
  standby that activates on failover — the mechanism behind the Warm
  Standby tier in Tree 5 (`00-START-HERE/DECISION-TREES.md`).

### Network availability and load balancing

- **Global vs. regional load balancers**: global LBs route around a
  regional outage automatically (traffic shifts to healthy regions);
  regional LBs do not — a stated multi-region DR requirement needs a
  global LB tier, not a regional one, even if per-region traffic
  volume alone wouldn't justify it.
- **Multi-region connectivity for HA/DR**: pair the LB tier decision
  with data-layer replication (Spanner multi-region, or Cloud SQL
  cross-region replica promotion) — a global LB in front of a
  single-region database doesn't actually deliver regional failover.

### Container health and Cloud Run HA

- **GKE probe strategy** — see the mnemonic P.R.O.B.E. in
  `00-START-HERE/EXAM-TRAPS-AND-MNEMONICS.md`:
  - **Liveness probe** failure → container restarted. Set thresholds
    conservatively; an overly aggressive liveness probe under load
    causes a restart-loop that makes an overload incident worse.
  - **Readiness probe** failure → traffic stopped being routed to that
    pod, no restart. This is the correct mechanism for "don't send
    users to a pod that's still warming up" or "temporarily overloaded."
- **Cloud Run HA**: multi-region Cloud Run behind a global LB for
  regional failover; revisions + traffic splitting for safe rollout
  (see Domain 5 §5.2).

### Recovery planning — RPO/RTO framework

See Tree 5 in `00-START-HERE/DECISION-TREES.md` for the full
decision tree. Quick reference:

| Tier | RTO | RPO | Mechanism | Relative cost |
|---|---|---|---|---|
| Active-Active | seconds | ~0 | Multi-region Spanner/Firestore + global LB, writes accepted everywhere | Highest |
| Active-Passive | minutes | seconds–minutes | Hot standby, automated failover, cross-region sync/near-sync replication | High |
| Warm Standby | tens of minutes–hours | minutes–hours | Scaled-down replica, scale up on failover | Medium |
| Backup & Restore | hours–days | hours–a day | Scheduled backups, restore on demand | Lowest |

### Data protection, failover, and state management

- **Cloud SQL availability**: regional HA (synchronous standby in a
  second zone, automatic failover) covers zone failure; cross-region
  read replicas (async) can be manually promoted for regional DR —
  automatic regional failover is not a Cloud SQL default behavior, a
  scenario needing that should be pointed at Spanner instead.
- **State/session management**: externalize session state (Memorystore,
  a database) so any compute instance can serve any request — a
  prerequisite for both autoscaling (Domain 1 §1.2) and clean failover
  (an instance holding local session state can't be replaced
  transparently).

### Dynamic scaling patterns

| Compute tier | Scaling mechanism | Reliability-relevant tuning |
|---|---|---|
| GKE | HPA (pods) + cluster autoscaler (nodes); consider overprovisioning (a small buffer of idle capacity) to absorb sudden spikes faster than a cold autoscale-up | Overprovisioning trades a small constant cost for avoiding scale-up latency during a real spike |
| Cloud Run | Concurrency + min/max instances | Cold starts matter for latency-sensitive services — set a `min instances` floor above zero when the SLO can't tolerate cold-start latency |
| Compute Engine (MIGs) | Autoscaler based on CPU/custom metrics | Combine with autohealing so scale-out and self-repair use the same health signal |

### Data integrity under load (hotspotting)

See the S.A.L.T. mnemonic in `00-START-HERE/EXAM-TRAPS-AND-MNEMONICS.md`.

- **Bigtable hotspotting**: sequential/monotonic row keys (e.g. raw
  timestamps as a prefix) concentrate writes on one node/tablet — salt
  or reverse the key, or use a hash prefix, to spread load.
- **Dataflow out-of-order data**: windowing + watermarks + triggers
  handle late-arriving events without losing correctness — the
  streaming-pipeline equivalent of a reliability control.
- **Cloud Storage hotspotting**: sequential object-name prefixes
  (e.g. incrementing IDs) can create hot ranges at extreme request
  rates — randomize/hash the prefix for very high-throughput write
  patterns.

### Maintenance and patching strategies

- **On-host maintenance / live migration**: Compute Engine
  transparently live-migrates VMs off hardware needing maintenance by
  default — a scenario worried about "will maintenance cause downtime"
  is usually answered by confirming live migration is enabled (it is,
  by default, for most machine types) rather than needing a custom
  failover.
- **MIG update policies**: control surge/max-unavailable during a
  patch rollout to balance speed against risk, same mechanism as a
  code rollout (Domain 4 §4.3).

### Tradeoffs — reliability implementation

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "Need automatic regional failover for the database, not just zone-level HA" | Cloud Spanner (multi-region config) | Cloud SQL regional HA alone | Cloud SQL's regional HA only covers zone failure within a region; cross-region failover requires manual replica promotion |
| "Bigtable writes are hot on one node despite adding capacity" | Redesign the row key (salt/hash/reverse) | Add more Bigtable nodes | More nodes doesn't fix a key-design problem — the hot key still lands on one tablet regardless of cluster size |
| "Users see errors right after a new pod starts, before it's fully warmed up" | Tune/add a readiness probe | Tune the liveness probe | Readiness controls traffic routing to a not-yet-ready pod; liveness only controls restarts, and tightening it here would cause restart-loops instead of fixing the real issue |
| "Sudden traffic spikes outpace autoscaler reaction time" | Slight overprovisioning / a higher `min instances` floor | Rely on autoscaler reaction time alone | A capacity buffer absorbs the spike during the scale-up lag; pure reactive autoscaling has a latency gap by design |

---

## Production architecture pattern: multi-region HA/DR with observability

```
                        Global External App LB
                     (auto-routes around a region
                      that fails its health check)
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
       Region A (primary)  Region B (standby)  Region C (standby)
       ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
       │ GKE (min=N,    │   │ GKE (min=1,   │   │ GKE (min=1,   │
       │ readiness +    │   │ scales up on  │   │ scales up on  │
       │ liveness       │   │ failover)     │   │ failover)     │
       │ probes tuned)  │   └───────────────┘   └───────────────┘
       └───────┬───────┘
               ▼
       Cloud Spanner (multi-region config — synchronous, strongly
       consistent everywhere; this is what makes automatic regional
       failover safe without a manual promotion step)
               │
               ▼
       Cloud Monitoring SLO object (tracks error budget across all
       three regions) → Alerting policy → on-call rotation
               │
               ▼
       Cloud Logging sinks: BigQuery (ad hoc query), Cloud Storage
       w/ retention policy (compliance archive)
```

**Why this shape:** it satisfies the strictest tier of Tree 5
(Active-Active) end to end — global LB for traffic-level failover,
Spanner multi-region for data-level failover without a manual
promotion step, and an SLO/alerting layer that makes the "reliability"
half of Domain 6 measurable, not just architecturally implied. Downshift
to the Active-Passive or Warm Standby pattern (single writable region,
async replica) whenever the scenario's stated RTO/RPO doesn't justify
this tier's cost — see Tree 5 for the full downshift logic.

---

## Domain 6-specific exam traps

1. Assuming Cloud SQL regional HA covers regional (not just zonal)
   failure — it doesn't, automatically; that gap is exactly what
   Spanner or manual cross-region replica promotion is for.
2. Tuning the liveness probe to fix a readiness-shaped problem (traffic
   routed to a not-yet-ready pod) — this is one of the most common
   Domain 6 trap patterns; always check whether the failure mode is
   "should this pod be restarted" (liveness) or "should this pod
   receive traffic right now" (readiness) before picking which probe
   to adjust.
3. Adding Bigtable nodes to fix a hotspotting problem that's actually a
   row-key design problem — capacity doesn't fix a key-design issue.
4. Forgetting that a global LB alone doesn't deliver regional DR without
   a data layer that can also fail over — the LB and the database tier
   have to be designed together for the pattern to actually work.
