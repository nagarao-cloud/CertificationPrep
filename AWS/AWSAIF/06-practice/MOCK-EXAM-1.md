# Mock Exam 1 — 65 Questions

Simulates the real AIF-C01 format: **65 questions, 90 minutes, 700/1000
to pass.** Question count per section below is proportional to that
domain's real exam weight, so your section-by-section score doubles as
a weak-area diagnostic — see `MOCK-EXAM-1-ANSWER-KEY.md` after you
finish.

**Instructions:** Take this closed-book, timed to 90 minutes. Do not
check the answer key until you've answered all 65. Questions marked
**[Select TWO]** are multiple-response — the real exam includes this
format alongside standard single-answer multiple choice, plus ordering/
matching/case-study items (this set focuses on multiple-choice/
multiple-response, the two most common formats, for a tool you can
self-grade against a key).

Sections are grouped by domain here (unlike the real shuffled exam) so
you can score each section separately afterward and immediately see
which domain needs more review — do not read the section headers as a
hint while answering if you want a realistic single blended run; cover
them if needed.

---

## Section 1 — Domain 1: Fundamentals of AI and ML (13 questions)

**1.** A company wants a system that groups its customers into segments
based on purchasing behavior, without any predefined group labels. Which
type of machine learning is this?
A) Supervised learning
B) Unsupervised learning
C) Reinforcement learning
D) Self-supervised learning

**2.** Which term describes the process of fitting a model's parameters
to a dataset by minimizing a loss function?
A) Inference
B) Training
C) Deployment
D) Monitoring

**3.** A model shows 60% accuracy on both its training data and its test
data. This is MOST consistent with:
A) Overfitting
B) Underfitting
C) Data drift
D) Concept drift

**4.** Which AWS service would BEST fit a use case requiring real-time
detection of unusual patterns in financial transactions?
A) Amazon Personalize
B) Amazon Fraud Detector
C) Amazon Polly
D) Amazon Forecast

**5.** What best distinguishes deep learning from classical machine
learning?
A) Deep learning never requires labeled data
B) Deep learning uses multi-layer neural networks to learn hierarchical
   feature representations
C) Classical ML always outperforms deep learning
D) Deep learning cannot be used for computer vision

**6. [Select TWO]** Which of the following are examples of MLOps
concepts named in the exam guide?
A) Model retraining
B) Prompt injection
C) Experimentation
D) Chain-of-thought prompting
E) RAG

**7.** A model's live prediction quality is degrading over time because
the statistical distribution of incoming input data no longer matches
the training data. This is an example of:
A) Concept drift
B) Data drift
C) Overfitting
D) Data leakage

**8.** Which business metric would be MOST relevant when deciding
whether to keep a deployed model in production despite strong accuracy?
A) F1 score
B) AUC
C) Return on investment (ROI)
D) RMSE

**9.** Which scenario is the BEST fit for a deterministic, rules-based
system rather than ML?
A) Predicting customer churn from behavioral data
B) Calculating a fixed shipping fee based on a published rate table
C) Detecting anomalies in network traffic
D) Recommending products to a shopper

**10.** What is Reinforcement Learning from Human Feedback (RLHF)
primarily used for in the context of foundation models?
A) Compressing model size
B) Aligning model outputs with human preferences using a
   preference-derived reward signal
C) Increasing the context window
D) Encrypting model weights

**11.** A company frames a business goal as "reduce customer support
response time" and must now define a measurable ML target. Which
lifecycle stage does this represent?
A) Data collection
B) Business problem framing
C) Model deployment
D) Model monitoring

**12.** Which pair correctly matches an AI/ML term to its definition?
A) Bias — the property that outcomes don't disadvantage a group
B) Fit — systematic error caused by unrepresentative training data
C) Inference — using a trained model to predict on new data
D) Algorithm — the artifact produced by training

**13.** An autonomous system reads a support ticket, queries an
inventory API, and issues a replacement order without human
intervention at each step. This is BEST described as:
A) A standard generative AI chatbot
B) Agentic AI
C) Unsupervised learning
D) A rules-based system

---

