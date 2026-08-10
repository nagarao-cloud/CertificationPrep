# Troubleshooting Playbooks — Exam-Scenario Reference

> **Exam-focused, not narrative.** This file answers "which
> service/setting fixes this" fast, the way a question stem presents
> it. For the interview-style version of the same incidents — walk-me-
> through-your-process, ranked causes with reasoning, told as a story —
> see [`08-interview/Troubleshooting.md`](../08-interview/Troubleshooting.md).
> Same underlying incidents in places, deliberately different shape:
> this file is a lookup table with boxed flowcharts, that one is a
> conversation.
>
> Twelve playbooks: Glue OOM, Kinesis hot shard, Redshift WLM backup, S3
> 403, Lake Formation denial, Lambda throttling, DMS replication lag,
> Athena small-files/timeout, EMR executor failures, DynamoDB write
> throttling, Amazon Data Firehose "missing" records, and MWAA DAGs
> stuck running — plus a bonus symptom→fix quick table at the end
> covering a few more that show up on the exam but don't need a full
> playbook each.

---

## 1. Glue job OOM / runs slower and slower over time

```
┌─────────────────────────────────────────────────────────┐
│ SYMPTOM: Glue job fails with OutOfMemoryError, or        │
│ runtime has been creeping up run over run                │
└─────────────────────┬─────────────────────────────────────┘
                       ▼
        ┌──────────────────────────────┐
        │ Check CloudWatch:             │
        │ per-executor memory + which   │
        │ stage/transform fails         │
        └──────────────┬────────────────┘
                        ▼
      ┌─────────────────────────────────┐
      │ Is ONE partition/key much larger │
      │ than the rest (skew)?            │
      └───────┬───────────────────┬──────┘
           YES│                   │NO
              ▼                   ▼
   ┌────────────────────┐  ┌──────────────────────────┐
   │ FIX: repartition or │  │ Is a JOIN fanning out     │
   │ salt the hot key;   │  │ (one-to-many exploded)?   │
   │ broadcast small side│  └──────┬─────────────┬──────┘
   │ of any join          │     YES│              │NO
   └────────────────────┘         ▼              ▼
                          ┌──────────────┐ ┌────────────────────┐
                          │ FIX: explicit│ │ FIX: bump worker    │
                          │ broadcast    │ │ type/count (G.1X→   │
                          │ join hint    │ │ G.2X/G.4X/G.8X) as  │
                          └──────────────┘ │ short-term relief;  │
                                            │ check job bookmark  │
                                            │ isn't reprocessing  │
                                            │ full history        │
                                            └────────────────────┘
```

| Root cause (ranked) | Fix | Prevention |
|---|---|---|
| 1. Data skew (one key/partition dominant) | Repartition/salt the key before the transform | Alarm on executor memory trending upward month over month |
| 2. Join fanout (1:many exploded) | Broadcast the small side explicitly | Review join cardinality assumptions when source volume changes |
| 3. Bookmark not enabled/reset, reprocessing everything | Enable bookmarks; reset only when a full reprocess is intended | Never disable bookmarks as a "fix" — that masks the real issue |
| 4. Simply undersized worker type for current data volume | Increase worker type/count (G.1X→G.2X/G.4X/G.8X) | Periodic row-count/partition-size check on growing tables |

**Exam tell:** "a Glue job that has run fine for months starts failing"
→ organic data growth crossing a skew or memory threshold, **not** a
code bug. The right-answer option is almost always repartition/salt or
worker-type increase, not "rewrite the job."

---

## 2. Kinesis hot shard / rising `IteratorAge`

