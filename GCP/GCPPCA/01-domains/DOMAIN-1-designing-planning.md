# Domain 1 — Designing and Planning a Cloud Solution Architecture (~24%)

> Largest single domain on the exam. Source: `00-START-HERE/RUNBOOK.md`
> §3 (task-level wording reconstructed, not verbatim — see RUNBOOK §1 for
> the sourcing/access note). This is the domain the case studies lean on
> hardest — treat every subsection here as prerequisite reading before
> `04-architectures/case-study-*.md`.

## Contents

1. [1.1 Business requirements](#11-designing-a-solution-infrastructure-that-meets-business-requirements)
2. [1.2 Technical requirements](#12-designing-a-solution-infrastructure-that-meets-technical-requirements)
3. [1.3 Network, storage, and compute design](#13-designing-network-storage-and-compute-resources)
4. [1.4 Migration planning](#14-creating-a-migration-plan)
5. [1.5 Future improvements](#15-envisioning-future-solution-improvements)
6. [Production architecture pattern](#production-architecture-pattern-three-tier-web-app-multi-region)
7. [Exam traps specific to this domain](#domain-1-specific-exam-traps)

---

## 1.1 Designing a solution infrastructure that meets business requirements

The exam frames business requirements as constraints an architecture
must satisfy *even when they conflict with the technically "best"
answer*. This subsection is about **requirement translation**: turning
a stakeholder sentence into an architectural constraint.

### Requirement translation framework

| Business language | Technical translation | Where it shows up in the design |
|---|---|---|
| "We need this always available" | A specific SLA/SLO number (99.9% vs 99.99% vs 99.999%) — never assume "always" means five nines | Compute redundancy tier (Tree 5, `00-START-HERE/DECISION-TREES.md`) |
| "We can't lose customer data" | An explicit RPO (often near-zero) | Backup cadence, synchronous vs async replication |
| "Launch is fixed, budget is not" | Timeline is the binding constraint, not cost | Favor managed/serverless (faster to build) over hand-rolled infra |
| "We're a regulated industry" | Named compliance regime(s) (HIPAA, PCI-DSS, GDPR, data residency) | Domain 3 handoff — Assured Workloads, region pinning, CMEK |
| "Small team, no dedicated ops" | Operational capability constraint | Favor GKE Autopilot/Cloud Run over self-managed GKE Standard/Compute Engine |
| "We already have Kubernetes expertise" | Team-capability signal favoring K8s-native tools | GKE Standard, Config Connector over Terraform-only |
| "Vendor lock-in is a board-level concern" | Portability requirement | Favor open standards (Kubernetes, Terraform, standard SQL) over GCP-proprietary where a viable open alternative exists |

### Business continuity and success measures

- **Business continuity planning (BCP)** feeds directly into Domain 6's
  RTO/RPO execution — Domain 1 is where you *elicit* the numbers,
  Domain 6 is where you *implement* the failover pattern that hits them.
- **Success measures/KPIs**: a scenario stating "reduce infrastructure
  cost by 30% while maintaining current SLA" gives you a hard
  optimization target with a non-negotiable floor (the SLA) — treat this
  as a two-variable constraint, not a single cost-minimization problem.
- **Licensing (BYOL)**: Windows/SQL Server licensing costs materially
  change the compute decision (Compute Engine sole-tenant nodes for
  license compliance, or "bring your own license" images) — a scenario
  mentioning existing enterprise license agreements is signaling this.
- **Procurement and vendor constraints**: multi-cloud or "must avoid
  single-vendor dependency" requirements push toward Anthos, Terraform,
  and Kubernetes-portable workloads over GCP-only managed services like
  Spanner or Firestore.

### Tradeoffs — business requirements

| When the scenario says… | Prefer | Don't reach for | Why the alternative loses here |
|---|---|---|---|
| "Fast time-to-market, small team" | Managed/serverless (Cloud Run, Firestore, BigQuery) | Self-managed VMs/GKE Standard, Cloud SQL with manual HA | Team capability and timeline outweigh the marginal cost/control benefit of self-management |
| "Strict data residency (must stay in-region)" | Regional resources pinned via Org Policy `resourceLocations` constraint | Global/multi-region services by default | Global services can replicate data outside the required region unless explicitly configured otherwise |
| "Cost is the #1 stated priority, availability is 'nice to have'" | Single-region, autoscaled, spot/preemptible where stateless | Multi-region active-active | Multi-region active-active is the most expensive HA tier — don't apply it when the business hasn't asked for it |
| "Board is worried about lock-in" | Kubernetes + Terraform + open-source-compatible DBs (Cloud SQL for PostgreSQL) | Spanner/Firestore/BigQuery-only architectures | Proprietary managed services are harder to exit even though they're operationally superior in isolation |

---

## 1.2 Designing a solution infrastructure that meets technical requirements

### Availability, reliability, resiliency — precise definitions

- **Availability**: percentage of time a system is operational and
  able to serve requests (the SLA number).
- **Reliability**: the system does what it's supposed to do, correctly,
  under expected conditions — a broader property than uptime alone.
- **Resiliency**: the system's ability to *recover* from failure
  (degrade gracefully, self-heal, fail over) rather than simply "not
  fail" — this is where retries, circuit breakers, and MIG
  auto-healing live.

These three are tested as distinct concepts — a question can describe a
system that is "available" (responding) but not "reliable" (returning
wrong/stale data) to test whether you conflate them.

### Performance requirements

- Latency targets (p50/p95/p99) drive region/multi-region placement and
  caching tier decisions (Memorystore, Cloud CDN).
- Throughput targets (requests/sec, ingest events/sec) drive the
  storage/compute-tier decision (see `00-START-HERE/DECISION-TREES.md`
  Tree 2) — a stated "2 million devices reporting every minute" number
  is a scale signal, compute it: that's roughly 33k writes/sec, which is
  a Bigtable/Pub/Sub-tier number, not a Cloud SQL-tier number.

### Security/compliance requirements (handoff to Domain 3)

Domain 1 is where these requirements are *identified and scoped* into
the design (which region, which compliance boundary, what data
classification); Domain 3 is where the *controls* (IAM, KMS, VPC-SC,
Assured Workloads) are selected. Don't confuse "Domain 1 mentions
compliance" with "Domain 1 tests IAM policy syntax" — it doesn't.

### Mapping requirements to SLA/SLO targets

```
Business statement                    → SLO target            → Design implication
"Customers expect instant response"   → p99 < 200ms            → Regional/multi-region + CDN/cache
"We can tolerate brief blips"         → 99.9% (≈8.7h/yr down)  → Single-region, multi-zone MIG
"This is mission-critical, 24/7"      → 99.99%+ (≈52min/yr)    → Multi-region active-active or
                                                                  active-passive with fast failover
"Internal tool, business hours only"  → best-effort            → Cost-optimized, single instance
                                                                  or scale-to-zero (Cloud Run)
```

### Tradeoffs — technical requirements

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "p99 latency matters more than throughput" | Regional placement close to users + Memorystore cache | A single centralized global DB with no caching | Network round-trip dominates p99 at global scale; caching/placement beats raw DB tuning |
| "Occasional data loss is acceptable, must stay cheap" | Async replication, standard backups | Synchronous multi-region writes | Synchronous replication trades latency/cost for a durability guarantee the requirement didn't ask for |
| "Predictable, steady load" | Committed-use discounts, reserved capacity | Autoscaling-only, on-demand pricing | Autoscaling is for variable load; steady load leaves CUD savings on the table |
| "Highly variable/spiky load (game launch)" | Autoscaling MIGs/GKE HPA, serverless | Fixed-size reserved capacity | Fixed capacity either underprovisions at peak or wastes money at trough |

---

## 1.3 Designing network, storage, and compute resources

### Region/zone strategy — decision factors

1. **Data residency/compliance** — hard constraint, non-negotiable once
   stated.
2. **Latency to users** — place compute near the largest user
   population; use multi-region only when users are genuinely global.
3. **Disaster recovery** — DR region should be far enough to avoid
   correlated failures (different power grid/seismic zone) but this is
   secondary to residency/latency.
4. **Cost** — regions have different pricing; not usually the deciding
   factor unless the scenario explicitly prioritizes cost.
5. **Service availability** — not every GCP service/SKU is in every
   region; verify before committing a design to an unusual region.
6. **Compliance certifications** — some regions carry specific
   certifications (e.g. certain government/FedRAMP-aligned regions).

### Compute, storage, network design

Full head-to-head tables live in `03-comparisons/01-compute-options.md`,
`03-comparisons/02-storage-database-options.md`, and
`03-comparisons/03-networking-connectivity.md` — this section covers the
*design-time integration* of those choices, not the service catalog
itself (see `02-services/` for that).

#### Network topology patterns

```
Pattern A: Single Shared VPC (centralized)
┌─────────────────────────────────────────┐
│ Host Project (Shared VPC)                │
│  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Subnet A │  │ Subnet B │  │Subnet C │ │
│  └────┬─────┘  └────┬─────┘  └────┬────┘ │
└───────┼─────────────┼─────────────┼──────┘
        │              │             │
   Service Proj 1  Service Proj 2  Service Proj 3
   (Prod workload) (Dev workload)  (Data workload)

Best for: centralized network governance, teams that share IP space
and need consistent firewall/routing policy. Trap: a single Shared VPC
across environments (dev+prod) violates most compliance separation
requirements — that's what environment folders + separate Shared VPCs
are for.

Pattern B: Multiple independent VPCs + VPC Peering
┌──────────┐        ┌──────────┐
│  VPC A   │◄──────►│  VPC B   │      Best for: strong isolation
│(Team A)  │ peering │(Team B) │      between teams/business units;
└──────────┘        └──────────┘      no shared quota, no shared
                                       firewall policy. Trap: peering
                                       is NOT transitive — A-B and B-C
                                       peered does NOT give A-C
                                       connectivity.

Pattern C: Hub-and-spoke via Network Connectivity Center
                 ┌─────────┐
        ┌───────►│   Hub   │◄───────┐
        │        │  (NCC)  │        │
   ┌────┴───┐    └────┬────┘   ┌────┴───┐
   │VPC Spoke│         │        │On-prem  │
   │   1     │    ┌────┴────┐   │(via     │
   └─────────┘    │VPC Spoke│   │Interconnect)
                   │   2     │   └─────────┘
                   └─────────┘
Best for: enterprise hybrid connectivity — many spokes (VPCs,
on-prem sites, SD-WAN) all reachable through one managed hub without
a peering-mesh explosion (N² problem).
```

#### Compute/storage integration checklist (design time)

- Does the compute tier's chosen scaling model (MIG autoscaler, HPA,
  Cloud Run concurrency) match the storage tier's connection-scaling
  characteristics? (e.g. Cloud SQL has a hard max-connections limit —
  pair with a connection pooler like the Cloud SQL Auth Proxy or
  PgBouncer when compute scales wide.)
- Is the storage tier co-located with compute to avoid cross-region
  egress and latency? (Bigtable/Cloud SQL reads from a different region
  than the compute tier is both slow and a cost trap.)
- Does the network path between compute and storage cross a VPC
  Service Controls perimeter unnecessarily? (adds friction/latency and
  is a common "why did this break" root cause in real deployments —
  worth flagging in a design review even though the exam tests it
  indirectly via Domain 3.)

### Tradeoffs — network/storage/compute design

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "Many independent teams need enforced isolation" | Multiple VPCs (Pattern B) or Shared VPC with per-team service projects | One flat VPC for everything | Isolation and blast-radius containment beat convenience once teams are independent |
| "Enterprise hybrid, many sites, growing" | Network Connectivity Center hub-and-spoke | Full-mesh VPC Peering | Peering mesh grows O(n²); NCC scales linearly and centralizes policy |
| "App needs to scale to thousands of connections, uses Cloud SQL" | Add a connection pooler (Cloud SQL Auth Proxy/PgBouncer) or move to Spanner if truly unbounded | Just raising `max_connections` | Cloud SQL has hard ceilings; pooling is the standard managed answer before a DB-tier change |

---

## 1.4 Creating a migration plan

See `00-START-HERE/DECISION-TREES.md` Tree 4 for the full "6 R's"
decision tree and `03-comparisons/04-migration-strategies.md` for the
head-to-head comparison table. This subsection covers *plan
construction*, not strategy selection alone.

### Migration plan components

1. **Discovery/assessment** — inventory workloads, dependencies, data
   volumes; classify each by the 6 R's.
2. **Sequencing** — migrate low-risk/low-dependency workloads first to
   build confidence and tooling; save tightly-coupled/high-risk systems
   for last, once the pattern is proven.
3. **Data transfer method selection**:

   | Data situation | Tool | Why |
   |---|---|---|
   | Large one-time transfer, good network link | Storage Transfer Service | Managed, scheduled, supports S3/Azure/on-prem sources |
   | Very large dataset, poor/no network link | Transfer Appliance | Physical device, sneakernet for petabyte-scale |
   | Ongoing/incremental replication into BigQuery | BigQuery Data Transfer Service | Managed, scheduled recurring transfers from SaaS sources |
   | Database migration with minimal downtime | Database Migration Service | Continuous replication + cutover for MySQL/PostgreSQL/Oracle |

4. **Cutover strategy** — big-bang vs. phased/parallel-run; phased is
   almost always the "correct" exam answer for any workload described
   as business-critical, since it minimizes downtime and provides a
   rollback path.
5. **Validation** — data integrity checks and a defined rollback
   trigger before decommissioning the source.

### Tradeoffs — migration planning

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "Must migrate before contract/hardware end-of-life, minimal re-architecture time" | Rehost (lift-and-shift) | Refactor | Speed constraint dominates; refactor's benefits aren't realized in time to matter |
| "Petabytes of data, limited/no dedicated network link" | Transfer Appliance | Storage Transfer Service over the wire | Physical shipping beats a slow/constrained link's transfer time by orders of magnitude |
| "Business-critical DB, cannot tolerate extended downtime" | Database Migration Service (continuous replication + short cutover window) | Manual dump/restore | Continuous replication minimizes the cutover window to minutes, not hours |
| "Team wants to keep paying for on-prem license investment a bit longer" | Retain (hybrid), migrate later | Force a full migration now | Business/licensing constraint overrides the "everything should move" instinct |

---

## 1.5 Envisioning future solution improvements

This is the smallest, most judgment-based sub-area — there's no
service-selection tree here. What's tested: recognizing when a design
decision should be **revisited**, not treated as permanent.

- **Technology evolution**: a design built when only Cloud SQL existed
  might warrant a Spanner migration once the business genuinely reaches
  global scale — recognizing *when* that inflection point has arrived
  (not before, per the over-engineering trap) is the skill.
- **Cost trend awareness**: committed-use discounts and reserved
  capacity decisions should be revisited as usage patterns change
  (seasonal businesses, workload right-sizing after Recommender API
  findings).
- **Compliance evolution**: new regulations (or expansion into new
  markets) can retroactively require re-architecture (e.g. adding data
  residency controls after expanding into the EU).
- **2026-era addition**: evaluating where generative-AI/Vertex AI
  integration adds real value to an *existing* architecture (e.g.
  adding AI-assisted commentary generation to HRL's existing streaming
  pipeline) versus bolting on AI features that don't serve a stated
  business need — same over-engineering trap, new vocabulary.

---

## Production architecture pattern: three-tier web app, multi-region

```
                                   Users (global)
                                        │
                                        ▼
                     ┌──────────────────────────────────┐
                     │  Global External Application LB   │  ◄── Cloud Armor (WAF/DDoS)
                     │      (Anycast, single IP)          │      + Cloud CDN (static assets)
                     └───────────────┬────────────────────┘
                                      │
                ┌─────────────────────┼─────────────────────┐
                ▼                     ▼                     ▼
        Region: us-central1   Region: europe-west1   Region: asia-southeast1
        ┌───────────────┐    ┌───────────────┐      ┌───────────────┐
        │  GKE Autopilot │    │  GKE Autopilot │      │  GKE Autopilot │
        │  (app tier)    │    │  (app tier)    │      │  (app tier)    │
        └───────┬────────┘    └───────┬────────┘      └───────┬────────┘
                │                     │                       │
        ┌───────▼────────┐    ┌───────▼────────┐      ┌───────▼────────┐
        │ Memorystore     │    │ Memorystore     │      │ Memorystore     │
        │ (regional cache)│    │ (regional cache)│      │ (regional cache)│
        └───────┬────────┘    └───────┬────────┘      └───────┬────────┘
                │                     │                       │
                └─────────────────────┼───────────────────────┘
                                      ▼
                          ┌───────────────────────┐
                          │   Cloud Spanner        │   ◄── multi-region
                          │   (multi-region config)│       config: strong
                          └───────────┬────────────┘       consistency
                                      │                     everywhere
                          ┌───────────▼────────────┐
                          │   Cloud Storage         │   ◄── user uploads,
                          │   (multi-region bucket) │       static assets
                          └─────────────────────────┘

Cross-cutting: Cloud Monitoring + Logging in every region, aggregated
at an org-level log sink into BigQuery for centralized analysis. IAM/Org
Policy applied at the folder level above all three regional projects
(or all three service projects under one Shared VPC host).
```

**Why this shape, and when to deviate:**
- Global LB + Cloud Armor + CDN is the default front door for any
  public-facing multi-region app — deviate (regional LB only) when the
  scenario states a single-region user base.
- GKE Autopilot chosen over Standard because the pattern assumes "web
  app team, not a platform team" — swap to Standard if the scenario
  states heavy custom node/GPU requirements.
- Spanner chosen because the pattern assumes genuinely global strong
  consistency needs (e.g. inventory counts must never be
  double-sold across regions) — if the scenario tolerates eventual
  consistency, replace with regional Cloud SQL + async cross-region
  replicas at much lower cost (see Tree 2).

---

## Domain 1-specific exam traps

1. Picking a multi-region architecture (like the pattern above) for a
   scenario that never states a multi-region user base or compliance
   need — re-read §1.1/1.2 tradeoff tables before committing.
2. Treating "migration plan" questions as a pure technology question —
   sequencing and business risk (§1.4) are tested as heavily as the R
   selection itself.
3. Confusing "future improvements" questions (1.5, judgment-based, no
   single right service) with "technical requirements" questions (1.2,
   there usually *is* a best-fit service) — 1.5 answers tend to be about
   *process* (re-evaluate periodically, monitor cost trends) more than
   a specific service swap.
