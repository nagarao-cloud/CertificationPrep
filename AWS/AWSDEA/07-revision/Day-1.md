# Revision — Day 1

> Rapid-recall checkpoint, not a teaching doc. Covers Day 1 only:
> S3, file formats/compression, partitioning, Glue Data Catalog, Iceberg intro.
> Full depth lives in `02-services/S3.md`, `02-services/Glue.md`,
> `03-comparisons/Iceberg-vs-Hive.md`. If a line doesn't click, go reread
> that source — don't re-derive it here.

---

## 1. Rapid recall — Day 1

### S3 storage classes

| Class | Retrieval | Min duration | Availability | Use when |
|---|---|---|---|---|
| Standard | Instant | None | 99.99% | Hot, frequent |
| Intelligent-Tiering | Instant | None | 99.9% | Pattern unknown/changing (per-object monitoring fee) |
| Standard-IA | Instant | 30 d | 99.9% | Known cold, still need instant access |
| One Zone-IA | Instant | 30 d | 99.5% | Reproducible data, single AZ |
| Glacier Instant Retrieval | Milliseconds | 90 d | 99.9% | Archive, still instant |
| Glacier Flexible Retrieval | 1–5 min / 3–5 h / 5–12 h | 90 d | 99.99% | Archive, occasional |
| Glacier Deep Archive | 12 h / 48 h | 180 d | 99.99% | 7–10 yr compliance, cheapest storage |
| Express One Zone | Single-digit ms | None | 99.95% | Very high request-rate workloads |

### S3 mechanics

| Topic | Recall |
|---|---|
| Lifecycle policy | Known access pattern → transitions/expirations, no monitoring fee |
| Intelligent-Tiering vs Lifecycle | Unknown/changing pattern → IT; known pattern → Lifecycle (cheaper) |
| Versioning | Required precondition for CRR/SRR and for MFA delete |
| Object Lock — governance mode | WORM, but privileged users with `s3:BypassGovernanceRetention` can override |
| Object Lock — compliance mode | WORM, nobody — not even root — can delete or shorten retention |
| CRR / SRR | Cross/Same-Region Replication; needs versioning on source + destination |
| Replication Time Control | 15-minute replication SLA, extra cost |
| Consistency | Strong read-after-write for all operations (PUTS, overwrites, deletes) |
| Request limits | ~5,500 GET / 3,500 PUT per second **per prefix** — scale by adding prefixes |
| Default encryption | SSE-S3 applied automatically to every new object since 2023 — you don't have to configure it |
| Multipart upload | Recommended above ~100 MB; required above 5 GB; parallelizes upload, resumable on failure |
| Transfer Acceleration | Speeds up long-distance uploads via CloudFront edge locations — not a storage-class decision |
| Byte-range fetches | Read part of an object without downloading the whole thing — useful for large Parquet files |
| S3 Storage Class Analysis | Observes access patterns over time to recommend IA transitions — informs a lifecycle policy, doesn't replace one |
| S3 Inventory | Scheduled CSV/Parquet report of objects + metadata in a bucket — the answer for "audit millions of objects without listing them live" |

### File formats

| Format | Layout | Splittable | Compression | Best for |
|---|---|---|---|---|
| Parquet | Columnar | Yes | Excellent | Default for analytics |
| ORC | Columnar | Yes | Best | Hive-heavy legacy |
| Avro | Row | Yes | Good | Streaming ingest, schema evolution |
| JSON | Row (text) | Conditional | Poor | Raw landing only |
| CSV | Row (text) | Yes (uncompressed) | Poor | Raw landing only |

Rule: **Columnar for Consumption, Row for Receiving.**

```
Landing raw data, schema will change?  ──▶ Avro (or JSON if truly ad-hoc)
Feeding Athena/Redshift/analytics?     ──▶ Parquet + Snappy, partitioned
Legacy Hive/Presto cluster already running? ──▶ ORC
```

### Compression codecs

| Codec | Splittable | Ratio | Speed | Use when |
|---|---|---|---|---|
| Snappy | Yes (inside Parquet/ORC) | Medium | Fastest | Default with Parquet |
| ZSTD | Yes | High | Fast | Modern default, better ratio than Snappy |
| GZIP | **No, standalone** | High | Slow | Small files / archival only |
| BZIP2 | Yes | Highest | Slowest | Rarely the right exam answer |
| LZO | Yes, if indexed | Low | Fast | Legacy |

⚠️ A gzipped CSV cannot be split — one worker reads the whole file, zero parallelism, regardless of cluster size.

### Partitioning & the small-file problem

| Topic | Recall |
|---|---|
| Partition on | Low-cardinality columns used in `WHERE` (date hierarchies: `year=/month=/day=`) |
| Don't partition on | High-cardinality IDs (customer_id, UUID) — use bucketing instead |
| Small-file problem | Millions of tiny files → per-file open overhead dominates |
| Target file size | 128 MB – 1 GB |
| Fixes | Glue `coalesce()`/`repartition()`; bigger Firehose buffer; Athena CTAS + bucketing; Iceberg compaction |

**Worked example:** 50 GB/day of clickstream data, partitioned by
`year/month/day/hour`. That's 24 partitions/day → ~2 GB per partition →
fine. Now imagine partitioning by `user_id` (5M distinct users) instead:
5M partitions for the same 50 GB → ~10 KB per partition → the small-file
problem, guaranteed, regardless of format or compression choice.

### Glue Data Catalog

