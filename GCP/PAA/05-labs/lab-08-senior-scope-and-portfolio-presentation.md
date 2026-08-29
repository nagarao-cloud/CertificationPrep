# Lab 08 — Senior Scope & Portfolio Presentation: Elevating This Capstone for a Real Interview

> **What this file is.** Lab 07 built a technically sound agentic
> system and taught PAA's exam content end to end. It was never scoped
> to answer a different question: *if a real company offered you a
> senior GCP agentic-architect role, what would they actually be
> looking for, and how would you present this project to prove you
> have it?* This file answers that, in two parts — first the real-world
> research, then the same Meridian Tools project extended with the
> dimensions a senior interview actually probes (leadership, budget,
> stakeholder negotiation, incident response, mentoring) — followed by
> how to actually say all of this out loud in an interview.
>
> **Read lab-07 first.** This file cross-references it constantly by
> section number and adds a layer on top — it does not repeat lab-07's
> content, renumber its 8 phases, or replace anything in it.
>
> **This file is optional and non-exam-scope** (see `CLAUDE.md` §3) —
> everything you need to pass PAA lives in labs 1-7 and the rest of
> this folder. This file exists only for candidates who also want the
> project to double as a job-interview portfolio piece.

---

## Honesty callout — two tiers, read before you start

This file mixes two different kinds of content, and they carry
different honesty flags — keep them straight as you read:

> **Part A is research-grounded.** Every claim is sourced to a real job
> posting or a credible industry guide, and every claim is explicitly
> confidence-tiered (High / Medium / Medium-high / Low) rather than
> flattened into one undifferentiated list of facts. Where the research
> found nothing, this file says so plainly instead of guessing.
>
> **Part B, C, and D are fabricated-for-rehearsal, in the same spirit
> as lab-07's illustrative console steps — but for numbers, not UI.**
> Every dollar figure, percentage, latency number, vendor name, and
> quoted outcome in Meridian Tools' "senior scope" extension is
> **invented for this capstone** — there was never a real deployment,
> so there is no real data. Numbers are chosen to be *plausible* for a
> company of Meridian's stated size (§0.2, ~1,200 employees) and this
> system's stated scope, not pulled from any actual source. Treat this
> content as a **rehearsal script**, not a resume claim to state as
> fact about a system that doesn't exist — see Part C for how to talk
> about a capstone project honestly in a real interview.

---

## Part A — What senior GCP agentic-architect hiring actually wants

### A.1 Confidence-tiered findings

Sourced from real job postings (Amazon, Google Cloud, PwC/Cyclotron,
SAP, TTEC, Hover, Kobie Marketing) and one credible staff-level AI
system-design interview guide, read directly as of 2026-08-28. Nothing
below is upgraded past the confidence level its source actually
supports.

| Finding | Confidence | Source type |
|---|---|---|
| Seniority is mostly a **large general architecture/cloud/delivery experience base** (5-10+ years) plus a **small, explicit agentic-AI-specific carve-out** (1-3 years) — the field is too young for more | **High** | Multiple real postings (Amazon: 7yrs general + 3yrs AI/agentic; PwC/Cyclotron: 8yrs + 2yrs GenAI-production) |
| **Mentoring and technical leadership** of other engineers is named explicitly and repeatedly at senior/principal level | **High** | Multiple real postings (SAP, Hover, Kobie, PwC/Cyclotron all name it directly) |
| Translating architectural tradeoffs into business decisions for leadership/stakeholders is an explicitly named responsibility | **High** | PwC/Cyclotron ("technical advisor to senior leadership... clear business decisions"); Amazon ("communicating technical concepts to diverse audiences") |
| Named tools candidates should know closely match PAA's own scope: **ADK, A2A, MCP, Gemini Enterprise, Agent Runtime** | **High** | Real Google Cloud AI Architect postings |
| Cost/performance optimization is a named responsibility, not a separate finance function | **High** | Amazon's preferred qualifications, stated directly |
| Security/compliance sign-off authority and FinOps-style cost ownership sit with the senior architect | **Medium** | Partially evidenced in postings, partially general industry practice for the role tier |
| Senior/staff portfolios show **depth over breadth** — 3-5 topics drilled to failure-mode level, not a broad survey | **Medium-high** | A credible staff-level AI system-design interview guide, not job postings |
| "**What broke in production, how did you find it, how did you fix it**" is a load-bearing interview question | **Medium-high** | Same interview guide |
| **Constrained scope beats reflexive multi-agent complexity** — "most reliable production agents are single agents with good tools," and multi-agent design should be justified, not defaulted to | **Medium-high** | Same interview guide |
| Legacy-system migration is a named senior responsibility **for this specific specialty** | **Low — not found directly** | Generic senior-architect expectation elsewhere, not confirmed for agentic AI specifically in this search |
| "Explain this differently to an engineer vs. a VP" as a *formal, named* interview exercise | **Low — inferred, not found stated this way** | Synthesized from general leadership-hiring material, not a confirmed interview format for this role |

