# Mind Maps — Quick Visual Review

> **What this file is.** ASCII mind maps, not reference prose — this
> is a compressed, at-a-glance format for the week before the exam
> (per `../CLAUDE.md` §10, compression is the point here; go to
> `01-domains/` for the full explanations, `04-architectures/` for how
> the pieces assemble into real systems). One overall exam mind map,
> then one per section for when you need to zoom into a single
> section's shape without the noise of the other four.
>
> **Currency note.** **Agent Runtime** (never Agent Engine), **Agent
> Search** (never Vertex AI Search), **Gemini Enterprise** (never
> "Vertex AI Agent Builder"), **Antigravity** (never "Gemini Code
> Assist"), **ADK is open-source**. See `../CLAUDE.md` §7.

---

## 1. The whole exam, one map

```
                              PAA — PROFESSIONAL AGENTIC ARCHITECT
                                    (~80 Q, 3 hrs, + separate
                                     hands-on labs component)
                                              │
        ┌─────────────┬─────────────┬────────┴────────┬─────────────┐
        │             │             │                 │             │
  SECTION 1       SECTION 2     SECTION 3         SECTION 4      SECTION 5
  Low-code        Coding        Custom agents     Evaluate &     Secure &
  tools           agents        (BIGGEST — 33%)   deploy         govern
  (~13%)          (~17%)                          (~22%)         (~15%)
        │             │             │                 │             │
   Gemini        Antigravity /   ADK (open-       ADK evalset    Auth Manager
   Enterprise    Claude Code     source) ·         · Gen AI      (OAuth 2.0)
   Agent         on GCP ·        RAG Engine ·      eval service  · Agent
   Designer /    MCP servers ·   Vector Search      · custom      Identity
   CX Agent      GKE/Cloud       1.0 · Agent        autoraters    (PAB) ·
   Studio ·      Workstations    Retrieval ·                     Agent
   Agent          sandbox ·      managed sessions  Agent Runtime Gateway ·
   Search        Agents CLI      / Memory Bank ·   / Cloud Run   Model Armor
                                 A2A / MCP /        / GKE ·       · Sensitive
                                 Agent Registry /    Observability Data
                                 Agent Runtime                     Protection ·
                                                                    Skill
                                                                    Registry ·
                                                                    HITL

   ────────────────────── cross-cutting data layer ──────────────────────
      BigQuery · Cloud SQL · Cloud Storage · Firestore · Memorystore
      for Redis  —  RAG sources / session state / tool-integration
      targets, feeding Sections 1, 3, and 4 — never a standalone
      "pick a database" topic on this exam
```

**How to use this map.** If a question names a tool you don't
immediately know which section it belongs to, check this map's five
branches first — most exam traps live at the *boundary* between two
sections (GKE appearing in both Section 2 as a dev-time sandbox and
Section 4 as a production deployment target is the clearest example;
Agents CLI governing both the Section 2 coding-agent fleet and Section
3's custom-agent skills is another).

---

## 2. Section 1 — Building agents using low-code tools (~13%)

```
                    SECTION 1 — LOW-CODE TOOLS
                              │
              ┌───────────────┴───────────────┐
              │                                 │
        1.1 Configuring workflows        1.2 Connecting enterprise data
        & behavior                        to Gemini Enterprise
              │                                 │
      ┌───────┼───────┐                 ┌───────┼────────┐
      │       │       │                 │       │        │
  Gemini   Agent    CX Agent        Agent Search  secure    multimodal
  Enter-   Designer  Studio         (formerly     query      ingestion
  prise    (builder) (CX-           Vertex AI     access     (video,
  (plat-             specialized)   Search)       control    audio,
  form)                                           per        images)
      │                                           principal
   pages, transition routes,
   event handlers
      │
   system instructions +
   in-console prompt templates
   (few-shot, chain-of-thought)

   Full worked example: 04-architectures/pattern-low-code-cx-agent.md
   Fastest MVP path (see Meridian Phase 1) — but hits a wall at
   multi-agent orchestration or bespoke retrieval tuning → Section 3.
```

---

## 3. Section 2 — Using coding agents for application development (~17%)

```
                 SECTION 2 — CODING AGENTS
                          │
        ┌─────────────────┴─────────────────┐
        │                                     │
  2.1 Using coding agents effectively   2.2 Customizing for enterprise
        │                                     │
  ┌─────┼──────┐                    ┌─────────┼──────────┐
  │     │      │                    │         │          │
Antigravity  Claude Code  MCP servers,  skills, plugins, extension
(CLI/SDK/    on Google    custom        hooks, rules, subagents
App)         Cloud        skills,       (Antigravity-specific
                          tool access   customization depth)
  │
secure sandboxes:
GKE (ephemeral, CI/CD-shaped) or
Cloud Workstations (persistent, human-in-the-loop)
  │
refactor · optimize runtime · patch app-layer vulnerabilities
  │
Agents CLI — build/scale/govern/optimize the DEPLOYED FLEET
(agent-vs-human mode, per repo/change-category)

   Full worked example: 04-architectures/pattern-coding-agent-cicd-integration.md
   Exam trap: GKE here = dev-time sandbox, NOT the Section 4
   production deployment target — same tool, different job.
```

---

## 4. Section 3 — Developing custom agents (~33%, the heaviest by far)

```
                         SECTION 3 — CUSTOM AGENTS
                                    │
        ┌───────────────────┬───────┴────────┬──────────────────────┐
        │                   │                 │                      │
  3.1 Design/build     3.2 Integrate      3.3 Orchestrate &
  in code               enterprise         coordinate
        │               knowledge                │
  ┌─────┼──────┐             │            ┌───────┼────────┐
  │     │      │      ┌──────┼──────┐     │       │        │
model  ADK    sessions │      │      │   A2A     MCP    Agent
select (open- & memory │  Agent    Google │  (agent   (agent  Registry
:LLM vs source)  ─────  │  Identity  Cloud  │ ↔ agent) → tool)  (discovery)
SLM,          managed   │  (PAB      MCP    │
SaaS vs       sessions  │  permis-   Servers │        Agent Runtime
self-         (this      │  sions)   (pre-    │        (hosting)
hosted,       convo)     │           built,   │
OSS vs        + Memory   │           custom    │      parallel /
proprietary   Bank       │           inte-     │      sequential /
              (cross-    │           gration    │      graph shapes
              convo)     │           layers)     │      (by dependency
                          │                        │      structure)
                    RAG pipeline:                Agent policies
                    RAG Engine →                 (bound handoff
                    Vector Search 1.0 →           depth, prevent
                    Agent Retrieval                loops)
                    (chunk → embed →
                    similarity → rerank)
        │
  Agents CLI-configured skills (plugins,
  agent-vs-human mode per skill/interaction)

   Full worked examples:
   04-architectures/pattern-custom-multi-agent-adk.md (3.1/3.2, single agent)
   04-architectures/pattern-multi-agent-a2a-mcp-orchestration.md (3.3, multi-agent)
   Nearly a third of the whole exam — give this section proportionally
   more study time than an even 5-way split would suggest.
```

---

## 5. Section 4 — Evaluating and deploying agentic workflows (~22%)

```
              SECTION 4 — EVALUATE & DEPLOY
                          │
        ┌─────────────────┴─────────────────┐
        │                                     │
  4.1 Evaluate (dev + prod)             4.2 Deploy & scale production
        │                                     │
  ┌─────┼──────────┐              ┌───────────┼────────────┐
  │     │          │              │           │            │
golden  test-set   3 frameworks,  deployment  troubleshoot  monitor &
data,   generation  layered, not   target      failure       optimize
prompts, (prompts,   competing:    choice:     modes:         (perf,
edge     scenarios)  · ADK evalset Agent       drift ·        reliability,
cases              · Gen AI eval    Runtime /   tool-inv.      cost —
                     service        Cloud Run /  latency ·      hallucin-
                   · custom          GKE         reasoning       ations,
                     autoraters      (based on   loops ·         logic
                                    use case,    system          errors)
  assesses:                        requirements, failures
  response quality +                & cost)
  RETRIEVAL quality +
  tool-execution success        Google Cloud Observability
                                (Cloud Logging + Cloud Trace)
        │                              │
        └──────── continuous, not one-time — production
                   findings feed BACK into golden dataset ────────┘

   Full worked example: 04-architectures/pattern-evaluation-deployment-pipeline.md
   The common downstream stage for every agent Sections 1–3 produce.
```

---

## 6. Section 5 — Securing and governing agentic workflows (~15%)

```
                 SECTION 5 — SECURE & GOVERN
                          │
        ┌─────────────────┴─────────────────┐
        │                                     │
  5.1 Security & governance config     5.2 Secure behavior & execution
        │                                     │
  ┌─────┼─────────┐                  ┌────────┼────────┐
  │     │         │                  │        │         │
Auth   Agent    Agent Gateway    Agent      Model     secure data
Manager Identity (monitor        Gateway +   Armor +    access &
(OAuth  (PAB      traffic,       Model       HITL       identity
2.0)    policy)   track agents)  Armor       (safety     propagation
                                              frameworks   (Agent
                     +                       & guard-     Gateway +
Agent Registry &                             rails)       Agent
Model Armor                                              Registry)
(governance & policy
enforcement)

  Memory hook — WHO / WHAT / SAFE:
  PAB (Agent Identity) = WHO's allowed
  → Agent Gateway = WHAT's flowing, + identity propagation
  → Model Armor = is it SAFE (content)
  → Sensitive Data Protection = is SENSITIVE DATA exposed (separate
    from content safety)
  → HITL = human checkpoint for high-risk actions, regardless of
    whether everything above already passed cleanly

   Full worked example:
   04-architectures/pattern-secure-governed-enterprise-agent-platform.md
   Wraps around every other section's pattern — not one more service,
   a discipline applied consistently across all of them.
```
