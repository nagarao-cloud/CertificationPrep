# Management & Operations Services Reference

> Design/process guidance: Domain 6 (`01-domains/DOMAIN-6-ensuring-reliability.md`)
> and Domain 4 §4.1/4.2. This file is per-service configuration depth.
> Every service below follows the same checklist: purpose, when to
> use, when **not** to use (paired with the alternative that wins
> instead), configuration surface, cost, performance, scaling,
> security, HA/failure behavior, common mistakes, and exam scenario
> cues.

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

**Purpose:** metrics, uptime checks, SLO tracking, and alerting across
GCP resources and custom application signals.

**When to use:** any workload needing observability into whether it's
healthy/available/performing within target — the default answer for
"how do we know this is working" across every other service in this
folder.

**When NOT to use as the sole tool — pair with something else
instead:**
- Understanding *where* latency is being spent across a multi-hop
  request path → **Cloud Trace**, not Monitoring alone — Monitoring's
  metrics tell you *that* latency is high, Trace tells you *where*.
- Root-causing *why* a specific service is consuming excess CPU/
  memory at the code level → **Cloud Profiler**, not Monitoring —
  Monitoring surfaces the symptom (resource metric spike), Profiler
  finds the specific function/code path responsible.
- Detailed, queryable historical event records (not aggregated
  metrics) → **Cloud Logging**, not Monitoring — the two are
  complementary; Monitoring answers "is X happening," Logging answers
  "what exactly happened, in detail, at time T."

**Key configuration surface:**
- **Uptime checks**: external synthetic checks against a public
  endpoint from multiple global locations — validates real
  reachability, not just internal health.
- **Metrics**: built-in infrastructure metrics (CPU, memory, request
  latency) plus custom metrics your application emits — custom
  metrics are required whenever an SLO is defined in business terms
  (Domain 4 §4.1).
- **SLO objects**: define an SLI (e.g. availability, latency
  percentile) and a target over a rolling window; Cloud Monitoring
  tracks error-budget consumption automatically, the direct
  implementation of Domain 4's error-budget policy.
- **Alerting policies**: condition types include threshold, rate of
  change, and (importantly) **absence of signal** — a service that
  stops reporting metrics entirely (crashed, network-partitioned)
  needs an absence alert, since a threshold alert never fires if
  there's no data to threshold against.
- **Notification channels**: email, SMS, Pub/Sub (for programmatic
  routing/automation), and third-party integrations — match the
  channel to the incident severity defined in Domain 4's process.
- **Dashboards**: custom, shareable visualizations combining metrics
  from multiple sources — the operational-visibility complement to
  individual alerting policies.

**Pricing / cost considerations:** billed on metric volume ingested
(especially custom metrics) and API calls — a very high-cardinality
custom metric (e.g. one time series per individual user ID) can
become an unexpectedly large cost driver; aggregating to a reasonable
cardinality before emitting custom metrics is the practical cost
control.

**Performance characteristics:** metric ingestion and alert
evaluation happen with low latency (seconds-to-minutes range,
depending on the metric/alert type) — not instantaneous, a relevant
caveat for a scenario expecting sub-second alerting on a fast-moving
incident.

**Scaling behavior:** scales automatically with the volume of
monitored resources/metrics; the scaling concern in practice is
cardinality/cost management (above), not a capacity ceiling to
provision against.

**Security posture:** IAM governs who can view metrics/dashboards,
create/modify alerting policies, and manage notification channels —
scoping this appropriately matters for scenarios where monitoring
data itself is sensitive (e.g. reveals business volume/patterns).

**HA / failure-mode behavior:** absence-of-signal alerting is the
specific mechanism for detecting the failure mode where a service
goes completely dark (crash, network partition) rather than
degrading gracefully — a threshold-only alerting strategy misses this
class of failure entirely, a recurring exam trap.

**Common mistakes / misconfigurations:** relying only on threshold
alerts and missing the "service stopped reporting entirely" failure
mode (no absence-of-signal alert configured); emitting high-
cardinality custom metrics without considering cost; routing
every alert severity to the same notification channel regardless of
urgency, causing alert fatigue.

