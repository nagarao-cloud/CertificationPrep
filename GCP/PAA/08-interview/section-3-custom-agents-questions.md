# Section 3 Deep-Dive Questions — Developing Custom Agents

> **What this file is.** 33 questions devoted entirely to **Section 3,
> "Developing custom agents"** — at ~33% of the exam, the single
> heaviest section, and the one this folder's `CLAUDE.md` §3 calls out
> for the deepest treatment of any content in this repository. Where
> `agentic-architect-scenario-questions.md` spreads its coverage across
> all five exam sections and `behavioral-and-tradeoff-questions.md`
> tests judgment under pressure, this file drills into **one section**
> at system-design depth: model selection, ADK, sessions/memory, RAG
> pipelines, permissions, capability registration, and multi-agent
> orchestration — task 3.1, 3.2, and 3.3, in that order, 11 questions
> each.
>
> **Why this section gets its own file.** A real interview for this
> role — and the real exam's own item distribution — spends roughly a
> third of its weight here, and scenario questions at this depth rarely
> test one concept in isolation. They hand you a system with several
> moving parts and expect you to reason about model choice, retrieval
> design, permission scoping, and orchestration shape *together*, the
> way an actual production agentic system forces all four to interact.
> Eleven of the questions below are explicit system-design or
> diagnose-a-failing-system prompts for exactly that reason — the kind
> where "name the right tool" isn't enough; you have to justify why it's
> right for *this* combination of constraints and reject a plausible
> alternative.
>
> **How to use this file.** Same discipline as the other two files in
> this folder: attempt an answer — out loud or in writing — before
> reading the model answer. Every scenario here is original to this
> file; none reuse the Meridian Tools capstone or any scenario from
> `agentic-architect-scenario-questions.md` or
> `behavioral-and-tradeoff-questions.md`, though the underlying reasoning
> patterns are the same ones taught in `01-domains/SECTION-3-custom-agents.md`,
> the `03-comparisons/` decision matrices, and the two Section-3
> `04-architectures/` patterns (`pattern-custom-multi-agent-adk.md`,
> `pattern-multi-agent-a2a-mcp-orchestration.md`) — go there for the full
> reference tables and ASCII diagrams this file applies to new scenarios
> rather than repeats.
>
> **Currency note.** Every answer below uses **Agent Runtime** (never
> Agent Engine, except to name the rename itself), **Agent Search**
> (Section 1's low-code grounding connector) held distinct from
> **Vector Search 1.0 / Agent Retrieval** (this section's custom-code
> vector-retrieval layer), **ADK as explicitly open-source**, and
> **PAB (principal access boundary) as a mechanism configured via Agent
> Identity**, never a generic IAM synonym. See `../CLAUDE.md` §7 for the
> full corrections table.

---

## 3.1 Designing and building agentic workflows in code (11 questions)

### Q1. "A returns-processing agent for a mid-size logistics company handles two jobs: extracting the stated return reason from a customer's free-text message, and drafting a personalized approval-or-denial email. The company processes on the order of a million returns a month. Design the model strategy and defend the cost math to the ops director."

**What's really being asked.** Task 3.1's first bullet frames model
selection as a per-task decision made against cost, security, and
architecture — this checks whether a candidate treats "a million
returns a month" as a real constraint that changes the right answer,
not a detail to skim past.

```
   Customer return message (free text)
              │
              ▼
   ┌─────────────────────────┐
   │  SLM: reason classifier    │   fast, cheap, high-volume
   │  (return-reason label)       │   (~1M requests/month)
   └─────────────┬─────────────┘
                 │ label + original message
                 ▼
   ┌─────────────────────────┐
   │  LLM: approval/denial        │   slower, costlier — but only
   │  email-drafting agent           │   pays off on customer-visible
   └─────────────┬─────────────┘   output
                 ▼
     Personalized email sent to customer
```

**Model answer.** I'd split this into two model decisions, not one,
because the two jobs have very different shapes. Extracting a return
reason from free text is a **narrow, high-volume, well-defined
classification task** — a fixed, small set of reason categories
(damaged, wrong item, changed mind, etc.) — which is the textbook
**SLM** fit: at a million calls a month, the per-call cost and latency
difference between an SLM and a frontier LLM compounds into a large,
real number, and the classification task doesn't need broad open-ended
reasoning to hit high accuracy. Drafting a personalized email, by
contrast, needs to read the specific complaint, match tone to the
outcome (approved vs. denied), and produce fluent, context-appropriate
prose — that's an **LLM** job; forcing it onto a small model would
produce generic, occasionally tone-deaf drafts that a human would end
up rewriting anyway, which defeats the automation's purpose.

On hosting and licensing: nothing here suggests a data-residency or
full-auditability requirement, so I'd default to **SaaS Gemini LLMs**
for the drafting agent and either a **SaaS or self-hosted SLM** for
classification, decided by which is actually cheaper at this specific
volume — a self-hosted SLM's fixed infrastructure cost can beat SaaS
per-call pricing once volume is high enough, but "high enough" is a
number I'd want to actually calculate against real per-call SaaS
pricing before committing, not assume.

To the ops director, I'd frame the cost case as: **every one of the
million monthly returns pays the classification cost, but drafting
quality only matters on the subset that reaches a customer's inbox** —
so putting the expensive model exactly where quality is visible to the
customer, and the cheap model where it's invisible plumbing, is spend
proportional to where it's actually noticed, not "cheap everywhere" or
"strong everywhere."

**Why not "use one mid-tier model for both jobs, it's simpler to
operate"?** Because "simpler to operate" is an engineering-convenience
argument that ignores what each job actually needs — a mid-tier model
is arguably overkill for a million-times-a-month fixed classification
task (wasted cost at that volume) and potentially under-powered for
producing genuinely well-drafted, tone-appropriate customer emails
compared to a model built for stronger generation. One model everywhere
optimizes for the architect's convenience, not for the two jobs' actual
requirements.

---

### Q2. "A cross-border payments company is building a fraud-review agent. A new regulation in one of their operating countries requires that no transaction data — including any data sent to a model for inference — ever leave that country's borders. Walk through the model-hosting decision."

**What's really being asked.** Task 3.1's self-hosted-vs-SaaS axis,
tested against a hard regulatory constraint rather than a soft
preference — this checks whether a candidate treats "the data literally
cannot leave a boundary" as decisive, overriding convenience.

**Model answer.** This constraint resolves the hosting axis
immediately and non-negotiably: **self-hosted**, deployed on
infrastructure physically located inside that country's borders. A SaaS
model API — even one operated by a reputable provider with strong
contractual data-handling terms — still means transaction data leaves
the company's own infrastructure boundary to reach the provider's
inference endpoint, which is exactly what the regulation forbids
regardless of how good the provider's practices are. This isn't a
question of trusting the vendor; it's a structural fact about where the
data physically travels.

Given self-hosting is forced, I'd next resolve size and licensing
somewhat independently: fraud review needs real reasoning quality
(pattern recognition across transaction context, not a fixed
classification), so I'd lean **LLM-class**, and I'd specifically
evaluate **OSS models via Model Garden** since self-hosting an OSS model
gives the operational team full control over exactly what's deployed
and where — versus self-hosting a proprietary model's weights, which
may not even be an option depending on that provider's licensing terms
for self-managed deployment. I'd flag to the team that self-hosting
this country's fraud-review workload is now a standing operational
commitment — capacity planning, patching, uptime — that the rest of the
company's (presumably SaaS-hosted) fraud-review deployments in
unrestricted countries don't carry, and I'd scope that cost explicitly
rather than let it hide as "the same system, just deployed differently."

I'd also double-check the boundary is drawn correctly: if only
*transaction* data is regulated but aggregate, anonymized fraud-pattern
signals aren't, there may be a legitimate design where a SaaS-hosted
model handles anonymized pattern analysis while the self-hosted
in-country model handles anything touching raw transaction data — worth
confirming with legal/compliance before assuming the entire pipeline
must be self-hosted.

**Why not "just use a SaaS provider with a data-processing agreement
promising data won't be retained or used for training"?** Because the
regulation as stated is about data *leaving the border*, not about how
it's subsequently used or retained — a strong contractual promise about
retention doesn't change the fact that the data crossed the boundary to
reach the SaaS endpoint in the first place, which is the specific thing
prohibited. Contractual assurances address a different risk (misuse)
than the one this regulation is actually about (location).

---

### Q3. "A government contractor needs an agent that can analyze complex technical documents and must clear a compliance audit that requires being able to fully explain and inspect the model's internal behavior. The contractor also says the reasoning demands are 'genuinely some of the hardest technical analysis we do.' Are these two requirements in tension, and how do you resolve it?"

**What's really being asked.** Tests whether a candidate understands
that OSS-vs-proprietary (auditability) and capability level are
**separate axes** that can create real tension, rather than assuming
"open source" and "frontier capability" are mutually exclusive by
definition.

**Model answer.** There's a real tension here, and I'd name it plainly
rather than paper over it: full internal auditability is essentially
only available from **OSS models** (proprietary APIs don't expose
weights or architecture for inspection), but historically the very
strongest reasoning benchmarks are often led by proprietary frontier
models at any given time — so "fully auditable" and "absolute peak
capability" aren't guaranteed to point at the same model. The resolution
isn't to pick one requirement and quietly drop the other; it's to
**evaluate the actual OSS options against the actual task**, not against
an assumption that OSS necessarily lags. OSS model quality has been
closing the gap on many reasoning benchmarks, and the honest question is
whether the *specific* hardest-case documents this contractor deals with
are within reach of the strongest currently-available OSS models — a
question you answer by testing against real representative documents,
not by assuming the answer either way.

If a real capability gap turns out to exist — the strongest OSS option
genuinely can't handle the hardest cases at an acceptable accuracy — I'd
present that gap explicitly to the compliance and technical stakeholders
together, because the resolution is now a genuine business tradeoff, not
an architecture decision I can make alone: accept a capability ceiling
in exchange for full auditability everywhere, or design a **tiered
approach** where the OSS auditable model handles everything by default
and the hardest, rarest cases route to a human expert instead of a
proprietary model — keeping the audit boundary intact rather than
quietly using a proprietary model just for the hard cases and creating
an inconsistent compliance story.

I'd explicitly reject "use whichever model tests best and hope the
audit doesn't dig into it" — that's not a resolution, it's deferring a
known compliance risk to a worse moment (mid-audit) to discover it.

**Why not "just self-host a proprietary model, since self-hosting sounds
like it solves the auditability requirement"?** Because self-hosting
changes *where* inference runs, not *what's inspectable about the
model's internals* — a proprietary model's architecture and weights
stay opaque to the operator regardless of whose infrastructure it runs
on, unless the provider explicitly licenses that level of inspection
(rare for frontier proprietary models). Conflating "we control the
deployment" with "we can audit the model" is the exact trap this
question tests for — self-hosted-vs-SaaS and OSS-vs-proprietary are
different axes, and only the second one governs auditability.

---

### Q4. "I've read that ADK is Google's flagship agent product, so I'm assuming it's a proprietary, tightly-coupled part of the Vertex AI ecosystem that locks you into Google Cloud specifically. Is that a fair characterization?"

**What's really being asked.** This is a direct currency-correction
check dressed as a plausible-sounding assumption — testing whether a
candidate corrects a wrong premise clearly and explains the *practical*
consequence of getting it right, rather than just reciting "it's open
source" as a fact with no implication drawn.

**Model answer.** No, and I'd correct both halves of that
characterization, because each one matters differently. First: ADK
(Agent Development Kit) is explicitly described in the exam guide, and
in Google's own product framing, as an **open-source** library — not a
closed, Google-proprietary product. That's not a minor branding detail;
it has real architectural consequences: an open-source library's source
is inspectable, it can in principle be run or adapted outside a single
vendor's managed platform, and an organization evaluating it isn't
trusting a black box the way they would a fully proprietary framework.

Second, "tightly-coupled, locks you into Google Cloud" doesn't follow
even if ADK is *used* heavily with Google Cloud's managed
services — the framework and the managed services around it (Agent
Runtime, Vector Search 1.0, Agent Identity, and so on) are separate
things. You can write an ADK agent's core reasoning-loop and
tool-calling logic and choose, per this same section's own model-
selection axis, to point it at a self-hosted or third-party model rather
than exclusively at Gemini — the framework doesn't force a single
model provider. That said, I'd be honest about the practical reality:
using ADK *alongside* Google Cloud's managed agent-platform surface
(sessions, Memory Bank, Agent Registry, Agent Runtime) is where you get
the most integrated experience, so while ADK itself isn't locked to
Google Cloud, a team building deeply on ADK plus that whole platform
surface is making a real practical commitment to that ecosystem, even
though the licensing story is open.

I'd close by naming why this correction matters beyond trivia: a
candidate or team that goes into vendor negotiations or an architecture
review believing ADK is closed-source might overweight vendor
lock-in risk in a decision where the actual lock-in (if any) comes from
which *managed services* around ADK you adopt, not from ADK itself.

**Why not "it doesn't matter either way, since we'd only ever use it
inside Google Cloud anyway"?** Because it matters even for a team
committed to Google Cloud: open-source status affects license review,
audit posture, and whether the team could ever migrate the agent's core
logic elsewhere if platform strategy changed — dismissing the
distinction as academic throws away real information a technical
decision-maker should have on record, whether or not it changes today's
deployment choice.

---

### Q5. "A telecom's customer-support agent needs to greet a returning caller by name and recall that they're on a premium subscription tier from a call three months ago, while also tracking, turn by turn, which troubleshooting steps have already been tried in *this* call. Design the state architecture."

**What's really being asked.** Tests the managed-sessions-vs-Memory-Bank
distinction against a scenario with genuinely two different lifetimes in
play simultaneously, in a different domain (telecom, not HR/support
ticketing) than the pairing already covered elsewhere in this folder.

**Model answer.** This needs both layers, doing two different jobs, and
I'd design it so neither one tries to cover the other's ground. The
subscription tier and the fact that this is a returning, known caller
are **durable, cross-call facts** — exactly what **Agent Platform Memory
Bank** exists for: written once (or updated as it changes, e.g., on a
tier upgrade) and read back at the *start* of any future call from this
caller, before that call's conversation has even produced any turns of
its own. The specific troubleshooting steps already attempted **in this
call** — "we tried a modem restart, that didn't work, next we're
checking the account's outage history" — is **managed-session** state:
it only matters for the duration of this one call and would be actively
wrong to treat as durable memory, since next month's call starts a fresh
troubleshooting sequence that has nothing to do with this one.

Concretely, at call start: the agent reads Memory Bank for this
caller's identity-linked facts (name, tier, and any other durable
signal worth keeping, like "prefers callback over hold") and
initializes a fresh managed session for the call's own turn-by-turn
state. Every troubleshooting step taken during the call updates the
session; nothing about *which specific steps were tried this time*
gets written to Memory Bank unless there's a genuinely durable pattern
worth keeping (e.g., "this caller's line has a recurring, unresolved
hardware issue across multiple calls" — that pattern, not the individual
steps, is worth promoting to Memory Bank because it's useful context for
a *future* call).

