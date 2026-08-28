# Section 5 — Securing and governing agentic workflows (~15%)

> Source of truth: `00-START-HERE/RUNBOOK.md` §3, Section 5 (verbatim
> task bullets). Tasks covered: **5.1** (configuring agent security and
> governance) and **5.2** (implementing secure agent behavior and
> execution).
>
> Currency reminder: **PAB (principal access boundary) is a specific
> named mechanism configured via Agent Identity** — not a generic IAM
> concept. Treat it as agent-specific access-boundary configuration.
> Say **"Agent Runtime"**, not "Agent Engine," if a question's
> distractor tries to slip the old name in here too.

---

## 0. Where Section 5 sits in the exam's mental model

Section 5 is the governance layer that sits **around** everything built
in Sections 1-4: it doesn't introduce new agent-building capability so
much as it constrains, authenticates, monitors, and gates the
capability already built. Think of it as the answer to: *given
everything an agent can now do (call tools, retrieve enterprise data,
hand off to other agents, run in production), what stops it from doing
the wrong thing, and what proves it only did the right thing?*

```
   ┌───────────────────────────────────────────────────────────────┐
   │                    SECTION 5: SECURITY & GOVERNANCE               │
   │                                                                     │
   │  5.1 CONFIGURE                          5.2 IMPLEMENT              │
   │  ┌─────────────────────┐        ┌─────────────────────────┐      │
   │  │ Auth (OAuth 2.0)       │        │ Safety frameworks/         │      │
   │  │ PAB via Agent Identity │        │ guardrails (Agent Gateway,│      │
   │  │ Agent Gateway            │        │ Model Armor, HITL)          │      │
   │  │ (monitor/track)          │        │ Secure data access/           │      │
   │  │ Governance/policy         │        │ identity propagation           │      │
   │  │ (Agent Registry,           │        │ (Agent Gateway, Agent           │      │
   │  │ Model Armor)                │        │ Registry)                        │      │
   │  └─────────────────────┘        └─────────────────────────┘      │
   │           ▲                                       ▲                  │
   │           └───────────────────┬───────────────────┘                  │
   │                                 │ wraps around                        │
   └─────────────────────────────────┼──────────────────────────────────┘
                                       ▼
              ┌──────────────────────────────────────────┐
              │  Everything built in Sections 1-4:           │
              │  low-code agents, coding agents, custom       │
              │  ADK agents, orchestrated multi-agent           │
              │  systems, deployed/scaled production workloads │
              └──────────────────────────────────────────┘
```

5.1 is mostly about **configuring the control plane** (auth,
permissions, traffic visibility, policy). 5.2 is mostly about
**implementing behavior-level guardrails and secure data/identity
handling at execution time**. They overlap by design — Agent Gateway
and Agent Registry appear in both tasks because traffic monitoring and
capability governance are relevant both to *configuring* the system
and to how it *behaves* at runtime.

---

## 1. Task 5.1 — Configuring agent security and governance

### 1.1 Authentication and secure tool execution: OAuth 2.0 for agent-to-tool calls

Task 5.1's first bullet: **"Implementing authentication and secure
tool execution (e.g., agent-to-tool API calls using OAuth 2.0)."**

The exam assumes you already know OAuth 2.0 as general vocabulary
(per this folder's `CLAUDE.md` §8 — it's listed as assumed-known
general cloud vocabulary, not re-explained from scratch). What's
exam-specific here is the **application**: OAuth 2.0 is the mechanism
for authenticating **agent-to-tool** API calls — an agent acting as a
client authenticating to a tool/API it needs to call, the same way a
traditional application authenticates to an external API, but now the
caller is an autonomous agent rather than a human-driven client.

The exam's in-scope tool list also names **Auth Manager (OAuth 2.0)**
explicitly — treat "Auth Manager" as the named Google Cloud mechanism
for managing this OAuth 2.0-based agent-to-tool authentication flow
(credential/token management for agent-initiated API calls), distinct
from Agent Identity (which governs *what* an agent is authorized to
access — the authorization/permission-boundary layer) and distinct
from Agent Gateway (which monitors/tracks the resulting traffic).

