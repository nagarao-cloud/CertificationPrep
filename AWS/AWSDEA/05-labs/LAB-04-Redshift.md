# LAB-04 — Redshift Serverless: COPY from S3 and Spectrum External Table

> **Day 5 anchor lab.** First hands-on contact with Redshift. Uses
> Redshift Serverless (no cluster sizing decisions to make yet — that's
> a reading topic) so the lab stays focused on COPY and Spectrum.

---

## 1. Objective

This lab builds hands-on muscle memory for:

- **Domain 2, Task 2.1** — choosing and configuring a data warehouse
  for specific access patterns, and implementing federated/remote
  access (Redshift Spectrum querying S3 directly)
- **Domain 2, Task 2.3** — load operations between S3 and Redshift
  (`COPY`), and the tradeoffs vs Spectrum (load-then-query vs
  query-in-place)
- **Domain 1, Task 1.2** — Redshift `COPY`/`UNLOAD` as an ETL/ELT
  pattern
- The exam's core Redshift distinction: **data loaded into Redshift
  storage (fast, columnar, compressed, costs Redshift storage)** vs
  **Spectrum querying S3 directly (no load step, pay per-TB-scanned
  like Athena, good for data queried rarely or already partitioned
  well)**

By the end you'll have loaded the same dataset two different ways into
a queryable state — one via `COPY` into native Redshift storage, one
via **Spectrum** reading straight from S3 — and be able to explain
from direct experience when each is the right call.

---

## 2. Prerequisites

- **LAB-01 completed** (or equivalent): a partitioned Parquet dataset
  in S3 with a Glue Catalog table. This lab reuses that pattern; if
  you already deleted LAB-01's resources, recreate a small
  `orders` dataset in S3/Glue by repeating LAB-01 Steps 1–7 (or reuse
  LAB-03's `orders_partitioned` table/data).
- IAM permissions: ability to create a Redshift Serverless namespace/
  workgroup, an IAM role Redshift can assume for S3 + Glue Catalog
  access, and a VPC with at least one subnet (the default VPC in most
  accounts works fine).
- Redshift Serverless has a **base cost while active** — read Section
  3 before starting; this is the most expensive lab in the series if
  left running.

---

## 3. Estimated cost

| Resource | Cost driver | Estimate |
|---|---|---|
| Redshift Serverless | Billed in **RPU-seconds** while the workgroup is actively processing queries; **base capacity 8 RPU minimum** in most regions | Roughly **$2.90/hour** while actively queried at 8 RPU base ($0.363–$0.375/RPU-hour depending on region × 8 RPUs); a lab session of ~1 hour of actual query activity ≈ **$2–$4** |
| Redshift Serverless — idle | Serverless **auto-pauses compute** when there's no query activity for a period, and you are not billed compute for fully idle time; **storage still bills continuously** | Storage: RMS pricing, negligible for a few MB |
| S3 / Glue Catalog | Same as prior labs | Effectively $0 |
| **Total** | | **Under $5** if you finish in one sitting and delete the namespace/workgroup afterward |

**How to avoid surprise charges — read this before Step 1:**
- Redshift Serverless does **not** have a "stop" button the way a
  provisioned cluster has "pause." The unit that costs money is the
  **workgroup + namespace existing and being queried**. It auto-pauses
  compute billing between queries, but the **namespace and workgroup
  themselves are not free resources sitting idle indefinitely** in the
  way an empty S3 bucket is — the safest move for a study lab is to
  **delete the workgroup and namespace in Cleanup the same day**, not
  "leave it and come back tomorrow."
- Set a **usage limit** in Step 2 — Redshift Serverless supports RPU-hour
  usage limits with an alert or hard cutoff action. Do this before
  running any query, not after.
- If cost is a concern, this lab can be done in a single sitting in
  under an hour of actual hands-on time — plan it that way rather than
  spreading it across a day with the namespace sitting provisioned.

---

## 4. Step-by-step instructions

### Step 1 — Create a Redshift Serverless namespace and workgroup

**Console:**
1. **Amazon Redshift** → **Redshift Serverless** → **Create workgroup**.
2. Namespace name: `dea-lab04-ns`. Workgroup name: `dea-lab04-wg`.
3. **Base capacity**: leave at the minimum offered (typically **8 RPUs**
   — the smallest available) — do not increase this for a study lab.
4. **Permissions**: under namespace settings, **Associate IAM roles** →
   create/attach a role with `AmazonS3ReadOnlyAccess` and
   `AWSGlueConsoleFullAccess`-equivalent read permissions (Redshift
   needs to read S3 for COPY and read the Glue Catalog for Spectrum).
   Mark it as the **default** IAM role.
5. **Network and security**: use the default VPC and default security
   group for simplicity; ensure **Publicly accessible** is set
   according to how you'll connect (Query Editor v2 in-console doesn't
   require public accessibility; a local SQL client would).
