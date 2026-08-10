# Pattern: Multi-Region Web Application (Generic)

> A generic pattern to fall back on for scenario questions that don't
> map cleanly to one of the 4 named case studies — e.g. a standalone
> "design a globally available e-commerce site" question. Complements
> the case-specific patterns in this folder and the pattern already
> embedded in `01-domains/DOMAIN-1-designing-planning.md`.

## When this pattern applies

A scenario describing: a public-facing application, a genuinely global
or multi-region user base (stated explicitly, not assumed), a need for
regional failover/DR, and no overriding compliance/residency
requirement that would instead push toward the EHR Healthcare-style
per-region-isolated pattern.

## Reference architecture

```
                              Users (global)
                                    │
                                    ▼
                      ┌──────────────────────────┐
                      │  Cloud Armor (edge WAF/    │
                      │  DDoS, rate limiting)      │
                      └─────────────┬──────────────┘
                                    ▼
                      ┌──────────────────────────┐
                      │  Global External App LB    │  ◄── Cloud CDN
                      │  (single anycast IP)        │      for static
                      └─────────────┬──────────────┘      assets
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
      Region A (primary)     Region B (secondary)   Region C (secondary)
      ┌───────────────┐      ┌───────────────┐      ┌───────────────┐
      │ Cloud Run or   │      │ Cloud Run or   │      │ Cloud Run or   │
      │ GKE Autopilot  │      │ GKE Autopilot  │      │ GKE Autopilot  │
      │ (app tier)     │      │ (app tier)     │      │ (app tier)     │
      └───────┬───────┘      └───────┬───────┘      └───────┬───────┘
              ▼                     ▼                     ▼
      Memorystore            Memorystore            Memorystore
      (regional cache)       (regional cache)       (regional cache)
              │                     │                     │
              └─────────────────────┼─────────────────────┘
                                    ▼
                      ┌──────────────────────────┐
                      │  Data layer (choose by      │
                      │  the actual consistency      │
                      │  requirement — see below)     │
                      └──────────────────────────┘
                                    │
                                    ▼
                      ┌──────────────────────────┐
                      │  Cloud Storage (multi-      │
                      │  region bucket — static      │
                      │  assets, user uploads)        │
                      └──────────────────────────┘

  Cross-cutting: Cloud Monitoring SLO objects + alerting in every
  region; Cloud Logging sinks to BigQuery (analysis) and Cloud Storage
  (retention); IAM/Org Policy applied at the folder level above all
  regional projects; Terraform-managed via a CI/CD pipeline (Domain 2).
```

## Data-layer decision (the part that actually varies per scenario)

Don't default to Spanner just because the app is multi-region — apply
Tree 2 (`00-START-HERE/DECISION-TREES.md`) to the *actual* consistency
requirement:

| If the scenario says… | Data layer |
|---|---|
| "Inventory/balance must never be double-committed across regions" | Cloud Spanner (multi-region config) |
| "Eventual consistency across regions is acceptable" | Cloud SQL (regional) + async cross-region read replicas |
| "Mobile/web clients need offline support" | Firestore |
| "High-throughput time-series/event data" | Bigtable |
| "Primarily read-heavy, cacheable content" | Regional Cloud SQL/Firestore + Memorystore cache layer (as drawn above) is often sufficient without a globally-distributed database at all |

## HA/DR tier selection

Apply Tree 5 (`00-START-HERE/DECISION-TREES.md`) to the scenario's
stated RTO/RPO — this pattern's diagram shows the Active-Active shape
(all regions actively serving), but downshift the *data layer's*
replication model (not the LB tier, which stays global) to
Active-Passive or Warm Standby when the stated RTO/RPO doesn't justify
full multi-region write capability. The LB and CDN layers of this
pattern are useful even at a lower HA/DR tier — they don't have to be
downgraded in lockstep with the data layer.

## Common mistakes when applying this generic pattern to a scenario

1. Using it when the scenario is actually single-region — check for an
   explicit multi-region/global user base statement before defaulting
   here (Domain 1 exam trap #1, over-engineering).
2. Picking Spanner for the data layer without checking whether the
   scenario's consistency requirement actually needs it — the most
   common cost/complexity trap laid on top of this pattern.
3. Forgetting Cloud Armor at the edge — a "public facing" statement in
   the scenario is a strong signal an L7 WAF policy is expected in the
   answer, not just a load balancer.