```
┌─────────────────────────────────────────────────────────┐
│ SYMPTOM: IteratorAgeMilliseconds climbing, consumer       │
│ falling further behind over time                          │
└─────────────────────┬─────────────────────────────────────┘
                       ▼
          ┌─────────────────────────────┐
          │ Check PER-SHARD metrics, not │
          │ stream aggregate              │
          └──────────────┬────────────────┘
                          ▼
        ┌──────────────────────────────────┐
        │ Is ONE shard's IncomingBytes way   │
        │ above the others (hot shard)?      │
        └───────┬────────────────────┬───────┘
             YES│                    │NO
                ▼                    ▼
   ┌────────────────────────┐  ┌─────────────────────────────┐
   │ Partition key is low-   │  │ Is total throughput simply   │
   │ cardinality → FIX:      │  │ above total shard capacity?  │
   │ higher-cardinality key  │  └──────┬────────────────┬──────┘
   │ (hash/random suffix)    │      YES│                │NO
   │ + reshard                │        ▼                ▼
   └────────────────────────┘ ┌────────────────┐ ┌──────────────────┐
                               │ FIX: switch to  │ │ Multiple consumers│
                               │ on-demand mode  │ │ sharing standard   │
                               │ or add shards    │ │ throughput?        │
                               └────────────────┘ └─────────┬─────────┘
                                                          YES│
                                                              ▼
                                                   ┌────────────────────┐
                                                   │ FIX: enhanced       │
                                                   │ fan-out (dedicated  │
                                                   │ 2MB/s per consumer) │
                                                   └────────────────────┘
```

| Root cause (ranked) | Fix | Prevention |
|---|---|---|
| 1. Low-cardinality partition key → hot shard | Redesign key for higher cardinality, reshard | Partition-key design review before any new producer ships |
| 2. Under-provisioned total shard capacity | On-demand mode, or increase shard count | Capacity-plan from actual peak throughput, not average |
| 3. Multiple consumers contending on standard throughput | Enhanced fan-out per consumer | Default to fan-out when >1 consumer app is known upfront |
| 4. Consumer-side processing got slower | Profile/optimize consumer logic | — |

**Exam tell:** the phrase "consumers are falling behind" or
"`IteratorAge` increasing" almost always pairs with either a
**partition key** answer (hot shard) or an **enhanced fan-out** answer
(multiple consumers) — read the scenario for which one it's describing
before picking.

---

## 3. Redshift WLM queue backup

```
┌─────────────────────────────────────────────────────────┐
│ SYMPTOM: Queries queuing for minutes during business hours│
└─────────────────────┬─────────────────────────────────────┘
                       ▼
         ┌───────────────────────────────┐
         │ Check SVL_QUERY_QUEUE_INFO /   │
         │ WLM query monitoring view       │
         └──────────────┬──────────────────┘
                         ▼
       ┌────────────────────────────────────┐
       │ One long-running query holding a    │
       │ slot, or genuinely too much          │
       │ concurrent demand?                   │
       └──────┬───────────────────────┬───────┘
     ONE QUERY │                      │TOO MUCH CONCURRENCY
               ▼                      ▼
   ┌────────────────────┐  ┌─────────────────────────────┐
   │ FIX: EXPLAIN it,     │  │ Fixed WLM slot count too low?│
   │ fix missing sort/     │  └──────┬────────────────┬──────┘
   │ dist key, or add a    │      YES│                │NO (auto-WLM
   │ QMR to abort/log       │        ▼                │ already on)
   │ runaway queries        │ ┌────────────────┐        ▼
   └────────────────────┘  │ FIX: switch to   │ ┌────────────────────┐
                            │ auto-WLM         │ │ FIX: enable          │
                            └────────────────┘ │ concurrency scaling   │
                                                 │ for transient bursts  │
                                                 └────────────────────┘
```

| Root cause (ranked) | Fix | Prevention |
|---|---|---|
| 1. Fixed WLM slot count too low for real concurrency | Auto-WLM (dynamic slot allocation) | Monitor queue depth trend, not just point-in-time |
| 2. One unoptimized query holding a slot | Fix sort/dist key; add a query monitoring rule (QMR) to abort/log | `EXPLAIN` review before shipping new heavy queries |
| 3. Genuine burst above normal concurrency | Concurrency scaling | Enable proactively on the interactive/BI queue |
| 4. Stale statistics causing a bad plan | Confirm `ANALYZE` isn't disabled (mostly automatic now) | — |

**Exam tell:** "dashboard queries are slow only during business hours,
BI users complain" → **concurrency scaling** or **auto-WLM**, not a
bigger cluster — resizing nodes is the wrong-answer trap when the real
problem is *concurrency*, not raw compute per query.

---

## 4. S3 403 errors ("used to work, now doesn't")

