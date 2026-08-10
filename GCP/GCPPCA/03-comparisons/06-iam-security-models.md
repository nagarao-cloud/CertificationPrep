# Comparison: IAM & Security Control Models

> Design guidance: Domain 3 §3.1. Per-service depth:
> `02-services/04-security-iam.md`.

## Control mechanism matrix — "which layer restricts this?"

| Dimension | IAM | Organization Policy | VPC Service Controls | Firewall rules (incl. hierarchical) |
|---|---|---|---|---|
| What it controls | Who can perform which action on which resource | What configurations/values are allowed at all | Which network/identity boundary can reach which API/service | What network traffic is allowed to flow |
| Grant model | Additive only (with narrower IAM Deny for guardrails) | Allow/deny constraint lists | Perimeter allow-list (ingress/egress rules) | Allow/deny rules, priority-ordered |
| Overridable by a lower-level admin? | Yes, lower levels can add more | No — can only tighten, never loosen | No — perimeter membership is centrally managed | Hierarchical: no. Per-VPC: yes, if not hierarchical |
| Stops an authenticated-but-wrong-destination API call? | No | No | **Yes — its specific purpose** | No |
| Stops a network-layer connection? | No | No | No (it's API-layer, not packet-layer) | **Yes — its specific purpose** |
| Typical exam-question shape | "Who should be able to do X" | "Prevent X configuration org-wide, no exceptions" | "Prevent data exfiltration even by a valid, authenticated identity" | "Control which ports/sources can reach this VM/service" |

## Credential mechanism matrix

| Dimension | Exported SA key (JSON) | Workload Identity Federation | Workload Identity (GKE) | User credentials (OAuth) |
|---|---|---|---|---|
| Credential lifetime | Long-lived (until manually rotated/revoked) | Short-lived, token-exchange per use | Short-lived, per-pod | Short-lived (OAuth token), refresh-based |
| Exposure risk if leaked | High — usable until revoked | Low — narrow scope, short-lived | Low — narrow scope, short-lived | Moderate — tied to a human, usually MFA-protected |
| Best for | Legacy/unavoidable only | CI/CD, cross-cloud, external identity providers | GKE pod → GCP API access | Human interactive access (Console, `gcloud auth login`) |
| 2026-era exam default | Avoid when an alternative exists | **Default correct answer for external/CI workloads** | **Default correct answer for GKE workloads** | Expected for human access, not workload automation |

## Encryption control matrix

| Dimension | Google-managed keys (default) | CMEK (Cloud KMS) | CSEK | Cloud EKM |
|---|---|---|---|---|
| Who manages key lifecycle | Google | You (rotation, IAM, destroy) | You (supplied per-operation) | You (external system, referenced at use time) |
| Operational burden | None | Low–moderate | Moderate–high | Highest |
| Google ever holds key material | Yes | Yes (in Cloud KMS) | Transiently, during the operation | No |
| Best for | No stated requirement beyond default encryption-at-rest | "We must control/rotate keys ourselves" | Narrow, specific per-object control scenarios | "Key material must never touch Google's infrastructure at all" |
| Common exam trap | Over-answering with CMEK when nothing requires it | — | Confusing with CMEK (CSEK is customer-*supplied* per operation, not centrally managed) | Reaching for this when CMEK already satisfies the stated requirement |

## Compliance mechanism matrix

| Dimension | Manual Org Policy + IAM assembly | Assured Workloads |
|---|---|---|
| Speed to a named compliance regime | Slow — requires mapping the regime's requirements to individual controls yourself | Fast — pre-mapped to the regime |
| Audit defensibility | Depends entirely on your own documentation | Stronger — aligned to Google's own compliance mapping for the regime |
| Flexibility | Full — you choose every control individually | Constrained to what the regime template supports |
| Best for | Custom/uncommon compliance combinations not covered by a template | Any scenario naming a specific, recognized framework (FedRAMP, IL4, regional sovereignty) |

## Reading a scenario for "which control layer" signal

```
"No project admin should be able to override this, anywhere in the org" → Organization Policy
"Prevent even a valid, authenticated user from copying data to the
 wrong project"                                                          → VPC Service Controls
"Only these specific IP ranges/ports should reach this VM"               → Firewall rules
"This specific person/group should be able to do X on Y"                 → IAM
"CI/CD pipeline needs GCP access, avoid managing long-lived keys"        → Workload Identity Federation
"We need HIPAA/PCI/GDPR-aligned infrastructure, fast"                    → Assured Workloads (+ underlying IAM/KMS/Org Policy)
```
