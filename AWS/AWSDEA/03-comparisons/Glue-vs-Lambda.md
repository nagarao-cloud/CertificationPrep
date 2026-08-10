# Glue vs Lambda

> The narrowest, most mechanical comparison in this set — but AWS asks
> it constantly because the deciding factor is a **hard numeric wall**,
> not a judgment call. This file exists to make sure that wall never
> costs you a point.

---

## 1. ELI12

**Lambda** is a vending machine. You put in a coin, it does exactly one
small thing very fast — dispenses a snack — and it's done. It cannot
cook you a three-course meal; it has a fixed, small compartment and a
strict time limit before it gives up and resets.

**Glue** is a full-service kitchen with a prep station that already
knows where every ingredient is stored (the Data Catalog). It's built
for jobs that take a while, touch a lot of data, and need to remember
what it already cooked yesterday (job bookmarks) so it doesn't redo
work. Slower to get started than the vending machine, but it can handle
a job the vending machine physically cannot.

The exam boils this down to one question: **does the job fit inside
Lambda's box — 15 minutes, 10GB of memory, no persistent catalog
tracking needed?** If yes, either works and Lambda is usually "more
lightweight." If no, Lambda is eliminated entirely, full stop.

---

## 2. Comparison matrix

| Attribute | **AWS Lambda** | **AWS Glue ETL** |
|---|---|---|
| **Purpose** | Lightweight, event-driven functions | ETL-shaped, catalog-integrated data processing |
| **Max execution time** | **15 minutes — hard ceiling** | Unlimited |
| **Max memory** | **10,240 MB (10 GB) — hard ceiling** | Up to 128 GB/worker (G.8X) |
| **Cold start** | Milliseconds | ~1 minute |
| **Cost model** | Requests + GB-seconds | DPU-hours, billed per second (1-min minimum) |
| **Serverless** | ✅ | ✅ |
| **Trigger model** | Event-driven: S3 events, API Gateway, Kinesis/DynamoDB Streams, EventBridge, SQS, direct invoke | Schedule, event (via EventBridge/S3 notification), on-demand, or streaming (continuous) |
| **Data Catalog integration** | ❌ Manual (must call Glue APIs/boto3 yourself) | ✅ **Native** — DynamicFrames read/write directly against the Catalog |
| **Incremental processing** | Manual (you track state — e.g., in DynamoDB or S3 markers) | ✅ **Job bookmarks** built in |
| **Frameworks** | Any language runtime you package (Python, Node, Java, Go, etc.) — your own code | Spark, Python Shell, Ray |
| **Concurrency** | Up to 1,000 concurrent executions by default (soft limit, raisable) | Auto-scaling workers within a job's configured range |
| **Best for data volume** | Small payloads — single files, small batches, individual records | Large-scale batch/streaming transforms — GBs to PBs |
| **Streaming support** | ✅ Via Kinesis/DynamoDB Streams event source mapping (micro-batch per invocation) | ✅ Glue Streaming (continuous, micro-batch) |
| **Batch support** | ⚠️ Only for small, quick jobs within the 15-min/10GB envelope | ✅ Core use case, any size |
| **Monitoring** | Duration, Throttles, Errors, `IteratorAge` (for stream sources) | Glue job metrics, Spark UI, job run history |
| **Security** | IAM execution role, KMS, VPC (optional) | IAM, KMS, VPC connections, Lake Formation |
| **Best use case** | Light transforms, format checks, triggering downstream workflows, glue-code between services (small "adapter" logic) | ETL-shaped transforms integrated with the Data Catalog, any job too big for Lambda's envelope |
| **When NOT to use** | Job could exceed 15 minutes or 10GB memory, or needs catalog-native incremental processing | A single lightweight reaction to one event (e.g., resize an uploaded image) — Glue's ~1-minute cold start and job-oriented model is overkill |
| **Exam favorite** | **"under 15 minutes," "event-driven," "lightweight," "triggered by a single file arrival"** | "serverless ETL integrated with the Data Catalog," "process large volumes," "incremental since last run" |

---

## 3. Decision tree

