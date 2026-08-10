# Lakehouse Architecture

> Builds directly on `Data-Lake.md` — same zones, same catalog, same
> Lake Formation governance. The only thing that changes is the table
> **format** underneath bronze/silver/gold: Apache Iceberg (or its
> AWS-managed form, S3 Tables) instead of plain Hive-style
> partitioned Parquet. Everything here is consistent with — and builds
> directly on — the Iceberg/S3 Tables material in
> `01-domains/DOMAIN-2-DATA-STORE-MANAGEMENT.md` (search "What Apache
> Iceberg fixes" and "Amazon S3 Tables"); read that section first if
> you haven't.

## The problem the lakehouse pattern actually solves

Before Iceberg-on-S3 was viable, "serious" analytics shops ran **two
separate systems**:

```
        THE OLD PATTERN — LAKE + WAREHOUSE, TWO COPIES OF DATA
        =======================================================

  Sources --> S3 Data Lake (Hive-style Parquet)
                    |
                    |  nightly COPY / ETL job (duplicates data)
                    v
              Redshift (native tables, own storage)
                    |
                    v
              BI dashboards, ML feature pulls
```

This "duplicate on purpose" pattern has four durable problems, and the
lakehouse pattern exists specifically to kill all four at once:

1. **Two copies of the truth.** The lake has one version of `orders`,
   Redshift has another, loaded hours ago. A number computed against
   one disagrees with the same number computed against the other, and
   nobody can say with confidence which is "right" without checking
   load timestamps.
2. **Staleness.** The Redshift copy is only as fresh as the last COPY
   job — commonly nightly, sometimes hourly. Anyone who needs
   near-real-time numbers against Redshift is stuck waiting on the next
   load window.
3. **Doubled storage and doubled ETL.** You pay for the data twice
   (once in S3, once in Redshift managed storage) and you maintain and
   troubleshoot an entire extra pipeline (the load job itself) whose
   only job is copying data from one place to another.
4. **ML and BI diverge.** SageMaker/EMR pull from the lake copy;
   dashboards pull from the Redshift copy. A model trained on lake data
   and a dashboard built on warehouse data can silently disagree about
   what "current" looks like.

The **lakehouse** pattern collapses this to one copy:

```
        THE LAKEHOUSE PATTERN — ONE COPY, MANY ENGINES
        ================================================

  Sources --> S3 (Iceberg tables: bronze -> silver -> gold)
                    |
        +-----------+-----------+-----------+
        v           v           v           v
     Athena     Redshift     EMR /       SageMaker
    (ad-hoc)    Spectrum    Managed      (feature
                (BI/       Flink        engineering,
                 dashboards) (heavy      training data
                              batch/      pulled directly
                              stream)     from gold)
```

No engine "owns" the data. Every engine reads the **same Iceberg
snapshot** through the Glue Data Catalog, with ACID guarantees, schema
evolution, and time travel provided by the table format itself rather
than by any one engine's proprietary storage. This is why AWS pushes
this pattern hard on the current exam: it directly replaces a pattern
(separate lake + warehouse with nightly duplication) that used to be
the "correct, senior" answer as recently as a few years ago and now
reads as the legacy, higher-cost, higher-latency choice on most
scenarios.

---

## The reference architecture

```
                         LAKEHOUSE — REFERENCE ARCHITECTURE
                         ===================================

  BATCH SOURCES          STREAMING SOURCES         CDC SOURCES
  (files, JDBC)           (Kinesis/MSK)            (DMS, zero-ETL —
        |                       |                    see CDC.md)
        v                       v                       v
  +---------------------------------------------------------------+
  |            BRONZE — Iceberg table(s), append-only               |
  |   s3tables://.../bronze/<source>/   (or self-managed Iceberg     |
  |   on general-purpose S3 — see Domain 2 comparison)               |
  +---------------------------------------------------------------+
        |
        |  Glue ETL / EMR / Managed Flink: MERGE INTO for upserts,
        |  schema-conform, dedupe
        v
  +---------------------------------------------------------------+
  |            SILVER — Iceberg table(s), upserted, conformed        |
  |   ACID guarantees mean concurrent writers are safe;              |
  |   row-level UPDATE/DELETE supported natively                     |
  +---------------------------------------------------------------+
        |
        |  Glue ETL: joins, aggregation, business logic
        v
  +---------------------------------------------------------------+
  |            GOLD — Iceberg table(s), business-ready               |
  +---------------------------------------------------------------+
        |
        |  All reads go through the GLUE DATA CATALOG
        |  (Iceberg's catalog integration — table + snapshot pointer)
        v
   +----------------------------------------------------------------+
   |                                                                  |
   v                    v                    v                       v
 Athena            Redshift              EMR / Managed           SageMaker
 (ad-hoc SQL,     Spectrum              Flink (heavy            (pull gold
  time travel      (BI dashboards,       transforms,             Iceberg table
  queries)          same snapshot        streaming                directly as
                     as Athena sees)      writes back             training data —
                                          into silver/gold)        no separate
                                                                    export needed)
```

**Reading every arrow:**

- **All three source types → Bronze.** Batch, streaming, and CDC
  sources all converge on bronze as Iceberg tables rather than plain
  Hive partitions — the format is decided once, at the landing zone,
  not bolted on later. CDC sources in particular need bronze to support
  ordered, replayable ingestion of change events before they're merged.
- **Bronze → Silver via `MERGE INTO`.** This is the single biggest
  functional difference from `Data-Lake.md`: silver isn't built by
  append-only Glue jobs writing new partitions, it's built by
  **upserting** — matching incoming rows against existing rows by key
  and inserting/updating/deleting as appropriate. This is what makes
  CDC-driven silver tables possible without full-partition rewrites
  (directly reused in `CDC.md`).
- **Silver → Gold via joins/aggregation.** Same idea as the plain data
  lake, but now gold tables also get ACID writes, meaning a
  partially-failed aggregation job cannot leave gold in a half-written
  state — a failed write simply never commits a new snapshot, and
  readers keep seeing the last good snapshot until a new one
  successfully commits.
- **Everything → Glue Data Catalog → four engines.** This is the core
  arrow of the whole pattern. The catalog holds a pointer to each
  Iceberg table's *current snapshot*; Athena, Redshift Spectrum, EMR/
  Flink, and SageMaker all resolve that pointer independently, so they
  all see a **consistent, current view** without any data movement
  between them. SageMaker in particular can now read training data
  straight from the gold Iceberg table instead of requiring a
  Redshift-to-S3 export step first — that export step is exactly the
  "ML and BI diverge" problem this pattern eliminates.
- **EMR/Flink → writes back into silver/gold.** Unlike the plain data
  lake (mostly one-directional batch flow), a lakehouse commonly has
  streaming *writers*, not just streaming readers — Managed Flink can
  continuously merge streaming aggregates into a gold Iceberg table
  that Athena and Redshift Spectrum see update within minutes, not
  overnight.

---

## Service-by-service rationale, with runner-up alternatives

### Table format: self-managed Iceberg vs. S3 Tables vs. staying on Hive-style

This exact comparison is worked out in full in
`DOMAIN-2-DATA-STORE-MANAGEMENT.md` ("Amazon S3 Tables — the managed
way to run Iceberg on S3") — summarized here for architecture context:

| | **Self-managed Iceberg** (general-purpose S3) | **S3 Tables** (managed table bucket) | **Plain Hive-style Parquet** (`Data-Lake.md`) |
|---|---|---|---|
| ACID / upsert / time travel | ✅ | ✅ | ❌ |
| Who runs compaction/snapshot cleanup | You (Glue job or `OPTIMIZE`) | AWS, automatically | N/A — no snapshots to clean |
| Catalog wiring | Manual registration in Glue Data Catalog | Automatic | Manual (crawler or DDL) |
| Best fit | Existing non-AWS Iceberg catalog, need full manual control | New tables, "least operational overhead" phrasing | Simple, append-only, write-once datasets that never need updates/deletes |
| Exam signal | "existing Iceberg REST catalog," "multi-cloud tooling" | "automatic compaction," "fully managed," "least operational overhead" | Scenario has **no** mention of updates, deletes, upserts, CDC, or time travel |

**Runner-up worth naming explicitly:** plain Hive-style Parquet
(`Data-Lake.md`'s pattern) is still a legitimate answer when the
scenario is genuinely append-only with no update/delete/CDC/
time-travel requirement — adopting Iceberg's metadata and compaction
overhead for a dataset that never needs any of its features is
avoidable complexity, not "always the modern right answer." The exam
does test this nuance: don't reflexively pick Iceberg every time you
see "S3" and "table."

### Query/BI layer: Redshift Spectrum vs. loading into Redshift native tables

| | **Redshift Spectrum over lakehouse Iceberg** | **Load into Redshift native tables (old pattern)** |
|---|---|---|
| Data freshness | Same snapshot everyone else sees, no lag | Only as fresh as the last load job |
| Storage cost | One copy (S3) | Two copies (S3 + Redshift managed storage) |
| Query performance on hottest, highest-concurrency dashboards | Slightly higher latency than native distribution/sort keys | Can be faster — DISTKEY/SORTKEY tuning gives Redshift an edge for the single hottest, most latency-sensitive queries |
| Operational simplicity | No load pipeline to maintain | Extra pipeline: load job, monitoring, retry logic |

**The honest nuance the exam expects you to know:** most scenarios
described as "BI dashboards over the lake" want **Redshift Spectrum
directly over the lakehouse Iceberg tables** — one copy, current data.
But a scenario that specifically calls out an extremely
latency-sensitive, extremely high-concurrency dashboard (hundreds of
users hitting refresh every few seconds against one specific hot
table) can still justify materializing *that one gold table* into
Redshift native storage with a tuned DISTKEY/SORTKEY — this is a
narrow, deliberate exception, not a return to the old two-copy
pattern for everything. If the scenario doesn't call out that
specific latency/concurrency pressure, default to Spectrum-over-
Iceberg.

### Compute for bronze→silver→gold merges: Glue vs. EMR vs. Managed Flink

| | **Glue (Spark serverless)** | **EMR** | **Managed Flink** |
|---|---|---|---|
| Trigger pattern | Scheduled/event-driven batch merge | Scheduled/steady-state large batch | Continuous streaming merge |
| Iceberg support | Native `MERGE INTO` via Spark SQL | Native, plus full control over Spark/Iceberg versions | Native Iceberg sink connector |
| Best fit | Most batch/CDC merge jobs | Very large-scale, steady, cost-sensitive batch (reserved/spot economics) | Near-real-time gold tables fed by a live stream |

---

## Scaling considerations

- **Concurrent writers**: Iceberg uses **optimistic concurrency
  control** — two writers committing at nearly the same time don't
  corrupt data, but the losing writer's commit is retried against the
  new base snapshot. High-concurrency write scenarios (many small
  streaming merges hitting the same table) increase retry rates;
  batching writes into fewer, larger merge operations reduces
  contention.
- **Compaction cadence** must scale with write frequency: a table
  merged every few minutes by a streaming job needs more frequent
  compaction than one batch-loaded nightly, or query performance
  degrades from accumulated small files and delete files (same failure
  mode called out in Domain 2's Iceberg limitations).
- **Catalog and snapshot metadata** scale with S3 itself, but very long
  snapshot histories (rarely expired) grow metadata size and slow
  planning — snapshot expiration policy needs to balance "keep enough
  history for rollback/time-travel" against "don't let it grow
  unbounded."
- **Multi-engine read concurrency** scales independently per engine —
  Athena's per-account concurrency quota, Redshift Spectrum's cluster
  capacity, EMR's cluster size — because each engine only reads
  metadata and data files; they don't contend with each other the way
  concurrent writers do.

## Failure scenarios and tolerance

| Failure | Effect | Mitigation |
|---|---|---|
| Two concurrent `MERGE INTO` jobs hit the same Iceberg table | One commit succeeds, one retries automatically against the new snapshot (safe, but adds latency) | Reduce concurrent writers per table, or serialize merges via Step Functions if retries become frequent |
| Compaction skipped for months | Query latency degrades from small files + accumulated delete files | Scheduled compaction (`OPTIMIZE`/`rewrite_data_files`), or S3 Tables for automatic handling |
| Snapshot expiration too aggressive | Loses ability to time-travel or roll back a bad write beyond the retention window | Set snapshot expiration policy deliberately, not on defaults, matched to audit/rollback requirements |
| A downstream engine caches an old schema after an Iceberg schema evolution (added column) | Reads may not surface the new column until the client refreshes catalog metadata | Understand this is a client-side caching issue, not a data problem — schema evolution itself is metadata-only and instant |
| A bad write is committed (e.g., corrupted merge logic double-counts rows) | Bad data is now the "current" snapshot | Roll back the table to the prior snapshot — the direct payoff of Iceberg's snapshot model versus plain Hive tables, which have no equivalent undo |
| Bronze grows unbounded because nothing ever ages it out | Storage cost creep, plus larger scan windows during full-history replays | Lifecycle policy on bronze combined with Iceberg snapshot expiration, matched to your actual replay window |

## Cost drivers

- **Storage**: a single copy versus the old lake+warehouse pattern's
  two copies is the headline saving — this is usually the largest
  dollar number in any "why lakehouse" cost argument.
- **Compute per engine**: Athena per-TB-scanned, Redshift
  Spectrum per-TB-scanned (or provisioned/Serverless RPU-hours if using
  native tables for the hot-table exception above), EMR/Glue DPU-hours
  for merges, Flink KPU-hours for streaming merges.
- **Compaction jobs**: an explicit, recurring compute cost if
  self-managing Iceberg; folded into the (higher, but predictable) S3
  Tables management cost if using the managed table bucket.
- **Metadata storage**: Iceberg's manifest/snapshot files add a small
  but real S3 storage cost on top of the data files — negligible next
  to the savings from not duplicating warehouse copies, but not zero.
- **Eliminated cost**: the old pattern's nightly COPY/ETL job compute
  and its second copy of storage — this is the direct, quantifiable
  savings a lakehouse migration argument leans on.

## Exam traps

⚠️ **"Multiple engines need to query the same current data without
duplicating it"** is the single strongest lakehouse/Iceberg signal on
this exam — if you see that phrase pattern, Iceberg (self-managed or S3
Tables) is almost certainly the answer, and "load a copy into
Redshift" is the distractor representing the old, more expensive
pattern.

⚠️ **"Least operational overhead" + Iceberg** → **S3 Tables**
specifically, not "just put Iceberg files in a regular bucket." This
exact trap is called out in Domain 2 and repeats here because it's
equally applicable at the architecture level.

⚠️ Don't reach for Iceberg reflexively on every S3-table question — a
genuinely append-only, no-update/no-delete, no-CDC scenario is still
correctly served by plain Hive-style Parquet (`Data-Lake.md`). Iceberg
solves specific problems (upsert, ACID, time travel, safe concurrent
writers, schema evolution); a scenario with none of those requirements
doesn't need it.

⚠️ **Lake Formation governed tables** are a superseded feature —
never pick them as the modern ACID/upsert answer over Iceberg.

⚠️ A scenario emphasizing one extremely hot, high-concurrency dashboard
table can legitimately justify materializing *that specific table*
into Redshift native storage — this is not a contradiction of the
lakehouse pattern, it's a narrow, deliberate exception; don't
over-apply it to the whole platform.

⚠️ **SageMaker reading training data "directly from the lake" with no
separate export step** is a lakehouse signal — the old pattern required
an explicit Redshift-to-S3 (or lake-to-feature-store) export; the
lakehouse pattern lets SageMaker read the gold Iceberg table as-is.

## Real enterprise example

A media streaming company (Netflix-style) unifies its viewing-event
lakehouse on Iceberg: bronze holds raw playback events streamed in via
Kinesis and Managed Flink; silver merges deduplicated, session-level
events; gold aggregates daily/weekly viewing metrics per title and
region. Before adopting this pattern, the BI team's Redshift dashboards
ran against a nightly copy that was frequently 12–18 hours stale
relative to the lake, and the recommendation team's SageMaker training
jobs pulled from a *third*, separately-exported copy — three
different "current" states of the same underlying events, periodically
disagreeing with each other in postmortems. After migrating gold to
Iceberg with Redshift Spectrum and direct SageMaker reads, all three
consumers query the same snapshot, the nightly export pipeline is
retired entirely, and freshness for BI drops from "yesterday" to
"within the last streaming merge window."

---

## Practice questions

**1. A company currently loads S3 lake data into Redshift nightly so BI
dashboards and SageMaker training jobs both have a queryable copy.
Leadership wants to eliminate the staleness and duplicate-storage cost
without losing either consumer's ability to query the data. What
pattern addresses this directly?**

A) Load into Redshift twice daily instead of once
B) Adopt a lakehouse pattern: store bronze/silver/gold as Iceberg
tables and point Redshift Spectrum and SageMaker at the same tables
directly — **correct**
C) Move SageMaker training data into DynamoDB instead
D) Stop using Redshift entirely and use only Athena

