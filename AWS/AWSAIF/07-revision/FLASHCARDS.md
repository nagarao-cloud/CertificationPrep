# AIF-C01 Flashcards

Q on one line, A folded under it. Compressed by design — one fact per
card, no elaboration. Go domain by domain, or shuffle by reading in
random order once you know them cold in sequence.

## Domain 1 — Fundamentals of AI and ML

<details><summary>What's the containment relationship between AI, ML, DL, GenAI, and agentic AI?</summary>AI ⊃ ML ⊃ DL ⊃ GenAI ⊃ Agentic AI — each a strict subset of the one before.</details>
<details><summary>Supervised vs. unsupervised vs. reinforcement vs. self-supervised — one line each?</summary>Supervised = labeled data. Unsupervised = no labels, finds structure. Reinforcement = reward signal from an environment. Self-supervised = generates its own labels from data structure.</details>
<details><summary>What is RLHF?</summary>Reinforcement learning where the reward signal comes from human preference judgments — used to align foundation models.</details>
<details><summary>Overfitting vs. underfitting — the tell?</summary>Overfit: high train, low test. Underfit: low on both.</details>
<details><summary>Model performance metrics vs. business metrics — the distinction?</summary>Model metrics measure statistical prediction quality (accuracy, F1, AUC). Business metrics measure whether the model is worth its cost (ROI, cost/user, customer feedback).</details>
<details><summary>Data drift vs. concept drift?</summary>Data drift = input distribution shifted. Concept drift = the input-output relationship itself shifted.</details>
<details><summary>The 6 ML lifecycle stages?</summary>Frame the problem → collect data → prepare/engineer features → train/evaluate → deploy → monitor/retrain (loops back).</details>
<details><summary>When should you NOT use ML?</summary>When the task needs a guaranteed, identical, fully auditable answer every time (e.g., tax calculation) — use deterministic rules instead.</details>

## Domain 2 — Fundamentals of Generative AI

<details><summary>Three types of GenAI models named on the exam?</summary>LLMs (text), multi-modal models (>1 data type), diffusion models (denoising → images).</details>
<details><summary>Token vs. embedding vs. context window?</summary>Token = the unit the model processes. Embedding = a semantic vector representation. Context window = max input+output tokens per call.</details>
<details><summary>The 7-stage FM lifecycle?</summary>Data selection → model selection → pre-training → fine-tuning → evaluation → deployment → feedback.</details>
<details><summary>Which FM lifecycle stage does a typical Bedrock customer enter at?</summary>Model selection — data selection and pre-training are the FM provider's job.</details>
<details><summary>GenAI's 3 named advantages?</summary>Adaptability, responsiveness, simplicity.</details>
<details><summary>GenAI's 4 named limitations?</summary>Hallucinations, interpretability, inaccuracy, nondeterminism.</details>
<details><summary>Bedrock vs. PartyRock vs. SageMaker JumpStart — one line each?</summary>Bedrock = managed FM API + app-building tools. PartyRock = no-code prototyping playground. JumpStart = pre-trained model hub with deeper infra control, within SageMaker AI.</details>
<details><summary>On-demand vs. provisioned throughput pricing — when each?</summary>On-demand (per-token) = unpredictable/bursty traffic. Provisioned throughput (flat reserved rate) = steady, predictable, high volume.</details>

## Domain 3 — Applications of Foundation Models

