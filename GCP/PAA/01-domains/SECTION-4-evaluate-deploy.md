# Section 4 — Evaluating and deploying agentic workflows (~22%)

> Source of truth: `00-START-HERE/RUNBOOK.md` §3, Section 4 (verbatim
> task bullets). Tasks covered: **4.1** (evaluating agents in
> development and in production) and **4.2** (deploying and scaling
> production workloads).
>
> Currency reminder: the deployment runtime this section (and the exam
> broadly) refers to is **Agent Runtime** (formerly **Agent Engine**) —
> use the current name, and only mention the old name when explicitly
> flagging the rename.

---

## 0. Where Section 4 sits in the exam's mental model

Section 3 built the agent. Section 4 is about proving it works
*before* it ships (evaluation) and running it reliably *after* it
ships (deployment/scaling/troubleshooting). These are two distinct but
tightly linked disciplines — a weak evaluation strategy produces an
agent nobody can trust in production, and a weak deployment strategy
means even a well-evaluated agent degrades or fails once it's serving
real traffic.

```
   DEVELOPMENT                         PRODUCTION
   ┌─────────────────────┐             ┌─────────────────────────┐
   │  4.1 EVALUATION        │             │  4.2 DEPLOYMENT/SCALING   │
   │  Test sets, golden      │──ship────►│  Runtime selection,        │
   │  data, continuous        │           │  troubleshooting, monitor- │
   │  eval pipelines,          │◄──feed───│  ing/optimization           │
   │  eval frameworks           │  back    │                            │
   └─────────────────────┘   signals    └─────────────────────────┘
```

