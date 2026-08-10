# Networking Services Reference

> Topology/design guidance: Domain 1 §1.3, Domain 2 §2.1. Head-to-head
> hybrid connectivity comparison: `03-comparisons/03-networking-connectivity.md`.
> This file is per-service configuration depth. Every service below
> follows the same checklist: purpose, when to use, when **not** to
> use (paired with the alternative that wins instead), configuration
> surface, cost, performance, scaling, security, HA/failure behavior,
> common mistakes, and exam scenario cues.

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

**Purpose:** GCP's VPC is a **global** resource — subnets are
regional, but a single VPC spans all regions without inter-region
routing/gateways to configure (a key mental-model difference from
other clouds worth flagging explicitly on the exam).

**When to use:** every GCP workload needing network isolation and
addressing lives inside a VPC by definition — the design questions are
about *how many* VPCs, custom vs. auto subnet mode, and whether to
share one VPC across projects (Shared VPC), not *whether* to use one.

**When NOT to use — use something else instead:**
- Auto-mode VPC in a production/multi-team design → **custom-mode
  VPC** — auto-mode's predetermined /20 subnet ranges are a fast
  dev/test convenience, essentially never the exam-correct answer for
  a production landing zone (see Domain 2 §2.1).
- A flat, fully-shared network for many independent product teams
  wanting isolated billing/IAM at the project level → **Shared VPC**,
  not one giant single-project VPC — keeps network administration
  centralized while service teams retain their own project boundaries.
- Full mesh connectivity across a growing number of VPCs/sites →
  **Network Connectivity Center** — VPC Peering's O(n²) mesh growth
  doesn't scale operationally past a handful of networks (see below).

**Key configuration surface:**
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
- **Secondary IP ranges**: additional CIDR ranges on a subnet, the
  mechanism GKE uses for pod/service IP allocation (VPC-native/alias
  IP clusters) without consuming primary-range addresses.

**Pricing / cost considerations:** the VPC construct itself is free;
cost accrues from egress traffic (especially cross-region, or to the
internet), Cloud NAT data processing, and any attached resources
(load balancer forwarding rules, VPN tunnels) — a design maximizing
same-region traffic minimizes network cost independent of which
compute/storage services are chosen.

**Performance characteristics:** intra-VPC traffic across regions
still traverses Google's private global backbone (not the public
internet), which is materially lower-latency and more consistent than
a public-internet path between the same two regions — a relevant fact
whenever a scenario compares "route through our own VPC across
regions" against a public-internet-dependent alternative.

**Scaling behavior:** subnet ranges and secondary ranges must be
sized upfront with growth in mind — resizing a subnet's primary range
is possible (expand only) but redesigning around an undersized range
later is disruptive; this is why custom-mode's deliberate range
planning beats auto-mode's fixed /20s for anything expected to grow.

**Security posture:** hierarchical firewall policies enforce org-wide
guardrails that can't be loosened below the level they're set;
per-VPC firewall rules should be scoped to tags/service accounts, not
broad CIDRs, to keep blast radius contained; VPC Flow Logs provide
network-level audit/troubleshooting visibility.

**HA / failure-mode behavior:** the VPC construct itself has no
single point of failure (it's a global control-plane construct, not a
piece of running infrastructure); HA at the network layer comes from
how load balancers, NAT, and routing are configured on top of it, not
from the VPC itself.

**Common mistakes / misconfigurations:**
- Using auto-mode VPC in production, inheriting default /20 ranges
  that don't align with a deliberate IP plan.
- Assuming VPC Peering is transitive and designing a network that
  silently fails to connect A↔C through a shared peer B.
- Broad, unscoped firewall rules (0.0.0.0/0 ingress on more than the
  minimum required ports/tags).
- Not planning secondary IP ranges before deploying VPC-native GKE
  clusters, leading to IP exhaustion as pod count grows.

**Common exam scenario cues:** "multi-team landing zone with
centralized network administration" → Shared VPC; "growing number of
VPCs/sites needing interconnectivity" → NCC over a peering mesh;
"strict org-wide firewall guardrail that no project admin can
override" → hierarchical firewall policy.

---

## Cloud Load Balancing

