# Section 5 Cheatsheet — Securing and governing agentic workflows (~15%)

> Compressed by design (CLAUDE.md §10) — pure recall sheet. Decision tree
> for which security layer applies: `00-START-HERE/DECISION-TREES.md` §6.
> Full teaching content: `01-domains/SECTION-5-secure-govern.md`,
> `02-services/06-security-governance.md`.

Tasks: **5.1** configure agent security and governance · **5.2** implement secure agent behavior and execution.

---

## Tool glossary (one line each)

| Tool | One-line definition |
|---|---|
| **Auth Manager (OAuth 2.0)** | Handles **authentication** for agent-to-tool API calls — is this caller valid at all. |
| **Agent Identity** | Where **PAB (principal access boundary)** policies are configured — **authorization**: what an authenticated principal may do. |
| **PAB (principal access boundary)** | A specific named access-boundary policy mechanism, configured via Agent Identity. Not a generic IAM synonym. |
| **Agent Gateway** | Monitors traffic and tracks agents in real time; also handles **identity propagation** across multi-hop calls. |
| **Agent Registry** | Governance/policy-enforcement catalog of agents (reused from Section 3); paired with Agent Gateway in 5.2 for secure data/identity access. |
| **Model Armor** | Content-safety guardrail tooling — screens model input/output for unsafe patterns (prompt injection, jailbreaks, unsafe content). |
| **HITL (human-in-the-loop)** | A safety framework where a human must approve/review before a risky agent action proceeds. |
| **Sensitive Data Protection** | Detects/handles sensitive data (PII, secrets) in agent inputs/outputs — a data-sensitivity control, distinct from Model Armor's content-pattern focus. |
| **Skill Registry** | Governs **vetted skills** at the capability level — approval-focused, narrower than Agent Registry's broader agent-catalog scope. |

---

## 5.1 — Configuring agent security and governance

- **Authentication + secure tool execution** — agent-to-tool API calls secured via **OAuth 2.0** (Auth Manager).
- **PAB policies** — configured using **Agent Identity**.
- **Agent Gateway** — configured to **monitor traffic and track agents** (verbatim guide phrase).
- **Governance and policy enforcement** — via **Agent Registry** and **Model Armor**.

## 5.2 — Implementing secure agent behavior and execution

- **Safety frameworks and guardrails** — three named tools: **Agent Gateway, Model Armor, HITL.**
- **Secure access to data and identity propagation** — two named tools: **Agent Gateway and Agent Registry.**

---

## The four-layer mental model (who / what / safe / human)

```
  OAuth 2.0 (Auth Manager)   →  is this caller authenticated at all?
            |
  PAB via Agent Identity     →  WHO is allowed to act, and how far
            |
  Agent Gateway              →  WHAT's flowing right now + identity
                                 propagation across hops (monitoring)
            |
  Model Armor                →  is the CONTENT safe (input/output)?
            |
  Sensitive Data Protection  →  is sensitive DATA (PII/secrets) leaking?
            |
  HITL                       →  human checkpoint for high-risk/
                                 low-confidence actions, regardless
                                 of the above
```

Each layer answers a **different question** — a gap in one is not covered by another. This is defense-in-depth, not redundant controls.

---

## Disambiguation pairs (the exam's favorite Section 5 trap shape)

| Pair | Difference |
|---|---|
| **Auth Manager (OAuth 2.0)** vs. **PAB (Agent Identity)** | Authentication (valid caller) vs. authorization (what caller may do). |
| **PAB** vs. **Agent Gateway** vs. **Model Armor** | Who's allowed (once, boundary) vs. what's flowing now + propagation (continuous) vs. is content safe (screening). |
| **Model Armor** vs. **Sensitive Data Protection** | Content-pattern safety (injection/jailbreak) vs. data-sensitivity leakage (PII/secrets) — same section, different failure mode. |
| **Skill Registry** vs. **Agent Registry** | Vetted skills, capability-level, approval-focused vs. discoverable agents, broader orchestration/governance catalog. |

---

## Quick facts

- Section weight: **~15%**, third-smallest.
- Agent Identity and Agent Registry are **reused from Section 3** here with a governance lens — same platform primitives, different task context (3.2/3.3 = build-time integration/orchestration; 5.1/5.2 = security/governance).
- Low-code agents (Section 1) are NOT exempt from this layer — Gemini Enterprise agents sit under the same Agent Identity/PAB/Agent Gateway surface as custom ADK agents.
- "Identity propagation across hops" → Agent Gateway, not PAB. PAB sets the boundary once; propagation is a continuous traffic-layer job.

## 5-second recall

**OAuth2/Auth Manager authenticates → PAB via Agent Identity authorizes (who) → Agent Gateway monitors traffic + propagates identity (what, continuously) → Model Armor screens content safety, Sensitive Data Protection screens data leakage → HITL is the human backstop → Agent Registry + Skill Registry govern the agent/skill catalogs underneath it all.**
