# Section 3 — additional practice questions (30)

> Developing custom agents (~33% of the exam — the single heaviest
> section, and the largest practice bank in `06-practice/` to match).
> These 30 questions are **additional** to the 22 already at the end
> of `01-domains/SECTION-3-custom-agents.md` — different scenarios, no
> wording overlap. Every option is explained inline.

## 3.1 — Designing and building agentic workflows in code

**Q1.** A media company needs a service that translates short customer
support chat messages between languages in real time, at very high
volume, with tight latency and cost budgets, and the task is narrow
and well-defined. Which model-size axis choice fits best?
A) A large, general-purpose LLM, for maximum translation nuance
B) An SLM, since the task is narrow, high-volume, and
   latency/cost-sensitive — exactly the SLM sweet spot
C) Model size is irrelevant; only the OSS-vs-proprietary axis matters
   here
D) Neither LLM nor SLM — this requires a low-code Gemini Enterprise
   agent instead

*Answer: B.* Narrow scope plus high volume plus tight latency/cost
budgets is the canonical SLM fit, independent of the hosting or
licensing axis. (A) over-provisions capability the narrow task doesn't
need, at higher cost and latency. (C) ignores that size is the
dominant axis for this specific scenario. (D) conflates model
selection (a Section 3 custom-agent concern) with the choice of
low-code vs. custom tooling — a separate decision entirely.

**Q2.** A hospital system must keep all patient-data model inference
strictly within its own data center for regulatory reasons, but has no
requirement to inspect the model's internal architecture — a
proprietary model is acceptable as long as it never leaves their
infrastructure. Which axis combination fits?
A) SaaS, proprietary, any size
B) Self-hosted, proprietary (any size, chosen by capability need)
C) Self-hosted, OSS only, regardless of capability
D) SaaS, OSS, any size

*Answer: B.* The binding constraint here is data-boundary (inference
must never leave their infrastructure), which requires self-hosting;
proprietary is explicitly acceptable since no auditability requirement
was stated — a different scenario from one requiring OSS
inspectability. (A) and (D) both involve SaaS, which violates the
data-boundary requirement regardless of licensing. (C) unnecessarily
forces OSS when the constraint given is data locality, not
auditability.

**Q3.** A two-person startup wants to launch a capable, general-purpose
assistant as fast as possible and has no ML infrastructure or
operations team to run inference themselves. Cost efficiency at their
current tiny scale matters less than shipping quickly. Which axis
combination best fits?
A) Self-hosted, OSS, SLM
B) SaaS, proprietary, LLM — minimal ops burden, fastest time-to-market,
   maximum out-of-the-box capability
C) Self-hosted, proprietary, LLM
D) The self-hosted-vs-SaaS axis doesn't matter for startups

*Answer: B.* No ops capacity plus a priority on speed and capability
points toward SaaS (someone else runs the infrastructure) and a
capable general LLM; proprietary is fine since no auditability
constraint was stated. (A) and (C) both require self-hosting, which
directly conflicts with "no ML infrastructure or operations team." (D)
is false — ops capacity is precisely what drives the self-hosted-vs-SaaS
decision in this scenario.

**Q4.** What does ADK primarily provide that a low-code Gemini
Enterprise tool does not?
A) A different underlying Gemini model family
B) Programmatic, code-level control over agent definition, tool
   integration, and orchestration logic, beyond what a console-based
   builder exposes
C) A replacement for Agent Search
D) A way to avoid ever using system instructions

*Answer: B.* ADK is the open-source library for building custom
agents in code — its value is the fine-grained programmatic control a
console UI can't expose, for cases that have outgrown low-code's sweet
spot. (A) is false — model choice is a separate, orthogonal decision.
(C) is false — Agent Search is a distinct low-code grounding
connector, not something ADK "replaces." (D) is false — even
ADK-built agents commonly use analogous instruction/prompt-configuration
concepts, just expressed in code rather than a console.

**Q5.** An agent needs to recall, within a single ongoing customer
support chat, the three items the user has already mentioned wanting
returned — but this information has no need to persist once that chat
ends. Where should this be tracked?
A) Agent Platform Memory Bank
B) A managed session, scoped to this one ongoing interaction
C) Vector Search 1.0
D) Agent Registry

