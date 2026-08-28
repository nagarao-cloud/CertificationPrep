# 02-services — Orchestration, Identity & Protocols

> **Covers (exam-guide §6 in-scope items):** Agent Registry · Agent
> Runtime (formerly Agent Engine) · Agentic protocols (A2A, MCP) ·
> Model Context Protocol (MCP) servers, specifically **Google Cloud MCP
> Servers**.
>
> **Agent Identity** is named in task 3.3 alongside these tools, but
> its **full reference entry lives in `06-security-governance.md`**
> (where task 5.1's principal access boundary [PAB] language anchors
> it). This file cross-references Agent Identity where orchestration
> needs it (multi-agent trust/identity propagation) without duplicating
> the full writeup — see §5 below.
>
> **Primary exam tasks supported:** 3.3 (Orchestrating and coordinating
> agentic workflows) — part of Section 3, ~33% of the exam.
>
> **Currency reminder:** this file says **Agent Runtime**, never "Agent
> Engine," except to note the rename explicitly.

---

## 1. Why this file exists

Task 3.1 (file `03-adk-custom-development.md`) covers building **one**
custom agent. Task 3.3 is about what happens when you have **more than
one** agent, or one agent that needs to call tools/other services in a
standardized way — orchestration and coordination. Two distinct kinds
of "talking to something else" are in scope, and the exam expects you
to keep them separate:

```
A2A (Agent2Agent)     → agent talks to another agent (peer-to-peer, handoff, delegation)
MCP (Model Context     → agent talks to a tool/data source (standardized tool-calling)
     Protocol)
```

On top of the protocols, three platform-level tools make orchestration
governable and discoverable at scale: **Agent Registry** (find/catalog
agents and capabilities), **Agent Runtime** (where the agents actually
run), and **Agent Identity** (who each agent is allowed to act as —
full treatment in `06-security-governance.md`).

---

## 2. Agentic protocols — Agent2Agent (A2A) and Model Context Protocol (MCP)

**What they are.** Two open, standardized protocols named together in
task 3.3: "Orchestrating agents using agentic protocols (e.g., MCP and
Agent2Agent [A2A])." They solve *different* communication problems and
are not substitutes for each other.

- **A2A (Agent2Agent)**: a protocol for **agent-to-agent**
  communication — one agent delegating a sub-task to another agent,
  requesting a peer agent's capability, or coordinating a handoff in a
  multi-agent workflow. A2A is what lets agents built by different
  teams (or even different vendors) interoperate as peers rather than
  requiring one team's agent to hard-code integration logic against
  another team's internal API.
- **MCP (Model Context Protocol)**: a protocol for **agent-to-tool**
  communication — a standardized way for an agent to discover and call
  tools/data sources (a database, a SaaS API, an internal service)
  without a bespoke integration per tool. MCP is also its own in-scope
  item beyond the "agentic protocols" bullet (see §3, Google Cloud MCP
  Servers) because it's specifically named again in task 3.2's tooling
  list.

**Problem each solves.** Without a standard protocol, every agent-to-
agent handoff and every agent-to-tool integration is bespoke,
point-to-point glue code — brittle, and it doesn't scale as the number
of agents and tools grows. A2A standardizes the *agent-to-agent* side
of that graph; MCP standardizes the *agent-to-tool* side.

**How they're used — task 3.3 considerations:**
- **Selecting and coordinating multi-agent handoffs and workflows**:
  parallel agents (multiple agents working concurrently on independent
  sub-tasks), sequential agents (a pipeline where one agent's output
  feeds the next), and graph workflows (non-linear coordination with
  conditional branches/loops between agents) — coordinated "using
  Google Cloud tools (e.g., Agent Identity, Agent Registry, Agent
  Runtime, and agent policies)."

**Task cross-reference.** 3.3, directly — both protocols, plus the
parallel/sequential/graph workflow-shape language.

**Decision note — A2A vs. MCP.** Ask "is the other side of this
connection an agent, or a tool?" If an agent needs another agent's
reasoning/capability (delegate a sub-task, request a specialized
agent's help, hand off a conversation), that's A2A. If an agent needs
to call a database, an API, or any non-agent capability, that's MCP.
A single multi-agent system typically uses **both**: A2A between the
agents themselves, MCP from each agent out to its tools.

**Decision note — parallel vs. sequential vs. graph workflows.**
Choose **parallel** when sub-tasks are independent and can run
concurrently without needing each other's output (e.g., three agents
each researching a different topic simultaneously). Choose
**sequential** when each step genuinely depends on the previous step's
output (a pipeline: extract → validate → summarize). Choose a **graph
workflow** when the coordination isn't a straight line — conditional
branching (route to a different agent based on a classification),
loops (retry/refine cycles), or a mix of parallel and sequential
sub-sections. A scenario describing conditional routing or retry logic
between agents is a graph-workflow signal, not a sequential one.