**Purpose:** multiple tiers, matched to traffic scope and protocol —
picking the wrong tier is a recurring exam trap (over- or
under-scoping).

**When to use:** any workload receiving traffic that needs
distribution across multiple backend instances/containers, health-
based failover, or edge-facing public exposure with global reach.

**When NOT to use — use something else instead:**
- A purely internal, single-service call path where a load balancer
  tier adds unneeded cost/complexity and Cloud Run/GKE's own internal
  service discovery suffices → evaluate whether a full LB tier is
  actually needed versus simpler service-to-service invocation
  (contextual, not a blanket rule).
- Global reach for traffic that is entirely regional in practice
  (all users and backends in one region) → the **regional** LB tier
  — paying for global anycast IP/routing when there's no multi-region
  traffic to route is needless cost, a stated over-scoping trap.

**Key configuration surface — tiers:**

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
  are automatically removed from rotation, the foundation of Domain
  6's autohealing story at the network layer.
- **URL maps / path-based routing**: the Application LB tiers route
  by host/path to different backend services — the mechanism for
  serving multiple microservices behind one global entry point/IP.

**Pricing / cost considerations:** billed on forwarding rules, data
processed, and (for global tiers) the anycast infrastructure premium
over a regional tier — matching scope to actual traffic footprint
(regional vs. global) is a direct Domain 4 cost lever, not just an
architectural nicety.

**Performance characteristics:** global external Application LB uses
Google's anycast edge network, routing users to the closest healthy
backend automatically — lower latency for geographically distributed
users than a single-region endpoint behind a regional LB or DNS-based
geo-routing.

**Scaling behavior:** backend capacity scales via the underlying
compute (MIG autoscaler, GKE HPA, Cloud Run instance scaling); the LB
itself scales transparently to handle traffic volume without capacity
planning on the load-balancer construct itself.

**Security posture:** integrates with Cloud Armor for L7 protections
(see below) on the external Application LB tiers; SSL/TLS termination
at the LB with managed certificates removes certificate-management
burden from backends; internal LB tiers keep traffic off the public
internet entirely.

**HA / failure-mode behavior:** health checks automatically remove
unhealthy backends from rotation and reintroduce them once healthy
again — the load-balancing layer's contribution to Domain 6's
self-healing story; global tiers additionally provide cross-region
failover by routing to the nearest *healthy* region, not just the
nearest region.

**Common mistakes / misconfigurations:** choosing a global tier for
an entirely single-region workload (unnecessary cost); choosing a
regional tier for a workload that actually needs global reach/anycast
resilience; forgetting health checks are what actually drives
automatic failover — a misconfigured or absent health check silently
disables that story.

**Common exam scenario cues:** "public-facing web app, users
worldwide, single IP" → global external Application LB; "internal
microservice-to-microservice traffic" → internal Application LB;
"need the original client IP preserved" → passthrough Network LB;
"static asset delivery at global scale" → pair with Cloud CDN.

---

## Cloud Interconnect / Cloud VPN

**Purpose:** hybrid connectivity — see Tree 3 in
`00-START-HERE/DECISION-TREES.md` for the selection logic; this
section is configuration depth.

**When to use:** any scenario with an on-prem or another-cloud
footprint needing private connectivity to GCP — both current case
studies with a hybrid footprint (EHR Healthcare, TerramEarth) assume
some form of this.

**When NOT to use — use something else instead:**
- No on-prem/other-cloud footprint at all, purely cloud-native → this
  entire category is irrelevant; don't provision hybrid connectivity
  a scenario never asked for.
- A requirement for fastest possible provisioning with a small,
  short-term connectivity need → **Cloud VPN (HA VPN)** rather than
  Interconnect — Interconnect's provisioning lead time (physical
  cross-connects, partner coordination) doesn't fit an urgent/
  short-lived requirement.
- Sustained, very high-throughput, low-latency, dedicated hybrid
  traffic → **Dedicated (or Partner) Interconnect**, not VPN — VPN's
  throughput is capped by internet path characteristics and IPsec
  overhead, unsuited to sustained high-bandwidth transfer.

**Key configuration surface:**
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
  provision (hours), throughput capped by internet path
  characteristics, not a dedicated circuit.
