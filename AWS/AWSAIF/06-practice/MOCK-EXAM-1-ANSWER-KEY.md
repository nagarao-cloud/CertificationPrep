# Mock Exam 1 — Answer Key & Explanations

Every option explained. Domain tag on each question supports the
weak-area review called for in `00-START-HERE/STUDY-PLAN.md` Day 9 —
tally correct/incorrect per domain tag, not just per section, since a
missed question's domain is the useful signal.

---

## Section 1 — Domain 1: Fundamentals of AI and ML

**1. Correct: B (Unsupervised learning).** Segmenting with no predefined
labels is clustering — the defining unsupervised task. **A** requires
labeled ground truth, absent here. **C** learns via reward signals, not
grouping. **D** generates its own labels from data structure (e.g.,
next-token prediction) — a different mechanism from clustering.

**2. Correct: B (Training).** Training is exactly this — fitting
parameters by minimizing a loss function. **A (Inference)** is applying
an already-trained model. **C (Deployment)** is serving the trained
model. **D (Monitoring)** is post-deployment quality tracking.

**3. Correct: B (Underfitting).** Poor performance on *both* train and
test data is underfitting's signature. **A (Overfitting)** would show
high train performance but low test performance — not both low. **C**
and **D (drift)** describe degradation *after* initially good
generalization in production, not a training-time symptom.

**4. Correct: B (Amazon Fraud Detector).** Purpose-built for real-time
transaction fraud/risk scoring. **A (Personalize)** builds
recommendations, unrelated. **C (Polly)** is text-to-speech, unrelated.
**D (Forecast)** solves time-series demand forecasting, a different use
case.

**5. Correct: B.** Deep learning's defining trait is multi-layer neural
networks learning hierarchical representations. **A** is false — many
DL approaches still need labels (supervised DL exists). **C** is an
unfounded absolute claim. **D** is false — computer vision is one of
DL's strongest use cases.

**6. Correct: A and C (Model retraining, Experimentation).** Both are
MLOps concepts named in the exam guide. **B (Prompt injection)** is a
Domain 3/5 security risk. **D (Chain-of-thought)** is a Domain 3
prompting technique. **E (RAG)** is a Domain 3 application technique —
none of B/D/E are MLOps concepts.

**7. Correct: B (Data drift).** Input distribution shifting from
training time is data drift by definition. **A (Concept drift)** is
when the input-output *relationship* changes, not just the input
distribution. **C (Overfitting)** is a training-time train/test gap, not
a live production symptom. **D (Data leakage)** is a training-data
design flaw, unrelated to live distribution shift.

**8. Correct: C (ROI).** ROI is a named business metric assessing
whether value exceeds cost — directly answers "is it worth keeping in
production despite strong accuracy." **A, B, D** are all model
performance metrics, which the question explicitly says is already
strong — it's asking what ELSE to check.

**9. Correct: B.** A fixed-rate lookup calculation needs a guaranteed,
identical, auditable result every time — ML would introduce
unnecessary probabilistic risk. **A, C, D** all involve learning
patterns from data that change over time or are too complex to
hand-code — genuine ML use cases.

**10. Correct: B.** RLHF uses human preference judgments as a reward
signal to align model behavior — its defining purpose. **A** describes
model compression/distillation, unrelated. **C** is a model
architecture property unaffected by RLHF. **D** is a security control,
unrelated to alignment training.

**11. Correct: B (Business problem framing).** Translating a goal into
a measurable ML target is the first lifecycle stage by definition. **A
(Data collection)** happens after framing. **C** and **D** are later
stages, both downstream of defining what "success" means.

**12. Correct: C.** Inference is correctly defined. **A** has bias and
fairness's definitions swapped — that description is fairness, not
bias. **B** swaps fit and bias's definitions — "systematic error from
unrepresentative data" describes bias, not fit (fit is about
over/underfitting). **D** swaps model and algorithm — the algorithm is
the training *procedure*; the model is the resulting *artifact*.

**13. Correct: B (Agentic AI).** Autonomous, multi-step tool use (query
an API, take action) without per-step human approval is the defining
trait of agentic AI. **A** describes single-turn conversational
response, not multi-step autonomous action. **C** is an unrelated
learning paradigm, not a system behavior description. **D** is
contradicted — this system uses AI/GenAI reasoning, not fixed rules.

