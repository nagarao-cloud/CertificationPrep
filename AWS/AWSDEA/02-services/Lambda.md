# AWS Lambda for Data Engineering

> Lambda shows up constantly in DEA-C01 pipelines — not as the heavy-lift
> transformation engine (that's Glue/EMR), but as the event-driven glue
> code: S3-triggered file processing, stream micro-batch consumers,
> lightweight enrichment, and orchestration steps. This file covers event
> sources for data pipelines, concurrency, the hard resource walls, EFS
> mounting, cold starts, error handling, and the cost model.

## CONTENTS

- [1. Explain like I'm 12](#eli12)
- [2. Explain technically](#technical)
- [3. Explain like a Senior AWS Data Engineer](#senior)
- [4. Production architecture](#architecture)
- [5. Event sources for data pipelines](#eventsources)
- [6. Concurrency: reserved vs provisioned](#concurrency)
- [7. The hard walls](#hardwalls)
- [8. EFS mounting](#efs)
- [9. Cold starts](#coldstarts)
- [10. Error handling, DLQs, and retries](#errors)
- [11. Cost model](#cost)
- [12. When to use / when NOT to use](#whentouse)
- [13. Advantages and limitations](#advlim)
- [14. Performance, scaling, and high availability](#perfscale)
- [15. Security](#security)
- [16. Failure scenarios and common mistakes](#failures)
- [17. Exam traps](#examtraps)
- [18. Interview questions](#interview)
- [19. Cheat sheet](#cheatsheet)
- [20. Memory tricks](#mnemonics)
- [21. Practice questions (15)](#practice)

---

<a name="eli12"></a>
## 1. Explain like I'm 12

Imagine a light switch that summons a tiny robot the instant you flip
it, the robot does exactly one small job, then vanishes — you never pay
rent for a robot standing around waiting. That's AWS Lambda: code that
runs only when something happens (a file lands in S3, a new record
appears in a stream, a schedule fires) and disappears the moment it's
done. It's perfect for quick jobs — "a new file arrived, go check it and
kick off the next step" — but it's the wrong robot for a job that takes
hours, because this robot is only allowed to work for 15 minutes at a
stretch before it has to stop.

<a name="technical"></a>
## 2. Explain technically

AWS Lambda is a serverless, event-driven compute service: you supply a
function (code + a handler), Lambda manages the execution environment
(provisioning, scaling, patching, teardown) and invokes your function in
response to **events** — synchronously (API Gateway, another Lambda),
asynchronously (S3 event notifications, SNS, EventBridge), or via a
**poll-based event source mapping** (Kinesis Data Streams, DynamoDB
Streams, SQS, MSK/Kafka) where Lambda's own polling infrastructure reads
batches of records and invokes the function per batch. In data
engineering pipelines, Lambda's role is almost always one of: (1) a
lightweight per-event transform/validation/routing step, (2) a stream
consumer applying business logic to a micro-batch, (3) an orchestration
glue step between heavier services (start a Glue job, poll a Step
Functions state, send a notification), or (4) file-arrival-triggered
processing (an S3 `ObjectCreated` event kicks off validation, format
conversion, or a downstream job trigger).

<a name="senior"></a>
## 3. Explain like a Senior AWS Data Engineer

A senior engineer's mental model for Lambda in a data pipeline is
**"glue and triggers, not heavy lifting."** The recurring exam-relevant
judgment call is recognizing when a scenario has silently exceeded
Lambda's operating envelope — a "transform each file as it lands"
requirement sounds Lambda-shaped until the files turn out to be
multi-gigabyte Parquet files needing a Spark-style join, at which point
the correct answer becomes "Lambda triggers a Glue job" rather than
"Lambda does the transform itself." Two other senior-level habits the
exam rewards: **treating asynchronous invocation failure handling as
mandatory design, not an afterthought** — an async Lambda (S3 event,
SNS) retries automatically twice with backoff and then, without a
configured on-failure destination or DLQ, the failed event is simply
gone; and **understanding that event source mapping error handling for
Kinesis/DynamoDB Streams is fundamentally different from async
invocation** — a poison-pill record in a stream, without bisecting batch
on error and a maximum retry configuration, can block the entire shard's
iterator from advancing, stalling every record behind it, which is a
production incident, not a minor bug.

<a name="architecture"></a>
## 4. Production architecture

```
   ┌───────────────┐   ┌──────────────────┐   ┌─────────────────┐
   │  S3 ObjectCreated│  │ Kinesis Data     │   │ DynamoDB Streams │
   │  event           │  │ Streams shard    │   │ (table changes)  │
   └────────┬─────────┘  └────────┬─────────┘   └────────┬─────────┘
            │  async invoke        │  poll-based event source mapping
            v                      v                       v
   ┌──────────────────────────────────────────────────────────────┐
   │                        AWS LAMBDA FUNCTION                     │
   │   handler(event, context):                                    │
   │     validate → transform → write to S3/DynamoDB/downstream    │
   │   Reserved concurrency caps parallel executions;               │
   │   Provisioned concurrency keeps N warm to avoid cold starts    │
   └──────────┬───────────────────────────────────┬───────────────-┘
              │ success                             │ failure (async)
              v                                     v
   ┌────────────────────┐                ┌───────────────────────┐
   │ Downstream target:   │                │ On-failure destination │
   │ S3 curated zone,     │                │ or DLQ (SQS/SNS) for   │
   │ triggers next Glue   │                │ manual inspection/     │
   │ job via Step Functions│                │ reprocessing           │
   └────────────────────┘                └───────────────────────┘
```

Reading the diagram: three different trigger patterns feed Lambda — an
S3 event (asynchronous invocation, Lambda's own automatic retry policy
applies), a Kinesis shard (poll-based event source mapping, Lambda's
internal poller reads batches and invokes synchronously per batch, with
its own retry/error-handling configuration), and DynamoDB Streams (same
poll-based model). Inside the function, validate/transform/write logic
runs within the function's timeout and memory budget. On success, output
lands in a downstream target — commonly triggering the next pipeline
stage (a Glue job start, a Step Functions execution). On failure,
**async** invocations route to a configured on-failure destination or a
dead-letter queue after Lambda's automatic retries are exhausted, so
failed events are inspectable and reprocessable rather than silently
dropped — this failure path is the piece most often missing from a
naive design, and the piece the exam most often tests.

---

<a name="eventsources"></a>
## 5. Event sources for data pipelines

| Source | Invocation model | Data-engineering use | Key behavior |
|---|---|---|---|
| **S3 event notifications** (`ObjectCreated`, etc.) | Asynchronous | File-arrival-triggered validation/processing/routing | Automatic retry (2x) on function error, then to configured destination/DLQ if set, else the event is lost |
| **Kinesis Data Streams** | Poll-based event source mapping | Micro-batch stream consumer applying transform/enrichment logic | Reads records in order per shard; a persistent processing error can block the shard unless bisect-on-error and max retry attempts are configured |
| **DynamoDB Streams** | Poll-based event source mapping | React to table changes — replicate, fan out, trigger downstream ETL | Same shard-blocking risk as Kinesis if unhandled |
| **SQS** | Poll-based event source mapping | Decoupled, buffered work queue consumption | Failed messages become visible again after visibility timeout; a redrive policy sends them to a DLQ after N failures |
| **MSK / self-managed Kafka** | Poll-based event source mapping | Kafka-based stream consumer | Similar batch/order semantics to Kinesis, per-partition |
| **EventBridge (schedule or event pattern)** | Asynchronous | Cron-style triggers, cross-service event routing (e.g., "on Glue job SUCCEEDED, invoke Lambda to notify") | — |
| **Step Functions task** | Synchronous (within the state machine) | A pipeline step needing custom logic between heavier orchestrated stages | State machine itself handles retry/catch |

<a name="concurrency"></a>
## 6. Concurrency: reserved vs provisioned

- **Reserved concurrency** — sets both a **guarantee** (this function
  always has this many concurrent executions available) and a **ceiling**
  (this function can never exceed this many concurrent executions,
  throttling further invocations). Used to protect a downstream resource
  with a hard connection limit (e.g., a small RDS instance) from being
  overwhelmed by a burst of Lambda invocations, and/or to guarantee
  capacity for a critical function isn't starved by other functions
  competing for the account's shared concurrency pool.
- **Provisioned concurrency** — keeps a specified number of execution
  environments pre-initialized and warm, eliminating cold start latency
  for that many concurrent invocations. Used when a function has strict
  low-latency requirements (e.g., synchronous API-backing use) and cold
  starts are unacceptable; costs more since you pay for the warm capacity
  whether invoked or not.
- **Account-level concurrency** — a soft limit (default 1,000 concurrent
  executions per Region per account, increasable via support request)
  shared across all functions unless carved out by reserved concurrency.

⚠️ **Exam trap:** reserved concurrency does not reduce cold starts — it
only caps/guarantees *how many* concurrent executions are allowed.
Provisioned concurrency is the one that keeps environments warm. Mixing
these two up is a very common wrong-answer pattern.

<a name="hardwalls"></a>
## 7. The hard walls

| Limit | Value | Implication |
|---|---|---|
| Max execution timeout | **15 minutes** | Long-running transforms (heavy Spark-style joins, large file processing) don't fit — hand off to Glue/EMR/Step Functions instead |
| Max memory | **10,240 MB (10 GB)** | vCPU allocation scales with memory; memory-bound transforms have a hard ceiling |
| Max ephemeral `/tmp` storage | **10,240 MB (10 GB)**, configurable up from a 512 MB default | Large temp file processing (e.g., decompressing/staging a file before upload) is bounded unless EFS is mounted |
| Deployment package (zip, direct upload) | 50 MB zipped | Small dependency footprint required for direct zip upload |
| Deployment package (zip, via S3) | 250 MB unzipped | Larger dependency trees (e.g., pandas, numpy) often need this path or a container image |
| Container image | Up to 10 GB | The path for large dependencies (ML libraries, big SDKs) beyond zip limits |
| Payload size (sync invoke) | 6 MB | Large records/files should be passed by S3 reference, not inline in the payload |
| Payload size (async invoke) | 256 KB | Even tighter — reinforces "pass a pointer, not the data" |

⚠️ **Exam trap:** a scenario describing a job that "sometimes runs over
15 minutes" or "occasionally processes multi-gigabyte files" is
signaling that Lambda is the *wrong* service — the expected answer
migrates that step to Glue, EMR, Fargate, or Step Functions (breaking the
work into smaller Lambda-sized chunks), not "increase the Lambda
timeout" (which is capped at 15 minutes with no way to raise it further).

<a name="efs"></a>
## 8. EFS mounting

Lambda can mount an **Amazon EFS** file system at execution time, giving
a function access to a shared, persistent, POSIX filesystem far larger
than the 10 GB `/tmp` ceiling — used for large, shared reference data a
function needs to read repeatedly (e.g., an ML model too large for the
deployment package or `/tmp`, or a shared lookup dataset accessed by many
concurrent invocations without re-downloading it each time from S3).
EFS mounting requires the function to run inside a VPC (with the
appropriate subnet/security-group/mount-target configuration) and adds a
small amount of cold-start latency for the mount setup.

<a name="coldstarts"></a>
## 9. Cold starts

A **cold start** is the latency incurred when Lambda must initialize a
new execution environment (download code, start the runtime, run
initialization code outside the handler) before the first invocation can
run — subsequent invocations reusing the same warm environment skip this
cost. Cold starts are worsened by: large deployment packages, VPC
attachment (historically a bigger penalty; improved significantly by
Hyperplane ENIs, but still non-zero, especially with EFS mounts),
heavyweight SDK/library initialization in global scope, and
higher-memory runtime/language choices (interpreted languages like
Python/Node.js generally cold-start faster than JVM-based runtimes like
Java, which have heavier startup). Mitigations: **provisioned
concurrency** for latency-critical functions, keeping deployment
packages lean, initializing SDK clients/connections outside the handler
(so they're reused across warm invocations of the same environment), and
choosing container image size carefully if using that deployment path.

<a name="errors"></a>
## 10. Error handling, DLQs, and retries

| Invocation type | Default retry behavior | Failure destination options |
|---|---|---|
| **Synchronous** (API Gateway, direct invoke) | No automatic retry by Lambda — caller must handle it | Caller-side retry logic |
| **Asynchronous** (S3 events, SNS, EventBridge) | Automatic retry **twice**, with a delay between attempts | On-failure **Destination** (SQS, SNS, Lambda, EventBridge) or a legacy **DLQ** (SQS/SNS) configured on the function |
| **Poll-based event source mapping** (Kinesis, DynamoDB Streams, SQS, MSK) | Configurable — retry attempts, maximum record age, **bisect batch on function error** (splits a failing batch to isolate the poison-pill record), and an on-failure destination for discarded records | Per-event-source-mapping configuration, not the function-level DLQ setting |

⚠️ **Exam trap:** for **Kinesis/DynamoDB Streams**, an unhandled,
persistently-erroring record can **block the shard's iterator** — every
record behind it waits — unless the event source mapping is configured
with `BisectBatchOnFunctionError` and a `MaximumRetryAttempts` /
`MaximumRecordAgeInSeconds` ceiling plus an on-failure destination to
route the poison record out of the way. This is functionally different
from SQS, where each message has its own visibility timeout and redrive
policy independent of other messages — order matters for streams, not
for standard SQS.

<a name="cost"></a>
## 11. Cost model

Billed on two dimensions: **number of requests** (per invocation) and
**duration** (GB-seconds — memory allocated x execution time, rounded to
the nearest millisecond), plus a free tier (1M requests and 400,000
GB-seconds per month, perpetually free, not just first-year). Higher
memory allocation increases cost per millisecond but also increases
allocated vCPU proportionally, which can *reduce* total cost if it cuts
execution time enough — a genuine tuning exercise, not "always pick the
lowest memory to save money." Provisioned concurrency adds a separate
charge for the warm capacity reserved, billed whether invoked or not.

---

<a name="whentouse"></a>
## 12. When to use / when NOT to use

**Use Lambda when:** the workload is event-driven and short (well under
15 minutes); it's glue/orchestration logic between heavier services;
it's a lightweight per-record or per-file transform, validation, or
routing step; you want zero infrastructure management and pay-per-use
billing for spiky or unpredictable invocation patterns.

**Do NOT use Lambda when:** the job routinely runs longer than 15
minutes or needs more than 10 GB memory/`/tmp`; the workload is a
heavy, distributed Spark-style transform (use Glue/EMR); you need a
constantly-running, stateful process (use Fargate/EC2); the deployment
has very large dependencies unsuited to the container-image size ceiling
even after that path; extremely high, sustained throughput would be
cheaper on a provisioned/reserved-capacity compute model rather than
per-invocation billing.

<a name="advlim"></a>
## 13. Advantages and limitations

**Advantages:** true pay-per-use with no idle cost; scales
automatically and near-instantly with load; deep native event-source
integration across the AWS data ecosystem; no server/OS patching;
fine-grained IAM permissions per function.

**Limitations:** 15-minute hard timeout with no way to extend it; cold
starts add latency variability; poll-based stream sources risk
head-of-line blocking on poison-pill records without careful
configuration; not cost-efficient for constant, high-sustained-throughput
workloads compared to provisioned compute; payload size ceilings push
large-data patterns toward "pass a reference, not the payload."

<a name="perfscale"></a>
## 14. Performance, scaling, and high availability

Lambda scales horizontally and automatically — each concurrent
invocation gets its own execution environment, up to the account/
reserved concurrency ceiling, with a burst scaling rate before steady
per-minute scaling kicks in for very sudden spikes. High availability is
inherent: Lambda runs across multiple AZs within a Region without any
configuration from the developer. For poll-based sources, throughput is
bounded by the number of shards/partitions (Kinesis/MSK) since each
shard is processed by (at most, without enhanced parallelization
features) one batch at a time in order — increasing shard count is the
lever for higher poll-based throughput, not increasing Lambda memory
alone.

<a name="security"></a>
## 15. Security

Each function has its own **execution role** (IAM role) scoped to
exactly the resources it touches — least privilege per function rather
than one broad shared role. Functions needing access to resources inside
a VPC (RDS, ElastiCache, private endpoints) are configured with VPC
subnets and security groups, at the cost of some added cold-start
overhead. Secrets (DB credentials, API keys) belong in **Secrets
Manager** or **Parameter Store**, retrieved at runtime — not hardcoded
in environment variables in plaintext, though environment variables can
be encrypted at rest with KMS. Lambda supports resource-based policies
to control which other accounts/services can invoke a given function.

<a name="failures"></a>
## 16. Failure scenarios and common mistakes

- **No DLQ/failure destination configured on an async-invoked
  function** — failed events silently vanish after two automatic
  retries with no trace.
- **Poison-pill record stalls an entire Kinesis shard** — no
  `BisectBatchOnFunctionError` or max-retry ceiling configured on the
  event source mapping.
- **Reserved concurrency set too low for a critical function**, or not
  set at all for a function hitting a fragile downstream (e.g.,
  overwhelming a small RDS instance's connection limit under a traffic
  burst).
- **Large SDK/library initialization inside the handler** instead of
  global scope — pays cold-start-equivalent cost on every invocation
  instead of once per warm environment.
- **Trying to force a >15-minute transform into Lambda** via
  workarounds (self-invoking chains, external state tracking) instead
  of using a service actually designed for long-running work.
- **Hardcoded secrets in environment variables** instead of Secrets
  Manager/Parameter Store.

<a name="examtraps"></a>
## 17. Exam traps

⚠️ **"Occasionally exceeds 15 minutes" or "processes very large files"
= Lambda is the wrong tool**, not "raise the timeout" (there's no way
to raise it past 15 minutes). The exam-preferred fix is offloading to
Glue/EMR/Step Functions or Fargate.

⚠️ **Reserved concurrency ≠ warm/no cold starts.** Reserved concurrency
is a cap/guarantee on parallelism; **provisioned concurrency** is what
eliminates cold starts. These are two different knobs and the exam
tests the distinction directly.

⚠️ **Async invocation retries automatically; poll-based event source
mappings have their own separate retry/error configuration** — a DLQ
attached to the function does not, by itself, catch a stuck Kinesis
shard; that needs event-source-mapping-level settings.

⚠️ **"Pass large data through the Lambda payload" is a red flag.**
Sync invoke payload is capped at 6 MB, async at 256 KB — the correct
pattern is passing an S3 object reference (bucket/key), not the file
content itself.

<a name="interview"></a>
## 18. Interview questions

- *"How do you prevent a single bad record from blocking an entire
  Kinesis-triggered Lambda pipeline?"* Strong answer: configure the
  event source mapping with `BisectBatchOnFunctionError` to isolate the
  failing record, a `MaximumRetryAttempts` ceiling so it doesn't retry
  forever, and an on-failure destination to route it out for
  inspection instead of blocking the shard.
- *"When would you choose Lambda over Glue for a transformation step,
  and when is that the wrong call?"* Strong answer: Lambda for
  lightweight, sub-15-minute, event-triggered per-file/per-record
  logic; wrong once the transform needs distributed Spark-style
  processing, runs long, or needs more memory/scratch space than
  Lambda's ceilings allow — that's Glue's job.
- *"How do you reduce cold-start latency for a latency-sensitive
  Lambda function in a data pipeline?"* Strong answer: provisioned
  concurrency for guaranteed warm environments, minimize deployment
  package size, initialize SDK clients/connections outside the handler
  so they persist across warm invocations, and be cautious about VPC/
  EFS attachment overhead if latency is truly critical.

<a name="cheatsheet"></a>
## 19. Cheat sheet

| If the scenario says... | Reach for... |
|---|---|
| process a file the moment it lands in S3 | S3 event → Lambda |
| micro-batch consume a Kinesis/MSK stream, lightweight logic | Event source mapping → Lambda |
| react to DynamoDB table changes | DynamoDB Streams → Lambda |
| guarantee capacity / cap parallelism to protect a downstream resource | Reserved concurrency |
| eliminate cold starts for a latency-critical function | Provisioned concurrency |
| job occasionally runs over 15 minutes or needs >10 GB memory | Not Lambda — use Glue/EMR/Fargate/Step Functions |
| access a large shared reference file/model at runtime | Mount EFS |
| failed async invocations must not be lost | Configure a DLQ / on-failure destination |
| a bad record is stalling a Kinesis shard | BisectBatchOnFunctionError + max retry attempts on the event source mapping |
| pass large data to/from a function | Pass an S3 object reference, not the payload |
| store DB credentials/API keys for a function | Secrets Manager or Parameter Store |

<a name="mnemonics"></a>
## 20. Memory tricks

**"15 and done"** — Lambda's hard ceiling is 15 minutes, full stop, no
extension. **"Reserved caps, Provisioned warms"** — the one-line way to
never confuse the two concurrency knobs again. **"Pointer, not
payload"** — pass an S3 key, never the file itself, through a Lambda
event.

---

<a name="practice"></a>
## 21. Practice questions (15)

**Q1.** A Lambda function triggered by S3 `ObjectCreated` events
occasionally fails due to a transient downstream error. The team needs
to guarantee that failed events are never silently lost. What should
they configure?

A) Increase the function's memory allocation
B) An on-failure destination or DLQ for the async invocation
C) Reserved concurrency equal to account concurrency
D) Provisioned concurrency

**Answer: B.** Async invocations retry automatically twice, then the
event is discarded unless a failure destination or DLQ is configured to
catch it. (A) memory doesn't affect failure handling. (C) reserved
concurrency caps/guarantees parallelism, not failure capture. (D)
provisioned concurrency addresses cold starts, not lost failed events.

**Q2.** A Kinesis-triggered Lambda function has started experiencing a
persistent processing error on one malformed record, and the team
notices the entire shard's downstream records have stopped being
processed. What configuration would have prevented this?

A) Increasing the function's timeout to 15 minutes
B) BisectBatchOnFunctionError with a MaximumRetryAttempts limit on the event source mapping
C) Enabling provisioned concurrency
D) Switching the trigger from Kinesis to SQS

**Answer: B.** This isolates and eventually discards the poison-pill
record (routing it to an on-failure destination) instead of letting it
block the shard's iterator indefinitely. (A) timeout doesn't address a
record that always errors regardless of time given. (C) provisioned
concurrency is unrelated to error handling. (D) switching event sources
is a bigger architectural change, not the direct/intended fix, and
changes the ordering/processing model.

**Q3.** Which Lambda limit is a hard ceiling that cannot be raised
through any support request or configuration?

A) Account-level concurrent executions
B) Deployment package size via container image
C) Maximum execution timeout of 15 minutes
D) Memory allocation up to 10,240 MB

**Answer: C.** The 15-minute timeout is an absolute ceiling with no
override. (A) account concurrency is a soft limit, increasable via
support request. (B) container images support packages up to 10 GB — a
generous but real published ceiling, distinguishable from "cannot be
raised" framing used for (C). (D) memory maxes at 10,240 MB, which is
also a fixed ceiling, but the question specifically targets the
timeout as the classically tested "cannot be extended at all" limit.

**Q4.** A data pipeline uses a Lambda function that needs sub-100ms
p99 latency for a synchronous API-backing invocation, and cold starts
are causing SLA violations. What is the most direct fix?

A) Reserved concurrency
B) Provisioned concurrency
C) Increase the deployment package size
D) Move the function into a VPC

**Answer: B.** Provisioned concurrency keeps execution environments
pre-warmed, directly eliminating cold-start latency for that capacity.
(A) reserved concurrency only caps/guarantees parallelism, it does not
warm environments. (C) larger packages typically worsen, not improve,
cold-start latency. (D) VPC attachment historically adds latency
overhead rather than reducing it.

**Q5.** A team wants a Lambda function to access a 40 GB shared machine
learning model file at invocation time, larger than both the deployment
package limit and the maximum `/tmp` size. What should they use?

A) Increase Lambda memory to 10,240 MB
B) Mount an Amazon EFS file system
C) Store the model in DynamoDB
D) Use a container image up to 10 GB

**Answer: B.** EFS provides a persistent, shared filesystem well beyond
the 10 GB `/tmp` ceiling, mountable at runtime. (A) memory increase
doesn't create storage capacity for a 40 GB file. (C) DynamoDB is
unsuitable for large binary blobs like an ML model. (D) a 10 GB
container image still can't hold a model that needs to exceed 10 GB of
addressable storage at runtime the way EFS can.

**Q6.** Which statement about Lambda's asynchronous invocation retry
behavior is correct?

A) Lambda retries indefinitely until success
B) Lambda retries automatically twice with a delay, then discards the event unless a destination/DLQ is configured
C) Lambda never retries asynchronous invocations
D) Retry behavior for async invocations is identical to poll-based event source mappings

