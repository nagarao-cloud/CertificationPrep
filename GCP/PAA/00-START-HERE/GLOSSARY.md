# GLOSSARY — A-Z, all 28 tools + general vocabulary

> Compressed by design (CLAUDE.md §10) — this is a lookup file, not a
> teaching file. Every definition here is sourced from where it's
> already taught in full, not re-derived: the 5 per-section "Tool
> glossary" blocks in `07-revision/section-N-cheatsheet.md`, `CLAUDE.md`
> §8, and `05-labs/lab-07-capstone-realtime-agentic-project.md`'s
> ground-zero vocabulary primer (§0.1). **This file supersedes nothing**
> — the per-section cheatsheet glossaries stay exactly as they are,
> scoped for spaced repetition within a section; this is the only new
> thing: a single alphabetical jump point across all of them. If a
> definition here and its source ever seem to disagree, the source file
> (last column) is authoritative.

---

## General AI/cloud vocabulary (not PAA-specific, but assumed unknown per CLAUDE.md §2)

| Term | One-line definition | Full treatment |
|---|---|---|
| **Agent** | Software that receives a request, decides what to do using an AI model's reasoning (not fixed if/else branches), optionally calls tools/retrieves data, and responds. | `lab-07...md` §0.1 |
| **CI/CD** | Continuous integration/delivery — the automated pipeline that builds, tests, and deploys code changes, typically triggered on push. | `lab-07...md` §0.1 |
| **Embedding** | Converting text/content into a vector of numbers such that similar meanings produce numbers close together — enables similarity search. | `lab-07...md` §0.1 |
| **Guardrail** | A control that constrains system behavior/output to stay within bounds, independent of the system's own internal judgment. | `lab-07...md` §0.1 |
| **IAM** | Identity and Access Management — the general concept of who (person, service, or agent) is allowed to do what. This exam layers agent-specific mechanisms (Agent Identity, PAB) on top. | `lab-07...md` §0.1 |
| **Latency / Throughput** | Latency = how long one response takes. Throughput = how much work over time. Can trade off against each other. | `lab-07...md` §0.1 |
| **LLM** | Large language model — the underlying AI model that understands text and generates responses. An agent is the surrounding system built around one or more LLMs. | `lab-07...md` §0.1 |
| **OAuth 2.0** | A standard protocol for granting one system limited, revocable access to act on behalf of a principal, without sharing long-term credentials. | `lab-07...md` §0.1, `02-services/06-security-governance.md` |
| **Observability** | The ability to see what a running system is actually doing — via logs, traces, and metrics — well enough to diagnose problems. | `lab-07...md` §0.1 |
| **Prompt** | The text given to an LLM to elicit a response. A **system prompt** persists across a whole interaction, vs. a user's per-turn question. | `lab-07...md` §0.1 |
| **RAG** | Retrieval-augmented generation — retrieving relevant content before generating a response, so answers are grounded in real, specific, current content rather than only training knowledge. | `lab-07...md` §0.1, `03-adk-custom-development.md` |
| **Service account** | A non-human identity software uses to authenticate itself, as opposed to a person logging in with their own credentials. | `lab-07...md` §0.1 |
| **Session vs. Memory** | Session = state for one ongoing interaction. Memory = state that persists across separate interactions over time. | `lab-07...md` §0.1 |
| **Tool-calling / function-calling** | The mechanism by which an LLM can invoke a predefined function with structured arguments and use the result — what lets an agent actually *do* things, not just talk about them. | `lab-07...md` §0.1 |
| **Vector database** | A database built to store embeddings and quickly find the ones most similar to a query embedding — the retrieval half of RAG. | `lab-07...md` §0.1 |

---

## PAA-specific tools, acronyms, and protocols (A-Z)

