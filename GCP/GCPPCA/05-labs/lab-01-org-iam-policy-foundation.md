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
- A billing account you're willing to link to the throwaway project
  (required for `gcloud projects create` to succeed for most resource
  types, though this lab creates no billable resources itself — see
  Cost Estimate below).

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

Each `create` call returns a folder ID (`folders/123456789012`) —
capture the numeric ID for the Production folder as `PROD_FOLDER_ID`
for the rest of this lab; you'll need it repeatedly and it is not
guessable from the display name.

### 2. Create a project inside the Production folder

```bash
gcloud projects create prod-app-001 \
  --folder=PROD_FOLDER_ID \
  --name="Production App"
```

Project IDs are globally unique across **all** of GCP, not just your
organization — `prod-app-001` is very likely already taken by someone
else's project. Pick something with enough entropy that a collision is
unlikely (e.g. append initials or a random suffix), and treat every
`prod-app-001`-style ID in this lab as a placeholder to replace with
your own.

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

If you don't have a real Google Group to bind against, this command
still succeeds — Cloud IAM does not verify group existence at bind
time, only at evaluation time (a member of a group that doesn't exist,
or that has no members, simply grants access to no one). That
non-validation is itself worth knowing: a `gcloud ... add-iam-policy-binding`
call returning success is *not* proof the group is real or populated.

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

**Note on Org Policy API versions:** the `gcloud resource-manager
org-policies` command group and the `listPolicy` YAML schema above are
the classic (v1) Org Policy API, and both are still valid and in
active use. Google's current documentation increasingly leads with the
newer Org Policy API, exposed as a separate `gcloud org-policies`
command group (no `resource-manager` segment) using a `spec.rules`
YAML schema instead of `listPolicy`. The two APIs manage the same
underlying constraints and interoperate, but their command syntax and
YAML shape differ. This lab uses the classic form because it is the
one most existing PCA-era study material and real production Terraform
still shows; if a scenario question or a newer `gcloud` help output
shows `spec.rules` instead of `listPolicy`, recognize it as the same
concept expressed through the newer API rather than a different
feature.

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

## Verification

Run these checks after each major step — don't assume a `0` exit code
means the hierarchy actually looks the way you intended. Several of
these commands succeed even when the *result* is wrong (e.g. a project
created under the wrong parent), so check the described output, not
just that the command ran.

**1. Folder structure exists and is where you think it is**

```bash
gcloud resource-manager folders list --organization=ORG_ID
```

Correct output: three rows, one per folder, each showing a
`DISPLAY_NAME` (`Production`, `Non-Production`, `Shared-Services`) and
a numeric `ID`. If the list is empty, you either used the wrong
`ORG_ID` (run `gcloud organizations list` to confirm it) or the
folders were created under a different parent than the organization
root — folders can nest under other folders, and a mistyped
`--organization` value combined with a stale default in your gcloud
config is a common way to create a folder somewhere unexpected.

**2. The project landed inside the Production folder, not the Org root**

```bash
gcloud projects describe prod-app-001 --format="value(parent.type,parent.id)"
```

Correct output: `folder <PROD_FOLDER_ID>` (two space-separated values).
Misconfiguration signal: output reads `organization <ORG_ID>` instead
— this means the `--folder` flag was omitted, misspelled, or given the
wrong numeric ID when the project was created, and the project now sits
directly under the Org root instead of inside Production. `gcloud
projects create` does **not** error in this case; it just parents the
project wherever you told it to (or under the Org if you told it
nothing), so this is a silent-success failure mode, not a crash.

**3. IAM inheritance is actually working, not just configured**

```bash
gcloud projects get-iam-policy prod-app-001 --format=json
```

Correct output: a `bindings` array that does **not** contain
`prod-engineers@example.com` bound to `roles/compute.admin` directly —
the project's own policy document stays clean. To confirm the
inherited grant is real (not just theoretically inherited), use the
Policy Troubleshooter in Cloud Console (IAM & Admin → Policy
Troubleshooter, or the `troubleshoot.iam.googleapis.com` API) with the
principal set to a member of `prod-engineers@example.com` and the
resource set to `prod-app-001`: it should report `compute.admin` as
**granted**, with the folder-level binding shown as the source. (This
lab intentionally does not give an exact `gcloud` command for the
troubleshooter — at time of writing it is most reliably driven from
Console or the REST API; if your `gcloud` version exposes an
`iam`/`policy-intelligence` troubleshooting subcommand, treat the
Console path as the verified fallback rather than guessing at flags.)
Misconfiguration signal: the troubleshooter reports the permission as
denied, or reports no matching binding at all — usually means the
group email was mistyped in step 3, or the binding was applied to the
wrong folder ID.

