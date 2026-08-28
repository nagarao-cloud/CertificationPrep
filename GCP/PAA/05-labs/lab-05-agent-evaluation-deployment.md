# Lab 05 — Building an evalset, running Gen AI evaluation, and deploying to Agent Runtime

> Covers exam task **4.1** (evaluating agents in development and
> production) and **4.2** (deploying and scaling production
> workloads). Builds directly on the agents from Labs 03–04. Companion
> reference: `01-domains/SECTION-4-evaluate-deploy.md`,
> `02-services/05-evaluation-deployment.md`,
> `03-comparisons/05-evaluation-approaches.md`,
> `03-comparisons/04-agent-hosting-deployment-options.md`.

---

## Honesty callout

> **This lab is illustrative, not SDK/console-verified.** This
> environment has no live access to ADK's evaluation tooling
> (evalset), the Agent Platform Gen AI evaluation service, Agent
> Runtime's deployment console, Cloud Logging, or Cloud Trace. Code and
> config samples below are realistic illustrations built from the exam
> guide's stated capabilities, not verified against real SDK/console
> output. **Confirm exact syntax and console flows against live
> documentation before an exam attempt.**

---

## 0. Why evaluation comes before deployment, and why it doesn't end there

Recall the bidirectional relationship from
`01-domains/SECTION-4-evaluate-deploy.md` §0: evaluation isn't a
one-time pre-launch gate — production monitoring feeds signals back
into evaluation, on an ongoing basis. This lab is structured to make
that loop concrete: you'll build a test set, run it, deploy, then
simulate a production issue and trace it back into the evaluation
process — not just "evaluate once, then deploy and forget."

### Vocabulary check before you start

- **Test set / evalset** — a curated collection of inputs (and,
  ideally, verified expected outputs) used to systematically check an
  agent's behavior, rather than eyeballing a few manual examples.
- **Ground truth** — the verified-correct answer/outcome a system's
  actual output is compared against.
- **Regression** — a case where something that used to work correctly
  now produces a wrong or worse result, typically after some change
  (a prompt edit, a model version bump, a tool API change).
- **Trajectory** (in an agentic-evaluation context) — the actual
  sequence of steps/tool calls an agent took to arrive at its final
  answer, as opposed to just the final answer itself.
- **Observability** — the ability to see what a running system is
  actually doing (via logs, traces, metrics) well enough to diagnose
  problems, as opposed to only knowing whether it succeeded or failed.

---

## 1. Part A — build a test set (task 4.1, first bullet)

Recall the three components named in
`01-domains/SECTION-4-evaluate-deploy.md` §1.1: **golden data**,
**prompts**, and **edge cases**.

### 1.1 Golden data

```python
golden_data = [
    {
        "input": "How long do I have to return an item?",
        "expected_category": "returns",
        "expected_kb_citation": "Returns & Refunds Policy, Section 1",
        "expected_tool_calls": ["kb_lookup"],
    },
    {
        "input": "I was charged twice for order #9911 and never "
                  "received order #8820.",
        "expected_category": "multi-order-issue",
        "expected_escalation": True,
        "expected_tool_calls": ["kb_lookup", "a2a_handoff"],
    },
]
```

**Why each row has both an `expected_category` and, where relevant,
`expected_tool_calls`, not just a free-text "expected answer" field:**
this is the direct application of task 4.1's second consideration —
evaluating an agent's **tool execution** against explicit success
criteria, not just final-response quality. A row that only checked
"did the final text sound reasonable" would miss a real bug where the
triage agent classified correctly by luck but never actually called
`kb_lookup` at all (see §1.3 below for exactly this kind of check).

### 1.2 Representative prompts spanning real traffic shape

```python
representative_prompts = [
    "What's your return policy for electronics?",
    "Can I exchange a gift I received without a receipt?",
    "My package says delivered but I never got it.",
    "Do you ship internationally?",
]
```

