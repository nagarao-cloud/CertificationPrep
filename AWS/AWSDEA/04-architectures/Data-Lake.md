# Data Lake Architecture

> The foundational storage pattern behind almost every other file in
> this folder. `Lakehouse.md` adds Iceberg on top of this. `CDC.md` and
> `Batch-Pipeline.md` and `Streaming-Pipeline.md` all *land* their data
> here. If you don't understand this file, none of the others will make
> sense — read it first.

## What makes something a "data lake" instead of "an S3 bucket with files in it"

Any intern can run `aws s3 cp` all day and produce a bucket full of
files. That is not a data lake. A **data lake** is an S3 bucket **plus
three things layered on top of it**:

1. **A metadata/catalog layer** — something that knows *what tables
   exist*, *what columns and types they have*, and *where their files
   physically live* (AWS Glue Data Catalog). Without this, every
   consumer has to re-discover schema by sampling files, which is slow,
   error-prone, and doesn't scale past one team.
2. **A governance/access-control layer** — something that grants
   permissions at the *table and column* level rather than the *S3
   object* level (AWS Lake Formation). Without this, you are stuck
   writing and maintaining raw IAM bucket policies and prefix-based
   conditions, which do not express "this analyst can see `orders` but
   not the `customer_ssn` column."
3. **An organizational convention** — zones, naming, and partitioning
   that turn "a pile of files" into "a place downstream consumers can
   reliably build on" (bronze/silver/gold, or raw/validated/curated).

Take any one of the three away and what you have left is **just an S3
bucket with files in it** — technically storage, not a lake. This
distinction is tested directly: a question describing files dumped
into S3 with no catalog, no crawler, no Lake Formation permissions, and
asking "is this a data lake?" wants the answer **no** — it's
unmanaged object storage until it's cataloged and governed.

---

## The reference architecture

```
                              DATA LAKE — REFERENCE ARCHITECTURE
                              ===================================

  SOURCES
  (batch files, JDBC extracts, CDC streams, app events)
        |
        v
  +---------------------------------------------------------------+
  |  RAW / BRONZE ZONE  —  s3://lake-raw/<source>/<yyyy>/<mm>/<dd>/ |
  |  Immutable. Original format (CSV/JSON/Avro). Never overwritten. |
  +---------------------------------------------------------------+
        |
        |  (1) Glue Crawler  --or--  (2) explicit DDL / IaC
        v
  +---------------------------------------------------------------+
  |                  AWS GLUE DATA CATALOG                         |
  |   Databases -> Tables -> Columns/types -> Partition index       |
  +---------------------------------------------------------------+
        ^                                    |
        |  registers schema + partitions      | table/column metadata
        |                                     v
  +----------------+                 +--------------------------+
  |  Glue Crawler   |                |     AWS LAKE FORMATION    |
  |  (schedule or    |                |  Grants on catalog        |
  |   event-driven)  |                |  resources (table/column/  |
  +----------------+                 |  row filter), LF-Tags      |
                                       +--------------------------+
                                                    |
        Glue ETL / EMR — clean, dedupe, conform types, reject bad rows
                                                    |
                                                    v
  +---------------------------------------------------------------+
  |  VALIDATED / SILVER ZONE  —  s3://lake-silver/<table>/          |
  |  Parquet, columnar, schema-conformed, partitioned by date/key    |
  +---------------------------------------------------------------+
                                                    |
                       Glue ETL — join, aggregate, business logic
                                                    |
                                                    v
  +---------------------------------------------------------------+
  |  CURATED / GOLD ZONE  —  s3://lake-gold/<mart>/                  |
  |  Business-ready, denormalized, analyst/BI-facing                 |
  +---------------------------------------------------------------+
                                                    |
                          +-------------------------+------------------------+
                          v                          v                       v
                    +-----------+            +--------------+       +---------------+
                    |  Athena   |            |   Redshift   |       |   EMR / Spark |
                    | (ad-hoc)  |            |  Spectrum    |       | (heavy batch) |
                    +-----------+            +--------------+       +---------------+
                          |                          |
                          +------------+-------------+
                                       v
                                +--------------+
                                |  QuickSight  |
                                +--------------+
```

**Reading every arrow:**