6. Create. Provisioning takes a few minutes.

**CLI equivalent:**
```bash
aws redshift-serverless create-namespace \
  --namespace-name dea-lab04-ns \
  --iam-roles arn:aws:iam::<account-id>:role/dea-lab04-redshift-role

aws redshift-serverless create-workgroup \
  --workgroup-name dea-lab04-wg \
  --namespace-name dea-lab04-ns \
  --base-capacity 8
```

### Step 2 — Set a usage limit (do this before querying)

**Console:** **Redshift Serverless** → **Billing** → **Usage limits**
→ **Add usage limit**. Set a monthly RPU-hour limit with action
**Alert** (or **Turn off user queries** if you want a hard stop) — a
low threshold like 20 RPU-hours is more than enough headroom for this
lab while acting as a safety net against a forgotten background query.

### Step 3 — Connect via Query Editor v2

**Console:** **Redshift** → **Query Editor v2** (in the left nav) →
connect to the `dea-lab04-wg` workgroup, database `dev`, using
**Federated user** / your IAM credentials (no separate DB password
needed for the default setup) or a database user you create.

### Step 4 — Create a schema and table, then COPY from S3

```sql
CREATE SCHEMA IF NOT EXISTS lab04;

CREATE TABLE lab04.orders (
    order_id     INTEGER,
    customer_id  VARCHAR(10),
    order_date   DATE,
    amount       DECIMAL(10,2),
    status       VARCHAR(20)
);

COPY lab04.orders
FROM 's3://dea-lab01-.../raw/orders/'
IAM_ROLE default
FORMAT AS CSV
IGNOREHEADER 0
REGION 'us-east-1';
```

(Adjust `FORMAT AS CSV`/`PARQUET` and the S3 path to match whichever
prior lab's data you're reusing — if reusing LAB-03's Iceberg/Parquet
output, use `FORMAT AS PARQUET` instead and drop `IGNOREHEADER`.)

**CLI equivalent:** COPY is a SQL command, not a CLI operation — run
it via `redshift-data` API if scripting:
```bash
aws redshift-data execute-statement \
  --workgroup-name dea-lab04-wg --database dev \
  --sql "COPY lab04.orders FROM 's3://dea-lab01-.../raw/orders/' IAM_ROLE default FORMAT AS CSV REGION 'us-east-1';"
```

**Validation:**
```sql
SELECT COUNT(*) FROM lab04.orders;
SELECT * FROM lab04.orders LIMIT 10;
```
Row count should match your source file's row count.

### Step 5 — Check the load for errors (a real production habit)

```sql
SELECT * FROM sys_load_error_detail
ORDER BY start_time DESC
LIMIT 20;
```
An empty result is good news. If rows appear here, see Common Error #2.

### Step 6 — Set up Redshift Spectrum against the same Glue Catalog table

Spectrum lets Redshift query S3 data **without loading it** — it reads
directly against a Glue Data Catalog table, exactly like Athena does.

```sql
CREATE EXTERNAL SCHEMA lab04_spectrum
FROM DATA CATALOG
DATABASE 'dea_lab_db'
IAM_ROLE default
REGION 'us-east-1';
```
(`dea_lab_db` is the Glue database from LAB-01 — if you renamed it,
use your actual database name.)

