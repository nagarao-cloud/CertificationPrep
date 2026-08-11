# Domain 2 — Managing and Provisioning a Solution Infrastructure (~15%)

> Source: `00-START-HERE/RUNBOOK.md` §3 (task wording reconstructed —
> see RUNBOOK §1). This domain is about the *how* of standing up what
> Domain 1 designed: IaC, CI/CD, and the provisioning-time configuration
> of network/storage/compute. Focus areas per RUNBOOK §3: Terraform
> patterns, GKE provisioning, CI/CD integration, observability-as-code.

## Contents

1. [2.1 Configuring network topologies](#21-configuring-network-topologies)
2. [2.2 Configuring individual storage systems](#22-configuring-individual-storage-systems)
3. [2.3 Configuring compute systems](#23-configuring-compute-systems)
4. [Terraform patterns deep dive](#terraform-patterns-deep-dive)
5. [Observability-as-code](#observability-as-code)
6. [Production architecture pattern: Terraform-provisioned landing zone](#production-architecture-pattern-terraform-provisioned-landing-zone)
7. [Domain 2-specific exam traps](#domain-2-specific-exam-traps)

---

## 2.1 Configuring network topologies

Design-time topology selection lives in Domain 1 §1.3; this section is
about **provisioning-time configuration correctness** — the settings
that make a chosen topology actually work and stay secure.

### Core provisioning building blocks

| Component | Provisioning decision | Exam-relevant detail |
|---|---|---|
| VPC + subnets | Auto-mode vs. custom-mode | **Always custom-mode in production** — auto-mode's fixed /20 ranges per region are a beginner trap, not a real-world or exam-correct default |
| Firewall rules | Hierarchical firewall policies (org/folder level) vs. per-VPC rules | Hierarchical policies enforce org-wide guardrails (e.g. "deny 0.0.0.0/0 ingress everywhere") that individual project admins can't override |
| Cloud NAT | Attach to a Cloud Router, per-region | Outbound-only; no inbound; no NAT gateway instance to size, patch, or fail over — this is the exam's expected answer whenever private instances need outbound internet |
| Cloud DNS | Public vs. private zones; DNS forwarding for hybrid | Private zones resolve internal names within a VPC (and peered VPCs via DNS peering) — a hybrid scenario needing on-prem name resolution needs DNS forwarding/peering configured explicitly |
| Load balancing | Match LB tier to traffic scope (global HTTP(S), regional, internal) | Provisioning a Global LB for an internal-only service is both wasteful and often the *wrong* trust boundary |
| Private Service Connect | Publish/consume private endpoints across VPCs/projects without peering | The provisioning-time answer when a scenario needs private access to a service in another VPC/project *without* full peering (avoids exposing the whole network) |
| Private Google Access | Enable on a subnet so instances without external IPs can reach Google APIs | Provisioning checkbox easy to forget — without it, a private-only instance can't reach Cloud Storage/BigQuery/etc. at all |

### IP address management (IPAM) at provisioning time

- **Plan CIDR ranges before creating subnets** — custom-mode VPCs let
  you size subnets deliberately (e.g. `/20` for a large app tier,
  `/24` for a small management subnet) instead of inheriting auto-mode's
  one-size-fits-all ranges.
- **Reserve secondary IP ranges for GKE** — GKE VPC-native clusters
  need secondary ranges for Pod IPs and Service IPs, planned and sized
  *before* cluster creation (resizing later is disruptive); undersizing
  the Pod range is a common real-world and exam-relevant provisioning
  mistake that caps how many pods a node can ever run.
- **Non-overlapping ranges across peered/hybrid networks** — VPC
  Peering and on-prem hybrid connectivity both require non-overlapping
  CIDR ranges; a scenario describing an unplanned overlap (e.g. after a
  company acquisition merges two networks) signals a re-IP or NAT-based
  workaround is needed before peering/interconnect can be established.

### Provisioning workflow (Terraform-first, per §2.3/CLAUDE.md defaults)

```
 write .tf network module
        │
        ▼
 terraform plan   ──────► peer/CI review of the plan output
        │
        ▼
 terraform apply  ──────► state stored remotely (GCS backend + state locking)
        │
        ▼
 validate via Config Validator / Policy-as-code (e.g. OPA/Forseti-style
 checks) before it's considered "done" in a mature pipeline
```

### Tradeoffs — network topology provisioning

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "Multiple teams, need org-wide firewall guardrails no project admin can bypass" | Hierarchical firewall policies at folder/org level | Per-VPC firewall rules only | Hierarchical policies can't be overridden by a project-level admin — that's the whole point when the requirement is "no exceptions" |
| "Private GKE cluster needs outbound internet for package pulls" | Cloud NAT | Public IPs on nodes, or a self-managed NAT instance | Cloud NAT is fully managed and stays private; self-managed NAT instances are legacy toil the exam never wants as the answer |
| "Need to consume a partner's private service without full network peering" | Private Service Connect | VPC Peering | PSC exposes exactly one endpoint, not the whole network — smaller blast radius, the "correct" 2026-era answer |
| "Private-only instances suddenly can't reach Cloud Storage/BigQuery" | Check/enable Private Google Access on the subnet | Assign external IPs | Restoring external IPs reopens the exact exposure the private-only design was meant to avoid; PGA is the fix that preserves the design intent |
| "Company merger, two networks now need to connect but IP ranges overlap" | Re-IP the smaller network, or NAT between them | Attempt VPC Peering/Interconnect directly | Peering/hybrid connectivity requires non-overlapping ranges — this is a hard technical constraint, not a policy one |

---

## 2.2 Configuring individual storage systems

### Cloud Storage provisioning

- **Storage class at bucket or object level** — mapped to access
  frequency (Standard: frequent, Nearline: <1/month, Coldline:
  <1/quarter, Archive: <1/year). Lifecycle rules automate the
  transition (e.g. Standard → Nearline after 30 days → Coldline after
  90 → Archive after 365).
- **Location type**: region (lowest latency/cost, single point of
  failure at region level), dual-region (two specific regions, faster
  than multi-region, HA across those two), multi-region (broadest
  geographic redundancy, highest latency variance).
- **Uniform bucket-level access** should be the provisioning default
  over legacy ACLs — simplifies IAM to a single, auditable policy
  surface per bucket.
- **Retention policies and Bucket Lock** — provisioned when a
  compliance requirement demands immutable storage for a defined
  period; Bucket Lock makes the retention policy permanently
  unremovable, which is the point when the requirement is regulatory.
- **Versioning** — provisioned when accidental overwrite/deletion
  protection is required; interacts with lifecycle rules (a lifecycle
  rule can target noncurrent versions specifically to control storage
  growth from versioning).

### Cloud SQL / AlloyDB / Spanner / Bigtable provisioning

| Setting | Cloud SQL | AlloyDB | Cloud Spanner | Bigtable |
|---|---|---|---|---|
| HA configuration | Regional HA (standby in a second zone, synchronous replication) | Regional HA (primary + standby, synchronous), plus read pool instances for read scaling | Multi-region config = automatic global HA | Cluster replication across zones/regions, configured explicitly |
| Read scaling | Read replicas (async, eventually consistent) | Read pool instances (near-real-time, purpose-built for read-heavy scaling) | Automatic, strongly consistent read scaling built into the architecture | Add nodes to a cluster (throughput scaling, not really "read replica" semantics) |
| Sizing lever | vCPU/RAM per instance (vertical) | vCPU/RAM per instance (vertical), plus read pool node count | Compute capacity in "processing units" or nodes (horizontal, no resharding needed) | Node count per cluster (horizontal; row-key design matters more than node count for hot-spotting) |
| Provisioning trap | Forgetting to size for peak connections → hits `max_connections` under load | Same connection-ceiling trap as Cloud SQL — plan pooling at provisioning time, not after an incident | Over-provisioning a single-region app onto multi-region config (unnecessary cost/latency) | Under-provisioning nodes for the *write* pattern, not just data volume — Bigtable performance is throughput-bound, not size-bound |
| Engine compatibility | MySQL, PostgreSQL, SQL Server | PostgreSQL-compatible only | Cloud Spanner SQL dialect (or PostgreSQL interface mode) | Wide-column, HBase-compatible API |

**AlloyDB provisioning specifics**: provision the primary instance for
write/transactional load and add **read pool instances** separately
sized for read-heavy query load (including the analytical/columnar
acceleration AlloyDB applies automatically to eligible queries) —
treating AlloyDB's read pool the same way you'd provision Cloud SQL
read replicas under-utilizes the feature; the read pool is designed for
near-real-time freshness, not the async-lag tradeoff Cloud SQL replicas
carry.

### Bigtable provisioning depth

- **Cluster and node planning**: nodes determine both storage capacity
  ceiling and throughput ceiling — provisioning for storage alone
  without checking the write/read throughput the node count supports is
  a common under-provisioning mistake.
- **Replication for HA and read isolation**: a second cluster in
  another zone/region gives both failover capability and the ability to
  route a specific workload (e.g. a batch analytics job) to a replica
  so it doesn't compete with production read/write traffic on the
  primary cluster.
- **Row-key design is a provisioning-time decision, not an
  afterthought** — see Domain 6 §6.2 for the hotspotting failure mode;
  the fix is designed in at table-creation time (salting/hashing/
  reversing monotonic keys), not retrofitted after production load
  reveals a hot node.

### Filestore provisioning

- Tiers (Basic HDD/SSD, Enterprise/High Scale) map to throughput and
  capacity needs — provision Enterprise tier when the scenario states
  high-availability requirements across zones, since Basic tiers are
  zonal only.
- Correct answer whenever a scenario needs a **shared POSIX
  filesystem** mounted across multiple Compute Engine/GKE workloads
  (e.g. a legacy app expecting NFS) — not a substitute for Cloud
  Storage object semantics.

### Tradeoffs — storage provisioning

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "Compliance requires objects retained but rarely accessed after 1 year" | Lifecycle rule → Archive class at 365 days | Manually moving objects, or leaving everything in Standard | Automated lifecycle rules are the provisioning-time, ops-free answer; Standard-forever wastes budget the scenario didn't authorize |
| "App will scale from 10 to 10,000 DB connections" | Provision a connection pooler (Cloud SQL Auth Proxy/PgBouncer) alongside Cloud SQL/AlloyDB, or re-evaluate Spanner | Just increasing `max_connections` indefinitely | Cloud SQL/AlloyDB have hard machine-type-based connection ceilings; pooling is the standard mitigation before a DB-tier change |
| "Postgres workload needs faster analytics on live operational data without a separate warehouse" | AlloyDB read pool instances | Cloud SQL read replicas, or standing up a separate BigQuery ETL pipeline for this alone | AlloyDB's columnar engine accelerates analytical queries on operational data directly — matches the requirement with less new infrastructure |
| "Regulatory retention requirement, must be tamper-proof" | Bucket Lock on a retention policy | Versioning alone, or a documented-but-unenforced retention process | Bucket Lock makes the policy technically unremovable — the only provisioning-time answer that satisfies "tamper-proof," not just "documented" |
| "Legacy app expects a mounted network drive" | Filestore | Cloud Storage with a FUSE mount as a workaround | Filestore is the purpose-built managed NFS answer; Cloud Storage FUSE is a compatibility shim, not the provisioning-correct choice when true POSIX semantics are required |

---

## 2.3 Configuring compute systems

### Provisioning by compute tier

| Tier | What you provision | IaC-first pattern |
|---|---|---|
| Compute Engine | MIGs (instance template + autoscaler + health check), custom machine types | Terraform `google_compute_instance_template` + `google_compute_region_autoscaler` |
| GKE | Cluster (Standard: node pools/machine types; Autopilot: none of that), workloads via manifests/Helm | Terraform for the cluster shell, GitOps (Config Connector or Argo-style) for workloads |
| Cloud Run / Cloud Functions | Service/function config (concurrency, min/max instances, memory/CPU, revisions) | Terraform `google_cloud_run_v2_service`; traffic-split config for canary rollout |
| GKE Enterprise (fleet) | Fleet membership registration, fleet-level config sync/policy, service-mesh configuration | Terraform for fleet registration, Config Sync (GitOps) for the fleet-wide policy/config layer |

### GKE cluster provisioning decisions

| Decision | Standard | Autopilot |
|---|---|---|
| Node pool management | You define machine types, node count, autoscaler bounds per pool | Fully managed — no node pools to configure |
| GPU/specialized hardware | Full flexibility (any supported machine type/GPU) | Supported but more constrained (check current supported configurations before assuming full parity) |
| Billing granularity | Per-node (you pay for provisioned capacity whether pods use it or not) | Per-pod resource request (no idle-node waste) |
| Security defaults | You configure hardening (or rely on GKE defaults you may weaken) | Hardened by default (e.g. no privileged containers, Workload Identity on by default) — fewer provisioning decisions to get wrong |
| Correct provisioning answer when… | Scenario needs DaemonSets, privileged workloads, unusual node-level customization, cost optimization via bin-packing your own way | Scenario wants Kubernetes without node-level operational burden — the 2026-era default recommendation absent a Standard-specific requirement |

### GKE autoscaling provisioning options

| Mechanism | What it scales | Provisioning-time decision |
|---|---|---|
| Horizontal Pod Autoscaler (HPA) | Pod replica count for a workload | Provisioned per-Deployment via a target CPU/memory or custom metric threshold |
| Vertical Pod Autoscaler (VPA) | Per-pod CPU/memory requests/limits | Provisioned when workloads are hard to right-size manually; avoid running VPA and HPA on the same resource dimension simultaneously — they can fight each other |
| Cluster Autoscaler | Node count in a node pool | Provisioned with min/max node bounds per pool; scales nodes up when pending pods can't be scheduled, down when nodes are underutilized |
| Node auto-provisioning (NAP) | Creates *new node pools* automatically to match workload shape (e.g. a workload requesting a GPU gets a GPU node pool created on demand) | Correct answer for "heterogeneous, unpredictable workload shapes" scenarios where hand-provisioning every possible node pool in advance isn't practical |
| GKE Autopilot | All of the above, fully managed | No separate provisioning of any autoscaler — it's inherent to the tier (see §2.3 table above) |

### CI/CD integration for infrastructure

```
 Source repo (Terraform modules)
        │  push / PR
        ▼
 Cloud Build trigger  ──► terraform plan  ──► post plan as PR comment for review
        │
        │  merge to main
        ▼
 Cloud Build trigger  ──► terraform apply  ──► state updated, resources provisioned
        │
        ▼
 Cloud Deploy (for app workloads on GKE/Cloud Run) ──► staged rollout
 through environments (dev → staging → prod) with approval gates
```

### Cloud Deploy pipeline mechanics

- **Delivery pipeline resource**: defines the ordered sequence of
  target environments (e.g. dev → staging → prod) an application
  release progresses through — provisioned once as code, reused for
  every release.
- **Targets**: each environment (a GKE cluster, a Cloud Run service) is
  a Cloud Deploy target; promotion from one target to the next is an
  explicit action (automatic for lower environments, gated by manual
  approval for production is the common, exam-expected pattern).
- **Rollback**: Cloud Deploy keeps prior release artifacts addressable,
  so a rollback is "redeploy the previous release," not a rebuild —
  same principle as Cloud Run revision rollback (Domain 5 §5.1).
- **Canary/blue-green delivered through Cloud Deploy**: deployment
  strategies (see Domain 4 §4.3, Domain 6 §6.2) are configured as part
  of the target's rollout strategy, so the *provisioning* of a canary
  release process is a Cloud Deploy configuration artifact, version
  controlled like everything else in this domain.

### Provisioning tool selection decision path

```
 Need to provision a GCP resource
        │
        ▼
 Is it Kubernetes-native and the team already runs GitOps for
 K8s manifests? ──yes──► Config Connector (Domain 5 §5.2 has the
        │                  full decision table)
        no
        ▼
 Is it a one-off exploratory/dev-only resource, not meant to
 persist or be repeated? ──yes──► gcloud CLI / Console acceptable
        │
        no
        ▼
 Default: Terraform, in CI/CD, with remote state and a policy-as-code
 gate — this is the answer for anything described as "repeatable,"
 "production," "across environments," or "audited"
```

- **Deployment Manager** (GCP's original, older IaC tool) is legacy —
  it never appears as the correct exam answer over Terraform for a
  2026-era scenario; recognize it as a deliberately-wrong distractor
  option, not a viable modern alternative.

### Binary Authorization at provisioning/deploy time

Container supply-chain integrity is a provisioning-time control, not
just a security afterthought — it belongs equally in Domain 3 §3.1
(policy design) and here (deploy-time enforcement mechanics):

- **What it does**: enforces that only container images meeting a
  defined attestation policy (e.g. "built by the trusted CI pipeline,"
  "passed the vulnerability scan," "signed by the security team") can
  be deployed to GKE or Cloud Run — a deploy is *blocked* at the
  cluster/service level if the image lacks a required attestation, even
  if the image sits in Artifact Registry and someone has permission to
  deploy it.
- **Provisioning-time placement**: the Binary Authorization policy
  itself is provisioned as part of the cluster/service configuration
  (Terraform `google_binary_authorization_policy`), and attestors are
  provisioned as part of the CI/CD pipeline setup (Cloud Build attests
  an image only after it passes required checks).
- **Correct answer when**: a scenario says "only images that passed our
  security scan should ever run in production," "prevent a compromised
  CI credential from deploying an unreviewed image," or describes any
  supply-chain integrity requirement for GKE/Cloud Run workloads.
- **Not the answer when**: the concern is about *who* can call the
  deploy API (that's IAM) or about network-level access to the running
  workload (that's VPC/firewall/VPC-SC) — Binary Authorization is
  specifically about *which images* are allowed to run, nothing else.

### Tradeoffs — compute provisioning

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "Platform team wants full control over node pools, GPUs, custom images" | GKE Standard provisioned via Terraform | GKE Autopilot | Autopilot intentionally removes the node-level knobs the scenario is asking to keep |
| "App team just wants to ship containers, no cluster to manage" | Cloud Run or GKE Autopilot | GKE Standard | Standard reintroduces node-management burden the scenario explicitly wants to avoid |
| "Need repeatable, peer-reviewed, auditable infra changes" | Terraform in CI/CD | Manual Console changes, ClickOps | Manual changes have no review trail and drift from any IaC source of truth |
| "Team is Kubernetes-native, wants GCP resources managed alongside K8s manifests" | Config Connector | Terraform only | Config Connector lets GCP resources live in the same GitOps loop as application manifests — the scenario's stated tooling preference wins |
| "Only images that passed our vulnerability scan should ever run in prod" | Binary Authorization with a required-attestor policy | IAM restrictions on who can deploy | IAM controls *who* can call deploy, not *which image content* is allowed — Binary Authorization is the image-integrity control specifically |
| "Fleet of clusters spanning GCP and on-prem needs the same deploy policy everywhere" | GKE Enterprise + Config Sync (fleet-wide policy) | Configuring each cluster's Binary Authorization/RBAC policy individually | Per-cluster configuration drifts and doesn't scale; fleet-level policy distribution is the provisioning-correct answer once more than one cluster is in play |

---

## Quota, capacity, and provisioning at scale

- **Quotas are per-project, per-region, and per-API** (e.g. CPUs per
  region, persistent disk capacity, GKE clusters per zone) — a
  provisioning plan for a new large workload should include a quota
  check/increase request *before* the Terraform apply that would hit
  it, not after a failed apply mid-rollout.
- **Provisioning at scale across many projects** (a "project factory"
  pattern, expanded fully in Domain 5 §5.2) starts here at the
  Terraform-module level: a `project` module that provisions a new
  project with its quota requests, Org Policy attachment, Shared VPC
  service-project attachment, and baseline IAM groups as one atomic,
  reviewable change — this is what "many teams need self-service new
  projects, but governed" looks like at the provisioning layer.
- **Reserved capacity and commitments** (Domain 4 §4.3 covers the cost
  side) are provisioned as their own resource, separate from the
  instances that consume them — a scenario describing steady, known
  baseline load is signaling a committed-use-discount resource should
  be part of the provisioning plan, not just a billing-console
  afterthought.

### Hierarchical firewall policy example

```
 Organization
  └── Policy: "deny-all-ingress-by-default" (priority 2147483647,
      lowest priority — evaluated last, acts as the backstop)
       │
       ▼
 Folder: Production
  └── Policy: "allow-lb-health-checks" (higher priority — evaluated
      first, overrides the org default for the specific health-check
      source ranges Google's load balancers use)
       │
       ▼
 Project: prod-app-1
  └── VPC firewall rules: application-specific rules layered on top,
      still constrained by whatever the Folder/Org policies allow —
      a project-level rule CANNOT re-open something the Folder/Org
      policy explicitly denied
```

Rule evaluation order: **hierarchical firewall policies are evaluated
in priority order across the whole hierarchy** (org rules and folder
rules interleave by priority number, not "org always wins over
folder") — but a project admin's own VPC firewall rules can never
override what a higher-level hierarchical policy has explicitly
denied. This distinction (interleaved-by-priority vs. strict
override) is a specific trap worth having cold: it's not "org beats
folder beats project" in a strict layered sense, it's "the most
specific applicable rule at the highest-priority number wins, and
project-level rules can only add allowances within the room the
hierarchy above already leaves open."

## Terraform patterns deep dive

Terraform is the RUNBOOK-confirmed expected IaC tool for this exam's
2026 scope (see RUNBOOK §6). Patterns worth having cold:

### Module structure

```
 repo/
 ├── modules/
 │    ├── network/        (VPC, subnets, firewall, NAT — reusable)
 │    ├── gke-cluster/     (cluster + node pool config — reusable)
 │    └── cloud-sql/       (instance + HA + backup config — reusable)
 ├── environments/
 │    ├── dev/main.tf      (calls modules with dev-sized inputs)
 │    ├── staging/main.tf  (calls modules with staging-sized inputs)
 │    └── prod/main.tf     (calls modules with prod-sized inputs)
 └── backend.tf            (GCS remote state, one state file per
                             environment — never share state across
                             environments)
```

- **Reusable modules, per-environment inputs**: the same module
  (network, GKE, database) is called from every environment with
  different variable values — this is what "repeatable, consistent
  provisioning" looks like in practice, and it's the pattern the exam
  expects behind any "same architecture in dev/staging/prod" scenario.
- **Remote state with locking**: a GCS backend with state locking
  prevents two simultaneous `terraform apply` runs from corrupting
  state — the correct answer whenever a scenario describes multiple
  engineers or CI runs needing to apply Terraform concurrently.
- **State isolation per environment**: one Terraform state file per
  environment (not one giant state for everything) limits the blast
  radius of an accidental destructive change and keeps `plan` output
  reviewable.
- **Workspaces vs. separate state files**: Terraform workspaces are a
  lighter-weight way to reuse the same configuration across
  environments sharing a backend; separate state files/directories per
  environment (as above) are more explicit and are generally the safer,
  more auditable pattern for production — favor separate state unless
  the scenario emphasizes minimizing configuration duplication over
  strict isolation.

### Drift detection and policy-as-code

- **`terraform plan` in CI on every PR** surfaces drift (manual changes
  made outside Terraform show up as an unexpected diff) before they're
  silently overwritten or, worse, silently accepted into state.
- **Policy-as-code gates** (Config Validator, OPA-style checks, or Org
  Policy constraints enforced ahead of `apply`) block a plan that would
  violate a guardrail (e.g. "no public IPs in the production folder")
  — this is the shift-left security pattern referenced in Domain 3.

### Tradeoffs — Terraform patterns

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "Same architecture needed in dev, staging, and prod with different sizing" | Reusable modules + per-environment variable files | Copy-pasted, hand-edited configs per environment | Modules keep the architecture consistent while sizing varies — copy-paste configs drift silently over time |
| "Multiple engineers apply Terraform concurrently" | GCS backend with state locking | Local state files, or a shared state file with no locking | Locking prevents concurrent applies from corrupting state — this is a correctness issue, not just a convenience one |
| "Need to guarantee a policy violation never reaches production" | Policy-as-code check in CI before `apply` | Relying on code review alone to catch it | Human review misses things consistently; an automated policy gate is deterministic |

---

## Observability-as-code

A named 2026 focus area (RUNBOOK §3) — provisioning pipelines should
apply monitoring/alerting configuration as code, at the same time as
the compute/storage resource itself, not bolted on after an incident
reveals the gap.

### The pattern

```
 Same Terraform apply that provisions:
   - google_compute_region_autoscaler (or GKE cluster, or Cloud Run svc)
 also provisions, in the same PR/module:
   - google_monitoring_alert_policy   (SLO burn-rate alert — see
                                        Domain 6 §6.1)
   - google_monitoring_dashboard      (default dashboard for the new
                                        service)
   - google_logging_metric            (any log-based metrics the
                                        service needs)
   - google_monitoring_uptime_check_config (for anything public-facing)
```

- **Why this belongs in Domain 2, not just Domain 6**: Domain 6 covers
  what a good monitoring/alerting *design* looks like; Domain 2 covers
  the *provisioning discipline* of applying it through the same IaC
  pipeline as the resource it observes, so "we launched a new service
  with zero alerting" structurally can't happen — the same PR that
  creates the service is the PR that's incomplete without the
  monitoring resources.
- **Dashboards and alert policies as reusable modules**: a
  `monitoring` Terraform module parameterized by service name can be
  called alongside every compute module, the same reusability pattern
  as the network/GKE/database modules above.

### Tradeoffs — observability-as-code

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "New services keep launching without proper alerting configured" | Bundle monitoring resources into the same Terraform module as the compute resource | A separate manual "add monitoring" ticket/process after launch | Manual after-the-fact processes get skipped under deadline pressure; bundling makes the missing state structurally impossible |
| "Need consistent dashboards across dozens of microservices" | A parameterized monitoring Terraform module reused per service | Hand-building each service's dashboard in the Console | Reuse guarantees consistency and scales with the number of services; manual dashboard-building doesn't |

---

## Production architecture pattern: Terraform-provisioned landing zone

```
                     ┌───────────────────────────────┐
                     │        Organization             │
                     └───────────────┬───────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
      Folder: Production     Folder: Non-Prod        Folder: Shared Services
              │                      │                      │
      ┌───────▼────────┐    ┌───────▼────────┐    ┌────────▼───────┐
      │ Prod Project(s) │    │ Dev/Stg Project │    │ Host Project    │
      │ (Shared VPC     │    │ (own VPC or     │    │ (Shared VPC,    │
      │  service proj)  │    │  Shared VPC svc)│    │  CI/CD tooling, │
      └─────────────────┘    └─────────────────┘    │  logging sink)  │
                                                       └─────────────────┘

Provisioning pipeline (Cloud Build, triggered from a Terraform repo)
applies:
  1. Org Policy constraints at the Folder level (deny external IPs,
     require CMEK, restrict resource locations to approved regions)
  2. Shared VPC host/service project attachments
  3. Hierarchical firewall policy at the Folder level
  4. Per-environment IAM bindings via groups, not individual users
  5. A central log sink (Folder-level) routing all Cloud Logging
     output to a Shared Services BigQuery dataset for org-wide audit
  6. Binary Authorization policy applied to every GKE/Cloud Run
     workload in the Production folder — no image deploys without a
     required attestation
  7. Observability-as-code: default monitoring dashboard + SLO alert
     policy provisioned alongside every new compute resource, via the
     same pipeline (see above)
```

**Why this shape:** the folder structure (Production / Non-Production /
Shared Services) is the most common Domain 1↔2 crossover pattern on the
exam — it's how "central governance, decentralized ownership" gets
implemented at provisioning time, and how Org Policy/firewall
inheritance actually reaches every project without per-project
configuration drift. Adding Binary Authorization and
observability-as-code to the same pipeline is what turns "we
provisioned infrastructure" into "we provisioned a governed,
observable, supply-chain-verified platform" — the level of maturity
the exam's harder scenario questions expect for anything described as
enterprise-scale.

---

## Domain 2-specific exam traps

1. Confusing *design* (Domain 1: "should this be multi-region") with
   *provisioning* (Domain 2: "what Terraform resource/Org Policy
   constraint implements that decision") — Domain 2 questions usually
   give you the design already decided and ask for the correct
   provisioning mechanism.
2. Picking Console/manual steps as the answer for anything described as
   "repeatable" or "across many projects" — that phrasing is the
   IaC/automation signal, every time.
3. Forgetting that Auto-mode VPCs are a real GCP feature but essentially
   never the exam-correct answer for a production scenario — custom-mode
   is the default assumption unless the scenario explicitly wants
   minimal-setup dev/test networking.
4. Treating monitoring/alerting as something provisioned *after* a
   service launches rather than *with* it — the observability-as-code
   pattern above is the 2026-era expected default, and a question
   describing "we had an outage and realized nothing was alerting" is
   testing whether you'd fix the process (bundle it into provisioning),
   not just add one alert reactively.
5. Reaching for IAM restrictions when a scenario is actually asking
   about container image integrity — that's Binary Authorization's job,
   not IAM's; IAM controls *who* can deploy, Binary Authorization
   controls *what* can be deployed.
6. Undersizing GKE secondary IP ranges (Pod/Service CIDR) at cluster
   creation and needing a disruptive rebuild later — this is a
   provisioning-time planning failure the exam expects you to avoid by
   sizing generously up front, not by treating IP planning as an
   afterthought.