```
┌────────────────────────────────────────────────────────────────┐
│ START: Will the task realistically finish within 15 minutes AND │
│ fit within 10GB of memory, for the data volumes described?      │
└───────────────────────────────┬───────────────────────────────┘
                                 │
                ┌─────────────────┴─────────────────┐
               NO (or "large volume," "petabytes,          YES
               GB-to-TB scale," "long-running")              │
                │                                              │
          ┌─────▼─────┐                     Does the task need native
          │ AWS GLUE  │                     Data Catalog read/write, or
          │   ETL     │                     incremental "since last run"
          │(Lambda is │                     tracking (job bookmarks)?
          │ physically│                                  │
          │ disqualif-│                    ┌───────────────┴───────────────┐
          │ ied)      │                   YES                              NO
          └───────────┘                    │                                 │
                                     ┌───────▼───────┐             Is it a simple,
                                     │  AWS GLUE ETL  │             single-purpose
                                     │  (bookmarks +  │             reaction to ONE
                                     │  catalog-native│             event (a file lands,
                                     │  fit better)   │             an API call arrives,
                                     └─────────────────┘             a record streams in)?
                                                                                  │
                                                                     ┌─────────────┴─────────────┐
                                                                    YES                           NO
                                                                     │                              │
                                                              ┌───────▼───────┐         (reconsider — you may be
                                                              │  AWS LAMBDA   │          missing a requirement;
                                                              │ (lightweight, │          default toward Glue if
                                                              │  fast, event- │          the workload is genuinely
                                                              │  driven)      │          "ETL-shaped")
                                                              └─────────────────┘
```

---

## 4. Worked scenarios

**Scenario A — Every time a JSON file lands in an S3 landing bucket
(files average 5MB), it needs to be validated, have one field renamed,
and be written to a curated bucket as Parquet — completing in a few
seconds.** *Winner: Lambda.* Small payload, sub-second-to-seconds
processing, triggered directly by an S3 event — comfortably inside
Lambda's envelope, and Glue's ~1-minute cold start would add
unnecessary latency to a task this light.

**Scenario B — A nightly job joins a 200GB sales fact table against
several dimension tables in S3, applies business transformations, and
writes curated Parquet back to the Data Catalog, processing only files
that arrived since the previous run.** *Winner: Glue ETL.* 200GB is far
beyond what's comfortable in a 10GB-memory Lambda function, the job is
long-running (Glue has no execution time ceiling), and "only files
since the previous run" is the textbook job-bookmarks trigger.

**Scenario C — An image-processing pipeline resizes a single uploaded
image to three thumbnail sizes the moment it's uploaded, and the whole
operation must complete in under 5 seconds for a responsive UX.**
*Winner: Lambda.* Single-event, single-file, sub-second-to-low-seconds
work, and Lambda's millisecond cold start (especially with provisioned
concurrency if needed) beats Glue's job-startup latency by orders of
magnitude for this shape of workload.

**Scenario D — A team is processing Kinesis Data Streams records that
occasionally spike to require heavier per-record computation
(sometimes exceeding several minutes per micro-batch under load), and
wants the option to grow processing time without hitting a hard wall.**
*Winner: Glue Streaming.* Lambda's Kinesis event source mapping is
viable for lighter per-batch processing, but if processing time can
grow unpredictably and risk the 15-minute ceiling, Glue Streaming
(continuous, no per-invocation time limit) removes that risk entirely.

---

## 5. Exam traps

| Trap | The correction |
|---|---|
| **Choosing Lambda for a job described only as "small" without checking data volume growth** | If the scenario mentions the data volume is expected to grow, or batches can occasionally be large, Lambda's fixed 10GB/15-min ceiling makes it a fragile choice — Glue scales without a hard wall. |
| **Assuming Glue is always "more overhead" than Lambda** | For genuinely ETL-shaped, catalog-integrated, incremental work, Glue is *less* operational overhead than hand-rolling that logic in Lambda (manual state tracking, manual catalog calls, chunking large files across multiple invocations). |
| **Forgetting Lambda's memory ceiling is 10,240 MB, not unlimited** | A Lambda function trying to load a multi-GB dataset into memory for a transform will hit this wall. Any stem implying in-memory processing of data larger than ~10GB disqualifies Lambda. |
| **Treating the 15-minute limit as "average duration" rather than a hard per-invocation ceiling** | It's a hard ceiling per invocation, not an average. A job whose *worst case* (not typical case) could exceed 15 minutes is disqualified, even if it usually finishes in 2. |
| **Picking Lambda because "it's serverless" ignoring the catalog requirement** | Both are serverless. When the scenario specifically wants results "registered in the Data Catalog" or needs job-bookmark-style incremental tracking, that specific feature set belongs to Glue, not a generic "serverless" preference. |
| **Using Lambda to orchestrate/chain multiple Glue jobs** | Possible but not the AWS-preferred pattern — that's a Step Functions or Glue Workflows job (orchestration), not a data transformation job. Don't confuse "Lambda calling other services" with "Lambda doing the transformation." |
| **Assuming Glue Python Shell has the same limits as Lambda** | Glue Python Shell jobs are a lighter-weight Glue job type (not full Spark) but still don't share Lambda's 15-min/10GB ceiling — they're still Glue, with Glue's execution model. |