**Validation:**
```sql
SELECT * FROM lab04_spectrum.orders LIMIT 10;
```
This queries S3 **directly**, with zero data loaded into Redshift
storage — compare this to `lab04.orders`, which holds a full copy.

### Step 7 — Compare a query across both: native table vs Spectrum

```sql
SELECT status, COUNT(*), SUM(amount)
FROM lab04.orders
GROUP BY status;

SELECT status, COUNT(*), SUM(amount)
FROM lab04_spectrum.orders
GROUP BY status;
```
Both should return identical results (same underlying data). In
**Query Editor v2 → query details**, note that the Spectrum query
shows an external scan step — this is the visible proof it's reading
S3 directly rather than local Redshift storage.

---

## 5. Validation checkpoints

| Checkpoint | How to verify | Expected result |
|---|---|---|
| Namespace/workgroup active | Redshift Serverless console, status | `Available` |
| Usage limit set | Billing → Usage limits | At least one limit configured before any query ran |
| Table created | `\dt lab04.*` or Query Editor v2 schema browser | `orders` table visible under `lab04` |
| COPY succeeded | `SELECT COUNT(*) FROM lab04.orders;` | Matches source row count |
| No load errors | `SELECT * FROM sys_load_error_detail ...` | Empty result set |
| Spectrum external schema works | `SELECT * FROM lab04_spectrum.orders LIMIT 10;` | Returns rows, no error |
| Native vs Spectrum results match | Both `GROUP BY status` queries | Identical output |
| Query plan shows external scan for Spectrum | Query Editor v2 → explain/details for the Spectrum query | An `XN S3 Query Scan` / external-table step appears |

---

## 6. Common errors and fixes

1. **`COPY` fails with `IAM Role ... is not associated with cluster/
   workgroup` or `S3ServiceException: Access Denied`.**
   *Cause:* The IAM role used in `IAM_ROLE default` isn't actually
   attached to the namespace as the default role, or lacks S3
   read permission on the exact bucket/prefix. *Fix:* Redshift
   Serverless console → namespace → **Security and encryption** →
   confirm a role is set as default, and that its attached policy
   includes `s3:GetObject`/`s3:ListBucket` on your lab bucket.

2. **`COPY` "succeeds" (no error thrown) but `SELECT COUNT(*)` returns
   0 or fewer rows than expected.**
   *Cause:* Almost always a format mismatch — e.g., `FORMAT AS CSV`
   against Parquet files, or a header row being loaded as a malformed
   data row without `IGNOREHEADER 1`, causing that row (and possibly
   the whole batch depending on `MAXERROR`) to be rejected silently.
   *Fix:* Check `sys_load_error_detail` (Step 5) — it will show the
   exact rejected rows and the parse error. Correct the `FORMAT`/
   `IGNOREHEADER` clause and re-run `COPY` (truncate the table first
   with `TRUNCATE lab04.orders;` to avoid double-counting on retry).

3. **`CREATE EXTERNAL SCHEMA ... FROM DATA CATALOG` fails with
   `permission denied` or the schema is created but querying it
   returns `ExternalTableNotFoundException`.**
   *Cause:* The IAM role lacks `glue:GetDatabase`/`glue:GetTable`/
   `glue:GetPartitions` permissions, or the Glue database name/region
   doesn't match exactly (case-sensitive). *Fix:* Confirm the role has
   Glue read permissions, and double check the `DATABASE` name against
   what's actually in **Glue → Data Catalog → Databases**.

4. **Query against `lab04_spectrum.orders` is dramatically slower than
   `lab04.orders` even on this tiny dataset.**
   *Cause:* Spectrum has a fixed per-query overhead (spinning up the
   external scan against S3/Glue) that a native, already-loaded table
   doesn't pay — this overhead is roughly constant regardless of data
   size, so it's proportionally more noticeable on small data. *Fix:*
   Nothing to "fix" — this is expected and is exactly the tradeoff to
   internalize: Spectrum trades per-query latency and per-TB-scanned
   cost for zero load time and zero Redshift storage cost. It shines
   at large infrequently-queried datasets, not small frequently-hit ones.

