# Troubleshooting Interview Questions — Production Incident Walkthroughs

> **This is job-interview prep, not exam prep.** The exam version of
> this content lives in `00-START-HERE/TROUBLESHOOTING.md` and is
> written to be scanned in seconds — "which setting fixes this."
> This file is the opposite on purpose: an interviewer handing you a
> vague, realistic incident and watching *how you think*, not whether
> you blurt the right noun fast enough. Every scenario below is written
> as the interviewer would actually say it, followed by the diagnostic
> walkthrough a strong candidate would talk through out loud — ranked
> root causes, the fix, and what you'd change so it doesn't happen
> again. Read the diagnostic process as the thing being graded; the
> root cause is almost secondary.
>
> 16 scenarios, covering the production incidents that come up most in
> real data engineering interviews: Glue OOM and data skew, Kinesis hot
> shards and rising `IteratorAge`, Redshift WLM queue backup, S3 403s,
> Lake Formation access denial, Lambda throttling, DMS replication lag,
> and Athena timeouts / the small-files problem, plus eight more that
> round out a realistic on-call rotation.

---

## 1. "A Glue job that's run fine for six months suddenly fails with OOM at 3 a.m. Walk me through your diagnostic process."

**What I'd say out loud, in order:**

"First I'd resist the urge to just bump the worker type — that fixes
the symptom for a while and hides the actual cause, and I want to know
the cause before I touch the config. I'd start with CloudWatch metrics
for the job run: `glue.driver.aggregate.bytesRead`,
`aggregate.numCompletedTasks`, and per-executor memory. The shape of
the memory graph tells me a lot before I read a line of code — a slow
climb that flatlines just before OOM screams data skew (one partition
or one key is enormous relative to the rest); a sudden cliff right at a
specific transform screams a bad join fanout or a `collect()`-style
operation pulling too much data to the driver."

**Ranked root causes, most to least likely:**

1. **Data skew** — one key/partition grew disproportionately (a new
   high-volume customer, a NULL/default key absorbing unmatched rows).
   Six months of quiet is consistent with slow, organic growth crossing
   a threshold, not a code change.
2. **Upstream schema or volume change** — a source system started
   sending a wider row, a duplicated field, or simply more rows per
   batch than before, and nobody told the data team.
3. **A join fanout** — a one-to-many join that used to be roughly
   one-to-one silently became one-to-many as the "many" side grew.
4. **Job bookmark not advancing** — reprocessing a growing cumulative
   dataset instead of only new data, because bookmarks got reset or
   were never enabled on this job.
5. **Least likely but worth ruling out** — an underlying AWS-side
   capacity or version change (Glue version bump changing default
   Spark memory behavior).

**The fix:** repartition or salt the skewed key before the join;
increase worker type/count only as a short-term mitigation while the
skew fix ships; if a join is the culprit, broadcast the small side
explicitly instead of letting Spark guess.

**Prevention:** a CloudWatch alarm on executor memory trending upward
over time (not just a hard OOM alarm), and a monthly "row count and max
partition size" sanity check on tables feeding this job so growth is
caught before it becomes an incident.

---

## 2. "A Kinesis consumer's `IteratorAge` climbs steadily through the day and never recovers. What's happening and how do you fix it?"

**Diagnostic process:** "`IteratorAge` climbing means consumers are
falling behind producers — the question is whether that's a capacity
problem or a distribution problem, and I can tell which from the
per-shard metrics before I do anything else. I'd pull
`IncomingBytes`/`IncomingRecords` and `IteratorAgeMilliseconds`
per shard, not just the stream aggregate — an aggregate metric hides a
hot shard completely, because 11 quiet shards can average out one
overloaded one."

**Ranked root causes:**

1. **Hot shard from a poor partition key** — a partition key with low
   cardinality (customer ID for a customer that dominates volume,
   or worse, a constant/near-constant key) routes a disproportionate
   share of records to one shard, which throttles at its per-shard
   limit while other shards sit idle.
2. **Under-provisioned shard count for actual throughput** — total
   incoming throughput genuinely exceeds total consumer capacity
   (each shard: 1 MB/s or 1,000 records/s in, 2 MB/s out per consumer
   without enhanced fan-out).