**Why the years-of-experience pattern matters more than it first looks
like it does.** Real postings almost never ask for "5+ years of
agentic AI experience" — they can't, the field doesn't have candidates
with that history yet. What they ask for instead is a large base of
*general* architecture/delivery seniority with a comparatively small,
explicit AI-specific carve-out layered on top. The practical
implication: a portfolio project doesn't need to prove years of
agentic-specific tenure — it needs to prove the *general* senior-level
reasoning (tradeoffs, leadership, production ownership) transfers
cleanly onto this specific, newer kind of system. That's exactly what
Part B below is built to demonstrate.

**Why "depth over breadth" is worth taking literally, not just noting.**
The interview guide's finding isn't "know more things" — it's the
opposite: pick 3-5 decisions and be able to defend each one under
pushback, rather than being able to name every tool in the 28-item
`00-START-HERE/SERVICE-MATRIX.md` list. Part D deliberately picks five,
not fifteen, for exactly this reason — more would read as breadth, not
depth.

### A.2 The PAA certification itself has zero real-world hiring signal yet

State this plainly, because overstating it would undercut the whole
point of this file: **as of 2026-08-28, no real job posting found in
this research references the Professional Agentic Architect
certification** — not surprising, since beta registration only opens
2026-09-03 and no candidate has yet sat the exam. Google's own
certification page positions it as "intermediate to advanced,"
recommending 3+ years general cloud experience and 1+ years hands-on
agentic experience on Google Cloud — a profile that happens to land
close to the *low end* of what real senior postings ask for in
AI-specific experience, but that is Google's own positioning, not
evidence of employer regard. **Don't claim this credential is already
valued by hiring managers — it might be, once it's been live for a
while, but nobody can honestly say that yet.**

### A.3 The direct answer to "what type of project is needed?"

Not a checklist of tools used. What separates a senior-caliber project
from a mid-level one, per the research above:

1. **Depth on 3-5 decisions, to the failure-mode level** — not a
   broad tour of every tool. Being able to say exactly why a chunking
   strategy, a model choice, or a deployment target was picked, and
   what specifically would make it wrong, beats listing every service
   touched.
2. **Numerically defensible tradeoffs** — cost, latency, and scale
   numbers attached to decisions, not preference stated as fact.
3. **Evidence of leadership and mentoring** — not just "I built this,"
   but "I made this call for a team, and here's how I brought a junior
   engineer along on a specific mistake."
4. **Closed-loop production ownership** — what broke, how it was
   found, how it was fixed, and what changed afterward. A project that
   only shows the happy path reads as untested.
5. **Justified, not reflexive, complexity** — if the project uses
   multi-agent orchestration, it should say explicitly why a single
   agent with good tools wasn't enough, per A.1's "constrained scope"
   finding.

Lab-07 already delivers #1, #2, and #5 well — see Part D for the
existing tradeoffs sharpened into quotable form. **Part B below exists
specifically to add #3 and #4, which lab-07, by design, never
attempted.**

---

## Part B — Elevating Meridian Tools to senior scope

Every subsection below is an overlay on a specific lab-07 phase —
cross-referenced, not restated. **Every number in this Part is
fabricated-for-rehearsal per the honesty callout above.**

### B.1 Quantified illustrative-outcomes dashboard

Lab-07 §0.3.5 stated three success criteria qualitatively and left the
employee survey "out of scope for this technical capstone to detail
further." A senior-level presentation closes that loop with numbers —
illustrative ones, clearly labeled:

| Metric | Illustrative value | What it's standing in for |
|---|---|---|
| Employee adoption (of ~1,200) | ~62% used it at least once in the first quarter | Real adoption tracking a rollout would actually measure |
| Query deflection rate | ~71% of questions resolved without escalating to a human | Lab-07 §0.3.5's "no need to interrupt a colleague" goal, made numeric |
| p50 / p95 latency | 1.8s / 4.6s | Lab-07 §0.3.2's qualitative "a few seconds" target, made numeric — consistent with, not contradicting, the original requirement |
| Golden-set accuracy bar (Phase 4) | 94% | The Phase 4 evaluation pipeline's actual pass threshold |
| Monthly infra cost at steady state | ~$3,100/month | See B.4's worked model below — this is the output of that table, not an independent guess |
| Estimated time saved per resolved query | ~8 minutes (vs. manual search/colleague interruption) | Lab-07 §0.3.5's time-savings goal, made numeric |
| Illustrative annualized value | ~62% × 1,200 employees × ~4 queries/month × 8 min saved ≈ **~317 hours/month** of employee time recovered | A back-of-envelope ROI figure a VP would actually ask for |

