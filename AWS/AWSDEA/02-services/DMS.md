# AWS Database Migration Service (DMS)

> Deep-reference file for **AWS DMS**, scoped narrower than a full
> domain file. Read alongside `00-START-HERE/SERVICE-SELECTION-MATRIX.md`
> Part 3 (database migration & CDC matrix) for the head-to-head against
> zero-ETL and Glue+JDBC — this file goes deeper on DMS internals: full
> load vs. CDC vs. full-load-plus-CDC, replication instance sizing, DMS
> Serverless, source/target combinations, LOB handling, DMS Schema
> Conversion, validation, and ongoing replication monitoring. Primarily
> tested in **Domain 1 (Data Ingestion and Transformation, 34%)**, Task
> 1.1, with migration-specific content also appearing in **Domain 2**.
>
> ⚠️ **Currency correction (December 2025 exam guide revision):** **AWS
> Schema Conversion Tool (SCT)** as a standalone downloadable product
> was removed from the DEA-C01 in-scope services list. Schema
> conversion is now covered on this exam as **DMS Schema Conversion**
> — a capability built directly into the DMS console/service, not a
> separate tool you install. This file uses that current terminology
> throughout; do not answer with "AWS SCT" as a standalone product on
> this exam.

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

Imagine you're moving from an old house to a new one, and you have a
truck that can do two different jobs. First, it can make one big trip
carrying every box you currently own (**full load**) — but while it's
driving, your family keeps living in the old house and generating new
boxes. So the truck also has a special trick: it can watch the old
house's front door and instantly grab any *new* box the moment it
appears, driving it straight to the new house too (**CDC — change data
capture**), so by the time you're ready to flip the switch and start
living in the new house, nothing got left behind or lost in between.
DMS is that truck. And if your old house and new house are built
completely differently — different shaped doors, different room
layouts — DMS also has a built-in architect (**DMS Schema Conversion**)
that looks at the old house's blueprint and draws you a matching
blueprint for the new one, so the new house is actually ready to
receive the boxes in the first place.

<a name="step2"></a>
## 2. Explain technically

**AWS Database Migration Service (DMS)** is a managed service for
migrating databases to AWS and for **continuously replicating ongoing
changes** between a source and target database or streaming
destination. DMS operates in three modes: **full load** (a one-time
bulk copy of existing data, suitable when the source can be quiesced
or briefly paused), **CDC (change data capture)** (continuously
streaming ongoing changes by reading the source database's native
change log — binlog for MySQL, redo log/logical replication for
Oracle/PostgreSQL, oplog for MongoDB — without modifying the
application), and **full load + CDC** (the default recommendation for
**minimal-downtime migrations**: DMS performs the initial bulk copy,
then seamlessly transitions to streaming ongoing changes that occurred
during and after that copy, so the target stays current until cutover).
DMS runs on a **replication instance** (or, in **DMS Serverless**,
without a instance to size at all — AWS provisions capacity
automatically based on workload). DMS supports both **homogeneous**
migrations (same engine, e.g., MySQL → Aurora MySQL) and
**heterogeneous** migrations (different engines, e.g., Oracle →
PostgreSQL), where the schema itself — tables, indexes, stored
procedures, views, functions — must be converted first using **DMS
Schema Conversion**, since DMS itself only moves data, not schema
objects.

<a name="step3"></a>
## 3. Explain like a Senior AWS Data Engineer

A senior engineer's first move on any DMS scenario is separating **what
DMS actually does (move data)** from **what it doesn't do (convert
schema)** — this single distinction resolves most of the exam's DMS
confusion. The second move is mapping the business requirement onto
one of the three load modes precisely: "one-time migration, source can
be paused" → **full load only**; "keep an already-migrated target
continuously current going forward" → **CDC only**; "migrate with
minimal or zero downtime" → **full load + CDC**, which is the
overwhelming default answer whenever "minimal downtime" appears in a
migration scenario. The senior engineer's next instinct is checking
whether the source/target pair is actually a **zero-ETL** candidate
instead — DMS is the general-purpose tool, but if the source is
Aurora/RDS-MySQL/DynamoDB and the target is Redshift/OpenSearch with no
transformation needed, zero-ETL is lower operational overhead and the
better answer when it's on the option list. Where DMS earns its keep
over zero-ETL is precisely the cases zero-ETL doesn't cover: on-prem
sources, heterogeneous engines, non-Redshift/OpenSearch targets
(Kinesis, MSK, S3, another RDS/Aurora engine), and one-time migration
projects rather than standing analytical replication. Operationally, a
senior engineer treats replication instance sizing and **LOB
(large object) handling mode** as the two places migrations quietly
fail in production: an undersized replication instance chokes on CDC
throughput under real load, and **full LOB mode** (complete but slow)
versus **limited LOB mode** (fast but truncates oversized objects) is a
correctness-vs-speed trade-off that must be made deliberately, not
left at a default nobody reviewed.

