# Amazon DynamoDB

> The serverless NoSQL key-value/document store that shows up on
> DEA-C01 both as a **source** (application/OLTP data that needs to
> reach the analytics lake) and as a **destination** (low-latency
> lookups fed by a pipeline). This file covers partition/sort key
> design, GSIs vs LSIs, capacity modes, DynamoDB Streams, TTL, PITR,
> DAX, export-to-S3 for analytics, single-table design, and hot
> partition mitigation — the topics the exam tests hardest.

## CONTENTS

- [1. Explain like I'm 12](#eli12)
- [2. Explain technically](#technical)
- [3. Explain like a Senior AWS Data Engineer](#senior)
- [4. Production architecture](#architecture)
- [5. Partition key + sort key design](#keys)
- [6. Global Secondary Indexes vs Local Secondary Indexes](#gsilsi)
- [7. Capacity modes — on-demand vs provisioned + auto scaling](#capacity)
- [8. DynamoDB Streams](#streams)
- [9. TTL (Time to Live)](#ttl)
- [10. Point-in-Time Recovery (PITR) and backups](#pitr)
- [11. DAX — DynamoDB Accelerator](#dax)
- [12. Export to S3 for analytics](#export)
- [13. Single-table design philosophy](#singletable)
- [14. Hot partition mitigation](#hotpartition)
- [15. When to use / when NOT to use](#whentouse)
- [16. Advantages and limitations](#advlim)
- [17. Pricing](#pricing)
- [18. Performance, scaling, and high availability](#perfscale)
- [19. Security](#security)
- [20. Failure scenarios and common mistakes](#failures)
- [21. Exam traps](#examtraps)
- [22. Interview questions](#interview)
- [23. Cheat sheet](#cheatsheet)
- [24. Memory tricks](#mnemonics)
- [25. Practice questions (15)](#practice)

---

<a name="eli12"></a>
## 1. Explain like I'm 12

Imagine a locker room with millions of lockers, and every locker has a
label made of one or two parts: the first part tells you *which row of
lockers* to go to (super fast, instant), and the second part (if there
is one) tells you *where in that row* — so you can also find "all the
lockers belonging to Sam" instantly instead of checking every locker in
the building. That's DynamoDB: it doesn't know how to *search* the
lockers like a librarian searching every book — it's built to jump
**directly** to the right locker(s) if you know the label. It's not
about being clever with questions; it's about being incredibly, always
fast when you already know exactly what you're looking for, even if
there are a trillion lockers.

<a name="technical"></a>
## 2. Explain technically

Amazon DynamoDB is a fully managed, serverless **key-value and
document** NoSQL database delivering **single-digit-millisecond**
latency at virtually unlimited scale. Every item lives in a **table**
and is located by its **primary key**, which is either a simple
**partition key** alone, or a **composite key** (partition key + sort
key). DynamoDB **hash-partitions** data across internal storage
partitions using the partition key, so items with the same partition
key always land on the same physical partition (enabling fast,
efficient queries scoped to one partition key) and items with
different partition keys are spread for horizontal scalability.
DynamoDB has no fixed schema beyond the primary key — every item can
have a different set of non-key attributes ("schemaless" for
everything except the keys themselves). It is not a relational
database: there are no joins, no foreign keys, and query patterns must
generally be **designed in at table-creation time** through key and
index choices, not discovered ad hoc later the way SQL allows.

<a name="senior"></a>
## 3. Explain like a Senior AWS Data Engineer

A senior engineer's first move with DynamoDB is always **"what are the
access patterns"** — asked *before* the table is designed, not after,
because DynamoDB (unlike a relational database) punishes retrofitting
new query patterns onto an existing key/index design. This inverts the
usual relational-modeling order: instead of modeling entities first and
querying however you like later, DynamoDB modeling starts from the
**exact queries the application needs** and designs partition/sort
keys and indexes specifically to satisfy them, often as a single
denormalized table (**single-table design**) rather than the
normalized multi-table shape a relational engineer defaults to. The
second senior instinct is treating DynamoDB and analytics as two
separate concerns that meet at a **boundary**: DynamoDB is the
low-latency operational (OLTP) store; the moment a requirement says
"aggregate," "join across many items," or "ad hoc analytical query,"
the answer is to **get the data out** of DynamoDB — via DynamoDB
Streams for continuous CDC-style export, or a native **export to S3**
for point-in-time bulk analytics — rather than trying to force
DynamoDB itself to answer an analytical question it isn't built for.
Third: a senior engineer defaults to **on-demand capacity** for
unpredictable or new workloads and only reaches for **provisioned +
auto scaling** once the workload's shape is well understood and the
cost savings of reserved capacity are worth the added tuning.

<a name="architecture"></a>
## 4. Production architecture

```
        ┌──────────────┐
        │  Application   │
        │  (OLTP writes/  │
        │  reads, ms       │
        │  latency)         │
        └──────┬───────┘
               │  GetItem / PutItem / Query
               v
     ┌─────────────────────────────────────┐
     │            DynamoDB TABLE               │
     │  Partition key (+ sort key) design       │
     │  GSIs for alternate access patterns       │
     │  On-demand or provisioned + auto scaling   │
     └───────┬─────────────────────┬─────────-─┘
             │                     │
    DynamoDB Streams        DAX (optional, for
    (item-level change       read-heavy, latency-
    feed, CDC-style)          critical caching)
             │
             v
    ┌─────────────────┐
    │  Lambda / Kinesis  │
    │  consumer            │
    └────────┬─────────┘
             │  transform / fan-out
             v
    ┌─────────────────────────────────────┐
    │  S3 (curated zone) — via Streams        │
    │  pipeline OR native EXPORT TO S3         │
    │  (point-in-time bulk, uses PITR,          │
    │   no read-capacity consumption)            │
    └───────┬─────────────────────────────-─┘
            │
            v
     Athena / Glue / Redshift Spectrum / EMR
     for analytical queries DynamoDB itself
     cannot efficiently answer
```

Reading the diagram: the application talks to DynamoDB directly for
**low-latency, key-based** operational reads/writes — this is the
table's core job, and it's fast precisely because it doesn't scan or
join. Two paths exist to get data **out** for other purposes: **DAX**
sits in front of the table as an optional in-memory cache for
read-heavy, latency-critical access patterns that don't need
microsecond consistency; **DynamoDB Streams** captures every item-level
change (insert/update/delete, with before/after images) as a
near-real-time feed that a Lambda function or Kinesis consumer can
process — this is the mechanism for continuous, CDC-style movement of
operational data into the analytics lake. Separately, a native
**export to S3** performs a **point-in-time, full-table bulk export**
(leveraging PITR) without consuming any of the table's provisioned/
on-demand read capacity — the right tool when the need is "a periodic
full snapshot for analytics," not "every change, continuously."

---

<a name="keys"></a>
## 5. Partition key + sort key design

| Key type | Role | Example |
|---|---|---|
| **Partition key (PK)** alone (simple primary key) | Determines the physical partition; must be unique per item | `user_id` |
| **Partition key + Sort key** (composite primary key) | PK determines the partition; sort key orders/uniquifies items **within** that partition key | `PK = user_id`, `SK = order_date#order_id` |

A composite key lets **many items share the same partition key** while
each remains individually addressable and orderable by the sort key —
this is what makes "get all of user X's orders, sorted by date" a
single, fast `Query` operation instead of a full table scan.
**Key design decisions are made at table-creation time based on known
access patterns** — this is the single biggest mental shift from
relational modeling, and the exam tests it directly: a scenario
describing a **new required access pattern that the existing key
design can't serve efficiently** is pointing at either a new GSI or a
redesigned key schema, not "just write a bigger query."

⚠️ **Exam trap:** choosing a **low-cardinality partition key** (e.g.,
`status` with only 3 possible values: `pending`/`shipped`/`delivered`)
concentrates all items into a handful of partitions, creating **hot
partitions** and throttling under load — partition key cardinality and
access-pattern uniformity are the two things to check first whenever a
scenario describes uneven performance.

<a name="gsilsi"></a>
## 6. Global Secondary Indexes vs Local Secondary Indexes

| | **Global Secondary Index (GSI)** | **Local Secondary Index (LSI)** |
|---|---|---|
| Partition key | Can be **different** from the base table's PK | **Must be the same** as the base table's PK |
| Sort key | Any attribute, different from base table's SK | Must differ from the base table's SK, but shares the same PK |
| Created | Any time (added to an existing table) | **Only at table creation** — cannot be added later |
| Capacity | Has its **own** provisioned/on-demand capacity, billed separately | Shares the base table's capacity |
| Consistency | **Eventually consistent only** (strongly consistent reads are not supported on GSIs) | Supports **both** eventually and strongly consistent reads |
| Item size limit impact | No impact on base table item size limits | Counts toward the base table's 400 KB item size limit for indexed attributes |
| Max per table | Up to 20 (default quota, raisable) | Up to 5 |
| Best for | An entirely new, independent access pattern (e.g., look up orders by `status` instead of by `user_id`) | A different sort order for the same partition key (e.g., "user's orders by amount" instead of "by date") |

⚠️ **Exam trap:** "we need a new access pattern added to an existing,
already-in-production table" almost always points to a **GSI**, since
an LSI can only be defined at table creation — if the table already
exists and the scenario doesn't mention recreating it, LSI is
disqualified by default.

⚠️ **Exam trap:** "the read must be strongly consistent" combined with
"query by an attribute other than the base table's partition key"
is a contradiction an LSI can satisfy (if the PK matches) but a GSI
cannot — GSIs are eventually consistent only, full stop.

<a name="capacity"></a>
## 7. On-demand vs provisioned capacity + auto scaling

| | **On-Demand** | **Provisioned + Auto Scaling** |
|---|---|---|
| Capacity planning | None — scales instantly to traffic | You set target RCU/WCU with min/max bounds; auto scaling adjusts within them |
| Billing | Pay per request (read/write) | Pay per provisioned capacity-hour, discounted vs. on-demand at steady utilization; Reserved Capacity available for further savings |
| Best for | New, unpredictable, or spiky workloads; unknown traffic patterns | Steady, predictable, well-understood workloads where reserved pricing beats per-request cost |
| Scaling speed | Instant (no target-tracking lag) | Auto scaling reacts to CloudWatch-tracked utilization — not instantaneous; a very sudden spike can still throttle briefly before scaling catches up |
| Risk | Cost can be higher per-request at very high sustained volume | Under-provisioning still risks throttling if traffic exceeds the max bound or spikes faster than auto scaling reacts |
| Exam favorite trigger | "unpredictable traffic," "new application, unknown patterns," "avoid capacity planning" | "steady, well-understood, cost-optimize a predictable workload" |

**Senior take:** on-demand is the safer **default** for anything new
or spiky because it removes the risk of under-provisioning-induced
throttling entirely; provisioned + auto scaling is a **later
optimization** once traffic is well characterized, chosen specifically
to reduce cost at scale — not chosen "by default" the way older exam
material sometimes implied.

<a name="streams"></a>
## 8. DynamoDB Streams

DynamoDB Streams captures a **time-ordered, near-real-time log** of
every item-level modification (insert, update, delete) in a table,
retained for **24 hours**, and consumable by **Lambda** (event source
mapping — the most common pattern) or directly by the **Kinesis
Client Library**. Each stream record can include, depending on the
configured **view type**: `KEYS_ONLY`, `NEW_IMAGE`, `OLD_IMAGE`, or
`NEW_AND_OLD_IMAGES` (the most useful for CDC — lets a consumer compute
exactly what changed).

**This is DynamoDB's CDC mechanism** — the direct analog to enabling
CDC on a relational database via DMS. Common uses: fan-out to update a
search index (OpenSearch), replicate changes into the analytics lake
(via Lambda writing to Firehose/S3, or a zero-ETL integration),
trigger downstream business logic (send a notification on a new order),
or maintain a derived/aggregated table.

⚠️ **Exam trap:** Streams retain events for only **24 hours** — a
consumer that's down longer than that loses those events permanently;
this is why a Streams-based pipeline needs monitoring/alerting on
consumer lag (`IteratorAge`-style metrics), not just "set it and
forget it."

<a name="ttl"></a>
## 9. TTL (Time to Live)

TTL lets you designate a numeric (epoch timestamp) attribute per item;
DynamoDB automatically deletes items whose TTL attribute has passed,
**at no additional cost and without consuming write capacity for the
deletion**. Deletion isn't instantaneous — it typically happens within
**48 hours** of expiration, so TTL is not a mechanism for precise,
immediate expiry enforcement (a `FilterExpression` on reads should be
used if the application logic needs to guarantee expired items are
never returned before the background deletion actually runs).

**Exam-relevant integration:** TTL deletions **do** appear in DynamoDB
Streams (marked as a system-initiated delete), which is the mechanism
for archiving expiring data to S3 before it's permanently gone — a
Lambda consuming the stream can write the "about to expire" item to
S3/Glacier as an archival step triggered by the TTL-driven delete
event.

<a name="pitr"></a>
## 10. Point-in-Time Recovery (PITR) and backups

| | **Point-in-Time Recovery (PITR)** | **On-Demand Backup** |
|---|---|---|
| What it does | Continuous backups letting you restore to **any second** in the last 35 days | A manual, full snapshot at a specific moment, retained until explicitly deleted |
| Granularity | Second-level restore point, any time in the retention window | Point-in-time at the moment the backup was taken only |
| Performance impact | None — fully managed, no capacity consumption | None — uses DynamoDB's underlying backup infrastructure, no impact on table performance |
| Best for | Protection against accidental writes/deletes ("undo" within 35 days) | Long-term archival, compliance snapshots, pre-migration safety copies |
| Restore target | Always restores to a **new table** (never overwrites the source table in place) | Always restores to a **new table** |

⚠️ **Exam trap:** restoring from PITR or a backup **always creates a
new table** — you cannot restore "in place" over the original table.
A scenario describing "the application must keep running against the
same table name during recovery" needs an application-level cutover
step (e.g., renaming/re-pointing), not an assumption that restore
magically preserves the original table.

<a name="dax"></a>
## 11. DAX — DynamoDB Accelerator

DAX is a fully managed, **in-memory cache** purpose-built for
DynamoDB, delivering **microsecond** read latency for read-heavy or
read-intensive workloads by sitting **between the application and
DynamoDB** — the application's DynamoDB SDK calls are redirected to
DAX with minimal code change (DAX is API-compatible with the DynamoDB
API for supported operations). DAX caches both **item-level results**
(`GetItem`) and **query/scan results**, with a configurable TTL, and
is **eventually consistent** (writes go to DynamoDB directly and
propagate to the cache — DAX is not the write path in a way that
provides strong consistency guarantees for reads immediately after a
write through a different path).

**When it wins:** a read-heavy workload (gaming leaderboards,
session-store lookups, product-catalog reads) where the same items are
requested repeatedly and microsecond latency (well below DynamoDB's
own already-fast single-digit-millisecond latency) genuinely matters.
**When it doesn't:** write-heavy workloads (DAX doesn't accelerate
writes), or workloads requiring strong read-after-write consistency on
every read.

<a name="export"></a>
## 12. Export to S3 for analytics

DynamoDB's native **export to S3** performs a **full or incremental
point-in-time export** of a table to S3 (as DynamoDB JSON or Amazon
Ion), using **PITR** under the hood, and — critically — **consumes
zero read capacity units**, meaning it has no performance impact on
the live table even during a large export. This is the standard,
lowest-friction answer for **"get a periodic full copy of DynamoDB
data into the data lake for analytics"** without writing custom
scan-based export code and without competing with production traffic
for capacity.

| | **Export to S3** | **DynamoDB Streams → Lambda/Firehose → S3** |
|---|---|---|
| Nature | Point-in-time, full or incremental bulk snapshot | Continuous, item-level, near-real-time |
| Capacity consumed | **Zero** | None on the table (Streams reads separately), but consumer compute cost applies |
| Best for | Periodic full-lake refresh, one-time migration, historical analytics baseline | Continuous CDC feed into the lake, real-time downstream triggers |
| Setup complexity | Low — a managed export operation | Higher — requires a Streams consumer (Lambda) and destination wiring |

⚠️ **Exam trap:** "export DynamoDB data to S3 for analytics without
impacting production read capacity" is the specific, textbook trigger
for **Export to S3**, not a manual `Scan` operation (which *does*
consume read capacity and can throttle the live table) and not
Streams (built for continuous change capture, not point-in-time bulk
export).

<a name="singletable"></a>
## 13. Single-table design philosophy

Relational modeling normalizes data into many tables and joins at
query time; DynamoDB has **no joins**, so the idiomatic pattern —
**single-table design** — instead **denormalizes multiple entity types
into one table**, using generic, overloaded key names (`PK`, `SK`) and
carefully chosen key *values* (e.g., `PK = USER#123`, `SK =
ORDER#2026-08-09#456`) so that a single `Query` against one partition
key can retrieve **multiple related entity types in one request**
(e.g., a user's profile item plus all their order items, sorted
together by sort key prefix). This trades relational normalization
purity for **fewer round trips and lower latency**, at the cost of
requiring the **full set of access patterns to be known up front** —
retrofitting a new, unanticipated access pattern onto an established
single-table design is genuinely harder than adding a new SQL query to
a normalized relational schema.

⚠️ **Exam trap:** single-table design is a DynamoDB **best practice
for OLTP access-pattern efficiency**, not a universal rule — the exam
still expects you to recognize when a workload's needs (ad hoc,
unpredictable analytical queries) mean DynamoDB itself is the wrong
engine regardless of table design; single-table design optimizes
*known* access patterns, it doesn't turn DynamoDB into an ad hoc query
engine.

<a name="hotpartition"></a>
## 14. Hot partition mitigation

A **hot partition** occurs when a disproportionate share of traffic
concentrates on one partition key value (or a small set of them) —
common causes: a low-cardinality key (e.g., a fixed `status` value), a
"celebrity item" (one extremely popular `user_id`/`product_id`), or a
time-based key where all current writes land on today's date. Because
DynamoDB's throughput ceiling is enforced **per partition**, a hot
partition throttles even when the table's aggregate provisioned/
on-demand capacity is nowhere near exhausted.

**Mitigation patterns:**

| Technique | How it works |
|---|---|
| **Write sharding** | Append a random or calculated suffix to the partition key (e.g., `status#3` instead of `status`), spreading writes across N virtual partitions, then fan-in reads across all N suffixes when querying |
| **Higher-cardinality key choice** | Choose a partition key with naturally many distinct values (e.g., `user_id` instead of `status`) |
| **On-demand capacity mode** | Absorbs some traffic bursts better than a statically under-provisioned table, though it does not eliminate the per-partition physical throughput ceiling |
| **DAX** | Offloads read pressure from a hot item to the cache layer, reducing reads that reach the hot partition directly |

⚠️ **Exam trap:** "throttling occurs even though the table's total
provisioned capacity is well above the aggregate traffic" is the
textbook hot-partition signature — the fix is a **key-design** change
(higher cardinality or write sharding), not simply raising the
table's overall provisioned capacity, which doesn't relieve pressure
concentrated on one partition.

---

<a name="whentouse"></a>
## 15. When to use / when NOT to use

**Use DynamoDB when:** you need single-digit-millisecond, key-based
reads/writes at any scale; the access patterns are known and
relatively fixed (even if numerous); you want a fully serverless,
zero-capacity-planning-required OLTP store (with on-demand mode); you
need item-level TTL expiry, or a change stream for CDC-style
downstream processing.

**Do NOT use DynamoDB when:** the workload needs ad hoc, unpredictable
analytical queries with joins/aggregations across many items — that's
Redshift, Athena, or a relational database; strong relational integrity
(foreign keys, multi-table ACID transactions across many tables) is
core to the requirement — use RDS/Aurora; the access patterns are
genuinely unknown or constantly changing — a flexible SQL engine
tolerates that better than DynamoDB's up-front key design commitment.

<a name="advlim"></a>
## 16. Advantages and limitations

**Advantages:** fully serverless, no infrastructure to manage;
single-digit-millisecond latency at any scale; on-demand mode removes
capacity planning entirely; native TTL, Streams, PITR, and Export to
S3 cover the most common operational needs out of the box; multi-Region
global tables available for active-active geo-distribution; integrates
natively with Lambda for event-driven architectures.

**Limitations:** no joins, no ad hoc analytical querying; 400 KB
maximum item size; access patterns must be substantially known at
design time; GSIs are eventually consistent only; retrofitting a new
access pattern onto an existing single-table design is a real
migration effort, not a quick schema tweak; not a substitute for a
relational database when strong multi-table transactional integrity is
required.

<a name="pricing"></a>
## 17. Pricing

**On-demand:** pay per million read/write request units, no minimum,
scales automatically. **Provisioned:** pay per hour for provisioned
RCU/WCU (read/write capacity units), with **Reserved Capacity**
available for further discount on steady, predictable workloads.
**Storage:** billed per GB-month. **DAX:** billed per node-hour,
separate from table capacity. **Streams:** reads from a stream are
billed per read request unit consumed by the consumer. **Export to
S3:** billed per GB exported, with **no** table read-capacity charge.
**Global Tables:** replicated write costs apply per additional Region.

<a name="perfscale"></a>
## 18. Performance, scaling, and high availability

DynamoDB automatically partitions and re-partitions a table as item
count and throughput grow, with no manual resharding required from the
user — but **per-partition throughput limits still apply**, which is
why key design (cardinality, access uniformity) is the real scaling
lever, not "just enable more capacity." High availability is native:
every table is **automatically replicated across a minimum of three
Availability Zones** within the Region, with no configuration required.
**Global Tables** extend this to multi-Region **active-active**
replication, letting applications read/write locally in multiple
Regions with DynamoDB handling conflict resolution (last-writer-wins
by default) — the answer for "the application needs low-latency reads
and writes from users in multiple geographic Regions with automatic
multi-Region failover."

<a name="security"></a>
## 19. Security

Encryption at rest is **on by default** using AWS-owned or
customer-managed KMS keys (no opt-out for encryption itself, only for
which key manages it); encryption in transit via TLS is enforced for
all API calls. **IAM** governs table-level and, via **fine-grained
access control (condition keys like `dynamodb:LeadingKeys`)**,
**item-level** access — this is one of the few places IAM *can* express
row-level-style restriction natively (scoping a principal to only
items whose partition key matches their own identity), though it still
cannot express column-level restriction the way Lake Formation or
Redshift RLS can for other data stores. VPC endpoints (gateway type)
keep DynamoDB traffic off the public internet from within a VPC.

<a name="failures"></a>
## 20. Failure scenarios and common mistakes

- **Choosing a low-cardinality partition key** (e.g., a status enum)
  and hitting hot-partition throttling despite ample aggregate
  capacity.
- **Designing the table around today's known queries only**, then
  needing an expensive redesign or a new GSI (and a backfill) when a
  genuinely new access pattern emerges.
- **Assuming a GSI supports strongly consistent reads** — it doesn't;
  a design requiring strong consistency on a non-base-table-PK query
  needs an LSI (defined only at creation) or a different approach.
- **Running large `Scan` operations against production traffic** for
  ad hoc analytics instead of using Export to S3 or Streams — consumes
  significant read capacity and can throttle real application traffic.
- **Letting a Streams consumer fall more than 24 hours behind** —
  events age out and are permanently lost.
- **Expecting TTL deletion to be instantaneous** — it can take up to
  48 hours, so application logic still needs a filter for "logically
  expired but not yet physically deleted" items if precise timing
  matters.
- **Restoring from PITR/backup and expecting the original table name
  to still work** — restore always creates a new table.

<a name="examtraps"></a>
## 21. Exam traps

⚠️ **New access pattern needed on an existing production table = GSI**
(can be added anytime). **LSI can only be defined at table creation** —
disqualified if the table already exists.

⚠️ **"Export to S3 for analytics without impacting read capacity" =
DynamoDB's native Export to S3 feature**, not a `Scan`, and not
Streams (which is for continuous CDC, not point-in-time bulk export).

⚠️ **Hot partition throttling despite high aggregate capacity = a key
design problem**, fixed by higher-cardinality keys or write sharding —
not by raising overall table capacity.

⚠️ **GSIs are eventually consistent only.** A requirement for strongly
consistent reads on a non-base-PK query pattern cannot be satisfied by
a GSI.

⚠️ **PITR/backup restore always creates a new table** — never restores
in place over the source table.

⚠️ **DAX accelerates reads, not writes**, and is eventually consistent
— wrong choice for a write-heavy or strict-consistency requirement.

<a name="interview"></a>
## 22. Interview questions

- *"How would you design a DynamoDB table for an e-commerce
  application's orders, given you also need to query 'all orders for a
  user' and 'all orders in a given status'?"* Strong answer: partition
  key `user_id` with a composite sort key encoding order date/ID for
  the primary access pattern, plus a GSI with `status` as its partition
  key (and a suitable sort key) for the status-based query — designed
  from the two known access patterns, not from a normalized entity
  model.
- *"How do you get DynamoDB data into a data lake for analytics without
  affecting production performance?"* Strong answer: use the native
  Export to S3 feature (zero read-capacity impact, point-in-time via
  PITR) for periodic bulk snapshots, or DynamoDB Streams → Lambda for
  continuous, near-real-time CDC into the lake, depending on whether
  the need is periodic bulk or continuous.
- *"A table is throttling even though its aggregate provisioned
  capacity looks sufficient. What's your diagnostic process?"* Strong
  answer: check for a hot partition — look at CloudWatch's
  partition-level metrics or access patterns for a low-cardinality key
  or a single "celebrity" item concentrating traffic, then apply write
  sharding or redesign the key rather than simply raising overall
  capacity.

<a name="cheatsheet"></a>
## 23. Cheat sheet

| If the scenario says... | Reach for... |
|---|---|
| new access pattern on an existing table | GSI |
| strongly consistent read on an alternate sort order, same PK | LSI (must be defined at table creation) |
| unpredictable/new workload, avoid capacity planning | On-demand capacity |
| steady, well-understood workload, optimize cost | Provisioned + auto scaling (+ Reserved Capacity) |
| continuous CDC-style change feed | DynamoDB Streams |
| periodic full snapshot to S3, zero capacity impact | Export to S3 |
| automatic item expiry | TTL |
| "undo" within the last 35 days | PITR |
| microsecond read latency, read-heavy | DAX |
| multi-Region active-active | Global Tables |
| throttling despite high aggregate capacity | Hot partition — fix key design |
| many entity types, one table, few round trips | Single-table design |

<a name="mnemonics"></a>
## 24. Memory tricks

**"Know your queries before you build the table."** DynamoDB's one
rule that inverts relational habits. **"GSI = anytime, any key; LSI =
only at birth, same key."** The creation-timing and key-sharing
distinction in one line. **"Export doesn't tax the table."** Export to
S3 costs zero read capacity — the answer whenever "without impacting
production" appears. **"Hot partition, cold comfort from more total
capacity"** — raising overall capacity never fixes a single hot key.

---

<a name="practice"></a>
## 25. Practice questions (15)

**Q1.** An application's DynamoDB table is throttling on a specific
set of requests even though the table's aggregate provisioned capacity
is well under its limit. Investigation shows nearly all writes target
a partition key with only three possible values. What is the most
likely cause and fix?

A) The table needs more provisioned write capacity overall
B) A hot partition caused by low key cardinality; fix by choosing a higher-cardinality key or write sharding
C) DAX needs to be enabled to absorb the write load
D) The table should switch to an LSI

**Answer: B.** Throttling concentrated despite ample aggregate
capacity is the hot-partition signature, caused by a low-cardinality
partition key — the fix is key design (higher cardinality or write
sharding), not more total capacity. (A) doesn't relieve
per-partition pressure. (C) DAX accelerates reads, not writes. (D)
LSIs don't address key cardinality/hot partition issues.

**Q2.** A production DynamoDB table needs a brand-new query pattern —
looking up items by a `category` attribute that isn't the table's
partition key — without disrupting existing traffic. What should be
added?

A) A Local Secondary Index
B) A Global Secondary Index
C) A new base table with a different partition key
D) A DynamoDB Stream

**Answer: B.** GSIs can be added to an existing table at any time to
serve a new access pattern. (A) LSIs can only be defined at table
creation — not possible on an already-live table. (C) creating an
entirely new table is unnecessarily disruptive when a GSI solves it.
(D) Streams capture changes; they don't create query access patterns.

**Q3.** Which capacity mode is most appropriate for a brand-new
application with completely unknown and potentially spiky traffic
patterns, where the team wants to avoid any capacity planning?

A) Provisioned capacity with a fixed RCU/WCU setting
B) On-demand capacity
C) Provisioned capacity with auto scaling disabled
D) Reserved Capacity

**Answer: B.** On-demand mode scales instantly to traffic with zero
capacity planning, ideal for unknown/spiky new workloads. (A) and (C)
require estimating capacity upfront, risking throttling. (D) Reserved
Capacity is a discount mechanism for provisioned mode on predictable,
steady workloads — the opposite of this scenario.

**Q4.** A team needs to move DynamoDB data into their S3-based data
lake on a nightly basis for analytics, and must not consume any of the
table's read capacity in doing so. What should they use?

A) A scheduled `Scan` operation via a Lambda function
B) DynamoDB's native Export to S3 feature
C) DynamoDB Streams with a Kinesis consumer
D) Query operations run from Athena directly against DynamoDB

**Answer: B.** Export to S3 performs a point-in-time export using
PITR and consumes zero read capacity — exactly matching the
requirement. (A) a Scan consumes read capacity and can throttle
production traffic. (C) Streams is designed for continuous CDC, not
periodic bulk snapshots, and is a heavier setup for this need. (D)
Athena cannot query DynamoDB directly without the data first being
exported/federated.

**Q5.** Which statement correctly describes DynamoDB Global Secondary
Indexes?

A) They always provide strongly consistent reads
B) They can use a different partition key than the base table, but only support eventually consistent reads
C) They must share the base table's partition key
D) They can only be created at table creation time

**Answer: B.** GSIs allow an independent partition/sort key but only
support eventually consistent reads. (A) is false — GSIs never
support strong consistency. (C) describes LSIs, not GSIs. (D) GSIs can
be added at any time, unlike LSIs.

**Q6.** A read-heavy gaming leaderboard application repeatedly queries
the same top-N items and needs the lowest possible read latency.
Writes are relatively infrequent. What should be added to the
architecture?

A) DynamoDB Streams
B) DAX (DynamoDB Accelerator)
C) A Local Secondary Index
D) Provisioned capacity with no auto scaling

