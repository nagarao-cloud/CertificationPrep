# A2A vs. MCP vs. Direct/Custom Integration

**Exam mapping:** Task 3.2 ("Using Google Cloud tools [e.g., Agent
Registry, Google Cloud MCP Servers] to configure prebuilt and custom
capabilities [e.g., custom integration layers for managed databases, API
integrations, and MCP server that connects agents to third-party SaaS
tools and remote servers]") and Task 3.3 ("Orchestrating agents using
agentic protocols [e.g., MCP and Agent2Agent (A2A)]"). Both **A2A** and
**MCP** appear on the guide's 23-item in-scope tool list verbatim as
"Agentic protocols (e.g., Agent2Agent [A2A], MCP)" and again separately
as "Model Context Protocol (MCP) servers" — the guide treats these as
two distinct, named protocols, not synonyms, and expects you to know
which problem each one solves.

## 1. What problem each one solves

- **A2A (Agent2Agent protocol).** Solves **agent-to-agent**
  communication — how one autonomous agent hands off work to, or
  coordinates with, another autonomous agent. This is the protocol layer
  underneath multi-agent orchestration patterns (parallel, sequential,
  graph workflow — task 3.3): when agent A needs agent B to do part of
  the work, A2A is how that handoff is expressed and executed.
- **MCP (Model Context Protocol).** Solves **agent-to-tool/data**
  connectivity — how an agent discovers and calls external capabilities:
  APIs, databases, third-party SaaS tools, remote servers. Per task 3.2,
  an MCP server is explicitly described as something that "connects
  agents to third-party SaaS tools and remote servers." Google Cloud MCP
  Servers are the Google-provided implementations of this pattern for
  Google Cloud services and data.
- **Direct/custom integration.** No standardized protocol at all — a
  hand-written integration layer, called out explicitly in task 3.2 as
  "custom integration layers for managed databases" and "API
  integrations." This is what you build when neither A2A nor MCP fits:
  a bespoke internal API, a database driver call, or any point-to-point
  connection that doesn't need (or doesn't yet have) a standardized
  protocol wrapper.

The dividing line to hold onto: **A2A is agent ↔ agent. MCP is agent ↔
tool/data. Direct/custom integration is the fallback for either
direction when a standardized protocol isn't available, isn't needed, or
adds more overhead than value.**

## 2. Head-to-head comparison table

| Dimension | A2A (Agent2Agent) | MCP (Model Context Protocol) | Direct / custom integration |
|---|---|---|---|
| Exam task | 3.3 | 3.2, 3.3 | 3.2 |
| What it connects | Agent to agent | Agent to tool / data source / external server | Anything — point-to-point, no standard shape |
| Direction of problem | Coordination and handoff between autonomous agents | Discovery and invocation of external capabilities | Whatever the custom code implements |
| Standardization | Standardized agentic protocol | Standardized protocol; Google Cloud MCP Servers are Google's managed implementations | None — bespoke per integration |
| Discovery mechanism | Works with Agent Registry to discover callable agents/capabilities | MCP servers expose tools/capabilities an agent can discover and call | No standardized discovery — the integration is hardcoded to the target |
| Reusability | High — any A2A-compliant agent can be a caller or callee | High — any MCP-compliant client can use any MCP server | Low — tied to the specific system it was written for |
| Typical example | Orchestrator agent hands a sub-task to a specialist agent (task 3.3 patterns) | Agent queries a Cloud SQL/BigQuery-backed MCP server, or calls a third-party SaaS tool via MCP | Custom integration layer directly against a managed database, or a bespoke internal API call (task 3.2) |
| Build/maintenance cost | Lower per-integration cost once the protocol is adopted org-wide | Lower per-integration cost once MCP servers exist for the target systems | Higher — every new integration is written and maintained from scratch |
| Best when | Multi-agent systems where agents need to interoperate, including across teams/vendors | Connecting to a tool, database, or SaaS system that already has (or should have) an MCP server | One-off, tightly-coupled, or legacy integrations where standing up a protocol server isn't worth it |
| Governance touchpoint | Agent Identity / PAB apply to which agents can call which agents | Auth (OAuth 2.0, per task 5.1) governs which agents can call which MCP servers/tools | Governance must be hand-built into the custom layer — no protocol-level enforcement for free |

## 3. Decision tree

```
              Two systems need to talk — which mechanism?
                                |
              Is the CALLER an autonomous agent and the
              CALLEE also an autonomous agent (a peer agent
              doing reasoning/decision-making of its own,
              not just executing a fixed tool call)?
                                |
                +----------------+----------------+
               YES                                NO
                |                                  |
                v                          Is the callee a tool, API,
          Use A2A                          database, or external
          (agent-to-agent                  SaaS/remote server that an
          handoff/coordination,            agent needs to call as a
          task 3.3)                        capability?
                                                     |
                                        +-------------+-------------+
                                       YES                          NO
                                        |                            |
                                        v                            v
                              Does an MCP server already      Write a direct/custom
                              exist (or is one worth           integration layer
                              standing up) for this            (task 3.2) — e.g. a
                              tool/data source?                bespoke API call or
                                        |                       DB driver, no
                                +--------+--------+             standard protocol
                               YES                NO             needed/available
                                |                   |
                                v                   v
                          Use MCP              Use direct/custom
                          (agent-to-tool,       integration for now;
                          task 3.2/3.3;         consider wrapping it
                          reusable, Google      in an MCP server later
                          Cloud MCP Servers     if it becomes a
                          for GCP targets)      reused capability
```

