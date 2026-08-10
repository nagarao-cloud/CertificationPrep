# Interview Questions — Data Engineering

> **This is job-interview prep, not exam prep.** It lives in the same
> repo as the DEA-C01 material because the vocabulary overlaps, but the
> bar here is different: an interviewer wants to hear you *reason*, not
> recite a service name. Every answer below is written the way a strong
> candidate would actually talk in a room — including the parts where
> the honest answer is "it depends, and here's what it depends on."
>
> 35 questions across five sections: **Fundamentals**, **AWS Service
> Selection**, **Data Modeling**, **Performance & Cost**, and
> **Behavioral / Experience-Shaped**. Each has a model answer of a few
> sentences — long enough to show real reasoning, short enough that you
> could actually say it out loud in an interview without losing the
> interviewer.

---

## Section 1 — Fundamentals

### Q1. Explain the difference between a data lake and a data warehouse.

A data lake stores data in its raw or lightly-processed form — any
structure, any format, schema applied at read time — typically on
cheap object storage like S3. A data warehouse stores data that's
already been modeled, cleaned, and structured for fast SQL analytics,
usually in a columnar MPP engine like Redshift. The practical
difference shows up in three places: **cost** (S3 is an order of
magnitude cheaper per GB than warehouse storage), **flexibility** (a
lake can hold JSON, images, and Parquet side by side; a warehouse wants
a defined schema before you load), and **query performance** (a
warehouse is tuned and indexed for repeated BI queries; a lake needs a
query engine like Athena or Redshift Spectrum layered on top, and
performance depends heavily on how well the data is partitioned and
compressed). In practice most organizations run both, connected by a
"lakehouse" pattern — land everything in the lake first because it's
reversible and cheap, then curate a subset into the warehouse for the
workloads that actually need warehouse-grade concurrency and query
speed.

### Q2. What is the difference between ETL and ELT, and when would you choose one over the other?

ETL transforms data *before* it lands in the target system — extract
from the source, transform in a separate compute layer (Spark, Glue),
then load the already-clean result. ELT loads raw data into the target
first and lets the target's own compute (a warehouse's SQL engine, or
Spark running against a lake table) do the transformation afterward. I
lean ELT when the target has cheap, elastic compute and the raw data
is valuable to keep around unmodified — Redshift or a Spark job running
`CREATE TABLE AS SELECT` against raw Parquet in S3 are classic
examples, and it also means a business logic change doesn't require
re-extracting from the source, just re-running a transform against
data you already have. I lean ETL when the source system is fragile or
expensive to query repeatedly, when there's a compliance reason to
strip or mask sensitive fields before they ever land anywhere durable,
or when the target genuinely can't handle a heavy transformation
workload without impacting other consumers (an operational database is
a bad place to run a large aggregation job). In an AWS-native stack,
the common answer ends up being both: raw lands untouched (ELT-shaped),
then a Glue or Spark job (ETL-shaped) produces a curated layer — the
bronze/silver/gold pattern is really ELT and ETL working in sequence
rather than a binary choice.

### Q3. Explain OLTP vs OLAP.

OLTP (online transaction processing) systems handle many small,
concurrent read/write transactions — a single order being placed, a
single row updated — and are optimized for low-latency correctness
under concurrent writes, which is why they're built on row-oriented
relational engines with strong ACID guarantees, like Aurora or RDS.
OLAP (online analytical processing) systems handle few, large,
read-heavy queries that scan and aggregate across millions of rows —
"total revenue by region last quarter" — and are optimized for scan
throughput over huge datasets, which is why they're column-oriented
(Redshift, Athena over Parquet) so a query touching 3 of 50 columns
only reads those 3 columns' data. The mistake I've seen junior
engineers make is trying to run analytical workloads directly against
an OLTP database because "the data's already there" — it works at
small scale and then falls over the moment someone runs a
month-over-month aggregation against a production order table during
business hours and takes down checkout for real customers. The
correct instinct is to replicate or CDC the OLTP data into an
OLAP-shaped store rather than let analytics compete with production
traffic for the same row locks and buffer cache.

### Q4. What is data partitioning and why does it matter?

Partitioning splits a large dataset into smaller physical chunks based
on a column's value — date, region, customer segment — so a query
engine can skip entire chunks it knows can't contain relevant rows
instead of scanning everything. In S3-backed lakes this typically
means a directory structure like `year=2026/month=08/day=09/`; in
Redshift it's the distribution and sort key design; in DynamoDB it's
the partition key that determines which physical partition an item
lives on. The performance impact is enormous and directly tied to
cost in AWS specifically — Athena and Redshift Spectrum bill per byte
scanned, so a query that only needs one day's data but scans a whole
year because the table isn't partitioned on date can be 100x more
expensive than it needs to be for identical results. The trap I watch
for is over-partitioning: too many small partitions (hourly instead of
daily on a low-volume table, or a naive per-minute Firehose write)
creates a "small file problem" where the overhead of opening thousands
of tiny files outweighs the benefit of skipping data, so partition
granularity has to match query patterns and data volume, not just be
maximized.

### Q5. Explain the CAP theorem and how it applies to distributed data systems.

