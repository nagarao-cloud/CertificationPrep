# Domain 5 — Managing Implementation (~11%)

> Source: `00-START-HERE/RUNBOOK.md` §3 (task wording reconstructed —
> see RUNBOOK §1). Smallest domain by weight but a frequent source of
> "which tool should I use" questions that feel deceptively simple —
> the trap is almost always picking a heavier tool than the scenario's
> stated scale/team needs. Focus areas per RUNBOOK §3: traffic
> splitting, Config Connector, tool selection rules, governance
> automation.

## Contents

1. [5.1 Advising development/operations teams](#51-advising-developmentoperations-teams-to-ensure-successful-deployment)
2. [5.2 Interacting with Google Cloud programmatically](#52-interacting-with-google-cloud-programmatically)
3. [Config Connector and governance automation deep dive](#config-connector-and-governance-automation-deep-dive)
4. [Production architecture pattern: governed self-service platform](#production-architecture-pattern-governed-self-service-platform)
5. [Worked scenario walkthrough](#worked-scenario-walkthrough-standing-up-a-project-factory)
6. [Domain 5-specific exam traps](#domain-5-specific-exam-traps)

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
- **12-factor-style guidance the exam expects you to advise on**:
  config via environment variables/Secret Manager (not baked into the
  image), logs treated as an event stream (write to stdout/stderr, let
  Cloud Logging's agent/runtime integration collect them — not custom
  file-based logging the app manages itself), and explicit,
  declared dependencies (container image build reproducibility) —
  advising a team away from any of these patterns when a scenario
  describes them as a source of deployment problems is a Domain 5
  "advise the team" answer, not a Domain 2 provisioning answer.

### API management and connectivity patterns

| Need | Mechanism |
|---|---|
| Publish and govern APIs for external/partner consumers | Cloud Endpoints or Apigee (Apigee for advanced monetization/analytics, Endpoints for simpler internal-external API management) |
| Serverless function needs to reach a private VPC resource (e.g. Cloud SQL private IP) | Serverless VPC Access connector, or direct VPC egress on Cloud Run |
| Specialized workloads (GPU batch, ML training) alongside standard app workloads | GKE node pools with taints/tolerations to isolate specialized hardware from general app pods |
| Rate limiting and quota enforcement per API consumer | Apigee (per-app-key quotas, analytics) — Cloud Endpoints supports basic quota but Apigee is the answer once per-partner tiers/monetization are involved |

### API management decision matrix — Cloud Endpoints vs. Apigee

| Signal in the scenario | Choose | Why |
|---|---|---|
| "Internal-only API, needs auth and basic request logging" | Cloud Endpoints | Apigee's extra capability (monetization, developer portal, advanced analytics) is unused cost/complexity for a purely internal API |
| "External partners need a governed, monetized API surface with tiered access" | Apigee | Apigee adds monetization/analytics/developer-portal capability Endpoints doesn't have |
| "Need a self-service developer portal for third parties to discover and subscribe to our APIs" | Apigee | This is a named Apigee capability, not something Endpoints is built for |
| "Simple gRPC/REST service just needs an API key and basic quota" | Cloud Endpoints | Matches the stated simplicity — reaching for Apigee here is over-engineering the same way Spanner-for-everything is in Domain 1 |

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
- **Traffic splitting mechanics, in detail**: a Cloud Run service with
  revisions `v1` (90% traffic) and `v2` (10% traffic) routes requests
  probabilistically at the percentage specified — no client-side
  routing logic needed, and rollback is simply setting `v1` back to
  100%. GKE traffic splitting via the Gateway API works the same way at
  the HTTPRoute level, weighting backend services instead of Cloud Run
  revisions. A scenario asking "how do we roll back a bad deploy in
  under a minute, with no rebuild" is describing exactly this mechanism
  — advise it explicitly over "redeploy the previous container image,"
  which is slower and unnecessary when revisions are already kept.

### Containerization guidance — what an architect actually advises on

The exam doesn't test Dockerfile syntax, but it does test the
*architectural* guidance an architect gives a dev team containerizing a
workload for the first time:

| Guidance area | What to advise | Why it's an architect-level concern |
|---|---|---|
| Base image choice | Minimal/distroless base images over full OS images | Smaller attack surface (Domain 3 crossover) and faster cold starts on Cloud Run/GKE |
| Image tagging | Immutable, content-addressable tags (e.g. a build SHA), never `:latest` in production | `:latest` breaks reproducibility and makes rollback/Binary Authorization attestation (Domain 2 §2.3, Domain 3 §3.1) meaningless — you can't attest to "whatever `:latest` happens to point to today" |
| Multi-stage builds | Build dependencies excluded from the final runtime image | Smaller image, smaller attack surface, faster pulls — matters at GKE/Cloud Run scale where image pull time affects cold-start/scale-out latency |
| Registry | Artifact Registry with vulnerability scanning enabled | Feeds directly into the Binary Authorization attestation chain (Domain 2 §2.3) — advising a team to skip scanning breaks that chain before it starts |
| Health check endpoints | Application exposes distinct liveness/readiness endpoints | Prerequisite for the probe strategy in Domain 6 §6.2 — advising this at containerization time avoids a rework later |

### API gateway and rate-limiting mechanics

- **Cloud Endpoints** uses an Extensible Service Proxy (ESP/ESPv2)
  sidecar or gateway in front of the backend — API key validation,
  basic quota enforcement, and request logging happen at this layer
  before the request reaches application code.
- **Apigee** adds a full policy-execution pipeline (request/response
  transformation, OAuth/API-key validation, spike arrest, quota
  enforcement per app/developer, analytics) — the architectural reason
  to prefer it over Endpoints is when the *policy* needs to vary per
  external consumer (different partners get different rate limits or
  transformations), not just a single uniform limit for everyone.
- **Spike arrest vs. quota, a distinction worth knowing**: quota
  enforces a *volume* ceiling over a longer window (e.g. 10,000
  calls/day per app); spike arrest smooths *burst rate* over a short
  window (e.g. 10 calls/second) to protect the backend from a sudden
  traffic spike regardless of daily volume — a scenario describing
  backend overload from bursty traffic (not overall volume) wants spike
  arrest specifically, which only Apigee provides.

### GKE release channels — testing/validation implications

| Channel | Upgrade cadence | When to advise it |
|---|---|---|
| Rapid | New Kubernetes versions available soonest, less soak time | Teams that want to validate against upcoming versions early, or need a specific new feature immediately — rarely the production default |
| Regular | Balanced — versions have had moderate real-world soak time | The default recommendation for most production clusters absent a specific reason to deviate |
| Stable | Longest soak time before a version reaches this channel | Risk-averse production workloads, regulated environments where change velocity itself is a risk factor |

- **Advising a team on channel choice is itself a Domain 5 "advise
  dev/ops teams" answer**: a scenario describing "we got burned by an
  unexpected GKE auto-upgrade breaking our workload" is signaling
  either the wrong channel was chosen (Rapid where Stable was
  warranted) or that pre-upgrade testing in a non-prod cluster (§5.1
  above) wasn't part of the process — both are process/advisory
  answers, not a provisioning-mechanism answer.

### Tradeoffs — advising dev/ops teams

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "External partners need a governed, monetized API surface" | Apigee | Cloud Endpoints alone | Apigee adds monetization/analytics/developer-portal capability Endpoints doesn't have |
| "Internal-only API, just needs auth and basic management" | Cloud Endpoints | Apigee | Apigee's extra capability is unused cost/complexity for a purely internal API |
| "Cloud Run service occasionally needs to reach a private Cloud SQL instance" | Serverless VPC Access / direct VPC egress | Exposing Cloud SQL with a public IP + authorized networks | Keeps the database off the public internet entirely — matches least-privilege network design from Domain 3 |
| "Backend keeps getting overloaded by sudden traffic bursts, even though daily volume is within budget" | Apigee spike arrest policy | A higher daily quota, or Cloud Endpoints' basic quota alone | The problem is burst *rate*, not total *volume* — spike arrest is the purpose-built control for that failure mode; raising a daily quota doesn't address bursts at all |
| "Container images are tagged `:latest` and a bad deploy can't be reliably traced back to a specific build" | Immutable, content-addressable image tags (build SHA) | Continue tagging `:latest` and rely on deployment timestamps | Attestation (Binary Authorization, Domain 3 §3.1), rollback, and audit all depend on a tag unambiguously identifying one specific image — `:latest` breaks that guarantee structurally |
| "Need instant rollback of a bad deploy with no rebuild" | Traffic-split back to the prior revision | Redeploy the previous container image from scratch | The prior revision is already running and addressable — shifting traffic is seconds, a rebuild-and-redeploy is minutes and unnecessary |
| "Legacy monolith needs to move to containers but a rewrite isn't in scope this cycle" | Containerize as-is (Replatform), advise a phased refactor later | Advise a full microservices rewrite now | The scenario has explicitly scoped out rewrite time — advising beyond the stated scope isn't the tested judgment call here |

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
6. **One-off exploration/debugging by a human** → Console or Cloud
   Shell is acceptable — don't over-engineer a throwaway task with a
   full IaC pipeline just because IaC is the production default.

### Programmatic access decision path (ASCII)

```
 Need to interact with GCP
        │
        ▼
 Is a human doing one-off exploration or debugging? ──yes──► Console
        │ no                                                 or Cloud Shell
        ▼
 Is this logic embedded inside an application's own runtime? ──yes──►
        │ no                                                  Client
        ▼                                                     library/API
 Is it a Kubernetes-native team managing GCP resources
 alongside K8s manifests in one GitOps loop? ──yes──► Config Connector
        │ no
        ▼
 Default: Terraform in CI/CD (repeatable, reviewed, drift-detected) —
 the answer whenever the scenario says "repeatable," "across
 environments," "audited," or "many projects/teams"
```

### Declarative vs. imperative — the concept the exam checks

- **Declarative** (Terraform, Config Connector, Kubernetes manifests):
  you describe the *desired end state*; the tool computes and applies
  the diff. Drift is detectable (`terraform plan` / GitOps
  reconciliation loop shows the gap between desired and actual state).
- **Imperative** (`gcloud` commands run ad hoc, hand-written scripts
  calling client libraries): you describe the *steps to take*; nothing
  tracks whether the current state still matches what was intended
  after the script ran once.
- **Why this matters for exam answers**: a scenario emphasizing "we
  need to know if someone made a manual change that doesn't match our
  intended configuration" is asking for declarative tooling
  specifically, because drift detection is a structural property of the
  declarative model — an imperative script has no memory of "this is
  what should be true," only "this is what I did once."

### Security posture of each access method

Domain 5's tool choice isn't purely about convenience — it has a
direct Domain 3 crossover:

| Method | Credential model | Security consideration |
|---|---|---|
| Console | Human's own IAM identity, interactive session | Strong identity binding, but no scoped/short-lived credential for automation reuse |
| `gcloud` CLI (human-run) | Human's own IAM identity (via `gcloud auth login`) or an impersonated service account | Fine for interactive/scripted human use; should not be the pattern for unattended automation |
| CI/CD pipeline calling `gcloud`/Terraform/APIs | Workload Identity Federation-issued short-lived token (Domain 3 §3.1) | The correct unattended-automation credential pattern — no standing key |
| Client library embedded in an application | Workload Identity (GKE) or attached service account (Compute Engine/Cloud Run), never an exported key file | Matches the "no exported keys" default established in Domain 3 |

A scenario combining a Domain 5 tool-selection question with a
credential-handling detail (e.g. "our CI pipeline authenticates using a
downloaded JSON key checked into the repo") is testing both domains at
once — the tool-selection answer (Terraform in CI) can be right while
the credential-handling detail is still the wrong, flaggable part of
the scenario.

### Tradeoffs — programmatic interaction

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "New engineer wants to explore what resources exist in a project" | Console | Writing a script for a one-time lookup | Exploration is exactly what the Console is for — scripting a throwaway task adds no value |
| "Need to script a repeatable weekly report" | `gcloud`/`bq` CLI or client library, version controlled | Manually running Console clicks each week | Repeatability and auditability both favor a versioned script over manual repetition |
| "Application needs to create a resource as part of its own runtime logic" | Client library / REST API, called from application code | `gcloud` CLI shelled out from the app | Client libraries are built for embedding in application logic (typed, error-handled); shelling out to a CLI from application code is fragile and non-idiomatic |

---

## Config Connector and governance automation deep dive

### What it is

- **Config Connector**: a GKE add-on that lets you manage GCP resources
  (buckets, Cloud SQL/AlloyDB instances, IAM bindings, Pub/Sub topics,
  etc.) as Kubernetes Custom Resources — `kubectl apply` (or a GitOps
  controller like Config Sync/Argo CD watching a Git repo) provisions
  real GCP infrastructure, using the exact same reconciliation model as
  application workloads.

### Config Connector vs. Terraform decision

| Signal in the scenario | Choose |
|---|---|
| "Team already runs GitOps for Kubernetes manifests" | Config Connector — GCP resources live in the same reconciliation loop |
| "Team manages infra separately from app manifests, wants a mature multi-cloud-capable tool" | Terraform |
| "Need drift detection and a human-readable plan/diff before every change" | Terraform (`terraform plan` is purpose-built for this) |
| "Want GCP resource lifecycle tied 1:1 to a Kubernetes namespace/app lifecycle" | Config Connector |
| "Multiple teams both need to provision GCP resources and manage app manifests through one unified `kubectl`/GitOps workflow" | Config Connector |
| "Need to provision resources GKE/Config Connector doesn't yet support, or resources entirely unrelated to any Kubernetes workload" | Terraform |

### Config Connector — representative resource coverage

A sample of GCP resource types Config Connector can manage as
Kubernetes Custom Resources, useful for recognizing "this is a Config
Connector scenario" quickly:

| Kubernetes Custom Resource | GCP resource it manages |
|---|---|
| `StorageBucket` | Cloud Storage bucket |
| `SQLInstance` | Cloud SQL instance |
| `PubSubTopic` / `PubSubSubscription` | Pub/Sub topic/subscription |
| `IAMPolicyMember` | IAM binding |
| `ComputeNetwork` / `ComputeSubnetwork` | VPC/subnet |
| `BigQueryDataset` | BigQuery dataset |

The pattern to recognize: any of these declared in the same
`kubectl apply`/GitOps flow as the application's own Deployment/Service
manifests is the signal that Config Connector — not a separately-run
Terraform pipeline — is the tool already in use, and the exam-correct
answer is usually "continue using it consistently" rather than
introducing a second, parallel IaC tool for new resources.

### Governance automation — the "project factory" pattern in depth

- **Managing project identity through automation**: project creation,
  labeling, and initial IAM/Org Policy application should itself be
  automated (a "project factory" pattern) rather than manually clicked
  through the Console — critical for any scenario describing many teams
  or frequent new-project requests.
- **What a project factory template typically provisions, as one
  atomic unit**: the project itself, its Shared VPC service-project
  attachment, baseline IAM group bindings, required Org Policy
  constraints inherited or explicitly set, initial budget/labels, and
  (per Domain 2's observability-as-code pattern) a default monitoring
  workspace/dashboard.
- **Self-service without losing governance**: the factory pattern is
  what makes "developers can request a new project without waiting on
  a platform team ticket queue" compatible with "every project still
  meets the org's compliance baseline" — the request is validated
  against policy-as-code before the factory ever runs, not
  hand-reviewed each time.
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

### Tradeoffs — Config Connector and governance automation

| When the scenario says… | Prefer | Don't reach for | Why |
|---|---|---|---|
| "Kubernetes-native team wants GCP resource lifecycle tied to app namespace lifecycle" | Config Connector | Terraform, managed as a separate process | Coupling the GCP resource lifecycle to the same GitOps loop as the app matches the stated team workflow exactly |
| "Dozens of teams request new projects weekly, platform team is a bottleneck" | Project factory (self-service, policy-gated automation) | Manual project creation by the platform team per request | Automation removes the bottleneck while policy-as-code preserves governance — a pure self-service free-for-all would lose the governance the scenario still needs |
| "Non-prod VMs run unattended overnight, wasting cost" | Label-driven automation (e.g. a scheduled function that stops `env:dev`-labeled instances outside business hours) | A manual reminder/process for engineers to stop their own VMs | Automation keyed off existing labels requires no behavior change from engineers and doesn't rely on people remembering |

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
        │
        ▼
 Ongoing operation: traffic-split deploys (this domain's §5.1) roll
 out safely; Recommender API findings (Domain 4) route back through
 the same reviewed-PR pipeline rather than being applied ad hoc
```

**Why this shape:** it's the concrete answer to "how do we let
developers move fast without each one having to understand the full
security/compliance model" — Domain 5's programmatic-interaction and
governance tasks combine with Domain 2's landing zone and Domain 3's
guardrails into one self-service-but-governed platform pattern that
recurs across PCA scenario questions.

---

## Worked scenario walkthrough: standing up a project factory

**Scenario fragment:** *"A rapidly growing company now has 12
engineering teams, each wanting their own GCP project for
experimentation. Today, every new project request goes through the
platform team, who manually applies IAM bindings and Org Policy
constraints from a checklist — requests take 1-2 weeks and the
checklist has drifted (three projects were found last month without
the required CMEK Org Policy applied). Engineering leadership wants
self-service, but Security wants zero regression in policy coverage."*

Applying the framework:

1. **Diagnose the failure mode**: this is a manual-process consistency
   failure (§4.2/§5.2 territory), not a technology-capability gap — the
   checklist itself is presumably correct, but manual application drifts.
2. **§5.2 tool selection**: the recurring, repeatable, audited nature of
   the request ("many teams," "across many projects") is the textbook
   signal for Terraform/Config Connector over Console — a project
   factory module encodes the checklist as code once, applied
   identically every time.
3. **Governance preserved, not traded away**: policy-as-code validation
   (Domain 2 §2.1) runs against every factory-generated request before
   `apply` — this is what lets Engineering get self-service *and*
   Security get zero regression simultaneously, rather than the two
   goals trading off against each other.
4. **Observability and cost bundled in**: per Domain 2's
   observability-as-code and Domain 4's labeling-for-automation
   patterns, the factory module also applies default monitoring and
   cost-attribution labels — so the new self-service path doesn't
   quietly regress on those either.
5. **Result**: request time drops from weeks to (near-)immediate for
   compliant requests, and the CMEK-drift failure mode specifically
   becomes structurally impossible, since the constraint is applied by
   the same code path every time rather than a checklist a human can
   forget a step of.

---

## Common Domain 5 scenario patterns — quick recognition guide

Domain 5 questions tend to repeat a small number of shapes; recognizing
the shape quickly is more valuable here than in domains with deeper
technical content, since the "trick" is almost always tool-selection
restraint rather than unfamiliar services:

| Scenario shape | What it's really testing |
|---|---|
| "We need to deploy a new version safely" | Traffic splitting mechanics (§5.1) — not a new deployment platform |
| "Our team keeps clicking through the Console for repeatable tasks" | Recognizing the automation signal and picking the right tool tier (§5.2 decision path) |
| "Which API management product do we need" | Restraint — match Endpoints/Apigee to the actual stated need, not the more powerful option by default |
| "How do we let teams self-serve without losing control" | Project factory / policy-as-code-gated automation (governance automation section) |
| "A GKE upgrade broke something unexpectedly" | Release channel choice and pre-upgrade testing practice, not a provisioning bug |
| "GCP resources need to live alongside Kubernetes manifests" | Config Connector, recognized from the described GitOps workflow already in place |

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
4. Recommending a full rebuild/redeploy for rollback when the scenario
   describes a platform (Cloud Run, GKE with weighted routing) that
   already supports instant traffic-split rollback — the "how do we
   roll back fast" answer is almost always traffic splitting, not a
   redeploy pipeline.
5. Treating "self-service" and "governed" as inherently in tension —
   the project factory pattern is the exam's standard answer for
   satisfying both simultaneously; don't pick an answer that sacrifices
   governance to achieve self-service speed, or vice versa, when a
   policy-as-code-gated automation answer satisfies both.
6. Over-scoping advice to a dev/ops team beyond what the scenario
   asked — e.g. recommending a full microservices rewrite when the
   scenario explicitly scoped out re-architecture this cycle (§1.4/§5.1
   crossover trap).
