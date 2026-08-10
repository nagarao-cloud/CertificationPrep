# LAB-02 — Glue ETL Job with Bookmarks: CSV → Partitioned Parquet

> **Day 3 anchor lab.** Reuses the mental model from LAB-01 (S3 +
> Glue Catalog + Athena) and adds the piece LAB-01 deliberately
> skipped: a real, scheduled-capable **Glue ETL job** with **job
> bookmarks** for incremental processing.

---

## 1. Objective

This lab builds hands-on muscle memory for:

- **Domain 1, Task 1.2** — transforming data between formats
  (CSV → Parquet), optimizing costs while processing, troubleshooting
  transformation failures
- **Domain 1, Task 1.4** — understanding what a generated Glue script
  does, worker types, and DPU-based cost
- **Domain 2, Task 2.2** — synchronizing new partitions with the Data
  Catalog automatically via `enableUpdateCatalog`
- The single most exam-tested Glue concept: **job bookmarks** — what
  they track, why a re-run without new data processes zero rows, and
  the specific ways beginners accidentally break them (JDBC without a
  primary key, disabling bookmarks then re-enabling, transformation
  context changes)

By the end you will have run the same "CSV in, Parquet out" job
**twice** — once against fresh data, once against no new data — and
watched the bookmark actually work, not just read about it.

---

## 2. Prerequisites

- **LAB-01 completed**, or at minimum comfortable with S3 prefixes,
  the Glue Data Catalog, and running an Athena query. This lab assumes
  you know what a crawler and a Catalog table are.
- IAM permissions: `AWSGlueConsoleFullAccess` (or scoped equivalent),
  S3 access to a new lab bucket, and `iam:PassRole` for the Glue job role.
- A fresh S3 bucket for this lab (don't reuse LAB-01's bucket verbatim
  — you'll delete that one in cleanup; a clean bucket keeps this lab
  independently runnable). If you kept LAB-01's bucket around, you may
  reuse it under a new prefix — either is fine.

---

## 3. Estimated cost

| Resource | Cost driver | Estimate |
|---|---|---|
| Glue ETL job (G.1X, 2 workers, 2 runs) | Billed per DPU-hour, 1-minute minimum | ~$0.15–$0.30 total for both runs |
| S3 storage | A few MB in/out | Effectively $0 |
| Glue Data Catalog | Well under free tier | $0 |
| Athena (validation query) | A few cents | Effectively $0 |
| **Total** | | **Under $1.00** |

**How to avoid surprise charges:**
- Glue **G.1X workers cost roughly $0.44/DPU-hour**; a 2-worker job
  running 2–3 minutes is a fraction of a dollar, but if you accidentally
  set **Number of workers** to something large (10+) while testing, or
  leave **Job bookmark = Disable** and re-run repeatedly against
  growing data, costs climb with runtime, not just count. Keep worker
  count at 2 for this lab.
- Glue Studio's **"Job run monitoring"** view shows DPU-hours consumed
  per run — check it after each run so you learn to read it; this is
  the same view you'd use to catch a runaway job in production.
- Do **not** enable a schedule/trigger on this job unless you actively
  want it running unattended — an unscheduled on-demand job costs
  nothing between runs.

---

## 4. Step-by-step instructions

### Step 1 — Create the S3 layout

Create bucket `dea-lab02-<initials>-<digits>` with two top-level
prefixes:

```
s3://dea-lab02-.../raw-csv/orders/
s3://dea-lab02-.../processed/orders/
```

Upload an initial batch of CSV files to `raw-csv/orders/` — reuse the
sample "orders" schema from LAB-01
(`order_id,customer_id,order_date,amount,status`), but this time do
**not** pre-partition them by hand; drop 2–3 flat CSV files directly
into `raw-csv/orders/` (e.g., `batch1.csv`, `batch2.csv`). The job
itself will do the partitioning on the way out — that's the point of
this lab.

**CLI equivalent:**
```bash
aws s3 mb s3://dea-lab02-nk-4471
aws s3 cp batch1.csv s3://dea-lab02-nk-4471/raw-csv/orders/
aws s3 cp batch2.csv s3://dea-lab02-nk-4471/raw-csv/orders/
```

### Step 2 — Catalog the raw CSV as a source table

