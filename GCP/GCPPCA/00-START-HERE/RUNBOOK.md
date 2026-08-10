# RUNBOOK — GCP Professional Cloud Architect (PCA) bulk-generation source of truth

> Produced by CLAUDE.md §12 Step 0/0b. Every later generation step in this
> folder reads **this file**, not the vendor guide again and not
> assumptions carried from `AWS/AWSDEA/`.

---

## 1. Source and access note (read this first)

- **Primary vendor source:** `https://cloud.google.com/learn/certification/guides/professional-cloud-architect`,
  which 301-redirects to the actual PDF:
  `https://services.google.com/fh/files/misc/professional_cloud_architect_exam_guide_english.pdf`
  (a versioned copy was also found at
  `https://services.google.com/fh/files/misc/v6.1_pca_professional_cloud_architect_exam_guide_english.pdf`,
  confirming the current revision is **v6.1, dated October 2025**).
- **Fetch date attempted:** 2026-08-10.
- **Access constraint:** this session's outbound network egress goes through
  a policy-enforcing proxy. `services.google.com` (the domain that hosts the
  actual guide PDF) is blocked by that policy, as is `docs.google.com`,
  `translate.goog`, `web.archive.org`, and essentially every third-party
  mirror or study-blog domain tried (scribd, tutorialsdojo, whizlabs,
  examgecko, certfun, oneuptime, sailor.sh, hkdocs, jonshaffer.dev, and
  more — all returned `EGRESS_BLOCKED`). Only `cloud.google.com` itself and
  `github.com`/`raw.githubusercontent.com` were reachable. Per this
  environment's own instructions, a 403/407 policy denial is to be reported,
  not routed around — so the guide PDF's literal numbered task bullets
  (e.g. the exact wording of "1.1", "1.2", …) could **not** be fetched
  verbatim in this session.
- **What follows is a best-effort reconstruction**, built from two
  corroborating sources instead of the PDF itself:
  1. **`cloud.google.com/learn/certification/cloud-architect`** (fetched
     directly, primary/official, quoted verbatim below) — gives the exact
     six top-level competency statements, exam format, cost, languages,
     case-study count, and renewal terms.
  2. **`github.com/nilanjanbs/gcp-pca-2026-study-guide`** (third-party,
     public, fetched directly) — a study repo whose own README states it
     is "aligned with the official v6.1 exam guide (October 2025)" and
     gives a section weight table (24/15/20/18/11/12, summing to 100%)
     and detailed per-domain topic breakdowns that match the six official
     competency statements 1:1 in name and order.
- **Confidence:** HIGH on domain count (6), domain names/order, exam
  format, cost, and case-study identity. MEDIUM on exact domain weights
  (not independently confirmed from a second source, but internally
  consistent — sums to 100% and matches the historical relative ordering
  of "Designing & Planning" as the largest single domain). **LOW /
  explicitly reconstructed, not verbatim** on task-level sub-bullet
  wording (the "1.1 / 1.2 / …" numbering below is this session's
  reconstruction from the stable, long-published v5-era PCA guide
  structure cross-checked against the 2026 topic lists, not a literal
  quote of the current PDF). Anyone reconciling this folder against the
  actual PDF later should treat task-level wording as the first thing to
  verify, not the domain names or weights.

## 2. Exam facts (confirmed from `cloud.google.com`, primary source)

| Fact | Value |
|---|---|
| Certification | Google Cloud Certified — Professional Cloud Architect |
| Code used in this repo | PCA |
| Questions | 50–60 |
| Format | Multiple choice and multiple select |
| Duration | 2 hours |
| Case studies | 2 shown per exam, drawn from a pool of 4; case-study questions are 20–30% of the exam; viewable on a split screen during the exam |
| Cost | $200 USD + applicable tax |
| Languages | English, Japanese |
| Prerequisites | None formally required |
| Recommended experience | 3+ years industry experience, including 1+ years designing and managing solutions on Google Cloud |
| Validity | 2 years |
| Delivery | Online-proctored (remote) or onsite-proctored (Pearson VUE test center) |
| Renewal (exam route) | 1 hour, $100 + tax, 25 questions, 1 case study focused on generative-AI solutions (90–100% of exam) |
| Renewal (skills route) | Designated Google Skills courses/skill-badges, 1-year validity, must complete within the last year of the active cert |
| Core framework requirement | Google Cloud Well-Architected Framework: operational excellence, security, reliability, performance optimization, cost optimization, sustainability |

