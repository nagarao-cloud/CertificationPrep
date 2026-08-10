# DevOps & CI/CD Services Reference

> Design/process guidance: Domain 2 §2.3, Domain 5 §5.2. This file is
> per-service configuration depth.

## Contents

- [Cloud Build](#cloud-build)
- [Cloud Deploy](#cloud-deploy)
- [Artifact Registry](#artifact-registry)
- [Terraform on GCP](#terraform-on-gcp)
- [Config Connector](#config-connector)

---

## Cloud Build

Serverless CI — container-native, triggered from source repos (Cloud
Source Repositories, GitHub, GitLab, Bitbucket).

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
  Domain 4's testing-strategy expectations.

## Cloud Deploy

Managed continuous delivery specifically for progressive rollout to GKE
and Cloud Run.

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

## Artifact Registry

Successor to Container Registry — multi-format package/artifact
storage (Docker images, language packages like Maven/npm/Python,
OS packages).

- **Vulnerability scanning**: automatic scanning of container images on
  push, surfacing known CVEs — the answer whenever a scenario wants
  supply-chain security visibility without a separate third-party
  scanning tool.
- **Regional repositories**: co-locate artifact storage with the
  compute (GKE/Cloud Run) that pulls it, reducing pull latency and
  cross-region egress cost — relevant to any Domain 1/4 cost/latency
  optimization question touching the deployment pipeline.
- **IAM-scoped access per repository**: least-privilege separation
  between teams' artifact repos, consistent with the resource-hierarchy
  IAM pattern in Domain 3.

## Terraform on GCP

The expected default IaC tool per this repo's CLAUDE.md and this
folder's conventions (see Domain 2 §2.1/2.3 for design-time usage).

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

## Config Connector

A GKE add-on exposing GCP resources as Kubernetes Custom Resources —
`kubectl apply`/GitOps provisions real GCP infrastructure.

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
