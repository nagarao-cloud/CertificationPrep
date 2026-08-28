# 02-services — Evaluation & Deployment

> **Covers (exam-guide §6 in-scope items):** Agent evaluation · Cloud
> Run · Google Kubernetes Engine (GKE) — **this facet only: GKE as a
> deployment target**. GKE-as-coding-agent-sandbox is covered in
> `02-coding-agents-devtools.md`; this file cross-references it rather
> than repeating it. · Google Cloud Observability (Cloud Logging and
> Cloud Trace).
> **Also covers** (named in task bullets, not separately listed in
> §6): ADK evaluation tooling (evalset), Agent Platform Gen AI
> evaluation service, custom autoraters.
>
> **Agent Runtime's full reference entry is in
> `04-orchestration-protocols.md` §5**; this file covers it only as one
> of task 4.2's three deployment-target options, alongside Cloud Run and
> GKE, without duplicating its orchestration-role writeup.
>
> **Primary exam tasks supported:** 4.1 (Evaluating agents in
> development and in production), 4.2 (Deploying and scaling production
> workloads). Section 4 is ~22% of the exam.

---

## 1. Why this file exists

Section 4 covers the two things that happen **after** an agent is built
(Section 3) and **before**/**during** it serving real traffic: proving
it's good enough to ship (evaluation), and actually running it at scale
(deployment). Neither is a one-time gate — the exam frames both as
continuous: evaluation pipelines that run repeatedly, and deployed
agents that get monitored and optimized on an ongoing basis.

```
Evaluation (4.1)                          Deployment (4.2)
 ├─ ADK evalset                            ├─ Agent Runtime (full entry: file 04)
 ├─ Agent Platform Gen AI eval service       ├─ Cloud Run
 └─ custom autoraters                        └─ GKE (deployment-target facet)
        │                                            │
        └──────────► feeds into ◄────────────────────┘
                Google Cloud Observability
              (Cloud Logging + Cloud Trace)
           — monitors the deployed agent, whose
             findings feed back into re-evaluation
```

---

## 2. Agent evaluation — ADK evalset, Agent Platform Gen AI evaluation service, custom autoraters

**What it is.** Task 4.1 names three specific evaluation approaches,
each answering a different "how do I know this agent is good enough"
question, plus the general practice of building test sets and
continuous pipelines around them.

**Problem it solves.** An agent that looks correct in a handful of
manual test conversations can still fail broadly in production —
against edge cases, against distribution shift in real user inputs, or
after a prompt/model change silently regresses behavior that used to
work. Systematic evaluation — golden datasets, repeatable test sets,
automated scoring — is what catches that before (and continues to catch
it after) an agent ships, rather than relying on ad hoc spot-checks.

**How it's configured — verbatim task 4.1 considerations:**
- **Creating test sets for agent evaluation**: golden data (a curated,
  known-correct reference dataset), prompts, and edge cases — the raw
  material every evaluation approach below is scored against.
- **Creating continuous evaluation pipelines** to assess an agent's
  **tool execution** based on established success criteria — not just
  "did the agent say the right thing" but "did it call the right tool,
  with the right arguments, and get a usable result."
- **Determining the appropriate evaluation framework and tooling**:
  - **ADK evaluation tooling (evalset)**: evaluation built into the ADK
    framework itself — you define an evalset (a structured collection
    of test cases with expected outcomes) and run it against your ADK
    agent's actual behavior, well-suited when the agent is already an
    ADK-built agent and you want evaluation tightly coupled to its code.
  - **Agent Platform Gen AI evaluation service**: a managed evaluation
    service at the Agent Platform level — less tied to any one agent's
    codebase, useful for standardized, organization-wide evaluation
    criteria applied across multiple agents regardless of how each was
    built.
  - **Custom autoraters**: a custom-built evaluator (typically another
    LLM acting as a judge, or a rule-based scorer) for evaluation
    criteria that don't fit a standard rubric — e.g., grading response
    tone against a brand voice, or scoring a domain-specific correctness
    criterion no off-the-shelf evaluator captures.
- **Evaluating an agentic system against a golden dataset to assess
  agent response and retrieval quality** — explicitly "using ADK,"
  meaning this evaluation covers not just the final response but the
  quality of what was *retrieved* along the way (tying directly back to
  the RAG pipeline in `03-adk-custom-development.md` §5–§7 — a
  response can be wrong because retrieval surfaced the wrong content,
  not because the model reasoned badly over correct content, and good
  evaluation needs to distinguish the two).

**Task cross-reference.** 4.1, directly and fully — this is task 4.1's
entire subject matter.

**Decision note — ADK evalset vs. Gen AI evaluation service vs. custom
autoraters.** Choose **ADK evalset** when the agent under test is ADK-
built and you want evaluation defined alongside the agent's own code,
versioned with it. Choose the **Agent Platform Gen AI evaluation
service** when you need standardized evaluation applied consistently
across many agents (including non-ADK, e.g. Gemini Enterprise-built
agents) — organization-wide quality bars rather than per-agent test
suites. Choose **custom autoraters** when neither built-in option
captures your actual success criteria — brand-voice grading, a
domain-specific policy check, or any judgment call that needs a
purpose-built rubric (often implemented as an LLM-as-judge with a
tailored grading prompt). These are not mutually exclusive: a mature
evaluation pipeline commonly layers all three — ADK evalset for
per-change regression testing, the Gen AI evaluation service for
cross-agent org standards, and custom autoraters for the specific
criteria neither generic tool covers.

---

## 3. Cloud Run

**What it is.** A fully-managed serverless container-execution platform
— one of the three named deployment-target options in task 4.2:
"Selecting optimal deployment runtime based on the use case,
requirements, and cost (e.g., Agent Runtime, Cloud Run, and GKE)."

**Problem it solves.** Not every deployed agent needs (or wants) the
orchestration-aware, agent-specific management that Agent Runtime
provides (see `04-orchestration-protocols.md` §5) — sometimes an agent
is packaged as a straightforward container that needs to scale on
request volume (including to zero when idle) with minimal operational
overhead and no cluster to manage. Cloud Run is that option: deploy a
container, get automatic scaling and a managed HTTPS endpoint, pay only
for actual usage.

**How it's used.** An agent (ADK-built or otherwise) is packaged as a
container image and deployed to Cloud Run as a request-driven service;
Cloud Run handles scaling, revision management, and traffic routing.

**Task cross-reference.** 4.2, directly — named as a deployment-runtime
option.

---

## 4. GKE as a deployment target

**What it is (this facet).** Google Kubernetes Engine, used here as a
**production deployment target for a finished, serving agent** —
distinct from its role as a coding-agent *sandbox* covered in
`02-coding-agents-devtools.md` §6. Same product, different lifecycle
stage: sandboxing development-time agent actions vs. hosting a
deployed agent's production traffic.

**Problem it solves.** Some agent deployments need more control than
Cloud Run's fully-managed, stateless-request model gives you — custom
networking topology, fine-grained resource/scheduling control,
long-running or stateful agent processes, multi-container pod
composition (e.g., an agent container alongside a sidecar handling
custom telemetry or a local cache), or workload-specific autoscaling
policy beyond request-count scaling. GKE trades Cloud Run's operational
simplicity for that control.

**How it's used.** The agent (and any supporting containers) is
packaged and deployed as Kubernetes workloads on a GKE cluster, with
the team managing cluster configuration, scaling policy, and networking
directly.

**Task cross-reference.** 4.2, directly — named as a deployment-runtime
option, alongside Agent Runtime and Cloud Run.

**Decision note — Agent Runtime vs. Cloud Run vs. GKE as deployment
targets.**
- **Agent Runtime**: the most agent-native option — purpose-built for
  hosting agents specifically (full role/entry in
  `04-orchestration-protocols.md` §5), with the tightest integration
  into Agent Registry/Agent Identity/multi-agent coordination. Best
  default when the workload is genuinely agentic (tool-calling,
  multi-turn reasoning, possibly multi-agent) and you want the
  platform's agent-specific management rather than reassembling it
  from general-purpose compute.
- **Cloud Run**: best when the deployment is closer to "a stateless
  container serving requests," cost-sensitive with bursty/idle traffic
  (scale-to-zero matters), and the team wants minimal operational
  overhead — no cluster to run.
- **GKE**: best when you need infrastructure-level control Cloud Run
  doesn't expose — custom networking, non-standard scaling policy,
  multi-container pod patterns, or an existing Kubernetes platform the
  organization already standardizes on. Also the right answer when the
  same team is already using GKE as their coding-agent sandbox (file
  02, §6) and wants operational consistency between dev-time sandboxing
  and production hosting.
A scenario emphasizing "needs deep integration with our multi-agent
orchestration and identity model" points to Agent Runtime; one
emphasizing "cost-sensitive, bursty, minimal ops" points to Cloud Run;
one emphasizing "we need custom cluster/networking control" points to
GKE.

---

## 5. Google Cloud Observability (Cloud Logging and Cloud Trace)

**What it is.** Google Cloud's monitoring/observability suite, scoped
in this exam to its two named components: **Cloud Logging** (structured
log collection and search) and **Cloud Trace** (distributed request
tracing — following a single request's path through multiple services/
calls, with latency broken down per hop).

**Problem it solves.** A deployed agent's failure modes are often not
visible from its final output alone — task 4.2 names them explicitly:
**drift** (the agent's behavior gradually diverging from its intended/
tested behavior, often due to model updates, prompt changes, or
changing input distributions), **tool invocation latency** (a specific
tool call being slow, dragging down the whole interaction), **agent
reasoning loops** (the agent getting stuck repeating a reasoning/tool-
call cycle without making progress), and **system failures** (outright
errors). None of these are diagnosable from a single bad response in
isolation — they need logged history and traced request paths.

**How it's configured — verbatim task 4.2 considerations:**
- **Troubleshooting agent issues**: drift, tool invocation latency,
  agent reasoning loops, and system failures — Cloud Trace's per-hop
  timing is what surfaces tool-invocation latency and reasoning-loop
  patterns (repeated near-identical trace spans); Cloud Logging is
  where the actual error detail and structured event history live.
- **Monitoring and optimizing agents for performance, reliability, and
  cost** — "identify logic errors, latency bottlenecks, and
  hallucinations." Logging captures the evidence (what the agent
  reasoned, what tools it called, what it returned); Trace shows where
  time actually went across the whole request.

**Task cross-reference.** 4.2, directly and fully.

**Decision note — Cloud Logging vs. Cloud Trace.** Not a choice between
them — they answer different diagnostic questions and are typically
used together. Reach for **Cloud Logging** when the question is "what
happened, and what did the agent actually say/decide at each step" —
structured event and error history. Reach for **Cloud Trace** when the
question is "where did the time go" or "is this request looping" —
latency breakdown and call-path visualization across a multi-hop
(possibly multi-agent, multi-tool) request.

---

## 6. How these tools fit together

```
     ┌───────────────────────────────────────────────────────────────┐
     │                     Pre-production evaluation (4.1)              │
     │  ┌──────────────┐  ┌──────────────────────────┐  ┌───────────┐│
     │  │  ADK evalset   │  │  Agent Platform Gen AI      │  │  Custom    ││
     │  │  (golden data,  │  │  evaluation service          │  │  autoraters││
     │  │  prompts, edge  │  │  (org-wide standardized       │  │  (LLM-as-  ││
     │  │  cases)         │  │  criteria)                    │  │  judge etc)││
     │  └──────┬───────┘  └──────────────┬────────────────┘  └─────┬─────┘│
     └─────────┼──────────────────────────┼───────────────────────┼──────┘
               │ (1) all three gate release/deployment
               ▼
     ┌───────────────────────────────────────────────────────────────┐
     │                     Deployment target (4.2)                       │
     │      choose one:  Agent Runtime  |  Cloud Run  |  GKE              │
     │   (Agent Runtime full entry: 04-orchestration-protocols.md)        │
     └────────────────────────────┬────────────────────────────────────┘
                                  │ (2) serves production traffic
                                  ▼
     ┌───────────────────────────────────────────────────────────────┐
     │              Google Cloud Observability                          │
     │   ┌────────────────────┐        ┌────────────────────────┐      │
     │   │    Cloud Logging      │        │      Cloud Trace          │      │
     │   │  structured event/     │        │  per-hop latency,          │      │
     │   │  error history          │        │  request-path tracing      │      │
     │   └────────────────────┘        └────────────────────────┘      │
     └────────────────────────────┬────────────────────────────────────┘
                                  │ (3) findings (drift, latency, loops,
                                  │     failures, hallucinations)
                                  └──────────────► feeds back into (1)
                                    continuous evaluation pipelines
```

**Arrow-by-arrow:**
1. Before (and continuously alongside) deployment, the agent is graded
   by some combination of ADK evalset, the Agent Platform Gen AI
   evaluation service, and custom autoraters — these gate what actually
   ships and re-run on an ongoing basis as continuous evaluation
   pipelines, per task 4.1.
2. A version that passes evaluation is deployed to one of the three
   runtime options — Agent Runtime, Cloud Run, or GKE, chosen per the
   decision note in §4 — and begins serving real production traffic.
3. Google Cloud Observability (Cloud Logging + Cloud Trace) monitors
   that live traffic, surfacing drift, tool-invocation latency,
   reasoning loops, system failures, logic errors, latency bottlenecks,
   and hallucinations — and those findings are exactly the kind of
   real-world failure cases that should be folded back into the golden
   datasets and test sets driving the next round of evaluation, closing
   the loop between production monitoring and pre-production testing.

---

## 7. Quick-reference table

| Tool | Role | Primary task | Don't confuse with |
|---|---|---|---|
| ADK evalset | Code-coupled evaluation tooling | 4.1 | Agent Platform Gen AI evaluation service (org-wide, not code-coupled) |
| Agent Platform Gen AI evaluation service | Managed, cross-agent evaluation | 4.1 | ADK evalset (per-agent, code-coupled) |
| Custom autoraters | Purpose-built evaluator (e.g., LLM-as-judge) | 4.1 | The two above — used for criteria neither standard tool captures |
| Cloud Run | Serverless container deployment target | 4.2 | GKE (more control, more operational overhead) |
| GKE (deployment-target facet) | Cluster-based deployment target | 4.2 | GKE-as-sandbox (see `02-coding-agents-devtools.md`, task 2.1) |
| Cloud Logging | Structured event/error history | 4.2 | Cloud Trace (latency/path tracing, not event logging) |
| Cloud Trace | Per-hop latency & request-path tracing | 4.2 | Cloud Logging (event history, not timing/path) |

---

## 8. Exam traps specific to this file

- Assuming GKE's role here (production deployment target) is the same
  as its role in Section 2 (coding-agent sandbox) — same product, two
  distinct exam-relevant roles; see `02-coding-agents-devtools.md`.
- Treating ADK evalset, the Gen AI evaluation service, and custom
  autoraters as competing choices where only one is "correct" — mature
  pipelines layer all three for different purposes (§2's decision
  note).
- Treating Cloud Logging and Cloud Trace as redundant or
  interchangeable — Logging answers "what happened," Trace answers
  "where did the time go / is this looping."
- Forgetting that task 4.2's troubleshooting list (drift, tool
  invocation latency, reasoning loops, system failures) is meant to map
  onto specific Observability signals, not treated as abstract agent
  problems with no diagnostic tool attached.
- Writing a full Agent Runtime section here — its complete reference
  entry (including its orchestration role) belongs in
  `04-orchestration-protocols.md` §5; this file covers it only as a
  deployment-target option.