### Verbatim "skills measured" (quoted exactly from `cloud.google.com/learn/certification/cloud-architect`)

> "The Professional Cloud Architect certification exam assesses your
> ability to:
> - Design and plan a cloud solution architecture
> - Manage and provision the cloud solution infrastructure
> - Design for security and compliance
> - Analyze and optimize technical and business processes
> - Manage implementations of cloud architecture
> - Ensure solution and operations excellence"

These six bullets are the six top-level domains/sections of the exam
guide, in order. **6 domains — not 4 like AWS DEA-C01.**

### Case studies (4 available, 2 shown per exam)

Corroborated across the primary source ("4 available") and multiple
independent secondary sources naming the same four companies:

1. **EHR Healthcare** — SaaS provider of hospital/clinic software;
   multi-national; must satisfy HIPAA and similar healthcare-compliance
   regimes; hybrid on-prem/cloud footprint being migrated.
2. **Helicopter Racing League (HRL)** — streams live drone/helicopter
   racing globally; needs low-latency global video ingest/distribution,
   real-time analytics, and (2026 update) AI-assisted commentary/highlight
   generation.
3. **Mountkirk Games** — multiplayer online gaming company launching a
   new global title; needs elastic compute for unpredictable spiky load,
   low-latency multi-region deployment, and a real-time leaderboard/analytics
   pipeline.
4. **TerramEarth** — manufactures heavy farm/construction equipment;
   ~2 million connected IoT devices in the field with intermittent
   connectivity; needs telemetry ingestion at scale, predictive
   maintenance analytics, and a slow but real hybrid-cloud dealer network.

**Currency note:** older prep material (2021-era and earlier dumps sites)
references a fifth, now-retired case study, **Dress4Win** (a social
fashion app doing a lift-and-shift from on-prem MySQL). Dress4Win is
**not** one of the 4 current case studies per the primary source fetched
today — do not teach it as current. See §7.

---

## 3. Full hierarchy (6 domains, reconstructed task structure)

Weight source: `nilanjanbs/gcp-pca-2026-study-guide` README, self-described
as aligned to the official v6.1 (Oct 2025) guide; sums to 100%; ordering
and names independently confirmed against the primary source's six
verbatim bullets above.

| # | Domain (official name, from primary source) | Weight |
|---|---|---|
| 1 | Designing and planning a cloud solution architecture | ~24% |
| 2 | Managing and provisioning a solution infrastructure | ~15% |
| 3 | Designing for security and compliance | ~20% |
| 4 | Analyzing and optimizing technical and business processes | ~18% |
| 5 | Managing implementation | ~11% |
| 6 | Ensuring solution and operations reliability | ~12% |

Task-level breakdown below (marked **[reconstructed]**) mirrors the
historically stable PCA task structure (unchanged in shape across guide
revisions for years — only in-scope services/emphasis have shifted),
overlaid with the specific 2026-era topic additions confirmed by the
secondary source (Securing AI / Vertex AI workload patterns as new
material within existing tasks, not new top-level tasks).

### Domain 1 — Designing and planning a cloud solution architecture (~24%)

- **1.1 Designing a solution infrastructure that meets business
  requirements** — stakeholder requirements translation, cost/timeline
  constraints, licensing (BYOL), success measures/KPIs, business
  continuity, application acceptance criteria, procurement.
- **1.2 Designing a solution infrastructure that meets technical
  requirements** — availability, scalability, reliability, resiliency,
  performance, security/compliance requirements mapped to SLA/SLO
  targets.
- **1.3 Designing network, storage, and compute resources** — identifying
  regions/zones strategy; selecting appropriate compute (Compute Engine,
  GKE, Cloud Run, App Engine, Cloud Functions, Vertex AI); storage/DB
  selection (Cloud Storage, Cloud SQL, Spanner, Bigtable, Firestore,
  BigQuery, Memorystore); network topology (VPC design, Shared VPC,
  VPC Peering, hybrid connectivity via Interconnect/VPN, Private Google
  Access, load balancing tiers).
