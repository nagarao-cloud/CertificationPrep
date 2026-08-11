# AIF-C01 Revision Sheet

Compressed by design — this is the "read this once the night before"
document, not a teaching document. Full explanations live in
`01-domains/`. If a line here doesn't make sense, that's the signal to
go re-read that domain's full file, not to expand this one.

## Exam facts

65 Qs (50 scored / 15 unscored) · 90 min · pass 700/1000 · $100 · MC/MR/
ordering/matching/case-study formats · 3-yr validity

## Domain weights

D1 AI/ML fundamentals 20% · D2 GenAI fundamentals 24% · D3 FM
applications 28% · D4 Responsible AI 14% · D5 Security/Governance 14%

---

## Domain 1 — Fundamentals of AI and ML

- AI ⊃ ML ⊃ DL ⊃ GenAI ⊃ Agentic AI (strict containment)
- Supervised (labeled) / Unsupervised (unlabeled, clustering) /
  Reinforcement (reward signal — RLHF = reward from human preference) /
  Self-supervised (generates own labels — how FMs pretrain)
- Overfit = high train, low test. Underfit = low on both.
- Model metrics: accuracy, precision, recall, F1, AUC, RMSE/MAE.
  Business metrics: cost/user, dev cost, customer feedback, ROI.
  Watch imbalanced-class accuracy traps.
- Lifecycle: frame → collect → prepare → train/evaluate → deploy →
  monitor/retrain (loop). Data drift = input shifted. Concept drift =
  input→output relationship shifted.
- Prefer a purpose-built managed AI service over custom SageMaker AI
  when one fits the use case.
- Don't use ML for deterministic, fully auditable, 100%-explainable
  calculations — use rules instead.

## Domain 2 — Fundamentals of Generative AI

- FM types: LLM (text), multi-modal (>1 data type), diffusion
  (denoising → images).
- Tokens (billing/capacity unit), embeddings (semantic vectors),
  context window (max input+output tokens).
- FM lifecycle: data selection → model selection → pre-training →
  fine-tuning → evaluation → deployment → feedback. Bedrock customers
  enter at **model selection** — provider did selection/pre-training.
- Advantages: adaptability, responsiveness, simplicity.
  Limitations: hallucinations, interpretability, inaccuracy,
  nondeterminism.
- Bedrock (managed FM API + Guardrails/Knowledge Bases/Agents) ·
  PartyRock (no-code prototyping) · SageMaker JumpStart (pre-trained
  models, more infra control) · Amazon Q (Business/Developer assistants)
- On-demand token pricing = unpredictable/bursty traffic. Provisioned
  throughput = steady/predictable high volume.

## Domain 3 — Applications of Foundation Models

- Model selection: cost, modality, latency, multi-lingual, size,
  complexity, customization, input/output length.
- Temperature: low = deterministic/repeatable, high = creative/varied.
- RAG grounds output in retrieved data — no weight changes, cheap to
  keep current. Vector stores: OpenSearch (search-native default),
  Aurora/RDS pgvector (relational), Neptune (graph/relationships),
  DocumentDB (document model).
- Prompting: zero-shot, few-shot (examples in-prompt), chain-of-thought
  (step-by-step reasoning), negative prompting (what NOT to do).
- Misuse risks: prompt injection (goal hijacking, prompt leaking),
  jailbreaking (bypass safety), poisoning (corrupt training data).
- Pre-training (FM provider) vs. continuous pre-training (unlabeled
  domain data, broadens knowledge) vs. fine-tuning (labeled data,
  shapes specific behavior). Methods: instruction tuning, domain
  adaptation, transfer learning, RLHF.
- **Decision ladder, cheapest first: Prompt engineering → RAG →
  Fine-tuning.** Don't jump to fine-tuning if prompting/RAG solves it.
- Eval: human evaluation vs. automated. ROUGE = recall,
  summarization. BLEU = precision, translation. BERTScore = semantic
  (embedding-based), tolerates paraphrase.

## Domain 4 — Guidelines for Responsible AI

- Six features: **B**ias, **F**airness, **I**nclusivity,
  **R**obustness, **S**afety, **V**eracity ("BFIRSV").
- SageMaker Clarify = bias detection + SHAP explainability. Bedrock
  Guardrails = runtime safety/content filtering.
- Model selection should weigh environmental/sustainability cost too —
  not just accuracy/cost/latency.
- Legal risks: IP infringement, biased outputs, loss of customer
  trust, end-user risk, hallucinations (as liability, not just a bug).
- Dataset characteristics: inclusivity, diversity, curated sources,
  balanced ("IDCB").
- Interpretability vs. performance tradeoff: simple/explainable models
  (regression, trees) cap out lower than deep learning/FMs but are
  auditable. Hard regulatory explainability requirement → prefer the
  simpler model even at some accuracy cost.
- SageMaker Model Cards = documentation ("nutrition label"), not a
  safety filter.
- Human-centered design = iterative input from product/policy/legal/
  engineering/end users, not engineering alone.

## Domain 5 — Security, Compliance, and Governance for AI Solutions

- Shared responsibility: AWS secures the platform; customer secures
  data, IAM, Guardrails config, application layer — always.
- PrivateLink = private VPC connectivity to Bedrock/SageMaker AI.
  Encryption at rest (KMS) / in transit (TLS).
- Secure data engineering: data quality, PETs (anonymization,
  tokenization, differential privacy), access controls.
- GenAI threats: prompt injection, data poisoning, adversarial
  attacks, data leakage, bias amplification.
- Generative AI Security Scoping Matrix: Scope 1 (consumer app, least
  control/responsibility) → 5 (self-trained model, most
  control/responsibility). More control = more responsibility, not
  "more secure."
- Six governance services, each answers ONE question:
  **Config** = current config vs. compliant state? **CloudTrail** =
  who called what, when? **Audit Manager** = evidence for a compliance
  framework? **Artifact** = AWS's own certifications? **Inspector** =
  known vulnerabilities? **Trusted Advisor** = general best-practice
  gaps?
- Data governance = an ongoing lifecycle (collect → store → use →
  archive → delete) with logging, residency, monitoring, retention,
  and a recurring **review cadence** — not a one-time launch check.

---

*Cross-reference `03-comparisons/AWS-AI-ML-SERVICE-MATRIX.md` for the
full head-to-head tables this sheet compresses, and
`07-revision/EXAM-DAY-CHECKLIST.md` for exam-day logistics.*
