# Pattern — Custom ADK Agent With RAG, Memory, and Managed Skills

> **Pattern summary:** A custom-built agent written against the
> **Agent Development Kit (ADK)** — an open-source library for building
> agents in code — with a full retrieval-augmented-generation (**RAG**)
> pipeline (**RAG Engine** + **Vector Search 1.0** + **Agent
> Retrieval**), durable conversation state via **managed sessions** and
> **Agent Platform Memory Bank**, and a governed set of invokable
> capabilities managed through **Agents CLI**-configured skills.
>
> **Primary exam tasks:** 3.1 (Designing and building agentic workflows
> in code), 3.2 (Integrating enterprise domain knowledge). Section 3 is
> ~33% of the exam — the single heaviest section. This pattern (and
> `pattern-multi-agent-a2a-mcp-orchestration.md`, which extends it to
> multi-agent) is the architectural core of that weight.
>
> **Currency reminders applied in this file:** **ADK is open-source**,
> never described as closed/proprietary. Component names match
> `02-services/03-adk-custom-development.md` exactly — read that file
> first if any term below (managed sessions vs. Memory Bank, RAG Engine
> vs. Vector Search 1.0 vs. Agent Retrieval) is unfamiliar.

---

## 1. What this pattern is, and when you reach for it

**Ground-zero framing first.** Where `pattern-low-code-cx-agent.md`
builds an agent by configuring a console, this pattern builds one by
writing code against **ADK**, an open-source library specifically for
agent development. "Custom" here means the developer has full control
over the agent's reasoning loop, its retrieval logic, its memory
model, and what capabilities ("skills," "tools") it's allowed to
invoke — none of it constrained to what a low-code builder's UI
exposes.

**Retrieval-augmented generation (RAG)**, introduced here from zero
since it's central to this pattern: an LLM's knowledge comes from its
training data, which is fixed and general — it doesn't know an
organization's internal documents, and it can't learn new facts after
training without help. RAG is the technique of **retrieving** relevant
content from an external knowledge source at the moment a question is
asked, and feeding that retrieved content into the model's prompt so
it can **generate** an answer grounded in real, current, specific
information rather than guessing from general training. An
**embedding** is a numeric representation of a piece of text (or
image, audio, etc.) that captures its meaning as a list of numbers —
similar meanings produce similar (numerically close) embeddings, which
is what makes semantic (meaning-based, not just keyword-based) search
possible. A **vector database** is a data store purpose-built to hold
embeddings and quickly find the ones closest to a given query
embedding.

This pattern is the code-first counterpart to Agent Search
(`pattern-low-code-cx-agent.md` §6.2) — same underlying idea
(retrieve real content, ground the answer in it), but with every stage
of the pipeline exposed for a developer to configure directly.

**Reach for this pattern when:**
- The retrieval need is non-default enough that Agent Search's
  connector model doesn't give enough control — a custom chunking
  strategy, a specific embedding model, or custom reranking logic.
- The agent needs genuine multi-step reasoning, not a state-machine
  conversation flow — arbitrary code paths, conditional logic, calling
  multiple tools in sequence to complete one task.
- The agent needs memory that persists in a specific, developer-defined
  way — not just "whatever the console gives you."
- The eventual system will grow into multiple coordinating agents (see
  `pattern-multi-agent-a2a-mcp-orchestration.md`) — a single custom
  ADK agent is the natural single-agent building block that pattern
  assembles from.

---

## 2. The building blocks, briefly (full detail lives in `02-services/03-adk-custom-development.md`)

| Block | One-line role in this pattern |
|---|---|
| **ADK** | The open-source library the agent's code is written against — the framework for the reasoning loop, tool-calling, and wiring everything else below together. |
| **Managed sessions** | Durable, within-conversation state — what the agent remembers for the rest of *this* conversation. |
| **Agent Platform Memory Bank** | Durable, cross-conversation state — what the agent still knows the *next* time this user/context comes back. |
| **RAG Engine** | The managed pipeline layer — orchestrates chunking, embedding, and coordinating retrieval + reranking. |
| **Vector Search 1.0** | The vector database underneath RAG Engine — stores embeddings, answers nearest-neighbor similarity queries. |
| **Agent Retrieval** | The scoring/reranking layer above Vector Search 1.0 — turns raw nearest-neighbor matches into a ranked, relevant context set. |
| **Agents CLI** | Configures the agent's **skills** (packaged, reusable, invokable capabilities) and **agent-vs-human mode** per skill/interaction point — the governance layer over what this custom agent is allowed to actually do. |
| **Model Garden / Gemini LLMs** | Where the underlying model is selected from — full treatment in `02-services/01-gemini-enterprise-low-code.md` §6–§7; this pattern assumes the model choice is made and focuses on everything around it. |

