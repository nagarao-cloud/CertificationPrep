# Comparison: Migration Strategies (the 6 R's)

> Selection tree: `00-START-HERE/DECISION-TREES.md` Tree 4. Design
> guidance: Domain 1 §1.4.

## Full comparison matrix

| Dimension | Rehost | Replatform | Refactor | Repurchase | Retain | Retire |
|---|---|---|---|---|---|---|
| What changes | Nothing (lift-and-shift) | Minor optimizations ("lift, tinker, shift") | Full re-architecture for cloud-native | Application swapped for SaaS | Nothing moves | Application decommissioned |
| Speed | Fastest | Fast–medium | Slowest | Fast (if SaaS already selected) | Instant (no migration) | Instant |
| Cloud-native benefit realized | Minimal | Partial | Full | Depends on SaaS | None | N/A |
| Risk | Low (familiar shape) | Low–medium | Highest (new architecture, new bugs) | Medium (data migration + change management) | None (status quo) | Low (if dependencies verified) |
| Cost to execute | Low | Medium | Highest | Medium (licensing + migration) | None | Low |
| Long-term TCO | Often worse (doesn't shed legacy inefficiency) | Better than Rehost | Best (if executed well) | Depends on SaaS pricing | Ongoing on-prem cost continues | N/A |
| Team skill required | Minimal | Moderate | High (cloud-native architecture) | Low (vendor-managed) | None | Minimal |
| Typical execution tooling | Migrate to Virtual Machines, Compute Engine images | Same tooling + a managed-service swap step (e.g. Database Migration Service) | Application redesign, containerization, IaC from scratch | SaaS vendor's own onboarding/data-import tooling | N/A | Dependency-mapping/decommission checklist |
| Downtime profile | Cutover window during final sync (minimizable with continuous replication tools) | Similar to Rehost, plus a data-migration cutover for the swapped component | Longest — parallel-run/cutover strategy needed, often phased | Vendor-dependent, typically a defined cutover/import window | None | A planned decommission date, not a cutover |
| Monitoring/observability change | Minimal — same app, same signals, new infrastructure location | Moderate — new managed-service metrics replace self-hosted ones | Significant — new architecture needs new SLOs/dashboards from scratch | Vendor-provided, you lose custom instrumentation you may have had | None | N/A |
| IAM/security re-work required | Minimal — map existing accounts to a comparable IAM model | Moderate — managed service has its own IAM surface to configure | Significant — new architecture means a new IAM/security design from Domain 3 principles | Vendor-managed, but requires new access-governance/SSO integration | None | Deprovisioning access as a decommission step |
| Common failure mode | "Lifted" inefficiency silently inflates cloud spend versus the on-prem baseline it replaced | Underestimating the data-migration step's complexity (schema drift, cutover data loss) | Scope creep — "while we're rewriting it" turning into an open-ended rebuild with no delivery date | Vendor lock-in discovered only after the switch; data export limitations | Regulatory/business assumption becomes stale and nobody revisits it | Discovering a hidden dependency after decommission (the classic "nobody knew Team X still called this") |
| Best for | Deadline-driven migrations, data-center exit | Workloads with an easy managed-service swap (e.g. self-hosted DB → Cloud SQL) | High-value, long-lived workloads worth the investment | Commodity capability (email, CRM) with a mature SaaS option | Regulatory/licensing/sunset-soon workloads | Workloads no longer providing value |

## Tradeoff call-outs

- **Use Rehost when** the scenario states a hard deadline (data-center
  lease ending, contract expiring) that doesn't allow time for
  re-architecture. **Don't use it when** the workload will live for
  years and the team has bandwidth to do better — Rehost alone often
  leaves on-prem inefficiencies (and their costs) intact in the cloud.
  **Edge case:** Rehost is also the correct *first phase* of a
  two-phase migration plan when a scenario explicitly separates "get
  out of the data center by date X" from "modernize afterward" —
  recognizing a phased Rehost-then-Refactor plan (rather than picking
  one strategy for the whole initiative) is itself a tested pattern in
  Domain 1.4/1.5 scenario framing.
- **Use Replatform when** small, well-understood changes (swap a
  self-managed database for its managed equivalent) unlock meaningful
  benefit without a full rewrite. **Don't use it when** the
  architecture itself is the problem — that requires Refactor.
  **Near-miss trap vs. Refactor:** a scenario saying "modernize the
  database layer only, keep the application code as-is" is Replatform;
  a scenario saying "redesign the application to use managed services
  and cloud-native patterns throughout" is Refactor — the scope of
  what changes (one layer vs. the whole architecture) is the deciding
  signal, not how enthusiastic the scenario sounds about "modernizing."
- **Use Refactor when** the workload has high, long-term business value
  and the team has the time/skill to re-architect for cloud-native
  benefits (autoscaling, managed services, resilience patterns).
  **Don't use it when** speed is the binding constraint — Refactor is
  the slowest, highest-risk option and shouldn't be the default answer
  just because it's the "most sophisticated." **Edge case:** a scenario
  describing a monolith that is actively *blocking* the business
  (can't scale for an upcoming launch, can't ship features fast enough)
  is a stronger Refactor signal than one merely describing "old,
  outdated" technology — age alone isn't sufficient justification for
  the highest-risk, highest-cost option; a business-blocking constraint
  is.
- **Use Repurchase when** a mature SaaS already does what a self-hosted
  system does (e.g. move self-hosted email to a managed suite).
  **Don't use it when** the workload has custom business logic a
  generic SaaS can't replicate. **Edge case:** watch for a scenario
  that frames Repurchase as "free" because it's fast — Repurchase still
  carries real migration cost (data export/import, user retraining,
  potential feature gaps versus the custom system it replaces) that a
  scenario's cost-conscious framing can obscure.
- **Use Retain when** a real, durable constraint (licensing tied to
  on-prem hardware, a system nearing planned retirement, data residency
  that cloud can't yet satisfy) makes migration premature. **Don't use
  it as a default** for "we haven't gotten to it yet" — the exam
  expects Retain to be justified by a stated reason, not inertia.
  **Edge case:** Retain is frequently paired with hybrid connectivity
  design (Interconnect/VPN/NCC) rather than being a purely standalone
  decision — a scenario that Retains a workload almost always also
  needs a stated hybrid-connectivity answer for how the retained system
  keeps talking to whatever *did* migrate.
- **Use Retire when** the scenario states the workload is being
  decommissioned as part of the same initiative — verify no other
  system depends on it first (a dependency-mapping step, not just an
  assumption). **Common failure mode as an exam trap:** a scenario that
  casually mentions "this system hasn't been used much lately" is not,
  by itself, sufficient justification for Retire — "not used much" and
  "confirmed zero dependencies, safe to decommission" are different
  claims, and the exam expects you to notice the gap between them
  rather than jumping straight to Retire on low-usage language alone.

## Near-miss traps summary (side-by-side pairs the exam expects you to separate)

| Pair | What makes them look similar | The actual deciding signal |
|---|---|---|
| Rehost vs. Replatform | Both are fast, both keep the application mostly unchanged | Zero component swaps, pure infrastructure move → Rehost. One or more components swapped for a managed equivalent (e.g. self-hosted DB → Cloud SQL) → Replatform |
| Replatform vs. Refactor | Both "modernize" something | Scope is one layer/component → Replatform. Scope is the whole architecture → Refactor |
| Repurchase vs. Retire | Both can look like "we're getting rid of the old system" | A SaaS replacement takes over the *function* → Repurchase. The function itself is no longer needed at all → Retire |
| Retain vs. Rehost | Both can look like "minimal change" | Nothing moves, stays on-prem → Retain. Moves to cloud infrastructure unchanged → Rehost |
| Refactor vs. a greenfield rebuild | Both produce cloud-native architecture | Refactor still migrates and preserves the existing system's business logic/data. A scenario describing starting over with entirely new requirements isn't a migration strategy question at all — it's a new-build, outside the 6 R's framing |

## Reading a scenario for the 6 R's signal

```
"Data center lease expires in 60 days"        → Rehost
"Self-managed MySQL, want managed HA"          → Replatform (→ Cloud SQL)
"Monolith limiting our ability to scale,
 2-year modernization initiative"              → Refactor
"Replacing our self-hosted email server"       → Repurchase
"Regulatory requirement keeps this on-prem
 for now"                                      → Retain
"This reporting tool hasn't been used in
 a year"                                       → Retire (but verify zero dependencies first)
"Exit the data center by Q3, modernize the
 database layer specifically after that"       → Rehost now, Replatform later (phased plan)
"Business-critical monolith actively blocking
 our ability to launch in new regions"         → Refactor
"Vendor's SaaS covers 90% of what our custom
 CRM does, at lower cost"                      → Repurchase (flag the 10% gap as a risk)
```

## Data-migration mechanism matrix (the "how" underneath a Rehost/Replatform plan)

| Mechanism | Best for | Downtime profile | Common exam-scenario cue |
|---|---|---|---|
| Storage Transfer Service | Bulk object data moving into/between Cloud Storage (including from another cloud) | Online, incremental, minimal app downtime | "Migrate our S3 bucket's contents to Cloud Storage" |
| Transfer Appliance | Very large datasets where network transfer would take too long | Offline — physical shipment | "Petabytes of data, limited bandwidth, tight timeline" |
| Database Migration Service | Homogeneous/near-homogeneous database migrations (e.g. self-managed MySQL/PostgreSQL → Cloud SQL) with continuous replication | Minimal — supports continuous replication until cutover | The canonical Replatform data-layer tool |
| BigQuery Data Transfer Service | Scheduled, recurring data loads from SaaS sources (ads platforms, other warehouses) into BigQuery | Scheduled batch, not continuous | "Automate recurring data loads into our warehouse" |
| Migrate to Virtual Machines | Lifting VM workloads (on-prem or other-cloud) into Compute Engine with minimal change | Cutover window at final sync | The canonical Rehost tool for VM-shaped workloads |

## Sequencing and planning considerations (Domain 1.4/1.5)

- **Dependency mapping before sequencing.** A migration wave plan
  should move a workload only after (or together with) everything it
  hard-depends on — sequencing by "easiest first" without a dependency
  map is a common exam-trap plan that looks efficient but breaks
  production mid-migration.
- **Minimizing downtime is a stated or implied requirement almost every
  time.** Even when a scenario doesn't say "zero downtime," assume
  continuous-replication/cutover-window tooling (Database Migration
  Service, Storage Transfer Service's online mode) is preferred over a
  full stop-the-world copy unless the scenario explicitly says an
  extended maintenance window is acceptable.
- **Envisioning future improvements (§1.5) is a separate question from
  picking a migration strategy.** A scenario asking "what would you
  reconsider in two years" is not asking you to re-pick from the 6 R's
  — it's asking about evolving the *already-migrated* architecture
  (new managed services becoming available, cost trends, AI/ML
  integration opportunities) — don't answer a forward-looking-evolution
  question with a migration-strategy-selection answer.

## A single application often needs different R's per layer

A recurring exam trap is treating "which R applies" as one answer for
an entire application, when a realistic scenario often needs a
*different* R per architectural layer:

```
Example: a legacy 3-tier app migrating to GCP

  Web/app tier   → Replatform  (containerize, run on Cloud Run/GKE,
                                 code mostly unchanged)
  Database tier  → Replatform  (self-managed MySQL → Cloud SQL,
                                 or → AlloyDB if HTAP need emerges)
  Batch reporting
  subsystem      → Refactor    (rebuild as a Dataflow/BigQuery
                                 pipeline — the old batch-report
                                 script was always the bottleneck)
  Internal ticketing
  tool bundled
  with the app   → Repurchase  (replace with a SaaS helpdesk tool
                                 instead of migrating the legacy
                                 module at all)
  Old audit-log
  archiver        → Retire     (superseded by Cloud Audit Logs
                                 natively, once migrated)
```

A scenario listing several components of one system, each with its own
constraints, is testing whether you'll apply one R uniformly (the
trap) or reason about each component against its own stated
requirement (the correct approach).

## Organizational/change-management dimension (Domain 4.2 tie-in)

Migration strategy selection isn't purely technical — Domain 4.2
("analyzing and defining business processes") expects you to recognize
that the *organizational* cost of a migration strategy scales with how
much changes, echoing the technical risk/cost pattern above:

| Strategy | Team retraining need | Change-management overhead | Conway's Law consideration |
|---|---|---|---|
| Rehost | Minimal — same app, same skills | Low | None — team structure doesn't need to change |
| Replatform | Moderate — new managed-service operational model | Low–medium | Minor — the team owning the swapped component needs new operational runbooks |
| Refactor | High — cloud-native architecture, new patterns, possibly new languages/frameworks | High | Significant — a monolith-to-microservices Refactor often needs a *team* restructuring to match the new service boundaries (Conway's Law in reverse: architecture drives org design as much as the other way around) |
| Repurchase | Low technical, but end-user retraining on new SaaS UI/workflow | Medium — user adoption/training program | Minimal on the engineering org, but real on the business-process side |
| Retain | None | None | None |
| Retire | Minimal — communication/deprecation notice to any remaining users | Low, but requires a defined sunset communication plan | None |

## Worked scenario walkthroughs

**Scenario A — EHR Healthcare, phased hybrid migration.** "EHR
Healthcare's data center contract renews in 18 months; leadership wants
out of the data center business but the core clinical records system
has deep HIPAA-relevant custom logic nobody wants to touch under time
pressure; a separate, less critical internal reporting tool is a
strong candidate to be replaced by an off-the-shelf BI SaaS product."
Reasoning: three different R's in one scenario — the data-center-exit
deadline without appetite to touch the risky clinical system's logic
under pressure is **Rehost** for the core system (preserve behavior,
move fast, revisit architecture later once safely off the lease); the
reporting tool with a mature SaaS alternative is **Repurchase**. A
common trap is proposing Refactor for the clinical system because
"healthcare compliance sounds like it deserves the most careful
approach" — compliance rigor and migration *strategy* are different
axes; a rushed Refactor under a hard deadline is a worse compliance
risk than a careful Rehost followed by a later, unhurried
modernization phase.

**Scenario B — Mountkirk Games, new title vs. legacy title.**
"Mountkirk is launching a new game built cloud-native from day one,
while an older, still-profitable title runs on a self-managed database
cluster that occasionally has performance issues under peak load but
otherwise works." Reasoning: the new title isn't a migration question
at all (greenfield, not one of the 6 R's); the older title's
self-managed database with occasional performance issues, still
otherwise functional, is a **Replatform** signal (swap the self-managed
cluster for Cloud SQL, AlloyDB, or Spanner depending on the specific
performance/scale driver — see `02-storage-database-options.md`) rather
than a full Refactor, since the scenario doesn't describe the
*application* itself as the problem, only the database layer.

**Scenario C — TerramEarth, legacy dealer portal.** "A 15-year-old
dealer-facing portal handles parts ordering; usage has been declining
as dealers move to a newer TerramEarth mobile app, and the team
suspects — but hasn't confirmed — that a few dealers in specific
regions still rely on it exclusively." Reasoning: declining usage plus
an *unconfirmed* suspicion about remaining dependents is explicitly not
enough to jump to Retire — the correct next step is a dependency-
verification/usage-audit step before a Retire decision, illustrating
the "common failure mode" flagged in the tradeoff call-outs above.
Only once dependency-free is confirmed does Retire become the
justified answer; until then, Retain (with a defined re-evaluation
date) is the more defensible interim position.
