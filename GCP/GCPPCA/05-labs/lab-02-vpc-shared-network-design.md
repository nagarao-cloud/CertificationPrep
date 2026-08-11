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
- A billing-enabled project for `host-project-001` and `prod-app-001` —
  this lab **does** create billable resources (a running VM, a NAT
  gateway); see Cost Estimate below before leaving it running overnight.

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

## Verification

**1. Shared VPC roles are actually what you think they are**

```bash
gcloud compute shared-vpc get-host-project prod-app-001
```

Correct output: reports `host-project-001` as the host — confirming
the attach in step 3 actually took effect from the service project's
point of view, not just the host's. Misconfiguration signal: an error
or empty response usually means step 3's `associated-projects add`
targeted the wrong project ID, or ran against a project that was never
enabled as a host in the first place.

**2. The subnet-level IAM binding is scoped correctly (not accidentally host-project-wide)**

```bash
gcloud compute networks subnets get-iam-policy prod-subnet-us-central1 \
  --project=host-project-001 \
  --region=us-central1
```

Correct output: a `bindings` entry for `group:prod-engineers@example.com`
with `roles/compute.networkUser`, scoped to this one subnet resource.
Misconfiguration signal: if you instead ran the binding command with
`gcloud projects add-iam-policy-binding host-project-001` (a common
copy-paste mistake), you'd grant `networkUser` at the **whole host
project**, letting the service-project team deploy into *every* subnet
in the host project, including ones belonging to other environments —
check with `gcloud projects get-iam-policy host-project-001` that no
such broader binding exists.

**3. Hierarchical firewall policy is attached and evaluated before VPC-level rules**

```bash
gcloud compute firewall-policies associations list \
  --folder=PROD_FOLDER_ID

gcloud compute firewall-policies rules list \
  --firewall-policy=prod-fw-policy
```

Correct output: the association list shows the folder attached to
`prod-fw-policy`, and the rules list shows rule priority `1000`,
`action: DENY`, `direction: INGRESS`, matching all sources and ports.
Misconfiguration signal: a VPC-level (non-hierarchical) firewall rule
that appears to "allow" traffic your hierarchical policy denies — this
is not a bug, it's rule-evaluation order: hierarchical firewall
policies at the organization/folder level are evaluated *before*
VPC-level firewall rules and can override them for `goto_next: false`
rules. If test traffic you expected to be blocked is getting through,
check whether a VPC-level rule with higher effective priority is
matching first, and confirm the hierarchical policy rule doesn't have
`--action=goto_next` set (which would defer to VPC-level rules instead
of enforcing DENY itself).

**4. Cloud NAT is actually the path outbound traffic takes**

```bash
gcloud compute routers get-nat-mapping-info prod-router \
  --region=us-central1
```

Correct output: a mapping entry showing `test-vm`'s internal IP paired
with an auto-allocated external NAT IP. Misconfiguration signal: no
mapping entry appears even though the `curl` from step 7 succeeded —
double-check `--nat-all-subnet-ip-ranges` was actually applied (vs. a
NAT created with a specific subnet list that doesn't include
`prod-subnet-us-central1`); an empty mapping with working connectivity
usually means the instance still has a leftover external IP from an
earlier attempt rather than truly going out through NAT.

**5. The private instance is genuinely unreachable from outside**

From a machine outside the VPC (not another VM inside the same
network), attempt:

```bash
curl -m 5 http://10.0.x.x   # test-vm's internal IP — expect timeout, not "connection refused"
```

Correct outcome: connection **times out** (packets dropped, consistent
with a DENY firewall rule) rather than "connection refused" (which
would indicate the packets arrived and were rejected by the OS/port,
implying the firewall policy isn't actually blocking at the network
layer). If you get "connection refused" instead of a timeout, re-check
that the hierarchical policy's association in check 3 is really active
and that no VPC firewall rule with `allow` and higher priority exists
for that path.

## Troubleshooting

**1. `shared-vpc enable` fails with a permission or API error**

```
ERROR: (gcloud.compute.shared-vpc.enable) User is not authorized
```