3. **Consumer-side slowness** — the KCL application's per-record
   processing logic got slower (a downstream call added, an expensive
   transform), so even evenly-distributed shards fall behind.
4. **Too many consumer applications sharing standard (non-fan-out)
   throughput** — multiple consumers reading the same shards
   contend for the shared 2 MB/s per-shard read throughput.

**The fix:** if it's a hot shard, redesign the partition key for higher
cardinality (add a random or hashed suffix if the natural key is
low-cardinality) and reshard; if it's genuine under-provisioning,
switch to on-demand mode or increase shard count; if multiple consumers
are contending, add **enhanced fan-out** so each consumer gets its own
2 MB/s dedicated throughput per shard.

**Prevention:** alarm on `IteratorAgeMilliseconds` per shard (not just
stream-level), and a partition-key design review before any new
producer goes live — this is the single most common root cause and it's
entirely preventable at design time.

---

## 3. "Redshift queries are queuing for minutes during business hours and the team doesn't know why. Walk me through it."

**Diagnostic process:** "I'd start in `SVL_QUERY_QUEUE_INFO` (or the
Redshift console's WLM query monitoring view) to see which queue is
backed up and what's sitting in it — is it one enormous query blocking
a shared slot, or is it just genuinely more concurrent queries than
the queue has slots for. I'd also check whether **auto-WLM** is enabled
or whether this is a manually configured WLM with fixed slot counts,
because the fix is different for each."

**Ranked root causes:**

1. **Fixed WLM slot count too low for actual concurrency** — a queue
   configured for 5 concurrent slots hits real-world demand of 15
   concurrent BI dashboard queries during a Monday-morning spike.
2. **One or more long-running / unoptimized queries holding a slot** —
   a missing `WHERE` clause on a partition/sort key, or a query doing
   a full scan across an unsorted table, holds a slot for minutes while
   short queries queue behind it.
3. **Stale statistics** — no recent `ANALYZE`, so the query planner
   picks a bad plan (this is now largely automatic in modern Redshift,
   but worth ruling out if `ANALYZE` was ever manually disabled).
4. **Missing or wrong sort/distribution key** on a heavily-queried
   table, making every query against it inherently more expensive than
   it needs to be.

**The fix:** short-term, enable **concurrency scaling** so transient
concurrency spikes get additional capacity automatically instead of
queuing; medium-term, move to **auto-WLM** so Redshift manages slot
allocation dynamically instead of a static config that's wrong by
definition on both quiet and busy days; identify and fix the specific
runaway query with `EXPLAIN` and a sort/dist key review.

**Prevention:** short query acceleration (SQA) for the interactive/BI
queue specifically, and a WLM query monitoring rule (QMR) that aborts
or logs any query exceeding a runtime threshold before it becomes a
recurring problem.

---

## 4. "Users report intermittent 403 errors reading from an S3 bucket that used to work fine. How do you debug it?"

**Diagnostic process:** "403 is almost always a policy evaluation
problem, not an availability problem, so I go straight to IAM/S3 access
logs rather than checking S3 health. First stop: CloudTrail for the
specific denied `GetObject` calls — the event usually names which
policy evaluation step produced the deny, which saves a lot of manual
policy reading. If CloudTrail data events aren't enabled for this
bucket, that's itself a finding — I'd enable them as part of the fix,
not just the investigation."

**Ranked root causes:**

1. **An explicit deny somewhere in the chain** — a bucket policy, SCP,
   or permission boundary with an explicit deny always wins regardless
   of any other allow; this is the first thing to rule out because it
   short-circuits every other check.
2. **KMS key policy not granting the caller's role `kms:Decrypt`** —
   if the object is SSE-KMS encrypted, S3 access alone isn't enough;
   the caller's role also needs to be in the *key's* policy or granted
   access separately. This is one of the most common "used to work,
   now doesn't" causes when a role changed or a key policy was
   tightened.
3. **VPC endpoint policy restricting access** — if traffic goes through
   an S3 gateway endpoint with a restrictive endpoint policy, a role
   that's otherwise allowed can still be denied at the endpoint layer.
