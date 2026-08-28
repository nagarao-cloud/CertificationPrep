# Lab 01 — Building a low-code agent with Agent Designer and CX Agent Studio

> Covers exam task **1.1** (configuring agentic workflows/behavior with
> low-code tools) and touches **1.2** (connecting enterprise data) at
> the end. Companion reference: `01-domains/SECTION-1-low-code-tools.md`,
> `02-services/01-gemini-enterprise-low-code.md`.

---

## Honesty callout — read this before you start clicking anything

> **This lab is illustrative, not console-verified.** This environment
> has no live access to Gemini Enterprise, Agent Designer, CX Agent
> Studio, or any Google Cloud console. Everything below — menu names,
> button labels, exact click paths, field names — is a best-effort
> reconstruction built from (a) the exam guide's own stated
> capabilities for these tools, and (b) general product-documentation-
> style knowledge of how low-code conversational-AI builders of this
> shape typically work. Treat every UI instruction as "this is very
> likely close to what you'll see," not "this is exactly what you'll
> see." **Before you sit the actual hands-on-labs exam, open the real
> Google Skills platform and Gemini Enterprise console yourself and
> confirm the actual menu names and flow** — a beta product's console
> is also the part of this whole exam most likely to change before
> general availability.

---

## 0. What you're building, and why this scenario

You'll build a small **returns-processing support agent** for a
fictional retail company, using both of Gemini Enterprise's low-code
builder surfaces:

1. First in **Agent Designer** — a simple grounded Q&A agent that
   answers questions from a returns-policy document.
2. Then in **CX Agent Studio** — a structured, multi-turn flow that
   walks a customer through starting a return, using explicit pages,
   transition routes, and event handlers.

This scenario is deliberately chosen because it forces you to feel the
real difference between the two tools (see
`01-domains/SECTION-1-low-code-tools.md` §1.1.4) rather than just
reading about it. By the end, you'll also connect the agent to a
sample enterprise data source via **Agent Search**, covering task 1.2.

### Before you begin — vocabulary you need

If any of these terms are new, stop and read the one-line definition
before continuing; nothing below assumes you already know them.

- **Agent** — software that receives a request (usually natural-
  language text from a user), decides what to do, optionally calls
  tools or looks up data, and produces a response — as opposed to a
  static program that only ever does one fixed thing.
- **LLM (large language model)** — the underlying AI model (here,
  a Gemini model) that actually understands the user's text and
  generates a response. The agent is the *wrapper* around the LLM that
  gives it instructions, tools, and data to work with.
