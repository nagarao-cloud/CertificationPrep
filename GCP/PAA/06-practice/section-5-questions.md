# Section 5 — additional practice questions (16)

> Securing and governing agentic workflows (~15% of the exam). These
> 16 questions are **additional** to the 16 already at the end of
> `01-domains/SECTION-5-secure-govern.md` — different scenarios, no
> wording overlap. Every option is explained inline.

## 5.1 — Configuring agent security and governance

**Q1.** A custom agent needs to call a third-party invoicing API on a
customer's behalf. Which mechanism handles obtaining and refreshing
the credentials for that specific agent-to-tool API call?
A) Model Armor
B) Auth Manager, using OAuth 2.0
C) Agent Gateway
D) Agent Registry

*Answer: B.* Task 5.1 explicitly names OAuth 2.0 via Auth Manager for
authenticating agent-to-tool API calls, including obtaining/refreshing
tokens. (A) screens content for policy violations, it doesn't manage
authentication. (C) monitors traffic after the fact, it doesn't handle
the authentication flow itself. (D) is a capability-discovery catalog,
unrelated to authentication.

**Q2.** A platform team defines an outer boundary stating "this agent
may never, under any configuration or prompt, access the payroll
database" — a limit meant to hold regardless of what the agent is
later asked to do. Which mechanism is this?
A) Agent Gateway traffic rules
B) A PAB (principal access boundary) policy, configured via Agent
   Identity
C) Model Armor content filtering
D) HITL approval

*Answer: B.* This is exactly PAB's defining role — a hard outer
access boundary for an agent principal, configured through Agent
Identity, independent of runtime prompts or requests. (A) monitors
traffic, it doesn't define the access boundary itself. (C) screens
content for safety violations, not data-access limits. (D) is a
per-action human-approval checkpoint, a different (complementary)
mechanism from a standing access boundary.

**Q3.** A security team wants to detect, in near real time, that a
specific agent has begun calling an internal service far more
frequently than its historical baseline — a possible sign of a
misbehaving or compromised agent. Which tool is purpose-built for
this?
A) Auth Manager
B) Agent Gateway, which monitors traffic and tracks agent behavior
   patterns
C) Agent Identity
D) Skill Registry

*Answer: B.* Task 5.1 names Agent Gateway specifically for monitoring
traffic and tracking agents — anomaly detection over call volume is
exactly this kind of visibility. (A) handles authentication, not
traffic-pattern monitoring. (C) defines what an agent is allowed to
access, not what it's actually doing at runtime. (D) is a capability
catalog, unrelated to traffic monitoring.

**Q4.** A governance team wants a formal review/approval process
before any new capability can be published into the shared catalog
that all agents can discover and reuse. Which named consideration
under task 5.1 does this reflect?
A) OAuth 2.0 token scoping
B) Designing and configuring agentic governance and policy enforcement
   over Agent Registry — treating what gets registered as itself
   subject to review, not an unmoderated free-for-all
C) PAB policy configuration
D) Agent Gateway traffic thresholds

*Answer: B.* Task 5.1 explicitly names Agent Registry under agentic
governance and policy enforcement — the catalog itself needs
governance over what's allowed into it. (A) is an authentication-scope
mechanism, unrelated to catalog review. (C) is an access-boundary
mechanism, a different governance layer from capability-catalog review.
(D) is a traffic-monitoring concept, not a publication-approval
process.

**Q5.** An organization currently grants every agent, regardless of
task, the same broad standing OAuth 2.0 scope "just in case it's
needed later." What principle does this violate, and what should
replace it?
A) No principle is violated; broad standing scope is the recommended
   default for flexibility
B) This violates least-privilege scoping — each agent's OAuth 2.0
   token should be scoped to only the specific permissions its actual
   task requires, not a broad standing grant
C) This should be replaced with Model Armor content filtering instead
D) This is only a concern for coding agents, not custom agents

