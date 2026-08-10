# DynamoDB vs Aurora

> Domain 2 covers each service's internals in depth. This file is
> narrower: **given an operational data store decision, which one, and
> when does the real answer become "both, wired together with
> zero-ETL"?**

---

## 1. ELI12

**DynamoDB** is a coat-check counter. You hand over your coat with a
ticket number (the partition key), and later you hand back the exact
same ticket number to get your exact coat back — instantly, no matter
how many thousands of coats are hanging up. But you can't ask the coat
check attendant "give me every coat that's blue" — they only know how
to look things up by ticket number (or a couple of pre-arranged
secondary ticket systems, i.e. GSIs/LSIs). Fast, but only for the
exact question it was built to answer.

**Aurora** is a filing cabinet room with a very smart librarian who can
answer *any* question you throw at it — "give me every blue coat," "how
many coats came in on a Tuesday," "cross-reference coats with their
owners' membership status" — because everything is organized in
labeled folders with cross-references (tables, foreign keys, indexes).
That flexibility costs more effort per lookup than the coat-check
counter, but it can answer questions nobody thought to design for in
advance.

The exam's real question: **do you know your access pattern in advance
and need it to be instant at massive scale (DynamoDB), or do you need
the flexibility to ask questions you haven't thought of yet, with joins
and transactions (Aurora)?**

---

## 2. Comparison matrix

