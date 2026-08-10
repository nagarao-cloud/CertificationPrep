# Compute Services Reference

> Per-service depth. Head-to-head selection logic lives in
> `00-START-HERE/DECISION-TREES.md` Tree 1 and
> `03-comparisons/01-compute-options.md` — this file is what each
> service actually offers once selected.

## Contents

- [Compute Engine](#compute-engine)
- [Google Kubernetes Engine (GKE)](#google-kubernetes-engine-gke)
- [Cloud Run](#cloud-run)
- [Cloud Functions (Gen2)](#cloud-functions-gen2)
- [App Engine](#app-engine)
- [Vertex AI (compute-relevant surface)](#vertex-ai-compute-relevant-surface)

---

## Compute Engine

IaaS virtual machines — full control over OS, kernel, networking stack.

**Key configuration surface:**
- **Machine types**: predefined (general-purpose E2/N2/N2D/C3, compute-optimized
  C2/C2D, memory-optimized M2/M3, accelerator-optimized A2/A3/G2) or
  custom (arbitrary vCPU/RAM within family limits).
- **Managed Instance Groups (MIGs)**: instance template + autoscaler +
  health check → the standard pattern for any horizontally-scaled,
  self-healing Compute Engine fleet. Regional MIGs spread instances
  across zones automatically for zonal fault tolerance.
- **Disks**: Persistent Disk (zonal or regional-replicated,
  SSD/Balanced/HDD tiers) or Hyperdisk (newer, higher performance
  ceiling, independently provisioned IOPS/throughput).
- **Sole-tenant nodes**: dedicated physical hardware, for licensing
  (BYOL Windows/SQL Server) or strict isolation compliance
  requirements.
- **Preemptible / Spot VMs**: up to ~60-91% discount vs. on-demand;
  can be reclaimed with short notice (Spot has no fixed max runtime,
  Preemptible historically capped at 24h) — never for stateful,
  always-on services.
- **Live migration**: on by default for most machine types — VMs move
  transparently off hardware needing maintenance, no reboot required.
  A2/G2 accelerator-heavy families may have different maintenance
  behavior — check when a scenario emphasizes GPU/TPU workloads.
- **Committed Use Discounts (CUDs)**: 1 or 3-year commitment, resource-
  based (specific machine family) or spend-based (flexible across
  families) — spend-based CUDs suit a scenario with evolving instance
  mix, resource-based suit a stable, known fleet.

**Common exam scenario cues:** "need full OS/kernel control," "existing
licensing agreement (BYOL)," "custom drivers or kernel modules,"
"lift-and-shift with minimal change."

---

## Google Kubernetes Engine (GKE)

Managed Kubernetes — Standard (you manage node pools) or Autopilot
(Google manages nodes, you manage workloads and pay per pod resource
request).

**Standard vs. Autopilot at a glance:**

| Aspect | Standard | Autopilot |
|---|---|---|
| Node management | You choose machine types, size node pools, patch (or set auto-upgrade) | Fully managed, no node-level access |
| Billing | Per-node, whether fully utilized or not | Per-pod resource request |
| Custom node config (GPUs, taints, sysctls) | Full control | Limited to Autopilot-supported configurations |
| Best-fit team | Platform team with K8s ops experience | App team that wants Kubernetes's API without the ops burden |

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
  files — the standard, exam-correct pattern (see Domain 3 §3.1).
- **Autoscaling layers**: Horizontal Pod Autoscaler (pods, based on
  CPU/custom metrics), Vertical Pod Autoscaler (right-size pod
  requests), Cluster Autoscaler (nodes, Standard only — Autopilot
  handles this invisibly).
- **Multi-cluster/multi-region**: via Multi Cluster Ingress or a global
  LB fronting regional clusters — the mechanism behind Domain 1's
  multi-region pattern and Domain 6's HA/DR pattern.

**Common exam scenario cues:** "team already knows Kubernetes and wants
control" → Standard; "reduce operational burden, no dedicated platform
team" → Autopilot; "need GPUs/custom node config" → Standard.

---

## Cloud Run

Fully managed, serverless containers. Two shapes: **services** (HTTP,
request-driven, scale-to-zero) and **jobs** (run-to-completion, for
batch/one-off tasks).

**Key configuration surface:**
- **Revisions and traffic splitting**: every deploy creates a new
  immutable revision; traffic can be split by percentage across
  revisions — the mechanism for canary rollouts and instant rollback
  (route 100% back to the prior revision).
- **Concurrency**: requests served per container instance
  (configurable, default 80, max 1000) — higher concurrency reduces
  cold starts and cost for I/O-bound workloads; lower concurrency suits
  CPU-bound work that can't safely share an instance.
- **Min/max instances**: `min instances > 0` eliminates cold starts for
  latency-sensitive services at the cost of paying for idle capacity;
  `max instances` caps cost/blast-radius during a traffic spike or
  runaway loop.
- **VPC egress**: direct VPC egress or a Serverless VPC Access
  connector to reach private resources (Cloud SQL private IP,
  Memorystore) — required whenever Cloud Run needs to talk to anything
  without a public endpoint.
- **CPU allocation**: "CPU always allocated" (background work between
  requests) vs. "CPU only during requests" (cheaper, but no background
  processing) — a scenario needing background threads/async work after
  the response is sent needs the always-allocated setting.

**Common exam scenario cues:** "stateless HTTP service, spiky/unknown
traffic, want to pay only for what's used," "fastest serverless
cold-start requirement among the managed-container options."

---

## Cloud Functions (Gen2)

Event-driven, single-purpose functions — built on Cloud Run
infrastructure under the hood since Gen2, inheriting concurrency and
longer timeout support Gen1 lacked.

**Key configuration surface:**
- **Triggers**: HTTP, Pub/Sub, Cloud Storage (object finalize/delete),
  Firestore, Eventarc (broader event mesh across GCP and custom
  sources).
- **Versioning**: Gen2 functions are versioned like Cloud Run revisions,
  enabling traffic splitting/rollback the same way.
- **Timeout/memory**: up to 60 minutes (Gen2, event-driven) or per
  Cloud Run limits (HTTP) — longer than Gen1's 9-minute ceiling, a
  relevant "why Gen2" detail if a scenario mentions long-running
  triggered work.

**Common exam scenario cues:** "single responsibility, triggered by an
event (file upload, message, DB change), short-to-medium duration" —
if the scenario describes multiple coordinated responsibilities or a
full app with routing, that's Cloud Run/App Engine, not Functions.

---

## App Engine

Legacy PaaS — sandboxed language runtimes, fast autoscaling, zero
infrastructure management.

- **Standard environment**: sandboxed runtimes (Python, Java, Node.js,
  Go, etc.), fastest autoscale (including scale-to-zero), the actively
  tested variant per RUNBOOK §7.
- **Flexible environment**: runs in Docker containers on Compute
  Engine-backed infrastructure, broader language/library support than
  Standard — **de-emphasized for 2026** (RUNBOOK §7); recognize it if a
  scenario mentions it, but it's low-yield as an exam answer.

**Common exam scenario cues:** legacy PaaS-style questions predating
Cloud Run's existence in the scenario's stated timeline, or scenarios
explicitly invoking App Engine's traffic-splitting/versions model.

---

## Vertex AI (compute-relevant surface)

Unified ML platform — the compute-relevant pieces beyond model
selection itself (full ML lifecycle detail in
`02-services/05-data-analytics-ai.md`):

- **Training**: custom training jobs (your container, your framework)
  or AutoML (managed, less control); choose based on the team's ML
  engineering maturity and how standard the problem is.
- **Serving/endpoints**: online prediction endpoints (low-latency,
  autoscaled, can be private via VPC-SC — see Domain 3 §3.1) or batch
  prediction (large-volume, not latency-sensitive).
- **Multi-model endpoints and traffic splitting**: serve multiple model
  versions behind one endpoint with percentage-based traffic split —
  the ML-serving equivalent of Cloud Run's canary mechanism.

**Common exam scenario cues:** "train/serve a machine learning model,"
"AI-assisted feature" (2026-era case-study material, especially HRL's
commentary/highlight generation).
