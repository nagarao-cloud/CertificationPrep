# Agent Hosting: Agent Runtime vs. Cloud Run vs. GKE

**Exam mapping:** Task 4.2 ("Deploying and scaling production
workloads"), specifically: "Selecting optimal deployment runtime based
on the use case, requirements, and cost (e.g., **Agent Runtime, Cloud
Run, and GKE**)." All three are verbatim from the guide's task 4.2
bullet and all three also appear on the 23-item in-scope tool list.
**Agent Runtime** is the current name for this managed runtime — the
guide's own in-scope list writes it as "Agent Runtime (formerly Agent
Engine)"; never lead with "Agent Engine" on this exam.

Note a second, narrower appearance of GKE in the guide: task 2.1 lists
GKE as one of several **secure sandboxes for coding agents** ("Using
coding agents in secure sandboxes [e.g., Google Kubernetes Engine (GKE),
Cloud Workstations, and Antigravity]"). That is a *development-time*
sandbox use of GKE, distinct from the *production deployment target*
comparison this file covers under task 4.2 — don't conflate the two
when a question specifies which context it means.

## 1. What each option is

- **Agent Runtime (formerly Agent Engine).** The purpose-built, managed
  runtime for deploying agents named in the guide's in-scope tool list.
  As the managed option purpose-built for agent workloads, it's the
  deployment target most directly aligned with agent-specific concerns
  named elsewhere in the guide — sessions/managed sessions (task 3.1),
  multi-agent coordination via Agent Identity/Agent Registry (task 3.3),
  and the governance surface in Section 5.
- **Cloud Run.** Google Cloud's serverless container platform, in scope
  as a deployment runtime option for agent workloads under task 4.2.
  Serverless: you deploy a container, it scales on request volume
  (including to zero), and you don't manage the underlying
  infrastructure.
- **GKE (Google Kubernetes Engine).** Managed Kubernetes, in scope both
  as a production deployment runtime (task 4.2) and — separately — as a
  secure sandbox for coding agents during development (task 2.1). As a
  production target, GKE gives you full control over the container
  orchestration layer: custom networking, node pools, GPU/accelerator
  scheduling, and fine-grained scaling policies, at the cost of managing
  that orchestration layer yourself.

## 2. Head-to-head comparison table

| Dimension | Agent Runtime | Cloud Run | GKE |
|---|---|---|---|
| Exam task | 4.2 | 4.2 | 4.2 (production); also 2.1 (dev sandbox, separate context) |
| Management model | Fully managed, purpose-built for agents | Fully managed, serverless containers | Managed control plane; you manage workloads/node pools |
| What you deploy | Agent built with ADK / agent logic against the managed runtime's interfaces | Any container | Any container, with full orchestration control |
| Scaling model | Managed scaling tuned for agent workloads (concurrent sessions, agent invocations) | Request-driven autoscaling, scale-to-zero | Full custom control — HPA/VPA, cluster autoscaler, custom scaling policies |
| Cold start | Managed by the platform | Present, generally low, but real (a factor for scale-to-zero) | None if nodes/pods are kept warm; you control this tradeoff directly |
| Infrastructure control | Lowest — you don't manage servers or clusters | Low — container-level control only | Highest — full control over networking, node types, GPUs, custom schedulers |
| Session/state alignment | Purpose-built to align with agent session/memory concerns (task 3.1's managed sessions, Memory Bank) | Generic — session/state handling is your responsibility to wire | Generic — session/state handling is your responsibility to wire |
| Ops overhead | Lowest | Low | Highest — you own cluster upgrades, node management, capacity planning |
| Cost model | Managed-service pricing, tuned to agent invocation patterns | Pay-per-request/compute-time, scale-to-zero saves idle cost | Pay for provisioned cluster capacity (plus autoscaling); can be cheaper at sustained high scale, more expensive at low/spiky scale unless carefully tuned |
| Best for | Agent-specific production workloads where you want the platform's native agent lifecycle handling (sessions, coordination hooks) with minimal ops | General-purpose containerized agent workloads with variable/spiky traffic and no need for custom orchestration | Workloads needing custom networking, GPU/accelerator scheduling, multi-tenant isolation, or orchestration control beyond what a managed platform exposes; also the sandboxed dev/test environment for coding agents (task 2.1) |
| Governance/observability fit | Integrates with Agent Identity, Agent Registry, Agent Gateway as the "native" runtime | Standard Cloud Run + Cloud Logging/Cloud Trace observability, agent-specific hooks wired manually | Standard GKE + Cloud Logging/Cloud Trace observability, agent-specific hooks wired manually, but most flexible for custom governance sidecars/service mesh |

## 3. Decision tree

```
              Choosing a production deployment target for an agent
                                   |
        Does the workload need custom infrastructure control —
        GPU/accelerator scheduling, custom networking, multi-tenant
        cluster isolation, or orchestration beyond what a managed
        platform exposes?
                                   |
                +-------------------+-------------------+
               YES                                       NO
                |                                         |
                v                                Do you want the platform
          Use GKE                                purpose-built for agent
          (full control,                         lifecycle concerns —
          highest ops                            sessions, memory, agent
          overhead, task 4.2)                     coordination hooks — with
                                                   minimal ops overhead?
                                                            |
                                              +---------------+---------------+
                                             YES                              NO
                                              |                                |
                                              v                                v
                                     Use Agent Runtime               Is traffic variable/
                                     (managed, agent-native,          spiky, and is a plain
                                     lowest ops overhead)             container deployment
                                                                       (no agent-native
                                                                       features needed) fine?
                                                                                |
                                                                         +-------+-------+
                                                                        YES              NO
                                                                         |                |
                                                                         v                v
                                                                   Use Cloud Run    Re-evaluate — likely
                                                                   (serverless,     Agent Runtime or GKE
                                                                   scale-to-zero,   depending on the
                                                                   low ops)         control need above
```

## 4. Tradeoff writeups

### Use Agent Runtime when...
- The workload is an agent (built with ADK or otherwise) and you want
  the deployment platform to natively understand agent-specific
  lifecycle concerns — managed sessions, Memory Bank-backed memory (task
  3.1), and integration points with Agent Identity/Agent Registry/Agent
  Gateway (Sections 3 and 5) — without hand-wiring that plumbing
  yourself.
- Minimizing operational overhead is a priority and the workload doesn't
  need infrastructure-level customization Cloud Run or GKE would offer.
- The exam scenario is agent-specific and doesn't call out a generic
  containerized-service need — Agent Runtime is the option purpose-built
  for exactly this exam's subject matter.

### Don't use Agent Runtime when...
- The workload needs infrastructure control Agent Runtime as a managed
  platform doesn't expose — custom networking topologies, GPU scheduling
  for a specific accelerator shape, or multi-tenant cluster isolation.
  That's GKE's job.
- The workload isn't really agent-specific at all — a generic
  containerized microservice with no session/memory/agent-coordination
  needs doesn't benefit from an agent-native platform's extra surface
  area; a simpler serverless container (Cloud Run) may fit better and
  cost less operationally to reason about.

### Use Cloud Run when...
- The workload is a containerized agent service with variable or spiky
  traffic, and scale-to-zero economics matter (no traffic, no cost).
- You want serverless simplicity — no cluster to manage — but don't
  need the agent-native lifecycle features Agent Runtime is purpose-built
  for, or you're deploying a component of the system that isn't itself
  the "agent" (e.g., a supporting API, a webhook receiver, an MCP
  server implementation).
- Cost efficiency at variable load is a bigger driver than deep
  infrastructure customization.

### Don't use Cloud Run when...
- The agent needs the session/memory/coordination features Agent
  Runtime provides natively — using Cloud Run means building those
  yourself on top of a generic container platform.
- The workload needs GPU/accelerator access, custom networking, or
  fine-grained orchestration control Cloud Run's serverless model
  doesn't expose — that pushes you to GKE.
- Sustained, high, predictable load makes always-on GKE capacity more
  cost-effective than continuously-scaling serverless billing (workload-
  dependent — verify against actual traffic shape, not by default
  assumption).

### Use GKE when...
- The production workload needs infrastructure control beyond what
  either managed option exposes — custom node pools, GPU/TPU scheduling
  for specific model-serving needs, custom networking/service mesh, or
  multi-tenant isolation requirements.
- The team already operates Kubernetes and wants a single orchestration
  layer across agent and non-agent workloads.
- Separately (task 2.1, a different context): the workload is a coding
  agent that needs a **secure sandbox** for development — GKE is named
  alongside Cloud Workstations and Antigravity for that purpose. This is
  a dev-time isolation use case, not the production-hosting decision
  this comparison otherwise covers.

### Don't use GKE when...
- The team doesn't want to own cluster operations (upgrades, node
  management, capacity planning) — GKE has the highest ops overhead of
  the three, and that overhead is a real cost even though the control
  plane itself is managed.
- The workload doesn't actually need the infrastructure control GKE
  provides — reaching for GKE by default when Agent Runtime or Cloud
  Run would satisfy the requirement is over-engineering exactly the kind
  of unnecessary complexity task 4.2's "based on the use case,
  requirements, and cost" framing warns against.

## 5. Troubleshooting and monitoring — a shared concern across all three

Task 4.2 also covers "Troubleshooting agent issues (e.g., drift, tool
invocation latency, agent reasoning loops, and system failures)" and
"Monitoring and optimizing agents for performance, reliability, and cost
(e.g., identify logic errors, latency bottlenecks, and hallucinations)."
These apply regardless of which runtime you pick — Google Cloud
Observability (Cloud Logging and Cloud Trace) is the in-scope tooling
for all three deployment targets. What differs is *how much of the
observability wiring is done for you*: Agent Runtime, being agent-
native, is positioned to have more agent-specific signals available with
less manual instrumentation than a generic Cloud Run or GKE deployment,
where you'd wire tracing/logging around agent reasoning loops and tool
calls yourself.

## 6. Exam traps to watch for

- Don't pick GKE just because a scenario mentions "coding agent" and
  "sandbox" together — check whether the question is asking about
  task 2.1 (dev-time sandbox for a coding agent) or task 4.2 (production
  deployment target for an agent workload). Same tool, different task,
  different reasoning.
- Never write "Agent Engine" for the managed runtime — the guide's own
  in-scope list is explicit: "Agent Runtime (formerly Agent Engine)."
- Don't assume "managed" always means "cheapest" or "fully-featured for
  free" — task 4.2 explicitly frames the choice as "based on the use
  case, requirements, and cost," meaning cost is a real, scenario-
  dependent variable, not a fixed ranking across the three options.
- A scenario emphasizing GPU/accelerator needs, custom networking, or
  multi-tenant isolation is pointing at GKE, not Agent Runtime or Cloud
  Run, regardless of how "agentic" the workload sounds.
