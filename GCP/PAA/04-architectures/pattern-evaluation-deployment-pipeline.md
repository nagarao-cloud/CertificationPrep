# Pattern — Evaluation Through Staged Deployment Pipeline

> **Pattern summary:** A continuous pipeline that takes an agent (built
> with any pattern in this folder — low-code, custom ADK, or
> multi-agent) from an **ADK evalset** through the **Agent Platform Gen
> AI evaluation service**, gates release on the results, deploys to
> **Agent Runtime** in progressive stages (canary → partial → full
> rollout), and instruments every stage with **Google Cloud
> Observability**, feeding production findings back into the next
> round of evaluation.
>
> **Primary exam tasks:** 4.1 (Evaluating agents in development and in
> production), 4.2 (Deploying and scaling production workloads).
> Section 4 is ~22% of the exam. Component names match
> `02-services/05-evaluation-deployment.md` exactly — read that file
> first if any term below (evalset, golden dataset, custom autorater,
> drift, reasoning loop) is unfamiliar.
>
> **Currency reminder applied in this file:** **Agent Runtime**, never
> "Agent Engine."

---

## 1. What this pattern is, and when you reach for it

**Ground-zero framing first.** Building an agent (any pattern earlier
in this folder) answers "can this thing work at all." This pattern
answers two harder questions: "how do I *know* it works well enough to
ship," and "how do I roll it out without betting the whole user base
on day one." Both questions matter for *every* agent this
certification covers, regardless of which pattern built it — a
low-code CX agent, a custom ADK agent, or a multi-agent system all need
this same evaluation-and-deployment discipline before and after they
go live.

A **golden dataset** — introduced here from zero — is a curated set of
example inputs paired with known-correct expected outputs, used as a
reference to check whether the agent's actual behavior matches what it
should be. An **evalset** is a structured collection of such test
cases, defined in a way a testing tool can run automatically and score.
A **canary deployment** is a release strategy where a new version
first serves only a small slice of real traffic (or a small population
of users) so problems are caught while the blast radius is still
small, before the version is trusted with all traffic.

**Reach for this pattern:**
- Always, for any agent headed to production — this isn't an optional
  add-on pattern, it's the pipeline every other pattern in this folder
  should pass through before and continuously after it ships.

---

## 2. The building blocks, briefly (full detail lives in `02-services/05-evaluation-deployment.md`)

| Block | One-line role in this pattern |
|---|---|
| **ADK evalset** | Evaluation tooling built into ADK itself — code-coupled, versioned alongside the agent's own codebase. |
| **Agent Platform Gen AI evaluation service** | Managed, cross-agent evaluation — standardized criteria applied across many agents regardless of how each was built (ADK, Gemini Enterprise, or otherwise). |
| **Custom autoraters** | Purpose-built evaluators (often an LLM acting as judge) for criteria neither standard tool captures — brand voice, a domain-specific policy check. |
| **Agent Runtime** | The agent-native deployment target this pattern defaults to — full entry in `02-services/04-orchestration-protocols.md` §5. |
| **Cloud Run / GKE** | Alternative deployment targets, named for completeness in §6's tradeoff discussion. |
| **Google Cloud Observability (Cloud Logging + Cloud Trace)** | Production monitoring — what surfaces drift, latency, reasoning loops, and failures once the agent is live. |

---

## 3. Full production architecture

