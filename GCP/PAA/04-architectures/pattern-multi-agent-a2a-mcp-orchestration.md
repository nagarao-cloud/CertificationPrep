# Pattern — Multi-Agent System With A2A + MCP Orchestration

> **Pattern summary:** A system of multiple specialized agents,
> discoverable through **Agent Registry**, running on **Agent
> Runtime**, coordinating with each other over the **Agent2Agent (A2A)**
> protocol and reaching out to tools/data sources over the **Model
> Context Protocol (MCP)**, composed into **parallel**, **sequential**,
> and **graph** orchestration shapes depending on the sub-task
> structure.
>
> **Primary exam task:** 3.3 (Orchestrating and coordinating agentic
> workflows). Section 3 is ~33% of the exam; 3.3 is one of its three
> tasks. This pattern builds directly on top of
> `pattern-custom-multi-agent-adk.md`'s single-agent building block —
> read that file first if the ADK/RAG/memory vocabulary here (managed
> sessions, Memory Bank, RAG Engine) is unfamiliar.
>
> **Currency reminders applied in this file:** **Agent Runtime**, never
> "Agent Engine." Component names match
> `02-services/04-orchestration-protocols.md` exactly — read that file
> first if any term below (A2A vs. MCP, parallel/sequential/graph) is
> unfamiliar.

---

## 1. What this pattern is, and when you reach for it

**Ground-zero framing first.** Every pattern before this one in this
folder builds **one** agent — one reasoning loop, however
sophisticated. This pattern is about what happens when a single
agent's job is genuinely too broad or too specialized for one
reasoning loop to do well, and the right answer is **several** agents,
each good at a narrower thing, that hand work to each other.

Two different "talking to something else" relationships show up in a
system like this, and keeping them distinct is the single most
important concept in this pattern:

- **A2A (Agent2Agent)**: an **agent talking to another agent** — peer
  delegation, a handoff, "I need your specific capability for this
  sub-task."
- **MCP (Model Context Protocol)**: an **agent talking to a tool or
  data source** — a database, an API, a SaaS service. Not another
  agent's reasoning — a capability with no reasoning of its own.

A real multi-agent system uses **both**, for different edges of its
communication graph: A2A between the agents themselves, MCP from each
agent out to whatever tools it individually needs.

**Reach for this pattern when:**
- Sub-tasks genuinely benefit from separate, specialized reasoning
  contexts — a research agent, a drafting agent, and a fact-checking
  agent each doing their narrow job better than one generalist agent
  juggling all three concerns at once.
- The workload naturally decomposes into independent, concurrent
  pieces (parallel), a dependent pipeline (sequential), or
  conditional/looping coordination (graph) — see §5.
- Different teams own different agents and need them to interoperate
  without hard-coding integration logic against each other's internals
  — A2A is what makes that interoperability standardized rather than
  bespoke.

**Don't reach for this pattern** for a workload a single ADK agent
handles well — see `pattern-custom-multi-agent-adk.md` §6.4's tradeoff
on jumping to multi-agent prematurely; the coordination overhead this
pattern adds (protocol plumbing, inter-agent identity, more surfaces
to evaluate and secure) is real cost, not free architecture.

---

## 2. The building blocks, briefly (full detail lives in `02-services/04-orchestration-protocols.md`)

| Block | One-line role in this pattern |
|---|---|
| **A2A (Agent2Agent)** | The protocol standardizing agent-to-agent delegation and handoff. |
| **MCP (Model Context Protocol)** | The protocol standardizing agent-to-tool/data-source calls. |
| **Google Cloud MCP Servers** | Pre-built, Google-maintained MCP server implementations for Google Cloud services and common third-party integrations — so nobody hand-writes an MCP server per tool. |
| **Agent Registry** | The discovery/catalog layer — where agents and their capabilities are registered so an orchestrator (or another agent) can find the right one for a sub-task. |
| **Agent Runtime** | The managed hosting/execution layer — where every participating agent's instance actually runs. **Not "Agent Engine"** — that's the retired name. |
| **Agent Identity** | The identity layer making A2A handoffs and Agent Registry lookups trustworthy — full reference entry in `02-services/06-security-governance.md`; this pattern uses it at the point where trust actually matters (§4). |
| **Agent policies** | Rules governing how orchestration is allowed to happen — which agents can hand off to which, under what conditions. |

