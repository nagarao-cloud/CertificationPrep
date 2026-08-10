# Amazon EMR

> Deep-reference file for **Amazon EMR** (Elastic MapReduce), scoped
> narrower than a full domain file. Read this alongside
> `00-START-HERE/SERVICE-SELECTION-MATRIX.md` Part 4 (processing
> matrix) — that file gives the head-to-head against Glue/Lambda/Flink;
> this file goes deeper on EMR's own internals: node roles, instance
> fleets, Spot strategy, EMRFS, EMR Serverless, EMR on EKS, EMR Studio,
> and bootstrap actions. EMR is primarily tested in **Domain 1 (Data
> Ingestion and Transformation, 34%)**, Task 1.2 (transform/process).

---

## CONTENTS

- [1. Explain like I'm 12](#step1)
- [2. Explain technically](#step2)
- [3. Explain like a Senior AWS Data Engineer](#step3)
- [4. Production architecture](#step4)
- [5. Per-service coverage checklist](#step5)
- [6. Exam traps](#step6)
- [7. Interview questions](#step7)
- [8. Cheat sheet](#step8)
- [9. Memory tricks](#step9)
- [10. Practice questions (15)](#step10)

---

<a name="step1"></a>
## 1. Explain like I'm 12

Imagine you have a mountain of homework — 10,000 math problems — and
one afternoon to finish. Doing it alone would take forever. So you get
30 friends together: one friend is the "team captain" who splits up the
problems and collects the answers (that's the **primary node**), some
friends actually do the math **and** keep a copy of the problem sheets
in case one gets lost (**core nodes**), and some extra friends just show
up to crunch numbers with no responsibility for keeping anything safe —
if one of them has to leave early, no big deal, someone else picks up
their sheet (**task nodes**, the ones you send home early to save
allowance money — that's **Spot pricing**). Amazon EMR is Amazon renting
you that whole team of friends, already knowing how to use the popular
"solve math fast" toolkits (Spark, Hive, Presto), and taking the team
apart the second you're done so you stop paying for friends who are
just standing around.

<a name="step2"></a>
## 2. Explain technically

**Amazon EMR** is a managed **cluster platform** for running
distributed big-data frameworks — Apache Spark, Hive, Presto/Trino,
HBase, Flink, and others — on a set of provisioned compute resources
(EC2 instances, EKS pods, or a fully serverless runtime) that AWS
provisions, configures, patches, and (optionally) scales for you. Unlike
Glue, which abstracts the cluster away entirely and exposes only a job
API, EMR exposes the **cluster itself**: you choose instance types,
node counts and roles, bootstrap actions that run at node startup, and
you get shell/SSH access to the primary node if needed. This makes EMR
the answer whenever a workload needs a framework Glue doesn't offer
(Presto/Trino, HBase, native Flink outside the managed service), needs
fine-grained cluster-level tuning, or is migrating existing
Spark/Hive/Presto code that already assumes cluster-level control.

<a name="step3"></a>
## 3. Explain like a Senior AWS Data Engineer

A senior engineer treats "EMR vs. Glue" as a question about **who needs
to own the compute layer, and why** — not a question about which
service is "more powerful." Glue and EMR run largely the same engine
underneath (Spark, for most jobs); the difference is operational
surface area. The senior default is: **start with Glue** for new,
catalog-integrated ETL, because it removes cluster sizing, patching,
and idle-cost management entirely. **Move to EMR** the moment one of
three concrete conditions is true: (1) there's an **existing
Spark/Hive/Presto/HBase codebase** that already assumes cluster-level
control (custom JARs, non-Glue-supported libraries, framework versions
Glue doesn't expose) and rewriting it is real, avoidable engineering
cost; (2) the workload is **so large (PB-scale) that Spot pricing on
EMR task nodes beats Glue's per-DPU pricing** at that volume — a pure
cost-at-scale argument, not a capability argument; or (3) the team needs
**cluster-level features EMR exposes and Glue doesn't** — a specific
Presto/Trino version, HBase, custom bootstrap actions installing
arbitrary software, or Kerberos-based enterprise security integration.
The trap a senior engineer avoids is choosing EMR by default because it
"feels more powerful" — every hour spent sizing, patching, and
babysitting a cluster that Glue would have handled invisibly is a cost
the exam (and real production teams) explicitly penalizes under "least
operational overhead."

<a name="step4"></a>
## 4. Production architecture

```
                         ┌───────────────────────────────────────┐
                         │           EMR CLUSTER (EC2 mode)        │
                         │                                          │
                         │  ┌────────────────────────────────────┐ │
                         │  │        PRIMARY NODE (1 per cluster)  │ │
                         │  │  YARN ResourceManager, HDFS NameNode │ │
                         │  │  Coordinates all work.                │ │
                         │  │  ❌ NEVER SPOT — loses the cluster.   │ │
                         │  └────────────────────────────────────┘ │
                         │                                          │
                         │  ┌────────────────────────────────────┐ │
                         │  │        CORE NODES (1+, scalable)     │ │
                         │  │  Run tasks (YARN NodeManager) AND     │ │
                         │  │  hold HDFS data blocks.                │ │
                         │  │  ⚠️ Spot risky — losing one loses data │ │
                         │  └────────────────────────────────────┘ │
                         │                                          │
                         │  ┌────────────────────────────────────┐ │
                         │  │        TASK NODES (0+, elastic)      │ │
                         │  │  Run tasks ONLY. No HDFS storage.     │ │
                         │  │  ✅ SPOT GOES HERE — exam answer.     │ │
                         │  └────────────────────────────────────┘ │
                         └──────────────────┬───────────────────────┘
                                             │
                                    reads/writes via EMRFS
                                             │
                                             ▼
                         ┌───────────────────────────────────────┐
                         │                 AMAZON S3                │
                         │   Durable data lake storage.              │
                         │   EMRFS = S3 read/write layer for Hadoop   │
                         │   ecosystem tools, w/ consistent view.     │
                         └───────────────────────────────────────┘

        ────────────────────  DEPLOYMENT VARIANTS  ────────────────────

  ┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
  │   EMR on EC2         │   │   EMR SERVERLESS     │   │   EMR ON EKS          │
  │   You choose         │   │   No node/cluster     │   │   Runs on an existing │
  │   instances, node    │   │   management. Submit  │   │   Kubernetes cluster  │
  │   roles, bootstrap    │   │   a Spark/Hive job,   │   │   the org already     │
  │   actions.            │   │   pay per vCPU/memory │   │   operates. Shares    │
  │                       │   │   -second used.        │   │   compute w/ other    │
  │                       │   │                        │   │   workloads.          │
  └───────────────────┘   └───────────────────┘   └───────────────────┘

        ─────────────────────  DEVELOPMENT LAYER  ─────────────────────

  EMR STUDIO — web-based IDE (Jupyter-based notebooks) for interactively
  developing, debugging, and visualizing Spark jobs against a live or
  EMR Serverless cluster, with Git integration for notebook version
  control.
```

**Reading the diagram, node by node:** the **primary node** runs the
cluster's brain — the YARN ResourceManager (decides which node runs
which task) and the HDFS NameNode (tracks where data blocks live) —
and is a single point of coordination, which is exactly why it must
never run on Spot: losing it kills the entire cluster's ability to
schedule work or find data, not just one task. **Core nodes** do double
duty: they execute tasks like any worker, but they also **store HDFS
data blocks**, so putting a core node on Spot risks losing actual data
if AWS reclaims that Spot capacity — this is why Spot on core nodes is
labeled "risky" rather than "wrong": it's technically allowed but
trades durability for savings, an option only reasonable when data is
also durably staged in S3 and HDFS is disposable. **Task nodes** run
compute only — no HDFS storage — meaning a Spot interruption on a task
node loses in-progress computation for that node's tasks (which YARN
reschedules elsewhere) but never loses stored data. This is the reason
"Spot instances on task nodes" is the exam's single most consistent
correct-answer pattern for EMR cost optimization: maximum savings, zero
durability risk. Below the node layer, **EMRFS** is the layer that lets
every Hadoop-ecosystem tool (Spark, Hive, Presto) read and write S3 as
if it were HDFS, which is what makes S3 (rather than cluster-local
HDFS) the standard durable storage layer for modern EMR clusters — data
outlives the cluster, so the cluster itself becomes disposable
infrastructure you can terminate the moment a job finishes. The three
deployment variants below the core cluster diagram are different
answers to "who manages the actual machines": **EMR on EC2** gives full
node-level control, **EMR Serverless** removes node management
entirely and bills by actual resource-seconds consumed, and **EMR on
EKS** runs EMR's Spark/Hive engines as Kubernetes workloads on a
cluster the organization already operates — chosen specifically when
Kubernetes is already the org's standard deployment target, not because
it's technically superior for a greenfield EMR need. **EMR Studio** sits
above all three as the interactive development surface, letting data
engineers iterate on Spark code in a notebook against a live or
Serverless backend before packaging it as a production job.

<a name="step5"></a>
## 5. Per-service coverage checklist

### Purpose

Amazon EMR is a managed platform for running distributed big-data
processing frameworks (chiefly Apache Spark, Hive, Presto/Trino, HBase,
and Flink) at scale, exposing cluster-level control that serverless
alternatives (Glue, Lambda) intentionally abstract away.

### When to use

- **Existing Spark, Hive, Presto/Trino, or HBase code/scripts** that
  already assume cluster-level control and would require real rewrite
  effort to port to Glue.
- **Petabyte-scale batch processing where lowest cost per TB matters
  most** — EMR with Spot on task nodes is typically the cheapest
  compute option at extreme scale, beating Glue's per-DPU and Lambda's
  15-minute-ceiling economics.
- Workloads needing a **framework Glue doesn't expose** — Presto/Trino
  for interactive SQL at scale, HBase for wide-column NoSQL on Hadoop,
  or Flink run natively on a cluster rather than via the managed
  Flink service.
- Organizations with an **existing Kubernetes standard** (EMR on EKS)
  or wanting **zero cluster management with Spark/Hive specifically**
  (EMR Serverless).
- Teams needing **fine-grained cluster tuning** — custom bootstrap
  actions installing arbitrary software/libraries at node startup,
  custom instance types, or Kerberos-based enterprise authentication.

### When NOT to use

- **New, catalog-integrated ETL with no existing framework
  dependency** — Glue is lower operational overhead and the exam's
  default "least operational overhead" answer for this case.
- **Small, event-driven, sub-15-minute transforms** — Lambda is
  simpler and cheaper for lightweight jobs; standing up an EMR cluster
  for a small task is significant overkill.
- **Teams wanting zero cluster management at all** and no specific
  need for EMR-only frameworks — EMR Serverless narrows this gap, but
  if there's no Spark/Hive-specific requirement, Glue remains simpler.
- **Continuous low-volume streaming aggregation** — Managed Service
  for Apache Flink is purpose-built and lower-overhead than running
  Flink on an EMR cluster for this use case.

### Advantages

- **Framework breadth** — the only AWS-native option exposing
  Presto/Trino and HBase alongside Spark and Hive in one platform.
- **Spot-on-task-nodes economics** — can meaningfully beat any
  serverless alternative's per-unit pricing at very large, sustained
  processing volumes.
- **Instance fleets** — specify multiple instance types and let EMR
  provision from whichever has available Spot/On-Demand capacity,
  maximizing availability and minimizing interruption risk versus a
  rigid single-instance-type request.
- **Managed scaling** — EMR automatically adds/removes core and task
  nodes based on a target metric (e.g., YARN memory utilization),
  removing manual capacity planning during the job's run.
- **EMRFS** gives S3 a consistent, Hadoop-compatible interface, making
  the data lake durable and independent of cluster lifecycle.
- **Bootstrap actions** let you install/configure arbitrary software at
  node launch — a level of customization Glue does not offer.
- **EMR Studio** provides a full interactive notebook IDE with Git
  integration for iterative Spark development.

### Limitations

- **Cluster spin-up time** — several minutes for an EC2-based cluster
  to become ready, versus near-instant for Lambda or EMR Serverless.
- **Operational surface** — patching, security group management,
  instance type selection, and cluster right-sizing are all the
  customer's responsibility (or require careful automation) on EMR on
  EC2, unlike Glue's fully abstracted worker model.
- **Cost visibility complexity** — instance-hours across primary,
  core, and task nodes, plus EBS volumes and data transfer, are harder
  to reason about than Glue's simple DPU-hour billing.
- **Primary node is a single point of coordination failure** unless
  running in **multi-primary mode** (available for certain
  configurations) — losing it disrupts the running cluster.

### Pricing considerations

- Billed as **EC2/EMR Serverless usage + an EMR service fee** layered
  on top of the underlying compute; On-Demand, Reserved, and Spot
  pricing all apply to the EC2 instances backing an EMR-on-EC2 cluster.
- **Spot on task nodes** is the single biggest lever for cost
  reduction — commonly cited savings up to ~90% versus On-Demand for
  that portion of the fleet.
- **EMR Serverless** bills per vCPU-second and GB-second actually
  consumed during job execution — no idle cost, but no ability to
  under- or over-provision a persistent cluster either.
- **Managed scaling** reduces cost by shrinking the cluster during
  low-utilization periods within a long-running or persistent cluster.
- **Transient clusters** (spin up, run the job, terminate) versus
  **long-running/persistent clusters** is itself a cost decision —
  transient avoids idle billing but re-pays cluster startup time on
  every run; persistent avoids repeated startup cost but bills for idle
  time between jobs unless paired with managed scaling down to a floor.

### Performance

- Spark on EMR reading directly from S3 via EMRFS, with data in
  Parquet and sensible partitioning, scales near-linearly with added
  core/task nodes for most workloads (data skew and shuffle-heavy jobs
  are the exceptions — see Failure scenarios).
- **Instance fleets with diversified instance types** improve real-
  world throughput by reducing the chance the cluster stalls waiting
  on a single scarce Spot instance type.

### Scaling

| Dimension | Mechanism |
|---|---|
| Compute (EC2 mode) | Add/remove core and task nodes manually, via instance groups, or automatically via **managed scaling** |
| Compute (Serverless) | Fully automatic based on submitted job's resource requests |
| Storage | EMRFS to S3 — effectively unlimited; HDFS on core nodes is capacity-bounded by node count/disk |
| Spot capacity availability | **Instance fleets** — request multiple instance types/AZs, EMR provisions from whichever is available |
| Kubernetes-based scaling | EMR on EKS scales with the underlying EKS cluster's node groups/Fargate profiles |

### Security

- **IAM roles** for the EC2 instance profile (cluster-level
  permissions) and for individual EMR Studio/Notebook users.
- **EMRFS authorization** — can enforce per-user or per-role S3 access
  at the EMRFS layer, layered with IAM and, increasingly, **Lake
  Formation** integration for fine-grained catalog-based permissions on
  data EMR reads.
- **Kerberos** authentication support for enterprise environments
  needing strong, mutual authentication across the Hadoop ecosystem
  (a capability Glue does not offer, and a real reason to pick EMR).
- **Encryption**: at-rest (EBS volumes, S3 via SSE-KMS/SSE-S3) and
  in-transit (TLS between nodes) are both configurable per cluster.
- **VPC placement** — clusters run inside a VPC with security groups
  controlling primary/core/task node network access.

### High availability

- **Multi-AZ is not automatic for a single EMR cluster** — a cluster
  runs within one Availability Zone by default (all nodes in the same
  AZ, for network performance between nodes); HA across AZs is
  achieved architecturally (e.g., separate clusters, or relying on S3's
  durability for the data layer while treating clusters as disposable
  compute).
- **Multi-primary-node clusters** (where supported) reduce the primary
  node single-point-of-failure risk for long-running, mission-critical
  clusters.
- **Transient cluster pattern** itself is an HA strategy at the data
  layer: because data lives in S3 (via EMRFS) rather than solely on
  cluster-local HDFS, losing an entire cluster doesn't lose data — a
  new cluster can be launched and pointed at the same S3 location.

### Failure scenarios

| Scenario | What happens | Fix |
|---|---|---|
| Primary node fails | Cluster loses coordination; running job typically fails | Terminate and relaunch (transient pattern), or use multi-primary configuration for critical long-running clusters |
| Core node Spot-reclaimed | Potential HDFS data loss for blocks only replicated on that node | Avoid Spot on core nodes, or ensure sufficient HDFS replication factor, or rely on S3/EMRFS as the durable layer instead of HDFS |
| Task node Spot-reclaimed | In-progress tasks on that node are lost and YARN reschedules them elsewhere | No data loss; this is the intended, low-risk Spot use case |
| Job dominated by a few very slow tasks | **Data skew** on a shuffle key | Salt the key, repartition, enable adaptive query execution |
| Job runs correctly but very slowly, small output files | **Small-file problem** | Coalesce/repartition before write; scheduled compaction |
| Cluster fails to acquire enough Spot capacity | Single-instance-type Spot request exhausted in that AZ | Use **instance fleets** with multiple instance types/AZs |

### Common mistakes

- Putting **Spot on the primary node**, or "Spot on all node types" —
  an immediate wrong-answer signal on this exam.
- Choosing EMR for a brand-new ETL job with no existing framework
  dependency, when Glue would be lower-overhead and cheaper at
  moderate scale.
- Leaving a **persistent cluster running idle** between scheduled jobs
  instead of using a transient cluster or managed scaling down to a
  minimal floor.
- Relying on **HDFS as the durable data store** instead of S3/EMRFS,
  making the cluster itself a durability dependency it shouldn't be.
- Requesting a **single Spot instance type** instead of an **instance
  fleet**, increasing the risk of stalled provisioning during Spot
  capacity crunches.
- Forgetting **bootstrap actions run at every node launch**, including
  nodes added later by managed scaling — a bootstrap action with a
  side effect that isn't idempotent can break auto-scaled nodes.

### Exam traps

⚠️ **"Spot instances for all node types" is always wrong.** Any option
phrased that way should be eliminated immediately — Spot belongs on
task nodes; core nodes are risky; the primary node is never Spot.

⚠️ **"Existing Spark/Hive/Presto scripts" is the strongest single
signal for EMR over Glue.** If the scenario explicitly says code
already exists and works on one of these frameworks, rewriting it into
Glue's supported subset is real, avoidable cost — EMR is correct
specifically to avoid that rewrite.

⚠️ **"Lowest cost at petabyte scale" flips the usual "least operational
overhead" preference.** Elsewhere on this exam, managed/serverless wins
by default. At true PB-scale with Spot-eligible task nodes, EMR becomes
the *cheapest per-TB* answer even though it carries more operational
surface than Glue — cost-at-extreme-scale is the one condition that
overrides the serverless-by-default house style.

⚠️ **EMR Serverless is not the same decision as "EMR vs. Glue."**
EMR Serverless still runs Spark/Hive specifically (not the full
Glue-managed catalog-native ETL experience) — pick it when the
framework requirement is EMR-specific (Presto, HBase, or a Spark/Hive
version/feature Glue doesn't expose) but cluster management is
unwanted; don't default to it just because "serverless" sounds like
the safe answer if Glue is equally capable for the actual job.

⚠️ **A cluster spans one AZ by default.** A scenario implying "the
cluster automatically survives an AZ failure" without additional
architecture (multi-primary, transient-cluster-plus-S3 pattern) is
describing a capability EMR doesn't provide out of the box.

<a name="step7"></a>
## 7. Interview questions

- *"When would you pick EMR over Glue for a brand-new ETL job, with no
  existing code?"* Strong answer: almost never, unless the job needs a
  framework Glue doesn't expose (Presto/Trino, HBase) or the workload
  is large enough that Spot-on-task-nodes economics genuinely beat
  Glue's DPU pricing — otherwise Glue's lower operational overhead
  wins by default.
- *"Explain why Spot instances are safe on task nodes but risky on core
  nodes."* Strong answer: task nodes hold no HDFS data, so an
  interruption only loses in-progress compute (rescheduled by YARN);
  core nodes hold HDFS blocks, so an interruption can lose data unless
  that data is also durably staged elsewhere (S3/EMRFS).
- *"How do instance fleets improve Spot reliability over instance
  groups?"* Strong answer: instance fleets let you specify multiple
  eligible instance types and AZs, so EMR can provision from whichever
  has available capacity, dramatically reducing the odds of a stalled
  or interrupted cluster versus betting on a single instance type.
- *"Why is EMR on EKS a legitimate architecture choice, given EMR on
  EC2 already exists?"* Strong answer: it's correct specifically when
  Kubernetes is already the organization's standard deployment and
  operational target — sharing EKS tooling, monitoring, and node
  management across all workloads (not just EMR) is the value, not a
  technical superiority claim over EMR on EC2.
- *"A nightly EMR Spark job that took 20 minutes now takes 3 hours.
  What do you check?"* Strong answer: check for data skew (a small
  number of tasks dominating runtime in the Spark UI/YARN metrics)
  first, then whether upstream data volume or shape changed, then
  cluster/Spot capacity issues, before assuming a code regression.

<a name="step8"></a>
## 8. Cheat sheet

| If the scenario says... | Reach for... |
|---|---|
| existing Spark/Hive/Presto/HBase code | EMR (on EC2 or Serverless) |
| lowest cost at petabyte scale | EMR + Spot on **task nodes only** |
| Spark/Hive without managing a cluster | EMR Serverless |
| org already runs Kubernetes | EMR on EKS |
| interactive notebook development on Spark | EMR Studio |
| maximize Spot availability, minimize interruption | Instance fleets (multiple instance types/AZs) |
| custom software needed at node startup | Bootstrap actions |
| avoid manual capacity planning during a job | Managed scaling |
| new ETL, no framework dependency, catalog-native | NOT EMR — use Glue |
| under 15 min, event-driven, lightweight | NOT EMR — use Lambda |
| continuous stream windowed aggregation | NOT EMR — use Managed Flink |
| "Spot for all node types" appears in an option | Wrong answer — eliminate it |

### 14-column snapshot: EMR vs. Glue

| Column | EMR | Glue |
|---|---|---|
| Purpose | Full cluster-level big-data platform | Serverless, catalog-native ETL |
| Speed | Framework-dependent; fast at scale w/ tuning | Fast startup for moderate jobs |
| Cost | Instance-hours (+Spot savings); EMR Serverless per-second | DPU-hours, per-second billing |
| Serverless | EMR Serverless option | ✅ Always |
| Streaming support | ✅ Spark Structured Streaming, Flink | ✅ Glue Streaming |
| Batch support | ✅ | ✅ |
| Data volume | Petabyte-scale, cost-optimal at extreme scale | Large but less cost-efficient at extreme PB scale |
| Latency | Minutes to spin up (EC2 mode); seconds (Serverless) | ~1 minute to first task |
| Scaling | Managed scaling, instance fleets | Auto-scaling workers |
| Monitoring | YARN/Ganglia + CloudWatch, Spark UI | Glue job metrics, Spark UI |
| Security | IAM, Kerberos, EMRFS auth, VPC, KMS | IAM, KMS, VPC connections, Lake Formation |
| HA | Single-AZ by default; multi-primary option | Managed, no cluster to fail |
| Best use case | Existing Hadoop ecosystem, extreme cost optimization | New catalog-driven ETL, least overhead |
| When NOT to use | Want zero cluster management, small job | Non-Spark framework requirement (Presto, HBase) |

<a name="step9"></a>
## 9. Memory tricks

**"Primary coordinates, Core stores, Task computes."** — the three
node roles in one line; Spot only ever goes on the role that neither
coordinates nor stores.

**"EMRFS makes S3 act like HDFS."** — the reason data outlives the
cluster and clusters become disposable.

**"Fleets beat groups when Spot is scarce."** — instance fleets diversify
across types/AZs; instance groups bet on one type.

**"Existing code says EMR. New code says Glue."** — the fastest single
heuristic for the EMR-vs-Glue decision.

<a name="step10"></a>
## 10. Practice questions (15)

**Q1.** A data engineering team is migrating an existing production
Spark application, written against Spark 3.x APIs with several custom
JAR dependencies, from an on-prem Hadoop cluster to AWS. The team wants
to avoid rewriting the application. What should they choose?

A) AWS Glue ETL, rewriting the job using DynamicFrames
B) Amazon EMR, which can run the existing Spark application largely unchanged
C) AWS Lambda, splitting the job into multiple 15-minute functions
D) Amazon Managed Service for Apache Flink

**Answer: B.** EMR exposes a real Spark cluster capable of running
existing Spark applications, including custom JARs, largely unchanged
— this is the textbook "existing code" signal for EMR. **A** requires
rewriting into Glue's DynamicFrame-based model, which the team
explicitly wants to avoid. **C** is a poor fit — Lambda's 15-minute
ceiling and stateless model don't suit a full Spark application. **D**
is for stream processing, not migrating a batch Spark application.

**Q2.** An EMR cluster's cost review shows the team configured Spot
pricing across all node types, including the primary node, to minimize
cost. During a recent Spot interruption event, the entire cluster
became unusable and the running job had to be restarted from scratch.
What was misconfigured?

A) Task nodes should never use Spot
B) The primary node should never use Spot — losing it takes down the whole cluster
C) Core nodes should always use Spot for maximum savings
D) EMR does not support Spot pricing at all

**Answer: B.** The primary node coordinates the entire cluster (YARN
ResourceManager, HDFS NameNode); losing it via Spot reclamation kills
the cluster's ability to function, exactly as described. **A** is
backwards — task nodes are the *correct* place for Spot. **C** is
risky, not "always correct," because core nodes hold HDFS data. **D**
is false — EMR fully supports Spot, just not on the primary node.

**Q3.** A team wants to run periodic Spark ETL jobs but doesn't want to
manage EC2 instances, size a cluster, or handle node patching, while
still needing genuine Spark (not Glue's DynamicFrame model) for
compatibility with an existing PySpark codebase. What is the best fit?

A) EMR on EC2 with a persistent cluster
B) EMR Serverless
C) AWS Glue with the Ray engine
D) AWS Lambda with a Spark layer

