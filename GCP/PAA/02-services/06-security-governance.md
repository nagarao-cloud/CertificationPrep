# 02-services — Security & Governance

> **Covers (exam-guide §6 in-scope items):** Agent Gateway · Agent
> Identity (full reference entry — this is the anchor file for it) ·
> Model Armor · Auth Manager (OAuth 2.0) · Sensitive Data Protection ·
> Skill Registry.
>
> **Agent Registry** is named in this section's task bullets too
> (5.1, 5.2), but its **full reference entry is in
> `04-orchestration-protocols.md` §4** (its primary role is
> discovery/orchestration). This file covers only its governance/
> policy-enforcement role, cross-referenced rather than duplicated.
>
> **Primary exam tasks supported:** 5.1 (Configuring agent security and
> governance), 5.2 (Implementing secure agent behavior and execution).
> Section 5 is ~15% of the exam.
>
> **Currency reminder:** **PAB (principal access boundary)** is a
> specific policy mechanism configured via **Agent Identity** for this
> exam — not a generic IAM concept, and not a synonym for a plain IAM
> role/policy.

---

## 1. Why this file exists

Section 5 is about making agentic workflows **safe to run** and
**governable at scale** — two related but distinct concerns the exam
splits across 5.1 (configuring the security/governance controls) and
5.2 (implementing the runtime safety behavior those controls enable).
Six tools cover this, falling into three functional pairs:

```
Identity & access                  Traffic & discovery
 ├─ Auth Manager (OAuth 2.0)         ├─ Agent Gateway   (monitor/track traffic)
 │   agent-to-tool authentication    └─ Agent Registry  (governance role —
 └─ Agent Identity (PAB)                 full entry: file 04)
     which principal an agent
     is allowed to act as         Content & data safety
                                    ├─ Model Armor              (prompt/output safety)
Capability governance               └─ Sensitive Data Protection (PII/sensitive data)
 └─ Skill Registry
     which skills are vetted
     and allowed to run
```

---

## 2. Agent Identity — and principal access boundary (PAB)

**What it is.** The service that configures **agent permissions** —
what a given agent is allowed to do, and, specifically, **principal
access boundary (PAB)** policies: a mechanism that scopes/bounds which
principals (identities) an agent can act as, or act on behalf of, when
it calls tools or other services. **Currency correction: PAB is not a
generic IAM concept.** The exam guide's own task-5.1 language is
explicit — "Configuring principal access boundary (PAB) policies using
**Agent Identity**" — treat PAB as a specific, named, agent-specific
access-boundary mechanism configured through this specific tool, not a
synonym for "an IAM role" or "an IAM policy" in the generic cloud-**IAM**
(Identity and Access Management — Google Cloud's general system for
granting identities permission to touch resources) sense.

**Problem it solves.** An autonomous agent making tool calls,
delegating to other agents (A2A — see
`04-orchestration-protocols.md` §2), and querying enterprise data
creates a distinctive access-control problem: the agent's own identity
and the identity of the human/system it's acting on behalf of can
diverge, and an agent with unbounded delegated authority is a much
larger blast radius than a human clicking through a UI one action at a
time. PAB is the mechanism that constrains this — it bounds *which*
principals an agent can effectively act as, preventing an agent from
silently accumulating or exercising more access than it was actually
scoped for, even if the underlying credentials it holds could
technically reach further.

**How it's configured — verbatim task 5.1/5.2 considerations:**
- **Configuring principal access boundary (PAB) policies using Agent
  Identity** (5.1) — the core configuration action.
- **Configuring secure access to data and identity propagation (e.g.,
  Agent Gateway and Agent Registry)** (5.2) — Agent Identity's PAB
  policies are what gets *propagated and enforced* as a request moves
  through Agent Gateway and gets checked against what Agent Registry
  knows about the calling agent's registered identity/capabilities.

**Task cross-reference.** 5.1 (direct, PAB configuration), 5.2
(identity propagation through the request path), 3.3 (multi-agent
handoff trust — see `04-orchestration-protocols.md` §6, which
cross-references back to this section rather than duplicating it).

**Decision note — Agent Identity/PAB vs. generic IAM.** Use generic
Google Cloud IAM (service accounts — non-human identities meant for an
application or workload rather than a person — roles, policies) for the
baseline question "what Google Cloud resources can this service account
touch."
Use Agent Identity/PAB specifically for the agent-shaped question "when
this agent is acting autonomously — possibly multiple hops deep through
an A2A handoff or an MCP tool call — whose effective authority is it
exercising, and is that bounded correctly." An exam scenario about a
multi-hop agent delegation chain accumulating excess access is a PAB
question, not a generic-IAM-role question.

---

## 3. Agent Gateway

