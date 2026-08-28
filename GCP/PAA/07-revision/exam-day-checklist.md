# Exam-Day Checklist — PAA

> Compressed by design (CLAUDE.md §10) — this is the last thing you
> read before your exam, not a re-teach. For registration/scheduling
> facts and what's confirmed vs. genuinely unknown about this beta
> exam's logistics, see `RUNBOOK.md` §2a first — that content is not
> repeated here.

---

## 1. Before you book

Read `00-START-HERE/RUNBOOK.md` §2a in full before registering. Short
version: registration opens 2026-09-03 via
`cloud.google.com/learn/certification/agentic-architect`; both
components (proctored MC exam + Google Skills hands-on labs) are
required; scheduling mechanics between the two components are not
confirmed by any source this folder was built from — check the
official page directly, not this checklist, for that.

---

## 2. Part 1 — the proctored multiple-choice exam

**What to expect:** ~80 questions, 3 hours, delivered by Pearson,
online-proctored or onsite at a test center (`RUNBOOK.md` §2).

**ID and environment requirements** — the items below are **generic
Pearson VUE proctoring practice**, not independently confirmed for this
specific beta exam (this environment has no way to verify PAA-specific
exceptions). Treat this as "what to expect by default," and re-check
Pearson's current policy when you schedule:

- A valid, government-issued photo ID matching your registration name exactly.
- For online-proctored: a clear desk/workspace, no second monitor, no
  notes or scratch paper unless explicitly permitted, a working
  webcam/microphone for identity and room checks, and a stable internet
  connection tested beforehand.
- For onsite: arrive early enough for check-in; personal items
  (phones, watches, bags) are typically not allowed at the workstation.

**Format reminder:** this exam tests "system design choices and
architectural standards" (`RUNBOOK.md` §2's description) — expect
scenario-based questions, not pure recall. Budget your 3 hours with
that in mind; a scenario question needs more read-and-think time than
a definition question.

---

## 3. Part 2 — the Google Skills hands-on labs

**What to expect, conceptually:** lab-based, hands-on execution/coding
ability validated separately from the MC exam (`RUNBOOK.md` §2). Beyond
that, this folder cannot tell you the exact task format, time limit, or
interface — this environment never had live access to the Google
Skills platform (see `RUNBOOK.md` §1's access note). The closest
preparation this folder offers is `05-labs/lab-07-capstone-realtime-agentic-project.md`
§0.4, which walks through the one piece of console exposure that could
be verified: creating and configuring a real Google Cloud project.

**Practical prep, regardless of the exact format:** make sure you've
actually run through at least a few of `05-labs/`'s walkthroughs
hands-on (not just read them) before this component — every lab in
this folder is flagged as illustrative/best-effort precisely because
reading alone isn't the same as having touched the actual console.

---

## 4. Morning-of checklist

- [ ] Confirm which proctoring mode you registered for (online vs.
      onsite) and its specific requirements one more time.
- [ ] If you've been running GCP labs/the capstone on a real account:
      confirm nothing is still running and billing (see the capstone's
      §0.5.3 — check Billing → Reports). Don't let exam-day nerves be
      compounded by an unrelated billing surprise.
- [ ] Don't cram new material today. Re-read only `master-flashcards.md`
      and this file.
- [ ] Re-read §5 below one more time — it's the fastest possible pass
      over this folder's highest-value content.

---

## 5. If you only have five minutes — pulled from `EXAM-TRAPS-AND-MNEMONICS.md`

1. **Agent Runtime**, not Agent Engine. **Agent Search**, not Vertex AI
   Search. The single most likely trap in the whole exam.
2. Weights are **published**, sum to 100, peak hard at Section 3 (33%):
   13 / 17 / 33 / 22 / 15 — ascend, peak, descend.
3. **A2A = agent-to-agent. MCP = agent-to-tool/data.** Never interchange
   them.
4. **PAB (who) → Agent Gateway (what's flowing) → Model Armor (is it
   safe).** Three security layers, not one.
5. **GKE means two different things** depending on the task: 2.1
   (coding-agent sandbox) vs. 4.2 (production deployment target).

Full reasoning for every item above: `00-START-HERE/EXAM-TRAPS-AND-MNEMONICS.md`.

---

## 6. After you submit

Pass score is **not publicly disclosed** for this beta exam
(`RUNBOOK.md` §2) — you likely won't get a numeric score breakdown, and
this folder has no confirmed source for a retake wait period or fee
(unlike some established certifications with a published retake
policy — PAA's beta status means this genuinely isn't known yet).
**Check the official retake/results policy on the certification page**
rather than assuming a number — do not treat any specific wait
period or fee as established fact unless you read it there directly.
