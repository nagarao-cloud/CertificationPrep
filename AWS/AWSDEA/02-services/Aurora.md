# Amazon Aurora

> Deep-reference file for **Amazon Aurora** (MySQL- and PostgreSQL-
> compatible), scoped narrower than a full domain file. Read this after
> `00-START-HERE/SERVICE-SELECTION-MATRIX.md` Part 6 (data store
> matrix) — this file goes several layers deeper on Aurora specifically:
> storage architecture, Serverless v2, Global Database, zero-ETL,
> backtrack, cloning, and failover mechanics. Aurora sits primarily in
> **Domain 2 (Data Store Management, 26%)** with a secondary appearance
> in **Domain 1** wherever zero-ETL or CDC sourcing is tested.

---

## CONTENTS

- [1. Explain like I'm 12](#step1)
- [2. Explain technically](#step2)
- [3. Explain like a Senior AWS Data Engineer](#step3)
- [4. Production architecture](#step4)
- [5. Per-service coverage checklist](#step5)
- [6. Exam traps](#step6)
- [7. Interview questions](#step7)
- [8. Cheat sheet](#step8)
- [9. Memory tricks](#step9)
- [10. Practice questions (15)](#step10)

---

<a name="step1"></a>
## 1. Explain like I'm 12

Imagine a normal database (RDS) is like a notebook you keep on your own
desk — if you spill coffee on it, everything you wrote since your last
photocopy is gone. Aurora is like writing in a notebook that's magically
copied, page by page, the instant you write, to six different
fireproof safes spread across three different buildings. Even if two
whole buildings burn down, your notebook is still readable. And instead
of paying for a giant notebook you might never fill, you only pay for
the pages you actually use, and the "storage" part quietly grows itself
in 10 GB chunks up to 128 TB without you ever having to say "give me
more room." Aurora is Amazon's own rebuilt engine that talks the exact
same language as MySQL and PostgreSQL, so your existing apps don't even
notice the swap — they just get faster, safer, and easier to run.

<a name="step2"></a>
## 2. Explain technically

**Amazon Aurora** is AWS's proprietary, cloud-native relational database
engine, MySQL- and PostgreSQL-**compatible** at the wire protocol and
SQL dialect level, but with a fundamentally different storage
architecture than standard RDS. Where standard RDS (running real MySQL
or PostgreSQL binaries) attaches a single EBS volume to a single
compute instance and replicates that volume via block-level EBS
replication or asynchronous binlog-based read replicas, Aurora
**decouples compute from storage entirely**: the Aurora storage layer is
a purpose-built, log-structured, distributed storage system that
automatically replicates every write **6 ways across 3 Availability
Zones**, and Aurora database instances (writer and readers) attach to
that shared storage volume rather than owning their own disks. This is
the single fact that explains almost every other Aurora advantage: fast
failover (a replica doesn't need to replay redo logs from a separate
disk — it already shares the same storage), fast replica creation
(no data copy required), continuous backup to S3 with no performance
hit, and storage that auto-scales in 10 GB increments up to 128 TB
(standard PostgreSQL/MySQL edition) with no manual provisioning.

<a name="step3"></a>
## 3. Explain like a Senior AWS Data Engineer

A senior engineer treats "Aurora vs. RDS" as a **default-yes** decision
for any new MySQL- or PostgreSQL-compatible relational workload on AWS,
not a coin flip — the storage architecture alone (6-way replication,
sub-60-second typical failover, continuous S3 backup with no I/O
penalty) removes an entire category of operational risk that a team
running standard RDS has to manage by hand (snapshot scheduling, replica
lag monitoring, manual storage sizing). The two legitimate reasons to
stay on standard RDS are: (1) **engine version or extension
requirements Aurora doesn't yet support** — Aurora PostgreSQL and Aurora
MySQL lag slightly behind the newest open-source point releases and
don't support every third-party extension standard RDS PostgreSQL does;
and (2) **cost sensitivity at very small, steady-state scale**, where a
single small standard RDS instance can be cheaper than Aurora's
I/O-based pricing model for extremely low-traffic workloads. Beyond
those two exceptions, a senior engineer's mental model is: **RDS is a
managed database; Aurora is a managed, cloud-native storage engine that
happens to speak MySQL/PostgreSQL.** The data-engineering-specific
judgment call layered on top is knowing *when Aurora is the wrong tool
entirely* — Aurora is an OLTP engine. The moment a scenario says
"complex analytical joins across billions of rows," "star schema,"
or "hundreds of concurrent BI dashboard users," the senior answer stops
being "bigger Aurora instance" and becomes "Aurora as the operational
system of record, **zero-ETL into Redshift** for the analytical
workload" — trying to make Aurora do OLAP's job is a scaling dead end,
not a sizing problem.

<a name="step4"></a>
## 4. Production architecture

```
                     ┌─────────────────────────────────────────┐
                     │            APPLICATION TIER              │
                     │   (writes + read-heavy queries)           │
                     └───────────────┬───────────────┬───────────┘
                                      │               │
                              writes  │               │ reads (via reader
                                      │               │ endpoint, load-balanced)
                                      ▼               ▼
                     ┌──────────────────┐   ┌──────────────────┐
                     │   WRITER INSTANCE │   │  READ REPLICA(S)  │
                     │   (primary, 1 per │   │  up to 15, same    │
                     │   cluster)        │   │  region            │
                     └─────────┬─────────┘   └─────────┬─────────┘
                               │                        │
                               │   BOTH ATTACH TO THE    │
                               │   SAME SHARED STORAGE    │
                               ▼                        ▼
                     ┌─────────────────────────────────────────┐
                     │        AURORA DISTRIBUTED STORAGE         │
                     │   Log-structured, replicated 6x across    │
                     │   3 AZs (2 copies per AZ). Auto-scales     │
                     │   10 GB increments, up to 128 TB.          │
                     │   Quorum: 4-of-6 write, 3-of-6 read.       │
                     └───────────────────┬───────────────────────┘
                                          │
                                continuous backup, no I/O penalty
                                          │
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │              AMAZON S3                    │
                     │   Continuous incremental backup;           │
                     │   point-in-time restore to any second      │
                     │   within the retention window (1–35 days)  │
                     └─────────────────────────────────────────┘

        ─────────────────  CROSS-REGION EXTENSIONS  ─────────────────

  ┌────────────────────┐   Aurora Global Database    ┌────────────────────┐
  │  PRIMARY REGION      │ ───────────────────────▶  │  SECONDARY REGION    │
  │  Writer + readers     │  storage-layer replication │  Up to 5 secondary   │
  │                       │  (~1 sec typical lag,       │  regions, each with   │
  │                       │   NOT logical replication)  │  up to 16 read        │
  │                       │                             │  replicas, RTO<1 min │
  └────────────────────┘                             └────────────────────┘

  ┌────────────────────┐    zero-ETL integration     ┌────────────────────┐
  │  Aurora MySQL /       │ ───────────────────────▶  │  Amazon Redshift      │
  │  PostgreSQL cluster   │  Continuous, no pipeline,  │  Near real-time       │
  │  (source of truth)    │  seconds of lag, no code   │  analytics on         │
  │                       │                             │  operational data     │
  └────────────────────┘                             └────────────────────┘
```

**Reading the diagram, arrow by arrow:** the application tier sends
writes to the single **writer instance** (Aurora clusters have exactly
one writer at a time) and sends reads either directly or through the
**reader endpoint**, which load-balances across all available read
replicas — this is why adding a read replica in Aurora scales read
throughput without any application-side connection-string juggling.
Both the writer and every reader **attach to the same underlying
distributed storage volume** rather than owning independent copies of
the data — this is the architectural fact that makes replica lag
typically milliseconds rather than seconds, and makes promoting a
reader to writer during failover fast, because the new writer doesn't
need to catch up on data it can already see. That storage layer itself
replicates every write six ways across three Availability Zones (two
copies per AZ) using a **quorum model**: a write is acknowledged once
**4 of 6** copies confirm it, and a read is guaranteed durable once **3
of 6** copies agree — this quorum design is what lets Aurora tolerate
losing an entire AZ (2 copies) without losing write availability, and
lose an additional copy on top of that (3 total) without losing read
availability. Below the cluster, **continuous backup streams to S3**
with no measurable I/O performance penalty on the running database,
because it's built on the same log-structured storage rather than a
separate snapshot process — this is what enables point-in-time restore
to any second within the retention window. Two arrows extend beyond a
single region: **Aurora Global Database** replicates at the storage
layer (not via logical/binlog replication) to up to five secondary
regions with roughly one second of typical lag and sub-minute RTO on a
managed failover; and **zero-ETL integration** continuously and
automatically replicates Aurora data into Redshift for analytics, with
no Glue job, no DMS task, and no custom pipeline code to maintain.

<a name="step5"></a>
## 5. Per-service coverage checklist

### Purpose

Amazon Aurora is a **fully managed, cloud-native relational database**
engine, compatible with MySQL and PostgreSQL wire protocols and SQL
dialects, purpose-built for AWS with a distributed, self-healing storage
layer decoupled from compute. It is the default OLTP (transactional)
data store recommendation on this exam whenever the scenario needs a
relational engine and doesn't name a specific reason to avoid it.

### When to use

- Any new relational (SQL, ACID-transactional) workload targeting
  MySQL or PostgreSQL compatibility, with no hard requirement for an
  unsupported extension or the very newest point release.
- Workloads needing **high availability with fast, automatic failover**
  (typically under 30 seconds, often single digits) without building
  custom failover tooling.
- Read-heavy applications that benefit from **up to 15 low-latency read
  replicas** sharing the same storage (near-zero replication lag).
- Applications with **spiky or unpredictable** transactional load,
  where **Aurora Serverless v2** avoids manual instance-size guessing.
- Multi-region applications needing **disaster recovery** or
  **low-latency local reads in multiple regions** (Aurora Global
  Database).
- Workloads that need **Aurora → Redshift analytics with no ETL
  pipeline** (zero-ETL integration is Aurora MySQL/PostgreSQL and RDS
  for MySQL only).
- **Vector search** alongside transactional data, using Aurora
  PostgreSQL's **pgvector** extension, when the scenario wants
  similarity search co-located with relational data rather than a
  separate, dedicated vector database.

### When NOT to use

- **Analytical (OLAP) workloads** — complex joins across billions of
  rows, star-schema BI queries, hundreds of concurrent dashboard
  users. Aurora is row-oriented and OLTP-tuned; reach for **Redshift**
  instead (and consider zero-ETL to keep both in sync).
- **Pure key-value or single-digit-millisecond-at-massive-scale access
  patterns** — **DynamoDB** fits better and doesn't carry relational
  schema/join overhead you don't need.
- **The workload requires a database engine or extension Aurora
  doesn't support** (e.g., a specific PostgreSQL extension only
  available on standard RDS, or an engine other than MySQL/PostgreSQL
  such as Oracle or SQL Server — those stay on RDS).
- **Extremely small, flat, predictable workloads** where a single
  small standard RDS instance is cheaper — Aurora's advantages have
  the most value at moderate-to-large scale or when HA truly matters;
  a hobby-scale database with no HA requirement may not justify it.
- **Fully unstructured or semi-structured document storage at scale**
  — consider DocumentDB (MongoDB-compatible) instead.

### Advantages

- Storage auto-scales in 10 GB increments up to 128 TB with **zero
  manual intervention** or downtime.
- **6-way replication across 3 AZs** built into every cluster by
  default — no separate configuration for basic durability.
- **Fast failover** — because readers share the writer's storage, no
  redo-log replay is needed before promotion; typical failover is
  under 30 seconds, and Aurora reports "typically under a minute" with
  many production cases far faster.
- **Continuous backup to S3 with no performance penalty**, point-in-time
  recovery to any second within the retention window (1–35 days).
- **Backtrack** (MySQL-compatible Aurora only) — rewind a cluster to an
  earlier point in time in seconds, without restoring from a backup.
- **Fast cloning** — create a new cluster that shares the same
  underlying data pages via copy-on-write, ready in minutes regardless
  of database size, instead of copying terabytes.
- Up to **5x MySQL and 3x PostgreSQL** throughput versus the same-class
  standard-engine RDS instance (AWS's published figures for typical
  workloads).
- **Aurora Serverless v2** scales compute in fine-grained increments
  (down to fractional ACUs) in response to load, without connection
  drops during scaling.

### Limitations

- **128 TB storage ceiling** for standard Aurora (Aurora Limitless
  Database, a separate horizontally-sharded configuration, exists for
  scaling beyond a single cluster's limits, but is a distinct
  architecture from a "normal" Aurora cluster).
- **One writer per cluster** in standard (non-Limitless) Aurora — you
  cannot horizontally scale writes by adding more writer instances;
  read scaling is via replicas, write scaling requires either a bigger
  writer instance or Aurora Limitless Database.
- **Backtrack is MySQL-compatible only** — not available on Aurora
  PostgreSQL.
- Not every open-source MySQL/PostgreSQL extension or the very latest
  point release is supported the moment it's released upstream — there
  is always some lag versus standalone open-source releases.
- **Cross-region Global Database replication is asynchronous** —
  during a regional failure, the most recent (sub-second-to-low-second)
  writes not yet replicated can be lost; this is a real RPO, not zero.

### Pricing considerations

- **Compute**: billed per instance-hour (or per ACU-hour for Serverless
  v2) — provisioned instances (writer + each reader) are billed
  whether idle or busy; Serverless v2 scales down toward its configured
  minimum ACU, reducing idle cost for spiky workloads.
- **Storage**: billed per GB-month actually consumed, plus **I/O
  requests** (Aurora's storage layer bills I/O separately from
  storage, unlike EBS-backed standard RDS) — this is why an
  I/O-heavy, small-storage workload can cost more on Aurora than the
  storage number alone suggests. **Aurora I/O-Optimized** is a
  configuration that trades a higher instance-hour price for no
  separate I/O billing, which is cheaper when I/O is a large share of
  the bill (commonly cited threshold: I/O costs exceeding roughly 25%
  of total Aurora spend).
- **Backup storage** beyond the amount equal to total database storage
  is billed separately.
- **Global Database** adds cross-region data transfer cost for the
  replicated write stream.
- **Reserved Instances** for provisioned Aurora compute reduce cost
  substantially (up to ~60%+) for steady-state, predictable workloads
  — the same trade-off as RDS/Redshift Reserved Instances.

### Performance

- Sub-millisecond to low-millisecond replica lag typical, because
  readers share the writer's storage rather than replaying a binlog.
- Read scaling is near-linear as replicas are added, up to 15 replicas.
- Aurora's storage layer parallelizes I/O across many storage nodes,
  which is part of why Aurora consistently outperforms same-class
  standard RDS on I/O-bound workloads.

### Scaling

| Dimension | Mechanism |
|---|---|
| Read throughput | Add read replicas (up to 15), reader endpoint load-balances |
| Write throughput (single cluster) | Scale the writer instance class up; or move to Aurora Limitless Database for horizontal write sharding |
| Storage | Fully automatic, 10 GB increments, no downtime, up to 128 TB |
| Compute elasticity | **Aurora Serverless v2** — scales ACUs up/down in fine-grained steps based on load, seconds to react |
| Cross-region reads | **Aurora Global Database** — up to 5 secondary regions, each with up to 16 additional read replicas |

### Security

- **Encryption at rest** via KMS (customer-managed or AWS-managed key);
  once a cluster is created unencrypted, you cannot enable encryption
  in place — must snapshot, copy with encryption enabled, and restore.
- **Encryption in transit** via TLS/SSL to the database endpoint.
- **IAM database authentication** — authenticate to the database using
  IAM credentials/tokens instead of (or alongside) native database
  passwords, removing long-lived DB passwords from application config.
- Runs inside a **VPC**; access controlled via **security groups**
  (stateful, instance/ENI-level) as covered in Domain 1's network
  controls.
- **Secrets Manager** integration for automatic credential rotation —
  the standard answer whenever a scenario says "automatically rotate
  database credentials" for RDS/Aurora.
- **Audit logging** via Advanced Auditing (MySQL-compatible) or
  `pgaudit` (PostgreSQL-compatible) for compliance-grade access logs.

### High availability

- **Multi-AZ by architecture, by default** — the 6-way storage
  replication across 3 AZs exists whether or not you provision a
  second instance; adding a reader in a second AZ gives you an
  automatic failover target.
- **Automatic failover**: if the writer fails, Aurora promotes a
  reader (prioritized by a configurable **failover priority tier**,
  0–15) to writer, typically in under 30 seconds, without requiring
  DNS changes at the application layer (the cluster endpoint
  re-points automatically).
- **RPO** for a single-region Aurora cluster failover is effectively
  **zero** — because writer and reader share the same storage, no
  committed transaction is lost on failover.
- **RTO** is typically well under a minute for same-region failover.
- **Aurora Global Database** adds cross-region DR: RPO is
  **sub-second to low-seconds** (asynchronous, not zero), RTO is
  **under a minute** for a managed planned failover, and can be
  faster or slower for an unplanned regional disaster depending on how
  the failover is triggered.

### Failure scenarios

| Scenario | What happens | Recovery |
|---|---|---|
| Writer instance fails | Aurora promotes highest-priority reader automatically | Typically <30 s, app reconnects via cluster endpoint, RPO ≈ 0 |
| Entire AZ fails | Storage quorum (4-of-6 write, 3-of-6 read) tolerates losing 2 copies (one AZ) without write loss | Automatic, no manual action for storage; instance-level failover if the writer was in that AZ |
| Storage node failure (single copy) | Self-healing — Aurora repairs the missing copy from the other 5 in the background | Transparent, no application impact |
| Entire region fails (with Global Database) | Secondary region promoted to standalone writable cluster | Managed or unplanned failover, RTO <1 min typical, RPO is the last replicated point (asynchronous — some seconds of data can be lost) |
| Accidental `DROP TABLE` / bad deploy | Not an HA event — durability isn't the fix | **Backtrack** (MySQL) for instant rewind, or **point-in-time restore** (both engines) |

### Common mistakes

- Assuming Aurora failover has **zero downtime** — it's fast, not
  instant; applications must still handle a brief connection
  interruption and reconnect (driver-level retry logic matters).
- Using Aurora as an **analytics warehouse** because "it's already
  there" instead of standing up Redshift or using zero-ETL — this
  degrades OLTP performance for both the transactional and analytical
  workloads competing for the same compute.
- Forgetting that **encryption can't be toggled on for an existing
  unencrypted cluster** — must snapshot → copy encrypted → restore.
- Treating **Global Database replication as synchronous** and assuming
  zero data loss on a regional disaster — it's asynchronous; RPO is
  not zero.
- Over-provisioning a fixed instance size for a spiky workload instead
  of using **Aurora Serverless v2**, paying for idle capacity most of
  the day.
- Not setting **failover priority tiers** deliberately, leaving Aurora
  to pick which reader gets promoted rather than the one sized/located
  to actually handle production write traffic.

### Exam traps

⚠️ **"Aurora is Multi-AZ by default" — true for storage, not
automatically for compute HA.** The 6-way storage replication exists on
every Aurora cluster regardless of instance count. But if there is only
**one instance (the writer, no reader)**, there is no automatic
failover target — you need at least one reader in a different AZ for
instance-level HA. Don't assume a single-instance Aurora cluster is
fully HA just because the storage layer is replicated.

⚠️ **Backtrack is MySQL-only.** A question describing "quickly rewind a
PostgreSQL-compatible Aurora cluster to 10 minutes ago" cannot use
Backtrack — the answer is point-in-time restore (which creates a new
cluster, unlike Backtrack which rewinds in place).

⚠️ **Zero-ETL source list is specific — memorize it.** Zero-ETL to
Redshift supports **Aurora MySQL, Aurora PostgreSQL, RDS for MySQL, and
DynamoDB** as sources (the DynamoDB path also supports OpenSearch as a
target). If a question names a source outside that list (standalone
Oracle, on-prem SQL Server, standard RDS PostgreSQL at time of writing),
zero-ETL is the wrong answer — DMS or Glue is correct instead.

⚠️ **Global Database RPO is not zero.** Cross-region replication is
asynchronous at the storage layer. A scenario demanding **zero data
loss across regions** cannot be satisfied by Global Database alone —
that requires an application-level synchronous write pattern or
accepting the trade-off explicitly.

⚠️ **Aurora Serverless v2 is not "scale to zero" like v1 could pause.**
v2 scales down to a configured minimum ACU (as low as 0.5 ACU) but
does not fully pause/stop billing the way Aurora Serverless v1 could —
if a scenario specifically needs a database that pauses to zero cost
during total inactivity, that nuance matters (v1 auto-pause vs. v2's
continuous minimum).

⚠️ **"Least operational overhead, relational, MySQL/PostgreSQL" defaults
to Aurora over standard RDS**, even when the option list doesn't
explicitly explain why — this is one of the exam's most consistent
house-style preferences.

<a name="step7"></a>
## 7. Interview questions

- *"Why would you choose Aurora over standard RDS for a new PostgreSQL
  application, and when would you not?"* Strong answer: default to
  Aurora for the storage architecture's HA/durability/scaling benefits;
  stay on standard RDS only if a specific extension, engine version, or
  a very small/flat/cost-sensitive workload makes Aurora's advantages
  moot or its I/O-based pricing model unfavorable.
- *"Explain why Aurora failover is fast compared to a typical
  primary/replica database setup."* Strong answer: because the reader
  being promoted already shares the same distributed storage volume as
  the writer, it doesn't need to catch up by replaying a redo log or
  copying data — promotion is mostly a metadata/endpoint operation, not
  a data-copy operation.
- *"How would you get near real-time analytics on Aurora data without
  overloading the OLTP cluster?"* Strong answer: zero-ETL integration
  into Redshift — no custom pipeline, seconds of lag, and the
  analytical query load runs entirely on Redshift's compute, not
  Aurora's.
- *"A team wants to test a risky schema migration against production-
  scale data without touching production."* Strong answer: **Aurora
  fast cloning** — a copy-on-write clone is available in minutes
  regardless of data size and only diverges (and only then consumes
  additional storage) for pages that are actually changed.
- *"What's the actual RPO/RTO story for Aurora Global Database, and why
  does it matter to state it precisely?"* Strong answer: RTO is
  typically under a minute for a managed failover; RPO is *not* zero
  because replication is asynchronous — stating this precisely matters
  because a candidate who says "zero data loss" is overselling a
  disaster-recovery guarantee the architecture doesn't actually make.

<a name="step8"></a>
## 8. Cheat sheet

| If the scenario says... | Reach for... |
|---|---|
| new MySQL/PostgreSQL-compatible relational workload, no special constraint | Aurora (default over standard RDS) |
| spiky/unpredictable transactional load | Aurora Serverless v2 |
| need to scale reads, low replication lag | Aurora read replicas (up to 15) |
| multi-region DR or low-latency global reads | Aurora Global Database |
| Aurora/RDS-MySQL/DynamoDB → Redshift, no pipeline | zero-ETL integration |
| instantly rewind a MySQL-compatible cluster | Backtrack |
| rewind PostgreSQL-compatible cluster, or any point-in-time restore | Point-in-time restore (new cluster) |
| test against prod-scale data cheaply/fast | Aurora cloning (copy-on-write) |
| vector similarity search + relational data together | Aurora PostgreSQL + pgvector |
| rotate DB credentials automatically | Secrets Manager |
| I/O costs dominating the Aurora bill | Aurora I/O-Optimized |
| complex OLAP joins, BI dashboards, PB scale | NOT Aurora — Redshift |
| pure key-value, massive scale, sub-ms | NOT Aurora — DynamoDB |
| heterogeneous source engine (Oracle → PostgreSQL) | DMS Schema Conversion, then Aurora as target |

### The 14-column snapshot: Aurora vs. standard RDS

| Column | Aurora | Standard RDS |
|---|---|---|
| Purpose | Cloud-native managed relational DB | Managed traditional relational DB |
| Speed | Up to 5x MySQL / 3x PostgreSQL throughput | Baseline engine speed |
| Cost | I/O + compute + storage (or I/O-Optimized flat) | Instance + EBS storage/IOPS |
| Serverless | ✅ Serverless v2 | ❌ (no serverless mode) |
| Streaming support | ❌ (use zero-ETL/DMS CDC to stream out) | ❌ (same) |
| Batch support | ✅ Standard SQL batch operations | ✅ Same |
| Data volume | Up to 128 TB (Limitless: more, sharded) | Up to 64 TB (engine-dependent) |
| Latency | Low-ms; near-zero replica lag | Low-ms; replica lag can be seconds |
| Scaling | Auto storage; add replicas; Serverless v2 compute | Manual storage provisioning; read replicas add lag |
| Monitoring | CloudWatch, Performance Insights, Advanced Auditing | Same tooling, same depth |
| Security | KMS, IAM auth, VPC, Secrets Manager | Same |
| HA | 6-way/3-AZ storage + fast failover, RPO≈0 | Multi-AZ standby via block replication, RPO≈0 but slower failover |
| Best use case | Default OLTP choice on AWS | Extension/engine-version needs Aurora lacks; small flat workloads |
| When NOT to use | OLAP, pure key-value, unsupported extension | When Aurora's benefits aren't needed and cost matters more |

<a name="step9"></a>
## 9. Memory tricks

**"Aurora shares its storage, not its data."** — writer and readers
attach to the *same* physical storage, which is why failover is fast
and replica lag is tiny; that one fact explains half of Aurora's exam
answers.

**"6-3-2"** — **6** copies of data, across **3** AZs, **2** copies per
AZ. Quorum: write needs 4-of-6, read needs 3-of-6.

**"Backtrack is MySQL, PITR is everywhere."** — the only asymmetric
recovery feature between the two engine flavors.

**"Zero-ETL = Aurora/RDS-MySQL/DynamoDB → Redshift/OpenSearch, no
code."** If the source isn't on that short list, it isn't zero-ETL.

**"Clone now, diverge later."** — cloning is instant because it's
copy-on-write; storage cost only appears where pages actually change.

<a name="step10"></a>
## 10. Practice questions (15)

**Q1.** A retail company runs its order-management system on standard
RDS for MySQL and wants faster failover, higher throughput, and
automatic storage scaling, with no application code changes. Which
migration path requires the least re-architecture?

A) Migrate to DynamoDB and redesign the schema around access patterns
B) Migrate to Aurora MySQL, which is wire- and SQL-compatible with MySQL
C) Migrate to Redshift for better query performance
D) Add more read replicas to the existing standard RDS instance

**Answer: B.** Aurora MySQL is compatible with MySQL at the protocol
and SQL level, so the application typically needs no code changes,
while gaining Aurora's storage architecture (fast failover, auto
storage scaling, higher throughput). **A** is wrong — DynamoDB is a
different data model entirely and would require a full application
redesign. **C** is wrong — Redshift is an OLAP warehouse, not a
transactional order-management backend. **D** is wrong — more replicas
on standard RDS doesn't solve failover speed or auto storage scaling,
the two problems actually stated.

**Q2.** A finance team needs a PostgreSQL-compatible database that can
instantly rewind to a state from 15 minutes ago after a bad batch job
corrupted several tables, without restoring a full backup. Which Aurora
feature satisfies this for PostgreSQL?

A) Backtrack
B) Point-in-time restore, creating a new cluster
C) Aurora Global Database failover
D) Fast cloning

