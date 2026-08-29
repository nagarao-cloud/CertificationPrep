# Section 1 — Building agents using low-code tools (~13%)

> Source of truth: `00-START-HERE/RUNBOOK.md` §3, Section 1 (verbatim
> task bullets from the official exam guide PDF). Tasks covered here:
> **1.1** (configuring agentic workflows/behavior with low-code tools)
> and **1.2** (connecting enterprise data to Gemini Enterprise).
>
> Currency reminder before you read another word: the low-code platform
> this exam tests is **Gemini Enterprise**, built with **Agent
> Designer** and **CX Agent Studio**. "Vertex AI Agent Builder" does
> not appear in the guide — if you see that name in older blog posts or
> generic AI-model knowledge, mentally discard it for this exam. The
> grounding service is **Agent Search**, formerly Vertex AI Search — say
> "Agent Search" on the exam, and note the rename only when explicitly
> flagging it.

---

## 0. Where Section 1 sits in the exam's mental model

Section 1 is the "no-code/low-code" end of a spectrum that runs across
the whole exam:

```
LOW-CODE                                                    FULL CODE
Gemini Enterprise -------- ADK custom agents -------- raw model calls
(Agent Designer,           (Section 3, ~33%)           + hand-rolled
 CX Agent Studio)                                       orchestration
   Section 1 (~13%)
```

Section 1 is deliberately the smallest section (~13%) but it is not
"easy points" — it tests whether you know the *specific* configuration
primitives Gemini Enterprise exposes (pages, transition routes, event
handlers, system instructions, prompt templates) and the *specific*
data-connection story (Agent Search, multimodal ingestion). Vague
"I know how a chatbot builder works" intuition will miss the
exam-specific vocabulary these questions test.

Two tasks:

- **1.1** — configuring the workflow/behavior itself (the agent's
  conversational logic and instructions)
- **1.2** — connecting the agent to enterprise data (grounding,
  multimodal ingestion)

---

## 1. Task 1.1 — Configuring agentic workflows and behavior using low-code tools

### 1.1.1 Gemini Enterprise: what it actually is

**Gemini Enterprise** is Google Cloud's low-code/no-code platform for
building and deploying conversational and agentic experiences without
writing a custom orchestration loop in Python or another language. It
is the platform-level umbrella; within it, two builder surfaces are
named explicitly by the exam guide:

| Tool | What it's for | Primary user |
|---|---|---|
| **Agent Designer** | General-purpose low-code agent builder inside Gemini Enterprise — configuring instructions, prompt templates, tool/data connections for an agent | Solution architects, less code-centric builders |
| **CX Agent Studio** (Customer Experience Agent Studio) | Purpose-built for conversational/customer-experience agents — state machine style design (pages, transitions, event handlers), closer to a traditional conversational-AI / IVR-replacement builder | Contact-center / CX teams building structured conversational flows |

Think of Agent Designer as the broader low-code agent authoring
surface, and CX Agent Studio as the specialized tool for
**state-based, page/transition-driven** conversational design — the
kind of design pattern you'd recognize from Dialogflow CX-style
conversational builders, but exposed here under the Gemini Enterprise /
CX Agent Studio branding this exam actually uses.

**Don't say** "Dialogflow CX" as the exam's tool name here — even
though the state-machine concepts (pages, transition routes, event
handlers) will feel familiar to anyone who has used Dialogflow CX, the
exam guide's vocabulary is **Gemini Enterprise → Agent Designer / CX
Agent Studio**. Answer with the guide's names.

### 1.1.2 State-based workflow configuration: pages, transition routes, event handlers

CX Agent Studio's core authoring model is a **state machine**. You are
not writing "if user says X then Y" in free-text; you are configuring a
graph of states with explicit transitions:

- **Pages** — a page represents a state in the conversation: a discrete
  step where the agent is trying to accomplish one thing (collect a
  parameter, present a menu, confirm an order, hand off to a human).
  Each page can define its own set of expected inputs, its own local
  prompt/instruction context, and its own set of allowed transitions
  out.