5. **Redshift Serverless costs more than expected after leaving it
   running overnight "just in case."**
   *Cause:* Even with auto-pause on compute, a scheduled query, a
   dashboard tool polling it, or simply forgetting an open Query
   Editor v2 session can keep triggering billable RPU-seconds. *Fix:*
   This is why Step 2's usage limit and same-day Cleanup exist — don't
   rely on auto-pause alone as your only cost control for a study
   account.

---

## 7. Cleanup steps

**Do this the same day you run the lab.**

1. **Drop the external schema and native table** (optional — deleting
   the namespace removes everything regardless, but tidy habit):
   ```sql
   DROP SCHEMA lab04_spectrum;
   DROP TABLE lab04.orders;
   DROP SCHEMA lab04;
   ```
2. **Delete the workgroup**, then the **namespace** (order matters —
   workgroup must go first):
   ```bash
   aws redshift-serverless delete-workgroup --workgroup-name dea-lab04-wg
   aws redshift-serverless delete-namespace --namespace-name dea-lab04-ns
   ```
   Console equivalent: **Redshift Serverless → Workgroup → Delete**,
   then **Namespace → Delete**.
3. **Remove the usage limit** (deleted automatically with the
   workgroup, but verify under Billing → Usage limits it's gone).
4. **IAM role**: delete `dea-lab04-redshift-role` if not reused.
5. **Verify**: Redshift Serverless console shows no namespaces/
   workgroups remaining; check **Billing → Cost Explorer** the next
   day to confirm no unexpected ongoing charge.

---

## 8. What you learned

This lab directly reinforces:

- **2.1** — hands-on Redshift Spectrum as the "federated/remote access"
  pattern the exam calls out explicitly, and native `COPY`-loaded
  storage as the alternative
- **2.3** — the mechanics of `COPY` from S3, including how load errors
  surface (`sys_load_error_detail`) rather than always hard-failing
- The exam's most common Redshift storage-strategy question shape:
  *"data is queried rarely / is very large / needs to stay in S3 for
  other consumers too — should it be loaded into Redshift or queried
  via Spectrum?"* → generally **Spectrum** for rarely-queried or
  already-partitioned large data; **COPY into native storage** for
  frequently-queried, performance-critical, join-heavy workloads where
  Redshift's columnar compression and local I/O matter

### Practice questions

**Q1.** A company has 10 years of clickstream data in S3, partitioned
by day, queried only once a month for a compliance report. Loading it
all into a Redshift provisioned cluster would require significant
storage costs and node scaling. What is the most cost-effective
architecture?

- A. Load all 10 years into Redshift native storage with `COPY` so
  queries run fastest.
- B. Use Redshift Spectrum (or Athena) to query the S3 data directly,
  paying only for the data scanned during the monthly report, with no
  ongoing Redshift storage cost for this dataset.
- C. Use DMS to continuously replicate the S3 data into Redshift.
- D. Increase the Redshift cluster's node count permanently to handle
  the historical data volume.

> **Answer: B.** This is the textbook rarely-queried, large-volume
> scenario this lab's Step 6/7 built hands-on intuition for — pay per
> query, not per month of idle storage. A is expensive and wasteful for
> monthly-only access. C is nonsensical — DMS replicates from
> transactional databases, not S3-to-Redshift, and continuous
> replication for monthly-use data adds needless cost and complexity.
> D solves a problem that doesn't exist here (no ongoing high-volume
> query load) at maximum cost.

**Q2.** During a `COPY` command, several rows are silently rejected
due to a data type mismatch, but the `COPY` statement itself completes
"successfully" with a lower row count than the source file. Where
should an engineer look to find out exactly which rows failed and why?

- A. CloudTrail management events.
- B. `sys_load_error_detail` (or the legacy `STL_LOAD_ERRORS` view),
  which records the specific rejected rows and parse errors.
- C. The Redshift Serverless console's billing dashboard.
- D. S3 Server Access Logs on the source bucket.

