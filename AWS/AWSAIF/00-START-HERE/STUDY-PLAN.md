# AIF-C01 Study Plan

Default pacing: **10-day sprint**, roughly proportional to domain weight,
plus dedicated practice/revision days. Not a fixed schedule — say
"stretch this to N days" or "compress to N days" any time and the table
below gets re-sliced, not the content re-written.

This is a foundational-level exam (65 questions, 90 minutes, conceptual
rather than hands-on). Depth per domain below is calibrated to that —
dense on concepts, service *selection* criteria, and exam traps; light
on implementation detail (no CLI/SDK depth expected).

| Day | Focus | Domain(s) covered | Weight | Primary file(s) | Status |
|---|---|---|---|---|---|
| 1 | AI/ML fundamentals — terminology, ML types, lifecycle, metrics | Domain 1: Fundamentals of AI and ML | 20% | `01-domains/DOMAIN-1-fundamentals-of-ai-and-ml.md` | ✅ written |
| 2 | GenAI foundations — how FMs work, prompt engineering basics, GenAI lifecycle | Domain 2: Fundamentals of Generative AI (part 1) | 24% | `01-domains/DOMAIN-2-fundamentals-of-generative-ai.md` | 🕐 scheduled |
| 3 | GenAI capabilities & limitations — advanced techniques, GenAI risks | Domain 2: Fundamentals of Generative AI (part 2) | (cont.) | same file, extended | 🕐 scheduled |
| 4 | Foundation model applications — RAG, fine-tuning, agents, Bedrock | Domain 3: Applications of Foundation Models (part 1) | 28% | `01-domains/DOMAIN-3-applications-of-foundation-models.md` | 🕐 scheduled |
| 5 | Prompt engineering deep dive, model selection & evaluation, cost/performance | Domain 3: Applications of Foundation Models (part 2) | (cont.) | same file, extended | 🕐 scheduled |
| 6 | Responsible AI — bias, fairness, explainability, transparency | Domain 4: Guidelines for Responsible AI | 14% | `01-domains/DOMAIN-4-responsible-ai.md` | 🕐 scheduled |
| 7 | Security, compliance, governance for AI solutions | Domain 5: Security, Compliance, and Governance for AI Solutions | 14% | `01-domains/DOMAIN-5-security-compliance-governance.md` | 🕐 scheduled |
| 8 | AWS AI/ML service matrix — head-to-head comparisons across all 5 domains | Cross-domain | — | `03-comparisons/` | 🕐 scheduled |
| 9 | Full practice exam (65 Qs, timed) + weak-area review | Cross-domain | — | `06-practice/` | 🕐 scheduled |
| 10 | Final revision sheet, flashcards, mnemonics, exam-day checklist | Cross-domain | — | `07-revision/` | 🕐 scheduled |

## Why this order

Domains 1 → 2 → 3 is deliberately the exam's own domain order and also
the natural conceptual build: you can't reason about foundation models
(Domain 2) without ML fundamentals (Domain 1), and you can't reason
about *applying* foundation models (Domain 3, the largest domain at 28%)
without first knowing what they are. Domains 4 and 5 (responsible AI,
security/governance) come last on purpose — they're the two most
often under-studied because they're non-technical, but they carry 28%
combined, the same weight as Domain 3 alone. Don't compress them just
because they read faster.

## Requesting a day

Say **"Day N"** and that day's file(s) get written at full depth (or
extended, for days that continue a prior day's file — see section 9 of
this folder's `CLAUDE.md`). Say **"quiz me on Domain N"** any time for a
40-question mixed-difficulty set once that domain's content exists.