---

## 3. Google Cloud MCP Servers

**What it is.** Google-provided MCP servers that connect agents to
Google Cloud services and, per task 3.2's wording, to "third-party
SaaS tools and remote servers" as well — pre-built MCP endpoints so an
agent doesn't need a custom integration written for every Google Cloud
service or common external tool it needs to call.

**Problem it solves.** Even with MCP as a standard protocol, someone
still has to implement an MCP server for each tool/service being
exposed. Google Cloud MCP Servers are the pre-built, Google-maintained
implementations for Google Cloud's own services (and common third-party
integrations), so a developer wiring an ADK agent to, say, a managed
database or an internal API doesn't have to hand-write that MCP server
from scratch.

**How it's configured — verbatim task 3.2 wording:** "Using Google
Cloud tools (e.g., Agent Registry, Google Cloud MCP Servers) to
configure prebuilt and custom capabilities (e.g., custom integration
layers for managed databases, API integrations, and MCP server that
connects agents to third-party SaaS tools and remote servers)."

**Task cross-reference.** 3.2 (prebuilt/custom capability integration
— note this places Google Cloud MCP Servers under task 3.2's
"integrating enterprise domain knowledge" umbrella, not only 3.3's
orchestration umbrella, since MCP is also how an agent reaches the data
layer in `07-data-services.md`), 3.3 (as part of the broader "agentic
protocols" bullet).

---

## 4. Agent Registry

**What it is.** A capability/tool registry for agents — a catalog where
agents, their capabilities, and available tools/skills can be
registered and discovered, named in both task 3.2 ("Using Google Cloud
tools (e.g., Agent Registry...)") and task 3.3 ("coordinating
multi-agent handoffs and workflows... using Google Cloud tools (e.g.,
Agent Identity, Agent Registry, Agent Runtime, and agent policies)").
Also named in Section 5's governance tasks (5.1, 5.2) — see
`06-security-governance.md` for that governance-facing role.

**Problem it solves.** In a system with many agents and many tools, an
orchestrating agent (or a human architect) needs a way to discover
*what capabilities exist* before it can decide how to route a task —
without Agent Registry, capability discovery becomes tribal knowledge
or hard-coded lookup tables that go stale as the agent population
grows.

**How it's used.** Agents and their capabilities are registered into
Agent Registry; an orchestrating agent (or the platform coordinating a
multi-agent workflow) queries it to find the right agent/tool for a
given sub-task, supporting the parallel/sequential/graph handoff
patterns in §2.

**Task cross-reference.** 3.2, 3.3, 5.1, 5.2 — this tool spans both the
orchestration and the governance sides of the exam, which is why it's
named repeatedly across sections. This file covers its orchestration/
discovery role; `06-security-governance.md` covers its role in policy
enforcement and identity propagation.

---

## 5. Agent Runtime (formerly Agent Engine)

**What it is.** The managed deployment/runtime environment for agents.
**Currency correction: this is "Agent Runtime," never "Agent Engine"**
— the exam guide's own in-scope tool list names it "Agent Runtime
(formerly Agent Engine)." "Agent Engine" is the retired name; expect it
in older material and web-search results, but answer with the current
name.

**Problem it solves.** An agent built with ADK needs somewhere to
actually run in production — a managed environment that handles
scaling, availability, and the operational concerns of serving agent
traffic, without the team building/operating raw compute themselves.
Agent Runtime is that managed hosting layer, named in task 3.3
alongside Agent Identity and Agent Registry as one of the "Google Cloud
tools" multi-agent workflows are coordinated with, and again in task
4.2 as a deployment-target option (full deployment-selection treatment,
including its comparison against Cloud Run and GKE, is in
`05-evaluation-deployment.md`).

**How it's used (orchestration angle, this file's scope).** In a
multi-agent system, Agent Runtime is where the individual agents in a
parallel/sequential/graph workflow actually execute — the orchestration
logic (via A2A, Agent Registry lookups) coordinates *what* happens, and
Agent Runtime is *where* each participating agent's execution actually
happens.

**Task cross-reference.** 3.3 (coordination-tool list), 4.2 (deployment
runtime selection — see `05-evaluation-deployment.md` for the full
Agent Runtime vs. Cloud Run vs. GKE decision).

---

## 6. Agent Identity — cross-reference note

**Agent Identity's full reference entry is in
`06-security-governance.md`** (anchored by task 5.1's principal access
boundary [PAB] configuration language, which is where the exam guide
gives it its most detailed treatment). It appears in this file's task-
3.3 source bullet too — "coordinating multi-agent handoffs and
workflows... using Google Cloud tools (e.g., **Agent Identity**, Agent
Registry, Agent Runtime, and agent policies)" — because multi-agent
orchestration needs each participating agent to have a verifiable
identity: when Agent A hands a task to Agent B via A2A, or when an
orchestrator calls into Agent Runtime to invoke a specific agent
instance, that call needs to carry (and have verified) *whose*
identity/permissions it's acting under. Read Agent Identity's role here
as "the identity layer that makes A2A handoffs and Agent Registry
lookups trustworthy," and read `06-security-governance.md` for its
full PAB-configuration treatment.

---

## 7. How these tools fit together

```
                      ┌───────────────────────────────┐
                      │          Agent Registry           │
                      │  catalog: which agents/tools exist,│
                      │  what capabilities they expose      │
                      └────────────┬────────────────────┘
                                   │ (1) discovery / lookup
                                   ▼
     ┌─────────────────────────────────────────────────────────────┐
     │                    Orchestrating agent                        │
     │        decides: parallel / sequential / graph workflow          │
     └───────┬───────────────────────────────────────┬─────────────┘
             │ (2) A2A: delegate to / hand off to        │ (3) MCP: call a tool
             ▼      another agent (peer identity            ▼
  ┌─────────────────────────┐  checked via Agent    ┌──────────────────────────┐
  │   Sub-agent / peer agent   │  Identity — see file    │   Google Cloud MCP Servers │
  │   (running on Agent         │  06)                     │  (GCP services, third-      │
  │    Runtime)                  │                          │   party SaaS, remote servers)│
  └───────────┬─────────────┘                          └──────────────┬───────────┘
             │ (4) sub-agent's own tool calls, same MCP pattern         │
             ▼                                                        ▼
     ┌──────────────────────────┐                        [ managed DB / API / SaaS / ]
     │       Agent Runtime         │                        [   remote server         ]
     │  hosts the running agent     │
     │  instances for this workflow  │
     └──────────────────────────┘
```

**Arrow-by-arrow:**
1. Before routing work, the orchestrating agent (or the human/platform
   configuring the workflow) queries Agent Registry to discover which
   agents and tool capabilities are available for the task at hand.
2. For a sub-task that needs another agent's reasoning or specialized
   capability, the orchestrator hands off via **A2A** — this handoff
   carries an identity the receiving agent (and the platform) can
   verify, which is Agent Identity's role (`06-security-governance.md`).
3. For a sub-task that needs a tool or data source rather than another
   agent, the orchestrator (or any agent in the workflow) calls out via
   **MCP** — in this diagram, specifically to a Google Cloud MCP Server
   fronting a managed database, an API, or a third-party SaaS tool.
4. A sub-agent receiving an A2A handoff can itself make its own MCP
   tool calls — the pattern is recursive, which is exactly what enables
   graph-shaped, not just linear, multi-agent workflows.
   Throughout, the actual compute for every participating agent
   instance — orchestrator and sub-agents alike — is hosted on **Agent
   Runtime**.

---

## 8. Quick-reference table

| Tool/protocol | What it connects | Primary task | Don't confuse with |
|---|---|---|---|
| A2A (Agent2Agent) | Agent ↔ agent | 3.3 | MCP (agent ↔ tool, not agent ↔ agent) |
| MCP (protocol) | Agent ↔ tool/data source | 3.2, 3.3 | A2A (agent ↔ agent, not agent ↔ tool) |
| Google Cloud MCP Servers | Agent ↔ GCP services/third-party SaaS/remote servers | 3.2 | The MCP protocol itself (this is a set of pre-built server implementations *of* that protocol) |
| Agent Registry | Discovery/catalog of agents & capabilities | 3.2, 3.3, 5.1, 5.2 | Agent Runtime (hosts execution; Registry only catalogs/discovers) |
| Agent Runtime | Managed hosting/execution for agents | 3.3, 4.2 | "Agent Engine" (retired name) |
| Agent Identity | Identity/permissions for agents (full entry in file 06) | 3.3, 5.1, 5.2 | A generic IAM concept — it's the specific PAB-configuring mechanism |

---

## 9. Exam traps specific to this file

- Writing "Agent Engine" anywhere as the current name for the managed
  runtime — the guide's own list says "Agent Runtime (formerly Agent
  Engine)."
- Treating A2A and MCP as interchangeable or as competing choices for
  the same connection — A2A is agent-to-agent, MCP is agent-to-tool;
  a real system typically uses both, for different edges in the graph.
- Assuming "Google Cloud MCP Servers" *is* the MCP protocol — it's a
  specific set of Google-provided server implementations *of* the
  protocol, not the protocol itself.
- Assuming a sequential pipeline is always the right shape for
  multi-agent coordination — a scenario with conditional branching or
  retry/refine loops between agents is a graph-workflow signal, and one
  with independent concurrent sub-tasks is a parallel signal.
- Writing a full Agent Identity section in this file instead of
  treating it as a cross-reference — its complete reference entry
  belongs in `06-security-governance.md`, anchored by PAB.