```
     ┌───────────────────────────────────────────────────────────────────┐
     │                     PRE-PRODUCTION EVALUATION (4.1)                    │
     │                                                                        │
     │  ┌────────────────┐   ┌───────────────────────────┐   ┌────────────┐ │
     │  │  Golden dataset    │   │  Test-set generation           │   │  Edge case  │ │
     │  │  (curated known-      │──►│  (prompts, scenarios,           │──►│  library     │ │
     │  │   correct examples)     │   │  tool-call success criteria)     │   └────────────┘ │
     │  └────────────────┘   └───────────────────────────┘                  │
     │            │ (1) feeds three evaluation approaches, run together        │
     │            ▼                                                          │
     │  ┌──────────────┐   ┌────────────────────────────┐   ┌─────────────┐│
     │  │  ADK evalset     │   │  Agent Platform Gen AI          │   │  Custom       ││
     │  │  (code-coupled,     │   │  evaluation service                │   │  autoraters    ││
     │  │  per-change          │   │  (org-wide standardized            │   │  (LLM-as-judge, ││
     │  │  regression)          │   │  criteria, cross-agent)              │   │  brand voice,   ││
     │  └──────┬───────┘   └───────────────┬────────────┘   │  policy checks) ││
     │         │                            │                    └──────┬──────┘│
     └─────────┼────────────────────────────┼───────────────────────────┼──────┘
               │ (2) all three feed a single release gate
               └────────────────────────────┬───────────────────────────┘
                                             ▼
                          ┌───────────────────────────────┐
                          │        RELEASE GATE                │
                          │   pass thresholds on: response         │
                          │   quality, retrieval quality,             │
                          │   tool-execution success criteria           │
                          └───────────────┬───────────────┘
                                          │ (3) pass → proceed to staged rollout
                                          ▼
     ┌───────────────────────────────────────────────────────────────────┐
     │                   STAGED DEPLOYMENT (4.2)                              │
     │                                                                        │
     │   ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
     │   │  Stage 1:         │    │  Stage 2:              │    │  Stage 3:              │  │
     │   │  Canary              │───►│  Partial rollout          │───►│  Full rollout             │  │
     │   │  (small % of          │(4a)│  (larger % of                │(4b)│  (100% of production      │  │
     │   │   production traffic)   │    │   traffic, or a               │    │   traffic)                   │  │
     │   └──────────────┘    │   specific user segment)          │    └──────────────────┘  │
     │           │                └──────────────────┘                          │
     │           │ deployed on:  AGENT RUNTIME (default)  /  Cloud Run  /  GKE      │
     │           │                (choice per §6's decision note)                    │
     └───────────┼────────────────────────────────────────────────────────────┘
                 │ (5) every stage instrumented identically
                 ▼
     ┌───────────────────────────────────────────────────────────────────┐
     │              GOOGLE CLOUD OBSERVABILITY                                │
     │   ┌────────────────────┐          ┌────────────────────────┐         │
     │   │    Cloud Logging       │          │      Cloud Trace            │         │
     │   │  structured event/       │          │  per-hop latency,            │         │
     │   │  error history             │          │  request-path tracing         │         │
     │   └────────────────────┘          └────────────────────────┘         │
     │   surfaces: drift · tool-invocation latency · reasoning loops ·          │
     │             system failures · hallucinations · logic errors               │
     └───────────────────────┬─────────────────────────────────────────────┘
                             │ (6) automated rollback trigger if signals
                             │     breach thresholds at any stage
                             ▼
                 ┌─────────────────────────────────┐
                 │   Rollback to prior version,           │
                 │   OR proceed to next stage (4a/4b)        │
                 └─────────────────────────────────┘
                             │ (7) production findings, once stable,
                             ▼   become new golden-dataset entries
     ┌───────────────────────────────────────────────────────────────────┐
     │        Fed back into (1) — continuous evaluation pipeline               │
     └───────────────────────────────────────────────────────────────────┘
```

---

## 4. Arrow-by-arrow walkthrough

1. **A golden dataset, test-set generation, and an edge-case library
   feed the three evaluation approaches together.** Per task 4.1's
   "creating test sets for agent evaluation" language, this raw
   material — golden data, prompts, and edge cases — is what every
   evaluation approach downstream is scored against; building it well
   is as much of the work as running the evaluation tools themselves.