**Common exam scenario cues:** "how do we know the service is
actually reachable from outside" → uptime checks; "track error-budget
consumption against a target" → SLO objects; "detect a service that
has stopped reporting entirely, not just degraded" → absence-of-
signal alerting.

---

## Cloud Logging

**Purpose:** centralized log ingestion, routing, and retention across
GCP resources and application logs.

**When to use:** any workload needing detailed, queryable event
records — debugging, audit evidence (paired with Cloud Audit Logs in
`04-security-iam.md`), or feeding log-derived metrics into alerting.

**When NOT to use as the sole tool — pair with something else
instead:**
- Aggregated health/performance signal over time rather than
  individual event records → **Cloud Monitoring**, not Logging alone
  — Logging is the detailed record; Monitoring is the trend/alerting
  layer built (in part) on log-derived metrics.
- Large-scale ad hoc SQL analysis across a long log history →
  **a BigQuery sink**, not querying Cloud Logging's own console
  directly — Cloud Logging's native retention/query UI is built for
  operational troubleshooting, not data-warehouse-scale analytics.

**Key configuration surface:**
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

**Pricing / cost considerations:** billed on log volume ingested
(with some log types free, per `04-security-iam.md`'s Cloud Audit
Logs section) — log exclusions are the direct cost lever for
high-volume, low-value entries (e.g. verbose debug-level logs in
production); sinking to Cloud Storage for long-term retention is
materially cheaper than extending Cloud Logging's own native
retention window.

**Performance characteristics:** log ingestion and routing happen
with low latency; log-based metrics update close to real-time as
matching entries arrive, making them a viable input to
near-real-time alerting.

**Scaling behavior:** scales automatically with log volume; the
practical scaling concern is again cost/cardinality management via
exclusions and sink design, not a capacity ceiling.

**Security posture:** IAM scopes who can view/query logs and manage
sinks/exclusions; sinking sensitive log data to a restricted-access
Cloud Storage bucket (with CMEK/retention policy) is the pattern for
compliance-grade log handling, layered on top of the audit-log
specifics covered in `04-security-iam.md`.

**HA / failure-mode behavior:** the Log Router reliably delivers to
configured sinks; a sink misconfiguration (wrong destination, missing
permissions) is the practical failure mode to watch for — log data
matching a broken sink's filter is not retroactively recoverable once
past the default retention window, making sink configuration
correctness itself a reliability concern.

**Common mistakes / misconfigurations:** no log exclusions configured
for high-volume, low-value log sources, inflating cost unnecessarily;
relying on Cloud Logging's native retention for long-term compliance
evidence instead of an explicit Cloud Storage sink with a retention
policy; querying Cloud Logging directly for large-scale historical
analysis instead of using a BigQuery sink.

**Common exam scenario cues:** "route logs to BigQuery for ad hoc
analysis" → BigQuery sink; "cheap, compliance-grade long-term log
retention" → Cloud Storage sink with retention policy/Bucket Lock;
"alert on a specific error signature with no code change" →
log-based metrics.

---

## Cloud Trace / Cloud Profiler

**Purpose:** distributed tracing (Trace) and continuous production
profiling (Profiler) — the two performance-diagnosis tools that
complement Monitoring's aggregated metrics.

**When to use:**
- **Cloud Trace**: a multi-hop request path where latency needs to be
  attributed to a specific service/hop (a common Mountkirk
  Games/HRL-shaped low-latency debugging scenario).
- **Cloud Profiler**: a specific service is consuming unexpectedly
  high CPU/memory and the team needs to know which function/code path
  is responsible, in production, with minimal overhead.

**When NOT to use — use something else instead:**
- Aggregated, alertable health/performance signal over time →
  **Cloud Monitoring** — Trace/Profiler are diagnostic/investigative
  tools for a specific known problem, not the primary always-on
  alerting layer.
- A need to understand *what happened* (a discrete event record)
  rather than *where time/resources went* → **Cloud Logging**.

**Key configuration surface:**
- **Cloud Trace**: distributed tracing — visualizes the latency
  breakdown of a request as it crosses multiple services, the answer
  for "where is the time going" in a multi-hop request path (a common
  Mountkirk Games/HRL-shaped low-latency debugging scenario).