**Console:** **Glue** → **Crawlers** → **Create crawler**, name
`dea-lab02-raw-crawler`, source `s3://dea-lab02-.../raw-csv/orders/`,
database `dea_lab02_db` (create new), run once. Confirm a table named
`orders` appears with the 5 CSV columns (no partitions expected yet —
the raw files are flat).

*Why catalog the source first instead of pointing the Glue job
straight at S3?* Because Glue Studio's visual source node reads from
either a Catalog table or a raw S3 path directly — using the Catalog
table is the pattern the exam favors because it decouples the job from
hardcoded paths, and it's what makes bookmarks track "new files since
last run" cleanly against a stable table definition.

### Step 3 — Create the Glue ETL job in Glue Studio

**Console:**
1. **AWS Glue** → **Glue Studio** → **Create job** → **Visual ETL**.
2. **Source**: click the **+** node → **AWS Glue Data Catalog** →
   database `dea_lab02_db`, table `orders`.
3. Add a **Transform** node (optional but instructive): **Change
   Schema** — confirm `amount` maps to `double` and `order_date` maps
   to `string` (you'll derive `year`/`month` next). If `order_date` is
   a proper date string like `2024-01-05`, add a **SQL transform**
   node with:
   ```sql
   SELECT *,
          substr(order_date, 1, 4) AS year,
          substr(order_date, 6, 2) AS month
   FROM myDataSource
   ```
   This derives the partition columns from the data itself — a very
   common real-world pattern (partition-by-derived-date), distinct
   from LAB-01 where partitions were already baked into the S3 path.
4. **Target**: **+** node → **Amazon S3**.
   - Format: **Parquet**, Compression: **Snappy**.
   - S3 target location: `s3://dea-lab02-.../processed/orders/`.
   - **Partition keys**: select `year`, `month`.
   - Check **"Create a table in the Data Catalog and on subsequent
     runs, update the schema and add new partitions"**
     (`enableUpdateCatalog`) — target database `dea_lab02_db`, target
     table `orders_processed`. This is what auto-registers new
     partitions without needing a second crawler.
5. **Job details tab**:
   - Name: `dea-lab02-csv-to-parquet`.
   - IAM Role: create/select a Glue service role with access to this
     bucket.
   - Type: **Spark**, Glue version: **5.0** (latest at time of
     writing — check the console for the current default).
   - Worker type: **G.1X**, Number of workers: **2** (minimum useful
     size; keeps cost negligible).
   - **Job bookmark: Enable.** This is the setting the entire lab
     hinges on — do not leave it on the default without checking.
6. **Save**, then **Run**.

**CLI equivalent** (creating a job from a pre-authored script is more
involved than console clicking; the console-generated script is the
practical path for a beginner, but the job's core config via CLI looks
like):
```bash
aws glue create-job \
  --name dea-lab02-csv-to-parquet \
  --role AWSGlueServiceRole-dea-lab02 \
  --glue-version "5.0" \
  --worker-type G.1X \
  --number-of-workers 2 \
  --command '{"Name":"glueetl","ScriptLocation":"s3://dea-lab02-.../scripts/job.py","PythonVersion":"3"}' \
  --default-arguments '{"--job-bookmark-option":"job-bookmark-enable"}'

aws glue start-job-run --job-name dea-lab02-csv-to-parquet
```

### Step 4 — Watch the run and validate output

**Console:** **Glue Studio** → **Runs** tab for the job. Wait for
**Run status: Succeeded** (typically 2–4 minutes including Spark
cluster startup — this cold-start time is normal and is one reason
Glue jobs aren't a good fit for sub-minute-latency needs).

Check the output:
```
s3://dea-lab02-.../processed/orders/year=2024/month=01/....snappy.parquet
s3://dea-lab02-.../processed/orders/year=2024/month=02/....snappy.parquet
```

And confirm the Catalog table `orders_processed` exists with
partitions already registered (thanks to `enableUpdateCatalog` — no
separate crawler run needed).

### Step 5 — Query the processed table in Athena

```sql
SELECT year, month, COUNT(*) AS n, SUM(amount) AS total
FROM orders_processed
GROUP BY year, month
ORDER BY year, month;
```

Note the row count — you'll compare it after Step 6.

### Step 6 — Prove the bookmark works: re-run with no new data

**Console:** Go back to the job → **Run**. Do not upload anything new
first. Watch it finish quickly.

Check **Runs** tab → click the run → **Output logs**. You should see
log lines indicating the job read the source but processed **zero new
records** (the exact phrasing varies by Glue version, but look for
something like "Number of records processed: 0" or absence of any new
files in `processed/orders/`). Confirm no new Parquet files were
written and the Athena row count from Step 5 is unchanged.

This is the entire point of the lab: **the bookmark remembered which
source files/partitions it already processed** and skipped them.

### Step 7 — Prove the bookmark also works correctly: add new data and re-run

Upload a third file, `batch3.csv`, into `raw-csv/orders/` with a new
month's data (e.g., March). Re-run the crawler from Step 2 first (so
the source Catalog table sees the new file — the job reads from the
Catalog table, and the Catalog table itself needs the crawler or a
catalog update to know `batch3.csv` exists). Then re-run the Glue job.

**Validation:** the job should process only `batch3.csv`'s rows (check
the run's processed-record count), and Athena should now show a fourth
`month=03` partition with only the new rows added — the January/
February data is untouched, not reprocessed or duplicated.

---

## 5. Validation checkpoints

| Checkpoint | How to verify | Expected result |
|---|---|---|
| Raw CSV cataloged | Glue → Tables → `orders` | 5 columns, no partitions (flat CSVs) |
| First job run succeeds | Glue Studio → Runs tab | Status `Succeeded`, output Parquet files present under `year=/month=/` |
| Catalog auto-updated | Glue → Tables → `orders_processed` | Table exists with `year`, `month` as partition columns, no manual crawler needed |
| Athena reads processed data | Run the `GROUP BY year, month` query | Row counts match the source CSV row counts |
| Bookmark skips unchanged data | Re-run job with no new source data | Run succeeds fast, log shows 0 new records processed, no new Parquet files, Athena counts unchanged |
| Bookmark picks up new data | Add `batch3.csv`, re-crawl source, re-run job | Only new rows appear as a new `month=03` partition; existing partitions unchanged |

---

## 6. Common errors and fixes

1. **Second run (Step 6) reprocesses everything again instead of
   skipping it — new duplicate Parquet files appear.**
   *Cause:* Job bookmark was left on **Disable** (the Glue Studio
   default in some console versions is not always Enable — this is a
   real exam trap: candidates assume bookmarks are on by default).
   *Fix:* Job details tab → **Job bookmark → Enable** → save → re-run.
   Note: enabling bookmarks *after* a run has already processed data
   without them does not retroactively mark that data as "seen" —
   you may need to also manually reset the bookmark
   (`aws glue reset-job-bookmark --job-name ...`) to get a clean state.

2. **Job fails with `AnalysisException` or `Column 'year' not found`
   at the target node.**
   *Cause:* The SQL transform node in Step 3 wasn't wired correctly —
   either the `substr()` expression has an off-by-one on `order_date`
   format, or the transform node isn't connected in the visual graph
   before the target node. *Fix:* Open the visual editor, confirm
   arrows connect Source → SQL Transform → Target in order, and test
   the `substr` logic against a sample value from your actual data
   (date format matters — `2024-01-05` vs `01/05/2024` need different
   substring offsets).

3. **`AccessDeniedException: User is not authorized to perform:
   glue:GetTable` or similar during job run, even though the crawler
   worked fine.**
   *Cause:* The **crawler's** IAM role and the **job's** IAM role are
   two different roles (created separately in Steps 2 and 3), and the
   job's role wasn't granted Glue Catalog read/write or S3 access to
   both the `raw-csv/` and `processed/` prefixes. *Fix:* Attach an S3
   access policy scoped to the bucket, and confirm the job role has
   `AWSGlueServiceRole` (for Catalog access) attached.

4. **Job runs "successfully" but writes 200+ tiny Parquet files
   instead of a few reasonably-sized ones (the small-file problem).**
   *Cause:* Too many Spark output partitions for this little data —
   default parallelism doesn't auto-tune for small datasets. *Fix:*
   For a lab this size it's harmless, but note for the exam: the
   production fix is `.coalesce(n)` / `.repartition(n)` before write,
   or Glue's **auto-compaction** feature for Iceberg targets (not
   available for plain Parquet targets), or fewer/larger DPU workers
   writing fewer output partitions.

