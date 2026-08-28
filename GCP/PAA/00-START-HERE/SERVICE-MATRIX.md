# SERVICE-MATRIX — every in-scope tool, one row each

> Source: `00-START-HERE/RUNBOOK.md` §6, the verbatim in-scope tool list
> from the exam guide PDF (page 4). **Note on the count:** RUNBOOK.md's
> own prose calls this "the 28-item in-scope tool list," but the
> verbatim list it transcribes actually enumerates **28 distinct named
> tools/services** (some guide entries bundle two names under one
> bullet, e.g. "Agent Retrieval and Vector Search 1.0"). This file
> follows the instruction to cover the **verbatim list**, so it has 28
> distinct tools below — **29 table rows**, because GKE genuinely does
> two different jobs on two different exam tasks (dev-time sandbox,
> task 2.1; production deployment target, task 4.2) and gets one row
> per facet rather than being flattened into one row that hides which
> task a given question means. Flagging the 23-vs-28 mismatch rather
> than silently picking one number, per this folder's honesty
> conventions (CLAUDE.md §10).
>
> Beginner note: "what it is" is written assuming no prior exposure —
> see `CLAUDE.md` §8. Full depth for every tool lives in the
> `02-services/` file named in the last column, not here — this is the
> at-a-glance index.

## Rename alert — the two highest-value corrections in this whole folder

| Old name (do not use) | Current name (use this) |
|---|---|
| Agent Engine | **Agent Runtime** |
| Vertex AI Search | **Agent Search** |

Both renames are called out explicitly, parenthetically, by the exam
guide itself — not inferred. See `EXAM-TRAPS-AND-MNEMONICS.md` §1 for
why these are the single most likely traps on the exam.

---

## Gemini Enterprise & low-code tools — `02-services/01-gemini-enterprise-low-code.md`

| Tool | What it is | Exam task(s) |
|---|---|---|
| **Gemini Enterprise** | Google Cloud's low-code/no-code platform for building conversational and agentic experiences without writing custom orchestration code. The umbrella product for Section 1's low-code story. | 1.1, 1.2 |
| **Gemini LLMs** | Google's family of large language models (the "brains" an agent calls) — the model layer these agents reason with. | 3.1 |
| **Model Garden** | A catalog/marketplace of available models (Google's own plus third-party and open-source) you can browse and select from when choosing a model for a custom agent. | 3.1 |
| **Agent Search** *(formerly Vertex AI Search)* | The enterprise-data grounding service — lets an agent securely query your organization's own proprietary documents/data instead of only its trained-in knowledge. | 1.2 |

## Coding agents & developer tooling — `02-services/02-coding-agents-devtools.md`

| Tool | What it is | Exam task(s) |
|---|---|---|
| **Antigravity (CLI, SDK, App)** | Google's coding-agent product — an AI tool that writes, refactors, and tests application code, extensible with skills/plugins/subagents. Named explicitly by the guide as a Section 2 example (Gemini Code Assist is **not** named — don't substitute it). | 2.1, 2.2 |
| **Agents CLI (in Agent Platform)** | A command-line tool for configuring agent skills (plugins, agent-mode vs. human-mode) and for augmenting Antigravity to build/scale/govern/optimize deployed agents. | 2.2, 3.1 |
| **Google Kubernetes Engine (GKE)** *— sandbox facet* | Managed Kubernetes, used here specifically as a **secure, isolated development sandbox** for coding agents to run and test code in (alongside Cloud Workstations and Antigravity). This is a *dev-time* use — see the deployment-target facet below for the separate production-hosting decision. | 2.1 |

## ADK & custom agent development — `02-services/03-adk-custom-development.md`

| Tool | What it is | Exam task(s) |
|---|---|---|
| **Agent Development Kit (ADK)** | An **open-source** library for building custom agents in code — your own control flow, tool bindings, and reasoning loop, instead of a console's fixed configuration surface. Never describe ADK as closed-source or Google-proprietary. | 3.1 |
| **RAG Engine** | A managed service for building retrieval-augmented-generation (RAG) pipelines — the plumbing that retrieves relevant data and feeds it into a model's prompt so answers are grounded in your actual data. | 3.2 |
| **Agent Retrieval and Vector Search 1.0** | Two closely-related vector-database services (store embeddings, find the closest matches fast) used as the retrieval backend for custom RAG pipelines, including similarity scoring and reranking. | 3.2 |

## Orchestration, identity & protocols — `02-services/04-orchestration-protocols.md`

| Tool | What it is | Exam task(s) |
|---|---|---|
| **Agent Registry** | A discovery/capability catalog — where agents and their capabilities (prebuilt or custom) get registered so other agents can find and invoke them, regardless of whether the underlying connection is A2A or MCP. | 3.2, 3.3, 5.1, 5.2 |
| **Agent Runtime** *(formerly Agent Engine)* | The purpose-built, managed runtime for deploying and running agents — the deployment target most natively aligned with agent-specific concerns (sessions, multi-agent coordination, governance hooks). | 3.3, 4.2 |
| **Agentic protocols — Agent2Agent (A2A)** | A standardized protocol for **agent-to-agent** communication — how one autonomous agent hands off work to, or coordinates with, another autonomous agent (a peer, not a plain tool). | 3.3 |
| **Model Context Protocol (MCP) servers** *(incl. Google Cloud MCP Servers)* | A standardized protocol/server pattern for **agent-to-tool/data** connectivity — how an agent discovers and calls external capabilities: APIs, databases, third-party SaaS tools, remote servers. | 3.2, 3.3 |

