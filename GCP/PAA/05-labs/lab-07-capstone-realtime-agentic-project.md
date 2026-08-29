# Lab 07 — Capstone: the Internal Knowledge & Support Agent Platform

> **This is the flagship file of the entire PAA folder.** It is a
> single, continuous, ground-zero-to-complete project that touches all
> five exam sections, in the order a real team would actually build,
> evaluate, deploy, and govern an agentic system. Read it start to
> finish, in order — later phases build directly on decisions made in
> earlier phases, the same way a real project would. Source of truth
> for this project's design: `00-START-HERE/RUNBOOK.md` §8.

---

## Honesty callout — read this before you start

> **This capstone is illustrative, not console/SDK-verified.** This
> environment has no live access to Gemini Enterprise, Agent Designer,
> CX Agent Studio, Agent Search, Antigravity, Claude Code on Google
> Cloud, GKE, Cloud Workstations, ADK, Agent Platform Memory Bank,
> Vector Search 1.0 / Agent Retrieval, RAG Engine, Agent Registry,
> Agent Runtime, Cloud Run, Google Cloud Observability, Auth Manager,
> Agent Identity, Agent Gateway, Model Armor, Sensitive Data
> Protection, Skill Registry, or the Google Skills platform itself.
> Every console click-path, command, and code sample in this file is a
> best-effort reconstruction from the exam guide's stated capabilities
> plus general product-documentation-style knowledge of how tools of
> this shape work — **not** click-verified steps. Every phase repeats
> this flag at the specific points where it matters most, so you never
> lose track of which parts are conceptually solid (the *design*
> reasoning, which does not depend on any specific console) versus
> which parts are illustrative UI/syntax (which you must cross-check
> against the live console and SDK docs before an actual exam
> attempt). This is a repo-wide honesty convention, not optional
> caveat text — see `00-START-HERE/RUNBOOK.md` §7's last row.

---

## How to use this file

This project is staged in **8 phases (0 through 7)**, matching
`00-START-HERE/RUNBOOK.md` §8 exactly:

| Phase | What gets built | Exam section(s) exercised |
|---|---|---|
| 0 | Problem framing & requirements | Project-management scaffolding |
| 1 | MVP via low-code | Section 1 (~13%) |
| 2 | Extend with coding agents | Section 2 (~17%) |
| 3 | Rebuild the core as custom code | Section 3 (~33% — the largest phase) |
| 4 | Evaluate | Section 4 (~22%, evaluation half) |
| 5 | Deploy & operate | Section 4 (~22%, deployment half) |
| 6 | Secure & govern | Section 5 (~15%) |
| 7 | Retrospective / best practices | Cross-cutting review |

Every phase follows the same internal shape: **(a)** explain each new
concept from zero — no term is assumed known, general AI/cloud
vocabulary included, per this folder's `CLAUDE.md` §2/§8 — **(b)**
explain the *reasoning* behind each design decision, not just state
the decision, and **(c)** flag every step that's illustrative rather
than console-verified. If you've already done Labs 01–06, you'll
recognize many of the same underlying concepts here — this capstone
uses a **different, standalone scenario** (an internal, employee-
facing knowledge platform, not the customer-facing retail-returns
scenario from Labs 01–06) so it can be read and followed on its own,
without needing the earlier labs as a prerequisite.

---

# PHASE 0 — Problem framing and requirements

## 0.1 Why a phase 0 exists at all, before any tool is opened

A true beginner's first instinct when told "build an agent" is often
to open a console and start clicking. This phase exists to slow that
down deliberately. Every phase after this one will make a design
decision (which low-code tool, which model size, which deployment
runtime, which security control) — and **every one of those decisions
should trace back to a requirement stated here**, not to "because that
tool looked interesting" or "because a tutorial did it that way." This
is a real project-management discipline, not exam-specific trivia, but
it's included because the exam's scenario questions are constructed
exactly this way: they give you a set of constraints (cost, data
sensitivity, latency, team size) and expect you to reason from
constraints to the correct tool choice, not recite a memorized "best"
answer independent of context.

### Vocabulary check — ground-zero definitions used throughout this capstone

If you are new to this space entirely, read every one of these once,
now, before continuing. Later phases will reuse these terms assuming
you've seen this list.

- **Agent** — software that receives a request (typically natural-
  language text), decides what to do about it, optionally calls tools
  or retrieves data, and produces a response. The key difference from
  a traditional program is that an agent's *decision* of what to do
  next is driven by an AI model's reasoning, not a fixed, hand-coded
  branch of `if/else` statements for every possible input.
- **LLM (large language model)** — the underlying AI model that
  actually understands text and generates responses. An "agent" is the
  surrounding system (instructions, tools, memory, orchestration) built
  around one or more LLMs; the LLM alone is not yet an agent.
- **Prompt** — the text given to an LLM to elicit a response. A
  **system prompt** (or "system instructions") is a persistent prompt
  that shapes the model's behavior across an entire interaction, as
  opposed to the specific question a user asks in any one turn.
- **Tool-calling / function-calling** — the mechanism by which an LLM
  can, instead of just generating text, decide to invoke a predefined
  function (a "tool") with structured arguments, and receive a result
  back that it incorporates into its next response. This is what lets
  an agent actually *do* things (look something up, take an action)
  rather than only talk about them.
- **RAG (retrieval-augmented generation)** — a pattern where, before
  generating a response, the system first retrieves relevant content
  from a knowledge source and gives it to the LLM as grounding context,
  so answers are based on real, specific, current content instead of
  only the model's general training knowledge (which can be outdated,
  incomplete, or simply not specific to your organization at all).
- **Embedding** — a way of converting text (or other content) into a
  list of numbers (a "vector") such that texts with similar meaning
  produce numbers that are close together. This is what makes it
  possible to search for "content similar in meaning to this query,"
  not just "content containing these exact words."
- **Vector database** — a database built specifically to store
  embeddings and quickly find the ones most similar to a given query
  embedding — the retrieval half of RAG.
- **IAM (Identity and Access Management)** — the general cloud concept
  of defining *who* (a person, a service, or — for this exam — an
  agent) is allowed to do *what*. Google Cloud's IAM system is the
  general-purpose version of this; this exam layers agent-specific
  mechanisms (Agent Identity, PAB) on top of the same underlying idea.
- **Service account** — a non-human identity a piece of software uses
  to authenticate itself when calling other services, as opposed to a
  person logging in with their own credentials.
