# Athena vs Redshift (vs Spectrum)

> Domain 1 (Ingestion) picks how data arrives. Domain 2 (Data Store
> Management) covers Redshift's internals in full. **This file answers
> one narrow question the exam asks constantly: given a SQL analytics
> requirement, which engine reads the data?**

---

## 1. ELI12

Imagine a library.

**Athena** is you, walking into the library, pulling books off shelves
yourself, reading exactly the pages you need, and leaving. You pay a
small fee per page you actually flip through. No membership, no desk
reserved for you — but if 500 people show up at once and everyone's
grabbing books from the same shelf, things get slow and the librarian
starts making people wait in line.

**Redshift** is a private research room you rent. You pay for the room
whether you use it or not (unless you get the "pay only when the light's
on" version — Serverless). But once you're in there, the room is
organized *for you*: your books are already sorted, indexed, and
cross-referenced, so ten people can work in that room at once without
tripping over each other, and the librarian (WLM / concurrency scaling)
actively manages who gets priority.

**Spectrum** is that same private room, except it has a window that lets
you also read books stored in the public library next door (S3) — but
only if you already rented the room.

The exam question is never really "where does the data live." It is
**"how many people are going to hammer this with queries, and how fast
does each one need to come back?"**

---

## 2. The comparison matrix

| Attribute | **Athena** | **Redshift (provisioned)** | **Redshift Serverless** | **Redshift Spectrum** |
|---|---|---|---|---|
| **Purpose** | Ad-hoc, serverless SQL directly on S3 | MPP data warehouse, always-on cluster | MPP data warehouse, no capacity planning | Query S3 *from* an existing Redshift cluster |
| **Speed / latency** | Seconds to minutes (cold queries slower) | **Sub-second to seconds** — data lives in fast columnar storage on the cluster | Sub-second to seconds once warmed; cold start adds latency after auto-pause | Seconds — bottlenecked by S3 scan, not cluster speed |
| **Cost model** | **~$5 per TB scanned**, 10 MB minimum per query | Node-hours (On-Demand or Reserved Instances) | **RPU-hours**, scales to zero | ~$5 per TB scanned, **plus** the underlying cluster's node-hours |
| **Serverless** | ✅ Always | ❌ Never | ✅ Always | ⚠️ The *query* is serverless-priced, but it needs a live cluster |
| **Concurrency behavior** | Quota-limited — roughly 20–25 concurrent DML queries per workgroup by default; queries **queue and slow down**, don't crash | High, and **concurrency scaling** spins up transient clusters automatically during bursts (1 free hour/day/cluster) | Auto-scales RPUs to absorb concurrent load | Inherits whatever concurrency the parent cluster has |
| **Streaming support** | ❌ (batch query engine; can query Iceberg tables kept fresh by others) | ⚠️ Materialized views can refresh from streaming sources | Same as provisioned | ❌ |
| **Batch support** | ✅ Core use case | ✅ | ✅ | ✅ |
| **Data volume** | Petabytes (S3 has no practical ceiling) | Petabytes with RA3 nodes + Redshift Managed Storage | Petabytes | Petabytes (bounded by S3, not cluster disk) |
| **Idle cost** | **Zero** — pay only per query | High — nodes bill whether queried or not (unless paused) | **Zero** — auto-pauses, resumes on next query | Cluster cost persists even if Spectrum isn't used that hour |
| **ACID / updates** | ✅ only via **Apache Iceberg** tables; plain Hive-style S3 tables are read-only/append | ✅ Native UPDATE/DELETE/MERGE | ✅ Native | ❌ Read-only against S3 |
| **Scaling** | Fully automatic and invisible — AWS adds workers behind the scenes | Elastic resize / classic resize + concurrency scaling (manual or policy-triggered) | Automatic RPU scaling, no admin action | Scales with the parent cluster |
| **Monitoring** | Query history, `DataScannedInBytes`, `QueryQueueTime` | `WLMQueueLength`, `WLMQueueWaitTime`, STL/SVL system tables, `PercentageDiskSpaceUsed` | RPU utilization, query queue metrics | Spectrum-specific scan-byte metrics + cluster metrics |
| **Security** | IAM, Lake Formation, workgroup data-usage controls, KMS | IAM/DB users, row-level security, column masking, KMS, VPC | Same as provisioned | Inherits Lake Formation + IAM on the external schema |
| **Best use case** | Exploratory analysis, occasional reports, log/S3-native data, "pay only for what you scan" | Recurring BI, hundreds of concurrent analysts, complex multi-table joins, sub-second dashboards | Spiky/unpredictable warehouse usage, dev/test warehouses, new workloads with unknown shape | A Redshift shop that wants to join hot warehouse tables against a cold S3 archive without duplicating data |
| **When NOT to use** | High-concurrency dashboards; sub-second SLA at scale; frequent repeated identical queries (no result cache like a warehouse's) | Rare/unpredictable querying (idle node cost is wasted money) | Steady, 24/7, predictable heavy load (Reserved Instance provisioned Redshift is cheaper at that point) | No Redshift cluster exists yet — don't stand one up just to get Spectrum |
| **Exam favorite** | "pay only for what you query," "no infrastructure to manage," "data already sits in S3" | "hundreds of BI users," "sub-second dashboard refresh," "complex joins across many tables" | "unpredictable," "spiky," "dev/test," "pause when idle" | "join current warehouse data with historical S3 archive" |

---

## 3. Decision tree

```
┌──────────────────────────────────────────────────────────────────┐
│ START: SQL analytics is needed. Where does the workload live,    │
│ and how is it queried?                                           │
└───────────────────────────────┬──────────────────────────────────┘
                                 │
                 Does a Redshift cluster ALREADY exist,
                 and does the question want a join between
                 warehouse tables and data sitting in S3?
                                 │
                ┌────────────────┴────────────────┐
               YES                                NO
                │                                   │
          ┌─────▼─────┐              Is querying OCCASIONAL / EXPLORATORY /
          │ SPECTRUM  │              UNPREDICTABLE, with data already in S3
          │ (join hot │              or an S3-backed catalog (Iceberg)?
          │  + cold)  │                              │
          └───────────┘              ┌────────────────┴────────────────┐
                                     YES                                NO
                                      │                                  │
                                ┌─────▼─────┐         Is usage STEADY, PREDICTABLE,
                                │  ATHENA   │         24/7, high volume — the kind
                                │ (pay per  │         Reserved Instances make cheap?
                                │  query)   │                         │
                                └───────────┘         ┌────────────────┴────────────────┐
                                                      YES                                NO
                                                       │                                  │
                                          ┌────────────▼───────────┐   ┌──────────────────▼──────────────────┐
                                          │  REDSHIFT PROVISIONED  │   │      REDSHIFT SERVERLESS             │
                                          │  (+ Reserved Instances)│   │  (spiky, unpredictable, dev/test,    │
                                          │  hundreds of BI users, │   │   new workload — no capacity         │
                                          │  sub-second dashboards │   │   planning, scales to zero)          │
                                          └─────────────────────────┘   └───────────────────────────────────┘

⚠️ NOTE: "Data is in S3" alone routes you to the Athena branch by
default. It is overridden the instant the stem adds a concurrency or
latency signal — "500 concurrent analysts," "dashboards refresh every
15 seconds," "sub-second SLA." Those phrases move you across to the
Redshift branch even though the data still lives in S3 (via Spectrum
or by loading it in).
```

---

## 4. Worked scenarios

**Scenario A — Marketing team runs ad-hoc reports twice a month.**
Data lands in S3 as Parquet, partitioned by date. Nobody else touches
it between reports. *Winner: Athena.* Idle cost is zero, no cluster to
patch or resize, and $5/TB scanned on infrequent queries against
partitioned/compressed Parquet is trivially cheap. Standing up Redshift
for twice-monthly access would mean paying for node-hours 29 days a
month for nothing.

**Scenario B — 300 analysts hit a BI dashboard that refreshes every 60
seconds during business hours, 9am–6pm, then goes quiet overnight.**
*Winner: Redshift Serverless.* Provisioned Redshift would need to be
sized for peak (300 concurrent) and then sit half-idle overnight, and
Athena's DML concurrency quota (~20–25) would cause dashboards to queue
and time out at 300 concurrent users. Serverless absorbs the daytime
spike with RPU auto-scaling and auto-pauses (or drops to base capacity)
overnight — you don't pay 24/7 node-hours for a workload that's only
"on" 9 hours a day.

**Scenario C — An existing provisioned Redshift cluster holds 2 years
of "hot" sales data. Finance wants a single query joining this year's
data in Redshift against 8 years of historical Parquet archives sitting
in S3, without duplicating 8 years of data into the cluster.**
*Winner: Redshift Spectrum.* The cluster already exists, so there's no
new infrastructure decision — Spectrum's external schema over the S3
archive lets one SQL statement join `redshift_table JOIN
spectrum_external_table` without an ETL job to copy the archive in.
Athena could query the S3 side alone but cannot join against live
warehouse tables in the same statement.

**Scenario D — A logistics company runs the exact same warehouse
workload 24/7/365: hourly ETL loads, constant BI traffic, predictable
volume that has been stable for two years, and finance wants the lowest
possible steady-state cost.** *Winner: Redshift provisioned + Reserved
Instances.* Once usage is steady and known, RIs cut node cost by up to
~75% versus On-Demand — cheaper over a year than paying per-RPU-hour or
per-TB-scanned for the same constant volume. Serverless's premium for
elasticity isn't worth paying when there's no elasticity to exploit.

---

## 5. Exam traps

| Trap | What AWS wants you to notice |
|---|---|
| **"Data is in S3" ⇒ reflex-pick Athena** | Wrong the moment concurrency/latency language appears ("hundreds of users," "sub-second," "dashboards"). Location does not decide this; **access pattern** does. |
| **Athena "has no infrastructure" ⇒ always cheapest** | Not true at high, repeated, identical query volume — a warehouse with materialized views/result caching can end up cheaper than re-scanning the same TBs from S3 over and over. |
| **Spectrum picked when no Redshift cluster exists** | Spectrum requires an existing cluster. If the scenario has no Redshift yet and just wants to query S3, that's plain Athena, not "stand up Redshift just to add Spectrum." |
| **Ignoring file format/partitioning when comparing Athena cost** | An unpartitioned CSV table scanned with Athena can cost 10–50x more than the same data as partitioned, compressed Parquet. The "Athena is expensive here" trap answer is usually solved by fixing the data layout, not by switching to Redshift. |
| **Redshift Serverless vs Provisioned decided by "serverless" keyword alone** | "Least operational overhead" pulls toward Serverless, but a steady 24/7 workload with "most cost-effective" as the binding constraint pulls back to Provisioned + RIs. Read both constraints. |
| **Forgetting Athena's DML concurrency quota** | Athena is not infinitely concurrent. ~20–25 concurrent DML queries per workgroup by default (increasable via support ticket, but the exam treats it as a real limit) — this is the number that disqualifies Athena in high-concurrency stems. |
| **Assuming Athena can UPDATE/DELETE any S3 table** | Only true for **Iceberg**-format tables. A plain Hive-style/Parquet table queried through Athena is effectively read/append-only — no row-level mutation. |
| **Confusing Spectrum's pricing with "free because it's Redshift"** | Spectrum still charges ~$5/TB scanned on top of the cluster's node-hours. It's not a free feature bolted onto Redshift. |

---

## 6. Real-company examples

**Athena side — Netflix (ad-hoc/exploratory analytics on S3).** Netflix
historically used Presto/Athena-style engines to let data scientists run
one-off exploratory SQL directly against S3-resident event data without
provisioning a warehouse for every team that wants to poke at raw logs
occasionally.

**Redshift side — a large retail bank's regulatory reporting
warehouse.** Hundreds of internal analysts run scheduled and ad-hoc
reports against a curated, always-available warehouse with row-level
security so each business unit sees only its own transactions —
exactly the "many concurrent users, complex joins, predictable steady
load" profile that justifies a provisioned cluster with Reserved
Instances rather than pay-per-scan querying.

---

## 7. Practice questions (12)

**Q1.** A startup ingests clickstream data into S3 as Parquet,
partitioned by date. A single data analyst runs occasional exploratory
queries once or twice a week. Which is the most cost-effective solution?

- A. Redshift provisioned cluster — ✗ Node-hours run 24/7 regardless of how rarely it's queried; wasteful for weekly use.
- B. Redshift Serverless — ✗ Works, but still adds RPU billing complexity and a warehouse layer for a workload that's a single analyst running occasional queries — Athena is simpler and cheaper.
- C. **Athena — ✓** Zero idle cost, pay per query, and the data is already partitioned Parquet in S3 — ideal fit.
- D. Redshift Spectrum — ✗ Requires a Redshift cluster to exist first; there's no reason to stand one up here.

**Q2.** A dashboard used by 400 concurrent business users refreshes
every 30 seconds and requires sub-second response times. Data currently
lives in S3. What should be used?

- A. Athena — ✗ ~20-25 concurrent DML query quota makes 400 concurrent users queue badly; not sub-second at this scale.
- B. **Redshift (provisioned or Serverless, sized for the load) — ✓** Built for high-concurrency, low-latency BI; concurrency scaling/RPU auto-scale absorbs the load.
- C. Redshift Spectrum without loading data into the cluster — ✗ Spectrum scan speed is bounded by S3, not built for sub-second dashboard SLAs at this concurrency.
- D. S3 Select — ✗ Not a warehouse or multi-table query engine; wrong tool entirely.

**Q3.** A company already runs a provisioned Redshift cluster holding
18 months of transaction data. They need one query joining that data
against 6 years of older data archived as Parquet in S3, without
duplicating the archive into the cluster. Best approach?

- A. Athena Federated Query against Redshift — ✗ Possible in theory but not the native, purpose-built path when Redshift already exists; Spectrum is designed exactly for this join.
- B. **Redshift Spectrum with an external schema over the S3 archive — ✓** Purpose-built for joining warehouse tables to S3 data with no duplication.
- C. Load all 6 years into the cluster via COPY — ✗ Duplicates data, increases storage cost and cluster size for data rarely queried in full.
- D. Export the Redshift table to S3 and query both with Athena — ✗ Extra unneeded pipeline; loses the "no duplication, single query" simplicity Spectrum gives for free.

**Q4.** A logistics company has run the same steady, predictable
warehouse workload 24/7 for two years. Finance wants the lowest
possible ongoing cost. What should they use?

- A. Redshift Serverless — ✗ Pays a premium for elasticity that isn't needed when load is already steady and predictable.
- B. Athena — ✗ Wrong shape entirely; this is a recurring high-volume warehouse workload, not ad-hoc querying.
- C. **Redshift provisioned with Reserved Instances — ✓** RIs cut node cost up to ~75% for known, steady, long-term usage — the cheapest option here.
- D. Redshift On-Demand provisioned — ✗ Works but leaves ~75% savings on the table versus RIs for a workload known to be steady.

**Q5.** Which factor most determines the Athena-vs-Redshift choice on
the exam?

- A. Where the data is physically stored — ✗ Common trap; both can query data that lives in S3.
- B. **The query concurrency and latency requirement — ✓** This is the actual decider per AWS's own framing.
- C. Whether the data is structured or semi-structured — ✗ Both handle structured/semi-structured data; not the differentiator.
- D. Whether the company already uses SQL — ✗ Irrelevant; both are SQL engines.

**Q6.** A team wants to run UPDATE and DELETE statements against
tables stored in S3, queried via Athena, to satisfy GDPR
right-to-be-forgotten requests. What must be true of the table format?

- A. Plain Hive-style partitioned Parquet — ✗ No row-level mutation support; would require rewriting whole partitions.
- B. **The table must be in Apache Iceberg format — ✓** Only Iceberg (or another open table format) gives Athena row-level DELETE/UPDATE/MERGE on S3 data.
- C. CSV with versioning enabled on the bucket — ✗ Versioning protects objects, it doesn't enable SQL row-level mutation.
- D. Any format, as long as workgroup settings allow DML — ✗ Workgroup settings don't grant a capability the underlying table format doesn't support.

**Q7.** A workload is unpredictable — some days near-zero queries, some
days heavy BI usage for a few hours — and the team wants to avoid
capacity planning entirely. Best fit?

- A. Redshift provisioned, sized for peak — ✗ Means paying for peak capacity even on near-zero days; the opposite of what's wanted.
- B. **Redshift Serverless — ✓** Auto-scales RPUs to match load and drops to near-zero cost when idle; no capacity planning.
- C. Athena only — ✗ Works for the near-zero days but struggles with "heavy BI usage" concurrency during spikes.
- D. Reserved Instance provisioned Redshift — ✗ RIs assume predictable steady usage; this workload is explicitly unpredictable.

**Q8.** Why can Athena queries against an unpartitioned, uncompressed
CSV dataset become surprisingly expensive?

- A. Athena charges more per TB for CSV than Parquet — ✗ The per-TB rate is the same; the difference is how many TB get scanned.
- B. **Athena bills per TB scanned, and CSV/no-partitioning forces full-dataset scans on every query — ✓** Correct mechanism: no partition pruning, no columnar pruning, no compression savings.
- C. CSV files are not supported by Athena and trigger error retries that are billed — ✗ CSV is supported; the cost issue is scan volume, not errors.
- D. Athena requires a Glue crawler run before every query, which is billed separately — ✗ Crawler runs are separate and not required per query.

**Q9.** A Redshift Serverless workgroup consistently shows RPU usage
maxed out with queries queuing during business hours every single day,
predictably, for the last six months. What's the most cost-effective
next step?

- A. Increase the max RPU ceiling and leave it Serverless — ✗ Works operationally but likely costs more long-term than committing to provisioned capacity for a now-predictable load.
- B. **Migrate to Redshift provisioned with Reserved Instances sized to the observed steady peak — ✓** Once a "Serverless" workload has proven to be steady and predictable, RIs are the cost-effective move.
- C. Split the workload across multiple Serverless workgroups — ✗ Adds complexity without addressing the underlying steady-demand cost profile.
- D. Move the workload to Athena — ✗ Athena's concurrency quota makes it a worse fit for a workload heavy enough to already be maxing out Serverless RPUs.
- E. (kept to preserve 4-option format above; not a real distinct 5th option)

**Q10.** A question states data must be queried "with the least
operational overhead, occasionally, directly from S3, with no
infrastructure to provision." Which service and why?

- A. **Athena — ✓** Serverless by definition, zero infrastructure, matches "occasionally" and "least operational overhead" exactly.
- B. Redshift provisioned — ✗ Requires provisioning and managing cluster infrastructure; contradicts "no infrastructure."
- C. Redshift Spectrum — ✗ Still requires a Redshift cluster to exist, which is infrastructure to provision.
- D. EMR with Trino — ✗ Requires a cluster; far more operational overhead than Athena for occasional queries.

**Q11.** True or false: Redshift Spectrum data is stored on the
Redshift cluster's local disk.

- A. True — ✗ Incorrect; Spectrum queries data that stays in S3.
- B. **False — ✓** Spectrum queries S3 data in place through an external schema; it is not copied onto the cluster.
- C. True only for RA3 node types — ✗ RA3 changes local caching behavior for Redshift-managed storage, but Spectrum data specifically still lives in S3, not copied to cluster disk.
- D. True only if AUTO WLM is enabled — ✗ WLM controls query queuing/priority, unrelated to where Spectrum data physically resides.

**Q12.** A finance team needs sub-second response times for a
dashboard queried by 50 concurrent users nightly for two hours, then
zero traffic for the other 22 hours. Which minimizes cost while meeting
the latency requirement?

- A. Redshift provisioned, always on — ✗ Pays for 24 hours of node time to serve 2 hours of actual traffic.
- B. **Redshift Serverless — ✓** Meets sub-second latency once active and auto-pauses/scales down during the 22 idle hours, avoiding wasted cost.
- C. Athena — ✗ Sub-second SLA at 50 concurrent users is achievable but riskier against Athena's DML concurrency quota and cold-query latency variance than a warehouse built for this.
- D. Redshift Spectrum — ✗ No existing cluster mentioned, and Spectrum doesn't solve the idle-cost problem on its own; still needs an active cluster.
