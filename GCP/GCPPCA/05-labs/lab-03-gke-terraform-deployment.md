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

### 6. Clean up

```bash
kubectl delete -f app-deployment.yaml
kubectl delete service app-service
terraform destroy
gcloud iam service-accounts delete app-sa@prod-app-001.iam.gserviceaccount.com
```

## What this lab demonstrates for the exam

- Terraform-managed GKE cluster + node pool is the concrete
  implementation of Domain 2 §2.3's IaC-first compute provisioning.
- Workload Identity's ServiceAccount-to-ServiceAccount binding is the
  hands-on version of Domain 3 §3.1's "avoid exported keys" guidance —
  worth having actually configured once, not just read about.
- Choosing the Internal LB tier deliberately (not defaulting to
  external) reinforces Domain 1's "match the LB tier to the traffic's
  actual scope" principle from the networking comparison matrix.