**Why include a question this agent has no good answer for
("international shipping" — not covered by the returns-policy
knowledge base from Lab 01/03):** per
`01-domains/SECTION-4-evaluate-deploy.md` §1.1's don't-use/use
guidance, a test set built exclusively from easy, in-scope prompts
gives false confidence. Including at least one genuinely out-of-scope
prompt checks whether the agent correctly declines/redirects (per the
system instruction's scope boundary from Lab 01 §2.2) rather than
hallucinating a plausible-sounding but fabricated shipping policy.

### 1.3 Edge cases specifically designed to probe failure-prone areas

```python
edge_cases = [
    {
        "input": "return return return return??? help???",
        "why_this_case": "malformed/garbled input — does the "
                          "no-match handling from Lab 01 kick in "
                          "correctly, or does the agent hallucinate "
                          "a confident-sounding but wrong response?",
    },
    {
        "input": "I want to return this AND also I heard you're "
                  "going out of business, is that true?",
        "why_this_case": "a compound message mixing an in-scope "
                          "request with an out-of-scope, sensitive "
                          "claim — does the agent handle the "
                          "returns part correctly while declining "
                          "the out-of-scope part, or does it get "
                          "confused and answer neither well?",
    },
    {
        "input": "",  # empty input
        "why_this_case": "boundary condition — does the pipeline "
                          "crash, hang, or handle this gracefully?",
    },
]
```

**Why these three specifically:** each targets a different failure
mode named in the domain file's description of what edge cases are
for — "malformed input, conflicting instructions, adversarial
phrasing, rare-but-plausible scenarios." The compound-message case is
worth calling out as a beginner-relevant lesson: it's easy to write a
test set of only single-intent messages, but real users routinely
combine an answerable request with an unrelated aside in the same
message — a test set that never exercises this will look healthy right
up until it meets real traffic.

---

## 2. Part B — determine the evaluation framework and tooling (task 4.1, third bullet)

Recall the three named options from
`01-domains/SECTION-4-evaluate-deploy.md` §1.3 and their distinct fits.
This lab's system has two different evaluation needs that map to two
different tools — don't reach for just one tool and assume it covers
everything.

### 2.1 ADK evaluation tooling (evalset) — for trajectory correctness

Use this specifically to check **did the agent call the right tool,
in the right sequence, with the right arguments** — the thing a
blended "was the final answer good" score can't isolate.

```python
from adk.eval import EvalSet, run_eval

evalset = EvalSet(
    name="support-triage-trajectory-eval",
    cases=golden_data,  # from §1.1 — includes expected_tool_calls
)

results = run_eval(
    agent=drafting_agent,   # from Lab 03
    evalset=evalset,
    check="trajectory",     # asserts on the actual sequence of
                             # tool/agent calls, not just final text
)

for r in results:
    if r.actual_tool_calls != r.expected_tool_calls:
        print(f"TRAJECTORY MISMATCH on '{r.input}': "
              f"expected {r.expected_tool_calls}, "
              f"got {r.actual_tool_calls}")
```

**Why trajectory checking matters here specifically:** recall the
multi-order-issue golden-data row from §1.1 — it expects
`["kb_lookup", "a2a_handoff"]`. If Lab 04's `should_escalate` logic
had a bug (say, the category string didn't match exactly due to a
typo), the agent might still produce a *plausible-sounding* final
response while silently skipping the A2A handoff entirely — a failure
a response-quality-only evaluation would completely miss, but a
trajectory-based evalset check catches immediately, because it asserts
on the *sequence of calls*, not just the final text.

### 2.2 Agent Platform Gen AI evaluation service — for response and retrieval quality

Use this for the broader quality question the evalset's trajectory
check doesn't address: is the *content* of the response actually good?

```python
from adk.eval import GenAIEvalService

genai_eval = GenAIEvalService(
    agent=drafting_agent,
    golden_data=golden_data,
    metrics=["response_quality", "retrieval_quality"],
)

report = genai_eval.run()
print(report.response_quality_score)
print(report.retrieval_quality_score)
```

**Why these are two separate scores, not one blended metric:** this is
the exact don't-use/use guidance from
`01-domains/SECTION-4-evaluate-deploy.md` §1.4 — "don't use a single
blended quality score that conflates response quality and retrieval
quality... use separate metrics so failures can be correctly
attributed." If `retrieval_quality_score` is low but
`response_quality_score` looks fine, that's a signal the *retrieval*
step (Lab 03's RAG pipeline) is surfacing the wrong content and the
LLM is doing a reasonable job answering with bad input — you'd go fix
the retrieval pipeline (chunking, embedding consistency, reranking),
not the drafting agent's prompt. If it's the reverse
(`retrieval_quality_score` is high but `response_quality_score` is
low), the retrieval step is fine and the problem is in how the
drafting agent is reasoning over correctly-retrieved content — a
completely different fix. A blended score can't tell you which case
you're in.

### 2.3 A custom autorater — for a criterion neither tool captures

This lab's fictional company has a brand-voice requirement neither
tool above directly scores: responses must sound empathetic, not just
factually correct. This is exactly the case the domain file's §1.3
flags as the right trigger for a custom autorater — "your success
criteria are domain-specific/nuanced enough that generic evaluation
tooling can't score them well."

```python
from adk.eval import CustomAutorater

empathy_autorater = CustomAutorater(
    name="empathy-tone-check",
    judge_model="gemini-pro",
    rubric=(
        "Score 1-5: does this support response acknowledge the "
        "customer's frustration/situation before providing the "
        "factual answer? 5 = clearly empathetic opening, "
        "1 = purely transactional/cold."
    ),
)

tone_scores = empathy_autorater.score_batch(
    inputs=representative_prompts,
    outputs=[drafting_agent.respond(p) for p in representative_prompts],
)
```

**Why build this only now, after trying the other two tools, not
first:** per the don't-use/use guidance in
`01-domains/SECTION-4-evaluate-deploy.md` §1.3 — "don't use a custom
autorater as your first tool by default — it's extra engineering
effort... use the managed service or ADK's own evalset tooling first
... and reach for custom autoraters specifically for the gaps they
don't cover." This lab deliberately follows that order: evalset for
trajectory, Gen AI evaluation service for response/retrieval quality,
and only then a custom autorater for the one nuanced, domain-specific
criterion (empathetic tone) the other two genuinely can't score.

---

## 3. Part C — set up a continuous evaluation pipeline (task 4.1, second bullet)

Recall from `01-domains/SECTION-4-evaluate-deploy.md` §1.2: evaluation
should run on an ongoing basis, not just once before launch.

```yaml
# continuous-eval-pipeline.yaml (illustrative CI-style config)
trigger:
  on_change: ["prompts/**", "agent_config/**"]
  on_schedule: "daily"
steps:
  - run: adk-eval trajectory --evalset support-triage-trajectory-eval
  - run: adk-eval genai-quality --metrics response_quality,retrieval_quality
  - run: adk-eval custom empathy-tone-check
  - report: fail_build_on_regression
```

**Why both `on_change` and `on_schedule` triggers, not just one:** a
change-triggered run catches regressions introduced by an actual code/
prompt/config edit (the most common cause of a *sudden* quality drop).
A scheduled daily run catches **drift** — the failure mode from task
4.2 (§4.2 below) where quality degrades gradually with no single
triggering change (e.g., the underlying knowledge base has quietly
gone stale, or an upstream model version was updated by the provider).
Relying on change-triggered evaluation alone would miss drift entirely,
since nothing in *your* repository changed — which is exactly why the
domain file frames continuous evaluation and production monitoring as
a feedback loop, not two unrelated activities.

---

## 4. Part D — select the deployment runtime (task 4.2, first bullet)

Recall the three-way comparison from
`01-domains/SECTION-4-evaluate-deploy.md` §2.1: **Agent Runtime**,
**Cloud Run**, **GKE**.

### 4.1 Walk the decision tree for this lab's system

This lab's system (triage + drafting + specialist agents, with managed
sessions, Memory Bank, and A2A handoffs from Labs 03–04) is exactly
the kind of workload the domain file's decision tree points toward
**Agent Runtime**: it doesn't need exotic infrastructure control (no
custom GPU scheduling, no unusual networking topology), and it
specifically benefits from **native platform integration** with the
agent-specific concepts already built — managed sessions, Memory Bank,
and multi-agent A2A handoffs are exactly the "agent-native managed
experience (sessions, memory, agent-specific observability built in)"
the decision tree names as the deciding factor over Cloud Run.

