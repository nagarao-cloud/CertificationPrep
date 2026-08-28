# Section 3 Cheatsheet — Developing custom agents (~33%)

> Compressed by design (CLAUDE.md §10) — pure recall sheet, proportionally
> longer because this section is ~a third of the exam, but still scannable,
> not prose. Full teaching content: `01-domains/SECTION-3-custom-agents.md`,
> `02-services/03-adk-custom-development.md`, `02-services/04-orchestration-protocols.md`.
> Decision trees for build-vs-low-code, orchestration pattern, A2A-vs-MCP,
> deployment target: `00-START-HERE/DECISION-TREES.md` §1–4.

Tasks: **3.1** design/build in code · **3.2** integrate enterprise domain knowledge · **3.3** orchestrate/coordinate.

---

## Tool glossary (one line each)

| Tool | One-line definition |
|---|---|
| **ADK (Agent Development Kit)** | **Open-source** library for building custom agents in code — the core Section 3 toolkit. Never call it closed-source. |
| **Agent Platform Memory Bank** | Manages agent **memory** — persisted knowledge/context across turns and sessions. |
| **Managed sessions** | Agent Platform's handling of **session** state (a single conversation's short-lived context), distinct from long-term memory. |
| **RAG Engine** | Managed pipeline service for retrieval-augmented generation (RAG) — the "ingest, chunk, embed, retrieve" plumbing. |
| **Vector Search 1.0** | The vector database product used as a retrieval backend for RAG. |
| **Agent Retrieval** | Named alongside Vector Search as a retrieval system option — the guide pairs these two as "vector databases (e.g., Vector Search and Agent Retrieval)." |
| **Agent Identity** | Where you configure **agent permissions**, including PAB (principal access boundary) policies. |
| **Agent Registry** | Catalog/registry for **prebuilt and custom capabilities** — used here to configure integration layers, API integrations, MCP servers. Also reused in 3.3 for multi-agent coordination and in Section 5 for governance. |
| **Google Cloud MCP Servers** | Google-provided MCP servers for common integration targets (managed databases, APIs, third-party SaaS, remote servers). |
| **A2A (Agent2Agent)** | Protocol for **agent-to-agent** orchestration — peer agents that reason for themselves. |
| **MCP (Model Context Protocol)** | Protocol for **agent-to-tool/data** connections — fixed tools, APIs, databases, SaaS, remote servers. |
| **Agent Runtime** | Managed deployment/runtime target for agents, named in 3.3 alongside Agent Identity/Registry/policies for orchestration. **Formerly Agent Engine — never say the old name** except in a rename callout. |

---

## 3.1 — Designing and building agentic workflows in code

**Model selection axes (three pairs — memorize as pairs, not six random words):**

| Axis | Choice A | Choice B | Deciding factors named in the guide |
|---|---|---|---|
| Size | **LLM** (large language model) | **SLM** (small language model) | cost, security, agent architecture |
| Hosting | **Self-hosted** | **SaaS** | cost, security, agent architecture |
| Licensing | **OSS** (open-source software) | **Proprietary** | cost, security, agent architecture |

All three axes are judged against the same three factors: **cost, security, agent architecture.** This is 3.1's model-selection question shape — expect a scenario giving you a cost/security/architecture constraint and asking which axis choice fits.

**Build with ADK** — the open-source library for custom agents (contrast: Section 1 is console/low-code; 3.1 is code).

**Sessions and memory:**
- **Memory Bank** = long-term/persisted memory across sessions.
- **Managed sessions** = the current conversation's live state.
- Configured within **Agent Platform**.

**Skills via Agents CLI:**
- Configuring **skills** — reused concept from 2.2, but here it's Agents CLI doing the configuring (plugins) for a *custom* agent, not Antigravity customizing a coding agent.
- **Agent vs. human mode** — a skill/task can run autonomously (agent mode) or require a human to drive it (human mode). This is a 3.1-specific toggle, distinct from HITL (Section 5's safety-gate concept) — 3.1's agent/human mode is about *who executes the skill*, HITL is about *approval before a risky action proceeds*.

---

## 3.2 — Integrating enterprise domain knowledge

**RAG pipeline stages named explicitly (memorize the chain):**

```
  ingest → embed (embedding models) → store (vector database:
  Vector Search 1.0 / Agent Retrieval) → similarity scoring
  → reranking → retrieved context fed to the LLM
```

- **Embedding models** — turn text/content into vectors.
- **Similarity scoring** — how retrieval ranks candidate matches.
- **Reranking** — a second pass that reorders top candidates for better relevance before they reach the model.
- **Vector databases**: **Vector Search 1.0** and **Agent Retrieval** — the guide's own paired example.

**Agent permissions** — configured via **Agent Identity** (this is where PAB policies live; full PAB depth is Section 5's job, but 3.2 is where you first meet Agent Identity as "agent permissions").

**Capability configuration** — **Agent Registry** and **Google Cloud MCP Servers**, for:
- Custom integration layers for **managed databases**
- **API integrations**
- **MCP server that connects agents to third-party SaaS tools and remote servers** — this exact phrase is the guide's own definition of what MCP is for.

---

## 3.3 — Orchestrating and coordinating agentic workflows

**Protocols:**
- **MCP** — agent-to-tool/data (peer reasons: no; fixed capability: yes).
- **A2A (Agent2Agent)** — agent-to-agent (peer reasons: yes).

**Multi-agent workflow patterns (three named, pick based on dependency shape):**
- **Parallel agents** — independent sub-tasks, run at once, merge results.
- **Sequential agents** — strict step-by-step, each depends on the prior output, no branching.
- **Graph workflow** — conditional branching/looping based on runtime state; a step-by-step-looking scenario with an "if X, retry/escalate" clause is graph, not sequential.

**Tools used to select/coordinate these** (four, all reused from elsewhere in Section 3/5 — orchestration is where they converge):
- **Agent Identity** — who/what is allowed to participate.
- **Agent Registry** — discovery/catalog of available agents and capabilities.
- **Agent Runtime** — the managed runtime hosting the coordinated agents.
- **Agent policies** — governance rules applied across the orchestration.

---

## Quick facts

- Section weight: **~33%** — nearly a third of the exam, by far the largest. 3 tasks (3.1, 3.2, 3.3), each roughly equal depth.
- The word that separates Section 1 from Section 3: **"code."** Low-code = console/pages/routes. Section 3 = ADK, open-source library, custom orchestration code.
- Agent Identity, Agent Registry, and Agent Runtime each appear in **more than one task** across 3.2/3.3 (and Agent Identity/Registry again in Section 5) — they are cross-cutting platform primitives, not single-task-scoped tools.
- MCP appears in **three** places across the guide: Section 2.1 (coding agent's own tool access), Section 3.2/3.3 (agent-to-tool/data integration and orchestration), and implicitly underlies "Google Cloud MCP Servers." Same protocol, different task context each time.

## 5-second recall

**3.1 build (ADK, model axis: LLM/SLM · self-hosted/SaaS · OSS/proprietary, judged on cost/security/architecture; Memory Bank + managed sessions; Agents CLI skills, agent-vs-human mode) → 3.2 ground it (RAG: embed → Vector Search 1.0/Agent Retrieval → similarity → rerank; Agent Identity for permissions; Agent Registry + MCP servers for integrations) → 3.3 orchestrate it (A2A = agent-to-agent, MCP = agent-to-tool; parallel/sequential/graph; Agent Identity + Registry + Runtime + policies coordinate it all).**
