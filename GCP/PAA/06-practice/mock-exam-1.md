# Mock Exam 1 — full-length practice exam (80 questions)

> Simulates the real PAA exam format: ~80 multiple-choice questions,
> intended to be taken in one ~3-hour sitting. Questions are
> distributed proportional to section weight: **Section 1 (10) ·
> Section 2 (14) · Section 3 (26) · Section 4 (18) · Section 5 (12)**
> — matching the guide's 13/17/33/22/15% weighting. Every option is
> explained inline immediately after its question, so numbering can
> never drift out of sync with a separate key. None of these 80
> questions duplicate wording from the `section-N-questions.md` files
> or from `mock-exam-2.md` — different scenarios throughout, though
> some test the same underlying concepts (expected and unavoidable on
> a 5-section, 80-question exam).

---

## Section 1 — Building agents using low-code tools (Q1–Q10)

**Q1.** A bank wants a loan-application intake agent that collects
income, employment status, and requested amount across several turns,
branching into different verification questions depending on
employment status, with a hard requirement that the application cannot
be submitted until all fields are collected. Which low-code builder
fits?
A) Agent Designer
B) CX Agent Studio
C) Either, with no meaningful difference
D) Custom ADK, since branching always requires code

*Answer: B.* Multi-turn collection, value-based branching, and a hard
completeness gate are exactly CX Agent Studio's state-machine
strengths (pages, transition routes, event handlers). (A) lacks that
explicit structural model. (C) ignores a real design-paradigm
difference. (D) overreaches — this remains a low-code use case.

**Q2.** A legal-adjacent company wants its Gemini Enterprise agent to
never offer specific legal advice, under any phrasing of the question,
across the entire conversation. Where should this constraint live?
A) A transition route
B) A system instruction defining a persistent behavioral boundary
C) A single few-shot example
D) A no-input event handler

*Answer: B.* A hard, always-on scope boundary belongs in system
instructions, the persistent top-level contract. (A) and (D) are
structural CX Agent Studio mechanisms unrelated to a standing
behavioral rule. (C) shapes output format for a specific prompt, not a
conversation-wide constraint.

**Q3.** A user goes silent for the configured timeout window mid-flow.
Which mechanism should reprompt them?
A) A transition route
B) A no-input event handler
C) A no-match event handler
D) A system instruction alone

*Answer: B.* No-input specifically fires on silence/timeout. (A)
requires a matched intent/condition, which silence isn't. (C) is a
different event (an utterance was given but didn't match), not
silence. (D) relies on unreliable instruction-following for something
that has a purpose-built structural mechanism.

**Q4.** An enterprise wants a Gemini Enterprise agent to answer
questions about content covered in its internal onboarding video
library. Connecting the video files' storage location alone is
insufficient. Why?
A) Video cannot be stored in any Google Cloud service
B) The content must be ingested/processed before it's retrievable and
   groundable — storage alone doesn't make it discoverable
C) Gemini models cannot process video under any circumstances
D) Agent Search rejects any multimodal source automatically

*Answer: B.* Task 1.2 names ingesting/processing unstructured
multimodal data as necessary before it's usable for grounding. (A) is
false. (C) is false — Gemini models are natively multimodal, but
ingestion/indexing still has to run. (D) contradicts the guide's own
multimodal-ingestion bullet.

**Q5.** A multi-tenant SaaS company's Gemini Enterprise agent answers
questions grounded on each tenant's own documents. What must be true
of the retrieval configuration to prevent one tenant's agent instance
from surfacing another tenant's content?
A) Nothing extra is needed; Agent Search separates tenants
   automatically with no configuration
B) Agent Search's retrieval must be scoped/configured to respect the
   underlying source data's access boundaries per tenant
C) This is impossible with a low-code tool and requires custom ADK
D) CX Agent Studio event handlers enforce this automatically

*Answer: B.* Agent Search enforces whatever access scoping the
underlying data source is configured with — that scoping must actually
be set up correctly per tenant; it isn't automatic with zero
configuration. (A) overstates what happens with no configuration
effort. (C) is false — this is a standard low-code grounding-configuration
concern. (D) is unrelated — event handlers are a conversational-flow
mechanism, not a data-access-scoping one.

**Q6.** A team needs every response to follow an exact, specific
bullet-list structure with fixed labels. Which technique most directly
guarantees this?
A) Chain-of-thought prompting
B) Few-shot prompting, showing the exact desired structure
C) Increasing response length limits
D) Adding more CX Agent Studio pages

*Answer: B.* Few-shot examples are the direct tool for pinning exact
output structure. (A) targets reasoning depth, not format. (C) and (D)
don't address output structure at all.

**Q7.** A tax-preparation agent must walk through several interacting
deduction rules before arriving at a final number, and testers report
it sometimes skips a rule. What technique addresses this most
directly?
A) Few-shot prompting alone
B) Chain-of-thought prompting
C) Reducing the number of transition routes
D) Switching from Agent Designer to CX Agent Studio with no other change

*Answer: B.* Multi-step reasoning failures are exactly what
chain-of-thought prompting addresses. (A) helps format consistency,
not reasoning completeness. (C) and (D) are structural changes
unrelated to single-response reasoning quality.

**Q8.** Which of these is the exam-guide-correct current name for the
enterprise-data grounding service, distinct from a fabricated
distractor name?
A) Search AI Enterprise
B) Agent Search
C) Vertex AI Grounding Service
D) Gemini Enterprise Search Connector

*Answer: B.* This is the guide's own current name (formerly Vertex AI
Search). (A), (C), and (D) are all plausible-sounding but fabricated
names that do not appear in the exam guide.

**Q9.** A page has three transition routes that could all plausibly
match the utterance "I need help with my bill" — one broad ("help"),
one medium ("billing"), one exact ("dispute a charge on my bill").
What determines which one fires?
A) They all fire and merge into one response
B) Configured route priority/ordering — more specific routes should be
   ordered ahead of broader ones so a broad catch-all doesn't steal the
   turn
C) Alphabetical order of the route names
D) A random selection by the model

*Answer: B.* Routes evaluate in a defined priority order; ordering
specific routes ahead of broad ones prevents a catch-all from stealing
turns meant for a more precise match. (A), (C), (D) are all fabricated
behaviors.

