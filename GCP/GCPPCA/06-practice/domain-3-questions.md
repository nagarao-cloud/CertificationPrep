# Practice Questions — Domain 3: Security and Compliance (~20% weight)

> 20 questions, every option explained.

---

**Q1.** A scenario requires that no project admin, anywhere in the
organization, be able to enable external IPs on Compute Engine
instances, even if they hold the Owner role. What mechanism achieves
this?

A. An IAM Deny policy scoped to individual users
B. An Organization Policy constraint (`compute.vmExternalIpAccess`) applied at the org level
C. A per-project firewall rule
D. Removing all Owner role bindings organization-wide

**Answer: B.** Org Policy constraints are enforced below IAM and
cannot be overridden by a lower-level admin, including one holding
Owner (Domain 3 §3.1). A is not the standard mechanism for this class
of blanket configuration rule. C controls traffic, not whether the
configuration (external IP) can exist at all. D is impractical and
doesn't actually prevent the configuration — it just removes an
unrelated permission.

---

**Q2.** Which credential mechanism should a CI/CD pipeline use to
deploy to GCP, per 2026-era best practice?

A. A downloaded service-account JSON key stored as a CI secret
B. Workload Identity Federation
C. The pipeline operator's personal user credentials
D. A shared service account key emailed between team members

**Answer: B.** No exported, long-lived credential; short-lived,
scoped tokens exchanged from the CI platform's own identity (Domain 3
§3.1). A, C, and D are all static/shared-credential anti-patterns the
exam's 2026-era material explicitly steers away from.

---

**Q3.** A scenario requires preventing an authenticated user with valid
IAM permissions from copying sensitive data to an unauthorized external
project. What's the correct control?

A. IAM alone
B. VPC Service Controls perimeter around the sensitive data's services
C. A stronger password policy
D. Firewall rules blocking all outbound traffic

**Answer: B.** This is the textbook VPC-SC scenario — stopping
exfiltration even by a valid, authenticated identity calling the wrong
destination (Domain 3 §3.1). A doesn't address this threat model
(IAM already permitted the access). C is irrelevant to this threat
(the user is already authenticated). D would break legitimate outbound
traffic and doesn't address API-level exfiltration paths anyway.

---

**Q4.** Which encryption option should be chosen when a scenario states
"we must rotate our own encryption keys but don't want to manage
physical hardware security modules ourselves"?

A. Google-managed encryption keys (default)
B. Customer-Managed Encryption Keys (CMEK) via Cloud KMS
C. Cloud EKM (External Key Manager)
D. Customer-Supplied Encryption Keys (CSEK) for every operation

**Answer: B.** CMEK gives the customer key lifecycle control
(rotation, IAM, destroy) while Google still hosts the backend — matches
"rotate our own keys" without "manage physical HSMs" (Domain 3 §3.1).
A is wrong (no customer control over rotation). C is wrong (EKM is for
"key material must never touch Google" — a stronger, unrequested
requirement here). D is wrong (higher operational burden than CMEK
without a stated need for it).

---

**Q5.** What is the correct compliance mechanism for "we need
FedRAMP-aligned infrastructure as fast as possible"?

A. Manually assembling equivalent IAM and Org Policy controls from scratch
B. Assured Workloads
C. Relying on Google-managed encryption keys alone
D. A stronger firewall policy

**Answer: B.** Assured Workloads wraps a folder with a pre-mapped
compliance regime, the fastest defensible path (Domain 3 §3.2). A is
slower and harder to prove compliant in an audit. C and D don't address
the compliance-framework mapping requirement at all.

---

**Q6.** A HIPAA-bound scenario asks how to prove that even Google
support personnel didn't access patient data without cause. What
provides this specific visibility?

A. Cloud Audit Logs (Admin Activity)
B. Access Transparency
C. VPC Service Controls
D. IAM Conditions

**Answer: B.** Access Transparency specifically logs Google-side
personnel access, distinct from customer-side activity logs (Domain 3
§3.2). A logs customer actions, not Google's. C and D address
different threat models entirely (network/API exfiltration and
conditional access, respectively).

---

**Q7.** Which role type should generally be preferred for a new IAM
binding, absent a stated reason otherwise?

A. Primitive roles (Owner/Editor/Viewer)
B. Predefined roles scoped to the specific service/task
C. Custom roles, created for every binding by default
D. No role — grant access via firewall rules instead

