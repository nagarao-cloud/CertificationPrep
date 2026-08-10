# Amazon CloudWatch

> Domain alignment: primarily **Domain 3 — Data Operations and Support
> (22%)** (3.3.2 "Deploy logging and monitoring," 3.3.3 "Notifications,"
> 3.3.4 "Troubleshoot performance," 3.3.7 "Use CloudWatch Logs"), with
> supporting appearances across every other domain — this is the
> service the exam expects you to reach for first whenever a pipeline
> is described as slow, failing, throttled, or unhealthy.

## CONTENTS

- [1. Explain like I'm 12](#s1)
- [2. Explain technically](#s2)
- [3. Explain like a senior AWS data engineer](#s3)
- [4. Explain production architecture](#s4)
- [5. Explain exam traps](#s5)
- [6. Explain interview questions](#s6)
- [7. Cheat sheet](#s7)
- [8. Memory tricks](#s8)
- [9. Per-service coverage checklist](#s9)
- [10. Practice questions (15)](#s10)

---

<a name="s1"></a>
## 1. Explain like I'm 12

Imagine your body has a nervous system: nerves constantly report "I'm
too hot," "my heart is beating fast," "my stomach hurts." Your brain
doesn't act on every single nerve signal — it watches for patterns
(**Metrics**), keeps a diary of exactly what happened
(**Logs**), sets off alarm bells when something crosses a dangerous
threshold (**Alarms**), and shows you a summary poster of your overall
health at a glance (**Dashboards**). CloudWatch is that nervous system
for everything running in AWS — every service is constantly "feeling"
things and reporting them, whether you're watching or not.

---

<a name="s2"></a>
## 2. Explain technically

CloudWatch is AWS's native, unified observability service, built from
five pieces that answer five different questions:

```
┌────────────────────────────────────────────────────────────────┐
│                    CLOUDWATCH — FIVE PILLARS                     │
├───────────────┬────────────────────────────────────────────────┤
│  METRICS       │ "What number is it right now / over time?"      │
│  LOGS          │ "What exactly happened, in detail?"              │
│  ALARMS        │ "Has a number crossed a threshold I care about?" │
│  DASHBOARDS    │ "Show me everything on one screen."              │
│  LOGS INSIGHTS │ "Let me search/aggregate across huge log volumes │
│                │  with a query language."                          │
└───────────────┴────────────────────────────────────────────────┘
```

### 2.1 Metrics

A **metric** is a time-ordered sequence of data points for a single
measurable value (e.g., `CPUUtilization`, `IteratorAge`,
`ThrottledRequests`) within a **namespace** (a container grouping
related metrics, e.g., `AWS/Lambda`, `AWS/DynamoDB`).

- AWS services publish **built-in metrics automatically** at no
  charge, typically at **5-minute** granularity (**Basic Monitoring**)
  or **1-minute** granularity (**Detailed Monitoring**, extra cost for
  some services like EC2; free/default for many managed services like
  Lambda).
- You can publish your own values with the **`PutMetricData`** API —
  **custom metrics** — for anything the built-in metrics don't cover
  (e.g., "number of malformed records skipped by my Glue job," "queue
  depth in my custom application").
- Metrics support **dimensions** (key-value pairs that let you slice a
  metric — e.g., `FunctionName=my-etl-lambda`) and **statistics**
  (Average, Sum, Minimum, Maximum, percentiles like p99) over a chosen
  **period** (the time-bucket size for aggregation, e.g., 1 minute, 5
  minutes).
- **Metric resolution**: **Standard** (1-minute minimum) or **High
  Resolution** (as fine as 1-second, for custom metrics needing
  sub-minute granularity — extra cost, extra API call volume).
- **Metric retention is automatic and tiered**: 1-minute data points
  are kept 15 days, 5-minute data points 63 days, 1-hour data points
  **15 months** — even after your own retention configuration on Logs
  has expired, CloudWatch keeps rolling up and retaining metric
  history at coarser resolution for over a year, for free.

### 2.2 Logs

**CloudWatch Logs** ingests and stores log data as **log streams**
(a sequence of log events from a single source, e.g., one Lambda
invocation container) grouped into **log groups** (typically one per
application/function/job). Sources include Lambda, Glue job driver/
executor output, MWAA (scheduler/worker/webserver task logs), ECS/EKS
container logs, VPC Flow Logs, and custom application logs shipped via
the CloudWatch agent.

- **Retention** is set **per log group**, from 1 day up to 10 years,
  or **Never expire** (the default if unset — this is a cost trap, see
  Section 5).
- Logs can be exported to **S3** for cheap long-term archival, or
  streamed in near-real-time to **Kinesis Data Streams / Amazon Data
  Firehose / Lambda** via a **subscription filter**, or aggregated
  cross-account/cross-region.

### 2.3 Metric filters

A **metric filter** scans incoming log events for a pattern (e.g., the
literal string `"ERROR"`, or a structured JSON field like
`{ $.statusCode = 500 }`) and **converts matching log lines into a
numeric CloudWatch metric** — turning unstructured text into something
an **alarm** can actually threshold against.

```
Log stream: "...[ERROR] Failed to process record batch..."
                       │
                       v
        Metric Filter (pattern: "ERROR")
                       │
                       v
        Custom Metric: ErrorCount = 1 (incremented per match)
                       │
                       v
        Alarm: ErrorCount > 5 in 5 minutes → SNS
```

This is the standard pattern for "alert me when my application logs a
specific error condition" — logs alone can't trigger an alarm; they
must first pass through a metric filter to become a numeric metric.

### 2.4 Alarms

An **alarm** watches a single metric (or a **math expression** across
multiple metrics) over a defined number of evaluation periods and
transitions between three states: **OK**, **ALARM**, and **INSUFFICIENT
DATA**. On a state change, it can trigger an **SNS** notification, an
**Auto Scaling** action, or an **EC2/Lambda** action.

- **Composite alarms** combine multiple existing alarms with AND/OR
  logic (e.g., "only alarm if BOTH high error rate AND high latency
  are true") — this reduces **alarm noise** by requiring correlated
  signals before paging someone, instead of firing on every individual
  metric blip.
- **Anomaly detection alarms** use a machine-learning model that
  learns a metric's normal seasonal/daily band and alarms when the
  metric falls **outside the expected band**, rather than against a
  fixed static threshold — useful for metrics with natural daily/
  weekly cycles (e.g., request volume that's naturally low overnight).

```
COMPOSITE ALARM EXAMPLE

  Alarm A: Lambda Errors > 10       ┐
                                      ├─▶ AND ─▶ Composite Alarm
  Alarm B: Lambda Duration > 5000ms ┘           "PipelineDegraded"
                                                  fires ONLY when
                                                  BOTH are true —
                                                  not on either alone
```

### 2.5 Dashboards

A **CloudWatch Dashboard** is a customizable, shareable collection of
widgets (graphs, numbers, text, alarm status, logs query results)
pulled from multiple metrics/namespaces/regions/accounts onto a single
screen. Dashboards are for **humans watching**; they do not by
themselves detect or notify anyone of a problem — that's what alarms
are for (see Exam Trap in Section 5).

### 2.6 CloudWatch Logs Insights

**Logs Insights** is a purpose-built query language for interactively
searching and aggregating across potentially terabytes of log data,
without needing a separate export to S3/Athena first.

**Basic query syntax:**

```sql
fields @timestamp, @message
| filter @message like /ERROR/
| stats count(*) as errorCount by bin(5m)
| sort @timestamp desc
| limit 100
```

- `fields` — selects which fields to display (`@timestamp`,
  `@message`, `@logStream` are always available; JSON logs auto-parse
  their keys as additional fields).
- `filter` — narrows to matching log events (supports regex via
  `like /pattern/`, comparisons, boolean logic).
- `stats` — aggregates (`count()`, `sum()`, `avg()`, `min()`, `max()`,
  percentiles) often combined with `by bin(5m)` for time-bucketed
  aggregation — the pattern behind "error rate over time" charts.
- `sort`, `limit`, `parse` (extract fields from unstructured text via
  regex), `dedup` — round out the language.

Logs Insights is **billed per GB of log data scanned per query** (like
Athena's per-TB-scanned model) — an ad-hoc, pay-per-query answer to
"search my logs right now," distinct from the always-on cost of a
metric filter/alarm.

---

<a name="s3"></a>
## 3. Explain like a senior AWS data engineer

A senior engineer's first move when a pipeline is reported "broken" or
"slow" is **always CloudWatch metrics before logs, and logs before
guessing** — this is Domain 3's Guard Rail #4 (see
`DOMAIN-3-DATA-OPERATIONS.md` Part 1): metrics tell you *which stage
and which dimension* is unhealthy (DPU utilization spiking? IteratorAge
climbing? throttles increasing?) in seconds, before you ever open a
single log line. Logs then tell you *why*, once metrics have narrowed
the search. Jumping straight to "resize the cluster" or "add more
workers" without consulting the metric that explains the symptom is
the exam's most consistently punished wrong-answer shape.

The second senior-level judgment is **retention discipline**. Leaving
every log group at "Never expire" is one of the most common real-world
AWS cost surprises — CloudWatch Logs storage is billed per GB-month
indefinitely at CloudWatch rates, which are materially more expensive
per GB long-term than S3, let alone S3 + Glacier. A senior engineer
sets an explicit, deliberate retention per log group (e.g., 30 days
for verbose debug logs, 1 year for application logs, and exports
anything needing multi-year retention to S3 for cheap long-term
storage and Athena-based querying) rather than leaving the default.

The third judgment: **alarms should predict failure, not just report
it.** A junior engineer alarms on "job failed." A senior engineer
alarms on the **leading indicator** — `IteratorAge` climbing before a
Kinesis consumer visibly falls behind, `WLMQueueLength` rising before
Redshift queries start timing out, DPU/executor memory climbing before
a Glue job OOMs — because by the time the *lagging* indicator (the
failure itself) fires, damage (data loss, SLA breach, cascading
backlog) may already be underway.

Fourth: **composite alarms exist specifically to fight alarm fatigue.**
A pipeline with 40 individual alarms, each capable of paging someone
independently, trains humans to ignore pages. A senior engineer groups
correlated signals into composite alarms so a page means something is
*actually* wrong, not that one noisy metric blipped once.

Finally, know the **cost-shape difference** between Logs Insights (pay
per query, per GB scanned — cheap for occasional investigation,
expensive if run constantly on huge volumes) versus metric filters +
alarms (a small ongoing cost that runs continuously and proactively,
regardless of whether anyone is looking) versus exporting to S3 +
Athena (cheapest for infrequent, large-scale historical analysis). The
"right" tool depends on frequency and volume, not just capability —
all three *can* answer "how many errors happened," but at very
different price points depending on how often you ask.

---

<a name="s4"></a>
## 4. Explain production architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    DATA PIPELINE (Kinesis → Glue → Redshift)           │
│  ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐                 │
│  │Kinesis │───▶│  Glue  │───▶│   S3   │───▶│Redshift│                 │
│  │Streams │    │  ETL   │    │(curated)│    │ COPY   │                 │
│  └───┬────┘    └───┬────┘    └────────┘    └───┬────┘                 │
│      │             │                             │                     │
│      v             v                             v                     │
│ IteratorAge    DPU util,          WLMQueueLength, WLMQueueWaitTime     │
│ (built-in      numFailedTasks     (built-in metric)                    │
│  metric)       (built-in metric)                                       │
│      │             │                             │                     │
│      └─────────────┴──────────────┬──────────────┘                    │
│                                    v                                    │
│                    ┌───────────────────────────┐                       │
│                    │   CloudWatch Metrics        │                       │
│                    └──────────────┬────────────┘                       │
│                                    │                                     │
│           ┌────────────────────────┼─────────────────────────┐         │
│           v                        v                          v         │
│  ┌─────────────────┐   ┌─────────────────────┐   ┌──────────────────┐ │
│  │ Composite Alarm   │   │ CloudWatch Dashboard  │   │ Anomaly Detection │ │
│  │ (IteratorAge HIGH  │   │ (all 3 stages, one    │   │ Alarm on ingest   │ │
│  │  AND DPU util HIGH) │   │  screen, for on-call) │   │  volume seasonal  │ │
│  └────────┬──────────┘   └─────────────────────┘   └──────────────────┘ │
│           v                                                              │
│      SNS → PagerDuty/Slack                                              │
│                                                                          │
│  Meanwhile, application/job logs flow separately:                       │
│  Glue driver/executor stdout ──▶ CloudWatch Logs (log group per job)    │
│                                       │                                  │
│                          ┌────────────┴─────────────┐                   │
│                          v                            v                  │
│              Metric Filter ("OutOfMemoryError")   Logs Insights query   │
│              → Alarm (proactive)                  (ad-hoc investigation)│
│                          │                                               │
│                          v                                               │
│              Subscription filter → S3 export (long-term, cheap archive, │
│                                      Athena-queryable)                    │
└──────────────────────────────────────────────────────────────────────┘
```

**Why each arrow exists:** every processing stage emits its
**signature built-in metric** into CloudWatch Metrics automatically
(no code required for AWS-managed services). Those metrics feed both a
human-facing **dashboard** (single screen, whole pipeline) and
machine-facing **alarms** — a **composite alarm** correlates two
leading indicators before paging, reducing noise, while a separate
**anomaly-detection alarm** watches for seasonal deviation on ingest
volume specifically. In parallel, raw **job logs** flow to CloudWatch
Logs; a **metric filter** promotes a specific error pattern into a
numeric, alarmable signal, while ad-hoc investigation uses **Logs
Insights** directly against the raw log group. For cost control, logs
are exported to **S3** once they age past their operationally useful
window in CloudWatch, retaining long-term queryability via Athena at a
fraction of the cost.

---

<a name="s5"></a>
## 5. Explain exam traps

⚠️ **Trap 1 — A dashboard alone satisfies "detect issues proactively."**
It does not. Dashboards require a human to be looking at the right
moment. "Proactively detect and notify" always requires an **alarm**
(routed to SNS/similar), not just a dashboard widget.

⚠️ **Trap 2 — Skipping straight to "resize/rewrite" without mentioning
metrics/logs.** Any answer option that jumps to "add more Glue
workers" or "increase Lambda memory" without first checking the
relevant CloudWatch metric (DPU utilization, memory usage) is the
classic distractor — AWS's house style is diagnose-before-treat.

⚠️ **Trap 3 — Leaving log group retention at "Never expire" as the
default, unaddressed answer.** A cost-conscious question stem pairs
with an answer that sets **explicit retention** and/or exports to S3,
not one that silently accepts indefinite CloudWatch storage.

⚠️ **Trap 4 — Confusing a metric filter with an alarm.** A metric
filter only *creates* the metric from log text; it does not notify
anyone by itself. You still need an **alarm** on that filter's metric
to actually alert.

⚠️ **Trap 5 — Believing CloudWatch Logs Insights is free or flat-rate.**
It's billed per GB scanned per query — running it constantly/broadly
across huge log volumes for routine monitoring is the wrong pattern;
that's what metric filters + alarms are for. Logs Insights is for
**ad-hoc investigation**, not continuous monitoring.

⚠️ **Trap 6 — Custom metrics assumed free / assumed to require no
code.** `PutMetricData` calls must be made explicitly from your
application/job code (or via the CloudWatch agent for host-level
metrics); this is not automatic like built-in service metrics, and
each metric published/API call has a cost dimension at scale.

⚠️ **Trap 7 — Alarm evaluation "flapping" ignored.** A raw threshold
alarm with a single evaluation period can flap (OK → ALARM → OK) on
transient noise. The exam favors **multiple evaluation periods** (e.g.,
"3 out of 3 datapoints breaching") or **composite alarms** for
noise-sensitive production alerting — not a single-datapoint threshold
alarm when the stem emphasizes avoiding false pages.

⚠️ **Trap 8 — CloudWatch mistaken for CloudTrail.** "Who changed this
resource" is CloudTrail, not CloudWatch, no matter how the question is
phrased around "monitoring." CloudWatch is health/performance;
CloudTrail is who-did-what (see `CloudTrail.md`).

⚠️ **Trap 9 — Assuming 1-minute (Detailed Monitoring) granularity is
free/default for every service.** Some services (notably EC2) require
explicitly enabling Detailed Monitoring for 1-minute granularity, at
extra cost, vs. the 5-minute Basic default — while many modern
serverless services (Lambda, DynamoDB) publish at 1-minute resolution
by default at no extra charge. Don't over-generalize one service's
billing model onto another.

---

<a name="s6"></a>
## 6. Explain interview questions

**Q: "A Glue job that normally finishes in 20 minutes has been taking
90 minutes for the last three runs, with no code change. Walk me
through your diagnosis."**
A: Start with CloudWatch metrics for that job: DPU/executor memory
utilization, `numFailedTasks`/`numCompletedTasks`, and shuffle/spill
indicators. Check whether **input data volume or file count** changed
(both are common silent causes of slowdown). Then check the Spark
UI / job run logs (via CloudWatch Logs) for **skew** (one task taking
far longer than peers) or **spill-to-disk** (memory pressure). Only
after the metric/log evidence points to a specific cause do I decide
between repartitioning, salting a skewed key, or bumping worker type —
never resize blindly first.

**Q: "How do you avoid paging the on-call engineer for every transient
blip in error rate?"**
A: Use **composite alarms** that require multiple correlated signals
(e.g., elevated error rate AND elevated latency) before firing, and/or
require **multiple consecutive evaluation periods** breaching the
threshold rather than a single data point. This filters out one-off
noise while still catching genuinely sustained problems.

**Q: "How would you set up an early-warning system for a Kinesis
consumer falling behind, before data loss actually occurs?"**
A: Alarm on `GetRecords.IteratorAgeMilliseconds` approaching the
stream's retention period (e.g., alarm at 50% of a 24-hour retention
window) — this is a **leading indicator**: the consumer is falling
behind but data hasn't been lost yet, giving time to scale consumers
or shards before any records actually expire out of the stream.

**Q: "Your team's CloudWatch bill has grown significantly month over
month with no corresponding growth in traffic. What would you check?"**
A: Log group retention settings left at "Never expire" across many
services accumulating storage indefinitely; high-cardinality custom
metrics (a unique dimension value per user/request can explode metric
count and cost); and whether Logs Insights queries are being run
routinely/broadly (e.g., via a scheduled job) instead of the cheaper
metric-filter-plus-alarm pattern for continuous monitoring.

**Q: "How do you correlate a single failed pipeline execution across
Kinesis, Glue, and Redshift on one screen?"**
A: A CloudWatch **Dashboard** with widgets pulling each stage's
signature metric (IteratorAge, DPU utilization, WLMQueueWaitTime) into
one view — giving on-call a single-pane-of-glass triage surface
instead of navigating between three separate service consoles during
an incident.

---

<a name="s7"></a>
## 7. Cheat sheet

| Pillar | Answers | Notes |
|---|---|---|
| **Metrics** | "What's the number right now/over time?" | Built-in (automatic) or custom (`PutMetricData`) |
| **Logs** | "What exactly happened?" | Log groups → log streams; retention set per group |
| **Metric filters** | "Turn a log pattern into a number" | Required before an alarm can react to log text |
| **Alarms** | "Has a threshold been crossed?" | 3 states: OK / ALARM / INSUFFICIENT_DATA |
| **Composite alarms** | "Only alert on correlated signals" | AND/OR across existing alarms — reduces noise |
| **Anomaly detection** | "Is this outside the normal seasonal band?" | ML-based dynamic threshold, not fixed |
| **Dashboards** | "Show me everything at a glance" | Human-facing; does NOT alert by itself |
| **Logs Insights** | "Search/aggregate huge log volumes now" | Ad-hoc, billed per GB scanned per query |

### Retention & cost facts

| Item | Default | Recommended practice |
|---|---|---|
| Log group retention | **Never expire** (⚠️ cost trap) | Set explicitly; export to S3 for long-term |
| Metric retention (1-min data) | 15 days | Automatic, no action needed |
| Metric retention (5-min data) | 63 days | Automatic |
| Metric retention (1-hour data) | **15 months** | Automatic, free — useful for YoY trend |
| Metric resolution | Standard (1 min) | High-resolution (1 sec) for custom metrics, extra cost |
| Basic vs Detailed Monitoring (EC2) | Basic = 5 min, free | Detailed = 1 min, extra cost |

### Signature CloudWatch metric per service — memorize this table

| Service | Signature metric | What it means when bad |
|---|---|---|
| **Kinesis Data Streams** | `GetRecords.IteratorAgeMilliseconds` | Consumers falling behind the stream |
| Kinesis Data Streams | `WriteProvisionedThroughputExceeded` | Producers throttled — add shards or go on-demand |
| **Amazon Data Firehose** | `DeliveryToS3.Success`, `ThrottledRecords` | Delivery failing — check IAM/KMS permissions |
| **Amazon MSK** | Consumer lag, `UnderReplicatedPartitions` | Consumers behind; broker unhealthy |
| **DynamoDB** | `ThrottledRequests`, `ConsumedReadCapacityUnits` / `ConsumedWriteCapacityUnits` | Hot partition or under-provisioned capacity |
| **Glue** | Driver/executor **memory utilization**, `numFailedTasks` | Skew, OOM, mis-sized workers |
| **Redshift** | `WLMQueueLength`, `WLMQueueWaitTime` | Queries queuing — needs concurrency scaling or WLM tuning |
| Redshift | `PercentageDiskSpaceUsed` | Storage pressure, risk of failed writes |
| **Lambda** | `Duration`, `Throttles`, `Errors`, `ConcurrentExecutions` | Timeout risk, concurrency-limit throttling |
| **Athena** | `DataScannedInBytes`, `QueryQueueTime` | Cost problem; workgroup concurrency limit hit |
| **Step Functions** | `ExecutionsFailed`, `ExecutionsTimedOut` | Workflow-level failure tracking |
| **EMR** | `YARNMemoryAvailablePercentage`, `ContainerPending` | Cluster undersized for workload |
| **S3** | `4xxErrors`, `5xxErrors`, `FirstByteLatency` | Permissions issues or throttling |
| **OpenSearch** | `ClusterStatus.red/yellow`, `JVMMemoryPressure` | Cluster health degraded, GC pressure |

### CloudWatch vs. everything else it's confused with

| | **CloudWatch** | **CloudTrail** | **X-Ray** | **AWS Config** |
|---|---|---|---|---|
| Answers | "Is it healthy? How fast?" | "Who did what, when?" | "Where is the latency across services?" | "Is it configured correctly, over time?" |
| Data | Metrics, logs, alarms | API audit events | Distributed traces | Config history/snapshots |
| Trigger phrase | "alert when", "monitor performance" | "audit", "who accessed" | "identify bottleneck across microservices" | "detect non-compliant resources" |

---

<a name="s8"></a>
## 8. Memory tricks

- **"MLAD"** — **M**etrics, **L**ogs, **A**larms, **D**ashboards: the
  four core pillars, in the order you'd naturally build them (measure
  → record → react → visualize). Add **Logs Insights** as the
  ad-hoc search layer on top of Logs.
- **"A dashboard is a mirror, not an alarm clock."** It shows you
  what's happening if you're looking — it never wakes anyone up.
- **"Filter first, then alarm."** You can't alarm on raw log text —
  a metric filter must convert the pattern into a number first.
- **"Composite = correlation, not just OR."** Composite alarms exist
  to *reduce* noise by requiring multiple signals, not to multiply
  alerts.
- **Signature metric shortcut:** "**I**terator**A**ge for streams
  falling behind, **T**hrottles for DynamoDB/Lambda hitting limits,
  **Q**ueue for Redshift/Athena backing up" — I-T-Q, three failure
  shapes, three metric families.
- **"Never expire" = never save money.** Treat the default retention
  setting as something you must actively override, every time.

---

<a name="s9"></a>
## 9. Per-service coverage checklist

**Purpose.** Native, unified observability for AWS resources and
custom applications — metrics, logs, alarms, dashboards, and
log-search, all in one managed service.

**When to use.** Any requirement to monitor pipeline/service health,
performance, or throughput; troubleshoot a failure or slowdown;
proactively alert on a threshold or anomaly; centralize application
logs; visualize operational state across services on one screen; query
large volumes of log data interactively.

**When NOT to use.** Auditing who performed an API action (CloudTrail);
tracking resource configuration compliance over time (AWS Config);
distributed request tracing across microservices for latency
attribution specifically (X-Ray, though CloudWatch and X-Ray are
commonly used together); scanning data content for sensitive
information (Macie).

**Advantages.** Deep native integration — most AWS services publish
metrics automatically with zero configuration; flexible custom metrics
and logs for anything else; powerful ad-hoc query language (Logs
Insights); composite alarms and anomaly detection reduce false-alarm
fatigue; long automatic metric retention (up to 15 months) at no
extra cost; tight integration with SNS, Lambda, Auto Scaling, and
EventBridge for automated response.

**Limitations.** Log storage is comparatively expensive per GB
long-term versus S3; Logs Insights cost scales with data scanned per
query, which can be significant at large volumes/high frequency;
custom metrics require explicit `PutMetricData` calls in your own
code; high-cardinality custom metric dimensions can drive
unexpectedly high cost; dashboards are not themselves an alerting
mechanism.

**Pricing considerations.** Metrics: built-in are free; custom metrics
billed per metric per month, with high-resolution (sub-minute) metrics
costing more. Logs: billed per GB ingested and per GB stored per
month, both without an explicit retention override. Logs Insights:
billed per GB scanned per query. Alarms: billed per alarm per month
(composite alarms cost more than standard). Dashboards: first 3 free,
then billed per dashboard per month.

**Performance.** Metric publication and log ingestion are near-real-
time for most services (seconds to a couple of minutes of delay);
alarms evaluate on the metric's period (as fine as 10 seconds for
high-resolution custom metrics, more commonly 1–5 minutes).

**Scaling.** Fully managed, scales automatically with resource count
and log/metric volume; no capacity planning needed, though very high
custom-metric cardinality or extremely large Logs Insights queries can
require query/dimension design discipline to control cost.

**Security.** Log data and metrics can be encrypted with KMS; IAM
policies control who can read/write logs, create alarms, or modify
dashboards; VPC endpoints (interface) allow private access to the
CloudWatch API without traversing the public internet.

**High availability.** Fully managed, regionally resilient service;
metrics and alarms operate independently per region (cross-region
dashboards can aggregate multiple regions' data for a unified view,
but the underlying alarm evaluation is regional).

**Failure scenarios.** A log group left at indefinite retention
silently accumulates cost for years; an alarm with too-sensitive
thresholds and a single evaluation period pages on noise until the
team starts ignoring it; a metric filter pattern that doesn't actually
match the real log format silently never fires, giving false
confidence that monitoring exists; custom metrics never actually
published because `PutMetricData` calls were never added to the
application code.

**Common mistakes.** Treating a dashboard as sufficient proactive
detection; alarming on the failure itself instead of a leading
indicator; leaving log retention unset; running Logs Insights queries
as if they were free/instant continuous monitoring rather than
ad-hoc, billed searches; confusing CloudWatch's role with CloudTrail's.

**Exam traps.** See Section 5 in full above.

**Real enterprise examples.** A streaming media company sets a
composite alarm requiring both elevated `IteratorAge` on its Kinesis
ingestion stream AND elevated Glue DPU memory utilization before
paging on-call, cutting false pages by more than half. A healthcare
data platform exports all CloudWatch Logs older than 30 days to S3 with
lifecycle rules to Glacier, satisfying multi-year retention
requirements at a fraction of native CloudWatch Logs storage cost. A
retail analytics team uses CloudWatch anomaly detection on daily order
ingestion volume so a Black-Friday-scale traffic spike doesn't
falsely alarm against a static threshold tuned for a normal Tuesday.

---

<a name="s10"></a>
## 10. Practice questions (15)

**Q1.** A data engineering team wants to be notified the moment a Glue
job's executor memory utilization exceeds 90% for three consecutive
5-minute periods, to catch an approaching out-of-memory failure before
it happens. What CloudWatch feature should they configure?

A) A CloudWatch Dashboard widget showing executor memory
B) A CloudWatch Alarm on the executor memory metric, with 3
   consecutive breaching datapoints as the evaluation criteria, routed
   to SNS
C) CloudWatch Logs Insights query scheduled every 5 minutes
D) A metric filter on the Glue job logs for the string "memory"

**Answer: B.** This is exactly what alarms with multi-period
evaluation are for — proactive notification on a sustained threshold
breach. A) A dashboard requires a human to be watching; it doesn't
notify anyone. C) Logs Insights is for ad-hoc querying, not
continuous automated alerting, and scheduling it this way is an
anti-pattern (expensive, indirect). D) A metric filter alone doesn't
notify anyone — it only creates a metric; you'd still need an alarm on
top of it, and memory utilization is already a native metric, not
something requiring a log-text filter.

**Q2.** Which statement about CloudWatch Dashboards is correct?

A) Dashboards can automatically page an on-call engineer when a
   displayed metric crosses a threshold
B) Dashboards are purely visual and require a human to be actively
   viewing them to notice a problem; they do not send notifications
C) Dashboards replace the need for alarms entirely in a well-designed
   monitoring setup
D) Dashboards can only display metrics from a single AWS service at a
   time

**Answer: B.** Dashboards are a visualization surface only. A) is the
classic exam trap — dashboards never trigger notifications by
themselves. C) is false — alarms remain necessary for proactive,
unattended detection. D) is false — dashboards can pull widgets from
multiple namespaces, services, regions, and even accounts onto one
screen.

**Q3.** A team notices their monthly CloudWatch bill has grown
substantially, driven mostly by Logs storage cost, even though log
volume per day has stayed flat. What is the most likely cause?

A) Metric retention defaulting to 15 months
B) Log group retention left at "Never expire," so logs accumulate
   indefinitely instead of being deleted or archived after a defined
   period
C) Too many composite alarms
D) High-resolution custom metrics

**Answer: B.** Never-expire retention means storage grows every month
forever with no offsetting deletion, even at flat daily ingestion —
this is the single most common CloudWatch cost trap. A) Metric
retention is automatic, tiered, and free — not a storage cost driver
in the same way. C) and D) affect cost, but not specifically "Logs
storage cost growing every month with flat daily volume," which
points directly at unset retention.

**Q4.** What is the correct relationship between a metric filter and
an alarm when trying to alert on a specific error string appearing in
application logs?

A) An alarm can be created directly on raw log text without any
   intermediate step
B) A metric filter must first convert the matching log pattern into a
   numeric CloudWatch metric; an alarm is then created on that metric
C) Logs Insights automatically creates alarms when a saved query
   matches new log data
D) Metric filters and alarms are the same feature under different
   names

**Answer: B.** This two-step pattern (filter → metric → alarm) is
required because alarms operate on numeric metrics, not raw text.
A) is false — CloudWatch alarms cannot threshold directly against log
text. C) Logs Insights doesn't auto-create alarms from saved queries.
D) They are distinct features serving different roles in the pipeline.

**Q5.** Which CloudWatch metric is the primary signal that Kinesis
Data Streams consumers are falling behind and at risk of missing data
once the retention window expires?

A) `WriteProvisionedThroughputExceeded`
B) `GetRecords.IteratorAgeMilliseconds`
C) `ThrottledRecords`
D) `ConsumedReadCapacityUnits`

**Answer: B.** IteratorAge measures how far behind the current stream
position a consumer's reads are — the canonical leading indicator for
"falling behind." A) is a producer-side throttling metric (writes
being rejected), not consumer lag. C) is a Firehose delivery metric.
D) is a DynamoDB metric, unrelated to Kinesis consumer lag.

**Q6.** A team wants to reduce false-positive pages by only alerting
when a Glue job shows BOTH elevated failed-task count AND elevated
executor memory utilization simultaneously, rather than paging on
either condition alone. What should they configure?

A) Two separate standard alarms, each independently notifying SNS
B) A single alarm on a math expression averaging the two metrics
   together
C) A composite alarm combining the two existing alarms with an AND
   condition
D) CloudWatch Logs Insights configured to run every minute

**Answer: C.** Composite alarms exist precisely to combine multiple
underlying alarms with AND/OR logic, firing only when the correlated
condition is met — directly reducing alarm noise. A) still pages on
either condition independently, which is what they're trying to avoid.
B) averaging two unrelated metrics together produces a meaningless
combined value, not a correlated AND condition. D) doesn't address
alerting logic at all.

**Q7.** What is the correct billing model for CloudWatch Logs
Insights?

A) A flat monthly fee regardless of usage
B) Billed per GB of log data scanned per query
C) Free for the first 1,000 queries per month, then billed per query
   count
D) Billed the same as CloudWatch Logs storage — per GB stored

**Answer: B.** Logs Insights bills based on the volume of log data
scanned to satisfy each query — an ad-hoc, pay-per-use model similar
in shape to Athena's per-TB-scanned pricing. A) and C) misstate the
model. D) confuses ingestion/storage billing (a separate cost) with
query-time scanning billing.

**Q8.** A Redshift cluster is experiencing queries queuing up during
peak business hours. Which CloudWatch metric would a senior data
engineer check first to confirm and quantify this?

A) `PercentageDiskSpaceUsed`
B) `WLMQueueLength` and `WLMQueueWaitTime`
C) `CPUUtilization`
D) `DatabaseConnections`

**Answer: B.** These are the signature metrics for query queuing under
Redshift's workload management — directly measuring how many queries
are waiting and how long they wait. A) relates to storage pressure,
not queuing. C) and D) are relevant general health metrics but don't
specifically quantify query queuing the way WLM queue metrics do.

**Q9.** Which of the following correctly differentiates CloudWatch
anomaly detection alarms from standard static-threshold alarms?

A) Anomaly detection alarms only work with custom metrics, never
   built-in service metrics
B) Anomaly detection alarms use a machine-learning model that learns a
   metric's expected seasonal/daily band and alarms on deviation from
   that band, rather than a single fixed numeric threshold
C) Anomaly detection alarms cannot be combined into composite alarms
D) Anomaly detection alarms are only available for Lambda metrics

**Answer: B.** This is the core distinction — dynamic, learned,
time-aware bands versus a fixed static threshold, useful for metrics
with natural cyclical patterns like daily traffic volume. A), C), and
D) are all fabricated restrictions; anomaly detection works across
built-in and custom metrics broadly and can participate in composite
alarms.

**Q10.** A company needs to retain application logs for 7 years for
regulatory compliance but wants to minimize ongoing storage cost. What
is the recommended CloudWatch-related approach?

A) Set CloudWatch Logs retention to "Never expire" and leave it there
B) Set a shorter, cost-conscious CloudWatch Logs retention (e.g., 30–90
   days for operational use) and export/subscribe logs to S3 for
   long-term archival with lifecycle rules to Glacier
C) Set CloudWatch Logs retention to exactly 7 years and take no
   further action
D) Delete logs after 90 days regardless of the compliance requirement

**Answer: B.** This is the standard cost-optimized pattern: keep only
the operationally useful window in CloudWatch (a more expensive
per-GB store optimized for recent, queryable data) and move long-term
archival to S3 + Glacier, which is dramatically cheaper for multi-year
retention. A) is the expensive, unmanaged trap. C) technically
satisfies retention length but at CloudWatch's higher storage rate for
the entire period, unnecessarily. D) violates the compliance
requirement outright.

**Q11.** Which service and metric pairing correctly identifies a
DynamoDB table suffering from a hot partition?

A) CloudWatch — `ThrottledRequests` rising while overall
   `ConsumedReadCapacityUnits`/`ConsumedWriteCapacityUnits` remain
   below the table's provisioned capacity
B) CloudTrail — `PutItem` event volume
C) CloudWatch — `IteratorAgeMilliseconds`
D) X-Ray — trace segment count

**Answer: A.** A classic hot-partition signature is throttling on a
subset of requests even though *aggregate* table-level consumed
capacity looks fine — because one partition is absorbing
disproportionate traffic while others are idle. B) CloudTrail tracks
API calls for audit, not performance metrics. C) IteratorAge is a
Kinesis/Lambda-stream-consumer metric, not applicable to DynamoDB. D)
X-Ray traces request paths/latency across services, not
partition-level capacity behavior.

**Q12.** What must be true for a custom application metric (e.g.,
"number of malformed records skipped") to appear in CloudWatch?

A) CloudWatch automatically discovers and ingests any value logged to
   stdout
B) The application code must explicitly call the `PutMetricData` API
   (or use the CloudWatch agent, for host-level metrics) to publish
   the value
C) Custom metrics require a separate CloudWatch Logs Insights query to
   be materialized as a metric
D) Custom metrics are automatically created from any DynamoDB table
   scan

**Answer: B.** Unlike built-in AWS service metrics, custom metrics
require explicit publication via `PutMetricData` (or the CloudWatch
agent for infrastructure-level custom metrics) — this is not
automatic. A), C), and D) describe mechanisms that do not exist for
custom metric creation.

**Q13.** A security-conscious question asks: "Who deleted this
CloudWatch alarm, and when?" Which service actually answers this?

A) CloudWatch itself, via the Alarms console history
B) CloudTrail, since alarm deletion is an API call captured as a
   management event
C) AWS Config
D) CloudWatch Logs Insights

**Answer: B.** Deleting an alarm is an API action (`DeleteAlarms`),
which is exactly the kind of "who did what, when" question CloudTrail
answers via management events — even though the resource in question
happens to be a CloudWatch alarm, the audit trail for *who acted on
it* is CloudTrail's job, not CloudWatch's. A) CloudWatch's own console
doesn't provide an actor-level audit history for its resources. C)
AWS Config tracks configuration state/compliance history, not
"who did this" attribution. D) Logs Insights queries log data, not
account API activity.

**Q14.** Which statement about CloudWatch metric retention is
accurate?

A) All metric data is deleted after 15 days regardless of resolution
B) 1-minute datapoints are retained 15 days, 5-minute datapoints 63
   days, and 1-hour datapoints are retained for 15 months — all
   automatically, at no extra charge
C) Metric retention must be manually configured per metric, similar to
   log group retention
D) Metric data is retained indefinitely by default, identical to the
   "Never expire" log setting

**Answer: B.** This tiered, automatic retention (with progressively
coarser resolution surviving progressively longer) is a built-in
CloudWatch behavior requiring no configuration and no extra cost. A),
C), and D) all misstate this automatic, tiered behavior.

**Q15.** A pipeline spans Kinesis, Glue, and Redshift, and the on-call
engineer wants a single screen showing the health of all three stages
during an incident, without switching between service consoles. What
should be built?

A) A single CloudWatch Alarm covering all three services
B) A CloudWatch Dashboard with widgets pulling each stage's signature
   metric (e.g., IteratorAge, DPU utilization, WLMQueueWaitTime) into
   one unified view
C) Three separate Logs Insights saved queries, checked in sequence
D) An AWS Config aggregator across all three services

**Answer: B.** This is exactly the dashboard use case — consolidating
metrics from multiple services/namespaces into a single visual triage
surface for humans during an incident. A) A single alarm can't
meaningfully represent three independent services' health as one
binary state in a useful way. C) requires manually running multiple
queries in sequence rather than a single consolidated view. D) AWS
Config aggregators track configuration compliance, not real-time
operational metrics.