```
┌─────────────────────────────────────────────────────────┐
│ SYMPTOM: GetObject/PutObject returns 403 intermittently   │
│ or for a specific role                                    │
└─────────────────────┬─────────────────────────────────────┘
                       ▼
        ┌───────────────────────────────┐
        │ Check CloudTrail for the exact  │
        │ denied event — which layer       │
        │ produced the deny?                │
        └──────────────┬────────────────────┘
                        ▼
   ┌─────────────────────────────────────────┐
   │ Explicit deny anywhere (SCP, bucket      │
   │ policy, permission boundary)?             │
   └──────┬────────────────────────────┬───────┘
       YES│                            │NO
          ▼                            ▼
 ┌──────────────────┐   ┌──────────────────────────────────┐
 │ FIX: find and      │   │ Is the object SSE-KMS encrypted   │
 │ remove/scope the    │   │ and caller lacks kms:Decrypt on   │
 │ explicit deny        │   │ the KEY POLICY (not just IAM)?    │
 └──────────────────┘   └──────┬─────────────────────┬───────┘
                             YES│                     │NO
                                ▼                     ▼
                     ┌────────────────────┐ ┌──────────────────────┐
                     │ FIX: add caller to  │ │ Check VPC endpoint     │
                     │ KMS key policy       │ │ policy / bucket policy │
                     │                      │ │ condition (IP, VPC,    │
                     │                      │ │ PrincipalOrgID)         │
                     └────────────────────┘ └──────────────────────┘
```

| Root cause (ranked) | Fix | Prevention |
|---|---|---|
| 1. Explicit deny (SCP/bucket policy/boundary) anywhere in the chain | Locate via CloudTrail, remove/scope it | IAM Access Analyzer on policy changes |
| 2. KMS key policy missing the caller (SSE-KMS object) | Add caller's role to the key policy | Treat key-policy changes with IAM-level review rigor |
| 3. VPC/interface endpoint policy restricting access | Adjust endpoint policy | Document endpoint policies alongside bucket policies |
| 4. Bucket policy condition tightened without notice | Adjust the condition or grant the caller an exception | Change review process for bucket policy edits |
| 5. Expired temporary credentials mid-session | Refresh/extend session | — |

**Exam tell:** "IAM policy looks correct but access is still denied on
an encrypted object" → the answer is almost always **the KMS key
policy**, not the S3 bucket policy. This is the #1 most-tested S3
403 trap.

---

## 5. Lake Formation access denial despite correct IAM

```
┌─────────────────────────────────────────────────────────┐
│ SYMPTOM: Role has broad/correct-looking IAM permissions   │
│ but is denied reading a table via Athena/Redshift Spectrum│
└─────────────────────┬─────────────────────────────────────┘
                       ▼
        ┌───────────────────────────────┐
        │ Is the table registered under   │
        │ Lake Formation governance?       │
        └──────┬────────────────────┬──────┘
             NO│                    │YES
               ▼                    ▼
    ┌────────────────────┐ ┌─────────────────────────────┐
    │ Not an LF issue —    │ │ Does the principal have an   │
    │ re-check plain IAM/  │ │ explicit LF grant OR matching │
    │ S3/bucket policy      │ │ LF-Tag on this table?          │
    └────────────────────┘ └──────┬─────────────────┬───────┘
                                NO │                 │YES
                                   ▼                 ▼
                        ┌────────────────────┐ ┌──────────────────────┐
                        │ FIX: grant SELECT    │ │ Check column/row-level│
                        │ (or matching LF-Tag)  │ │ filter excluding the   │
                        │ via Lake Formation     │ │ specific data queried  │
                        └────────────────────┘ └──────────────────────┘
```

| Root cause (ranked) | Fix | Prevention |
|---|---|---|
| 1. No Lake Formation grant exists for this principal | Grant via Lake Formation console/API, not IAM | Document per-table whether IAM-only or LF-governed at registration time |
| 2. LF-Tag mismatch (ABAC) | Align tag assignment on principal and resource | — |
| 3. Column/row filter excludes needed data | Adjust the data filter | — |
| 4. Cross-account share not accepted (RAM) | Accept the resource share on the receiving account | — |

**Exam tell:** the single fastest tell that a scenario is a Lake
Formation question, not an IAM question, is any mention of **column,
row, or cell-level** restriction — IAM cannot express that granularity
at all.