---

## Section 2 — Domain 2: Fundamentals of Generative AI

**14. Correct: A (Diffusion model).** Iterative denoising from random
noise, conditioned on a prompt, is exactly how diffusion models
generate images. **B** and **C** are classical ML techniques unrelated
to generative image synthesis. **D** finds groupings, doesn't generate
content.

**15. Correct: C (Model selection).** As an API consumer, you typically
choose among already-pretrained models — data selection and
pre-training are the FM provider's job, done before the model reaches
Bedrock. **A, B** are provider-side stages. **D** isn't a named
lifecycle stage in this form.

**16. Correct: A and C (Adaptability, Responsiveness).** Both are named
GenAI advantages (a third, Simplicity, is also genuine but wasn't among
these five options). **B (Nondeterminism)** and **D (Hallucination)**
are named limitations, not advantages — opposite category. **E (Prompt
leaking)** is a Domain 3/5 prompt-injection security risk, unrelated to
GenAI's business advantages entirely.

**17. Correct: B (Hallucination).** Confidently generating fabricated,
non-existent content is the definition of hallucination. **A
(Interpretability)** concerns explaining *why* a model produced
something, not fabrication itself. **C (Nondeterminism)** is about
run-to-run output variability, a different symptom. **D
(Adaptability)** is an advantage, unrelated to this failure mode.

**18. Correct: B (PartyRock).** Purpose-built no-code Bedrock-powered
prototyping playground. **A (SageMaker JumpStart)** targets deeper
infrastructure control, not no-code prototyping. **C (Amazon Q
Developer)** is a coding assistant, different product category. **D
(AWS Config)** is a governance/compliance service, unrelated to GenAI
prototyping.

**19. Correct: B.** Context window is exactly the input+output token
capacity per call. **A** and **D** describe unrelated properties
(training period, deployment region). **C** describes fine-tuning
dataset size, a different concept entirely.

**20. Correct: B (Provisioned throughput).** Steady, predictable, high
volume is exactly the profile that benefits from a flat reserved rate
instead of per-token costs. **A** is better suited to unpredictable/
bursty traffic, the opposite profile. **C** and **D** don't reflect
real Bedrock pricing models.

**21. Correct: B.** Multi-modal means handling more than one data type
(e.g., text and images) for input and/or output. **A** contradicts the
definition — multi-modal isn't text-only. **C** and **D** are
unsupported, unrelated claims not part of the actual definition.

**22. Correct: B.** Knowledge Bases is Bedrock's RAG-enabling
capability, grounding responses in your own retrievable data. **A**
describes Guardrails. **C** describes provisioned throughput. **D**
describes Bedrock's billing infrastructure — none are Knowledge Bases'
function.

**23. Correct: C (Embedding).** An embedding is defined exactly this
way — a semantic vector representation. **A (Token)** is a discrete
text unit, not a semantic vector. **B (Prompt)** is the input text
itself. **D (Guardrail)** is a safety-filtering capability, unrelated
to vector representation.

**24. Correct: C (SageMaker JumpStart).** Provides a pre-trained model
hub (including open-source options) with deeper infrastructure control
than Bedrock's managed API. **A (PartyRock)** is a no-code playground,
not an infrastructure-control platform. **B (Amazon Q Business)** is a
turnkey assistant, not a model-hosting platform. **D (Translate)** is
an NLP service, unrelated to infrastructure control.

**25. Correct: B.** Interpretability challenges (the "black box"
problem) are a named GenAI limitation. **A, C, D** are all named
*advantages*, the opposite category from what the question asks.

**26. Correct: B.** LLMs are one type of foundation model; diffusion
and multi-modal models are FMs too but aren't LLMs — a strict-subset
relationship, not equivalence. **A** denies a real containment
relationship. **C** inverts it — not every FM is an LLM. **D** is
false; LLM and diffusion model are distinct FM types, not synonyms.

**27. Correct: B (Nondeterminism).** Identical prompts producing
different outputs across calls is nondeterminism's defining symptom.
**A (Interpretability)** concerns explainability of a single output,
not run-to-run variation. **C** and **D** are advantages, unrelated to
this specific symptom.

