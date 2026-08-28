# 02-services — Gemini Enterprise & Low-Code Tools

> **Covers (exam-guide §6 in-scope items):** Gemini Enterprise · Agent
> Search (formerly Vertex AI Search) · Gemini LLMs · Model Garden.
> **Also covers** (named in task bullets, not separately listed in §6):
> Agent Designer, CX Agent Studio — both are builder tools *inside*
> Gemini Enterprise, not standalone products.
>
> **Primary exam tasks supported:** 1.1 (Configuring agentic workflows
> and behavior using low-code tools), 1.2 (Connecting enterprise data to
> Gemini Enterprise). Section 1 is ~13% of the exam.
>
> **Currency reminder (see `CLAUDE.md` §7):** this file never says
> "Vertex AI Search" or "Vertex AI Agent Builder" except to name them as
> the old/retired branding. The current names are **Agent Search** and
> **Gemini Enterprise**.

---

## 1. Why this file exists

Section 1 of the exam guide is about building agents **without writing
orchestration code** — a business analyst, CX designer, or citizen
developer configures workflow behavior through consoles, not Python.
Six things make that possible, and this file treats each one as a
distinct exam surface even though several nest inside one another:

```
Gemini Enterprise                         ← the platform/umbrella product
 ├─ Agent Designer                        ← general-purpose low-code builder tool
 ├─ CX Agent Studio                       ← customer-experience-specialized builder tool
 ├─ Agent Search                          ← grounding service, pulled in as a data connector
 └─ Gemini LLMs                           ← the model(s) actually reasoning inside the agent
Model Garden                              ← the catalog Gemini LLMs (and other models) are selected from
```

Read that as: **Gemini Enterprise is the product you open**, **Agent
Designer / CX Agent Studio are the two builder surfaces inside it**,
**Agent Search is the data-grounding service it calls out to**, and
**Gemini LLMs / Model Garden are where the underlying model comes
from**. Exam questions that name one of these and ask "what does this
actually do" are testing whether you keep that nesting straight.

---

## 2. Gemini Enterprise

**What it is.** The low-code, no-code agent-building platform this
exam treats as the front door for Section 1. It is the product a
non-programmer opens to assemble an agentic workflow using visual
configuration rather than an SDK. Do not call this "Vertex AI Agent
Builder" — that branding is absent from the exam guide entirely; the
guide names **Gemini Enterprise** throughout Section 1, with Agent
Designer and CX Agent Studio as its two builder tools.

**Problem it solves.** Most enterprise agent use cases (an internal
HR-policy assistant, a support-ticket triage agent, a product-search
concierge) do not need custom multi-agent orchestration code — they
need a conversational flow, connected to the right enterprise data,
governed by prompt instructions a business owner can read and edit.
Building that in raw ADK code for every department is wasted engineering
effort. Gemini Enterprise is the platform that makes that configuration
accessible without a custom-development team, while still sitting on
the same underlying Google Cloud agent infrastructure (Agent Search for
grounding, Gemini LLMs for reasoning) that custom-built agents use.

**How it's configured.** Gemini Enterprise itself is the container:
you create an app/agent inside it, then do the actual behavior
configuration in one of its two builder tools (§3, §4 below). At the
platform level, Gemini Enterprise is where you:
- Register the agent as an app end users or systems interact with
- Attach one or more data connectors (Agent Search-backed) for grounding
- Choose the underlying Gemini LLM
- Set organization-level access controls for who can build/publish agents

**Task cross-reference.** 1.1 (workflow/behavior configuration happens
*through* Gemini Enterprise's builder tools), 1.2 (Gemini Enterprise is
explicitly named as the thing enterprise data gets "securely connected
and queried" through, via Agent Search).

**Decision note — Gemini Enterprise vs. custom ADK development (file
`03-adk-custom-development.md`).** Choose Gemini Enterprise when the
workflow is primarily conversational/state-machine shaped (pages,
intents, routing) and the team building it is not primarily software
engineers. Choose ADK custom development instead when the workflow
needs arbitrary code execution, custom multi-agent orchestration
(parallel/sequential/graph — see `04-orchestration-protocols.md`),
fine-grained control over retrieval/reranking logic, or integration
patterns Gemini Enterprise's console doesn't expose. The exam frames
this exact choice under task 3.1's model/architecture-selection
language — expect scenario questions where the "right" answer is
picking the low-code tool for a simple conversational agent and the
custom path for one needing bespoke logic.

---

## 3. Agent Designer

**What it is.** The general-purpose low-code builder tool inside
Gemini Enterprise. This is where task 1.1's specific configuration
verbs happen.

**Problem it solves.** Turns "I want an agent that does X" into a
buildable, testable object without code, by giving the builder explicit
primitives for conversation state and instruction-following.

**How it's configured — verbatim task 1.1 considerations:**
- **State-based workflows**: pages, transition routes, and event
  handlers. A "page" represents a state in the conversation (e.g.,
  "collecting order number"); **transition routes** define what moves
  the conversation from one page to another (an intent match, a
  condition, a parameter being filled); **event handlers** catch things
  that aren't a normal user turn (no-input timeout, webhook error,
  session escalation) and route the conversation accordingly. Think of
  this as a finite-state machine layered on top of an **LLM** (large
  language model — the AI model, such as Gemini, that actually reads
  and generates text) — the LLM handles language understanding and
  generation *within* a page, while the page graph gives you
  deterministic control over where the conversation can go.