Note the feedback arrow: production monitoring (4.2) surfaces real
failure modes (drift, latency bottlenecks, hallucinations) that should
feed back into evaluation test sets (4.1) — evaluation isn't a
one-time pre-launch gate, it's continuous, informed by what actually
happens in production. This bidirectional relationship is itself
testable: a question describing "an agent passed all pre-launch tests
but degrades over time in production" is pointing at exactly this
gap — the need for **continuous** evaluation (4.1's own phrasing),
not just a one-time launch checklist.

---

## 1. Task 4.1 — Evaluating agents in development and in production

### 1.1 Creating test sets: golden data, prompts, and edge cases

Task 4.1's first bullet: **"Creating test sets for agent evaluation
(e.g., golden data, prompts, and edge cases)."**

- **Golden data** — a curated, verified-correct set of
  input/expected-output pairs representing the ground truth an agent's
  actual output is compared against. "Golden" signals the labels are
  trusted/authoritative — often human-verified or expert-curated —
  which is what makes them usable as a scoring baseline rather than
  just more unverified data.
- **Prompts** — the representative set of inputs the agent should be
  tested against, ideally spanning the real distribution of what
  production traffic will actually look like (not just easy,
  best-case inputs).
- **Edge cases** — inputs specifically chosen to probe boundary
  conditions, ambiguity, and failure-prone areas: malformed input,
  conflicting instructions, adversarial phrasing, rare-but-plausible
  scenarios, multi-turn conversations that drift off-topic. Edge cases
  are what separate a test set that merely confirms "the agent works
  on easy inputs" from one that actually finds where it breaks.

**Don't use** a test set built exclusively from easy, representative
"happy path" prompts — it will pass with high scores while hiding
failure modes that only show up on ambiguous or adversarial input,
giving false confidence before launch. **Use** a test set that
deliberately includes golden data plus a meaningful proportion of edge
cases, so evaluation actually stresses the agent's weak points.

**Don't use** unverified, unlabeled sample data as if it were golden
data — without a trusted expected-output baseline, you can't actually
score correctness, only observe outputs. **Use** genuinely
verified/curated golden data as your scoring baseline, and treat
"prompts" without verified expected outputs as exploratory input
rather than a scoring mechanism.

### 1.2 Continuous evaluation pipelines for tool execution

Task 4.1's second bullet: **"Creating continuous evaluation pipelines
to assess an agent's tool execution based on established success
criteria."**

Two ideas compound here:

1. **Continuous** — evaluation isn't a single pre-launch gate; it's a
   pipeline that runs on an ongoing basis (e.g., against fresh
   production samples, or on every code/prompt change), so
   regressions and drift are caught as they happen, not discovered
   much later by a user complaint.
2. **Tool execution, against established success criteria** — for an
   agentic system specifically (as opposed to a plain text-generation
   model), a major evaluation surface is *did the agent call the right
   tool, with the right arguments, and did that tool call actually
   accomplish the intended sub-goal* — not just "was the final text
   response good." Success criteria need to be defined explicitly
   (e.g., "the correct tool was selected," "required parameters were
   populated correctly," "the tool call's result was correctly
   incorporated into the final response") rather than left implicit.

```
        ┌─────────────────────────┐
        │  New agent version /      │
        │  prompt/model change,      │
        │  or scheduled interval     │
        └────────────┬───────────────┘
                      │ triggers
                      ▼
        ┌─────────────────────────┐
        │  Continuous evaluation    │
        │  pipeline runs             │
        └────────────┬───────────────┘
                      │ evaluates against:
        ┌──────────────┼───────────────────┐
        ▼              ▼                    ▼
   ┌──────────┐  ┌──────────────┐   ┌──────────────────┐
   │ Golden     │  │ Tool-execution │   │ Response quality   │
   │ data set   │  │ success criteria│   │ / retrieval quality │
   │            │  │ (right tool,    │   │ against golden      │
   │            │  │  right args,    │   │ dataset               │
   │            │  │  correct result)│   │                       │
   └──────────┘  └──────────────┘   └──────────────────┘
                      │
                      ▼
        ┌─────────────────────────┐
        │  Pass/fail + regression    │
        │  signal → feeds back into  │
        │  4.2 monitoring/production │
        │  and future test-set        │
        │  refinement                 │
        └─────────────────────────┘
```

Diagram walkthrough: a continuous evaluation pipeline is triggered
repeatedly (on changes, or on a schedule), and evaluates along
multiple axes simultaneously — golden-data correctness, tool-execution
success, and response/retrieval quality — rather than a single
pass/fail signal. This is what makes it "continuous" rather than a
one-time launch gate, and it's the direct feedback partner to Section
4.2's production monitoring.

**Don't use** a single manual, pre-launch-only evaluation pass as your
only quality gate — it can't catch regressions introduced after
launch (a prompt tweak, an underlying model version change, a tool API
change) and it says nothing about tool-execution correctness
specifically. **Use** a continuous pipeline with explicit tool-execution
success criteria, running on an ongoing basis.

### 1.3 Determining the evaluation framework and tooling

Task 4.1's third bullet: **"Determining the appropriate evaluation
framework and tooling (e.g., ADK evaluation tooling (evalset), Agent
Platform Gen AI evaluation service, and custom autoraters)."** Three
named options, each with a different fit:

| Framework/tooling | What it is | Best fit |
|---|---|---|
| **ADK evaluation tooling (evalset)** | Evaluation tooling built into the ADK ecosystem — an "evalset" is a structured set of test cases (inputs, expected trajectories/outputs) you run against an ADK-built custom agent | You built the agent in ADK (Section 3.1) and want evaluation that understands ADK's own agent/tool-call structure natively |
| **Agent Platform Gen AI evaluation service** | A managed evaluation service within the broader Agent Platform, for assessing generative/agentic quality (response quality, retrieval quality, etc.) as a service rather than a library you wire in yourself | You want a managed evaluation capability without building/maintaining your own evaluation harness — especially useful across agents built with different underlying tooling |
| **Custom autoraters** | Purpose-built evaluator models/logic (often themselves LLM-based "judge" models, or rule-based scorers) you design to score outputs against criteria that off-the-shelf tooling doesn't directly capture | Your success criteria are domain-specific/nuanced enough that generic evaluation tooling can't score them well (e.g., "does this response match our specific brand voice and compliance requirements simultaneously") |

**Don't use** ADK evaluation tooling (evalset) alone when your success
criteria are highly domain-specific and require nuanced judgment
beyond what a structured test-case comparison captures — a rigid
input/expected-output evalset can't easily score subjective or
multi-dimensional quality criteria. **Use** a custom autorater layered
on top when nuanced, criteria-specific judgment is needed.

**Don't use** a custom autorater as your first tool by default — it's
extra engineering effort to build and validate an evaluator well.
**Use** the managed Agent Platform Gen AI evaluation service or ADK's
own evalset tooling first, when they cover your evaluation needs
out of the box, and reach for custom autoraters specifically for the
gaps they don't cover.

**Don't use** the Agent Platform Gen AI evaluation service as a
substitute for tool-execution-specific evaluation when the agent's
failure mode is specifically about calling the wrong tool or
malformed arguments — that's more precisely what ADK evalset-style
trajectory evaluation is built to catch (it can assert on the actual
sequence of tool calls, not just final response quality). **Use**
ADK evaluation tooling when tool-call trajectory correctness is the
specific thing under test.

### 1.4 Evaluating against a golden dataset: response and retrieval quality

Task 4.1's fourth bullet: **"Evaluating an agentic system against a
golden dataset to assess agent response and retrieval quality (e.g.,
using ADK)."** This calls out two quality dimensions that must be
evaluated **separately**, not conflated into one score:

- **Response quality** — is the agent's final output correct,
  well-formed, appropriately toned, and useful?
- **Retrieval quality** — for a RAG-grounded agent (Section 3.2), did
  the retrieval step actually surface the right supporting content?
  This is upstream of response quality: an agent can produce a
  fluent, well-formed response that's wrong *because retrieval
  surfaced the wrong context* — a failure that a response-quality-only
  metric might miss or misattribute, since the language model itself
  behaved "correctly" given bad input.

**Don't use** a single blended quality score that conflates response
quality and retrieval quality — you lose the ability to diagnose
*where* a failure originated (a bad answer from bad retrieval looks
identical, in a blended score, to a bad answer from good retrieval
that the model then reasoned about incorrectly). **Use** separate
retrieval-quality and response-quality metrics so failures can be
correctly attributed and fixed at the right layer of the stack.

---

## 2. Task 4.2 — Deploying and scaling production workloads

### 2.1 Selecting the optimal deployment runtime

Task 4.2's first bullet: **"Selecting optimal deployment runtime based
on the use case, requirements, and cost (e.g., Agent Runtime, Cloud
Run, and GKE)."** Three named runtime options — a direct
head-to-head comparison the exam expects you to reason through:

| Dimension | **Agent Runtime** (formerly Agent Engine) | **Cloud Run** | **GKE** |
|---|---|---|---|
| Management model | Fully managed, purpose-built for hosting agents | Fully managed, general-purpose serverless containers | Managed Kubernetes — you control cluster/workload configuration in more depth |
| Agent-specific features | Native integration with agent-platform concepts (sessions, memory, agent-specific scaling/observability patterns) | General-purpose — no agent-specific abstractions built in; you provide those yourself | General-purpose — same, but with deeper infra-level control |
| Operational overhead | Lowest — purpose-built, least infra to manage | Low — serverless, scales to zero, minimal ops | Highest — you manage cluster topology, node pools, networking, scaling policy |
| Customization/control ceiling | Bounded by what the managed agent runtime exposes | Broad, but still constrained to the Cloud Run container/request model | Highest — full control over networking, custom sidecars, exotic scaling/scheduling needs |
| Cost model | Usage-based, tuned for agent workloads | Pay-per-use, scales to zero when idle | Cluster/node cost (even partially idle capacity can carry cost) plus operational engineering time |
| Best fit | You want the most agent-native managed experience with minimal ops burden | You want serverless simplicity for a workload that fits the container/request model and don't need agent-specific platform features | You need deep infra control (custom networking, GPU scheduling, multi-tenant isolation, or you're already standardized on GKE elsewhere in your stack — e.g., as a coding-agent sandbox per Section 2.1) |

```
                  ┌─────────────────────────────┐
                  │ Do you need deep infra-level   │
                  │ control (custom networking,     │
                  │ GPU scheduling, existing GKE      │
                  │ standardization)?                  │
                  └────────────┬────────────────────┘
                        yes    │    no
                    ┌──────────┘    └───────────┐
                    ▼                              ▼
              ┌───────────┐          ┌─────────────────────┐
              │    GKE      │          │ Do you want the most  │
              └───────────┘          │ agent-native managed    │
                                       │ experience (sessions,    │
                                       │ memory, agent-specific    │
                                       │ observability built in)?  │
                                       └────────────┬───────────────┘
                                              yes    │    no
                                          ┌──────────┘    └───────────┐
                                          ▼                             ▼
                                    ┌───────────┐             ┌───────────┐
                                    │ Agent       │             │ Cloud Run  │
                                    │ Runtime     │             └───────────┘
                                    └───────────┘
```

**Don't use** GKE when your workload doesn't need deep infra
customization and you'd rather avoid the operational overhead of
managing cluster/node topology — you're taking on unnecessary ops
burden for control you won't use. **Use** Agent Runtime or Cloud Run
instead, depending on how agent-native vs. general-purpose you want
the platform to be.

**Don't use** Cloud Run when you specifically need the agent-native
platform features Agent Runtime provides natively (managed
sessions/memory integration, agent-specific scaling and
observability) — you'd end up re-building those yourself on top of a
general-purpose container platform. **Use** Agent Runtime when those
agent-specific capabilities matter to your use case.

**Don't use** Agent Runtime when your workload genuinely needs
infrastructure control Agent Runtime's managed abstraction doesn't
expose (e.g., highly custom networking topology, specialized GPU
scheduling across many workload types, an existing GKE-standardized
platform team) — you'll hit the ceiling of what a purpose-built
managed runtime is designed to flex for. **Use** GKE for that level of
control.

### 2.2 Troubleshooting agent issues

Task 4.2's second bullet: **"Troubleshooting agent issues (e.g.,
drift, tool invocation latency, agent reasoning loops, and system
failures)."** Four named failure modes, each with a distinct
diagnostic signature:

| Failure mode | What it looks like | Typical root cause direction |
|---|---|---|
| **Drift** | Agent quality/behavior degrades gradually over time relative to its evaluated baseline | Underlying data distribution shift, an unannounced upstream model version change, stale grounding content no longer reflecting current reality |
| **Tool invocation latency** | Individual requests are slow, specifically at the point where the agent calls an external tool/API | A slow downstream dependency, network/connectivity issues to the tool, insufficiently parallelized independent tool calls (see Section 3.3's parallel-topology tradeoff) |
| **Agent reasoning loops** | The agent repeatedly calls the same tool, re-asks the same question, or cycles through the same reasoning steps without making forward progress | Ambiguous or unsatisfiable success criteria, a tool returning an error the agent doesn't know how to recover from, missing exit/termination conditions in the agent's own control logic |
| **System failures** | Outright errors — the agent or a dependency crashes, times out, or returns an unhandled error | Infrastructure-level issues (capacity, misconfiguration), unhandled exceptions in agent or tool code, dependency outages |

**Don't use** a single generic "agent is broken" investigation
approach that doesn't first classify which of these four failure
categories you're looking at — the diagnostic path (and the fix) is
completely different for drift (a data/model problem) versus a
reasoning loop (a control-logic problem) versus tool latency (an
infra/dependency problem). **Use** the specific diagnostic signature
to route your investigation to the right layer immediately, rather
than treating every "the agent behaved wrong" report the same way.

**Exam scenario cue:** "the agent kept calling the same tool
repeatedly and never produced a final answer" → **reasoning loop**, not
drift or tool latency. "the agent used to work well but has been
getting noticeably worse over the past few weeks" → **drift**, not a
reasoning loop or an outright failure. "individual requests are slow
specifically when the agent needs external data" → **tool invocation
latency**, not drift.

### 2.3 Monitoring and optimizing for performance, reliability, and cost

Task 4.2's third bullet: **"Monitoring and optimizing agents for
performance, reliability, and cost (e.g., identify logic errors,
latency bottlenecks, and hallucinations)."**

Three named things to identify through monitoring:

- **Logic errors** — the agent's reasoning or control flow is
  incorrect (not a model-quality/hallucination problem per se, but a
  flaw in how the agent's decision logic, orchestration, or tool
  sequencing was designed).
- **Latency bottlenecks** — the specific stage(s) in the agent's
  pipeline (retrieval, a specific tool call, the LLM inference itself,
  a downstream dependency) that dominate end-to-end response time —
  identifying *which* stage is the bottleneck is what makes
  optimization possible, versus treating "the agent is slow" as
  undifferentiated.
- **Hallucinations** — the agent produces confident, plausible-sounding
  but factually incorrect output not grounded in retrieved
  context/tool results. In an agentic (as opposed to plain chat)
  system, hallucination detection should specifically check whether a
  claim in the output is actually supported by what was retrieved/
  returned by tools, not just whether the output "sounds right."

**Google Cloud Observability (Cloud Logging and Cloud Trace)** — the
in-scope observability tooling named in the guide's 28-item tool list
— is the mechanism for actually collecting the telemetry that this
kind of monitoring/troubleshooting (§2.2 and §2.3 together) depends
on: Cloud Logging for structured event/error logs, Cloud Trace for
distributed tracing that lets you see where time is actually being
spent across an agent's multi-step, multi-tool execution path (the
direct mechanism for identifying which specific stage is a latency
bottleneck).

