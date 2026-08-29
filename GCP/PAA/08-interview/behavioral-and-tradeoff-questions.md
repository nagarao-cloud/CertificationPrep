# Behavioral & Tradeoff Questions — Professional Agentic Architect

> **What this file is.** 13 questions that probe **judgment**, not
> technical recall — the kind that ask you to make a call under
> real-world pressure (a skeptical stakeholder, a budget cut, a
> deadline, two teams disagreeing) and explain *why* you cut it the way
> you did. There's rarely a purely technical right answer here; what
> matters is showing the reasoning process an architect actually uses
> to weigh cost, risk, speed, and stakeholder trust against each other
> — and being honest about what you're giving up with each choice, not
> just what you're gaining.
>
> Contrast with `agentic-architect-scenario-questions.md`, which asks
> "design this system" — these questions instead ask "defend this
> decision" or "what do you cut, and to whom do you have to justify
> it." Several explicitly put words in a skeptical stakeholder's mouth,
> because defending a tradeoff out loud, to someone who disagrees, is a
> different skill than reasoning about it silently.
>
> **Currency note.** Same corrections as the rest of this folder:
> **Agent Runtime** (never Agent Engine), **Agent Search** (never
> Vertex AI Search), **Gemini Enterprise** (never "Vertex AI Agent
> Builder"), **Antigravity** / **Claude Code on Google Cloud** (never
> "Gemini Code Assist"), **ADK is open-source**, **PAB via Agent
> Identity** (not generic IAM). See `../CLAUDE.md` §7.

---

### B1. "When would you choose a low-code agent (Gemini Enterprise / CX Agent Studio) over a custom ADK build — and how would you justify that to an engineering-culture stakeholder who assumes 'real' engineering always means custom code?"

**The judgment being tested.** Whether "low-code" gets treated as a
legitimate architectural choice with its own real tradeoffs, or as a
lesser fallback only acceptable when you can't do better.

**Model answer.** I'd choose low-code when the conversation genuinely
fits a state-machine shape, the team isn't primarily engineers, or
time-to-first-version outweighs deep customizability — and I'd say
that plainly, because it's the actual reasoning, not a euphemism for
"we didn't have time to do it properly."

To a skeptical engineering stakeholder, I'd reframe the comparison away
from "code vs. no code" and toward "who owns the iteration loop, and
does that match this system's actual change cadence." A support FAQ
flow changes when policy changes — a business owner needs to edit a
page's routing without waiting on an engineering deploy cycle. That's
not a consolation prize; it's a genuine capability custom code doesn't
give you for free (you'd have to build an equivalent config-driven
layer yourself, which is real, non-trivial engineering effort spent
recreating what the low-code platform already provides). I'd also be
upfront about what I'm giving up — retrieval-pipeline control, custom
orchestration, non-Gemini model choice — and commit to a concrete,
evidence-based trigger for revisiting: "if we hit [multi-agent need /
bespoke retrieval requirement], that's the signal to move to ADK, not
a vague sense that custom is always better."

**What I'd avoid saying:** "low-code is just for prototypes" — that's
not true (a well-designed low-code CX agent is a legitimate production
system, per `04-architectures/pattern-low-code-cx-agent.md`), and
conceding a false premise to win the room costs credibility the moment
someone tests it.

---

### B2. "Your evaluation pipeline's token spend is running well over budget this quarter. What do you cut first, and why that and not something else?"

**The judgment being tested.** Cost triage under pressure — cutting
based on where marginal value is actually lowest, not just cutting the
newest or most visible line item.

**Model answer.** I'd cut in this order, and explain why each is lower
marginal value before the next: **first**, redundant evaluation
coverage — if custom autoraters and the Agent Platform Gen AI
evaluation service are both scoring the same criterion with no
distinct signal between them, that's duplicated spend I can consolidate
without losing information. **Second**, evaluation frequency on
low-change-velocity agents — a stable agent that hasn't changed in
weeks doesn't need the same continuous-evaluation cadence as one
actively being iterated on; I'd shift it to a lighter check cadence,
not cut it to zero, since drift can still happen even without a code
change. **Third**, I'd look at whether the evaluation set itself has
grown bloated with near-duplicate test cases that don't add new
coverage, rather than cutting genuinely distinct edge cases just to hit
a number.

