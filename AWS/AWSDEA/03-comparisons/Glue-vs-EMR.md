# Glue vs EMR

> Domain 1 covers transformation services broadly. This file isolates
> the single most-tested processing decision on DEA-C01: **serverless,
> catalog-native ETL (Glue) vs. full control over an open-source
> big-data cluster (EMR)** — and exactly where the cost curve crosses.

---

## 1. ELI12

**Glue** is ordering food delivery. You pick what you want from a menu
(a Spark script, a visual ETL job), someone else owns the kitchen,
buys the ingredients, cleans up, and you just pay for what you ordered.
Fast to start, no equipment to own, but you're limited to what's on the
menu (Spark, Python shell, Ray — not every possible big-data tool).

**EMR** is renting a fully equipped commercial kitchen. You get every
appliance imaginable — Spark, Hive, Presto/Trino, HBase, Flink — and
total control over how it's configured. If you already have recipes
(existing Spark/Hive/Hadoop scripts) written for a *specific* kitchen
setup, this is the only way to run them as-is. But you're responsible
for turning the oven on, keeping it running, and turning it off — and
you pay for the kitchen the whole time it's on, not just the dish you
cooked.

---

## 2. Comparison matrix

| Attribute | **AWS Glue ETL** | **Amazon EMR (on EC2)** | **EMR Serverless** |
|---|---|---|---|
| **Purpose** | Serverless Spark/Python ETL, native Data Catalog integration | Full big-data cluster — any open-source framework | Spark/Hive without managing cluster infrastructure |
| **Frameworks** | Spark, Python Shell, Ray | **Spark, Hive, Presto/Trino, HBase, Flink, Hudi** — the widest set | Spark, Hive |
| **Time to first task** | ~1 minute cold start | 5–10 minutes cluster spin-up | Seconds |
| **Cost model** | DPU-hour, billed per second (1-min minimum) | Instance-hours; **Spot on task nodes can cut cost up to ~90%** | vCPU-second + GB-second |
| **Cheapest at petabyte scale** | ❌ | ✅ **with Spot task nodes and Reserved/Savings Plans on core/primary** | Middle ground |
| **Cheapest at small/occasional scale** | ✅ | ❌ (cluster spin-up overhead dominates) | ✅ |
| **Serverless** | ✅ | ❌ | ✅ |
| **Catalog integration** | ✅ **Native** — DynamicFrames read/write straight to/from the Glue Data Catalog | ✅ Configurable (Hive Metastore or Glue Catalog) | ✅ |
| **Incremental processing** | ✅ **Job bookmarks** — built-in, tracks processed state automatically | Manual (you track state yourself, or use Hudi/Iceberg checkpoints) | Manual |
| **Streaming** | ✅ Glue Streaming (micro-batch) | ✅ Spark Structured Streaming | ✅ |
| **Batch** | ✅ | ✅ | ✅ |
| **Data volume** | Scales to large but not infinite — worker sizing (G.1X–G.8X) has ceilings per job | **Petabytes** — the traditional home for the biggest jobs | Large, auto-scaled |
| **Scaling** | Auto-scaling workers within a job | Managed scaling / instance fleets across the cluster | Fully automatic |
| **Cluster/infra visibility** | ❌ None — you never see a cluster | ✅ Full access — SSH, YARN UI, Ganglia, custom bootstrap actions | ⚠️ Limited — no cluster access |
| **Custom bootstrap / OS-level config** | ❌ | ✅ Bootstrap actions, custom AMIs | ❌ |
| **Monitoring** | Glue job metrics, Spark UI (via CloudWatch), job run history | Ganglia/YARN + CloudWatch, cluster-level metrics | CloudWatch |
| **Security** | IAM, KMS, VPC connections, Lake Formation | IAM, EMRFS auth, Kerberos, Ranger, Lake Formation | IAM, KMS, VPC |
| **Best use case** | Catalog-driven serverless ETL; teams without dedicated big-data ops | Existing Hadoop/Spark/Hive/Presto workloads; extreme cost optimization at huge scale | Spark/Hive without cluster babysitting, but need more control than Glue's job model |
| **When NOT to use** | Non-Spark frameworks needed (Hive, Presto, HBase); need cluster-level tuning | Want zero infrastructure ops; small/occasional jobs (spin-up overhead not worth it) | Need Presto/HBase/Flink or custom bootstrap |
| **Exam favorite** | "serverless ETL integrated with the Data Catalog" | **"existing Spark/Hive scripts"** — the trigger phrase that overrides everything else; "lowest cost at petabyte scale" | "Spark without managing infrastructure" |

---

## 3. Decision tree