```
        ┌───────────────┐
        │  Custom agent    │
        │  (needs to call   │
        │  an external API) │
        └───────┬────────────┘
                 │ 1. request access token
                 ▼
        ┌───────────────┐
        │  Auth Manager     │  2. OAuth 2.0 flow — agent
        │  (OAuth 2.0)       │     authenticates as a client,
        │                     │     obtains a scoped token
        └───────┬────────────┘
                 │ 3. token issued, scoped to
                 │    permitted actions
                 ▼
        ┌───────────────┐
        │  Tool / external  │  4. agent presents token,
        │  API                │     tool validates and
        │                     │     executes the authorized
        │                     │     call
        └───────────────┘
```

Diagram walkthrough: step 3's "scoped" qualifier is the exam-relevant
detail — the OAuth token an agent obtains should be scoped to only the
actions it actually needs, consistent with the least-privilege
principle that recurs across Agent Identity/PAB (§1.2 below) as well.

**Don't use** long-lived, broadly-scoped static credentials embedded
directly in an agent's configuration for tool authentication — that's
a standing security liability (credential leakage risk, no
per-call scoping, no easy revocation). **Use** OAuth 2.0-based,
appropriately scoped, token-based authentication via Auth Manager for
agent-to-tool calls instead.

### 1.2 Configuring PAB policies using Agent Identity

Task 5.1's second bullet: **"Configuring principal access boundary
(PAB) policies using Agent Identity."** This is flagged as one of the
most important currency corrections in this folder — treat PAB as a
**specific, named, agent-focused mechanism**, not a generic IAM
concept you already know from elsewhere.

**PAB (principal access boundary)** defines the outer limit of what an
agent (acting as a "principal" — the entity performing actions) is
permitted to access or do, configured specifically through **Agent
Identity**. Conceptually, think of a PAB policy as a *boundary*, not a
grant: it doesn't hand out permissions by itself so much as it caps
the maximum scope any permission an agent holds can ever reach —
even if some other misconfiguration tried to grant an agent broader
access, a correctly configured PAB policy would still constrain the
effective boundary.

```
                 ┌────────────────────────────────┐
                 │  Agent Identity                    │
                 │  (per-agent identity/permission      │
                 │   configuration surface)              │
                 └───────────────┬────────────────────┘
                                   │ configures
                                   ▼
                 ┌────────────────────────────────┐
                 │  PAB (principal access boundary)   │
                 │  policy — the outer limit on what     │
                 │  this agent (as a "principal") can      │
                 │  ever access or do, regardless of        │
                 │  any other permission grant                │
                 └───────────────┬────────────────────┘
                                   │ bounds
                                   ▼
                 ┌────────────────────────────────┐
                 │  This agent's effective access        │
                 │  (data sources, tools, actions)          │
                 └────────────────────────────────┘
```

**Don't treat** PAB as interchangeable with "a generic IAM role" —
that conflation is the specific trap this folder's currency
corrections table exists to prevent. A generic IAM role is a grant of
permission; PAB is a *boundary* mechanism layered specifically for
agent principals via Agent Identity. **Use** the guide's own framing:
PAB policies, configured through Agent Identity, are agent-specific
access-boundary configuration.

**Don't use** a single shared, maximally-broad PAB policy across every
agent in an enterprise for convenience — that reintroduces exactly the
blast-radius risk Section 3.2's "don't use a single maximally-privileged
shared identity" guidance warns against. **Use** a distinct, minimally
scoped PAB policy per agent (or per agent role/class), matched to that
agent's actual task requirements.

### 1.3 Agent Gateway: monitoring traffic and tracking agents