- **Transition routes** — the edges of the graph. A transition route
  fires when a condition is met (an intent is matched, a parameter is
  filled, a condition expression evaluates true) and moves the
  conversation from the current page to a target page (or triggers a
  flow-level action). Routes are evaluated in a defined priority
  order — a critical exam detail: **more specific / higher-priority
  routes should be ordered so they are checked before general fallback
  routes**, otherwise a broad catch-all route can "steal" a turn that
  should have matched a more specific one.
- **Event handlers** — different from a transition route because they
  don't fire on user intent — they fire on *system events*: no-input
  timeout, no-match (the user's utterance didn't map to any expected
  intent), webhook error, session expiration. Event handlers are what
  make a state machine robust in production instead of just handling
  the "happy path." A page without a no-match event handler will fall
  through to a default/generic error, which is usually the wrong UX for
  a production agent.

```
                     ┌─────────────────────────────┐
                     │           Page: Start         │
                     │  (greet user, ask intent)      │
                     └───────────────┬───────────────┘
                                      │
                 ┌────────────────────┼────────────────────┐
                 │ transition route    │ transition route    │ event handler
                 │ (intent: "check     │ (intent: "file a    │ (no-match,
                 │  order status")     │  return")            │  no-input)
                 ▼                    ▼                      ▼
     ┌───────────────────┐ ┌───────────────────┐  ┌──────────────────────┐
     │ Page: Order Status │ │ Page: Return Flow  │  │ Event: reprompt or   │
     │ (collect order id) │ │ (collect item,     │  │ escalate to human    │
     └─────────┬──────────┘ │  reason)            │  └──────────────────────┘
               │            └─────────┬───────────┘
     transition route                 │ transition route
     (parameter filled)               │ (all required params filled)
               ▼                      ▼
     ┌───────────────────┐  ┌───────────────────┐
     │ Page: Confirm &    │  │ Page: Confirm      │
     │ Present Status     │  │ Return & Submit     │
     └────────────────────┘  └─────────────────────┘
```

Diagram walkthrough: the **Start** page has two intent-driven
transition routes (to Order Status or Return Flow) and one **event
handler** covering both no-match and no-input — that handler is
attached at the page level so it applies regardless of which route the
conversation was trying to take. Each downstream page has its own exit
transition route gated on "required parameters filled," which is a
common CX Agent Studio pattern: don't transition until the page's
required slots are satisfied, otherwise you hand an incomplete request
downstream.

**Exam trap:** event handlers are frequently confused with transition
routes in distractor answers. Remember the distinction: transition
routes react to **what the user said** (intent match, condition on a
filled parameter); event handlers react to **what the system
observed** (timeout, error, no-match) — not user intent at all.

### 1.1.3 System instructions and in-console prompt templates

Both Agent Designer and CX Agent Studio let you shape the underlying
**LLM's** (large language model — the AI model, such as Gemini, that
actually reads instructions and generates the agent's responses)
behavior without leaving the console, via two related but distinct
mechanisms. Everything sent to that model at once — instructions,
context, and the user's input — is collectively called the **prompt**;
the two mechanisms below are Gemini Enterprise's console-level ways of
shaping that prompt without hand-writing it yourself:

- **System instructions** — the persistent, top-level behavioral
  contract for the agent: persona, tone, hard constraints ("never
  discuss competitor pricing"), scope boundaries ("only answer
  questions about order status; hand off anything else"). This is
  analogous to a system prompt in raw API terms, but configured as a
  first-class console setting rather than a string you concatenate
  yourself.
- **In-console prompt templates** — reusable, parameterized prompt
  structures for specific interaction points (e.g., a template for
  "summarize this ticket for the agent" or "generate a confirmation
  message given these slot values"). The exam guide calls out two
  specific prompting techniques you should be able to recognize and
  apply *inside* these templates:
  - **Few-shot prompting** — including labeled example input/output
    pairs directly in the template so the model pattern-matches the
    desired format/tone from examples rather than from instructions
    alone. Use few-shot when the desired output has a specific
    structure that's easier to show than describe (e.g., a exact JSON
    shape, a particular tone of voice).
  - **Chain-of-thought (CoT) prompting** — instructing the model to
    reason step-by-step before producing a final answer, typically by
    including an explicit "think through this step by step" directive
    or a worked example that shows intermediate reasoning. Use CoT when
    the task involves multi-step logic (e.g., "determine eligibility
    based on these three policy rules") where jumping straight to an
    answer produces more errors than reasoning-then-answering does.

**Don't use** few-shot when the task is a single, simple transformation
with no ambiguity about format — it adds token overhead for no
accuracy gain. **Use** few-shot when output structure is
rigid/exact and hard to describe in prose (e.g., emitting a specific
JSON schema, matching a brand voice).

**Don't use** chain-of-thought for latency-sensitive, simple
lookups (e.g., "what's the status of order #123") — it adds
unnecessary reasoning tokens and latency for a task that doesn't need
multi-step reasoning. **Use** CoT for policy/eligibility-style
decisions with multiple interacting conditions.

### 1.1.4 Where Agent Designer and CX Agent Studio diverge

| Dimension | Agent Designer | CX Agent Studio |
|---|---|---|
| Authoring model | Broader low-code agent config: instructions, prompt templates, tool/data hookups | State machine: pages, transition routes, event handlers |
| Best fit | General enterprise agents (Q&A, task agents grounded on enterprise data) | Structured, multi-turn conversational flows (support, booking, guided processes) |
| Conversation control granularity | Coarser — instruction/prompt-driven behavior | Fine-grained — explicit state and transition control |
| Failure-mode handling | Relies more on instruction robustness | Explicit event handlers for no-match/no-input/timeout |

**Don't use** CX Agent Studio's full state-machine modeling for a
simple single-turn Q&A agent grounded on a document set — that's
unnecessary structural overhead. **Use** Agent Designer instead, and
reserve CX Agent Studio for flows genuinely defined by discrete steps
(e.g., "collect five fields in a specific order, branching a different
way if the user is an existing customer").

**Don't use** Agent Designer's freer instruction-driven approach when
you need guaranteed deterministic step ordering (e.g., a regulated
intake process that must collect consent before any other question) —
an LLM instructed to "ask consent first" can still drift; a CX Agent
Studio page/transition graph enforces it structurally. **Use** CX
Agent Studio when structural guarantees matter more than conversational
flexibility.

---

## 2. Task 1.2 — Connecting enterprise data to Gemini Enterprise

### 1.2.1 Agent Search — grounding on proprietary data

**Agent Search** (formerly Vertex AI Search — the exam guide's own
parenthetical) is the enterprise-data grounding and retrieval service
that Gemini Enterprise agents use to securely query an organization's
proprietary data sources. Conceptually, it plays the role of the
retrieval layer in a RAG (retrieval-augmented generation) system, but
packaged as a managed, low-code-configurable service rather than
something you wire together by hand — that hand-built version is what
Section 3.2 covers (RAG pipelines, vector databases, Agent Retrieval /
Vector Search 1.0) when you're building a **custom** agent in code
instead of a low-code Gemini Enterprise agent.

```
        ┌─────────────────────────┐
        │   User query (chat)      │
        └────────────┬─────────────┘
                      │ 1. natural-language question
                      ▼
        ┌─────────────────────────┐
        │  Gemini Enterprise agent │
        │  (Agent Designer/CX      │
        │   Agent Studio)          │
        └────────────┬─────────────┘
                      │ 2. retrieval call
                      ▼
        ┌─────────────────────────┐
        │      Agent Search        │───► 3. secure, permission-scoped
        │ (grounding / retrieval)  │        query against connected data
        └────────────┬─────────────┘        sources (respects source
                      │                       ACLs — a user only sees
                      │ 4. relevant docs/      what they're authorized
                      │    chunks returned      to see)
                      ▼
        ┌─────────────────────────┐
        │  Gemini LLM synthesizes  │
        │  grounded answer         │
        └────────────┬─────────────┘
                      │ 5. answer + citations
                      ▼
        ┌─────────────────────────┐
        │   User sees grounded     │
        │   response               │
        └─────────────────────────┘
```

Diagram walkthrough: step 3 is the exam-relevant detail most likely to
appear in a scenario question — Agent Search's connection to
enterprise sources is **security-scoped**, meaning it respects the
underlying data source's access controls when retrieving results, so
two different users asking the identical question can legitimately get
different retrieved context (and therefore different grounded answers)
based on what each is authorized to see. This is the "securely connect
and query" language directly from the guide's task 1.2 bullet.

**Don't use** a raw, ungrounded Gemini LLM call for questions that
depend on proprietary/internal data (policies, internal docs, product
catalogs) — the model will either refuse, hallucinate, or answer from
stale/public training data. **Use** Agent Search-grounded retrieval so
answers are sourced from your actual, current enterprise content with
citations.

**Don't use** Agent Search when what you actually need is a
programmatic, fully custom retrieval pipeline with your own choice of
embedding model, chunking strategy, and reranking logic wired into a
custom ADK agent — that's Section 3.2 territory (Vector Search 1.0 /
Agent Retrieval, custom RAG pipeline). **Use** Agent Search when you
want a managed, low-code grounding connector inside Gemini Enterprise
without building the retrieval stack yourself.

### 1.2.2 Ingesting and processing unstructured multimodal data

The second 1.2 consideration is explicit: **ingesting and processing
unstructured multimodal data (videos, audio, and images) into the
agentic workflow** — not just text documents. This matters because a
naive mental model of "enterprise data connection" defaults to
structured tables or text docs; the exam guide is explicit that
multimodal ingestion is in scope.

Key ideas to hold for the exam:

- Multimodal content (video, audio, images) must be **processed** —
  not just stored — before an agent can usefully retrieve and reason
  over it. That typically means extracting a text-searchable
  representation (transcription for audio/video, captioning/description
  for images, or multimodal embeddings — numeric vectors that capture a
  piece of content's meaning so a model can compare and search over it —
  that let the underlying Gemini LLM reason natively over the media) so
  the content becomes
  retrievable and groundable the same way text documents are.
  Gemini's models are natively multimodal, so unlike purely
  text-embedding architectures, images/video/audio content can be fed
  more directly into the reasoning step, not just pre-summarized to
  text — but the *ingestion pipeline* into Agent Search/Gemini
  Enterprise still needs to process/index that content so it's
  discoverable in the first place.
- This is an ingestion-and-processing pipeline question, not just a
  storage question: raw video files sitting in Cloud Storage are not,
  by themselves, "connected" to the agentic workflow in a way the
  agent can retrieve and reason over — they need to be processed
  through Gemini Enterprise's/Agent Search's multimodal ingestion path.

**Don't use** a text-only ingestion pipeline (e.g., only indexing
filenames or manually-written descriptions of video/audio content) when
the actual content of the media matters for retrieval (e.g., "find the
training video where the presenter discusses returns policy") — that
under-indexes the source and produces poor retrieval recall. **Use**
proper multimodal ingestion/processing so the video/audio/image
content itself becomes searchable and groundable, not just its
filename or manual metadata.

**Don't use** unstructured multimodal ingestion as a substitute for
structured data connections when the underlying source actually is
structured (e.g., a product catalog in BigQuery) — treat structured
sources as structured connections; multimodal ingestion is specifically
for video/audio/image content that has no native structured schema.

---

## 3. Common exam scenario patterns for Section 1

1. **"A CX team wants a booking agent that always collects consent
   before any other information, in a fixed order."** → CX Agent
   Studio with explicit pages/transition routes (structural
   determinism), not Agent Designer's freer instruction-based approach.

2. **"An agent needs to answer with a specific exact JSON structure the
   downstream system expects."** → few-shot prompting in the
   in-console prompt template, showing the exact JSON shape as an
   example.

3. **"An agent gives wrong eligibility answers on multi-condition
   policy questions."** → introduce chain-of-thought prompting so the
   model reasons through each condition before answering, rather than
   jumping to a conclusion.

4. **"Users report the agent doesn't know what to do when they say
   something unexpected, and just hangs."** → missing/misconfigured
   event handler for no-match (and/or no-input) — the diagnostic
   signature of an event-handler gap.

5. **"Two employees asking the identical question through the same
   Gemini Enterprise agent get different, but each individually
   correct, answers."** → Agent Search's permission-scoped retrieval —
   each user's grounded context is limited to what they're authorized
   to see in the underlying data source, not a bug.

6. **"A company has thousands of recorded support calls (audio) they
   want the agent to be able to answer questions about."** → multimodal
   ingestion/processing into the agentic workflow (transcription/
   processing pipeline), not just uploading files to storage and
   expecting retrieval to work.

---

## 4. Section 1 practice questions (18)

**Q1.** A CX team is building a returns-processing agent in CX Agent
Studio. They need the agent to always transition to a "Manager Escalation"
page whenever the user's utterance doesn't match any expected intent for
three consecutive turns. What should they configure?
A) A transition route with a broad catch-all intent
B) An event handler for no-match, with escalation logic tied to a turn counter
C) A new page with no transitions
D) A system instruction telling the model to escalate after three failures