- **Grounding** — giving the LLM real, current, authoritative source
  content to base its answer on (instead of letting it answer purely
  from what it learned during training, which can be outdated or
  simply wrong for your specific company's data). "Grounded on our
  returns policy" means the agent's answers are backed by an actual
  policy document, with citations, not the model's general guess.
- **Low-code** — you configure behavior through a visual console (forms,
  dropdowns, a flow diagram) instead of writing a full custom program.
  You still write small pieces of text (instructions, example prompts,
  condition expressions) but there's no orchestration loop to code
  yourself.
- **State machine** — a design where the system is always in exactly
  one of a fixed set of named "states," and moves between them only
  through defined transitions. CX Agent Studio's page/transition model
  (below) is a state machine.

---

## 1. Prerequisites and setup (illustrative)

- A Google Cloud project with Gemini Enterprise enabled. *(Illustrative
  — the exact enablement step, e.g. an API/product activation screen,
  is not something this environment can click through and verify.)*
- Access to the Gemini Enterprise console, typically reached through
  the Google Cloud Console's navigation menu under an "Agentic AI" or
  "Gemini Enterprise" grouping, or a dedicated URL Google provides for
  the product.
- A short sample document to ground the agent on — for this lab,
  imagine a one-page **"Returns & Refunds Policy"** with sections like:
  "Items must be returned within 30 days," "Electronics require
  original packaging," "Refunds are issued to the original payment
  method within 5–7 business days."
- Beginner note: you do **not** need to write any code for this lab.
  Everything happens in console forms and a visual flow editor.

---

## 2. Part A — Agent Designer: a grounded Q&A agent

### 2.1 Create the agent

1. Open the Gemini Enterprise console and choose **Agent Designer**
   as the builder surface (recall from
   `01-domains/SECTION-1-low-code-tools.md` §1.1.1: Agent Designer is
   the general-purpose low-code builder — instructions, prompt
   templates, tool/data hookups — as opposed to CX Agent Studio's
   state-machine model).
2. Start a new agent. Give it a name, e.g. `returns-policy-faq-agent`.
   Naming agents descriptively matters once you have more than one —
   it's what you'll see later in Agent Registry (Section 3.2/3.3) and
   in monitoring dashboards (Agent Gateway, Section 5.1), so get in
   the habit now even in a lab this small.
3. Choose the underlying Gemini model. For a simple FAQ agent, a
   general-purpose Gemini model is the reasonable default — you are
   not yet making the LLM-vs-SLM tradeoff decision from
   `01-domains/SECTION-3-custom-agents.md` §1.1.1, because that
   decision applies to custom ADK agents you build in code (Lab 03);
   Agent Designer typically offers a curated model choice rather than
   the full open-ended selection surface ADK exposes.

### 2.2 Write the system instructions

Recall the definition: **system instructions** are the persistent,
top-level behavioral contract for the agent — persona, tone, hard
constraints, scope boundaries (see
`01-domains/SECTION-1-low-code-tools.md` §1.1.3).

In the agent's **System instructions** field, write something like:

```
You are a helpful, concise customer-support assistant for
Example Retail Co. You answer questions about the company's
returns and refunds policy only, using the connected policy
document as your source of truth.

Rules:
- Always cite the specific policy section you're answering from.
- If a question is outside the returns/refunds policy scope
  (e.g., "what's your company's stock price"), politely say
  you can only help with returns and refunds questions, and do
  not attempt to answer.
- Never promise an outcome the policy document doesn't actually
  support (e.g., don't invent an extended return window).
- Keep responses under 4 sentences unless the user asks for more
  detail.
```

**Why this design, not just what it says:** the "cite the specific
policy section" rule is a scope-boundary constraint that reduces
hallucination risk (the agent is told to ground its claims in a
specific citeable source, not free-associate). The "outside scope"
rule prevents the agent from wandering into topics it has no
authoritative data for — a common failure mode in low-code agents
that get an overly broad system instruction like "be a helpful
assistant" with no boundary. This is the same design instinct as
Agent Search's citation-carrying grounded answers described in
`01-domains/SECTION-1-low-code-tools.md` §1.2.1 — instructions and
grounding work together, not as substitutes for each other.

### 2.3 Add an in-console prompt template using few-shot prompting

Recall: **few-shot prompting** means including labeled example
input/output pairs directly in a prompt template so the model
pattern-matches the desired format from examples rather than from
prose description alone (`01-domains/SECTION-1-low-code-tools.md`
§1.1.3). It's the right tool here because the downstream system that
displays the agent's answer expects a specific structure: a short
answer, then a labeled citation line.

In Agent Designer's **prompt templates** section, create a template
for policy-answer responses:

```
Example 1
User: How long do I have to return an item?
Answer: You have 30 days from the purchase date to return most
items.
Source: Returns & Refunds Policy, Section 1 — Return Window

Example 2
User: Can I return opened electronics?
Answer: Electronics must be returned in their original packaging
to be eligible for a refund.
Source: Returns & Refunds Policy, Section 2 — Electronics

Now answer the user's actual question in the same two-line
format (Answer / Source):
{{user_question}}
```

**Reasoning:** two examples are enough here because the desired
structure (Answer line, Source line) is simple and doesn't vary much
question to question — this matches the "don't over-use few-shot"
guidance from the domain file: few-shot earns its keep when structure
is rigid and easier to show than describe, and two clear examples are
usually sufficient to establish a simple two-line pattern without
padding the prompt with redundant examples.

### 2.4 Would chain-of-thought help here? (a worked "no")

The domain file (`01-domains/SECTION-1-low-code-tools.md` §1.1.3)
flags **chain-of-thought (CoT) prompting** — instructing the model to
reason step-by-step before answering — as the right tool for
multi-condition reasoning tasks, and explicitly a poor fit for simple,
latency-sensitive lookups. This FAQ agent is exactly the "simple
lookup" case: "how many days do I have to return an item" has one
factual answer sitting directly in the source document; there's no
multi-step eligibility logic to reason through. **Don't add CoT
prompting here** — it would add token overhead and latency for no
accuracy benefit. You'll use CoT for real in §3 below, where the
scenario actually needs multi-condition reasoning.

### 2.5 Test the agent (illustrative console step)

Most low-code builders of this kind expose a **test/preview panel**
next to the configuration forms, letting you chat with the
in-progress agent before publishing. Try:

- `"How long do I have to return a toaster?"` — should trigger the
  Answer/Source format from your prompt template.
- `"What's your company's quarterly revenue?"` — should trigger the
  "outside scope, I can only help with returns/refunds" behavior from
  your system instructions.

If the second test doesn't correctly decline, that's a signal your
system instruction's scope boundary needs to be more explicit — a
realistic debugging loop you should expect to run more than once.

---

## 3. Part B — CX Agent Studio: a structured return-intake flow

Now build a second, different kind of agent: a guided flow that
collects the information needed to start a return, using CX Agent
Studio's state-machine model (pages, transition routes, event
handlers — see `01-domains/SECTION-1-low-code-tools.md` §1.1.2). This
is deliberately **not** built in Agent Designer, because the
requirement — "always collect these fields, in this order, with
explicit fallback handling" — is exactly the kind of structural
determinism CX Agent Studio exists for, per the domain file's don't-
use/use guidance in §1.1.4.

