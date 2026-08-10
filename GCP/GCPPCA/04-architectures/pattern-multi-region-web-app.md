# Pattern: Multi-Region Web Application (Generic)

> A generic pattern to fall back on for scenario questions that don't
> map cleanly to one of the 4 named case studies — e.g. a standalone
> "design a globally available e-commerce site" question. Complements
> the case-specific patterns in this folder and the pattern already
> embedded in `01-domains/DOMAIN-1-designing-planning.md`.

## When this pattern applies — and when it's a distractor

A scenario describing: a public-facing application, a genuinely global
or multi-region user base (stated explicitly, not assumed), a need for
regional failover/DR, and no overriding compliance/residency
requirement that would instead push toward the EHR Healthcare-style
per-region-isolated pattern.

The exam frequently presents this pattern *and* a near-miss alternative
in the same answer set — recognizing which one the scenario's specific
wording actually calls for is most of the difficulty:

| Scenario signal | Right pattern | Why the other one is a distractor |
|---|---|---|
| "Users are in one country/metro area, occasional spikes" | **Single-region, multi-zone** (regional MIG/GKE cluster spanning 3 zones, regional LB) | Multi-region adds cross-region cost/complexity the stated user base doesn't need — the over-engineering trap (EXAM-TRAPS #1) |
| "Users are global, some downtime during a regional failure is tolerable within hours" | **Multi-region, Active-Passive** (this pattern, downshifted tier) | Full Active-Active multi-region write capability is unnecessary cost for a tolerant RTO — Tree 5's cost-sensitivity trap |
| "Users are global, near-zero downtime and near-zero data loss required" | **Multi-region, Active-Active** (this pattern, full tier) | A single-region-with-DR-backup design can't meet a near-zero RTO/RPO — matches Tree 5's top branch |
| "Data must stay within each customer's jurisdiction" | **Per-region isolated pattern** (EHR Healthcare-style — see that case study file), NOT this pattern's shared global data layer | This pattern's global LB/CDN edge is still fine, but its *data layer* assumption (one pooled or replicated store) breaks a residency requirement; don't reuse this file's data-layer diagram unmodified for a residency-constrained scenario |
| "It's an internal/back-office tool, not customer-facing" | Regional deployment, no CDN/Cloud Armor edge layer needed | This pattern's edge/WAF layer solves a public-internet threat model the internal tool doesn't have — needless cost/complexity |

## Reference architecture — steady-state path

```
                              Users (global)
                                    │
                                    ▼
                      ┌──────────────────────────┐
                      │  Cloud Armor (edge WAF/    │  ◄── (1)
                      │  DDoS, rate limiting)      │
                      └─────────────┬──────────────┘
                                    ▼
                      ┌──────────────────────────┐
                      │  Global External App LB    │  ◄── (2) Cloud CDN
                      │  (single anycast IP)        │      for static
                      └─────────────┬──────────────┘      assets (3)
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
      Region A (primary)     Region B (secondary)   Region C (secondary)
      ┌───────────────┐      ┌───────────────┐      ┌───────────────┐
      │ Cloud Run or   │      │ Cloud Run or   │      │ Cloud Run or   │  ◄── (4)
      │ GKE Autopilot  │      │ GKE Autopilot  │      │ GKE Autopilot  │
      │ (app tier)     │      │ (app tier)     │      │ (app tier)     │
      └───────┬───────┘      └───────┬───────┘      └───────┬───────┘
              ▼                     ▼                     ▼
      Memorystore            Memorystore            Memorystore          ◄── (5)
      (regional cache)       (regional cache)       (regional cache)
              │                     │                     │
              └─────────────────────┼─────────────────────┘
                                    ▼
                      ┌──────────────────────────┐
                      │  Data layer (choose by      │  ◄── (6)
                      │  the actual consistency      │
                      │  requirement — see below)     │
                      └──────────────────────────┘
                                    │
                                    ▼
                      ┌──────────────────────────┐
                      │  Cloud Storage (multi-      │  ◄── (7)
                      │  region bucket — static      │
                      │  assets, user uploads)        │
                      └──────────────────────────┘

  Cross-cutting: Cloud Monitoring SLO objects + alerting in every
  region (8); Cloud Logging sinks to BigQuery (analysis) and Cloud
  Storage (retention) (9); IAM/Org Policy applied at the folder level
  above all regional projects (10); Terraform-managed via a CI/CD
  pipeline (11).
```