*Answer: B.* This is exactly a session-scoped need — state relevant
only within one ongoing interaction, with no cross-session persistence
requirement. (A) Memory Bank is for durable, cross-session facts (e.g.,
a standing preference), which is more persistence than this scenario
needs. (C) is a retrieval/knowledge mechanism, not conversational
state tracking. (D) is a capability-discovery catalog, unrelated to
session state.

**Q6.** A custom agent has two skills configured via Agents CLI: one
that only reads from a knowledge base, and one that submits a refund.
Per the agent-vs-human-mode principle applied at the skill level, what
configuration best matches the risk profile of each?
A) Both skills should run in the same mode, for configuration
   simplicity
B) The read-only knowledge-base skill can run in agent mode; the
   refund-submission skill should run in human mode (or HITL-gated
   agent mode), matching oversight to each skill's actual risk
C) Both skills must run in human mode, since any skill could
   theoretically be risky
D) Mode configuration in Agents CLI only applies to coding agents, not
   custom agents' individual skills

*Answer: B.* This mirrors the guide's own per-capability
mode-configuration principle — oversight should match the actual risk
of each individual skill, not be applied uniformly. (A) ignores the
very different risk profiles of the two skills. (C) over-corrects,
eliminating the efficiency benefit of autonomy for a genuinely
low-risk, reversible action. (D) is false — task 3.1 explicitly
describes agent-vs-human mode as an Agents CLI skill-configuration
concept for custom agents.

## 3.2 — Integrating enterprise domain knowledge

**Q7.** A RAG pipeline for a medical-terminology knowledge base uses a
general-purpose, off-the-shelf embedding model not adapted to
clinical/medical language. Retrieval quality is poor even though the
underlying documents are well-organized. What is the most likely
issue?
A) The vector database itself is broken
B) A general-purpose embedding model may not capture domain-specific
   terminology and semantic relationships as well as a
   domain-appropriate embedding model, degrading similarity search
   quality
C) Reranking is the only variable that affects retrieval quality
D) This indicates the documents must be re-chunked into smaller pieces

*Answer: B.* Embedding model choice directly determines how well
domain-specific meaning is captured in vector space; a mismatch
between the embedding model's training domain and the corpus's domain
is a common, real retrieval-quality failure mode. (A) is an unfounded
leap to infrastructure failure without evidence. (C) is false —
reranking operates on the candidate set an embedding-driven search
already produced; it can't fully compensate for poor initial
embeddings. (D) addresses a different variable entirely, unrelated to
the described symptom.

**Q8.** A custom agent should be permitted to query only documents
tagged "public" within the organization's retrieval corpus, never
documents tagged "confidential," regardless of what a user asks. Which
mechanism enforces this?
A) Reranking configuration
B) Agent Identity, scoping the agent's permissions to only the
   "public"-tagged subset of the retrieval corpus
C) A larger embedding model
D) Agent Runtime deployment settings

*Answer: B.* Task 3.2 names configuring agent permissions via Agent
Identity as its own consideration — access-boundary enforcement over
what the agent can query, independent of what a user might ask it to
try. (A) reranking is a relevance-ordering step, not an access-control
mechanism. (C) embedding model size affects retrieval quality, not
permission scope. (D) Agent Runtime is a deployment/execution
environment, not a permissions-configuration mechanism.

**Q9.** A team needs to connect a custom agent to a managed Cloud SQL
database that has no existing prebuilt MCP server for its specific
schema and query patterns. What's the correct approach per task 3.2's
guidance on capabilities?
A) This cannot be done; only prebuilt Google Cloud MCP Servers are
   supported
B) Build a custom integration layer (a custom MCP server) exposing
   the needed Cloud SQL operations, then register it in Agent Registry
   so it's discoverable and reusable
C) Give the agent direct raw database credentials with no integration
   layer at all
D) Use A2A to have another agent proxy the database queries at runtime

