# Banking / Financial Services Architecture

> Core banking transactions + sub-second fraud detection + regulatory
> reporting. Built from the same service vocabulary as the rest of this
> repo — see `00-START-HERE/SERVICE-SELECTION-MATRIX.md` Part 0 for how
> exam questions are assembled from scenario → requirement → constraint,
> and `01-domains/DOMAIN-1-DATA-INGESTION.md` for the bronze/silver/gold
> pattern this diagram is built on.

## CONTENTS

1. [Business context](#context)
2. [End-to-end architecture](#architecture)
3. [Service-by-service rationale](#rationale)
4. [Security and governance — PCI-DSS, SOX, GLBA, BSA/AML](#security)
5. [Scaling at 10x and 100x](#scaling)
6. [Failure scenarios](#failure)
7. [Cost drivers and optimization](#cost)
8. [Real-company parallel](#company)
9. [Exam traps specific to banking scenarios](#traps)
10. [Practice questions](#questions)

---

<a name="context"></a>
## 1. Business context

A retail/commercial bank's data estate is a split personality. On one
side sits the **system of record** — a core banking platform, often a
40-year-old mainframe running DB2 or an Oracle-based ledger — where the
absolute truth about every account balance and posted transaction
lives. This system is slow to change, expensive to touch, and nobody
gets to modify its application code just to add a data feed. On the
other side sits a torrent of **real-time transaction events**: card
swipes at a point of sale, ATM withdrawals, mobile P2P transfers, ACH
credits, and wire initiations, arriving continuously and requiring a
fraud opinion in **milliseconds**, not minutes, because the transaction
is still in flight at the payment network waiting for an authorization
response. A large regional bank sees tens of millions of transactions a
day; a top-10 national bank sees hundreds of millions. The two halves
have to reconcile to the penny every night, because unlike almost any
other industry in this repo, banking has a hard, unforgiving batch
constraint sitting alongside its real-time one: **end-of-day close**.
The general ledger must balance, and every discrepancy is an audit
finding, not a rounding error to shrug off.

Regulatory pressure shapes nearly every architectural decision here.
**PCI-DSS** governs anywhere a Primary Account Number (PAN) is stored,
processed, or transmitted, and pushes hard toward tokenization,
field-level encryption, and network segmentation — a PAN sitting
unmasked in an analytics table that 200 people can query is an
automatic audit failure. **SOX** requires that financial reporting data
be immutable, attributable to a change, and retained for years, which
is why the raw zone in this architecture is never edited in place.
**BSA/AML** (Bank Secrecy Act / Anti-Money-Laundering) requires
suspicious-activity detection and Suspicious Activity Report (SAR)
filing, which needs both the real-time fraud path and a slower,
pattern-over-time analytics path looking at a customer's behavior
across weeks or months. **GLBA** governs the privacy of consumer
financial data broadly. None of these regulations care whether the
underlying compute is "cheap" — the exam's usual "least operational
overhead" lens is joined here by a second, equally weighted lens:
**auditability**. A banking-scenario question that offers a technically
elegant but unauditable answer is offering a wrong answer.

Latency requirements in banking are genuinely bimodal, and the exam
likes to test whether you notice this. **Authorization-time fraud
scoring** — the decision to approve or decline a card swipe as it
happens — has a latency budget measured in tens of milliseconds and
usually happens at the payment processor/network layer with an AWS-
hosted model behind a low-latency endpoint; it is not, in practice, an
architecture built around Athena or Redshift. **Post-authorization
stream scoring and case creation** — flagging a transaction that already
cleared as suspicious for a fraud analyst to review — has a budget of
seconds to low minutes, and this is squarely a Kinesis Data Streams +
Managed Service for Apache Flink pattern. **Regulatory and BI
reporting** — SAR generation, CCAR stress-test extracts, monthly board
reporting — has a budget of hours, and is squarely a Redshift/Athena
batch pattern. A single "banking" architecture question is really
asking you to place a stated requirement into one of these three
buckets before reaching for a service name.

---

<a name="architecture"></a>
## 2. End-to-end architecture

```
   SYSTEM OF RECORD                 CARD / PAYMENT NETWORK        ACH / WIRE FILES
 ┌───────────────────────┐        ┌────────────────────────┐   ┌─────────────────────┐
 │  Mainframe (DB2 z/OS)  │        │ Card swipes, ATM, P2P   │   │ NACHA / SWIFT batch │
 │  or Oracle core ledger │        │ mobile transfer events  │   │ files from partners  │
 └───────────┬────────────┘        └────────────┬────────────┘   └──────────┬───────────┘
             │ (1)                              │ (2)                       │ (3)
             v                                  v                           v
    AWS DMS (CDC mode)                Kinesis Data Streams           AWS Transfer Family
    + AWS SCT for schema          (partition key = account_id)         (SFTP endpoint)
             │                                  │                           │
             │                                  ├──────────────┐            │
             │                                  │              │            │
             │                                  v              v            │
             │                    Managed Service for      AWS Lambda       │
             │                    Apache Flink             (lightweight     │
             │                    (fraud feature calc,     rules engine,    │
             │                    windowed velocity         schema check)   │
             │                    checks, anomaly score)         │          │
             │                                  │              │            │
             │                                  v              v            │
             │                          SNS / EventBridge → fraud case      │
             │                          queue (SQS) → analyst tooling       │
             │                                  │                           │
             v                                  v                           v
 ┌──────────────────────────────────────────────────────────────────────────────────┐
 │                    RAW / BRONZE ZONE — Amazon S3, KMS CMK (SSE-KMS)               │
 │            Object Lock (compliance mode) — immutable, 7-year retention            │
 └───────────────────────────────────┬────────────────────────────────────────────--┘
                                      │ (4)
                          AWS Glue ETL / EMR (dedup, conform schema,
                          tokenize PAN, join fraud scores to transactions)
                                      │
                                      v
 ┌────────────────────────────────────────────────────────────────────────────────--┐
 │           CURATED / SILVER ZONE — Apache Iceberg tables on S3 (Parquet)           │
 │      Upsert/MERGE support for corrections, time travel for point-in-time audit    │
 └───────────────────────────────────┬────────────────────────────────────────────--┘
                                      │ (5)
                       Glue ETL (aggregation: daily positions,
                       AML pattern features, regulatory extracts)
                                      │
                                      v
 ┌────────────────────────────────────────────────────────────────────────────────--┐
 │                        GOLD / CONSUMPTION ZONE                                    │
 │   Redshift (regulatory reporting, CCAR, SAR extracts) · Athena (ad hoc            │
 │   investigation queries) · QuickSight (compliance dashboards, row-level security) │
 └────────────────────────────────────────────────────────────────────────────────--┘

        GOVERNANCE LAYER (wraps every zone above):
        Lake Formation (column-level masking on PAN/account number, LF-Tags
        by data sensitivity) ── Amazon Macie (continuous PII/PAN discovery
        scans on the bronze zone) ── AWS KMS CMK (envelope encryption,
        customer-controlled rotation) ── CloudTrail data events (every S3
        GetObject/PutObject logged, who read which transaction record) ──
        Secrets Manager (mainframe/DB credentials, auto-rotated)

        ORCHESTRATION LAYER (sequences batch + reconciliation):
        EventBridge (nightly schedule) ──▶ Step Functions (EOD close:
        wait for all source files, run reconciliation job, halt and page
        on-call if ledger doesn't balance) ──▶ SNS (failure alert)
```

**Arrow-by-arrow explanation:**

**(1) Mainframe/core ledger → AWS DMS (CDC mode), with AWS SCT for schema
conversion.** The mainframe is never modified to add producer code —
DMS reads the database's native change stream (or a log-based capture
mechanism for DB2 z/OS) and replicates inserts/updates/deletes
downstream with no application changes. SCT handles the schema
translation if the target curated schema differs structurally from the
mainframe's decades-old table design. This is a **CDC**, not full-load,
pattern — the bank cares about the continuous stream of changes, not a
one-time snapshot, though DMS also performs the initial full load to
seed history before switching to CDC.

**(2) Card/payment network → Kinesis Data Streams, partitioned by
account ID.** Real-time transaction events land in Kinesis because the
bank needs **replay** (a fraud model retrain needs to reprocess three
weeks of transactions), **multiple independent consumers** (the fraud
scorer and a separate real-time balance-check service both read the
same stream at their own pace), and **ordering per account** (partition
key = account ID ensures one customer's transactions are processed in
the order they occurred, which velocity-based fraud rules depend on).
Amazon Data Firehose is not used here — it has no replay and only one
destination, and this scenario needs both.

**(3) ACH/wire batch files → AWS Transfer Family.** Correspondent banks
and payment networks still deliver settlement files over SFTP by
contractual convention; Transfer Family provides a managed SFTP
endpoint backed by S3 without standing up and patching an EC2 SFTP
server.

**Fraud path (right side of the diagram):** Kinesis fans out to
**Managed Service for Apache Flink**, which computes windowed features
(transaction velocity over the last 5 minutes, deviation from typical
spend pattern, geolocation impossibility checks) and produces a fraud
score in near real time; and in parallel to **Lambda** for lightweight,
low-latency rule checks (blocklist match, hard transaction-amount
caps) that don't need windowing. A flagged transaction publishes to
**SNS/EventBridge**, which routes to an **SQS** queue feeding the fraud
analyst's case-management tool. This is the "post-authorization
scoring" bucket described in Section 1 — seconds-to-minutes latency,
not the sub-50-ms authorization-time decision, which typically lives
outside this AWS pipeline at the payment processor itself.

**(4) All three source paths → raw/bronze S3 zone, Object Lock
compliance mode, SSE-KMS with a customer-managed key.** Every path —
CDC, streaming, and batch file — converges on an S3 zone that is never
edited after write. Object Lock in compliance mode means **not even the
account root user** can delete or overwrite an object before its
retention date, which is the AWS control that directly satisfies SOX's
immutability requirement. From here, Glue ETL or EMR reads the raw
data, deduplicates (DMS and Kinesis are both at-least-once, so
downstream idempotency matters), conforms schema, and **tokenizes the
PAN** before it ever reaches a broadly-queryable table.

**(5) Bronze → silver (Iceberg) → gold.** The curated zone uses **Apache
Iceberg tables**, not plain Parquet, specifically because banking needs
two things plain Parquet-on-S3 doesn't give you: **MERGE/upsert**
support for late-arriving corrections (a reversed transaction, a
dispute adjustment) without rewriting whole partitions, and **time
travel**, which lets an auditor or examiner query "what did this
account's position look like as of close of business on March 3rd" —
a literal, recurring regulatory-examination request. A second Glue pass
aggregates into gold-zone tables — daily position summaries, AML
pattern-detection features — that Redshift and Athena serve to BI and
investigation tooling, with QuickSight providing dashboards to
compliance officers with row-level security so a regional compliance
officer sees only their region's cases.

---

<a name="rationale"></a>
## 3. Service-by-service rationale

| Layer | Service chosen | Why it won | Runner-up | Why the runner-up lost |
|---|---|---|---|---|
| Mainframe replication | **AWS DMS (CDC)** | Zero source-code changes; reads native change log; continuous | Custom nightly export/Glue JDBC extract | Full-table extracts don't scale to a ledger with billions of historical rows, and lose the "continuous, low-lag" requirement fraud/AML analytics need |
| Real-time transactions | **Kinesis Data Streams** | Replay (365-day retention), multiple independent consumers, per-account ordering | Amazon Data Firehose | No replay, single destination — fails both the fraud-consumer and balance-check-consumer requirements |
| Fraud feature computation | **Managed Service for Apache Flink** | Windowed aggregation (velocity over N minutes), exactly-once checkpointing, sub-second processing | Lambda per-record processing | Lambda can't hold state across a time window without external storage (DynamoDB) — reinventing what Flink does natively, at higher complexity |
| Batch settlement files | **AWS Transfer Family** | Managed SFTP, no server to patch, drops directly to S3 | Self-managed SFTP on EC2 | Standing infrastructure to patch and monitor for a function AWS now fully manages |
| Raw zone storage | **S3 + Object Lock (compliance mode) + SSE-KMS CMK** | Immutability satisfies SOX; CMK gives the bank rotation/audit control PCI-DSS expects | S3 with lifecycle-only retention | Lifecycle policies can be changed or deleted by an admin — compliance mode Object Lock cannot, which is the control an examiner is actually looking for |
| Curated zone format | **Apache Iceberg on S3** | MERGE for corrections, time travel for point-in-time audit queries | Plain Parquet + full-partition overwrite | No native upsert; a single disputed transaction correction would require rewriting an entire day's partition |
| Regulatory reporting | **Amazon Redshift** | Sub-second complex joins across large curated tables for hundreds of concurrent BI/compliance users | Athena | Athena degrades under high concurrency and sustained heavy-join BI workloads; Redshift is the right tool once usage moves from "occasional analyst query" to "always-on reporting platform" |
| Ad hoc investigation | **Amazon Athena** | Fraud analysts run one-off queries against the curated zone without provisioning anything | Redshift ad hoc query | Provisioning/reserving Redshift capacity for occasional, unpredictable investigator queries is wasted spend; Athena's pay-per-query model fits this access pattern exactly |
| PII/PAN discovery | **Amazon Macie** | Continuous, automated scanning of the S3 bronze zone for PAN/PII patterns, evidence for PCI-DSS audits | Manual data classification review | Doesn't scale to petabyte-scale transaction history and produces no continuous audit evidence trail |
| Column-level masking | **AWS Lake Formation** | Grants "see all columns except PAN/SSN" without duplicating tables or writing per-role views | IAM policies per table | IAM cannot express column-level or row-level grants — it's all-or-nothing at the table/S3-prefix level |
| Orchestration | **AWS Step Functions** | EOD close needs explicit branching (halt and page on-call if reconciliation fails) and visual auditability of the workflow | Amazon MWAA | No existing Airflow investment stated in this scenario — Step Functions is lower-ops for a workflow this shaped (wait-for-files → run job → branch on success/failure) |

---

<a name="security"></a>
## 4. Security and governance — PCI-DSS, SOX, GLBA, BSA/AML

| Requirement | Regulation | AWS control |
|---|---|---|
| PAN never stored in cleartext outside the tokenization boundary | PCI-DSS Req. 3 | Tokenize at the Glue ETL step before writing to curated zone; raw zone (which may briefly hold PAN) is KMS-encrypted and access-restricted to the ETL role only |
| Encryption at rest, customer-controlled keys | PCI-DSS Req. 3, GLBA | **SSE-KMS with a customer-managed CMK**, not SSE-S3 — the bank controls key rotation, can disable the key to instantly revoke all access, and gets CloudTrail-logged key usage |
| Encryption in transit | PCI-DSS Req. 4 | TLS enforced on all S3/Kinesis/Redshift endpoints via bucket/stream policies requiring `aws:SecureTransport` |
| Network segmentation — no cardholder data traverses the public internet | PCI-DSS Req. 1 | **Interface VPC endpoints (PrivateLink)** for Kinesis, Glue, Redshift; **Gateway VPC endpoint** for S3 — Glue jobs and analyst tooling never leave the AWS private network |
| Least-privilege, column-level access | PCI-DSS Req. 7, GLBA | **Lake Formation** column-level grants — a fraud analyst role sees transaction amount and merchant but not full PAN; a compliance officer role sees a masked PAN (last 4 digits) |
| Row-level regional segregation | GLBA, internal policy | **Lake Formation row-level filters** and **QuickSight row-level security** — a regional compliance team sees only their region's accounts |
| Immutable audit trail of every access to transaction data | SOX | **CloudTrail data events** on the S3 bronze/silver buckets — every `GetObject` is logged with principal, timestamp, and object key, satisfying "who read this record and when" |
| Immutable record retention (7 years) | SOX, BSA | **S3 Object Lock, compliance mode**, retention period set at write time; cannot be shortened or bypassed by any principal including the account root |
| Continuous discovery of unmasked PII/PAN | PCI-DSS, GLBA | **Amazon Macie** scheduled jobs against the bronze zone, alerting on any object containing PAN-pattern data outside the expected tokenization boundary |
| Credential hygiene for the mainframe/DB connection | PCI-DSS Req. 8 | **AWS Secrets Manager** with automatic rotation for the DMS source-endpoint credentials — never Parameter Store, because Parameter Store has no native rotation Lambda hook the way Secrets Manager does |
| Tag-based governance at scale (thousands of tables as the lake grows) | Internal governance | **Lake Formation LF-Tags (TBAC)** — tag tables `sensitivity=pci` once; every future table inheriting that tag automatically inherits the access policy, instead of re-granting per table |

⚠️ **Do not confuse "encrypted" with "compliant."** SSE-S3 encrypts at
rest but gives the bank no key-rotation control and no way to instantly
revoke access by disabling a key — PCI-DSS assessors specifically look
for customer-managed KMS keys on cardholder-data-adjacent storage.

---

<a name="scaling"></a>
## 5. Scaling considerations

**Baseline assumed:** ~50M transactions/day, ~500 GB/day raw ingest.

**At 10x (500M transactions/day, ~5 TB/day):**
- Kinesis Data Streams moves to **on-demand mode** (or careful shard
  planning if provisioned) to absorb the higher, spikier throughput
  around paydays and holidays without manual resharding.
- Managed Service for Apache Flink scales KPUs automatically, but the
  team must revisit **checkpoint interval** — more state (wider velocity
  windows across more accounts) means longer checkpoints, which can
  start to compete with processing throughput if left at defaults.
- Glue ETL jobs move from standard workers to **G.2X/G.4X** or an
  increased worker count; job bookmarks become essential to avoid
  reprocessing the full bronze zone nightly.
- Redshift moves toward **RA3 nodes with managed storage** (or Redshift
  Serverless with a higher base RPU floor) so compute and storage scale
  independently as the curated history grows into the tens of TB.

**At 100x (5B transactions/day, ~50 TB/day) — this is now a top-tier
global bank's volume:**
- Single-region Kinesis and Flink deployments become a genuine capacity
  planning exercise; multi-stream sharding **by business line or
  region** (retail cards vs. wire vs. commercial) replaces one giant
  stream, both for throughput and for blast-radius isolation.
- The curated Iceberg tables need **partition strategy revisited** —
  partitioning by `transaction_date` alone at this volume produces
  partitions too large for efficient pruning; a compound partition of
  `date + business_line` or `date + region` is added.
- EMR (Spark) increasingly replaces Glue ETL for the heaviest daily
  aggregation jobs, because at this scale the flexibility to tune
  Spark's shuffle behavior and use Spot for non-time-critical batch
  passes materially changes cost.
- Redshift becomes multi-cluster via **data sharing** — a producer
  cluster for the ETL/write path and multiple read-only consumer
  clusters for regional reporting teams, isolating heavy report
  generation from the ingestion pipeline's compute needs.
- Cross-region considerations appear for the first time — a global bank
  may need **regional data residency** (EU customer data processed and
  stored in `eu-*` regions only), which changes this from one pipeline
  into N regional pipelines with a federated reporting layer on top.

---

<a name="failure"></a>
## 6. Failure scenarios and tolerance

| Failure | Architecture's response |
|---|---|
| Fraud-scoring Flink application crashes mid-stream | Kinesis retains events for up to 365 days; Flink resumes from its last **checkpoint** with exactly-once semantics — no transactions are permanently missed, only delayed |
| DMS replication instance fails during mainframe CDC | DMS automatically resumes from the last committed change-log position on restart; the raw zone's immutability means no downstream corruption even if replication lagged for hours |
| A Glue ETL job that tokenizes PAN fails partway through a batch | **Job bookmarks** ensure the rerun only reprocesses the files it hadn't yet committed; the raw zone (untouched, immutable) is always available to safely reprocess from scratch if bookmarks need resetting |
| Downstream fraud case-management system is down for maintenance | SQS queue between EventBridge and the case tool absorbs the backlog; no fraud alert is dropped, only delayed until the consumer recovers |
| End-of-day reconciliation job finds the ledger doesn't balance | Step Functions branches to a **halt-and-page** state rather than silently completing — this is a deliberate design choice: an unreconciled ledger must stop the pipeline and wake a human, never auto-resolve |
| A single Availability Zone fails during business hours | Kinesis, MSK-if-used, RDS/Aurora metadata stores, and Redshift RA3 clusters are all deployed **Multi-AZ**; S3 is regionally redundant by default — the pipeline continues with no manual failover |
| A KMS CMK is accidentally disabled | All reads/writes against data encrypted with that key fail immediately and loudly (not silently) — this is treated as a **feature**, not a bug: it's the same mechanism used to deliberately revoke access during an incident, so alerting on `KMS.DisabledKey` events is standard operational practice, not an edge case to design around |

---

<a name="cost"></a>
## 7. Cost drivers and optimization levers

**Top cost drivers:**
1. **Kinesis shard-hours and Flink KPU-hours running 24/7** — this
   pipeline never idles; transactions arrive around the clock.
2. **Redshift cluster compute**, especially if sized for peak
   month-end/quarter-end reporting load but running at that size all
   month.
3. **KMS API call volume** on a high-object-count bronze zone, since
   every encrypted PUT/GET is a billed KMS operation at this scale.

**Optimization levers:**
- **Redshift Serverless or scheduled scaling** for the reporting
  workload — since regulatory reporting genuinely peaks at month-end and
  quarter-end, paying for always-on peak-sized compute the other 25
  days a month is the single largest avoidable cost in this
  architecture.
- **S3 Bucket Keys** to cut KMS API costs by up to ~99% on the
  high-object-count bronze zone — this is a pure cost lever with no
  security trade-off, since Bucket Keys still enforce the same CMK
  policy, just with fewer billed KMS calls per object.
- **Iceberg compaction jobs** scheduled during off-peak hours to keep
  the curated zone's file count low — an under-compacted Iceberg table
  at this transaction volume degrades both query cost (Athena/Redshift
  Spectrum scan more small files) and query latency.

---

<a name="company"></a>
## 8. Real-company parallel

This mirrors how large retail banks and card issuers architect fraud
and transaction analytics on AWS: a durable, replayable stream (Kinesis
or Kafka) absorbing authorization/settlement events, a stream-processing
layer computing behavioral features in near-real time, CDC out of a
legacy core-banking system of record via DMS rather than touching
mainframe application code, and a strict immutable-lake pattern
underneath everything to satisfy examiners who periodically ask for
point-in-time reconstructions of account activity. Capital One's
publicly discussed cloud-native banking architecture and major card
networks' real-time fraud pipelines follow this same shape: stream in,
score in near-real-time, land immutably, report on a schedule.

---

<a name="traps"></a>
## 9. Exam traps specific to banking scenarios

⚠️ **"Fraud detection" doesn't automatically mean Kinesis Data Streams
+ Flink.** If the scenario says the fraud decision must happen **before
the transaction is authorized** (sub-50-ms), that's outside what this
AWS pipeline typically owns at exam-testable depth — read carefully for
whether the scenario says "flag for review" (post-auth, Kinesis/Flink is
correct) versus "must approve or decline the transaction" (a much
tighter budget that the question is usually not actually testing via
Kinesis).

⚠️ **PCI-DSS scenarios that mention "least operational overhead" still
require Object Lock and CMK — don't let the overhead constraint talk
you into SSE-S3 or lifecycle-only retention.** Compliance requirements
are not overridden by a cost/ops constraint; they're a floor, not a
trade-off.

⚠️ **DMS CDC vs. full load.** "Continuously replicate the mainframe
ledger" = CDC. "One-time migration of historical account data to the
new lake" = full load. A question describing an ongoing feed with a
full-load-only answer is wrong, and vice versa — DMS supports both in
one task, so read for which one the scenario is actually asking about.

⚠️ **"Immutable" in a banking question almost always means S3 Object
Lock in compliance mode, not just versioning.** Versioning alone lets
an admin delete a version; compliance-mode Object Lock does not, even
for the root account, which is the specific property SOX-flavored
questions are testing.

⚠️ **Iceberg vs. plain Parquet.** If the scenario mentions correcting or
reversing a transaction, or reconstructing "what did this look like on
a specific date," that's a **time travel / row-level upsert** signal —
Iceberg, not plain Parquet with full-partition rewrites.

---

<a name="questions"></a>
## 10. Practice questions

**Q1.** A bank's core ledger runs on a DB2 mainframe that cannot be
modified. The bank needs a continuous feed of every ledger change into
its S3 data lake with minimal replication lag. What should it use?

- A. AWS Glue JDBC connection scheduled hourly — **Wrong.** JDBC extracts
  pull the current state on a schedule; they don't capture individual
  changes with low lag and would require re-querying the whole table
  repeatedly.
- B. **AWS DMS in CDC mode** — **Correct.** DMS reads the mainframe's
  native change log and streams changes continuously with no
  application-code changes to the mainframe.
- C. Kinesis Data Streams with a custom producer on the mainframe —
  **Wrong.** This requires writing and deploying new producer code onto
  the mainframe, which the scenario rules out.
- D. AWS Data Exchange — **Wrong.** Data Exchange delivers third-party
  licensed datasets, not internal database replication.

**Q2.** A fraud team needs a rolling 5-minute transaction-velocity
calculation per account, updated continuously, to flag suspicious
patterns within seconds. Which service computes this?

- A. Amazon Data Firehose with a Lambda transform — **Wrong.** Firehose
  buffers for delivery, not stateful windowed computation, and has no
  concept of a rolling time window across records.
- B. **Amazon Managed Service for Apache Flink** — **Correct.** Purpose-
  built for windowed, stateful stream processing with sub-second
  latency and exactly-once checkpointing.
- C. Amazon Athena scheduled every 5 minutes — **Wrong.** Athena queries
  data at rest; running it every 5 minutes against a constantly growing
  raw zone is high-latency, high-cost, and not "continuous."
- D. AWS Glue batch job on a 5-minute schedule — **Wrong.** Glue batch
  jobs have startup overhead measured in minutes themselves, making a
  5-minute cadence unreliable and not genuinely continuous.

**Q3.** An auditor requests to see exactly what a specific customer's
account balance looked like as of the close of business three months
ago. The curated zone must support this without maintaining separate
snapshot exports. What table format enables this?

- A. Plain Parquet files partitioned by date — **Wrong.** Reconstructing
  a point-in-time view requires manually locating and unioning the
  correct historical partitions; there's no built-in "as of" query.
- B. CSV files in S3 — **Wrong.** No transactional guarantees, no time
  travel, and poor query performance at scale.
- C. **Apache Iceberg tables** — **Correct.** Iceberg's snapshot model
  natively supports time-travel queries (`FOR SYSTEM_TIME AS OF`) against
  historical table states without separate exports.
- D. DynamoDB with point-in-time recovery — **Wrong.** PITR restores an
  entire table to a backup process, it isn't a queryable historical view
  for ad hoc auditor questions, and DynamoDB isn't the analytical store
  in this architecture.

**Q4.** A PCI-DSS assessor requires that the bank be able to instantly
and verifiably revoke all access to a specific dataset containing
tokenized card data, and requires customer-controlled key rotation.
Which encryption approach satisfies this?

- A. SSE-S3 (Amazon S3-managed keys) — **Wrong.** AWS manages the key
  entirely; the customer cannot rotate on their own schedule or
  instantly disable it to revoke access.
- B. **SSE-KMS with a customer-managed CMK** — **Correct.** The bank
  controls rotation policy and can disable the key to instantly cut off
  all access, with every use logged in CloudTrail.
- C. Client-side encryption with a hardcoded application key — **Wrong.**
  No centralized rotation, no audit trail, and key management becomes
  the bank's unmanaged problem.
- D. TLS in transit only, no encryption at rest — **Wrong.** PCI-DSS
  Requirement 3 explicitly requires cardholder-data-adjacent storage to
  be encrypted at rest, not just in transit.

**Q5.** The bank wants fraud analysts to query transaction data but must
prevent them from ever seeing the full PAN, while compliance officers
should see a masked version showing only the last 4 digits. What
enforces this without duplicating tables?

- A. Separate IAM policies per S3 prefix — **Wrong.** IAM can restrict
  access to whole objects/prefixes, not individual columns within a
  table.
- B. **AWS Lake Formation column-level permissions** — **Correct.**
  Grants and masking policies can be defined per column per principal
  without copying the underlying data.
- C. Two full copies of every table, one masked and one not — **Wrong.**
  Works but doubles storage and ETL cost, and is exactly the duplication
  the question says to avoid.
- D. Amazon Macie — **Wrong.** Macie discovers sensitive data; it does
  not enforce column-level access control.

**Q6.** During month-end close, Redshift query concurrency spikes 10x for
about three days, then returns to normal for the rest of the month.
Leadership wants to avoid paying for peak-sized compute the other 27
days. What should the architecture use?

- A. A permanently larger provisioned Redshift cluster — **Wrong.** Pays
  peak-sized cost every day of the month, which is exactly the waste
  leadership wants eliminated.
- B. **Redshift Serverless (or scheduled concurrency scaling)** —
  **Correct.** Scales compute to the workload automatically, so the bank
  pays for the 3-day spike without carrying that cost the other 27 days.
- C. Move all reporting to DynamoDB — **Wrong.** DynamoDB isn't suited to
  the complex multi-table joins regulatory reporting requires.
- D. Run reporting queries only through Kinesis Data Streams —
  **Wrong.** Kinesis is a streaming transport, not a query engine; it
  cannot execute SQL reporting queries at all.

**Q7.** A nightly end-of-day reconciliation job discovers the ledger
totals from the mainframe feed and the curated zone don't match. What
is the correct architectural behavior?

- A. Log a warning and continue the pipeline — **Wrong.** An unreconciled
  ledger is a critical financial-integrity failure, not a warning-level
  event; silently continuing risks reporting incorrect figures.
- B. **Halt the workflow in Step Functions and page an on-call
  engineer** — **Correct.** Financial reconciliation failures require
  human investigation before any downstream reporting proceeds; this is
  precisely what a Step Functions failure-branch + SNS alert is for.
- C. Automatically overwrite the curated zone with the mainframe's
  numbers — **Wrong.** Silently "fixing" a discrepancy destroys the
  audit trail of what actually happened and could paper over a real
  data-loss bug.
- D. Delete the day's raw zone data and restart ingestion — **Wrong.**
  The raw zone is immutable specifically so it is never the thing at
  fault or the thing discarded; the reconciliation logic, not the
  source data, should be investigated first.

**Q8.** The bank needs continuous, automated evidence for its PCI-DSS
audit that no unmasked PAN data exists outside the designated
tokenization boundary in the S3 data lake. What should it deploy?

- A. Annual manual review by the security team — **Wrong.** Doesn't scale
  to a petabyte-growing lake and produces no continuous audit trail
  between reviews.
- B. **Amazon Macie scheduled discovery jobs** — **Correct.** Macie uses
  managed data identifiers to continuously scan for PAN-shaped and other
  sensitive-data patterns across S3 and reports findings automatically.
- C. S3 server access logging — **Wrong.** Records who accessed objects,
  not what sensitive data those objects contain.
- D. AWS Config — **Wrong.** Config evaluates resource configuration
  compliance (e.g., "is encryption enabled"), not the content of data
  inside objects.

**Q9.** Correspondent banks deliver nightly ACH settlement files over
SFTP under a long-standing contractual arrangement that can't be
renegotiated to a modern API. What should receive these files with the
least operational overhead?

- A. A self-managed SFTP server on EC2 — **Wrong.** Requires patching,
  scaling, and securing an SFTP daemon — exactly the operational burden
  "least overhead" rules out.
- B. **AWS Transfer Family** — **Correct.** Fully managed SFTP/FTPS
  endpoint that writes directly to S3, with no server to operate.
- C. Amazon AppFlow — **Wrong.** AppFlow integrates with named SaaS
  applications (Salesforce, Zendesk, etc.), not arbitrary SFTP file
  drops from banking partners.
- D. AWS DataSync — **Wrong.** DataSync synchronizes file systems (NFS,
  SMB, on-prem storage) on a schedule; it isn't an SFTP-facing endpoint
  for external partners to push files to.

**Q10.** A regional compliance officer must only ever see fraud cases and
transaction data belonging to their own region, both in raw table
queries and in dashboards. What combination enforces this?

- A. Separate AWS accounts per region with manual cross-account review —
  **Wrong.** Massive operational overhead to maintain, and doesn't by
  itself enforce row-level filtering within a shared reporting layer.
- B. **Lake Formation row-level security on the curated tables, plus
  QuickSight row-level security on the dashboards** — **Correct.**
  Enforces the same regional filter consistently at both the query layer
  and the dashboard layer.
- C. Trust each analyst to filter their own queries by region —
  **Wrong.** Relies on user behavior rather than an enforced control;
  not an acceptable answer in any compliance-driven scenario.
- D. Store each region's data in a separate, unrelated S3 bucket with no
  shared catalog — **Wrong.** Technically isolates data but breaks the
  unified curated-zone/reporting model and doesn't scale as new regions
  are added; row-level security is the standard mechanism for this
  exact requirement.