---

## 6. Real-company examples

**Lambda side — a photo-sharing app's thumbnail generator.** Every
image uploaded to S3 triggers a Lambda function that resizes it into
several thumbnail sizes and writes them back — a textbook single-event,
sub-second, lightweight reaction that would be needlessly slow and
expensive to run through a Glue job.

**Glue side — a subscription business's nightly revenue-recognition
pipeline.** Each night, a Glue ETL job joins subscription, billing, and
usage tables (hundreds of GB) from the Data Catalog, applies revenue-
recognition business logic across the full history plus incremental
new records (via job bookmarks), and writes curated Parquet back for
finance reporting — well beyond what a 15-minute, 10GB Lambda function
could reliably handle.

---

## 7. Practice questions (12)

**Q1.** A Lambda function processing a Kinesis stream occasionally
needs more than 15 minutes to finish a batch under heavy load. What
should the team do?

- A. Increase the Lambda timeout setting to 30 minutes — ✗ Not possible; 15 minutes is a hard platform ceiling, not a configurable timeout beyond that limit.
- B. **Move the processing to Glue Streaming, which has no per-invocation time ceiling — ✓** Correct fix for a workload that can exceed Lambda's hard wall.
- C. Split the Lambda function into two chained functions — ✗ Adds complexity and doesn't reliably solve unpredictable processing time growth; Glue Streaming is the purpose-built answer.
- D. Increase Lambda's memory to speed up processing — ✗ May help somewhat but doesn't remove the hard 15-minute ceiling risk.

**Q2.** A single 5MB JSON file must be validated and reformatted the
moment it lands in S3, completing in a few seconds. Most appropriate
service?

- A. AWS Glue ETL — ✗ ~1-minute cold start adds unnecessary latency for a task this small and fast.
- B. **AWS Lambda — ✓** Millisecond cold start, event-driven by S3 notification, comfortably fits the small payload and quick turnaround.
- C. EMR — ✗ Massive overkill — cluster spin-up alone takes minutes for a 5MB single-file task.
- D. Glue Streaming — ✗ Designed for continuous stream processing, not a one-off single-file event.

**Q3.** A nightly job processes 200GB of data with complex joins and
must track which files were already processed. What disqualifies
Lambda here?

- A. Lambda can't read from S3 — ✗ False; Lambda reads S3 fine, this isn't the issue.
- B. **200GB exceeds Lambda's 10,240 MB memory ceiling for in-memory processing, and Lambda has no built-in incremental tracking equivalent to job bookmarks — ✓** Both the memory ceiling and missing native incremental-state tracking point to Glue.
- C. Lambda cannot be triggered on a schedule — ✗ False; Lambda supports scheduled triggers via EventBridge.
- D. Lambda doesn't support Python — ✗ False; Python is a fully supported Lambda runtime.

**Q4.** What is Lambda's maximum configurable execution timeout?

- A. 5 minutes — ✗ Incorrect value.
- B. **15 minutes — ✓** The hard ceiling tested repeatedly on the exam.
- C. 60 minutes — ✗ Incorrect; this is not a Lambda limit.
- D. Unlimited if provisioned concurrency is enabled — ✗ Provisioned concurrency addresses cold starts, not the execution time ceiling.

**Q5.** What is Lambda's maximum configurable memory allocation?

- A. 3,008 MB — ✗ This was an older limit; current maximum is higher.
- B. **10,240 MB (10 GB) — ✓** Correct current ceiling.
- C. 16,384 MB — ✗ Incorrect value for Lambda.
- D. Unlimited, billed per GB-second used — ✗ Billing is per GB-second, but there is still a hard memory ceiling.

**Q6.** A team wants incremental ETL processing that automatically
tracks which S3 files have already been transformed, without writing
custom state-tracking code. Which service provides this natively?

