# Section 1 Cheatsheet — Building agents using low-code tools (~13%)

> Compressed by design (CLAUDE.md §10) — pure recall sheet. For traps see
> `00-START-HERE/EXAM-TRAPS-AND-MNEMONICS.md`, for the build-vs-custom
> decision tree see `00-START-HERE/DECISION-TREES.md` §1. Full teaching
> content: `01-domains/SECTION-1-low-code-tools.md`,
> `02-services/01-gemini-enterprise-low-code.md`.

Tasks: **1.1** configure workflows/behavior · **1.2** connect enterprise data.

---

## Tool glossary (one line each)

| Tool | One-line definition |
|---|---|
| **Gemini Enterprise** | The umbrella low-code platform for building/deploying agents without writing orchestration code. NOT "Vertex AI Agent Builder" — that name is absent from the guide. |
| **Agent Designer** | Gemini Enterprise's builder tool for general-purpose agents: state-based workflows, system instructions, prompt templates. |
| **CX Agent Studio** | Customer-Experience-flavored builder alongside Agent Designer — same low-code layer, aimed at conversational/support-style agents. |
| **Agent Search** | Enterprise data-grounding/retrieval service used by Gemini Enterprise agents. **Formerly Vertex AI Search — never say the old name.** |

---

## 1.1 — Configuring workflows and behavior

**State-based workflow building blocks** (memorize the three nouns):
- **Pages** — a state the conversation/agent can be in.
- **Transition routes** — the rules that move the agent from one page to another (based on intent, condition, or event).
- **Event handlers** — reactions to things that happen mid-flow (no-match, no-input, escalation, webhook errors).

Built with **Agent Designer** and/or **CX Agent Studio**.

**Prompt-engineering techniques named explicitly in the guide:**
- **System instructions** — persistent behavior/persona rules for the agent.
- **In-console prompt templates**, specifically:
  - **Few-shot** — a handful of example input/output pairs embedded in the prompt to steer format/tone.
  - **Chain-of-thought** — prompting the model to reason step-by-step before answering.

**Scope boundary:** 1.1 is about *authoring behavior in-console* — it is NOT about choosing which model runs underneath. Model selection (LLM vs. SLM, self-hosted vs. SaaS, OSS vs. proprietary) is task **3.1**, not 1.1.

---

## 1.2 — Connecting enterprise data

- Agents must **securely connect and query proprietary enterprise data sources** — via Gemini Enterprise + **Agent Search**.
- Must also **ingest and process unstructured multimodal data** — videos, audio, images — into the agentic workflow, not just text documents.
- "Securely" here foreshadows Section 5 — low-code agents still sit under the same Agent Identity/PAB/Agent Gateway security surface as custom agents (see EXAM-TRAPS §5, "low-code governance trap").

---

## Quick facts

- Section weight: **~13%**, the smallest of the 5.
- 2 tasks only (1.1, 1.2) — the shallowest task structure of any section.
- Low-code = console-configured behavior, no custom orchestration code, bound to Gemini Enterprise's model/tool surface.
- Signal that a question belongs here, not Section 3: "pages," "transition routes," "event handlers," "in-console," "prompt template," "few-shot/chain-of-thought," "Agent Designer," "CX Agent Studio" — none of these words appear in Section 3's custom-code context.
- Signal it's NOT here: "parallel/sequential/graph workflow," "open-source library," "SLM/self-hosted/OSS" — those are Section 3.

## 5-second recall

**Gemini Enterprise → Agent Designer / CX Agent Studio build the pages/routes/handlers and the prompts (few-shot, chain-of-thought) → Agent Search grounds it on enterprise data, including multimodal.**
