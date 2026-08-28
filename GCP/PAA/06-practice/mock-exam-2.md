# Mock Exam 2 — shorter drill (40 questions)

> A second, shorter practice exam — half the length of Mock Exam 1,
> same proportional section weighting. Distribution: **Section 1 (5) ·
> Section 2 (7) · Section 3 (13) · Section 4 (9) · Section 5 (6)** —
> matching 13/17/33/22/15%. Every option is explained inline. No
> question here duplicates wording from `mock-exam-1.md` or any
> `section-N-questions.md` file — different scenarios throughout.

---

## Section 1 — Building agents using low-code tools (Q1–Q5)

**Q1.** A car-rental company wants an agent that walks a customer
through choosing a vehicle class, an optional insurance add-on, and a
pickup location, branching the insurance questions differently
depending on the vehicle class selected, with the booking blocked
until all three choices are made. Which low-code builder fits?
A) Agent Designer
B) CX Agent Studio, for its state-based branching and completeness
   gating
C) Either tool, interchangeably
D) A custom ADK agent, since branching always requires code

*Answer: B.* Multi-step, value-dependent branching with a hard
completeness gate is exactly CX Agent Studio's page/transition-route/
event-handler model. (A) lacks that explicit structure. (C) ignores a
real paradigm difference. (D) overreaches for a use case squarely
within low-code.

**Q2.** A company wants its Gemini Enterprise agent to never disclose
internal cost or pricing-formula details to a customer, no matter how
the question is phrased, across the whole conversation. Where should
this be enforced?
A) A transition route
B) A system instruction defining a persistent scope boundary
C) A single few-shot example
D) A no-match event handler

*Answer: B.* A standing, conversation-wide confidentiality boundary
belongs in system instructions. (A) and (D) are structural, per-turn
CX Agent Studio mechanisms, not a persistent rule. (C) shapes output
format for one prompt, not an ongoing constraint.

**Q3.** A support team wants every agent reply that includes a
suggested next step to follow one exact format: a one-line summary
followed by a numbered list of steps. Which technique guarantees this
most directly?
A) Chain-of-thought prompting
B) Few-shot prompting, showing an example in the exact desired format
C) Increasing the model's temperature
D) Adding more CX Agent Studio transition routes

*Answer: B.* Few-shot examples are the direct tool for pinning exact
output structure. (A) targets reasoning depth, not format. (C)
increases randomness, working against consistent formatting. (D) is
an unrelated structural concept.

**Q4.** A conference speaker states: "Vertex AI Agent Builder is
Google's low-code platform, and it's what this certification tests."
Is this accurate?
A) Yes, that's the correct current branding
B) No — that branding doesn't appear in the exam guide at all; the
   actual platform is Gemini Enterprise, built with Agent Designer and
   CX Agent Studio
C) Yes, but only for agents built before this certification existed
D) No — the correct name is Agent Runtime

*Answer: B.* This is a direct currency trap. (A) and (C) both accept
the wrong branding. (D) confuses this with an entirely different tool
— Agent Runtime is the Section 3/4 deployment environment, not a
low-code platform name.

**Q5.** A wholesale distributor wants its Gemini Enterprise agent
grounded on both a structured product-inventory spreadsheet and a set
of unstructured supplier contract PDFs. Is combining both data shapes
supported per task 1.2?
A) No — Agent Search only supports one data shape at a time
B) Yes — task 1.2 covers securely connecting proprietary data sources
   generally, and nothing restricts an agent to a single data shape
C) No — structured data always requires a custom ADK agent
D) Yes, but only if both are converted to video format first

*Answer: B.* Task 1.2's bullets on connecting proprietary data sources
and on ingesting/processing unstructured content are complementary,
not mutually exclusive. (A) invents a restriction not in the guide.
(C) unnecessarily escalates to custom code for a Section 1 use case.
(D) is nonsensical.

---

## Section 2 — Using coding agents for application development (Q6–Q12)

**Q6.** A coding agent notices a service is making the same external
API call redundantly on every request and adds a caching layer to
avoid the repeated calls, cutting latency with no behavior change.
Which task 2.1 activity is this?
A) Patching an application-layer vulnerability
B) Optimizing execution runtimes
C) Configuring a secure sandbox
D) Creating a plugin