**Every arrow explained:**

1. **Cloud Armor at the edge** — filters malicious/abusive traffic
   before it reaches any regional backend; a public-facing statement in
   the scenario is a strong signal this layer belongs in the answer.
2. **Global External App LB** — single anycast IP, routes each user to
   the *nearest healthy* region automatically based on latency, not a
   manually configured geo-DNS scheme (a common distractor: DNS-based
   geo-routing is slower to fail over and isn't the modern GCP-native
   answer for this pattern).
3. **Cloud CDN** — caches static assets at Google's edge, reducing
   both latency and origin load; sits logically alongside the LB, not
   a separate hop the request has to make.
4. **Regional app tier** — Cloud Run or GKE Autopilot chosen for
   reduced ops burden by default (Tree 1); GKE Standard only if the
   scenario states a need for K8s-native features or existing deep K8s
   expertise the team wants to keep using.
5. **Regional Memorystore cache** — sits in front of the data layer to
   absorb read-heavy traffic; kept *regional*, not global, since cache
   data is disposable/reconstructable and doesn't need cross-region
   consistency.
6. **Data layer** — the one component of this diagram that varies most
   per scenario; see the decision table below. This is deliberately
   drawn as a black box because defaulting to one specific database
   here regardless of the scenario's stated consistency requirement is
   the most common mistake candidates make with this pattern.
7. **Multi-region Cloud Storage bucket** — for static assets and user
   uploads; multi-region storage class chosen specifically because this
   content benefits from being served with low latency to any region,
   unlike the primary data layer above it.
8. **Per-region SLOs** — each region's Cloud Monitoring SLOs are
   evaluated independently so a single region's degradation isn't
   averaged away by healthier regions in a blended global metric.
9. **Logging sinks** — BigQuery for ad hoc analysis/dashboards, Cloud
   Storage for cost-efficient long-term retention; both fed from the
   same Cloud Logging router.
