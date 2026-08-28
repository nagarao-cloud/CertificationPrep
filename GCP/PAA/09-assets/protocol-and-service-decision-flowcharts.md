# Protocol & Service Decision Flowcharts

> **What this file is, and how it differs from `DECISION-TREES.md`.**
> `00-START-HERE/DECISION-TREES.md` already compresses six of these
> same decisions into tree diagrams for fast exam-day recall. This
> file covers the same recurring decisions plus one new one, but in
> **flowchart form**: an explicit `START`, numbered decision nodes
> (`D1`, `D2`, ...) with labeled `YES`/`NO` branches, and explicit
> `END` states — the format an architect actually walks a stakeholder
> through out loud ("first I ask X, if yes I ask Y, if no I land on
> Z"), rather than a tree shape read top-down in one glance. Use
> `DECISION-TREES.md` for the fastest possible recall the week before
> the exam; use this file when you want to practice **walking the
> reasoning out loud**, decision by decision — which is closer to how
> a scenario question actually has to be answered.
>
> Full tradeoff writeups and worked examples for every decision below
> live in `03-comparisons/`; full systems using the winning choice live
> in `04-architectures/`.
>
> **Currency note.** **Agent Runtime** (never Agent Engine), **Agent
> Search** (never Vertex AI Search), **Gemini Enterprise** (never
> "Vertex AI Agent Builder"), **Antigravity** (never "Gemini Code
> Assist"), **ADK is open-source**, **PAB via Agent Identity**. See
> `../CLAUDE.md` §7.

---

## 1. Low-code vs. custom ADK — where do I build this agent?

*Full version: `03-comparisons/01-low-code-vs-custom-development.md`,
worked example: `04-architectures/pattern-low-code-cx-agent.md` §6.3*

```
START: A new agent needs to be built.
   │
   ▼
[D1] Is the team building it mostly non-engineers (business
     analysts, CX specialists), and does the timeline favor a
     fast first version over deep customizability?
   │
   ├─YES─▶ [D2] Does the workflow need multi-agent orchestration,
   │            non-Gemini models, or retrieval tuning the console
   │            doesn't expose?
   │              │
   │              ├─YES─▶ (END: HYBRID — low-code front end,
   │              │              ADK backend agent behind it)
   │              │
   │              └─NO──▶ (END: BUILD LOW-CODE — Gemini
   │                             Enterprise + Agent Designer /
   │                             CX Agent Studio + Agent Search)
   │
   └─NO──▶ [D3] Does the workflow need arbitrary code execution,
                custom multi-agent orchestration, or non-Gemini
                model choice (SLM / OSS / self-hosted)?
                  │
                  ├─YES─▶ (END: BUILD WITH ADK — Section 3 custom
                  │              development)
                  │
                  └─NO──▶ (END: RECONSIDER — no stated need for
                                 either engineering control or
                                 low-code speed; default to whichever
                                 the team already operates, and
                                 revisit if a real need emerges)
```

**Trap to watch for:** any mention of "parallel agents," "sequential
agents," or "graph workflow" by *name* in a scenario is an automatic
D2/D3 YES — that's Section 3 vocabulary, never a low-code capability.

---

## 2. Orchestration shape — parallel, sequential, or graph?

*Full version: `03-comparisons/02-orchestration-pattern-options.md`,
worked example: `04-architectures/pattern-multi-agent-a2a-mcp-
orchestration.md` §5*

```
START: A task decomposes into multiple sub-tasks, handled by
       multiple agents.
   │
   ▼
[D1] Does any sub-task's execution depend on another sub-task's
     OUTPUT (i.e., can't start until a prior step finishes)?
   │
   ├─NO──▶ (END: PARALLEL — dispatch concurrently, merge results
   │              once all complete)
   │
   └─YES─▶ [D2] Is there conditional branching (route differently
                based on a runtime result) OR a retry/refine loop
                anywhere in the flow?
                  │
                  ├─NO──▶ (END: SEQUENTIAL — fixed pipeline,
                  │              step N waits on step N-1's output)
                  │
                  └─YES─▶ (END: GRAPH — the general case; a graph's
                                 individual nodes can themselves be
                                 parallel or sequential sub-pipelines)
```

**Trap to watch for:** "it reads step-by-step" is not the same as
"sequential" — a bounded retry loop (see
`08-interview/agentic-architect-scenario-questions.md` Q10) reads
step-by-step in prose but is graph-shaped in actual dependency
structure. Read for the dependency graph, not the narrative order.

---

## 3. A2A vs. MCP vs. direct/custom integration

*Full version: `03-comparisons/03-a2a-vs-mcp-vs-direct-integration.md`*

```
START: An agent needs to reach something outside itself.
   │
   ▼
[D1] Does the thing being called have its own reasoning /
     judgment — could it itself decide to ask a follow-up
     question, delegate further, or refuse?
   │
   ├─YES─▶ (END: USE A2A — this is a peer agent, not a tool;
   │              identity propagates with the handoff)
   │
   └─NO──▶ [D2] Is it a fixed-capability tool, API, database, or
                SaaS product — something an agent needs to CALL,
                not converse with?
                  │
                  ├─NO──▶ (END: RECONSIDER — if it's neither a
                  │              reasoning peer nor a callable
                  │              capability, clarify what's
                  │              actually being connected to)
                  │
                  └─YES─▶ [D3] Does an MCP server already exist
                               for it (a Google Cloud MCP Server,
                               or a vendor-provided one), or is
                               building one worth it because this
                               tool will be reused across agents?
                                 │
                                 ├─YES─▶ (END: USE MCP)
                                 │
                                 └─NO──▶ (END: DIRECT/CUSTOM
                                                INTEGRATION for now —
                                                explicitly legitimate
                                                per task 3.2, not a
                                                fallback; wrap in MCP
                                                later if reuse emerges)
```

**Trap to watch for:** wrapping a genuine sub-agent as "just another
MCP tool" to avoid reasoning about two protocols (see
`08-interview/behavioral-and-tradeoff-questions.md` — this exact
shortcut loses A2A's identity-propagation and recursive-delegation
semantics the moment the "tool" needs its own judgment).

---

## 4. Deployment target — Agent Runtime, Cloud Run, or GKE?

*Full version: `03-comparisons/04-agent-hosting-deployment-options.md`*

```
START: A built and evaluated agent needs a production home.
   │
   ▼
[D1] Does this need infrastructure-level control the other two
     targets don't expose — custom networking, non-standard
     scaling policy, multi-container pod patterns, or existing
     team standardization on Kubernetes?
   │
   ├─YES─▶ (END: USE GKE — full infra control, highest ops burden)
   │
   └─NO──▶ [D2] Is this genuinely agentic — multi-turn reasoning,
                tool-calling, possibly multi-agent coordination —
                and does it benefit from native integration with
                Agent Registry / Agent Identity / multi-agent
                coordination?
                  │
                  ├─YES─▶ (END: USE AGENT RUNTIME — managed,
                  │              agent-native; formerly "Agent
                  │              Engine," never call it that)
                  │
                  └─NO──▶ [D3] Is traffic cost-sensitive and
                               bursty, and does the team want
                               minimal ops (no cluster to run)?
                                 │
                                 ├─YES─▶ (END: USE CLOUD RUN —
                                                serverless,
                                                scale-to-zero)
                                 │
                                 └─NO──▶ (END: RE-EVALUATE — likely
                                                Agent Runtime or GKE;
                                                a workload that's
                                                neither clearly
                                                agent-native nor
                                                clearly a simple
                                                stateless container
                                                needs the scenario's
                                                specifics re-read)
```

**Trap to watch for:** GKE shows up in a *second*, unrelated place in
this exam — task 2.1 names it as a **dev-time coding-agent sandbox**,
not a production target. This flowchart is about the Section 4.2
production-deployment question only.

---

## 5. Evaluation approach — evalset, Gen AI eval service, or custom autorater?

*Full version: `03-comparisons/05-evaluation-approaches.md`*

```
START: An agent needs its response and/or retrieval quality assessed.
   │
   ▼
[D1] Is this a per-change regression check, run close to the
     agent's own codebase, tied to "did this specific commit
     break something" — the guide's own named example of
     "using ADK"?
   │
   ├─YES─▶ (END: USE ADK EVALSET)
   │
   └─NO──▶ [D2] Do standardized, organization-wide quality
                criteria (consistent bar across every agent the
                org runs, not just this one) cover what's being
                checked?
                  │
                  ├─YES─▶ [D3] Does this need to run continuously
                  │            in production, not just before a
                  │            release?
                  │              │
                  │              ├─YES─▶ (END: USE AGENT PLATFORM
                  │              │              GEN AI EVALUATION
                  │              │              SERVICE)
                  │              └─NO──▶ (END: GEN AI EVALUATION
                  │                             SERVICE still fits —
                  │                             it's not exclusively
                  │                             a continuous-only
                  │                             tool, continuity is
                  │                             just its strongest
                  │                             signal)
                  │
                  └─NO──▶ (END: BUILD A CUSTOM AUTORATER — for
                                 criteria neither generic tool
                                 captures: brand voice, a
                                 domain-specific policy judgment)
```

**Note this isn't "pick one."** A mature pipeline layers all three
together (`04-architectures/pattern-evaluation-deployment-pipeline.md`
§4) — this flowchart answers "which one does THIS specific check need"
for each check you're adding, not "which one tool do I choose overall."

---

## 6. Security/governance — which control applies to this concern?

*Full version: `03-comparisons/06-security-governance-models.md`*

```
START: A concern about an agent's safety, access, or behavior comes up.
   │
   ▼
[D1] Is this about WHO/WHAT is proven to be making the call at
     all — cryptographic proof of caller identity?
   │
   ├─YES─▶ (END: AUTH MANAGER / OAuth 2.0 — authentication)
   │
   └─NO──▶ [D2] Is this about what an authenticated principal is
                actually BOUNDED to be allowed to do?
                  │
                  ├─YES─▶ (END: PAB via AGENT IDENTITY —
                  │              authorization)
                  │
                  └─NO──▶ [D3] Is this about monitoring/tracking
                               live traffic, or propagating
                               identity across a multi-hop call
                               chain?
                                 │
                                 ├─YES─▶ (END: AGENT GATEWAY)
                                 │
                                 └─NO──▶ [D4] Is this about the
                                              SAFETY of content —
                                              prompt injection,
                                              jailbreaks, harmful
                                              output patterns?
                                                │
                                                ├─YES─▶ (END: MODEL
                                                │              ARMOR)
                                                │
                                                └─NO──▶ [D5] Is this
                                                             about
                                                             SENSITIVE
                                                             DATA
                                                             (PII,
                                                             secrets)
                                                             appearing
                                                             where it
                                                             shouldn't?
                                                               │
                                                               ├─YES─▶
                                                               (END:
                                                               SENSITIVE
                                                               DATA
                                                               PROTECTION)
                                                               │
                                                               └─NO──▶
                                                               [D6] Is
                                                               this
                                                               about
                                                               an
                                                               ACTION
                                                               risky
                                                               enough
                                                               to
                                                               need
                                                               a human
                                                               checkpoint
                                                               regardless
                                                               of how
                                                               clean
                                                               every
                                                               other
                                                               check
                                                               came
                                                               back?
                                                                 │
                                                                 ├─YES─▶
                                                                 (END:
                                                                 HITL
                                                                 GATE)
                                                                 └─NO─▶
                                                                 (END:
                                                                 RECONSIDER
                                                                 —
                                                                 may be
                                                                 a
                                                                 SKILL
                                                                 REGISTRY
                                                                 vetting
                                                                 concern
                                                                 instead:
                                                                 "is
                                                                 this
                                                                 capability
                                                                 approved
                                                                 to
                                                                 exist
                                                                 at
                                                                 all")
```

**Trap to watch for:** these are **not alternatives** — a mature
deployment runs D1 through D6 as parallel, simultaneous checks on
every call (`04-architectures/pattern-secure-governed-enterprise-
agent-platform.md` §3), not a single path picked once. This flowchart
answers "which control is the RIGHT one to reach for, for a SPECIFIC
stated concern" — a real production system applies several of these
end states together, every request.

---

## 7. Which of the 28 in-scope tools applies to this scenario? (master lookup)

*New for this file — not a compression of an existing
`03-comparisons/` file; a first stop when a scenario names a need but
not a specific tool. Full 28-item list: `00-START-HERE/RUNBOOK.md` §6;
grouped view: `09-assets/architecture-diagrams.md` §3.*

```
START: A scenario describes a NEED, not a named tool. What applies?
   │
   ▼
[D1] Is the need about building/configuring the agent's
     conversational behavior itself?
   │
   ├─YES─▶ [D1a] No-code, business-owned? → GEMINI ENTERPRISE +
   │              AGENT DESIGNER / CX AGENT STUDIO
   │       [D1b] Code, full control? → AGENT DEVELOPMENT KIT (ADK)
   │       [D1c] Which model runs the reasoning? → GEMINI LLMs,
   │              selected via MODEL GARDEN
   │
   └─NO──▶ [D2] Is the need about grounding the agent on
                enterprise data / documents / knowledge?
                  │
                  ├─YES─▶ [D2a] No-code connector? → AGENT SEARCH
                  │       [D2b] Full pipeline control? → RAG ENGINE
                  │              → AGENT RETRIEVAL AND VECTOR
                  │              SEARCH 1.0
                  │       [D2c] Where does the source content
                  │              actually live? → BIGQUERY /
                  │              CLOUD SQL / CLOUD STORAGE /
                  │              FIRESTORE (data layer, not a
                  │              general "pick a database" topic)
                  │
                  └─NO──▶ [D3] Is the need about writing/maintaining
                               the agent's OWN CODE (not its
                               conversational behavior at runtime)?
                                 │
                                 ├─YES─▶ ANTIGRAVITY (CLI/SDK/App) —
                                          MCP SERVERS for its tool
                                          access — GKE / CLOUD
                                          WORKSTATIONS as sandbox —
                                          AGENTS CLI to govern the
                                          fleet of runs
                                 │
                                 └─NO──▶ [D4] Is the need about
                                              multiple agents
                                              coordinating?
                                                │
                                                ├─YES─▶ (END: AGENTIC
                                                │        PROTOCOLS —
                                                │        A2A for
                                                │        agent↔agent,
                                                │        MCP for
                                                │        agent↔tool —
                                                │        AGENT
                                                │        REGISTRY to
                                                │        discover
                                                │        them, AGENT
                                                │        RUNTIME to
                                                │        host them)
                                                │
                                                └─NO──▶ continue to
                                                         D5 below
   │
   ▼
[D5] Is the need about STATE the agent must remember?
   │
   ├─YES─▶ (END: within one conversation → MANAGED SESSIONS
   │              (Agent Platform); across separate conversations →
   │              MEMORY BANK; fast ephemeral state underneath
   │              either → MEMORYSTORE FOR REDIS)
   │
   └─NO──▶ [D6] Is the need about PROVING the agent works, before
                or after shipping?
                  │
                  ├─YES─▶ (END: AGENT EVALUATION — ADK evalset /
                  │              Gen AI eval service / custom
                  │              autoraters, see §5 above)
                  │
                  └─NO──▶ [D7] Is the need about WHERE the agent
                               runs in production, or watching it
                               once live?
                                 │
                                 ├─YES─▶ (END: AGENT RUNTIME /
                                                CLOUD RUN / GKE
                                                (§4 above) + GOOGLE
                                                CLOUD OBSERVABILITY)
                                 │
                                 └─NO──▶ (END: almost certainly a
                                                SECURITY / GOVERNANCE
                                                need — go to §6 above:
                                                AUTH MANAGER / AGENT
                                                IDENTITY / AGENT
                                                GATEWAY / MODEL ARMOR
                                                / SENSITIVE DATA
                                                PROTECTION / SKILL
                                                REGISTRY / HITL)
```

**How this covers all 28.** Every one of the 28 named tools
(`00-START-HERE/RUNBOOK.md` §6) has exactly one home in the walk
above: D1 (Gemini Enterprise, Agent Designer/CX Agent Studio implied,
ADK, Gemini LLMs, Model Garden), D2 (Agent Search, RAG Engine, Agent
Retrieval and Vector Search 1.0, BigQuery, Cloud SQL, Cloud Storage,
Firestore), D3 (Antigravity, MCP servers, GKE, Agents CLI), D4
(Agentic protocols, Agent Registry, Agent Runtime), D5 (Memorystore for
Redis — managed sessions/Memory Bank are Agent Platform features
layered on top of the data services, not separate items in the
28-count), D6 (Agent evaluation), D7 (Cloud Run, Google Cloud
Observability), and the security fallthrough (Auth Manager, Agent
Identity, Agent Gateway, Model Armor, Sensitive Data Protection, Skill
Registry). If a scenario's need doesn't obviously fit any branch, the
guide publishes no explicit "out of scope" list — treat it as
presumptively out of scope for this exam (`00-START-HERE/RUNBOOK.md`
§6's out-of-scope note), most often a sign the scenario is describing
generic GCP infrastructure selection that belongs to GCPPCA, not PAA.