## Section 2 — Domain 2: Fundamentals of Generative AI (16 questions)

**14.** Which type of generative AI model is MOST commonly used to
generate an image from a text prompt by iteratively denoising random
noise?
A) Diffusion model
B) Classical regression model
C) Decision tree
D) Clustering model

**15.** As a typical Bedrock customer, which stage of the foundation
model lifecycle do you usually enter at?
A) Data selection
B) Pre-training
C) Model selection
D) Post-deployment data collection

**16. [Select TWO]** Which of the following are named advantages of
generative AI for business use, per the exam guide?
A) Adaptability
B) Nondeterminism
C) Responsiveness
D) Hallucination
E) Prompt leaking

**17.** A foundation model confidently generates a fabricated citation
that does not exist. This is an example of:
A) Interpretability
B) Hallucination
C) Nondeterminism
D) Adaptability

**18.** Which AWS service is a no-code playground for prototyping GenAI
prompt concepts before committing to a full build?
A) SageMaker JumpStart
B) PartyRock
C) Amazon Q Developer
D) AWS Config

**19.** What does "context window" refer to in the context of a
foundation model?
A) The time period a model was trained on
B) The maximum number of input plus output tokens the model can process
   in one call
C) The number of fine-tuning examples used
D) The geographic region a model is deployed in

**20.** A company has steady, predictable, high-volume GenAI traffic.
Which Bedrock pricing approach is generally MOST cost-effective?
A) On-demand token-based pricing
B) Provisioned throughput
C) A per-user flat fee unrelated to usage
D) Pay only for failed requests

**21.** Which best describes a multi-modal foundation model?
A) A model that can only generate text
B) A model that can process and/or generate across more than one data
   type, such as text and images
C) A model that requires no pretraining
D) A model limited to a single supported language

**22.** What is the PRIMARY function of Amazon Bedrock Knowledge Bases?
A) Filtering toxic content
B) Enabling retrieval-augmented generation by grounding responses in
   your own data
C) Reserving dedicated model capacity
D) Computing token-based billing

**23.** Which foundation model concept describes a numeric vector
representation of text that captures semantic meaning?
A) Token
B) Prompt
C) Embedding
D) Guardrail

**24.** A company needs deep infrastructure control and access to
open-source models not available via Bedrock's managed API. Which
service fits BEST?
A) PartyRock
B) Amazon Q Business
C) SageMaker JumpStart
D) Amazon Translate

**25.** Which of the following is a named LIMITATION of generative AI
per the exam guide?
A) Simplicity
B) Interpretability (as a challenge, due to the "black box" nature)
C) Adaptability
D) Responsiveness

**26.** What is the relationship between an LLM and a foundation model?
A) They are unrelated categories
B) Every LLM is a type of foundation model, but not every foundation
   model is an LLM
C) Every foundation model is an LLM
D) LLM is a synonym for diffusion model

**27.** A team observes that identical prompts sometimes produce
different outputs on different calls. Which characteristic explains
this?
A) Interpretability
B) Nondeterminism
C) Adaptability
D) Simplicity

**28.** Which AWS GenAI assistant is purpose-built for developer coding
support within an IDE?
A) Amazon Q Business
B) Amazon Q Developer
C) Amazon Lex
D) Amazon Kendra

**29.** What does the transformer architecture's self-attention
mechanism primarily enable?
A) Weighing the relevance of every other token when processing each
   token, improving handling of long-range context
B) Automatic encryption of model weights
C) Guaranteed deterministic output every time
D) Elimination of the need for a context window

---

## Section 3 — Domain 3: Applications of Foundation Models (18 questions)

**30.** Which inference parameter, when set LOW, produces more focused,
deterministic, repeatable output?
A) Max tokens
B) Temperature
C) Context window
D) Model size

**31.** A company wants a chatbot to answer questions grounded in its
constantly changing internal documentation. What is the BEST approach?
A) Fine-tune weekly
B) Use RAG with a knowledge base
C) Increase temperature
D) Switch to a diffusion model

**32.** Which AWS service is purpose-built for vector + full-text search
at scale?
A) Amazon Neptune
B) Amazon OpenSearch Service
C) Amazon Polly
D) AWS Config

