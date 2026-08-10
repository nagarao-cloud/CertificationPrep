# Compute Services Reference

> Per-service depth. Head-to-head selection logic lives in
> `00-START-HERE/DECISION-TREES.md` Tree 1 and
> `03-comparisons/01-compute-options.md` — this file is what each
> service actually offers once selected. Every service below is worked
> through the same checklist: purpose, when to use, when **not** to use
> (paired with the alternative that wins instead), configuration
> surface, cost, performance, scaling, security, HA/failure behavior,
> common mistakes, and exam scenario cues.

## Contents

- [Compute Engine](#compute-engine)
- [Google Kubernetes Engine (GKE)](#google-kubernetes-engine-gke)
- [Cloud Run](#cloud-run)
- [Cloud Functions (Gen2)](#cloud-functions-gen2)
- [App Engine](#app-engine)
- [Vertex AI (compute-relevant surface)](#vertex-ai-compute-relevant-surface)

---

## Compute Engine

**Purpose:** IaaS virtual machines — full control over OS, kernel, and
the networking stack. The baseline compute primitive every other
managed compute option (GKE nodes, App Engine Flexible, Dataproc
workers) ultimately runs on top of.

**When to use:**
- The workload needs OS/kernel-level control: custom kernel modules,
  specific driver versions, low-level tuning (`sysctl`, huge pages).
- Existing licensing agreements (BYOL Windows Server, SQL Server, SAP)
  that assume dedicated or specifically-configured VM hardware.
- Lift-and-shift migrations where re-architecting for a managed
  platform isn't in scope for the current project phase.
- GPU/TPU-attached workloads that need direct hardware access outside
  a managed ML platform's abstraction (custom training frameworks,
  render farms).
- Sole-tenant, physically-isolated hardware required by a compliance
  regime.

**When NOT to use — use something else instead:**
- Stateless HTTP service with spiky/unknown traffic and no need for
  OS access → **Cloud Run** — avoids managing a VM fleet, autoscaler,
  and patch cadence for a workload that doesn't need any of it.
- Single-purpose, event-triggered logic → **Cloud Functions** —
  standing up and patching a VM for a function-shaped workload is
  needless operational overhead.
- Container orchestration at scale with the full Kubernetes API
  surface → **GKE** — hand-rolling MIGs plus a custom scheduler
  reinvents what GKE already manages.
- A team explicitly trying to reduce infrastructure operations
  headcount/time → **App Engine or Cloud Run** — Compute Engine is the
  *most* operational-burden option of the compute family by design;
  choosing it when the stated goal is "less ops" is a direct exam
  trap.

**Key configuration surface:**
- **Machine types**: predefined (general-purpose E2/N2/N2D/C3,
  compute-optimized C2/C2D, memory-optimized M2/M3, accelerator-
  optimized A2/A3/G2) or custom (arbitrary vCPU/RAM within family
  limits). E2 is the lowest-cost general-purpose family (shared-core
  variants available); C-series compute-optimized suits latency-
  sensitive HPC/gaming; M-series memory-optimized suits SAP HANA/large
  in-memory databases; A/G-series carry attached GPUs for ML training/
  inference and graphics workloads.
- **Managed Instance Groups (MIGs)**: instance template + autoscaler +
  health check → the standard pattern for any horizontally-scaled,
  self-healing fleet. Regional MIGs spread instances across zones
  automatically for zonal fault tolerance; zonal MIGs are a single
  zone's blast radius. Stateful MIGs preserve per-instance disk/
  metadata/name across auto-healing — relevant when a workload has
  local state that must survive a health-check-triggered recreate.
- **Disks**: Persistent Disk (zonal or regional-replicated,
  SSD/Balanced/HDD tiers) or Hyperdisk (newer, higher performance
  ceiling, independently provisioned IOPS/throughput). Local SSD
  offers the highest IOPS/lowest latency but is ephemeral — data is
  lost on stop/terminate/host maintenance events without live
  migration support, never a system-of-record choice.
- **Sole-tenant nodes**: dedicated physical hardware, for licensing
  (BYOL Windows/SQL Server) or strict physical-isolation compliance
  requirements. Priced as a fixed-capacity node regardless of how many
  VMs are packed onto it.
- **Preemptible / Spot VMs**: up to ~60–91% discount vs. on-demand;
  can be reclaimed with short notice (Spot has no fixed max runtime,
  Preemptible historically capped at 24h) — never for stateful,
  always-on services; suits fault-tolerant batch/CI workers that
  checkpoint or can simply restart.
- **Live migration**: on by default for most machine types — VMs move
  transparently off hardware needing maintenance, no reboot required.
  A2/G2 accelerator-heavy families may have different maintenance
  behavior (some GPU shapes require a maintenance-triggered stop
  instead of live migration) — check when a scenario emphasizes GPU/
  TPU workloads and expects zero interruption.
- **Committed Use Discounts (CUDs)**: 1 or 3-year commitment, resource-
  based (specific machine family) or spend-based (flexible across
  families) — spend-based CUDs suit a scenario with evolving instance
  mix, resource-based suit a stable, known fleet.
- **Shielded VM**: secure boot, virtual TPM, and integrity monitoring
  against boot-/kernel-level rootkits — on by default for many public
  images, an explicit checkbox for custom images.
- **Confidential VM**: memory encrypted in use (not just at rest/in
  transit) via AMD SEV or Intel TDX — the answer whenever a scenario
  demands protection against a compromised hypervisor/host operator,
  distinct from standard at-rest disk encryption.
- **Startup scripts and metadata server**: bootstrap configuration at
  boot without baking a custom image; the metadata server also serves
  the attached service account's short-lived access tokens to
  workloads calling GCP APIs.

**Pricing / cost considerations:**
- Per-second billing (1-minute minimum) — no benefit to batching
  short-lived jobs onto fewer, longer-running instances purely for
  billing-granularity reasons.
- Sustained-use discounts are largely superseded by CUDs for current
  machine families — a scenario testing "automatic discount for
  steady usage with zero commitment" may still reference legacy
  sustained-use behavior on older families; CUDs are the current,
  exam-preferred lever for predictable workloads.
- Spot/Preemptible pricing floats with capacity and can offer the
  deepest discount of any compute option in this file — but the
  workload must tolerate reclaim, or the "savings" become an
  availability incident.
- Disk cost is billed independently of the attached VM's state — a
  stopped VM still accrues Persistent Disk charges, a frequent
  "why is my bill not dropping" exam-adjacent trap.
- Egress to the internet or across regions is billed separately from
  compute/disk — a multi-region MIG design should account for
  inter-region traffic cost, not just compute cost.

**Performance characteristics:**
- Network throughput scales with vCPU count and machine type/network
  tier (Tier_1 networking on eligible machine types raises the
  per-VM egress bandwidth ceiling) — an undersized machine type can
  bottleneck network-bound workloads even with spare CPU.
- Local SSD delivers the lowest latency/highest IOPS of any block
  storage option here, at the cost of durability (ephemeral, no
  cross-host replication).
- Hyperdisk decouples IOPS/throughput provisioning from disk capacity
  — the answer whenever a workload's IOPS-to-GB ratio doesn't map
  cleanly onto a fixed Persistent Disk tier.

**Scaling behavior:**
- MIGs autoscale on CPU utilization, load-balancing serving capacity,
  Cloud Monitoring custom metrics, or a fixed schedule.
- Regional MIGs distribute new instances across zones for balance and
  fault tolerance automatically; scaling actions respect target
  distribution unless a zone is out of capacity.
- Scaling is bounded by project/region quotas (vCPU, IP, disk) —
  a scenario describing a sudden capacity failure during a scale-out
  event is frequently a quota-exhaustion question, not a design flaw.

**Security posture:**
- Prefer OS Login (IAM-governed SSH access, auditable, revocable
  centrally) over per-instance SSH metadata keys, which are harder to
  audit and revoke at scale.
- Scope the attached service account tightly — the default Compute
  Engine service account historically carries the broad `Editor` role
  on older projects; a scenario describing "any compromised VM can
  modify unrelated resources" is testing this exact misconfiguration.
- Firewall rules should be scoped by network tag or service account,
  not broad CIDR ranges, to keep the blast radius of a rule change
  contained to the intended instances.
- Confidential VM and Shielded VM (above) are the compliance-driven
  security levers most likely to appear as the differentiator in a
  security-focused Compute Engine question.

**HA / failure-mode behavior:**
- Live migration handles most planned host maintenance transparently
  — no action needed, no reboot, workload keeps running.
- A single instance is a zonal single point of failure regardless of
  live migration (live migration doesn't help during an actual zone
  outage) — HA requires a regional MIG plus a load balancer
  distributing across zones.
- Cross-region failure tolerance is not automatic at the Compute
  Engine layer — it requires an explicit multi-region MIG + global
  load balancer design (see `03-networking.md`) or an application-
  level replication strategy.
- Snapshot schedules (Persistent Disk) provide the backup/restore
  mechanism for disk-level recovery; they are not a substitute for an
  HA architecture, only for data-loss recovery.

**Common mistakes / misconfigurations:**
- Running a single standalone instance in production instead of a
  MIG — no self-healing, no zonal fault tolerance.
- Leaving the default service account with broad `Editor` permissions
  attached to production VMs.
- Assigning static external IPs to instances that only need outbound
  internet access, instead of routing outbound traffic through Cloud
  NAT and keeping instances IP-less/private.
- Choosing a low-IOPS Persistent Disk tier for a database workload
  that needs sustained high random IOPS, then blaming the database
  engine for the resulting latency.
- Ignoring CUDs/Spot entirely for a workload with a well-understood,
  steady baseline — a common Domain 4 cost-optimization exam gap.

**Common exam scenario cues:** "need full OS/kernel control,"
"existing licensing agreement (BYOL)," "custom drivers or kernel
modules," "lift-and-shift with minimal change," "GPU/TPU workload
needing direct hardware access outside a managed ML platform."

---

## Google Kubernetes Engine (GKE)

> **Naming note (MEDIUM confidence, recall-level — not independently
> re-verified this session):** Google's current branding for its
> hybrid/multi-cloud Kubernetes platform is **GKE Enterprise**.
> **Anthos** is the older product name for the same territory and is
> now treated as a legacy/synonym term — a scenario or a stale prep
> source may still say "Anthos." Lead answers with "GKE Enterprise";
> recognize "Anthos" as referring to the same thing. See
> `CLAUDE.md` §7 and `RUNBOOK.md` §7 for the sourcing/confidence note.

**Purpose:** managed Kubernetes — Standard (you manage node pools) or
Autopilot (Google manages nodes, you manage workloads and pay per pod
resource request). GKE Enterprise extends this to multi-cluster,
multi-cloud, and hybrid on-prem fleets under one management plane
(fleet management, centralized policy, multi-cluster services).

**Standard vs. Autopilot at a glance:**

| Aspect | Standard | Autopilot |
|---|---|---|
| Node management | You choose machine types, size node pools, patch (or set auto-upgrade) | Fully managed, no node-level access |
| Billing | Per-node, whether fully utilized or not | Per-pod resource request |
| Custom node config (GPUs, taints, sysctls) | Full control | Limited to Autopilot-supported configurations |
| Cluster management fee | Applies (one zonal cluster/billing account free) | Applies |
| Best-fit team | Platform team with K8s ops experience | App team that wants Kubernetes's API without the ops burden |

**When to use:**
- Container orchestration that genuinely needs the Kubernetes API
  (custom controllers/operators, complex scheduling constraints,
  StatefulSets with ordered rollout, service mesh integration).
- Portability across cloud/on-prem is a stated requirement (GKE
  Enterprise fleets, Config Sync/Policy Controller for consistent
  multi-cluster governance).
- Workloads with heterogeneous resource shapes (some pods need GPUs,
  some need high memory, some need neither) that benefit from node
  pool segmentation.

**When NOT to use — use something else instead:**
- A single stateless container service with simple scale-to-zero
  needs → **Cloud Run** — running a cluster for one service is
  needless control-plane and node overhead.
- A team with no Kubernetes operational experience and no timeline to
  build it, and the workload doesn't need K8s-specific features →
  **Cloud Run or App Engine** — unless Autopilot specifically removes
  enough of that burden that the team's remaining K8s exposure is just
  the API surface, not node ops.
- Short-lived batch/one-off jobs with no ongoing orchestration need →
  **Cloud Run jobs** or **Cloud Functions** — lighter-weight, no
  cluster to keep warm.
- A workload needing GPUs/custom node-level configuration (specific
  sysctls, custom DaemonSets requiring node access) but the team also
  wants zero node management → conflicting requirements; **GKE
  Standard**, not Autopilot, since Autopilot restricts exactly this
  kind of customization.

**Key configuration surface:**
- **Node pools** (Standard only): group nodes by machine type/labels/
  taints — used to isolate specialized workloads (GPU pool tainted so
  only GPU-requesting pods schedule there).
- **Release channels**: Rapid/Regular/Stable — controls how
  aggressively the cluster auto-upgrades Kubernetes minor versions;
  Stable is the default choice for production unless a scenario
  explicitly wants early access to new features.
- **Workload Identity**: binds a Kubernetes ServiceAccount to a GCP
  service account for pod-level GCP API access without mounting key
  files — the standard, exam-correct pattern (see Domain 3 §3.1 and
  `04-security-iam.md`).
- **Autoscaling layers**: Horizontal Pod Autoscaler (pods, based on
  CPU/custom metrics), Vertical Pod Autoscaler (right-size pod
  requests), Cluster Autoscaler (nodes, Standard only), and Node
  Auto-Provisioning (Standard — dynamically creates new node pools
  matching pending pods' requirements instead of requiring a
  pre-defined pool). Autopilot bundles equivalent pod- and node-level
  scaling invisibly.
- **Multi-cluster/multi-region**: via Multi Cluster Ingress or a
  global LB fronting regional clusters — the mechanism behind Domain
  1's multi-region pattern and Domain 6's HA/DR pattern.
- **Private clusters**: nodes get only internal IPs; control-plane
  access can be further restricted (authorized networks, private
  endpoint) — the default posture for any production cluster handling
  sensitive workloads.
- **Network Policy**: Kubernetes-native pod-to-pod traffic
  segmentation (default-deny plus explicit allow) — the pod-level
  complement to VPC firewall rules, which only see traffic at the
  node/VM boundary.
- **Binary Authorization integration**: enforced at deploy time to
  require signed/attested images before the scheduler will run a pod
  — full depth in `07-devops-cicd.md`'s Binary Authorization section.

**Pricing / cost considerations:**
- A per-cluster management fee applies per cluster (one zonal cluster
  per billing account is free); regional clusters and Autopilot
  clusters are billed the same fee structure.
- Standard bills for provisioned node capacity regardless of pod
  utilization — an underutilized node pool is pure waste, which is
  the core cost argument for Autopilot or aggressive Cluster
  Autoscaler tuning.
- Autopilot bills per pod resource request (CPU/memory/ephemeral
  storage), which can be cheaper for bursty/uneven workloads and more
  expensive for a workload that could bin-pack tightly under manual
  Standard tuning — the tradeoff is operational effort saved vs. raw
  compute cost.
- Spot node pools (Standard) apply the same reclaim-risk discount as
  Compute Engine Spot VMs — suited to fault-tolerant, restartable
  batch workloads scheduled onto a tainted Spot pool.

**Performance characteristics:**
- Pod startup latency is dominated by image pull time — regional
  Artifact Registry co-located with the cluster reduces this (see
  `07-devops-cicd.md`).
- Regional clusters replicate the control plane across zones, adding
  a small amount of API-server latency versus a zonal cluster's
  single control plane, in exchange for HA.
- Autopilot's scheduler bin-packs more aggressively by default than
  an under-tuned Standard cluster, which can improve density but
  removes the ability to hand-tune node-level placement.

**Scaling behavior:**
- HPA reacts to pod-level metrics; VPA adjusts requested resources;
  Cluster Autoscaler (Standard) and Node Auto-Provisioning add/remove
  nodes to match pending pod demand; Autopilot performs the node-level
  equivalent invisibly.
- Scale-out is bounded by node pool machine-type availability/quota
  in the target zone(s) — a regional cluster spreads this risk across
  zones, a zonal cluster concentrates it.

**Security posture:**
- Workload Identity is the exam-default answer for pod-to-GCP-API
  authentication — never a mounted service-account-key JSON file.
- Shielded GKE Nodes extend Compute Engine's Shielded VM protections
  (secure boot, integrity monitoring) to cluster nodes.
- Private clusters remove public IPs from nodes; combine with
  `Master authorized networks` to also restrict who can reach the
  control-plane API endpoint.
- GKE Sandbox (gVisor-based) provides an additional isolation layer
  for running untrusted or multi-tenant workloads on shared nodes.
- Binary Authorization (see `07-devops-cicd.md`) blocks unattested
  images from being scheduled at all — the supply-chain-security
  layer above network/identity controls.

**HA / failure-mode behavior:**
- Regional clusters replicate the control plane across 3 zones —
  the control plane survives a single zone outage; zonal clusters do
  not (single control-plane replica, a SPOF for cluster
  administration, though existing workloads keep running on
  surviving nodes during a control-plane-only outage).
- Node auto-repair replaces unhealthy nodes automatically based on
  health-check signal.
- Surge upgrades (Standard) control how many extra nodes are
  provisioned during a rolling upgrade, bounding the blast radius/
  capacity dip during the rollout; PodDisruptionBudgets protect
  application availability during voluntary disruptions (upgrades,
  node drains).
- Multi-region resilience (surviving a full regional outage) requires
  multiple regional clusters plus a global load balancer — not a
  single-cluster feature.

**Common mistakes / misconfigurations:**
- Running a zonal cluster in production, creating a control-plane
  single point of failure.
- Mounting service account key files into pods instead of using
  Workload Identity.
- Leaving node pools on the `default` network-accessible configuration
  instead of provisioning a private cluster.
- Choosing Autopilot for a workload that needs GPU DaemonSets or
  node-level `sysctl` tuning Autopilot doesn't expose.
- Ignoring PodDisruptionBudgets, causing an upgrade or node drain to
  take down all replicas of a service simultaneously.
- Treating "Anthos" and "GKE Enterprise" as different products when a
  scenario uses either term for the same hybrid/multi-cluster
  capability.

**Common exam scenario cues:** "team already knows Kubernetes and
wants control" → Standard; "reduce operational burden, no dedicated
platform team" → Autopilot; "need GPUs/custom node config" → Standard;
"consistent policy and workload management across on-prem and multiple
clouds" → GKE Enterprise (Anthos).

---

## Cloud Run

**Purpose:** fully managed, serverless containers. Two shapes:
**services** (HTTP, request-driven, scale-to-zero) and **jobs**
(run-to-completion, for batch/one-off tasks).

**When to use:**
- Stateless HTTP services/APIs with spiky, unpredictable, or
  bursty traffic where paying for idle capacity is wasteful.
- Teams that want container packaging (bring any language/runtime)
  without taking on cluster or node management.
- Batch/one-off run-to-completion work that doesn't need an ongoing
  orchestration layer (Cloud Run jobs).
- The fastest cold-start-to-serving path among the managed-container
  options when a workload can't justify a standing cluster.

**When NOT to use — use something else instead:**
- Long-running, stateful workloads holding significant local state or
  needing more than the maximum request timeout → **GKE or Compute
  Engine** — Cloud Run's request-oriented model and timeout ceiling
  aren't a fit for long-lived stateful processes.
- Workloads needing privileged/host-level access, custom kernel
  modules, or direct hardware (GPU passthrough limitations, specific
  driver versions) → **Compute Engine or GKE**.
- Complex multi-container pod co-location with shared lifecycle/
  networking semantics beyond a simple sidecar → **GKE** — Kubernetes
  pods model this natively; Cloud Run's container grouping is more
  limited.
- A scenario explicitly needing fine-grained Kubernetes scheduling
  constraints (affinity/anti-affinity, custom operators) → **GKE**.

**Key configuration surface:**
- **Revisions and traffic splitting**: every deploy creates a new
  immutable revision; traffic can be split by percentage across
  revisions — the mechanism for canary rollouts and instant rollback
  (route 100% back to the prior revision).
- **Concurrency**: requests served per container instance
  (configurable, default 80, max 1000) — higher concurrency reduces
  cold starts and cost for I/O-bound workloads; lower concurrency
  suits CPU-bound work that can't safely share an instance.
- **Min/max instances**: `min instances > 0` eliminates cold starts for
  latency-sensitive services at the cost of paying for idle capacity;
  `max instances` caps cost/blast-radius during a traffic spike or
  runaway loop.
- **VPC egress**: direct VPC egress or a Serverless VPC Access
  connector to reach private resources (Cloud SQL private IP,
  Memorystore) — required whenever Cloud Run needs to talk to
  anything without a public endpoint.
- **CPU allocation**: "CPU always allocated" (background work between
  requests) vs. "CPU only during requests" (cheaper, but no background
  processing) — a scenario needing background threads/async work
  after the response is sent needs the always-allocated setting.
- **Startup CPU boost**: temporarily allocates extra CPU during
  container startup to shorten cold-start latency for CPU-heavy
  init work (framework bootstrapping, JIT warm-up).
- **IAM invoker roles**: control who/what can call a service —
  the mechanism for keeping a service fully private (internal
  service-to-service only) versus public.

**Pricing / cost considerations:**
- Billed per 100ms of CPU/memory actually consumed while a request is
  being processed (with "CPU always allocated" billed continuously
  instead), plus a per-request charge — genuinely pay-for-use for
  bursty traffic.
- `min instances > 0` converts part of the bill back into always-on
  compute cost — a scenario weighing cold-start latency against cost
  is testing this exact tradeoff.
- Uncapped `max instances` combined with a traffic spike (or a
  retry-storm bug) can produce a cost runaway — setting a sane
  ceiling is a cost-control measure, not just a capacity control.

**Performance characteristics:**
- Cold start ranges from sub-second to a few seconds depending on
  image size, language runtime, and startup work — generally the
  fastest cold start among the serverless container options here.
- Higher concurrency settings amortize cold starts and per-instance
  overhead across more simultaneous requests for I/O-bound workloads.

**Scaling behavior:**
- Scales to zero when idle (unless `min instances` is set) and scales
  out per-revision based on concurrent request load, up to
  `max instances`.
- Each revision scales independently — a canary revision receiving
  5% of traffic scales its own instance count for that slice, not
  shared with the stable revision.

**Security posture:**
- Services can be fully private, reachable only via IAM-authenticated
  invocation (service-to-service with a bound service account, or via
  an internal load balancer) — the default posture unless public
  ingress is explicitly required.
- Supports VPC-SC perimeters and Binary Authorization at deploy time,
  the same supply-chain control used for GKE (see
  `07-devops-cicd.md`).
- Runs containers in a gVisor-sandboxed environment by default,
  adding isolation beyond a standard container runtime.

**HA / failure-mode behavior:**
- A Cloud Run service is regional; multi-region resilience requires
  deploying the same service to multiple regions behind a global
  external Application Load Balancer.
- Revisions provide instant, one-step rollback (shift traffic back to
  the prior revision) — the fastest recovery path from a bad deploy
  among the compute options in this file.

**Common mistakes / misconfigurations:**
- Leaving `max instances` unbounded, risking a cost/capacity runaway
  under unexpected load.
- Using Cloud Run for a workload that regularly exceeds the maximum
  request timeout, instead of moving it to a job/queue-based pattern
  or GKE.
- Leaving a service public when it should be restricted to
  service-to-service IAM-invoker access only.
- Forgetting VPC egress configuration, then being unable to reach a
  private Cloud SQL/Memorystore instance and misdiagnosing it as a
  firewall issue.
- Choosing "CPU only during requests" for a workload that spawns
  background async work after responding, causing that work to stall.

**Common exam scenario cues:** "stateless HTTP service, spiky/unknown
traffic, want to pay only for what's used," "fastest serverless
cold-start requirement among the managed-container options."

---

## Cloud Functions (Gen2)

**Purpose:** event-driven, single-purpose functions — built on Cloud
Run infrastructure under the hood since Gen2, inheriting concurrency
and longer timeout support Gen1 lacked.

**When to use:**
- Single-responsibility logic triggered by a discrete event (file
  upload, message arrival, database change) with short-to-medium
  execution duration.
- Lightweight glue code between managed services that doesn't
  justify a full service deployment.

**When NOT to use — use something else instead:**
- Multiple coordinated responsibilities or a full application with
  routing/multiple endpoints → **Cloud Run** — Functions is
  single-purpose by design; a scenario describing a multi-route API
  is describing a Cloud Run service, not a function.
- Long-running processing beyond the Gen2 event-driven ceiling (60
  minutes) or requiring persistent state between invocations →
  **Cloud Run jobs** or **GKE**.
- High, sustained, predictable throughput where per-invocation
  billing and cold starts are a worse economic fit than a
  provisioned/always-warm alternative → **Cloud Run with `min
  instances`** or a dedicated service.

**Key configuration surface:**
- **Triggers**: HTTP, Pub/Sub, Cloud Storage (object finalize/delete),
  Firestore, Eventarc (broader event mesh across GCP and custom
  sources).
- **Versioning**: Gen2 functions are versioned like Cloud Run
  revisions, enabling traffic splitting/rollback the same way.
- **Timeout/memory**: up to 60 minutes (Gen2, event-driven) or per
  Cloud Run limits (HTTP) — longer than Gen1's 9-minute ceiling, a
  relevant "why Gen2" detail if a scenario mentions long-running
  triggered work.

**Pricing / cost considerations:**
- Billed per invocation plus compute time consumed (GB-seconds/
  GHz-seconds), with a perpetual free tier — economical for
  low-to-moderate, spiky invocation volume.
- At sustained high invocation rates, per-invocation billing can cost
  more than a provisioned always-on alternative — worth flagging in
  a Domain 4 cost-optimization scenario describing steady, high-volume
  triggering.

**Performance characteristics:**
- Cold starts apply the same way they do for Cloud Run, since Gen2
  runs on the same underlying infrastructure; concurrency per
  instance is configurable like Cloud Run.

**Scaling behavior:**
- Scales automatically per-trigger volume, to zero when idle, up to a
  configurable maximum instance count — the same scale-to-zero
  economics as Cloud Run.

**Security posture:**
- IAM governs both who can invoke HTTP-triggered functions and which
  service account the function runs as — least-privilege scoping
  applies exactly as it does for any other GCP compute identity.
- Supports VPC connectors for reaching private resources, same
  pattern as Cloud Run.

**HA / failure-mode behavior:**
- Event-driven triggers from Pub/Sub and Eventarc carry at-least-once
  delivery semantics — a function must be idempotent, since retries
  on failure are expected behavior, not an edge case.
- Dead-letter handling (via the underlying Pub/Sub subscription) is
  the mechanism for isolating consistently-failing events instead of
  retrying indefinitely.

**Common mistakes / misconfigurations:**
- Writing non-idempotent functions against at-least-once trigger
  sources, causing duplicate side effects on retry.
- Using a function where the workload has grown into a multi-endpoint
  service that should have migrated to Cloud Run.
- Granting the function's service account broader permissions than
  the single action it performs requires.

**Common exam scenario cues:** "single responsibility, triggered by an
event (file upload, message, DB change), short-to-medium duration" —
if the scenario describes multiple coordinated responsibilities or a
full app with routing, that's Cloud Run/App Engine, not Functions.

---

## App Engine

**Purpose:** legacy PaaS — sandboxed language runtimes, fast
autoscaling, zero infrastructure management.

**When to use:**
- A scenario's stated technology timeline predates Cloud Run, or it
  explicitly invokes App Engine's traffic-splitting/versions model as
  an existing constraint.
- A team wants an opinionated, zero-infrastructure PaaS with
  built-in services (Task Queues, Memcache, NDB) it's already
  standardized on.

**When NOT to use — use something else instead:**
- A greenfield containerized service with no existing App Engine
  investment → **Cloud Run** — same "zero infra to manage" value
  proposition, container-native (any language/runtime), and the
  actively-tested/current serverless answer for 2026 per RUNBOOK §7.
- Any scenario favoring App Engine Flexible specifically → treat as
  **de-emphasized for 2026** (RUNBOOK §7); Cloud Run is the modern
  equivalent for container-based workloads that don't fit Standard's
  sandboxed runtimes.

**Key configuration surface:**
- **Standard environment**: sandboxed runtimes (Python, Java, Node.js,
  Go, etc.), fastest autoscale (including scale-to-zero), the actively
  tested variant per RUNBOOK §7.
- **Flexible environment**: runs in Docker containers on Compute
  Engine-backed infrastructure, broader language/library support than
  Standard — **de-emphasized for 2026** (RUNBOOK §7); recognize it if
  a scenario mentions it, but it's low-yield as an exam answer.
- **Versions and traffic splitting**: App Engine's own precursor to
  Cloud Run's revision model — multiple versions of a service can
  receive split traffic for canary-style rollout.

**Pricing / cost considerations:**
- Standard scales to zero and bills per instance-hour of actual use,
  similar cost shape to Cloud Run for spiky workloads; Flexible bills
  more like underlying Compute Engine VMs (always-on minimum
  footprint), a materially different cost profile worth flagging if a
  scenario compares the two environments on cost.

**Performance characteristics:**
- Standard environment offers very fast scale-out/scale-to-zero due
  to its sandboxed runtime model — historically faster cold start
  than Flexible, which boots a full container/VM.

**Scaling behavior:**
- Automatic scaling, basic scaling (idle instance shutdown after
  inactivity), and manual scaling (fixed instance count) are all
  available scaling modes; automatic is the default production
  choice.

**Security posture:**
- IAM governs deployment and admin access; the sandboxed Standard
  runtime constrains what an application can do at the OS level by
  design, reducing certain classes of host-escape risk compared to a
  general-purpose VM.

**HA / failure-mode behavior:**
- App Engine applications are regional at the application level
  (one region chosen at creation, not changeable without recreating
  the application) — a scenario needing multi-region App Engine
  resilience needs an explicit multi-app or fronting-LB design, which
  is part of why Cloud Run (deployable per-region behind a global LB)
  is the more flexible modern choice.

**Common mistakes / misconfigurations:**
- Recommending App Engine Flexible as the default answer in a 2026
  scenario when Cloud Run better fits the same requirement with less
  baggage.
- Forgetting that the App Engine application's region is a one-time,
  immutable choice per project.

**Common exam scenario cues:** legacy PaaS-style questions predating
Cloud Run's existence in the scenario's stated timeline, or scenarios
explicitly invoking App Engine's traffic-splitting/versions model.

---

## Vertex AI (compute-relevant surface)

**Purpose:** unified ML platform — the compute-relevant pieces beyond
model selection itself (full ML lifecycle detail in
`02-services/05-data-analytics-ai.md`).

**When to use:**
- Training or serving a machine learning model where the team wants a
  managed platform instead of hand-building training infrastructure
  on Compute Engine/GKE.
- AI-assisted product features grounded in the team's own data
  (2026-era case-study material, e.g. HRL's commentary/highlight
  generation).

**When NOT to use — use something else instead:**
- A team with mature ML infrastructure that wants full control over
  the training cluster (custom scheduler, exotic distributed-training
  topology) → **GKE with GPU node pools** or **Compute Engine A2/A3/G2
  instances directly** — Vertex AI's managed training trades some of
  that control for operational simplicity.
- Simple SQL-expressible ML (e.g. a regression/classification model
  trainable directly against warehouse data) → **BigQuery ML** — no
  need to stand up a separate Vertex AI training job for a problem
  that fits inside the warehouse.

**Key configuration surface:**
- **Training**: custom training jobs (your container, your framework)
  or AutoML (managed, less control); choose based on the team's ML
  engineering maturity and how standard the problem is.
- **Serving/endpoints**: online prediction endpoints (low-latency,
  autoscaled, can be private via VPC-SC — see Domain 3 §3.1) or batch
  prediction (large-volume, not latency-sensitive).
- **Multi-model endpoints and traffic splitting**: serve multiple
  model versions behind one endpoint with percentage-based traffic
  split — the ML-serving equivalent of Cloud Run's canary mechanism.

**Pricing / cost considerations:**
- Training is billed by compute resource consumed (machine type,
  accelerator type/count, duration) — accelerator selection is the
  dominant cost lever; matching accelerator type to model size avoids
  paying for idle GPU/TPU capacity.
- Online endpoints bill for provisioned node capacity whether fully
  utilized or not (similar shape to GKE Standard); batch prediction
  bills only for the job's actual run — a cost/latency tradeoff
  parallel to Cloud Run's `min instances` decision.

**Performance characteristics:**
- Online endpoint latency is dominated by model size/complexity and
  accelerator choice; autoscaling adds instances to hold latency
  targets under load, with cold-start behavior for scale-from-zero
  configurations analogous to Cloud Run's.

**Scaling behavior:**
- Online endpoints autoscale on traffic/utilization like other
  managed compute in this file; batch prediction scales out workers
  per job without needing a standing endpoint.

**Security posture:**
- Private endpoints and VPC-SC perimeters restrict model access to
  inside the perimeter — the answer whenever a scenario requires
  model endpoints not exposed to the public internet (see
  `04-security-iam.md`).
- Workload Identity Federation is the pattern for external/partner
  systems needing to call a Vertex AI endpoint without a static key.

**HA / failure-mode behavior:**
- Endpoints are regional; multi-region serving resilience requires
  deploying the model to multiple regional endpoints behind a global
  load balancer, the same pattern used for Cloud Run/GKE multi-region
  HA.

**Common mistakes / misconfigurations:**
- Standing up custom training infrastructure on GKE/Compute Engine
  for a standard AutoML-shaped problem, adding unneeded operational
  burden.
- Leaving a prediction endpoint public when a scenario requires
  private/partner-only access.
- Not right-sizing accelerator type/count to model size, leaving
  expensive GPU/TPU capacity idle.

**Common exam scenario cues:** "train/serve a machine learning model,"
"AI-assisted feature" (2026-era case-study material, especially HRL's
commentary/highlight generation).
