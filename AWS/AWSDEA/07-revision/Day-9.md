# Revision — Day 9 (cumulative: Days 1–8, pre-mock cram sheet)

> Rapid-recall checkpoint, not a teaching doc. Day 9 itself has no new
> material (it's mock-exam day) — this sheet is what you read **before**
> the morning mock: Days 1–4 collapsed into one dense table, Days 5–6
> medium, Day 7 medium, and Day 8 (Security & Governance, the domain
> you've seen least) at full detail. After the mock, your personal
> wrong-answer list matters more than this sheet — use both.

---

## 1. Rapid recall — by day

### Days 1–4 recap — Storage, Streaming, Transformation, Orchestration (max compression)

| Domain area | Recall |
|---|---|
| S3 classes | Standard → Intelligent-Tiering (unknown pattern) → IA (30 d min) → Glacier IR/Flex (90 d min) → Deep Archive (180 d min, 12 h retrieval) |
| S3 mechanics | Object Lock compliance mode = nobody can override; CRR/SRR needs versioning; strong read-after-write consistency |
| Formats/compression | Parquet+Snappy default; Avro = best schema evolution; GZIP standalone not splittable; small-file fix = compact to 128 MB–1 GB |
| Partitioning | Low-cardinality date columns; bucket high-cardinality IDs |
| Glue Catalog | Metadata + crawlers; zero column/row security (that's Lake Formation) |
| Iceberg | ACID on S3 — row-level delete, time travel, safe concurrent writers, partition evolution w/o rewrite |
| Firehose | ~60 s buffer, no replay, one destination — least ops |
| Kinesis Data Streams | 1 MB/s or 1,000 rec/s per shard; `IteratorAge`=consumer lag; EFO=dedicated 2 MB/s/consumer; retention up to 365 d |
| MSK | Only when Kafka already exists |
| DMS | Full load=one-time; +CDC=minimal downtime; SCT handles schema/procs, not DMS |
| Zero-ETL | Aurora/RDS-MySQL/DynamoDB → Redshift/OpenSearch, no pipeline, seconds of lag |
| SQS/SNS/EventBridge | FIFO=order, Standard=throughput; SNS=simple fan-out; EventBridge=content routing |
| Glue ETL | Bookmarks=incremental, reset to reprocess; G.1X→G.8X ladder; Flex=cheap/non-urgent |
| EMR | Spot on task nodes only; Serverless=no cluster ops; has Hive/Presto/HBase Glue lacks |
| Managed Flink | Windowed aggregation, exactly-once via checkpointing |
| Lambda ETL | 15 min / 10,240 MB / 10 GB `/tmp` |
| Skew/pruning/pushdown | Repartition fixes skew (not more workers); pruning skips partitions; pushdown filters at storage layer |
| Step Functions | Standard=1 yr, exactly-once, per-transition billing; Express=5 min, at-least-once, cheap at volume |
| MWAA | Never "least ops" — always-on; wins only w/ existing Airflow DAGs |
| Glue Workflows | Free, Glue-only chaining |
| Idempotency/DLQ | Idempotency fixes at-least-once duplicate problem; DLQ catches poison messages |
| CI/CD | CloudFormation/CDK/SAM for IaC; Git for version control |

### Days 5–6 recap — Redshift, Athena, DynamoDB, Modeling, Lakehouse (medium)

| Topic | Recall |
|---|---|
| Redshift distribution | AUTO(least ops) / KEY(big facts) / EVEN(no key) / ALL(small dims) — low-cardinality KEY causes skew |
| Sort keys | Compound (default, leading filter col) vs Interleaved (unpredictable filters, costly maintenance) |
| Redshift Serverless | RPU-based, scales to zero — unpredictable usage |
| Spectrum | Requires an existing Redshift cluster |
| Concurrency scaling | Transient clusters at peak, 1 free credit-hour/24h |
| COPY | Split files, multiple of slice count, 1 MB–1 GB each |
| Athena | ~$5/TB scanned; workgroups = cost guardrails; partition projection = no crawler needed; ACID only via Iceberg |
| Athena vs Redshift | Access pattern decides, not data location — concurrency quota kills Athena at dashboard scale |
| DynamoDB | 400 KB item limit; GSI=add anytime/eventually consistent; LSI=creation-time only/10 GB per key |
| DynamoDB analytics | Export to S3 = no RCUs consumed; Scan = throttles the app, never for analytics |
| Data modeling | Star=denormalized/simple joins; Snowflake=normalized/more joins; SCD2=full history via new rows |
| Iceberg deep | Snapshots→time travel; compaction rewrites small files; hidden partitioning; optimistic concurrency |
| Lakehouse | Bronze(raw)→Silver(cleaned)→Gold(business-ready) |

### Day 7 recap — Operations, Monitoring, Quality, Cost (medium)

| Topic | Recall |
|---|---|
| Signature metrics | Kinesis=`IteratorAge`; Firehose=`DeliveryToS3.Success`; Glue=`numFailedTasks`; Redshift=`WLMQueueLength`; Athena=`DataScannedInBytes`; DynamoDB=`ThrottledRequests` |
| CloudTrail | Management events=API audit (who changed); Data events=object reads (who read) — **off by default, extra cost** |
| X-Ray | Distributed tracing, cross-service bottlenecks |
| Glue Data Quality (DQDL) vs Macie | DQ validates business rules; Macie discovers sensitive data — common distractor pair |
| Troubleshooting order for S3 403 | IAM → bucket policy → **KMS key policy** (most forgotten) → Lake Formation → SCP |
| EMR/Glue/Lambda symptom fixes | OOM→bigger worker/fix skew; hot shard→better partition key; throttle→check concurrency limits |
| QuickSight | SPICE=cached/fast; direct query=live/slower; RLS=per-user row filtering |
| Cost universal answer | Partition + Parquet + Compress + Compact |
| Other cost levers | Spot on task nodes (EMR); Glue Flex; RIs for steady Redshift; auto-pause Serverless; S3 Bucket Keys for KMS cost |

### Day 8 — Security & Governance (full detail — newest, highest-leverage domain right now)

**IAM policy evaluation order — recite exactly**

```
1. Explicit DENY anywhere?           → DENY. Stop.
2. SCP (Organizations) allows it?    → If no, DENY.
3. Resource-based policy allows it?  → If yes, may ALLOW.
4. Within the permissions boundary?  → If no, DENY.
5. Session policy allows it?         → If no, DENY.
6. Identity-based policy allows it?  → If yes, ALLOW.
7. Otherwise                         → Implicit DENY.
```
Mnemonic: **"Deny Stops Really Powerful Session Identities."**

| Topic | Recall |
|---|---|
| Roles vs users | Roles = temporary/assumed credentials, no long-term keys; Users = long-term identity |
| Trust policy | Defines *who* can assume a role |
| ABAC | Attribute/tag-based access control via IAM tags |

**Lake Formation**

| Topic | Recall |
|---|---|
| Core job | Permissions on top of the Glue Data Catalog: DB, table, **column, row, cell** |
| LF-Tags (TBAC) | Tag-based grants at scale — answer for "thousands of tables" |
| Data filters | Named row/column/cell filters per principal |
| Data location permissions | Controls who can register/point at an S3 location |
| Cross-account sharing | Native + AWS RAM, no data copy |
| Hybrid access mode | IAM and LF permissions coexist during migration |
| IAM vs LF | IAM = bucket/prefix/API-action granularity; LF = sub-table (column/row/cell) granularity — IAM literally cannot do column-level |

**KMS & encryption**

| Topic | Recall |
|---|---|
| AWS owned key | Free, AWS controls everything, no cross-account |
| AWS managed key (`aws/s3`) | Free (pay requests), annual rotation, **no cross-account sharing** |
| Customer-managed key (CMK) | You control policy + rotation, ✅ cross-account, $1/mo + requests |
| Imported key (BYOK) | You control, manual rotation, ✅ cross-account |
| Cross-account encrypted data | **Requires a CMK** — AWS-managed keys cannot be shared cross-account |
| SSE-S3 | AES-256, AWS-managed, free, **no CloudTrail key audit trail** |
| SSE-KMS | KMS-backed, audit trail via CloudTrail, request cost |
| DSSE-KMS | Double encryption, for double-encryption mandates |
| SSE-C | Customer supplies keys entirely, AWS never stores them |
| Client-side encryption | Zero trust in provider, you manage everything |
| S3 Bucket Keys | Cuts KMS API calls up to 99% — fixes "KMS costs too high" |
| Compliance/audit language | → SSE-KMS with a **customer-managed key**, never SSE-S3 |

**Secrets & config**

| Topic | Recall |
|---|---|
| Secrets Manager | Automatic rotation (built-in for RDS/Redshift/DocumentDB), ~$0.40/secret/mo, cross-account via resource policy |
| Parameter Store Standard | Free, 4 KB max, no automatic rotation |
| Parameter Store Advanced | ~$0.05/param/mo, 8 KB max |
| Tiebreaker | Rotation needed → Secrets Manager; cost-sensitive/no rotation → Parameter Store |

**Macie & VPC endpoints**

| Topic | Recall |
|---|---|
| Macie | Discovers PII/sensitive data in S3 — not a rules-validation tool (that's Glue DQ) |
| Gateway VPC endpoint | **S3 and DynamoDB only**, free |
| Interface VPC endpoint (PrivateLink) | Everything else (Kinesis, Glue, Redshift, etc.), hourly + data charges |
| "No additional cost" + S3 access from VPC | Gateway endpoint is the tell |

**Cross-account patterns**

| Pattern | Use for |
|---|---|
| S3 bucket policy | Simple bucket-level cross-account rules |
| IAM role + `sts:AssumeRole` | Temporary cross-account access |
| AWS RAM | Share resources (subnets, catalogs) across accounts |
| Lake Formation cross-account sharing | Share governed catalog data without copying |

---

## 2. Keyword → service trigger table (Domain 4 additions + full-repo highlights)

| Trigger phrase | Answer |
|---|---|
| Analysts see all columns except SSN/salary | Lake Formation column-level permissions |
| Each region's team sees only their rows | Lake Formation row-level filter |
| Tag-based access at scale, many tables | Lake Formation LF-Tags (TBAC) |
| Share catalog data cross-account | Lake Formation + AWS RAM |
| Find PII in S3 buckets | Amazon Macie |
| Auto-rotate database credentials | Secrets Manager |
| Store config values, cheapest | SSM Parameter Store |
| Customer-controlled key rotation and audit | KMS customer-managed key |
| Reduce KMS API costs on S3 | S3 Bucket Keys |
| Private S3 access from VPC, no NAT, no cost | Gateway VPC endpoint |
| Private access to Kinesis/Glue/Redshift | Interface endpoint (PrivateLink) |
| Who read this object and when | CloudTrail data events |
| Who changed this Glue job | CloudTrail management events |
| Detect non-compliant configuration | AWS Config |
| Temporary cross-account access | IAM role + `sts:AssumeRole` |
| Share encrypted data with a partner account | CMK with a key policy granting that account |
| Regulators require auditable key usage | SSE-KMS with a customer-managed key |
| Explicit deny anywhere in the chain | Always wins — denied, full stop |

---

## 3. Top exam traps — full Domain 4 set (highest priority right now)

1. **Setup:** "Analysts may see all columns except `ssn` and `salary`." → **Wrong:** a carefully scoped IAM policy. → **Right:** Lake Formation column-level permissions. IAM has no concept of a column.
2. **Setup:** "Glue job gets `AccessDenied` on S3; IAM role has `s3:GetObject`, bucket policy allows the role." → **Wrong:** add more S3 permissions. → **Right:** grant `kms:Decrypt` in the **KMS key policy**. Most-tested Domain 4 scenario.
3. **Setup:** "Share encrypted S3 data with a partner account." → **Wrong:** SSE-KMS with the AWS-managed `aws/s3` key. → **Right:** SSE-KMS with a customer-managed key whose policy grants the partner account. AWS-managed keys can't be shared cross-account.
4. **Setup:** "Determine which user downloaded a specific S3 object." → **Wrong:** check CloudTrail (already enabled). → **Right:** enable CloudTrail **data events** for that bucket — off by default.
5. **Setup:** "Store 500 app config values as cheaply as possible." → **Wrong:** Secrets Manager. → **Right:** SSM Parameter Store Standard (free). Secrets Manager earns its cost only via automatic rotation or cross-account resource policies.
6. **Setup:** "Private access to S3 from a VPC at no additional cost." → **Wrong:** Interface endpoint. → **Right:** Gateway endpoint. Gateway = S3/DynamoDB only, free; Interface = everything else, billed.

---

## 4. Mnemonics recap

| Mnemonic | For |
|---|---|
| **"Deny Stops Really Powerful Session Identities"** | IAM evaluation order: Deny → SCP → Resource → Permission boundary → Session → Identity |
| **Lake Formation = the lifeguard deciding which columns you may swim in** | Sub-table permission model |
| **Macie finds All Confidential Information Everywhere** | PII discovery, not rule validation |
| **"I Been Kicked Loose, Seriously"** | S3 403 order: IAM → Bucket policy → KMS → Lake Formation → SCP |
| **Rotation → Secrets Manager, Cost → Parameter Store** | The one-line tiebreaker |
| **Gateway = free, S3/DynamoDB only; Interface = paid, everything else** | VPC endpoint split |

---

## 5. Self-test — rapid fire (16)

| # | Question | Answer |
|---|---|---|
| 1 | Recite the IAM evaluation order in one breath. | Explicit deny → SCP → resource policy → permission boundary → session policy → identity policy → implicit deny |
| 2 | Why can't IAM do column-level security? | It operates at bucket/prefix/API-action granularity only |
| 3 | Six things to check on an S3 403, in order? | IAM → bucket policy → KMS key policy → Lake Formation → SCP (→ VPC endpoint policy) |
| 4 | When do you need a customer-managed KMS key? | Cross-account access, custom rotation control, full audit trail |
| 5 | Secrets Manager vs Parameter Store — one-line rule? | Rotation needed → Secrets Manager; cost-sensitive → Parameter Store |
| 6 | Which VPC endpoints are free, and for what? | Gateway endpoints, for S3 and DynamoDB only |
| 7 | Why won't CloudTrail alone tell you who read an object? | Object reads are data events, off by default |
| 8 | What does Macie do that Glue Data Quality doesn't? | Discovers/classifies sensitive data (PII), vs validating business rules |
| 9 | LF-Tags answer which kind of question? | Tag-based access across many tables at scale |
| 10 | What tool converts schemas/stored procedures during a heterogeneous migration? | SCT, not DMS |
| 11 | What single fact rules out SSE-S3 for a compliance requirement? | No CloudTrail audit trail of key usage, no customer-controlled rotation |
| 12 | Sub-second BI query response, hundreds of concurrent users — which engine? | Redshift, not Athena |
| 13 | Fix for a rising `IteratorAge`? | Scale consumers / use EFO — it's a consumer-side lag problem |
| 14 | What's the DMS mode for a minimal-downtime migration? | Full load + CDC |
| 15 | Why does Glue Streaming cost more than expected for once-daily data? | It runs (and bills) continuously regardless of arrival frequency |
| 16 | GDPR row deletion on a data lake — Hive or Iceberg? | Iceberg — native row-level DELETE, no partition rewrite |