**33.** What is prompt "goal hijacking"?
A) A fine-tuning method
B) A prompt-injection subtype that redirects an application's intended
   task via crafted input
C) An evaluation metric
D) A model-selection criterion

**34.** Which technique provides the model with several input/output
examples directly in the prompt to demonstrate a desired pattern?
A) Zero-shot prompting
B) Few-shot prompting
C) Negative prompting
D) Continuous pre-training

**35.** Which best distinguishes continuous pre-training from
fine-tuning?
A) Continuous pre-training uses unlabeled domain data to broaden
   knowledge; fine-tuning uses labeled data to shape specific behavior
B) They are identical processes
C) Fine-tuning always requires more data than continuous pre-training
D) Continuous pre-training is only performed by the customer, never the
   FM provider

**36. [Select TWO]** Which of the following are risks of prompt misuse
named in the exam guide?
A) Jailbreaking
B) RLHF
C) Poisoning
D) BERTScore
E) Model Cards

**37.** A model performs well on a task with clear instructions, but its
output format is inconsistent. What is the LOWEST-cost fix?
A) Fine-tune on thousands of examples
B) Add an explicit output indicator or prompt template
C) Perform continuous pre-training
D) Switch to a larger model

**38.** Which automated evaluation metric is recall-oriented and
commonly used for summarization quality?
A) BLEU
B) ROUGE
C) BERTScore
D) F1 score

**39.** Which metric measures semantic similarity via embeddings rather
than exact word overlap, tolerating valid paraphrasing?
A) ROUGE
B) BLEU
C) BERTScore
D) Accuracy

**40.** A team needs a model to handle both uploaded images and text,
generating a text description of image content. Which model-selection
criterion is MOST directly relevant?
A) Cost
B) Modality
C) Multi-lingual support
D) Model size

**41.** What data-preparation issue occurs when a feature used in
training would not actually be available at real inference time?
A) Data drift
B) Data leakage
C) Underfitting
D) Prompt injection

**42.** Which fine-tuning method adapts a model's behavior using
examples of instructions paired with desired responses, to improve
general instruction-following?
A) Instruction tuning
B) Continuous pre-training
C) RAG
D) Negative prompting

**43.** A scenario needs precise, exact-word-overlap-based scoring for
translation quality against professional reference translations. Which
metric fits BEST?
A) ROUGE
B) BLEU
C) BERTScore
D) AUC

**44.** Which is the MOST appropriate first technique to try when a base
foundation model already performs a task well but needs slightly better
output structure?
A) Fine-tuning
B) Prompt engineering
C) Continuous pre-training
D) Training a model from scratch

**45.** A vector database use case involves data with meaningful
relationships between entities alongside similarity search. Which AWS
service is the BEST fit?
A) Amazon Neptune
B) Amazon Polly
C) Amazon Rekognition
D) AWS Trusted Advisor

**46.** What is "jailbreaking" in the context of foundation models?
A) A fine-tuning technique
B) Crafting a prompt specifically to bypass a model's safety training/
   guardrails
C) An evaluation metric
D) A vector database operation

**47.** Which factor would MOST justify choosing to build a custom model
on SageMaker AI over using a managed AWS AI service?
A) Fastest possible time-to-value is the priority
B) The use case is highly domain-specific and not well served by any
   general-purpose managed service
C) The team wants to avoid any model training
D) The company has no available data

---

## Section 4 — Domain 4: Guidelines for Responsible AI (9 questions)

**48.** A hiring-screening model systematically ranks applicants from
one demographic group lower for reasons unrelated to qualifications.
Which responsible-AI feature is MOST directly violated?
A) Robustness
B) Fairness
C) Veracity
D) Environmental sustainability

**49.** Which AWS tool detects statistical bias in training data and
model predictions, and explains individual predictions using SHAP
values?
A) Amazon Bedrock Guardrails
B) Amazon SageMaker Clarify
C) AWS Config
D) Amazon Comprehend

**50.** Which legal risk specifically concerns generated content closely
resembling copyrighted training data?
A) End-user risk
B) Intellectual property (IP) infringement claims
C) Loss of customer trust
D) Model robustness

