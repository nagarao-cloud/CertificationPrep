# Lab 3: GKE Cluster via Terraform + Workload Identity

> Implements Domain 2 §2.3's IaC-first compute provisioning and Domain
> 3 §3.1's Workload Identity pattern. Assumes Lab 2's network exists
> (or a suitable substitute VPC/subnet).

## Objective

Provision a GKE Standard cluster with Terraform, configure Workload
Identity so a pod can call a GCP API without a mounted service-account
key, and deploy a minimal workload behind an Internal Application LB.

## Prerequisites

- Terraform installed, `google` provider configured with credentials
  that have GKE Admin-equivalent permissions.
- A subnet to deploy into (Lab 2's `prod-subnet-us-central1`, or
  equivalent).
- `kubectl` installed, plus the `gke-gcloud-auth-plugin` component
  (`gcloud components install gke-gcloud-auth-plugin`) — recent GKE
  client versions require this plugin for `kubectl` to authenticate;
  its absence produces an auth error that looks unrelated to the
  actual cause (see Troubleshooting).
- This lab is the most expensive of the five in real dollars if left
  running — read Cost Estimate before you `terraform apply`.

## Steps

### 1. Terraform: cluster shell

```hcl
resource "google_container_cluster" "prod" {
  name     = "prod-gke"
  location = "us-central1"
  project  = "prod-app-001"

  network    = "projects/host-project-001/global/networks/shared-vpc-host"
  subnetwork = "projects/host-project-001/regions/us-central1/subnetworks/prod-subnet-us-central1"

  workload_identity_config {
    workload_pool = "prod-app-001.svc.id.goog"
  }

  remove_default_node_pool = true
  initial_node_count       = 1

  release_channel {
    channel = "STABLE"
  }
}

resource "google_container_node_pool" "primary" {
  name       = "primary-pool"
  cluster    = google_container_cluster.prod.name
  location   = "us-central1"
  project    = "prod-app-001"
  node_count = 3

  node_config {
    machine_type = "e2-standard-4"
    workload_metadata_config {
      mode = "GKE_METADATA"
    }
  }
}
```

```bash
terraform init
terraform plan   # review before apply — Domain 2's "reviewable diff" expectation
terraform apply
```

**Why `remove_default_node_pool` + an explicit node pool:** the default
node pool created automatically by `google_container_cluster` isn't
independently manageable via Terraform in the same way — explicitly
defining the pool gives full lifecycle control (machine type, scaling,
node count) as Terraform-managed state, consistent with Domain 2's
IaC-first expectation.

**Why `location = "us-central1"` (a region, not a zone):** this
provisions a **regional** cluster — control plane and nodes spread
across multiple zones in the region for HA. A zonal cluster (setting
`location` to something like `us-central1-a`) is cheaper and faster to
create for a quick experiment but has a single-zone control plane;
know which one you're building, since it changes both the cost profile
and the availability guarantee (Domain 6 §6.2 territory).

### 2. Create a GCP service account for the workload, bind it to a Kubernetes service account

```bash
gcloud iam service-accounts create app-sa \
  --project=prod-app-001

gcloud iam service-accounts add-iam-policy-binding \
  app-sa@prod-app-001.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="serviceAccount:prod-app-001.svc.id.goog[default/app-ksa]"
```

### 3. Deploy a Kubernetes ServiceAccount annotated for Workload Identity

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: app-ksa
  namespace: default
  annotations:
    iam.gke.io/gcp-service-account: app-sa@prod-app-001.iam.gserviceaccount.com
```

```bash
kubectl apply -f app-ksa.yaml
```

### 4. Deploy a workload using that ServiceAccount

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: demo
  template:
    metadata:
      labels:
        app: demo
    spec:
      serviceAccountName: app-ksa
      containers:
        - name: app
          image: us-docker.pkg.dev/prod-app-001/repo/app:latest
          ports:
            - containerPort: 8080
```

```bash
kubectl apply -f app-deployment.yaml
```

**Verify no mounted key file is needed:** exec into a pod and confirm
GCP API calls succeed (e.g. `gcloud auth list` inside the pod shows the
federated identity) with no `GOOGLE_APPLICATION_CREDENTIALS` file
present — the concrete demonstration of Domain 3 §3.1's "no exported
keys" pattern.