**Answer: B.** Backtrack (option A) is MySQL-compatible only — not
available for Aurora PostgreSQL, making it the trap here. For
PostgreSQL, **point-in-time restore** is the mechanism, though note it
creates a **new** cluster restored to that timestamp rather than
rewinding in place. **C** is wrong — Global Database solves
cross-region DR, not point-in-time data corruption. **D** is wrong —
cloning creates a new copy-on-write cluster from the *current* state,
not a past state.

**Q3.** An engineering team wants near real-time analytics on
operational data currently stored in Aurora PostgreSQL, without
building or maintaining a custom ETL pipeline, and with only seconds of
lag. What should they implement?

A) A nightly Glue job that extracts and loads into Redshift
B) AWS DMS with CDC targeting Redshift
C) Zero-ETL integration from Aurora PostgreSQL to Redshift
D) Query Aurora directly for all analytical workloads

**Answer: C.** Zero-ETL integration is purpose-built for exactly this:
Aurora PostgreSQL (and MySQL) to Redshift, seconds of lag, no pipeline
code. **A** is wrong — nightly batch doesn't meet "near real-time" and
requires building/maintaining a Glue job. **B** is a working but
heavier-weight answer — DMS CDC requires configuring and running a
replication task; zero-ETL is purpose-built and has less operational
overhead for this exact source/target pair, making it the better
answer whenever it's on the list of options. **D** is wrong —
overloads the OLTP cluster and doesn't scale for complex analytical
queries.