*Answer: B.* Task 3.2 explicitly names "custom integration layers for
managed databases" and "API integrations" as in-scope custom
capabilities, built and then registered for reuse — exactly this
scenario. (A) is false — the guide explicitly supports custom, not
just prebuilt, capabilities. (C) skips the integration-layer and
registry-based reuse pattern the guide describes, and creates an
unscoped credential-sharing risk. (D) misuses A2A, which is for
agent-to-agent coordination, not for proxying a data-access tool call.

**Q10.** An agent needs to create and update tickets in a third-party
SaaS project-management tool that the organization doesn't control the
backend of. Which task 3.2 tool is designed for exactly this?
A) Vector Search 1.0
B) An MCP server that connects the agent to the third-party SaaS
   tool's API
C) Agent Identity
D) A2A

*Answer: B.* Task 3.2 explicitly names "MCP server that connects
agents to third-party SaaS tools and remote servers" as an in-scope
capability pattern. (A) is a retrieval/vector-database concept,
unrelated to a ticketing API. (C) scopes permissions, it doesn't
provide the actual tool-connectivity mechanism. (D) is the
agent-to-agent protocol, not the agent-to-external-tool one.

**Q11.** Which correctly distinguishes "prebuilt" from "custom"
capabilities as task 3.2 frames them?
A) Prebuilt capabilities are always faster but always less secure than
   custom ones
B) Prebuilt capabilities (e.g., Google Cloud MCP Servers exposing
   Google Cloud managed resources) are ready-made and maintained by
   Google; custom capabilities (e.g., a custom integration layer for a
   specific internal system) are built and maintained by the team for
   needs prebuilt options don't cover
C) Custom capabilities can never be registered in Agent Registry,
   only prebuilt ones can
D) There is no meaningful distinction; both terms refer to the same
   thing

*Answer: B.* This matches task 3.2's own phrasing — "prebuilt and
custom capabilities," with Google Cloud MCP Servers as the named
prebuilt example and custom integration layers/API integrations as the
named custom example. (A) makes an unsupported blanket security claim.
(C) is false — Agent Registry is explicitly the discovery/reuse layer
for both categories. (D) collapses a distinction the guide itself
draws with named examples on each side.

**Q12.** A retrieval pipeline for a low-stakes internal FAQ tool (e.g.,
"what time does the cafeteria open") currently includes a reranking
step after initial similarity search. The team is deciding whether to
keep it. What's the right tradeoff consideration?
A) Reranking should always be kept regardless of use case, since it
   never has a downside
B) For a low-precision-stakes use case like this, the extra
   latency/cost reranking adds may not be justified — reranking earns
   its cost most clearly when a wrong or imprecise top result is
   actually costly
C) Reranking must be removed entirely because it's incompatible with
   FAQ-style retrieval
D) Reranking has no effect on latency, only on relevance, so this
   tradeoff doesn't apply here

*Answer: B.* This is the inverse of the "reranking is justified when
precision stakes are high" principle — for a low-stakes, low-ambiguity
lookup, the added latency/cost may not be worth the marginal precision
gain. (A) ignores that reranking is a real cost/benefit tradeoff, not
a free win. (C) overstates the case — reranking is a legitimate
optional step here, not something structurally incompatible. (D) is
false — reranking is an additional scoring pass and does add latency.

**Q13.** A custom multi-agent system has three subagents that each
only need read access to a shared retrieval corpus — none should ever
be able to write, update, or delete corpus content. What's the correct
Agent Identity configuration approach?
A) Give all three subagents one shared identity with full read/write
   access, for simplicity
B) Configure each subagent's Agent Identity with read-only scope on
   the corpus, reflecting least privilege for their actual task needs
C) Agent Identity can only be configured at the whole-system level,
   never per-subagent
D) Skip Agent Identity configuration entirely since these are
   "just" read operations

*Answer: B.* Least-privilege scoping applies per-agent, and read-only
subagents should be scoped to exactly that — no broader access than
their task requires. (A) grants unnecessary write/delete privilege,
directly violating least privilege. (C) is false — per-agent identity
scoping, including within a multi-agent system, is exactly what Agent
Identity supports. (D) is a dangerous assumption — even read-only
access to sensitive corpora should still be deliberately scoped, not
left unconfigured.

