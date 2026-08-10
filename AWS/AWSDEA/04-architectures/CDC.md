# Change Data Capture (CDC) Architecture

> CDC is the mechanism that feeds bronze in both `Data-Lake.md` and
> `Lakehouse.md` when the source is a live operational database rather
> than a batch file drop. The MERGE-based silver build described in
> `Lakehouse.md` is CDC's natural landing target — read that file's
> "Bronze → Silver via MERGE INTO" section alongside this one. This
> file is also consistent with `DOMAIN-1-DATA-INGESTION.md`'s CDC/DMS
> coverage and `DOMAIN-2-DATA-STORE-MANAGEMENT.md`'s Iceberg
> `MERGE INTO` material — nothing here contradicts either.

## What CDC actually is, and why it's not one single mechanism

Change Data Capture means: instead of periodically re-pulling an
entire source table (expensive, slow, and blind to *when* something
changed), you capture a **stream of row-level change events**
(insert/update/delete) as they happen at the source, and apply them
downstream continuously. On AWS, "CDC" shows up as **three genuinely
different mechanisms**, chosen by what the source system is:

| Source is... | CDC mechanism | Why |
|---|---|---|
| A general relational DB (on-prem Oracle/SQL Server/MySQL/PostgreSQL, or a source not on the zero-ETL supported list) | **AWS DMS** (full load, then ongoing replication reading the transaction log) | Purpose-built, broadest source support, works for heterogeneous migrations with SCT |
| Aurora/RDS MySQL, or DynamoDB, going straight to Redshift/OpenSearch, no custom pipeline desired | **Zero-ETL integration** | Fully managed, no replication instance to run, lowest operational overhead — but only for the specific supported source→target pairs |
| DynamoDB, and you need an event stream (not just a warehouse sync) to drive Lambda/other consumers | **DynamoDB Streams** | Native, ordered-per-partition-key change log built into DynamoDB itself |

These are not interchangeable — picking between them is a "what is the
source, and what is the target" question, not a preference. Domain 1's
matrix reflex is worth restating here because it's exactly this
architecture's decision point: *"continuously replicate an on-prem
database" → DMS; "Aurora/DynamoDB → Redshift, no pipeline" → zero-ETL;
"DynamoDB source change events driving compute" → DynamoDB Streams.*

---

## The reference architecture (DMS-driven CDC into a lakehouse)

```
                    CDC ARCHITECTURE — DMS FULL LOAD + CDC INTO LAKEHOUSE
                    =======================================================

  SOURCE DATABASE (on-prem Oracle / RDS / Aurora)
  Transaction log: binlog (MySQL) / WAL (PostgreSQL) /
                   redo log + supplemental logging (Oracle)
        |
        v
  +------------------+
  |   AWS SCT          |   (heterogeneous migrations only —
  |  (schema convert)  |    Oracle -> PostgreSQL, etc. Converts
  +------------------+    schema/DDL; DMS does NOT do this.)
        |
        v
  +---------------------------------------------------------------+
  |                  AWS DMS REPLICATION INSTANCE                   |
  |                                                                   |
  |   PHASE 1: FULL LOAD  — bulk-copies existing table snapshot       |
  |   PHASE 2: CDC        — tails the transaction log continuously,    |
  |            starting from the exact LSN/SCN the full load ended at  |
  +---------------------------------------------------------------+
        |
        |  target: S3 (Parquet/CSV, CDC files timestamped + LSN-tagged)
        v
  +---------------------------------------------------------------+
  |         BRONZE — raw CDC event files, s3://lake-raw/cdc/<table>/  |
  |         Each row tagged: operation (I/U/D), source LSN/timestamp   |
  +---------------------------------------------------------------+
        |
        |  Glue Streaming job / scheduled Glue job:
        |  dedupe by primary key, keep only the LATEST LSN per key
        |  within the batch, then MERGE INTO
        v
  +---------------------------------------------------------------+
  |     SILVER — Iceberg table, upserted via MERGE INTO               |
  |     MERGE INTO silver.orders t                                     |
  |     USING bronze_batch s ON t.order_id = s.order_id                |
  |     WHEN MATCHED AND s.op='U' THEN UPDATE ...                      |
  |     WHEN MATCHED AND s.op='D' THEN DELETE                          |
  |     WHEN NOT MATCHED AND s.op='I' THEN INSERT ...                  |
  +---------------------------------------------------------------+
        |
        v
  +---------------------------------------------------------------+
  |                  GOLD — curated, business-ready                   |
  +---------------------------------------------------------------+
        |
        v
   Athena / Redshift Spectrum / SageMaker (see Lakehouse.md)


  ALTERNATE CDC-SHAPED PATHS (same source database, different needs):

  Aurora MySQL/PostgreSQL --- zero-ETL integration ---> Redshift
       (no DMS, no replication instance, no S3 hop, fully managed)

  DynamoDB table --- DynamoDB Streams ---> Lambda ---> enrich/route --->
       Kinesis/Firehose ---> S3 bronze  (or directly to OpenSearch,
       another DynamoDB table, EventBridge)
```

