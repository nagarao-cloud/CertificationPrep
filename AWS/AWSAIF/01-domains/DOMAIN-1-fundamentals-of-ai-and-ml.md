# Domain 1: Fundamentals of AI and ML

**Weight: 20% of scored content** (roughly 10 of 50 scored questions)

> Source objectives verified against AWS's official AIF-C01 exam guide
> (Content Domain 1). If the guide has revised since, check
> `docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/aif-01-revisions.html`
> and this folder's `CLAUDE.md` §7 before trusting this file over the
> live guide.

This domain is the foundation the other four sit on. Get the vocabulary
and the ML lifecycle solid here — Domains 2 and 3 assume you already
have this cold and won't re-explain it.

```
Domain 1 = three task statements
┌─────────────────────────────────────────────────────────────────┐
│ 1.1  Explain basic AI concepts and terminologies                │
│ 1.2  Identify practical use cases for AI                        │
│ 1.3  Describe the AI/ML development lifecycle                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1.1 — Explain basic AI concepts and terminologies

### 1.1.1 The core glossary

Definitions the exam expects you to use *precisely* — scenario questions
often hinge on picking the one term that's technically correct, not just
"close enough."

| Term | Definition | Common trap |
|---|---|---|
| **Artificial Intelligence (AI)** | The broad field of building systems that perform tasks normally requiring human intelligence (reasoning, perception, language, decision-making). | Treating "AI" and "GenAI" as synonyms — AI is the umbrella; GenAI is one branch under it. |
| **Machine Learning (ML)** | A subset of AI where systems learn patterns from data rather than being explicitly programmed with rules. | Confusing ML with "any automated system" — a rules engine or `if/else` pipeline is *not* ML. |
| **Deep Learning (DL)** | A subset of ML using multi-layer (deep) neural networks to learn hierarchical feature representations directly from raw data. | Assuming all ML is deep learning — classical ML (linear regression, decision trees, XGBoost) is not DL. |
| **Neural network** | A model architecture of interconnected layers of nodes ("neurons"), each layer transforming its input via weighted connections and an activation function. | — |
| **Computer vision (CV)** | The subfield of AI concerned with extracting information from images/video (object detection, classification, segmentation, OCR). | — |
| **Natural Language Processing (NLP)** | The subfield of AI concerned with understanding and generating human language (sentiment analysis, entity extraction, translation, summarization). | — |
| **Model** | The artifact produced by training — learned parameters that map inputs to outputs. | Confusing "model" (the artifact) with "algorithm" (the training procedure that produced it). |
| **Algorithm** | The procedure/method used to train a model (e.g., linear regression, random forest, gradient descent, transformer architecture). | — |
| **Training** | The process of fitting a model's parameters to a dataset by iteratively minimizing a loss function. | — |
| **Inference** | Using a *trained* model to make a prediction on new, unseen data. | Exam scenario giveaway: "the application generates a response to a user's request" → that's inference, not training. |
| **Bias** (ML sense) | Systematic error in a model's predictions caused by unrepresentative training data, flawed labeling, or flawed problem framing — *not* the same as the bias/variance tradeoff term, though both use the word "bias." | The exam tests both senses; read the sentence for which one applies. |
| **Fairness** | The property that a model's outcomes don't systematically disadvantage a protected group or class. | — |
| **Fit** (overfitting / underfitting) | **Overfitting**: model memorizes training data, performs poorly on new data (low bias, high variance). **Underfitting**: model is too simple to capture the pattern, performs poorly on *both* training and new data (high bias, low variance). | Scenario clue for overfitting: "high accuracy on training data, low accuracy on test/validation data." Clue for underfitting: "low accuracy on both." |
| **Large Language Model (LLM)** | A foundation model trained on massive text corpora, built on the transformer architecture, capable of understanding and generating human language at scale. | — |
| **Generative AI (GenAI)** | AI that *creates* new content (text, images, audio, code, video) rather than just classifying or predicting on existing data. | — |
| **Agentic AI** | GenAI-powered systems that can autonomously plan, choose and invoke tools/APIs, and take multi-step actions toward a goal with limited human intervention — distinct from a single-turn GenAI response. | Newest term on the exam guide (added in a 2025 revision). Trap: describing any chatbot as "agentic" — the defining trait is autonomous multi-step tool use/planning, not just conversational ability. |

### 1.1.2 AI vs. ML vs. DL vs. GenAI vs. Agentic AI

```
                         ┌────────────────────────────────────┐
                         │   Artificial Intelligence (AI)      │
                         │   "systems that act intelligently"  │
                         │  ┌────────────────────────────────┐│
                         │  │  Machine Learning (ML)          ││
                         │  │  "learns from data, not rules"  ││
                         │  │  ┌────────────────────────────┐ ││
                         │  │  │  Deep Learning (DL)        │ ││
                         │  │  │  "multi-layer neural nets" │ ││
                         │  │  │  ┌───────────────────────┐ │ ││
                         │  │  │  │  Generative AI (GenAI)│ │ ││
                         │  │  │  │  "creates new content"│ │ ││
                         │  │  │  │  ┌──────────────────┐ │ │ ││
                         │  │  │  │  │  Agentic AI      │ │ │ ││
                         │  │  │  │  │  "plans + acts    │ │ │ ││
                         │  │  │  │  │   autonomously"  │ │ │ ││
                         │  │  │  │  └──────────────────┘ │ │ ││
                         │  │  │  └───────────────────────┘ │ ││
                         │  │  └────────────────────────────┘ ││
                         │  └────────────────────────────────┘│
                         └────────────────────────────────────┘
