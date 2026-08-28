# RUNBOOK — GCP Professional Agentic Architect (PAA) bulk-generation source of truth

> Produced by CLAUDE.md §12 Step 0/0b. Every later generation step in this
> folder reads **this file**, not the vendor guide again and not
> assumptions carried from `AWS/AWSDEA/`, `AWS/AWSAIF/`, or `GCP/GCPPCA/`.

---

## 1. Source and access note (read this first)

**Two sources, both primary, both HIGH confidence:**

1. **`https://cloud.google.com/learn/certification/agentic-architect`**
   (fetched directly this session, 2026-08-28) — gives the certification
   description, exam format (two required parts), pricing, validity,
   language, prerequisites, and beta registration date.
2. **The official exam guide PDF**
   (`professional_agentic_architect_exam_guide_english.pdf`) — gives
   the 5-section domain structure, exact weights, every task-level
   bullet, and the 23-item in-scope tool list.

**Access constraint and how source 2 was actually obtained:** this
session's outbound network egress goes through a policy-enforcing
proxy. Both `services.google.com` (which hosts the guide PDF at
`https://services.google.com/fh/files/misc/professional_agentic_architect_exam_guide_english.pdf`)
and `drive.google.com` (a Google Drive link the user also tried) were
tested directly via both the WebFetch tool and a raw `curl` against the
proxy — both returned `EGRESS_BLOCKED` / HTTP 403 at the proxy/CONNECT
level, for both domains. Per this environment's own instructions, a
403/407 policy denial is to be reported, not routed around.

**The user resolved this by uploading the PDF directly** into the
session as a local file
(`/root/.claude/uploads/8cfd252a-1885-5ae6-aa23-7c8ae1c41403/d1d715a0-professional_agentic_architect_exam_guide_english.pdf`),
which was read in full (4 pages) via the file-reading tool on
2026-08-28. **Every domain/task/tool fact below is transcribed directly
from that read — not reconstructed, not paraphrased from memory, not
sourced from web search.**

**Confidence: HIGH across the board** — domain names, weights, every
task-level bullet (1.1 through 5.2), and the full in-scope tool list are
all verbatim from the primary source PDF. This is a **stronger**
sourcing position than `GCP/GCPPCA/00-START-HERE/RUNBOOK.md`, which
never obtained PDF access in any session and had to rely on
reconstruction plus secondary (third-party) corroboration for its
task-level content and weights. Nothing in this runbook is
reconstructed or estimated; weights and tool names came directly off
the guide's pages.

**One category that is genuinely not from the guide, flagged
separately:** lab-specific UI/console click-paths for `05-labs/`. The
guide names the tools (Agent Designer, CX Agent Studio, Antigravity,
ADK, etc.) and what they're used for, but does not include
step-by-step console instructions, and this session has no live access
to the Google Skills platform or any of these consoles. `05-labs/`
content is therefore built from the guide's stated capabilities plus
general product-documentation-style knowledge of how these tools work,
and must be flagged as best-effort/illustrative rather than
click-verified — see §7's last row and CLAUDE.md §3.

---

## 2. Exam facts (confirmed from `cloud.google.com`, primary source)

| Fact | Value |
|---|---|
| Certification | Google Cloud Certified — Professional Agentic Architect |
| Code used in this repo | PAA |
| Status | **Beta** — registration opens 2026-09-03 |
| Format | TWO required parts: (1) proctored MC exam, (2) hands-on labs |
| Questions | ~80 |
| Duration | 3 hours |
| Delivery | Online-proctored (remote) or onsite-proctored (Pearson VUE test center) |
| Hands-on labs | Taken separately in the Google Skills platform; validates hands-on execution/coding ability; must pass both components to earn the certification |
| Cost | $120 USD beta (40% off $200 USD retail) + applicable tax |
| Beta attempt policy | Beta attempts do not count toward total allowable exam attempts |
| Languages | English only (beta) |
| Prerequisites | None formally required |
| Recommended experience | 3+ years hands-on experience building/testing/deploying/managing cloud solutions, including 1+ years building agentic solutions on Google Cloud |
| Validity | 1 year |

### Verbatim candidate description (quoted exactly from the exam guide PDF, page 1)

> "A Google Cloud Certified Professional Agentic Architect is a
> technical practitioner who designs and manages autonomous, AI-driven
> agentic workflows in Google Cloud. This individual is an experienced
> developer or architect who builds agentic solutions while considering
> reliability, performance, cost, security, and scalability. This
> individual has deep experience utilizing large language models
> (LLMs), applying agent design patterns, writing code, and integrating
> data sources in Google Cloud."

