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
- **Legacy application estate**: SaaS grown by acquisition tends to
  carry a mixed bag of application ages and frameworks — expect the
  case study to include at least one system that isn't a clean
  containerization candidate, testing whether you'll force everything
  into one modernization pattern or right-size the approach per app.

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

## Reference architecture — steady-state request path

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

## Reference architecture — the other three paths

The steady-state request path above is only one slice of what a
real EHR Healthcare deployment needs. Case-study questions routinely
probe the *other* paths — how code gets deployed, how the platform is
observed, and what happens on failure — not just how a patient record
is read. Treat all four as one system.

### CI/CD path

```
  Developer commits ──► Cloud Build (per-region trigger,
                          builds container image)
                                │
                                ▼
                     Artifact Registry (per-region, or
                     one central registry with regional
                     pull — image itself carries no PHI,
                     so residency rules don't force
                     per-region registries the way they
                     force per-region *data* stores)
                                │
                                ▼
                     Binary Authorization (attestation
                     check — only images signed by the
                     CI pipeline, scanned clean, may
                     deploy — a HIPAA-relevant software-
                     supply-chain control auditors ask
                     about directly)
                                │
                                ▼
                     Cloud Deploy (progressive delivery:
                     staging region → canary in one
                     production region → full regional
                     rollout, never all regions at once)
                                │
                                ▼
                     GKE Standard clusters, one region
                     at a time, with automated rollback
                     on failed health checks/SLO burn
```

**Why never deploy to all regions simultaneously:** a bad release that
takes down US, EU, and the "other" region together turns a regional
incident into a global compliance-visible outage across every
jurisdiction at once — the exact opposite of the isolation the
per-region data design was built to guarantee. Sequenced, canaried
regional rollout is Domain 6 §6.2 material tested specifically through
this case study.

### Observability path

```
  Each region's GKE + Cloud SQL emit:
        │
        ▼
  Cloud Monitoring (per-region SLOs — e.g. patient-record
  read latency, appointment-booking availability — each
  region monitored independently, not one blended global SLO
  that could hide a single region's degradation)
        │
        ▼
  Cloud Logging → per-region log sink →
    - BigQuery (region-local dataset, for HIPAA audit query/
      reporting — stays inside the same residency boundary)
    - Cloud Storage (region-local bucket, long-term retention,
      lifecycle-tiered to Coldline/Archive for cost)
        │
        ▼
  Alerting policies notify the on-call rotation; alerting
  is regional too — an EU on-call engineer is not paged for
  (and does not need visibility into) US-only PHI incidents
  unless the incident is explicitly cross-region (e.g. the
  shared Interconnect link itself)
```

**Why per-region log sinks, not one global BigQuery audit dataset:**
the audit trail itself contains PHI-adjacent access records — routing
every region's logs into a single global dataset recreates the same
residency violation the primary data design avoids. The observability
plane must respect the same boundary as the data plane.

### DR / failover path

```
  Region: EU primary                Region: EU secondary
  (e.g. europe-west1)               (e.g. europe-west3 —
                                      SAME compliance boundary,
                                      different physical region)
        │                                    │
        ▼                                    ▼
  Cloud SQL HA (synchronous          Cloud SQL cross-region
  same-region failover,               read replica WITHIN
  RPO≈0, automatic) ── async ──►     the EU jurisdiction only
  replication to in-boundary
  DR region
        │
        ▼
  On regional outage: promote the EU-internal replica,
  NOT a US or APAC replica — DR target must stay inside
  the same residency boundary as the primary (see exam
  trap below)

  GKE: regional cluster already spans 3 zones (zone failure
  is HA, handled automatically); a full regional outage
  triggers the Cloud Deploy pipeline to redeploy the last-
  known-good image into the in-boundary DR region, backed
  by the promoted Cloud SQL replica
```

## Alternatives considered and rejected

### 1. Single global Cloud Spanner instance instead of per-region Cloud SQL

- **The tempting case for it:** Spanner gives strong consistency at
  global scale, removes the operational burden of managing N separate
  regional database fleets, and is the "textbook" answer whenever a
  scenario says "global" and "consistent" in the same sentence (Tree 2's
  exam trap).
- **Why it's rejected here:** Spanner's multi-region configurations
  replicate data across the configured region set for durability and
  read-latency reasons — that's the point of the service. For EHR
  Healthcare, replication *is* the violation: a customer's PHI leaving
  their contracted jurisdiction breaks HIPAA-equivalent residency
  commitments regardless of how strong the consistency guarantee is.
  Consistency and residency are different axes, and this case study
  is built to test whether a candidate conflates them.
