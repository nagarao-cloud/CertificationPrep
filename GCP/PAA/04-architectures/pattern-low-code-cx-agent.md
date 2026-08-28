# Pattern — Low-Code Customer-Facing Support Agent

> **Pattern summary:** A customer support agent built entirely with
> low-code tools — **Gemini Enterprise** as the platform, **CX Agent
> Studio** (or **Agent Designer**) as the builder, and **Agent Search**
> for grounding on enterprise data — deployed to production and serving
> real end-user traffic across chat and voice.
>
> **Primary exam tasks:** 1.1 (Configuring agentic workflows and
> behavior using low-code tools), 1.2 (Connecting enterprise data to
> Gemini Enterprise). Section 1 is ~13% of the exam. Secondary tasks
> touched: 5.1/5.2 (access control on the data connector), 4.2
> (basic production monitoring).
>
> **Currency reminders applied in this file:** "Agent Search," never
> "Vertex AI Search." "Gemini Enterprise," never "Vertex AI Agent
> Builder." Component names match `02-services/01-gemini-enterprise-low-code.md` exactly — read that file first if any term
> below (Agent Designer, CX Agent Studio, pages/routes/event handlers,
> few-shot/chain-of-thought) is unfamiliar; this file assumes that
> service-level vocabulary and focuses on how the pieces assemble into
> one deployed system.

---

## 1. What this pattern is, and when you reach for it

**Ground-zero framing first.** An "agent," in this whole certification,
means a system built on a large language model (**LLM** — a model
trained on huge amounts of text that can understand and generate
natural language, and that can also decide to call external tools)
that doesn't just answer one question in isolation — it holds a
conversation, follows instructions about how to behave, and can reach
out to real data or real systems to do its job, rather than only
drawing on what it was trained on. A **customer-facing support agent**
is the single most common first production use case for this
technology: replace or augment a human support agent answering
"where is my order," "how do I reset my password," "what's your
return policy" — questions that have real, current, correct answers
sitting in company data, not just in the model's general training.

This pattern is the **low-code** way to build that agent: nobody on
the team writes a line of Python to make the conversation logic work.
A conversation designer (who might be a business analyst, a CX
specialist, or a product manager — not necessarily a software
engineer) configures the agent's behavior visually inside **Gemini
Enterprise**, using **CX Agent Studio** or **Agent Designer** as the
builder tool, and points it at the company's real support content
through **Agent Search**.

**Reach for this pattern when:**
- The conversation is fundamentally a structured flow — collect an
  order number, look up the order, present the status, offer next
  steps — that fits a state-machine shape (see §3 below), not
  open-ended multi-step reasoning.
- The team building it is not primarily software engineers, or the
  organization wants business-side ownership of the conversation
  design so it can be edited without a code deploy.
- The knowledge the agent needs to ground its answers on already
  exists as documents, FAQs, policy pages, or structured records —
  Agent Search's connector model can ingest that with configuration,
  not custom pipeline code.
- Time-to-first-version matters more than deep customizability — this
  pattern gets a working agent in front of users faster than a custom
  build.

**Don't reach for this pattern when** the workflow needs arbitrary
code execution, custom multi-agent orchestration, or retrieval logic
Agent Search's console doesn't expose — that's the custom-development
path covered in `pattern-custom-multi-agent-adk.md`, with the
head-to-head tradeoff discussion in §7 below.

---

## 2. The building blocks, briefly (full detail lives in `02-services/01-gemini-enterprise-low-code.md`)