Task 5.1's third bullet: **"Configuring Agent Gateway to monitor
traffic and track agents."** **Agent Gateway** is the traffic-level
visibility and tracking mechanism for agent activity — the component
that lets you see what agents are actually doing at the network/API-call
level: which agent made which call, to which tool/service, when, and
(often) whether it succeeded.

This distinguishes Agent Gateway from the other Section 5 tools by
layer:

| Tool | Layer / question it answers |
|---|---|
| **Auth Manager (OAuth 2.0)** | *Can this agent authenticate to call this tool?* (identity/credential layer) |
| **Agent Identity / PAB** | *What is this agent allowed to access, at most?* (authorization-boundary layer) |
| **Agent Gateway** | *What is this agent actually doing, right now and historically?* (traffic monitoring/tracking layer) |
| **Agent Registry** | *What capabilities exist, and which agents/policies reference them?* (capability catalog/governance layer) |
| **Model Armor** | *Is this specific input/output safe, per content-safety policy?* (content-safety/policy-enforcement layer) |

**Don't use** Agent Gateway as a substitute for PAB/Agent Identity's
access-boundary enforcement — Agent Gateway observes and tracks
traffic; it is not, by itself, the mechanism that defines what an
agent is authorized to do (that's PAB via Agent Identity). **Use**
Agent Gateway for visibility/monitoring, and Agent Identity/PAB for
the actual authorization boundary — the two are complementary, not
substitutes for each other.

### 1.4 Agentic governance and policy enforcement: Agent Registry and Model Armor

Task 5.1's fourth bullet: **"Designing and configuring agentic
governance and policy enforcement (e.g., Agent Registry and Model
Armor)."**

- **Agent Registry** (introduced in Section 3.2/3.3 as a
  capability-discovery mechanism) has a governance dimension too: it's
  where an organization can see and control what capabilities exist,
  which agents are registered to use them, and enforce policy over
  what gets registered and reused in the first place — governance
  through visibility and control of the capability catalog.
- **Model Armor** is the exam's named safety/governance tooling for
  content-level policy enforcement — screening inputs and outputs for
  policy violations (unsafe content, prompt-injection-style attacks,
  sensitive data exposure) as part of the agent's execution path.
  Model Armor recurs in Section 5.2 as a named safety-framework
  component (alongside Agent Gateway and HITL), because content-safety
  enforcement spans both the "configure governance" task (5.1) and
  the "implement runtime safety behavior" task (5.2).

**Don't use** Agent Registry purely as a technical convenience
(capability reuse, discovery) without also treating it as a governance
control point — per task 5.1, it's explicitly named as part of
*policy enforcement*, meaning what gets registered, and by extension
what's discoverable/reusable across agents, should itself be subject
to review/policy, not an unmoderated free-for-all. **Use** Agent
Registry's cataloging function together with governance review over
what enters the catalog.

---

## 2. Task 5.2 — Implementing secure agent behavior and execution

### 2.1 Safety frameworks and guardrails: Agent Gateway, Model Armor, and HITL

Task 5.2's first bullet: **"Designing appropriate safety frameworks and
guardrails (e.g., Agent Gateway, Model Armor, and human-in-the-loop
[HITL])."** Three components working at different points in an agent's
execution:

- **Agent Gateway** (as in 5.1, now applied to runtime safety) —
  ongoing traffic monitoring/tracking is itself a safety mechanism:
  anomalous agent behavior (unusual call volume, unexpected
  destinations, unusual patterns) becomes visible and actionable
  because Agent Gateway is tracking it continuously.
- **Model Armor** (as in 5.1, now applied to runtime safety) —
  active, in-the-loop screening of inputs/outputs for policy
  violations at execution time, not just a design-time governance
  configuration.
- **HITL (human-in-the-loop)** — inserting a mandatory human
  checkpoint before a high-stakes or irreversible agent action
  executes. This is the same concept referenced in Sections 2.2 and
  3.1 as "human mode" (vs. agent mode) — HITL is the safety-framework
  framing of that same underlying idea: certain actions should not
  execute purely autonomously.

```
        ┌──────────────────────────┐
        │  Agent attempts an action   │
        └─────────────┬──────────────┘
                       │
        ┌───────────────┼────────────────┐
        ▼               ▼                  ▼
  ┌───────────┐  ┌──────────────┐  ┌──────────────────┐
  │ Agent       │  │ Model Armor    │  │ Is this action a   │
  │ Gateway     │  │ (screen input/  │  │ high-stakes/         │
  │ (log/track  │  │  output for      │  │ irreversible one       │
  │  the call)   │  │  policy            │  │ requiring HITL?         │
  │              │  │  violations)      │  └─────────┬──────────────┘
  └───────────┘  └──────────────┘        yes │    no
                                        ┌──────┘    └─────┐
                                        ▼                  ▼
                              ┌──────────────┐    ┌───────────────┐
                              │ Human review/  │    │ Action proceeds │
                              │ approval gate   │    │ autonomously      │
                              └──────────────┘    └───────────────┘
```

Diagram walkthrough: an agent's attempted action passes through
tracking (Agent Gateway) and content-safety screening (Model Armor) as
standing controls on every action, while a separate decision (based on
the action's stakes/reversibility) determines whether a HITL checkpoint
is also required before execution proceeds. All three layers can apply
simultaneously to a single action — they're not mutually exclusive
alternatives.

**Don't use** HITL for every single agent action indiscriminately —
that eliminates the efficiency benefit of autonomy in the first place
and doesn't scale; it's the same over-correction flagged in Section
3.1's "don't set the entire agent to human mode globally" guidance.
**Use** HITL selectively, gated on an action's actual stakes/
reversibility, while lower-stakes actions proceed autonomously under
Agent Gateway/Model Armor's standing monitoring and screening.

**Don't use** Model Armor screening alone as a complete safety
framework for high-stakes actions — content-safety screening catches
policy-violating *content*, but doesn't substitute for a human
judgment checkpoint on whether a specific *action* (even with
policy-compliant content) should actually execute. **Use** HITL
alongside Model Armor when an action's real-world consequences are
significant, not just when its content might be unsafe.

### 2.2 Secure access to data and identity propagation

Task 5.2's second bullet: **"Configuring secure access to data and
identity propagation (e.g., Agent Gateway and Agent Registry)."**

**Identity propagation** is the key concept here: in a multi-agent or
multi-hop system (an agent calling a tool, which calls another
service, or an agent handing off to another agent — Section 3.3), the
*originating* identity/permission context needs to be correctly
carried through each hop, rather than each hop defaulting to its own
broad service identity. This connects directly back to Section 3.3's
handoff-scoping guidance: **Agent B should execute under its own
distinct Agent Identity, not silently inherit Agent A's broader
access** — identity propagation is the mechanism-level detail of how
that's actually implemented and enforced across hops, tracked via
Agent Gateway (visibility into the actual propagated calls) and
governed via Agent Registry (which capabilities are registered as
receiving which propagated identity/scope).

**Don't use** a flattened, single "service account" style identity
shared uniformly across every hop of a multi-agent/multi-tool chain —
this collapses accountability (you can no longer tell which specific
original request/user/agent actually caused a downstream action) and
widens blast radius. **Use** proper identity propagation, where each
hop's effective access reflects the actual originating principal's
scope (bounded further, never expanded, at each hop), visible via
Agent Gateway.

---

## 3. Section 5 tool-layer comparison matrix

A single consolidated view of every Section 5 tool, since several
exam questions test whether you can place a tool in the *right layer*
rather than just define it in isolation:

| Tool | Primary question it answers | Configured in task | Also appears in |
|---|---|---|---|
| **Auth Manager (OAuth 2.0)** | Can this agent authenticate to call this tool? | 5.1 | — |
| **Agent Identity** | What is this agent's identity, and what does its PAB policy bound it to? | 5.1 | 3.2 (permissions), 3.3 (handoff scoping) |
| **PAB (principal access boundary)** | What is the outer limit of what this agent principal can ever access? | 5.1 (configured via Agent Identity) | — |
| **Agent Gateway** | What is this agent actually doing, and is it anomalous? | 5.1 and 5.2 | — |
| **Agent Registry** | What capabilities exist, who's registered to use them, and is that governed? | 5.1 and 5.2 | 3.2 (discovery), 3.3 (handoff discovery) |
| **Model Armor** | Is this specific input/output content policy-compliant? | 5.1 and 5.2 | — |
| **HITL (human-in-the-loop)** | Should a human approve this specific action before it executes? | 5.2 | 2.2 and 3.1 ("agent vs. human mode") |

**Don't use** this matrix's tools interchangeably in an exam answer
just because they're all "security-related" — a question naming a
specific scenario (e.g., "we need to see historical traffic patterns
for anomaly detection" vs. "we need to cap what an agent can ever
access") is testing whether you pick the *layer-correct* tool (Agent
Gateway for the first, PAB/Agent Identity for the second), not just
any plausible-sounding security tool from the list.

---

## 4. Common exam scenario patterns for Section 5

1. **"An agent needs to call a third-party API on behalf of the
   system, and we want short-lived, appropriately scoped credentials
   rather than a static embedded key."** → **OAuth 2.0 via Auth
   Manager**.

2. **"We want a hard ceiling on what any given agent can ever access,
   regardless of any other permission it might be granted."** → **PAB
   policy, configured via Agent Identity**.

3. **"We need visibility into which agents are calling which services,
   and want to detect unusual traffic patterns."** → **Agent
   Gateway**.

4. **"We want governance over what capabilities get registered and
   reused across agents, not just a technical catalog."** → **Agent
   Registry**, governance dimension.

5. **"We need to screen agent inputs/outputs for unsafe content or
   potential prompt-injection attempts."** → **Model Armor**.

6. **"A specific action (e.g., issuing a refund above a threshold)
   should never execute without a human approving it first."** →
   **HITL**.

7. **"In a multi-hop chain (agent → tool → another service), we need
   to make sure the original caller's actual permission scope is
   preserved at each hop, not replaced with a broad shared service
   identity."** → **identity propagation**.

8. **"Every action, regardless of stakes, currently requires human
   approval, and it's become a bottleneck."** → likely
   **over-application of HITL** — should be scoped to genuinely
   high-stakes/irreversible actions only.

---

## 5. Section 5 practice questions (16)

**Q1.** Which of the following correctly describes PAB (principal
access boundary) as tested on this exam?
A) A generic IAM concept unrelated to agents specifically
B) A specific, agent-focused mechanism — configured via Agent Identity — that bounds the outer limit of what an agent principal can ever access
C) A synonym for OAuth 2.0
D) A deprecated concept replaced by Agent Gateway