- **Sources → Raw/Bronze zone.** Whatever the source — a nightly file
  drop, a JDBC extract, or a CDC stream from `CDC.md` — the first
  landing spot is always raw, unmodified, and immutable. This zone
  exists so you can **always replay from the beginning** if a
  downstream transform has a bug; you never re-pull from the source
  system just to fix a transformation mistake.
- **Raw zone → Glue Crawler (path 1) or explicit DDL (path 2).** Two
  ways to register a table in the catalog. A crawler *infers* schema by
  sampling files and classifying them (CSV, JSON, Parquet, etc.);
  explicit DDL (via `CREATE TABLE` in Athena, or Glue API calls in
  Terraform/CDK) *declares* schema up front. See the comparison below —
  this choice is a frequent exam question in its own right.
- **Crawler/DDL → Glue Data Catalog.** The catalog is the single source
  of truth for "what tables exist and what do they look like." It is
  the **Hive Metastore-compatible** metadata store that Athena,
  Redshift Spectrum, EMR, and Glue ETL all read from — this is what
  makes "point five engines at one copy of data" possible.
- **Catalog ↔ Lake Formation.** Lake Formation sits *on top of* the
  catalog, not on top of raw S3. Every permission grant ("analyst X can
  `SELECT` on `orders` but not the `ssn` column") is expressed against
  catalog resources (databases, tables, columns), and Lake Formation
  translates that into temporary, scoped credentials handed to the
  query engine at query time. This is the mechanism that makes
  fine-grained governance possible without writing per-analyst S3
  bucket policies.
- **Raw → Glue ETL/EMR → Validated/Silver zone.** Cleansing happens
  here: reject or quarantine malformed rows, deduplicate, cast types,
  convert to columnar **Parquet** (smaller, faster to scan, splittable).
  Silver is the first zone a downstream consumer can trust to be
  "reasonably correct," but it is not yet business-shaped.
- **Silver → Glue ETL → Curated/Gold zone.** Joins across silver tables,
  aggregation, business-metric calculation. Gold is what a BI analyst
  or a dashboard actually queries — denormalized, pre-joined,
  purpose-built per consumption use case (a "sales mart," a
  "customer-360 mart").
- **Gold → Athena / Redshift Spectrum / EMR.** Three engines, one copy
  of data, each chosen for the *access pattern* querying it (see
  `SERVICE-SELECTION-MATRIX.md`'s five-question funnel): occasional
  ad-hoc analyst SQL → Athena; concurrent BI dashboard load →
  Redshift Spectrum; heavy custom Spark processing → EMR.
- **Athena / Redshift → QuickSight.** The final hop to a human — a
  dashboard, not a query console.

---

## Service-by-service rationale, with runner-up alternatives

### Storage: Amazon S3 — why not EFS/EBS/on-prem NAS

| Requirement | S3 | EFS | EBS |
|---|---|---|---|
| Cost at PB scale | Lowest ($/GB, tiering) | Higher | Highest |
| Durability | 11 nines, cross-AZ by default | 11 nines, single-region | Single-AZ unless snapshotted |
| Concurrent multi-engine read (Athena+Redshift+EMR+SageMaker) | ✅ native | Possible but unusual | ❌ block storage, one attach |
| Lifecycle tiering (Standard→IA→Glacier) | ✅ built-in | ❌ | ❌ |
| Object versioning / immutability | ✅ | Partial | Snapshots only |

S3 wins on every axis that matters for a lake: it is the only one of
the three that is simultaneously cheap at scale, durable, and readable
concurrently by every AWS analytics engine without file-locking
concerns. EBS and EFS are **compute-attached** storage models — they
answer "what does one EC2 instance need," not "what does an entire
analytics platform need to share."

### Cataloging: Glue Crawler vs. explicit schema registration

| | **Glue Crawler** | **Explicit DDL / IaC** |
|---|---|---|
| Best for | Unknown/evolving schema, many small sources, ad-hoc data science zones | Known, stable, contractual schema (e.g., a CDC pipeline with a fixed source table) |
| Cost | DPU-hours per run, plus S3 LIST cost on every run | One-time; no recurring compute |
| Risk | Misclassification on messy data (mixed formats in one prefix); can silently create wrong partition columns | Requires someone to keep DDL in sync by hand when the source changes |
| Partition sync | Automatic — crawler updates the partition index | Manual `MSCK REPAIR TABLE` / `ALTER TABLE ADD PARTITION`, or Glue job automation |
| Exam signal | "Discover schema automatically," "self-describing," "unknown/varying structure" | "Known schema," "strict contract," "avoid crawler cost," "control exactly what gets registered" |

**Exam trap:** running a crawler on every single file drop (e.g.,
hourly, on a bucket with a stable schema) is a common wrong-answer
pattern — it burns DPU-hours and S3 LIST calls for no benefit when the
schema never changes. The efficient answer is either a crawler on a
schedule wide enough to catch real drift, or explicit DDL with a
`Glue Start Job` step that adds new partitions directly.

### Governance: Lake Formation vs. raw IAM/S3 bucket policies

| | **Lake Formation** | **IAM + S3 bucket policy only** |
|---|---|---|
| Granularity | Database / table / **column** / **row** (row filters) | Prefix/object level only |
| Central grant management | ✅ one place (`GRANT`/`REVOKE` on catalog resources) | ❌ scattered across bucket policies and IAM policies per team |
| Cross-account sharing | ✅ built-in (Lake Formation permissions + AWS RAM/data sharing) | Manual bucket policy + assumed roles, error-prone |
| Tag-based access (LF-Tags / TBAC) | ✅ tag a table `classification=PHI`, grant by tag, new tables inherit automatically | ❌ no equivalent; every new prefix needs a manual policy |
| Underlying enforcement | Vends temporary, scoped credentials to the query engine at query time | Static IAM policy evaluated per S3 API call |

**Exam trap:** "restrict access to specific columns" or "restrict rows
by region for different business units" is almost always a Lake
Formation **row/column-level permission** or **LF-Tag (TBAC)** answer
— raw S3 bucket policies cannot express "same file, different columns
visible to different users," because S3 permissions operate on whole
objects.

### Format: Parquet (silver/gold) vs. keeping raw formats everywhere

Columnar Parquet in silver/gold cuts Athena/Redshift Spectrum bytes
scanned dramatically versus row-oriented CSV/JSON, because a query that
needs three columns out of forty only reads those three columns'
data. Raw/bronze intentionally keeps the **original format** (even if
that's ugly CSV) because fidelity to the source — for replay and audit
— matters more than query efficiency at that zone.

---

## Partitioning strategy

Partition by the column(s) most queries filter on — almost always a
date, because "last 7 days," "this month," "Q3" are the overwhelmingly
common analyst filters:

```
s3://lake-silver/orders/year=2026/month=08/day=09/part-0000.parquet
```

- **Too coarse** (partition by year only): every query for "yesterday"
  scans an entire year of data — wasted cost and time.
- **Too fine** (partition by minute, or by a high-cardinality column
  like `customer_id`): millions of tiny partitions and tiny files —
  crawler/`MSCK REPAIR` slows down, S3 LIST calls balloon, and Athena's
  per-query overhead per partition adds up. This is the **small-files
  problem**, and it's one of the most commonly tested lake failure
  modes.
- **A second dimension** (e.g., `year/month/day/region`) is fine as
  long as it maps to real filter patterns — never partition on a column
  "just in case."

Compaction jobs (scheduled Glue jobs, or automatic if you've adopted
Iceberg/S3 Tables — see `Lakehouse.md`) merge small files produced by
frequent small writes back into fewer, larger files.

---

## Scaling considerations

- **S3 request rate**: S3 auto-scales per-prefix request rate, but
  extremely hot single prefixes (e.g., everything under one
  `year=2026/` partition during a backfill) can still throttle;
  randomized or hashed prefixes historically mitigated this — less
  relevant since S3 raised per-prefix limits, but still shows up in
  older exam-style distractors.
- **Crawler run time and cost** grow with the number of files and
  partitions scanned; scheduling crawlers too frequently against a
  slow-changing schema is a pure cost/latency loss.
- **Catalog scale**: the Glue Data Catalog itself scales to millions of
  tables/partitions, but query planners (Athena) get slower as
  partition counts climb into the tens of thousands per table — another
  argument for the moderate-partition-granularity rule above.
- **Concurrent engines**: because S3 has no file-locking, many readers
  hitting silver/gold simultaneously is fine; many **writers** hitting
  the same prefix simultaneously is not (this is exactly the problem
  Iceberg's optimistic concurrency solves — see `Lakehouse.md`).

## Failure scenarios and tolerance

| Failure | Effect | Mitigation |
|---|---|---|
| Crawler misclassifies mixed-format files in one prefix | Wrong column types registered; downstream queries fail or silently truncate | Keep one format per prefix; use custom classifiers for ambiguous data |
| Partition never registered (no crawler run, no `MSCK REPAIR`) | New data physically in S3 but invisible to Athena/Redshift Spectrum | Automate partition registration as the last step of every ingest job, not a separate manual task |
| Two Glue jobs write to the same partition concurrently (Hive-style, no Iceberg) | Risk of partial/corrupted output, since plain Hive tables have no concurrency control | Serialize writes per partition via Step Functions, or adopt Iceberg (`Lakehouse.md`) |
| Schema drift at source (new column, type change) | Crawler creates a new schema version or `string` column collision; downstream Glue/Athena queries fail | Schema evolution policy in crawler config, or move to Iceberg's non-destructive schema evolution |
| Over-broad IAM/S3 policy instead of Lake Formation grants | PII exposed to users who shouldn't see it | Enforce Lake Formation as the *only* access path (deregister direct S3 access) |
| Small-files accumulation from frequent low-volume writes | Query latency and cost creep up over months | Scheduled compaction jobs, or larger micro-batch windows before writing |

## Cost drivers

- **S3 storage** — biggest line item at scale; mitigate with lifecycle
  policies (Standard → Standard-IA → Glacier) on raw/bronze data that's
  rarely re-read after its retention window.
- **S3 request costs** (GET/PUT/LIST) — driven by file count; small
  files inflate this independent of total bytes stored.
- **Glue Crawler DPU-hours** — scheduled frequency × data volume
  scanned per run.
- **Glue ETL DPU-hours** for bronze→silver→gold transforms.
- **Athena bytes scanned** at query time — this is why Parquet + good
  partitioning in silver/gold directly reduces the query-time bill, not
  just query-time latency.
- **Lake Formation** itself has no separate charge; cost is in the
  underlying Glue/S3/query-engine usage it governs.

## Exam traps

⚠️ **"Files sit in S3" ≠ "it's a data lake."** Look for catalog and
governance in the scenario before accepting "data lake" as already
built — if a question describes raw files with no crawler, no catalog,
no Lake Formation, the correct diagnosis is "not yet a lake."

⚠️ **Crawler run on every file drop for a stable, known schema** is a
cost/efficiency wrong answer — prefer explicit partition registration
or a wider crawler schedule.

⚠️ **Column-level or row-level access restriction described in a
question** almost always points to **Lake Formation** permissions/
LF-Tags, never a raw S3 bucket policy — S3 bucket policies cannot see
inside a Parquet file's columns.

⚠️ **Millions of partitions / slow `MSCK REPAIR`** is the small-files/
over-partitioning trap — the fix is coarser partitioning and
compaction, not a bigger crawler.

⚠️ **Concurrent writers to the same Hive-style S3 prefix** is a
correctness trap in plain data-lake questions — if the scenario needs
safe concurrent upserts, the real answer is Iceberg (`Lakehouse.md`),
not "just write to S3 more carefully."

⚠️ Distractors love **Lake Formation *governed tables*** as if it were
still the modern answer for ACID/upsert on the lake — by 2026 that
feature has been superseded by Iceberg; don't pick it when the
scenario needs row-level updates/deletes/time travel.

## Real enterprise example

A regional healthcare network centralizes claims data from a dozen
clinics into a single S3-based lake. Nightly SFTP drops of claims files
land in `s3://claims-raw/<clinic-id>/<date>/`. A Glue Crawler — run
once per night, after the last clinic's drop completes, not on every
file arrival — registers new partitions in the Glue Data Catalog. A
Glue ETL job cleans and conforms records into a `claims_silver` Parquet
table partitioned by `service_date`. Lake Formation grants let the
analytics team query aggregated, de-identified claims in gold, while a
compliance team's row-filter grant restricts one internal auditor role
to only their assigned clinic's rows — the same gold table, different
visible rows, enforced entirely through Lake Formation without
duplicating the data per clinic.

---

## Practice questions

**1. A company stores JSON clickstream files in S3 with no catalog, no
crawler, and grants access via bucket policies scoped to IAM
principals. Leadership calls this "our data lake." A consulting audit
disagrees. Why?**

A) The files should be Parquet, not JSON
B) There is no catalog or fine-grained governance layer — it is
managed object storage, not a lake — **correct**
C) S3 cannot hold clickstream data at scale
D) IAM bucket policies are more secure than Lake Formation

