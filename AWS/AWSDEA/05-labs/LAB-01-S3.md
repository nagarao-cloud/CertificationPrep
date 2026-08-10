# LAB-01 — S3, Partitioned Parquet, Glue Crawler, First Athena Query

> **Day 1 anchor lab.** Builds the storage foundation every later lab
> (02, 03, 06, 08) reuses. Do this one first — do not skip it.

---

## 1. Objective

This lab builds hands-on muscle memory for:

- **Domain 1, Task 1.2** — transforming data between formats (CSV → Parquet)
- **Domain 2, Task 2.1** — choosing a storage service and layout for a
  given access pattern
- **Domain 2, Task 2.2** — building a Glue Data Catalog table via a
  **crawler**, and understanding what a crawler actually infers
  (schema, partitions, classifier) versus what it gets wrong
- **Domain 2, Task 2.4** — partitioning strategy and the small-file problem

By the end you will have touched, with your own hands, the exact chain
the exam describes in the abstract: **raw object in S3 → partitioned
columnar file → Glue Data Catalog table → SQL query in Athena.** Every
other domain builds on top of this chain. If S3 + Glue Catalog +
Athena doesn't feel automatic after this lab, redo it before Day 2.

---

## 2. Prerequisites

- An AWS account with console access. Free Tier is fine — this lab
  stays inside or barely brushes Free Tier limits.
- An IAM user or role with permissions for: S3 (create bucket,
  put/get/list objects), AWS Glue (create database, crawler, run
  crawler, view catalog), Athena (run queries, create workgroup),
  CloudWatch Logs (crawlers write logs there).
  - Fastest path for a personal study account: attach
    `AmazonS3FullAccess`, `AWSGlueConsoleFullAccess`, and
    `AmazonAthenaFullAccess` to your user. **Do not do this in a
    production or shared account** — these are broad managed policies.
    If you're on a shared/company account, ask for scoped equivalents.
- No prior labs required — this is the first one.
- A region you'll use for **every** lab in this series, so resources
  can reference each other. This guide uses `us-east-1` in examples;
  substitute your chosen region consistently.

---

## 3. Estimated cost

