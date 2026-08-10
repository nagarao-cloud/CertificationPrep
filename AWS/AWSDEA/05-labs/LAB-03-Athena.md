# LAB-03 — Athena Partition Projection, CTAS, and Iceberg MERGE

> **Day 6 anchor lab.** Builds on LAB-01/LAB-02's data (or fresh
> sample data if you cleaned those up already) and moves from
> "crawler discovers partitions" to two techniques that remove the
> crawler entirely: **partition projection**, and a **table format
> upgrade to Apache Iceberg** that unlocks row-level `MERGE`.

---

## 1. Objective

This lab builds hands-on muscle memory for:

- **Domain 2, Task 2.1 / 2.2** — choosing a table format and catalog
  strategy for a given access pattern, specifically the difference
  between crawler-discovered partitions and **partition projection**
  (computed, not discovered)
- **Domain 2, Task 2.4** — Apache Iceberg fundamentals: snapshots,
  schema evolution, and **row-level MERGE** — the capability that
  plain Hive-style Parquet tables fundamentally cannot do
- **Domain 1, Task 1.2** — CTAS (`CREATE TABLE AS SELECT`) as an
  Athena-native ETL pattern, distinct from a Glue job
- The exam's favorite "why is this query slow / expensive" scenario,
  and its two modern fixes: projection (skip catalog lookups) and
  Iceberg (skip full-partition rewrites for upserts)

By the end you will have gone from "a Glue-crawled table with 3
manually discovered partitions" (LAB-01/02) to "a table that computes
its own partitions with zero catalog metadata calls" to "a table that
accepts `UPDATE`/`DELETE`/`MERGE` like a real database" — the three
rungs of the Domain 2 storage-format ladder the exam expects you to
climb.

---

## 2. Prerequisites

- Comfortable with Athena's query editor (from LAB-01).
- An existing partitioned table is helpful but not required — this
  lab creates its own source table from scratch via CTAS so it stands
  alone even if you've cleaned up LAB-01/02.
- Athena engine version **3** (default for new workgroups — this is
  what enables Iceberg table support; check **Workgroups → your
  workgroup → Athena engine version** if Iceberg statements fail).
- IAM permissions: `AmazonAthenaFullAccess` or scoped equivalent, plus
  S3 read/write on your lab bucket, plus Glue Catalog read/write
  (Athena uses the Glue Data Catalog as its metastore).

---

## 3. Estimated cost

| Resource | Cost driver | Estimate |
|---|---|---|
| Athena queries | $5/TB scanned, 10 MB minimum/query | A few cents for ~15 queries on KB-scale data |
| S3 storage (source + CTAS output + Iceberg table + metadata) | A few MB | Effectively $0 |
| Glue Data Catalog | A handful of tables | $0 (free tier) |
| **Total** | | **Under $0.50** |

**How to avoid surprise charges:**
- Partition projection's whole value proposition is *scanning less by
  computing partition paths instead of listing S3* — but a
  misconfigured projection range (e.g., projecting 100 years of daily
  partitions when you only have 3 months of data) doesn't cost you
  extra by itself, since Athena still only reads objects that exist —
  but it can make queries slower to plan. Keep projection ranges
  realistic in Step 3.
