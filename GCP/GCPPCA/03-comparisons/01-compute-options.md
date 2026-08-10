# Comparison: Compute Options

> Selection tree: `00-START-HERE/DECISION-TREES.md` Tree 1. Per-service
> depth: `02-services/01-compute.md`. This file is the head-to-head
> matrix for scenario questions that give you 2+ plausible compute
> choices and ask you to pick.

## Full comparison matrix

| Dimension | Compute Engine | GKE Standard | GKE Autopilot | Cloud Run | Cloud Functions (Gen2) | App Engine Standard |
|---|---|---|---|---|---|---|
| Abstraction level | IaaS (VM) | Container orchestration, node-managed | Container orchestration, fully managed | Serverless container | Serverless function | Serverless PaaS |
| Scale-to-zero | No (unless stopped manually) | No | No (min 1 node typically) | Yes | Yes | Yes |
| Cold start | N/A (always running) | N/A for running pods | N/A for running pods | Fast (sub-second to low seconds) | Fast, similar to Cloud Run (Gen2) | Fast |
| Billing granularity | Per-second, per-instance | Per-node | Per-pod resource request | Per-request/per-100ms | Per-invocation/duration | Per-instance-hour (Standard) |
| Max request/task duration | Unbounded (long-running) | Unbounded | Unbounded | Up to 60 min (services) | Up to 60 min (Gen2, event-driven) | Varies by runtime, generally shorter |
| OS/kernel control | Full | Full (node level) | None | None | None | None |
| Custom hardware (GPU/TPU) | Yes | Yes (node pools) | Limited/supported subset | Limited GPU support | No | No |
| Stateful workload fit | Yes (with attached disks) | Yes (StatefulSets + PD) | Yes, more limited | No (stateless only) | No | No |
| Team ops burden | Highest (you patch everything) | High (node management) | Low (no node access) | Lowest | Lowest | Low |
| Best team-capability fit | Ops team wanting full control | Platform team, K8s expertise | App team, wants K8s API w/o ops | Any team, HTTP services | Any team, event handlers | Legacy PaaS-familiar team |
| IaC-friendliness | Excellent (Terraform MIGs) | Excellent (Terraform + Config Connector) | Excellent (Terraform) | Excellent (Terraform) | Excellent (Terraform) | Good |
| Canary/traffic-split support | Via LB backend weighting | Via Gateway API/Ingress weighting | Via Gateway API/Ingress weighting | Native (revisions) | Native (Gen2 versions) | Native (versions/traffic split) |
| Cost-model shape | Reserve capacity, pay whether idle or not (mitigated by CUDs/Spot) | Per-node, whether pods fully pack it or not | Per-pod request, no idle-node waste | Pure pay-per-use, scales to zero | Pure pay-per-use, scales to zero | Pay-per-instance-hour, autoscale-aware |
| Discount levers | Sustained-use (automatic), CUDs (1/3-yr), Spot/Preemptible (~60-91% off) | Node-pool CUDs/Spot node pools | None (Google absorbs bin-packing efficiency into price) | None (already pay-per-use) | None (already pay-per-use) | None (already pay-per-instance) |
| Networking model | Full VPC-native (any topology) | VPC-native pods, Services, NEGs | VPC-native, some network policy limits | VPC egress via connector/direct egress; ingress via managed URL or internal-only | Same as Cloud Run (Gen2 built on Cloud Run) | VPC connector for egress; ingress via managed URL |
| Identity/IAM binding model | SA attached at VM/instance-template level | Workload Identity (pod → GCP SA) | Workload Identity (pod → GCP SA) | Per-revision service identity; `run.invoker` gates who can call it | Per-function service identity; `cloudfunctions.invoker` gates callers | App Engine default SA (historically broad — see trap below) or custom SA |
| Monitoring/observability integration | Requires Ops Agent install for full metrics/logs; VM-level only by default | Google Cloud Managed Service for Prometheus, GKE dashboards, container/pod-level metrics | Same as Standard, less node-level metric surface (no node access) | Built-in request logs, latency/error metrics, Cloud Trace integration out of the box | Built-in invocation logs/metrics, Cloud Trace, per-trigger error counts | Built-in request logs and per-version metrics |
| Typical failure mode | VM crash/OOM (needs MIG health check + autohealing); disk full; noisy-neighbor on shared host | Pod crashloop; node memory/CPU pressure evictions; cluster autoscaler stalls on quota exhaustion | Pod crashloop; scheduling delay if requested resources are unusual shapes | Cold-start latency spikes under sudden traffic; concurrency exhaustion if `min instances` too low | Cold starts; retry storms on repeatedly-failing event triggers; timeout on unexpectedly long invocations | Instance-class too small → OOM; quota errors under burst traffic |
| Migration/adoption friction (into this option) | Low — closest match to on-prem VM shape | Medium-high — containerize first, then learn K8s object model | Medium-high — containerize, then reconcile workload against Autopilot's supported-configuration subset | Low-medium — containerize; refactor stateful assumptions out | Low — wrap single-purpose logic in the expected function signature | Medium — adapt to `app.yaml`, sandboxed runtime constraints |
| Multi-region pattern | Regional MIGs + Global LB | Multi-cluster (Multi Cluster Ingress) + Global LB | Same as Standard | Multi-region Cloud Run services behind Global LB | Multi-region deployment behind Global LB (less common pattern) | Multi-region App Engine deployment (limited — App Engine app has one region at creation) |
| Vendor/portability lock-in | Lowest (standard VM) | Low (portable K8s manifests) | Low (portable K8s manifests, minor Autopilot-specific constraints) | Medium (Knative-compatible spec, portable in principle) | Higher (function signature/trigger model is GCP-specific) | Highest (App Engine-specific `app.yaml`/runtime model) |
| Typical exam scenario fit | BYOL/licensing, custom kernel, lift-and-shift | Existing K8s investment, GPU/TPU node control | Reduce ops burden, keep K8s API | Spiky stateless HTTP, pay-per-use | Single-purpose event triggers | Legacy PaaS-era scenario framing |