**Reading every arrow:**

- **Source transaction log → SCT (heterogeneous only).** SCT is a
  **schema conversion tool**, not a data-movement tool — it exists only
  when source and target engines differ (Oracle → PostgreSQL). If
  source and target are the same engine family, SCT is skipped
  entirely; DMS alone handles data movement. **DMS itself never
  migrates schemas, indexes, stored procedures, or functions** — that
  division of labor (SCT does structure, DMS does data) is one of the
  most tested facts in this whole pattern.
- **SCT/source → DMS replication instance, Phase 1 (Full Load).** DMS
  bulk-copies the existing table contents as they stand at task start —
  this is a snapshot, not incremental.
- **Phase 1 → Phase 2 (CDC).** DMS switches from full load to reading
  the transaction log **starting from the exact log position the full
  load completed at** — this handoff is what guarantees no gap and no
  duplicate window between "everything that existed already" and
  "everything that changes from now on." This requires the source to
  have CDC-capable logging enabled (binlog with row-based logging for
  MySQL, logical replication slots for PostgreSQL, supplemental logging
  for Oracle) — a source without this enabled cannot do CDC, only full
  load, and this is a common exam trap (see below).
- **DMS → S3 bronze.** Change records land as files tagged with
  operation type (insert/update/delete) and the source LSN/SCN or
  commit timestamp — this tagging is what makes correct ordering
  possible downstream, since files may arrive at slightly different
  times than the order events actually committed at the source.
- **Bronze → dedupe-by-latest-LSN → `MERGE INTO` silver.** This is the
  step that turns "a pile of change events, possibly with duplicates
  and possibly out of commit order within a batch" into a correct
  current state: within each merge batch, keep only the row with the
  highest LSN per primary key (so a key updated three times in one
  batch window only applies its final state), then merge that
  deduplicated batch into the Iceberg silver table using key-based
  `MATCHED`/`NOT MATCHED` logic.
- **Silver → Gold, and onward.** Identical to `Lakehouse.md` from here
  — CDC's only job is getting a correct, current bronze/silver;
  everything downstream is standard lakehouse consumption.
- **Aurora/DynamoDB → zero-ETL → Redshift (alternate path).** For the
  specific supported source/target pairs, zero-ETL skips DMS, the
  replication instance, and the S3 hop entirely — AWS operates the
  replication internally and Redshift simply sees near-real-time
  tables. Pick this over DMS whenever the source/target pair is on the
  supported list and the requirement is "sync into the warehouse," not
  "land raw change events in the lake for other purposes."
- **DynamoDB → DynamoDB Streams → Lambda (alternate path).** When the
  source is DynamoDB and what's needed is an **event-driven stream of
  changes** (to trigger enrichment, fan out to search indexes, drive
  business logic) rather than a warehouse sync, DynamoDB Streams — not
  DMS — is the native mechanism; it's built into the table itself with
  no separate replication instance to provision.

---

## Service-by-service rationale, with runner-up alternatives

### DMS: full load vs. CDC, and what DMS does NOT do

| Task | DMS handles it? |
|---|---|
| Bulk copy existing data (full load) | ✅ |
| Ongoing replication of inserts/updates/deletes (CDC) | ✅, if source has log-based CDC enabled |
| Migrate schema/DDL, indexes, stored procedures, functions | ❌ — that's **SCT** |
| Verify migration completeness/accuracy | ✅ — **DMS validation task**, a distinct, purpose-built feature |
| Target a stream instead of a database (Kinesis/MSK) | ✅ — DMS can target Kinesis or MSK directly, which is how you turn a relational database into an event stream without hand-rolling a Debezium-style connector |

**Runner-up:** a custom CDC solution (e.g., Debezium via MSK Connect)
is the answer only when the scenario explicitly says "we already run
Kafka" or names Debezium/Kafka Connect directly — otherwise, "any
question where a managed AWS service exists" favors DMS or zero-ETL
over rolling your own.