- **Router (Cloud Router)**: required for dynamic routing (BGP) over
  either Interconnect or VPN — without it, only static routes are
  possible, which doesn't scale for a growing hybrid environment.

**Pricing / cost considerations:** Dedicated Interconnect has the
highest fixed cost (physical circuit, colocation fees) but the lowest
marginal cost per GB at high sustained volume; Cloud VPN has near-zero
provisioning cost but higher per-GB effective cost and no dedicated
capacity guarantee — a scenario weighing steady-state high-volume
hybrid traffic against a small/occasional need is testing this
crossover point.

**Performance characteristics:** Dedicated/Partner Interconnect
offers predictable, dedicated bandwidth and lower latency than VPN's
internet-path-dependent performance; VPN throughput and latency vary
with public internet conditions between the two endpoints.

**Scaling behavior:** Interconnect circuits can be provisioned with
additional VLAN attachments for more bandwidth; HA VPN scales by
adding additional tunnels (subject to per-tunnel throughput limits)
rather than a single circuit's capacity ceiling.

**Security posture:** VPN traffic is IPsec-encrypted in transit by
design; Dedicated/Partner Interconnect traffic is **not** encrypted
by default at the network layer (it's a private physical/logical
circuit, not the public internet) — a scenario requiring encryption
*and* dedicated-circuit performance needs an explicit
encryption-over-Interconnect (e.g. HA VPN over Interconnect,
MACsec where available) layered on top, not either service alone.

**HA / failure-mode behavior:** HA VPN reaches 99.99% SLA specifically
when configured with two interfaces/tunnels to two peer gateway
interfaces — a single-tunnel VPN configuration does not qualify for
that SLA. Interconnect HA requires redundant circuits (two Dedicated
Interconnect connections in different edge availability domains, or
Partner Interconnect equivalents) — a single circuit is a single
point of failure regardless of its raw bandwidth.

**Common mistakes / misconfigurations:** deploying a single VPN
tunnel and assuming the 99.99% SLA applies; provisioning a single
Interconnect circuit for a "critical hybrid path" requirement without
redundancy; using static routes instead of Cloud Router/BGP for an
environment expected to grow, creating a route-maintenance burden.

**Common exam scenario cues:** "dedicated, high-throughput, low-
latency hybrid connection" → Interconnect; "quick to provision,
lower/variable bandwidth acceptable" → Cloud VPN; "need dynamic
routing between on-prem and GCP" → Cloud Router is required
regardless of the underlying transport.

---

## Network Connectivity Center

**Purpose:** hub-and-spoke management for hybrid/multi-cloud
connectivity at enterprise scale — see Domain 1 §1.3 Pattern C.

**When to use:** a growing number of sites/VPCs/clouds that all need
interconnectivity through a centrally managed hub, rather than
pairwise connections.

**When NOT to use — use something else instead:**
- Two or three VPCs with a stable, small connectivity need → **direct
  VPC Peering** — NCC's hub-and-spoke management overhead isn't
  justified for a small, static topology.
- A single on-prem site connecting to a single VPC → plain
  **Interconnect/VPN** directly is sufficient; NCC's value is
  specifically in managing *many* spokes centrally.

**Key configuration surface:**
- **Hub**: the central management point; **spokes**: VPCs, VPN
  tunnels, Interconnect attachments, or (via a router appliance spoke)
  third-party SD-WAN/router integrations.
- **Why it beats a peering mesh**: a full-mesh VPC Peering topology
  grows O(n²) in connections as sites/VPCs are added; NCC's hub model
  scales linearly and centralizes route/policy management — the
  answer whenever a scenario describes a *growing* number of
  sites/VPCs needing interconnectivity.

**Pricing / cost considerations:** billed on data processed through
the hub plus the underlying spoke connectivity's own cost
(Interconnect/VPN charges still apply) — the value proposition is
operational (centralized management, linear scaling), not necessarily
a raw discount versus a peering mesh at small scale.

**Performance characteristics:** traffic between spokes traverses
Google's backbone via the hub; performance characteristics inherit
from the underlying spoke connectivity type (Interconnect vs. VPN)
rather than NCC adding its own latency profile.

**Scaling behavior:** the entire reason this service exists — adding
a new site/VPC is a single new spoke registration against the
existing hub, not a new pairwise connection to every existing
network, unlike a peering mesh's O(n²) growth.

