# DECISION-TREES — at-a-glance version of `03-comparisons/`

> **This file is compressed by design** (CLAUDE.md §10) — it is the
> fast, exam-day-recall version of the full reasoning. Every tree here
> is a compression of a matching file in `03-comparisons/`; go there for
> the full head-to-head tables, tradeoff writeups, and worked examples.
> Do not treat this file as a substitute for reading those once — treat
> it as what you glance at the week before the exam.

---

## 1. Low-code (Agent Designer / CX Agent Studio) vs. custom (ADK)

*Full version: `03-comparisons/01-low-code-vs-custom-development.md`*

```
              Need to build an agent — where?
                          |
          Conversational / state-based flow
          (pages, transitions, FAQ-style)?
                          |
              +-----------+-----------+
             YES                      NO
              |                        |
    Need multi-agent          Needs custom orchestration
    orchestration, non-       (parallel/seq/graph), custom
    Gemini models, or         tool code, or non-Gemini
    bespoke RAG tuning?       models (SLM/OSS/self-hosted)?
              |                        |
        +-----+-----+                YES
       NO           YES                |
        |             |                v
        v             v          BUILD WITH ADK
   AGENT DESIGNER /  HYBRID:            (Section 3)
   CX AGENT STUDIO   low-code front end,
   (Section 1)       ADK backend agent
```

**At a glance:**
- Console + prompts only, no orchestration logic → low-code.
- Any mention of "parallel agents / sequential agents / graph workflow" by name → that's Section 3, never low-code.
- Model choice (SLM, OSS, self-hosted) is *always* a Section 3 signal — low-code binds you to what Gemini Enterprise exposes.

---

## 2. Orchestration pattern: parallel vs. sequential vs. graph

*Full version: `03-comparisons/02-orchestration-pattern-options.md`*

```
     Does each agent depend on the PRECEDING agent's output?
                          |
            +--------------+--------------+
           YES                            NO
            |                              |
  Conditional branching/looping    Sub-tasks independent
  based on runtime state?          of each other?
            |                              |
      +-----+-----+                  +-----+-----+
     NO           YES                YES         NO
      |             |                 |            |
      v             v                 v            v
 SEQUENTIAL     GRAPH            PARALLEL     re-examine —
 AGENTS         WORKFLOW         AGENTS       mixed dependency
                                               = graph, not
                                               sequential
```

**At a glance:**
- "Run these 3 things at once and merge" → parallel.
- "If confidence is low, retry; if still low, escalate to a human" → graph (conditional edges + HITL branch), **not** sequential — even though it reads step-by-step.
- A graph's nodes can *contain* sequential or parallel sub-pipelines — these compose, they aren't mutually exclusive.

---

## 3. A2A vs. MCP vs. direct/custom integration

*Full version: `03-comparisons/03-a2a-vs-mcp-vs-direct-integration.md`*

```
        Is the CALLEE an autonomous agent (reasoning of
        its own), not just a fixed tool/function?
                          |
            +--------------+--------------+
           YES                            NO
            |                              |
            v                    Is it a tool/API/DB/SaaS
        USE A2A                  an agent needs to call?
     (agent-to-agent)                      |
                              +--------------+--------------+
                             YES                            NO
                              |                              |
                    Does an MCP server exist        DIRECT/CUSTOM
                    or is one worth building?        INTEGRATION
                              |
                        +-----+-----+
                       YES         NO
                        |            |
                        v            v
                   USE MCP     direct/custom for now;
                                wrap in MCP later if reused
```

**Memory hook: A2A = Ally-to-Ally (peer agent). MCP = "My Connected
Plumbing" (agent → tool/data/SaaS).**

**At a glance:**
- "Third-party SaaS tool" or "remote server" in the question → MCP.
- "Multi-agent handoff" or "orchestrator delegates to a specialist agent" → A2A.
- Custom integration layers for managed databases are an explicitly legitimate *named* option (task 3.2) — not every integration needs a protocol.

---

## 4. Deployment target: Agent Runtime vs. Cloud Run vs. GKE

*Full version: `03-comparisons/04-agent-hosting-deployment-options.md`*