*Answer: B.* This is the direct currency correction from `CLAUDE.md`
§7 — PAB is agent-specific access-boundary configuration via Agent
Identity, not generic IAM. (A) is the exact trap to avoid. (C)
conflates two distinct mechanisms — OAuth 2.0 is an authentication
protocol; PAB is an authorization-boundary concept. (D) is fabricated
— PAB and Agent Gateway are distinct, both active, both in-scope.

**Q2.** An agent needs to call an external API. Which mechanism
handles the actual authentication flow for that agent-to-tool call?
A) Model Armor
B) Auth Manager (OAuth 2.0)
C) Agent Registry
D) HITL

*Answer: B.* Task 5.1 explicitly names OAuth 2.0 (via Auth Manager)
for agent-to-tool API call authentication. (A) is content-safety
screening, not authentication. (C) is a capability catalog, not an
auth mechanism. (D) is a human-approval checkpoint, not authentication.

**Q3.** What is the functional difference between Agent Identity/PAB
and Agent Gateway?
A) They are the same mechanism with different names
B) Agent Identity/PAB defines what an agent is authorized to access (the boundary); Agent Gateway monitors/tracks what an agent is actually doing (traffic visibility)
C) Agent Gateway defines permissions; Agent Identity monitors traffic
D) Both are exclusively used for authentication, not authorization or monitoring

