# Amazon Athena

> The serverless query-in-place engine for S3. Covers Engine v3,
> workgroups as cost guardrails, CTAS, UNLOAD, federated query via Lambda
> connectors, partition projection (with a worked example), Iceberg ACID
> support, and Athena notebooks with Spark.

## CONTENTS

- [1. Explain like I'm 12](#eli12)
- [2. Explain technically](#technical)
- [3. Explain like a Senior AWS Data Engineer](#senior)
- [4. Production architecture](#architecture)
- [5. Engine v3](#enginev3)
- [6. Workgroups as cost guardrails](#workgroups)
- [7. CTAS](#ctas)
- [8. UNLOAD](#unload)
- [9. Federated query via Lambda connectors](#federated)
- [10. Partition projection — worked example](#projection)
- [11. Iceberg ACID support](#iceberg)
- [12. Athena notebooks with Spark](#notebooks)
- [13. When to use / when NOT to use](#whentouse)
- [14. Advantages and limitations](#advlim)
- [15. Pricing](#pricing)
- [16. Performance, scaling, and high availability](#perfscale)
- [17. Security](#security)
- [18. Failure scenarios and common mistakes](#failures)
- [19. Exam traps](#examtraps)
- [20. Interview questions](#interview)
- [21. Cheat sheet](#cheatsheet)
- [22. Memory tricks](#mnemonics)
- [23. Practice questions (15)](#practice)

---

<a name="eli12"></a>
## 1. Explain like I'm 12

Imagine you have a giant messy garage full of labeled boxes (that's your
S3 data lake), and instead of hiring movers to bring every box into a
new house before you can look through it, you hire a detective who walks
into the garage, only opens the boxes with the labels you asked for, and
tells you the answer on the spot. You pay the detective only for the
boxes they actually opened, not a flat monthly salary. That's Amazon
Athena: SQL queries that run directly against files sitting in S3, with
nothing to load, no server to manage, and a bill based on how much data
was actually scanned.

<a name="technical"></a>
## 2. Explain technically

Amazon Athena is a serverless, interactive SQL query engine (built on
Trino/Presto, now branded as **Engine v3**) that queries data directly
in S3 using table definitions registered in the **AWS Glue Data
Catalog**. There's no cluster to provision — a query is submitted, Athena
allocates the compute transparently, executes, and returns results,
billing per TB of data scanned (with exceptions for newer
capacity-based and Spark-based pricing modes). Athena supports standard
ANSI SQL, structured/semi-structured formats (Parquet, ORC, JSON, CSV,
Avro), partition-aware scanning to reduce data read, **CTAS**/**UNLOAD**
for writing new datasets back to S3, **federated query** for reaching
into non-S3 data sources via Lambda connectors, and full **Apache
Iceberg** table support including ACID transactions (`INSERT`,
`UPDATE`, `DELETE`, `MERGE`) and time travel.

<a name="senior"></a>
## 3. Explain like a Senior AWS Data Engineer

A senior engineer's default lens on Athena is **cost-per-query is a
function of bytes scanned, not query complexity** — a poorly partitioned
table with a `SELECT *` over unpartitioned CSV can cost 50x what the
same logical query costs against a well-partitioned, columnar (Parquet),
compressed table. This reframes almost every Athena optimization
question as "how do I reduce bytes scanned": partition pruning,
columnar formats, compression, and CTAS-based materialization of
frequently-run expensive queries into smaller pre-aggregated tables. The
second senior-level habit is **workgroups as a governance primitive, not
just an organizational folder** — per-query and per-workgroup data-scan
limits are the mechanism that prevents one analyst's runaway `SELECT *`
from generating a surprise five-figure bill, and the exam expects you to
recognize "prevent cost overruns from ad hoc queries" as the workgroup
data-usage-control trigger phrase. Third: **partition projection is the
answer whenever a scenario describes a Hive-style partitioned table with
a predictable naming pattern and complains about slow query planning**
— it removes the need for Athena to fetch partition metadata from the
Glue Data Catalog at query time (or maintain it via `MSCK REPAIR
TABLE`/crawlers) by computing valid partitions algorithmically from the
query itself.

<a name="architecture"></a>
## 4. Production architecture

```
        ┌──────────────────────┐
        │   Glue Data Catalog    │  ← table/partition metadata
        │  (or partition          │     (or computed via partition
        │   projection config)    │      projection, no catalog fetch)
        └──────────┬────────────┘
                    │  query planning reads schema/partitions
                    v
        ┌───────────────────────────────────────────────────┐
        │                    ATHENA (Engine v3)                 │
        │   WORKGROUP: enforces per-query data-scan limit,      │
        │   tags cost to a team, sets default output location    │
        └───┬──────────────┬─────────────────┬─────────────-─┘
            │ reads          │ federated query   │ writes
            v                v                    v
     ┌─────────────┐  ┌──────────────────┐  ┌──────────────────┐
     │  S3 curated   │  │ Lambda connector  │  │  CTAS / UNLOAD     │
     │  zone         │  │ → RDS/DynamoDB/   │  │  → new S3 table/    │
     │  (Parquet /   │  │   CloudWatch/etc. │  │   result set         │
     │  Iceberg)     │  └──────────────────┘  └──────────────────┘
     └─────────────┘
```

Reading the diagram: a query submitted to a **workgroup** first has its
scan cost bounded by that workgroup's configured data-usage-control
limit before execution even begins. Athena's query planner resolves
table/partition metadata either from the **Glue Data Catalog** or, if
**partition projection** is configured, computes valid partitions
directly from the query's filter predicates without a catalog round
trip. The query then reads data from S3 (plain Parquet/ORC or Iceberg
tables), or, for **federated query**, invokes a Lambda connector to pull
data from a non-S3 source (RDS, DynamoDB, CloudWatch Logs, and many
others) and joins it in-engine alongside S3 data. Output either returns
directly to the caller or is materialized back to S3 via **CTAS**
(a new table) or **UNLOAD** (a raw result-set export), both of which are
commonly used to pre-compute an expensive query once and let cheaper,
repeated downstream queries read the smaller materialized result.

---

<a name="enginev3"></a>
## 5. Engine v3

Athena's current query engine, based on Trino, brings meaningfully
better performance, more complete ANSI SQL support (including advanced
window functions, more geospatial functions, and improved `MERGE`
support for Iceberg), and better resource efficiency than the older
Presto-based engine (Engine v2), with no schema or workflow changes
required — it's largely a drop-in upgrade for existing workgroups.
Exam-relevant takeaway: Engine v3 is what makes full Iceberg ACID
support (below) and Spark integration performant enough to be a
realistic production answer, not just a checkbox feature.

<a name="workgroups"></a>
## 6. Workgroups as cost guardrails

A **workgroup** isolates and governs a group of users/queries/
applications: it can set a **default output location** for query
results, tag costs for billing/chargeback (CloudWatch metrics and cost
allocation per workgroup), enforce **engine version**, and — most
exam-relevant — enforce a **per-query and/or per-workgroup data usage
control** that either alerts or **stops queries** once a configured
scanned-bytes threshold is exceeded, directly preventing a single
runaway query or an aggregate of queries from blowing past a cost
budget.

⚠️ **Exam trap:** "prevent an analyst's ad hoc queries from generating
unexpectedly high costs" is the workgroup data-usage-control trigger —
not IAM permissions (which control *who* can query, not *how much* a
query can cost) and not S3 lifecycle policies (irrelevant to query
cost).

<a name="ctas"></a>
## 7. CTAS

`CREATE TABLE AS SELECT` runs a query and writes its result as a **new**
Athena/Glue-catalog table, letting you materialize an expensive,
frequently-reused query result (with a chosen file format, compression,
and partitioning scheme) once, so subsequent queries against the
materialized table are dramatically cheaper and faster than re-running
the original expensive query each time. CTAS is also the standard way
to **convert file format** (e.g., raw JSON/CSV → partitioned, compressed
Parquet) as a one-time or scheduled transformation step, entirely in
SQL, with no separate ETL job required for that conversion.

<a name="unload"></a>
## 8. UNLOAD

`UNLOAD` runs a query and writes the **raw result set** to S3 in a
specified format (Parquet, ORC, Avro, JSON, or delimited text) without
creating a new catalog table — used when you need the output file(s)
themselves (for another tool, an export, or a one-off extract) rather
than a queryable table. The distinction from CTAS: CTAS registers a new
table in the Data Catalog for repeated querying; UNLOAD just produces
files.

<a name="federated"></a>
## 9. Federated query via Lambda connectors

Athena **federated query** uses purpose-built **Lambda data source
connectors** (AWS-provided for services like RDS, DynamoDB, DocumentDB,
CloudWatch Logs, Redshift, and others, or custom-built against the
Athena Query Federation SDK) to translate a portion of a SQL query into
calls against that non-S3 source, then joins the results in-engine
alongside S3-resident data — all in a single SQL query, without a
separate ETL step to first copy the other source's data into S3.

⚠️ **Exam trap:** "query data in DynamoDB and S3 together in one SQL
statement without building a pipeline to move DynamoDB data into S3
first" is the federated-query trigger phrase specifically pointing at
the **Lambda connector**, not DynamoDB export-to-S3 (which is a
different, separate feature better suited when you actually want a
durable S3 copy for repeated/heavy analytical use, versus federated
query's ad hoc, no-copy join).

<a name="projection"></a>
## 10. Partition projection — worked example

Standard Hive-style partitioned tables require Athena to fetch partition
metadata (which partitions exist, and their S3 locations) from the Glue
Data Catalog at query planning time — for tables with tens of thousands
of partitions, this metadata fetch itself becomes slow. **Partition
projection** eliminates that fetch by having Athena **compute** valid
partition values and their S3 locations algorithmically, directly from
the table's DDL configuration and the query's filter predicates — no
catalog lookup, no `MSCK REPAIR TABLE`, no crawler needed to keep
partitions current.

Worked example — a clickstream table partitioned by date, where data
always lands at a predictable path:

```sql
CREATE EXTERNAL TABLE clickstream (
    user_id string,
    event_type string,
    url string
)
PARTITIONED BY (dt string)
STORED AS PARQUET
LOCATION 's3://lake/curated/clickstream/'
TBLPROPERTIES (
    'projection.enabled' = 'true',
    'projection.dt.type' = 'date',
    'projection.dt.range' = '2024-01-01,NOW',
    'projection.dt.format' = 'yyyy-MM-dd',
    'projection.dt.interval' = '1',
    'projection.dt.interval.unit' = 'DAYS',
    'storage.location.template' = 's3://lake/curated/clickstream/dt=${dt}/'
)
```

Reading this configuration: `projection.enabled = true` turns on
partition projection for this table. `projection.dt.type = date`
tells Athena the `dt` partition column is a date range, spanning
`2024-01-01` through `NOW` (today), stepping by `1 DAY` at a time, in
`yyyy-MM-dd` format. `storage.location.template` tells Athena exactly
how to construct the S3 path for any given `dt` value — so a query like
`WHERE dt = '2026-08-05'` never touches the Glue Data Catalog for
partition resolution at all; Athena computes the path
`s3://lake/curated/clickstream/dt=2026-08-05/` directly from the
template and reads only that prefix. This is both faster (no metadata
fetch) and cheaper (no wasted scan of partitions the query didn't ask
for) than a standard partitioned table at high partition counts.

⚠️ **Exam trap:** "an Athena table has grown to tens of thousands of
partitions and query planning has become slow" is the direct trigger for
**partition projection** — not "run `MSCK REPAIR TABLE` more often"
(which actually makes the underlying problem — large partition-metadata
volume in the catalog — worse, not better) and not "add more Athena
workgroup capacity" (workgroups don't have a capacity dial the way that
implies for standard on-demand Athena).

<a name="iceberg"></a>
## 11. Iceberg ACID support

Athena has full read/write support for **Apache Iceberg** tables,
including `INSERT`, `UPDATE`, `DELETE`, and `MERGE` (upsert) statements
— genuine row-level ACID transactions directly against S3-backed data,
something plain Hive-style Parquet tables cannot do (those only support
whole-partition overwrite, not row-level mutation). Iceberg tables in
Athena also support **time travel** (`SELECT * FROM table FOR SYSTEM_
VERSION AS OF ...` / `FOR SYSTEM_TIME AS OF ...`), letting you query the
table as of a prior snapshot — useful for auditing, debugging a bad
transformation, or reproducing a historical report exactly. This is the
mechanism that makes "update a specific row in your S3 data lake" a
real, first-class SQL operation rather than requiring a full-partition
rewrite.

⚠️ **Exam trap:** "delete specific rows matching a GDPR erasure request
from an S3-based data lake table" is an Iceberg `DELETE`/`MERGE`
trigger — a plain Hive/Parquet table cannot do row-level delete; it
requires an Iceberg (or Hudi/Delta, off-exam) table format.

<a name="notebooks"></a>
## 12. Athena notebooks with Spark

Athena supports running **Apache Spark** workloads directly within
Athena via notebooks (Athena for Apache Spark) — a serverless Spark
environment for exploratory data analysis, complex transformations, or
ML feature engineering that benefit from Spark's programmatic API
(Python/PySpark) rather than pure SQL, without provisioning an EMR
cluster or a Glue job. This is the answer when a scenario wants
interactive, notebook-style, code-driven analysis (not scheduled
production ETL — that's still Glue/EMR territory) directly against data
already cataloged for Athena SQL use, with the same underlying data/
catalog.

---

<a name="whentouse"></a>
## 13. When to use / when NOT to use

**Use Athena when:** you need ad hoc or scheduled SQL queries directly
against S3 data with no infrastructure to manage; the workload is
read-heavy/analytical rather than transactional; you need to query
across S3 and other sources in one statement (federated query); you need
row-level ACID operations on a data lake table (Iceberg).

**Do NOT use Athena when:** the workload is truly transactional/OLTP
(frequent, low-latency single-row writes) — use DynamoDB/RDS/Aurora;
queries are run so frequently and consistently that a provisioned,
always-on warehouse (Redshift) would be cheaper than repeated
per-TB-scanned billing; the data isn't yet in S3 and federated query
isn't a fit for the access pattern (heavy, sustained cross-source joins
are usually cheaper as a proper ETL pipeline into S3 first, rather than
federated query on every run).

<a name="advlim"></a>
## 14. Advantages and limitations

**Advantages:** zero infrastructure to manage; pay only for data
scanned (or provisioned capacity/Spark, if chosen); standard ANSI SQL;
native Glue Data Catalog integration shared with Redshift Spectrum, EMR,
and Glue jobs; full Iceberg ACID + time travel; federated query reaches
non-S3 sources without a separate pipeline.

**Limitations:** per-TB-scanned billing can get expensive on
unpartitioned or poorly-formatted data, or with runaway ad hoc queries
without workgroup guardrails; not built for low-latency transactional
workloads; federated query performance depends on the target source and
connector, and isn't a substitute for a proper ETL pipeline under
sustained heavy load; query result reuse/caching has to be deliberately
leveraged (CTAS, result reuse settings) rather than being automatic for
every repeated query shape.

<a name="pricing"></a>
## 15. Pricing

Standard, on-demand Athena bills **per TB of data scanned** per query
(with a minimum charge per query and rounding), which is why
partitioning, columnar formats (Parquet/ORC), and compression are
directly cost-reducing, not just performance-reducing. Athena also
offers **provisioned capacity** for predictable, high-volume workloads
wanting flat, capacity-based pricing instead of per-scan billing.
**Athena for Apache Spark** bills based on compute (DPU-hours, similar
model to Glue) rather than data scanned. CTAS/UNLOAD output storage
incurs normal S3 storage cost. There's no charge for DDL statements
(`CREATE TABLE`, etc.) themselves, only for the data scanned by
`SELECT`/CTAS queries.

<a name="perfscale"></a>
## 16. Performance, scaling, and high availability

Athena scales query execution transparently and automatically — no
cluster sizing decision for standard on-demand queries. Performance for
any given query is overwhelmingly determined by **how much data must be
scanned**: partition pruning (standard partitions or partition
projection), columnar formats with predicate/column pushdown (Parquet/
ORC let Athena read only needed columns and skip irrelevant row groups
via embedded statistics), appropriately-sized files (avoiding both the
small-file problem and single-huge-file bottlenecks), and compression.
Athena is inherently highly available and Regional — there's no
single point of failure to manage since there's no persistent cluster.

<a name="security"></a>
## 17. Security

Access control layers: **IAM** policies control who can run queries and
against which workgroups/catalogs; **Lake Formation** adds table- and
column-level permissions (including row-level and cell-level filtering
via LF-Tags) enforced consistently for Athena, Redshift Spectrum, and
other Lake-Formation-integrated engines; query results and any CTAS/
UNLOAD output inherit S3-level encryption (SSE-S3/SSE-KMS) configured
on the output location; workgroups can enforce that queries must use a
specific, encrypted output location. CloudTrail logs Athena API calls
(query submission, etc.) for audit.

<a name="failures"></a>
## 18. Failure scenarios and common mistakes

- **No workgroup data-usage-control limit** — an accidental `SELECT *`
  on an unpartitioned, huge table generates a large, unexpected bill.
- **Table not partitioned, or partitioned on a column queries never
  filter on** — every query scans the entire dataset regardless of the
  actual filter predicate used.
- **Storing data as row-oriented CSV/JSON instead of columnar Parquet/
  ORC** — Athena can't skip unneeded columns, inflating scan cost and
  latency.
- **Relying on `MSCK REPAIR TABLE` or crawler-based partition discovery
  at very high partition counts** instead of partition projection —
  slow query planning as metadata volume grows.
- **Attempting row-level updates/deletes on a plain Hive/Parquet table**
  — not supported; requires migrating to Iceberg.
- **Using federated query as a substitute for a real ETL pipeline under
  sustained heavy load** — fine for ad hoc/light joins, inefficient as a
  standing high-volume access pattern.

<a name="examtraps"></a>
## 19. Exam traps

⚠️ **Cost scales with bytes scanned, not query complexity.** A
"cheapest way to run this query" answer is almost always about reducing
scanned data (partitioning, columnar format, compression, CTAS
materialization) — not about the SQL syntax itself.

⚠️ **"Prevent runaway ad hoc query cost" = workgroup data usage
control**, not IAM restrictions.

⚠️ **"Tens of thousands of partitions, slow query planning" =
partition projection**, not more frequent `MSCK REPAIR TABLE` runs.

⚠️ **Row-level `UPDATE`/`DELETE`/`MERGE` on an S3 data lake requires
Iceberg** — plain Parquet/Hive tables only support partition-level
overwrite, not row-level mutation.

⚠️ **CTAS creates a new table; UNLOAD just writes files.** If the
scenario needs the output to be immediately queryable again via SQL,
that's CTAS. If it just needs the raw exported files, that's UNLOAD.

<a name="interview"></a>
## 20. Interview questions

- *"A team's Athena bill is much higher than expected for their query
  volume. How do you investigate?"* Strong answer: check whether tables
  are partitioned and whether the partition column matches actual query
  filters, check file format (CSV/JSON vs Parquet/ORC), check for
  workgroup data-usage-control limits, and look for unpartitioned
  `SELECT *` patterns — bytes scanned drives cost directly.
- *"How would you support row-level GDPR delete requests against a data
  lake queried by Athena?"* Strong answer: the table must be Iceberg
  format to support `DELETE`/`MERGE`; a plain Parquet/Hive table would
  require rewriting whole partitions, which doesn't scale to per-row
  erasure requests.
- *"When would you use Athena federated query instead of first ETL'ing
  a source into S3?"* Strong answer: for ad hoc, occasional, or
  low-volume joins against a live source (RDS, DynamoDB) where building
  and maintaining a full pipeline isn't justified; for sustained,
  heavy, repeated access, a proper ETL pipeline into S3 is usually more
  cost-effective and performant.

<a name="cheatsheet"></a>
## 21. Cheat sheet

| If the scenario says... | Reach for... |
|---|---|
| ad hoc SQL directly against S3, no infrastructure | Athena |
| prevent runaway query cost | Workgroup data usage control |
| materialize an expensive query as a reusable table | CTAS |
| export raw query results as files | UNLOAD |
| join S3 data with RDS/DynamoDB/other sources in one query | Federated query (Lambda connector) |
| tens of thousands of partitions, slow planning | Partition projection |
| row-level UPDATE/DELETE/MERGE on a data lake table | Iceberg table format |
| audit / reproduce a historical query result | Iceberg time travel |
| interactive Spark-based exploration, no EMR cluster | Athena for Apache Spark (notebooks) |
| convert JSON/CSV to partitioned Parquet in SQL | CTAS with format/partitioning options |
| reduce cost of a query | Partition + columnar format + compression |

<a name="mnemonics"></a>
## 22. Memory tricks

**"Bytes scanned, not brains spent"** — Athena cost/performance is
driven by how much data is read, not how clever the SQL is. **"CTAS
makes a table, UNLOAD makes files"** — the one-line distinction.
**"Projection predicts, catalog looks up"** — partition projection
computes partitions algorithmically; standard partitioning fetches them
from the Glue Data Catalog.

---

<a name="practice"></a>
## 23. Practice questions (15)

**Q1.** An analytics team's Athena costs spiked after an analyst ran
`SELECT *` on an unpartitioned 40 TB CSV table. What should be
configured to prevent this from causing unexpected cost overruns going
forward?

A) A stricter IAM policy limiting which tables the analyst can query
B) A workgroup data usage control limiting bytes scanned per query
C) S3 lifecycle policies on the source table
D) Increasing the Glue Data Catalog's partition limit

**Answer: B.** Workgroup data-usage-control settings directly cap or
alert on scanned bytes per query/workgroup, which is exactly the cost
lever that was exceeded. (A) IAM restricts *access*, not query cost.
(C) lifecycle policies affect storage tiering, not query-time scan
cost. (D) the Glue Catalog doesn't have a "partition limit" governing
cost this way.

**Q2.** Which change would most directly reduce the amount of data
scanned (and thus cost) for a recurring Athena query against a large,
unpartitioned, row-oriented CSV dataset?

A) Increase the workgroup's data usage control limit
B) Convert the data to partitioned, compressed Parquet via CTAS
C) Switch the query to use federated query
D) Enable Athena for Apache Spark

**Answer: B.** Partitioning enables pruning and Parquet's columnar
format with compression directly reduces bytes read per query — the
core cost/performance lever in Athena. (A) raises the cost ceiling; it
doesn't reduce actual scan volume. (C) federated query is for reaching
non-S3 sources, unrelated to this optimization. (D) Spark notebooks are
for interactive/programmatic analysis, not a scan-reduction technique
for standard SQL queries.

**Q3.** A team needs to join live data from a DynamoDB table with
historical data already in S3, in a single SQL query, without building
a pipeline to copy DynamoDB data into S3 first. What Athena capability
enables this?

A) CTAS
B) Partition projection
C) Federated query via a Lambda connector
D) UNLOAD

**Answer: C.** Federated query uses a Lambda data source connector to
reach into DynamoDB directly and join it in-engine with S3 data in one
statement, with no separate copy pipeline. (A) CTAS materializes query
results as a new table, unrelated to reaching non-S3 sources. (B)
partition projection is about S3 partition metadata, unrelated to
querying DynamoDB. (D) UNLOAD exports results to S3, the wrong
direction for this need.

**Q4.** A Hive-style partitioned Athena table has grown to over 50,000
partitions, and query planning latency has become a noticeable
bottleneck even for well-filtered queries. What is the most direct fix?

A) Run MSCK REPAIR TABLE before every query
B) Configure partition projection for the table
C) Switch the table to CSV format
D) Increase the workgroup's data usage control limit

**Answer: B.** Partition projection removes the need for Athena to
fetch partition metadata from the Glue Data Catalog at query time by
computing valid partitions algorithmically — the direct fix for
metadata-fetch latency at high partition counts. (A) running MSCK
REPAIR more often adds catalog metadata load, worsening the underlying
problem. (C) CSV is a worse format for scan efficiency and doesn't
address partition metadata latency. (D) raising a cost limit doesn't
affect query planning speed.

**Q5.** A compliance team needs to delete specific rows matching a data
subject's erasure request from an S3-based data lake table queried by
Athena. The table is currently plain partitioned Parquet (Hive-style,
not Iceberg). What must change to support this?

A) Nothing — Athena supports row-level DELETE on any Parquet table
B) Migrate the table to Iceberg format, which supports row-level DELETE/MERGE
C) Use UNLOAD to remove the rows
D) Use partition projection to exclude the rows

**Answer: B.** Row-level ACID operations (`DELETE`, `UPDATE`, `MERGE`)
require the Iceberg table format; plain Hive/Parquet tables only
support partition-level overwrite, not row-level mutation. (A) is
false — standard Parquet/Hive tables do not support row-level DELETE.
(C) UNLOAD exports query results; it doesn't modify or delete table
data in place. (D) partition projection is a metadata-computation
feature, not a data mutation mechanism.

**Q6.** What is the key difference between Athena's CTAS and UNLOAD
statements?

A) CTAS only works on Iceberg tables; UNLOAD works on any table
B) CTAS creates a new queryable catalog table from a query's results; UNLOAD writes raw result files to S3 without registering a table
C) UNLOAD is more expensive than CTAS for the same query
D) CTAS and UNLOAD are functionally identical

**Answer: B.** That's the defining distinction — CTAS registers a
new Data Catalog table for repeated SQL querying, while UNLOAD simply
produces output files. (A) CTAS works on standard and Iceberg source
tables; it isn't Iceberg-only. (C) relative cost depends on data
scanned by the underlying query, not which statement is used. (D) they
serve different purposes and are not interchangeable.

**Q7.** Which Athena engine version introduced meaningfully improved
ANSI SQL support (including advanced Iceberg MERGE support) and is
built on Trino?

A) Engine v1
B) Engine v2
C) Engine v3
D) Athena for Apache Spark

**Answer: C.** Engine v3, based on Trino, is the current engine with
expanded SQL support and better Iceberg/MERGE performance. (A) there is
no publicly relevant "Engine v1" in this context. (B) Engine v2 was the
prior Presto-based engine, superseded by v3. (D) Athena for Apache
Spark is a separate Spark-based execution mode, not the SQL engine
version.

**Q8.** A data scientist wants to run interactive, code-driven
exploratory analysis using PySpark against data already cataloged for
Athena SQL, without provisioning an EMR cluster. What should they use?

A) Athena for Apache Spark (notebooks)
B) A scheduled Glue ETL job
C) Redshift Spectrum
D) CTAS with a Python UDF

**Answer: A.** Athena for Apache Spark provides a serverless,
notebook-based Spark environment for exactly this interactive,
programmatic use case, without standing up an EMR cluster. (B) a
scheduled Glue job is for production ETL, not interactive exploratory
analysis. (C) Spectrum is a Redshift feature for querying S3, not a
Spark notebook environment. (D) CTAS is a SQL statement, not a
Spark/Python interactive environment, and Athena SQL doesn't support
arbitrary Python UDFs the way this implies.

**Q9.** Which statement about Athena on-demand pricing is accurate?

A) Athena bills a flat hourly rate regardless of query volume
B) Athena bills per TB of data scanned by each query, with a per-query minimum
C) Athena charges only for DDL statements, not SELECT queries
D) Athena pricing is identical to Athena for Apache Spark pricing

**Answer: B.** Standard on-demand Athena bills per TB scanned per
query. (A) there is no flat hourly charge for on-demand Athena (that
describes provisioned capacity or a cluster-based service, not
standard Athena). (C) DDL statements are not billed; SELECT/CTAS
queries that scan data are what incurs charges. (D) Athena for Apache
Spark bills by compute (DPU-hours), a different model from per-TB-
scanned SQL pricing.

**Q10.** A partitioned Iceberg table needs to be queried as it existed
exactly one week ago, for an audit investigating a data quality issue
introduced since then. What Athena/Iceberg capability supports this?

A) Partition projection
B) Time travel (FOR SYSTEM_TIME / SYSTEM_VERSION AS OF)
C) CTAS with a WHERE clause on a timestamp column
D) UNLOAD with a historical output location

**Answer: B.** Iceberg time travel lets you query a table as of a
specific prior snapshot/timestamp directly, which is exactly what
reproducing last week's state requires. (A) partition projection
computes current partition locations, unrelated to historical
snapshots. (C) filtering on a timestamp column only works if every row
carries an explicit valid-as-of timestamp and doesn't reconstruct
deleted/overwritten historical state the way snapshot time travel does.
(D) UNLOAD exports current query results; it has no historical-state
capability of its own.

**Q11.** Which best describes when federated query is NOT the
recommended approach?

A) A one-time ad hoc join between S3 data and a small RDS lookup table
B) A sustained, high-volume, frequently-repeated join against a large operational database, better served by a proper ETL pipeline into S3
C) An occasional query joining CloudWatch Logs data with S3 data
D) A quick exploratory join during initial data discovery

**Answer: B.** For sustained, heavy, repeated cross-source access,
building a proper ETL pipeline to land the data in S3 is generally more
cost-effective and performant than repeatedly federating live queries
against the operational source. (A), (C), and (D) are all reasonable,
lighter-weight, ad hoc use cases federated query is well-suited for.

**Q12.** What does the `storage.location.template` property control in
a partition projection table definition?

A) The compression codec used for the table's files
B) The S3 path pattern Athena constructs algorithmically for a given partition value, without a catalog lookup
C) The IAM role used to access the table
D) The retention period for old partitions

**Answer: B.** It defines exactly how Athena builds the S3 path for
any computed partition value (e.g., substituting `${dt}` with the
actual date), which is what lets projection skip the Glue Data Catalog
metadata fetch entirely. (A) compression is set via `STORED AS` /
SerDe properties, not this template. (C) IAM role configuration is
separate from table DDL. (D) retention/lifecycle is an S3 bucket-level
configuration, not a partition projection property.

**Q13.** A table stores clickstream events as small, individual JSON
files, one per event, arriving continuously — millions of files per
day. Athena queries against this table are slow and expensive. What are
the two most relevant fixes?

A) Enable federated query and increase workgroup limits
B) Compact small files into larger Parquet files, and partition appropriately by date/hour
C) Switch to UNLOAD for every query
D) Disable the Glue Data Catalog and use S3 Select instead

**Answer: B.** This is the classic small-file problem: compacting into
fewer, larger, columnar (Parquet) files and choosing a partition
granularity matching ingest volume directly reduces per-file overhead
and improves scan efficiency/cost. (A) federated query and cost limits
don't address the underlying file-size/format problem. (C) UNLOAD
exports results; it doesn't fix the source table's file layout. (D)
disabling the Data Catalog would break Athena's ability to query the
table via standard SQL entirely.

**Q14.** Which is true about Athena's relationship to the AWS Glue Data
Catalog?

A) Athena maintains its own separate, independent metadata store unrelated to Glue
B) Athena uses the Glue Data Catalog for table/partition metadata, the same catalog shared with Redshift Spectrum and EMR
C) The Glue Data Catalog is only used by Athena for federated queries
D) Athena requires a dedicated crawler to run before every single query

**Answer: B.** Athena, Redshift Spectrum, EMR, and Glue jobs all share
the same Glue Data Catalog as their metadata layer — that shared
catalog is what lets a table defined once be queried consistently
across engines. (A) is false; Athena is built directly on the Glue
Data Catalog. (C) the catalog is used for standard S3-table querying,
not only federated queries. (D) a crawler is not required before every
query — only when schema/partitions need to be (re)discovered, and
partition projection can remove even that need.

**Q15.** A finance team wants to precompute a complex monthly revenue
aggregation once and let dozens of downstream dashboard queries read
the smaller, pre-aggregated result cheaply and quickly for the rest of
the month. What is the most appropriate Athena approach?

A) Have every dashboard query run the full aggregation directly each time
B) Use CTAS to materialize the aggregation into a new table, and point dashboards at it
C) Use federated query to recompute the aggregation from the source database each time
D) Use partition projection on the source fact table

**Answer: B.** CTAS materializes the expensive aggregation's result as
a new, much smaller, directly queryable table once — exactly the
"compute once, query many times cheaply" pattern the scenario describes.
(A) recomputing the full expensive aggregation on every dashboard
refresh is the costly pattern CTAS is meant to avoid. (C) federated
query adds cross-source complexity without addressing the "compute
once" goal at all. (D) partition projection improves partition metadata
resolution, not aggregation reuse.