```

| Layer | Needs labeled data? | Needs deep neural nets? | Produces new content? | Plans/acts autonomously? | Example |
|---|---|---|---|---|---|
| Classical ML | Usually yes (supervised) | No — can use trees, linear models, etc. | No | No | Credit-scoring logistic regression |
| Deep learning | Often, but self-supervised variants exist | Yes | Not necessarily | No | Rekognition-style CV classifier |
| GenAI | No — often trained via self-supervision at massive scale | Yes (transformer-based) | **Yes** | No (single-turn) | ChatGPT-style text response |
| Agentic AI | N/A (built on top of a GenAI model) | Yes (uses an LLM as its reasoning core) | Yes, as one step | **Yes** | An assistant that reads a ticket, queries an API, and files a follow-up action without being told each step |

**Tradeoff to internalize:** every layer down this diagram trades
*interpretability and cost predictability* for *capability and
flexibility*. A logistic regression model is cheap, fast, and you can
explain exactly why it made a decision. An agentic system built on an
LLM is far more capable and general-purpose, but harder to explain,
harder to bound in cost/latency, and harder to guarantee correctness —
this exact tradeoff is what Domain 1's objective 1.2.6 (traditional ML
vs. FM selection) and Domain 4 (responsible AI) both test.

### 1.1.3 Types of machine learning

| Type | How it learns | Needs labeled data? | Typical algorithms | Typical use cases |
|---|---|---|---|---|
| **Supervised learning** | Learns a mapping from labeled input→output pairs | Yes — every example has a known correct answer | Linear/logistic regression, decision trees, random forest, gradient boosting (XGBoost), SVM, neural networks | Classification (fraud/not-fraud), regression (price prediction) |
| **Unsupervised learning** | Finds structure/patterns in unlabeled data | No | K-means clustering, hierarchical clustering, PCA, anomaly detection | Customer segmentation, anomaly detection, dimensionality reduction |
| **Reinforcement learning (RL)** | An agent learns by taking actions in an environment and receiving rewards/penalties | No labels — reward signal instead | Q-learning, policy gradients, RLHF (used to align LLMs) | Game-playing agents, robotics, and — on the exam specifically — **RLHF (Reinforcement Learning from Human Feedback)** used to fine-tune foundation models for helpfulness/safety |
| **Self-supervised learning** | Generates its own labels from the structure of unlabeled data (e.g., "predict the next word") | No human labeling needed | Transformer pretraining (this is how LLMs are pretrained) | Foundation model pretraining — the mechanism behind every LLM on Bedrock |

**Exam trap:** RLHF gets asked about in both Domain 1 (as a type of RL)
and Domain 2 (as part of how foundation models are fine-tuned/aligned).
Know it as *"reinforcement learning where the reward signal comes from
human preference judgments,"* and you can answer it from either angle.

### 1.1.4 MLOps fundamentals

MLOps (ML Operations) applies DevOps discipline to the ML lifecycle. The
exam guide names these specific concepts — know what each solves:

| Concept | What it means | What breaks without it |
|---|---|---|
| **Experimentation** | Systematically tracking hypotheses, hyperparameters, datasets, and results across many training runs | You can't reproduce your best model or explain why it worked |
| **Repeatable processes** | Pipelines (not manual notebook steps) that reliably reproduce a build from raw data to deployed model | Every retrain becomes a bespoke, error-prone manual effort |
| **Scalable systems** | Infrastructure that handles growing data volume and inference traffic without redesign | Training that worked on a sample dataset fails or times out at production scale |
| **Managing technical debt** | Keeping feature pipelines, model versions, and dependencies from accumulating untracked complexity | Small model updates become high-risk because nobody can trace what depends on what |
| **Production readiness** | Testing a model for latency, throughput, failure modes, and rollback — not just offline accuracy | A model with great offline metrics fails under real traffic patterns or edge cases |
| **Model monitoring** | Continuously tracking live prediction quality, input distribution, and latency after deployment | Silent model/data drift degrades quality with no alert |
| **Model retraining** | A defined trigger (schedule, drift threshold, or new-data volume) and pipeline to refresh a model | Models go stale as the real world diverges from training-time data |

### 1.1.5 Model performance metrics vs. business metrics

The exam guide draws this exact distinction — a model can score well on
one and fail the other, and knowing which to reach for is itself tested.

**Model performance metrics** (how well the model does its statistical job):

| Metric | Problem type | Measures | Watch out for |
|---|---|---|---|
| **Accuracy** | Classification | % of predictions correct overall | Misleading on imbalanced classes (99% "not fraud" gets 99% accuracy by always predicting "not fraud") |
| **Precision** | Classification | Of predicted positives, % actually positive | Optimize when false positives are costly (e.g., flagging legitimate transactions as fraud) |
| **Recall** | Classification | Of actual positives, % correctly predicted | Optimize when false negatives are costly (e.g., missing an actual fraud case) |
| **F1 score** | Classification | Harmonic mean of precision and recall | Use when you need a single balance metric on imbalanced data |
| **AUC (Area Under the ROC Curve)** | Classification | Model's ability to rank positives above negatives across all thresholds | A single threshold-independent summary — good for comparing models |
| **RMSE / MAE** | Regression | Average magnitude of prediction error | RMSE penalizes large errors more heavily than MAE |

**Business metrics** (whether the model is worth deploying at all):

| Metric | Answers |
|---|---|
| **Cost per user** | Is the per-inference cost sustainable at this user volume? |
| **Development cost** | Did building this model cost less than the value it creates? |
| **Customer feedback** | Do real users find the output useful/trustworthy, independent of offline metrics? |
| **Return on investment (ROI)** | Does the business value generated exceed the total cost (dev + inference + maintenance)? |

**The trap the exam sets:** a scenario describes a model with excellent
accuracy/F1/AUC and then asks whether to deploy it — the correct answer
often hinges on a business metric the question buries in the prompt
(cost per inference too high, or customer feedback negative), not on the
statistical metric being emphasized. Never assume "best offline metric
wins" is the answer without checking for a stated business constraint.

---

## 1.2 — Identify practical use cases for AI

### 1.2.1 Use case categories

| Category | What it solves | Example AWS-relevant scenario |
|---|---|---|
| **Forecasting** | Predicting future numeric values from historical time-series data | Demand forecasting for inventory planning |
| **Recommendation** | Suggesting items/content a user is likely to want | Product recommendations on a retail site |
| **Anomaly detection** | Flagging data points that deviate from a learned normal pattern | Detecting unusual spend patterns for fraud |
| **Computer vision** | Extracting information from images/video | Automating document/ID verification via image analysis |
| **NLP** | Understanding or generating text | Summarizing customer support tickets |
| **Fraud detection** | A specialized blend of anomaly detection + classification | Real-time transaction risk scoring |
| **Speech recognition / synthesis** | Converting speech↔text | Voice-driven customer service IVR |

### 1.2.2 When AI/ML is *not* the right tool

The exam tests restraint as much as capability — a scenario question
often has "use ML" as the tempting-but-wrong answer.

```
                    Is the logic simple, fixed, and
                    fully known in advance?
                              │
                 ┌────────────┴────────────┐
                YES                         NO
                 │                           │
                 v                           v
        Use a deterministic         Does the problem require
        rule/if-else system,        learning a pattern from
        NOT ML.                     data that changes over time
        (cheaper, fully             or is too complex to hand-
        explainable, no             code as rules?
        training data needed)                │
                                  ┌────────────┴────────────┐
                                 YES                         NO
                                  │                           │
                                  v                           v
                          ML/GenAI is likely           Reconsider — you may
                          appropriate. Check:          be over-engineering
                          - Is there enough            a simple problem.
                            representative data?
                          - Is 100% explainability
                            a hard regulatory
                            requirement? (if yes,
                            classical ML > deep
                            learning > FM, in that
                            order of preference)
                          - Does the cost of errors
                            justify probabilistic
                            (not guaranteed-correct)
                            output?
