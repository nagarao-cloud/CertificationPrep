# Lab 04 — Orchestrating multiple agents with A2A and MCP, via Agent Registry and Agent Runtime

> Covers exam task **3.3** (orchestrating and coordinating agentic
> workflows) — the third of Section 3's three tasks, and the direct
> continuation of Lab 03. Companion reference:
> `01-domains/SECTION-3-custom-agents.md` §3,
> `02-services/04-orchestration-protocols.md`,
> `03-comparisons/02-orchestration-pattern-options.md`,
> `03-comparisons/03-a2a-vs-mcp-vs-direct-integration.md`.

---

## Honesty callout

> **This lab is illustrative, not SDK/console-verified.** As with Lab
> 03, this environment has no live access to ADK, A2A/MCP runtime
> libraries, Agent Registry, or Agent Runtime. Code and CLI samples
> below are realistic illustrations of the concepts the exam guide
> names, not verified against a real SDK. **Confirm exact syntax
> against live ADK/A2A/MCP documentation before an exam attempt.**

---

## 0. What you're building, and why this is a separate lab from Lab 03

Lab 03 built one agent (well, two: triage and drafting) with a
knowledge-integration layer. This lab adds a **second, independent
agent** — a specialist escalation agent — and connects it to Lab 03's
agents using the two orchestration protocols named in task 3.3: **MCP**
and **A2A (Agent2Agent)**. This is deliberately split into its own lab
because orchestrating *multiple* agents introduces a genuinely
different set of concerns (discovery, handoff, permission scoping
across agents, workflow topology) that don't arise when you're only
building a single agent's internal logic, and because task 3.3 is a
distinct, separately-weighted exam task.

### Vocabulary check before you start

- **Orchestration** — coordinating multiple agents (or multiple steps)
  so they work together toward an overall goal, as opposed to one
  agent doing everything itself.
- **Handoff** — the point at which control of a task passes from one
  agent to another.
- **Protocol** — a standardized way for two systems to communicate,
  agreed on in advance, so either side can be built independently and
  still interoperate correctly.

---

## 1. Recall the core distinction: MCP is agent↔tool, A2A is agent↔agent

Before writing anything, restate this from
`01-domains/SECTION-3-custom-agents.md` §3.1 in your own words — it's
the single most tested distinction in this whole lab:

- **MCP (Model Context Protocol)** connects an agent (as a *client*)
  to **tools and data sources** (exposed by an MCP *server*). You
  already used this in Lab 03 §7 (the knowledge-base lookup capability
  exposed via a Google Cloud MCP Server) and in Lab 02 (the issue-
  tracker MCP server).
- **A2A (Agent2Agent)** connects one **agent** to **another agent** —
  peer-to-peer coordination, not agent-to-resource access.

```
      ┌────────────┐   MCP    ┌────────────────┐
      │  Drafting     │◄───────►│  Knowledge-base   │
      │  agent (from   │          │  lookup (MCP        │
      │  Lab 03)        │          │  server, Lab 03 §7) │
      └──────┬────────┘          └────────────────┘
             │
             │ A2A  (this lab builds this connection)
             ▼
      ┌────────────┐   MCP    ┌────────────────┐
      │  Specialist   │◄───────►│  Specialist-only   │
      │  escalation    │          │  knowledge source   │
      │  agent (new,   │          │  (MCP server)         │
      │  this lab)      │          └────────────────┘
      └────────────┘
```

**Don't use** MCP to try to coordinate the drafting agent and the new
specialist agent working together on a shared ticket — MCP's
client/server model is built for an agent consuming a
tool/resource, not peer agent-to-agent handoff semantics. **Use** A2A
for that connection instead, which is exactly what §2 below builds.

---

## 2. Part A — build the specialist escalation agent

This is a second, independent ADK agent, following the same pattern
as Lab 03 but with its own narrower scope: it only handles
complex/high-risk tickets that the drafting agent decides it can't
confidently resolve alone.

```python
from adk import Agent, ModelConfig, AgentIdentity

specialist_agent = Agent(
    name="specialist-escalation-agent",
    model=ModelConfig(provider="gemini", model_name="gemini-pro"),
    system_instructions=(
        "You handle complex or high-risk support tickets escalated "
        "from the triage/drafting pipeline: disputes, potential "
        "policy exceptions, and multi-order issues. Use the "
        "specialist knowledge source available to you; do not "
        "attempt to resolve tickets outside that scope."
    ),
    identity=AgentIdentity(
        allowed_data_sources=["gs://retail-co-kb/specialist-policies/"],
        denied_data_sources=["gs://retail-co-internal/hr-records/"],
    ),
)
```

**Why this agent gets its own distinct `AgentIdentity`, not a copy of
the drafting agent's:** this is the least-privilege handoff principle
from `01-domains/SECTION-3-custom-agents.md` §3.3 stated in code — "a
handoff from Agent A to Agent B should respect that Agent B operates
under *its own* identity/permissions, not silently inherit Agent A's
broader access." The specialist agent has access to a policy source
the drafting agent doesn't (and shouldn't) have, and — just as
importantly — the reverse should also hold: the specialist agent
should **not** automatically inherit whatever broader access the
drafting agent might have accumulated. Each agent's identity is scoped
independently to its own actual task.