**Answer: B.** DAX is purpose-built for exactly this pattern —
read-heavy, latency-critical, tolerant of eventual consistency —
delivering microsecond response times via an in-memory cache. (A)
Streams captures changes, unrelated to read latency. (C) an LSI
changes sort order/query capability, not raw read latency in this way.
(D) capacity mode alone doesn't reduce latency the way a cache does.

**Q7.** What is the retention window for DynamoDB Streams records
before they age out?

A) 7 days
B) 24 hours
C) 35 days
D) Indefinite, until manually deleted

**Answer: B.** DynamoDB Streams retains records for 24 hours. (A) is
incorrect. (C) 35 days is the maximum PITR retention window, a
different feature. (D) Streams records are not retained indefinitely.

**Q8.** A company needs to be able to restore a DynamoDB table to its
exact state as of any specific second within the last 30 days, to
recover from an accidental application bug that corrupted data. Which
feature satisfies this?

A) DynamoDB Streams
B) TTL
C) Point-in-Time Recovery (PITR)
D) A Global Secondary Index

**Answer: C.** PITR supports second-level granularity restore for up
to 35 days, directly matching this requirement. (A) Streams is a
24-hour change feed, not a restore mechanism. (B) TTL automatically
deletes expired items; it doesn't restore data. (D) a GSI is a query
mechanism, unrelated to restore.