*Answer: B.* No-match is a **system event** (the user's utterance
didn't map to any expected intent), which is exactly what event
handlers are for — not transition routes, which fire on matched intent
or condition, not absence of a match. (A) is wrong because a "catch-all
intent" is still an intent-match mechanism, not the right tool for
detecting repeated non-matches. (C) does nothing without a route or
handler pointing to it. (D) is unreliable — relying purely on
instruction-following for a hard turn-count threshold is exactly the
kind of non-deterministic behavior CX Agent Studio's structural
event-handler mechanism exists to avoid.

**Q2.** Which of the following is the correct current name for the
service the exam guide describes as the enterprise-data grounding
service formerly known as Vertex AI Search?
A) Vertex AI Agent Builder
B) Agent Search
C) Gemini Enterprise Search
D) RAG Engine

*Answer: B.* Agent Search is the guide's own current name (with the
parenthetical "formerly Vertex AI Search"). (A) is a currency trap —
that branding doesn't appear in the guide at all. (C) is a
plausible-sounding but fabricated name. (D) RAG Engine is a different,
also in-scope tool (used for custom RAG pipelines in Section 3.2), not
the low-code Gemini Enterprise grounding service.

**Q3.** An architect wants a Gemini Enterprise agent's responses to
always come back in a very specific, exact markdown table format with
specific column headers. What in-console technique best guarantees this?
A) Chain-of-thought prompting
B) Few-shot prompting with an example of the exact table format
C) Increasing the model's temperature
D) Adding more transition routes