---

## 3. Full production architecture

```
                    ┌───────────────────────────────────────┐
                    │        Incoming task / request             │
                    │   (from a user-facing agent, an API,          │
                    │    or a scheduled trigger)                      │
                    └───────────────────┬─────────────────────┘
                                        │ (1) task arrives
                                        ▼
     ┌────────────────────────────────────────────────────────────────────┐
     │                      ORCHESTRATING AGENT                              │
     │        (an ADK agent — see pattern-custom-multi-agent-adk.md —          │
     │         whose job is specifically deciding how to decompose               │
     │         and route this task)                                              │
     └───────┬───────────────────────────────────────────────────┬────────┘
             │ (2) discover available agents/capabilities             │
             ▼                                                        │
     ┌─────────────────────────────┐                                 │
     │        AGENT REGISTRY            │                                 │
     │  catalog: which specialized        │                                 │
     │  agents exist, what each can          │                                 │
     │  do, how to reach them                  │                                 │
     └─────────────────────────────┘                                 │
             │ (3) lookup result: route to agent(s) X, Y, Z              │
             ▼                                                        │
     ┌────────────────────────────────────────────────────────────────┴───┐
     │        Orchestration shape chosen per task structure (§5):            │
     │                                                                        │
     │  PARALLEL:                    SEQUENTIAL:              GRAPH:           │
     │  ┌───────┐ ┌───────┐          ┌───────┐                ┌───────┐        │
     │  │Agent X │ │Agent Y │          │Agent X │──►(6)──►      │Agent X │──┐     │
     │  └───┬───┘ └───┬───┘          └───┬───┘   Agent Y      └───┬───┘  │     │
     │      │(4)      │(4)                │(5)      │──►(6)──►        │(7) loop/  │
     │      └────┬────┘                   ▼        Agent Z          ▼   branch    │
     │           ▼                    [ pipeline, each                ┌───────┐  │
     │    [ results merged ]           step depends on                 │Agent Y │◄─┘
     │                                  the previous ]                └───────┘  │
     └────────────────────────────────────────────────────────────────────────┘
             │ (8) each participating agent, wherever it runs
             ▼
     ┌───────────────────────────────────────────────────────────────────┐
     │                          AGENT RUNTIME                                │
     │   hosts the running instance of every agent participating in           │
     │   this workflow — the orchestrator and every sub-agent alike            │
     └───────┬─────────────────────────────────────────────┬──────────────┘
             │ (9) A2A: delegated sub-task, with                │ (10) MCP: tool call from
             │      identity carried and verified                     a sub-agent's own reasoning
             ▼                                                   ▼
     ┌─────────────────────────┐                    ┌───────────────────────────┐
     │       AGENT IDENTITY         │                    │    Google Cloud MCP Servers   │
     │  verifies: whose authority      │                    │  (GCP services, third-party     │
     │  is this handoff/call acting     │                    │   SaaS, remote servers —         │
     │  under? (full entry:               │                    │   see 07-data-services.md          │
     │  06-security-governance.md)        │                    │   for the data layer behind         │
     └─────────────────────────┘                    │   many of these)                  │
                                                      └───────────────────────────┘
                                                                    │
                                                                    ▼
                                              [ managed DB / API / SaaS / remote server ]
```

---

## 4. Arrow-by-arrow walkthrough

1. **A task arrives at the orchestrating agent.** This is itself an
   ADK agent (per `pattern-custom-multi-agent-adk.md`), but its
   specific job is decomposition and routing rather than doing the
   whole task's work itself — e.g., "research this topic, draft a
   summary, and fact-check it before returning a final answer" is a
   task that benefits from three different specialized agents rather
   than one generalist trying to do all three well.
