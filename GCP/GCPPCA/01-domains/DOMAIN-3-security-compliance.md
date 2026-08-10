# Domain 3 — Designing for Security and Compliance (~20%)

> Source: `00-START-HERE/RUNBOOK.md` §3 (task wording reconstructed —
> see RUNBOOK §1). Second-largest domain; the exam's most reliable
> "there is one defensible best answer" domain because security has
> fewer legitimate judgment calls than, say, cost tradeoffs. Focus
> areas per RUNBOOK §3: IAM deep dive, CMEK/VPC-SC, Securing AI
> patterns, audit & compliance automation.

## Contents

1. [3.1 Designing for security](#31-designing-for-security)
2. [3.2 Designing for legal compliance](#32-designing-for-legal-compliance)
3. [Production architecture pattern: zero-trust perimeter](#production-architecture-pattern-zero-trust-perimeter)
4. [Production architecture pattern: defense in depth, layer by layer](#production-architecture-pattern-defense-in-depth-layer-by-layer)
5. [Domain 3-specific exam traps](#domain-3-specific-exam-traps)

---

## 3.1 Designing for security

### IAM model — the parts the exam actually tests

- **Policy is additive-only.** IAM bindings grant; there is no
  traditional "deny" in classic IAM (IAM Deny policies are a newer,
  narrower exception — used for org-wide guardrails, not routine access
  control). To *restrict* what an otherwise-granted principal can do,
  use **Organization Policy constraints**, not IAM.
- **Principle of least privilege via predefined roles > primitive
  roles > custom roles**, in that preference order: predefined roles are
  maintained by Google and cover most needs; primitive roles
  (Owner/Editor/Viewer) are almost always the *wrong* exam answer
  (too broad); custom roles are for the residual gap predefined roles
  don't cover, and carry a maintenance burden (you own keeping the
  permission list current as GCP's API surface evolves).
- **Resource hierarchy determines policy inheritance**: Organization →
  Folder → Project → Resource. A binding at a higher level is
  inherited (unioned, never revoked) by everything below. This is why
  "restrict X org-wide, no exceptions" is an Org Policy question, not
  an IAM question — IAM inheritance can only add permissions as you go
  down, never remove them.
- **IAM Conditions**: attribute-based conditional bindings (e.g. "grant
  this role only for requests before a certain date," or "only from a
  specific resource tag") — the answer when a scenario needs
  time-bound or attribute-scoped access (a contractor's temporary
  access, a break-glass emergency-access grant with a built-in
  expiry) rather than a permanent binding that has to be manually
  remembered and revoked later.
- **Groups over individual users**: IAM bindings should target Google
  Groups, not individual user accounts — a scenario describing
  frequent team member changes (onboarding/offboarding) is signaling
  that group-based access (add/remove from the group, IAM stays
  untouched) is the maintainable answer versus per-user bindings that
  drift out of date.

```
Org
 │  IAM: group-based bindings at Org level (broad, rare)
 │  Org Policy: org-wide constraints (deny external IPs, restrict
 │              resource locations) — enforced below IAM, cannot be
 │              overridden by a lower-level IAM grant
 ▼
Folder (e.g. "Production")
 │  IAM: environment-specific groups
 │  Org Policy: can tighten (never loosen) inherited constraints
 ▼
Project
 │  IAM: project-specific roles/service accounts
 ▼
Resource (bucket, instance, dataset)
    IAM: resource-level bindings for fine-grained exceptions
```

### Service accounts and Workload Identity Federation

| Pattern | When it's correct | Why it beats the alternative |
|---|---|---|
| Workload Identity Federation (external workload → GCP) | CI/CD runners, on-prem/other-cloud workloads needing GCP access | No exported, long-lived service-account key file to leak or rotate — this is the 2026-era default correct answer whenever a scenario mentions "avoid managing keys" |
| Workload Identity (GKE pod → GCP) | Pods needing GCP API access | Binds a Kubernetes service account to a GCP service account without mounting key files into pods |
| Exported service-account key (JSON file) | Legacy/unavoidable only | Almost never the "best" exam answer when a keyless alternative exists — flagged as a security anti-pattern in the guide's Securing AI/IAM material |
| Service account impersonation | Short-lived, on-demand elevated access (e.g. a human running a one-off admin task) | Grants a short-lived token instead of a standing credential — preferred over granting the human's own account the elevated role permanently |

### Organization Policy constraints — the ones to know cold

Org Policy constraints are the mechanism for restricting *what
configurations are allowed to exist*, independent of who has IAM
permission to create them. Common exam-relevant constraints:

| Constraint | What it prevents | Typical trigger phrase in a scenario |
|---|---|---|
| `constraints/compute.vmExternalIpAccess` | VMs from being assigned external IPs | "No public IPs, ever, org-wide" |
| `constraints/compute.restrictVpcPeering` | Uncontrolled VPC Peering to untrusted networks | "Prevent unapproved network peering" |
| `constraints/gcp.resourceLocations` | Resources from being created outside approved regions | "Data must stay within [region/country]" |
| `constraints/iam.disableServiceAccountKeyCreation` | New exported service-account key files from being created | "Enforce keyless authentication org-wide" |
| `constraints/sql.restrictPublicIp` | Cloud SQL/AlloyDB instances from getting public IPs | "Databases must be private-IP only" |
| `constraints/storage.uniformBucketLevelAccess` | Buckets from using legacy ACLs instead of uniform IAM | "Simplify and audit storage access org-wide" |
| `constraints/compute.requireOsLogin` | SSH key-based access without centralized IAM-governed login | "Centralize and audit VM SSH access" |
| `constraints/iam.allowedPolicyMemberDomains` | Granting IAM access to identities outside approved domains | "Prevent accidental external sharing of resources" |

### Separation of duties

- **Design principle**: the person/role that *approves* a change should
  not be the same one that *deploys* it, and the person with
  infrastructure-provisioning access shouldn't necessarily have
  production data-access permissions — implemented via distinct IAM
  roles/groups per function (e.g. a `terraform-deployer` service
  account distinct from a `data-analyst` group) rather than one broad
  role covering everything.
- **Exam signal**: a scenario describing "the same engineer who wrote
  the code also approved and deployed it to production with no review"
  is describing a separation-of-duties gap — the fix is process +
  IAM structure (require a second approver's IAM role for the
  production deploy trigger), not a technology swap.
- **Break-glass access**: for genuine emergencies, a scenario may need
  a documented, time-bound, heavily-audited elevated-access path (IAM
  Conditions with a short expiry + mandatory audit log review after
  use) rather than permanently granting broad access "just in case."

### Custom role design (when predefined roles don't fit)

- Build a custom role only from the **minimum permission set actually
  exercised** — pulling permissions from Policy Analyzer/Recommender
  findings on real usage, not copying a predefined role and trimming a
  few lines by guesswork.
- Custom roles at the **organization level** are reusable across
  projects; project-level custom roles duplicate maintenance effort
  across every project that needs the same role — prefer org-level
  unless the scenario specifically needs project-scoped variation.
- A scenario describing "our audit team found several accounts with
  permissions they never use" is a Recommender/Policy Analyzer signal —
  the fix is *tightening toward least privilege using data*, not
  guessing at a smaller role.

### Data protection and encryption

| Requirement signal | Mechanism | Detail |
|---|---|---|
| "Encrypted at rest" (default, no extra requirement) | Google-managed encryption keys | On by default for all GCP storage — don't over-answer a question that doesn't ask for more |
| "We must control/rotate the encryption keys ourselves" | CMEK (Customer-Managed Encryption Keys) via Cloud KMS | Google still performs the encryption operation; you own key lifecycle (rotation, destroy, IAM on the key) |
| "Key material must never touch Google's infrastructure" | CSEK (Customer-Supplied) or Cloud EKM (external key manager) | Highest operational burden; only correct when the scenario states this exact requirement (common in the most stringent compliance scenarios) |
| "Store and rotate application secrets (API keys, DB passwords)" | Secret Manager | Versioned, IAM-scoped, audit-logged — not environment variables or files in source control |
| "Find/redact PII before it lands in a data lake" | Cloud DLP (Sensitive Data Protection) | Classifies and can de-identify/tokenize sensitive fields in pipelines |

**CMEK design details worth having cold**:
- Keys live in Cloud KMS, organized into **key rings** (regional or
  global) and **crypto keys** — a key's location should match the
  resource it protects (a regional Cloud Storage bucket should use a
  key in the same region, both for latency and for residency
  compliance).
- **Key rotation** can be automated on a schedule (Cloud KMS supports
  automatic rotation periods) — a scenario requiring periodic key
  rotation as a compliance control doesn't need custom tooling, just
  the built-in rotation setting.
- **IAM on the key itself** is a separate permission surface from IAM
  on the resource it encrypts — a principal can have access to the
  encrypted data (`roles/storage.objectViewer`) but be denied the
  ability to *use the key* (`roles/cloudkms.cryptoKeyEncrypterDecrypter`
  not granted), which functionally blocks access even with storage
  permissions. This "two locks" property is exactly why CMEK is
  stronger than default encryption — revoking key access can cut off
  data access instantly without touching the resource's own IAM at
  all (useful for an emergency data-access kill switch).

### DLP techniques — beyond "it finds PII"

Cloud DLP (Sensitive Data Protection) does more than detection; the
exam expects you to distinguish the *de-identification technique* a
scenario calls for:

| Technique | What it does | Reversible? | Correct when… |
|---|---|---|---|
| Redaction | Removes/blacks out the sensitive value entirely | No | The value is never needed downstream (e.g. logs that shouldn't contain PII at all) |
| Masking | Replaces part of the value with a fixed character (e.g. last-4 digits shown) | No | A partial value is useful for verification (customer service confirming "card ending in 1234") but the full value isn't needed |
| Tokenization / format-preserving encryption | Replaces the value with a token that preserves format and can be reversed by an authorized process | Yes, with the right key/mapping | Downstream systems need the original value back later (e.g. a payment reconciliation process) but shouldn't see it in the interim |
| Bucketing / generalization | Replaces a precise value with a range (e.g. exact age → age range) | No | Analytics need statistical usefulness without individual-level precision (aggregate reporting on a GDPR-covered dataset) |
| Crypto-based hashing | One-way transform, same input always produces same output | No (but consistent, so joins across datasets still work) | Need to correlate records across datasets without ever exposing the original value |

- **DLP job types**: inspection jobs (find and classify) run
  separately from de-identification transforms (act on what was
  found) — a scenario describing "scan our existing data lake for PII
  we didn't know was there" is an inspection job; "strip PII from data
  before it lands in BigQuery" is a de-identification transform applied
  in the ingestion pipeline (often paired with Dataflow).
- **Pairing with the pipeline, not bolted on after**: the exam rewards
  designs where DLP de-identification happens *before* sensitive data
  reaches its destination (in-flight, in a Dataflow transform) over
  scanning-and-fixing after the fact — matches the general "shift-left"
  principle used elsewhere in this domain (Org Policy at provisioning
  time, Binary Authorization at deploy time).

### Network security architecture

- **VPC Service Controls (VPC-SC)**: creates a *service perimeter*
  around GCP APIs/resources (not just network routes) — stops data
  exfiltration even by an authenticated identity making calls from
  outside the perimeter, or to the wrong project. This is the answer
  whenever a scenario says "prevent data exfiltration" or "even an
  insider with valid credentials shouldn't be able to copy data out."
- **VPC-SC perimeter bridges**: when two perimeters (e.g. a data
  project and an ML/Vertex AI project) need controlled communication,
  a perimeter bridge allows specific, scoped traffic between them
  without dissolving either perimeter's protection against everything
  else — the answer for "these two secure zones need to talk to each
  other, but nothing else should be able to reach either."
- **Private Google Access** vs **Private Service Connect**: PGA lets
  VM-initiated traffic reach Google APIs without a public IP; PSC
  additionally lets you *publish* your own service for private
  consumption by other VPCs/projects. If the scenario needs the
  reverse direction (someone else consuming your service privately),
  it's PSC, not PGA.
- **Cloud Armor**: Layer-7 protection at the load balancer — WAF rules
  (OWASP Top 10 preconfigured rules), rate limiting, geo-based
  blocking, and DDoS protection. Correct answer whenever a scenario
  mentions application-layer attacks (SQLi, XSS) or "block traffic from
  specific countries."
- **Hierarchical firewall policies** (see Domain 2 §2.1) enforce
  security posture that individual project owners cannot weaken.

### Security Command Center — the posture and threat-detection surface

Security Command Center (SCC) is the security-posture and
threat-detection layer an architect designs the *organization's
visibility* around — distinct from, and complementary to, the
preventive controls above (IAM, DLP, KMS, VPC-SC). Where IAM/KMS/VPC-SC
are controls you *configure*, SCC is what tells you whether those
controls are actually working and what's actively happening across the
environment.

| SCC capability | What it answers | Complementary control (not a substitute) |
|---|---|---|
| Security Health Analytics | "Are our resources misconfigured against known best practices?" (e.g. a bucket with public access, a firewall rule allowing 0.0.0.0/0) | Org Policy prevents some of these by construction; SCC catches what's already deployed or what Org Policy doesn't cover |
| Event Threat Detection | "Is there active malicious behavior right now?" (e.g. anomalous IAM grants, malware communication patterns, crypto-mining signatures) | IAM/firewalls are preventive; Event Threat Detection is the detective control for what got through anyway |
| Web Security Scanner | "Do our public web apps have common vulnerabilities (XSS, outdated libraries)?" | Cloud Armor blocks known attack patterns at the edge; Web Security Scanner finds the underlying vulnerabilities Cloud Armor is compensating for |
| Container/VM threat detection | Runtime threats inside GKE workloads or VMs | Binary Authorization controls what's *allowed to deploy*; SCC's runtime detection covers what happens *after* deployment |
| Asset inventory / attack path simulation | Organization-wide visibility into what resources exist and how a compromised resource could be leveraged toward a sensitive asset | Complements Resource Manager hierarchy planning — shows the *actual* reachability graph, not just the intended one |

**Why SCC belongs in the architecture, not just in operations**: a
scenario asking to "design a security posture management capability
across dozens of projects" or "give the security team a single place
to see misconfigurations and active threats org-wide" is asking for
SCC specifically — IAM, KMS, and DLP are each strong at their one job,
but none of them give you the aggregated, org-wide *visibility* SCC is
built for. SCC is the design-time answer for "how do we know our
controls are working," not a replacement for any single control above.

### Binary Authorization (security design lens)

Binary Authorization is introduced from the provisioning/deploy-time
mechanics angle in Domain 2 §2.3; here it's the **security-design**
framing:

- **What problem it solves**: even a perfectly-configured IAM/network
  perimeter doesn't stop a *legitimately-permissioned* pipeline from
  deploying a compromised or unreviewed image — Binary Authorization
  closes that gap by making image provenance a deploy-time gate,
  independent of who has deploy permission.
- **Attestor design**: each required attestation represents a step in
  the supply chain that must be proven to have happened (e.g. "passed
  vulnerability scan," "built by the CI system, not a laptop," "signed
  off by the security team for this specific release") — a scenario
  describing supply-chain integrity requirements is asking you to map
  each stated control onto an attestor, not just "turn Binary
  Authorization on."
- **Where it sits relative to other controls**: it is the *last* gate,
  at deploy time, after IAM (who can call the deploy API), after image
  scanning in Artifact Registry (does the image have known CVEs), and
  before SCC's runtime detection (what happens once it's running) —
  each of these is a different control for a different point in the
  lifecycle, and a mature design uses all of them together rather than
  treating any one as sufficient on its own.

### Securing AI workloads (2026 focus area — see RUNBOOK §7)

| Concern | Mechanism |
|---|---|
| Vertex AI endpoint exposure | Private endpoints (no public internet path), VPC-SC perimeter around the AI/ML project |
| Prompt/output governance | DLP integration on prompts/outputs, logging for audit, content filtering |
| Third-party AI partner access | Scoped service accounts / Workload Identity Federation, never broad project-level access |
| Training-data protection | CMEK on the underlying Cloud Storage/BigQuery datasets, DLP de-identification before training where PII is present |
| Model supply-chain integrity | Binary Authorization-equivalent controls for model artifacts (attest that a model was trained/validated through an approved pipeline before it's served) |
| Detecting anomalous AI workload behavior | Security Command Center's threat detection extended to the AI/ML project's perimeter — same posture-visibility principle as any other workload, applied to the newer surface area |

### Tradeoffs — security design

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "Prevent an insider with valid IAM permissions from exfiltrating data to a personal project" | VPC Service Controls perimeter | IAM alone, or network firewall rules alone | Neither IAM nor firewalls stop an authenticated API call to the wrong destination project — VPC-SC is purpose-built for exactly this |
| "CI/CD pipeline needs to deploy to GCP" | Workload Identity Federation | A downloaded service-account key stored as a CI secret | Removes a standing credential that can leak; federated tokens are short-lived and scoped |
| "Must control key rotation ourselves but don't need to manage physical HSMs" | CMEK via Cloud KMS | CSEK / external key manager | CSEK/EKM is more operational burden than the requirement calls for — match the control level to what's actually stated |
| "Need org-wide 'no external IPs, ever'" | Organization Policy constraint | Per-project IAM restrictions | IAM can't preemptively forbid a resource *configuration* — Org Policy constraints are the mechanism for that class of rule |
| "Security team wants one place to see misconfigurations and active threats across 50 projects" | Security Command Center | Per-project manual review, or IAM/DLP dashboards alone | Aggregated, org-wide posture visibility is SCC's specific job — no single preventive control gives you that view |
| "Prevent an unreviewed or unscanned image from ever reaching production, even if the deploying pipeline has valid credentials" | Binary Authorization with required attestors | IAM restrictions on the deploy role alone | IAM can't inspect image content or provenance; Binary Authorization is the control that actually gates on *what* is being deployed |
| "Two secure Vertex AI/data perimeters need to exchange a specific dataset" | A VPC-SC perimeter bridge between the two | Dissolving one perimeter, or routing data through the public internet | A bridge allows the specific, scoped exchange without giving up either perimeter's broader protection |

---

## 3.2 Designing for legal compliance

### Regulatory mapping

| Regime | What it typically requires | GCP mechanism |
|---|---|---|
| HIPAA (healthcare — EHR Healthcare case study) | PHI protection, access auditing, BAA with Google | CMEK, Cloud Audit Logs, Access Transparency, restricted API surface, signed BAA (organizational, not architectural, but drives which services are "covered") |
| PCI-DSS (payment card data) | Network segmentation, encryption, strict access control, audit trail | VPC-SC perimeter around cardholder-data scope, CMEK, Cloud Armor, Cloud Audit Logs |
| GDPR (EU personal data) | Data residency/consent, right-to-erasure, breach notification | Regional resource pinning (Org Policy `resourceLocations`), DLP for data discovery, retention policies |
| Data residency/sovereignty (general) | Data must not leave a specified jurisdiction | Org Policy resource-location constraints, regional (not multi-region) storage/compute, Assured Workloads for the strictest regimes |
| FedRAMP / government-aligned regimes | Personnel access restrictions, control-plane data-sovereignty, specific certified regions | Assured Workloads (pre-mapped control package), restricted support-personnel access controls |

### Audit and compliance automation

- **Cloud Audit Logs** (Admin Activity, Data Access, System Event,
  Policy Denied) are the record-of-truth for "who did what" — Admin
  Activity logs are always on and cannot be disabled; Data Access logs
  are opt-in per service due to volume/cost.
- **Access Transparency**: logs *Google's own* administrative access to
  your data — the answer when a compliance requirement is specifically
  about visibility into Google-side access, not customer-side access.
- **Assured Workloads**: wraps a folder with a pre-configured compliance
  regime (control/support restrictions, personnel access controls, data
  residency) — the fastest correct answer for "we need FedRAMP/IL4/etc.
  aligned infrastructure" scenarios, versus hand-assembling the
  equivalent controls yourself.
- **Compliance automation via Security Command Center**: SCC's
  Security Health Analytics findings can be mapped to specific
  compliance benchmarks — the automated, continuous version of
  "prove our controls are still in place" for an audit, rather than a
  point-in-time manual review each audit cycle.
- **Policy-as-code for compliance drift prevention**: the same
  Org-Policy-as-code / Config Validator pattern from Domain 2 §2.1
  applies here — a compliance requirement expressed as an Org Policy
  constraint enforced in the provisioning pipeline prevents drift
  *before* an audit finds it, which is the difference between
  continuous compliance and a once-a-year scramble.

### Compliance mapping table (regime → control layer)

| Compliance goal | Identity layer | Data layer | Network layer | Audit layer |
|---|---|---|---|---|
| PHI protection (HIPAA) | Least-privilege IAM, groups not individuals | CMEK on all PHI-containing storage, DLP scanning | VPC-SC perimeter around the PHI-handling project(s) | Data Access audit logs enabled, retained per policy |
| Cardholder data (PCI-DSS) | Scoped service accounts, no primitive roles | CMEK, tokenization via DLP where feasible | VPC-SC + Cloud Armor at the edge, network segmentation | Full audit trail, Bucket-Locked retention for logs |
| EU personal data (GDPR) | Standard least-privilege | DLP for discovery/classification, retention policies for erasure requests | Regional (EU) resource pinning via Org Policy | Access Transparency for Google-side visibility |
| Government/regulated workloads | Personnel-access-restricted (Assured Workloads) | CMEK, region-pinned | VPC-SC, restricted support | Assured Workloads' built-in compliance reporting |

### Tradeoffs — legal compliance

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "We need a fast, pre-validated path to a named compliance regime (FedRAMP, IL4, etc.)" | Assured Workloads | Manually assembling equivalent Org Policy/IAM controls | Assured Workloads is purpose-built and pre-mapped to the regime's requirements — faster and more defensible in audit |
| "We need to prove even Google support engineers didn't access our data without cause" | Access Transparency | Cloud Audit Logs alone | Audit Logs cover *your* users' actions; Access Transparency specifically covers Google-side access |
| "Data must never leave the EU" | Regional (EU) resources + Org Policy resource-location constraint | Multi-region or global default resources | Multi-region/global resources can place data outside the required jurisdiction unless explicitly pinned |
| "Auditors want continuous evidence our controls are working, not a once-a-year manual review" | Security Command Center findings mapped to compliance benchmarks + policy-as-code drift prevention | A manual annual compliance review | Continuous, automated evidence is stronger in audit and catches drift immediately instead of a year later |

---

## Production architecture pattern: zero-trust perimeter

```
                         Internet
                            │
                            ▼
                  ┌──────────────────┐
                  │   Cloud Armor     │  ◄── L7 WAF, rate limiting,
                  │  (edge policy)    │      geo-blocking
                  └────────┬──────────┘
                            ▼
                  ┌──────────────────┐
                  │  Global External  │
                  │  App LB (HTTPS)   │
                  └────────┬──────────┘
                            ▼
        ┌───────────────────────────────────────┐
        │      VPC Service Controls Perimeter     │
        │  ┌─────────────┐   ┌─────────────────┐ │
        │  │ GKE Autopilot│   │  Vertex AI       │ │
        │  │ (app tier,   │   │  (private        │ │
        │  │  Workload    │   │  endpoint only,   │ │
        │  │  Identity)   │   │  Binary Auth on   │ │
        │  │  Binary Auth │   │  served models)   │ │
        │  │  gated)      │   └────────┬─────────┘ │
        │  └──────┬───────┘            │           │
        │         ▼                    ▼           │
        │  ┌─────────────┐   ┌─────────────────┐ │
        │  │ Cloud SQL /  │   │  Cloud Storage   │ │
        │  │ AlloyDB      │   │  (CMEK, DLP      │ │
        │  │ (CMEK,       │   │   scan on        │ │
        │  │  private IP  │   │   ingest)        │ │
        │  │  only)       │   └─────────────────┘ │
        │  └─────────────┘                        │
        └───────────────────────────────────────┘
                            │
                  All identities via Workload
                  Identity Federation — zero
                  exported service-account keys
                            │
                  Security Command Center watches
                  the whole perimeter for posture
                  drift and active threats
                            │
                  Cloud Audit Logs + Access
                  Transparency → central
                  Shared-Services log sink
```

**Why this shape:** every data-plane resource sits inside one VPC-SC
perimeter (stops exfiltration even from a compromised/over-permissioned
identity), every credential is federated rather than a static key,
CMEK/DLP are applied at the storage layer rather than left to
service-level defaults, Binary Authorization gates what's allowed to
run in both the app and model-serving tiers, and Security Command
Center provides the continuous posture/threat visibility across the
whole thing — this is the composite answer to "design the most
defensible version of this system" questions.

---

## Production architecture pattern: defense in depth, layer by layer

A second lens on the same idea — mapping each control to the specific
threat it stops, useful for questions that ask "which control addresses
this specific attack/failure scenario" rather than "design the whole
system":

```
 Layer 1 — Edge / perimeter
   Cloud Armor (blocks L7 attacks, DDoS, bad geos)
   → stops: application-layer attacks before they reach compute

 Layer 2 — Identity
   IAM (least privilege) + Workload Identity Federation (no static keys)
   + IAM Conditions (time/attribute-bound access)
   → stops: over-privileged or stolen standing credentials

 Layer 3 — Network segmentation
   VPC-SC perimeter + hierarchical firewall policies + Private
   Service Connect (no unnecessary network exposure)
   → stops: lateral movement and data exfiltration to the wrong
     destination, even by an authenticated identity

 Layer 4 — Supply chain
   Binary Authorization (only attested images run) + Artifact
   Registry vulnerability scanning
   → stops: compromised or unreviewed code from ever executing

 Layer 5 — Data
   CMEK (customer-controlled key lifecycle) + DLP (classify/redact
   sensitive data) + Secret Manager (no secrets in code/config)
   → stops: data exposure even if an earlier layer is bypassed

 Layer 6 — Detection and audit
   Security Command Center (posture + active threat detection)
   + Cloud Audit Logs + Access Transparency
   → stops: nothing directly — this is the layer that tells you
     when the layers above were tested or bypassed, and provides
     the audit trail compliance regimes require
```

**Why this shape:** no single layer is assumed sufficient — this is
the mental model behind almost every "which control should we add"
scenario question in Domain 3: identify which layer the described gap
sits in, then pick the control purpose-built for that layer rather than
reaching for whichever service was mentioned most recently in the
question.

---

## Domain 3-specific exam traps

1. Reaching for IAM to *restrict* something IAM structurally cannot
   restrict (a configuration choice, a resource location) — that's
   always an Org Policy question.
2. Treating encryption-at-rest as something that needs to be "added" —
   it's on by default; only CMEK/CSEK/EKM are things you actively
   design for, and only when the scenario asks for more control than
   the default.
3. Confusing VPC-SC (stops exfiltration via API calls to the wrong
   destination) with firewall rules (control network-layer traffic) —
   they solve different threats and a question can require both without
   either substituting for the other.
4. Picking a service-account key file as the answer whenever the
   scenario doesn't explicitly rule out federation — Workload Identity
   Federation should be the reflexive first answer for any
   external/CI/CD credential scenario in 2026-era material.
5. Confusing Security Command Center (posture/threat *visibility*
   across the environment) with a preventive control like IAM or
   VPC-SC — a question asking "how do we know if a misconfiguration
   exists" wants SCC; a question asking "how do we prevent the
   misconfiguration in the first place" wants Org Policy or a
   provisioning-time policy-as-code gate. SCC finds problems, it
   doesn't by itself prevent them from being created.
6. Treating Binary Authorization as an IAM substitute — it never
   answers "who can deploy," only "what images are allowed to run."
   A question combining both concerns (a bad actor with legitimate
   deploy permission pushing a malicious image) needs both controls
   named in the answer, not one standing in for the other.
7. Over-answering a compliance question with the strictest available
   control (Assured Workloads, CSEK) when the scenario's stated regime
   doesn't require that level — match the control to what's actually
   named, the same "don't over-engineer" principle from Domain 1 §1.5
   applies to security controls too.
