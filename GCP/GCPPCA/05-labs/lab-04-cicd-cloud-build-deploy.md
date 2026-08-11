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
- The Cloud Build, Artifact Registry, and Cloud Deploy APIs enabled on
  the project, and the Cloud Build service account granted the roles
  it needs to deploy (see Troubleshooting — this is the single most
  common first-run blocker for this lab).

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

Note: vulnerability scan results are not necessarily available the
instant a push completes — the scan runs asynchronously against the
newly-pushed image, so a gate step that queries results immediately
after `docker push` can race the scanner. In production pipelines this
is usually handled with a short poll/retry loop around the `describe`
call rather than a single immediate check; the single-check version
above is simplified for lab clarity — say so explicitly rather than
presenting it as production-ready as written.

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

This `DeliveryPipeline` resource references two `Target` resources
(`staging` and `prod`) by ID — those targets aren't defined in the
snippet above and must exist separately (each a `Target` YAML manifest
naming the actual Cloud Run service/region, applied with the same
`gcloud deploy apply` command used for the pipeline). Don't skip
defining them; `gcloud deploy apply` on the pipeline alone will fail
or leave stages unresolvable if the targets it references don't exist
yet.

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

## Verification

**1. The build trigger actually fires on a push to `main`, and only `main`**

```bash
gcloud builds triggers describe TRIGGER_ID --format="value(github.push.branch)"
```

Correct output: `^main$` (the regex from step 1). Push a trivial commit
to a **different** branch and confirm in `gcloud builds list
--limit=5` that no build was started for it, then push to `main` and
confirm one was. Misconfiguration signal: builds firing on every
branch — usually means `--branch-pattern` was left too permissive
(e.g. `.*`) or a second, older trigger from an earlier experiment is
still active alongside this one (`gcloud builds triggers list` to
check for duplicates).

**2. The vulnerability gate actually blocks a genuinely vulnerable image**

Deliberately build from a base image with known critical CVEs (an old,
unpatched base image tag is usually enough) and confirm the build
**fails** at the gate step with the "Critical vulnerabilities found"
message, and that `gcloud builds list` shows that build's status as
`FAILURE`, not `SUCCESS`. Misconfiguration signal: the build reports
`SUCCESS` despite a known-vulnerable base image — check the race
condition noted in step 2 above (scan not yet complete when queried),
and check that the shell step's exit code is actually propagating
(a `bash -c` step swallowing a non-zero exit inside a pipeline can
silently report success — worth confirming with `echo $?` immediately
after the check inside the same script).

**3. The pipeline and targets resolved correctly, not just "applied without error"**

```bash
gcloud deploy delivery-pipelines describe app-pipeline --region=us-central1
gcloud deploy targets list --region=us-central1
```

Correct output: the pipeline describe shows both `staging` and `prod`
stages present with the `prod` stage's canary strategy percentages
`[10, 50]`; the targets list shows both `staging` and `prod` targets
existing and each pointing at the Cloud Run service/region you
intended. Misconfiguration signal: `gcloud deploy apply` returned
success but a stage's `targetId` doesn't match any real target's name
— this is a common copy-paste mismatch (e.g. target defined as
`prod-target` but pipeline stage references `prod`) and Cloud Deploy
does not always fail loudly at apply time for every such mismatch;
releases created against a broken pipeline reference can fail later,
at release-creation or rollout time, with a less obvious error.

**4. The canary rollout is really only serving 10% of traffic at the first stage, not 100%**

```bash
gcloud run services describe SERVICE_NAME --region=us-central1 \
  --format="value(status.traffic)"
```

Correct output: a traffic list showing roughly a 90/10 split between
the previous revision and the new canary revision immediately after
the first canary phase deploys (before approval). Misconfiguration
signal: the new revision shows 100% traffic immediately — means the
`canary` strategy block wasn't actually applied to the `prod` target
(check the pipeline YAML was applied against the *correct* target
resource, not accidentally left as the default `standard` strategy
Cloud Deploy uses when no strategy is specified).

**5. Rollback actually restores prior behavior, not just prior code**