2. **The orchestrator queries Agent Registry to discover what's
   available.** Before deciding *how* to route the task, it needs to
   know *what agents and capabilities exist* — Agent Registry is the
   catalog answering that, so capability discovery doesn't become
   tribal knowledge or a hard-coded lookup table that goes stale as
   the agent population grows.
3. **Agent Registry returns a lookup result** — which registered
   agent(s) match the sub-tasks this job decomposes into, and how to
   reach them.
4. **(Parallel shape)**: if the sub-tasks are independent and don't
   need each other's output — e.g., three agents each researching a
   different topic simultaneously — the orchestrator dispatches to
   all of them concurrently and merges results once all complete.
5. **(Sequential shape)**: if each step genuinely depends on the
   previous step's output — a pipeline, e.g., extract → validate →
   summarize — the orchestrator dispatches to the first agent, and
   only proceeds to the next once that step's result is available.
6. **Each hop in the sequential pipeline is itself an A2A handoff** —
   agent X's output becomes agent Y's input, delegated via the same
   protocol used for any other agent-to-agent handoff.
7. **(Graph shape)**: when coordination isn't a straight line —
   conditional branching (route to a different agent based on a
   classification), retry/refine loops, or a mix of parallel and
   sequential sub-sections — the orchestration follows a graph rather
   than a fixed pipeline. A scenario describing conditional routing
   or retry logic between agents is the signal for this shape, not a
   sequential one (see `02-services/04-orchestration-protocols.md`
   §2's decision note).
8. **Regardless of orchestration shape, every participating agent
   instance — the orchestrator and every sub-agent — actually executes
   on Agent Runtime**, the managed hosting layer. The orchestration
   logic decides *what* happens and *in what order*; Agent Runtime is
   *where* each participating agent's execution actually happens.
9. **Every A2A handoff carries an identity the receiving agent (and the
   platform) can verify** — this is Agent Identity's role, cross-
   referenced here and given its full treatment in
   `02-services/06-security-governance.md`. When Agent X hands a
   sub-task to Agent Y, that call needs to carry *whose* effective
   authority it's acting under, not just arrive as an anonymous
   request — critical in a multi-hop chain, where an unbounded
   delegation could otherwise let authority silently accumulate beyond
   what any single agent was actually scoped for.
10. **A sub-agent receiving an A2A handoff can make its own MCP tool
    calls**, reaching a Google Cloud MCP Server fronting a managed
    database, an API, or a third-party SaaS tool — this is recursive:
    a sub-agent invoked via A2A is not limited to reasoning alone, it
    can act, and that action goes out over MCP exactly the way a
    single agent's tool calls do in
    `pattern-custom-multi-agent-adk.md`. This recursion (agents that
    can themselves delegate further, or call tools, while handling a
    delegated sub-task) is exactly what enables graph-shaped, not just
    linear, multi-agent workflows.

---

## 5. Choosing an orchestration shape — the core design decision

This is the single decision this pattern is built around, so it's
worth stating as an explicit decision framework, not just narrative:

| Signal in the scenario | Shape to choose | Why |
|---|---|---|
| Sub-tasks are independent, no step needs another step's output, and doing them concurrently saves time | **Parallel** | No coordination cost beyond dispatch and merge; concurrency is pure upside when there's no dependency to violate. |
| Each step's input is the previous step's output, in a fixed order | **Sequential** | A pipeline shape — trying to force this into parallel execution would mean a step running before the data it needs exists. |
| The workflow has conditional branches (route differently based on a classification result), or needs to loop (retry/refine until a condition is met), or mixes parallel and sequential sub-sections | **Graph** | Neither parallel nor sequential alone can express branching or loops — graph is the general case both other shapes are special cases of. |

A common exam trap (flagged in `02-services/04-orchestration-protocols.md`
§9) is defaulting to sequential for anything multi-step, when the real
signal in the scenario is independence (→ parallel) or branching/
looping (→ graph). Read the scenario for *dependency structure*, not
just "more than one agent is involved."

---

## 6. Design decisions and tradeoffs

### 6.1 Multi-agent orchestration vs. one large single agent

Already introduced in `pattern-custom-multi-agent-adk.md` §6.4; the
fuller version, from this pattern's side:

**Tradeoff.** A single agent with a very long, complex system
instruction trying to do research, drafting, and fact-checking all in
one reasoning loop tends to degrade at each individual task as the
instruction grows more complex and the model has to juggle more
concerns at once in a single context. Splitting into specialized
agents (this pattern) lets each agent's system instructions, tools,
and even underlying model choice (task 3.1's LLM-vs-SLM decision — a
narrow fact-checking agent might do fine on a cheaper, faster SLM
where a research agent needs a stronger model) be tuned independently
for its narrower job. The cost is real: more moving pieces to
evaluate (`pattern-evaluation-deployment-pipeline.md`), more identity/
trust surface to secure (§4, arrow 9), and genuine latency overhead
from the A2A handoffs themselves. Choose multi-agent when the
specialization benefit outweighs that coordination cost — not by
default for every multi-step task.

### 6.2 A2A for agent-to-agent vs. treating a sub-agent as "just another tool" over MCP

**Alternative sometimes proposed:** instead of a real A2A handoff, wrap
a sub-agent's capability as an MCP tool the orchestrator calls, so
everything is MCP and there's only one protocol to reason about.

**Tradeoff.** This can superficially work for a simple case, but it
loses what actually distinguishes an agent from a tool: an agent has
its own reasoning, its own identity, and potentially its own further
delegation — collapsing that into a plain tool call discards the
identity-propagation and recursive-delegation semantics A2A is built
for (arrow 9–10). Per
`02-services/04-orchestration-protocols.md` §2's decision note: use
A2A when the other side needs to reason or has its own identity worth
tracking through the chain; use MCP when the other side is a
capability with no reasoning of its own. A sub-agent that only ever
does one fixed, stateless thing might genuinely be simple enough to
model as a tool — but the moment it needs its own judgment or its own
further tool calls, that's a signal it should be a real agent reached
via A2A, not an MCP-wrapped function.

### 6.3 Centralized orchestrator vs. fully peer-to-peer agent coordination

**Chosen here (default):** one orchestrating agent that queries Agent
Registry and routes to sub-agents (arrows 1–3).

**Alternative:** no central orchestrator — agents discover and hand
off to each other peer-to-peer as needed, with no single agent owning
the overall task decomposition.

**Tradeoff.** A centralized orchestrator gives a clear place to reason
about the overall task's success criteria, apply agent policies
(governing which handoffs are even allowed), and debug a failure (one
place to trace the decision that routed work incorrectly). Pure
peer-to-peer coordination can be more resilient to any single agent
being a bottleneck and can scale organically as new agents register
new capabilities, but makes the overall task's success much harder to
reason about and govern — no single point owns "did this task actually
get done correctly." For most enterprise scenarios (and for anything
graph-shaped, per §5), a centralized orchestrator is the safer default
this pattern uses; fully peer-to-peer coordination is a more advanced,
less governable variant worth naming as an alternative but not the
default.