## Tradeoff call-outs (paired, per CLAUDE.md §3 depth expectation)

- **Use GKE Standard when** the team has existing Kubernetes operational
  expertise and needs node-level control (custom machine types, GPU
  node pools, specific sysctls, DaemonSets, host networking). **Don't
  use it when** the scenario explicitly wants to minimize operational
  burden — that's the Autopilot signal, not Standard. **Edge case:**
  a scenario describing a *mixed* fleet — most workloads generic, one
  workload needing an unusual node taint/toleration or a DaemonSet for
  security tooling — is still a Standard signal even if 90% of the
  cluster would otherwise be Autopilot-friendly; Autopilot's supported-
  configuration subset doesn't stretch to cover every DaemonSet pattern.
- **Use GKE Autopilot when** the scenario wants Kubernetes's API/
  ecosystem without node management, and the workload profile is
  otherwise generic (standard container resource requests, no exotic
  networking). **Don't use it when** the workload needs a specific
  unsupported node configuration (some GPU configurations, certain
  DaemonSet or privileged-container patterns) — verify against current
  Autopilot support before assuming it fits every K8s use case. **Near-
  miss trap:** Autopilot vs. Cloud Run — both are "serverless-ish," but
  a scenario that says "we're standardizing on Kubernetes across the
  org" or mentions Kubernetes-specific primitives (Helm charts,
  operators, CRDs, service mesh) wants Autopilot even though it costs
  more per unit than Cloud Run would for the same stateless HTTP
  workload; the org-standardization language overrides raw cost.
- **Use Cloud Run when** the workload is stateless HTTP with variable/
  unpredictable traffic and the team wants zero infrastructure
  management. **Don't use it when** the workload is stateful, needs
  long-lived persistent connections beyond its request model, or needs
  full OS control. **Edge case:** Cloud Run *jobs* (not services) fit
  run-to-completion batch work without needing Cloud Functions' event
  model or Cloud Batch's HPC scheduling — a scenario describing a
  scheduled, containerized batch task with no HTTP endpoint at all is a
  Cloud Run jobs signal, not Cloud Functions.
- **Use Cloud Functions when** the unit of work is a single-purpose
  event handler reacting to one trigger type (Pub/Sub message, Cloud
  Storage object finalize, Firestore write). **Don't use it when** the
  scenario describes multiple coordinated responsibilities or custom
  routing — that's an application (Cloud Run/App Engine), not a
  function. **Near-miss trap:** Cloud Functions Gen2 vs. Cloud Run —
  Gen2 functions literally run on Cloud Run infrastructure now, so the
  real differentiator the exam is testing isn't capability, it's
  framing: a scenario phrased around "trigger" and "single event
  source" wants Functions (simpler deployment model, trigger-first
  configuration); a scenario phrased around "service," "API," or
  "multiple endpoints" wants Cloud Run even if the workload is small
  enough that either would technically run it.
