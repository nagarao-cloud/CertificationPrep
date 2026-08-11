# Domain 2: Fundamentals of Generative AI

**Weight: 24% of scored content** — the single most-weighted domain
after Domain 3, and the one most people who've only used ChatGPT
underestimate. AWS tests the *mechanics* and the *business tradeoffs* of
GenAI here, not just "can you use a chatbot."

> Builds directly on Domain 1's AI/ML/DL/GenAI/agentic-AI hierarchy and
> RLHF. If those aren't solid, revisit
> `01-domains/DOMAIN-1-fundamentals-of-ai-and-ml.md` §1.1.2–1.1.3 first.

```
Domain 2 = three task statements
┌─────────────────────────────────────────────────────────────────┐
│ 2.1  Explain the basic concepts of generative AI                │
│ 2.2  Understand the capabilities and limitations of GenAI       │
│      for solving business problems                              │
│ 2.3  Describe AWS infrastructure and technologies for           │
│      building generative AI applications                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2.1 — Explain the basic concepts of generative AI

### 2.1.1 What makes a model a "foundation model"

A **foundation model (FM)** is pre-trained on a massive, broad, often
multi-domain dataset (self-supervised — see Domain 1 §1.1.3), producing
a model general-purpose enough to be *adapted* to many downstream tasks
via prompting, fine-tuning, or retrieval-augmentation — instead of being
built from scratch for one narrow task the way classical ML models
typically are.

| | Traditional task-specific model | Foundation model |
|---|---|---|
| Training data | Narrow, labeled, task-specific | Massive, broad, often unlabeled (self-supervised) |
| Built for | One task | Many tasks, adapted after the fact |
| Cost to stand up | Lower per model, but one per task | Very high to pretrain, but reused across tasks |
| Typical adaptation | Retrain from scratch | Prompt, fine-tune, or RAG on top of the existing FM |
| Example | A logistic regression model trained only to flag fraud | Claude, a Titan/Nova model, Llama — usable for fraud *and* summarization *and* code generation |

### 2.1.2 Types of generative AI models

| Type | What it generates | How it typically works | Example use |
|---|---|---|---|
| **Large Language Models (LLMs)** | Text | Transformer architecture, next-token prediction pretraining | Chat, summarization, code generation |
| **Multi-modal models** | Text, image, audio, video — often accepting more than one modality as input too | Combine modality-specific encoders with a shared reasoning backbone | "Describe this image," or generating an image from a text prompt |
| **Diffusion models** | Images (most common), audio, video | Learn to reverse a noise-adding process — start from random noise and iteratively denoise toward a coherent output conditioned on a prompt | Image generation from a text prompt |

**Exam trap:** don't assume "LLM" and "foundation model" are
interchangeable — every LLM is a foundation model, but foundation models
also include image-generating diffusion models and multi-modal models
that aren't language models at all.

### 2.1.3 The mechanics tested at a conceptual level

You are **not** expected to derive transformer math — only to know what
these terms mean and why they matter for using the model correctly.

| Term | What it means | Why it matters practically |
|---|---|---|
| **Token** | The unit a model actually processes — roughly a word-piece, not a whole word | Pricing, context-window limits, and latency are all measured in tokens, not characters or words |
| **Embedding** | A numeric vector representation of text (or another modality) that captures semantic meaning — similar meanings land near each other in vector space | This is what makes semantic search and RAG retrieval possible (§2.1.4 below, and Domain 3) |
| **Vector** | The embedding itself, as a list of numbers in high-dimensional space | Stored in a vector database for similarity search |
| **Transformer architecture** | The neural network design (self-attention mechanism) underlying essentially all modern LLMs — lets the model weigh the relevance of every other token when processing each token | Explains why LLMs handle long-range context better than older RNN-based models |
| **Context window** | The maximum number of tokens (input + output combined) a model can process in one call | A conversation or document that exceeds it gets truncated or must be chunked — a real, tested design constraint |
| **Prompt** | The input text given to the model to elicit a response | The primary lever for controlling FM output without retraining (full depth in Domain 3) |

### 2.1.4 Use cases for generative AI

| Use case | What it is |
|---|---|
| Image, video, and audio generation | Creating new visual/audio media from a text prompt or other input |
| Summarization | Condensing long text into a shorter form while preserving key meaning |
| Chatbots | Conversational interfaces for support, sales, or general Q&A |
| Translation | Converting text between languages, often with better fluency than older statistical MT |
| Code generation | Producing or completing source code from natural-language intent |
| Customer service agents | GenAI-driven (or agentic — see Domain 1 §1.1.1) automated support |
| Search | Semantic/natural-language search over a document corpus |
| Recommendation engines | GenAI-augmented personalization, often blended with classical recommendation techniques |

### 2.1.5 The foundation model lifecycle

```
 ┌───────────┐   ┌───────────┐   ┌──────────────┐   ┌─────────────┐
 │  1. Data   │──►│ 2. Model  │──►│ 3. Pre-      │──►│ 4. Fine-    │
 │  selection │   │  selection │   │    training  │   │    tuning   │
 └───────────┘   └───────────┘   └──────────────┘   └─────────────┘
                                                              │
                                                              v
                    ┌─────────────┐   ┌─────────────┐   ┌──────────────┐
                    │ 7. Feedback  │◄──│ 6. Deploy-   │◄──│ 5. Evaluation│
                    │  (loop back  │   │    ment      │   │              │
                    │  to fine-    │   │              │   │              │
                    │  tuning or   │   │              │   │              │
                    │  model       │   │              │   │              │
                    │  selection)  │   │              │   │              │
                    └─────────────┘   └─────────────┘   └──────────────┘
