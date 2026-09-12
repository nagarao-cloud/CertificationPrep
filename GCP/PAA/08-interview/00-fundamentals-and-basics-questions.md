# Fundamentals & Basics Questions — Professional Agentic Architect

> **What this file is.** 20 ground-zero interview questions covering
> the foundational concepts a candidate must be able to explain
> clearly *before* tackling system design — the vocabulary and
> mechanics that `agentic-architect-scenario-questions.md` and
> `behavioral-and-tradeoff-questions.md` both assume you already have.
> Those two files are architect-level: they hand you a scenario and
> expect you to reason with terms like RAG, A2A, PAB, and HITL already
> loaded. This file is what comes before that — if a term in this
> file's questions is new to you, that's exactly who this file is for.
>
> **How to use this file.** Unlike the other two `08-interview/` files,
> several of these questions have a genuinely correct, checkable
> answer (what MCP stands for, what a session is) alongside the
> judgment part (why it matters, when you'd reach for it). Read the
> question, try to define the term out loud in one sentence before
> reading further, then read the full model answer for the reasoning
> an interviewer actually wants to hear layered on top of the
> definition. Every general AI/cloud term (agent, LLM, RAG, embedding,
> IAM, OAuth 2.0, service account, session) is defined in plain terms
> the first time it appears below — you don't need to have read any
> other file in this folder first.
>
> **Grounding.** Each question notes which of the exam's 5 sections it
> maps to most naturally (`00-START-HERE/RUNBOOK.md` §3) — these are
> genuinely foundational, so the mapping is "where this concept first
> becomes exam-relevant," not "this concept only matters for that one
> section." A few questions reference the **Meridian Tools "Internal
> Knowledge & Support Agent Platform"** capstone
> (`05-labs/lab-07-capstone-realtime-agentic-project.md`) for a
> concrete example, since it's the folder's own worked reference case.
>
> **Currency note.** Every answer below uses **Agent Runtime** (never
> Agent Engine), **Agent Search** (never Vertex AI Search), **Gemini
> Enterprise** (never "Vertex AI Agent Builder"), **Antigravity** /
> **Claude Code on Google Cloud** (never "Gemini Code Assist"), and
> treats **ADK as open-source** and **PAB as an Agent-Identity-specific
> mechanism**, not generic IAM. See `../CLAUDE.md` §7 for the full
> corrections table.

---

## Section 1 — Building agents using low-code tools (4 questions)

### Q1. "What is an 'agent,' and how is that actually different from just calling an LLM directly?"

**What's really being asked.** *In plain terms first:* an **LLM (large
language model)** is the underlying AI model that reads text and
generates text back — think of it as a very capable but fundamentally
passive text-in, text-out engine. An **agent** is everything built
*around* an LLM so that it can actually do something with a request,
not just describe an answer. This question checks whether a candidate
understands that "agent" is an architectural category, not a synonym
for "chatbot" or "a model that talks."

