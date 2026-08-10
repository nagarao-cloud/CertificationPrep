# Case Study: EHR Healthcare

> One of the 4 case studies the exam draws 2-of-4 from (RUNBOOK §2).
> This file reconstructs the case study's likely constraints from its
> well-established public profile (SaaS EHR/health-records provider,
> HIPAA-bound, hybrid footprint) — treat the specific numbers here as
> illustrative of the *pattern* the exam tests, not as guaranteed exact
> figures from the current case-study text, which this session could
> not fetch verbatim (see RUNBOOK §1).

## Company profile

EHR Healthcare provides SaaS software (patient records, scheduling,
care coordination) to hospitals and clinics across multiple countries.
Characteristics that drive almost every architecture decision in this
case study:

- **Regulated industry**: HIPAA (US) and likely equivalent regimes in
  other served countries — compliance is not optional, it's the
  binding constraint on nearly every technical choice.
- **Multi-national customer base**: data residency requirements vary by
  customer's jurisdiction — a single global architecture that ignores
  residency is a guaranteed wrong answer here.
- **Hybrid footprint**: existing on-prem data centers being migrated
  incrementally, not a greenfield cloud-native build — migration
  strategy (Domain 1 §1.4) questions lean heavily on this case study.
- **High availability expectation**: clinical software downtime has
  real patient-care consequences — availability requirements are
  usually framed as high (though check the stated RTO/RPO per question,
  per the HA/DR tradeoff table's "don't answer from vibes" trap).

## Primary constraints (rank order)

1. **Compliance/data residency** — overrides cost and even some
   availability tradeoffs.
2. **Availability** — clinical-facing systems, but calibrate to the
   actual stated RTO/RPO per question, not assumed maximalism.
3. **Migration risk** — an incremental, hybrid migration approach is
   almost always preferred over a risky big-bang cutover for this
   company's profile.
4. **Cost** — present but subordinate to the three above; a
   cost-optimal answer that breaks compliance or residency is always
   wrong for this case study.

## Reference architecture

```
                    On-prem data centers (multiple regions/countries)
                              │
                    Dedicated/Partner Interconnect
                    (hybrid connectivity, HIPAA-
                     appropriate encrypted transport)
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
  Region: US            Region: EU              Region: (other,
  (US customers'         (EU customers'           per-customer
  data pinned here        data pinned here         residency need)
  via Org Policy          via Org Policy
  resourceLocations)      resourceLocations)
        │                     │                     │
  ┌─────▼──────┐       ┌─────▼──────┐        ┌─────▼──────┐
  │ GKE Standard│       │ GKE Standard│        │ GKE Standard│
  │ (app tier,  │       │ (app tier,  │        │ (app tier,  │
  │ Workload    │       │ Workload    │        │ Workload    │
  │ Identity)   │       │ Identity)   │        │ Identity)   │
  └─────┬──────┘       └─────┬──────┘        └─────┬──────┘
        ▼                     ▼                     ▼
  Cloud SQL (regional    Cloud SQL (regional    Cloud SQL (regional
  HA, CMEK, private IP   HA, CMEK, private IP   HA, CMEK, private IP
  only) — per-region,    only) — per-region,    only) — per-region,
  NOT globally pooled    NOT globally pooled    NOT globally pooled
  (residency requirement (residency requirement (residency requirement
  forbids it)            forbids it)            forbids it)

  Each region additionally has:
   - VPC Service Controls perimeter (prevent cross-region/cross-
     project exfiltration of PHI)
   - Cloud DLP scanning on any data lake ingestion path
   - Cloud Audit Logs + Access Transparency (HIPAA audit trail,
     including visibility into Google-side access)
   - Assured Workloads wrapping the folder (pre-mapped compliance
     controls, faster/more defensible than manual assembly)
```

**Why per-region isolated data, not a global database:** this is the
case study's signature trap. Spanner's multi-region configuration is
tempting (strong consistency, "global scale") but if EHR Healthcare's
customer data must stay within each customer's jurisdiction, a
single global Spanner instance can *replicate data outside the
required boundary* — the compliance requirement rules out the
technically "more advanced" answer. Per-region isolated Cloud SQL (or
regional Spanner configs, one per residency zone, never a
cross-region-replicating multi-region config) is correct here.

## Question patterns this case study tends to produce

| Question shape | What it's really testing |
|---|---|
| "How should EHR Healthcare structure its GCP resource hierarchy across countries?" | Domain 1 §1.3 — folders per compliance boundary, Org Policy resourceLocations per folder |
| "What's the best migration approach for their on-prem EHR system?" | Domain 1 §1.4 — likely Replatform or phased Refactor, not Rehost, given long system lifespan and compliance need for improvement over time; sequencing matters |
| "How do they prevent a support engineer from accidentally viewing patient data across regions?" | Domain 3 §3.1 — VPC Service Controls + IAM scoped per region/project, not just IAM alone |
| "How do they satisfy HIPAA audit requirements?" | Domain 3 §3.2 — Cloud Audit Logs (Data Access logs specifically enabled), Access Transparency |
| "How should they handle a regional outage for a clinical system?" | Domain 6 Tree 5 — likely Active-Passive or Warm Standby *within* the same compliance boundary (can't fail over to a different country's region if that would move PHI across a residency line) |

## Exam trap specific to this case study

The DR trap: a naive answer fails over EHR Healthcare's EU customer
data to a US region "because it's available and cheaper" — this
violates the residency constraint that overrides every other design
consideration for this case study. DR/failover targets must stay
*within* the same compliance boundary as the primary region.
