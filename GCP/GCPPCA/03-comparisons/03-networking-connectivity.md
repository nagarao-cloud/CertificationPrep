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
| Best for | Fast provisioning, moderate bandwidth, cost-sensitive | Bandwidth need without a direct colo presence | Sustained high bandwidth, strict latency | Many spokes/sites, growing hybrid footprint |
| Scaling to many sites | Poor (each site is a separate tunnel set) | Poor (each site separate) | Poor (each site separate) | Good — hub avoids full-mesh growth |

## Tradeoff call-outs

- **Use Cloud VPN when** the scenario's binding constraint is
  time-to-provision or budget, and bandwidth/latency needs are modest.
  **Don't use it when** the scenario states a strict low-latency,
  high-throughput hybrid requirement — internet-path variability makes
  VPN's latency/throughput unpredictable at that tier.
- **Use Partner Interconnect when** the org needs more bandwidth/lower
  latency than VPN but doesn't have (or want) a direct colocation
  presence, and an existing relationship with a supported partner
  exists. **Don't use it when** the org already has direct colo
  presence and needs maximum bandwidth — Dedicated is a better fit and
  often not meaningfully slower to arrange if the colo relationship
  already exists.
- **Use Dedicated Interconnect when** the scenario states sustained
  high bandwidth (10s–100s of Gbps) and the lowest, most predictable
  latency, and the timeline tolerates weeks of provisioning.
- **Use Network Connectivity Center when** the scenario describes
  *multiple* sites/VPCs needing interconnectivity, especially a
  *growing* number over time. **Don't use it when** there are only one
  or two endpoints to connect — NCC's value is in avoiding the
  full-mesh peering explosion, which doesn't materialize with just two
  endpoints.

## Load balancer tier matrix

| Dimension | Global External App LB | Regional External App LB | Internal App LB | Internal Passthrough Network LB |
|---|---|---|---|---|
| Scope | Global (anycast IP) | Single region | Single region, private | Single region, private |
| Protocol awareness | L7 (HTTP/S) | L7 (HTTP/S) | L7 (HTTP/S) | L4 (TCP/UDP passthrough) |
| Client IP preserved | No (proxied) | No (proxied) | No (proxied) | Yes (passthrough) |
| Cloud CDN integration | Yes | Yes | No | No |
| Cloud Armor integration | Yes | Yes | No | No |
| Cross-region failover | Yes, automatic | No | No | No |
| Best for | Public global web/API traffic | Public traffic scoped to one region | Internal microservice traffic | Internal traffic needing real client IP (e.g. legacy apps expecting it) |

**Tradeoff:** a scenario needing regional DR/failover (Domain 6 Tree 5,
Active-Active or Active-Passive tiers) requires the **Global** LB tier
specifically — a Regional LB does not reroute traffic to a healthy
region on its own, regardless of how the backend/database layer is
configured.

## VPC connectivity model matrix

| Dimension | Shared VPC | VPC Peering | Private Service Connect |
|---|---|---|---|
| Administration | Centralized (host project) | Per-VPC (both sides configure) | Per-service (publisher/consumer) |
| Transitivity | N/A (one network, many projects) | Not transitive | N/A (point-to-service, not network-wide) |
| Exposure scope | Full network to all attached service projects | Full network between the two peered VPCs | Exactly one published service |
| Best for | Centralized governance, many teams sharing IP space | Two teams' VPCs needing broad mutual connectivity | Exposing/consuming one specific service with minimal blast radius |
| Common exam-trap pairing | Using it for teams needing strong isolation instead | Assuming transitivity across 3+ peered VPCs | Reaching for full Peering when only one service needs to be reachable |