```

**Also do not use ML/GenAI when:**
- The problem needs a **guaranteed, auditable, identical** answer every
  time (e.g., tax calculation) — models are probabilistic, rules aren't.
- There isn't enough representative training data and none can be
  reasonably obtained.
- The cost of an occasional wrong answer is unacceptable and there's no
  practical way to add a human-in-the-loop check.

### 1.2.3 AWS AI/ML managed services — high-level map

Foundational-level knowledge only: know *what problem each service
solves* and *which use-case category it maps to*, not deep API/SDK
detail (that depth belongs to a hands-on associate-level exam, not this
one).

| AWS service | Use-case category | What it does |
|---|---|---|
| **Amazon Rekognition** | Computer vision | Image/video analysis — object detection, facial analysis, content moderation |
| **Amazon Textract** | Computer vision + NLP | Extracts text and structured data (forms, tables) from scanned documents |
| **Amazon Transcribe** | Speech recognition | Speech-to-text |
| **Amazon Polly** | Speech synthesis | Text-to-speech |
| **Amazon Translate** | NLP | Real-time language translation |
| **Amazon Comprehend** | NLP | Sentiment analysis, entity/key-phrase extraction, PII detection in text |
| **Amazon Lex** | NLP | Conversational chatbot interfaces (voice + text) |
| **Amazon Personalize** | Recommendation | Real-time personalized recommendations |
| **Amazon Forecast** *(legacy — check current availability)* | Forecasting | Time-series demand forecasting |
| **Amazon Fraud Detector** | Fraud detection / anomaly detection | Managed fraud-risk scoring |
| **Amazon Kendra** | NLP (search) | Intelligent enterprise search |
| **Amazon Q** | GenAI (Domain 2/3 territory) | GenAI-powered assistant for business/developer use cases |
| **Amazon SageMaker AI** | All categories (build-your-own) | Full custom ML build/train/deploy platform — the option when a managed AI service doesn't fit the use case |

**Decision rule tested on the exam:** if a purpose-built managed service
(Rekognition, Comprehend, etc.) covers the use case, prefer it over
building a custom model in SageMaker AI — lower cost, no ML expertise
required, faster time-to-value. Reach for SageMaker AI when the use case
is domain-specific enough that no managed service fits, or when you need
full control over the model architecture/training data.

---

## 1.3 — Describe the AI/ML development lifecycle

### 1.3.1 The lifecycle, end to end

```
 ┌────────────────┐    ┌────────────────┐    ┌──────────────────┐
 │ 1. Business     │    │ 2. Data         │    │ 3. Data          │
 │    problem      │───►│    collection   │───►│    preparation & │
 │    framing      │    │                 │    │    feature       │
 │                 │    │                 │    │    engineering   │
 └────────────────┘    └────────────────┘    └──────────────────┘
                                                          │
                                                          v
 ┌────────────────┐    ┌────────────────┐    ┌──────────────────┐
 │ 6. Monitoring & │◄───│ 5. Deployment   │◄───│ 4. Model         │
 │    retraining   │    │                 │    │    training &    │
 │  (loop back to  │    │                 │    │    evaluation    │
 │   step 2/3 or   │    │                 │    │                  │
 │   even step 1)  │    │                 │    │                  │
 └────────────────┘    └────────────────┘    └──────────────────┘