**Answer: B.** Domain 3 §3.1's stated preference order: predefined >
primitive > custom (used sparingly for gaps). A is almost always wrong
(too broad — least-privilege violation). C is wrong (unnecessary
maintenance burden when a predefined role already fits). D is a
category error — firewall rules don't grant IAM-level permissions.

---

**Q8.** A GKE pod needs to call a GCP API. What is the recommended
authentication pattern?

A. Mount a service-account JSON key file into the pod
B. Use Workload Identity to bind a Kubernetes ServiceAccount to a GCP service account
C. Hard-code an API key in the application source code
D. Use the node's default service account with broad project-level permissions

**Answer: B.** Workload Identity is the GKE-specific instance of the
"no static keys" principle (Domain 3 §3.1, demonstrated in Lab 3). A
and C are static-credential anti-patterns. D violates least privilege —
broad node-level default credentials shared across all pods is a
known GKE security anti-pattern.

---

**Q9.** What's the correct tool for discovering and de-identifying PII
in a dataset before it's used to train a Vertex AI model?

A. Cloud Armor
B. Cloud DLP (Sensitive Data Protection)
C. VPC Service Controls
D. Cloud NAT

**Answer: B.** DLP is purpose-built for discovering/de-identifying
sensitive data, the pre-training-data-cleanup step for Securing AI
scenarios (Domain 3 §3.1). A is an edge WAF/DDoS tool, unrelated. C
controls exfiltration boundaries, not data content. D is unrelated to
data classification entirely.

---

**Q10.** Which best describes the difference between IAM and
Organization Policy, as tested on the exam?

A. They are the same mechanism with different names
B. IAM controls who can do what; Organization Policy controls what configurations are allowed to exist at all, enforced below IAM
C. Organization Policy only applies to networking resources
D. IAM is enforced below Organization Policy

**Answer: B.** Matches Domain 3 §3.1's core distinction exactly
(`03-comparisons/06-iam-security-models.md`). A conflates two distinct
mechanisms. C is too narrow — Org Policy spans many resource types
(locations, IAM key creation, etc.), not just networking. D reverses
the actual enforcement order.

---

**Q11.** A scenario needs to publish an internal API for private
consumption by another business unit's VPC, with minimal network
exposure. What should be used?

A. Full VPC Peering
B. Private Service Connect
C. A public endpoint secured with an API key
D. VPC Service Controls alone, with no other network configuration

**Answer: B.** Matches the networking/security crossover in Domain 3
§3.1 and `02-services/03-networking.md` — publishes exactly one
service, minimal blast radius. A over-exposes the network. C exposes
the API publicly, contradicting "minimal exposure." D doesn't actually
provide the connectivity mechanism needed; VPC-SC is about exfiltration
prevention, not the access-publishing mechanism itself.

---

**Q12.** Which logging category is always enabled and cannot be
disabled?

A. Data Access logs
B. Admin Activity logs
C. Custom application logs
D. VPC Flow Logs

**Answer: B.** Admin Activity logs are always on per Domain 3 §3.1/
`02-services/04-security-iam.md`. A is opt-in per service due to
volume/cost. C is application-dependent, not a GCP-enforced default.
D is a separate, explicitly-enabled networking feature, not part of
Cloud Audit Logs' always-on set.

---

**Q13.** A scenario states EU customer data must never leave EU
jurisdiction. Which combination correctly enforces this?

A. IAM roles restricting EU-based staff only
B. Regional (EU) resources + an Organization Policy resource-location constraint
C. A firewall rule blocking non-EU traffic
D. Labeling resources `region:eu` for tracking purposes

