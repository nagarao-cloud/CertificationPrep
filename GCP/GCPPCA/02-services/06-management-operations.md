# Management & Operations Services Reference

> Design/process guidance: Domain 6 (`01-domains/DOMAIN-6-ensuring-reliability.md`)
> and Domain 4 §4.1/4.2. This file is per-service configuration depth.

## Contents

- [Cloud Monitoring](#cloud-monitoring)
- [Cloud Logging](#cloud-logging)
- [Cloud Trace / Cloud Profiler](#cloud-trace--cloud-profiler)
- [Recommender API](#recommender-api)
- [Backup and DR Service](#backup-and-dr-service)
- [Carbon Footprint](#carbon-footprint)
- [Billing tools](#billing-tools)

---

## Cloud Monitoring

- **Uptime checks**: external synthetic checks against a public
  endpoint from multiple global locations — validates real reachability,
  not just internal health.
- **Metrics**: built-in infrastructure metrics (CPU, memory, request
  latency) plus custom metrics your application emits — custom metrics
  are required whenever an SLO is defined in business terms (Domain 4
  §4.1).
- **SLO objects**: define an SLI (e.g. availability, latency
  percentile) and a target over a rolling window; Cloud Monitoring
  tracks error-budget consumption automatically, the direct
  implementation of Domain 4's error-budget policy.
- **Alerting policies**: condition types include threshold, rate of
  change, and (importantly) **absence of signal** — a service that
  stops reporting metrics entirely (crashed, network-partitioned) needs
  an absence alert, since a threshold alert never fires if there's no
  data to threshold against.
- **Notification channels**: email, SMS, Pub/Sub (for programmatic
  routing/automation), and third-party integrations — match the
  channel to the incident severity defined in Domain 4's process.

## Cloud Logging

- **Log Router and sinks**: every log entry passes through the Router,
  which can send matching entries to one or more sinks: BigQuery (ad
  hoc SQL analysis), Cloud Storage (cheap long-term/compliance
  retention, especially with a retention policy or Bucket Lock), or
  Pub/Sub (real-time downstream processing/alerting integration).
- **Log-based metrics**: convert a log pattern match into a metric,
  usable in an alerting policy — no application code change needed to
  start alerting on a specific error signature.
- **Log exclusions**: filter out high-volume, low-value log entries
  before ingestion to control cost — relevant to any Domain 4
  cost-optimization scenario involving logging spend.
- **Retention**: default retention windows vary by log type (Admin
  Activity is retained longer by default than Data Access); anything
  needing longer/immutable retention should sink to Cloud Storage with
  an explicit retention policy, not rely on Cloud Logging's native
  retention.

## Cloud Trace / Cloud Profiler

- **Cloud Trace**: distributed tracing — visualizes the latency
  breakdown of a request as it crosses multiple services, the answer
  for "where is the time going" in a multi-hop request path (a common
  Mountkirk Games/HRL-shaped low-latency debugging scenario).
- **Cloud Profiler**: continuous production CPU/heap/wall-time
  profiling with minimal overhead — the answer for "why is this
  specific service consuming so much CPU/memory," complementary to
  Trace (which is cross-service) rather than a substitute for it.

## Recommender API

Automated, ongoing recommendations across several categories:

| Recommender | What it surfaces |
|---|---|
| VM/MIG rightsizing | Over- or under-provisioned instances based on actual utilization |
| Idle resource | Unattached disks, idle IPs, unused images |
| Commitment purchase | CUD opportunities based on observed steady usage |
| IAM | Overly broad role grants that could be narrowed (least-privilege recommendations) |
| Firewall | Overly permissive or unused firewall rules |

- **Why it's the Domain 4 "continuous improvement" answer**: it turns
  cost/security optimization into an ongoing automated process rather
  than a periodic manual audit — directly implements the "process, not
  one-time fix" pattern the exam rewards.

## Backup and DR Service

Centralized backup/recovery orchestration across Compute Engine, Cloud
SQL, GKE, and other supported workloads from a single control plane.

- **Backup plans**: policy-driven, scheduled backups with defined
  retention — the managed alternative to hand-rolled per-service backup
  scripting.
- **When it's the answer**: a scenario needing centralized backup
  governance/reporting across a *heterogeneous* set of workload types,
  rather than relying on each service's own native backup feature in
  isolation (e.g. Cloud SQL automated backups alone don't give you a
  single pane of glass across Compute Engine and GKE too).

## Carbon Footprint

Reports gross and net carbon emissions attributable to Google Cloud
usage, broken down by project, service, and region.

- **Feeds Domain 4 §4.2** sustainability reporting requirements —
  the answer whenever a scenario asks to "report our cloud carbon
  footprint" without building custom emissions-estimation tooling.

## Billing tools

- **Billing export to BigQuery**: the foundation for any custom cost
  dashboard/analysis beyond the built-in Billing reports — required
  whenever a scenario wants cost joined against other operational data
  (e.g. cost per feature, cost per customer).
- **Budgets and budget alerts**: proactive threshold notifications
  before/at overspend — distinct from Recommender API (which finds
  savings) — budgets are about *awareness*, not automated remediation.
- **Labels**: the join key for showback/chargeback reporting — applied
  at resource creation time (ideally via IaC, see `02-services/07-devops-cicd.md`)
  so cost attribution doesn't require retroactive tagging.