- Iceberg tables retain **snapshot history** — every `MERGE`/`INSERT`
  keeps old data files until you run `OPTIMIZE`/expire snapshots.
  For a lab of this size that's negligible storage, but it's the
  reason production Iceberg tables need periodic maintenance (a Day 6
  reading topic, not this lab's scope).
- Set an Athena workgroup **data usage control** (see LAB-01 Step 8)
  if you haven't already — good habit, zero cost to configure.

---

## 4. Step-by-step instructions

### Step 1 — Create a fresh source table with CTAS

Rather than re-crawling S3, use Athena itself to both generate sample
data and demonstrate CTAS. First, create a tiny seed table from
literal values (no S3 crawl needed):

```sql
CREATE TABLE dea_lab03_db.orders_seed
WITH (
  format = 'PARQUET',
  external_location = 's3://dea-lab03-.../seed/orders/'
) AS
SELECT * FROM (
  VALUES
    (1001, 'C001', DATE '2024-01-05', 129.99, 'SHIPPED'),
    (1002, 'C002', DATE '2024-01-12', 54.50,  'SHIPPED'),
    (1003, 'C003', DATE '2024-02-02', 899.00, 'CANCELLED'),
    (1004, 'C001', DATE '2024-02-20', 12.25,  'SHIPPED'),
    (1005, 'C004', DATE '2024-03-01', 305.00, 'PENDING')
) AS t(order_id, customer_id, order_date, amount, status);
```

(Create the database first if needed: `CREATE DATABASE dea_lab03_db;`)

This is **CTAS** — you just used a `SELECT` to both define a table's
schema *and* materialize it as Parquet in S3, in one statement. No
Glue job, no crawler.

**Validation:** `SELECT COUNT(*) FROM dea_lab03_db.orders_seed;` → `5`.

### Step 2 — CTAS into a partitioned, compressed table

Now do a second CTAS, this time partitioning the output:

```sql
CREATE TABLE dea_lab03_db.orders_partitioned
WITH (
  format = 'PARQUET',
  parquet_compression = 'SNAPPY',
  partitioned_by = ARRAY['order_month'],
  external_location = 's3://dea-lab03-.../partitioned/orders/'
) AS
SELECT order_id, customer_id, order_date, amount, status,
       date_format(order_date, '%Y-%m') AS order_month
FROM dea_lab03_db.orders_seed;
```

**Validation:** `SHOW PARTITIONS dea_lab03_db.orders_partitioned;` →
3 rows (`2024-01`, `2024-02`, `2024-03`).

### Step 3 — Rebuild as a partition-projected table (no crawler, no `SHOW PARTITIONS` needed)

Drop the requirement for Athena/Glue to track partitions as metadata
at all. Create a **new** table definition pointing at the *same* S3
data, but using projection properties that compute partition values
from a pattern instead of looking them up:

```sql
CREATE EXTERNAL TABLE dea_lab03_db.orders_projected (
  order_id      int,
  customer_id   string,
  order_date    date,
  amount        double,
  status        string
)
PARTITIONED BY (order_month string)
STORED AS PARQUET
LOCATION 's3://dea-lab03-.../partitioned/orders/'
TBLPROPERTIES (
  'projection.enabled' = 'true',
  'projection.order_month.type' = 'enum',
  'projection.order_month.values' = '2024-01,2024-02,2024-03,2024-04,2024-05',
  'storage.location.template' = 's3://dea-lab03-.../partitioned/orders/order_month=${order_month}'
);
```

Note the projection range intentionally includes `2024-04` and
`2024-05`, which don't exist yet — that's the point of the next check.

**Validation:**
```sql
SELECT order_month, COUNT(*) FROM dea_lab03_db.orders_projected
GROUP BY order_month ORDER BY order_month;
```
Should return only `2024-01`, `2024-02`, `2024-03` with real counts —
Athena computed all 5 candidate partition paths from the projection
config, but only returns data for the ones that actually contain
objects. Critically: **`SHOW PARTITIONS` does not work the same way
here** — try it and observe that projected tables don't populate the
Glue Catalog's partition list the way crawled tables do; the
partitions are virtual, computed at query time.

### Step 4 — Compare query behavior: catalog lookup vs projection

Run this on both `orders_partitioned` (Step 2, catalog-tracked) and
`orders_projected` (Step 3, projection-based), each filtered to one
month:
```sql
SELECT * FROM dea_lab03_db.orders_partitioned WHERE order_month = '2024-02';
SELECT * FROM dea_lab03_db.orders_projected   WHERE order_month = '2024-02';
```
Both return the same 2 rows. The difference isn't visible in small
data — it's in **planning time and Glue Catalog API calls**, which is
why projection is recommended for tables with **thousands of
partitions** (e.g., a table partitioned by device ID and day for years
of IoT data) where `GetPartitions` calls against the Catalog become
the bottleneck. Say this out loud as you run it — this is a "know it
conceptually because you can't feel it at lab scale" checkpoint.

### Step 5 — Convert to Apache Iceberg and prove row-level MERGE

Create an Iceberg table (Athena's `table_type = 'ICEBERG'` property):

```sql
CREATE TABLE dea_lab03_db.orders_iceberg (
  order_id      int,
  customer_id   string,
  order_date    date,
  amount        double,
  status        string
)
PARTITIONED BY (month(order_date))
LOCATION 's3://dea-lab03-.../iceberg/orders/'
TBLPROPERTIES (
  'table_type' = 'ICEBERG',
  'format' = 'parquet'
);

INSERT INTO dea_lab03_db.orders_iceberg
SELECT order_id, customer_id, order_date, amount, status
FROM dea_lab03_db.orders_seed;
```

Note `PARTITIONED BY (month(order_date))` — this is Iceberg's **hidden
partitioning**: you partition by a transform of a column, and queries
filtering on `order_date` get pruning automatically without needing to
know or reference a separate partition column at all (contrast with
Steps 2/3, where `order_month` was a physical extra column you had to
compute and filter on explicitly).

Now simulate an upstream correction — order 1003's status changes from
`CANCELLED` to `REFUNDED`, and a brand-new order 1006 arrives, in one
`MERGE`:

```sql
MERGE INTO dea_lab03_db.orders_iceberg AS target
USING (
  SELECT * FROM (VALUES
    (1003, 'C003', DATE '2024-02-02', 899.00, 'REFUNDED'),
    (1006, 'C002', DATE '2024-03-15', 45.00,  'SHIPPED')
  ) AS t(order_id, customer_id, order_date, amount, status)
) AS source
ON target.order_id = source.order_id
WHEN MATCHED THEN UPDATE SET status = source.status
WHEN NOT MATCHED THEN INSERT (order_id, customer_id, order_date, amount, status)
  VALUES (source.order_id, source.customer_id, source.order_date, source.amount, source.status);
```

**Validation:**
```sql
SELECT * FROM dea_lab03_db.orders_iceberg ORDER BY order_id;
```
Should show 6 rows total, order 1003 now `REFUNDED`, order 1006
present as `SHIPPED`. This is the capability Steps 2–4's plain Parquet
tables **cannot do** — a `MERGE`/`UPDATE`/`DELETE` against a
Hive-style Parquet table in Athena is not supported; you'd have to
rewrite the whole partition's files yourself (exactly what LAB-02's
Glue job *doesn't* attempt).

### Step 6 — See Iceberg time travel (bonus, quick)

```sql
SELECT * FROM dea_lab03_db.orders_iceberg FOR TIMESTAMP AS OF (current_timestamp - interval '10' minute);
```
(Adjust the interval so it lands before your `MERGE`.) You should see
the pre-MERGE 5-row state — order 1003 still `CANCELLED`, no 1006.
Or query system tables:
```sql
SELECT * FROM dea_lab03_db."orders_iceberg$snapshots";
```
Confirms multiple snapshots exist (one per INSERT/MERGE) — this is
what "time travel" and "rollback" both hinge on structurally.

---

## 5. Validation checkpoints

| Checkpoint | How to verify | Expected result |
|---|---|---|
| CTAS seed table | `SELECT COUNT(*) FROM orders_seed;` | 5 |
| CTAS partitioned table | `SHOW PARTITIONS orders_partitioned;` | 3 partitions (`2024-01/02/03`) |
| Projected table returns real data | `SELECT order_month, COUNT(*) FROM orders_projected GROUP BY order_month;` | 3 rows with correct counts, despite projection range including 2 nonexistent months |
| Projected table has no catalog partitions | Attempt `SHOW PARTITIONS orders_projected;` | Behaves differently from the crawled/CTAS table — no populated partition list to browse the same way (projection computes, doesn't store) |
| Iceberg table created + loaded | `SELECT COUNT(*) FROM orders_iceberg;` | 5 |
| MERGE succeeds | `SELECT * FROM orders_iceberg ORDER BY order_id;` after MERGE | 6 rows; 1003 = `REFUNDED`; 1006 present |
| Snapshots exist | `SELECT * FROM "orders_iceberg$snapshots";` | 2+ rows (one per write operation) |
| Time travel works | `SELECT * ... FOR TIMESTAMP AS OF ...` before the MERGE | Shows pre-MERGE state (5 rows, 1003 = `CANCELLED`) |

---

## 6. Common errors and fixes

1. **`CREATE TABLE ... TBLPROPERTIES ('table_type'='ICEBERG', ...)`
   fails with a syntax or "unsupported table type" error.**
   *Cause:* Athena workgroup is still on **engine version 2**, which
   predates full Iceberg DDL/DML support. *Fix:* **Athena → Workgroups
   → (your workgroup) → Edit → Athena engine version → Athena engine
   version 3**, save, and re-run.

2. **`MERGE` fails with "target table is not an Iceberg table" or
   similar even though you followed Step 5 exactly.**
   *Cause:* Easiest mistake — accidentally ran the `MERGE` against
   `orders_partitioned` (the plain Parquet CTAS table from Step 2)
   instead of `orders_iceberg`. Plain Hive/Parquet tables in Athena do
   not support `MERGE`/`UPDATE`/`DELETE` at all. *Fix:* Double-check
   the table name in the `MERGE INTO` clause.

3. **`SELECT * FROM orders_projected` returns **zero rows**, not just
   "fewer months than projected."**
   *Cause:* The `storage.location.template` doesn't match the actual
   S3 path exactly (a trailing slash mismatch, or wrong bucket name
   copy-pasted). *Fix:* Verify the template resolves to the exact same
   path structure produced by Step 2's CTAS
   (`.../partitioned/orders/order_month=2024-01/`), including no
   double slashes.

4. **CTAS in Step 1 or 2 fails with "Table already exists" on a
   second attempt while debugging.**
   *Cause:* Athena's CTAS creates both a Catalog table entry *and* S3
   data; simply re-running after fixing a typo doesn't clean up the
   old attempt. *Fix:* `DROP TABLE dea_lab03_db.orders_seed;` **and**
   manually delete the S3 prefix it wrote to (dropping the table alone
   does not delete the underlying S3 objects for an external/CTAS
   table pointed at an explicit `external_location`) — then re-run.

5. **Time-travel query in Step 6 returns the same (post-MERGE) data
   instead of the historical state.**
   *Cause:* The `interval '10' minute` lookback wasn't long enough —
   if you took your time between Step 5 and Step 6, 10 minutes may
   have already passed since the *seed* INSERT too, landing your
   "as of" timestamp after the MERGE rather than before it. *Fix:*
   Query `"orders_iceberg$snapshots"` first, find the actual
   `committed_at` timestamp of the pre-MERGE snapshot, and use that
   exact timestamp (or the snapshot ID via `FOR VERSION AS OF`)
   instead of a relative interval.

---

## 7. Cleanup steps

1. **Drop tables** (in Athena):
   ```sql
   DROP TABLE dea_lab03_db.orders_seed;
   DROP TABLE dea_lab03_db.orders_partitioned;
   DROP TABLE dea_lab03_db.orders_projected;
   DROP TABLE dea_lab03_db.orders_iceberg;
   DROP DATABASE dea_lab03_db;
   ```
   Note: dropping `orders_projected` only removes the Catalog
   definition — since it's a projected external table, this is
   expected; but **dropping `orders_seed`, `orders_partitioned`, and
   `orders_iceberg` (all CTAS/managed-style tables with explicit
   `external_location`) does not automatically delete their S3 data**
   in every configuration. Verify with Step 2 below.
2. **Empty and delete the S3 bucket:**
   ```bash
   aws s3 rm s3://dea-lab03-nk-.../ --recursive
   aws s3api delete-bucket --bucket dea-lab03-nk-...
   ```
3. **Verify** no `dea_lab03_db` remains in the Glue Data Catalog.

---

## 8. What you learned

This lab directly reinforces:

- **2.1** — CTAS as an Athena-native way to create tables (an
  ELT-style pattern the exam contrasts with Glue-job-based ETL)
- **2.2** — the structural difference between crawler/catalog-tracked
  partitions and **partition projection**, and specifically *why*
  projection helps at scale (fewer `GetPartitions` Catalog API calls)
  even though it's invisible on lab-sized data
- **2.4** — Apache Iceberg's core value proposition over plain Hive/
  Parquet tables: **row-level MERGE/UPDATE/DELETE**, hidden
  partitioning via column transforms, and snapshot-based time travel
- The exam pattern: *"a table has thousands of partitions and Athena
  queries are slow to start (not slow to scan) — what's the fix?"* →
  **partition projection**. And separately: *"a team needs to update
  or delete individual rows in an S3-backed analytics table without
  rewriting entire files"* → **Apache Iceberg (or Hudi/Delta) with
  MERGE**, not a plain Parquet table.

### Practice questions

**Q1.** A table has 50,000 S3 partitions (one per customer per day,
several years of history). Athena queries against it take a long time
to even *start* running, even for queries that only touch a single
day's data. What is the most likely fix?

- A. Convert the table to CSV format, which parses faster than Parquet.
- B. Enable partition projection so Athena computes the target
  partition path directly from the query predicate instead of calling
  the Glue Catalog to list/resolve tens of thousands of partition entries.
- C. Increase the Athena workgroup's data usage control limit.
- D. Add a Glue crawler schedule to run every 5 minutes to keep
  partitions fresher.

> **Answer: B.** Slow query *start* (planning), not slow scanning, at
> very high partition counts is the textbook partition-projection
> scenario — this lab's Step 4 called this out explicitly as the case
> where projection's benefit becomes real rather than invisible. A is
> false and backwards — CSV is slower and non-columnar. C is
> irrelevant — a usage control limits cost/scan size, not planning
> latency. D would make the problem worse, not better — more frequent
> crawling adds Catalog API load, and crawling doesn't reduce
> partition *count*.

**Q2.** A data engineer needs to correct a small number of
mis-categorized rows in a 500 GB Parquet table stored in S3 and
cataloged in Glue, without rewriting the entire affected partition's
files by hand. What should they do?

- A. Run `UPDATE` directly against the Hive/Parquet table in Athena.
- B. Migrate/rewrite the table as an Apache Iceberg table and use
  `MERGE` (or `UPDATE`) against it going forward.
- C. Delete the whole table and recreate it from source with corrected
  data via a fresh CTAS.
- D. Use `ALTER TABLE ... SET LOCATION` to point at corrected data.

> **Answer: B.** This is precisely LAB-03's Step 5 lesson — row-level
> mutation on S3-backed analytics tables requires a table format built
> for it. A is false — plain Hive-style Parquet tables in Athena do
> not support `UPDATE`; this is the exact error this lab's Common
> Error #2 reproduces. C is technically possible but wildly
> disproportionate for "a small number of rows" and loses history/
> requires reprocessing 500 GB. D doesn't correct data, it just
> repoints the table at a different (presumably already-correct)
> location — it doesn't solve the stated problem of fixing existing
> rows in place.

**Q3.** What does Iceberg's `PARTITIONED BY (month(order_date))`
syntax (hidden partitioning) provide that a traditional
`PARTITIONED BY (order_month)` physical column does not?

- A. Faster write throughput, because Iceberg skips writing partition
  metadata entirely.
- B. Queries filtering on the underlying `order_date` column get
  partition pruning automatically, without users needing to know
  about, reference, or keep in sync a separate derived partition
  column — Iceberg computes and tracks the transform internally.
- C. It removes the need for any partitioning at all, since Iceberg
  scans are always full-table.
- D. It is only a cosmetic syntax difference with no functional impact.

> **Answer: B.** This is the "hidden" in hidden partitioning — from
> the query-writer's perspective they just filter on `order_date`
> naturally; Iceberg's metadata layer maps that to the right
> partition(s). Compare this lab's Step 2/3 (`order_month` as an
> explicit, physically-duplicated column you had to compute and filter
> on by name) to Step 5. A is false — Iceberg still writes and tracks
> partition metadata, just differently (manifest files). C is false —
> Iceberg absolutely supports and benefits from partition pruning; it
> doesn't eliminate the concept. D is false — there is a real
> functional difference in query ergonomics and correctness (physical
> partition columns can drift out of sync with the source column if
> computed wrong; hidden partitioning can't drift because it's derived
> at write time from the real column).

**Q4.** After running the `MERGE` in Step 5, a colleague asks how they
could see exactly what the table looked like five minutes before the
MERGE ran, for an audit. What Iceberg feature enables this directly in
Athena SQL, without needing a separate backup or snapshot export
process?

- A. Amazon S3 Versioning on the underlying bucket.
- B. Iceberg's snapshot-based time travel — `SELECT ... FOR TIMESTAMP
  AS OF` or `FOR VERSION AS OF`, querying against a historical
  snapshot retained by the table's own metadata.
- C. AWS Backup scheduled snapshots of the S3 bucket.
- D. Athena query history in the console, which retains full result
  sets indefinitely.
- 
> **Answer: B.** This is exactly Step 6 of the lab — time travel is a
> first-class Iceberg/Athena SQL feature built on retained snapshots,
> no external backup tooling required. A is a plausible-sounding
> distractor — S3 Versioning versions individual objects, not a
> consistent table-level point-in-time view, and isn't what Athena's
> `FOR TIMESTAMP AS OF` reads from. C is unrelated — AWS Backup
> operates at the bucket/object level, not table-snapshot level, and
> wasn't configured in this lab. D is false — Athena's query history
> retains query *metadata* and a pointer to results in S3 (subject to
> your own lifecycle rules), not an automatic historical view of
> underlying table state.

**Q5.** In Step 3, why does `SELECT order_month, COUNT(*) FROM
orders_projected GROUP BY order_month` correctly return only 3 rows
(the real months), even though the projection configuration declared
5 possible enum values including 2 months with no data?

- A. Athena silently errors on the 2 empty partitions and drops them
  from the projection config automatically.
- B. Partition projection computes candidate partition *paths* from
  the enum/pattern config, but Athena still only returns rows for
  paths that actually resolve to existing, readable S3 objects — an
  empty computed path simply contributes zero rows, not an error.
- C. `GROUP BY` filters out any partition with a null aggregate,
  which is unrelated to projection.
- D. Projected partitions require exact row-count validation against
  the TBLPROPERTIES before the table can be queried at all.

> **Answer: B.** Projection defines the *space* of possible partition
> values Athena is willing to compute paths for; it doesn't assert
> those paths all contain data. Querying an empty computed path just
> yields no rows from that path — same as querying an S3 prefix with
> no objects in it always would. A is false — no error occurs, and
> nothing is "dropped" from config; the config is static, declared by
> you. C misdescribes `GROUP BY` semantics — it groups by whatever
> rows exist; it isn't a partition filter. D describes validation
> behavior that doesn't exist for projected tables — that's precisely
> what makes projection lighter-weight than crawler-tracked partitions.