| Block | One-line role in this pattern |
|---|---|
| **Gemini Enterprise** | The platform/umbrella product — the app the agent lives inside, where data connectors and the underlying model are registered. |
| **CX Agent Studio** (or **Agent Designer**) | The builder tool where the conversation designer configures pages, transition routes, event handlers, system instructions, and prompt templates. This pattern uses CX Agent Studio by default (it's the CX-specialized surface — see the Agent-Designer-vs-CX-Agent-Studio decision note in `02-services/01-gemini-enterprise-low-code.md` §4) but everything here applies identically if Agent Designer is used instead. |
| **Gemini LLMs** | The reasoning/generation model actually running inside each conversation turn, selected via Model Garden. |
| **Agent Search** | The grounding service — data connectors that let the agent retrieve real enterprise content (docs, structured records, multimodal files) instead of relying only on the model's general knowledge. |
| **Fulfillment webhook** | Not one of the 28 in-scope named tools by itself, but the standard mechanism by which a page/route in CX Agent Studio calls out to an external system (e.g., an order-status API) to fetch live, per-user data Agent Search's static content connectors don't hold. |
| **Google Cloud Observability** | Cloud Logging + Cloud Trace, monitoring the deployed agent's live traffic (full treatment in `pattern-evaluation-deployment-pipeline.md`; this pattern uses it only for basic production visibility). |

---

## 3. Full production architecture

```
                                   END USERS
        ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
        │  Web chat       │   │  Mobile app      │   │  Voice / IVR     │
        │  widget          │   │  chat SDK          │   │  channel          │
        └────────┬──────┘   └────────┬──────┘   └────────┬──────┘
                 │ (1) user message, any channel
                 └──────────────────┬──────────────────────┘
                                     ▼
                    ┌─────────────────────────────────────┐
                    │           GEMINI ENTERPRISE             │
                    │   registered app; org-level access       │
                    │   controls; channel integrations           │
                    └───────────────────┬─────────────────┘
                                        │ (2) routed into the configured agent
                                        ▼
     ┌────────────────────────────────────────────────────────────────────┐
     │                         CX AGENT STUDIO                               │
     │  ┌───────────────────────────────────────────────────────────────┐  │
     │  │  Page: "Greeting"  ──(3a) intent match──▶  Page: "Order Lookup" │  │
     │  │       │                                          │              │  │
     │  │       │ (3b) no-input timeout            (3c) parameter filled  │  │
     │  │       ▼                                          ▼              │  │
     │  │  Event handler: "Re-prompt"          Page: "Order Status Result"│  │
     │  │                                                   │              │  │
     │  │                                        (3d) low-confidence /    │  │
     │  │                                            escalation intent    │  │
     │  │                                                   ▼              │  │
     │  │                                        Page: "Live Agent Handoff"│  │
     │  └───────────────────────────────────────────────────────────────┘  │
     │   Each page carries: system instructions + few-shot/CoT prompt        │
     │   templates that shape how the LLM behaves *within* that page          │
     └───────┬───────────────────────────┬───────────────────────┬────────┘
             │ (4) LLM call per turn        │ (5) grounding lookup   │ (6) fulfillment call
             ▼                              ▼                       ▼
  ┌─────────────────────┐   ┌──────────────────────────┐   ┌─────────────────────────┐
  │      Gemini LLM        │   │        AGENT SEARCH          │   │   Fulfillment webhook     │
  │  (selected via Model     │   │  data connectors:              │   │  (external order-status    │
  │   Garden — reasoning       │   │   - docs / FAQs / policies       │   │   API, order-management     │
  │   + generation for this     │   │     (Cloud Storage-backed,        │   │   system, or Cloud SQL/      │
  │   turn)                     │   │      see 02-services/07)           │   │   BigQuery-backed service)    │
  └─────────────────────┘   │   - structured records               │   └───────────┬─────────────┘
                              │   - multimodal content                 │              │
                              │     (video/audio/image,                 │              │
                              │      task 1.2)                          │              │
                              │   - per-principal access control          │              │
                              │     (only returns content the             │              │
                              │      querying user is allowed to see)      │              │
                              └──────────────┬────────────────────────┘              │
                                             │ (7) grounded passages returned          │
                                             │                                          │
                                             └─────────────┬────────────────────────────┘
                                                            │ (8) assembled into the LLM's context
                                                            ▼
                                              [ grounded, on-brand response returned
                                                to the user, or handoff to a human ]
                                                            │
                                                            ▼
                    ┌─────────────────────────────────────────────────┐
                    │      Google Cloud Observability (Cloud Logging +   │
                    │      Cloud Trace) — logs every turn, every           │
                    │      grounding lookup, every escalation                │
                    └─────────────────────────────────────────────────┘
                                                            │ (9) findings feed back into
                                                            ▼   prompt/data tuning (§6)
                                              [ conversation designer reviews
                                                transcripts, tunes pages/prompts/
                                                data connectors ]
```

---

## 4. Arrow-by-arrow walkthrough

1. **A user sends a message on any supported channel.** The exam
   guide's task 1.1 does not name specific channel technology, but a
   realistic production deployment fans in from multiple surfaces — a
   web chat widget embedded on a support site, a mobile app's in-app
   chat, or a voice/IVR (interactive voice response) channel — all
   funneling into the same underlying agent definition.
2. **Gemini Enterprise receives the message and routes it into the
   configured agent.** This is the platform layer: organization-level
   access controls (who can even reach this agent) and channel
   integration are handled here, before conversation logic runs.
3. **CX Agent Studio's page/route/event-handler graph drives the
   conversation.** This is the state-machine layer explained in
   `02-services/01-gemini-enterprise-low-code.md` §3: a **page**
   represents a conversation state (e.g., "collecting order number");
   a **transition route** is a rule (an intent match, a filled
   parameter, a condition) that moves the conversation from one page
   to the next; an **event handler** catches things that aren't a
   normal reply — a no-input timeout re-prompting the user, a
   low-confidence match, or an explicit request to talk to a human,
   routing to escalation instead of guessing. Each page also carries
   its own **system instructions** (a persona/behavior contract for
   the LLM while in that page) and **few-shot/chain-of-thought prompt
   templates** — few-shot meaning example input/output pairs baked
   into the instruction so the model pattern-matches the desired
   format, chain-of-thought meaning an instruction to reason
   step-by-step before answering, useful for anything involving a
   multi-condition policy lookup (e.g., "is this return eligible").
4. **Each turn calls the underlying Gemini LLM.** The model interprets
   the user's input within the current page's instructions and decides
   what to say or do next — including whether this turn needs
   grounding.
5. **When the turn needs a fact the model doesn't know, Agent Search is
   queried.** This is the grounding step from task 1.2: Agent Search's
   data connectors hold the company's support documentation, FAQs,
   policy pages (originally landing in Cloud Storage before ingestion —
   see `02-services/07-data-services.md` §4), structured records, and
   ingested multimodal content (a product demo video, a diagram image
   — task 1.2's explicit "videos, audio, and images" scope).
   Critically, this lookup is **access-controlled per querying
   principal**: the connector is configured so a user only gets back
   content they're authorized to see — an internal-only troubleshooting
   doc doesn't leak to an external customer just because it matched
   semantically.
6. **When the turn needs live, per-user data — not static
   documentation — a fulfillment webhook is called instead of, or
   alongside, Agent Search.** "What's the status of order #48213" isn't
   answerable from a document; it needs a real-time lookup against an
   order-management system, which task 3.2's "custom integration
   layers for managed databases" and "API integrations" language
   covers at the custom-development layer, and which this pattern
   expresses at the low-code layer as a webhook a page's route
   triggers.
7. **Agent Search returns grounded, access-filtered passages** back
   into the turn.
8. **The LLM assembles the retrieved grounding content, the
   fulfillment result (if any), and the page's system instructions
   into a final response** — this is what makes the answer "grounded":
   it's built from real company content and real live data, not the
   model's general training alone. If the turn's event handlers or
   routes determined this needs a human, the response is instead a
   handoff to a live agent, carrying the conversation transcript so
   the human doesn't start from zero.
9. **Every turn, every grounding lookup, and every escalation is
   logged** through Google Cloud Observability. A conversation designer
   reviews this — which questions triggered no good grounding match,
   which pages saw unexpected escalations, which prompts produced
   off-brand answers — and iterates on the pages, prompts, or data
   connectors, closing the loop without needing an engineering deploy
   cycle for most changes.

---

## 5. Why the state-machine shape matters (a beginner note)

If you've only used a raw LLM chat interface before, the page/route/
event-handler model can feel like unnecessary structure — why not just
let the model freely decide what to say? The answer is **deterministic
control over where a support conversation can go**, layered on top of
the model's language flexibility. A support agent that occasionally
wanders into no man's land — refusing to escalate when it should,
looping on the same clarifying question, or confidently answering a
question it has no grounding for — is a support failure, not just an
awkward chat. The page graph is what lets a non-engineer say, in
effect, "no matter what the model generates as text, if we're on the
Order Lookup page and three attempts to get a valid order number have
failed, always transition to Live Agent Handoff" — a guarantee raw
prompting alone can't give you. The LLM still does all the actual
language understanding and generation *within* each page; the graph
constrains *between* pages.

---

## 6. Design decisions and tradeoffs

### 6.1 CX Agent Studio vs. Agent Designer for this pattern

Per `02-services/01-gemini-enterprise-low-code.md` §4's decision note,
these are the same configuration primitives applied to two builder
surfaces. **Use CX Agent Studio** when the deployment is specifically
customer-support-shaped — this pattern's default — because it
surfaces channel-specific behavior (chat vs. voice) and live-agent
escalation tooling more directly. **Use Agent Designer** if the same
architecture is repurposed for a use case that isn't specifically
customer support (e.g., an internal HR-policy assistant) — the
diagram above is otherwise unchanged.

### 6.2 Agent Search connector vs. hand-built ingestion

**Chosen here:** Agent Search's managed data-connector model — point
it at Cloud Storage buckets, structured data sources, and multimodal
content, and let it handle chunking, embedding, and indexing
internally.

**Alternative:** hand-build the ingestion pipeline (RAG Engine +
Vector Search 1.0 + Agent Retrieval, wired into custom code) — this is
the custom-development path, covered fully in
`pattern-custom-multi-agent-adk.md`.

**Tradeoff.** Agent Search trades fine-grained pipeline control
(custom chunking strategy, a non-default embedding model, custom
reranking logic) for configuration speed and zero pipeline code to
maintain. Choose the custom path instead when retrieval quality on a
specific, non-default corpus shape genuinely requires that control —
for a generic support-documentation corpus, Agent Search's defaults
are usually the right starting point, and this pattern assumes that's
the case.

### 6.3 Low-code CX agent vs. a fully custom ADK agent (the pattern-level tradeoff)

This is the central architectural choice task 3.1 and Section 1's
framing both point at, and it deserves the fullest treatment here
since it's this pattern's defining tradeoff:

| Dimension | Low-code (this pattern) | Custom ADK agent (`pattern-custom-multi-agent-adk.md`) |
|---|---|---|
| Who can build/edit it | Conversation designers, business analysts, CX specialists | Software engineers |
| Time to first working version | Fast — hours to days for a simple flow | Slower — requires writing and testing agent code |
| Conversation shape it fits | State-machine / conversational flows (pages, routes) | Arbitrary control flow, multi-step reasoning, multi-agent orchestration |
| Retrieval control | Agent Search's connector defaults | Full control: chunking, embedding model, reranking (RAG Engine / Vector Search 1.0 / Agent Retrieval) |
| Multi-agent orchestration | Not supported natively | Full support (A2A, parallel/sequential/graph — see `pattern-multi-agent-a2a-mcp-orchestration.md`) |
| Memory model | Session state implicit in the page graph | Explicit managed sessions + Memory Bank, fully controllable |
| Where changes get made | In-console, no deploy pipeline needed for most edits | Code change, tested, deployed through CI/CD |
| Best fit | A support/FAQ/lookup agent whose logic is genuinely a flow | An agent needing custom reasoning, multi-agent coordination, or bespoke retrieval tuning |

**The exam's own framing (from `01-gemini-enterprise-low-code.md`
§2's decision note, restated here for this pattern's context):**
choose the low-code path when the workflow is primarily
conversational/state-machine shaped and the team isn't primarily
engineers; choose custom ADK development when the workflow needs
arbitrary code execution, custom multi-agent orchestration, or
retrieval logic the console doesn't expose. A scenario question
describing "a business team needs to quickly stand up a policy FAQ
bot" points to this pattern; one describing "an agent that needs to
coordinate with a specialized coding sub-agent and a data-analysis
sub-agent" points to the custom path.

### 6.4 Low-code CX agent vs. no agent at all (a rule-based chatbot / static FAQ page)

**Alternative worth naming explicitly:** many organizations' first
instinct for "answer common support questions" is a keyword-matched
rule-based chatbot or a static FAQ page, not an LLM-backed agent at
all.

**Tradeoff.** A rule-based/static approach has near-zero hallucination
risk (it can only ever return pre-written answers) and no ongoing
model cost, but it cannot handle phrasing variation, cannot combine
information across multiple documents in one answer, and cannot hold
a multi-turn conversation that adapts to what the user has already
said. This pattern is the right upgrade when support volume and
question variety are high enough that rigid keyword matching produces
too many "I don't understand" dead ends — the LLM's language
flexibility is what buys back the ability to handle real, messy
phrasing, at the cost of needing grounding (Agent Search) and
guardrails (§7) to keep answers accurate.

---

## 7. Common failure modes and how this design handles them

| Failure mode | What it looks like | How this architecture mitigates it |
|---|---|---|
| **Hallucinated answer** | The agent confidently states a policy or fact that isn't true, because it answered from general training instead of grounded content. | Agent Search grounding (arrow 5) + a system instruction on each page explicitly requiring the agent to answer only from retrieved content and say "I don't know, let me connect you with someone" otherwise. This is a prompt-engineering discipline, not something Agent Search enforces automatically — a common exam trap is assuming grounding alone prevents hallucination; the system instruction has to *require* the model to actually use it. |
| **Escalation that never triggers** | A user is stuck in a low-confidence loop and never gets routed to a human, because no event handler or route was configured to catch it. | The event-handler layer (arrow 3b/3d) exists specifically for this — a well-designed page graph has an explicit low-confidence/repeated-failure route to the Live Agent Handoff page, not just happy-path routes. |
| **Access-control leak in grounding** | The agent surfaces internal-only content to an external user because the data connector wasn't scoped per-principal. | Agent Search's connector-level access control (arrow 5's "per-principal access control" note) — this must be configured deliberately per task 1.2's "securely connect and query" language; it is not automatic just because a connector exists. |
| **Prompt injection via retrieved content** | A malicious or manipulated document ingested into Agent Search's index contains text instructing the agent to ignore its system instructions or leak data. | Full defense-in-depth for this belongs to Section 5 (see `pattern-secure-governed-enterprise-agent-platform.md`'s Model Armor coverage) — this pattern alone is not sufficient for a high-risk deployment; a production rollout of this exact architecture should layer Model Armor content-safety checks on top, which is why task 1.1/1.2's low-code pattern and Section 5's governance pattern are meant to be read together for a real deployment, not treated as separate concerns. |
| **Multimodal ingestion producing poor retrieval** | A video or diagram gets ingested but its embedded representation doesn't actually capture what a user would ask about it, so it never surfaces as a grounding match. | Task 1.2 scopes multimodal ingestion as an explicit configuration surface, not a fire-and-forget step — this needs the same iterate-and-review discipline as text content (arrow 9's feedback loop), checking whether multimodal sources are actually being retrieved for the queries they should answer. |
| **Conversation state loss mid-flow** | The agent seems to "forget" what the user already said a few turns ago. | The page graph carries state implicitly as parameters collected along the way; a common design mistake is a route that transitions to a new page without carrying forward a parameter the next page's prompt template depends on — this is a configuration bug in the page graph, not a platform limitation, and is caught by testing each route path explicitly before publishing. |
| **Fulfillment webhook latency or failure dragging down the whole turn** | A slow or failing order-status API makes the whole conversation feel broken, even though the conversational layer is fine. | The event-handler pattern (§3) applies here too — a webhook-call route should have a timeout/error event handler that gives the user a graceful fallback ("I'm having trouble looking that up right now, let me connect you with someone") rather than leaving the turn hanging. |

