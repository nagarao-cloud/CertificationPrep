# AWS Step Functions

> Service file. Domain coverage: primarily **Domain 1** (orchestrating
> ingestion/transformation pipelines) with heavy overlap into **Domain 3**
> (operational retries, error handling, failure visibility).
>
> One-line identity: **the state machine of AWS** — the only
> orchestration primitive on the exam that natively tracks *where a
> multi-step process currently is*, and can branch, retry, and wait
> based on that state.

## CONTENTS

1. [8-step teaching pass](#steps)
2. [Per-service coverage checklist](#checklist)
3. [Standard vs Express workflows](#standard-express)
4. [Map state and Distributed Map](#map)
5. [Error handling — Retry, Catch, backoff](#errors)
6. [Service integrations](#integrations)
7. [Step Functions vs MWAA vs EventBridge](#comparison)
8. [Decision tree](#tree)
9. [Production architecture](#prod)
10. [Exam traps](#traps)
11. [Interview questions](#interview)
12. [Cheat sheet](#cheat)
13. [Mnemonics](#mnemonics)
14. [15 practice questions](#questions)

---

<a name="steps"></a>
## 1. 8-step teaching pass

### Step 1 — Explain like I'm 12

Imagine baking a cake by following a recipe card that has boxes to
check off: "1. Mix dry ingredients ☐  2. Mix wet ingredients ☐  3.
Combine ☐  4. Bake ☐  5. Cool ☐  6. Frost ☐." Step Functions is that
recipe card come to life — it remembers exactly which box you're on,
and if step 4 (baking) goes wrong because the oven wasn't preheated,
it knows to go back and try again, or to skip to a "throw it away and
start over" box instead of just freezing in place forever. A dumb
assistant would forget which step you were on the second the phone
rang; Step Functions never forgets.

### Step 2 — Explain technically

AWS Step Functions is a **serverless orchestration service** built
around **state machines** defined in **Amazon States Language (ASL)**,
a JSON-based DSL. A state machine is a directed graph of **states** —
`Task` (do work, typically invoking a Lambda or another AWS service
API directly), `Choice` (branch based on input), `Parallel` (run
branches concurrently), `Map` (iterate over a collection), `Wait`
(pause for time or until a timestamp), `Pass` (no-op / data
transform), `Succeed`/`Fail` (terminal states). Step Functions
maintains the **execution state** — which state is active, the input
and output at each step, retry counts — durably, so a multi-hour or
multi-day workflow survives without you building any of that state
tracking yourself.

### Step 3 — Explain like a Senior AWS Data Engineer

A senior engineer's mental model: **Step Functions is the answer the
instant "state" enters the requirement** — not just "call service A
then service B," but "remember where we are, retry intelligently,
branch based on results, and let me inspect exactly what happened
after the fact." The senior instinct on **Standard vs Express** is a
cost/duration/semantics tradeoff, not a feature tradeoff: Standard is
for long-running, low-to-moderate-volume workflows where
**exactly-once** execution and a 90-day inspectable history matter
(a nightly ETL DAG); Express is for **high-volume, short-duration**
event processing where **at-least-once** is acceptable and you're
paying per-request instead of per-state-transition (processing every
single IoT telemetry event through a short transform-and-store
workflow). The other senior instinct: Step Functions replaces a
mountain of **glue Lambda code** whose only job was "call this, then
call that, and if it fails retry it" — native `Retry`/`Catch` fields
in ASL are declarative and *far* less code to maintain than the
try/except/sleep loops engineers write by hand.

### Step 4 — Production architecture

See [section 9](#prod).

### Step 5 — Exam traps

See [section 10](#traps).

### Step 6 — Interview questions

See [section 11](#interview).

### Step 7 — Cheat sheet

See [section 12](#cheat).

### Step 8 — Memory tricks

See [section 13](#mnemonics).

---

<a name="checklist"></a>
## 2. Per-service coverage checklist — Step Functions

| Dimension | Detail |
|---|---|
| **Purpose** | Serverless orchestration of multi-step workflows with native state tracking, branching, retries, and parallelism |
| **When to use** | Multi-step pipelines needing durable state, conditional branching, retry-with-backoff, human-approval waits, fan-out/fan-in parallel processing, or a visual/inspectable execution history |
| **When NOT to use** | Simple one-hop "when X happens, do Y" routing with no state (EventBridge alone); extremely high-throughput per-record stream processing better suited to Kinesis/Flink; teams with an existing Airflow investment and complex Python-based DAG authoring needs (MWAA) |
| **Advantages** | 200+ direct AWS service integrations (no Lambda glue code required for many calls), native Retry/Catch, visual workflow designer, Distributed Map for massive parallel fan-out, exactly-once semantics (Standard) |
| **Limitations** | Express has a hard **5-minute** execution ceiling; Standard state input/output payload limited to **256 KB** per state (larger payloads must be referenced via S3, not passed inline); ASL has a learning curve versus plain code |
| **Pricing** | **Standard**: billed per **state transition** (~$25 per million transitions, order of magnitude). **Express**: billed per **request + duration** (GB-seconds), cheaper at very high volume/short duration |
| **Performance** | Standard: any duration up to 1 year; state transition itself is near-instant, latency comes from the states/waits you define. Express: optimized for sub-5-minute, high-throughput execution |
| **Scaling** | Fully automatic — no capacity to provision for either workflow type |
| **Security** | IAM role per state machine (least-privilege execution role), KMS encryption of execution data, resource-based policies not applicable (uses IAM only) |
| **High availability** | Regional managed service, multi-AZ by design |
| **Failure scenarios** | A state with no `Catch` and no `Retry` fails the entire execution on the first error; Express executions that fail leave **no execution-history UI record** by default — only what was sent to CloudWatch Logs |
| **Common mistakes** | Choosing Express for a workflow that can run longer than 5 minutes; not scoping the execution IAM role tightly (broad wildcard permissions on a workflow that touches many services); passing large payloads inline instead of by S3 reference, hitting the 256 KB limit; forgetting `Catch` on a state that can plausibly fail |
| **Exam traps** | Picking MWAA for "least operational overhead orchestration" (MWAA runs an always-on environment); picking Standard for "millions of short executions per second" (Express is correct, cost and throughput both favor it); picking EventBridge alone when the scenario needs branching/state |
| **Enterprise example** | A healthcare claims processor uses a Standard state machine to validate, enrich, and route each incoming claim: validate schema → Choice state on claim type → Parallel branch to run fraud-detection and eligibility-check simultaneously → Catch on any failure routes to a manual-review queue with full execution history preserved for audit, satisfying HIPAA traceability requirements |

---

<a name="standard-express"></a>
## 3. Standard vs Express workflows

| Attribute | **Standard** | **Express** |
|---|---|---|
| Max duration | **1 year** | **5 minutes** |
| Execution semantics | **Exactly-once** | **At-least-once** |
| Pricing model | Per **state transition** | Per **request + duration** (GB-seconds) |
| Cost profile | Cheaper at **low-to-moderate volume**, long-running workflows | Cheaper at **very high volume**, short-duration workflows |
| Execution history | ✅ Full visual history retained **90 days**, inspectable per-state in the console | ⚠️ Not retained by the service by default — must send to **CloudWatch Logs** for any record beyond real-time |
| Max throughput | Moderate (bound by state-transition cost/rate) | **Very high** — designed for 100,000+ executions/second |
| Typical use case | Nightly ETL DAG, order processing with human approval, long-running data pipelines | IoT telemetry transform-and-store, high-volume event processing, microservice orchestration |
| Idempotency requirement on tasks | Lower — exactly-once reduces (but doesn't eliminate at the task-integration level) duplicate-processing risk | **Required** — at-least-once means a task could run more than once |
| Distributed Map support | ✅ | ⚠️ Limited (Distributed Map is primarily a Standard feature at very large item counts) |

**The cost/duration/exactly-once-vs-at-least-once tradeoff, stated
plainly.** Standard costs per **state transition**, so a workflow with
few states but very long waits (a multi-day approval process) is
cheap — you're not paying for the wait, only the transitions. Express
costs per **request and duration (GB-seconds)**, closer to a Lambda
billing model, which becomes far cheaper than Standard's
per-transition cost the moment you're running **very large numbers of
short, frequent executions** — millions of 2-second workflows would be
prohibitively expensive under per-state-transition Standard pricing.
The semantics tradeoff is the other half of the decision: Standard's
**exactly-once** execution model means the state machine itself won't
duplicate an execution due to a service-side retry, which matters when
a workflow step is a **non-idempotent** action (e.g., "charge the
customer's card") — accidentally running that twice is a real
financial-correctness bug. Express's **at-least-once** model trades
that safety for throughput and cost, which is an acceptable trade the
instant every task in the workflow is naturally idempotent (writing to
a table with a deterministic key, for example).

```
   Long-running, few executions, needs exactly-once  ->  STANDARD
   Short (<5 min), millions of executions, idempotent ->  EXPRESS
   Needs 90-day inspectable execution history          ->  STANDARD
   Needs the absolute lowest cost at massive volume     ->  EXPRESS
```

---

<a name="map"></a>
## 4. Map state and Distributed Map

**Map state (standard, "inline" Map).** Iterates over an array already
present in the state's input, running the same set of states for each
item, with a configurable **concurrency** (`MaxConcurrency`). Good for
moderate collection sizes — hundreds to low thousands of items — where
the array fits comfortably in the 256 KB state payload limit.

```
   Input: ["item1", "item2", ..., "item500"]
        |
        v
   Map state (MaxConcurrency: 40)
        |
        +-- iteration for item1  --\
        +-- iteration for item2  ---+--> up to 40 running concurrently
        +-- ...                  --/
        |
        v
   Output: array of each iteration's result
```

**Distributed Map.** A separate, purpose-built Map mode designed for
**massive-scale parallel processing** — up to **10,000 concurrent child
workflow executions**, iterating over items that don't need to fit
inline in the payload at all: it can read its item list directly from
an **S3 bucket listing**, a **CSV/JSON/Parquet manifest file in S3**,
or the output of a prior state, sidestepping the 256 KB payload
constraint entirely. Each item's iteration runs as its own **child
workflow execution** (with its own execution history), which is what
makes 10,000-way concurrency and per-item observability possible at
once.

```
   S3 bucket: 2,000,000 small JSON objects to validate and load
        |
        v
   Distributed Map
     ItemReader: S3 (list objects, or read a manifest)
     MaxConcurrency: up to 10,000
        |
        +-- child execution 1: process object A
        +-- child execution 2: process object B
        +-- ...                                    (each with its own
        +-- child execution 10,000: process object   history/retry/Catch)
   |
   v
   ResultWriter: aggregated results written back to S3
```

| Attribute | **Map (inline)** | **Distributed Map** |
|---|---|---|
| Item source | Array in the state's own input/payload | S3 listing, S3 manifest file, or prior state output — **not payload-limited** |
| Max concurrency | Practically limited by payload/complexity | **Up to 10,000** concurrent child executions |
| Best item-count range | Tens to low thousands | **Thousands to millions** |
| Each iteration | Runs within the parent execution | Runs as its own **child execution** with independent history |
| Best use case | Moderate fan-out over data already in hand | Massive-scale S3 object processing, bulk file validation/transformation |
| Exam favorite trigger | "iterate over this list" | "process 10,000 S3 objects in parallel," "millions of files" |

---

<a name="errors"></a>
## 5. Error handling — Retry, Catch, backoff

**`Retry`** — declarative, automatic re-attempt of a failed state,
defined per error type, with **exponential backoff**:

```json
"Retry": [
  {
    "ErrorEquals": ["States.TaskFailed"],
    "IntervalSeconds": 2,
    "MaxAttempts": 4,
    "BackoffRate": 2.0
  }
]
```

Reading this: on `States.TaskFailed`, wait **2 seconds**, retry; if it
fails again, wait `2 * 2.0 = 4` seconds; then `8`; then `16` — up to
**4 total attempts** before giving up and moving to `Catch` (or
failing the execution if no `Catch` is defined). `BackoffRate` is the
multiplier applied to `IntervalSeconds` after each failed attempt —
this is Step Functions' native equivalent of the exponential-backoff
loops engineers otherwise hand-write.

**`Catch`** — declarative fallback transition when retries are
exhausted (or for error types you don't want retried at all, like a
validation error that will never succeed on retry):

```json
"Catch": [
  {
    "ErrorEquals": ["States.ALL"],
    "Next": "NotifyFailureAndQuarantine"
  }
]
```

`States.ALL` is a wildcard catching every error type — the fallback
safety net. More specific `ErrorEquals` values (a custom error thrown
by a Lambda, `States.Timeout`, `States.Permissions`) let a workflow
branch differently depending on **why** it failed — a permissions
error might page an engineer immediately, while a transient timeout
might just retry once more via a *different* Catch path.

**The pattern together:**

```
   Task: LoadToRedshift
        |
   Retry: 4 attempts, exponential backoff, on transient errors
        |  (all retries exhausted)
        v
   Catch: States.ALL --> Next: QuarantineAndAlert
```

**Senior engineer take.** `Retry` and `Catch` are why Step Functions
so often replaces what would otherwise be pages of Lambda
try/except/sleep code — the retry policy is declarative, versioned
with the state machine definition, and visible in the execution
history exactly which attempt succeeded or failed, which is far
better forensics than log-diving through Lambda invocations.

---

<a name="integrations"></a>
## 6. Service integrations

Step Functions has **200+ native service integrations** — meaning many
states can call an AWS service API **directly**, with no Lambda
function in between at all. Two integration patterns matter for the
exam:

| Pattern | Meaning | Example |
|---|---|---|
| **Request/Response** | Call the API, get the immediate response, move to next state | `glue:StartJobRun` fires and returns immediately with a run ID |
| **Run a Job (.sync)** | Call the API and **wait until the underlying job completes** before proceeding | `glue:StartJobRun.sync` — Step Functions polls/waits for the Glue job to actually finish (success or failure) before advancing |
| **Wait for Callback (.waitForTaskToken)** | Call the API, then **pause indefinitely** until an external process calls back with a task token | A human-approval step: send an email/Slack message containing a task token; the workflow pauses until someone calls `SendTaskSuccess`/`SendTaskFailure` with that token |

**Direct integrations relevant to DEA-C01 pipelines:** `glue:StartJobRun`
(with `.sync` to wait for real completion — critical, because without
`.sync` the workflow would advance immediately while the Glue job is
still running), `athena:StartQueryExecution`, `lambda:Invoke`,
`sns:Publish`, `sqs:SendMessage`, `dynamodb:PutItem`/`GetItem`,
`ecs:RunTask.sync`, `sagemaker:CreateTrainingJob.sync`, and
`states:StartExecution` (nested state machines, invoking another Step
Functions workflow from within one).

**The `.waitForTaskToken` pattern for human approval:**

```
   Task: RequestApproval  (SNS publish, contains a task token)
        |
   [ Execution PAUSES — no timeout unless configured ]
        |
        v (external system calls SendTaskSuccess/SendTaskFailure with the token)
   Choice: approved? --> Continue      |  Choice: rejected? --> Cancel
```

This is the direct answer whenever a scenario says **"pause the
pipeline for a human to approve before continuing"** — no polling loop,
no Lambda checking a database every minute; the workflow genuinely
suspends until the callback arrives (or a configured `Timeout` fires).

---

<a name="comparison"></a>
## 7. Step Functions vs MWAA vs EventBridge

The required 14-column comparison matrix (Step Functions vs its two
closest competitors for "orchestrate something"):

| Column | **Step Functions** | **MWAA (Airflow)** | **EventBridge** |
|---|---|---|---|
| **Purpose** | Stateful, branching workflow orchestration | Managed Apache Airflow — Python-authored DAGs | Content-based event routing (no state) |
| **Speed** | Near-instant state transitions | DAG scheduler interval-dependent (minutes typical) | Sub-second dispatch |
| **Cost** | Per state transition (Standard) or per request+duration (Express) | **Environment-hours — always-on, billed whether or not DAGs are running** | Per million custom events |
| **Serverless** | ✅ | ❌ (managed, but you size and pay for an environment) | ✅ |
| **Streaming support** | Via service integrations (e.g., Kinesis, Firehose calls) | Via operators/hooks (custom) | Via Pipes |
| **Batch support** | ✅ Map / Distributed Map | ✅ Core design (DAGs are inherently batch-oriented) | ❌ |
| **Data volume** | High, especially Express | Depends on worker sizing | High |
| **Latency** | Milliseconds between states | Scheduler-poll-interval bound | Milliseconds |
| **Scaling** | Fully automatic | You size workers/environment class | Fully automatic |
| **Monitoring** | Execution history (Standard, 90 days), CloudWatch | Airflow UI, task logs, CloudWatch | CloudWatch metrics |
| **Security** | IAM execution role per state machine | IAM + Airflow RBAC, VPC-only environment | IAM + bus resource policy |
| **Best use case** | Serverless pipelines needing retries, branching, audit trail | Existing Airflow DAGs, complex Python dependency graphs, teams with Airflow expertise | Simple content-based routing, scheduling |
| **When NOT to use** | Very high-volume simple pass-through with no state need | Cost-sensitive, no existing Airflow investment | Needs state/branching |
| **Exam favorite** | "least operational overhead orchestration," "state," "retries," "human approval" | "existing Airflow DAGs," "team knows Airflow," "complex Python dependencies" | "route based on content," "simple schedule" |

### When Step Functions wins over MWAA

Step Functions wins whenever the requirement is **simpler DAGs** with
**no existing Airflow investment** and no need for **Python-based DAG
authoring** specifically. MWAA runs an **always-on environment** —
you're paying environment-hours whether or not a DAG is actively
running, which makes it **never the "least operational overhead"
answer** on this exam. MWAA becomes correct the moment a scenario says
**"the team already has Airflow DAGs"**, **"complex Python
dependencies in the orchestration logic"** (custom operators, dynamic
task generation driven by Python code, existing Airflow provider
plugins), or **"standardize on Airflow across the org."** Absent those
specific triggers, a serverless, native-AWS-service-integrated Step
Functions state machine is simpler to build, cheaper to run
(especially with intermittent workloads — zero idle cost), and
requires no environment sizing or patching.

```
   New pipeline, AWS-native services, no Airflow legacy  -->  STEP FUNCTIONS
   Existing Airflow DAGs, Python-heavy custom operators   -->  MWAA
   Cost-sensitive, intermittent workload                  -->  STEP FUNCTIONS
     (MWAA bills environment-hours even when idle)
```

### When Step Functions wins over EventBridge

Covered in depth in the EventBridge service file's comparison section;
restated from this side: Step Functions wins the moment the workflow
needs **state tracked across multiple steps** — branching on an
intermediate result, retrying a specific failed step without
restarting the whole thing, or a human-approval wait. EventBridge has
no concept of "we are currently on step 3"; Step Functions' entire
design center is exactly that.

---

<a name="tree"></a>
## 8. Decision tree

```
                 Does the workflow need to remember WHERE
                 it is across multiple steps, or branch on
                 an intermediate result?
                              |
                +-------------+--------------+
              YES                           NO
                |                             |
   Existing Airflow DAGs /          Simple one-hop routing?
   complex Python DAG authoring              |
   already in place?                +--------+--------+
                |                  YES                 NO (still a small
        +-------+-------+           |                  chain, no state)
       YES              NO      EVENTBRIDGE                  |
        |                |       alone                 EVENTBRIDGE triggers
      MWAA          STEP FUNCTIONS                      a couple of direct
                          |                              service calls, or
                 How long / how many                     a lightweight
                 executions?                              Lambda chain
                          |
              +-----------+-----------+
        Long-running,            Short (<5 min),
        few executions,          millions of executions,
        exactly-once needed      idempotent tasks OK
              |                             |
          STANDARD                      EXPRESS
              |
    Processing 1,000s-millions
    of individual items (S3
    objects, files)?
              |
             YES --> DISTRIBUTED MAP
```

---

<a name="prod"></a>
## 9. Production architecture

```
   +----------------+
   | EventBridge     |--(new file lands in "raw/" prefix)-->
   | rule            |
   +----------------+
                       |
                       v
   +-----------------------------------------------------------------+
   |                  STEP FUNCTIONS — STANDARD WORKFLOW              |
   |                                                                   |
   |  Task: glue:StartJobRun.sync  (validate + clean the file)         |
   |         |                                                        |
   |    Retry: 3x, exponential backoff, on transient Glue errors       |
   |         |  (exhausted) --> Catch --> QuarantineAndAlert            |
   |         v                                                        |
   |  Choice: file type?                                              |
   |     +---- "large batch" ----> DISTRIBUTED MAP                    |
   |     |                          ItemReader: S3 manifest             |
   |     |                          MaxConcurrency: 5,000                |
   |     |                          each item: athena:StartQueryExecution|
   |     |                                                              |
   |     +---- "small file" -----> Task: lambda:Invoke (transform)      |
   |                                                                     |
   |         v  (both paths converge)                                  |
   |  Task: RequestApproval (.waitForTaskToken) -- pauses for a human   |
   |         |  approved                    |  rejected                |
   |         v                              v                          |
   |  Task: redshift-data:ExecuteStatement.sync   Task: sns:Publish     |
   |  (load to warehouse)                          (notify + cancel)   |
   +-----------------------------------------------------------------+
```

**Reading the diagram.** An **EventBridge rule** is the simple,
stateless trigger — it doesn't try to track anything, it just starts
the Step Functions execution the moment a file lands, which is exactly
the "EventBridge for routing, Step Functions for state" split this
file has emphasized throughout. Inside the **Standard** workflow (the
correct choice here because the process is long-running end-to-end and
must not double-execute a payment-adjacent load), the first `Task` uses
`.sync` on `glue:StartJobRun` so the workflow genuinely **waits** for
the Glue job to finish rather than racing ahead — with `Retry`
declared for transient failures and a `Catch` fallback to quarantine
after retries are exhausted. A `Choice` state branches based on file
size/type: large batches go through **Distributed Map**, fanning out
to thousands of concurrent Athena query executions read from an S3
manifest (sidestepping the 256 KB inline-payload limit entirely);
small files take a simpler direct Lambda path. Both paths converge on
a **`.waitForTaskToken`** human-approval step, which genuinely
**suspends** the execution — no polling — until an approver calls back,
after which the workflow branches again into either a Redshift load or
a cancellation notice.

---

<a name="traps"></a>
## 10. Exam traps

- ⚠️ Picking **Express** for a workflow whose duration could exceed **5
  minutes** — Express fails/truncates past that ceiling; Standard is
  required for anything long-running.
- ⚠️ Picking **Standard** for "millions of short executions per
  second" purely out of habit — **Express** is both cheaper and
  purpose-built for that volume/duration profile.
- ⚠️ Calling `glue:StartJobRun` **without `.sync`** when the workflow
  needs to wait for the actual job result before proceeding — without
  `.sync`, the state returns immediately with just a run ID, and the
  workflow advances while the Glue job is still running.
- ⚠️ Forgetting that Express executions are **at-least-once** — a task
  invoked twice due to a retry must be **idempotent**, or duplicate
  side effects (double charges, duplicate rows) result.
- ⚠️ Passing a large array or blob **inline** in the state input/output
  and hitting the **256 KB** payload limit — the fix is passing an **S3
  reference** instead, or using **Distributed Map**'s `ItemReader`
  which reads directly from S3.
- ⚠️ Picking **MWAA** when the stem says "least operational overhead" —
  MWAA's always-on environment-hours billing disqualifies it unless
  the scenario specifically mentions existing Airflow DAGs or Python
  dependency complexity.
- ⚠️ Omitting `Catch` on a state that can realistically fail — with no
  `Catch`, the **entire execution fails** the moment that state errors,
  with no graceful fallback path.
- ⚠️ Using inline **Map** for a genuinely massive item count (hundreds
  of thousands to millions) instead of **Distributed Map** — inline Map
  is payload-limited and not designed for that scale.

---

<a name="interview"></a>
## 11. Interview questions

- *"When would you choose Express over Standard, and what do you give
  up?"* — Express when volume is very high and each execution is
  short (under 5 minutes); you give up the 90-day inspectable
  execution history (must route to CloudWatch Logs yourself) and
  exactly-once guarantees, so every task must be idempotent.
- *"How does `.sync` change the behavior of a service-integration
  task, and why does it matter for a Glue job?"* — Without `.sync`,
  the state returns as soon as the API call itself succeeds (job
  *started*, not *finished*), and the workflow proceeds immediately;
  with `.sync`, Step Functions polls/waits for the underlying job to
  actually complete (success or failure) before advancing, which
  matters whenever a downstream state depends on the Glue job's
  output actually existing.
- *"Walk me through how you'd implement a human-approval gate in a
  data pipeline without polling."* — A Task using
  `.waitForTaskToken`, publishing an approval request (email, Slack,
  SNS) containing the task token; the execution genuinely pauses
  (no compute cost, no polling) until an external system calls
  `SendTaskSuccess`/`SendTaskFailure` with that token, optionally
  bounded by a `Timeout`/`HeartbeatSeconds`.
- *"Why might Distributed Map be necessary instead of a regular Map
  state for a data lake reprocessing job?"* — If the item count is in
  the thousands to millions (S3 objects to validate/reprocess), a
  regular Map state's reliance on an inline array would exceed the 256
  KB state-payload limit and cap concurrency impractically; Distributed
  Map reads directly from an S3 listing/manifest and supports up to
  10,000 concurrent child executions, each with its own execution
  history.

---

<a name="cheat"></a>
## 12. Cheat sheet

```
STEP FUNCTIONS ONE-LINERS
  long-running, exactly-once, few executions ......... STANDARD
  short (<5 min), millions of executions, cheap ...... EXPRESS
  iterate a moderate list already in the payload ...... Map (inline)
  process thousands-to-millions of S3 objects ......... DISTRIBUTED MAP
  wait for a Glue/EMR/SageMaker job to ACTUALLY finish . .sync integration
  pause indefinitely for a human/external callback .... .waitForTaskToken
  retry a failing step with exponential backoff ....... Retry (IntervalSeconds/BackoffRate)
  graceful fallback after retries are exhausted ....... Catch (ErrorEquals/Next)
  simple one-hop routing, no state needed ............. EventBridge alone, not SFN
  existing Airflow DAGs, Python-heavy ................. MWAA, not SFN
  chain only Glue jobs/crawlers, free .................. Glue Workflows, not SFN
```

---

<a name="mnemonics"></a>
## 13. Mnemonics

- **"Standard remembers, Express is fast and forgets (mostly)."**
  Standard keeps 90-day history and exactly-once; Express optimizes
  for volume and doesn't persist history natively.
- **".sync means 'don't move on without me.'"** The integration
  pattern that waits for real completion, not just API-call success.
- **"MWAA is never free to idle."** Environment-hours bill whether or
  not a DAG runs — the reason it's disqualified from "least
  operational overhead" answers by default.
- **"Retry tries again. Catch catches the fall."** Retry is the
  same-state retry loop; Catch is the transition to a different state
  after retries fail.

---

<a name="questions"></a>
## 14. Practice questions (15, scenario-style, every option explained)

**1.** A nightly ETL pipeline runs for up to 4 hours and must never
execute twice for the same trigger (it charges a downstream billing
API). Which workflow type is correct?

- A) Express, because it's cheaper
- B) Standard, because of the exactly-once guarantee and the duration
  exceeding 5 minutes **← correct**
- C) Express with idempotency keys added manually
- D) Either type works identically for this use case

*A is wrong on two counts — Express caps at 5 minutes (this workflow
runs 4 hours) and doesn't guarantee exactly-once. B is correct — the
duration alone rules out Express, and the "must never execute twice"
requirement specifically wants Standard's exactly-once semantics. C
doesn't fix the 5-minute ceiling problem. D ignores the real
functional differences between the two types.*

**2.** A workflow needs to process 3 million individual S3 objects,
running a validation Lambda against each, with up to 8,000 running
concurrently. Which Step Functions feature is designed for this?

- A) A regular Map state with an inline array of all 3 million keys
- B) Distributed Map, reading item list from an S3 listing/manifest **← correct**
- C) A Parallel state with 3 million branches
- D) Express workflow with a for-loop implemented in a single Lambda

*A would blow past the 256 KB state payload limit almost immediately
and cannot practically hold 3 million keys inline. B is correct —
this is exactly Distributed Map's designed use case: massive item
counts read directly from S3, up to 10,000 concurrent child
executions. C is wrong — Parallel is for a small, fixed number of
distinct named branches, not a dynamic large collection. D
reimplements iteration inside a single function, losing per-item
retry/Catch/observability and hitting Express's 5-minute ceiling long
before 3 million items are processed serially.*

**3.** A `Task` state calls `glue:StartJobRun` without `.sync`. What
happens?

- A) The workflow waits until the Glue job completes before advancing
- B) The state returns as soon as the job is *started*, and the
  workflow advances immediately, potentially before the job finishes **← correct**
- C) The call fails validation because `.sync` is mandatory for Glue
- D) The Glue job runs synchronously inside the Step Functions
  execution's own compute

*A describes `.sync` behavior, which was NOT used here. B is correct —
without `.sync`, the integration is request/response: it returns once
the StartJobRun API call itself succeeds, not once the underlying job
finishes, so any downstream state depending on the job's output could
run prematurely. C is wrong — `.sync` is optional, not mandatory,
though often needed for correctness. D misdescribes the execution
model — Glue runs as its own managed job, not inside Step Functions'
runtime.*

**4.** A `Task` state has `Retry` configured for `States.TaskFailed`
with `MaxAttempts: 3` but no `Catch` block. What happens if all 3
retries fail?

- A) The state silently succeeds with an empty output
- B) The entire execution fails **← correct**
- C) The workflow automatically retries indefinitely
- D) The next state in the sequence runs anyway with null input

*A is wrong — failure does not silently become success. B is correct —
with no `Catch` to provide a fallback transition, exhausting all
retry attempts fails the whole execution; this is exactly why a
`Catch` with `States.ALL` is recommended as a safety net. C is wrong —
`MaxAttempts` is a hard ceiling, not indefinite retry. D is wrong —
there is no "run the next state anyway" default behavior on failure.*

**5.** Which scenario correctly justifies choosing MWAA over Step
Functions?

- A) "Least operational overhead, cost-sensitive, brand-new pipeline"
- B) "The team has 200 existing Airflow DAGs with custom Python
  operators and wants to migrate them to AWS with minimal rewrite" **← correct**
- C) "Millions of short executions per second"
- D) "A simple two-step pipeline with no branching"

