# PCA Service Matrix

> One-page-per-category orientation. Full depth for each category lives
> in `02-services/`; head-to-head tradeoffs live in `03-comparisons/`.
> This file exists so you can answer "what GCP service handles X?" in
> under 5 seconds during review, before diving into any single service's
> depth file.

## Compute

| Need | Service | One-line why |
|---|---|---|
| Full VM control, custom OS/kernel | Compute Engine | IaaS — you own patching, sizing, scaling config |
| Container orchestration at scale, you manage nodes | GKE Standard | Full control over node pools, custom machine types, GPUs/TPUs |
| Container orchestration, no node management | GKE Autopilot | Google manages nodes; pay per pod resource request |
| Stateless HTTP container, scale to zero | Cloud Run | Fully managed, per-request billing, fastest cold-start of the serverless tier |
| Event-driven single-purpose function | Cloud Functions (Gen2) | Smallest unit, built on Cloud Run under the hood since Gen2 |
| Legacy PaaS web app, zero infra | App Engine Standard | Sandboxed runtimes, fast autoscale; **Flexible variant de-emphasized for 2026, see RUNBOOK §7** |
| ML training/serving/MLOps platform | Vertex AI | Unified ML platform: training, Model Garden, endpoints, pipelines, feature store |
| Batch/HPC scientific workloads | Compute Engine + Batch API | Managed job scheduling over MIGs, preemptible-friendly |

## Storage & Databases

| Need | Service | One-line why |
|---|---|---|
| Unstructured object storage, any scale | Cloud Storage | 4 classes (Standard/Nearline/Coldline/Archive) by access frequency |
| Traditional relational, regional | Cloud SQL (MySQL/PostgreSQL/SQL Server) | Managed, up to ~64TB, single-region HA |
| Relational at global scale, strong consistency | Cloud Spanner | Horizontally scalable SQL with external consistency — no other GCP DB does this |
| Wide-column, huge throughput, time-series/IoT | Bigtable | Sub-10ms p99 at massive scale; schema design (row-key) is the whole game |
| Document/mobile-app backend, real-time sync | Firestore | Native mode = mobile/web SDKs + offline sync; serverless NoSQL |
| Analytics warehouse, SQL over petabytes | BigQuery | Serverless, columnar, separates storage/compute billing |
| In-memory cache/session store | Memorystore (Redis/Memcached) | Sub-ms latency, not a system of record |
| POSIX file shares for VMs/containers | Filestore | NFS, for workloads that need a real filesystem, not object semantics |
| Block storage attached to VMs | Persistent Disk / Hyperdisk | Zonal or regional replication, SSD/HDD tiers |

## Networking

| Need | Service | One-line why |
|---|---|---|
| Isolated private network | VPC | Global resource in GCP (subnets are regional) — different mental model than AWS |
| Share a network across projects | Shared VPC | Centralized network admin, decentralized project ownership |
| Connect two VPCs privately | VPC Peering | No transitive peering; direct routes only |
| Hub-and-spoke at enterprise scale | Network Connectivity Center | Manages many-to-many connectivity (VPN, Interconnect, SD-WAN) from one hub |
| Global HTTP(S) load balancing | Global External Application Load Balancer | Anycast IP, one IP for the world, integrates with Cloud Armor/CDN |
| Regional/internal load balancing | Regional/Internal LB tiers | Lower latency for regional or private-only traffic |
| Dedicated high-bandwidth hybrid link | Dedicated/Partner Interconnect | 10Mbps–200Gbps, private, lowest latency hybrid option |
| Encrypted hybrid link over internet | Cloud VPN (HA VPN) | Fastest to provision, higher latency, internet-dependent |
| Outbound-only internet for private instances | Cloud NAT | No inbound; managed, no NAT gateway to size/patch |
| DDoS/WAF protection at the edge | Cloud Armor | Layer 7 rules, OWASP top-10 rulesets, integrates with external LB |
| Private access to Google APIs without public IP | Private Google Access / Private Service Connect | PGA = VM-initiated; PSC = also exposes your own services privately |

## Security & IAM