---

## 6. Lambda throttling

```
┌─────────────────────────────────────────────────────────┐
│ SYMPTOM: Throttles metric rising under load                │
└─────────────────────┬─────────────────────────────────────┘
                       ▼
        ┌───────────────────────────────┐
        │ Is ConcurrentExecutions near     │
        │ the account/function limit?       │
        └──────┬────────────────────┬──────┘
             YES│                   │NO
                ▼                   ▼
    ┌────────────────────┐ ┌─────────────────────────────┐
    │ FIX: raise reserved  │ │ Stream-triggered? Check event │
    │ concurrency, or use   │ │ source mapping parallelization │
    │ provisioned concurrency│ │ factor (default 1 per shard)   │
    │ for predictable load   │ └──────┬─────────────────┬──────┘
    └────────────────────┘        LOW │                 │OK
                                       ▼                 ▼
                            ┌────────────────────┐ ┌──────────────────────┐
                            │ FIX: increase        │ │ Check downstream       │
                            │ parallelization       │ │ service (DynamoDB,    │
                            │ factor (up to 10)      │ │ API) — is IT throttling│
                            └────────────────────┘ │ and backing up here?    │
                                                     └──────────────────────┘
```

| Root cause (ranked) | Fix | Prevention |
|---|---|---|
| 1. Account/function concurrency limit hit | Raise reserved concurrency; provisioned concurrency for baseline | Alarm on `ConcurrentExecutions` nearing limit |
| 2. Low parallelization factor on stream trigger | Increase parallelization factor (up to 10 per shard) | Load-test against peak, not average, throughput |
| 3. Downstream throttling propagating back | Fix/backoff the actual downstream throttle | — |
| 4. Batch size/window misconfigured | Tune batching to reduce invocation churn | — |

**Exam tell:** "under 15 minutes, event-driven, but suddenly failing at
scale" pointing at Lambda usually resolves to either **reserved
concurrency** or **event source mapping parallelization factor** — read
whether the trigger is a stream (parallelization factor) or direct
invoke (reserved concurrency).

---

## 7. DMS replication lag

```
┌─────────────────────────────────────────────────────────┐
│ SYMPTOM: CDCLatencyTarget growing, not recovering          │
└─────────────────────┬─────────────────────────────────────┘
                       ▼
        ┌───────────────────────────────┐
        │ Source lag or target lag?        │
        │ (DMS reports both separately)     │
        └──────┬────────────────────┬──────┘
        SOURCE  │                   │TARGET
                ▼                   ▼
    ┌────────────────────┐ ┌─────────────────────────────┐
    │ Replication instance │ │ Target can't absorb write rate│
    │ CPU/memory/IO maxed?  │ │ (Redshift busy, DynamoDB      │
    └──────┬─────────────┬─┘ │ throttled)?                    │
       YES │             │NO └──────┬─────────────────┬──────┘
           ▼             ▼      YES │                 │NO
 ┌──────────────────┐ ┌──────────┐ ▼            ┌────────────────┐
 │ FIX: resize        │ │ Check LOB │ FIX: fix     │ Large unbatched │
 │ replication instance│ │ mode —    │ target-side  │ transaction on  │
 │ or move to DMS       │ │ full LOB  │ contention   │ source?          │
 │ Serverless           │ │ = slow    │               └────────────────┘
 └──────────────────┘ └──────────┘
```

| Root cause (ranked) | Fix | Prevention |
|---|---|---|
| 1. Replication instance undersized | Resize, or move to DMS Serverless | Size from observed change-data volume, not source DB total size |
| 2. Target-side write bottleneck | Address target contention (WLM tuning, provisioned capacity) | — |
| 3. Large unbatched source transaction | No prevention — a monitoring/alert tolerance instead | Alarm well below "users notice" threshold |
| 4. Full LOB mode instead of limited | Switch to limited LOB mode with explicit max size | Set LOB mode correctly at task creation |
| 5. Table-level validation left on permanently | Disable after initial integrity check completes | — |

**Exam tell:** "continuous replication from an on-prem database, low
operational overhead" → **AWS DMS with CDC**. If the follow-up
mentions schema conversion, the current correct tool is **DMS Schema
Conversion** — AWS SCT is retired from scope.