CAP says a distributed system can only fully guarantee two of
Consistency, Availability, and Partition tolerance at the same time —
and since network partitions are a fact of life in any real
distributed system, the actual trade-off in practice is between
consistency and availability during a partition. DynamoDB defaults to
eventual consistency on reads for higher availability and lower
latency, with strongly consistent reads available as an opt-in that
costs more capacity and can be slower; a traditional single-writer
relational database like Aurora prioritizes consistency, at the cost
of availability if the primary is unreachable until failover completes.
The theorem matters practically when you're choosing a store for a
specific access pattern: if a shopping cart briefly showing stale
inventory is an acceptable trade-off for the cart never being
unavailable, eventual consistency is fine and DynamoDB's default
behavior is a feature, not a bug. If a bank balance being briefly wrong
is unacceptable under any circumstance, you need strong consistency
even if it means a request occasionally fails or waits during a
partition — that's the Aurora/RDS answer. The interview mistake is
treating CAP as a reason to avoid distributed systems altogether;
every real system already makes this trade-off, the skill is making it
consciously per use case instead of by accident.

### Q6. What's the difference between batch and streaming processing? When would you use each?

Batch processes a bounded set of data — everything that arrived since
the last run — on a schedule; streaming processes an unbounded,
continuous flow of events as they arrive, usually with some notion of
windowing for aggregation. The real decision driver isn't "which
sounds more modern," it's the actual latency requirement stated in the
business's own words: if a report needs to be correct as of yesterday,
a nightly Glue job is not just adequate, it's *better* than streaming
because it's simpler, cheaper, and easier to reason about when
something goes wrong. If a fraud model needs to score a transaction
within 200 milliseconds of it happening, nothing batch-shaped can meet
that, and you need Kinesis Data Streams or Managed Service for Apache
Flink doing continuous, stateful computation. I've seen teams reach
for streaming architectures for genuinely batch-shaped problems because
it looked impressive on a design doc, and it cost them real ongoing
operational burden — a Flink job that needs checkpointing, state
management, and 24/7 monitoring is a standing liability compared to a
Glue job that runs for ten minutes a night and then disappears. The
right question is always "what does the business actually lose if this
data is five minutes late," and the answer usually justifies less
architecture than people assume.

### Q7. Explain idempotency and why it matters in data pipelines.

An idempotent operation produces the same result no matter how many
times it's applied — running it once or five times leaves the system
in the same state. It matters because almost every distributed
messaging system in AWS (SQS standard, Kinesis, SNS) guarantees
**at-least-once** delivery, not exactly-once, which means duplicate
delivery of the same event is not a hypothetical edge case, it's a
certainty over a long enough time window — a consumer crashes after
processing but before acknowledging, and the message gets redelivered.
If the downstream write isn't idempotent, that duplicate becomes a
double-counted transaction, a duplicated row, or a customer billed
twice. The fix isn't to chase exactly-once delivery, which is
expensive or outright impossible across service boundaries — it's to
make the *processing* idempotent: a conditional write keyed on a
unique event ID (DynamoDB `PutItem` with a condition expression), an
upsert/`MERGE` keyed on a natural key instead of a blind `INSERT`, or a
dedup table checked before a side effect fires. I treat "is this
operation safe to run twice" as a design question I ask before writing
any consumer, not something I patch in after the first duplicate
incident.

### Q8. What is schema-on-read vs schema-on-write?

Schema-on-write means the schema is enforced at the moment data is
written — a relational database rejects a row that doesn't match its
column types, so by the time data is stored, it's guaranteed to be
structurally valid. Schema-on-read means the data is stored as-is
(JSON, CSV, raw text) and the schema is applied by whatever tool reads
it later — a Glue crawler inferring columns from Parquet files, or
Athena applying a table definition to files that were never validated
against it when they landed. Schema-on-write gives you correctness
guarantees up front at the cost of flexibility — adding a new field
means an `ALTER TABLE` and a migration plan. Schema-on-read gives you
flexibility to ingest first and figure out structure later, which is
exactly why data lakes are schema-on-read by default, but it pushes
the risk downstream: a malformed or unexpectedly-shaped record doesn't
fail loudly at write time, it silently breaks a query or a job much
later, often for someone who didn't write the ingestion code. In
practice I want schema-on-write discipline at the edges of a system
(an API contract, an event schema registry) even when the storage
layer underneath is schema-on-read, because catching a bad shape at
the producer is far cheaper than debugging it three transformation
stages downstream.

---

## Section 2 — AWS Service Selection

### Q9. How would you decide between Glue and EMR for a new ETL job?

I start with three questions, not with "which is more powerful."
First: does this job need a framework Glue doesn't support natively —
Presto/Trino, HBase, or a specific Hadoop ecosystem tool — or is it
existing Spark/Hive code someone already wrote and tested? If so,
rewriting it to fit Glue's DynamicFrame model is pure unnecessary risk;
EMR runs it as-is. Second: what's the actual data volume and is cost
at that volume the dominant constraint? At petabyte scale with a
workload that tolerates interruption, EMR with Spot instances on task
nodes genuinely becomes cheaper per terabyte processed than Glue's
per-DPU pricing — that's the one case where the "more operational
overhead" option wins on merit, not just familiarity. Third, and
usually decisive for a brand-new job: does the team want to own cluster
sizing, patching, and scaling, or hand that off entirely? For net-new
ETL that's Spark-shaped, integrates with the Glue Data Catalog, and
doesn't need an EMR-only framework, Glue is almost always my default —
serverless, versioned, bookmark-aware for incremental loads, and it's
the option that survives a team member leaving without anyone having
to remember cluster maintenance.