**4. The Org Policy constraint is actually enforced, including the merged/effective view**

```bash
gcloud resource-manager org-policies describe \
  constraints/compute.vmExternalIpAccess \
  --project=prod-app-001 \
  --effective
```

Correct output: the effective policy shows `allValues: DENY` — even
though this command targets the *project*, the `--effective` flag
walks the hierarchy and shows what actually applies after inheritance,
which should reflect the folder-level policy from step 5. Misconfiguration
signal: running the same command **without** `--effective` on a
resource where no policy was set directly returns "no policy set" —
that is expected and not a bug (it means no policy is attached at
*that exact* level); the mistake is reading a bare `describe` on the
project as proof the constraint isn't enforced, when `--effective` is
the flag that actually answers that question.

**5. Step 6's override attempt genuinely did nothing**

```bash
gcloud resource-manager org-policies describe \
  constraints/compute.vmExternalIpAccess \
  --project=prod-app-001 \
  --effective
```

Run this again after step 6. Correct output: unchanged from check 4 —
still `DENY`. If instead it now shows `ALLOW` or a mixed `allowedValues`
list, the constraint you tested does not behave the way this lab
assumes (some org policy constraints do permit lower-level override by
design), and the "Org Policy only tightens" rule needs to be scoped to
"constraints that don't explicitly allow override," not treated as
universal — worth noting for the exam, since the exact override
behavior is per-constraint, not a single blanket rule.

## Troubleshooting

**1. `PERMISSION_DENIED` on `folders create` even though you're an Org admin in Console**

```
ERROR: (gcloud.resource-manager.folders.create) User [you@example.com] does not have permission to access organizations instance [ORG_ID:getIamPolicy] (or it may not exist)
```

Usually one of: (a) you're authenticated as the wrong identity in
`gcloud` — check `gcloud auth list` and `gcloud config get-value account`
against the identity you expect; (b) you have an Org-level Console role
that doesn't map to the specific `resourcemanager.folderCreator` (or
broader Organization Administrator) IAM permission — Console custom
roles and "admin-sounding" predefined roles don't always include every
permission a raw `gcloud` call needs; (c) `ORG_ID` is wrong — confirm
with `gcloud organizations list`, which only returns organizations
you can actually see.

**2. `ALREADY_EXISTS` on `projects create`**

```
ERROR: (gcloud.projects.create) Project creation failed. The project ID you specified is already in use by another project.
```

Project IDs are global across every GCP customer, not scoped to your
org — `prod-app-001` is a near-certain collision. This is not a quota
or permission problem; append a random suffix or your initials and
retry. Note this is different from **display name** collisions, which
GCP does not reject at all — you can have three folders and five
projects all display-named "Production" in the same org, which is its
own exam trap (don't rely on display names for anything programmatic;
always resolve to the numeric/string ID).

**3. IAM binding "worked" (exit 0) but the Policy Troubleshooter still shows access denied a few seconds later**

IAM policy changes are eventually consistent, not instantaneous —
Google's own guidance is to allow for propagation delay (commonly
cited as up to several minutes) before treating a just-applied binding
as fully live everywhere, including in the Policy Troubleshooter and
in enforcement at resources like Cloud Storage or Compute Engine APIs.
Before assuming step 3's binding is broken, wait a few minutes and
re-check rather than immediately re-applying the binding (re-applying
an already-correct binding doesn't fix a propagation delay, it just
adds a second no-op write).

**4. Org Policy `set-policy` at the project level (step 6) returns success, and you conclude the exam-trap demonstration "failed"**

This is the expected, correct behavior, not a failure — re-read the
verification section 5 above. The command exits 0 because you *are*
allowed to set a project-level policy for that constraint; what you're
not allowed to do is have it take effect in a way that's *looser* than
the inherited value. If you expected an error and instead got a silent
no-op on the effective policy, that's the lab working correctly — the
trap is exactly that Org Policy failures are often silent rather than
loud, unlike an IAM `PERMISSION_DENIED`.