I'd also flag a subtlety: if the same caller calls back an hour later
about the *same unresolved issue*, that's a system-design decision point
— does the platform resume the same session (avoiding re-asking
questions already answered) or start a new one and rely on Memory Bank
to recall relevant context? I'd lean toward a bounded session-continuation
window for same-issue callbacks, with Memory Bank as the fallback for
anything outside that window, rather than either extreme (sessions
lasting forever, or every call starting from zero).

**Why not "just always look up the caller's full call history and feed
the whole transcript into every new call's context"?** Because that
conflates the two lifetimes into an unbounded, ever-growing blob —
besides the direct cost of feeding growing transcripts into every call,
it doesn't distinguish "this caller's tier" (durable, small, always
relevant) from "the specific troubleshooting steps of a call from four
months ago" (irrelevant noise for today's unrelated call), and it makes
today's turn-by-turn tracking harder to reason about because it's mixed
in with irrelevant historical detail instead of living in its own
clean session scope.

---

### Q6. "A legal-document review agent has two capabilities: flagging contract clauses that deviate from standard templates, and redacting personally identifiable information before a document leaves the firm's system. How do you configure Agents CLI's skill/autonomy settings for these two, and would you treat them the same?"

**What's really being asked.** Tests per-capability agent-vs-human-mode
reasoning against two capabilities that both sound "compliance-adjacent"
but carry very different real-world risk if wrong — checking that a
candidate doesn't lump them together just because both are in a legal
context.

