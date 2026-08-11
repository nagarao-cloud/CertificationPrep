# Domain 1 Cheat Sheet — Designing and Planning (~24%)

> Compressed by design — for pre-exam rapid review, not first-time
> learning. Full depth: `01-domains/DOMAIN-1-designing-planning.md`.

## Requirement translation (one-liners)

- "Always available" → get the SLA number (99.9/99.99/99.999)
- "Can't lose data" → get the RPO number
- "Fixed launch date" → timeline is binding, not cost
- "Regulated industry" → named compliance regime, region-pin data
- "Small team, no ops" → managed/serverless over self-managed
- "Board worried about lock-in" → open standards, avoid unneeded proprietary APIs

## Region/zone factors (priority order)

1. Data residency/compliance (hard constraint)
2. Latency to users
3. DR (different failure domain)
4. Cost
5. Service availability in-region
6. Compliance certifications

## Compute picker (one-liners) — full tree in DECISION-TREES.md

Container? → K8s features needed? → GKE (Standard=control, Autopilot=no
ops) : event-driven single-purpose? → Functions : full app runtime? →
App Engine : else → Cloud Run. Full VM/kernel control needed? → Compute
Engine. ML training/serving? → Vertex AI.

## Storage picker (one-liners) — full tree in DECISION-TREES.md

Unstructured → Cloud Storage. POSIX filesystem → Filestore. Relational
+ global strong consistency → Spanner. Relational, fits single region →
Cloud SQL. Document + mobile/offline → Firestore. Wide-column,
time-series, huge throughput → Bigtable. Analytics/SQL over huge data →
BigQuery. Cache only → Memorystore.

## Network topology one-liners

- Centralized governance, shared IP space → Shared VPC
- Strong isolation, no sharing → independent VPCs (not Peering mesh)
- Many spokes, hybrid, growing → Network Connectivity Center
- Peering is NOT transitive

## Migration — 6 R's (RRRRTR)

Retire → Repurchase → Retain → Rehost → Replatform → Refactor
(increasing commitment/effort, roughly)

- Deadline-driven → Rehost
- Minor swap (self-managed DB → Cloud SQL) → Replatform
- High value, long life, time to invest → Refactor
- SaaS exists → Repurchase
- Real durable reason to stay on-prem → Retain
- Sunsetting anyway → Retire

## Data transfer

- Large + poor/no network link → Transfer Appliance
- Network-based, scheduled/recurring → Storage Transfer Service
- SaaS source, recurring → BigQuery Data Transfer Service
- DB migration, minimal downtime → Database Migration Service

## Top traps

1. Multi-region by default (over-engineering)
2. Ignoring team-capability constraints
3. Refactor when speed is the actual constraint
4. Confusing "future improvements" (judgment, process) with "technical requirements" (usually a clear best-fit service)