**Q14.** A team registers a "PDF summarization" capability once in
Agent Registry, backed by a custom MCP server, instead of building
that logic separately into each of six different custom agents that
need it. What best-practice principle does this reflect?
A) Least-privilege access scoping
B) Register-once, discover-and-reuse — avoiding duplicated integration
   logic across multiple agents by using Agent Registry as the shared
   catalog
C) The agent-vs-human-mode principle
D) Identity propagation across multi-hop chains

*Answer: B.* This is the register-once/reuse pattern task 3.2's Agent
Registry framing describes directly — a shared capability catalog
avoids six separate, duplicated integrations. (A) is a permissions
principle, a related but distinct concern from capability reuse. (C)
is an autonomy/oversight toggle, unrelated. (D) is a Section 5
multi-hop identity-scope-preservation concept, not a capability-reuse
pattern.

## 3.3 — Orchestrating and coordinating agentic workflows

**Q15.** Two agents built and operated by two different internal teams
(using different frameworks) need to hand off a task to each other —
one delegating a sub-task and expecting a structured result back —
using an open, interoperable protocol rather than a point-to-point
custom integration. Which protocol fits?
A) MCP, since it's the general-purpose "connect anything" protocol
B) A2A (Agent2Agent), the protocol specifically designed for
   agent-to-agent task delegation and coordination
C) Neither protocol supports cross-team, cross-framework handoffs
D) Agent Registry, used as a communication protocol

*Answer: B.* This is precisely A2A's defined role — an interoperable
protocol for one agent to coordinate with another, including across
organizational/framework boundaries. (A) misapplies MCP, which
connects an agent to tools/data sources, not to another agent. (C) is
false — this cross-team handoff scenario is exactly what A2A exists
for. (D) mischaracterizes Agent Registry, which is a discovery
catalog, not a communication protocol.

**Q16.** A team builds a custom agent that needs to call a third-party
weather API as a tool, and also occasionally needs to hand a
complex sub-task to a separate specialist agent for deeper analysis.
They configure both connections using MCP. What's wrong with this
setup?
A) Nothing — MCP is correctly used for both connections
B) The specialist-agent handoff should use A2A, not MCP — MCP is for
   agent-to-tool/data-source connections (like the weather API); A2A is
   for agent-to-agent coordination
C) MCP cannot connect to any external API, including weather APIs
D) Both connections should instead use Agent Runtime

*Answer: B.* This is the core MCP-vs-A2A distinction — the weather
API tool call is correctly MCP, but delegating work to another agent
is an A2A use case, not an MCP one. (A) misses the agent-to-agent
misuse. (C) is false — MCP connecting to an external API tool (like
weather data) is a standard, correct use. (D) confuses a deployment
runtime with a coordination protocol.

**Q17.** A data pipeline has three strictly ordered stages: validate
input, transform data, then persist the result — each stage depends
entirely on the previous stage's completed output, with no branching
or concurrency possible. Which orchestration topology fits?
A) Parallel
B) Sequential
C) Graph workflow
D) A2A, used as the topology itself

*Answer: B.* A strict, ordered, no-branching dependency chain is the
definitional sequential-topology case. (A) parallel is for independent
sub-tasks with no ordering dependency, the opposite of this scenario.
(C) graph workflow's conditional branching/looping capability is
unneeded overhead here — there's no branching logic at all. (D)
confuses a coordination protocol (used within whatever topology is
chosen) with a topology itself.

**Q18.** A document-approval system has an agent draft a summary, a
second agent flag any policy-compliance issues, and — only if issues
are flagged — routes back to the drafting agent for revision before a
final human sign-off; if no issues are flagged, it proceeds straight
to sign-off. Which topology fits, and why?
A) Sequential, because there are only two agents involved
B) Parallel, since both agents are involved in the same workflow
C) Graph workflow, because the routing decision is conditional on an
   intermediate result (whether issues were flagged) and can loop back
D) A2A alone, without any topology, since A2A can express any workflow
   shape

*Answer: C.* Conditional branching based on an intermediate result,
plus a possible loop back, is exactly what graph workflows express and
what sequential or parallel topologies cannot. (A) undercounts what
matters — the issue isn't agent count, it's the conditional/looping
structure. (B) misapplies parallel, which is for concurrent, mutually
independent work, not this conditional routing. (D) again conflates a
coordination protocol with a topology — A2A would still be used for
the actual handoffs within whichever topology is selected.