<a name="step4"></a>
## 4. Production architecture

```
   SOURCE                          DMS REPLICATION                    TARGET
┌───────────────┐                 ┌─────────────────────────┐
│  On-prem Oracle  │               │   REPLICATION INSTANCE     │      ┌───────────────┐
│  SQL Server        │──────────▶│   (or DMS SERVERLESS —      │────▶│  Amazon Aurora   │
│  MySQL / PostgreSQL │  reads     │   no instance to size)      │      │  RDS / Redshift  │
│  MongoDB / DB2 / SAP │  native    │                              │      │  DynamoDB / S3   │
│  Amazon RDS/Aurora   │  change    │  ┌────────────────────┐    │      │  Kinesis / MSK    │
└───────────────┘  log       │  │   FULL LOAD TASK      │    │      │  OpenSearch        │
                                 │  │   one-time bulk copy   │    │      └───────────────┘
                                 │  └────────────────────┘    │
                                 │  ┌────────────────────┐    │
                                 │  │   CDC TASK             │    │
                                 │  │   continuous streaming │    │
                                 │  │   of ongoing changes   │    │
                                 │  │   (binlog/redo/oplog)  │    │
                                 │  └────────────────────┘    │
                                 └─────────────────────────┘
                                             │
                                             │  requires supplemental
                                             │  logging / binlog enabled
                                             │  on the SOURCE
                                             ▼
                    ┌───────────────────────────────────────────────┐
                    │              DMS SCHEMA CONVERSION                 │
                    │   Built into DMS (not a separate standalone tool). │
                    │   Converts tables, indexes, views, stored          │
                    │   procedures, functions between different engines  │
                    │   (heterogeneous migrations only, e.g. Oracle→PG). │
                    │   Runs BEFORE the data migration task.              │
                    └───────────────────────────────────────────────┘

                    ┌───────────────────────────────────────────────┐
                    │             DMS VALIDATION (optional)              │
                    │   Compares source and target row-by-row after      │
                    │   migration to confirm completeness and accuracy.  │
                    └───────────────────────────────────────────────┘

        MONITORING: CDCLatencySource (lag reading the source's change
        log) and CDCLatencyTarget (lag applying changes to the target)
        — the two signature DMS ongoing-replication health metrics.
```

**Reading the diagram, stage by stage:** DMS connects to the **source**
database using its native protocol and, for CDC, reads the database's
**native transaction/change log** directly (binlog for MySQL, redo
log/logical replication slots for Oracle/PostgreSQL, oplog for
MongoDB) — this is the mechanism that makes CDC possible **without any
application code changes**, since DMS is reading a log the database
already maintains rather than requiring the app to emit change events
itself. That log-reading capability has a prerequisite the exam tests
directly: **supplemental logging (or equivalent, e.g., binlog
enabled)** must be turned on at the source, or DMS has no change stream
to read. Work is coordinated by a **replication instance** — a managed
compute resource you size (vCPU/memory) to handle the throughput of
both the initial full load and the ongoing CDC stream — or, in **DMS
Serverless**, AWS scales this capacity automatically, removing the
sizing decision entirely. A migration task can run as **full load
only** (bulk-copies existing data once and stops), **CDC only**
(streams only ongoing changes, assuming the target is already seeded),
or **full load + CDC** (the default for minimal-downtime migrations —
bulk copy first, then a seamless transition to streaming the changes
that accumulated during and after that copy, keeping the target current
until a deliberate cutover). Before any of this runs for a
**heterogeneous** migration (different source and target engines), **DMS
Schema Conversion** — built directly into DMS, not a separate
standalone product — analyzes the source schema and generates
equivalent target-engine schema objects (tables, indexes, views, stored
procedures, functions), flagging anything that can't be automatically
converted for manual review. After migration, an optional **DMS
validation task** performs a row-by-row comparison between source and
target to confirm the migration was complete and accurate — the direct
answer whenever a scenario asks "how do we verify the migration was
correct." Throughout ongoing CDC replication, the two metrics a senior
engineer watches are **`CDCLatencySource`** (how far behind DMS is in
*reading* the source's change log) and **`CDCLatencyTarget`** (how far
behind DMS is in *applying* those changes to the target) — a rising
`CDCLatencySource` points to a source-side bottleneck (e.g., DMS
struggling to keep up reading the log), while a rising
`CDCLatencyTarget` points to a target-side bottleneck (e.g., the target
database struggling to absorb writes fast enough).

<a name="step5"></a>
## 5. Per-service coverage checklist

### Purpose

AWS DMS migrates databases to AWS and continuously replicates ongoing
changes between a source and a target database or streaming
destination, supporting both one-time migrations and standing,
continuous replication, across homogeneous and heterogeneous engine
pairs.

### When to use

- **One-time database migration** to AWS, from on-prem or another
  cloud, with the source engine either matching or differing from the
  target.
- **Minimal-downtime migration** — full load + CDC keeps the target
  current with ongoing source changes until a planned cutover.
