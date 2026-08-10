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
| Typical exam scenario fit | BYOL/licensing, custom kernel, lift-and-shift | Existing K8s investment, GPU/TPU node control | Reduce ops burden, keep K8s API | Spiky stateless HTTP, pay-per-use | Single-purpose event triggers | Legacy PaaS-era scenario framing |

## Tradeoff call-outs (paired, per CLAUDE.md §3 depth expectation)

- **Use GKE Standard when** the team has existing Kubernetes operational
  expertise and needs node-level control (custom machine types, GPU
  node pools, specific sysctls). **Don't use it when** the scenario
  explicitly wants to minimize operational burden — that's the
  Autopilot signal, not Standard.
- **Use GKE Autopilot when** the scenario wants Kubernetes's API/
  ecosystem without node management. **Don't use it when** the workload
  needs a specific unsupported node configuration (some GPU
  configurations, certain DaemonSet patterns) — verify against current
  Autopilot support before assuming it fits every K8s use case.
- **Use Cloud Run when** the workload is stateless HTTP with variable/
  unpredictable traffic and the team wants zero infrastructure
  management. **Don't use it when** the workload is stateful, needs
  long-lived persistent connections beyond its request model, or needs
  full OS control.
- **Use Cloud Functions when** the unit of work is a single-purpose
  event handler. **Don't use it when** the scenario describes multiple
  coordinated responsibilities or custom routing — that's an
  application (Cloud Run/App Engine), not a function.
- **Use Compute Engine when** the scenario states a licensing (BYOL),
  custom kernel/driver, or sole-tenancy requirement. **Don't use it
  when** nothing in the scenario requires VM-level control — every
  serverless/managed option above trades away unneeded control for
  reduced ops burden, which the exam consistently rewards absent a
  stated reason not to.
- **Use App Engine Standard when** the scenario is explicitly framed
  around App Engine's traffic-splitting/versions model already in use.
  **Don't use it when** a greenfield scenario has no existing App
  Engine investment — Cloud Run is the more modern default answer for
  an equivalent workload shape today.

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
