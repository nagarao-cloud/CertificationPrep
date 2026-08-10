# LAB-08 — End-to-End Pipeline: Firehose → Glue → Iceberg → Athena/Redshift → Lake Formation

> **Capstone lab — optional, but the highest-value lab in the series if
> you have time for it.** Every other lab built one link in a chain.
> This lab builds the whole chain and makes the links talk to each
> other: **Firehose ingests → Glue transforms into an Iceberg table →
> Athena and Redshift Spectrum both query it → Lake Formation governs
> who sees what, enforced consistently across both query engines.**
> This is the shape of a real production data platform, and it's the
> shape the exam's hardest scenario questions assume you already
> understand end to end.

---

## 1. Objective

This lab builds hands-on muscle memory for:

- **Domain 1, Task 1.1 / 1.2** — streaming ingestion with dynamic
  partitioning (LAB-05's pattern) feeding a Glue ETL job with job
  bookmarks (LAB-02's pattern), chained together instead of practiced
  in isolation
- **Domain 2, Task 2.1 / 2.2 / 2.4** — landing transformed data as an
  **Apache Iceberg** table (LAB-03's pattern) that two different query
  engines — Athena and Redshift Spectrum — both read from the *same*
  Glue Catalog table, no duplication
- **Domain 4, Task 4.2** — Lake Formation column-level governance
  (LAB-06's pattern) applied to a table that is queried from **two**
  engines, and seeing directly that the grant is enforced once, at the
  catalog/data layer, not once per query engine
- The single biggest architectural idea the exam rewards: **the Glue
  Data Catalog is the shared contract.** Firehose writes data it never
  reads back. Glue transforms it once. Athena and Redshift both read
  the same catalog entry without either one owning the data. Lake
  Formation governs access to that catalog entry once, and every
  engine that respects it inherits the restriction for free.

By the end you will have watched a single record travel from a
simulated event, through streaming ingestion, through a bookmarked
transform, into a governed Iceberg table, and out through two
different SQL engines — with a column hidden from a restricted
identity in **both** of them.

---

## 2. Prerequisites

- **Strongly recommended: LAB-01, LAB-02, LAB-03, LAB-05, and LAB-06
  completed**, ideally in that order, so the patterns in this lab feel
  like assembly rather than new material. This lab explicitly reuses
  their naming conventions and mental models rather than re-explaining
  them — go back to the referenced lab's step if a piece feels
  unfamiliar.
- If you already ran **Cleanup** on those labs, that's fine — this lab
  is self-contained and rebuilds what it needs under its own
  `dea-lab08-*` naming; it just moves faster through steps you've
  already done once elsewhere and cross-references rather than
  re-explains them.
- IAM permissions: everything from LAB-02 (Glue), LAB-04 (Redshift
  Serverless), LAB-05 (Firehose), and LAB-06 (Lake Formation admin,
  second IAM role) combined. If you're on a personal study account
  with broad managed policies attached, no extra setup is needed.
- Athena engine version 3 (for Iceberg support — see LAB-03 Common
  Error #1 if you hit this).

---

## 3. Estimated cost

| Resource | Cost driver | Estimate |
|---|---|---|
| Firehose | Per-GB ingested, trivial test volume | Fractions of a cent |
| Glue ETL job (bookmarked, 2 runs) | DPU-hours, G.1X × 2 workers | ~$0.15–$0.30 |
| Athena queries | $5/TB scanned, 10 MB minimum | A few cents |
| Redshift Serverless | RPU-seconds while actively queried, 8 RPU base | **$2–$4 for a single focused session** — this is the expensive line item, exactly as it was in LAB-04 |
| Lake Formation | Free | $0 |
| S3 | A few MB | Effectively $0 |
| **Total** | | **Under $5** if you complete Redshift-related steps in one sitting and clean up the same day |

**How to avoid surprise charges:** this lab inherits LAB-04's cost
profile almost exactly, because it reuses Redshift Serverless — same
warning applies: **do not leave the namespace/workgroup provisioned
overnight "to finish tomorrow."** If you're short on time or budget,
you can complete Steps 1–8 (ingest through Lake Formation on Athena)
and treat Step 9 (Redshift Spectrum + Lake Formation) as optional —
note in Section 8 explicitly calls out what you'd be skipping.

---

## 4. Step-by-step instructions

### Step 1 — Create the S3 layout

```
s3://dea-lab08-.../raw/orders/        (Firehose delivery target)
s3://dea-lab08-.../curated/orders/    (Glue job's Iceberg table location)
s3://dea-lab08-.../errors/            (Firehose error records)
s3://dea-lab08-.../athena-results/    (Athena query output)
```

```bash
aws s3 mb s3://dea-lab08-nk-7734
```

### Step 2 — Create the raw-zone Glue Catalog table (schema for Firehose's Parquet conversion)

Same pattern as LAB-05 Step 1 — Firehose's format-conversion feature
needs an existing Glue table to know the target Parquet schema.

**Console:** **Glue → Data Catalog → Tables → Add table manually.**
- Database: `dea_lab08_db` (create new).
- Table name: `orders_raw`.
- Location: `s3://dea-lab08-.../raw/orders/`. Format: **Parquet**.
- Columns: `order_id` (string), `customer_id` (string), `customer_email`
  (string — this is the column Step 8's Lake Formation grant will later
  hide), `order_date` (string), `amount` (double), `status` (string).

### Step 3 — Create the Firehose delivery stream with dynamic partitioning

**Console:** **Amazon Data Firehose → Create Firehose stream.**
- Source: Direct PUT. Destination: S3.
- Name: `dea-lab08-orders-stream`.
- Record format conversion: **Enabled → Apache Parquet**, using
  `dea_lab08_db.orders_raw`.
- Dynamic partitioning: **Enabled**, inline JSON parsing, partition key
  `order_month` (top-level field in the test payload, same
  keep-it-simple approach LAB-05 used to avoid JQ date-function issues).
- S3 prefix: `raw/orders/order_month=!{partitionKeyFromQuery:order_month}/`.
- Buffer hints: 1 MiB / 60 seconds (lab speed, not production tuning —
  see LAB-05 Common Error #5 for why this matters for file count).
- IAM role: new, with S3 write + Glue Catalog read.

**CLI equivalent:** console is the practical path here — see LAB-05
Step 3 for the full config shape.

### Step 4 — Send test order events

```bash
# {"order_id":"2001","customer_id":"C101","customer_email":"a@x.com","order_month":"2024-01","order_date":"2024-01-08","amount":210.00,"status":"SHIPPED"}
aws firehose put-record \
  --delivery-stream-name dea-lab08-orders-stream \
  --record '{"Data":"<base64-of-the-json-above>"}'
```

Send at least **6 records across 2–3 different `order_month` values**
(reuse LAB-05's base64 technique) so the downstream partitioning and
LF-governance steps have enough shape to be meaningful. Wait ~60–90
seconds for the buffer to flush, then confirm files landed under
`s3://dea-lab08-.../raw/orders/order_month=.../`.

### Step 5 — Crawl the raw zone so the Glue job has partition-aware source metadata

**Console:** **Glue → Crawlers → Create crawler**, name
`dea-lab08-raw-crawler`, source `s3://dea-lab08-.../raw/orders/`,
database `dea_lab08_db`, run once. Confirm `orders_raw` now shows
`order_month` as a partition column (this **replaces** the manually
defined table from Step 2's fixed schema with a partition-aware one —
same "why catalog the source first" reasoning as LAB-02 Step 2).

### Step 6 — Glue ETL job: bookmarked read, Iceberg write

This is the step that's genuinely new versus any single prior lab:
a **bookmarked** Glue job whose **target is Iceberg**, not plain
Parquet.

**Console:** **Glue Studio → Create job → Visual ETL** (or a script
job if you're comfortable hand-editing — the Iceberg sink is easier to
get right via a Spark SQL custom transform than via the visual S3
target node, which as of most Glue versions still models Iceberg
awkwardly in the pure drag-and-drop builder).

1. **Source**: Glue Data Catalog → `dea_lab08_db.orders_raw`.
2. **Custom transform (Spark SQL)** node:
   ```sql
   SELECT order_id, customer_id, customer_email,
          CAST(amount AS double) AS amount,
          status,
          CAST(order_date AS date) AS order_date
   FROM myDataSource
   ```
3. **Job details**:
   - Name: `dea-lab08-curate-iceberg`.
   - Job parameters (**Advanced properties**), add:
     `--datalake-formats` = `iceberg`
   - Worker type **G.1X**, 2 workers, **Job bookmark: Enable**.
4. **Script tail** (append after the transform, since the Iceberg
   sink is expressed in Spark SQL rather than a visual node): edit the
   generated script and add, after the transform DataFrame is
   produced (call it `curated_df`):
   ```python
   curated_df.createOrReplaceTempView("curated_batch")

   spark.sql("""
     CREATE TABLE IF NOT EXISTS glue_catalog.dea_lab08_db.orders_iceberg (
       order_id      string,
       customer_id   string,
       customer_email string,
       amount        double,
       status        string,
       order_date    date
     )
     USING iceberg
     PARTITIONED BY (months(order_date))
     LOCATION 's3://dea-lab08-.../curated/orders/'
   """)

   spark.sql("""
     INSERT INTO glue_catalog.dea_lab08_db.orders_iceberg
     SELECT * FROM curated_batch
   """)
   ```
   Note `PARTITIONED BY (months(order_date))` — this is LAB-03's
   **hidden partitioning** again, now happening inside a bookmarked
   Glue job instead of a hand-typed Athena `CREATE TABLE`.
5. Save, run.

**The bookmark/Iceberg interaction worth internalizing:** the job
bookmark tracks which **source** files/records from `orders_raw` have
already been read — it has nothing to do with Iceberg's own snapshot
history on the **target** side. Re-running this job with no new raw
data does the same thing LAB-02 taught: zero new rows read, `INSERT
INTO` runs against an empty `curated_batch`, no new Iceberg snapshot
with real data is created. The two mechanisms (Glue bookmark on read,
Iceberg snapshot on write) are independent and this is a genuinely
common point of confusion — a job bookmark does **not** mean "Iceberg
won't create a new snapshot," and an Iceberg snapshot does **not**
mean "the bookmark didn't advance." They answer different questions.

### Step 7 — Query the Iceberg table in Athena

```sql
SELECT order_month, COUNT(*), SUM(amount)
FROM dea_lab08_db.orders_iceberg
GROUP BY order_month
ORDER BY order_month;
```
Wait — there's no `order_month` column in `orders_iceberg` (it was
derived from `order_date` via hidden partitioning, not carried as a
physical field). Query on the real column instead:
```sql
SELECT date_trunc('month', order_date) AS month, COUNT(*), SUM(amount)
FROM dea_lab08_db.orders_iceberg
GROUP BY 1 ORDER BY 1;
```
This distinction — physical partition column (LAB-01/02/05's world) vs
Iceberg hidden partitioning derived from a real data column (LAB-03's
world) — is exactly the contrast Section 8 will ask you to articulate.

### Step 8 — Add a Redshift Serverless workgroup and query the same Iceberg table via Spectrum

**Console:** repeat LAB-04 Steps 1–3 (namespace `dea-lab08-ns`,
workgroup `dea-lab08-wg`, 8 RPU base, usage limit set **before** any
query — don't skip that habit here either). Then:

```sql
CREATE EXTERNAL SCHEMA lab08_spectrum
FROM DATA CATALOG
DATABASE 'dea_lab08_db'
IAM_ROLE default
REGION 'us-east-1';

SELECT date_trunc('month', order_date) AS month, COUNT(*), SUM(amount)
FROM lab08_spectrum.orders_iceberg
GROUP BY 1 ORDER BY 1;
```
**Validation:** identical results to Step 7's Athena query — **same
Iceberg table, same Glue Catalog entry, two completely different query
engines**, no data copied or reloaded between them. This is the
concrete proof of Section 1's "shared contract" idea.

### Step 9 — Lake Formation: govern the column, verify on Athena (required), note Redshift's path (optional)

Repeat LAB-06's pattern against this lab's table instead of rebuilding
it from scratch:

1. **LF admin + IAM-only-access-control check** — LAB-06 Step 1.
2. **Register** `s3://dea-lab08-.../curated/orders/` — LAB-06 Step 2.
3. **Create the restricted role** `dea-lab08-restricted-analyst` —
   LAB-06 Step 4.
4. **Grant column-level SELECT** on `dea_lab08_db.orders_iceberg`,
   excluding `customer_email`, plus database-level `DESCRIBE` — LAB-06
   Step 5 (the `ColumnWildcard`/`ExcludedColumnNames` CLI shape is
   identical; just point it at `orders_iceberg`).
5. **Verify in Athena** (required, and the cleanest verification):
   assume the restricted role, confirm `SELECT order_id, amount FROM
   orders_iceberg` succeeds and `SELECT customer_email FROM
   orders_iceberg` is denied — exactly LAB-06 Steps 6–7, now against
   an **Iceberg** table instead of plain Parquet, proving Lake
   Formation's column filtering isn't format-specific.
6. **Redshift Spectrum + Lake Formation (optional, genuinely more
   involved — read before attempting):** getting Redshift Spectrum
   queries to be evaluated **per IAM principal** against Lake
   Formation grants (rather than against the workgroup's single
   `IAM_ROLE default`) requires Redshift's **Lake Formation
   integration for Spectrum**, which maps individual database users or
   roles to IAM identities via `CREATE EXTERNAL SCHEMA ... IAM_ROLE
   '<per-user-role-arn>'` chaining rather than the single shared
   `default` role this lab used in Step 8. That's a legitimate Day 8
   reading topic, not a same-lab hands-on step — attempting it fully
   here would roughly double this lab's length for a mechanism the
   exam tests conceptually ("Lake Formation permissions can extend to
   Redshift Spectrum") far more often than it tests the exact IAM
   role-chaining configuration. If you want to see it partially: note
   that `lab08_spectrum.orders_iceberg` queried under the workgroup's
   single `default` role in Step 8 **is not** the restricted role, so
   it still sees `customer_email` — that's expected and consistent
   with what you just read, not a bug.

---

## 5. Validation checkpoints

| Checkpoint | How to verify | Expected result |
|---|---|---|
| Firehose delivers partitioned Parquet | S3 console under `raw/orders/` | `order_month=.../` prefixes with Parquet files |
| Raw table partition-aware | Glue → Tables → `orders_raw` | `order_month` listed as a partition column after Step 5's crawl |
| Glue job succeeds, Iceberg table created | Glue Studio → Runs; Athena `SHOW TABLES` | Run `Succeeded`; `orders_iceberg` exists with `table_type=ICEBERG` |
| Bookmark advances correctly | Re-run the Glue job with no new Firehose data | Zero new rows read; no new populated Iceberg snapshot |
| Athena reads the Iceberg table | Step 7 query | Row counts match records sent in Step 4 |
| Redshift Spectrum reads the *same* table | Step 8 query | Identical output to Step 7, no separate load step |
| Lake Formation blocks the column in Athena | Step 9.5, restricted role | `customer_email` query denied; other columns succeed |
| Admin identity unaffected | Re-run Step 7 as your primary identity | Full row including `customer_email` |

---

## 6. Common errors and fixes

1. **Glue job fails at the `spark.sql("CREATE TABLE ... USING
   iceberg")` line with `Unable to find catalog glue_catalog` or a
   similar catalog-not-configured error.**
   *Cause:* the job is missing the `--datalake-formats iceberg` job
   parameter (Step 6.3), which is what wires up the `glue_catalog`
   Spark catalog alias to the AWS Glue Data Catalog with Iceberg
   support enabled. *Fix:* add the parameter under **Job details →
   Advanced properties → Job parameters**, save, re-run — this is not
   optional plumbing, it's the single setting that makes the whole
   Iceberg-via-Glue-job pattern work.

2. **Athena's Step 7 query returns zero rows even though the Glue job
   run in Step 6 shows `Succeeded`.**
   *Cause:* almost always that the crawler in Step 5 was skipped or
   run *before* Firehose had delivered any files yet, so `orders_raw`
   (the Glue job's **source**) had no partitions to read, and the job
   legitimately processed zero input rows — check the job run's
   "records read" metric to confirm. *Fix:* re-run the Step 5 crawler
   after confirming Step 4's files exist in S3, then re-run the Glue
   job.

3. **Redshift Spectrum's Step 8 query fails with
   `ExternalTableNotFoundException` or a table-type error mentioning
   Iceberg.**
   *Cause:* Redshift Spectrum's Iceberg read support requires a
   reasonably current Redshift release; a namespace created long ago
   with an old engine version can lag. *Fix:* check **Redshift
   Serverless console → namespace → engine version**, and if there's
   an upgrade available, apply it; this is rarely an issue for a
   freshly created Serverless namespace but worth ruling out first.

4. **Lake Formation grant in Step 9 appears to have no effect — the
   restricted role still sees `customer_email` in Athena.**
   *Cause:* This is LAB-06's Common Error #2, verbatim — almost always
   "Use only IAM access control" wasn't unchecked for `dea_lab08_db`.
   *Fix:* revisit LAB-06 Common Error #2's fix directly; it applies
   unchanged here.

5. **The Iceberg `INSERT INTO` in Step 6 succeeds on the first job run
   but fails on the second (post-new-data) run with a schema mismatch
   error.**
   *Cause:* if the raw JSON payloads sent in different Step 4 batches
   don't have exactly consistent field types (e.g., `amount` sent as a
   JSON string in one batch, a number in another — the same failure
   mode LAB-05 Common Error #2 describes at the Firehose layer), the
   Spark SQL `CAST` in Step 6.2 can produce a differently-typed
   DataFrame between runs, and Iceberg's schema enforcement (unlike
   plain Parquet appends) will reject a genuinely incompatible insert
   rather than silently accepting it. *Fix:* this is Iceberg
   correctly doing its job — go back to the source JSON and fix the
   type inconsistency, don't work around it by loosening the Iceberg
   table's schema.

---

## 7. Cleanup steps

Work backward through the chain — governance and query layers first,
then compute, then storage.

1. **Lake Formation**: revoke the column-level grant, deregister the
   S3 location (LAB-06 Step 1–2 of Cleanup).
2. **IAM role**: delete `dea-lab08-restricted-analyst`.
3. **Redshift Serverless**: drop the external schema, then delete the
   **workgroup**, then the **namespace**, in that order (LAB-04
   Cleanup Step 2) — do this the same day, it's the line item that
   actually costs money if left running.
4. **Glue**: delete the job `dea-lab08-curate-iceberg`, the crawler
   `dea-lab08-raw-crawler`, and the database `dea_lab08_db` (cascades
   to `orders_raw` and `orders_iceberg`).
   ```bash
   aws glue delete-database --name dea_lab08_db
   ```
5. **Firehose**: delete `dea-lab08-orders-stream`.
6. **S3**: empty and delete the bucket.
   ```bash
   aws s3 rm s3://dea-lab08-nk-7734 --recursive
   aws s3api delete-bucket --bucket dea-lab08-nk-7734
   ```
7. **Verify**: no `dea-lab08-*` resources remain in Firehose, Glue,
   Redshift Serverless, Lake Formation, or S3 consoles; check **Billing
   → Cost Explorer** the next day to confirm the Redshift Serverless
   charge stopped accruing.

---

## 8. What you learned

This lab directly reinforces, as a single connected system rather than
isolated pieces:

- **The Glue Data Catalog as the shared contract** — Firehose, Glue
  ETL, Athena, and Redshift Spectrum never talked to each other
  directly; every handoff happened through a Glue Catalog table
  definition. This is *the* mental model the exam's hardest
  architecture questions assume: naming a service is not the same as
  understanding what catalog entry it reads or writes.
- **Job bookmarks (read-side, Glue-specific) vs. Iceberg snapshots
  (write-side, table-format-native) are independent mechanisms** that
  happen to sit next to each other in this pipeline — Step 6's
  explanation and Common Error #5 both hinge on not conflating them.
- **Physical partition columns (LAB-01/02/05) vs. Iceberg hidden
  partitioning (LAB-03, reused here)** produce different query
  ergonomics on data that otherwise looks the same — Step 7's
  `order_month` vs. `date_trunc('month', order_date)` distinction is
  the concrete version of a question the exam asks abstractly.
- **Lake Formation governs the catalog entry, not the query engine** —
  Step 9 showed a column-level grant enforced in Athena; the optional
  Step 9.6 discussion is honest about what it would take to prove the
  same enforcement in Redshift Spectrum, because pretending that's a
  two-minute extension of LAB-06 would be teaching something false.
- The full chain is the answer to the exam's most demanding scenario
  shape: *"design a pipeline where streaming data lands in a governed,
  ACID-compliant lake table queryable from multiple engines with
  consistent fine-grained access control"* — you didn't just read that
  sentence, you built it.

### Practice questions

**Q1.** In Step 6, why does the Glue job need the `--datalake-formats
iceberg` job parameter in addition to the Spark SQL `CREATE TABLE ...
USING iceberg` statement?

- A. The parameter is cosmetic; `USING iceberg` alone is sufficient in
  every Glue version.
- B. The parameter registers the Iceberg table-format libraries and
  wires the `glue_catalog` Spark catalog to the Glue Data Catalog with
  Iceberg support enabled — without it, the job has no catalog
  implementation capable of resolving `glue_catalog.dea_lab08_db....`
  at all.
- C. It is only required for reading Iceberg tables, not writing them.
- D. It enables job bookmarks specifically for Iceberg targets.

> **Answer: B.** This is exactly Common Error #1 in this lab — the
> job parameter is what makes the `glue_catalog` alias resolvable;
> without it, the `CREATE TABLE`/`INSERT INTO` statements have no
> catalog to talk to. A is false — it's a functional requirement, not
> decoration, confirmed by the error you get without it. C is false —
> it's required for both reading and writing Iceberg tables through
> Glue's Spark integration. D is false — bookmarks are an independent,
> unrelated Glue feature configured separately (Step 6.3's job details,
> not the datalake-formats parameter).

**Q2.** After Step 6's Glue job runs successfully twice — once with
new Firehose data, once with none — a teammate asks: "did the second
run create a new Iceberg snapshot?" Based on this lab's explanation of
bookmarks vs. snapshots, what's the most accurate answer?

- A. No snapshot was created on either run, since bookmarks prevent
  Iceberg from tracking history for bookmarked jobs.
- B. The second run still executes `INSERT INTO` against an empty
  (zero-row) DataFrame, since the bookmark caused zero new source rows
  to be read — whether that produces a new (empty) snapshot or a no-op
  depends on Iceberg/Spark's exact write behavior for an empty insert,
  but no *new data* enters the table either way; the two mechanisms
  (source-side bookmark, target-side snapshot) are simply answering
  different questions.
- C. Yes, definitely, because every Glue job run always creates exactly
  one new Iceberg snapshot regardless of row count.
- D. The bookmark and the Iceberg snapshot are the same underlying
  mechanism, so the question doesn't apply.

> **Answer: B.** This is the precise nuance Step 6 and the "What you
> learned" section both call out — the honest answer avoids the false
> certainty of A, C, and D, and instead correctly separates "did new
> data get processed" (no, per the bookmark) from "did Iceberg's own
> write path do something" (a separate, independent question). A is
> false — bookmarks don't disable Iceberg's snapshot mechanism; they're
> unrelated systems. C overstates certainty about Iceberg/Spark
> internals not established by this lab. D conflates two genuinely
> different mechanisms this lab explicitly separates.

**Q3.** Why does Step 7's first query attempt (`GROUP BY order_month`)
fail against `orders_iceberg`, even though `order_month` was a valid
partitioning concept used earlier in the same pipeline (Step 3's
Firehose dynamic partitioning)?

- A. Iceberg tables never support `GROUP BY` on any column.
- B. `order_month` was a physical field only in the *raw* Firehose
  output (used for S3 prefix partitioning at ingestion); the curated
  Iceberg table was built with hidden partitioning derived from the
  real `order_date` column instead, so `order_month` was never carried
  forward as an actual column in `orders_iceberg`.
- C. Athena engine version 2 is required for querying derived
  partition columns.
- D. The Glue job silently renamed `order_month` to `order_date`
  during the transform.

> **Answer: B.** This is the exact distinction Step 7 calls out —
> Firehose's dynamic partitioning (Step 3) and Iceberg's hidden
> partitioning (Step 6) are two different partitioning mechanisms
> operating on two different tables in the same pipeline, and only one
> of them produces a physically queryable column. A is false — Iceberg
> tables fully support standard SQL aggregation. C is false and
> inverted — engine version 3, not 2, is what's needed for Iceberg
> support at all (per LAB-03). D is false — nothing was renamed; the
> column was never created in the first place, by design.

**Q4.** What does Step 8's successful Redshift Spectrum query against
`lab08_spectrum.orders_iceberg` — returning results identical to
Athena's Step 7 query — most directly demonstrate about this
pipeline's architecture?

- A. Redshift automatically copied the Iceberg table's data into its
  own managed storage the first time it was queried.
- B. Athena and Redshift Spectrum are both reading the same underlying
  Iceberg table through the same Glue Data Catalog entry, with no data
  duplicated or reloaded between the two query paths — the catalog
  entry, not either query engine, is the source of truth.
- C. Redshift Spectrum requires Iceberg tables to first be converted
  to a Redshift-native format before querying.
- D. The matching results are coincidental and not guaranteed by the
  architecture.

> **Answer: B.** This is the core "shared contract" idea named in
> Section 1 and Section 8 — one physical table, one catalog entry, two
> independent query engines reading it natively. A is false — Spectrum
> queries S3 directly at query time; it does not copy data into
> Redshift-managed storage (that's what `COPY` does, and this lab
> deliberately didn't use it here). C is false — Spectrum reads
> Iceberg tables natively via the Glue Catalog, no conversion step. D
> is false — the matching results are the expected, architecturally
> guaranteed outcome of both engines reading the identical table, not
> a coincidence.

**Q5.** Step 9.6 explains that fully testing Lake Formation's
column-level denial against Redshift Spectrum (per-IAM-principal, the
way Step 9.5 tested it in Athena) requires more setup than this lab
performs, and explicitly avoids faking that verification. Why does the
lab take this approach instead of just claiming the Redshift test
"works the same way" as the Athena test?

- A. Because Lake Formation grants genuinely do not apply to Redshift
  Spectrum under any configuration, making the claim false regardless.
- B. Because the single shared `IAM_ROLE default` used for the
  workgroup's external schema in Step 8 is not the same thing as
  per-user/per-role identity enforcement — proving the restricted
  role's column denial in Redshift specifically would require Lake
  Formation's Redshift integration with per-principal IAM role
  mapping, which is a materially different (and more involved) setup
  than what Step 8 configured, and asserting it "just works" without
  building it would be teaching something not actually verified.
- C. Because Redshift Spectrum does not support external schemas backed
  by the Glue Data Catalog.
- D. Because Iceberg tables specifically are incompatible with Lake
  Formation governance, unlike plain Parquet tables.

> **Answer: B.** This reflects the lab's own stated honesty principle
> — Step 8 configured one shared `default` IAM role for the whole
> workgroup, which is architecturally different from per-principal
> enforcement, so claiming the column-hiding behavior "carries over"
> without configuring that per-principal mapping would be an unverified
> (and likely false, in the workgroup's current configuration) claim.
> A overstates it — Lake Formation integration with Redshift Spectrum
> does exist, it just wasn't the configuration this lab built. C is
> false — Step 8 successfully used exactly such an external schema. D
> is false — LAB-06 and Step 9.5 both demonstrated Lake Formation
> column filtering working against Iceberg tables in Athena; Iceberg is
> not the limiting factor here, the IAM role-mapping configuration is.