**Answer: B.** EMR Serverless runs genuine Spark (and Hive) jobs
without any cluster or node management — exactly matches "Spark
compatibility, no infrastructure to manage." **A** still requires
managing cluster lifecycle/sizing decisions, even if functional. **C**
changes the engine, contradicting "existing PySpark codebase"
compatibility needs the same way plain Glue ETL would. **D** — Lambda
cannot practically run a full Spark job; this isn't a real supported
pattern for Spark-scale workloads.

**Q4.** An organization already operates a large, well-managed Amazon
EKS environment for all of its containerized workloads and wants new
big-data processing to integrate with existing Kubernetes-based
monitoring, deployment, and node-management tooling. Which EMR
deployment model fits best?

A) EMR on EC2
B) EMR Serverless
C) EMR on EKS
D) EMR Studio

**Answer: C.** EMR on EKS runs EMR's processing engines as workloads on
an existing Kubernetes/EKS environment, integrating with the
organization's already-standardized Kubernetes tooling — the deciding
factor is the existing Kubernetes investment, not a technical
capability gap in the alternatives. **A** and **B** don't integrate
with the org's Kubernetes-based operational tooling the way EKS-hosted
workloads do. **D** is a development/notebook interface, not a
deployment model for production processing.

**Q5.** A Spark job on an EMR cluster shows in the Spark UI that 95%
of tasks complete in under a minute, but a handful of tasks take over
two hours, and overall job completion is dominated by those few slow
tasks. What is the most likely root cause and fix?