**5. Folder or project stuck in a pending/undeletable state during cleanup**

```
ERROR: (gcloud.resource-manager.folders.delete) FAILED_PRECONDITION: Folder ... is not empty
```

Folders cannot be deleted while they still contain projects or child
folders — GCP enforces bottom-up deletion order. If you deleted the
project first but the error still appears, remember `gcloud projects
delete` moves a project into a 30-day **pending deletion** state, not
immediate removal — the project (and therefore anything under its
parent folder) technically still exists during that window, and the
folder delete will keep failing until either the retention window
elapses or you undo the pending deletion and delete it more forcefully
via Console/API if your workflow requires immediate cleanup.

## Cost Estimate

This lab is effectively **$0** if you delete everything at the end.
Organizations, folders, projects (in the abstract), IAM policy
bindings, and Org Policy constraints carry **no direct charge** — you
are billed for the compute/storage/network *resources* you run inside
a project, and this lab deliberately creates none. The one thing to
watch:

- **The project itself, if left around.** An empty project with no
  resources costs nothing, but it's an easy thing to forget about,
  and a forgotten project is exactly the kind of unmanaged resource
  that later accumulates cost when someone (or some automation) spins
  up something inside it without anyone noticing — the real risk isn't
  this lab's spend, it's this lab's project becoming permanent shadow
  infrastructure.
- **Billing account linkage.** If you linked a billing account to
  `prod-app-001` to satisfy project-creation prerequisites, unlink or
  delete the project promptly — a linked billing account is what turns
  "harmless empty project" into "project someone can accidentally
  deploy billable resources into."

## Cleanup

Delete in this order — child resources before parents, matching the
dependency direction GCP itself enforces (see Troubleshooting #5):

```bash
# 1. Project first (moves to 30-day pending-deletion state, not
#    immediate hard delete)
gcloud projects delete prod-app-001

# 2. Remove the IAM binding at the folder (optional once the folder
#    itself is about to be deleted, but explicit is safer than relying
#    on cascade behavior)
gcloud resource-manager folders remove-iam-policy-binding PROD_FOLDER_ID \
  --member="group:prod-engineers@example.com" \
  --role="roles/compute.admin"

# 3. Clear the Org Policy constraint at the folder (optional for the
#    same reason, but leaves no orphaned policy if you keep the folder
#    around for other work)
gcloud resource-manager org-policies delete \
  constraints/compute.vmExternalIpAccess \
  --folder=PROD_FOLDER_ID

# 4. Folders — only succeeds once truly empty (no projects, even in
#    pending deletion, and no child folders)
gcloud resource-manager folders delete PROD_FOLDER_ID
gcloud resource-manager folders delete NONPROD_FOLDER_ID
gcloud resource-manager folders delete SHARED_SVC_FOLDER_ID
```

If step 1's 30-day pending-deletion window is blocking folder deletion
and you need the folder gone sooner, project deletion can be undone
and re-done, but there is no `gcloud` flag to skip the retention
window from the CLI at the time of writing — treat "give it up to 30
days" as the honest answer rather than guessing at a force-delete flag
that may not exist for your account type.

## Why This Matters for the Exam

This lab is the hands-on version of **Domain 3 (~20%, Designing for
security and compliance) §3.1 — IAM and resource-hierarchy design** and
**Domain 2 (~15%, Managing and provisioning) §2.1's** governance
patterns:

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

**Scenario-question shape this prepares you for:** a case-study-style
question (EHR Healthcare is the most likely of the four given its
compliance emphasis) describes a central security team that wants a
constraint — say, "no VM may have a public IP" or "all data must stay
in `us` locations" — enforced across every current and future project
in a business unit, with individual application teams retaining
day-to-day project-level control otherwise. The trap answers are
usually "have each project owner configure the setting individually"
(no central enforcement, silently drifts) or "grant the security team
Owner on every project" (violates least privilege and doesn't scale).
The correct shape is exactly this lab: attach the constraint at the
folder covering that business unit, let IAM roles below it stay
project-scoped and delegated. A second common variant asks what
happens when a project owner tries to loosen that constraint locally —
this lab's step 6 is the literal rehearsal for recognizing that the
attempt fails silently rather than erroring loudly.