```
        ┌──────────────────────────┐
        │   Agent Runtime / Cloud Run │
        │   / GKE deployment            │
        └─────────────┬──────────────┘
                       │ emits telemetry
        ┌──────────────┼──────────────────┐
        ▼                                    ▼
   ┌──────────────┐                 ┌──────────────────┐
   │ Cloud Logging  │                 │ Cloud Trace         │
   │ (structured      │                 │ (distributed         │
   │  events, errors)  │                 │  tracing across      │
   │                    │                 │  multi-step,          │
   │                    │                 │  multi-tool paths)    │
   └──────────────┘                 └──────────────────┘
                       │                       │
                       └───────────┬───────────┘
                                     ▼
                     ┌──────────────────────────┐
                     │  Identify: logic errors,    │
                     │  latency bottlenecks,        │
                     │  hallucinations                │
                     │  (feeds back into 4.1's         │
                     │  continuous evaluation and       │
                     │  future golden-data/edge-case     │
                     │  test-set refinement)              │
                     └──────────────────────────┘
```

Diagram walkthrough: Cloud Logging and Cloud Trace are the two named
Google Cloud Observability components that feed the actual monitoring
data; what you do with that data (identifying logic errors, latency
bottlenecks, hallucinations) is the analysis layer on top, which
should feed back into 4.1's continuous evaluation pipeline — closing
the loop shown in this file's §0 diagram.

