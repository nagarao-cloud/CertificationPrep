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
| 2-3 | GenAI foundations — FM concepts/lifecycle, capabilities & limitations, AWS GenAI infrastructure (Bedrock/PartyRock/JumpStart/Q) | Domain 2: Fundamentals of Generative AI (all 3 task statements — small enough domain to complete in one file) | 24% | `01-domains/DOMAIN-2-fundamentals-of-generative-ai.md` | ✅ written |
| 4-5 | FM application design (model selection, inference params, RAG, vector DBs), prompt engineering techniques & risks, fine-tuning, evaluation metrics | Domain 3: Applications of Foundation Models (all 4 task statements — largest domain, completed in one file) | 28% | `01-domains/DOMAIN-3-applications-of-foundation-models.md` | ✅ written |
| 6 | Responsible AI — bias, fairness, explainability, transparency | Domain 4: Guidelines for Responsible AI | 14% | `01-domains/DOMAIN-4-responsible-ai.md` | ✅ written |
| 7 | Security, compliance, governance for AI solutions | Domain 5: Security, Compliance, and Governance for AI Solutions | 14% | `01-domains/DOMAIN-5-security-compliance-governance.md` | ✅ written |
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