**28. Correct: B (Amazon Q Developer).** Purpose-built IDE-integrated
coding assistant. **A (Amazon Q Business)** targets general enterprise/
business knowledge use cases, not IDE coding specifically. **C (Lex)**
builds conversational chatbot interfaces, unrelated to coding. **D
(Kendra)** is enterprise search, unrelated to coding assistance.

**29. Correct: A.** Self-attention's core function is weighing every
other token's relevance when processing each token, improving
long-range context handling versus older architectures. **B, C, D**
are all fabricated, unsupported claims about what self-attention does.

---

## Section 3 — Domain 3: Applications of Foundation Models

**30. Correct: B (Temperature).** Low temperature yields more focused,
deterministic, repeatable output — the standard tested pairing. **A
(Max tokens)** limits length, not consistency. **C (Context window)**
is a capacity property, not a tunable creativity control. **D (Model
size)** is a selection criterion, not an inference-time "low/high"
parameter for this purpose.

**31. Correct: B (RAG with a knowledge base).** Grounds responses in
current, retrievable data without retraining — the direct fit for
"constantly changing" content. **A (weekly fine-tuning)** still lags
real-time changes and costs far more to maintain. **C (temperature)**
controls randomness, not factual grounding. **D (diffusion model)** is
an image-generation model type, irrelevant to a text Q&A chatbot.

**32. Correct: B (OpenSearch Service).** Purpose-built for vector +
full-text search at scale. **A (Neptune)** is graph-oriented, better
when entity relationships matter most. **C (Polly)** is text-to-speech,
unrelated. **D (AWS Config)** is a governance service, unrelated to
vector search.

**33. Correct: B.** Goal hijacking is exactly this — a prompt-injection
subtype redirecting the application's intended task. **A** and **D**
are unrelated legitimate techniques (fine-tuning, model selection). **C**
describes an evaluation concept, unrelated to injection attacks.

**34. Correct: B (Few-shot prompting).** Supplies multiple in-prompt
examples to demonstrate a pattern. **A (Zero-shot)** supplies no
examples. **C (Negative prompting)** specifies what to avoid, not
examples of desired output. **D (Continuous pre-training)** is a
training-time process, not an in-prompt technique.

**35. Correct: A.** This is the precise distinction: continuous
pre-training = unlabeled domain data broadening knowledge; fine-tuning
= labeled data shaping specific behavior. **B** denies a real, tested
distinction. **C** is an unsupported claim. **D** is false — fine-tuning
is commonly performed by the customer, the primary customization step
in the typical FM lifecycle a Bedrock customer performs.

**36. Correct: A and C (Jailbreaking, Poisoning).** Both are named
prompt/data misuse risks. **B (RLHF)** is a legitimate training
technique. **D (BERTScore)** is an evaluation metric. **E (Model
Cards)** is a Domain 4 documentation tool — none of B/D/E are misuse
risks.

**37. Correct: B.** An explicit output indicator/prompt template fixes
formatting inconsistency at near-zero cost — the cheapest, most
targeted fix for a pure format problem. **A** and **C** are
disproportionate training investments for a formatting-only issue. **D**
doesn't address format consistency at all.

**38. Correct: B (ROUGE).** Recall-oriented, standard for summarization.
**A (BLEU)** is precision-oriented, standard for translation instead.
**C (BERTScore)** is embedding-based/semantic, not specifically the
recall-oriented word-overlap metric asked for here. **D (F1)** is a
classification metric, not a text-generation quality metric.

**39. Correct: C (BERTScore).** Embedding-based semantic similarity,
tolerant of paraphrasing. **A** and **B** are both word-overlap metrics
that would penalize valid paraphrases. **D (Accuracy)** is a
classification metric, unrelated to text-generation quality scoring.

**40. Correct: B (Modality).** Whether a model can process image input
at all is a modality question, directly gating this requirement. **A,
C, D** are real tradeoffs but don't determine whether image processing
is even possible.

**41. Correct: B (Data leakage).** A feature unavailable at real
inference time "seeing the future" is the definition of leakage. **A
(Data drift)** is a post-deployment phenomenon, not a training-time
design flaw. **C (Underfitting)** is a model-capacity issue, unrelated.
**D (Prompt injection)** is a runtime input attack, unrelated to
training feature design.

