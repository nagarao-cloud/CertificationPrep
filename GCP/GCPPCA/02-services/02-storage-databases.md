# Storage & Database Services Reference

> Selection logic: `00-START-HERE/DECISION-TREES.md` Tree 2 and
> `03-comparisons/02-storage-database-options.md`. This file is
> per-service configuration depth.

## Contents

- [Cloud Storage](#cloud-storage)
- [Cloud SQL](#cloud-sql)
- [Cloud Spanner](#cloud-spanner)
- [Bigtable](#bigtable)
- [Firestore](#firestore)
- [BigQuery (storage-relevant surface)](#bigquery-storage-relevant-surface)
- [Memorystore](#memorystore)
- [Filestore](#filestore)
- [Persistent Disk / Hyperdisk](#persistent-disk--hyperdisk)

---

## Cloud Storage

Object storage — unstructured data at any scale, globally unique bucket
namespace.

- **Storage classes**: Standard (frequent access), Nearline (<1/month,
  30-day minimum storage), Coldline (<1/quarter, 90-day minimum),
  Archive (<1/year, 365-day minimum). Early deletion before the minimum
  incurs the remaining minimum-duration charge — relevant to any
  cost-optimization question.
- **Location types**: region (cheapest, lowest latency, single-region
  fault domain), dual-region (two named regions, faster replication
  than multi-region, HA across exactly those two), multi-region
  (broadest redundancy within a continent, highest latency variance).
- **Lifecycle rules**: automated class transitions or deletion based on
  age, storage class, or custom conditions — the mechanism for Domain
  1/4's "data cools off over time" cost optimization.
- **Uniform bucket-level access**: single IAM policy surface per bucket,
  the recommended default over legacy per-object ACLs.
- **Object versioning**: retains prior object versions on overwrite/
  delete — relevant to any "protect against accidental deletion"
  requirement, distinct from a lifecycle rule (which manages *forward*
  aging, not retroactive protection).
- **Signed URLs**: time-limited access without IAM changes — the
  answer for "let an external, unauthenticated user download/upload
  one specific object temporarily."

---

## Cloud SQL

Managed relational database — MySQL, PostgreSQL, SQL Server.

- **HA configuration**: regional — a synchronous standby in a second
  zone within the same region, automatic failover on zone failure.
  Does **not** cover regional failure automatically (see Domain 6
  §6.2) — cross-region DR requires a manually-promoted read replica.
- **Read replicas**: asynchronous, can be cross-region, eventually
  consistent — for read scaling or as a DR base, not for
  strongly-consistent reads.
- **Connection limits**: hard ceiling tied to machine type; use a
  connection pooler (Cloud SQL Auth Proxy, PgBouncer) before scaling
  compute wide enough to exhaust it.
- **Storage ceiling**: up to ~64TB depending on engine/version — a
  scenario describing data beyond this range, or needing global
  horizontal write scale, is a Spanner signal instead.
- **Point-in-time recovery**: via automated backups + write-ahead/
  binary logs — the mechanism for "restore to a specific moment before
  a bad write."

---

## Cloud Spanner

Globally distributed, horizontally scalable relational database with
external (strong) consistency — the only GCP database offering both
SQL semantics and global horizontal write scale.

- **Configurations**: regional (single region, still horizontally
  scalable and HA across zones) or multi-region (automatic HA and
  strong consistency across regions — the Domain 6 Active-Active
  answer).
- **Compute capacity**: measured in nodes or processing units (finer-
  grained than whole nodes) — scaling capacity does not require
  resharding, unlike a traditional sharded relational setup.
- **Interleaved tables / schema design**: co-locating related rows
  physically for join performance — a Spanner-specific schema
  optimization technique worth recognizing by name if a question
  probes Spanner performance tuning.
- **Cost signal**: meaningfully more expensive than Cloud SQL at small
  scale — the exam trap is recommending Spanner for a workload that
  doesn't actually need global strong consistency (see Domain 1 §1.3
  tradeoffs).

---

## Bigtable

Wide-column NoSQL — massive throughput, sub-10ms p99 latency at scale,
time-series/IoT-shaped data.

- **Row-key design is the primary performance lever** — not node count.
  Sequential/monotonic keys (raw timestamps) hotspot; salt, hash, or
  reverse the key to spread load (see the S.A.L.T. mnemonic in
  `00-START-HERE/EXAM-TRAPS-AND-MNEMONICS.md`).
- **Clusters and replication**: a Bigtable instance can have multiple
  clusters (different zones/regions) for read scaling and DR; app
  profiles control routing (single-cluster for strong consistency
  within writes, multi-cluster for lower latency across regions with
  eventual consistency between clusters).
- **Column families**: schema is defined by grouping related columns,
  not a fixed relational schema — designed for sparse, wide data
  (millions of columns is a valid, common Bigtable shape).
- **Common exam scenario cues:** "millions of IoT devices," "time-series
  telemetry," "need sub-10ms reads at massive write throughput" —
  TerramEarth's 2M-device fleet is the canonical case-study fit.

---

## Firestore

Serverless NoSQL document database — native mode is built for mobile/
web apps needing offline sync and real-time listeners.

- **Native mode vs. Datastore mode**: Native mode has mobile/web SDKs,
  real-time sync, and strong consistency by default; Datastore mode is
  the legacy App Engine-era API surface, still available for
  compatibility.
- **Real-time listeners**: clients subscribe to a query and receive
  live updates — the mechanism behind "collaborative app" or
  "live-updating dashboard" scenario requirements without you building
  a custom pub/sub layer for the frontend.
- **Offline persistence**: mobile/web SDKs cache data locally and sync
  on reconnect — the answer for "mobile app needs to keep working with
  spotty connectivity," distinct from Bigtable's server-side
  replication story.
- **Common exam scenario cues:** "mobile app backend," "need offline
  support," "real-time collaborative features."

---

## BigQuery (storage-relevant surface)

Serverless analytics warehouse — separates storage and compute billing;
full analytics-pipeline depth in
`02-services/05-data-analytics-ai.md`, this section covers it purely as
a storage destination.

- **Storage pricing**: active (recently modified) vs. long-term
  (>90 days unmodified, automatically cheaper) — no manual lifecycle
  rule needed, unlike Cloud Storage.
- **Partitioning and clustering**: partition by date/ingestion time to
  limit bytes scanned per query (directly controls cost); cluster
  within partitions on frequently-filtered columns for further pruning
  — the answer whenever a scenario complains about BigQuery query cost
  or performance.
- **External tables / BigLake**: query data that lives in Cloud
  Storage without loading it into BigQuery-managed storage — for data
  lakes that need to stay object-storage-native for other consumers.

---

## Memorystore

Managed in-memory cache — Redis or Memcached — not a system of record.

- **Use case boundary**: sub-millisecond latency for cache/session
  data; always paired with a durable backing store (Cloud SQL,
  Firestore, Bigtable) — a scenario treating Memorystore as the sole
  data store for anything that must survive a restart is a trap.
- **Redis vs. Memcached**: Redis supports richer data structures,
  persistence, and pub/sub; Memcached is simpler, purely ephemeral,
  multi-threaded — Redis is the default correct answer unless a
  scenario specifically wants Memcached's simplicity/multi-threading.

---

## Filestore

Managed NFS file storage — POSIX filesystem semantics for workloads
that need a real mounted filesystem, not object-storage semantics.

- **Common exam scenario cues:** "legacy application expects a shared
  file system," "render farm / HPC workload needing a shared POSIX
  mount across many Compute Engine/GKE nodes."

---

## Persistent Disk / Hyperdisk

Block storage attached to Compute Engine VMs / GKE nodes.

- **Persistent Disk**: zonal (cheapest) or regional (synchronously
  replicated across two zones, for VM-level HA without app-level
  replication) — SSD or HDD/Balanced tiers by IOPS/throughput need.
- **Hyperdisk**: newer generation, independently provisioned capacity/
  IOPS/throughput (decoupled from disk size) — the answer when a
  scenario has an unusual IOPS-to-capacity ratio that a fixed
  Persistent Disk tier can't serve efficiently.