---

## 7. Common failure modes and how this design handles them

| Failure mode | What it looks like | How this architecture mitigates it |
|---|---|---|
| **Wrong orchestration shape chosen** | A genuinely sequential pipeline is forced into parallel execution (a step runs before its input exists), or independent sub-tasks are needlessly serialized, wasting latency. | §5's dependency-structure framework — evaluate the actual data-dependency graph between sub-tasks, not just "how many agents are involved." |
| **Authority creep across a multi-hop delegation chain** | Agent A hands off to Agent B, which hands off to Agent C, and by the time C acts, it's effectively exercising more authority than any single hop was meant to grant. | Agent Identity's per-hop verification (arrow 9) is exactly the control here — each handoff carries and checks a bounded identity rather than an ever-widening implicit trust; full PAB (principal access boundary) treatment is in `pattern-secure-governed-enterprise-agent-platform.md`. |
| **Stale Agent Registry entries** | The orchestrator routes to an agent that's been decommissioned, renamed, or had its capabilities change, because the registry wasn't updated. | This is an operational discipline the architecture makes visible (arrow 2's lookup is a real dependency, not implicit) but doesn't automatically solve — registry entries need the same lifecycle management as any other production catalog; a stale-registry failure surfaces as a routing failure at arrow 3, which Observability (`pattern-evaluation-deployment-pipeline.md`) should catch. |
| **Reasoning loop across agents** | Agent A hands off to Agent B, which for some reason hands back to Agent A, which hands back to Agent B — a cross-agent version of the single-agent reasoning-loop failure mode from task 4.2. | Agent policies (§2) can bound this — e.g., a maximum handoff depth, or a rule against handing back to an agent already in the current call chain — configured as part of the orchestration design, not left to emerge at runtime. |
| **Cascading latency in a sequential pipeline** | A slow step early in a sequential chain delays every downstream step, and the whole task feels unresponsive even though only one agent is actually slow. | This is exactly why the parallel-vs-sequential-vs-graph decision (§5) matters for performance, not just correctness — a scenario emphasizing latency-sensitivity on independent sub-tasks is a strong parallel signal, and Cloud Trace (per-hop timing, `pattern-evaluation-deployment-pipeline.md`) is the diagnostic tool for finding which hop is actually slow once this happens in production. |
| **MCP tool call from a deep sub-agent bypasses intended governance** | A sub-agent several hops deep makes a tool call that should have been gated, because governance was only applied at the orchestrator's entry point, not at every hop. | Governance (Agent Gateway, Skill Registry, PAB) needs to apply per-agent, not just at the system's entry point — this is the core lesson `pattern-secure-governed-enterprise-agent-platform.md` builds on, and this pattern's arrow 10 (a sub-agent's own MCP calls) is exactly the point where that governance needs to still apply, deep in the chain, not just at arrow 1. |