- **Continuous, standing replication** for hybrid architectures (e.g.,
  keeping an on-prem database and an AWS copy in sync indefinitely).
- **Heterogeneous engine migrations** (Oracle → PostgreSQL, SQL Server
  → MySQL, etc.), paired with DMS Schema Conversion for the schema
  portion.
- **Turning a database into a stream** — DMS can target Kinesis Data
  Streams or Amazon MSK directly, which is the standard way to convert
  relational database changes into an event stream for downstream
  consumers.
- Sources or targets **not covered by zero-ETL** — on-prem databases,
  non-Aurora/RDS-MySQL sources, or targets other than Redshift/
  OpenSearch.

### When NOT to use

- **Aurora MySQL/PostgreSQL, RDS for MySQL, or DynamoDB replicating
  into Redshift or OpenSearch with no transformation needed** —
  **zero-ETL integration** is purpose-built for exactly this pairing
  and requires no DMS task, replication instance, or ongoing
  operational management at all.
- **Simple, scheduled, non-continuous batch extracts from a JDBC
  source for ETL purposes** (not a migration or standing replication
  need) — **Glue with a JDBC connection** is the more natural,
  ETL-shaped tool.
- **The workload doesn't actually need change-log-level CDC** — if a
  nightly watermark-based extract (`updated_at > last_run`) is
  sufficient, standing up DMS CDC is more operational machinery than
  the requirement calls for.

### Advantages

- **Zero application code changes required for CDC** — reads the
  database's native change log directly.
- Supports **dozens of source and target combinations**, including
  heterogeneous engine pairs.
- **DMS Serverless** removes replication instance sizing entirely for
  variable or unpredictable migration/replication workloads.
- Can target **streaming destinations (Kinesis, MSK)** directly,
  turning a database into an event stream without custom CDC code.
- **Built-in validation** provides an automated, auditable way to
  confirm migration completeness and accuracy.
- **DMS Schema Conversion** automates the majority of schema
  translation work for heterogeneous migrations, flagging only the
  portions needing manual attention.

### Limitations

- **DMS does not migrate schema, indexes, stored procedures, or
  functions by itself** — that is DMS Schema Conversion's job, a
  distinct step that must run first for heterogeneous migrations.
- **CDC requires the source to support and have enabled the relevant
  change-log mechanism** (supplemental logging, binlog, logical
  replication slots) — not every source configuration has this on by
  default, and enabling it may require source-side privileges or a
  brief source-side change.
- **LOB (large object) handling is a real trade-off**: **limited LOB
  mode** is fast but truncates objects above a configured size; **full
  LOB mode** is complete but meaningfully slower.
- **Replication instance sizing mistakes cause real production
  problems** — undersized instances can't keep up with CDC throughput
  under load, showing up as rising `CDCLatencySource`/`CDCLatencyTarget`.
- Not a transformation engine — DMS moves and (in ongoing replication)
  applies changes; it does not perform joins, aggregations, or complex
  business-logic transformations the way Glue does.

### Pricing considerations

- **Replication instance**: billed per instance-hour (by instance
  class) while running, plus storage for logs/buffering — the classic
  "size it right or pay for idle/underpowered capacity" trade-off.
- **DMS Serverless**: billed by **DCU (DMS Capacity Unit) hours**
  actually consumed, removing the instance-sizing cost-guessing game
  for variable workloads.
- **Data transfer** costs apply for cross-region or cross-AZ movement
  between source, DMS, and target.
- **DMS Schema Conversion** itself is offered at no additional charge
  as part of DMS (the underlying compute/storage it may use is billed
  normally) — the cost driver in a migration project is typically the
  replication instance and data transfer, not the schema conversion
  step.
- A **transient/short-lived replication instance** for a one-time full
  load only, torn down after cutover, is meaningfully cheaper than
  leaving a replication instance running indefinitely for a workload
  that only needed a one-time migration.

### Performance

- Full load throughput scales with replication instance size (or DCU
  allocation in Serverless) and source database read capacity.
- CDC throughput is bounded by how fast DMS can read the source's
  change log and how fast the target can apply changes — either side
  can become the bottleneck, which is exactly why the two latency
  metrics are tracked separately.
- **Parallel load** (splitting large tables into multiple segments for
  full load) significantly improves full-load throughput for very
  large tables when properly configured.

### Scaling

| Dimension | Mechanism |
|---|---|
| Replication compute | Increase replication instance class, or switch to DMS Serverless for automatic scaling |
| Full load throughput | Parallel load / table segmentation for large tables |
| Multiple source/target pairs | Run multiple replication tasks, potentially on the same or separate replication instances depending on load isolation needs |
| CDC catch-up after a backlog | Temporarily scale up the replication instance/DCU allocation, or increase target write capacity if `CDCLatencyTarget` is the bottleneck |

### Security

- **Encryption in transit**: SSL/TLS connections to both source and
  target endpoints where supported.
