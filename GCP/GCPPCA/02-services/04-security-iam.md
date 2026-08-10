# Security & IAM Services Reference

> Design guidance and tradeoffs: Domain 3 (`01-domains/DOMAIN-3-security-compliance.md`).
> This file is per-service configuration depth. Comparison table:
> `03-comparisons/06-iam-security-models.md`. Every service below
> follows the same checklist: purpose, when to use, when **not** to
> use (paired with the alternative that wins instead), configuration
> surface, cost, performance, scaling, security, HA/failure behavior,
> common mistakes, and exam scenario cues.
>
> **Binary Authorization** (container image attestation/signing
> enforced at GKE/Cloud Run deploy time) is covered in full in
> `02-services/07-devops-cicd.md`'s own section — it's placed there
> because it's fundamentally a deploy-pipeline control, and this
> folder covers each service once. It complements every control in
> this file (IAM governs *who* can deploy; Binary Authorization governs
> *what* — specifically, whether the image itself is trusted — can be
> deployed) and is cross-referenced from the relevant sections below.

## Contents

- [IAM](#iam)
- [Service Accounts & Workload Identity Federation](#service-accounts--workload-identity-federation)
- [Organization Policy Service](#organization-policy-service)
- [Cloud KMS](#cloud-kms)
- [Secret Manager](#secret-manager)
- [Cloud DLP (Sensitive Data Protection)](#cloud-dlp-sensitive-data-protection)
- [VPC Service Controls](#vpc-service-controls)
- [Cloud Audit Logs & Access Transparency](#cloud-audit-logs--access-transparency)
- [Assured Workloads](#assured-workloads)
- [Security Command Center](#security-command-center)

---

## IAM

**Purpose:** additive-only access control, applied across the
resource hierarchy (Organization → Folder → Project → Resource), with
inheritance flowing downward and unioning (never subtracting) at each
level.

**When to use:** every access-control decision in GCP starts here —
IAM is the baseline identity/permission layer every other security
service in this file complements rather than replaces.

**When NOT to use as the sole control — pair with something else
instead:**
- A blanket, org-wide "never allow this regardless of any grant" rule
  → **Org Policy** (constraint-based, enforced below IAM) or an
  **IAM Deny policy**, not a discipline of "just don't grant it" —
  relying on grant hygiene alone doesn't scale and doesn't survive a
  future admin's mistake.
- Fine-grained, resource-configuration-level restrictions (e.g. "no
  VM may ever get an external IP," "resources may only be created in
  these regions") → **Org Policy** — IAM controls *who* can act, not
  *what configurations are possible*; conflating the two is a common
  exam trap.
- Detecting whether current grants are actually appropriate/least-
  privilege at any given moment → **Security Command Center's IAM
  Recommender findings** (below) and the Recommender API
  (`06-management-operations.md`) — IAM itself has no built-in
  "audit my own grants for excess privilege" feature; that's a
  separate posture-management layer.

**Key configuration surface:**
- **Role types**: primitive (Owner/Editor/Viewer — broad, rarely the
  correct exam answer), predefined (Google-maintained, scoped to a
  service or task — the default preference), custom (user-defined for
  gaps predefined roles don't cover — maintenance burden, use
  sparingly).
- **Principals**: Google accounts, groups (preferred over individual
  user bindings for maintainability), service accounts, and
  Google-managed/external identities via Workload Identity Federation.
- **IAM Conditions**: attribute-based conditional bindings (e.g. time-
  bound access, resource-type restrictions) — useful for narrow,
  temporary exceptions; prefer a simpler Org Policy or resource-
  hierarchy fix when the requirement is a blanket rule rather than a
  conditional exception (see Domain 3 exam trap #1).
- **IAM Deny policies**: a narrower, explicit-deny mechanism layered on
  top of the additive grant model — used for org-wide "never allow this
  regardless of any grant" guardrails, not routine least-privilege
  design.

**Pricing / cost considerations:** IAM itself carries no direct
service cost; the cost impact is indirect — over-broad grants are a
*risk* cost (blast radius of a compromised credential), and custom
roles carry an ongoing maintenance cost (keeping permission lists
current as GCP's API surface evolves).

**Performance characteristics:** policy evaluation happens
transparently on every API call with negligible added latency; not a
performance-tuning surface in the way compute/storage services are.

**Scaling behavior:** the resource hierarchy (Org → Folder → Project
→ Resource) is the mechanism for scaling access management across a
large organization — grouping principals and binding roles at the
folder level (not per-project, per-principal) is what keeps IAM
administration tractable as an organization grows.

**Security posture:** groups over individual bindings, predefined
over custom roles, and least-privilege scoping at the narrowest
resource level that satisfies the requirement are the three
recurring exam-correct defaults.

**HA / failure-mode behavior:** IAM is a global, highly available
control-plane service with no customer-facing failover configuration
— an outage here is a Google-side incident, not a design
consideration for this exam.

**Common mistakes / misconfigurations:**
- Granting primitive roles (Editor/Owner) out of convenience instead
  of scoped predefined roles.
- Binding roles to individual users instead of groups, creating
  unmaintainable per-person grant sprawl.
- Reaching for an IAM Condition to express what is actually a
  blanket organizational rule better served by Org Policy.
- Assuming IAM alone prevents a misconfiguration (e.g. a public
  bucket) that Org Policy is the actual control for.

**Common exam scenario cues:** "least privilege," "who can access
what," "centralize permission management across many projects" →
folder-level group bindings; "a rule that must never be violated
regardless of any future grant" → Org Policy/Deny policy, not IAM
hygiene alone.

---

## Service Accounts & Workload Identity Federation

**Purpose:** non-human identity and cross-environment authentication
for workloads calling GCP APIs.

**When to use:**
- **Service accounts**: any workload (VM, container, function,
  pipeline) that calls GCP APIs needs an identity distinct from any
  human operator's.
- **Workload Identity Federation**: any external identity provider
  (AWS IAM, Azure AD, a CI/CD platform's OIDC issuer, on-prem
  identity) needs to obtain GCP credentials without Google ever
  issuing/storing a long-lived static key for it.

**When NOT to use — use something else instead:**
- A human operator's personal, interactive access → **the human's own
  IAM identity** (Google account/group membership), not a shared
  service account impersonated by multiple people — shared credential
  use defeats auditability.
- A workload running *inside* GCP that needs to call GCP APIs and
  could use Workload Identity/Workload Identity Federation → **do not
  export a service account key file** — an exported JSON key is a
  static, long-lived credential and the exam's default-wrong answer
  whenever a keyless alternative exists.

**Key configuration surface:**
- **Service accounts**: non-human identities for workloads calling GCP
  APIs. Each has its own IAM bindings, distinct from the identities of
  humans who can *act as* it (`roles/iam.serviceAccountUser` /
  `serviceAccountTokenCreator`).
- **Exported keys (JSON files)**: a static, long-lived credential —
  security anti-pattern when a keyless alternative exists; the exam's
  default-correct answer avoids these whenever the scenario allows.
- **Workload Identity Federation**: lets an external identity provider
  (AWS IAM, Azure AD, a CI/CD platform's OIDC issuer, on-prem
  identity) exchange its own token for short-lived GCP credentials —
  no exported key ever created or stored. The 2026-era default answer
  for CI/CD-to-GCP and cross-cloud workload authentication.
- **Workload Identity (GKE-specific)**: binds a Kubernetes
  ServiceAccount to a GCP service account so pods authenticate to GCP
  APIs without mounted key files — the GKE-specific instance of the
  same "no static keys" principle.

**Pricing / cost considerations:** no direct service cost; the cost
argument is entirely risk-based — an exported, leaked static key has
unbounded blast radius until manually revoked, while a short-lived
federated credential naturally expires, bounding exposure.

**Performance characteristics:** federated token exchange adds a
small, one-time latency cost at credential-acquisition time (not
per-API-call) — negligible relative to the security benefit.

**Scaling behavior:** Workload Identity Federation scales cleanly
across many external workloads/pipelines without a proliferating
count of exported keys to rotate and track — the operational
scaling argument for choosing it over key-file distribution as an
organization's number of external integrations grows.

**Security posture:** the entire point of this section — this is the
exam's model answer for "no static long-lived credentials," and a
scenario describing key files checked into source control, shared
across environments, or manually rotated is describing exactly the
anti-pattern this replaces.

**HA / failure-mode behavior:** short-lived credentials mean a
compromised token self-expires quickly, bounding the blast radius of
an incident far better than a long-lived exported key would — a
direct security-availability tradeoff worth naming when a scenario
asks "what happens if this credential leaks."

**Common mistakes / misconfigurations:**
- Exporting and distributing a service account key file when
  Workload Identity Federation was available.
- Granting broad IAM roles to a service account used by a
  narrow-purpose pipeline (violates least privilege even without a
  key-export problem).
- Forgetting to configure GKE Workload Identity, leaving pods to fall
  back on a mounted key or an overly broad node-level service account.

**Common exam scenario cues:** "CI/CD pipeline needs to deploy to
GCP," "external system in another cloud needs GCP access," "avoid
static/long-lived credentials," "pods need to call GCP APIs without
mounted key files."

---

## Organization Policy Service

**Purpose:** constraint-based guardrails enforced **below** IAM —
restricts what configurations are possible regardless of what an IAM
grant would otherwise permit.

**When to use:** any org-wide rule about *what configurations are
allowed to exist* (not who can create them) — data residency, no
external IPs, no service account key creation, allowed VM images,
etc.

**When NOT to use — use something else instead:**
- A rule about *who* can perform an action rather than *what
  configuration* is allowed → **IAM**, not Org Policy — Org Policy
  constrains configuration surface, it doesn't grant/revoke action
  permissions to specific principals.
- A narrow, temporary exception scoped to specific conditions (a
  contractor needs elevated access for two weeks) → **an IAM
  Condition**, not a loosened Org Policy constraint — loosening an
  org-wide guardrail for one temporary case widens the blast radius
  for everyone, not just the intended exception.

**Key configuration surface:**
- **Constraint types**: boolean (on/off, e.g. "disable service account
  key creation"), list (allow/deny specific values, e.g. allowed
  resource locations or allowed VM external IPs), and custom
  constraints (org-specific rules beyond the built-in catalog).
- **Inheritance**: applied at Org/Folder/Project; a lower level can
  *tighten* an inherited constraint but never loosen one set above it
  (unless the constraint explicitly allows override, which most
  security-relevant ones don't).
- **Common exam-relevant constraints**: `constraints/compute.vmExternalIpAccess`
  (deny external IPs), `constraints/gcp.resourceLocations` (data
  residency enforcement), `constraints/iam.disableServiceAccountKeyCreation`
  (force Workload Identity Federation adoption org-wide).

**Pricing / cost considerations:** no direct service cost; the value
is entirely preventive — blocking a costly or non-compliant
configuration from ever being created is cheaper than remediating it
after the fact.

**Performance characteristics:** constraint evaluation happens at
resource-creation/update time with negligible added latency; not a
runtime performance factor.

**Scaling behavior:** setting a constraint once at the org or folder
level automatically governs every project underneath — the mechanism
that lets a security team enforce a guardrail across an
arbitrarily large and growing project count without per-project
manual review.

**Security posture:** the primary "prevent, not just detect"
guardrail layer in this file — Security Command Center (below)
*detects* when something has drifted from a desired posture; Org
Policy *prevents* the drift from being possible in the first place.
The two are complementary, not redundant.

**HA / failure-mode behavior:** a global, highly available
control-plane service like IAM — no customer-facing failover
configuration.

**Common mistakes / misconfigurations:**
- Relying on IAM grant hygiene alone for a rule that should be a hard
  Org Policy constraint (e.g. hoping nobody grants an external IP,
  instead of blocking external IPs entirely).
- Setting a constraint at the project level when it was meant to be
  an org-wide guardrail, leaving other projects unprotected.
- Assuming a lower level can loosen an inherited constraint when the
  constraint doesn't support override.

**Common exam scenario cues:** "no VM may ever have an external IP,
regardless of who requests it," "enforce data residency in a specific
region for all resources," "force elimination of service account key
creation org-wide."

---

## Cloud KMS

**Purpose:** managed key management — the mechanism behind CMEK.

**When to use:** any workload needing customer-managed encryption
keys (CMEK) for at-rest data, envelope encryption for application-
level secrets, or a compliance requirement specifying key custody/
rotation control beyond Google's default encryption.

**When NOT to use — use something else instead:**
- A scenario with no stated compliance/control requirement beyond
  "encrypted at rest" → **Google's default encryption** (already
  applied to every GCP storage service without any KMS configuration)
  — introducing CMEK adds operational overhead (key rotation policy,
  IAM on keys) that isn't justified without a specific driver.
- Application secrets (API keys, credentials, certificates) that need
  versioned storage and simple retrieval, not cryptographic key
  material itself → **Secret Manager** — KMS manages *keys*, not
  arbitrary secret values (though Secret Manager can use KMS-backed
  encryption under the hood).
- A requirement that key material must never be held by Google even
  transiently → **Cloud EKM**, not standard Cloud KMS — standard Cloud
  KMS keys (software- or HSM-backed) are still generated/held within
  Google's infrastructure.

**Key configuration surface:**
- **Key rings and keys**: regional or global (multi-region) key rings;
  keys inside have versions, supporting rotation without re-encrypting
  existing data (envelope encryption handles the version transition).
- **Automatic rotation**: schedule-based key version rotation; old
  versions remain available for decrypting previously-encrypted data.
- **Cloud HSM**: keys backed by a FIPS 140-2 Level 3 validated hardware
  security module — the answer when a compliance regime specifically
  requires HSM-backed keys, versus standard software-backed Cloud KMS
  keys.
- **Cloud EKM (External Key Manager)**: keys held entirely outside
  Google's infrastructure, referenced at encrypt/decrypt time — highest
  operational burden and control, only correct when a scenario states
  key material must never be held by Google at all (distinct from
  CSEK, which is customer-supplied but still processed by Google
  transiently).

**Pricing / cost considerations:** billed on active key versions plus
cryptographic operations performed — Cloud HSM keys cost more than
software-backed keys, reflecting the dedicated hardware; EKM adds the
cost/operational overhead of running external key-management
infrastructure, the most expensive option in this hierarchy.

**Performance characteristics:** encrypt/decrypt operations add
minimal latency for software/HSM-backed keys; EKM adds a network
round-trip to the external key manager on every operation, a
materially different (and worse) latency profile worth naming
explicitly if a scenario proposes EKM for a latency-sensitive
workload without a stated key-custody requirement forcing that
choice.

**Scaling behavior:** key operations scale transparently with usage;
key rotation schedules are the operational scaling concern (ensuring
rotation cadence matches the compliance requirement without breaking
in-flight decrypt operations against older versions).

**Security posture:** the core secrets/encryption-key control in this
file — CMEK gives customer control over key lifecycle/rotation/
revocation, layered on top of Google's default at-rest encryption,
which is always present regardless of CMEK use.

**HA / failure-mode behavior:** regional key rings are scoped to a
single region's fault domain; a multi-region design needing
cross-region key availability should use a multi-region key ring or
replicate key management deliberately, mirroring the same
region-scoping consideration as any other regional GCP resource.

**Common mistakes / misconfigurations:** introducing CMEK/HSM/EKM
complexity without a stated compliance driver; losing track of key
rotation such that very old key versions become a long-lived
liability; proposing EKM for a workload where the actual requirement
is satisfied by HSM-backed standard Cloud KMS, adding unnecessary
latency and operational burden.

**Common exam scenario cues:** "customer-managed encryption keys
(CMEK)," "FIPS 140-2 Level 3 / HSM-backed key requirement," "key
material must never be held by Google" → EKM specifically.

---

## Secret Manager

**Purpose:** versioned, IAM-scoped storage for application secrets
(API keys, credentials, certificates).

**When to use:** any application secret currently living in
environment variables, config files, or source control — the
"secrets sprawl" pattern this service exists to eliminate.

**When NOT to use — use something else instead:**
- Cryptographic key material used for encrypt/decrypt operations
  rather than an opaque secret value an application reads → **Cloud
  KMS**, not Secret Manager — the two are complementary (Secret
  Manager can itself be encrypted using a CMEK from KMS), not
  interchangeable.
- Large binary artifacts or structured configuration data beyond a
  small secret value → **Cloud Storage with appropriate IAM**, not
  Secret Manager, which is sized and priced for small, discrete
  secret values, not general-purpose object storage.

**Key configuration surface:**
- **Versioning**: each update creates a new version; applications
  reference a specific version or `latest` — supports safe rotation
  with rollback.
- **IAM-scoped access**: per-secret bindings, auditable via Cloud Audit
  Logs — the answer whenever a scenario describes secrets currently
  living in environment variables, config files, or source control
  ("secrets sprawl" is the tell).
- **Automatic replication vs. user-managed replication**: automatic
  (Google chooses regions) for simplicity, user-managed (you pick
  specific regions) when data residency requirements apply to the
  secret material itself.

**Pricing / cost considerations:** billed per active secret version
plus access operations — low absolute cost relative to the risk
reduction of eliminating secrets sprawl; a large number of unused old
versions is a minor, avoidable cost (and audit-noise) accumulation.

**Performance characteristics:** low-latency retrieval suited to
application startup/runtime secret fetching; not a bottleneck in
typical usage patterns.

**Scaling behavior:** scales transparently with secret count and
access volume; no capacity to provision.

**Security posture:** per-secret IAM bindings (not a single
all-secrets grant) keep access scoped to exactly the services that
need a given secret; every access is logged via Cloud Audit Logs,
giving the audit trail secrets-in-source-control never had.

**HA / failure-mode behavior:** user-managed replication lets a
scenario with strict data-residency requirements pin secret replicas
to specific regions; automatic replication trades that control for
operational simplicity.

**Common mistakes / misconfigurations:** granting broad
project-level access to all secrets instead of per-secret bindings;
leaving secrets in environment variables/source control instead of
migrating to Secret Manager despite it being available; not using
versioning for rotation, forcing a riskier in-place secret overwrite
instead.

**Common exam scenario cues:** "API keys/credentials currently in
config files or source control," "rotate a secret safely with
rollback capability," "audit who accessed a specific credential."

---

## Cloud DLP (Sensitive Data Protection)

**Purpose:** discovers and (optionally) de-identifies sensitive data.

**When to use:** any scenario needing to find, classify, or mask
PII/PCI/PHI across Cloud Storage, BigQuery, or streaming Dataflow
pipelines — particularly the pre-training-data-cleanup step for the
Securing AI focus area (Domain 3).

**When NOT to use — use something else instead:**
- Access control on data already known to be sensitive (no discovery/
  classification need) → **IAM/Org Policy/VPC-SC**, not DLP — DLP's
  job is finding and transforming sensitive data, not gatekeeping
  access to a dataset whose sensitivity is already known and scoped.
- Real-time request-level threat detection (SQLi/XSS on an HTTP
  endpoint) → **Cloud Armor**, not DLP — different problem domain
  entirely (data content inspection vs. request traffic inspection).

**Key configuration surface:**
- **InfoType detectors**: built-in detectors for common PII/PCI/PHI
  patterns (SSNs, credit card numbers, names, medical record numbers)
  plus custom detectors (regex or dictionary-based) for
  organization-specific identifiers.
- **De-identification techniques**: redaction, masking, tokenization,
  format-preserving encryption, and generalization/bucketing —
  tokenization is the answer when downstream systems still need a
  consistent (but non-reversible-without-the-key) identifier for the
  same underlying value.
- **Integration points**: scans Cloud Storage, BigQuery, and streaming
  data in Dataflow pipelines — the pre-training-data-cleanup answer for
  the Securing AI focus area (Domain 3).

**Pricing / cost considerations:** billed on data volume scanned/
processed — scanning an entire large dataset repeatedly can become a
material cost; targeted scans (specific tables/buckets, incremental
scanning of new data only) control this better than blanket
full-dataset rescans.

**Performance characteristics:** scanning is a batch/streaming
processing operation with throughput proportional to data volume and
detector complexity (custom regex detectors can be more expensive
than built-in InfoTypes at scale).

**Scaling behavior:** scales with the underlying processing engine
(Dataflow for streaming inspection) — inherits Dataflow's autoscaling
behavior when used in a pipeline context.

**Security posture:** the pre-processing control that makes
downstream data handling (training, sharing, analytics) safer by
reducing the sensitivity of what's actually stored/processed — this
is what "Securing AI workload patterns" (Domain 3, 2026 addition)
concretely refers to when it mentions prompt/training-data
governance.

**HA / failure-mode behavior:** DLP jobs are typically run as
batch/streaming jobs rather than always-on services; failure modes
are pipeline-job failures (retry/monitoring concerns), not an
availability SLA question in the way a database service would be.

**Common mistakes / misconfigurations:** scanning entire datasets
repeatedly instead of incrementally, driving up cost; using DLP as an
access-control mechanism instead of a discovery/transformation tool;
choosing redaction when downstream systems actually need a consistent
tokenized value for joins/analytics.

**Common exam scenario cues:** "discover and mask PII before
training/sharing data," "de-identify sensitive data for analytics
while preserving referential consistency" → tokenization; "Securing
AI" governance of prompts/training data (Domain 3, 2026 addition).

---

## VPC Service Controls

**Purpose:** perimeter-based data exfiltration control around GCP
APIs/services — distinct from and complementary to both IAM and
network firewalls (see Domain 3 §3.1 for the tradeoff table).

**When to use:** any scenario concerned with data exfiltration via
*valid* credentials (a compromised or malicious insider with
legitimate IAM access copying data to an unauthorized external
project) — the threat model IAM alone cannot address, since IAM only
governs whether a credential is authorized, not where authorized data
is allowed to flow.

**When NOT to use — use something else instead:**
- The concern is unauthorized *access* (wrong credential) rather than
  authorized-credential *exfiltration* → **IAM** is the primary
  control; VPC-SC is a second, complementary layer, not a substitute
  for correct IAM scoping.
- Network-layer segmentation between VMs/services within a project →
  **VPC firewall rules**, not VPC-SC — VPC-SC operates at the API/
  service-perimeter level, not the network-packet level.

**Key configuration surface:**
- **Service perimeter**: wraps a set of projects; API calls to
  in-perimeter services from outside the perimeter (or to a resource
  outside the perimeter from inside it) are blocked, even with valid
  IAM credentials.
- **Ingress/egress rules**: explicit exceptions to allow specific
  cross-perimeter access patterns when genuinely needed, rather than
  disabling the perimeter.
- **Dry-run mode**: test perimeter rules against real traffic without
  enforcing them — the correct rollout method for introducing VPC-SC
  into an existing environment without breaking production traffic
  unexpectedly.

**Pricing / cost considerations:** no direct service cost; the risk-
reduction value (preventing exfiltration via valid credentials) is
the entire justification, and the operational cost is the ongoing
maintenance of ingress/egress rules as legitimate cross-perimeter
needs evolve.

**Performance characteristics:** perimeter enforcement adds
negligible latency to API calls; not a runtime performance concern.

**Scaling behavior:** a perimeter can wrap an arbitrary number of
projects, and ingress/egress rules can be added incrementally as new
legitimate cross-perimeter access patterns emerge — scales with
organizational complexity, not with data volume.

**Security posture:** the specific answer to "prevent data
exfiltration by an insider with legitimate credentials" — this framing
(valid-credential exfiltration, not unauthorized access) is the exam
tell that distinguishes a VPC-SC question from a plain IAM question.

**HA / failure-mode behavior:** a misconfigured perimeter (missing an
ingress/egress rule a legitimate workflow needs) fails *closed* by
default — blocking legitimate traffic rather than silently allowing
exfiltration — which is why dry-run mode is the recommended rollout
path to catch such gaps before enforcement.

**Common mistakes / misconfigurations:** enabling enforcement mode
without first validating in dry-run mode, breaking legitimate
production traffic; treating VPC-SC as a replacement for IAM instead
of a second, complementary layer; forgetting a legitimate
cross-perimeter integration needs an explicit ingress/egress rule.

**Common exam scenario cues:** "prevent data exfiltration by an
insider or compromised credential," "sensitive data must never leave
this set of projects even with valid API access," "safely roll out a
new security perimeter without breaking existing traffic" → dry-run
mode.

---

## Cloud Audit Logs & Access Transparency

**Purpose:** the audit trail layer — who did what, when, across both
customer-side and (separately) Google-side access.

**When to use:** any scenario needing evidence of who
created/modified/deleted a resource, who accessed data, or whether an
access attempt was blocked — the foundation for security-incident
investigation, compliance evidence, and policy tuning.

**When NOT to use — use something else instead:**
- Real-time alerting on a specific condition (not after-the-fact
  investigation) → pair with **Cloud Monitoring log-based metrics/
  alerting policies** (`06-management-operations.md`) — Audit Logs
  are the record; Monitoring is what turns a log pattern into an
  active alert.
- Aggregated, correlated security findings across many signals (not
  just raw log entries) → **Security Command Center** (below), which
  ingests and correlates signals including audit log patterns into
  prioritized findings, rather than requiring manual log review.

**Key configuration surface:**
- **Admin Activity logs**: always on, cannot be disabled — records
  configuration/metadata changes (who created/modified/deleted a
  resource).
- **Data Access logs**: opt-in per service (due to volume/cost) —
  records reads/writes to the data itself, not just resource
  metadata.
- **System Event logs**: Google-initiated system actions (e.g. a live
  migration) — always on.
- **Policy Denied logs**: records access attempts blocked by IAM or
  Org Policy — directly useful for security-incident investigation and
  policy-tuning.
- **Access Transparency**: a separate, distinct feed showing *Google
  personnel's* access to your content (support/engineering actions),
  not customer-side activity — the answer whenever a compliance
  requirement is specifically about visibility into vendor-side access.

**Pricing / cost considerations:** Admin Activity/System Event/Policy
Denied logs are free; Data Access logs are opt-in specifically because
of their volume/cost at scale — a scenario weighing "enable Data
Access logging everywhere" against cost is testing whether the
scenario's actual compliance requirement needs that granularity or
whether Admin Activity logging alone suffices.

**Performance characteristics:** log ingestion has no meaningful
impact on the logged operation's own latency; log *querying* at very
high volume benefits from routing to BigQuery via a sink rather than
querying Cloud Logging directly for large-scale analysis
(`06-management-operations.md`).

**Scaling behavior:** scales automatically with API call volume; log
routing/retention design (sinks, exclusions) is the operational
scaling concern, not the logging capability itself.

**Security posture:** Admin Activity and System Event logs being
always-on and non-disableable is itself a security control — no
principal, however privileged, can turn off the record of
configuration changes.

**HA / failure-mode behavior:** log delivery is designed for high
durability; for compliance-grade retention beyond Cloud Logging's
native retention window, sink to Cloud Storage with an explicit
retention policy (Bucket Lock) rather than relying on Cloud Logging
alone.

**Common mistakes / misconfigurations:** enabling Data Access logs
broadly without a specific requirement, incurring unnecessary cost;
assuming Access Transparency shows customer-side activity (it
specifically does not — it's Google-personnel access only); relying
on Cloud Logging's default retention for long-term compliance
evidence instead of an explicit Cloud Storage sink with a retention
policy.

**Common exam scenario cues:** "who deleted this resource," "prove no
unauthorized access occurred," "visibility into Google support/
engineering access to our data" → Access Transparency specifically;
"investigate blocked access attempts" → Policy Denied logs.

---

## Assured Workloads

**Purpose:** wraps a folder with a pre-configured compliance regime —
data residency, personnel access restrictions, and control baseline
mapped to a named framework (e.g. FedRAMP Moderate/High, IL4, regional
sovereignty regimes).

**When to use:** a scenario naming a specific, recognized compliance
framework and asking for the fastest/most defensible path to
alignment, rather than hand-assembling the equivalent control set.

**When NOT to use — use something else instead:**
- No named compliance framework, just a general "keep our data
  secure" requirement → **hand-configured IAM/Org
  Policy/KMS/VPC-SC**, tailored to the actual requirement — Assured
  Workloads is scoped to specific, named regimes, not a general
  security-hardening tool to reach for by default.
- A requirement that doesn't need the specific personnel-access or
  data-residency restrictions a named framework mandates → building
  it manually may be *more* flexible than adopting a framework's full,
  possibly-stricter-than-needed baseline wholesale.

**Key configuration surface:**
- **What it automates**: resource location constraints, support
  personnel restrictions, and key management requirements consistent
  with the chosen regime — replacing a manual assembly of equivalent
  Org Policy/IAM/KMS configuration.
- **When it's the answer**: a scenario naming a specific, recognized
  compliance framework and asking for the fastest/most defensible path
  to alignment — versus hand-building the equivalent control set
  yourself, which is slower and harder to prove compliant in an audit.

**Pricing / cost considerations:** no separate direct fee beyond the
underlying resources it governs; the value is speed-to-compliance and
audit defensibility versus the engineering time cost of manually
assembling and proving an equivalent control set.

**Performance characteristics:** not a runtime performance factor —
purely a governance/configuration layer over the folder's resources.

**Scaling behavior:** applies uniformly to every project under the
governed folder, scaling the compliance baseline automatically as new
projects are added underneath, similar in spirit to Org Policy's
folder-level inheritance.

**Security posture:** bundles data residency, personnel-access
restriction, and key-management requirements into one auditable
configuration mapped to a named, recognized framework — the
audit-defensibility argument (a named framework's checklist,
provably applied) is the core value versus an equivalent hand-rolled
configuration.

**HA / failure-mode behavior:** not an availability-relevant service;
its "failure mode" is a compliance drift (a resource or configuration
falling outside the governed baseline), which Security Command Center
(below) can help surface as a finding.

**Common mistakes / misconfigurations:** adopting Assured Workloads
for a requirement with no actual named-framework driver, taking on
its full (possibly stricter-than-needed) baseline unnecessarily;
assuming Assured Workloads alone is sufficient without also
configuring the workload-specific IAM/network controls a full
architecture still needs.

**Common exam scenario cues:** "FedRAMP," "IL4," "specific regional
data sovereignty regime," "fastest path to a defensible compliance
posture for a named framework."

---

## Security Command Center

> **Confidence note:** current and architect-relevant per RUNBOOK §6 —
> added in the 2026-08-10 depth-remediation pass after being entirely
> absent from this folder's first generation. Positioning below
> reflects Security Command Center's stable, well-established role as
> GCP's security/risk posture management surface; verify current tier
> names/specific feature boundaries against `cloud.google.com` before
> quoting exact tier differences in a live setting.

**Purpose:** Google Cloud's centralized security and risk-posture
management platform — asset inventory, vulnerability/misconfiguration
detection, and threat detection across an organization, correlating
signals the individual controls in this file each produce in
isolation. It is a **detection and visibility** layer, not an
enforcement layer — it finds and prioritizes problems; the other
services in this file (Org Policy, IAM, VPC-SC, KMS, DLP, Binary
Authorization) are what actually *prevent* or *remediate* them.

**When to use:**
- A scenario needs organization-wide visibility into security posture
  — "what assets exist," "what's misconfigured," "what's actively
  under attack" — spanning many projects at once.
- A scenario asks how to continuously discover misconfigurations
  (public buckets, over-broad firewall rules, unencrypted resources)
  rather than relying on a one-time manual audit.
- A scenario describes needing to correlate signals from multiple
  sources (IAM grants, network configuration, DLP findings, audit
  logs, vulnerability scan results) into a single prioritized view
  rather than reviewing each source independently.

**When NOT to use — use something else instead:**
- The requirement is to actually *prevent* a class of misconfiguration
  from ever being created, not just detect it after the fact →
  **Organization Policy Service** — Security Command Center will
  *report* a violation of intent, but Org Policy is what makes the
  violation structurally impossible; a scenario asking for a
  guardrail (not a report) is an Org Policy question, not a Security
  Command Center question.
- The requirement is enforcing that only trusted, signed container
  images can be deployed → **Binary Authorization**
  (`07-devops-cicd.md`) — Security Command Center can surface an
  unattested/vulnerable image as a finding, but the actual deploy-time
  block is Binary Authorization's job.
- The requirement is data exfiltration prevention specifically →
  **VPC Service Controls** — Security Command Center can detect
  anomalous data-access patterns as a finding, but the hard perimeter
  block is VPC-SC's job.
- A single-project, narrowly scoped need where the organization-wide
  correlation value doesn't apply → the underlying per-service
  controls (DLP, Audit Logs, IAM Recommender) may be sufficient on
  their own without standing up org-wide posture management.

**Key configuration surface:**
- **Asset inventory**: a near-real-time inventory of resources across
  the organization — the foundation every other Security Command
  Center capability builds on (you can't detect a misconfigured
  resource you don't know exists).
- **Security Health Analytics**: automated detection of common
  misconfigurations (public Cloud Storage buckets, over-permissive
  firewall rules, service accounts with excessive privilege, missing
  encryption) — the posture-management equivalent of a continuous
  compliance scan.
- **Threat detection**: identifies active threats (malware, crypto-
  mining, anomalous IAM activity, command-and-control traffic
  patterns) by analyzing logs and telemetry across the organization —
  the closest thing in this file to an intrusion/threat-detection
  capability layered on top of the preventive controls elsewhere.
- **Web Security Scanner**: identifies common web application
  vulnerabilities (XSS, outdated libraries, mixed content) on
  public-facing App Engine/Compute Engine/GKE-hosted applications —
  complementary to Cloud Armor's runtime protection (detects the
  vulnerability; Armor blocks exploit traffic against it).
- **Findings and integration**: findings can be exported to Cloud
  Logging/Pub/Sub/BigQuery for downstream alerting or SIEM
  integration, and prioritized by severity — the mechanism for
  turning "we now have visibility" into an actionable, triaged
  remediation workflow rather than a wall of unranked alerts.
- **Complements, does not replace, the rest of this file**: Security
  Command Center is the correlation/detection layer sitting above
  IAM (identity), DLP (data classification), KMS (encryption), Org
  Policy (prevention), VPC-SC (exfiltration prevention), and Audit
  Logs (the raw record it partly draws on) — a mature security
  architecture uses Security Command Center to confirm the other
  controls are actually working as intended organization-wide, not as
  a substitute for configuring them.

**Pricing / cost considerations:** tiered offering (a free/standard
tier with baseline asset inventory and a subset of detectors, and a
premium tier unlocking the fuller threat-detection and vulnerability-
scanning capability set) — a scenario emphasizing advanced threat
detection or compliance-framework-mapped findings across a large
organization is signaling the premium tier; a scenario with a modest,
single-project posture-visibility need may not justify it. Treat
specific tier-name/feature-boundary details as needing a live
`cloud.google.com` check rather than exam-certain memorized specifics.

**Performance characteristics:** a detection/reporting layer, not a
request-path component — it has no latency impact on the workloads it
monitors; its own "performance" is measured in detection
freshness/lag (how quickly a new misconfiguration or threat surfaces
as a finding), not throughput.

**Scaling behavior:** scales to organization-wide asset inventories
automatically — the entire value proposition is *not* having to
manually aggregate posture data project-by-project as an organization
grows; findings scale with the number of monitored assets and enabled
detectors.

**Security posture:** this service *is* the security-posture
visibility layer — its own posture consideration is ensuring its own
access (who can view findings, especially ones revealing
vulnerabilities) is itself tightly IAM-scoped, since the findings
themselves are sensitive information about where an organization is
weak.

**HA / failure-mode behavior:** a managed, org-wide SaaS-style
capability with no customer-facing failover configuration; the
practical "failure mode" to design around is detection lag (a
misconfiguration existing for some window before a finding surfaces)
rather than a service outage — which is exactly why it complements
rather than replaces preventive controls like Org Policy that make
certain misconfigurations impossible regardless of detection latency.

**Common mistakes / misconfigurations:**
- Treating Security Command Center findings as sufficient on their
  own without also implementing the preventive control (Org Policy,
  VPC-SC, Binary Authorization) the finding is pointing toward —
  detection without remediation leaves the underlying risk live.
- Assuming Security Command Center *blocks* anything — it doesn't;
  a scenario needing an active block is asking about one of the
  enforcement services elsewhere in this file or in
  `07-devops-cicd.md`.
- Under-scoping IAM access to findings themselves, which are
  sensitive (they describe exactly where the organization is
  vulnerable).
- Not exporting findings to a SIEM/alerting pipeline, leaving
  detection value stranded in a dashboard nobody actively monitors.

**Common exam scenario cues:** "organization-wide visibility into
security posture," "continuously discover misconfigured resources
across many projects," "correlate security signals into prioritized
findings," "detect active threats/anomalous activity" — paired
against an Org Policy or Binary Authorization distractor whenever the
scenario's real ask is prevention/enforcement rather than detection
and visibility.