```
┌─────────────────────────────────────────────────────────────────┐
│ START: Does the scenario mention EXISTING Spark, Hive, Presto,   │
│ HBase, or Hadoop scripts/jobs that must run as-is?                │
└───────────────────────────────┬───────────────────────────────────┘
                                 │
                ┌─────────────────┴─────────────────┐
               YES                                   NO
                │                                     │
          ┌─────▼─────┐               Does it need Presto/Trino, HBase,
          │    EMR    │               Flink, or custom bootstrap/AMI-level
          │ (only     │               configuration?
          │  service  │                            │
          │  exposing │              ┌───────────────┴───────────────┐
          │  the      │             YES                              NO
          │  cluster) │              │                                 │
          └───────────┘        ┌─────▼─────┐         Is the primary constraint
                                │    EMR    │         "lowest cost" at PETABYTE
                                │ (on EC2,  │         scale, with tolerance for
                                │  full     │         cluster management?
                                │  control) │                      │
                                └───────────┘         ┌──────────────┴──────────────┐
                                                      YES                            NO
                                                       │                              │
                                          ┌─────────────▼─────────────┐  ┌────────────▼────────────┐
                                          │   EMR (EC2) + SPOT ON      │  │       AWS GLUE ETL       │
                                          │   TASK NODES                │  │  (serverless, catalog-   │
                                          │  (cheapest at huge scale,   │  │   native, job bookmarks, │
                                          │   accept the ops overhead)  │  │   least operational      │
                                          └──────────────────────────────┘  │   overhead)              │
                                                                             └───────────────────────────┘
                                                                                          │
                                                                          Want Spark/Hive without ANY
                                                                          cluster ops, but need more
                                                                          runtime control than a Glue
                                                                          "job" gives you?
                                                                                          │
                                                                                  ┌────────▼────────┐
                                                                                  │  EMR SERVERLESS  │
                                                                                  └───────────────────┘
```

---

## 4. Worked scenarios

**Scenario A — A company migrating off an on-prem Hadoop cluster has
years of existing Spark and Hive jobs, plus some legacy Presto queries,
and wants to lift-and-shift with minimal rewrite.** *Winner: EMR.*
"Existing Spark/Hive scripts" is the single strongest trigger phrase on
the whole exam for EMR — it's the only listed service that exposes the
full open-source big-data stack, including Presto/Trino and HBase,
which Glue does not support at all.

**Scenario B — A small team wants to run a nightly Spark ETL job that
reads from three S3 sources, joins them, and writes results back to S3
as Parquet, registered in the Data Catalog, processing only files that
arrived since the last run.** *Winner: Glue ETL.* No existing
infrastructure to migrate, native catalog integration is explicitly
wanted, and "process only new data since last run" is the textbook
trigger for Glue's built-in job bookmarks — EMR would require you to
build that incremental tracking yourself.

**Scenario C — A media company processes 5 petabytes of video metadata
nightly and finance has flagged the processing bill as the single
largest line item; the team is comfortable managing cluster
infrastructure to cut cost.** *Winner: EMR (EC2) with Spot on task
nodes.* At genuine petabyte scale with cost as the dominant constraint
and operational tolerance present, EMR's ability to run the bulk of
compute on Spot task nodes (up to ~90% cheaper than On-Demand) beats
Glue's DPU-hour pricing, which has no equivalent steep discount lever.

**Scenario D — A team wants to run Spark jobs on an as-needed basis,
values not managing cluster infrastructure at all, but occasionally
needs finer runtime tuning than a simple Glue job configuration
allows.** *Winner: EMR Serverless.* This sits in the middle: no cluster
to provision or tear down (like Glue), but built on the actual EMR
runtime, giving more Spark/Hive-specific tuning knobs than a Glue job
while still avoiding EC2/YARN management entirely.

---

## 5. Exam traps

| Trap | The correction |
|---|---|
| **"Serverless" always winning on "least operational overhead"** | True *unless* the stem also says "existing Spark/Hive scripts." That phrase overrides the serverless preference — EMR becomes correct even though it's not serverless, because it's the only option that can run those scripts unmodified. |
| **Assuming Glue can run Presto, Trino, or HBase workloads** | It cannot. Glue's frameworks are Spark, Python Shell, and Ray only. Any mention of Presto/Trino/HBase/Hadoop MapReduce eliminates Glue outright. |
| **"Lowest cost" always meaning Glue because it's serverless** | At small/occasional scale, yes. At genuine petabyte scale with Spot-eligible task nodes, EMR is frequently cheaper — "lowest cost at petabyte scale" is explicitly an EMR trigger phrase in AWS's own framing. |
| **Putting Spot on the EMR primary or core nodes** | Any answer saying "use Spot for all node types" (or the primary node) is wrong — losing the primary kills the cluster, and losing core nodes risks HDFS data loss. **Spot belongs on task nodes only.** |
| **Forgetting job bookmarks require a reset for full reprocessing** | "Process only new data" = bookmarks enabled (default behavior). "Reprocess ALL historical data" = **reset the bookmark**, not "enable bookmarks" (a common wrong-option phrasing). |
| **Assuming EMR Serverless gives full cluster access** | It doesn't — no SSH, no custom bootstrap actions, no access to YARN/Ganglia UIs the way EMR-on-EC2 does. If the scenario needs custom AMIs or bootstrap-level tuning, that requires EMR on EC2. |
| **DynamicFrame vs DataFrame confusion** | DynamicFrames (Glue-specific) self-describe schema per record and handle messy/inconsistent data via `resolveChoice` — slower but resilient. DataFrames (standard Spark) are faster but require a known, fixed schema. A "schema drift" or "inconsistent data" scenario favors DynamicFrames. |
| **Treating "G.1X worker running out of memory" as an EMR problem** | Worker sizing is a Glue-specific concept (G.1X–G.8X). An out-of-memory Glue job is fixed by moving to a bigger worker type (G.2X, G.4X) or fixing data skew — not by "switching to EMR," which is a much bigger architectural change than the fix requires. |