**Q10.** An HR team's onboarding agent, originally a simple FAQ bot in
Agent Designer, has grown to include dozens of interacting eligibility
conditions, multi-department routing, and stateful multi-page forms.
What does this growth most directly suggest?
A) Nothing — keep expanding it indefinitely within Agent Designer
B) It may be a candidate for CX Agent Studio's explicit state-machine
   structure, or, if complexity keeps growing further, for evaluation
   against a custom ADK build (Section 3)
C) Switch immediately to a completely different vendor's product
D) This means Agent Search is misconfigured

*Answer: B.* Growing structural complexity is the signal to move
toward CX Agent Studio's state-machine model, and further growth
beyond that is the same signal that eventually points toward custom
code — matching tool to actual complexity. (A) ignores a real
complexity signal. (C) is out of scope and unsupported. (D) misdiagnoses
a design-complexity issue as a grounding-configuration issue.

---

## Section 2 — Using coding agents for application development (Q11–Q24)

**Q11.** A company wants to embed coding-agent capability directly
into their internal developer portal, as a feature of that portal
rather than a separate tool developers switch to. Which Antigravity
surface fits?
A) App
B) CLI
C) SDK
D) Agents CLI

*Answer: C.* The SDK is specifically for embedding coding-agent
capability into other software. (A) is a direct, standalone
interactive surface, not an embeddable library. (B) is a separate
scriptable surface, also not embedded into another product's UI. (D)
is the operational build/scale/govern/optimize layer, a different tool
entirely.

**Q12.** A coding agent identifies a database query executing a full
table scan on every request and rewrites it to use an existing index,
cutting response time significantly with no behavior change. Which
task 2.1 activity is this?
A) Patching an application-layer vulnerability
B) Optimizing execution runtimes
C) Configuring an MCP server
D) Creating a subagent

*Answer: B.* This is a performance rewrite with no security-flaw
component — exactly "optimize execution runtimes." (A) is a different
named activity (security fixes). (C) and (D) are unrelated
configuration/customization primitives, not what the agent did to the
code.

**Q13.** A coding agent identifies and fixes a cross-site-scripting
(XSS) flaw in a web form's input handling. Which task 2.1 activity is
this?
A) Optimizing execution runtimes
B) Patching an application-layer vulnerability
C) Using a secure sandbox
D) Configuring a rule

*Answer: B.* An XSS fix is a source-code-level security fix — exactly
"patch application-layer vulnerabilities." (A) is a performance
activity, not a security one. (C) is about the execution environment,
not the code fix itself. (D) is an Antigravity customization
primitive, not a description of this activity.

**Q14.** A CI system spins up a fresh, isolated coding-agent execution
environment per job with custom network policies restricting egress to
an explicit allowlist, torn down after each run. Which sandbox option
fits this requirement best, and why?
A) Cloud Workstations, since it's the lowest-effort managed option
B) GKE, since it provides the deeper infrastructure control (custom
   network policy, per-job isolation) that a managed dev-environment
   product doesn't expose
C) The Antigravity App surface alone, with no sandbox needed
D) This requirement cannot be met by any named sandbox option

*Answer: B.* Fine-grained, custom network-policy control per ephemeral
job is exactly the deep-control tradeoff GKE offers over Cloud
Workstations' managed convenience. (A) trades away the control this
scenario needs. (C) is false — the App surface doesn't eliminate the
need for an execution sandbox. (D) is false — this is a standard GKE
fit.

**Q15.** A team wants every commit message across all coding-agent
tasks to follow a specific internal format ("type(scope): summary")
without re-explaining the format in every prompt. Which primitive
fits?
A) A rule
B) A skill
C) A subagent
D) An MCP server

*Answer: B.* A skill packages a reusable convention applied
consistently without per-prompt restatement — exactly this case. (A)
rules are hard constraints/prohibitions, a different kind of primitive
than a formatting convention. (C) subagents delegate scoped work, they
don't encode a convention. (D) connects to external tools/data, not a
convention-encoding mechanism.

**Q16.** A team configures logic that automatically runs a linter the
moment a pull request is opened, before any human reviews it. Which
primitive is this an example of?
A) A skill
B) An extensions hook, at the PR-open lifecycle point
C) A subagent
D) A rule alone, with nothing triggering it

*Answer: B.* Automatic execution at a defined lifecycle moment is a
hook's defining trait. (A) packages how-to knowledge, it doesn't
itself trigger automatically. (C) is a delegated worker, not a
lifecycle trigger. (D) is incomplete on its own — a rule constrains,
it doesn't trigger execution at a moment in time.

**Q17.** An organization states: "no coding agent may ever modify a
file under `/licenses/`, regardless of task or instruction." Which
primitive expresses this?
A) A skill
B) A rule
C) A plugin
D) The CLI surface

*Answer: B.* This is a hard, non-negotiable behavioral constraint —
exactly a rule's purpose. (A) encodes conventions, not prohibitions.
(C) adds capability, it doesn't restrict it. (D) is an interaction
surface, unrelated to behavior constraints.

**Q18.** A large dependency-upgrade task is split so that one narrowly
scoped worker handles updating the dependency manifest and lockfile,
while the primary agent handles the resulting code changes. What is
the manifest/lockfile worker best described as?
A) A plugin
B) A subagent
C) A rule
D) An MCP server

*Answer: B.* A dedicated, narrower-scoped worker handling one scoped
subtask is exactly a subagent. (A) adds capability generally, it isn't
a delegated task-owner. (C) constrains behavior, it doesn't perform
work. (D) connects to an external tool/data source, not a description
of a delegated worker.

**Q19.** Leadership wants a single place to see coding-agent adoption
across every team, enforce which teams can run which kinds of tasks,
and track aggregate spend — after the agents are already in daily
use. Which tool provides this?
A) The Antigravity App surface
B) Agents CLI
C) A shared system instruction
D) A shared MCP server

*Answer: B.* This is exactly Agents CLI's build/scale/govern/optimize
role for deployed coding agents across an organization. (A) is a
single-developer interaction surface, not an org-wide governance
layer. (C) doesn't provide governance/tracking controls. (D) connects
to one external tool, unrelated to fleet-wide adoption tracking.

**Q20.** A coding agent is connected via MCP to the team's internal
engineering wiki, so it can look up architecture decisions while
working on a related refactor. What does this best illustrate?
A) A production RAG pipeline
B) A dev-time MCP server connecting the coding agent to an internal
   tool needed during development
C) An A2A handoff
D) An Agent Runtime deployment setting

*Answer: B.* This matches the dev-time MCP framing in task 2.1 —
connecting a coding agent to the systems it needs while doing
development work. (A) is a Section 3.2 production-agent concept. (C)
is agent-to-agent coordination, not this single agent-to-tool
connection. (D) is a Section 4 deployment concept.