A) Insufficient number of task nodes; add more task nodes
B) Data skew on the shuffle/join key; salt the key or repartition
C) The primary node is undersized; increase its instance type
D) EMRFS is misconfigured; switch to native HDFS only

**Answer: B.** A small number of dramatically slower tasks while the
rest finish quickly is the signature of data skew — a disproportionate
share of data landing on a small number of partitions. Adding more
nodes (A) doesn't help until the skew itself is addressed, because the
slow tasks are bottlenecked on one or a few partitions regardless of
total cluster size. **C** is unrelated — the primary node coordinates,
it doesn't process the skewed partition's data. **D** is a red
herring; EMRFS/HDFS choice isn't the skew mechanism.

**Q6.** A team requests EMR Spot capacity using a single specific EC2
instance type in a single Availability Zone, and finds that job starts
are frequently delayed or fail to acquire capacity during periods of
high regional Spot demand. What change reduces this risk?

A) Switch entirely to On-Demand pricing for all nodes
B) Use instance fleets, specifying multiple eligible instance types and AZs
C) Reduce the number of task nodes requested
D) Move the workload to Lambda instead

**Answer: B.** Instance fleets let EMR provision from whichever of
several specified instance types and AZs currently has available
capacity, directly addressing the single-instance-type/single-AZ
bottleneck described. **A** solves the availability problem but
abandons the cost savings Spot was chosen for — not the best answer
when a targeted fix (fleets) exists. **C** reduces total capacity
needed but doesn't fix the underlying single-type/single-AZ fragility.
**D** is not a viable substitute for a large distributed Spark
workload.