```

| Stage | Who typically does this, for a Bedrock-based application |
|---|---|
| 1. Data selection | The FM provider (Anthropic, Amazon, Meta, etc.) selects pretraining data — an AWS customer building on Bedrock does **not** do this stage |
| 2. Model selection | **The customer's job** — choosing which foundation model fits the use case (see Domain 3's model-selection criteria) |
| 3. Pre-training | Done by the FM provider, at massive scale, before the model is ever offered on Bedrock |
| 4. Fine-tuning | Optional, customer-driven — adapting a base FM to a narrower domain/task with labeled examples (Domain 3 covers this in depth) |
| 5. Evaluation | Customer validates the model (or fine-tuned variant) against business requirements before shipping |
| 6. Deployment | Serving the model for inference — on Bedrock this is largely managed; via SageMaker AI/JumpStart it can be self-managed |
| 7. Feedback | Production usage data and human feedback loop back into further fine-tuning or a model-selection change |

**Exam-relevant distinction:** as a Bedrock customer, you typically enter
this lifecycle at **stage 2 (model selection)** — you are consuming a
model someone else pretrained, not doing stages 1 and 3 yourself. A
question describing "collecting a massive raw dataset and pretraining a
model from scratch" describes the FM *provider's* job, not the typical
AWS customer's.

---

## 2.2 — Capabilities and limitations of GenAI for solving business problems

### 2.2.1 Advantages

| Advantage | What it means | Business impact |
|---|---|---|
| **Adaptability** | The same base FM can be repointed at many different tasks via prompting or light fine-tuning | One model investment serves summarization, chat, classification, and generation instead of building N separate models |
| **Responsiveness** | Natural-language interaction lets non-technical users get useful output without writing code or queries | Broadens who in the business can extract value from the system |
| **Simplicity** | A plain-language prompt replaces what would otherwise require custom software or rule-writing | Faster time-to-prototype; lower engineering lift for a first version |
| *(also commonly cited)* Creativity / content generation at scale | Produces novel drafts (text, image, code) rather than only classifying existing content | Speeds up content-heavy workflows (marketing copy, code scaffolding, design drafts) |
| *(also commonly cited)* Personalization | Can tailor tone, format, and content to context without a separate model per segment | Supports 1:1-feeling customer experiences at scale |

### 2.2.2 Disadvantages / limitations

| Limitation | What it means | Business impact / mitigation |
|---|---|---|
| **Hallucinations** | The model generates plausible-sounding output that is factually wrong or fabricated, not grounded in training data or provided context | High risk in factual/regulated use cases; mitigate with RAG (grounding in retrieved real documents — Domain 3), human review, and low-temperature settings |
| **Interpretability** | FMs are effectively a "black box" — you can't fully trace *why* a specific output was produced | Complicates auditing and regulatory explainability requirements (ties directly into Domain 4/5) |
| **Inaccuracy** | Even without outright hallucination, outputs can be subtly wrong, outdated (knowledge-cutoff), or miscalibrated | Needs evaluation and human-in-the-loop review before high-stakes use |
| **Nondeterminism** | The same prompt can produce different outputs on different calls (especially at higher "temperature") | Complicates testing, reproducibility, and compliance sign-off — mitigate by lowering temperature/setting a fixed seed where supported |
| *(also commonly cited)* Cost at scale | Token-based inference pricing scales with usage; large models cost more per token | Requires ongoing cost monitoring — ties into Domain 2 §2.3's pricing models below |
| *(also commonly cited)* Prompt sensitivity | Small prompt wording changes can meaningfully change output quality | Motivates disciplined prompt engineering and versioning (Domain 3) |

### 2.2.3 Deciding whether GenAI is the right tool for a business problem

```
        Does the task require generating novel, unstructured
        content (text/image/audio/video), or reasoning in
        natural language over unstructured input?
                              │
                 ┌────────────┴────────────┐
                NO                          YES
                 │                           │
                 v                           v
        Consider classical ML or     Does the task require a
        a deterministic system       guaranteed-correct, fully
        (Domain 1 §1.2.2)            explainable, reproducible
                                      answer every time (e.g.,
                                      financial calculation,
                                      medical dosage)?
                                                │
                                   ┌────────────┴────────────┐
                                  YES                         NO
                                   │                           │
                                   v                           v
                          GenAI alone is a poor fit    GenAI is likely a strong
                          — hallucination/nondeter-    fit. Still pair with:
                          minism risk is too high.      - RAG for factual grounding
                          Consider GenAI ONLY as an     - Human review for high-
                          assistive draft with           stakes output
                          mandatory human/rule-based    - Guardrails for safety/
                          verification, not as the       compliance (Domain 3/5)
                          final authority.