> **Answer: B.** This is exactly Step 5/Common Error #2 of the lab —
> `COPY` doesn't always hard-fail on row-level issues; it records them
> for inspection while continuing to load valid rows (up to
> `MAXERROR`'s threshold). A is wrong — CloudTrail logs API calls, not
> row-level data content issues. C is unrelated — billing has nothing
> to do with row parse errors. D is wrong — S3 access logs record who
> accessed objects, not data content validity.

**Q3.** What is the practical difference in what happens "under the
hood" when querying `lab04.orders` (native table) versus
`lab04_spectrum.orders` (Spectrum external table) in this lab, given
they contain identical data?

- A. There is no difference — Redshift treats both identically once
  the external schema is created.
- B. `lab04.orders` reads compressed, columnar data already stored
  locally within the Redshift cluster/workgroup's managed storage;
  `lab04_spectrum.orders` triggers an external scan that reads
  directly from S3 at query time via the Spectrum layer, referencing
  the Glue Data Catalog for schema/location.
- C. `lab04_spectrum.orders` is automatically cached into native
  storage after the first query, making subsequent queries identical
  to the native table.
- D. Spectrum queries run on a completely separate compute fleet
  billed at the same RPU rate as native queries, with no cost difference.

> **Answer: B.** This is the core distinction Step 7's query-plan
> check (external scan step) makes visible. A is false — that's the
> whole point of the lab, they are architecturally different paths. C
> is false — Spectrum doesn't auto-cache into native storage; every
> query re-scans S3 (this is by design, keeping it stateless and
> reflecting the latest S3 data). D is false — Spectrum scanning is
> billed differently (historically per-TB-scanned similar to Athena,
> distinct from the RPU compute billing model), which is part of why
> it's cost-effective for infrequent access.

**Q4.** Why does this lab configure a usage limit (Step 2) before
running any queries, rather than after?

- A. Redshift Serverless requires a usage limit to exist before the
  namespace can be created at all.
- B. It's a safety habit — once queries start running, RPU-seconds are
  already being billed; setting the limit first means there's never a
  window where an unbounded query could run without a guardrail, which
  matters most in a personal study account with no other cost oversight.
- C. Usage limits only take effect 24 hours after creation, so setting
  them early is required for them to be active during the lab.
- D. Usage limits are free only during namespace creation and incur an
  extra charge if added afterward.

> **Answer: B.** This is a practical safety-first habit, not a
> technical requirement — but it's the right default especially for a
> self-funded study account. A is false — namespaces can be created
> without any usage limit. C is false — usage limits take effect
> immediately upon creation/update. D is false — usage limits
> themselves have no cost to configure at any time.

**Q5.** A teammate proposes skipping `COPY` entirely and only ever
using Spectrum external tables for all Redshift workloads, "since it's
cheaper and avoids managing storage." What is the strongest reason
this isn't universally correct?

- A. Spectrum cannot query Parquet files, only CSV.
- B. Spectrum external tables cannot be joined with native Redshift
  tables in the same query.
- C. For frequently-run, performance-sensitive, join-heavy analytical
  queries, natively loaded columnar data with Redshift's local
  compression, sort keys, and distribution styles will generally
  outperform repeatedly re-scanning S3 per query — Spectrum's
  per-query external-scan overhead and lack of Redshift-native
  physical tuning (DISTKEY/SORTKEY) make it a poor fit for hot,
  latency-sensitive workloads.
- D. Spectrum requires a provisioned cluster and is not available on
  Redshift Serverless.

> **Answer: C.** This is the direct lesson of Common Error #4 in this
> lab — Spectrum's overhead is real and matters most for frequent,
> latency-sensitive access, which is exactly the workload profile
> where `COPY`-loaded native tables with proper DISTKEY/SORTKEY win.
> A is false — Spectrum fully supports Parquet, ORC, JSON, and more,
> not just CSV. B is false — Redshift explicitly supports joining
> external (Spectrum) tables with native tables in a single query,
> which is one of Spectrum's key selling points. D is false — this
> lab itself used Spectrum on Redshift Serverless successfully.