**Q7.** A data engineer needs to install a proprietary geospatial
processing library, not available via standard package managers, onto
every node of an EMR cluster at launch time, including nodes added
later by managed scaling. What EMR feature accomplishes this?

A) EMR Studio
B) A bootstrap action
C) EMRFS custom authorization
D) A Glue connection

**Answer: B.** Bootstrap actions run custom scripts at node launch —
including on nodes added later by managed scaling — making them the
correct mechanism for installing arbitrary software across the fleet.
**A** is a development/notebook interface, unrelated to node
provisioning. **C** controls S3 access, not software installation.
**D** is a Glue-specific connection object, not applicable to EMR node
configuration.

**Q8.** Which combination correctly reflects EMR's default
Availability Zone behavior and the implication for cluster resilience?

A) EMR clusters automatically span multiple AZs with synchronous replication
B) An EMR cluster's nodes run within a single AZ by default; cross-AZ resilience requires additional architecture
C) EMR clusters cannot be placed in a VPC
D) Core nodes are automatically distributed across at least 3 AZs for durability

**Answer: B.** By default, all nodes in an EMR cluster run in a single
AZ (for inter-node network performance); surviving an AZ failure
requires additional design, such as treating clusters as disposable and
relying on S3 (via EMRFS) for durable data, or running multi-primary
configurations. **A** and **D** both describe capabilities EMR doesn't
provide automatically. **C** is false — EMR clusters run inside a VPC.