**Q21.** A senior engineer argues that infrastructure changes proposed
by a coding agent should always require a human to explicitly approve
before applying, given how hard some infra changes are to reverse.
Which principle supports this?
A) High-blast-radius, hard-to-reverse actions should favor human mode
   or an explicit approval gate, per the agent-vs-human-mode principle
B) Agent mode should always be preferred for infrastructure changes,
   for speed
C) Mode configuration has no bearing on infrastructure risk
D) Human mode is incompatible with infrastructure-change tasks

*Answer: A.* This is the direct guidance — significant, hard-to-reverse
actions warrant tighter human oversight. (B) inverts the correct
guidance for this risk profile. (C) and (D) are both false.

**Q22.** A coding agent's rewrite of a payments-processing module
passes every automated test inside its sandbox. Should it be
auto-merged to production directly by the agent?
A) Yes, passing sandboxed tests is sufficient for any change
B) No — even sandboxed, tested output should typically pass through
   human review/CI gates before merging, especially for
   security/financially-sensitive changes
C) Yes, but only using one specific named coding agent
D) No, coding agents should never be permitted to touch payments code

*Answer: B.* Passing automated tests inside a sandbox doesn't
substitute for human review/CI gates before merge, particularly for
sensitive changes. (A) overstates what passing tests alone guarantees.
(C) is a fabricated tool-specific carve-out. (D) is too absolute — the
issue is the missing review gate, not that such code can never be
touched by a coding agent.

**Q23.** A vendor's RFP response claims "Gemini Code Assist is the
coding agent this certification validates knowledge of." Should this
claim be accepted at face value on the PAA exam?
A) Yes, it's the primary tool named in the guide
B) No — the guide names Antigravity and Claude Code on Google Cloud
   explicitly; Gemini Code Assist does not appear in the guide at all
C) Yes, as a synonym for Antigravity
D) No, because the correct name is Agents CLI

*Answer: B.* This is a direct currency trap — Gemini Code Assist isn't
named in the guide; Antigravity and Claude Code on Google Cloud are.
(A) and (C) both wrongly validate the incorrect branding. (D) names a
real but different, complementary operational tool, not a rename of
"Gemini Code Assist."

**Q24.** A team wants a nightly, unattended batch job that runs a
coding agent across the whole repository to flag newly-introduced code
smells, with results posted to a dashboard — no human present during
the run. Which Antigravity surface fits?
A) App
B) CLI
C) SDK used only for interactive chat
D) None of the surfaces support unattended, scheduled runs

*Answer: B.* Scriptable, headless, automation-friendly execution is
exactly the CLI's fit. (A) is interactive/human-driven, the opposite
of unattended. (C) mischaracterizes the SDK, which is for embedding
capability into other software, not "chat only." (D) is false.

---

## Section 3 — Developing custom agents (Q25–Q50)

**Q25.** A team needs an agent that classifies inbound support tickets
into one of eight fixed categories, at very high volume, with tight
latency and cost constraints. Which size-axis choice fits?
A) LLM
B) SLM
C) Size doesn't matter for classification tasks
D) A custom ADK agent always requires an LLM

*Answer: B.* Narrow, high-volume, latency/cost-sensitive classification
is the textbook SLM fit. (A) over-provisions capability the narrow
task doesn't need. (C) is false — size is the dominant axis here. (D)
is a fabricated constraint; ADK doesn't mandate model size.

**Q26.** A government contractor must be able to audit a model's full
internal architecture and cannot send any inference data outside their
own network boundary. Capability need (broad or narrow) is a separate,
secondary consideration. Which axis combination fits the stated
constraints?
A) SaaS, proprietary
B) Self-hosted, OSS
C) SaaS, OSS
D) Self-hosted, proprietary

*Answer: B.* Full internal auditability requires OSS (inspectable
weights/architecture); the network-boundary requirement requires
self-hosting. (A) and (C) both involve SaaS, violating the boundary
requirement. (D) is self-hosted but proprietary, which doesn't satisfy
full architectural auditability.

**Q27.** A boutique creative agency wants the most capable available
model for open-ended copywriting, has no ML operations staff, and
prioritizes speed to market over infrastructure control. Which
combination fits?
A) Self-hosted, OSS, SLM
B) SaaS, proprietary, LLM
C) Self-hosted, proprietary, LLM
D) The self-hosted-vs-SaaS axis is irrelevant to a creative agency

*Answer: B.* No ops staff plus a priority on capability and speed
points to SaaS (someone else operates it) and a capable general LLM;
proprietary is acceptable with no stated auditability requirement. (A)
and (C) both require self-hosting, conflicting with "no ML operations
staff." (D) is false — ops capacity is exactly what drives this axis.

**Q28.** Which statement about ADK is accurate per the exam guide?
A) ADK is closed-source and Google-proprietary
B) ADK is explicitly described as an open-source library for building
   custom agents
C) ADK is a low-code console tool, not a code library
D) ADK can only orchestrate proprietary Gemini models

*Answer: B.* Direct currency correction — ADK is explicitly
open-source per the guide. (A) is the exact wrong claim to avoid. (C)
confuses ADK with Section 1's low-code tools. (D) is unsupported by
the guide.

**Q29.** A shopping assistant needs to remember, within one active
checkout session, which items the user has already added to the cart
— with no requirement that this persist once checkout ends. Where
should this be tracked?
A) Agent Platform Memory Bank
B) A managed session, scoped to this one interaction
C) Vector Search 1.0
D) Agent Registry

*Answer: B.* This is a single-interaction state need — a managed
session's exact purpose. (A) is for durable, cross-session facts, more
persistence than needed here. (C) is a retrieval mechanism, not
conversational state. (D) is a capability catalog, unrelated to state
tracking.

**Q30.** A returning customer's agent should remember, across separate
visits spanning months, that they always prefer expedited shipping.
Where should this be stored?
A) A managed session
B) Agent Platform Memory Bank
C) Reranking configuration
D) Agent Identity

*Answer: B.* Durable, cross-session preference storage is Memory
Bank's defining purpose. (A) doesn't persist across separate
interactions. (C) is a RAG relevance-ordering step, unrelated to user
memory. (D) scopes permissions, not memory.

**Q31.** A team configures, via Agents CLI, a plugin that adds a
"schedule a follow-up meeting" capability to their custom agent that
it didn't previously have. What does this illustrate?
A) Managed session configuration
B) Skills configuration via Agents CLI — specifically adding a new
   capability/plugin the agent can now use