**Contrast explicitly, per the don't-use/use guidance:** if this
lab's team already ran their entire platform on GKE and wanted
coding-agent sandboxing (Lab 02) and this agent's deployment to share
one consistent infra/policy model, GKE would be defensible instead —
but that's not this lab's stated scenario, and choosing GKE anyway
would mean taking on cluster/node-topology operational overhead for
infrastructure control this system doesn't actually need, which is
precisely the anti-pattern the domain file's don't-use guidance
flags.

### 4.2 Deploy

```bash
agent-runtime deploy \
  --workflow ./escalation-workflow.yaml \
  --runtime agent-runtime \
  --region us-central1 \
  --observability cloud-logging,cloud-trace
```

**Why `--observability cloud-logging,cloud-trace` is not optional:**
per `01-domains/SECTION-4-evaluate-deploy.md` §2.3, **Google Cloud
Observability (Cloud Logging and Cloud Trace)** is the in-scope
mechanism for collecting the telemetry that troubleshooting (§5 below)
and ongoing monitoring depend on. Deploying without wiring up
observability means that when something goes wrong in production,
there's no structured log or distributed trace to diagnose it with —
you'd be debugging blind.

---

## 5. Part E — simulate and troubleshoot production failure modes (task 4.2, second/third bullets)

Recall the four named failure modes from
`01-domains/SECTION-4-evaluate-deploy.md` §2.2: **drift**, **tool
invocation latency**, **agent reasoning loops**, **system failures**.
Walk through one realistic incident of each, and practice matching the
symptom to the category *before* jumping to a fix — this is the exact
skill the domain file's exam-scenario cues (§2.2, end) are training.