- **1.4 Creating a migration plan** — application/data migration
  approaches (the "6 R's": rehost, replatform, repurchase, refactor,
  retain, retire), sequencing, data-transfer services (Storage Transfer
  Service, Transfer Appliance, BigQuery Data Transfer), minimizing
  downtime.
- **1.5 Envisioning future solution improvements** — evaluating
  technology and design changes over time (new managed services, cost
  trends, evolving compliance requirements), including 2026-era
  Vertex AI/generative-AI integration into existing architectures.

### Domain 2 — Managing and provisioning a solution infrastructure (~15%)

- **2.1 Configuring network topologies** — VPCs, subnets, firewall
  rules/hierarchical firewall policies, Cloud NAT, Cloud DNS, Cloud
  Load Balancing tiers, Private Service Connect, Network Connectivity
  Center for hub-and-spoke.
- **2.2 Configuring individual storage systems** — provisioning Cloud
  Storage (classes, lifecycle rules), Cloud SQL/Spanner (HA
  configuration, read replicas), Bigtable (node sizing, replication),
  Filestore.
- **2.3 Configuring compute systems** — provisioning Compute Engine
  (MIGs, custom machine types), GKE (Autopilot vs Standard, node pools),
  Cloud Run/Cloud Functions (concurrency, revisions), infrastructure as
  code with Terraform/Deployment Manager/Config Connector, CI/CD
  pipelines (Cloud Build, Cloud Deploy) for infra provisioning.

### Domain 3 — Designing for security and compliance (~20%)

- **3.1 Designing for security** — IAM (roles, groups, service
  accounts, Workload Identity Federation), resource hierarchy
  (organization/folder/project) for policy inheritance, data security
  (CMEK/CSEK, Cloud KMS, Secret Manager, DLP), separation of duties,
  security controls (VPC Service Controls, Org Policy constraints,
  firewall/Cloud Armor), securing AI/ML workloads (Vertex AI private
  endpoints, prompt/output governance — 2026 addition).
- **3.2 Designing for legal compliance** — regulatory requirements
  (HIPAA, PCI-DSS, GDPR, data residency/sovereignty), audit logging
  (Cloud Audit Logs, Access Transparency), Assured Workloads,
  data-retention policy design.

### Domain 4 — Analyzing and optimizing technical and business processes (~18%)

- **4.1 Analyzing and defining technical processes** — SDLC
  practices, CI/CD pipeline design, testing/QA processes, business
  continuity/disaster-recovery planning (RTO/RPO), monitoring and
  alerting strategy design.