After a rollback, re-check `gcloud run services describe SERVICE_NAME
--format="value(status.traffic)"` — correct output shows 100% traffic
back on the previous revision's ID. If application-level state (e.g. a
database migration the failed release ran) changed as part of the
canary, note explicitly that Cloud Deploy's rollback is a **traffic**
rollback only — it does not undo database migrations or other
non-traffic side effects, which is a common exam-trap gap between
"rolled back the deployment" and "rolled back the change."

## Troubleshooting

**1. Cloud Build's service account lacks permission to deploy**

```
ERROR: (gcloud.deploy.releases.create) PERMISSION_DENIED: caller does not have permission
```

Cloud Build runs as a dedicated service account
(`PROJECT_NUMBER@cloudbuild.gserviceaccount.com` by default, or a
user-specified one on newer projects) that does **not** automatically
have Cloud Deploy, Cloud Run deploy, or Artifact Registry write
permissions — those must be granted explicitly (commonly
`roles/clouddeploy.releaser`, `roles/run.developer`,
`roles/artifactregistry.writer`) as a one-time setup step this lab's
happy-path steps don't show. If step 3's `releases create` (whether
run manually or as a later pipeline step invoked from Cloud Build)
fails with `PERMISSION_DENIED`, check the Cloud Build service
account's IAM bindings first, before assuming the YAML is wrong.

**2. Trigger creation fails because the GitHub connection isn't authorized**

```
ERROR: (gcloud.builds.triggers.create) INVALID_ARGUMENT: Repository not found or insufficient permissions
```

`gcloud builds triggers create github` assumes a GitHub App connection
already exists between your GCP project and the GitHub org/repo — this
is a one-time interactive authorization done through Cloud Console
(Cloud Build → Triggers → Connect Repository), not something the
`gcloud` command itself can complete non-interactively the first time.
If this is the first trigger for a given repo, do the Console
connection flow once before scripting further triggers via `gcloud`.

**3. The vulnerability gate step fails even on a clean image**

If the scan-check step returns a non-zero `SEVERE` count on an image
you're confident is clean, this is very likely the async-scan race
condition flagged in step 2 — the `describe --show-package-vulnerability`
call ran before Artifact Registry's scanner finished analyzing the
freshly-pushed image, and an incomplete scan can report misleadingly
(implementations vary in whether an in-progress scan reports zero
findings so far, which would falsely *pass* a genuinely vulnerable
image, or errors, which would falsely *fail* a clean one — either way,
querying too early is the likely cause). Add a short poll/retry loop
before treating a single query's result as final.

**4. Canary rollout stage silently skips the approval gate**

If `gcloud deploy rollouts list` shows the rollout reaching `100%`
traffic without ever showing a `PENDING_APPROVAL` state, check that
`verify: true` and the canary strategy block are actually present on
the **target's** deploy parameters and not just the pipeline
definition shown in step 3 — some Cloud Deploy configurations require
an explicit approval requirement set on the target resource itself
(a `requireApproval` field), separate from the canary percentages
list; a canary strategy with percentages defined does not by itself
guarantee a human approval gate between phases unless approval is
explicitly required.

**5. `docker push` step fails with an authentication error inside Cloud Build**

```
denied: Permission "artifactregistry.repositories.uploadArtifacts" denied
```

Cloud Build's default service account needs
`roles/artifactregistry.writer` on the Artifact Registry repository
(or project) — a fresh project with a newly-created Artifact Registry
repo commonly hasn't granted this yet. This is distinct from
Troubleshooting #1's Cloud Deploy permission gap; check both
separately rather than assuming one fix covers the other, since a
build can successfully push an image (fixing this error) while still
lacking permission to trigger a Cloud Deploy release (a different,
unrelated role).

## Cost Estimate

This lab's standing cost, if left running, is low relative to Labs 2
and 3 — the pipeline machinery itself (Cloud Build, Cloud Deploy,
Artifact Registry, and the underlying Cloud Run service if scaled to
zero) is mostly pay-per-use rather than continuously billed:

| Resource | Approx. cost | Notes |
|---|---|---|
| Cloud Build build-minutes | Free tier covers a meaningful number of build-minutes/day; overage billed per minute | Only accrues when a build actually runs — no standing cost between pushes. |
| Cloud Deploy | Billed per active `DeliveryPipeline` per month (a small flat per-pipeline charge) plus the underlying deployment target's own compute cost | The pipeline resource itself has a modest recurring charge even when idle — unlike Cloud Build, this one doesn't go to zero just because nothing is deploying. |
| Artifact Registry storage | Small per-GB/month storage charge for stored image layers; first several GB often free-tier eligible | Accumulates slowly as you push more image tags — old, unused tags are easy to forget and are the main long-run cost driver here. |
| Cloud Run service (staging + prod) | Near-$0 if traffic is zero and the service scales to zero instances (Cloud Run's default), small ongoing charge if `min-instances` is set above 0 | Confirm neither target service has `min-instances` left non-zero from an earlier experiment — that turns an otherwise near-free lab into a standing per-hour charge. |

**Resource to watch:** the `DeliveryPipeline` resource's small
recurring charge, and — more importantly — **Cloud Run `min-instances`
settings** left over from tuning cold-start behavior during testing.
Also check `gcloud artifacts docker images list` periodically if you
run this lab repeatedly; every push creates a new tag/digest, and
Artifact Registry storage cost is the one part of this lab that grows
monotonically with reuse unless old tags are cleaned up.

## Cleanup

```bash
# 1. Cloud Deploy pipeline and its targets (delete the pipeline first —
#    targets referenced by an active pipeline may resist deletion)
gcloud deploy delivery-pipelines delete app-pipeline --region=us-central1 --quiet
gcloud deploy targets delete staging --region=us-central1 --quiet
gcloud deploy targets delete prod --region=us-central1 --quiet

# 2. Build trigger
gcloud builds triggers delete TRIGGER_ID

# 3. Cloud Run services created/updated by this lab, if not needed
#    beyond the lab itself
gcloud run services delete SERVICE_NAME --region=us-central1 --quiet

# 4. Artifact Registry images — delete old/test tags to stop the slow
#    storage-cost accumulation noted above
gcloud artifacts docker images list us-docker.pkg.dev/$PROJECT_ID/repo/app
gcloud artifacts docker images delete \
  us-docker.pkg.dev/$PROJECT_ID/repo/app:SHORT_SHA --delete-tags --quiet
```

If you also created a dedicated Artifact Registry repository solely
for this lab (rather than reusing an existing one), delete the
repository itself once all images are removed:

```bash
gcloud artifacts repositories delete repo --location=us --quiet
```

## Why This Matters for the Exam

This lab is the hands-on version of **Domain 5 (~11%, Managing
implementation) §5.1/§5.2 — tooling and CI/CD guidance** and **Domain
4 (~18%, Analyzing and optimizing) §4.3 — release management
patterns**, with a secondary tie into **Domain 6 (~12%) §6.2 —
deployment/release management**:

- The CI (Cloud Build) / CD (Cloud Deploy) split, with a security gate
  in between, is the concrete implementation of Domain 2 §2.3's CI/CD
  integration and Domain 4 §4.1's testing-process expectations.
- Canary percentages + an approval gate is the hands-on version of
  Domain 4 §4.3 and Domain 5 §5.1's release-management guidance — not
  just a concept to recognize on a multiple-choice question, but an
  actual pipeline shape.

**Scenario-question shape this prepares you for:** a case study
(Mountkirk Games is the archetypal fit, given its emphasis on frequent
releases to a live multiplayer game) describes a team that wants to
ship changes frequently but is worried about a bad release reaching
all users at once, and asks for the deployment strategy that best
balances release velocity against blast-radius control — canary with
a staged percentage rollout and an approval gate (this lab, exactly)
beats both "deploy straight to 100% after tests pass" (no blast-radius
control) and "blue/green only" (blast radius is better than
all-at-once, but an *all-or-nothing* cutover doesn't give the
graduated 10%→50%→100% signal-gathering this lab's canary
configuration does). A second common variant probes whether the
candidate understands that a security/vulnerability gate belongs in
the **CI** stage (before an image is even eligible for deployment),
not bolted onto the CD stage after the fact — this lab's ordering
(scan gate in `cloudbuild.yaml`, before Cloud Deploy ever sees the
image) is the reference shape for that distinction.