C) Agent Identity scoping
D) A2A protocol configuration

*Answer: B.* Task 3.1 names configuring skills via Agents CLI,
including plugins, as an in-scope custom-agent capability-configuration
activity. (A) is a different state-tracking concept. (C) is a
permissions concept, not a capability-addition one. (D) is a
coordination protocol, unrelated to adding a plugin capability.

**Q32.** A custom agent has both a low-risk "check order status" skill
and a high-risk "issue a wire transfer" skill. Per the agent-vs-human-
mode principle applied at the skill level, what's the appropriate
configuration?
A) Both skills in agent mode uniformly, for simplicity
B) The check-status skill in agent mode; the wire-transfer skill in
   human mode or HITL-gated agent mode, matching oversight to each
   skill's actual risk
C) Both skills in human mode uniformly, eliminating all autonomy
D) Mode configuration doesn't apply at the individual-skill level

*Answer: B.* Oversight should match each skill's actual risk, not be
applied uniformly across very different risk profiles. (A) under-
protects the high-risk skill. (C) over-corrects, eliminating useful
autonomy for the low-risk skill. (D) is false — per-skill mode
configuration is exactly what this principle supports.

**Q33.** A RAG pipeline built for a scientific-research corpus uses a
general-purpose embedding model not adapted to technical/scientific
terminology, and retrieval quality suffers even though the corpus is
well-curated. What's the most likely cause?
A) The vector database software is broken
B) A domain-mismatched embedding model captures the corpus's
   specialized terminology and semantics poorly, degrading similarity
   search
C) Reranking is the only factor that ever affects retrieval quality
D) The corpus must be re-uploaded to a different Cloud Storage bucket

*Answer: B.* Embedding model choice directly affects how well
domain-specific meaning is captured; a mismatch between the model's
training domain and the corpus's domain is a real, common failure
mode. (A) is an unfounded leap. (C) ignores that reranking operates on
an already-poor candidate set produced by mismatched embeddings. (D)
is unrelated to the described symptom.

**Q34.** Why might a team building a customer-facing, policy-citing
support agent add a reranking step after initial similarity-scored
retrieval, despite the added latency?
A) Reranking eliminates the need for an embedding model
B) Fast approximate similarity search is good at surfacing a relevant
   candidate set but not always the best fine-grained ordering;
   reranking improves precision on the top results at some latency cost
C) Reranking is mandatory for all retrieval pipelines with no exceptions
D) Reranking replaces the need for Agent Identity scoping

*Answer: B.* This is the precision-versus-latency tradeoff reranking
addresses — worth it specifically when getting the very top result
right matters. (A), (C), (D) all mischaracterize reranking's actual
role.

**Q35.** A support agent should only ever be able to query documents
tagged "customer-facing," never internal-only documents, regardless of
what a user asks it to try. Which mechanism enforces this?
A) Reranking configuration
B) Agent Identity, scoping the agent's permissions to only the
   "customer-facing"-tagged subset
C) A larger embedding model
D) Agent Runtime deployment settings

*Answer: B.* Task 3.2 names configuring agent permissions via Agent
Identity as an access-boundary mechanism independent of user requests.
(A) is a relevance-ordering step, not access control. (C) affects
retrieval quality, not permission scope. (D) is a deployment/execution
environment setting, not a permissions mechanism.

**Q36.** Five different custom agents all need to send transactional
emails. Instead of implementing email-sending logic five separate
times, what's the best-practice approach?
A) Each agent independently hard-codes its own email integration
B) Register an email-sending capability once, backed by an MCP server,
   in Agent Registry, so all five agents can discover and reuse it
C) Give all five agents a single shared Agent Identity with maximal
   privileges
D) Use A2A to let one agent send emails on behalf of the other four at
   runtime

*Answer: B.* Register-once, discover-and-reuse via Agent Registry is
the explicit best-practice pattern for avoiding duplicated integration
logic. (A) is the anti-pattern being avoided. (C) violates least
privilege. (D) misuses A2A — it coordinates agent-to-agent task
delegation, not a shared tool-access mechanism.

**Q37.** A team needs to connect a custom agent to a legacy on-premises
inventory system exposed only via a proprietary binary protocol, with
no existing prebuilt connector. What's the correct approach?
A) This cannot be integrated under any circumstances
B) Build a custom MCP server wrapping the legacy protocol and exposing
   its functionality in an MCP-compatible way, then register it in
   Agent Registry
C) Use A2A to have a different agent proxy the legacy protocol calls
D) Route requests through Agent Search instead

*Answer: B.* Task 3.2 explicitly covers custom integration
layers/API integrations for exactly this kind of gap. (A) is false —
this is precisely what custom integration layers are for. (C)
misapplies A2A to what is fundamentally a tool-integration problem.
(D) confuses this with the Section 1 low-code grounding connector.

**Q38.** Which correctly distinguishes prebuilt from custom
capabilities per task 3.2?
A) Prebuilt capabilities are always less secure than custom ones
B) Prebuilt capabilities (e.g., Google Cloud MCP Servers exposing
   Google Cloud managed resources) are ready-made; custom capabilities
   (e.g., a custom integration layer for a specific internal system)
   are built by the team for needs prebuilt options don't cover
C) Custom capabilities can never be registered in Agent Registry
D) The two terms are synonyms

*Answer: B.* This matches task 3.2's own phrasing directly. (A) is an
unsupported blanket security claim. (C) is false — Agent Registry
supports discovery/reuse of both categories. (D) collapses a real
distinction with named examples on each side.

**Q39.** For a low-stakes internal directory-lookup tool ("what's this
person's extension"), a team is deciding whether the extra reranking
step is worth keeping. What's the right consideration?
A) Reranking must always be kept, with no exceptions, regardless of
   use case
B) For a low-precision-stakes lookup like this, the added
   latency/cost of reranking may not be justified — its value scales
   with how costly a wrong top result actually is
C) Reranking must be removed because it's structurally incompatible
   with directory lookups
D) Reranking has no effect on latency, only on relevance

*Answer: B.* Reranking's cost is worth paying when precision stakes
are high; a trivial, low-ambiguity lookup is exactly the case where
that tradeoff may not pay off. (A) ignores this being a real
cost/benefit tradeoff. (C) overstates incompatibility — it's an
optional step, not a structural blocker. (D) is false — reranking does
add a scoring pass and latency.