2. **All three evaluation approaches run and feed a single release
   gate.** Per `02-services/05-evaluation-deployment.md` §2's decision
   note, these are not mutually exclusive — a mature pipeline layers
   all three: **ADK evalset** for per-change regression testing (tight
   to the agent's own code, catching "did this specific change break
   something"), the **Agent Platform Gen AI evaluation service** for
   organization-wide standardized criteria (consistent quality bars
   across every agent the org runs, not just this one), and **custom
   autoraters** for the criteria neither generic tool captures (brand
   voice, a domain-specific policy judgment call). Critically, task
   4.1 also names evaluating **tool execution** specifically — not
   just "did the agent say the right thing" but "did it call the right
   tool, with the right arguments, and get a usable result," which
   matters most for the custom ADK and multi-agent patterns in this
   folder where tool/skill invocation is central.
3. **A release gate applies pass thresholds** across response quality,
   retrieval quality (explicitly named in task 4.1 — "assess agent
   response **and retrieval quality**," directly relevant to any
   pattern using RAG per `pattern-custom-multi-agent-adk.md`), and
   tool-execution success criteria. Only a version clearing these
   thresholds proceeds to deployment.
4. **Deployment happens in stages, not all at once.** **(4a)** A
   canary stage exposes the new version to a small slice of production
   traffic (or a limited user segment) first — this is where a defect
   evaluation missed (an edge case the golden dataset didn't cover,
   a production-traffic pattern that differs from test-set
   assumptions) gets caught while its blast radius is still small.
   **(4b)** Only once the canary stage clears its own monitoring
   thresholds does the rollout widen — to a larger traffic percentage,
   then eventually full production traffic. Each stage runs on one of
   the three deployment-runtime options named in task 4.2 (Agent
   Runtime, Cloud Run, or GKE — the choice is made once for the
   pattern being deployed, not per stage; see §6).
5. **Every stage is instrumented identically** through Google Cloud
   Observability — Cloud Logging capturing structured event/error
   history, Cloud Trace capturing per-hop latency and request-path
   tracing. This is deliberate: the whole point of a staged rollout is
   comparing the new version's live behavior against expectations at
   each stage, which requires the same monitoring at every stage, not
   just at full rollout.
6. **Observability findings can trigger an automated rollback** — if
   drift, elevated tool-invocation latency, reasoning-loop patterns
   (repeated near-identical trace spans — a strong Cloud Trace signal),
   system failures, or hallucination rates breach configured
   thresholds at any stage, the pipeline should roll back to the prior
   stable version rather than continuing to widen the rollout. A stage
   that clears its thresholds proceeds to the next stage (back to 4a/
   4b) instead.
7. **Once a rollout stabilizes at full production, its real-world
   findings feed back into the golden dataset.** A genuine production
   failure case — a real user input the agent handled badly — is
   exactly the kind of edge case worth adding to the test set driving
   the *next* round of evaluation (back to arrow 1), which is what
   makes this a **continuous** pipeline (task 4.1's explicit framing)
   rather than a one-time gate a version passes once and is never
   checked against again.

---

## 5. Why staged rollout matters even after evaluation passed

A beginner reading this pattern might reasonably ask: if the agent
already passed a thorough evaluation gate (arrows 1–3), why not just
deploy it to 100% of traffic directly? The answer is that evaluation,
however thorough, is always testing against a **curated approximation**
of real production traffic — a golden dataset and an edge-case library
are built from what the team anticipated, and real users reliably
produce inputs nobody anticipated. Staged rollout (arrow 4a/4b) is the
architectural acknowledgment that evaluation reduces risk but cannot
eliminate it, and that the cost of being wrong should scale with how
much traffic is exposed to the new version — a defect affecting 2% of
canary traffic for an hour is a very different incident than the same
defect affecting 100% of traffic from the moment of deployment.

---

## 6. Design decisions and tradeoffs

### 6.1 Agent Runtime vs. Cloud Run vs. GKE as the deployment target

Full comparison lives in `02-services/05-evaluation-deployment.md` §4's
decision note; restated for this pattern's context:

| Target | Choose when... |
|---|---|
| **Agent Runtime** | The workload is genuinely agentic (tool-calling, multi-turn reasoning, possibly multi-agent per `pattern-multi-agent-a2a-mcp-orchestration.md`) and you want the platform's agent-native management — tightest integration with Agent Registry/Agent Identity/multi-agent coordination. **This pattern's default** for any agent built with the custom ADK or multi-agent patterns in this folder. |
| **Cloud Run** | The deployment is closer to a stateless container serving requests, traffic is cost-sensitive and bursty (scale-to-zero matters), and the team wants minimal operational overhead — no cluster to run. |
| **GKE** | You need infrastructure-level control Cloud Run doesn't expose — custom networking, non-standard scaling policy, multi-container pod patterns, or the team already standardizes on GKE (including, per `pattern-coding-agent-cicd-integration.md`, using GKE as their coding-agent sandbox and wanting operational consistency between dev-time and production hosting). |

**Tradeoff, stated directly:** choosing Agent Runtime over Cloud Run/
GKE trades some infrastructure-level control for deep native
integration with the rest of the agent platform (identity propagation,
registry-based discovery, multi-agent coordination). A scenario
emphasizing custom networking or an existing Kubernetes standardization
points away from Agent Runtime toward GKE; one emphasizing minimal
ops and bursty traffic points toward Cloud Run; one emphasizing
multi-agent coordination and identity depth points toward Agent
Runtime.

### 6.2 Staged rollout vs. direct full-traffic deployment

**Chosen here:** canary → partial → full staging (§4, arrow 4a/4b).

**Alternative:** deploy directly to 100% of traffic once evaluation
passes, with no intermediate stage.

**Tradeoff.** Direct full-traffic deployment is simpler to operate
(one less pipeline stage, no need to reason about partial-traffic
routing) and gets a passing version to every user faster. Staged
rollout trades that speed for materially lower blast radius on
whatever evaluation missed (§5) — for a customer-facing or high-risk
agent, that tradeoff almost always favors staging; for a low-risk
internal tool with a small user base where the cost of a bad version
reaching everyone briefly is genuinely low, direct deployment can be a
reasonable simplification.

### 6.3 Evaluation as a one-time gate vs. a continuous pipeline

**Chosen here:** evaluation runs before every deployment *and*
continuously in production, with findings feeding back into the test
set (arrow 7).

**Alternative:** evaluate once before the initial launch, and rely on
ad hoc bug reports thereafter rather than a continuous pipeline.

**Tradeoff.** A one-time evaluation gate is cheaper to build and
operate, but per §5's core point, the world an agent operates in
doesn't hold still — model updates, prompt changes, shifting input
distributions, and newly discovered edge cases all mean a version that
passed evaluation six months ago is not guaranteed to still behave
correctly. This is precisely what task 4.2's **drift** failure mode
names: gradual divergence from intended/tested behavior. A continuous
pipeline catches this; a one-time gate structurally cannot, because it
never looks again after the first pass.

---

## 7. Common failure modes and how this design handles them

| Failure mode | What it looks like | How this architecture mitigates it |
|---|---|---|
| **Drift** | The agent's behavior gradually diverges from its tested behavior — often after a model update, a prompt change, or a shift in real input distribution. | Continuous evaluation (arrow 7's feedback loop) plus Observability's ongoing production monitoring (arrow 5) — drift is a *slow* failure mode, and this pattern's continuous, not one-time, evaluation discipline is specifically what's needed to catch it. |
| **Tool invocation latency** | A specific tool call is slow, dragging down the whole interaction. | Cloud Trace's per-hop timing (arrow 5) surfaces exactly which hop is slow; task 4.1's tool-execution evaluation criteria (arrow 2) should also be catching unacceptably slow tool calls before production, not just after. |
| **Agent reasoning loops** | The agent gets stuck repeating a reasoning/tool-call cycle without making progress. | Cloud Trace surfaces this as repeated near-identical trace spans (arrow 5); a canary-stage rollback trigger (arrow 6) should treat an elevated reasoning-loop rate as a hard stop, not something to tolerate while widening the rollout. |
| **System failures** | Outright errors — a tool call that fails, an unhandled exception in the agent's code. | Cloud Logging's structured error history (arrow 5) is the primary diagnostic surface; a canary stage (arrow 4a) exists specifically so a systemic failure mode affects a small fraction of traffic, not everyone, before it's caught. |
| **Hallucinations** | The agent states something false with apparent confidence. | Task 4.1's "assess agent response and retrieval quality" evaluation criteria (arrow 2–3) should be specifically testing for this pre-production; in production, this is harder to catch automatically and is exactly the kind of thing custom autoraters (an LLM-as-judge checking factual grounding) are well suited for, layered alongside the standard evaluation tools. |
| **Evaluation gate that's too permissive or too strict** | Either bad versions slip through the gate into canary, or good versions get blocked on overly conservative thresholds, slowing legitimate releases. | This is a tuning problem the continuous-feedback loop (arrow 7) is meant to correct over time — as production findings feed back into the golden dataset and test set, threshold calibration should improve; a static, never-revisited threshold set is itself a design gap. |
| **Rollback that doesn't actually roll back cleanly** | A rollback trigger fires (arrow 6), but the previous version's session/memory state or in-flight requests aren't handled gracefully, causing a worse outage than the original issue. | Not something this pattern's diagram alone solves — it's a reminder that rollback needs to be tested as part of the deployment pipeline itself (a rollback path that's never been exercised is not a reliable rollback path), and that patterns using managed sessions/Memory Bank (`pattern-custom-multi-agent-adk.md`) need those state layers to remain compatible across the version being rolled back to. |