### Q10. When would you use Kinesis Data Streams vs Amazon MSK?

The deciding question is almost never "which is technically better,"
it's "does this organization already have a real investment in the
Kafka ecosystem." If producers already speak the Kafka wire protocol,
there are existing Kafka Connect connectors, or there's a genuine
multi-cloud requirement where Kafka needs to run the same way on AWS as
it does elsewhere, MSK is correct *because* of that existing
investment — forcing a rewrite to the Kinesis API for a greenfield-only
reason isn't worth the migration risk. If it's a new, AWS-native
stream with no Kafka legacy, Kinesis Data Streams is simpler
end-to-end: on-demand mode removes shard management entirely, it's
natively integrated with Lambda event source mappings, Firehose, and
Managed Flink, and there's no broker fleet to size or patch even in MSK
Serverless's reduced-ops mode. I've had this conversation directly with
a team that wanted MSK "because Kafka is the industry standard" with
zero existing Kafka tooling anywhere in their stack — that's optimizing
for a resume line over an actual requirement, and it adds real,
ongoing operational surface for a compatibility guarantee nobody was
using.

### Q11. How do you decide between DynamoDB and a relational database like Aurora for a new service?

I ask what the access pattern actually is before I ask anything about
scale. If the pattern is fundamentally "look this item up by a key I
already know" — a session, a cart, a user profile, a device's current
state — and I can enumerate the handful of access patterns the
application needs up front, DynamoDB is a strong fit: single-digit
millisecond latency regardless of scale, and on-demand mode removes
capacity planning. If the pattern involves relationships between
entities that need to be joined, multi-row transactions that must
succeed or fail together, or ad-hoc queries the application team can't
fully predict at design time, that's a relational shape and fighting
it in DynamoDB means either denormalizing aggressively or bolting on
application-side joins that a real database does natively and
correctly. The trap I actively watch for is choosing DynamoDB "because
it scales" for a workload that's actually relational — DynamoDB scale
is a property of a specific, narrow access pattern; the moment product
adds a feature that needs "show me all orders for this account with
line items and their current shipment status joined together," you're
either doing expensive multi-query stitching in application code or
you picked the wrong store at the outset. Aurora scales plenty for the
overwhelming majority of transactional workloads that never actually
hit DynamoDB-scale throughput.

### Q12. When would you choose Athena vs Redshift for querying data in S3?