*Answer: B.* Few-shot prompting — showing a labeled example of the
exact desired output format — is the right tool when output structure
is rigid and easier to demonstrate than describe. (A) CoT is for
reasoning depth, not output formatting. (C) higher temperature
increases randomness, which works against consistent formatting. (D)
transition routes are a CX Agent Studio state-machine concept, unrelated
to output formatting.

**Q4.** A low-code Gemini Enterprise agent needs to reason through
several interacting eligibility rules before giving a final yes/no
answer, and testers report it's jumping to wrong conclusions. What
in-console prompting technique addresses this most directly?
A) Few-shot prompting only
B) Chain-of-thought prompting
C) Reducing the number of pages
D) Switching to CX Agent Studio

*Answer: B.* Chain-of-thought prompting is specifically for multi-step
reasoning tasks where jumping straight to an answer produces errors.
(A) Few-shot helps with format/pattern matching, not multi-condition
reasoning depth. (C) and (D) are CX Agent Studio structural concepts
unrelated to reasoning quality within a single response.

**Q5.** What is the key functional difference between a transition
route and an event handler in CX Agent Studio?
A) Transition routes are configured in code; event handlers are configured in the console
B) Transition routes react to matched user intent/conditions; event handlers react to system events like no-match or timeout
C) Event handlers only exist at the flow level, never the page level
D) There is no functional difference; they are synonyms