*Answer: B.* A performance-improving rewrite with no security
component is exactly "optimize execution runtimes." (A) is a
different named activity. (C) and (D) are unrelated to what the agent
did to the code.

**Q7.** A coding agent finds and fixes a SQL injection vulnerability
in a form-handling endpoint. Which task 2.1 activity is this?
A) Optimizing execution runtimes
B) Patching an application-layer vulnerability
C) Using a secure sandbox
D) Configuring an MCP server

*Answer: B.* A SQL injection fix is a source-code-level security fix
— exactly "patch application-layer vulnerabilities." (A) is a
performance activity. (C) and (D) are unrelated configuration
concerns, not the fix itself.

**Q8.** A data-science team wants a consistent, pre-configured
notebook-style development environment for every team member, with
minimal setup and no desire to operate Kubernetes themselves. Which
sandbox option fits?
A) GKE, for maximum infrastructure control
B) Cloud Workstations, for managed, pre-configured, isolated dev
   environments without Kubernetes-native operational overhead
C) Antigravity App, since sandboxing doesn't apply to it
D) Neither option supports notebook-style environments

*Answer: B.* This matches Cloud Workstations' fit exactly — managed,
ready-to-go environments without extra Kubernetes operational
overhead. (A) trades away the "minimal setup" requirement for control
this team doesn't need. (C) and (D) are false.

**Q9.** A team wants every coding-agent task's internal log output to
follow one internal structured-logging convention, without restating
the convention in every prompt. Which primitive fits?
A) A rule
B) A skill
C) A subagent
D) An MCP server

*Answer: B.* Packaging a reusable convention applied consistently
without per-prompt restatement is a skill's purpose. (A) rules
prohibit, they don't encode conventions. (C) delegates scoped work.
(D) connects to external tools/data, unrelated to a logging convention.

**Q10.** A team states: "no coding agent may ever delete files under
`/test-fixtures/`, regardless of task or instruction." Which primitive
expresses this?
A) A skill
B) A rule
C) A plugin
D) The SDK surface

*Answer: B.* A hard, non-negotiable prohibition is exactly a rule. (A)
encodes how-to conventions, not prohibitions. (C) adds capability. (D)
is an embedding surface, unrelated to behavior constraints.

**Q11.** A performance-benchmarking task is split off to a narrowly
scoped worker that only runs load tests and reports results, separate
from the primary agent handling the actual code change. What is the
benchmarking worker best described as?
A) A plugin
B) A subagent
C) A rule
D) An extensions hook

*Answer: B.* A dedicated, narrower-scoped worker for one subtask is
exactly a subagent. (A) adds capability generally. (C) constrains
behavior. (D) is a lifecycle trigger point, not a delegated worker.

**Q12.** A holding company with several business units wants a
consistent, org-wide policy for which coding-agent tasks require
approval, applied and tracked across every unit, once agents are
already in daily use. Which tool provides this?
A) The Antigravity App surface
B) Agents CLI
C) A shared system instruction repeated per unit
D) A shared MCP server

*Answer: B.* This is exactly Agents CLI's build/scale/govern/optimize
role across an organization. (A) is a single-developer surface. (C)
doesn't provide governance/tracking. (D) connects to one external
tool, unrelated to org-wide policy tracking.

---

## Section 3 — Developing custom agents (Q13–Q25)

**Q13.** A voice-assistant feature needs to recognize a small, fixed
set of spoken commands with near-instant response time on constrained
hardware. Which size-axis choice fits?
A) LLM
B) SLM, for its latency and resource-efficiency advantage on a narrow,
   fixed command set
C) Model size doesn't matter for voice interfaces
D) This always requires a self-hosted model

*Answer: B.* Narrow scope plus a hard real-time latency requirement is
a strong SLM fit, independent of hosting. (A) over-provisions
capability at a latency cost this use case can't afford. (C) is false.
(D) conflates size with a separate hosting-axis decision.

**Q14.** A fast-growing e-commerce company wants the best available
reasoning quality for an open-ended shopping-assistant chatbot, has a
lean engineering team with no ML operations capacity, and prioritizes
launching quickly. Which combination fits?
A) Self-hosted, OSS, SLM
B) SaaS, proprietary, LLM
C) Self-hosted, proprietary, LLM
D) The self-hosted-vs-SaaS axis doesn't matter here