- **What's used instead:** regional Cloud SQL (or a single-region
  Spanner *configuration*, never a multi-region one) per residency
  boundary, explicitly not pooled.

### 2. AlloyDB for PostgreSQL instead of Cloud SQL for the per-region store

- **The case for it:** AlloyDB is PostgreSQL-compatible and
  purpose-built for demanding transactional workloads with a mixed
  analytical read pattern (columnar engine for real-time analytics
  alongside OLTP) — a clinical records system that also needs
  near-real-time reporting (e.g. a care-coordination dashboard querying
  live patient data) is a plausible fit, and it's a current, in-scope
  service per RUNBOOK §6/§7.
  worth naming explicitly rather than defaulting to Cloud SQL by habit.
- **Why Cloud SQL is still the safer default answer:** the case study's
  signature lesson is regional isolation, not database engine choice —
  when a question doesn't describe a mixed OLTP/analytical read pattern
  specifically, Cloud SQL's simpler operational model and lower cost
  win on the case study's stated cost-discipline constraint (#4).
- **When AlloyDB becomes the correct answer instead:** if a specific
  question describes EHR Healthcare needing fast analytical queries
  *against live operational data* (not the separate BigQuery audit
  path) — e.g. a real-time bed-availability or care-coordination
  dashboard — AlloyDB's hybrid transactional/analytical performance is
  the differentiator Cloud SQL doesn't have. Don't default to it
  without that signal, but don't reflexively rule it out either.

### 3. Big-bang cutover instead of incremental/phased migration

- **The tempting case for it:** faster time-to-cloud-only-costs, no
  need to run and reconcile dual on-prem+cloud environments, simpler
  to reason about from a pure-engineering view.
- **Why it's rejected here:** a clinical SaaS platform's downtime has
  direct patient-care consequences, and a single irreversible cutover
  concentrates all migration risk into one event with no rollback path
  once on-prem capacity is decommissioned. The case study's stated
  priority order (compliance → availability → migration risk → cost)
  puts migration risk ahead of speed/cost.
- **What's used instead:** a phased, hybrid-coexistence migration
  (Tree 4) — likely Replatform for the core EHR application (swap
  self-managed DB for Cloud SQL, containerize incrementally) with
  Rehost for lower-risk peripheral systems first, keeping on-prem as a
  fallback until each cloud region proves itself under real load.

## Cost and tradeoff discussion

EHR Healthcare's stated priority order — compliance/residency,
availability, migration risk, then cost — means every cost-saving
lever has to be evaluated against whether it silently erodes one of
the first three:

| Lever | Saves | Risk if misapplied here |
|---|---|---|
| Committed Use Discounts on steady-state GKE/Cloud SQL capacity | Meaningful — clinical load is relatively predictable day-to-day (unlike Mountkirk's launch spikes or HRL's event bursts) | Low risk — CUDs don't touch residency or availability, a legitimate cost win specific to this case study's steady load shape |
| Consolidating per-region databases into one pooled instance | Fewer instances to patch/monitor, lower total compute | **High risk** — this is the Spanner trap in cost-optimization clothing; consolidation is only safe *within* a single residency boundary, never across one |
| Coldline/Archive tiering for audit logs and old records | Large storage-cost reduction on rarely-accessed historical PHI | Low risk if retrieval-time SLAs for audit/legal requests are still met — check the scenario's stated compliance retrieval-time requirement before assuming Archive-tier retrieval speed is acceptable |
| Reducing DR tier from Active-Passive to Warm Standby | Lower standing infrastructure cost | **Depends entirely on the stated RTO/RPO for that specific question** — clinical-facing systems are often (not always) held to tighter numbers; don't downgrade the DR tier without the number, per Tree 5's exam trap |
| Skipping Assured Workloads / Binary Authorization to reduce setup effort | Faster initial build | **High risk** — for a HIPAA-bound company these controls are close to a "cost of doing business," and removing them to save engineering time is a compliance-lens trap, not a real savings |

The overall lesson the case study repeatedly tests: cost optimization
here means finding the levers that don't touch compliance, residency,
or the stated availability number — not finding the cheapest
architecture in the abstract.

## Question patterns this case study tends to produce

