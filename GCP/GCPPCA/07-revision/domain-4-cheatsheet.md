# Domain 4 Cheat Sheet — Analyzing and Optimizing (~18%)

> Compressed by design. Full depth:
> `01-domains/DOMAIN-4-analyzing-optimizing.md`.

## Core dual-constraint framing

Cost questions = minimize cost **subject to** not violating the stated
SLA/SLO. Never pick the cheapest option that silently breaks a stated
reliability requirement.

## Cost optimization one-liners

- Steady, predictable load → Committed Use Discounts
- Fault-tolerant, interruptible → Preemptible/Spot VMs
- Over-provisioned resources → Recommender API rightsizing
- Repeated expensive BigQuery query → materialized view
- Idle/unattached resources → Recommender API idle-resource findings
- Sustainability → legitimate tiebreaker only, never overrides a harder constraint (residency, latency)

## Release management one-liners

- Validate on small % of real traffic → Canary (traffic splitting)
- Instant full-environment cutover with rollback → Blue/green
- Default safe rollout for most stateless workloads → Rolling update

## Process one-liners

- Error budget healthy → ship at normal velocity; burned → freeze features, prioritize reliability
- Recurring incident, same root cause → blameless postmortem, fix the root cause (Domain 4 process, not just Domain 6 fix)
- Toil (recurring manual work) → automate it

## AI/ML-specific optimization (2026 focus)

- Vertex AI serving cost/spiky traffic → autoscaling with tuned min/max replicas
- Model accuracy silently degrading → Vertex AI Model Monitoring (drift detection)
- Feature Store → online store for low-latency serving, offline for training — don't serve prod traffic from offline

## Top traps

1. Cheapest option that breaks a stated SLA/SLO
2. Sustainability overriding a harder constraint
3. Process questions (policy/cadence) confused with implementation questions (Domain 2/6 — specific service/config)