**What I would not cut first:** coverage on the highest-risk agent
categories — anything gating a HITL/high-risk-action decision, or the
custom autorater checking a nuanced domain-specific criterion generic
tools miss. Cutting there is cheap in the short term and expensive the
moment it lets a real regression through into production, which is a
worse cost than the token spend it saved. I'd say this directly to
whoever set the budget target: "I can hit this number, but here's
specifically what marginal coverage we're accepting less of, and here's
the one category I'm recommending we protect even if it means the cut
comes from somewhere else."

**Why not "cut evenly across everything by X%"?** Because an even cut
treats all coverage as equally valuable, which it isn't — it protects
the least useful and the most useful test cases identically, which is
worse than a deliberate, risk-ranked cut.

---

### B3. "A product team wants full autonomy — no HITL gate at all — on an agent that can issue account credits up to $200. Security wants HITL on every credit action regardless of amount. You have to recommend a middle position. What is it, and how do you defend it to both sides?"

**The judgment being tested.** Calibrating a real risk-based control
rather than picking a side, and being able to justify the specific
threshold, not just the existence of one.

**Model answer.** I'd recommend a **rule-based split by amount and
account history**, not a flat toggle either direction: credits under a
defined low threshold (say, tied to typical support-resolution amounts,
determined jointly with the business, not arbitrarily chosen by me
alone) to a customer with no recent credit history proceed
autonomously; credits above that threshold, or a pattern of repeated
credits to the same account in a short window, route to a HITL gate.
This is the same risk-calibration reasoning behind PAB and HITL design
generally (`04-architectures/pattern-secure-governed-enterprise-agent-
platform.md` §6.2): most of the value of automation lives in the high-
volume, low-stakes majority of cases, and most of the *risk* is
concentrated in a small minority — a well-placed threshold captures
most of the throughput benefit while reserving human judgment for
where getting it wrong is actually expensive.

**To the product team**, wanting zero gating: I'd show that most
individual credit actions would still clear automatically under this
design — the gate only catches the statistically small slice that's
either unusually large or an unusual pattern — so they're not losing
the throughput benefit they're actually after, just accepting a
backstop on the genuinely risky tail.

**To security**, wanting a gate on everything: I'd point out that
"HITL on every single credit" turns the agent into a drafting tool, not
an autonomous system, defeating the automation's purpose entirely — and
that a threshold tuned conservatively at launch, with a defined review
cadence to adjust it as real data comes in, gives them a genuine
control *and* an evidence-based path to loosening it later, which a
flat "always require a human" position doesn't offer any way to
revisit.

**What I would not do:** let this become "whoever pushes harder wins"
— I'd insist the threshold be set from actual risk data (typical
support-credit amounts, historical fraud patterns) rather than a
negotiated compromise number that satisfies neither side's actual
reasoning.

---

### B4. "You're choosing between Agent Runtime and GKE for a new multi-agent deployment, and the platform team pushes back: 'we already run everything on GKE, adding Agent Runtime means a second thing to operate.' How do you respond?"

**The judgment being tested.** Whether operational-consistency
pressure gets weighed honestly against what's actually lost by
defaulting to the familiar option, rather than either caving or
dismissing the concern.

**Model answer.** I'd take the concern seriously rather than
overriding it on pure technical merit — "one more thing to operate" is
a real, recurring cost, not a throwaway objection. But I'd walk through
specifically what GKE doesn't give this workload for free: native
Agent Registry discovery, Agent Identity's per-hop PAB checks across a
multi-agent A2A chain, and session/coordination primitives Agent
Runtime provides out of the box. Building equivalents of those on raw
GKE is real engineering work the platform team would then own and
maintain indefinitely — which is a *larger* long-run operational
burden than adding one more managed service, even though it feels
smaller today because it doesn't show up as "a new thing in the
dashboard."

