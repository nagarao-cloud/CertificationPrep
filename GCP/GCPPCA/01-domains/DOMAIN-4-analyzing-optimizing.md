# Domain 4 — Analyzing and Optimizing Technical and Business Processes (~18%)

> Source: `00-START-HERE/RUNBOOK.md` §3 (task wording reconstructed —
> see RUNBOOK §1). This domain tests continuous improvement: given a
> running system, what's the correct next optimization, and what
> process should surface it.

## Contents

1. [4.1 Analyzing and defining technical processes](#41-analyzing-and-defining-technical-processes)
2. [4.2 Analyzing and defining business processes](#42-analyzing-and-defining-business-processes)
3. [4.3 Development and operations](#43-development-and-operations)
4. [Production architecture pattern: cost/performance feedback loop](#production-architecture-pattern-costperformance-feedback-loop)
5. [Domain 4-specific exam traps](#domain-4-specific-exam-traps)

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

### Business continuity / DR planning (process, not just technology)

Domain 1 elicits the RTO/RPO numbers; Domain 6 implements the failover
mechanism; **Domain 4 is the process layer in between** — defining
*how* those numbers get validated (DR drills, chaos engineering,
documented runbooks) and kept current as the system evolves. A scenario
asking "how often should we test our DR plan" or "what process ensures
our runbook stays accurate" is a Domain 4 question, not Domain 6.

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

### Cost management, showback/chargeback

| Mechanism | Purpose |
|---|---|
| Billing export to BigQuery | Enables custom cost analysis/dashboards beyond the built-in Billing reports |
| Labels on resources | Attribute cost to team/project/environment for showback (visibility) or chargeback (actual billing) |
| Budgets and budget alerts | Proactive notification before overspend, not just after-the-fact reporting |
| Recommender API | Automated rightsizing, idle-resource, and commitment-purchase suggestions — the process-automation answer for "how do we keep finding savings without a dedicated FinOps team" |

### Sustainability (2026 emphasis, see RUNBOOK §7)

- **Carbon Footprint tool**: reports gross/net carbon emissions
  attributable to your GCP usage, broken down by project/service —
  answer for "we need to report our cloud carbon footprint."
- **Region selection for lower emissions**: some Google Cloud regions
  run on grids with a higher share of carbon-free energy; a scenario
  emphasizing sustainability *and* giving latitude on region choice is
  signaling this as a legitimate tiebreaker (never override a hard
  latency/residency constraint for it).

### Tradeoffs — business process analysis

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "Finance wants to see cost per team without a dedicated tooling investment" | Labels + billing export to BigQuery + built-in reports | Building a custom cost-allocation system from scratch | Native tooling covers showback/chargeback without additional engineering |
| "We want savings to keep happening without a standing team watching bills" | Recommender API + automated policies (e.g. auto-apply low-risk rightsizing) | One-time manual cost review | The scenario is asking for a *process*, and Recommender API is the automatable version of that process |

---

## 4.3 Development and operations

### Release management patterns

| Pattern | Mechanism | When it's the answer |
|---|---|---|
| Canary | Cloud Run traffic splitting, GKE with a service mesh or manual traffic-split ingress | Scenario wants to validate a change on a small % of real traffic before full rollout |
| Blue/green | Two full environments, switch traffic atomically (LB backend swap) | Scenario wants instant, fully-tested rollback capability, willing to pay for duplicate capacity during the switch |
| Rolling update | MIG update policy (surge/max-unavailable), GKE rolling deployment | Default for most stateless workloads — balances safety and resource cost without a full duplicate environment |

### DevOps/SRE practices

- **Toil reduction**: recurring manual operational work (the kind
  Domain 4 process analysis is meant to surface) should be automated —
  a scenario describing a repeated manual task is signaling "the
  correct answer involves automating this," not "hire more people to do
  it faster."
- **Error budgets** (see §4.1) govern the tension between shipping
  velocity and reliability — this is the SRE-practice answer whenever a
  scenario asks "how do we balance feature velocity against stability."

### Cost optimization deep dive

| Technique | Best for |
|---|---|
| Committed Use Discounts (CUD) | Steady, predictable baseline load (1 or 3-year commitment for a discount) |
| Preemptible / Spot VMs | Fault-tolerant, interruptible batch/stateless workloads — never for stateful, always-on services |
| Rightsizing (via Recommender API) | Over-provisioned VMs/MIGs found by looking at actual utilization, not requested size |
| Autoscaling floor/ceiling tuning | Spiky workloads — avoid both over-provisioning (wasted floor) and under-provisioning (missed SLA at ceiling) |
| Storage class lifecycle rules | Data that cools off over time (see Domain 2 §2.2) |

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

### Tradeoffs — development and operations

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "Need to validate a risky change on real traffic before full exposure" | Canary (traffic splitting) | Blue/green or big-bang rollout | Canary limits blast radius to a small % while still using real traffic, cheaper than a full duplicate blue/green environment |
| "Batch job, can tolerate interruption, cost is the priority" | Preemptible/Spot VMs | On-demand or reserved VMs | Spot pricing is dramatically cheaper for genuinely interruption-tolerant workloads — reserved capacity wastes the discount opportunity |
| "Steady 24/7 baseline load, known for the next year" | Committed Use Discount | Autoscaling / on-demand only | CUD directly discounts predictable baseline; autoscaling is solving a variability problem this workload doesn't have |
| "AI model serving cost is high but traffic is spiky" | Autoscaling Vertex AI endpoint with tuned min/max replicas | Fixed always-on replica count | Fixed capacity either overspends at trough or underserves at peak — same autoscaling principle as compute, applied to model serving |

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
