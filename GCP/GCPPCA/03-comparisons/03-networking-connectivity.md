# Comparison: Networking & Hybrid Connectivity Options

> Selection tree: `00-START-HERE/DECISION-TREES.md` Tree 3. Per-service
> depth: `02-services/03-networking.md`.

## Hybrid connectivity matrix

| Dimension | Cloud VPN (HA VPN) | Partner Interconnect | Dedicated Interconnect | Network Connectivity Center |
|---|---|---|---|---|
| What it is | Encrypted IPsec tunnel over public internet | Connection via a supported service provider | Direct physical connection at a colo facility | Hub-and-spoke management layer over the above |
| Provisioning time | Hours | Days | Days–weeks | Depends on underlying spokes |
| Bandwidth range | Up to ~3Gbps per tunnel (aggregate with multiple tunnels) | 50Mbps–50Gbps typical | 10Mbps–200Gbps per circuit | N/A (orchestration layer) |
| Latency | Variable (internet-dependent) | Low, predictable | Lowest, most predictable | Depends on underlying spokes |
| SLA | 99.99% with HA VPN 2-tunnel config | Provider-dependent, typically high | Highest, dedicated capacity | N/A (orchestration layer) |
| Encryption | Yes (IPsec, built in) | Not inherently (add VPN over it if needed) | Not inherently (add VPN over it if needed) | N/A |
| Setup complexity/cost | Lowest | Medium (via partner relationship) | Highest (physical cross-connect) | Medium (adds hub management) |
| Cost model | Pay for the VPN gateway + standard egress | Provider's bandwidth fees + Google's port fees | Google's port fees (fixed per circuit) + your colo/cross-connect costs | Hub management fee + underlying spoke costs, no separate bandwidth charge |
| Dynamic routing | Cloud Router (BGP) supported | Cloud Router (BGP) supported | Cloud Router (BGP) supported | Inherits routing from underlying spokes |
| Monitoring/observability | Cloud Monitoring VPN tunnel status/throughput metrics | Cloud Monitoring Interconnect attachment metrics | Cloud Monitoring Interconnect attachment metrics + physical link diagnostics from the provider | Cloud Monitoring hub/spoke topology and route-propagation visibility |
| Typical failure mode | Tunnel flapping under sustained high throughput beyond per-tunnel capacity; internet path variability causing jitter | Provider-side outage or capacity limits outside your direct control | Physical link failure (mitigated by dual redundant circuits, the recommended production pattern) | Spoke misconfiguration/route conflicts as the site count grows |
| Migration/adoption friction | Lowest — software-only, no physical dependency | Medium — requires selecting and contracting a supported partner | Highest — requires a physical cross-connect at a Google colocation facility, plus your own circuit to that facility | Low incremental friction per new spoke once the hub exists; the friction is in initially deciding to adopt a hub model |
| Scaling to many sites | Poor (each site is a separate tunnel set) | Poor (each site separate) | Poor (each site separate) | Good — hub avoids full-mesh growth |
| Best for | Fast provisioning, moderate bandwidth, cost-sensitive | Bandwidth need without a direct colo presence | Sustained high bandwidth, strict latency | Many spokes/sites, growing hybrid footprint |

## Tradeoff call-outs

- **Use Cloud VPN when** the scenario's binding constraint is
  time-to-provision or budget, and bandwidth/latency needs are modest.
  **Don't use it when** the scenario states a strict low-latency,
  high-throughput hybrid requirement — internet-path variability makes
  VPN's latency/throughput unpredictable at that tier. **Edge case:**
  Cloud VPN is also the correct *supplementary* answer even in a
  Dedicated Interconnect design — as an encrypted failover path if the
  physical circuit goes down, since Interconnect itself carries no
  built-in encryption. A scenario asking "what happens if the
  Interconnect circuit fails" is testing whether you'd pair it with a
  VPN failover route, not whether you'd replace Interconnect entirely.