4. **Bucket policy change (intentional tightening) that wasn't
   communicated** — someone added a condition (source IP, VPC, or
   `aws:PrincipalOrgID`) that a legitimate caller no longer satisfies.
5. **Time-limited credentials expired** mid-session for a long-running
   job, producing intermittent (not constant) 403s.

**The fix:** trace the exact deny via CloudTrail, then correct the
specific layer — add the role to the KMS key policy, adjust the bucket
or endpoint policy condition, or remove an overly broad SCP deny.

**Prevention:** IAM Access Analyzer to catch unintended access changes
before they ship, and treating KMS key policy changes with the same
review rigor as IAM policy changes, since they're the most common
overlooked layer.

---

## 5. "A data engineer with a role that looks correctly permissioned in IAM still gets denied reading a table through Lake Formation. What's going on?"

**Diagnostic process:** "This is the classic trap: IAM being satisfied
doesn't mean Lake Formation is satisfied, because Lake Formation
enforces its *own* permission layer on top of (not instead of) IAM once
a database is under Lake Formation governance. I'd check two things in
order: is the *table* actually registered under Lake Formation, and
does this principal have an explicit Lake Formation grant (or an
LF-Tag match) on it — IAM `s3:GetObject` access to the underlying data
is irrelevant once Lake Formation governs the table, because Lake
Formation intentionally overrides direct IAM access to prevent exactly
that bypass."

**Ranked root causes:**

1. **No Lake Formation grant exists for this principal on this table**
   even though their IAM role has broad S3/Glue permissions — Lake
   Formation permissions are additive on top and must be granted
   separately.
2. **LF-Tag mismatch** — access is governed by tag-based policies
   (ABAC) and this principal's assigned tag doesn't match the
   resource's tag, even though a *different* explicit grant might
   otherwise apply.
3. **Column or row-level filter excludes the specific data the query
   needs** — the principal has table-level access but the query touches
   a column covered by a restrictive data filter.
4. **Cross-account share not accepted or a hybrid access mode
   misconfiguration** — for cross-account Lake Formation sharing via
   RAM, the resource share must be accepted on the receiving side.

**The fix:** grant the specific Lake Formation permission (`SELECT`,
etc.) on the table or via the matching LF-Tag, rather than widening the
IAM policy, which won't fix a Lake Formation-layer denial.

**Prevention:** document, per table, whether it's IAM-governed or
Lake-Formation-governed at the point it's registered — most incidents
here come from someone assuming IAM-only governance still applies after
a table was migrated under Lake Formation.

---

## 6. "A Lambda function that processes Kinesis records starts throwing throttling errors under load. Diagnose it."

**Diagnostic process:** "Throttling on a stream-triggered Lambda has a
couple of very different possible layers, so I'd check concurrency
metrics before assuming it's a raw capacity problem. First: is this
account-level concurrent execution limit throttling (check
`ConcurrentExecutions` against the account/function limit), or is it
the event source mapping itself limiting parallelism per shard?"

**Ranked root causes:**

1. **Account or function-level reserved concurrency limit hit** — a
   burst of traffic (or several functions competing for the same
   account-wide pool) exceeds the configured concurrency ceiling.
2. **Parallelization factor too low for the shard's throughput** — by
   default one Lambda invocation processes one shard's batch at a time;
   under sustained high throughput this needs to be increased (up to
   10 parallel batches per shard) or the function falls behind.
3. **Downstream throttling propagating back** — the Lambda itself isn't
   the bottleneck; it's calling a downstream service (DynamoDB,
   another API) that's throttling it, and Lambda retries pile up as a
   result.
4. **Batch size / batching window misconfigured**, causing more
   frequent, smaller invocations than necessary and burning through
   concurrency faster than a well-tuned batch would.

**The fix:** raise reserved/account concurrency limits (or use
provisioned concurrency for predictable baseline load), increase the
event source mapping's parallelization factor, and fix or backoff
against the actual downstream throttle if that's the real source.

**Prevention:** a CloudWatch alarm on `Throttles` and on
`ConcurrentExecutions` approaching the account limit, plus load-testing
new stream-triggered functions against realistic peak throughput before
they go live, not just average throughput.

---