*B is correct — this is the exact problem the lakehouse pattern is
built to solve: one copy, multiple engines, no duplication or
export step. A reduces staleness but doesn't remove duplication or
the pipeline. C solves nothing — DynamoDB is not suited to bulk
training-data reads. D removes a legitimately useful engine
(Redshift for concurrent BI) rather than fixing the duplication
problem.*

**2. A table receives frequent small streaming merges (every 2
minutes) from a Managed Flink job. After a few weeks, Athena query
latency against it has crept up noticeably. What is the most likely
cause and correct fix?**

A) Athena needs a service quota increase
B) Accumulated small files and delete files from frequent merges
without compaction; schedule/automate compaction, or move the table to
S3 Tables for automatic maintenance — **correct**
C) Switch the table back to plain Hive-style Parquet
D) Reduce the merge frequency to once a day

*B is correct and matches Domain 2's stated Iceberg limitation directly
— frequent writes without compaction degrade performance over time. A
misdiagnoses a data-layout problem as a quota problem. C throws away
ACID/upsert capability the scenario likely needs (why else merge
continuously?) rather than fixing maintenance. D might reduce the
frequency of small-file creation but doesn't address the existing
backlog or match "near-real-time" requirements the scenario likely has.*

**3. Two independent teams each run a Glue job that merges CDC changes
into the same silver Iceberg table, occasionally at nearly the same
time. What happens, and is this a problem?**