**Q9.** After restoring a DynamoDB table using PITR, what happens to
the original table?

A) It is overwritten in place with the restored data
B) It remains unchanged; the restore creates a brand-new table
C) It is automatically deleted
D) It is renamed to include a timestamp suffix

**Answer: B.** PITR (and on-demand backup) restores always create a
new table; the original table is untouched. (A), (C), and (D) all
misstate the actual restore behavior.

**Q10.** Which DynamoDB feature automatically removes items past a
defined expiration time without consuming write capacity?

A) DynamoDB Streams
B) TTL (Time to Live)
C) DAX
D) Global Tables

**Answer: B.** TTL deletes expired items automatically at no
additional write-capacity cost, though not instantaneously (up to ~48
hours after expiration). (A) Streams captures changes but doesn't
cause deletion itself. (C) DAX is a caching layer, unrelated to
expiration. (D) Global Tables handle multi-Region replication, not
expiry.

**Q11.** A company wants multiple entity types (users, orders,
products) served by a single DynamoDB table with minimal round trips
per request, using generic key attribute names and carefully designed
key values. What design philosophy does this describe?

A) Third normal form (3NF) relational modeling
B) Single-table design
C) Star schema
D) Snowflake schema

**Answer: B.** Single-table design is DynamoDB's idiomatic approach —
denormalizing multiple entity types into one table using overloaded
key patterns to minimize round trips. (A), (C), and (D) are all
relational/warehouse modeling concepts, not DynamoDB NoSQL patterns.

