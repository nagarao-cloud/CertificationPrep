# Behavioral and Tradeoff Interview Questions

> Complements `architect-scenario-questions.md` — this file focuses on
> judgment/communication questions an architect interview panel asks
> alongside pure technical-design questions.

---

## Q1. "A stakeholder insists on a specific technology (e.g. a
particular database) that you believe is the wrong fit. How do you
handle it?"

**Model answer structure:**

- Ask *why* they want it — sometimes there's a real, unstated
  constraint (existing team expertise, a vendor relationship, a
  regulatory precedent) that changes the calculus; sometimes it's the
  "new shiny" bias (`00-START-HERE/EXAM-TRAPS-AND-MNEMONICS.md` #3)
  and surfacing that gently resolves it.
- Present the tradeoff explicitly using a comparison-matrix-style
  argument (e.g. `03-comparisons/02-storage-database-options.md`'s
  structure) rather than a flat "you're wrong" — data-driven,
  side-by-side reasoning is more persuasive and more collaborative
  than an appeal to authority.
- Be willing to be overruled by a legitimate business reason even if
  the technical case doesn't fully support it, but document the
  tradeoff being accepted so it's a deliberate decision, not a silent
  gap.

---

## Q2. "How do you decide when an architecture needs to be re-evaluated
versus left alone?"

**Model answer structure**, grounded in Domain 1 §1.5:

- Distinguish a *real inflection point* (the business has genuinely
  reached a new scale tier, a new compliance regime applies, cost
  trends have shifted meaningfully) from *reflexive modernization*
  (a new service was announced, an engineer wants to try something new).
- Describe a lightweight, recurring review cadence (tied to Domain 4's
  continuous-improvement process, not a one-time audit) that surfaces
  genuine signals — Recommender API findings, SLO/error-budget trend
  data, compliance-scope changes — rather than opinion-driven
  re-architecture proposals.

---

## Q3. "Tell me about a disagreement you had with another engineer
about a security control, and how it was resolved."

**Model answer structure (STAR)**, using Domain 3's tradeoff logic as
the substance:

- **Situation/Task**: frame a disagreement resembling "should we use
  IAM Conditions or Organization Policy for this rule" — a real,
  common architect-level judgment call (Domain 3 exam trap #1).
- **Action**: explain how the actual shape of the requirement (a
  narrow, temporary exception vs. a blanket org-wide rule) determined
  which mechanism was correct, and how that was demonstrated concretely
  rather than argued abstractly.
- **Result**: the simpler, better-fit mechanism was adopted, with the
  reasoning documented so future engineers don't re-litigate the same
  choice from scratch.

---

## Q4. "How do you communicate a security or compliance requirement to
an engineering team that sees it as slowing them down?"

**Model answer structure:**

- Reframe the guardrail as removing a *decision*, not adding *work* —
  e.g. an Org Policy constraint blocking external IPs org-wide means
  engineers never have to individually reason about whether a given VM
  should have one; it's already decided for them (Domain 2/3
  crossover — shift-left security as a productivity tool, not just a
  restriction).
- Where genuinely possible, automate the guardrail into the
  provisioning pipeline (Domain 2 §2.3's shift-left pattern) so it's
  invisible in the common case and only surfaces as friction for the
  genuinely non-compliant edge case.

---

## Q5. "Describe a time you had to make a decision with incomplete
information."

**Model answer structure**, tied to the "read the scenario for the
signal" skill this whole exam trains:

- Frame a situation where a stated business requirement (e.g. "keep
  this system available") lacked a hard number, and describe how you
  drove toward a specific, quantified target (an SLA/SLO number, an
  RTO/RPO number) before committing to an architecture — rather than
  guessing at "highly available" and over- or under-building relative
  to what the business actually needed.
- This mirrors Domain 1 §1.1/§1.2's core skill: translating vague
  business language into a specific technical target is itself the
  primary way an architect handles incomplete information, not a
  workaround for it.

---

## Q6. "What's an architectural decision you made that you'd change if
you could go back?"

**Model answer structure:**

- Pick a genuine over-engineering or under-engineering example (not a
  contrived one) — e.g. choosing a multi-region design before the user
  base was actually multi-region, adding operational cost without a
  matching benefit at the time.
- Explain what signal, in hindsight, should have driven a different
  (usually simpler) choice at the time, and how that changed your
  process going forward (e.g. now requiring an explicit multi-region
  user-base statement before proposing a multi-region design — Domain 1
  exam trap #1, learned the hard way).
- This question rewards honesty and a demonstrated feedback loop more
  than a "perfect track record" answer — architects who never admit a
  past over-engineering mistake are less credible, not more.