5. **Bookmark doesn't advance even on a "successful" run — every run
   reprocesses everything, forever.**
   *Cause:* Most commonly, the job's `--job-bookmark-option` and
   `--job-name`/`--JOB_NAME` argument mismatch between console runs
   (bookmarks are tracked per job name), or the source is JDBC without
   a monotonically increasing primary key column configured (not this
   lab's scenario, but a very common real-world variant of this
   error). For an S3 source like this lab, also check: did you
   literally re-upload files with the **same filename**, overwriting
   the old object? Bookmarks track by file path *and* modification
   metadata in some configurations — overwriting a same-named file can
   confuse state. *Fix:* Use distinct filenames per batch (as this lab
   does — `batch1.csv`, `batch2.csv`, `batch3.csv`), and verify the job
   name is stable across runs.

---

## 7. Cleanup steps

1. **Glue job**: delete it (`AWS Glue → Glue Studio → Jobs → select →
   Delete`, or `aws glue delete-job --job-name dea-lab02-csv-to-parquet`).
2. **Glue crawler**: delete `dea-lab02-raw-crawler`.
3. **Glue database**: `aws glue delete-database --name dea_lab02_db`
   (cascades to both tables).
4. **S3 bucket**: empty then delete.
   ```bash
   aws s3 rm s3://dea-lab02-nk-4471 --recursive
   aws s3api delete-bucket --bucket dea-lab02-nk-4471
   ```
