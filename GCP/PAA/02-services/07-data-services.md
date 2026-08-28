# 02-services — The Data Layer Underneath Agentic Workflows

> **Covers (exam-guide §6 in-scope items):** BigQuery · Cloud SQL ·
> Cloud Storage · Firestore · Memorystore for Redis.
>
> **Scope discipline — read this before the rest of the file.** These
> five services are explicitly in scope for PAA, but **only** as the
> data layer underneath agentic workflows: RAG sources, session/state
> storage, and tool-integration targets. This exam does **not** test
> generic "when should I use which database" architecture the way
> `GCP/GCPPCA/` does — raw compute/storage/networking selection,
> generic OLTP-vs-analytics tradeoffs, and general HA/DR design are out
> of scope here (see `CLAUDE.md` §7 and `00-START-HERE/RUNBOOK.md` §6).
> Every section below is written strictly through an agent's-eye view:
> what does *this agent* use *this service* for.

---

## 1. Why this file exists — and what it is deliberately not

Every agentic workflow covered elsewhere in this folder eventually
needs to read from, write to, or query *some* underlying data store.
This file is the reference for those five stores, but framed narrowly
around three agent-specific roles:

```
Role in an agentic workflow      Question being answered
────────────────────────────      ─────────────────────────────────────
RAG source                         Where does the content an agent
                                    retrieves-and-grounds-on actually
                                    live before it's embedded?
Session/state storage              Where does an agent's conversation-
                                    turn state or long-term memory
                                    actually get persisted?
Tool-integration target             What does an agent's tool call
                                    actually query/write when it reaches
                                    out to "the database"?
```

A service can play more than one of these roles. This file does **not**
attempt to answer "which database should a new application use" in
general — that question, and its generic decision matrix, belongs to
GCPPCA. Here, the only question is: what role does this service play
*for an agent*, and which role fits which service best.

---

## 2. BigQuery

**Role in an agentic workflow.** Primarily a **RAG** (retrieval-
augmented generation — the agent looks up relevant content before
answering, rather than relying only on what the model already learned
during training) **source** and a
**tool-integration target** for structured, large-scale enterprise
data — analytics tables, historical records, aggregated business data
an agent needs to query or ground answers on.

**Problem it solves for an agent.** An agent asked "what were our top
five products by revenue last quarter" cannot answer that from a vector
store of unstructured documents — it needs to run an actual structured
query against tabular data at scale. BigQuery is the tool-integration
target for that class of question: an agent's tool call (via an MCP
server — see `04-orchestration-protocols.md` §3) issues a query against
BigQuery and returns structured results the agent reasons over and
presents.

**How it's used by an agent.**
- **As a tool-integration target**: an agent's tool definition wraps a
  BigQuery query (parameterized by the agent's reasoning about what
  data is needed), returning structured results — this is a "custom
  integration layer for managed databases" in task 3.2's language, or a
  Google Cloud MCP Server fronting BigQuery specifically.
  **As a RAG source**: structured/tabular enterprise data in BigQuery
  can feed into a RAG pipeline (`03-adk-custom-development.md` §5–§7)
  as source content to be summarized/embedded, though structured-data
  RAG more often takes the tool-call path above (querying it directly)
  rather than the embed-and-retrieve path used for unstructured
  documents.

**Task cross-reference.** 3.2 (enterprise domain-knowledge integration
— "custom integration layers for managed databases").

**Decision note — BigQuery vs. Cloud SQL as a tool-integration
target.** In this exam's framing, the choice is about the *shape* of
the query an agent needs to make, not general database architecture.
Choose BigQuery when the agent needs analytical, aggregate, large-scale
queries (sums, trends, joins across large historical datasets). Choose
Cloud SQL (§3) when the agent needs targeted, transactional,
row-level lookups against an application's live operational data.

---

## 3. Cloud SQL

**Role in an agentic workflow.** Primarily a **tool-integration
target** for relational, transactional (OLTP-style) application data
an agent needs to read or write on behalf of a user or process.

**Problem it solves for an agent.** Many enterprise agent use cases
involve an existing relational application database — a CRM, an order-
management system, an internal ticketing tool — that an agent needs to
query (look up a customer's order) or update (create a ticket, modify a
record) as part of completing a task. Cloud SQL is the managed
relational database an agent's tool call reaches into for this kind of
targeted, transactional operation.

**How it's used by an agent.** Wrapped as a tool (directly, or via a
Google Cloud MCP Server) that executes a scoped, parameterized
query/write against Cloud SQL — task 3.2's "custom integration layers
for managed databases" and "API integrations" language covers this
directly. Access here is a security-relevant surface: what an agent's
Cloud SQL tool call is allowed to read/write is exactly the kind of
thing Agent Identity/PAB (`06-security-governance.md` §2) is meant to
bound.

**Task cross-reference.** 3.2, directly.

