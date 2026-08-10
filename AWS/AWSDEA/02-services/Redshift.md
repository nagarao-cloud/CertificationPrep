# Amazon Redshift

> The data warehouse workhorse of DEA-C01's Domain 2. Covers RA3 +
> Redshift Managed Storage, Redshift Serverless (RPUs), distribution
> styles, sort keys + zone maps, COPY/UNLOAD, WLM vs auto-WLM,
> concurrency scaling, Spectrum, data sharing, materialized views,
> VACUUM/ANALYZE automation, and the newer capability of writing directly
> to Apache Iceberg tables.

## CONTENTS

- [1. Explain like I'm 12](#eli12)
- [2. Explain technically](#technical)
- [3. Explain like a Senior AWS Data Engineer](#senior)
- [4. Production architecture](#architecture)
- [5. RA3 nodes and Redshift Managed Storage](#ra3)
- [6. Redshift Serverless (RPUs)](#serverless)
- [7. Distribution styles](#distribution)
- [8. Sort keys and zone maps](#sortkeys)
- [9. COPY / UNLOAD best practices](#copyunload)
- [10. WLM vs auto-WLM](#wlm)
- [11. Concurrency scaling](#concurrencyscaling)
- [12. Redshift Spectrum](#spectrum)
- [13. Data sharing](#datasharing)
- [14. Materialized views](#matviews)
- [15. VACUUM / ANALYZE — what's automatic now](#vacuum)
- [16. Writing directly to Iceberg tables](#iceberg)
- [17. When to use / when NOT to use](#whentouse)
- [18. Advantages and limitations](#advlim)
- [19. Pricing](#pricing)
- [20. Performance, scaling, and high availability](#perfscale)
- [21. Security](#security)
- [22. Failure scenarios and common mistakes](#failures)
- [23. Exam traps](#examtraps)
- [24. Interview questions](#interview)
- [25. Cheat sheet](#cheatsheet)
- [26. Memory tricks](#mnemonics)
- [27. Practice questions (15)](#practice)

---

<a name="eli12"></a>
## 1. Explain like I'm 12

Imagine a library where, instead of one librarian trying to answer every
question alone, you have a whole team of librarians, and before anyone
even asks a question, the books are pre-sorted onto shelves in the exact
order that makes answering fast — biggest topics spread across many
tables so no single librarian gets overwhelmed. That's a data warehouse:
Amazon Redshift takes huge amounts of structured data, spreads it
cleverly across many workers, and pre-organizes it so that "give me the
total sales for March, grouped by store" comes back in seconds instead
of hours, even across billions of rows.

<a name="technical"></a>
## 2. Explain technically

Amazon Redshift is a columnar, MPP (massively parallel processing) data
warehouse. Data is distributed across **compute nodes** (in the
provisioned model) or measured in **RPUs** (in the Redshift Serverless
model), stored column-by-column (so a query touching 3 of 50 columns
only reads those 3), and compressed automatically per column using
encoding chosen based on data type/cardinality. Query execution is
parallelized across nodes/slices, and the **leader node** (provisioned
clusters) compiles query plans and distributes work to **compute
nodes**, each managing one or more **slices** (a slice is a unit of CPU/
memory/disk within a node). Modern Redshift decouples compute from
storage via **RA3 nodes** and **Redshift Managed Storage (RMS)** — data
lives durably in Redshift-managed S3-backed storage, and compute nodes
cache the hot working set, letting you scale compute and storage
independently. **Redshift Serverless** removes node/cluster management
entirely, billing by RPU-seconds of actual query activity with
auto-scaling and auto-pause.

<a name="senior"></a>
## 3. Explain like a Senior AWS Data Engineer

A senior engineer treats Redshift's three biggest performance levers —
**distribution style, sort key, and COPY parallelism** — as the first
things to get right, because retrofitting them on a live, large table
is expensive (a full table rewrite via `DEEP COPY` or `CREATE TABLE AS`
+ swap). The senior-level judgment call the exam rewards repeatedly:
**recognize when Redshift is the wrong tool entirely.** If a scenario
describes ad hoc, infrequent queries against data that mostly lives in
S3 and doesn't need to be loaded into a warehouse at all, the answer is
Athena, not "load it into Redshift first." If the scenario is
transactional (frequent single-row inserts/updates/deletes from an
application), Redshift is the wrong engine full stop — that's RDS/
Aurora/DynamoDB. A second senior habit: **default to `AUTO` distribution
and `AUTO` sort keys** unless the scenario gives a specific, strong
reason to hand-pick — Redshift's automatic optimizer increasingly makes
better choices than a guess, and the exam's newer questions reflect this
shift toward "let Redshift decide unless you have a concrete, stated
join/filter pattern." Third: **VACUUM and ANALYZE are largely automatic
now** (Redshift runs background auto-vacuum and auto-analyze) — a senior
engineer knows this and doesn't reflexively schedule manual VACUUM jobs
the way older material assumes, though manual intervention is still
occasionally needed for very large bulk deletes/updates.

<a name="architecture"></a>
## 4. Production architecture

```
        ┌──────────────┐        ┌───────────────────┐
        │  S3 curated   │        │  Streaming (Kinesis/│
        │  zone (Parquet)│       │  MSK) via zero-ETL   │
        └──────┬────────┘        │  or Firehose         │
               │                 └──────────┬───────────┘
               │  COPY (parallel, from       │
               │  multiple files)            │
               v                             v
        ┌────────────────────────────────────────────────┐
        │              REDSHIFT (RA3 cluster or            │
        │              Redshift Serverless)                 │
        │  Distribution style + sort key applied on load    │
        │  WLM/auto-WLM manages query queues                │
        │  Concurrency scaling adds transient capacity       │
        └───────┬────────────────────────┬─────────────-───┘
                │  Spectrum queries        │  UNLOAD /
                │  S3 external tables      │  data sharing
                v                          v
        ┌───────────────┐         ┌────────────────────┐
        │  S3 data lake   │         │  Other Redshift      │
        │  (no load       │         │  clusters/accounts,   │
        │  required)      │         │  or S3 for BI tools    │
        └───────────────┘         └────────────────────┘
                                            │
                                            v
                                   QuickSight / BI tools /
                                   Materialized views for
                                   pre-aggregated dashboards
```

Reading the diagram: curated S3 data is loaded via parallel **COPY**
(reading many files at once across nodes/slices for throughput), while
streaming sources land via zero-ETL integrations or Amazon Data
Firehose. Inside the cluster, the **distribution style** and **sort
key** chosen at table design time determine how efficiently joins and
range-filtered queries execute, while **WLM/auto-WLM** manages how
concurrent queries share cluster resources and **concurrency scaling**
transparently adds transient capacity during bursts rather than making
queries wait in queue. **Redshift Spectrum** lets queries reach directly
into the S3 data lake without loading data in at all — useful for data
that's queried rarely enough that loading it doesn't pay off. **UNLOAD**
and **data sharing** are the two outbound paths: UNLOAD exports query
results back to S3 (for other tools or archival), and data sharing
exposes live, no-copy access to Redshift data from other clusters or
accounts. **Materialized views** sit in front of BI tools, pre-computing
expensive aggregations so dashboards render fast.

---

<a name="ra3"></a>
## 5. RA3 nodes and Redshift Managed Storage

RA3 is the current node family; its defining feature is separating
**compute** (the RA3 node's CPU/memory) from **storage** (Redshift
Managed Storage — durable, S3-backed storage that scales automatically
and independently of node count). This means you can resize compute
(add/remove nodes to handle more concurrent query load) without needing
to also move or repartition the underlying data, and storage cost
scales with actual data stored rather than the fixed local-disk capacity
of a node type. RMS automatically caches the most frequently accessed
data on high-performance local SSD attached to the compute nodes, so hot
data still gets local-disk-speed access even though the durable copy
lives in managed storage.

<a name="serverless"></a>
## 6. Redshift Serverless (RPUs)

Redshift Serverless removes cluster/node management entirely: capacity
is expressed in **RPUs (Redshift Processing Units)**, and Serverless
automatically scales RPU allocation up and down based on workload,
billing per RPU-second of actual usage (with an **auto-pause** capability
during genuinely idle periods, so idle time costs nothing beyond stored
data). You configure a **base capacity** (a floor RPU setting) and
optionally a **maximum capacity** (a ceiling to bound cost during
runaway or unexpectedly large queries). This is the "least operational
overhead" answer whenever a scenario emphasizes unpredictable,
intermittent, or spiky query workloads and explicitly wants to avoid
capacity planning — versus a provisioned RA3 cluster, which is the
better fit for steady, predictable, always-on high-concurrency
workloads where reserved-node pricing beats per-second serverless
billing.

<a name="distribution"></a>
## 7. Distribution styles

| Style | How rows are placed | Best for | Risk |
|---|---|---|---|
| **KEY** | Rows with the same value of the distribution key land on the same slice | Large tables frequently joined on that key — enables local, no-network-shuffle joins | Skew if the key has low cardinality or an uneven value distribution (hot slice) |
| **ALL** | Full copy of the table replicated to every node | Small, frequently-joined dimension tables (e.g., a date or store dimension) | Wastes storage/load time if the table is large — only appropriate for genuinely small tables |
| **EVEN** | Round-robin distribution across slices | Tables with no clear, dominant join key, or where even load distribution matters more than join locality | Joins on this table may require a network shuffle |
| **AUTO** | Redshift chooses (starts as ALL for small tables, shifts toward EVEN/KEY as the table grows, based on observed usage) | The default, recommended starting point absent a strong specific reason to override | None specific — this is the "let Redshift decide" answer |

⚠️ **Exam trap:** "two large fact tables are frequently joined on
`customer_id` and the join is slow due to data movement between nodes"
is the textbook trigger for **KEY distribution on the shared join
column** on both tables — it eliminates the network shuffle by
co-locating matching rows on the same slice.

<a name="sortkeys"></a>
## 8. Sort keys and zone maps

A **sort key** determines the physical on-disk row order within each
slice; Redshift maintains **zone maps** — a min/max value index per
1 MB block — for the sort key columns, letting the query planner skip
entire blocks that can't contain matching rows for a range-filtered
query (`WHERE order_date BETWEEN ...`), without needing to read them at
all.

| Sort key type | Behavior | Best for |
|---|---|---|
| **Compound** | Columns are prioritized in listed order; most effective when queries filter on a leading subset of those columns in order | Predictable, date-first filtering patterns (the most common warehouse query shape) |
| **Interleaved** | Gives roughly equal weight to each column in the key, at some load/maintenance cost | Queries that filter on different columns unpredictably (no single dominant leading filter column) |
| **AUTO** | Redshift chooses and can adjust over time based on observed query patterns | Default, recommended absent a specific known access pattern |

⚠️ **Exam trap:** interleaved sort keys have a real maintenance cost
(reorganizing them after large loads is more expensive than compound),
so "queries always filter on `order_date` first" should point to a
**compound** sort key led by `order_date`, not interleaved — picking
interleaved "because it sounds more powerful" is a common wrong answer.

<a name="copyunload"></a>
## 9. COPY / UNLOAD best practices

**COPY** loads data into Redshift in parallel across all node
slices — throughput is maximized by splitting the source into
**multiple files** (ideally a multiple of the total slice count) rather
than one giant file, which forces a single slice to do all the work
while others sit idle. Best practices: compress source files (GZIP,
Parquet's native compression), specify the correct `IAM_ROLE` for S3
access instead of embedding credentials, and use `COPY ... REGION` when
crossing Regions. **UNLOAD** does the reverse — exports query results
from Redshift to S3, also in parallel (writing multiple output files
across slices), commonly used to hand off a result set to Athena, other
tools, or an archival/DR copy; UNLOAD supports Parquet output directly,
which is generally preferred over CSV for downstream analytical
consumption.

⚠️ **Exam trap:** "loading a single large CSV file into Redshift is
slow" almost always points to the fix being **split the file into
multiple files** for parallel COPY across slices — not "add more compute
nodes," which doesn't help if the load itself is serialized on one file.

<a name="wlm"></a>
## 10. WLM vs auto-WLM

**Workload Management (WLM)** controls how concurrent queries share
cluster memory and concurrency slots via **queues**. **Manual WLM**
requires explicitly defining queues, memory allocation per queue, and
concurrency limits per queue (e.g., a fast queue for dashboards, a slow
queue for heavy ETL) — powerful but requires ongoing tuning as workload
shifts. **Automatic WLM (auto-WLM)** lets Redshift dynamically manage
memory and concurrency per query based on observed resource needs,
removing manual tuning — this is the recommended default and the
"least operational overhead" exam answer unless a scenario describes a
very specific need for hard workload isolation (e.g., "ETL queries must
never be able to starve dashboard queries of memory, under any
circumstance," which argues for manual WLM queues with dedicated,
guaranteed allocations).

<a name="concurrencyscaling"></a>
## 11. Concurrency scaling

When query queues become backed up due to a burst of concurrent read
queries, **concurrency scaling** transparently spins up additional,
transient cluster capacity to absorb the burst, then removes it when no
longer needed — queries route to this scaling capacity automatically
without any application-level change. Every 24 hours of main cluster
usage accrues a free credit of concurrency-scaling time; usage beyond
the credit is billed per-second. This is the mechanism for "handle
unpredictable read query bursts without over-provisioning the base
cluster for peak load year-round."

<a name="spectrum"></a>
## 12. Redshift Spectrum

Spectrum lets Redshift SQL query data **directly in S3** (via external
tables registered in the Glue Data Catalog) without loading it into the
cluster first — Spectrum's own separate compute layer (outside the
cluster's node capacity) scans the S3 data, applies predicate pushdown/
partition pruning, and returns results Redshift can join against native
cluster tables. This is the answer whenever a scenario wants to query
S3 data occasionally/at low frequency, or join warehouse-resident
dimension tables against a much larger, rarely-queried S3-resident fact
table without the cost/time of loading it all into the cluster.

<a name="datasharing"></a>
## 13. Data sharing

Data sharing provides **live, no-copy** access to data in one
Redshift cluster/serverless workgroup from another — across clusters,
across accounts, and across Regions — without ETL, without duplicating
storage, and without loading/unloading. This is the exam's answer for
"multiple business units each need their own compute, but must query
the same live data without maintaining separate copies that can drift
out of sync" — a common enterprise pattern for a shared central data
warehouse serving many downstream teams with isolated compute (so one
team's heavy queries don't starve another's cluster).

<a name="matviews"></a>
## 14. Materialized views

A materialized view **pre-computes and stores** the result of a query
(commonly an expensive join/aggregation), and can be configured for
**automatic** incremental refresh as underlying data changes, or
manually refreshed — dramatically speeding up repeated dashboard/BI
queries that would otherwise recompute the same aggregation from
scratch each time. Materialized views can also be built over
**Spectrum** external tables, meaning even S3-resident data can benefit
from pre-aggregation without a full load into the cluster.

<a name="vacuum"></a>
## 15. VACUUM / ANALYZE — what's automatic now

Historically, `VACUUM` (reclaim space from deleted/updated rows and
re-sort data) and `ANALYZE` (refresh table statistics for the query
planner) needed to be scheduled manually. Modern Redshift runs
**automatic table maintenance** in the background — auto-vacuum and
auto-analyze — during periods of low cluster load, which covers the
large majority of routine maintenance needs. Manual `VACUUM`/`ANALYZE`
is still occasionally warranted immediately after an unusually large
bulk load/delete/update where waiting for the automatic background
process isn't acceptable for query-plan freshness or reclaimed space —
but the exam's current expectation is that you know this is now
**largely automatic**, not something every pipeline must schedule by
hand.

⚠️ **Exam trap:** older material treats "schedule nightly VACUUM and
ANALYZE jobs" as a required best practice for every Redshift pipeline.
On the current exam, the more accurate framing is that Redshift handles
this automatically in the background, and manual intervention is the
exception for specific large bulk-operation scenarios, not the rule.

<a name="iceberg"></a>
## 16. Writing directly to Iceberg tables

Redshift can now **write directly to Apache Iceberg tables** stored in
S3 (in addition to its long-standing ability to *read* Iceberg tables
via Spectrum), letting Redshift participate as a first-class writer in a
shared lakehouse where Athena, EMR, Glue, and other Iceberg-aware
engines also read and write the same tables — without exporting through
UNLOAD and a separate load step elsewhere. This closes a gap that
previously required Redshift to be the "last stop" for data (write to
Redshift-native tables, then separately UNLOAD to S3 if other engines
needed it); now Redshift can write once, directly into the shared
Iceberg table format other engines already consume.

⚠️ **Exam framing:** a scenario describing "Redshift needs to make its
transformed data available to Athena and EMR without a separate export
step" is testing awareness of this direct Iceberg-write capability —
the older, more roundabout answer would be "UNLOAD to S3, then have
Athena query the unloaded files," which now has a more direct
alternative.

---

<a name="whentouse"></a>
## 17. When to use / when NOT to use

**Use Redshift when:** you need a structured, SQL-queryable data
warehouse for complex joins/aggregations over large, curated datasets;
BI tools need consistent, fast dashboard-query performance; multiple
teams need isolated compute against a shared dataset (data sharing);
you need to combine warehouse-resident and S3-resident data in one
query (Spectrum).

**Do NOT use Redshift when:** the workload is transactional (frequent
single-row OLTP reads/writes) — use RDS/Aurora/DynamoDB; queries are
ad hoc and infrequent against data that mostly lives in S3 and doesn't
warrant loading — use Athena directly; the data is unstructured/
semi-structured with no fixed schema and no clear benefit from columnar
storage — a data lake query engine is a better direct fit.

<a name="advlim"></a>
## 18. Advantages and limitations

**Advantages:** MPP columnar performance at scale; RA3 + RMS decouples
compute/storage scaling; Serverless removes capacity planning for
variable workloads; Spectrum and data sharing extend reach without ETL;
increasingly automatic optimization (AUTO distribution/sort keys,
automatic VACUUM/ANALYZE) reduces tuning burden.

**Limitations:** not built for high-frequency single-row transactional
writes; poor distribution/sort key choices are expensive to fix on
large existing tables; concurrency scaling and Spectrum both have their
own cost dimensions to track; still requires schema design discipline
upfront even with more automation than before.

<a name="pricing"></a>
## 19. Pricing

**Provisioned (RA3):** billed per node-hour for compute, plus separate
Redshift Managed Storage billed per GB actually stored — compute and
storage scale (and cost) independently. **Serverless:** billed per
RPU-second of actual query activity, with auto-pause avoiding charges
during genuine idle time, bounded by configured base/max RPU capacity.
**Concurrency scaling:** free credits accrue daily; usage beyond credits
is billed per-second. **Spectrum:** billed per TB of data scanned from
S3 (same cost lever as Athena — partitioning/columnar formats reduce
scan cost). **Reserved Instances** (provisioned only) offer significant
discounts for steady, predictable long-term workloads versus on-demand
node pricing.

<a name="perfscale"></a>
## 20. Performance, scaling, and high availability

Performance hinges on the trio covered above: distribution style
(minimize cross-slice network shuffle for joins), sort key (maximize
zone-map block skipping for filtered scans), and load parallelism
(COPY across many files/slices). Scaling is either **elastic resize**
(add/remove nodes of the same type, fast) or **classic resize**
(change node type, slower, involves a full data redistribution) for
provisioned clusters, or automatic for Serverless. High availability:
Redshift automatically replicates data within the cluster and to S3,
and a provisioned cluster can be configured Multi-AZ for RA3 (compute
failover across AZs) in addition to the inherent durability of RMS;
automated snapshots (plus manual snapshots) provide point-in-time
recovery, and cross-Region snapshot copy supports DR.

<a name="security"></a>
## 21. Security

Encryption at rest via KMS (cluster-level, and RMS storage), TLS in
transit; cluster deployment inside a VPC with security-group-controlled
access; IAM authentication and role-based access alongside native
database users/groups; column-level and row-level security (via views
and grants, and integration with Lake Formation for Spectrum-queried
data); audit logging via CloudTrail (management events) and database
audit logging (`STL`/`SVL` system tables, or the newer unified audit
logging) for query-level tracking.

<a name="failures"></a>
## 22. Failure scenarios and common mistakes

- **EVEN or a poorly-chosen KEY distribution on two large, frequently
  co-joined tables** — forces expensive network data movement (a
  "broadcast" or "redistribute" step) on every join.
- **Loading via one giant file instead of many** — serializes COPY onto
  a single slice, wasting the cluster's parallelism.
- **Choosing interleaved sort keys without a genuinely multi-column,
  unpredictable filter pattern** — pays reorganization cost for no
  benefit over compound.
- **No max RPU ceiling set on Redshift Serverless** — an unexpectedly
  expensive runaway query can scale cost with no upper bound.
- **Manual WLM queues left static as workload composition shifts** —
  queries queue up behind an outdated queue configuration; auto-WLM
  avoids this drift.
- **Treating Redshift as an OLTP database** — frequent single-row
  transactional writes fight the columnar, MPP-batch-oriented design.

<a name="examtraps"></a>
## 23. Exam traps

⚠️ **"Two large tables joined frequently on the same column, slow
join" = KEY distribution on that column**, not ALL (ALL is only for
small dimension tables) and not EVEN.

⚠️ **"Queries always filter starting with date" = compound sort key
led by the date column**, not interleaved.

⚠️ **"Unpredictable, spiky query workload, avoid capacity planning" =
Redshift Serverless.** "Steady, predictable, high-concurrency, always-on"
= provisioned RA3 (often with Reserved Instances for cost).

⚠️ **VACUUM/ANALYZE are largely automatic now** — don't pick an answer
that proposes scheduling manual nightly VACUUM as a required best
practice; that's outdated framing.

⚠️ **"Query S3 data occasionally without loading it" = Redshift
Spectrum**, not "COPY it in first."

<a name="interview"></a>
## 24. Interview questions

- *"How would you diagnose and fix a slow join between two large fact
  tables in Redshift?"* Strong answer: check `EXPLAIN` for a
  redistribution/broadcast step; if present, align both tables'
  distribution style to KEY on the shared join column so matching rows
  co-locate on the same slice, eliminating the shuffle.
- *"When would you choose Redshift Spectrum over loading data into
  Redshift?"* Strong answer: when the data is queried infrequently, or
  is so large that loading it wholesale isn't cost-effective relative to
  its actual query frequency — Spectrum trades some per-query scan cost
  for zero load time/storage duplication.
- *"How do you control cost risk on Redshift Serverless?"* Strong
  answer: set a maximum RPU capacity ceiling to bound runaway query
  cost, and rely on auto-pause during idle periods rather than running
  a provisioned cluster continuously for spiky workloads.

<a name="cheatsheet"></a>
## 25. Cheat sheet

| If the scenario says... | Reach for... |
|---|---|
| unpredictable/spiky query workload, avoid capacity planning | Redshift Serverless |
| steady, predictable, high-concurrency, always-on | Provisioned RA3 (+ Reserved Instances) |
| large tables frequently joined on the same column | KEY distribution |
| small dimension table joined often | ALL distribution |
| no clear dominant join key | EVEN or AUTO distribution |
| queries filter starting with a leading date/ID column | Compound sort key |
| unpredictable multi-column filtering | Interleaved sort key (rare) |
| slow single-file load | Split into multiple files for parallel COPY |
| query S3 data occasionally, no load | Redshift Spectrum |
| multiple teams need live access to shared data, isolated compute | Data sharing |
| dashboard queries recomputing the same aggregation | Materialized view |
| burst of concurrent read queries backing up queues | Concurrency scaling |
| write transformed data for Athena/EMR without export step | Write directly to Iceberg tables |
| memory/concurrency tuning across mixed workloads | Auto-WLM (manual WLM only for hard isolation needs) |

<a name="mnemonics"></a>
## 26. Memory tricks

**"KEY co-locates, ALL duplicates, EVEN spreads"** — the one-line
distribution style summary. **"Compound for the usual, interleaved for
the unpredictable"** — sort key choice in one phrase. **"AUTO first,
override only with a reason"** — Redshift's modern default philosophy
for both distribution and sort keys.

---

<a name="practice"></a>
## 27. Practice questions (15)

**Q1.** Two 500-million-row fact tables are joined daily on
`customer_id`, and `EXPLAIN` shows a costly network redistribution step
before the join. What is the most direct fix?

A) Change both tables to ALL distribution
B) Set both tables' distribution style to KEY on `customer_id`
C) Add a compound sort key on `customer_id`
D) Increase the cluster's concurrency scaling limit

**Answer: B.** KEY distribution on the shared join column co-locates
matching rows on the same slice, eliminating the redistribution step.
(A) ALL distribution replicates the entire table to every node — wildly
wasteful for 500-million-row tables, intended only for small dimension
tables. (C) sort keys affect scan/filter efficiency, not join data
placement. (D) concurrency scaling addresses queue backlog under
concurrent load, not a single query's join cost.

**Q2.** A dashboard team's queries always filter with `WHERE
event_date >= ...` as the first predicate, sometimes combined with other
filters. Which sort key configuration is most appropriate?

A) Interleaved sort key on all filtered columns equally
B) Compound sort key led by `event_date`
C) No sort key; rely on distribution style alone
D) ALL distribution style instead of a sort key

**Answer: B.** A compound sort key led by the consistently-leading
filter column (`event_date`) maximizes zone-map block skipping for the
dominant access pattern. (A) interleaved is for unpredictable,
non-leading multi-column filtering — unnecessary maintenance cost here.
(C) skipping a sort key forfeits zone-map pruning entirely. (D)
distribution style and sort keys solve different problems; one doesn't
substitute for the other.

**Q3.** A team needs a data warehouse for a workload with highly
unpredictable query volume — near-zero most of the day, with occasional
large bursts — and wants to avoid ongoing capacity planning. What should
they choose?

A) A provisioned RA3 cluster with Reserved Instances
B) Redshift Serverless
C) A DC2 node-type provisioned cluster
D) Redshift Spectrum only, with no cluster

**Answer: B.** Serverless auto-scales RPUs to match demand and
auto-pauses during idle time, removing manual capacity planning — the
direct fit for unpredictable, spiky usage. (A) Reserved Instances commit
to a fixed capacity, best for steady predictable workloads, the opposite
of this scenario. (C) DC2 is an older, non-RA3 node type without
RMS-style compute/storage decoupling and still requires capacity
planning. (D) Spectrum-only has no native table storage for a full
warehouse workload.

**Q4.** A single 50 GB CSV file loaded via COPY into Redshift takes far
longer than expected. What is the most likely cause and fix?

A) The cluster needs more nodes
B) A single file forces the load onto one slice; splitting into multiple files enables parallel COPY
C) The distribution style must be changed to EVEN
D) VACUUM needs to be run before loading

**Answer: B.** COPY parallelizes across slices only when the source is
split into multiple files; one large file serializes the load onto a
single slice regardless of cluster size. (A) more nodes don't help if
the load itself can't be parallelized due to file count. (C)
distribution style affects query/join behavior, not raw load
parallelism. (D) VACUUM addresses space reclamation/re-sorting after
data changes, unrelated to initial load speed.

**Q5.** Which Redshift feature allows querying data that resides in S3
directly, without first loading it into the cluster?

A) UNLOAD
B) Redshift Spectrum
C) Data sharing
D) Concurrency scaling

**Answer: B.** Spectrum queries S3 data directly via external tables
registered in the Glue Data Catalog, without a load step. (A) UNLOAD
moves data *out* of Redshift to S3, the opposite direction. (C) data
sharing provides live access to another Redshift cluster's data, not S3
directly. (D) concurrency scaling adds transient compute capacity,
unrelated to querying S3.

**Q6.** A company wants three business units to each run their own
independent compute against the same live central dataset without
copying it, so no unit's heavy analytical load impacts another's query
performance. Which Redshift feature fits?

A) Redshift Spectrum
B) Data sharing
C) Materialized views
D) Elastic resize

**Answer: B.** Data sharing provides live, no-copy access to a
dataset from separate clusters/workgroups (including cross-account),
letting each unit use isolated compute against the same underlying
data. (A) Spectrum targets S3 data, not sharing between Redshift
clusters. (C) materialized views pre-compute results within one
cluster; they don't solve cross-cluster isolation. (D) elastic resize
changes a single cluster's node count, unrelated to multi-team
isolation.

**Q7.** Which statement about VACUUM and ANALYZE on modern Redshift is
accurate?

A) They must always be scheduled manually every night for correctness
B) Redshift now runs automatic background table maintenance (auto-vacuum, auto-analyze) for most routine needs
C) They are deprecated and no longer available in any form
D) They only apply to Redshift Serverless, not provisioned clusters

**Answer: B.** Modern Redshift performs this maintenance automatically
in the background during low-load periods, covering most routine needs;
manual intervention is now the exception (e.g., right after an unusually
large bulk operation), not the default requirement. (A) is the outdated
assumption. (C) they still exist and can be run manually when needed.
(D) automatic maintenance applies broadly, not exclusively to
Serverless.

**Q8.** A dashboard repeatedly runs the same expensive multi-table
aggregation query, and the team wants to avoid recomputing it from
scratch on every dashboard refresh. What should they use?

A) A materialized view over the aggregation
B) Increase WLM queue concurrency
C) Switch the underlying tables to EVEN distribution
D) Enable concurrency scaling

**Answer: A.** A materialized view pre-computes and stores the result,
refreshing automatically or on schedule, so the dashboard reads a
precomputed result instead of recomputing it. (B) queue concurrency
affects how many queries run at once, not per-query recomputation cost.
(C) distribution style affects join/scan efficiency, not whether a
result is precomputed. (D) concurrency scaling adds burst capacity but
still recomputes the query each time.

**Q9.** A Redshift Serverless workgroup unexpectedly generated a very
high bill after an inefficient, unbounded query ran for hours. What
should have been configured to bound this risk?

A) A maximum RPU capacity ceiling
B) Manual WLM queues
C) A larger base RPU capacity
D) Redshift Spectrum

**Answer: A.** Setting a maximum RPU capacity limits how far
Serverless can scale up for any single workload, bounding worst-case
cost exposure. (B) manual WLM queues are a provisioned-cluster concept
for resource allocation, not a Serverless cost ceiling. (C) a larger
base capacity increases baseline cost without bounding a runaway
query's scale-up. (D) Spectrum is unrelated to Serverless cost
governance.

**Q10.** Which distribution style is most appropriate for a small,
frequently-joined `dim_date` dimension table with only a few thousand
rows?

A) KEY on the date column
B) EVEN
C) ALL
D) AUTO with no override needed, but if forced to choose explicitly, ALL is correct

**Answer: C (with D acknowledging AUTO would likely also choose ALL
for a table this small).** ALL distribution replicates the small
table to every node, so every join against it is local with no network
shuffle — ideal given its small size and frequent-join usage. (A) KEY
distribution is for large tables joined on a specific column, not a
small dimension table. (B) EVEN spreads rows without join locality
benefit, worse than ALL here. In an exam single-answer format, select
the option explicitly stating ALL.

**Q11.** A team needs Redshift's transformed output to be immediately
readable by both Athena and EMR without a separate export/load step.
What capability satisfies this most directly?

A) UNLOAD to CSV, then crawl with Glue
B) Redshift writing directly to Apache Iceberg tables in S3
C) Redshift Spectrum
D) Cross-Region snapshot copy

**Answer: B.** Redshift's direct-write capability to Iceberg tables
lets other Iceberg-aware engines (Athena, EMR) read the same tables
immediately without a separate export step. (A) works but is exactly
the roundabout, extra-step approach the newer capability replaces. (C)
Spectrum is for Redshift *reading* S3 data, not writing output for
other engines to consume. (D) snapshot copy is a DR/backup mechanism,
unrelated to sharing transformed data with other query engines.

**Q12.** Which WLM approach best fits a requirement that ETL jobs must
never be able to starve interactive dashboard queries of memory, under
any circumstance, and the team is willing to maintain the configuration?

A) Auto-WLM
B) Manual WLM with dedicated queues and guaranteed memory allocation per workload type
C) Concurrency scaling alone
D) Redshift Serverless with a single default queue

**Answer: B.** Manual WLM lets you carve out guaranteed, isolated
memory/concurrency per queue (e.g., a dedicated ETL queue and a
dedicated dashboard queue), providing the hard isolation guarantee the
requirement demands. (A) auto-WLM dynamically shares resources based on
observed need — good default, but doesn't provide a hard guarantee
against one workload starving another. (C) concurrency scaling adds
burst capacity but doesn't isolate workloads from each other. (D)
Serverless doesn't expose the same manual queue isolation model.

**Q13.** Which best describes how Redshift Managed Storage (RMS) with
RA3 nodes changes capacity planning compared to older, local-disk node
types?

A) Storage and compute must always be scaled together in fixed ratios
B) Storage scales automatically and independently of compute node count
C) RMS eliminates the need for any compute nodes
D) RMS only applies to Redshift Serverless

**Answer: B.** RA3 + RMS decouples storage (durable, S3-backed,
auto-scaling) from compute (node count, resized independently) — you
can add compute for more query concurrency without needing to
repartition or move data. (A) describes the older, coupled local-disk
node model RA3 moves away from. (C) compute nodes are still required to
run queries; RMS just changes where durable storage lives. (D) RMS is
an RA3 (provisioned) storage architecture; Serverless has its own
distinct capacity model (RPUs).

**Q14.** A query joining a Redshift native table with a Spectrum
external table over S3 data runs slower than expected on the S3 side.
What is the most relevant lever to improve Spectrum performance?

A) Increase the cluster's node count
B) Partition and use a columnar format (e.g., Parquet) for the S3 data, enabling predicate pushdown and partition pruning
C) Change the native table's sort key
D) Enable concurrency scaling

**Answer: B.** Spectrum performance and cost are driven by how much S3
data must be scanned; partitioned, columnar (Parquet) source data lets
Spectrum prune irrelevant partitions and skip unneeded columns,
directly reducing scan volume. (A) Spectrum's scan compute is separate
from cluster node capacity — more nodes doesn't speed up the S3-side
scan. (C) sort keys apply to native Redshift tables, not S3 external
data. (D) concurrency scaling addresses query queuing under load, not
per-query S3 scan efficiency.

**Q15.** Which scenario is the clearest signal that Redshift is the
wrong choice and a different service should be used instead?

A) A BI team needs fast aggregate queries across 2 billion rows of curated sales data
B) An application needs to perform thousands of single-row inserts and updates per second with millisecond latency
C) Multiple teams need isolated compute against a shared curated dataset
D) A team needs to combine S3-resident and warehouse-resident data in one query

**Answer: B.** High-frequency, single-row OLTP-style writes are a poor
fit for Redshift's columnar, MPP-batch-oriented design — that's a job
for DynamoDB, RDS, or Aurora. (A), (C), and (D) are all core Redshift
strengths (columnar aggregate performance, data sharing, and Spectrum,
respectively).
