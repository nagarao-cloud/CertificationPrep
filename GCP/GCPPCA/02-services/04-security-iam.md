# Security & IAM Services Reference

> Design guidance and tradeoffs: Domain 3 (`01-domains/DOMAIN-3-security-compliance.md`).
> This file is per-service configuration depth. Comparison table:
> `03-comparisons/06-iam-security-models.md`.

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

---

## IAM

Additive-only access control, applied across the resource hierarchy
(Organization → Folder → Project → Resource), with inheritance flowing
downward and unioning (never subtracting) at each level.

- **Role types**: primitive (Owner/Editor/Viewer — broad, rarely the
  correct exam answer), predefined (Google-maintained, scoped to a
  service or task — the default preference), custom (user-defined for
  gaps predefined roles don't cover — maintenance burden, use sparingly).
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

---

## Service Accounts & Workload Identity Federation

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

---

## Organization Policy Service

Constraint-based guardrails enforced **below** IAM — restricts what
configurations are possible regardless of what an IAM grant would
otherwise permit.

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

---

## Cloud KMS

Managed key management — the mechanism behind CMEK.

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

---

## Secret Manager

Versioned, IAM-scoped storage for application secrets (API keys,
credentials, certificates).

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

---

## Cloud DLP (Sensitive Data Protection)

Discovers and (optionally) de-identifies sensitive data.

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

---

## VPC Service Controls

Perimeter-based data exfiltration control around GCP APIs/services —
distinct from and complementary to both IAM and network firewalls (see
Domain 3 §3.1 for the tradeoff table).

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

---

## Cloud Audit Logs & Access Transparency

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

---

## Assured Workloads

Wraps a folder with a pre-configured compliance regime — data
residency, personnel access restrictions, and control baseline mapped
to a named framework (e.g. FedRAMP Moderate/High, IL4, regional
sovereignty regimes).

- **What it automates**: resource location constraints, support
  personnel restrictions, and key management requirements consistent
  with the chosen regime — replacing a manual assembly of equivalent
  Org Policy/IAM/KMS configuration.
- **When it's the answer**: a scenario naming a specific, recognized
  compliance framework and asking for the fastest/most defensible path
  to alignment — versus hand-building the equivalent control set
  yourself, which is slower and harder to prove compliant in an audit.