**Q9.** A finance company runs a nightly batch Spark job processing
approximately 2 PB of transaction data, currently on EMR with
On-Demand pricing throughout. Leadership wants to reduce cost as much
as possible without changing the processing logic or accepting data
loss risk. What is the recommended change?

A) Move the entire workload to AWS Glue for lower cost
B) Switch task nodes to Spot pricing while keeping primary and core nodes On-Demand
C) Switch all nodes, including primary, to Spot pricing for maximum savings
D) Reduce the cluster to a single node to save on instance-hours

**Answer: B.** At this scale, EMR is already the cost-appropriate
engine (A moving to Glue would likely be worse at 2 PB), and the
correct optimization lever is Spot on task nodes specifically — no
durability risk, since task nodes hold no HDFS data, and typically up
to ~90% savings on that portion of the fleet. **C** reintroduces the
primary-node risk covered in Q2. **D** would make a 2 PB nightly job
impractically slow or impossible to complete in the batch window.

**Q10.** A healthcare analytics team needs strong, mutual
authentication across their Hadoop ecosystem tools (Spark, Hive) to
meet an internal security mandate, integrating with an existing
enterprise Kerberos infrastructure. Which processing platform supports
this requirement natively?

A) AWS Glue ETL
B) AWS Lambda
C) Amazon EMR, with Kerberos authentication configured
D) Amazon Managed Service for Apache Flink