**Answer: B.** Matches Domain 3 §3.2 and the EHR Healthcare case
study's core lesson — Org Policy enforces the residency boundary at
the infrastructure level; regional resource placement avoids
multi-region replication crossing the boundary. A, C, and D each fail
to actually prevent data from residing outside the EU (see Q2 in
Domain 1's question set for the same reasoning pattern).

---

**Q14.** Why is a scenario answer that uses a service-account key file
for a Vertex AI partner integration likely wrong in 2026-era PCA
material?

A. Vertex AI does not support service accounts at all
B. Workload Identity Federation is the preferred, keyless pattern for external/partner access, avoiding a long-lived exported credential
C. Service-account keys are technically impossible to create
D. Partner integrations must always use human user credentials

**Answer: B.** Matches Domain 3 §3.1's Securing AI guidance and the
2026 currency correction in RUNBOOK §7. A and C are factually false.
D is not the stated best practice — federated *workload* identity, not
human credentials, is the standard for automated partner integrations.

---

**Q15.** Which is the correct purpose of a VPC Service Controls
"dry-run" mode?

A. Permanently disables the perimeter
B. Tests perimeter rules against real traffic without enforcing them, to safely validate rules before rollout
C. Only usable in non-production projects
D. Automatically fixes any misconfigured rule

**Answer: B.** Matches `02-services/04-security-iam.md`'s VPC-SC
section — the safe rollout method for introducing a perimeter without
breaking production traffic. A misdescribes dry-run as permanent
disablement. C is an overstatement — dry-run works regardless of
environment type. D is false — it observes and reports, it doesn't
auto-remediate.

---

**Q16.** A scenario says "sensitive data must be tokenized so
downstream analytics systems can still join records by the same
customer consistently, without exposing the real identifier." Which
DLP technique fits?

A. Full redaction
B. Tokenization
C. Deletion of the field entirely
D. Leaving the field in plaintext but restricting IAM access to the table

**Answer: B.** Tokenization preserves a consistent, non-reversible-
without-the-key identifier for joins while hiding the real value
(Domain 3 §3.1/`02-services/04-security-iam.md`). A removes the value
entirely, breaking the stated join requirement. C also breaks the join
requirement. D doesn't satisfy "must be tokenized" — it leaves the real
value in the data itself, just access-controlled, which is a different
(weaker, for this requirement) control.

---

**Q17.** Which statement about IAM Conditions vs. Organization Policy
is most accurate for exam purposes?

A. They are interchangeable in every scenario
B. IAM Conditions suit narrow, often temporary/attribute-based exceptions; Organization Policy suits blanket, org-wide rules with no exceptions
C. IAM Conditions are enforced below Organization Policy
D. Organization Policy cannot express allow/deny lists

**Answer: B.** Matches Domain 3 exam trap #1 exactly — prefer the
simpler mechanism (Org Policy) for a blanket rule, and reserve IAM
Conditions for genuinely narrow exceptions. A oversimplifies — using
the wrong one for the wrong shape of requirement is a common exam
trap. C reverses the actual enforcement order. D is factually wrong —
list constraints are exactly Org Policy's allow/deny mechanism.

---

**Q18.** What's the correct compliance-logging answer for "we must
retain audit logs immutably for 7 years"?

A. Rely on Cloud Logging's default retention settings
B. Sink to Cloud Storage with a retention policy / Bucket Lock configured for the required duration
C. Export logs to a spreadsheet manually each month
D. Disable Data Access logs to reduce storage needs

**Answer: B.** Matches `02-services/06-management-operations.md` — a
durable-archive requirement needs an explicit Cloud Storage sink with
retention policy/Bucket Lock, not native Cloud Logging retention. A is
wrong (default retention windows are time-limited, not built for
multi-year immutable compliance archives). C is impractical and not a
real GCP mechanism. D is directly counter to a "retain logs" compliance
requirement.

---

**Q19.** Which best matches the intended use of Cloud Armor in a
security architecture?

A. Encrypting data at rest
B. Edge-level L7 protection: WAF rules, rate limiting, geo-blocking, DDoS mitigation, attached to external load balancers
C. Managing IAM role bindings
D. Rotating Cloud KMS keys

**Answer: B.** Matches `02-services/03-networking.md`'s Cloud Armor
section. A, C, and D each describe an unrelated GCP capability (KMS/
encryption, IAM, and key rotation respectively) that Cloud Armor does
not perform.

---

**Q20.** A scenario requires that Vertex AI model endpoints for a
sensitive healthcare use case never be reachable from the public
internet. What combination is correct?

A. Public endpoint + strong password
B. Private Vertex AI endpoint within a VPC-SC perimeter
C. Public endpoint + Cloud Armor only
D. No endpoint at all — batch prediction exclusively, regardless of the stated need for real-time serving

**Answer: B.** Matches the Securing AI pattern in Domain 3 §3.1 and
the zero-trust perimeter architecture — private endpoint plus a
VPC-SC perimeter is the combination that fully removes public-internet
reachability while still allowing appropriately-scoped internal access.
A and C still expose a public endpoint, directly contradicting the
requirement regardless of other protections layered on top. D ignores
the application's actual real-time serving need in favor of an
unrequested architecture change — not what the scenario asked for.