**Q40.** A custom agent needs to query a managed Firestore database
that Google already exposes an MCP connector for. Should the team
build a custom MCP server for this instead?
A) Yes, always build custom regardless of what's prebuilt
B) No — this is exactly the case for a prebuilt Google Cloud MCP
   Server; building a custom equivalent would be unnecessary duplicated
   effort
C) Yes, because Google Cloud MCP Servers cannot connect to Firestore
D) It doesn't matter; Agent Registry only supports custom capabilities

*Answer: B.* When a prebuilt Google Cloud MCP Server already covers
the need, using it avoids unnecessary custom-build effort — custom
integration layers are for gaps prebuilt options don't cover. (A)
ignores the whole point of prebuilt capabilities existing. (C) is
false — Google Cloud MCP Servers are explicitly for exposing Google
Cloud managed resources. (D) is false — Agent Registry catalogs both
prebuilt and custom capabilities.

**Q41.** True or False: "Agent Retrieval" and "Vector Search 1.0," as
named together in the exam guide's in-scope list, refer to the
custom-code vector-retrieval capability area, distinct from the
low-code Agent Search connector.
A) True
B) False — Agent Retrieval is low-code and Vector Search 1.0 is
   custom-code
C) False — neither relates to RAG at all
D) True, but only Vector Search 1.0 is actually in scope

*Answer: A.* The guide's own in-scope list groups them together, both
belonging to the custom-code RAG/vector-retrieval path, distinct from
the Section 1 low-code Agent Search. (B) fabricates a split not in the
guide's own grouped listing. (C) is false. (D) is false — both appear
together in the in-scope list.

**Q42.** An agent needs to call a third-party payment-gateway API as a
tool, and separately hand a complex fraud-review sub-task to a
dedicated specialist agent. Which protocols correctly match each
connection?
A) A2A for the payment gateway; MCP for the specialist handoff
B) MCP for the payment gateway (agent-to-tool); A2A for the specialist
   handoff (agent-to-agent)
C) MCP for both connections
D) A2A for both connections

*Answer: B.* This is the core MCP-versus-A2A distinction — MCP
connects an agent to a tool/API; A2A connects one agent to another
agent. (A) reverses the pairing. (C) misapplies MCP to an
agent-to-agent coordination need. (D) misapplies A2A to a simple tool
call.

**Q43.** An employee-onboarding pipeline runs strictly in order:
create account → provision equipment request → send welcome email —
each step depending entirely on the prior step's completion, with no
branching. Which topology fits?
A) Parallel
B) Sequential
C) Graph workflow
D) A2A used as the topology itself

*Answer: B.* A strict, ordered, no-branching chain is the definitional
sequential case. (A) is for independent, concurrent work, the opposite
of this dependency chain. (C) adds unneeded conditional-routing
complexity. (D) confuses a coordination protocol with a topology.

**Q44.** Three agents each independently translate the same document
into three different languages concurrently, with results simply
collected at the end — no agent depends on another's output. Which
topology fits?
A) Sequential
B) Parallel
C) Graph workflow
D) None of these apply

*Answer: B.* Independent, concurrent sub-tasks are the canonical
parallel-topology fit. (A) unnecessarily serializes independent work.
(C) adds unneeded branching/looping machinery for a case with none.
(D) is false.

**Q45.** A fraud-review workflow runs a risk-scoring agent, then
conditionally routes to either auto-approve or a human-review queue
depending on the score, with a possible loop back to the risk-scoring
agent if the human reviewer requests re-scoring with new information.
Which topology fits?
A) Sequential
B) Parallel
C) Graph workflow
D) A2A alone, without any topology

*Answer: C.* Conditional branching plus a possible loop back based on
an intermediate result is exactly graph workflow's fit; neither purely
linear nor purely concurrent execution can express it. (A) and (B)
can't express the conditional loop. (D) conflates a coordination
protocol with a topology.

**Q46.** What is Agent Runtime, and what should it never be called
except when explicitly flagging the historical name?
A) The low-code grounding connector; never call it "Vertex AI Search"
B) The managed agent deployment/execution environment; never call it
   "Agent Engine" except to explicitly note the rename
C) The multi-agent coordination protocol; never call it "A2A"
D) The permissions/policy tool; never call it "IAM"

*Answer: B.* This is the single most emphasized currency correction in
this folder. (A) describes Agent Search, a different service with a
different old name. (C) and (D) mischaracterize Agent Runtime's role.

**Q47.** Which statement best characterizes "agent policies" as named
under task 3.3?
A) A per-user IAM role unrelated to agents specifically
B) Governance/behavioral rules constraining how agents in a workflow
   may hand off tasks and what they're permitted to do, enforced
   across the whole multi-agent system
C) A synonym for Agent Identity
D) A deprecated term replaced by "Agent Runtime"

*Answer: B.* This matches task 3.3's framing directly. (A) is a
mischaracterization — agent policies are workflow-specific governance,
not generic IAM. (C) conflates two distinct tools — Identity scopes an
individual agent; policies govern workflow-wide handoff behavior. (D)
is fabricated.

**Q48.** In a multi-agent handoff from Agent A to Agent B, what should
happen to Agent B's effective permissions?
A) Agent B should inherit Agent A's full permission scope automatically
B) Agent B should execute under its own distinct, appropriately-scoped
   Agent Identity — a handoff should not expand or collapse either
   agent's scope
C) Permissions become irrelevant once a handoff occurs
D) Agent B should default to broader permissions than Agent A, to
   handle unexpected cases

*Answer: B.* This is the least-privilege handoff principle — each
agent keeps its own scoped identity. (A) and (D) both describe
privilege-escalation risk. (C) is false — permissions matter precisely
because of possible escalation across handoffs.

**Q49.** A two-agent workflow ("summarize a document, then translate
the summary") is built as a graph workflow by default, even though it
has no conditional branching at all. What's the issue?
A) Graph workflows are technically incapable of a two-step pipeline
B) This adds unnecessary design, testing, and observability overhead
   for a case a simple sequential topology would fully satisfy
C) There is no issue; more flexibility is always strictly better
D) This is only a problem once Agent Runtime is involved

*Answer: B.* Defaulting to graph workflow for a linear, non-branching
case adds overhead with no corresponding benefit. (A) is false — it's
capable, just unnecessarily complex here. (C) is the exact anti-pattern
being tested. (D) is a fabricated, irrelevant condition.