```

---

## 2.3 — AWS infrastructure and technologies for building GenAI applications

### 2.3.1 The core services

| Service | What it is | When you'd reach for it |
|---|---|---|
| **Amazon Bedrock** | Fully managed service providing API access to a choice of foundation models (Anthropic Claude, Amazon Titan/Nova, Meta Llama, Mistral, and others) plus GenAI application-building capabilities (Knowledge Bases for RAG, Agents, Guardrails, model evaluation, fine-tuning) | The default starting point for most GenAI applications on AWS — no infrastructure to manage, pay-per-use access to multiple model providers through one API |
| **PartyRock** | A no-code/low-code Bedrock-powered playground for building and sharing GenAI mini-apps | Rapid prototyping of a prompt pattern or app concept before committing engineering effort — not a production deployment target |
| **Amazon SageMaker JumpStart** | A hub of pre-trained, open-source and proprietary foundation models plus solution templates, deployable within SageMaker AI | When you need SageMaker-based workflows — deeper control over training/tuning/hosting infrastructure than Bedrock offers, or a model not available on Bedrock |
| **Amazon Q** | GenAI-powered assistants: **Amazon Q Business** (enterprise knowledge assistant over your company data) and **Amazon Q Developer** (coding assistant integrated into IDEs and the AWS console) | Turnkey assistant experiences without building a custom application |

### 2.3.2 Bedrock's application-building building blocks

```
                 ┌───────────────────────────────────────────┐
                 │              Your application               │
                 └──────────────────────┬────────────────────┘
                                         │
                                         v
                 ┌───────────────────────────────────────────┐
                 │              Amazon Bedrock                 │
                 │  ┌─────────────┐  ┌─────────────────────┐  │
                 │  │ Guardrails   │  │  Agents              │  │
                 │  │ (safety/PII  │  │  (multi-step,        │  │
                 │  │  filtering)  │  │   tool-using —       │  │
                 │  └─────────────┘  │   Domain 1's          │  │
                 │  ┌─────────────┐  │   "agentic AI")       │  │
                 │  │ Knowledge    │  └─────────────────────┘  │
                 │  │ Bases (RAG)  │  ┌─────────────────────┐  │
                 │  └─────────────┘  │  Model evaluation /   │  │
                 │  ┌─────────────┐  │  fine-tuning          │  │
                 │  │ Foundation   │  └─────────────────────┘  │
                 │  │ models       │                            │
                 │  │ (Anthropic,  │                            │
                 │  │ Amazon Titan/│                            │
                 │  │ Nova, Meta,  │                            │
                 │  │ Mistral, …)  │                            │
                 │  └─────────────┘                            │
                 └───────────────────────────────────────────┘
