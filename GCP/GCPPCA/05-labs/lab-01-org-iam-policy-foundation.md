# Lab 1: Organization/IAM/Org Policy Foundation

> Builds the resource-hierarchy landing zone referenced throughout
> Domain 1 §1.3, Domain 2, and Domain 3. Do this lab before Lab 2
> (network design) — the folder structure here is a prerequisite.

## Objective

Stand up a minimal but realistic resource hierarchy — Organization →
Folders (Production/Non-Production/Shared Services) → Projects — with
group-based IAM and an Org Policy constraint enforced top-down, and
observe how inheritance actually behaves.

## Prerequisites

- An Organization resource (requires Cloud Identity/Workspace — if
  you don't have one, this lab's `gcloud` commands are still worth
  reading even without running them; note the concepts, come back to
  execute once an Org is available).
- `gcloud` CLI authenticated with Organization Administrator-equivalent
  permissions.

## Steps

### 1. Create the folder structure

```bash
gcloud resource-manager folders create \
  --display-name="Production" \
  --organization=ORG_ID

gcloud resource-manager folders create \
  --display-name="Non-Production" \
  --organization=ORG_ID

gcloud resource-manager folders create \
  --display-name="Shared-Services" \
  --organization=ORG_ID
```

**Why folders, not just projects directly under the Org:** folders are
the unit both IAM inheritance and Org Policy constraints attach to for
environment-wide rules — see Domain 1 §1.3 Pattern A and Domain 2's
landing zone pattern.

### 2. Create a project inside the Production folder

```bash
gcloud projects create prod-app-001 \
  --folder=PROD_FOLDER_ID \
  --name="Production App"
```

### 3. Bind IAM at the folder level, using a group (not individual users)

```bash
gcloud resource-manager folders add-iam-policy-binding PROD_FOLDER_ID \
  --member="group:prod-engineers@example.com" \
  --role="roles/compute.admin"
```

**Why a group binding:** individual-user bindings don't scale and are
invisible to standard access-review tooling in the same way group
membership is — Domain 3 §3.1 flags primitive/individual bindings as a
recurring anti-pattern.

### 4. Verify inheritance

```bash
gcloud projects get-iam-policy prod-app-001 --format=json
```

Observe: the binding made at the *folder* level does not appear
directly in the *project's* policy output, but a member of
`prod-engineers@example.com` still has `compute.admin` on
`prod-app-001` — this is IAM inheritance in action (additive,
top-down), the concept Domain 3 §3.1 tests directly.

### 5. Apply an Org Policy constraint at the folder level

```bash
gcloud resource-manager org-policies set-policy policy.yaml \
  --folder=PROD_FOLDER_ID
```

Where `policy.yaml` denies external IPs:

```yaml
constraint: constraints/compute.vmExternalIpAccess
listPolicy:
  allValues: DENY
```

### 6. Attempt to override at the project level (expected to fail/be ineffective)

```bash
gcloud resource-manager org-policies set-policy loosen.yaml \
  --project=prod-app-001
```

Where `loosen.yaml` tries to allow external IPs. **Expected outcome:**
this does not actually loosen the inherited constraint — Org Policy
constraints can be tightened further down the hierarchy but not
loosened past what a higher level enforces (unless the constraint
explicitly supports override, which this one doesn't by default). This
is the concrete demonstration of Domain 3 exam trap #1: IAM can grant
more permission as you go down the hierarchy, but Org Policy cannot be
un-tightened the same way.

### 7. Clean up

```bash
gcloud projects delete prod-app-001
gcloud resource-manager folders delete PROD_FOLDER_ID
# (repeat for other folders)
```

## What this lab demonstrates for the exam

- The Organization → Folder → Project hierarchy is where both IAM
  inheritance (Domain 3 §3.1) and Org Policy constraint enforcement
  (Domain 3 §3.1, Domain 2 §2.1) actually live — not abstractions, real
  `gcloud` behavior.
- Group-based IAM bindings at the folder level are how "central
  governance, decentralized ownership" (Domain 2's landing zone
  pattern) is implemented in practice.
- Org Policy's one-directional tightening (never loosening) below a
  higher-level constraint is the mechanism behind every "no exceptions,
  org-wide" scenario requirement.
