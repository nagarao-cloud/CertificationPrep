# Domain 6 — Ensuring Solution and Operations Reliability (~12%)

> Source: `00-START-HERE/RUNBOOK.md` §3 (task wording reconstructed —
> see RUNBOOK §1). This domain is where Domain 1's stated RTO/RPO
> numbers and Domain 4's SLO/error-budget policy actually get
> implemented and kept healthy in production. Focus areas per RUNBOOK
> §3: HA vs. DR, RPO/RTO mapping, probes, SLO burn rates, Backup & DR
> service.

## Contents

1. [6.1 Monitoring/logging/profiling/alerting a solution](#61-monitoringloggingprofilingalerting-a-solution)
2. [6.2 Deployment and release management](#62-deployment-and-release-management)
3. [Backup and DR service deep dive](#backup-and-dr-service-deep-dive)
4. [Production architecture pattern: multi-region HA/DR with observability](#production-architecture-pattern-multi-region-hadr-with-observability)
5. [Worked scenario walkthrough](#worked-scenario-walkthrough-terramearth-style-fleet-telemetry-reliability)
6. [Domain 6-specific exam traps](#domain-6-specific-exam-traps)

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

### SLO burn rates — the mechanism, in depth

A named 2026 focus area (RUNBOOK §3) — "we have an SLO" is not the
same as "we alert correctly on it," and the exam expects the
distinction:

- **Burn rate** measures how fast the error budget is being consumed
  relative to the rate that would exactly exhaust it by the end of the
  SLO window (a burn rate of 1x means "on pace to exactly use up the
  whole budget by window end"; 10x means "consuming budget ten times
  faster than sustainable").
- **Why a single fixed threshold alert is the wrong default**: alerting
  only when the SLO is *already* breached is too late to act; alerting
  on every small blip (a naive "error rate > 0.1%" instant alert) causes
  alert fatigue from transient noise that self-corrects.
- **Multi-window, multi-burn-rate alerting** is the exam-expected
  pattern: pair a **short window + high burn-rate threshold** (catches
  a fast, severe incident quickly — e.g. a 1-hour window at a 14x burn
  rate, page immediately) with a **long window + lower burn-rate
  threshold** (catches a slow, sustained degradation that a short
  window would miss or dismiss as noise — e.g. a 6-hour window at a 6x
  burn rate, page but less urgently). Using only one window/threshold
  either misses slow-burn incidents or drowns on-call in noise from
  short-lived blips.

```
 Fast-burn alert (short window, high threshold)
   1-hour window, burn rate ≥ 14x  → page immediately
   Catches: a sudden severe outage before much of the budget is gone

 Slow-burn alert (long window, lower threshold)
   6-hour window, burn rate ≥ 6x   → page, less urgent
   Catches: a persistent, lower-severity degradation that a 1-hour
   window wouldn't reliably distinguish from noise

 Together: fast incidents are caught fast, slow incidents are still
 caught before the whole budget is silently consumed by window's end
```

- **Correct exam answer pattern**: a scenario describing "we missed a
  slow degradation that ate our whole error budget over a week" is
  signaling a missing long-window/low-threshold alert; a scenario
  describing "on-call is fatigued by alerts for blips that self-resolve
  in minutes" is signaling the short-window threshold is too
  sensitive or the long-window alert is missing (so every blip pages
  immediately instead of only genuinely fast, severe burns).

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

### Log sink selection — decision matrix

| Destination | Best for | Don't use when | Cost/latency profile |
|---|---|---|---|
| BigQuery | Ad hoc SQL analysis, joining logs with billing export (Domain 4 §4.2), dashboards over structured log data | Need the cheapest possible long-term archive with no query need | Query-optimized, higher storage cost than Cloud Storage |
| Cloud Storage | Long-term/compliance archive, cheapest at scale, pairs with lifecycle rules and Bucket Lock | Need to query the data regularly without an extra load step | Cheapest at rest, not directly queryable without loading elsewhere |
| Pub/Sub | Real-time downstream processing (e.g. triggering a Dataflow pipeline or an external SIEM) | Long-term storage — Pub/Sub isn't a retention store | Lowest latency to downstream consumers, no built-in long-term retention |
| Cloud Logging (default, no sink) | Short-term operational troubleshooting only | Any compliance, long-term, or cross-project aggregation need | Default retention window is limited — never the answer when "retain," "audit," or "long-term" appears in the scenario |

A single log stream is often routed to **more than one sink
simultaneously** (e.g. Pub/Sub for real-time alerting *and* Cloud
Storage for compliance archive) — a scenario naming both a real-time
and a long-term requirement is signaling two sinks, not a single
either/or choice.

### Capacity planning and load testing

- **Capacity planning is a reliability activity, not just a cost one**
  (contrast with Domain 4 §4.3's cost-focused rightsizing): the
  question here is "will this system stay within its SLO under
  expected peak load," not "are we spending the minimum amount."
- **Load testing before a known peak event**: a scenario describing an
  upcoming product launch, marketing campaign, or seasonal peak (e.g.
  Mountkirk Games' title launch) is signaling that pre-event load
  testing against production-like infrastructure — not just trusting
  the autoscaler to react in real time — is the correct preparatory
  step; autoscaling handles *unexpected* variation well, but a known,
  large, scheduled spike benefits from validated headroom ahead of
  time (see the overprovisioning/`min instances` floor pattern above).
- **Capacity planning inputs**: historical peak-to-average ratios,
  stated business growth projections (Domain 1 §1.2), and known
  future events (launches, migrations) all feed into where autoscaler
  ceilings and reserved-capacity floors should be set.

### Tradeoffs — observability design

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "Verify the service is reachable from the outside, not just internally healthy" | Uptime checks | Only internal CPU/memory metrics | Internal metrics can look fine while DNS/LB/firewall misconfiguration blocks real users |
| "Need long-term, tamper-evident audit log retention for compliance" | Cloud Storage sink with retention policy/Bucket Lock | Relying on default Cloud Logging retention | Default retention is time-limited and not purpose-built for immutable compliance archives |
| "Business wants to track order-processing time as a reliability metric" | Custom metric + SLO object in Cloud Monitoring | Infra-only metrics (CPU, latency at the LB) | The business SLO is defined in business terms; infra metrics alone don't capture it |
| "We missed a slow degradation that quietly ate our whole error budget over days" | Add a long-window, lower-burn-rate alert | Only a short-window, high-threshold alert | A single fast-burn alert structurally can't catch a slow, sustained burn — the long window is a different, necessary signal |
| "On-call is fatigued by pages for blips that self-resolve in minutes" | Tune/add the appropriate window-threshold pairing (multi-window burn-rate alerting) | Silence alerting altogether, or widen the SLO target itself | Silencing alerts or loosening the SLO both hide real signal; the fix is correctly-tuned burn-rate alerting, not giving up on alerting |

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
  with data-layer replication (Spanner multi-region, AlloyDB regional
  HA + cross-region read pool, or Cloud SQL cross-region replica
  promotion) — a global LB in front of a single-region database
  doesn't actually deliver regional failover.

### Container health and Cloud Run HA

- **GKE probe strategy** — see the mnemonic P.R.O.B.E. in
  `00-START-HERE/EXAM-TRAPS-AND-MNEMONICS.md`:
  - **Liveness probe** failure → container restarted. Set thresholds
    conservatively; an overly aggressive liveness probe under load
    causes a restart-loop that makes an overload incident worse.
  - **Readiness probe** failure → traffic stopped being routed to that
    pod, no restart. This is the correct mechanism for "don't send
    users to a pod that's still warming up" or "temporarily overloaded."
  - **Startup probe** (the third probe type, easy to forget): gates
    liveness/readiness checks until a slow-starting container has had
    enough time to initialize — the answer for "our container has a
    long startup sequence and keeps getting killed by the liveness
    probe before it finishes starting," instead of loosening the
    liveness probe's own thresholds (which would also weaken its
    ability to catch a genuine post-startup hang).
- **Cloud Run HA**: multi-region Cloud Run behind a global LB for
  regional failover; revisions + traffic splitting for safe rollout
  (see Domain 5 §5.1).

### Probe tuning — a worked comparison

| Symptom described | Wrong fix | Right fix | Why |
|---|---|---|---|
| Pod killed repeatedly during a slow startup sequence | Loosen liveness probe thresholds globally | Add/tune a startup probe | A startup probe delays liveness checking specifically during startup, without weakening liveness's ability to catch a genuine hang once running |
| Users see errors right after a new pod starts, before it's warmed up | Tune the liveness probe | Tune/add a readiness probe | Readiness controls traffic routing to a not-yet-ready pod; liveness only controls restarts |
| A hung (but still "alive") process keeps serving corrupted responses | Only a readiness probe | A liveness probe tuned to detect the actual hang condition (e.g. an app-level health endpoint that checks internal state) | Readiness alone would stop new traffic but leave the hung process running indefinitely; liveness is what actually replaces it |

### DR runbook contents — what "documented" actually means

Domain 4 §4.1 covers the *process* of keeping a DR runbook current
(drills, cadence); this is the *content* a Domain 6 implementation
needs the runbook to actually specify, concretely enough to execute
under incident pressure:

1. **Failover trigger criteria** — the specific, measurable condition
   that initiates failover (e.g. "primary region health check fails for
   N consecutive minutes"), not a vague "if things look bad."
2. **Failover mechanics, step by step** — which DNS/LB change, which
   database promotion command, in what order, with the expected
   duration of each step (feeds directly into whether the stated RTO
   is actually achievable).
3. **Data consistency verification** — how to confirm the failover
   target has the expected data state before resuming traffic (critical
   for any tier below Active-Active, where the standby may be behind).
4. **Rollback/fail-back plan** — how to safely return to the original
   primary once it recovers, without a second, avoidable outage caused
   by a careless fail-back.
5. **Communication plan** — who is notified, at what point, matching
   the incident-severity/escalation process from Domain 4 §4.2.

A scenario stating "we have a DR plan" without any of the above detail
is signaling an incomplete runbook — the exam rewards recognizing that
gap over assuming "a DR plan exists" is itself sufficient.

### Recovery planning — RPO/RTO framework

See Tree 5 in `00-START-HERE/DECISION-TREES.md` for the full
decision tree. Quick reference:

| Tier | RTO | RPO | Mechanism | Relative cost |
|---|---|---|---|---|
| Active-Active | seconds | ~0 | Multi-region Spanner/Firestore + global LB, writes accepted everywhere | Highest |
| Active-Passive | minutes | seconds–minutes | Hot standby, automated failover, cross-region sync/near-sync replication | High |
| Warm Standby | tens of minutes–hours | minutes–hours | Scaled-down replica, scale up on failover | Medium |
| Backup & Restore | hours–days | hours–a day | Scheduled backups, restore on demand | Lowest |

### HA vs. DR — the distinction the exam tests explicitly

- **High Availability (HA)** protects against *component-level*
  failure within a defined scope (a zone, sometimes a region) using
  redundancy that's already active or near-instantly available — the
  goal is to avoid the failure being noticed at all.
- **Disaster Recovery (DR)** protects against *large-scale* failure
  (a full region outage, a catastrophic data corruption event) via a
  separate, explicit recovery process — the goal is to recover within
  an agreed RTO/RPO, not to avoid any noticeable impact.
- **A design can have strong HA and weak DR, or vice versa**: Cloud
  SQL's regional HA (synchronous standby in a second zone) is a strong
  HA mechanism but provides no automatic *regional* DR — a scenario
  testing whether you conflate the two will describe a system with
  good zone-level redundancy and ask what happens if the *entire
  region* fails; the answer requires a distinct DR mechanism (Spanner,
  or a documented cross-region replica-promotion runbook), not "HA
  already covers it."

### Data protection, failover, and state management

- **Cloud SQL / AlloyDB availability**: regional HA (synchronous
  standby in a second zone, automatic failover) covers zone failure;
  cross-region read replicas/read pools (async) can be manually
  promoted for regional DR — automatic regional failover is not a
  default behavior for either engine, a scenario needing that should be
  pointed at Spanner instead.
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
  streaming-pipeline equivalent of a reliability control (see Domain 4
  §4.3 for the cost/optimization angle on the same mechanism).
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
- **GKE node upgrades**: surge upgrade settings (how many extra nodes
  are created before draining old ones) control the same speed-vs-risk
  tradeoff for cluster maintenance — pair with the release-channel
  choice from Domain 5 §5.1 for the full upgrade-risk picture.

### Tradeoffs — reliability implementation

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "Need automatic regional failover for the database, not just zone-level HA" | Cloud Spanner (multi-region config) | Cloud SQL/AlloyDB regional HA alone | Neither Cloud SQL's nor AlloyDB's regional HA covers cross-region failure automatically; cross-region failover requires manual replica/read-pool promotion |
| "Bigtable writes are hot on one node despite adding capacity" | Redesign the row key (salt/hash/reverse) | Add more Bigtable nodes | More nodes doesn't fix a key-design problem — the hot key still lands on one tablet regardless of cluster size |
| "Users see errors right after a new pod starts, before it's fully warmed up" | Tune/add a readiness probe | Tune the liveness probe | Readiness controls traffic routing to a not-yet-ready pod; liveness only controls restarts, and tightening it here would cause restart-loops instead of fixing the real issue |
| "Sudden traffic spikes outpace autoscaler reaction time" | Slight overprovisioning / a higher `min instances` floor | Rely on autoscaler reaction time alone | A capacity buffer absorbs the spike during the scale-up lag; pure reactive autoscaling has a latency gap by design |
| "Container has a long startup sequence and keeps getting restarted before finishing" | Add/tune a startup probe | Loosen the liveness probe's own thresholds | A startup probe solves the startup-timing problem specifically without weakening liveness's ability to catch a genuine post-startup hang |
| "Region-level redundancy is described as already solved because zone-level HA exists" | Confirm this is an HA/DR conflation and design an explicit DR mechanism | Assume the existing HA setup already covers a full regional outage | HA and DR are different scopes of protection; strong zone-level HA says nothing about regional failure resilience by itself |

---

## Backup and DR service deep dive

Named explicitly in RUNBOOK §3's focus areas — worth distinguishing
from application-level HA/replication mechanisms above:

- **What it is**: a centralized, managed backup-and-recovery service
  covering multiple workload types (Compute Engine disks, Cloud SQL,
  VMware workloads, and other supported sources) with centralized
  policy management, rather than each team configuring its own
  ad hoc backup scripts per resource type.
- **Backup plans as policy, not per-resource configuration**: a backup
  plan (frequency, retention, region) is defined once and applied
  across a fleet of resources — the same "policy over per-resource
  judgment" principle used throughout this folder (Org Policy in
  Domain 3, project factory in Domain 5) applied to backup/recovery
  specifically.
- **Centralized, immutable backup vaults**: backups can be stored in a
  vault with its own access controls and immutability settings,
  separate from the source resource's own IAM — protects against a
  scenario where the source resource (and an attacker with access to
  it) could otherwise also delete its own backups (a ransomware-style
  threat model).
- **When it's the answer vs. when native replication is the answer**:
  Backup and DR service is about *point-in-time recoverability*
  (restore to a known-good state after corruption, accidental deletion,
  or a ransomware event); Spanner multi-region/Cloud SQL regional HA
  are about *continuous availability* (avoid an interruption at all).
  A scenario describing "we need to recover from an accidental mass
  data deletion" wants backup/restore; a scenario describing "we can't
  tolerate a zone going down" wants HA/replication — these are
  different failure modes with different correct mechanisms, and a
  design serious about reliability needs both, not one substituting
  for the other.

### Tradeoffs — backup and DR service

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "Need to recover from accidental mass deletion or data corruption, not just a zone outage" | Backup and DR service with a defined backup plan and immutable vault | Relying on HA/replication alone | Replication faithfully copies a deletion/corruption to every replica too — HA doesn't protect against this failure mode at all; only point-in-time backup/restore does |
| "Different teams run inconsistent, ad hoc backup scripts across dozens of VMs" | Centralized backup plan/policy applied across the fleet | Continue per-team scripts | Centralized policy guarantees consistent frequency/retention and is auditable, unlike scattered scripts |
| "Concerned a compromised production credential could delete both the data and its backups" | An immutable backup vault with separate access controls from the source resource | Backups stored with the same IAM/access scope as the source | Separating the backup's access control from the source resource is exactly what defeats this specific threat model |

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
       │ liveness +     │   │ failover)     │   │ failover)     │
       │ startup probes │   └───────────────┘   └───────────────┘
       │ tuned)         │
       └───────┬───────┘
               ▼
       Cloud Spanner (multi-region config — synchronous, strongly
       consistent everywhere; this is what makes automatic regional
       failover safe without a manual promotion step)
               │
               ▼
       Backup and DR service: independent, immutable, scheduled
       backups — protects against corruption/deletion, a failure
       mode replication alone does not cover
               │
               ▼
       Cloud Monitoring SLO object (multi-window burn-rate alerting
       across all three regions) → Alerting policy → on-call rotation
               │
               ▼
       Cloud Logging sinks: BigQuery (ad hoc query), Cloud Storage
       w/ retention policy (compliance archive)
```

**Why this shape:** it satisfies the strictest tier of Tree 5
(Active-Active) end to end — global LB for traffic-level failover,
Spanner multi-region for data-level failover without a manual
promotion step, an independent backup layer for the corruption/deletion
failure mode HA doesn't cover, and a properly-tuned multi-window
SLO/alerting layer that makes the "reliability" half of Domain 6
measurable, not just architecturally implied. Downshift to the
Active-Passive or Warm Standby pattern (single writable region, async
replica) whenever the scenario's stated RTO/RPO doesn't justify this
tier's cost — see Tree 5 for the full downshift logic.

---

## Worked scenario walkthrough: TerramEarth-style fleet telemetry reliability

**Scenario fragment:** *"A heavy-equipment manufacturer's ~2 million
connected vehicles report telemetry every minute, ingested into
Bigtable for real-time dashboards and near-real-time predictive
maintenance alerts. Recently, write latency has spiked during the
morning shift-start period in each region, and on one occasion a
regional network issue caused an hour of missing telemetry that was
never recovered once connectivity returned. The reliability team also
reports several 'phantom' pages last month for a dashboard service that
recovered within two minutes each time, unrelated to the shift-start
issue."*

Applying the framework:

1. **Write latency spike at shift-start, in Bigtable**: this is a
   classic hotspotting signature — many vehicles reporting in a tight
   time window, if the row key includes a raw/sequential timestamp
   prefix, concentrates writes on whatever tablet currently owns that
   time range (§6.2 hotspotting). Fix: redesign the row key (salt or
   lead with a hashed device ID rather than a raw timestamp) — adding
   more Bigtable nodes, the tempting first instinct, doesn't fix a
   key-design problem.
2. **An hour of telemetry never recovered after connectivity
   returned**: this is a data-durability/DR gap, not a hotspotting
   issue — the ingestion pipeline apparently has no buffering/replay
   mechanism for a connectivity gap. The fix is architectural (a
   durable queue such as Pub/Sub in front of Bigtable, so a downstream
   outage doesn't lose data already accepted, plus device-side local
   buffering with retry) rather than a backup/DR service answer — the
   Backup and DR service protects stored data, not data that was never
   successfully ingested in the first place.
3. **"Phantom" pages for a 2-minute self-recovering dashboard issue**:
   this is the alert-fatigue signature of a burn-rate alert threshold
   tuned too aggressively for a short window (§6.1) — a brief,
   self-resolving blip is exactly what a well-tuned short-window/
   high-threshold pairing should *not* page on if it doesn't represent
   a fast, severe burn; the fix is retuning the burn-rate thresholds
   (and confirming a longer-window alert exists to catch genuinely
   slow degradations instead), not disabling alerting for that service.

**Result**: three distinct reliability failure modes in one scenario —
a hotspotting problem, a data-durability/ingestion-design gap, and an
alerting-tuning problem — each requiring the specific Domain 6
mechanism built for it, illustrating why "reliability" questions in
this domain usually require distinguishing between several
superficially-similar-sounding but mechanistically distinct failure
modes.

---

## Domain 6-specific exam traps

1. Assuming Cloud SQL or AlloyDB regional HA covers regional (not just
   zonal) failure — it doesn't, automatically; that gap is exactly what
   Spanner or manual cross-region replica/read-pool promotion is for.
2. Tuning the liveness probe to fix a readiness-shaped problem (traffic
   routed to a not-yet-ready pod) — this is one of the most common
   Domain 6 trap patterns; always check whether the failure mode is
   "should this pod be restarted" (liveness), "should this pod
   receive traffic right now" (readiness), or "hasn't finished starting
   yet" (startup) before picking which probe to adjust.
3. Adding Bigtable nodes to fix a hotspotting problem that's actually a
   row-key design problem — capacity doesn't fix a key-design issue.
4. Forgetting that a global LB alone doesn't deliver regional DR without
   a data layer that can also fail over — the LB and the database tier
   have to be designed together for the pattern to actually work.
5. Conflating HA and DR — a system with strong zone-level HA is not
   automatically protected against a full regional outage, and a
   system with a solid DR runbook doesn't need every component
   individually replicated for zone-level HA if the DR mechanism
   already covers the recovery requirement within the stated RTO/RPO.
6. Treating a single-threshold alert as sufficient SLO monitoring —
   multi-window, multi-burn-rate alerting (a fast-burn short-window
   pairing with a slow-burn long-window) is the exam-expected pattern,
   and a scenario describing either missed slow degradations or
   alert fatigue is pointing at a specific half of that pairing being
   absent or mistuned.
7. Reaching for Backup and DR service to solve a continuous-availability
   problem, or reaching for multi-region replication to solve a
   data-corruption/accidental-deletion problem — these two mechanisms
   protect against different failure modes and neither substitutes for
   the other.