*Answer: B.* Least-privilege token scoping (§1.1 of the security
section) is the direct governing principle here — "just in case"
broad access is the anti-pattern it exists to prevent. (A) endorses
the anti-pattern outright. (C) confuses an unrelated mechanism
(content screening) with access-scope design. (D) is false — least-
privilege scoping applies broadly across agent types, not one category.

**Q6.** Which pairing correctly distinguishes Auth Manager from PAB
(via Agent Identity)?
A) Both are the same mechanism, just configured through different UIs
B) Auth Manager handles the authentication mechanics of an
   agent-to-tool call (e.g., OAuth 2.0 token flow); PAB defines the
   outer boundary of what that agent principal is ever allowed to
   access, independent of any single call
C) PAB handles authentication; Auth Manager defines access boundaries
D) Neither relates to security; both are purely observability tools

*Answer: B.* This is the authentication-versus-authorization-boundary
distinction task 5.1 draws across its own named considerations. (A)
collapses two genuinely different mechanisms. (C) reverses their
actual roles. (D) mischaracterizes both — neither is an observability
tool (that's Agent Gateway/Cloud Trace/Cloud Logging's role).

## 5.2 — Implementing secure agent behavior and execution

**Q7.** Which three tools/concepts does task 5.2 name together as
components of "safety frameworks and guardrails," and what does each
contribute?
A) Auth Manager (authentication), PAB (access boundary), Agent Registry
   (discovery) — none of which is named under task 5.2's safety-
   framework bullet
B) Agent Gateway (traffic visibility), Model Armor (content-safety
   screening), and HITL (mandatory human checkpoint for high-stakes
   actions) — each addressing a different layer of runtime safety
C) ADK, Agent Runtime, Agent Search — deployment and grounding tools
   unrelated to safety-framework design
D) Vector Search 1.0, RAG Engine, Agent Retrieval — retrieval-pipeline
   tools unrelated to safety-framework design

*Answer: B.* This is the verbatim task 5.2 example list, and each
contributes a distinct layer: standing traffic visibility (Gateway),
automated content-policy screening (Model Armor), and a human judgment
checkpoint for consequential actions (HITL). (A), (C), and (D) all
list tools that belong to different tasks/sections entirely, not task
5.2's named safety-framework grouping.

**Q8.** A multi-hop chain has a user request flow through Agent A,
then a tool call, then Agent B, then a downstream database query. At
each hop, the effective access used should reflect:
A) A newly-created broad shared identity at each hop, chosen for
   simplicity of configuration
B) The originating principal's actual, bounded permission scope,
   correctly carried through — never expanded — at each hop, per the
   identity-propagation principle
C) Whatever access level is fastest to configure at each individual
   hop, decided independently per hop
D) The most powerful identity available in the system, to avoid
   permission-denied errors mid-chain

*Answer: B.* This is identity propagation as task 5.2 defines it —
preserving, never expanding, the originating principal's scope across
every hop of a multi-agent/multi-tool chain. (A) and (D) both describe
the anti-pattern (broad or maximal shared identity) identity
propagation exists to prevent. (C) optimizes for convenience over
correctness, risking exactly the same anti-pattern.

**Q9.** A team configures HITL approval for a very narrow set of
actions — permanently deleting a customer's account and issuing
refunds above a defined dollar threshold — while letting all other,
lower-stakes actions proceed autonomously under standing Agent
Gateway monitoring and Model Armor screening. Is this a well-designed
safety framework, per Section 5.2's principles?
A) No — HITL should be applied to every single action an agent can
   take, without exception
B) Yes — this matches the guidance to scope HITL to genuinely
   high-stakes/irreversible actions specifically, while lower-stakes
   actions proceed autonomously under standing automated controls
C) No — Model Armor and Agent Gateway alone are never sufficient for
   any action, HITL-gated or not
D) Yes, but only because refunds are involved; account deletion should
   always require a different mechanism entirely