```

This is a **loop, not a line** — monitoring findings (drift, degraded
accuracy, new business requirements) feed back into earlier stages. The
exam rewards recognizing *which* stage a described symptom points back
to, not just naming the six stages in order.

### 1.3.2 Stage-by-stage: what happens, pitfalls, and the SageMaker AI component involved

| Stage | What happens | Common pitfall | Relevant Amazon SageMaker AI component |
|---|---|---|---|
| **1. Business problem framing** | Translate a business goal into a measurable ML problem statement (what's the target variable? what does "success" mean numerically?) | Framing a problem ML can't actually solve, or picking a target metric that doesn't match the real business goal | — (this stage is upstream of tooling) |
| **2. Data collection** | Gather raw data from source systems, ensure it's representative of production conditions | Data that doesn't reflect the population the model will actually see in production (sampling bias) | Data sourced via S3, Glue, etc. (outside SageMaker AI proper) |
| **3. Data preparation & feature engineering** | Clean, transform, and engineer features; handle missing values, outliers, encoding | Leaking information from the future/target into features ("data leakage") — inflates offline metrics, fails in production | **SageMaker Data Wrangler**, **SageMaker Feature Store** |
| **4. Model training & evaluation** | Fit the model, tune hyperparameters, evaluate against a held-out test set | Evaluating only on data too similar to training data — doesn't reveal real generalization | **SageMaker Training**, **SageMaker Autopilot** (AutoML), **SageMaker Clarify** (bias/explainability checks) |
| **5. Deployment** | Package and serve the model for inference (real-time endpoint, batch, or serverless) | Deploying without a rollback plan or without testing production-scale latency/throughput | **SageMaker Endpoints**, **SageMaker Pipelines** |
| **6. Monitoring & retraining** | Track live prediction quality and input data distribution; trigger retraining when drift is detected | No monitoring at all — degraded predictions go unnoticed until a business metric suffers | **SageMaker Model Monitor** |

### 1.3.3 Drift: the concept tied to this stage most often tested

| Type of drift | What changed | Example |
|---|---|---|
| **Data drift** | The statistical distribution of *input* features has shifted from training time | A model trained on pre-pandemic purchasing data sees post-pandemic input patterns |
| **Concept drift** | The relationship between inputs and the correct output has changed, even if input distribution looks the same | A fraud pattern evolves — the same transaction features now correlate differently with actual fraud |

Both are detected via **model monitoring** (stage 6) and resolved by
**retraining** — the exam expects you to connect "predictions are
getting worse over time in production" to this pairing, not to a data
quality bug at collection time.

---

## Exam traps specific to Domain 1

1. **"AI" used as a synonym for "GenAI" in the question stem.** Read
   carefully — a question about AI broadly may include classical ML
   answers; a question specifically about GenAI should not.
2. **High accuracy ≠ deploy-ready.** If the scenario mentions imbalanced
   classes or a stated business cost/ROI constraint, that overrides a
   headline accuracy number.
3. **Overfitting vs. underfitting mixed up.** Memorize the tell: high
   train / low test performance = overfitting; low on *both* =
   underfitting.
4. **RLHF appearing in a Domain 2 question about foundation models.**
   It's still fundamentally the Domain 1 reinforcement-learning concept
   — the reward signal is just human preference data instead of a game
   score.
5. **Assuming SageMaker AI is required for every ML use case.** If a
   purpose-built managed service (Rekognition, Comprehend, Personalize,
   etc.) fits, that's very often the intended "best" answer over
   building custom in SageMaker AI.

## Mnemonics

- **"Frame, Feed, Fit, Field, Follow"** — the six lifecycle stages
  compressed to five action words: **Frame** the problem, **Feed** in
  data (collection + prep), **Fit** the model (train + evaluate),
  **Field** it (deploy), **Follow** up (monitor + retrain).
- **AI ⊃ ML ⊃ DL ⊃ GenAI ⊃ Agentic AI** — each is a strict subset of the
  one before it; if a question implies otherwise (e.g., "some ML is not
  AI"), the question is testing whether you'll fall for it.

---

## Practice questions — Domain 1

*15 questions, every option explained. Mixed difficulty, mapped to task
statements above.*

**Q1.** A company wants to automatically calculate sales tax on
transactions, where the tax rate is a fixed lookup by jurisdiction and
must be identical and auditable every time. What is the MOST appropriate
approach?
A) Train a regression model to predict the tax amount
B) Use a large language model to compute the tax
C) Use a deterministic rules-based system, not ML
D) Use unsupervised clustering to group similar transactions

<details><summary>Answer & explanation</summary>

**Correct: C.** Tax calculation is a fixed, fully-known, auditable
computation — exactly the case from §1.2.2 where ML should NOT be used.
**A** is wrong: a regression model would introduce probabilistic error
into a calculation that must be exact and identical every time. **B** is
wrong for the same reason, and LLMs are especially unsuited to precise
deterministic arithmetic. **D** is wrong: clustering finds groupings, it
doesn't compute values, and it's unsupervised (no notion of a "correct"
tax amount).
</details>

**Q2.** Which term describes using an already-trained model to generate
a prediction on a new customer support ticket?
A) Training
B) Inference
C) Fitting
D) Experimentation

<details><summary>Answer & explanation</summary>

**Correct: B.** Inference is applying a trained model to new, unseen
data. **A (Training)** is the process of fitting model parameters on a
training dataset — it happens before this. **C (Fitting)** describes
model fit quality (over/underfitting), not the act of prediction. **D
(Experimentation)** is an MLOps concept about tracking training runs,
unrelated to serving predictions.
</details>

**Q3.** A model achieves 98% accuracy on a fraud-detection dataset where
only 1% of transactions are actually fraudulent. What is the MOST likely
explanation and the BEST metric to check next?
A) The model is excellent; deploy immediately based on accuracy
B) The model may simply be predicting "not fraud" every time; check
   precision and recall instead
C) The model is overfitting; retrain with fewer features
D) The dataset needs more forecasting data

<details><summary>Answer & explanation</summary>

**Correct: B.** With a 99%/1% class imbalance, always predicting the
majority class yields ~99% accuracy while catching zero fraud — accuracy
is misleading here (§1.1.5). Precision and recall (or F1) reveal whether
the model is actually catching fraud cases. **A** ignores the class
imbalance trap. **C** is a guess unsupported by the evidence given (no
train/test gap was described). **D** confuses this classification
problem with forecasting, an unrelated use case.
</details>

**Q4.** Which best describes the relationship between deep learning and
generative AI?
A) They are unrelated fields
B) Generative AI is a subset of deep learning, which is a subset of ML
C) Deep learning is a subset of generative AI
D) They are the same thing

<details><summary>Answer & explanation</summary>

**Correct: B.** Per the AI ⊃ ML ⊃ DL ⊃ GenAI ⊃ Agentic AI hierarchy
(§1.1.2), generative AI models (built on transformer architectures) are
themselves deep learning models — GenAI is nested inside DL. **A** and
**D** both contradict the well-established containment relationship.
**C** inverts the actual relationship.
</details>

**Q5.** A retail company wants a system that reads scanned paper
invoices and extracts vendor name, line items, and total amount into
structured fields. Which AWS service is the BEST fit?
A) Amazon Translate
B) Amazon Textract
C) Amazon Forecast
D) Amazon Personalize

<details><summary>Answer & explanation</summary>

**Correct: B.** Textract is purpose-built to extract text and structured
data (forms, tables) from scanned documents (§1.2.3). **A (Translate)**
handles language translation, not document extraction. **C (Forecast)**
solves time-series forecasting, unrelated to document processing. **D
(Personalize)** builds recommendation systems, also unrelated.
</details>

**Q6.** A model performs very well on its training data but poorly on
new, unseen data. This is an example of:
A) Underfitting
B) Overfitting
C) Data drift
D) Concept drift

<details><summary>Answer & explanation</summary>

**Correct: B.** High train performance + poor generalization to new
data is the textbook signature of overfitting (§1.1.1) — the model
memorized training data rather than learning a generalizable pattern.
**A (Underfitting)** would show poor performance on *both* training and
new data. **C** and **D (drift)** describe a model's performance
*degrading over time in production* after initially generalizing well —
not a training-time train/test gap.
</details>

**Q7.** Which of the following is an example of unsupervised learning?
A) Predicting house prices from labeled sale-price data
B) Classifying emails as spam or not spam using labeled examples
C) Segmenting customers into groups based on purchasing behavior, with
   no predefined group labels
D) Training a chatbot using human feedback on response quality

<details><summary>Answer & explanation</summary>

**Correct: C.** Customer segmentation with no predefined labels is
clustering — the defining unsupervised-learning task (§1.1.3). **A** and
**B** are supervised learning — both use labeled ground truth
(price, spam/not-spam). **D** describes RLHF, a reinforcement learning
technique, not unsupervised learning.
</details>

**Q8.** In the AI/ML development lifecycle, a data scientist notices
that a feature used in training includes information that would not be
available at prediction time in production. This is an example of:
A) Concept drift
B) Data leakage
C) Underfitting
D) A business metric failure

<details><summary>Answer & explanation</summary>

**Correct: B.** Data leakage (§1.3.2) is exactly this: a feature that
"sees the future" or otherwise wouldn't be available at real inference
time, which inflates offline evaluation metrics in a way that won't hold
in production. **A (Concept drift)** is a post-deployment phenomenon
where input/output relationships change over time, not a training-time
feature design flaw. **C (Underfitting)** describes a model too simple
to fit the data — unrelated. **D** is a business-metric concept, not a
data-engineering flaw.
</details>

**Q9.** Which statement correctly distinguishes model performance
metrics from business metrics?
A) They measure the same thing using different units
B) Model performance metrics assess statistical prediction quality;
   business metrics assess whether the model creates enough value to
   justify its cost
C) Business metrics are only used before training; model metrics are
   only used after training
D) Model performance metrics are always more important than business
   metrics

<details><summary>Answer & explanation</summary>

**Correct: B.** This is the core distinction from §1.1.5 — a model can
have excellent accuracy/F1/AUC (model performance) while still failing
on cost per user or ROI (business metrics), or vice versa; both must be
evaluated together. **A** is wrong — they measure fundamentally
different things (statistical correctness vs. business value). **C**
reverses no such timing rule exists in the guide. **D** is a trap: the
exam consistently tests scenarios where a business constraint overrides
a strong statistical metric.
</details>

**Q10.** A company is deciding between building a custom fraud-detection
model in Amazon SageMaker AI versus using Amazon Fraud Detector. Which
factor would MOST justify choosing the custom SageMaker AI approach?
A) The company wants the fastest possible time-to-value with minimal ML
   expertise
B) The company's fraud patterns are highly domain-specific and not well
   served by a general-purpose managed fraud model
C) The company has no historical transaction data
D) The company wants to avoid any model training or tuning

<details><summary>Answer & explanation</summary>

**Correct: B.** Per §1.2.3's decision rule, reach for SageMaker AI when
the use case is specific enough that no managed service fits well.
**A** and **D** both describe exactly the scenario where the *managed*
service (Fraud Detector) is preferred, not the custom-build option — the
opposite of what the question asks. **C** is actually a reason NOT to
build custom — without data, neither approach is currently viable, but a
managed service requiring less data engineering is still the lower-risk
starting point.
</details>

**Q11.** What is the PRIMARY purpose of model monitoring after
deployment?
A) To retrain the model on a fixed weekly schedule regardless of
   performance
B) To detect data drift or concept drift so degraded predictions can be
   caught before they harm the business
C) To measure the initial training accuracy
D) To replace the need for an evaluation stage before deployment

<details><summary>Answer & explanation</summary>

**Correct: B.** Monitoring exists to catch drift in production
(§1.3.3), triggering retraining based on evidence, not a blind schedule.
**A** describes a possible retraining *trigger* but isn't the purpose of
monitoring itself, and a fixed schedule regardless of actual drift
isn't the best practice tested here. **C** describes the training/
evaluation stage (stage 4), which happens before deployment. **D** is
false — monitoring is a separate, later-stage safeguard, not a
substitute for pre-deployment evaluation.
</details>

**Q12.** Which best describes Reinforcement Learning from Human Feedback
(RLHF)?
A) Supervised learning using only human-labeled classification data
B) Unsupervised clustering of human preferences
C) Reinforcement learning where the reward signal is derived from human
   preference judgments, commonly used to align foundation models
D) A method for reducing the size of a neural network

<details><summary>Answer & explanation</summary>

**Correct: C.** RLHF (§1.1.3) is reinforcement learning with a
human-preference-derived reward signal — the mechanism used to fine-tune
foundation models toward helpful, safe outputs. **A** misclassifies it
as supervised learning; RLHF uses a reward signal, not direct labels in
the classical supervised sense. **B** confuses it with unsupervised
clustering, an unrelated technique. **D** describes model compression
(e.g., distillation/pruning), a different concept entirely.
</details>

**Q13.** A company's model has 95% accuracy but customer feedback shows
users find its recommendations unhelpful, and the cost per inference
exceeds the revenue it generates per recommendation. What should the
company do?
A) Deploy immediately since accuracy is high
B) Ignore business metrics since model metrics are the standard for
   ML evaluation
C) Reassess deployment — the business metrics (customer feedback, cost
   per user/ROI) indicate the model isn't creating net value despite
   good statistical performance
D) Switch to an unsupervised learning approach

<details><summary>Answer & explanation</summary>

**Correct: C.** This is a direct application of §1.1.5 — statistical
accuracy alone doesn't justify deployment when business metrics
(feedback, cost/ROI) indicate the model isn't worth its cost. **A**
ignores the stated business signals. **B** inverts the guide's explicit
point that both metric types matter together. **D** is a non sequitur —
switching learning paradigms doesn't address a cost/value problem.
</details>

**Q14.** Which pair correctly matches an AI use case to the MOST
appropriate category?
A) Detecting unusual login patterns → forecasting
B) Predicting next quarter's product demand → anomaly detection
C) Suggesting related products to a shopper → recommendation
D) Extracting sentiment from customer reviews → computer vision

<details><summary>Answer & explanation</summary>

**Correct: C.** Suggesting related products is the textbook
recommendation use case (§1.2.1). **A** is backwards — unusual login
patterns is anomaly detection, not forecasting. **B** is also backwards
— demand prediction is forecasting, not anomaly detection. **D** is
wrong — sentiment extraction from text is NLP, not computer vision
(which handles images/video).
</details>

**Q15.** An agentic AI system, given a customer's refund request, checks
order history via an API, verifies refund eligibility against policy,
and issues the refund — all without a human approving each step. What
distinguishes this from a standard generative AI chatbot?
A) It uses a larger language model
B) It autonomously plans and takes multi-step actions using tools/APIs
   toward a goal, rather than producing a single conversational response
C) It does not use any deep learning
D) It only performs classification, not generation

<details><summary>Answer & explanation</summary>

**Correct: B.** This is the defining trait of agentic AI from §1.1.1/
§1.1.2 — autonomous planning and multi-step tool use, not just single-
turn content generation. **A** is irrelevant — model size doesn't define
"agentic." **C** is false — agentic systems are built on top of
GenAI/deep learning models, not without them. **D** is false — the
system is still generating actions/responses, just orchestrating them
autonomously across multiple steps.
</details>

---

*Next: Day 2 covers Domain 2 (Fundamentals of Generative AI, 24%) —
`01-domains/DOMAIN-2-fundamentals-of-generative-ai.md`. See
`00-START-HERE/STUDY-PLAN.md`.*