**Security posture:** centralizes route and policy visibility, making
it easier to audit and enforce consistent connectivity policy across
a growing topology than reconciling many independent peering
relationships.

**HA / failure-mode behavior:** resilience depends on the underlying
spoke connectivity's own HA configuration (redundant Interconnect
circuits, HA VPN tunnels) — NCC itself is a managed control-plane
construct, not an additional physical failure domain to design
around.

**Common mistakes / misconfigurations:** adopting NCC for a small,
static two-or-three-VPC topology where plain peering would be simpler
to reason about; forgetting that each spoke's own connectivity type
still needs its own HA design (NCC doesn't retroactively make an
unredundant VPN tunnel HA).

**Common exam scenario cues:** "growing number of sites/VPCs/clouds
needing interconnectivity," "centralized hub-and-spoke network
management," "replace an unmanageable full-mesh peering topology."

---

## Cloud DNS

**Purpose:** managed authoritative DNS — public and private zones.

**When to use:** any workload needing authoritative DNS resolution,
whether internet-facing (public zones) or internal-only (private
zones scoped to a VPC).

**When NOT to use — use something else instead:**
- A scenario needing DNS resolution to also route/load-balance
  traffic based on health or geography beyond simple record
  resolution → pair with **Cloud Load Balancing**, since Cloud DNS
  itself resolves names, it doesn't health-check or load-balance on
  its own the way a GSLB-style product might.

**Key configuration surface:**
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

**Pricing / cost considerations:** billed per managed zone plus
queries served — low relative to most other networking cost drivers
in this file; rarely the focus of a Domain 4 cost-optimization
scenario compared to egress or LB tier choice.

**Performance characteristics:** globally anycast authoritative
serving, low query latency regardless of where the query originates.

**Scaling behavior:** scales transparently with query volume, no
capacity to provision.

**Security posture:** DNSSEC support for public zones (protects
against cache-poisoning/spoofing); private zones are inherently
unreachable from the public internet, which is itself a security
boundary for internal-only names.

**HA / failure-mode behavior:** authoritative serving is inherently
redundant across Google's global anycast network — no single point of
failure to design around at the DNS layer itself; a hybrid DNS
forwarding misconfiguration (not a Cloud DNS outage) is the far more
likely source of a "names don't resolve" incident in a hybrid design.

**Common mistakes / misconfigurations:** omitting DNS forwarding
configuration in a hybrid design, leaving on-prem systems unable to
resolve GCP-internal names (or vice versa) — a scenario testing
"design has a gap" often hinges on exactly this omission; relying on
public zones for internal-only names, unnecessarily exposing internal
naming structure.

**Common exam scenario cues:** "consistent name resolution across
on-prem and GCP," "internal-only DNS names never exposed publicly,"
DNS forwarding/peering explicitly named as a requirement or
conspicuously missing from a described design.

---

## Cloud NAT

**Purpose:** managed, distributed NAT gateway for outbound-only
internet access from private (no external IP) instances/GKE pods.

**When to use:** any private (no external IP) Compute Engine
instance, GKE node/pod, or Cloud Run (via VPC egress) workload that
needs outbound-only internet access (package downloads, calling
third-party APIs) without a public IP.

**When NOT to use — use something else instead:**
- Inbound public access is required → **a load balancer or an
  explicit external IP** — Cloud NAT is strictly outbound and will
  never satisfy an inbound requirement.
- A legacy self-managed NAT-instance pattern is proposed as "more
  control" → **Cloud NAT** is the exam-correct modern answer;
  self-managed NAT instances add operational burden (sizing, HA,
  patching) Cloud NAT removes entirely.

**Key configuration surface:**
- **No inbound connections** — NAT is strictly outbound; inbound
  public access needs a load balancer or explicit external IP, never
  Cloud NAT.
- **Fully managed** — no NAT gateway instance to size, patch, or make
  HA yourself, unlike a self-managed NAT-instance pattern (legacy, not
  the exam-correct answer for a new design).
- **Regional resource**, attached via a Cloud Router — provision per
  region that has private instances needing outbound access.