| Attribute | **DynamoDB** | **Aurora (MySQL/PostgreSQL-compatible)** |
|---|---|---|
| **Purpose** | Key-value / document NoSQL store, access-pattern-first design | Relational OLTP database, ACID transactions, complex queries |
| **Data model** | Items in tables; partition key (+ optional sort key); nested JSON-like attributes | Rows in tables with defined schema, foreign keys, joins |
| **Query flexibility** | ⚠️ **Key access only** — query by partition key (+ sort key range), or via Global/Local Secondary Indexes designed in advance | ✅✅ Full SQL — arbitrary joins, aggregations, subqueries, ad-hoc `WHERE` clauses on any column |
| **Joins** | ❌ None — must be denormalized into the item design up front | ✅ Native, multi-table |
| **Transactions** | ⚠️ `TransactWriteItems`/`TransactGetItems` — up to 100 items, single-region by default | ✅✅ Full ACID across arbitrary statements |
| **Latency** | **Single-digit milliseconds**, microseconds with DAX | Low milliseconds, higher under complex joins |
| **Throughput scaling** | Automatic partition management; on-demand mode absorbs spikes instantly | Read replicas (up to 15) for reads; write scaling is vertical (bigger writer instance) or Aurora Limitless for horizontal write sharding |
| **Cost model** | RCU/WCU (provisioned) or per-request (on-demand) + storage | Instance-hours (writer + readers) + storage + I/O, or Aurora Serverless v2 (ACU-hours) |
| **Serverless** | ✅ On-demand mode is fully serverless | ✅ Aurora Serverless v2 (scales ACUs, doesn't scale to a literal $0 the way DynamoDB on-demand can idle cheaply) |
| **Max practical size** | **Unlimited** — scales horizontally forever via partitioning | ~128 TB per cluster (Aurora storage ceiling) |
| **High availability** | Multi-AZ by default, no configuration needed; **Global Tables** for active-active multi-region | Multi-AZ via replicas + failover (~30s typically); **Aurora Global Database** for cross-region (typically <1s replica lag, fast promotion) |
| **Item / row size** | **400 KB max item size** | Effectively unbounded per row (subject to page/column limits) |
| **Change capture** | **DynamoDB Streams** (24h retention) → Lambda triggers | Binlog / logical replication → **DMS**, or native **Aurora zero-ETL to Redshift** |
| **Analytics-friendly?** | ❌ Not directly — scanning for analytics throttles the app; must **export to S3** first (free, no RCU cost) then query with Athena | ⚠️ Possible directly but competes with OLTP load; better to use **read replica** or **zero-ETL to Redshift** for heavy analytics |
| **Security** | IAM (including item-level via `dynamodb:LeadingKeys` condition), KMS encryption at rest | IAM DB auth, KMS encryption, network isolation via VPC/security groups, TLS in transit |
| **Best use case** | Session state, shopping carts, gaming leaderboards, IoT device state, high-throughput key lookups | Application backends needing relational integrity, reporting joins, financial transactions, anything with "ACID" or "joins" in the requirement |
| **When NOT to use** | Ad-hoc analytical queries, workloads needing joins across entities | Millions of requests/sec of simple key lookups; unpredictable massive horizontal write scaling needs |
| **Exam favorite** | "millions of requests per second," "single-digit millisecond," "session state," "known access pattern" | "transactional," "relational," "joins," "ACID," "existing application uses SQL" |

---

## 3. Decision tree

```
┌────────────────────────────────────────────────────────────────┐
│ START: What does the application need to DO with this data?    │
└───────────────────────────────┬───────────────────────────────┘
                                 │
      Is the access pattern KNOWN IN ADVANCE — always looking
      things up by a specific key (user ID, device ID, order ID)?
                                 │
                ┌────────────────┴────────────────┐
               YES                                NO
                │                                   │
     Does it need JOINS across          Does it need arbitrary/ad-hoc
     multiple entities, or full         queries, complex reporting,
     ACID transactions spanning         or relational integrity
     many tables?                       (foreign keys, constraints)?
                │                                   │
      ┌──────────┴──────────┐            ┌───────────┴───────────┐
     YES                    NO           YES                     NO
      │                      │            │                       │
  ┌───▼────┐          ┌──────▼──────┐ ┌───▼────┐         (reconsider — this
  │ AURORA │          │  DYNAMODB   │ │ AURORA │          usually means you
  │(joins, │          │ (key access,│ │(SQL,   │          haven't fully
  │ ACID)  │          │ single-digit│ │ joins, │          defined the access
  └────────┘          │  ms, scales │ │ ACID)  │          pattern yet — lean
                       │  infinitely)│ └────────┘          DynamoDB if scale
                       └─────────────┘                     and latency matter
                                                            most, Aurora if
                                                            flexibility matters
                                                            most)

┌────────────────────────────────────────────────────────────────┐
│ THE THIRD BRANCH — "analytics on operational data"              │
│ If the requirement is "run analytics/BI/reporting on data that  │
│ lives in DynamoDB or Aurora, without hurting the app":           │
│                                                                   │
│   DynamoDB → export to S3 (free, no RCU) → Athena/Glue           │
│              OR zero-ETL → Redshift/OpenSearch                   │
│   Aurora   → zero-ETL → Redshift  (Aurora MySQL/PostgreSQL)      │
│                                                                   │
│   ⚠️ NEVER answer "run a Scan on the DynamoDB table" or           │
│   "query the primary Aurora writer directly for BI" when a       │
│   hybrid/zero-ETL option is on the list.                         │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. Worked scenarios

**Scenario A — A gaming company needs a leaderboard that updates in
real time for millions of concurrent players, always looked up by
player ID, at single-digit-millisecond latency.** *Winner: DynamoDB.*
Access pattern is fixed (lookup/update by player ID, maybe a sort key
for score), scale is enormous, and latency must be consistently low —
exactly DynamoDB's design center. Aurora would need careful sharding
and connection pooling to approach this throughput; DynamoDB does it
by default.

**Scenario B — A bank's core ledger system needs to debit one account
and credit another in a single atomic transaction, with full audit
history, foreign key constraints between accounts/customers/branches,
and complex month-end reporting joins.** *Winner: Aurora.* This is the
canonical relational workload: multi-table ACID transactions, foreign
key integrity, and ad-hoc joins for reporting — none of which DynamoDB
does natively. DynamoDB's `TransactWriteItems` could technically debit
and credit two items, but the relational integrity and reporting
requirements point firmly at Aurora.

**Scenario C — An e-commerce app stores shopping carts in DynamoDB for
fast checkout, but the BI team wants nightly trend reports joining cart
data with product catalog and customer data stored in Aurora.**
*Winner: Hybrid.* This is the "real answer is both" pattern: DynamoDB
stays for the hot operational path (cart reads/writes at scale), while
a **DynamoDB zero-ETL integration to Redshift** (or an export-to-S3 +
Glue job) feeds the analytical side, joined there against Aurora data
that's also replicated into Redshift via its own zero-ETL integration.
Neither database is forced to do the other's job.

**Scenario D — A team wants to run a monthly report against 500 million
DynamoDB items without affecting live application read/write
performance.** *Winner: Export to S3, then Athena.* This is the classic
exam trap: the wrong answer is "run a Scan," which consumes RCUs and can
throttle the live application. **DynamoDB export to S3 consumes zero
read capacity** and is purpose-built for exactly this "analyze without
affecting production" requirement.

---

## 5. Exam traps

| Trap | The correction |
|---|---|
| **"NoSQL sounds flexible" ⇒ pick DynamoDB for ad-hoc queries** | Backwards. DynamoDB is *less* flexible for ad-hoc queries — it needs the access pattern designed up front. "Flexible querying," "ad-hoc joins," "complex reporting" are Aurora signals, not DynamoDB signals. |
| **Running a Scan for analytics** | Scans consume RCUs and can throttle the live app. The correct answer for "analyze DynamoDB data without affecting performance" is always **export to S3 (free) → Athena**, or a zero-ETL integration — never Scan. |
| **GSI treated as identical to LSI** | GSI: separate partition key, own provisioned capacity, **eventually consistent only**, can be added anytime after table creation. LSI: same partition key, different sort key, **must be defined at table creation**, capped at 10GB per partition key value, supports strongly consistent reads. Mixing these up is a favorite distractor. |
| **Assuming Aurora scales writes horizontally like DynamoDB** | Aurora write scaling is fundamentally vertical (bigger writer instance) unless using **Aurora Limitless Database** for horizontal write sharding — it does not auto-shard writes the way DynamoDB partitions do by default. |
| **Picking DynamoDB for a workload needing multi-table joins "because it's fast"** | Speed doesn't override the missing capability. If the requirement includes joins across entities, DynamoDB requires denormalizing the design — which may not be feasible for genuinely ad-hoc reporting needs. That points to Aurora (or Aurora → Redshift). |
| **Forgetting the 400KB item size limit** | A DynamoDB item (e.g., one storing a large embedded document or blob) that can grow past 400KB is disqualified — store the large payload in S3 and keep a reference in the DynamoDB item instead. |
| **Treating zero-ETL as a replacement for the operational database** | Zero-ETL moves data *to* an analytics target; it doesn't replace DynamoDB/Aurora as the system of record for the operational workload. The hybrid pattern keeps both. |
| **Assuming DynamoDB Streams gives unlimited replay** | DynamoDB Streams retains only **24 hours**. A requirement for longer historical replay/audit needs export to S3 or a separate archival strategy, not reliance on Streams alone. |

---

## 6. Real-company examples

**DynamoDB side — Amazon.com's shopping cart (the original DynamoDB use
case).** Millions of concurrent shoppers each read and write their own
cart by a known key (customer/session ID), needing consistent
single-digit-millisecond latency at massive, unpredictable scale — the
exact profile DynamoDB was built for.

**Aurora side — a banking platform's core transaction ledger.**
Financial institutions rely on Aurora (or RDS) for account balances,
transfers, and regulatory reporting because ACID guarantees, foreign
key integrity, and complex joins across accounts/transactions/customers
are non-negotiable requirements that a key-value store cannot satisfy
natively.

**Hybrid — a ride-sharing platform.** Live trip state and driver
location are held in DynamoDB for fast, high-throughput operational
reads/writes, while trip and payment history flow via zero-ETL/DMS into
Aurora/Redshift for finance, fraud, and business-intelligence reporting
that needs joins across riders, drivers, trips, and payments.

---

## 7. Practice questions (12)

**Q1.** An IoT platform ingests device state updates from 10 million
devices, always looked up and updated by device ID, requiring
consistent single-digit-millisecond latency. Which store fits best?

- A. Aurora with a b-tree index on device ID — ✗ Can work but won't match DynamoDB's consistent low-latency behavior at this scale and throughput without significant tuning/sharding effort.
- B. **DynamoDB — ✓** Fixed key-based access pattern, massive scale, consistent single-digit-ms latency — DynamoDB's exact design center.
- C. Aurora Serverless v2 — ✗ Same relational scaling concerns as A; not built for this access-pattern-first, massive-key-lookup workload.
- D. Redshift — ✗ An analytical warehouse, not suited for high-throughput low-latency operational key lookups.

**Q2.** A financial application needs to debit one account and credit
another atomically, enforce foreign key relationships between accounts
and customers, and support ad-hoc audit queries joining multiple
tables. Best fit?

- A. DynamoDB with TransactWriteItems — ✗ Handles the atomic debit/credit but has no foreign keys and no ad-hoc multi-table joins for audit queries.
- B. **Aurora — ✓** Native ACID transactions, foreign key constraints, and full SQL joins satisfy all three requirements.
- C. DynamoDB with Global Tables — ✗ Global Tables solve multi-region replication, not the relational/joins requirement here.
- D. OpenSearch — ✗ Built for search/log analytics, not transactional relational integrity.

**Q3.** A team wants to run heavy nightly analytical queries against
data currently in DynamoDB without affecting live application
performance. What should they do?

- A. Run a Scan operation during off-peak hours — ✗ Still consumes RCUs and risks throttling if off-peak isn't truly zero-traffic; not the purpose-built answer.
- B. **Export the table to S3 (consumes no RCUs) and query with Athena — ✓** Purpose-built path for analytics with zero impact on live read capacity.
- C. Increase provisioned RCUs and run a Scan — ✗ Costs more and still directly competes with production traffic; not the recommended pattern.
- D. Enable DynamoDB Streams and replay 30 days of history — ✗ Streams only retain 24 hours; not designed for full historical analytics anyway.

**Q4.** What is the key difference between a DynamoDB GSI and an LSI?

- A. GSIs are free, LSIs are billed — ✗ Both have associated costs; this isn't the distinguishing factor.
- B. **GSIs can be added anytime and use their own capacity with eventual consistency; LSIs must be defined at table creation, share the base table's partition key, and support strong consistency — ✓** Correct distinction tested repeatedly on the exam.
- C. LSIs support multiple partition keys; GSIs only support one — ✗ Backwards; LSIs share the same partition key as the base table.
- D. GSIs are limited to 10GB per key; LSIs are unlimited — ✗ The 10GB-per-partition-key-value limit applies to LSIs, not GSIs.

**Q5.** An application currently stores cart data in DynamoDB. The BI
team wants trend reports joining cart data with product and customer
data stored in Aurora. What's the recommended architecture?

- A. Migrate cart data into Aurora entirely — ✗ Unnecessary and would hurt the fast operational cart-access pattern DynamoDB serves well.
- B. **Keep DynamoDB for the operational cart workload; use zero-ETL/export to feed an analytics store (e.g., Redshift) that's joined against Aurora's own zero-ETL feed — ✓** The hybrid pattern: each database does what it's best at, analytics happens downstream.
- C. Query DynamoDB directly from Aurora using federated queries — ✗ Not a native supported pattern between these two services for this use case.
- D. Run Scan operations from a scheduled Lambda nightly — ✗ Consumes RCUs and risks throttling; export/zero-ETL is the purpose-built alternative.

**Q6.** What is the maximum item size in DynamoDB, and what's the
recommended workaround for larger payloads?

- A. 1MB; compress the payload — ✗ Wrong limit; compression doesn't change the architectural pattern AWS recommends.
- B. **400KB; store the large payload in S3 and keep a reference/pointer in the DynamoDB item — ✓** Correct limit and correct, commonly tested workaround pattern.
- C. 10MB; split across multiple items — ✗ Wrong limit; splitting is possible but not the standard recommended approach compared to S3 offloading.
- D. Unlimited; DynamoDB auto-compresses — ✗ DynamoDB does not auto-compress and does have a hard item-size limit.

**Q7.** Which scaling characteristic distinguishes Aurora from
DynamoDB by default?

- A. Aurora scales reads and writes horizontally by default; DynamoDB only scales reads — ✗ Backwards on both counts.
- B. **DynamoDB partitions automatically to scale both reads and writes horizontally; Aurora's write scaling is primarily vertical (bigger writer instance) unless using Aurora Limitless — ✓** Correct default scaling behavior for each. |
- C. Neither scales without manual resharding — ✗ DynamoDB scales automatically by design.
- D. Aurora Serverless v2 scales writes horizontally across multiple writer nodes by default — ✗ Aurora Serverless v2 scales ACUs on a single writer (plus read replicas); horizontal write sharding requires Aurora Limitless specifically.

**Q8.** A requirement states the application must support arbitrary,
unpredictable ad-hoc queries across multiple related entities that
weren't anticipated at design time. Which store is the better fit and
why?

- A. DynamoDB, because NoSQL is inherently flexible — ✗ Common misconception; DynamoDB requires the access pattern to be known in advance.
- B. **Aurora, because relational SQL supports arbitrary joins and ad-hoc queries without needing the access pattern predefined — ✓** Matches the stated need for unpredictable, ad-hoc, multi-entity queries.
- C. DynamoDB with multiple GSIs covering every possible query — ✗ Impractical and doesn't scale to genuinely unpredictable ad-hoc access patterns.
- D. OpenSearch layered on top of DynamoDB — ✗ Adds search capability but not relational joins/integrity; overkill relative to just using Aurora.
- E. (kept for format consistency; not a genuine 5th distinct option)

**Q9.** Why is DynamoDB Streams alone insufficient for a requirement to
retain 90 days of change history for compliance?

- A. DynamoDB Streams only captures INSERT events, not UPDATE/DELETE — ✗ Streams capture all three; that's not the limitation.
- B. **DynamoDB Streams retains data for only 24 hours — ✓** Far short of 90 days; a durable export/archival strategy (e.g., to S3) is needed instead.
- C. DynamoDB Streams cannot trigger Lambda — ✗ It can and commonly does; not the limiting factor here.
- D. DynamoDB Streams requires DAX to be enabled — ✗ No such dependency exists.

**Q10.** A question emphasizes "existing application already uses SQL,
relational schema, and stored procedures, migrating to AWS." Which
service is the natural fit over DynamoDB?

- A. DynamoDB, since it's cheaper at scale — ✗ Cost isn't the deciding factor; the existing relational schema/SQL/stored procedures point to a relational engine.
- B. **Aurora (MySQL- or PostgreSQL-compatible) — ✓** Directly supports existing SQL schemas, stored procedures, and relational constructs with minimal rework.
- C. DynamoDB with PartiQL — ✗ PartiQL adds SQL-like syntax but doesn't provide joins, foreign keys, or stored procedure support.
- D. OpenSearch — ✗ Not a relational database; wrong category entirely.

**Q11.** What is the correct DynamoDB scaling mode for a workload with
completely unpredictable, spiky traffic where provisioning fixed
capacity in advance is undesirable?

- A. Provisioned capacity with manual scaling — ✗ Requires predicting load; poor fit for unpredictable spikes.
- B. Provisioned capacity with auto-scaling policies — ✗ Reacts to load with some lag; better than manual but not the best fit when traffic is truly unpredictable.
- C. **On-demand capacity mode — ✓** Serverless, instantly absorbs unpredictable spikes without capacity planning.
- D. DAX with provisioned capacity — ✗ DAX is a caching layer for read latency, not a capacity-scaling mode for the base table.

**Q12.** A zero-ETL integration exists from Aurora PostgreSQL to
Redshift. A new requirement appears: "deduplicate and enrich records
with a reference lookup table during load." What changes?

- A. Nothing — zero-ETL supports transformation during load — ✗ False; zero-ETL replicates as-is with no transformation step.
- B. **Zero-ETL must be replaced or supplemented with a transformation step — e.g., DMS + Glue, or Glue reading from the zero-ETL-replicated Redshift table before final use — ✓** Transform-during-load requirements disqualify pure zero-ETL. |
- C. Switch the target from Redshift to OpenSearch, which supports transformation — ✗ OpenSearch is also a zero-ETL target with no built-in transform capability during replication.
- D. Add a Lambda function as the zero-ETL destination to transform records — ✗ Zero-ETL integrations replicate directly to the supported analytics target; Lambda isn't an interposable step in that pipeline.