- **Cloud Profiler**: continuous production CPU/heap/wall-time
  profiling with minimal overhead — the answer for "why is this
  specific service consuming so much CPU/memory," complementary to
  Trace (which is cross-service) rather than a substitute for it.

**Pricing / cost considerations:** both are billed on data volume
collected (trace spans, profiling samples) at a level generally small
relative to other observability costs; sampling rate is the practical
lever for controlling Trace's data volume/cost at very high request
rates.

**Performance characteristics:** Cloud Profiler is explicitly
designed for "minimal overhead" continuous production use, distinct
from a traditional profiler that would meaningfully slow down the
profiled service — this is the specific detail that makes it safe to
run continuously in production rather than only during a dedicated
debugging session.

**Scaling behavior:** both scale automatically with the instrumented
services' request/execution volume; Trace sampling rate is the
explicit control for keeping collection volume manageable at very
high QPS.

**Security posture:** IAM governs who can view trace/profile data,
which can reveal internal service topology and code structure —
scoping access appropriately matters in a multi-tenant or
security-sensitive engineering organization.

**HA / failure-mode behavior:** not availability-relevant services in
themselves; they are diagnostic tools used *during* an incident
investigation, not part of the failure/recovery path itself.

**Common mistakes / misconfigurations:** using Trace as if it were an
always-on alerting mechanism instead of an investigative tool paired
with Monitoring's alerting; not enabling Profiler continuously (only
reaching for it after a resource-consumption incident has already
occurred, missing historical comparison data that would have made
root-causing faster).

**Common exam scenario cues:** "where is the latency going across a
multi-hop request" → Cloud Trace; "why is this specific service
consuming so much CPU/memory" → Cloud Profiler.

---

## Recommender API

**Purpose:** automated, ongoing recommendations across cost,
security, and performance dimensions — the mechanism that turns
optimization from a periodic manual audit into a continuous process.

**When to use:** any Domain 4 "continuous improvement" requirement —
rightsizing, idle-resource cleanup, commitment-purchase optimization,
least-privilege IAM tightening, or firewall-rule cleanup — where the
goal is an ongoing process rather than a one-time fix.

**When NOT to use — use something else instead:**
- A one-time, deep architectural redesign decision (e.g. "should we
  migrate to Spanner") → **manual architectural analysis**, not the
  Recommender API — Recommender surfaces tactical, incremental
  optimizations against the *current* architecture, not strategic
  redesign recommendations.
- Real-time threat detection or security posture correlation across
  many signal types → **Security Command Center**
  (`04-security-iam.md`) — Recommender's IAM/firewall recommendations
  are one input among many that Security Command Center can surface
  in a broader, correlated finding; Recommender itself is narrower
  and more tactical.

**Key configuration surface:**

| Recommender | What it surfaces |
|---|---|
| VM/MIG rightsizing | Over- or under-provisioned instances based on actual utilization |
| Idle resource | Unattached disks, idle IPs, unused images |
| Commitment purchase | CUD opportunities based on observed steady usage |
| IAM | Overly broad role grants that could be narrowed (least-privilege recommendations) |
| Firewall | Overly permissive or unused firewall rules |

**Pricing / cost considerations:** the Recommender API itself has no
direct usage cost — its entire value proposition *is* cost
reduction (and risk reduction, for the IAM/firewall recommenders); the
practical cost consideration is the discipline to actually act on
recommendations rather than letting them accumulate unactioned.

**Performance characteristics:** recommendations are generated based
on observed historical utilization/usage patterns (not real-time), so
there's an inherent lag between a workload's actual behavior changing
and a recommendation reflecting that change — relevant when a
scenario describes a recent, deliberate change and asks whether
Recommender would already reflect it (generally, not immediately).

**Scaling behavior:** scales automatically across an organization's
entire resource footprint with no configuration/capacity concern —
recommendations surface per-resource across as many projects as the
organization has, without additional setup per project.

**Security posture:** the IAM and Firewall recommenders directly
support least-privilege and network-hardening goals; access to
recommendations themselves should be scoped via IAM like any other
sensitive operational signal (they reveal exactly where a resource is
over-provisioned or over-permissioned).

**HA / failure-mode behavior:** not an availability-relevant service;
its "failure mode" is a stale or unactioned recommendation, which is
a process/governance gap rather than a technical outage.

**Common mistakes / misconfigurations:** treating Recommender
findings as a one-time report to review once rather than an ongoing
process; applying a rightsizing/CUD recommendation without confirming
the observed usage pattern is actually representative of future
usage (e.g. rightsizing down right before an expected seasonal
traffic increase).

**Common exam scenario cues:** "continuous, automated cost/security
optimization rather than periodic manual audits," "turn
rightsizing/least-privilege review into an ongoing process."

---

## Backup and DR Service

**Purpose:** centralized backup/recovery orchestration across Compute
Engine, Cloud SQL, GKE, and other supported workloads from a single
control plane.

**When to use:** a scenario needing centralized backup governance/
reporting across a *heterogeneous* set of workload types, rather than
relying on each service's own native backup feature in isolation.

**When NOT to use — use something else instead:**
- A single-service backup need with no cross-service governance
  requirement (e.g. only Cloud SQL, nothing else) → **that service's
  own native backup feature** (Cloud SQL automated backups) directly
  — standing up a centralized control plane for one service's backups
  is unnecessary overhead.
- A requirement that's actually about HA (surviving a failure with no
  data loss/minimal downtime), not backup/recovery (restoring from a
  point-in-time copy after data loss) → the relevant **HA
  configuration** of the service itself (regional Cloud SQL HA,
  multi-region Spanner) — backup and HA solve different failure
  modes and shouldn't be conflated on the exam.