---

## 8. Athena timeout / small-files problem

```
┌─────────────────────────────────────────────────────────┐
│ SYMPTOM: Queries that used to run in seconds now time out │
│ or take minutes                                             │
└─────────────────────┬─────────────────────────────────────┘
                       ▼
       ┌────────────────────────────────┐
       │ Check "data scanned" + file/     │
       │ partition count for the query     │
       └──────────────┬────────────────────┘
                       ▼
     ┌───────────────────────────────────┐
     │ Many small files (streaming writes, │
     │ no compaction)?                       │
     └──────┬────────────────────────┬──────┘
         YES│                        │NO
            ▼                        ▼
 ┌────────────────────┐  ┌─────────────────────────────┐
 │ FIX: compact via     │  │ Query filters on a column     │
 │ scheduled Glue job /  │  │ that ISN'T the partition key?  │
 │ CTAS rewrite; target   │  └──────┬─────────────────┬──────┘
 │ ~128MB–1GB files       │      YES│                 │NO
 └────────────────────┘         ▼                 ▼
                        ┌────────────────┐ ┌──────────────────────┐
                        │ FIX: add/fix    │ │ Over-partitioned        │
                        │ partitioning to  │ │ (too granular, e.g.     │
                        │ match query       │ │ per-minute)? Consider   │
                        │ filters; consider │ │ coarser partitions or    │
                        │ partition          │ │ partition projection     │
                        │ projection         │ └──────────────────────┘
                        └────────────────┘
```

| Root cause (ranked) | Fix | Prevention |
|---|---|---|
| 1. Small-files problem (streaming writes, no compaction) | Scheduled compaction (Glue job or CTAS/INSERT OVERWRITE) | Compaction job on any table fed by streaming writes |
| 2. Missing/ineffective partition pruning | Add/fix partitioning to match actual query filters | Review partitioning when query patterns change |
| 3. Partition explosion (over-partitioned) | Coarser partitioning; **partition projection** for high-cardinality schemes | — |
| 4. Workgroup data-scan limit hit | Confirm the "timeout" is actually the workgroup guardrail | — |

**Exam tell:** "cost of Athena queries is unexpectedly high" and
"Athena queries are slow" are often the **same root cause** —
unpartitioned or small-files data — because Athena's pricing model
(per byte scanned) and its latency both scale with how much it has to
open and read.

---

## 9. EMR executor failures

```
┌─────────────────────────────────────────────────────────┐
│ SYMPTOM: Executors repeatedly killed and relaunched         │
└─────────────────────┬─────────────────────────────────────┘
                       ▼
       ┌────────────────────────────────┐
       │ Check container/executor kill    │
       │ reason (resource manager UI /     │
       │ CloudWatch)                        │
       └──────┬─────────────────────┬──────┘
   SPOT RECLAIM│                    │MEMORY EXCEEDED
               ▼                    ▼
    ┌────────────────────┐ ┌─────────────────────────────┐
    │ FIX: diversify Spot  │ │ spark.executor.memory +       │
    │ instance types/pools; │ │ memoryOverhead correctly        │
    │ use instance fleets    │ │ sized vs container memory?      │
    │ with on-demand base    │ └──────┬─────────────────┬──────┘
    └────────────────────┘      NO   │                 │YES
                                       ▼                 ▼
                            ┌────────────────┐ ┌──────────────────────┐
                            │ FIX: right-size  │ │ Too many executors     │
                            │ memory settings   │ │ packed per node —       │
                            │ against actual     │ │ reduce executors-per-  │
                            │ container size      │ │ node                    │
                            └────────────────┘ └──────────────────────┘
```

| Root cause (ranked) | Fix | Prevention |
|---|---|---|
| 1. Spot interruption on task nodes | Diversify Spot pools; instance fleets with on-demand base | Track Spot interruption rate per cluster as a metric |
| 2. Executor memory/overhead misconfigured | Right-size `spark.executor.memory`/`memoryOverhead` | Apply the same slow-growth monitoring used for Glue |
| 3. Too many executors per node | Reduce executor density | — |
| 4. Version/dependency upgrade changed defaults | Review release notes on EMR/Spark version bumps | — |