*Answer: B.* No ops capacity plus a priority on capability and speed
points to SaaS and a capable general LLM. (A) and (C) both require
self-hosting, conflicting with "no ML operations capacity." (D) is
false — ops capacity directly drives this axis.

**Q15.** A team is deciding whether a use case needing coordinated
handoffs between three specialized agents, each with different tool
access, should be built low-code or with ADK. What's the right call?
A) Low-code, since Gemini Enterprise always scales to any complexity
B) ADK, since multi-agent orchestration with distinct per-agent tool
   access and coordinated handoffs is beyond what low-code state
   machines are designed to express
C) Neither — this always requires a fully manual, non-agentic solution
D) Low-code, because Agent Search handles multi-agent coordination
   automatically

*Answer: B.* Coordinated multi-agent orchestration with distinct
scoped tool access per agent is squarely a custom-code (ADK) use case,
beyond low-code's single-agent state-machine model. (A) overstates
low-code's scope. (C) is false. (D) misapplies Agent Search, a
single-agent grounding connector, to a multi-agent orchestration need.

**Q16.** A multi-step travel-booking wizard needs to remember, only
within the current booking session, which flight and hotel the user
has tentatively selected so far. Where should this be tracked?
A) Agent Platform Memory Bank
B) A managed session, scoped to this one interaction
C) Agent Registry
D) Vector Search 1.0

*Answer: B.* This is single-interaction state — a managed session's
exact purpose. (A) is for durable, cross-session facts, more than
needed here. (C) is a capability catalog. (D) is a retrieval mechanism,
unrelated to wizard state.

**Q17.** A finance agent should be permitted to read the general
ledger but never write, update, or post entries to it, regardless of
what a user requests. Which mechanism enforces this?
A) Reranking configuration
B) Agent Identity, scoped to read-only access on the ledger
C) A larger embedding model
D) Agent Runtime deployment settings

*Answer: B.* Task 3.2 names Agent Identity as the permission-scoping
mechanism, independent of user requests. (A) is a relevance-ordering
step. (C) affects retrieval quality, not access control. (D) is a
deployment setting, not a permissions mechanism.

**Q18.** A custom agent needs to query an internal HR system with a
proprietary API and no existing prebuilt connector. What's the correct
approach?
A) This cannot be integrated under any circumstances
B) Build a custom integration layer (a custom MCP server) exposing the
   needed HR operations, then register it in Agent Registry for
   discovery and reuse
C) Give the agent direct raw database credentials with no integration
   layer
D) Use A2A to have another agent proxy the HR queries at runtime

*Answer: B.* Task 3.2 explicitly covers custom integration layers/API
integrations for exactly this gap. (A) is false. (C) skips the
integration-layer/registry-reuse pattern and creates an unscoped
credential risk. (D) misuses A2A for what is fundamentally a
tool-integration problem.

**Q19.** A team needs to query BigQuery from a custom agent and finds
a Google Cloud MCP Server already exposes this capability. Should they
build a custom connector instead?
A) Yes, always build custom regardless of what's prebuilt
B) No — using the prebuilt Google Cloud MCP Server avoids unnecessary
   duplicated integration effort
C) Yes, because Google Cloud MCP Servers cannot connect to BigQuery
D) It doesn't matter; Agent Registry only tracks custom capabilities

*Answer: B.* When a prebuilt connector already covers the need,
reusing it avoids unnecessary custom-build effort. (A) ignores the
point of prebuilt capabilities. (C) is false — BigQuery is an in-scope
data service and a natural MCP-connector target. (D) is false — Agent
Registry catalogs both prebuilt and custom capabilities.

**Q20.** A symptom-checker agent providing preliminary triage
guidance retrieves candidate reference articles via similarity search
before drafting its response. Why would a reranking step be
particularly justified here, despite the added latency?
A) Reranking is mandatory for any medical-related application by law
B) The precision stakes are high — a wrong or imprecise top-ranked
   reference could lead to poor triage guidance — so the extra
   latency/cost is justified to improve top-result ordering
C) Reranking replaces the need for any grounding data at all
D) Reranking eliminates the need for Agent Identity scoping

*Answer: B.* This matches the precision-vs-latency tradeoff — high
stakes in getting the top result right justify reranking's added cost.
(A) fabricates a legal mandate not in the guide. (C) and (D)
mischaracterize what reranking does.