| Question shape | Domain | What it's really testing |
|---|---|---|
| "How should EHR Healthcare structure its GCP resource hierarchy across countries?" | 1 §1.3 | folders per compliance boundary, Org Policy `resourceLocations` per folder |
| "What's the best migration approach for their on-prem EHR system?" | 1 §1.4 | likely Replatform or phased Refactor, not Rehost, given long system lifespan and compliance need for improvement over time; sequencing matters |
| "A newly acquired clinic's legacy scheduling app can't be containerized easily — what now?" | 1 §1.4/§1.5 | recognizing not every workload gets the same modernization treatment — Retain or Rehost that one system rather than forcing a uniform strategy |
| "How do they prevent a support engineer from accidentally viewing patient data across regions?" | 3 §3.1 | VPC Service Controls + IAM scoped per region/project, not just IAM alone |
| "How do they satisfy HIPAA audit requirements?" | 3 §3.2 | Cloud Audit Logs (Data Access logs specifically enabled), Access Transparency |
| "A new AI-assisted diagnosis-support feature is proposed — what security review applies?" | 3 §3.1 | Securing AI pattern — private Vertex AI endpoint, DLP on any PHI reaching the prompt, VPC-SC perimeter extended to the AI workload, not treated as a bolt-on |
| "How should they roll out a new release without a multi-region outage?" | 4 §4.1 / 6 §6.2 | sequenced, canaried per-region deployment via Cloud Deploy, never all regions simultaneously |
| "Leadership wants to reduce cloud spend without changing SLAs — what do they cut?" | 4 §4.3 | CUDs and storage-class tiering (safe levers), not DR-tier downgrades or perimeter/consent controls (unsafe levers) — see cost table above |
| "How should they handle a regional outage for a clinical system?" | 6 Tree 5 | likely Active-Passive or Warm Standby *within* the same compliance boundary (can't fail over to a different country's region if that would move PHI across a residency line) |
| "How do they give a third-party AI vendor limited access to de-identified data for a research partnership?" | 3 §3.1 | Securing AI / third-party AI partner access pattern — DLP de-identification before export, scoped IAM/VPC-SC, not blanket data-lake access |
| "The on-call team wants regional incidents visible without cross-region PHI exposure — how should logging/alerting be structured?" | 6 §6.1 | per-region log sinks and alerting policies (M.A.P.S. mnemonic), not one global dataset/dashboard |
| "A hospital customer requires proof their data never left the contracted region — what evidence does GCP provide?" | 3 §3.2 | Access Transparency + Cloud Audit Logs + Assured Workloads compliance mapping, and Org Policy `resourceLocations` as the preventive (not just detective) control |
| "How should EHR Healthcare connect newly acquired clinics' on-prem systems during the transition period?" | 1 §1.3 / Tree 3 | match connectivity tier to each site's timeline/bandwidth — Partner Interconnect or VPN for smaller/faster-needed sites, Dedicated Interconnect for high-volume core data centers |
| "Should EHR Healthcare use GKE Enterprise or manage each region's GKE cluster independently?" | 2 §2.1 / 1 §1.3 | GKE Enterprise's fleet management, centrally-defined config/policy sync, and consistent hybrid connectivity view are a natural fit for a company running the *same* isolated-per-region pattern repeatedly across many jurisdictions and a lingering on-prem footprint — reduces per-region operational drift without violating data isolation (fleet management is control-plane/config, not data pooling) |
| "A question describes needing both fast operational queries and live analytics on the same patient data — what database?" | 1 §1.3 | AlloyDB for PostgreSQL — the specific signal (mixed OLTP + real-time analytical read pattern) that distinguishes it from the default Cloud SQL answer; see Alternatives §2 above |

## Exam traps specific to this case study

1. **The DR-region trap.** A naive answer fails over EHR Healthcare's
   EU customer data to a US region "because it's available and
   cheaper" — this violates the residency constraint that overrides
   every other design consideration for this case study. DR/failover
   targets must stay *within* the same compliance boundary as the
   primary region, even if that means a same-jurisdiction secondary
   region rather than the geographically nearest one.
2. **The "one modernization strategy for everything" trap.** Because
   the primary narrative is "migrate to the cloud," candidates default
   to Refactor or Replatform for *every* system EHR Healthcare owns.
   The case study's realistic acquisition-grown estate almost certainly
   includes at least one system better served by Retain or Rehost —
   picking a single strategy and applying it uniformly ignores Tree 4's
   actual decision logic (business value, lifespan, and re-architecture
   bandwidth vary per workload, not per company).