10. **Folder-level IAM/Org Policy** — governs all regional projects
    uniformly from above, rather than configuring policy per-region and
    risking drift (Domain 3's resource-hierarchy material).
11. **Terraform + CI/CD** — the whole multi-region footprint is
    provisioned declaratively and repeatably (Tree 6), since a
    hand-built region is both slow to reproduce for a new region and
    prone to config drift versus its siblings.

## Failure and DR paths (not just the steady-state arrows)

```
  Scenario: Region A (primary) suffers an outage

  Global External App LB detects Region A backends failing health
  checks within seconds and stops routing new traffic there — this
  happens automatically, no manual intervention, and is true for
  BOTH the Active-Active and Active-Passive variants below (the LB
  tier doesn't change between variants, only the data layer does —
  see "Active-Active vs. Active-Passive" section)

  Active-Active data layer (e.g. Spanner multi-region):
   - Region B/C already hold a current, writable replica
   - In-flight writes routed to Region A retry against B/C
     automatically once the LB reroutes — near-zero RPO, RTO in
     the range of the LB's health-check detection window (seconds)

  Active-Passive data layer (e.g. Cloud SQL cross-region replica):
   - Region B/C have a READ replica, not a writable one, until a
     human or automated runbook explicitly PROMOTES it
   - Promotion is the manual/scripted step that turns this into a
     writable primary — RTO is however long that promotion + DNS/
     LB-config propagation takes (typically minutes), RPO is
     whatever replication lag existed at the moment of failure
     (usually seconds, not zero — the key difference from Active-
     Active)
   - This is where this pattern's DR story most commonly gets
     tested: candidates forget that Active-Passive requires an
     explicit promotion step and assume failover is automatic the
     way it is for the LB tier

  Regardless of variant: Cloud CDN continues serving already-cached
  static assets from the edge even during an origin-region outage,
  so the failure is often invisible for cached content and only
  visible for dynamic, data-layer-dependent requests
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
| "Demanding transactional workload with a real-time analytical read pattern on the same data" | AlloyDB for PostgreSQL (regional or with cross-region read pools) — the differentiator from plain Cloud SQL is the hybrid OLTP/analytics need, not just "PostgreSQL compatibility" |

## Active-Active vs. Active-Passive — worked variations

Both variants share the same LB/CDN/app-tier shape above; they differ
only in the data layer's replication and failover model. Picking the
wrong one for a given scenario is one of the highest-frequency mistakes
this pattern produces on the exam.

### Active-Active (all regions read AND write)

- **When it's correct:** the scenario states near-zero RTO/RPO
  ("always on," "cannot lose any committed transaction," "seamless
  regional failover with no manual step") — matches Tree 5's top
  branch exactly.
- **What it costs:** the most expensive tier — a multi-region Spanner
  configuration (or equivalent globally-consistent write layer) runs
  continuously across all regions, not just during a failure.
- **Operational burden:** lowest *during* an incident (failover is
  automatic, no runbook to execute under pressure) but requires more
  upfront design discipline to avoid write conflicts and to reason
  about global consistency correctly.
- **Common distractor pairing:** a question describing a
  cost-conscious or "non-critical" workload alongside global-user-base
  language tempts candidates toward Active-Active on the "global"
  keyword alone — check the actual RTO/RPO number, not the word
  "global."

### Active-Passive (secondary regions are read-only until promoted)

- **When it's correct:** the scenario states an RTO in minutes and an
  RPO of seconds-to-minutes ("fast failover acceptable, brief data loss
  tolerable") — Tree 5's second branch.
- **What it costs:** meaningfully less than Active-Active — a regional
  primary plus a smaller/cheaper standby replica, rather than
  full write capacity running in every region continuously.
- **Operational burden:** higher *during* an incident — someone (or an
  automated but explicitly-triggered runbook) must promote the replica;
  this is a real step with real failure modes (a promotion runbook that
  hasn't been tested recently is a classic reliability gap) that
  Active-Active doesn't have.
- **Common distractor pairing:** a question implying "failover is
  seamless" language for an Active-Passive setup is testing whether you
  know promotion isn't automatic — don't assume Active-Passive behaves
  like Active-Active just because both are "multi-region."

## HA/DR tier selection

Apply Tree 5 (`00-START-HERE/DECISION-TREES.md`) to the scenario's
stated RTO/RPO — this pattern's diagram shows the Active-Active shape
(all regions actively serving), but downshift the *data layer's*
replication model (not the LB tier, which stays global) to
Active-Passive or Warm Standby when the stated RTO/RPO doesn't justify
full multi-region write capability. The LB and CDN layers of this
pattern are useful even at a lower HA/DR tier — they don't have to be
downgraded in lockstep with the data layer.

## Cost and operational-burden tradeoffs

| Layer | Cost driver | Operational-burden driver |
|---|---|---|
| Global LB + Cloud Armor | Modest, scales with traffic; not the dominant cost line | Low — mostly configuration, not day-to-day operation |
| Cloud CDN | Reduces origin cost more than it adds; usually a net savings | Low — cache-invalidation policy is the main ongoing task |
| Regional app tier (Cloud Run/GKE Autopilot) | Scales with traffic per region; Autopilot removes node-management cost entirely | Low with Autopilot/Cloud Run; higher with GKE Standard (node pool patching, upgrades) |
| Regional Memorystore | Fixed cost per region per cache size provisioned | Low — mostly sizing decisions, minimal day-to-day ops |
| Data layer — Active-Active (Spanner multi-region) | **Highest** — full write capacity, continuously, in every configured region | Low during steady-state and during failure (automatic); higher design-time cost to reason about globally-consistent writes correctly |
| Data layer — Active-Passive (Cloud SQL + replica) | Moderate — one primary, one smaller standby | Moderate — requires a maintained, periodically-tested promotion runbook; the operational cost is concentrated in *readiness*, not steady-state |
| Multi-region Cloud Storage | Modest, scales with stored data volume | Low — largely hands-off once lifecycle rules are set |
| Terraform/CI/CD provisioning layer | Engineering time upfront, near-zero marginal cost per additional region once built | Lower long-run burden than manual per-region builds — the whole point of the IaC layer in this pattern |

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
4. Assuming Active-Passive failover is automatic the same way LB
   rerouting is — forgetting the explicit promotion step (and the
   runbook discipline it requires) is a distinct, commonly-tested gap.
5. Reusing this pattern's shared/pooled data-layer assumption for a
   scenario that actually has a data-residency constraint — that's the
   EHR Healthcare-style per-region-isolated pattern instead, not this
   one; the edge/LB/CDN layers can carry over, the data layer cannot.
6. Choosing DNS-based geo-routing over the Global External App LB when
   a scenario asks for fast, automatic regional failover — DNS TTLs
   and client-side caching make DNS-based failover slower and less
   reliable than the LB's health-check-driven routing.