**Q21.** A team migrates their vector database to a new embedding
model for better domain accuracy, but only re-embeds newly added
documents going forward, leaving the existing indexed corpus embedded
with the old model. What's the risk?
A) No risk — embedding models are always interchangeable across a
   vector index
B) Retrieval quality silently degrades because vectors from different
   embedding models aren't comparable in the same similarity space
C) The vector database automatically re-embeds old content in the
   background at no cost
D) This only affects reranking, never the initial similarity search

*Answer: B.* Mixed embedding spaces silently produce poor similarity
results rather than an obvious error — a real migration trap. (A) is
the exact misconception this tests. (C) is a fabricated automatic
behavior. (D) is false — it affects the initial similarity search
itself, before reranking even runs.

**Q22.** A customer submits a support request via chat, and the agent
needs to hand the request to a separate, specialized billing-dispute
agent for deeper investigation, expecting a structured result back.
Which protocol fits this handoff, as opposed to a simple internal
ticketing-tool lookup (which would use a different protocol)?
A) MCP for the handoff; A2A for the ticketing-tool lookup
B) A2A for the handoff (agent-to-agent); MCP for the ticketing-tool
   lookup (agent-to-tool)
C) MCP for both
D) A2A for both

*Answer: B.* This is the core MCP-versus-A2A distinction applied to
two different connections in the same scenario. (A) reverses the
pairing. (C) misapplies MCP to an agent-to-agent coordination need.
(D) misapplies A2A to a simple tool lookup.

**Q23.** Three independent compliance-check agents each verify a
different regulatory requirement against the same transaction
concurrently, with no agent depending on another's output, and results
are simply collected once all three finish. Which topology fits?
A) Sequential
B) Parallel
C) Graph workflow
D) None of these apply

*Answer: B.* Independent, concurrent checks with no ordering
dependency are the canonical parallel-topology case. (A) unnecessarily
serializes independent work. (C) adds unneeded branching/looping
machinery. (D) is false.

**Q24.** A customer-complaint triage workflow classifies severity,
then conditionally routes to either a fast-track resolution agent or
an escalation agent depending on the severity score, with a possible
loop back to re-classify if the escalation agent determines the
initial severity score was wrong. Which topology fits?
A) Sequential
B) Parallel
C) Graph workflow
D) A2A alone, without any topology

*Answer: C.* Conditional branching plus a possible loop back based on
an intermediate result is exactly graph workflow's fit. (A) and (B)
can't express the conditional loop. (D) conflates a coordination
protocol with a topology.

**Q25.** True or False: "Agent Engine" is the correct, current name to
use on this exam for the managed agent deployment/execution
environment.
A) True — it's the currently correct name
B) False — the current correct name is Agent Runtime; "Agent Engine"
   is the outdated, pre-rename name, worth knowing only to recognize
   the rename itself
C) True, but only when discussing multi-agent orchestration
   specifically
D) False — because "Agent Engine" never existed as a name for
   anything in this space

*Answer: B.* This is the folder's most-repeated currency correction,
tested here from Section 3's orchestration angle. (A) and (C) both
treat the outdated name as acceptable. (D) overstates the correction —
"Agent Engine" was the real prior name, it's just not current
terminology.

---

## Section 4 — Evaluating and deploying agentic workflows (Q26–Q34)

**Q26.** A team builds a set of chatbot test prompts, each paired with
an answer independently verified by a subject-matter expert as
correct, to serve as a scoring baseline. What is this test set called?
A) Edge cases
B) Golden data
C) Unfiltered production logs
D) A custom autorater

*Answer: B.* Curated, verified-correct pairs used as a scoring
baseline is exactly golden data's definition. (A) are boundary/
adversarial inputs, a different component. (C) is raw, unverified
traffic. (D) is an evaluator tool, not a test-set component.

**Q27.** A team adds test cases specifically designed to attempt
prompt-injection style manipulation of their agent's instructions,
alongside their normal test prompts. What role do these play?
A) They are golden data, since they have clear expected outcomes
B) They are edge cases — adversarial inputs meant to surface failure
   modes typical prompts wouldn't reveal
C) They should be excluded since they don't reflect real usage
D) They serve no purpose distinct from golden data