---

## 8. Exam task mapping

| Task | How this pattern demonstrates it |
|---|---|
| **4.1** — Evaluating agents in development and in production | Test-set creation, the three evaluation approaches run together, tool-execution and retrieval-quality assessment, and the continuous-pipeline feedback loop (§4, arrows 1–3, 7). |
| **4.2** — Deploying and scaling production workloads | Deployment-target selection (§6.1), staged rollout (arrow 4a/4b), and Observability-driven troubleshooting of drift/latency/reasoning-loops/failures (arrow 5–6). |
| **3.1/3.2/3.3** (feeder patterns) | This pipeline evaluates and deploys agents built by any of `pattern-low-code-cx-agent.md`, `pattern-custom-multi-agent-adk.md`, or `pattern-multi-agent-a2a-mcp-orchestration.md` — it is the common downstream stage for all of them. |

---

## 9. Exam traps specific to this pattern

- Writing "Agent Engine" anywhere as the current name for the managed
  runtime — it's **Agent Runtime**.
- Treating ADK evalset, the Gen AI evaluation service, and custom
  autoraters as competing choices where only one is "correct" — mature
  pipelines layer all three (§4 arrow 2).
- Treating evaluation as a one-time pre-launch gate rather than a
  continuous pipeline — task 4.1 explicitly frames it as continuous,
  and drift (a named task-4.2 failure mode) is structurally
  undetectable by a one-time gate (§6.3).
- Assuming deploying straight to 100% of traffic is always fine once
  evaluation passes — evaluation reduces but never eliminates risk
  (§5); staged rollout is the architectural response to that residual
  risk, not a redundant precaution.
- Confusing GKE's role here (a production deployment target) with its
  role as a coding-agent sandbox in
  `pattern-coding-agent-cicd-integration.md` — same product, two
  distinct roles at two different lifecycle stages.
- Treating Cloud Logging and Cloud Trace as redundant — Logging
  answers "what happened," Trace answers "where did the time go / is
  this looping."