## 7. "A DMS CDC replication task's target lag keeps growing and doesn't recover even after traffic settles down. What do you check?"

**Diagnostic process:** "Growing, non-recovering `CDCLatencyTarget` (or
`CDCLatencySource`) means the replication instance genuinely can't keep
up, not just a transient blip, so I'd separate source-side lag from
target-side lag first — DMS reports both, and they point at different
fixes."

**Ranked root causes:**

1. **Replication instance undersized** for the actual change volume —
   CPU, memory, or (most commonly) I/O on the replication instance is
   maxed out and can't apply changes as fast as they arrive.
2. **Target-side write bottleneck** — the target (Redshift, Aurora,
   S3) can't absorb the write rate DMS is trying to push, especially
   if the target has its own contention (a busy Redshift cluster,
   throttled DynamoDB write capacity).
3. **A large, unbatched transaction on the source** — a bulk update or
   delete on the source database creates a single huge transaction that
   DMS has to apply as a unit, stalling the apply phase.
4. **LOB (large object) columns configured for full LOB mode**, which
   is dramatically slower than limited LOB mode because DMS makes a
   separate lookup per LOB value.
5. **Table-level validation enabled**, adding overhead on every apply
   cycle — useful for a one-time integrity check, expensive to leave on
   permanently.

**The fix:** resize the replication instance (or move to DMS Serverless
so capacity scales with load automatically), switch LOB handling from
full to limited mode with an explicit max size where possible, and
address target-side contention (WLM tuning on Redshift, provisioned
capacity on DynamoDB).

**Prevention:** alarm on `CDCLatencyTarget` with a threshold well below
"users are noticing," and size the replication instance from actual
observed change-data volume, not from the source database's total size.

---

## 8. "Athena queries that used to take seconds now regularly time out or take minutes. What's your process?"

**Diagnostic process:** "I'd pull the query execution details first —
specifically 'data scanned' and the count of files/partitions touched
— because Athena's performance profile is dominated by how much it has
to open and read, and that number tells me immediately whether this is
a partitioning problem, a small-files problem, or a genuine data growth
problem."

**Ranked root causes:**

1. **The small-files problem** — many small files (from frequent
   Firehose/streaming writes without compaction) mean Athena pays
   per-file overhead (opening, reading footer/metadata) that dwarfs the
   actual data volume; a table with a million 10 KB files is far slower
   than the same data in a thousand 10 MB files.
2. **Missing or ineffective partition pruning** — the table grew and
   query patterns filter on a column that isn't a partition key, so
   Athena scans every partition on every query.
3. **Partition explosion** — over-partitioning (e.g., partitioning by
   minute on a moderate-volume table) inverts the problem: too many
   tiny partitions, each with its own file-open overhead, and metadata
   operations against the Glue Catalog slow down too.
4. **Workgroup data-scan limit or query queuing** — a workgroup-level
   per-query data usage control is capping or killing queries that
   exceed it, which looks like a timeout but is actually a guardrail.

**The fix:** compact small files (a scheduled Glue job or S3
CTAS/INSERT OVERWRITE rewrite), add or fix partitioning to match actual
query filters, consider **partition projection** to avoid Glue Catalog
partition-metadata overhead entirely for high-cardinality partition
schemes, and convert to Parquet/ORC with reasonable target file sizes
(roughly 128 MB–1 GB) if the table is still in a row-based or
uncompressed format.

**Prevention:** a scheduled compaction job on any table fed by
streaming writes, and a partitioning review any time query patterns
change, since a partition scheme that was right at launch silently
stops matching usage as a table's query patterns evolve.

---

## 9. "An EMR job that's run for years suddenly fails with executors being killed and re-launched repeatedly. Diagnose it."

**Diagnostic process:** "Repeated executor loss (versus one clean OOM)
points at either memory pressure severe enough that YARN or the
cluster manager is killing executors preemptively, or Spot interruption
if this cluster runs on Spot task nodes. I'd check the resource manager
UI / CloudWatch for container kill reasons first — 'killed by YARN for
exceeding memory' is a very different fix than 'Spot instance
reclaimed.'"

**Ranked root causes:**