**Don't use** end-to-end latency alone as your only performance metric
— it tells you *that* something is slow, not *which* stage is
responsible, so you can't actually act on it. **Use** Cloud Trace's
distributed tracing to break down latency by stage (retrieval, a
specific tool call, LLM inference) so optimization effort targets the
actual bottleneck.

**Don't use** a purely "does the output sound plausible" review to
catch hallucinations in a RAG-grounded agentic system — plausibility
and factual grounding are different things, and a fluent hallucination
will pass a plausibility-only check easily. **Use** grounding checks
that verify claims in the output against what was actually retrieved
or returned by tool calls (connecting back to 4.1's separate
retrieval-quality evaluation).

---

## 3. Common exam scenario patterns for Section 4

1. **"An agent passed every pre-launch test but users are reporting
   worse answers a month after launch."** → this is a **continuous
   evaluation / drift** gap — pre-launch-only testing missed
   post-launch degradation; needs a continuous evaluation pipeline,
   and the specific symptom (gradual degradation over time) points to
   drift.

2. **"The agent keeps calling the same search tool over and over with
   slightly different queries and never gives a final answer."** →
   **agent reasoning loop** — investigate missing termination
   conditions or unsatisfiable success criteria.

3. **"Response quality scores look fine, but customers are still
   getting wrong answers, and we can't tell why."** → check
   **retrieval quality separately from response quality** — the
   retrieval step may be surfacing wrong context that the model then
   fluently (but wrongly) answers from.

4. **"We need the deployment platform to give us native session/memory
   integration and agent-specific observability with minimal ops
   overhead."** → **Agent Runtime**.

5. **"We're already standardized on Kubernetes and need custom GPU
   scheduling across many workload types, agents included."** →
   **GKE**.

6. **"We want a simple, serverless, scale-to-zero deployment for a
   workload that doesn't need agent-platform-specific features."** →
   **Cloud Run**.

7. **"We need to know exactly which stage of a multi-tool agent
   pipeline is causing slow responses."** → **Cloud Trace**
   (distributed tracing), not just aggregate latency numbers.

8. **"An agent's output sounds confident and well-written but cites a
   policy detail that isn't actually in the retrieved documents."** →
   **hallucination** — check groundedness against actual retrieved
   content, not just fluency.

9. **"We want to assert on the exact sequence of tool calls an ADK
   agent makes for a given input, not just the final text output."**
   → **ADK evaluation tooling (evalset)**.

10. **"Our success criteria are unusually domain-specific (a
    compliance/brand-voice hybrid check) and generic evaluation
    tooling doesn't capture it well."** → **custom autorater**.

---

## 4. Section 4 practice questions (18)

**Q1.** What is "golden data" in the context of agent evaluation test
sets?
A) Any unlabeled sample input data
B) A curated, verified-correct set of input/expected-output pairs used as a scoring baseline
C) Production traffic logs, unfiltered
D) A synonym for edge cases

*Answer: B.* This is the definition given in §1.1 — golden data is
specifically trusted/verified, which is what makes it usable as a
correctness baseline. (A) lacks the verified/labeled property that
makes data "golden." (C) is raw, unfiltered production traffic, not a
curated baseline. (D) conflates two distinct test-set components —
golden data and edge cases serve different purposes.

**Q2.** Why does a test set built only from "happy path" prompts give
false confidence before launch?
A) Happy-path prompts are always harder to answer than edge cases
B) It passes with high scores while hiding failure modes that only appear on ambiguous, adversarial, or boundary-condition input
C) Happy-path prompts cannot be scored against golden data
D) There is no risk — happy-path testing is sufficient for any agent

*Answer: B.* This is the exact risk called out in §1.1 — easy prompts
systematically under-test the agent's actual weak points. (A) is
backwards. (C) is false — happy-path prompts can absolutely be scored
against golden data, that's not the issue. (D) is the exact false
confidence this question is testing awareness of.