**How to use this table honestly in an interview:** see Part C — say
"in a real deployment, I'd expect to track numbers like these" or "for
this capstone I modeled illustrative numbers to reason about ROI," not
"we measured 62% adoption," since nothing was ever deployed.

### B.2 Leadership and delegation narrative

Lab-07 §0.3.4 names "a small internal platform team (a handful of
engineers)" only as an undifferentiated headcount. At senior scope, the
candidate's own role *directing* that team is the missing piece:

As the architect, you'd own the two hardest calls end to end — the
Phase 3 decision to leave low-code and rebuild in ADK (justified by a
concrete capability wall, not preference), and the Phase 6 decision to
formalize PAB policies per-agent rather than apply one blanket
permission set. Both are exactly the kind of call a team without a
senior architect tends to get wrong: either staying in low-code too
long past its actual limits, or reflexively granting the "more
advanced" specialist agent broader data access than it needs (the
mistake lab-07 §6.3 explicitly argues against). **You'd delegate**
implementation of individual RAG-pipeline components (§3.7) and the
evaluation harness (Phase 4) to two engineers on the team, reviewing
their design before build rather than writing it all yourself — the
distinction between "I built this" (mid-level framing) and "I designed
this and directed the team that built it" (senior framing) is exactly
what an interviewer is listening for.

**A concrete split, worth having ready if asked "who did what":**

| Decision or component | Owned personally (architect) | Delegated (with review) |
|---|---|---|
| Phase 3 build-vs-stay-low-code call | ✅ — architectural judgment call | |
| Model-selection axes per agent (§3.4) | ✅ — sets the pattern other decisions follow | |
| RAG pipeline implementation (§3.7) | Design reviewed before build | ✅ — one engineer |
| Evaluation harness (Phase 4) | Rubric/criteria reviewed before build | ✅ — one engineer, with HR input per §7.3's lesson |
| PAB policy formalization (§6.3) | ✅ — security-boundary calls stay with the architect | |
| Deployment/on-call rotation setup (§5.1-5.2) | Runtime choice owned personally | ✅ — day-to-day operation delegated once stable |

**Why this table matters more than it looks like it should:** a
candidate who can't answer "who actually wrote the code" convincingly
reads as either overclaiming (implausible for a "small handful of
engineers" team) or underclaiming (sounds like an individual
contributor, not an architect). The honest middle — owning the
judgment calls personally, delegating implementation with review — is
what the seniority research in A.1 actually describes, and it's a more
defensible answer than either extreme.

### B.3 Cross-functional stakeholder negotiation scene

Lab-07 names HR, IT, and Engineering only as data owners. A senior
architect negotiates *with* them as stakeholders with competing
interests — a scene, not just a data-access fact:

**The scene:** HR wants the fastest possible rollout to reduce their
own ticket load; IT wants the platform team to also own long-term
maintenance of the wiki-ingestion pipeline (scope creep the platform
team didn't sign up for); Engineering wants the specialist-agent path
prioritized before HR content, since engineering standards questions
are, in their view, higher-value. **The resolution you'd actually
negotiate:** phase the rollout HR-content-first (matching lab-07's own
Phase 1 MVP scope, which already answered HR-style questions), commit
IT to a *defined* maintenance SLA rather than open-ended ownership
(their ingestion source, their update cadence — the platform team owns
the pipeline, not the content lifecycle), and give Engineering a
committed Phase-3-onward roadmap slot instead of reordering the
already-justified build sequence. This is the kind of compromise a
senior architect is expected to broker and then defend to all three
parties — distinct from, and a natural companion to,
`08-interview/behavioral-and-tradeoff-questions.md`'s B3/B9 questions
on stakeholder pushback.

**How that conversation actually sounds, if asked to role-play it**
(illustrative dialogue, not a transcript of anything real):

> **Engineering lead:** "Our runbook questions are the ones that
> actually save an incident from getting worse at 2 AM. Why is HR
> going first?"
>
> **You:** "Because HR content is what Phase 1's low-code MVP already
> proves out — state-based workflows, single-turn Q&A, no multi-agent
> routing needed yet. Your questions are exactly the ones that need
> Phase 3's specialist-routing work, which isn't safe to rush. I'm not
> deprioritizing engineering value — I'm sequencing by what's
> technically ready, and you're first in line once Phase 3 ships. Can
> we lock a date for that instead of an order?"
>
> **IT lead:** "Fine, but we're not maintaining the ingestion pipeline
> forever — that's platform-team work, not ours."
>
> **You:** "Agreed — you own the source and the update cadence, we own
> the pipeline that ingests it. I'll put that split in writing so it's
> not ambiguous six months from now."

The pattern worth naming out loud, not just performing: **every
concession traded something concrete for something concrete** (a
committed date for engineering, a written ownership split for IT) —
"we'll figure it out" is not a negotiated outcome, and an interviewer
listening for negotiation skill is listening for exactly this kind of
specificity.

### B.4 Meridian-side budget and cost-per-query economic model

**Explicitly distinct from lab-07 §0.5**, which covers *your own*
personal cloud-spend hygiene while studying — this is Meridian's
fictional production budget, modeled as a senior architect actually
would to defend a deployment cost to a CFO:

| Cost driver | Illustrative assumption | Monthly cost |
|---|---|---|
| Triage agent (SLM) calls | ~40,000 queries/month × low per-call cost (SLM, short input) | ~$180 |
| Knowledge-answer + specialist agent (LLM) calls | ~40,000 queries/month, ~70% single-hop, ~30% with A2A handoff (2x calls) | ~$1,240 |
| Vector Search 1.0 (RAG retrieval) | Indexed corpus + query volume at this scale | ~$310 |
| Agent Runtime (`min-instances 1`, §5.2) | One warm instance, always-on, per Phase 0's latency requirement | ~$540 |
| Observability (Cloud Logging/Trace) | Standard tier at this request volume | ~$90 |
| Agent Gateway + Model Armor + Sensitive Data Protection (Phase 6) | Governance/safety-layer overhead | ~$740 |
| **Total** | | **~$3,100/month** |

**Cost-per-resolved-query:** ~$3,100 ÷ (40,000 × 71% deflection, per
B.1) ≈ **$0.11 per resolved query** — a figure worth having ready,
because "what does this cost per interaction, and how does that
compare to the alternative" is exactly the kind of question a budget
owner asks. **The alternative it's compared against:** status-quo cost
of the employee time B.1 estimated as recovered (~317 hours/month) at
a blended internal labor rate — the point of building this comparison
is showing you'd think in these terms at all, not the precision of the
number itself.

**Sensitivity check — what changes at 3x scale.** A senior architect
doesn't present one static number; they show they've reasoned about
what breaks it. If Meridian's usage tripled (a new site onboarded, say)
without any architecture change: LLM-call cost scales roughly linearly
with volume (~$3,720 instead of ~$1,240), but Agent Runtime cost does
**not** scale linearly — one warm instance handles significantly more
than 3x the original volume before a second instance is needed, so
infra cost grows in a step function, not smoothly. **The one line worth
having ready:** *"my LLM-call cost is the variable piece that scales
with usage; my Agent Runtime cost is closer to fixed until I cross a
concurrency threshold — that's a materially different cost curve than
if I'd deployed on a per-request-billed platform with no minimum, and
it's exactly the kind of distinction a FinOps review would ask about."*
This single sentence is worth more in an interview than the dashboard
of numbers above it, because it shows the *reasoning pattern*, not just
a memorized figure.

### B.5 Greenfield, honestly — not a fabricated migration

Lab-07 builds Meridian's system from scratch. **The honest note, not a
fabricated migration narrative:** this was a deliberate teaching choice
for clarity, and a real senior architect should say so plainly rather
than inventing a migration project that was never actually designed
end to end. If this *had* been a migration (replacing, say, an aging
internal wiki-search tool), the real additional work would be:
coexistence — running both systems in parallel during a rollout window
so users aren't disrupted; data migration — moving the wiki's existing
content into the same ingestion pipeline lab-07 §3.7 already built,
which changes nothing about the RAG architecture itself; and a defined
cutover/rollback point, in case adoption or accuracy targets aren't
met. **This is a sketch of the extension, not a built one** — say so if
asked, rather than presenting Meridian as a migration it never was.

### B.6 On-call severity framework and postmortem

Lab-07 §5.3.3 already diagnoses a reasoning-loop hang well but has no
severity framework or postmortem template around it — the operational
layer a senior architect is expected to own. Applying one to that exact
scenario:

**Severity framework:**

| Severity | Definition | This project's example |
|---|---|---|
| Sev1 | Full outage, all users affected | §5.3.4's "requests returning outright errors," if it affected 100% of traffic |
| Sev2 | Partial outage or major functionality broken | §5.3.3's reasoning-loop hang, if it affected a meaningful fraction of complex-question traffic |
| Sev3 | Degraded quality, system still functioning | §5.3.1's drift scenario — answers "getting subtly worse," nothing outright broken |
| Sev4 | Minor, no user impact yet | A caught-in-monitoring anomaly before it reaches users |

**Filled postmortem, applied to §5.3.3's reasoning-loop hang (classed
Sev2 — affecting complex-question traffic specifically, not all
traffic):**