*A is wrong — MWAA's always-on environment-hours billing is the
opposite of low operational overhead/cost for a new pipeline. B is
correct — existing Airflow DAGs and complex Python-based authoring is
specifically the trigger phrase for MWAA on this exam. C strongly
favors Step Functions Express, not MWAA. D is simple enough that
Step Functions (or even EventBridge alone) is the leaner choice.*

**6.** What is the correct mechanism to implement a "pause the
pipeline until a manager clicks approve" step without polling a
database?

- A) A Wait state configured for a fixed 24-hour delay
- B) A Task using the `.waitForTaskToken` integration pattern **← correct**
- C) A Lambda function that loops calling `DescribeExecution` every
  minute
- D) A Choice state that re-evaluates every 5 minutes via EventBridge
  Scheduler

*A is wrong — a fixed delay isn't an approval gate, it's a timer with
no actual dependency on a human action. B is correct — `.waitForTaskToken`
suspends the execution with no polling and no compute cost until an
external caller invokes `SendTaskSuccess`/`SendTaskFailure` with the
token. C reimplements polling manually, which is exactly what this
pattern avoids. D adds unnecessary complexity and still isn't a true
event-driven pause.*

**7.** A team is deciding between EventBridge alone and Step Functions
for: "when a Kinesis alarm fires, notify the on-call team." No
branching, no retries beyond the default, no state tracking needed.
What's correct?