---

## 6. Real-company examples

**Glue side — a mid-size SaaS company's daily ETL pipeline.** Nightly
jobs pull from RDS via JDBC, transform with Spark, and land curated
Parquet in S3, registered automatically in the Glue Data Catalog for
downstream Athena queries — no cluster to size, patch, or decommission,
and job bookmarks handle incremental loads without custom state-
tracking code.

**EMR side — a genomics research institute.** Processing petabytes of
sequencing data using a mix of existing Spark and custom Hadoop
MapReduce jobs developed over a decade, plus Presto for ad-hoc querying
across the cluster — a combination of frameworks only EMR can host,
run with Spot task nodes to keep the compute bill manageable at that
scale.

---

## 7. Practice questions (12)

**Q1.** A team is migrating an on-prem Hadoop cluster running existing
Hive and Presto jobs to AWS and wants minimal rewrite. What should they
use?

- A. AWS Glue ETL — ✗ Glue doesn't support Hive or Presto/Trino at all; can't run these jobs as-is.
- B. **Amazon EMR — ✓** Only service exposing the full Hadoop/Hive/Presto stack for a near-direct lift-and-shift.
- C. EMR Serverless — ✗ Doesn't support Presto/Trino; limited to Spark/Hive.
- D. AWS Lambda — ✗ Not a big-data cluster framework at all; wrong category.

**Q2.** A nightly Spark job needs to process only files added since the
last successful run, with results registered automatically in the Data
Catalog, and the team wants zero cluster management. Best fit?

- A. EMR with a cron-scheduled step — ✗ Requires cluster provisioning/management and manual incremental-state tracking; more overhead than needed.
- B. **AWS Glue ETL with job bookmarks — ✓** Serverless, native catalog integration, and bookmarks handle "new since last run" out of the box.
- C. EMR Serverless — ✗ No native job bookmarks equivalent; would require building incremental tracking manually.
- D. Lambda with a scheduled trigger — ✗ 15-minute/10GB limits make it unsuitable for a general Spark ETL job at scale.

**Q3.** A media company processes 5 petabytes nightly and cost is the
dominant concern; the team is willing to manage cluster infrastructure.
What's the most cost-effective approach?

- A. AWS Glue with maximum workers — ✗ No Spot-equivalent discount lever; DPU-hour pricing doesn't scale down as steeply as EC2 Spot at this volume.
- B. **EMR on EC2 with Spot instances on task nodes — ✓** Up to ~90% savings on the bulk of compute at genuine petabyte scale — the classic "lowest cost at scale" answer.
- C. EMR Serverless — ✗ No direct Spot pricing lever in the same way as EC2 task nodes; typically costs more than a well-tuned Spot-heavy EMR cluster at this scale.
- D. Glue Flex execution class — ✗ Cheaper than standard Glue but still lacks EC2 Spot's steep discount at petabyte scale.

**Q4.** Which EMR node type is the correct place to run Spot instances?

- A. Primary node — ✗ Never; losing it kills the whole cluster.
- B. Core nodes — ✗ Risky; core nodes typically hold HDFS data, so losing them risks data loss.
- C. **Task nodes — ✓** Run compute only, no HDFS storage; losing them to a Spot interruption doesn't lose data. This is the exam's standard correct answer.
- D. All node types equally — ✗ A common wrong-option phrasing; never correct.

**Q5.** A Glue job processes 500GB of retail transaction data daily,
but a stakeholder now wants the entire 3 years of historical data
reprocessed once due to a schema fix. What's the correct action?

