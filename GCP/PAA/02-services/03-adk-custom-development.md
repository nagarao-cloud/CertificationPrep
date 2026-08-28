# 02-services — ADK & Custom Agent Development

> **Covers (exam-guide §6 in-scope items):** Agent Development Kit
> (ADK) · RAG Engine · Agent Retrieval and Vector Search 1.0.
> **Also covers** (named in task bullets, not separately listed in §6):
> Agent Platform Memory Bank, managed sessions.
>
> **Primary exam tasks supported:** 3.1 (Designing and building agentic
> workflows in code), 3.2 (Integrating enterprise domain knowledge).
> **Section 3 is ~33% of the exam — the single heaviest section, nearly
> a third on its own. Give this file proportionally more study time
> than its file-count share would suggest.**
>
> **Currency reminder:** ADK is explicitly **open-source** per the exam
> guide — never describe it as closed-source or Google-proprietary.

---

## 1. Why this file exists

Section 3 is where the exam shifts from "configure a workflow in a
console" (Section 1) to "build an agent in code." This file covers the
tools a developer reaches for once the choice has already been made
(per `01-gemini-enterprise-low-code.md` §2's decision note) that a
workflow needs custom logic, not a low-code builder. Four concerns
stack on top of each other here:

```
ADK (Agent Development Kit)          ← the open-source library the agent is written in
 ├─ needs state across turns  →  managed sessions        (short-term conversation state)
 ├─ needs state across time   →  Agent Platform Memory Bank (long-term memory)
 └─ needs enterprise knowledge →  RAG pipeline:
                                    RAG Engine              (managed pipeline orchestration)
                                    Vector Search 1.0        (embedding storage/similarity search)
                                    Agent Retrieval           (retrieval logic, reranking)
```

Model selection (LLM vs. SLM, self-hosted vs. SaaS, OSS vs. proprietary)
is also a task-3.1 consideration — that decision itself is covered in
`01-gemini-enterprise-low-code.md` §6–§7 (Gemini LLMs, Model Garden);
this file assumes the model choice is made and focuses on everything
*around* it: the agent framework, its memory, and its knowledge base.

---

## 2. Agent Development Kit (ADK)

**What it is.** An **open-source** library for building custom agents
in code. This is the exam's central tool for Section 3 — the thing a
developer actually imports and writes agent logic against, as opposed
to configuring behavior through Gemini Enterprise's console.
**Currency correction: ADK is explicitly open-source per the guide's
own wording** ("Building custom agents using open-source libraries
(e.g., Agent Development Kit [ADK])") — never describe it as a closed,
Google-proprietary SDK.

**Problem it solves.** Gemini Enterprise's low-code builders (Section
1) cover conversational/state-machine-shaped workflows well, but they
don't give you arbitrary code execution, custom control flow, bespoke
retrieval/reranking logic, or multi-agent orchestration patterns
(parallel/sequential/graph — see `04-orchestration-protocols.md`). ADK
is the escape hatch: a code-first framework for building an agent (or a
system of agents) with full control over reasoning loops, tool
definitions, memory wiring, and evaluation hooks (see
`05-evaluation-deployment.md` for ADK's evalset tooling specifically).

**How it's used — verbatim task 3.1 considerations:**
- **Selecting and configuring the appropriate language model** — **LLM**
  (large language model) vs. **SLM** (small language model), self-hosted
  vs. SaaS, OSS vs. proprietary, weighed against
  cost, security, and agent architecture (full treatment in
  `01-gemini-enterprise-low-code.md` §6–§7).
- **Building custom agents using open-source libraries** — ADK itself.
- **Configuring sessions and memory** — wiring an ADK agent to managed
  sessions and/or Memory Bank (§3, §4 below).
- **Configuring skills using Agents CLI** — plugins and agent-vs-human
  mode, configured at the Agent Platform level (see
  `02-coding-agents-devtools.md` §4 for Agents CLI itself).

ADK is also the tool named directly in task 4.1's evaluation bullets
("Evaluating an agentic system against a golden dataset to assess agent
response and retrieval quality (e.g., using ADK)") — see
`05-evaluation-deployment.md`.

**Task cross-reference.** 3.1 (the central tool), 3.2 (the agent code
that wires in RAG/retrieval, below), 4.1 (evaluation tooling, ADK
evalset — full treatment in `05-evaluation-deployment.md`).

**Decision note — ADK vs. Gemini Enterprise.** Already covered in full
in `01-gemini-enterprise-low-code.md` §2; the short version restated
here for this file's context: pick ADK when the workflow needs code-
level control the console can't express — custom orchestration logic,
bespoke retrieval tuning, integration patterns outside Gemini
Enterprise's connector model, or a multi-agent system with explicit
handoff logic.

---

## 3. Managed sessions

**What it is.** A session/state-management service inside **Agent
Platform** (the umbrella also containing Agents CLI — see
`02-coding-agents-devtools.md` §4 — and Memory Bank, §4 below) that
gives an ADK agent durable, managed conversation-turn state without the
developer hand-rolling session storage.

**Problem it solves.** A multi-turn agent needs to remember what
happened earlier *in this conversation* — the current task, parameters
already collected, the running context — without re-sending the entire
history on every call and without the developer building custom session
persistence (which is exactly the kind of undifferentiated infra work a
managed platform exists to remove). Managed sessions is the short-term,
within-conversation memory layer; it is explicitly a **different**
scope than Memory Bank's long-term memory (§4).

**How it's configured.** Task 3.1 names it directly: "Configuring
sessions and memory (e.g., Agent Platform Memory Bank and managed
sessions)." An ADK agent is wired to a managed session so each turn's
state (conversation history, in-progress tool call results, collected
parameters) persists and is retrievable across the life of that
conversation, without custom session-storage code.

**Task cross-reference.** 3.1, directly.

---

## 4. Agent Platform Memory Bank

**What it is.** The long-term memory service inside Agent Platform,
named alongside managed sessions in the same task-3.1 bullet — but
scoped to persistence **across** conversations/sessions, not within
one.

**Problem it solves.** A single conversation's state (managed sessions)
disappears once that conversation ends. Many real agent use cases need
memory that survives past a single session — a support agent that
remembers a customer's prior tickets, a coding agent that remembers a
team's established conventions across many separate sessions. Memory
Bank is the service that gives an ADK agent access to that
longer-lived, cross-session memory without the developer building a
custom persistent-memory store on top of raw databases.

**How it's configured.** Wired into an ADK agent alongside (not instead
of) managed sessions — a well-built agent typically uses both: managed
sessions for the current conversation's working state, Memory Bank for
facts/preferences/history that should carry forward into future,
separate sessions.

**Task cross-reference.** 3.1, directly, in the same bullet as managed
sessions.

**Decision note — managed sessions vs. Memory Bank.** These are not
alternatives to choose between — they answer different questions.
Managed sessions answers "what does the agent need to remember for the
rest of *this* conversation?" Memory Bank answers "what should the
agent still know the *next* time this user/context comes back?" A
production agent typically uses both simultaneously; an exam question
that describes losing context *within* one conversation points to a
managed-sessions gap, while one describing an agent that "doesn't
remember the user from a previous interaction" points to a Memory Bank
gap.

---

## 5. RAG Engine

**What it is.** A managed retrieval-augmented-generation pipeline
service — the custom-development-path counterpart to Agent Search
(`01-gemini-enterprise-low-code.md` §5), but designed to be wired into
an ADK agent's code rather than configured as a Gemini Enterprise
connector.

**Problem it solves.** Building a RAG pipeline from raw components
(chunking, embedding, indexing, retrieval, reranking, prompt assembly —
"prompt" being the final text, combining instructions and retrieved
context, that actually gets sent to the LLM)
by hand is a lot of undifferentiated engineering for a pattern nearly
every enterprise agent needs. RAG Engine packages that pipeline as a
managed service an ADK agent calls into, while still giving the
developer more control over the pipeline's internals (embedding model
choice, similarity scoring, reranking strategy) than Agent Search's
low-code connector model exposes.

**How it's configured — verbatim task 3.2 considerations:**
- **Designing, configuring, and managing RAG pipelines and vector
  retrieval systems** — embedding models (which model turns your source
  content into vectors), similarity scoring (how retrieved-candidate
  relevance is ranked — e.g., cosine similarity), and reranking (a
  second-pass reordering step that improves precision beyond raw
  vector-similarity ranking) — "using appropriate services such as
  vector databases (e.g., Vector Search and Agent Retrieval)."

**Task cross-reference.** 3.2, directly — RAG Engine is the pipeline-
orchestration layer that sits above Vector Search 1.0 and Agent
Retrieval (§6, §7 below), which do the storage and retrieval-mechanics
work underneath it.

---

## 6. Vector Search 1.0

**What it is.** The vector database component of the "Agent Retrieval
and Vector Search 1.0" in-scope item — the storage and similarity-
search engine that holds embedded representations of enterprise
content and returns the nearest matches to a query embedding.

**Problem it solves.** Semantic (meaning-based, not just keyword-based)
retrieval requires a data store purpose-built for high-dimensional
vector similarity search at scale — a relational database's indexing
model isn't suited to this. Vector Search 1.0 is that purpose-built
store: it holds the embeddings RAG Engine's pipeline produces and
answers "which stored vectors are closest to this query vector" fast
enough for interactive agent use.

**How it's configured.** Populated by an ingestion/embedding step
(content → embedding model → vectors stored in Vector Search 1.0), then
queried at agent-runtime by RAG Engine (or directly by ADK code) with a
query embedding, returning the top-k nearest matches for the pipeline's
similarity-scoring and reranking steps to work with.

**Task cross-reference.** 3.2, directly — named as one of the "vector
databases" the task-3.2 pipeline is built on.

---

## 7. Agent Retrieval

**What it is.** The retrieval-logic layer named alongside Vector Search
1.0 in the same "Agent Retrieval and Vector Search 1.0" in-scope item —
covering the mechanics of turning a raw nearest-neighbor result set
into a ranked, relevant, agent-consumable retrieval result: similarity
scoring and reranking.

**Problem it solves.** Raw vector-similarity results aren't always the
most *useful* results — a nearest-neighbor match can be topically close
but contextually wrong, or several near-duplicate chunks can crowd out
a more relevant but slightly-more-distant one. Agent Retrieval is the
layer that applies similarity scoring and reranking on top of Vector
Search 1.0's raw output to improve what the agent actually receives as
retrieved context.

**How it's configured.** Sits between Vector Search 1.0 (raw nearest-
neighbor lookup) and the agent's final prompt assembly — task 3.2 names
"similarity scoring, and reranking" as the specific configuration
levers here.