*Answer: B.* Adversarial, boundary-condition inputs are exactly what
edge cases are for. (A) conflates two distinct test-set components. (C)
is the opposite of good practice — these are valuable precisely
because they're atypical. (D) understates their distinct purpose.

**Q28.** A team using ADK wants to verify their booking agent checks
availability before confirming a reservation, not the reverse order,
across many test scenarios. Which tooling fits first?
A) A custom autorater built entirely from scratch
B) ADK evaluation tooling (evalset), purpose-built to assess ADK agent
   trajectories including call ordering
C) Cloud Logging
D) Model Armor

*Answer: B.* Asserting on call-order trajectories is exactly ADK
evalset tooling's fit. (A) is more effort than needed when purpose-built
tooling already covers this. (C) is a production logging tool, not a
pre-launch trajectory framework. (D) is a content-safety tool.

**Q29.** A marketing team's agent generates ad copy, and the team
needs to score outputs against nuanced, brand-specific voice and
legal-disclaimer requirements that no general-purpose evaluation tool
captures. What fits?
A) ADK evaluation tooling (evalset) alone, since it covers all
   evaluation needs by default
B) A custom autorater, purpose-built to score against these specific
   nuanced criteria
C) Cloud Trace, since it handles all quality assessment
D) No tooling is appropriate for nuanced criteria

*Answer: B.* This is exactly the fit for custom autoraters. (A) is
more structure/trajectory-focused, not this kind of nuanced judgment.
(C) is an observability tool, unrelated. (D) is false — this is
precisely the use case custom autoraters address.

**Q30.** A team needs low operational overhead, native session/memory
integration, and agent-specific observability for a production
deployment. Which runtime fits best?
A) GKE
B) Cloud Run
C) Agent Runtime
D) Cloud Workstations

*Answer: C.* This is Agent Runtime's defining fit among the three
named runtimes. (A) has the highest ops overhead with no agent-native
abstractions. (B) is general-purpose serverless, lacking agent-specific
features. (D) is a dev-time sandbox, not a production runtime.

**Q31.** A team needs deep, low-level infrastructure control —
custom autoscaling logic and specialized hardware scheduling — for a
production agent, and is already standardized on Kubernetes elsewhere.
Which runtime fits best?
A) Cloud Run
B) Agent Runtime
C) GKE
D) None of these support custom autoscaling logic

*Answer: C.* Deep infrastructure control and existing Kubernetes
standardization is GKE's specific fit among the three. (A) and (B) are
both more managed/abstracted, with a lower control ceiling. (D) is
false.

**Q32.** An agent keeps calling the same knowledge-base lookup tool
with near-identical parameters over and over in one session, never
producing a final answer. What should be investigated first?
A) Drift
B) An agent reasoning loop — repeated calls without forward progress
C) Tool invocation latency
D) A one-time system failure

*Answer: B.* Repeated calls with no forward progress in one session is
the defining reasoning-loop signature. (A) is a gradual, multi-session
degradation pattern. (C) is about per-call slowness, not repetition.
(D) implies an outright crash, not repeated attempts.

**Q33.** Over several months, an agent's answers increasingly cite an
outdated version of a company policy, even though no code or
configuration changed. What's the likely cause category?
A) An agent reasoning loop
B) Drift — likely from the underlying grounding content becoming stale
   relative to what was current at last evaluation
C) A one-time system failure
D) Tool invocation latency

*Answer: B.* Gradual degradation with no discrete triggering incident,
tied to content staleness over time, is a textbook drift scenario. (A)
is a same-session repetition pattern. (C) implies a discrete crash.
(D) is a speed symptom, unrelated to citation staleness.

**Q34.** A debugging session traces a customer-facing error to the
agent's own control-flow logic incorrectly skipping a required
approval step, while all retrieved data and tool calls that did occur
were accurate. What category of failure is this?
A) A hallucination, since the outcome was wrong
B) A logic error — a flaw in the agent's reasoning/control-flow or
   orchestration design, distinct from ungrounded output content
C) Tool invocation latency
D) Drift

*Answer: B.* A flaw in the agent's own decision-making/control-flow is
exactly a logic error, distinct from hallucination (which concerns
ungrounded output content, not flawed control flow). (A) misattributes
a control-flow bug to a grounding problem. (C) and (D) are unrelated —
no latency or gradual-degradation symptom was described.

