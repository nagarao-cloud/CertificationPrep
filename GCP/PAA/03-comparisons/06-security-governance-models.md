# Security & Governance: Agent Gateway vs. Model Armor vs. PAB (via Agent Identity)

**Exam mapping:** Task 5.1 ("Configuring agent security and
governance") and Task 5.2 ("Implementing secure agent behavior and
execution") — together ~15% of the exam (Section 5). Verbatim source
bullets:
- 5.1: "Implementing authentication and secure tool execution (e.g.,
  agent-to-tool API calls using OAuth 2.0)"; "Configuring principal
  access boundary (PAB) policies using **Agent Identity**"; "Configuring
  **Agent Gateway** to monitor traffic and track agents"; "Designing and
  configuring agentic governance and policy enforcement (e.g., Agent
  Registry and **Model Armor**)."
- 5.2: "Designing appropriate safety frameworks and guardrails (e.g.,
  **Agent Gateway, Model Armor**, and human-in-the-loop [HITL])";
  "Configuring secure access to data and identity propagation (e.g.,
  Agent Gateway and Agent Registry)."

Per this folder's currency correction: **PAB is not a generic IAM**
(Identity and Access Management — Google Cloud's general system for
granting identities permission to access resources) **concept** — it's
the specific principal access boundary mechanism,
configured through Agent Identity, that this exam tests.

## 1. What layer of the stack each one governs

- **PAB (principal access boundary), via Agent Identity.** The
  **identity and access** layer. Agent Identity is where you configure
  *which principal (agent) can access which resources* — the access-
  boundary policy itself. This answers "is this agent even allowed to
  attempt this action / reach this resource," evaluated before or
  independent of what's actually inside the request/response payload.
- **Agent Gateway.** The **traffic and tracking** layer. Per task 5.1,
  it's configured "to monitor traffic and track agents"; per task 5.2,
  it's named alongside Model Armor and HITL as a safety-framework/
  guardrail component and also covers "secure access to data and
  identity propagation" alongside Agent Registry. Agent Gateway sits in
  the path of agent traffic — it's the layer that sees *what's actually
  flowing* between agents, tools, and data, and can monitor, track, and
  enforce policy on that flow, including propagating identity through
  multi-hop agent/tool calls.
- **Model Armor.** The **content/model safety** layer. Named in both
  task 5.1 (governance and policy enforcement, alongside Agent Registry)
  and task 5.2 (safety frameworks and guardrails, alongside Agent
  Gateway and HITL). This is the layer concerned with *what the model
  itself is being asked to do or is producing* — guardrail-style content
  and safety enforcement, not access-boundary or traffic-routing
  decisions.

The three-layer mental model: **PAB/Agent Identity decides who's allowed
to act. Agent Gateway watches and governs the traffic of that action as
it happens, propagating identity across hops. Model Armor guards the
content/safety dimension of what's being generated or requested along
the way.**

## 2. Head-to-head comparison table

| Dimension | PAB via Agent Identity | Agent Gateway | Model Armor |
|---|---|---|---|
| Exam task | 5.1 | 5.1, 5.2 | 5.1, 5.2 |
| Stack layer | Identity / access boundary | Traffic monitoring, tracking, identity propagation | Content / model safety |
| Core question it answers | "Is this agent (principal) allowed to access this resource/action at all?" | "What traffic is flowing between agents/tools, and is it being tracked and governed as it happens?" | "Is this input/output safe — does it violate safety/policy guardrails?" |
| Primary mechanism | Principal access boundary policies | Gateway sitting in the traffic path; monitoring + tracking | Guardrail/safety enforcement on model inputs/outputs |
| Enforcement point | Policy evaluation on the principal before/at access time | In-path, on live agent-to-agent and agent-to-tool traffic | In-path or in-line on model calls, as a guardrail |
| Related tool named alongside it | Agent Identity (configures PAB) | Agent Registry (secure data access + identity propagation, task 5.2) | Agent Registry (governance and policy enforcement, task 5.1) |
| Auth mechanism it works with | Underpins agent-to-tool API calls using OAuth 2.0 (task 5.1) | Propagates identity across hops so downstream calls stay authenticated/authorized | Not an auth mechanism — a content-safety guardrail layered independently of who's authenticated |
| HITL relationship | Not directly named with HITL | Named alongside HITL as a safety-framework component (task 5.2) | Named alongside HITL as a safety-framework component (task 5.2) |
| What a failure here looks like | An agent accesses a resource/action it shouldn't have been permitted to reach | Unmonitored or untracked agent traffic; identity not propagated correctly across a multi-hop call | Unsafe or policy-violating content passes through unguarded |
| Governance framing in the guide | "Configuring PAB policies using Agent Identity" (5.1) | "Configuring Agent Gateway to monitor traffic and track agents" (5.1); "secure access to data and identity propagation" (5.2) | "Designing and configuring agentic governance and policy enforcement" (5.1); "safety frameworks and guardrails" (5.2) |