### 3.1 Design the page graph before touching the console

Sketch the flow on paper (or in a text file) before opening the
builder — this is a real best practice, not busywork: state machines
get hard to reason about once you're clicking through a UI, and a
paper sketch is where you catch a missing transition or an ambiguous
branch cheaply.

```
┌─────────────┐
│ Page: Start   │  greet, ask "what would you like help with?"
└──────┬────────┘
       │ transition route (intent: "start a return")
       ▼
┌─────────────────────┐
│ Page: Collect Order ID │  ask for order ID
└──────┬────────────────┘
       │ transition route (parameter "order_id" filled)
       ▼
┌─────────────────────┐
│ Page: Collect Item &   │  ask which item + why
│ Reason                  │
└──────┬────────────────┘
       │ transition route (both params filled)
       ▼
┌─────────────────────┐
│ Page: Confirm & Submit │  read back details, ask to confirm
└──────┬────────────────┘
       │ transition route (user confirms)
       ▼
┌─────────────────────┐
│ Page: Return Submitted │  give return label / next steps
└─────────────────────┘

Event handlers attached at EVERY collection page:
 - no-match  → reprompt once, then escalate to "Page: Human Handoff"
 - no-input  → reprompt once, then escalate to "Page: Human Handoff"
```

**Why this shape:** each page has exactly one job (collect order ID;
collect item+reason; confirm) — this follows the domain file's pattern
of "don't transition until the page's required slots are satisfied,
otherwise you hand an incomplete request downstream"
(`01-domains/SECTION-1-low-code-tools.md` §1.1.2). Attaching the same
no-match/no-input event handlers to every collection page (rather than
just the Start page) matters because a user can fail to respond
sensibly at *any* step, not just the first one — a common beginner
mistake is only wiring up event handlers on the entry page and leaving
downstream pages to fall through to a generic, unhelpful error.

### 3.2 Build "Page: Start"

1. In CX Agent Studio, create a new flow, e.g.
   `return-intake-flow`.
2. Create the **Start** page. Set its initial response text (what the
   agent says when the flow begins), e.g.: *"Hi! I can help you check
   an order or start a return. What would you like to do?"*
3. Add a **transition route**: condition = intent match on "start a
   return" (however the console's intent-matching mechanism is
   configured — typically training phrases like "I want to return
   something," "start a return," "I need a refund"). Target page:
   **Collect Order ID**.
4. Add a second transition route for a hypothetical "check order
   status" intent if you want to extend this later (not required for
   this lab — included here only to illustrate that a page in this
   graph would realistically fan out to more than one flow in
   production, per the diagram in
   `01-domains/SECTION-1-low-code-tools.md` §1.1.2).
5. Add an **event handler** on this page for `no-match`: response =
   *"Sorry, I didn't quite catch that — could you tell me if you want
   to check an order or start a return?"* Do **not** point this
   directly at Human Handoff yet — recall from the domain file's Q1
   exam pattern that a single no-match should reprompt, and only
   escalate after repeated failures (a turn-counter condition), not
   escalate immediately on the first miss.

### 3.3 Build the collection pages, with parameter-gated transitions

1. Create **Collect Order ID**. Configure it to expect a parameter
   (e.g. `order_id`) and prompt for it: *"What's your order ID? You
   can find it in your confirmation email."*
2. Add a transition route: condition = `order_id` parameter is filled.
   Target: **Collect Item & Reason**. This is the "gate the transition
   on required parameters" pattern from §1.1.2 — the flow will not
   move forward until the field is actually populated, which is the
   structural guarantee CX Agent Studio gives you that a purely
   instruction-driven agent (Agent Designer, or a raw system prompt)
   cannot guarantee as reliably.