Enabling Shared VPC on a host project requires the
`compute.organizations.enableXpnHost`-bearing role (`Shared VPC
Admin`, `roles/compute.xpnAdmin`) — typically granted at the
**organization or folder** level, not the project level, because it's
inherently a cross-project capability. Verify with `gcloud projects
get-iam-policy` at the org/folder that the identity running this
command actually has that role, not just `Owner` on the individual
project (project-level Owner is not sufficient by itself for
enabling Shared VPC host status).

**2. `associated-projects add` succeeds, but `test-vm` in step 7 still fails to attach to the subnet**

```
ERROR: The resource 'projects/host-project-001/regions/us-central1/subnetworks/prod-subnet-us-central1' is not ready / not accessible
```

Usually one of: (a) the `--subnet` flag in `instances create` used the
wrong fully-qualified path format — it must reference the **host**
project's subnet path even though the instance itself is created in
the **service** project (`prod-app-001`); a common mistake is pointing
at a subnet path under `prod-app-001` instead, which doesn't exist
because the subnet lives in the host project; (b) the
`roles/compute.networkUser` binding from step 4 hasn't propagated yet
(see IAM propagation delay note in Lab 1) — wait a few minutes and
retry rather than re-running the binding command.

**3. Instance created successfully but `curl` to the internet hangs (no NAT path)**

