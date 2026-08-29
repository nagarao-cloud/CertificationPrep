# Pattern — Secure and Governed Enterprise Agent Platform

> **Pattern summary:** The security and governance layer that should
> wrap around every other pattern in this folder before it's trusted
> with real production traffic — **OAuth 2.0** tool authentication via
> **Auth Manager**, **principal access boundary (PAB)** policy via
> **Agent Identity**, traffic monitoring and policy enforcement via
> **Agent Gateway**, content-safety guardrails via **Model Armor**,
> data-sensitivity guardrails via **Sensitive Data Protection**,
> capability governance via **Skill Registry**, and a
> **human-in-the-loop (HITL)** approval gate for high-risk actions.
>
> **Primary exam tasks:** 5.1 (Configuring agent security and
> governance), 5.2 (Implementing secure agent behavior and execution).
> Section 5 is ~15% of the exam. Component names match
> `02-services/06-security-governance.md` exactly — read that file
> first if any term below (PAB, Agent Gateway, Model Armor, Sensitive
> Data Protection, Skill Registry) is unfamiliar.
>
> **Currency reminder applied in this file:** **PAB (principal access
> boundary)** is a specific mechanism configured via **Agent Identity**
> — not a generic IAM concept.

---

## 1. What this pattern is, and when you reach for it

**Ground-zero framing first.** Every other pattern in this folder
answers "how do I build this agent" or "how do I ship it." This
pattern answers a different question that applies to **all** of
them: "how do I make sure this agent, once it's making autonomous
decisions and taking real actions, can't do more damage than intended
— whether from a bug, a malicious input, or simply being trusted with
more authority than it should have."

A few terms worth defining precisely before the diagram, since this
pattern's whole point rests on keeping them distinct (a recurring exam
trap, per `02-services/06-security-governance.md` §10):

- **Authentication** answers "is this call cryptographically proven to
  come from who it claims to come from" — the mechanics of proving
  identity. **OAuth 2.0** is a widely-used standard protocol for this.
- **Authorization** answers "given a proven identity, what is that
  identity actually allowed to do" — a separate question from
  authentication. A call can be perfectly authenticated (a valid
  token) and still be denied because the authenticated identity isn't
  authorized for that specific action.
- **Governance** is the broader practice of defining, enforcing, and
  auditing policy across a whole population of agents — which skills
  exist, which agents can use them, what gets logged, what requires
  human sign-off.

This pattern is not one more service to add — it's the discipline that
makes every other pattern in this folder *safe to run in production*,
and it should be read as a layer applied consistently across all of
them, not a bolt-on step done once at the end.

**Reach for this pattern:** always, for any agent handling real user
data, real enterprise systems, or any action with a real-world
consequence — which in practice means nearly every pattern in this
folder once it leaves a development/sandbox environment.

---

## 2. The building blocks, briefly (full detail lives in `02-services/06-security-governance.md`)

| Block | Category | One-line role in this pattern |
|---|---|---|
| **Auth Manager (OAuth 2.0)** | Identity & access | Issues and manages the OAuth 2.0 tokens that authenticate agent-to-tool API calls. |
| **Agent Identity (PAB)** | Identity & access | Configures principal access boundary policy — which principal an agent is bounded to act as/on-behalf-of. |
| **Agent Gateway** | Traffic & discovery | The runtime traffic checkpoint — monitors agent-originated traffic and enforces policy on it. |
| **Agent Registry** | Traffic & discovery | The catalog Agent Gateway checks calls against (full entry in `02-services/04-orchestration-protocols.md` §4; this pattern uses its governance-facing role). |
| **Model Armor** | Content & data safety | Guards against unsafe/malicious content patterns — prompt injection, jailbreaks, harmful output. |
| **Sensitive Data Protection** | Content & data safety | Detects and protects sensitive data (PII, secrets, regulated data) as it flows through the workflow. |
| **Skill Registry** | Capability governance | Governs which skills/capabilities are vetted and allowed to run at all. |
| **HITL (human-in-the-loop)** | Process gate | A human approval checkpoint before a high-risk action executes, regardless of whether the content itself looks safe. |