```

Full depth on Guardrails, Knowledge Bases/RAG, Agents, and fine-tuning
is Domain 3 territory (Applications of Foundation Models) — Domain 2
only expects you to know these building blocks *exist* and roughly what
each does.

### 2.3.3 Cost and infrastructure tradeoffs

| Consideration | What it means | Decision impact |
|---|---|---|
| **Token-based pricing** | On-demand Bedrock pricing charges per input + output token | Cost scales directly with prompt length and output verbosity — a design lever, not just a billing detail |
| **Provisioned throughput** | Reserving dedicated model capacity for a fixed time commitment, at a flat rate instead of per-token | Worth it for high, predictable, sustained traffic where on-demand token costs would exceed a reserved rate |
| **Custom models** | Fine-tuned or continued-pretrained models hosted for your exclusive use | Higher cost and setup effort than using a base model as-is, justified when accuracy on a narrow domain matters more than cost |
| **Responsiveness / latency** | Time-to-first-token and total generation time | Larger models and multi-step agentic workflows trade latency for capability |
| **Availability / redundancy / regional coverage** | Whether a given model is offered in your AWS Region, and Bedrock's built-in high availability | Model/Region availability is a real constraint to check before committing to a model in a design |

**Decision rule tested on the exam:** unpredictable or low/bursty
traffic → **on-demand token-based pricing**. High, steady, predictable
traffic at a known volume → **provisioned throughput** is usually more
cost-effective. This mirrors the same on-demand-vs-reserved tradeoff
pattern used elsewhere in AWS (e.g., EC2 On-Demand vs. Reserved
Instances) — recognize the pattern rather than memorizing it as GenAI-
specific.

---

## Exam traps specific to Domain 2

1. **Treating "LLM" and "foundation model" as synonyms.** LLMs are one
   *type* of foundation model; diffusion models and multi-modal models
   are FMs too, and aren't LLMs.
2. **Assuming an AWS customer performs data selection and pre-training.**
   On Bedrock, those are the FM provider's job — the customer's
   lifecycle starts at model selection (§2.1.5).
3. **Picking "fine-tune a custom model" as the default answer** to a
   scenario that a base model + good prompting (or RAG) would already
   solve — the exam rewards recognizing when the simpler, cheaper option
   is sufficient (this theme recurs in Domain 3).
4. **Confusing hallucination with a data/training bug.** Hallucination
   is an inherent property of how generative models produce output, not
   necessarily a sign the model or data was flawed — it can happen even
   with excellent training data, which is why grounding (RAG) and human
   review are the standard mitigations rather than "just retrain it."
5. **Choosing on-demand pricing for a described high, steady, predictable
   workload**, or provisioned throughput for a described bursty,
   unpredictable one — the exam tests matching pricing model to traffic
   pattern, not just knowing both models exist.

## Mnemonics

- **"AIME" for FM lifecycle memory hook:** **A**cquire data → **I**nstantiate
  (pretrain/select) → **M**odify (fine-tune) → **E**valuate-deploy-feedback.
  (A compressed way to recall the 7-stage lifecycle's shape, not a
  replacement for knowing all 7 named stages verbatim.)
- **"HIIN" for GenAI's four named limitations:** **H**allucination,
  **I**nterpretability, **I**naccuracy, **N**ondeterminism.
- **Bedrock's four app-building blocks: "GKAF"** — **G**uardrails,
  **K**nowledge Bases, **A**gents, **F**ine-tuning/evaluation.

---

## Practice questions — Domain 2

*15 questions, every option explained.*

**Q1.** Which of the following is a diffusion model MOST commonly used
for?
A) Text summarization
B) Image generation from a text prompt
C) Speech-to-text transcription
D) Tabular data classification

<details><summary>Answer & explanation</summary>

**Correct: B.** Diffusion models learn to reverse a noise-adding process
to generate coherent images (or audio/video) conditioned on a prompt
(§2.1.2). **A (summarization)** and **C (transcription)** are text/
speech tasks typically handled by LLMs or specialized speech models, not
diffusion models. **D** is a classical ML classification task, unrelated
to generative modeling.
</details>

**Q2.** A company is building a Bedrock-based application and wants to
choose which foundation model to use for a customer-support chatbot.
According to the foundation model lifecycle, which stage does this
represent for the company?
A) Data selection
B) Pre-training
C) Model selection
D) Fine-tuning

<details><summary>Answer & explanation</summary>

**Correct: C.** As a Bedrock customer, choosing which available FM
fits the use case is model selection (§2.1.5) — the customer's typical
entry point into the lifecycle. **A (Data selection)** and **B
(Pre-training)** are the FM provider's responsibility, done before the
model is ever offered on Bedrock. **D (Fine-tuning)** is a later,
optional stage that happens only after a model has already been
selected.
</details>

**Q3.** What is the term for the numeric vector representation of text
that captures semantic meaning, used to enable semantic search?
A) Token
B) Embedding
C) Context window
D) Prompt

<details><summary>Answer & explanation</summary>

**Correct: B.** An embedding is exactly this — a vector encoding
semantic meaning so similar meanings land near each other in vector
space (§2.1.3). **A (Token)** is the discrete unit of text the model
processes, not a semantic vector. **C (Context window)** is the token
capacity limit for a single model call. **D (Prompt)** is the input text
given to the model, not its vector representation.
</details>

**Q4.** A legal team is evaluating whether to use a foundation model to
draft final, binding contract language without any human review. Which
GenAI limitation makes this the HIGHEST-risk use case as described?
A) Responsiveness
B) Hallucinations and nondeterminism together — fabricated or
   inconsistent legal language with no guarantee of correctness
C) Simplicity
D) Adaptability

<details><summary>Answer & explanation</summary>

**Correct: B.** Hallucination risks fabricated content presented
plausibly, and nondeterminism means the same prompt could produce
different contract language on different runs — both are named
limitations (§2.2.2) that make unreviewed, binding legal output
especially risky. **A, C, and D** are all *advantages* of GenAI
(§2.2.1), not risk factors — the question is asking what makes this
risky, not what's beneficial about GenAI in general.
</details>

**Q5.** Which AWS service is a no-code/low-code playground for
prototyping GenAI prompt patterns and app concepts, built on Bedrock?
A) Amazon SageMaker JumpStart
B) Amazon Q Developer
C) PartyRock
D) Amazon Comprehend

<details><summary>Answer & explanation</summary>

**Correct: C.** PartyRock is specifically the no-code Bedrock-powered
playground for rapid prototyping (§2.3.1). **A (SageMaker JumpStart)**
is a pre-trained model hub within SageMaker AI aimed at deeper
training/tuning/hosting control, not a no-code playground. **B (Amazon Q
Developer)** is a coding assistant, a different product category. **D
(Comprehend)** is an NLP service from Domain 1, unrelated to GenAI app
prototyping.
</details>

**Q6.** A company has highly variable, unpredictable GenAI application
traffic — some days near zero requests, other days a large spike. Which
Bedrock pricing model is MOST cost-effective?
A) Provisioned throughput, reserved for a year
B) On-demand, token-based pricing
C) A flat annual subscription regardless of usage
D) Reserved capacity sized for peak traffic year-round

<details><summary>Answer & explanation</summary>

**Correct: B.** On-demand token-based pricing matches cost directly to
actual usage — the right fit for unpredictable, bursty traffic (§2.3.3
decision rule). **A** and **D** both commit to paying for reserved
capacity that would sit largely idle on low-traffic days, wasting spend.
**C** isn't how Bedrock is actually priced and, even hypothetically,
would overpay during near-zero-usage periods just like the reserved
options.
</details>

**Q7.** What distinguishes a multi-modal foundation model from an LLM?
A) Multi-modal models cannot generate text at all
B) Multi-modal models can process and/or generate across more than one
   data type (e.g., text and images), while a standard LLM is
   text-focused
C) LLMs are always larger than multi-modal models
D) There is no meaningful difference

<details><summary>Answer & explanation</summary>

**Correct: B.** Multi-modal models combine modality-specific encoders to
handle text, image, audio, etc. together, while a standard LLM's input/
output is text (§2.1.2). **A** is false — many multi-modal models
generate text as one of their outputs. **C** is an unfounded and
irrelevant size comparison — model size isn't what defines the
modality distinction. **D** contradicts the exam guide's explicit
categorization of these as distinct model types.
</details>

**Q8.** A team wants to quickly test whether a specific prompt pattern
produces useful output before committing engineering resources to build
a full application. What is the BEST starting point?
A) Fine-tune a custom foundation model on SageMaker AI
B) Prototype the prompt in PartyRock
C) Pre-train a new foundation model from scratch
D) Build a full production Bedrock application with Guardrails and a
   Knowledge Base immediately

<details><summary>Answer & explanation</summary>

**Correct: B.** PartyRock exists precisely for this — fast, no-code
prototyping of prompt patterns before committing to a full build
(§2.3.1). **A** and **D** both represent significant engineering
investment inappropriate for an early "does this prompt even work"
test. **C** is wildly disproportionate — pre-training a new FM from
scratch is a massive undertaking almost never justified for an
individual application, let alone for testing a prompt idea.
</details>

**Q9.** Which term describes the maximum number of tokens (input plus
output) a foundation model can process in a single call?
A) Embedding dimension
B) Context window
C) Temperature
D) Provisioned throughput

<details><summary>Answer & explanation</summary>

**Correct: B.** Context window is the defined token capacity limit per
call (§2.1.3) — exceeding it means truncation or the need to chunk
input. **A (Embedding dimension)** refers to the size of a vector
representation, an unrelated concept. **C (Temperature)** controls
output randomness, not capacity. **D (Provisioned throughput)** is a
Bedrock pricing/capacity-reservation option, not a per-call token limit.
</details>

**Q10.** A company observes that asking their Bedrock-based application
the exact same question twice, in two separate calls, sometimes produces
noticeably different answers. Which GenAI characteristic explains this?
A) Hallucination
B) Interpretability
C) Nondeterminism
D) Adaptability

<details><summary>Answer & explanation</summary>

**Correct: C.** Nondeterminism is exactly this — the same prompt can
yield different outputs across calls, especially at higher temperature
settings (§2.2.2). **A (Hallucination)** describes fabricated/incorrect
content, not output-to-output variability specifically. **B
(Interpretability)** is about the difficulty of explaining *why* a model
produced an output, a different concept from run-to-run variation. **D
(Adaptability)** is an advantage (reusing one model across tasks), not a
limitation, and unrelated to this symptom.
</details>

**Q11.** Which of the following is the BEST example of a business
scenario well-suited to generative AI's strengths, without requiring a
guaranteed, fully deterministic answer?
A) Calculating a customer's exact loan interest owed
B) Drafting a first-pass marketing email for a human to review and edit
C) Issuing final medical dosage instructions with no review
D) Computing exact regulatory tax withholding

<details><summary>Answer & explanation</summary>

**Correct: B.** Drafting content for human review plays directly to
GenAI's adaptability, responsiveness, and simplicity (§2.2.1) while
routing around its nondeterminism/hallucination risk by keeping a human
in the loop before anything is final. **A, C, and D** all require
guaranteed-correct, fully reproducible, high-stakes output — exactly the
profile §2.2.3's decision tree flags as a poor fit for GenAI used alone
without mandatory verification.
</details>

**Q12.** What is the primary function of Amazon Bedrock Knowledge Bases
within a GenAI application?
A) Enforcing content-safety filtering on model output
B) Enabling retrieval-augmented generation (RAG) by grounding model
   responses in your own data
C) Providing a no-code prototyping playground
D) Managing token-based billing

<details><summary>Answer & explanation</summary>

**Correct: B.** Knowledge Bases are Bedrock's RAG building block —
grounding responses in retrieved organizational data (§2.3.2). **A**
describes Guardrails, a separate Bedrock capability. **C** describes
PartyRock, a different product. **D** describes Bedrock's pricing
infrastructure, not a Knowledge Base's function.
</details>

**Q13.** A startup needs deep control over model training and hosting
infrastructure, including access to open-source models not available
through Bedrock's managed API. Which service is the BEST fit?
A) PartyRock
B) Amazon Q Business
C) Amazon SageMaker JumpStart
D) Amazon Bedrock Guardrails

<details><summary>Answer & explanation</summary>

**Correct: C.** SageMaker JumpStart provides a hub of pre-trained models
(including open-source options) deployable within SageMaker AI, giving
more infrastructure control than Bedrock's managed API (§2.3.1). **A
(PartyRock)** is a no-code playground, not an infrastructure-control
platform. **B (Amazon Q Business)** is a turnkey enterprise assistant,
not a model-hosting platform. **D (Bedrock Guardrails)** is a safety
feature within Bedrock, unrelated to open-source model hosting.
</details>

**Q14.** Which statement correctly describes the relationship between
tokens and Bedrock on-demand pricing?
A) Pricing is based on the number of API calls only, regardless of
   content length
B) Pricing is based on the number of input and output tokens processed
C) Pricing is a flat monthly fee unrelated to usage
D) Pricing only counts output tokens, not input tokens

<details><summary>Answer & explanation</summary>

**Correct: B.** On-demand pricing charges per input plus output token
(§2.3.3) — prompt length and response verbosity both directly affect
cost. **A** is wrong — call count alone isn't the pricing basis; content
length matters. **C** describes provisioned throughput's flat-rate
structure, not on-demand pricing. **D** is wrong — input tokens are
billed too, not just output.
</details>

**Q15.** A company needs its GenAI application to generate content
while automatically filtering out toxic language and blocking requests
for restricted topics. Which Bedrock capability addresses this
DIRECTLY?
A) Knowledge Bases
B) Agents
C) Guardrails
D) SageMaker JumpStart

<details><summary>Answer & explanation</summary>

**Correct: C.** Guardrails is Bedrock's safety/content-filtering
capability, purpose-built for exactly this (§2.3.2). **A (Knowledge
Bases)** grounds responses in retrieved data (RAG), not safety
filtering. **B (Agents)** enables multi-step autonomous tool use, a
different capability entirely. **D (SageMaker JumpStart)** is a
pre-trained model hub, unrelated to content safety filtering.
</details>

---

*Next: Day 4 begins Domain 3 (Applications of Foundation Models, 28% —
the largest domain) —
`01-domains/DOMAIN-3-applications-of-foundation-models.md`. See
`00-START-HERE/STUDY-PLAN.md`.*