**Answer: C.** EMR supports Kerberos authentication across its Hadoop
ecosystem components, a capability specifically relevant to enterprises
with existing Kerberos infrastructure — and one Glue does not offer.
**A**, **B**, and **D** don't provide Kerberos-based cluster
authentication; this is a distinguishing EMR-specific capability.

**Q11.** After a job finishes on a persistent EMR cluster that runs
scheduled batch jobs twice daily, the cluster otherwise sits idle,
generating cost with no work being done. What are two valid approaches
to reduce this idle cost? (Choose the single best answer describing
the most EMR-idiomatic approach.)

A) Manually terminate and relaunch the cluster before and after each job via a script, or use a transient cluster pattern triggered by an orchestrator
B) Leave the cluster running — EMR automatically pauses billing during idle periods
C) Switch the workload to Amazon RDS
D) Increase the number of core nodes to reduce idle time

**Answer: A.** EMR does not automatically pause billing on its own;
either an orchestrated transient-cluster pattern (spin up, run, tear
down, driven by Step Functions/EventBridge/MWAA) or aggressive managed
scaling down to a near-zero floor between jobs is the standard fix for
idle persistent-cluster cost. **B** is false — EMR does not
auto-pause. **C** is a category error; RDS is a relational database,
not a batch processing substitute. **D** would increase, not decrease,
idle cost.