**Exam tell:** "PB-scale + lowest cost" pointing at EMR + Spot almost
always pairs with a follow-up question about **resilience** — the
correct answer combines Spot on **task** nodes only (never primary,
rarely core) with **instance fleets** for diversification, not a single
instance type.

---

## 10. DynamoDB write throttling

```
┌─────────────────────────────────────────────────────────┐
│ SYMPTOM: Writes throttle, often at a predictable time      │
│ of day                                                       │
└─────────────────────┬─────────────────────────────────────┘
                       ▼
       ┌────────────────────────────────┐
       │ Check ConsumedWriteCapacityUnits │
       │ vs. provisioned, AND Contributor  │
       │ Insights for a dominant key        │
       └──────┬─────────────────────┬──────┘
   TOTAL CAPACITY│                  │ONE KEY DOMINATES
      EXCEEDED    ▼                  ▼
      ┌────────────────────┐ ┌─────────────────────────────┐
      │ Is the traffic       │ │ FIX: redesign the partition   │
      │ pattern predictable   │ │ key for higher cardinality —   │
      │ (same hour daily)?    │ │ per-partition throughput limits │
      └──────┬─────────────┬─┘ │ apply even if table-level        │
         YES │             │NO │ capacity looks sufficient          │
             ▼             ▼   └─────────────────────────────┘
   ┌──────────────────┐ ┌──────────────────┐
   │ FIX: pre-scale     │ │ FIX: switch to     │
   │ provisioned capacity│ │ on-demand mode      │
   │ ahead of the known   │ │ if load is genuinely│
   │ window, or use        │ │ hard to forecast     │
   │ scheduled scaling      │ └──────────────────┘
   └──────────────────┘
```

| Root cause (ranked) | Fix | Prevention |
|---|---|---|
| 1. Predictable batch write exceeding provisioned capacity | Pre-scale ahead of the known window, or scheduled scaling | Treat a known daily job as a capacity-planning input, not a surprise |
| 2. Hot partition key concentrating writes | Redesign key for higher cardinality | Contributor Insights enabled by default on write-heavy tables |
| 3. Auto-scaling reacting too slowly to a sudden spike | On-demand mode for genuinely spiky/unpredictable traffic | — |

**Exam tell:** "table-level capacity looks sufficient but writes still
throttle" is the signature phrase for a **hot partition key**, not a
capacity sizing problem — per-partition throughput limits apply
regardless of total provisioned capacity.

---

## 11. Amazon Data Firehose "missing" records

```
┌─────────────────────────────────────────────────────────┐
│ SYMPTOM: Data lands in S3 via Firehose but rows appear      │
│ to be missing, no error surfaced to the team                │
└─────────────────────┬─────────────────────────────────────┘
                       ▼
        ┌───────────────────────────────┐
        │ Check the error-output S3         │
        │ prefix / CloudWatch delivery        │
        │ error metrics FIRST                  │
        └──────┬─────────────────────┬──────┘
     RECORDS PRESENT│                │NOTHING IN ERROR PREFIX
     IN ERROR PREFIX ▼                ▼
    ┌────────────────────┐ ┌─────────────────────────────┐
    │ Lambda transform      │ │ Check buffering hints —        │
    │ failing on specific     │ │ consumer may be checking S3     │
    │ records                 │ │ mid-buffer-interval (not a       │
    └──────┬─────────────┘ │ real gap)                          │
           ▼                └─────────────────────────────┘
 ┌──────────────────┐
 │ FIX: fix the        │
 │ transformation logic  │
 │ for the failing shape; │
 │ reprocess quarantined   │
 │ records                  │
 └──────────────────┘
```

| Root cause (ranked) | Fix | Prevention |
|---|---|---|
| 1. Lambda transformation failing on malformed records | Fix transform logic; reprocess from error prefix | Alarm on error-output object count, not just delivery success rate |
| 2. Format-conversion failure (Parquet/ORC rejecting a record) | Correct the source format issue upstream | Validate schema before it reaches Firehose where possible |
| 3. Perceived gap from buffering interval, not real loss | Wait for buffer flush; re-check | Document expected buffering delay for downstream consumers |
| 4. Destination-side throttling (Redshift/OpenSearch busy) | Address destination contention | — |

