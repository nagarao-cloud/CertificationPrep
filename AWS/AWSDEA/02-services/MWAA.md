# Amazon MWAA (Managed Workflows for Apache Airflow)

> Domain alignment: **Domain 3 — Data Operations and Support (22%)**,
> task 3.1.1 "Orchestrate data pipelines" and 3.1.2 "Troubleshoot
> MWAA" — both explicitly named task statements. Secondary appearances
> in Domain 1 wherever orchestration of ingestion pipelines is tested.

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

Imagine you're the head chef of a restaurant kitchen, and every night
you follow the exact same complicated recipe checklist: chop
vegetables (but only after the delivery truck arrives), preheat the
oven (but only once the vegetables are chopped), and start three
dishes cooking in parallel once the oven's hot. Airflow is the sous-chef
who holds that checklist, knows exactly which steps depend on which,
retries a step that burned, and tells you exactly which line failed if
dinner is late. MWAA is AWS renting you that sous-chef, plus the
kitchen it works in, so you never have to build or maintain the
kitchen yourself.

---

<a name="s2"></a>
## 2. Explain technically

**Amazon Managed Workflows for Apache Airflow (MWAA)** is a fully
managed service that runs open-source **Apache Airflow** for you —
Airflow itself is a Python-based workflow orchestrator built around
**DAGs** (Directed Acyclic Graphs): a DAG is a Python file describing a
set of **tasks** and the dependencies between them, which Airflow
schedules, executes, retries, and tracks.

### 2.1 Core architecture components

```
┌────────────────────────────────────────────────────────────────────┐
│                      MWAA ENVIRONMENT (managed, VPC-hosted)          │
│                                                                        │
│   ┌───────────┐   ┌───────────┐   ┌────────────┐   ┌──────────────┐ │
│   │ Scheduler  │   │  Worker(s) │   │ Web Server │   │ Metadata DB   │ │
│   │            │   │            │   │            │   │ (managed,     │ │
│   │ Parses DAGs│   │ Executes   │   │ Airflow UI │   │  Aurora       │ │
│   │ Triggers   │   │ tasks      │   │ (task      │   │  PostgreSQL,  │ │
│   │ task runs  │   │ (Celery/   │   │  status,   │   │  internal —   │ │
│   │ per DAG    │   │  Kubernetes│   │  logs,     │   │  not directly │ │
│   │ schedule   │   │  Executor) │   │  triggers)  │   │  accessible)  │ │
│   └───────────┘   └───────────┘   └────────────┘   └──────────────┘ │
│         ▲                ▲                                            │
│         │                │  auto-scales workers between               │
│         │                │  min/max worker count based on              │
│         │                │  queued task count                          │
│         │                │                                             │
│         └────────────────┴──── both read DAG files from ────┐         │
│                                                                 │         │
└─────────────────────────────────────────────────────────────┼─────────┘
                                                                  │
                                                                  v
                                              ┌──────────────────────┐
                                              │  S3 bucket (DAG folder)│
                                              │  /dags/*.py            │
                                              │  /plugins.zip          │
                                              │  /requirements.txt      │
                                              └──────────────────────┘
```

- **Scheduler** — continuously parses every `.py` file in the DAG
  folder, determines which DAGs are due to run based on their
  schedule, and queues task instances for execution. If a DAG has a
  Python error, the scheduler is where that failure surfaces.
- **Worker(s)** — actually execute tasks. MWAA uses the **Celery
  Executor** (workers pull tasks from a queue) and **auto-scales**
  worker count between a configured **minimum and maximum** based on
  queued task volume — the answer to "MWAA scales automatically" on
  the exam.
- **Web server** — hosts the Airflow UI: DAG graph view, task
  status/history, trigger button, task-level logs. This is the
  primary **troubleshooting surface** a senior engineer opens first
  (see Section 3).
- **Metadata database** — a managed, internal Aurora PostgreSQL
  database storing DAG run history, task state, variables, and
  connections. Not directly user-accessible; MWAA manages it as part
  of the environment.

### 2.2 DAG deployment — the S3-synced DAG folder

Unlike self-managed Airflow (where you might `git push` directly to a
server), MWAA deploys DAGs by **syncing a configured S3 bucket** —
you upload/update `.py` DAG files, a `requirements.txt` (for Python
package dependencies), and an optional `plugins.zip` to specific
prefixes in that bucket, and MWAA's scheduler/workers **periodically
sync** from S3 into the environment.

```
Developer ──▶ git push ──▶ CI/CD pipeline ──▶ S3 bucket (dags/ prefix)
                                                       │
                                     (MWAA syncs from S3 on an interval —
                                      NOT instantaneous; expect a short lag)
                                                       │
                                                       v
                                          MWAA Scheduler picks up
                                          new/changed DAG file
```