- A) Step Functions Standard, for the execution history
- B) EventBridge rule alone, invoking SNS directly **← correct**
- C) Step Functions Express, for the lower cost
- D) MWAA, scheduled every minute to check alarm state

*A adds orchestration overhead for a single-hop notification with no
state need. B is correct — this is precisely the "simple routing, no
state" case where EventBridge alone is the leaner, cheaper, correct
answer. C still introduces unnecessary orchestration machinery for a
one-step notification. D is wildly inappropriate — polling-based
scheduling for something that should be event-driven, and MWAA's
always-on cost besides.*

**8.** Why is Express workflow execution described as "at-least-once"
rather than "exactly-once"?

- A) Because Express workflows always run every state twice for
  redundancy
- B) Because Express prioritizes throughput/cost, and the underlying
  delivery/retry mechanics can invoke a task more than once under
  certain failure conditions, requiring idempotent tasks **← correct**
- C) Because Express workflows cannot use the Retry field
- D) Because Express workflows do not support Lambda integrations

*A is a fabricated mechanism — there's no automatic double-run design.
B is correct — the exactly-once guarantee is a Standard-specific
design property; Express trades that guarantee for lower cost and
higher throughput, meaning every task in an Express workflow should be
written to tolerate being invoked more than once. C is wrong — Retry
is available in both types. D is false — Lambda is a fully supported
Express integration.*