---

## Section 5 — Securing and governing agentic workflows (Q35–Q40)

**Q35.** An agent needs to call a third-party shipping-carrier API on
a customer's behalf. Which mechanism handles obtaining and refreshing
the credentials for that call?
A) Model Armor
B) Auth Manager, using OAuth 2.0
C) Agent Registry
D) HITL

*Answer: B.* Task 5.1 explicitly names OAuth 2.0 via Auth Manager for
agent-to-tool API call authentication. (A) screens content, it doesn't
manage authentication. (C) is a capability catalog. (D) is a
per-action human checkpoint, not authentication.

**Q36.** A platform team defines a boundary stating a specific agent
may never access the executive-compensation dataset, regardless of
what it is later asked or configured to do. Which mechanism is this?
A) Agent Gateway traffic rules
B) A PAB (principal access boundary) policy, configured via Agent
   Identity
C) Model Armor content filtering
D) HITL approval

*Answer: B.* This is exactly PAB's role — a hard outer access boundary
configured through Agent Identity, independent of runtime prompts. (A)
monitors traffic, it doesn't define the boundary. (C) screens content,
not data-access limits. (D) is a per-action checkpoint, a different
(complementary) mechanism.

**Q37.** A security team wants to detect that an agent has suddenly
started making calls to a service it has never interacted with before,
outside its normal behavioral pattern. Which tool provides this?
A) Auth Manager
B) Agent Gateway
C) Agent Identity
D) Skill Registry

*Answer: B.* Traffic and behavior-pattern monitoring is Agent
Gateway's defining role. (A) handles authentication. (C) defines
allowed access, not observed behavior. (D) is unrelated to traffic
monitoring.

**Q38.** A multi-hop chain has a user request pass through Agent A,
then a tool call, then Agent B, then a downstream service. What should
the effective access at each hop reflect?
A) A newly-created broad shared identity at each hop, for simplicity
B) The originating principal's actual, bounded permission scope,
   correctly carried through — never expanded — at each hop, per
   identity propagation
C) Whatever access level is fastest to configure at each hop
D) The most powerful identity available, to avoid permission-denied
   errors mid-chain

*Answer: B.* This is identity propagation — preserving, never
expanding, the originating scope across every hop. (A) and (D) both
describe the anti-pattern this principle prevents. (C) optimizes for
convenience over correctness, risking the same anti-pattern.

**Q39.** A team scopes HITL approval narrowly to two action types —
permanently deleting a user account and transferring funds above a
threshold — while letting all other actions, including read-only
lookups, proceed autonomously under standing Agent Gateway monitoring.
Is this well-designed, per Section 5.2's principles?
A) No — HITL should apply to every action without exception
B) Yes — this matches the guidance to scope HITL to genuinely
   high-stakes/irreversible actions while lower-stakes actions proceed
   autonomously under standing automated controls
C) No — Agent Gateway alone is never sufficient for any action
D) Yes, but only because account deletion is involved; fund transfers
   should always use a separate mechanism

*Answer: B.* This matches the recommended scoping exactly — HITL
reserved for genuinely high-stakes actions, standing automated
controls covering the rest. (A) is the flagged over-application
anti-pattern. (C) overstates a limitation not supported by the guide.
(D) invents an unsupported mechanism split between the two named
actions.

**Q40.** A content-moderation review shows an agent's proposed public
post passed every Model Armor policy check. Does this alone mean it's
safe for the agent to publish the post autonomously if the post also
involves an irreversible, high-visibility action (e.g., posting to an
official company account)?
A) Yes — passing content-safety screening is sufficient for any action
B) Not necessarily — Model Armor screens content for policy
   violations, a different concern from whether a specific
   consequential, hard-to-reverse action should execute autonomously;
   that judgment is what HITL exists to add
C) Yes, but only if the agent was built with ADK
D) No — Model Armor cannot be used for any public-facing content

*Answer: B.* Content-policy compliance and action-consequence judgment
are different concerns; a policy-compliant post doesn't establish that
publishing it irreversibly and publicly is safe without a human
checkpoint. (A) conflates the two concerns. (C) is a fabricated
tool-specific carve-out. (D) is false and unsupported.