### DMS Serverless vs. provisioned replication instance

| | **DMS Serverless** | **Provisioned replication instance** |
|---|---|---|
| Best for | Unpredictable or spiky CDC volume, intermittent migrations | Steady, predictable, sustained CDC load where right-sizing a fixed instance is cheaper |
| Scaling | Automatic | Manual (choose instance class, resize) |
| Operational overhead | Lower | Higher — you own capacity planning |

### Merge compute: Glue streaming/batch job vs. EMR

Most CDC merge workloads land comfortably on **Glue** (serverless
Spark, native Iceberg `MERGE INTO` support, job bookmarks for
incremental batch pickup of new bronze files). **EMR** becomes the
better choice only when merge volume is large and sustained enough
that reserved/spot cluster economics beat Glue's DPU pricing, or when
the team already has custom Spark/Iceberg tooling that assumes cluster
-level control.

---

## Ordering, exactly-once vs. at-least-once, during merge

This is the single most conceptually important part of a CDC
architecture, and the exam tests it directly:

- **DMS (and Kinesis/MSK generally) deliver at-least-once, not
  exactly-once.** A change event can be delivered more than once
  (e.g., after a replication instance restart resumes slightly behind
  its last checkpoint). This is a fact about the delivery mechanism,
  not a defect — real systems accept at-least-once delivery and put the
  correctness burden on the **consumer being idempotent**.
- **The `MERGE INTO` step is what makes this safe.** Because the merge
  matches incoming rows against existing rows **by primary key** and
  applies `UPDATE`/`DELETE`/`INSERT` based on that match, applying the
  same change event twice produces the same end state both times —
  that's the definition of idempotent. A naive `INSERT`-only pipeline
  would instead create duplicate rows on redelivery.
- **Ordering within a batch matters independently of delivery
  guarantees.** Even with no duplicates, if a key was updated twice
  within one merge window and the two change records are processed out
  of commit order, the wrong one "wins." This is why bronze CDC files
  are tagged with **source LSN/SCN or commit timestamp**, and the
  pre-merge dedupe step explicitly keeps **only the highest-LSN record
  per key** before merging — this, not delivery order, is what
  guarantees correctness.
- **"Exactly-once" as a marketing claim is a trap.** No component in
  this pipeline — not DMS, not Kinesis, not Glue — provides true
  end-to-end exactly-once semantics on its own. What the architecture
  actually achieves is **at-least-once delivery + idempotent merge
  logic**, which produces the same *correct end state* as exactly-once
  would, without needing the (much harder, and largely unavailable on
  this stack) exactly-once delivery guarantee itself.

---

## Handling schema drift mid-stream

Source schemas change while CDC is running — a column gets added, a
type gets widened, a column gets dropped. Three layers handle this:

1. **DMS task settings** can be configured to include/exclude specific
   tables or columns, and DMS surfaces **schema/DDL change events**
   that occur at the source during CDC (e.g., `ALTER TABLE ADD COLUMN`)
   — depending on target settings, DMS can auto-apply simple,
   compatible changes to the target or require manual intervention for
   changes it can't safely apply automatically.
2. **Glue Schema Registry** can track and validate schema versions for
   streaming CDC events flowing through Kinesis/MSK, flagging
   incompatible changes before they corrupt a downstream merge.
3. **Iceberg schema evolution on the silver table** absorbs additive,
   compatible changes (new column, widened type) as a **metadata-only**
   operation — no rewrite of existing data required (this is the same
   Iceberg schema-evolution capability documented in Domain 2 and
   `Lakehouse.md`). Destructive or incompatible changes (a column
   renamed at the source in a way that breaks the merge's key-matching
   logic, or a type narrowed) still require explicit pipeline
   intervention — no format automatically resolves a genuinely breaking
   change safely.

---

## Scaling considerations

- **DMS replication instance sizing**: CPU/memory/network sized to
  transaction log volume, not table size — a small table with an
  extremely high write rate needs more replication capacity than a
  huge, rarely-updated table.
- **Multiple DMS tasks** parallelize across table groups when one
  source has many independently-updated tables, avoiding a single task
  becoming a bottleneck.
- **LOB (large object) columns** need explicit DMS LOB handling
  settings — full LOB mode is slower; limited-size LOB mode is faster
  but caps object size.