⚠️ This sync is **not instantaneous** — a newly uploaded or modified
DAG can take a noticeable amount of time (commonly explained as "up to
a couple of minutes," and can be longer under load) to appear in the
Airflow UI. A DAG that "isn't showing up yet" immediately after upload
is very often just **sync lag**, not a bug — see the troubleshooting
flow in Section 2.4.

### 2.3 Environment sizing

MWAA environments come in three **environment classes**, each fixing
the underlying compute allocated to the scheduler and web server (you
separately configure worker min/max independently of environment
class):

| Environment class | Scheduler/webserver vCPU | Approximate use case |
|---|---|---|
| **mw1.small** | Smallest | Light workloads, few DAGs, small teams, dev/test |
| **mw1.medium** | Mid-tier | Moderate DAG count and concurrency, typical production |
| **mw1.large** | Largest | High DAG volume, many concurrent task executions, large enterprise orchestration |

Sizing decisions are driven by **DAG count, task concurrency, and
scheduler parsing load** — a large number of DAGs (even if individually
small) increases scheduler parsing overhead just as much as a smaller
number of very complex DAGs does. Environment class is a **coarse,
manually chosen** setting (unlike worker count, which auto-scales); a
common exam-relevant judgment is recognizing that undersizing the
environment class (not just worker count) can be the actual bottleneck
when tasks queue despite plenty of workers being available.

### 2.4 Troubleshooting — symptom-to-log-source routing

| Symptom | Where to look |
|---|---|
| **A single task fails** | **Airflow Task Logs** (per-task, viewed in the Airflow UI, backed by CloudWatch Logs under the hood) |
| **The DAG never appears / doesn't parse** | **Scheduler Logs** — DAG parsing errors (Python import errors, syntax errors), or S3 DAG-bag sync delay |
| **Tasks stay `queued` and never run / workers seem maxed** | **Environment scaling settings** (min/max workers too low) — check worker CloudWatch metrics |
| **The whole environment seems unhealthy** | **Environment health status** in the MWAA console, plus scheduler/worker/webserver CloudWatch Logs |

```
   MWAA TROUBLESHOOTING FLOW (narrows scope at each stage)

   Failure reported
        │
        v
   ┌─────────────────────┐   Which component is unhealthy?
   │ CloudWatch Logs       │   (scheduler / worker / webserver /
   │ (environment-level)   │    DAG processing — MWAA publishes
   └──────────┬───────────┘    each to a SEPARATE log group)
              │
              v
   ┌─────────────────────┐   Which task, and why?
   │ Airflow UI / Task Logs │   (traceback, retry count, duration —
   │ (task-level)           │    fastest diagnostic surface)
   └──────────┬───────────┘
              │
              v
      Root cause: bad import, missing dependency,
      expired connection/secret, IAM permission gap,
      or genuine worker-capacity shortage
```

A senior engineer's instinct: **open the Airflow UI first**, not raw
CloudWatch Logs. The UI surfaces task state, retry count, and duration
at a glance — CloudWatch Logs become useful once the UI has narrowed
the blast radius to "this specific task, this specific traceback."

**Enable ALL four log types** in production (DAG processing,
scheduler, worker, webserver), not just task logs — a DAG parsing
timeout, for example, never produces a task log at all (the DAG never
even starts), so task-logs-only visibility leaves you blind to an
entire failure class.

### 2.5 When MWAA wins over Step Functions

| Signal in the question stem | Points to |
|---|---|
| "existing Airflow DAGs to migrate" | **MWAA** |
| "team already knows Airflow / Python-heavy custom operators" | **MWAA** |
| "complex, conditional Python dependency logic between tasks" | **MWAA** |
| "need Airflow's operator/sensor ecosystem" (hundreds of pre-built integrations) | **MWAA** |
| "serverless, no idle cost, simple branching/retries" | Step Functions |
| "least operational overhead" | Step Functions (almost always) |
| "cost-sensitive, no existing Airflow investment" | Step Functions |

```
                  Does the scenario mention EXISTING Airflow DAGs,
                  or a team with deep Airflow/Python operator investment?
                              │
                ┌──────────────┴──────────────┐
               YES                             NO
                │                               │
              MWAA                    STEP FUNCTIONS (default)
     (always-on environment,          (serverless, no idle cost,
      you pay environment-hours       native retry/catch, 200+
      whether or not a DAG runs)      service integrations)
```

### 2.6 Cost model

MWAA cost has two components:

1. **Environment class hours** — the scheduler/webserver compute runs
   **continuously**, billed per hour, **regardless of whether any DAG
   is actively running**. This is the "always-on" cost the exam wants
   you to recognize as MWAA's defining tradeoff.
2. **Worker autoscaling** — additional cost scales with the number of
   workers actively running (between the configured min and max),
   which itself scales with queued task volume.

```
COST SHAPE COMPARISON

MWAA:            ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁  ← baseline environment
                  ▂▂▂▂    ▃▃▃▃▃▃         ▂▂       cost runs 24/7,
                                                   worker cost bumps
                                                   up during actual runs

Step Functions:   ────────▂───────▂──────────    ← ZERO cost when idle;
                                                   cost only during
                                                   actual executions
```

This is why the exam consistently treats MWAA as **never** the
"least operational overhead" or "lowest cost for infrequent workloads"
answer — you're paying for the kitchen to stay warm even on nights you
don't cook.

---

<a name="s3"></a>
## 3. Explain like a senior AWS data engineer

A senior engineer's default orchestration choice is **Step Functions,
not MWAA** — MWAA is an always-on environment requiring genuine
operational care (plugin management, `requirements.txt` dependency
resolution, worker autoscaling tuning, environment-class sizing), and
Step Functions covers the majority of branching/retry/parallel-map
orchestration needs serverlessly with zero idle cost. MWAA earns its
place only when the scenario hands you something Step Functions
genuinely can't replicate cleanly: **existing Airflow DAGs** that would
require a costly rewrite, **complex Python-based conditional
dependency logic** that doesn't map cleanly to Amazon States Language,
or a team with **deep sunk Airflow operator/sensor expertise** that
would be expensive to retrain. Picking MWAA when the question stem
doesn't mention Airflow at all is the single most common wrong-answer
trap in this area of the exam.

The second senior judgment is **troubleshooting discipline**: routing
symptom to the *right* log source *in the right order* saves real
diagnostic time. A DAG that "doesn't appear in the UI" is
overwhelmingly a **Python import/parsing error** or **S3 sync lag** —
not a permissions problem — and a senior engineer checks scheduler
logs before ever touching IAM. Conversely, tasks stuck in `queued`
state are a **capacity** problem (worker min/max too low), not a code
bug, and no amount of log-reading in the DAG itself will explain it —
that's a scaling-settings fix, not a code fix.

Third: a senior engineer treats a DAG that "worked yesterday, fails
today, no code change" as a signal to look **outside the DAG's own
code** — an upstream data dependency that didn't arrive (a sensor
timing out), a transient AWS API throttle visible only in task logs,
or an expired connection/secret (check the Secrets Manager backend if
MWAA is configured to use one for Airflow Connections) — rather than
assuming a regression that isn't there.