| Term | One-line definition | Full treatment |
|---|---|---|
| **A2A (Agent2Agent)** | Protocol for agent-to-agent orchestration — peer agents that reason for themselves, discovered via Agent Registry. | `02-services/04-orchestration-protocols.md`, `03-comparisons/03-a2a-vs-mcp-vs-direct-integration.md` |
| **ADK (Agent Development Kit)** | Open-source library for building custom agents in code — the core Section 3 toolkit. Never call it closed-source. | `02-services/03-adk-custom-development.md` |
| **ADK evaluation tooling (evalset)** | Dev-time evaluation built into ADK — golden-dataset response/retrieval quality checks close to the codebase. | `02-services/05-evaluation-deployment.md`, `03-comparisons/05-evaluation-approaches.md` |
| **Agent Development Kit** | See **ADK**. | — |
| **Agent Gateway** | Monitors traffic and tracks agents in real time; handles identity propagation across multi-hop calls. | `02-services/06-security-governance.md` |
| **Agent Identity** | Where agent permissions are configured, including PAB policies. | `02-services/06-security-governance.md`, `02-services/03-adk-custom-development.md` |
| **Agent Platform** | The umbrella containing Agents CLI, Memory Bank, and managed sessions for custom agent development. | `02-services/03-adk-custom-development.md` |
| **Agent Platform Gen AI evaluation service** | Production-facing, continuous evaluation pipeline — the platform-level counterpart to ADK evalset. | `02-services/05-evaluation-deployment.md` |
| **Agent Platform Memory Bank** | Manages agent memory — persisted knowledge/context across turns and sessions. | `02-services/03-adk-custom-development.md` |
| **Agent Registry** | Catalog/registry for prebuilt and custom capabilities; also used for multi-agent coordination (3.3) and governance (Section 5). | `02-services/03-adk-custom-development.md`, `02-services/04-orchestration-protocols.md` |
| **Agent Retrieval** | Named alongside Vector Search 1.0 as a retrieval-system option for RAG pipelines. | `02-services/03-adk-custom-development.md` |
| **Agent Runtime** | Managed deployment/runtime target for agents. **Formerly Agent Engine — never say the old name** except in a rename callout. | `02-services/04-orchestration-protocols.md`, `02-services/05-evaluation-deployment.md`, `03-comparisons/04-agent-hosting-deployment-options.md` |
| **Agent Search** | Enterprise data-grounding/retrieval service used by Gemini Enterprise agents. **Formerly Vertex AI Search — never say the old name.** | `02-services/01-gemini-enterprise-low-code.md` |
| **Agent2Agent** | See **A2A**. | — |
| **Agents CLI** | Part of Agent Platform — augments Antigravity (build/scale/govern/optimize deployed agents) and configures skills for custom ADK agents. | `02-services/02-coding-agents-devtools.md`, `02-services/03-adk-custom-development.md` |
| **Antigravity** | Google's coding-agent product, ships as CLI, SDK, and App — the guide's headline coding-agent name. NOT "Gemini Code Assist." | `02-services/02-coding-agents-devtools.md` |
| **Auth Manager (OAuth 2.0)** | Handles authentication for agent-to-tool API calls — is this caller valid at all. | `02-services/06-security-governance.md` |
| **Claude Code on Google Cloud** | The guide's other named coding-agent example alongside Antigravity — called out for MCP-server/tool configuration. | `02-services/02-coding-agents-devtools.md` |
| **Cloud Run** | Serverless container deployment target — one of Section 4's three named deployment options. | `02-services/05-evaluation-deployment.md`, `03-comparisons/04-agent-hosting-deployment-options.md` |
| **Cloud Workstations** | Managed, secure dev environment — a named sandbox for running coding agents safely, alongside GKE and Antigravity itself. | `02-services/02-coding-agents-devtools.md` |
| **Custom autoraters** | Purpose-built evaluators for success criteria the built-in evaluation tools don't cover. | `02-services/05-evaluation-deployment.md` |
| **CX Agent Studio** | Customer-Experience-flavored low-code builder alongside Agent Designer — aimed at conversational/support-style agents. | `02-services/01-gemini-enterprise-low-code.md` |
| **Gemini Enterprise** | The umbrella low-code platform for building/deploying agents without writing orchestration code. NOT "Vertex AI Agent Builder." | `02-services/01-gemini-enterprise-low-code.md` |
| **Gemini LLMs** | The underlying language models Gemini Enterprise and custom agents run on. | `02-services/01-gemini-enterprise-low-code.md` |
| **GKE (Google Kubernetes Engine)** | **Two contexts, same tool:** a coding-agent dev-time sandbox (task 2.1) vs. a production deployment target (task 4.2). Don't collapse them. | `02-services/02-coding-agents-devtools.md`, `02-services/05-evaluation-deployment.md` |
| **Google Cloud MCP Servers** | Google-provided MCP servers for common integration targets (managed databases, APIs, third-party SaaS, remote servers). | `02-services/04-orchestration-protocols.md` |
| **Google Cloud Observability** | Cloud Logging + Cloud Trace — the monitoring backbone for troubleshooting deployed agents. | `02-services/05-evaluation-deployment.md` |
| **HITL (human-in-the-loop)** | A safety framework where a human must approve/review a risky agent action before it proceeds. | `02-services/06-security-governance.md`, `lab-07...md` §0.1 |
| **Managed sessions** | Agent Platform's handling of session state (one conversation's short-lived context), distinct from long-term memory. | `02-services/03-adk-custom-development.md` |
| **MCP (Model Context Protocol)** | Protocol for agent-to-tool/data connections — fixed tools, APIs, databases, SaaS, remote servers. | `02-services/04-orchestration-protocols.md`, `03-comparisons/03-a2a-vs-mcp-vs-direct-integration.md` |
| **Model Armor** | Content-safety guardrail tooling — screens model input/output for unsafe patterns (prompt injection, jailbreaks, unsafe content). | `02-services/06-security-governance.md` |
| **Model Context Protocol** | See **MCP**. | — |
| **Model Garden** | Google's catalog of available models for use in agent development. | `02-services/01-gemini-enterprise-low-code.md` |
| **PAB (principal access boundary)** | A specific named access-boundary policy mechanism, configured via Agent Identity. Not a generic IAM synonym. | `02-services/06-security-governance.md`, `03-comparisons/06-security-governance-models.md` |
| **RAG Engine** | Managed pipeline service for retrieval-augmented generation — the "ingest, chunk, embed, retrieve" plumbing. | `02-services/03-adk-custom-development.md` |
| **Sensitive Data Protection** | Detects/handles sensitive data (PII, secrets) in agent inputs/outputs — a data-*sensitivity* control, distinct from Model Armor's content-*pattern* focus. | `02-services/06-security-governance.md` |
| **Skill Registry** | Governs vetted skills at the capability level — approval-focused, narrower than Agent Registry's broader agent-catalog scope. | `02-services/06-security-governance.md` |
| **SLM (small language model)** | A smaller alternative to a full LLM — one of the model-selection axes in task 3.1 (cost/security/architecture tradeoffs). | `01-domains/SECTION-3-custom-agents.md` §3.1 |
| **Vector Search 1.0** | The vector database product used as a retrieval backend for RAG, paired with Agent Retrieval. | `02-services/03-adk-custom-development.md` |

---

## Quick cross-reference: where the fuller decision guidance lives

For any term above involved in a "which one do I pick" decision (e.g.
Agent Runtime vs. Cloud Run vs. GKE, A2A vs. MCP, PAB vs. Agent Gateway
vs. Model Armor), the **Full treatment** column's `02-services/` file
explains what the tool *is*; the matching `03-comparisons/` file (where
listed) explains *when to use it over the alternative*. Read both for
scenario-style exam questions — this glossary only answers "what does
this mean," not "which one is correct here."