*Answer: B.* This is the core distinction tested repeatedly. (A) is
false — both are console-configured low-code constructs. (C) is false
— event handlers can be page-level (as in the diagram in §1.1.2) or
flow-level. (D) is a distractor for anyone who hasn't internalized the
distinction.

**Q6.** A company wants its Gemini Enterprise agent to answer
questions using its internal HR policy documents, and different
employees should only see policy content applicable to their own
region/department based on existing access controls. Which capability
provides this?
A) Chain-of-thought prompting
B) Agent Search's security-scoped retrieval, respecting source ACLs
C) A single shared system instruction listing all policies
D) CX Agent Studio event handlers

*Answer: B.* Agent Search enforces the underlying data source's access
controls during retrieval, so grounded answers reflect what each user
is authorized to see. (A) and (D) are unrelated mechanisms. (C) doesn't
scale or enforce per-user access — it would leak all policy content to
everyone.

**Q7.** An organization has a large library of training videos and
wants a Gemini Enterprise agent to answer questions about specific
content discussed in those videos. Simply uploading the video files to
Cloud Storage and connecting the bucket is insufficient. Why?
A) Cloud Storage cannot store video files
B) The videos must be ingested/processed (e.g., transcribed/indexed) before their content is retrievable and groundable
C) Gemini models cannot process video at all
D) Agent Search only supports structured data

*Answer: B.* Task 1.2 explicitly calls out ingesting and *processing*
unstructured multimodal data — storage alone doesn't make content
discoverable by retrieval. (A) is false — Cloud Storage stores any
blob type. (C) is false — Gemini models are natively multimodal, but
the ingestion/indexing pipeline still needs to run for retrieval
purposes. (D) is false — Agent Search's task bullet on multimodal
ingestion directly contradicts "structured only."

**Q8.** Which tool pairing correctly matches the low-code builder to
its primary design paradigm?
A) Agent Designer → state machine (pages/transitions); CX Agent Studio → free-form instructions only
B) Agent Designer → broader low-code agent configuration; CX Agent Studio → state-based (pages, transition routes, event handlers)
C) Both tools use identical state-machine paradigms with no differences
D) CX Agent Studio is for coding agents; Agent Designer is for CX flows

*Answer: B.* This matches the guide's own task 1.1 bullet structure —
CX Agent Studio is explicitly the state-based (pages/transitions/event
handlers) tool. (A) reverses the pairing. (C) ignores the real
differences in §1.1.4. (D) confuses this section's low-code tools with
Section 2's coding-agent tools entirely.

**Q9.** A team building a simple FAQ-answering agent grounded on a
static knowledge base (no multi-step conversational flow, no branching
based on collected parameters) is deciding between Agent Designer and
CX Agent Studio. What's the better fit and why?
A) CX Agent Studio, because state machines are always more robust
B) Agent Designer, because the use case doesn't need explicit
   page/transition/event-handler structure
C) Neither — this requires a custom ADK agent
D) CX Agent Studio, because it's required for any Agent Search connection

*Answer: B.* A simple grounded Q&A agent doesn't need CX Agent
Studio's state-machine overhead. (A) overgeneralizes — more structure
isn't always better; it's overhead when the use case doesn't need it.
(C) is unnecessary — this is squarely a low-code use case. (D) is
false — Agent Search can be connected from either builder.