**9.** A Distributed Map state's `ItemReader` is configured to read
from an S3 manifest file listing 500,000 objects. What is the primary
architectural benefit over an inline Map state here?

- A) Distributed Map runs faster per item than inline Map
- B) It avoids the 256 KB state payload limit and supports up to
  10,000 concurrent child executions with independent history **← correct**
- C) It eliminates the need for any IAM permissions on S3
- D) It automatically converts the objects to Parquet before processing

*A is not a guaranteed or claimed property — per-item speed depends on
the task itself, not the Map mode. B is correct — this is the concrete
architectural reason: 500,000 items would never fit in an inline
array within the payload limit, and Distributed Map's child-execution
model provides real per-item observability at scale. C is false — IAM
permissions to read the manifest and the objects are still required.
D is a fabricated capability with no basis in the feature.*

**10.** Which pricing statement about Step Functions Standard is
accurate?

- A) Billed per GB-second of compute duration
- B) Billed per state transition **← correct**
- C) Billed at a flat monthly rate regardless of usage
- D) Billed only for failed executions

*A describes Express's cost model, not Standard's. B is correct —
Standard's defining cost unit is the state transition, which is why
long-running-but-few-transitions workflows (like ones with long Wait
states) stay cheap under Standard. C is wrong — both types are
usage-based. D is nonsensical — successful executions are billed too.*