**Key configuration surface:**
- **Backup plans**: policy-driven, scheduled backups with defined
  retention — the managed alternative to hand-rolled per-service
  backup scripting.
- **When it's the answer**: a scenario needing centralized backup
  governance/reporting across a *heterogeneous* set of workload types,
  rather than relying on each service's own native backup feature in
  isolation (e.g. Cloud SQL automated backups alone don't give you a
  single pane of glass across Compute Engine and GKE too).

**Pricing / cost considerations:** billed on backup storage consumed
and, depending on configuration, backup/restore operations —
retention policy length is the direct cost lever (longer retention =
more stored backup data); centralizing avoids the duplicated
tooling/operational cost of maintaining separate backup scripts per
service.

**Performance characteristics:** backup/restore duration scales with
data volume; RTO (recovery time objective) planning should account
for this explicitly rather than assuming restore is instantaneous —
directly feeds Domain 6's RTO/RPO mapping exercise.

**Scaling behavior:** centrally manages backup policy across an
arbitrary number of supported workloads/projects without per-workload
custom tooling — the specific operational-scaling argument for this
service over N separate native-backup configurations.

**Security posture:** IAM scopes who can create/modify backup plans
and, critically, who can *restore* from a backup (restore access is
itself a sensitive operation, since restoring a backup can overwrite
current data) — CMEK support for backup data at rest.

**HA / failure-mode behavior:** the centralized reporting/governance
view is itself a reliability tool — it makes gaps (a workload with no
current backup plan) visible across the whole estate rather than only
discoverable per-service; this is the direct link to Domain 6's
backup/DR execution content in `01-domains/DOMAIN-6...md` §6.2.

**Common mistakes / misconfigurations:** conflating backup/DR with
HA (assuming a backup plan alone satisfies an availability
requirement); setting a retention policy shorter than the actual
compliance/recovery requirement; not testing restores, discovering a
gap only during an actual incident.

**Common exam scenario cues:** "centralized backup governance across
Compute Engine, Cloud SQL, and GKE," "single pane of glass for backup
reporting across a heterogeneous workload estate" — distinct from a
single-service HA/failover question.

---

## Carbon Footprint

**Purpose:** reports gross and net carbon emissions attributable to
Google Cloud usage, broken down by project, service, and region.

**When to use:** a scenario explicitly asking to report/reduce cloud
carbon footprint, or a Domain 4 sustainability requirement (region
selection for lower emissions) without building custom
emissions-estimation tooling.

**When NOT to use — use something else instead:**
- A scenario needing detailed dollar-cost breakdowns rather than
  carbon emissions → **Billing export to BigQuery** (below), a
  different report answering a different (cost, not emissions)
  question — the two are complementary, not interchangeable.

