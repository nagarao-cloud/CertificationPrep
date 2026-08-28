# Section 4 — additional practice questions (22)

> Evaluating and deploying agentic workflows (~22% of the exam). These
> 22 questions are **additional** to the 18 already at the end of
> `01-domains/SECTION-4-evaluate-deploy.md` — different scenarios, no
> wording overlap. Every option is explained inline.

## 4.1 — Evaluating agents in development and in production

**Q1.** A team builds a test set consisting only of prompts an
internal engineer wrote quickly, none of which were checked against a
verified correct answer. Is this test set "golden data"?
A) Yes — any prompt written by an internal engineer qualifies
B) No — golden data specifically requires curated, verified-correct
   input/expected-output pairs to serve as a scoring baseline; unverified
   prompts alone don't provide that
C) Yes, as long as there are enough of them
D) No — golden data must come exclusively from real production traffic

*Answer: B.* Verification against a known-correct expected output is
what makes data usable as a scoring baseline — quantity or authorship
alone doesn't substitute for that. (A) and (C) both ignore the
verification requirement. (D) is an overly narrow, fabricated sourcing
restriction — golden data can be authored deliberately, it doesn't
have to come from production traffic specifically.

**Q2.** A test set for a customer-support agent includes prompts like
"what if the user's message is in a language the agent wasn't tuned
for" and "what if the user asks two contradictory questions in the
same message." What role do these play in the test set?
A) They are golden data, since they have clear expected answers
B) They are edge cases — boundary/ambiguous/adversarial inputs meant
   to surface failure modes that typical "happy path" prompts wouldn't
C) They should be removed, since they don't reflect typical usage
D) They serve no purpose distinct from golden data

*Answer: B.* These are exactly the boundary/ambiguous scenario types
edge cases are meant to probe — not typical usage, but the inputs most
likely to reveal weaknesses. (A) conflates two distinct test-set
components; edge cases test resilience, golden data provides a
verified scoring baseline. (C) is the opposite of good practice — these
are valuable precisely because they're atypical. (D) understates their
distinct diagnostic purpose.

**Q3.** An agent's tool-execution evaluation shows it called the
correct tool with correct arguments, but then failed to correctly
incorporate the tool's returned result into its final answer. Where
does this failure sit?
A) It isn't measurable — tool execution success criteria only cover
   whether the right tool was called
B) It's still within tool-execution evaluation scope — task 4.1 frames
   success criteria as covering the right tool, correct arguments, AND
   correct incorporation of the result, not just the call itself
C) This can only be detected by response-quality evaluation, never
   tool-execution evaluation
D) This is exclusively a deployment/monitoring concern, not an
   evaluation concern

*Answer: B.* Task 4.1's tool-execution success criteria explicitly
extend past "was the right tool called" to include correctly
incorporating the result — this scenario is squarely within that
scope. (A) understates what tool-execution evaluation is meant to
cover. (C) draws an artificial boundary the guide doesn't draw; this
is naturally a tool-execution-evaluation finding even though it also
affects the final response. (D) misplaces a pre-launch evaluation
concern into a different phase.

**Q4.** A team wants to catch regressions automatically every time a
new version of their agent's prompt or tool configuration is deployed,
rather than only running evaluation manually before major releases.
What does task 4.1 call this kind of ongoing evaluation?
A) A one-time golden dataset check
B) A continuous evaluation pipeline
C) Cloud Trace instrumentation
D) A custom autorater, exclusively

*Answer: B.* Task 4.1 explicitly names "continuous evaluation
pipelines" as their own consideration, distinct from a single
pre-launch pass. (A) describes a one-time check, the opposite of what
this scenario needs. (C) is an observability/tracing tool for
production telemetry, not an evaluation-pipeline mechanism. (D) is one
possible evaluator type that could run inside such a pipeline, but
isn't itself the pipeline concept being asked about.

**Q5.** Which evaluation tooling choice is most appropriate for a team
that wants to assert, step by step, that their ADK-built agent calls
tool X before tool Y in a specific multi-step task, not just that the
final answer is correct?
A) A custom autorater built entirely from scratch
B) ADK evaluation tooling (evalset), which is purpose-built to assess
   ADK agent trajectories including tool-call sequencing