5. **IAM role**: delete the Glue job's service role if not reused
   elsewhere.
6. **Verify**: no lingering `dea-lab02-*` resources in S3, Glue, or
   IAM consoles.

---

## 8. What you learned

This lab directly reinforces:

- **1.2** — a real CSV → partitioned Parquet transform, including
  deriving partition columns from data rather than relying on
  pre-existing S3 key structure (contrast with LAB-01)
- **1.4** — reading a Glue job run's DPU consumption and understanding
  where job cost actually comes from (workers × runtime, not per-row)
- **2.2** — `enableUpdateCatalog` as the mechanism that keeps the
  Catalog in sync with job output without a second crawler
- The bookmark mental model the exam tests relentlessly: bookmarks
  track **what's already been processed**, not **what currently
  exists** — a re-run is not "reprocess everything," it's "process
  only what's new since the last successful bookmarked run"

### Practice questions

**Q1.** A nightly Glue job ingests CSV files landing in an S3 prefix
and has job bookmarks enabled. One night, an upstream system
accidentally re-uploads yesterday's file with the exact same filename
and identical content (overwriting the S3 object). What is the most
likely outcome on the next scheduled run?

- A. The job always reprocesses every file in the source prefix
  regardless of bookmark state.
- B. Behavior depends on bookmark state tracking, which can key off
  file path/metadata; an object overwritten in place may or may not
  be treated as "new" depending on how modification is detected — this
  is exactly why production pipelines use unique filenames per batch
  (e.g., timestamped) rather than overwriting.
- C. The job will always skip the file since the filename is unchanged.
- D. Glue automatically deduplicates by file content hash, so the
  outcome is guaranteed regardless of filename strategy.
- 
> **Answer: B.** This is deliberately the least clean-cut of the
> options because real bookmark behavior with overwritten objects is
> an edge case AWS documentation calls out as something to avoid —
> the safe pattern is unique keys per batch. A is false — that's what
> bookmarks *prevent*. C is an oversimplification stated with false
> certainty — filename alone isn't the only signal, and relying on it
> is risky. D is false — Glue bookmarks do not do content hashing.

**Q2.** A team disables job bookmarks temporarily to force a full
reprocess of all historical data (a one-time backfill), then
re-enables bookmarks for the next scheduled run. What should they
expect?

- A. The re-enabled bookmark will automatically know to skip
  everything processed during the backfill run, with zero extra steps.
- B. Bookmarks reset to a clean state automatically whenever you
  toggle them from Disable back to Enable.
- C. Data reprocessed during the disabled-bookmark backfill is not
  automatically marked as "seen" — the next enabled run may reprocess
  it again unless the bookmark state is explicitly managed (e.g., via
  `reset-job-bookmark` plus careful sequencing, or a job run with
  `job-bookmark-pause` for controlled backfills).