*Answer: B.* This is the layer distinction in §1.3's table —
authorization boundary vs. traffic monitoring are two different
concerns. (A) collapses a tested distinction. (C) reverses the roles.
(D) mischaracterizes both — neither is primarily an authentication
mechanism (that's Auth Manager/OAuth 2.0).

**Q4.** Why is a single, shared, maximally-broad PAB policy across
every agent in an organization discouraged?
A) PAB policies can only be applied to one agent at a time by technical limitation
B) It reintroduces the blast-radius risk of a compromised or misbehaving agent having access far beyond what its actual task requires
C) PAB policies are deprecated in favor of OAuth 2.0
D) Shared PAB policies are actually the recommended best practice

*Answer: B.* This mirrors the least-privilege guidance repeated across
Sections 3.2/3.3/5.1 — broad shared boundaries defeat the purpose of a
boundary. (A) is a fabricated technical claim. (C) is false — both
remain distinct, active, in-scope mechanisms. (D) is the opposite of
the guide-aligned best practice.

**Q5.** An organization wants to detect that an agent is suddenly
making an unusually high volume of calls to a service it doesn't
normally interact with. Which tool provides this?
A) Model Armor
B) Agent Gateway
C) HITL
D) Auth Manager

*Answer: B.* Traffic monitoring and anomaly visibility is Agent
Gateway's defining role (§1.3, §2.1). (A) screens content, not traffic
volume/pattern anomalies. (C) is a per-action human-approval
mechanism, not a monitoring system. (D) handles authentication, not
traffic pattern visibility.

