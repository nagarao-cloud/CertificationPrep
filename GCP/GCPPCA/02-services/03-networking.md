# Networking Services Reference

> Topology/design guidance: Domain 1 §1.3, Domain 2 §2.1. Head-to-head
> hybrid connectivity comparison: `03-comparisons/03-networking-connectivity.md`.
> This file is per-service configuration depth.

## Contents

- [VPC](#vpc)
- [Cloud Load Balancing](#cloud-load-balancing)
- [Cloud Interconnect / Cloud VPN](#cloud-interconnect--cloud-vpn)
- [Network Connectivity Center](#network-connectivity-center)
- [Cloud DNS](#cloud-dns)
- [Cloud NAT](#cloud-nat)
- [Cloud Armor](#cloud-armor)
- [Private Google Access / Private Service Connect](#private-google-access--private-service-connect)

---

## VPC

GCP's VPC is a **global** resource — subnets are regional, but a single
VPC spans all regions without inter-region routing/gateways to
configure (a key mental-model difference from other clouds worth
flagging explicitly on the exam).

- **Auto-mode vs. custom-mode**: auto-mode creates one subnet per
  region with predetermined /20 ranges — fast for dev/test, essentially
  never the production/exam-correct answer (see Domain 2 §2.1).
  Custom-mode gives full control over subnet ranges and regions used.
- **Shared VPC**: a host project owns the network; service projects
  attach and deploy resources into it — centralizes network
  administration while letting service teams own their own projects
  (billing, IAM at the project level) — the standard multi-team
  landing-zone pattern (Domain 2's landing zone architecture).
- **VPC Peering**: direct, private RFC 1918 connectivity between two
  VPCs. **Not transitive** — peering A↔B and B↔C does not connect A↔C.
  No shared quota between peered VPCs.
- **Firewall rules**: stateful, tag/service-account-scoped, priority-
  ordered; **hierarchical firewall policies** apply at the org/folder
  level and cannot be overridden by a lower-level admin — the
  org-wide-guardrail answer (Domain 2 §2.1, Domain 3 §3.1).
- **Routes**: system-generated (subnet routes) plus custom static
  routes for specific next-hops (e.g. routing through a VPN tunnel or
  an NVA).

---

## Cloud Load Balancing

Multiple tiers, matched to traffic scope and protocol — picking the
wrong tier is a recurring exam trap (over- or under-scoping).

| Tier | Scope | Protocol | When |
|---|---|---|---|
| Global External Application LB | Global | HTTP(S) | Public-facing web/API traffic, users anywhere — single anycast IP |
| Global External Proxy Network LB | Global | TCP/SSL (non-HTTP) | Global reach needed but not HTTP-aware routing |
| Regional External Application LB | Single region | HTTP(S) | Public traffic scoped to one region — cheaper/simpler than global when users are regional |
| Internal Application LB | Regional, private | HTTP(S) | Internal microservice-to-microservice traffic, never touches the public internet |
| Internal Passthrough Network LB | Regional, private | TCP/UDP | Internal traffic needing the original client IP preserved (passthrough, not proxied) |

- **Cloud CDN**: integrates with the external Application LB tiers to
  cache static content at Google's edge — the answer whenever a
  scenario mentions static asset delivery/latency at global scale.
- **Backend services and health checks**: every LB tier routes to a
  backend service, which health-checks its backends (MIGs, GKE
  NEGs, Cloud Run, Cloud Storage buckets for CDN) — unhealthy backends
  are automatically removed from rotation, the foundation of Domain 6's
  autohealing story at the network layer.

---

## Cloud Interconnect / Cloud VPN

Hybrid connectivity — see Tree 3 in `00-START-HERE/DECISION-TREES.md`
for the selection logic; this section is configuration depth.

- **Dedicated Interconnect**: a direct physical connection to Google's
  network at a colocation facility, 10Mbps–200Gbps per circuit, you
  arrange the cross-connect — highest throughput ceiling, longest
  provisioning time.
- **Partner Interconnect**: a service provider supplies the connection
  to Google on your behalf — lower minimum bandwidth than Dedicated,
  faster to provision if you already have a relationship with a
  supported partner.
- **Cloud VPN (HA VPN)**: IPsec tunnels over the public internet,
  99.99% SLA when configured with two interfaces/tunnels — fastest to
  provision (hours), throughput capped by internet path characteristics,
  not a dedicated circuit.
- **Router (Cloud Router)**: required for dynamic routing (BGP) over
  either Interconnect or VPN — without it, only static routes are
  possible, which doesn't scale for a growing hybrid environment.

---

## Network Connectivity Center

Hub-and-spoke management for hybrid/multi-cloud connectivity at
enterprise scale — see Domain 1 §1.3 Pattern C.

- **Hub**: the central management point; **spokes**: VPCs, VPN
  tunnels, Interconnect attachments, or (via a router appliance spoke)
  third-party SD-WAN/router integrations.
- **Why it beats a peering mesh**: a full-mesh VPC Peering topology
  grows O(n²) in connections as sites/VPCs are added; NCC's hub model
  scales linearly and centralizes route/policy management — the answer
  whenever a scenario describes a *growing* number of sites/VPCs
  needing interconnectivity.

---

## Cloud DNS

Managed authoritative DNS — public and private zones.

- **Public zones**: standard authoritative DNS for internet-facing
  domains.
- **Private zones**: resolve internal names within a VPC (and peered
  VPCs, if DNS peering is configured) — never resolvable from the
  public internet.
- **DNS forwarding/peering for hybrid**: on-prem resolvers can forward
  queries into Cloud DNS private zones, and vice versa — required
  whenever a hybrid scenario needs consistent name resolution across
  both environments (a frequently under-specified requirement that a
  scenario will test by omission — if hybrid DNS isn't addressed, the
  design has a gap).

---

## Cloud NAT

Managed, distributed NAT gateway for outbound-only internet access from
private (no external IP) instances/GKE pods.

- **No inbound connections** — NAT is strictly outbound; inbound public
  access needs a load balancer or explicit external IP, never Cloud
  NAT.
- **Fully managed** — no NAT gateway instance to size, patch, or make
  HA yourself, unlike a self-managed NAT-instance pattern (legacy, not
  the exam-correct answer for a new design).
- **Regional resource**, attached via a Cloud Router — provision per
  region that has private instances needing outbound access.

---

## Cloud Armor

Edge security policy engine, attached to external Application LB
tiers.

- **WAF rules**: preconfigured OWASP Top 10 rulesets (SQLi, XSS,
  etc.) plus custom rules (IP allow/deny lists, geo-based rules,
  rate-limiting).
- **DDoS protection**: works with Google's global network edge to
  absorb volumetric attacks before they reach backend capacity.
- **Adaptive Protection**: ML-based anomaly detection for L7 DDoS
  patterns beyond static rule matching — the answer for "detect novel
  attack patterns," not just known signatures.

---

## Private Google Access / Private Service Connect

Two distinct mechanisms, frequently confused on the exam — direction of
access is the key differentiator.

- **Private Google Access (PGA)**: enabled on a subnet; lets VM-
  initiated traffic (no external IP) reach Google APIs/services
  (Cloud Storage, BigQuery, etc.) without traversing the public
  internet. One-directional: *your* VMs reaching *Google's* services.
- **Private Service Connect (PSC)**: lets you (a) consume a
  Google-managed or third-party/partner service privately via an
  internal IP in your VPC, or (b) **publish your own service** for
  private consumption by other VPCs/projects — the answer whenever a
  scenario needs the *reverse* direction (someone else privately
  reaching a service you own) without full VPC Peering exposure.

**Exam trap:** a scenario needing "expose our internal API to another
business unit's VPC without giving them broad network access" is a PSC
question; reaching for VPC Peering here over-exposes the network beyond
what's needed.