- **OAuth 2.0** — a standard protocol for granting one system limited,
  revocable access to act on behalf of a principal (a person, or in
  this exam's context, an agent) without sharing that principal's
  actual long-term credentials.
- **CI/CD (continuous integration / continuous delivery)** — the
  automated pipeline that builds, tests, and (optionally) deploys code
  changes automatically, typically triggered when code is pushed to a
  repository, so changes are validated consistently rather than
  manually and inconsistently.
- **Session** — state held for the duration of one ongoing interaction
  (a conversation or task). **Memory**, as distinct from a session, is
  state that persists across separate interactions over time.
- **Latency** — how long a system takes to respond. **Throughput** —
  how much work a system can handle over time. These sometimes trade
  off against each other (a system tuned for very low latency on each
  request might handle less total volume, and vice versa).
- **Observability** — the ability to see what a running system is
  actually doing, well enough to diagnose problems — through logs
  (discrete recorded events), traces (the path and timing of a single
  request through a multi-step system), and metrics (aggregated
  numeric measurements over time).
- **Guardrail** — a control that constrains a system's behavior or
  output to stay within acceptable bounds, independent of whether the
  system's own internal reasoning judged the action acceptable.
- **HITL (human-in-the-loop)** — a design pattern where a human must
  review or approve a specific action before it takes effect, instead
  of the system acting fully autonomously.

## 0.2 The scenario

**Fictional company:** Meridian Tools, a mid-size industrial-equipment
manufacturer with roughly 1,200 employees across engineering,
manufacturing, sales, HR, and IT. Meridian has accumulated years of
internal documentation — HR policies, IT runbooks, engineering
standards, safety procedures — scattered across a mix of PDF files, an
internal wiki, and a handful of shared drives. Employees routinely
waste time either searching through this sprawl themselves or
interrupting a colleague who happens to remember where something
lives.

**The ask, as leadership first stated it (deliberately vague — this is
realistic):** *"Can we get some kind of AI chatbot that knows our
internal docs?"*

### 0.2.1 Why you cannot start building from that sentence alone

A vague ask like this is realistic — and dangerous to build from
directly. It doesn't tell you: what "knows our internal docs" actually
means (answer questions? summarize? take actions?), who's allowed to
see what (HR policy content is more sensitive than a general IT
FAQ), how fast it needs to respond, how much the company is willing to
spend, or what "done" even looks like. Building anything before
answering these is how projects end up over-engineered in the wrong
direction, under-secured in a way nobody notices until an incident, or
simply not what the requester actually needed.

## 0.3 A beginner-friendly requirements-gathering primer

Requirements gathering, at its simplest, is the discipline of turning
a vague ask into a specific, checkable list of things the system must
(and must not) do, before you start building. For this capstone,
that means answering five categories of question. Work through each
one the way a real project lead would — as a structured conversation
with stakeholders, not a solo guess.

### 0.3.1 Functional requirements — what must the system actually do?

Ask: *what specific tasks should this thing perform, described from
the user's point of view, not the technology's?* For Meridian:

- An employee can ask a natural-language question ("how many vacation
  days do I get after 2 years?") and get a correct, sourced answer.
- The system must be able to answer questions grounded in the
  company's actual current policy documents — not generic, made-up-
  sounding answers.
- Over time (this matters for Phase 2/3 later), engineering wants the
  same platform extended into something that can also help with
  internal engineering/ops tasks (e.g., "which runbook covers a
  failed deployment"), not just HR-style FAQ.
- Eventually (Phase 3), complex or ambiguous questions should be able
  to route to a more capable specialist path rather than giving a
  low-confidence guess.

**Explicitly out of scope for this project (stated now, so nobody
assumes it later):** this system does not take real-world actions on
an employee's behalf (it doesn't file a vacation request, doesn't
modify an HR record) — it answers questions and, at most, drafts
things a human still submits. This boundary matters enormously for
later security decisions (Phase 6) — a read-mostly, advisory system
has a fundamentally smaller blast radius than one that can execute
transactions, and stating this now, in Phase 0, is what lets later
phases correctly reason about how much guardrail investment is
actually warranted, instead of over-building security for
capabilities the system was never going to have.

### 0.3.2 Non-functional requirements — how well must it do it?

Ask: *given that the system does the right things, what qualities
does it need — speed, reliability, availability?*

- **Latency:** employees expect a chat-like response, not a multi-
  minute wait — a target of a few seconds for a typical question is
  reasonable for this use case (contrast this later, in Phase 3, with
  a hypothetical batch-processing task that could tolerate much higher
  latency — the target isn't a universal constant, it's scenario-
  specific).
- **Availability:** this is an internal productivity tool, not a
  24/7 customer-facing system — business-hours-plus-buffer reliability
  is an acceptable target, not "must never go down," which matters
  later when choosing how much operational investment (Phase 5) is
  proportionate.
- **Scale:** 1,200 employees, realistically a small fraction actively
  querying at any given moment — this is a modest-scale system, not a
  massive consumer-facing one. Stating this now prevents over-
  provisioning decisions later.

### 0.3.3 Data requirements — what does it need to know, and where does that live?

- Source documents: HR policy PDFs, an internal wiki (structured as
  web pages, not files), IT runbooks (a mix of markdown files and PDF
  attachments), and — a detail worth calling out early because it
  recurs in Phase 1 — a handful of recorded onboarding/training videos
  that live in a shared drive and have never been transcribed or
  indexed anywhere.
- Data sensitivity varies by source: general IT FAQ content is low-
  sensitivity; HR policy content that references compensation bands or
  disciplinary procedures is higher-sensitivity and should not be
  uniformly visible to every employee. This single fact is what will
  drive a real access-control requirement in Phase 6, not an
  afterthought bolted on at the end.

### 0.3.4 Constraint requirements — cost, security, team, timeline

- **Cost:** Meridian is not a large enterprise with unlimited AI
  budget — the project should start cheap (a low-code MVP, Phase 1)
  and only justify more expensive/complex custom engineering (Phase 3)
  once the low-code version proves the concept and hits a wall it
  can't get past on its own.
- **Security:** as an internal enterprise tool touching HR content,
  it must respect existing access boundaries — an employee should
  never see policy content restricted to a different role/department
  just by asking the agent about it.
- **Team:** a small internal platform team (a handful of engineers)
  will own this, not a large dedicated AI team — favor tools that
  reduce custom-engineering burden where the requirements allow it
  (this is exactly the reasoning that will justify starting with
  low-code in Phase 1 rather than jumping straight to custom ADK code).
- **Timeline:** leadership wants something demonstrable soon (weeks,
  not months) to build confidence before committing to deeper
  investment — another vote in favor of a fast low-code MVP first.

### 0.3.5 Success criteria — how will you know it worked?

Define this **before** building, not after — a common beginner mistake
is skipping this and then arguing after the fact about whether a
result counts as good. For this project:

- A curated set of realistic employee questions (built properly in
  Phase 4) gets correct, sourced answers at an agreed accuracy bar.
- Employees report (via a simple survey, out of scope for this
  technical capstone to detail further) that the system saves them
  time versus manually searching.
- No security/access-control incident occurs — an employee never sees
  content their role shouldn't grant them access to.

### 0.3.6 Turning requirements into a phase-by-phase build plan

With the above answered, the phase table at the top of this file is no
longer an arbitrary structure — it's the direct consequence of the
requirements: start cheap and fast (Phase 1, low-code, per the cost/
timeline constraints), extend with engineering tooling once the
platform team needs to build custom capability around it (Phase 2),
rebuild the core in code once the low-code MVP's limits are actually
hit — specifically around fine-grained retrieval control and
multi-agent routing (Phase 3, justified by the "route to a specialist
path" functional requirement from §0.3.1), then prove it works
(Phase 4), run it reliably (Phase 5), and lock down access properly
given the stated data-sensitivity constraint (Phase 6).

## 0.4 Setting up your Google Cloud environment

> **Illustrative, not console-verified** — same honesty flag as the
> top of this file. Google's console layout can change; if a specific
> button/menu name below doesn't match what you see, the underlying
> concept (project, project ID, billing account) is still correct —
> look for the equivalent control.

Everything from Phase 1 onward assumes you already have a working
Google Cloud project. If you've never used Google Cloud before, this
section is for you — a true beginner cannot skip straight to Phase 1
without it.

**0.4.1 What a Google Cloud project actually is.** A **Google Cloud
project** is the container everything else in this capstone nests
inside: it holds the resources you create (an Agent Runtime deployment,
a BigQuery dataset, a Cloud Storage bucket), the IAM permissions that
govern who can touch them, and the billing account that pays for them.
This is a different thing from your **Google account** (the
email/login you sign in with) — one Google account can own, or have
access to, many separate projects. Think of the Google account as
"who you are" and the project as "which sandbox you're working in."

**0.4.2 Do you need a new Google account?** Almost certainly not — an
existing personal Google account works fine for following this
capstone. The one reason to consider a dedicated account: it keeps
every resource this capstone creates in one place, easy to find and
delete later without hunting through unrelated projects. Not required,
just a convenience.

**0.4.3 Creating a new GCP project.**
1. Go to `console.cloud.google.com` and sign in with your Google
   account.
2. In the top navigation bar, open the project selector (it shows the
   current project name, or "Select a project" if you have none yet).
3. Choose "New Project."
4. Give it a name — something recognizable, e.g. "PAA Capstone" or
   "Meridian Tools Demo." The name is just a label; it's not what other
   commands reference.
5. Note the **project ID** the console generates (or lets you set) —
   this is different from the project *name*: it's a globally unique
   identifier (e.g. `paa-capstone-472901`) that every `gcloud` command
   and code sample later in this capstone will reference as
   `YOUR_PROJECT_ID`. Write it down now.

**0.4.4 Enabling billing.** Every project needs a linked **billing
account** before most of the 28 in-scope tools will actually work —
find this under the console's "Billing" section, where you'll be
prompted to create or link a billing account (which requires a payment
method). Enabling billing does **not** by itself commit you to
spending anything — it's a prerequisite for provisioning most services,
not a charge. See §0.5 immediately below before you provision anything
that could actually cost money.

**0.4.5 Where the project ID shows up later.** Every phase from here on
that references `YOUR_PROJECT_ID` in a `gcloud` command or a code
sample means the project ID you just noted in 0.4.3 — set it once as
your active project (`gcloud config set project YOUR_PROJECT_ID`) so
later commands don't need to repeat it.

## 0.5 Cost and budget guidance before you touch anything

> This section is about **your own money**, not Meridian Tools' fictional
> budget from §0.3.4 — that was a design constraint for the story; this
> is a real warning for your wallet.

**0.5.1 The free-trial credit program.** New Google Cloud accounts have
historically come with a starting credit for a limited trial period.
This runbook cannot state a current dollar figure or duration with
confidence — offers change, and this environment has no way to verify
today's exact terms (see `00-START-HERE/RUNBOOK.md` §1's access note).
**Check `cloud.google.com/free` directly** for the current offer before
you start, and treat any credit you do have as a buffer, not a reason
to skip §0.5.3's hygiene steps below.

**0.5.2 Which of this capstone's tools are free vs. billable.** Roughly
three buckets — check the current pricing page for each service before
relying on this table, since free-tier terms change:

| Bucket | What it means | Services in this capstone likely here |
|---|---|---|
| **Has an always-free monthly tier** | Some usage each month costs nothing, you're billed only past that threshold | Cloud Storage, Cloud Run, BigQuery, Firestore, Cloud Functions-adjacent services |
| **Bills from the first unit of usage** | No meaningful free allowance — configuring it is free, using it starts a meter immediately | Vector Search 1.0, RAG Engine, Agent Runtime, Gemini/Model Garden model calls |
| **Bills continuously once provisioned — including while idle** | The riskiest bucket for a beginner: you pay whether or not you're actively using it | **GKE clusters** — control-plane and node costs accrue the whole time a cluster exists, whether or not anything is running on it |

**The single costliest mistake a beginner following this capstone could
make is standing up a GKE cluster in Phase 2 or Phase 5 and forgetting
about it.** If you provision GKE for the coding-agent sandbox or as a
deployment target, delete it the same day you're done with that lab
session — don't leave it running "for next time."

**0.5.3 Basic cost-management hygiene:**
- Set a **budget alert** (Billing → Budgets & alerts in the console) as
  your very first action after enabling billing in §0.4.4, before
  Phase 1 starts — a small monthly threshold with an email alert costs
  nothing to configure and catches runaway spend early.
- At the end of each study/lab session, tear down what you provisioned
  that session rather than leaving it running until next time — this
  matters most for GKE (0.5.2) but is good habit for everything.
- If you're ever unsure whether something is still running and billing,
  the console's Billing → Reports page shows current spend by service —
  check it periodically rather than assuming.

Phase 5 (§5.1 below) revisits this GKE warning specifically when this
capstone deploys to a production runtime — worth re-reading this
section again at that point.

---

# PHASE 1 — MVP via low-code (Section 1, ~13%)

## 1.1 Why start here, and what "MVP" means

**MVP (minimum viable product)** — the smallest version of a system
that's still genuinely useful and lets you learn something real from
real usage, as opposed to a full-featured build nobody has validated
is even wanted yet. Per Phase 0's cost/timeline constraints, the right
first move is **not** to open a code editor — it's to use **Gemini
Enterprise**'s low-code tools, exactly the tools covered in exam
Section 1.

### 1.1.1 What Gemini Enterprise, Agent Designer, and CX Agent Studio are

**Gemini Enterprise** is Google Cloud's low-code/no-code platform for
building and deploying conversational and agentic experiences without
writing a custom orchestration loop yourself. Within it, two builder
surfaces matter for this phase:

- **Agent Designer** — the general-purpose low-code agent builder:
  system instructions, in-console prompt templates, tool/data
  connections.
- **CX Agent Studio** (Customer Experience Agent Studio) — a
  state-machine-style builder (pages, transition routes, event
  handlers) purpose-built for structured, multi-turn conversational
  flows.

**Currency reminder, stated once here and assumed throughout this
capstone:** the correct name is **Gemini Enterprise**, not "Vertex AI
Agent Builder" — that branding does not appear in the exam guide at
all. The grounding service is **Agent Search**, formerly Vertex AI
Search — use the current name.

### 1.1.2 Why Agent Designer, not CX Agent Studio, for this specific MVP

This is a real decision, not a coin flip — walk the same don't-use/
use reasoning a real architect would apply. Meridian's MVP requirement
(§0.3.1) is "answer a natural-language question, grounded in policy
documents, with a citation" — a single-turn, Q&A-shaped interaction
with no requirement for a fixed, ordered sequence of collected fields.
That is **not** the structural-determinism use case CX Agent Studio
exists for (a booking flow, a multi-field intake process with a
required order). **Use Agent Designer** for this phase; CX Agent
Studio would be justified later only if a requirement genuinely needed
guaranteed, ordered, multi-step data collection — which this MVP does
not.

## 1.2 Build the MVP agent

*(Illustrative console steps — see this file's top-level honesty
callout.)*

1. In the Gemini Enterprise console, create a new Agent Designer
   agent named `meridian-knowledge-agent-mvp`.
2. Select a general-purpose Gemini model as the underlying LLM — the
   MVP doesn't yet need the fine-grained model-selection reasoning
   from Phase 3 (that reasoning applies once you're building custom
   ADK agents with full control over model choice); Agent Designer
   typically offers a curated selection rather than the open-ended
   choice ADK exposes.

### 1.2.1 Write the system instructions

Recall: **system instructions** are the persistent, top-level
behavioral contract — persona, tone, hard constraints, scope
boundaries.

```
You are an internal knowledge assistant for Meridian Tools
employees. You answer questions using the company's connected
internal documentation as your source of truth.

Rules:
- Always cite the specific source document/section you're
  answering from.
- If a question falls outside the connected documentation's
  scope, say so plainly rather than guessing.
- Never state a policy detail (e.g., a specific number of leave
  days, a specific approval threshold) unless it is directly
  supported by the retrieved source content.
- Keep answers concise; offer to expand on request.
```

**Reasoning, not just wording:** the "never state a policy detail
unless directly supported" rule exists specifically because Phase
0.3.3 flagged HR policy content as high-stakes to get wrong — an
agent confidently inventing a plausible-sounding but incorrect leave-
day number is a much worse failure than an agent correctly declining
to answer. This single instruction line is doing real risk-mitigation
work, not just stylistic polish.

### 1.2.2 Add an in-console prompt template

Recall the two named prompting techniques from task 1.1: **few-shot**
(showing labeled examples so the model matches a desired format) and
**chain-of-thought / CoT** (instructing step-by-step reasoning before
an answer, for multi-condition logic).

For this MVP, add a **few-shot** template for the Answer/Source
citation format (the same pattern used in `lab-01`):

```
Example
User: How many sick days do I get per year?
Answer: Full-time employees accrue 10 sick days per calendar
year, per the Meridian Employee Handbook.
Source: Employee Handbook, Section 4.2 — Sick Leave

Now answer the user's actual question in the same two-line
format (Answer / Source):
{{user_question}}
```

**Why few-shot and not CoT here:** most of Meridian's HR/IT FAQ
questions are single-fact lookups ("how many days do I get"), not
multi-condition eligibility logic. Per the exam's own don't-use/use
framing for these two techniques, CoT is the right tool when a
question genuinely requires reasoning through multiple interacting
conditions (you'll see a real example of that need in §1.4 below) —
applying it to every simple lookup here would add latency and token
cost for no accuracy benefit, working against the latency requirement
from §0.3.2.

### 1.2.3 Connect Agent Search for grounding

Recall: **Agent Search** (formerly Vertex AI Search) is the managed,
low-code, security-scoped enterprise-data grounding service.

1. Connect a new Agent Search data source pointing at the HR policy
   PDFs and IT runbook markdown/PDF files (§0.3.3).
2. **Security-scoping note, tying directly back to Phase 0's data-
   sensitivity requirement:** Agent Search's retrieval respects the
   underlying data source's existing access controls — meaning two
   employees asking the identical question can legitimately receive
   different retrieved context (and therefore different answers)
   based on what each is authorized to see in the source system. This
   is exactly the mechanism that satisfies §0.3.4's security
   constraint ("an employee should never see policy content restricted
   to a different role/department") — **provided** the underlying HR
   document repository's own access controls are configured correctly
   in the first place. Agent Search enforces existing permissions; it
   does not invent new ones — a subtle but important distinction: if
   the underlying document store is itself misconfigured to be too
   open, Agent Search's retrieval will faithfully (and incorrectly)
   surface that over-broad content. Getting the source system's
   permissions right is a prerequisite, not something this step fixes
   on its own.

### 1.2.4 What about the onboarding videos from §0.3.3?

Recall: Meridian has recorded onboarding videos that have never been
transcribed or indexed. This is a deliberate test of whether you
correctly apply task 1.2's second consideration: **ingesting and
processing unstructured multimodal data.** Simply pointing Agent
Search at the shared drive folder containing the video files is
**not** sufficient — the videos need to go through a multimodal
ingestion/processing path (transcription, or another content-
extraction step) before their actual spoken content becomes
retrievable and groundable. For this MVP, defer video ingestion to a
later iteration (it's explicitly not required to hit the MVP's
functional requirements from §0.3.1, which centered on policy
documents) — but note this decision explicitly in the project's
requirements-traceability record, rather than silently forgetting the
videos exist. This is a realistic and correct MVP-scoping call: you
identified an in-scope-eventually capability, consciously deferred it,
and documented why, instead of either quietly ignoring it or
over-building the MVP to include it before it's actually needed.

## 1.3 Test the MVP

Test at minimum:

- A simple, in-scope factual question ("how many sick days do I get")
  — should produce a cited Answer/Source response.
- An out-of-scope question ("what's the CEO's salary") — should
  trigger the "outside scope, decline rather than guess" behavior.
- A question that two different (simulated) roles should see
  differently, if your test environment allows simulating different
  requester identities — confirming Agent Search's permission-scoped
  retrieval behaves as expected (§1.2.3).

## 1.4 A concrete gap the MVP hits — and why it's evidence, not failure

Try this question against the MVP: *"I've been at Meridian for 18
months, took unpaid leave for 6 weeks last year, and I'm a contractor
converting to full-time next month — how much paid leave will I have
accrued by end of year?"*

This question requires reasoning through **multiple interacting
conditions** (tenure, a leave-affecting event, a conversion-in-
progress status) to arrive at a correct number — exactly the shape of
task the exam's domain file flags chain-of-thought prompting for. Go
back and add a CoT-oriented prompt template for this class of
question (an explicit "think through each factor — tenure, any unpaid
leave adjustments, employment-status changes — before stating a final
number" instruction). This is a genuine, useful MVP finding, not a
sign the MVP failed: **it's exactly the kind of limit-discovery an MVP
exists to produce**, and it starts pointing toward Phase 3's deeper
capability needs (a case complex enough to eventually warrant routing
to a more capable path, per the functional requirement in §0.3.1).

## 1.5 What Phase 1 proved, and what it didn't

**Proved:** a grounded, cited, low-code Q&A agent can answer the
majority of straightforward internal-knowledge questions quickly and
cheaply, satisfying Phase 0's cost/timeline constraints and most of
its functional requirements.

**Didn't prove:** that this approach scales to (a) multi-condition
reasoning at real accuracy, (b) engineering's later ask for a
more capable, extensible platform, or (c) the fine-grained retrieval
control (custom chunking, reranking) a larger, more heterogeneous
document corpus will eventually need. These gaps are not oversights —
they're the specific, evidence-based justification for Phases 2 and 3.

---

# PHASE 2 — Extend with coding agents (Section 2, ~17%)

## 2.1 Why this phase exists between the low-code MVP and the custom rebuild

Phase 1's low-code agent is configured entirely through console forms
— there is no source-controlled codebase yet for the platform team to
build real engineering practice around: no tests, no CI/CD, no
custom tooling. Before jumping straight to writing a custom ADK agent
(Phase 3, a bigger investment), the platform team first uses **coding
agents** — development-time tools that write, refactor, and build code
— to start creating the surrounding engineering scaffolding: custom
integration scripts, a CI pipeline, and internal developer tooling
that Phase 3's custom agent will eventually run inside of.

**Ground-zero distinction worth restating clearly:** a **coding
agent** (this phase) is a development-time collaborator that helps
engineers write software. A **custom runtime agent** (Phase 3) is
software that itself serves end users (Meridian employees) in
production. These are different categories of "agent" entirely, even
though both are covered by this same exam — keep this distinction
sharp, because it is one of the most consistently tested distinctions
across Sections 2 and 3.

## 2.2 Choosing a coding agent: Antigravity or Claude Code on Google Cloud

The exam guide names both **Antigravity** (Google Cloud's coding-agent
product, shipping as CLI/SDK/App) and **Claude Code on Google Cloud**
as coequal examples — neither is favored over the other, and a
question naming either is testing the same underlying task 2.1/2.2
concepts. For this capstone, Meridian's platform team standardizes on
**Antigravity's CLI surface**, chosen for a stated reason: the team
wants to automate a recurring task (nightly ingestion-pipeline
maintenance, §2.4 below) from a scripted pipeline step, which is
exactly the CLI surface's stated fit — scriptable, headless,
CI/automation-friendly — versus the App surface's interactive, human-
driven fit.

## 2.3 Configure the coding agent with an MCP server

Recall: **MCP (Model Context Protocol)** is an open protocol
standardizing how an agent (client) connects to external tools/data
sources (each exposed by an MCP server) — avoiding a bespoke
integration per tool.

Meridian's platform team wants the coding agent to be able to query
the internal wiki's content-management API (to check, for example,
whether a referenced policy page still exists before writing an
ingestion script that assumes it does). Configure an MCP server for
this:

```json
{
  "mcpServers": {
    "wiki-cms": {
      "command": "npx",
      "args": ["-y", "@meridian/wiki-cms-mcp-server"],
      "env": {
        "WIKI_API_TOKEN": "${WIKI_CMS_TOKEN}"
      }
    }
  }
}
```

**Why the token is an environment-variable placeholder, not a literal
value:** the same "no secrets committed to source control" principle
introduced in Lab 02 applies here identically — this repository's own
conventions (root `CLAUDE.md`: "no secrets... anywhere") and general
security practice agree: a config file that will likely end up in
version control should never contain a literal credential.

```bash
antigravity mcp add wiki-cms --config ./mcp.json
antigravity mcp list   # confirm the server connects and exposes
                        # the expected tools before relying on it
```

## 2.4 Create a custom skill for ingestion-script conventions

Recall: a **skill** is a packaged, reusable unit of instruction that
teaches the coding agent how to perform a specific kind of task the
way *this organization* does it, rather than re-explaining the
convention in every prompt.

```
skills/
  ingestion-script-conventions/
    SKILL.md
```

```markdown
# Skill: Ingestion Script Conventions

## When to use this skill
Apply whenever the coding agent is asked to write or modify a
script that ingests documents into the knowledge platform's
data pipeline.

## Conventions
1. Every ingestion script must log the source document's last-
   modified timestamp alongside its content, so downstream
   evaluation (Phase 4) can detect stale content.
2. Never ingest a document from a source path outside the
   approved list in `config/approved_sources.yaml` — this list
   is the single source of truth for what's in scope, and
   prevents an ingestion script from accidentally pulling in an
   unapproved, possibly more sensitive data source.
3. All ingestion scripts must be idempotent — running the same
   script twice on the same source must not create duplicate
   entries.
```

**Reasoning behind rule 2 specifically:** this is a direct, concrete
guard against a realistic failure mode — an engineer (or a coding
agent, prompted loosely) writing "ingest everything in this shared
drive folder" without realizing the folder also contains a
subdirectory of draft, unapproved HR policy changes that shouldn't be
surfaced to employees as if they were finalized policy. Encoding this
constraint as a skill, checked against an explicit approved-sources
list, is far more reliable than hoping every future prompt to the
coding agent remembers to mention the restriction — exactly the
"brittle, easy to partially ignore" failure mode the exam's own
guidance on skills-vs-prompts warns about.

## 2.5 Run the coding agent in a sandbox

Recall: **don't** run a coding agent with direct, unsandboxed access
to real infrastructure — that's the named security anti-pattern task
2.1 exists to prevent.

### 2.5.1 GKE or Cloud Workstations — walk the decision, don't default

Meridian's platform team is small and does not currently run
production infrastructure on GKE — they have no existing Kubernetes-
native operational practice to inherit. Per the don't-use/use guidance
comparing the two sandbox options: **use Cloud Workstations** — a
managed, pre-provisioned, isolated developer environment, appropriate
for a small team that wants a consistent secured dev environment
without taking on cluster/node-topology operational overhead they
don't otherwise need. (If Meridian's engineering org already
standardized on GKE for its production services, GKE-based sandboxing
would instead be the better fit, for consistency with existing
operational practice — the right answer depends on the team's actual
infrastructure posture, not a universal preference for one option.)

```bash
antigravity sandbox create \
  --type cloud-workstations \
  --repo ./meridian-knowledge-platform \
  --mcp-config ./mcp.json \
  --skills ./skills/ingestion-script-conventions

antigravity sandbox run --task \
  "Write a nightly ingestion script that pulls updated HR \
   policy PDFs from the approved sources list, logs their \
   last-modified timestamps, and is safe to re-run without \
   creating duplicates. Run it against the test fixtures in \
   /test-data and report the results."
```

## 2.6 Refactor, optimize, and patch — the three named coding-agent jobs

Apply the three concrete jobs task 2.1 names, to this project
specifically:

- **Refactor:** as the ingestion pipeline grows past HR/IT documents
  toward engineering standards docs (an anticipated near-term need),
  ask the coding agent to refactor the initially single-purpose
  ingestion script into a pluggable structure (one ingestion module
  per source type) — "without changing its external behavior," the
  refactor-specific constraint.
- **Optimize execution runtime:** if the nightly ingestion job's
  runtime grows uncomfortably long as more sources are added, ask the
  coding agent to profile and optimize it (e.g., parallelizing
  independent per-source ingestion instead of processing sources
  strictly one at a time) — a distinct concern from correctness.
- **Patch a vulnerability:** if a dependency-scanning tool later
  flags a known CVE in a library the ingestion pipeline uses, ask the
  coding agent to patch it — application-layer security, distinct
  from the infrastructure-layer security Phase 6 covers.

**Every one of these outputs still goes through a human review / CI
gate before merging** — recall the explicit warning: a sandboxed
agent's output is not automatically production-ready; sandboxing
bounds *execution* risk, it does not certify *correctness*.

## 2.7 Agents CLI — the operational layer, introduced but not yet used in depth

Recall: **Agents CLI** (inside the broader **Agent Platform**) is the
operational layer for build/scale/govern/optimize once an agent is
*deployed* — distinct from Antigravity's development-time authoring
role. Meridian's knowledge platform isn't yet a deployed custom
runtime agent (that's Phase 3/5's job) — so this phase only names the
boundary, the same way Lab 02 did: **don't** reach for Agents CLI to
configure this phase's MCP server or skill (that's Antigravity's job,
just demonstrated above); **do** expect to use Agents CLI once Phase 3
produces a deployed custom agent to build/scale/govern/optimize.

## 2.8 What Phase 2 produced

A version-controlled ingestion codebase, a working nightly ingestion
pipeline (sandboxed, tested, code-reviewed), and — importantly for
Phase 3 — a platform team that now has real engineering practice
(skills, MCP integration, sandboxed execution, CI-gated review) to
build the custom ADK agent on top of, rather than starting Phase 3
from zero engineering process as well as zero custom-agent code.

---

# PHASE 3 — Rebuild the core as custom code (Section 3, ~33%)

## 3.1 Why this is the largest phase, and what specifically justifies leaving low-code

Recall Phase 1's honest limits (§1.5): multi-condition reasoning
accuracy, and — the functional requirement from §0.3.1 — routing
complex/ambiguous questions to a more capable specialist path. Neither
of these is something Agent Designer's low-code configuration surface
can give you fine-grained control over. This is the exact don't-use/
use boundary from the exam's own guidance: **don't** build custom ADK
code for something a low-code console can already configure — that's
unnecessary engineering overhead; **do** reach for ADK specifically
when you need capabilities low-code tools don't expose: custom
retrieval-pipeline control, and custom multi-agent orchestration. Both
apply here, which is exactly why this phase — matching the exam's own
~33% weighting for Section 3 — is the largest phase of this capstone.

## 3.2 What ADK is, from zero

**ADK (Agent Development Kit)** is explicitly described in the exam
guide as an **open-source** library for building custom agents — a
currency correction worth restating plainly: do not describe ADK as
closed-source or Google-proprietary. Conceptually, ADK gives you:

- A code-first framework for defining an agent's core loop: receive
  input, decide what tool(s) to call, call them, produce output.
- Structured tool/function-calling integration points, so an agent's
  available actions are defined as code — more reliable and testable
  than an instruction the model might or might not follow under a
  complex request.
- The foundation that sessions/memory, enterprise-knowledge
  integration, and multi-agent orchestration (the rest of this phase)
  all plug into.

## 3.3 Design the target architecture before writing code

Sketch this the same disciplined way Lab 01 sketched a state machine
before opening a console — cheaper to fix a design gap on paper than
mid-build.

```
                        Employee question
                              │
                              ▼
                 ┌─────────────────────────┐
                 │   Triage / routing agent   │  classifies question
                 │   (SLM-class model)          │  type + complexity
                 └────────────┬────────────────┘
                               │
              ┌────────────────┼────────────────────┐
              ▼ simple, in-scope                     ▼ complex / multi-
     ┌─────────────────────┐              condition / ambiguous
     │  Knowledge-answer      │              ┌─────────────────────┐
     │  agent (LLM-class)      │              │  Specialist reasoning │
     │  RAG-grounded on          │◄──A2A─────►│  agent (LLM-class,      │
     │  Meridian's docs             │  handoff  │  CoT-style prompting)   │
     └─────────────────────┘              └─────────────────────┘
              │                                          │
              └──────────────────┬───────────────────────┘
                                   ▼
                       Cited, grounded answer
                       returned to employee
```

**Reasoning behind this shape, walked through each design choice in
turn, below** — this diagram is not arbitrary; every arrow and every
model-size label follows directly from a Phase 0 requirement or a
Phase 1 finding.

## 3.4 Task 3.1, first bullet — model selection, worked properly

Recall the three independent axes: **size** (LLM vs. SLM), **hosting**
(self-hosted vs. SaaS), **licensing** (OSS vs. proprietary). Walk each
component of this system separately — don't default to one model
choice for the whole system.

### 3.4.1 The triage/routing agent — SLM

This agent's only job is classifying an incoming question by topic and
complexity (a narrow, well-defined, high-volume, latency-sensitive
task — every single employee question passes through it first, so its
latency directly sets a floor on the whole system's responsiveness).
Per the size-axis comparison table: this is the textbook **SLM** fit —
narrower reasoning is fine for a classification task, and the
cost/latency savings compound across every request in the system.

### 3.4.2 The knowledge-answer and specialist agents — LLM

Both of these agents perform open-ended reasoning over arbitrary
employee questions and, for the specialist agent specifically,
multi-condition eligibility-style reasoning (recall Phase 1's leave-
accrual example) — squarely the **LLM** fit per the same comparison
table.

### 3.4.3 Hosting and licensing — walking the rest of the decision tree

Meridian has no regulatory data-residency requirement forcing data to
stay off any SaaS provider's infrastructure, and no dedicated ML
infrastructure team to operate self-hosted serving. Per the decision
tree ("cost/latency OK with SaaS?" → yes for a company this size, with
this usage volume): **SaaS**, using **Gemini LLMs** for the LLM-class
agents. **Model Garden** (Google Cloud's model catalog, spanning both
Google and third-party/OSS options across the self-hosted/SaaS and
OSS/proprietary axes) is the tool the platform team would browse if
they later needed to compare or swap model options — worth naming even
though this capstone's constraints land on a straightforward SaaS
Gemini choice for now.

**Explicitly stating the counterfactual, because the exam tests this
kind of reasoning directly:** if Meridian instead handled regulated
data requiring full model-weight auditability and a hard requirement
that no prompt content ever leave company infrastructure, the correct
answer for every axis would flip — self-hosted, OSS, chosen by
capability need on the size axis independently of the hosting/
licensing decision. The point of walking the tree explicitly, every
time, is that the *same* system architecture (triage-then-route) can
land on entirely different model choices depending on constraints
that have nothing to do with the architecture itself.

### 3.4.4 Illustrative ADK scaffold

```python
from adk import Agent, ModelConfig

triage_agent = Agent(
    name="meridian-triage-agent",
    model=ModelConfig(
        provider="gemini",
        model_name="gemini-flash",  # SLM-class tier
        temperature=0.0,             # deterministic classification
    ),
    system_instructions=(
        "Classify the incoming employee question by topic "
        "(hr, it, engineering, safety, other) and by complexity "
        "(simple_lookup or multi_condition_reasoning). Respond "
        "with only the two labels."
    ),
)

knowledge_answer_agent = Agent(
    name="meridian-knowledge-answer-agent",
    model=ModelConfig(provider="gemini", model_name="gemini-pro"),
    system_instructions=(
        "Answer the employee's question using only the retrieved "
        "context provided to you. Cite the specific source "
        "document and section for every factual claim. If the "
        "retrieved context doesn't clearly support an answer, "
        "say so rather than guessing."
    ),
)

specialist_reasoning_agent = Agent(
    name="meridian-specialist-reasoning-agent",
    model=ModelConfig(provider="gemini", model_name="gemini-pro"),
    system_instructions=(
        "You handle multi-condition eligibility and policy "
        "questions. Think step by step through each relevant "
        "factor (e.g., tenure, leave history, employment-status "
        "changes) explicitly before stating a final answer. Cite "
        "the specific policy source for each factor you apply."
    ),
)
```

**Why the specialist agent's system instructions explicitly invoke
step-by-step reasoning:** this is **chain-of-thought prompting**,
applied in code now instead of a low-code console template — directly
addressing the exact gap Phase 1 (§1.4) surfaced. Note the
`temperature=0.0` choice for the triage agent specifically: a
classification task has one correct label per input, so minimizing
randomness is the right call, mirroring the same reasoning from Lab
03 §2.2 in this folder's per-section labs.

## 3.5 Task 3.1, third bullet — sessions and memory

Recall the distinction: a **managed session** holds state within one
ongoing interaction; **Agent Platform Memory Bank** holds state that
persists across separate interactions.

```python
from adk import Session, MemoryBank

session = Session.create(
    agent=knowledge_answer_agent,
    session_id="employee-4821-session",
)

response = session.send(
    "How many sick days do I get, and does it change once I hit "
    "3 years of tenure?"
)
# a follow-up in the SAME session doesn't need the tenure context
# re-stated — the session already holds it
followup = session.send("What about my accrued vacation?")

memory = MemoryBank(agent=knowledge_answer_agent)
memory.write(
    subject="employee:4821",
    fact="Frequently asks about tenure-based benefit tiers — "
         "consider proactively surfacing tenure-relevant policy "
         "sections in future answers.",
)
```

**Reasoning behind writing that specific fact to Memory Bank, and not
the full conversation transcript:** per the exam's own don't-use/use
guidance on Memory Bank — "don't store every turn of every
conversation indefinitely... selectively promote only meaningfully
durable facts" — the raw back-and-forth of this one session is
session-scoped noise; the *pattern* (this employee's questions tend to
be tenure-sensitive) is a genuinely useful, durable fact that could
improve a future, unrelated session months later. Applying the same
filtering judgment from Lab 03 §3.3 here: *would a future, unrelated
session meaningfully benefit from knowing this?* — yes for the
pattern, no for the verbatim transcript.

## 3.6 Task 3.1, fourth bullet — skills and agent-vs-human mode via Agents CLI

Recall this is the *build-time* counterpart to Phase 2's Agents CLI
mention — configuring a **custom** agent's skills and autonomy mode as
you build it.

```bash
agents-cli skills attach \
  --agent meridian-knowledge-answer-agent \
  --plugin internal-doc-lookup

agents-cli mode set \
  --agent meridian-specialist-reasoning-agent \
  --capability "doc_lookup" --mode agent \
  --capability "draft_policy_exception_summary" --mode human
```

**Reasoning:** `doc_lookup` is a read-only retrieval action — low
stakes, fully reversible, correctly configured as **agent mode**.
`draft_policy_exception_summary` (a hypothetical future capability
where the specialist agent would draft a written summary for HR to
review on a genuinely ambiguous eligibility case) has real
consequences if wrong — correctly configured as **human mode**, so a
person always reviews it before it's used. This is the same per-
capability, not-global, mode-configuration principle applied earlier
in this folder's labs, restated here at the point it first becomes
relevant to *this* project.

## 3.7 Task 3.2 — the RAG pipeline, built properly

This is where Phase 1's low-code Agent Search grounding gets replaced
by full programmatic control — the specific capability gap that
justified this entire phase.

### 3.7.1 Ingest and chunk

```python
from adk.rag import Chunker, load_documents

hr_docs = load_documents(source="gs://meridian-kb/hr-policies/")
it_docs = load_documents(source="gs://meridian-kb/it-runbooks/")
eng_docs = load_documents(source="gs://meridian-kb/eng-standards/")

chunker = Chunker(
    strategy="semantic",   # chunk on topic boundaries, not a
                            # fixed character count that could
                            # split a policy rule mid-sentence
    max_chunk_tokens=512,
)
chunks = chunker.split(hr_docs + it_docs + eng_docs)
```

**Why semantic chunking matters here specifically, with a concrete
Meridian example:** a fixed-size chunker could easily split "employees
accrue 10 sick days per year" from a following sentence containing an
important exception ("...except for employees on a probationary
period, who accrue 5") into two separate, disconnected chunks — a
retrieval that surfaces only the first chunk would ground the LLM on
an incomplete, misleading rule. Chunking on natural section boundaries
keeps each retrievable unit whole.

### 3.7.2 Embed consistently — the single most important warning in this phase

```python
from adk.rag import EmbeddingModel, VectorStore

embedding_model = EmbeddingModel(name="text-embedding-005")

vector_store = VectorStore.create(
    backend="vector-search-1.0",   # Vector Search 1.0 / Agent
                                    # Retrieval — the custom-code
                                    # vector database
    embedding_model=embedding_model,
)
vector_store.upsert(chunks)
```

**Restated deliberately, because it is the single most consequential
mistake this phase can make silently:** the embedding model used here,
at ingestion time, **must** be the exact same model used at query time
(§3.7.4). Mixing embedding models between ingestion and query
silently degrades retrieval quality — it does not throw an error, it
just quietly gets worse, which makes it far more dangerous than an
outright crash. If Meridian's platform team later "upgrades" to a
newer embedding model, the entire existing corpus must be re-embedded
with the new model, not left mixed.

### 3.7.3 Why Vector Search 1.0 / Agent Retrieval, not a general database

Meridian's knowledge content needs *semantic* similarity search — "find
content related in meaning to this question," not exact-match lookup.
A relational/document database (Cloud SQL, Firestore) isn't built for
nearest-neighbor vector search at RAG's core. (If Meridian's platform
later needed to look up a specific employee's exact HR record by
employee ID — a genuinely different access pattern — *that* would
correctly go through a structured database instead; the point is
matching the data-access pattern to the right service, not treating
one tool as universally superior.)

### 3.7.4 Query-time retrieval and reranking

```python
from adk.rag import Retriever, Reranker

retriever = Retriever(
    vector_store=vector_store,
    embedding_model=embedding_model,  # SAME model as §3.7.2
    top_k=20,
)
reranker = Reranker(model="semantic-reranker-001", top_n=5)

def retrieve_context(query: str):
    candidates = retriever.search(query)      # fast similarity
                                                # scoring (e.g.
                                                # cosine similarity)
    return reranker.rerank(query, candidates)[:5]  # slower,
                                                     # finer-grained
                                                     # re-scoring
```

**Should this pipeline use reranking? Yes — justify it explicitly,
the same way every other phase in this file justifies its decisions:**
Meridian's system answers HR/policy questions where citing the wrong
source is a real cost (an employee acting on an incorrectly cited
policy detail). That precision stake justifies reranking's added
latency/cost, per the exam's own don't-use/use framing. Contrast this
with a hypothetical low-stakes internal tool ("suggest three loosely
related wiki pages you might also find interesting") where skipping
reranking to save latency would be the right call instead.

### 3.7.5 Wire retrieval into the knowledge-answer and specialist agents

```python
def answer_question(session: Session, question: str):
    context_chunks = retrieve_context(question)
    grounded_prompt = (
        f"Employee question: {question}\n\n"
        f"Retrieved context:\n"
        + "\n---\n".join(c.text for c in context_chunks)
    )
    return session.send(grounded_prompt)
```

## 3.8 Task 3.2, second bullet — Agent Identity permissions

This is where Phase 0's stated data-sensitivity requirement (HR
content varying by role/department) finally gets a concrete,
code-level mechanism — recall from Phase 1 that Agent Search enforced
*existing* source permissions; now, building custom, this phase
defines the agent's own access scope explicitly.

```python
from adk import AgentIdentity

knowledge_answer_agent.identity = AgentIdentity(
    allowed_data_sources=[
        "gs://meridian-kb/hr-policies/general/",
        "gs://meridian-kb/it-runbooks/",
        "gs://meridian-kb/eng-standards/",
    ],
    denied_data_sources=[
        "gs://meridian-kb/hr-policies/compensation-bands/",
        "gs://meridian-kb/hr-policies/disciplinary-records/",
    ],
)
```

**Why an explicit deny list on the higher-sensitivity subpaths, not
just an allow list of everything else:** the same defense-in-depth
reasoning from this folder's per-section labs applies here concretely
— if a future engineer accidentally widens the allow-list glob pattern
(a realistic mistake as the document corpus grows and gets
reorganized), the explicit deny still blocks the two named
high-sensitivity subpaths. Full, formal PAB (principal access
boundary) policy configuration — the exam's more comprehensive
governance mechanism for this same underlying concern — is Phase 6's
job; this step introduces Agent Identity as the scoping mechanism
Phase 6 builds on.

## 3.9 Task 3.2, third bullet — Agent Registry

```python
from adk import AgentRegistry

AgentRegistry.register_capability(
    name="meridian-internal-kb-lookup",
    backing_service="vector-search-1.0",
    exposed_via="google-cloud-mcp-server",
    owner_agent=knowledge_answer_agent.name,
)

AgentRegistry.register_agent(
    name="meridian-knowledge-answer-agent",
    capabilities=["answer_grounded_question"],
)
AgentRegistry.register_agent(
    name="meridian-specialist-reasoning-agent",
    capabilities=["resolve_multi_condition_question"],
)
```

**Why register the knowledge-base lookup capability, not just build it
directly into one agent's code:** this is the exact anti-pattern
guard the exam names explicitly — avoiding "ad hoc, agent-specific
hard-coded tool integrations duplicated across every agent that needs
the same capability." Registering it once means the specialist agent
(§3.10 below) can discover and reuse the identical retrieval
capability instead of Meridian's platform team building and
maintaining a second, parallel RAG pipeline.

## 3.10 Task 3.3 — orchestration: MCP vs. A2A, and choosing the right topology

### 3.10.1 Restate the core distinction once more, in this project's own terms

**MCP** connects an agent to **tools/data sources** — you've used this
throughout this phase (the vector store, the wiki CMS integration from
Phase 2). **A2A (Agent2Agent)** connects one **agent to another
agent** — the triage-agent-to-specialist-agent handoff this system
needs is an A2A relationship, not an MCP one.

### 3.10.2 Build the A2A handoff

```python
from adk.a2a import A2AClient

a2a = A2AClient(
    calling_agent=knowledge_answer_agent,
    registry=AgentRegistry,
)

def route_question(question: str):
    triage_result = triage_agent.classify(question)  # topic +
                                                       # complexity
    if triage_result.complexity == "multi_condition_reasoning":
        return a2a.handoff(
            target_agent_name="meridian-specialist-reasoning-agent",
            task=f"Employee question: {question}\n"
                 f"Topic: {triage_result.topic}",
        )
    return answer_question(
        session=Session.create(agent=knowledge_answer_agent),
        question=question,
    )
```

**Why the specialist agent executes under its own Agent Identity, not
the knowledge-answer agent's:** the same least-privilege handoff
principle from this folder's per-section labs applies at full project
scale here — a handoff should never silently expand an agent's
effective access. Concretely for Meridian: even though the specialist
agent handles more sensitive, higher-stakes questions, it should
**not** automatically inherit any broader access the knowledge-answer
agent happens to have; each agent's `AgentIdentity` (§3.8) is defined
and scoped independently, matched to what that specific agent's task
actually requires.

### 3.10.3 Choosing the workflow topology — walked, not assumed

Recall the three topologies: **sequential**, **parallel**, **graph
workflow**. Meridian's overall flow — classify, then conditionally
route to either a direct answer or a specialist handoff — has a strict
ordering requirement for the first step (you cannot route before you
classify) but a genuinely conditional branch after it (the routing
decision depends on the triage result, an intermediate output not
known in advance). Per the exam's own don't-use/use guidance: this
rules out a purely sequential structure (which cannot express
conditional branching) and rules out parallel (there's no independent,
concurrent sub-task here — classification must complete before
anything else can happen). The correct characterization is a **graph
workflow with a sequential entry step** — the same composed-topology
pattern demonstrated in this folder's Lab 04, now applied to this
capstone's own system from first principles rather than borrowed
wholesale.

### 3.10.4 Add an agent policy against reasoning loops

```yaml
policies:
  - name: specialist-handoff-policy
    applies_to_edge: meridian-knowledge-answer-agent -> meridian-specialist-reasoning-agent
    constraints:
      max_handoffs_per_question: 1
      require_identity_scope_check: true
```

**Why this specific guard matters, connecting forward to Phase 4/5:**
without an explicit cap, a poorly bounded specialist agent could, in
principle, hand a question back toward the knowledge-answer agent (or
loop within its own reasoning) if its confidence stays low — exactly
the **agent reasoning loop** failure mode Phase 5's troubleshooting
content covers in depth. Building this guard now, at design time in
Phase 3, is cheaper and more reliable than trying to detect and patch
a live reasoning loop after the system is already in production.

## 3.11 Phase 3 self-check — before moving to evaluation

Before continuing to Phase 4, confirm you can trace, by hand, exactly
what happens to the specific employee question introduced in Phase 1
§1.4 ("18 months tenure, 6 weeks unpaid leave, contractor converting
to full-time — how much paid leave will I have accrued?") through
this phase's full architecture: which agent classifies it, why it
routes to the specialist path rather than the direct-answer path, what
retrieved context grounds the specialist agent's reasoning, and under
which agent's identity/permission scope that reasoning executes. If
any step of that trace is unclear, revisit the relevant section above
before proceeding — Phase 4's evaluation work assumes this
architecture is understood, not just built.

---

# PHASE 4 — Evaluate (Section 4, evaluation half of ~22%)

## 4.1 Why evaluation is its own phase, not a final checkbox

Recall the exam's own framing: evaluation isn't a one-time pre-launch
gate — it's continuous, and production monitoring (Phase 5) feeds
signals back into it. This phase builds the test set and evaluation
pipeline; Phase 5 is where you'll see that feedback loop actually
close.

## 4.2 Build the test set — golden data, prompts, edge cases

### 4.2.1 Golden data, drawn from this project's own history

```python
golden_data = [
    {
        "input": "How many sick days do I get per year?",
        "expected_topic": "hr",
        "expected_complexity": "simple_lookup",
        "expected_route": "meridian-knowledge-answer-agent",
        "expected_citation_contains": "Employee Handbook",
    },
    {
        # the EXACT question that surfaced Phase 1's gap
        "input": "I've been at Meridian for 18 months, took "
                 "unpaid leave for 6 weeks last year, and I'm a "
                 "contractor converting to full-time next month "
                 "— how much paid leave will I have accrued by "
                 "end of year?",
        "expected_topic": "hr",
        "expected_complexity": "multi_condition_reasoning",
        "expected_route": "meridian-specialist-reasoning-agent",
    },
]
```

**Why the second row is exactly Phase 1's original failing question,
not a freshly invented one:** this is a deliberate, realistic practice
— a genuine gap discovered during earlier development is exactly the
kind of case that most belongs in a regression test set, so the fix
(Phase 3's specialist-routing architecture) is continuously verified
to keep working, rather than trusted once and never re-checked.

### 4.2.2 Representative prompts and edge cases

```python
representative_prompts = [
    "What's the process for requesting a laptop replacement?",
    "Which runbook covers a failed nightly deployment?",
    "Can I work remotely full-time?",
]

edge_cases = [
    {
        "input": "sick days sick days sick days???",
        "why": "malformed/garbled input — does the triage agent "
               "still classify sensibly, or does downstream "
               "retrieval fail ungracefully?",
    },
    {
        "input": "How many sick days do I get, and also is it "
                 "true the company's being acquired?",
        "why": "a compound message mixing an in-scope factual "
               "question with an out-of-scope, sensitive rumor — "
               "does the system answer the first part correctly "
               "while declining the second, rather than getting "
               "confused by both?",
    },
    {
        "input": "What's my exact salary and my manager's exact "
                 "salary?",
        "why": "directly probes the Agent Identity deny-list "
               "(§3.8) — the system must decline, not retrieve "
               "compensation-band content it's explicitly scoped "
               "away from.",
    },
]
```

**Why the third edge case matters more than it might first appear:**
this isn't just a generic "does it handle a weird input" check — it's
a direct functional test of the *security* boundary configured in
Phase 3 §3.8. A test set that never exercises the deny-listed content
path would never actually verify that boundary works, as opposed to
merely being configured and assumed to work.

## 4.3 Choose the evaluation framework and tooling for each need

Recall the three named tools and their distinct fits, and — matching
this file's own established practice throughout — walk why each one
is used here specifically, not just listed.

### 4.3.1 ADK evaluation tooling (evalset) — trajectory correctness

```python
from adk.eval import EvalSet, run_eval

evalset = EvalSet(name="meridian-routing-trajectory-eval", cases=golden_data)
results = run_eval(agent=knowledge_answer_agent, evalset=evalset, check="trajectory")

for r in results:
    if r.actual_route != r.expected_route:
        print(f"ROUTING MISMATCH on '{r.input}': "
              f"expected {r.expected_route}, got {r.actual_route}")
```

**Why trajectory checking is the right tool for exactly this check:**
the golden-data row for the multi-condition question (§4.2.1) expects
routing to the specialist agent. If Phase 3's triage classification
logic had a subtle bug (e.g., a threshold that only fires on
*exactly* 3+ interacting conditions, silently misrouting a 2-condition
case that should still have escalated), the knowledge-answer agent
might still produce a plausible-sounding — but under-reasoned and
possibly wrong — response, without ever calling the specialist path.
A response-quality-only check could easily miss this; trajectory
checking, which asserts on the actual routing decision made, catches
it directly.

### 4.3.2 Agent Platform Gen AI evaluation service — response and retrieval quality, scored separately

```python
from adk.eval import GenAIEvalService

genai_eval = GenAIEvalService(
    agent=knowledge_answer_agent,
    golden_data=golden_data,
    metrics=["response_quality", "retrieval_quality"],
)
report = genai_eval.run()
```

**Restating why these must be two separate scores, applied to this
project's own diagnostic value:** if `retrieval_quality_score` comes
back low while `response_quality_score` looks fine, that specifically
points at Phase 3's chunking/embedding/reranking configuration
(§3.7) — a fix there, not a prompt-instruction fix. If the reverse is
true, the fix is in how the knowledge-answer or specialist agent
reasons over correctly retrieved content — a completely different part
of the system to investigate. A single blended score would leave you
guessing which half of the system actually needs the fix.

### 4.3.3 A custom autorater — for Meridian's own nuanced criterion

Meridian's HR team has a specific, non-generic requirement: answers
touching sensitive topics (leave, disciplinary policy, compensation)
must include a pointer to the actual HR contact for follow-up, not
just a bare factual answer — a criterion neither of the two tools
above scores directly.

```python
from adk.eval import CustomAutorater

hr_pointer_autorater = CustomAutorater(
    name="hr-contact-pointer-check",
    judge_model="gemini-pro",
    rubric=(
        "Score 1-5: for responses touching HR-sensitive topics "
        "(leave, disciplinary policy, compensation), does the "
        "response include a pointer to contact HR directly for "
        "specifics? 5 = clear pointer included, "
        "1 = no pointer, purely factual response only."
    ),
)
```

**Why build this only after the first two tools, not first:** per the
exam's own don't-use/use guidance — reach for a custom autorater
specifically for the gap the managed/structured tools don't cover, not
as a default first choice. Meridian's team confirmed (by trying the
Gen AI evaluation service's built-in `response_quality` metric first)
that it does not specifically score for an HR-contact pointer — a
genuinely nuanced, organization-specific criterion, which is exactly
the trigger condition for reaching for a custom autorater.

## 4.4 Set up continuous evaluation

```yaml
trigger:
  on_change: ["agent_config/**", "prompts/**", "skills/**"]
  on_schedule: "daily"
steps:
  - run: adk-eval trajectory --evalset meridian-routing-trajectory-eval
  - run: adk-eval genai-quality --metrics response_quality,retrieval_quality
  - run: adk-eval custom hr-contact-pointer-check
  - report: fail_build_on_regression
```

**Why both trigger types matter for this specific project:** a
change-triggered run catches a regression the moment a platform-team
engineer edits the triage agent's classification prompt or the
reranker's `top_n` value. A scheduled daily run catches something
change-triggered evaluation cannot: Meridian's HR policy documents get
updated periodically by the HR team directly in the source
repository, entirely outside the platform team's own code changes —
if the ingestion pipeline (Phase 2) doesn't get re-run promptly, the
RAG pipeline's grounding content silently goes stale relative to the
real current policy, a drift-shaped problem invisible to a purely
change-triggered check.

## 4.5 What Phase 4 established

A concrete, checkable answer to Phase 0's success-criteria requirement
(§0.3.5) — the golden-data accuracy bar is now measurable, not
aspirational — and an evaluation pipeline that will keep answering
that question on an ongoing basis once the system is live, which is
exactly what Phase 5 needs in place before deployment.

---

# PHASE 5 — Deploy & operate (Section 4, deployment half of ~22%)

## 5.1 Select the deployment runtime — walk the decision, don't default

Recall the three-way comparison: **Agent Runtime** (formerly Agent
Engine — use the current name), **Cloud Run**, **GKE**.

Meridian's platform team has no existing GKE standardization (recall
Phase 2's same finding when choosing a coding-agent sandbox), no need
for exotic infrastructure control, and — critically — this system
*specifically* uses managed sessions, Memory Bank, and a multi-agent
A2A handoff (Phase 3), all of which are exactly the agent-native
platform features the decision tree names as the deciding factor
favoring the purpose-built runtime over a general-purpose one. **Use
Agent Runtime.**

**Explicitly ruling out the alternatives, not just picking the
winner:** Cloud Run would mean Meridian's platform team re-building
session/memory management themselves on top of a general-purpose
container platform — unnecessary given Agent Runtime already provides
it natively. GKE would mean taking on cluster/node-topology
operational overhead this small platform team doesn't have the
capacity to justify, for infrastructure control this system's
requirements don't actually call for.

```bash
agent-runtime deploy \
  --workflow ./meridian-knowledge-platform-workflow.yaml \
  --runtime agent-runtime \
  --region us-central1 \
  --observability cloud-logging,cloud-trace
```

**Why `--observability` is not optional, restated at the point it
actually matters most:** Google Cloud Observability (Cloud Logging and
Cloud Trace) is what makes every diagnostic step in §5.3 below
possible at all — deploying without it means debugging a live incident
blind, with no structured record of what the system actually did.

## 5.2 Agents CLI — operating the now-deployed agent

Recall Phase 2 and Phase 3 both *introduced* Agents CLI conceptually
without yet using it for real operational work — this is that point.

```bash
agents-cli scale set --workflow meridian-knowledge-platform-workflow --min-instances 1 --max-instances 10
agents-cli govern apply --workflow meridian-knowledge-platform-workflow --policy specialist-handoff-policy
agents-cli optimize report --workflow meridian-knowledge-platform-workflow --window 7d
```

**Why `min-instances 1`, not 0:** recall Phase 0's latency requirement
(§0.3.2) — a chat-like, few-second response target. Scaling to zero
idle instances (a reasonable choice for a bursty, latency-tolerant
batch workload) would mean the *first* request after any idle period
pays a cold-start latency penalty, directly working against the
stated requirement. Keeping a minimum of one warm instance trades a
small amount of always-on cost for consistently meeting the latency
target — a concrete example of "considering... cost" (an explicit
qualifier in the exam's own model-selection task bullet, and a
reasoning instinct that applies just as much to deployment
configuration).

## 5.3 Troubleshoot — walk all four named failure modes against this specific project

Recall the four failure modes and their distinct diagnostic
signatures: **drift**, **tool invocation latency**, **agent reasoning
loops**, **system failures**. Practice matching symptom to category
for this project specifically, not generically.

### 5.3.1 "Answers about IT runbooks have been getting subtly worse over the past month"

**Classification: drift**, not a reasoning loop or an outright
failure — gradual degradation, no single triggering event.

**Diagnosis, specific to this project:** check whether the IT team has
been updating runbooks faster than the nightly ingestion pipeline
(Phase 2) processes them, or whether an underlying Gemini model
version was updated upstream without an announced change on Meridian's
side. Re-run the Phase 4 golden-data evalset against the *currently
deployed* agent and compare scores against the last known-good run —
if `retrieval_quality_score` specifically has dropped, that points at
stale ingestion; if `response_quality_score` alone has dropped with
retrieval still scoring well, that points at a model-behavior shift
instead.

### 5.3.2 "The specialist-agent handoff is taking noticeably longer than it used to"

**Classification: tool invocation latency** — a symptom localized to
one specific point in the pipeline.

**Diagnosis:** use Cloud Trace to see whether the A2A handoff call
itself is slow, or whether the specialist agent's own retrieval step
(after receiving the handoff) is the actual bottleneck — a meaningfully
different fix depending on which span dominates.

### 5.3.3 "Some complex questions never return an answer — they just seem to hang"

**Classification: agent reasoning loop** — the textbook signature.

**Diagnosis:** first check whether Phase 3's `max_handoffs_per_question:
1` policy is actually being enforced (a policy that exists on paper
but isn't correctly wired into the deployed workflow config is a
realistic and embarrassing gap to discover here) — and if the policy
*is* correctly enforced but the hang persists, the loop is likely
inside the specialist agent's own internal reasoning rather than at
the handoff boundary, which points at needing an explicit termination
condition in that agent's own control logic (e.g., "after attempting
to resolve the same sub-question twice without new information, return
a partial answer and flag for human follow-up" — a natural bridge into
Phase 6's HITL content).

### 5.3.4 "Requests are returning outright errors"

**Classification: system failure.**

**Diagnosis:** check Cloud Logging for the actual error — most likely
a crashed ingestion dependency, a Vector Search 1.0 connectivity issue,
or a misconfigured deployment parameter — the most straightforward
category precisely because it fails loudly.

## 5.4 Monitor for logic errors and hallucinations specifically

Recall the two additional named things to identify through ongoing
monitoring, distinct from the four failure-mode categories above:
**logic errors** (a flaw in the agent's own decision/control flow —
e.g., a bug in the triage agent's complexity threshold that
consistently under-routes borderline multi-condition questions to the
simple path) and **hallucinations** (confident but unsupported output).
For hallucination detection specifically in this project: check
whether every citation the knowledge-answer or specialist agent
produces actually matches content that was genuinely retrieved for
that request — a citation naming a document section that wasn't in
the retrieved context at all is a concrete, checkable hallucination
signal, not a subjective judgment call.

## 5.5 Close the loop back to Phase 4

Every diagnosis in §5.3–5.4 above ends the same way: a production
finding gets translated into a new golden-data row or edge case fed
back into Phase 4's evalset (a drift-caused stale-content case, a
reasoning-loop-prone question pattern, a hallucination-triggering
retrieval gap), so the continuous evaluation pipeline (Phase 4 §4.4)
catches a recurrence of the same issue automatically going forward.
This is the bidirectional relationship the exam's own Section 4
framing describes — production monitoring and evaluation are not two
separate, one-directional activities; they are a closed loop, and this
capstone's Phase 4/5 split is written specifically so you can see both
halves and the connection between them explicitly.

---

# PHASE 6 — Secure & govern (Section 5, ~15%)

## 6.1 What this phase adds, and what it deliberately does not touch

Consistent with the exam's own framing (echoed in this folder's Lab
06): this phase does not modify the triage, knowledge-answer, or
specialist agents' core logic built in Phase 3 — it wraps governance
and security controls **around** what's already built and deployed.

## 6.2 OAuth 2.0 agent-to-tool authentication via Auth Manager

Recall the specific application: OAuth 2.0 for **agent-to-tool** API
calls, distinct from general OAuth vocabulary you're assumed to
already know.

```python
from adk.auth import AuthManager, OAuthScope

wiki_tool_auth = AuthManager.configure(
    agent=knowledge_answer_agent,
    tool="wiki-cms-api",
    flow="oauth2_client_credentials",
    scopes=[OAuthScope("wiki:read")],  # NOT wiki:write or
                                        # wiki:admin — this agent
                                        # only ever needs to read
    token_lifetime_seconds=900,
)
```

**Reasoning:** the knowledge-answer agent has no legitimate need to
*write* to the wiki — it only retrieves content. Scoping the token to
`wiki:read` alone means that even in a worst-case scenario where the
token were somehow exposed, it could not be used to modify or delete
wiki content. Combined with the short 15-minute lifetime, this limits
both *what* a compromised credential could do and *how long* it would
remain usable — the same two-dimensional defense-in-depth reasoning
applied throughout this folder's Lab 06.

## 6.3 PAB policies via Agent Identity, formalized for all three agents

Recall: **PAB (principal access boundary)**, configured via **Agent
Identity**, is a specific, agent-focused *boundary* mechanism — not a
generic IAM role. It caps the maximum scope an agent can ever reach,
regardless of any other permission grant. Phase 3 §3.8 introduced
Agent Identity's data-source scoping for the knowledge-answer agent;
this phase formalizes full PAB policies across the whole system.

```python
from adk.identity import PABPolicy

triage_pab = PABPolicy(
    agent=triage_agent,
    max_data_sources=[],       # the triage agent never touches
                                # retrieved content directly — it
                                # only classifies the raw question
    max_tools=[],
    max_actions=["classify"],
)

knowledge_answer_pab = PABPolicy(
    agent=knowledge_answer_agent,
    max_data_sources=[
        "gs://meridian-kb/hr-policies/general/",
        "gs://meridian-kb/it-runbooks/",
        "gs://meridian-kb/eng-standards/",
    ],
    max_tools=["wiki-cms-api", "meridian-internal-kb-lookup"],
    max_actions=["answer_grounded_question"],
)

specialist_pab = PABPolicy(
    agent=specialist_reasoning_agent,
    max_data_sources=[
        "gs://meridian-kb/hr-policies/general/",
        # deliberately still excludes compensation-bands and
        # disciplinary-records, per Phase 3 §3.8's deny list —
        # the specialist agent handles MORE COMPLEX questions,
        # not MORE SENSITIVE data than it's scoped for
    ],
    max_tools=["meridian-internal-kb-lookup"],
    max_actions=["resolve_multi_condition_question"],
)
```

**Why the triage agent's PAB policy has empty `max_data_sources` and
`max_tools` lists — worth pausing on, because it's easy to
under-think:** the triage agent's entire job is classifying a raw
question string — it never needs to touch retrieved document content
or call the knowledge-base lookup tool at all. Giving it an empty
boundary isn't an oversight or a placeholder; it's the *correct*,
maximally tight scope for what this specific agent actually does —
the clearest possible illustration in this whole capstone of
least-privilege as a real design discipline rather than an abstract
principle: every agent's boundary should be as narrow as its actual
job allows, evaluated per agent, not copied from a template.

**Why the specialist agent's PAB explicitly does not gain access to
the higher-sensitivity HR subpaths, even though it handles the
system's most complex questions:** this is a genuinely important,
easy-to-get-wrong distinction worth stating plainly: **handling more
complex questions is not the same requirement as needing access to
more sensitive data.** The specialist agent's job is reasoning through
more *conditions* (tenure, leave history, status changes) using the
*same* general-policy content the knowledge-answer agent already has
access to — nothing in Phase 0's requirements ever asked the
specialist agent to see compensation or disciplinary records. Widening
its PAB "because it's the more advanced agent" would be exactly the
kind of unjustified privilege expansion this whole governance phase
exists to prevent.

## 6.4 Agent Gateway — traffic monitoring across the whole deployed workflow

```python
from adk.gateway import AgentGateway

gateway = AgentGateway.configure(
    agents=[triage_agent, knowledge_answer_agent, specialist_reasoning_agent],
    log_destination="cloud-logging",
    anomaly_detection=True,
    alert_on=[
        "call_volume_spike",
        "unexpected_destination",
        "pab_boundary_denial",
    ],
)
```

**Why `pab_boundary_denial` alerts matter concretely for this
project:** if Agent Gateway ever logs a PAB denial against the
knowledge-answer agent attempting to reach the compensation-bands
subpath, that's a meaningful signal even though the denial "worked" —
it likely means either a retrieval-pipeline bug is constructing an
unexpectedly broad query, or (more concerning) something is probing
for access it shouldn't have. Agent Gateway is what makes that event
visible at all; PAB alone would have silently blocked it with no
record for a human to notice the pattern.

## 6.5 Agent Registry and Skill Registry as governance controls

Recall Phase 3 registered agents and capabilities purely for
discovery/reuse. This phase adds the governance layer on top:

```python
from adk import AgentRegistry
from adk.skills import SkillRegistry

AgentRegistry.set_registration_policy(
    require_review=True,
    reviewers=["platform-security-team"],
)

SkillRegistry.set_vetting_policy(
    require_review=True,
    reviewers=["platform-security-team"],
)
```

**Why both registries need a review policy, not just Agent Registry:**
recall Phase 2's ingestion-conventions skill (§2.4) — a skill this
capstone already built. Skills shape agent *behavior* directly (recall
the specialist agent's chain-of-thought instructions and the
ingestion pipeline's source-restriction rule); an unvetted, freely
registered skill could just as easily introduce a governance gap as an
unvetted tool integration could — e.g., a well-intentioned but
insufficiently reviewed skill that relaxes the approved-sources
restriction from Phase 2 §2.4's rule 2 without anyone catching it.
Requiring review for both registries closes this gap symmetrically.

## 6.6 Model Armor and Sensitive Data Protection — two distinct guardrail categories

```python
from adk.safety import ModelArmor, SensitiveDataProtection

model_armor = ModelArmor.configure(
    agents=[knowledge_answer_agent, specialist_reasoning_agent],
    screen_inputs=True,   # catches prompt-injection-style content
                           # that could be hidden inside an
                           # ingested document (Phase 2/3) and
                           # later retrieved as "context"
    screen_outputs=True,
    policy="enterprise-internal-default",
)

sdp = SensitiveDataProtection.configure(
    agents=[knowledge_answer_agent, specialist_reasoning_agent],
    detect=["email", "employee_id", "ssn"],
    action="redact_before_logging",
)
```

**Why input screening matters specifically for this RAG-grounded
system, restated at the point it applies most concretely:** Meridian's
ingestion pipeline (Phase 2) pulls content from a wiki that any
employee with edit access can modify. If a malicious or careless wiki
edit ever introduced hidden instructions into a page that later gets
ingested, chunked, embedded, and retrieved as "context" for a
completely unrelated employee's question, that injected content would
reach the LLM as part of its grounding context — this is exactly the
retrieved-content injection risk Model Armor's input-side screening
exists to catch, and it's a real, concrete risk in *this* project's
specific architecture (an internally-editable wiki as a source), not
just an abstract textbook scenario.

**Why Sensitive Data Protection is a separate, additional control, not
covered by Model Armor:** an employee's genuine, legitimate support
question ("what's my accrued leave, my employee ID is 4821") contains
a real employee ID — not unsafe *content* in Model Armor's sense at
all, but still data that shouldn't sit in plaintext in a shared
application log a broader set of engineers can read. Configuring only
Model Armor would leave this specific, different risk category
completely unaddressed.

## 6.7 HITL gate — classify this project's own actions

Recall Phase 0 §0.3.1's explicit scope boundary: this system does not
take real-world actions on an employee's behalf — it answers and, at
most, drafts. Walk the action table for what this specific system
actually does:

| Action | Reversible? | Stakes | HITL required? |
|---|---|---|---|
| `answer_grounded_question` | Yes (advisory only) | Low-medium | No |
| `resolve_multi_condition_question` | Yes (advisory only) | Medium | No |
| `draft_policy_exception_summary` (hypothetical future capability, named in Phase 3 §3.6) | Partially (a human still reviews before acting on it) | High | **Yes** |

```python
from adk.safety import HITLGate

hitl = HITLGate.configure(
    agent=specialist_reasoning_agent,
    gated_actions=["draft_policy_exception_summary"],
    approval_channel="hr-team-review-queue",
    timeout_behavior="hold_and_notify",
)
```

**Why most of this system's actual actions do *not* need a HITL gate,
and why that's the correct conclusion, not an oversight:** this is
worth stating plainly because it's easy to over-apply HITL out of
excess caution. Per the exam's own don't-use/use guidance — applying
HITL to every action indiscriminately eliminates the efficiency
benefit of autonomy and doesn't scale. Because Phase 0 deliberately
scoped this system as advisory-only (no direct HR-record modification,
no transaction execution), the vast majority of its actions are
low-stakes and fully reversible by design — the *architecture itself*,
decided in Phase 0, is what keeps this system's HITL surface small,
not a governance gap. The one gated action (`draft_policy_exception_
summary`) is gated specifically because it's the one capability that
approaches the advisory/action boundary closely enough to warrant a
human checkpoint before its output gets used.

## 6.8 Identity propagation across the full multi-hop system

```python
from adk.identity import propagate_identity

@propagate_identity(bounded_by="pab_policy")
def handle_employee_question(question: str):
    triage_result = triage_agent.classify(question)
    if triage_result.complexity == "multi_condition_reasoning":
        return a2a.handoff(
            target_agent_name="meridian-specialist-reasoning-agent",
            task=question,
        )
    return answer_question(
        session=Session.create(agent=knowledge_answer_agent),
        question=question,
    )
```

**The synthesis point for this entire phase, stated once, plainly:**
at every hop in this system — triage classifying a question, the
knowledge-answer agent retrieving and citing content, an A2A handoff
to the specialist agent, that agent's own retrieval call — the
effective access at that hop is the *intersection* of what the
original request carried and that specific agent's own PAB boundary,
**never the union of the two, and never expanded** just because a
later agent in the chain happens to handle more complex questions.
This single sentence is what makes every other control built in this
phase (OAuth scoping, PAB policies, Agent Gateway visibility, Model
Armor/Sensitive Data Protection screening, the HITL gate) work
together as one coherent system rather than a checklist of unrelated
add-ons.

---

# PHASE 7 — Retrospective and best practices

## 7.1 What this phase is for

A retrospective is a structured look back at a completed (or
completed-enough) project: what worked, what a real team would do
differently, and what general lessons carry forward to the *next*
project. This phase deliberately closes the loop back to Phase 0 —
checking the finished system against the requirements stated at the
very start — and maps common pitfalls back to this folder's own
currency-corrections table (`00-START-HERE/RUNBOOK.md` §7), since
those corrections are, in a real sense, the exam's own accumulated
list of places candidates most often get tripped up.

## 7.2 Checking the finished system against Phase 0's requirements

- **Functional (§0.3.1):** grounded, cited Q&A — delivered in Phase 1,
  refined in Phase 3. Multi-condition reasoning and specialist
  routing — delivered in Phase 3, verified in Phase 4. Advisory-only
  scope (no direct actions) — held throughout; Phase 6's HITL analysis
  (§6.7) confirmed this architectural choice is what kept the security
  surface small, a direct, traceable payoff of a Phase 0 decision.
- **Non-functional (§0.3.2):** latency — addressed by the SLM triage
  agent (Phase 3) and the `min-instances 1` deployment choice (Phase
  5), not left to chance.
- **Data (§0.3.3):** the onboarding-video ingestion gap, explicitly
  deferred in Phase 1 §1.2.4, was never silently forgotten — it's
  visible right here as an honestly tracked, still-open item, which is
  itself a best practice worth naming: an honest retrospective
  surfaces deferred scope explicitly, rather than either quietly
  dropping it or claiming false completeness.
- **Constraint (§0.3.4):** cost/timeline were honored by the phased
  build order itself (cheap low-code MVP before expensive custom
  code); security was honored by Phase 6's PAB/Agent Identity scoping,
  directly traceable back to the data-sensitivity requirement stated
  on day one.
- **Success criteria (§0.3.5):** made concrete and checkable by Phase
  4's golden dataset and continuous evaluation pipeline — not an
  aspiration, an actual measured bar.

## 7.3 What a real team would likely do differently next time

- **Start the onboarding-video ingestion work earlier**, even as a
  small parallel workstream during Phase 2, rather than leaving it
  fully deferred through the entire build — the requirement was known
  from Phase 0; deferring it was the right MVP-scoping call, but a
  real team would want a concrete re-visit date, not an open-ended
  "later."
- **Write the Phase 6 PAB policies earlier**, ideally alongside Phase
  3's Agent Identity scoping rather than as a distinct later phase —
  this capstone deliberately followed the exam's own section ordering
  for teaching clarity, but a real production build would likely
  define an agent's full permission boundary at the same time its
  data-access scope is first defined, so security is never a
  bolt-on retrofit.
- **Involve the HR team in defining the Phase 4 custom autorater's
  rubric from the start**, rather than the platform team inferring the
  "must point to an HR contact" criterion after initial evaluation
  runs — a lesson about who should define domain-specific evaluation
  criteria, not just who builds the tooling that scores them.

## 7.4 Common pitfalls, mapped explicitly to this folder's currency corrections

Restated here, at the end of the single longest file in this folder,
because this is exactly the kind of mistake a real candidate is most
likely to still be carrying into the actual exam:

| Pitfall this capstone deliberately avoided | The currency correction it maps to |
|---|---|
| Calling the deployment target "Agent Engine" anywhere in Phase 5/3.10 | Say **Agent Runtime** — "Agent Engine" is only the historical name, named as such once when flagging the rename, never used as the primary term. |
| Calling Phase 1's grounding connector "Vertex AI Search" | Say **Agent Search** — the guide's own current name. |
| Calling Phase 1's platform "Vertex AI Agent Builder" | That branding never appears in the guide — the correct name is **Gemini Enterprise**, with Agent Designer / CX Agent Studio as its builder tools. |
| Naming "Gemini Code Assist" as Phase 2's coding-agent tool | The guide names **Antigravity** and **Claude Code on Google Cloud** explicitly — Gemini Code Assist appears nowhere in the guide. |
| Treating Phase 6's PAB as a generic IAM concept | **PAB (principal access boundary)** is a specific mechanism configured via **Agent Identity** — a boundary, not a role grant. |
| Describing Phase 3's ADK as closed-source | ADK is explicitly **open-source** per the guide — stated three separate times across Phases 3, and worth a fourth restatement here because it is one of the most heavily emphasized corrections in this whole folder. |
| Assuming this capstone's scope overlaps with generic GCP architecture (raw compute/storage/networking selection) | This capstone deliberately never made a generic "which VM type" or "which storage class" decision unrelated to agents — every data-layer service choice (Vector Search 1.0 vs. Cloud SQL, Phase 3 §3.7.3) was made specifically through an agentic-workflow lens, consistent with this exam's actual scope. |

## 7.5 The one-paragraph synthesis

If you take exactly one thing from this entire capstone into the
actual exam, make it this: **every tool named across all five exam
sections exists to answer one specific question, at one specific point
in a system's lifecycle, and the exam's scenario questions are
constructed by describing a situation and expecting you to identify
which specific question is actually being asked** — not to recall a
tool's name in isolation. This capstone built one continuous system
specifically so that every tool's "specific question" could be shown
answering a real, traceable need in that one system, rather than as an
disconnected list of definitions to memorize.

---

## Final self-check — before you consider this capstone complete

Work through this list honestly, the same way each per-section lab's
self-check asked you to. If any box is unclear, the relevant phase
above is where to go back and re-read, not the domain files alone —
this capstone was built specifically so each concept is anchored to a
concrete decision in Meridian's system, not just an abstract
definition.

- [ ] I can explain why Phase 0 came before any tool was opened, and
      trace at least three later-phase decisions directly back to a
      specific Phase 0 requirement.
- [ ] I can explain why the MVP used Agent Designer, not CX Agent
      Studio, and what concrete gap the MVP surfaced that justified
      Phase 3.
- [ ] I can explain the difference between a coding agent (Phase 2)
      and a custom runtime agent (Phase 3), using this project's own
      agents as the example on each side.
- [ ] I can walk the full three-axis model-selection decision for
      each of this project's three agents (triage, knowledge-answer,
      specialist) and explain why they land on different choices.
- [ ] I can explain every stage of this project's RAG pipeline in
      order, and state from memory why the embedding-model-consistency
      rule is the single most dangerous silent failure mode in the
      whole pipeline.
- [ ] I can explain why this project's workflow is a graph workflow
      with a sequential entry step, not a pure sequential or pure
      parallel topology.
- [ ] I can explain the difference between ADK evalset (trajectory),
      the Gen AI evaluation service (response/retrieval quality), and
      a custom autorater, using this project's own three evaluation
      needs as the example of each.
- [ ] I can name all four production failure-mode categories and
      match each to its diagnostic signature using this project's own
      four worked incident scenarios.
- [ ] I can explain why this project's triage agent has an
      *intentionally empty* PAB policy, and why that's correct rather
      than incomplete.
- [ ] I can explain why the specialist agent's greater task complexity
      did not justify greater data access — and restate, in my own
      words, why that distinction is one of the most important ideas
      in this entire capstone.
- [ ] I can explain why most of this project's actions did not need a
      HITL gate, and why that outcome traces back to a Phase 0
      architectural decision rather than a Phase 6 oversight.
- [ ] I can state, without looking it up, the current correct name for
      every renamed tool this capstone used (Agent Runtime, Agent
      Search, Gemini Enterprise, Antigravity/Claude Code on Google
      Cloud, ADK as open-source, PAB via Agent Identity).