**Q12.** Which statement about Local Secondary Indexes (LSIs) is
accurate?

A) LSIs can be added to a table at any time after creation
B) LSIs must share the base table's partition key and can only be defined at table creation time
C) LSIs support only eventually consistent reads
D) A table can have up to 20 LSIs

**Answer: B.** LSIs are locked to the base table's partition key and
must be defined when the table is created — this is their defining
constraint versus GSIs. (A) is false — that describes GSIs. (C) is
false — LSIs support both eventual and strong consistency. (D) is
false — the limit for LSIs is 5, not 20 (20 is the GSI default limit).

**Q13.** An application requires active-active, multi-Region
read/write access to the same logical DynamoDB dataset, with low
latency for users in each Region. What should be configured?

A) DAX in each Region independently
B) DynamoDB Global Tables
C) A separate table per Region with manual nightly sync via Glue
D) Cross-Region Replication (an S3 feature, not applicable to DynamoDB)

**Answer: B.** Global Tables provide native, managed, active-active
multi-Region replication with automatic conflict resolution. (A) DAX
is a caching layer, not a replication mechanism. (C) manual nightly
sync introduces high replication lag and operational burden versus a
managed native feature. (D) CRR is an S3 feature and does not apply to
DynamoDB.

**Q14.** Which of the following is the correct effect of enabling
encryption at rest on a DynamoDB table?