---

## 3. Full production architecture

```
                    ┌───────────────────────────────────────┐
                    │           Requesting client               │
                    │   (a UI, an API caller, another agent       │
                    │    via A2A — see pattern-multi-agent-        │
                    │    a2a-mcp-orchestration.md)                  │
                    └───────────────────┬─────────────────────┘
                                        │ (1) request / conversation turn
                                        ▼
     ┌────────────────────────────────────────────────────────────────────┐
     │                          ADK AGENT (your code)                        │
     │                                                                        │
     │  ┌──────────────────┐         ┌───────────────────────────────┐    │
     │  │  Managed sessions   │◄──(2)─►│   Agent Platform Memory Bank      │    │
     │  │  this-conversation    │         │  cross-conversation, long-          │    │
     │  │  working state          │         │  term memory                        │    │
     │  └──────────────────┘         └───────────────────────────────┘    │
     │            │ (3) load prior turn state + relevant long-term memory      │
     │            ▼                                                          │
     │  ┌───────────────────────────────────────────────────────────────┐  │
     │  │              Reasoning loop (the model, via Gemini LLM /            │  │
     │  │              Model Garden-selected model, deciding what to do)       │  │
     │  └──────┬───────────────────────────────────┬────────────────────┘  │
     │         │ (4) needs enterprise knowledge         │ (5) needs a skill/tool
     │         ▼                                        ▼
     │  ┌──────────────────────┐            ┌───────────────────────────┐  │
     │  │   RAG retrieval call     │            │    Skill invocation          │  │
     │  └──────────┬───────────┘            │  (governed by Agents CLI:      │  │
     │             │                          │   which skills exist,           │  │
     └─────────────┼──────────────────────────┤   agent-vs-human mode per       │  │
                    │                          │   invocation point)              │  │
                    │                          └──────────────┬────────────────┘
                    │ (6)                                     │ (7) tool call
                    ▼                                        ▼
     ┌───────────────────────────────────────┐   [ MCP-connected tool / data
     │              RAG ENGINE                    │     source — full treatment in
     │   orchestrates: chunking, embedding,          │     pattern-multi-agent-a2a-mcp-
     │   query + rerank coordination                  │     orchestration.md ]
     └────────┬──────────────────────┬───────────┘
              │ (8) store vectors        │ (10) query embedding
              ▼                          ▼
     ┌────────────────────┐    ┌────────────────────────┐
     │  Vector Search 1.0    │◄──►│    Agent Retrieval          │
     │  embeddings, nearest-   │(9) │  similarity scoring +        │
     │  neighbor similarity     │    │  reranking                    │
     └────────┬───────────┘    └───────────┬────────────┘
              │ (11) raw matches                          │ (12) ranked, relevant context
              └──────────────────────────────┬────────────┘
                                             ▼
                              [ back into the reasoning loop,
                                arrow 4's caller, as grounding
                                context for the response ]
                                             │
                                             ▼
                    ┌───────────────────────────────────────┐
                    │        Response assembled + returned       │
                    │   session state updated (arrow 2);           │
                    │   durable facts persisted to Memory Bank       │
                    └───────────────────────────────────────┘

     Ingestion path (feeds Vector Search 1.0, runs independently of
     any single conversation):
     ┌───────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
     │  Enterprise source     │──(13)─►│      RAG Engine            │──(14)─►│  Vector Search 1.0     │
     │  content (Cloud Storage, │        │  ingestion: chunking,        │        │  (same store as above)   │
     │  BigQuery, Cloud SQL —     │        │  embedding                     │        └─────────────────────┘
     │  see 02-services/07)         │        └─────────────────────┘
     └───────────────────┘
```