- **Timeline:** 09:14 — monitoring flags a rise in p95 latency and a
  cluster of never-completing requests, all classified as "complex" by
  the triage agent. 09:22 — on-call engineer confirms via Cloud Trace
  that affected requests are stuck inside the specialist agent, not
  timing out at the A2A handoff boundary. 09:41 — root cause confirmed:
  `max_handoffs_per_question: 1` is correctly enforced, but the
  specialist agent's own internal reasoning has no termination
  condition when it can't resolve a sub-question, so it loops
  internally rather than looping across agents. 10:05 — mitigation
  deployed: a hard timeout wrapper forces the specialist agent to
  return a partial answer with a human-follow-up flag after 15 seconds
  of internal reasoning, rather than hanging indefinitely.
- **Root cause:** missing termination condition inside a single agent's
  own control logic — a gap the cross-agent `max_handoffs` policy could
  not catch because it never triggered a second handoff.
- **Contributing factors:** the original Phase 3 design assumed
  loop-prevention only needed to guard against runaway A2A handoffs
  (the failure mode the exam names explicitly) and didn't separately
  guard against single-agent internal loops.
- **Action items:** (1) add an explicit termination condition to every
  agent's own reasoning logic, not just the cross-agent handoff policy
  — owner: platform team lead, due next sprint; (2) add a dashboard
  alert on request duration outliers specifically, not just aggregate
  latency — owner: on-call rotation lead, due next sprint.
- **This is exactly the bridge lab-07 §5.3.3 itself points at** ("a
  natural bridge into Phase 6's HITL content") — the fix above is a
  HITL-flavored escalation, not a silent retry.

### B.7 Mentoring vignette

Anchored on the existing §3.7.2 chunking-consistency warning (reused,
not re-derived): a junior engineer on the platform team, implementing
the RAG pipeline under your direction, initially "upgraded" the
embedding model for a subset of newly-ingested documents without
re-embedding the existing corpus — exactly the silent-degradation
mistake §3.7.2 warns about, and exactly the kind of mistake that
doesn't throw an error, so it went unnoticed until Phase 4's evaluation
pipeline caught a retrieval-quality regression on older documents. The
mentoring moment: rather than just fixing it yourself, you'd walk the
engineer through *why* it degrades silently rather than crashing (mixed
embedding spaces are still numerically valid vectors, just
semantically incompatible — nothing about that raises an exception),
have them write the fix (a full re-embed of the affected corpus subset,
matching model versions), and turn the incident into a standing
ingestion-pipeline check: reject any upsert whose embedding-model
version tag doesn't match the corpus's current version. That last
step — turning one caught mistake into a systemic guardrail — is the
part that distinguishes mentoring from just correcting someone.

### B.8 Build-vs-buy decision point

Lab-07's Phase 1→3 progression is framed as "prove the concept, then
hit a wall" — true, but incomplete without an explicit, on-the-record
alternative that was considered and rejected. **The scene:** partway
through Phase 1, a vendor ("**DocuAsk**," a fictional enterprise
knowledge-assistant SaaS product) pitches the platform team a
turnkey alternative to building further in-house. **Rejection
criteria, stated explicitly (the part that actually matters in an
interview — not "we said no," but *why*):** DocuAsk's pricing model
was per-seat, which at Meridian's scale (1,200 employees, modest active
usage per B.1) would cost more than the in-house build's marginal
cost past the already-built low-code MVP; DocuAsk had no native
support for the multi-agent specialist-routing pattern Phase 0's
"route to a specialist path" requirement called for, meaning Meridian
would still need custom integration work on top of the vendor
product — undermining the "buy to avoid engineering effort" premise
in the first place; and DocuAsk's data-residency terms were less
specific than Google Cloud's own compliance documentation, a real
concern given the HR-content sensitivity already established in Phase
0. **This is explicitly revisitable** — if Meridian's requirements
changed (e.g., the platform team shrank further, or specialist routing
became unnecessary), DocuAsk's calculus could flip. Presenting a
build-vs-buy decision as a *permanent* verdict, rather than one
correct for stated constraints at a stated time, reads as junior; a
senior architect frames it as reversible.