C) Cloud Logging
D) Model Armor

*Answer: B.* Asserting on the exact call sequence (a trajectory) is
exactly what ADK evalset tooling is designed for, since it directly
understands ADK agent structure. (A) is more engineering effort than
needed when purpose-built tooling already fits. (C) is a logging tool
for production events, not a pre-launch trajectory-assertion framework.
(D) is a content-safety tool, unrelated to trajectory evaluation.

**Q6.** A company operates agents built with several different
frameworks (some ADK, some custom, some low-code) and wants one
consistent, managed way to evaluate response and retrieval quality
across all of them without building bespoke tooling per framework.
Which fits best?
A) ADK evaluation tooling (evalset), used uniformly across all agent
   types regardless of framework
B) Agent Platform Gen AI evaluation service, designed for managed
   evaluation across heterogeneous agents
C) A separate custom autorater built independently for each framework
D) Cloud Trace

*Answer: B.* This directly matches the described fit for Agent
Platform's Gen AI evaluation service — a managed capability spanning
agents built with different underlying tooling. (A) is ADK-specific and
doesn't naturally extend to non-ADK agents. (C) is far more build/maintain
effort than needed when a managed cross-framework service already
fits. (D) is a production tracing tool, not an evaluation framework.

**Q7.** A team's evaluation shows their agent's final responses score
well, but a deeper look reveals the retrieved source documents backing
those responses are frequently only tangentially related to the
question. What does this indicate, and why does it matter that
response quality and retrieval quality are scored separately?
A) Nothing is wrong; a good final response is all that matters
B) It indicates a retrieval-quality problem that a blended score would
   have masked — separating the metrics lets the team correctly
   attribute the issue to the retrieval layer rather than assuming
   everything is fine because the final text reads well
C) This means the embedding model must be re-run on every request
D) Retrieval quality cannot be evaluated independently of response
   quality

*Answer: B.* This is exactly the failure-attribution value of scoring
these dimensions separately — a fluent final answer can mask an
underlying retrieval problem if only response quality is measured. (A)
ignores a real underlying quality risk (fragile grounding that may
fail on harder questions). (C) is an unsupported operational
prescription not implied by the finding. (D) is false — retrieval
quality is explicitly named as its own measurable evaluation dimension.

**Q8.** A team building a legal-document agent needs to score outputs
against nuanced, firm-specific citation-formatting and
confidentiality-flagging rules that no general-purpose evaluation
framework captures. What's the appropriate tooling choice, and why not
ADK evalset alone?
A) ADK evalset alone is sufficient for any nuanced, organization-specific
   criteria
B) A custom autorater, purpose-built to score against this
   organization's specific nuanced rules — general trajectory/structure-
   focused tooling like evalset isn't designed for this kind of
   domain-specific judgment
C) Cloud Trace, since it handles all quality assessment
D) No tooling can evaluate this; it must be done entirely manually
   forever

*Answer: B.* Custom autoraters exist precisely for nuanced,
organization-specific judgment criteria that off-the-shelf tooling
doesn't capture. (A) overstates evalset's scope, which is more
structural/trajectory-focused. (C) is an observability tool, not a
quality-scoring mechanism. (D) is false — this is exactly the gap
custom autoraters are meant to fill, not a permanently manual-only
problem.

## 4.2 — Deploying and scaling production workloads

**Q9.** A team wants to deploy a production agent with minimal
operational overhead, needing built-in session and memory integration
and agent-specific observability, and does not need deep low-level
infrastructure control. Which runtime fits best?
A) GKE
B) Agent Runtime, purpose-built for agent workloads with native
   session/memory and observability integration at low operational cost
C) Cloud Workstations
D) Cloud SQL

*Answer: B.* This matches Agent Runtime's defining fit — agent-native
managed features with the lowest ops burden among the named runtimes.
(A) GKE trades lower ops overhead for maximum infrastructure control,
the opposite tradeoff from what this scenario wants. (C) is a Section
2 dev-time sandbox tool, not a production deployment runtime. (D) is a
managed relational database, not a compute/deployment runtime for
agents at all.

