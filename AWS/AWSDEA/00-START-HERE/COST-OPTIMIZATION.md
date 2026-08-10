# Cost Optimization — Cross-Service Guide

> Cost-optimization questions are scattered across all four domains —
> they're rarely labeled "cost," they show up as "least expensive,"
> "reduce spend," "minimize cost while meeting X," or a scenario with a
> dollar figure attached. This file collects every cost lever from
> across the repo into one cross-referenced guide, plus a decision
> framework and 10 practice questions. For the underlying service
> mechanics, see `02-services/*.md` and the relevant `01-domains/DOMAIN-N-*.md`.

## CONTENTS

- [Part 1 — The house rule: "least operational overhead" beats "cheapest"](#p1)
- [Part 2 — Storage cost levers](#p2)
- [Part 3 — Compression and file format](#p3)
- [Part 4 — Partitioning to reduce scan cost](#p4)
- [Part 5 — Compute cost levers](#p5)
- [Part 6 — Provisioned vs Serverless economics](#p6)
- [Part 7 — Query-cost guardrails](#p7)
- [Part 8 — Data transfer and networking cost](#p8)
- [Part 9 — Reserved / Savings Plans vs on-demand](#p9)
- [Part 10 — Monitoring cost itself](#p10)
- [Part 11 — Decision framework: "is this workload cost-optimized?"](#p11)
- [Part 12 — 10 practice questions](#p12)

---

<a name="p1"></a>
## Part 1 — The house rule

**AWS's exam house style prefers "least operational overhead" over
"cheapest," when both appear as answer language.** A fully managed,
serverless option that costs slightly more per unit is usually the
intended answer over a self-managed option that's technically cheaper
at small scale. The exception: when the question is **explicitly and
only** about minimizing cost **at very large/petabyte scale**, where a
self-managed, Spot-heavy option (EMR + Spot task nodes) becomes the
correct, cheapest-per-TB answer.

Read every cost question for **which constraint is primary** — dollars,
ops burden, or both — before picking an answer. If the question stacks
"minimal management" and "lowest cost" together, lean serverless first;
if it stacks "petabyte-scale" and "lowest cost per TB," lean EMR/Spot.

---

<a name="p2"></a>
## Part 2 — Storage cost levers

| Lever | Mechanism | When it's the answer |
|---|---|---|
| **S3 storage class tiering** | Move data down the tier ladder as access frequency drops: Standard → Standard-IA → One Zone-IA → Glacier Instant Retrieval → Glacier Flexible Retrieval → Glacier Deep Archive | Access pattern is **known and predictable** (e.g., "logs older than 90 days are rarely read") |
| **S3 Intelligent-Tiering** | Automatic movement between access tiers based on observed usage, small monitoring fee | Access pattern is **unknown or unpredictable** — this is the differentiator vs. explicit lifecycle rules |
| **S3 Lifecycle policies** | Automated, rule-based transitions and expirations | Any time you can state the retention/transition schedule as a rule |
| **Glacier retrieval SLA trap** | Deep Archive = up to 12h retrieval; Flexible Retrieval has a **90-day minimum** storage duration | Disqualify a class immediately if the question states a retrieval-time SLA the class can't meet — cheaper-but-noncompliant is still wrong |
| **DynamoDB TTL** | Auto-expire items at zero write-capacity cost | Time-bound data (sessions, temp records) that should self-delete |
| **Redshift Managed Storage (RA3)** | Pay for storage separately from compute, storage auto-scales | Warehouses whose data volume grows faster than the compute they need |
| **EBS/EFS lifecycle** | Move infrequently accessed EFS data to EFS-IA automatically | Shared file storage with a large cold-data tail |

**Exam trap:** picking the cheapest storage class without checking the
stated retrieval-time or minimum-duration requirement is one of the
single most common ways a cost question is missed — the "right" answer
by price is often disqualified by an SLA constraint elsewhere in the
same sentence.

---

<a name="p3"></a>
## Part 3 — Compression and file format

Smaller data on disk means less to store, less to scan, less to shuffle
across the network during a join — compression and columnar formats are
a cost lever at every single layer of the stack, not just storage.

| Choice | Cost impact |
|---|---|
| **Parquet/ORC over CSV/JSON** | Columnar formats let query engines read only the columns needed — directly reduces Athena/Redshift Spectrum bytes-scanned billing |
| **Snappy** | Fast compress/decompress, moderate ratio, **splittable** — the default choice when write/read speed matters as much as size |
| **ZSTD** | Better compression ratio than Snappy at comparable speed — increasingly the modern default |
| **GZIP** | Higher ratio than Snappy, **not splittable** at the whole-file level in most engines — can hurt parallelism on large files |
| **BZIP2** | Highest ratio, slowest — rarely the right tradeoff for hot/frequently-queried data |

**Rule of thumb tested on the exam:** if a file format/compression
choice must remain **splittable** for parallel processing across many
Spark/Glue/EMR workers, GZIP is a trap answer — prefer Snappy, ZSTD, or
BZIP2 (splittable at the block level in Hadoop-ecosystem tools) over
plain GZIP on large files.

---

<a name="p4"></a>
## Part 4 — Partitioning to reduce scan cost

This is the single highest-leverage cost lever for query engines billed
by bytes scanned (Athena) or that benefit from scan pruning (Redshift
Spectrum, Glue, EMR).

- **Partition pruning** — partitioning by a commonly filtered column
  (date is the classic case) lets the query engine skip entire prefixes
  of S3 instead of scanning everything. This is *the* first lever to
  reach for before touching compute size.
- **Predicate pushdown** — filters applied at the storage/format layer
  (Parquet row-group statistics, zone maps in Redshift) instead of after
  data is pulled into compute — reduces both I/O and compute cost.
- **Partition projection (Athena)** — for tables with **millions of
  partitions**, computing partition values from a pattern instead of
  looking them up in the Glue Data Catalog avoids both the catalog
  lookup cost/latency **and** the operational cost of running
  `MSCK REPAIR TABLE` / crawlers to keep partitions in sync. This is the
  direct answer whenever a scenario says "too many partitions," "slow
  partition discovery," or "avoid crawler cost at scale."
- **The small-file problem, in reverse** — over-partitioning (e.g., by
  minute instead of by day) creates thousands of tiny files, which
  *increases* cost via S3 request overhead and per-file query engine
  overhead. Partitioning is a cost lever only when the partition
  granularity matches the query pattern — coarser is often cheaper.
- **CTAS to re-partition/reformat** — Athena `CREATE TABLE AS SELECT`
  rewrites a poorly formatted/partitioned table (e.g., raw CSV, no
  partitions) into partitioned Parquet in one pass — a one-time cost
  that pays for itself on every subsequent query.

---

<a name="p5"></a>
## Part 5 — Compute cost levers

### Relative transform-compute cost ordering (small-to-medium jobs)

```
Lambda (small, short jobs)  <  Glue (medium ETL, serverless Spark)  <  EMR (large cluster)

...EXCEPT at petabyte scale with Spot on task nodes, where EMR becomes
   the cheapest per-TB-processed option.
```

| Lever | Mechanism |
|---|---|
| **Spot instances on EMR task nodes only** | Task nodes hold no HDFS data and aren't the cluster coordinator — losing them to reclamation costs a retry, not the cluster. **Never** put Spot on the primary node; core nodes are risky (they hold HDFS data). Any answer offering "Spot for all node types" is wrong by construction. |
| **Glue Flex execution class** | Runs non-urgent, schedule-flexible jobs on spare capacity at a discount, with variable start time. Never the answer when an SLA/deadline is stated. |
| **Right-size Glue workers** | An undersized worker (G.1X on a job that needs G.2X) OOMs and retries — the retry cost usually exceeds what correct sizing would have cost the first time. Oversized workers just idle and waste money the other direction. |
| **Right-size Lambda memory** | Lambda memory scales CPU proportionally — under-provisioning can make a job run so long it costs *more* in duration-billed compute than a higher memory setting would; there's a real sweet spot, not "always pick the minimum." |
| **EMR Serverless** | Pay only for the vCPU/memory/duration actually used per job — no idle cluster cost, no instance-type decisions. |
| **Job bookmarks** | Reprocessing all historical data on every run (a disabled or reset-on-every-run bookmark) multiplies compute cost for no benefit — bookmarks ensure incremental jobs only process new data. |

---

<a name="p6"></a>
## Part 6 — Provisioned vs Serverless economics

| Service | Provisioned model | Serverless model | Economics rule of thumb |
|---|---|---|---|
| **Redshift** | Reserved/On-Demand nodes, pay for cluster 24/7 regardless of query load | **Redshift Serverless** — billed per **RPU-hour**, scales to zero when idle | Steady, high, predictable utilization → Provisioned + Reserved Instances (up to ~75% savings); spiky/unpredictable/dev-test → Serverless |
| **Aurora** | Provisioned instance classes, pay 24/7 | **Aurora Serverless v2** — fine-grained ACU scaling | Same steady-vs-spiky logic; Serverless v2 avoids paying for peak-sized capacity around the clock |
| **DynamoDB** | Provisioned capacity (RCU/WCU), can use Reserved Capacity for savings | **On-demand mode** — pay per request, no capacity planning | Predictable, steady traffic → Provisioned + Auto Scaling or Reserved Capacity; unpredictable/spiky/new workload → On-demand |
| **MSK** | Provisioned brokers, sized and paid for continuously | **MSK Serverless** — auto-scales, no broker sizing | Same logic; Serverless removes both the sizing exercise and the idle-capacity cost |
| **EMR** | Long-running cluster, sized for peak, often idles between jobs | **EMR Serverless** | Bursty/scheduled batch jobs favor Serverless; a cluster in near-constant use across many jobs can favor provisioned + Spot |

**The exam's general pattern:** "steady, predictable, high utilization"
→ **Provisioned + Reserved**. "Spiky, unpredictable, low/variable
utilization, or brand-new workload with unknown shape" → **Serverless**.
Don't let "Serverless is more modern" override this — provisioned with
reservations genuinely wins economically at sustained high utilization.

---

<a name="p7"></a>
## Part 7 — Query-cost guardrails

- **Athena workgroups — per-query data-scanned limits.** This is a
  direct **cost guardrail**, not just an organizational feature: a
  workgroup can cap the bytes scanned per query, preventing a single
  runaway query (e.g., an accidental full-table scan on an
  unpartitioned dataset) from generating a large bill. When a question
  says "prevent a single query from scanning excessive data" or
  "control Athena spend," the answer is a **workgroup query limit**,
  not "increase compute" (Athena has no provisioned compute to scale).
- **Partition projection** also functions as a cost guardrail
  indirectly — it prevents queries from needing to enumerate the whole
  partition space before filtering.
- **Materialized views (Redshift)** — pre-compute and cache an
  expensive, frequently repeated aggregate query so it doesn't re-scan
  and re-join the base tables on every execution.
- **Redshift concurrency scaling** — adds transient capacity during
  bursts of concurrent queries instead of permanently over-provisioning
  the cluster for peak concurrency that only happens occasionally.
- **CTAS / UNLOAD instead of repeated raw scans** — write query results
  back to S3 once in an efficient format, then let downstream consumers
  read the cheap, pre-computed result instead of re-running the
  expensive original query repeatedly.

---

<a name="p8"></a>
## Part 8 — Data transfer and networking cost

- **VPC Gateway Endpoints (S3, DynamoDB)** — free, and avoid NAT Gateway
  data-processing charges for traffic that would otherwise route through
  a NAT Gateway to reach S3/DynamoDB from a private subnet. If a
  scenario mentions "reduce NAT Gateway cost" and the destination is S3
  or DynamoDB, a gateway endpoint is the answer.
- **VPC Interface Endpoints (PrivateLink)** — not free (hourly + data
  processing charges), but still typically cheaper and more secure than
  routing through a NAT Gateway/Internet Gateway for other AWS service
  traffic (KMS, Secrets Manager, etc.).
- **Cross-AZ data transfer** — has a per-GB cost; co-locating tightly
  coupled compute and storage in the same AZ (where availability
  requirements allow) reduces it. This is a secondary lever — don't
  sacrifice required multi-AZ resiliency to chase this savings.
- **Cross-region replication (S3 CRR, cross-region backups)** — real,
  ongoing per-GB transfer cost; only replicate what compliance or DR
  genuinely requires, not everything by default.

---

<a name="p9"></a>
## Part 9 — Reserved / Savings Plans vs on-demand

| Commitment type | Best for | Discount ballpark |
|---|---|---|
| **Reserved Instances (Redshift, RDS/Aurora, EC2/EMR)** | Steady-state, long-running, predictable workloads | Up to ~75% vs on-demand for 1–3 year commitments |
| **Savings Plans (compute)** | Flexible commitment across instance families/services | Similar magnitude, more flexibility than RIs |
| **On-demand** | Short-lived, unpredictable, or experimental workloads | No discount, but no commitment risk |
| **Spot (EC2/EMR task nodes)** | Interruption-tolerant workloads only | Deepest discount, but can be reclaimed with short notice |

The exam rarely asks you to calculate exact percentages — it asks you
to **recognize the workload shape** (steady vs. spiky vs.
interruption-tolerant) and match it to the right commitment model.

---

<a name="p10"></a>
## Part 10 — Monitoring cost itself

- **AWS Cost Explorer** — visualize and analyze historical/forecasted
  spend by service, tag, or account.
- **AWS Budgets** — proactive alerts when spend or usage is forecast to
  exceed a threshold — the direct answer to "notify us before we
  overspend," as distinct from Cost Explorer's after-the-fact analysis.
- **Cost and Usage Report (CUR)** — the most granular, line-item billing
  data export, typically landed in S3 and queried with Athena/Redshift
  for detailed chargeback/showback analysis.
- **Tagging strategy** — cost allocation tags are the prerequisite for
  any of the above to attribute spend to a team, project, or pipeline;
  a question about "which team's pipeline is driving cost" assumes a
  tagging strategy is already in place.

---

<a name="p11"></a>
## Part 11 — Decision framework: "is this workload cost-optimized?"

Run every cost-scenario question through these questions, roughly in
order of typical exam impact:

1. **Is data in the cheapest storage class that still meets the stated
   access/latency/retrieval SLA?** (Not the cheapest class overall —
   the cheapest class that's still compliant.)
2. **Is the data compressed and in a columnar, splittable format** if
   it's ever queried by Athena/Redshift Spectrum/Glue/EMR?
3. **Is the data partitioned to match the actual query filter pattern**
   — not over-partitioned into small files, not under-partitioned into
   full scans?
4. **Is compute right-sized** — not so small it OOMs/retries, not so
   large it idles?
5. **Does the workload's traffic shape match its pricing model** —
   steady/predictable → provisioned + reserved; spiky/unpredictable →
   serverless/on-demand?
6. **Is there a guardrail against runaway cost** — Athena workgroup
   limits, Budgets alerts, Service Quotas?
7. **Is data transfer minimized** — gateway endpoints for S3/DynamoDB
   traffic, replication scoped to genuine requirements only?
8. **Is "least operational overhead" being weighed correctly against
   raw dollar cost** for the *stated* scale of the problem?

If a proposed architecture fails more than one of these, it is very
likely the "wrong" (distractor) answer choice, even if its sticker price
looks lower in isolation.

---

<a name="p12"></a>
## Part 12 — 10 practice questions

**Q1.** A company ingests clickstream data via Amazon Data Firehose and
lands it in S3 as JSON, queried occasionally by Athena. Athena costs
have grown sharply as data volume increased. What is the **most
cost-effective** change?

A. Increase the Athena workgroup's data-scanned limit
B. Convert the data to partitioned Parquet with Snappy compression via a CTAS query
C. Move the S3 bucket to a different region
D. Switch from Athena to Redshift Serverless

**Answer: B.** Columnar, compressed, partitioned data directly reduces
the bytes Athena scans per query, which is exactly how Athena is
billed. **A** increases the ceiling on spend, it doesn't reduce it.
**C** has no cost-scanning relationship to region. **D** introduces a
whole new service and its own costs without addressing the root cause
(unoptimized file format).

---

**Q2.** An EMR cluster processes a nightly batch job. The primary and
core nodes are on-demand; the team wants to cut cost without risking
job failure. What should they do?

A. Move the primary node to Spot
B. Move the core nodes to Spot
C. Add Spot task nodes for the parallelizable portion of the workload
D. Switch the entire cluster to Spot

**Answer: C.** Task nodes hold no HDFS data and aren't the cluster
coordinator — losing one to Spot reclamation just costs a retry. **A**
would risk killing the whole cluster if reclaimed. **B** risks losing
HDFS-resident data. **D** is the classic "Spot for all node types" trap
answer.

---

**Q3.** A team has 50,000 S3 partitions for a table queried daily by
Athena. Query startup latency is high and `MSCK REPAIR TABLE` runs take
a long time. What reduces both the latency and the operational cost?

A. Reduce the number of partitions by combining files
B. Enable Athena partition projection
C. Increase the Glue crawler schedule frequency
D. Move the table to Redshift

**Answer: B.** Partition projection computes partition values from a
pattern instead of a Glue Catalog lookup, eliminating the need for
`MSCK REPAIR`/crawler-based partition sync entirely at high partition
counts. **A** may help but doesn't address the catalog lookup
bottleneck directly. **C** makes the operational cost worse, not
better. **D** is a large architectural change not justified by this
specific problem.

---

**Q4.** A DynamoDB table has highly unpredictable traffic — some days
near zero, some days 50x normal — and the team is paying for
over-provisioned capacity most of the time. What is the most
cost-effective capacity mode?

A. Provisioned capacity with a high fixed RCU/WCU
B. Provisioned capacity with Reserved Capacity
C. On-demand capacity mode
D. Provisioned capacity with Auto Scaling set to a wide range

**Answer: C.** Unpredictable, highly spiky traffic is the textbook
on-demand use case — you pay only for what's consumed, with no capacity
planning. **A** and **B** assume steady/predictable usage, which this
isn't. **D** can work but still requires tuning scaling policies and
can lag sudden spikes; on-demand is the more direct, lower-overhead fix
for genuinely unpredictable load.

---

**Q5.** A Redshift cluster runs 24/7 with consistently high, predictable
utilization from BI dashboards. Finance wants to reduce the compute
bill without changing performance. What should the team do?

A. Switch to Redshift Serverless
B. Purchase Reserved Instances for the existing node type/count
C. Reduce the number of nodes
D. Move to Athena instead

**Answer: B.** Steady, predictable, high utilization is exactly the
case Reserved Instances are priced for — up to ~75% savings over
on-demand with no architecture change. **A** (Serverless) is the wrong
direction for steady/high utilization — RPU-hour billing is optimized
for spiky/variable load, not sustained 24/7 use. **C** risks a
performance regression that isn't asked for. **D** is an unjustified
architectural rewrite.

---

**Q6.** A Glue job processing a few GB nightly needs to run but has no
fixed deadline — it just needs to finish sometime before business
hours. What reduces cost with the least risk?

A. Switch the job to EMR
B. Use the Glue Flex execution class
C. Reduce the worker type to G.025X
D. Run the job with maximum parallelism

**Answer: B.** Glue Flex is built exactly for non-urgent,
schedule-flexible jobs — it runs on spare capacity at a discount. **A**
adds cluster management overhead for no benefit at this scale. **C**
risks OOM if G.025X (designed for low-volume streaming) is undersized
for a several-GB batch job. **D** increases cost without addressing the
actual lever (the job isn't time-constrained).

---

**Q7.** A company needs to retain compliance logs for 7 years, rarely
accessed, but must be retrievable within 12 hours if ever needed. What
is the most cost-effective S3 storage class?

A. S3 Standard-IA
B. S3 Glacier Instant Retrieval
C. S3 Glacier Flexible Retrieval
D. S3 Glacier Deep Archive

**Answer: D.** Deep Archive is the cheapest class and its retrieval SLA
(up to 12 hours) exactly matches the stated requirement. **A** and
**B** are far more expensive for data that's genuinely rarely accessed
with a lenient retrieval SLA. **C** (Flexible Retrieval) is a valid but
more expensive middle ground with a 90-day minimum and faster retrieval
than needed here — Deep Archive is strictly cheaper and still
compliant.

---

**Q8.** A data platform team wants to prevent any single analyst's
ad-hoc Athena query from generating an unexpectedly large bill. What
should they configure?

A. A Service Control Policy blocking Athena
B. An Athena workgroup with a per-query data-scanned limit
C. A Lambda function that monitors Cost Explorer daily
D. Reduce the S3 bucket size

**Answer: B.** This is the purpose-built guardrail: workgroups can cap
bytes scanned per query, stopping runaway queries before they run up
cost. **A** blocks Athena entirely, which isn't the goal. **C** is
reactive (after the cost already happened), not preventive. **D** is
nonsensical — reducing bucket size doesn't limit a query's scan cost
and would destroy data.

---

**Q9.** An application accesses S3 and DynamoDB from a private subnet
via a NAT Gateway, and the team notices high NAT Gateway data-processing
charges. What reduces this cost with no application changes needed?

A. Move the application to a public subnet
B. Add VPC Gateway Endpoints for S3 and DynamoDB
C. Add a VPC Interface Endpoint for every AWS service used
D. Increase the NAT Gateway bandwidth

**Answer: B.** Gateway endpoints for S3 and DynamoDB are free and route
that traffic off the NAT Gateway entirely, with no code changes (same
API endpoints, just a different network path via route table). **A**
is a security regression and doesn't address the actual charge. **C**
is unnecessary and costs more — interface endpoints aren't free, and
S3/DynamoDB specifically support the free gateway type. **D** increases
cost without addressing the root cause.

---

**Q10.** A team runs an Aurora Serverless v2 database for an internal
tool used only during business hours on weekdays, with near-zero
traffic overnight and on weekends. Which statement about its cost
profile is correct?

A. It costs the same as a fixed-size provisioned instance regardless of traffic
B. It scales ACUs down during idle periods, reducing cost compared to a fixed provisioned instance sized for peak load
C. It requires manual resizing events to reduce capacity
D. It cannot scale below its initial configured capacity

**Answer: B.** This is the entire value proposition of Serverless v2 —
fine-grained ACU scaling means the workload isn't paying for
peak-sized, 24/7 provisioned capacity during idle nights/weekends. **A**
describes provisioned Aurora, not Serverless v2. **C** describes older
Aurora Serverless v1 behavior (which had resizing events/pauses); v2
scales in fine-grained increments without a disruptive resize event.
**D** is false — v2's entire design point is scaling below a
statically sized floor.
