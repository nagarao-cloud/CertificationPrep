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
6. [Production architecture pattern: three-tier web app, multi-region](#production-architecture-pattern-three-tier-web-app-multi-region)
7. [Production architecture pattern: hybrid enterprise with GKE Enterprise](#production-architecture-pattern-hybrid-enterprise-with-gke-enterprise)
8. [Worked scenario walkthrough](#worked-scenario-walkthrough-applying-the-11--13-frameworks-together)
9. [Domain 1-specific exam traps](#domain-1-specific-exam-traps)

---

## 1.1 Designing a solution infrastructure that meets business requirements

The exam frames business requirements as constraints an architecture
must satisfy *even when they conflict with the technically "best"
answer*. This subsection is about **requirement translation**: turning
a stakeholder sentence into an architectural constraint. Every scenario
question on the exam is really testing whether you can do this
translation correctly before you ever touch a service name.

### Who states requirements, and how to weight them

Case-study and scenario questions attribute requirements to specific
roles. Learning to weight those roles correctly is itself tested:

| Role | Typically cares about | Weight when requirements conflict |
|---|---|---|
| CEO / business sponsor | Time-to-market, cost ceiling, competitive differentiation | Usually the tiebreaker — business goals outrank a technically "purer" design |
| CFO / finance | Budget predictability, showback/chargeback, CapEx vs. OpEx | Cost constraints are hard unless explicitly marked "not the priority" |
| CTO / VP Engineering | Technical debt, team capability, build vs. buy | Drives the managed-vs-self-managed axis (§1.1 team-capability row below) |
| Legal / Compliance officer | Regulatory regime, data residency, audit posture | Non-negotiable — compliance requirements are treated as hard constraints, never traded off against cost or speed |
| End users / customers (implied) | Latency, availability, UX | Usually expressed indirectly through an SLA/SLO number rather than stated directly |

When a scenario gives conflicting signals from two roles (e.g. CFO
wants cost minimized, VP Engineering wants a rewrite), the exam expects
you to resolve it using the **explicitly stated priority**, not your
own judgment about which role "should" win — if the scenario ranks
"cost" above "modernization," rank your answer the same way.

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
| "We need to be acquired / go public in 18 months" | Audit-readiness, financial traceability, defensible architecture documentation | Push toward IaC (auditable change history), formal IAM structure, cost showback — due-diligence-friendly, not just functional |
| "Our on-call team is 3 people" | Operational load ceiling | Managed services, aggressive autoscaling/autohealing defaults, minimize distinct technologies in the stack |
| "Global user base from day one" | Multi-region is a Day-1 requirement, not a later optimization | Global LB, multi-region storage/DB tier chosen up front — retrofitting multi-region later is expensive |

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
  single-vendor dependency" requirements push toward GKE Enterprise
  (Google's current name for its hybrid/multi-cloud Kubernetes platform
  — Anthos is the same product family under an older/legacy name;
  MEDIUM confidence on the exact rebrand mechanics, see RUNBOOK §7),
  Terraform, and Kubernetes-portable workloads over GCP-only managed
  services like Spanner or Firestore.
- **Application acceptance criteria**: the scenario's "definition of
  done" for a migrated or newly-built system — performance benchmarks,
  security sign-off, and business-stakeholder UAT (user acceptance
  testing) are usually named explicitly; treat an unstated acceptance
  criterion as a gap to flag, not something to assume away.

### Cost model literacy (CapEx vs. OpEx, TCO)

- Cloud spend is OpEx by nature (pay-as-you-go) versus on-prem's CapEx
  (large upfront hardware purchase) — a scenario emphasizing "avoid
  large upfront capital expenditure" or "we're a startup, cash flow
  matters" is a straightforward signal toward cloud-native, consumption-
  based services (serverless, autoscaling) over reserved/committed
  capacity that resembles CapEx in behavior (even though it's technically
  still OpEx on GCP).
- **Total Cost of Ownership (TCO)** comparisons the exam expects you to
  reason about qualitatively (not compute exact numbers): self-managed
  infrastructure's TCO includes the *hidden* cost of the ops team
  maintaining it, not just the compute/storage line items — a scenario
  citing "small team" as a constraint is implicitly telling you the
  TCO of a self-managed option is higher than its sticker price suggests.

### Tradeoffs — business requirements

| When the scenario says… | Prefer | Don't reach for | Why the alternative loses here |
|---|---|---|---|
| "Fast time-to-market, small team" | Managed/serverless (Cloud Run, Firestore, BigQuery) | Self-managed VMs/GKE Standard, Cloud SQL with manual HA | Team capability and timeline outweigh the marginal cost/control benefit of self-management |
| "Strict data residency (must stay in-region)" | Regional resources pinned via Org Policy `resourceLocations` constraint | Global/multi-region services by default | Global services can replicate data outside the required region unless explicitly configured otherwise |
| "Cost is the #1 stated priority, availability is 'nice to have'" | Single-region, autoscaled, spot/preemptible where stateless | Multi-region active-active | Multi-region active-active is the most expensive HA tier — don't apply it when the business hasn't asked for it |
| "Board is worried about lock-in" | Kubernetes + Terraform + open-source-compatible DBs (Cloud SQL for PostgreSQL, AlloyDB) | Spanner/Firestore/BigQuery-only architectures | Proprietary managed services are harder to exit even though they're operationally superior in isolation |
| "Multi-cloud or eventual multi-cloud exit strategy required" | GKE Enterprise for workload portability, Terraform for cross-cloud IaC consistency | GCP-only managed PaaS/serverless with no portable equivalent | Business explicitly asked for optionality — architecture should preserve it even at some operational cost |
| "We need to show investors/auditors a defensible cost trail" | IaC with PR review history, labeled resources, billing export to BigQuery | Manual Console changes, unlabeled ad hoc resources | Due-diligence and audit scenarios reward traceability over convenience |

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

### The "nines" — what each availability target actually buys

Memorizing the downtime budget behind each SLA number is one of the
highest-leverage things to have cold for scenario math (e.g. "we've
already had 2 hours of downtime this quarter — does that blow our
99.9% target?"):

| Availability | Downtime / year | Downtime / month | Downtime / week | Typical design tier |
|---|---|---|---|---|
| 99% ("two nines") | ~3.65 days | ~7.3 hours | ~1.7 hours | Dev/test, internal non-critical tools |
| 99.9% ("three nines") | ~8.76 hours | ~43.8 minutes | ~10.1 minutes | Single-region, multi-zone MIG/GKE — the common production baseline |
| 99.95% | ~4.38 hours | ~21.9 minutes | ~5 minutes | Regional HA database (Cloud SQL regional HA), multi-zone everything |
| 99.99% ("four nines") | ~52.6 minutes | ~4.4 minutes | ~1 minute | Multi-region active-passive with automated failover |
| 99.999% ("five nines") | ~5.26 minutes | ~26.3 seconds | ~6 seconds | Multi-region active-active (Spanner multi-region, global LB) — rarely justified unless explicitly required; very expensive |

**Composite SLA trap**: when a request path crosses multiple
independently-failing components (LB → app tier → DB), the *composite*
availability is the product of each component's availability, not the
lowest single component's number — a system built from four 99.9%
components in series is *not* 99.9% end to end (it's closer to 99.6%
uncompounded, worse with more hops). This is why the exam rewards
*redundancy at each tier*, not just picking one high-availability
component and assuming the whole system inherits its number.

### Performance requirements

- Latency targets (p50/p95/p99) drive region/multi-region placement and
  caching tier decisions (Memorystore, Cloud CDN). p99 in particular is
  dominated by tail effects (a slow dependency, GC pause, cold start) —
  a design optimizing only for p50 can still fail a stated p99 SLO.
- Throughput targets (requests/sec, ingest events/sec) drive the
  storage/compute-tier decision (see `00-START-HERE/DECISION-TREES.md`
  Tree 2) — a stated "2 million devices reporting every minute" number
  is a scale signal, compute it: that's roughly 33k writes/sec, which is
  a Bigtable/Pub/Sub-tier number, not a Cloud SQL-tier number.
- **Capacity planning**: translate a stated growth rate ("we expect 10x
  users in 18 months") into a scaling-model decision — does the chosen
  compute/storage tier scale horizontally without a re-architecture
  (Bigtable, Spanner, GKE/Cloud Run autoscaling), or does it hit a
  vertical ceiling that forces a costly mid-flight migration (a single
  Cloud SQL instance sized for today's load only)? Favor the option that
  doesn't require a future re-architecture when growth is explicitly
  stated as likely.

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

### Scalability axes: horizontal vs. vertical, stateless vs. stateful

- **Horizontal scaling** (add more instances/nodes) is the default
  exam-preferred pattern for anything described as needing to handle
  variable or growing load — it has no hard ceiling and pairs with
  autohealing (a failed instance is just replaced, not "the" instance).
- **Vertical scaling** (bigger machine type) has a hard ceiling (the
  largest machine type available) and creates a single point of failure
  — correct only for workloads that are inherently hard to
  horizontally distribute (a legacy monolith not yet refactored, a
  single-writer database engine without a horizontally-scalable
  alternative in scope).
- **Statelessness is the enabler**: horizontal scaling only works
  cleanly when compute instances don't hold local state that would be
  lost on replacement — this is why "externalize session state" (to
  Memorystore or a database) is a recurring correct answer whenever a
  scenario describes autoscaling *and* user sessions in the same
  breath.

### Tradeoffs — technical requirements

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "p99 latency matters more than throughput" | Regional placement close to users + Memorystore cache | A single centralized global DB with no caching | Network round-trip dominates p99 at global scale; caching/placement beats raw DB tuning |
| "Occasional data loss is acceptable, must stay cheap" | Async replication, standard backups | Synchronous multi-region writes | Synchronous replication trades latency/cost for a durability guarantee the requirement didn't ask for |
| "Predictable, steady load" | Committed-use discounts, reserved capacity | Autoscaling-only, on-demand pricing | Autoscaling is for variable load; steady load leaves CUD savings on the table |
| "Highly variable/spiky load (game launch)" | Autoscaling MIGs/GKE HPA, serverless | Fixed-size reserved capacity | Fixed capacity either underprovisions at peak or wastes money at trough |
| "Legacy monolith, can't be re-architected this cycle" | Vertical scaling (bigger machine type) as a stopgap, plan horizontal refactor later | Forcing a horizontal-scaling redesign this cycle | The scenario has explicitly ruled out re-architecture timing — respect the stated constraint even though horizontal is "better" in isolation |
| "Users are global and expect low latency everywhere" | Multi-region compute + storage from day one | Single-region with a CDN bolted on later | CDN alone only helps static/cacheable content; dynamic request latency still needs regional compute/data placement |

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

### Compute tier decision matrix

Full service-by-service detail lives in `02-services/01-compute.md` and
`03-comparisons/01-compute-options.md` — this is the design-time
summary for choosing *which tier* a workload belongs on.

| Tier | Best for | Don't use when | Scaling model | Ops burden | Cold start |
|---|---|---|---|---|---|
| Compute Engine (MIGs) | Legacy/lift-and-shift, workloads needing OS-level control, licensing-bound software (BYOL), sole-tenant compliance | Team wants zero infra management, workload is a simple stateless HTTP service | Managed instance group autoscaler | High (patching, image management) | N/A (always-on) |
| GKE Standard | Teams with Kubernetes expertise needing node-level control (custom machine types, GPUs, DaemonSets, specific CNI needs) | Small team with no K8s experience, simple stateless service | HPA (pods) + cluster autoscaler (nodes) | Medium-high (node pool management) | Low (warm nodes) |
| GKE Autopilot | Teams wanting Kubernetes API/ecosystem without node management; per-pod billing | Workload needs privileged containers, custom node-level daemons, GPU types Autopilot doesn't support | Fully managed, pod-level | Low | Low |
| Cloud Run | Stateless containers, HTTP/event-driven workloads, teams wanting scale-to-zero and minimal ops | Long-lived persistent connections beyond request timeout limits, workloads needing privileged/host-level access | Concurrency-based autoscaling, scale-to-zero | Very low | Medium (unless min-instances set) |
| Cloud Functions | Small, single-purpose event-driven logic (Pub/Sub trigger, Storage trigger, HTTP) | Complex multi-step application logic, long-running processes | Per-invocation autoscaling, scale-to-zero | Very low | Medium-high |
| App Engine Standard | Simple web apps/APIs wanting the most hands-off PaaS experience, teams that want built-in versioning/traffic-splitting without container packaging | Workload needs custom runtime/OS dependencies (App Engine Flexible could, but is de-emphasized — see RUNBOOK §7) | Automatic, request-based | Very low | Low-medium |
| Vertex AI (training/serving) | ML model training, batch prediction, online model serving, MLOps pipelines | General-purpose application compute (it's not a substitute for GKE/Cloud Run) | Autoscaling endpoints, distributed training | Low-medium (managed) | Varies by model size |

**Rule of thumb ordering for "least ops burden first"**: Cloud
Functions/Cloud Run → GKE Autopilot → App Engine Standard → GKE
Standard → Compute Engine. A scenario emphasizing "small team, minimal
ops" without other constraints should default toward the left of this
list; a scenario emphasizing "need full control, complex
multi-container topology, existing K8s tooling" pushes right.

### Storage and database decision matrix (including AlloyDB)

Full head-to-head detail lives in
`03-comparisons/02-storage-database-options.md` — this is the
design-time summary, now including **AlloyDB for PostgreSQL**, a
current and architect-relevant managed database that was missing from
this folder's first generation pass (closed 2026-08-10 — see RUNBOOK
§7 for the currency note; treat AlloyDB as a routine decision-matrix
candidate alongside Cloud SQL and Spanner, not a niche/rare-use
service).

| Service | Data model | Best for | Don't use when | Scale ceiling | Consistency |
|---|---|---|---|---|---|
| Cloud SQL (MySQL/PostgreSQL/SQL Server) | Relational | Traditional relational apps, moderate scale, lift-and-shift from on-prem RDBMS, teams wanting a familiar/portable engine | Need horizontal write scaling beyond one primary, need multi-region automatic failover | Vertical (single primary) + read replicas | Strong (primary), eventual (async replicas) |
| **AlloyDB for PostgreSQL** | Relational (PostgreSQL-compatible) | Demanding transactional workloads needing higher performance than Cloud SQL, hybrid transactional/analytical workloads (HTAP-adjacent via columnar engine), teams wanting PostgreSQL compatibility without Spanner's schema/API changes | Team needs a non-PostgreSQL engine (MySQL/SQL Server — stay on Cloud SQL), truly unbounded horizontal write scale across regions (that's Spanner's job) | Higher vertical ceiling than Cloud SQL, regional HA; check current regional read-scaling limits before assuming unbounded | Strong (primary), fast read pool replicas |
| Cloud Spanner | Relational, horizontally scalable | Global scale, strong consistency required across regions, workloads that would otherwise need complex manual sharding | Small/simple apps where the cost and schema-design overhead isn't justified | Effectively unbounded (horizontal, no resharding) | Strong, globally (in multi-region config) |
| Bigtable | Wide-column NoSQL | High-throughput time-series/IoT/analytics workloads, single-digit-millisecond p99 at massive scale | Need SQL query flexibility, low/unpredictable throughput (Bigtable's pricing/ops model assumes sustained high throughput) | Massive horizontal (petabytes, millions of ops/sec) — bound by row-key design, not raw capacity | Strong per-row, eventual across replicated clusters |
| Firestore | Document NoSQL | Mobile/web app backends, flexible schema, real-time sync, serverless-native | Complex multi-row transactions/joins across large datasets, analytical queries | Horizontal, serverless-managed | Strong (single document), configurable elsewhere |
| BigQuery | Columnar analytical (OLAP) | Large-scale analytics/BI, ad hoc SQL over huge datasets, data warehouse | Low-latency single-row transactional (OLTP) access — BigQuery isn't built for point lookups at millisecond latency | Petabyte-scale, serverless | Consistent for query, not a transactional OLTP store |
| Memorystore (Redis/Memcached) | In-memory cache/KV | Session state externalization, hot-path caching in front of a slower DB | Durable system-of-record storage — it's a cache, not your source of truth (unless explicitly using Redis persistence for a narrow, understood use case) | Bound by instance memory tier | N/A (cache semantics) |
| Filestore | Managed NFS | Lift-and-shift apps needing a POSIX filesystem, shared file storage for GKE/Compute Engine | Object storage use cases (use Cloud Storage instead — cheaper, more scalable, not POSIX-bound) | Instance-tier bound | POSIX-standard |

**AlloyDB vs. Cloud SQL vs. Spanner — the three-way call the exam is
most likely to test:**

| Scenario signal | Choose |
|---|---|
| "Standard relational app, moderate scale, cost-sensitive, portable engine desired" | Cloud SQL |
| "Postgres-compatible app needs materially higher transaction throughput / faster analytics on operational data than Cloud SQL delivers, staying single-region or simple HA is fine" | AlloyDB |
| "Truly global scale, need strong consistency across regions, willing to accept Spanner's schema/API differences and cost" | Spanner |
| "Team explicitly wants to avoid any proprietary/non-standard SQL dialect or API surface" | Cloud SQL or AlloyDB (both PostgreSQL-wire-compatible) over Spanner |

### Network topology patterns

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

### Hybrid connectivity and GKE Enterprise

Hybrid connectivity is a recurring, stable PCA theme — both the EHR
Healthcare and TerramEarth case studies assume a hybrid footprint (see
CLAUDE.md §7). The design-time decisions:

| Need | Mechanism | Detail |
|---|---|---|
| High-bandwidth, low-latency, private connection to a data center | Dedicated Interconnect | Direct physical connection, 10/100 Gbps circuits; highest cost, highest performance/reliability |
| Moderate bandwidth without a direct physical circuit | Partner Interconnect | Via a supported service provider, when a direct circuit isn't feasible or the bandwidth need doesn't justify one |
| Lower bandwidth, encrypted, can tolerate internet-path latency variability | Cloud VPN (HA VPN) | IPsec over the public internet; cheapest, fastest to provision, no physical circuit lead time |
| Many sites / complex mesh | Network Connectivity Center hub-and-spoke (Pattern C above) | Centralizes hybrid + inter-VPC routing policy |
| Consistent Kubernetes platform spanning on-prem, GCP, and other clouds | **GKE Enterprise** (Google's current branding; Anthos is the legacy/synonym name — MEDIUM confidence on rebrand specifics, see RUNBOOK §7) | Lets a scenario describing "run the same workloads on-prem and in GCP with unified management/policy" be answered with one platform rather than two separately-managed Kubernetes stacks |

**GKE Enterprise — when it's the answer, and when it's overkill:**

| Scenario signal | Prefer | Don't reach for | Why |
|---|---|---|---|
| "Consistent app platform across on-prem and multiple clouds, centralized policy/config across all clusters" | GKE Enterprise | Separately-managed GKE clusters + a from-scratch on-prem Kubernetes distro | Fleet-level management, policy, and service-mesh capability is the point of the product — rebuilding it ad hoc duplicates GCP-native tooling |
| "Single-cloud, GCP-only, no on-prem/other-cloud requirement" | Plain GKE (Standard or Autopilot) | GKE Enterprise | The fleet/multi-environment management layer is unused cost/complexity when there's only one environment |
| "Team wants Kubernetes but has zero on-prem or multi-cloud requirement, ever" | GKE Autopilot | GKE Enterprise | Don't reach for the hybrid/fleet platform just because it *can* also run single-cluster workloads |

### Compute/storage integration checklist (design time)

- Does the compute tier's chosen scaling model (MIG autoscaler, HPA,
  Cloud Run concurrency) match the storage tier's connection-scaling
  characteristics? (e.g. Cloud SQL and AlloyDB both have a hard
  max-connections limit — pair with a connection pooler like the Cloud
  SQL Auth Proxy or PgBouncer when compute scales wide.)
- Is the storage tier co-located with compute to avoid cross-region
  egress and latency? (Bigtable/Cloud SQL/AlloyDB reads from a
  different region than the compute tier is both slow and a cost trap.)
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
| "App needs to scale to thousands of connections, uses Cloud SQL/AlloyDB" | Add a connection pooler (Cloud SQL Auth Proxy/PgBouncer) or move to Spanner if truly unbounded | Just raising `max_connections` | Cloud SQL/AlloyDB have hard ceilings; pooling is the standard managed answer before a DB-tier change |
| "Postgres app needs materially more transactional throughput than Cloud SQL delivers, single-region is fine" | Migrate to AlloyDB | Jump straight to Spanner | Spanner's schema/API changes and global-scale cost aren't justified by a single-region throughput problem AlloyDB solves directly |
| "On-prem data center must keep running the same containerized workloads as GCP, with one control plane" | GKE Enterprise | Two independently-managed Kubernetes stacks | Unified fleet management/policy is exactly the stated requirement — two stacks doubles the ops burden the scenario is trying to avoid |

---

## 1.4 Creating a migration plan

See `00-START-HERE/DECISION-TREES.md` Tree 4 for the full "6 R's"
decision tree and `03-comparisons/04-migration-strategies.md` for the
head-to-head comparison table. This subsection covers *plan
construction*, not strategy selection alone.

### The 6 R's, in depth

| Strategy | What it means | Effort | Typical signal in the scenario |
|---|---|---|---|
| Rehost | Lift-and-shift — move the VM/app as-is onto Compute Engine, no code change | Lowest | "Data center lease ending soon," "fastest possible migration," no re-architecture time budgeted |
| Replatform | Move with minimal modification — e.g. containerize without rewriting, or move to a managed DB engine without schema redesign | Low-medium | "Some modernization is fine but a full rewrite isn't in scope this cycle" |
| Repurchase | Replace with a SaaS/COTS equivalent | Varies (mostly a procurement/contract effort, not engineering) | "We're replacing our self-hosted CRM/ERP with a SaaS product" |
| Refactor | Re-architect to be cloud-native (microservices, managed services, serverless) | Highest | "We want to fully modernize," "take advantage of cloud-native scalability," long timeline stated |
| Retain | Keep as-is, don't migrate (yet) | None (this cycle) | "Legacy system with an unclear future," licensing/contractual lock-in preventing migration now |
| Retire | Decommission — the workload no longer needs to exist | Removal effort only | "This system is being sunset," "duplicate/redundant functionality identified during discovery" |

### Migration plan components

1. **Discovery/assessment** — inventory workloads, dependencies, data
   volumes; classify each by the 6 R's. A dependency graph matters as
   much as the workload list itself — a workload with many tight
   dependencies is riskier to migrate in isolation and often needs to
   move together with what it depends on (a "wave," not a single item).
2. **Sequencing** — migrate low-risk/low-dependency workloads first to
   build confidence and tooling; save tightly-coupled/high-risk systems
   for last, once the pattern is proven. A common exam-tested sequencing
   principle: migrate stateless/edge-facing components before
   stateful/core-data components, since rollback is cheaper on the edge.
3. **Data transfer method selection**:

   | Data situation | Tool | Why |
   |---|---|---|
   | Large one-time transfer, good network link | Storage Transfer Service | Managed, scheduled, supports S3/Azure/on-prem sources |
   | Very large dataset, poor/no network link | Transfer Appliance | Physical device, sneakernet for petabyte-scale |
   | Ongoing/incremental replication into BigQuery | BigQuery Data Transfer Service | Managed, scheduled recurring transfers from SaaS sources |
   | Database migration with minimal downtime | Database Migration Service | Continuous replication + cutover for MySQL/PostgreSQL/Oracle (including migrating into AlloyDB or Cloud SQL as the target) |

4. **Cutover strategy** — big-bang vs. phased/parallel-run; phased is
   almost always the "correct" exam answer for any workload described
   as business-critical, since it minimizes downtime and provides a
   rollback path. A parallel-run pattern (old and new systems both
   live, traffic gradually shifted) is the safest and most frequently
   tested "correct" answer when downtime tolerance is low.
5. **Validation** — data integrity checks and a defined rollback
   trigger before decommissioning the source. "Decommission the source
   immediately after cutover" is a trap answer whenever the scenario
   doesn't explicitly state validation is complete — always keep the
   source available for a defined rollback window first.

### Migration wave planning (ASCII)

```
Wave 1 (low risk, builds confidence)
  Stateless web front-ends, static assets → Cloud Storage/CDN
        │
        ▼
Wave 2 (medium risk, some dependency)
  Application/API tier → Compute Engine or GKE (Rehost/Replatform)
        │
        ▼
Wave 3 (highest risk, core state)
  Databases → Database Migration Service, parallel-run with
  application traffic gradually shifted via a feature flag or LB
  weight, source kept live until validation passes
        │
        ▼
Wave 4 (cleanup)
  Decommission on-prem source systems only after a defined
  validation window and explicit rollback-trigger sign-off
```

### Tradeoffs — migration planning

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "Must migrate before contract/hardware end-of-life, minimal re-architecture time" | Rehost (lift-and-shift) | Refactor | Speed constraint dominates; refactor's benefits aren't realized in time to matter |
| "Petabytes of data, limited/no dedicated network link" | Transfer Appliance | Storage Transfer Service over the wire | Physical shipping beats a slow/constrained link's transfer time by orders of magnitude |
| "Business-critical DB, cannot tolerate extended downtime" | Database Migration Service (continuous replication + short cutover window) | Manual dump/restore | Continuous replication minimizes the cutover window to minutes, not hours |
| "Team wants to keep paying for on-prem license investment a bit longer" | Retain (hybrid), migrate later | Force a full migration now | Business/licensing constraint overrides the "everything should move" instinct |
| "Duplicate system found during discovery, unclear owner, low usage" | Retire | Migrate it anyway "to be safe" | Migrating a workload nobody needs wastes the migration budget the scenario is trying to conserve |
| "Existing SaaS vendor already offers what we're building in-house" | Repurchase | Refactor the in-house version | Rebuilding commodity functionality cloud-native still costs more than adopting an existing SaaS product when one fits |

---

## 1.5 Envisioning future solution improvements

This is the smallest, most judgment-based sub-area — there's no
service-selection tree here. What's tested: recognizing when a design
decision should be **revisited**, not treated as permanent.

- **Technology evolution**: a design built when only Cloud SQL existed
  might warrant an AlloyDB or Spanner migration once the business
  genuinely reaches the performance/scale inflection point — recognizing
  *when* that inflection point has arrived (not before, per the
  over-engineering trap) is the skill.
- **Cost trend awareness**: committed-use discounts and reserved
  capacity decisions should be revisited as usage patterns change
  (seasonal businesses, workload right-sizing after Recommender API
  findings — see Domain 4 §4.3).
- **Compliance evolution**: new regulations (or expansion into new
  markets) can retroactively require re-architecture (e.g. adding data
  residency controls after expanding into the EU).
- **Organizational evolution**: a design built for one small team can
  need re-architecture purely because the *team* has grown (Conway's
  Law — see Domain 4 §4.2) — more teams often means the architecture
  needs clearer service boundaries even if the technical load hasn't
  grown proportionally.
- **2026-era addition**: evaluating where generative-AI/Vertex AI
  integration adds real value to an *existing* architecture (e.g.
  adding AI-assisted commentary generation to HRL's existing streaming
  pipeline) versus bolting on AI features that don't serve a stated
  business need — same over-engineering trap, new vocabulary.

### A simple "revisit trigger" checklist

A design decision is worth revisiting when at least one of these has
materially changed since it was made — this is the practical test the
exam expects you to apply rather than a fixed schedule:

1. Scale has crossed an order of magnitude from the original design
   assumption.
2. A new managed service now covers what used to require custom
   engineering.
3. A compliance regime has been added or tightened.
4. The team's operational capability has changed (grown, shrunk, gained
   new expertise).
5. A cost driver identified by Recommender API/billing analysis has
   persisted for multiple billing cycles, not a one-time spike.

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
  consistency and stays single-region, replace with AlloyDB or regional
  Cloud SQL + async cross-region replicas at much lower cost (see Tree 2
  and the AlloyDB-vs-Cloud-SQL-vs-Spanner table in §1.3).

---

## Production architecture pattern: hybrid enterprise with GKE Enterprise

```
   On-premises data center                    Google Cloud
  ┌────────────────────────┐                 ┌────────────────────────────┐
  │  Existing workloads on  │                 │  GKE Enterprise fleet       │
  │  bare-metal K8s cluster │                 │  management plane           │
  │  (member of the fleet)  │◄────────────────┤  (policy, config, service   │
  └───────────┬─────────────┘   Dedicated     │   mesh, uniform across all  │
              │                 Interconnect   │   member clusters)          │
              │                 (private,      └──────────────┬──────────────┘
              │                  high-bw)                      │
              │                                                 ▼
              │                                     ┌────────────────────────┐
              │                                     │  GKE cluster (GCP)      │
              │                                     │  — fleet member,        │
              │                                     │  same policies applied  │
              │                                     └───────────┬─────────────┘
              │                                                 │
              └─────────────── shared identity: Workload ───────┘
                                Identity Federation, no
                                exported keys crossing the
                                on-prem/cloud boundary

  Central policy source (Config Sync / policy-as-code) pushes the same
  Org Policy-equivalent guardrails and service-mesh configuration to
  every fleet member — on-prem and GCP clusters are managed as one
  logical platform, not two.
```

**Why this shape, and when to deviate:** this is the pattern a
scenario is asking for whenever it describes workloads that must run
identically on-prem *and* in GCP with unified governance (EHR
Healthcare's hybrid footprint and TerramEarth's dealer-network model
both gesture at this shape). Deviate to plain GKE (no fleet layer) the
moment the on-prem requirement disappears — see the GKE Enterprise
tradeoff table in §1.3 for the overkill signal.

---

## Worked scenario walkthrough: applying the 1.1–1.3 frameworks together

**Scenario fragment:** *"A mid-size healthcare SaaS company (analogous
to the EHR Healthcare case study) needs to launch a new patient-portal
feature within 4 months. The CFO has capped new infrastructure spend.
Legal requires all patient data to remain within-region. The
engineering team has strong PostgreSQL experience but no Kubernetes
experience. Expected load is moderate today but the VP of Engineering
expects 5x growth within a year if the feature succeeds."*

Applying the framework:

1. **§1.1 translation**: "4 months" → timeline is the binding
   constraint (favor managed services); "capped spend" → cost ceiling,
   but not stated as the #1 priority over the timeline; "PostgreSQL
   experience, no Kubernetes" → team-capability signal against GKE;
   "patient data in-region" → hard compliance constraint (Domain 3
   handoff: Org Policy `resourceLocations`, likely HIPAA).
2. **§1.2 translation**: no explicit SLA number stated → don't invent
   a five-nines requirement; "5x growth within a year" is a capacity
   planning signal → pick a storage tier with headroom to scale without
   a forced migration.
3. **§1.3 selection**: compute → Cloud Run (matches "no Kubernetes
   experience," fast to ship, minimal ops, fits the 4-month timeline)
   over GKE. Database → AlloyDB for PostgreSQL (matches the team's
   existing PostgreSQL skill exactly, and gives headroom for the stated
   5x growth without the schema/API disruption a later Spanner move
   would cost) over plain Cloud SQL, which would likely need a
   re-architecture at that growth level, and over Spanner, which the
   team has no experience with and the scenario gives no global-scale
   signal for.
4. **Result**: Cloud Run + AlloyDB, single-region (matches residency
   constraint), CMEK enabled (healthcare data — Domain 3 handoff), cost
   stays low relative to a GKE+Spanner alternative that neither the
   timeline nor the team capability supports.

This walkthrough is the shape of reasoning the exam rewards: every
service choice traces back to an explicit scenario signal, not to
"which service is objectively the most powerful."

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
4. Defaulting to Spanner whenever a question mentions "scale" — Spanner
   is correct for *global, strongly-consistent* scale specifically; a
   single-region throughput/performance problem is very often an
   AlloyDB answer instead, at much lower cost and complexity.
5. Reaching for GKE Enterprise/Anthos-family answers for a purely
   single-cloud, no-on-prem scenario just because the question mentions
   "Kubernetes" — the hybrid/fleet layer is only correct when a hybrid
   or multi-cloud requirement is actually stated.
6. Ignoring stated team-capability constraints ("no Kubernetes
   experience," "strong PostgreSQL skills") in favor of the
   "technically best" service — Domain 1 consistently rewards matching
   the team and timeline, not maximizing architectural elegance in a
   vacuum.