A) The table becomes corrupted and must be restored from backup
B) One commit succeeds and the other automatically retries against the
new snapshot under Iceberg's optimistic concurrency control — safe,
though it adds latency to the losing job — **correct**
C) Nothing — Iceberg has no concept of concurrent writers
D) Both writes are silently dropped

*B is correct — this is exactly what optimistic concurrency control
means in the Iceberg context, and it's the direct answer to the "safe
concurrent writers" limitation of Hive-style tables called out in both
`Data-Lake.md` and Domain 2. A overstates the risk — corruption is what
Iceberg is specifically designed to prevent. C is wrong; concurrency
control is a first-class Iceberg feature. D is factually wrong — one
write does succeed.*

**4. A finance team discovers that a bad job run wrote incorrect
aggregate values into a gold Iceberg table two hours ago. What is the
lakehouse-native way to fix this, assuming snapshot expiration hasn't
run yet?**

A) Manually recompute and overwrite each affected row
B) Roll the table back to the last good snapshot before the bad write
— **correct**
C) Delete and recreate the table from bronze
D) This cannot be fixed without re-ingesting from the source system

*B is correct — this is Iceberg's snapshot/time-travel model doing
exactly what it's for: instant rollback to a known-good state, no
data movement required. A is far more work and error-prone than
necessary. C is a massive overreaction. D ignores that Iceberg
retains prior snapshots specifically to avoid needing to re-ingest.*

