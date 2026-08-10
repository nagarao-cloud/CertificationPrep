# LAB-07 — EMR Serverless Spark Job (and a Direct Comparison to LAB-02's Glue Job)

> **OPTIONAL — cut first if behind schedule, per the 10-Day Plan's
> "if you fall behind" ordering** (Terraform labs are cut before this
> one, but this is next). If you're on schedule, it's genuinely useful:
> EMR shows up throughout Domain 1 and this is the only lab in the
> series that puts EMR Serverless side by side against Glue on the
> *same task*, which is exactly how the exam likes to frame the choice.

---

## 1. Objective

This lab builds hands-on muscle memory for:

- **Domain 1, Task 1.2** — running a Spark transformation job on
  **EMR Serverless**, and directly comparing its setup, execution
  model, and cost shape against the Glue ETL job built in LAB-02 for
  the *same* CSV→Parquet transformation
- **Domain 1, Task 1.4** — understanding a raw PySpark script (not a
  visual/generated one this time) — reading it, running it, and
  reasoning about worker/executor sizing
- The exam's recurring **"Glue vs. EMR"** decision, felt directly:
  when the managed, opinionated, less-configurable Glue path is
  sufficient vs. when a team needs EMR's fuller Spark/Hadoop
  ecosystem control (custom libraries, non-Glue-supported Spark
  versions, existing Spark codebases, Hive/HBase/Presto alongside
  Spark, EMR on EKS for container-native shops)

By the end you will have run *functionally the same job* (CSV in S3 →
partitioned Parquet out) on two different serverless compute engines,
and be able to state from direct experience — not just from a
comparison table — where the real differences in setup friction, job
startup time, and configurability actually show up.

---

## 2. Prerequisites

- **LAB-02 completed** is strongly recommended (not strictly required)
  — this lab's value is the side-by-side comparison, and Step 5
  assumes you have LAB-02's job run history/cost to compare against.
  If you skipped LAB-02, this lab still works standalone; just skip
  Step 5's comparison table exercise or fill it from the numbers in
  LAB-02's own cost section.
- IAM permissions: create an EMR Serverless application, create an EMR
  Serverless job execution role, S3 read/write access.
- Basic comfort reading (not necessarily writing from scratch) a short
  PySpark script — this lab provides the full script; you're running
  and interpreting it, not authoring it from a blank file.

---

## 3. Estimated cost

| Resource | Cost driver | Estimate |
|---|---|---|
| EMR Serverless application | **No charge while idle** — billed only for actual worker vCPU/memory/storage while a job runs | $0 between runs |
| EMR Serverless job run | Billed per vCPU-hour and GB-hour of memory consumed by workers, per-second billing with a 1-minute minimum | A ~2–4 minute job on minimal workers ≈ **$0.02–$0.10 per run** |
| S3 | A few MB in/out | Effectively $0 |
| **Total** | | **Under $0.50** for several runs |