**Q3.** A continuous evaluation pipeline for an agentic system should
assess tool execution based on:
A) Only whether the final text response sounds fluent
B) Established success criteria specific to tool execution — e.g., whether the right tool was called, with correct arguments, producing a correctly incorporated result
C) Only whether the agent avoided calling any tools at all
D) Whether the underlying LLM's parameter count is sufficient

*Answer: B.* This is task 4.1's explicit framing — tool execution
needs its own defined success criteria, distinct from general response
fluency. (A) misses the tool-execution-specific evaluation surface
entirely. (C) is nonsensical for an agentic system, which is expected
to call tools. (D) is unrelated to evaluation methodology.

**Q4.** Which evaluation tooling would you reach for first if your
agent was built with ADK and you want to assert on the exact sequence
of tool calls it makes, not just its final output?
A) Custom autoraters, built from scratch
B) ADK evaluation tooling (evalset)
C) Agent Platform Gen AI evaluation service, exclusively
D) Cloud Trace

*Answer: B.* ADK evalset tooling is specifically built to evaluate
ADK agent structure, including tool-call trajectories — the natural
first choice here (§1.3). (A) is more engineering effort than needed
when purpose-built tooling already covers this. (C) is more general
response/retrieval-quality focused, less precise for trajectory
assertions specifically. (D) is an observability tool for production
telemetry, not a pre-launch evaluation framework.

**Q5.** Why should response quality and retrieval quality be evaluated
as separate metrics rather than one blended score?
A) Because retrieval quality cannot be measured at all
B) Because a blended score can't distinguish a bad answer caused by bad retrieval from a bad answer caused by a model reasoning error on good retrieval — separate metrics correctly attribute the failure to the right layer
C) Because response quality is always more important than retrieval quality
D) Because the ADK evalset only supports one metric type

*Answer: B.* This is the direct rationale in §1.4 — separating the
metrics enables correct root-cause attribution across the RAG stack.
(A) is false — retrieval quality is explicitly measurable and named as
a required evaluation dimension. (C) is an unsupported value judgment
not made by the guide. (D) is a fabricated tooling limitation.

**Q6.** A team needs a managed evaluation capability across several
agents built with different underlying tooling, without building and
maintaining their own evaluation harness. What best fits?
A) ADK evaluation tooling (evalset), exclusively
B) Agent Platform Gen AI evaluation service
C) A custom autorater built from scratch for each agent
D) Cloud Logging alone

*Answer: B.* This matches the described fit in §1.3 — a managed
service across heterogeneous agents, without a custom-built harness.
(A) is ADK-specific tooling, less suited to agents built with other
tooling. (C) is more effort than needed when a managed service already
fits. (D) is a logging tool, not an evaluation framework.

**Q7.** Which deployment runtime provides the most agent-native
managed experience (sessions, memory integration, agent-specific
observability) with the lowest operational overhead?
A) GKE
B) Cloud Run
C) Agent Runtime
D) Cloud Workstations

*Answer: C.* This is Agent Runtime's defining characteristic in the
§2.1 comparison table — purpose-built for agent workloads with the
lowest ops burden among the three named runtimes. (A) GKE has the
highest ops overhead and no built-in agent-native abstractions. (B)
Cloud Run is general-purpose serverless, lacking agent-specific
platform features. (D) Cloud Workstations is a Section 2 dev-sandbox
tool, not a production agent deployment runtime.

**Q8.** A team needs custom GPU scheduling across many different
workload types and is already standardized on Kubernetes elsewhere in
their infrastructure. Which runtime fits best?
A) Agent Runtime
B) Cloud Run
C) GKE
D) None of these support GPU scheduling

*Answer: C.* Deep infra control (custom scheduling, existing
Kubernetes standardization) is GKE's specific fit per §2.1. (A) and
(B) are both more managed/abstracted, with a lower control ceiling
than what this scenario needs. (D) is false — GKE explicitly supports
this kind of control.

**Q9.** An agent repeatedly calls the same tool with slightly
reworded queries and never produces a final answer. What failure mode
is this?
A) Drift
B) Agent reasoning loop
C) System failure
D) Tool invocation latency

*Answer: B.* This is the exact diagnostic signature for a reasoning
loop in §2.2 — repeated calls without forward progress. (A) drift is
gradual quality degradation over time, not a single-session repeated-
call pattern. (C) implies an outright crash/error, not repeated
attempts. (D) is about slow individual calls, not repetition without
progress.

**Q10.** An agent's quality has been gradually getting worse over
several weeks compared to its evaluated baseline, with no single
incident or error. What failure mode is this most likely?
A) Agent reasoning loop
B) System failure
C) Drift
D) Tool invocation latency