*B is correct: a lake requires a catalog (so consumers can discover
schema) and governance beyond bucket-level IAM (for table/column-level
control) — neither is present here. A is a legitimate future
improvement but doesn't define "lake vs. not-lake." C is false — S3
scales fine for this. D is backwards — bucket policies are coarser,
not more secure, than Lake Formation's fine-grained model.*

**2. A team has a well-known, contractually fixed schema arriving daily
from a single CDC pipeline. They currently run a Glue Crawler every 15
minutes against the target prefix. Cost review flags this as wasteful.
What should change?**

A) Switch the crawler to run once daily
B) Remove the crawler; register new partitions explicitly as the last
step of the ingest job, since the schema is fixed and known —
**correct**
C) Replace Glue Crawler with EMR
D) Move the data out of S3 into Redshift native tables

*B is correct: with a fixed, known schema, explicit partition
registration (or a Glue job step) avoids recurring crawler DPU-hours
and S3 LIST costs entirely. A reduces but doesn't eliminate the waste,
and still risks missed partitions between runs. C swaps one compute
engine for a heavier one for no benefit. D throws away the lake pattern
for a use case that doesn't need it.*

**3. An analyst on the finance team should see all columns of the
`payments` gold table; an analyst on the marketing team should see the
same table minus the `card_last4` and `bank_account` columns. What
enforces this?**