**Q50.** A workflow needs: (a) a strict two-step validation chain, (b)
four independent enrichment agents that run concurrently once
validation passes, and (c) a final conditional routing step based on
the enrichment agents' combined output. What's the right topology
design?
A) One uniform sequential topology for everything
B) One uniform parallel topology for everything
C) A composed topology: sequential for (a), parallel for (b), and
   graph-workflow-style conditional routing for (c) — matching each
   stage's actual structure
D) This cannot be modeled with any named topology and requires a
   protocol outside A2A/MCP

*Answer: C.* Composing multiple topology patterns stage by stage,
matched to each stage's actual structure, is the correct design here.
(A) forces the concurrent stage into unnecessary serialization. (B)
forces the ordered and conditional stages into a topology neither can
correctly express. (D) is false — A2A plus the three named topologies
fully cover this composition.

---

## Section 4 — Evaluating and deploying agentic workflows (Q51–Q68)

**Q51.** A curated set of input/expected-output pairs, each verified
by a subject-matter expert, is used as a scoring baseline for an
agent's evaluation. What is this called?
A) Edge cases
B) Golden data
C) Production traffic logs
D) A custom autorater

*Answer: B.* This is exactly golden data's definition — curated,
verified-correct, and used as a scoring baseline. (A) are boundary/
adversarial inputs, a different test-set component. (C) is raw,
unverified traffic, not a curated baseline. (D) is a type of evaluator
tool, not a test-set component.

**Q52.** A test set built entirely from typical, expected user
requests passes with a near-perfect score before launch. What risk
does this create?
A) No risk — a near-perfect score means the agent is fully ready
B) False confidence — this "happy path only" test set hides failure
   modes that only appear on ambiguous, adversarial, or boundary-
   condition inputs, which weren't tested
C) This risk applies only to low-code agents
D) A near-perfect score always means the test set was too easy to be
   valid at all

*Answer: B.* This is the exact false-confidence risk of happy-path-only
testing — it systematically under-tests real weak points. (A) is the
misconception being tested. (C) is false — this applies broadly. (D)
overstates the conclusion; the issue is coverage, not the score itself
being invalid.

**Q53.** An agent correctly calls the right tool with correct
arguments, but then discards the tool's returned result and answers
from its own unsupported assumption instead. Where does this failure
belong in evaluation?
A) It's undetectable by any named evaluation approach
B) Within tool-execution evaluation scope — task 4.1 frames success
   criteria as covering correct incorporation of the result, not just
   the call itself
C) Exclusively a production monitoring concern, never a pre-launch
   evaluation concern
D) A hallucination unrelated to tool execution at all

*Answer: B.* Task 4.1's tool-execution criteria explicitly extend to
correct result incorporation. (A) is false — this is measurable. (C)
misplaces a pre-launch-detectable issue into only the production
phase. (D) is too narrow — while the output is ungrounded, this is
specifically a tool-execution-evaluation finding about incorporation.

**Q54.** A team wants their evaluation pipeline to automatically
re-run every time a new agent configuration is deployed, rather than
only running it manually before major releases. What is this called?
A) A one-time golden dataset check
B) A continuous evaluation pipeline
C) Cloud Trace instrumentation
D) A custom autorater, exclusively

*Answer: B.* Task 4.1 names continuous evaluation pipelines as their
own consideration, distinct from a single manual pass. (A) is a
one-time check, the opposite. (C) is a production-observability tool.
(D) is one possible evaluator that could run inside such a pipeline,
not the pipeline concept itself.

**Q55.** A team using ADK wants to assert on the exact sequence of
tool calls their agent makes for a specific task, not just the final
answer's correctness. Which tooling fits first?
A) A custom autorater built from scratch
B) ADK evaluation tooling (evalset)
C) Agent Platform Gen AI evaluation service, exclusively
D) Cloud Trace

*Answer: B.* ADK evalset tooling is purpose-built to assess ADK agent
trajectories including tool-call sequencing. (A) is more engineering
effort than needed when purpose-built tooling fits. (C) is more
general and less trajectory-precise. (D) is a production observability
tool, not a pre-launch evaluation framework.

**Q56.** A company operates agents built with several different
frameworks and wants one consistent, managed evaluation capability
spanning all of them, without building a bespoke harness per
framework. What fits?
A) ADK evaluation tooling (evalset), used across all frameworks
B) Agent Platform Gen AI evaluation service
C) A custom autorater rebuilt independently per framework
D) Cloud Logging alone

*Answer: B.* A managed capability across heterogeneous agents is
exactly this service's described fit. (A) is ADK-specific, less suited
to non-ADK agents. (C) is far more build/maintain effort than needed.
(D) is a logging tool, not an evaluation framework.

**Q57.** Why should response quality and retrieval quality be scored
as two separate metrics rather than one blended score?
A) Retrieval quality can't be measured at all
B) A blended score can't distinguish a bad answer caused by bad
   retrieval from one caused by a reasoning error on good retrieval;
   separate metrics attribute the failure to the right layer
C) Response quality is always more important than retrieval quality
D) The ADK evalset only supports a single metric type

*Answer: B.* This is the direct rationale — separating metrics enables
correct root-cause attribution across the RAG stack. (A) is false —
retrieval quality is explicitly a named, measurable evaluation
dimension. (C) is an unsupported value judgment. (D) is a fabricated
tooling limitation.

**Q58.** A team needs to score outputs against a nuanced,
organization-specific blend of tone, compliance, and formatting rules
that no off-the-shelf tool captures well. What's the right tooling
choice?
A) ADK evaluation tooling (evalset) alone, since it covers all
   evaluation needs by default
B) A custom autorater, built to score against these specific nuanced
   criteria
C) Cloud Trace, since it handles all quality assessment
D) No tooling is appropriate for nuanced criteria

*Answer: B.* This is exactly the fit for custom autoraters — purpose-
built evaluators for criteria generic tooling doesn't capture well.
(A) is more structure/trajectory-focused, not this kind of nuanced
judgment. (C) is an observability tool, unrelated. (D) is false — this
is precisely the use case custom autoraters address.

**Q59.** A team needs low operational overhead, native session/memory
integration, and agent-specific observability for a production agent
deployment. Which runtime fits best?
A) GKE
B) Cloud Run
C) Agent Runtime
D) Cloud Workstations

*Answer: C.* This is Agent Runtime's defining characteristic — the
purpose-built, lowest-ops-overhead option among the three named
runtimes for agent-native features. (A) has the highest ops overhead
with no built-in agent-native abstractions. (B) is general-purpose
serverless, lacking agent-specific platform features. (D) is a Section
2 dev-time sandbox, not a production runtime.