This gets decided by concurrency and query pattern, not by "the data
happens to live in S3" — that fact alone tells you nothing, because
both Athena and Redshift Spectrum can query the same S3 data. Athena
is the right default for occasional, ad-hoc, exploratory SQL — a
handful of analysts running unpredictable queries where paying per
byte scanned and having zero infrastructure to manage outweighs
needing warehouse-grade tuning. Redshift is the right answer the
moment you have recurring, predictable BI workloads with real
concurrency — hundreds of dashboard users hitting the same queries on
a refresh cycle — because Athena's per-query concurrency quotas and
lack of persistent tuning (no distribution keys, no result caching
tuned the way a warehouse's is) start to genuinely choke under that
load. A concrete signal I listen for: if someone says "the same
expensive aggregation runs constantly, and we have dozens of
simultaneous dashboard viewers," that's Redshift with a materialized
view, not Athena with CTAS. If someone says "we occasionally need to
answer a new question against last quarter's archive, unpredictably,"
that's Athena, and building a warehouse pipeline for it would be
solving a problem that doesn't exist yet.

### Q13. How would you design ingestion for a source that already has a live Kafka pipeline?

I wouldn't rewrite the producers. The existing Kafka producers keep
publishing to Kafka topics exactly as they do today, and I'd point
Amazon MSK at that role — either migrating the brokers to MSK directly
if it's a lift-and-shift, or standing up MSK alongside the existing
cluster if there's a phased cutover. From there, MSK Connect can run
Kafka Connect connectors the team may already be using to sink data
into S3, or a downstream consumer reads from MSK the same way it would
read from self-managed Kafka. The mistake to avoid is treating "we have
Kafka" as a reason to also introduce Kinesis somewhere in the same
pipeline for a reason that doesn't hold up — running two different
streaming platforms for the same data adds operational surface without
adding capability, unless there's a specific downstream AWS-native
integration (say, a Firehose delivery stream) that genuinely needs
Kinesis specifically. The overall principle: match the new
infrastructure to the protocol constraint that's actually forcing your
hand, and don't introduce a second streaming technology just because
it's more "AWS-native" if the first one is already doing the job.

### Q14. When would you use AWS DMS vs a zero-ETL integration?

Zero-ETL is the answer when the specific source/target pair is
supported natively — Aurora or RDS MySQL to Redshift, DynamoDB to
OpenSearch — and there's no meaningful transformation needed in
between; AWS manages the replication pipeline entirely, and it's
almost always the lower-effort, lower-latency choice when it applies,
because there's no replication instance to size or CDC task to
monitor. DMS is the broader, more general tool: any relational or
NoSQL source with a supported CDC mechanism, going to nearly any
target including non-AWS-native pairs, with control over the
replication instance, task settings, LOB handling, and transformation
rules along the way. I reach for DMS specifically when the source or
target isn't in zero-ETL's supported list, when it's a heterogeneous
migration (say, on-prem Oracle to Aurora PostgreSQL) that also needs
schema and stored-procedure conversion — that capability now lives
inside the DMS console as DMS Schema Conversion, after the standalone
AWS SCT tool was folded into DMS — or when I need finer control over
the replication task than a zero-ETL integration exposes. The honest
summary I'd give in an interview: zero-ETL is DMS's job already solved
for you for a narrowing set of common pairs; reach for DMS directly the
moment your pair, your transformation needs, or your control
requirements fall outside that set.

### Q15. How do you decide between Step Functions and MWAA for orchestration?

Step Functions is my default for new, AWS-native orchestration —
serverless, pay per state transition, gives a visual and auditable
execution history for free, and Standard workflows support up to a
year of duration with exactly-once semantics for anything that needs a
clean audit trail. I reach for MWAA specifically when there's an
existing investment that makes switching expensive: a team already has
a library of Airflow DAGs, custom Python operators, or hooks that
would take real engineering time to reimplement as Step Functions state
machine JSON. MWAA is never the "least operational overhead" choice on
its own merits — it's an always-on environment you're paying for
whether or not anything is running — so I wouldn't introduce it into a
greenfield AWS-only pipeline just because Airflow is a popular tool;
that's optimizing for familiarity over actual constraint. The pattern
I've seen work well: EventBridge fires the trigger, Step Functions
handles AWS-native branching and retries for the majority of the
pipeline, and if there's a genuinely complex, Python-heavy DAG
somewhere in the middle that predates the AWS migration, MWAA owns that
piece specifically rather than the whole orchestration layer.

### Q16. When would you introduce Apache Iceberg into a data lake, and when would you not bother?

I introduce Iceberg the moment a lake table needs any of: row-level
updates or deletes (GDPR/CCPA right-to-be-forgotten requests against a
plain Hive table mean rewriting an entire partition, which doesn't
scale), CDC merges into a lake table (Iceberg's `MERGE INTO` replaces
what used to be a fragile "drop and reload the whole partition" job),
time travel or rollback for audit purposes, or safe concurrent writers
against the same table. By 2026 that covers most new lake tables in an
AWS-native architecture, which is why I treat Iceberg as the default
rather than an exception. Where I wouldn't bother: a genuinely
write-once, append-only dataset with no update/delete/schema-evolution
requirement in sight — a plain Parquet table is a legitimate lower-
overhead choice there, because Iceberg tables need ongoing compaction
and snapshot-expiration maintenance to stay healthy, and that's real
operational work if you're managing it yourself. That said, **Amazon
S3 Tables** changes that calculus — it runs Iceberg's compaction,
snapshot cleanup, and tiering automatically as a property of the
storage layer, which is why I'd now lean toward Iceberg-via-S3-Tables
even for a table that doesn't obviously need Iceberg's features today,
because the operational cost of adopting it up front is much lower than
it used to be, and schema requirements have a way of changing sooner
than teams expect.

---

## Section 3 — Data Modeling

### Q17. Walk me through how you'd design a DynamoDB table for an e-commerce order system.

The first thing I do is not open the console — I write down every
access pattern the application actually needs, because DynamoDB
schema design is access-pattern-first, not entity-relationship-first.
For orders, that typically looks like: "get a customer's full order
history sorted by date," "get all line items for a given order," and
separately "get all orders with status PENDING across all customers"
for an operations dashboard. The first two are served by a single
table with partition key `CUSTOMER#<id>` and sort key
`ORDER#<date>#<orderid>`, using the classic single-table-design
adjacency-list pattern so an order and its line items share a
partition and come back in one query. The third pattern — status
across all customers — can't be served efficiently by that same key
structure, so it needs a **Global Secondary Index** with partition key
`OrderStatus` and sort key `OrderDate`. If I'd known about that access
pattern before the table was created and needed strong consistency, an
LSI would be the alternative, but LSIs have to be defined at table
creation and can't be retrofitted — which is exactly why "we discovered
this access pattern after the table already existed in production" is
such a common real-world reason GSIs, not LSIs, end up being used even
when an LSI would otherwise fit.

### Q18. Explain star schema vs snowflake schema and when you'd choose each.

A star schema has one central fact table (the measurable events —
sales transactions, page views) surrounded by denormalized dimension
tables (product, customer, date) that each join directly to the fact
table with no further normalization inside the dimensions themselves.
A snowflake schema normalizes those dimensions further — product
splits into product and category tables, for instance — trading some
storage and simplicity for reduced redundancy and easier updates when
a dimension attribute changes. I default to star schema for analytics
workloads specifically because BI query performance matters more than
storage efficiency at the scale most warehouses operate — fewer joins
means faster aggregation, and dimension tables are small enough that
the "wasted" redundant storage from denormalization is negligible next
to the fact table itself. I'd reach for a snowflake schema when a
dimension is large and changes frequently enough that update anomalies
from denormalization become a real operational cost, or when a
sub-dimension is shared and reused across multiple fact tables in a way
that's cleaner to maintain normalized. In an AWS Redshift context this
also interacts with distribution and sort key design — a star schema's
small dimension tables are natural candidates for `DISTSTYLE ALL`
(broadcast to every node) so joins against the large fact table never
require a network shuffle.

### Q19. What are Slowly Changing Dimensions and how do you implement Type 2?

A Slowly Changing Dimension is a dimension whose attribute values
change over time but not on every load — a customer's address, a
product's price tier — and the modeling question is whether you need
to preserve history of those changes or just keep the current value.
Type 1 overwrites the old value with the new one, losing history, which
is fine when the old value has no analytical relevance going forward.
Type 2 preserves every historical version as a new row, typically with
`effective_start_date`, `effective_end_date`, and an `is_current` flag
— when a customer moves, the old row gets an end date set and
`is_current` flipped to false, and a new row is inserted with the new
address and `is_current` true. This matters enormously for correct
historical reporting: without Type 2, a report asking "what was total
sales by region last year" silently reattributes historical sales to a
customer's *current* region instead of the region they were actually in
at the time of purchase, which is wrong and usually invisible until
someone notices the numbers don't reconcile with a prior report. In an
AWS Iceberg-based lake, I'd implement Type 2 with a `MERGE INTO`
statement that closes out the old row's `effective_end_date` and inserts
the new version in the same transaction, using Iceberg's row-level
update support rather than the old Hive-table pattern of rewriting the
entire dimension table on every change.

### Q20. How do you handle schema evolution in a data lake?

The foundational choice is using an open table format like Apache
Iceberg rather than plain Hive-style partitioned files, because schema
evolution on Iceberg — adding, dropping, renaming, reordering, or
widening columns — is a metadata-only operation that doesn't require
rewriting existing data files, whereas the same change against a plain
Hive table means either breaking every downstream query referencing the
old schema or a full rewrite of historical data. On the ingestion side,
Glue's DynamicFrame abstraction with `resolveChoice()` handles a column
that's sometimes a string and sometimes a number across different
source batches without the job failing outright, which matters when
schema drift originates upstream in a source system nobody controls.
Operationally, I want a crawler or a schema-registry-style check that
detects drift early — a new column silently appearing, a type change —
rather than discovering it when a downstream job throws an error at 3
AM, and I want new columns to default to nullable/additive rather than
breaking changes so consumers don't have to update in lockstep with
producers. The failure mode I actively design against is a breaking
change (renaming or narrowing a column type) shipping without any
consumer being notified — that's a coordination problem as much as a
technical one, and it's why schema evolution policy belongs in a data
contract, not just in table DDL.

### Q21. What's the difference between a fact table and a dimension table?

A fact table holds the measurable, numeric events of a business
process — the thing you're actually trying to analyze, like a sales
amount, a page view, a transaction count — at a defined grain, with
foreign keys pointing out to the dimensions that give that event
context. A dimension table holds the descriptive attributes that
explain who, what, where, and when about a fact — customer name,
product category, store region, calendar date — and is typically much
smaller and changes far less often than the fact table it supports.
The grain of the fact table is the single most important modeling
decision and the one most often gotten wrong: if the fact table is "one
row per order" but the business later asks a question that needs
"one row per line item," the table can't answer it without a redesign,
so I always push to define grain explicitly and as granular as
reasonably justified up front, because it's much easier to aggregate a
fine-grained fact table up than to disaggregate a coarse one after the
fact. In practice, fact tables are where the volume lives (millions to
billions of rows) and dimension tables are where the readability lives
— getting both right is what makes a star schema fast to query and
intuitive for analysts to self-serve against.

### Q22. How would you model data for a system that needs both fast lookups and complex analytical queries?

I wouldn't try to make one store do both well — that's the core
mistake this question is testing for. Fast, single-digit-millisecond
lookups by a known key and complex multi-table analytical aggregation
have fundamentally opposed storage layouts: row-oriented for fast
point access, column-oriented for fast scan-and-aggregate. The pattern
I'd use is polyglot persistence with CDC or a zero-ETL integration
bridging them: the operational path runs on DynamoDB or Aurora for the
lookups the application actually needs in real time, and a
near-real-time or scheduled pipeline (DynamoDB Streams, Aurora zero-ETL
to Redshift, or straightforward CDC via DMS) replicates that same data
into an analytics-shaped store — a curated Iceberg lake table or a
Redshift warehouse — without the analytics workload ever competing for
the operational store's capacity. This also gives you a reversibility
benefit: if the analytics engine choice turns out to be wrong later
(Athena isn't handling the concurrency, say), you swap the query engine
against the lake without touching the operational path at all, because
the two systems were never coupled beyond the replication pipeline in
the first place.

### Q23. Explain normalization vs denormalization and how the trade-off differs between OLTP and analytics use cases.

Normalization organizes data to minimize redundancy — each fact stored
exactly once, related through foreign keys — which protects update
integrity: change a customer's address once, and every table
referencing that customer sees the new value without an update anomaly.
Denormalization deliberately introduces redundancy to avoid joins at
query time, trading update complexity for read speed. In OLTP systems,
normalization usually wins because the workload is dominated by writes
and updates to individual rows, and update anomalies from
denormalization (an address updated in one place but not another) are
a real correctness risk in a system of record. In analytics, the
workload flips — overwhelmingly reads, rarely if ever in-place updates
to historical fact rows — so denormalization (a star schema's flat
dimension tables, or a wide, pre-joined table materialized for a
dashboard) trades a small amount of redundant storage for
dramatically fewer joins per query, which is almost always the right
trade at analytics scale. The interview-level nuance worth stating out
loud: this isn't a universal rule, it's a consequence of the two
workloads' actual read/write ratios — if I ever see a team
denormalizing a genuinely write-heavy operational table for "query
speed," that's usually solving the wrong problem, and the fix is
indexing or a purpose-built read replica, not giving up update
integrity.

---

## Section 4 — Performance & Cost

### Q24. A Redshift cluster's dashboard queries have gotten slower over the last six months as data volume grows. How do you approach diagnosing and fixing it?

I start with `SVL_QUERY_SUMMARY` and the query plan for the slow
queries specifically, not with a general "throw more nodes at it"
instinct, because the two most common real-world Redshift performance
complaints — a bad distribution key and a bad sort key — both look
like "it's just slow" from the outside but have completely different
fixes. If the query plan shows a broadcast or redistribute step
dominating runtime, that's a distribution key mismatched to the
dominant join pattern — data isn't co-located on the same node for the
join, so Redshift is shuffling it across the network on every query,
and the fix is picking a `DISTKEY` aligned to what's actually being
joined most often (or `DISTSTYLE ALL` for small, frequently-joined
dimension tables). If the plan shows large sequential scans that
should have been range-filtered, that's a sort key that no longer
matches the query pattern — zone maps only help if the filtered column
is the sort key, so as query patterns evolve alongside a six-months-
of-growth dataset, the original sort key choice can simply stop fitting.
I'd also check whether `VACUUM`/`ANALYZE` are keeping up — heavy
delete/insert churn without regular vacuuming leaves dead rows bloating
scans — and only after ruling out all three would I consider a genuine
capacity problem that calls for concurrency scaling or a resize,
because throwing capacity at a design problem just makes the same
mistake more expensive.

### Q25. How do you reduce Athena query costs?

Athena bills per byte scanned, so every lever is really a variation of
"scan less data for the same answer." The biggest lever is almost
always **partitioning combined with Parquet and compression** — moving
from unpartitioned CSV to date-partitioned, Snappy-compressed Parquet
routinely cuts scanned bytes by 90% or more because partition pruning
skips whole prefixes and columnar storage means a query touching 3 of
40 columns only reads those 3. Where partition cardinality would
otherwise explode the Glue Catalog with millions of partition entries
(a table partitioned by hour going back years, for instance),
**partition projection** computes partition locations from a naming
convention instead of storing every partition as catalog metadata,
which also speeds up query planning itself. On the query-authoring
side, I push analysts toward `SELECT` only the columns they need rather
than `SELECT *`, and toward materializing frequently-repeated expensive
queries with **CTAS** into a smaller Parquet result set rather than
re-scanning the full source table every time. Finally, **workgroups**
with per-query or per-workgroup data-scanned limits act as a cost
guardrail against a runaway or accidentally unfiltered query — I treat
that as a safety net, not a substitute for the actual partitioning and
format work, because a limit just fails the query loudly instead of
making it cheap.

### Q26. Walk me through how you'd optimize a Spark job that's taking too long.

First I look at the Spark UI (or Glue's job metrics, which surface the
same underlying signal) for the task-duration distribution across
stages, because the single most common cause of "this job used to take
12 minutes and now takes 3 hours" is **data skew** — one partition key
has disproportionately more rows than the others, so a handful of
tasks run far longer than the rest while most executors sit idle
waiting. If the task durations are roughly even but the job is still
slow, I'd check whether the data volume or shape genuinely changed
upstream — a new column, a source that quietly started sending 10x the
records — before assuming it's a code regression. From there, the
concrete fixes depend on what stage the time is going: for skew,
salting the key or repartitioning before the shuffle spreads the work
evenly; for a shuffle-heavy job in general, checking whether a broadcast
join would avoid the shuffle entirely for a small-enough side table;
for excessive small files, coalescing before write. Only after ruling
out skew, volume change, and shuffle inefficiency would I consider
scaling up — increasing Glue worker type from G.1X to G.2X, or adding
EMR task nodes — because scaling compute against an unfixed skew
problem just makes the same three slow tasks finish slightly faster
while still bottlenecking the whole job on them.

### Q27. What levers do you have to reduce your organization's overall AWS data platform bill?

I think about this in layers, roughly ordered by leverage. Storage
layer: lifecycle policies moving cold data from S3 Standard to
Infrequent Access to Glacier based on actual access frequency, and
switching row-based formats to Parquet with compression, which reduces
both storage cost and every downstream query's scan cost simultaneously
— this is usually the single highest-leverage change because it
compounds across every query that ever touches that data again.
Compute layer: right-sizing Glue worker types and EMR cluster sizing
against actual data volume instead of leaving defaults in place, using
Spot instances on EMR task nodes for interruption-tolerant workloads,
and using Redshift Serverless or Aurora Serverless v2 for workloads
that are genuinely spiky rather than paying for always-on provisioned
capacity that sits idle most of the day. Query layer: partition
pruning and workgroup limits on Athena, materialized views for
repeated expensive Redshift aggregations. And organizationally, the
lever that actually sustains all of the above: cost visibility — tags
and Cost Explorer dashboards broken down by team or pipeline, because
the biggest cost reductions I've seen come not from any single
technical fix but from a team seeing their own number for the first
time and having an actual incentive to optimize their own workload
instead of treating the AWS bill as someone else's problem.

### Q28. Explain data skew and how you'd detect and fix it in a distributed processing job.

Data skew is an uneven distribution of data across partitions relative
to a key used for grouping, joining, or shuffling — one partition key
value (or a small number of them) accounts for a disproportionate share
of the rows, so whichever task processes that partition takes far
longer than the others, and since a distributed job typically can't
finish until its slowest task finishes, the whole job's runtime is
bottlenecked by that one partition regardless of how many other
executors are sitting idle. I detect it by looking at the task-duration
distribution in the Spark UI or Glue job metrics — a handful of tasks
running 10x longer than the median is the signature — rather than
looking at aggregate cluster metrics, which can look perfectly healthy
on average while masking a severe skew. Fixes depend on where the skew
comes from: for a join where one key dominates, salting (appending a
random suffix to the skewed key to artificially spread it across more
partitions, then aggregating the split results back together) or
switching the small side of the join to a broadcast join so the skewed
side never needs to be shuffled at all; for a `GROUP BY` on a skewed
column, two-phase aggregation (partial aggregate per salted key, then a
final aggregate) accomplishes something similar. Adding more nodes
doesn't fix skew — it just gives the non-skewed tasks even more idle
capacity to wait in while the skewed task still runs on one node — which
is exactly the trap this question is testing whether a candidate falls
into.

### Q29. How do you decide when to denormalize / pre-aggregate data for performance vs. compute it on the fly?

The decision comes down to how often the same expensive computation
repeats versus how fresh the answer needs to be. If a dashboard runs
the same heavy aggregation every time someone loads the page, and
sub-minute freshness isn't actually required, pre-aggregating (a
Redshift materialized view refreshed on a schedule, or a scheduled Glue
job that writes a pre-joined gold-layer table) trades a small amount of
staleness for a massive, repeated query-time win — you pay the
computation cost once instead of once per page load. If the query is
genuinely ad-hoc and unpredictable, or the underlying data changes so
frequently that a materialized result would be stale within seconds of
being computed, pre-aggregating doesn't help and just adds a
maintenance burden and a staleness risk for no real benefit — compute
it on the fly against a well-partitioned, well-indexed source instead.
The trap I watch for is pre-aggregating reflexively as a default
performance habit without checking whether the query pattern actually
repeats — a materialized view that refreshes constantly to chase
freshness on data nobody re-reads the aggregate of very often is pure
overhead with no payoff, and it's exactly the kind of "premature
optimization" that adds operational surface (a refresh job that can now
itself fail) without a matching benefit.