- **Encryption at rest**: KMS encryption for the replication instance
  storage and any logs/data staged during migration.
- **IAM roles** control DMS's permissions to access source/target
  endpoints, S3 (for certain source/target configurations), and other
  AWS services.
- **VPC deployment** — replication instances run inside a VPC, with
  security groups controlling network access to source and target
  databases.
- **Secrets Manager** integration for storing source/target database
  credentials rather than embedding them in endpoint configuration.

### High availability

- **Multi-AZ replication instances** — DMS supports a standby
  replication instance in a second AZ for HA, with automatic failover
  if the primary replication instance becomes unavailable, similar in
  spirit to RDS Multi-AZ.
- HA for the **replication instance** does not by itself guarantee zero
  data loss for in-flight CDC — the underlying source and target
  databases' own durability/HA characteristics still matter for the
  full picture.
- **DMS Serverless** abstracts away instance-level HA configuration
  entirely, with AWS managing underlying resilience.

### Failure scenarios

| Scenario | Symptom | Fix |
|---|---|---|
| Replication instance undersized for CDC volume | `CDCLatencySource` and/or `CDCLatencyTarget` climbing | Scale up replication instance class or move to DMS Serverless |
| Source-side change log not enabled | CDC task fails to start or captures no changes | Enable supplemental logging / binlog / logical replication slot on the source, per engine-specific requirements |
| Large objects truncated after migration | Limited LOB mode was used and objects exceeded the configured size threshold | Switch to full LOB mode (accepting slower throughput) for tables with large or unpredictable LOB sizes |
| Target can't keep up applying changes | `CDCLatencyTarget` climbing while `CDCLatencySource` stays low | Scale up target write capacity (e.g., target instance class), or investigate target-side locking/contention |
| Heterogeneous migration has schema objects DMS can't move | Application fails against the target because required schema objects are missing | Run DMS Schema Conversion first, review flagged manual-conversion items before starting the data migration task |
| Post-migration data mismatch discovered late | No automated way to have caught it | Should have configured a **DMS validation task** to catch this automatically during/after migration |

### Common mistakes

- Assuming DMS migrates **schema** automatically — it does not; schema
  must be handled via **DMS Schema Conversion** first for heterogeneous
  migrations (homogeneous migrations can often use native
  engine-to-engine schema/snapshot tools instead).
- Forgetting to enable **supplemental logging / binlog** on the source
  before starting a CDC task, causing the task to fail or silently
  capture nothing.
- Defaulting to **limited LOB mode** without checking actual LOB size
  distribution in the source data, silently truncating large objects.
- Leaving a **replication instance running indefinitely** after a
  one-time full-load-only migration completes, paying for unnecessary
  standing compute.
- Not running a **validation task**, then discovering data
  discrepancies only after the application has already cut over to the
  target.
- Choosing DMS when the source/target pair is actually a **zero-ETL**
  candidate, taking on unnecessary operational overhead (a standing
  replication instance and task to manage) for a pairing that has a
  fully managed, no-pipeline alternative.

### Exam traps

⚠️ **"Minimal downtime migration" = full load + CDC, not full load
alone.** Full load alone requires the source to be quiesced (or accepts
losing changes made during the copy); "minimal downtime" specifically
signals the combined mode.

⚠️ **DMS does not migrate schema/indexes/stored procedures/functions.**
Any scenario implying "just run DMS and everything — data and schema —
moves" is wrong; heterogeneous migrations require **DMS Schema
Conversion** as a separate, prerequisite step.

⚠️ **Do not answer "AWS SCT" as a standalone product on this exam.**
Per the December 2025 exam guide revision, standalone AWS SCT was
removed from scope. Schema conversion is tested as **DMS Schema
Conversion**, built into DMS itself — an option phrased as "download
and run AWS SCT separately" describes outdated tooling, not the current
in-scope answer.

⚠️ **Aurora/RDS-MySQL/DynamoDB → Redshift/OpenSearch with no
transformation is a zero-ETL scenario, not a DMS scenario**, whenever
zero-ETL is among the answer options — DMS is correct for this pairing
only when zero-ETL isn't offered as a choice or the scenario needs
something zero-ETL doesn't support (e.g., a transformation step, or a
target zero-ETL doesn't cover).

⚠️ **CDC requires the source's change log mechanism to be enabled —
this is not automatic.** A scenario where CDC "isn't capturing any
changes" and the source's binlog/supplemental logging was never
enabled is a very common failure-scenario question pattern.

⚠️ **LOB mode is a real trade-off, not a defaults-are-fine setting.**
"Full LOB mode" (complete, slow) vs. "limited LOB mode" (fast,
truncates) should be chosen deliberately based on actual LOB size
distribution in the source — a scenario mentioning unexpectedly missing
or truncated large object data after migration is describing this
exact trap.

<a name="step7"></a>
## 7. Interview questions

