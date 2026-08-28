# EXAM-TRAPS-AND-MNEMONICS — compressed, high-density

> Compressed by design (CLAUDE.md §10) — dense and scannable, not
> padded. Full reasoning for every row here lives in
> `RUNBOOK.md` §7 (currency corrections), `CLAUDE.md` §7, and the
> `03-comparisons/` files' own "exam traps" sections — this file is the
> fast pre-exam pass, not a re-teach.

---

## 1. The two highest-value corrections in this entire folder

Both are **verbatim, parenthetical renames stated by the guide itself**
(RUNBOOK.md §6) — not inferred, not general-knowledge guesses. Any
outdated study material, blog post, or your own prior AI-model knowledge
will have the *old* name in it. This is the single most likely trap on
the exam because it's the easiest to get wrong from muscle memory.

| # | Never say | Always say | Memory hook |
|---|---|---|---|
| 1 | Agent Engine | **Agent Runtime** | "Runtime **runs** it — Engine is retired." |
| 2 | Vertex AI Search | **Agent Search** | "Search now works **for the Agent**, not just Vertex AI." |

If you remember nothing else from this folder walking into the exam,
remember these two.

---

## 2. Rest of the currency-corrections table (RUNBOOK.md §7)

| Never say | Say instead | Why (one line) |
|---|---|---|
| "Vertex AI Agent Builder is the low-code platform" | **Gemini Enterprise** (built with **Agent Designer** + **CX Agent Studio**) | "Vertex AI Agent Builder" appears nowhere in the guide — a general web search will surface it anyway; discard it here. |
| "Gemini Code Assist is the coding-agent tool tested" | **Antigravity** (CLI/SDK/App) and **Claude Code on Google Cloud** | Gemini Code Assist is not named in the guide at all. |
| "PAB is a generic IAM concept" | PAB = **principal access boundary**, configured via **Agent Identity** specifically | Named exactly that way in task 5.1 — agent-specific, not a synonym for a role/policy. |
| "ADK is closed-source / Google-internal" | ADK is explicitly **open-source** | Direct quote, task 3.1. |
| "PAA overlaps with GCPPCA's cloud-architecture content" | PAA is a dedicated agentic-AI exam; the 28-tool in-scope list has no generic compute/storage/networking-selection content | Confirmed against the full in-scope list — treat this folder as if GCPPCA didn't exist. |
| "Weights are unpublished / estimated" | Weights are **explicitly published**: 13/17/33/22/15%, verbatim per section | Stated in each section header of the guide itself. |
| "`05-labs/` walkthroughs are console-verified" | Lab content is **best-effort** — no live Google Skills/console access in this environment | Cross-check against the real console before the actual hands-on exam. |

---

## 3. Section-weight mnemonic — 13 / 17 / 33 / 22 / 15

**Shape first, numbers second.** The five weights rise, peak hard at
Section 3, then fall — draw it as a mountain, not a flat list:

```
        33
       /  \
     17    22
    /        \
  13          15
  S1  S2   S3   S4   S5
```
`13 < 17 < 33 > 22 > 15` — **ascend, peak, descend.** If you remember
the shape, you can reconstruct the order even if a specific number slips.

**Sentence mnemonic** (first letters = section order, word length/theme
= relative size): **"Little Coding Dominates Everything Securely."**

| Word | Section | Weight |
|---|---|---|
| **L**ittle | 1. Low-code tools | 13% (smallest) |
| **C**oding | 2. Coding agents | 17% |
| **D**ominates | 3. Developing custom agents | **33% (biggest, nearly ⅓)** |
| **E**verything | 4. Evaluating & deploying | 22% |
| **S**ecurely | 5. Securing & governing | 15% |

Sanity check every time: they must sum to 100. `13+17+33+22+15 = 100`. ✓

---

## 4. Tool-grouping mnemonic — 7 service files, 28 tools

**Sentence mnemonic** (first letters = `02-services/` file order):
**"Gemini Chefs Add Orchestration, Evaluate, Secure, Deliver."**