**Q4.** A company's Aurora MySQL cluster has one writer and one reader
in the same Availability Zone. During a review, a data engineer flags
this as an availability risk. What is the risk, precisely?

A) The storage layer itself is not replicated
B) There is no automatic failover target if that single AZ fails, despite storage being replicated across 3 AZs
C) Aurora clusters cannot have readers at all
D) Read replicas always introduce unacceptable lag

**Answer: B.** Aurora's storage is always replicated 6 ways across 3
AZs regardless of instance placement (ruling out A), but if **both** the
writer and its only reader sit in the same AZ, an AZ failure takes down
both instances even though the underlying data survives — there's no
healthy instance left to promote quickly. **C** is false. **D** is
false — Aurora replica lag is typically near-zero because readers
share the writer's storage.

**Q5.** Which statement about Aurora Global Database is accurate and
should be stated carefully in a disaster-recovery design review?

A) Replication between regions is synchronous, guaranteeing zero data loss on regional failover
B) Replication between regions is asynchronous; RPO is sub-second to low-seconds, not zero
C) Global Database requires manually copying snapshots between regions on a schedule
D) Global Database only supports a single secondary region

**Answer: B.** Global Database replicates at the storage layer
asynchronously; typical lag is about one second, meaning a true RPO of
zero is not guaranteed during an unplanned regional disaster. **A** is
the classic overselling trap. **C** is wrong — replication is
continuous and automatic, not snapshot-based. **D** is wrong — Global
Database supports up to 5 secondary regions.