1. **Spot interruption on task nodes** without enough on-demand or
   diversified instance-type coverage, especially if a popular
   instance type's Spot pool tightened.
2. **Executor memory overhead misconfigured** relative to actual
   container memory, so the JVM exceeds its allotted container memory
   under a workload that grew (same skew story as the Glue case, but
   at the executor/container level here).
3. **Too many executors packed per node**, leaving too little memory
   headroom per executor once combined with a data volume increase.
4. **A dependency or library upgrade** changed memory behavior (a new
   Spark or EMR release bumped a default).

**The fix:** diversify Spot instance types/pools and use EMR's
instance fleets with an on-demand base capacity for resilience;
right-size `spark.executor.memory` and `spark.executor.memoryOverhead`
against actual container size; reduce executors-per-node if packing is
too tight.

**Prevention:** track Spot interruption rate as a metric per cluster,
and treat the same slow-growth skew monitoring recommended for Glue
(memory trending upward over months) as standard practice on any
long-lived EMR job too.

---

## 10. "A Step Functions state machine orchestrating a nightly pipeline starts failing intermittently, but re-running it manually always succeeds. What's your approach?"

**Diagnostic process:** "Intermittent failure that manual re-run fixes
is a strong signal of a transient dependency issue or a race condition,
not a logic bug — I'd pull the execution history for a failed run and
look at exactly which state failed and what error it returned, rather
than guessing."

**Ranked root causes:**

1. **A downstream service throttling or timing out under the specific
   load the nightly batch produces** (a Lambda, a Glue job start API
   call) that happens to succeed when re-run later against lower
   ambient load.
2. **A race condition against an upstream dependency** — the pipeline
   assumes an upstream job (a Glue crawler, an S3 write) finished, but
   there's no explicit success-signal wait, just a fixed delay that's
   occasionally too short.
3. **Missing or inadequate retry/backoff configuration** on a specific
   state, so a transient error that would resolve itself on a second
   attempt instead fails the whole execution immediately.
4. **A Lambda cold-start timeout** on a state with a tight timeout
   configured, intermittent under variable load.

**The fix:** add explicit retry with exponential backoff on the
specific failing state (Step Functions supports this natively per
state) rather than relying on manual re-runs; replace a fixed-delay
wait with an explicit completion signal (S3 event, Glue job status
poll) if a race condition is the cause.

**Prevention:** every state that calls an external service should have
retry/backoff configured by default as a team convention, not added
reactively after the first incident.

---

## 11. "DynamoDB writes start getting throttled during a specific hour every day. What's the likely cause and fix?"

**Diagnostic process:** "A throttle pattern tied to a specific hour
points at a predictable traffic pattern outrunning provisioned
capacity, or a hot partition key concentrated in that window — I'd
check `ConsumedWriteCapacityUnits` versus provisioned capacity for the
table and, separately, whether CloudWatch Contributor Insights shows
one partition key dominating writes during that hour."

**Ranked root causes:**

1. **A predictable batch job (nightly ETL write-back) exceeding
   provisioned write capacity** at that specific hour, and auto-scaling
   (if enabled) not reacting fast enough because it scales reactively
   with a lag, not instantly.
2. **A hot partition key** — writes concentrated on a small set of
   partition key values (e.g., a "today's date" key that every write
   during that hour shares) exceeding the per-partition throughput
   limit even though total table capacity looks fine on paper.
3. **On-demand mode not yet enabled**, and provisioned capacity was
   sized for average, not peak, load.

**The fix:** switch to on-demand capacity mode if the traffic pattern
is genuinely spiky and hard to forecast, or pre-scale provisioned
capacity ahead of the known batch window; redesign the partition key
to spread that specific write pattern across more values if it's a hot
key.

**Prevention:** Contributor Insights enabled by default on
write-heavy tables, and treating a "runs at the same time every day"
job as a known capacity-planning input rather than a surprise.

---

## 12. "A team reports their Amazon Data Firehose delivery stream is silently dropping records — data lands in S3 but rows are missing." (Currency note: this is the modern name for what used to be called Kinesis Data Firehose.)

