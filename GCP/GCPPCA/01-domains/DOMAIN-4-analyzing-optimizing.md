# Domain 4 — Analyzing and Optimizing Technical and Business Processes (~18%)

> Source: `00-START-HERE/RUNBOOK.md` §3 (task wording reconstructed —
> see RUNBOOK §1). This domain tests continuous improvement: given a
> running system, what's the correct next optimization, and what
> process should surface it. Focus areas per RUNBOOK §3: cost/
> performance tuning, Recommender API, Dataflow triggers, sustainability.

## Contents

1. [4.1 Analyzing and defining technical processes](#41-analyzing-and-defining-technical-processes)
2. [4.2 Analyzing and defining business processes](#42-analyzing-and-defining-business-processes)
3. [4.3 Development and operations](#43-development-and-operations)
4. [Recommender API deep dive](#recommender-api-deep-dive)
5. [Production architecture pattern: cost/performance feedback loop](#production-architecture-pattern-costperformance-feedback-loop)
6. [Worked scenario walkthrough](#worked-scenario-walkthrough-mountkirk-games-style-cost-and-performance-review)
7. [Domain 4-specific exam traps](#domain-4-specific-exam-traps)

---

## 4.1 Analyzing and defining technical processes

### SDLC and CI/CD process design

- A mature pipeline separates **CI** (build, unit test, static
  analysis, container scan via Artifact Registry vulnerability
  scanning) from **CD** (Cloud Deploy: staged rollout dev → staging →
  prod with approval gates).
- **Testing strategy** the exam expects you to recognize: unit tests in
  CI, integration tests against a staging environment, and
  canary/blue-green validation in production *before* full rollout —
  not "test only in production" and not "manual QA sign-off only" for
  anything described as high-velocity or high-scale.
- **Shift-left testing**: catching defects as early in the pipeline as
  possible (static analysis and unit tests in CI) is cheaper than
  catching them in staging, which is cheaper than catching them in
  production — a scenario describing frequent production incidents
  traced to preventable bugs is a signal to strengthen the *earlier*
  stages of the pipeline, not just add more production monitoring.

### Business continuity / DR planning (process, not just technology)

Domain 1 elicits the RTO/RPO numbers; Domain 6 implements the failover
mechanism; **Domain 4 is the process layer in between** — defining
*how* those numbers get validated (DR drills, chaos engineering,
documented runbooks) and kept current as the system evolves. A scenario
asking "how often should we test our DR plan" or "what process ensures
our runbook stays accurate" is a Domain 4 question, not Domain 6.

- **DR drill cadence**: the correct exam answer is *regular, scheduled,
  and realistic* (e.g. quarterly failover drills using the actual
  documented runbook, not a tabletop discussion alone) — a scenario
  where a real failover event revealed the runbook was outdated is
  signaling that drills weren't happening or weren't realistic enough.
- **Chaos engineering**: deliberately injecting failure (killing an
  instance, simulating a zone outage) in a controlled way to validate
  resiliency assumptions *before* a real incident tests them — the
  answer whenever a scenario wants confidence in failover behavior
  beyond "we believe it would work."
- **Runbook currency**: a runbook that isn't updated alongside
  architecture changes silently rots — a process question about "how do
  we keep operational documentation accurate" wants runbook updates
  treated as a required step in the change-management process (§4.2),
  not a separate, optional task.

### Monitoring/alerting strategy design (process layer)

Domain 6 covers the *implementation* (Cloud Monitoring, alert
policies); Domain 4 covers the *process* — defining what SLOs matter,
what error budget policy governs release velocity when the budget is
burned, and what the on-call/escalation process looks like.

```
 Define SLO (e.g. 99.9% success rate, rolling 30 days)
        │
        ▼
 Track error budget consumption
        │
        ▼
 Error budget healthy? ──yes──► ship features at normal velocity
        │no
        ▼
 Freeze new feature launches, prioritize reliability work
 until budget recovers
```

### Selecting which SLOs matter (process, not just numbers)

- **Start from user-facing outcomes, not infrastructure metrics**: an
  SLO should describe what the *user* experiences (successful checkout
  rate, page-load latency) — infrastructure metrics (CPU, memory) are
  useful signals but rarely the SLO itself, since a system can have
  healthy infrastructure metrics while users experience failures
  (a downstream dependency timing out, for example).
- **Fewer, well-chosen SLOs beat many**: a process that tracks a dozen
  SLOs dilutes attention and makes "is the error budget policy
  triggered" ambiguous — the exam rewards designs that pick the
  handful of SLOs that actually represent business-critical user
  journeys.
- **Review cadence**: SLO targets themselves should be periodically
  revisited (same "revisit trigger" logic as Domain 1 §1.5) as the
  system and its usage patterns evolve — a target set at launch may be
  too loose (masking real problems) or too strict (needlessly freezing
  feature work) a year later.

### Tradeoffs — technical process design

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "Frequent production bugs that unit tests should have caught" | Strengthen CI (more unit/integration test coverage, static analysis gates) | Add more production monitoring/alerting | Monitoring tells you a bug happened; shift-left testing prevents it from shipping in the first place — treat the root cause, not just the symptom |
| "Last real failover event revealed the runbook was stale" | Regular, realistic DR drills using the actual runbook | An annual tabletop discussion | Only executing the real runbook (not just talking through it) reliably surfaces staleness before a real incident does |
| "We track a dozen SLOs and nobody agrees on when to freeze feature work" | Consolidate to a small number of user-outcome-based SLOs with one clear error-budget policy | Keep all SLOs and add more dashboards | Dilution of focus is the actual problem — more visualization doesn't fix an unclear governance target |

---

## 4.2 Analyzing and defining business processes

### Change and incident management

- **Change management process**: who approves production changes, what
  the rollback criteria are, defined *before* an incident, not
  improvised during one.
- **Incident management**: severity classification, escalation paths,
  and blameless postmortems feeding back into the technical-process
  design in §4.1 — a recurring incident category is a signal to invest
  in prevention (better testing, better monitoring), which is the
  "optimize the process, not just patch the symptom" pattern the exam
  rewards.
- **Blameless postmortems specifically**: the exam frames incident
  review as a *systems* question (what process/control gap allowed
  this) rather than an individual-accountability question — a scenario
  answer that focuses on "who made the mistake" instead of "what
  process should have caught this" is the wrong shape of answer even
  if the underlying service recommendation is otherwise correct.

### Team dynamics and Conway's Law

- **Conway's Law**: system architecture tends to mirror the
  communication structure of the organization that builds it — a
  scenario describing tightly-coupled services owned by teams that
  don't communicate well is signaling an *organizational* fix
  (realign team ownership boundaries to match desired service
  boundaries) alongside or instead of a purely technical
  microservices refactor.
- **Team topology implications for architecture decisions**: a small,
  single team favors fewer, simpler services (a modest number of
  Cloud Run services or a well-organized monolith); many independent
  teams favor clearer service boundaries and stronger API contracts
  between them (more services, more emphasis on Apigee/Cloud Endpoints
  governance from Domain 5 §5.1) — matching architecture granularity to
  team structure, not defaulting to microservices regardless of team
  size, is the tested judgment call.

### Cost management, showback/chargeback

| Mechanism | Purpose |
|---|---|
| Billing export to BigQuery | Enables custom cost analysis/dashboards beyond the built-in Billing reports |
| Labels on resources | Attribute cost to team/project/environment for showback (visibility) or chargeback (actual billing) |
| Budgets and budget alerts | Proactive notification before overspend, not just after-the-fact reporting |
| Recommender API | Automated rightsizing, idle-resource, and commitment-purchase suggestions — the process-automation answer for "how do we keep finding savings without a dedicated FinOps team" |
| Cost anomaly detection | Automated flagging of spend that deviates from historical patterns — the answer for "catch a runaway cost incident (e.g. a misconfigured autoscaler) before the monthly bill arrives," distinct from a fixed-threshold budget alert |

### Showback vs. chargeback — the distinction the exam tests

- **Showback**: cost visibility is provided to teams (a dashboard
  showing "your team spent $X this month") but there's no actual
  internal billing transaction — the goal is awareness and
  self-correction.
- **Chargeback**: cost is actually billed/transferred internally
  between cost centers, with real budget/accounting consequences.
- **Which one a scenario wants**: "we want teams to be cost-aware" is
  showback; "finance needs to allocate actual cloud spend to each
  business unit's budget" is chargeback. Both use the same underlying
  mechanism (labels + billing export), so the distinguishing detail is
  the *organizational process* around the data, not the GCP
  configuration — a common trap is over-engineering the technical
  answer when the scenario is really asking about process/policy.

### Procurement processes

- **Vendor/service onboarding as a defined process**: a scenario
  describing ad hoc adoption of new SaaS tools or cloud services
  without a review step (security, cost, compliance) is signaling a
  procurement-process gap — the fix is a lightweight, defined intake
  process (not necessarily heavyweight bureaucracy) that checks new
  spend/tooling against the same governance model already applied to
  infrastructure (Org Policy-equivalent review, cost visibility from
  day one).
- **Reserved capacity and commitment purchasing as a procurement
  decision, not just a technical one**: Committed Use Discount
  purchases (§4.3) function like a procurement commitment — the
  process question is *who* has authority to commit spend at that
  level and on what cadence they review it, which is a business-process
  answer even though the underlying mechanism is a GCP billing feature.

### Sustainability (2026 emphasis, see RUNBOOK §7)

- **Carbon Footprint tool**: reports gross/net carbon emissions
  attributable to your GCP usage, broken down by project/service —
  answer for "we need to report our cloud carbon footprint."
- **Region selection for lower emissions**: some Google Cloud regions
  run on grids with a higher share of carbon-free energy; a scenario
  emphasizing sustainability *and* giving latitude on region choice is
  signaling this as a legitimate tiebreaker (never override a hard
  latency/residency constraint for it).
- **Sustainability and cost optimization are often aligned, not
  competing**: rightsizing, autoscaling to actual demand, and using
  more efficient managed services (serverless over always-on VMs) tend
  to reduce both cost and carbon footprint simultaneously — the exam
  doesn't usually frame these as a tradeoff against each other; treat a
  scenario naming both goals as reinforcing rather than conflicting
  most of the time.
- **When sustainability and a hard constraint conflict**: if a lower-
  carbon region would violate a stated data-residency requirement,
  residency wins — sustainability is a tiebreaker among otherwise-valid
  options, never an override of a compliance or latency requirement
  the business explicitly stated.

### Carbon Footprint tool — measurement mechanics

- **Gross vs. net emissions**: gross reflects raw usage-based emissions;
  net accounts for Google's carbon-neutral operations offsets applied
  to your allocated share — a scenario asking for external
  sustainability reporting (e.g. to satisfy an ESG disclosure
  requirement) typically wants the figure that matches what the
  reporting framework requires; know both exist rather than assuming
  only one number is available.
- **Breakdown granularity**: emissions data is broken down by
  project/service, mirroring the same labels-and-billing-export pattern
  used for cost showback/chargeback — a scenario wanting
  "carbon cost per team" is solved with the same organizational
  discipline (consistent labeling) as its financial-cost counterpart,
  not a separate tracking system.
- **Region carbon-intensity data feeds the Domain 1 §1.3 region
  selection decision** when residency/latency don't already force a
  specific choice — this is the concrete mechanism behind the "region
  selection for lower emissions" tiebreaker mentioned above.

### Tradeoffs — business process analysis

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "Finance wants to see cost per team without a dedicated tooling investment" | Labels + billing export to BigQuery + built-in reports | Building a custom cost-allocation system from scratch | Native tooling covers showback/chargeback without additional engineering |
| "We want savings to keep happening without a standing team watching bills" | Recommender API + automated policies (e.g. auto-apply low-risk rightsizing) | One-time manual cost review | The scenario is asking for a *process*, and Recommender API is the automatable version of that process |
| "A misconfigured autoscaler caused a spend spike we didn't notice for days" | Cost anomaly detection + tighter budget alert thresholds | Waiting for the monthly bill / a fixed static budget threshold alone | Anomaly detection catches deviation from the normal pattern in near-real-time; a static threshold set high enough to avoid false alarms can miss a spike well before it triggers |
| "Two regions meet our latency/residency requirements equally well; sustainability is also a stated goal" | Choose the lower-carbon region (Carbon Footprint tool data) as the tiebreaker | Ignore sustainability since a hard constraint is already satisfied | When a stated goal doesn't conflict with a hard constraint, it should still influence the choice among otherwise-equal options |
| "Teams keep building duplicate, tightly-coupled services because nobody owns the shared boundary" | Realign team ownership to match desired service boundaries (Conway's Law fix) | A purely technical microservices refactor without an ownership change | The architecture keeps re-forming around the same broken communication structure unless the organizational root cause is addressed too |

---

## 4.3 Development and operations

### Release management patterns

| Pattern | Mechanism | When it's the answer |
|---|---|---|
| Canary | Cloud Run traffic splitting, GKE with a service mesh or manual traffic-split ingress | Scenario wants to validate a change on a small % of real traffic before full rollout |
| Blue/green | Two full environments, switch traffic atomically (LB backend swap) | Scenario wants instant, fully-tested rollback capability, willing to pay for duplicate capacity during the switch |
| Rolling update | MIG update policy (surge/max-unavailable), GKE rolling deployment | Default for most stateless workloads — balances safety and resource cost without a full duplicate environment |
| Shadow / dark launch | New version receives a mirrored copy of production traffic but its responses aren't served to users | Scenario wants to validate a new version's *behavior/performance* under real traffic without any user-facing risk at all — stricter than canary |

### DevOps/SRE practices

- **Toil reduction**: recurring manual operational work (the kind
  Domain 4 process analysis is meant to surface) should be automated —
  a scenario describing a repeated manual task is signaling "the
  correct answer involves automating this," not "hire more people to do
  it faster."
- **Error budgets** (see §4.1) govern the tension between shipping
  velocity and reliability — this is the SRE-practice answer whenever a
  scenario asks "how do we balance feature velocity against stability."
- **Postmortem-driven backlog prioritization**: incidents that recur
  should generate prioritized engineering work (§4.2), not just repeat
  the same manual mitigation each time.

### Toil reduction — recognizing it in a scenario

| Described symptom | Toil category | Automation answer |
|---|---|---|
| "An engineer manually resizes VMs every week based on a spreadsheet" | Manual, repetitive, no lasting value | Recommender API rightsizing + autoscaling |
| "On-call manually restarts a service that crashes under load every few days" | Reactive, avoidable with self-healing | MIG autohealing / GKE liveness probes (Domain 6 §6.1) |
| "New project requests take two weeks of manual IAM/network setup" | Process toil, not infra toil | Project factory pattern (Domain 5 §5.2) |
| "Someone manually checks a dashboard every morning for cost anomalies" | Manual monitoring that should be event-driven | Budget alerts / cost anomaly detection (§4.2) |

The exam-tested pattern: describe the toil, then match it to the
*specific* automation mechanism that removes the recurring manual step
— "hire more people" or "write better documentation for the manual
process" are both wrong-shaped answers when the scenario's real ask is
automation.

### Error budget policy — what it actually specifies

An error budget *policy* (as opposed to just the SLO number) is a
documented, agreed-upon process artifact that should specify, at
minimum:

1. The SLO and its measurement window (e.g. rolling 30 days).
2. What happens when the budget is exhausted (freeze feature launches,
   redirect the team to reliability work) — and who has authority to
   grant an exception.
3. How "spend" is tracked and communicated (a visible burn-rate
   dashboard, not a number only SREs can see).
4. A review cadence for the SLO target itself (see §4.1's "review
   cadence" note above).

A scenario describing disagreement between a feature team and an SRE
team about whether to ship during a reliability freeze is testing
whether you recognize the *policy* (agreed in advance, applied
consistently) as the answer — not an ad hoc, case-by-case negotiation
each time the budget is tight.

### Cost optimization deep dive

| Technique | Best for | Don't use when | Why the alternative loses |
|---|---|---|---|
| Committed Use Discounts (CUD) | Steady, predictable baseline load (1 or 3-year commitment for a discount) | Load is variable/unpredictable, or the workload/architecture is likely to change materially before the commitment ends | Locks in spend against capacity you may not use, or against a machine shape you may migrate away from |
| Preemptible / Spot VMs | Fault-tolerant, interruptible batch/stateless workloads — never for stateful, always-on services | Workload can't tolerate sudden termination without graceful handling | Spot capacity can be reclaimed with short notice; an architecture without retry/checkpoint logic will lose work |
| Rightsizing (via Recommender API) | Over-provisioned VMs/MIGs found by looking at actual utilization, not requested size | Utilization data is too new/thin to be reliable (e.g. a workload only run once) | Rightsizing off insufficient data risks under-provisioning a workload whose real peak hasn't been observed yet |
| Autoscaling floor/ceiling tuning | Spiky workloads — avoid both over-provisioning (wasted floor) and under-provisioning (missed SLA at ceiling) | Perfectly steady load (CUD is the better lever there) | Autoscaling solves a variability problem; applying it to steady load adds complexity without matching savings |
| Storage class lifecycle rules | Data that cools off over time (see Domain 2 §2.2) | Data accessed unpredictably or frequently even if "old" | Moving frequently-accessed data to a colder class trades a small storage saving for expensive retrieval costs and latency |

### Performance tuning and right-sizing (with monitoring integration)

```
 Cloud Monitoring utilization data (CPU, memory, custom app metrics)
        │
        ▼
 Recommender API surfaces a rightsizing suggestion
        │
        ▼
 Validate against SLO headroom (don't rightsize below what the
 error-budget policy requires)
        │
        ▼
 Apply via IaC (Terraform change, reviewed) — not a manual Console edit
```

### Vertex AI / Dataflow workload optimization (2026 focus area)

| Concern | Mechanism |
|---|---|
| Vertex AI model serving cost | Multi-model endpoints (share infrastructure across models), autoscaling min/max replica tuning |
| Vertex AI model drift | Model Monitoring — detects training/serving skew, triggers retraining pipelines |
| Feature Store latency/cost | Online store for low-latency serving, offline store for training — don't serve production traffic from the offline store |
| Dataflow cost/performance | Autoscaling worker caps, choosing streaming engine vs. worker-based shuffle appropriately, tuning windowing/triggers to avoid unnecessary reprocessing |

### Dataflow triggers and windowing — the optimization angle

A named 2026 focus area (RUNBOOK §3) worth its own depth beyond "Domain
4 mentions Dataflow":

- **Windowing strategies**: fixed windows (simple, predictable
  batching), sliding windows (overlapping, for rolling-average-style
  metrics), session windows (grouped by gaps in activity, e.g. a user
  session) — choosing the wrong window type either wastes compute
  (recomputing overlapping data unnecessarily) or produces
  business-incorrect results (session windows are the answer whenever
  a scenario describes grouping events by user activity gaps, not a
  fixed clock interval).
- **Triggers**: control *when* a window emits results — the default
  (wait for the watermark) is correct for most cases, but a scenario
  needing faster (if provisional) results wants **early triggers**
  (emit speculative results before the watermark, refine later), and a
  scenario with very late-arriving data wants **late triggers**
  (allow results to be revised after the watermark passes) — picking
  the wrong trigger strategy either delays business-critical
  dashboards unnecessarily or silently drops legitimately late data.
- **Cost angle**: over-aggressive triggering (emitting results too
  frequently) increases downstream write/compute cost for marginal
  freshness gain — a scenario emphasizing cost control on a streaming
  pipeline is a signal to widen trigger intervals or windows, not
  necessarily to reduce worker count, which affects throughput
  capacity more than emission frequency.
- **Autoscaling worker caps**: Dataflow's Streaming Engine offloads
  state management from workers, letting workers scale more
  efficiently for variable load — the answer whenever a scenario
  describes a streaming pipeline with highly variable throughput and
  worker-based autoscaling isn't reacting fast enough.

### Tradeoffs — development and operations

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "Need to validate a risky change on real traffic before full exposure" | Canary (traffic splitting) | Blue/green or big-bang rollout | Canary limits blast radius to a small % while still using real traffic, cheaper than a full duplicate blue/green environment |
| "Need to validate new-version *behavior* under real traffic with zero user-facing risk" | Shadow/dark launch | Canary | Canary still exposes real users to the new version, even if only a few; shadow traffic exposes none |
| "Batch job, can tolerate interruption, cost is the priority" | Preemptible/Spot VMs | On-demand or reserved VMs | Spot pricing is dramatically cheaper for genuinely interruption-tolerant workloads — reserved capacity wastes the discount opportunity |
| "Steady 24/7 baseline load, known for the next year" | Committed Use Discount | Autoscaling / on-demand only | CUD directly discounts predictable baseline; autoscaling is solving a variability problem this workload doesn't have |
| "AI model serving cost is high but traffic is spiky" | Autoscaling Vertex AI endpoint with tuned min/max replicas | Fixed always-on replica count | Fixed capacity either overspends at trough or underserves at peak — same autoscaling principle as compute, applied to model serving |
| "Streaming pipeline groups events by user activity, not fixed time intervals" | Session windows | Fixed or sliding windows | Session windows are purpose-built for gap-based grouping; forcing a fixed-time window either splits a session incorrectly or pads unnecessary latency |
| "Streaming dashboard needs faster (even if provisional) numbers" | Early triggers | Wait for the default watermark-only trigger | Early triggers emit speculative, refinable results sooner — the default trades speed for a completeness guarantee this scenario doesn't need yet |

---

## Recommender API deep dive

Named explicitly as a focus area in RUNBOOK §3 — worth more than a
one-line mention given how often it's the mechanism behind a Domain 4
"how do we keep finding savings/improvements" answer.

### What it covers

| Recommender type | Surfaces |
|---|---|
| VM rightsizing | Over/under-provisioned Compute Engine instances based on observed utilization |
| Idle resource | Unattached persistent disks, idle IPs, unused images/snapshots |
| Committed use discount | Suggested CUD purchases based on sustained historical usage patterns |
| IAM | Over-privileged principals (permissions granted but never used) — feeds directly into Domain 3 §3.1's least-privilege remediation |
| Firewall rule insight | Overly permissive or unused firewall rules |
| Error Reporting-linked recommendations | Recurring application errors surfaced for engineering attention |

### Applying recommendations safely (the process, not just the tool)

```
 Recommender API surfaces a finding
        │
        ▼
 Classify: low-risk (e.g. delete an unattached disk) vs.
 higher-risk (e.g. downsize a production VM)
        │
   ┌────┴────┐
 low-risk   higher-risk
   │           │
   ▼           ▼
 Auto-apply   Validate against SLO/error-budget headroom (§4.1),
 via a        apply via IaC PR + review (Domain 2 §2.3's Terraform-
 scheduled    in-CI pattern) — never a direct manual Console change
 policy       to a production resource
```

- **Auto-apply is appropriate for genuinely low-risk, reversible
  findings** (idle disk cleanup) — a scenario emphasizing "reduce
  toil, minimize manual review overhead" for this class of finding is
  asking you to recognize that human review isn't proportionate to the
  risk.
- **Higher-risk findings (rightsizing a production-serving VM) still
  need the SLO-headroom check from the cost/performance feedback loop
  below** — the same gate whether the recommendation came from a human
  cost review or an automated Recommender finding.

### Tradeoffs — Recommender API usage

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "Hundreds of unattached disks accumulating cost with no owner objecting" | Auto-apply Recommender's idle-resource cleanup on a schedule | A manual quarterly cleanup review | Low-risk, reversible, high-volume findings are exactly what automation should absorb — manual review doesn't scale and adds no safety value here |
| "Recommender suggests downsizing a production database VM" | Validate against SLO error-budget headroom, apply via reviewed IaC PR | Auto-apply without review | Production-serving resource changes carry real availability risk; the review gate matches the risk level, unlike the idle-disk case |

---

## Production architecture pattern: cost/performance feedback loop

```
 Cloud Monitoring (utilization, latency, error rate)
        │
        ▼
 Cloud Logging (structured logs, log-based metrics)
        │
        ▼
 BigQuery (billing export + log export, joined for cost-per-feature
 or cost-per-team analysis)
        │
        ▼
 Recommender API (rightsizing, idle resource, commitment suggestions)
        │
        ▼
 Review against SLO error-budget policy (§4.1) — does applying this
 recommendation risk the reliability target?
        │
   ┌────┴────┐
  safe      risky
   │           │
   ▼           ▼
 Apply via   Defer / apply only after additional headroom
 Terraform   (e.g. after horizontal scale-out reduces per-
 PR (§2.3)   instance risk)
```

**Why this shape:** it's the concrete implementation of "continuous
improvement" (RUNBOOK task 4.3) — cost/performance optimization is
never applied blindly; it's gated by the SLO/error-budget process from
§4.1, closing the loop between Domain 4's process definition and
Domain 2's provisioning mechanism.

---

## Worked scenario walkthrough: Mountkirk Games-style cost and performance review

**Scenario fragment:** *"A gaming company's new title had a successful
but costly launch month. GKE node costs were 3x the pre-launch
estimate. The finance team wants costs under control before the next
regional launch, but the game's peak-concurrency requirement (a
Saturday-night spike) can't be missed — a single dropped match during
peak hours generates disproportionate user complaints. The data team
separately reports their nightly analytics Dataflow job costs have
crept up and results now arrive later than the morning report deadline."*

Applying the framework:

1. **GKE cost, without risking the peak-concurrency SLO**: run
   Recommender API rightsizing against node pools first — most 3x
   launch-month overspend in a scenario like this traces to node pools
   sized (and left) at peak capacity 24/7 rather than autoscaling down
   between peaks. Validate the proposed autoscaler floor/ceiling
   against the Saturday-night peak specifically (§4.3 cost-optimization
   table: "autoscaling floor/ceiling tuning" is the right lever here,
   not a CUD, since load is spiky, not steady) — apply via a reviewed
   Terraform PR (this is a production-serving resource, so it takes the
   "higher-risk" path from the Recommender walkthrough above, not
   auto-apply).
2. **Dataflow job cost and lateness — is it a worker-count problem or a
   windowing/trigger problem?** A scenario describing "job costs crept
   up *and* results arrive later" is signaling the pipeline is
   reprocessing more data than necessary, not simply needing more
   workers (which would fix lateness but make cost worse, not better).
   Check trigger/windowing configuration (§4.3): if the pipeline emits
   results more frequently than the once-daily report actually needs,
   widening the trigger interval reduces both cost and unnecessary
   compute simultaneously — a case where the fix serves both stated
   goals rather than trading one off against the other.
3. **Process fix, not just a one-time change**: bundle the GKE
   autoscaler tuning and Dataflow trigger adjustment into the standing
   Recommender review cadence (§4.2's "no dedicated FinOps team"
   answer) so the *next* regional launch doesn't repeat the same
   pattern — a scenario explicitly anticipating a next launch is asking
   for a process improvement, not just a one-time fix.

**Result**: two distinct root causes (autoscaler sizing, pipeline
trigger cadence), each solved with the specific Domain 4 mechanism
built for it, both gated by the SLO/cost feedback loop above rather
than either being treated as a pure cost-cutting exercise with no
regard for the peak-concurrency requirement.

---

## Domain 4-specific exam traps

1. Picking the cheapest option without checking it against a stated
   SLA/SLO — Domain 4 cost questions are almost always dual-constraint
   (minimize cost *subject to* a reliability floor), not pure
   minimization.
2. Treating "sustainability" answers as always correct when they
   conflict with a harder constraint (latency, residency) — sustainability
   is a legitimate tiebreaker, not an override.
3. Confusing process questions (4.1/4.2 — "what practice/policy should
   govern this") with implementation questions (Domain 2/6 — "what
   service/config implements this") — Domain 4 answers are more often
   about *policy and cadence* than a specific GCP resource.
4. Auto-applying every Recommender API finding regardless of risk —
   the exam expects you to distinguish low-risk/reversible findings
   (safe to automate) from production-impacting ones (still need
   review against SLO headroom).
5. Reaching for "add more Dataflow workers" as the default fix for a
   slow/costly streaming pipeline without first checking whether the
   real issue is windowing/trigger configuration causing unnecessary
   reprocessing — more workers can mask the symptom while making cost
   worse.
6. Treating showback and chargeback as interchangeable — the technical
   mechanism (labels + billing export) is the same, but the correct
   answer depends on whether the scenario describes actual internal
   billing consequences (chargeback) or visibility alone (showback).
7. Framing an incident postmortem around individual blame instead of
   process/systems gaps — even when the technical recommendation is
   otherwise correct, this shape of answer doesn't match how the exam
   expects Domain 4 incident-management questions to be reasoned about.