---

## Section 5 — Behavioral / Experience-Shaped

### Q30. Tell me about a time you had to debug a slow Spark job.

I'd walk through a concrete example using the same structure I use in
practice: what I checked first, what I found, and what actually fixed
it — because interviewers are listening for process as much as outcome.
A strong shape for this story: a nightly job that had run reliably for
months suddenly started taking hours instead of minutes; the first
thing I checked wasn't code, it was whether upstream data volume or
shape had changed, because a code regression on a job nobody touched
recently is statistically less likely than the data underneath it
shifting. I'd describe finding the skew signature in the Spark UI — a
small number of tasks dominating total runtime — tracing it to a
partition key that had recently gained a dominant value (a new large
customer, a default value some upstream system started emitting more
of), and fixing it with a salted key rather than just throwing more
workers at the cluster, which I'd explicitly note *wouldn't* have
worked and would have just cost more money for the same wall-clock
time. I'd close by mentioning what I changed afterward to prevent a
recurrence — usually adding a lightweight data-volume or skew check as
an early pipeline step that alerts before the job silently degrades
again, because the real lesson from that kind of incident is rarely
"I need to be a faster debugger," it's "how do I catch this earlier
next time."

### Q31. Tell me about a time a data pipeline failed in production. Walk me through what happened.

