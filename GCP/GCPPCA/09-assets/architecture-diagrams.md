# Architecture Diagrams — Consolidated Reference

> Pulls every major ASCII diagram in this folder into one place for
> quick browsing. Each entry links back to its full-context source —
> read this file for a visual index, read the source file for the
> reasoning behind each design choice.

## Index

| Diagram | Source |
|---|---|
| Three-tier web app, multi-region | `01-domains/DOMAIN-1-designing-planning.md` |
| Terraform-provisioned landing zone | `01-domains/DOMAIN-2-managing-provisioning.md` |
| Zero-trust perimeter | `01-domains/DOMAIN-3-security-compliance.md` |
| Cost/performance feedback loop | `01-domains/DOMAIN-4-analyzing-optimizing.md` |
| Governed self-service platform | `01-domains/DOMAIN-5-managing-implementation.md` |
| Multi-region HA/DR with observability | `01-domains/DOMAIN-6-ensuring-reliability.md` |
| EHR Healthcare (per-region compliance isolation) | `04-architectures/case-study-ehr-healthcare.md` |
| Helicopter Racing League (global streaming + telemetry) | `04-architectures/case-study-helicopter-racing-league.md` |
| Mountkirk Games (regional gameplay + global identity) | `04-architectures/case-study-mountkirk-games.md` |
| TerramEarth (IoT ingest + predictive maintenance) | `04-architectures/case-study-terramearth.md` |
| Generic multi-region web app | `04-architectures/pattern-multi-region-web-app.md` |
| Generic data/analytics pipeline (Lambda/Kappa/Medallion) | `04-architectures/pattern-data-analytics-pipeline.md` |

## One-page composite: "every layer, all at once"

A single reference diagram combining every architectural layer this
folder discusses — useful as a final-review mental checklist ("did my
answer account for every one of these layers?") rather than a literal
design to copy for any one scenario.

```
                              Users
                                │
                    ┌───────────▼───────────┐
                    │  Cloud Armor (edge WAF) │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │  Global External LB     │ ◄── Cloud CDN
                    │  (or Regional, per       │
                    │   scope — Tree/matrix     │
                    │   in 03-comparisons)      │
                    └───────────┬───────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                                               ▼
  VPC Service Controls perimeter (Domain 3)   ── wraps the data plane ──
        │
  ┌─────▼──────────────────────────────────────────────────┐
  │  Compute tier (Tree 1: Compute Engine / GKE / Cloud Run /│
  │  Functions / App Engine / Vertex AI — matched to the      │
  │  scenario's stated ops-capability and workload shape)      │
  │  — Workload Identity (no exported keys), readiness/          │
  │    liveness probes tuned per Domain 6, autoscaling +           │
  │    capacity buffer where spike-latency matters                  │
  └─────┬──────────────────────────────────────────────────┘
        │
  ┌─────▼──────────────────────────────────────────────────┐
  │  Data tier (Tree 2: matched to consistency/scale/access     │
  │  pattern — Cloud SQL / Spanner / Bigtable / Firestore /       │
  │  BigQuery / Cloud Storage) — CMEK, DLP where PII present,      │
  │  HA/DR tier matched to stated RTO/RPO (Tree 5)                  │
  └─────┬──────────────────────────────────────────────────┘
        │
  ┌─────▼──────────────────────────────────────────────────┐
  │  Cross-cutting: IAM (least privilege, group-based) + Org    │
  │  Policy (org-wide guardrails) applied at the Folder level    │
  │  above everything; Cloud Monitoring/Logging/Trace/Profiler     │
  │  (Domain 6 §6.1) instrumented from day one ("observability      │
  │  by default", Domain 2 §2.3); Terraform/CI-CD provisioning        │
  │  everything above, reviewed before apply (Domain 2 §2.3)           │
  └──────────────────────────────────────────────────────────┘

  Hybrid/on-prem, if stated: Interconnect/VPN/NCC layer (Tree 3)
  connecting into the VPC hosting the above, sized to the scenario's
  actual bandwidth/latency/timeline constraints.
```

## Reading order for exam review

1. Start with Tree 1/2/3/4/5/6 in `00-START-HERE/DECISION-TREES.md` —
   these are the *decision logic* behind every diagram above.
2. Use this file's composite diagram as a checklist while reading a
   scenario question: which layers does the scenario actually touch,
   and which comparison matrix resolves each one?
3. Go to the specific domain/case-study file only when you need the
   *reasoning* behind a specific choice, not just the shape.