---

## 8. Exam task mapping

| Task | How this pattern demonstrates it |
|---|---|
| **3.3** — Orchestrating and coordinating agentic workflows | The entire pattern: A2A/MCP protocol usage (arrows 9–10), Agent Registry discovery (arrows 2–3), Agent Runtime hosting (arrow 8), and parallel/sequential/graph orchestration shapes (§5). |
| **3.2** (secondary) — Google Cloud MCP Servers as one of task 3.2's named "prebuilt and custom capabilities" tools | Arrow 10's tool-call path. |
| **5.1/5.2** (extension point) | Arrow 9's Agent Identity verification is the entry point into full governance treatment — see `pattern-secure-governed-enterprise-agent-platform.md`. |
| **4.1/4.2** (extension point) | Evaluating and deploying a multi-agent system built this way is the subject of `pattern-evaluation-deployment-pipeline.md`. |

---

## 9. Exam traps specific to this pattern

- Writing "Agent Engine" anywhere as the current name for the managed
  runtime — it's **Agent Runtime**.
- Treating A2A and MCP as interchangeable or as competing choices for
  the same connection — A2A is agent-to-agent, MCP is agent-to-tool; a
  real system uses both, for different edges of the graph (§6.2).
- Defaulting to a sequential pipeline for any multi-step, multi-agent
  task, rather than reading the scenario's actual dependency structure
  (§5) — independent sub-tasks are a parallel signal; branching/
  looping is a graph signal.
- Assuming "Google Cloud MCP Servers" *is* the MCP protocol — it's a
  specific set of Google-provided server implementations *of* the
  protocol, not the protocol itself.
- Treating multi-agent orchestration as free architecture with no
  cost — see §6.1; it should be a deliberate choice against the
  single-agent alternative, not a default for anything with more than
  one step.
- Assuming governance applied at the orchestrator's entry point
  automatically covers every sub-agent's own tool calls deep in a
  delegation chain — it doesn't; see the last row of §7.