**51.** What is the PRIMARY purpose of an Amazon SageMaker Model Card?
A) Runtime content filtering
B) Structured documentation of a model's intended use, limitations,
   training data, and ethical considerations
C) Automated fine-tuning
D) Per-prediction SHAP value computation

**52.** Which best describes the interpretability-vs-performance
tradeoff?
A) More interpretable models always have higher accuracy
B) Simpler, interpretable models may have a lower capability ceiling on
   complex tasks than deep learning/foundation models
C) There is no relationship between the two
D) Foundation models are always the most interpretable option

**53. [Select TWO]** Which of the following are named dataset
characteristics supporting responsible AI, per the exam guide?
A) Balanced datasets
B) Model Cards
C) Provisioned throughput
D) Token-based pricing
E) Diversity

**54.** A regulator requires a lending company to explain, in specific
auditable terms, exactly why each application was approved or denied.
Which type of model should be PREFERRED, all else being reasonably
equal?
A) The largest available foundation model
B) A more interpretable model such as logistic regression, even at some
   accuracy cost
C) Whichever model has the lowest token cost
D) Whichever model requires the least fine-tuning

**55.** Which responsible-AI feature is about a system performing
reliably under a wide range of real-world and adversarial conditions?
A) Fairness
B) Robustness
C) Veracity
D) Inclusivity

**56.** A company ships a GenAI feature reviewed only by its engineering
team, with no input from legal, policy, or end users. What principle was
violated?
A) Environmental sustainability
B) Human-centered design
C) Token-based pricing optimization
D) RAG implementation

---

## Section 5 — Domain 5: Security, Compliance, and Governance for AI Solutions (9 questions)

**57.** Under the AWS shared responsibility model, who is responsible
for configuring least-privilege IAM policies for a Bedrock-based
application?
A) AWS exclusively
B) The customer
C) The foundation model provider
D) No one — it's automatic

**58.** Which AWS service provides private connectivity from a VPC to
Bedrock without traversing the public internet?
A) AWS CloudTrail
B) AWS PrivateLink
C) AWS Audit Manager
D) Amazon Inspector

**59.** Which threat involves corrupting training or fine-tuning data so
a model learns harmful or incorrect behavior?
A) Prompt injection
B) Data poisoning
C) Adversarial attack
D) Bias amplification

**60.** On the Generative AI Security Scoping Matrix, what happens to a
customer's security responsibility as they move from calling a
pretrained model via API (Scope 3) to fine-tuning it on their own data
(Scope 4)?
A) It decreases
B) It increases — they must now also secure fine-tuning data and the
   customized model artifact
C) It stays exactly the same
D) It becomes AWS's responsibility entirely

**61.** Which AWS service is the correct source for AWS's own ISO/SOC
compliance certifications?
A) AWS Audit Manager
B) AWS Artifact
C) AWS Config
D) AWS CloudTrail

**62.** Which AWS service provides a complete audit trail of API calls,
including who called what and when?
A) AWS CloudTrail
B) AWS Trusted Advisor
C) Amazon Inspector
D) AWS Config

**63. [Select TWO]** Which of the following are GenAI-specific threats
named in the exam guide?
A) Data leakage
B) Chain-of-thought prompting
C) Adversarial attacks
D) Model Cards
E) BERTScore

**64.** What is the PRIMARY purpose of data lineage in AI governance?
A) Encrypting data at rest
B) Tracking a dataset's origin and every transformation before it
   reached a model, supporting auditability
C) Filtering harmful model output
D) Reserving inference capacity

**65.** A company's AI governance program checks system behavior only
once at launch. What is missing, per data governance best practice?
A) A review cadence — ongoing, periodic re-evaluation
B) AWS PrivateLink configuration
C) A larger foundation model
D) A lower temperature setting

---

*Scoring: count correct per section, divide by section total, compare
against your overall percentage — a section scoring meaningfully below
your average is your weak-area signal. See
`MOCK-EXAM-1-ANSWER-KEY.md` for answers and full explanations.*