---

## 3. Part B — register both agents in Agent Registry

Recall from `01-domains/SECTION-3-custom-agents.md` §2.4 and §3.3:
**Agent Registry** is the discovery/catalog layer — it's how one agent
"finds" that another agent exists and what it can do, rather than
being hard-wired to it.

```python
from adk import AgentRegistry

AgentRegistry.register_agent(
    name="response-drafting-agent",
    capabilities=["draft_response", "cite_kb_source"],
)

AgentRegistry.register_agent(
    name="specialist-escalation-agent",
    capabilities=["resolve_dispute", "apply_policy_exception"],
)
```

**Why register instead of hard-coding a direct reference from the
drafting agent to the specialist agent's address/endpoint:** this
mirrors the exact anti-pattern warning from
`01-domains/SECTION-3-custom-agents.md` §2.4 — a hard-wired dependency
duplicates maintenance burden and creates drift if the specialist
agent's location or interface ever changes. Registering both agents
lets the drafting agent (or any future third agent) discover the
specialist agent's capabilities dynamically, and lets you swap or
version the specialist agent later without rewriting the drafting
agent's code.

---

## 4. Part C — build the A2A handoff

### 4.1 Decide the handoff condition first (design, before code)

A real handoff needs an explicit trigger condition — don't wire an
unconditional or vaguely-defined handoff. This lab uses a simple,
inspectable rule: escalate when the drafting agent's own confidence
score (a hypothetical field the drafting agent's response could
include) falls below a threshold, or when the ticket's classification
(from Lab 03's triage agent) is tagged `"dispute"` or
`"multi-order-issue"`.

```python
def should_escalate(triage_category: str, draft_confidence: float) -> bool:
    if triage_category in ("dispute", "multi-order-issue"):
        return True
    if draft_confidence < 0.6:
        return True
    return False
```

### 4.2 Implement the handoff over A2A

```python
from adk.a2a import A2AClient

a2a = A2AClient(
    calling_agent=drafting_agent,
    registry=AgentRegistry,
)

def route_ticket(triage_category, message, draft_response, confidence):
    if should_escalate(triage_category, confidence):
        # A2A handoff — Agent B (specialist) is discovered via
        # Agent Registry and executes under ITS OWN Agent Identity,
        # not the drafting agent's.
        specialist_result = a2a.handoff(
            target_agent_name="specialist-escalation-agent",
            task=(
                f"Ticket category: {triage_category}\n"
                f"Original message: {message}\n"
                f"Draft response so far: {draft_response}\n"
                f"Please review and finalize."
            ),
        )
        return specialist_result
    return draft_response
```

**Why the handoff carries the draft response, not just the raw
ticket:** passing along the drafting agent's already-produced work
(even though it's below the confidence threshold) gives the specialist
agent a useful starting point rather than making it redo work from
scratch — this is a practical efficiency choice, distinct from the
identity/permission-scoping concern, which is handled separately (the
specialist agent evaluates the draft using its own knowledge access,
it doesn't inherit the drafting agent's *permissions* just because it
receives the drafting agent's *output* as input; receiving data and
inheriting access scope are two different things, and conflating them
is a subtle mistake worth flagging explicitly).

---

## 5. Part D — choose the right workflow topology

Recall the three topologies from
`01-domains/SECTION-3-custom-agents.md` §3.2: **sequential**,
**parallel**, **graph workflow**. This lab's overall pipeline —
classify (triage agent) → draft (drafting agent) → conditionally
escalate (specialist agent) — mirrors the worked example in that
file's §4 almost exactly, and for the same reason:

```
   classify ──► draft ──► [confidence/category check] ──┬─► done
   (sequential,  (sequential                              │
    triage        continues)                              │ (conditional
    agent)                                                  │  branch —
                                                              │  graph
                                                              ▼  workflow)
                                                    specialist agent
                                                    (A2A handoff)
```

**Why this is a graph workflow, not a purely sequential one, even
though most of the pipeline reads top-to-bottom:** the domain file's
§3.2 don't-use/use guidance is explicit — "don't use a rigid
sequential... structure when the workflow needs conditional branching
... use a graph workflow when routing logic depends dynamically on
intermediate results." The classify→draft portion genuinely is a
strict, ordered dependency chain (drafting needs the classification
result first) — so that part is sequential. But the escalation
decision depends on an intermediate result (the confidence score and
category, computed *during* the workflow, not known in advance), which
a purely sequential or purely parallel structure cannot express. The
correct answer is a **graph workflow overall, with a sequential
sub-path inside it** — not "pick one topology for the whole system,"
which is itself a useful, exam-relevant nuance: real systems often
compose topologies rather than using exactly one throughout.

**Also confirm what this workflow is *not*:** it is not a candidate
for the **parallel** topology, because drafting genuinely depends on
classification's output (you can't draft a grounded response before
you know what kind of ticket it is) — running them concurrently would
either waste work or let drafting proceed on an unknown/wrong category
assumption. Explicitly ruling out the wrong topology, not just picking
the right one, is good practice for how these scenario questions are
graded (every option explained, not just the correct one — see this
folder's own quiz conventions in `CLAUDE.md` §9).

---

## 6. Part E — deploy both agents to Agent Runtime

Recall: **Agent Runtime** (formerly Agent Engine — say the current
name; only mention the old one when explicitly flagging the rename)
is the managed deployment/execution environment where orchestrated
agents actually run, per
`01-domains/SECTION-3-custom-agents.md` §3.3.

```bash
agent-runtime deploy \
  --agent response-drafting-agent \
  --agent specialist-escalation-agent \
  --workflow ./escalation-workflow.yaml
```

Illustrative `escalation-workflow.yaml` shape:

```yaml
workflow:
  name: support-ticket-triage-and-escalation
  type: graph
  nodes:
    - agent: ticket-triage-agent
      next: response-drafting-agent
    - agent: response-drafting-agent
      condition: should_escalate
      on_true: specialist-escalation-agent
      on_false: end
    - agent: specialist-escalation-agent
      next: end
```

### 6.1 Add an agent policy over the whole workflow

Recall from `01-domains/SECTION-3-custom-agents.md` §3.3: **agent
policies** are the governance layer constraining what handoffs are
allowed, under what conditions, with what limits — distinct from
Agent Identity (which scopes one agent) and Agent Registry (discovery).

```yaml
policies:
  - name: escalation-handoff-policy
    applies_to_edge: response-drafting-agent -> specialist-escalation-agent
    constraints:
      max_handoffs_per_ticket: 1     # prevent an escalation loop —
                                       # a ticket can only be
                                       # escalated once, not bounced
                                       # back and forth
      require_identity_scope_check: true
```

**Why `max_handoffs_per_ticket: 1` matters specifically:** this is a
direct, concrete guard against the **agent reasoning loop** failure
mode named explicitly in task 4.2 (covered in depth in Lab 05) — "the
agent repeatedly calls the same tool... cycles through the same
reasoning steps without making forward progress." A multi-agent
handoff system without an explicit loop-prevention policy is
structurally capable of oscillating a ticket back and forth between
two agents indefinitely if each one's logic decides the other should
handle it — this policy line is a design-time guard against exactly
that runtime failure mode, connecting Section 3.3's orchestration
design directly to Section 4.2's troubleshooting content.

---

## 7. Part F — verify the end-to-end flow

Trace through one full example by hand before considering this lab
"working," the same way you'd trace a state machine in Lab 01:

1. A ticket comes in: *"I was charged twice for order #9911 and also
   never received order #8820 — please help."*
2. **Triage agent** (Lab 03) classifies this as `"multi-order-issue"`.
3. Per `should_escalate` (§4.1), `triage_category ==
   "multi-order-issue"` → escalation triggers **immediately**, without
   even needing to check the confidence score — this is correct
   behavior, not a bug: the category-based rule and the confidence-
   based rule are two independent conditions, either of which alone
   is sufficient to trigger escalation (an `or`, not an `and`).
4. **Drafting agent** (Lab 03) still produces a draft response first
   (per the pipeline order in §5's diagram — draft happens before the
   escalation check, so the specialist agent has a starting point per
   §4.2's reasoning).
5. **A2A handoff** fires: specialist agent is discovered via Agent
   Registry, receives the draft + context, executes under its own
   Agent Identity (with access to specialist-only policy content the
   drafting agent never had).
6. The **agent policy**'s `max_handoffs_per_ticket: 1` constraint means
   the specialist agent's own output, even if it's uncertain, does
   **not** bounce back to the drafting agent for a second round — it
   either resolves the ticket or (a case this lab hasn't built, but
   would be the natural next node in the workflow graph) routes to a
   human via HITL, which is exactly where Lab 06's governance content
   picks up.

---

## 8. What you should be able to explain after this lab

- [ ] The core distinction between MCP (agent↔tool) and A2A
      (agent↔agent), with a concrete example of each from this lab and
      Lab 03.
- [ ] Why the specialist agent got its own distinct `AgentIdentity`
      instead of inheriting the drafting agent's, and why receiving
      data as handoff input is different from inheriting permission
      scope.
- [ ] Why both agents were registered in Agent Registry rather than
      hard-wiring a direct reference between them.
- [ ] Why this lab's overall workflow is best described as a graph
      workflow with a sequential sub-path, rather than picking one
      single topology for everything — and why parallel would have
      been the wrong choice here.
- [ ] What an agent policy adds on top of Agent Identity and Agent
      Registry, and specifically how `max_handoffs_per_ticket`
      connects to the "agent reasoning loop" failure mode covered in
      Lab 05/Section 4.2.
- [ ] How to trace a multi-agent handoff scenario step by step,
      identifying which tool/protocol/mechanism is responsible at
      each point (classification → draft → escalation-condition check
      → A2A handoff → specialist resolution).