**5. A scenario describes a dataset that is written once per day,
never updated, never deleted, and has no CDC or time-travel
requirement anywhere in its description. A candidate answer proposes
Iceberg "because it's the modern default." Is that the best choice?**

A) Yes, Iceberg is always the correct choice for any S3-based table in
2026
B) Not necessarily — a genuinely append-only, no-upsert, no-time-travel
dataset is still correctly served by a plain Hive-style table
(`Data-Lake.md`); Iceberg's overhead should be justified by an actual
feature need — **correct**
C) No, Iceberg cannot handle append-only workloads at all
D) Iceberg should only be used with EMR, never Glue

*B is correct and reflects the explicit nuance in the Service-by-
service section above — don't reflexively pick Iceberg for every S3
table question. A overstates Iceberg's universal necessity. C is
factually wrong — Iceberg handles append-only workloads fine, it's
just not *required* for them. D is unrelated and false — Iceberg works
with Glue, EMR, and Athena alike.*

**6. A company wants "fully managed, automatic compaction and snapshot
cleanup" for a new set of Iceberg tables, with minimal team operational
burden. Which specific AWS offering matches this requirement precisely?**

A) Self-managed Iceberg on a general-purpose S3 bucket with a
scheduled Glue compaction job
B) Amazon S3 Tables — **correct**
C) DynamoDB with Iceberg export
D) Redshift Serverless

