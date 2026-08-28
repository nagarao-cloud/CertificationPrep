# Master Flashcards — PAA (all 5 sections)

> Compressed by design (CLAUDE.md §10) — one deck, weighted toward
> Section 3 (~33% of the exam). Cover the **A** column and self-test.
> Renames/traps block is deliberately first — it's the highest-value,
> easiest-to-miss content in the whole folder. Source of truth for every
> card: `00-START-HERE/RUNBOOK.md` §3/§6/§7, `00-START-HERE/CLAUDE.md` §7/§8.

---

## 0. Renames and traps (drill this block until automatic)

| # | Q | A |
|---|---|---|
| 0.1 | What is "Agent Engine" now called? | **Agent Runtime.** Never lead with "Agent Engine" — it's the retired pre-rename name. |
| 0.2 | What is "Vertex AI Search" now called? | **Agent Search.** Guide's own parenthetical: "Agent Search (formerly Vertex AI Search)." |
| 0.3 | Does "Vertex AI Agent Builder" appear in the PAA exam guide? | **No.** The real low-code platform is **Gemini Enterprise**, built with **Agent Designer** and **CX Agent Studio**. |
| 0.4 | Is "Gemini Code Assist" the coding-agent tool tested on PAA? | **No** — not named in the guide at all. The guide names **Antigravity** (CLI/SDK/App) and **Claude Code on Google Cloud**. |
| 0.5 | Is PAB a generic IAM concept? | **No** — PAB (principal access boundary) is a specific mechanism configured via **Agent Identity**, task 5.1. |
| 0.6 | Is ADK closed-source? | **No** — ADK (Agent Development Kit) is explicitly described as **open-source**, task 3.1. |
| 0.7 | Does PAA overlap heavily with GCPPCA's cloud-architecture content? | **No** — PAA is a dedicated agentic-AI exam; its 28-item in-scope tool list has no generic compute/storage/networking-selection content. |
| 0.8 | Are the PAA section weights published or estimated? | **Published**, verbatim in the guide: 13/17/33/22/15%, summing to 100%. |
| 0.9 | What are the 5 section weights, smallest to largest? | 13% (S1) < 15% (S5) < 17% (S2) < 22% (S4) < 33% (S3). |
| 0.10 | Which section is nearly a third of the exam on its own? | **Section 3 — Developing custom agents (~33%).** |
| 0.11 | What does GKE mean in task 2.1 vs. task 4.2? | 2.1 = dev-time **coding-agent sandbox**. 4.2 = production **deployment target**. Same tool, different job — check the task context. |
| 0.12 | Auth Manager vs. PAB — which is authentication, which is authorization? | **Auth Manager (OAuth 2.0)** = authentication (valid caller). **PAB (Agent Identity)** = authorization (what that caller may do). |
| 0.13 | Model Armor vs. Sensitive Data Protection — which catches a leaked SSN, which catches a jailbreak attempt? | A leaked SSN = **Sensitive Data Protection** (data-sensitivity). A jailbreak/prompt-injection attempt = **Model Armor** (content-pattern safety). |
| 0.14 | Skill Registry vs. Agent Registry — which is narrower? | **Skill Registry** — vetted skills, capability-level, approval-focused. **Agent Registry** is broader: discoverable agents, orchestration/capability catalog. |

---

## 1. Section 1 — Low-code tools (~13%)

| # | Q | A |
|---|---|---|
| 1.1 | What are the three building blocks of a state-based low-code workflow? | **Pages, transition routes, event handlers.** |
| 1.2 | Which two Gemini Enterprise tools build these state-based workflows? | **Agent Designer** and **CX Agent Studio.** |
| 1.3 | What two prompt-template techniques does the guide name for 1.1? | **Few-shot** and **chain-of-thought.** |
| 1.4 | What service grounds a low-code agent on enterprise proprietary data? | **Agent Search** (via Gemini Enterprise). |
| 1.5 | What kind of unstructured data must 1.2 agents be able to ingest? | **Multimodal** — videos, audio, images. |
| 1.6 | Is model selection (LLM vs. SLM, OSS vs. proprietary) covered under Section 1? | **No** — that's task 3.1, not 1.1. Section 1 covers prompt-authoring, not model choice. |
| 1.7 | Are low-code (Gemini Enterprise) agents exempt from PAB/Agent Identity security? | **No** — they sit under the same Agent Identity/PAB/Agent Gateway surface as custom ADK agents. |