- **Port allocation**: NAT IPs have a finite number of usable ports
  per IP; a high-fan-out workload (many simultaneous outbound
  connections) may need multiple NAT IPs or dynamic port allocation
  tuning to avoid port exhaustion.

**Pricing / cost considerations:** billed on NAT gateway uptime plus
data processed — a cost that scales with outbound traffic volume;
still generally cheaper and operationally simpler than the
alternative of provisioning/patching/HA-ing a self-managed NAT
instance fleet.

**Performance characteristics:** distributed, managed implementation
avoids the single-instance throughput ceiling a self-managed NAT
instance would hit under high fan-out.

**Scaling behavior:** scales automatically with traffic; port
exhaustion (not raw throughput) is the practical scaling limit to
watch for at very high connection-count fan-out, addressed by
provisioning additional NAT IPs.

**Security posture:** keeps instances without any public IP at all —
reduces the internet-facing attack surface versus assigning external
IPs directly, a materially stronger default security posture than
the legacy pattern of giving every instance a public IP.

**HA / failure-mode behavior:** fully managed and inherently
redundant within the region — no NAT-instance failover to design or
test, unlike the self-managed pattern it replaces.

**Common mistakes / misconfigurations:** assuming Cloud NAT enables
any inbound access; under-provisioning NAT IPs for a very high
fan-out workload and hitting port exhaustion; forgetting Cloud NAT is
regional and needs to be provisioned per region with private
instances.

**Common exam scenario cues:** "private instances need outbound
internet access only," "no external IPs on instances," "replace a
self-managed NAT instance with a managed alternative."

---

## Cloud Armor

**Purpose:** edge security policy engine, attached to external
Application LB tiers.

**When to use:** any public-facing HTTP(S) service needing L7
protection against common web attacks (SQLi, XSS), volumetric DDoS,
geo-based restrictions, or rate-limiting.

**When NOT to use — use something else instead:**
- Internal-only traffic never exposed via an external Application LB
  → Cloud Armor doesn't attach to internal LB tiers or non-HTTP(S)
  traffic; internal segmentation is a **VPC firewall rules/Network
  Policy** concern instead (see VPC section above and
  `04-security-iam.md`).
- Non-HTTP(S) traffic (raw TCP/UDP) → Cloud Armor's L7 ruleset doesn't
  apply; a **Cloud Armor Network Edge Security Policy** or upstream
  network-layer control is the relevant mechanism for non-HTTP
  scenarios, distinct from the WAF ruleset described here.

**Key configuration surface:**
- **WAF rules**: preconfigured OWASP Top 10 rulesets (SQLi, XSS,
  etc.) plus custom rules (IP allow/deny lists, geo-based rules,
  rate-limiting).
- **DDoS protection**: works with Google's global network edge to
  absorb volumetric attacks before they reach backend capacity.
- **Adaptive Protection**: ML-based anomaly detection for L7 DDoS
  patterns beyond static rule matching — the answer for "detect novel
  attack patterns," not just known signatures.

**Pricing / cost considerations:** billed on policy count plus
requests evaluated — a marginal add-on cost relative to the LB tier
it protects; justified for any public-facing surface handling
sensitive data or subject to compliance requirements around web
application protection.

**Performance characteristics:** enforcement happens at Google's edge
before traffic reaches backend capacity — malicious/blocked traffic
never consumes backend compute, which is itself a performance/cost
protection, not just a security one.

**Scaling behavior:** scales transparently with the LB tier it's
attached to; no separate capacity to provision.

**Security posture:** the primary L7 security control for public
HTTP(S) surfaces in this file — complements (not replaces) VPC
firewall rules (network layer) and IAM (identity layer); see
`04-security-iam.md`'s Security Command Center section for how a
misconfigured or absent Cloud Armor policy would surface as a
posture finding at the organization level.

**HA / failure-mode behavior:** enforced at the global edge alongside
the LB tier it's attached to, inheriting that tier's redundancy — no
separate failover concept for the policy engine itself.

**Common mistakes / misconfigurations:** attaching Cloud Armor only
to some of several backend services behind a shared URL map, leaving
gaps; relying solely on static WAF rules for a scenario explicitly
describing evolving/novel attack patterns instead of enabling
Adaptive Protection; forgetting Cloud Armor doesn't apply to internal
LB tiers when a scenario actually needs internal traffic protected
(a firewall rule/Network Policy question instead).

