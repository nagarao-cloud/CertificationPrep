# Domain 5 — Managing Implementation (~11%)

> Source: `00-START-HERE/RUNBOOK.md` §3 (task wording reconstructed —
> see RUNBOOK §1). Smallest domain by weight but a frequent source of
> "which tool should I use" questions that feel deceptively simple —
> the trap is almost always picking a heavier tool than the scenario's
> stated scale/team needs.

## Contents

1. [5.1 Advising development/operations teams](#51-advising-developmentoperations-teams-to-ensure-successful-deployment)
2. [5.2 Interacting with Google Cloud programmatically](#52-interacting-with-google-cloud-programmatically)
3. [Production architecture pattern: governed self-service platform](#production-architecture-pattern-governed-self-service-platform)
4. [Domain 5-specific exam traps](#domain-5-specific-exam-traps)

---

## 5.1 Advising development/operations teams to ensure successful deployment

### Application development best practices on GCP

- **Stateless-by-default**: session state externalized to Memorystore
  or a database, not held in-process — required for horizontal
  autoscaling to actually work on Cloud Run/GKE/MIGs.
- **Dependency management**: prefer managed runtimes (Cloud Run,
  App Engine Standard) when the team wants Google to own patching of
  the underlying OS/runtime; containerize explicitly (GKE, Cloud Run
  with a custom image) when the team needs dependency versions the
  managed runtime doesn't offer.
- **Containerizing legacy workloads**: a scenario describing an
  existing monolith being "lifted" into containers without a rewrite is
  signaling Cloud Run or GKE with minimal code change (Replatform, see
  Domain 1 §1.4) — advise against a premature microservices rewrite
  unless the scenario states that's an explicit goal.

### API management and connectivity patterns

| Need | Mechanism |
|---|---|
| Publish and govern APIs for external/partner consumers | Cloud Endpoints or Apigee (Apigee for advanced monetization/analytics, Endpoints for simpler internal-external API management) |
| Serverless function needs to reach a private VPC resource (e.g. Cloud SQL private IP) | Serverless VPC Access connector, or direct VPC egress on Cloud Run |
| Specialized workloads (GPU batch, ML training) alongside standard app workloads | GKE node pools with taints/tolerations to isolate specialized hardware from general app pods |

### Testing and validation strategies (implementation-time)

- **GKE versioning**: test against the target GKE minor version in a
  non-prod cluster before upgrading production — GKE's release-channel
  model (Rapid/Regular/Stable) is the mechanism for controlling how
  aggressively a cluster auto-upgrades.
- **Traffic splitting for canary/blue-green** (implementation
  mechanics — see Domain 4 §4.3 for the *strategy* decision, this is
  the *how*): Cloud Run revisions with percentage-based traffic
  splits; GKE via Gateway API/Ingress weighting.
- **Rollback procedures**: Cloud Functions/Cloud Run keep prior
  revisions addressable — rollback is a traffic-split change, not a
  redeploy, which is why it's fast and low-risk when configured
  correctly ahead of time.

### Tradeoffs — advising dev/ops teams

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "External partners need a governed, monetized API surface" | Apigee | Cloud Endpoints alone | Apigee adds monetization/analytics/developer-portal capability Endpoints doesn't have |
| "Internal-only API, just needs auth and basic management" | Cloud Endpoints | Apigee | Apigee's extra capability is unused cost/complexity for a purely internal API |
| "Cloud Run service occasionally needs to reach a private Cloud SQL instance" | Serverless VPC Access / direct VPC egress | Exposing Cloud SQL with a public IP + authorized networks | Keeps the database off the public internet entirely — matches least-privilege network design from Domain 3 |

---

## 5.2 Interacting with Google Cloud programmatically

See `00-START-HERE/DECISION-TREES.md` Tree 6 for the full Console vs.
CLI vs. API vs. IaC decision tree. This section adds the tool-selection
detail beyond the tree's top-level branches.

### Primary access methods compared

| Method | Best for | Audit trail | Repeatability |
|---|---|---|---|
| Console | Exploration, one-off inspection, first-time learning | Weak (no code diff, though Cloud Audit Logs still record the API calls it makes under the hood) | None |
| Cloud Shell | Ad hoc scripting without local setup | Same as CLI (it *is* the CLI, hosted) | Depends on scripts used |
| `gcloud`/`gsutil`/`bq` CLI | Scriptable automation, glue between systems, quick repeatable ops tasks | Good (shell history, script source control if saved) | Good if scripted and versioned |
| Client libraries / REST / RPC APIs | Application-embedded automation, custom tooling | Good (application logs) | Excellent — part of the app's own codebase |
| Terraform / Config Connector | Declarative infrastructure, team review, drift detection | Excellent (plan output, PR review, state history) | Excellent — the standard for production infra |

### Declarative management with Config Connector

- **What it is**: a GKE add-on that lets you manage GCP resources
  (buckets, Cloud SQL instances, IAM bindings, etc.) as Kubernetes
  Custom Resources — `kubectl apply` provisions real GCP infrastructure.
- **Config Connector vs. Terraform decision**:

  | Signal in the scenario | Choose |
  |---|---|
  | "Team already runs GitOps for Kubernetes manifests" | Config Connector — GCP resources live in the same reconciliation loop |
  | "Team manages infra separately from app manifests, wants a mature multi-cloud-capable tool" | Terraform |
  | "Need drift detection and a human-readable plan/diff before every change" | Terraform (`terraform plan` is purpose-built for this) |
  | "Want GCP resource lifecycle tied 1:1 to a Kubernetes namespace/app lifecycle" | Config Connector |

### Resource governance and automated deployment

- **Managing project identity through automation**: project creation,
  labeling, and initial IAM/Org Policy application should itself be
  automated (a "project factory" pattern) rather than manually clicked
  through the Console — critical for any scenario describing many teams
  or frequent new-project requests.
- **Organization Policies for governance**: applied as code, version
  controlled, same CI/CD review process as any other infrastructure
  change (see Domain 2 §2.1/2.3).
- **Resource labeling for automation**: labels aren't just for cost
  attribution (Domain 4 §4.2) — automation scripts and policies key off
  labels (e.g. "auto-shutdown non-prod VMs tagged `env:dev` outside
  business hours").
- **MIG update policies for automated deployment**: `maxSurge`/
  `maxUnavailable` settings control rollout speed vs. safety without
  custom scripting.

### Tool-selection decision rules (exam-ready summary)

1. **Deployment safety** is the concern → traffic splitting (Cloud Run
   revisions, GKE weighted routing).
2. **Kubernetes YAML + GCP resources together** → Config Connector.
3. **Scale and repeatability** matter → `gcloud`/APIs/Terraform, not
   Console.
4. **Secure internal access from serverless to a VPC resource** → VPC
   Connector / Private Service Connect (see Domain 3 §3.1).
5. **Governance at scale across many projects/teams** → Org Policies +
   labeling + automation (project factory pattern), not per-project
   manual configuration.

---

## Production architecture pattern: governed self-service platform

```
 Developer submits a "new service" request (via a templated PR to
 an infra repo, or a self-service portal backed by the same repo)
        │
        ▼
 CI validates the request against Org Policy / OPA-style policy-as-code
 (e.g. must use an approved machine type, must have labels, must not
 request an external IP in a restricted folder)
        │
   ┌────┴────┐
  pass       fail
   │           │
   ▼           ▼
 Cloud Build   Rejected with a specific policy-violation message
 applies via   (self-service, but governed — not a free-for-all)
 Terraform/
 Config Connector
        │
        ▼
 New project/service provisioned already inside the correct folder
 (inheriting Org Policy + hierarchical firewall + IAM group bindings
 from Domain 2's landing zone), with monitoring/alerting and labels
 applied automatically as part of the same pipeline (Domain 4 §4.1
 "observability by default")
```

**Why this shape:** it's the concrete answer to "how do we let
developers move fast without each one having to understand the full
security/compliance model" — Domain 5's programmatic-interaction and
governance tasks combine with Domain 2's landing zone and Domain 3's
guardrails into one self-service-but-governed platform pattern that
recurs across PCA scenario questions.

---

## Domain 5-specific exam traps

1. Reaching for Terraform when the scenario's team is explicitly
   Kubernetes-native and GitOps-based — Config Connector is the
   better-fit answer there, even though Terraform is the "default"
   assumption elsewhere in this folder.
2. Recommending the Console for anything described as recurring,
   automated, or "across many projects" — that phrasing always rules
   out Console/manual steps.
3. Picking Apigee by reflex for any API question — check whether the
   scenario actually needs monetization/developer-portal capability
   before reaching past the simpler Cloud Endpoints.