- **4.2 Analyzing and defining business processes** — change/incident
  management, team dynamics (Conway's Law implications on architecture),
  cost management/showback/chargeback, procurement processes,
  sustainability/carbon-footprint optimization (Carbon Footprint tool,
  region selection for lower carbon).
- **4.3 Development and operations** — release management (canary,
  blue/green, rolling updates), DevOps/SRE practices (error budgets,
  toil reduction), cost optimization (rightsizing, committed use
  discounts, Recommender API), performance tuning, Vertex AI/Dataflow
  workload cost-performance optimization (2026 addition).

### Domain 5 — Managing implementation (~11%)

- **5.1 Advising development/operations team(s) to ensure successful
  deployment of the solution** — guiding application development best
  practices on GCP (12-factor-style patterns), API management (Cloud
  Endpoints, API Gateway), testing and validation strategy,
  containerization guidance.
- **5.2 Interacting with Google Cloud programmatically** — choosing
  between Console, `gcloud`/`gsutil`/`bq` CLI, Cloud Shell, client
  libraries, and REST/RPC APIs for a given automation scenario;
  declarative resource management (Config Connector, Terraform);
  scripting for repeatable provisioning at scale.

### Domain 6 — Ensuring solution and operations reliability (~12%)

- **6.1 Monitoring/logging/profiling/alerting a solution** — Cloud
  Monitoring (uptime checks, custom metrics, SLO monitoring, alerting
  policies), Cloud Logging (log routers/sinks, log-based metrics),
  Cloud Trace/Profiler for performance diagnosis, error-budget-driven
  operations.
- **6.2 Deployment and release management** — reliable rollout patterns
  (MIG update policies, GKE surge upgrades, Cloud Run traffic
  splitting), on-host maintenance/live migration behavior, backup and
  DR strategy execution (Backup and DR service, Cloud SQL/Spanner HA
  and failover, cross-region backup), capacity planning/autoscaling
  configuration, hotspot/data-skew avoidance (Bigtable row-key design,
  Cloud Storage request distribution).

---

## 4. Coverage map

Tracks, per leaf, which repo file(s) are responsible, and whether that
leaf has **Design** (production architecture diagram), a **Decision
matrix** (head-to-head comparison table), and stated **Tradeoffs**
(paired "use X / don't use X, use Y instead"). ✅ = present, 🕐 = planned
for this bulk pass, — = not the right content type for this leaf.

| Leaf | File(s) | Design | Decision matrix | Tradeoffs |
|---|---|---|---|---|
| 1.1 Business requirements | `01-domains/DOMAIN-1-designing-planning.md` §1.1 | — | ✅ (requirement-translation table) | ✅ |
| 1.2 Technical requirements | `01-domains/DOMAIN-1...md` §1.2 | ✅ (shared domain pattern) | ✅ (SLA/SLO mapping table) | ✅ |
| 1.3 Network/storage/compute design | `01-domains/DOMAIN-1...md` §1.3, `02-services/*`, `03-comparisons/01-compute-options.md`, `03-comparisons/02-storage-database-options.md`, `03-comparisons/03-networking-connectivity.md` | ✅ (topology diagrams) | ✅ | ✅ |
| 1.4 Migration plan | `01-domains/DOMAIN-1...md` §1.4, `03-comparisons/04-migration-strategies.md` | — | ✅ (6 R's matrix) | ✅ |
| 1.5 Future improvements | `01-domains/DOMAIN-1...md` §1.5 | — | — (judgment-based, no matrix by design) | ✅ |
| 2.1 Network topologies | `01-domains/DOMAIN-2-managing-provisioning.md` §2.1, `03-comparisons/03-networking-connectivity.md`, `05-labs/lab-02-vpc-shared-network-design.md` | ✅ (landing zone diagram, Lab 2) | ✅ | ✅ |
| 2.2 Storage systems provisioning | `01-domains/DOMAIN-2...md` §2.2, `02-services/02-storage-databases.md` | — | ✅ | ✅ |
| 2.3 Compute systems provisioning | `01-domains/DOMAIN-2...md` §2.3, `02-services/01-compute.md`, `05-labs/lab-03-gke-terraform-deployment.md`, `05-labs/lab-04-cicd-cloud-build-deploy.md` | ✅ (Labs 3-4) | ✅ | ✅ |
| 3.1 Security design (IAM, data security) | `01-domains/DOMAIN-3-security-compliance.md` §3.1, `02-services/04-security-iam.md`, `03-comparisons/06-iam-security-models.md`, `05-labs/lab-01-org-iam-policy-foundation.md` | ✅ (zero-trust perimeter diagram, Lab 1) | ✅ | ✅ |
| 3.2 Legal compliance | `01-domains/DOMAIN-3...md` §3.2 | ✅ (EHR Healthcare case study) | ✅ (compliance mapping table) | ✅ |
| 4.1 Technical process analysis | `01-domains/DOMAIN-4-analyzing-optimizing.md` §4.1 | — | — (process/policy, not a service matrix by design) | ✅ |
| 4.2 Business process analysis | `01-domains/DOMAIN-4...md` §4.2 | — | ✅ (cost-mechanism table) | ✅ |
| 4.3 Dev & ops (cost/perf optimization) | `01-domains/DOMAIN-4...md` §4.3 | ✅ (cost/perf feedback loop diagram) | ✅ (cost-optimization table) | ✅ |
| 5.1 Advising dev/ops teams | `01-domains/DOMAIN-5-managing-implementation.md` §5.1 | — | ✅ (API management table) | ✅ |
| 5.2 Programmatic interaction | `01-domains/DOMAIN-5...md` §5.2, `05-labs/lab-04-cicd-cloud-build-deploy.md`, `09-assets/service-decision-flowcharts.md` | ✅ (governed self-service platform diagram) | ✅ (Tree 6, Console vs CLI vs API vs IaC) | ✅ |
| 6.1 Monitoring/logging/alerting | `01-domains/DOMAIN-6-ensuring-reliability.md` §6.1, `02-services/06-management-operations.md` | ✅ (multi-region HA/DR w/ observability diagram) | ✅ (sink-selection table) | ✅ |
| 6.2 Deployment & release management, DR | `01-domains/DOMAIN-6...md` §6.2, `03-comparisons/05-ha-dr-strategies.md`, `05-labs/lab-05-dr-failover-cloud-sql.md` | ✅ | ✅ | ✅ |
| Case study: EHR Healthcare | `04-architectures/case-study-ehr-healthcare.md`, `06-practice/mock-exam-1.md` | ✅ | — (constraint-ranking table in place of a comparison matrix, by design for a narrative case study) | ✅ |
| Case study: Helicopter Racing League | `04-architectures/case-study-helicopter-racing-league.md`, `06-practice/mock-exam-2.md` | ✅ | — | ✅ |
| Case study: Mountkirk Games | `04-architectures/case-study-mountkirk-games.md`, `06-practice/mock-exam-1.md` | ✅ | — | ✅ |
| Case study: TerramEarth | `04-architectures/case-study-terramearth.md`, `06-practice/mock-exam-2.md` | ✅ | — | ✅ |

Status: **complete** as of the 2026-08-10 bulk-generation pass. Every
leaf has content; the only "—" cells are leaves where that content type
genuinely doesn't fit (judgment-based subsections, narrative case
studies) rather than gaps.

---

## 5. Generation checklist (mirrors the 00–09 folder layout)

- [x] `00-START-HERE/` — RUNBOOK.md (this file), STUDY-PLAN.md,
      SERVICE-MATRIX.md, DECISION-TREES.md, EXAM-TRAPS-AND-MNEMONICS.md
- [x] `01-domains/` — 6 files, one per domain above
- [x] `02-services/` — service reference grouped by category (7 files)
- [x] `03-comparisons/` — head-to-head comparison matrices (6 files)
- [x] `04-architectures/` — 4 case-study architectures + 2 generic patterns
- [x] `05-labs/` — 5 hands-on walkthroughs
- [x] `06-practice/` — 6 per-domain question banks + 2 mock exams
- [x] `07-revision/` — 6 per-domain cheat sheets + master flashcards
- [x] `08-interview/` — 2 interview-style question files
- [x] `09-assets/` — 3 ASCII diagram/mind-map/flowchart files
- [x] `CLAUDE.md` §2/3/6/7/8 filled, mirrored to `GEMINI.md`/`AGENTS.md`
- [x] `README.md` exam-facts section filled
- [x] Final sweep: no placeholder markers, no stale terminology, §5
      line-count summary updated in `CLAUDE.md` and this file

## 6. In-scope / out-of-scope service signal (from secondary-source topic
   lists, cross-checked against primary source's Well-Architected Framework
   emphasis)