*Answer: C.* Gradual degradation over time relative to an evaluated
baseline is the definition of drift in §2.2 — likely caused by data
distribution shift, stale grounding content, or an unannounced
upstream model change. (A) is a same-session repetition pattern, not
gradual degradation. (B) implies a discrete failure event, not gradual
change. (D) is a per-request slowness symptom, unrelated to
correctness degradation over time.

**Q11.** Which Google Cloud Observability component provides
distributed tracing that lets you identify exactly which stage of a
multi-tool agent pipeline is the latency bottleneck?
A) Cloud Logging
B) Cloud Trace
C) Model Armor
D) Agent Registry

*Answer: B.* Cloud Trace is explicitly the distributed-tracing
component named in the guide's observability tooling (§2.3). (A)
Cloud Logging handles structured events/errors, not stage-by-stage
timing breakdown. (C) and (D) are unrelated — a governance/safety tool
and a capability-discovery tool respectively.

**Q12.** Why is "the agent's response sounds confident and
plausible" an insufficient check for hallucination in a RAG-grounded
agentic system?
A) Plausibility and factual groundedness are different properties — a fluent hallucination can sound entirely plausible while not being supported by retrieved content
B) Hallucinations never sound plausible, so this check is actually sufficient
C) RAG-grounded systems cannot hallucinate by definition
D) Plausibility checks are only relevant to low-code agents

*Answer: A.* This is the core distinction in §2.3's don't-use/use
guidance — plausibility is not the same as being grounded in actual
retrieved/tool-returned content. (B) is false and describes exactly
the misconception being tested. (C) is a dangerous false assumption —
RAG grounding reduces but does not eliminate hallucination risk. (D)
is unrelated and false.

**Q13.** What does it mean that Section 4.1 (evaluation) and Section
4.2 (deployment/monitoring) form a feedback loop, per this file's
opening framing?
A) They are entirely independent and never interact
B) Production monitoring surfaces real failure modes (drift, latency bottlenecks, hallucinations) that should feed back into evaluation test sets, making evaluation continuous rather than a one-time pre-launch gate
C) 4.2 replaces the need for 4.1 once an agent is deployed
D) 4.1 is only relevant before the first deployment, never afterward

*Answer: B.* This is the explicit framing in §0 and reinforced
throughout §2.3 — production findings should refine ongoing
evaluation, not be treated as a separate, disconnected concern. (A),
(C), (D) all sever the feedback relationship the guide's own task
structure (continuous evaluation pipelines, tool-execution success
criteria) implies.

**Q14.** A scenario describes individual agent requests being slow
specifically at the moment the agent needs to fetch external data via
a tool call, while the rest of the pipeline performs normally. What
should you check first?
A) Whether the agent is in a reasoning loop
B) Tool invocation latency — the specific downstream dependency or connectivity involved in that tool call
C) Whether the underlying model has drifted
D) Whether golden data was used to build the test set

*Answer: B.* The symptom (slowness localized to the tool-call step
specifically) is the defining signature of tool invocation latency in
§2.2, not a general or unlocalized slowdown. (A) reasoning loops
present as repeated non-progressing calls, not simple slowness. (C)
drift is a correctness/quality symptom over time, not a latency
symptom. (D) is unrelated to a live latency investigation.

**Q15.** Which statement correctly distinguishes a "logic error" from
a "hallucination" as monitoring targets under task 4.2?
A) They are synonyms and should always be tracked as one metric
B) A logic error is a flaw in the agent's reasoning/control flow or orchestration design; a hallucination is confident, plausible output not actually grounded in retrieved/tool-returned content
C) Logic errors only occur in low-code agents; hallucinations only occur in custom ADK agents
D) Hallucinations are a subset of tool invocation latency issues

*Answer: B.* This is the distinction drawn in §2.3 — two different
failure categories requiring different diagnostic and fix approaches.
(A) collapses a meaningful distinction the guide keeps separate. (C)
is a fabricated tool-specific restriction. (D) incorrectly nests one
unrelated failure category inside another.

**Q16.** True or False: On the PAA exam, "Agent Runtime" and "Agent
Engine" both refer to the same current, correct exam-guide
terminology for the deployment runtime.
A) True — either term is equally correct terminology on the current exam
B) False — Agent Runtime is the current name; Agent Engine is the outdated, pre-rename name, only worth mentioning to explicitly flag the rename
C) True, but only Agent Engine is listed in the guide's in-scope tool list
D) False — neither term appears anywhere in the guide