**Answer: B.** This is the documented default async retry behavior. (A)
retries are not indefinite. (C) async invocations do retry by default.
(D) poll-based sources (Kinesis, DynamoDB Streams, SQS, MSK) have their
own distinct, separately configurable retry/error-handling model.

**Q7.** A nightly Lambda-based job intermittently needs more than 15
minutes to complete as data volume has grown. What is the recommended
fix?

A) Request a Lambda timeout increase via AWS Support
B) Split the job across a Glue job or Step Functions workflow better suited to longer-running work
C) Increase reserved concurrency
D) Switch the trigger from EventBridge Schedule to S3 events

**Answer: B.** Once the job outgrows the fixed 15-minute ceiling, the
correct move is migrating the heavy-lift portion to a service designed
for longer execution (Glue, EMR, Step Functions/Fargate for long tasks).
(A) there is no mechanism to raise the 15-minute ceiling, ever. (C)
concurrency doesn't affect single-invocation duration. (D) changing the
trigger type doesn't change the function's execution time limit.

**Q8.** Which best describes the purpose of reserved concurrency on a
Lambda function that writes to a small RDS instance with a limited
connection pool?

A) It eliminates cold starts for the function
B) It caps the function's maximum concurrent executions, preventing it from overwhelming the database's connection limit
C) It automatically retries failed database writes
D) It reduces the function's billed duration