- **Merge batch size/interval**: smaller, more frequent merge batches
  reduce end-to-end latency but increase Iceberg commit/compaction
  pressure (see `Lakehouse.md`'s concurrency section); larger, less
  frequent batches trade latency for fewer, cheaper merges.

## Failure scenarios and tolerance

| Failure | Effect | Mitigation |
|---|---|---|
| DMS task fails mid-CDC and needs to resume | Resumes from last checkpointed LSN — but only if source transaction log retention still covers that gap | Size source log retention (binlog/WAL retention window) generously relative to expected DMS downtime; monitor task lag |
| Out-of-order records within a merge batch | Wrong value "wins" if not deduplicated by LSN before merge | Always dedupe-by-latest-LSN before `MERGE INTO`, never trust arrival order |
| Duplicate delivery (at-least-once) | Incorrect results if merge logic isn't idempotent | Key-based `MERGE INTO`, never append-only `INSERT` for CDC data |
| Incompatible schema change at source (column type narrowed, column dropped and reused for a different purpose) | Merge job fails or silently corrupts data | Schema Registry validation gate before merge; alerting on DMS schema-change events; manual review for non-additive changes |
| Source log retention too short relative to DMS downtime | **Permanent data gap** — DMS cannot resume, must re-run full load | Monitor `CDCLatencySource`/`CDCLatencyTarget` DMS metrics; alert well before log retention would be exhausted |
| Replication instance under-sized for burst write volume at source | Growing CDC lag, delayed freshness downstream | Right-size instance or move to DMS Serverless for bursty workloads |

## Cost drivers

- **DMS replication instance** — hourly cost for as long as the CDC
  task runs (often indefinitely, since CDC is typically "forever," not
  a one-time job) — this is a standing cost unlike a one-time full-load
  migration.
- **S3 storage** for bronze CDC files (before compaction/expiration).
- **Glue merge job DPU-hours** — scales with merge frequency and batch
  size.
- **Iceberg compaction** — a real recurring cost when CDC drives
  frequent small merges (see `Lakehouse.md`'s cost section).
- **Zero-ETL** has no separate replication-instance cost — spend shows
  up as Redshift/target compute instead, which is part of why it's the
  "least operational overhead" answer for its supported source/target
  pairs.
- **DynamoDB Streams** itself has no direct charge beyond standard
  DynamoDB throughput; cost shows up in the Lambda invocations/duration
  consuming the stream.

## Exam traps

⚠️ **"Continuously replicate an on-prem database" → DMS (CDC mode)**,
not zero-ETL (which only covers specific AWS-native source/target
pairs) and not a batch Glue JDBC job (too slow/high-latency for
"continuous").

⚠️ **"Aurora MySQL → Redshift, no pipeline to build/manage" → zero-ETL**,
not DMS — picking DMS here is technically workable but is the
higher-operational-overhead distractor when a zero-ETL integration
exists for that exact pair.

⚠️ **DynamoDB as the CDC source, need an event stream** → **DynamoDB
Streams**, not DMS — DMS is for relational/document sources; DynamoDB's
own native stream is the purpose-built mechanism for its own change
events.

⚠️ **DMS does not migrate schema, indexes, stored procedures, or
functions** — a scenario needing a full heterogeneous migration
(structure and data) needs **DMS + SCT** together; DMS alone is a data-
only distractor in that context.

⚠️ **"How do you verify the migration was complete and accurate?"** →
**DMS validation task**, a named, specific feature — not "manually spot
-check rows" or "compare row counts by hand."

⚠️ **"Exactly-once" claims** anywhere in a CDC scenario are a
correctness trap — the real, achievable guarantee on this stack is
at-least-once delivery plus idempotent key-based merge logic producing
a correct result; don't pick an answer that claims a component
provides true exactly-once delivery on its own.

⚠️ **Source without log-based CDC enabled** (binlog off, no logical
replication slot, no supplemental logging) cannot do CDC at all, only
full load — a scenario mentioning this constraint is signaling "full
load only" or "enable the log-based feature first," not "DMS CDC just
works regardless of source configuration."

## Real enterprise example

A regional bank replicates an on-prem Oracle core-banking database to
its AWS lakehouse for fraud analytics. Because the migration is
heterogeneous (Oracle source, PostgreSQL-compatible target semantics
for downstream tooling), **AWS SCT** converts schema/DDL first, then
**DMS** performs a full load of existing account and transaction
history followed by continuous CDC reading Oracle's redo log (with
supplemental logging enabled specifically for this purpose). Change
events land in S3 bronze tagged with source SCN, get deduplicated by
latest-SCN-per-primary-key, and merge into an Iceberg silver
`transactions` table every five minutes — frequent enough that the
fraud team's near-real-time detection rules run against data that's
minutes old, not a full day old under the bank's previous nightly-batch
process. Separately, the bank's e-commerce subsidiary uses **DynamoDB
Streams** on its order table to drive a Lambda function that
re-indexes changed orders into OpenSearch within seconds, entirely
independent of the DMS-based banking pipeline — same conceptual
pattern (capture changes, apply them downstream), two different
mechanisms because the sources are fundamentally different.

---

## Practice questions

**1. A company needs to continuously replicate an on-premises Oracle
database into an S3-based lakehouse, including both the existing
history and all future changes. Which AWS service performs the actual
schema/DDL conversion, and which performs the data movement?**

A) DMS does both
B) SCT converts schema/DDL; DMS performs full load and ongoing CDC data
movement — **correct**
C) Glue converts schema; DMS moves data
D) DMS converts schema; SCT moves data