```
    Needs custom infra control — GPU scheduling, custom
    networking, multi-tenant cluster isolation?
                          |
            +--------------+--------------+
           YES                            NO
            |                              |
            v                    Want agent-native lifecycle
         USE GKE                 (sessions/memory/coordination
    (full control,               hooks) with minimal ops?
     highest ops)                          |
                              +--------------+--------------+
                             YES                            NO
                              |                              |
                              v                    Variable/spiky traffic,
                     USE AGENT RUNTIME              plain container is fine?
                     (managed, agent-native)                  |
                                                    +-----------+-----------+
                                                   YES                     NO
                                                    |                       |
                                                    v                       v
                                              USE CLOUD RUN         re-evaluate: likely
                                              (serverless,          Agent Runtime or GKE
                                              scale-to-zero)
```

**At a glance:**
- **Agent Runtime, formerly Agent Engine** — never lead with the old name.
- GKE appears in a *second*, unrelated context too: task 2.1 names it as a **dev-time coding-agent sandbox**, not a production target. Same tool, different task — check which one the question means.
- "Based on the use case, requirements, **and cost**" is the guide's own framing — cost is scenario-dependent, not a fixed ranking.

---

## 5. Evaluation approach: ADK evalset vs. Gen AI evaluation service vs. custom autoraters

*Full version: `03-comparisons/05-evaluation-approaches.md`*

```
     Iterating on agent CODE, need golden-dataset response/
     retrieval quality checks close to the codebase?
                          |
            +--------------+--------------+
           YES                            NO
            |                              |
            v                    Do built-in metrics (evalset
    USE ADK EVALSET                or platform service) cover
    (dev-time, task              your success criteria?
     4.1's own example)                    |
                              +--------------+--------------+
                             YES                            NO
                              |                              |
                    Need this running               BUILD A CUSTOM
                    continuously in prod?             AUTORATER
                              |
                        +-----+-----+
                       YES         NO
                        |
                        v
              USE AGENT PLATFORM GEN AI
              EVALUATION SERVICE (continuous,
              production-facing pipeline)
```

**At a glance:**
- "...using ADK" in the question stem → evalset, literally the guide's own example phrase.
- "Established success criteria" for **tool execution**, especially anything domain-specific → leans custom autorater.
- Golden data / prompts / edge cases (task 4.1's first bullet) is the shared **input layer** feeding all three — not a fourth competing framework.

---

## 6. Which security/governance layer applies?

*Full version: `03-comparisons/06-security-governance-models.md`*

```
      Request reaches an agent — which control applies?
                          |
      Is this "WHO/WHAT is allowed to act at all" —
      an access-boundary decision?
                          |
            +--------------+--------------+
           YES                            NO
            |                              |
            v                    Monitoring/tracking live traffic,
     PAB via AGENT IDENTITY      or propagating identity across
     (task 5.1)                  a multi-hop call?
                                            |
                              +--------------+--------------+
                             YES                            NO
                              |                              |
                              v                    Safety of model input/
                       AGENT GATEWAY                output CONTENT?
                       (task 5.1, 5.2)                        |
                                                  +--------------+--------------+
                                                 YES                            NO
                                                  |                              |
                                                  v                              v
                                            MODEL ARMOR              consider HITL
                                            (task 5.1, 5.2)          (task 5.2) or
                                                                     re-scope
```

**Memory hook — Who / What / Safe:**
`PAB (Agent Identity)` = **Who's** allowed → `Agent Gateway` = **What's**
flowing (+ identity propagation) → `Model Armor` = **Is it Safe**
(content) → `HITL` = human checkpoint for high-risk/low-confidence
actions regardless of the above three.

**At a glance:**
- "Monitor traffic / track agents" → Agent Gateway, verbatim task 5.1 wording.
- "Identity propagation across hops" → Agent Gateway (task 5.2's exact pairing with Agent Registry), **not** PAB — PAB sets the boundary once, propagation is a traffic-layer job.
- A leak of PII/secrets in a response → **Sensitive Data Protection**, not Model Armor (content-pattern safety) and not PAB (access boundary) — three different guardrail kinds, used together, not substitutes.
- OAuth 2.0 (Auth Manager) = **authentication** (is this a valid caller). PAB = **authorization** (what that authenticated caller may do). Keep these two separate — the exam does.