**Answer: B.** Reserved concurrency's ceiling effect is exactly the
mechanism used to protect a fragile downstream resource from a burst of
concurrent Lambda invocations. (A) that's provisioned concurrency's
job. (C) retry behavior is a separate configuration (destinations/DLQ/
event source mapping settings), not a function of reserved concurrency.
(D) reserved concurrency doesn't change per-invocation duration or
billing rate.

**Q9.** A Lambda function needs to process an incoming file referenced
in an S3 event but the actual file is 500 MB. What is the correct
pattern?

A) Pass the file's full contents in the Lambda event payload
B) Have the function read the file directly from S3 using the bucket/key from the event
C) Split the file into 256 KB chunks and pass each as a separate payload
D) Use a synchronous invocation with a 6 MB payload override request

**Answer: B.** S3 events carry a reference (bucket and key), and the
function reads the object directly from S3 — this is the standard
"pass a pointer, not the data" pattern. (A) and (C) violate payload size
limits (256 KB async / 6 MB sync) and are not how S3 event Lambda
integration works. (D) there is no override mechanism for the payload
size limit.

**Q10.** Which runtime/configuration choice most directly reduces cold
start impact for a Python Lambda function that initializes an SDK
client and loads a small config file on every invocation?

A) Move the SDK client initialization and config load outside the handler, into global scope
B) Increase the function's reserved concurrency
C) Decrease the function's memory allocation to the minimum
D) Switch the event source from S3 to EventBridge