### 5. Expose via an Internal Application LB

```bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: app-service
  annotations:
    networking.gke.io/load-balancer-type: "Internal"
spec:
  type: LoadBalancer
  selector:
    app: demo
  ports:
    - port: 80
      targetPort: 8080
EOF
```

**Why Internal, not External, in this lab:** matches the Domain 1 §1.3
tier-selection guidance — this workload is assumed internal-only;
swapping to a Global External Application LB is a one-line
annotation/resource change once a scenario calls for public exposure
(see `03-comparisons/03-networking-connectivity.md`'s LB tier matrix).

## Verification

**1. The cluster actually came up with Workload Identity enabled (not just requested)**

```bash
gcloud container clusters describe prod-gke \
  --region=us-central1 --project=prod-app-001 \
  --format="value(workloadIdentityConfig.workloadPool)"
```

Correct output: `prod-app-001.svc.id.goog`. Misconfiguration signal:
empty output — usually means the `workload_identity_config` block was
present in the `.tf` file but the `terraform apply` ran against a
cluster that already existed without it (Workload Identity can only be
enabled at cluster creation or via an explicit update; a `plan` that
shows no changes when you expected one is the tell that Terraform
thinks the config already matches, often because of a stale state
file from an earlier partial apply).

**2. The node pool is the one Terraform manages, not a leftover default pool**

```bash
gcloud container node-pools list --cluster=prod-gke \
  --region=us-central1 --project=prod-app-001
```

Correct output: exactly one pool, `primary-pool`, with 3 nodes (times
however many zones a regional cluster spreads across — for a regional
cluster this is nodes *per zone*, so `node_count = 3` on a 3-zone
region means **9 nodes total**, not 3; this is a frequent surprise and
directly affects the cost estimate below). Misconfiguration signal: a
pool literally named `default-pool` still present — means
`remove_default_node_pool = true` didn't take effect, usually because
`initial_node_count` was left unset or the apply partially failed
before the removal step.

**3. Workload Identity federation actually works from inside a pod, not just configured on paper**

```bash
kubectl exec -it deploy/app -- gcloud auth list
```

Correct output: shows an active account matching
`app-sa@prod-app-001.iam.gserviceaccount.com` (the *GCP* service
account, federated in), with **no** `GOOGLE_APPLICATION_CREDENTIALS`
environment variable or mounted key file present
(`kubectl exec -it deploy/app -- env | grep GOOGLE_APPLICATION_CREDENTIALS`
should return nothing). Misconfiguration signal: the pod's identity
resolves to the GKE **node's** default service account instead of
`app-sa` — almost always means either the Kubernetes ServiceAccount
annotation in step 3 has a typo in the GCP service-account email, the
`serviceAccountName: app-ksa` field is missing from the pod spec in
step 4 (defaulting the pod to the `default` KSA, which has no
Workload Identity binding), or the IAM binding in step 2 references
the wrong namespace/KSA-name pair inside the `[namespace/ksa-name]`
bracket syntax.

**4. The Internal LB actually only has an internal address**

```bash
kubectl get service app-service -o wide
```

Correct output: `EXTERNAL-IP` column shows an internal RFC 1918
address from the subnet's range (e.g. `10.0.x.x`), reachable only from
within the VPC (or peered/connected networks) — the field is
misleadingly still called `EXTERNAL-IP` in `kubectl` output even for
an internal LB, which trips people up. Misconfiguration signal: the
address is a public IP, or provisioning hangs at `<pending>`
indefinitely — the former means the `networking.gke.io/load-balancer-type:
"Internal"` annotation was dropped or misspelled; the latter usually
means a Google-managed service-networking connection or firewall rule
required for internal LB provisioning is missing, or the GKE service
account lacks permission to create the backend forwarding rule in the
host project (Shared VPC clusters need this explicitly granted — see
Troubleshooting).

## Troubleshooting

**1. `kubectl` commands fail with an authentication error after a successful `terraform apply`**

```
error: exec plugin: invalid apiVersion "client.authentication.k8s.io/v1beta1"
```

or similar auth-plugin errors. Recent `gcloud`/`kubectl` versions
removed the built-in GCP auth helper and require the separate
`gke-gcloud-auth-plugin` component (see Prerequisites). Install it,
set `USE_GKE_GCLOUD_AUTH_PLUGIN=True` if your version still checks for
that environment variable, and re-run `gcloud container clusters
get-credentials prod-gke --region=us-central1 --project=prod-app-001`
to regenerate the kubeconfig context. This is a client-tooling problem,
not a cluster or IAM problem — don't chase IAM permissions for this
error.

**2. `terraform apply` hangs or fails creating the cluster, citing the network/subnet**

```
Error: googleapi: Error 400: Invalid value for field 'resource.subnetwork': ... (or) permission denied on shared VPC host project resources
```

If deploying into a Shared VPC subnet (Lab 2's setup), the GKE service
agent in `prod-app-001` needs the `roles/container.hostServiceAgentUser`
role granted on the **host project** (`host-project-001`), in addition
to the `networkUser` binding from Lab 2 — a binding scoped only to
the individual engineer, not to GKE's own service agent identity, is
a common gap: GKE provisions its own robot service account
(`service-PROJECT_NUMBER@container-engine-robot.iam.gserviceaccount.com`)
that needs its own grant on the host project, separate from any
human/group binding.

**3. Node pool creation fails with a quota error**

```
ERROR: (gcloud.container.node-pools.create) ResponseError: code=403, message=Insufficient regional quota to satisfy request: resource "IN_USE_ADDRESSES"...
```

A regional cluster with `node_count = 3` per zone across a 3-zone
region needs 9 nodes' worth of IP addresses and CPU quota
simultaneously, plus headroom for surge upgrades — new/free-tier
projects often don't have that much regional quota by default. Either
request a quota increase, reduce `node_count`, or switch to a zonal
cluster (single `location` set to a zone, e.g. `us-central1-a`) for a
lab-scale exercise where regional HA isn't the point being tested.

**4. Workload Identity binding "succeeds" but the pod still can't authenticate**

Double-check the bracket syntax in step 2's `--member` flag:
`serviceAccount:PROJECT_ID.svc.id.goog[NAMESPACE/KSA_NAME]` — a
mismatch between this namespace/name pair and the actual pod's
namespace or `serviceAccountName` field is the single most common
Workload Identity misconfiguration, and `gcloud` does not validate
that the referenced Kubernetes namespace or service account actually
exists at bind time (same non-validation behavior noted for IAM group
bindings in Lab 1) — a typo here produces a binding that looks correct
in `gcloud iam service-accounts get-iam-policy` output but never
matches any real pod identity.

**5. Internal LB provisioning stuck at `<pending>` indefinitely**

Beyond the Shared VPC host-permission issue in #2, confirm the GKE
data plane has the subnet's **secondary IP ranges** it expects for
Pods/Services if you're using VPC-native (alias IP) clusters — the
default for new clusters — and that those secondary ranges weren't
accidentally omitted from Lab 2's subnet definition (this lab's
walkthrough subnet creation in Lab 2 does not define secondary ranges
explicitly; a real deployment would add `--secondary-range` flags for
pod and service CIDRs, or accept GKE's auto-created ones — if you
adapted Lab 2's exact command, confirm which behavior you actually
got with `gcloud compute networks subnets describe
prod-subnet-us-central1 --region=us-central1 --project=host-project-001`).

## Cost Estimate

This is the most expensive lab of the five to leave running, because
it's the only one provisioning multiple full VMs continuously plus a
managed control plane. Rough order-of-magnitude for the exact
configuration above (regional cluster, 3-zone region, `e2-standard-4`
nodes), left running for a full month at on-demand pricing — treat as
planning-level estimates, not quotes:

| Resource | Approx. monthly cost if left running | Notes |
|---|---|---|
| GKE cluster management fee | Free for one zonal cluster per billing account under the standard free tier; a **regional** Standard cluster is billed at a small flat hourly rate (roughly $70–75/mo at time of writing) once free-tier zonal allowance doesn't apply | Autopilot clusters have a different, usage-based fee structure not used in this lab. |
| Node pool: `e2-standard-4` × (3 nodes/zone × 3 zones = 9 nodes) | Roughly $250–300+/mo for 9 nodes at this machine type, before any committed-use discount | **This is the dominant cost by a wide margin** — a regional cluster's per-zone replication of `node_count` is easy to underestimate; see Verification check 2. |
| Persistent disks backing each node's boot disk | Modest, tens of dollars/mo total across 9 nodes at default boot-disk size | Scales with node count, same as the compute cost. |
| Internal Application LB (forwarding rule + backend) | Small flat monthly charge plus data-processing charges | Minor relative to the node pool cost. |
| Artifact Registry storage for the container image | Negligible at lab scale (first several GB free-tier eligible in many configurations) | Not a concern unless you push many large images. |

**Resource to watch:** the node pool, specifically the **regional ×
per-zone multiplication** of `node_count`. A reader who sets
`node_count = 3` expecting "3 nodes total" and leaves a regional
cluster running for a week will be billed for 9 nodes, not 3 — this is
the single most common way this exact lab configuration produces a
larger-than-expected bill. If you're doing this lab purely to observe
Workload Identity and don't need regional HA, switching `location` to
a single zone cuts the node count (and cost) by roughly two-thirds.

## Cleanup

Kubernetes-level objects first, then the infrastructure Terraform
manages, then the standalone IAM resources Terraform doesn't track:

```bash
# 1. Kubernetes objects (the LB's forwarding rule/backend get torn
#    down when the Service is deleted — deleting the cluster without
#    doing this first can occasionally strand a forwarding rule)
kubectl delete -f app-deployment.yaml
kubectl delete service app-service
kubectl delete -f app-ksa.yaml

# 2. Terraform-managed cluster + node pool
terraform destroy

# 3. IAM resources Terraform never created and therefore won't destroy
gcloud iam service-accounts delete app-sa@prod-app-001.iam.gserviceaccount.com --quiet
```

Confirm the LB's forwarding rule and backend service are actually
gone after `terraform destroy` (GKE's own controller usually cleans
these up when the Service and cluster are deleted, but a network
object orphaned outside Terraform's state is invisible to
`terraform destroy` and worth one manual check):

```bash
gcloud compute forwarding-rules list --project=host-project-001 --filter="name~app-service"
gcloud compute backend-services list --project=host-project-001 --filter="name~app-service"
```

Both should return empty; if either lists a leftover resource, delete
it manually before considering cleanup complete — an orphaned internal
forwarding rule is low-cost but not zero-cost, and it's exactly the
kind of half-deleted resource that accumulates silently across
repeated lab runs.

## Why This Matters for the Exam

This lab is the hands-on version of **Domain 2 (~15%, Managing and
provisioning) §2.3 — configuring compute systems (GKE, IaC)** and
**Domain 3 (~20%, Designing for security and compliance) §3.1 —
Workload Identity as the "no exported keys" pattern**:

- Terraform-managed GKE cluster + node pool is the concrete
  implementation of Domain 2 §2.3's IaC-first compute provisioning.
- Workload Identity's ServiceAccount-to-ServiceAccount binding is the
  hands-on version of Domain 3 §3.1's "avoid exported keys" guidance —
  worth having actually configured once, not just read about.
- Choosing the Internal LB tier deliberately (not defaulting to
  external) reinforces Domain 1's "match the LB tier to the traffic's
  actual scope" principle from the networking comparison matrix.

**Scenario-question shape this prepares you for:** a question
describes an application running in GKE that currently authenticates
to another GCP service (Cloud SQL, BigQuery, a Pub/Sub topic) using a
downloaded service-account JSON key mounted into the container, and
asks for the most secure way to eliminate that key — Workload Identity
is the expected answer, and this lab is the literal implementation of
it, including the specific mechanism (annotate a KSA, bind it to a GSA
via `roles/iam.workloadIdentityUser`) rather than a vaguer answer like
"use IAM roles" (true but incomplete — the exam wants the specific
GKE-to-IAM federation mechanism, not just "apply least privilege" in
the abstract). A second common variant tests the regional-vs-zonal
cluster tradeoff directly: a scenario stating an availability
requirement that a single zone's outage must not take the workload
down points to a regional cluster, while a cost-sensitive, dev/test
scenario points to zonal — this lab's cost estimate above is exactly
the number that tradeoff hinges on.