**What it is.** A traffic-monitoring and agent-tracking service —
configured, per task 5.1, to "monitor traffic and track agents." Think
of it as the control point agent-originated traffic passes through,
analogous in spirit to an API gateway but scoped to agent-specific
traffic patterns (tool calls, A2A handoffs, inter-agent requests) and
tracking concerns (which agent, acting under which identity, made this
call).

**Problem it solves.** Without a dedicated observation/enforcement
point for agent traffic specifically, agent-originated calls blend into
generic API/network traffic and lose the agent-specific context that
matters for governance — which agent instance made the call, what
identity it was acting under, whether the call pattern looks anomalous
(e.g., an agent suddenly calling a tool it's never called before, at a
volume out of profile). Agent Gateway is the purpose-built layer for
that visibility and control.

**How it's configured — verbatim task 5.1/5.2 considerations:**
- **Configuring Agent Gateway to monitor traffic and track agents**
  (5.1).
- **Designing appropriate safety frameworks and guardrails (e.g., Agent
  Gateway, Model Armor, and human-in-the-loop [HITL])** (5.2) — Agent
  Gateway is named as one of the guardrail mechanisms itself, not just
  a passive monitor: it's a point where policy (including PAB
  enforcement, per §2) can actually be applied to agent traffic, not
  only observed after the fact.
- **Configuring secure access to data and identity propagation (e.g.,
  Agent Gateway and Agent Registry)** (5.2) — Agent Gateway is where
  identity propagates through as a request moves between agents/tools.

**Task cross-reference.** 5.1 (traffic monitoring/tracking), 5.2
(guardrail/safety-framework role, identity propagation).