**Q12.** A team needs to run interactive, iterative Spark development
— exploring a dataset, testing transformation logic, visualizing
intermediate results — before packaging a job for production, and
wants Git-based version control on their notebooks. What should they
use?

A) SSH directly into the EMR primary node and edit Python files
B) EMR Studio
C) AWS Glue DataBrew
D) Amazon QuickSight

**Answer: B.** EMR Studio is the purpose-built, web-based, Jupyter-
notebook IDE for interactive Spark development against EMR (including
EMR Serverless), with Git integration for notebook version control.
**A** is a possible but far less productive and less collaborative
approach, with no built-in notebook or Git experience. **C**, Glue
DataBrew, is a no-code visual data-prep tool for business analysts, not
a Spark development notebook. **D**, QuickSight, is a BI/dashboard
tool, unrelated to Spark development.

**Q13.** Which statement correctly distinguishes EMRFS from HDFS in
the context of an EMR cluster reading and writing data in S3?

A) EMRFS replaces S3 entirely with a faster proprietary storage format
B) EMRFS is the layer that lets Hadoop-ecosystem tools on EMR read and write S3 with a consistent, HDFS-like interface, while HDFS remains local, cluster-lifecycle-bound storage
C) HDFS and EMRFS are two names for the same feature
D) EMRFS only supports read operations, never writes