**11.** A workflow's `Catch` block specifies `"ErrorEquals":
["States.ALL"]`. What does this configuration do?

- A) Retries every error type indefinitely before catching
- B) Catches every possible error type as a fallback safety net,
  regardless of the specific cause **← correct**
- C) Only catches errors explicitly thrown by a custom Lambda
- D) Disables all error handling for that state

*A conflates Retry and Catch — `States.ALL` in a Catch block doesn't
imply infinite retries; it's the wildcard for the catch itself. B is
correct — `States.ALL` is the broadest possible error matcher, commonly
used as a final fallback after more specific Catch blocks have been
tried. C is too narrow — `States.ALL` covers built-in Step Functions
errors too (timeouts, permissions, task failures), not just custom
Lambda errors. D is the opposite of what a Catch block does.*

**12.** A data engineer needs to call an Athena query and have the
workflow wait for the query to actually complete (not just start)
before moving to the next state that reads the query results. What
should the Task state use?

- A) `athena:StartQueryExecution` (default, request/response)
- B) `athena:StartQueryExecution.sync` **← correct**
- C) A Wait state with a fixed 60-second delay after starting the query
- D) `athena:GetQueryResults` called immediately after starting the query

*A only starts the query and returns immediately with a query
execution ID — the workflow would advance before the query finishes.
B is correct — the `.sync` suffix makes Step Functions poll/wait for
the underlying Athena query to actually complete before advancing,
mirroring the Glue `.sync` pattern covered earlier in this file. C is
a fragile guess-based delay that could be too short (query still
running) or wastefully too long. D would likely fail or return
incomplete results since the query may not have finished.*

**13.** Which statement correctly contrasts Step Functions and Glue
Workflows for orchestration?

- A) Glue Workflows can orchestrate Lambda, SNS, and Redshift calls
  just like Step Functions
- B) Glue Workflows are free but limited to chaining Glue jobs and
  crawlers; Step Functions is broader (200+ service integrations) but
  billed per transition/request **← correct**
- C) Step Functions cannot invoke Glue jobs at all
- D) Glue Workflows support Distributed Map-style massive fan-out

*A is wrong — Glue Workflows are scoped specifically to Glue jobs,
triggers, and crawlers, not arbitrary service calls. B is correct —
this is the accurate tradeoff: Glue Workflows are the free, narrow
option for pure-Glue pipelines; Step Functions is the broader,
billed orchestration layer for anything beyond that. C is false —
`glue:StartJobRun`/`.sync` is a core, commonly tested integration. D
is false — that scale of fan-out is a Step Functions Distributed Map
feature, not something Glue Workflows offers.*

**14.** In a Standard workflow, why might a 256 KB payload limit
become a practical problem, and what's the standard fix?

- A) It's never a problem because Standard has no payload limit
- B) Passing large datasets or arrays inline can exceed the limit; the
  fix is passing an S3 object reference (key/path) instead of the raw
  data itself **← correct**
- C) The fix is switching to Express, which has no payload limit
- D) The fix is compressing the JSON payload with gzip before passing
  it between states

*A is false — the 256 KB limit applies to Standard (and Express) state
input/output. B is correct — the idiomatic Step Functions pattern for
large data is to pass a lightweight reference (an S3 URI) between
states and have each Task read/write the actual data directly from/to
S3, keeping the state payload itself small. C is wrong — Express has
the same payload constraint. D is not how Step Functions payloads
work — you can't arbitrarily gzip the state's JSON and expect
downstream states to transparently decompress it.*

**15.** A batch pipeline occasionally needs to retry a failing
Redshift COPY step up to 5 times, waiting progressively longer between
attempts, before giving up and alerting the team. Which combination of
ASL fields implements this correctly?

- A) `Wait` state before the Redshift Task, fixed 5-minute delay,
  looped manually with a Choice state
- B) `Retry` with `IntervalSeconds`, `MaxAttempts: 5`, and a
  `BackoffRate` greater than 1, plus a `Catch` transitioning to an
  alerting state after retries are exhausted **← correct**
- C) `Parallel` state running the Redshift Task 5 times simultaneously
- D) Five separate sequential Task states each calling the same
  Redshift COPY

*A manually reimplements what Retry/Catch do natively, and a fixed
delay doesn't provide the "progressively longer" (backoff) behavior
requested. B is correct — this is exactly the declarative
Retry-with-exponential-backoff-then-Catch pattern this file
describes, requiring no manual looping logic. C is wrong — running 5
attempts in parallel isn't a retry-after-failure pattern, and could
trigger the COPY 5 times concurrently, which is incorrect and
wasteful. D works but is unmaintainable boilerplate compared to a
single `Retry` block, and provides no automatic backoff between
attempts.*