**Q10.** In a CX Agent Studio flow, a page has two transition routes:
Route A (broad: matches almost any utterance containing "help") and
Route B (specific: matches the exact intent "cancel subscription").
Both are triggered by the same user utterance "help me cancel my
subscription." What determines which route fires?
A) Whichever route was created first, alphabetically
B) Route priority/ordering as configured — more specific routes should be ordered ahead of broad catch-alls
C) They both fire simultaneously and the agent merges responses
D) The LLM randomly picks one

*Answer: B.* Transition routes are evaluated in a defined priority
order; poorly ordered routes let a broad catch-all "steal" turns meant
for a more specific route — a real misconfiguration risk called out in
§1.1.2. (A), (C), (D) are all fabricated behaviors.

**Q11.** What does "securely connect and query enterprise proprietary
data sources" (task 1.2) most directly imply about how Agent Search
should be evaluated in a security-conscious scenario question?
A) Agent Search bypasses source-level permissions for faster retrieval
B) Agent Search retrieval should respect and enforce the source data's existing access controls
C) Security is irrelevant to Agent Search's design
D) Only administrators can use Agent Search-grounded agents

*Answer: B.* This is the direct implication of "securely connect and
query" — retrieval-time permission enforcement. (A) is the opposite
and a dangerous mischaracterization. (C) and (D) are unsupported.

**Q12.** Why is few-shot prompting generally a poor choice for a
simple, single-turn factual lookup with no formatting ambiguity (e.g.,
"what are your business hours")?
A) Few-shot prompting is never valid in Gemini Enterprise
B) It adds unnecessary token overhead and complexity for a task that has no structural ambiguity to resolve
C) Few-shot prompting only works with CX Agent Studio
D) Few-shot prompting reduces model accuracy on all tasks

*Answer: B.* The house-style tradeoff: use few-shot when output
structure is genuinely ambiguous or rigid; skip it when the task is
simple and unambiguous, since it only adds overhead. (A), (C), (D) are
false absolutes.

**Q13.** A Gemini Enterprise agent occasionally answers questions
about a competitor's products in ways that violate company policy.
Where should this constraint be enforced first?
A) A transition route
B) A system instruction defining hard behavioral constraints/scope boundaries
C) An event handler
D) Agent Search permission scoping

*Answer: B.* System instructions are the persistent, top-level
behavioral contract — the right place for hard constraints like scope
boundaries. (A) and (C) are CX Agent Studio structural mechanisms
unrelated to persistent behavioral rules. (D) is a data-access
mechanism, not a behavioral constraint mechanism.

**Q14.** Which statement correctly distinguishes RAG Engine /
Vector Search 1.0 / Agent Retrieval (Section 3.2 custom-code tools)
from Agent Search (Section 1.2 low-code tool)?
A) They are exactly the same service under two different names
B) Agent Search is the managed, low-code Gemini Enterprise grounding connector; RAG Engine/Vector Search 1.0/Agent Retrieval are used when building custom RAG pipelines in code (e.g., via ADK)
C) RAG Engine is deprecated in favor of Agent Search
D) Agent Search only works with structured data, unlike RAG Engine

*Answer: B.* This is the correct low-code-vs-custom-code split
this exam draws consistently. (A) collapses a distinction the exam
tests. (C) is fabricated — both are in-scope, distinct tools. (D)
contradicts the multimodal ingestion content in §1.2.2.

**Q15.** A no-input event handler fires when:
A) The user provides input that doesn't match any intent
B) The user provides no input at all within the expected timeout window
C) A webhook call fails
D) A transition route condition evaluates false

*Answer: B.* No-input specifically means silence/timeout, distinct from
no-match (A, which is a different event type — an utterance was given
but didn't match). (C) is a webhook-error event, a different event
type entirely. (D) isn't an event at all — a false condition on a
transition route simply means that route doesn't fire; it doesn't
trigger an event handler by itself.

**Q16.** An enterprise wants to ground a Gemini Enterprise agent on a
mix of internal PDFs, a product image catalog, and recorded webinar
audio. Per task 1.2, what's the correct characterization of this
requirement?
A) Only the PDFs are relevant; image and audio content aren't supported for agentic grounding
B) All three require appropriate ingestion — text processing for PDFs, and multimodal ingestion/processing for the image catalog and webinar audio — before the agent can retrieve/reason over them
C) Only structured data sources can be connected to Gemini Enterprise
D) Audio content must be manually transcribed by a human before any ingestion can occur