I'd pick an incident where the root cause wasn't obvious from the
first symptom, because that's what actually demonstrates diagnostic
skill rather than luck. A good shape: a downstream report was wrong —
not failed outright, *wrong*, which is the more dangerous failure mode
because nothing alerted — and the investigation involved tracing back
through several transformation stages before finding that a Glue job
bookmark had been unintentionally reset during an unrelated deployment,
causing the job to silently reprocess and duplicate several days of
already-loaded data instead of just picking up new records. I'd walk
through how I found it (comparing row counts against the source over
time, which flagged the exact date the discrepancy started), how I
fixed the immediate problem (deduplicating the affected date range
using the natural key, then verifying against the source), and what I
changed structurally afterward — adding a row-count or checksum
reconciliation check between source and target as a standing part of
the pipeline, not just a one-time fix. I'd close by naming what I took
away from it more broadly: silent data-quality failures are more
dangerous than loud outages, because nobody pages you for a report
that's technically running fine and quietly wrong, so I've become
much more deliberate about building reconciliation checks into
pipelines rather than only monitoring for job failure.

### Q32. Describe a time you had to make a trade-off between data quality and delivery speed.

The honest version of this answer acknowledges that the trade-off is
real and doesn't pretend there's always a clean answer that satisfies
both. I'd describe a scenario where a stakeholder needed a dashboard
for a time-sensitive decision, and the fully correct version of the
pipeline — with proper deduplication, schema validation, and a
reconciliation step — would have taken longer to build than the
decision window allowed. What I'd emphasize is how I handled the
trade-off, not that I avoided it: I shipped a version with explicit,
documented caveats about what wasn't yet validated, made sure the
stakeholder actually understood the limitation rather than assuming a
dashboard implies fully-vetted numbers, and then went back and built
the proper validation afterward rather than letting the shortcut become
permanent by default. The part I'd stress hardest is that the failure
mode to avoid isn't taking the shortcut — sometimes that's the right
call — it's taking the shortcut silently, where a stakeholder makes a
real decision believing the data has guarantees it doesn't actually
have. Being transparent about what's provisional is what separates a
reasonable trade-off from a trust problem waiting to happen.

