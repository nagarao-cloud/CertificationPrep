# Comparison: Storage & Database Options

> Selection tree: `00-START-HERE/DECISION-TREES.md` Tree 2. Per-service
> depth: `02-services/02-storage-databases.md`.
>
> **AlloyDB confidence note (per RUNBOOK §1/§7):** AlloyDB for
> PostgreSQL's core mechanism (managed, PostgreSQL-compatible,
> disaggregated storage, a built-in columnar engine for analytical
> queries on transactional data, a downloadable "Omni" variant) is
> stable, publicly documented product positioning — treated as
> reasonable-confidence here. Specific performance-multiplier claims
> (how many times faster than stock PostgreSQL, exact throughput
> numbers) are Google's own marketing framing, not independently
> benchmarked in this repo — presented below as directional
> positioning ("higher performance than Cloud SQL"), not as verified
> figures. Its explicit inclusion in the 2026 exam guide's tested scope
> was identified via this folder's secondary-source gap-remediation
> pass, not confirmed against the primary guide PDF directly (see
> RUNBOOK §1's access-constraint note) — treat "AlloyDB is exam-tested
> by name" as reasonable-confidence, not certain.

## Full comparison matrix

| Dimension | Cloud Storage | Cloud SQL | AlloyDB for PostgreSQL | Cloud Spanner | Bigtable | Firestore | BigQuery | Memorystore |
|---|---|---|---|---|---|---|---|---|
| Data model | Object/blob | Relational (SQL) | Relational (SQL), PostgreSQL-compatible | Relational (SQL), global | Wide-column NoSQL | Document NoSQL | Columnar analytics | In-memory KV |
| Consistency | Strong (per-object) | Strong (single region) | Strong (single-region primary; read pool replicas near-real-time, typically sub-second lag) | External/strong (global) | Strong within a row, eventual across clusters | Strong (native mode) | Strong for completed loads | Not durable — cache only |
| Horizontal write scale | N/A (object store) | Limited (vertical mainly) | Limited (vertical mainly, like Cloud SQL — no Spanner-style write sharding) | Yes, seamless | Yes, throughput-oriented | Yes (managed) | N/A (analytics, not OLTP) | N/A |
| Max practical size | Effectively unlimited | ~64TB-ish ceiling | Large multi-TB range; disaggregated storage scales independently of compute (exact ceiling not independently verified here — MEDIUM confidence, higher headroom than Cloud SQL in practice) | Petabyte-scale | Petabyte-scale | Large, per-collection limits | Petabyte-scale | RAM-bound (GBs–low TBs) |
| Latency profile | ms–100s of ms (class-dependent) | Single-digit ms (regional) | Single-digit ms for OLTP; built-in columnar engine claims markedly faster analytical/aggregate queries on live transactional data than stock PostgreSQL (vendor-stated, directional only) | Single-digit ms (with global consistency cost) | Sub-10ms p99 at scale | Single-digit ms | Seconds (query-based, not point-lookup) | Sub-ms |
| Best access pattern | Sequential/streamed reads/writes | Transactional OLTP | Hybrid transactional + real-time analytical (HTAP) on PostgreSQL-compatible workloads | Global OLTP needing strong consistency | High-throughput time-series/wide rows | Mobile/web doc reads + real-time sync | Ad hoc/aggregate analytical queries | Ephemeral cache/session |
| Schema flexibility | N/A | Fixed (relational schema) | Fixed (relational schema, PostgreSQL extensions ecosystem) | Fixed (relational schema, interleaved tables) | Flexible (column families, sparse) | Flexible (documents) | Fixed but easy to alter (columnar) | N/A (KV) |
| Offline/mobile sync | No | No | No | No | No | Yes (native mode SDKs) | No | No |
| Engine/version compatibility | N/A | MySQL, PostgreSQL, SQL Server (pick one per instance) | PostgreSQL wire-compatible — existing PostgreSQL drivers/tools/ORMs work largely unmodified | Google-proprietary SQL dialect (GoogleSQL/Spanner SQL) with PostgreSQL-interface option available | N/A (wide-column API, HBase-compatible surface) | N/A (document API) | Google-proprietary SQL (standard SQL), BigQuery-specific | N/A (Redis/Memcached protocol) |
| Cost-model shape | Per-GB stored + class + egress + operations | Per-instance (vCPU/RAM) + storage + egress | Per-instance (vCPU/RAM) + storage, generally priced at a premium over equivalent Cloud SQL sizing | Per-node/processing-unit + storage, premium pricing at any scale | Per-node + storage, cost scales with provisioned throughput | Per-operation (read/write/delete) + storage | Per-TB-scanned (on-demand) or per-slot (capacity/flat-rate) + storage | Per-instance (memory tier + replica count) |
| Monitoring/observability integration | Cloud Monitoring bucket metrics (requests, egress); Cloud Audit Logs for access | Cloud SQL Insights (query-level performance), Cloud Monitoring instance metrics | AlloyDB-specific Insights/observability surface (query-level, similar spirit to Cloud SQL Insights) plus Cloud Monitoring | Cloud Monitoring + built-in Spanner query statistics/introspection tables | Cloud Monitoring (CPU utilization, throughput per cluster — the primary hotspot-detection signal) | Cloud Monitoring + Firestore-specific usage dashboards | Cloud Monitoring + BigQuery INFORMATION_SCHEMA/job statistics for cost/performance tuning | Cloud Monitoring (memory usage, evictions, connected clients) |
| IAM/security integration specifics | IAM at bucket/object level, signed URLs, uniform bucket-level access | IAM at instance level; DB-level auth is separate (native DB users) unless IAM DB Authentication is enabled | Same IAM/DB-auth split pattern as Cloud SQL; PostgreSQL-native roles for fine-grained in-DB permissions | IAM at instance/database level; fine-grained roles down to table/column in some configurations | IAM at instance/table level via App Profiles and table ACL-like patterns | IAM at project/database level; Firestore Security Rules for client-side (mobile/web SDK) access control — distinct from server-side IAM | IAM at dataset/table/column/row level (column-level security, row-level security policies) | IAM at instance level; AUTH/ACL configured within Redis itself for finer control |
| HA mechanism | Multi-region/dual-region storage classes (built-in) | Regional HA: synchronous standby in a second zone, automatic failover | Regional HA: similar synchronous-standby-and-failover model to Cloud SQL | Multi-region configuration: synchronous replication and automatic failover across regions (native, not bolted on) | Multi-cluster replication across zones/regions (app-profile-routed) | Automatically multi-zone within native mode | N/A (serverless, Google manages underlying redundancy) | Standard/HA tier with automatic failover replica |
| DR / cross-region mechanism | Turn on multi-region bucket, or replicate via Storage Transfer Service | Cross-region read replica, manually promoted | Cross-region read pool / replica, promotion process similar in spirit to Cloud SQL (verify current cross-region DR tooling maturity against Cloud SQL's — newer service, less field-tested at time of writing) | Native to multi-region configuration — no separate DR promotion step needed | Cross-region cluster replication via app profiles | Native mode is regional; cross-region DR requires export/import or Firestore's own replication options depending on configuration | Cross-region dataset copy (batch, not continuous replication) | No native cross-region DR — rebuild from a durable backing store |
| Typical failure mode | Hot object/prefix contention at extreme request rates (mitigated by request distribution) | Connection exhaustion (fixed ceiling tied to machine type); storage-ceiling approach | Same connection-exhaustion class of issue as Cloud SQL; premium pricing surprising teams who provisioned like Cloud SQL | Hotspotting from poor primary-key choice (monotonic keys); underestimating node/processing-unit needs for write-heavy load | Row-key hotspotting from sequential/monotonic keys (the #1 Bigtable failure mode) | "Hot document" contention on a single frequently-written document; unbounded collection growth costs | Runaway query cost from unpartitioned/unclustered full-table scans | Eviction under memory pressure if sized without headroom; data loss on restart if used as sole store |
| Migration/adoption friction | Low (upload/copy) | Low if already relational; moderate cross-engine migration (e.g. Oracle → Cloud SQL Postgres) | Low for existing PostgreSQL workloads (wire-compatible) — often framed as a Cloud SQL-for-PostgreSQL "upgrade path" with minimal app changes | High — requires schema redesign around Spanner's interleaving/key-distribution model, and a SQL-dialect adjustment | High — requires row-key design work, no direct relational-to-wide-column auto-mapping | Medium — document modeling differs from relational; client SDK adoption for offline/real-time features | Low for read/analytics workloads; moderate for teams new to partitioning/clustering cost discipline | Low (drop-in cache layer), but requires app-side cache-aside logic if not already present |
| Portability / lock-in | Low (S3-compatible-ish access patterns exist, but bucket semantics are still GCP-flavored) | Low — standard MySQL/PostgreSQL/SQL Server underneath | Lowest among the managed-relational tier for PostgreSQL workloads specifically — wire-compatible, **and AlloyDB Omni offers a downloadable, self-managed variant runnable outside GCP** (on-prem, other clouds) for portability-sensitive scenarios | Highest lock-in of the relational tier — Spanner's global-scale mechanism has no equivalent to lift-and-shift elsewhere | Medium — HBase-compatible API eases some portability | High — Firestore's API/model is GCP-specific | High — BigQuery SQL dialect and storage format are GCP-specific | Low — standard Redis/Memcached protocol |
| Typical exam-scenario fit | Data lake, backups, static assets | Traditional app DB, moderate scale | PostgreSQL app needing live analytics on transactional data without a separate ETL/warehouse pipeline; "we want more performance than Cloud SQL but don't need Spanner's global scale" | Global inventory/ledger needing strong consistency | IoT telemetry (TerramEarth), time-series | Mobile app backend, real-time features | Analytics warehouse, BI, ML feature source | Session store, leaderboard cache (Mountkirk) |

## Tradeoff call-outs

- **Use Cloud SQL when** the workload is a traditional single-region
  relational app within its size/connection ceilings and doesn't need
  heavy in-place analytics. **Don't use it when** the scenario needs
  global strong consistency or write scale beyond a single region's
  vertical limits — that's Spanner, and reaching for Cloud SQL read
  replicas to fake global consistency is a trap (replicas are
  eventually consistent). **Edge case:** a scenario that only needs
  *occasional* reporting queries against a Cloud SQL instance (not
  continuous, not latency-sensitive) doesn't automatically justify
  AlloyDB or a separate warehouse — Cloud SQL with a read replica
  dedicated to reporting traffic can be sufficient if the analytical
  need is modest and infrequent.
- **Use AlloyDB for PostgreSQL when** the workload is PostgreSQL-based
  (or greenfield and PostgreSQL is an acceptable choice) and the
  scenario explicitly wants real-time or near-real-time analytics over
  live transactional data **without standing up a separate ETL pipeline
  into BigQuery** — the built-in columnar/HTAP engine is the specific
  capability that answers that requirement. Also reach for it when a
  scenario says "we outgrew Cloud SQL's performance for PostgreSQL but
  don't need Spanner's global horizontal write scale." **Don't use it
  when** the workload needs a different engine entirely (MySQL, SQL
  Server — AlloyDB is PostgreSQL-only) or needs Spanner's multi-region
  synchronous write consistency — AlloyDB's HA model is stronger than
  Cloud SQL's but is not a substitute for Spanner's global scale
  story. **Don't default to it reflexively for every PostgreSQL
  workload** either — its cost premium over Cloud SQL for PostgreSQL
  isn't justified when the workload is small, has no analytical
  component, and Cloud SQL's ceiling comfortably covers it; that's the
  same "don't over-provision beyond the stated requirement" pattern the
  exam applies to Spanner. **Portability edge case:** a scenario
  needing the *same* database engine both on-prem and in GCP, or across
  multiple clouds, should consider **AlloyDB Omni** specifically
  (the downloadable/self-managed variant) rather than assuming the
  fully-managed AlloyDB service — a subtlety the exam could test by
  naming a hybrid/multi-cloud portability requirement alongside a
  PostgreSQL-analytics one.
- **Use Spanner when** the scenario explicitly needs both SQL semantics
  *and* global horizontal scale/strong consistency (e.g. a global
  inventory system that must never double-sell an item). **Don't use
  it when** the workload is small/single-region — Spanner's cost
  premium isn't justified without the global-scale requirement (Domain
  1 exam trap). **Near-miss trap vs. AlloyDB:** both are "premium,
  high-performance, SQL-flavored, more expensive than Cloud SQL" —
  the deciding signal is whether the requirement is *analytical
  performance on transactional data in one region* (AlloyDB) or
  *global, multi-region, horizontally-scalable strong consistency*
  (Spanner). A scenario mentioning "real-time dashboards on live order
  data" is AlloyDB-shaped; a scenario mentioning "customers in the US,
  EU, and APAC all writing to the same inventory count with zero
  double-sell risk" is Spanner-shaped.
- **Use Bigtable when** the workload is high-throughput, wide, and
  time-series/IoT-shaped with a well-designed row key. **Don't use it
  when** the access pattern is primarily ad hoc analytical queries —
  that's BigQuery; Bigtable is optimized for known-key lookups and
  range scans, not arbitrary SQL aggregation. **Edge case:** a scenario
  combining IoT-scale ingestion *and* a need for SQL-style aggregate
  querying is often a two-service pattern (Bigtable for the raw
  high-throughput store, exported/federated into BigQuery for
  analytics), not a single-service answer — don't force one service to
  cover both access patterns if the scenario states both explicitly.
- **Use Firestore when** the client is mobile/web and needs offline
  support or real-time listeners. **Don't use it when** the workload
  is server-side analytical or extremely high-throughput time-series —
  those are BigQuery/Bigtable territory respectively.
- **Use BigQuery when** the access pattern is analytical (aggregate
  over large volumes, ad hoc SQL). **Don't use it when** the workload
  needs low-latency point lookups or transactional writes — BigQuery
  is not an OLTP system and query latency (seconds) doesn't fit a
  user-facing request path. **Near-miss trap vs. AlloyDB:** a scenario
  saying "analytics" doesn't automatically mean BigQuery — if the
  analytics must run *against live transactional data with minimal
  staleness and without a separate pipeline*, that's the AlloyDB HTAP
  signal; if the analytics are batch/periodic over large historical
  volumes with tolerance for pipeline latency, that's BigQuery.
- **Use Memorystore when** the requirement is sub-millisecond
  cache/session access. **Don't use it when** the data must survive a
  restart/be a system of record — always pair Memorystore with a
  durable backing store.

## Near-miss traps summary (side-by-side pairs the exam expects you to separate)

| Pair | What makes them look similar | The actual deciding signal |
|---|---|---|
| AlloyDB vs. Cloud Spanner | Both "premium," both SQL, both pitched as "better than Cloud SQL" | Analytics-on-live-transactional-data, single-region-acceptable → AlloyDB. Global multi-region strong consistency → Spanner |
| AlloyDB vs. Cloud SQL for PostgreSQL | Both PostgreSQL-compatible, both managed, migration between them is easy | No stated analytical/HTAP requirement and cost-sensitive → Cloud SQL. Explicit "analytics on live data, no separate pipeline" requirement → AlloyDB |
| AlloyDB vs. BigQuery | Both can answer "give me aggregates over this data" | Query must reflect the *current* transactional state with minimal lag and stay in the OLTP system → AlloyDB. Query is over large historical volumes, batch-tolerant, dedicated warehouse → BigQuery |
| Bigtable vs. BigQuery | Both "petabyte-scale," both GCP's answer to "huge data" | Known-key lookups/range scans, high write throughput, time-series → Bigtable. Ad hoc SQL aggregation, BI tooling, unpredictable query shapes → BigQuery |
| Firestore vs. Bigtable | Both NoSQL, both "flexible schema" | Mobile/web client, offline sync, real-time listeners → Firestore. Server-side, massive throughput, time-series/IoT → Bigtable |
| Cloud SQL read replica vs. Spanner | Both offer "reads scaled out across more capacity" | Read replica is eventually consistent — fine for read scaling, wrong for "must reflect the latest write globally, right now" → that requirement needs Spanner, not a replica |
| Memorystore vs. Firestore for "real-time" | Both can serve data with very low latency | Requirement is ephemeral, cache-shaped, tolerant of data loss → Memorystore. Requirement is durable, needs offline sync/real-time listeners on a client SDK → Firestore |

## "Given this number in the scenario, which tier?" quick reference

```
"~2 million IoT devices reporting telemetry"          → Bigtable (+ Pub/Sub ingest)
"Global leaderboard needing sub-ms reads"              → Memorystore (+ durable backing store)
"Mobile app, needs offline mode"                       → Firestore
"Must never double-sell inventory, global customers"   → Spanner
"Traditional CRM, single region, <10TB"                → Cloud SQL
"PostgreSQL app needs analytics on live transactional
 data without a separate ETL pipeline"                 → AlloyDB for PostgreSQL
"Outgrew Cloud SQL's PostgreSQL performance, still
 single-region, no need for global write scale"        → AlloyDB for PostgreSQL
"Same PostgreSQL database needed on-prem AND in GCP"    → AlloyDB Omni
"Petabytes of historical data, ad hoc BI queries"       → BigQuery
"User-uploaded photos/videos"                           → Cloud Storage
"Legacy app expects a mounted NFS filesystem"           → Filestore (see 02-services/02-storage-databases.md)
"Attach durable block storage to a Compute Engine VM"   → Persistent Disk / Hyperdisk
```

## Cost-model summary (relative positioning, not absolute pricing)

```
Cheapest, scales with usage             Cloud Storage, BigQuery on-demand, Firestore (per-op)
                    │
Moderate, instance-sized                Cloud SQL, Memorystore
                    │
Premium over Cloud SQL, same shape      AlloyDB for PostgreSQL (buys HTAP + higher OLTP ceiling)
                    │
Premium at any scale                    Cloud Spanner (buys global horizontal strong consistency)
                    │
Scales with provisioned throughput      Bigtable (node count sized to sustained load, not data volume alone)
```

**Cost-reasoning trap:** a scenario that only mentions "we want better
performance" without a specific driver (global scale? live analytics?
raw OLTP throughput?) should not be answered by defaulting to the most
expensive-sounding option. Match the specific capability named in the
scenario to the specific service that provides *that* capability —
Spanner for global consistency, AlloyDB for in-place analytics on OLTP
data, plain Cloud SQL vertical/read-replica scaling for "just handle
more traffic in one region."

## Replication/failover topology at a glance

```
Cloud SQL (regional HA)
  Primary (zone A) ──sync──> Standby (zone B)     [automatic failover]
  Primary ──async──> Read replica (any region)    [manual promotion for DR]

AlloyDB for PostgreSQL
  Primary (zone A) ──sync──> Standby (zone B)     [automatic failover, same shape as Cloud SQL]
  Primary ──near-real-time──> Read pool instances [horizontal read scaling, not just DR]

Cloud Spanner (multi-region config)
  Primary region ──sync, quorum-based──> 2+ other regions
  [no separate "promotion" step — the multi-region config IS the DR mechanism]

Bigtable (multi-cluster)
  Cluster A (zone/region 1) ──async replication──> Cluster B (zone/region 2)
  [app profile routes reads/writes; single-cluster = strong consistency,
   multi-cluster = lower latency globally, eventual consistency between clusters]
```

The exam-relevant takeaway: Cloud SQL and AlloyDB share the same
regional-HA-plus-manual-DR-promotion shape (AlloyDB's read pool adds
horizontal *read* scaling on top, which Cloud SQL's read replicas also
technically provide, but AlloyDB's are positioned as lower-lag).
Spanner's multi-region configuration folds HA and DR into a single
mechanism — there's no separate promotion workflow to design or test,
which is itself an exam-relevant differentiator when a scenario asks
"which option needs the least DR-runbook complexity."

## Backup and point-in-time recovery mechanics

| Service | Backup mechanism | Point-in-time recovery | Retention control |
|---|---|---|---|
| Cloud Storage | Object versioning (not a "backup" in the traditional sense) + optional export | Restore a prior object version | Lifecycle-rule driven |
| Cloud SQL | Automated daily backups + write-ahead/binary logs | Yes — to any point within the log-retention window | Configurable retention window |
| AlloyDB for PostgreSQL | Automated backups, continuous log-based recovery (same conceptual model as Cloud SQL, PostgreSQL-native under the hood) | Yes — to any point within the retention window | Configurable retention window |
| Cloud Spanner | Managed backups (full, scheduled) + point-in-time recovery via a bounded recent-history window | Yes, within a shorter recent-history window than a traditional log-based restore | Backup-schedule driven |
| Bigtable | Managed backups per table | No continuous PITR — table-level backup/restore, not arbitrary-timestamp recovery | Manual/scheduled backup cadence |
| Firestore | Managed export/import to Cloud Storage; point-in-time recovery available for native mode within a bounded window | Bounded recent window | Configurable, shorter horizon than relational options |
| BigQuery | Table snapshots; time travel (query data as of a recent past timestamp, default ~7 days) | Yes, within the time-travel window | Time-travel window is configurable up to a ceiling |
| Memorystore | RDB/AOF-style persistence options (Redis), but explicitly not a backup strategy for data-of-record | N/A — not designed as a system of record | N/A |

## Worked scenario walkthroughs

**Scenario A — Mountkirk Games, real-time leaderboard.** "Global
leaderboard must reflect a player's new score within milliseconds of
submission; losing the leaderboard on a cache restart is acceptable
since the score itself is durably recorded elsewhere." Reasoning: the
"acceptable to lose on restart" clause is the explicit signal that this
is a cache-shaped requirement, not a system-of-record one —
**Memorystore** in front of whatever durable store holds the
authoritative score record (Cloud SQL or Firestore, depending on the
rest of the game backend's shape). A common trap here is reaching for
Bigtable's low latency instead — Bigtable is durable and provisioned
for throughput, which is more infrastructure than a pure ephemeral
cache/read-path problem needs.

**Scenario B — EHR Healthcare, live clinical dashboards.** "Clinicians
need a dashboard showing aggregate patient-flow metrics computed from
the live transactional EHR database, refreshed within seconds, without
standing up a separate analytics pipeline the compliance team would
need to separately certify." Reasoning: "without standing up a separate
pipeline" plus "compliance team would need to separately certify" is
the AlloyDB signal specifically — a second BigQuery pipeline would add
both latency (batch/streaming ETL lag) and a second system requiring
its own compliance review. If the existing database is already
PostgreSQL, **AlloyDB for PostgreSQL** answers the requirement in place
with its built-in HTAP capability; if the existing engine is something
AlloyDB doesn't support, the honest answer is that this specific
capability requires either a migration to a PostgreSQL-compatible
engine or accepting a separate analytics pipeline after all — the exam
expects you to recognize the engine constraint, not paper over it.

**Scenario C — TerramEarth, predictive maintenance analytics.**
"Telemetry from ~2 million vehicles is ingested continuously; a
separate data science team runs large, ad hoc SQL queries against
months of historical telemetry to train predictive-maintenance models,
tolerant of query latency in the seconds-to-minutes range." Reasoning:
"months of historical data" plus "ad hoc SQL" plus "tolerant of
latency" is squarely **BigQuery** territory, fed by **Bigtable** (or a
Pub/Sub → Dataflow → BigQuery pipeline) as the ingestion/raw-store
layer — the two-service pattern flagged in the Bigtable tradeoff
call-out above. A trap here is proposing AlloyDB for the analytics
because "it does analytics too" — AlloyDB's HTAP strength is *live,
low-latency* analytics on the current transactional state, not
petabyte-scale historical ad hoc BI, which is BigQuery's specific
strength.

**Scenario D — Helicopter Racing League, real-time race telemetry +
instant commentary stats.** "Live race telemetry must be queryable for
on-air statistics (current lap times, position deltas) within
sub-second latency during the broadcast, alongside a durable historical
archive for post-race analysis." Reasoning: this is a split-requirement
scenario — the sub-second, in-race-window query need points to
Bigtable (high-throughput, low-latency, time-series-shaped) or
Memorystore for the hottest live-stat layer, while the durable
post-race archive with ad hoc analysis is BigQuery. A scenario like
this is testing whether you'll try to force one database to serve both
the hot low-latency path and the cold analytical path, versus
recognizing that GCP's storage/database story is frequently a
*pipeline* of purpose-built services rather than one database doing
everything.