## Evaluation & deployment — `02-services/05-evaluation-deployment.md`

| Tool | What it is | Exam task(s) |
|---|---|---|
| **Agent evaluation** | The exam guide's umbrella term for the discipline of testing agent quality — golden datasets, evaluation frameworks (ADK evalset, Agent Platform Gen AI evaluation service, custom autoraters), and continuous pipelines. | 4.1 |
| **Cloud Run** | Google Cloud's serverless container platform — deploy a container, it scales automatically (including to zero when idle), no server/cluster management. One of three named deployment-target options. | 4.2 |
| **Google Kubernetes Engine (GKE)** *— deployment-target facet* | The same managed-Kubernetes service as above, but here evaluated as a **production hosting target**: full control over networking, node pools, and GPU/accelerator scheduling, at the cost of owning that operational complexity yourself. | 4.2 |
| **Google Cloud Observability (Cloud Logging and Cloud Trace)** | Google Cloud's monitoring/tracing toolset — Cloud Logging records what happened; Cloud Trace shows how a request moved through the system and where time was spent. Used to troubleshoot drift, latency, and reasoning loops. | 4.2 |

## Security & governance — `02-services/06-security-governance.md`

| Tool | What it is | Exam task(s) |
|---|---|---|
| **Agent Gateway** | The traffic-monitoring and identity-propagation layer — sits in the path of live agent traffic, tracks what agents are doing, and carries identity/authorization context across multi-hop agent-to-agent or agent-to-tool calls. | 5.1, 5.2 |
| **Agent Identity** | Where you configure **PAB (principal access boundary)** policies — which agent (as a principal) is allowed to access which resource or take which action. Not a synonym for generic IAM; it's the agent-specific access-boundary mechanism this exam tests. | 5.1 |
| **Model Armor** | A content/model-safety guardrail service — checks whether a request to, or output from, a model violates safety/policy rules (e.g., prompt injection, jailbreak attempts, harmful output), independent of whether the caller was otherwise authorized. | 5.1, 5.2 |
| **Auth Manager (OAuth 2.0)** | Handles **authentication** for agent-to-tool API calls — OAuth 2.0 is the standard protocol letting an agent act on a system's behalf without handling a raw password. Distinct from PAB, which governs *authorization* (what an authenticated agent may do). | 5.1 |
| **Sensitive Data Protection** | A service for detecting and redacting/flagging sensitive data (PII, secrets, regulated data) as it flows through an agentic pipeline — a *data-sensitivity* guardrail, distinct from Model Armor's *content-pattern* safety focus. | 5.1, 5.2 |
| **Skill Registry** | A registry specifically for **skills** — vetted, approved capabilities an agent is allowed to invoke. Governs *which skills exist as sanctioned* the way Agent Registry governs which *agents* exist as discoverable. | 5.1, 5.2 |

## The data layer underneath agentic workflows — `02-services/07-data-services.md`

> Scope discipline: these five are in scope **only** as the data layer
> under agentic workflows (RAG sources, session/state storage,
> tool-integration targets) — not as a general "which database" GCP
> architecture topic (that's `GCP/GCPPCA/` territory, out of scope here).

| Tool | What it is | Exam task(s) |
|---|---|---|
| **BigQuery** | Google Cloud's serverless data warehouse — used here as a structured-data source an agent's RAG pipeline or tool call can query. | 3.2 |
| **Cloud SQL** | Google Cloud's managed relational database (MySQL/PostgreSQL/SQL Server) — a data source or integration target for a custom agent's tool layer. | 3.2 |
| **Cloud Storage** | Google Cloud's object storage (files, not rows/tables) — where unstructured/multimodal source documents live before ingestion into a RAG pipeline. | 1.2, 3.2 |
| **Firestore** | A managed NoSQL document database — a common backing store for agent session/state data. | 3.1, 3.2 |
| **Memorystore for Redis** | A managed in-memory data store (Redis) — used for fast session caching or short-term agent memory where low latency matters more than durability. | 3.1 |

---

## Cross-reference: tools that appear in more than one file

Two tools have their **full reference entry** in one file and are only
**cross-referenced** (not duplicated) elsewhere, to avoid two files
quietly disagreeing with each other (CLAUDE.md §12 Step 4):

- **Agent Runtime** — full entry in `02-services/04-orchestration-protocols.md`; cross-referenced from `05-evaluation-deployment.md` (task 4.2's deployment-target comparison).
- **Agent Identity** — full entry in `02-services/06-security-governance.md`; cross-referenced from `04-orchestration-protocols.md` (task 3.3's multi-agent trust/identity needs).
- **Agent Registry** — full entry in `02-services/04-orchestration-protocols.md`; its governance/policy-enforcement role (5.1, 5.2) is cross-referenced from `06-security-governance.md` rather than re-explained.
- **Google Kubernetes Engine (GKE)** — genuinely two different facets in two different files (dev-time sandbox in `02-coding-agents-devtools.md`, task 2.1; production deployment target in `05-evaluation-deployment.md`, task 4.2) — not a duplicate, a different exam task each time. See `EXAM-TRAPS-AND-MNEMONICS.md` for the trap this creates.