---

## 2. Section 2 — Coding agents (~17%)

| # | Q | A |
|---|---|---|
| 2.1 | What two coding-agent products does 2.1 name explicitly? | **Antigravity** (CLI/SDK/App) and **Claude Code on Google Cloud.** |
| 2.2 | What three things does 2.1 say you configure coding agents with? | **MCP servers, custom skills, access to tools.** |
| 2.3 | What three secure sandboxes does 2.1 name for running coding agents? | **GKE, Cloud Workstations, Antigravity** (itself). |
| 2.4 | What three verbs describe what coding agents do to source code (2.1)? | **Refactor, optimize (execution runtimes), patch (vulnerabilities).** |
| 2.5 | What six things can you create using Antigravity (2.2)? | **Skills, plugins, extensions, hooks, rules, subagents.** |
| 2.6 | What tool augments Antigravity to build/scale/govern/optimize deployed agents (2.2)? | **Agents CLI** (part of Agent Platform). |
| 2.7 | In task 2.1, does "GKE" mean a production deployment target? | **No** — in 2.1 GKE is a dev-time **sandbox**. Production deployment target is the 4.2 meaning. |

---

## 3. Section 3 — Developing custom agents (~33%, largest block)

| # | Q | A |
|---|---|---|
| 3.1 | What library do you use to build custom agents in code? | **ADK (Agent Development Kit)** — open-source. |
| 3.2 | What are the three model-selection axes named in 3.1? | **LLM vs. SLM · self-hosted vs. SaaS · OSS vs. proprietary.** |
| 3.3 | What three factors decide the model-selection axes? | **Cost, security, agent architecture.** |
| 3.4 | What manages long-term/persisted agent memory across sessions? | **Agent Platform Memory Bank.** |
| 3.5 | What manages a single conversation's live context? | **Managed sessions.** |
| 3.6 | What CLI configures skills, including "agent vs. human mode"? | **Agents CLI.** |
| 3.7 | What does "agent vs. human mode" control? | Who **executes** a skill/task — autonomously (agent) or with a human driving (human). Distinct from HITL (an approval gate before a risky action). |
| 3.8 | Name the RAG pipeline stages in order. | **Ingest → embed (embedding models) → store (vector DB) → similarity scoring → reranking → context fed to LLM.** |
| 3.9 | What two vector databases does 3.2 name together? | **Vector Search 1.0** and **Agent Retrieval.** |
| 3.10 | Where do you configure agent permissions in 3.2? | **Agent Identity.** |
| 3.11 | What two tools configure prebuilt/custom capabilities (integration layers, API integrations)? | **Agent Registry** and **Google Cloud MCP Servers.** |
| 3.12 | What does MCP connect agents to, per the guide's own wording? | "**Third-party SaaS tools and remote servers.**" |
| 3.13 | A2A vs. MCP — what's the deciding question? | Does the callee **reason for itself** (a peer agent)? Yes → **A2A**. No, it's a fixed tool/API/DB/SaaS → **MCP**. |
| 3.14 | Name the three multi-agent workflow patterns in 3.3. | **Parallel, sequential, graph.** |
| 3.15 | A scenario says "if confidence is low, retry; if still low, escalate" — sequential or graph? | **Graph** — conditional branching/looping, even though it reads step-by-step. |
| 3.16 | What four tools does 3.3 name for selecting/coordinating multi-agent workflows? | **Agent Identity, Agent Registry, Agent Runtime, agent policies.** |
| 3.17 | Is Agent Runtime the same thing as Agent Engine? | Yes — **Agent Runtime is the current name; Agent Engine is retired.** |
| 3.18 | What's the difference between MCP in task 2.1 and MCP in task 3.2/3.3? | Same protocol — 2.1 is the **coding agent's own** tool access; 3.2/3.3 is a **custom agent's** integration and orchestration layer. |

---