**Q6.** What does it mean that Agent Registry has a "governance
dimension," per task 5.1?
A) Agent Registry is purely a technical discovery mechanism with no governance implications
B) What capabilities get registered and are therefore discoverable/reusable across agents should itself be subject to review and policy, not an unmoderated free-for-all
C) Agent Registry replaces the need for PAB policies entirely
D) Governance only applies to Agent Registry in Section 3, not Section 5

*Answer: B.* This is the explicit framing in §1.4 — governance over
the capability catalog itself, not just its technical function. (A)
ignores task 5.1's explicit naming of Agent Registry under "governance
and policy enforcement." (C) is false — they're complementary, not
substitutes. (D) is false — Agent Registry's governance dimension is
explicitly named under task 5.1.

**Q7.** Which three tools/concepts does task 5.2 name as components of
"safety frameworks and guardrails"?
A) Auth Manager, PAB, Agent Identity
B) Agent Gateway, Model Armor, HITL
C) ADK, Agent Runtime, Agent Registry
D) Vector Search 1.0, Agent Retrieval, RAG Engine

*Answer: B.* This is the verbatim task 5.2 bullet's example list.
(A) are 5.1-focused authentication/authorization-boundary tools, a
different (though related) grouping. (C) and (D) are Section 3/4
tools unrelated to task 5.2's specific safety-framework bullet.

**Q8.** What is "identity propagation," as referenced in task 5.2?
A) Creating a new, broader shared identity at every hop of a multi-agent chain for simplicity
B) Correctly carrying the originating principal's actual permission scope through each hop of a multi-agent/multi-tool chain, rather than defaulting to a broad shared identity at each hop
C) A synonym for OAuth 2.0 token refresh
D) A deprecated concept no longer relevant to this exam

*Answer: B.* This is the definition and rationale given in §2.2 —
preserving (and never expanding) the original scope across hops. (A)
describes exactly the anti-pattern identity propagation exists to
prevent. (C) conflates a distinct authentication detail with a
broader authorization-scope-preservation concept. (D) is false — it's
an active, named task 5.2 concern.