**The comparison as it would actually appear in a decision memo:**

| Dimension | DocuAsk (buy) | In-house on ADK (build) | Winner, for Meridian specifically |
|---|---|---|---|
| Pricing model | Per-seat, ~1,200 seats regardless of active usage | Marginal cost scales with actual query volume (B.4) | Build — usage-based cost fits a modest-active-usage internal tool better than a per-seat license |
| Multi-agent/specialist routing | Not natively supported — would need custom integration anyway | Native, since it's the point of the ADK rebuild (§3.10) | Build — buying doesn't actually remove the engineering work here |
| Data residency specificity | Vendor terms, less specific than Google Cloud's own compliance docs | Inherits Google Cloud's documented compliance posture directly | Build |
| Time-to-first-value | Faster initial setup (turnkey) | Slower initially, but Phase 1's low-code MVP (§1.1-1.5) closes most of this gap | Roughly even — this is the strongest point in DocuAsk's favor |
| Long-term flexibility | Locked to vendor's roadmap | Full control over the architecture as requirements evolve | Build |

**The one honest point in the vendor's favor, stated on the record
rather than omitted:** DocuAsk would have gotten *something* in front
of employees faster than even the Phase 1 MVP. Naming the actual
strongest argument for the option you rejected — not a strawman
version of it — is itself a senior-level signal; a decision memo that
only lists reasons to build reads as biased, not rigorous.

### B.9 Multi-region / DR extension sketch