**Model answer.** If I call an LLM directly — send it a prompt, get
text back — I get one round trip: the model reasons over whatever
context I gave it and produces a response, and that's the end of the
interaction. An agent adds three things a plain LLM call doesn't have
on its own: **tools** (the ability to call external functions —
looking up an order, querying a database — instead of only generating
text about what it thinks the answer might be), **state** (memory of
what's happened earlier in this interaction, or across interactions,
so it isn't starting from zero every single turn), and **a control
loop** that lets the model decide, turn by turn, what to do next —
call a tool, ask a clarifying question, hand off to another agent, or
finally answer — rather than a human deciding that in advance for
every possible input.

Concretely: a plain LLM call answering "what's the status of order
#4521?" can only guess or admit it doesn't know, because it has no way
to actually check. An agent wrapping that same LLM with an
order-lookup tool can call that tool, get a real answer back, and
incorporate it into the response. That's the actual dividing line —
not "how smart is the model," but "can the system act, not just talk."
This maps to task 1.1's framing of low-code tools as configuring
*agent behavior* (state, routing, instructions) around an underlying
model — the model is a component, the agent is the system.

**Why not "an agent is just a chatbot with a nicer name"?** Because
that conflates the *interface* (a chat window) with the *architecture*
(tool access, state, a decision loop). A chatbot with no tools and no
memory beyond the current message is a plain LLM call with a chat UI
on top — calling it an agent doesn't change what it can actually do,
and an interviewer asking this question is checking that a candidate
doesn't reach for that shallow equivalence.

---

### Q2. "What is RAG, and why does 'grounding' matter even for a simple low-code chatbot?"

**What's really being asked.** *In plain terms first:* **RAG
(retrieval-augmented generation)** means the system looks something up
in a real knowledge source *before* generating a response, and gives
that retrieved content to the model as context — instead of relying
only on what the model already "knows" from its training. **Grounding**
is the general term for tying a response to real, verifiable content
this way. This question checks whether a candidate understands RAG as
a correctness mechanism, not an optional quality-of-life feature.

**Model answer.** An LLM's training data has a cutoff date and no idea
what's specific to your organization — it has never seen your return
policy, your internal IT runbook, or this week's pricing update. Asked
a question about any of that, an ungrounded model doesn't necessarily
say "I don't know" — it can produce a fluent, confident-sounding answer
that's simply wrong, because generating plausible text is exactly what
it's built to do, whether or not that text is factually correct for
your specific context. That failure mode is called **hallucination**.

RAG fixes the source of the problem, not just the symptom: before the
model generates anything, the system retrieves the actual relevant
passage — the real return-policy text, the real runbook step — and
gives it to the model as context, so the model's job becomes
"summarize and present this real content accurately" rather than
"recall this from memory and hope it's right." For even a simple
low-code chatbot, this is why **Agent Search** (task 1.2) exists as a
first-class low-code building block, not an advanced add-on: a
support bot answering "what's your return window" needs to answer from
the actual current policy document, not from the model's general sense
of what return policies usually say.

Grounding matters even more than it sounds like it should, because an
ungrounded wrong answer and a grounded correct answer can be
*indistinguishable in tone* — both sound equally confident. That's
precisely why the exam and this folder treat "is this agent grounded"
as a design question to ask explicitly, not an assumption to make by
default.

**Why not "the model is smart enough, it probably already knows our
policies"?** Because "probably knows" is not a design — the model has
no way to know your organization's specific, current, private content
unless it's given to it, and a wrong-but-confident answer about a
return policy is a real, costly failure mode, not a hypothetical edge
case. Betting on the model's general knowledge instead of building a
retrieval step is exactly the gap RAG closes.

---

### Q3. "What does 'ingesting multimodal data' actually mean, and why isn't uploading a video to a knowledge base the same as the agent being able to use it?"

**What's really being asked.** *In plain terms first:* **multimodal**
means content that isn't plain text — video, audio, images — as
opposed to a text document or webpage. **Ingestion** is the process of
bringing content into a system so it can be searched and retrieved.
This checks whether a candidate treats multimodal ingestion as a real
pipeline stage with its own failure modes, rather than assuming "we
added the file" equals "the agent can answer questions about it."

**Model answer.** Text ingestion is comparatively straightforward: the
system chunks the document and creates embeddings (numeric
representations of meaning, covered in more depth in Q9's RAG-adjacent
follow-up) directly from the words on the page. Video, audio, and
image content has no equivalent direct textual representation to
embed — the system has to first derive one, whether that's a
transcript of the audio track, a generated visual summary of the
frames, or extracted on-screen text, and *that derived representation*
is what actually gets embedded and searched, not the raw video file
itself.

This means the quality of multimodal retrieval depends entirely on how
faithfully that derived representation captures what someone would
actually ask about the content. A training video where the audio
track never says the phrase a user later searches for — even though
the video visually demonstrates exactly that — can be technically
"ingested" (task 1.2 names this explicitly as an in-scope
consideration) while still never surfacing as a match for the
questions it should answer. That's not a platform bug; it's a
retrieval-quality gap specific to multimodal content, and it needs the
same verify-don't-assume discipline as text: check actual query logs,
confirm the content is surfacing as a grounding match for the
questions it's meant to answer, and consider whether a short written
summary alongside the video closes the gap more reliably than trusting
the derived representation alone.

**Why not "if it's uploaded, it's covered"?** Because ingestion and
*usable* retrieval are two different claims — a file can be present in
the corpus and still functionally invisible to the queries that should
find it, if its derived text representation doesn't overlap with how
people actually phrase their questions. Treating "uploaded" as
"done" skips the verification step that catches this before a real
user hits it.

---

### Q4. "What's the real difference between low-code and custom-code agent building, and how should a candidate reason about which to recommend?"

**What's really being asked.** *In plain terms first:* **low-code**
here means building an agent through a visual/configuration interface
(Gemini Enterprise's Agent Designer and CX Agent Studio) — pages,
routing rules, prompt templates — without writing a general-purpose
program. **Custom-code** means building the agent as actual code
(ADK, covered in Section 3), with full control over logic,
orchestration, and integration. This checks whether a candidate has a
real decision framework, not just a vague sense that "custom is more
powerful."

**Model answer.** The difference isn't "capability" in the abstract —
it's *where control lives and what it costs to change*. Low-code
trades away some depth of customization for speed, and — just as
importantly — for **who can make changes**: a business analyst or
conversation designer can edit a low-code agent's routing or prompt
template directly, without an engineering deploy cycle. Custom code
gives full control over orchestration, retrieval tuning, and model
choice, but every change goes through code, review, and a deploy
pipeline.

The reasoning framework I'd apply: does the conversation genuinely fit
a **state-machine shape** — a bounded set of known flows ("check order
status," "answer a return-policy question") — or does it need
open-ended, multi-step reasoning and coordination between multiple
independent specialists? Is the team building and maintaining it
mostly engineers, or mostly non-engineers who need to own iteration
themselves? Is there a hard multi-agent orchestration requirement, or
a bespoke retrieval-tuning need, that low-code structurally can't
express — not "would be nicer with," but genuinely *cannot* express?
If the answers point toward a bounded, well-understood flow with a
non-engineering team and a tight timeline, low-code is the right
architectural choice, not a lesser one. If there's a real structural
requirement low-code can't meet, that's the concrete, evidence-based
trigger to build custom — not a general instinct that custom is
always the more serious engineering choice.

**Why not "always start with low-code, or always build custom for
anything that matters"?** Both are reflexive defaults, not reasoning.
"Always low-code" ignores real cases where the requirement is
structurally impossible in a state-machine shape from day one. "Always
custom" throws away low-code's genuine advantage — business-side
ownership of iteration — even when the problem never needed custom
orchestration in the first place, and spends engineering time
rebuilding what the low-code platform already provides for free.

---

## Section 2 — Using coding agents for application development (3 questions)

### Q5. "What is a 'coding agent,' and how is it different from a traditional autocomplete-style code assistant?"

**What's really being asked.** *In plain terms first:* a traditional
code-completion tool suggests the next few lines of code as you type,
based on the surrounding context — it's reactive and narrow in scope.
A **coding agent** (Antigravity, Claude Code on Google Cloud) can take
a higher-level task ("refactor this module," "patch this
vulnerability"), plan multiple steps, read and write across multiple
files, run commands, and iterate on the result — it's closer to a
junior engineer working a ticket than a smarter autocomplete.

**Model answer.** The dividing line is the same "tools plus a control
loop" distinction from Q1, applied to development work specifically. A
completion tool has no persistent goal beyond the current
cursor position and no ability to execute anything — it suggests text,
a human accepts or rejects it, and that's the entire interaction. A
coding agent given "refactor this module to remove the deprecated
API" can read the relevant files, make a plan, edit multiple files
across the codebase, run the test suite, read the failures, and
iterate — a genuinely multi-step, self-directed loop, not a single
suggestion.

This is exactly why task 2.1 frames coding agents around configuring
them "with MCP servers, custom skills, and access to tools" — that
framing only makes sense for something with its own agency to decide
*when* to call a tool (run tests, query a linter, hit an internal API),
not for a tool that only ever suggests the next few tokens. It's also
why coding agents raise questions completion tools never do: what
sandbox does it run in (Q6), what's it allowed to touch, and does a
human need to review its output before it merges — none of these
questions are meaningful for a suggestion you accept keystroke by
keystroke.

**Why not "it's just a smarter autocomplete"?** Because that
undersells exactly the capability that makes coding agents useful and
also the capability that makes them a governance question: the ability
to take autonomous, multi-step action across a codebase — including
running commands and touching files a human didn't individually
approve — is a different risk and value profile than suggesting text a
human reviews one line at a time.

---

### Q6. "What is a 'sandbox,' and why does a coding agent need to run inside one instead of directly on a developer's machine or production infrastructure?"

**What's really being asked.** *In plain terms first:* a **sandbox**
is an isolated environment — here, typically a container — where code
runs with no direct access to anything outside it unless explicitly
granted. This checks whether a candidate understands sandboxing as a
**blast-radius control**, distinct from any other kind of security
control (a distinction the scenario file's Q4 tests at the applied
level — this question is its ground-zero predecessor).

**Model answer.** A coding agent executing a multi-step task can run
commands, install packages, and modify files as part of doing its job
— that's the point of it being agentic rather than a suggestion tool.
Running that directly on a developer's laptop or, worse, against
production infrastructure means a mistaken or manipulated action has
essentially unbounded reach: it could touch files, processes, or
systems far outside what the actual task needed. A sandbox — for
these tools, typically an ephemeral container on **GKE** for automated
pipeline runs, or a persistent, IDE-like environment on **Cloud
Workstations** for a human co-working with the agent interactively —
bounds that reach: whatever the agent does inside the sandbox stays
inside it, and the sandbox is torn down (for the ephemeral case) once
the run ends, so even a bad outcome inside it doesn't persist or
spread.

The choice between the two sandbox types tracks who's actually driving:
GKE-as-sandbox fits an automated, non-interactive run (a CI/CD
pipeline triggering on a pull request); Cloud Workstations fits a
human actively supervising the agent's work in something that feels
like a normal development environment. I'd pick the automated one for
"run this on every PR across 40 repos" and the interactive one for "a
developer is pairing with the agent on a hard bug right now."

**Why not "the agent is well-behaved, it doesn't need isolation"?**
Because sandboxing isn't a bet on the agent's behavior — it's a bound
on the *consequences* if something goes wrong, whether that's a
genuine mistake, an edge case the agent handles badly, or a
manipulated input causing an unintended action. A well-designed system
assumes something will eventually go wrong at some point and limits
the damage, rather than assuming it won't.

---

### Q7. "What are skills, plugins, extension hooks, and subagents for a coding agent — and why not just write a longer, more detailed prompt instead? Also: what's the difference between 'agent mode' and 'human mode'?"

**What's really being asked.** *In plain terms first:* these are the
customization primitives task 2.2 names for Antigravity — ways of
extending or constraining a coding agent's behavior beyond its base
capability. This checks whether a candidate understands *why* these
exist as distinct mechanisms rather than assuming "just prompt it
better" scales to enterprise use.

**Model answer.** Each of these solves a different problem a single
long prompt can't solve well. A **skill** packages reusable,
repo-specific or domain-specific knowledge (build-system quirks, a
house coding style, how a particular internal API works) so it's
available consistently across every session and every engineer,
instead of every developer re-typing the same context into every
prompt and inevitably describing it slightly differently each time. A
**plugin** extends what the agent can actually do — adding a new
capability, not just new context. An **extension hook** runs
automatically at a defined point in the agent's workflow (before a
commit, after a test run) — this is enforcement, not guidance: a
before-commit hook that blocks a direct push to `main` isn't a
suggestion in a prompt the agent could choose to ignore, it's a gate
that runs regardless. A **rule** constrains scope declaratively (which
directories a change may touch). A **subagent** is a separate, bounded
agent dispatched to handle one well-defined slice of a larger task —
useful specifically when a task is large enough that having one agent
try to hold the entire context in its head at once becomes unreliable.

A single long prompt can *describe* all of this, but a prompt is
advisory context the model weighs alongside everything else it's
reasoning about — it doesn't reliably act like a hard gate, doesn't
scale across many engineers writing their own prompt each time, and
doesn't structurally bound scope the way a rule or a hook does.

**Agent mode vs. human mode** answers a different question: agent mode
lets the coding agent act autonomously on a task; human mode requires
a person driving or approving each step. The choice isn't a fixed
property of the tool — it's a decision about how much autonomy a
given change category has earned. A well-tested, narrow, low-risk
change (a routine dependency bump) is a reasonable agent-mode
candidate; something touching authentication code or exceeding a
defined risk bar should route to human mode, at least until it's
proven itself.

**Why not "one long, detailed system prompt covering everything"?**
Because a prompt is a request the model interprets, not a control the
system enforces — it doesn't reliably prevent a bad action the way a
hook does, doesn't scale as a maintenance model once dozens of
engineers each need slightly different context, and provides no way to
bound *where* an agent is allowed to act the way a rule does. These
mechanisms exist because "describe it better in the prompt" doesn't
substitute for structural enforcement.

---

## Section 3 — Developing custom agents (6 questions)

### Q8. "What is tool-calling / function-calling, and why can't the LLM just 'know' to look something up itself?"

**What's really being asked.** *In plain terms first:* **tool-calling**
(also called function-calling) is the mechanism that lets an LLM,
instead of only generating text, output a structured request to call a
predefined function — with specific arguments — and receive the
function's result back as new context for its next response. This is
the actual mechanism underneath the "tools" half of Q1's agent
definition, and this question checks whether a candidate can explain
it as a concrete request/response cycle, not just gesture at "the
agent can do things."

**Model answer.** An LLM only ever produces text — it has no built-in
ability to query a database, call an API, or execute code on its own.
Tool-calling works by giving the model a description of each available
function (its name, what it does, what arguments it takes) alongside
the conversation. When the model determines that answering the current
request requires one of those functions, instead of generating a
normal reply it generates a structured call — for example, "call
`get_order_status` with `order_id: 4521`." The surrounding agent
system executes that actual function call (this is real code running,
not the model itself doing anything outside text generation), gets a
real result back, and feeds that result back into the model's context
so its *next* generation can incorporate the real answer.

The reason the LLM can't just "know" to look something up itself is
that the model genuinely has no other channel to the outside world —
generating text describing what it *thinks* an order status probably
is would be pure hallucination, because the model has no actual
connection to the order-management system unless a tool call is the
bridge. This is also why tool definitions matter as a design surface:
a poorly-described function (vague name, unclear argument schema)
increases the chance the model calls it incorrectly or doesn't
recognize when it should be called at all — this is real design work,
not something that happens automatically once you technically "give
the model some tools."

```
User: "what's the status of order #4521?"
        |
        v
   [ LLM reasons: "I need order data, I don't have it — call a tool" ]
        |
        v
   Tool call: get_order_status(order_id=4521)
        |
        v
   [ Real code executes the call against the order system ]
        |
        v
   Tool result: { status: "shipped", eta: "2 days" }
        |
        v
   [ LLM incorporates the real result into its next response ]
        |
        v
Response: "Order #4521 has shipped, arriving in about 2 days."
```

The diagram above is the full loop: the model never touched the order
system directly — it decided *when* to call the tool, and the
surrounding system did the actual work and handed real data back.

**Why not "the model already has all the world's knowledge, it can
just answer"?** Because the model's training data is general and
time-bound — it has no access to your specific, live, private, or
frequently-changing data (an order's current status changes by the
minute) — and any answer it generated without a tool call would be a
guess dressed up as an answer, not a real lookup.

---

### Q9. "LLM vs. SLM — what's actually different, and how would you decide which to use for a given agent?"

**What's really being asked.** *In plain terms first:* an **LLM
(large language model)** is a large, general-purpose model with
strong reasoning and language capability across a wide range of
tasks. An **SLM (small language model)** is a smaller model — faster,
cheaper, and less capable in general, but often entirely sufficient
for a narrow, well-defined task. This checks whether a candidate
treats model size as a design choice per component, not a single
platform-wide decision.

**Model answer.** The difference isn't just "bigger number of
parameters, better model" — it's a genuine tradeoff across capability,
latency, and cost. An LLM handles open-ended reasoning, nuanced
language understanding, and nuanced generation well, but costs more
per call and typically responds more slowly than a smaller model. An
SLM is meaningfully cheaper and faster, and for a narrow task — intent
classification, simple extraction, a yes/no routing decision — it can
match an LLM's accuracy on that specific task while costing a fraction
as much, because the task doesn't actually require the LLM's broader
reasoning capacity.

The decision I'd apply is per-component, not per-system: what does
*this specific piece* of the agent actually need to do well? A triage
step deciding "is this a simple FAQ or does it need deeper reasoning"
is a narrow classification task an SLM handles well. A component doing
open-ended, grounded question-answering over real documents, or
handling genuinely ambiguous, high-stakes reasoning, justifies an LLM's
broader capability. Task 3.1 names this explicitly as a considered
choice ("LLM vs. SLM... considering cost, security, and agent
architecture") — not a default to pick once and apply everywhere.

**Why not "use the strongest LLM everywhere, for consistency and
simplicity"?** Because it's paying for reasoning capability that most
narrow sub-tasks in a system don't use, at real, ongoing per-call
cost — and at production scale, that's one of the most common ways
agentic-system token spend blows past budget for no quality benefit on
the tasks that never needed the stronger model in the first place.

---

### Q10. "What's the difference between a session and long-term memory, in plain terms?"

**What's really being asked.** *In plain terms first:* a **session**
holds state for the duration of one ongoing interaction — what's
already been said, what's currently in progress. **Long-term memory**
(in this exam, Agent Platform's **Memory Bank**) holds facts worth
surviving past that interaction's end, so a *future*, separate
conversation can start already "knowing" them. This checks whether a
candidate keeps these two lifetimes conceptually distinct rather than
treating "memory" as one undifferentiated bucket.

**Model answer.** These answer genuinely different questions, and
conflating them causes real bugs. A session is what makes a single
conversation coherent turn to turn — if a user says "actually, make
that a return instead of an exchange" three messages into a
conversation, the agent needs the session to know what "that" refers
to. Session state typically ends when the conversation ends; nothing
about it is expected to persist into a completely separate, later
interaction. Long-term memory is the opposite lifetime: a fact a user
stated once — a stated preference, something the agent learned about
this specific user — that should be available the *next* time that
user starts an entirely new conversation, potentially weeks later,
without them having to repeat it.

Because these are genuinely separate mechanisms, they're also useful
for diagnosis: a bug where "it forgot what I just said two messages
ago" points at the session layer; a bug where "it doesn't remember me
at all from last week" points at Memory Bank. Collapsing them into one
mental model of "the agent's memory" makes that diagnosis harder, and
it also invites a bad design default — treating everything said in a
session as automatically worth persisting forever, when most
in-conversation detail is only relevant to that one conversation and
shouldn't leak into long-term memory at all (a data-minimization
concern that becomes more important once Section 5's governance lens
applies).

**Why not "just keep the whole conversation history and reload it
every time"?** Because that doesn't actually solve "remember this one
specific preference" — it just hopes the relevant detail is somewhere
in an ever-growing transcript replayed into every new, unrelated
conversation, which wastes context and cost and still requires the
model to correctly find the needle in that haystack every single time,
instead of just being told the fact directly.

---

### Q11. "What is MCP (Model Context Protocol), and why does it exist as a standardized protocol instead of every team writing its own custom tool-integration code?"

**What's really being asked.** *In plain terms first:* a **protocol**
is an agreed-upon, standardized way for two systems to communicate, so
that anything implementing one side can talk to anything implementing
the other side without custom, one-off integration work for each pair.
**MCP** is a protocol specifically for connecting an agent to *tools* —
external systems, APIs, and data sources. This checks whether a
candidate understands the actual argument for a shared protocol,
rather than just being able to name what MCP stands for.

**Model answer.** Before a shared protocol like MCP, connecting an
agent to a third-party system (a ticketing tool, an internal database,
a SaaS product) meant writing bespoke integration code for that
specific pairing — how to authenticate, what the API's request/response
shape looks like, how to translate that into something the agent's
tool-calling mechanism (Q8) can use. Every new agent that needed the
same ticketing system had to either repeat that work or share
brittle, ad-hoc glue code. MCP standardizes the *shape* of that
connection: an **MCP server** exposes a tool (or a set of tools) in a
consistent, agent-consumable form, and any agent that speaks MCP can
use it without needing custom code written specifically for that
agent-tool pairing.

```
   Agent                MCP Server                 Third-party tool
     |                       |                             |
     |-- MCP request ------->|                             |
     |   (standard shape)    |-- native API call --------->|
     |                       |<-- native API response -----|
     |<-- MCP response ------|                             |
     |   (standard shape)    |                             |
```

The value compounds: task 3.2 explicitly frames this as
**prebuilt-first** — before building a custom integration, check
whether a Google Cloud MCP Server or a vendor-provided one already
exists for the system you need to reach. If it does, using it means
someone else maintains the integration as the underlying API changes,
instead of every team that needs that ticketing system separately
maintaining its own brittle glue code and separately absorbing every
future API change.

**Why not "just write custom integration code every time, it gives us
exact control"?** Because that's real, ongoing engineering effort
spent re-solving a problem — connecting to a specific external
system — that a maintained MCP server has often already solved, and
every future protocol update, auth-flow change, or edge case in the
third-party API becomes *this team's* maintenance burden alone instead
of something the platform absorbs. Custom integration is still the
right call when a genuine gap exists (a non-standard auth flow, tight
coupling to something no generic server could know about) — but that
should be a specific, named reason, not a default.

---

### Q12. "What is A2A (Agent2Agent), and how is it fundamentally different from MCP?"

**What's really being asked.** *In plain terms first:* **A2A** is a
protocol for one agent to communicate with — and hand off work to —
*another agent*, as opposed to MCP's agent-to-tool connection. This is
one of the most-tested distinctions across this whole folder because
the two protocols look superficially similar ("reach out to something
else") but serve structurally different purposes.

**Model answer.** The distinguishing question is simple to state and
easy to get wrong under scenario pressure: **does the thing on the
other end reason for itself, or does it just execute a fixed
capability?** If it just executes a fixed capability — a ticketing
system, a lookup API — that's a tool, and the connection is MCP (Q11).
If the other end has its own judgment, can interpret an ambiguous
request, ask a clarifying question back, or itself delegate further,
that's another agent, and the connection is A2A.

```
MCP  (agent -> tool, fixed capability, no reasoning on the other end)

   Agent  --tool call-->  [ Ticketing SaaS ]  --result-->  Agent


A2A  (agent -> agent, both sides reason and can act with their own judgment)

   Agent A  --handoff (with identity)-->  Agent B
                                             |
                                    [ Agent B reasons independently,
                                      may call its own tools/agents ]
                                             |
   Agent A  <--response----------------------
```

The practical consequence of the distinction matters more than the
label: A2A carries **identity propagation** — a receiving agent has a
verifiable answer to "whose authority is this request being made
under," which matters when the receiving agent needs to make its own
judgment calls or take its own actions. Collapsing an agent-to-agent
handoff into "just another tool call" (treating it as MCP) loses that
identity semantic entirely, along with the receiving agent's ability
to reason about or push back on the request the way a tool never
would. Task 3.3 names orchestrating agents via "agentic protocols
(e.g., MCP and A2A)" side by side precisely because a real
multi-agent system typically uses *both* — MCP for the fixed-capability
tools it needs, A2A for the actual agent-to-agent coordination.

**Why not "use MCP for both, it's simpler to standardize on one
protocol"?** Because that simplicity is illusory the moment the
"other end" needs to reason, ask something back, or delegate further —
forcing an agent-to-agent relationship through a tool-shaped protocol
discards the identity and reasoning semantics A2A exists specifically
to carry, and "simpler to reason about" isn't worth losing that,
especially anywhere the receiving agent's authority or judgment
actually matters.

---

### Q13. "What does 'agentic' actually add over a traditional, deterministic, hand-coded pipeline — and when would a deterministic pipeline still be the better choice?"

**What's really being asked.** *In plain terms first:* a
**deterministic pipeline** is a fixed sequence of steps — the same
input always produces the same steps in the same order, decided in
advance by whoever wrote the code (`if this, then that`). An
**agentic** system instead lets a model's reasoning decide, at
run time, what to do next. This checks whether a candidate can
articulate the actual tradeoff instead of assuming "agentic" is
strictly an upgrade.

**Model answer.** A deterministic pipeline is fully predictable and
fully testable in the traditional sense — every possible input path
was decided by a human in advance, so you can enumerate and verify
every branch. That predictability is a real strength, not a
limitation to be embarrassed about: for a well-understood, bounded
process — validate a form field, route a request based on a fixed set
of known categories — a deterministic pipeline is simpler, cheaper,
faster, and easier to audit than an agentic system doing the same job.

What "agentic" actually adds is the ability to handle inputs and
situations that *weren't* fully anticipated in advance — genuinely
open-ended requests, ambiguous phrasing, a need to decide, case by
case, which of several tools or specialist paths applies. That
flexibility is valuable exactly where a fixed set of hand-coded
branches would be impossible or impractical to write — natural
language questions with unbounded phrasing, for instance — but it's
not free: an agentic system's behavior is probabilistic, not
enumerable the way a deterministic pipeline's is, which is exactly why
Section 4's evaluation discipline and Section 5's guardrails exist as
load-bearing parts of this exam rather than nice-to-haves.

I'd choose a deterministic pipeline when the process genuinely is a
fixed, well-understood sequence — an intake form's field validation
doesn't need an LLM's reasoning to check that a required field isn't
empty. I'd choose agentic specifically where the input space is
genuinely open-ended or where routing decisions depend on
understanding meaning, not just matching a fixed pattern.

**Why not "agentic is always the more advanced, more capable choice,
so default to it"?** Because "more capable at handling the
unanticipated" isn't the same as "better for every task," and applying
an agentic system to a genuinely fixed, fully-enumerable process adds
real cost — more to evaluate, more to secure, less predictable
behavior — without buying anything the deterministic pipeline wasn't
already handling correctly and more cheaply.

---

## Section 4 — Evaluating and deploying agentic workflows (3 questions)

### Q14. "What is agent evaluation, and what is a 'golden dataset'?"

**What's really being asked.** *In plain terms first:* **evaluation**
is the practice of systematically testing an agent's behavior against
known-correct expectations, rather than judging quality informally. A
**golden dataset** is a curated set of test cases — realistic
questions or tasks paired with known-correct expected answers or
behaviors — used as the actual basis for that testing. This checks
whether a candidate treats evaluation as a structured artifact and
process, not a vague "it seemed to work when I tried it."

**Model answer.** Because an agentic system's output isn't
deterministic (Q13) — the same question can be phrased differently by
different users, and the model's response isn't guaranteed identical
run to run — "did it work" can't be verified by spot-checking a few
examples in a conversation and calling it done. A golden dataset makes
this checkable: a representative set of realistic prompts (including
deliberately awkward or edge-case phrasing, per task 4.1's explicit
"prompts, and edge cases" framing) paired with what a correct response
or correct tool call actually looks like for each one. Running the
agent against this set produces a real, repeatable measure — did it
get *this specific, previously-agreed-correct* set of cases right —
instead of an impression.

This matters for two different moments in an agent's life: during
development, a golden dataset run catches regressions before a change
ships (did this edit break something that used to work); in
production, re-running the same or an expanded golden dataset
periodically catches slow degradation over time (drift, covered in
Q16) that a one-time pre-launch check can't. Critically, task 4.1
frames evaluation as covering **tool execution**, not just final
answer text — for an agent that calls tools, "did it call the right
tool with the right arguments" is its own testable criterion,
independent of whether the final answer text happened to sound right.

**Why not "just have a few people try it out and see if it feels
right"?** Because that's neither repeatable nor comprehensive — it
depends on whoever happened to test it, what they happened to ask, and
provides no way to detect a regression introduced by a later change
except by chance. A golden dataset turns "does it work" into a
specific, re-runnable, comparable measurement.

---

### Q15. "Why can't you just 'run the code' to deploy an agent — what does a deployment runtime like Cloud Run, GKE, or Agent Runtime actually give you?"

**What's really being asked.** *In plain terms first:* a **deployment
runtime** is the managed infrastructure layer that actually runs your
agent's code reliably, at scale, reachable by real users — as opposed
to a script running on one developer's laptop. This checks whether a
candidate understands what a runtime provides beyond "somewhere for
the code to execute."

**Model answer.** Code running on a single machine works fine for one
developer testing it, but a production agent needs to handle
concurrent requests from many users at once, stay available if a
process crashes, scale up under load and back down when quiet, and
expose itself securely and reliably to whatever's calling it — none of
which "the code runs" by itself guarantees. A deployment runtime is
the layer that provides all of that as a managed service, so the
agent's own code doesn't have to reimplement process management,
scaling, and networking from scratch.

```
        requests
           |
           v
   [ Load balancing / routing ]
           |
           v
   [ Runtime manages: scaling instances up/down,
     restarting failed instances, health checks ]
           |
           v
   [ Your agent's code executes, per request ]
           |
           v
        response
```

Which specific runtime to choose is itself a design decision (task
4.2), not a single default: **Cloud Run** fits stateless,
request-driven workloads that benefit from scaling to zero when idle —
cost-efficient for bursty or steady but moderate traffic with no need
for custom infrastructure control. **GKE** fits workloads needing
finer infrastructure control — custom networking, non-standard scaling
policy, multi-container pod patterns — at the cost of more operational
overhead (a cluster to run, even when nothing's happening, unlike
Cloud Run's scale-to-zero). **Agent Runtime** is purpose-built for
genuinely agentic workloads specifically — it natively integrates with
Agent Registry (agent discovery) and Agent Identity's per-hop identity
checks in a way neither general-purpose option provides out of the
box, which matters most for multi-agent, multi-hop systems.

**Why not "just run it as a script on a VM and call it deployed"?**
Because that VM has no automatic scaling, no automatic recovery if the
process crashes, and no built-in mechanism for the kind of concurrent,
reliable, secure access a real production system needs — a deployment
runtime exists specifically to provide those properties as a managed
capability instead of requiring the agent's own team to build and
operate them by hand.

---

### Q16. "What do 'drift,' 'latency,' and 'hallucination' mean as production failure modes, and how are they different from each other?"

**What's really being asked.** *In plain terms first:* these are three
distinct things that can go wrong with a live agent, and task 4.2 names
all three as things to actively troubleshoot and monitor for — this
checks whether a candidate can tell them apart rather than treating
"the agent is misbehaving" as one undifferentiated problem.

**Model answer.** **Hallucination** is the model generating a
plausible-sounding but factually wrong or ungrounded response — a
correctness problem, at the level of a single response, that can
happen even on day one before anything has changed (Q2 covers why
grounding is the primary mitigation). **Latency** is how long the
system takes to respond — a performance problem, not a correctness
one; an agent can give a perfectly correct answer slowly, which is a
different failure to diagnose than a wrong answer given instantly. A
slow response is often traceable to a specific hop — a tool call
taking too long, a retrieval step scanning too much content, an
overloaded downstream service — rather than the model's reasoning
itself. **Drift** is different from both: it's the agent's behavior
slowly diverging from how it originally performed, over time, without
any single obvious cause — often from an underlying model update, a
shift in what users are actually asking versus what the system was
originally tuned and tested against, or a slow accumulation of edge
cases the golden dataset never covered.

The reason these need to be told apart rather than lumped together as
"something's wrong" is that they point at different fixes: a
hallucination points at grounding/retrieval quality; a latency problem
points at a specific slow hop in the request path (often diagnosable
via Cloud Trace); drift points at the need for *continuous* evaluation
(Q14), because a one-time pre-launch check, by construction, can never
catch something that only appears gradually after launch.

**Why not "if the agent's giving bad answers, just retrain or
re-prompt it and move on"?** Because that treats every "something's
wrong" report as the same problem, when the actual fix depends
entirely on which of the three it is — re-prompting doesn't fix a slow
tool call, and it doesn't build the continuous-evaluation discipline
that catches drift before it accumulates into a real production
problem.

---

## Section 5 — Securing and governing agentic workflows (4 questions)

### Q17. "What does OAuth 2.0 actually do in an agent context — what problem is it solving when an agent calls a tool?"

**What's really being asked.** *In plain terms first:* **OAuth 2.0**
is a standard protocol for granting one system limited, revocable
access to act on behalf of a principal (a person, or here, an agent)
*without* handing over that principal's actual long-term credentials
(like a password). This checks whether a candidate can explain OAuth's
actual purpose rather than just recognizing the acronym.

**Model answer.** When an agent needs to call a tool — read a
calendar, query an internal API, act against a third-party SaaS
product — it needs to prove it's authorized to do so. The naive
approach would be giving the agent the same long-lived credentials a
human would use to log in directly, but that's a poor security
posture: those credentials typically grant broad, standing access,
have no natural expiration tied to a specific task, and are expensive
to revoke cleanly if something goes wrong (rotating a shared
credential can break every other system using it). OAuth 2.0 solves
this by issuing a scoped, time-limited token instead: the agent
authenticates using this token, which grants only the specific access
it was issued for, for a bounded time, and can be revoked
independently without touching the underlying credential at all.

Task 5.1 names this directly: "implementing authentication and secure
tool execution (e.g., agent-to-tool API calls using OAuth 2.0)" — this
is the mechanism answering "is this specific agent-to-tool call
actually authorized," which is a distinct question from "does this
agent's overall access boundary include this kind of action at all"
(that's PAB, Q18) or "should a human sign off on this specific action"
(that's HITL, Q19). OAuth answers the authentication layer
specifically — proving *who's asking* — before any of those other
checks even apply.

**Why not "just give the agent a standing API key with full access,
it's simpler"?** Because a standing, broad-access credential has no
natural way to expire, no way to scope it down to only what a specific
task needs, and no clean way to revoke it without potentially breaking
other things depending on the same credential — exactly the properties
OAuth 2.0's scoped, time-limited tokens are designed to avoid.

---

### Q18. "What's the difference between general IAM, a service account, and PAB (principal access boundary) configured via Agent Identity?"

**What's really being asked.** *In plain terms first:* **IAM
(Identity and Access Management)** is the general cloud concept of
defining who is allowed to do what. A **service account** is a
non-human identity software uses to authenticate itself, as opposed
to a person logging in with their own credentials. **PAB** is a
specific, named mechanism *for this exam* — this question directly
tests one of `../CLAUDE.md` §7's currency corrections: "PAB is a
generic IAM concept" is explicitly called out as the wrong framing.

**Model answer.** IAM is the umbrella concept: defining principals
(who), permissions (what), and resources (on what) across a cloud
environment generally — it applies just as much to a human engineer's
console access as to anything else. A service account is one kind of
IAM principal specifically for non-human callers — an agent, like any
other piece of software calling cloud APIs, typically authenticates as
a service account rather than as a person.

PAB, configured via **Agent Identity**, sits on top of this as
something more specific than generic IAM: it's a defined boundary on
what an *agent* — as an agent, with its own reasoning and its own
potential to be manipulated or to make a mistake — is allowed to
reach, independent of what the underlying service account's raw IAM
permissions might technically allow. The distinction matters because
an agent's actual behavior is less predictable than a fixed script:
generic IAM answers "what can this service account's credentials
technically do," while PAB answers "what should *this specific agent*,
given what it's actually meant to do, be bounded to" — a narrower,
purpose-specific boundary layered on top of the underlying IAM
permissions, not a replacement for them.

**Why not "PAB is just what we already call an IAM role, with a new
name for this exam"?** Because treating it as a rename misses the
actual distinction the exam guide draws: PAB is agent-specific access-
boundary configuration, addressing a risk category (an autonomous
agent doing something no human individually authorized in that moment)
that generic IAM roles, designed around human or simple-script access
patterns, weren't built to address on their own.

---

### Q19. "What is HITL (human-in-the-loop), and how do you decide when it's required versus optional?"

**What's really being asked.** *In plain terms first:* **HITL** means
a human must review or approve an action before it takes effect,
rather than the agent completing it fully autonomously. This checks
whether a candidate has a real decision framework for when to require
it, rather than either "always require it" or "never require it."

**Model answer.** HITL exists as a control for actions where the
consequence of the agent being wrong is expensive or hard to reverse —
it's not a general-purpose safety net applied uniformly regardless of
what the agent can actually do. The decision framework I'd apply: does
this action have a real-world, potentially hard-to-reverse effect (an
account credit, a submitted request, a shutdown command),
and what's the actual cost if the agent gets it wrong here? A
read-only, advisory system that only answers questions has no action
with a real-world consequence to gate at all — requiring HITL there
adds process cost without a matching risk to justify it. A system that
can take consequential actions needs HITL calibrated to *which*
actions actually carry that risk, not applied to every single output
regardless of stakes.

The reasoning scales: a low-value, easily-reversible, well-understood
action can reasonably proceed autonomously; a high-value, hard-to-
reverse, or novel action should route to a human, at least until the
action category has enough of a track record to reconsider the
threshold. This is exactly the reasoning behind task 5.2's framing of
HITL as one guardrail among several ("safety frameworks and
guardrails... e.g., Agent Gateway, Model Armor, and HITL") rather than
the only or default control — it's specifically for the class of risk
those other controls (content-pattern safety, access boundaries) don't
address: an action too consequential to automate regardless of how
clean everything upstream looked.

**Why not "require human approval on every single agent action, to be
safe"?** Because that turns an agent into a drafting tool rather than
an autonomous system, eliminating most of the value automation was
meant to provide — the actual design work is calibrating *which*
actions warrant a human, proportional to real risk, not deciding
HITL on or off as a single global switch.

---

### Q20. "What do Model Armor and Sensitive Data Protection each guard against, and why are they two different controls instead of one?"

**What's really being asked.** *In plain terms first:* both are named,
in-scope security tools (task 5.1/5.2), and both sound broadly like
"content safety" at first glance — this question checks whether a
candidate can name the *specific*, non-overlapping risk each one
actually catches, which is the whole argument for defense in depth
(multiple distinct controls, each closing a gap the others don't).

**Model answer.** **Model Armor** guards against malicious or
unsafe *content and instructions* — a classic example being a
prompt-injection attempt: text hidden inside a document or a user
message that tries to override the agent's actual instructions ("ignore
previous instructions and do X"). It's a content-pattern-level check,
concerned with what the content is trying to *make the agent do*,
independent of who's asking or what data the agent is otherwise
authorized to touch. **Sensitive Data Protection** guards against a
completely different risk: sensitive data (compensation figures,
personal information, regulated categories of data) appearing
somewhere it shouldn't — in an otherwise perfectly well-behaved
response — regardless of whether anything malicious was involved at
all. A response can leak a sensitive figure purely by accident, with
no injection attempt anywhere in the picture, and Model Armor's
content-safety framing has no reason to catch that; conversely, a
prompt-injection attempt hidden in a document might never actually
touch sensitive data, and Sensitive Data Protection's data-classification
framing has no reason to catch that either.

Because each catches a specific failure the other structurally
can't, running only one leaves a real gap: an organization relying
solely on Sensitive Data Protection has no defense against a
manipulated document trying to hijack the agent's behavior; one
relying solely on Model Armor has no defense against an accidental,
non-malicious data leak in an otherwise clean response.

**Why not "pick one, having both feels redundant for a single
system"?** Because they answer genuinely different questions — "is
this content trying to manipulate the agent's behavior" versus "does
this response contain data that shouldn't be there" — and a concrete
incident type exists for each that only that one control would catch,
which is the actual test for whether two controls are redundant or
each closing a distinct gap.