**How to avoid surprise charges:**
- EMR Serverless applications have **zero idle cost** by design — this
  is a genuine advantage over EMR on EC2 (where a running cluster bills
  per-hour whether or not it's doing useful work) and over Redshift
  Serverless's minimum-RPU-while-active model in LAB-04. You do not
  need to rush this lab to avoid ongoing charges the way you did in
  LAB-04.
- Still, delete the **application** in cleanup — an idle application
  costs nothing, but it's clutter, and if someone (or a script) submits
  a job run against it later by mistake, that run *would* bill.
- Keep **worker configuration modest** — this lab's job needs at most
  1–2 workers with the smallest practical vCPU/memory allocation; don't
  scale workers up "to make it faster" for a KB-scale dataset.

---

## 4. Step-by-step instructions

### Step 1 — Create the S3 layout and upload source data

Reuse the same "orders" CSV pattern from LAB-02 (or copy the actual
files if you kept them):

```
s3://dea-lab07-.../raw-csv/orders/batch1.csv
s3://dea-lab07-.../raw-csv/orders/batch2.csv
s3://dea-lab07-.../scripts/transform.py
s3://dea-lab07-.../processed/orders/        (job writes here)
s3://dea-lab07-.../logs/                    (EMR Serverless job logs)
```

### Step 2 — Write and upload the PySpark script

Save this as `transform.py` and upload to `s3://dea-lab07-.../scripts/`:

```python
from pyspark.sql import SparkSession
from pyspark.sql.functions import substring, col

spark = SparkSession.builder.appName("dea-lab07-csv-to-parquet").getOrCreate()

input_path = "s3://dea-lab07-.../raw-csv/orders/"
output_path = "s3://dea-lab07-.../processed/orders/"

df = spark.read.option("header", "true").option("inferSchema", "true").csv(input_path)

df = df.withColumn("year", substring(col("order_date"), 1, 4)) \
       .withColumn("month", substring(col("order_date"), 6, 2))

df.write.mode("overwrite") \
    .partitionBy("year", "month") \
    .parquet(output_path)

print(f"Rows processed: {df.count()}")
spark.stop()
```

Notice this is **plain, portable PySpark** — no Glue-specific
`DynamicFrame`, no `GlueContext`, no `job.init()`/`job.commit()`
bookmark plumbing. This is the concrete, hands-on version of the exam
fact "Glue DynamicFrames are a Glue-specific abstraction; EMR runs
standard open-source Spark." Also notice: **there is no bookmark
mechanism here at all** — running this script twice against the same
input will reprocess everything and overwrite the output
(`mode("overwrite")`), unlike LAB-02's Glue job. That's not a bug;
EMR/Spark doesn't have a built-in bookmark primitive the way Glue
jobs do — incremental processing on EMR requires you to build your own
logic (tracking processed file lists, watermarking, or Hudi/Iceberg
incremental read patterns), which is real, exam-relevant information.

**CLI upload:**
```bash
aws s3 cp transform.py s3://dea-lab07-.../scripts/
```

### Step 3 — Create an EMR Serverless application

**Console:** **Amazon EMR → EMR Serverless → Create application.**
1. Name: `dea-lab07-app`.
2. Type: **Spark**.
3. Release version: latest available (e.g., `emr-7.x`).
4. Application setup options: **Use default settings** (pre-initialized
   capacity off — you want true scale-to-zero for a study lab, not
   pre-warmed capacity sitting ready, which does bill).
5. Create application. Status becomes `Started` (EMR Serverless
   applications don't consume billable resources just by existing in
   `Started` state — billing starts when a job actually runs).

**CLI equivalent:**
```bash
aws emr-serverless create-application \
  --name dea-lab07-app \
  --release-label emr-7.1.0 \
  --type SPARK
```

### Step 4 — Create the job execution IAM role

**Console:** **IAM → Roles → Create role** → trusted entity: custom
trust policy for `emr-serverless.amazonaws.com`:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "emr-serverless.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
```
Attach a policy granting `s3:GetObject`/`s3:PutObject`/`s3:ListBucket`
on `dea-lab07-.../*` and the bucket itself, plus CloudWatch Logs write
permissions if you enable logging in Step 5.

### Step 5 — Submit the job run

**Console:** **EMR Serverless → your application → Job runs → Submit
job run.**
- Name: `dea-lab07-csv-to-parquet-run1`.
- Runtime role: the role from Step 4.
- Script location: `s3://dea-lab07-.../scripts/transform.py`.
- Spark properties (optional, keep minimal):
  `--conf spark.executor.cores=1 --conf spark.executor.memory=2g --conf spark.driver.cores=1 --conf spark.driver.memory=2g`
- Logging: enable, point at `s3://dea-lab07-.../logs/`.
- Submit.

**CLI equivalent:**
```bash
aws emr-serverless start-job-run \
  --application-id <app-id> \
  --execution-role-arn arn:aws:iam::<account-id>:role/dea-lab07-emr-role \
  --job-driver '{
    "sparkSubmit": {
      "entryPoint": "s3://dea-lab07-.../scripts/transform.py",
      "sparkSubmitParameters": "--conf spark.executor.cores=1 --conf spark.executor.memory=2g"
    }
  }' \
  --configuration-overrides '{
    "monitoringConfiguration": {
      "s3MonitoringConfiguration": {"logUri": "s3://dea-lab07-.../logs/"}
    }
  }'
```

### Step 6 — Watch the run and inspect output

**Console:** Job run status transitions `Pending → Scheduled → Running
→ Success`. First runs take longer (roughly 1–2 minutes of cold-start
overhead to provision workers, comparable to or slightly faster than
Glue's Spark cold start in LAB-02 — note the actual number you observe).

Check output:
```
s3://dea-lab07-.../processed/orders/year=2024/month=01/part-....parquet
s3://dea-lab07-.../processed/orders/year=2024/month=02/part-....parquet
```

Check the driver logs (Console → job run → **Logs** tab, or directly
in `s3://dea-lab07-.../logs/.../driver/stdout.gz`) for the
`Rows processed: N` print statement — confirms the row count.

### Step 7 — Re-run without new data and observe the *lack* of a bookmark

Re-submit the exact same job (Step 5) without adding new source files.
**Expected:** it reprocesses **all** the data again (not zero rows,
unlike LAB-02's Glue bookmark behavior) and overwrites the output
(`mode("overwrite")` in the script). This is a deliberate,
instructive contrast — go re-read LAB-02's Step 6 if the difference
isn't sinking in: same logical task, opposite default incremental
behavior, because Glue bookmarks are a Glue-managed feature with no
EMR/plain-Spark equivalent out of the box.

### Step 8 — Fill in the comparison table

Using your own observed numbers from this lab and LAB-02, fill in:

| Dimension | LAB-02 (Glue ETL job) | LAB-07 (EMR Serverless) |
|---|---|---|
| Setup steps before first run | Crawler + visual job + IAM role | Application + script upload + IAM role |
| Script authored by you? | No (Glue Studio generated it) | Yes (plain PySpark, given to you here) |
| Built-in incremental processing? | Yes — job bookmarks | No — must build your own |
| Cold-start time observed | ~2–4 min | ~1–2 min (varies by account/region) |
| Auto-registers output partitions in Glue Catalog? | Yes, via `enableUpdateCatalog` | No — requires a separate crawler or manual catalog step |
| Cost per run (this lab's data size) | ~$0.05–$0.15 | ~$0.02–$0.10 |
| Underlying engine | Spark (via Glue's managed DynamicFrame layer) | Plain, portable Apache Spark |
| Best fit when... | Team wants minimal Spark expertise, tight Glue Catalog integration, built-in bookmarking | Team has existing Spark code/expertise, needs libraries or Spark features Glue doesn't expose, or is standardizing on portable Spark across EMR on EC2/EKS/Serverless |

---

## 5. Validation checkpoints

| Checkpoint | How to verify | Expected result |
|---|---|---|
| Application created | EMR Serverless console | Status `Started`/`Created`, $0 while no job is running |
| IAM role trust policy correct | IAM console, role's trust relationship | Lists `emr-serverless.amazonaws.com` as trusted principal |
| First job run succeeds | EMR Serverless → Job runs | Status `Success` |
| Output partitioned correctly | S3 console | `year=2024/month=01/`, `month=02/` etc. present |
| Row count matches source | Driver log `stdout` | `Rows processed: N` matches total CSV rows |
| Re-run reprocesses everything (no bookmark) | Step 7, compare output timestamps/content before and after | Output files are overwritten/rewritten on the second run, unlike LAB-02's zero-new-rows bookmark behavior |
| Comparison table completed | Section 4 Step 8 | All rows filled with your own observed data |

---

## 6. Common errors and fixes

1. **Job run fails immediately with `Access Denied` reading the
   script from S3 or writing output.**
   *Cause:* The execution role from Step 4 is missing `s3:GetObject`
   on the scripts prefix or `s3:PutObject` on the processed prefix, or
   the trust policy doesn't correctly list `emr-serverless.amazonaws.com`.
   *Fix:* Verify both the trust policy and the attached permissions
   policy cover the exact bucket/prefixes used.

2. **Job run fails with a Python/Spark error like
   `AnalysisException: Path does not exist`.**
   *Cause:* Typo in the S3 path inside `transform.py` (the script has
   hardcoded example paths — you must edit them to match your actual
   bucket name before uploading). *Fix:* Re-check `input_path` and
   `output_path` in the script exactly match your bucket name, re-upload,
   and re-submit (there's no in-place script editing — EMR Serverless
   reads the script fresh from S3 each run, so re-upload is sufficient,
   no redeploy step needed).

3. **Job run stays in `Pending`/`Scheduled` far longer than expected
   (5+ minutes) before even starting.**
   *Cause:* Usually a **capacity/quota** issue in a fresh account (EMR
   Serverless has default vCPU quotas per account/region), or a region
   temporarily lacking available capacity for on-demand serverless
   workers. *Fix:* Check **Service Quotas → EMR Serverless** for your
   account's vCPU limits; for a lab this small it's very rarely the
   real constraint, but worth checking before assuming something else
   is broken. Also confirm the application's release version is valid
   and not a deprecated/retired one.

4. **Confusion: after Step 7's re-run, the output looks identical in
   row count to Step 6 and it's unclear whether reprocessing actually
   happened.**
   *Cause:* Not really an error — with no new source data, reprocessed
   output *should* have the same row count and same final content,
   which can make the "no bookmark" behavior hard to see just by
   eyeballing row counts. *Fix:* Check S3 **object last-modified
   timestamps** on the Parquet files before and after Step 7's re-run
   — they should be newer after the re-run, proving the files were
   rewritten (not skipped), which is the actual proof point, not row
   count alone.

5. **`start-job-run` CLI command succeeds (returns a job run ID) but
   the console never shows it / shows a different application.**
   *Cause:* `--application-id` in the CLI call doesn't match the
   application created in Step 3 — easy to mix up if you have multiple
   EMR Serverless applications in the account from other testing.
   *Fix:* `aws emr-serverless list-applications` to confirm the
   correct application ID, and re-run with the right one.

---

## 7. Cleanup steps

1. **Delete the EMR Serverless application:**
   ```bash
   aws emr-serverless delete-application --application-id <app-id>
   ```
   (Console: **EMR Serverless → select application → Actions →
   Delete.** Note: you may need to **Stop** the application first if
   it's in `Started` state before delete is allowed — check the console
   prompt.)
2. **Empty and delete the S3 bucket:**
   ```bash
   aws s3 rm s3://dea-lab07-nk-.../ --recursive
   aws s3api delete-bucket --bucket dea-lab07-nk-...
   ```
3. **Delete the IAM role:**
   ```bash
   aws iam delete-role --role-name dea-lab07-emr-role
   ```
   (Detach policies first if needed.)
4. **Verify:** `aws emr-serverless list-applications` returns nothing
   under this lab's naming, and the S3 bucket no longer exists.

---

## 8. What you learned

This lab directly reinforces:

- **1.2** — running an actual Spark transformation on EMR Serverless,
  and seeing the identical logical transform (CSV → partitioned
  Parquet) implemented in portable, open-source PySpark rather than
  Glue's managed DynamicFrame abstraction
- **1.4** — reading and reasoning about a real (if short) PySpark
  script, and Spark executor/driver core-and-memory configuration
- The exam's Glue-vs-EMR decision framework, now backed by direct
  experience rather than memorized bullet points: **Glue** wins on
  "minimal setup, built-in bookmarking, tight Catalog integration,
  little Spark expertise required"; **EMR (Serverless or otherwise)**
  wins on "need standard/portable Spark, existing Spark codebases,
  broader ecosystem (Hive, Presto, HBase), or more granular
  Spark-level tuning than Glue exposes"
- A frequently-tested gotcha reproduced hands-on in Step 7: **Glue job
  bookmarks are a Glue-specific managed feature** — moving the exact
  same transformation logic to EMR does not bring bookmark behavior
  with it "for free"; incremental processing on EMR must be
  engineered deliberately (state tracking, watermarking, or an
  Iceberg/Hudi table target with its own incremental capabilities)

### Practice questions

**Q1.** A team currently runs a Glue ETL job with job bookmarks enabled
for incremental daily processing. They migrate the same transformation
logic to run on EMR Serverless using an equivalent PySpark script, with
no other changes. What should they expect regarding incremental
processing behavior?

- A. EMR Serverless automatically detects and replicates Glue's
  bookmark state, so incremental behavior is preserved unchanged.
- B. Job bookmarks are a Glue-managed feature; moving to EMR does not
  bring that mechanism along — without deliberately engineering
  incremental logic (e.g., tracking processed files, watermarking, or
  using a table format like Iceberg/Hudi with incremental read
  support), the EMR job will reprocess all source data on every run.
- C. EMR Serverless has its own, functionally identical bookmark
  feature, just under a different name, so no behavior change occurs.
- D. Incremental processing is a Spark-engine-level feature present
  regardless of which AWS service runs the job.

> **Answer: B.** This is exactly what Step 7 of the lab demonstrates
> directly — same logic, no bookmark carryover. A, C, and D all
> falsely assume bookmark-equivalent behavior transfers automatically;
> it's a Glue-specific managed capability, not a Spark-engine feature.

**Q2.** Based on this lab's Step 8 comparison table, which scenario
most strongly favors choosing EMR (Serverless or on EC2) over AWS Glue
for a new ETL workload?

- A. A small team wants the fastest path to a CSV→Parquet job with
  minimal Spark knowledge and automatic Glue Catalog partition sync.
- B. The team has an existing, substantial Spark codebase built
  against open-source APIs, needs specific Spark library versions or
  configurations Glue doesn't expose, and wants portability across EMR
  on EC2/EKS/Serverless.
- C. The team needs built-in incremental processing with zero custom
  state-tracking code.
- D. The team wants the absolute minimum number of setup steps before
  a first successful run.

> **Answer: B.** This directly matches Section 8's "Best fit when..."
> row for EMR — code portability, library/version control, and
> ecosystem flexibility are EMR's real advantages. A, C, and D all
> describe Glue's strengths (per the same comparison table), not EMR's
> — Glue is faster to set up, has built-in bookmarks, and needs less
> Spark expertise upfront.

**Q3.** In Step 3, why is "pre-initialized capacity" deliberately left
off (default/disabled) for this lab's EMR Serverless application?

- A. Pre-initialized capacity is not a real EMR Serverless feature.
- B. Pre-initialized capacity keeps a pool of workers warm and ready,
  which reduces job start latency but incurs cost while idle — leaving
  it off preserves EMR Serverless's scale-to-zero, $0-while-idle cost
  profile that this lab's cost section highlights as an advantage.
- C. Pre-initialized capacity is required only for Hive workloads, not
  Spark, so it's irrelevant here.
- D. Enabling it would have prevented the job from writing partitioned
  output.

> **Answer: B.** This is exactly the tradeoff named in Section 3 —
> pre-initialized capacity trades idle cost for reduced cold-start
> latency; this lab intentionally keeps the default scale-to-zero
> behavior to demonstrate EMR Serverless's true idle cost profile. A
> is false — it's a real, documented EMR Serverless feature. C is
> false — it applies to Spark and Hive workloads alike. D is
> fabricated and unrelated to output partitioning, which is governed
> by the script's `partitionBy()` call, not capacity settings.

**Q4.** Why does the lab explicitly point out that `transform.py` uses
`mode("overwrite")` when writing output, and what would change if it
used `mode("append")` instead, combined with re-running the unchanged
job in Step 7?

- A. Nothing would change — `overwrite` and `append` behave identically
  when there is no new source data.
- B. With `overwrite`, each re-run replaces the entire output with a
  fresh (identical, in Step 7's case) write; with `append` and no
  built-in bookmark, re-running against the *same* unchanged source
  data would instead duplicate every row into the output on each run,
  since there is nothing tracking what was "already processed" the way
  Glue's bookmark does.
- C. `append` mode would cause the job to fail outright since
  `partitionBy()` is incompatible with append writes.
- D. `mode()` only affects Parquet compression settings, not row-level
  write behavior.

> **Answer: B.** This reinforces the no-bookmark lesson from a second
> angle — the write mode choice matters precisely because there's no
> automatic incremental tracking; `append` without deduplication logic
> would silently duplicate data on every re-run against unchanged
> source files. A is false — the two modes produce very different
> results under repeated runs against the same source. C is false —
> `partitionBy()` works with both `append` and `overwrite` write modes
> in Spark. D is false — write mode governs row-level overwrite/append
> semantics, unrelated to compression codec settings.

**Q5.** A candidate on the exam sees a question describing a team that
needs to run legacy Hadoop MapReduce jobs and Hive queries alongside
new Spark ETL work, with tight control over cluster-level
configuration and installed libraries. Based on what this lab
demonstrated about Glue's abstraction layer versus EMR's open
ecosystem, which service is the better fit?

- A. AWS Glue, because it supports every open-source big-data engine
  Hadoop clusters use.
- B. Amazon EMR, because it natively supports the broader Hadoop
  ecosystem (Hive, MapReduce, Presto/Trino, HBase, Spark) with
  cluster-level configuration control that Glue's managed, opinionated
  job environment does not expose.
- C. Amazon Athena, because it can run MapReduce jobs directly.
- D. AWS Lambda, because it can orchestrate Hadoop jobs via API calls.

> **Answer: B.** This is the direct generalization of Section 8's
> comparison table's "Best fit" guidance — legacy Hadoop-ecosystem
> tooling (Hive, MapReduce, HBase) and deep cluster/library control are
> EMR's differentiators over Glue's more constrained, managed Spark-only
> environment. A is false — Glue supports Spark and Python shell jobs,
> not the broader Hadoop ecosystem (Hive, MapReduce, HBase) natively. C
> is false — Athena is a SQL query engine, not a MapReduce runtime. D
> is false — Lambda has no native Hadoop/MapReduce execution capability
> and is unsuited to long-running cluster-based jobs regardless.