---

## 8. Exam task mapping

| Task | How this pattern demonstrates it |
|---|---|
| **1.1** — Configuring agentic workflows and behavior using low-code tools | The full page/transition-route/event-handler graph (§3, arrow 3), plus system instructions and few-shot/CoT prompt templates per page. |
| **1.2** — Connecting enterprise data to Gemini Enterprise | The Agent Search grounding path (arrow 5), including secure per-principal querying and multimodal (video/audio/image) ingestion. |
| **5.1/5.2** (secondary) — security and governance | Agent Search's per-principal access control (arrow 5) is a real, if partial, instance of task 5's access-control concerns, even though this pattern's primary weight is Section 1 — full governance treatment (Model Armor, HITL, Agent Gateway) belongs to `pattern-secure-governed-enterprise-agent-platform.md`. |
| **4.2** (secondary) — monitoring | Arrow 9's Observability loop is a lightweight instance of task 4.2's monitoring considerations; the full evaluation/deployment pipeline is `pattern-evaluation-deployment-pipeline.md`. |

---

## 9. Exam traps specific to this pattern

- Assuming a low-code CX agent has no data-security surface because
  "it's just a chatbot" — task 1.2's "securely connect and query" is
  explicit, and the failure-mode table above shows why access control
  on the data connector is a real design decision, not a default.
- Assuming grounding (Agent Search) by itself prevents hallucination —
  it supplies retrievable content; the system instruction still has to
  require the model to actually rely on it.
- Treating "low-code" as "no failure modes to design for" — every
  failure mode in §7 is a real production concern in a CX Agent
  Studio/Agent Designer deployment, even though no custom code is
  written.
- Reaching for this pattern when the scenario actually describes
  multi-agent coordination or bespoke retrieval tuning — that's a
  signal for the custom-development pattern (§6.3), not this one.