---

## 4. Arrow-by-arrow walkthrough

1. **A request arrives.** Unlike the CX-agent pattern's channel-based
   entry, a custom ADK agent's caller can be anything with API access —
   a UI, a backend service, or, in a multi-agent system, another agent
   handing off work via A2A (Agent2Agent — the agent-to-agent protocol
   covered fully in `pattern-multi-agent-a2a-mcp-orchestration.md`;
   this single-agent pattern is the building block that system
   assembles from).
2. **The agent loads relevant state from managed sessions and Memory
   Bank.** These answer two different questions, per
   `02-services/03-adk-custom-development.md` §3–§4's decision note:
   managed sessions holds what's needed for *this* conversation (the
   task in progress, parameters already collected); Memory Bank holds
   what should carry forward from *previous, separate* conversations
   (a returning user's known preferences, a fact learned in an earlier
   session). A production agent typically consults both on every turn.
3. **State is loaded into the reasoning loop's context** before the
   model does any actual reasoning about this turn.
4. **The reasoning loop — the underlying model, via a Gemini LLM or
   another model selected through Model Garden — decides what this
   turn needs.** If it needs a fact grounded in enterprise content it
   doesn't already have in context, it triggers a RAG retrieval call.
5. **If it needs to actually *do* something** — call an external
   system, run a calculation, take an action — it invokes a **skill**,
   governed by Agents CLI configuration (see §5 below).
6. **The RAG retrieval call reaches RAG Engine**, the managed
   pipeline-orchestration layer.
7. **A skill invocation reaches a tool** — how that tool call is
   actually made (via MCP) is the subject of
   `pattern-multi-agent-a2a-mcp-orchestration.md`; this pattern treats
   "invoke a skill" as the boundary and hands off the mechanics there.
8. **(Ingestion side, arrow 8/13/14, running independently of any
   single conversation)**: RAG Engine's ingestion pipeline stores
   embeddings produced from enterprise source content into Vector
   Search 1.0 — this happens on its own schedule/trigger, not per
   conversation turn, keeping the index current as source content
   changes.
9. **At query time, RAG Engine coordinates the query-and-rerank
   cycle**: Vector Search 1.0 does the nearest-neighbor lookup, and
   Agent Retrieval applies similarity scoring and reranking on top of
   the raw results.
10. **The current turn's query is embedded** and sent to Vector Search
    1.0 as a search vector.
11. **Vector Search 1.0 returns raw nearest-neighbor matches.**
12. **Agent Retrieval reranks and scores them**, producing a ranked,
    relevant context set — this is what actually gets fed back into
    the reasoning loop, not the raw unranked matches, because raw
    vector similarity alone can surface topically-close-but-wrong or
    redundant near-duplicate content (see
    `02-services/03-adk-custom-development.md` §7).
13. **Once the reasoning loop has whatever grounding context and/or
    skill results it needed, it assembles a response.** Session state
    is updated for the next turn of this conversation (managed
    sessions), and any fact worth remembering beyond this conversation
    is persisted to Memory Bank — e.g., a stated user preference gets
    written so a future, separate conversation with the same user
    starts already knowing it.

---

## 5. How Agents CLI governs skills in this pattern