- *"Walk me through the difference between full load, CDC, and full
  load plus CDC, and when you'd choose each."* Strong answer: full load
  alone for a one-time migration where the source can be paused or
  data-loss-during-copy is acceptable; CDC alone to keep an
  already-seeded target current going forward; full load plus CDC as
  the default for a minimal-downtime migration, since it seeds the
  target and then seamlessly streams everything that changed during
  and after that seeding.
- *"A stakeholder says 'just use DMS to move our Oracle database to
  PostgreSQL, tables and all.' What's missing from that plan?"* Strong
  answer: DMS moves data, not schema — for a heterogeneous migration
  like Oracle to PostgreSQL, DMS Schema Conversion needs to run first
  to translate tables, indexes, views, stored procedures, and
  functions into PostgreSQL-compatible equivalents before the DMS data
  migration task can populate a working target.
- *"How would you verify a large migration was complete and accurate
  without manually spot-checking millions of rows?"* Strong answer:
  configure a **DMS validation task**, which automatically compares
  source and target data after migration and flags discrepancies,
  rather than relying on manual sampling.
- *"`CDCLatencyTarget` is climbing while `CDCLatencySource` stays flat
  and low. What does that tell you, and what would you check?"* Strong
  answer: the bottleneck is on the target side — DMS is keeping up
  reading the source's change log fine, but the target database isn't
  absorbing changes fast enough; check target write capacity, locking/
  contention, and whether the target instance needs to be scaled up.
- *"When would you choose DMS over zero-ETL for an Aurora-to-Redshift
  pipeline?"* Strong answer: almost never for a plain Aurora-to-
  Redshift pairing with no transformation need — zero-ETL is purpose-
  built and lower overhead; DMS becomes relevant if the target isn't
  Redshift/OpenSearch, the source isn't on zero-ETL's supported list,
  or the pipeline needs a target zero-ETL doesn't support (e.g.,
  Kinesis or MSK).

<a name="step8"></a>
## 8. Cheat sheet

| If the scenario says... | Reach for... |
|---|---|
| one-time migration, source can be paused | DMS full load only |
| keep an already-seeded target current going forward | DMS CDC only |
| minimal/zero downtime migration | DMS full load + CDC |
| heterogeneous engine (Oracle → PostgreSQL, etc.) | DMS + DMS Schema Conversion |
| verify migration completeness/accuracy | DMS validation task |
| turn a database into an event stream | DMS targeting Kinesis or MSK |
| unpredictable migration workload, no instance sizing wanted | DMS Serverless |
| Aurora/RDS-MySQL/DynamoDB → Redshift/OpenSearch, no transform | NOT DMS — zero-ETL integration |
| nightly scheduled JDBC extract, ETL-shaped | NOT DMS — Glue JDBC connection |
| consumers/CDC "not capturing anything" | Check supplemental logging / binlog enabled on source |
| CDC falling behind | Check `CDCLatencySource` vs. `CDCLatencyTarget` to find which side is the bottleneck |
| large objects missing/truncated after migration | Limited LOB mode truncated them — switch to full LOB mode |
| "AWS SCT" appears as a standalone downloadable tool in an option | Outdated — current answer is DMS Schema Conversion |

### 14-column snapshot: DMS vs. zero-ETL

| Column | AWS DMS | Zero-ETL integration |
|---|---|---|
| Purpose | Migrate + continuously replicate | Auto-sync operational DB → analytics |
| Speed | Seconds (CDC lag) | Seconds to ~15 min |
| Cost | Replication instance-hours, or Serverless DCUs | No pipeline cost |
| Serverless | DMS Serverless available | Fully serverless |
| Streaming support | ✅ CDC mode | ✅ |
| Batch support | ✅ Full load | Automatic initial seed |
| Data volume | Any size, engine-dependent | Aurora/RDS-MySQL/DynamoDB scale |
| Latency | Seconds (CDC) | Seconds |
| Scaling | Instance class, or Serverless DCU auto-scale | Fully automatic |
| Monitoring | `CDCLatencySource`, `CDCLatencyTarget` | Native Redshift/OpenSearch monitoring |
| Security | KMS, IAM, VPC, Secrets Manager | Inherits source/target security |
| HA | Multi-AZ replication instance option | Managed, no instance to fail |
| Best use case | On-prem/heterogeneous/non-Redshift targets, migrations | Aurora/RDS-MySQL/DynamoDB → Redshift/OpenSearch, no code |
| When NOT to use | Source/target is a supported zero-ETL pairing with no transform need | Source or target outside the supported zero-ETL list |

<a name="step9"></a>
## 9. Memory tricks

**"Full load copies. CDC follows. Full load + CDC does both."** — the
three modes in one line; "minimal downtime" always means the third.

**"DMS moves data. Schema Conversion moves structure."** — the single
fact that resolves most DMS confusion on this exam.

**"No log, no CDC."** — supplemental logging/binlog must be on at the
source, or there's nothing for DMS to read.