I'd propose a concrete way to test the tradeoff rather than settle it
by argument: scope the first multi-agent workload small, deploy it on
Agent Runtime, and have the platform team assess after a defined period
whether the native integration genuinely saved the work I'm claiming
it would, or whether GKE standardization would have been fine after
all. If the team's GKE tooling and expertise are deep enough that the
native integrations aren't actually saving much in practice, that's a
legitimate reason to reconsider — I'd rather be proven wrong with real
data than win an argument I can't back up operationally.

**Why not just defer to "team already knows GKE, use what they
know"?** Because familiarity is a real factor but not the only one —
optimizing purely for what the team already operates, on a workload
type (agent-native, multi-hop, identity-heavy) that's specifically what
Agent Runtime exists for, risks quietly rebuilding platform features
from scratch under a different name, which costs more in the long run
than the short-term comfort it buys.

---

### B5. "Your evaluation coverage is genuinely thin — you know it — but the business wants to ship by Friday. Do you ship?"

**The judgment being tested.** Whether risk gets communicated honestly
under deadline pressure, and whether the mitigations offered are real
or theater.

**Model answer.** I wouldn't frame this as a binary ship/don't-ship
decision I make unilaterally — I'd surface the actual gap explicitly to
whoever owns the ship decision, in concrete terms: which categories of
question or action are under-tested, and what kind of failure that
realistically risks in production, not a vague "coverage is low."
Given that framing, my recommendation would depend on what the agent
can actually do: if it's read-only/advisory (like Meridian's current
scope), thin coverage is a real but bounded risk — I'd recommend
shipping behind a **tight canary** (a small traffic percentage or a
limited internal user group) with elevated monitoring specifically on
the under-tested categories, rather than either a full block or a full
launch. If the agent can take real-world actions, I'd push back harder
on shipping Friday at all, because a staged rollout doesn't bound the
risk the same way when the failure mode is "did something wrong" rather
than "said something wrong."

**What I would not do:** quietly ship with known-thin coverage and say
nothing, hoping it holds — and I also would not pad the evaluation
report to look more complete than it is just to relieve deadline
pressure. Both are worse than an honest "here's the actual gap, here's
what I recommend given it, you decide with full information" — the
business may have context I don't (a low-stakes internal pilot, a
committed date with real consequences) that changes the right call,
but that's their call to make with accurate information, not mine to
make by omission.

---

### B6. "A stakeholder asks why you're using a Google Cloud MCP Server instead of writing a custom integration for a third-party tool the agent needs. 'We have engineers, why not just build it exactly how we want it?'"

**The judgment being tested.** Build-vs-buy reasoning specific to
agent tooling — not defaulting to custom just because engineers are
available, but also not blindly preferring managed just because it
exists.

**Model answer.** I'd start from task 3.2's own framing: prebuilt
integration layers (Google Cloud MCP Servers) and custom integration
code are both explicitly legitimate options, not a hierarchy where one
is always right. My actual test: does the prebuilt MCP server cover
what this integration needs, and is the tool's behavior standard enough
that "exactly how we want it" doesn't actually differ meaningfully from
the standard behavior? If yes, custom code here is spending engineering
time re-solving a problem someone already solved and maintains — every
future protocol update, auth-flow change, or edge case in the
third-party API becomes this team's maintenance burden instead of the
platform's.

I'd reach for custom integration instead when the prebuilt server
genuinely doesn't expose something this specific workflow needs — a
non-standard auth flow, a data transformation the standard server
doesn't support, or tight coupling to an internal system no generic
server could know about. That's a real, common reason to go custom —
I'm not arguing "always prefer managed," I'm arguing "start from what's
already built, and have a specific, nameable gap before paying to
rebuild it."

**Why not "always prefer the managed option, it's less code to
maintain"?** Because that's just as much a reflexive default as
"always build custom" — if the managed server's defaults genuinely
don't fit (a real technical gap, not just unfamiliarity), forcing the
integration through it anyway produces something worse than either
honest option, which is a workaround built on top of a mismatched
abstraction.

---

### B7. "You've designed a three-agent orchestration for a task a colleague argues could be done just as well by one well-prompted ADK agent. They think you're over-engineering it. Are they right?"