**Q19.** Three independent agents each fact-check a different claim
from the same document concurrently, and a fourth "aggregator" agent
combines their three results into one final report only after all
three finish. What best describes this workflow's structure?
A) Purely sequential from start to finish
B) A parallel stage (the three independent fact-checks) followed by a
   dependent aggregation step — a composition of parallel execution
   with a subsequent step that depends on all of it completing
C) Purely parallel from start to finish, with no dependency anywhere
D) This structure isn't expressible with any named topology

*Answer: B.* The fact-checking stage is genuinely parallel (no
inter-dependency among the three), but the aggregation step depends on
all three finishing — a realistic composition rather than one pure
topology end-to-end. (A) mischaracterizes the concurrent fact-check
stage as ordered/dependent, which it isn't. (C) ignores that
aggregation is not independent of the fact-check outputs — it strictly
depends on them. (D) is false — this is a normal, expressible
composition of parallel-then-dependent steps.

**Q20.** In a multi-agent handoff, Agent A (data retrieval, read-only
scope) hands a task to Agent B (report generation) via A2A. Which
statement correctly describes what should happen to Agent B's
effective permissions as a result of this handoff?
A) Agent B should automatically inherit Agent A's full permission
   scope, since it's continuing the same overall task
B) Agent B keeps its own distinct, independently-scoped Agent Identity,
   set to what Agent B's own task actually needs — the handoff should
   not expand or collapse either agent's scope
C) Agent B should be granted broader permissions than Agent A by
   default, in case the report-generation step needs unanticipated data
D) Agent B should end up with no permissions at all, since it received
   a handoff rather than a direct user request

*Answer: B.* This is the least-privilege handoff principle — each
agent in a chain keeps its own distinct, appropriately-scoped Agent
Identity; a handoff is a coordination event, not a permission-inheritance
event. (A) and (C) both describe privilege-escalation risk (inheriting
or over-provisioning scope just because a handoff occurred). (D) swings
too far the other way — Agent B still needs whatever scoped permissions
its own task legitimately requires, or the handoff simply breaks;
"zero permissions" isn't the security best practice, "correctly scoped
permissions" is.

**Q21.** A workflow uses Agent Identity to scope each agent's
permissions, Agent Registry so agents can discover each other's
capabilities, and agent policies to govern how handoffs may occur —
all deployed to run on Agent Runtime. Which of these four correctly
answers "where does the workflow actually execute"?
A) Agent Identity
B) Agent Registry
C) Agent Runtime
D) Agent policies

*Answer: C.* Agent Runtime is the managed deployment/execution
environment — the "where it runs" answer among these four
coordination-and-governance tools named together in task 3.3. (A)
answers "what can each agent access," not where execution happens. (B)
answers "how do agents find each other's capabilities." (D) answers
"what handoff/behavior rules apply," not where execution occurs.

**Q22.** A small internal team, worried about complexity, decides to
build every multi-agent workflow — even a simple two-step "summarize
then translate" pipeline with no conditionality — as a graph workflow
by default, reasoning "it's the most powerful option so it's always
safe to use." What's the issue?
A) Graph workflows are technically incapable of expressing a two-step
   pipeline
B) This adds unnecessary design, testing, and observability overhead
   for a case a simple sequential topology would fully satisfy —
   matching topology to actual task structure matters, not defaulting
   to the most flexible option
C) There is no issue; maximal flexibility is always the correct default
D) This is only a problem if Agent Runtime is also involved

*Answer: B.* This is the same overhead-mismatch principle applied to a
different scenario — "summarize then translate" has a strict linear
dependency and needs none of graph workflow's conditional-branching
machinery. (A) is false — graph workflows can trivially express a
linear chain, the issue is unnecessary complexity, not incapability.
(C) is the exact anti-pattern being tested. (D) is an unrelated,
fabricated condition.

**Q23.** A vendor proposal refers to the custom-code vector-database
capability in this exam's scope as "Vertex AI Vector Search." Is this
the correct current terminology for the PAA exam?
A) Yes, that is exactly how the exam guide names it
B) No — the guide's in-scope tool list names this capability area as
   "Agent Retrieval and Vector Search 1.0"; older or generic Google
   Cloud product naming shouldn't be substituted as the exam-correct
   term
