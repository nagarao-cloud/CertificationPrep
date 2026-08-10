# Study Roadmap — How to Actually Use This Repo

> **This is a meta-guide, not a schedule.** `10-DAY-PLAN.md` is the
> schedule — day-by-day topics, labs, spaced repetition. This file is
> the layer above it: how to read the repo itself, how to bend the plan
> when your timeline isn't exactly 10 days, and how to know when you've
> stopped needing to read and should be doing nothing but questions.
> Compression is deliberate here — if a section could be one table
> instead of three paragraphs, it is.

---

## 1. Reading order (the compressed version)

The full walkthrough is in the root [`README.md`](../README.md). Here's
the order collapsed to one table:

| Order | File | Why first/last |
|---|---|---|
| 1 | `EXAM-GUIDE.md` | Format, task statements, self-assessment — orient before anything else |
| 2 | `10-DAY-PLAN.md` | Your schedule. Print it or pin it. |
| 3 | `SERVICE-SELECTION-MATRIX.md` | Highest value-per-minute file in the repo. Read once fully, then use as a reference forever after |
| 4 | `DECISION-TREES.md` | How to *reason* through a question once you know the services |
| 5 | `EXAM-TRAPS.md` | The 60 distractors AWS reuses — read once, then re-skim on Day 10 |
| ongoing | `01-domains/` → `02-services/` → `03-comparisons/` | Depth, in the order the daily plan calls for them — **not** front-to-back |
| ongoing | `06-practice/` | Every day, not "eventually" — see §4 |
| last | `07-revision/` + Day 10 files | Compression only, zero new material |

**The one rule this repo enforces structurally:** placeholders exist so
you don't read 95 files of content before you've earned the context to
retain any of it. Don't defeat that by asking for everything on Day 1.

**File map — which file answers which question**, for when you're
mid-study and not sure where to look:

| You're wondering... | Open |
|---|---|
| "Which service handles this scenario?" | `SERVICE-SELECTION-MATRIX.md` |
| "How do I reason through this multi-step scenario?" | `DECISION-TREES.md` |
| "Is this a known distractor pattern?" | `EXAM-TRAPS.md` |
| "What's the one-line memory hook for this?" | `MNEMONICS.md` |
| "Production incident — what's the fix?" | `TROUBLESHOOTING.md` (exam-scenario) or `08-interview/Troubleshooting.md` (interview narrative) |
| "Cross-cutting security checklist for a whole pipeline?" | `SECURITY.md` |
| "How does Well-Architected framing show up in a question?" | `WELL-ARCHITECTED.md` |
| "One-page refresh of an entire domain?" | `01-domains/DOMAIN-SUMMARIES.md` |
| "Deep, full treatment of one domain's every task statement?" | `01-domains/DOMAIN-N-*.md` |
| "How should I be spending my time right now?" | You're already here |

---

## 2. Adapting the 10-day plan to your actual timeline

The plan assumes 5 hrs/day × 10 days = 50 hours, beginner level. Scale
the *hours*, not the *content* — cutting content is how people show up
under-prepared on Domain 4.

### Shorter than 10 days

| Timeline | What changes |
|---|---|
| **7 days, same 50 hrs (≈7 hrs/day)** | Merge Day 5's review block into Days 1–4 as you go (5 min recall at the *end* of each day instead of a dedicated Day 5 morning). Keep Day 9 (mocks) and Day 10 (revision) exactly as-is — never compress those two. |
| **5 days, ≥8 hrs/day** | Only viable if you're not a true beginner. Cut in the order given in `10-DAY-PLAN.md`'s "If you fall behind" section — Terraform labs first, then console labs beyond LAB-01/02/05, then interview content, then Domain 4 depth beyond IAM+LF+KMS basics. Still run one full mock and one half-day of pure revision; compress everything else into 3.5 days. |
| **3 days ("cram")** | You are not learning DEA-C01 in 3 days from zero. This mode is for a *retake* or someone already AWS-fluent from adjacent experience. Skip straight to `SERVICE-SELECTION-MATRIX.md` + `DECISION-TREES.md` + `EXAM-TRAPS.md`, then 80% of remaining time on `06-practice/`. Domain 4 gets the SECURITY.md cross-cutting checklist only, not the full domain file. |

### Longer than 10 days