**Q9.** A team currently requires human approval (HITL) for every
single action an agent takes, including low-stakes read-only lookups.
What issue does this create?
A) No issue — maximal HITL usage is always the safest and recommended approach
B) It eliminates the efficiency benefit of autonomy and doesn't scale — HITL should be scoped to genuinely high-stakes/irreversible actions, with lower-stakes actions proceeding autonomously under standing monitoring/screening
C) HITL cannot technically be applied to low-stakes actions
D) This is required by Model Armor's design

*Answer: B.* This is the explicit don't-use guidance in §2.1 —
over-applying HITL is the same over-correction flagged for "agent vs.
human mode" in Section 3.1. (A) is the exact anti-pattern being
warned against. (C) is a fabricated technical limitation. (D) is
false — Model Armor doesn't mandate blanket HITL usage.

**Q10.** Why is Model Armor alone insufficient as a complete safety
framework for a high-stakes, irreversible action (e.g., a large
financial transaction)?
A) Model Armor cannot process financial-related content at all
B) Model Armor screens content for policy violations but doesn't substitute for a human judgment checkpoint on whether a specific consequential action should actually execute
C) Model Armor is only usable in Section 5.1, not 5.2
D) Model Armor requires HITL to function at all

*Answer: B.* This is the explicit tradeoff stated in §2.1 — content
safety and action-consequence judgment are different concerns; a
policy-compliant piece of content doesn't mean the underlying action
is safe to execute autonomously. (A) is fabricated. (C) is false —
Model Armor is named in both 5.1 and 5.2. (D) reverses the actual
relationship — they're complementary, neither strictly requires the
other to function.

**Q11.** Which pairing correctly matches a Section 5 tool to the
layer/question it primarily answers?
A) Auth Manager → "What is this agent allowed to access, at most?"
B) PAB (via Agent Identity) → "Can this agent authenticate to call this tool?"
C) Agent Gateway → "What is this agent actually doing, right now and historically?"
D) Model Armor → "What capabilities exist and who's registered to use them?"

*Answer: C.* This matches the comparison matrix in §3 directly. (A)
describes PAB/Agent Identity's role, not Auth Manager's (which is
about authentication, not access-boundary definition). (B) describes
Auth Manager's role, not PAB's. (D) describes Agent Registry's role,
not Model Armor's (which is content-safety screening).

**Q12.** A multi-hop chain has Agent A calling a tool, which in turn
calls a downstream service. The downstream service currently executes
under a broad, shared service account regardless of which agent or
user originated the request. What's the risk, and what should replace
this pattern?
A) No risk — shared service accounts are always appropriate for downstream calls
B) The risk is collapsed accountability and expanded blast radius; it should be replaced with proper identity propagation, where each hop's effective access reflects the actual originating principal's (bounded, never expanded) scope
C) This should be replaced with Model Armor content screening instead
D) This is a Section 3 concern only, not relevant to Section 5

*Answer: B.* This is the exact anti-pattern and fix described in §2.2.
(A) is the flagged anti-pattern itself. (C) confuses content-safety
screening with identity/access-scope propagation — different
concerns. (D) is false — this is explicitly a task 5.2 concept
("configuring secure access to data and identity propagation").

**Q13.** True or False: HITL, as covered in Section 5.2, is a
conceptually new idea unrelated to anything introduced earlier in this
folder.
A) True — HITL is introduced for the first time in Section 5.2 with no prior connection
B) False — HITL is the safety-framework framing of the same underlying "agent vs. human mode" concept introduced in Sections 2.2 and 3.1
C) True, because "agent vs. human mode" only applies to coding agents, not custom agents
D) False, but only because Section 5.2 renames "human mode" to "HITL" with no conceptual continuity