**Clearly in scope (2026 emphasis):**
Compute Engine, GKE (Autopilot + Standard), Cloud Run, Cloud Functions,
App Engine (Standard — see §7 for Flexible), Vertex AI (incl. Model
Garden, Feature Store, Model Monitoring), Cloud Storage, Cloud SQL,
Cloud Spanner, Bigtable, Firestore, BigQuery, Memorystore, VPC (incl.
Shared VPC, VPC Peering, VPC Service Controls, Private Service Connect),
Cloud Load Balancing (all tiers), Cloud Interconnect/VPN, Network
Connectivity Center, Cloud DNS, Cloud NAT, Cloud Armor, IAM (incl.
Workload Identity Federation), Resource Manager hierarchy, Cloud KMS,
Secret Manager, Cloud DLP, Org Policy, Cloud Audit Logs, Assured
Workloads, Cloud Monitoring/Logging/Trace/Profiler, Cloud Build, Cloud
Deploy, Artifact Registry, Terraform (as the expected IaC tool), Config
Connector, Cloud Composer, Dataflow, Dataproc, Pub/Sub, Data Fusion,
Backup and DR service, Storage Transfer Service, Transfer Appliance,
Carbon Footprint tool, Recommender API.

**Explicitly de-emphasized / stale for 2026 (per secondary-source
"de-emphasized topics" notes, consistent across domain files):**
App Engine Flexible environment, deep CLI/`kubectl` command
memorization, granular SKU-level pricing memorization, legacy
classic-VPC-only networking patterns, and Kubernetes cluster
troubleshooting minutiae. Treat these as low-yield, not zero-yield.