**Q10.** A team needs the absolute simplest possible deployment for a
lightweight, stateless agent workload with unpredictable traffic that
should scale to zero when idle, and doesn't need any agent-specific
platform features. Which runtime fits best?
A) GKE, for its scale-to-zero simplicity
B) Cloud Run, general-purpose serverless with scale-to-zero and low
   operational overhead for simple, stateless workloads
C) Agent Runtime, exclusively, since it's the only valid choice for
   any agent workload
D) Cloud Workstations

*Answer: B.* Cloud Run's serverless, scale-to-zero model is the fit
for a simple, stateless, unpredictable-traffic workload with no need
for agent-specific platform features. (A) mischaracterizes GKE, which
is the higher-control, higher-ops-overhead option, not the "simplest
possible" one. (C) overstates Agent Runtime as the only valid choice —
the comparison table explicitly names three viable runtime options,
each with different fits. (D) is a dev-time sandbox tool, not a
production runtime choice.

**Q11.** An agent handling multi-step customer escalations
occasionally calls the same "check account status" tool five or six
times in a row with nearly identical parameters, never reaching a
final resolution. What should be checked first, and how does this
differ from a system failure?
A) An agent reasoning loop — repeated calls without forward progress —
   as opposed to a system failure, which implies an outright
   crash/error rather than repeated non-progressing attempts
B) Drift, since the agent's behavior has changed
C) Tool invocation latency, since a tool is involved
D) A hallucination, since the agent is generating unnecessary calls

*Answer: A.* Repeated calls with no forward progress is the defining
signature of an agent reasoning loop, distinct from an outright crash
(system failure). (B) drift describes gradual quality degradation
relative to a baseline over time, not a same-session repetition
pattern. (C) tool latency is about individual call slowness, not
repetition count. (D) hallucination is about ungrounded output
content, not a tool-calling repetition pattern.

**Q12.** Over several weeks, a team notices their agent's answers are
increasingly citing outdated policy language, even though nothing
about the agent's code or configuration changed. What's the most
likely underlying cause category, and what should be checked?
A) An agent reasoning loop in the current session
B) Drift — likely caused by the underlying grounding content becoming
   stale relative to what was current when the agent was last evaluated,
   even with no code changes
C) A one-time system failure
D) Tool invocation latency

*Answer: B.* Gradual degradation with no discrete triggering incident,
tied to stale source content over time, is a textbook drift scenario —
worth checking whether the retrieval corpus itself has gone stale. (A)
describes a same-session repetition pattern, not a gradual multi-week
trend. (C) implies a discrete crash/error event, not gradual change.
(D) is a speed symptom, unrelated to citation staleness.

**Q13.** Which Google Cloud Observability component would you check to
see the exact sequence and timing of every stage (tool call, model
inference, retrieval step) within one specific slow agent request?
A) Cloud Logging, since it stores every event
B) Cloud Trace, the distributed-tracing component that shows
   stage-by-stage timing within a single request's execution path
C) Model Armor
D) Agent Registry

*Answer: B.* Cloud Trace is explicitly named as the guide's
distributed-tracing tool — exactly what's needed to see per-stage
timing within one request. (A) Cloud Logging captures structured
events/errors but not the stage-by-stage timing breakdown of a single
request's path the way tracing does. (C) and (D) are unrelated —
content-safety and capability-discovery tools respectively.

**Q14.** A monitoring dashboard shows an agent's average response
latency climbing steadily, but only for requests that involve calling
an external partner API — all other request types remain fast. What
should be investigated?
A) Drift in the underlying model
B) Tool invocation latency specific to that external API dependency —
   the slowdown is localized to the tool-call step involving that
   specific downstream service
C) A reasoning loop, since latency is increasing
D) Hallucination rate

*Answer: B.* A slowdown localized specifically to calls involving one
external dependency is the defining pattern of tool invocation
latency, pointing at that downstream service or connectivity path
specifically. (A) drift is a correctness/quality symptom over time,
not a latency symptom. (C) reasoning loops present as repeated
non-progressing calls, not simply climbing latency on one call type.
(D) is an output-grounding concern, unrelated to latency.