**Q6.** A data engineering team needs to run a heavy schema-migration
test against a full copy of a 40 TB Aurora PostgreSQL production
database, without impacting production performance, and wants the copy
ready within minutes rather than hours. What should they use?

A) Take a manual snapshot and restore it to a new cluster
B) Aurora fast cloning (copy-on-write)
C) Aurora Global Database with a new secondary region
D) Export to S3 and reload into a new cluster

**Answer: B.** Fast cloning creates a new cluster that shares the
existing data pages via copy-on-write and is typically ready in
minutes **regardless of database size**, only consuming additional
storage for pages that diverge afterward. **A** is technically
functional but restoring a 40 TB snapshot takes materially longer than
a clone and duplicates full storage immediately. **C** solves
cross-region DR, not a local testing copy, and is a heavier
architecture for this need. **D** is far slower and not how Aurora is
typically tested against.

**Q7.** A team wants to add semantic/similarity search over product
description embeddings, while keeping that data alongside the existing
relational product catalog in the same transactional database, without
standing up a separate dedicated vector database. What should they use?

A) Amazon OpenSearch Service as a separate vector store
B) Aurora PostgreSQL with the pgvector extension
C) DynamoDB with a global secondary index
D) Redshift ML

**Answer: B.** Aurora PostgreSQL supports the **pgvector** extension,
enabling vector similarity search directly alongside relational data in
the same database — exactly the "co-located, no separate store"
requirement in the stem. **A** is a valid vector-search-capable
service, but it's a *separate* store, which the scenario explicitly
wants to avoid. **C** is wrong — DynamoDB GSIs don't provide vector
similarity search. **D** is wrong — Redshift ML is for building/running
ML models inside Redshift, not a vector-embedding similarity search
feature for an OLTP catalog.