*B is correct — "automatic compaction," "fully managed," "minimal
operational burden" are the exact phrases that signal S3 Tables over
DIY Iceberg maintenance, per both this file and Domain 2. A still
requires the team to build and run the compaction job. C and D aren't
Iceberg table-format solutions at all.*

**7. A dashboard used by 300 concurrent business users refreshes every
15 seconds and queries one specific gold table. Spectrum-based query
latency against the lakehouse Iceberg table is causing visible lag at
that concurrency. What is a legitimate, narrow exception to the
"query the lakehouse directly" default?**

A) Abandon the lakehouse pattern entirely and go back to nightly
copies for everything
B) Materialize just that one hot table into Redshift native storage
with tuned DISTKEY/SORTKEY, while everything else continues to query
Iceberg directly via Spectrum — **correct**
C) Increase the Iceberg table's partition count arbitrarily
D) Move the dashboard to Athena instead

*B is correct — this is the deliberate, narrow exception described
in the Redshift Spectrum vs. native-load comparison above: extreme,
specific latency/concurrency pressure on one table can justify a
targeted native copy without reverting the whole platform to the old
duplicate-everything pattern. A overreacts by throwing out the
pattern's benefits for every other table. C doesn't address engine-
level query performance for concurrent BI load. D — Athena has lower
concurrency ceilings than Redshift, making it a worse fit for 300
concurrent dashboard users, not better.*

