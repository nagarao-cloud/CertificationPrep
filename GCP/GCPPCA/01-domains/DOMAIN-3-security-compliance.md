# Domain 3 — Designing for Security and Compliance (~20%)

> Source: `00-START-HERE/RUNBOOK.md` §3 (task wording reconstructed —
> see RUNBOOK §1). Second-largest domain; the exam's most reliable
> "there is one defensible best answer" domain because security has
> fewer legitimate judgment calls than, say, cost tradeoffs.

## Contents

1. [3.1 Designing for security](#31-designing-for-security)
2. [3.2 Designing for legal compliance](#32-designing-for-legal-compliance)
3. [Production architecture pattern: zero-trust perimeter](#production-architecture-pattern-zero-trust-perimeter)
4. [Domain 3-specific exam traps](#domain-3-specific-exam-traps)

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
  don't cover, and carry a maintenance burden.
- **Resource hierarchy determines policy inheritance**: Organization →
  Folder → Project → Resource. A binding at a higher level is
  inherited (unioned, never revoked) by everything below. This is why
  "restrict X org-wide, no exceptions" is an Org Policy question, not
  an IAM question — IAM inheritance can only add permissions as you go
  down, never remove them.

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

### Data protection and encryption

| Requirement signal | Mechanism | Detail |
|---|---|---|
| "Encrypted at rest" (default, no extra requirement) | Google-managed encryption keys | On by default for all GCP storage — don't over-answer a question that doesn't ask for more |
| "We must control/rotate the encryption keys ourselves" | CMEK (Customer-Managed Encryption Keys) via Cloud KMS | Google still performs the encryption operation; you own key lifecycle (rotation, destroy, IAM on the key) |
| "Key material must never touch Google's infrastructure" | CSEK (Customer-Supplied) or Cloud EKM (external key manager) | Highest operational burden; only correct when the scenario states this exact requirement (common in the most stringent compliance scenarios) |
| "Store and rotate application secrets (API keys, DB passwords)" | Secret Manager | Versioned, IAM-scoped, audit-logged — not environment variables or files in source control |
| "Find/redact PII before it lands in a data lake" | Cloud DLP (Sensitive Data Protection) | Classifies and can de-identify/tokenize sensitive fields in pipelines |

### Network security architecture

- **VPC Service Controls (VPC-SC)**: creates a *service perimeter*
  around GCP APIs/resources (not just network routes) — stops data
  exfiltration even by an authenticated identity making calls from
  outside the perimeter, or to the wrong project. This is the answer
  whenever a scenario says "prevent data exfiltration" or "even an
  insider with valid credentials shouldn't be able to copy data out."
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

### Securing AI workloads (2026 focus area — see RUNBOOK §7)

| Concern | Mechanism |
|---|---|
| Vertex AI endpoint exposure | Private endpoints (no public internet path), VPC-SC perimeter around the AI/ML project |
| Prompt/output governance | DLP integration on prompts/outputs, logging for audit, content filtering |
| Third-party AI partner access | Scoped service accounts / Workload Identity Federation, never broad project-level access |
| Training-data protection | CMEK on the underlying Cloud Storage/BigQuery datasets, DLP de-identification before training where PII is present |

### Tradeoffs — security design

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "Prevent an insider with valid IAM permissions from exfiltrating data to a personal project" | VPC Service Controls perimeter | IAM alone, or network firewall rules alone | Neither IAM nor firewalls stop an authenticated API call to the wrong destination project — VPC-SC is purpose-built for exactly this |
| "CI/CD pipeline needs to deploy to GCP" | Workload Identity Federation | A downloaded service-account key stored as a CI secret | Removes a standing credential that can leak; federated tokens are short-lived and scoped |
| "Must control key rotation ourselves but don't need to manage physical HSMs" | CMEK via Cloud KMS | CSEK / external key manager | CSEK/EKM is more operational burden than the requirement calls for — match the control level to what's actually stated |
| "Need org-wide 'no external IPs, ever'" | Organization Policy constraint | Per-project IAM restrictions | IAM can't preemptively forbid a resource *configuration* — Org Policy constraints are the mechanism for that class of rule |

---

## 3.2 Designing for legal compliance

### Regulatory mapping

| Regime | What it typically requires | GCP mechanism |
|---|---|---|
| HIPAA (healthcare — EHR Healthcare case study) | PHI protection, access auditing, BAA with Google | CMEK, Cloud Audit Logs, Access Transparency, restricted API surface, signed BAA (organizational, not architectural, but drives which services are "covered") |
| PCI-DSS (payment card data) | Network segmentation, encryption, strict access control, audit trail | VPC-SC perimeter around cardholder-data scope, CMEK, Cloud Armor, Cloud Audit Logs |
| GDPR (EU personal data) | Data residency/consent, right-to-erasure, breach notification | Regional resource pinning (Org Policy `resourceLocations`), DLP for data discovery, retention policies |
| Data residency/sovereignty (general) | Data must not leave a specified jurisdiction | Org Policy resource-location constraints, regional (not multi-region) storage/compute, Assured Workloads for the strictest regimes |

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

### Tradeoffs — legal compliance

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "We need a fast, pre-validated path to a named compliance regime (FedRAMP, IL4, etc.)" | Assured Workloads | Manually assembling equivalent Org Policy/IAM controls | Assured Workloads is purpose-built and pre-mapped to the regime's requirements — faster and more defensible in audit |
| "We need to prove even Google support engineers didn't access our data without cause" | Access Transparency | Cloud Audit Logs alone | Audit Logs cover *your* users' actions; Access Transparency specifically covers Google-side access |
| "Data must never leave the EU" | Regional (EU) resources + Org Policy resource-location constraint | Multi-region or global default resources | Multi-region/global resources can place data outside the required jurisdiction unless explicitly pinned |

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
        │  │  Workload    │   │  endpoint only)  │ │
        │  │  Identity)   │   └────────┬─────────┘ │
        │  └──────┬───────┘            │           │
        │         ▼                    ▼           │
        │  ┌─────────────┐   ┌─────────────────┐ │
        │  │ Cloud SQL    │   │  Cloud Storage   │ │
        │  │ (CMEK,       │   │  (CMEK, DLP      │ │
        │  │  private IP  │   │   scan on        │ │
        │  │  only)       │   │   ingest)        │ │
        │  └─────────────┘   └─────────────────┘ │
        └───────────────────────────────────────┘
                            │
                  All identities via Workload
                  Identity Federation — zero
                  exported service-account keys
                            │
                  Cloud Audit Logs + Access
                  Transparency → central
                  Shared-Services log sink
```

**Why this shape:** every data-plane resource sits inside one VPC-SC
perimeter (stops exfiltration even from a compromised/over-permissioned
identity), every credential is federated rather than a static key, and
CMEK/DLP are applied at the storage layer rather than left to
service-level defaults — this is the composite answer to "design the
most defensible version of this system" questions.

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