*Answer: B.* This is exactly the recommended scoping — HITL reserved
for high-stakes/irreversible actions, standing automated controls
(Gateway, Model Armor) covering the rest, rather than either extreme
of blanket HITL or no HITL at all. (A) is the flagged over-application
anti-pattern (mirrors the "agent vs. human mode" over-correction
elsewhere in this folder). (C) overstates a limitation not supported
by the guide — automated controls are explicitly named as valid
standing safeguards for lower-stakes actions. (D) invents an
unsupported mechanism split between the two named high-stakes actions.

**Q10.** A content-safety review shows an agent's output for a
high-stakes financial transaction passed every Model Armor policy
check. Does this mean it is safe for the agent to autonomously execute
the transaction?
A) Yes — passing content-safety screening is sufficient for any action
B) Not necessarily — Model Armor screens content for policy
   violations, which is a different concern from whether the specific
   consequential action should actually be allowed to execute
   autonomously; that judgment is what HITL exists to add
C) Yes, but only if the agent is built with ADK
D) No — Model Armor cannot be used for any financial-related content

*Answer: B.* This is the explicit tradeoff — content-policy compliance
and action-consequence judgment are different concerns, and a
policy-compliant piece of content doesn't establish that the
underlying action is safe to execute without a human checkpoint. (A)
conflates the two different concerns. (C) is a fabricated tool-specific
carve-out. (D) is false and unsupported — Model Armor's applicability
isn't restricted by content domain in this way.

**Q11.** Which statement correctly distinguishes "secure tool
execution" (task 5.1) from "secure access to data and identity
propagation" (task 5.2)?
A) They are identical concepts stated twice
B) Secure tool execution (5.1) is about authenticating and
   authorizing the agent-to-tool call itself (e.g., OAuth 2.0); secure
   data access/identity propagation (5.2) is about correctly carrying
   scope through multi-hop chains once execution is already underway
C) Task 5.2 replaces the need for task 5.1's authentication mechanisms
D) Task 5.1 only applies to coding agents; task 5.2 only applies to
   custom agents

*Answer: B.* This reflects the 5.1-control-plane-configuration versus
5.2-runtime-behavior-and-data-handling framing used consistently in
this section — related but distinct concerns at different points in
an action's lifecycle. (A) collapses a real distinction. (C) is false
— they're complementary, not substitutes; identity propagation still
depends on the underlying authentication task 5.1 sets up. (D) is a
fabricated scope restriction not supported anywhere in the guide.

**Q12.** A vendor pitches "our platform doesn't need Agent Gateway
because we already use Model Armor for safety." Is this a sound
substitution?
A) Yes — Model Armor alone fully covers both content safety and
   traffic monitoring
B) No — Model Armor screens content for policy violations; Agent
   Gateway provides a different, complementary capability (traffic
   visibility/tracking of what agents are actually doing), and neither
   substitutes for the other
C) Yes, because Agent Gateway is deprecated in favor of Model Armor
D) No, because Model Armor requires Agent Gateway to function at all

*Answer: B.* These are two distinct, complementary Section 5 tools
addressing different layers (content-safety screening versus traffic/
behavior visibility) — using one doesn't provide the other's coverage.
(A) overclaims Model Armor's scope. (C) is fabricated — both are
distinct, active, in-scope tools. (D) reverses an unsupported
dependency claim; neither strictly requires the other to function.

**Q13.** A multi-agent workflow hands a task from Agent A to Agent B to
a downstream tool. At the tool-call step, the system defaults to using
a single broad service account "to keep the integration simple,"
regardless of which end user originally made the request. What is the
correct fix, per task 5.2?
A) No fix needed — a single shared service account is the recommended
   default for simplicity
B) Replace the shared service-account pattern with proper identity
   propagation, so the tool call's effective access reflects the
   actual originating principal's bounded scope, not a broad shared
   default