Fourth: environment **sizing is not just about worker count**. A
common mistake is scaling max workers up while leaving the environment
class too small — since the scheduler and webserver compute is fixed
by environment class, a large number of DAGs (high scheduler parsing
load) can bottleneck the pipeline even with plenty of worker capacity
available. The fix in that case is a bigger environment class, not
more workers.

Finally, a senior engineer never conflates MWAA's **DAG-level
retry/dependency semantics** (rich, Python-native, operator-specific)
with Step Functions' **state-level Retry/Catch** (JSON-configured,
service-integration-native) — they solve overlapping but differently-
shaped problems, and "which one is simpler to reason about for this
specific workflow" is often the deciding factor once the "existing
Airflow" litmus test doesn't apply.

---

<a name="s4"></a>
## 4. Explain production architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                         PRODUCTION MWAA DEPLOYMENT                        │
│                                                                             │
│  CI/CD (CodePipeline/GitHub Actions)                                       │
│        │  lints/tests DAGs, then syncs on merge to main                    │
│        v                                                                    │
│  ┌─────────────────────────┐                                               │
│  │  S3 bucket (versioned)    │  /dags/*.py                                  │
│  │                           │  /requirements.txt (pinned versions)         │
│  │                           │  /plugins.zip                                │
│  └────────────┬─────────────┘                                              │
│               │  synced periodically                                        │
│               v                                                             │
│  ┌──────────────────────────────────────────────────────────────┐         │
│  │   MWAA Environment (private VPC subnets, no public web server)  │         │
│  │                                                                   │         │
│  │   Scheduler ──parses──▶ DAGs ──▶ Worker pool (autoscale min↔max) │         │
│  │        │                                          │              │         │
│  │        │                        DAG tasks call:    │              │         │
│  │        │                        - Glue StartJobRun  │              │         │
│  │        │                        - EMR AddSteps       │              │         │
│  │        │                        - Redshift Data API  │              │         │
│  │        │                        - S3 sensors          │              │         │
│  │        v                                                │         │
│  │   4 separate CloudWatch Log groups:                     │         │
│  │   DAGProcessing / Scheduler / Worker / WebServer          │         │
│  └──────────────────────────────────┬─────────────────────┘         │
│                                       │                                  │
│                                       v                                  │
│                          Metric filter (task FAILED pattern)             │
│                                       │                                  │
│                                       v                                  │
│                          CloudWatch Alarm ──▶ SNS ──▶ on-call             │
│                                                                             │
│  Airflow Connections/Variables ──▶ backed by Secrets Manager               │
│  (not stored in plaintext in the metadata DB)                              │
│                                                                             │
│  IAM execution role ──▶ scoped exactly to: S3 DAG bucket read,             │
│  CloudWatch Logs write, and whatever downstream services (Glue, EMR,      │
│  Redshift Data API) the DAG tasks actually call — least privilege          │
└────────────────────────────────────────────────────────────────────────┘
```

**Why each piece exists:** DAGs are deployed through **CI/CD**, not
manual S3 uploads, so changes are reviewed, tested, and versioned
before reaching production. The environment runs in **private VPC
subnets** with no public web server access, reached instead via
VPN/Direct Connect or a bastion, for security. Each DAG's tasks are
thin orchestration wrappers around **managed AWS services doing the
actual heavy lifting** (Glue, EMR, Redshift Data API) — MWAA
orchestrates, it doesn't do the data processing itself. **All four
log groups** are enabled so no failure class is invisible. **Secrets
Manager** backs Airflow Connections so database/API credentials aren't
sitting in the Airflow metadata database in plaintext. The **execution
role** is scoped narrowly per the services the DAGs actually touch,
following least privilege — a common production mistake is granting
the MWAA execution role broad, unscoped permissions "to avoid
IAM issues," which becomes a security liability.

---

<a name="s5"></a>
## 5. Explain exam traps

⚠️ **Trap 1 — MWAA as "least operational overhead."** It never is.
MWAA is an always-on environment you size and pay for continuously,
in contrast to Step Functions' zero idle cost. Any answer implying
MWAA minimizes operational burden, when the stem doesn't mention
existing Airflow investment, is the distractor.

⚠️ **Trap 2 — "DAG doesn't appear in UI" jumped straight to IAM.** This
symptom is overwhelmingly a **Python parsing error** or **S3 sync
lag**, not a permissions problem. Check scheduler logs before
touching IAM policies.

⚠️ **Trap 3 — Tasks stuck `queued` blamed on code.** This is a
**worker capacity** issue (min/max workers too low), not a bug in the
DAG or task code — the fix is scaling settings, not a code review.

⚠️ **Trap 4 — Chaining ONLY Glue jobs and crawlers, no other service
involved.** The correct, free answer is **Glue Workflows**, not MWAA
or Step Functions — MWAA is disqualified the moment a simpler, free,
purpose-built option exists for a Glue-only chain.

⚠️ **Trap 5 — Assuming instant DAG sync from S3.** A newly uploaded or
modified DAG file does not appear in the Airflow UI immediately — sync
has a lag. A question implying "should be visible right away" testing
whether you know this delay exists is common.

⚠️ **Trap 6 — Treating environment class and worker count as the same
lever.** Environment class (scheduler/webserver compute) is a manual,
coarse setting; worker count autoscales within a configured min/max.
A scheduler-parsing bottleneck (many DAGs) is not fixed by raising
`max workers` — it needs a bigger environment class.

⚠️ **Trap 7 — "A DAG worked yesterday, fails today with no code
change" blamed on MWAA infrastructure by default.** The more likely
causes are an upstream data dependency that didn't arrive (sensor
timeout), a transient AWS API throttle, or an expired
connection/secret — check these before assuming an MWAA-side
regression.

⚠️ **Trap 8 — Only enabling task logs.** A DAG parsing failure never
produces a task log (the DAG never starts) — scheduler logs must also
be enabled, or that entire failure class is invisible.

---

<a name="s6"></a>
## 6. Explain interview questions

**Q: "When would you choose MWAA over Step Functions for a new
pipeline?"**
A: Almost never for a brand-new pipeline with no constraints — Step
Functions is serverless, has native per-state Retry/Catch, and
integrates with 200+ AWS services directly. MWAA earns its place only
when there are existing Airflow DAGs to migrate, complex Python-based
dependency/branching logic that doesn't map cleanly to States
Language, or a team with deep existing Airflow operator expertise.

**Q: "A DAG that ran fine for months suddenly isn't appearing in the
Airflow UI after a deploy. What do you check first?"**
A: Scheduler logs, for a Python import or syntax error in the DAG
file — this is the most common cause. I'd also verify the file
actually landed in the correct S3 DAG-folder prefix and allow for
normal sync lag before assuming it's broken.

**Q: "Tasks in your DAG are staying in `queued` state for a long time
even though the DAG logic looks correct. What's your diagnosis path?"**
A: Check worker-related CloudWatch metrics and the environment's
configured min/max worker autoscaling settings — this is a capacity
symptom, not a logic bug. If max workers is too low for the current
task concurrency, tasks will queue no matter how correct the DAG code
is.

**Q: "How do you keep credentials out of your DAG code while still
letting tasks connect to a database?"**
A: Configure Airflow Connections backed by **Secrets Manager** (MWAA
supports a Secrets Manager backend for Connections and Variables)
rather than hardcoding credentials in the DAG file or storing them
unencrypted in the Airflow metadata database.

**Q: "Why might a large environment class be necessary even if actual
task execution volume is moderate?"**
A: Scheduler parsing load scales with the **number and complexity of
DAG files**, not just concurrent task execution volume — a large
number of DAGs (even simple ones) can bottleneck the scheduler on a
small environment class, independent of how many workers are
available to actually run tasks.

---

<a name="s7"></a>
## 7. Cheat sheet

| Fact | Value |
|---|---|
| What it is | Fully managed Apache Airflow |
| Core components | Scheduler, Worker(s), Web Server, Metadata DB (internal Aurora PostgreSQL) |
| Executor type | Celery Executor (default) |
| DAG deployment | S3-synced DAG folder (`dags/`, `requirements.txt`, `plugins.zip`) |
| DAG sync latency | Not instant — expect a short delay after upload |
| Environment classes | mw1.small / mw1.medium / mw1.large |
| Worker scaling | Auto-scales between configured min/max based on queued tasks |
| Cost model | **Environment-hours (always on)** + worker autoscaling cost |
| Idle cost | High — pays even when no DAG is running |
| When it wins | Existing Airflow DAGs, complex Python dependency logic, Airflow operator ecosystem needed |
| When it loses | "Least operational overhead," no existing Airflow investment, simple branching |
| Task failure diagnosis | Airflow UI / Task Logs |
| DAG-not-parsing diagnosis | Scheduler Logs |
| Tasks stuck queued diagnosis | Worker/environment scaling settings |
| Log groups | 4 separate: DAG Processing, Scheduler, Worker, Web Server |
| Secrets handling | Secrets Manager backend for Connections/Variables |
| Chain ONLY Glue jobs/crawlers | Use Glue Workflows instead (free) |

### Decision table

| Requirement | Answer |
|---|---|
| "Migrate existing Airflow DAGs" | MWAA |
| "Complex Python dependency logic between tasks" | MWAA |
| "Serverless orchestration, no idle cost, retries/branching" | Step Functions |
| "Chain only Glue jobs and crawlers" | Glue Workflows (free) |
| "Simple schedule, no branching" | EventBridge Scheduler |
| "DAG isn't showing up in the UI" | Check scheduler logs (parsing error / sync lag) |
| "Tasks stuck in queued" | Check worker min/max scaling settings |
| "A single task failed" | Check Airflow Task Logs via the UI |

---

<a name="s8"></a>
## 8. Memory tricks

- **"MWAA = Managed, but never Minimal."** It's always managed
  infrastructure, never the "minimal operational overhead" answer.
- **"S-W-W" troubleshooting order:** **S**cheduler logs (DAG not
  appearing) → **W**eb UI / task logs (single task failed) → **W**orker
  scaling settings (tasks queued). Match the symptom to the letter.
- **"Sync isn't instant."** Think of S3-to-MWAA DAG sync like mail
  delivery, not a phone call — there's always a short lag.
- **"Existing Airflow = MWAA's only strong claim."** If the word
  "Airflow" or "existing DAGs" doesn't appear in the stem, default to
  Step Functions.
- **"Environment class ≠ worker count."** Environment class is the
  size of the kitchen; worker count is how many extra cooks you hire
  for a busy night. A too-small kitchen bottlenecks no matter how many
  cooks you add.

---

<a name="s9"></a>
## 9. Per-service coverage checklist

**Purpose.** Fully managed Apache Airflow for complex, code-based
workflow orchestration with rich dependency logic, retries, and a
broad operator ecosystem.

**When to use.** Migrating existing Airflow DAGs to AWS; teams with
deep existing Airflow/Python operator expertise; workflows needing
complex, conditional, code-native dependency logic that doesn't map
cleanly to a declarative state machine; need for Airflow's large
library of pre-built operators/sensors/hooks across many third-party
systems.

**When NOT to use.** Any greenfield orchestration need with no
existing Airflow investment (Step Functions is simpler and cheaper);
pure Glue job/crawler chains (Glue Workflows, free); simple time-based
triggers with no branching (EventBridge Scheduler); cost-sensitive,
intermittent workloads (MWAA's always-on cost makes it a poor fit).

**Advantages.** Full Airflow feature parity (operators, sensors,
hooks, XComs, dynamic task mapping); rich, mature open-source
ecosystem; expressive Python-native dependency and branching logic;
strong visual DAG/task status UI; auto-scaling workers.

**Limitations.** Always-on environment cost regardless of DAG
activity; DAG deployment via S3 sync introduces a small but real
latency versus instant deployment; environment sizing (scheduler/
webserver) is a coarser, manual lever separate from worker
autoscaling; steeper operational learning curve than serverless
alternatives (dependency management via `requirements.txt`, plugin
packaging).

**Pricing considerations.** Billed for environment-class hours
continuously, plus additional cost for actively running workers scaled
between min/max — meaning cost accrues even during idle periods,
unlike Step Functions' zero-idle-cost model.

**Performance.** Scheduler parsing throughput scales with environment
class; task execution throughput scales with worker count (auto-scaled
within configured bounds based on queued task volume).

**Scaling.** Worker count auto-scales automatically; environment class
(scheduler/webserver compute) must be manually resized if scheduler
parsing load (DAG count/complexity) becomes the bottleneck rather than
task execution volume.

**Security.** Runs in a customer VPC (private subnets recommended, no
public web server access); IAM execution role should be scoped to
exactly the AWS services each DAG's tasks call; Secrets Manager
backend for Airflow Connections/Variables avoids storing credentials
in plaintext.

**High availability.** MWAA distributes environment components across
Multiple Availability Zones for resilience; the managed metadata
database is similarly built for availability.

**Failure scenarios.** DAG parsing errors (bad Python import, syntax
error) prevent an entire DAG from appearing, silently, unless
scheduler logs are checked; worker capacity shortfalls cause tasks to
queue indefinitely without any code-level error; expired
connections/secrets cause "worked yesterday, fails today" failures
unrelated to DAG code changes.

**Common mistakes.** Choosing MWAA reflexively for orchestration
without an existing-Airflow justification; assuming instant DAG
visibility after S3 upload; troubleshooting a "DAG not appearing"
issue by checking IAM before scheduler logs; conflating environment
class sizing with worker count sizing; leaving only task logs enabled
and missing DAG-parsing-level failures.

**Exam traps.** See Section 5 in full above.

**Real enterprise examples.** A media company migrating an
on-premises Airflow deployment to AWS moves its existing DAGs
unmodified into MWAA rather than rewriting years of complex,
Python-heavy dependency logic into Step Functions' Amazon States
Language. A financial services firm builds new pipelines directly in
Step Functions instead of MWAA specifically because there was no
existing Airflow investment and the serverless, zero-idle-cost model
better fit their intermittent batch schedule. A logistics company
troubleshooting a DAG that stopped appearing after a deploy finds a
missing third-party Python package in `requirements.txt`, visible only
in scheduler logs — not a permissions issue as initially suspected.

---

<a name="s10"></a>
## 10. Practice questions (15)

**Q1.** A company is migrating from a self-managed, on-premises
Airflow deployment with 200 existing DAGs containing complex
Python-based conditional dependency logic. Which AWS orchestration
service should they choose, and why?

A) Step Functions, because it is serverless and has zero idle cost
B) MWAA, because it runs Apache Airflow natively, allowing the
   existing DAGs to migrate largely unmodified rather than requiring a
   costly rewrite into a different orchestration paradigm
C) Glue Workflows, because it is free
D) EventBridge Scheduler, because it is the simplest option

**Answer: B.** This is the canonical MWAA-wins scenario: existing
Airflow investment that would be expensive to rewrite. A) Step
Functions would require translating 200 complex DAGs into Amazon
States Language — a significant rewrite cost the question is trying to
avoid. C) Glue Workflows only chains Glue jobs/crawlers, far too
limited for general Python-based orchestration. D) EventBridge
Scheduler has no branching/dependency logic at all.

**Q2.** Why is MWAA rarely the correct answer when a question stem
specifically emphasizes "least operational overhead" with no mention
of existing Airflow?

A) MWAA cannot execute Python code
B) MWAA is an always-on managed environment billed continuously
   regardless of whether any DAG is actively running, unlike
   serverless alternatives with zero idle cost
C) MWAA does not support retries
D) MWAA cannot integrate with Glue or EMR

**Answer: B.** The defining operational/cost tradeoff of MWAA is its
always-on nature — you provision and pay for the environment
continuously. A), C), and D) are all factually false; MWAA supports
Python fully, retries via Airflow's own retry mechanisms, and
integrates broadly with AWS services through operators/hooks.

**Q3.** A DAG file was uploaded to the correct S3 prefix five minutes
ago but has not yet appeared in the Airflow UI. What is the most
likely explanation?

A) The IAM execution role is missing S3 permissions
B) DAG sync from S3 to the MWAA environment is not instantaneous;
   some delay before the DAG appears is expected and normal
C) MWAA environments only sync DAGs once every 24 hours
D) The DAG must be manually restarted via the AWS CLI to appear

**Answer: B.** A short sync delay after upload is expected behavior,
not a fault. A) would typically produce a visible permissions error
rather than silence, and is a less likely first explanation for a mere
5-minute gap. C) overstates the delay significantly beyond typical
behavior. D) is not how MWAA DAG deployment works — sync is automatic.

**Q4.** A single task within an otherwise-healthy DAG has been failing
repeatedly with the same error. Where should an engineer look first to
diagnose it?

A) CloudTrail management events
B) Airflow Task Logs, viewed via the Airflow UI
C) The Glue Data Catalog
D) AWS Config compliance history

**Answer: B.** Task-level logs, accessible through the Airflow UI, are
the fastest and most direct diagnostic surface for a single failing
task — they show the actual traceback, retry count, and duration. A),
C), and D) are unrelated to Airflow task execution diagnostics.

**Q5.** Multiple tasks across several DAGs are stuck in `queued` state
for an extended period, even though the DAG logic and dependencies
appear correct. What is the most likely root cause?

A) A Python syntax error in one of the DAG files
B) Worker capacity — the configured maximum worker count is too low
   for the current task concurrency demand
C) The S3 DAG bucket has run out of storage
D) The metadata database needs to be manually vacuumed

**Answer: B.** Tasks queuing despite correct logic is the signature
symptom of insufficient worker capacity relative to demand — check and
potentially raise the max worker autoscaling setting. A) would prevent
the DAG from parsing/appearing at all, not cause tasks to queue after
successfully starting. C) and D) are not realistic MWAA operational
concerns exposed to the user in this way.

**Q6.** A pipeline needs to chain together three Glue jobs and one
Glue crawler, with no other AWS services involved, and wants the
lowest possible orchestration cost. What should be used?

A) MWAA
B) Step Functions Standard
C) Glue Workflows
D) Step Functions Express

**Answer: C.** Glue Workflows is purpose-built and free for chaining
Glue-native resources (jobs and crawlers) with no other services
involved — the cheapest and simplest fit. A) MWAA introduces
unnecessary always-on cost for a pure-Glue chain. B) and D) Step
Functions works but isn't free and is unnecessary overhead when
Glue Workflows already covers this exact narrow case.

**Q7.** What are the four separate log groups a well-configured
production MWAA environment should enable, and why enable all of them
rather than just task logs?

A) Only task logs are needed; the others are redundant
B) DAG Processing, Scheduler, Worker, and Web Server logs — because a
   failure like a DAG parsing error never produces a task log at all
   (the DAG never starts), so task-logs-only visibility misses entire
   failure classes
C) Access logs, error logs, billing logs, and security logs
D) Only Scheduler and Worker logs are relevant; Web Server and DAG
   Processing logs are cosmetic

**Answer: B.** Each MWAA log group covers a distinct component, and
some failure modes (like DAG parsing errors) occur entirely outside
task execution, meaning they would never surface if only task logs
were enabled. A), C), and D) all understate or mischaracterize the
actual log group set and their diagnostic value.

**Q8.** A DAG that has run successfully every day for six months
suddenly fails today with no code changes deployed. What should be
investigated before assuming an MWAA infrastructure regression?

A) Whether an upstream data dependency failed to arrive (sensor
   timeout), a transient AWS API throttle occurred, or a connection/
   secret used by the DAG has expired
B) Whether the environment class needs to be upgraded to mw1.large
C) Whether the S3 DAG bucket needs versioning enabled
D) Whether the Celery Executor should be switched to Kubernetes
   Executor

**Answer: A.** "Worked yesterday, fails today, no code change" points
toward external, non-code causes first — upstream data timing,
transient throttling, or credential expiry — rather than assuming the
orchestration layer itself regressed. B), C), and D) are unrelated
infrastructure changes with no direct bearing on this specific
symptom pattern.

**Q9.** Why might increasing the maximum worker count fail to resolve
a bottleneck where DAGs take a long time to even begin executing after
their scheduled time?

A) Worker count has no effect on MWAA performance at all
B) The bottleneck may actually be scheduler parsing load (driven by
   DAG count/complexity), which is governed by the environment class,
   not by worker count
C) MWAA does not support increasing worker count
D) Increasing worker count always resolves every performance issue

**Answer: B.** Scheduler throughput (how quickly DAGs are parsed and
tasks are queued in the first place) is tied to environment class, a
separate lever from worker count, which only affects how many queued
tasks can execute concurrently once they're queued. A), C), and D) all
misrepresent this distinction.

**Q10.** How should database credentials used by an Airflow Connection
be managed in a production MWAA environment, following best practice?

A) Hardcoded directly in the DAG Python file
B) Stored in plaintext in the S3 DAG bucket alongside the DAG files
C) Configured via a Secrets Manager backend for Airflow Connections,
   rather than storing credentials in the DAG code or unencrypted in
   the metadata database
D) Stored as an environment variable visible to all DAGs in the
   environment

**Answer: C.** MWAA supports backing Airflow Connections and Variables
with Secrets Manager, keeping credentials out of DAG code and out of
the Airflow metadata store in plaintext. A), B), and D) all expose
credentials in less secure, broadly visible locations.

**Q11.** Which statement correctly compares MWAA's cost model to Step
Functions'?

A) Both have identical, zero idle-cost, pay-per-execution pricing
B) MWAA bills for environment-class hours continuously (plus worker
   autoscaling cost) regardless of DAG activity; Step Functions bills
   per state transition with zero cost when no workflow is executing
C) MWAA is always cheaper than Step Functions at any workload volume
D) Step Functions has an always-on environment cost, while MWAA is
   fully serverless with zero idle cost

**Answer: B.** This correctly states the fundamental cost-shape
difference: MWAA's always-on environment versus Step Functions' true
pay-per-use serverless model. A), C), and D) all misstate or invert
the actual cost relationship.

**Q12.** A team wants a workflow with retries, branching, and parallel
processing of 5,000 S3 objects, with no existing Airflow investment
and a strong preference for minimal operational overhead. What is the
better choice?

A) MWAA, using Airflow's dynamic task mapping
B) Step Functions, using Distributed Map for the 5,000-object
   parallelism, with native Retry/Catch for error handling
C) Glue Workflows
D) A single large Lambda function looping through all 5,000 objects
   sequentially

**Answer: B.** With no existing Airflow investment and an explicit
"minimal operational overhead" preference, Step Functions (especially
Distributed Map, purpose-built for processing thousands of objects in
parallel) is the better fit and avoids MWAA's always-on cost. A) would
work technically but contradicts the stated preference and lacks
justification given no existing Airflow usage. C) Glue Workflows
doesn't support this level of general-purpose branching/parallelism.
D) A single sequential Lambda both violates the 15-minute execution
limit at this scale and defeats the parallelism requirement.

**Q13.** What is the role of the Airflow metadata database in an MWAA
environment?

A) It stores the raw data being processed by ETL tasks
B) It is a managed, internal database (Aurora PostgreSQL) storing DAG
   run history, task state, connections, and variables — not directly
   accessible to users, and not a data storage layer for pipeline
   payloads
C) It is a customer-managed RDS instance the user must provision
   separately
D) It stores the actual DAG Python source files

**Answer: B.** The metadata database is Airflow's internal state
store for orchestration bookkeeping, fully managed as part of the
MWAA environment. A) is false — actual pipeline data flows through
services like S3/Glue/Redshift, not the Airflow metadata DB. C) is
false — MWAA manages this database internally; the user does not
provision or directly access it. D) DAG source files live in the S3
DAG folder, not the metadata database.

**Q14.** Which MWAA environment classes exist, from smallest to
largest?

A) mw1.nano, mw1.micro, mw1.small
B) mw1.small, mw1.medium, mw1.large
C) mw1.basic, mw1.standard, mw1.premium
D) mw1.dev, mw1.staging, mw1.prod

**Answer: B.** These are MWAA's three actual environment classes,
each fixing scheduler/webserver compute allocation. A), C), and D)
are fabricated naming schemes.

**Q15.** A question describes a workflow requiring integration with a
niche third-party SaaS platform for which a mature, pre-built
community operator/hook already exists in the open-source Airflow
ecosystem, and states the team is comfortable maintaining an
always-on orchestration environment for the operational convenience
this provides. What is the best-supported orchestration choice?

A) Step Functions, writing a custom Lambda to call the third-party
   API directly
B) MWAA, leveraging the existing community-maintained Airflow operator
   for that SaaS platform rather than building custom integration code
C) EventBridge Scheduler
D) Glue Workflows

**Answer: B.** This scenario specifically signals MWAA's ecosystem
advantage (a pre-built, community-maintained operator) and explicitly
states the team accepts the always-on tradeoff — both conditions
favor MWAA over building custom integration code elsewhere. A) is
technically possible but discards the ready-made operator ecosystem
the question highlights as available and preferred. C) and D) have no
mechanism for this kind of custom third-party integration at all.
