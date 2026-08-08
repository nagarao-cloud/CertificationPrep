# EXAM-STRATEGY.md

## The 130 minutes

| Phase | Time | Goal |
|---|---|---|
| **Pass 1** | 0–95 min | Answer everything you know in ≤90 s. Flag anything that takes longer and **move on**. |
| **Pass 2** | 95–120 min | Return to flagged questions with fresh eyes. |
| **Pass 3** | 120–130 min | Final sweep: confirm nothing is blank, sanity-check multi-response counts. |

Budget is ~2:00/question, but the distribution is uneven — half the
questions take 45 seconds and half take three minutes. Pass 1 exists to
bank the easy ones before the hard ones eat your clock.

**Never leave a question blank.** There is no penalty for a wrong answer.

---

## The 5-step routine for every question

1. **Read the last sentence first.** It contains the actual ask
   ("Which solution meets these requirements with the *least
   operational overhead*?"). Now you know what you're optimizing.
2. **Underline the constraint** — cost / ops overhead / latency /
   "existing X" / compliance.
3. **Locate the pipeline stage** (Source → Ingest → Transform → Store →
   Present → Govern). Options at the wrong stage are wrong.
4. **Eliminate two options** before evaluating the remaining two.
   Almost every question has two obviously-wrong distractors.
5. **Choose between the final two using the constraint from step 2**,
   not from which service you like more.

---

## Elimination heuristics (use when genuinely stuck)

These are tiebreakers, not laws. They're right more often than a coin flip.

- **Retired/renamed services** → wrong (Data Pipeline, Glue Elastic Views)
- **Options requiring you to manage servers** when the question says
  "operational overhead" → wrong
- **Options that move data unnecessarily** (copy S3 → EBS → process) → wrong
- **"Write a custom application/script"** when a managed service exists → usually wrong
- **Absolute language** in a non-technical option ("ensures zero
  latency," "guarantees no data loss ever") → usually wrong
- **The longest, most complex option** is rarely right on a
  "least operational overhead" question — and often right on a
  "lowest cost at petabyte scale" question
- **Two options that are functionally identical** → both wrong (they
  cancel out; the answer is one of the other two)

---

## Multiple-response questions

- The stem tells you how many ("Select TWO", "Select THREE"). Selecting
  the wrong count = automatically wrong, no partial credit.
- Treat each option as an independent true/false statement.
- Common pattern: the correct pair is **one ingestion/storage choice +
  one configuration detail**, not two competing services.

---

## Managing the panic moment

If you hit 5 hard questions in a row and start to spiral:

1. Flag all 5, move on immediately. Do not fight them.
2. Remember scoring is **compensatory** — you can miss ~18 questions and
   still pass comfortably.
3. Two of those 5 are probably unscored pilot questions anyway.

A 720/1000 is roughly 70–75% correct. You are allowed to not know things.

---

## The week before

- **Book the exam now** if you haven't. Slots fill up; a booked date
  also stops the "one more day of studying" spiral.
- If English is your second language, request the **+30 minute
  accommodation before booking** — it's free and approval isn't instant.
- Take at least one full mock under **real conditions**: 130-minute
  timer, no notes, no pausing, no phone.

## The night before

- Review only: comparison matrices, mnemonics, your own mistake list.
- **No new material.** Learning something new the night before
  destabilizes what you already know.
- Stop by 6 pm. Sleep is a higher-scoring activity than cramming.

## Exam day

- Test center: two forms of ID, arrive 30 min early.
- Online proctored: join **30 minutes early** — system checks and
  proctor queues are the #1 cause of avoidable stress. Clear desk,
  closed door, no second monitor.
- Eat something. 130 minutes of scenario reading burns real glucose.