---

## 3. Full hierarchy (5 sections, verbatim task structure)

**All content in this section is `[verbatim — HIGH confidence]`,
transcribed directly from the exam guide PDF (4 pages) — not
reconstructed.**

| # | Section (verbatim title) | Weight | Tasks |
|---|---|---|---|
| 1 | Building agents using low-code tools | **~13%** | 1.1, 1.2 |
| 2 | Using coding agents for application development | **~17%** | 2.1, 2.2 |
| 3 | Developing custom agents | **~33%** | 3.1, 3.2, 3.3 |
| 4 | Evaluating and deploying agentic workflows | **~22%** | 4.1, 4.2 |
| 5 | Securing and governing agentic workflows | **~15%** | 5.1, 5.2 |

Sums to 100%. **Section 3 is by far the heaviest — nearly a third of
the exam on its own.** Study-plan time and practice-question volume
should be allocated proportionally to these weights, not evenly across
5 sections.

### Section 1 — Building agents using low-code tools (~13%)

**1.1 Configuring agentic workflows and behavior using low-code
tools.** Considerations include:
- Configuring state-based workflows (pages, transition routes, and
  event handlers) using Gemini Enterprise tools (e.g., Gemini
  Enterprise Agent Designer and Customer Experience Agent Studio [CX
  Agent Studio])
- Creating system instructions and in-console prompt templates (e.g.,
  few-shot and chain-of-thought) to guide agent behavior (e.g., Agent
  Designer and CX Agent Studio)

**1.2 Connecting enterprise data to Gemini Enterprise.** Considerations
include:
- Configuring agents to securely connect and query enterprise
  proprietary data sources (e.g., Gemini Enterprise and Agent Search)
- Ingesting and processing unstructured multimodal data (e.g., videos,
  audio, and images) into the agentic workflow

### Section 2 — Using coding agents for application development (~17%)

**2.1 Using coding agents effectively.** Considerations include:
- Configuring coding agents with Model Context Protocol (MCP) servers,
  custom skills, and access to tools (e.g., Antigravity and Claude Code
  on Google Cloud)
- Using coding agents in secure sandboxes (e.g., Google Kubernetes
  Engine [GKE], Cloud Workstations, and Antigravity)
- Using coding agents to refactor source code, optimize execution
  runtimes, and patch application-layer vulnerabilities

**2.2 Customizing coding agents for enterprise workflows.**
Considerations include:
- Creating skills, plugins, extensions hooks, rules, and subagents
  using Antigravity
- Augmenting Antigravity with Agents CLI to build, scale, govern, and
  optimize deployed agents

### Section 3 — Developing custom agents (~33%)

**3.1 Designing and building agentic workflows in code.**
Considerations include:
- Selecting and configuring the appropriate language model (e.g.,
  large language model [LLM] vs. small language model [SLM],
  self-hosted vs. software as a service [SaaS], and open-source
  software [OSS] vs. proprietary LLM) considering cost, security, and
  agent architecture
- Building custom agents using open-source libraries (e.g., Agent
  Development Kit [ADK])
- Configuring sessions and memory (e.g., Agent Platform Memory Bank and
  managed sessions)
- Configuring skills using Agents CLI (e.g., plugins and agent vs.
  human mode)

**3.2 Integrating enterprise domain knowledge.** Considerations
include:
- Designing, configuring, and managing retrieval-augmented generation
  (RAG) pipelines and vector retrieval systems (e.g., embedding models,
  similarity scoring, and reranking) using appropriate services such as
  vector databases (e.g., Vector Search and Agent Retrieval)
- Configuring agent permissions (e.g., Agent Identity)
- Using Google Cloud tools (e.g., Agent Registry, Google Cloud MCP
  Servers) to configure prebuilt and custom capabilities (e.g., custom
  integration layers for managed databases, API integrations, and MCP
  server that connects agents to third-party SaaS tools and remote
  servers)

**3.3 Orchestrating and coordinating agentic workflows.**
Considerations include:
- Orchestrating agents using agentic protocols (e.g., MCP and
  Agent2Agent [A2A])
- Selecting and coordinating multi-agent handoffs and workflows (e.g.,
  parallel agents, sequential agents, and graph workflow) using Google
  Cloud tools (e.g., Agent Identity, Agent Registry, Agent Runtime, and
  agent policies)