- D. Disabling bookmarks even once permanently corrupts bookmark
  tracking for that job, requiring the job to be deleted and recreated.

> **Answer: C.** This matches the lab's Common Error #1 — toggling
> bookmarks off and back on doesn't retroactively give the "off"
> period bookmark credit. AWS's documented pattern for controlled
> backfills is `job-bookmark-pause` with explicit
> `--job-bookmark-from`/`--job-bookmark-to` run-window arguments, not
> a blind disable/enable toggle. A and B both assert automatic,
> seamless behavior that doesn't exist. D overstates the consequence —
> it's a state-management issue, not permanent corruption; a bookmark
> reset resolves it.

**Q3.** Why does this lab's Glue job read from a Data Catalog table
(created by a crawler) rather than pointing the Glue Studio source
node directly at the raw S3 path?

- A. Glue Studio's visual editor technically cannot read directly from
  an S3 path under any circumstance.
- B. Reading via the Catalog decouples the job from a hardcoded path,
  lets schema be defined/inspected independently of the job, and is
  the pattern that keeps bookmark-tracked "new data" evaluation
  cleanly scoped to a well-defined table rather than an arbitrary
  prefix — though a direct S3 source is also technically valid for
  simpler cases.
- C. Bookmarks only function at all when the source is a Catalog
  table; a raw S3 source makes bookmarks silently no-op.
- D. Catalog-sourced jobs run on a different, cheaper billing tier
  than direct-S3-sourced jobs.

> **Answer: B.** This is a best-practice/architecture reason, not a
> hard technical requirement. A is false — Glue Studio does support a
> direct "Amazon S3" source node without a Catalog table. C
> overstates it — bookmarks do work with direct S3 sources too (this
> is a commonly tested nuance: bookmarks work for S3 sources based on
> file timestamps/paths, and separately for JDBC sources based on a
> configured primary key column) — but Catalog-based sourcing is the
> cleaner production pattern this lab teaches. D is false — there's no
> separate billing tier tied to source type.

**Q4.** In Step 3, the job is configured with `enableUpdateCatalog`
targeting table `orders_processed`. What does this setting actually do?

- A. It automatically runs a fresh crawler against the target location
  after every job run.
- B. It causes the Glue job itself to write/update the target table's
  schema and register new partitions directly in the Data Catalog as
  part of the job run, without a separate crawler being involved at all.
- C. It updates the *source* table's schema to match any upstream
  changes.
- D. It is required for job bookmarks to function.

> **Answer: B.** `enableUpdateCatalog` (with `partitionKeys` set) makes
> the Glue job responsible for catalog/partition registration directly
> — this is precisely why Step 4 shows the processed table's
> partitions appearing with no second crawler run. A is false — no
> crawler is invoked; the job does it directly via Glue Catalog APIs.
> C is false — it affects the *target* table, not the source. D is
> false — bookmarks and catalog updates are independent settings; you
> can have either without the other.

**Q5.** A colleague suggests removing the `year`/`month` partition
keys from the target node "to simplify the job" and just writing all
output Parquet files into a single flat `processed/orders/` prefix.
What is the most accurate assessment of this suggestion?

- A. It's a good idea — Parquet's internal row-group structure makes
  partitioning unnecessary at any scale.
- B. It would work but trades away partition pruning in Athena/
  Redshift Spectrum queries — at production data volumes, unpartitioned
  Parquet means every query scans the full dataset, directly increasing
  Athena cost ($5/TB scanned) and query latency; fine only for genuinely
  small, rarely-filtered datasets.
- C. It's not possible — Glue Studio's S3 target node requires at
  least one partition key to be selected.
- D. It would break job bookmarks entirely, since bookmarks require
  partitioned output.

> **Answer: B.** This mirrors the core lesson of LAB-01's Data Scanned
> checkpoint — partitioning is a query-performance and cost lever, not
> a hard requirement. A is false — row-group-level predicate pushdown
> inside a single Parquet file helps, but doesn't substitute for
> partition-level pruning that avoids opening files at all. C is
> false — an S3 target with zero partition keys is valid; it's a
> conscious tradeoff, not a UI restriction. D is false — bookmarks
> track source-side processing state; target partitioning is unrelated
> to bookmark mechanics.