**Q15.** Why should "the agent completed the task without throwing an
error" not be treated as sufficient evidence that the agent is
performing well in production?
A) It is sufficient evidence; no further monitoring is needed
B) Absence of an error doesn't rule out other failure modes the guide
   names separately — drift, reasoning loops that eventually
   self-terminate, logic errors, or hallucinated-but-fluent output —
   none of which necessarily throw an exception
C) Errors are the only failure mode this exam covers
D) This is only a concern for low-code agents, not custom agents

*Answer: B.* Task 4.2 names several distinct failure modes (drift,
reasoning loops, logic errors, hallucinations) that can occur without
an outright crash — "no error thrown" is a much lower bar than "the
agent is actually working well." (A) is the exact false-confidence
trap this question tests. (C) is false — the guide explicitly names
multiple non-crash failure categories. (D) is false — these monitoring
concerns apply to production agents generally, not a specific agent-
building approach.

**Q16.** A team debugging a customer complaint traces the issue to the
agent's own multi-step control-flow logic incorrectly deciding to skip
a required verification step before taking an action — the retrieved
data and the tool calls that did happen were all correct. What
category of failure is this?
A) A hallucination, since incorrect output resulted
B) A logic error — a flaw in the agent's reasoning/control-flow or
   orchestration design, distinct from ungrounded output content
C) Tool invocation latency
D) Drift

*Answer: B.* The described flaw is in the agent's own decision-making/
control-flow (skipping a required step), which is exactly the "logic
error" category — distinct from hallucination, which is about
ungrounded output content, not flawed control flow. (A) misattributes
a control-flow bug to a grounding problem; the retrieved data was
correct here. (C) is unrelated — no latency issue was described. (D)
implies gradual degradation over time, not a discrete control-flow
flaw.

**Q17.** A vendor claims their agent evaluation is complete because "it
passed all golden-data test cases before launch." Six months later, in
production, it exhibits gradual quality drift the pre-launch test
suite never caught. What does this illustrate about Section 4's
framing of evaluation and deployment?
A) Golden-data testing is worthless and should be abandoned
B) Evaluation and deployment/monitoring form a feedback loop —
   pre-launch golden-data testing alone is not sufficient; production
   monitoring findings (like drift) should feed back into ongoing,
   continuous evaluation rather than evaluation being a one-time gate
C) This means the vendor's ADK evalset configuration was technically
   broken
D) Drift cannot be detected by any monitoring approach, so this
   outcome was unavoidable

*Answer: B.* This is the explicit evaluation-deployment feedback-loop
framing — pre-launch testing is necessary but not sufficient; ongoing
production monitoring is what catches failure modes like drift that
only emerge over time. (A) overreacts — golden-data testing remains
valuable, it's just not the whole story. (C) is an unsupported leap
with no evidence given. (D) contradicts task 4.2's own framing, which
names drift as something to actively monitor and detect.

**Q18.** Which combination correctly matches a deployment runtime to
the scenario where it is the weakest fit, and explains why?
A) Agent Runtime is the weakest fit for a workload needing deep,
   low-level custom infrastructure control (e.g., custom GPU
   scheduling) — its managed abstraction trades away that control
   ceiling for lower ops overhead
B) Cloud Run is the weakest fit for a simple, stateless, low-traffic
   workload
C) GKE is the weakest fit for a team wanting maximum infrastructure
   control
D) Agent Runtime is the weakest fit for a workload needing native
   session/memory integration

*Answer: A.* Agent Runtime's managed, agent-native abstraction is a
strength for typical agent workloads but a genuine weakness when a
use case specifically needs infrastructure control beyond what a
managed platform exposes — GKE is the better fit there. (B) is
backwards — Cloud Run is the strong fit for exactly that scenario, not
the weak one. (C) is also backwards — GKE is the strong fit for
maximum control, not the weak one. (D) is backwards — native
session/memory integration is Agent Runtime's defining strength, not
a weakness.