### Section 4 — Evaluating and deploying agentic workflows (~22%)

**4.1 Evaluating agents in development and in production.**
Considerations include:
- Creating test sets for agent evaluation (e.g., golden data, prompts,
  and edge cases)
- Creating continuous evaluation pipelines to assess an agent's tool
  execution based on established success criteria
- Determining the appropriate evaluation framework and tooling (e.g.,
  ADK evaluation tooling (evalset), Agent Platform Gen AI evaluation
  service, and custom autoraters)
- Evaluating an agentic system against a golden dataset to assess agent
  response and retrieval quality (e.g., using ADK)

**4.2 Deploying and scaling production workloads.** Considerations
include:
- Selecting optimal deployment runtime based on the use case,
  requirements, and cost (e.g., Agent Runtime, Cloud Run, and GKE)
- Troubleshooting agent issues (e.g., drift, tool invocation latency,
  agent reasoning loops, and system failures)
- Monitoring and optimizing agents for performance, reliability, and
  cost (e.g., identify logic errors, latency bottlenecks, and
  hallucinations)

### Section 5 — Securing and governing agentic workflows (~15%)

**5.1 Configuring agent security and governance.** Considerations
include:
- Implementing authentication and secure tool execution (e.g.,
  agent-to-tool API calls using OAuth 2.0)
- Configuring principal access boundary (PAB) policies using Agent
  Identity
- Configuring Agent Gateway to monitor traffic and track agents
- Designing and configuring agentic governance and policy enforcement
  (e.g., Agent Registry and Model Armor)

**5.2 Implementing secure agent behavior and execution.**
Considerations include:
- Designing appropriate safety frameworks and guardrails (e.g., Agent
  Gateway, Model Armor, and human-in-the-loop [HITL])
- Configuring secure access to data and identity propagation (e.g.,
  Agent Gateway and Agent Registry)

---

## 4. Coverage map