## 3. Decision tree

```
        A new agent security/governance requirement — which layer?
                                    |
        Is the question about WHO/WHAT is allowed to access a
        resource or take an action in the first place (a
        principal-level access decision)?
                                    |
                +--------------------+--------------------+
               YES                                        NO
                |                                          |
                v                                Is the question about
     Configure PAB policies                       monitoring/tracking live
     via Agent Identity                            agent traffic, or
     (task 5.1)                                    propagating identity
                                                     across a multi-hop
                                                     agent/tool call?
                                                              |
                                                +---------------+---------------+
                                               YES                              NO
                                                |                                |
                                                v                                v
                                       Configure Agent Gateway          Is the question about
                                       (traffic monitoring/             the SAFETY of model
                                       tracking, identity                input/output content —
                                       propagation, task                 guardrails against
                                       5.1/5.2)                          unsafe generation or
                                                                          requests?
                                                                                   |
                                                                          +---------+---------+
                                                                         YES                  NO
                                                                          |                    |
                                                                          v                    v
                                                                    Configure          Consider HITL
                                                                    Model Armor        (human-in-the-loop,
                                                                    (safety            task 5.2) as a
                                                                    frameworks/         complementary
                                                                    guardrails,         guardrail, or
                                                                    task 5.1/5.2)       re-scope the
                                                                                        question
```

## 4. Tradeoff writeups

### Use PAB via Agent Identity when...
- The requirement is about **which agent (principal) is permitted to
  reach which resource or perform which action** — a boundary/scoping
  decision, structurally similar to least-privilege access control but
  applied specifically to agents as principals.
- You're securing agent-to-tool API calls and need the authorization
  layer underneath **OAuth 2.0**-based authentication (OAuth 2.0: the
  agent gets a limited, scoped token instead of sharing a real password,
  and presents that token on each call) (task 5.1) — PAB is
  the policy that decides what an authenticated agent is actually
  allowed to do once it's authenticated.
- The scenario is about a scoping/permissions design question — "this
  agent should only be able to touch these resources" — rather than a
  live-traffic monitoring or content-safety question.

### Don't use PAB/Agent Identity alone when...
- The concern is about **observing or tracking traffic** after access
  has already been granted — PAB decides the boundary, it doesn't
  monitor what happens inside that boundary once access is permitted.
  That's Agent Gateway's job.
- The concern is about the **safety of generated content or requests**
  — an agent can be fully within its access boundary and still produce
  unsafe or policy-violating output; PAB doesn't inspect content. That's
  Model Armor's job.

