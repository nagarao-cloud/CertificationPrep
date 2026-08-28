# Evaluation Approaches: ADK Evalset vs. Agent Platform Gen AI Evaluation Service vs. Custom Autoraters

**Exam mapping:** Task 4.1 ("Evaluating agents in development and in
production"), specifically: "Determining the appropriate evaluation
framework and tooling (e.g., **ADK evaluation tooling (evalset), Agent
Platform Gen AI evaluation service, and custom autoraters**)." All three
are verbatim from the guide. Task 4.1 also names the surrounding
activities these tools plug into: "Creating test sets for agent
evaluation (e.g., golden data, prompts, and edge cases)," "Creating
continuous evaluation pipelines to assess an agent's tool execution
based on established success criteria," and "Evaluating an agentic
system against a golden dataset to assess agent response and retrieval
quality (e.g., using ADK)."

## 1. What each one is and what it measures

- **ADK evaluation tooling (evalset).** The evaluation capability built
  into the open-source ADK library. Per task 4.1's last bullet, it's the
  named tool for "Evaluating an agentic system against a golden dataset
  to assess agent response and retrieval quality." An evalset is a
  structured set of test cases (inputs, expected/reference outputs or
  criteria) run against the agent to score its actual behavior — this is
  the natural home for **golden data, prompts, and edge cases** (task
  4.1's first bullet) during **development**, close to the code the
  agent is built from.
- **Agent Platform Gen AI evaluation service.** A managed, platform-
  level evaluation service under Agent Platform (the umbrella containing
  Agents CLI, Memory Bank, and managed sessions). Positioned as the
  broader evaluation framework option alongside ADK's evalset and custom
  autoraters — the platform-managed alternative when you want evaluation
  as a managed service rather than a library you invoke from your own
  code, and a natural fit for the **continuous evaluation pipelines**
  task 4.1 calls for in **production**.
- **Custom autoraters.** Purpose-built evaluators you design yourself —
  typically an **LLM**-as-judge (LLM = large language model, the AI
  model that generates text responses) or a custom scoring function —
  when neither
  ADK's evalset format nor the platform's built-in evaluation service
  covers your specific **success criteria** (task 4.1's phrase, in the
  context of assessing "an agent's tool execution based on established
  success criteria"). Custom autoraters are what you reach for when the
  quality dimension you need to measure is domain-specific and doesn't
  match a generic evaluation metric.

## 2. Head-to-head comparison table

| Dimension | ADK evalset | Agent Platform Gen AI evaluation service | Custom autoraters |
|---|---|---|---|
| Exam task | 4.1 | 4.1 | 4.1 |
| Primary lifecycle stage | Development — close to the agent's own code | Production and continuous pipelines | Either — wherever built-in metrics don't fit |
| What it measures | Agent response and retrieval quality against a golden dataset | Broader Gen AI evaluation metrics as a managed platform service | Whatever custom success criteria you define |
| Test data format | Evalset: structured golden data, prompts, edge cases (task 4.1) | Platform-defined evaluation inputs/criteria | Whatever the custom autorater's scoring logic expects |
| Integration point | Invoked from ADK code / dev workflow | Wired into Agent Platform's managed pipeline | Wired into wherever you host the custom scoring logic — dev or prod pipeline |
| Automation for continuous pipelines | Can be scripted into CI, but is fundamentally a dev-time library call | Purpose-fit for "continuous evaluation pipelines" (task 4.1) running against live/production traffic | Depends entirely on how you build it — no built-in pipeline |
| Customizability of metrics | Bounded by what ADK's evaluation tooling exposes | Bounded by what the platform's Gen AI evaluation service exposes | Fully customizable — you define the rubric/scoring function |
| Best for | Iterating on agent quality during build — did this code change improve or regress response/retrieval quality against the golden set? | Ongoing, managed, production-facing evaluation without hand-rolling pipeline infrastructure | Domain-specific success criteria (e.g., "did the agent follow our compliance script," "is this tool call sequence acceptable") that generic metrics don't capture |
| Ops overhead | Low — part of the ADK dev workflow | Low — managed platform service | High — you build and maintain the rater logic yourself |
| Tool-execution assessment | Possible via evalset test cases that include tool calls | Fits "assess an agent's tool execution based on established success criteria" (task 4.1) at the platform level | Best fit when tool-execution correctness needs bespoke judging logic beyond a pass/fail check |

## 3. Decision tree

```
                    Choosing an evaluation approach for task 4.1
                                     |
       Are you iterating on agent code during development, and do
       you need to check response/retrieval quality against a
       golden dataset close to the codebase?
                                     |
                  +-------------------+-------------------+
                 YES                                       NO
                  |                                         |
                  v                                Do the built-in metrics
        Use ADK evaluation                          (ADK evalset or the
        tooling (evalset) —                         platform service) actually
        dev-time golden-data                        cover your success
        testing, task 4.1's                          criteria (task 4.1's
        own named example                            "established success
        for this use case                            criteria")?
                                                                |
                                                       +---------+---------+
                                                      YES                  NO
                                                       |                    |
                                                       v                    v
                                          Do you need this running    Build a custom
                                          continuously in production  autorater — bespoke
                                          as a managed pipeline?      scoring logic for
                                                  |                   domain-specific
                                          +--------+--------+         criteria the built-in
                                         YES                NO        tools don't capture
                                          |                  |
                                          v                  v
                                Use Agent Platform      Re-run ADK evalset
                                Gen AI evaluation        checks as needed;
                                service (continuous,     escalate to a
                                production-facing)        platform service or
                                                          custom autorater only
                                                          if a real gap appears
```

## 4. Tradeoff writeups

### Use ADK evaluation tooling (evalset) when...
- You're actively developing or modifying an agent and need fast
  feedback on whether a change improved or regressed response and
  retrieval quality against a golden dataset — task 4.1's explicit
  example use of ADK.
- You're building the initial test set itself — golden data, prompts,
  and edge cases (task 4.1's first bullet) — since this is naturally
  authored alongside the agent's own code and tool definitions.
- The evaluation need is scoped to development-loop iteration, not
  standing up an always-on production pipeline.

### Don't use ADK evalset alone when...
- The requirement is a **continuous evaluation pipeline** running
  against live production traffic — ADK's evalset is a dev-time
  library invocation, not itself a managed, always-on pipeline. Task
  4.1 separates "creating continuous evaluation pipelines" from
  "evaluating against a golden dataset using ADK" as related but
  distinct considerations; treat them as complementary, not the same
  tool doing both jobs.
- The success criteria are domain-specific and don't fit what a golden-
  dataset response/retrieval comparison can express (e.g., a
  compliance rule, a business-logic correctness check on a specific
  tool call sequence) — that's a custom-autorater problem.

### Use Agent Platform Gen AI evaluation service when...
- You need **continuous evaluation pipelines** (task 4.1) running
  against an agent in production, without hand-building the pipeline
  infrastructure yourself.
- You want evaluation as a managed platform capability, consistent with
  how Agent Platform already handles Memory Bank and managed sessions
  for the same agents (task 3.1) — one platform surface for the agent's
  operational concerns.
- The evaluation metrics the platform exposes already cover what you
  need to measure — no need to build custom scoring logic.

### Don't use Agent Platform Gen AI evaluation service when...
- You're still in tight development iteration and want the fastest
  feedback loop tied directly to code changes — ADK's evalset, run
  locally/in CI against the dev codebase, is a better fit for that
  loop than a platform-managed service.
- Your success criteria are genuinely custom and the platform's built-in
  evaluation metrics don't capture them — forcing a domain-specific
  judgment into a generic platform metric produces a number that looks
  like evaluation but doesn't actually measure what matters. Build a
  custom autorater instead.

### Use custom autoraters when...
- Task 4.1's "established success criteria" for assessing an agent's
  tool execution are domain-specific — a compliance requirement, a
  business rule about acceptable tool-call sequences, a scoring rubric
  that doesn't map onto a generic response/retrieval quality metric.
- Neither ADK's evalset format nor the platform evaluation service's
  built-in metrics can express the judgment you need to make about
  agent output or behavior.
- You need an LLM-as-judge pattern tuned to your organization's specific
  quality bar, rather than a generic correctness/relevance score.

### Don't use custom autoraters when...
- A built-in tool already covers the need — building and maintaining
  bespoke rater logic has real ongoing cost (prompt-tuning the judge,
  validating the judge's own accuracy, keeping it in sync with agent
  changes) that isn't worth paying when ADK's evalset or the platform
  service already measures what you need.
- The team lacks the capacity to validate that the custom autorater
  itself is trustworthy — an unvalidated custom judge can silently give
  a false sense of evaluation coverage, which is worse than using a
  well-tested built-in metric that measures a narrower thing correctly.

## 5. How they combine in a real evaluation pipeline

Task 4.1's four bullets describe stages that compose into one pipeline
rather than four independent, competing choices:

```
  1. Build test sets                 2. Dev-loop evaluation
     (golden data, prompts,             (ADK evalset — response/
      edge cases)          ----->        retrieval quality against
                                          the golden dataset, run on
                                          every code change)
                                                    |
                                                    v
                                    3. Continuous evaluation pipeline
                                       (Agent Platform Gen AI evaluation
                                        service — tool-execution
                                        assessment against established
                                        success criteria, running
                                        continuously against staging/
                                        production traffic)
                                                    |
                                                    v
                                    4. Gap-fill with custom autoraters
                                       (wherever criteria are domain-
                                        specific and not covered by
                                        #2 or #3's built-in metrics —
                                        can plug into either stage)
```

A mature pipeline uses the golden dataset (stage 1) to drive both ADK
evalset checks in development (stage 2) and the platform's continuous
evaluation in production (stage 3), with custom autoraters (stage 4)
filling in wherever built-in metrics under- or mis-measure a specific
success criterion — most often around tool-execution correctness, which
task 4.1 calls out as its own assessment target distinct from response/
retrieval quality.

## 6. Exam traps to watch for

- Don't treat "ADK evaluation" and "continuous evaluation pipeline" as
  the same thing — task 4.1 names them as related but separate
  considerations; ADK's evalset is the dev-time golden-dataset tool,
  the continuous pipeline is a production-facing concern the Agent
  Platform Gen AI evaluation service is positioned to serve.
- A question about assessing "agent response and retrieval quality...
  using ADK" is pointing specifically at the evalset tool, per the
  guide's own explicit example.
- A question emphasizing "established success criteria" for tool
  execution, especially anything domain-specific, is more likely
  pointing at custom autoraters than a generic built-in metric.
- Don't forget golden data / prompts / edge cases (task 4.1's first
  bullet) is the input layer feeding all three evaluation approaches —
  it's not itself a fourth competing "evaluation framework," it's the
  test-set foundation the frameworks run against.