**42. Correct: A (Instruction tuning).** Defined exactly as fine-tuning
on instruction/response pairs to improve general instruction-following.
**B (Continuous pre-training)** uses unlabeled data for broader
knowledge, not instruction-following specifically. **C (RAG)** doesn't
change model weights at all. **D (Negative prompting)** is a prompting
technique, not a training method.

**43. Correct: B (BLEU).** Precision-oriented, the standard metric for
translation quality. **A (ROUGE)** is recall-oriented, paired with
summarization instead. **C (BERTScore)** is semantic-similarity based,
not the precision-oriented word-overlap metric specifically asked for.
**D (AUC)** is a classification metric, unrelated to translation
quality scoring.

**44. Correct: B (Prompt engineering).** The cheapest, fastest fix when
the base model already performs the task well — no training required.
**A, C, D** are all disproportionate, higher-cost interventions for a
problem prompting alone likely solves.

**45. Correct: A (Amazon Neptune).** Purpose-built for
relationship-aware (graph) data alongside similarity search. **B
(Polly)** is text-to-speech, unrelated. **C (Rekognition)** is computer
vision, unrelated to vector storage. **D (Trusted Advisor)** is a
best-practice recommendation service, unrelated.

**46. Correct: B.** Jailbreaking is defined exactly as crafting a
prompt to bypass safety training/guardrails. **A** and **C** are
unrelated legitimate techniques (training, evaluation). **D** is a
data-storage concept, unrelated to safety bypass attempts.

**47. Correct: B.** A highly domain-specific use case poorly served by
general-purpose managed services is the clearest justification for
custom SageMaker AI build. **A** and **C** both describe exactly the
scenario favoring a *managed* service instead — the opposite of what's
asked. **D** (no data) is actually a reason to pause on either approach,
not specifically a reason to prefer the custom-build path.

---

## Section 4 — Domain 4: Guidelines for Responsible AI

**48. Correct: B (Fairness).** Outcomes systematically disadvantaging a
demographic group for reasons unrelated to qualification is the
definition of a fairness violation. **A (Robustness)** concerns
reliability under varied conditions generally, not group-based outcome
disparity. **C (Veracity)** concerns factual truthfulness, unrelated.
**D** is an unrelated model-selection practice.

**49. Correct: B (Amazon SageMaker Clarify).** Purpose-built for bias
detection and SHAP-based prediction explanation. **A (Guardrails)** is
runtime content/safety filtering, a different function. **C (AWS
Config)** tracks resource configuration, unrelated to model bias. **D
(Comprehend)** is an NLP service, unrelated to bias/explainability
tooling.

**50. Correct: B (IP infringement claims).** Generated content
resembling copyrighted training data is the core IP risk named in the
exam guide. **A (End-user risk)** concerns harm to someone relying on
output, a different risk. **C (Loss of customer trust)** is a
reputational consequence of many possible failures, not this specific
one. **D** is a technical property, not a legal-risk category.

**51. Correct: B.** Model Cards provide structured documentation of
intended use, limitations, data, and ethics. **A** describes
Guardrails. **C** describes a training process, unrelated to
documentation. **D** describes SageMaker Clarify's function, not Model
Cards'.

**52. Correct: B.** The explicit tradeoff: simpler/interpretable models
may cap out below what complex models achieve on hard tasks. **A**
reverses the actual tradeoff. **C** denies a real, tested relationship.
**D** is backwards — foundation models are the LESS interpretable end
of the spectrum.

**53. Correct: A and E (Balanced datasets, Diversity).** Both are named
dataset characteristics for responsible AI (alongside inclusivity and
curated sources, which weren't among these five options). **B (Model
Cards)** is a Domain 4 model-documentation tool, not a dataset
characteristic. **C (Provisioned throughput)** and **D (Token-based
pricing)** are Domain 2/3 infrastructure/cost concepts — none of B/C/D
describe a property of the dataset itself.

**54. Correct: B.** A hard regulatory explainability requirement favors
the interpretable end of the tradeoff spectrum, even at some accuracy
cost. **A** picks the least explainable option against an explicit
regulatory need. **C** and **D** optimize for irrelevant factors (cost,
training effort) instead of the stated explainability requirement.