**Q8.** An Aurora MySQL cluster's monthly bill shows I/O request
charges consistently making up more than a third of total Aurora
spend, even though storage volume itself is modest. What is the most
direct cost lever to evaluate?

A) Switch to Aurora Serverless v2
B) Switch the cluster to Aurora I/O-Optimized
C) Add more read replicas
D) Enable S3 Intelligent-Tiering on the storage

A) is a valid general elasticity lever but doesn't specifically target
I/O-heavy billing the way I/O-Optimized does. **Answer: B.** Aurora
I/O-Optimized trades a higher instance-hour price for eliminating
separate I/O billing — the documented break-even guidance is roughly
when I/O costs exceed about 25% of total Aurora spend, which this
scenario describes. **C** would increase, not decrease, I/O-related
cost by adding more instances reading from storage. **D** is not
applicable — Aurora storage isn't S3 and doesn't have S3 storage
classes.

**Q9.** Which of the following is a valid zero-ETL integration source
for Amazon Redshift as of the current exam scope?

A) On-premises Oracle database
B) Aurora MySQL
C) Standalone Amazon EC2-hosted PostgreSQL
D) Amazon FSx for Windows

**Answer: B.** Aurora MySQL is one of the supported zero-ETL sources
(along with Aurora PostgreSQL, RDS for MySQL, and DynamoDB). **A**, an
on-prem Oracle database, is not a zero-ETL source — that requires DMS.
**C**, a self-managed PostgreSQL instance on EC2, is not a managed
Aurora/RDS source and is not supported. **D** is not a relational
database at all.