This is where task 3.1's "Configuring skills using Agents CLI (e.g.,
plugins and agent vs. human mode)" concretely applies to a custom ADK
agent, distinct from its role governing the coding-agent fleet in
`pattern-coding-agent-cicd-integration.md`. Here, a **skill** is a
packaged capability the ADK agent's reasoning loop can invoke —
"look up an order," "send a notification," "create a support ticket."
Agents CLI is where an architect configures, at the platform level
(not hard-coded into the agent's Python), which skills exist, which
agent(s) are allowed to invoke which skills, and — critically — the
**agent-vs-human mode** setting per skill or interaction point: does
invoking this skill happen fully autonomously, or does it require a
human approval step first? A skill like "look up an order status" is
a low-risk, read-only action well suited to agent mode; a skill like
"issue a refund over $500" is exactly the kind of action task 5.2's
human-in-the-loop (HITL) guardrail language is meant for — full
treatment of that gate is in
`pattern-secure-governed-enterprise-agent-platform.md`, but the
configuration point (which skills need it) is set here, at the
Agents CLI layer, as part of building the agent itself.

---

## 6. Design decisions and tradeoffs

### 6.1 RAG Engine's managed pipeline vs. hand-wiring Vector Search 1.0 + Agent Retrieval directly

**Chosen here (default):** RAG Engine as the orchestration layer
(arrows 6–12), giving a managed pipeline with sensible chunking/
embedding/retrieval defaults.

**Alternative:** the ADK agent's own code calls Vector Search 1.0 and
Agent Retrieval directly, bypassing RAG Engine's orchestration.

**Tradeoff.** Per `02-services/03-adk-custom-development.md` §7's
decision note: choose RAG Engine when you want the pipeline managed
end-to-end with less code to maintain. Choose direct wiring when you
need independent control over each stage — a non-default chunking
strategy for an unusual document format, a specific embedding model
RAG Engine's defaults don't use, or custom reranking logic. This is a
"how much of the pipeline do I want to own" dial, not a binary
platform choice — a mature agent can use RAG Engine for most sources
and direct wiring for one source with unusual retrieval needs.

### 6.2 Managed sessions + Memory Bank vs. building custom state storage on raw data services

**Chosen here:** managed sessions and Memory Bank as the state layer,
abstracting away the underlying storage (which, per
`02-services/07-data-services.md`, is typically Firestore for durable/
document-shaped state and Memorystore for Redis for the fastest-moving
state).

**Alternative:** the agent's code talks directly to Firestore/
Memorystore, building custom session and memory logic by hand.

**Tradeoff.** Managed sessions and Memory Bank remove the
undifferentiated engineering work of building session persistence
and long-term memory retrieval from scratch — the tradeoff is less
control over the exact storage schema and query patterns than direct
data-service access gives you. Reach for direct data-service wiring
only when the state model genuinely doesn't fit what managed sessions/
Memory Bank expose (e.g., a need for complex cross-user aggregate
queries over session history that the memory abstraction isn't built
for) — for the common case of "remember this conversation, remember
this user across conversations," the managed layer is the right
default and is what this pattern uses.

### 6.3 This pattern vs. the low-code CX agent pattern (restated from the other file's perspective)

Already covered in full in `pattern-low-code-cx-agent.md` §6.3; the
short version from this pattern's side: choose this custom ADK path
when the workflow needs code-level control the console can't express —
bespoke retrieval tuning (§6.1), a developer-defined memory model
(§6.2), fine-grained skill governance (§5), or eventual growth into
multi-agent orchestration (`pattern-multi-agent-a2a-mcp-orchestration.md`).
A scenario emphasizing "we need precise control over chunking and
reranking for an unusual document corpus" or "this needs to coordinate
with other specialized agents" points here, not to the low-code
pattern.

### 6.4 Single custom ADK agent vs. jumping straight to multi-agent

**Alternative:** instead of one ADK agent handling everything (RAG,
skills, reasoning) in one reasoning loop, split responsibilities across
multiple coordinating agents from the start.

**Tradeoff.** This pattern intentionally covers the **single-agent**
custom-development case — one reasoning loop, one RAG pipeline, one
set of governed skills — because it's the right level of complexity
for most enterprise use cases and is the building block
`pattern-multi-agent-a2a-mcp-orchestration.md` composes into a larger
system. Jumping straight to multi-agent orchestration for a workload
that doesn't actually need it adds coordination overhead (protocol
plumbing, inter-agent identity, more moving pieces to evaluate and
deploy) without a corresponding benefit — reach for multi-agent only
when the workload genuinely decomposes into specialized sub-tasks that
benefit from separate reasoning contexts (see that pattern's §6 for
the fuller version of this tradeoff).

---

## 7. Common failure modes and how this design handles them