**Task cross-reference.** 3.2, directly, in the same bullet as Vector
Search 1.0.

**Decision note — RAG Engine (managed pipeline) vs. hand-wiring Vector
Search 1.0 + Agent Retrieval directly in ADK code.** Choose RAG Engine
when you want the pipeline (chunking → embedding → storage → retrieval
→ reranking) managed end-to-end with sensible defaults and less code to
maintain. Choose direct Vector Search 1.0 + Agent Retrieval wiring in
ADK when you need fine-grained control over each pipeline stage
independently — e.g., a custom chunking strategy, a non-default
embedding model, or reranking logic RAG Engine's managed defaults don't
support. This mirrors the Agent Search-vs-RAG-Engine decision in
`01-gemini-enterprise-low-code.md` §5 one level down: Agent Search is
the *most* managed (low-code, Gemini Enterprise-native), RAG Engine is
managed-but-code-integrated, and direct Vector Search 1.0/Agent
Retrieval wiring is the *least* managed, most controllable option.

---

## 8. How these tools fit together

```
                    ┌───────────────────────────────────────┐
                    │        Enterprise source content        │
                    │  (documents, structured data, APIs —      │
                    │   see 07-data-services.md for the          │
                    │   underlying storage: Cloud Storage,        │
                    │   BigQuery, Cloud SQL, Firestore)            │
                    └────────────────────┬──────────────────┘
                                         │ (1) ingest + embed
                                         ▼
                    ┌───────────────────────────────────────┐
                    │              RAG Engine                  │
                    │   managed pipeline: chunking, embedding,   │
                    │   orchestrating retrieval + reranking      │
                    └───────────┬─────────────────┬───────────┘
                                │ (2) store vectors│ (4) query + rerank
                                ▼                  │
                    ┌─────────────────────┐        │
                    │   Vector Search 1.0   │◄───────┘ (3) query embedding
                    │  embeddings + nearest- │
                    │  neighbor similarity   │
                    └───────────┬───────────┘
                                │ (5) raw nearest-neighbor matches
                                ▼
                    ┌─────────────────────┐
                    │    Agent Retrieval     │
                    │  similarity scoring +   │
                    │  reranking              │
                    └───────────┬───────────┘
                                │ (6) ranked, relevant context
                                ▼
 ┌────────────────────────────────────────────────────────────────────┐
 │                       ADK agent (your code)                          │
 │  ┌─────────────────────┐         ┌─────────────────────────────┐   │
 │  │   Managed sessions     │         │  Agent Platform Memory Bank    │   │
 │  │  this-conversation      │◄───────►│  cross-conversation, long-      │   │
 │  │  working state          │  (7)    │  term memory                    │   │
 │  └─────────────────────┘         └─────────────────────────────┘   │
 │              (8) retrieved context + session/memory state assembled  │
 │                  into the model call                                 │
 └────────────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
                        [ grounded, context-aware agent response ]
```

