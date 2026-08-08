# Domain 2 — Data Store Management (26%)

> Task statements: **2.1** Choose a data store · **2.2** Understand data
> cataloging systems · **2.3** Manage the lifecycle of data · **2.4**
> Design data models and schema evolution.
>
> ~17 of 65 questions. Second-largest domain after Ingestion &
> Transformation. This is where "pick the right database" and "design
> it so it doesn't fall over in production" both get tested.

## CONTENTS

- [Part 0 — Domain overview, the 8-step pass](#p0)
- [Master guard rails](#guardrails)
- [Task 2.1 — Choose a data store](#t21)
  - [2.1.1 Implement appropriate storage services](#211)
  - [2.1.2 Configure storage for access patterns](#212)
  - [2.1.3 Apply storage services to use cases](#213)
  - [2.1.4 Integrate migration tools](#214)
  - [2.1.5 Data migration and remote access](#215)
  - [2.1.6 Manage locks](#216)
  - [2.1.7 Manage open table formats](#217)
  - [2.1.8 Vector index types](#218)
- [Task 2.2 — Understand data cataloging systems](#t22)
  - [2.2.1 Use data catalogs](#221)
  - [2.2.2 Build a technical catalog](#222)
  - [2.2.3 Use Glue crawlers](#223)
  - [2.2.4 Synchronize partitions](#224)
  - [2.2.5 Create catalog connections](#225)
  - [2.2.6 Business catalogs](#226)
- [Task 2.3 — Manage the lifecycle of data](#t23)
  - [2.3.1 Load/unload between S3 and Redshift](#231)
  - [2.3.2 Manage S3 lifecycle policies](#232)
  - [2.3.3 Expire data](#233)
  - [2.3.4 Versioning and TTL](#234)
  - [2.3.5 Delete data for compliance](#235)
  - [2.3.6 Protect data — resiliency and availability](#236)
- [Task 2.4 — Design data models and schema evolution](#t24)
  - [2.4.1 Design schemas for Redshift, DynamoDB, Lake Formation](#241)
  - [2.4.2 Address changes to data characteristics](#242)
  - [2.4.3 Perform schema conversion](#243)
  - [2.4.4 Establish data lineage](#244)
  - [2.4.5 Indexing, partitioning, compression best practices](#245)
  - [2.4.6 Vectorization concepts](#246)
- [Mnemonics](#mnemonics)
- [Domain 2 cheat sheet](#cheatsheet)
- [Practice question bank — 40 questions](#questions)

---

<a name="p0"></a>
## PART 0 — Domain overview, the 8-step pass

### Step 1 — Explain like I'm 12

Imagine you're organizing your whole life's stuff. Some things you need
in your pocket **right now** (your phone — that's DynamoDB). Some
things live in filing cabinets you check often for reports (that's
Redshift). Some things go in a giant storage unit because they're cheap
to keep and you rarely need them fast (that's S3). You wouldn't keep
your phone in the storage unit, and you wouldn't try to stuff a
filing cabinet in your pocket. Domain 2 is entirely about picking the
right container for the right stuff — and then labeling the storage
unit (cataloging) so you can still find things in five years
(lifecycle), and making sure the filing system doesn't collapse when
you add a new folder type (schema evolution).

### Step 2 — Explain technically

Domain 2 tests **polyglot persistence**: the discipline of choosing a
purpose-built data store per workload instead of forcing everything
into one general-purpose database. AWS gives you roughly a dozen
storage engines, each with a different consistency model, latency
profile, cost curve, and query capability. The exam checks whether you
can map a described **access pattern** (not a described *dataset*) to
the correct engine, configure that engine for the stated performance
and cost constraints, catalog it so downstream consumers can discover
it, keep it alive and compliant over its lifetime, and model its
schema so that it survives the business changing its mind next quarter.

### Step 3 — Explain like a Senior AWS Data Engineer

A senior engineer does not ask "what database should I use?" as a
first question. They ask, in order:

1. **What does the consumer actually do with this data?** Point
   lookup by key? Range scan? Multi-table join? Full-text search?
   Nearest-neighbor similarity? Sequential scan for a nightly report?
2. **What's the latency budget?** Single-digit milliseconds and
   everything relational is off the table except Aurora/RDS with
   heavy caching, or you're in DynamoDB/MemoryDB territory.
3. **What's the write pattern?** High-frequency small writes want
   DynamoDB or Kinesis-fed streaming stores. Bulk nightly loads want
   Redshift COPY or S3 + Iceberg MERGE.
4. **Who is the audience and how many of them are there
   concurrently?** Ten analysts running ad-hoc queries → Athena. Five
   hundred dashboard viewers hitting refresh every 30 seconds →
   Redshift, because Athena's concurrency quota will choke.
5. **What does "done" cost, not just what does "up and running" cost?**
   A provisioned Redshift cluster sitting idle 20 hours a day is a
   worse answer than Serverless even though the per-hour sticker price
   looks similar on a spec sheet.

The senior engineer also treats **the data store choice as reversible
by default and irreversible only when it has to be** — which is why
data lake formats (Iceberg on S3) have become the default landing
zone: you can point five different compute engines at the same Iceberg
table without committing to one warehouse vendor's storage format.

### Step 4 — Explain production architecture

```
                         POLYGLOT PERSISTENCE — a real retail platform
                         ==========================================

  Web/Mobile App
       |
       v
  +-------------+        +----------------+       +------------------+
  |  DynamoDB   |<------>|   ElastiCache/ |       |  Aurora           |
  |  (cart,     |        |   MemoryDB     |       |  PostgreSQL       |
  |  sessions)  |        |  (session      |       |  (orders, ERP,    |
  +-------------+        |   cache)       |       |   inventory)      |
       |                 +----------------+       +------------------+
       |  DynamoDB Streams                                |
       v                                                   |  CDC / zero-ETL
  +-------------+                                          v
  |   Lambda    |----------------------------------> +------------------+
  |  (enrich)   |                                     |  S3 Data Lake    |
  +-------------+                                     |  (Iceberg tables,|
                                                        |  bronze/silver/  |
                                                        |  gold)           |
                                                        +------------------+
                                                              |
                                            +----------------+----------------+
                                            v                                 v
                                    +---------------+                +----------------+
                                    |   Athena      |                |   Redshift      |
                                    | (ad-hoc SQL)  |                | (BI dashboards, |
                                    +---------------+                |  Spectrum over   |
                                                                      |  S3 for archive) |
                                                                      +----------------+
                                                                              |
                                                                              v
                                                                      +----------------+
                                                                      |  QuickSight     |
                                                                      +----------------+
```

Reading the diagram: the **web/mobile app** writes cart and session
state into **DynamoDB** because those reads/writes need single-digit
millisecond latency at unpredictable scale. A **MemoryDB/ElastiCache**
layer sits beside it for the hottest session lookups. Order and ERP
data — which needs multi-table joins, foreign keys, and ACID
transactions — lives in **Aurora PostgreSQL**. **DynamoDB Streams**
feeds a **Lambda** function that enriches events in near real time.
Order data reaches the **S3 data lake** through **CDC or a zero-ETL
integration** rather than nightly batch, so the lake stays current
within seconds to minutes. The lake stores data as **Apache Iceberg
tables** organized bronze (raw) → silver (cleaned/conformed) → gold
(business-ready, aggregated) — this layering is the answer whenever a
question asks how to organize a lake for both raw fidelity and
analyst-ready output. Two independent query engines read the *same*
Iceberg tables without copying data: **Athena** for occasional
analyst SQL, and **Redshift** (via Spectrum) for scheduled BI
dashboards feeding **QuickSight**. No single engine owns the data —
that's the point of an open table format.

### Step 5 — Exam traps (domain-wide)

⚠️ **"The data is in S3" does not mean "the answer is Athena."** Access
pattern and concurrency decide, not location. Five hundred concurrent
dashboard users against S3 data still often means Redshift Spectrum,
not Athena.

⚠️ **"NoSQL" does not automatically mean DynamoDB is right.** If the
access pattern needs full-text search, that's OpenSearch. If it needs
graph traversal, that's Neptune. If it needs a MongoDB-compatible API
for a lift-and-shift, that's DocumentDB.

⚠️ Every option that proposes **`Scan` on DynamoDB for analytics** is
wrong. The correct pattern is export-to-S3 (consumes no RCUs) then
Athena/Redshift Spectrum/EMR.

⚠️ Distractors love **retired or renamed services**: Amazon
Elasticsearch Service (say **OpenSearch Service**), Glue Elastic Views
(discontinued — never pick it), AWS Data Pipeline as a live
orchestrator (retired).

### Step 6 — Interview questions (domain-wide)

**Q: "Walk me through how you'd choose a data store for a new
feature."**
A strong answer names the access pattern first, then latency budget,
then concurrency/scale, then cost model — in that order — and only
then names a service. A weak answer starts with "I'd use DynamoDB
because it's fast," which skips the actual reasoning.

**Q: "Tell me about a time a data store choice turned out to be
wrong. What did you do?"**
Good answers describe a *reversible* architecture — e.g., data landed
in S3/Iceberg first, so swapping the query engine (Athena → Redshift)
didn't require re-ingesting anything. This is exactly why "land in S3
first, decide the warehouse later" is such a common senior-level
instinct and such a common right answer on this exam.

**Q: "How do you keep a data catalog from going stale?"**
Strong answer: crawlers or `MSCK REPAIR TABLE` for partition sync,
ownership/lineage tooling for business meaning, automated schema
evolution — not a manually maintained spreadsheet.

### Step 7 — Cheat sheet

See [the full Domain 2 cheat sheet](#cheatsheet) at the end of this
file — it consolidates every sub-skill into one scan-in-90-seconds
table.

### Step 8 — Memory tricks

See [Mnemonics](#mnemonics). The headline one for this whole domain:

> **"Access pattern first, entity-relationship second."** Every wrong
> answer in Domain 2 comes from designing the *storage* before asking
> how the data will be *read*.

---

<a name="guardrails"></a>
## MASTER GUARD RAILS — apply these five questions to every Domain 2 scenario

| # | Question | If the answer points to... | Then think... |
|---|---|---|---|
| 1 | **Access pattern?** | Key lookup / Range scan / Complex join / Full-text / Vector similarity / Sequential scan | DynamoDB / DynamoDB+SK / Aurora-Redshift / OpenSearch / Aurora+pgvector or OpenSearch vector / Athena-S3 |
| 2 | **Latency budget?** | Single-digit ms / Low ms / Sub-second-seconds / Minutes | DynamoDB(+DAX)/MemoryDB / Aurora / Redshift / S3+Athena |
| 3 | **Data volume?** | GB / TB (structured) / TB-PB (analytics) / PB (lake) | Aurora / DynamoDB / Redshift / S3 |
| 4 | **SQL or NoSQL?** | Relational, joins, ACID / Key-value, flexible schema / Analytical SQL at scale | Aurora/RDS / DynamoDB / Redshift |
| 5 | **Cost sensitivity / access frequency?** | Always-hot / Occasionally accessed / Rarely accessed / Legally must keep, rarely touch | Standard tier / IA tier / Glacier / Glacier Deep Archive |

```
                         THE FIVE-QUESTION FUNNEL
                         ========================

  Q1: What does the READER do with this data?
        |
        +--> Point lookup by known key -----------------> DynamoDB
        +--> Multi-table joins, transactions -------------> Aurora / RDS
        +--> Aggregate millions of rows for BI ------------> Redshift
        +--> Occasional ad-hoc SQL, data sits in S3 -------> Athena
        +--> Full-text / log search -----------------------> OpenSearch
        +--> Similarity / semantic search ------------------> Aurora+pgvector
        |                                                     or OpenSearch
        +--> Graph traversal (fraud rings, social) ----------> Neptune
        +--> Cache / leaderboard / sub-ms ------------------> MemoryDB / DAX
        +--> Just land it cheaply, unknown future use -------> S3
```

Walking the funnel: start at **Q1** every time — it is the single
highest-signal question the exam stem gives you, almost always in the
form of a verb ("look up," "join," "aggregate," "search," "traverse").
Everything else (Q2–Q5) narrows *which flavor* of that engine
(provisioned vs serverless, which storage class, which index type) —
but Q1 picks the *engine family*, and picking the wrong family is the
mistake that eliminates an answer outright.

---

<a name="t21"></a>
## TASK 2.1 — CHOOSE A DATA STORE

<a name="211"></a>
### 2.1.1 Implement appropriate storage services for cost/performance requirements

#### Master data store matrix

| Attribute | **S3** | **Redshift** | **DynamoDB** | **Aurora / RDS** |
|---|---|---|---|---|
| **Model** | Object store | Columnar MPP warehouse | Key-value / document | Relational (OLTP) |
| **Best for** | Data lake, raw/archive, ML training data | BI, enterprise reporting, star-schema analytics | Shopping cart, session, gaming, IoT metadata | ERP, CRM, banking, order processing |
| **Latency** | ~100 ms first byte | Sub-second–seconds | **Single-digit ms** (µs w/ DAX) | Low ms |
| **Query language** | None (needs Athena/EMR) | SQL (full, MPP) | Key access + PartiQL (limited) | Full SQL |
| **Joins** | Via query engine | ✅✅ Optimized | ❌ | ✅ |
| **Petabyte scale** | ✅✅ | ✅ (RA3 + RMS) | ✅ (but not analytics-shaped) | ❌ Practical ceiling ~128 TB |
| **Cost model** | $/GB-month + requests | Node-hours or RPU-hours | RCU/WCU or on-demand | Instance-hours + storage |
| **Serverless option** | ✅ Native | ✅ Redshift Serverless | ✅ On-demand mode | ✅ Aurora Serverless v2 |
| **Transactional (ACID)** | ❌ (unless Iceberg) | ✅ | ⚠️ Item-level / TransactWriteItems | ✅✅ Full ACID |
| **Exam favorite trigger** | "durable, cheap, any format, data lake" | "BI dashboards, hundreds of analysts" | "millions of req/sec, sub-ms" | "transactional workload," "existing MySQL/PostgreSQL app" |

#### Per-service deep dive

**Amazon S3**
- **Purpose:** the default landing zone and long-term home for
  virtually all data at any scale — structured, semi-structured, or
  unstructured.
- **When to use:** data lakes, raw ingestion landing zones, ML
  training sets, log archives, anything that will be queried by a
  separate compute engine (Athena, EMR, Redshift Spectrum), backups.
- **When NOT to use:** you need transactional updates at row
  granularity without an open table format layered on top; you need
  sub-millisecond point lookups; you need relational joins natively.
- **Advantages:** 11 nines durability, virtually unlimited scale, the
  cheapest cost-per-GB of any AWS storage, decouples storage from
  compute so you can point Athena, EMR, Redshift Spectrum, and
  SageMaker at the same objects without copying data.
- **Limitations:** eventual behavior around some replication features
  (though same-region PUT/GET is strongly consistent since Dec 2020);
  no native row-level updates without a table format; per-prefix
  request-rate limits (though very high — ~5,500 GET/3,500 PUT per
  second per prefix, and this scales horizontally by adding prefixes).
- **Pricing considerations:** storage class, request count, and data
  transfer all bill separately; the storage-class lifecycle strategy
  (see 2.3.2) is the single biggest cost lever in the whole domain.
- **Performance:** effectively unlimited aggregate throughput because
  requests parallelize across many prefixes/objects; single-object GET
  latency is roughly 100 ms unless using S3 Express One Zone
  (single-digit ms).
- **Scaling:** automatic and horizontal — no provisioning step.
- **Security:** bucket policies, IAM, Lake Formation for fine-grained
  table/column/row permissions on top, SSE-S3/SSE-KMS/DSSE-KMS
  encryption, VPC gateway endpoints (free) for private access.
- **High availability:** 99.99% availability SLA for Standard;
  cross-region replication (CRR) and same-region replication (SRR)
  for DR, both require versioning enabled.
- **Failure scenarios:** accidental overwrite/delete without
  versioning = permanent data loss; a bucket policy misconfiguration
  can silently deny an entire pipeline; millions of tiny objects
  degrade query-engine performance even though S3 itself handles them
  fine.
- **Common mistakes:** using S3 as if it were a database (trying to do
  row-level updates by rewriting entire objects); ignoring the
  small-file problem; not enabling versioning before it's needed.
- **Exam traps:** "data is in S3, therefore Athena" — false, see
  guard rail Q1; "S3 offers 100% availability" — false, it's 99.99%
  for Standard, durability (11 nines) is a *different* number from
  availability.
- **Real enterprise examples:** Netflix stores encoded video renditions
  and clickstream logs in S3 as the foundation of its entire analytics
  stack; a healthcare provider lands HL7/FHIR message archives in S3
  for both real-time processing and 7-year HIPAA retention in one
  bucket with tiered lifecycle rules.

**Amazon Redshift**
- **Purpose:** MPP (massively parallel processing) columnar data
  warehouse for BI, reporting, and large-scale SQL analytics.
- **When to use:** recurring dashboards, hundreds of concurrent
  analysts, complex multi-table joins over terabytes-to-petabytes,
  workloads that benefit from materialized views and result caching.
- **When NOT to use:** OLTP (row-by-row transactional writes), rare/
  unpredictable one-off queries (idle cluster cost — use Athena or
  Redshift Serverless instead), sub-100ms latency requirements.
- **Advantages:** columnar storage + zone maps give fast aggregation;
  massively parallel query execution across nodes/slices; **RA3**
  nodes decouple compute from storage (Redshift Managed Storage);
  **Redshift Spectrum** queries S3 directly; **data sharing** exposes
  live data cross-cluster/cross-account with no copy; **Redshift
  Serverless** removes capacity planning entirely.
- **Limitations:** not designed for high-frequency single-row
  transactional writes; concurrency, while good, is not infinite
  (concurrency scaling adds transient clusters, 1 free hour of credit
  per cluster per 24 hours); large `ALTER TABLE`/DDL operations and
  long-running updates can lock and stall a workload.
- **Pricing considerations:** provisioned = node-hours (Reserved
  Instances save up to ~75%); Serverless = RPU-hours, scales to zero
  when idle. A steady 24/7 heavy workload is usually cheaper
  provisioned+RI; a spiky/unpredictable workload is usually cheaper
  Serverless.
- **Performance:** driven by **distribution style** (data placement
  across nodes — minimizes shuffling on joins) and **sort key**
  (accelerates range filters via zone maps). Getting these wrong is
  the #1 real-world Redshift performance complaint and a top exam
  trap.
- **Scaling:** elastic resize (fast, changes node count within the
  same family), classic resize (slower, changes node type), and
  concurrency scaling (adds transient clusters automatically during
  bursts).
- **Security:** IAM/DB-user auth, row-level security, dynamic data
  masking, column-level grants, KMS encryption at rest, TLS in
  transit, VPC + Lake Formation integration for lake-adjacent tables.
- **High availability:** Multi-AZ deployments for RA3, automated
  snapshots, cross-region snapshot copy for DR.
- **Failure scenarios:** a `DISTKEY` chosen on a low-cardinality
  column causes severe data skew — one node does most of the work
  while others idle; loading via one giant file instead of a number of
  files that's a multiple of slice count serializes the load onto one
  slice.
- **Common mistakes:** treating Redshift like an OLTP database (lots
  of small single-row `UPDATE`/`INSERT` statements); forgetting `VACUUM`
  and `ANALYZE` after heavy deletes/inserts; picking interleaved sort
  keys "because it sounds more powerful" when compound sort keys fit
  the actual filter pattern.
- **Exam traps:** "Spot on all node types" doesn't apply here (that's
  EMR) but the *equivalent* trap is "use DISTKEY on every column" —
  wrong, pick one key aligned to the dominant join. Also: Athena vs
  Redshift is decided by **access pattern**, not by "the data happens
  to be in S3."
- **Real enterprise examples:** a bank's finance team runs nightly
  regulatory reporting across years of transaction history in
  Redshift with RA3 + Spectrum reaching further back into S3-archived
  data than the warehouse retains locally; an e-commerce company uses
  Redshift Serverless for a marketing analytics workload that's
  intense during launch weeks and nearly idle otherwise.

**Amazon DynamoDB**
- **Purpose:** fully managed, serverless key-value/document database
  built for single-digit-millisecond latency at any scale.
- **When to use:** shopping carts, session state, user profiles,
  gaming leaderboards, IoT device state, anything where the access
  pattern is "get this item by its key" at high, unpredictable
  throughput.
- **When NOT to use:** ad-hoc analytical queries, multi-table joins,
  complex aggregations, anything where the access patterns aren't
  known up front (DynamoDB modeling requires access-pattern-first
  design — see 2.4.1).
- **Advantages:** consistent single-digit ms latency regardless of
  scale, virtually unlimited storage and throughput, on-demand mode
  removes capacity planning entirely, **DynamoDB Streams** enables
  event-driven architectures, **Global Tables** give multi-region
  active-active replication.
- **Limitations:** 400 KB item size limit; no native joins; secondary
  indexes are eventually consistent (GSI) unless you design around it;
  query flexibility is fundamentally constrained by the chosen
  partition/sort key.
- **Pricing considerations:** on-demand (pay-per-request) suits spiky/
  unpredictable traffic; provisioned + auto-scaling suits steady,
  predictable traffic and is cheaper at volume; **export-to-S3
  consumes zero RCUs** — the correct way to analyze DynamoDB data
  without touching application capacity.
- **Performance:** RCU = 1 strongly consistent 4 KB read/sec (2 for
  eventually consistent); WCU = 1 KB write/sec; hot partitions
  (skewed key access) are the most common real-world throttling cause.
- **Scaling:** automatic partition splitting; Global Tables for
  cross-region.
- **Security:** IAM with fine-grained, even item-level, conditions;
  encryption at rest by default (KMS); VPC gateway endpoint (free).
- **High availability:** Multi-AZ by default within a region; Global
  Tables for multi-region active-active; **PITR** gives 35-day
  continuous backup.
- **Failure scenarios:** a poorly chosen partition key (e.g., a status
  flag with only 3 values) creates a hot partition that throttles
  regardless of overall table capacity; running `Scan` for analytics
  against a live production table degrades application latency for
  real users.
- **Common mistakes:** designing the schema from an entity-relationship
  diagram instead of from access patterns; adding a **GSI** after the
  fact when a **LSI** was actually needed (LSIs must be defined at
  table creation — you cannot retrofit one).
- **Exam traps:** "analyze DynamoDB data without affecting application
  performance" → export to S3, then Athena — never Scan; GSI is
  eventually consistent by default, LSI can be strongly consistent but
  is capped at 10 GB per partition key and must exist at creation.
- **Real enterprise examples:** a gaming company stores real-time
  leaderboards and player session state in DynamoDB with DAX in front
  for microsecond reads during tournament spikes; a logistics company
  tracks parcel status updates from millions of IoT scanners with
  DynamoDB Streams triggering Lambda for real-time customer
  notifications.

**Amazon Aurora / RDS**
- **Purpose:** managed relational database for transactional (OLTP)
  workloads needing full SQL, joins, and ACID guarantees.
- **When to use:** application backends, ERP/CRM systems, banking
  transaction processing, anything with a genuinely relational data
  model and the need for multi-row/multi-table transactions.
- **When NOT to use:** petabyte-scale analytics (practical ceiling is
  much lower than Redshift/S3), extreme write throughput beyond a
  single writer's capacity (though Aurora Limitless Database targets
  this gap), key-value access patterns better served by DynamoDB.
- **Advantages:** Aurora separates compute from a distributed,
  self-healing storage layer replicated across 3 AZs (6 copies);
  up to 15 low-latency read replicas; **Aurora Serverless v2** scales
  compute automatically for variable workloads; MySQL/PostgreSQL
  wire-compatible so existing tooling and drivers work unchanged;
  **Aurora PostgreSQL + pgvector** adds vector similarity search to a
  familiar relational engine.
- **Limitations:** still fundamentally a single-writer architecture
  per cluster (aside from Aurora Limitless/multi-master variants);
  not built for OLAP-scale full-table scans; storage auto-grows but
  compute vertical scaling has practical ceilings.
- **Pricing considerations:** instance-hours + storage + I/O (Aurora
  I/O-Optimized removes per-I/O charges for I/O-heavy workloads);
  Aurora Serverless v2 bills per ACU-second, ideal for variable/
  intermittent load.
- **Performance:** read replicas offload read traffic; connection
  pooling (RDS Proxy) prevents connection exhaustion under Lambda-
  driven bursty traffic.
- **Scaling:** read replicas for read scaling, Aurora Serverless v2 for
  automatic compute scaling, storage auto-scales up to the engine
  ceiling.
- **Security:** IAM database authentication, KMS encryption at rest,
  TLS in transit, Secrets Manager for automatic credential rotation,
  VPC security groups.
- **High availability:** Multi-AZ standard with automated failover in
  under 30 seconds typically; cross-region read replicas for DR.
- **Failure scenarios:** a single long-running transaction holding
  locks blocks other writers (see 2.1.6); missing indexes on join/
  filter columns turn simple queries into full table scans as data
  grows.
- **Common mistakes:** indexing every column "to be safe" (each index
  slows every write); not using RDS Proxy under high-concurrency
  serverless callers, leading to connection storms.
- **Exam traps:** "transactional workload" or "existing MySQL/
  PostgreSQL app" almost always signals Aurora/RDS, not DynamoDB, even
  if the question also mentions "scale."
- **Real enterprise examples:** a bank runs core ledger and payment
  processing on Aurora PostgreSQL for ACID guarantees with read
  replicas serving the mobile app's account-balance screen; a SaaS
  CRM vendor migrates from self-managed MySQL to Aurora MySQL for
  automated failover and reduced operational burden.

<a name="212"></a>
### 2.1.2 Configure storage services for specific access patterns

| Access pattern | Correct store | Configuration detail |
|---|---|---|
| Key lookup by known ID | DynamoDB | Partition key = the ID; add GSI for alternate lookups |
| Range query ("orders between two dates for a customer") | DynamoDB | Partition key = CustomerID, sort key = OrderDate |
| SQL transactions, joins | Aurora / RDS | Indexes on filter/join columns, connection pooling |
| Warehouse aggregation across billions of rows | Redshift | Distribution + sort keys tuned to dominant query shape |
| Historical/occasional SQL over S3 | Athena | Partition on filter columns, Parquet + compression |
| Petabyte data lake landing zone | S3 | Prefix design for parallelism, lifecycle rules |
| Full-text / log search | OpenSearch | Index mappings, shard count sized to data volume |
| Sub-millisecond cache | MemoryDB / DAX | In front of the primary store, not a replacement for it |

**Worked example:** *"An application must retrieve a customer's full
order history sorted by date, and separately must retrieve all orders
with status = PENDING across all customers."* This needs **two access
patterns** from one table: partition key `CustomerID` + sort key
`OrderDate` handles the first; a **GSI** with partition key
`OrderStatus` (+ sort key `OrderDate`) handles the second. This is the
canonical "why do I need a GSI" exam scenario — one base table can only
efficiently serve the access pattern baked into its primary key.

⚠️ **Exam trap:** if the second access pattern needed to exist at
table-creation time and needed strong consistency, the answer would be
an **LSI**, not a GSI — but LSIs cannot be added later, so if the
question implies the pattern was discovered after the table already
existed in production, GSI is the only legal answer regardless of
consistency preference.

<a name="213"></a>
### 2.1.3 Apply storage services to appropriate use cases

**Amazon MemoryDB for Redis**
- **Purpose:** durable, in-memory, Redis-compatible database for
  workloads that need both microsecond reads *and* durability (unlike
  a pure cache, MemoryDB is a primary data store).
- **When to use:** session stores, real-time leaderboards, gaming
  state, caching layers where losing data on a node failure is
  unacceptable.
- **When NOT to use:** as a system of record for relational data;
  when eventual consistency across a cache is fine (plain ElastiCache
  is cheaper).
- **Advantages:** sub-millisecond latency, Multi-AZ durability
  (unlike ElastiCache for Redis without cluster mode considerations),
  Redis API compatibility.
- **Limitations:** in-memory pricing is higher per GB than disk-based
  stores; not a query engine for analytics.
- **Exam trap:** a question describing "leaderboard, must survive a
  node failure without data loss" wants **MemoryDB**, not plain
  ElastiCache — the durability requirement is the tell.
- **Real enterprise example:** a mobile gaming studio uses MemoryDB for
  live tournament leaderboards updated thousands of times per second.

**Aurora PostgreSQL + pgvector (vector search)**
- **Purpose:** semantic/similarity search inside a familiar relational
  engine, by storing embeddings as a native `vector` column type.
- **When to use:** RAG (retrieval-augmented generation), chatbots,
  recommendation engines, semantic document search — especially when
  the team already runs PostgreSQL and wants vector search alongside
  relational data rather than in a separate system.
- **When NOT to use:** enterprise-scale full-text + vector hybrid
  search at massive index sizes (OpenSearch's vector engine scales
  further); when there's no existing relational data to join against.
- **Architecture:** `Documents -> Embedding model -> Aurora PostgreSQL
  (vector column) -> ANN index (HNSW/IVF) -> Nearest-neighbor query`.
- **Exam trap:** the exam expects you to know pgvector supports both
  **HNSW** and **IVFFlat** index types — see 2.1.8 for the trade-off.
- **Real enterprise example:** a customer-support SaaS company builds a
  chatbot that retrieves similar past tickets via pgvector similarity
  search joined against the same Aurora database's structured ticket
  metadata.

**Amazon OpenSearch Service**
- **Purpose:** distributed search and analytics engine (successor
  name to "Amazon Elasticsearch Service" — never use the old name on
  this exam).
- **When to use:** full-text search, log analytics dashboards
  (Kibana-style), and — via the OpenSearch vector engine — large-scale
  vector similarity search.
- **When NOT to use:** as a system of record; for simple key-value
  lookups (DynamoDB is cheaper and simpler); for classic relational
  reporting (Redshift fits better).
- **Real enterprise example:** an IoT platform indexes device log
  streams in OpenSearch for operators to search and build real-time
  operational dashboards.

**Amazon Kendra**

> Added to the DEA-C01 in-scope services list in the December 2025 exam
> guide revision (v1.1).

- **Purpose:** fully managed, ML-powered **enterprise search** service
  — point it at documents, FAQs, wikis, and other unstructured content
  and it answers **natural-language questions** with a ranked answer
  plus the source document, not just a list of keyword matches.
- **When to use:** enterprise search portals/intranets, internal
  knowledge-base search, customer-support document search — anywhere
  the requirement is phrased as "let users ask a question in plain
  English and get an answer," with minimal search-relevance tuning or
  index management effort from the team.
- **When NOT to use:** operational log search/analytics dashboards
  (OpenSearch is purpose-built for that); embedding-similarity search
  over vectors for a RAG pipeline you're assembling yourself (that's
  vector search — pgvector/OpenSearch vector engine/Bedrock Knowledge
  Bases); anywhere you need full control over indexing/ranking logic.
- **Exam trap:** a scenario asking for **"natural-language Q&A over
  internal documents with minimal setup"** is pointing at **Kendra**,
  not OpenSearch — OpenSearch is the trap answer the exam likes to set
  here, since both involve "search," but OpenSearch requires you to
  build and tune the relevance/indexing yourself, while Kendra ships
  the ML ranking and question-answering behavior out of the box.
- **Real enterprise example:** a large enterprise IT help desk deploys
  Kendra over its internal runbooks and wiki so employees can type "how
  do I reset my VPN certificate?" and get a direct answer with a link
  to the source runbook, instead of manually keyword-searching a wiki.

**Search and retrieval, side by side:**

| | Amazon Kendra | Amazon OpenSearch Service | Vector search (pgvector / HNSW / Bedrock KB) |
|---|---|---|---|
| **Purpose** | ML-powered natural-language enterprise search | Operational/log search and analytics | Semantic similarity search over embeddings |
| **Query style** | Ask a question in plain English | Keyword/structured query (Query DSL) | Nearest-neighbor over vector embeddings |
| **Setup effort** | Low — managed relevance/ranking out of the box | Higher — you design indices, mappings, relevance tuning | Moderate — you choose embedding model + index type (HNSW/IVF) |
| **Typical use case** | Enterprise search portal, intranet, support-doc Q&A | Log analytics dashboards, custom search apps | RAG pipelines, chatbots, recommendation engines |
| **Control** | Least — mostly point-and-index | Most — full control of indexing/ranking | High — you control embedding model and index |
| **Exam favorite trigger** | "Ask a question in natural language over documents, minimal setup" | "Full-text search," "log analytics," "Kibana-style dashboard" | "Semantic/similarity search," "RAG," "embeddings" |

**Amazon DocumentDB, Neptune, Timestream, Keyspaces** (recognize-level,
★ depth per the exam guide — know the one-line trigger and move on):

| Service | Compatible with | Trigger phrase |
|---|---|---|
| **DocumentDB** | MongoDB API | "MongoDB-compatible," lift-and-shift a MongoDB app |
| **Neptune** | Gremlin / SPARQL / openCypher | "graph relationships," "fraud rings," "social network" |
| **Timestream** ⚠️ | Purpose-built time-series | "time-series sensor data at scale," automatic tiering |
| **Keyspaces** | Cassandra CQL API | "Cassandra-compatible," serverless Cassandra |

⚠️ **Timestream currency note:** AWS has been winding **Timestream for
LiveAnalytics** down for new customers. Treat it as **recognize-only**
on this exam — know what it's for if a question names it or describes
its trigger phrase — rather than as a service you'd actively recommend
in a "design a new pipeline" scenario. If the question is just testing
recognition ("which service stores time-series sensor data with
automatic tiering?"), Timestream can still be the intended answer.

<a name="214"></a>
### 2.1.4 Integrate migration tools into data processing systems

| Tool | Purpose | Trigger |
|---|---|---|
| **AWS Transfer Family** | Managed SFTP/FTPS/FTP endpoint backed by S3/EFS | "partners upload via SFTP," legacy file-transfer replacement |
| **AWS DataSync** | Online, ongoing sync between on-prem storage (NFS/SMB) and AWS | "ongoing file sync from on-prem NAS," scheduled incremental transfer |
| **AWS Snow Family** | Physical devices for offline bulk transfer | "petabytes, limited or no network bandwidth" |
| **AWS AppFlow** | No-code integration with SaaS APIs | "Salesforce/Zendesk/Slack/ServiceNow data into S3/Redshift" |

```
Partner (legacy SFTP client)
     |
     |  SFTP
     v
AWS Transfer Family  ------->  S3 bucket  ------->  Glue crawler  ------->  Catalog
```

Reading this: the partner keeps using an SFTP client they already
have — no code changes on their end. **Transfer Family** is a managed
SFTP/FTPS/FTP server that AWS operates; it writes incoming files
straight to **S3**. A **Glue crawler** then discovers the schema of
whatever landed and registers it in the **Data Catalog** so Athena/
Redshift Spectrum/Glue jobs can query it immediately. The exam favorite
pairing is "legacy trading-partner file transfer + minimal
re-engineering" → Transfer Family.

⚠️ **Exam trap:** DataSync is for **ongoing, scheduled** transfer of
files that already live in a POSIX or SMB filesystem on-prem. Snow
Family is for a **one-time, offline, bandwidth-constrained** bulk
move. Picking DataSync when the scenario says "no network connectivity
available" is wrong — that's Snowball/Snowcone territory.

<a name="215"></a>
### 2.1.5 Implement data migration or remote access methods

This sub-skill is explicitly named in the exam guide: **Redshift
federated query, Redshift data sharing, Athena federated query.**

#### Redshift Spectrum vs Federated Query vs Materialized View vs Data Sharing

| Attribute | **Redshift Spectrum** | **Redshift Federated Query** | **Materialized View** | **Redshift Data Sharing** |
|---|---|---|---|---|
| **Purpose** | Query S3 data directly from Redshift SQL | Query a live operational database (Aurora/RDS) from Redshift SQL | Pre-compute and cache a query result | Share live data across Redshift clusters/accounts, no copy |
| **Data location** | Stays in S3 | Stays in Aurora/RDS | Stored inside Redshift | Stays in the producer cluster's storage |
| **Requires existing cluster** | ✅ | ✅ | ✅ | ✅ (both sides) |
| **Freshness** | As current as S3 | **Live**, real-time | As of last refresh (auto or manual) | Live |
| **Cost model** | ~$5/TB scanned (Spectrum) | Per-query, cross-engine | Storage + refresh compute | No data movement/copy cost |
| **Best use case** | Join hot warehouse tables to a cold S3 archive | Enrich a warehouse query with live operational data, skip ETL entirely | Speed up a repeated expensive aggregation | Give another team/account live access without duplicating data |
| **When NOT to use** | No Redshift cluster exists (use Athena) | Data is static/historical (just load it) | Underlying data changes every second and staleness is unacceptable | Data must be physically isolated per compliance |
| **Exam favorite** | "join current warehouse data with S3 archive" | "no ETL pipeline, need live operational data in a warehouse query" | "same expensive dashboard query runs repeatedly" | "share a dataset with another business unit without copying it" |

```
DECISION TREE — Spectrum vs Federated Query vs Materialized View
==================================================================

  Where does the data you need to reach LIVE right now?
        |
        +--> In S3, and Redshift already exists -----------> SPECTRUM
        |
        +--> In Aurora/RDS, and it must be LIVE -------------> FEDERATED QUERY
        |    (no ETL step acceptable)
        |
        +--> Already inside Redshift, but the SAME
        |    expensive query keeps re-running -----------------> MATERIALIZED VIEW
        |
        +--> Needs to be READ by another cluster/account,
             without copying it ---------------------------------> DATA SHARING
```

Walking the tree: the first fork asks *where the source data
currently sits*. If it's in S3 and you already have a Redshift
cluster, **Spectrum** lets you `JOIN` warehouse tables to S3 data in
one SQL statement without an ETL step. If the source is a live
transactional database and staleness is unacceptable, **Federated
Query** reaches into Aurora/RDS directly — the answer whenever a
question says "without building a pipeline" and the source is
operational. If the expensive part is a *repeated aggregation over
data already in Redshift*, a **Materialized View** caches the result
and refreshes on a schedule or trigger — this is a cost/performance
lever, not a data-location lever. If the requirement is *cross-
cluster or cross-account access without copying data*, **Data
Sharing** is the only option in this list built for that; Spectrum and
Federated Query both still require the querying cluster to reach out
live each time, whereas Data Sharing is optimized for that exact
access model between two Redshift environments.

**Athena Federated Query**
- **Purpose:** query non-S3 data sources (RDS, DynamoDB, JDBC sources,
  CloudWatch Logs, DocumentDB, and more) directly from Athena SQL via
  Lambda-based data source connectors, without moving the data.
- **When to use:** "join Athena's S3 data against an operational
  DynamoDB or RDS table" or "run one SQL query across S3 and a
  relational database with the least operational overhead."
- **When NOT to use:** high-frequency, low-latency operational
  queries — the connector adds Lambda invocation overhead; heavy
  sustained analytical load against the source system (this can
  overload an operational database not sized for analytics).
- **Exam trap:** Athena Federated Query and Redshift Federated Query
  sound identical but connect to different source types and via
  different mechanisms (Lambda connector vs native database
  connectivity) — don't swap them in an answer.

<a name="216"></a>
### 2.1.6 Manage locks to prevent access conflicts

**Aurora / RDS locking**

```
Transaction 1: UPDATE orders SET status='SHIPPED' WHERE order_id=100;
                    |
                    v
              (row lock held until COMMIT)
                    |
Transaction 2: UPDATE orders SET status='CANCELLED' WHERE order_id=100;
                    |
                    v
              BLOCKS until Transaction 1 commits or rolls back
```

Reading the diagram: Transaction 1 acquires a row-level lock the
instant it starts its `UPDATE`. Transaction 2, trying to modify the
*same row*, must wait — this is correct, expected relational
behavior, not a bug. The problem only appears when Transaction 1 is
long-running (waiting on application logic, an open connection idle in
a transaction, or a slow downstream call before committing), which
holds the lock far longer than necessary and creates a queue of
blocked writers behind it.

- **Mitigations tested on the exam:** keep transactions short, commit
  as soon as the logical unit of work is done, index the columns used
  in `WHERE` clauses so lookups within the transaction are fast, choose
  an appropriate **isolation level** (Read Committed is the common
  default; Serializable gives the strongest guarantees but the most
  contention), and avoid holding a transaction open while waiting on
  an external network call.
- **Common mistake:** opening a transaction, calling an external API,
  and only then committing — the lock is held for the entire network
  round-trip.

**Redshift locking**

Redshift's concerns are different because it's not built for
high-frequency single-row OLTP writes: long-running `UPDATE`/`DELETE`
statements and large `ALTER TABLE`/DDL operations can hold table-level
locks that block *all* other queries against that table, including
reads in some cases. The mitigation is architectural: avoid running
Redshift as if it were a transactional database — batch writes,
avoid frequent single-row `UPDATE`s, and schedule DDL changes during
low-traffic windows.

**DynamoDB "locking" (optimistic concurrency)**

DynamoDB doesn't use traditional row locks. Instead, the exam expects
you to know **conditional writes** and **optimistic locking via a
version attribute**:

```
GET item  -> read current version = 5
UPDATE item SET data=..., version=6 WHERE version=5
             |
             +--> succeeds if version was still 5 (nobody else wrote)
             +--> fails (ConditionalCheckFailedException) if someone
                  else already bumped it to 6 -- retry the read+write
```

This is the correct pattern for "prevent two users from overwriting
each other's changes to the same DynamoDB item" — a condition
expression on the write, not a lock held over time.

<a name="217"></a>
### 2.1.7 Manage open table formats

> ⚠️ **This is one of the highest-yield topics on the entire exam.**
> AWS explicitly calls out Apache Iceberg support across Athena, Glue,
> EMR, Redshift, and native **S3 Tables**.

#### Why Hive-style tables broke down

```
                    TRADITIONAL HIVE-STYLE TABLE ON S3
                    ===================================

  s3://lake/sales/year=2026/month=08/day=07/part-0001.parquet
  s3://lake/sales/year=2026/month=08/day=07/part-0002.parquet
  ...

  PROBLEM 1: Delete one customer's rows (GDPR)?
             -> must rewrite the ENTIRE PARTITION.

  PROBLEM 2: Merge in daily CDC changes?
             -> full reload, or manual overwrite-and-hope.

  PROBLEM 3: Query "as of last Tuesday"?
             -> impossible; there is no versioning of table state.

  PROBLEM 4: Rename a column?
             -> breaks every downstream query referencing the old name.

  PROBLEM 5: Change partitioning scheme (day -> hour)?
             -> rewrite ALL existing data.

  PROBLEM 6: Two jobs write to the same partition at once?
             -> real risk of corruption; no concurrency control.

  PROBLEM 7: Millions of partitions?
             -> S3 LIST operations become painfully slow, catalog
                sync (MSCK REPAIR) takes forever.
```

#### What Apache Iceberg fixes

| Problem | Iceberg mechanism |
|---|---|
| Row-level delete/update (GDPR) | ✅ `DELETE`/`UPDATE`/`MERGE INTO` at the row level |
| CDC merges | ✅ `MERGE INTO` upsert semantics |
| Time travel | ✅ Every write creates an immutable **snapshot**; query `AS OF` a snapshot or timestamp |
| Schema evolution | ✅ Add, drop, rename, reorder, widen columns **without rewriting data** |
| Partition evolution | ✅ Change the partitioning scheme going forward **without rewriting historical data** |
| Concurrent writers | ✅ Optimistic concurrency control with snapshot isolation |
| Metadata scale | ✅ Metadata files (manifest lists → manifests → data files) replace slow S3 LIST |
| **Hidden partitioning** | ✅ Users query by logical column (e.g., `event_date`); Iceberg maps to the physical partition transparently — no need to know the physical layout |

```
                    ICEBERG SNAPSHOT / TIME TRAVEL MODEL
                    =====================================

  Snapshot 1 (Jan)  --> Snapshot 2 (Feb, +new column) --> Snapshot 3 (Mar, row deletes)
        |                       |                                |
        v                       v                                v
   metadata.json  ------>  metadata.json  ------------>   metadata.json (current)
        |                       |                                |
   manifest list          manifest list                    manifest list
        |                       |                                |
   data files              data files (old + new)           data files (+ delete files)

  SELECT * FROM sales FOR SYSTEM_VERSION AS OF 2   -- read Snapshot 2's exact state
  SELECT * FROM sales FOR SYSTEM_TIME AS OF '2026-02-15'  -- time-based travel
```

Reading the diagram: every write to an Iceberg table (insert, update,
delete, schema change) produces a **new immutable snapshot** rather
than mutating existing files in place. Each snapshot points to a
manifest list, which points to manifests, which point to the actual
data files (and, for deletes, delete files marking which rows are
logically removed without rewriting the original file). Because old
snapshots are retained until explicitly expired, you can query the
table **as it existed at any prior snapshot or timestamp** — this is
time travel, and it's also what makes rollback trivial (point the
table back at an older snapshot).

- **Purpose:** an open table format that adds database-like
  guarantees (ACID, schema evolution, time travel) on top of files
  sitting in S3, usable by multiple independent compute engines.
- **When to use:** any lake table that needs updates, deletes,
  upserts/CDC merges, schema evolution, or auditability/rollback;
  by 2026 this is the **default** recommendation for new lake tables
  in AWS-native architectures.
- **When NOT to use:** truly write-once, append-only, simple datasets
  where the operational overhead of table-format metadata isn't
  justified (rare on the exam — Iceberg is usually still fine here
  too, but a simpler Hive table is a legitimate lower-overhead choice
  when nothing in the requirement needs Iceberg's features).
- **Advantages:** listed above — this is the entire point of the
  format.
- **Limitations:** requires **compaction** maintenance (small files
  and accumulated delete files degrade query performance over time
  without periodic `rewrite_data_files`/`OPTIMIZE` jobs); adds
  metadata management overhead versus a plain Hive table; not every
  legacy tool speaks Iceberg natively yet.
- **Pricing considerations:** you still pay standard S3 storage plus
  compute for whichever engine queries it (Athena per-TB-scanned,
  Redshift/EMR by cluster or Serverless usage); metadata files add a
  small additional storage cost, generally negligible next to the
  savings from not rewriting whole partitions.
- **Performance:** hidden partitioning + partition evolution avoid the
  classic "wrong partition scheme chosen at day one, stuck with it
  forever" problem; well-compacted Iceberg tables perform comparably
  to well-organized Parquet/Hive tables for reads, while enabling
  operations Hive simply cannot do.
- **Scaling:** scales with S3 itself; metadata design specifically
  targets the "millions of partitions" scaling wall that plain Hive
  tables hit.
- **Security:** governed the same way as any lake table — Lake
  Formation permissions, S3 encryption, IAM.
- **High availability:** inherits S3's durability; snapshot retention
  gives an additional layer of recoverability (rollback to a prior
  snapshot after a bad write).
- **Failure scenarios:** skipping compaction leads to "small file"
  and "too many delete files" performance decay; expiring snapshots
  too aggressively removes the ability to time-travel or roll back a
  bad write.
- **Common mistakes:** treating Iceberg tables like Hive tables and
  never running compaction; not understanding that schema evolution is
  **metadata-only** (people sometimes assume, incorrectly, that it
  still requires a rewrite).
- **Exam traps:** any question describing GDPR-style row deletion,
  CDC merge into a lake, time travel, or safe concurrent writers on
  S3-based tables is pointing at **Iceberg**; a "Hive-style partition"
  answer in 2026 is very likely the *wrong* choice when the scenario
  needs any of those things. AWS's own **Lake Formation governed
  tables** feature has been superseded by Iceberg — don't pick
  governed tables as the modern answer.
- **Real enterprise examples:** a telecom uses Iceberg's row-level
  delete to satisfy GDPR right-to-be-forgotten requests against a
  petabyte-scale customer event lake without a multi-hour partition
  rewrite; a retailer merges daily CDC changes from its order system
  into a gold-layer Iceberg sales table with `MERGE INTO`, replacing a
  fragile "drop and reload the whole partition" nightly job.

#### Amazon S3 Tables — the managed way to run Iceberg on S3

> Added to the DEA-C01 in-scope services list in the December 2025 exam
> guide revision (v1.1). Given how central Iceberg already is to this
> exam, treat S3 Tables as a natural extension of the material above,
> not a separate topic to memorize independently.

**What it is:** a distinct **S3 bucket type** — a "table bucket" —
purpose-built to store Apache Iceberg tables, as opposed to a regular
general-purpose S3 bucket that happens to hold Iceberg data/metadata
files you manage yourself. Everything above about Iceberg (snapshots,
schema evolution, time travel, row-level delete/update/merge) still
applies — S3 Tables doesn't change the table format, it changes **who
operates the maintenance work the format requires**.

```
        SELF-MANAGED ICEBERG                    S3 TABLES (MANAGED)
        ON GENERAL-PURPOSE S3                    (table bucket)
        ======================                   ===================

  s3://my-lake/db/sales/...              s3tables://.../sales/...
        |                                         |
        v                                         v
  YOU run compaction jobs                 AWS AUTOMATICALLY runs:
  YOU expire old snapshots                 - compaction
  YOU tune Intelligent-Tiering             - snapshot expiration/cleanup
  YOU register the table in                - Intelligent-Tiering
    Glue Data Catalog                       - catalog registration
        |                                         |
        v                                         v
  Query from Athena/EMR/Redshift          Query from Athena/EMR/Redshift/
  (after you wire up the catalog)          Glue Data Catalog/SageMaker —
                                            catalog integration is automatic
```

Reading the diagram: with a regular S3 bucket holding Iceberg files,
the operational burden (compaction, snapshot cleanup, storage-tiering,
catalog wiring) is entirely on you — the same responsibilities called
out as "Limitations" and "Failure scenarios" for Iceberg above. With an
**S3 Tables** table bucket, AWS runs that maintenance automatically in
the background, and the table is discoverable through the Glue Data
Catalog and queryable from Athena, EMR, Redshift, and SageMaker without
you manually registering or wiring up a catalog integration.

- **Purpose:** remove the operational overhead of running Iceberg
  yourself — automatic compaction, automatic snapshot/orphan-file
  cleanup, automatic S3 Intelligent-Tiering, and native replication,
  bundled into the storage layer itself.
- **When to use:** new Iceberg tables where the team wants Iceberg's
  capabilities (upsert, time travel, schema evolution) **without**
  building or operating a compaction/cleanup pipeline; a "least
  operational overhead" or "fully managed table maintenance" phrase in
  a scenario is a strong signal for S3 Tables specifically, not just
  "Iceberg" in the abstract.
- **When NOT to use:** you already have an existing Iceberg catalog
  outside AWS (e.g., a self-hosted or third-party Iceberg REST catalog
  spanning multi-cloud tooling) and need to keep using your own
  catalog and maintenance jobs for compatibility; or you need
  fine-grained control over exactly when/how compaction and snapshot
  expiration run rather than accepting AWS's automated policy.
- **Advantages:** automatic compaction and snapshot cleanup (no cron
  job or Glue job needed to keep the table healthy), automatic
  Intelligent-Tiering, native replication, and direct integration with
  Athena/EMR/Redshift/Glue Data Catalog/SageMaker without manual
  catalog registration.
- **Limitations:** less low-level control than self-managing the
  Iceberg files/catalog yourself; adopting S3 Tables means adopting
  AWS's managed maintenance policy rather than a fully custom one.
- **Exam trap:** a question naming **"least operational overhead,"
  "automatic maintenance," or "automatic compaction"** for an Iceberg
  table on S3 is pointing at **S3 Tables** specifically — not at "just
  store Iceberg files in a regular S3 bucket," which is the DIY
  version requiring you to run compaction/cleanup jobs yourself. If the
  scenario instead emphasizes integrating with an existing non-AWS
  Iceberg catalog or needing full manual control, self-managed Iceberg
  on general-purpose S3 is the better fit.

<a name="218"></a>
### 2.1.8 Describe vector index types

> ⚠️ Missing from most 2023-era material; explicitly named in the
> current exam guide (**HNSW** and **IVF**). Highest-yield alongside
> Iceberg for "new since your original notes."

#### HNSW vs IVF

| Attribute | **HNSW** (Hierarchical Navigable Small World) | **IVF** (Inverted File Index) |
|---|---|---|
| **Recall accuracy** | **Higher** | Lower |
| **Query speed** | **Fast** | Fast |
| **Memory use** | **High** | Lower |
| **Index build time** | **Longer** | Shorter |
| **Best for** | RAG, semantic search, AI assistants where accuracy matters most | Larger datasets where memory/build-time budget is tight and slightly lower recall is acceptable |
| **Exam favorite** | "RAG," "knowledge base," "AI assistant," "semantic retrieval" | Cost/memory-constrained large-scale scenarios |

```
DECISION TREE — Vector storage and index choice
=================================================

  Do you need vector search alongside RELATIONAL data you already
  query with SQL?
        |
        +--> YES --> Aurora PostgreSQL + pgvector
        |              |
        |              +--> Need highest recall (RAG accuracy matters most)? --> HNSW
        |              +--> Need faster build / lower memory at large scale? --> IVFFlat
        |
        +--> NO, need enterprise-scale dedicated search/vector engine
        |    (hybrid full-text + vector, huge index sizes) --> OpenSearch Service
        |    vector engine
        |
        +--> Want a fully managed RAG pipeline, minimal build effort
             --> Amazon Bedrock Knowledge Bases
                 (handles chunking, embedding, vector store, and
                  retrieval orchestration for you)
```

- **Purpose:** enable **approximate nearest neighbor (ANN)** search
  over high-dimensional embedding vectors, powering semantic/
  similarity search rather than exact keyword matching.
- **When to use HNSW:** accuracy-critical retrieval (RAG answer
  quality, AI assistant grounding) where the extra memory and build
  time are acceptable trade-offs for better recall.
- **When to use IVF:** very large vector datasets where memory
  footprint or index build time is the binding constraint and slightly
  lower recall is tolerable.
- **Vector storage options and when each wins:**

| Option | Best for |
|---|---|
| **Aurora PostgreSQL + pgvector** | Small/medium scale, vector search alongside existing relational data, teams already on PostgreSQL |
| **OpenSearch Service vector engine** | Enterprise-scale search, hybrid keyword + vector queries, existing OpenSearch investment |
| **Amazon Bedrock Knowledge Bases** | Fully managed end-to-end RAG — chunking, embedding, storage, and retrieval handled for you |
| **Third-party vector DB** | Specialized workloads with requirements none of the above meet |

- **Exam trap:** don't confuse the **index type** (HNSW/IVF — an
  algorithm choice within a vector store) with the **vector store
  choice** (pgvector vs OpenSearch vs Bedrock Knowledge Bases — a
  service choice). A question can test either independently.
- **Real enterprise example:** a healthcare knowledge-management team
  builds a clinical-guideline chatbot on Bedrock Knowledge Bases (fully
  managed RAG) so they don't operate an embedding pipeline themselves;
  a fintech builds semantic search over support tickets directly in
  Aurora PostgreSQL with pgvector + HNSW because the tickets already
  live in that same database.

---

<a name="t22"></a>
## TASK 2.2 — UNDERSTAND DATA CATALOGING SYSTEMS

<a name="221"></a>
### 2.2.1 Use data catalogs to consume data from the data source

A catalog stores **metadata about data, not the data itself**: table
names, column names and types, partition locations, file formats, and
where the underlying files physically live.

```
   S3 (actual data files)
        |
        |  crawled / registered
        v
   AWS Glue Data Catalog (metadata: schema, partitions, location)
        |
        |  consumed by
        v
   Athena  /  Redshift Spectrum  /  EMR (Spark/Hive)  /  Glue ETL jobs
```

Reading the diagram: the data files themselves never move — they stay
in S3. The **Glue Data Catalog** holds a pointer plus a schema
description. Every downstream engine (Athena, Redshift Spectrum, EMR)
reads that same catalog entry instead of each engine maintaining its
own private copy of "what does this table look like." That's the
entire value proposition: **one metadata layer, many compute
engines**, no duplicated schema definitions to keep in sync.

- **Senior engineer note:** a catalog is only useful if it's kept
  current. A catalog with stale partition information causes queries
  to silently miss data (new partitions the catalog doesn't know
  about) rather than erroring — this is a much more dangerous failure
  mode than an outright error, and it's why 2.2.3/2.2.4 (crawlers and
  partition sync) matter as much as they do on the exam.

<a name="222"></a>
### 2.2.2 Build a technical data catalog

| Catalog | Managed by | Used by | When it's the answer |
|---|---|---|---|
| **AWS Glue Data Catalog** | AWS, serverless | Athena, EMR, Redshift Spectrum, Glue, Lake Formation | Default technical metadata layer — the answer almost every time on this exam |
| **Hive Metastore (self-managed)** | You (on EMR or EC2) | Hadoop/Spark ecosystem tools | "Migrating an existing Hadoop cluster's metastore," legacy Hadoop-ecosystem compatibility |
| **SageMaker Catalog / Amazon DataZone** | AWS, serverless | Business users, data mesh | Business metadata, ownership, discovery — see 2.2.6 |

⚠️ **Exam trap:** the Glue Data Catalog can act as a **Hive-metastore-
compatible** endpoint, meaning EMR/Spark jobs written against Hive
metastore APIs can point at the Glue Catalog instead of running their
own metastore. Any question about "reduce operational overhead of
maintaining a Hive metastore" wants **Glue Data Catalog**, not a
self-managed metastore on EC2/EMR.

<a name="223"></a>
### 2.2.3 Discover schemas and use Glue crawlers to populate catalogs

```
S3 data (unknown/changing schema)
        |
        v
   Glue Crawler  ---(classifiers infer format & schema)--->  Glue Data Catalog
        |                                                          |
        +--> scheduled to re-run on a cadence -------------------->+
              (detects new partitions, schema drift)
```

Reading the diagram: a **crawler** connects to a data source (S3,
JDBC, DynamoDB), samples the data, applies **classifiers** to infer
format (CSV, JSON, Parquet, ORC...) and schema, and writes or updates
the corresponding table definition in the **Data Catalog**. Running it
on a schedule means new partitions and evolving schemas are picked up
automatically rather than requiring a human to update table
definitions by hand.

- **When to use:** unknown or evolving schemas, onboarding a new data
  source, keeping a table definition current as upstream data drifts.
- **When NOT to use:** a known, stable, high-partition-count dataset
  where you'd rather define the table once (`CREATE EXTERNAL TABLE` or
  Terraform/CDK) and use **partition projection** instead of paying
  for repeated crawler runs (see 2.2.4) — running crawlers constantly
  against a huge, stable table is wasted cost.
- **Common mistake:** running a crawler on every single ingestion
  instead of on a sensible schedule, driving up cost without added
  benefit once the schema has stabilized.
- **Exam trap:** "millions of partitions, avoid crawler cost" is the
  signature phrase for **partition projection**, not "run the crawler
  more often."

<a name="224"></a>
### 2.2.4 Synchronize partitions with a data catalog

**The problem:** new data lands in a new S3 partition
(`.../year=2026/month=08/day=07/`), but the catalog doesn't know that
partition exists yet — queries against the table silently skip that
data.

| Fix | How it works | When to use |
|---|---|---|
| **Glue crawler (scheduled/on-demand)** | Re-scans and adds new partitions to the catalog | General purpose, works for any source |
| **`MSCK REPAIR TABLE`** (Athena/Hive) | Scans the table's S3 location and adds any partitions matching the expected directory structure | One-off manual repair, smaller partition counts (slow at huge scale) |
| **`ALTER TABLE ... ADD PARTITION`** | Explicitly registers one partition | Precise, scriptable, good inside an ETL job right after it writes new data |
| **Athena partition projection** | Catalog computes partition locations from a defined pattern **instead of storing them at all** — no sync step needed | Predictable partition naming schemes (date-based, sequential) at very large partition counts |

⚠️ **Exam trap:** `MSCK REPAIR TABLE` becomes painfully slow at very
large partition counts (it lists S3 to discover partitions). The
"millions of partitions" phrasing is the cue for **partition
projection**, which removes the sync problem entirely by calculating
partition locations algorithmically rather than looking them up.

<a name="225"></a>
### 2.2.5 Create new source or target connections for cataloging

Glue **connections** store the information (JDBC URL, credentials via
Secrets Manager, VPC/subnet/security group) needed to reach a data
source or target for crawling and ETL.

```
Glue Connection (JDBC: host, port, credentials-from-Secrets-Manager,
                 VPC config)
        |
        v
   Oracle / MySQL / PostgreSQL / SQL Server / S3 / DynamoDB
        |
        v
   Glue Crawler  -->  Data Catalog table
   Glue ETL job  -->  reads/writes through the same connection
```

- **Sources commonly tested:** Oracle, MySQL, PostgreSQL, SQL Server,
  S3, DynamoDB, MongoDB/DocumentDB.
- **Security note:** connections should reference **Secrets Manager**
  for credentials rather than embedding them — a recurring exam
  pattern across Domains 2 and 4.
- **Common mistake:** forgetting the VPC/subnet/security-group
  configuration on the connection when the source database lives in a
  private subnet — the crawler or job then times out trying to reach
  it.

<a name="226"></a>
### 2.2.6 Business catalogs — data classification and discovery

AWS references **SageMaker Catalog** (built on **Amazon DataZone**)
for the *business* layer that sits above the technical catalog.

```
Business analyst
        |
        v
  SageMaker Catalog / DataZone  --(search, request access, see owner,
                                    lineage, glossary terms)-->
        |
        v
  Underlying technical assets (Glue Catalog tables, Redshift tables,
  S3 locations) governed by Lake Formation permissions
```

- **Purpose:** business metadata — ownership, glossary terms,
  data classification (e.g., "PII," "financial," "public"), lineage,
  and a publish/subscribe workflow for requesting access — layered on
  top of the technical Glue Catalog.
- **When to use:** organizations practicing data mesh, cross-team data
  sharing at scale, or needing a searchable business-friendly asset
  catalog instead of raw table names.
- **When NOT to use:** a small team where the Glue Catalog alone is
  sufficient and there's no cross-team discovery problem to solve.
- **Mental model to memorize:** the **Glue Data Catalog** says *what
  the data is* (schema, location, format). **Lake Formation** says
  *who may see which parts of it* (permissions). **SageMaker
  Catalog/DataZone** says *who owns it, what it means to the
  business, and how to request access to it*.
- **Exam trap:** "business users discover datasets and request access
  through a catalog" is the SageMaker Catalog/DataZone trigger, not
  "just add more IAM policies."
- **Real enterprise example:** a large retailer's data mesh setup lets
  the marketing team publish a "customer lifetime value" dataset to
  DataZone with an owner, description, and classification tag;
  the finance team discovers and requests access to it without ever
  filing an IT ticket to find out the underlying table name.

---

<a name="t23"></a>
## TASK 2.3 — MANAGE THE LIFECYCLE OF DATA

<a name="231"></a>
### 2.3.1 Perform load and unload operations between S3 and Redshift

```
S3 (files)  ----COPY---->  Redshift table
Redshift table  ----UNLOAD---->  S3 (files)
```

**COPY**
- **Purpose:** the fastest, correct way to bulk-load data into
  Redshift — it loads in parallel across all node slices.
- **Best practice:** split source files into a **number of files that
  is a multiple of the number of slices**, each roughly 1 MB–1 GB
  compressed, so every slice does an even share of work. One giant
  file forces one slice to do all the work while the rest sit idle.
- **Common mistake:** loading via single-row `INSERT` statements
  instead of `COPY` — this is dramatically slower and is a reliable
  "why is my load so slow" exam scenario.
- **Exam trap:** `COPY` from S3 can automatically decompress
  (gzip/bzip2/Zstandard) and validate against the target schema; a
  question emphasizing "fastest possible bulk load" always wants
  `COPY`, never row-by-row inserts, never Glue for a task that's
  purely "get files from S3 into Redshift as fast as possible."

**UNLOAD**
- **Purpose:** export query results from Redshift back to S3 in
  parallel, typically as compressed, optionally partitioned files —
  the correct mechanism for "archive old Redshift data to S3" or
  "make Redshift data available to Athena/other consumers."
- **Common mistake:** running a `SELECT` and manually exporting results
  from a client tool for large datasets — slow and not parallelized;
  `UNLOAD` is parallel and far faster at scale.
- **Real enterprise example:** an insurance company `UNLOAD`s
  policy-year data older than 3 years from Redshift into partitioned
  Parquet files in S3, then drops it from the warehouse to shrink
  cluster storage cost, while keeping it queryable via Spectrum.

<a name="232"></a>
### 2.3.2 Manage S3 lifecycle policies to change storage tiers

```
Day 0     ─── S3 Standard
Day 30    ─── transition to S3 Standard-IA (or One Zone-IA if reproducible)
Day 90    ─── transition to Glacier Flexible Retrieval (or Instant Retrieval)
Day 365   ─── transition to Glacier Deep Archive
Day 2555  ─── (7 years) expire / delete
```

Each arrow represents a **lifecycle rule transition**: S3
automatically moves the object between storage classes based on
object age, with no application code changes and no manual
intervention. This is the answer whenever a scenario describes a
**known, predictable access pattern** that cools over time (see the
decision tree below).

```
DECISION TREE — Intelligent-Tiering vs Lifecycle Policy
=========================================================

  Do you KNOW the access pattern in advance, and is it stable?
        |
        +--> YES -----> S3 LIFECYCLE POLICY
        |                (no monitoring fee -- cheapest for known patterns)
        |
        +--> NO / it changes unpredictably -----> S3 INTELLIGENT-TIERING
                         (small per-object monitoring fee, but you never
                          pay the "guessed wrong" penalty)
```

⚠️ **Exam trap:** Intelligent-Tiering charges a **per-object monitoring
fee**. For **millions of small objects**, that fee can exceed the
storage savings — the correct answer becomes "compact small files
first, then apply lifecycle policies," not "just turn on
Intelligent-Tiering and stop thinking about it."

⚠️ **Minimum storage durations matter for the exam's cost-trap
questions:** Standard-IA and One Zone-IA have a **30-day minimum**;
Glacier Instant Retrieval also has a **90-day minimum**; Glacier
Flexible Retrieval has a **90-day minimum**; Glacier Deep Archive has
a **180-day minimum**. Deleting or transitioning an object before its
minimum duration incurs an early-deletion charge — a question about
"data accessed unpredictably every 20 days" is testing whether you'll
incorrectly reach for IA (30-day minimum) when the access interval is
shorter than the minimum duration.

<a name="233"></a>
### 2.3.3 Use lifecycle policies to expire data

```
Lifecycle rule:  Object age > 365 days  --->  Expiration action  --->  Object permanently deleted
```

- **Purpose:** automatically delete data once it's no longer needed,
  without a scheduled job or manual process.
- **When to use:** logs with a fixed retention requirement, temporary
  processing artifacts, data with a known legal retention ceiling.
- **Exam trap:** expiration rules interact with **versioning** — if
  versioning is enabled, an expiration rule by default only removes
  the *current* version (creating a delete marker) unless you also
  configure a rule to permanently remove **noncurrent versions** after
  some period. A question about "data still consuming storage after
  the retention period" despite an expiration rule is almost always
  testing this versioning interaction.

<a name="234"></a>
### 2.3.4 Manage S3 versioning and DynamoDB TTL

**S3 Versioning**

```
Object "report.csv"
        |
        v
   PUT (overwrite)  --->  new version created, OLD version preserved
        |
        v
   Accidental DELETE  --->  adds a delete marker, OLD versions still recoverable
```

- **Purpose:** protects against accidental overwrite and accidental
  delete by keeping every prior version of an object.
- **When to use:** any bucket where "someone might overwrite or
  delete something important" is a real risk — which in practice is
  most production data lake buckets. Also a **prerequisite** for
  cross-region/same-region replication (CRR/SRR).
- **When NOT to use:** high-churn buckets where storage of many
  historical versions isn't worth the cost and the data is trivially
  reproducible (pair with a lifecycle rule to expire noncurrent
  versions if you do enable it).
- **Common mistake:** enabling versioning without a lifecycle rule to
  clean up noncurrent versions — storage cost grows unbounded over
  time as every overwrite retains a full extra copy.
- **Exam trap:** "S3 offers 100% durability against accidental
  deletion" is not quite the right framing — versioning provides
  *recoverability*, and it must be **explicitly enabled**; it's not
  the default.

**DynamoDB TTL**

```
Item (SessionID=abc123, ExpiresAt=1723027200)
        |
        v
   DynamoDB background process deletes the item after ExpiresAt passes
        |
        v
   Deletion also appears in DynamoDB Streams (if enabled) as a REMOVE event
```

- **Purpose:** automatically expire and delete items past a defined
  timestamp attribute, at **no additional cost** and without consuming
  write capacity for the deletion itself.
- **When to use:** session tokens, temporary auth tokens, shopping
  cart items that should vanish after inactivity, any time-boxed data.
- **When NOT to use:** data with a hard compliance deadline requiring
  *guaranteed* deletion at an exact instant — TTL deletion typically
  happens within 48 hours of expiry, which is usually fine but is
  **not instantaneous**, and the exam expects you to know that.
- **Exam trap:** "automatically expire session data at no cost" →
  DynamoDB TTL; a question demanding *precise-to-the-second* deletion
  timing should make you pause — TTL is "best effort, typically within
  48 hours," not a hard real-time guarantee.
- **Real enterprise example:** a media streaming service stores
  playback session tokens in DynamoDB with TTL set to auto-expire 24
  hours after issuance, with the TTL-driven Streams event triggering a
  Lambda that also invalidates a downstream cache entry.

<a name="235"></a>
### 2.3.5 Delete data to meet business and legal requirements

| Requirement | Mechanism |
|---|---|
| GDPR/CCPA "right to be forgotten" on a data lake | **Iceberg row-level `DELETE`** (see 2.1.7) |
| Fixed retention window, automatic cleanup | **S3 lifecycle expiration** rule |
| Session/temporary data auto-expiry | **DynamoDB TTL** |
| On-demand application-driven deletion | Standard `DELETE`/`DeleteItem` operations |
| Regulatory hold / cannot be deleted even by an admin | **S3 Object Lock, compliance mode** |

⚠️ **Exam trap:** on a *plain Hive-style* S3 table, "delete this one
customer's records for GDPR" has no clean row-level mechanism — the
only ways are rewriting the whole affected partition (slow, expensive)
or migrating to Iceberg. This is one of the strongest real-world
arguments for Iceberg and a frequent scenario setup.

<a name="236"></a>
### 2.3.6 Protect data with appropriate resiliency and availability

```
Application
     |
     v
    S3
     |
     +--> Versioning (protects against accidental overwrite/delete)
     +--> Cross-Region Replication / Same-Region Replication (DR, requires versioning)
     +--> Multi-AZ durability (built into S3 Standard automatically)
     +--> Object Lock (WORM -- regulatory/compliance immutability)
```

- **Durability vs Availability — memorize the difference exactly:**
  **Durability** (11 nines for S3 Standard) is the probability that an
  object is *not lost* over a year. **Availability** (99.99% for S3
  Standard) is the probability the object is *reachable* at a given
  moment. A service can be extremely durable (your data isn't gone)
  while briefly unavailable (you can't fetch it right now) — these are
  different guarantees and the exam tests the distinction directly.
- **Resiliency levers by store:**

| Store | Resiliency mechanism |
|---|---|
| S3 | Versioning, CRR/SRR, Object Lock, 11 nines durability |
| DynamoDB | Multi-AZ by default, Global Tables (multi-region active-active), PITR (35-day continuous backup) |
| Aurora/RDS | Multi-AZ with automated failover, automated backups, cross-region read replicas |
| Redshift | Multi-AZ (RA3), automated + manual snapshots, cross-region snapshot copy |

- **Common mistake:** assuming "Multi-AZ" and "backups enabled" are
  interchangeable — Multi-AZ protects against an **availability zone
  failure** with fast failover; backups/snapshots protect against
  **logical corruption or accidental deletion**, which Multi-AZ
  replicates instantly and therefore does *not* protect against (a bad
  write replicates to the standby just as fast as to the primary).
- **Real enterprise example:** a healthcare records system enables S3
  Object Lock in compliance mode for medical imaging data (nobody,
  including root, can delete it before the retention period expires)
  while separately running DynamoDB Global Tables for patient-facing
  session data that must survive a regional outage with near-zero
  downtime.

---

<a name="t24"></a>
## TASK 2.4 — DESIGN DATA MODELS AND SCHEMA EVOLUTION

<a name="241"></a>
### 2.4.1 Design schemas for Redshift, DynamoDB, and Lake Formation

#### Redshift: Star vs Snowflake

| Attribute | **Star Schema** | **Snowflake Schema** |
|---|---|---|
| **Structure** | One fact table + denormalized dimension tables | Fact table + normalized (multi-level) dimension tables |
| **Joins per query** | Fewer | More |
| **Redundancy** | More (denormalized dimensions) | Less |
| **Query speed** | **Faster** — fewer joins, BI-friendly | Slower — more joins to traverse |
| **Best use case** | **Analytics / BI reporting — the default answer for Redshift** | Storage-efficiency-critical scenarios, rarely the "best" exam answer |
| **Exam favorite** | "design a warehouse schema for BI dashboards" | Usually appears as the *plausible-but-slower* distractor |

```
STAR SCHEMA
===========

        Dim_Customer          Dim_Product
             \                    /
              \                  /
               v                v
            +-----------------------+
            |     FACT_SALES        |
            | (SaleID, CustomerID,  |
            |  ProductID, StoreID,  |
            |  DateID, Quantity,    |
            |  Revenue, Profit)     |
            +-----------------------+
               ^                ^
              /                  \
             /                    \
        Dim_Store              Dim_Date
```

Reading the diagram: the **fact table** sits at the center and holds
the measurable, numeric events (quantity, revenue, profit) plus
foreign keys pointing outward to each **dimension table**
(Customer, Product, Store, Date). Each dimension is denormalized —
e.g., `Dim_Customer` might repeat a customer's city and region on
every row rather than splitting those into a further "Region" table.
That denormalization is deliberate: it means a BI query joins the fact
table to at most one hop per dimension, which is exactly what makes
star schemas fast for aggregation-heavy queries in a columnar,
MPP engine like Redshift.

**Snowflake schema** takes the same structure and further normalizes
each dimension — e.g., splitting `Dim_Product` into `Dim_Product` →
`Dim_Category` → `Dim_Department`. This reduces storage redundancy but
adds join hops, which works against Redshift's strengths. **Rule for
the exam: analytics workloads default to star schema.**

**Fact and dimension tables**
- **Fact table:** numeric, additive measures (sales amount, quantity,
  duration) tied to a specific grain (e.g., one row per order line
  item) plus foreign keys to dimensions.
- **Dimension table:** descriptive attributes used for filtering and
  grouping (customer name, product category, store region, calendar
  attributes).

**SCD Types 1/2/3 (Slowly Changing Dimensions)** — how a dimension
handles a value changing over time:

| Type | Behavior | Example | When to use |
|---|---|---|---|
| **Type 1** | Overwrite the old value — no history kept | Customer's email address updates, old one simply gone | When history of the change doesn't matter |
| **Type 2** | Insert a **new row** with a new surrogate key, mark old row as expired (with effective/expiry dates or a current-flag) | Customer's address changes — you want to know which address was current for a historical sale | **The default answer when a question needs historical accuracy** ("track how a customer's region changed over time") |
| **Type 3** | Add a **new column** to hold the previous value alongside the current one | "Previous Sales Rep" column added next to "Current Sales Rep" | When you only need to track the *immediately prior* value, not full history |

⚠️ **Exam trap:** "we need to know what a customer's address was at
the time of each historical order" is a **Type 2** signal, not Type 1
— Type 1 would silently rewrite history, corrupting any join against
old fact rows.

**DynamoDB: access-pattern-first modeling**

```
❌ WRONG APPROACH: draw an ER diagram, normalize into many tables,
                    then figure out queries later.

✅ RIGHT APPROACH:  list every access pattern FIRST, then design the
                    partition key / sort key / indexes to satisfy them.
```

- **Guard rail:** always design from **Access Pattern First, never
  Entity-Relationship First.** A DynamoDB table modeled like a
  normalized relational schema forces application-side joins across
  many round trips — the opposite of what DynamoDB is good at.
- **Worked example:** "Get all orders for a customer, most recent
  first" → `PK = CustomerID`, `SK = OrderDate` (descending query).
  "Find all orders in PENDING status across all customers" → this is a
  *different* access pattern the base table's key can't serve
  efficiently, so add a **GSI**: `GSI-PK = OrderStatus`,
  `GSI-SK = OrderDate`.
- **Single-table design:** a common advanced DynamoDB pattern —
  storing multiple entity types (e.g., `CUSTOMER#123`,
  `ORDER#123#2026-08-07`) in one table using generic `PK`/`SK` names,
  to serve multiple access patterns with one table and minimize the
  number of round trips per request. Recognize it if described; deep
  single-table design is beyond what the exam tests in depth, but the
  *principle* (access pattern first) is tested directly and often.

**Lake Formation schema/layering pattern**

```
Raw  --->  Validated  --->  Curated  --->  Consumption
(as-        (schema-        (business      (aggregated,
 landed,      checked,        logic         BI-ready,
 untouched)   deduped)        applied)      denormalized)
```

Reading the layering: **Raw** preserves exactly what arrived, for
auditability and reprocessing. **Validated** applies schema
enforcement and basic quality checks. **Curated** applies business
transformations and joins. **Consumption** is the flattened,
aggregated layer BI tools query directly. This maps directly onto the
**bronze/silver/gold** vocabulary used elsewhere in this repo — same
pattern, different names. Recommended partitioning at the storage
layer: hierarchical date partitions (`year=2026/month=08/day=07`) for
predictable pruning.

<a name="242"></a>
### 2.4.2 Address changes to the characteristics of data

| Change type | Example | Response |
|---|---|---|
| **Schema drift** | Old record `{"name":"John"}`, new record adds `"email"` | Iceberg/Avro handle additive changes gracefully; Hive/CSV do not |
| **Volume growth** | 100 GB → 10 TB → 500 PB | Add partitioning, compression, columnar formats; reconsider engine (Athena → Redshift → EMR at extreme scale) |
| **Velocity changes** | Batch → near-real-time → streaming | Migrate Glue batch job → Glue Streaming/Kinesis/Managed Flink pipeline |
| **Data type changes** | Integer field becomes a string (e.g., a "zip code" that starts including leading zeros or alpha characters) | Requires schema evolution support, validation at ingest, and a transformation/casting step for historical data |

- **Senior engineer note:** the right response to "data characteristics
  changed" is almost never "rebuild everything from scratch." It's
  "does the current format/engine support evolving in place?" — which
  is exactly why table format choice (2.1.7) and file format choice
  (2.4.5) are treated as foundational decisions rather than
  implementation details: choosing Iceberg/Avro up front means volume,
  velocity, and schema changes later are absorbed instead of causing
  a migration project.
- **Exam trap:** a scenario describing a schema that changes
  frequently and unpredictably, landing in a Hive-style table, is
  usually steering you toward recommending a **table-format or
  file-format change** (to Iceberg or Avro), not toward "just crawl
  more often."

<a name="243"></a>
### 2.4.3 Perform schema conversion

AWS names **DMS Schema Conversion** for the conversion step and
**AWS DMS** for the data-movement step.

> ⚠️ **Currency note:** as of the December 2025 DEA-C01 exam guide
> revision (v1.1), the standalone **AWS Schema Conversion Tool (SCT)**
> desktop application was **removed from the exam's in-scope services
> list**. The underlying capability didn't disappear — it was absorbed
> into **DMS Schema Conversion**, built directly into the DMS
> console/service, instead of being a separate downloadable tool. The
> exam skill is unchanged: convert schema DDL, SQL code, and stored
> procedures/views/functions between database engines during a
> heterogeneous migration. Only the current, correct service name
> changed. Everywhere this guide previously said "AWS SCT" as a
> standalone product, read it as **DMS Schema Conversion**.

```
Oracle (schema, SQL, stored procedures, views)
        |
        v
   DMS Schema Conversion  ---(converts schema DDL, SQL code, procedures, views)--->
        |
        v
   New schema in Aurora PostgreSQL (structure only, no data yet)
```

```
Oracle (live data + ongoing changes)
        |
        v
   AWS DMS  ---(full load + CDC replication)--->
        |
        v
   Data populated into the Aurora PostgreSQL schema created by
   DMS Schema Conversion
```

**The combined pattern (most important migration pattern on the exam):**

```
        +----------------------+          +------------------+
Oracle  |  DMS Schema           |          |      AWS DMS       |
  DB -->|  Conversion converts   |   +---->|  migrates DATA      |--> Aurora
        |  SCHEMA + SQL + procs   |   |    |  (full load + CDC)  |    PostgreSQL
        +----------------------+   |    +------------------+
                                     |
                    (the converted schema is applied to
                     the target BEFORE DMS starts moving rows)
```

| Task | Tool |
|---|---|
| Convert schema DDL (tables, types) | **DMS Schema Conversion** |
| Convert SQL code | **DMS Schema Conversion** |
| Convert stored procedures, views, functions | **DMS Schema Conversion** |
| Move the actual data (one-time) | **AWS DMS** (full load) |
| Continuously replicate ongoing changes (CDC) | **AWS DMS** (CDC) |
| Assess migration complexity/effort up front | **DMS Schema Conversion assessment report** |

⚠️ **Exam trap — the single most tested distinction in this
sub-skill:** "Convert an Oracle schema to run on PostgreSQL" →
**DMS Schema Conversion**. "Continuously replicate data from Oracle to
the new database" → **DMS** (full load / CDC). A homogeneous migration
(e.g., Oracle → Oracle on RDS) typically doesn't need schema
conversion at all, since the schema doesn't need to change — schema
conversion earns its place specifically in **heterogeneous**
migrations (different database engines). Both capabilities live under
the DMS umbrella today; the exam may still describe them as two
distinct steps in a workflow even though they're one service.

- **Real enterprise example:** an enterprise migrating a legacy Oracle
  data warehouse to Aurora PostgreSQL runs DMS Schema Conversion first
  to convert schema and PL/SQL stored procedures to PL/pgSQL, reviews
  its assessment report to identify procedures that need manual
  rework, applies the converted schema to the target, then runs DMS in
  full-load-plus-CDC mode to migrate historical data and keep the
  target in sync until cutover.

<a name="244"></a>
### 2.4.4 Establish data lineage using AWS tools

AWS references **SageMaker (ML) Lineage Tracking** and **SageMaker
Catalog / Amazon DataZone** for lineage.

```
Source Data  --->  Glue ETL  --->  Feature Store  --->  ML Model  --->  Prediction
     |                 |                  |                 |               |
     +-----------------+------------------+-----------------+---------------+
                                    |
                          Lineage captures every step:
                          what fed what, when, and how it changed
```

Reading the diagram: lineage answers "where did this value come from,
and what happened to it along the way?" at every hop of the pipeline
— from raw source, through transformation, through feature
engineering, through the trained model, to a specific prediction. This
matters for **trustworthiness/accuracy** (task 2.4's explicit
knowledge requirement) because if a downstream number looks wrong, you
need to trace it back through every transformation to find where it
went wrong.

- **SageMaker Lineage Tracking** automatically records relationships
  between datasets, experiments, training jobs, models, and endpoints
  within the ML workflow: `Dataset -> Training Job -> Model ->
  Endpoint`, captured without manual bookkeeping.
- **SageMaker Catalog / DataZone** tracks the **business** side:
  ownership, glossary terms, governance context — complementary to,
  not a replacement for, the technical lineage graph.
- **Exam keywords that point here:** "lineage," "traceability,"
  "auditability," "where did this data come from," "who changed this
  dataset."
- **Common mistake:** treating CloudTrail (who called an API, when) as
  equivalent to data lineage (how did this *value* get derived) —
  they answer different questions. CloudTrail is an audit log of API
  calls; lineage is a graph of data transformations.
- **Real enterprise example:** a bank's model-risk team uses SageMaker
  Lineage to prove to an auditor exactly which raw dataset version and
  which feature-engineering job produced the model version currently
  serving credit-risk predictions in production.

<a name="245"></a>
### 2.4.5 Best practices for indexing, partitioning, compression, and optimization

> One of the highest-value, most concretely testable areas in Domain
> 2 — expect direct numeric/mechanism questions, not just concepts.

#### Indexing

| Store | Indexing approach |
|---|---|
| **DynamoDB** | Primary index = Partition Key (+ optional Sort Key); **GSI** for new access patterns (add anytime, eventually consistent); **LSI** for an alternate sort key on the same partition key (must be defined at table creation, 10 GB per partition key cap) |
| **Aurora/RDS** | Index columns used in `WHERE`, `JOIN`, and `ORDER BY`; **avoid indexing every column** — each additional index slows every write, since the index must be updated too |
| **Redshift** | Not traditional indexes — performance comes from **distribution style** and **sort key** design instead |

#### Redshift optimization — distribution and sort keys

| Concept | Purpose | Example |
|---|---|---|
| **Distribution Key (DISTKEY)** | Minimize data movement/shuffling across nodes during joins by co-locating matching rows on the same slice | `DISTKEY(CustomerID)` on both the fact table and a large dimension so join rows are already co-located |
| **Sort Key** | Speed up range-filtered queries via zone maps (skip blocks that can't match the filter) | `SORTKEY(SaleDate)` for queries filtering on date ranges |
| **DISTSTYLE ALL** | Full copy of a small table on every node — eliminates shuffling entirely for that table | Small, frequently-joined dimension tables |
| **DISTSTYLE AUTO** | Redshift chooses (starts ALL, grows into EVEN as the table grows) | "Least operational overhead" distribution scenarios |

⚠️ **Exam trap:** a `DISTKEY` on a **low-cardinality** column (e.g., a
status flag with 3 values) *causes* skew — most rows land on one or
two slices, defeating the purpose. This is a failure scenario the
exam loves to describe and ask you to diagnose.

#### Partitioning strategy

```
s3://lake/events/year=2026/month=08/day=07/*.parquet
```

- Use **date hierarchies** for time-series data — the most common
  correct partition scheme on the exam.
- Aim for partitions with **at least ~128 MB** of data each; too many
  tiny partitions create the "small file problem" and slow S3 LIST/
  crawler operations.
- Partition on columns actually present in query `WHERE` clauses —
  partitioning on a column nobody filters by provides zero pruning
  benefit while still adding metadata overhead.
- Avoid partitioning on **high-cardinality** identifier columns
  (e.g., a raw UUID) — this creates enormous numbers of tiny
  partitions, the opposite of what partitioning is for.

#### Compression and file format

| Format | Compression | Query speed | Best use |
|---|---|---|---|
| **CSV** | Poor | Slow | Raw landing only — never the target for analytics |
| **JSON** | Poor | Slow | Raw landing, semi-structured source data |
| **Avro** | Good | Medium | Streaming ingest, **best schema-evolution support of the row formats** |
| **ORC** | Excellent | Fast | Hive/Hadoop-ecosystem-heavy workloads |
| **Parquet** | **Excellent** | **Fastest** | **Default choice for analytics — the exam's default answer** |

- **Typical savings from CSV/JSON → Parquet:** 70–90% storage
  reduction plus dramatically faster scans, because columnar formats
  let the query engine read only the columns actually referenced and
  skip whole row-groups using min/max statistics (predicate pushdown).
- **Codec choice:** **Snappy** — fast, splittable inside
  Parquet/ORC, the default pairing with Parquet. **ZSTD** — better
  ratio than Snappy at similar speed, a common modern default.
  **GZIP** — good ratio but **not splittable as a standalone file**
  (fine *inside* Parquet/ORC, which handle splitting internally, but a
  raw `.csv.gz` file cannot be split across parallel tasks). **BZIP2**
  — highest ratio, slowest — rarely the right exam answer.

⚠️ **The splittability trap:** a single large gzip-compressed CSV file
cannot be split for parallel processing — one task processes the
entire file while other workers sit idle. The fix is **not** "add more
workers"; it's **convert to Parquet + Snappy/ZSTD and partition
appropriately**.

#### The small-file problem and compaction

```
10,000 files x 1 MB each   -->  SLOW  (per-file open/read overhead dominates)
100 files x 100 MB each    -->  FAST  (this is the target range: 128 MB-1 GB)
```

| Where it happens | Fix |
|---|---|
| Glue ETL output | `coalesce()`/`repartition()` before writing |
| Firehose delivery | Increase the buffer size/interval before flushing to S3 |
| Athena output | `CTAS` with bucketing to control output file count |
| Iceberg tables | Scheduled **compaction** (`rewrite_data_files` / `OPTIMIZE`) |

#### Optimization cheat table

| Lever | Effect |
|---|---|
| Partitioning | Scan less data |
| Compression | Store less, transfer less |
| Sort key (Redshift) | Faster range reads via zone maps |
| Distribution key (Redshift) | Less cross-node shuffling on joins |
| GSI (DynamoDB) | Serve an additional access pattern |
| Parquet + columnar pruning | Faster, cheaper analytical queries |
| Compaction (Iceberg/small files) | Sustained query performance over time |

<a name="246"></a>
### 2.4.6 Describe vectorization concepts

> Companion to 2.1.8 — 2.1.8 covers *which service/index* to use;
> 2.4.6 covers the *modeling concept* itself, as explicitly named in
> the exam guide.

**What vectorization is:** converting text (or images, audio) into a
numerical **embedding** — a fixed-length array of floating-point
numbers that captures semantic meaning, positioned in a
high-dimensional space such that semantically similar inputs produce
vectors that are numerically close together.

```
"How do I reset my password?"
        |
        v  (embedding model)
[0.234, 0.981, 0.122, -0.045, ... ]   (e.g., 1536 dimensions)
```

**Why it matters:** traditional keyword search matches exact or
fuzzy **text tokens**. Vector/semantic search matches **meaning** —
"How do I reset my password?" and "I forgot my login credentials" can
be nowhere near each other as strings but very close as vectors,
because they mean nearly the same thing.

```
RAG (RETRIEVAL-AUGMENTED GENERATION) ARCHITECTURE
===================================================

User Question
     |
     v
  Embedding Model  (turn question into a vector)
     |
     v
  Vector Search  (find nearest-neighbor document chunks -- HNSW/IVF)
     |
     v
  Relevant Documents  (retrieved context, not the whole corpus)
     |
     v
  LLM  (generates an answer GROUNDED in the retrieved documents)
     |
     v
  Answer (with citations back to source documents)
```

Reading the diagram: the user's question is embedded the same way the
document corpus was embedded ahead of time. **Vector search** finds
the handful of document chunks whose vectors are closest to the
question's vector — this is the ANN search discussed in 2.1.8. Those
retrieved chunks, not the entire knowledge base, are handed to the
**LLM** as grounding context, which is what lets the model answer
using an organization's private data without having been trained on
it, and with dramatically less hallucination than an ungrounded
prompt.

**Bedrock Knowledge Base flow (fully managed version of the same
pipeline):**

```
Documents  --->  Chunking  --->  Embedding Model  --->  Vector Database  --->  Semantic Search  --->  LLM Response
```

Each stage is handled by the managed service: documents are split
into **chunks** (small enough for useful retrieval granularity),
each chunk is embedded, embeddings are stored in a **vector
database** (which can be Aurora+pgvector, OpenSearch, or others),
retrieval performs the semantic search step, and the retrieved chunks
are passed to the LLM.

- **Purpose:** enable meaning-based retrieval instead of literal
  keyword matching, and ground generative AI responses in an
  organization's actual data.
- **When to use:** semantic search, RAG, recommendation systems,
  duplicate/similarity detection, chatbots and AI assistants that need
  to answer from private knowledge.
- **When NOT to use:** exact-match lookups (a plain key-value get is
  cheaper and simpler), workloads where keyword search already
  performs well and the added complexity of an embedding pipeline
  isn't justified.
- **Exam trap:** a question describing "meaning-based" or
  "similarity" retrieval, RAG, or "AI assistant grounded in company
  documents" is pointing at vectorization/vector search — a plain
  `LIKE '%keyword%'` or Athena text filter is the wrong-answer
  distractor.
- **Real enterprise example:** an online retailer builds a "customers
  who asked something similar" support deflection feature using
  vector similarity search over its historical support-ticket corpus,
  reducing live agent load before a human is ever involved.

---

<a name="mnemonics"></a>
## MNEMONICS

- **"Access pattern first, entity-relationship second."** — DynamoDB
  modeling, and really all of Domain 2.
- **"Deny Stops Really Powerful Session Identities"** — IAM policy
  evaluation order (carried over from Domain 4, relevant anywhere
  storage security comes up): explicit Deny → SCP → Resource policy →
  Permissions boundary → Session policy → Identity policy.
- **"S in Spectrum, S in S3"** — Spectrum queries data that stays in
  **S3**; Federated Query reaches into a **live** database instead.
- **"Fact in the middle, Dimensions around it, Star shines fastest."**
  — star schema is the default BI answer; snowflake adds joins for
  less redundancy.
- **"HNSW = Higher accuracy, Higher memory."** Both start with H —
  use it to remember HNSW trades memory for recall; IVF is the
  lighter-weight option.
- **"Type 2 keeps history, Type 1 forgets, Type 3 remembers only
  yesterday."** — SCD types, in order.
- **"Schema Conversion shapes it, DMS ships it."** — DMS Schema
  Conversion converts the shape (schema/SQL/procs); DMS full
  load/CDC moves the stuff (the data). Both live under the DMS
  umbrella today — the standalone "AWS SCT" product name is retired.
- **"Parquet for reading, Avro for evolving, CSV for nothing except
  landing."** — file format selection.
- **"Lifecycle when you KNOW, Intelligent-Tiering when you DON'T."**
  — S3 storage-class automation choice.
- **"Iceberg: Delete, Merge, Travel, Evolve — without a Rewrite."**
  — the four headline Iceberg capabilities.
- **"TTL is free but not instant; Lifecycle is scheduled and exact."**
  — DynamoDB TTL (best-effort, up to 48h) vs S3 lifecycle (rule-driven,
  predictable timing).

---

<a name="cheatsheet"></a>
## DOMAIN 2 CHEAT SHEET

### Scenario to answer

| Scenario phrase | Answer |
|---|---|
| Cheapest data lake landing zone | S3 |
| Warehouse analytics, hundreds of BI users | Redshift |
| Transactional SQL, ACID, joins | Aurora / RDS |
| Key-value lookup, single-digit ms | DynamoDB |
| Sub-ms cache/session with durability | MemoryDB |
| Query S3 from an existing Redshift cluster | Redshift Spectrum |
| Query Aurora/RDS live from Redshift, no ETL | Redshift Federated Query |
| Query RDS/DynamoDB live from Athena | Athena Federated Query |
| Speed up a repeated expensive Redshift query | Materialized View |
| Share live Redshift data cross-cluster/account, no copy | Redshift data sharing |
| Central technical metadata store | Glue Data Catalog |
| Auto-discover schema and partitions | Glue Crawler |
| Millions of partitions, avoid crawler/MSCK cost | Athena partition projection |
| Open table format for upsert/delete/time-travel | Apache Iceberg |
| Semantic/RAG search alongside relational data | Aurora PostgreSQL + pgvector |
| Highest-recall vector index for RAG | HNSW |
| Lower-memory, faster-build vector index | IVF |
| Fully managed end-to-end RAG pipeline | Bedrock Knowledge Bases |
| Archive, rarely accessed, 12h retrieval OK | Glacier Deep Archive |
| Fast bulk load into Redshift | COPY |
| Export Redshift data to S3 | UNLOAD |
| Automatic item expiry | DynamoDB TTL |
| Protect against accidental object overwrite/delete | S3 Versioning |
| WORM / cannot be deleted even by an admin | S3 Object Lock (compliance mode) |
| Analytics-friendly warehouse schema | Star Schema |
| Track how a dimension value changed historically | SCD Type 2 |
| NoSQL schema design starting point | Access Pattern First |
| Convert Oracle schema to PostgreSQL | DMS Schema Conversion |
| Continuously replicate database changes | AWS DMS (CDC) |
| Track ML dataset-to-model relationships | SageMaker Lineage Tracking |
| Business glossary, ownership, discovery | SageMaker Catalog / DataZone |
| Analyze DynamoDB data without hurting app performance | Export to S3, then Athena (never Scan) |
| GSI vs LSI, added after table creation | GSI (LSI can't be retrofitted) |

### Most-tested comparisons

S3 vs Redshift · DynamoDB vs Aurora/RDS · Redshift Spectrum vs
Federated Query vs Materialized View vs Data Sharing · Glue Data
Catalog vs Glue Crawler · Star vs Snowflake Schema · HNSW vs IVF ·
Apache Iceberg vs Hive-style tables · S3 Versioning vs Lifecycle
Policy · COPY vs UNLOAD · DMS Schema Conversion vs DMS (full load/CDC) · GSI vs LSI · Intelligent-Tiering
vs Lifecycle Policy.

---

<a name="questions"></a>
## PRACTICE QUESTION BANK — 40 QUESTIONS

Difficulty mix: 10 straightforward, 20 scenario-based, 10 hard /
multi-constraint. Every option is explained — right and wrong.

---

**Q1.** A startup needs the cheapest possible place to store raw
clickstream JSON files that will later be queried by several different
compute engines. Which store should they use?

A. DynamoDB
B. Amazon S3
C. Aurora PostgreSQL
D. Amazon Redshift

**Answer: B.** S3 is the cheapest per-GB storage option and, because
it's just object storage, multiple independent compute engines
(Athena, EMR, Redshift Spectrum) can read the same files without
copying data. **A is wrong** — DynamoDB is priced and built for
low-latency key-value access, not cheap bulk raw-file storage. **C is
wrong** — Aurora storage is far more expensive per GB and isn't built
for holding raw semi-structured files. **D is wrong** — Redshift
storage is priced for a warehouse, not a raw landing zone, and locks
the data into one engine's storage format.

---

**Q2.** Which AWS service is the fully managed, serverless technical
metadata store used by Athena, EMR, and Redshift Spectrum?

A. AWS Glue Data Catalog
B. Amazon DataZone
C. Hive Metastore on EC2
D. AWS Config

**Answer: A.** The Glue Data Catalog is the default, serverless
technical metadata layer shared across Athena, EMR, Glue, and Redshift
Spectrum. **B is wrong** — DataZone/SageMaker Catalog is the
*business* catalog layer (ownership, glossary, discovery), not the
technical schema store. **C is wrong** — a self-managed Hive metastore
on EC2 is the legacy, operationally heavier alternative, not the
managed default. **D is wrong** — AWS Config tracks resource
configuration compliance, unrelated to data schemas.

---

**Q3.** A team needs to bulk-load 500 GB of Parquet files from S3 into
Redshift as fast as possible. What should they use?

A. Individual `INSERT` statements in a loop
B. `COPY`
C. `UNLOAD`
D. AWS DMS

**Answer: B.** `COPY` loads data into Redshift in parallel across node
slices and is the purpose-built, fastest mechanism for bulk loading
from S3. **A is wrong** — row-by-row `INSERT` is dramatically slower
and never the right choice for bulk loads. **C is wrong** — `UNLOAD`
moves data *out* of Redshift to S3, the opposite direction. **D is
wrong** — DMS replicates from external databases; it's not the
mechanism for an S3-to-Redshift bulk load.

---

**Q4.** Which S3 storage class has the shortest minimum storage
duration among the archive tiers?

A. Glacier Deep Archive (180 days)
B. Glacier Instant Retrieval (90 days)
C. S3 Standard (none)
D. S3 One Zone-IA (30 days)

**Answer: C.** S3 Standard has no minimum storage duration — it's the
hot tier. **A is wrong** but describes Deep Archive correctly (180
days) — it just isn't the shortest. **B is wrong** but is factually
correct about Glacier Instant Retrieval's 90-day minimum. **D is
close** (One Zone-IA is 30 days) but Standard's "none" is shorter than
any minimum duration, making C the best answer to "shortest."

---

**Q5.** Which DynamoDB feature lets you analyze table data in Athena
without consuming any read capacity from the production table?

A. `Scan` with a filter expression
B. DynamoDB export to S3
C. A GSI with all attributes projected
D. DynamoDB Streams

**Answer: B.** Exporting a DynamoDB table to S3 (point-in-time or full)
consumes **zero RCUs** and is the correct pattern for analyzing table
data without impacting the live application. **A is wrong** — `Scan`
reads every item and consumes read capacity, directly competing with
production traffic. **C is wrong** — a GSI still lives inside
DynamoDB and consumes its own write capacity; it doesn't get you to
Athena. **D is wrong** — Streams captures change events for 24 hours
for event-driven processing, not a bulk analytical export mechanism.

---

**Q6.** A finance team wants to query a small set of static reference
data stored in S3, only occasionally, with no dedicated infrastructure.
What should they use?

A. Amazon Redshift provisioned cluster
B. Amazon Athena
C. Amazon Aurora
D. Amazon DynamoDB

**Answer: B.** Athena is serverless, pay-per-query, and requires no
infrastructure — ideal for occasional, unpredictable queries directly
against S3. **A is wrong** — provisioning a Redshift cluster for
occasional queries means paying for a mostly idle cluster. **C is
wrong** — Aurora is a relational OLTP engine, not built for ad-hoc SQL
over S3 files. **D is wrong** — DynamoDB doesn't run SQL over
arbitrary S3 files at all.

---

**Q7.** What is the primary difference between S3 durability and S3
availability?

A. They are the same metric expressed differently
B. Durability measures the odds data is retrievable right now; availability measures the odds it's never lost
C. Durability measures the odds data is never lost; availability measures the odds it's retrievable right now
D. Availability applies only to Glacier tiers

**Answer: C.** Durability (11 nines for S3 Standard) is about data not
being lost over time; availability (99.99% for Standard) is about
being able to reach it at a given moment. **A is wrong** — they're
distinct guarantees that can diverge (data can be durable but
briefly unreachable). **B is wrong** — it reverses the definitions.
**D is wrong** — availability figures apply across storage classes,
not only Glacier.

---

**Q8.** Which vector index type generally offers higher recall
accuracy at the cost of higher memory usage?

A. IVF
B. HNSW
C. B-tree
D. GSI

**Answer: B.** HNSW (Hierarchical Navigable Small World) offers higher
recall accuracy and fast queries, at the cost of higher memory usage
and longer build time. **A is wrong** — IVF trades some recall for
lower memory and faster build time. **C is wrong** — B-tree is a
traditional relational index structure, not a vector ANN index type.
**D is wrong** — a GSI is a DynamoDB secondary index concept, unrelated
to vector search.

---

**Q9.** Which tool converts an Oracle database's schema, SQL code, and
stored procedures for use on Aurora PostgreSQL?

A. AWS DMS (full load)
B. DMS Schema Conversion
C. AWS Glue crawler
D. AWS AppFlow

**Answer: B.** DMS Schema Conversion converts schema DDL, SQL code,
and stored procedures/views between database engines. (This capability
used to ship as a standalone desktop tool called AWS SCT; as of the
December 2025 DEA-C01 exam guide revision that standalone product is
no longer in scope — the same functionality is now built into the DMS
console as DMS Schema Conversion.) **A is wrong** — DMS full load/CDC
moves the *data*, not the schema or code. **C is wrong** — a Glue
crawler discovers and catalogs schema for files/tables, it doesn't
convert one database engine's schema into another's dialect. **D is
wrong** — AppFlow integrates with SaaS APIs, unrelated to database
schema conversion.

---

**Q10.** Which S3 feature must be enabled before you can configure
Cross-Region Replication?

A. Intelligent-Tiering
B. Versioning
C. Object Lock
D. Transfer Acceleration

**Answer: B.** Versioning is a prerequisite for both Cross-Region
Replication and Same-Region Replication. **A is wrong** — Intelligent-
Tiering is a storage-class feature unrelated to replication
prerequisites. **C is wrong** — Object Lock is for WORM compliance,
not a replication prerequisite (though it can be combined with
versioning-enabled buckets). **D is wrong** — Transfer Acceleration
speeds up uploads over long distances; it has nothing to do with
replication configuration requirements.

---

**Q11.** A logistics company's operational database is Aurora MySQL.
They need near real-time analytics in Redshift with the least possible
operational overhead and no pipeline code to maintain. What should
they use?

A. AWS Glue ETL jobs on a schedule
B. AWS DMS with CDC
C. A zero-ETL integration from Aurora MySQL to Redshift
D. Manual nightly `UNLOAD`/`COPY` scripts

**Answer: C.** Zero-ETL integrations automatically and continuously
sync supported sources (including Aurora MySQL) into Redshift within
seconds, with no pipeline to build or maintain — exactly matching
"least operational overhead, no pipeline code." **A is wrong** —
scheduled Glue jobs are pipeline code that must be built, tested, and
maintained, and introduce batch latency. **B is wrong** — DMS CDC
works and is lower-latency than batch, but it's still a pipeline you
configure and operate; zero-ETL removes that entirely for this exact
source/target pair. **D is wrong** — manual scripts are the opposite
of "least operational overhead" and introduce both latency and
maintenance burden.

---

**Q12.** Which Redshift distribution style copies a full copy of a
table onto every node, and is best suited for small, frequently joined
dimension tables?

A. KEY
B. EVEN
C. ALL
D. AUTO

**Answer: C.** `DISTSTYLE ALL` replicates the entire table to every
node, eliminating shuffling entirely for that table — ideal for small
dimension tables joined frequently against large fact tables. **A is
wrong** — KEY distributes rows by a chosen column's value across
nodes, useful for large tables joined on that key, but doesn't
replicate the full table everywhere. **B is wrong** — EVEN
round-robins rows with no join optimization in mind. **D is wrong** —
AUTO lets Redshift choose automatically (often starting as ALL and
growing into EVEN), which can end up behaving like ALL for a small
table, but it isn't the explicit "always full copy on every node"
guarantee that ALL provides — the question asks for the specific
mechanism, which is ALL.

---

**Q13.** A team stores millions of small (under 1 MB) files in S3 that
are queried through Athena, and query performance is poor. What is
the most likely cause?

A. The bucket needs Intelligent-Tiering enabled
B. The small-file problem — per-file overhead is dominating query time
C. Athena's concurrency quota has been exceeded
D. The bucket policy is misconfigured

**Answer: B.** Millions of small files create high per-file overhead
(opening, reading metadata for each file) that dominates and slows
query execution — the classic small-file problem. **A is wrong** —
Intelligent-Tiering affects storage cost/tiering, not query
performance, and its per-object monitoring fee would actually make
this scenario worse, not better. **C is wrong** — a concurrency quota
issue produces queuing/throttling errors, not generally slow
per-query performance from file layout. **D is wrong** — a bucket
policy issue would cause access-denied errors, not slow but successful
queries.

---

**Q14.** Which combination correctly matches a DynamoDB secondary
index type to a constraint about when it can be created?

A. GSI must be created at table creation; LSI can be added anytime
B. LSI must be created at table creation; GSI can be added anytime
C. Both must be created at table creation
D. Neither has a creation-time constraint

**Answer: B.** A Local Secondary Index (LSI) shares the base table's
partition key and must be defined **at table creation time**; it
cannot be added later. A Global Secondary Index (GSI) can be added at
any time after the table exists. **A is wrong** — it reverses the
actual constraint. **C is wrong** — GSIs specifically do not have this
restriction. **D is wrong** — LSI clearly does have a creation-time
constraint.

---

**Q15.** Which file format offers the best schema-evolution support
among common row-based formats used for streaming ingestion?

A. CSV
B. JSON
C. Avro
D. Parquet

**Answer: C.** Avro is specifically designed with strong,
built-in schema-evolution support and is commonly paired with schema
registries for streaming ingest. **A is wrong** — CSV has no schema
metadata at all and no evolution support. **B is wrong** — JSON is
flexible but has no formal schema-evolution mechanism of its own. **D
is wrong** — Parquet is columnar (not row-based) and, while it
supports schema evolution reasonably well, it's optimized for
analytical reads, not streaming ingest, which is what this question
specifically asks about.

---

**Q16.** A retailer needs to let its finance team run complex,
sub-second dashboard queries against terabytes of sales data with
hundreds of concurrent users. Which service best fits?

A. Amazon Athena
B. Amazon Redshift
C. Amazon S3 with Glacier lifecycle rules
D. Amazon DynamoDB

**Answer: B.** Redshift is built for exactly this: sub-second to
seconds query latency, complex joins, and high concurrency for BI
workloads, especially with concurrency scaling for peak periods. **A
is wrong** — Athena's concurrency limits make it a poor fit for
hundreds of simultaneous dashboard users; the presence of S3 data
alone doesn't make Athena correct. **C is wrong** — Glacier lifecycle
rules are about archival cost, entirely unrelated to serving live
dashboard queries. **D is wrong** — DynamoDB doesn't support the
complex multi-table joins and aggregations dashboards need.

---

**Q17.** Which Redshift feature lets you query live operational data
in Aurora directly from a Redshift SQL statement without building an
ETL pipeline?

A. Redshift Spectrum
B. Redshift Federated Query
C. Materialized Views
D. Redshift data sharing

**Answer: B.** Federated Query reaches into a live operational
database (like Aurora/RDS) directly from Redshift SQL, with no ETL
pipeline required. **A is wrong** — Spectrum queries data sitting in
S3, not a live operational database. **C is wrong** — a materialized
view caches a query result already inside Redshift; it doesn't reach
out to an external live database. **D is wrong** — data sharing
exposes live data between Redshift clusters/accounts, not between
Redshift and an external operational database like Aurora.

---

**Q18.** A media company must delete a specific set of customer
records from a petabyte-scale S3 data lake to satisfy a GDPR
right-to-be-forgotten request, without rewriting entire partitions.
What table technology should the lake use?

A. Plain Hive-style partitioned Parquet tables
B. Apache Iceberg
C. CSV files with daily folders
D. DynamoDB export snapshots

**Answer: B.** Apache Iceberg supports row-level `DELETE` operations,
letting you remove specific rows without rewriting the entire affected
partition. **A is wrong** — Hive-style tables have no row-level delete
mechanism; satisfying this request would require rewriting whole
partitions, which is exactly what the question says to avoid. **C is
wrong** — plain CSV files have no transactional or row-level delete
capability at all. **D is wrong** — DynamoDB export snapshots are a
data-export mechanism, not a lake table format with delete support.

---

**Q19.** Which AWS migration tool is purpose-built for continuous,
online synchronization of files between an on-premises NFS/SMB share
and AWS storage?

A. AWS Snowball
B. AWS DataSync
C. AWS Transfer Family
D. AWS AppFlow

**Answer: B.** DataSync is built for ongoing, scheduled, online
synchronization of files between on-prem file systems and AWS
storage (S3, EFS, FSx). **A is wrong** — Snowball is for one-time,
offline, bandwidth-constrained bulk transfer, not ongoing sync. **C is
wrong** — Transfer Family provides a managed SFTP/FTPS/FTP endpoint
for partner file uploads, not a sync agent for existing on-prem file
systems. **D is wrong** — AppFlow integrates with SaaS application
APIs, not on-prem file systems.

---

**Q20.** In a star schema, what does the fact table typically contain?

A. Descriptive attributes used for filtering, like customer name and region
B. Numeric, additive measures plus foreign keys to dimension tables
C. A denormalized copy of every dimension attribute
D. Only primary keys with no measures

**Answer: B.** The fact table holds measurable events (e.g., revenue,
quantity) at a defined grain, along with foreign keys pointing to
each dimension table. **A is wrong** — descriptive, filterable
attributes belong in dimension tables, not the fact table. **C is
wrong** — denormalizing dimension attributes *into* the fact table
would defeat the purpose of having separate dimension tables and
bloat the fact table enormously. **D is wrong** — a fact table without
measures wouldn't support the aggregation queries a star schema exists
to serve.

---

**Q21.** A gaming company needs a leaderboard that updates thousands
of times per second with sub-millisecond reads, and the data must
survive a node failure without loss. Which service fits best?

A. ElastiCache for Redis without cluster mode
B. Amazon MemoryDB for Redis
C. Amazon DynamoDB with DAX
D. Amazon Aurora Serverless v2

**Answer: B.** MemoryDB is a durable, in-memory, Redis-compatible
database purpose-built for sub-millisecond latency while surviving
node failures without data loss — unlike a pure cache. **A is
wrong** — a non-durable cache can lose data on node failure, which
the question explicitly rules out. **C is wrong** — DynamoDB+DAX gives
microsecond cached reads but DynamoDB's own latency floor and cost
model aren't as purpose-fit for this specific "thousands of updates
per second, must survive failure" in-memory pattern as MemoryDB. **D
is wrong** — Aurora Serverless v2 is a relational database; it can't
match sub-millisecond in-memory latency for this access pattern.

---

**Q22.** Which combination of tools correctly performs a heterogeneous
database migration from on-premises SQL Server to Aurora PostgreSQL
with minimal downtime?

A. DMS full load only
B. DMS Schema Conversion to convert schema/code, then DMS full load + CDC
C. Glue crawler followed by manual table creation
D. AppFlow with a custom connector

**Answer: B.** Since SQL Server and PostgreSQL are different engines
(heterogeneous), DMS Schema Conversion converts the schema, SQL, and
stored procedures first (this capability is built into the DMS
console — it replaced the standalone AWS SCT tool, which was removed
from the exam's in-scope services list in the December 2025 exam guide
revision); then DMS performs a full load followed by CDC to keep the
target in sync until cutover, minimizing downtime. **A is wrong** —
full load alone means the source must be quiesced, causing downtime,
and it doesn't handle schema/code conversion for a heterogeneous
migration. **C is wrong** — a Glue crawler discovers and catalogs
existing schema for query engines; it doesn't convert or create a
target database schema for a different engine. **D is wrong** —
AppFlow integrates SaaS APIs, not relational database migrations.

---

**Q23.** A healthcare provider must retain medical imaging data in S3
for 10 years and legally guarantee that **no one**, including account
administrators, can delete it before that period ends. What should
they configure?

A. S3 Versioning
B. S3 Lifecycle policy with expiration disabled
C. S3 Object Lock in compliance mode
D. IAM policy denying `s3:DeleteObject`

**Answer: C.** Object Lock in compliance mode enforces WORM (write
once, read many) such that **not even the root user** can delete or
overwrite the object before the retention period expires. **A is
wrong** — versioning protects against accidental overwrite/delete by
keeping prior versions, but doesn't prevent an admin from deleting the
object or its versions outright. **B is wrong** — simply not
configuring expiration doesn't prevent manual deletion by an admin.
**D is wrong** — an IAM policy denial can be changed or bypassed by
someone with sufficient permissions (e.g., an administrator editing
the policy itself); it isn't an immutable legal guarantee the way
compliance-mode Object Lock is.

---

**Q24.** Which pairing correctly matches a Slowly Changing Dimension
type to its behavior?

A. Type 1 keeps full history via new rows; Type 2 overwrites in place
B. Type 2 keeps full history via new rows; Type 1 overwrites in place
C. Type 3 keeps full history; Type 1 tracks only the prior value
D. All three types behave identically for reporting purposes

**Answer: B.** Type 2 inserts a new row (with effective/expiry dates or
a current flag) to preserve full history; Type 1 simply overwrites the
old value with no history retained. **A is wrong** — it reverses Type
1 and Type 2's behaviors. **C is wrong** — Type 3 only tracks the
*immediately prior* value in an added column, not full history; Type
1 tracks no history at all, not "only the prior value." **D is
wrong** — the three types have materially different reporting
implications, which is the entire reason to choose among them
deliberately.

---

**Q25.** An e-commerce platform's Redshift cluster experiences severe
data skew after a recent schema change. Investigation shows the fact
table was distributed with `DISTKEY` on an `order_status` column that
only has 4 possible values. What's the correct fix?

A. Switch to `DISTSTYLE EVEN` or choose a higher-cardinality join key for `DISTKEY`
B. Add more sort keys to the same column
C. Increase the cluster's node count without changing distribution
D. Convert the table to DynamoDB

**Answer: A.** A low-cardinality `DISTKEY` causes rows to pile onto
just a few slices — the fix is either `DISTSTYLE EVEN` (spread rows
round-robin) or, if joins matter, choosing a higher-cardinality column
that better distributes data while still supporting the dominant join.
**B is wrong** — sort keys accelerate range filtering, they don't
address data distribution/skew across nodes; this is a distribution
problem, not a sort problem. **C is wrong** — adding nodes doesn't fix
skew; the same lopsided small set of values will still concentrate on
a small subset of slices. **D is wrong** — this is a warehouse
analytics workload; DynamoDB is a different engine entirely and
migrating to it doesn't address the actual root cause.

---

**Q26.** A company wants business users across departments to search
for and request access to datasets, see who owns each one, and
understand its business meaning — without needing to know underlying
table names. What should they use?

A. Glue Data Catalog alone
B. Amazon Macie
C. SageMaker Catalog / Amazon DataZone
D. AWS Config

**Answer: C.** SageMaker Catalog (built on DataZone) provides the
business-facing layer — ownership, glossary terms, discovery, and a
publish/subscribe access-request workflow — on top of the technical
catalog. **A is wrong** — the Glue Data Catalog is purely technical
metadata (schema, location, format); it has no business glossary,
ownership model, or access-request workflow on its own. **B is
wrong** — Macie discovers and classifies sensitive data (like PII),
it isn't a discovery/glossary catalog for business users. **D is
wrong** — AWS Config tracks resource configuration compliance, unrelated
to dataset discovery.

---

**Q27.** A data engineering team's Athena table has grown to millions
of partitions, and both `MSCK REPAIR TABLE` and scheduled crawler runs
have become too slow and expensive. The partitioning scheme follows a
predictable `year/month/day/hour` pattern. What should they implement?

A. Run the crawler even more frequently
B. Switch to `ALTER TABLE ... ADD PARTITION` for every partition manually
C. Athena partition projection
D. Move the data into DynamoDB

**Answer: C.** Partition projection lets Athena calculate partition
locations algorithmically from a defined, predictable pattern instead
of storing and looking up each partition in the catalog — eliminating
the sync/scan cost entirely at very large partition counts. **A is
wrong** — running the crawler more often makes the cost problem worse,
not better, and doesn't address the root cause. **B is wrong** —
manually adding millions of partitions one at a time is not scalable
and is far more operationally expensive than projection. **D is
wrong** — migrating a large analytical S3 dataset into DynamoDB
doesn't fit the access pattern (SQL analytics via Athena) and doesn't
solve a partition-management problem.

---

**Q28.** Which statement correctly distinguishes Redshift Spectrum
from Athena?

A. Spectrum requires an existing Redshift cluster and can join S3 data with warehouse tables; Athena requires no cluster at all
B. Athena requires a Redshift cluster; Spectrum does not
C. They are functionally identical with no differences
D. Spectrum cannot use the Glue Data Catalog

**Answer: A.** Spectrum extends an existing Redshift cluster to query
S3 data and join it against native warehouse tables; Athena is fully
serverless and needs no cluster of any kind. **B is wrong** — it
reverses the requirement; Athena is the one that needs no cluster.
**C is wrong** — they differ meaningfully in cluster requirement and
join capability against warehouse-native tables. **D is wrong** —
Spectrum uses the Glue Data Catalog (via an external schema) just as
Athena does.

---

**Q29.** A team needs to store embeddings for semantic search directly
alongside existing relational order data they already query with SQL,
without standing up a separate search cluster. What's the best fit?

A. Amazon OpenSearch Service vector engine
B. Aurora PostgreSQL with the pgvector extension
C. Amazon Neptune
D. Amazon Keyspaces

**Answer: B.** pgvector adds a native vector column type and ANN
indexing (HNSW/IVFFlat) directly inside PostgreSQL, letting the team
query embeddings alongside their existing relational order data in one
engine with no separate cluster. **A is wrong** — OpenSearch is a
strong choice for enterprise-scale or hybrid keyword+vector search,
but it means standing up and operating a separate search cluster,
which the question says to avoid. **C is wrong** — Neptune is a graph
database for relationship traversal, not vector similarity search.
**D is wrong** — Keyspaces is a Cassandra-compatible wide-column store
with no native vector search capability.

---

**Q30.** Which of the following correctly completes the sentence:
"___ says what the data is, ___ says who may see which parts of it,
and ___ says who owns it and how to request access."

A. Lake Formation, Glue Data Catalog, IAM
B. Glue Data Catalog, Lake Formation, SageMaker Catalog/DataZone
C. IAM, Macie, CloudTrail
D. SageMaker Catalog, IAM, Glue Data Catalog

**Answer: B.** Glue Data Catalog = technical schema/location metadata.
Lake Formation = fine-grained permissions (column/row/cell) on top of
that catalog. SageMaker Catalog/DataZone = business ownership,
glossary, and access-request workflow. **A is wrong** — it swaps the
roles of Lake Formation and Glue Data Catalog. **C is wrong** — none
of IAM, Macie, or CloudTrail fill these three specific roles (IAM does
broad access control, Macie finds sensitive data, CloudTrail audits
API calls). **D is wrong** — it scrambles the correct order and
mismatches each service to the wrong role.

---

**Q31.** A streaming platform ingests IoT sensor events continuously
into an S3-based lake using Iceberg tables. Query performance has
degraded significantly over the past six months even though data
volume growth has been modest. What is the most likely cause and fix?

A. The table needs more partitions, not fewer
B. Accumulated small files and delete files need compaction (`rewrite_data_files`/`OPTIMIZE`)
C. Switch from Iceberg back to plain Hive tables
D. Increase the EMR cluster's instance count

**Answer: B.** Continuous small writes to an Iceberg table accumulate
many small data files and delete files over time; without periodic
compaction, query performance steadily degrades even without large
volume growth. **A is wrong** — more partitions without addressing
file-level fragmentation won't fix degraded performance and could make
metadata overhead worse. **C is wrong** — reverting to Hive tables
would lose Iceberg's row-level delete/merge/time-travel capabilities
and doesn't address the actual root cause (missing maintenance), which
also exists independent of table format choice. **D is wrong** — this
is a storage-layout problem, not a compute-capacity problem; more
instances won't fix poorly compacted files.

---

**Q32.** Which best describes the correct order of IAM policy
evaluation when determining whether a request is allowed?

A. Identity policy first, then explicit deny
B. Explicit deny anywhere overrides everything; then SCPs, resource policies, permissions boundaries, session policies, and identity policies are evaluated before an implicit deny applies
C. Only identity-based policies matter; resource policies are ignored
D. SCPs are evaluated only if no identity policy exists

**Answer: B.** An explicit deny at any layer wins immediately; absent
that, the request must clear Organizations SCPs, then be allowed by a
resource-based policy or continue through permissions boundaries,
session policies, and identity-based policies, defaulting to an
implicit deny if nothing grants access. **A is wrong** — explicit deny
always takes precedence over any allow, regardless of order mentioned.
**C is wrong** — resource-based policies absolutely matter and can
grant cross-account access independent of the identity policy. **D is
wrong** — SCPs apply as an organization-wide boundary regardless of
whether an identity policy exists; they aren't conditionally skipped.

---

**Q33.** A retailer's data lake table needs to change its partitioning
scheme from daily to hourly going forward, without rewriting the
petabytes of historical data already partitioned by day. Which table
format capability enables this directly?

A. Hive-style partition directories
B. Iceberg partition evolution
C. DynamoDB GSI
D. S3 lifecycle transition

**Answer: B.** Iceberg's partition evolution lets you change the
partitioning scheme going forward while leaving existing historical
data files untouched and still queryable correctly. **A is wrong** —
changing a Hive-style table's partitioning scheme requires physically
rewriting the data into the new directory structure. **C is wrong** —
a DynamoDB GSI is an entirely different concept (a secondary index on
a key-value table), unrelated to S3 lake partitioning. **D is wrong**
— S3 lifecycle transitions change storage class over time; they have
nothing to do with a table's logical partitioning scheme.

---

**Q34.** Which scenario correctly calls for an Athena Federated Query
rather than Redshift Federated Query?

A. Joining S3 data with a live DynamoDB table directly from Athena SQL
B. Joining Redshift warehouse tables with live Aurora data
C. Sharing Redshift data cross-account
D. Caching an expensive Redshift aggregation

**Answer: A.** Athena Federated Query uses Lambda-based data source
connectors to reach non-S3 sources like DynamoDB directly from Athena
SQL — exactly this scenario. **B is wrong** — joining Redshift
warehouse tables with live Aurora data is Redshift's Federated Query,
not Athena's. **C is wrong** — cross-account sharing of Redshift data
is Redshift data sharing, unrelated to either federated query feature.
**D is wrong** — caching an expensive aggregation inside Redshift is a
materialized view, not a federated query concept at all.

---

**Q35.** A bank must prove to an auditor exactly which dataset version
and which feature-engineering job produced a specific version of a
fraud-detection model currently in production. Which AWS capability
directly supports this?

A. AWS CloudTrail management events
B. SageMaker Lineage Tracking
C. Amazon Macie
D. S3 Versioning

**Answer: B.** SageMaker Lineage Tracking automatically records the
relationships between datasets, training jobs, models, and endpoints,
which is exactly the traceability an auditor is asking for. **A is
wrong** — CloudTrail records *API calls* (who invoked what action,
when), not the data-transformation lineage connecting a dataset to a
resulting model. **C is wrong** — Macie discovers and classifies
sensitive data; it has no concept of ML pipeline lineage. **D is
wrong** — S3 Versioning tracks object versions within a bucket, not
the end-to-end relationship between a dataset, a training job, and a
model.

---

**Q36.** A company ingests transaction events into DynamoDB with a
requirement that expired promotional codes (valid for exactly 24
hours) are automatically removed at no additional cost, and the exact
deletion instant does not need to be precise to the second. What
should they configure?

A. A scheduled Lambda function that scans and deletes expired items every minute
B. DynamoDB TTL on an expiration timestamp attribute
C. An S3 lifecycle expiration rule
D. A GSI sorted by expiration time with manual cleanup queries

**Answer: B.** DynamoDB TTL automatically deletes items past a defined
timestamp attribute at no additional cost, and the question explicitly
says second-level precision isn't required — matching TTL's
best-effort (typically within 48 hours, often much faster) deletion
model. **A is wrong** — a scheduled scanning Lambda consumes read/write
capacity and adds operational cost and complexity that TTL avoids
entirely. **C is wrong** — S3 lifecycle rules apply to S3 objects, not
DynamoDB items. **D is wrong** — a GSI with manual cleanup queries adds
unnecessary capacity consumption and operational burden compared to
the built-in, free TTL mechanism.

---

**Q37.** A global manufacturer runs a mostly idle Redshift warehouse
that spikes heavily only during month-end financial close, and wants
to minimize cost the rest of the month while still getting fast
performance during the spike. Which configuration best fits?

A. A large provisioned cluster with Reserved Instances running year-round
B. Redshift Serverless
C. Athena instead of Redshift entirely
D. A fixed small provisioned cluster resized manually each month-end

**Answer: B.** Redshift Serverless scales automatically with usage and
incurs no idle cost when the warehouse isn't being used, which fits an
intermittent, spiky usage pattern far better than a steady always-on
cluster. **A is wrong** — Reserved Instances are cost-effective for
**steady, predictable, 24/7** usage; paying for a large cluster
year-round to handle one spiky period a month wastes money the rest
of the time. **C is wrong** — Athena doesn't match the requirement of
"fast performance during the spike" for a warehouse-style workload the
way Redshift is purpose-built to. **D is wrong** — manual resizing
each month is operationally burdensome and error-prone compared to
Serverless automatically scaling.

---

**Q38.** A media archive needs 7-year regulatory retention for raw
footage, retrieval is acceptable within 12 hours, and cost must be as
low as possible. Which S3 storage class fits, and what's the key trade-off to flag?

A. S3 Standard-IA — instant retrieval but higher storage cost than needed
B. Glacier Deep Archive — lowest storage cost, but retrieval takes up to 12 hours and it has a 180-day minimum storage duration
C. S3 Intelligent-Tiering — automatically optimizes for unknown access, no minimum duration
D. Glacier Instant Retrieval — millisecond access at a higher cost than Deep Archive

**Answer: B.** Deep Archive offers the lowest per-GB storage cost of
any S3 class, matches the stated 12-hour retrieval tolerance (standard
retrieval is up to 12 hours), and the key trade-off to flag is its
180-day minimum storage duration (fine here, given a 7-year retention
requirement) and its slow retrieval. **A is wrong** — Standard-IA is
more expensive than Deep Archive for data accessed this rarely,
over-paying for instant access nobody asked for. **C is wrong** —
Intelligent-Tiering is designed for *unknown/changing* access patterns
and adds a per-object monitoring fee; this scenario has a known,
stable, rarely-accessed pattern where a lifecycle rule straight to
Deep Archive is cheaper. **D is wrong** — Glacier Instant Retrieval
costs more than Deep Archive for a benefit (millisecond access) this
scenario doesn't need, since 12-hour retrieval is explicitly
acceptable.

---

**Q39.** A team is designing a new DynamoDB table. During design
review, someone proposes normalizing the data into multiple tables
mirroring a relational entity-relationship diagram, with joins
performed in application code. What is the correct critique, and what
should the team do instead?

A. This is correct — DynamoDB should always be normalized like a relational database
B. This violates DynamoDB's access-pattern-first design principle; the team should instead enumerate every required access pattern first and design partition/sort keys and indexes to serve them directly
C. There is no meaningful difference between relational and DynamoDB modeling approaches
D. The fix is to add more GSIs until every possible query works, regardless of the base table design

**Answer: B.** DynamoDB performs best when the schema is derived from
the actual access patterns the application needs, often denormalizing
data to satisfy a pattern in a single request rather than requiring
application-side joins across multiple tables/round-trips. **A is
wrong** — normalizing like a relational database is precisely the
anti-pattern the guard rail warns against for DynamoDB; it forces
expensive multi-round-trip application joins. **C is wrong** — the
two modeling philosophies are meaningfully different, and conflating
them is the root cause of poor DynamoDB designs. **D is wrong** —
indiscriminately layering GSIs onto a poorly designed base table adds
cost and write overhead without addressing the underlying design flaw;
access patterns should drive the design from the start, not be
patched on afterward.

---

**Q40.** A hospital system needs to combine three requirements for a
new patient-records data lake: (1) row-level deletion of a specific
patient's records on request, (2) merging nightly CDC updates from the
EHR system without a full reload, and (3) the ability to query the
data exactly as it existed on a specific past date for an audit. Which
single technology choice satisfies all three requirements, and why do
the alternatives fail?

A. Plain Hive-style Parquet tables on S3, because Parquet is columnar and fast
B. DynamoDB, because it supports conditional writes
C. Apache Iceberg tables on S3, because it provides row-level delete, MERGE INTO upserts, and time travel via snapshots
D. Redshift Spectrum over CSV files, because Spectrum can query S3 directly

**Answer: C.** Iceberg directly satisfies all three: row-level `DELETE`
for patient-specific removal, `MERGE INTO` for efficient CDC upserts
without full reloads, and snapshot-based time travel for auditing data
as of a specific date — no other option in the list provides all
three together. **A is wrong** — plain Hive-style Parquet tables have
no row-level delete (would require rewriting whole partitions), no
native upsert/merge support, and no time-travel/snapshot capability;
being columnar and fast for reads doesn't address any of the three
stated requirements. **B is wrong** — DynamoDB's conditional writes
solve a concurrency-control problem, not the combination of row-level
deletes at lake scale, CDC merge semantics, and historical snapshot
queries described here; DynamoDB also isn't the right engine for
petabyte-scale lake-style patient records analytics in the first
place. **D is wrong** — Spectrum can query CSV in S3, but CSV itself
has no transactional delete, merge, or snapshot/time-travel
capability; Spectrum is a query engine, not a table format, so it
inherits whatever limitations the underlying file format and layout
have — and plain CSV has none of the three required capabilities.

---

*End of Domain 2 — Data Store Management. Next: Domain 3 — Data
Operations and Support (22%).*