A) Two separate S3 buckets with different bucket policies
B) Lake Formation column-level permissions on the `payments` table —
**correct**
C) IAM policies with `s3:GetObject` conditions
D) Encrypting the sensitive columns with a KMS key only finance can use

*B is correct: this is the textbook column-level permission use case —
one table, different visible columns per principal, only expressible
through Lake Formation grants on catalog columns. A duplicates data and
is an operational/cost anti-pattern. C — S3 has no concept of a
"column" inside a Parquet object. D is a legitimate defense-in-depth
idea but doesn't by itself give marketing a working query over the
non-sensitive columns; it would just make finance's queries fail unless
they had the key, and marketing's queries would need columns excluded
at the query layer regardless.*

**4. A lake's silver zone has degraded to the point where Athena
queries that used to scan in 4 seconds now take 40. Investigation shows
the partition count has grown from a few hundred to several million,
and the average file size has dropped to a few KB. What is the root
cause and fix?**

A) Athena itself needs a service limit increase
B) Over-fine partitioning combined with the small-files problem;
consolidate the partitioning scheme (coarser granularity) and run
compaction — **correct**
C) Switch from Parquet to CSV
D) Move the workload to DynamoDB

*B is correct — this is the classic over-partitioning + small-files
failure mode described in the Scaling section above. A doesn't address
the actual bottleneck (planning overhead per partition + per-file
overhead). C makes query performance worse, not better. D abandons the
analytical access pattern the data actually needs (SQL aggregation over
large scans, not key lookups).*