<details><summary>The 8 model-selection criteria?</summary>Cost, modality, latency, multi-lingual, model size, complexity, customization support, input/output length.</details>
<details><summary>What does lowering temperature do?</summary>Produces more deterministic, focused, repeatable output (vs. higher = more creative/varied, more hallucination risk).</details>
<details><summary>What does RAG do, mechanically?</summary>Embeds the query, retrieves top-k relevant chunks from a vector store, injects them as context, then the FM generates a grounded answer.</details>
<details><summary>4 AWS vector store options and their fit?</summary>OpenSearch Service (search-native default), Aurora/RDS w/ pgvector (relational), Neptune (graph/relationships matter), DocumentDB (document model).</details>
<details><summary>Zero-shot vs. few-shot vs. chain-of-thought?</summary>Zero-shot = no examples. Few-shot = multiple in-prompt examples. Chain-of-thought = prompts step-by-step reasoning before the final answer.</details>
<details><summary>Prompt injection's two named subtypes?</summary>Goal hijacking (redirects the task) and prompt leaking (exfiltrates hidden instructions).</details>
<details><summary>Continuous pre-training vs. fine-tuning?</summary>Continuous pre-training = unlabeled domain data, broadens knowledge. Fine-tuning = labeled task-specific data, shapes specific behavior.</details>
<details><summary>The cost/effort ladder for adapting a model, cheapest to most expensive?</summary>Prompt engineering → RAG → Fine-tuning. Justify moving right before doing it.</details>
<details><summary>ROUGE vs. BLEU vs. BERTScore?</summary>ROUGE = recall-oriented, summarization. BLEU = precision-oriented, translation. BERTScore = embedding-based semantic similarity, tolerates paraphrasing.</details>

## Domain 4 — Guidelines for Responsible AI

<details><summary>The six responsible-AI features?</summary>Bias, fairness, inclusivity, robustness, safety, veracity ("BFIRSV").</details>
<details><summary>SageMaker Clarify vs. Bedrock Guardrails?</summary>Clarify = detects bias, explains predictions via SHAP (pre/post-training analysis). Guardrails = runtime content/safety filtering.</details>
<details><summary>5 named legal risks of GenAI?</summary>IP infringement claims, biased outputs, loss of customer trust, end-user risk, hallucinations.</details>
<details><summary>4 responsible dataset characteristics?</summary>Inclusivity, diversity, curated data sources, balanced datasets ("IDCB").</details>
<details><summary>The interpretability-vs-performance tradeoff, one line?</summary>Simpler/explainable models (regression, trees) are easier to audit but may cap out below deep learning/FMs on complex tasks.</details>
<details><summary>What does a SageMaker Model Card do?</summary>Structured documentation of a model's intended use, limitations, training data, and ethical considerations — not a runtime filter.</details>
<details><summary>Human-centered design requires input from whom?</summary>Product, policy/legal, engineering/AI-ML teams, and end users/affected communities — not engineering alone.</details>

## Domain 5 — Security, Compliance, and Governance for AI Solutions

<details><summary>Shared responsibility model, AI edition — one line?</summary>AWS secures the platform ("of the cloud"); the customer secures their data, IAM, Guardrails config, and application layer ("in the cloud") — always.</details>
<details><summary>What does AWS PrivateLink do here?</summary>Provides private VPC connectivity to Bedrock/SageMaker AI without traversing the public internet.</details>
<details><summary>5 GenAI-specific threats?</summary>Prompt injection, data poisoning, adversarial attacks, data leakage, bias amplification.</details>
<details><summary>Generative AI Security Scoping Matrix, the core principle?</summary>Scope 1 (consumer app) → 5 (self-trained model): more ownership/control means more security responsibility, not "more secure."</details>
<details><summary>Config vs. CloudTrail vs. Audit Manager vs. Artifact vs. Inspector vs. Trusted Advisor — one question each?</summary>Config: is my config compliant? CloudTrail: who called what, when? Audit Manager: do I have evidence for framework X? Artifact: where's AWS's own compliance documentation? Inspector: any known vulnerabilities? Trusted Advisor: what best practices am I missing?</details>
<details><summary>What is data lineage?</summary>Tracking a dataset's origin and every transformation before it reached a model — supports auditability.</details>
<details><summary>What's missing if governance is checked only once at launch?</summary>A review cadence — governance requires ongoing, periodic re-evaluation, not a one-time check.</details>

---

*44 cards. Cross-reference `REVISION-SHEET.md` for the same material in
prose-table form, or the full `01-domains/` files when a card doesn't
click.*