Tracks, per leaf (11 task leaves total), which repo file(s) are
responsible, and whether that leaf has **Design** (production
architecture diagram), a **Decision matrix** (head-to-head comparison
table), and stated **Tradeoffs** (paired "use X / don't use X, use Y
instead"). ✅ = present, 🕐 = planned for this bulk pass, — = not the
right content type for this leaf.

| Leaf | File(s) | Design | Decision matrix | Tradeoffs |
|---|---|---|---|---|
| 1.1 Low-code workflow config | `01-domains/SECTION-1-low-code-tools.md` §1.1, `02-services/01-gemini-enterprise-low-code.md`, `04-architectures/pattern-low-code-cx-agent.md`, `05-labs/lab-01-agent-designer-cx-studio-walkthrough.md` | 🕐 | 🕐 | 🕐 |
| 1.2 Enterprise data connection | `01-domains/SECTION-1-low-code-tools.md` §1.2, `02-services/01-gemini-enterprise-low-code.md` | — | 🕐 | 🕐 |
| 2.1 Using coding agents effectively | `01-domains/SECTION-2-coding-agents.md` §2.1, `02-services/02-coding-agents-devtools.md`, `05-labs/lab-02-antigravity-coding-agent-workflow.md` | 🕐 | 🕐 | 🕐 |
| 2.2 Customizing coding agents | `01-domains/SECTION-2-coding-agents.md` §2.2, `02-services/02-coding-agents-devtools.md`, `04-architectures/pattern-coding-agent-cicd-integration.md` | 🕐 | — | 🕐 |
| 3.1 Designing/building agentic workflows in code | `01-domains/SECTION-3-custom-agents.md` §3.1, `02-services/03-adk-custom-development.md`, `03-comparisons/01-low-code-vs-custom-development.md`, `05-labs/lab-03-adk-custom-agent-build.md` | 🕐 | 🕐 | 🕐 |
| 3.2 Integrating enterprise domain knowledge | `01-domains/SECTION-3-custom-agents.md` §3.2, `02-services/03-adk-custom-development.md` | 🕐 | 🕐 | 🕐 |
| 3.3 Orchestrating/coordinating agentic workflows | `01-domains/SECTION-3-custom-agents.md` §3.3, `02-services/04-orchestration-protocols.md`, `03-comparisons/02-orchestration-pattern-options.md`, `03-comparisons/03-a2a-vs-mcp-vs-direct-integration.md`, `04-architectures/pattern-multi-agent-a2a-mcp-orchestration.md`, `05-labs/lab-04-a2a-mcp-multi-agent-integration.md` | 🕐 | 🕐 | 🕐 |
| 4.1 Evaluating agents (dev + prod) | `01-domains/SECTION-4-evaluate-deploy.md` §4.1, `02-services/05-evaluation-deployment.md`, `03-comparisons/05-evaluation-approaches.md`, `04-architectures/pattern-evaluation-deployment-pipeline.md`, `05-labs/lab-05-agent-evaluation-deployment.md` | 🕐 | 🕐 | 🕐 |
| 4.2 Deploying/scaling production workloads | `01-domains/SECTION-4-evaluate-deploy.md` §4.2, `02-services/05-evaluation-deployment.md`, `03-comparisons/04-agent-hosting-deployment-options.md` | 🕐 | 🕐 | 🕐 |
| 5.1 Agent security and governance config | `01-domains/SECTION-5-secure-govern.md` §5.1, `02-services/06-security-governance.md`, `03-comparisons/06-security-governance-models.md`, `04-architectures/pattern-secure-governed-enterprise-agent-platform.md`, `05-labs/lab-06-secure-agent-governance-setup.md` | 🕐 | 🕐 | 🕐 |
| 5.2 Secure agent behavior/execution | `01-domains/SECTION-5-secure-govern.md` §5.2, `02-services/06-security-governance.md` | 🕐 | 🕐 | 🕐 |

Status: **in progress** — this table is populated with planned file
assignments at RUNBOOK-writing time; flip 🕐 → ✅ as each generation
batch (Step 4 of the plan / §12 of `CLAUDE.md`) completes and content
is verified against this leaf.

---

## 5. Generation checklist (mirrors the 00–09 folder layout)

- [x] `00-START-HERE/` — RUNBOOK.md (this file)
- [ ] `00-START-HERE/` — STUDY-PLAN.md, SERVICE-MATRIX.md,
      DECISION-TREES.md, EXAM-TRAPS-AND-MNEMONICS.md
- [ ] `01-domains/` — 5 files (SECTION-1 through SECTION-5)
- [ ] `02-services/` — 7 files
- [ ] `03-comparisons/` — 6 files
- [ ] `04-architectures/` — 6 files
- [ ] `05-labs/` — 7 files (6 per-section labs + 1 flagship capstone,
      `lab-07-capstone-realtime-agentic-project.md`, see §8)
- [ ] `06-practice/` — 7 files (5 section banks + 2 mock exams)
- [ ] `07-revision/` — 6 files (5 cheatsheets + master flashcards)
- [ ] `08-interview/` — 2 files
- [ ] `09-assets/` — 3 files
- [ ] `CLAUDE.md` §5 updated with per-folder line-count summary,
      mirrored to `GEMINI.md`/`AGENTS.md`
- [ ] `README.md` and `llms.txt` populated (currently template
      placeholders)
- [ ] Final sweep: no placeholder markers, no Agent Engine/Vertex AI
      Search terminology traps, weights consistent everywhere, §5
      line-count summary updated in `CLAUDE.md` and this file

## 6. In-scope / out-of-scope tool signal

**In scope — verbatim list from the exam guide PDF (23 items, page
4), the authoritative scope for this exam:**

Agent Development Kit (ADK) · Agent evaluation · Agent Gateway · Agent
Identity · Agent Registry · Agent Retrieval and Vector Search 1.0 ·
Agent Runtime (**formerly Agent Engine**) · Agent Search (**formerly
Vertex AI Search**) · Agentic protocols (e.g., Agent2Agent [A2A], MCP)
· Agents CLI in Agent Platform · Antigravity (CLI, SDK, App) · Auth
Manager (OAuth 2.0) · BigQuery · Cloud Run · Cloud SQL · Cloud Storage
· Firestore · Gemini Enterprise · Gemini LLMs · Google Cloud
Observability (Cloud Logging and Cloud Trace) · Google Kubernetes
Engine (GKE) · Memorystore for Redis · Model Armor · Model Context
Protocol (MCP) servers · Model Garden · RAG Engine · Sensitive Data
Protection · Skill Registry.

**Out of scope, by inference:** the guide publishes no explicit
"out of scope" list (unlike some vendors' guides). Treat anything not
in the 23-item list above as presumptively out of scope. The single
biggest cross-contamination risk is generic GCP architecture content
that belongs to `GCP/GCPPCA/` (raw compute/storage/networking service
selection unrelated to agents, generic HA/DR patterns, IAM taught as a
general topic rather than through Agent Identity/PAB specifically) —
this folder should read as if GCPPCA never existed. Note also that
several data services (BigQuery, Cloud SQL, Cloud Storage, Firestore,
Memorystore) *are* explicitly in scope here, but only as the data layer
underneath agentic workflows (RAG sources, session/state storage,
tool-integration targets) — not as a general "when to use which
database" architecture topic the way GCPPCA covers them.

## 7. Currency-corrections table

| Do not say | Say instead | Why |
|---|---|---|
| "Agent Engine is the managed runtime for deploying agents" | "Renamed to **Agent Runtime** — the exam guide names it 'Agent Runtime (formerly Agent Engine)'" | Direct quote from the guide's in-scope tool list (page 4). A candidate studying from older/generic material will have "Agent Engine" in their head; this is a near-certain exam trap. |
| "Vertex AI Search is the enterprise-data grounding service" | "Renamed to **Agent Search** — the exam guide names it 'Agent Search (formerly Vertex AI Search)'" | Same source, same pattern — direct quote from the guide's in-scope tool list. |
| "Vertex AI Agent Builder is the low-code agent platform" | "That branding is absent from the guide entirely. The real low-code platform named throughout is **Gemini Enterprise**, built with **Agent Designer** and **CX Agent Studio**" | Confirmed by reading Section 1's verbatim task bullets, which name Gemini Enterprise/Agent Designer/CX Agent Studio repeatedly and never mention "Vertex AI Agent Builder." A general web search for this cert (done earlier in this session, before the PDF was available) surfaced the wrong branding — a clear illustration of why this correction matters. |
| "Gemini Code Assist is the coding-agent tool tested here" | "The guide names **Antigravity** (CLI/SDK/App) and **Claude Code on Google Cloud** explicitly, in Sections 2.1/2.2" | Direct quote from Section 2's task bullets. Gemini Code Assist does not appear in the guide. |
| "PAB is a generic IAM policy concept" | "**PAB (principal access boundary)** is a specific named mechanism, configured via **Agent Identity**, per task 5.1" | Direct quote from Section 5.1. |
| "ADK is closed-source / Google-internal" | "ADK (Agent Development Kit) is explicitly described as **open-source** in task 3.1" | Direct quote: "Building custom agents using open-source libraries (e.g., Agent Development Kit [ADK])." |
| "This exam overlaps with GCPPCA's cloud-architecture content" | "PAA is a dedicated agentic-AI exam; the 23-item in-scope tool list contains no general compute/storage/networking-selection topics — don't reuse GCPPCA study material or assume overlap" | Confirmed by comparing the guide's in-scope tool list against GCPPCA's domain content — no overlap beyond data-layer services used in an agent-specific way (see §6). |
| "This exam's guide has weighted percentages that are estimates/unpublished" | "Weights are **explicitly published in the guide itself** — 13/17/33/22/15%, verbatim per-section, summing to 100%" | Directly stated in each section header of the guide (e.g. "Section 3: Developing custom agents (~33% of the exam)"). This corrects the plan's own earlier draft, written before the PDF was available, which assumed weights were unpublished. |
| "`05-labs/` walkthroughs in this folder are verified, click-by-click console steps" | "Lab content is **best-effort**, built from the guide's stated tool capabilities and general product knowledge — this environment has no live access to the Google Skills platform or any of Agent Designer/CX Agent Studio/Antigravity's actual consoles, so exact UI paths are illustrative, not verified. Cross-check against the live console before an exam attempt." | Stated directly by the user's approved plan — an honesty requirement, not a guide fact. Google Skills/console UI is also the part of this beta product surface most likely to change before GA. |

## 8. Capstone real-time project (added 2026-08-28, per user request)

**Scope change:** the user identified as a beginner (not intermediate,
correcting CLAUDE.md §2) and asked for a ground-zero, end-to-end,
hands-on real-world project — design → implementation → evaluation →
best practices — in addition to the standard per-section labs. This is
now a **required** file: `05-labs/lab-07-capstone-realtime-agentic-project.md`
(see CLAUDE.md §3). It is the folder's flagship file and should run
1,500–2,500+ lines rather than a standard lab's length.

**Project concept — "Internal Knowledge & Support Agent Platform"** (a
realistic enterprise scenario chosen because it naturally exercises all
5 exam sections, so the capstone doubles as an integrated review, not
just a Section-3 exercise):

A fictional mid-size company wants an internal agent that (a) answers
employee questions against internal docs/policies, (b) can be extended
by engineers into a more capable coding/ops assistant, and (c) must be
secure and governed before any production rollout. The project is
staged in phases that map directly onto the exam sections:

| Phase | What gets built | Exam section(s) exercised |
|---|---|---|
| 0. Problem framing & requirements | Define the use case, success criteria, constraints (cost, data sensitivity, latency) — beginner-friendly requirements-gathering primer | — (project-management framing, not exam content, but necessary scaffolding for a true beginner) |
| 1. MVP via low-code | Stand up a first version in Gemini Enterprise using Agent Designer + CX Agent Studio, grounded on internal docs via Agent Search | Section 1 (~13%) |
| 2. Extend with coding agents | Use Antigravity / Claude Code on Google Cloud to build custom tooling, skills, and CI/CD around the agent's codebase, in a GKE/Cloud Workstations sandbox | Section 2 (~17%) |
| 3. Rebuild the core as custom code | Replace/extend the low-code core with an ADK-based custom agent: model selection (LLM vs SLM, cost/security tradeoffs), RAG pipeline via RAG Engine/Vector Search 1.0/Agent Retrieval, session/memory via Agent Platform Memory Bank, multi-agent orchestration via A2A/MCP and Agent Registry | Section 3 (~33% — the project's largest phase, matching the exam's largest section) |
| 4. Evaluate | Build golden datasets and an evaluation pipeline with ADK evalset, Agent Platform Gen AI evaluation service, and a custom autorater; interpret results and iterate | Section 4 (~22%, evaluation half) |
| 5. Deploy & operate | Deploy to Agent Runtime (compare against Cloud Run/GKE), instrument with Google Cloud Observability, troubleshoot drift/latency/reasoning-loop failure modes | Section 4 (~22%, deployment half) |
| 6. Secure & govern | Add OAuth2-based tool auth, PAB policies via Agent Identity, Agent Gateway traffic monitoring, Model Armor guardrails, and a HITL approval gate for high-risk actions | Section 5 (~15%) |
| 7. Retrospective / best practices | What worked, what a real team would do differently, common pitfalls mapped back to exam traps (§7's currency-corrections table) | Cross-cutting review |

**Beginner framing requirement:** every phase must explain each new
concept from zero before using it (per CLAUDE.md §2/§3/§8 — no term is
assumed known), include the reasoning behind each design decision (not
just the decision), and flag every step that is best-effort/illustrative
rather than console-verified (per §7's last currency-correction row —
no live Google Skills/console access in this environment).

**Coverage-map update:** this capstone is an additional cross-cutting
artifact layered on top of the per-leaf coverage map in §4 — it does
not replace any leaf's dedicated Design/Decision-matrix/Tradeoffs
content, it demonstrates all of them working together end to end.

## 9. Checklist status log

**2026-08-28 — RUNBOOK created.** Plan for this folder was originally
drafted using only `cloud.google.com`'s public certification page
(format/pricing/dates — still HIGH confidence and unchanged) plus a
reconstructed-from-general-knowledge domain breakdown, since
`services.google.com` (guide PDF) and `drive.google.com` (a link the
user then tried) were both network-unreachable from this sandbox
(`EGRESS_BLOCKED` at the proxy for both). The user then uploaded the
guide PDF directly as a local file; it was read in full and used to
replace the entire domain-hierarchy section of both the plan and this
runbook with verbatim guide content before any content files were
generated — so no downstream file was ever written from the
reconstructed version. Nothing else has been generated yet at the time
of this entry.

**2026-08-28 — Wave 1 launched, then scope corrected mid-flight.** Wave
1 (background agents for `01-domains/`, `02-services/`, `03-comparisons/`)
was launched before the user clarified they are a **beginner**, not
intermediate, and asked for a required ground-zero capstone project.
CLAUDE.md §2/§3/§8 and this RUNBOOK (§8, new) were updated immediately
with the correction and the capstone project design, before Wave 2
(`05-labs/`, which now includes the capstone as file 7 of 7) was
launched — so Wave 2 onward reflects the beginner/capstone requirement
from the start. Wave 1's files were already in flight when the
correction landed; they get a beginner-friendliness spot-check during
the final verification sweep (§9 close-out, once all waves are in) and
a targeted remediation pass if needed, rather than being discarded and
restarted.