**5. A retail company wants three different teams — data science
(EMR/Spark), BI (Redshift Spectrum), and ad-hoc analysts (Athena) — to
query the exact same curated sales table without maintaining three
separate copies. What layer makes this possible?**

A) Duplicating the table into each team's preferred engine's native
storage
B) The Glue Data Catalog, which all three engines read from as a
shared, Hive-Metastore-compatible metadata layer over the same S3 data
— **correct**
C) A VPN connecting the three engines
D) DynamoDB Streams

*B is correct — this is precisely the "one copy of data, many engines"
value proposition of the catalog layer described in the reading of the
diagram above. A is the expensive, stale-data-prone pattern the catalog
is meant to avoid. C and D are unrelated to catalog/query-engine
sharing.*

**6. Raw zone files are dropped every 90 seconds from a high-volume
IoT source, each only a few KB. Six months later, the raw prefix has
tens of millions of tiny objects, and even simple crawler runs are
slow and expensive. What should have been designed differently?**

A) Raw zone should never receive streaming data
B) Batch small incoming records into larger files before landing in S3
(e.g., via Firehose buffering) rather than writing one S3 object per
tiny event — **correct**
C) Use EBS instead of S3 for the raw zone
D) Disable the crawler entirely and never catalog raw data

*B is correct: this is the small-files problem originating at the
write path — the fix is to buffer/batch writes (Firehose is the
purpose-built tool for this, covered in `Streaming-Pipeline.md`), not
to change storage engines. A is wrong — streaming data lands in S3 all
the time, correctly, when batched. C reintroduces block storage's
scaling and multi-engine-access problems. D removes catalog visibility
entirely rather than fixing the underlying file-size issue.*