*Answer: B.* This is the explicit connection drawn in §2.1 — HITL and
"human mode" describe the same underlying design idea (mandatory human
checkpoints for certain actions) from different sections' framing.
(A) ignores that continuity. (C) is false — "agent vs. human mode" is
explicitly discussed for custom agents in Section 3.1, not just coding
agents. (D) understates the conceptual link as "just a rename" rather
than the same idea applied at different points in the exam's task
structure.

**Q14.** Which task (5.1 or 5.2) is primarily about *configuring the
control plane* (auth, permissions, traffic visibility, policy), and
which is primarily about *implementing runtime behavior-level
guardrails and secure data/identity handling*?
A) 5.1 is runtime guardrails; 5.2 is control-plane configuration
B) 5.1 is control-plane configuration; 5.2 is runtime guardrails and secure data/identity handling
C) Both tasks cover identical content with no distinguishable focus
D) Neither task relates to configuration or runtime behavior

*Answer: B.* This matches the framing in §0 — 5.1 configures the
control plane (auth, PAB, Agent Gateway, governance), 5.2 implements
runtime safety behavior and secure data/identity handling. (A)
reverses the framing. (C) and (D) both ignore the real distinction the
guide's own task bullets draw.

**Q15.** A scenario states: "We need every agent's OAuth-obtained
access token to grant only the minimum set of permissions needed for
that agent's specific task, not broad standing access." Which
principle does this most directly reflect?
A) Identity propagation
B) Least-privilege scoping — reflected both in properly scoped OAuth 2.0 tokens (§1.1) and in PAB policy design (§1.2)
C) HITL
D) Agent Registry's governance dimension

*Answer: B.* Scoped tokens are a direct application of the
least-privilege principle that recurs across OAuth 2.0 scoping and PAB
policy design in this section. (A) is about preserving scope across
hops, a related but distinct concept from initial token scoping. (C)
is a human-approval mechanism, unrelated to token scope design. (D) is
about capability-catalog governance, not token scoping specifically.

**Q16.** Which of the following is NOT one of the four named
considerations under task 5.1?
A) Implementing authentication and secure tool execution via OAuth 2.0
B) Configuring PAB policies using Agent Identity
C) Configuring Agent Gateway to monitor traffic and track agents
D) Creating continuous evaluation pipelines to assess tool execution

*Answer: D.* This is a task 4.1 consideration (evaluation pipelines),
not a task 5.1 consideration — a cross-section trap testing whether
you can correctly place a concept in its actual task. (A), (B), (C)
are all verbatim task 5.1 bullets (the fourth, "designing and
configuring agentic governance and policy enforcement," is the one not
listed as a distractor option here).

---

## 6. Quick-reference recap

| Concept | One-line definition | Don't confuse with |
|---|---|---|
| Auth Manager (OAuth 2.0) | Manages agent-to-tool API call authentication | Agent Identity/PAB (authorization boundary, not authentication) |
| Agent Identity | Per-agent identity/permission configuration surface | Agent Registry (capability catalog, not identity) |
| PAB (principal access boundary) | Outer limit on what an agent principal can ever access, configured via Agent Identity | A generic IAM role/policy (PAB is agent-specific, not generic) |
| Agent Gateway | Monitors/tracks agent traffic and behavior | Model Armor (content screening, not traffic monitoring) |
| Agent Registry (governance angle) | Governs what capabilities are registered/discoverable/reusable | Agent Gateway (traffic visibility, not capability governance) |
| Model Armor | Screens inputs/outputs for content-safety policy violations | HITL (a human checkpoint, not automated content screening) |
| HITL (human-in-the-loop) | Mandatory human approval before a high-stakes/irreversible action | Agent Gateway/Model Armor (automated, standing controls vs. HITL's per-action human gate) |
| Identity propagation | Preserving (never expanding) originating principal's scope across multi-hop chains | A single shared service identity reused at every hop (the anti-pattern) |
| Agent vs. human mode / HITL | The same underlying concept: gating autonomous execution with human oversight for certain actions | Two unrelated ideas (they are the same concept, different framing) |