**"Source or Target — which latency is climbing?"** —
`CDCLatencySource` = DMS can't read fast enough; `CDCLatencyTarget` =
target can't absorb fast enough.

**"Limited is fast and lossy for big objects. Full is slow and
complete."** — the LOB-mode trade-off in one line.

<a name="step10"></a>
## 10. Practice questions (15)

**Q1.** A retailer is migrating an on-prem Oracle database to Amazon
Aurora PostgreSQL and must minimize application downtime during
cutover. Which DMS configuration best fits?

A) Full load only, scheduled during a maintenance window
B) CDC only, assuming the target is already populated
C) Full load + CDC, transitioning seamlessly from initial copy to streaming ongoing changes
D) DMS Schema Conversion alone, without a data migration task

**Answer: C.** "Minimize downtime" is the textbook signal for full
load + CDC — DMS performs the initial bulk copy, then streams changes
that occurred during and after that copy, keeping the target current
until a clean, minimal-downtime cutover. **A** requires quiescing the
source or accepting lost changes during the copy window, working
against the downtime goal. **B** assumes a pre-seeded target, which
isn't the case here. **D** only handles schema, not data — necessary
as a prerequisite (since this is a heterogeneous Oracle→PostgreSQL
migration) but not sufficient on its own.

**Q2.** In the same Oracle-to-Aurora-PostgreSQL migration from Q1, what
must happen before the DMS data migration task can successfully
populate the target with usable tables, indexes, and stored
procedures?

A) Nothing — DMS automatically converts and creates all schema objects
B) DMS Schema Conversion must run first, translating Oracle schema objects into PostgreSQL-compatible equivalents
C) The team must manually write PostgreSQL DDL from scratch, since DMS Schema Conversion doesn't support Oracle
D) Enable CDC only, which implicitly creates the schema

**Answer: B.** Because this is a heterogeneous migration (Oracle to
PostgreSQL), the schema itself must be translated — DMS Schema
Conversion (built into DMS, not a separate standalone tool) handles
this, flagging anything it can't auto-convert for manual review, before
the data migration task runs. **A** is the core DMS misconception this
exam tests directly — DMS moves data, not schema. **C** overstates the
manual effort required; DMS Schema Conversion automates the majority of
this work. **D** is unrelated — CDC captures data changes, not schema
creation.

**Q3.** A monitoring dashboard for an ongoing DMS CDC replication task
shows `CDCLatencySource` steadily low and stable, but `CDCLatencyTarget`
climbing continuously. What does this indicate, and what should be
investigated first?

A) DMS is struggling to read the source's change log; scale up the replication instance's read capacity
B) The target database is struggling to apply changes fast enough; investigate target write capacity, locking, or contention
C) The source database has lost network connectivity
D) This pattern always indicates a misconfigured replication instance, unrelated to source or target

**Answer: B.** `CDCLatencySource` measures reading lag from the source;
staying low means DMS is keeping up fine there. `CDCLatencyTarget`
measures applying lag at the target; a climbing value with a healthy
source-side metric isolates the bottleneck to the target's ability to
absorb writes. **A** misattributes the bottleneck to the source side,
contradicted by the stable `CDCLatencySource`. **C** would typically
show up as a stalled or failed task, not a specifically climbing
target-latency metric. **D** is too vague and ignores the diagnostic
value of having two separate metrics precisely to distinguish source
vs. target bottlenecks.

**Q4.** A media company needs to migrate a MySQL database used by a
legacy application to Amazon RDS for MySQL, has strict data-loss
tolerance requirements, and can tolerate a short maintenance window
during which the application is briefly taken offline. Which is the
simplest sufficient DMS configuration?

A) Full load + CDC is always required regardless of maintenance window tolerance
B) Full load only, performed during the maintenance window while the source is quiesced
C) CDC only
D) DMS cannot be used for homogeneous MySQL-to-MySQL migrations

**Answer: B.** With a maintenance window available and the source
quiesced (no new writes during the copy), a one-time **full load only**
is sufficient and simpler than adding CDC, which exists specifically to
handle changes occurring *during* an online migration. **A**
overcomplicates a scenario that explicitly allows downtime — full load
+ CDC is the answer when downtime must be minimized, not a universal
requirement. **C** assumes a pre-seeded target, not applicable to a
fresh migration. **D** is false — DMS fully supports homogeneous
migrations, and they're often simpler than heterogeneous ones since
schema can frequently be handled with native engine tools rather than
DMS Schema Conversion.

**Q5.** A data engineer configures a DMS CDC task against a MySQL
source and finds that no changes are being captured at all, even
though the application is actively writing to the database. What is
the most likely root cause?

A) The replication instance is undersized
B) Binary logging (binlog) is not enabled on the MySQL source, so DMS has no change log to read
C) The target database is offline
D) DMS Serverless doesn't support CDC