**7. A company needs GDPR-style "right to be forgotten" deletes against
individual customer rows scattered across many partitions of a plain
Hive-style S3 table (no Iceberg). What is the actual cost of honoring
this request today, and what does the exam want you to recognize?**

A) A single `DELETE` statement handles it cheaply
B) Plain Hive-style tables have no row-level delete; honoring the
request requires rewriting entire affected partitions — which is
exactly the motivation for adopting Iceberg (see `Lakehouse.md`) —
**correct**
C) Lake Formation can delete individual rows directly
D) S3 Object Lock prevents this from ever being possible

*B is correct and is the direct bridge to `Lakehouse.md`'s motivation
for Iceberg. A is false for plain Hive/Parquet tables. C — Lake
Formation governs access, not row-level data mutation. D — Object Lock
is about preventing deletion/overwrite for compliance retention, the
opposite problem, and isn't in play here anyway.*

**8. During a backfill, a batch job writes millions of records into a
single S3 prefix representing one calendar day, all within a short
window. Some writes appear to throttle. What is the most likely
explanation and mitigation?**

A) S3 has a global write limit of 3,500 PUT/s that can never be
exceeded regardless of prefix design
B) Extremely concentrated request rate against a narrow key range can
still hit request-rate limits; spreading writes across more
prefixes/using parallel writers with jitter mitigates this —
**correct**
C) This means S3 is the wrong storage choice for a lake
D) Switching to EFS solves the throttling

*B is correct — S3 auto-scales per-prefix, but a sudden extreme burst
against one narrow key can still transiently throttle; spreading load
and using backoff/retry mitigates it. A misstates it as a hard global
cap rather than a per-prefix scaling behavior. C overreacts to a
tunable, common, well-understood operational pattern. D trades a
scalable, multi-engine-readable store for a worse one.*

**9. A new analytics team wants to run ad-hoc SQL against the gold zone
only occasionally, a few queries a day. Which engine best fits, and
why would provisioning a Redshift cluster be the wrong call here?**

A) Redshift, because BI always means Redshift
B) Athena — serverless, pay-per-query, no idle cost for infrequent
access; a provisioned Redshift cluster sitting mostly idle wastes money
on capacity nobody is using — **correct**
C) EMR, because Spark is more powerful
D) DynamoDB, because it's the fastest AWS database

*B is correct and follows directly from the "what does done cost, not
what does up-and-running cost" senior-engineer lens used throughout
this repo — occasional, low-concurrency ad-hoc SQL is the textbook
Athena case. A ignores the access-pattern-first principle. C brings
unnecessary cluster-management overhead for simple SQL. D is a
key-value store, not suited to ad-hoc analytical SQL over a curated
table.*

**10. A Glue Crawler run against a prefix containing both CSV files
(from an older process) and Parquet files (from a newer one) produces a
table with inconsistent, partially-null columns. What is the correct
fix?**

A) Increase the crawler's DPU count
B) Separate the two formats into distinct S3 prefixes (and therefore
distinct catalog tables), since a crawler assumes one schema per table
path — mixing formats in one prefix is the root cause — **correct**
C) Disable schema inference and let Athena guess types at query time
D) Convert the crawler to run hourly instead of daily

*B is correct — this is a data-organization problem, not a
compute-power or scheduling problem: one prefix should represent one
consistent format/schema. A doesn't address a classification problem
with more compute. C isn't how Athena/Glue works — schema comes from
the catalog, not query-time guessing. D doesn't fix mixed-format
misclassification, it just repeats it more often.*