**Decision note — Agent Gateway vs. Agent Registry's governance role.**
Both appear in the same task-5.2 bullet ("Agent Gateway and Agent
Registry"), but with different jobs: **Agent Gateway** is the runtime
traffic control point — it sees and can act on requests as they flow.
**Agent Registry** (full entry in `04-orchestration-protocols.md` §4)
is the catalog/discovery layer — it's where an agent's registered
identity and declared capabilities live, which Agent Gateway checks
*against* when deciding whether to allow a given call through. Treat
Agent Gateway as "the checkpoint" and Agent Registry as "the source of
truth the checkpoint consults."

---

## 4. Model Armor

**What it is.** Agent-safety/content-governance tooling — a guardrail
layer for the actual content flowing into and out of a model (prompts,
responses), named in task 5.1 for governance/policy enforcement and in
task 5.2 for runtime safety framework design.

**Problem it solves.** Even with correct access-boundary (§2) and
traffic-tracking (§3) controls in place, an agent can still be
manipulated through its content path — prompt injection (malicious
instructions smuggled into content the agent processes, e.g., inside a
retrieved document or a tool's response, attempting to override the
agent's actual instructions), jailbreak attempts, or the agent
producing harmful/policy-violating output. Model Armor is the
content-level guardrail against these — inspecting prompts and model
outputs against safety/policy rules independent of whether the
underlying access-control layer was configured correctly.

**How it's configured — verbatim task 5.1/5.2 considerations:**
- **Designing and configuring agentic governance and policy enforcement
  (e.g., Agent Registry and Model Armor)** (5.1) — Model Armor as a
  policy-enforcement mechanism at the governance-configuration level.
- **Designing appropriate safety frameworks and guardrails (e.g., Agent
  Gateway, Model Armor, and human-in-the-loop [HITL])** (5.2) — Model
  Armor as one of three named guardrail mechanisms, alongside Agent
  Gateway (traffic-level, §3) and HITL (process-level — a human
  approval/review step inserted before a high-risk action executes).

**Task cross-reference.** 5.1 (governance/policy enforcement), 5.2
(safety framework/guardrail design).

**Decision note — Model Armor vs. Sensitive Data Protection (§5) vs.
HITL.** Three different guardrail *kinds*, often used together, not
substitutes: **Model Armor** guards against unsafe/malicious
*content patterns* (prompt injection, jailbreaks, harmful output).
**Sensitive Data Protection** guards against *sensitive data exposure*
specifically (PII, secrets, regulated data appearing where it
shouldn't — see §5). **HITL** guards against *high-risk autonomous
action* by inserting a human checkpoint regardless of whether the
content itself looks safe (e.g., "an agent about to execute a
financial transaction over $X requires human approval" — a control
that has nothing to do with content safety or data sensitivity, purely
about action risk). A scenario about the agent being tricked by
malicious instructions hidden in a document is Model Armor; one about
the agent's response accidentally including a customer's SSN is
Sensitive Data Protection; one about an agent needing sign-off before
an irreversible action is HITL.

---

## 5. Auth Manager (OAuth 2.0)

**What it is.** The authentication-management service handling agent-
to-tool API authentication via **OAuth 2.0** (a widely-used
authorization standard: instead of handing over a real password, the
caller gets a limited, scoped token — proof it's allowed to do specific
things — and presents that on each call instead) — named directly in
task 5.1: "Implementing authentication and secure tool execution (e.g.,
agent-to-tool API calls using OAuth 2.0)."

**Problem it solves.** When an agent calls a tool (an internal API, a
third-party SaaS service via MCP — see
`04-orchestration-protocols.md` §2–§3), that call needs to authenticate
as *something* — and doing this securely (obtaining, refreshing,
scoping, and not leaking OAuth tokens) is exactly the kind of
undifferentiated security-engineering work a managed service should
handle rather than each agent implementation rolling its own token
management.

**How it's configured.** Auth Manager issues and manages OAuth 2.0
credentials/tokens used for agent-to-tool API calls — the mechanism
that makes an MCP tool call (or any tool integration) actually
authenticated, as opposed to just protocol-correct.

**Task cross-reference.** 5.1, directly — "agent-to-tool API calls
using OAuth 2.0" is Auth Manager's core scope.

**Decision note — Auth Manager vs. Agent Identity/PAB.** These operate
at different layers and are complementary, not competing. **Auth
Manager** handles the mechanics of *authenticating* a specific agent-
to-tool API call (obtaining a valid OAuth token). **Agent Identity/PAB**
handles the broader question of *which principal* the agent is
authorized to act as/on-behalf-of in the first place, bounding what
that authenticated call is even allowed to attempt. A call can be
correctly authenticated by Auth Manager (a valid token) and still be
blocked by an Agent Identity/PAB policy if the action falls outside
the agent's bounded access.

---

## 6. Sensitive Data Protection

**What it is.** A service for detecting and protecting sensitive data
(PII, secrets, regulated data categories) as it flows through an
agentic workflow — named in this exam's in-scope tool list as a
distinct governance concern from Model Armor's content-safety role.

**Problem it solves.** Enterprise data an agent retrieves (via RAG —
see `03-adk-custom-development.md` §5–§7, or via a direct data-layer
tool call — see `07-data-services.md`) or generates in its output can
contain sensitive data that shouldn't be exposed to the requesting
principal, logged in plaintext, or included in a response at all —
independent of whether the content is otherwise "safe" from a Model
Armor standpoint. Sensitive Data Protection scans for and redacts/
flags this category of risk specifically.

**How it's used.** Applied at points in the pipeline where sensitive
data could surface — inbound content being ingested for RAG, outbound
model responses, and potentially the logs Google Cloud Observability
captures (`05-evaluation-deployment.md` §5) — to detect and act on
(redact, block, flag) sensitive data before it reaches somewhere it
shouldn't.

**Task cross-reference.** 5.1/5.2 (governance and secure-execution
tasks broadly — Sensitive Data Protection is named in the exam's §6
in-scope list under Section 5's security/governance umbrella).

**Decision note.** See §4's three-way comparison against Model Armor
and HITL above — Sensitive Data Protection is the *data-sensitivity*
guardrail specifically, distinct from content-safety (Model Armor) and
action-risk (HITL) guardrails.

---

## 7. Skill Registry

**What it is.** A registry specifically for **skills** — vetted,
approved capabilities an agent (or a coding agent, per
`02-coding-agents-devtools.md` §2's "custom skills" configuration) is
allowed to invoke — distinct from Agent Registry's broader agent/
capability-discovery scope (`04-orchestration-protocols.md` §4).

**Problem it solves.** Letting any agent invoke any skill/capability
with no governance gate is a direct path to unintended or unauthorized
actions — especially as an organization accumulates many custom skills
across many teams and agents (the skills/plugins/extension-hooks
customization surface covered in `02-coding-agents-devtools.md` §2).
Skill Registry is the governance layer that constrains *which* skills
exist as sanctioned, catalog-approved capabilities an agent is even
eligible to be granted access to.

**How it's used.** A skill (built via Antigravity's customization
tooling, or defined for a custom ADK agent) gets registered in Skill
Registry as a governed, discoverable capability; an agent's actual
permission to invoke a given registered skill is then a separate
question governed by Agent Identity/PAB (§2) and enforced at the Agent
Gateway (§3).

**Task cross-reference.** 5.1/5.2 (governance and policy enforcement
broadly — Skill Registry is named in the exam's §6 in-scope list under
Section 5).

**Decision note — Skill Registry vs. Agent Registry.** **Skill
Registry** governs *skills* specifically — discrete, invokable
capabilities, with a vetting/approval angle. **Agent Registry**
(`04-orchestration-protocols.md` §4) governs *agents* and their
capabilities more broadly, with a discovery/orchestration angle (which
agent can I hand this sub-task to). A skill can be one of the
capabilities a registered agent exposes — the two registries are
complementary layers (agent-level vs. skill-level), not duplicates of
each other.

---

## 8. How these tools fit together

```
   ┌────────────────────────────────────────────────────────────────────┐
   │                          Agent (any origin: ADK-built,                │
   │                     Gemini Enterprise-built, or a coding agent)        │
   └──────────────────────────────────┬───────────────────────────────────┘
                                      │ (1) agent wants to call a tool
                                      ▼
                    ┌────────────────────────────────┐
                    │          Auth Manager              │
                    │  issues OAuth 2.0 token for the      │
                    │  agent-to-tool API call               │
                    └────────────────┬────────────────┘
                                     │ (2) authenticated call
                                     ▼
   ┌────────────────────────────────────────────────────────────────────┐
   │                          Agent Gateway                                │
   │   monitors traffic, tracks agent identity, enforces policy checks     │
   └───────┬─────────────────────────┬─────────────────────────┬────────┘
           │ (3) checks against         │ (4) checks against       │ (5) checks against
           ▼                            ▼                          ▼
 ┌─────────────────────┐   ┌──────────────────────┐   ┌────────────────────┐
 │   Agent Identity        │   │     Skill Registry       │   │  Model Armor +        │
 │   PAB: is this            │   │  is this skill a          │   │  Sensitive Data        │
 │   principal's access       │   │  vetted, registered        │   │  Protection             │
 │   bounded to allow this?    │   │  capability?                │   │  content/data safe?     │
 └─────────────────────┘   └──────────────────────┘   └────────────────────┘
           │ (6) all checks pass
           ▼
      [ call proceeds to the tool / data source — see 07-data-services.md ]
```

**Arrow-by-arrow:**
1. An agent — regardless of how it was built (ADK, Gemini Enterprise,
   or a coding agent's own tool use) — initiates a call to a tool.
2. Auth Manager issues the OAuth 2.0 token authenticating that specific
   agent-to-tool API call.
3. The authenticated call passes through Agent Gateway, which is the
   traffic checkpoint for agent-originated requests.
4. Agent Gateway checks the call against Agent Identity's PAB policy —
   is the principal this agent is acting as/on-behalf-of actually
   bounded to permit this action?
5. In parallel, Agent Gateway (or the invoked capability itself) checks
   whether the specific skill being invoked is a vetted, Skill-
   Registry-approved capability, and content/data-safety guardrails
   (Model Armor for content-pattern risk, Sensitive Data Protection for
   sensitive-data-exposure risk) are applied to the request and/or its
   eventual response.
6. Only once identity, skill-vetting, and content/data-safety checks
   all pass does the call actually proceed to the underlying tool or
   data source.

---

## 9. Quick-reference table

| Tool | Governs | Primary task | Don't confuse with |
|---|---|---|---|
| Agent Identity (PAB) | Which principal an agent can act as/on behalf of | 5.1, 5.2 | Generic IAM roles/policies — PAB is agent-specific, not a synonym |
| Agent Gateway | Runtime traffic monitoring/tracking, policy checkpoint | 5.1, 5.2 | Agent Registry (catalog/discovery — full entry file 04) |
| Model Armor | Content-pattern safety (prompt injection, jailbreak, harmful output) | 5.1, 5.2 | Sensitive Data Protection (data-sensitivity, not content-pattern) |
| Auth Manager | OAuth 2.0 authentication for agent-to-tool calls | 5.1 | Agent Identity/PAB (authorization scope, not authentication mechanics) |
| Sensitive Data Protection | Sensitive data (PII, secrets) detection/redaction | 5.1, 5.2 | Model Armor (content-pattern safety, not data sensitivity) |
| Skill Registry | Vetted, approved skills/capabilities | 5.1, 5.2 | Agent Registry (broader agent-level catalog, not skill-specific) |

---

## 10. Exam traps specific to this file

- Treating PAB as a generic IAM concept rather than the specific,
  named, Agent-Identity-configured mechanism the guide describes.
- Confusing Auth Manager (authentication mechanics — getting a valid
  OAuth token) with Agent Identity/PAB (authorization scope — what that
  authenticated agent is actually bounded to do).
- Treating Model Armor, Sensitive Data Protection, and HITL as
  redundant guardrails — each governs a different risk category
  (content pattern, data sensitivity, action risk) and a mature safety
  framework uses all three.
- Confusing Agent Gateway (runtime traffic checkpoint) with Agent
  Registry (discovery catalog the checkpoint consults) — they appear
  together in task 5.2 but play different roles.
- Confusing Skill Registry (skill-level governance) with Agent Registry
  (agent-level discovery/orchestration catalog, full entry in
  `04-orchestration-protocols.md`).
