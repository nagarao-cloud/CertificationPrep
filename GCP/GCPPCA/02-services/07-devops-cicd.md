# DevOps & CI/CD Services Reference

> Design/process guidance: Domain 2 §2.3, Domain 5 §5.2. This file is
> per-service configuration depth. Every service below follows the
> same checklist: purpose, when to use, when **not** to use (paired
> with the alternative that wins instead), configuration surface,
> cost, performance, scaling, security, HA/failure behavior, common
> mistakes, and exam scenario cues.
>
> **Binary Authorization** is covered here rather than in
> `04-security-iam.md` because it's fundamentally a deploy-pipeline
> enforcement control (it gates what Cloud Build/Cloud Deploy are
> allowed to push into GKE/Cloud Run), and this folder covers each
> service exactly once. It is cross-referenced from
> `04-security-iam.md` and from `01-compute.md`'s GKE section.

## Contents

- [Cloud Build](#cloud-build)
- [Cloud Deploy](#cloud-deploy)
- [Artifact Registry](#artifact-registry)
- [Binary Authorization](#binary-authorization)
- [Terraform on GCP](#terraform-on-gcp)
- [Config Connector](#config-connector)

---

## Cloud Build

**Purpose:** serverless CI — container-native, triggered from source
repos (Cloud Source Repositories, GitHub, GitLab, Bitbucket).

**When to use:** any build/test/scan/package step in a CI pipeline
where the team wants to avoid managing a self-hosted build-server
fleet.

**When NOT to use — use something else instead:**
- A requirement for progressive, gated *delivery* to GKE/Cloud Run
  (not just building/testing artifacts) → **Cloud Deploy** — Cloud
  Build produces the artifact; Cloud Deploy is what promotes it
  through environments with approval gates and rollout strategies.
  Conflating "build" with "deploy" is a common scenario-question trap.
- A build step needing extremely long-running, stateful, or
  interactive execution well outside a typical CI job's shape →
  reconsider whether that step belongs in CI at all, or route it
  through a **Compute Engine/GKE job** instead of forcing it into a
  Cloud Build step.

**Key configuration surface:**
- **Build config** (`cloudbuild.yaml`): a sequence of build steps, each
  running in its own container — naturally maps to "build, test,
  scan, push" pipelines without a self-managed build-server fleet.
- **Triggers**: push to branch, PR/merge-request, tag creation,
  scheduled (Cloud Scheduler-driven), or manual — the mechanism behind
  Domain 2's "plan-on-PR, apply-on-merge" Terraform pipeline pattern.
- **Private pools**: Cloud Build workers running inside your own VPC —
  needed whenever a build step must reach a private resource (an
  internal artifact repo, a private Cloud SQL instance for
  integration tests) without exposing it publicly.
- **Integration with Artifact Registry vulnerability scanning**: builds
  can be gated on scan results, blocking a deploy if a critical
  vulnerability is found in the built image — the CI-layer half of
  Domain 4's testing-strategy expectations, and the step that
  typically precedes Binary Authorization's deploy-time enforcement
  (below).

**Pricing / cost considerations:** billed on build-minutes consumed
(with a free tier); private pools carry an additional standing cost
for the dedicated worker capacity versus the shared default pool —
justified specifically when private-network reachability is a genuine
requirement, not by default for every pipeline.

**Performance characteristics:** each build step runs in its own
container, and steps can be parallelized within a build config where
dependencies allow — build duration is dominated by the slowest
sequential chain of dependent steps, not total step count.

**Scaling behavior:** fully managed, scales build concurrency
automatically across triggered builds — no build-server fleet to size
or queue-manage.

**Security posture:** builds run with a configurable service account
(least-privilege scoping applies exactly as elsewhere in this repo);
private pools keep build traffic off the public internet when
reaching internal resources; integrating vulnerability scanning and
gating on results is the direct supply-chain-security value this
service adds ahead of Binary Authorization's deploy-time check.

**HA / failure-mode behavior:** a failed build step halts the
pipeline at that step (fail-fast by default) rather than silently
continuing — the mechanism that keeps a broken build from reaching
Artifact Registry/deployment; retries can be configured per step for
transient failures.

**Common mistakes / misconfigurations:** using the default (public)
worker pool for a build step that needs to reach a private resource,
causing avoidable failures; not gating on Artifact Registry
vulnerability scan results, allowing a known-vulnerable image to
proceed toward deployment; granting the build service account
broader permissions than the specific build/push actions require.

**Common exam scenario cues:** "plan-on-PR, apply-on-merge" IaC
pipeline pattern; "build step needs to reach a private resource" →
private pools; "gate the pipeline on vulnerability scan results."

---

## Cloud Deploy

**Purpose:** managed continuous delivery specifically for progressive
rollout to GKE and Cloud Run.

**When to use:** any requirement for a defined, auditable progression
of a release through environments (e.g. dev → staging → prod) with
approval gates and a managed canary/standard rollout strategy.

**When NOT to use — use something else instead:**
- The requirement is building/testing/packaging an artifact, not
  promoting it through environments → **Cloud Build** — see Cloud
  Build's own "when not to use" above for the mirror-image version of
  this same distinction.
- The target isn't GKE or Cloud Run (e.g. deploying to Compute
  Engine MIGs or App Engine) → **a MIG rolling-update
  configuration** or **App Engine's own versions/traffic-splitting**
  respectively — Cloud Deploy's managed pipeline is scoped to
  GKE/Cloud Run targets specifically.

**Key configuration surface:**
- **Delivery pipeline**: defines an ordered sequence of target
  environments (e.g. dev → staging → prod) a release progresses
  through.
- **Approval gates**: manual promotion approval before a release
  advances to a sensitive target (typically prod) — the answer whenever
  a scenario requires human sign-off before a production release,
  without hand-building a custom approval workflow.
- **Canary/standard rollout strategies**: built-in support for
  percentage-based canary deployment to GKE/Cloud Run as part of the
  pipeline definition, not a separate custom script — the managed
  implementation of Domain 4 §4.3's canary pattern.
- **Rollback**: one-command rollback to the prior successfully-deployed
  release per target — pairs with Cloud Run/GKE's revision model
  (Domain 5 §5.1) for fast, low-risk recovery.
- **Binary Authorization integration**: a delivery pipeline can be
  configured so a release cannot advance to a protected target unless
  the image satisfies the target's Binary Authorization policy (below)
  — the point where CD and supply-chain enforcement meet directly.

**Pricing / cost considerations:** billed per active delivery
pipeline plus the number of deployments executed — a modest
incremental cost relative to the risk/effort saved versus hand-built
promotion scripting and manual approval tracking.

**Performance characteristics:** rollout duration for canary
strategies is governed by the configured pipeline stages (percentage
steps, bake time between steps) — a scenario wanting faster/slower
rollout cadence is really asking about pipeline configuration, not a
raw service-performance limit.

**Scaling behavior:** manages an arbitrary number of concurrent
releases/pipelines across projects without additional infrastructure
to provision.

**Security posture:** approval gates enforce human sign-off at
sensitive promotion points; IAM scopes who can approve/promote a
release; combined with Binary Authorization, a release can be blocked
from reaching a protected target on *both* a human-approval basis and
an image-trust basis.

**HA / failure-mode behavior:** one-command rollback to the prior
successfully-deployed release is the primary fast-recovery mechanism
— directly reduces MTTR for a bad release versus a manual, ad hoc
rollback process.

**Common mistakes / misconfigurations:** treating Cloud Build and
Cloud Deploy as interchangeable (a scenario naming "build" versus
"promote/deploy" is signaling which service is actually being asked
about); no approval gate configured before a production target,
missing the human-sign-off requirement a scenario states explicitly;
not wiring Binary Authorization into the pipeline when supply-chain
trust was a stated requirement.

**Common exam scenario cues:** "require manual sign-off before
production release" → approval gates; "canary rollout to GKE/Cloud
Run managed by the platform, not a custom script"; "fast, one-step
rollback to the last known-good release."

---

## Artifact Registry

**Purpose:** successor to Container Registry — multi-format package/
artifact storage (Docker images, language packages like Maven/npm/
Python, OS packages).

**When to use:** the canonical storage location for any built
artifact (container image or language package) that CI/CD pipelines
push to and GKE/Cloud Run/Cloud Build pull from.

**When NOT to use — use something else instead:**
- Storing large, non-package build outputs (logs, test reports, raw
  data files) → **Cloud Storage** — Artifact Registry is scoped to
  package/artifact formats with their own metadata (image layers,
  package manifests), not general-purpose blob storage.
- A scenario still referencing Container Registry as the target for
  new work → **Artifact Registry** is the current, exam-preferred
  answer; Container Registry appears in this folder only as legacy
  context, never as the recommended new target.

**Key configuration surface:**
- **Vulnerability scanning**: automatic scanning of container images on
  push, surfacing known CVEs — the answer whenever a scenario wants
  supply-chain security visibility without a separate third-party
  scanning tool, and the signal Cloud Build gates on and Binary
  Authorization's attestors can incorporate.
- **Regional repositories**: co-locate artifact storage with the
  compute (GKE/Cloud Run) that pulls it, reducing pull latency and
  cross-region egress cost — relevant to any Domain 1/4 cost/latency
  optimization question touching the deployment pipeline.
- **IAM-scoped access per repository**: least-privilege separation
  between teams' artifact repos, consistent with the resource-hierarchy
  IAM pattern in Domain 3.

**Pricing / cost considerations:** billed on storage consumed plus
network egress for pulls (mitigated by regional co-location, above);
vulnerability scanning is generally included as part of the pull-
request/CI workflow value rather than a separately metered concern to
optimize away.

**Performance characteristics:** pull latency for GKE pod startup/
Cloud Run cold start is directly affected by repository region versus
consuming compute's region — a cross-region pull adds avoidable
latency to every deploy and every cold start.

**Scaling behavior:** scales automatically with artifact volume and
pull concurrency; no capacity to provision.

**Security posture:** the supply-chain visibility layer immediately
upstream of Binary Authorization's enforcement — Artifact Registry
*finds* vulnerabilities and stores provenance/attestation metadata;
Binary Authorization *enforces* that only images meeting policy
(which can include "no critical CVEs," "signed by a required
attestor") are actually deployable.

**HA / failure-mode behavior:** regional repositories carry that
region's fault-domain characteristics; a design needing cross-region
deploy resilience should ensure the relevant images are available
(replicated or independently pushed) to each region's repository the
deploy targets.

**Common mistakes / misconfigurations:** pulling images cross-region
unnecessarily, adding latency/egress cost; not enabling vulnerability
scanning and discovering a critical CVE only after deployment; still
referencing Container Registry for new pipelines instead of Artifact
Registry.

**Common exam scenario cues:** "reduce image pull latency/cross-
region egress cost in the deployment pipeline" → regional
repositories; "supply-chain vulnerability visibility without a
separate third-party tool" → built-in vulnerability scanning.

---

## Binary Authorization

> **Confidence note:** current and architect-relevant per RUNBOOK §6 —
> added in the 2026-08-10 depth-remediation pass after being entirely
> absent from this folder's first generation. Positioning below
> reflects Binary Authorization's stable, well-established role as
> GCP's deploy-time image-attestation control; verify current specific
> attestor/policy syntax against `cloud.google.com` before quoting
> exact configuration details in a live setting.

**Purpose:** deploy-time enforcement that only trusted, attested
container images can be deployed to GKE or Cloud Run — a
supply-chain-security control that answers "is this specific image
allowed to run here," distinct from *who* is allowed to deploy (IAM)
or *whether the image has known vulnerabilities* (Artifact Registry
scanning, which reports; Binary Authorization enforces).

**When to use:**
- Any scenario requiring proof that a deployed container image
  actually passed a defined process (built by CI, scanned clean,
  signed by a specific team/step) before it's allowed to run in a
  given environment — especially production.
- Regulated or security-sensitive workloads where "we trust our CI
  pipeline" needs to become "we can prove, at deploy time, that this
  exact image came from our CI pipeline and passed required checks,"
  not just an informal process assumption.
- Multi-stage environments (dev/staging/prod) where progressively
  stricter attestation requirements should gate promotion — e.g. an
  image only needs a "build" attestation to reach staging, but needs
  an additional "QA-passed" attestation to reach production.

**When NOT to use — use something else instead:**
- The requirement is *detecting* vulnerabilities or misconfigurations,
  not *blocking* deployment based on trust/attestation → **Artifact
  Registry vulnerability scanning** and/or **Security Command Center**
  (`04-security-iam.md`) are the detection/reporting layer; Binary
  Authorization is specifically the enforcement/blocking layer built
  on top of signals like these, not a replacement for either.
- The requirement is controlling *who* (which human/service account)
  can trigger a deployment → **IAM**, not Binary Authorization — Binary
  Authorization evaluates the image itself, not the identity
  performing the deploy; the two are complementary controls
  addressing different questions ("is this person allowed to deploy"
  vs. "is this image allowed to run").
- The target isn't GKE or Cloud Run → Binary Authorization's
  enforcement point is specifically the GKE admission controller and
  Cloud Run's deploy-time check; a Compute Engine-based deployment
  needs a different supply-chain control (e.g. custom image validation
  in the CI pipeline itself), since there's no equivalent built-in
  admission gate for raw VM images.
- A low-stakes dev/sandbox environment with no compliance driver and
  where enforcement friction would slow iteration with no
  corresponding risk reduction → a permissive or disabled policy for
  that specific environment, while still enforcing strictly in
  staging/prod — policy can and should differ per environment/cluster.

**Key configuration surface:**
- **Policy**: a project- (or cluster-)level configuration defining the
  default admission rule (e.g. "require at least one attestation from
  attestor X") and any per-image or per-namespace exceptions.
- **Attestors**: an attestor represents a specific verification step
  (e.g. "passed CI build," "passed QA sign-off," "passed a security
  scan with no critical findings") and holds the cryptographic key(s)
  used to sign attestations for images that pass that step.
- **Attestations**: a signed statement, tied to a specific container
  image digest (not a mutable tag), asserting that a named attestor's
  verification step was satisfied for that exact image — the
  digest-based binding is what prevents a tag being silently
  repointed to a different, unverified image after attestation.
- **Enforcement modes**: "always allow" (dry-run/audit-only, logs
  violations without blocking — the safe rollout method, directly
  parallel to VPC-SC's dry-run mode) versus "always deny except" the
  images satisfying policy — the same staged-rollout principle used
  elsewhere in this file/folder for introducing a new enforcement
  control without breaking existing deploys unexpectedly.
- **Integration points**: Cloud Build can automatically generate an
  attestation as a build step on success; Cloud Deploy can be
  configured to only promote a release to a target whose Binary
  Authorization policy the image satisfies; GKE enforces policy via an
  admission controller at pod-creation time; Cloud Run enforces policy
  at service/revision deploy time.

**Pricing / cost considerations:** no separate direct usage fee for
the policy/attestation mechanism itself; the practical cost is
pipeline engineering time (building attestor integration into
CI/CD) and, if a required attestation is missing at deploy time, the
operational cost of a blocked deployment — mitigated by using dry-run/
audit-only mode during initial rollout to catch gaps before hard
enforcement.

**Performance characteristics:** admission-time policy evaluation
adds a small, one-time check at pod-creation (GKE) or deploy-time
(Cloud Run) — not a runtime/request-path performance factor once a
workload is already running.

**Scaling behavior:** policy applies automatically to every
deployment attempt against a governed cluster/service with no
per-deployment manual configuration — scales with deployment volume
at no additional operational cost per deploy, the same "set the
guardrail once, it governs everything underneath" pattern as Org
Policy.

**Security posture:** the specific supply-chain control answering
"can we prove this exact image came from our trusted pipeline and
passed required checks" — complements Artifact Registry's
vulnerability *detection*, IAM's identity-based access control, and
Security Command Center's broader posture correlation (which can
surface an unattested or policy-violating deploy attempt as a
finding) without duplicating any of them. The digest-based (not
tag-based) attestation binding is the detail that closes the "tag was
silently repointed after review" loophole a naive tag-based trust
model would have.

**HA / failure-mode behavior:** enforcement fails *closed* by
default in "always deny except" mode — a deploy lacking a required
attestation is blocked, not allowed through with a warning; this is
why dry-run/audit-only mode is the recommended rollout path (mirrors
VPC-SC's dry-run pattern) to surface every gap in existing pipelines
before switching to hard enforcement and risking a legitimate,
previously-informal deploy path being unexpectedly blocked in
production.

**Common mistakes / misconfigurations:**
- Switching directly to hard enforcement without a dry-run/audit
  period first, causing unexpected production deployment blocks.
- Using tag-based trust assumptions elsewhere in the pipeline while
  Binary Authorization correctly enforces digest-based attestation,
  creating a confusing mismatch between how different tools reason
  about "the same" image.
- Treating Binary Authorization as sufficient on its own for
  supply-chain security without also enabling Artifact Registry
  vulnerability scanning — attestation proves a process was followed,
  it doesn't independently verify the image is vulnerability-free
  unless an attestor's process specifically checks that.
- Applying the same strict policy uniformly to dev/sandbox and
  production, adding enforcement friction to environments where the
  compliance driver doesn't apply.
- Forgetting Binary Authorization has no direct equivalent for
  Compute Engine VM-based deployments, then assuming a VM-based
  workload is covered when it isn't.

**Common exam scenario cues:** "only deploy container images that
have passed a defined CI/QA process, provably," "prevent an
unverified or unscanned image from ever reaching production,"
"supply-chain security for container deployments to GKE/Cloud Run,"
"safely introduce a new deploy-time security control without breaking
existing pipelines" → dry-run/audit-only mode first.

---

## Terraform on GCP

**Purpose:** the expected default IaC tool per this repo's CLAUDE.md
and this folder's conventions (see Domain 2 §2.1/2.3 for design-time
usage).

**When to use:** any repeatable, version-controlled, peer-reviewable
infrastructure provisioning need — the default answer whenever a
scenario describes a team of engineers collaborating on
infrastructure changes.

**When NOT to use — use something else instead:**
- A Kubernetes-native, GitOps-first team that wants GCP resource
  lifecycle tied to the same reconciliation loop as application
  manifests → **Config Connector** (below) — not a general
  substitute for Terraform outside that specific team-shape/workflow
  fit.
- A one-off, throwaway resource with no need for repeatability or
  peer review (rare on this exam, but worth naming as the edge case
  where IaC's overhead genuinely isn't justified) → manual
  console/`gcloud` provisioning may be acceptable, though the exam
  generally rewards IaC as the default professional answer.

**Key configuration surface:**
- **Google provider (`hashicorp/google`)**: covers essentially the full
  GCP resource surface, with a companion `google-beta` provider for
  preview features.
- **Remote state**: a GCS backend with state locking is the standard
  production pattern — local state is a single-point-of-failure/no-
  collaboration anti-pattern the exam would flag in a "team of
  engineers collaborating on infra" scenario.
- **Modules**: reusable, versioned building blocks (e.g. a standard
  "landing zone project" module) — the mechanism behind Domain 2's
  repeatable provisioning pipeline and Domain 5's "project factory"
  pattern.
- **`terraform plan` in CI**: posts a reviewable diff before any
  `apply` — the concrete implementation of "peer-reviewed, auditable
  infrastructure changes" (Domain 2 exam trap #2).

**Pricing / cost considerations:** Terraform itself carries no direct
GCP service cost; the GCS backend for remote state and any CI runners
executing plan/apply incur their own (typically small) cost — the
real cost lever is what Terraform *provisions*, not Terraform's own
operation.

**Performance characteristics:** plan/apply duration scales with the
number of resources managed in a given state/module — very large,
monolithic state files slow down plan operations and increase
blast-radius risk; splitting state by logical boundary (per
environment, per team) is the practical mitigation.

**Scaling behavior:** modules are the mechanism for scaling
consistent provisioning patterns across many projects/teams without
duplicating configuration — directly supports Domain 5's
"project factory" pattern for onboarding new teams/projects
consistently.

**Security posture:** the service account/credentials Terraform runs
as should be scoped to exactly what its managed resources require
(least privilege, consistent with `04-security-iam.md`); remote state
itself can contain sensitive values (e.g. generated secrets) and
should be stored in a restricted-access, encrypted backend.

**HA / failure-mode behavior:** state locking (via the GCS backend)
prevents two concurrent applies from corrupting state — a
scenario describing "two engineers ran apply simultaneously and
corrupted our infrastructure state" is testing whether remote state
with locking was in place.

**Common mistakes / misconfigurations:** using local state for a
team-collaborative environment, causing state drift/conflicts; not
running `plan` in CI before `apply`, skipping the peer-review step
the exam expects; an overly broad service account for Terraform's own
execution identity.

**Common exam scenario cues:** "team of engineers collaborating on
infrastructure changes," "peer-reviewed, auditable infrastructure
changes," "reusable, versioned provisioning pattern across many
projects" → modules/project-factory pattern.

---

## Config Connector

**Purpose:** a GKE add-on exposing GCP resources as Kubernetes Custom
Resources — `kubectl apply`/GitOps provisions real GCP
infrastructure.

**When to use:** a Kubernetes-native, GitOps-first team that wants GCP
resource lifecycle (databases, buckets, IAM bindings, and more) tied
to the same reconciliation loop and tooling as their application
manifests.

**When NOT to use — use something else instead:**
- A general infrastructure-provisioning need outside a
  Kubernetes-centric team/workflow → **Terraform** — Config Connector
  is not a general substitute for Terraform; it specifically fits
  teams already fully invested in Kubernetes-native GitOps tooling.
- Provisioning the GKE cluster itself (a bootstrapping problem — the
  cluster Config Connector runs on has to be created by something
  else first) → **Terraform** for the initial cluster/bootstrap layer,
  with Config Connector potentially managing resources *within* that
  cluster's Kubernetes-native workflow afterward.

**Key configuration surface:**
- **When it's the answer over Terraform**: the scenario describes a
  Kubernetes-native, GitOps-first team that wants GCP resource
  lifecycle tied to the same reconciliation loop as their application
  manifests (see Domain 5 §5.2's decision table) — not a general
  substitute for Terraform in non-Kubernetes-centric teams.
- **Namespace-scoped or cluster-scoped resources**: Config Connector
  resources can be scoped per-namespace (aligning GCP resource
  lifecycle with a specific app/team's namespace) or cluster-scoped —
  namespace-scoped is the better fit for a self-service multi-tenant
  cluster pattern (Domain 5's governed self-service platform pattern).

**Pricing / cost considerations:** no separate direct fee beyond the
GKE cluster it runs on (an add-on, not a billed service in its own
right); the resources it provisions are billed exactly as if they'd
been created any other way — the cost consideration is entirely about
which tool provisions the resource, not a different price for the
resource itself.

**Performance characteristics:** reconciliation latency (time from a
manifest change to the actual GCP resource reflecting it) is governed
by Kubernetes's own controller reconciliation loop cadence — generally
not instantaneous, a relevant nuance versus a direct `terraform apply`
which completes synchronously.

**Scaling behavior:** namespace-scoped resources scale cleanly across
a growing number of teams/tenants in a shared cluster, each managing
their own GCP resources within their namespace boundary without
needing cluster-wide access.

**Security posture:** namespace scoping is itself a security/
multi-tenancy boundary — a team's Config Connector permissions can be
restricted to their own namespace, preventing cross-team resource
interference in a shared, self-service cluster; IAM still governs the
underlying GCP permissions Config Connector's own service account
needs to actually create the resources it's asked to manage.

**HA / failure-mode behavior:** relies on the underlying GKE
cluster's own availability; if the cluster running Config Connector is
down, reconciliation (and therefore GCP resource management through
this path) pauses until the cluster recovers — a dependency worth
naming explicitly if a scenario proposes Config Connector as the
*sole* provisioning path for infrastructure that needs to remain
manageable even during a cluster incident.

**Common mistakes / misconfigurations:** using Config Connector as a
blanket Terraform replacement for teams with no Kubernetes-native
workflow investment, adding unnecessary complexity; cluster-scoping
resources that should be namespace-scoped in a multi-tenant
self-service platform, breaking the intended team isolation; not
accounting for the cluster itself as a bootstrapping dependency when
proposing Config Connector as the only IaC mechanism in a design.

**Common exam scenario cues:** "Kubernetes-native GitOps team wants
GCP resources managed the same way as application manifests,"
"self-service multi-tenant cluster where each team manages its own
GCP resources within its namespace" → namespace-scoped resources.