Check, in order: the Cloud Router and NAT gateway actually exist in
the **same region** as the subnet (`us-central1` in this lab — a NAT
gateway in the wrong region silently does nothing for traffic from a
different region's subnet); the instance truly has no external IP
(`--no-address` took effect — `gcloud compute instances describe
test-vm --zone=us-central1-a --format="value(networkInterfaces[0].accessConfigs)"`
should return empty); and that the hierarchical firewall policy's
DENY-all-ingress rule (which only affects **inbound** traffic) isn't
being confused with an *egress* deny rule you didn't intend to create
— this lab's policy only targets `--direction=INGRESS`, so outbound
should never be blocked by it. If outbound is still failing, check for
a separate, forgotten egress-deny rule at the VPC firewall level.

**4. Quota errors when creating the Cloud Router, NAT, or VM**

```
ERROR: Quota 'ROUTERS' exceeded. Limit: 1.0 in region us-central1.
```

Free-tier and newly-created projects often start with low per-region
quotas for routers, external IPs, and in-use IP addresses. Check
current usage/limits with `gcloud compute regions describe
us-central1 --project=prod-app-001` (look at the `quotas` list) before
assuming the resource definition itself is wrong — a quota error looks
superficially similar to a permissions error in some client output but
requires a quota increase request (Console → IAM & Admin → Quotas),
not an IAM fix.

**5. Hierarchical firewall policy rule conflicts silently with an existing VPC firewall rule**

If a default-allow rule (e.g. `default-allow-ssh` that many
auto-mode-created VPCs pre-populate) still appears to let SSH through
despite the DENY-all hierarchical policy, remember custom-mode VPCs
(this lab's `shared-vpc-host`) do **not** get GCP's implicit default
rules the way auto-mode VPCs do — so this specific failure shouldn't
occur in *this* lab as written, but is a common trap when adapting
this pattern to an existing auto-mode VPC: check
`gcloud compute firewall-rules list --project=host-project-001` for
any VPC-level allow rule with lower priority number (higher
precedence) than expected, and remember hierarchical policy evaluation
order relative to VPC rules depends on whether the hierarchical rule
uses `goto_next` — see Verification check 3.

## Cost Estimate

This lab **does** create billable resources — unlike Lab 1, leaving it
running has a real, if modest, ongoing cost. Order of magnitude for a
single-region setup left running for a full month, using on-demand
(list) pricing and assuming default machine types — treat these as
rough planning numbers, not quotes, since exact pricing varies by
region and changes over time:

| Resource | Approx. monthly cost if left running | Notes |
|---|---|---|
| `test-vm` (default `e2-medium` if unspecified) | ~$25–30/mo | The dominant cost in this lab by far — stop or delete it, don't just leave it idle. |
| Cloud NAT gateway | ~$1–2/mo base charge + per-GB data-processing charge | Small on its own, but scales with actual traffic volume — irrelevant at lab scale. |
| Cloud Router | No separate charge for the router resource itself | Cost lives in the NAT gateway and any BGP/interconnect usage, neither of which this lab uses. |
| Auto-allocated NAT external IP | Small hourly charge while allocated (external IPs in general are billed) | Released automatically when the NAT/router is deleted. |
| VPC, subnet, firewall policy, IAM bindings | $0 | Network topology and policy objects themselves are free; you pay for the compute/data that flows through them. |

**Resource to watch:** `test-vm`. It's the only piece here with a
meaningfully large standing cost, and it's easy to leave running after
a study session since it has no external IP and therefore isn't
"visibly" costing anything the way a public-facing resource might
prompt you to remember. If you're pausing the lab rather than tearing
it fully down, `gcloud compute instances stop test-vm --zone=us-central1-a`
removes the compute charge while preserving the disk (which still
incurs a small storage charge) — full deletion is cheaper still and is
what the Cleanup section below does.

## Cleanup

Delete in reverse-dependency order — resources that reference other
resources (the VM references the subnet; the NAT references the
router; the association references the policy) must go before the
things they reference:

```bash
# 1. Compute instance (depends on the subnet)
gcloud compute instances delete test-vm --zone=us-central1-a --project=prod-app-001 --quiet

# 2. NAT (depends on the router)
gcloud compute routers nats delete prod-nat \
  --router=prod-router --region=us-central1 --project=host-project-001 --quiet

# 3. Router
gcloud compute routers delete prod-router \
  --region=us-central1 --project=host-project-001 --quiet

# 4. Firewall policy association, then the policy itself
gcloud compute firewall-policies associations delete \
  --firewall-policy=prod-fw-policy --folder=PROD_FOLDER_ID --quiet
gcloud compute firewall-policies delete prod-fw-policy --quiet

# 5. Detach the service project from Shared VPC before touching the
#    network — a subnet with an active service-project attachment
#    can behave unexpectedly if you try to delete it first
gcloud compute shared-vpc associated-projects remove prod-app-001 \
  --host-project=host-project-001

# 6. Subnet, then network
gcloud compute networks subnets delete prod-subnet-us-central1 \
  --region=us-central1 --project=host-project-001 --quiet
gcloud compute networks delete shared-vpc-host --project=host-project-001 --quiet
```

Optionally, disable Shared VPC hosting on `host-project-001` entirely
if you don't intend to reuse it (`gcloud compute shared-vpc
disable-host host-project-001` — only succeeds once no service
projects remain attached, which step 5 above ensures).

## Why This Matters for the Exam

This lab is the hands-on version of **Domain 1 (~24%, Designing and
planning) §1.3 — network resource design (Pattern A)** and **Domain 2
(~15%, Managing and provisioning) §2.1 — configuring network
topologies**:

- Shared VPC's host/service project split and the `networkUser` role
  are the concrete mechanics behind Domain 1 §1.3's Pattern A and
  Domain 2 §2.1's provisioning guidance.
- Hierarchical firewall policies enforce a deny-by-default posture that
  individual project admins cannot override — directly demonstrates the
  Domain 2/3 crossover on org-wide guardrails.
- Cloud NAT + no external IP + IAP tunneling is the standard "private
  instance, no inbound, managed outbound" pattern the exam expects as
  the default answer over a self-managed NAT instance or public IPs.

**Scenario-question shape this prepares you for:** a case study (both
TerramEarth and EHR Healthcare lean on multi-project setups) describes
multiple application teams, each with their own project for
billing/IAM isolation, that all need to share one centrally-managed
network — with networking/security owned by a platform team and
application deployment owned by each app team independently. The
distractor answers usually involve VPC Peering (works, but doesn't
centralize IP/firewall/route management the way Shared VPC does, and
each peered pair is a separate relationship to manage as the org
grows) or "give every app team `Network Admin` on their own VPC" (loses
the centralized, consistent firewall/NAT/routing policy this lab
demonstrates). A second common variant tests whether you know *which*
project's quota and API enablement governs Shared VPC networking
resources — this lab's host/service split, where the network,
firewall, and NAT all live in `host-project-001` while the compute
instance lives in `prod-app-001`, is exactly that distinction made
concrete.