**Q10.** A security review requires that an already-running,
unencrypted Aurora PostgreSQL production cluster be brought into
compliance with an encryption-at-rest mandate with minimal downtime.
What is the correct approach?

A) Enable an "encrypt in place" setting on the running cluster
B) Take a snapshot, copy the snapshot with encryption enabled, restore a new encrypted cluster from the encrypted copy, then cut over
C) Enable SSE-S3 on the cluster's underlying storage
D) It is not possible to encrypt an existing Aurora cluster under any circumstances

**Answer: B.** Aurora (like RDS) cannot toggle encryption on for an
existing unencrypted resource in place — the supported path is
snapshot → copy with encryption enabled → restore to a new encrypted
cluster → cut the application over. **A** does not exist as a
capability. **C** is a category error — SSE-S3 is an S3 feature, not
applicable to Aurora's storage layer, which uses KMS. **D** is wrong —
it is possible, just not in-place.

**Q11.** A workload has highly unpredictable, bursty traffic —
completely idle most nights, then spikes 20x during business hours.
The team wants to avoid manually resizing instances and wants Aurora
compute to react automatically within seconds. What should they choose?

A) A fixed large Aurora provisioned instance sized for peak load
B) Aurora Serverless v2
C) Aurora read replicas only, keeping the writer fixed-size
D) Amazon Redshift Serverless