A) Encryption at rest is optional and off by default
B) Encryption at rest is enabled by default, using either an AWS-owned or customer-managed KMS key
C) Encryption at rest requires DAX to be enabled first
D) Encryption at rest is only available for Global Tables

**Answer: B.** DynamoDB encrypts data at rest by default; the only
choice is which key type manages it (AWS-owned, AWS-managed, or
customer-managed KMS key), not whether encryption happens at all. (A)
is false — there's no fully unencrypted option. (C) and (D) are
fabricated dependencies with no basis in DynamoDB's actual behavior.

**Q15.** A data engineering team needs to run complex ad hoc
analytical queries with multi-table joins and aggregations over
application data currently stored in DynamoDB. What is the most
appropriate approach?

A) Redesign the DynamoDB table with more GSIs to support arbitrary joins
B) Export or stream the data out of DynamoDB into a purpose-built analytics engine (e.g., S3 + Athena/Redshift) rather than querying DynamoDB directly for this use case
C) Increase the table's provisioned capacity to support scan-heavy analytical queries
D) Enable DAX to accelerate the analytical queries

**Answer: B.** DynamoDB is not designed for ad hoc joins/aggregations;
the correct pattern is to move the data (via Export to S3 or Streams)
into an engine built for that — Athena, Redshift, or EMR. (A) GSIs
support additional key-based access patterns, not arbitrary relational
joins — DynamoDB fundamentally has no join capability. (C) more
capacity doesn't add join/aggregation capability, and heavy scanning
for analytics against a live OLTP table risks impacting production
traffic. (D) DAX caches key-based reads; it doesn't enable
join/aggregation query capability.