**Answer: B.** CDC depends entirely on reading the source's native
change log — for MySQL, that's the binlog. If it isn't enabled, DMS has
nothing to capture changes from, even with a healthy application
writing data. **A** would show up as latency/throughput problems, not
zero captured changes. **C** would cause the task to fail applying
changes, not fail to capture them from the source in the first place.
**D** is false — DMS Serverless fully supports CDC.

**Q6.** A team is migrating a database containing several tables with
large binary objects (LOBs) up to several hundred MB each. After
completing the migration using DMS's default LOB settings, they
discover several large objects were truncated in the target. What
happened, and what should be changed for a re-run?

A) DMS never supports LOB data; a different tool is required
B) Limited LOB mode was used, which truncates objects above a configured size threshold for speed; switch to full LOB mode for completeness
C) The replication instance ran out of storage entirely, unrelated to LOB mode
D) This is expected and unavoidable behavior; large objects cannot be migrated by any method

**Answer: B.** Limited LOB mode prioritizes speed by truncating LOBs
above a configured threshold — exactly the symptom described. Full LOB
mode migrates LOBs completely, at the cost of slower throughput,
appropriate when data completeness matters more than speed for
large-object-heavy tables. **A** is false — DMS explicitly supports LOB
migration via these two configurable modes. **C** is a different
failure mode with different symptoms (task failure, not selective
truncation). **D** is false — full LOB mode solves exactly this
problem.

**Q7.** A company's operational database is Aurora MySQL, and they want
near real-time analytics in Amazon Redshift with the least possible
operational overhead, no transformation logic needed, and no
standing replication task to manage. What should they choose instead
of DMS?

A) DMS full load + CDC targeting Redshift
B) Zero-ETL integration from Aurora MySQL to Redshift
C) DMS Schema Conversion targeting Redshift
D) A nightly Glue job

A) technically works but requires standing up and maintaining a DMS
replication instance and task — more operational overhead than
necessary for this specific pairing. **Answer: B.** Zero-ETL is
purpose-built for exactly the Aurora MySQL → Redshift pairing with no
transformation need, requiring no pipeline, replication instance, or
ongoing task management at all — the lowest-overhead answer whenever
it's on the option list for a supported source/target pair. **C** is a
category error — Schema Conversion converts schema for heterogeneous
migrations, unrelated to ongoing analytics replication. **D** doesn't
meet "near real-time" and still requires building/maintaining a
scheduled job.

**Q8.** Which statement accurately describes what a DMS validation task
does?

A) It automatically fixes any data discrepancies found between source and target
B) It compares source and target data after migration to confirm completeness and accuracy, flagging discrepancies for review
C) It validates only the schema, not the actual row data
D) It is required before any DMS migration task can start

**Answer: B.** Validation performs a comparison between source and
target data to confirm the migration was complete and accurate,
surfacing discrepancies for a human to review and address — it is the
standard automated answer to "how do we verify the migration was
correct" instead of manual spot-checking. **A** overstates its
function — it flags discrepancies, it doesn't auto-remediate them.
**C** is backwards — validation is about data, and schema correctness
is a DMS Schema Conversion concern. **D** is false — validation is
optional and typically runs during or after the migration task, not as
a prerequisite to starting one.

**Q9.** A team needs to continuously feed row-level change events from
an on-prem SQL Server database into a real-time processing pipeline
built on Amazon Kinesis Data Streams, without modifying the SQL Server
application. What should they use?

A) DMS with CDC mode, targeting Kinesis Data Streams
B) Zero-ETL integration, since SQL Server is a relational source
C) AWS AppFlow, since it handles continuous data movement
D) A custom Lambda function polling SQL Server on a schedule

**Answer: A.** DMS CDC can target Kinesis Data Streams directly,
reading SQL Server's native change log and streaming row-level changes
into Kinesis with zero application code changes — exactly matching the
requirement. **B** is wrong — zero-ETL's supported sources are
Aurora MySQL/PostgreSQL, RDS for MySQL, and DynamoDB; on-prem SQL
Server is not on that list. **C** is wrong — AppFlow integrates with
named SaaS applications, not on-prem relational databases via native
change logs. **D** reinvents CDC with polling, adding both
latency and unnecessary custom engineering DMS already solves natively.

**Q10.** A migration project completes a one-time, downtime-tolerant
full-load-only migration from an on-prem PostgreSQL database to RDS for
PostgreSQL. Two weeks after cutover, the team notices they are still
being billed for a running DMS replication instance. What is the most
likely oversight?

A) DMS replication instances cannot be stopped once started
B) The replication instance was never terminated after the one-time migration task completed, since it was only needed transiently
C) This is expected — DMS replication instances are billed indefinitely by design regardless of task status
D) The migration must not have actually completed

**Answer: B.** For a one-time, full-load-only migration, the
replication instance is only needed for the duration of the migration
task — leaving it running afterward is a common, avoidable cost
mistake; it should be terminated once cutover is confirmed successful.
**A** is false — replication instances can absolutely be stopped or
deleted. **C** mischaracterizes billing as unavoidable when it's simply
an operational oversight. **D** is an unsupported leap; billing
continuing doesn't imply migration failure.