**Answer: B.** Aurora Serverless v2 scales compute in fine-grained ACU
increments in response to load, reacting in seconds, without
connection drops — exactly fits unpredictable bursty OLTP traffic.
**A** wastes money on idle capacity most of the time. **C** doesn't
solve write-path elasticity, only read scaling. **D** is a different
product entirely — Redshift Serverless is for analytical (OLAP)
workloads, not the OLTP workload described.

**Q12.** During a postmortem, an engineer claims "our Aurora cluster's
writer failed, and we lost zero committed transactions on failover."
Under what condition is that claim accurate?

A) Only if Global Database was configured
B) It's accurate for same-region failover, because writer and reader share the same underlying storage — RPO is effectively zero in that case
C) It's never accurate for Aurora
D) Only if Backtrack was enabled

**Answer: B.** Because Aurora's writer and readers attach to the same
shared, quorum-replicated storage, a same-region failover promotes a
reader that already has every committed write — RPO is effectively
zero for single-region failover. **A** is backwards — Global Database
(cross-region) is where RPO is *not* zero, due to asynchronous
replication. **C** is false. **D** is irrelevant — Backtrack is a
rewind feature, unrelated to failover RPO.

**Q13.** A company currently uses standard RDS for SQL Server and wants
to modernize their MySQL-compatible workloads to Aurora, keeping their
SQL Server workload as-is. What's the correct assessment?