- **Use Partner Interconnect when** the org needs more bandwidth/lower
  latency than VPN but doesn't have (or want) a direct colocation
  presence, and an existing relationship with a supported partner
  exists. **Don't use it when** the org already has direct colo
  presence and needs maximum bandwidth — Dedicated is a better fit and
  often not meaningfully slower to arrange if the colo relationship
  already exists. **Near-miss trap:** "we need Interconnect-class
  performance but don't have a data center presence at a Google
  colocation facility" is the Partner signal specifically — candidates
  sometimes default to Dedicated because it "sounds better," missing
  that Dedicated requires physical proximity to a Google point of
  presence that the scenario explicitly says doesn't exist.
- **Use Dedicated Interconnect when** the scenario states sustained
  high bandwidth (10s–100s of Gbps) and the lowest, most predictable
  latency, and the timeline tolerates weeks of provisioning. **Edge
  case:** a production-grade Dedicated Interconnect design pairs two
  circuits in different metro/edge availability domains for redundancy
  — a scenario asking about eliminating a single point of failure in
  an Interconnect design is testing for this dual-circuit pattern, not
  a switch to a different connectivity product.
- **Use Network Connectivity Center when** the scenario describes
  *multiple* sites/VPCs needing interconnectivity, especially a
  *growing* number over time. **Don't use it when** there are only one
  or two endpoints to connect — NCC's value is in avoiding the
  full-mesh peering explosion, which doesn't materialize with just two
  endpoints. **Edge case:** NCC also fits a scenario needing to
  integrate third-party SD-WAN/router appliances as spokes (via router
  appliance spokes) — a detail worth recognizing when a scenario
  mentions an existing SD-WAN vendor relationship the design must
  preserve rather than replace.

## Reading a scenario for the hybrid-connectivity signal

```
"Need it live by Friday"                          → Cloud VPN
"Sustained 40Gbps, strictest latency SLA"          → Dedicated Interconnect
"No data center presence at a Google PoP, but need
 more than VPN can offer"                          → Partner Interconnect
"12 branch offices today, growing to 40+ next year" → Network Connectivity Center
"Interconnect circuit needs an encrypted failover
 path"                                             → Cloud VPN alongside Interconnect
"Existing SD-WAN vendor must integrate, not be
 replaced"                                         → Network Connectivity Center (router appliance spoke)
```

## Load balancer tier matrix

| Dimension | Global External App LB | Regional External App LB | Internal App LB | Internal Passthrough Network LB | Global External Proxy Network LB |
|---|---|---|---|---|---|
| Scope | Global (anycast IP) | Single region | Single region, private | Single region, private | Global (anycast IP) |
| Protocol awareness | L7 (HTTP/S) | L7 (HTTP/S) | L7 (HTTP/S) | L4 (TCP/UDP passthrough) | L4 (TCP/SSL, non-HTTP) |
| Client IP preserved | No (proxied) | No (proxied) | No (proxied) | Yes (passthrough) | No (proxied) |
| Cloud CDN integration | Yes | Yes | No | No | No |
| Cloud Armor integration | Yes | Yes | No | No | Limited (network-layer policies only) |
| Cross-region failover | Yes, automatic | No | No | No | Yes, automatic |
| Health-check/autohealing tie-in | Backend service health checks remove unhealthy MIG/GKE NEG/Cloud Run backends from rotation | Same, scoped to one region | Same, scoped to one region, internal only | Same, scoped to one region, internal only | Same, global backend health checks |
| Cost model | Forwarding-rule + data-processing charges, global scope premium | Forwarding-rule + data-processing charges, regional | Lower — internal-only traffic, regional | Lowest — pure passthrough, minimal processing overhead | Forwarding-rule + data-processing charges, global scope |
| Typical failure mode | Backend flapping in one region incorrectly draining global capacity if health checks are misconfigured | Regional capacity exhaustion with no automatic cross-region relief | Misrouted internal traffic from an overly broad firewall/route scope | Loss of L7 features (no header-based routing) surprising teams expecting App LB behavior | Non-HTTP protocol edge cases (custom TCP protocols) needing careful health-check configuration |
| Best for | Public global web/API traffic | Public traffic scoped to one region | Internal microservice traffic | Internal traffic needing real client IP (e.g. legacy apps expecting it) | Global reach needed but not HTTP-aware routing |