### 5.1 Scenario 1 — "responses have been getting noticeably worse over the past few weeks"

**Classification:** drift, not a reasoning loop or an outright
failure — the symptom is gradual degradation relative to an
established baseline, with no single triggering event reported.

**Diagnostic path:** check Cloud Trace/Logging for whether retrieval
is still surfacing the same *kind* of content it used to (has the
underlying knowledge base gone stale — e.g., a policy document was
updated three weeks ago but never re-ingested?), and re-run the §1.1
golden-data evalset against the *current* deployed agent to see if the
scores have quietly slipped since the last passing run. **This is the
feedback loop from §3 in action** — the fix isn't just "patch
production," it's "figure out what changed upstream (stale content,
an unannounced model version bump) and, if the knowledge base is
stale, re-run the ingestion/embedding pipeline from Lab 03 §5, then
re-verify with the evalset before considering it resolved."

### 5.2 Scenario 2 — "the specialist agent handoff is taking noticeably longer than before"

**Classification:** tool invocation latency (here, effectively the
A2A handoff call, which per §3.1 of the domain file is conceptually
adjacent to a tool call in terms of where the delay is measured) —
the symptom is specifically slow at one identifiable point in the
pipeline, not a general quality decline.

**Diagnostic path:** use Cloud Trace to see exactly which span in the
multi-step execution is dominating end-to-end latency — is it the A2A
call itself, or the specialist agent's own RAG retrieval once it
receives the handoff? This distinction matters for the fix: a slow
A2A call points at network/infra between the two agents; a slow
retrieval step inside the specialist agent points back at Lab 03's RAG
pipeline configuration (e.g., an unnecessarily wide `top_k` value, or
a reranker that's more expensive than the use case needs — recall
§5.5 of Lab 03's don't-use/use guidance on when reranking's added
latency is and isn't justified).

### 5.3 Scenario 3 — "the specialist agent keeps re-requesting the same customer information over and over and never finalizes"

**Classification:** an agent reasoning loop — repeatedly cycling
through the same step without making forward progress, the textbook
signature named in §2.2.

**Diagnostic path:** this is precisely the failure mode Lab 04 §6.1's
`max_handoffs_per_ticket: 1` agent policy was designed to bound at the
*handoff* level — but this scenario describes a loop *within* the
specialist agent's own reasoning (re-requesting info repeatedly), not
a handoff bounce, so that policy alone doesn't catch it. The real fix
is at the agent's own control logic: does the specialist agent have a
clear exit/termination condition when it can't make progress (e.g.,
"after 2 failed attempts to get missing info, escalate to HITL — see
Lab 06 — rather than looping indefinitely")? A missing termination
condition, not a missing handoff-count limit, is the likely root cause
here — a good illustration of why the four failure-mode categories
need to be diagnosed at the *right layer*, not treated as
interchangeable "something's wrong" reports.

### 5.4 Scenario 4 — "the whole workflow returns an error immediately"

**Classification:** a system failure — an outright error, not a
degradation or a loop.

**Diagnostic path:** check Cloud Logging for the actual error (a
crashed dependency, a misconfigured deployment, an unhandled
exception) — this is the most straightforward category precisely
because it fails loudly rather than silently, unlike drift.

### 5.5 Identify logic errors and hallucinations too (task 4.2, third bullet)

Recall the two remaining named things to monitor for, beyond the four
failure modes above: **logic errors** (a flaw in the agent's own
decision/control flow — e.g., Lab 04's `should_escalate` function
using `and` where it should use `or`, silently under-escalating
legitimate cases) and **hallucinations** (confident but factually
incorrect output not actually grounded in retrieved context). For
hallucination detection specifically, per
`01-domains/SECTION-4-evaluate-deploy.md` §2.3: check whether a claim
in the output is actually **supported by what was retrieved**, not
just whether the output "sounds right" — this is exactly what the
citation requirement from Lab 01/03's system instructions was designed
to make checkable: a response citing a specific policy section can be
verified against the actual retrieved chunk; a response with no
citation, or a citation that doesn't match anything actually
retrieved, is a concrete, checkable hallucination signal.

---

## 6. What you should be able to explain after this lab

- [ ] The three components of a good test set (golden data,
      representative prompts, edge cases) and why a "happy path only"
      test set gives false confidence (task 4.1).
- [ ] The difference between ADK evaluation tooling (evalset), the
      Agent Platform Gen AI evaluation service, and a custom
      autorater, and which of this lab's evaluation needs mapped to
      each (task 4.1).
- [ ] Why response quality and retrieval quality must be scored
      separately, with a concrete example of how a blended score would
      have hidden which layer actually failed (task 4.1).
- [ ] Why an evaluation pipeline needs both change-triggered and
      scheduled runs, and specifically what scheduled runs catch that
      change-triggered runs would miss (task 4.1).
- [ ] Why this lab's system was deployed to Agent Runtime rather than
      Cloud Run or GKE, and under what different conditions each
      alternative would have been the right call instead (task 4.2).
- [ ] The four named failure modes (drift, tool invocation latency,
      agent reasoning loops, system failures) and their distinct
      diagnostic signatures, with a worked example of each from this
      lab (task 4.2).
- [ ] Why Cloud Logging and Cloud Trace are the mechanisms that make
      this kind of troubleshooting possible at all, and what
      diagnosing "blind" (without them) would look like by comparison
      (task 4.2).
- [ ] How to distinguish a logic error from a hallucination, and what
      concrete signal (citation-vs-retrieved-content mismatch) makes
      hallucination detection checkable rather than subjective (task
      4.2).