| Need | Service | One-line why |
|---|---|---|
| Who can do what, on what resource | IAM (roles/bindings) | Additive-only policy; deny via Org Policy, not IAM deny (until IAM Deny policies) |
| Non-human identity for workloads | Service Accounts | Prefer Workload Identity Federation over long-lived keys |
| Federate external/on-prem identity | Workload Identity Federation | No exported service-account keys — the 2026-era "correct" answer over key files |
| Encrypt with keys you control | Cloud KMS (CMEK) | You manage key lifecycle; Google still hosts the HSM/software backend |
| Bring your own key material | Cloud EKM / CSEK | External or customer-supplied key, higher operational burden |
| Store/rotate app secrets | Secret Manager | Versioned secrets with IAM-scoped access, not env vars in code |
| Discover/redact sensitive data | Cloud DLP (Sensitive Data Protection) | Scans and classifies PII/PCI/PHI at rest and in pipelines |
| Network-level data exfiltration control | VPC Service Controls | Perimeter around APIs/services, not just the network — stops exfil via authenticated-but-wrong-project calls |
| Org-wide guardrails | Organization Policy Service | Constraints (allow/deny lists) enforced below IAM, e.g. "no external IPs" |
| Compliance workload isolation | Assured Workloads | Pre-configured compliance regimes (FedRAMP, IL4, etc.) wrapped around a folder |

## Data, Analytics & AI

| Need | Service | One-line why |
|---|---|---|
| Pub/sub messaging backbone | Pub/Sub | Global, at-least-once, decouples producers/consumers |
| Unified batch + streaming pipelines | Dataflow | Apache Beam-based, autoscaling, exactly-once with windowing/watermarks |
| Managed Spark/Hadoop | Dataproc | Lift-and-shift for existing Spark/Hive jobs; ephemeral clusters preferred |
| No-code/low-code data integration | Cloud Data Fusion | GUI pipeline builder over Dataproc, for teams without pipeline engineers |
| Managed Airflow | Cloud Composer | Orchestration/DAGs across GCP + external systems |
| Foundation models, RAG, agents | Vertex AI (Model Garden, Agent Builder) | Managed access to Gemini and partner models plus grounding/RAG tooling |

## Management & Operations

| Need | Service | One-line why |
|---|---|---|
| Metrics, dashboards, alerting | Cloud Monitoring | Uptime checks, SLO objects, alerting policies |
| Centralized logs | Cloud Logging | Log Router → sinks (BigQuery/Storage/Pub/Sub), log-based metrics |
| Distributed tracing | Cloud Trace | Latency breakdown across services |
| CPU/heap profiling in production | Cloud Profiler | Continuous low-overhead profiling |
| Infra as code (expected default) | Terraform (+ Google provider) | Industry-standard IaC; Google's own Deployment Manager is legacy by comparison |
| Kubernetes-native declarative GCP resources | Config Connector | Manage GCP resources as Kubernetes CRDs, for GitOps-first teams |
| CI build/test | Cloud Build | Serverless CI, container-native, triggers from source repos |
| CD to Cloud Run/GKE | Cloud Deploy | Managed continuous delivery with approval gates and rollback |
| Container/artifact registry | Artifact Registry | Successor to Container Registry; supports multiple package formats |
| Cost recommendations | Recommender API | Automated rightsizing/idle-resource/commitment suggestions |
| Backup orchestration | Backup and DR Service | Centralized backup/recovery across Compute Engine, Cloud SQL, GKE, etc. |
| Carbon/sustainability reporting | Carbon Footprint | Per-project emissions tied to Google Cloud usage, feeds Domain 4.2 |

## Fast lookup: "the exam mentions X, which domain/file?"

```
"design/plan/business requirement/migration" ─────► Domain 1
"provision/Terraform/CI-CD for infra/GKE setup" ───► Domain 2
"IAM/encryption/compliance/VPC-SC/HIPAA" ──────────► Domain 3
"cost/performance/SRE/sustainability/DevOps" ──────► Domain 4
"which tool: Console vs CLI vs API vs Config
 Connector / advising a dev team" ─────────────────► Domain 5
"monitoring/alerting/DR/rollout/RPO-RTO" ──────────► Domain 6
```