**8. A data scientist complains that model training data pulled from
the "lake" is always at least a day stale compared to what analysts
see on live dashboards, even though both are supposedly reading "the
same data." What architectural symptom does this describe?**

A) A properly implemented lakehouse pattern
B) The old lake + warehouse duplication pattern, where SageMaker reads
one copy and dashboards read a separately, more-recently loaded copy —
**correct**
C) A DynamoDB Streams misconfiguration
D) An Athena concurrency limit being hit

*B is correct — this staleness-between-consumers symptom is precisely
the problem statement the lakehouse pattern is designed to eliminate;
its presence indicates the platform has NOT actually unified onto one
Iceberg copy yet. A is the opposite of what's being described. C and D
are unrelated failure modes.*

**9. Which statement correctly distinguishes Lake Formation governed
tables from Apache Iceberg for a 2026-era architecture decision?**

A) They are interchangeable; either is an equally current answer
B) Lake Formation governed tables have been superseded by Iceberg;
Iceberg (self-managed or via S3 Tables) is the current recommended
mechanism for ACID/upsert/time-travel on the lake — **correct**
C) Governed tables are newer and preferred over Iceberg
D) Iceberg only works with Redshift, not Athena or EMR

*B is correct, directly from Domain 2's stated guidance, restated here
because it applies at the architecture-choice level too. A is
incorrect — they are not equally current; one has been superseded. C
inverts the actual timeline. D is false — Iceberg is explicitly
multi-engine (Athena, Redshift Spectrum, EMR, Flink, SageMaker all
shown reading it in this file's diagram).*

**10. In the lakehouse reference architecture in this file, what is the
functional difference between how bronze→silver is built here versus
in the plain `Data-Lake.md` pattern?**

A) There is no difference; both use append-only partition writes
B) Here, bronze→silver uses `MERGE INTO` upsert semantics against
Iceberg tables (supporting CDC-style updates/deletes), whereas
`Data-Lake.md`'s plain pattern is append-only/partition-rewrite based —
**correct**
C) Data-Lake.md uses Iceberg and this file does not
D) Silver doesn't exist in the lakehouse pattern

*B is correct and is the single most load-bearing distinction between
the two files — it's called out explicitly in the "Reading every
arrow" section above. A reverses which pattern is append-only. C
inverts which file uses Iceberg. D is simply false; silver is present
and central to both patterns.*