**Arrow-by-arrow:**
1. Enterprise source content (documents, structured records — the data
   layer covered in `07-data-services.md`) is ingested and passed
   through an embedding model.
2. RAG Engine's pipeline stores the resulting vectors in Vector Search
   1.0.
3. At query time, the user's (or agent's) query is itself embedded and
   sent to Vector Search 1.0 as a search vector.
4. RAG Engine coordinates this query-and-rerank cycle rather than the
   ADK agent code talking to Vector Search 1.0 and Agent Retrieval
   directly (though it can, per §7's decision note, for finer control).
5. Vector Search 1.0 returns raw nearest-neighbor matches by embedding
   similarity.
6. Agent Retrieval applies similarity scoring and reranking to turn
   those raw matches into a ranked, relevant context set.
7. Independently of the RAG path, the ADK agent maintains
   conversation-local state via managed sessions and longer-term
   memory via Memory Bank — these two exchange relevant facts (e.g., a
   preference learned this session gets persisted to Memory Bank for
   future sessions) but serve different time horizons.
8. The agent assembles retrieved context, session state, and
   long-term memory into the final model call, producing a response
   that is both grounded in enterprise knowledge and aware of
   conversational/historical context.

---

## 9. Quick-reference table

| Tool | Role | Time horizon / scope | Primary task | Don't confuse with |
|---|---|---|---|---|
| ADK | Agent framework (open-source) | — (the code itself) | 3.1 | A closed-source/proprietary SDK — it is explicitly OSS |
| Managed sessions | State store | Within one conversation | 3.1 | Memory Bank (cross-conversation) |
| Memory Bank | Memory store | Across conversations/time | 3.1 | Managed sessions (single-conversation scope) |
| RAG Engine | Managed RAG pipeline orchestration | Pipeline-level | 3.2 | Agent Search (Gemini Enterprise's low-code equivalent — see file 01) |
| Vector Search 1.0 | Vector database | Storage + nearest-neighbor lookup | 3.2 | Agent Retrieval (scoring/reranking layer *above* it, not the store itself) |
| Agent Retrieval | Retrieval logic | Scoring/reranking | 3.2 | Vector Search 1.0 (the underlying store it operates on) |

---

## 10. Exam traps specific to this file

- Describing ADK as closed-source or Google-proprietary — the guide
  states explicitly it is an **open-source** library.
- Treating managed sessions and Memory Bank as interchangeable — one is
  within-conversation working state, the other is cross-conversation
  long-term memory; a well-designed agent typically uses both.
- Treating "Vector Search 1.0" and "Agent Retrieval" as two names for
  the same thing — Vector Search 1.0 is the storage/lookup layer,
  Agent Retrieval is the scoring/reranking layer built on top of it.
- Assuming RAG Engine is the *only* path to a RAG pipeline in custom
  development — it's the managed option; direct Vector Search 1.0 +
  Agent Retrieval wiring is the lower-level, more controllable
  alternative also explicitly in scope (task 3.2).
- Forgetting this section's exam weight (~33%) when allocating study
  time — this is the single heaviest section of the exam by a wide
  margin (see `CLAUDE.md` §3).