| Timeline | What changes |
|---|---|
| **15 days (≈3.3 hrs/day)** | Same content, same order, just stretched — add a half-day buffer after Day 3 (the heaviest single day: Glue/EMR/Flink/Lambda) and after Day 8 (Domain 4). Don't add *new* content; add repetition of Block A (recall) — this timeline's real advantage is more spaced-repetition cycles, not more reading. |
| **20+ days / "I have a month"** | Add a full lab day between Day 6 and Day 7 to actually build the LAB-01 through LAB-06 pipelines end-to-end and connect them (S3 → Glue → Redshift → Athena as one continuous project) instead of as six isolated exercises. Add a second full mock exam (there are only two in `06-practice/`; space a third one from a different question bank if you have access to one). More calendar time should buy you *hands-on depth*, which this repo's labs are the thin part of by design — reading material is deep, labs are intentionally lighter. |

**The instinct to resist regardless of timeline:** stretching a longer
runway by reading more files at greater leisure. Extra time should go
to repetition (spaced recall) and practice volume, not new reading —
the marginal value of a 6th read-through of a services file is near
zero; the marginal value of a 6th round of 30 practice questions on
your weakest domain is not.

---

## 3. Using the Weak Topics Dashboard

The dashboard lives in the root [`README.md`](../README.md#weak-topics-dashboard)
— one row per topic, columns for confidence (1–5), practice accuracy,
times reviewed, last reviewed, and difficulty.

**How to actually fill it in, not just have it exist:**

1. **Populate rows as you finish each day**, not in one batch on Day
   10 — you won't remember which specific sub-topics felt shaky by
   then. Right after Block D (practice questions) each day, add a row
   for any topic where you got 2+ questions wrong or guessed rather
   than reasoned.
2. **Confidence is self-reported, accuracy is measured** — don't let
   them silently merge into one number. A topic can feel confident (4/5)
   while actually scoring 60% on questions; that gap *is* the signal,
   and it usually means you understand the concept but not its exam
   traps.
3. **"Times reviewed" is what decides Day 5 and Day 8's spaced
   repetition content** — those blocks aren't "redo everything," they're
   "redo the rows still below 4/5 confidence or below 75% accuracy."
4. **Day 10's midday block is only the dashboard** — literally open it
   and work top-to-bottom through every row still scored 1–3.
   Everything scored 4–5 gets skipped entirely; that's the payoff for
   maintaining the dashboard honestly all week instead of re-reading
   everything blind on the last day.

A dashboard with every row at 5/5 by Day 6 is a **calibration** problem,
not a study win — go re-attempt those topics' hardest scenario
questions before trusting the score.

---

## 4. When to stop reading and switch to pure practice-question mode

This is the single highest-leverage judgment call in the whole
timeline, and the repo's own README states the failure mode bluntly:
*"people who fail this timeline fail because they spent 45 of their 50
hours reading and 5 answering questions."*

**Switch signals — any one of these means stop reading, start
answering:**

- You've completed the day's Block B (new material) and can redraw the
  day's architecture diagram from memory without looking. If you can
  draw it, rereading the prose adds little; drilling questions against
  it is where the remaining value is.
- You're on your second pass through a comparison matrix or decision
  tree and still checking it for the *same* row every time. That's a
  recall gap, not a comprehension gap — flashcards or timed questions
  fix it, more reading doesn't.
- It's Day 5 or later. From here the ratio should already have flipped
  hard toward Block D; if you're still spending more than half a day's
  hours on new reading past Day 5, you're behind the plan's own
  intended ratio (2h15 new material : 1h15 questions, and that ratio
  should keep tilting toward questions as days pass).
- You're past Day 9's mock and scored below 65% in a domain you *felt*
  good about going in. That gap means the material didn't transfer to
  exam-shaped reasoning — more reading in that domain won't close it;
  targeted scenario questions with full option-by-option review will.

**The one legitimate reason to go back to reading after this point:**
a specific, named gap surfaced by a wrong answer — "I keep missing
Redshift distribution style questions" is a reason to reread that one
subsection, not the whole Redshift file, and not to abandon practice
mode to do it. Cap any such detour at 15–20 minutes and return to
questions.

---

## 5. Quick reference — what each phase of the sprint should feel like

| Phase | Reading : Practice ratio | Primary output |
|---|---|---|
| Days 1–4 (new material) | ~65:35 | Architecture recall, first-pass confidence |
| Day 5 (review + Redshift) | ~50:50 | Weak Topics Dashboard populated for Days 1–4 |
| Days 6–8 (remaining domains) | ~55:45 | Full domain coverage, dashboard current |
| Day 9 (mocks) | ~10:90 | A real, timed score; a list of specific wrong-answer reasons |
| Day 10 (revision) | 0:100 (dashboard + traps only) | Confidence on the rows that were still weak |

If your actual week looks nothing like this table by Day 5, that's the
moment to course-correct — not Day 9.

---

## 6. Letting domain weights drive time allocation, not day count

The plan gives Domain 4 one day (Day 8) and Domain 1 three-plus (Days
2–4). That's not an oversight — it mirrors the exam's own weighting
(34/26/22/18) and the fact that scoring is **compensatory**, with no
per-domain minimum. Two consequences worth being deliberate about:

- **Domain 1 (34%) is where marginal study hours pay off most.** If
  you're deciding where to spend an extra hour you found in the
  schedule, it almost always belongs in ingestion/transformation
  practice questions before it belongs in Domain 4 depth beyond the
  IAM + Lake Formation + KMS basics `10-DAY-PLAN.md` already scopes for
  Day 8.
- **Compensatory scoring means a strong Domain 1 can carry a weaker
  Domain 4 to a pass — but don't plan around that as a strategy.** It's
  a safety margin for the topics you genuinely ran out of time for,
  not a reason to deprioritize 18% of the exam outright. A candidate
  scoring 90% on Domains 1–3 and 40% on Domain 4 can still pass; a
  candidate treating that as the plan usually finds out the hard way
  that Domain 4 questions are also woven into Domain 1–3 scenarios
  (an ingestion question with a "least privilege" clause, for
  instance), so skipping it costs more than 18% of questions.

**If you must cut time from somewhere, cut in the order
`10-DAY-PLAN.md`'s "If you fall behind" section already specifies** —
Terraform labs, then console labs beyond LAB-01/02/05, then interview
content, then Domain 4 depth beyond the basics. That order already
reflects domain weighting; don't re-derive your own priority order
under time pressure.

---

## 7. Signs you're behind schedule, and what to actually do about each

| Sign | What it usually means | What to do |
|---|---|---|
| Block B (new material) is regularly running past its 2h15 budget | The day's topic is genuinely denser than average (Day 3 — Glue/EMR/Flink/Lambda — is the single heaviest day in the plan) | Let Block B run over by up to 30–45 min on dense days specifically, but claw the time back from Block C (the anchor lab/diagram), never from Block D |
| Practice question accuracy isn't improving day over day | Reading isn't transferring into exam-shaped reasoning yet | Slow down and dissect every wrong option out loud (not just confirm the right answer) — the transfer happens in the "why is this wrong" step, which is easy to skip when short on time |
| You're still asking for placeholder files well past the day the plan schedules them | Scope creep — reading ahead instead of practicing the current day's material | Close the loop on the current day's Block D before requesting anything scheduled later |
| The Weak Topics Dashboard has more unfilled rows than filled ones by Day 5 | The dashboard habit didn't stick in Days 1–4 | Spend 15 minutes reconstructing it from memory plus a skim of each day's practice results before Day 5's review block — an imperfect dashboard beats an absent one |
| A full mock (Day 9) scores well below your day-by-day practice accuracy | Practice questions were reviewed in isolation (right after reading the relevant section) rather than under exam-like mixed-topic, timed conditions | Run a second, smaller timed mixed-topic set (even 20 questions from `06-practice/`) before Day 9 to surface this earlier than the real mock |

**The single highest-leverage adjustment if you're genuinely behind:**
it is never "read faster." It's "cut Block C first, and cut it before
Block B, never cut Block D" — the plan already encodes this priority
order; behind-schedule panic tends to invert it (skip questions to
"save time for reading"), which is exactly backwards for this exam.

---

## 8. If this is a retake

DEA-C01 has a 14-day mandatory wait before a retake. Two ways to use
that window, and they're not the same study mode as the first attempt:

- **You have your score report's domain breakdown — use it as the
  Weak Topics Dashboard you should have had the first time.** Don't
  restart the 10-day plan from Day 1. Go straight to the domain(s) that
  scored lowest, reread only the specific sub-sections `EXAM-TRAPS.md`
  and the relevant `DOMAIN-N-*.md` cover for those topics, then spend
  the large majority of the 14 days on fresh practice questions in
  those domains specifically.
- **If you passed comfortably in every domain except one, that one
  domain is now your entire study plan** — not "spend a bit more time
  on it among other things." A 14-day window aimed narrowly at one
  weak domain, with heavy practice-question volume, is a materially
  different (and more effective) use of the time than a diffuse
  full re-read.

The failure mode to avoid on a retake is treating it like the first
attempt again — rereading material you already know cold feels
productive and isn't. The score report exists specifically so you
don't have to guess where the gap was; use it as the starting point,
not a formality to glance at once.
