# Domain 5: Security, Compliance, and Governance for AI Solutions

**Weight: 14% of scored content** (roughly 7 of 50 scored questions) —
tied with Domain 4 as the two most under-studied domains. Together
Domains 4 and 5 equal Domain 3 alone (28%); don't shortchange either.

```
Domain 5 = three task statements
┌─────────────────────────────────────────────────────────────────┐
│ 5.1  Explain methods to secure AI systems                       │
│ 5.2  Recognize governance and compliance regulations for AI     │
│      systems                                                    │
│ 5.3  Describe data governance strategies for AI systems         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5.1 — Methods to secure AI systems

### 5.1.1 The AWS shared responsibility model, applied to AI

| | AWS's responsibility ("security **of** the cloud") | Customer's responsibility ("security **in** the cloud") |
|---|---|---|
| Underlying infrastructure | Physical data centers, host hardware, network infrastructure running Bedrock/SageMaker AI | — |
| The managed service itself | Bedrock/SageMaker AI platform availability and patching | — |
| Your data | — | Classifying, encrypting, and controlling access to the data you feed into training, fine-tuning, or RAG |
| Identity and access | — | IAM policies, least-privilege access to models/endpoints/data |
| Model configuration | — | Guardrails configuration, prompt design, which models/features you enable |
| Application-layer security | — | Securing the application built on top of Bedrock/SageMaker AI (input validation, auth, etc.) |

**Exam trap:** AWS securing "the cloud" does **not** mean AWS is
responsible for your IAM policies, your data classification, or your
Guardrails configuration — those stay squarely on the customer side of
the line, same as with any other AWS managed service.

### 5.1.2 Network and access security

| Mechanism | What it does |
|---|---|
| **AWS PrivateLink** | Provides private connectivity from your VPC to Bedrock/SageMaker AI without traversing the public internet — reduces exposure surface for sensitive AI workloads |
| **AWS IAM** | Least-privilege identity-based and resource-based policies controlling who/what can invoke a model, access a Knowledge Base, or manage training jobs |
| **Encryption at rest** | Data (training data, model artifacts, Knowledge Base content) encrypted using AWS KMS |
| **Encryption in transit** | TLS protecting API calls to Bedrock/SageMaker AI endpoints |

### 5.1.3 Source citation and data lineage

| Concept | What it means |
|---|---|
| **Source citation** | Documenting and, where relevant, surfacing where retrieved/generated content actually came from — especially relevant to RAG outputs |
| **Data lineage** | Tracking a dataset's origin and every transformation it went through before reaching a model |
| **Data cataloging** | Maintaining a searchable inventory of what data exists, where, and what it contains |
| **SageMaker Model Cards** | (Domain 4 §4.2.2 callback) documents a model's data/training/limitations — lineage and Model Cards work together to make an AI system's provenance auditable |

### 5.1.4 Secure data engineering practices

| Practice | What it means |
|---|---|
| **Assessing data quality** | Verifying data is accurate, complete, and fit for purpose before it touches training/fine-tuning/RAG — poor quality data undermines every downstream security and accuracy goal |
| **Privacy-enhancing technologies (PETs)** | Techniques like anonymization, pseudonymization, tokenization, and differential privacy that reduce exposure of sensitive/personal data used in AI systems |
| **Data access controls** | Fine-grained, least-privilege controls over who can read/write which datasets, separate from model-invocation access controls (§5.1.2) |

### 5.1.5 GenAI-specific threats

| Threat | What it is | Where it's also covered |
|---|---|---|
| **Prompt injection / jailbreaking** | Manipulating input to override intended model behavior or bypass safety controls | Domain 3 §3.2.3 |
| **Data poisoning** | Corrupting training/fine-tuning data to embed harmful behavior | Domain 3 §3.3.3 |
| **Adversarial attacks** | Deliberately crafted inputs designed to cause a model to misclassify or fail | — |
| **Data leakage** | Sensitive information from training data or context inadvertently exposed in model output | Connects to Domain 4's veracity/safety features |
| **Bias amplification** | A model reinforcing or exaggerating biases present in its training data | Domain 4 §4.1.1 |

**Mitigations, in line with the rest of the exam:** anomaly
detection/monitoring for unusual usage patterns, regular testing for
bias/fairness/accuracy/robustness, least-privilege IAM, and Bedrock
Guardrails — this domain is where the Domain 3 and Domain 4 technical
concepts get reframed explicitly as *security* concerns.

### 5.1.6 The Generative AI Security Scoping Matrix

A framework for classifying a GenAI use case by how much ownership/
control you have over the model and data — your security
responsibilities scale with how much of the stack you control.

| Scope | Example | Who controls the model | Your security responsibility |
|---|---|---|---|
| **1 — Consumer app** | Using a public third-party GenAI app (e.g., a consumer chatbot website) | The app provider entirely | Lowest — mainly about what data you choose to share with it |
| **2 — Enterprise app** | Using a vendor's enterprise GenAI application (e.g., Amazon Q Business) | The app provider, with enterprise controls | Data governance, access control over who in your org can use it |
| **3 — Pre-trained model (via API)** | Calling a foundation model on Bedrock as-is | The FM provider trains it; you consume via API | Prompt/data security, IAM, Guardrails configuration, output handling |
| **4 — Fine-tuned model** | Fine-tuning a Bedrock/SageMaker JumpStart model on your own data | Shared — base model from provider, customization from you | Everything in Scope 3, plus securing your fine-tuning data and the customized model artifact |
| **5 — Self-trained model** | Training a model from scratch on SageMaker AI | You, entirely | Highest — full responsibility for training data security, infrastructure, and the resulting model |

**Exam-tested principle:** as you move from Scope 1 → 5, you gain more
control and customization ability, but your security/governance
responsibility grows correspondingly — this mirrors the general AWS
shared-responsibility pattern (more managed = less customer
responsibility; more self-built = more customer responsibility) applied
specifically to GenAI.

---

## 5.2 — Governance and compliance regulations for AI systems

### 5.2.1 AWS services supporting governance and compliance

| Service | What it does |
|---|---|
| **AWS Config** | Tracks resource configuration and configuration changes over time; evaluates resources against compliance rules |
| **Amazon Inspector** | Automated vulnerability scanning for workloads (e.g., container images, EC2) that support an AI application's infrastructure |
| **AWS Audit Manager** | Continuously collects evidence to help assess whether controls meet a specific compliance framework |
| **AWS Artifact** | Self-service portal for AWS's own compliance reports and agreements (e.g., ISO certifications, SOC reports) |
| **AWS CloudTrail** | Logs API calls/account activity — the audit trail for who did what, when, including calls to Bedrock/SageMaker AI |
| **AWS Trusted Advisor** | Automated recommendations across cost, performance, security, and fault tolerance best practices |

**Exam trap — memorize the distinct role of each, they get confused for
each other:** **Config** = configuration state/compliance rules over
time. **CloudTrail** = who did what (API activity log). **Audit
Manager** = evidence collection mapped to a compliance framework.
**Artifact** = AWS's *own* compliance documentation, not yours. **Inspector**
= vulnerability scanning. **Trusted Advisor** = general best-practice
recommendations, broader than just compliance.

### 5.2.2 Why governance matters for AI specifically

AI systems raise governance questions beyond typical cloud workloads
because of factors from earlier domains converging here: hallucination
and bias (Domain 2/4) create compliance exposure that a purely
deterministic system wouldn't; opaque/black-box models (Domain 4 §4.2)
complicate demonstrating compliance to a regulator; and GenAI's broad
use-case flexibility (Domain 2 §2.2.1's "adaptability") means the same
underlying model may need different governance treatment depending on
which regulated use case it's applied to.

---

## 5.3 — Data governance strategies for AI systems

### 5.3.1 The data governance lifecycle

```
 ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
 │  Collect   │─►│   Store    │─►│    Use     │─►│  Archive   │─►│  Delete    │
 └───────────┘  └───────────┘  └───────────┘  └───────────┘  └───────────┘
        │              │              │              │              │
        v              v              v              v              v
   Consent/       Encryption,     Access          Residency      Retention
   lawful basis,  residency       controls,       requirements   policy
   data quality   requirements    monitoring/                    compliance
   (§5.1.4)                       observability
