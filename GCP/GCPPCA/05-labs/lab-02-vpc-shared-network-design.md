# Lab 2: Shared VPC + Hierarchical Firewall Design

> Builds on Lab 1's folder structure. Implements Domain 1 §1.3 Pattern A
> and Domain 2 §2.1's provisioning-time network configuration.

## Objective

Provision a custom-mode Shared VPC in a host project, attach a service
project, apply a hierarchical firewall policy at the folder level, and
verify that Cloud NAT provides outbound-only internet access to a
private instance.

## Prerequisites

- Lab 1's folder structure (or equivalent projects to attach a Shared
  VPC to).
- `gcloud` CLI with Compute Network Admin-equivalent permissions.

## Steps

### 1. Create a custom-mode VPC in the host project

```bash
gcloud compute networks create shared-vpc-host \
  --project=host-project-001 \
  --subnet-mode=custom
```

**Why custom-mode:** auto-mode's fixed /20-per-region ranges are a
production anti-pattern (Domain 2 exam trap #3) — custom-mode gives
control over exactly which regions get subnets and what ranges they
use.

### 2. Create a subnet with Private Google Access enabled

```bash
gcloud compute networks subnets create prod-subnet-us-central1 \
  --project=host-project-001 \
  --network=shared-vpc-host \
  --region=us-central1 \
  --range=10.0.0.0/20 \
  --enable-private-ip-google-access
```

### 3. Enable Shared VPC on the host project, attach the service project

```bash
gcloud compute shared-vpc enable host-project-001

gcloud compute shared-vpc associated-projects add prod-app-001 \
  --host-project=host-project-001
```

### 4. Grant the service project's IAM group Network User on the subnet

```bash
gcloud compute networks subnets add-iam-policy-binding prod-subnet-us-central1 \
  --project=host-project-001 \
  --region=us-central1 \
  --member="group:prod-engineers@example.com" \
  --role="roles/compute.networkUser"
```

**Why this specific binding, not a broader role:** `networkUser`
scoped to the subnet is the least-privilege way to let the service
project's team deploy resources into the shared network without
granting them network-admin rights over the host project itself —
directly demonstrates Domain 3's least-privilege principle applied to
Shared VPC specifically.

### 5. Apply a hierarchical firewall policy at the folder level

```bash
gcloud compute firewall-policies create prod-fw-policy \
  --folder=PROD_FOLDER_ID

gcloud compute firewall-policies rules create 1000 \
  --firewall-policy=prod-fw-policy \
  --action=DENY \
  --direction=INGRESS \
  --src-ip-ranges=0.0.0.0/0 \
  --layer4-configs=all

gcloud compute firewall-policies associations create \
  --firewall-policy=prod-fw-policy \
  --folder=PROD_FOLDER_ID
```

### 6. Provision Cloud Router + Cloud NAT for outbound-only access

```bash
gcloud compute routers create prod-router \
  --project=host-project-001 \
  --network=shared-vpc-host \
  --region=us-central1

gcloud compute routers nats create prod-nat \
  --router=prod-router \
  --region=us-central1 \
  --auto-allocate-nat-external-ips \
  --nat-all-subnet-ip-ranges
```

### 7. Deploy a private (no external IP) instance and verify

```bash
gcloud compute instances create test-vm \
  --project=prod-app-001 \
  --zone=us-central1-a \
  --subnet=projects/host-project-001/regions/us-central1/subnetworks/prod-subnet-us-central1 \
  --no-address
```

SSH via Identity-Aware Proxy (IAP) tunneling (since the instance has no
external IP), then from inside the instance:

```bash
curl -I https://www.google.com   # succeeds — outbound via Cloud NAT
```

Attempt an inbound connection from outside the VPC to `test-vm`'s
internal IP — **expected to fail**, both because there's no external
IP and because the hierarchical firewall policy denies all ingress by
default at the folder level.

### 8. Clean up

```bash
gcloud compute instances delete test-vm --zone=us-central1-a
gcloud compute routers nats delete prod-nat --router=prod-router --region=us-central1
gcloud compute routers delete prod-router --region=us-central1
gcloud compute firewall-policies associations delete --firewall-policy=prod-fw-policy --folder=PROD_FOLDER_ID
gcloud compute firewall-policies delete prod-fw-policy
gcloud compute shared-vpc associated-projects remove prod-app-001 --host-project=host-project-001
gcloud compute networks subnets delete prod-subnet-us-central1 --region=us-central1
gcloud compute networks delete shared-vpc-host
```

## What this lab demonstrates for the exam

- Shared VPC's host/service project split and the `networkUser` role
  are the concrete mechanics behind Domain 1 §1.3's Pattern A and
  Domain 2 §2.1's provisioning guidance.
- Hierarchical firewall policies enforce a deny-by-default posture that
  individual project admins cannot override — directly demonstrates the
  Domain 2/3 crossover on org-wide guardrails.
- Cloud NAT + no external IP + IAP tunneling is the standard "private
  instance, no inbound, managed outbound" pattern the exam expects as
  the default answer over a self-managed NAT instance or public IPs.
