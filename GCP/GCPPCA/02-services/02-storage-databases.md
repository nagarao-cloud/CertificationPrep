# Storage & Database Services Reference

> Selection logic: `00-START-HERE/DECISION-TREES.md` Tree 2 and
> `03-comparisons/02-storage-database-options.md`. This file is
> per-service configuration depth. Every service below follows the
> same checklist: purpose, when to use, when **not** to use (paired
> with the alternative that wins instead), configuration surface,
> cost, performance, scaling, security, HA/failure behavior, common
> mistakes, and exam scenario cues.

## Contents

- [Cloud Storage](#cloud-storage)
- [Cloud SQL](#cloud-sql)
- [AlloyDB for PostgreSQL](#alloydb-for-postgresql)
- [Cloud Spanner](#cloud-spanner)
- [Bigtable](#bigtable)
- [Firestore](#firestore)
- [BigQuery (storage-relevant surface)](#bigquery-storage-relevant-surface)
- [Memorystore](#memorystore)
- [Filestore](#filestore)
- [Persistent Disk / Hyperdisk](#persistent-disk--hyperdisk)

---

## Cloud Storage

**Purpose:** object storage — unstructured data at any scale, globally
unique bucket namespace.

**When to use:**
- Any unstructured data (images, video, backups, logs, ML training
  data, static web assets) that doesn't need filesystem or relational
  semantics.
- A data lake landing zone that other services (BigQuery external
  tables/BigLake, Dataflow, Vertex AI training) read directly.
- Long-term archival with predictable, infrequent access patterns.

**When NOT to use — use something else instead:**
- An application needs POSIX filesystem semantics (mounted paths,
  file locking, directory operations a legacy app expects) →
  **Filestore** — object storage's flat namespace and eventual
  metadata consistency don't behave like a real filesystem.
- Data needs to be queried with SQL joins/transactions → **Cloud SQL,
  AlloyDB, or Spanner** — Cloud Storage has no query engine of its
  own (BigQuery/BigLake can query *over* it, but the canonical
  transactional copy still belongs in a database).
- Sub-millisecond read latency for small, frequently-changing values
  → **Memorystore** — object storage's latency profile is built for
  large objects at scale, not cache-shaped access patterns.

**Key configuration surface:**
- **Storage classes**: Standard (frequent access), Nearline (<1/month,
  30-day minimum storage), Coldline (<1/quarter, 90-day minimum),
  Archive (<1/year, 365-day minimum). Early deletion before the
  minimum incurs the remaining minimum-duration charge — relevant to
  any cost-optimization question.
- **Location types**: region (cheapest, lowest latency, single-region
  fault domain), dual-region (two named regions, faster replication
  than multi-region, HA across exactly those two), multi-region
  (broadest redundancy within a continent, highest latency variance).
- **Lifecycle rules**: automated class transitions or deletion based
  on age, storage class, or custom conditions — the mechanism for
  Domain 1/4's "data cools off over time" cost optimization.
- **Uniform bucket-level access**: single IAM policy surface per
  bucket, the recommended default over legacy per-object ACLs.
- **Object versioning**: retains prior object versions on overwrite/
  delete — relevant to any "protect against accidental deletion"
  requirement, distinct from a lifecycle rule (which manages
  *forward* aging, not retroactive protection).
- **Signed URLs**: time-limited access without IAM changes — the
  answer for "let an external, unauthenticated user download/upload
  one specific object temporarily."
- **Retention policies / Bucket Lock**: immutable, write-once
  retention enforced at the bucket level — the compliance answer
  whenever a scenario needs provably tamper-proof retention (audit
  logs, regulatory records), stronger than a lifecycle rule alone.

**Pricing / cost considerations:**
- Storage class is the dominant cost lever for data at rest; retrieval
  and early-deletion fees on Nearline/Coldline/Archive can eat the
  storage savings if access patterns are misjudged — a scenario
  describing frequent, unplanned reads of "archived" data is testing
  this trap.
- Network egress (especially cross-region or to the internet) is
  billed separately and can dominate total cost for high-traffic
  buckets — co-locating consumers (BigQuery, Compute Engine, GKE) in
  the same region avoids it.
- Class A operations (writes/lists) cost more than Class B
  (reads) — high-frequency small-object write patterns should factor
  this in.

**Performance characteristics:**
- Strong read-after-write consistency for both object reads and bucket
  listing — no eventual-consistency caveat to design around, unlike
  some other clouds' object stores.
- Throughput scales with request distribution across the keyspace —
  a hot prefix (many objects share the same leading path segment)
  can throttle under very high request rates; a well-distributed
  naming scheme avoids this.

**Scaling behavior:**
- Effectively unlimited storage capacity and automatic scaling of
  request throughput as long as the namespace/request pattern is well
  distributed — no capacity to pre-provision, unlike block/file
  storage.

**Security posture:**
- IAM at the bucket (and optionally, with legacy ACLs, object) level;
  uniform bucket-level access is the recommended default to keep the
  policy surface auditable.
- CMEK support for customer-managed encryption keys; Cloud Storage
  encrypts at rest by default even without CMEK.
- VPC Service Controls can wrap Cloud Storage in a perimeter to block
  exfiltration via valid-but-external credentials (see
  `04-security-iam.md`).

**HA / failure-mode behavior:**
- Multi-region and dual-region buckets provide built-in redundancy
  across the chosen locations without application-level replication
  logic; regional buckets carry single-region fault-domain risk by
  design (traded for lower latency/cost).
- Object versioning plus a retention policy together cover both
  "recover from accidental overwrite/delete" and "prove data wasn't
  tampered with," which are two different failure modes a scenario
  might test separately.

**Common mistakes / misconfigurations:**
- Choosing Archive/Coldline for data that turns out to be accessed
  regularly, incurring repeated early-access/retrieval fees.
- Relying on a lifecycle rule alone when the actual requirement is
  tamper-proof retention (needs Bucket Lock, not just a lifecycle
  transition).
- Leaving legacy ACLs enabled instead of uniform bucket-level access,
  fragmenting the audit surface.
- Using a monotonically-increasing object name prefix (e.g. a
  timestamp) for extremely high-throughput write workloads, creating
  a request hotspot.

**Common exam scenario cues:** "unstructured data at scale," "data
lake landing zone," "static asset hosting with CDN," "cold archival
with compliance-grade retention," "temporary external access to one
object without an IAM change."

---

## Cloud SQL

**Purpose:** managed relational database — MySQL, PostgreSQL, SQL
Server. The default "just need a regular relational database, minimal
operational overhead" answer.

**When to use:**
- Traditional relational/transactional workloads at small-to-
  moderate scale (up to Cloud SQL's storage/connection ceiling) that
  don't need global horizontal write scale.
- Existing applications already built against MySQL/PostgreSQL/SQL
  Server wire protocols with no appetite for a data-layer rewrite.
- A scenario emphasizing "minimize database administration" over
  "maximum possible performance ceiling."

**When NOT to use — use something else instead:**
- The workload needs global, horizontally-scalable strong consistency
  (multi-region active-active with strict transactional guarantees) →
  **Cloud Spanner** — Cloud SQL's HA model doesn't extend to
  automatic multi-region write scale.
- The workload is PostgreSQL-compatible but needs materially higher
  transactional throughput or built-in real-time analytics over
  operational data → **AlloyDB for PostgreSQL** — same wire protocol,
  higher performance ceiling, before reaching for Spanner's much
  larger architecture change.
- Data volume will exceed Cloud SQL's practical storage ceiling
  (~64TB depending on engine/version), or the schema doesn't need to
  be relational at all → **Spanner** (still relational, but scales
  further) or a NoSQL option (**Bigtable**/**Firestore**) if the
  access pattern doesn't need SQL joins/transactions.

**Key configuration surface:**
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
  binary logs — the mechanism for "restore to a specific moment
  before a bad write."
- **Private IP / Cloud SQL Auth Proxy**: the standard secure
  connectivity patterns — private IP keeps traffic on the VPC, the
  Auth Proxy adds IAM-based authorization and encryption without
  managing certificates by hand.

**Pricing / cost considerations:**
- Billed for provisioned machine type + storage, independent of
  actual query load — an oversized instance for a light workload is
  pure waste, the Domain 4 rightsizing target (Recommender API
  surfaces this).
- Read replicas and HA standbys each add their own compute/storage
  cost — cheaper than Spanner at small scale, but the gap narrows as
  replica count grows.
- Storage auto-grows by default; without a cap, a runaway write
  pattern (e.g. unbounded logging into the primary DB) can silently
  inflate storage cost.

**Performance characteristics:**
- Vertical scaling (bigger machine type) is the primary performance
  lever for write throughput; read replicas scale read throughput
  horizontally but add replication lag.
- Connection-per-process client patterns (e.g. many serverless
  function/Cloud Run instances each opening connections) can exhaust
  the connection ceiling well before compute is saturated — the
  direct motivation for connection pooling.

**Scaling behavior:**
- Scale-up (larger machine type, more storage) requires a brief
  maintenance operation, not a live resize; there's no automatic
  horizontal write-scaling — that's the fundamental ceiling that
  pushes a workload toward Spanner or AlloyDB as it grows.

**Security posture:**
- IAM database authentication, CMEK for at-rest encryption, private
  IP by default recommended over public IP, VPC-SC support for
  perimeter-based access control.
- SSL/TLS enforced for connections; the Cloud SQL Auth Proxy avoids
  managing client certificates manually.

**HA / failure-mode behavior:**
- Regional HA (synchronous standby) fails over automatically within
  the region on a zone outage — application-transparent, brief
  connection interruption during failover.
- A full regional outage is **not** covered by HA alone — requires a
  cross-region read replica promoted manually (or via a documented
  runbook) to become the new primary, which is a Domain 6 DR
  exercise, not an automatic behavior.
- Automated backups plus binary/write-ahead logs enable point-in-time
  recovery for logical failures (bad migration, accidental delete)
  distinct from the HA/DR story for infrastructure failures.

**Common mistakes / misconfigurations:**
- Assuming regional HA covers a full-region disaster — it doesn't; a
  scenario testing DR readiness across regions is testing whether you
  add a cross-region replica and a promotion runbook.
- Not using a connection pooler with a high-fan-out serverless client
  tier, exhausting the connection ceiling under normal traffic.
- Treating asynchronous read replicas as strongly consistent for
  read-after-write-sensitive logic.
- Leaving public IP enabled with broad authorized networks instead of
  private IP + Cloud SQL Auth Proxy/IAM auth.

**Common exam scenario cues:** "standard relational database,"
"minimize DB administration," "existing MySQL/PostgreSQL/SQL Server
application," data volume and consistency needs staying within a
single-region-class workload.

---

## AlloyDB for PostgreSQL

> **Confidence note:** current and architect-relevant per RUNBOOK §6/§7
> — added in the 2026-08-10 depth-remediation pass after being
> entirely absent from this folder's first generation. Facts below are
> the standard, stable AlloyDB positioning (PostgreSQL-compatible,
> higher-performance managed database with a built-in analytics
> accelerator) — treat as HIGH confidence on the positioning/shape,
> and verify current specific throughput/pricing numbers against
> `cloud.google.com` before quoting them precisely in a live setting.

**Purpose:** a fully managed, PostgreSQL-compatible database
engineered by Google for significantly higher transactional
performance than stock PostgreSQL/Cloud SQL, with a built-in columnar
engine that accelerates analytical queries against the same live
operational data — a hybrid transactional/analytical processing
(HTAP) answer without standing up a separate analytics pipeline.

**Where it sits between its two neighbors:**

| | Cloud SQL for PostgreSQL | **AlloyDB for PostgreSQL** | Cloud Spanner |
|---|---|---|---|
| Wire compatibility | PostgreSQL | PostgreSQL (higher compatibility fidelity, extensions supported) | Not PostgreSQL-wire-compatible (own SQL dialect with PostgreSQL-interface option) |
| Scale model | Vertical, single-region | Vertical + read pool scaling, **single-region-native** | Horizontal, global, multi-region |
| Consistency | Regional HA (sync standby) | Regional HA (sync standby across zones) | Global strong (external) consistency |
| Analytical query performance on live operational data | Requires ETL to a warehouse | **Built-in columnar engine accelerates analytics in place** | Not its strength — pair with BigQuery federation |
| Cost at small scale | Lowest | Higher than Cloud SQL, lower than Spanner at equivalent scale | Highest |
| When it wins | Simple relational needs, tightest budget | PostgreSQL app needing much higher throughput or HTAP, still fits in one region | True global multi-region write scale is the actual requirement |

**When to use:**
- An existing or new PostgreSQL-compatible application that has
  outgrown Cloud SQL's performance ceiling (write throughput, query
  latency under load) but doesn't need Spanner's global multi-region
  write scale.
- A workload that wants to run analytical queries (dashboards,
  reporting) directly against live transactional data without
  building a separate ETL-to-warehouse pipeline — AlloyDB's columnar
  engine is purpose-built for this HTAP pattern.
- A migration off self-managed PostgreSQL where the team wants to
  keep full PostgreSQL compatibility (extensions, tooling, drivers)
  while gaining a materially higher performance ceiling than Cloud
  SQL offers.

**When NOT to use — use something else instead:**
- The workload needs true global, multi-region active-active write
  scale with strong consistency across regions → **Cloud Spanner** —
  AlloyDB is still architected around a single primary region (with
  read pools, not multi-region write scale); this is the single most
  important tradeoff to state explicitly on the exam.
- The workload is small, simple, and cost-sensitive with no
  performance pressure → **Cloud SQL** — AlloyDB's performance
  ceiling isn't needed, and Cloud SQL is the cheaper, simpler managed
  Postgres option.
- The workload isn't relational at all (wide-column time-series,
  document-shaped, pure key-value) → **Bigtable/Firestore** — AlloyDB
  is still a relational engine; a non-relational access pattern
  doesn't benefit from its analytics acceleration.
- Heavy, large-scale batch analytics across historical data (not
  "live operational data") → **BigQuery** — AlloyDB's columnar engine
  accelerates analytics *on the operational dataset in place*; it is
  not a replacement for a dedicated data warehouse at BigQuery's
  scale.

**Key configuration surface:**
- **Primary instance + read pool instances**: the primary handles
  writes; read pool instances scale read throughput horizontally
  within the region (not a substitute for Spanner's multi-region
  write scaling).
- **Columnar engine**: an in-memory columnar representation of hot
  table data, automatically maintained alongside the row-oriented
  store, accelerating analytical (aggregate/scan-heavy) queries
  without a separate ETL step or warehouse.
- **PostgreSQL compatibility**: supports standard PostgreSQL
  extensions and wire protocol — existing PostgreSQL drivers, ORMs,
  and tooling work largely unmodified, easing migration.
- **Automated backups and point-in-time recovery**: same operational
  shape as Cloud SQL's backup story, adapted to AlloyDB's storage
  engine.
- **Integration with Vertex AI**: supports in-database ML inference
  patterns (`ml_predict`-style extensions) for scoring rows without
  exporting data to a separate ML serving step.

**Pricing / cost considerations:**
- Positioned above Cloud SQL and below Spanner in cost at comparable
  scale — the performance uplift over Cloud SQL isn't free; a
  scenario with a tight budget and no stated performance problem
  should stay on Cloud SQL.
- Because the columnar engine replaces a separate analytics
  pipeline/warehouse for HTAP use cases, total cost of ownership can
  still come out ahead of "Cloud SQL + a separate BigQuery ETL
  pipeline" once pipeline engineering/operational cost is counted —
  a Domain 4 total-cost-of-ownership argument, not just a per-service
  price comparison.

**Performance characteristics:**
- Materially higher transactional throughput ceiling than Cloud SQL
  for the same PostgreSQL-compatible workload, due to Google's
  storage-layer redesign (disaggregated storage, log-based
  replication to read pools).
- The columnar engine specifically accelerates read-heavy analytical
  queries (aggregations, scans across many rows) run against the same
  tables serving transactional traffic — the core HTAP performance
  story.

**Scaling behavior:**
- Read pool instances add read capacity within the region; there is
  no automatic multi-region write-scaling behavior — this is the
  single-region-native ceiling to name explicitly whenever comparing
  against Spanner.
- Storage scales automatically with data volume, similar to Cloud
  SQL's auto-grow behavior.

**Security posture:**
- Same IAM/CMEK/private-IP/VPC-SC posture as Cloud SQL — private
  connectivity by default is the recommended pattern, consistent with
  every other managed database in this file.

**HA / failure-mode behavior:**
- Regional HA: synchronous standby across zones within the region,
  automatic failover on zone failure — the same shape as Cloud SQL's
  regional HA, not a multi-region guarantee.
- A full regional outage requires a cross-region strategy (cross-
  region backups/replication design) outside AlloyDB's built-in HA —
  exactly the same caveat that applies to Cloud SQL, and exactly the
  gap Spanner's multi-region configuration closes automatically.

**Common mistakes / misconfigurations:**
- Recommending AlloyDB when the actual requirement is global
  multi-region write scale — the exam-trap version of this service:
  AlloyDB solves "PostgreSQL needs to go faster in one region," not
  "PostgreSQL needs to go global."
- Recommending Spanner (paying for global scale and a schema/dialect
  migration) when the real requirement is "our PostgreSQL app is slow
  and we also want live analytics" — AlloyDB is the closer-fit,
  lower-migration-cost answer.
- Ignoring the built-in columnar engine and still standing up a
  separate ETL-to-BigQuery pipeline for dashboards that could query
  AlloyDB directly, adding unneeded pipeline cost/complexity.

**Common exam scenario cues:** "PostgreSQL-compatible," "outgrowing
Cloud SQL's performance," "needs real-time analytics/dashboards
against live transactional data without a separate warehouse,"
"migrating self-managed PostgreSQL and wants a managed, faster
replacement" — paired against a Spanner distractor whenever the
scenario does **not** state a genuine multi-region write-scale
requirement.

---

## Cloud Spanner

**Purpose:** globally distributed, horizontally scalable relational
database with external (strong) consistency — the only GCP database
offering both SQL semantics and global horizontal write scale.

**When to use:**
- Global or multi-region applications needing strongly consistent
  reads/writes across regions (financial ledgers, global inventory,
  multi-region SaaS control planes).
- Relational workloads that have genuinely outgrown a single-region
  database's write-scale ceiling, not just its compute size.

**When NOT to use — use something else instead:**
- The workload fits comfortably in one region and doesn't need global
  strong consistency → **Cloud SQL or AlloyDB** — Spanner's cost and
  operational model are overkill, and this exact over-recommendation
  is a stated exam trap (see Domain 1 §1.3 tradeoffs).
- The workload is PostgreSQL-compatible and just needs a faster
  single-region engine with in-place analytics → **AlloyDB** —
  cheaper, simpler migration path, no schema/dialect rewrite.
- The access pattern is non-relational (wide-column time-series,
  document) → **Bigtable/Firestore** — Spanner's relational/SQL model
  and cost aren't justified when the data doesn't need joins/
  transactions.

**Key configuration surface:**
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
- **Cost signal**: meaningfully more expensive than Cloud SQL (and
  AlloyDB) at small scale — the exam trap is recommending Spanner for
  a workload that doesn't actually need global strong consistency
  (see Domain 1 §1.3 tradeoffs).

**Pricing / cost considerations:**
- Billed on provisioned compute capacity (nodes/processing units)
  plus storage, independent of query volume — the highest baseline
  cost of the relational options in this file, justified only when
  global scale/consistency is a genuine requirement.
- Multi-region configurations cost more than regional configurations
  for the same processing-unit count, reflecting the cross-region
  replication overhead that buys the strong-consistency guarantee.

**Performance characteristics:**
- Horizontal write scale with no resharding operation — capacity is
  added by increasing nodes/processing units, and Spanner
  automatically rebalances data (splits) across the added capacity.
- Poor schema/key design (monotonic primary keys) creates write
  hotspots exactly like Bigtable's row-key problem — Spanner scales
  horizontally in theory, but a bad key design prevents that scaling
  from materializing in practice.

**Scaling behavior:**
- Adding processing units/nodes scales both storage and compute
  capacity without a maintenance window or resharding step — the key
  differentiator from Cloud SQL/AlloyDB's vertical-scaling model.

**Security posture:**
- Same IAM/CMEK/private-connectivity/VPC-SC posture as the other
  managed relational databases in this file; fine-grained access
  control (database roles) is available for finer scoping than
  instance-level IAM alone.

**HA / failure-mode behavior:**
- Multi-region configurations provide automatic HA and strong
  consistency across regions with no manual failover step — the
  direct answer to a Domain 6 "active-active, zero-data-loss,
  cross-region" requirement.
- Regional configurations are still HA across zones within the
  region, but do not survive a full regional outage without a
  multi-region configuration.

**Common mistakes / misconfigurations:**
- Recommending Spanner by default for "we're growing" without
  confirming the actual requirement is global write scale/strong
  consistency, not just more capacity.
- Designing a schema with a sequential/monotonic primary key,
  creating the same hotspot problem Bigtable's row-key guidance
  warns against.
- Under-provisioning nodes/processing units for the actual write
  throughput, then attributing the resulting latency to "Spanner
  being slow" rather than undersized capacity.

**Common exam scenario cues:** "global, multi-region, strongly
consistent," "financial-grade consistency at global scale," "growing
beyond a single-region relational database's write-scale ceiling" —
paired against Cloud SQL/AlloyDB distractors whenever the true
requirement doesn't actually need global scale.

---

## Bigtable

**Purpose:** wide-column NoSQL — massive throughput, sub-10ms p99
latency at scale, time-series/IoT-shaped data.

**When to use:**
- Very high-throughput, low-latency workloads with a well-defined
  access pattern by row key (time-series telemetry, IoT device data,
  ad-tech/user-event data, financial market data).
- Data volumes in the terabyte-to-petabyte range where a relational
  engine's join/transaction overhead isn't needed.

**When NOT to use — use something else instead:**
- The workload needs SQL joins/multi-row transactions → **Cloud SQL,
  AlloyDB, or Spanner** — Bigtable has no cross-row transactional
  guarantees or a SQL query engine of its own.
- Data is naturally document-shaped with mobile/web client access and
  needs offline sync/real-time listeners → **Firestore** — Bigtable
  has no client SDK offline-sync story; it's a server-side/pipeline
  data store.
- Query patterns are unpredictable/ad hoc rather than known-in-advance
  by row key → a relational or analytical engine (**Cloud SQL,
  BigQuery**) is a better fit; Bigtable's performance depends on
  designing the row key around the access pattern up front.

**Key configuration surface:**
- **Row-key design is the primary performance lever** — not node
  count. Sequential/monotonic keys (raw timestamps) hotspot; salt,
  hash, or reverse the key to spread load (see the S.A.L.T. mnemonic
  in `00-START-HERE/EXAM-TRAPS-AND-MNEMONICS.md`).
- **Clusters and replication**: a Bigtable instance can have multiple
  clusters (different zones/regions) for read scaling and DR; app
  profiles control routing (single-cluster for strong consistency
  within writes, multi-cluster for lower latency across regions with
  eventual consistency between clusters).
- **Column families**: schema is defined by grouping related columns,
  not a fixed relational schema — designed for sparse, wide data
  (millions of columns is a valid, common Bigtable shape).
- **Garbage collection policies**: per-column-family rules (max
  versions, max age) automatically prune old cell versions — the
  mechanism for cost/storage control without an application-level
  cleanup job.

**Pricing / cost considerations:**
- Billed on provisioned node capacity (or capacity units in
  autoscaling mode) plus storage — similar shape to Spanner's
  capacity-based billing, not per-query.
- SSD storage is the default/typical choice for latency-sensitive
  workloads; HDD is available for lower cost when latency
  requirements are relaxed (e.g. large-volume analytical-only
  access), a cost/performance tradeoff worth naming explicitly.

**Performance characteristics:**
- Sub-10ms p99 latency at scale is achievable, but entirely
  contingent on row-key design distributing load evenly — the same
  node count with a bad key design will hotspot and miss latency
  targets.
- Throughput scales roughly linearly with node count *given* a
  well-distributed row key; it does not scale linearly if the
  workload concentrates on a narrow key range.

**Scaling behavior:**
- Nodes can be added/removed (or autoscaling enabled) to match
  throughput needs; resizing does not require downtime, but a
  hotspotted key design limits how much added capacity actually
  helps.

**Security posture:**
- IAM at the instance/table level; CMEK support for at-rest
  encryption; private connectivity via VPC (no public endpoint
  exposure needed for typical pipeline/service access patterns).

**HA / failure-mode behavior:**
- Multi-cluster replication provides both read scaling and DR — a
  cluster in a second region can serve reads (and, depending on app
  profile routing, writes) if the primary region is unavailable, at
  the cost of eventual (not strong) consistency between clusters.
- Single-cluster instances have no built-in cross-zone/region
  failover — this is a Domain 6 design decision, not a default.

**Common mistakes / misconfigurations:**
- Using a raw timestamp (or any monotonically increasing value) as
  the leading row-key component, hotspotting writes onto a single
  node/tablet.
- Expecting cross-row transactional guarantees Bigtable doesn't
  provide.
- Treating multi-cluster routing as strongly consistent across
  clusters when the app profile is configured for multi-cluster
  (eventually consistent) routing.

**Common exam scenario cues:** "millions of IoT devices," "time-series
telemetry," "need sub-10ms reads at massive write throughput" —
TerramEarth's 2M-device fleet is the canonical case-study fit.

---

## Firestore

**Purpose:** serverless NoSQL document database — native mode is built
for mobile/web apps needing offline sync and real-time listeners.

**When to use:**
- Mobile/web application backends needing offline persistence,
  real-time data sync, and flexible document-shaped schemas.
- Collaborative or live-updating features (shared documents, live
  dashboards, chat) where clients subscribe to changes rather than
  polling.

**When NOT to use — use something else instead:**
- The workload needs massive server-side write throughput with a
  known access pattern by key (IoT/time-series ingestion at scale) →
  **Bigtable** — Firestore is optimized for client-facing document
  access patterns, not high-volume server-side telemetry ingestion.
- The workload needs relational joins/multi-table transactions across
  a normalized schema → **Cloud SQL, AlloyDB, or Spanner**.
- Legacy App Engine-era code paths already built against the old
  Datastore API with no client-SDK/offline-sync requirement → stay on
  **Datastore mode** rather than migrating to Native mode purely for
  its own sake if none of Native mode's client-facing features are
  actually needed.

**Key configuration surface:**
- **Native mode vs. Datastore mode**: Native mode has mobile/web
  SDKs, real-time sync, and strong consistency by default; Datastore
  mode is the legacy App Engine-era API surface, still available for
  compatibility.
- **Real-time listeners**: clients subscribe to a query and receive
  live updates — the mechanism behind "collaborative app" or
  "live-updating dashboard" scenario requirements without you
  building a custom pub/sub layer for the frontend.
- **Offline persistence**: mobile/web SDKs cache data locally and
  sync on reconnect — the answer for "mobile app needs to keep
  working with spotty connectivity," distinct from Bigtable's
  server-side replication story.
- **Security Rules**: declarative, client-SDK-enforced access control
  (distinct from IAM) — the mechanism for letting mobile/web clients
  talk to Firestore directly and safely without a custom backend API
  layer in between.

**Pricing / cost considerations:**
- Billed per document read/write/delete operation plus storage — a
  chatty client access pattern (many small reads) can cost more than
  expected; query design (denormalization, avoiding N+1-style
  per-document fetches) directly controls cost.
- No idle/provisioned-capacity cost — genuinely serverless, pay for
  operations actually performed, unlike Bigtable/Spanner's
  capacity-based billing.

**Performance characteristics:**
- Low-latency reads/writes suited to interactive client-facing
  workloads; real-time listener updates propagate with low latency to
  subscribed clients.

**Scaling behavior:**
- Scales automatically with no capacity to provision — the
  serverless database option in this file, matching the "no ops"
  positioning of Cloud Run/App Engine on the compute side.

**Security posture:**
- Security Rules enforce access control directly at the client SDK
  boundary — critical for any scenario where mobile/web clients talk
  to Firestore without a backend intermediary; IAM governs
  server-side/admin SDK access separately.

**HA / failure-mode behavior:**
- Native mode is strongly consistent by default and multi-region by
  configuration option — a scenario needing regional HA/DR for
  Firestore should confirm the multi-region database location was
  chosen at creation time (also a largely one-time choice, similar in
  spirit to App Engine's region lock-in).

**Common mistakes / misconfigurations:**
- Using Firestore for a high-volume server-side ingestion pipeline
  better suited to Bigtable.
- Relying on IAM alone for client-facing access control instead of
  Security Rules, or vice versa — the two serve different trust
  boundaries (server-side admin access vs. client SDK access).
- Designing a data model with unnecessary per-field small documents,
  driving up per-operation billing.

**Common exam scenario cues:** "mobile app backend," "need offline
support," "real-time collaborative features."

---

## BigQuery (storage-relevant surface)

**Purpose:** serverless analytics warehouse — separates storage and
compute billing; full analytics-pipeline depth in
`02-services/05-data-analytics-ai.md`, this section covers it purely
as a storage destination.

**When to use:**
- Large-scale analytical/reporting workloads (OLAP), especially SQL-
  based ad hoc and scheduled analysis over historical data.
- As the canonical warehouse target when a scenario needs a single
  place for cross-functional analytics without duplicating a
  transactional database's storage engine.

**When NOT to use — use something else instead:**
- Low-latency transactional (OLTP) reads/writes for an application →
  **Cloud SQL/AlloyDB/Spanner/Firestore** — BigQuery is not designed
  for row-level transactional access patterns or sub-second
  point-lookup latency at application-request scale.
- Live operational-data analytics that must stay tightly coupled to a
  transactional workload without an ETL step → **AlloyDB's columnar
  engine** — if the requirement is "analytics on the same live data
  the app writes, without a pipeline," AlloyDB's HTAP story is a
  closer fit than exporting to BigQuery.

**Key configuration surface:**
- **Storage pricing**: active (recently modified) vs. long-term
  (>90 days unmodified, automatically cheaper) — no manual lifecycle
  rule needed, unlike Cloud Storage.
- **Partitioning and clustering**: partition by date/ingestion time to
  limit bytes scanned per query (directly controls cost); cluster
  within partitions on frequently-filtered columns for further
  pruning — the answer whenever a scenario complains about BigQuery
  query cost or performance.
- **External tables / BigLake**: query data that lives in Cloud
  Storage without loading it into BigQuery-managed storage — for data
  lakes that need to stay object-storage-native for other consumers.

**Pricing / cost considerations:** see full analytics-surface pricing
detail (on-demand vs. capacity/slot-based) in
`02-services/05-data-analytics-ai.md`; from a pure storage angle,
active vs. long-term storage pricing and partition-pruning are the
two levers that matter most for cost control.

**Performance characteristics:** query performance from a storage
perspective is dominated by how much data must be scanned —
partitioning/clustering are the direct performance (and cost) levers.

**Scaling behavior:** storage scales automatically with no capacity
to provision; compute (query execution) scales per-query
transparently under on-demand pricing, or within reserved slot
capacity under capacity pricing.

**Security posture:** column-level and row-level security policies,
IAM at dataset/table level, CMEK support, and VPC-SC perimeter support
— consistent with the other managed data stores in this file.

**HA / failure-mode behavior:** data is automatically replicated
within the region (or across regions for multi-region datasets);
no manual failover configuration is required at the storage layer.

**Common mistakes / misconfigurations:** querying an unpartitioned
table with a `SELECT *`-shaped access pattern at scale, driving both
cost and latency far higher than necessary; loading data into
BigQuery-managed storage when an external/BigLake table over Cloud
Storage would better serve a shared data-lake requirement.

**Common exam scenario cues:** "analytics warehouse," "reporting/BI
over historical data," "reduce query cost/bytes scanned," "data lake
that other tools also need to read directly."

---

## Memorystore

**Purpose:** managed in-memory cache — Redis or Memcached — not a
system of record.

**When to use:**
- Caching layer in front of a durable database to absorb read load
  and cut latency for hot data.
- Session storage, rate-limiting counters, leaderboards (Redis sorted
  sets), or pub/sub-lite messaging patterns that fit in-memory data
  structures.

**When NOT to use — use something else instead:**
- Anything that must survive a restart/failure as the sole copy of
  the data → **a durable store (Cloud SQL, Firestore, Bigtable,
  AlloyDB)** — Memorystore is explicitly not a system of record; a
  scenario treating it as the only place data lives is a trap.
- A need for cross-region strong consistency → not Memorystore's
  design point at all; that's a Spanner-shaped requirement instead.

**Key configuration surface:**
- **Use case boundary**: sub-millisecond latency for cache/session
  data; always paired with a durable backing store (Cloud SQL,
  Firestore, Bigtable) — a scenario treating Memorystore as the sole
  data store for anything that must survive a restart is a trap.
- **Redis vs. Memcached**: Redis supports richer data structures,
  persistence, and pub/sub; Memcached is simpler, purely ephemeral,
  multi-threaded — Redis is the default correct answer unless a
  scenario specifically wants Memcached's simplicity/multi-threading.
- **Redis HA tier**: a replica in a second zone with automatic
  failover — the answer whenever a scenario needs the cache layer
  itself to survive a zone failure rather than just cold-starting
  empty against the backing store.

**Pricing / cost considerations:** billed on provisioned instance
capacity (memory size/tier), not per-operation — sizing the instance
to the actual working set (not the full backing-store size) is the
main cost control; oversizing "just in case" is a common
over-provisioning trap.

**Performance characteristics:** sub-millisecond latency at the
in-memory tier — the entire value proposition versus hitting the
backing durable store directly for hot reads.

**Scaling behavior:** vertical (instance size) primarily; Redis
Cluster mode adds horizontal sharding for workloads outpacing a
single instance's capacity.

**Security posture:** private IP only (no public endpoint), IAM for
management-plane access, in-transit encryption (TLS) and
authentication (Redis AUTH) available and recommended for
production.

**HA / failure-mode behavior:** the Basic tier has no automatic
failover (data loss/cold cache on instance failure is expected); the
Standard/HA tier adds a cross-zone replica with automatic failover —
a scenario emphasizing "the cache must survive a zone outage without
a cold-cache penalty" is naming the HA tier explicitly.

**Common mistakes / misconfigurations:** treating a Basic-tier
instance as HA by default; using Memorystore as the sole store for
data with no durable backing copy; oversizing the instance beyond the
actual working set.

**Common exam scenario cues:** "reduce database read latency,"
"session store," "leaderboard/real-time counters," always paired with
an explicit durable backing store elsewhere in the scenario.

---

## Filestore

**Purpose:** managed NFS file storage — POSIX filesystem semantics for
workloads that need a real mounted filesystem, not object-storage
semantics.

**When to use:**
- Legacy or COTS applications that expect a mounted POSIX filesystem
  rather than an object-storage API.
- Shared file access across many Compute Engine/GKE nodes
  simultaneously (render farms, HPC scratch space, shared home
  directories).

**When NOT to use — use something else instead:**
- New, cloud-native application storage that can use an object API →
  **Cloud Storage** — cheaper, more scalable, no filesystem to
  provision/manage, unless a real POSIX mount is a hard requirement.
- Block storage for a single VM's own disk → **Persistent Disk/
  Hyperdisk** — Filestore is for shared, multi-client file access,
  not single-instance block storage.

**Key configuration surface:** service tiers by performance/capacity
(Basic, Zonal/Enterprise-class tiers with different IOPS/throughput
ceilings); NFS export/mount configuration; snapshots for backup.

**Pricing / cost considerations:** billed on provisioned capacity/
tier, generally at a materially higher per-GB cost than Cloud
Storage — reflecting the always-on, low-latency filesystem service
model versus object storage's scale-and-forget economics; provision
only the tier/capacity the actual shared-filesystem workload needs.

**Performance characteristics:** performance scales with the chosen
service tier (higher tiers = higher IOPS/throughput ceilings) rather
than automatically like Cloud Storage.

**Scaling behavior:** capacity is provisioned and resized within tier
limits; not the elastic, unlimited-scale model Cloud Storage offers.

**Security posture:** VPC-private access (no public endpoint), IAM for
management operations; the NFS-level access control (POSIX
permissions) is a separate, additional layer clients must also
respect.

**HA / failure-mode behavior:** higher service tiers offer built-in
regional/zonal redundancy options; snapshots provide point-in-time
recovery for logical failures (bad write, accidental delete).

**Common mistakes / misconfigurations:** defaulting to Filestore for
a workload that would be cheaper and simpler on Cloud Storage, purely
out of habit from an on-prem filesystem mindset.

**Common exam scenario cues:** "legacy application expects a shared
file system," "render farm / HPC workload needing a shared POSIX
mount across many Compute Engine/GKE nodes."

---

## Persistent Disk / Hyperdisk

**Purpose:** block storage attached to Compute Engine VMs / GKE nodes.

**When to use:**
- Any VM/node needing durable, attachable block storage as its boot
  or data disk.
- Workloads with an unusual IOPS-to-capacity ratio (Hyperdisk) that a
  fixed Persistent Disk tier can't serve efficiently.

**When NOT to use — use something else instead:**
- Shared, multi-client file access → **Filestore** — block storage
  attaches to a single instance (or, for regional PD, is
  synchronously replicated for that instance's HA, not shared
  concurrent multi-client access).
- Object-shaped, API-accessed unstructured data → **Cloud Storage**.
- The absolute lowest latency and durability is not required
  (ephemeral scratch space) → **Local SSD** — cheaper and faster than
  either Persistent Disk or Hyperdisk, at the cost of losing data on
  instance stop/terminate.

**Key configuration surface:**
- **Persistent Disk**: zonal (cheapest) or regional (synchronously
  replicated across two zones, for VM-level HA without app-level
  replication) — SSD or HDD/Balanced tiers by IOPS/throughput need.
- **Hyperdisk**: newer generation, independently provisioned
  capacity/IOPS/throughput (decoupled from disk size) — the answer
  when a scenario has an unusual IOPS-to-capacity ratio that a fixed
  Persistent Disk tier can't serve efficiently.

**Pricing / cost considerations:** billed on provisioned capacity
(and, for Hyperdisk, separately on provisioned IOPS/throughput) —
disks continue billing even while the attached VM is stopped, a
frequent "why didn't my bill drop" trap; Hyperdisk's decoupled
pricing avoids over-paying for capacity just to reach a needed IOPS
number, or vice versa.

**Performance characteristics:** SSD tiers offer materially higher
IOPS/lower latency than HDD/Balanced; Hyperdisk raises the ceiling
further and allows tuning IOPS/throughput independent of capacity;
Local SSD (Compute Engine's ephemeral option) remains the fastest tier
overall but is not durable.

**Scaling behavior:** disks can be resized (capacity increased) live
in most cases without downtime; Hyperdisk allows independently
adjusting IOPS/throughput without a capacity change.

**Security posture:** encrypted at rest by default; CMEK/CSEK
supported for customer-managed/customer-supplied keys; access is
governed by the attached VM's IAM/service-account context, not a
separate disk-level IAM surface.

**HA / failure-mode behavior:** zonal disks carry single-zone fault-
domain risk; regional Persistent Disk synchronously replicates across
two zones, providing disk-level HA independent of any application-
level replication, directly supporting a MIG/VM failover design.

**Common mistakes / misconfigurations:** choosing a zonal disk for a
workload requiring VM-level HA and expecting the disk to survive a
zone failure; selecting a fixed Persistent Disk tier for a workload
with an atypical IOPS/capacity ratio instead of Hyperdisk; forgetting
that a stopped VM's disks still incur cost.

**Common exam scenario cues:** "attached block storage for a VM/GKE
node," "unusual IOPS-to-capacity ratio," "VM-level HA without
application-level replication" → regional Persistent Disk;
"highest possible IOPS, data loss on stop is acceptable" → Local SSD.
