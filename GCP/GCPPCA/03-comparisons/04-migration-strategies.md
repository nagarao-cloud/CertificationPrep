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
| Best for | Deadline-driven migrations, data-center exit | Workloads with an easy managed-service swap (e.g. self-hosted DB → Cloud SQL) | High-value, long-lived workloads worth the investment | Commodity capability (email, CRM) with a mature SaaS option | Regulatory/licensing/sunset-soon workloads | Workloads no longer providing value |

## Tradeoff call-outs

- **Use Rehost when** the scenario states a hard deadline (data-center
  lease ending, contract expiring) that doesn't allow time for
  re-architecture. **Don't use it when** the workload will live for
  years and the team has bandwidth to do better — Rehost alone often
  leaves on-prem inefficiencies (and their costs) intact in the cloud.
- **Use Replatform when** small, well-understood changes (swap a
  self-managed database for its managed equivalent) unlock meaningful
  benefit without a full rewrite. **Don't use it when** the
  architecture itself is the problem — that requires Refactor.
- **Use Refactor when** the workload has high, long-term business value
  and the team has the time/skill to re-architect for cloud-native
  benefits (autoscaling, managed services, resilience patterns).
  **Don't use it when** speed is the binding constraint — Refactor is
  the slowest, highest-risk option and shouldn't be the default answer
  just because it's the "most sophisticated."
- **Use Repurchase when** a mature SaaS already does what a self-hosted
  system does (e.g. move self-hosted email to a managed suite).
  **Don't use it when** the workload has custom business logic a
  generic SaaS can't replicate.
- **Use Retain when** a real, durable constraint (licensing tied to
  on-prem hardware, a system nearing planned retirement, data residency
  that cloud can't yet satisfy) makes migration premature. **Don't use
  it as a default** for "we haven't gotten to it yet" — the exam
  expects Retain to be justified by a stated reason, not inertia.
- **Use Retire when** the scenario states the workload is being
  decommissioned as part of the same initiative — verify no other
  system depends on it first (a dependency-mapping step, not just an
  assumption).

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
 a year"                                       → Retire
```