- **System instructions and in-console prompt templates**: a
  **prompt** is the text — instructions plus context — actually sent to
  the LLM to produce a response; this is
  where you write the persona/behavior contract for the agent, and
  where you build reusable prompt templates using **few-shot**
  (embedding example input/output pairs directly in the instruction so
  the model pattern-matches the desired format) and **chain-of-thought**
  (instructing the model to reason step-by-step before answering,
  useful for anything involving policy lookups, calculations, or
  multi-condition decisions) prompting techniques — configured
  in-console, not in application code.

**Task cross-reference.** 1.1, directly and by name.

---

## 4. CX Agent Studio (Customer Experience Agent Studio)

**What it is.** The second low-code builder tool inside Gemini
Enterprise, named alongside Agent Designer in task 1.1 — specialized
for customer-experience/conversational-support use cases (contact
center deflection, chat support, voice agents) rather than
general-purpose agent building.

**Problem it solves.** CX-specific workflows have needs Agent Designer's
general page/route model can express but that CX Agent Studio surfaces
more directly for that use case: channel-specific behavior (chat vs.
voice), escalation-to-human handoff patterns, and CX-oriented analytics
on containment/deflection rates. The exam guide lists it as an
alternative builder alongside Agent Designer for the *same* task-1.1
considerations (state-based workflows, system instructions, prompt
templates) — treat CX Agent Studio as Agent Designer's config model
applied specifically to customer-support-shaped conversations, not a
functionally different config paradigm.

**How it's configured.** Same primitives as Agent Designer — pages,
transition routes, event handlers, system instructions, few-shot/CoT
prompt templates — with CX-specific tooling layered on top (e.g.,
support-channel integrations, live-agent handoff configuration).

**Task cross-reference.** 1.1.

**Decision note — Agent Designer vs. CX Agent Studio.** The exam guide
lists both as parenthetical examples for the *same* task-1.1 bullet
points, which is a strong signal the exam does not expect you to draw a
hard technical line between them — both configure state-based workflows
and instruction/prompt behavior inside Gemini Enterprise. If a question
forces a choice: CX Agent Studio is the CX-specialized surface (support
deflection, channel/escalation concerns front-and-center); Agent
Designer is the general-purpose surface for agent building that isn't
specifically a customer-support conversation. When a scenario doesn't
mention customer support at all, Agent Designer is the safer default
answer.

---

## 5. Agent Search (formerly Vertex AI Search)

**What it is.** The managed enterprise-data grounding/retrieval service
that Gemini Enterprise agents connect to for **RAG**-style grounding
(RAG = retrieval-augmented generation: looking up relevant enterprise
content and feeding it to the model before it answers, instead of
relying on what the model already learned during training) on
proprietary data. **Currency correction: this is "Agent Search," never
"Vertex AI Search."** The exam guide itself gives the old name only in
a parenthetical — "Agent Search (formerly Vertex AI Search)" — meaning
the guide expects you to recognize both names but answer using the
current one.

**Problem it solves.** An LLM's parametric knowledge doesn't include an
organization's internal documents, product catalogs, policy PDFs, or
proprietary databases. Without grounding, a low-code agent either
hallucinates answers about internal data or can't answer at all. Agent
Search is the low-code-friendly way to attach that data without hand-
building a retrieval pipeline — it is to Gemini Enterprise roughly what
RAG Engine + Vector Search 1.0 + Agent Retrieval (see
`03-adk-custom-development.md`) are to a custom ADK agent, but exposed
as a connector you configure, not code you write.

**How it's configured — verbatim task 1.2 considerations:**
- **Configuring agents to securely connect and query enterprise
  proprietary data sources.** This means setting up a data store/
  connector (structured data, websites, documents) with appropriate
  access controls so the agent can only retrieve data the querying
  principal is authorized to see — security is part of the
  configuration surface here, not an afterthought.