### Q33. Tell me about a time you disagreed with a stakeholder's requirements for a data pipeline.

I'd describe a case where a stakeholder asked for something that
sounded reasonable on the surface but had an underlying assumption that
didn't hold — a request for "real-time" reporting that, when I asked
what decision it actually needed to support, turned out to have a
same-day decision cadence, meaning a nightly batch job would serve the
need just as well as a streaming pipeline at a fraction of the ongoing
operational cost and complexity. Rather than pushing back with "that's
not how this works," I'd walk through asking clarifying questions first
— what decision does this number drive, how often is that decision
actually made, what happens if the number is five minutes late versus
an hour late — because most of the time a disagreement about
requirements is really a disagreement about an unstated assumption, and
surfacing the assumption resolves it faster than arguing about the
solution. I'd describe presenting the two options with their actual
trade-offs (build the streaming pipeline now at real ongoing cost, or
ship the batch version this week and revisit if the decision cadence
genuinely changes) and letting the stakeholder make an informed call
rather than making the technical decision unilaterally or just building
what was asked for without surfacing the trade-off at all. The
underlying principle I'd name explicitly: pushing back well means
asking better questions, not asserting that I know better.

### Q34. Describe a project where you had to migrate a legacy data system to a new platform.

I'd describe the approach more than the specific system, since that's
what's transferable. For a legacy migration — say, an on-prem Hadoop
cluster or a self-managed database moving to AWS — I wouldn't start
with a big-bang cutover; I'd start by standing up the new platform in
parallel and running both systems side by side, validating that the new
pipeline's output matched the old system's output on real production
data before anyone downstream switched over. For the data movement
itself, using AWS DMS for CDC-based ongoing replication (rather than a
one-time dump-and-load) meant the source system kept running normally
throughout the migration, with the cutover reduced to a short final
sync window instead of a long outage. I'd describe how schema and
stored-procedure conversion between engines (Oracle to Aurora
PostgreSQL, for instance) needed DMS Schema Conversion as a distinct
step before the data migration itself, and how I treated that
conversion output as something to review carefully rather than trust
blindly, because automated schema translation gets most of it right but
rarely all of it. I'd close on the part that actually mattered most:
the migration succeeded not because the technology worked, but because
stakeholders had a clear rollback plan and a validation period before
the legacy system was decommissioned — the real risk in any migration
isn't the happy path, it's not having an exit if the new system
surfaces a problem after cutover that testing didn't catch.

### Q35. Tell me about a time you had to explain a complex technical decision to a non-technical stakeholder.

I'd pick an example where the technical decision had a real trade-off a
non-technical audience needed to actually understand, not just accept
on faith — something like explaining why a new feature's data would be
"eventually consistent" rather than instantly visible everywhere, to a
product manager who needed to know whether that was acceptable for the
feature they were designing. My approach is to translate the technical
mechanism into the concrete, observable behavior it produces, skipping
the "why" at the architecture level entirely until it's asked for: not
"we're using DynamoDB with eventual consistency," but "if a user
updates their profile, there's a small chance a different screen shows
the old version for up to a second before it catches up — here's
whether that matters for what you're building." I'd describe checking
understanding by asking the stakeholder to restate the trade-off in
their own words, because the failure mode in these conversations isn't
usually that the explanation was too technical, it's that both sides
nod along without actually calibrating on the same mental model, and
the mismatch only surfaces later when the behavior in production
doesn't match what the stakeholder assumed. The broader habit I'd
name: I treat "did they actually understand the trade-off" as my
responsibility to verify, not something to assume just because nobody
asked a follow-up question.