- A. Lambda with a DynamoDB tracking table — ✗ Works but requires building the tracking logic yourself; not native.
- B. **AWS Glue, via job bookmarks — ✓** Built-in incremental tracking with no custom code required.
- C. Lambda with S3 event notifications alone — ✗ Notifications trigger on new events but don't provide historical incremental-state tracking across runs.
- D. EMR with a manual checkpoint file — ✗ Requires custom implementation; not a native built-in feature.

**Q7.** Which scenario correctly favors Lambda over Glue despite both
being serverless?

- A. A job needing native Data Catalog read/write integration — ✗ This favors Glue, not Lambda.
- B. A job processing terabytes with complex Spark transformations — ✗ Favors Glue; far beyond Lambda's envelope.
- C. **A single lightweight reaction to one event, completing in seconds, with no catalog dependency — ✓** Exactly the shape Lambda is built for.
- D. A job requiring job-bookmark-style incremental tracking — ✗ Bookmarks are Glue-specific; favors Glue.

**Q8.** True or false: Lambda functions can natively read from and
write to the Glue Data Catalog with zero additional code.

- A. True — ✗ Incorrect; Lambda requires you to call Glue/boto3 APIs yourself to interact with the catalog.
- B. **False — ✓** Unlike Glue's DynamicFrames, Lambda has no native catalog integration; any catalog interaction must be coded manually.
- C. True, but only for Python runtimes — ✗ Still false regardless of runtime; catalog interaction always requires explicit API calls from Lambda.
- D. True, if the Lambda function has an IAM role with Glue permissions — ✗ An IAM role grants permission to call the Glue API, but the integration still isn't native/automatic the way it is inside a Glue job.

**Q9.** A stem states: "a function must run every time a record arrives
on a DynamoDB Stream, apply lightweight enrichment, and complete
quickly, with data volumes per invocation always small." Best fit?

- A. Glue Streaming — ✗ Overkill for small, lightweight, per-record enrichment; continuous Glue Streaming bills continuously regardless.
- B. **Lambda with a DynamoDB Streams event source mapping — ✓** Purpose-built for small, quick, event-driven per-record/per-batch processing.
- C. EMR with Spark Structured Streaming — ✗ Far more infrastructure and overhead than a small, lightweight enrichment task needs.
- D. Glue ETL scheduled hourly — ✗ Introduces unnecessary latency for what should be a near-immediate per-record reaction.

**Q10.** Why is it risky to choose Lambda for a batch job whose
"typical" runtime is 8 minutes but whose worst-case runtime (on large
input days) could exceed 20 minutes?

- A. Lambda's cost would be too high at 20 minutes — ✗ Cost isn't the primary issue; the real problem is a hard platform limit.
- B. **The 15-minute execution ceiling is a hard limit, and any invocation exceeding it fails outright regardless of "typical" performance — ✓** Worst-case, not typical-case, must fit inside the limit.
- C. Lambda cannot process batch jobs at all — ✗ False; Lambda can process batch-shaped work as long as it fits the time/memory envelope.
- D. Lambda would automatically switch to Glue if it ran too long — ✗ No such automatic fallback exists; the invocation simply fails/times out.

**Q11.** A question emphasizes "process a nightly file drop, apply
several transformations using Spark, and register the output schema in
the Data Catalog automatically." Which service, and what's the
disqualifying reason for the alternative?

- A. **AWS Glue ETL — ✓; Lambda doesn't run Spark or natively register schemas in the Data Catalog** — Correct service and correct reasoning.
- B. Lambda; Glue can't run Spark — ✗ Backwards — Glue natively runs Spark; this claim is false.
- C. Either works equally well — ✗ Incorrect; Lambda lacks native Spark support and native catalog schema registration.
- D. EMR; Glue can't process nightly file drops — ✗ False; nightly scheduled/triggered Spark ETL with catalog integration is exactly Glue's core use case.

**Q12.** What is the most reliable single signal in an exam question
that immediately eliminates Lambda as a candidate answer?

- A. The word "serverless" appearing in the requirements — ✗ Doesn't eliminate Lambda; Lambda is itself serverless.
- B. **A stated or implied data volume/runtime that could exceed 10GB memory or 15 minutes execution time — ✓** The hard numeric wall that disqualifies Lambda regardless of other factors.
- C. The job being triggered by an S3 event — ✗ S3-event triggering is one of Lambda's most common and appropriate use cases.
- D. The job running on a schedule — ✗ Lambda supports scheduled triggers via EventBridge just fine; not a disqualifier.