C) Yes, but only when paired with RAG Engine
D) No — the correct name is Agent Search

*Answer: B.* This is a naming-precision trap similar in kind to the
Agent Engine/Vertex AI Search corrections — the guide's own in-scope
list uses "Agent Retrieval and Vector Search 1.0" verbatim, and older,
more generally-known Google Cloud product branding shouldn't be
assumed interchangeable with it on this exam. (A) and (C) both accept
imprecise naming as if it were the guide's own term. (D) is a
different mix-up entirely — Agent Search is the Section 1 low-code
grounding connector, not the Section 3.2 custom-code vector-retrieval
capability.

**Q24.** A legacy on-premises system only exposes a SOAP API (no REST,
no existing MCP server). A custom agent needs to query it as part of
its workflow. What's the correct approach per task 3.2?
A) This cannot be integrated; only REST APIs are supported by MCP
B) Build a custom MCP server that wraps the SOAP API and exposes its
   functionality in an MCP-compatible way, then register it in Agent
   Registry for discovery/reuse
C) Use A2A to have a different agent proxy the SOAP calls
D) Route the request through Agent Search instead

*Answer: B.* Task 3.2 explicitly covers custom integration layers/API
integrations as an in-scope capability pattern — wrapping a legacy
protocol behind a custom MCP server is exactly this. (A) is false —
nothing restricts MCP servers to only wrapping REST APIs; the point of
a custom integration layer is bridging exactly this kind of gap. (C)
misapplies A2A, an agent-to-agent protocol, to what is fundamentally
an agent-to-tool integration problem. (D) confuses this with the
Section 1 low-code grounding connector, unrelated to a legacy API
integration.

**Q25.** An OSS (open-source) foundation model is made available to a
team exclusively through a fully-managed SaaS API endpoint they don't
operate themselves. Does this combination — OSS licensing delivered
via SaaS — make sense as a valid point in the model-selection
decision space?
A) No — OSS models can only ever be self-hosted by definition
B) Yes — OSS-vs-proprietary (licensing/inspectability) and
   self-hosted-vs-SaaS (who operates the infrastructure) are
   independent axes; an OSS model can be SaaS-delivered
C) No — SaaS delivery automatically makes any model proprietary
D) Yes, but only for SLMs, never for LLMs

*Answer: B.* These two axes are independent: licensing/auditability
(OSS vs. proprietary) is a different question from who operates the
serving infrastructure (self-hosted vs. SaaS) — an OSS model served
through a managed SaaS endpoint is a real, valid combination. (A) and
(C) both collapse two genuinely independent axes into one, which is
the exact misconception this question tests. (D) fabricates a
size-based restriction that doesn't follow from either axis's
definition.

**Q26.** A custom agent originally built using an SLM for a narrow
classification task is later asked to also handle open-ended,
nuanced customer questions requiring broad general knowledge, and its
quality noticeably suffers on the new questions. What does this
illustrate about SLM tradeoffs?
A) SLMs are strictly worse than LLMs at every task, so they should
   never be used
B) SLMs' efficiency/cost/latency advantage comes with narrower
   capability — a good fit for the original narrow task can become a
   poor fit once scope expands to broad, nuanced reasoning the SLM
   wasn't sized for
C) This is unrelated to model size; the issue must be a prompting
   problem
D) SLMs and LLMs perform identically on all task types by design

*Answer: B.* This is the necessary "when NOT to use an SLM" side of
the tradeoff — narrow-task efficiency doesn't generalize to broad,
open-ended reasoning; scope expansion is a legitimate signal to
re-evaluate the size-axis choice. (A) overgeneralizes into a blanket
claim the guide doesn't support — SLMs remain the right choice for
their original narrow use case. (C) dismisses a well-documented,
real tradeoff without justification. (D) is directly contradicted by
the very premise of the size axis existing as a design decision.