*Answer: B.* This is the currency correction repeated throughout this
folder — say "Agent Runtime," reserve "Agent Engine" only for
explicitly noting the historical name. (A) treats them as
interchangeable, which is the trap. (C) reverses which name is
actually in the current in-scope list (it's "Agent Runtime (formerly
Agent Engine)"). (D) is false — Agent Runtime very much appears, as
the current name.

**Q17.** A team wants to build a custom evaluator that scores agent
output against a nuanced, organization-specific blend of compliance
and brand-voice criteria that no off-the-shelf evaluation tool
captures well. What's the appropriate tooling choice?
A) ADK evaluation tooling (evalset) alone, since it covers all evaluation needs by default
B) A custom autorater, built to score against those specific nuanced criteria
C) Cloud Trace, since it handles all quality assessment
D) No tooling is appropriate for this — nuanced criteria cannot be evaluated systematically

*Answer: B.* This is exactly the fit described for custom autoraters
in §1.3 — purpose-built evaluators for criteria generic tooling
doesn't capture well. (A) is generic trajectory/structure-focused
tooling, not built for this kind of nuanced judgment. (C) is an
observability/tracing tool, unrelated to quality scoring. (D) is
false — this is precisely the use case custom autoraters address.

**Q18.** Which combination correctly matches deployment runtime to
its best-fit scenario?
A) Cloud Run → deep custom GPU scheduling across many workload types
B) GKE → simplest possible serverless deployment with scale-to-zero and no agent-specific features needed
C) Agent Runtime → native session/memory integration and agent-specific observability with minimal ops overhead
D) Agent Runtime → maximum low-level infrastructure control ceiling

*Answer: C.* This is the correct pairing from the §2.1 comparison
table. (A) and (B) swap Cloud Run's and GKE's actual best-fit
scenarios (GKE is for deep infra control; Cloud Run is for simple
serverless). (D) mischaracterizes Agent Runtime — its control ceiling
is bounded by the managed platform, lower than GKE's, in exchange for
agent-native features and lower ops overhead.

---

## 5. Quick-reference recap

| Concept | One-line definition | Don't confuse with |
|---|---|---|
| Golden data | Curated, verified-correct input/expected-output pairs | Unlabeled sample prompts (not a scoring baseline) |
| Edge cases | Boundary/adversarial/ambiguous test inputs | "Happy path" prompts (which under-test failure modes) |
| Continuous evaluation pipeline | Ongoing, triggered evaluation (not one-time) | A single pre-launch test pass |
| Tool-execution success criteria | Explicit criteria: right tool, right args, correct result incorporation | General response-quality scoring alone |
| ADK evaluation tooling (evalset) | Structured test cases for ADK agent trajectories | Agent Platform Gen AI evaluation service (broader, less ADK-specific) |
| Agent Platform Gen AI evaluation service | Managed evaluation service across agents | Custom autoraters (purpose-built, more engineering effort) |
| Custom autoraters | Purpose-built evaluators for nuanced/domain-specific criteria | Off-the-shelf evalset/managed evaluation (less flexible, less effort) |
| Response quality | Is the final output correct/well-formed/useful | Retrieval quality (a separate, upstream metric) |
| Retrieval quality | Did retrieval surface the right supporting content | Response quality (a downstream, separate metric) |
| Agent Runtime | Managed, agent-native deployment runtime (formerly Agent Engine) | Cloud Run (general-purpose serverless) or GKE (max infra control) |
| Cloud Run | General-purpose, serverless, scale-to-zero containers | Agent Runtime (agent-native features) or GKE (deep infra control) |
| GKE | Managed Kubernetes, highest infra control and ops overhead | Cloud Run (lower control, lower ops) or Agent Runtime (agent-native, lower ops) |
| Drift | Gradual quality degradation over time vs. evaluated baseline | Agent reasoning loop (a same-session repetition pattern) |
| Tool invocation latency | Slowness localized to a tool-call step | Drift (a correctness symptom, not a speed symptom) |
| Agent reasoning loop | Repeated calls/steps without forward progress | System failure (an outright crash/error, not repetition) |
| System failures | Outright crashes/errors/unhandled exceptions | Drift (gradual degradation, not a discrete failure) |
| Logic errors | Flaws in agent reasoning/control flow design | Hallucinations (ungrounded but fluent output) |
| Hallucinations | Confident, plausible, but ungrounded output | Logic errors (a control-flow flaw, not an output-grounding flaw) |
| Cloud Logging | Structured event/error logs | Cloud Trace (distributed tracing, not log records) |
| Cloud Trace | Distributed tracing across multi-step/multi-tool execution | Cloud Logging (discrete log events, not timing breakdown) |