*B is correct — this is the core division of labor for heterogeneous
migrations stated explicitly in this file and in Domain 1's matrix. A
is the most common wrong answer — DMS does not migrate schema/DDL/
indexes/stored procedures. C names the wrong schema-conversion tool. D
reverses the correct roles.*

**2. An Aurora MySQL database needs to feed a Redshift warehouse in
near-real time, with the least possible operational overhead — no
replication instance to manage, no pipeline code to write. What is the
best-fit mechanism?**

A) AWS DMS with a provisioned replication instance
B) A zero-ETL integration from Aurora MySQL to Redshift — **correct**
C) A nightly Glue JDBC extract job
D) DynamoDB Streams

*B is correct — Aurora MySQL → Redshift is exactly the supported
zero-ETL pair, and "least operational overhead, no pipeline to manage"
is the textbook zero-ETL signal. A works but is the higher-overhead
distractor when zero-ETL is available for this exact pair. C is far
too high-latency for "near-real time." D doesn't apply — the source
here is Aurora, not DynamoDB.*

**3. A DMS CDC task is redelivering some change records due to a
replication instance restart. The downstream Glue job applies these
records using `MERGE INTO` keyed on primary key. What is the effect of
the duplicate delivery?**

A) The silver table ends up with duplicate rows
B) None — applying the same keyed upsert twice produces the same end
state both times, which is exactly what makes the pipeline tolerant of
at-least-once delivery — **correct**
C) The Glue job crashes on the duplicate
D) DMS guarantees exactly-once delivery, so this scenario cannot occur

*B is correct — this is the idempotency property of key-based
`MERGE INTO` described in the Ordering section above. A describes what
would happen with a naive append-only `INSERT`, not a proper merge. C
is unfounded. D is the "exactly-once" trap explicitly called out — DMS
does not provide exactly-once delivery.*

**4. Within one 5-minute CDC merge batch, a single order row was
updated twice at the source, seconds apart. The two change records
arrive in bronze slightly out of commit order due to file-landing
timing. What must the merge job do to apply the correct final state?**

A) Apply whichever record arrived first in bronze
B) Deduplicate by keeping only the record with the highest source
LSN/SCN per primary key before merging — **correct**
C) Apply both records in the order DMS wrote them to S3
D) Skip both records and wait for the next batch

*B is correct — this is precisely why bronze CDC files are tagged with
source LSN/SCN, and why the pre-merge dedupe step exists, as detailed
in this file. A and C both risk applying stale data as "current" if
S3 landing order doesn't match commit order. D discards valid data for
no reason.*

**5. A source Oracle database has supplemental logging disabled. A team
attempts to configure a DMS task for full load plus ongoing CDC. What
happens?**

A) DMS CDC works normally regardless of this setting
B) Full load can proceed, but CDC (ongoing replication) cannot function
without log-based capture enabled at the source — **correct**
C) DMS automatically enables supplemental logging itself
D) The task fails immediately, including the full load

*B is correct — CDC requires log-based capture at the source; without
it (supplemental logging for Oracle, binlog for MySQL, logical
replication slots for PostgreSQL), only full load is possible. A is
false. C — DMS does not silently reconfigure the source database's
logging. D overstates the failure — full load itself doesn't depend on
this setting.*