- **Ingesting and processing unstructured multimodal data** — videos,
  audio, and images — into the agentic workflow. Agent Search is not
  limited to text documents; it is explicitly scoped in the guide to
  handle multimodal enterprise content, meaning the ingestion pipeline
  extracts/embeds content from non-text sources so the agent can
  retrieve and reason over them too.

**Task cross-reference.** 1.2, directly and by name — this is the
single tool task 1.2 is built around.

**Decision note — Agent Search vs. RAG Engine/Vector Search 1.0 (file
`03-adk-custom-development.md`).** Agent Search is the low-code path:
point-and-configure a data connector inside Gemini Enterprise, get
grounding with minimal pipeline decisions exposed. RAG Engine + Vector
Search 1.0 + Agent Retrieval is the custom path: you choose the
embedding model, tune similarity scoring, configure reranking, and wire
it into an ADK agent's retrieval tool yourself. Choose Agent Search when
the agent lives inside Gemini Enterprise and the retrieval need is
"ground my answers on these enterprise documents" without bespoke
pipeline tuning. Choose the RAG Engine stack when you need fine control
over chunking/embedding/reranking or the agent is a custom ADK agent
outside Gemini Enterprise altogether.

---

## 6. Gemini LLMs

**What it is.** The Gemini family of large language models — the
reasoning/generation engine actually running inside a Gemini
Enterprise agent (and, when selected via Model Garden, inside custom
ADK agents too). The exam guide lists "Gemini LLMs" as its own in-scope
item, separate from Model Garden, because task 3.1 tests **model
selection as a decision** (LLM vs. SLM, self-hosted vs. SaaS, OSS vs.
proprietary), and Gemini LLMs is the proprietary, Google-hosted SaaS
option in that decision space.

**Problem it solves.** Every agent, low-code or custom, needs an
underlying model to do the actual language understanding, reasoning,
and generation. Gemini LLMs is Google Cloud's own frontier-model family
— the default, fully-managed choice with no separate hosting/serving
decision required, deep native integration with Gemini Enterprise,
Agent Search grounding, and the rest of the Google Cloud agent stack.

**How it's used.** Selected at the platform level (inside Gemini
Enterprise for low-code agents; via Model Garden/ADK configuration for
custom agents). Configuration decisions that matter for the exam are
about *fit*, not API mechanics: context window needs, latency/cost
tier, multimodal input requirements (an agent processing the
video/audio/image data from §5 needs a multimodal-capable model),
and reasoning-depth requirements (chain-of-thought-heavy tasks benefit
from a stronger reasoning tier).