| Failure mode | What it looks like | How this architecture mitigates it |
|---|---|---|
| **Retrieval returns irrelevant or redundant content** | The agent's answer is off-topic or repeats near-duplicate information, because raw vector similarity surfaced topically-close-but-wrong matches. | Agent Retrieval's scoring/reranking stage (arrow 12) exists specifically to correct for this — evaluate whether reranking is actually configured and tuned, not just present, since raw Vector Search 1.0 output alone is known to have this failure mode (see `02-services/03-adk-custom-development.md` §7). |
| **Stale index** | The agent confidently cites outdated information because source content changed but the ingestion pipeline (arrows 13–14) hasn't re-run. | Ingestion is explicitly modeled here as running on its own schedule/trigger, independent of conversation turns — a production deployment needs a defined re-ingestion cadence or change-triggered re-ingestion, not a one-time index build. |
| **Session/memory confusion** | The agent either "forgets" something from earlier in the same conversation (a managed-sessions gap) or fails to recall something from a previous, separate interaction (a Memory Bank gap). | These are diagnosed differently per `02-services/03-adk-custom-development.md` §4's decision note — a within-conversation loss points to a managed-sessions wiring bug; a cross-conversation loss points to a Memory Bank persistence gap. Treating them as the same bug wastes debugging time. |
| **Ungoverned skill invocation** | The agent invokes a high-risk skill (e.g., an action with real-world side effects) fully autonomously when it should have required human approval. | This is exactly what the Agents CLI agent-vs-human mode configuration (§5) exists to prevent — a skill's risk profile needs to be assessed and its mode set deliberately, not left at whatever the default happens to be. |
| **Reasoning loop calling the wrong tool, or looping on a tool call** | The agent repeatedly invokes a skill without making progress toward a resolved task (a "reasoning loop" — one of task 4.2's named production failure modes). | Full diagnosis relies on Google Cloud Observability (Cloud Trace surfacing repeated near-identical call patterns) — see `pattern-evaluation-deployment-pipeline.md`; this pattern's design contributes to preventing it by keeping skill definitions clear and narrowly scoped, reducing ambiguity about which skill a given sub-task should invoke. |
| **Embedding model mismatch between ingestion and query time** | Retrieval quality silently degrades because the model used to embed stored content and the model used to embed the live query drifted out of sync (e.g., after an upgrade to one but not the other). | RAG Engine's managed pipeline (§6.1) reduces this risk by keeping ingestion and query-time embedding configuration in one coordinated place — a strong argument for choosing the managed path over hand-wiring unless there's a specific reason not to. |

---

## 8. Exam task mapping

| Task | How this pattern demonstrates it |
|---|---|
| **3.1** — Designing and building agentic workflows in code | The full ADK reasoning loop, managed sessions + Memory Bank wiring, and Agents CLI-configured skills with agent-vs-human mode (§5). |
| **3.2** — Integrating enterprise domain knowledge | The complete RAG pipeline: RAG Engine orchestration, Vector Search 1.0 storage, Agent Retrieval scoring/reranking (arrows 6–12), and the ingestion path (arrows 13–14). |
| **4.1** (secondary) — Evaluation | This pattern is what ADK's evalset tooling (task 4.1's "using ADK") evaluates against — full pipeline in `pattern-evaluation-deployment-pipeline.md`. |
| **3.3** (extension point) — Orchestration | This single-agent pattern is the building block `pattern-multi-agent-a2a-mcp-orchestration.md` composes multiple of into a coordinated system. |

---

## 9. Exam traps specific to this pattern

- Describing ADK as closed-source or proprietary — the guide states
  explicitly it is **open-source**.
- Treating managed sessions and Memory Bank as redundant or
  interchangeable — one is within-conversation, one is
  cross-conversation; a production agent typically uses both.
- Treating "Vector Search 1.0" and "Agent Retrieval" as the same
  thing — Vector Search 1.0 is the storage/nearest-neighbor layer;
  Agent Retrieval is the scoring/reranking layer built on top of it.
- Assuming RAG Engine is the only path to a RAG pipeline in custom
  development — direct Vector Search 1.0 + Agent Retrieval wiring is
  the lower-level, more controllable alternative, also explicitly in
  scope (§6.1).
- Confusing this pattern's Agents CLI skill-governance role with its
  role governing the coding-agent CI/CD fleet in
  `pattern-coding-agent-cicd-integration.md` — same tool, two
  different populations of agents/skills being governed.