**Answer: A.** Code in global scope runs once per warm execution
environment and is reused across subsequent invocations of that same
environment, avoiding repeated initialization cost. (B) reserved
concurrency doesn't affect per-invocation initialization cost. (C)
lower memory reduces allocated vCPU, which can actually slow
initialization, not speed it. (D) event source choice doesn't affect
handler-level initialization cost.

**Q11.** A company's Lambda-based data pipeline step needs credentials
to connect to an external database. Which approach follows AWS security
best practices?

A) Hardcode the credentials as plaintext in the function code
B) Store credentials in an unencrypted environment variable
C) Retrieve credentials at runtime from Secrets Manager or Parameter Store
D) Pass credentials in the triggering event payload

**Answer: C.** Secrets Manager/Parameter Store centralizes credential
storage, supports rotation, and keeps secrets out of code and event
payloads. (A) and (B) expose credentials in code/config where they're
easily leaked and hard to rotate. (D) passing credentials through event
payloads exposes them in logs/event history and to any service touching
the event.

**Q12.** For a Lambda function triggered by Kinesis Data Streams, what
determines the maximum achievable poll-based processing throughput?

A) The function's memory allocation alone
B) The number of shards, since each shard's records are processed in order per batch
C) The account's total concurrent execution limit only
D) The DLQ configuration

