# Domain 2 — Managing and Provisioning a Solution Infrastructure (~15%)

> Source: `00-START-HERE/RUNBOOK.md` §3 (task wording reconstructed —
> see RUNBOOK §1). This domain is about the *how* of standing up what
> Domain 1 designed: IaC, CI/CD, and the provisioning-time configuration
> of network/storage/compute.

## Contents

1. [2.1 Configuring network topologies](#21-configuring-network-topologies)
2. [2.2 Configuring individual storage systems](#22-configuring-individual-storage-systems)
3. [2.3 Configuring compute systems](#23-configuring-compute-systems)
4. [Production architecture pattern: Terraform-provisioned landing zone](#production-architecture-pattern-terraform-provisioned-landing-zone)
5. [Domain 2-specific exam traps](#domain-2-specific-exam-traps)

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

### Cloud SQL / Spanner / Bigtable provisioning

| Setting | Cloud SQL | Cloud Spanner | Bigtable |
|---|---|---|---|
| HA configuration | Regional HA (standby in a second zone, synchronous replication) | Multi-region config = automatic global HA | Cluster replication across zones/regions, configured explicitly |
| Read scaling | Read replicas (async, eventually consistent) | Automatic, strongly consistent read scaling built into the architecture | Add nodes to a cluster (throughput scaling, not really "read replica" semantics) |
| Sizing lever | vCPU/RAM per instance (vertical) | Compute capacity in "processing units" or nodes (horizontal, no resharding needed) | Node count per cluster (horizontal; row-key design matters more than node count for hot-spotting) |
| Provisioning trap | Forgetting to size for peak connections → hits `max_connections` under load | Over-provisioning a single-region app onto multi-region config (unnecessary cost/latency) | Under-provisioning nodes for the *write* pattern, not just data volume — Bigtable performance is throughput-bound, not size-bound |

### Tradeoffs — storage provisioning

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "Compliance requires objects retained but rarely accessed after 1 year" | Lifecycle rule → Archive class at 365 days | Manually moving objects, or leaving everything in Standard | Automated lifecycle rules are the provisioning-time, ops-free answer; Standard-forever wastes budget the scenario didn't authorize |
| "App will scale from 10 to 10,000 DB connections" | Provision a connection pooler (Cloud SQL Auth Proxy/PgBouncer) alongside Cloud SQL, or re-evaluate Spanner | Just increasing `max_connections` indefinitely | Cloud SQL has hard machine-type-based connection ceilings; pooling is the standard mitigation before a DB-tier change |

---

## 2.3 Configuring compute systems

### Provisioning by compute tier

| Tier | What you provision | IaC-first pattern |
|---|---|---|
| Compute Engine | MIGs (instance template + autoscaler + health check), custom machine types | Terraform `google_compute_instance_template` + `google_compute_region_autoscaler` |
| GKE | Cluster (Standard: node pools/machine types; Autopilot: none of that), workloads via manifests/Helm | Terraform for the cluster shell, GitOps (Config Connector or Argo-style) for workloads |
| Cloud Run / Cloud Functions | Service/function config (concurrency, min/max instances, memory/CPU, revisions) | Terraform `google_cloud_run_v2_service`; traffic-split config for canary rollout |

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

- **Observability-as-code**: provisioning pipelines should also apply
  the Cloud Monitoring dashboards/alert policies as code (Terraform
  `google_monitoring_alert_policy`) at the same time as the compute
  resource — "observability by default," not bolted on after an
  incident.
- **Guardrails at provisioning time**: Org Policy constraints (e.g.
  `compute.vmExternalIpAccess` deny-by-default) should block a
  non-compliant `terraform apply` before it ever creates a resource —
  shift-left security, tested as a Domain 2/Domain 3 crossover concept.

### Tradeoffs — compute provisioning

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "Platform team wants full control over node pools, GPUs, custom images" | GKE Standard provisioned via Terraform | GKE Autopilot | Autopilot intentionally removes the node-level knobs the scenario is asking to keep |
| "App team just wants to ship containers, no cluster to manage" | Cloud Run or GKE Autopilot | GKE Standard | Standard reintroduces node-management burden the scenario explicitly wants to avoid |
| "Need repeatable, peer-reviewed, auditable infra changes" | Terraform in CI/CD | Manual Console changes, ClickOps | Manual changes have no review trail and drift from any IaC source of truth |
| "Team is Kubernetes-native, wants GCP resources managed alongside K8s manifests" | Config Connector | Terraform only | Config Connector lets GCP resources live in the same GitOps loop as application manifests — the scenario's stated tooling preference wins |

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
```

**Why this shape:** the folder structure (Production / Non-Production /
Shared Services) is the most common Domain 1↔2 crossover pattern on the
exam — it's how "central governance, decentralized ownership" gets
implemented at provisioning time, and how Org Policy/firewall
inheritance actually reaches every project without per-project
configuration drift.

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