## 4. Section 4 — Evaluating and deploying (~22%)

| # | Q | A |
|---|---|---|
| 4.1 | What three ingredients make up a test set for agent evaluation? | **Golden data, prompts, edge cases.** |
| 4.2 | What does a continuous evaluation pipeline assess, specifically? | An agent's **tool execution** against **established success criteria.** |
| 4.3 | Name the three evaluation framework/tooling options in 4.1. | **ADK evaluation tooling (evalset), Agent Platform Gen AI evaluation service, custom autoraters.** |
| 4.4 | Which evaluation option is dev-time, close to the codebase? | **ADK evalset.** Guide's own phrase: "evaluating ... using ADK." |
| 4.5 | Which evaluation option is continuous and production-facing? | **Agent Platform Gen AI evaluation service.** |
| 4.6 | When do you reach for a custom autorater? | When built-in tools don't cover your **domain-specific success criteria.** |
| 4.7 | Golden-dataset evaluation via ADK checks quality of what two things? | **Agent response quality AND retrieval quality.** |
| 4.8 | Name the three deployment targets in 4.2. | **Agent Runtime, Cloud Run, GKE.** |
| 4.9 | What three factors decide the deployment target? | **Use case, requirements, and cost** — no fixed ranking. |
| 4.10 | Which deployment target fits variable/spiky traffic with scale-to-zero? | **Cloud Run.** |
| 4.11 | Which deployment target fits GPU scheduling / custom networking / multi-tenant isolation? | **GKE.** |
| 4.12 | Which deployment target fits agent-native lifecycle (sessions/memory/coordination) with minimal ops? | **Agent Runtime.** |
| 4.13 | Name the four troubleshooting failure modes named in 4.2. | **Drift, tool invocation latency, agent reasoning loops, system failures.** |
| 4.14 | What three things should you optimize agents for (4.2)? | **Performance, reliability, cost.** |
| 4.15 | What three specific problems does 4.2 say to identify? | **Logic errors, latency bottlenecks, hallucinations.** |
| 4.16 | What Google Cloud service pair is named for observability? | **Cloud Logging and Cloud Trace** (Google Cloud Observability). |

---

## 5. Section 5 — Securing and governing (~15%)

| # | Q | A |
|---|---|---|
| 5.1 | What secures agent-to-tool API calls in 5.1? | **OAuth 2.0**, via **Auth Manager.** |
| 5.2 | Where are PAB policies configured? | **Agent Identity.** |
| 5.3 | What does Agent Gateway do, per the guide's own wording? | "**Monitor traffic and track agents.**" |
| 5.4 | What two tools handle governance and policy enforcement in 5.1? | **Agent Registry** and **Model Armor.** |
| 5.5 | Name the three safety-framework/guardrail tools in 5.2. | **Agent Gateway, Model Armor, HITL.** |
| 5.6 | What two tools handle secure data access and identity propagation in 5.2? | **Agent Gateway** and **Agent Registry.** |
| 5.7 | What does HITL stand for and do? | **Human-in-the-loop** — a human approves/reviews before a risky agent action proceeds. |
| 5.8 | What catches PII/secrets leaking in an agent's output? | **Sensitive Data Protection.** |
| 5.9 | What catches a prompt-injection or jailbreak attempt? | **Model Armor.** |
| 5.10 | In the "who/what/safe/human" mental model, what order do the four layers go in? | **PAB (who) → Agent Gateway (what's flowing + propagation) → Model Armor (is content safe) → HITL (human backstop).** |
| 5.11 | Are Agent Identity and Agent Registry new to Section 5, or reused? | **Reused from Section 3** — same platform primitives, now viewed through a governance/security lens. |
| 5.12 | "Identity propagation across hops" — which tool? | **Agent Gateway**, not PAB. PAB sets the boundary once; propagation is continuous. |

---

## Deck stats

- **74 cards** total: 14 renames/traps + 7 (S1) + 7 (S2) + 18 (S3) + 16 (S4) + 12 (S5).
- Section 3 gets the largest block, matching its ~33% exam weight.
- Every card traces to a verbatim guide fact in `RUNBOOK.md` §3/§6/§7 — no invented content.