**The judgment being tested.** Honest self-scrutiny about premature
multi-agent complexity — a named exam trap
(`04-architectures/pattern-custom-multi-agent-adk.md` §6.4) — rather
than defending a design because it's already built.

**Model answer.** I'd genuinely re-examine it rather than defend it
reflexively, because my colleague's challenge maps directly onto a real
failure mode: multi-agent orchestration adds real coordination cost
(protocol plumbing, inter-agent identity, more surfaces to evaluate and
secure) that has to be justified by an actual specialization benefit,
not assumed as free architecture. My honest test: does the task
genuinely decompose into sub-tasks that benefit from separate reasoning
contexts (different tools, different model needs, different failure
modes worth isolating), or am I splitting it because three agents
*feels* more sophisticated than one? If a single agent's system
instruction is manageable in scope and doesn't need to juggle
conflicting concerns (e.g., "be fast and cheap" vs. "reason deeply"),
my colleague is probably right, and I should collapse it back to one
agent.

Where I'd hold my ground: if the sub-tasks genuinely need different
model tiers (a cheap SLM for classification, a strong LLM for the hard
case) or the task will predictably grow into something that needs
independent iteration per sub-task, the orchestration overhead is
justified *now*, not just eventually — but I'd say that specifically,
with the concrete reason, rather than a general "multi-agent is more
robust."

**Why is this question worth asking myself, not just answering
defensively?** Because "I already built it this way" is not itself a
justification, and the actual cost of over-engineered orchestration
(more to evaluate, more to secure, more latency from handoffs) is real
and ongoing, not a one-time sunk cost I can shrug off once the system
ships.

---

### B8. "Leadership wants to skip the low-code MVP entirely for a new project and go straight to a custom ADK build, because 'we know we'll need custom orchestration eventually anyway.' Do you agree?"

**The judgment being tested.** Resisting a plausible-sounding argument
for premature complexity, grounded in the same reasoning the Meridian
capstone itself makes explicit in its own requirements phase.

**Model answer.** I'd push back, but with the actual reasoning, not
just "always start with low-code." The argument "we'll need it
eventually" conflates *eventual* need with *current* need — the low-
code MVP's value isn't just speed, it's validating the concept cheaply
against real usage before committing engineering time to a custom
build whose exact shape you can't fully know yet. Real usage data from
an MVP (which questions actually get asked, where retrieval genuinely
falls short, whether the "eventually need custom orchestration"
assumption even holds once real users are involved) is worth more than
guessing at the custom design up front — and if the MVP validates the
concept and the custom-orchestration need turns out real, you've lost
only weeks, not the whole investment.

I'd agree to skip the MVP only if there's a *concrete*, already-known
reason low-code structurally can't express the requirement from day
one — e.g., the requirement genuinely is multi-agent specialist
routing from the very first release, not a "probably eventually"
guess — in which case building the low-code layer first would be
pure throwaway work, not validation.

**Why not just defer to leadership's judgment since they know the
business context?** Because my job here is to make the tradeoff
visible, not to silently comply with or silently override it — I'd lay
out the actual cost of being wrong each direction (MVP-first: a few
weeks lost if custom really was needed immediately; custom-first: a
much larger sunk cost if the assumption about future need doesn't
hold, or holds differently than guessed) and let leadership decide with
that visible, not decide for them by unilaterally building whichever I
personally prefer.

---

### B9. "A CFO asks why you're recommending PAB, Agent Gateway, Model Armor, Sensitive Data Protection, AND HITL for one system — 'isn't that a lot of overlapping security tools for one chatbot?'"

**The judgment being tested.** Explaining defense in depth to a
non-technical, cost-conscious stakeholder without hand-waving "more
security is always better" — naming what each control specifically
catches that the others don't.

**Model answer.** I'd answer with the specific gap each one closes,
not a general "layered security is best practice" — because the CFO's
skepticism is fair; redundant controls *would* be wasted spend, so I
need to show these aren't redundant. **PAB (Agent Identity)** answers
"is this person even allowed to ask this" — a correctly-authenticated
employee can still be scoped out of compensation-band HR content.
**Agent Gateway** is the checkpoint that makes sure that check (and
every check after it) actually runs on every call, not just some of
them. **Model Armor** catches something PAB can't: a document with
hidden malicious instructions, which has nothing to do with who's
asking. **Sensitive Data Protection** catches something Model Armor
can't: perfectly safe-looking content that happens to contain a
number that shouldn't have been in the answer. **HITL** catches
something none of the content or identity checks can: an action too
consequential to automate regardless of how clean everything upstream
looked.