**6. A team needs to verify that a completed DMS migration transferred
data completely and accurately, without manually writing row-count
comparison scripts. What built-in DMS feature addresses this directly?**

A) DMS Serverless
B) The DMS validation task — **correct**
C) SCT
D) CloudTrail data events

*B is correct — validation is a named, purpose-built DMS feature,
called out explicitly in Domain 1's DMS gotchas and restated here. A
is a deployment mode, not a validation feature. C is for schema
conversion, not data validation. D logs API activity, not data
correctness.*

**7. An e-commerce company's order table lives in DynamoDB. The team
needs an event-driven mechanism to trigger a Lambda function every time
an order is created, updated, or deleted, to keep an OpenSearch index
in sync. Which CDC-shaped mechanism fits, and why not DMS?**

A) DMS, because it supports all AWS database sources
B) DynamoDB Streams, because it's DynamoDB's own native, ordered-per-
key change log purpose-built for exactly this event-driven pattern —
**correct**
C) Zero-ETL, because DynamoDB supports it as a source
D) AWS SCT

*B is correct — DynamoDB Streams is the source-native mechanism for
this exact use case, as described in this file's mechanism-selection
table. A is a plausible-sounding but wrong choice — DMS is built for
relational/document database replication, not as the first-choice
mechanism for DynamoDB's own native event stream needs. C describes a
different use case (DynamoDB → Redshift/OpenSearch as a managed sync
target, not "trigger my own Lambda logic"). D is unrelated — no schema
conversion is involved here.*

**8. A CDC pipeline's silver Iceberg table shows unexpected `NULL`
values in a newly-added source column for rows ingested before the
column existed at the source. Is this a pipeline bug?**

A) Yes, the merge logic is broken
B) Not necessarily — this is expected behavior when a source column is
added mid-stream: pre-existing rows never had a value for it, so `NULL`
correctly represents "no value existed for that row at that time" —
**correct**
C) Yes, Iceberg schema evolution corrupted historical data
D) Yes, DMS should have backfilled the new column automatically

*B is correct — additive schema evolution is metadata-only and doesn't
retroactively invent values for rows that predate the column; `NULL`
is the accurate representation, not a bug. A and C both misdiagnose
correct behavior as corruption. D is not something DMS or Iceberg does
or should do automatically — backfilling historical values (if needed
at all) is a deliberate, separate data-engineering decision.*

**9. A DMS CDC task has been down for an extended outage. When it comes
back, the team discovers the source database's transaction log
retention window has already been exceeded. What is the consequence?**

A) DMS automatically switches to zero-ETL to recover
B) DMS cannot resume CDC from where it left off — the change history
needed to resume is gone, requiring a fresh full load — **correct**
C) No consequence; DMS stores its own independent copy of the
transaction log
D) The pipeline silently skips the gap and continues with only new
changes, leaving old changes unapplied without any indication

*B is correct — this is the exact scaling/failure risk documented in
this file: source log retention must exceed expected DMS downtime, or
resumption becomes impossible and a full reload is required. A is not
a real DMS behavior. C is false — DMS reads the source's own
transaction log, it does not independently retain it beyond the
source's own retention window. D understates the severity and implies
a silent, undetected gap, which is worse than the actual failure mode
(a detectable, resolvable need for a full reload) — but is also simply
not how DMS behaves; it does not silently continue past an
unrecoverable gap.*

**10. Which of the following best describes why "exactly-once" is
considered a trap phrase in CDC architecture questions on this exam?**

A) Because CDC pipelines never achieve correct results
B) Because no component in a typical DMS/Kinesis/Glue-based CDC
pipeline provides true end-to-end exactly-once delivery; correctness
instead comes from at-least-once delivery combined with idempotent,
key-based merge logic — **correct**
C) Because exactly-once is only available with Managed Flink, never
with any batch-oriented CDC pipeline
D) Because DMS explicitly documents that it drops duplicate records

*B is correct and is the precise point made in the Ordering section of
this file — the trap is treating "exactly-once" as an available
delivery guarantee rather than understanding that idempotent
processing achieves the same correct outcome without it. A is false —
correctness is fully achievable via idempotency, just not via a literal
exactly-once delivery guarantee. C incorrectly implies Flink is the
only path to correctness (Flink can achieve end-to-end exactly-once in
its own streaming context, covered in `Streaming-Pipeline.md`, but
that's a different point than what makes this DMS-based batch/merge
pipeline correct). D is not how DMS behaves — it does not itself
deduplicate; the merge logic does.*
