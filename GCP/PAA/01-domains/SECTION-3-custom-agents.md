# Section 3 — Developing custom agents (~33%)

> Source of truth: `00-START-HERE/RUNBOOK.md` §3, Section 3 (verbatim
> task bullets). This is **the single heaviest section on the exam —
> nearly a third of all questions**, covering three tasks: **3.1**
> (designing/building agentic workflows in code), **3.2** (integrating
> enterprise domain knowledge), and **3.3** (orchestrating/coordinating
> agentic workflows). This file is deliberately the longest and deepest
> in `01-domains/`, proportional to Section 3's exam weight — treat it
> as worth roughly as much study time as Sections 1, 2, 4, and 5
> combined would suggest at first glance, and more than that in
> practice given how much of the exam's scenario-question surface area
> concentrates here.
>
> Currency reminders that matter most in this file: say **"Agent
> Runtime"**, never "Agent Engine" (except to name the rename itself).
> **ADK (Agent Development Kit) is explicitly open-source** per the
> guide — do not describe it as closed/proprietary. **Agent Search**
> (Section 1's grounding service) is a *different* tool from **Vector
> Search 1.0 / Agent Retrieval** (this section's custom-code vector
> retrieval tools) — don't conflate the two.

---

## 0. Why Section 3 is the center of gravity for this exam

Sections 1 and 2 are about using Google's *pre-built* low-code and
coding-agent tooling. Section 3 is about **building the agent's actual
behavior yourself, in code** — model selection, memory, retrieval,
tool integration, permissions, and multi-agent orchestration. This is
the part of the exam that most resembles "systems design for agentic
AI," and it's why it carries a third of the total weight.

```
                     THE FULL CUSTOM-AGENT STACK (Section 3's scope)
   ┌──────────────────────────────────────────────────────────────────┐
   │  3.3 ORCHESTRATION LAYER                                           │
   │  MCP + A2A protocols · parallel/sequential/graph workflows ·        │
   │  Agent Identity · Agent Registry · Agent Runtime · agent policies   │
   ├──────────────────────────────────────────────────────────────────┤
   │  3.2 ENTERPRISE KNOWLEDGE LAYER                                    │
   │  RAG pipelines · embedding models · similarity scoring · reranking │
   │  · Vector Search 1.0 / Agent Retrieval · Agent Identity (perms) ·  │
   │  Agent Registry · Google Cloud MCP Servers                         │
   ├──────────────────────────────────────────────────────────────────┤
   │  3.1 AGENT FOUNDATION LAYER                                        │
   │  Model selection (LLM/SLM, self-hosted/SaaS, OSS/proprietary) ·    │
   │  ADK (open-source) · sessions & memory (Memory Bank, managed       │
   │  sessions) · skills via Agents CLI (plugins, agent vs human mode)  │
   └──────────────────────────────────────────────────────────────────┘
```

Read this stack bottom-up when you design a system, and top-down when
you're debugging one: 3.1 decides *what model and runtime foundation*
the agent is built on; 3.2 decides *what the agent knows* and *what it's
allowed to touch*; 3.3 decides *how multiple agents work together* and
*what governs the whole system in production*.

---

## 1. Task 3.1 — Designing and building agentic workflows in code

### 1.1 Selecting and configuring the appropriate language model

The guide's own framing gives you three separate axes of choice, and
exam scenario questions typically vary **one axis at a time** to test
whether you understand each independently:

```
   AXIS 1: SIZE            AXIS 2: HOSTING           AXIS 3: LICENSING
   LLM  ◄────────► SLM     Self-hosted ◄──────► SaaS  OSS ◄──────► Proprietary
```

These axes are **not the same choice** — e.g., you can have a
self-hosted open-source SLM, or a SaaS-delivered proprietary LLM, or
any other combination. A scenario question describing "a small,
efficient model your team fine-tunes and runs on your own GKE
cluster" is testing SLM + self-hosted + (likely) OSS simultaneously,
and expects you to reason about each axis's tradeoff, not just
pattern-match to a single "right answer" model.

#### 1.1.1 LLM vs. SLM

| Dimension | LLM (large language model) | SLM (small language model) |
|---|---|---|
| Reasoning breadth | Broader general reasoning, better at open-ended/ambiguous tasks | Narrower, tuned for specific task types |
| Cost per inference | Higher | Lower |
| Latency | Higher (more compute per token) | Lower |
| Deployment footprint | Larger — often needs more accelerator capacity | Smaller — can run on modest hardware, even edge/on-device in some cases |
| Fine-tuning cost/speed | More expensive/slower to fine-tune | Cheaper/faster to fine-tune for a narrow task |
| Best fit | Complex multi-step reasoning, broad-domain Q&A, ambiguous open-ended tasks | Well-defined, narrow, high-volume tasks (classification, extraction, simple routing) where cost/latency dominate |

**Don't use** an LLM for a narrow, extremely high-volume, well-defined
task (e.g., classifying support tickets into 5 fixed categories) where
an SLM would hit acceptable accuracy at a fraction of the cost and
latency — that's over-provisioning intelligence you don't need. **Use**
an SLM there instead.

**Don't use** an SLM for a task requiring broad, flexible reasoning
across ambiguous or open-ended inputs (e.g., a general-purpose
enterprise assistant fielding arbitrary employee questions) — an SLM's
narrower training will produce more failures/hallucinations on
out-of-distribution requests. **Use** an LLM there instead.

#### 1.1.2 Self-hosted vs. SaaS

| Dimension | Self-hosted | SaaS |
|---|---|---|
| Operational burden | You manage infrastructure, scaling, patching, uptime | Provider manages all of that |
| Data residency/control | Full control over where data/model weights live | Data leaves your infrastructure boundary (subject to provider's controls/contracts) |
| Customization depth | Full control over fine-tuning, serving stack, versioning | Limited to what the provider's API/product exposes |
| Cost model | Capex/infra cost, scales with your own utilization | Opex, typically pay-per-use/API pricing |
| Time to production | Slower — you build the serving stack | Faster — you consume an API |

**Don't use** self-hosting when you don't have the operational capacity
to run and secure a model-serving stack, or when your usage volume
doesn't justify the fixed infrastructure cost — you'll pay in
engineering time and reliability risk for control you don't need.
**Use** SaaS there instead.

**Don't use** SaaS when regulatory/data-residency requirements mandate
that data (including prompts sent to the model) never leave a specific
security boundary you control, or when you need deep customization of
the serving stack itself (e.g., custom quantization, exotic batching
strategies) — a SaaS API can't give you that level of control. **Use**
self-hosted deployment there instead.

#### 1.1.3 OSS vs. proprietary LLM

| Dimension | OSS (open-source software) LLM | Proprietary LLM |
|---|---|---|
| Transparency | Weights/architecture inspectable, auditable | Closed — you consume an API/service, internals opaque |
| Portability | Can be self-hosted anywhere, avoids vendor lock-in | Tied to the provider's platform/API |
| Peak capability | Varies — frontier proprietary models often lead on the hardest reasoning benchmarks at any given time | Often at or near the capability frontier |
| Licensing/legal review | Requires reviewing the specific OSS license terms (not all "open" models permit unrestricted commercial use) | Governed by the provider's commercial terms |
| Fine-tuning/modification rights | Typically full rights to modify/fine-tune (license-dependent) | Limited to what the provider's fine-tuning product allows, if any |

**Don't use** a proprietary-only strategy when portability/vendor
lock-in avoidance or full model-weight auditability is a hard
requirement (e.g., a regulated industry needing to audit exactly what
the model does) — proprietary APIs don't expose that. **Use** OSS
there instead, self-hosted if needed.

**Don't use** OSS by default just because it's "open" without checking
whether it meets the raw capability bar the task needs — some tasks
genuinely need frontier-level reasoning that a smaller open model
can't yet match. **Use** the strongest model that clears your
capability bar within your cost/security constraints, whichever
licensing category it falls in — this is a "considering cost,
security, and agent architecture" decision (the guide's own qualifier
on this task bullet), not an ideological one.

#### 1.1.4 Putting all three axes together: a worked decision framework

```
                     ┌─────────────────────────────┐
                     │ What does the task actually    │
                     │ require? (reasoning breadth,    │
                     │ volume, latency budget)          │
                     └───────────────┬─────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
     Narrow, high-volume,     Broad reasoning,          Regulated data /
     latency-sensitive        ambiguous input           full auditability
              │                       │                       │
              ▼                       ▼                       ▼
        Lean SLM               Lean LLM                Lean self-hosted
              │                       │                 OSS (any size)
              ▼                       ▼                       │
     ┌────────────────┐     ┌────────────────┐               ▼
     │ Cost/latency OK  │     │ Data residency  │     ┌────────────────┐
     │ with SaaS?        │     │ OK with SaaS?    │     │ Confirm license │
     └───────┬──────────┘     └───────┬──────────┘     │ permits your    │
             │yes         │no          │yes        │no  │ use case        │
             ▼            ▼            ▼           ▼    └────────┬────────┘
        SaaS SLM   Self-hosted SLM  SaaS LLM  Self-hosted LLM      ▼
                                                              Self-host on
                                                              your own infra
                                                              (GKE/Cloud Run
                                                              serving stack)
```

Diagram walkthrough: the decision tree resolves each axis in sequence
— first task shape (drives LLM-vs-SLM), then data/regulatory
constraints (drives self-hosted-vs-SaaS), with OSS-vs-proprietary
folded in wherever self-hosting or auditability requirements apply.
This mirrors how PAA scenario questions are typically constructed:
they give you 2-3 constraints and expect you to walk this kind of
reasoning chain rather than pattern-match to a single "correct" model
name.

Two more Google-Cloud-specific in-scope names worth anchoring here,
even though the exam guide's Section 3.1 bullet itself stays
model-selection-generic: **Gemini LLMs** (Google's proprietary,
SaaS-delivered model family) and **Model Garden** (Google Cloud's
model catalog/hub, through which both Google and third-party/open
models, including many OSS options, can be discovered and deployed).
When a scenario names a specific Google Cloud surface for model
selection, Model Garden is the tool that spans multiple points on the
OSS/proprietary and self-hosted/SaaS axes simultaneously — it's the
catalog you'd browse to compare options across this whole decision
framework, not a model itself.

### 1.2 Building custom agents using ADK (Agent Development Kit)

**ADK (Agent Development Kit)** is explicitly described in the exam
guide as an **open-source** library for building custom agents. This
is one of the currency corrections flagged most heavily in this
folder's `CLAUDE.md` — do not describe ADK as closed-source or
Google-proprietary.

What ADK actually gives you as a builder:

- A code-first framework for defining an agent's core loop: how it
  receives input, decides what tool(s) to call, calls them, and
  produces output — the fundamental "agent" abstraction this whole
  section builds on top of.
- Structured integration points for tools/**function-calling** (also
  called tool-calling — the mechanism by which the model itself decides
  mid-response to invoke a specific external function/API rather than
  just generating text, which is exactly the "decides what tool(s) to
  call, calls them" step described above), so an agent's available
  actions are defined as code (not just prose instructions the model
  might or might not follow reliably — a meaningful difference from
  Section 1's low-code, instruction-driven approach).
- The foundation other Section 3 capabilities plug into: sessions and
  memory (§1.3 below), enterprise knowledge integration (Section 3.2),
  and orchestration protocols (Section 3.3) are all things you wire
  into an ADK-built agent's code, not settings you toggle in a
  low-code console.

**Don't use** ADK when a low-code Gemini Enterprise agent (Section 1)
already meets the requirement — building custom code for something a
console can configure is unnecessary engineering overhead, slower to
ship, and harder to maintain for non-developers. **Use** ADK when you
need capabilities low-code tools don't expose: custom orchestration
logic, fine-grained tool-calling control, custom multi-agent
coordination, or integration with bespoke internal systems that don't
have an off-the-shelf connector.

**Don't use** ADK as a synonym for "any custom agent code" broadly —
ADK is a specific named open-source library the guide calls out; a
scenario testing "build a custom agent" is very likely testing whether
you know ADK by name and know it's open-source, not just testing
generic coding ability.

### 1.3 Configuring sessions and memory

Task 3.1's third bullet: **"Configuring sessions and memory (e.g.,
Agent Platform Memory Bank and managed sessions)."** Two related but
distinct capabilities:

- **Managed sessions** — the mechanism for maintaining state *within* a
  single ongoing interaction (a conversation, a multi-turn task): what
  was said, what parameters have been collected, where the agent is in
  a multi-step process. A managed session is what lets an agent
  remember turn 1's context by turn 5 of the *same* interaction,
  without the calling application having to manually thread all prior
  turns through every request.
- **Agent Platform Memory Bank** — longer-lived memory that can persist
  **across** sessions — facts, preferences, or history the agent
  should retain about a user or context beyond a single conversation
  (e.g., "this customer prefers email over phone," learned in a
  session last month, still known today). Memory Bank is part of the
  broader **Agent Platform** (the umbrella also containing Agents CLI
  and, in this context, sessions).

```
   ┌───────────────────────────────────────────────────────────────┐
   │                         Agent Platform                          │
   │  ┌───────────────────┐          ┌────────────────────────┐     │
   │  │  Managed sessions   │          │  Memory Bank             │     │
   │  │  (within ONE         │          │  (ACROSS sessions,       │     │
   │  │  conversation/task)  │◄────────►│  persistent user/context │     │
   │  │                       │  agent   │  facts and preferences)  │     │
   │  │  Turn 1 → Turn 2 →... │  reads/  │                          │     │
   │  │                       │  writes  │  "prefers email"         │     │
   │  └───────────────────────┘          │  "VIP tier customer"     │     │
   │                                       └────────────────────────┘     │
   └───────────────────────────────────────────────────────────────┘
```

Diagram walkthrough: a managed session is scoped to the lifetime of
one interaction; Memory Bank is scoped across many interactions over
time. An agent typically reads from Memory Bank at the start of a new
session (to recall relevant history) and can write new durable facts
back to Memory Bank during or at the end of a session — while ordinary
turn-by-turn conversational state stays in the session itself and
doesn't need to be promoted to long-term memory unless it's actually
worth retaining.

**Don't use** Memory Bank to store every turn of every conversation
indefinitely — that's session-scoped data, not durable memory, and
treating it as durable memory bloats retrieval, raises privacy/
retention exposure, and buries genuinely useful long-term facts in
noise. **Use** managed sessions for in-conversation state, and
selectively promote only meaningfully durable facts to Memory Bank.

**Don't use** session-only state when a requirement explicitly needs
"the agent should remember this customer's preference across future,
unrelated conversations" — a session ends when the interaction ends,
so nothing in it persists to the next one without Memory Bank. **Use**
Memory Bank for any requirement phrased in terms of persistence beyond
a single interaction.

### 1.4 Configuring skills using Agents CLI: plugins and agent vs. human mode

Task 3.1's fourth bullet: **"Configuring skills using Agents CLI (e.g.,
plugins and agent vs. human mode)."** This is the *build-time*
counterpart to Section 2.2's Agents CLI coverage (which framed Agents
CLI as the build/scale/govern/optimize operational layer for deployed
coding-agent output). Here, in Section 3.1, the same Agents CLI
concepts — **plugins** and **agent vs. human mode** — apply to
configuring a **custom agent's** skills as you build it, not just to
operating already-deployed coding-agent artifacts.

- **Plugins** (in this context) — modular capability add-ons you attach
  to a custom agent via Agents CLI configuration, extending what
  skills/tools the agent has available, analogous to how plugins
  extended coding agents in Section 2.2 but now applied to a custom
  runtime agent you're building with ADK.
- **Agent vs. human mode** — the same autonomy toggle introduced in
  Section 2.2: whether a given skill/action executes autonomously
  (agent mode) or requires a human to drive/approve it (human mode).
  For a custom agent being built for production use, this decision
  should be made per-capability, not globally — e.g., "read-only
  lookup tools run in agent mode; anything that modifies a customer's
  billing runs in human mode (or agent mode with mandatory
  human-in-the-loop approval — see Section 5.2's HITL coverage)."

**Don't use** a single global agent/human-mode setting across an
entire custom agent's full capability set — a blanket "always agent
mode" setting on a capability set that includes destructive or
high-stakes actions reintroduces exactly the ungated-autonomy risk
flagged elsewhere in this folder (Section 2.2's high-blast-radius
guidance, Section 5's HITL guardrails). **Use** per-capability mode
configuration, reserving human mode (or HITL-gated agent mode) for
higher-stakes actions.

---

## 2. Task 3.2 — Integrating enterprise domain knowledge

### 2.1 RAG pipelines and vector retrieval, end to end

Task 3.2's first bullet is dense and worth unpacking piece by piece:
**"Designing, configuring, and managing retrieval-augmented generation
(RAG) pipelines and vector retrieval systems (e.g., embedding models,
similarity scoring, and reranking) using appropriate services such as
vector databases (e.g., Vector Search and Agent Retrieval)."**

```
   ┌──────────────────┐
   │  Enterprise docs   │   1. ingest raw content (text, chunks
   │  (Cloud Storage,   │      of PDFs, structured records, etc.)
   │  BigQuery, etc.)   │
   └─────────┬──────────┘
             ▼
   ┌──────────────────┐
   │  Embedding model    │   2. convert each chunk into a dense
   │                     │      vector representation capturing
   │                     │      semantic meaning
   └─────────┬──────────┘
             ▼
   ┌──────────────────┐
   │  Vector database    │   3. store vectors for fast similarity
   │  (Vector Search 1.0/│      search (Vector Search 1.0 / Agent
   │   Agent Retrieval)  │      Retrieval)
   └─────────┬──────────┘
             │
             │  ◄── at QUERY time ─────────────────────────
             │
   ┌──────────────────┐
   │  User query          │   4. query is embedded with the SAME
   │  → embedded           │      embedding model used at ingest
   └─────────┬──────────┘      time (mismatch here silently
             ▼                  breaks retrieval quality)
   ┌──────────────────┐
   │  Similarity scoring  │   5. nearest-neighbor search finds
   │  (e.g., cosine sim)  │      the top-K most semantically
   └─────────┬──────────┘      similar stored chunks
             ▼
   ┌──────────────────┐
   │  Reranking            │   6. a (often more expensive, more
   │                       │      accurate) reranking step
   │                       │      reorders the top-K candidates
   │                       │      by finer-grained relevance
   └─────────┬──────────┘
             ▼
   ┌──────────────────┐
   │  LLM synthesizes      │   7. final reranked, relevant context
   │  grounded answer      │      is passed to the LLM as
   │  from top context     │      grounding context for generation
   └──────────────────┘
```

Diagram walkthrough — the concepts you must be able to name and place
correctly on this pipeline:

- **Embedding models** — convert text (or other modalities) into dense
  vectors placing semantically similar content close together in
  vector space. Step 2 and step 4 must use a **consistent** embedding
  model — a subtle but real exam trap: switching embedding models
  between ingestion and query time (e.g., after "upgrading" to a newer
  embedding model without re-embedding the existing corpus) silently
  degrades retrieval quality because the old and new vectors aren't
  comparable in the same space.
- **Similarity scoring** — the metric used to rank stored vectors
  against the query vector (commonly cosine similarity or a related
  distance metric). This produces an initial candidate set (top-K),
  typically optimized for speed over precision at this stage.
- **Reranking** — a second-pass step that re-scores the initial
  candidate set with a (often more computationally expensive, more
  accurate) model or scoring method, improving final relevance
  ordering before the content reaches the LLM. Reranking exists because
  fast approximate similarity search (step 5) is good at getting a
  relevant *set*, but not always the best at fine *ordering* — reranking
  trades some latency/cost for materially better top-result quality.

**Don't use** raw similarity-scored top-K results directly as
grounding context for a use case where answer precision matters a lot
(e.g., a compliance/policy-answering agent) without a reranking step —
you'll periodically ground the model on a merely "similar enough"
chunk instead of the truly best one. **Use** a reranking stage when
answer precision matters more than the added latency/cost.

**Don't use** reranking on every single query indiscriminately if
latency is the dominant constraint and the initial similarity-search
candidate set is already reliably good for your corpus/use case —
reranking adds cost and latency for a precision gain you may not need
everywhere. **Use** similarity scoring alone for latency-sensitive,
lower-precision-tolerance use cases, and reserve reranking for where
accuracy stakes are highest.

### 2.2 Vector Search 1.0 and Agent Retrieval

The guide names **Vector Search** (also referenced in the in-scope
tool list as **"Agent Retrieval and Vector Search 1.0"**) as the
vector-database service(s) for this custom-code RAG path. Hold two
distinctions firmly for the exam:

1. **Vector Search 1.0 / Agent Retrieval vs. Agent Search (Section
   1.2)** — Agent Search is the **low-code**, managed Gemini
   Enterprise grounding connector (console-configured, no pipeline
   code). Vector Search 1.0 / Agent Retrieval is the **custom-code**
   path you wire into an ADK-built agent yourself, giving you control
   over embedding model choice, chunking strategy, similarity metric,
   and reranking logic that a low-code connector doesn't expose.
2. **Vector Search 1.0 / Agent Retrieval as one option among the
   broader in-scope data-layer services** — BigQuery, Cloud SQL, Cloud
   Storage, Firestore, and Memorystore for Redis are all in scope as
   underlying data-layer services for agentic workflows (RAG sources,
   session/state storage, tool-integration targets — see §6 of the
   RUNBOOK), but Vector Search 1.0 / Agent Retrieval is specifically
   the vector-similarity-search layer, not a general-purpose database.

| Choose... | When... |
|---|---|
| **Agent Search** (Section 1.2) | You want a managed, low-code grounding connector inside Gemini Enterprise and don't need custom control over the retrieval pipeline internals |
| **Vector Search 1.0 / Agent Retrieval** (Section 3.2) | You're building a custom ADK agent and need programmatic control over embedding models, chunking, similarity scoring, and reranking |
| **BigQuery / Cloud SQL / Firestore** (data layer) | The knowledge is inherently structured/relational/document-shaped rather than needing semantic similarity search — e.g., exact lookups, transactional records |
| **Memorystore for Redis** (data layer) | Low-latency caching of session state or frequently accessed data, not semantic retrieval |

**Don't use** a general-purpose relational/document database (Cloud
SQL, Firestore) to do semantic similarity search over unstructured
text — those engines aren't built for nearest-neighbor vector search
at the core of RAG. **Use** Vector Search 1.0 / Agent Retrieval for
that; reserve the structured databases for the data they're suited to
(exact-match lookups, transactional state, structured records).

### 2.3 Configuring agent permissions: Agent Identity

Task 3.2's second bullet: **"Configuring agent permissions (e.g.,
Agent Identity)."** **Agent Identity** is the mechanism for defining
*what a given agent is allowed to do and access* — the agent-specific
analog of an **IAM** (Identity and Access Management — Google Cloud's
system for controlling which identities can do what to which
resources) identity/role, but purpose-built for agentic
workflows. This is the same tool used in Section 5.1 to configure
**PAB (principal access boundary)** policies, and it recurs in Section
3.3 as one of the tools used to configure multi-agent handoffs
securely. In Section 3.2's context, think of Agent Identity as
answering: *which enterprise data sources and capabilities is this
particular agent (or this particular deployed instance of an agent)
permitted to reach?*

**Don't use** a single, maximally-privileged shared identity across
every agent in your system for convenience — that violates
least-privilege and means a compromised or misbehaving agent has
blast radius across everything, not just its intended scope. **Use**
Agent Identity to scope each agent's permissions to only what that
specific agent's task requires.

*(Full PAB/policy-configuration depth is Section 5.1's job — this
section introduces Agent Identity as the mechanism; Section 5 covers
configuring it as a governance control in depth.)*

### 2.4 Google Cloud tools for prebuilt and custom capabilities: Agent Registry, Google Cloud MCP Servers

Task 3.2's third bullet: **"Using Google Cloud tools (e.g., Agent
Registry, Google Cloud MCP Servers) to configure prebuilt and custom
capabilities (e.g., custom integration layers for managed databases,
API integrations, and MCP server that connects agents to third-party
SaaS tools and remote servers)."**

- **Agent Registry** — a registry of agent capabilities/tools
  (prebuilt and custom) that agents can discover and use. Think of it
  as a catalog/directory layer: rather than every agent hard-coding
  knowledge of every tool it might need, Agent Registry lets
  capabilities be registered once and discovered/reused across agents
  — this is also the mechanism referenced again in Section 3.3 for
  multi-agent coordination (agents discovering each other's registered
  capabilities) and in Section 5 for governance (what capabilities
  exist and who/what can use them).
- **Google Cloud MCP Servers** — Google Cloud-provided MCP servers
  that expose Google Cloud's own managed services (databases, APIs,
  infrastructure) to agents through the standard MCP interface,
  distinct from a custom or third-party MCP server you might stand up
  yourself. The guide's example — "custom integration layers for
  managed databases, API integrations, and MCP server that connects
  agents to third-party SaaS tools and remote servers" — spans both:
  Google Cloud MCP Servers for Google-managed resources, and
  custom/third-party MCP servers for external SaaS tools/remote
  systems.

```
        ┌───────────────────────────┐
        │      Custom agent (ADK)     │
        └──────────────┬──────────────┘
                        │ discovers/calls capabilities via:
        ┌───────────────┼───────────────────────┐
        ▼               ▼                       ▼
  ┌───────────┐  ┌───────────────────┐  ┌────────────────────┐
  │ Agent      │  │ Google Cloud MCP    │  │ Custom/third-party  │
  │ Registry   │  │ Servers              │  │ MCP servers          │
  │ (catalog of│  │ (managed DB access,  │  │ (third-party SaaS    │
  │  capabili- │  │  Google Cloud API    │  │  tools, remote        │
  │  ties, pre-│  │  integrations)        │  │  systems)             │
  │  built +   │  │                       │  │                       │
  │  custom)   │  │                       │  │                       │
  └───────────┘  └───────────────────┘  └────────────────────┘
```

Diagram walkthrough: Agent Registry is the discovery/catalog layer;
Google Cloud MCP Servers and custom/third-party MCP servers are the
actual connection mechanisms an agent uses once it knows (via
discovery, or direct configuration) what capability it needs. A
capability can be registered in Agent Registry while being *backed* by
either kind of MCP server underneath.

**Don't use** ad hoc, agent-specific hard-coded tool integrations
duplicated across every agent that needs the same capability (e.g.,
five different agents each independently wiring up their own
connection to the same internal database) — that duplicates
maintenance burden and creates inconsistent permission/version
drift across agents. **Use** Agent Registry to register the capability
once (backed by a Google Cloud MCP Server or a custom MCP server) so
multiple agents can discover and reuse it consistently.

---

## 3. Task 3.3 — Orchestrating and coordinating agentic workflows

### 3.1 Agentic protocols: MCP and A2A

Task 3.3's first bullet: **"Orchestrating agents using agentic
protocols (e.g., MCP and Agent2Agent [A2A])."** These are two
different protocols solving two different problems — a distinction
tested heavily on this exam:

| Protocol | What it connects | Direction of relationship |
|---|---|---|
| **MCP (Model Context Protocol)** | An agent (client) to **tools/data sources** (servers) | Agent ↔ tool/resource |
| **A2A (Agent2Agent)** | One **agent** to another **agent** | Agent ↔ agent |

```
      ┌────────────┐   MCP    ┌────────────────┐
      │  Agent A     │◄───────►│  Tool / data      │
      │              │          │  source (MCP       │
      │              │          │  server)            │
      └──────┬──────┘          └────────────────┘
             │
             │ A2A
             ▼
      ┌────────────┐   MCP    ┌────────────────┐
      │  Agent B     │◄───────►│  A different tool  │
      │              │          │  / data source      │
      └────────────┘          └────────────────┘
```

Diagram walkthrough: Agent A uses **MCP** to reach a tool/data source
(a resource, not another agent), and uses **A2A** to communicate with
**Agent B**, a peer agent — which in turn has its own MCP connections
to its own tools. This is the core mental model: **MCP is for
agent-to-*tool*; A2A is for agent-to-*agent*.** A multi-agent system
typically uses both simultaneously — A2A for coordination between
agents, MCP for each individual agent's own tool access.

**Don't use** MCP to try to coordinate two peer agents working
together on a shared task — MCP's client/server model is built around
an agent consuming tools/resources, not peer agent-to-agent
negotiation/handoff semantics. **Use** A2A for agent-to-agent
coordination.

**Don't use** A2A as a way for an agent to call a plain tool or query a
data source — that's not what A2A is for; it's a protocol between
agents, not between an agent and a non-agent resource. **Use** MCP for
agent-to-tool/data connections.

### 3.2 Multi-agent handoffs and workflows: parallel, sequential, and graph

Task 3.3's second bullet: **"Selecting and coordinating multi-agent
handoffs and workflows (e.g., parallel agents, sequential agents, and
graph workflow) using Google Cloud tools (e.g., Agent Identity, Agent
Registry, Agent Runtime, and agent policies)."**

Three workflow topologies to compare directly:

```
SEQUENTIAL                    PARALLEL                      GRAPH
                                                              
 ┌───────┐                 ┌───────┐                    ┌───────┐
 │Agent A│                 │Agent A│                    │Agent A│
 └───┬───┘                 └───┬───┘                    └───┬───┘
     │                          │                            │
     ▼                    ┌─────┴─────┐              ┌───────┴───────┐
 ┌───────┐            ┌───────┐   ┌───────┐       ┌───────┐     ┌───────┐
 │Agent B│            │Agent B│   │Agent C│       │Agent B│     │Agent C│
 └───┬───┘            └───┬───┘   └───┬───┘       └───┬───┘     └───┬───┘
     │                    └─────┬─────┘               │  (cond.)    │
     ▼                          ▼                      └──────┬─────┘
 ┌───────┐                 ┌───────┐                        ▼
 │Agent C│                 │Merge/  │                   ┌───────┐
 └───────┘                 │Combine │                   │Agent D│
                            └───────┘                    │(condi-│
                                                            │tional)│
                                                            └───────┘
```

| Topology | Description | Best fit | Tradeoff |
|---|---|---|---|
| **Sequential** | Agents run one after another, each consuming the previous agent's output as input | Tasks with a strict, linear dependency chain (e.g., draft → review → finalize) | Simple to reason about and debug, but total latency = sum of every stage; a bottleneck anywhere delays everything downstream |
| **Parallel** | Multiple agents run concurrently on independent sub-tasks, results merged/combined afterward | Independent sub-tasks that don't depend on each other's output (e.g., simultaneously researching three unrelated topics) | Lower total latency than sequential for independent work, but adds merge/combination complexity and requires the sub-tasks to genuinely be independent |
| **Graph workflow** | Agents connected via a directed graph with conditional branches, loops, or dynamic routing based on intermediate results | Complex workflows where the next step depends on what a prior agent found (conditional logic, dynamic routing, possible loops) | Most flexible and powerful, but hardest to reason about, test, and debug — highest design/observability overhead |

**Don't use** sequential orchestration when sub-tasks are genuinely
independent and latency matters — you're paying for unnecessary
serialization. **Use** parallel orchestration to reduce total latency
when tasks don't depend on each other's outputs.

**Don't use** parallel orchestration when one agent's output must
determine or gate the next agent's input (e.g., a validation step must
pass before a downstream action runs) — running them concurrently
either produces wasted work or lets an invalid state slip through.
**Use** sequential orchestration for genuinely dependent, ordered
steps.

**Don't use** a rigid sequential or parallel structure when the
workflow needs conditional branching or looping based on intermediate
results (e.g., "if agent A's confidence is low, route to a
specialist agent; otherwise proceed directly") — neither purely linear
nor purely concurrent execution can express that. **Use** a graph
workflow when routing logic depends dynamically on intermediate
results.

**Don't use** a graph workflow as the default for every multi-agent
system "just in case" — its flexibility comes at a real cost in
design complexity, testability, and observability (harder to reason
about *which* path executed and why). **Use** the simplest topology
(sequential or parallel) that actually satisfies the task's real
dependency structure; reach for graph workflows only when the task
genuinely requires conditional/dynamic routing.

### 3.3 The Google Cloud tools that govern multi-agent coordination

The guide names four tools for coordinating multi-agent handoffs:
**Agent Identity, Agent Registry, Agent Runtime, and agent policies.**
How each fits into orchestration specifically:

| Tool | Role in multi-agent orchestration |
|---|---|
| **Agent Identity** | Each agent in a multi-agent system has its own identity/permission scope — a handoff from Agent A to Agent B should respect that Agent B operates under *its own* identity/permissions, not silently inherit Agent A's broader access |
| **Agent Registry** | How agents discover each other's registered capabilities in a multi-agent system — Agent A "finding" that Agent B exists and what it can do, rather than being hard-wired to it |
| **Agent Runtime** | The managed deployment/runtime environment (formerly Agent Engine) each agent in the workflow actually executes within — where the orchestrated agents are hosted and run |
| **Agent policies** | Governance/behavioral rules constraining how agents in the workflow are allowed to hand off, what they're allowed to do, and under what conditions — the policy layer enforced across the whole multi-agent system, not just one agent |

```
        ┌────────────────────────────────────────────────────────┐
        │                     Agent Runtime                         │
        │   (managed deployment/execution environment — formerly    │
        │    Agent Engine — where every orchestrated agent runs)     │
        │                                                             │
        │   ┌───────────┐   A2A handoff   ┌───────────┐              │
        │   │  Agent A   │────────────────►│  Agent B   │              │
        │   │  (own      │  discovered via  │  (own      │              │
        │   │  Agent     │  Agent Registry  │  Agent     │              │
        │   │  Identity) │                  │  Identity) │              │
        │   └───────────┘                  └───────────┘              │
        │         ▲                               ▲                    │
        │         └───────────┬───────────────────┘                    │
        │              agent policies                                  │
        │         (govern what handoffs are allowed,                   │
        │          under what conditions, with what limits)            │
        └────────────────────────────────────────────────────────┘
```

Diagram walkthrough: Agent Runtime is the execution environment
containing both agents; Agent Registry is how Agent A discovers Agent
B exists and is callable; the A2A handoff itself carries the actual
task/coordination; Agent Identity ensures Agent B runs under its own
distinct permission scope rather than inheriting Agent A's; and agent
policies sit above the whole interaction, constraining what handoffs
are permitted in the first place (a governance layer that connects
directly into Section 5's security/governance content).

**Don't use** an unscoped, implicit handoff where Agent B silently
executes with whatever permissions the calling context happens to
carry — this is exactly the kind of privilege-escalation risk a
scoped Agent Identity per agent is designed to prevent. **Use**
distinct Agent Identity scoping per agent, enforced by agent policies,
so a handoff never grants more access than Agent B's own defined
scope allows.

---

## 4. Cross-cutting worked example: putting 3.1 + 3.2 + 3.3 together

A single scenario, walked through the whole Section 3 stack, to show
how the three tasks compose in a realistic design:

**Scenario:** An enterprise wants a custom agentic system that
triages incoming support tickets: classify the ticket, retrieve
relevant internal knowledge-base content, draft a response, and — for
tickets above a certain complexity/risk threshold — route to a
specialist agent before a human reviews the final response.

- **3.1 (foundation):** Ticket classification is narrow and
  high-volume → a **self-hosted SLM** (fast, cheap) handles
  classification. Drafting a nuanced response needs broader reasoning
  → an **LLM** (SaaS, e.g. Gemini) handles drafting. Both are built as
  **ADK** agents. Conversation/ticket state within a single ticket's
  lifecycle uses **managed sessions**; recurring facts about a
  customer (e.g., prior escalation history) are read from/written to
  **Memory Bank**. Which actions run autonomously vs. require a human
  is configured per-capability via **Agents CLI** (agent mode for
  read-only knowledge-base lookups; human mode, or HITL-gated agent
  mode, for anything that closes or escalates a ticket).
- **3.2 (knowledge):** The classification/drafting agents retrieve
  relevant internal documentation through a custom **RAG pipeline** —
  documents embedded and stored in **Vector Search 1.0 / Agent
  Retrieval**, with **reranking** applied before grounding the
  drafting LLM (precision matters here — a wrong policy citation in a
  customer-facing draft is a real cost). Each agent's access to
  specific data sources is scoped via **Agent Identity**. The
  integration to the ticketing system itself, and to a specialist
  knowledge base owned by a different internal team, is exposed
  through **Agent Registry**-registered capabilities backed by
  **Google Cloud MCP Servers** (for Google-managed data stores) and a
  custom MCP server (for the third-party ticketing SaaS tool).
- **3.3 (orchestration):** The overall flow is **sequential** for the
  core path (classify → retrieve → draft), but becomes a **graph
  workflow** at the routing decision point — "if complexity/risk score
  exceeds threshold, hand off to specialist agent; otherwise proceed
  directly to human review." The classification-to-specialist handoff
  uses **A2A**; each agent's own tool/data access uses **MCP**. The
  whole system runs on **Agent Runtime**, with **agent policies**
  enforcing that the specialist handoff only fires within the intended
  complexity band and that no agent's Agent Identity permits it to
  close a ticket without passing through the human-review gate.

This single scenario deliberately touches nearly every named tool in
Section 3 — it's representative of how PAA scenario questions are
likely to be constructed: not "define ADK" in isolation, but "given
this system, which tool/pattern applies at this specific point."

---

## 5. Section 3 practice questions (22)

**Q1.** A team needs an agent to classify millions of short log lines
per day into one of six fixed categories, with strict latency and cost
budgets. Which model-selection axis combination best fits?
A) LLM, SaaS, proprietary
B) SLM, self-hosted or SaaS depending on ops capacity, OSS or proprietary depending on capability needs — but SLM is the dominant axis choice here
C) LLM, self-hosted, OSS
D) The size axis is irrelevant to this decision

*Answer: B.* High-volume, narrow, well-defined, latency/cost-sensitive
classification is the textbook SLM fit (§1.1.1); hosting and licensing
are secondary axes resolved by ops capacity and capability
requirements, not the dominant factor here. (A) and (C) both default
to LLM, which over-provisions capability the task doesn't need. (D) is
false — size is the primary axis this scenario is testing.

**Q2.** A regulated financial-services company must be able to fully
audit a model's internals and cannot allow model inference data to
leave their own infrastructure boundary under any circumstances. Which
combination of axes best fits?
A) LLM, SaaS, proprietary
B) SLM, SaaS, OSS
C) Self-hosted, OSS (any size, chosen by capability need)
D) Self-hosted, proprietary

*Answer: C.* Full auditability requires OSS (inspectable
weights/architecture) and the data-boundary requirement requires
self-hosting (§1.1.2, §1.1.3); size (LLM vs SLM) is decided separately
by capability need, not by the regulatory constraints in this
question. (A) and (B) both involve SaaS, violating the data-boundary
requirement. (D) is self-hosted but proprietary, which doesn't satisfy
full internal auditability the way OSS does.

**Q3.** Which statement is correct about ADK per the exam guide?
A) ADK is a closed-source, Google-proprietary library
B) ADK is explicitly described as an open-source library for building custom agents
C) ADK is a low-code tool equivalent to Agent Designer
D) ADK can only be used with proprietary Gemini models

*Answer: B.* Direct currency correction from `CLAUDE.md`/RUNBOOK §7 —
ADK is explicitly open-source per the guide. (A) is the exact wrong
claim to avoid. (C) confuses ADK (Section 3, custom code) with Agent
Designer (Section 1, low-code). (D) is unsupported — nothing in the
guide restricts ADK to a specific model provider.

**Q4.** A customer service agent needs to remember, across separate
conversations spanning several months, that a specific customer
prefers email contact over phone. Where should this fact be stored?
A) A managed session
B) Agent Platform Memory Bank
C) A vector database via Vector Search 1.0
D) Agent Registry

*Answer: B.* This is a cross-session, durable preference — exactly
Memory Bank's purpose (§1.3), distinct from session-scoped state which
ends when the interaction ends. (A) is wrong — sessions don't persist
across separate conversations. (C) is a knowledge-retrieval mechanism,
not a user-preference memory store. (D) is a capability
catalog/discovery mechanism, unrelated to memory.

**Q5.** What is the risk of embedding new documents with a different
embedding model than the one used for the existing indexed corpus,
without re-embedding the old content?
A) No risk — embedding models are always interchangeable
B) Retrieval quality silently degrades because vectors from different embedding models aren't comparable in the same space
C) The vector database will reject the new embeddings automatically
D) This only affects reranking, not initial similarity search

*Answer: B.* This is the embedding-model-consistency trap in §2.1 —
mixed embedding spaces silently produce poor similarity results rather
than throwing an obvious error. (A) is false and the exact
misconception the question tests. (C) is false — most vector stores
won't automatically detect/reject this. (D) is false — it affects the
initial similarity search itself (step 5), before reranking even runs.

**Q6.** Why might a team add a reranking step after initial
similarity-scored retrieval, even though it adds latency?
A) Reranking replaces the need for an embedding model entirely
B) Fast approximate similarity search is good at getting a relevant candidate set but not always the best fine-grained ordering; reranking improves that ordering at some cost
C) Reranking is required by Vector Search 1.0 and cannot be disabled
D) Reranking eliminates the need for a vector database

*Answer: B.* This is the precision-vs-latency tradeoff explained in
§2.1 — reranking trades cost/latency for materially better top-result
relevance ordering. (A), (C), (D) all mischaracterize reranking's
actual role in the pipeline.

**Q7.** Which best distinguishes Agent Search (Section 1) from Vector
Search 1.0 / Agent Retrieval (Section 3.2)?
A) They are the same service with two names
B) Agent Search is the low-code, managed Gemini Enterprise grounding connector; Vector Search 1.0 / Agent Retrieval is the custom-code path offering programmatic control over embedding, chunking, similarity, and reranking
C) Vector Search 1.0 is deprecated in favor of Agent Search
D) Agent Search only supports images; Vector Search 1.0 only supports text

*Answer: B.* This is the core low-code-vs-custom-code distinction the
exam draws consistently across both sections (§2.2). (A) collapses a
tested distinction. (C) is fabricated. (D) is fabricated and
unsupported by either section's content.

**Q8.** An architect wants to give five different custom agents access
to the same internal customer database without duplicating the
integration logic five separate times. What's the best-practice
approach?
A) Each agent independently hard-codes its own database connection
B) Register the capability once in Agent Registry, backed by a Google Cloud MCP Server or custom MCP server, so all five agents can discover and reuse it
C) Give all five agents the same shared Agent Identity with maximal privileges
D) Use A2A to let one agent share its database connection with the others at runtime

*Answer: B.* This is the exact anti-pattern/best-practice pairing in
§2.4 — register once, reuse via discovery, rather than duplicating
integrations. (A) is the anti-pattern being avoided. (C) violates
least-privilege (§2.3). (D) misuses A2A — it's for agent-to-agent
coordination, not for proxying tool/data access, which is MCP's job.

**Q9.** What is the fundamental difference between MCP and A2A?
A) MCP connects agents to other agents; A2A connects agents to tools
B) MCP connects an agent to tools/data sources; A2A connects one agent to another agent
C) They are interchangeable protocols for the same purpose
D) MCP is deprecated in favor of A2A

*Answer: B.* This is the core protocol distinction (§3.1) — MCP is
agent↔tool/resource; A2A is agent↔agent. (A) reverses the definitions.
(C) and (D) are false; both are named as distinct, actively in-scope
protocols.

**Q10.** A workflow needs three independent research sub-tasks (no
sub-task depends on another's output) completed as fast as possible,
with results combined at the end. Which topology fits best?
A) Sequential
B) Parallel
C) Graph workflow
D) None of these apply to independent sub-tasks

*Answer: B.* Independent, latency-sensitive sub-tasks are the
canonical parallel-orchestration fit (§3.2). (A) unnecessarily
serializes independent work. (C) adds unneeded conditional-routing
complexity for a case with no actual branching logic. (D) is false —
this is exactly what parallel orchestration is for.

**Q11.** A workflow requires: run agent A, then conditionally route to
either agent B or agent C depending on agent A's confidence score, and
possibly loop back to agent A if neither B nor C succeeds. Which
topology fits?
A) Sequential
B) Parallel
C) Graph workflow
D) A2A alone, without any workflow topology

*Answer: C.* Conditional branching and looping based on intermediate
results is exactly what graph workflows are for, and neither purely
linear (sequential) nor purely concurrent (parallel) execution can
express this. (A) and (B) cannot express conditional branching/loops.
(D) confuses a coordination protocol (A2A) with a workflow topology —
A2A would still be used for the actual agent-to-agent handoffs *within*
whichever topology is chosen.

**Q12.** In a multi-agent handoff from Agent A to Agent B, what should
happen to Agent B's effective permissions?
A) Agent B should inherit Agent A's full permission scope automatically
B) Agent B should execute under its own distinct Agent Identity, scoped to only what Agent B's task requires
C) Permissions are irrelevant once a handoff occurs
D) Agent B should have broader permissions than Agent A by default, to handle unexpected cases

*Answer: B.* This is the least-privilege handoff principle from §3.3 —
each agent keeps its own scoped identity; a handoff shouldn't silently
escalate privilege. (A) and (D) both describe privilege-escalation
risks the design explicitly guards against. (C) is false — permissions
matter precisely because of possible privilege escalation across
handoffs.

**Q13.** Which Google Cloud tool is described as how agents discover
each other's (or a system's) registered capabilities in a multi-agent
system?
A) Agent Runtime
B) Agent Registry
C) Agent Gateway
D) Model Armor

*Answer: B.* Agent Registry is the catalog/discovery layer (§2.4,
§3.3). (A) Agent Runtime is the execution/deployment environment, not
a discovery mechanism. (C) and (D) are Section 5 security/governance
tools (traffic monitoring and safety guardrails respectively), not
discovery mechanisms.

**Q14.** What is Agent Runtime, and what should you never call it on
this exam except when explicitly noting the historical name?
A) The low-code grounding connector; never call it "Vertex AI Search"
B) The managed agent deployment/execution environment; never call it "Agent Engine" except when explicitly noting the rename
C) The multi-agent coordination protocol; never call it "A2A"
D) The permissions/policy configuration tool; never call it "IAM"

*Answer: B.* This is the single most emphasized currency correction in
this folder. (A) describes Agent Search, a different service with a
different old name (Vertex AI Search). (C) and (D) mischaracterize
Agent Runtime's role entirely.

**Q15.** A team defaults to using a graph workflow for every
multi-agent system they build, even ones with a strictly linear
dependency chain and no conditional branching. What's the issue with
this approach?
A) Graph workflows are strictly forbidden by the exam guide
B) Graph workflows add unnecessary design, testability, and observability overhead when a simpler topology (sequential, here) would fully satisfy the actual dependency structure
C) Graph workflows cannot be used with Agent Runtime
D) There is no issue — graph workflows should always be the default

*Answer: B.* This is the "don't use graph workflow as a default"
tradeoff from §3.2 — match topology to actual task structure; more
flexibility than needed is pure overhead, not a benefit. (A) is false
— nothing forbids graph workflows, they're just inappropriate here.
(C) is fabricated. (D) is the exact anti-pattern the guidance warns
against.

**Q16.** Which best characterizes "agent policies" in the context of
task 3.3's multi-agent coordination tools?
A) A per-user IAM role unrelated to agents
B) Governance/behavioral rules constraining how agents in a workflow may hand off tasks and what they're permitted to do, enforced across the whole multi-agent system
C) A synonym for Agent Identity
D) A deprecated term replaced by "Agent Runtime"

*Answer: B.* This matches §3.3's framing directly. (A) is a
mischaracterization — agent policies are agent-workflow-specific
governance, not generic IAM. (C) conflates two distinct tools — Agent
Identity scopes an individual agent's permissions; agent policies
govern the workflow's handoff/behavior rules more broadly. (D) is
fabricated.

**Q17.** A custom agent's capability set includes both read-only
knowledge-base lookups and an action that permanently deletes customer
records. Per the guidance on agent-vs-human mode configuration in
§1.4, what's the best-practice configuration?
A) Set the entire agent to agent mode globally, since it's more efficient
B) Configure agent mode for the read-only lookups and human mode (or HITL-gated agent mode) specifically for the destructive delete action
C) Set the entire agent to human mode globally, eliminating all autonomy
D) Mode configuration is irrelevant to destructive actions

*Answer: B.* Per-capability mode configuration, matching risk to
oversight level, is the explicit best practice (§1.4) — not a single
global setting. (A) is the flagged anti-pattern (blanket agent mode
across a capability set including destructive actions). (C)
over-corrects and eliminates useful autonomy for low-risk actions. (D)
is false — this is precisely where mode configuration matters most.

**Q18.** In the worked example (§4), why is reranking specifically
called out as important for the knowledge-retrieval step feeding the
response-drafting LLM?
A) Reranking is mandatory for all Vector Search 1.0 deployments regardless of use case
B) The use case (customer-facing draft responses citing policy) has high precision stakes — a wrong citation is costly, so the extra reranking latency/cost is justified
C) Reranking is unrelated to precision and only affects retrieval speed
D) Reranking replaces the need for Agent Identity scoping

*Answer: B.* This matches the tradeoff framing in §2.1 applied to the
worked example — reranking is justified specifically because precision
stakes are high here, not as a blanket requirement. (A) overgeneralizes
into a universal mandate the guide doesn't state. (C) mischaracterizes
what reranking does. (D) confuses two unrelated concerns (retrieval
quality vs. permission scoping).

**Q19.** Why does the worked example in §4 use a sequential topology
for the core classify→retrieve→draft path but switch to a graph
workflow at the specialist-routing decision point?
A) Because graph workflows are always better than sequential ones
B) Because the core path has a strict linear dependency chain, while the routing decision requires conditional branching based on an intermediate result (the complexity/risk score) — matching topology to actual structure
C) Because Agent Runtime requires switching topologies partway through every workflow
D) Because A2A can only be used within graph workflows

*Answer: B.* This demonstrates topology selection matching actual task
structure (§3.2) — linear dependency for the core path, conditional
branching only where genuinely needed. (A) contradicts the
"don't default to graph workflow" guidance. (C) and (D) are fabricated
constraints not present anywhere in this content.

**Q20.** Which of the following correctly pairs a Section 3.2 concept
with its role?
A) Agent Identity → discovers other agents' capabilities
B) Agent Registry → scopes an individual agent's data-access permissions
C) Vector Search 1.0 / Agent Retrieval → the vector-database layer for custom RAG pipelines
D) Google Cloud MCP Servers → a multi-agent handoff protocol

*Answer: C.* This is the correct pairing per §2.2. (A) and (B) swap
Agent Identity's and Agent Registry's actual roles (Identity scopes
permissions; Registry enables discovery — the reverse of what's
stated). (D) mischaracterizes Google Cloud MCP Servers, which expose
Google Cloud-managed resources via MCP (agent-to-tool), not a
handoff protocol (that's A2A, agent-to-agent).

**Q21.** A team is deciding whether their new custom agent needs to be
built with ADK, or whether a Gemini Enterprise low-code agent
(Section 1) would suffice. The use case is a straightforward FAQ
agent grounded on a single document set, with no custom orchestration
or multi-agent coordination needs. What's the right call?
A) Build it with ADK — custom code is always more capable
B) Use the low-code Gemini Enterprise agent — building custom ADK code for a need a console can already configure is unnecessary overhead
C) ADK is required for any agent that uses Agent Search
D) Neither approach can handle document-grounded FAQ answering

*Answer: B.* This matches the explicit don't-use/use guidance in §1.2
— reach for ADK only when you need capabilities low-code tools don't
expose. (A) overstates ADK's necessity — capability isn't the only
consideration; unnecessary engineering overhead is a real cost. (C) is
false — Agent Search is a Section 1 low-code tool, unrelated to
requiring ADK. (D) is false — this is exactly the low-code use case
Section 1 is built for.

**Q22.** True or False: "Agent Retrieval" and "Vector Search 1.0" as
named in the exam guide's in-scope tool list refer to the same
custom-code vector-database capability area, distinct from the
low-code Agent Search grounding connector.
A) True
B) False — Agent Retrieval is a low-code tool and Vector Search 1.0 is a custom-code tool
C) False — they are unrelated services with no connection to RAG at all
D) True, but only Vector Search 1.0 is actually in scope for the exam

*Answer: A.* The guide's own in-scope list groups them together
("Agent Retrieval and Vector Search 1.0"), and both belong to the
custom-code RAG/vector-retrieval path covered in Section 3.2, distinct
from Section 1.2's low-code Agent Search. (B) fabricates a split not
supported by the guide's own grouped listing. (C) is false — both are
squarely RAG/retrieval-related. (D) is false — the RUNBOOK's in-scope
list includes both together as one line item.

---

## 6. Quick-reference recap

| Concept | One-line definition | Don't confuse with |
|---|---|---|
| LLM vs SLM | Reasoning breadth/cost/latency tradeoff by model size | Self-hosted vs SaaS or OSS vs proprietary (a separate axis each) |
| Self-hosted vs SaaS | Operational control vs. operational convenience | LLM vs SLM (a separate axis) |
| OSS vs proprietary | Auditability/portability vs. peak-capability convenience | Self-hosted vs SaaS (OSS can be SaaS-delivered too, in principle) |
| ADK | Open-source library for building custom agents in code | Low-code Gemini Enterprise tools (Agent Designer, CX Agent Studio) |
| Managed sessions | State within ONE ongoing interaction | Memory Bank (persists ACROSS interactions) |
| Agent Platform Memory Bank | Durable, cross-session memory of facts/preferences | Managed sessions (single-interaction scope) |
| Agents CLI plugins / agent vs human mode | Build-time skill/capability configuration + autonomy toggle | Section 2.2's operational build/scale/govern/optimize framing (same tool, different lifecycle stage) |
| Embedding model | Converts content to vectors for similarity search | Similarity scoring (the ranking step, not the vectorization step) |
| Similarity scoring | Fast initial candidate ranking (e.g., cosine similarity) | Reranking (a second, finer-grained re-scoring pass) |
| Reranking | Second-pass, higher-precision re-scoring of top-K candidates | Similarity scoring (the first-pass, faster ranking) |
| Vector Search 1.0 / Agent Retrieval | Custom-code vector database for RAG pipelines | Agent Search (low-code grounding connector, Section 1.2) |
| Agent Identity (Section 3.2/3.3 context) | Scopes an individual agent's permissions/access | Agent Registry (discovery, not permission scoping) |
| Agent Registry | Catalog/discovery layer for prebuilt and custom capabilities | Agent Identity (permission scoping, not discovery) |
| Google Cloud MCP Servers | Google-provided MCP servers exposing Google Cloud managed resources | Custom/third-party MCP servers (external SaaS/remote systems) |
| MCP | Agent-to-tool/data-source protocol | A2A (agent-to-agent protocol) |
| A2A (Agent2Agent) | Agent-to-agent coordination protocol | MCP (agent-to-tool protocol) |
| Sequential workflow | Strict linear dependency chain | Parallel (independent, concurrent) or graph (conditional/looping) |
| Parallel workflow | Independent sub-tasks run concurrently, merged after | Sequential (dependent, ordered) |
| Graph workflow | Conditional branching/looping based on intermediate results | Sequential/parallel (both lack conditional routing) |
| Agent Runtime | Managed deployment/execution environment for agents (formerly Agent Engine) | Agent Registry (discovery) or Agent Identity (permissions) |
| Agent policies | Governance rules constraining workflow-level agent behavior/handoffs | Agent Identity (scopes one agent; policies govern the workflow) |