- **Use Compute Engine when** the scenario states a licensing (BYOL),
  custom kernel/driver, or sole-tenancy requirement, or an HPC/batch
  workload that needs raw VM control at scale (paired with the Batch
  API — see below). **Don't use it when** nothing in the scenario
  requires VM-level control — every serverless/managed option above
  trades away unneeded control for reduced ops burden, which the exam
  consistently rewards absent a stated reason not to. **Edge case:** a
  scenario needing Spot VMs for a fault-tolerant batch workload (not
  latency-sensitive, can checkpoint/resume) is still a Compute Engine
  signal even though it looks "serverless-adjacent" — Spot economics
  only apply to Compute Engine and GKE Spot node pools, not to
  Cloud Run/Functions billing.
- **Use App Engine Standard when** the scenario is explicitly framed
  around App Engine's traffic-splitting/versions model already in use,
  or references a sandboxed-runtime PaaS with no container step at all.
  **Don't use it when** a greenfield scenario has no existing App
  Engine investment — Cloud Run is the more modern default answer for
  an equivalent workload shape today. **Security near-miss trap:** the
  App Engine default service account historically carries the broad
  `Editor` role on the project — a scenario asking "why does this App
  Engine app have more access than it needs" is testing whether you'd
  replace the default SA with a scoped custom service account, not
  whether you'd migrate off App Engine entirely.

### Cloud Batch — the HPC/batch-processing note

Cloud Batch isn't a separate abstraction tier in the matrix above — it's
a managed job-scheduling layer **on top of Compute Engine** (with
optional GKE-backed execution), so it doesn't replace the "VM vs.
container vs. serverless" decision, it answers a narrower one: "how do
I run a large batch of parallel, possibly Spot-priced, possibly
long-running compute jobs without hand-rolling a MIG-based queue
myself?" **Use it when** a scenario describes scientific computing,
rendering, genomics, or other embarrassingly-parallel batch workloads
that need job queuing/retries/scheduling semantics. **Don't reach for
Cloud Functions or Cloud Run jobs instead when** the batch has HPC-scale
parallelism or needs specific machine shapes (high-CPU, GPU) per job —
that's outside Cloud Run jobs' simpler execution model.

## Near-miss traps summary (side-by-side pairs the exam expects you to separate)

| Pair | What makes them look similar | The actual deciding signal |
|---|---|---|
| GKE Autopilot vs. Cloud Run | Both "serverless," both container-based, both scale automatically | Kubernetes-native primitives (Helm, operators, service mesh, org standardization on K8s) → Autopilot. Plain stateless HTTP with no K8s requirement → Cloud Run (cheaper, simpler) |
| Cloud Functions (Gen2) vs. Cloud Run (service) | Gen2 literally runs on Cloud Run infra; nearly identical limits | Trigger-first, single event source, minimal config → Functions. Multi-route service, HTTP-first, more endpoints → Cloud Run |
| GKE Standard vs. GKE Autopilot | Same Kubernetes API surface, same manifests mostly work | Node-level control/GPU-node-pool/DaemonSet/existing K8s ops team → Standard. Minimize ops burden, generic workloads → Autopilot |
| Compute Engine Spot VMs vs. Preemptible VMs | Both discounted, both reclaimable | Preemptible = legacy, historically capped at 24h; Spot = current generation, no fixed max runtime, is the exam-preferred term going forward — a scenario naming a specific historical runtime cap is signaling legacy Preemptible, not Spot |
| App Engine Standard vs. Cloud Run | Both "serverless," both scale to zero, both support traffic splitting/versions | Existing App Engine investment/`app.yaml` framing → App Engine. Greenfield, container-first, more portable → Cloud Run |
| Cloud Run jobs vs. Cloud Batch | Both run containerized, non-HTTP, finite work | Modest parallelism, simple containerized task, no special hardware → Cloud Run jobs. HPC-scale parallelism, GPU/specific machine shapes, job-array scheduling → Cloud Batch |

## Cost-model summary (relative, not absolute — for reasoning about scenario cost constraints)

```
Cheapest at low/spiky traffic         Cloud Functions / Cloud Run (pay per use, scale to zero)
                    │
Cheapest at steady, predictable load  Compute Engine w/ CUD, or GKE with reserved node pools
                    │
Most expensive per unit of compute,   GKE Autopilot (convenience premium over Standard)
but lowest ops cost
                    │
Highest total cost if mismanaged      Compute Engine without autoscaling/CUDs (idle capacity)
```