**Model answer.** No, I'd treat these differently, and the distinguishing
question is: **what's the cost of this specific capability being wrong,
and is the error reversible before it causes harm?** Flagging a clause
as deviating from a standard template is advisory — a flagged clause
still gets read by a human reviewer before any contract decision is
made, and a false positive (flagging something that's actually fine)
costs a reviewer a few extra seconds, while a false negative (missing a
real deviation) is caught by the fact that a human is reviewing the
whole document anyway, not relying on the flag alone. That's a
reasonable **agent-mode** capability, configured via Agents CLI as a
plugin the review agent invokes automatically on every document.

Redaction before a document *leaves the firm's system*, though, is a
fundamentally different risk category: if the agent redacts
autonomously and gets it wrong — misses a piece of PII, or redacts
incorrectly in a way that changes the document's legal meaning — the
consequence isn't "a reviewer double-checks," it's that unredacted PII
has already left the firm's boundary, which may be exactly the harm the
whole capability exists to prevent. I'd configure this specifically as
**human mode** (or agent-mode-with-mandatory-review, meaning the agent
proposes redactions but a person must approve before the document
actually transmits) — the redaction proposal can still be automated for
efficiency, but the final release-outside-the-firm action needs a human
gate.

I'd push back if a stakeholder suggested "make redaction agent-mode too,
for consistency with the clause-flagging capability" — consistency
across capabilities isn't itself a design goal here; matching autonomy
level to the actual, capability-specific consequence of an error is.
Configuring both the same way because "they're both legal-document
capabilities" ignores that one has a reversible, low-cost failure mode
and the other has a potentially irreversible, high-cost one.

**Why not "human mode for both, to be safe"?** Because that eliminates
the efficiency benefit of automating the clause-flagging step for no
matching risk reduction — a reviewer was always going to read the whole
document anyway, so gating the flag behind a human-approval step before
the reviewer even sees the document adds a review cycle with no real
safety benefit, since the flag was never the last line of defense to
begin with. Calibrating each capability's mode to its own actual risk,
not applying the stricter setting everywhere "to be safe," is the
actual best practice this section teaches.

---

### Q7. "A warehouse-automation company's robotics-coordination agent has three components: sensor-anomaly classification that must run at the edge with zero network round-trip (a robot arm can't wait on a network call to avoid a collision), automated shift-report generation, and a subsystem that reasons over proprietary manufacturing-process data that must never leave the building under any circumstances. Design the model strategy for all three and defend it to a plant manager who assumes 'one AI system' means one model."

**What's really being asked.** A genuinely multi-constraint system-design
question forcing all three model-selection axes to be walked
independently per component, with a hard latency constraint (edge) and a
hard data-boundary constraint (on-prem IP) pulling toward the same
hosting answer for different reasons.

```
   ┌───────────────────────┐    ┌───────────────────────┐
   │  Sensor stream            │    │  Shift-end trigger        │
   │  (robot arm)                │    │                              │
   └───────────┬───────────┘    └───────────┬───────────┘
               ▼                            ▼
   ┌───────────────────────┐    ┌───────────────────────┐
   │  Self-hosted SLM            │    │  SaaS LLM (Gemini)           │
   │  anomaly classifier            │    │  shift-report generator       │
   │  (on/near robot hardware —      │    │  (no latency/data                │
   │   zero network round-trip)        │    │   constraint here)                 │
   └───────────┬───────────┘    └───────────────────────┘
               │ local stop/continue signal
               ▼
        Robot arm control loop

   ┌─────────────────────────────────────────────┐
   │  Proprietary-process-data subsystem                │
   │  Self-hosted OSS LLM, on-prem only                    │
   │  (never leaves the building — no SaaS call, ever)       │
   └─────────────────────────────────────────────┘
```

**Model answer.** I'd walk each component through all three axes
separately, because they land in different places for different
reasons, and I'd say that difference plainly to the plant manager up
front — "one AI system" doesn't mean one model any more than "one car"
means one type of tire on every wheel.

**Sensor-anomaly classification:** the zero-network-round-trip
requirement is a hard latency constraint that rules out any SaaS call
entirely — a network hop of any kind is too slow for a collision-avoidance
decision. This forces **self-hosted**, and the task itself (classify a
sensor pattern as anomalous or not) is narrow and well-defined, so
**SLM**, small enough to run directly on or near the robot's onboard
hardware. OSS-vs-proprietary here is decided by what's actually
deployable at that hardware footprint — I'd default to whichever OSS or
vendor-licensed small model clears the accuracy bar at the required
inference speed on that specific hardware, tested empirically rather
than assumed.

**Shift-report generation:** no comparable constraint — this is
open-ended text generation with no latency-critical dependency and no
data-sensitivity issue (a shift report isn't proprietary process data).
Straightforward **SaaS LLM** (Gemini), since time-to-value and
generation quality matter more than infrastructure control here, and
there's no reason to pay the self-hosting operational cost for this
component.

**The proprietary-process-data subsystem:** the "never leaves the
building" requirement is a data-boundary constraint exactly like Q2's
regulatory case, forcing **self-hosted**, and I'd specifically evaluate
**OSS** here too — not because auditability was explicitly demanded, but
because self-hosting a proprietary model's weights may not even be
licensable for on-prem deployment, whereas an OSS model gives a clean
path to run entirely on the company's own hardware without a vendor
dependency on that specific machine.

To the plant manager, I'd frame it as: three components, three different
jobs, three different real-world constraints (a physics-driven latency
limit, an ordinary generation task with no constraint, and a hard IP
boundary) — and forcing all three onto one model would mean either
breaking the latency requirement, paying unnecessary self-hosting
overhead for the report generator, or exposing proprietary process data
to a shared model that also serves the reporting workload, none of which
serve the plant well.

**Why not "self-host one strong model on-site and use it for
everything, since we're self-hosting anyway for the IP-sensitive
component"?** Because self-hosting for one component doesn't mean the
infrastructure is free or appropriately sized for the other two — the
shift-report generator gains nothing from being on the same self-hosted
deployment (it has no data-boundary need) and just adds unnecessary load
and operational surface to infrastructure that exists specifically to
serve the collision-avoidance and IP-sensitive workloads; and using that
same self-hosted model for edge sensor classification may not even meet
the zero-round-trip requirement if it's not physically colocated with
the robot's own compute. "We're already self-hosting, so use it for
everything" ignores that the *reason* for self-hosting differs per
component and doesn't automatically transfer.

---

### Q8. "A subscription-billing company routes every incoming support ticket — including the simple 'what's my next billing date' lookups, which are the majority of volume — through the same frontier proprietary LLM used for their hardest billing-dispute cases. Their latency SLA is being missed and their monthly model spend has tripled since launch. Diagnose and fix."

**What's really being asked.** A diagnose-and-fix question testing
whether a candidate recognizes uniform over-provisioning of model
capability as the root cause of both symptoms (latency and cost)
simultaneously, rather than treating them as two separate problems
needing two separate fixes.

**Model answer.** Both symptoms — missed latency SLA and tripled
spend — trace back to the **same single root cause**: using an LLM sized
for the hardest cases on every request, including the high-volume,
trivially simple ones. A "what's my next billing date" lookup is a
narrow, well-defined, essentially deterministic task (look up a field,
report it) — it doesn't need frontier reasoning, and running it through
a large model burns both extra latency (more compute per token, even for
a short response) and extra cost, on what's very likely the majority of
total ticket volume given that these questions are described as
"simple" and common.

The fix is **not** "make the frontier model faster" or "negotiate a
better rate" — those treat the symptom. The fix is **tiering by task
complexity**, exactly the reasoning this section's model-selection
framework is built around: introduce a fast, cheap **SLM** (or even a
simple deterministic classifier/lookup path that doesn't need a
generative model at all, for genuinely templated cases like "next
billing date") to handle the high-volume simple lookups, and reserve
the frontier LLM specifically for billing disputes and anything
genuinely requiring nuanced reasoning over an account's specific,
ambiguous situation. A lightweight routing step (which could itself be
a small, fast triage model) decides which tier a given ticket needs
before any expensive reasoning happens.

I'd quantify the expected impact before committing engineering time to
this redesign: if simple lookups really are the majority of volume,
moving that majority off the expensive model should produce a large,
visible drop in both average latency (most requests now hit a fast
path) and total spend (most requests now cost a fraction of what they
did), while the genuinely hard cases keep the quality they need since
they still route to the strong model. I'd present this to the team as
"spend proportional to task difficulty," the same framing this section
uses elsewhere, rather than as a blanket cost-cutting exercise that
risks degrading quality on the hard cases too.

**Why not "switch every ticket to a cheaper model across the board to
cut costs"?** Because that fixes the cost symptom while creating a new
quality problem on the genuinely hard billing-dispute cases, which do
need strong reasoning — a uniform downgrade optimizes the same wrong
dimension (one model size for everything) in the opposite direction from
the original mistake. The actual fix is differentiating by task
difficulty in both directions, not picking a single size that's "less
wrong" on average.

---

### Q9. "A defense contractor's field-diagnostics agent needs to run entirely on hardware with no internet connectivity at all — not intermittent, genuinely air-gapped. Walk through what this constraint forces and what it leaves open."

**What's really being asked.** Tests whether a candidate correctly
identifies which axis a hard constraint forces outright versus which
axes remain genuinely open decisions within that constraint — a common
exam-trap shape (over-constraining every axis from one requirement).

```
   ┌─────────────────────────────────────────────┐
   │           Air-gapped field hardware                │
   │                                                     │
   │   ┌───────────────────────────────────────┐     │
   │   │  Self-hosted model                          │     │
   │   │  (size + license decided by task/hardware,      │     │
   │   │   NOT forced by the air-gap constraint itself)    │     │
   │   └───────────────────────────────────────┘     │
   │                                                     │
   │        ✕  no network path out — ever, period          │
   └─────────────────────────────────────────────┘
              (model/patch updates delivered physically,
               not pushed over any network)
```

**Model answer.** Genuine air-gapping — no internet connectivity,
period, not "usually connected" — forces exactly one axis outright:
**self-hosted**. A SaaS model is structurally impossible here; there's
no network path to reach any provider's API, so this isn't even a
tradeoff decision, it's a hard technical exclusion. That's the only axis
this specific constraint forces by itself.

What it **doesn't** automatically decide: size (LLM vs. SLM) and
licensing (OSS vs. proprietary) are still open questions, resolved by
different considerations. On size, I'd ask what the diagnostic task
actually requires — if it's matching sensor/equipment symptom patterns
against a known fault taxonomy, that's plausibly SLM-shaped; if it
requires synthesizing across multiple ambiguous, novel failure
presentations in the field, that leans LLM, and the hardware footprint
available in the field deployment (a rugged laptop vs. a vehicle-mounted
compute unit, say) becomes a real, practical ceiling on how large a
model can actually run there regardless of which size the *task* would
otherwise justify. On licensing, self-hosting doesn't force OSS the way
it did in Q2/Q3's auditability-driven cases — a proprietary model can be
self-hosted too, *if* the provider's licensing terms actually permit
running their model weights on the contractor's own air-gapped
hardware, which is a real, checkable question, not an assumption. If
that licensing path doesn't exist for the proprietary options under
consideration, OSS becomes the practical answer by elimination, not
because air-gapping inherently requires open-source.

I'd flag one more consequence of self-hosting under air-gapping
specifically: model updates, patches, and any future upgrade have to be
physically delivered to the air-gapped hardware — there's no
over-the-network update path — so whatever model is chosen needs an
update/maintenance plan that accounts for that friction from day one,
not as an afterthought once the system's already deployed.

**Why not "since we have to self-host anyway, pick whichever model has
the best general reputation and deploy it"?** Because self-hosting only
answers the hosting axis — it says nothing about whether that specific
model's licensing actually permits this exact self-hosted, air-gapped
deployment pattern, or whether it fits the hardware footprint actually
available in the field. "Best general reputation" ignores two concrete,
checkable constraints (licensing terms, hardware footprint) in favor of
an unverified assumption, which is exactly the kind of shortcut this
section's model-selection framework is built to prevent.

---

### Q10. "You operate a platform serving 12 internal teams, each building their own custom agent. Design how Agents CLI governs skill/plugin configuration and agent-vs-human mode across all 12 teams, and describe what happens when one team requests an exception to a platform-wide default."

**What's really being asked.** Tests fleet-level Agents CLI governance
reasoning (distinct from the single-agent skill-configuration question
in Q6) — whether a candidate designs for consistency at scale while
still allowing legitimate, justified exceptions rather than either a
rigid one-size-fits-all policy or an ungoverned free-for-all.

**Model answer.** At 12 teams, the goal isn't to dictate every team's
specific skills — each agent's actual capabilities are inherently
team-specific — but to establish **platform-wide defaults and guardrails**
that every team inherits unless they have a specific, reviewed reason to
deviate. Concretely, via Agents CLI: I'd define a baseline policy
classifying capability *categories* by default risk (read-only lookups
default to agent mode; anything that writes, deletes, or has an
external-facing side effect defaults to human mode or HITL-gated agent
mode) that every new agent inherits automatically on registration,
rather than each team independently deciding autonomy settings from
scratch with no shared baseline — inconsistent per-team judgment across
12 teams is exactly how one team's agent ends up autonomously executing
something another team would have gated.

For skill/plugin management specifically, I'd distinguish **shared,
platform-provided skills** (common capabilities multiple teams
plausibly need — a standard internal-lookup plugin, a standard
notification plugin) registered once and available to any team's agent,
from **team-specific custom skills** that only that team's agent uses —
this avoids the same integration-duplication anti-pattern task 3.2 names
for tool integrations, applied here to skills.

For the exception case: a team wanting to run a capability in agent mode
that the platform default classifies as human-mode-required needs a
**reviewed, justified exception**, not a self-service override — I'd
route this through whatever governance body owns platform-wide agent
policy, with the requesting team documenting why their specific use case
is lower-risk than the default assumes (e.g., "our 'write' action is to
a sandboxed staging environment with no production effect"). The
exception, once approved, should be scoped narrowly (this specific
capability, this specific agent) rather than becoming a precedent every
other team can informally claim without going through the same review.

**Why not "let each team configure Agents CLI however they see fit,
since they know their own agent best"?** Because "know their own agent
best" is true for the agent's functional design but doesn't automatically
extend to consistently judging autonomy risk across 12 independent
teams — without a shared baseline, the platform ends up with 12
different, uncoordinated judgment calls about what counts as safe to
automate, and a genuinely risky default in one team's agent won't get
caught by anyone else's review, because there isn't a shared review at
all. Centralizing the *baseline and exception process* while leaving
*which skills exist* team-specific gets the benefit of both local
knowledge and platform-wide consistency.

---

### Q11. "Design a symptom-checker triage agent for a healthcare system. It must meet HIPAA-grade data-control requirements and produce a regulator-reviewable audit trail of its reasoning, but it also needs to handle rare, complex symptom combinations well enough to be clinically useful rather than just a glorified FAQ bot. Walk the full model-selection decision, including what happens if no available model clears the bar."

**What's really being asked.** A full three-axis system-design question
where the compliance-driven constraints (self-hosted, OSS-leaning) are
in tension with a capability need, similar in shape to Q3 but requiring
the candidate to also design the fallback path when no model satisfies
both — a scenario that specifically tests handling genuine unresolved
tension rather than assuming a clean answer always exists.

```
   Patient symptom description
              │
              ▼
   ┌─────────────────────────────┐
   │  Self-hosted OSS LLM               │
   │  (HIPAA data control +                │
   │   regulator-auditable reasoning)        │
   └─────────────┬───────────────┘
                 │
        confidence / complexity check
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
  common, well-       rare / complex /
  understood case      low-confidence case
       │                   │
       ▼                   ▼
  Automated, audited   Escalate to human
  triage answer         clinician — NOT a
                        silent proprietary-
                        model patch
```

**Model answer.** HIPAA-grade data control is a strong hosting-axis
signal: patient symptom data is regulated health information, and the
safest, most defensible posture is **self-hosted**, keeping that data
inside infrastructure the healthcare system directly controls rather
than trusting a third-party SaaS boundary, even one with a signed
business-associate agreement — self-hosting removes an entire category
of "did the data ever technically leave our boundary" question a
regulator might ask. The "regulator-reviewable audit trail of its
reasoning" requirement pushes toward **OSS** on the licensing axis, for
the same reason as Q3: only an OSS model's architecture is actually
inspectable enough to support a genuine reasoning-transparency
audit, as opposed to trusting a proprietary provider's own claims about
what their model did internally.

That leaves size, and this is where the real tension surfaces: rare,
complex, multi-symptom presentations are exactly the case where broader
reasoning capability matters most, and if the strongest currently
available *self-hosted OSS* model doesn't clinically clear the bar on
those hard cases, I would **not** quietly accept degraded quality on the
cases that matter most just to preserve architectural purity. The
correct design is a **calibrated fallback, decided in advance, not
discovered live**: the self-hosted OSS model handles triage
confidently for the well-understood, common-presentation majority of
cases; for symptom combinations it flags as low-confidence or outside
its trained distribution, the system routes to a **human clinician**
rather than to an unaudited proprietary model as a silent quality patch
— preserving both the compliance posture (nothing genuinely
"handled" by the system bypasses the audit trail) and clinical safety
(a low-confidence automated triage doesn't get treated as a real answer).

I'd present this explicitly as a three-way tradeoff to the stakeholders,
not resolve it unilaterally: full compliance purity with some clinical
capability ceiling (current design), or a capability gain on hard cases
at the cost of an audit-trail gap if a non-OSS or non-self-hosted model
is introduced for those cases specifically — and I'd recommend the first
option unless legal/compliance explicitly signs off on a scoped
exception for the rare-case fallback path.

**Why not "use the strongest available proprietary LLM for the hard
cases only, since the common cases already meet the bar with the
compliant model"?** Because that reintroduces exactly the audit-trail
gap the whole design was built to avoid, specifically on the cases where
getting the reasoning right — and being able to show a regulator *why*
the system reasoned the way it did — matters most. A compliance
requirement that only applies to the easy majority of cases and quietly
lapses on the hardest, highest-stakes minority isn't a compliant system;
it's a system that looks compliant until the regulator asks about
exactly the cases that matter.

---

## 3.2 Integrating enterprise domain knowledge (11 questions)

### Q12. "A university's course-advising agent must ground every answer in a constantly-changing course catalog that mixes free-text course descriptions with strict tabular prerequisite rules (e.g., 'requires CS201 AND (MATH150 OR MATH160), minimum grade C'). Design the RAG pipeline, specifically the chunking strategy."

**What's really being asked.** Tests whether a candidate recognizes that
a single chunking strategy doesn't fit content with genuinely different
structure (prose vs. structured logic), and designs the pipeline update
cadence around genuinely volatile source content.

**Model answer.** I'd treat the free-text descriptions and the tabular
prerequisite rules as **two different content shapes needing two
different handling strategies**, not one chunking approach applied
uniformly. Course descriptions are prose — semantic chunking on natural
paragraph/section boundaries (not a fixed character count that could
split a description mid-sentence) works well here, the same reasoning
that applies to any prose knowledge base. Prerequisite rules, though,
are **structured logical expressions**, not prose to be chunked
semantically at all — a rule like "CS201 AND (MATH150 OR MATH160)" loses
its actual logical structure if it's naively chunked as text and
retrieved via similarity search the same way a paragraph would be; a
student asking "can I take this course if I only have MATH160" needs the
system to correctly evaluate a boolean condition, not just retrieve
text that's semantically similar to the question.

For the prerequisite rules specifically, I'd represent them as
**structured data** (rather than embedding prose descriptions of them)
and consider whether they belong in a structured store (a database
table of course-code-to-prerequisite-logic) queried directly, rather
than forcing them through the vector-similarity RAG path at all — this
is the same "match the data-access pattern to the right service"
principle that applies whenever content is exact-logic-shaped rather
than semantic-similarity-shaped: **Vector Search 1.0 / Agent Retrieval**
for the free-text descriptions, a structured query (e.g., against
BigQuery or Cloud SQL) for prerequisite-eligibility checks, with the
agent's reasoning loop deciding which path a given question needs and
potentially combining both (retrieve the course description
semantically, then separately evaluate the structured prerequisite logic
against the student's actual transcript).

On update cadence: a course catalog changes on a real, known
schedule (each term, plus occasional mid-term corrections) — I'd design
scheduled re-ingestion aligned to the registrar's actual publication
cadence, plus a change-triggered re-ingestion path for corrections,
rather than a one-time index build that silently goes stale the moment
the next term's catalog changes.

**Why not "just embed the entire catalog, prerequisites included, as
prose and let vector similarity handle it"?** Because prerequisite
eligibility is a **logical evaluation problem** ("does this specific
student's completed courses satisfy this specific boolean expression"),
not a semantic-similarity problem — vector search finds content that's
*topically related* to a query, it doesn't *evaluate* a logical
condition against a specific student's data. Treating a structured
eligibility rule as retrievable prose would produce answers that sound
plausible but aren't actually verified against the real rule, which is
a much worse failure mode for an advising agent than simply not finding
a relevant course description.

---

### Q13. "A retailer's product-question agent has answered customer questions reliably for months. After a routine platform update last week, its answers have become subtly wrong — not obviously broken, just often citing product details that don't match what's actually being asked about. Diagnose."

**What's really being asked.** Tests recognition of the
embedding-model-mismatch failure mode from a "routine update" trigger,
in a retail domain distinct from other embedding-mismatch coverage
elsewhere in this folder — checking that a candidate connects "recent
platform update" + "subtly, not catastrophically wrong" to this specific
cause rather than a vaguer "something broke."

**Model answer.** "Subtly wrong, not catastrophically broken, right
after a platform update" is close to the signature of an **embedding-
model mismatch between ingestion and query time** — one of the most
consequential and *silent* failure modes in a RAG pipeline, precisely
because it doesn't throw an error; it just quietly degrades relevance.
My first, most specific hypothesis: did last week's "routine platform
update" include an upgrade to the embedding model used at query time,
without a corresponding **re-embedding of the entire existing product
catalog** in Vector Search 1.0? If the stored vectors were produced by
the old embedding model and the live query is now embedded by the new
one, the two vector spaces aren't comparable — similarity search still
*runs* and *returns results* (which is why this doesn't look like an
obvious crash), but the results are no longer meaningfully ranked by
actual relevance, producing exactly this symptom: answers that cite
real products, just not the ones actually relevant to the question.

To confirm rather than assume: I'd check the platform update's change
log specifically for any embedding-model version change, and I'd
directly test retrieval quality against a small set of known
query-to-expected-product pairs from before the update — if those same
queries now retrieve different, less-relevant products than they did
pre-update, that's strong direct evidence pointing at the embedding
layer rather than, say, a change in the underlying LLM's generation
behavior.

The fix, if confirmed: **re-embed the entire product catalog with the
new embedding model** so ingestion and query time are consistent again
— there's no partial fix here; a mixed corpus (some products embedded
with the old model, some with the new) is exactly as broken as an
entirely mismatched one, since a given query still can't tell which
stored vectors it's comparable to.

**Why not "the LLM is hallucinating product details, tighten the
prompt"?** Because the described symptom is about **which products get
retrieved and cited**, not about the model inventing details for a
product it already has correct information about — tightening a prompt
doesn't fix a retrieval-layer relevance problem, and treating this as a
prompt-engineering issue would burn a cycle on the wrong layer of the
pipeline while the actual cause (a stale, mismatched vector index)
remains unfixed.

---

### Q14. "Your team maintains an internal engineering-runbook search agent used casually by engineers browsing for related docs — low stakes, no compliance exposure. Someone proposes adding a reranking stage to 'improve quality across the board.' Do you build it?"

**What's really being asked.** A "why not" balanced tradeoff question
specifically about *not* reaching for reranking, contrasted implicitly
with the high-precision-stakes cases (compliance, HR, clinical) where
reranking is clearly justified elsewhere in this folder — tests that a
candidate doesn't treat reranking as a universal best practice to add
"for quality" without weighing its actual cost against this specific
use case's actual stakes.

**Model answer.** I'd push back on adding it here, at least as a
default, and I'd make the case in terms of the specific stakes rather
than a general "reranking is unnecessary complexity" stance. This is
described as a **low-stakes, casual-browsing** use case: an engineer
searching internal runbooks for something related isn't making a
compliance decision or acting on a precise citation the way a
policy-answering or clinical-triage agent would — if the initial
similarity-scored top-K results are already reliably "good enough to be
useful for browsing," the marginal relevance improvement reranking adds
doesn't clearly outweigh the extra latency and compute cost it
introduces on every single query, especially if this agent handles a
meaningful volume of casual, low-stakes lookups.

The right question isn't "would reranking make results marginally
better" — it almost always would, everywhere, as a second, finer-grained
scoring pass — it's "does the *cost* of that improvement (latency,
compute) clearly pay for itself given how this specific tool is
actually used and what happens when a result is merely 'pretty good'
instead of 'best possible.'" For a casual internal browsing tool, a
slightly-less-than-optimal top result costs an engineer a few extra
seconds of scanning; that's a very different cost-of-being-imprecise
than a compliance agent citing the wrong policy clause to a customer.

I would reconsider if the actual usage pattern turned out to differ from
"casual browsing" — if engineers started relying on this agent's top
result as an authoritative answer for something with real consequences
(say, a runbook step that, if wrong, causes a production incident), that
shift in how the tool is actually used and trusted would be exactly the
evidence-based trigger to revisit and add reranking, not a blanket
"quality" argument disconnected from actual stakes.

**Why not "add it anyway, since reranking never makes results worse and
it's a small addition"?** Because "never makes results worse" isn't the
same as "worth its cost everywhere" — reranking has a real latency and
compute cost on every query, and paying that cost uniformly across a
low-stakes, high-casual-volume tool is optimizing for a marginal quality
gain the use case doesn't actually need, which is the same "don't add
cost the task doesn't warrant" reasoning this section applies to model
selection, applied here to a pipeline stage instead of a model choice.

---

### Q15. "A multinational conglomerate wants a single custom agent instance to serve finance, legal, and engineering staff, each of whom should only see their own department's confidential documents when they ask a question — but building three completely separate agents feels wasteful given they share most of their reasoning logic. Design the permission architecture."

**What's really being asked.** Tests Agent Identity design against a
**shared-instance, dynamically-scoped** access pattern — a genuinely
different structural challenge than statically scoping one agent per
fixed dataset, since the same agent instance must apply different access
boundaries depending on who's asking.

```
   Finance employee    Legal employee    Engineering employee
        │                   │                   │
        ▼                   ▼                   ▼
   ┌─────────────────────────────────────────────┐
   │   Authenticate requester → resolve department      │
   └─────────────────────┬───────────────────────┘
                         ▼
   ┌─────────────────────────────────────────────┐
   │         ONE shared agent instance                    │
   │  retrieval scoped by Agent Identity PER REQUEST,       │
   │  filtered BEFORE retrieval — never after generation      │
   └───────┬───────────────┬───────────────┬───────────┘
           ▼               ▼               ▼
     Finance docs      Legal docs      Engineering docs
     (finance reqs      (legal reqs      (eng reqs
      only)               only)            only)
```

**Model answer.** The instinct to avoid duplicating a single shared
agent into three near-identical copies is reasonable, but it changes
what "Agent Identity" needs to mean here: rather than one static
identity scoped to a fixed set of allowed data sources (appropriate when
one agent instance always serves one fixed population), this design
needs the agent's **effective access boundary to be determined
dynamically, per request, based on the authenticated requester's actual
department** — the agent's own identity is necessarily broad enough to
technically reach all three departments' content, so the real
enforcement point has to be **per-request authorization layered on top
of, not instead of, the agent's own identity scope**.

Concretely: the agent authenticates the requester (who is this
employee, and what department are they actually in — this has to be
verified against real identity/HR data, not self-reported), and every
retrieval call the agent makes on that requester's behalf gets filtered
to that requester's department's document set *before* anything reaches
the reasoning loop as retrieved context — not filtered afterward, from a
larger unfiltered retrieval. This distinction matters: filtering
**before** retrieval means finance-confidential content is never even
candidate context for a legal employee's question; filtering **after**
retrieval means the content was already inside the reasoning loop's
context window at some point, which is a meaningfully worse security
posture even if the final answer is correctly redacted, since a
prompt-injection or reasoning error could still leak something that was
technically present in context.

I'd also flag the failure mode this design has to specifically guard
against: a bug or misconfiguration in the per-request department
determination is now a single point of failure across *all three*
departments' confidentiality, in a way that three genuinely separate
agents wouldn't share — so this design trades duplicated-infrastructure
cost for a concentrated, higher-consequence single point of failure,
and I'd recommend investing correspondingly more in testing and
monitoring that specific authorization-determination step than I would
for three simpler, separately-scoped agents.

**Why not "let the agent retrieve broadly and just instruct it, via
system prompt, to only discuss content relevant to the requester's own
department"?** Because that's a prompt-level instruction, not an access
control — the confidential content from the other two departments is
still actually retrieved into the reasoning loop's context, and relying
on the model to *choose* not to discuss it is a content-safety-shaped
control being asked to do an access-control job. A sufficiently unusual
question, an adversarial prompt, or simply a model reasoning error could
surface content that a real access boundary — enforced at retrieval
time, before the content ever reaches the model — would have prevented
from ever being in scope at all.

---

### Q16. "You discover that five different teams have each independently built their own point-to-point integration to the same internal customer-relationship-management system for their respective agents — five separate credential sets, five slightly different data-mapping implementations, and at least one of them is already out of date after the CRM's last API version bump. You're asked to fix this."

**What's really being asked.** A scenario-shaped version of the
Agent-Registry-avoids-duplication principle, testing whether a candidate
proposes the actual architectural fix (register once, reuse) rather than
just "tell the teams to talk to each other" as a process fix without an
architectural one.

**Model answer.** The root cause is architectural, not a coordination
failure between teams that a meeting would fix: there's no shared,
discoverable capability for "talk to the CRM," so each team
independently solved the same integration problem, and now the
organization is paying for that duplication in exactly the way this
section's guidance predicts — inconsistent implementations, duplicated
credential management, and version drift, since the team whose
integration is already broken by the API bump has no reason to know the
other four even exist, let alone that one of them might already have a
fix.

The fix: consolidate into **one CRM integration, registered once in
Agent Registry**, backed by either a Google Cloud MCP Server (if the
CRM has one) or a single well-maintained custom/third-party MCP server
if not — either way, one integration, one place responsible for keeping
it in sync with the CRM's API version, and one credential-management
surface instead of five. Every team's agent then discovers and calls
this registered capability instead of maintaining its own connection.

I'd sequence the migration carefully rather than mandate an
overnight cutover: first stand up the consolidated MCP-backed
capability and register it, verify it against each of the five teams'
actual real usage patterns (since their "slightly different data
mappings" might reflect real, legitimate differences in what each team
actually needs from the CRM, not just inconsistency for its own sake —
worth confirming before assuming they should all collapse to one
identical mapping), then migrate teams one at a time, retiring each
team's point-to-point integration as their migration completes, rather
than a single flag-day cutover that risks breaking all five teams'
agents simultaneously if the consolidated version has a gap none of the
individual integrations had.

**Why not "just tell the five teams to coordinate and standardize on
one team's existing integration"?** Because that's a process fix layered
on the same underlying architectural gap — it might produce temporary
alignment, but without a registered, discoverable, single source of
truth (Agent Registry) any *sixth* team building a new agent next
quarter has no way to find out this shared integration exists and will
likely just build a sixth point-to-point connection, recreating the
exact problem. The fix has to make the capability discoverable by
construction, not rely on teams happening to ask around first.

---

### Q17. "A company needs its agents to reach both BigQuery (for internal analytics data) and a legacy on-premises mainframe system running a proprietary, decades-old communication protocol with no modern API. Decide the integration approach for each."

**What's really being asked.** Tests the Google-Cloud-MCP-Servers-vs-
custom-integration decision made per-target rather than as a single
blanket policy, specifically contrasting a clean managed-service case
against a genuinely custom-integration-shaped case.

**Model answer.** These two targets land in different places, and I'd
resolve each on its own merits rather than pick one integration
philosophy for both. **BigQuery** is a Google Cloud-managed service with
a well-defined, modern API — this is exactly the case **Google Cloud MCP
Servers** exist for: rather than any team hand-writing a BigQuery
connector, I'd check whether a Google Cloud MCP Server for BigQuery
already exists (very likely, given it's a core Google Cloud data
service) and use it, registering the resulting capability in Agent
Registry so any future agent needing BigQuery access reuses the same
connection rather than reimplementing it.

The **legacy mainframe** is a fundamentally different case: a
proprietary, decades-old protocol with no modern API is exactly the
scenario task 3.2 leaves room for as a legitimate **direct/custom
integration** — no Google Cloud MCP Server exists for a bespoke internal
legacy protocol, and standing up a generic, reusable MCP server wrapper
around a system this idiosyncratic may not be worth the engineering
investment unless multiple agents genuinely need this same mainframe
capability. I'd build a purpose-specific integration layer that
translates the mainframe's protocol into whatever interface the agent's
tool-calling logic expects, treating it explicitly as custom, non-reusable
integration work rather than forcing it through an ill-fitting protocol
abstraction just for architectural uniformity.

One nuance I'd flag: if it turns out **multiple** agents across the
organization will need mainframe access (not just this one), the
calculus for the mainframe integration shifts — at that point, wrapping
the custom integration logic in a purpose-built MCP server (even though
no prebuilt one exists) and registering *that* in Agent Registry starts
to pay off, avoiding the same integration-duplication problem named in
Q16, just for a target that happens to need custom protocol-translation
work under the hood rather than an off-the-shelf connector. The decision
isn't "MCP vs. custom" as a fixed dichotomy — it's "does this specific
target already have (or warrant building) a reusable server," decided
per target, potentially revisited as usage grows.

**Why not "build custom integrations for both, since the mainframe
needs one anyway and it's simpler to have one consistent approach"?**
Because that discards a real, no-cost win on the BigQuery side —
reinventing a BigQuery connector when a maintained Google Cloud MCP
Server almost certainly already exists is pure wasted engineering effort
with no offsetting benefit, and "consistency of approach" isn't worth
paying real development and maintenance cost on a target that already
has a reusable, standard solution.

---

### Q18. "A startup's Gemini Enterprise agent, grounded via Agent Search, has worked fine for their FAQ use case for six months. An engineer proposes migrating retrieval to Vector Search 1.0 and Agent Retrieval for 'better control and more modern architecture,' with no specific new requirement driving it. Evaluate this proposal."

**What's really being asked.** Tests recognition of premature migration
from a working low-code grounding solution to custom-code retrieval
infrastructure with no concrete need — the reverse framing of "when to
move to custom" questions elsewhere, checking that a candidate applies
the same evidence-based-trigger discipline to *not* migrating when no
real gap exists.

**Model answer.** I'd push back on this proposal as stated, because
"better control and more modern architecture" isn't a requirement — it's
a preference for architectural sophistication with no named gap in
what the current system actually needs to do. **Agent Search** is
working, per the description, for exactly the use case it exists for:
low-code-appropriate grounding on a document set for an FAQ-style agent.
Migrating to **Vector Search 1.0 / Agent Retrieval** means taking on
real, ongoing engineering ownership — the team now has to run and
maintain chunking, embedding-model selection and versioning (including
guarding against the embedding-mismatch failure mode from Q13),
similarity scoring, and potentially reranking configuration
themselves, none of which the low-code connector required them to think
about at all.

The right test, consistent with this section's low-code-vs-custom
framing applied specifically to the retrieval layer: is there a
**concrete capability gap** Agent Search's managed connector doesn't
expose that this specific FAQ use case actually needs — a specific
chunking strategy for an unusual document format, a specific embedding
model Agent Search's defaults don't use, or custom reranking logic for a
precision requirement the FAQ use case doesn't currently have? If the
engineer can name one of those, that's a legitimate, evidence-based
reason to migrate. "More modern" and "more control" in the abstract,
with no named gap, describes an architectural preference, not a
requirement — and paying real ongoing engineering cost to satisfy a
preference, on a system that's reportedly already working, is the
inverse of the "start cheap, upgrade at a concrete wall" discipline this
section teaches everywhere else.

I'd ask the engineer directly: "what can this FAQ agent not currently do,
today, that this migration would enable?" — if the honest answer is
"nothing specific, it just feels like the more sophisticated approach,"
that's the answer to this evaluation right there.

**Why not "migrate anyway, since custom retrieval is strictly more
capable and it's better to build the more powerful version while the
system is small and easy to migrate"?** Because "strictly more capable"
describes the *ceiling* of what custom retrieval can eventually do, not
whether this specific FAQ use case is anywhere near that ceiling today —
paying the ongoing maintenance cost of a capability the current use case
doesn't exercise is exactly the "upgrade before hitting an actual wall"
mistake this section's don't-use-ADK-by-default guidance (§1.2 of the
domain file) warns against, just applied to the retrieval layer
specifically instead of the whole agent.

---

### Q19. "An insurance company's claims-assistance agent needs to answer questions that mix two very different lookups: 'what does my policy cover for water damage' (a semantic question over policy documents) and 'what's the current status of my claim number 48213' (an exact record lookup). Design how these two combine inside one agent."

**What's really being asked.** A system-design question requiring a
candidate to correctly route two different question shapes to two
different data-access mechanisms within a single agent's reasoning
loop, rather than forcing both through the same retrieval path.

```
   Claimant question
              │
              ▼
   ┌───────────────────────────┐
   │  Routing classifier (SLM)       │  "semantic, exact lookup, or both?"
   └───────┬───────────┬───────────┘
           │             │
   semantic│             │exact match
           ▼             ▼
 ┌───────────────┐  ┌───────────────────────┐
 │ Vector Search    │  │ Cloud SQL / Firestore     │
 │ 1.0 + Agent        │  │ (claim record, by ID —       │
 │ Retrieval            │  │  exact match, not similarity)  │
 │ (policy docs)          │  └───────────┬───────────┘
 └───────┬───────┘                    │
         │                                │
         └───────────┬────────────────────┘
                     ▼
          Reasoning loop combines both
          → grounded answer to claimant
```

**Model answer.** These are two structurally different questions and I'd
design two different data paths feeding into the same reasoning loop,
with the agent itself deciding which (or both) a given question needs.
"What does my policy cover for water damage" is a **semantic retrieval**
question — the answer lives somewhere in prose policy-document
language, and the right tool is **Vector Search 1.0 / Agent Retrieval**:
embed the question, retrieve semantically similar policy-document
chunks, rerank for precision (justified here, since citing the wrong
coverage detail to a policyholder is a real cost, the same reasoning
Q14 argues against for a genuinely low-stakes case but argues for here
given real financial stakes), and ground the answer in the retrieved
text.

"What's the current status of claim number 48213," by contrast, is an
**exact-match structured lookup** — there's a specific claim record with
a specific ID, and the answer is whatever that record's current status
field says, not something to find via semantic similarity at all. This
routes to a **structured data service** (Cloud SQL or Firestore,
whichever the claims-management system's backing store already is) via
a direct query or a registered capability, not through the vector
retrieval path — running "claim 48213 status" through semantic search
would be both the wrong tool (there's nothing to rank by similarity
here, there's one exact record to fetch) and a real risk (a
similarity-based approach could plausibly surface a *different* claim's
content that happens to be textually similar, which is a much worse
failure mode for a financial record than a merely-imprecise FAQ answer).

The agent's reasoning loop needs a routing decision at the front: does
this question need semantic retrieval, an exact lookup, or both (a
question like "why was my claim 48213 denied, and does my policy
actually cover this" needs the exact claim record *and* semantic
retrieval over the policy language to check coverage) — I'd design this
routing as an explicit classification step (plausibly SLM-shaped,
per this section's own model-selection framework, since classifying
"which data path does this question need" is itself a narrow, well-
defined task) rather than hoping the model implicitly figures out which
tool to call from a single generic instruction.

**Why not "put the claims records into the vector database too, so
everything goes through one unified retrieval path"?** Because claim
records are exact-match structured data with a well-defined key (the
claim number), not free-text content where finding the *most similar*
match is the actual goal — embedding a structured record and retrieving
it via similarity search is both unnecessary (you already know the
exact key you want) and risky (similarity search could return a
different, textually-similar claim instead of the exact one requested),
which is a strictly worse failure mode than an exact-match query against
a structured store, which either returns the exact record or clearly
returns nothing.

---

### Q20. "During a production audit, you discover that all six agents in a company's agentic platform share a single Agent Identity scoped to broad read access across nearly every internal data source — a configuration that was set up during the initial build phase 'to make development easier' and never revisited before the system shipped to production. Diagnose the risk and redesign."

**What's really being asked.** Tests recognition that a
development-convenience shortcut around least-privilege scoping is a
real production risk if it's never revisited — and that the fix is
structural (per-agent scoping) rather than a policy memo asking people
to be careful.

**Model answer.** The core risk is exactly what least-privilege Agent
Identity scoping exists to prevent: with six agents sharing one broadly-
scoped identity, a bug, a manipulated input, or a misbehaving reasoning
loop in **any one** of the six agents has a blast radius covering
**everything all six agents were ever given access to**, not just what
that specific agent's actual task requires. This is a much larger
exposure than six agents each properly scoped to their own narrow needs
— a flaw in the lowest-stakes of the six agents (say, an internal
document-search assistant) could, under this shared-identity
configuration, potentially reach data that only the highest-stakes agent
(say, one handling sensitive HR queries) was ever supposed to touch.

The fact that this was set up "to make development easier" is itself
worth naming as the actual root cause, not just the symptom: development-
convenience shortcuts around access scoping are exactly the kind of
decision that's easy to make under time pressure during a build phase
and easy to forget to revisit before shipping, precisely because nothing
visibly breaks when it's left in place — the system works fine in
production too, right up until something goes wrong inside the shared
boundary.

The redesign: **audit each of the six agents' actual task requirements**
individually, then configure a **distinct Agent Identity per agent**,
scoped to only the specific data sources and actions that agent's real
job needs — the same explicit allow/deny-list discipline that applies
to any single custom agent's permission scoping, just applied
independently six times instead of once. I'd also use this audit as the
moment to check whether any of the six agents' actual current behavior
depends on access the broad shared identity granted but their real task
doesn't need — if narrowing scope breaks something, that's valuable
information revealing either an under-specified requirement or a
capability quietly relying on over-broad access that should be re-scoped
properly rather than left broad to avoid breaking it.

**Why not "leave it as one shared identity but add monitoring to catch
any agent that behaves suspiciously"?** Because monitoring is a
detective control, not a preventive one — it can tell you *after* an
over-broad access has already been exercised that something went wrong,
but it doesn't stop the access from being technically possible in the
first place. The actual fix removes the *capability* for one agent's
flaw to reach data outside its own scope; monitoring alone accepts that
capability remains and just tries to notice faster when it's misused,
which is a materially weaker posture for a gap this significant.

---

### Q21. "A customer-support agent needs to look up shipment tracking status from a third-party logistics provider's SaaS platform, and separately needs to file internal bug reports in the engineering team's issue tracker when a customer reports a reproducible product defect. Design both integrations."

**What's really being asked.** Tests correctly applying the
MCP-first, check-before-building discipline to two distinct third-party
integration targets in a support-ops context, distinct from the
compliance/ticketing pairing used elsewhere in this folder.

```
   Support agent
        │
        ├──MCP──► [existing MCP server for the logistics
        │          SaaS tracking API? YES]
        │               │
        │               ▼
        │        Use existing MCP server
        │        (register in Agent Registry)
        │
        └──MCP──► [existing MCP server for the internal
                    issue tracker? NO]
                        │
                        ▼
              Build + register a new MCP server
              (reusable — future agents discover it
               via Agent Registry too)
```

**Model answer.** Both of these are **agent-to-tool** connections (the
logistics platform and the issue tracker are both fixed-capability
systems with no reasoning of their own — not other agents), so both are
**MCP** territory, not A2A; the design question for each is really
"does a usable MCP server already exist, or do we need to build one."

For the **third-party logistics platform**: I'd first check whether the
logistics provider itself publishes an MCP server for their tracking
API, or whether a Google Cloud MCP Server or established third-party MCP
server already wraps it — third-party SaaS-to-MCP integration is exactly
the case task 3.2 names explicitly ("MCP server that connects agents to
third-party SaaS tools"). If one exists and covers the tracking-lookup
capability this agent needs, I'd use it rather than build a custom
wrapper, since it's very likely other companies integrating with the
same logistics provider have the identical need, making a
maintained, shared MCP server more likely to exist and stay in sync with
the provider's API than a bespoke integration this team would own
alone.

For the **internal issue tracker**: this is an internal system, so no
generic Google Cloud MCP Server would exist for it, but that doesn't
default to custom/direct integration either — I'd check whether the
issue-tracker vendor (if it's a common commercial tool) has a
community or vendor-published MCP server first, since "third-party" in
task 3.2's framing includes commercial tools broadly, not just
consumer-facing SaaS. If genuinely nothing suitable exists, I'd build a
purpose-specific MCP server for "file a bug report" rather than a
one-off direct integration, specifically because **filing bugs is a
capability other agents across the engineering-adjacent parts of the
organization will very plausibly also need** (per the Q16 duplication
lesson) — registering it in Agent Registry once, even though building it
required custom work, avoids a future team reinventing the same
integration.

**Why not "build both as quick, direct point-to-point integrations,
since it's the fastest way to ship this specific support agent"?**
Because "fastest to ship this one agent" ignores the reuse potential
both integrations plausibly have — a logistics-tracking lookup and a
bug-filing capability are both the kind of thing other agents across the
organization are likely to eventually need too, and defaulting to direct
integration for speed here recreates the exact duplicated-integration
problem this section's guidance and Q16 both warn against, just
deferred to whichever future team builds the next agent that happens to
need the same capability.

---

### Q22. "A pharmaceutical company's research-support agent must ground its answers in clinical-trial documentation, but a subset of that documentation contains unblinded trial data that only specific credentialed roles are permitted to see — for everyone else, that content shouldn't just be excluded from the final answer, it must never even be retrieved into the reasoning process at all. Design the combined RAG and permissions architecture."

**What's really being asked.** A deep system-design question forcing
retrieval-time (not generation-time) enforcement of access control
inside a RAG pipeline — testing whether a candidate understands the
meaningful security difference between "filter before retrieval" and
"filter the final answer," the same distinction Q15 raised for
department-scoped access, now applied to a regulatory-blinding
requirement with an even higher bar (the content must never enter
context at all, not just never appear in the final answer).

```
   Requester question
        │
        ▼
   ┌─────────────────────────────┐
   │ Authenticate + resolve role/     │
   │ credential tier                    │
   └─────────────┬───────────────┘
                 ▼
   ┌─────────────────────────────┐      ✕  unblinded index
   │ Agent-Identity-scoped RETRIEVAL   │─────  (never queried unless
   │ QUERY — filters BEFORE               │      credential tier permits)
   │ similarity scoring runs                │
   └─────────────┬───────────────┘
                 ▼
      Only authorized-tier chunks ever
      enter the reasoning loop's context
                 ▼
            Grounded answer
    (restricted content was never a
     retrieval candidate to begin with)
```

**Model answer.** The requirement that restricted content "must never
even be retrieved" is stricter than an ordinary access-scoping problem,
and it rules out any design where filtering happens **after** retrieval
or after generation — if unblinded trial data is ever pulled into the
reasoning loop's context, even briefly, and the model is then instructed
"don't mention this," that's a content-safety-style control being asked
to enforce what's actually an access-control requirement, and it leaves
a real risk that a prompt-injection attempt, an unusual phrasing, or a
model reasoning slip surfaces something that should never have been in
context in the first place — exactly the same category of risk named in
Q15's answer, but with a regulatory-blinding stake that makes it more
serious here, not less.

The correct design enforces the boundary **at the retrieval query
itself**, before anything reaches the reasoning loop: the requester's
credential/role is authenticated and resolved *before* the RAG retrieval
call executes, and the retrieval call against Vector Search 1.0 /
Agent Retrieval is scoped — via **Agent Identity**, defined per role or
per credential tier — to only the subset of the indexed corpus that
role is permitted to see. Concretely, this likely means the unblinded
trial data is either indexed in a **separate, access-restricted vector
index** the retrieval call only queries when the requester's role
authorizes it, or tagged with metadata the retrieval layer filters on
*before* similarity scoring runs, not after. Either way, for an
uncredentialed requester, the unblinded content is never a retrieval
candidate at all — not filtered out of a candidate set, never a
candidate in the first place.

I'd also flag the specific regulatory reason this distinction matters
more here than in an ordinary confidentiality case: unblinding in a
clinical trial context isn't just a business-confidentiality concern,
it's often a matter of trial integrity and regulatory compliance —
even a credentialed researcher accidentally seeing unblinded data
through an improperly scoped agent could compromise the trial's
scientific validity, which is a categorically different and more severe
consequence than an ordinary internal-confidentiality leak, and worth
naming explicitly to whoever's signing off on this design so the
retrieval-time enforcement requirement doesn't get treated as
"nice-to-have, if convenient."

**Why not "retrieve normally for everyone, and have Model Armor or a
content filter strip any unblinded-data mentions from the final answer
before it's returned"?** Because that's exactly the after-the-fact
filtering this design specifically has to avoid — the unblinded data
would have already been retrieved into the reasoning loop's context for
an unauthorized requester, meeting the described failure condition
("retrieved into the reasoning process at all") regardless of whether
the final visible answer is successfully scrubbed. A content filter on
the output is a real, useful additional layer of defense in depth, but
it cannot substitute for retrieval-time access scoping when the stated
requirement is specifically about what gets retrieved, not just what
gets shown.

---

## 3.3 Orchestrating and coordinating agentic workflows (11 questions)

### Q23. "A code-review agent has two things it reaches out to: a static-analysis tool that scans a diff and returns a fixed-format report of style and lint violations, and a separate 'senior-review agent' another team built, which makes its own judgment calls about architectural risk in ambiguous cases. How do you wire each, and why are they different?"

**What's really being asked.** A fresh A2A-vs-MCP scenario in a
different domain (code review) than the ticketing/compliance pairing
used elsewhere in this folder, testing the same "does the other side
reason for itself" distinguishing question against a new pair of
targets.

```
   Code-review agent
        │
        ├──MCP──► Static-analysis tool
        │          (fixed-format lint/style report —
        │           no reasoning of its own)
        │
        └──A2A──► Senior-review agent
                   (own judgment on architectural risk;
                    can ask clarifying questions back;
                    can itself delegate further)
```

**Model answer.** These are different kinds of connections, and the
distinguishing test is the same one that applies everywhere in this
section: **does the other side reason and make judgment calls of its
own, or does it just execute a fixed capability and return a
deterministic result?** The static-analysis tool scans a diff against
fixed rules and returns a fixed-format report — there's no judgment
being exercised, no ambiguity being resolved, just a deterministic scan
executed and its result returned. That's a **tool**, reached via
**MCP** — I'd check whether a Google Cloud MCP Server or an established
static-analysis-vendor MCP server already exists before building a
custom wrapper, since static-analysis tooling is common enough that a
maintained server likely already exists.

The senior-review agent is categorically different: "makes its own
judgment calls about architectural risk in ambiguous cases" is exactly
the description of something that **reasons** — it's another agent,
built and owned by a different team, with its own decision-making
process, not a fixed-output function. That's an **A2A** relationship:
the code-review agent hands off ambiguous cases to the senior-review
agent as a genuine delegation, not a tool call, and the handoff should
carry identity (whose review is this, under what authority is the
senior-review agent being asked to weigh in) the way any A2A handoff
does.

The practical consequence of getting this backwards matters here too:
if the senior-review agent were treated as "just another MCP tool" the
code-review agent calls for a fixed judgment, the interaction would lose
A2A's ability to support the senior-review agent asking a clarifying
question back, or itself further delegating to a security specialist
agent for a case that turns out to touch a security-sensitive area — a
plain tool call has no mechanism for that kind of back-and-forth or
further recursive delegation, while A2A is specifically built to support
it.

**Why not "wrap the senior-review agent's capability as an MCP tool too,
since both are just 'external things this agent calls'"?** Because
"external thing this agent calls" collapses the one distinction that
actually matters here — whether the target has its own reasoning worth
preserving as a real agent-to-agent relationship, or is a deterministic
capability with no judgment of its own. The static-analysis tool
genuinely has no reasoning to lose by being wrapped as MCP; the
senior-review agent does, and treating it identically discards exactly
the coordination semantics (identity, recursive delegation, clarifying
back-and-forth) that make it useful as a specialist agent rather than a
glorified function call.

---

### Q24. "A market-research agent needs to gather current competitor pricing from five different public sources simultaneously, then have one agent synthesize the findings into a single comparison report. What orchestration shape fits, and how would you design the merge step?"

**What's really being asked.** A parallel-topology scenario in a
research/synthesis domain, testing correct topology identification
*and* attention to the merge-step design considerations (non-deterministic
completion order, partial failure) that a purely "which pattern applies"
answer would skip.

```
   Research task
        │
   ┌────┼────┬────┬────┐
   ▼    ▼    ▼    ▼    ▼
 Src1 Src2 Src3 Src4 Src5     PARALLEL — independent gathering
   │    │    │    │    │
   └────┴──┬─┴────┴────┘
           ▼
   Synthesis agent
   (merges whatever subset returned;
    order-independent; flags any
    source that failed to return)
           ▼
   Comparison report
```

**Model answer.** This is a clean **parallel** fit: each of the five
sources is gathered by an independent sub-task with no dependency on any
of the other four — nothing about scraping competitor A's pricing page
depends on the result of scraping competitor B's — so running all five
concurrently rather than one after another is pure latency win with no
correctness cost, exactly the signal this section's decision framework
names as parallel's textbook case.

Designing the merge step properly matters as much as picking the right
topology, though, and I'd design for two realities parallel execution
introduces that a sequential design wouldn't have to handle: **non-
deterministic completion order** (the five gathering agents won't
necessarily finish in source order, so the merge/synthesis agent has to
be built to combine results by content, not by assuming a fixed arrival
order) and **partial failure** (one of the five public sources being
temporarily unreachable shouldn't block the other four from completing
— I'd design the merge step to proceed with whatever subset actually
returned, explicitly noting in the final report which source(s) couldn't
be retrieved, rather than either failing the entire report over one
source's outage or silently omitting the gap without flagging it).

I'd also specifically confirm the "five sources" really are independent
before committing to parallel — if, say, one source's pricing were only
meaningful in the context of another source's currency-conversion data
(a real dependency, not just "both are pricing-related"), that would
change the actual dependency structure and push part of this toward a
graph or sequential shape for that specific pair, while the genuinely
independent sources stay parallel. I wouldn't assume independence just
because the scenario describes "five sources" without checking whether
any pair of them actually has a data dependency the description doesn't
make explicit.

**Why not "run the five gathering steps sequentially, so the synthesis
agent gets a clean, ordered set of results to work with"?** Because
that serializes work with no real ordering requirement purely to make
the merge step's implementation marginally simpler, paying real
wall-clock latency (the total time becomes the sum of all five lookups
instead of the slowest single one) for a convenience that a properly
order-independent merge design doesn't actually need — the fix for "the
merge step needs to handle out-of-order results" is designing the merge
step correctly, not avoiding the latency benefit parallel execution
otherwise gives for free.

---

### Q25. "A payment-fraud review system is built as a strict sequential pipeline: score the transaction, then if the score is high, route to human review; otherwise auto-approve. The team now wants to add: 'if the human reviewer flags a transaction as suspicious, send it back to the scoring agent with the reviewer's additional signals and rescore — up to two additional rounds — before making a final call.' Diagnose why the current architecture doesn't support this and redesign."

**What's really being asked.** Tests recognizing that a new requirement
introducing a **conditional loop with a bounded retry** structurally
breaks a sequential design, forcing a move to graph — a fresh domain
(payment fraud) applying the same reasoning pattern the domain file
teaches, but requiring the candidate to diagnose *why* the existing
design fails, not just design from scratch.

```
   BEFORE (sequential — cannot express the new requirement):

   Transaction ──► Score ──► [high?] ──► Human review ──► done
                               │no
                               ▼
                            Auto-approve
     (no path back to Score — "rescore with new signals" is
      structurally inexpressible in a fixed forward chain)

   AFTER (graph — conditional loop, bounded by agent policy):

   Transaction ──► Score ◄────────────────────┐
                    │                            │ loop, capped at
                    ▼                            │ 2 rounds by
                 [high?]──no──► Auto-approve      │ agent policy
                    │yes                          │
                    ▼                             │
              Human review                        │
                    │ flagged suspicious? ─yes─────┘ (back to Score,
                    │no                                +new signals)
                    ▼
             Final approve/deny
```

**Model answer.** The current design — score, then branch once to human
review or auto-approve — is genuinely sequential (with one simple
branch) as originally built, and it worked for that original
requirement. The new requirement breaks it structurally, not just adds
complexity to it: "send it back to the scoring agent... up to two
additional rounds" is a **loop with a bounded exit condition**, and a
sequential pipeline, by definition, has no mechanism to route control
flow **backward** to an earlier stage — it can only move forward. There
is no way to express "go back to step 1 with new information, and do
this up to twice" inside a structure whose entire definition is a fixed
forward chain.

The diagnosis to give the team plainly: this isn't a case of the
sequential pipeline needing "a bit more logic bolted on" — the new
requirement is a fundamentally different control-flow shape (a
conditional loop), and the fix is redesigning the relevant portion as a
**graph workflow**: a scoring node, a human-review node, a conditional
edge from human-review back to the scoring node (carrying the reviewer's
additional signals as new input) gated by an explicit **retry counter**
so it can't loop indefinitely, and a final conditional edge to a
terminal "approve" or "deny" state once either the score clears
confidently or the two-round retry budget is exhausted.

I'd also flag the same reasoning-loop risk this section names generally
for any bounded-retry design: without the explicit retry counter and a
hard cap enforced by an **agent policy** (not just implicit in the
prompt or hoped-for model behavior), a bug or an unusual case could
cause the score-review cycle to loop more than the intended two times,
consuming reviewer time and processing cost with no forward progress —
the cap needs to be a structural guarantee in the graph's design, not a
soft instruction.

**Why not "keep it sequential, but just add a rule that says 'if flagged,
restart the pipeline from the top'"?** Because "restart the pipeline
from the top" *is* a loop back to an earlier stage — describing it in
sequential-sounding language doesn't change that the actual control flow
now has a conditional backward edge, which a genuinely sequential
implementation (a fixed forward chain of steps, by definition) still
cannot express without either hard-coding a fixed number of duplicated
linear stages (score₁→review₁→score₂→review₂→score₃, brittle and
capped at whatever number was hard-coded) or actually building the graph
structure this redesign calls for. Calling it "sequential with a restart
rule" doesn't avoid needing the graph shape — it just delays writing it
down explicitly.

---

### Q26. "Design a multi-agent editorial workflow for a publishing company: three research agents gather background facts on a topic from different angles simultaneously, their combined findings feed into a draft-then-edit-then-proofread pipeline, and if the drafted content mentions any specific regulated financial or medical claims, it must additionally route to a legal-review agent before publication. Walk the full design."

**What's really being asked.** An integrative system-design question
requiring a candidate to correctly identify and compose all three
topologies (parallel, sequential, and graph) within one workflow, rather
than forcing the whole thing into a single pattern — testing the
"local coordination shape, not a mutually exclusive global architecture"
principle directly.

```
        ┌────────┐ ┌────────┐ ┌────────┐
        │Research │ │Research │ │Research │   PARALLEL
        │agent A   │ │agent B   │ │agent C   │   (independent angles)
        └────┬────┘ └────┬────┘ └────┬────┘
             └──────────┬┴──────────┘
                        ▼
                [merge findings]
                        │
                        ▼
        ┌────────┐   ┌────────┐   ┌────────┐
        │ Draft    │──►│ Edit     │──►│Proofread │   SEQUENTIAL
        │ agent     │   │ agent     │   │ agent      │   (fixed pipeline)
        └────────┘   └────────┘   └────┬───┘
                                         │
                             regulated-claim check (conditional)
                                         │
                         ┌───────────────┴───────────────┐
                         ▼ yes                            ▼ no
               ┌─────────────────┐                Publish directly
               │ Legal-review agent │                (graph branch)
               └─────────────────┘
```

**Model answer.** This workflow genuinely uses all three topologies,
each for the part of the structure it actually fits, composed together
rather than picked as one exclusive choice for the whole system.

**The three research agents** gathering background facts from different
angles, with no dependency between them, are a clean **parallel** fit —
they run concurrently, and their results merge into a combined
findings set once all three complete (with the same non-deterministic-
completion-order and partial-failure design considerations from Q24 —
if one research angle comes back empty, the draft agent should proceed
with what it has rather than blocking indefinitely on a source that
found nothing).

**The draft → edit → proofread pipeline** is a genuine ordered
dependency chain — editing needs a draft to work from, proofreading
needs an edited version, not the raw draft — so this segment is
correctly **sequential**: three agents, each consuming the prior one's
output, in a fixed order.

**The conditional legal-review routing** is where the workflow becomes a
**graph**: whether legal review happens at all *depends on the content
of the draft* (does it mention specific regulated financial or medical
claims), which is a runtime, content-dependent branch — neither the
parallel research stage nor the sequential draft/edit/proofread stage
can express "conditionally route to a different agent based on what the
content actually says." So the overall workflow's top-level shape is a
**graph** with a parallel sub-section (the three research agents) and a
sequential sub-section (draft/edit/proofread) nested inside it, plus a
conditional edge after the sequential stage that either routes to the
legal-review agent or proceeds directly to publication, depending on a
classification of the drafted content.

I'd implement the "does this mention regulated claims" check as its own
small, fast classification step (again, plausibly SLM-shaped) feeding
the conditional edge, rather than asking the proofreading agent to
double as both "polish the prose" and "decide if legal needs to see
this" — mixing those two concerns in one agent's system instructions
risks either capability being done less reliably than if the routing
decision were its own explicit, testable step.

**Why not "just run everything sequentially — research, then draft,
then edit, then proofread, then always route through legal review to be
safe"?** Because that serializes the three independent research agents
for no reason (paying unnecessary latency for concurrent work), and
routing *every* piece of content through legal review regardless of
whether it actually contains a regulated claim wastes legal review
capacity on content that structurally doesn't need it — the conditional
routing exists specifically so legal review capacity is spent where the
content genuinely warrants it, not as a blanket step applied uniformly
out of caution that the graph's own conditional logic is built to make
unnecessary.

---

### Q27. "In an expense-approval system, a request flows: submitter agent → policy-check agent → manager-proxy agent → finance agent → payment-execution agent. An audit finds a payment was executed for an amount and category that no single approver in the chain — including the original manager — had actually authorized. Diagnose the architectural flaw and redesign."

**What's really being asked.** A different-domain (finance/expense,
five hops) variant of the authority-creep failure mode, testing whether
a candidate applies the same per-hop-verification diagnosis and fix
without needing the exact wording from a prior example to recognize the
pattern.

```
  Submitter ──► Policy-check ──► Manager-proxy ──► Finance ──► Payment-
   agent          agent            agent             agent    execution
                                                                  agent
     │               │                 │                │           │
     └───────────────┴─────────────────┴────────────────┴───────────┘
        EVERY hop must independently re-verify amount/category
        matches what was actually authorized upstream (Agent Identity
        check AT EACH HOP) — not just "did a prior hop pass this along"
```

**Model answer.** This is **authority creep** across a multi-hop
delegation chain, the same structural flaw regardless of domain: if
each hop in the chain only checks "did the immediately preceding hop
have *some* authorization" rather than each hop independently verifying
its **own** bounded scope against the actual request, the effective
authority backing the final action can silently widen as it passes
through intermediate hops, until the payment-execution agent at the end
executes something that traces back to no single hop's actual, specific
authorization — exactly the outcome the audit found.

The most likely concrete failure: the **manager-proxy agent**
represents the manager's approval, but if it was only verified that "a
manager approved something" without the finance and payment-execution
agents independently re-checking that the *specific amount and category*
actually executed matches what that manager specifically authorized,
there's a gap where the request could have been modified (a category
change, an amount adjustment) somewhere after the manager's actual
approval and before payment executed, with no hop catching the
mismatch because each one only checked that *a* prior approval existed,
not that the *current* request still matches it.

The redesign, mirroring the same fix pattern this failure mode always
needs: every hop — not just the manager-proxy step — must independently
verify that the specific request it's now acting on (amount, category,
and any other material detail) matches what was actually authorized
upstream, via **Agent Identity** checks re-verified at each hop rather
than trusted implicitly from the previous hop's pass-through. The
**payment-execution agent** specifically, being the hop with the actual
real-world consequence, should have the tightest, most specific PAB
scope of the whole chain — it should be structurally incapable of
executing a payment whose amount/category doesn't match an
independently-verifiable chain of authorization, not merely "trusting"
that the finance agent upstream already checked. I'd also add an
**agent policy** that rejects the request outright (rather than
executing with a best-effort or degraded authorization) if any hop's
independent verification doesn't match, and caps the maximum chain
depth so a request can't be re-routed through additional, unaccounted-for
hops.

**Why not "add a final manual audit step before payment executes, to
catch mismatches before money moves"?** Because that's a detective
control bolted onto the end of a chain that still has the structural
flaw — it might catch this specific mismatch some of the time (if a
human happens to notice), but it doesn't fix the actual gap, which is
that no hop in the automated chain is independently re-verifying
authorization against the current request. A manual audit step also
doesn't scale as transaction volume grows, and it defeats much of the
purpose of automating the approval chain in the first place if every
payment still needs a human check to catch a structural gap the
architecture itself should close.

---

### Q28. "An orchestrator in a document-translation platform keeps routing certain requests to a 'legacy-translation-agent' that was formally decommissioned three weeks ago, causing those requests to fail outright. Diagnose the operational gap."

**What's really being asked.** Tests recognition of stale Agent Registry
entries as an operational-lifecycle gap, distinct from a design flaw —
checking that a candidate proposes registry lifecycle discipline as the
fix, not a code change to the orchestrator's routing logic itself.

```
   Translation request
         │
         ▼
   Orchestrator ──lookup──► Agent Registry
                                  │
                    returns: "legacy-translation-agent"
                    (decommissioned 3 weeks ago — STALE ENTRY)
                                  │
                                  ▼
                    ✕ request fails (agent unreachable)

   FIX: decommissioning must deregister the entry from
        Agent Registry as a required step, not an afterthought
```

**Model answer.** The orchestrator's routing logic is very likely
working exactly as designed — it queries Agent Registry, gets back
whatever agents are registered as capable of handling a translation
request, and routes accordingly. The actual gap is that **Agent
Registry's entry for the legacy-translation-agent was never removed or
updated when that agent was decommissioned**, so the registry is
telling the orchestrator a capability exists and is reachable when it
no longer is — this is a **catalog data-integrity problem**, not an
orchestration-logic bug, and the fix belongs at the registry-lifecycle
level, not inside the orchestrator's routing code.

I'd diagnose this by confirming the failure pattern matches: requests
failing specifically at the point of trying to reach the decommissioned
agent (not, say, failing for an unrelated reason that happens to
correlate with translation requests), and checking whether the
decommissioning process for that agent included a step to deregister it
from Agent Registry — if the answer is "no, decommissioning only
involved shutting down the agent's runtime instance, not updating the
registry," that confirms the gap precisely: the registry and the actual
running fleet of agents drifted out of sync because nothing enforced
them staying in sync.

The structural fix: treat **Agent Registry deregistration as a required,
non-optional step of any agent's decommissioning process**, the same way
a production service's decommissioning should always include removing
it from a service-discovery catalog — I'd propose this as a checklist
item enforced by whatever process governs decommissioning (ideally
automated, so a decommissioning action triggers deregistration rather
than relying on a person remembering an extra manual step). I'd also
recommend adding **monitoring specifically on registry-routing
failures** (an orchestrator repeatedly failing to reach a registered
agent is itself a detectable, alertable signal) so a future stale-entry
gap surfaces quickly rather than silently accumulating failed requests
for three weeks before someone notices, as apparently happened here.

**Why not "have the orchestrator fall back to a default agent whenever a
routed-to agent doesn't respond, so failures like this don't cause
outright request failures"?** Because that's a resilience patch that
masks the actual data-integrity problem rather than fixing it — requests
would silently succeed via a fallback path instead of failing loudly,
which means the stale registry entry could persist indefinitely with no
one ever noticing it's wrong, and any *other* agent that also happens to
route through that same stale entry inherits the same silent
misdirection. A resilience fallback is a reasonable **additional** layer
of defense, but it's not a substitute for actually keeping the registry
accurate.

---

### Q29. "A document-drafting agent and a document-reviewing agent are wired to hand a document back and forth — the reviewer sends revision requests, the drafter incorporates them and sends the revised draft back for another review pass. In production, a particular document has bounced between the two agents dozens of times with no sign of converging on an accepted final version, running up real processing cost. Diagnose and fix."

**What's really being asked.** Tests recognition of a cross-agent
reasoning-loop failure mode (as opposed to a single agent looping on
its own tool calls) and the correct fix — an agent-policy-enforced
bound plus an escalation path — rather than a purely technical retry-limit
patch with no escalation.

```
   ┌────────────┐   revision request    ┌─────────────┐
   │  Drafter     │◄─────────────────────│  Reviewer     │
   │  agent        │─────────────────────►│  agent         │
   └────────────┘    revised draft       └─────────────┘
        (bouncing dozens of times, no convergence —
         unbounded loop, real cost, no forward progress)

   FIX: agent policy caps round-trips (e.g. N=5) ──►
        cap exceeded ──► escalate to human editor
```

**Model answer.** This is a **cross-agent reasoning loop**: the same
underlying failure category task 4.2 names for a single agent (repeated
invocation with no forward progress), here occurring **across** a
two-agent handoff instead of within one agent's own tool-calling
behavior. The document is bouncing between drafter and reviewer with no
converging exit condition — nothing in the current design defines what
"good enough to stop" actually looks like, or how many rounds is too
many before something other than "try again" should happen.

The fix has two parts, and I'd build both rather than either alone.
**First, a bounded retry cap enforced by an agent policy**: cap the
number of draft-review round trips for any single document (a specific,
concrete number, not "keep going until it converges," since "dozens of
times with no sign of converging" is exactly the failure a bound
exists to prevent) — this is the same structural-cap principle from
Q25's payment-fraud rescore loop and Q27's handoff-depth guard, applied
here to a two-agent back-and-forth instead of a single-agent retry or a
delegation chain. **Second, and just as important, a defined escalation
path once the cap is hit**: the document shouldn't simply fail silently
or freeze at whatever state it's in when the round-trip cap is reached
— it should route to a **human editor** who can look at the actual
substance of the disagreement between drafter and reviewer and either
resolve it directly or provide the specific guidance neither automated
agent was converging on alone.

I'd also investigate, separately from the structural fix, **why this
particular document isn't converging** — it's worth understanding
whether the reviewer agent's revision requests are internally
inconsistent (requesting X in one pass, then requesting something that
contradicts X in a later pass) or whether the drafter agent is
misinterpreting genuinely consistent feedback — because if this is a
recurring pattern across many documents rather than a one-off, it points
at a design gap (perhaps the reviewer's system instructions need
tightening) worth fixing at the agent-behavior level, not just papering
over with a round-trip cap that treats every instance of this pattern
identically without asking why it keeps happening.

**Why not "just let it keep retrying, since eventually the two agents
will probably converge on an acceptable version"?** Because "dozens of
times with no sign of converging" is direct evidence against that
assumption for *this* document, and continuing to retry indefinitely on
unproven faith that convergence is imminent is exactly what runs up
unbounded processing cost with no guaranteed resolution — a bounded
cap with a real escalation path guarantees the document either
converges within a reasonable number of rounds or reaches a human who
can actually resolve it, which is a strictly better guarantee than
hoping an unbounded loop eventually stops on its own.

---

### Q30. "Before launching a new four-agent research-assistant system (an intake agent, two specialist research agents, and a synthesis agent), design the agent-policy layer proactively — before any handoff has actually gone wrong."

**What's really being asked.** Tests whether a candidate can design
agent policies **anticipatorily**, at launch time, rather than only
reactively after an incident (the shape of Q27's and Q29's diagnose-
after-the-fact questions) — checking that the same guardrails get built
in from the start rather than retrofitted.

```
   Intake agent
        │
   ┌────┴────┐
   ▼         ▼
 Specialist  Specialist    (each with its OWN scoped Agent
  agent A     agent B       Identity, re-verified per hop)
   │           │
   └─────┬─────┘
        ▼
   Synthesis agent

  agent policies defined BEFORE launch:
   - max handoff depth = 3
   - no re-entry into an agent already in this call chain
   - per-hop timeout + defined fallback (degrade / escalate)
```

**Model answer.** I'd design the agent-policy layer around the same
failure modes this section names as recurring risks in any multi-agent
system, building each guard in now rather than waiting for an incident
to justify it retroactively — retrofitting a policy after a real failure
is exactly the trap this section warns against elsewhere (a newly-added
capability or handoff path slipping through uncaught as "fine by
default" until something forces a fix).

**A maximum handoff-depth cap**: even though this system's intended
shape is intake → specialist(s) → synthesis, a policy explicitly
rejecting any call chain that exceeds a defined depth (say, intake →
specialist → synthesis, with no agent recursively handing back to an
earlier agent in the chain) guards against an unexpected loop forming
later — for instance, if the synthesis agent is later given a
capability to request clarification back from a specialist, a policy
against re-entering an agent already in the current call chain prevents
that from silently becoming an unbounded back-and-forth, the same
failure mode Q29 diagnosed after the fact.

**A rule against handing back to an agent already in the current call
chain**, specifically, rather than only capping total depth — depth
alone wouldn't stop A→B→A→B cycling within a shallow depth limit if
that specific cycling pattern isn't separately disallowed.

**Independent Agent Identity scoping per agent**, verified at every
hop rather than trusted from the calling agent, so that if the
synthesis agent is later given a broader capability than originally
scoped, that expansion doesn't silently propagate authority to the two
specialist agents that hand off to it — the same per-hop-verification
principle from Q27, applied here before any handoff has happened rather
than after an audit found a violation.

**A defined timeout/failure-handling rule per hop**: what happens if a
specialist agent doesn't respond or errors out — does the system retry,
degrade to using only the other specialist's findings, or escalate?
Deciding this now, explicitly, means a specialist agent's outage
produces a defined, tested behavior rather than an undefined one
discovered live in production.

I'd document all of these as the system's baseline agent-policy
configuration at launch, explicitly reviewed and signed off on before
the first real handoff occurs, rather than as an informal understanding
of "how it's supposed to work" that only gets written down after
something forces the question.

**Why not "launch with the straightforward happy-path design and add
policies reactively if something goes wrong, since we don't yet know
which failure modes this specific system will actually hit"?** Because
the failure modes this section names — handoff-depth creep, cross-agent
loops, authority creep across hops — aren't specific to this system;
they're structural risks inherent to *any* multi-agent handoff design,
regardless of the specific agents involved, and they're cheap to guard
against at design time versus expensive to diagnose and retrofit after
a real production incident (real cost, real downtime, an actual audit
finding) has already occurred. Waiting to see which failure this
particular system happens to hit first, when the failure modes are
already well-understood and generic to the pattern, trades a small
amount of upfront design discipline for a much larger, less predictable
later cost.

---

### Q31. "A fast-scaling startup wants to add a new specialized agent to its platform roughly every month, built by whichever team needs it, without funneling every new agent through a central orchestration team that they worry will become a bottleneck. They propose peer-to-peer agent coordination instead of a central orchestrator. Evaluate this."

**What's really being asked.** Tests the centralized-orchestrator-vs-
peer-to-peer tradeoff against a concrete growth-rate scenario, checking
that a candidate weighs the resilience/scale argument honestly rather
than defaulting to "always centralize" or "always decentralize."

```
  CENTRALIZED:                       PEER-TO-PEER:

  New agent ──register──► Agent      New agent ──registers
  Registry (reviewed,                 capability──► Agent Registry
  policy-checked)                     (lightweight), then discovers
       │                              + calls peers directly via A2A
       ▼                              — no central orchestrator
  Orchestrator routes                 in the loop
  all task decomposition
  (one place to trace
   success/failure)
```

**Model answer.** I'd take the bottleneck concern seriously — a central
orchestration team reviewing and wiring every new agent, at a pace of
roughly one new agent per month across multiple independent teams, is a
real, plausible chokepoint, and dismissing that concern outright would
be as much a mistake as accepting the peer-to-peer proposal
uncritically. But I'd walk through what centralized orchestration is
actually giving up before agreeing to remove it, because the tradeoff
this section names is real: a **centralized orchestrator** gives one
place to reason about overall task success criteria, apply agent
policies governing which handoffs are even allowed, and debug a failure
by tracing one component's routing decisions — **pure peer-to-peer
coordination** can scale more organically as new agents register new
capabilities without a central bottleneck, but makes it materially
harder to answer "did this task actually get done correctly end to end"
or to enforce a consistent policy (like the handoff-depth caps from
Q30) across agents that were never centrally reviewed together.

My actual recommendation would be a middle path rather than picking one
extreme: keep a **lightweight, fast-turnaround registration process**
(via Agent Registry) as the one mandatory central step — every new
agent still gets registered with its capabilities and its Agent
Identity scope reviewed against a baseline policy (similar to the
platform-wide defaults from Q10), but this review is designed to be
fast and largely self-service for the common case, reserving actual
human bottleneck-prone review for agents requesting elevated
permissions or genuinely novel capability categories. Handoff
**coordination** itself can then be more decentralized — agents
discovering and calling each other directly via A2A once registered,
without every single interaction routing through a central orchestrating
agent — while the **governance** layer (registration, identity scoping,
policy enforcement) stays centrally owned specifically because that's
the part where inconsistency across independently-built agents is
actually dangerous, not just organizationally inconvenient.

I'd propose testing this concretely rather than deciding by argument
alone: scope the next few new agents through the lightweight registration
process and measure whether the team actually experiences it as a
bottleneck in practice, adjusting the process's weight based on real
data rather than an assumption in either direction.

**Why not "just go fully peer-to-peer, since a startup adding a new
agent monthly needs speed more than governance rigor at this stage"?**
Because "needs speed" doesn't mean "can afford zero shared governance" —
even a fast-growing startup benefits from every agent having a
consistently-scoped, least-privilege Agent Identity and from having
*some* discoverable record of what capabilities exist (avoiding the
Q16-style integration-duplication problem as the agent count grows) —
fully abandoning central governance to solve a speed problem risks
trading a bottleneck concern today for a much harder-to-untangle
governance gap once a dozen independently-built agents with
inconsistent permission scoping are already running in production.

---

### Q32. "Design an end-to-end custom multi-agent system for a mid-size regional airline's crew-scheduling exception-handling platform. When a flight disruption creates a scheduling conflict, the system must interpret relevant union-contract rules and FAA regulations, check a specific crew member's current duty-hour and rest-requirement status, and propose a resolution — with crew-manager and line-pilot users seeing different levels of detail and different action permissions. Walk the full design."

**What's really being asked.** The file's integrative closer for a wholly
new vertical (airline crew scheduling, not Meridian or any Meridian-
adjacent scenario) — requiring model selection, a mixed RAG/structured-
data knowledge layer, role-based Agent Identity, and correctly-chosen
multi-agent orchestration to all compose into one coherent system.

```
   Disruption event
        │
        ▼
   ┌───────────────────────┐
   │ Intake/triage (SLM)         │  classify disruption type
   └─────────────┬─────────────┘
                 ▼
   ┌─────────────────────────────┐
   │ Contract/regulation                │──MCP──► Vector Search 1.0 +
   │ interpretation agent (LLM)           │         Agent Retrieval
   └─────────────┬───────────────┘         (union contract / FAA
                 │                            text, reranked)
                 ├──MCP──► Cloud SQL/Firestore
                 │          (crew duty-hour/rest status —
                 │           exact lookup, NOT semantic)
                 ▼
   ┌─────────────────────────────┐
   │ Proposed resolution                 │
   └─────────────┬───────────────┘
                 ▼
   Agent-Identity-scoped presentation (graph branch by role)
       ┌────────────┴────────────┐
       ▼                         ▼
  Crew-manager view          Line-pilot view
  (full detail + approve/      (own status +
   override actions)            limited actions)
```

**Model answer.** I'd design this as four coordinating pieces, each
decision traced back to a specific requirement in the prompt rather than
assumed.

**Model selection (3.1):** an **intake/triage agent** classifies the
disruption type and complexity (weather delay vs. crew illness vs.
mechanical issue each have different downstream implications) — narrow,
well-defined, high-volume-relative-to-the-other-steps (every disruption
passes through it first) — **SLM** fit. A **contract-and-regulation
interpretation agent**, reasoning over union-contract language and FAA
rules to determine what's actually permissible for a specific proposed
schedule change, needs genuine open-ended reasoning over nuanced,
sometimes-ambiguous legal-style text — **LLM**. Given no stated data-
residency or auditability requirement, I'd default both to **SaaS
Gemini LLMs/Model Garden** options, while flagging that if the airline's
union contract explicitly requires audit-defensible reasoning
transparency for any disputed scheduling decision (a real possibility in
a unionized environment), that would push the interpretation agent
toward the same OSS-for-auditability reasoning as Q3/Q11.

**Knowledge integration (3.2):** the union-contract and FAA-regulation
text is exactly the kind of prose, rule-heavy content needing **semantic
RAG** — Vector Search 1.0 / Agent Retrieval, with **reranking justified**
given how costly a wrongly-cited regulation would be in a
crew-scheduling dispute (the same precision-stakes reasoning as Q19's
insurance case). A specific crew member's **current duty-hour and
rest-requirement status**, though, is exact, structured, time-sensitive
operational data — a **structured lookup** (Cloud SQL or Firestore,
whichever the crew-scheduling system already uses), not something to
retrieve semantically, the same "match the access pattern to the right
service" distinction from Q19. **Agent Identity** scopes what each
requester's role can see and do: a line pilot's session should see their
own duty-hour status and any proposed resolution affecting them, without
crew-manager-level authority to actually approve or override a schedule
change — this is a role-based dynamic-scoping design similar in shape to
Q15's department scoping, here applied to hierarchical role permissions
instead of departmental data silos.

**Orchestration (3.3):** the overall flow — classify disruption, then
retrieve relevant rules, then check the specific crew member's status,
then propose a resolution — has real ordering dependencies for its core
path (you can't check permissibility before you know what's being
proposed, and you can't propose a resolution before you know the actual
rule constraints and the crew member's current status), making the core
path **sequential**. But the requirement that "crew-manager and line-pilot
users see different levels of detail and different action permissions"
is a role-dependent branch evaluated after the resolution is proposed,
which makes the overall shape a **graph with a sequential core** — the
same composed-topology pattern as Q26, here driven by *who's viewing*
rather than *what the content says*.

**Why not "build this as one large agent that handles classification,
rule interpretation, status lookup, and role-based presentation all in
a single reasoning loop, since it's ultimately one workflow"?** Because
collapsing distinct concerns — a narrow classification task, a genuinely
different exact-lookup data-access pattern, and role-dependent
presentation logic — into one agent's system instructions produces the
same degradation risk named in the multi-agent-vs-single-agent tradeoff
elsewhere in this section: each concern gets handled less reliably as
the single agent's instructions grow to juggle all of them at once, and
model selection can no longer be tuned per sub-task (the classification
step is stuck paying for whatever model size the hardest reasoning
sub-task requires), which is exactly the cost this design's per-agent
model selection above is built to avoid.

---

### Q33. "Here's the current production setup for a multi-agent order-fulfillment system: an orchestrator agent has the network addresses of its three specialist agents hard-coded directly into its own configuration; all four agents — the orchestrator and all three specialists — share one Agent Identity 'for operational simplicity'; every request runs through all three specialists strictly one after another even though two of the three specialists' work has no dependency on each other; and there is no policy limiting how many times any handoff can occur. Diagnose every architectural flaw you can find and redesign."

**What's really being asked.** A composite diagnose-a-failing-system
question deliberately stacking four separate flaws from across task 3.3
into one production configuration — the intended closing question for
this file, testing whether a candidate can work through multiple,
independent problems in one system rather than fixating on the first
one noticed and missing the rest.

```
   BEFORE (all four flaws present):

   Orchestrator ──(hard-coded address)──► Specialist 1
        │         (hard-coded address)──► Specialist 2
        │         (hard-coded address)──► Specialist 3
        │
        ▼
   ALL FOUR AGENTS SHARE ONE Agent Identity
        │
   Specialist 1 ──► Specialist 2 ──► Specialist 3   (forced sequential,
                                                       even though 2 & 3
                                                       are independent)
   (no cap anywhere on handoff count)

   AFTER (all four flaws fixed):

   Orchestrator ──Agent Registry lookup──► discovers Specialist 1/2/3
        │          (each with its OWN scoped Agent Identity)
        │
        ├──sequential──► Specialist 1 (genuinely dependent step)
        │
        └──parallel───┬──► Specialist 2 ─┐
                       └──► Specialist 3 ─┴──► merge

   agent policy: max handoffs = N; no re-entry into call chain
```

**Model answer.** I'd work through this systematically rather than
stop at the first issue, because all four problems described are real,
independent flaws, each with its own fix — treating this as "find the
one bug" would leave three genuine risks unaddressed.

**Flaw 1 — hard-coded network addresses instead of Agent Registry
discovery.** Hard-coding each specialist's address means the
orchestrator has no way to discover new specialists, no way to react
gracefully if a specialist's address changes, and — exactly like Q28's
stale-registry incident, just inverted — no central catalog reflecting
what specialists actually exist and are reachable right now. **Fix:**
register all three specialist agents and their capabilities in **Agent
Registry**, and have the orchestrator discover them via lookup rather
than a static configuration file, so the fleet of specialists can change
without requiring an orchestrator redeploy.

**Flaw 2 — one shared Agent Identity across all four agents.** This is
precisely Q20's least-privilege violation: a flaw or compromise in any
one of the four agents has blast radius across everything all four
were ever granted access to, rather than being contained to that one
agent's actual scope. **Fix:** a **distinct Agent Identity per agent**,
scoped to only what each one's specific task genuinely requires,
following the same per-agent audit-and-scope process from Q20.

**Flaw 3 — forced sequential execution of two independent specialists.**
If two of the three specialists' work genuinely has no dependency on
each other, running them strictly one after another (per this
description's own admission) wastes real latency for no correctness
benefit — the classic don't-default-to-sequential trap. **Fix:**
restructure so those two independent specialists run in **parallel**,
merging their results, while any genuinely dependent third specialist
stays in its correct sequential (or, if its dependency is conditional
rather than fixed, graph) position relative to the other two.

**Flaw 4 — no policy limiting handoff count.** With no cap, this system
is exposed to exactly the unbounded cross-agent loop risk diagnosed
reactively in Q29 — nothing here has yet gone wrong per the description,
but nothing structurally prevents it either. **Fix:** an explicit
**agent policy** capping maximum handoffs per request and rejecting
re-entry into an agent already in the current call chain, put in place
proactively (per Q30's reasoning) rather than waiting for an actual
runaway loop to justify it.

I'd present these as four separate, independently fixable items rather
than one big rewrite — Agent Registry migration, per-agent identity
scoping, the parallel-restructure of the two independent specialists,
and the new handoff policy can each land as their own change, in
whatever order the team can safely sequence given the running production
system, rather than treating "fix everything" as one indivisible,
higher-risk deployment.

**Why not "since only the sequential-vs-parallel issue is a performance
problem and nothing has actually broken yet from the other three,
prioritize just that one and leave the rest as-is for now"?** Because
"nothing has broken yet" describes the hard-coded-addresses, shared-
identity, and no-handoff-cap issues as *latent* risks, not non-issues —
each is exactly the kind of gap that looks fine right up until a
specialist's address changes, one agent's flaw needs to be contained,
or a genuine cross-agent loop actually occurs, at which point the fix
happens reactively, under incident pressure, instead of proactively, on
the team's own schedule. The performance issue is real, but treating the
other three as lower priority because they haven't yet caused a visible
incident is the same "wait for the wall" mistake this section
consistently argues against, just applied to production reliability and
security risk instead of engineering-overhead risk.

---

## Quick index

| # | Task | Type | One-line topic |
|---|---|---|---|
| Q1 | 3.1 | System design | Model tiering across two sub-tasks at high volume |
| Q2 | 3.1 | Design | Self-hosted forced by cross-border data-residency law |
| Q3 | 3.1 | Design | OSS-auditability vs. peak-capability tension |
| Q4 | 3.1 | Recall/trap | ADK open-source correction, and what it does/doesn't imply |
| Q5 | 3.1 | System design | Sessions vs. Memory Bank in a telecom support call |
| Q6 | 3.1 | Design | Per-capability agent/human mode for a legal-review agent |
| Q7 | 3.1 | System design | Edge/self-host/IP-boundary model strategy, 3 components |
| Q8 | 3.1 | Diagnose | Uniform frontier-model use causing latency + cost blowup |
| Q9 | 3.1 | Design | Air-gapped hosting forces one axis, leaves two open |
| Q10 | 3.1 | Design | Fleet-wide Agents CLI governance across 12 teams |
| Q11 | 3.1 | System design | Healthcare triage: compliance vs. capability, with fallback |
| Q12 | 3.2 | Design | RAG chunking for mixed prose + structured-logic content |
| Q13 | 3.2 | Diagnose | Embedding-model mismatch after a platform update |
| Q14 | 3.2 | Tradeoff | When to skip reranking for a low-stakes tool |
| Q15 | 3.2 | System design | Dynamic per-department Agent Identity, one shared agent |
| Q16 | 3.2 | Diagnose | Five duplicated CRM integrations, fix via Agent Registry |
| Q17 | 3.2 | Design | Google Cloud MCP Server vs. custom, per target |
| Q18 | 3.2 | Design | Resisting a premature Agent Search → Vector Search migration |
| Q19 | 3.2 | System design | Semantic RAG + exact-lookup combined in one agent |
| Q20 | 3.2 | Diagnose | Shared broad Agent Identity across six production agents |
| Q21 | 3.2 | Design | MCP-first integration for two third-party targets |
| Q22 | 3.2 | System design | Retrieval-time (not output-time) blinding for clinical data |
| Q23 | 3.3 | Design | A2A vs. MCP for a static-analysis tool vs. a senior-review agent |
| Q24 | 3.3 | Design | Parallel research gathering + a properly designed merge step |
| Q25 | 3.3 | Diagnose | Sequential pipeline broken by a new bounded-retry requirement |
| Q26 | 3.3 | System design | Composing parallel + sequential + graph in one workflow |
| Q27 | 3.3 | Diagnose | Authority creep across a 5-hop expense-approval chain |
| Q28 | 3.3 | Diagnose | Stale Agent Registry entry routing to a decommissioned agent |
| Q29 | 3.3 | Diagnose | Cross-agent reasoning loop between drafter and reviewer |
| Q30 | 3.3 | System design | Proactive agent-policy design before launch |
| Q31 | 3.3 | Tradeoff | Centralized orchestrator vs. peer-to-peer at scale |
| Q32 | 3.3 | System design | Full-stack airline crew-scheduling multi-agent system |
| Q33 | 3.3 | Diagnose | Four stacked architectural flaws in one production system |
