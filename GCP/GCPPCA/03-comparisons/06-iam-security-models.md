# Comparison: IAM & Security Control Models

> Design guidance: Domain 3 §3.1. Per-service depth:
> `02-services/04-security-iam.md`.

## Control mechanism matrix — "which layer restricts this?"

| Dimension | IAM | Organization Policy | VPC Service Controls | Firewall rules (incl. hierarchical) | Binary Authorization | Security Command Center |
|---|---|---|---|---|---|---|
| What it controls | Who can perform which action on which resource | What configurations/values are allowed at all | Which network/identity boundary can reach which API/service | What network traffic is allowed to flow | Which container images are allowed to deploy | Visibility/detection across misconfigurations, vulnerabilities, and threats org-wide |
| Grant model | Additive only (with narrower IAM Deny for guardrails) | Allow/deny constraint lists | Perimeter allow-list (ingress/egress rules) | Allow/deny rules, priority-ordered | Attestation-based allow/deny at deploy time | Detective, not preventive — surfaces findings rather than blocking actions itself |
| Overridable by a lower-level admin? | Yes, lower levels can add more | No — can only tighten, never loosen | No — perimeter membership is centrally managed | Hierarchical: no. Per-VPC: yes, if not hierarchical | No — policy is centrally defined for a project/cluster | N/A (read/detect surface, not a policy an admin overrides) |
| Stops an authenticated-but-wrong-destination API call? | No | No | **Yes — its specific purpose** | No | No (it's a deploy-time gate, not a runtime API-call gate) | No — flags it after the fact, doesn't block it |
| Stops a network-layer connection? | No | No | No (it's API-layer, not packet-layer) | **Yes — its specific purpose** | No | No |
| Stops a bad/unscanned image from deploying? | No | Indirectly, if a constraint restricts image sources | No | No | **Yes — its specific purpose** | No — would surface the risk as a finding, not block the deploy |
| Preventive or detective? | Preventive | Preventive | Preventive | Preventive | Preventive (deploy-time gate) | **Detective** — this is the key differentiator from every other row |
| Typical exam-question shape | "Who should be able to do X" | "Prevent X configuration org-wide, no exceptions" | "Prevent data exfiltration even by a valid, authenticated identity" | "Control which ports/sources can reach this VM/service" | "Prevent an unreviewed/unscanned image from ever reaching production" | "Get a unified view of our security posture across projects" |

## Credential mechanism matrix

| Dimension | Exported SA key (JSON) | Workload Identity Federation | Workload Identity (GKE) | User credentials (OAuth) |
|---|---|---|---|---|
| Credential lifetime | Long-lived (until manually rotated/revoked) | Short-lived, token-exchange per use | Short-lived, per-pod | Short-lived (OAuth token), refresh-based |
| Exposure risk if leaked | High — usable until revoked | Low — narrow scope, short-lived | Low — narrow scope, short-lived | Moderate — tied to a human, usually MFA-protected |
| Rotation burden | Manual, easy to neglect | None — tokens are ephemeral by design | None — tokens are ephemeral by design | Handled by the OAuth flow automatically |
| Auditability | Hard to attribute a leaked key's later use to its origin precisely | Strong — token exchange events are traceable to the originating external identity | Strong — traceable to the specific pod/workload | Strong — tied to the individual human account |
| Best for | Legacy/unavoidable only | CI/CD, cross-cloud, external identity providers | GKE pod → GCP API access | Human interactive access (Console, `gcloud auth login`) |
| 2026-era exam default | Avoid when an alternative exists | **Default correct answer for external/CI workloads** | **Default correct answer for GKE workloads** | Expected for human access, not workload automation |
| Common exam trap | Proposing this as the answer whenever any credential is needed, without checking for a keyless alternative first | Confusing with a plain OAuth flow — WIF specifically exchanges an *external* IdP's token, not a human login | Confusing with a generic exported key mounted into a pod (the anti-pattern Workload Identity replaces) | Using a human's OAuth credential for a service-to-service automation path instead of a service identity |

## Encryption control matrix

| Dimension | Google-managed keys (default) | CMEK (Cloud KMS) | CSEK | Cloud EKM |
|---|---|---|---|---|
| Who manages key lifecycle | Google | You (rotation, IAM, destroy) | You (supplied per-operation) | You (external system, referenced at use time) |
| Operational burden | None | Low–moderate | Moderate–high | Highest |
| Google ever holds key material | Yes | Yes (in Cloud KMS) | Transiently, during the operation | No |
| Key destruction as an access-revocation lever | Not available to you directly | Yes — destroying the CMEK key renders all data encrypted with it permanently unreadable, a deliberate "crypto-shredding" control | Yes, but you must resupply the key for every future operation, which is itself the operational burden | Yes — revoking access at the external system instantly cuts off Google's ability to use the key |
| Compliance-driver fit | No stated requirement beyond default encryption-at-rest | "We must control/rotate keys ourselves," most common compliance ask | Narrow, specific per-object control scenarios | "Key material must never touch Google's infrastructure at all," sovereignty-driven |
| Best for | No stated requirement beyond default encryption-at-rest | "We must control/rotate keys ourselves" | Narrow, specific per-object control scenarios | "Key material must never touch Google's infrastructure at all" |
| Common exam trap | — | Over-answering with CMEK when nothing requires it | Confusing with CMEK (CSEK is customer-*supplied* per operation, not centrally managed) | Reaching for this when CMEK already satisfies the stated requirement |

## Compliance mechanism matrix

| Dimension | Manual Org Policy + IAM assembly | Assured Workloads |
|---|---|---|
| Speed to a named compliance regime | Slow — requires mapping the regime's requirements to individual controls yourself | Fast — pre-mapped to the regime |
| Audit defensibility | Depends entirely on your own documentation | Stronger — aligned to Google's own compliance mapping for the regime |
| Flexibility | Full — you choose every control individually | Constrained to what the regime template supports |
| Ongoing maintenance burden | High — you own detecting and closing drift from the regime's requirements over time | Lower — the regime template evolves with Google's own compliance updates |
| Best for | Custom/uncommon compliance combinations not covered by a template | Any scenario naming a specific, recognized framework (FedRAMP, IL4, regional sovereignty) |

## Detection and posture-management layer: Security Command Center

Security Command Center (SCC) is a **detective**, org-wide security and
risk management surface — worth positioning explicitly against the
preventive controls above, since a scenario can easily blur "prevent
this" with "get visibility into this."

- **What it aggregates:** misconfigurations (e.g. public buckets,
  overly permissive firewall rules), vulnerabilities (via integrated
  scanning), active threats (anomalous access patterns), and compliance
  posture against common benchmarks — across every project in scope,
  not one project at a time.
- **Use it when** a scenario asks for centralized, org-wide security
  visibility, a way to continuously discover misconfigurations before
  they're exploited, or a compliance-posture dashboard spanning many
  projects/teams. **Don't use it as the answer when** the scenario asks
  how to *prevent* a specific action from happening at all — SCC
  surfaces the finding, it doesn't block the underlying action; the
  preventive answer is IAM, Org Policy, VPC-SC, firewall rules, or
  Binary Authorization depending on which layer the scenario's
  prevention need sits at (see the control-mechanism matrix above).
- **Near-miss trap vs. Cloud Audit Logs:** both provide visibility, but
  Audit Logs are a *record of what happened* (who did what, when),
  while SCC is an *active posture/risk-detection* surface (what's
  currently misconfigured or under attack, evaluated continuously) —
  a scenario asking "show me a history of admin actions for a
  compliance audit" wants Audit Logs; a scenario asking "tell me what's
  currently exposed/vulnerable across our whole org" wants SCC.
- **Confidence note:** Security Command Center's general mechanism
  (aggregated, org-wide security findings and posture management) is a
  stable, established GCP capability; its explicit inclusion as named
  2026-exam-scope material was identified through this folder's
  secondary-source gap-remediation pass (see `00-START-HERE/RUNBOOK.md`
  §6-§7) rather than confirmed verbatim against the primary guide PDF
  — treat the mechanism as solid, and "tested by name on the exam" as
  reasonable-confidence rather than independently verified.

## IAM role-type matrix

| Dimension | Primitive roles (Owner/Editor/Viewer) | Predefined roles | Custom roles |
|---|---|---|---|
| Scope of permissions | Broad, project-wide, span every service | Scoped to a specific service/task | Whatever you define — as narrow or broad as authored |
| Maintained by | Google (fixed, legacy) | Google (updated as services evolve) | You (must be manually updated as your needs change) |
| Least-privilege fit | Poor — almost always over-grants | Good — the default preference | Best, if authored carefully — but highest maintenance burden |
| Common exam trap | Proposing Owner/Editor as "simplest" when a predefined role would satisfy the same need with far less exposure | — | Reaching for a custom role when a predefined role already covers the need exactly, adding needless maintenance burden |
| Best for | Sandbox/test projects, rarely production | The default answer for almost any production least-privilege design | A specific, narrow gap predefined roles genuinely don't cover |

## Organization Policy constraint examples (common exam-relevant constraints)

| Constraint | Type | What it prevents | Typical exam-scenario cue |
|---|---|---|---|
| `constraints/compute.vmExternalIpAccess` | List (allow/deny) | VMs from receiving external IP addresses | "No VM should ever be directly internet-reachable" |
| `constraints/gcp.resourceLocations` | List (allow/deny) | Resources being created outside approved regions | Data residency/sovereignty requirements |
| `constraints/iam.disableServiceAccountKeyCreation` | Boolean | Creation of new exported service account keys | "Force the org onto Workload Identity Federation, no exceptions" |
| `constraints/iam.allowedPolicyMemberDomains` | List (allow/deny) | Granting IAM access to identities outside approved domains | Preventing accidental external sharing |
| `constraints/sql.restrictPublicIp` | Boolean | Cloud SQL/AlloyDB instances from having a public IP | "Every database must be reachable only via private IP" |
| Custom constraints | Org-specific | Whatever built-in constraints don't cover | A scenario naming a rule with no obvious built-in match |

## Near-miss traps summary (side-by-side pairs the exam expects you to separate)

| Pair | What makes them look similar | The actual deciding signal |
|---|---|---|
| IAM vs. Organization Policy | Both are "access control" in casual conversation | Question is about *who* can act → IAM. Question is about *what configurations are possible at all, regardless of who* → Org Policy |
| VPC Service Controls vs. Firewall rules | Both are described as "network security" | Concern is a valid, authenticated identity reaching the wrong *API/service destination* → VPC-SC. Concern is *packet-level* traffic flow (ports, sources) → Firewall rules |
| VPC Service Controls vs. IAM | Both can "block access" | IAM blocks based on *identity permission*. VPC-SC blocks based on *perimeter membership*, even for an identity that has valid IAM permissions — the classic VPC-SC exam framing is "a valid, authorized user attempting to move data to the wrong project" |
| CMEK vs. CSEK | Both are "customer-controlled encryption" | Centrally managed, rotated via Cloud KMS → CMEK. Supplied fresh per-operation, no central management → CSEK |
| CMEK vs. Cloud EKM | Both give you key control | Google still holds/uses the key material within its infrastructure → CMEK. Key material never resides in Google's infrastructure at all → Cloud EKM |
| Security Command Center vs. Cloud Audit Logs | Both are "visibility" tools | Historical record of actions taken → Audit Logs. Continuous posture/risk/vulnerability detection → SCC |
| Binary Authorization vs. VPC Service Controls | Both are "preventive security controls" that sound infrastructure-related | Gates *which container image* can deploy → Binary Authorization. Gates *which network/identity boundary* can reach an API/service → VPC-SC — different layer entirely, not substitutes for each other |
| Workload Identity Federation vs. Workload Identity (GKE) | Both are "keyless" identity federation with similar names | External identity provider (AWS, Azure AD, CI/CD OIDC) → WIF. GKE pod-to-GCP-API specifically → Workload Identity (GKE-specific instance of the same underlying principle) |
| Assured Workloads vs. manual compliance assembly | Both can achieve the same end compliance state | Named, recognized framework (FedRAMP, IL4) and speed-to-compliant matters → Assured Workloads. Custom/uncommon regime not covered by a template → manual assembly |

## Reading a scenario for "which control layer" signal

```
"No project admin should be able to override this, anywhere in the org" → Organization Policy
"Prevent even a valid, authenticated user from copying data to the
 wrong project"                                                          → VPC Service Controls
"Only these specific IP ranges/ports should reach this VM"               → Firewall rules
"This specific person/group should be able to do X on Y"                 → IAM
"CI/CD pipeline needs GCP access, avoid managing long-lived keys"        → Workload Identity Federation
"GKE pod needs to call a GCP API without a mounted key file"             → Workload Identity (GKE)
"We need HIPAA/PCI/GDPR-aligned infrastructure, fast"                    → Assured Workloads (+ underlying IAM/KMS/Org Policy)
"Only images that passed our CI vulnerability scan may deploy"           → Binary Authorization
"Give us a single, org-wide view of misconfigurations and threats"       → Security Command Center
"We must be able to destroy a key and make its data unreadable forever"  → CMEK (Cloud KMS)
"Key material must never touch Google's infrastructure at all"           → Cloud EKM
"Show a complete history of who changed this resource and when"          → Cloud Audit Logs (Admin Activity)
"Show us what Google support personnel accessed in our environment"      → Access Transparency
```

## Layered-defense worked example

A single scenario frequently needs *several* of these controls stacked
together, not one instead of another — the exam's harder questions test
whether you'll recognize a layered design rather than picking just one
mechanism and declaring the scenario solved.

```
Scenario: "A regulated healthcare workload runs on GKE; only
vulnerability-scanned images may run; the cluster's data must never be
exfiltrated to an unauthorized project even by a legitimately
authenticated engineer; and the security team wants org-wide visibility
into posture drift."

Layered answer:
  Workload Identity (GKE)      → pods authenticate to GCP APIs, no static keys
  Binary Authorization         → only attested, scanned images deploy
  VPC Service Controls         → perimeter prevents exfiltration even by
                                   a valid, authenticated identity
  IAM (least privilege)        → scopes exactly who can do what within
                                   the perimeter
  Org Policy                   → org-wide guardrails no project admin
                                   can loosen
  CMEK                         → the healthcare data's encryption keys
                                   are customer-managed and revocable
  Security Command Center      → continuous, org-wide posture visibility
                                   across all of the above
  Cloud Audit Logs             → the historical record for compliance
                                   audits
```

Each control answers a *different* question ("who," "what
configuration," "which perimeter," "which image," "what's currently
exposed," "what happened historically") — recognizing that a single
scenario can require several simultaneously, each addressing a distinct
layer, is the core skill Domain 3 is testing, more than memorizing any
one mechanism in isolation.

## Worked scenario walkthroughs

**Scenario A — EHR Healthcare, third-party AI partner access (2026
focus area).** "EHR Healthcare wants to let a third-party AI partner
run inference against a private Vertex AI endpoint hosting a clinical
model, without exposing the endpoint to the public internet or granting
the partner broad network access to the VPC." Reasoning: "without
exposing to the public internet" and "without broad network access"
rules out a public endpoint and rules out full VPC Peering; the
combination of a *private* endpoint plus narrow, single-service
exposure to an external party is a **Private Service Connect
(producer)** signal for the network path, paired with tightly scoped
**IAM** bindings for the partner's identity (likely via **Workload
Identity Federation** if the partner authenticates from outside GCP)
and **VPC Service Controls** to ensure the partner's access can't be
used to reach anything beyond the specific published endpoint — a
composite answer spanning three of the mechanisms above, consistent
with Domain 3.1's "Securing AI workload patterns" focus area.

**Scenario B — Mountkirk Games, CI/CD supply-chain security.**
"Mountkirk's CI/CD pipeline builds and deploys container images to GKE
automatically on every merge; leadership wants assurance that no image
reaches production without passing the pipeline's automated
vulnerability scan, and wants the pipeline itself to authenticate to
GCP without any stored credentials in the CI system." Reasoning: "no
image without passing the scan" is the **Binary Authorization** signal
specifically (attestation-gated deploys); "no stored credentials in the
CI system" is the **Workload Identity Federation** signal (the CI
platform's own OIDC token exchanges for short-lived GCP credentials,
no exported key ever created). A trap here is answering with just IAM
role restrictions on the CI service account — that controls *who* can
deploy, not *whether the specific image* passed a scan, which is a
different question Binary Authorization specifically answers.

**Scenario C — TerramEarth, org-wide security posture after rapid
growth.** "TerramEarth's cloud footprint grew quickly across many
projects and teams; the security team has no single view of
misconfigured storage buckets, overly permissive firewall rules, or
unpatched vulnerabilities across the organization, and wants to close
that visibility gap before defining new preventive policies."
Reasoning: "no single view... across the organization" plus "before
defining new preventive policies" is explicitly a detection/visibility
need first — **Security Command Center** is the direct answer, and the
scenario's own sequencing (visibility *before* new preventive policy)
is a hint that jumping straight to proposing new Org Policy constraints
without first establishing what's actually misconfigured today would
be solving the problem out of order.