| Topic | Recall |
|---|---|
| What it is | Central technical metadata: databases, tables, partitions |
| Used by | Athena, EMR, Redshift Spectrum, Glue jobs, Lake Formation |
| Crawler | Infers schema, populates/updates catalog, detects new partitions |
| Classifier | Determines format/schema during a crawl (built-in + custom) |
| Fine-grained permissions | **None.** Catalog is DB/table level only — column/row security is Lake Formation |
| Cost | Per object stored + per request — cheap |
| Built-in classifiers | CSV, JSON, Parquet, ORC, Avro, XML — crawler picks the matching one automatically |
| Crawler cost trap | Running crawlers constantly on huge/rapidly-changing tables is expensive — schedule sensibly or use partition projection (Day 6) instead |

### Iceberg — intro only (deep dive is Day 6)

| Topic | Recall |
|---|---|
| What it fixes | Adds ACID transactions to tables sitting on plain S3 files |
| Row-level UPDATE/DELETE | Hive tables must rewrite whole partitions; Iceberg does it natively |
| Time travel | Query a snapshot as of a past point — Hive can't |
| Concurrent writers | Optimistic concurrency — Hive risks corruption |
| AWS support | Athena, Glue, EMR, Redshift, S3 Tables |
| Exam signal | "upsert", "MERGE", "GDPR delete", "time travel", "schema evolution without rewrite" |

---

## 2. Keyword → service trigger table

| Trigger phrase | Answer |
|---|---|
| Unknown / changing access pattern | S3 Intelligent-Tiering |
| Known pattern: hot then cold | S3 Lifecycle policy |
| Archive, 12-hour retrieval OK | Glacier Deep Archive |
| Archive but need millisecond retrieval | Glacier Instant Retrieval |
| WORM, regulatory, cannot be deleted by anyone | S3 Object Lock (compliance mode) |
| Single-digit ms latency, very high request rate | S3 Express One Zone |
| Improve Athena performance and cost | Convert to Parquet |
| Hive-heavy workloads | ORC |
| Schema evolution at ingest / streaming writers | Avro |
| Slow queries over gzipped CSV | Convert to Parquet + Snappy, then partition |
| Millions of tiny objects, slow queries | Compact into 128 MB–1 GB files |
| Central metadata for Athena and EMR | Glue Data Catalog |
| Infer schema, detect new partitions | Glue Crawler |
| Upsert / delete / GDPR / time travel on S3 data | Apache Iceberg |
| "Analysts see all columns except SSN" | *Not the Catalog* — that's Lake Formation (Day 8) |

---

## 3. Top exam traps — Day 1 scope

1. **Setup:** "10 GB gzipped CSV files, Athena queries very slow." → **Wrong:** add more Athena capacity. → **Right:** convert to Parquet + Snappy and partition. Format problem, not capacity problem.
2. **Setup:** "Millions of 100 KB files in S3, queries are slow." → **Wrong:** add more partitions. → **Right:** compact into 128 MB–1 GB files. More partitions makes small-file problem worse.
3. **Setup:** "Partition the table by `customer_id` (2M distinct values)." → **Wrong:** yes, more partitions = more pruning. → **Right:** partition by date, bucket on the high-cardinality key. High cardinality = catalog bloat + small files.
4. **Setup:** "Objects hot for 30 days, known pattern, then rarely accessed." → **Wrong:** S3 Intelligent-Tiering. → **Right:** Lifecycle policy. Pattern is known and stated — IT's monitoring fee buys nothing here.
5. **Setup:** "Move objects to Standard-IA after 7 days." → **Wrong:** approve it, saves money. → **Right:** flag it — Standard-IA has a **30-day minimum billing duration**; early transition costs more, not less.

---

## 4. Mnemonics recap

| Mnemonic | For |
|---|---|
| **"Sit In Glacier Deep"** | S3 class ladder: Standard → Intelligent-Tiering → IA/One Zone-IA → Glacier Instant → Flexible → Deep Archive |
| **"PACJ" ("Pack J")** | File format pick order: Parquet → Avro → CSV → JSON |
| **"Snappy is Speedy, GZIP is Greedy"** | Snappy = fast + splittable inside Parquet; GZIP = smaller but kills parallelism standalone |
| **S3 = Store, Scale, Simple** | The gravity well everything else falls into |
| **Glue sticks your data together — Catalog is the label on the jar** | Glue ETL vs Glue Data Catalog distinction |
| **Iceberg: most of it is under the surface** | Snapshots, history, time travel — hidden metadata layer |

---

## 5. Self-test — rapid fire (14)

| # | Question | Answer |
|---|---|---|
| 1 | Cheapest S3 class with millisecond retrieval for archived data? | Glacier Instant Retrieval |
| 2 | Minimum storage duration for Standard-IA? | 30 days |
| 3 | Minimum storage duration for Glacier Deep Archive? | 180 days |
| 4 | Which S3 Object Lock mode can nobody override, including root? | Compliance mode |
| 5 | Precondition for enabling CRR? | Versioning enabled on both buckets |
| 6 | Why is a standalone gzipped file bad for Athena? | Not splittable — one worker reads it all |
| 7 | Default compression codec paired with Parquet? | Snappy |
| 8 | Which format has the best schema evolution support? | Avro |
| 9 | Target file size for the small-file fix? | 128 MB – 1 GB |
| 10 | What should you partition on instead of a high-cardinality ID? | Bucket on it; partition on low-cardinality date columns |
| 11 | What does a Glue crawler actually do? | Infers schema, populates/updates the Data Catalog, detects partitions |
| 12 | Does the Glue Data Catalog do column-level security? | No — that's Lake Formation |
| 13 | Is S3 encrypted by default now, without any config? | Yes — SSE-S3 applies automatically since 2023 |
| 14 | What happens if you partition 50 GB of data by a 5M-value user_id? | Millions of tiny partitions — the small-file problem, guaranteed |