**55. Correct: B (Robustness).** Defined exactly as reliable performance
under varied real-world/adversarial conditions. **A (Fairness)**
concerns equitable outcomes across groups, a different concept. **C
(Veracity)** concerns truthful output. **D (Inclusivity)** concerns
serving the full range of intended users, related but distinct from
general condition-robustness.

**56. Correct: B (Human-centered design).** Requires iterative input
from product, policy/legal, engineering, and end users — skipping all
but engineering violates it. **A** is unrelated to stakeholder process.
**C** and **D** are unrelated technical/cost concepts from other
domains.

---

## Section 5 — Domain 5: Security, Compliance, and Governance for AI Solutions

**57. Correct: B (The customer).** IAM policy configuration is always
"security in the cloud" — the customer's job under the shared
responsibility model, regardless of how managed the underlying service
is. **A, C, D** all incorrectly shift this customer responsibility
elsewhere.

**58. Correct: B (AWS PrivateLink).** Purpose-built for private VPC
connectivity to services like Bedrock, avoiding the public internet.
**A (CloudTrail)** logs API activity, unrelated to network path. **C
(Audit Manager)** collects compliance evidence, unrelated. **D
(Inspector)** performs vulnerability scanning, unrelated to
connectivity.

**59. Correct: B (Data poisoning).** Defined exactly as corrupting
training/fine-tuning data to embed harmful behavior. **A (Prompt
injection)** manipulates runtime input, not training data. **C
(Adversarial attack)** crafts inference-time inputs to cause
misclassification, a different mechanism. **D (Bias amplification)** is
a model reinforcing existing training bias, distinct from deliberate
data corruption.

**60. Correct: B.** Moving to a higher-ownership scope (fine-tuning)
increases the customer's security responsibility on top of everything
already required at the lower scope. **A** reverses the actual
relationship. **C** denies a real, tested distinction between scopes.
**D** is false — responsibility shifts toward the customer at higher
scopes, not toward AWS.

**61. Correct: B (AWS Artifact).** The defined source for AWS's own
compliance certifications and reports. **A (Audit Manager)** collects
evidence about *your* account's controls, not AWS's own certifications.
**C (Config)** tracks your resource configuration state, unrelated. **D
(CloudTrail)** logs your account's API activity, unrelated.

**62. Correct: A (AWS CloudTrail).** Defined purpose is exactly the
who-did-what-when API activity log. **B (Trusted Advisor)** gives
general best-practice recommendations, not a call-level audit trail. **C
(Inspector)** scans for vulnerabilities, unrelated. **D (Config)**
tracks configuration state over time, a related but distinct concern
from an activity log.

**63. Correct: A and C (Data leakage, Adversarial attacks).** Both are
named GenAI-specific threats. **B (Chain-of-thought)** is a legitimate
Domain 3 prompting technique. **D (Model Cards)** is a Domain 4
documentation tool. **E (BERTScore)** is a Domain 3 evaluation metric —
none of B/D/E are threats.

**64. Correct: B.** Data lineage is defined exactly as tracking origin
and transformations for auditability. **A** describes encryption, a
related but separate control. **C** describes Guardrails' function,
unrelated to lineage. **D** describes provisioned throughput, unrelated.

**65. Correct: A.** Governance requires an ongoing review cadence, not a
one-time launch check, per data governance best practice. **B** is a
network-security mechanism, unrelated to review frequency. **C** and
**D** are model-selection/inference-parameter concerns from Domain 3,
unrelated to governance process.

---

## Scoring guide

- **Overall pass threshold to compare against:** the real exam requires
  700/1000 scaled — roughly analogous to answering the large majority of
  questions correctly, though the real scaled score isn't a simple raw
  percentage. Treat **~80%+ raw correct on this set** as a reasonable
  informal readiness signal, not an official prediction.
- **Per-domain weak-area check:** divide correct-by-domain by that
  domain's question count (13/16/18/9/9). Any domain scoring
  meaningfully below your overall percentage is where to spend the next
  study session — re-read that domain file's "Exam traps" section
  first, it's built for exactly this.