**Q19.** A team notices their agent occasionally invents a plausible-
sounding citation to a policy document section that doesn't actually
exist in the retrieval corpus, while the rest of its answer is
accurately grounded. What is the correct way to categorize and
investigate this?
A) This is a tool invocation latency issue and should be investigated
   via Cloud Trace timing data
B) This is a hallucination — confident, fluent output not actually
   supported by retrieved content — and should be investigated by
   checking whether the citation is traceable to real retrieved
   source material, not by assessing how plausible it sounds
C) This is drift, and no further investigation beyond noting the trend
   is needed
D) This cannot occur in a RAG-grounded system by design

*Answer: B.* A fabricated-but-plausible citation not traceable to
actual retrieved content is a textbook hallucination — the fix is
checking actual groundedness, not plausibility. (A) misapplies a
latency-diagnosis tool to a correctness problem. (C) mischaracterizes
a single fabricated detail as a gradual trend without evidence of that
pattern. (D) is a dangerous false assumption — RAG grounding reduces
but does not eliminate hallucination risk.

**Q20.** True or False: On the current PAA exam guide, "Agent Engine"
is simply an alternate, equally-acceptable name for what task 4.2
calls a deployment runtime option.
A) True — either name is acceptable exam terminology
B) False — the guide's current, correct name is Agent Runtime; "Agent
   Engine" is the pre-rename name, worth knowing only to recognize the
   rename itself, not as an interchangeable current term
C) True, but only when discussing GKE specifically
D) False — because neither name appears in task 4.2 at all

*Answer: B.* This is the most heavily emphasized currency correction
in this folder, restated here for the deployment-runtime context
specifically. (A) treats the two names as interchangeable, which is
the trap. (C) is a fabricated, irrelevant carve-out. (D) is false —
Agent Runtime very much appears in task 4.2 as a named deployment
runtime option.

**Q21.** A team building a continuous evaluation pipeline wants it to
automatically re-run whenever a new version of the agent's underlying
prompt configuration is published, using both golden data and a
curated edge-case set, and to flag any tool-execution success-criteria
regression. Which task 4.1 considerations does this design correctly
combine?
A) Only golden data — edge cases and tool-execution criteria are
   unrelated to continuous pipelines
B) Golden data (scoring baseline), edge cases (failure-mode coverage),
   continuous evaluation pipelines (triggered re-runs), and
   tool-execution success criteria (regression detection) — all four
   task 4.1 considerations working together
C) Only tool-execution success criteria; golden data and edge cases
   are strictly pre-launch-only concepts with no role in ongoing pipelines
D) This combination is redundant; any one of these alone would be
   equally effective

*Answer: B.* Task 4.1's four considerations (test-set construction with
golden data and edge cases, continuous pipelines, evaluation
framework/tooling choice, and evaluating against a golden dataset for
response/retrieval quality) are designed to work together, not as
mutually exclusive alternatives — this design uses them in
combination correctly. (A) and (C) both artificially restrict test-set
components to a single phase they aren't actually limited to. (D)
understates what each component distinctly contributes — a regression-
detection pipeline without a verified baseline (golden data) or
adversarial coverage (edge cases) would be far weaker.

**Q22.** A team is deciding between deploying their production agent
to GKE versus Cloud Run versus Agent Runtime, and frames the decision
purely as "which one is generally the best runtime." What's the flaw
in this framing, per the Section 4 comparison approach used
throughout this folder?
A) There is no flaw; one of the three is always objectively best
B) The comparison should be scenario-driven — control needs, ops
   capacity, agent-native feature needs, cost, and workload shape —
   not a search for one universally "best" runtime, since each of the
   three has a genuinely different best-fit scenario
C) GKE is always the correct answer regardless of scenario
D) Agent Runtime is always the correct answer regardless of scenario,
   since it is agent-specific

*Answer: B.* This mirrors the exam's consistent tradeoff-driven
framing throughout this folder — deployment-runtime selection is
explicitly use-case/requirements/cost-driven (task 4.2's own phrasing),
not a search for one universal winner. (A), (C), and (D) all assume a
single "always correct" answer, which contradicts the comparison
table's own scenario-specific fits for all three runtimes.