Lab-07 §5.1 deploys to `us-central1` with no disaster-recovery
discussion — reasonable for an internal, business-hours tool at this
scale (per Phase 0's own non-functional requirements), but a senior
interview may still probe "what if this needed higher availability."
**The sketch, explicitly scoped as an extension beyond what was
built:** an active-passive design — a secondary Agent Runtime
deployment in a second region (e.g. `us-east1`), receiving
asynchronous replication of the Vector Search 1.0 index and Memory
Bank session state, promoted to active only on a declared regional
failure. Illustrative targets: **RTO (recovery time objective) ~15
minutes** (time to detect failure and promote the secondary),
**RPO (recovery point objective) ~5 minutes** (acceptable data loss
window, bounded by replication lag). Worth stating plainly if asked:
this was never built or tested for this capstone — it's the answer to
"how would you extend this," not a claim about what exists.

**Why active-passive, not active-active, is the right call to defend
here** — this is the follow-up an interviewer is actually listening
for, not just the RTO/RPO numbers: active-active would mean both
regions serving live traffic simultaneously, which requires the
Vector Search 1.0 index and Memory Bank session state to be
strongly consistent across regions in real time — meaningfully harder
to build correctly, and unjustified given Phase 0's own non-functional
requirements already state this is a business-hours internal tool, not
a 24/7 customer-facing system. **The one line worth having ready:**
*"I'd defend active-passive here specifically because the availability
requirement doesn't call for zero-downtime — spending engineering
effort on active-active consistency would be solving a problem this
system doesn't actually have."* Matching the DR investment to the
stated requirement, rather than defaulting to the most sophisticated
option available, is the same "constrained scope" reasoning from A.1
applied to infrastructure instead of agent architecture.

### B.10 Compliance and audit-trail extension

Beyond Phase 6's existing Model Armor / Sensitive Data Protection /
Agent Gateway logging (already real safety controls, not extension
territory): a senior architect at a company handling HR data would
also need to reason about **data retention policy** (how long query
logs and retrieved-content records are kept, and why), **audit-log
immutability** (write-once storage for compliance logs, so a
after-the-fact incident review can't be tampered with), and
**data-subject deletion** (if an employee leaves the company, can their
query history be found and deleted on request — a GDPR-style
requirement even for a US-only company, since it's good practice
regardless of jurisdiction). None of this was built in lab-07 — flagging
it is itself a senior-level signal: naming the compliance dimension a
project *didn't* cover, unprompted, reads as more credible than
silence would.

**Where this would actually plug into the existing architecture, not
as a bolt-on:** retention policy and audit-log immutability apply
directly to what Agent Gateway already logs (§6.4) — the extension is
a retention/immutability *policy* on storage that already exists, not
a new logging system. Data-subject deletion is harder, because it
means the ingestion pipeline (§3.7) needs a way to identify and purge
any retrieved-content records tied to a specific person's query
history — which the current design, built purely around document
content, was never scoped to support. **Naming that gap specifically —
"my current retrieval logs are indexed by content, not by requester,
so subject-deletion would require a schema change, not just a policy
change" — is a more senior answer than a vague "we'd add compliance
later,"** because it shows the architectural consequence of the gap,
not just its existence.

---

## Part C — How to present this

### C.1 The 30-second pitch

*"I designed and directed the build of an internal knowledge-and-support
agent for a 1,200-person manufacturer — Meridian Tools — that answers
employee questions grounded in real company policy, using a
triage-then-route multi-agent architecture I chose specifically to keep
cost and latency down on the 90% of simple questions while still
handling the complex ones properly. I made the call to start cheap with
a low-code MVP, prove the concept, then justify a custom rebuild only
once we hit a real capability wall — and I formalized least-privilege
security per agent, not just per system, which is the detail most
candidates miss."*

### C.2 The 2-minute version

Problem (§0.2 — a vague leadership ask, deliberately, because that's
realistic) → key decision (§3.4/§3.10 — why triage-then-route,
SLM-vs-LLM per agent, and why A2A over a monolithic agent, tied
explicitly to the "constrained scope beats reflexive complexity"
research finding in A.1) → outcome (B.1's illustrative numbers,
stated as illustrative) → retrospective (lab-07 §7.3's three genuine
"what we'd do differently" lessons — a real retrospective, not a
victory lap, is itself a senior signal).

### C.3 Deep-dive outline for "walk me through your architecture"

This is the rehearsed, distilled companion to
`08-interview/agentic-architect-scenario-questions.md` Q20 ("walk me
through designing Meridian's entire platform, start to finish") — read
that file's full model answer for the complete technical walkthrough;
this is the compressed, spoken-out-loud version:

1. Start with the requirement that drove the architecture (§0.3.1's
   "route to a specialist path"), not the tools.
2. Name the model-selection axes and why they're worked *per agent*,
   not once for the whole system (§3.4).
3. Name the one thing that would silently break the whole system if
   gotten wrong (§3.7.2's embedding-consistency warning) — this is
   exactly the "specific failure mode, not generic" signal from A.1.
4. Name the least-privilege decision that's easy to get wrong (§6.3 —
   the specialist agent NOT getting broader data access despite
   handling more complex questions).
5. Close with the incident (B.6) and what changed afterward — closes
   the loop the way A.1's "what broke in production" finding expects.

### C.4 STAR-format talking points

| Situation/Task | Action | Result |
|---|---|---|
| Employees wasted time searching scattered internal docs across HR/IT/Engineering | Directed a phased build — low-code MVP first to prove value cheaply, custom ADK rebuild only once a concrete capability wall was hit | ~71% query deflection, ~62% adoption in Q1 (illustrative, B.1) |
| A silent RAG-retrieval-quality regression appeared after a junior engineer mismatched embedding models on ingestion | Diagnosed the root cause, had the engineer implement the fix, then turned it into a standing pipeline guardrail rather than a one-off patch | Regression caught and fixed within one evaluation cycle; the class of bug became structurally impossible afterward (B.7) |
| A reasoning-loop hang affected complex-question traffic in production | Ran the incident to a full postmortem, found the gap was a missing single-agent termination condition (not the cross-agent policy the team assumed would catch it), shipped a fix and a new monitoring signal | Sev2 incident resolved with a documented root cause and two owned action items (B.6) |
| Three stakeholder groups (HR, IT, Engineering) had competing priorities for the platform's rollout order | Negotiated a phased compromise — HR-content-first, a defined IT maintenance SLA instead of open-ended ownership, a committed future roadmap slot for Engineering | All three stakeholders retained their core ask in a form the platform team could actually deliver (B.3) |
| A vendor pitched a turnkey alternative mid-build | Evaluated it against stated requirements (cost at scale, native multi-agent support, data-residency specificity) and made an explicit, criteria-based rejection, flagged as reversible if constraints changed | Avoided a vendor lock-in that wouldn't have met the specialist-routing requirement anyway, at a documented cost-comparison basis (B.8) |

### C.5 Anticipated follow-up questions and how to handle them

A senior interviewer's first question rarely stays where you left
it — expect at least one of these, and have the honest answer ready
rather than improvising:

- **"You said 62% adoption — how would you actually know that?"** Say
  it plainly: this was never deployed, so that number is illustrative
  modeling, not a measurement. Then pivot to what you'd *actually*
  instrument to measure it for real — Agent Runtime request logs
  joined against an employee directory for unique-user counts, exactly
  the kind of telemetry Phase 5's `--observability cloud-logging,cloud-trace`
  flag (§5.1) was built to enable. Answering the follow-up well matters
  more than the original number did.
- **"Why not just use one big LLM agent instead of three?"** This is
  Part D's fifth tradeoff, restated under pressure — lead with the cost
  argument (§3.4.1's SLM triage saving on the majority-simple-question
  traffic), not "best practice," since "best practice" alone doesn't
  survive a follow-up.
- **"What would you do differently if you had to do this again?"**
  Don't invent a new answer on the spot — lab-07 §7.3 already has three
  genuine ones (earlier video ingestion, PAB policies written alongside
  data-access scoping instead of as a later phase, HR involved in the
  autorater rubric from the start). Reciting a *real* retrospective,
  even a small-scale illustrative one, reads far better than an
  improvised answer.
- **"What's the blast radius if this system is wrong?"** This is where
  Phase 0's explicitly-stated out-of-scope decision (§0.3.1 — advisory
  only, no direct actions) pays off directly: the honest answer is "an
  incorrect answer to an HR question, not an incorrect *action* taken
  on an employee's behalf" — and being able to trace that answer back
  to a Phase 0 scoping decision, not an afterthought, is exactly the
  kind of traceability A.1's research says interviewers probe for.

### C.6 What not to do when presenting this

Three specific mistakes worth naming, because they're the ones a
mid-level candidate makes without realizing it:

1. **Presenting Part B's numbers as if they were measured.** The
   moment an interviewer catches a candidate treating a fabricated
   figure as fact, everything else in the pitch loses credibility —
   see C.5's first bullet for exactly how to avoid this.
2. **Leading with the tool list instead of the decision.** "I used
   ADK, Agent Runtime, Vector Search 1.0..." is a services glossary,
   not a pitch — A.3's finding #1 (depth over breadth) means leading
   with *why* a specific decision was made, tools named only as they
   come up in service of that reasoning.
3. **Answering every question at the same level of detail.** A.1's
   "depth over breadth" finding cuts both ways — going deep on all
   five of Part D's tradeoffs unprompted, in a single answer, reads as
   over-rehearsed rather than senior. Lead with C.1's 30-second pitch,
   then let the interviewer's own follow-up questions decide which one
   tradeoff to go deep on.

---

## Part D — Sharpest quotable tradeoffs

Five of lab-07's strongest existing decisions, restated as standalone
spoken lines — per A.1's "tradeoffs explicit in the artifact, not
implicit" finding, these should be sayable out loud without notes.

1. **On model selection (§3.4):** *"I don't pick one model for a whole
   system — the triage agent is an SLM because classification is a
   narrow, high-volume, latency-sensitive job that every single request
   passes through first, while the reasoning agents are LLMs because
   they need genuinely open-ended reasoning. Using an LLM everywhere
   would have been the easy default and the wrong one."*
2. **On the chunking failure (§3.7.1-3.7.2):** *"The single most
   dangerous mistake in a RAG pipeline doesn't throw an error — it
   just quietly gets worse. Mixing embedding models between ingestion
   and query time is exactly that kind of failure, which is why I
   built a guardrail that rejects the mismatch structurally, instead of
   relying on someone remembering the rule."*
3. **On deployment cost (§5.2):** *"I chose `min-instances: 1`, not 0,
   which costs more when idle — deliberately, because our latency
   requirement was a few seconds, and a cold start on the first request
   after any idle period would have broken that promise for whoever hit
   it. That's a cost tradeoff made on purpose, not an oversight."*
4. **On least-privilege (§6.3):** *"Handling more complex questions
   isn't the same requirement as needing access to more sensitive
   data. My specialist agent reasons through more conditions than the
   general knowledge agent, but it doesn't get a wider data boundary
   for it — widening scope 'because it's the more advanced agent' is
   exactly the kind of unjustified privilege creep a real security
   review would catch."*
5. **On multi-agent complexity (§3.3, §3.10 — tied to A.1's research
   finding):** *"I didn't default to multi-agent because it sounds more
   sophisticated. The triage-then-route split exists because a single
   monolithic agent would have paid LLM-class cost and latency on every
   simple question, including the 70%+ that didn't need it. If this
   system only ever answered simple, single-turn questions, I'd have
   shipped one agent and stopped there."*

---

## Closing self-check

Before using this material in a real conversation, confirm you can:

- [ ] State A.2's honesty point unprompted if asked "is this cert
      valuable" — don't oversell a beta credential.
- [ ] Deliver C.1's 30-second pitch without reading it.
- [ ] Explain any one of Part D's five tradeoffs with the *reasoning*,
      not just the conclusion, if an interviewer pushes back on it.
- [ ] Say explicitly, if asked, that Part B's numbers are illustrative
      modeling for this capstone, not measured data from a real
      deployment — see this file's own honesty callout for exactly how
      to phrase that.
- [ ] Point to lab-07 for the full technical build behind any of this
      file's compressed talking points.