**Decision note.** See §2's BigQuery-vs-Cloud-SQL note — Cloud SQL is
the answer when the agent's need is a targeted transactional read/write
against live application data, not an analytical query over large
historical volumes.

---

## 4. Cloud Storage

**Role in an agentic workflow.** Primarily a **RAG source** — the raw
storage layer holding the unstructured and multimodal content that
feeds ingestion pipelines (both Agent Search's, per
`01-gemini-enterprise-low-code.md` §5, and RAG Engine's, per
`03-adk-custom-development.md` §5).

**Problem it solves for an agent.** Before any document, PDF, image,
audio file, or video can be embedded and made retrievable, it has to
live somewhere as source content. Cloud Storage is that landing zone —
the object store enterprise documents and multimodal files sit in
before (and often after) an ingestion pipeline processes them into
embeddings.

**How it's used by an agent (or its supporting pipeline).** An
ingestion job reads source files from Cloud Storage, runs them through
an embedding model (or, for Agent Search, the low-code connector's
built-in ingestion), and writes the resulting vectors to Vector Search
1.0 or Agent Search's internal index. This directly supports task
1.2's "ingesting and processing unstructured multimodal data (e.g.,
videos, audio, and images) into the agentic workflow" — Cloud Storage
is where that multimodal content originates from.

**Task cross-reference.** 1.2 (multimodal data ingestion source), 3.2
(RAG pipeline source content).

**Decision note — Cloud Storage vs. BigQuery as a RAG source.** Choose
Cloud Storage when the source content is unstructured or multimodal
(documents, PDFs, images, audio, video) destined for embedding-based
retrieval. Choose BigQuery when the source content is structured/
tabular and better served by a direct query tool call than by
embedding-and-retrieval (see §2).

---

## 5. Firestore

**Role in an agentic workflow.** Primarily **session/state storage**
and a **tool-integration target** for flexible, document-shaped
application data.

**Problem it solves for an agent.** Conversation-turn state and agent-
related application data (user preferences, in-progress task state,
records an agent's tool calls read/write) are often naturally
document-shaped rather than strictly relational — flexible schemas, per-
user or per-session documents that vary in structure. Firestore's NoSQL
document model fits that shape well, and its low-latency, serverless
profile suits both live session reads/writes and general agent-adjacent
application data.

**How it's used by an agent.** Two roles, both worth naming distinctly:
- **Session/state storage**: Firestore is a natural underlying store
  for the kind of per-conversation working state that managed sessions
  (`03-adk-custom-development.md` §3) exposes to an ADK agent — flexible
  document structure suits varying conversation-state shapes well.
- **Tool-integration target**: an agent's tool call can read/write
  Firestore documents directly for application data that isn't
  strictly relational — e.g., a user-preferences document, a workflow-
  state record.

**Task cross-reference.** 3.1 (sessions and memory — as a plausible
underlying store for that layer), 3.2 (custom integration layers for
managed databases).

**Decision note — Firestore vs. Memorystore for Redis for session/
state storage.** Choose Firestore when session/state data needs to be
durable (survive beyond the immediate cache lifetime), document-shaped,
and queryable. Choose Memorystore for Redis (§6) when the priority is
raw read/write latency for short-lived, high-throughput state — the
tradeoff is durability/queryability (Firestore) vs. speed (Memorystore).

---

## 6. Memorystore for Redis

**Role in an agentic workflow.** Primarily **session/state storage** —
specifically the low-latency caching layer for an agent's most
performance-sensitive, short-lived state.

**Problem it solves for an agent.** An agent's per-turn interaction
loop is latency-sensitive — every extra hundred milliseconds spent
reading/writing conversation state compounds across a multi-turn,
multi-tool-call interaction (and directly worsens the "tool invocation
latency" failure mode named in task 4.2 — see
`05-evaluation-deployment.md` §5). Memorystore for Redis, an in-memory
key-value store, is the answer when that state needs to be read and
written as fast as possible — much faster than a durable database
round-trip — even at the cost of being less durable and less richly
queryable than Firestore.

**How it's used by an agent.** Backs the fastest-changing, most
latency-sensitive layer of an agent's state — e.g., the current turn's
working scratch state, a short-lived cache of a recent tool call's
result to avoid redundant calls within the same conversation, or
rate-limiting/throttling counters for tool invocations.

**Task cross-reference.** 3.1 (sessions and memory — as a plausible
underlying store for the fastest-moving state), implicitly 4.2
(reducing tool invocation latency, per
`05-evaluation-deployment.md` §5).

**Decision note.** See §5's Firestore-vs-Memorystore note — this is a
durability/queryability-vs-speed tradeoff, not a "which is generally
better" question.

---

## 7. How these tools fit together

```
                          Ingestion / RAG path
     ┌───────────────────┐        ┌─────────────────────────────┐
     │   Cloud Storage       │───(1)──►│  RAG Engine / Agent Search    │
     │  documents, PDFs,       │        │  ingestion pipeline             │
     │  images, audio, video    │        │  (see files 01 and 03)          │
     └───────────────────┘        └───────────────┬─────────────┘
                                                   │ (2) embeddings
                                                   ▼
                                        [ Vector Search 1.0 / Agent Search index ]

                          Agent runtime — session/state path
     ┌───────────────────┐        ┌─────────────────────────────┐
     │  Memorystore for Redis │◄─(3)──►│         ADK agent               │
     │  fast, short-lived state │        │  (managed sessions / Memory     │
     └───────────────────┘        │   Bank — see file 03)           │
                                    │              │                   │
     ┌───────────────────┐        │              │ (4)               │
     │      Firestore          │◄─(3)──►│              │                   │
     │  durable, document-        │        └──────────────┼───────────────┘
     │  shaped state               │                       │
     └───────────────────┘                       │ (5) tool calls
                                                   ▼
                          Agent tool-call path
     ┌───────────────────┐        ┌─────────────────────────────┐
     │       BigQuery          │◄─(5a)──│     Agent's tool-call layer     │
     │  analytical/aggregate     │        │  (MCP servers, custom            │
     │  structured queries        │        │   integration — see file 04)     │
     └───────────────────┘        │              │                   │
     ┌───────────────────┐        │              │                   │
     │       Cloud SQL          │◄─(5b)──│              │                   │
     │  transactional, row-        │        └──────────────────────────────┘
     │  level operational data      │
     └───────────────────┘
```

**Arrow-by-arrow:**
1. Unstructured/multimodal source content sitting in Cloud Storage is
   read by an ingestion pipeline — either RAG Engine's (custom-dev
   path) or Agent Search's built-in connector ingestion (low-code
   path).