| Discount lever | Applies to | Commitment | Typical discount | Best-fit scenario cue |
|---|---|---|---|---|
| Sustained-use discount | Compute Engine (automatic) | None | Modest, automatic | No action needed — always-on baseline |
| Committed Use Discount (resource-based) | Compute Engine, GKE nodes | 1 or 3 years, specific machine family | Higher than sustained-use | Stable, known, unchanging fleet composition |
| Committed Use Discount (spend-based) | Compute Engine, GKE nodes | 1 or 3 years, dollar commitment | Similar tier to resource-based | Fleet composition expected to evolve over the commitment period |
| Spot VMs | Compute Engine, GKE Spot node pools | None (reclaimable) | ~60-91% off on-demand | Fault-tolerant, checkpointable, interruption-tolerant batch/analytics |
| Pay-per-use (no discount lever) | Cloud Run, Cloud Functions, App Engine Standard | None | N/A — already priced for elasticity | Spiky/unpredictable traffic where idle capacity would otherwise be wasted |

## Migration/adoption friction — moving between compute options

A recurring Domain 1.4/1.5 scenario shape: "we're currently running on
X, evaluate moving to Y." The friction is asymmetric — moving toward
more-managed options costs re-architecture effort but saves ops burden;
moving toward less-managed options is rare in the exam's framing (cloud
adoption trends one direction) but does appear when a scenario needs
capability the managed option can't offer.

| From → To | Friction driver | Typical effort | What breaks first |
|---|---|---|---|
| Compute Engine → GKE Standard | Containerizing the app; learning K8s objects | Medium-high | Anything reading local disk state assuming a single, stable VM |
| Compute Engine → Cloud Run | Containerizing + removing statefulness | Medium | Long-lived in-memory state, WebSocket-heavy patterns beyond Cloud Run's connection model |
| GKE Standard → GKE Autopilot | Reconciling manifests against Autopilot's supported-configuration subset | Low-medium | DaemonSets, host networking, some GPU configurations, privileged containers |
| App Engine Standard → Cloud Run | Wrapping the app in a container; replacing `app.yaml` config with service config | Medium | Runtime-specific App Engine APIs (legacy bundled services) with no direct Cloud Run equivalent |
| Cloud Functions (Gen1) → Cloud Functions (Gen2) | Mostly transparent — Gen2 is a superset | Low | 9-minute timeout assumptions baked into retry/monitoring logic |
| Monolith on Compute Engine → microservices on GKE/Cloud Run | Full decomposition, not just packaging | Highest | Implicit in-process calls that become network calls; this is a Refactor-tier migration (see `04-migration-strategies.md`), not a simple compute swap |

## Deployment security integration — Binary Authorization