**Task cross-reference.** 1.1/1.2 (implicitly — Gemini Enterprise agents
run on Gemini LLMs), 3.1 (explicitly — model selection is a named
consideration: "LLM vs. SLM, self-hosted vs. SaaS, OSS vs. proprietary,
considering cost, security, and agent architecture").

---

## 7. Model Garden

**What it is.** Google Cloud's model catalog/registry — the discovery
and selection surface for choosing a model to power an agent, spanning
Gemini LLMs, other Google first-party models, partner models, and
open-source models available on Google Cloud.

**Problem it solves.** Task 3.1 explicitly frames model choice as a
multi-dimensional decision: LLM vs. SLM (small language model — cheaper
and faster for narrow, well-defined tasks vs. a large model's broader
capability), self-hosted vs. SaaS (running your own model weights on
infrastructure you manage vs. consuming a fully-managed API), and OSS
vs. proprietary (licensing, customizability, and data-handling
implications). Model Garden is the one place that decision gets made
concretely — it's the catalog you browse to compare and deploy against
those axes, rather than a single fixed model choice.

**How it's used.** Browse/select a model in Model Garden based on the
task-3.1 decision axes, then deploy or reference it from wherever the
agent runs — a custom ADK agent, or (less directly) as the model backing
a Gemini Enterprise low-code agent.

**Task cross-reference.** 3.1, directly — Model Garden is the practical
mechanism behind the "selecting and configuring the appropriate
language model" bullet.

**Decision note — Gemini LLMs vs. Model Garden's broader catalog.**
These aren't competitors — Gemini LLMs *are* one of the choices inside
Model Garden. Frame it as: Gemini LLMs is the answer when the scenario
wants Google's own frontier model with the tightest native integration
and no separate hosting decision. Reach past it into Model Garden's
broader catalog when the scenario specifically calls for an SLM (cost/
latency-sensitive narrow task), a self-hosted/OSS model (data
residency, licensing, or customization requirements that rule out a
SaaS-only model), or a non-Gemini proprietary model for a specific
capability gap. An exam question that stresses "cost-sensitive,
narrow, high-volume task" is nudging you toward an SLM selected via
Model Garden, not a large Gemini model by default.

---

## 8. How these tools fit together

```
                         ┌─────────────────────────────┐
                         │        Model Garden          │
                         │ (catalog: Gemini LLMs, SLMs,  │
                         │  OSS models, partner models)  │
                         └───────────────┬───────────────┘
                                         │ (1) model selected/configured
                                         ▼
 ┌───────────────────────────────────────────────────────────────────┐
 │                         Gemini Enterprise                          │
 │  ┌─────────────────────┐        ┌─────────────────────────────┐   │
 │  │    Agent Designer     │  or   │      CX Agent Studio          │   │
 │  │  pages/routes/events   │◄────►│  same primitives, CX-tuned    │   │
 │  │  system instructions   │  (2) │  (channel/escalation config)  │   │
 │  │  few-shot / CoT prompts │       │                              │   │
 │  └───────────┬─────────────┘       └──────────────┬────────────┘   │
 │              │ (3) agent invokes Gemini LLM at runtime, per turn    │
 │              ▼                                                     │
 │      [ conversation turn: user input → page logic → LLM call ]     │
 │              │ (4) grounding lookup triggered mid-turn              │
 └──────────────┼──────────────────────────────────────────────────────┘
                ▼
     ┌─────────────────────────────┐
     │         Agent Search          │
     │  (data connectors: docs,      │
     │   structured data, multimodal │
     │   video/audio/image content)  │
     └───────────────┬───────────────┘
                     │ (5) retrieved passages/facts returned to the turn
                     ▼
        [ grounded response assembled and returned to the user ]
```

**Arrow-by-arrow:**
1. A model is picked from Model Garden's catalog (typically a Gemini
   LLM for a Gemini Enterprise agent) and configured as the reasoning
   engine for the agent being built.
2. The builder (a human) configures the agent's behavior in **either**
   Agent Designer **or** CX Agent Studio — both write to the same
   underlying Gemini Enterprise agent definition, just through
   different UI surfaces suited to different use cases.
3. At runtime, each conversation turn runs through the configured page/
   route logic, and the underlying Gemini LLM is called to interpret
   input and generate output within that structure.
4. When the turn needs enterprise-specific facts the model doesn't
   know, the agent's configured data connector triggers a lookup.
5. Agent Search returns retrieved, access-controlled content (including
   content originally ingested from multimodal sources), which gets
   folded into the model's context so the final response is grounded in
   real enterprise data rather than the model's parametric knowledge
   alone.

---

## 9. Quick-reference table

| Tool | Layer | Primary task | Config surface | Don't confuse with |
|---|---|---|---|---|
| Gemini Enterprise | Platform/umbrella | 1.1, 1.2 | Console (app registration, data connectors, model choice) | "Vertex AI Agent Builder" (not the exam's name) |
| Agent Designer | Builder tool | 1.1 | Pages / transition routes / event handlers / system instructions / prompt templates | CX Agent Studio (CX-specialized variant) |
| CX Agent Studio | Builder tool | 1.1 | Same primitives as Agent Designer, CX-tuned | Agent Designer (general-purpose variant) |
| Agent Search | Grounding service | 1.2 | Data connector config, access control, multimodal ingestion | "Vertex AI Search" (old name) |
| Gemini LLMs | Model | 1.1/1.2 (implicit), 3.1 | Selected in Model Garden / Gemini Enterprise console | Model Garden (Gemini LLMs is *inside* Model Garden's catalog) |
| Model Garden | Model catalog | 3.1 | Browse/select/deploy by LLM-vs-SLM, SaaS-vs-self-hosted, OSS-vs-proprietary axes | Gemini LLMs (one entry in this catalog, not the catalog itself) |

---

## 10. Exam traps specific to this file

- Writing "Vertex AI Search" or "Vertex AI Agent Builder" anywhere in an
  answer — both are retired/incorrect branding for this exam guide.
- Treating Agent Designer and CX Agent Studio as functionally distinct
  paradigms rather than the same configuration primitives (pages,
  routes, event handlers, system instructions, few-shot/CoT prompts)
  applied to two different builder surfaces.
- Assuming Agent Search only handles text documents — the guide
  explicitly scopes it to ingest **multimodal** (video/audio/image)
  unstructured data, not just text.
- Confusing "Gemini LLMs" (a specific model family, one catalog entry)
  with "Model Garden" (the catalog/selection mechanism itself).