3. Create **Collect Item & Reason**, expecting two parameters (`item`,
   `reason`). Add a transition route gated on both parameters being
   filled, targeting **Confirm & Submit**.
4. Add `no-match`/`no-input` event handlers to both collection pages,
   following the same reprompt-then-escalate pattern as Start.

### 3.4 Build the confirmation and escalation pages

1. **Confirm & Submit**: read back the collected values (order ID,
   item, reason) and ask the user to confirm. Add a transition route
   for "confirmed" → **Return Submitted**, and a route for "not
   confirmed"/"start over" → back to **Collect Order ID** (a real
   state machine can have edges that loop backward, not just forward —
   worth noting explicitly since the earlier diagrams in this lab and
   in the domain file are drawn as straight lines for clarity).
2. **Human Handoff**: a terminal page whose response text/action hands
   the conversation to a human agent (the exact mechanism — a live
   chat transfer, a ticket creation, a phone number — is a product
   integration detail this lab can't verify without console access;
   treat "hand off to human" as the conceptual target, and confirm the
   actual mechanism in the live console).

### 3.5 Why event handlers, not transition routes, for the failure paths

This is the single most exam-relevant distinction in this whole lab
(see `01-domains/SECTION-1-low-code-tools.md` §1.1.2's exam trap and
Q1/Q5 in that file's practice set). Say it back to yourself in your
own words before moving on: **transition routes fire on what the user
said** (a matched intent, a filled parameter, a condition that
evaluated true); **event handlers fire on what the system observed**
(no input at all, an utterance that matched nothing, a webhook
error) — not on user intent. If you configured the no-match/no-input
handling in §3.2–3.3 as transition routes instead of event handlers,
go back and fix that now — it's the mistake this lab is specifically
designed to make you practice avoiding.

### 3.6 Test the flow

Walk through the happy path (provide an order ID, item, and reason,
then confirm) and at least one failure path (say something
unexpected at the "Collect Order ID" page and confirm it reprompts,
not silently fails or jumps to a wrong page).

---

## 4. Part C — connecting enterprise data (task 1.2)

Return to the Agent Designer agent from Part A and connect it to
**Agent Search** (recall: Agent Search, formerly Vertex AI Search, is
the managed, security-scoped enterprise-data grounding service — see
`01-domains/SECTION-1-low-code-tools.md` §1.2.1; never call it "Vertex
AI Search" except when explicitly noting that rename).

1. In the agent's data-connection configuration, add a new **Agent
   Search** data source pointing at your sample returns-policy
   document (in a real setup, this would be a document uploaded to a
   connected data store — Cloud Storage or a similar source — that
   Agent Search indexes).
2. Confirm the agent's grounding behavior: re-run the §2.5 test
   questions and check whether the agent's answers now cite the actual
   connected document (in a real console, typically shown as inline
   citations or a "sources" panel) rather than relying purely on the
   system instruction's general knowledge.
3. **Multimodal note (illustrative):** if this were a real deployment
   and the company also had recorded return-process training videos
   they wanted the agent to answer questions about, you would need to
   run those through Agent Search's/Gemini Enterprise's multimodal
   ingestion path (transcription/processing) before they're
   retrievable — simply uploading video files to storage and pointing
   Agent Search at the bucket is **not** sufficient by itself, per
   `01-domains/SECTION-1-low-code-tools.md` §1.2.2. This lab's sample
   scenario only uses a text document, so you won't exercise this step
   directly here, but you should be able to explain it (see the
   self-check below).

---

## 5. What you should be able to explain after this lab

Before moving to Lab 02, check that you can explain each of these
out loud, in your own words, without looking back at the domain file:

- [ ] The difference between Agent Designer and CX Agent Studio, and
      which one you'd pick for a given scenario (task 1.1).
- [ ] What a page, a transition route, and an event handler each are,
      and specifically why event handlers are *not* the same thing as
      a transition route with a broad catch-all condition (task 1.1).
- [ ] When to reach for few-shot prompting vs. chain-of-thought
      prompting in an in-console prompt template, and why this lab's
      FAQ agent needed the former but not the latter (task 1.1).
- [ ] What system instructions are for, as distinct from a prompt
      template (task 1.1).
- [ ] What Agent Search does, why it's described as "securely"
      connecting to enterprise data (permission-scoped retrieval), and
      why multimodal content (video/audio/images) needs an ingestion/
      processing step before it's usable, not just storage (task 1.2).
- [ ] Why this lab is illustrative rather than console-verified, and
      what you'd do differently before a real exam attempt (open the
      live console and confirm exact menu/field names).