**Tradeoff:** a scenario needing regional DR/failover (Domain 6 Tree 5,
Active-Active or Active-Passive tiers) requires the **Global** LB tier
specifically — a Regional LB does not reroute traffic to a healthy
region on its own, regardless of how the backend/database layer is
configured. **Near-miss trap:** Global External Application LB vs.
Global External Proxy Network LB — both are global and both fail over
across regions automatically, but a scenario needing HTTP-aware routing
(path-based rules, header-based routing, Cloud CDN, Cloud Armor WAF
rules) needs the **Application** LB; a scenario carrying a non-HTTP TCP
protocol (a custom game-server protocol, for instance) that still needs
global reach needs the **Proxy Network** LB instead — picking the
Application LB for a non-HTTP protocol is a common exam distractor.

## VPC connectivity model matrix

| Dimension | Shared VPC | VPC Peering | Private Service Connect | VPC Service Controls (perimeter, for contrast) |
|---|---|---|---|---|
| Administration | Centralized (host project) | Per-VPC (both sides configure) | Per-service (publisher/consumer) | Centralized (org/security team) |
| Transitivity | N/A (one network, many projects) | Not transitive | N/A (point-to-service, not network-wide) | N/A (identity/API perimeter, not a network path) |
| Exposure scope | Full network to all attached service projects | Full network between the two peered VPCs | Exactly one published service | Everything inside the perimeter, restricted from anything outside it |
| Quota/scale ceiling | Shared project-level network quotas | Practical ceiling on number of peering connections before mesh complexity dominates | Scales per published service, no mesh-growth problem | N/A — a policy boundary, not a connectivity mechanism |
| Cost model | No extra charge beyond standard network usage | No extra charge beyond standard network usage | Minor per-endpoint charges | No extra charge — a policy control, not a data-plane service |
| Typical failure mode | Overly broad access if a service project is attached without narrower IAM scoping | Assuming transitivity across 3+ peered VPCs (routes simply don't propagate) | Forgetting to also govern DNS resolution for the published service, breaking client resolution | Blocking legitimate cross-perimeter traffic that needed an explicit ingress/egress rule (mitigated by dry-run mode — see `06-iam-security-models.md`) |
| Best for | Centralized governance, many teams sharing IP space | Two teams' VPCs needing broad mutual connectivity | Exposing/consuming one specific service with minimal blast radius | Preventing data exfiltration even by a valid, authenticated identity |
| Common exam-trap pairing | Using it for teams needing strong isolation instead | Assuming transitivity across 3+ peered VPCs | Reaching for full Peering when only one service needs to be reachable | Confusing it with a network-layer firewall control (it's API/identity-layer, not packet-layer — see `06-iam-security-models.md`) |

## Near-miss traps summary (side-by-side pairs the exam expects you to separate)

| Pair | What makes them look similar | The actual deciding signal |
|---|---|---|
| Dedicated vs. Partner Interconnect | Both bypass the public internet, both offer high bandwidth/low latency | Direct colo presence at a Google PoP already exists → Dedicated. No colo presence, need a provider intermediary → Partner |
| Cloud VPN vs. Interconnect (either) | Both connect on-prem to a VPC | Timeline is the binding constraint (need it fast) → VPN. Bandwidth/latency SLA is the binding constraint → Interconnect |
| VPC Peering vs. Shared VPC | Both give cross-project/cross-VPC connectivity | Two independently-administered networks needing mutual access → Peering. One network, many teams, centralized governance intent → Shared VPC |
| Private Service Connect vs. VPC Peering | Both provide private, non-internet connectivity between networks | Need to reach/expose exactly one specific service, minimal blast radius → PSC. Need broad, general network-level reachability between two VPCs → Peering |
| Global App LB vs. Global Proxy Network LB | Both are global, both anycast, both auto-failover | HTTP-aware routing/CDN/Cloud Armor WAF need → Application LB. Non-HTTP TCP/SSL protocol → Proxy Network LB |
| Internal App LB vs. Internal Passthrough Network LB | Both are internal, both regional, both private | Need L7 routing rules (path/header-based) → Internal App LB. Need the real client IP preserved (legacy app expectation) → Passthrough Network LB |
| Network Connectivity Center vs. a growing VPC Peering mesh | Both aim to connect many networks | Site/VPC count is small and stable → Peering may still suffice. Site/VPC count is large or growing → NCC avoids the O(n²) mesh problem |

## Private access patterns (non-hybrid, but frequently confused with the above)

| Mechanism | Direction | Best for | Common exam trap |
|---|---|---|---|
| Private Google Access | Your VMs (no external IP) → Google APIs | VM-initiated calls to Cloud Storage/BigQuery/etc. without a public IP or the public internet | Assuming it also lets *external* clients privately reach your services — it's one-directional, outbound only |
| Private Service Connect (consumer side) | Your VPC → a specific published service (Google-managed or third-party) | Consuming one specific service privately, minimal exposure | Confusing with Peering's broad, all-of-network exposure |
| Private Service Connect (producer side) | Another VPC/project → a service you publish | Exposing one internal API to another business unit without broad network access | Reaching for VPC Peering instead, which over-exposes the network beyond what's needed |
| Cloud NAT | Your private instances → the public internet (outbound only) | Outbound-only internet access for instances with no external IP | Assuming Cloud NAT enables inbound connections — it strictly does not; inbound needs a load balancer or an explicit external IP |

## "Given this constraint in the scenario, which networking pattern?" quick reference

```
"Public web traffic must reach users worldwide, low latency"   → Global External Application LB (+ Cloud CDN)
"Traffic must stay entirely internal to microservices"          → Internal Application LB
"Legacy app needs the real client source IP preserved"          → Internal Passthrough Network LB
"Prevent even an authenticated identity from exfiltrating data" → VPC Service Controls
"Publish an internal API to another BU's VPC, minimal exposure" → Private Service Connect (producer)
"VM needs to reach Cloud Storage/BigQuery, no external IP"      → Private Google Access
"Private instances need outbound-only internet access"          → Cloud NAT
"12+ sites, growing hybrid footprint"                            → Network Connectivity Center
"Need it live by Friday, moderate bandwidth"                     → Cloud VPN (HA VPN)
"Sustained 40Gbps+ at the lowest latency"                        → Dedicated Interconnect
"No Google colo presence, need Interconnect-class performance"   → Partner Interconnect
"Two teams' VPCs need broad mutual connectivity"                 → VPC Peering
"Many teams sharing one centrally-governed IP space"             → Shared VPC
```

## Mesh vs. hub topology, visually

```
Full-mesh VPC Peering (n=5 sites → 10 peering connections, O(n²))

  Site A ─────── Site B
    │  ╲       ╱   │
    │    ╲   ╱      │
    │      ╳        │
    │    ╱   ╲      │
    │  ╱       ╲    │
  Site C ─────── Site D
       ╲         ╱
         ╲     ╱
          Site E

Network Connectivity Center hub-and-spoke (n=5 sites → 5 spokes, O(n))

               ┌────────┐
      Site A ──┤        │
               │        ├── Site B
      Site C ──┤  Hub   │
               │        ├── Site D
      Site E ──┤        │
               └────────┘
```

The exam-relevant reading: mesh peering connection count grows
quadratically as sites are added, and VPC Peering's non-transitivity
means every new site requires a new direct connection to *every*
existing site it needs to reach — NCC's hub model instead requires one
spoke attachment per new site, with the hub handling propagation. A
scenario stating a *current* small site count with *no* stated growth
plan doesn't automatically need NCC — the mesh cost only becomes a
real problem as n grows, which is why "growing" or "expanding" language
in the scenario is the actual trigger, not site count alone.

## Hybrid DNS resolution patterns

| Pattern | Direction | Best for | Common exam trap |
|---|---|---|---|
| Cloud DNS private zone | Resolves internal GCP names within a VPC (and peered VPCs with DNS peering) | Standard internal name resolution for cloud-native resources | Assuming a private zone is resolvable from the public internet — it never is |
| DNS forwarding (on-prem → Cloud DNS) | On-prem resolver forwards specific zone queries into Cloud DNS | On-prem clients needing to resolve cloud-hosted private names | Omitting this in a hybrid design — a frequently under-specified requirement the exam tests by leaving it out of a scenario's stated design and expecting you to flag the gap |
| DNS forwarding (Cloud DNS → on-prem) | Cloud-hosted workloads forward specific zone queries to an on-prem resolver | Cloud workloads needing to resolve on-prem-only names (legacy AD-integrated systems) | Assuming this direction is automatic once the reverse direction is configured — both directions need explicit configuration |
| DNS peering | One VPC's Cloud DNS private zone is queryable from another VPC | Shared-services VPC hosting DNS for several service-project VPCs | Confusing with VPC Peering — DNS peering is a distinct, narrower configuration even when VPC Peering is also in place |

## Worked scenario walkthroughs

**Scenario A — EHR Healthcare, hybrid clinical data replication.**
"Clinics run an on-prem system that must keep syncing patient records
with a new cloud-hosted system during a multi-year phased migration;
the connection must be encrypted, HIPAA-compliant, and the security
team wants centralized visibility into every clinic's connection as
more clinics onboard each quarter." Reasoning: "more clinics onboard
each quarter" is the NCC growth signal; "encrypted, HIPAA-compliant"
doesn't by itself demand Interconnect (Interconnect isn't inherently
encrypted — VPN is) — a scenario combining a genuine encryption
requirement with a *growing* number of sites points to **Cloud VPN
tunnels landing on a Network Connectivity Center hub**, not raw
Interconnect, unless a separate bandwidth/latency number is also
stated that only Interconnect could satisfy.

**Scenario B — TerramEarth, dealer network connectivity.** "TerramEarth
has hundreds of independent equipment dealers worldwide, each with
their own small on-prem system, needing to exchange inventory and
service data with the cloud platform; individual dealer bandwidth needs
are modest, but the list of dealers grows continuously and centralized
policy control over all connections is a stated requirement."
Reasoning: hundreds of low-bandwidth sites, continuous growth, and
centralized policy is the canonical **Network Connectivity Center**
signal — Dedicated Interconnect per dealer would be absurd at that
site count and bandwidth profile, and unmanaged VPN tunnels-per-dealer
would create exactly the full-mesh/no-central-visibility problem NCC
exists to solve.

**Scenario C — Helicopter Racing League, global low-latency video
ingest.** "Live race video must ingest from race venues on multiple
continents into GCP with the lowest possible latency and highest
reliability during live broadcasts; each venue is a temporary,
short-term setup for the duration of the racing season." Reasoning:
"temporary, short-term" is the detail that rules out Dedicated
Interconnect (provisioning takes weeks and assumes a durable physical
presence) even though the stated latency/reliability bar sounds like a
Dedicated Interconnect scenario at first read — the actual answer for
temporary, high-value, latency-sensitive ingest is more likely a
combination of **Cloud VPN for encrypted transport** plus proximity to
Google's network edge (regional ingest points, Media CDN-adjacent
patterns covered in `02-services/05-data-analytics-ai.md`), not a
hybrid-connectivity product designed for durable, long-lived sites.
This scenario shape is a reminder that the *durability* of the
connection (temporary event vs. permanent site) is as much a deciding
signal as bandwidth or latency alone.