## 7. Currency-corrections table

| Do not say | Say instead | Why |
|---|---|---|
| "The PCA exam has 4 case studies including Dress4Win" | "The PCA exam draws 2 of 4 case studies per sitting from: EHR Healthcare, Helicopter Racing League, Mountkirk Games, TerramEarth" | Dress4Win was a case study in older (pre-2021) guide revisions and still appears in stale dumps/prep sites; it is not among the 4 current case studies per the primary source fetched 2026-08-10. |
| "Security domain is just IAM and encryption" | "Security domain (3, ~20%) now explicitly includes Securing AI workload patterns — private Vertex AI endpoints, prompt/output governance, third-party AI partner access" | 2026 guide revision (v6.1) added AI-security as a named focus area within Domain 3, per secondary source's "NEW 2026 Focus" flags, consistent across independently-authored domain summaries. |
| "Cost/optimization domain is only about billing" | "Domain 4 (~18%) also covers Vertex AI/Dataflow workload cost-performance tuning and sustainability (Carbon Footprint tool, region selection)" | Same 2026 revision pattern — AI workload optimization and sustainability both called out as newly weighted material. |
| "App Engine Flexible is a mainstream exam answer" | "App Engine Standard is the actively-tested App Engine variant; Flexible is de-emphasized" | Consistent de-emphasis flag across multiple secondary sources for the 2025/2026 guide cycle. |
| "The exam guide hasn't changed in years" | "Current revision is v6.1 (October 2025); always re-check `cloud.google.com/learn/certification/guides/professional-cloud-architect` before teaching from an older cached guide" | A versioned filename (`v6.1_pca_...pdf`) confirms Google does revise and re-publish this guide; do not assume a locally cached copy of the guide is current. |
| "Google Cloud VMware Engine / Anthos are unlikely exam topics" | "Hybrid/multi-cloud patterns (Anthos, GKE on-prem/Bare Metal, Network Connectivity Center) remain in scope for Domain 1.3/2.1 hybrid-connectivity tasks" | Hybrid connectivity has been a stable, recurring PCA theme (TerramEarth and EHR Healthcare case studies both assume hybrid footprints) and nothing in current sourcing suggests it was dropped. |

## 8. §5 checklist status

Updated after each generation batch. See also `CLAUDE.md` §5 for the
per-folder line-count summary (kept in sync with this section).

_Status as of runbook creation (2026-08-10): only this RUNBOOK.md exists.
Nothing else generated yet._

**Update (2026-08-10, end of bulk-generation pass):** all 10 folders
complete — 55 content files, ~10,190 lines, per the checklist in §5
above (all boxes checked) and the per-folder breakdown in `CLAUDE.md`
§5. Self-verification performed: no `🕐` placeholder markers remain
outside this file's own legend and the generic just-in-time rule in
`CLAUDE.md` §4; no stale terminology found (Container Registry appears
only as "successor to" context, Dress4Win appears only inside
currency-correction rows, Deployment Manager appears only flagged as
legacy or as a deliberately-wrong quiz distractor); every practice
question's answer and full option-by-option rationale is inline
immediately after its question (not a separate answer key, so
numbering drift between question and answer is structurally not
possible); no file remains at placeholder size except the per-folder
`README.md` stubs, which are intentionally short folder-index pages,
not content placeholders. One background agent limitation from this
session: no `Agent`/`Task` tool was available to this working session,
so Step 1's "parallel background agents" batching was not literally
possible — all 55 files were instead written directly and sequentially
by this session, in the same folder-grouped batches the playbook
specifies, with a commit checkpoint after each folder.