**Diagnostic process:** "'Silently' is the key word — Firehose doesn't
actually drop data without a trace, so I'd go straight to the
error-output S3 prefix (or the CloudWatch delivery error logs) before
assuming true data loss, because in most cases the 'missing' records
are sitting in the configured error bucket, not gone."

**Ranked root causes:**

1. **A Lambda transformation failing on specific records** and those
   records being routed to the error output prefix instead of the main
   delivery prefix — this is by far the most common cause of "data
   that should be there isn't."
2. **A source/format mismatch causing format-conversion failures**
   (Firehose's Parquet/ORC conversion rejecting malformed records).
3. **Buffering hints causing a perceived (not actual) gap** — a
   consumer checking S3 mid-buffer-interval sees a temporary gap that
   resolves once the buffer flushes.
4. **Destination-side throttling** (rare, but possible against a
   heavily loaded Redshift or OpenSearch destination) causing retried
   or backed-off delivery that looks delayed rather than dropped.

**The fix:** check and fix whatever's failing in the Lambda
transformation for the specific malformed records, and reprocess the
records sitting in the error prefix once fixed.

**Prevention:** an alarm on the error-output prefix's object count
(or `DeliveryToS3.DataFreshness` and error metrics in CloudWatch), so
"records landing in the error bucket" pages someone immediately instead
of being discovered by a downstream consumer noticing a gap.

---

## 13. "A Redshift `COPY` command that loads nightly from S3 starts failing with a small number of rows rejected each night. How do you handle it?"

**Diagnostic process:** "First move is `STL_LOAD_ERRORS` (or the newer
system views) to see the exact rejection reason per row, rather than
guessing at a schema problem — the error usually names the exact column
and value."

**Ranked root causes:**

1. **A data type mismatch on a small subset of rows** — a source
   system occasionally sends a malformed value (an empty string where
   an integer is expected, a date in an unexpected format) that most
   rows don't hit.
2. **Encoding or delimiter issue on rows containing the delimiter
   character within a field** that wasn't properly quoted/escaped
   upstream.
3. **`MAXERROR` threshold set low enough that a normal, small level of
   dirty data trips a full job failure** rather than being tolerated
   and logged.

**The fix:** set an appropriate `MAXERROR` tolerance so a small, known
rate of dirty rows doesn't fail the whole load, route rejected rows to
a quarantine table or S3 prefix for review, and fix the upstream
producer if the same malformed pattern recurs consistently.

**Prevention:** a Glue Data Quality (DQDL) check upstream of the
`COPY`, so malformed rows are caught and flagged before they ever reach
Redshift, rather than being discovered at load time every single
night.

---

## 14. "Cross-account access to an encrypted S3 bucket suddenly stops working after a KMS key rotation. What happened?"

**Diagnostic process:** "I'd check whether this is *automatic* annual
key rotation (which keeps the same key ID and shouldn't break
anything) or a *manual* key rotation/replacement (a new key created and
data re-encrypted under it, or the key policy edited) — those are very
different failure modes and the fix depends on which one happened."

**Ranked root causes:**

1. **The cross-account role was granted access to the specific key
   version or was only referenced by an outdated key policy that wasn't
   updated when the key policy was edited** during what was intended as
   a routine rotation.
2. **A new CMK was created to replace the old one** (not the same thing
   as automatic rotation) and the cross-account grant was never
   recreated against the new key.
3. **The cross-account role's own IAM policy still references the old
   key ARN explicitly** rather than a more maintainable reference, and
   wasn't updated.

**The fix:** grant the cross-account principal access on the new/current
key's key policy (and update any IAM policies with hardcoded key ARNs),
and confirm the grant with a test read from the other account before
closing the incident.

**Prevention:** avoid hardcoding key ARNs in cross-account IAM policies
where a KMS grant or alias can be used instead, and treat any KMS key
policy change as a reviewed, tested change — the same rigor as an IAM
policy change — given how easy it is to silently break cross-account
access.

---

## 15. "A nightly MWAA DAG that's been reliable for a year starts randomly getting stuck 'running' with no progress and no error, requiring a manual clear to unstick." What do you check?