### Use Agent Gateway when...
- The requirement is to **monitor traffic and track agents** (task
  5.1's exact wording) — visibility into what agents are actually doing
  across their calls, live.
- You need **identity propagation** across a multi-hop agent-to-agent
  or agent-to-tool chain (task 5.2) — making sure the originating
  principal's identity/authorization context survives as the request
  passes through intermediate agents or tools, rather than being lost
  or silently escalated at a hop.
- You're designing a safety framework/guardrail system and need the
  in-path enforcement point that sees live traffic, as opposed to a
  static access-boundary policy or a content-safety filter alone.

### Don't use Agent Gateway alone when...
- The requirement is really about defining the access boundary itself
  (who's allowed to do what) rather than observing/governing traffic
  after that boundary is already defined — that's PAB/Agent Identity's
  job; Agent Gateway assumes an access decision has already been made
  and focuses on the traffic that decision permits.
- The requirement is about content safety of model inputs/outputs
  specifically — Agent Gateway tracks and monitors traffic, but the
  guide separates "safety frameworks and guardrails" content concerns
  into Model Armor as a distinct named tool.

### Use Model Armor when...
- The requirement is about **safety frameworks and guardrails** for
  what an agent/model is being asked to do or is producing (task 5.2) —
  a content-safety concern, not an access-boundary or traffic-
  monitoring one.
- You're designing **governance and policy enforcement** at the content
  level (task 5.1) — e.g., preventing an agent from generating or
  acting on unsafe/policy-violating content, independent of whether the
  agent was otherwise authorized to make the call.

### Don't use Model Armor alone when...
- The problem is really an access-control problem — an agent reaching
  a resource it shouldn't have permission to reach at all is a PAB/
  Agent Identity gap, not something a content-safety guardrail fixes
  after the fact.
- The problem is about traffic visibility or identity propagation
  across hops — Model Armor guards content/safety, it isn't the traffic-
  monitoring or identity-propagation layer Agent Gateway provides.

## 5. Defense-in-depth: how they compose

The guide's own task 5.2 groups Agent Gateway, Model Armor, and HITL
together as "appropriate safety frameworks and guardrails" — a strong
signal these are meant to layer, not substitute for each other:

```
  Request reaches an agent
          |
          v
  [1] PAB / Agent Identity  --- Is this principal even allowed
      (access boundary)          to attempt this action?
          | (allowed)
          v
  [2] Agent Gateway  ----------- Monitor + track this traffic;
      (traffic + identity          propagate identity if this
       propagation)                 hops to another agent/tool
          |
          v
  [3] Model Armor  ------------- Is the content of this
      (content/model safety)       request/response safe and
                                     policy-compliant?
          |
          v
  [4] HITL (task 5.2) ---------- For high-risk/low-confidence
      (human-in-the-loop)          actions, route to a human
                                     before executing
          |
          v
       Action executes / response returned
```

A gap at any one layer is a real gap — a strong access boundary (PAB)
doesn't substitute for content-safety guardrails (Model Armor), and
neither substitutes for traffic monitoring and identity propagation
(Agent Gateway) across a multi-agent chain. Task 5.1's inclusion of
**Agent Registry** alongside both Agent Gateway (secure data access/
identity propagation, 5.2) and Model Armor (governance/policy
enforcement, 5.1) reflects that Agent Registry is the shared discovery/
capability layer these controls apply *to* — it's where agents and
capabilities are registered, which both traffic governance and content
policy enforcement need visibility into.

## 6. Exam traps to watch for

- Don't treat PAB as a generic IAM/role concept — per this folder's
  currency correction, it's specifically the principal access boundary
  mechanism configured via **Agent Identity**, named exactly that way in
  task 5.1.
- A question about "monitoring traffic" or "tracking agents" is Agent
  Gateway (task 5.1's literal wording) — not Model Armor and not PAB.
- A question about "safety frameworks," "guardrails," or unsafe
  content/output is Model Armor (and possibly HITL) — not Agent Gateway
  or PAB, even though Agent Gateway is also named in the same 5.2
  bullet as a safety-framework component (traffic-layer enforcement,
  not content judgment).
- A question about "identity propagation" across agent/tool hops is
  Agent Gateway (task 5.2's exact pairing: "Agent Gateway and Agent
  Registry"), not PAB — PAB sets the boundary once; propagation across
  hops is a traffic-layer concern.
- OAuth 2.0 is named specifically for **agent-to-tool API calls** (task
  5.1) — it's the authentication mechanism, distinct from PAB
  (authorization/access-boundary) and distinct from Agent Gateway
  (traffic monitoring/propagation) and Model Armor (content safety).
  Don't collapse authentication, authorization, traffic governance, and
  content safety into one concept on this exam — the guide keeps them
  as four distinct considerations under Section 5.