*Answer: B.* Task 1.2 explicitly names ingesting/processing
unstructured multimodal data (video, audio, images) as in scope
alongside text/document sources. (A) and (C) directly contradict the
guide's own task bullet. (D) overstates the requirement — the exam
guide describes an ingestion/processing pipeline, not a mandate for
manual human transcription specifically (automated processing is the
implied mechanism, consistent with how Gemini Enterprise's multimodal
ingestion pipeline works).

**Q17.** True or False: On the PAA exam, "Agent Engine" is an
acceptable alternate term for the low-code grounding/runtime services
covered in Section 1.
A) True — Agent Engine and Agent Search are interchangeable in the guide
B) False — Agent Engine refers to a different, renamed concept (now Agent Runtime, a Section 3/4 deployment concept) entirely separate from Agent Search, which is Section 1's grounding service
C) True — the exam accepts either name for any agent-related service
D) False — "Agent Engine" doesn't exist in any form related to this exam

*Answer: B.* This tests whether you're conflating two separate
renames: Agent Engine → **Agent Runtime** (deployment/runtime,
Sections 3.3/4.2) and Vertex AI Search → **Agent Search** (grounding,
Section 1.2). They are two different services with two different old
names — don't cross-wire them. (D) is too strong — "Agent Engine" did
exist as the old name for Agent Runtime, it's just not current
terminology and not the same service as Agent Search.

**Q18.** A CX Agent Studio flow's "Confirm Return & Submit" page (see
the diagram in §1.1.2) should only be reachable after both "item" and
"reason" parameters have been collected on the prior page. How should
this be enforced?
A) A system instruction telling the model "don't proceed without both fields"
B) A transition route out of the Return Flow page gated on a condition that both required parameters are filled
C) An event handler for webhook errors
D) It cannot be enforced in CX Agent Studio; only in ADK

*Answer: B.* Gating a transition route on a condition (all required
parameters filled) is the structural, deterministic way CX Agent
Studio enforces this — exactly the pattern shown in the §1.1.2 diagram.
(A) relies on instruction-following, which is less reliable than a
structural condition gate. (C) is unrelated to parameter completeness.
(D) is false — this is a core, native CX Agent Studio capability, no
custom code required.

---

## 5. Quick-reference recap

| Concept | One-line definition | Don't confuse with |
|---|---|---|
| Gemini Enterprise | Low-code platform umbrella for building/deploying agentic experiences | "Vertex AI Agent Builder" (not a real name in this guide) |
| Agent Designer | General-purpose low-code agent builder (instructions, prompts, data) | CX Agent Studio's state-machine model |
| CX Agent Studio | State-based (pages/transitions/event handlers) conversational builder | Agent Designer's freer instruction-driven model |
| Page | A conversational state | A transition route (an edge, not a state) |
| Transition route | Fires on matched intent/condition | Event handler (fires on system events, not intent) |
| Event handler | Fires on system events (no-match, no-input, webhook error) | Transition route |
| System instructions | Persistent top-level behavioral contract | In-console prompt templates (task/point-specific) |
| Few-shot prompting | Examples show desired output structure | Chain-of-thought (reasoning depth, not format) |
| Chain-of-thought | Step-by-step reasoning before answering | Few-shot (format matching, not reasoning) |
| Agent Search | Managed, low-code, security-scoped enterprise grounding | RAG Engine/Vector Search 1.0/Agent Retrieval (custom-code RAG, Section 3.2) |
| Multimodal ingestion | Processing video/audio/images so content is retrievable | Simply storing files in Cloud Storage (not sufficient alone) |