| Resource | Cost driver | Estimate |
|---|---|---|
| S3 storage | ~5 MB of sample data | Effectively $0 (well under 5 GB free tier) |
| S3 requests | A few hundred PUT/GET during crawling and querying | Effectively $0 |
| Glue crawler | Billed per DPU-hour, 10-minute minimum per run | ~$0.04–$0.09 per run (you'll run it 2–3 times) |
| Glue Data Catalog | First 1M objects stored and 1M requests/month free | $0 |
| Athena | $5 per TB scanned, 10 MB minimum per query | A few cents total for this lab's queries |
| **Total** | | **Under $0.50** if you clean up same-day |

**How to avoid surprise charges:**
- The Glue crawler is the only thing here billed with a *minimum*
  duration (10 minutes even if it finishes in 90 seconds) — don't run
  it in a loop while debugging; run it once, check the log, fix the
  root cause, run again.
- Delete the S3 bucket and Glue database in the **Cleanup** section
  below. An empty Glue Data Catalog with no crawlers running costs
  nothing sitting idle, but an S3 bucket with data in it accrues
  storage charges forever if forgotten.
- Athena has no idle cost — you're only billed per query. Still,
  set a **workgroup query limit** (Step 8) as a habit for later, more
  expensive labs.

---

## 4. Step-by-step instructions

### Step 1 — Create the S3 bucket

**Console:**
1. Go to **S3** → **Create bucket**.
2. Bucket name: `dea-lab01-<your-initials>-<random-4-digits>` (S3
   bucket names are globally unique across all AWS accounts — you
   will get a naming collision if you use something generic like
   `my-data-lake`).
3. Region: your chosen region (e.g., `us-east-1`).
4. Leave **Block all public access** checked (default) — this is a
   private study bucket.
5. Leave versioning **disabled** for this lab (you'll enable it
   deliberately in a later exercise, not here — enabling it now just
   adds noise while you're learning the basics).
6. Leave default encryption as **SSE-S3** (Amazon S3 managed keys) —
   the free default. You'll practice SSE-KMS in Day 8's security work.
7. Click **Create bucket**.

**CLI equivalent:**
```bash
aws s3api create-bucket \
  --bucket dea-lab01-nk-8291 \
  --region us-east-1
```
(Regions outside `us-east-1` require a
`--create-bucket-configuration LocationConstraint=<region>` argument —
`us-east-1` is the one exception in the API.)

### Step 2 — Create the folder layout (prefixes)

S3 has no real folders — prefixes just look like folders in the
console. Create this structure, which mirrors a **Hive-style
partitioned layout** (the layout both the Glue crawler and Athena
expect by convention):

```
s3://dea-lab01-nk-8291/
└── raw/
    └── orders/
        ├── year=2024/month=01/
        ├── year=2024/month=02/
        └── year=2024/month=03/
```

**Console:** In the bucket, click **Create folder** and type the full
path `raw/orders/year=2024/month=01/` — S3 will create all the
intermediate prefixes at once. Repeat for `month=02` and `month=03`.

**Why `key=value` naming matters:** Athena and the Glue crawler both
recognize the `year=2024` / `month=01` pattern automatically and
register `year` and `month` as **partition columns** with zero extra
configuration. If you instead used `raw/orders/2024/01/` (no key
names), the crawler would create separate tables per path instead of
one partitioned table — a classic beginner mistake and a real exam trap.

### Step 3 — Get and prepare sample data

Use a small synthetic "orders" CSV. Create one locally, 20–30 rows,
with this schema (any spreadsheet tool or text editor works):

```csv
order_id,customer_id,order_date,amount,status
1001,C001,2024-01-05,129.99,SHIPPED
1002,C002,2024-01-12,54.50,SHIPPED
1003,C003,2024-01-20,899.00,CANCELLED
...
```

Split the rows by month into three files: `orders_jan.csv`,
`orders_feb.csv`, `orders_mar.csv` (roughly 8–10 rows each, dated
within that month). This is deliberate — it forces you to see the
crawler discover **three partitions**, not one file.

### Step 4 — Convert CSV to Parquet (locally, using a tool you already have)

For this lab, convert with the AWS Glue console's own **DataBrew** or,
simpler for a first pass, upload the CSVs as-is to a `raw-csv/` prefix
and note that **columnar conversion is LAB-02's job** (that's the
Glue ETL job). For LAB-01, the goal is to see partitioning and
cataloging work end to end quickly, so:

- If you want the full CSV→Parquet experience *today*, open **AWS Glue
  Studio** → **Jobs** → **Visual ETL**, source = S3 (your CSV
  prefix), target = S3 (a `processed/orders/` prefix) with **Format:
  Parquet** and **Compression: Snappy**, and run it once manually
  (this is a simplified preview of LAB-02 — don't add bookmarks or
  scheduling yet, that's next lab).
- If you want to keep LAB-01 strictly about S3 + crawler + Athena,
  skip ahead and just upload the CSVs directly to the partitioned
  prefixes from Step 2, and note in your own words: *"in production
  this would be Parquet with Snappy compression, not raw CSV — CSV is
  here for speed of the first lab only."* Either path is fine; the
  important exam-relevant skill is the partition layout and the
  catalog, not the file format conversion mechanics (LAB-02 owns that).

Upload each month's file to its matching partition folder:

```
raw/orders/year=2024/month=01/orders_jan.csv
raw/orders/year=2024/month=02/orders_feb.csv
raw/orders/year=2024/month=03/orders_mar.csv
```

**Console:** Open each `month=NN` folder → **Upload** → select the
matching file → **Upload**.

**CLI equivalent:**
```bash
aws s3 cp orders_jan.csv s3://dea-lab01-nk-8291/raw/orders/year=2024/month=01/
aws s3 cp orders_feb.csv s3://dea-lab01-nk-8291/raw/orders/year=2024/month=02/
aws s3 cp orders_mar.csv s3://dea-lab01-nk-8291/raw/orders/year=2024/month=03/
```

### Step 5 — Create a Glue Data Catalog database

**Console:** Go to **AWS Glue** → **Data Catalog** → **Databases** →
**Add database**. Name it `dea_lab_db`. Leave location blank. Create.

**CLI equivalent:**
```bash
aws glue create-database --database-input '{"Name":"dea_lab_db"}'
```

### Step 6 — Create and run a crawler

**Console:**
1. **AWS Glue** → **Crawlers** → **Create crawler**.
2. Name: `dea-lab01-orders-crawler`.
3. **Data source configuration**: Add a data source → S3 → browse to
   `s3://dea-lab01-nk-8291/raw/orders/` (point at the **table root**,
   not an individual `month=` folder — pointing too deep is a common
   mistake that produces one table per partition instead of one
   partitioned table).
4. **IAM role**: Create new role (the console will scope it to this
   bucket) or reuse an existing `AWSGlueServiceRole`-based role.
5. **Output**: target database `dea_lab_db`, no prefix needed.
6. **Schedule**: **On demand** (you'll run it manually today; LAB-02
   is where scheduling matters).
7. Create crawler, then select it and click **Run**.
8. Wait for status to change from `Running` to `Ready` (roughly
   1–3 minutes for a dataset this small, though Glue reserves a
   10-minute minimum billing window).

**CLI equivalent:**
```bash
aws glue create-crawler \
  --name dea-lab01-orders-crawler \
  --role AWSGlueServiceRole-dea-lab \
  --database-name dea_lab_db \
  --targets '{"S3Targets":[{"Path":"s3://dea-lab01-nk-8291/raw/orders/"}]}'

aws glue start-crawler --name dea-lab01-orders-crawler
```

### Step 7 — Inspect the discovered table

**Console:** **Glue** → **Data Catalog** → **Tables** → click the new
table (likely named `orders`, inferred from the last path segment).
Check:
- **Schema tab**: columns `order_id`, `customer_id`, `order_date`,
  `amount`, `status`, plus two **partition columns**: `year`, `month`.
  Partition columns are visually distinguished from data columns.
- **Partitions tab** (or run `SHOW PARTITIONS` later in Athena): you
  should see **3 partitions** — one per month folder.

If you see the data columns but **zero partitions detected**, see
Common Error #2 below before moving on.

### Step 8 — Query with Athena

**Console:**
1. Go to **Athena** → **Query editor**.
2. First time only: Athena needs an S3 location for query results.
   Click **Edit settings** (top banner) → set the results location to
   `s3://dea-lab01-nk-8291/athena-results/` → Save.
3. (Recommended habit) Go to **Workgroups** → your workgroup → edit →
   enable **"Use client-side settings"** off and set a **data usage
   control** (e.g., 1 GB per query) — this hard-stops runaway scans.
   For this lab's tiny data it won't trigger, but build the habit now.
4. Select database `dea_lab_db` from the left panel.
5. Run:
   ```sql
   SELECT * FROM orders LIMIT 10;
   ```
6. Then run a partition-aware query to prove partition pruning works:
   ```sql
   SELECT year, month, COUNT(*) AS order_count, SUM(amount) AS total
   FROM orders
   WHERE month = '02'
   GROUP BY year, month;
   ```

**CLI equivalent:**
```bash
aws athena start-query-execution \
  --query-string "SELECT * FROM orders LIMIT 10;" \
  --query-execution-context Database=dea_lab_db \
  --result-configuration OutputLocation=s3://dea-lab01-nk-8291/athena-results/
```

---

## 5. Validation checkpoints

| Checkpoint | How to verify | Expected result |
|---|---|---|
| Bucket + prefixes exist | S3 console, navigate the folder tree | `raw/orders/year=2024/month={01,02,03}/` all present, each with one file |
| Crawler ran successfully | Glue → Crawlers → check **Last run status** | `Succeeded`, and "Tables added: 1" (or "Tables updated" on re-runs) |
| Catalog table is correct | Glue → Tables → `orders` → Schema tab | 5 data columns + 2 partition columns (`year`, `month`) |
| Partitions registered | Glue → Tables → `orders` → Partitions tab, or `SHOW PARTITIONS orders;` in Athena | Exactly 3 rows, one per month |
| Athena query works | Run `SELECT * FROM orders LIMIT 10;` | Returns rows with real data, not an error, not zero rows |
| Partition pruning works | Run the `WHERE month = '02'` query, check **Data scanned** in the query result panel | Data scanned is noticeably smaller than a full-table scan (proof Athena only read the `month=02` partition) |

---

## 6. Common errors and fixes

1. **"HIVE_METASTORE_ERROR: Table has no partition data" or Athena
   query returns zero rows even though the table exists.**
   *Cause:* Crawler discovered the schema but not the partitions —
   usually because you pointed the crawler directly at a `month=01/`
   folder instead of the `orders/` parent, so it created three
   separate unpartitioned tables. *Fix:* Delete the wrongly-created
   tables, re-point the crawler at `s3://bucket/raw/orders/` (the
   level *above* `year=`), and re-run.

2. **Crawler finds "0 tables" / "0 partitions" and the run succeeds
   with nothing added.**
   *Cause 1:* The crawler's IAM role doesn't have `s3:GetObject` /
   `s3:ListBucket` on the target bucket. Check the crawler's run log
   in CloudWatch Logs — an `AccessDenied` there confirms it.
   *Cause 2:* Files are sitting directly in `raw/orders/` with no
   `year=/month=` subfolders (typo in the prefix during Step 4).
   *Fix:* Correct the IAM policy or the S3 key structure, then re-run.

3. **`AccessDeniedException` when creating the crawler's IAM role via
   console, or `InvalidInputException: role does not have a trust
   relationship allowing Glue to assume it`.**
   *Cause:* The role's trust policy doesn't list `glue.amazonaws.com`
   as a trusted principal — common if you tried to reuse an unrelated
   role. *Fix:* Let the crawler wizard create a new role for you
   (it wires the trust policy correctly), or manually add:
   ```json
   {
     "Effect": "Allow",
     "Principal": {"Service": "glue.amazonaws.com"},
     "Action": "sts:AssumeRole"
   }
   ```
   to the role's trust relationship.

4. **Athena error: "Query failed: Unable to verify/create output
   bucket" or "No output location provided."**
   *Cause:* You skipped Step 8.2 — Athena has no default results
   bucket. *Fix:* Set the query result location under **Settings →
   Manage** in the Athena console, then re-run the query.

5. **Athena `SELECT * FROM orders` returns a "column mismatch" / wrong
   data type in a column (e.g., `amount` shows as a string, or a
   query filtering `amount > 100` fails).**
   *Cause:* The crawler infers types from a sample of the data, and
   a CSV field like `amount` with inconsistent formatting (some rows
   quoted, some not, or an empty row) can make it infer `string`
   instead of `double`. *Fix:* Open the table in Glue → **Edit
   schema** → manually change the column type to `double`, save, and
   re-run the query (no need to re-crawl).

---

## 7. Cleanup steps

Do these in order — Athena results and the Glue catalog don't
auto-delete when you empty the bucket.

1. **Athena**: no standing resource to delete (queries aren't billed
   idle), but empty the `athena-results/` prefix in the next step.
2. **S3**: empty and delete the bucket.
   - Console: open the bucket → **Empty** (type `permanently delete`
     to confirm) → then **Delete bucket**.
   - CLI:
     ```bash
     aws s3 rm s3://dea-lab01-nk-8291 --recursive
     aws s3api delete-bucket --bucket dea-lab01-nk-8291
     ```
3. **Glue crawler**: delete it (crawlers have no ongoing cost, but
   tidy up so Day 2+ labs don't show a cluttered crawler list).
   ```bash
   aws glue delete-crawler --name dea-lab01-orders-crawler
   ```
4. **Glue database/table**: delete the table, then the database (or
   just delete the database — it cascades to its tables).
   ```bash
   aws glue delete-database --name dea_lab_db
   ```
5. **IAM role**: if the crawler wizard created a dedicated role and
   you won't reuse it in LAB-02, delete it from **IAM → Roles**. If
   you plan to reuse the same bucket/role pattern for LAB-02
   immediately, you can leave it — but note LAB-02 builds its own
   bucket, so this role's S3 permissions won't match anyway.
6. **Verify**: check **Billing → Cost Explorer** or just confirm in
   the S3 and Glue consoles that nothing remains under your lab
   naming prefix (`dea-lab01-*`).

---

## 8. What you learned

This lab directly reinforces:

- **1.2** — you saw why raw CSV vs partitioned columnar data matters,
  even before running a real transform job (LAB-02 finishes this)
- **2.1 / 2.2** — you built a Glue Data Catalog table by crawler
  instead of hand-writing DDL, and saw exactly what a crawler infers
  correctly (schema) versus what depends on your S3 key naming
  (partitions)
- **2.4** — Hive-style `key=value` partitioning, why it's the
  convention both Glue and Athena expect, and what breaks when you
  deviate from it
- The mechanics behind an exam pattern that appears constantly:
  *"a company's Athena queries are slow / scanning too much data —
  what should they do?"* → the answer is almost always **partition
  the data and match the WHERE clause to the partition key**, which
  you just watched happen via the **Data scanned** metric in Step 8.

### Practice questions

**Q1.** A data engineering team stores clickstream data in S3 as
`s3://bucket/clicks/2024/01/15/data.json` (no key names in the path).
They run a Glue crawler pointed at `s3://bucket/clicks/` and then
query the resulting table in Athena filtering on date — but the query
scans the entire dataset every time regardless of the date filter.
What is the most likely cause?

- A. Athena does not support partition filtering on JSON data.
- B. The S3 path uses positional partitioning (`2024/01/15`) instead
  of Hive-style `key=value` naming, so the crawler did not register
  `year`/`month`/`day` as partition columns Athena can prune on.
- C. The Glue crawler needs to be run twice before partitions register.
- D. Athena requires Parquet format to support partition pruning; JSON
  is unsupported for this feature.

> **Answer: B.** Athena's Glue-catalog partition pruning relies on the
> table having registered partition *columns* — which the crawler only
> infers automatically from `key=value` S3 prefixes, or from a manually
> defined partition projection / `ALTER TABLE ADD PARTITION`. A. is
> false — JSON is a fully supported file format for Athena tables,
> format has nothing to do with pruning. C. is false — crawler runs
> are idempotent for schema; running it again with unchanged data
> structure won't create partitions AWS didn't already have naming
> conventions for. D. is false — pruning works on any format as long
> as partition columns are registered; it's a metadata operation, not
> a file-format feature.

**Q2.** During crawler setup, an engineer points the data source at
`s3://bucket/raw/orders/year=2024/month=01/` instead of
`s3://bucket/raw/orders/`. What is the most likely observable result?

- A. The crawler fails immediately with a permissions error.
- B. The crawler creates a table scoped only to that single month,
  with no partition columns, and additional months added later under
  sibling `month=` folders will not automatically appear in it.
- C. The crawler automatically walks up the path to find the
  partition root and corrects the mistake.
- D. Athena will still see all months because S3 prefixes are
  transparent to the query engine regardless of the crawler's target.

> **Answer: B.** The crawler catalogs whatever it's pointed at as the
> table's data location; pointed one level too deep, it treats
> `month=01`'s contents as the whole table and never learns `year=`/
> `month=` are partition keys. A. is wrong — this is a valid
> (if suboptimal) target, not a permissions issue. C. is wrong —
> Glue crawlers do not walk upward from the configured path; you must
> configure the correct root yourself. D. is wrong — Athena only
> queries what's registered in the Glue Catalog table; it has no
> independent visibility into sibling S3 prefixes the table doesn't
> know about.

**Q3.** A beginner uploads three CSV files, each roughly 2 KB, into
three separate S3 partitions and notices in the Athena query result
panel that a `SELECT *` query with no WHERE clause still reports a
very small "Data scanned" value. Why does the *lack* of a WHERE clause
not cause a full, expensive scan here?

- A. Athena always defaults to scanning only the most recent partition
  unless told otherwise.
- B. The total dataset is only a few KB regardless of partitioning —
  "small data scanned" here reflects total dataset size, not evidence
  of pruning; pruning would only become visible/relevant at larger
  data volumes.
- C. Partition pruning applies automatically to all queries, even
  without a WHERE clause, making data volume irrelevant.
- D. Athena billing has a fixed per-query cost unrelated to data
  scanned, so the number shown is not meaningful.

> **Answer: B.** With only ~6 KB of total data across all partitions,
> any query — pruned or not — scans a trivially small amount; the
> Data Scanned metric only becomes a meaningful signal of pruning at
> realistic data volumes (GBs–TBs), which is why production
> partitioning discussions always cite scale. A. is false — Athena has
> no such default behavior. C. is false — pruning requires a
> predicate that maps to a partition column; a bare `SELECT *` has no
> predicate to prune on, so it does scan every partition (all of them,
> here, since there's so little data). D. is false — Athena bills
> $5/TB scanned with a 10 MB minimum per query; the number shown is real.

**Q4.** Why does this lab use `SSE-S3` (Amazon S3-managed keys) as the
default bucket encryption rather than `SSE-KMS`?

- A. SSE-KMS is not compatible with Glue crawlers.
- B. SSE-S3 requires no key management overhead and no per-request KMS
  API cost, which is appropriate for a low-sensitivity study dataset;
  SSE-KMS adds audit trails and access control via key policies, which
  matters more for regulated or sensitive production data (a Day 8 topic).
- C. SSE-KMS cannot be used with Parquet files.
- D. SSE-S3 provides stronger encryption than SSE-KMS.
- 
> **Answer: B.** This is a cost/complexity tradeoff, not a technical
> restriction — both work identically with Glue and Athena. A and C
> are both false; there is no format or service incompatibility
> between SSE-KMS and Glue/Parquet — SSE-KMS is extremely common in
> production data lakes. D is false — SSE-S3 and SSE-KMS both use
> AES-256; the difference is key ownership/management and auditability
> (every SSE-KMS decrypt is a loggable KMS API call in CloudTrail),
> not cryptographic strength.

**Q5.** After running the crawler once successfully, an engineer
uploads a fourth file into a **new** `month=04` folder but does not
re-run the crawler. What happens when they query the table in Athena?

- A. Athena automatically detects new S3 objects in real time and
  includes them in every query.
- B. The query returns an error because the table schema is now stale.
- C. The `month=04` data will not appear in query results until either
  the crawler is re-run (or scheduled) to discover the new partition,
  or the partition is added manually via `MSCK REPAIR TABLE` /
  `ALTER TABLE ... ADD PARTITION`.
- D. S3 triggers an automatic Glue Catalog update on every new object
  by default.

> **Answer: C.** The Glue Data Catalog is a metadata store that must
> be explicitly refreshed — new S3 objects don't propagate into it
> automatically. A and D describe behavior that doesn't exist without
> extra plumbing (e.g., an S3 event trigger invoking a crawler or a
> Lambda that calls `BatchCreatePartition` — not default behavior).
> B is false — the existing partitions still query fine; only the new,
> unregistered partition is invisible, not an error condition. This
> is exactly why production pipelines schedule crawlers or, in LAB-03,
> switch to **partition projection**, which sidesteps needing a
> crawler run at all.