- A. Enable job bookmarks — ✗ Bookmarks are likely already enabled for the daily incremental run; enabling them again doesn't trigger reprocessing.
- B. **Reset the job bookmark before the next run — ✓** Resetting clears the tracked state so the job reprocesses all historical data.
- C. Delete and recreate the Glue job — ✗ Unnecessarily destructive; resetting the bookmark achieves the same result without recreating the job.
- D. Switch to EMR for the one-time reprocessing — ✗ Unnecessary architectural change; Glue handles full reprocessing fine once the bookmark is reset.

**Q6.** Which frameworks does AWS Glue ETL support that distinguish it
from EMR's broader framework list?

- A. Glue supports Spark, Python Shell, and Ray; EMR additionally supports Hive, Presto/Trino, HBase, and Flink — ✓ **Correct** — this is the key differentiator driving the "existing scripts" trigger.
- B. Glue supports Hadoop MapReduce natively; EMR does not — ✗ Backwards; Glue does not support Hadoop MapReduce at all.
- C. Both support an identical framework set — ✗ False; EMR's framework set is strictly broader.
- D. Glue supports Presto but not Spark — ✗ Incorrect; Glue does not support Presto, and Spark is its primary framework.

**Q7.** A Glue job is repeatedly failing with out-of-memory errors on
large shuffle-heavy joins using the default G.1X worker type. What's
the recommended first fix?

- A. Migrate the job to EMR — ✗ A much bigger architectural change than necessary for what's typically a worker-sizing issue.
- B. **Increase the worker type to G.2X (or higher, e.g. G.4X/G.8X) — ✓** The standard first fix for Glue OOM errors — more memory per worker.
- C. Switch from DynamicFrame to DataFrame — ✗ May help performance but doesn't directly address a memory-sizing problem the way a bigger worker type does.
- D. Enable job bookmarks — ✗ Bookmarks control incremental processing, unrelated to memory/OOM issues.

**Q8.** A team needs to run Spark and Hive jobs without any cluster
provisioning or management, but occasionally needs Spark-specific
runtime tuning beyond what a simple Glue job configuration provides.
Best fit?

- A. AWS Glue ETL — ✗ Lacks the deeper Spark/Hive runtime tuning knobs the team occasionally needs.
- B. EMR on EC2 — ✗ Provides the tuning but requires cluster provisioning/management, which the team wants to avoid.
- C. **EMR Serverless — ✓** No cluster to manage, but built on the EMR runtime with more Spark/Hive tuning flexibility than a Glue job.
- D. Lambda — ✗ Not built for general Spark/Hive workloads; 15-minute/10GB limits rule it out.

**Q9.** Which statement correctly distinguishes DynamicFrames from
DataFrames in the Glue context?

- A. DynamicFrames are faster but require a fixed known schema — ✗ Backwards; DataFrames are the faster, fixed-schema option.
- B. **DynamicFrames self-describe schema per record and handle messy/inconsistent data via resolveChoice, at some performance cost versus DataFrames — ✓** Correct distinction.
- C. DynamicFrames are only usable in EMR, not Glue — ✗ DynamicFrames are a Glue-specific (Spark-based) construct.
- D. There is no functional difference; the names are interchangeable — ✗ False; they have materially different schema-handling behavior.

**Q10.** A scenario mentions the team wants to use HBase for
low-latency random reads/writes on top of HDFS-stored data as part of
a broader Spark pipeline. Which service must be used?

- A. AWS Glue ETL — ✗ Does not support HBase.
- B. **Amazon EMR — ✓** The only listed service supporting HBase alongside Spark.
- C. EMR Serverless — ✗ Does not support HBase; limited to Spark/Hive.
- D. DynamoDB — ✗ A different, unrelated key-value store; not part of the EMR/Hadoop ecosystem being described.

**Q11.** True or false: EMR Serverless provides SSH access to the
underlying compute for custom bootstrap actions.

- A. True — ✗ Incorrect; EMR Serverless abstracts away the underlying infrastructure entirely.
- B. **False — ✓** No SSH, no bootstrap actions, no custom AMIs — that level of control requires EMR on EC2.
- C. True, but only for the primary node — ✗ EMR Serverless has no exposed "primary node" concept for the user at all.
- D. True, if the cluster is in a private VPC — ✗ VPC placement doesn't change the fundamental lack of infrastructure access in EMR Serverless.

**Q12.** Which combination of signals most strongly overrides a
"least operational overhead" preference and points to EMR instead of
Glue?

- A. "Petabyte scale" alone — ✗ Scale alone doesn't override; Glue can technically process large volumes too — it's the cost/framework signals together that matter.
- B. **"Existing Spark/Hive/Presto/HBase scripts that must run unmodified" — ✓** The strongest, most direct override — Glue simply cannot run several of these frameworks at all.
- C. "The data is stored in S3" — ✗ Both services read from S3 natively; not a differentiator.
- D. "The job runs nightly" — ✗ A scheduling detail that doesn't favor either service specifically.