**Answer: B.** Kinesis throughput scales with shard count — each shard
is a unit of ordered, sequential processing; more shards allow more
parallel Lambda invocations. (A) memory affects per-invocation speed,
not the number of parallel streams available. (C) account concurrency
is a ceiling but shard count is what actually creates the parallelism
opportunity in the first place. (D) DLQ configuration is about failure
handling, unrelated to throughput scaling.

**Q13.** A finance team requires that a Lambda function be guaranteed a
minimum amount of available concurrency even during an account-wide
traffic spike from unrelated functions. What should be configured?

A) Provisioned concurrency
B) Reserved concurrency
C) A larger memory allocation
D) A DLQ

**Answer: B.** Reserved concurrency guarantees (and caps) a specific
slice of the account's concurrency pool for this function, protecting
it from being starved by other functions. (A) provisioned concurrency
addresses cold starts, not guaranteed availability against account-wide
contention (though the two are often used together). (C) memory doesn't
guarantee concurrency slots. (D) a DLQ handles failed events, not
concurrency guarantees.

**Q14.** Which of the following is an accurate statement about Lambda
billing?

A) Lambda charges a flat fee per function regardless of invocations
B) Lambda bills by number of requests and GB-seconds of duration, and increasing memory can sometimes lower total cost by reducing execution time
C) Lambda only bills for cold starts, not warm invocations
D) Provisioned concurrency is billed identically to standard on-demand invocations

**Answer: B.** Cost is requests + duration (memory x time), and higher
memory raises allocated vCPU, which can shorten execution time enough
to reduce total GB-seconds billed — a real tuning trade-off. (A) there
is no flat per-function fee independent of usage. (C) all invocations,
warm or cold, are billed for their duration. (D) provisioned concurrency
has its own separate charge for reserved warm capacity, in addition to
invocation charges.

**Q15.** A scenario states: "Business logic must run within 200ms of a
new order being written to a DynamoDB table, updating a downstream
search index." Which Lambda integration fits this requirement?

A) A Lambda function polling the table every minute via EventBridge Scheduler
B) DynamoDB Streams triggering a Lambda function on each table change
C) A daily Glue job scanning the full table for changes
D) An S3 event notification on table export files

**Answer: B.** DynamoDB Streams delivers a near-real-time, ordered
change feed that can trigger Lambda within a very short window of the
write — the correct low-latency, event-driven pattern. (A) polling on a
schedule introduces up-to-a-minute latency, failing the near-immediate
requirement. (C) a daily batch job is far too infrequent. (D) S3 export
files are a batch/analytics export mechanism, not a low-latency change
feed.