---

## 3. Full production architecture

```
   ┌────────────────────────────────────────────────────────────────────┐
   │              Agent (any pattern in this folder: low-code CX,           │
   │              custom ADK, or multi-agent — this layer wraps all)          │
   └──────────────────────────────────┬───────────────────────────────────┘
                                      │ (1) agent wants to call a tool / take an action
                                      ▼
                    ┌────────────────────────────────┐
                    │          AUTH MANAGER              │
                    │  issues OAuth 2.0 token for the      │
                    │  agent-to-tool API call               │
                    └────────────────┬────────────────┘
                                     │ (2) authenticated call
                                     ▼
   ┌────────────────────────────────────────────────────────────────────┐
   │                          AGENT GATEWAY                                │
   │   monitors traffic, tracks agent identity, is the checkpoint            │
   │   every one of these checks routes through                              │
   └───────┬─────────────────────┬─────────────────────┬─────────────────┘
           │ (3) checks against     │ (4) checks against     │ (5) checks against
           ▼                        ▼                        ▼
 ┌───────────────────┐   ┌──────────────────────┐   ┌────────────────────────┐
 │   AGENT IDENTITY        │   │    SKILL REGISTRY         │   │  MODEL ARMOR +               │
 │   PAB: is this            │   │  is this skill a          │   │  SENSITIVE DATA               │
 │   principal's access       │   │  vetted, registered        │   │  PROTECTION                    │
 │   bounded to allow           │   │  capability?                │   │  content pattern safe?           │
 │   this?                     │   │                              │   │  sensitive data exposed?         │
 └───────────────────┘   └──────────────────────┘   └────────────────────────┘
           │ (6) identity/skill/content checks all pass
           ▼
                    ┌────────────────────────────────┐
                    │      Is this a high-risk action?    │
                    │      (rule-defined, e.g. dollar         │
                    │       threshold, irreversible action,    │
                    │       sensitive-data write)               │
                    └──────┬───────────────────┬─────────┘
             (7a) no, low-risk│                   │(7b) yes, high-risk
                              ▼                   ▼
                  [ call proceeds        ┌────────────────────────┐
                    automatically ]        │        HITL GATE            │
                                          │   human reviewer notified,     │
                                          │   must approve before the        │
                                          │   action executes                  │
                                          └──────────┬──────────────┘
                                                     │ (8) approved / denied
                                                     ▼
                                       [ call proceeds, or is blocked
                                         and the agent is told to
                                         handle the denial gracefully ]
                                                     │
                                                     ▼
                    ┌────────────────────────────────────────────┐
                    │   Every step logged: which agent, which           │
                    │   identity, which skill, PAB decision,              │
                    │   content-safety result, HITL outcome                │
                    │   (feeds Google Cloud Observability — see             │
                    │   pattern-evaluation-deployment-pipeline.md)            │
                    └────────────────────────────────────────────┘
```

---

## 4. Arrow-by-arrow walkthrough

1. **An agent — built with any pattern in this folder — wants to call
   a tool or take an action.** This is the same moment covered in
   `pattern-custom-multi-agent-adk.md` (a skill invocation) or
   `pattern-multi-agent-a2a-mcp-orchestration.md` (an MCP tool call
   from any agent in the chain, at any depth); this pattern is what
   should happen at that moment, every time, regardless of which
   pattern produced the call.
2. **Auth Manager issues an OAuth 2.0 token authenticating the specific
   agent-to-tool API call.** This answers "is this call proven to come
   from this agent" — the authentication question, distinct from
   everything that follows, which is about authorization and
   governance.
