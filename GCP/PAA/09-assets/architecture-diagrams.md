# Architecture Diagrams — Consolidated Index & Cross-Cutting Views

> **What this file is, and what it isn't.** The six full production
> architecture patterns — each with a complete arrow-by-arrow diagram,
> tradeoff discussion, and failure-mode table — already live in
> `04-architectures/`. This file does **not** re-draw those diagrams;
> it does two other things instead: (1) a **compact index** pointing
> to each one with a one-line callout, so you can find the right file
> fast, and (2) **three new diagrams** that don't exist anywhere else
> in this folder — views that only make sense once you've seen all
> six patterns and want to see how they relate to *each other*, not
> just how each one works internally.
>
> **Currency note.** **Agent Runtime** (never Agent Engine), **Agent
> Search** (never Vertex AI Search), **Gemini Enterprise** (never
> "Vertex AI Agent Builder"), **Antigravity** (never "Gemini Code
> Assist"), **ADK is open-source**, **PAB via Agent Identity**. See
> `../CLAUDE.md` §7.

---

## 1. Index — the six patterns in `04-architectures/`

Read in this order for a natural build-up (each pattern after the
first assumes the one(s) before it as a known building block):

| # | File | One-line callout | Primary task(s) |
|---|---|---|---|
| 1 | `pattern-low-code-cx-agent.md` | The fastest path to a working agent: Gemini Enterprise + CX Agent Studio/Agent Designer + Agent Search, no code — and where that fast path structurally runs out of road. | 1.1, 1.2 |
| 2 | `pattern-coding-agent-cicd-integration.md` | A coding agent (Antigravity / Claude Code on Google Cloud) as a pipeline stage, not a chat window — sandboxed in GKE, gated by rules and Agents CLI, not a person watching every run. | 2.1, 2.2 |
| 3 | `pattern-custom-multi-agent-adk.md` | The single-agent building block everything else in Section 3 composes from: ADK + RAG Engine/Vector Search 1.0/Agent Retrieval + managed sessions/Memory Bank. | 3.1, 3.2 |
| 4 | `pattern-multi-agent-a2a-mcp-orchestration.md` | When one agent isn't enough: Agent Registry discovery, A2A between agents, MCP from agent to tool, composed as parallel/sequential/graph. | 3.3 |
| 5 | `pattern-evaluation-deployment-pipeline.md` | The pipeline every other pattern here should pass through before *and continuously after* it ships — evalset → Gen AI eval service → canary → full rollout. | 4.1, 4.2 |
| 6 | `pattern-secure-governed-enterprise-agent-platform.md` | The layer that wraps every pattern above it — PAB, Agent Gateway, Model Armor, Sensitive Data Protection, HITL — none of them optional, none of them redundant with the others. | 5.1, 5.2 |

**Read `04-architectures/README.md`** for the full read-order
rationale and the note that patterns 5 and 6 are meant to wrap around
patterns 1–4, not stand alone.

---

## 2. NEW diagram — The Full Stack: how all 5 sections fit into one system

Every one of the six patterns above is a **slice** through one
production system. This diagram is the **whole system**, at once —
what an architect is actually holding in their head when they say
"design an agentic platform," with every layer labeled by which exam
section owns it. No single request necessarily touches every layer
(a low-code-only deployment skips the ADK/orchestration layers
entirely) — this shows the **superset**, the full shape a mature
enterprise deployment grows into over time, matching the order the
Meridian capstone (`05-labs/lab-07-capstone-realtime-agentic-project.md`)
actually builds it in.

```
 ┌──────────────────────────────────────────────────────────────────────┐
 │  SECTION 1 — LOW-CODE ENTRY LAYER (~13%)                                 │
 │  Gemini Enterprise · Agent Designer / CX Agent Studio · Agent Search      │
 │  "the fast, business-owned front door"                                    │
 └───────────────────────────────┬────────────────────────────────────────┘
                                 │ hits a wall: needs custom orchestration,
                                 │ bespoke retrieval tuning, or non-Gemini models
                                 ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │  SECTION 2 — COD1NG-AGENT TOOLING (~17%)                                 │
 │  Antigravity / Claude Code on Google Cloud · MCP servers · custom          │
 │  skills · GKE/Cloud Workstations sandboxes · Agents CLI (fleet governance) │
 │  "builds and maintains the custom layer below — and is itself governed"    │
 └───────────────────────────────┬────────────────────────────────────────┘
                                 │ produces / maintains the code for
                                 ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │  SECTION 3 — CUSTOM AGENT CORE (~33% — the largest section)              │
 │                                                                          │
 │   ┌───────────────────────┐        ┌──────────────────────────────┐   │
 │   │  3.1/3.2 SINGLE AGENT      │        │  3.3 ORCHESTRATION                 │   │
 │   │  ADK · model selection       │◄──────►│  Agent Registry · Agent Runtime      │   │
 │   │  (LLM/SLM, SaaS/self-host)     │  A2A   │  A2A · MCP · parallel/sequential/      │   │
 │   │  managed sessions · Memory       │        │  graph orchestration                  │   │
 │   │  Bank · RAG Engine · Vector         │        │                                        │   │
 │   │  Search 1.0 · Agent Retrieval        │        │                                        │   │
 │   │  Agents CLI-governed skills           │        │                                        │   │
 │   └───────────────────────┘        └──────────────────────────────┘   │
 │        every agent here also makes MCP tool calls out to:                 │
 │        Google Cloud MCP Servers → BigQuery / Cloud SQL / Cloud Storage /    │
 │        Firestore / Memorystore for Redis (the data layer, §4 below)          │
 └───────────────────────────────┬────────────────────────────────────────┘
                                 │ every version, before AND after shipping
                                 ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │  SECTION 4 — EVALUATE & DEPLOY (~22%)                                    │
 │  ADK evalset · Gen AI evaluation service · custom autoraters               │
 │        → RELEASE GATE →                                                    │
 │  canary → partial → full rollout, on Agent Runtime / Cloud Run / GKE        │
 │  Google Cloud Observability (Cloud Logging + Cloud Trace) — every stage      │
 │        → production findings feed back into the evalset, continuously       │
 │  "the common downstream stage for every agent Sections 1–3 produce"          │
 └───────────────────────────────┬────────────────────────────────────────┘
                                 │ wraps AROUND every layer above, not
                                 │ bolted on at the end
                                 ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │  SECTION 5 — SECURE & GOVERN (~15%) — wraps every layer above              │
 │  Auth Manager (OAuth 2.0) → Agent Gateway (the checkpoint every call     │
 │  routes through) → [Agent Identity/PAB · Skill Registry · Model Armor ·    │
 │  Sensitive Data Protection, checked together] → risk-rule split →          │
 │  low-risk: proceeds  |  high-risk: HITL gate  →  every step logged           │
 │  "makes every layer above SAFE to run in production — not one more         │
 │   service, a discipline applied consistently across all of them"            │
 └──────────────────────────────────────────────────────────────────────┘

        ▲ DATA LAYER (cross-cutting, underneath 1, 3, and 4) ▲
        BigQuery · Cloud SQL · Cloud Storage · Firestore ·
        Memorystore for Redis — RAG sources, session/state storage,
        tool-integration targets. In scope here ONLY as the data layer
        under agentic workflows, never as general "pick a database"
        architecture (that's GCPPCA's topic, not this exam's).
```

**How to read this.** The vertical stack is the *build order* a
maturing platform typically follows (top → bottom, matching the
Meridian capstone's own phase order); Section 5 is drawn last but its
own box says explicitly it isn't "last" architecturally — it's a
wrapper around every layer above, which is why every one of the six
individual pattern files in `04-architectures/` treats security as a
cross-cutting concern rather than a phase.

---

## 3. NEW diagram — The 28 in-scope tools, grouped by role

The exam guide's 28-item tool list (`00-START-HERE/RUNBOOK.md` §6) is
easy to memorize as a flat list and hard to actually reason about that
way. Grouped by the role each tool plays, the same 28 items form 7
clusters that map directly onto the diagram above.

```
┌─────────────────────────────┐   ┌─────────────────────────────┐
│  A. LOW-CODE PLATFORM (4)       │   │  B. CODING-AGENT TOOLING (2)     │
│  Gemini Enterprise                │   │  Antigravity (CLI/SDK/App)         │
│  Gemini LLMs                       │   │  Agents CLI in Agent Platform         │
│  Model Garden                       │   │  (also governs Section 3 skills)       │
│  Agent Search                        │   └─────────────────────────────┘
└─────────────────────────────┘                    │
              │                                      │ builds/maintains
              │ front door for                        ▼
              ▼                          ┌─────────────────────────────┐
┌─────────────────────────────┐   │  C. CUSTOM AGENT CORE (3)           │
│  D. ORCHESTRATION & PROTOCOLS (4) │◄─┤  Agent Development Kit (ADK)          │
│  Agentic protocols (A2A, MCP)      │  │  RAG Engine                            │
│  Model Context Protocol (MCP)        │  │  Agent Retrieval and Vector             │
│    servers                            │  │    Search 1.0                            │
│  Agent Registry                        │  └─────────────────────────────┘
│  Agent Runtime                          │
└─────────────────────────────┘
              │
              │ deployed/observed via
              ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│  E. EVALUATE & DEPLOY (4)         │   │  F. SECURITY & GOVERNANCE (6)     │
│  Agent evaluation                   │   │  Agent Gateway                       │
│  Google Cloud Observability            │   │  Agent Identity (PAB)                 │
│  Cloud Run                              │   │  Auth Manager (OAuth 2.0)               │
│  Google Kubernetes Engine (GKE)          │   │  Model Armor                             │
└─────────────────────────────┘   │  Sensitive Data Protection                 │
                                     │  Skill Registry                              │
                                     └─────────────────────────────┘

              ┌───────────────────────────────────────────────┐
              │  G. DATA LAYER — cross-cutting (5)                  │
              │  BigQuery · Cloud SQL · Cloud Storage ·               │
              │  Firestore · Memorystore for Redis                     │
              │  (RAG sources, session/state storage, tool           │
              │   targets — underneath A, C, and E, never a           │
              │   standalone "pick a database" topic here)             │
              └───────────────────────────────────────────────┘

  4 + 2 + 3 + 4 + 4 + 6 + 5 = 28.  (Not 23 — an earlier miscount in
  this repo has been corrected everywhere; this is the verbatim,
  current count per RUNBOOK.md §6.)
```

**Cross-cutting note on GKE.** GKE appears once in this grouping
(cluster E, deployment target) but plays **two distinct roles** across
the exam depending on task: a coding-agent **sandbox** (task 2.1, dev
time) in `pattern-coding-agent-cicd-integration.md`, and a production
**deployment target** (task 4.2) in
`pattern-evaluation-deployment-pipeline.md`. Same tool, two different
jobs at two different lifecycle stages — a recurring exam trap named
in both pattern files.

---

## 4. NEW diagram — One request through the whole Meridian platform

The two diagrams above are abstract. This one is concrete: a single
employee question traced end-to-end through the **fully-built**
Meridian Tools "Internal Knowledge & Support Agent Platform"
(`05-labs/lab-07-capstone-realtime-agentic-project.md`), after all
seven phases are in place — showing which of the 28 tools actually
fires, in order, for one real interaction. Use this as the "does it
all actually click together" check after studying the six individual
patterns separately.

```
 Employee asks: "Which runbook covers a failed deployment, and can you
 also tell me my vacation-day accrual after 2 years?"
                                     │
                                     ▼
                    ┌──────────────────────────┐
                    │  AUTH MANAGER (OAuth 2.0)     │  ← authenticates the caller
                    └────────────┬─────────────┘     before anything else runs
                                 ▼
                    ┌──────────────────────────┐
                    │       AGENT GATEWAY            │  ← every downstream call
                    └────────────┬─────────────┘     routes through this checkpoint
                                 ▼
                    ┌──────────────────────────┐
                    │   TRIAGE AGENT (ADK, SLM)      │  ← cheap model: this is a
                    │   PAB checked via Agent          │    classification task, not
                    │   Identity before it acts          │    deep reasoning
                    └──┬───────────────────┬───┘
        (a) IT/eng question   (b) HR/vacation question
                   │                       │
                   ▼ A2A handoff            ▼ A2A handoff
     ┌───────────────────────┐  ┌───────────────────────────┐
     │  KNOWLEDGE-ANSWER AGENT     │  │  KNOWLEDGE-ANSWER AGENT           │
     │  (ADK, LLM)                    │  │  (same agent, HR-scoped path)        │
     │  RAG: RAG Engine → Vector          │  │  RAG: same pipeline, but PAB              │
     │  Search 1.0 → Agent Retrieval        │  │  scope now excludes                        │
     │  → runbook content (Cloud             │  │  compensation-band content for              │
     │  Storage-sourced)                       │  │  this employee's role                        │
     └───────────┬───────────┘  └───────────┬───────────────┘
                 │ MCP tool call                  │ MCP tool call (if needed for
                 ▼ (if runbook references             live HR-system data, not just
      a live deployment status)                        static policy docs)
     ┌───────────────────┐              ┌───────────────────────┐
     │  Google Cloud MCP        │              │  Google Cloud MCP             │
     │  Server → deployment         │              │  Server → HR system (Cloud SQL   │
     │  system (BigQuery/               │              │  / Firestore-backed)                │
     │  Cloud SQL-backed)                 │              └───────────────────────┘
     └───────────────────┘
                 │                                       │
                 └──────────────┬────────────────────────┘
                                ▼
                    ┌──────────────────────────┐
                    │   MODEL ARMOR + SENSITIVE       │  ← both answers screened
                    │   DATA PROTECTION                  │    before assembly — content
                    └────────────┬─────────────┘     safety AND data-sensitivity
                                 ▼
                    ┌──────────────────────────┐
                    │  Response assembled;           │
                    │  MANAGED SESSIONS updated          │  ← this conversation's state
                    │  (no MEMORY BANK write —            │  ← nothing here was a
                    │   nothing stated is a durable          │    durable cross-session
                    │   long-term preference)                  │    fact this time
                    └────────────┬─────────────┘
                                 ▼
                    ┌──────────────────────────┐
                    │  GOOGLE CLOUD OBSERVABILITY     │  ← every hop logged/traced
                    │  (Cloud Logging + Cloud Trace)     │
                    └────────────┬─────────────┘
                                 ▼
                     Answer returned to the employee,
                    both parts sourced, HR part correctly
                       scoped to what their role allows
```

**What this diagram makes visible that the abstract ones don't.** No
**HITL gate** fires anywhere in this trace — correctly, per the
capstone's own Phase 0 requirement that this system is read/advisory
only (see `08-interview/agentic-architect-scenario-questions.md` Q19
for the reasoning behind *not* over-building a HITL gate here). And
**Skill Registry** and **Agent Registry** both run invisibly in the
background before this trace even starts (registering/vetting the
triage and knowledge-answer agents as legitimate, discoverable
capabilities) rather than appearing as a per-request hop — governance
and discovery infrastructure, not request-path infrastructure. Two
tools (Cloud Run, GKE) don't appear in this trace at all, because
Meridian's platform runs on **Agent Runtime** — a reminder that not
every one of the 28 tools fires on every request, or even in every
deployment; which subset applies is exactly what
`protocol-and-service-decision-flowcharts.md` §3 in this folder walks
through.
