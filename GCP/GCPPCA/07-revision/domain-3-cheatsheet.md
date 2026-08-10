# Domain 3 Cheat Sheet — Security and Compliance (~20%)

> Compressed by design. Full depth:
> `01-domains/DOMAIN-3-security-compliance.md`.

## "Which control layer" one-liners

- Who can do what → IAM
- What configuration is allowed to exist at all → Organization Policy
- Prevent exfiltration even by a valid, authenticated identity → VPC Service Controls
- What network traffic can flow → Firewall rules (hierarchical = override-proof)

## Credential one-liners

- CI/CD, external/cross-cloud workload → Workload Identity Federation
- GKE pod → GCP API → Workload Identity
- Avoid exported service-account key files whenever an alternative exists (2026-era default)

## Encryption one-liners

- Default, nothing extra required → Google-managed keys
- "We rotate our own keys" → CMEK (Cloud KMS)
- "Key material must never touch Google" → CSEK / Cloud EKM
- App secrets (API keys, DB passwords) → Secret Manager, not env vars/source control
- Find/redact/tokenize PII → Cloud DLP

## Compliance one-liners

- Fast path to a named regime (FedRAMP/IL4/etc.) → Assured Workloads
- Prove Google-side access visibility specifically → Access Transparency
- Customer-side "who did what" → Cloud Audit Logs (Admin Activity always on; Data Access opt-in)
- Data must not leave a jurisdiction → Org Policy `resourceLocations` + regional (not multi-region) resources

## Securing AI (2026 focus)

Private Vertex AI endpoints + VPC-SC perimeter + DLP on prompts/
training data + Workload Identity Federation for partner access — no
public endpoints, no exported keys.

## IAM role preference order

Predefined > primitive (Owner/Editor/Viewer, rarely correct) > custom
(residual gaps only).

## Top traps

1. Reaching for IAM to restrict a configuration (that's Org Policy's job)
2. Treating encryption-at-rest as something to "add" (it's default; CMEK/CSEK/EKM are the actual design decisions)
3. Confusing VPC-SC (API-layer exfiltration) with firewall rules (network-layer traffic)
4. Defaulting to a service-account key file instead of federation