2. That pipeline produces embeddings, stored in Vector Search 1.0 (or
   Agent Search's internal index), ready for retrieval at agent
   runtime.
3. Independently, the running ADK agent reads/writes session and memory
   state — the fast-changing, short-lived layer typically backed by
   Memorystore for Redis, and the more durable, document-shaped layer
   typically backed by Firestore (per §5–§6's decision note, these are
   a latency-vs-durability tradeoff, not mutually exclusive).
4. This session/state layer is what managed sessions and Memory Bank
   (`03-adk-custom-development.md` §3–§4) expose to the agent's code as
   a managed abstraction — the agent's code interacts with those
   services, not directly with Firestore/Memorystore internals.
5. Separately, when the agent's reasoning determines it needs live
   structured data, its tool-call layer (MCP servers or a custom
   integration, per `04-orchestration-protocols.md`) routes the request
   to (5a) BigQuery for analytical/aggregate queries, or (5b) Cloud SQL
   for targeted transactional reads/writes — chosen per §2's decision
   note based on the shape of the query the agent's task actually
   needs.

---

## 8. Quick-reference table — role in an agentic workflow only

| Service | RAG source | Session/state storage | Tool-integration target | Best fit when... |
|---|---|---|---|---|
| BigQuery | Occasionally (structured summarization) | No | **Primary use** | The agent needs analytical/aggregate queries over large structured datasets |
| Cloud SQL | No | No | **Primary use** | The agent needs targeted, transactional reads/writes against live application data |
| Cloud Storage | **Primary use** | No | Rarely | The agent needs unstructured/multimodal source content ingested for RAG |
| Firestore | No | **Primary use** (durable) | Secondary | Session/state data needs to be document-shaped, durable, and queryable |
| Memorystore for Redis | No | **Primary use** (fast) | No | Session/state data needs the lowest possible read/write latency, durability less critical |

**Reminder:** this table intentionally omits generic architecture
columns (cost tiers, HA/DR, scaling limits) that would appear in a
GCPPCA-style comparison — those are out of scope for PAA. The only
axis that matters here is *which agent-specific role* each service
plays.

---

## 9. Exam traps specific to this file

- Answering a question about these five services as if it were a
  generic "pick the right database" GCPPCA-style question — for PAA,
  always frame the answer around the agent-specific role (RAG source /
  session-state store / tool-integration target), not general database
  architecture tradeoffs.
- Treating Cloud Storage as capable of being queried directly for
  structured answers — it's the landing zone for unstructured/
  multimodal *source* content; the actual retrieval mechanism is the
  embedding/vector layer (Vector Search 1.0 / Agent Search) built on
  top of it, not Cloud Storage itself.
- Assuming Firestore and Memorystore for Redis are interchangeable for
  session/state storage — the choice is a durability/queryability
  (Firestore) vs. raw latency (Memorystore) tradeoff, not a "pick
  either" situation.
- Assuming BigQuery is the default choice for any structured-data tool
  integration — Cloud SQL is the better fit when the agent's actual
  need is targeted transactional row-level operations, not analytical/
  aggregate queries.