**Q60.** A team needs custom GPU scheduling across heterogeneous
workload types and is already standardized on Kubernetes elsewhere.
Which runtime fits best?
A) Agent Runtime
B) Cloud Run
C) GKE
D) None of these support GPU scheduling

*Answer: C.* Deep infrastructure control and existing Kubernetes
standardization is GKE's specific fit. (A) and (B) are both more
abstracted, with a lower control ceiling than needed here. (D) is
false.

**Q61.** An agent repeatedly re-attempts the same tool call with
minor rewording, never reaching a final answer, across a single
session. What failure mode is this?
A) Drift
B) An agent reasoning loop
C) A system failure
D) Tool invocation latency

*Answer: B.* Repeated calls with no forward progress within one
session is the defining reasoning-loop signature. (A) is gradual
degradation over time, not a same-session repetition pattern. (C)
implies an outright crash, not repeated attempts. (D) is about
per-call slowness, not repetition.

**Q62.** An agent's answer quality has degraded gradually over several
weeks relative to its evaluated baseline, with no single triggering
incident. What failure mode is this most likely?
A) An agent reasoning loop
B) A system failure
C) Drift
D) Tool invocation latency

*Answer: C.* Gradual degradation over time relative to an evaluated
baseline is drift's definition — likely caused by data shift, stale
grounding content, or an unannounced upstream change. (A) is a
same-session repetition pattern. (B) implies a discrete event. (D) is
a per-request slowness symptom.

**Q63.** Which Google Cloud Observability component provides
distributed tracing to identify exactly which stage of a multi-tool
agent pipeline is the latency bottleneck?
A) Cloud Logging
B) Cloud Trace
C) Model Armor
D) Agent Registry

*Answer: B.* Cloud Trace is explicitly the distributed-tracing
component named for this purpose. (A) handles structured events/errors,
not stage-by-stage timing breakdown. (C) and (D) are unrelated
governance/discovery tools.

**Q64.** Why is "the response sounds confident and well-written" an
insufficient hallucination check for a RAG-grounded agent?
A) Plausibility and factual groundedness are different properties — a
   fluent hallucination can sound entirely plausible while unsupported
   by retrieved content
B) Hallucinations never sound plausible, so the check is actually
   sufficient
C) RAG-grounded systems cannot hallucinate by definition
D) Plausibility checks are only relevant to low-code agents

*Answer: A.* Plausibility is not the same as groundedness in actual
retrieved/tool-returned content. (B) is false and describes the
misconception being tested. (C) is a dangerous false assumption — RAG
reduces but doesn't eliminate hallucination risk. (D) is unrelated and
false.

**Q65.** What does it mean that evaluation (4.1) and deployment/
monitoring (4.2) form a feedback loop?
A) They are entirely independent and never interact
B) Production monitoring surfaces real failure modes (drift, latency,
   hallucinations) that should feed back into evaluation test sets,
   making evaluation continuous rather than a one-time pre-launch gate
C) 4.2 replaces the need for 4.1 once an agent is deployed
D) 4.1 is only relevant before the first deployment, never afterward

*Answer: B.* Production findings should refine ongoing evaluation
rather than being treated as a disconnected concern. (A), (C), (D) all
sever this feedback relationship.

**Q66.** A logic error and a hallucination are being confused by a
junior engineer on a team. Which statement correctly separates them?
A) They are synonyms and should always be tracked as one metric
B) A logic error is a flaw in the agent's reasoning/control-flow or
   orchestration design; a hallucination is confident, plausible
   output not actually grounded in retrieved/tool-returned content
C) Logic errors only occur in low-code agents; hallucinations only in
   custom ADK agents
D) Hallucinations are a subset of tool invocation latency issues

*Answer: B.* This is the distinction the guide draws — two different
failure categories requiring different diagnostic approaches. (A)
collapses a meaningful distinction. (C) is a fabricated restriction.
(D) incorrectly nests one unrelated failure category inside another.

**Q67.** True or False: "Agent Runtime" and "Agent Engine" are both
equally correct, current terminology for the deployment runtime on
this exam.
A) True — either term is equally acceptable
B) False — Agent Runtime is the current name; Agent Engine is the
   outdated, pre-rename name, worth knowing only to recognize the
   rename itself
C) True, but only Agent Engine appears in the in-scope tool list
D) False — neither term appears anywhere in the guide

*Answer: B.* This is the repeated currency correction. (A) treats them
as interchangeable, the trap. (C) reverses which name is actually
current in the in-scope list. (D) is false — Agent Runtime is very
much the current, named term.

**Q68.** Which combination correctly matches deployment runtime to its
best-fit scenario?
A) Cloud Run → deep custom GPU scheduling across many workload types
B) GKE → simplest possible serverless deployment with scale-to-zero
C) Agent Runtime → native session/memory integration and agent-specific
   observability with minimal ops overhead
D) Agent Runtime → maximum low-level infrastructure control ceiling

*Answer: C.* This is the correct pairing. (A) and (B) swap Cloud
Run's and GKE's actual best-fit scenarios. (D) mischaracterizes Agent
Runtime — its control ceiling is bounded by the managed platform,
lower than GKE's, in exchange for agent-native features and lower ops
overhead.

---

## Section 5 — Securing and governing agentic workflows (Q69–Q80)

**Q69.** Which mechanism handles the actual authentication flow for an
agent-to-tool API call?
A) Model Armor
B) Auth Manager, using OAuth 2.0
C) Agent Registry
D) HITL

*Answer: B.* Task 5.1 explicitly names OAuth 2.0 via Auth Manager for
this purpose. (A) is content-safety screening, not authentication. (C)
is a capability catalog. (D) is a human-approval checkpoint, not an
authentication mechanism.

**Q70.** A platform team defines an outer limit stating an agent may
never, under any prompt or configuration, access a specific
sensitive database — a limit meant to hold no matter what the agent is
later asked to do. Which mechanism is this?
A) Agent Gateway traffic rules
B) A PAB (principal access boundary) policy, configured via Agent
   Identity
C) Model Armor content filtering
D) HITL approval

*Answer: B.* This is exactly PAB's role — a hard outer access boundary
configured through Agent Identity, independent of runtime prompts. (A)
monitors traffic, it doesn't define the boundary itself. (C) screens
content, not data-access limits. (D) is a per-action human checkpoint,
a different (complementary) mechanism.