**Q11.** Which of the following is an accurate statement about DMS
Serverless?

A) It eliminates the need to size a replication instance, scaling automatically based on migration/replication workload, billed by DCU-hours
B) It only supports full load, not CDC
C) It requires manually specifying broker count and partition count
D) It is only available for homogeneous migrations

**Answer: A.** DMS Serverless removes the replication-instance sizing
decision entirely, scaling capacity automatically and billing per DCU
(DMS Capacity Unit) hour actually consumed — ideal for variable or
hard-to-predict migration/replication workloads. **B** is false — DMS
Serverless supports CDC as well as full load. **C** describes Kafka/MSK
concepts, not DMS Serverless. **D** is false — DMS Serverless works for
both homogeneous and heterogeneous scenarios (schema conversion is a
separate, orthogonal concern).

**Q12.** A security review of a planned DMS migration asks how database
credentials for the source and target endpoints should be managed to
avoid embedding them directly in DMS endpoint configuration. What is
the recommended approach?

A) Hardcode credentials directly in the DMS console configuration
B) Store credentials in AWS Secrets Manager and reference them from the DMS endpoint configuration
C) Email credentials to the DMS administrator for manual entry each time
D) DMS does not support credential management integration; credentials must be stored in plaintext configuration files

**Answer: B.** DMS integrates with Secrets Manager, letting endpoint
configurations reference securely stored, rotatable credentials rather
than embedding plaintext passwords directly in DMS configuration —
consistent with the security best practices tested elsewhere in this
exam (Domain 4). **A**, **C**, and **D** all describe insecure or
nonexistent practices that fail a basic security review.

**Q13.** A scenario describes migrating an Oracle database's stored
procedures and triggers to a PostgreSQL target, and states that some
stored procedures use Oracle-specific PL/SQL features with no direct
PostgreSQL equivalent. What should the team expect from DMS Schema
Conversion in this situation?

A) DMS Schema Conversion will silently drop any unconvertible objects with no notice
B) DMS Schema Conversion will automatically convert everything with no manual intervention ever required
C) DMS Schema Conversion will convert what it can automatically and flag objects it cannot fully convert for manual review and remediation
D) DMS Schema Conversion does not support stored procedures at all, only tables

**Answer: C.** DMS Schema Conversion automates the majority of schema
translation but explicitly flags objects — like Oracle-specific PL/SQL
constructs without a clean PostgreSQL equivalent — that need manual
review and rework, rather than either silently failing or claiming
100% automatic coverage. **A** understates its transparency — it
reports what it can't convert rather than silently dropping it. **B**
overstates its capability for genuinely engine-specific constructs.
**D** is false — it does handle stored procedures, views, and functions,
not just tables, though with varying levels of automatic conversion
success depending on complexity.

**Q14.** Which scenario is the strongest signal to choose AWS DMS over
a scheduled AWS Glue JDBC extraction job?

A) A nightly report needs the previous day's new rows from an RDS table, tolerant of an hour of latency
B) A team needs continuous, near-real-time change capture from a database's transaction log, streamed to a downstream target, with no application code changes
C) A one-time export of a small reference table for a Glue enrichment join
D) A team wants to run ad-hoc SQL queries against data already in S3

**Answer: B.** Continuous, log-based CDC with no application changes is
squarely DMS's purpose-built capability — Glue's JDBC connector reads
via query, not the native transaction log, and isn't designed for this
continuous, low-latency change-capture pattern. **A** is a good fit for
Glue with job bookmarks or a watermark-based incremental extract, not
DMS's CDC machinery. **C** is a simple one-time batch extract, better
suited to a lightweight Glue job than standing up a DMS task. **D** is
an Athena use case, unrelated to database migration/replication
entirely.

**Q15.** A scenario states: "Convert our on-prem SQL Server schema to
be compatible with Amazon Aurora PostgreSQL, including tables, views,
and stored procedures, using an AWS-native, in-service capability
rather than a separately downloaded and installed tool." Which is the
correct current-exam answer?

A) AWS Schema Conversion Tool (SCT), downloaded and run as a standalone desktop application
B) DMS Schema Conversion, built directly into the DMS service/console
C) AWS Glue Studio's visual schema mapper
D) Amazon RDS Schema Advisor

**Answer: B.** As of the December 2025 exam guide revision, standalone
AWS SCT was removed from the DEA-C01 in-scope services list; schema
conversion is tested as **DMS Schema Conversion**, a capability built
into DMS itself, matching the scenario's explicit ask for an
"AWS-native, in-service capability rather than a separately downloaded
tool." **A** describes the now-out-of-scope standalone tool and is a
distractor written to look familiar to candidates using outdated study
material. **C** is not a schema conversion capability. **D** does not
exist as a real AWS service/feature.
