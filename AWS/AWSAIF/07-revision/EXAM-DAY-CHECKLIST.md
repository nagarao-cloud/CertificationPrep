# Exam-Day Checklist

## Mnemonics quick list (last thing to review before you go in)

- **AI ⊃ ML ⊃ DL ⊃ GenAI ⊃ Agentic AI** — strict containment.
- **"Frame, Feed, Fit, Field, Follow"** — the ML lifecycle in five words.
- **"HIIN"** — GenAI's 4 limitations: Hallucination, Interpretability,
  Inaccuracy, Nondeterminism.
- **"GKAF"** — Bedrock's 4 app-building blocks: Guardrails, Knowledge
  Bases, Agents, Fine-tuning/evaluation.
- **"CRIMS"** — model selection: Cost, Reasoning complexity, Input/
  output length, Modality, Speed.
- **"PRF" ladder** — Prompt engineering → RAG → Fine-tuning, cheapest
  to most expensive; justify moving right.
- **ROUGE = Recall (summarization). BLEU = Bilingual/translation.**
- **"BFIRSV"** — responsible AI's 6 features: Bias, Fairness,
  Inclusivity, Robustness, Safety, Veracity.
- **"IDCB"** — dataset characteristics: Inclusivity, Diversity, Curated
  sources, Balanced.
- **"AWS secures the shelf, you secure what you put on it"** — shared
  responsibility model.
- **"CCAAIT"** — 6 governance services: Config, CloudTrail, Audit
  Manager, Artifact, Inspector, Trusted Advisor.
- **Scoping Matrix 1→5: "Consume, enterprise-Consume, Call, Customize,
  Create."**

## The morning of

- [ ] Confirm exam mode (testing center vs. online proctored) and
      arrive/log in with buffer time — online proctoring check-in and
      ID verification routinely eats 15-30 minutes before the clock
      starts.
- [ ] Valid photo ID matching your registration name exactly.
- [ ] For online proctoring: clear desk, no notes/second monitor/phone
      in reach, stable internet, quiet room, webcam and mic tested.
- [ ] Don't cram new material same-day — review this file and
      `REVISION-SHEET.md` only. New material the morning of adds noise,
      not signal, at this point.

## Time management (90 minutes / 65 questions)

- That's **~1.4 minutes per question** on average. Budget roughly:
  - First pass: answer everything you're confident on, flag anything
    uncertain, don't stall on one question.
  - Target finishing the first pass with ~20-25 minutes left for
    flagged-question review.
- Don't leave anything blank — there's no penalty for a wrong answer,
  so an educated guess always beats leaving it empty.

## Reading the question itself

- Watch for **absolute wording traps**: a scenario emphasizing cost →
  the cheapest option that still meets the stated requirement wins, not
  the most capable one. A scenario emphasizing a hard regulatory
  explainability requirement → the more interpretable option wins even
  at some accuracy cost.
- If two options both sound technically correct, re-read the scenario
  for the ONE constraint (cost, latency, explainability, data currency,
  scale) that the question is actually testing — that constraint
  usually eliminates one of the two.
- For **[Select TWO/THREE]** questions: read all options before
  picking — a plausible-sounding single option can be a distractor
  when the *pair* the question wants is more specific.
- Don't assume the newest-sounding/most-sophisticated answer (e.g.,
  "fine-tune a custom model," "train from scratch") is correct by
  default — this exam consistently rewards the simplest technique that
  satisfies the stated requirement (Domain 3's prompt→RAG→fine-tune
  ladder is the single most-recurring trap shape across the whole exam).

## After you submit

- The exam typically gives a provisional pass/fail result immediately,
  with the official score report following within a few business days.
- If you don't pass: AWS requires a 14-day wait before rescheduling,
  and each retake costs the full $100 fee — use the wait to revisit
  `MOCK-EXAM-1-ANSWER-KEY.md`'s per-domain weak-area breakdown and
  re-read specifically the domain file(s) where you scored lowest.

---

*Good luck. If you've worked through Days 1-9, you've covered every
task statement in the official exam guide at full depth, with 76
domain-file practice questions (15+15+18+14+14 across Domains 1-5)
plus a 65-question proportional mock exam behind you.*