**Diagnostic process:** "'Stuck with no error' in Airflow usually means
a scheduler or worker resource problem, not a task logic problem — I'd
check MWAA environment metrics (scheduler heartbeat, worker CPU/memory,
queue depth) before looking at the DAG code at all."

**Ranked root causes:**

1. **Worker resources exhausted** — the environment's worker
   count/size hasn't scaled with a growing number of concurrent tasks
   or DAGs, so tasks queue indefinitely waiting for a free worker slot.
2. **A task waiting on an external resource that itself is stuck**
   (a sensor polling for a file or an upstream job that never signals
   completion), which looks like the DAG is stuck when really one
   sensor task is waiting forever with no timeout set.
3. **Scheduler under memory pressure** from a large number of DAGs or
   very frequent DAG parsing, causing scheduling delays severe enough
   to look like a hang.

**The fix:** size up the MWAA environment class/worker count if
resource exhaustion is confirmed; add an explicit timeout to any sensor
or external-wait task so it fails loudly instead of hanging silently;
reduce DAG parsing overhead (fewer/leaner DAG files, avoid expensive
top-level code in DAG definitions).

**Prevention:** every sensor/external-wait task gets a mandatory
timeout as a team convention, and MWAA environment metrics get the same
alarm coverage as any other production compute — worker queue depth
specifically is an early warning that fires well before a full stuck
state.

---

## 16. "A well-tested Glue Data Quality (DQDL) ruleset starts failing a job every night, but when you manually inspect the data, it looks fine. What's your process?"

**Diagnostic process:** "This is often a rule-versus-reality mismatch
rather than a real data problem, so I'd pull the DQDL evaluation
results (which specific rule failed, and its computed value) before
assuming either 'the data is fine, ignore it' or 'the data is broken' —
both are premature."

**Ranked root causes:**

1. **A rule with a static threshold that didn't account for legitimate
   organic growth or seasonality** — a completeness or row-count rule
   written against launch-time data volume now fails every night simply
   because the table correctly grew past the threshold.
2. **A rule evaluating a column whose legitimate value distribution
   shifted** (a new valid category value appeared upstream that the
   rule's allowed-value list didn't anticipate).
3. **A genuine intermittent data quality issue** that manual spot-check
   doesn't happen to catch because it only affects a small percentage
   of rows — this is the case where the ruleset is doing exactly its
   job and "it looks fine" is wrong, just from too small a manual
   sample.

**The fix:** if the rule's threshold is simply stale, update it
deliberately (not by silently loosening it under pressure to make the
job pass — that defeats the purpose); if it's a genuine new valid
category, update the rule's allowed set; if it's a real intermittent
issue, don't touch the rule at all — fix the upstream data.

**Prevention:** DQDL rules with static thresholds should be reviewed on
a schedule (quarterly is reasonable) against actual current data
volume/distribution, the same way capacity planning gets revisited —
"launch-time assumptions baked into a rule forever" is the recurring
root cause across nearly all of these false-alarm incidents.

---

## Cheat sheet — first move for each symptom

| Symptom | First thing to check |
|---|---|
| Glue OOM after months of stability | Executor memory trend over time + partition size skew |
| `IteratorAge` climbing | Per-shard metrics, not stream aggregate — hunt for a hot shard |
| Redshift queries queuing | `SVL_QUERY_QUEUE_INFO` + whether WLM is fixed or auto |
| S3 403, "used to work" | CloudTrail denied event → which layer produced the deny |
| Lake Formation denial despite correct IAM | Is the table LF-governed, and is there an explicit LF grant/tag match |
| Lambda throttling on stream trigger | Concurrency limit vs. parallelization factor vs. downstream throttle |
| DMS lag not recovering | Source vs. target lag separately; replication instance sizing; LOB mode |
| Athena slow/timeout | Data scanned + file count per query — small files vs. missing partition pruning |
| EMR executors dying repeatedly | Container kill reason: Spot interruption vs. memory overhead |
| Step Functions intermittent failure, manual re-run works | Execution history for the exact failing state's error |

**Interview framing to remember:** every strong answer in this file
follows the same shape — **state the diagnostic signal you'd check
first and why**, **rank causes by probability with a reason**, **give
the fix**, **give the prevention**. Interviewers are grading that
shape, not just the final noun.