**Q71.** A security team wants to detect that a specific agent has
begun calling an internal service at an unusually high rate compared
to its historical baseline. Which tool provides this?
A) Auth Manager
B) Agent Gateway
C) Agent Identity
D) Skill Registry

*Answer: B.* Agent Gateway monitors traffic and tracks agent behavior
— exactly this kind of anomaly visibility. (A) handles authentication.
(C) defines what an agent is allowed to access, not what it's actually
doing. (D) is unrelated to traffic monitoring.

**Q72.** A governance team requires formal review before any new
capability is published into the shared catalog all agents can
discover and reuse. What does this reflect?
A) OAuth 2.0 token scoping
B) Governance and policy enforcement over Agent Registry — what gets
   registered is itself subject to review, not an unmoderated
   free-for-all
C) PAB policy configuration
D) Agent Gateway traffic thresholds

*Answer: B.* Task 5.1 explicitly names Agent Registry under agentic
governance and policy enforcement. (A) is an authentication-scope
mechanism. (C) is an access-boundary mechanism, a different governance
layer. (D) is a traffic-monitoring concept, not catalog-review.

**Q73.** Every agent in an organization is granted the same broad
standing OAuth 2.0 scope "just in case it's needed later." What
principle does this violate?
A) No principle is violated; this is the recommended default
B) Least-privilege scoping — each agent's token should be scoped only
   to what its actual task requires, not a broad standing grant
C) This should be replaced with Model Armor content filtering instead
D) This is only a concern for coding agents, not custom agents

*Answer: B.* Least-privilege token scoping is the direct governing
principle; "just in case" broad access is exactly the anti-pattern it
prevents. (A) endorses the anti-pattern. (C) confuses an unrelated
mechanism with access-scope design. (D) is false — this applies broadly.

**Q74.** Which pairing correctly distinguishes Auth Manager from PAB
(via Agent Identity)?
A) Both are the same mechanism configured through different UIs
B) Auth Manager handles the authentication mechanics of an
   agent-to-tool call; PAB defines the outer boundary of what that
   agent principal is ever allowed to access, independent of any
   single call
C) PAB handles authentication; Auth Manager defines access boundaries
D) Neither relates to security; both are purely observability tools

*Answer: B.* This is the authentication-versus-authorization-boundary
distinction. (A) collapses two genuinely different mechanisms. (C)
reverses their actual roles. (D) mischaracterizes both.

**Q75.** Which three tools/concepts does task 5.2 name together as
"safety frameworks and guardrails"?
A) Auth Manager, PAB, Agent Identity
B) Agent Gateway, Model Armor, HITL
C) ADK, Agent Runtime, Agent Registry
D) Vector Search 1.0, Agent Retrieval, RAG Engine

*Answer: B.* This is the verbatim task 5.2 example list. (A) are
task-5.1-focused authentication/access-boundary tools. (C) and (D) are
Section 3/4 tools unrelated to this specific bullet.

**Q76.** A multi-hop chain has a request flow through Agent A, then a
tool call, then Agent B. At each hop, the effective access used should
reflect what?
A) A newly-created broad shared identity at each hop, for simplicity
B) The originating principal's actual, bounded permission scope,
   correctly carried through — never expanded — at each hop
C) Whatever access level is fastest to configure per hop
D) The most powerful identity available, to avoid permission errors

*Answer: B.* This is identity propagation — preserving, never
expanding, the originating scope across every hop. (A) and (D) both
describe the anti-pattern identity propagation prevents. (C)
optimizes for convenience over correctness, risking the same
anti-pattern.

**Q77.** A team requires human approval for every single action an
agent takes, including low-stakes, fully reversible read-only lookups.
What issue does this create?
A) No issue — maximal HITL usage is always safest
B) It eliminates the efficiency benefit of autonomy and doesn't scale
   — HITL should be scoped to genuinely high-stakes/irreversible
   actions, with lower-stakes actions proceeding autonomously under
   standing monitoring/screening
C) HITL cannot technically be applied to low-stakes actions
D) This is required by Model Armor's design

*Answer: B.* This is the explicit over-application anti-pattern
warning. (A) is the exact anti-pattern. (C) is a fabricated technical
limitation. (D) is false.

**Q78.** Why is Model Armor alone insufficient as a complete safety
framework for a high-stakes, irreversible action?
A) Model Armor cannot process any content related to that action
B) Model Armor screens content for policy violations but doesn't
   substitute for a human judgment checkpoint on whether a specific
   consequential action should actually execute
C) Model Armor is only usable in task 5.1, not 5.2
D) Model Armor requires HITL to function at all

*Answer: B.* Content safety and action-consequence judgment are
different concerns; policy-compliant content doesn't mean the
underlying action is safe to execute autonomously. (A) is fabricated.
(C) is false — Model Armor is named in both 5.1 and 5.2. (D) reverses
an unsupported dependency.

**Q79.** Which task (5.1 or 5.2) is primarily about configuring the
control plane (auth, permissions, traffic visibility, policy), and
which is primarily about implementing runtime behavior-level
guardrails and secure data/identity handling?
A) 5.1 is runtime guardrails; 5.2 is control-plane configuration
B) 5.1 is control-plane configuration; 5.2 is runtime guardrails and
   secure data/identity handling
C) Both tasks cover identical content with no distinguishable focus
D) Neither task relates to configuration or runtime behavior

*Answer: B.* This matches the framing drawn across this section — 5.1
configures the control plane, 5.2 implements runtime safety behavior
and secure data/identity handling. (A) reverses the framing. (C) and
(D) both ignore the real distinction the task bullets draw.

**Q80.** True or False: HITL, as covered in task 5.2, is a
conceptually new idea with no connection to anything introduced
earlier regarding coding agents or custom agents.
A) True — HITL is introduced for the first time in Section 5.2 with no
   prior connection
B) False — HITL is the safety-framework framing of the same underlying
   "agent vs. human mode" concept introduced for coding agents
   (Section 2.2) and custom-agent skills (Section 3.1)
C) True, because "agent vs. human mode" only applies to coding agents
D) False, but only because Section 5.2 renames "human mode" to "HITL"
   with no conceptual continuity beyond the name

*Answer: B.* Recognizing this continuity — the same human-checkpoint
design idea surfaced across Sections 2, 3, and 5 — is exactly the kind
of cross-section pattern the exam rewards. (A) and (C) wrongly treat
the sections as disconnected. (D) understates the connection as "just
a rename" rather than the same principle applied consistently.