**Q27.** A workflow includes a step where a specialist agent must
receive exactly the originating user's actual permission scope when it
picks up a handed-off task — never a broader, more privileged scope
for convenience. Which Section 3.3 concept governs enforcing this at
the orchestration level, working alongside Agent Identity?
A) Reranking
B) Agent policies — governance/behavioral rules constraining how
   agents in a workflow may hand off tasks and what they're permitted
   to do
C) Managed sessions
D) Few-shot prompting

*Answer: B.* Task 3.3 names agent policies as the workflow-level
governance mechanism for handoff behavior and permitted actions,
complementing each individual agent's own Agent Identity scope. (A) is
a RAG-pipeline relevance concept, unrelated to handoff governance. (C)
is single-interaction state tracking, not a governance mechanism. (D)
is a Section 1 low-code prompting technique, unrelated here.

**Q28.** A team building a multi-agent customer-service system debates
whether to use one single monolithic agent that tries to handle
intake, troubleshooting, and billing all itself, or several
specialized agents (intake, troubleshooting, billing) coordinated via
A2A handoffs with a defined topology. Per this section's design
principles, what should drive the decision?
A) Always prefer the single monolithic agent — fewer moving parts is
   always better
B) Whether the sub-tasks have genuinely distinct scopes, tool needs,
   and permission requirements that benefit from separation and
   least-privilege scoping — not complexity avoidance for its own sake
C) Always prefer multiple specialized agents — more agents is always
   more robust
D) The decision should be made randomly, since the guide expresses no
   preference either way

*Answer: B.* This mirrors the "match structure to actual task needs"
principle applied at the agent-decomposition level — genuinely
distinct scopes/permissions (e.g., billing needing different data
access than intake) justify separate, least-privilege-scoped agents;
if the sub-tasks don't actually differ that way, a single agent may be
simpler and sufficient. (A) and (C) both apply a blanket rule instead
of reasoning from the actual task structure. (D) is false — the guide
consistently frames these as reasoned tradeoffs, not indifferent
choices.

**Q29.** Which of the following is the most accurate description of
what "Agent Retrieval" refers to, as grouped in the exam guide's
in-scope tool list alongside Vector Search 1.0?
A) A low-code, Section 1 grounding connector unrelated to custom code
B) Part of the custom-code vector-retrieval capability area used when
   building RAG pipelines with tools like ADK — grouped with Vector
   Search 1.0 in the guide's own in-scope list, distinct from Agent
   Search
C) A synonym for Agent Registry
D) A deprecated predecessor to Agent Search

*Answer: B.* The guide's in-scope list groups "Agent Retrieval and
Vector Search 1.0" together as one custom-code retrieval capability
area, distinct from the Section 1 low-code Agent Search connector. (A)
incorrectly reclassifies it as the low-code tool. (C) conflates two
unrelated tools — Agent Registry is a capability-discovery catalog,
not a retrieval mechanism. (D) fabricates a deprecation relationship
not supported by the guide, which lists both Agent Retrieval/Vector
Search 1.0 and Agent Search as separate, currently in-scope items.

**Q30.** A workflow needs to combine (a) a strict two-step linear
pre-processing chain, (b) three independent enrichment agents that can
run concurrently once pre-processing finishes, and (c) a final
conditional step that routes to either an "auto-approve" or
"escalate" path depending on the enrichment agents' combined
confidence score. Which best describes the correct topology design?
A) A single, uniform sequential topology for the entire workflow
B) A single, uniform parallel topology for the entire workflow
C) A composed topology: sequential for the pre-processing chain,
   parallel for the concurrent enrichment stage, and graph-workflow-style
   conditional routing for the final branching decision — matching
   each stage's actual structure rather than forcing one topology
   across the whole workflow
D) This cannot be modeled with any of the named topologies and
   requires a custom protocol outside A2A/MCP

*Answer: C.* Real workflows often compose multiple topology patterns
stage by stage, matching each stage's actual dependency/branching
structure — exactly what (a), (b), and (c) individually call for. (A)
forces the concurrent enrichment stage into unnecessary serialization.
(B) forces the strictly-ordered pre-processing chain and the
conditional final step into a topology neither can correctly express.
(D) is false — A2A (for the handoffs) and the three named topology
patterns fully cover this composition; no additional protocol is
required.
