# Section 4 Cheatsheet — Evaluating and deploying agentic workflows (~22%)

> Compressed by design (CLAUDE.md §10) — pure recall sheet. Decision tree
> for evaluation-approach and deployment-target choice:
> `00-START-HERE/DECISION-TREES.md` §4–5. Full teaching content:
> `01-domains/SECTION-4-evaluate-deploy.md`, `02-services/05-evaluation-deployment.md`.

Tasks: **4.1** evaluate in dev and prod · **4.2** deploy and scale production workloads.

---

## Tool glossary (one line each)

| Tool | One-line definition |
|---|---|
| **ADK evaluation tooling (evalset)** | Dev-time evaluation built into ADK — golden-dataset response/retrieval quality checks close to the codebase. Guide's own example phrase: "evaluating ... using ADK." |
| **Agent Platform Gen AI evaluation service** | Production-facing, continuous evaluation pipeline — the platform-level counterpart to evalset. |
| **Custom autoraters** | Purpose-built evaluators for success criteria the built-in tools don't cover (e.g., domain-specific tool-execution correctness). |
| **Agent Runtime** | Managed deployment/runtime target, named first in 4.2's deployment options. **Formerly Agent Engine — never say the old name.** |
| **Cloud Run** | Serverless container deployment target — named alongside Agent Runtime and GKE for 4.2. |
| **GKE (deployment context)** | Here, task 4.2 names GKE as a **production deployment target** — NOT the Section 2.1 dev-time-sandbox meaning. |
| **Google Cloud Observability** | Cloud Logging + Cloud Trace — the monitoring backbone for troubleshooting deployed agents. |

---

## 4.1 — Evaluating agents in development and in production

- **Test-set creation** — three named ingredients: **golden data, prompts, edge cases.**
- **Continuous evaluation pipelines** — assess an agent's **tool execution** against **established success criteria** (not just final-answer quality — the *steps* the agent took matter).
- **Evaluation framework/tooling choice** — three named options:
  1. **ADK evaluation tooling (evalset)** — dev-time, codebase-adjacent.
  2. **Agent Platform Gen AI evaluation service** — continuous, production-facing.
  3. **Custom autoraters** — built for success criteria the other two don't cover.
- **Golden-dataset evaluation** — assessing **response quality** AND **retrieval quality** together, explicitly called out as done "using ADK."

**Exam-stem cue:** "...using ADK" → evalset. "Continuous" / "in production" → Gen AI evaluation service. "Established success criteria" that sound domain-specific/custom → custom autorater.

---

## 4.2 — Deploying and scaling production workloads

**Deployment target selection** — three named options, chosen on **use case, requirements, and cost** (guide's own framing — no fixed ranking):

| Target | Best fit signal |
|---|---|
| **Agent Runtime** | Agent-native lifecycle (sessions/memory/coordination hooks), managed, minimal ops. |
| **Cloud Run** | Serverless, scale-to-zero, variable/spiky traffic, plain container is enough. |
| **GKE** | Custom infra control — GPU scheduling, custom networking, multi-tenant cluster isolation. |

**Troubleshooting signals (four named failure modes — memorize verbatim, these are exam-stem trigger words):**

| Symptom word in the stem | Failure mode | What it means |
|---|---|---|
| "drift" | **Drift** | Agent's behavior/quality degrades over time relative to its original baseline (data, model, or environment shifted underneath it). |
| "invocation latency" | **Tool invocation latency** | Delay specifically in the agent calling/waiting on a tool, not model inference itself. |
| "reasoning loops" | **Agent reasoning loops** | Agent gets stuck re-planning/re-calling without converging on an answer or action. |
| "system failures" | **System failures** | Infra/runtime-level failure, not a reasoning or data-quality problem. |

**Monitoring/optimization targets (three named dimensions):**
- **Performance, reliability, cost** — the three axes to optimize for.
- Specific things to identify: **logic errors, latency bottlenecks, hallucinations.**

---

## Quick facts

- Section weight: **~22%**, second-largest after Section 3.
- GKE appears in **two different exam contexts** — production deployment target here (4.2) vs. dev-time coding-agent sandbox in Section 2.1. Same word, different task.
- "Tool execution" evaluation (4.1) previews Section 3.3's orchestration concepts — evaluation isn't just "did the model say the right words," it includes whether the right tools were called correctly.
- Cost is explicitly named as a deployment-decision factor in 4.2 — don't assume Agent Runtime is automatically cheapest; it's "based on use case, requirements, and cost," scenario-dependent.

## 5-second recall

**4.1: golden data/prompts/edge cases → evalset (dev, ADK) / Gen AI evaluation service (prod, continuous) / custom autoraters (bespoke criteria), judging both response AND retrieval quality plus tool execution. 4.2: pick Agent Runtime / Cloud Run / GKE by use case+requirements+cost; watch for drift, tool-invocation latency, reasoning loops, system failures; optimize performance/reliability/cost via Observability.**