| Word | File | Tools it owns |
|---|---|---|
| **G**emini | `01-gemini-enterprise-low-code.md` | Gemini Enterprise, Agent Search, Gemini LLMs, Model Garden |
| **C**hefs | `02-coding-agents-devtools.md` | Antigravity, Agents CLI, GKE *(sandbox facet)* |
| **A**dd | `03-adk-custom-development.md` | ADK, RAG Engine, Agent Retrieval/Vector Search 1.0 |
| **O**rchestration | `04-orchestration-protocols.md` | Agent Registry, Agent Runtime, A2A, MCP servers |
| **E**valuate | `05-evaluation-deployment.md` | Agent evaluation, Cloud Run, GKE *(deploy facet)*, Observability |
| **S**ecure | `06-security-governance.md` | Agent Gateway, Agent Identity, Model Armor, Auth Manager, Sensitive Data Protection, Skill Registry |
| **D**eliver | `07-data-services.md` | BigQuery, Cloud SQL, Cloud Storage, Firestore, Memorystore |

**GKE is the one tool that appears twice on purpose** — Chef's sandbox
(dev-time, task 2.1) vs. Deliver's deployment target (production, task
4.2). Same tool, different task — see §5 below.

---

## 5. Original high-density gotchas (compressed from `03-comparisons/`)

- **GKE dual-context trap.** "Coding agent" + "sandbox" together →
  task 2.1 (dev-time). "Deployment runtime" + "use case/cost" → task
  4.2 (production). Don't let the word "sandbox" alone decide it.
- **A2A vs. MCP direction trap.** Callee reasons for itself (a peer) →
  A2A. Callee is a fixed tool/API/DB/SaaS → MCP. "Third-party SaaS
  tool" and "remote server" are the guide's *own words* for MCP.
- **Sequential vs. graph trap.** A scenario that reads step-by-step
  ("if X, retry; if still X, escalate") is **not** automatically
  sequential — conditional branching/looping makes it a graph workflow,
  even when phrased as steps.
- **Skill Registry vs. Agent Registry trap.** Skill Registry governs
  vetted *skills* (capability-level, approval-focused). Agent Registry
  governs discoverable *agents* (orchestration/capability catalog,
  broader). Don't collapse them.
- **PAB vs. Agent Gateway vs. Model Armor trap.** All three sit in
  task 5.1/5.2 together but answer different questions: PAB = is this
  principal allowed at all (once, at the boundary). Agent Gateway =
  what's flowing right now + identity propagation across hops. Model
  Armor = is the content safe. A gap in one is not covered by the
  others — defense in depth, not redundancy.
- **Sensitive Data Protection ≠ Model Armor trap.** A leaked SSN in a
  response is a data-*sensitivity* problem (Sensitive Data Protection).
  A prompt-injection/jailbreak attempt is a content-*pattern* problem
  (Model Armor). Same section, different failure mode.
- **Auth Manager (authentication) vs. PAB (authorization) trap.**
  OAuth 2.0 gets you a valid, authenticated caller. PAB decides what
  that authenticated caller may actually do. A question about "getting
  a token" is Auth Manager; a question about "what this agent can
  touch" is PAB — don't merge them into one "security" bucket.
- **ADK evalset vs. continuous pipeline trap.** ADK evalset = dev-time,
  close to the codebase, golden-dataset response/retrieval quality.
  Agent Platform Gen AI evaluation service = production-facing,
  continuous. "...using ADK" in a question stem points at evalset
  specifically — that's the guide's own example phrasing.
- **Agent Runtime cost-assumption trap.** "Managed" ≠ "cheapest by
  default." Task 4.2 explicitly frames runtime choice as "based on the
  use case, requirements, **and cost**" — a scenario-dependent variable,
  not a fixed ranking across Agent Runtime / Cloud Run / GKE.
- **Low-code governance trap.** Building in Agent Designer/CX Agent
  Studio does not mean "no governance applies" — Gemini Enterprise
  agents still sit inside the same Agent Identity/PAB/Agent Gateway
  surface as custom ADK agents. Low-code changes *how you build
  behavior*, not *whether security policy applies*.
- **Model-selection ≠ prompt-authoring trap.** Task 1.1 (Agent
  Designer) covers system instructions and prompt templates —
  **not** model choice. LLM vs. SLM, self-hosted vs. SaaS, OSS vs.
  proprietary is explicitly task 3.1 (custom development) territory.

---

## 6. If you only remember five things

1. **Agent Runtime**, not Agent Engine. **Agent Search**, not Vertex AI Search.
2. Weights are **published**, sum to 100, peak hard at Section 3 (33%).
3. **A2A = agent-to-agent. MCP = agent-to-tool/data.** Never interchange them.
4. **PAB (who) → Agent Gateway (what's flowing) → Model Armor (is it safe).** Three layers, not one.
5. GKE means two different things depending on whether the task is 2.1 (sandbox) or 4.2 (deployment target).