```

| Concept | What it means |
|---|---|
| **Data lifecycles** | Governance requirements differ at each stage — collection consent differs from deletion/retention rules |
| **Logging** | Recording data access and usage events, feeding into audit trails (CloudTrail, §5.2.1) |
| **Residency** | Where data (and sometimes model processing) is legally required to be located/stored |
| **Monitoring / observability** | Ongoing visibility into how data and models are actually being used in production, not just a point-in-time check |
| **Retention** | How long data is kept, and the policy governing when it must be deleted |

### 5.3.2 Governance protocols

| Element | What it means |
|---|---|
| **Policies** | Written rules defining acceptable data/model use, access, and handling |
| **Review cadence** | How often governance controls and AI system behavior are re-evaluated (not a one-time check at launch) |
| **Review strategies** | The actual methodology used during a review (e.g., sampling outputs, bias audits, access-log review) |
| **Governance frameworks** | Structured approaches — including the **Generative AI Security Scoping Matrix** (§5.1.6), reused here as a governance tool, not just a security one |
| **Transparency standards** | Organizational commitments to disclosure (e.g., informing users when they're interacting with AI, per Domain 4's transparency principles) |
| **Team training** | Ensuring staff building/operating AI systems understand governance obligations, not just the technology |

**Exam-tested theme:** governance is explicitly framed as an ongoing
**process** (review cadence, continuous monitoring) rather than a
one-time compliance checkbox — the same "process, not a property"
framing Domain 4 §4.2.4 used for human-centered design applies here to
governance broadly.

---

## Exam traps specific to Domain 5

1. **Assigning IAM policy or data classification responsibility to
   AWS.** Under the shared responsibility model, that's always the
   customer's job (§5.1.1), regardless of how "managed" the AI service
   is.
2. **Confusing AWS Config, CloudTrail, Audit Manager, and Trusted
   Advisor** — each has a genuinely distinct role (§5.2.1); the exam
   tests picking the *specific* right one for a described need, not just
   "a compliance-sounding service."
3. **Assuming AWS Artifact contains YOUR company's compliance
   evidence.** It's AWS's own compliance reports (ISO, SOC, etc.), not a
   place you upload or generate your own audit evidence — that's Audit
   Manager's job.
4. **Treating higher Security Scoping Matrix levels as "more secure."**
   Higher scope (more self-built) means more capability/control, but
   also **more** security responsibility on you — not inherently safer.
5. **Treating data governance as a one-time setup step** rather than an
   ongoing lifecycle with review cadence and continuous monitoring
   (§5.3.2).

## Mnemonics

- **Shared responsibility, AI edition: "AWS secures the shelf, you
  secure what you put on it."** AWS secures the platform; you secure
  your data, IAM, and configuration choices on top of it.
- **"CCAAIT" for the six governance/compliance services:**
  **C**onfig, **C**loudTrail, **A**udit Manager, **A**rtifact,
  **I**nspector, **T**rusted Advisor.
- **Security Scoping Matrix, 1→5: "Consume, enterprise-Consume,
  Call, Customize, Create."** Rough shorthand for consumer app →
  enterprise app → call a pretrained FM → fine-tune it → train your own.

---

## Practice questions — Domain 5

*14 questions, every option explained.*

**Q1.** Under the AWS shared responsibility model, who is responsible
for configuring IAM least-privilege policies that control access to a
company's Bedrock-based application?
A) AWS exclusively
B) The customer
C) Neither party — it's automatically enforced
D) The foundation model provider (e.g., Anthropic)

<details><summary>Answer & explanation</summary>

**Correct: B.** IAM policy configuration is squarely "security in the
cloud" — the customer's responsibility (§5.1.1). **A** and **C** both
incorrectly shift a customer responsibility away from the customer.
**D** confuses the FM provider (who trains the model) with the AWS
account holder configuring access to their own application — unrelated
parties.
</details>

**Q2.** Which AWS service provides private connectivity between a VPC
and Amazon Bedrock without traversing the public internet?
A) AWS CloudTrail
B) AWS PrivateLink
C) AWS Audit Manager
D) Amazon Inspector

<details><summary>Answer & explanation</summary>

**Correct: B.** PrivateLink is specifically for private connectivity to
AWS services like Bedrock (§5.1.2). **A (CloudTrail)** logs API
activity, unrelated to network connectivity. **C (Audit Manager)**
collects compliance evidence, unrelated. **D (Inspector)** performs
vulnerability scanning, unrelated to private connectivity.
</details>

**Q3.** A company wants to reduce exposure of personally identifiable
information (PII) used in training a fine-tuned model by transforming it
so individuals can't be re-identified. This is an example of:
A) A privacy-enhancing technology (PET)
B) AWS PrivateLink
C) Data lineage
D) The Generative AI Security Scoping Matrix

<details><summary>Answer & explanation</summary>

**Correct: A.** Techniques like anonymization/tokenization to reduce
PII exposure are PETs (§5.1.4). **B (PrivateLink)** is a network
connectivity mechanism, unrelated to data transformation. **C (Data
lineage)** tracks data's origin and transformations for auditability,
not privacy protection specifically. **D** is a framework for
classifying security responsibility by ownership level, not a data
transformation technique.
</details>

**Q4.** Which threat involves an attacker corrupting the data used to
train or fine-tune a model so it learns harmful or incorrect behavior?
A) Prompt injection
B) Data poisoning
C) Bias amplification
D) Adversarial attack

<details><summary>Answer & explanation</summary>

**Correct: B.** Data poisoning is exactly this — corrupting training/
fine-tuning data (§5.1.5, also Domain 3 §3.3.3). **A (Prompt
injection)** manipulates *runtime input*, not training data. **C (Bias
amplification)** is a model reinforcing existing training-data bias, a
related but distinct failure mode from deliberate corruption. **D
(Adversarial attack)** crafts inputs to cause misclassification at
inference time, not training-data corruption.
</details>

**Q5.** A company is deciding between calling a foundation model via the
Bedrock API as-is (Scope 3) versus fine-tuning that model on their own
proprietary data (Scope 4) under the Generative AI Security Scoping
Matrix. What is the KEY security implication of moving to Scope 4?
A) Security responsibility decreases because AWS now manages more
B) Security responsibility increases — the company must now also secure
   its fine-tuning data and the resulting customized model artifact
C) There is no meaningful security difference between the two scopes
D) Scope 4 eliminates the need for IAM policies

<details><summary>Answer & explanation</summary>

**Correct: B.** Moving to a higher scope (more customization/ownership)
increases the customer's security responsibility, on top of everything
already required at Scope 3 (§5.1.6). **A** reverses the actual
relationship — more control means more responsibility, not less. **C**
denies a real, exam-tested distinction between scopes. **D** is false —
IAM remains necessary at every scope.
</details>

**Q6.** Which AWS service is the correct choice for retrieving AWS's own
ISO certification and SOC compliance reports?
A) AWS Audit Manager
B) AWS Artifact
C) AWS Config
D) AWS CloudTrail

<details><summary>Answer & explanation</summary>

**Correct: B.** AWS Artifact is the self-service portal for AWS's own
compliance documentation (§5.2.1). **A (Audit Manager)** collects
evidence about YOUR account's controls against a framework, not AWS's
own certifications. **C (Config)** tracks your resource configuration
state, unrelated to AWS's compliance reports. **D (CloudTrail)** logs
API activity, unrelated.
</details>

**Q7.** Which AWS service continuously collects evidence to help
demonstrate that a company's AI system controls meet a specific
compliance framework?
A) Amazon Inspector
B) AWS Trusted Advisor
C) AWS Audit Manager
D) AWS PrivateLink

<details><summary>Answer & explanation</summary>

**Correct: C.** Audit Manager's defined purpose is continuous evidence
collection mapped to a compliance framework (§5.2.1). **A (Inspector)**
performs vulnerability scanning, a security function rather than
evidence collection for compliance frameworks. **B (Trusted Advisor)**
gives general best-practice recommendations across several categories,
not framework-specific evidence collection. **D (PrivateLink)** is a
network connectivity service, unrelated to compliance evidence.
</details>

**Q8.** A company needs a complete audit trail of every API call made
against its Bedrock resources, including who made each call and when.
Which service provides this?
A) AWS CloudTrail
B) AWS Artifact
C) Amazon Inspector
D) AWS Config

<details><summary>Answer & explanation</summary>

**Correct: A.** CloudTrail logs API calls/account activity — exactly
the "who did what, when" audit trail described (§5.2.1). **B
(Artifact)** provides AWS's own compliance reports, not your account's
activity log. **C (Inspector)** scans for vulnerabilities, unrelated to
call-level auditing. **D (Config)** tracks resource configuration state
over time, a related but distinct concern from an API activity log.
</details>

**Q9.** What is the PRIMARY purpose of data lineage in the context of AI
system governance?
A) Encrypting data at rest using AWS KMS
B) Tracking a dataset's origin and every transformation it underwent
   before reaching a model, supporting auditability
C) Filtering toxic content from model output
D) Reserving dedicated inference capacity

<details><summary>Answer & explanation</summary>

**Correct: B.** Data lineage is defined exactly this way in §5.1.3 —
tracking origin and transformations for auditability. **A** describes
encryption, a related but separate security control. **C** describes
Guardrails' function (Domain 2/3), unrelated to lineage tracking. **D**
describes Bedrock provisioned throughput (Domain 2 §2.3.3), unrelated.
</details>

**Q10.** A company's AI governance program only checks system behavior
once at launch and never again. What does §5.3.2 identify as MISSING
from this approach?
A) A review cadence — ongoing, periodic re-evaluation rather than a
   one-time check
B) AWS PrivateLink configuration
C) A foundation model with a larger context window
D) A lower temperature setting

<details><summary>Answer & explanation</summary>

**Correct: A.** Governance is explicitly framed as requiring an ongoing
review cadence, not a one-time launch check (§5.3.2). **B** is a
network-security mechanism, unrelated to governance review frequency.
**C** and **D** are model-selection/inference-parameter concerns (Domain
3), unrelated to governance process.
</details>

**Q11.** Which of the following BEST describes "data residency" as a
data governance consideration?
A) How long data is retained before deletion
B) Legal requirements dictating where data (or model processing) must be
   physically/geographically located
C) The format used to log data access events
D) The AWS service used to scan for vulnerabilities

<details><summary>Answer & explanation</summary>

**Correct: B.** Residency is specifically about legally required
data/processing location (§5.3.1). **A** describes retention, a related
but distinct lifecycle concept. **C** describes logging, also distinct
from location requirements. **D** is unrelated — that's Amazon
Inspector's function (§5.2.1).
</details>

**Q12.** A financial services company wants to ensure staff building its
GenAI application understand their legal and ethical obligations before
deployment. Which §5.3.2 governance element does this represent?
A) Team training
B) Data residency
C) AWS Trusted Advisor recommendations
D) Encryption in transit

<details><summary>Answer & explanation</summary>

**Correct: A.** Ensuring staff understand governance obligations is
exactly "team training" (§5.3.2). **B (Data residency)** is a location
requirement, unrelated to staff knowledge. **C (Trusted Advisor)** is an
AWS service providing automated recommendations, not a governance-
process element about people. **D (Encryption in transit)** is a
technical security control (§5.1.2), unrelated to training staff.
</details>

**Q13.** Which of these correctly pairs a GenAI-specific threat with its
description?
A) Adversarial attack — corrupting training data to embed harmful
   behavior
B) Data leakage — sensitive information from training data or context
   inadvertently exposed in model output
C) Data poisoning — deliberately crafted inputs designed to cause
   misclassification at inference time
D) Bias amplification — manipulating a prompt to override intended
   model behavior

<details><summary>Answer & explanation</summary>

**Correct: B.** Data leakage is defined exactly this way in §5.1.5. **A**
describes data poisoning, not an adversarial attack. **C** describes an
adversarial attack, not data poisoning — the definitions are swapped.
**D** describes prompt injection, not bias amplification — also
swapped. This question tests whether the five threats in §5.1.5 are
memorized precisely rather than just recognized as a group.
</details>

**Q14.** A company using a public, third-party consumer GenAI chatbot
website (Scope 1 on the Generative AI Security Scoping Matrix) is
primarily responsible for which security consideration?
A) Securing the underlying model training infrastructure
B) What data they choose to share with the third-party app, since they
   don't control the model or app itself
C) Configuring IAM policies for the model's training pipeline
D) Performing fine-tuning data governance

<details><summary>Answer & explanation</summary>

**Correct: B.** At Scope 1, the app/model is entirely provider-
controlled — the customer's responsibility is limited mainly to what
data they choose to expose to it (§5.1.6). **A, C, and D** all describe
responsibilities that belong to higher scopes (3-5) where the customer
actually controls infrastructure, IAM for their own resources, or
fine-tuning data — none of which apply when using someone else's
consumer app end-to-end.
</details>

---

*Domain coverage complete for all five task-statement domains. Next:
Day 8 builds cross-domain comparison matrices in `03-comparisons/`. See
`00-START-HERE/STUDY-PLAN.md`.*