C) Add Model Armor content screening at the tool-call step instead
D) This is exclusively a Section 3 orchestration concern, with no
   Section 5 relevance

*Answer: B.* This is the exact anti-pattern-and-fix pairing task 5.2's
identity-propagation concept addresses — collapsed accountability and
expanded blast radius from a shared identity, fixed by propagating the
real originating scope through each hop. (A) endorses the anti-pattern.
(C) confuses content-safety screening with an access-identity problem
— a different concern. (D) is false — this is explicitly named under
task 5.2 ("configuring secure access to data and identity propagation").

**Q14.** True or False: because both HITL (task 5.2) and "agent vs.
human mode" (Sections 2.2 and 3.1) involve a human in the process, the
exam treats them as two entirely separate, unrelated concepts with no
conceptual overlap worth recognizing.
A) True — they are unrelated and should never be connected when
   answering a question
B) False — they describe the same underlying design idea (mandatory
   or configurable human checkpoints for certain actions) surfaced in
   different sections' framing: coding-agent operation mode, custom-
   agent skill mode, and Section 5's safety-framework language
C) True, because HITL only applies to security scenarios, never to
   coding or custom agents
D) False, only because Section 5 is a simple rename of "human mode"
   with no other distinction

*Answer: B.* Recognizing this conceptual continuity (the same
underlying human-checkpoint idea, applied at different points across
Sections 2, 3, and 5) is exactly the kind of cross-section pattern the
exam rewards. (A) and (C) both wrongly treat the sections as
disconnected silos. (D) understates the connection as "just a rename"
rather than the same design principle applied consistently at
different points in the guide's task structure.

**Q15.** An architect designs a system where every agent's OAuth 2.0
token is scoped narrowly to its specific task (task 5.1), PAB policies
bound each agent's outer access limits (task 5.1), Agent Gateway
monitors all traffic (task 5.1), and identity propagation preserves
scope across every multi-hop chain (task 5.2), with HITL reserved for
genuinely high-stakes actions (task 5.2). What does this design
demonstrate?
A) Unnecessary redundancy — any single one of these mechanisms would
   be sufficient on its own
B) Defense in depth across both Section 5 tasks — control-plane
   configuration (5.1: authentication, access boundaries, traffic
   visibility, governance) working together with runtime behavior-level
   safeguards (5.2: guardrails and identity propagation), rather than
   relying on any single mechanism alone
C) A misconfiguration, since PAB and OAuth 2.0 scoping address the
   same concern and shouldn't both be used
D) This design only makes sense for coding agents, not custom agents

*Answer: B.* This is the intended layered-security picture across
task 5.1 (control plane) and task 5.2 (runtime behavior/data
handling) working together — no single mechanism here substitutes for
the others; each addresses a different layer. (A) misunderstands
layered security as redundancy rather than complementary coverage. (C)
incorrectly treats authentication scoping (OAuth 2.0) and access-
boundary definition (PAB) as the same mechanism — they are distinct,
per Q6 above. (D) is an unsupported restriction; nothing limits this
design to coding agents specifically.

**Q16.** Which of the following is NOT one of the considerations named
under task 5.2, and instead belongs to a different task entirely?
A) Designing appropriate safety frameworks and guardrails (e.g., Agent
   Gateway, Model Armor, HITL)
B) Configuring secure access to data and identity propagation (e.g.,
   Agent Gateway and Agent Registry)
C) Configuring PAB policies using Agent Identity
D) Both A and B are genuinely task 5.2 considerations; only C belongs
   elsewhere

*Answer: D.* (A) and (B) are both verbatim task 5.2 bullets. (C) —
"configuring principal access boundary (PAB) policies using Agent
Identity" — is a task 5.1 consideration, not task 5.2, making it the
one that belongs elsewhere; this question tests whether a candidate
can correctly place a concept in its actual task within the same
section, a common source of near-miss exam traps.