## 4. Tradeoff writeups

### Use A2A when...
- The workflow genuinely involves **multiple autonomous agents**
  coordinating — a task 3.3 parallel/sequential/graph pattern where each
  node is itself an agent capable of reasoning, not just a fixed
  function.
- Agents need to be discoverable and callable as peers, potentially
  across teams or even organizations, and you want a standardized
  handoff contract rather than a bespoke one per pair of agents.
- You're building the orchestration layer itself (the "who talks to
  whom" fabric for a multi-agent system), which is exactly what task
  3.3 frames A2A as supporting.

### Don't use A2A when...
- The callee isn't really an agent — it's a deterministic tool, an API
  endpoint, or a data source with no reasoning of its own. Wrapping a
  plain database query in A2A semantics is a category error; that's
  MCP's (or direct integration's) job.
- You only have one caller and one callee with a fixed, stable
  relationship and no plan to ever add more agents to the interaction —
  the protocol overhead may not be worth it versus a direct call,
  though A2A's standardization still pays off if the system is expected
  to grow.

### Use MCP when...
- An agent needs to call a **tool, database, or external system** as a
  capability — task 3.2's own examples are "custom integration layers
  for managed databases, API integrations, and MCP server[s] that
  connect agents to third-party SaaS tools and remote servers."
- The same tool/data source is likely to be called by more than one
  agent or more than one team — standing up an MCP server means every
  future agent gets that capability for free instead of re-implementing
  the integration.
- Google Cloud MCP Servers already exist for the target service — reuse
  beats rebuilding.

### Don't use MCP when...
- The target is another autonomous agent, not a tool — that's A2A's
  job, and forcing agent-to-agent coordination through a tool-calling
  protocol loses the coordination semantics (handoff, negotiation,
  multi-step reasoning between peers) A2A is built for.
- The integration is genuinely one-off, low-value to standardize, or
  the overhead of standing up and maintaining an MCP server exceeds the
  benefit — a direct/custom integration layer is the pragmatic choice
  task 3.2 explicitly leaves room for.

### Use direct/custom integration when...
- Neither A2A nor MCP fits: no peer agent is involved, and no
  standardized tool-calling wrapper exists or is worth building for a
  narrow, tightly-coupled internal connection (task 3.2's "custom
  integration layers for managed databases" and "API integrations").
- Speed matters more than reusability — a quick, tightly-scoped
  integration for a single use case.
- The target system's interface is unstable, legacy, or otherwise a
  poor fit for a standardized protocol wrapper right now.

### Don't default to direct/custom integration when a protocol wins instead...
- If the same integration will plausibly be reused by another agent or
  team, building it as a custom one-off means someone else will
  duplicate the work later instead of calling an existing MCP server or
  A2A-compliant agent.
- If the exam scenario explicitly names "third-party SaaS tools,"
  "remote servers," or a reusable capability that should sit in Agent
  Registry, that's a strong signal the intended answer is MCP, not a
  hand-rolled integration.

## 5. How they compose in one system

A realistic multi-agent deployment uses **both** protocols at different
layers, plus direct integration where neither fits:

```
   Orchestrator agent (graph workflow, task 3.3)
          |
          |  A2A  (agent-to-agent handoff)
          v
   Specialist agent  ---MCP--->  Google Cloud MCP Server ---> BigQuery
          |                                                    (data layer)
          |  MCP
          v
   Third-party SaaS tool (via MCP server, task 3.2)
          |
          |  direct/custom integration
          v
   Legacy internal API with no protocol wrapper
```

Agent Registry (task 3.2) is the thread tying this together: it's where
both A2A-callable agents and MCP-exposed capabilities get registered so
other agents can discover them, regardless of which protocol layer is
underneath.

## 6. Exam traps to watch for

- Don't treat A2A and MCP as interchangeable synonyms for "an agentic
  protocol" — the guide names them side by side precisely because they
  solve different problems (agent-to-agent vs. agent-to-tool).
- A question describing an agent calling "a third-party SaaS tool" or
  "a remote server" is pointing at MCP (task 3.2's own wording), not
  A2A.
- A question describing "multi-agent handoffs" or an orchestrator
  delegating to a specialist agent is pointing at A2A (task 3.3's own
  wording), not MCP.
- Don't assume every integration must go through a named protocol —
  task 3.2 explicitly keeps "custom integration layers" and "API
  integrations" as a legitimate, named option alongside MCP servers.
