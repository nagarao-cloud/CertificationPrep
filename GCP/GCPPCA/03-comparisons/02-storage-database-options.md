# Comparison: Storage & Database Options

> Selection tree: `00-START-HERE/DECISION-TREES.md` Tree 2. Per-service
> depth: `02-services/02-storage-databases.md`.

## Full comparison matrix

| Dimension | Cloud Storage | Cloud SQL | Cloud Spanner | Bigtable | Firestore | BigQuery | Memorystore |
|---|---|---|---|---|---|---|---|
| Data model | Object/blob | Relational (SQL) | Relational (SQL), global | Wide-column NoSQL | Document NoSQL | Columnar analytics | In-memory KV |
| Consistency | Strong (per-object) | Strong (single region) | External/strong (global) | Strong within a row, eventual across clusters | Strong (native mode) | Strong for completed loads | Not durable — cache only |
| Horizontal write scale | N/A (object store) | Limited (vertical mainly) | Yes, seamless | Yes, throughput-oriented | Yes (managed) | N/A (analytics, not OLTP) | N/A |
| Max practical size | Effectively unlimited | ~64TB-ish ceiling | Petabyte-scale | Petabyte-scale | Large, per-collection limits | Petabyte-scale | RAM-bound (GBs–low TBs) |
| Latency profile | ms–100s of ms (class-dependent) | Single-digit ms (regional) | Single-digit ms (with global consistency cost) | Sub-10ms p99 at scale | Single-digit ms | Seconds (query-based, not point-lookup) | Sub-ms |
| Best access pattern | Sequential/streamed reads/writes | Transactional OLTP | Global OLTP needing strong consistency | High-throughput time-series/wide rows | Mobile/web doc reads + real-time sync | Ad hoc/aggregate analytical queries | Ephemeral cache/session |
| Schema flexibility | N/A | Fixed (relational schema) | Fixed (relational schema, interleaved tables) | Flexible (column families, sparse) | Flexible (documents) | Fixed but easy to alter (columnar) | N/A (KV) |
| Offline/mobile sync | No | No | No | No | Yes (native mode SDKs) | No | No |
| Typical exam-scenario fit | Data lake, backups, static assets | Traditional app DB, moderate scale | Global inventory/ledger needing strong consistency | IoT telemetry (TerramEarth), time-series | Mobile app backend, real-time features | Analytics warehouse, BI, ML feature source | Session store, leaderboard cache (Mountkirk) |

## Tradeoff call-outs

- **Use Cloud SQL when** the workload is a traditional single-region
  relational app within its size/connection ceilings. **Don't use it
  when** the scenario needs global strong consistency or write scale
  beyond a single region's vertical limits — that's Spanner, and
  reaching for Cloud SQL read replicas to fake global consistency is a
  trap (replicas are eventually consistent).
- **Use Spanner when** the scenario explicitly needs both SQL semantics
  *and* global horizontal scale/strong consistency (e.g. a global
  inventory system that must never double-sell an item). **Don't use
  it when** the workload is small/single-region — Spanner's cost
  premium isn't justified without the global-scale requirement (Domain
  1 exam trap).
- **Use Bigtable when** the workload is high-throughput, wide, and
  time-series/IoT-shaped with a well-designed row key. **Don't use it
  when** the access pattern is primarily ad hoc analytical queries —
  that's BigQuery; Bigtable is optimized for known-key lookups and
  range scans, not arbitrary SQL aggregation.
- **Use Firestore when** the client is mobile/web and needs offline
  support or real-time listeners. **Don't use it when** the workload
  is server-side analytical or extremely high-throughput time-series —
  those are BigQuery/Bigtable territory respectively.
- **Use BigQuery when** the access pattern is analytical (aggregate
  over large volumes, ad hoc SQL). **Don't use it when** the workload
  needs low-latency point lookups or transactional writes — BigQuery
  is not an OLTP system and query latency (seconds) doesn't fit a
  user-facing request path.
- **Use Memorystore when** the requirement is sub-millisecond
  cache/session access. **Don't use it when** the data must survive a
  restart/be a system of record — always pair Memorystore with a
  durable backing store.

## "Given this number in the scenario, which tier?" quick reference

```
"~2 million IoT devices reporting telemetry"        → Bigtable (+ Pub/Sub ingest)
"Global leaderboard needing sub-ms reads"            → Memorystore (+ durable backing store)
"Mobile app, needs offline mode"                     → Firestore
"Must never double-sell inventory, global customers" → Spanner
"Traditional CRM, single region, <10TB"              → Cloud SQL
"Petabytes of historical data, ad hoc BI queries"    → BigQuery
"User-uploaded photos/videos"                        → Cloud Storage
```