**Answer: B.** EMRFS provides the interface that lets Spark, Hive,
Presto, and other tools interact with S3 as if it were part of the
Hadoop filesystem, while true HDFS storage lives on core node local
disks and disappears when the cluster terminates. **A** is false — S3
remains the actual storage; EMRFS is an access layer, not a
replacement storage format. **C** conflates two distinct concepts. **D**
is false — EMRFS supports both reads and writes.

**Q14.** A cost-conscious team wants to run a large, non-urgent
overnight EMR batch job and is comparing options. Considering
operational overhead and cost together, which combination best fits
"lowest cost, willing to tolerate flexible start time, workload is
Spark/Hive-shaped"?

A) EMR on EC2 with all On-Demand instances
B) AWS Glue with the Flex execution class
C) EMR on EC2 with instance fleets and Spot on task nodes, or EMR Serverless if cluster management is also unwanted
D) Amazon Redshift Serverless

**Answer: C.** For a genuinely Spark/Hive-shaped workload at
meaningful scale where cost matters most and timing flexibility exists,
EMR with Spot-heavy task nodes (via instance fleets for reliability) is
the strongest cost lever; EMR Serverless is a reasonable alternative if
cluster management itself is also unwanted, still within the EMR
family. **A** ignores the cheapest lever available (Spot). **B**, Glue
Flex, is a legitimate "non-urgent, cheapest" answer *for Glue-shaped
ETL* specifically, but the scenario is framed as Spark/Hive workload
territory where EMR is the more natural fit. **D** is a data warehouse
product, not a batch processing engine for this kind of job.

**Q15.** During an exam-style scenario review, a candidate is deciding
between AWS Glue and Amazon EMR for a brand-new customer segmentation
ETL job with no existing codebase, moderate data volume (a few hundred
GB nightly), and a requirement for "least operational overhead." What
should the candidate choose, and why?

A) EMR, because it offers more framework flexibility
B) EMR Serverless, because "serverless" always wins on this exam
C) AWS Glue, because there's no existing framework dependency and the workload doesn't approach the scale where EMR's Spot economics would outweigh Glue's lower operational overhead
D) Either is equally correct; the exam treats them as interchangeable

**Answer: C.** With no existing code to preserve and moderate (not
petabyte) volume, none of the conditions that justify EMR (existing
framework dependency, extreme-scale cost optimization, or an
EMR-only framework need) are present — Glue's lower operational
overhead is the better fit and the exam's consistent default for this
shape of scenario. **A** picks EMR for a flexibility advantage the
scenario doesn't need. **B** over-generalizes "serverless always wins"
without checking whether an EMR-specific need exists at all — the
right question is "does this need EMR," and here it doesn't, so
staying in the Glue-vs-EMR framing at all is the wrong instinct. **D**
is incorrect; the exam consistently expects the reasoning process shown
above, not indifference between the two.