**Key configuration surface:** automated reporting broken down by
project/service/region, sourced directly from Google's own
infrastructure-level emissions data (no custom instrumentation
required) — the answer whenever a scenario asks to "report our cloud
carbon footprint" without building custom emissions-estimation
tooling.

**Pricing / cost considerations:** no direct cost to use — it's a
reporting capability, not a billed service; the underlying
sustainability lever it feeds into (region selection for lower
emissions, per Domain 4 §4.2) can have real cost implications
depending on which region ends up chosen.

**Performance characteristics:** not a runtime performance factor —
a reporting/analytics capability over historical usage data.

**Scaling behavior:** automatically covers an organization's entire
GCP footprint with no per-project setup required.

**Security posture:** IAM scopes who can view carbon reports, which
can reveal business-sensitive information (relative usage/scale
across projects) — worth scoping like any other sensitive
operational report.

**HA / failure-mode behavior:** not an availability-relevant service.

**Common mistakes / misconfigurations:** building custom emissions-
estimation tooling when Carbon Footprint already provides this
directly from Google's own data; treating it as a cost-reporting tool
(it reports emissions, not spend — pair with Billing export for cost).

**Common exam scenario cues:** "report our cloud carbon footprint,"
"select a lower-carbon region for a new deployment" (Domain 4 §4.2
sustainability focus area).

---

## Billing tools

**Purpose:** cost visibility, proactive spend alerting, and
attribution — Billing export, Budgets, and Labels together.

**When to use:** any requirement around cost dashboards, proactive
overspend awareness, or attributing cost to a specific
feature/customer/team.

**When NOT to use — use something else instead:**
- The requirement is finding automated *savings* opportunities (not
  visibility/awareness) → **Recommender API** (above) — Billing tools
  answer "what did we spend and on what," not "what could we spend
  less on"; the two are complementary but answer different questions.

**Key configuration surface:**
- **Billing export to BigQuery**: the foundation for any custom cost
  dashboard/analysis beyond the built-in Billing reports — required
  whenever a scenario wants cost joined against other operational data
  (e.g. cost per feature, cost per customer).
- **Budgets and budget alerts**: proactive threshold notifications
  before/at overspend — distinct from Recommender API (which finds
  savings) — budgets are about *awareness*, not automated
  remediation.
- **Labels**: the join key for showback/chargeback reporting — applied
  at resource creation time (ideally via IaC, see
  `02-services/07-devops-cicd.md`) so cost attribution doesn't require
  retroactive tagging.

**Pricing / cost considerations:** Billing export to BigQuery incurs
BigQuery's own storage/query cost for the exported data (generally
small relative to overall cloud spend being analyzed); Budgets and
Labels themselves carry no direct cost — the entire category is cheap
relative to the spend visibility/control it provides.

**Performance characteristics:** billing data export has an inherent
delay (not real-time) between spend occurring and it appearing in the
export/dashboard — relevant to a scenario expecting instantaneous
cost visibility, which billing export alone won't provide.

**Scaling behavior:** scales automatically across an organization's
entire billing account; labels scale cost-attribution granularity as
finely as an organization is willing to tag resources.

**Security posture:** IAM scopes who can view billing data/exports
(often business-sensitive) and who can create/modify budgets;
consistent least-privilege scoping applies here as elsewhere.

**HA / failure-mode behavior:** not an availability-relevant service
in the traditional sense; the practical "failure mode" is
retroactive-tagging debt (resources created without labels, making
later cost attribution incomplete) — the direct argument for applying
labels at resource-creation time via IaC rather than after the fact.

**Common mistakes / misconfigurations:** applying labels
retroactively/inconsistently instead of enforcing them at
creation time via IaC/Org Policy; treating a budget alert as an
automatic spend cap (it's a notification, not an enforcement
mechanism, unless separately wired to an automated remediation
action); confusing Billing export/Budgets (visibility) with
Recommender API (savings discovery) as if they answered the same
question.

**Common exam scenario cues:** "cost per feature/customer/team
reporting" → Labels + Billing export to BigQuery; "proactive
notification before overspend" → Budgets; distinguish from Recommender
API whenever the scenario is asking about *finding* savings rather
than *tracking* spend.