3. **The authenticated call passes through Agent Gateway**, the
   runtime traffic checkpoint for all agent-originated requests —
   every check that follows routes *through* Agent Gateway, which is
   what makes it "the checkpoint" rather than one governance check
   among equals (see
   `02-services/06-security-governance.md` §3's decision note).
4. **Agent Gateway checks the call against Agent Identity's PAB
   policy**: is the principal this agent is acting as/on-behalf-of
   actually bounded to permit this specific action? This is the
   authorization question. Recall from
   `pattern-multi-agent-a2a-mcp-orchestration.md` §4 (arrow 9) that in
   a multi-agent system, this check matters most at *every hop* of a
   delegation chain, not just at the system's entry point — an
   unbounded multi-hop chain is exactly the scenario PAB exists to
   prevent, where authority could otherwise silently accumulate beyond
   what any single agent was actually scoped for.
5. **In parallel, Agent Gateway checks whether the specific capability
   being invoked is a vetted, Skill-Registry-approved capability**, and
   content/data-safety guardrails are applied: **Model Armor** inspects
   the request (and eventually the response) for unsafe content
   patterns — prompt injection (malicious instructions smuggled into
   content the agent processes, e.g., hidden inside a retrieved
   document from a RAG pipeline per `pattern-custom-multi-agent-adk.md`,
   attempting to override the agent's actual instructions), jailbreak
   attempts, or harmful output; **Sensitive Data Protection** checks
   separately for sensitive data (PII, secrets, regulated data)
   appearing where it shouldn't, independent of whether the content is
   otherwise safe from a Model Armor standpoint.
6. **Only once identity, skill-vetting, and content/data-safety checks
   all pass** does the call proceed to the next decision point.
7. **The call is evaluated against a risk rule**, configured ahead of
   time (per `pattern-custom-multi-agent-adk.md` §5's note that this
   configuration happens at the Agents CLI/skill-definition layer as
   the agent is built): is this a low-risk action **(7a)**, which
   proceeds automatically, or a high-risk action **(7b)** — an
   irreversible operation, an action over a defined dollar threshold, a
   write to sensitive data — that requires a human checkpoint
   regardless of how clean the content and identity checks came back?
8. **A high-risk action routes to a HITL gate**: a human reviewer is
   notified and must explicitly approve before the action executes.
   This is deliberately a *different kind* of control than everything
   before it — Model Armor and Sensitive Data Protection assess the
   *content*; PAB and Skill Registry assess *identity and capability*;
   HITL assesses *action risk itself*, and applies even when every
   other check has already passed cleanly (see
   `02-services/06-security-governance.md` §4's three-way comparison,
   restated for this pattern's context in §5 below). Every step along
   this whole path — which agent, which identity, which skill, the PAB
   decision, the content-safety result, the HITL outcome — is logged,
   feeding Google Cloud Observability
   (`pattern-evaluation-deployment-pipeline.md`) for both real-time
   monitoring and later audit.

---

## 5. Why one guardrail is never enough (a beginner note on defense in depth)

A natural beginner question: with PAB, Agent Gateway, Model Armor,
Sensitive Data Protection, Skill Registry, and HITL all named here,
isn't that redundant — wouldn't just one strong control be enough?
The answer is that each guards against a genuinely **different**
category of risk, and a system with only one of them has a real,
specific gap:

| Guardrail | Guards against | A failure this alone would miss |
|---|---|---|
| Auth Manager (OAuth 2.0) | An unauthenticated caller | A *correctly authenticated* agent still doing something it shouldn't be authorized for |
| Agent Identity (PAB) | An authenticated agent exceeding its bounded authority | A properly-bounded agent still being tricked by malicious content into misusing the authority it legitimately has |
| Skill Registry | An unvetted, unapproved capability being invoked at all | A vetted, approved skill still being invoked in a way that exposes sensitive data |
| Model Armor | Malicious/unsafe content patterns (prompt injection, jailbreaks) | Perfectly safe-looking content that happens to contain a customer's SSN |
| Sensitive Data Protection | Sensitive data exposure | An irreversible, high-value action that involves no sensitive data at all but is simply too risky to automate without sign-off |
| HITL | High-risk *actions*, independent of content/identity | Nothing upstream — this is deliberately the last-resort backstop for exactly the cases where every other check passed but the stakes are still too high for full autonomy |

This is why the architecture in §3 runs these checks **together**, not
as alternatives — a mature security posture for an agentic system
uses every layer, because each one closes a gap the others structurally
cannot.

---

## 6. Design decisions and tradeoffs

### 6.1 Enforcing governance at Agent Gateway vs. inside each agent's own code

**Chosen here:** Agent Gateway as a centralized checkpoint (§3, arrows
3–6) that every agent's calls route through, rather than each agent
implementing its own access checks in its own code.

**Alternative:** each agent (built with ADK, or via a low-code
pattern) implements PAB/skill-vetting/content-safety checks itself,
inline in its own logic.

**Tradeoff.** Centralizing enforcement at Agent Gateway means policy
changes apply consistently across every agent immediately, without
needing to update and redeploy each agent's own code — and it means a
newly built agent inherits the organization's governance posture by
default rather than needing security logic hand-written into it from
scratch. The cost is a real dependency: every agent's tool calls must
actually route through Agent Gateway for this to work, which is a
deployment/networking requirement, not something that happens
automatically just because Agent Gateway exists somewhere in the
organization. An agent that bypasses Agent Gateway (a direct tool call
that doesn't route through it) has none of these protections, no
matter how well-configured Agent Gateway itself is — which is why
"does every agent's traffic actually route through the gateway" is as
important a design question as "is the gateway configured correctly."

### 6.2 Risk-based HITL gating vs. requiring human approval for everything, or for nothing

Already introduced in `pattern-coding-agent-cicd-integration.md` §6.2
for the coding-agent case; the general version here: **requiring human
approval for every single action** eliminates autonomous-action risk
entirely but also eliminates most of the value of having an agent at
all — if a human must approve every step, the agent is a drafting
tool, not an autonomous system. **Requiring no human approval ever**
maximizes throughput but removes the one guardrail (§5's table) that
specifically catches high-stakes actions no content or identity check
would flag as wrong. The risk-based split (§3, arrow 7a/7b) is the
design that keeps most of the throughput benefit while reserving human
judgment for the subset of actions where getting it wrong is
expensive enough to justify the latency and cost of a human in the
loop. The actual design work is calibrating *which* actions land on
which side of that line — not a technology choice, a risk-tolerance
judgment call specific to the organization and the action in question.

### 6.3 This pattern vs. relying on model-level safety training alone

**Alternative sometimes assumed:** modern LLMs already have safety
training baked in during their development — isn't that enough,
without a separate Model Armor/Sensitive Data Protection layer?

**Tradeoff.** Model-level safety training is real and helps, but it is
not a substitute for this pattern's explicit, configurable, auditable
guardrails, for a few concrete reasons this pattern's design addresses
directly: model-level training can't be tuned per-organization (a
company's specific sensitive-data categories or brand-voice
requirements aren't something general model training knows about);
it produces no separate audit log an organization can review
independently of the model's own behavior; and it has no equivalent of
a hard action-risk gate like HITL, which is a *process* control, not a
content judgment the model itself is positioned to make about its own
actions. A production enterprise agent platform layers this pattern's
explicit controls on top of whatever model-level safety exists, rather
than treating model-level training as sufficient on its own.

---

## 7. Common failure modes and how this design handles them

| Failure mode | What it looks like | How this architecture mitigates it |
|---|---|---|
| **Prompt injection via retrieved content** | A document ingested into a RAG pipeline (per `pattern-custom-multi-agent-adk.md`) contains hidden instructions attempting to override the agent's actual system instructions or exfiltrate data. | Model Armor's content-pattern inspection (arrow 5) is the direct control here — this is precisely the risk category it exists for; a deployment relying only on PAB/identity controls would miss this entirely, since the attack doesn't need elevated authority, just manipulated content. |
| **Authority creep across a multi-hop A2A chain** | In a multi-agent system, delegated authority effectively widens hop by hop until a deep sub-agent is acting with more effective power than intended. | PAB's per-hop check (arrow 4) — applied at *every* agent's calls, not just the entry point — is the specific control; see `pattern-multi-agent-a2a-mcp-orchestration.md` §7 for the fuller version of this failure mode. |
| **Sensitive data leaking through an otherwise "safe" response** | A response contains no malicious content pattern, but accidentally includes a customer's SSN pulled from a retrieved record. | Sensitive Data Protection (arrow 5) is a distinct check from Model Armor for exactly this reason — content-pattern safety and data-sensitivity are different risk categories (§5's table), and a system checking only for the former misses this. |
| **An unvetted skill gets invoked** | A capability that was never reviewed or approved somehow becomes reachable by an agent — e.g., through a misconfiguration or an overly broad tool-access grant. | Skill Registry's vetting check (arrow 5) is the gate that should catch this before the call proceeds — this is why skill governance needs to be enforced at the gateway/runtime level, not just as a one-time review when a skill is first built. |
| **A high-risk action executes with no human ever notified** | A financial transaction, an irreversible deletion, or another high-stakes action happens fully autonomously because it wasn't correctly classified as high-risk. | This is a rule-configuration gap (arrow 7's classification), not a platform failure — the risk-classification rules need active review as new skills and action types are added; a skill added after the initial risk-rule set was defined can silently fall through to "low-risk, proceeds automatically" if nobody updates the rules to catch it. |
| **HITL gate becomes a bottleneck and gets bypassed under pressure** | Under time pressure, an organization starts approving HITL requests without real review, or worse, starts reclassifying actions as low-risk just to avoid the gate. | Not a purely technical failure — but the audit logging in §3's final step (every HITL outcome logged) is specifically what makes this pattern's governance auditable after the fact, so this kind of gate erosion is at least detectable through review, even though the architecture alone can't force careful human judgment. |
| **Agent Gateway is bypassed entirely** | An agent (or a specific tool integration) makes calls that don't route through Agent Gateway at all, so none of these checks ever run. | See §6.1's tradeoff directly — this is the single most important operational assumption underlying the whole pattern; verifying that every agent's tool-call path actually routes through the gateway (not just that the gateway is configured well) is a deployment-architecture requirement, not a governance-policy one. |

---

## 8. Exam task mapping

| Task | How this pattern demonstrates it |
|---|---|
| **5.1** — Configuring agent security and governance | Auth Manager/OAuth 2.0 (arrow 2), PAB configuration via Agent Identity (arrow 4), Agent Gateway traffic monitoring/tracking (arrow 3), and governance/policy enforcement via Agent Registry and Model Armor (arrows 4–5). |
| **5.2** — Implementing secure agent behavior and execution | The full safety-framework/guardrail stack — Agent Gateway, Model Armor, and HITL together (arrows 3–8) — and secure data access/identity propagation through the request path (arrows 2–6). |
| **3.3** (cross-reference) | Agent Identity's role in multi-agent A2A handoffs is introduced in `pattern-multi-agent-a2a-mcp-orchestration.md` §4 and given its full treatment here. |
| **2.1/2.2** (cross-reference) | The agent-vs-human mode gate in `pattern-coding-agent-cicd-integration.md` is a specific instance of this pattern's HITL concept (§6.2), applied to coding-agent pipeline runs specifically. |

---

## 9. Exam traps specific to this pattern

- Treating PAB as a generic IAM concept rather than the specific,
  named, Agent-Identity-configured mechanism the guide describes.
- Confusing Auth Manager (authentication mechanics — getting a valid
  OAuth token) with Agent Identity/PAB (authorization scope — what
  that authenticated agent is actually bounded to do) — a call can
  clear Auth Manager and still be blocked by PAB.
- Treating Model Armor, Sensitive Data Protection, and HITL as
  redundant guardrails — each governs a different risk category
  (content pattern, data sensitivity, action risk), per §5's table,
  and a mature safety framework uses all three together, not as
  alternatives.
- Confusing Agent Gateway (runtime traffic checkpoint) with Agent
  Registry (discovery catalog the checkpoint consults) — they appear
  together in task 5.2 but play different roles.
- Confusing Skill Registry (skill-level governance) with Agent
  Registry (broader agent-level discovery/orchestration catalog).
- Assuming this pattern's checks apply automatically just because the
  underlying services exist somewhere in the organization — every
  agent's traffic actually has to route through Agent Gateway for any
  of this to take effect (§6.1, and the last row of §7).
- Assuming model-level safety training makes this pattern's explicit
  guardrails optional — see §6.3.
