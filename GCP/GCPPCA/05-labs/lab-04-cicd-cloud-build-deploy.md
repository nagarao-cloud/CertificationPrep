# Lab 4: CI/CD Pipeline with Cloud Build + Cloud Deploy (Canary Rollout)

> Implements Domain 5 §5.1/5.2's tooling guidance and Domain 4 §4.3's
> canary release pattern, deploying to the Cloud Run/GKE workload from
> earlier labs.

## Objective

Build a container image on every push, scan it for vulnerabilities,
and progressively roll it out to Cloud Run using a canary
traffic-split strategy with a manual approval gate before full
promotion.

## Prerequisites

- A source repo connected to Cloud Build (GitHub/Cloud Source
  Repositories).
- Artifact Registry repository created.
- A Cloud Run service already deployed once (baseline revision).

## Steps

### 1. Define the CI build (`cloudbuild.yaml`)

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'us-docker.pkg.dev/$PROJECT_ID/repo/app:$SHORT_SHA', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'us-docker.pkg.dev/$PROJECT_ID/repo/app:$SHORT_SHA']
images:
  - 'us-docker.pkg.dev/$PROJECT_ID/repo/app:$SHORT_SHA'
```

```bash
gcloud builds triggers create github \
  --repo-name=app-repo \
  --repo-owner=your-org \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

**Why a trigger scoped to `main`, not every branch:** matches Domain 5
§5.2's "repeatable, reviewed" expectation — feature branches build and
test in isolation (a separate, looser trigger if desired), but only a
merge to `main` should produce an image eligible for deployment.

### 2. Artifact Registry vulnerability scan gate

Artifact Registry scans pushed images automatically; add a step that
checks scan results before allowing deployment:

```yaml
  - name: 'gcr.io/cloud-builders/gcloud'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        SEVERE=$(gcloud artifacts docker images describe \
          us-docker.pkg.dev/$PROJECT_ID/repo/app:$SHORT_SHA \
          --show-package-vulnerability --format="value(vulnerability.criticalSeverityCount)")
        if [ "$SEVERE" -gt "0" ]; then
          echo "Critical vulnerabilities found — blocking deploy"
          exit 1
        fi
```

**Why this step matters for the exam:** demonstrates Domain 4 §4.1's
testing-strategy expectation — a build that produces an image is not
automatically deployable; a security gate is part of the CI process,
not a manual afterthought.

### 3. Define the Cloud Deploy pipeline (`clouddeploy.yaml`)

```yaml
apiVersion: deploy.cloud.google.com/v1
kind: DeliveryPipeline
metadata:
  name: app-pipeline
serialPipeline:
  stages:
    - targetId: staging
    - targetId: prod
      strategy:
        canary:
          runtimeConfig:
            cloudRun: {}
          canaryDeployment:
            percentages: [10, 50]
            verify: true
```

```bash
gcloud deploy apply --file=clouddeploy.yaml --region=us-central1

gcloud deploy releases create rel-$SHORT_SHA \
  --delivery-pipeline=app-pipeline \
  --region=us-central1 \
  --images=app=us-docker.pkg.dev/$PROJECT_ID/repo/app:$SHORT_SHA
```

**Why staging before prod, and canary percentages within prod:** two
layers of risk reduction — staging validates the release against a
non-production environment first (Domain 4 §4.1 testing strategy), and
the canary percentages (10% → 50% → implicit 100%) limit blast radius
within production itself (Domain 4 §4.3's canary pattern, implemented
concretely).

### 4. Approval gate before full promotion

```bash
gcloud deploy rollouts list \
  --delivery-pipeline=app-pipeline \
  --region=us-central1 \
  --release=rel-$SHORT_SHA

gcloud deploy rollouts approve ROLLOUT_ID \
  --delivery-pipeline=app-pipeline \
  --region=us-central1 \
  --release=rel-$SHORT_SHA
```

**Why a manual approval step exists here:** the production target's
strategy requires explicit promotion between canary stages — this is
the Cloud Deploy implementation of Domain 5's "advising dev/ops teams"
guidance: a human decision point before a change reaches full
production traffic, without needing a custom-built approval workflow.

### 5. Rollback (if the canary reveals a problem)

```bash
gcloud deploy rollouts rollback ROLLOUT_ID \
  --delivery-pipeline=app-pipeline \
  --region=us-central1 \
  --release=PREVIOUS_RELEASE_ID
```

**Why this is fast:** Cloud Run's revision model means rollback is a
traffic-split change back to the prior revision, not a rebuild/redeploy
— directly ties back to Domain 6 §6.2's release-management guidance.

### 6. Clean up

```bash
gcloud deploy delivery-pipelines delete app-pipeline --region=us-central1
gcloud builds triggers delete TRIGGER_ID
```

## What this lab demonstrates for the exam

- The CI (Cloud Build) / CD (Cloud Deploy) split, with a security gate
  in between, is the concrete implementation of Domain 2 §2.3's CI/CD
  integration and Domain 4 §4.1's testing-process expectations.
- Canary percentages + an approval gate is the hands-on version of
  Domain 4 §4.3 and Domain 5 §5.1's release-management guidance — not
  just a concept to recognize on a multiple-choice question, but an
  actual pipeline shape.