**Exam tell:** "silently dropping records" is almost never true data
loss with Firehose — the records are sitting in the **error-output
prefix**, and the fix is to check there first, not to assume the
pipeline lost data outright.

---

## 12. MWAA DAG stuck "running" with no error

```
┌─────────────────────────────────────────────────────────┐
│ SYMPTOM: A previously reliable DAG shows "running" with     │
│ no progress and no error, requiring a manual clear            │
└─────────────────────┬─────────────────────────────────────┘
                       ▼
       ┌────────────────────────────────┐
       │ Check MWAA environment metrics —  │
       │ scheduler heartbeat, worker         │
       │ CPU/memory, task queue depth          │
       └──────┬─────────────────────┬──────┘
   QUEUE DEPTH  │                   │QUEUE NORMAL
   CLIMBING      ▼                   ▼
    ┌────────────────────┐ ┌─────────────────────────────┐
    │ FIX: increase MWAA    │ │ Is a specific task a sensor    │
    │ environment class or   │ │ waiting on an external           │
    │ worker count             │ │ resource with NO timeout set?    │
    └────────────────────┘ └──────┬─────────────────┬──────┘
                                YES│                 │NO
                                   ▼                 ▼
                        ┌────────────────────┐ ┌──────────────────────┐
                        │ FIX: add an explicit │ │ Check scheduler under   │
                        │ timeout to the        │ │ memory pressure from     │
                        │ sensor task; it should│ │ excessive DAG count/      │
                        │ fail loudly, not hang  │ │ parsing overhead           │
                        └────────────────────┘ └──────────────────────┘
```

| Root cause (ranked) | Fix | Prevention |
|---|---|---|
| 1. Worker resource exhaustion (growing DAG/task count) | Size up environment class or worker count | Alarm on task queue depth as an early-warning signal |
| 2. Sensor/external-wait task with no timeout | Add explicit timeout so it fails instead of hanging | Mandatory timeout on every sensor task as a team convention |
| 3. Scheduler under memory pressure from DAG parsing overhead | Reduce DAG count/parsing cost (avoid expensive top-level DAG code) | — |

**Exam tell:** "stuck running with no error" in an orchestration
question is a strong signal the correct answer involves **adding a
timeout** to whatever step waits on an external condition — Airflow
(and Step Functions) don't fail loudly by default when something simply
never signals completion.

---

## Bonus — quick symptom → fix table (no full playbook needed)

| Symptom | Likely cause | Fix |
|---|---|---|
| Redshift `COPY` rejecting a small % of rows nightly | Data type mismatch on a subset of source rows | Set appropriate `MAXERROR`; quarantine rejects; add upstream Glue Data Quality check |
| Cross-account S3 access breaks after a KMS "rotation" | Manual key replacement (not automatic rotation) without updating the grant | Grant the account/role on the new key's key policy |
| Glue Data Quality (DQDL) rule fails nightly, data looks fine manually | Static threshold stale vs. organic growth | Review/update the threshold deliberately, don't silently loosen |
| Step Functions execution fails intermittently, manual re-run always succeeds | Transient downstream throttle, or a race condition against an upstream signal | Add retry/backoff per state; replace fixed-delay waits with explicit completion signals |
| Redshift `UNLOAD` produces far more files than expected | No `PARALLEL OFF` or file-size hint set, or slice count mismatch | Set `MAXFILESIZE`/`PARALLEL` appropriately for the downstream consumer |
| Glue crawler runs but the catalog schema doesn't match reality | Crawler classifier misdetecting format, or schema evolved beyond crawler's inference | Use explicit classifiers; consider disabling crawler schema updates in favor of an explicit DDL-managed schema |

---

## Cross-reference

| Need | Go to |
|---|---|
| Interview-style narrative version of these same incidents | `08-interview/Troubleshooting.md` |
| Domain 3 troubleshooting task statements in full | `01-domains/DOMAIN-3-DATA-OPERATIONS.md` §3.3.6 |
| Cost angle on the same failure modes | `00-START-HERE/COST-OPTIMIZATION.md` |
| Security-layer denial scenarios (S3 403, Lake Formation) in checklist form | `00-START-HERE/SECURITY.md` |