I'd concretely name a real incident type each layer *alone* would
miss the others — a properly-authorized employee getting an answer
that leaks a specific compensation figure (PAB passes, only Sensitive
Data Protection catches it); a hidden prompt-injection in an internal
document (PAB and Sensitive Data Protection both pass it through
cleanly, only Model Armor catches it) — because abstract "defense in
depth" is a slogan until it's tied to a specific failure each layer
alone would let through.

**Why not "trust the model's built-in safety training, skip the
extra layers"?** Because model-level training can't be tuned to
Meridian's specific sensitive-data categories, produces no independent
audit log, and has no equivalent of a hard action-risk gate — this is
a concrete reason, not "more layers are inherently safer," and it's the
version of this answer that actually survives a cost-conscious
follow-up question.

---

### B10. "Two teams disagree: one wants conversation designers (non-engineers) to own and edit the agent's behavior directly in production; the other wants every behavior change to go through engineering review and a deploy pipeline, even for a low-code agent. How do you mediate?"

**The judgment being tested.** Balancing iteration speed against
change control — recognizing this isn't a technology question, it's a
governance-maturity question, and that the right answer likely differs
by risk tier.

**Model answer.** I wouldn't pick one side wholesale — I'd split by
what's actually being changed. Low-risk, easily-reversible edits
(rewording a response, adjusting a prompt template's phrasing, tweaking
a route's confidence threshold) are exactly what low-code's
"business-side ownership, no deploy cycle" value proposition is for —
gating every one of those behind engineering review defeats the reason
the organization chose low-code in the first place. Changes with
real downstream risk (adding a new data connector with different
access-sensitivity, modifying an escalation/HITL-adjacent route, adding
a fulfillment webhook that reaches a new external system) should go
through review — those touch exactly the failure modes (access-control
leaks, missing escalation paths) that `04-architectures/pattern-low-
code-cx-agent.md` §7 names as real production risks specific to this
pattern.

I'd propose this as a concrete boundary — a defined list of change
types that stay in conversation-designer self-service, and a defined
list that require review — rather than leaving it as a vague "use
judgment," specifically because vague boundaries are what let both
teams' worst fears happen: either genuinely risky changes slipping
through unreviewed, or trivial wording tweaks getting stuck behind an
engineering queue for no real safety benefit.

**Why not "engineering review for everything, full stop"?** Because
that's the same over-correction as B5's "gate everything" instinct —
it eliminates the specific value low-code was chosen for, and a team
that finds review too slow for trivial changes will find informal ways
around it, which is worse than a deliberately-scoped fast path.

---

### B11. "You're advising a new PAA-track team on where to invest their first month of study/build effort. Given the exam's own section weights (Section 3 ~33%, Section 4 ~22%, Section 5 ~15%, Section 2 ~17%, Section 1 ~13%), how do you justify allocating time disproportionately to Section 3?"

**The judgment being tested.** Reasoning about prioritization from
stated weights, and defending a non-even allocation to someone who
might assume "five sections means roughly five equal chunks of time."

**Model answer.** I'd make the case directly from the numbers, not
from a vague "custom development matters most" instinct: Section 3 is
nearly a third of the entire exam on its own — roughly double any
other single section's weight, and roughly equal to Sections 1, 2, and
5 *combined* (13 + 17 + 15 = 45, close to 33 alone being disproportionate
relative to any one of them). Treating five sections as five equal
buckets of study time would under-invest in the single highest-leverage
area and over-invest in comparatively low-weight ones. Beyond the raw
percentage, Section 3 is also the *architectural core* the other
sections build on or wrap around — the evaluation pipeline (Section 4)
evaluates agents Section 3 builds, the security layer (Section 5) wraps
around Section 3's agents and orchestration, and Section 2's coding
agents often end up *building* Section 3's custom agents. Under-
investing there weakens understanding of material the other four
sections partly depend on, not just losing points on Section 3's own
questions directly.

**What I'd caution against:** treating "spend a third of the time on
Section 3" as license to entirely skip depth on the other sections —
Section 1 alone is still ~13% of real exam weight, and a team that
optimizes purely for the biggest section while treating a ~13% section
as an afterthought is still leaving points on the table there. The
allocation should be *proportional*, not *exclusive*.

---

### B12. "A vendor pitches you on replacing Meridian's RAG Engine + Vector Search 1.0 + Agent Retrieval pipeline with a fully custom-built retrieval stack the vendor's team would hand-build for 'maximum control.' How do you evaluate this?"

**The judgment being tested.** Resisting a plausible "more control is
always better" pitch by testing it against an actual, named need,
rather than either accepting or rejecting it on vibes.

**Model answer.** I'd ask the vendor the same question I'd ask myself
before choosing direct wiring over the managed pipeline in the first
place (`04-architectures/pattern-custom-multi-agent-adk.md` §6.1):
what *specific* control does the managed pipeline not give us that this
custom build would? "Maximum control" isn't itself a requirement —
it's only valuable if there's a concrete gap it closes: a chunking
strategy for an unusual document format, an embedding model RAG
Engine's defaults don't support, or reranking logic tuned to a
domain-specific relevance criterion. If the vendor can name one of
those and it's real, that's a legitimate case for more direct control
over that specific stage — not necessarily the whole pipeline. If the
answer is a general "you'll have more flexibility," without a concrete
gap Meridian's current corpus and query patterns actually hit, I'd
treat that as a red flag: we'd be taking on the ongoing maintenance
burden of a hand-built retrieval stack (and losing RAG Engine's
coordinated ingestion/query-time embedding consistency, a real
mitigation against a known failure mode) to solve a problem we don't
currently have.

**Why not just say yes because "custom is always better than
managed"?** Because that's the same reflexive-build-preference trap as
B6 — the actual question is always "what specific, real limitation
does the managed option have for *this* workload," and a vendor pitch
built on abstract flexibility rather than a named gap is optimizing for
selling a service, not for Meridian's actual retrieval-quality problem.

---

### B13. "Your team ships an agent that performs well in evaluation but a security reviewer, late in the process, flags that its tool-access scope is broader than the task needs. Do you ship on schedule and fix scope in a fast-follow, or hold the release?"

**The judgment being tested.** Weighing schedule pressure against a
late-discovered security gap honestly, without either blindly holding
every release for any finding or reflexively shipping past a real one.

**Model answer.** I'd hold, and I'd be specific about why over-broad
tool scope is not a "fast-follow later" category of issue: it's
exactly the failure mode described in the coding-agent sandbox-escape
scenario (Q4 in the scenario-questions file) and the security
pattern's own framing — an over-permissioned credential or tool
connection doesn't need a separate exploit to cause damage, it just
needs one bad decision by the agent (a mistaken action, a manipulated
input) to reach something it never should have been able to touch in
the first place. That risk exists from the moment of launch, not after
a fast-follow lands — "we'll narrow scope next sprint" leaves the wide
window open in production the entire time, which defeats the point of
catching it before shipping.

I'd distinguish this from findings that genuinely are fine to
fast-follow: a cosmetic gap in audit-log formatting, a non-blocking
monitoring dashboard improvement — those don't leave an active,
exploitable gap in the meantime. Over-broad tool access does. I'd also
push to understand *why* this was caught late rather than earlier — if
security review is happening only right before ship, that's a process
gap worth fixing independent of this specific finding, so the next
release doesn't face the same late-stage schedule-vs-security tradeoff
at all.

**Why not "ship on schedule, the eval results were good and this is a
narrow gap"?** Because evaluation results measure whether the agent
*behaves correctly on the test set* — they say nothing about what
happens if that same well-behaving agent is manipulated or makes one
mistake while holding more authority than the task requires. Good
evaluation results and a real access-scope risk are answering
completely different questions, and treating one as evidence against
the other is the actual error to avoid here.