Binary Authorization is a deploy-time policy control, not a compute
*platform* choice — it gates **which container images are allowed to
deploy** to GKE and Cloud Run based on attestations (e.g. "this image
passed the CI vulnerability scan," "this image was built by the
approved pipeline"). It applies naturally to the container-based options
in this matrix (GKE Standard, GKE Autopilot, Cloud Run, and Cloud
Functions Gen2 by extension since it runs on Cloud Run infrastructure)
and has no equivalent concept for Compute Engine or App Engine Standard,
whose deployment model isn't image-attestation-based in the same way.

- **Use Binary Authorization when** a scenario states a supply-chain
  security requirement — "only images that passed vulnerability
  scanning may run in production," "prevent an engineer from deploying
  an unreviewed image directly to the cluster." **Don't use it as the
  answer when** the concern is *runtime* access control (who can call
  the service) — that's the `run.invoker`/`cloudfunctions.invoker` IAM
  binding, a different control layer entirely (see
  `06-iam-security-models.md` for the general "which layer restricts
  this" reasoning applied to security controls broadly).
- **Confidence note:** Binary Authorization's general mechanism (image
  attestation → policy → deploy-time enforcement) is a stable, long-
  standing GCP capability; its specific inclusion in the 2026 exam
  guide's explicit scope was identified via the folder's secondary-
  source gap-remediation pass (see `00-START-HERE/RUNBOOK.md` §6-§7) —
  treat the mechanism as solid and the "is this exam-tested by name"
  framing as reasonable-confidence rather than independently verified
  against the primary guide PDF.

## Quotas and default limits worth knowing (order-of-magnitude, not exact)

Exam questions rarely ask for an exact quota number, but scenario
framing like "we're hitting a wall scaling past N" is testing whether
you recognize *which* option's limits are being described, not whether
you've memorized the digit.

| Option | What typically caps scale first | Fix |
|---|---|---|
| Compute Engine (single VM) | vCPU/RAM ceiling of the largest machine type in the family | Switch machine family, or horizontal-scale via a MIG instead of vertical-scaling one VM |
| Compute Engine (MIG) | Regional CPU quota (default project quota, raisable via support request) | Request a quota increase, or spread across more regions |
| GKE (Standard) | Node pool size / cluster autoscaler max-node setting | Raise the max, or add another node pool |
| GKE (Autopilot) | Per-namespace/per-project pod resource quotas | Request higher quota; Autopilot itself scales nodes invisibly |
| Cloud Run | Max instances setting (you set this deliberately, often as a cost/blast-radius guard) | Raise `max instances`, verify downstream dependencies (DB connections) can absorb the new ceiling |
| Cloud Functions | Concurrent executions per function (project-level quota) | Request increase, or shift high-throughput paths to Cloud Run for finer concurrency control |
| App Engine Standard | Instance class size and max instances setting | Raise instance class or max instances; watch for quota errors as the first symptom, not a clean autoscale |

## "Given this constraint in the scenario, which compute option?" quick reference

```
"Custom kernel module / BYOL Windows Server licensing"        → Compute Engine
"Team already runs Kubernetes, wants GPU node pools"           → GKE Standard
"Want Kubernetes API, minimize ops burden, generic workloads"  → GKE Autopilot
"Stateless HTTP API, spiky/unknown traffic, pay per use"       → Cloud Run
"React to a single Cloud Storage upload event"                 → Cloud Functions (Gen2)
"Legacy PaaS app already using app.yaml/traffic-splitting"     → App Engine Standard
"Batch job, HPC-scale parallelism, specific machine shapes"    → Compute Engine + Cloud Batch
"Fault-tolerant analytics job, can restart from checkpoint"    → Spot VMs (Compute Engine or GKE)
"Needs sole-tenant physical isolation for compliance"          → Compute Engine (sole-tenant nodes)
"Needs to eliminate cold starts for a latency-SLA service"     → Cloud Run with min instances > 0
"CPU-bound work needing background processing after response"  → Cloud Run, CPU always allocated
"Training/serving an ML model specifically"                    → Vertex AI (see 02-services/01-compute.md)
"Multiple coordinated responsibilities, not a single trigger"  → Cloud Run or App Engine, not Functions
"Org standardizing all workloads on one platform, K8s-native"  → GKE (Standard or Autopilot per ops-burden signal)
```

## Worked scenario walkthroughs

**Scenario A — Mountkirk Games, new title launch.** "A new multiplayer
game launches globally next month; traffic is unpredictable and could
spike 50x during a viral moment; the team wants to avoid managing
servers." Reasoning: scale-to-zero and rapid scale-up rule out Compute
Engine (provisioning/boot lag) and GKE Standard (node-pool scale-up lag
under a sudden 50x spike); "avoid managing servers" rules out GKE
Standard's node management burden even if Autopilot could technically
absorb the spike. If the workload is stateless HTTP (matchmaking API,
leaderboard writes) → **Cloud Run**, paired with **Memorystore** for the
leaderboard cache (see `02-storage-database-options.md`). If the
workload needs actual game-server processes with persistent per-match
state → that's a different pattern (GKE with specialized game-server
tooling), a signal the scenario would need to state explicitly, not
assume.

**Scenario B — TerramEarth, telemetry ingestion.** "~2 million connected
vehicles report telemetry; the existing on-prem system is a fleet of
manually managed servers processing messages in batches every hour; the
team wants to modernize ingestion without a full application rewrite in
the next migration wave." Reasoning: "without a full rewrite" pushes
away from a Refactor-tier move to GKE microservices; the actual compute
question here is really about the *ingestion* tier (Pub/Sub → a
consumer), and the consumer is a good Cloud Run or Cloud Functions fit
if it's stateless per-message processing — Cloud Functions if it's one
single-purpose handler per message type, Cloud Run if the processing
logic has grown into a small service with multiple responsibilities.
The "modernize without a full rewrite" framing is a Replatform signal
(see `04-migration-strategies.md`), which maps to swapping the
hand-managed batch servers for a managed, event-driven compute option —
not a GKE re-architecture.

**Scenario C — EHR Healthcare, compliance-constrained legacy app.** "A
regulated clinical application currently runs on on-prem VMware, uses a
proprietary licensed database driver tied to specific OS kernel modules,
and must maintain its existing OS patching cadence for a validated
compliance posture." Reasoning: kernel-module/driver licensing is the
explicit Compute Engine signal — no managed/serverless option grants
kernel-level control. Sole-tenant nodes are worth flagging if the
scenario also mentions per-tenant physical isolation as part of the
compliance requirement (a common EHR Healthcare case-study thread, see
`04-architectures/case-study-ehr-healthcare.md`). The trap here is
assuming "regulated/compliance-heavy" automatically means "harder to
migrate to a serverless option" — the actual disqualifying detail is
the *kernel-module* requirement specifically, not the compliance
framing in general; a regulated app with no OS-level dependency would
still be a legitimate Cloud Run/GKE candidate.