**Common exam scenario cues:** "protect a public web app from SQL
injection/XSS," "geo-restrict access," "rate-limit abusive clients,"
"detect novel/evolving attack patterns" → Adaptive Protection
specifically.

---

## Private Google Access / Private Service Connect

**Purpose:** two distinct mechanisms, frequently confused on the
exam — direction of access is the key differentiator.

**When to use:**
- **Private Google Access (PGA)**: any private (no external IP)
  VM/workload that needs to call Google APIs (Cloud Storage,
  BigQuery, etc.) without traversing the public internet.
- **Private Service Connect (PSC)**: consuming a Google-managed or
  partner service privately via an internal IP, **or** publishing
  your own service for private consumption by other VPCs/projects
  without full network exposure.

**When NOT to use — use something else instead:**
- A scenario needing the *reverse* direction of PGA (an external party
  privately reaching a service *you* own) → **PSC**, not PGA — PGA is
  strictly outbound-to-Google's-APIs, it has no mechanism for
  publishing your own service.
- Full bidirectional network-level connectivity between two VPCs is
  the genuine requirement (not just reaching one specific published
  service) → **VPC Peering or NCC**, not PSC — PSC intentionally
  exposes only the specific published service, not the whole network;
  reaching for VPC Peering when only one service needs exposing
  over-exposes the network beyond what's needed (the mirror-image
  trap).

**Key configuration surface:**
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

**Pricing / cost considerations:** PGA has no separate service cost
(it's a subnet flag); PSC endpoints/attachments incur a small
per-hour and data-processing charge — both are materially cheaper
than provisioning full VPC Peering (or a NAT/public-IP workaround)
purely to reach or publish a single service.

**Performance characteristics:** both mechanisms keep traffic on
Google's private network path rather than the public internet,
avoiding public-internet latency/variability for the traffic they
cover.

**Scaling behavior:** PGA scales with the subnet's own traffic
(no separate capacity concept); PSC endpoints scale per published
service's own backend capacity.

**Security posture:** both materially reduce the network's public
attack surface versus the alternatives (public IPs for PGA's use
case, full VPC Peering for PSC's use case) — this is the core
security argument for choosing either over a broader-exposure
alternative.

**HA / failure-mode behavior:** neither introduces its own failure
domain beyond the underlying service's own availability; PSC-
published service availability is governed by that service's own HA
configuration (e.g. the backend LB/service behind the PSC attachment).

**Common mistakes / misconfigurations:** reaching for full VPC
Peering when only one specific service needs to be privately exposed
to another VPC (PSC over-exposure trap); forgetting to enable PGA on
a subnet whose private instances unexpectedly can't reach Google
APIs and misdiagnosing it as a firewall issue; confusing PGA's
outbound-only direction with PSC's ability to also publish inbound.

**Common exam scenario cues:** "expose our internal API to another
business unit's VPC without giving them broad network access" is a
PSC question; reaching for VPC Peering here over-exposes the network
beyond what's needed. "Private instances need to call Cloud Storage/
BigQuery without a public IP" is a PGA question.

---

## Hybrid connectivity naming note — GKE Enterprise (Anthos)

> **MEDIUM confidence, recall-level fact — not independently
> re-verified this session.** See `CLAUDE.md` §7 and `RUNBOOK.md` §7.

The hybrid-connectivity patterns above (Interconnect, HA VPN, Network
Connectivity Center) are frequently paired, in both real designs and
exam scenarios, with **GKE Enterprise** for managing Kubernetes
workloads consistently across on-prem and multiple clouds sitting
behind that connectivity. **Anthos** is the older product name for
this same territory; treat it as a legacy/synonym term a scenario
might still use, and lead any answer with "GKE Enterprise" as the
current name. Full GKE Enterprise/Anthos configuration depth (fleet
management, Config Sync, Policy Controller) lives in
`02-services/01-compute.md`'s GKE section — this note exists here
specifically because hybrid connectivity design (this file) and
hybrid Kubernetes management (compute file) are two halves of the
same recurring case-study theme (both EHR Healthcare and TerramEarth
assume a hybrid footprint, per `CLAUDE.md` §7).