A) Aurora supports SQL Server as a compatible engine, so migrate everything
B) Aurora only supports MySQL- and PostgreSQL-compatible engines; the SQL Server workload must remain on standard RDS (or migrate to a different target)
C) Aurora Serverless v2 adds SQL Server support specifically for serverless use cases
D) DMS Schema Conversion can make Aurora natively run SQL Server

**Answer: B.** Aurora is compatible with **MySQL and PostgreSQL only**
— it does not support SQL Server, Oracle, or other engines. Those
workloads stay on standard RDS (or migrate to a supported Aurora engine
via schema conversion if the target changes, which is a much bigger
project than "just migrate"). **A**, **C**, and **D** all incorrectly
imply Aurora engine support that doesn't exist.

**Q14.** A data engineer needs to give a Lambda function programmatic
access to query an Aurora PostgreSQL database, without embedding a
long-lived database password in the function's configuration or in
Secrets Manager rotation dependency chains, using short-lived
credentials instead. What feature fits best?

A) IAM database authentication
B) A hardcoded password in an environment variable
C) A static Secrets Manager secret with rotation disabled
D) Security group rules alone

**Answer: A.** IAM database authentication lets a client (including
Lambda, via its execution role) generate a short-lived auth token
using IAM credentials instead of a static database password — no
long-lived secret to manage at all for this path. **B** and **C**
both keep a long-lived credential in play, which is exactly what the
scenario wants to avoid. **D** — security groups control network
reachability, not database authentication.

**Q15.** A scenario describes a workload needing "hundreds of
concurrent business analysts running complex ad-hoc joins across a
50 TB dataset, with sub-second dashboard refresh." The current
architecture is a single large Aurora PostgreSQL cluster. What is the
correct recommendation?

A) Add more Aurora read replicas until performance is acceptable
B) Increase the writer instance size
C) Move the analytical workload off Aurora — use zero-ETL to replicate into Redshift and serve the dashboards from there
D) Enable Aurora Serverless v2 to auto-scale through the load

**Answer: C.** This is a textbook OLAP workload (complex joins, high
concurrency, BI dashboards) that Aurora — a row-oriented OLTP engine —
is not designed for, no matter how it's scaled. The senior-engineer
answer is to recognize the workload mismatch and move it to a
purpose-built OLAP engine, with zero-ETL keeping Redshift in sync
without a custom pipeline. **A**, **B**, and **D** all try to scale
Aurora harder instead of recognizing that the workload itself belongs
on a different engine — a common trap answer pattern on this exam
(more capacity ≠ the right architecture).
