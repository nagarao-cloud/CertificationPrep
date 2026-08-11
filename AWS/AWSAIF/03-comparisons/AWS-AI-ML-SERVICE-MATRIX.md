# AWS AI/ML Service Comparison Matrix

Cross-domain head-to-head comparisons. Each domain file introduced these
services individually as they came up; this file puts them side by side
so a "which service fits this scenario" question can be answered by
scanning one table instead of five separate files.

> Service rosters (which foundation models are on Bedrock, exact
> pricing) change faster than this file. What's stable and exam-tested
> is the *selection criteria* — that's what these tables are built
> around. Verify current model/service availability against AWS docs
> before treating any specific model name here as exam-current.

---

## 1. Build platform comparison: Bedrock vs. SageMaker AI vs. SageMaker JumpStart vs. PartyRock

| | Amazon Bedrock | Amazon SageMaker AI | SageMaker JumpStart | PartyRock |
|---|---|---|---|---|
| **What it is** | Managed API access to multiple FM providers + app-building tools | Full custom ML build/train/deploy platform | Pre-trained model hub deployable within SageMaker AI | No-code GenAI prototyping playground |
| **Infrastructure management** | None — fully managed | You manage training/hosting infrastructure choices | Managed hosting within SageMaker AI | None |
| **Model choice** | Curated FMs from multiple providers via one API | Any architecture you build/train, or a JumpStart model | Pre-trained open-source + proprietary models | Whatever Bedrock exposes through the no-code UI |
| **Customization depth** | Prompting, RAG (Knowledge Bases), fine-tuning within Bedrock's tooling | Full control — custom architectures, custom training loops | Fine-tune/deploy a JumpStart model with more infra control than Bedrock | None — prototyping only |
| **Best fit** | Most GenAI applications — fastest path to production | Deep custom ML, or a model/workflow Bedrock doesn't support | Need SageMaker-level infra control but starting from a pre-trained model | Rapid prompt/concept validation before committing engineering effort |
| **Not production-ready for** | — | — | — | Production deployment (it's a playground, not a deployment target) |

**Decision rule:** default to **Bedrock** unless the scenario states a
reason to need more infrastructure control (**SageMaker JumpStart**) or
a fully custom model (**SageMaker AI** from scratch). **PartyRock** only
ever appears as the answer to "quickly prototype/validate an idea before
building."

---

## 2. AWS managed AI services — full matrix

| Service | Category | Input | Output | Customizable? | Typical use case | When NOT to use it |
|---|---|---|---|---|---|---|
| **Amazon Rekognition** | Computer vision | Image/video | Labels, faces, moderation flags | Limited (custom labels feature) | Content moderation, object detection | Need free-text description of an image → use a multi-modal FM instead |
| **Amazon Textract** | CV + NLP | Scanned documents | Structured text/forms/tables | No | Automated document data extraction | Free-form document Q&A → pair with RAG instead |
| **Amazon Transcribe** | Speech recognition | Audio | Text transcript | Limited (custom vocabulary) | Speech-to-text, call transcription | Need conversational understanding of the transcript → follow with Comprehend or an LLM |
| **Amazon Polly** | Speech synthesis | Text | Audio | Limited (custom lexicons, voices) | Text-to-speech | Real-time conversational voice agent alone → pair with Lex/GenAI |
| **Amazon Translate** | NLP | Text | Translated text | Limited (custom terminology) | Real-time language translation | Nuanced creative translation requiring tone control → consider an LLM |
| **Amazon Comprehend** | NLP | Text | Sentiment, entities, PII, key phrases | Limited (custom classification/entities) | Sentiment analysis, PII detection | Open-ended text generation → not a generative service |
| **Amazon Lex** | NLP (conversational) | Voice/text | Structured conversational responses/intents | Yes (intents/slots) | Rules-based chatbot/IVR | Complex open-domain conversation → consider a GenAI-based assistant |
| **Amazon Personalize** | Recommendation | User/item interaction data | Personalized recommendations | Yes (recipes) | Product/content recommendations | Cold-start with little interaction data → needs a data volume baseline |
| **Amazon Fraud Detector** | Fraud/anomaly detection | Transaction data | Risk score | Yes (custom models) | Real-time transaction risk scoring | General-purpose anomaly detection outside fraud → consider SageMaker AI custom model |
| **Amazon Kendra** | NLP (search) | Documents + natural-language query | Ranked, relevant answers | Yes (relevance tuning) | Enterprise semantic search | Generating new content, not just retrieving existing → pair with a GenAI layer |
| **Amazon Q Business** | GenAI assistant | Natural language + enterprise data | Conversational answers grounded in your data | Configuration, not model training | Turnkey enterprise knowledge assistant | Need full control over the underlying model/prompting → build custom on Bedrock |
| **Amazon Q Developer** | GenAI assistant | Code/IDE context | Code suggestions, explanations | Configuration | Developer coding assistant | Non-code business use cases → Q Business instead |

**Decision rule, repeated from Domain 1 §1.2.3:** if a purpose-built
managed service on this list covers the use case, prefer it over
building custom on SageMaker AI — lower cost, faster time-to-value, no
ML expertise required. Only go custom when the use case is specific
enough that nothing here fits.

---

## 3. Vector database options for RAG

| Service | Data model it extends | Best fit when |
|---|---|---|
| **Amazon OpenSearch Service** | Search-native | You need vector *and* full-text search at real scale, as the primary purpose of the store |
| **Amazon Aurora (pgvector)** | Relational | You already have relational data in Aurora and want vectors alongside it, avoiding a separate system |
| **Amazon RDS for PostgreSQL (pgvector)** | Relational | Same as Aurora, for teams standardized on RDS instead |
| **Amazon Neptune** | Graph | Relationships between entities matter as much as similarity (e.g., "similar AND connected to X") |
| **Amazon DocumentDB (MongoDB-compatible)** | Document | You already store data as documents and want vector search without migrating data models |

**Decision rule tested on the exam:** if the scenario doesn't mention an
existing data store to extend, **OpenSearch Service** is the
purpose-built default. If the scenario explicitly mentions an existing
relational/graph/document system, prefer extending *that* system's
matching option over introducing a new one.

---

## 4. Foundation model selection — criteria bands (not a specific model roster)

| If the scenario emphasizes... | Lean toward... |
|---|---|
| Lowest cost, simple task | Smaller/lighter-weight model |
| Complex, multi-step reasoning | Larger, more capable model |
| Real-time / low-latency requirement | Smaller/faster model, even at some capability cost |
| Multiple languages | A model with strong verified multi-lingual performance |
| Image/audio/video understanding or generation | A multi-modal or modality-specific model, not a text-only LLM |
| Very long documents/conversation history | A model with a large context window |
| Domain-specific accuracy the base model lacks | A model that supports fine-tuning, or plan for RAG/fine-tuning on top of it |
| Strict explainability/regulatory requirement | Reconsider whether an FM is even appropriate — classical ML may be the better answer (Domain 1 §1.1.2, Domain 4 §4.2.3) |

This directly operationalizes Domain 3 §3.1.1's model-selection
criteria table as a decision aid — memorize the *criteria*, not a
snapshot of which specific models are strongest today.

---

## 5. Prompt engineering vs. RAG vs. fine-tuning — full comparison

| | Prompt engineering | RAG | Fine-tuning |
|---|---|---|---|
| **Cost** | Lowest — no training, only inference tokens | Low-moderate — retrieval infra + inference | Highest — training compute + ongoing hosting of a custom model |
| **Speed to implement** | Fastest | Fast (once a knowledge base is set up) | Slowest |
| **Solves: format/output style issues** | Yes | No (doesn't fix a formatting problem by itself) | Overkill unless combined with a knowledge/behavior gap |
| **Solves: needs current/proprietary facts** | No (model can't know what it wasn't trained/given) | **Yes — this is RAG's core purpose** | Not efficiently — retraining for fact freshness is far more expensive than RAG |
| **Solves: needs a new skill/behavior/taxonomy** | Only partially, via examples (few-shot) | No | **Yes — this is fine-tuning's core purpose** |
| **Keeps up with changing data** | N/A | Easy — update the underlying documents | Hard — requires retraining |
| **Model weights change?** | No | No | Yes |

This is the fully expanded version of Domain 3 §3.3.4's decision tree —
use the tree for a quick answer during study, use this table when a
question requires distinguishing two of the three options on a specific
axis (e.g., "which one doesn't require changing model weights").

---

## 6. Governance and compliance services — consolidated matrix

| Service | Answers the question... |
|---|---|
| **AWS Config** | "What is my resource configuration right now, and has it drifted from compliant state?" |
| **AWS CloudTrail** | "Who called this API, and when?" |
| **AWS Audit Manager** | "Do I have evidence my controls satisfy framework X?" |
| **AWS Artifact** | "Where do I get AWS's own compliance certifications (ISO, SOC)?" |
| **Amazon Inspector** | "Does my workload have known vulnerabilities?" |
| **AWS Trusted Advisor** | "What general best practices (cost, security, performance, fault tolerance) am I missing?" |

Repeated from Domain 5 §5.2.1 in isolation here because service-name
confusion between these six is one of the highest-frequency error
patterns in this domain — drilling the one-line "answers the question"
framing tends to stick better than the longer definitions.

---

## 7. Explainability vs. capability — where common model types land

| Model type | Interpretability | Typical capability ceiling | Regulatory fit when full explainability is required |
|---|---|---|---|
| Linear/logistic regression | Highest | Lowest (for complex tasks) | Best fit |
| Decision trees / random forest | High | Moderate | Good fit |
| Classical ML ensembles (e.g., gradient boosting) | Moderate | Moderate-high | Workable with explainability tooling (e.g., SageMaker Clarify) |
| Deep learning (non-generative) | Low | High on structured/perception tasks | Needs explainability tooling; harder regulatory case |
| Foundation models / LLMs | Lowest | Highest on broad, unstructured tasks | Hardest regulatory case — pair with Model Cards, human review, and narrow scope |

Consolidates Domain 1 §1.1.2 and Domain 4 §4.2.3 into one spectrum —
useful for scenario questions that describe a regulatory constraint and
ask which *type* of model (not which specific AWS service) fits best.

---

*Next: Day 9 builds a full 65-question practice exam in `06-practice/`.
See `00-START-HERE/STUDY-PLAN.md`.*
