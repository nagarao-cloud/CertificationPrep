# DECISION-TREES.md

> A decision tree's value **is** its compression. You need to run one in
> eight seconds under exam pressure. So this file doesn't pad the trees —
> it adds **more trees** and, more importantly, **17 worked question
> walkthroughs** in Part 3 where every option is dissected.

## CONTENTS

- [Part 0 — How to use a tree under time pressure](#part-0)
- [Part 1 — The master tree](#part-1)
- [Part 2 — The 16 trees](#part-2)
- [Part 3 — 17 worked walkthroughs (every option explained)](#part-3)
- [Part 4 — Speed-run: all trees on one screen](#part-4)

---

<a name="part-0"></a>
## PART 0 — How to use a tree under time pressure

```
   Read the LAST sentence of the stem   ─── the constraint
                    │
   Read the FIRST sentence              ─── the stage & scale
                    │
   Pick the ONE tree that matches the stage
                    │
   Walk the tree — 2 or 3 nodes, no more
                    │
   Compare your answer to the 4 options
                    │
        ┌───────────┴────────────┐
   It's there              It's not there
        │                        │
   Select it.          You picked the wrong tree,
   Move on.            OR the question has a twist.
                       Re-read the constraint.
```

**The trees are for the 60% of questions where the keyword reflex
doesn't fire.** If `SERVICE-SELECTION-MATRIX.md` Part 1 gave you the
answer instantly, don't walk a tree — just answer and bank the time.

**Two failure modes to watch for:**

1. **Walking too deep.** If you're four nodes in, you've over-thought
   it. The exam rarely requires more than three decisions.
2. **Walking the wrong tree.** "Query the data" and "store the data"
   are different trees. Locating the *stage* first is half the work.

---

<a name="part-1"></a>
## PART 1 — The master tree

Every DEA-C01 question lives at one of six stages. Find the stage, and
two options usually die immediately.

```
                    What is the question actually about?
                                  │
   ┌──────────┬──────────┬────────┼────────┬───────────┬────────────┐
   │          │          │        │        │           │            │
 GETTING   CHANGING   KEEPING  READING  RUNNING    PROTECTING       │
 data in   the data   the data  it      the thing   the data        │
   │          │          │        │        │           │            │
 TREE 1    TREE 3     TREE 4   TREE 2   TREE 7      TREE 8          │
 TREE 5    TREE 12    TREE 9   TREE 10  TREE 13     TREE 14         │
                      TREE 11                       TREE 15         │
                                                                    │
                    ┌───────────────────────────────────────────────┘
                    │
              CROSS-CUTTING: cost (TREE 6), troubleshooting (TREE 13),
              file format (TREE 10), table format (TREE 11),
              catalog (TREE 16)
```

**Stage vocabulary — what phrases signal which stage:**

| Stage | Signal phrases |
|---|---|
| **Ingest** | "collect", "capture", "stream", "replicate", "migrate", "land", "receive from" |
| **Transform** | "process", "convert", "enrich", "aggregate", "clean", "join", "ETL" |
| **Store** | "retain", "archive", "store", "lifecycle", "cost of storage", "durability" |
| **Query/Serve** | "analyze", "query", "report", "dashboard", "BI", "analysts run" |
| **Orchestrate** | "schedule", "workflow", "pipeline", "trigger", "coordinate", "depends on" |
| **Govern/Secure** | "access", "permission", "encrypt", "audit", "PII", "compliance", "who can" |

---

<a name="part-2"></a>
## PART 2 — The 16 trees

---

### TREE 1 — "How do I get this data in?"

```
                    Where is the data coming from?
                                │
        ┌───────────────┬───────┴────────┬──────────────────┐
        │               │                │                  │
   A database      Events/logs      Files on-prem       A SaaS app
        │            streaming            │                  │
        │               │                 │              APPFLOW
        │               │        ┌────────┴────────┐
        │               │        │                 │
        │               │   > 10 TB and       Ongoing sync?
        │               │   low bandwidth?         │
        │               │        │              DATASYNC
        │               │    SNOWBALL          (TRANSFER FAMILY
        │               │                       if SFTP/FTPS)
        │               │
        │        ┌──────┴──────────────────────────┐
        │        │                                 │
        │   Just land it somewhere?          Need replay or
        │   (S3/Redshift/OpenSearch)         multiple consumers?
        │        │                                 │
        │   AMAZON DATA FIREHOSE            ┌──────┴──────┐
        │   (lowest ops, ~60 s buffer)      │             │
        │                              Already use    Greenfield?
        │                              Kafka?              │
        │                                  │        KINESIS DATA
        │                                MSK          STREAMS
        │
   ┌────┴─────────────────────────┐
   │                              │
Is it Aurora MySQL/PostgreSQL,   Anything else
RDS MySQL, or DynamoDB —         (on-prem Oracle,
AND target is Redshift           SQL Server, MongoDB,
or OpenSearch?                   SAP, DB2...)
   │                              │
ZERO-ETL INTEGRATION          AWS DMS
(no pipeline at all)          (full load + CDC)
```

**Boundary you must know:** zero-ETL supports a *specific list* of
sources. Off the list → DMS. AWS tests this boundary directly.

---

### TREE 2 — "How do I query this?"

```
                        Is the data in S3?
                    ┌───────────┴───────────┐
                   NO                      YES
                    │                       │
        ┌───────────┴────────┐              │
        │                    │              │
   Key-value,           Relational          │
   sub-ms?              OLTP?               │
        │                    │              │
   DYNAMODB          AURORA / RDS           │
   (+ DAX for µs)                           │
                                            │
                    ┌───────────────────────┴────────────────┐
                    │                                        │
            How often, and how many concurrent users?        │
                    │                                        │
    ┌───────────────┼──────────────────┐                     │
    │               │                  │                     │
 Occasional,   Hundreds of BI     Already have          Need full-text
 ad-hoc,       users, complex     Redshift and          search or log
 unpredictable joins, sub-second  want to join          analytics?
    │               │             S3 + warehouse?            │
 ATHENA             │                   │                OPENSEARCH
                    │            REDSHIFT SPECTRUM
            ┌───────┴────────┐
        Steady load?    Spiky/intermittent?
            │                 │
    REDSHIFT PROVISIONED   REDSHIFT
    (+ Reserved Instances)  SERVERLESS
```

**The one rule:** data location does **not** decide this. Access
pattern does. Data in S3 + 500 concurrent dashboard users = Redshift,
not Athena.

---

### TREE 3 — "How do I transform this?"

```
                    How long does the job run?
                              │
              ┌───────────────┴───────────────┐
         Under 15 min                    Over 15 min
         and under 10 GB memory               │
              │                               │
         Simple logic?                        │
              │                               │
         AWS LAMBDA           ┌───────────────┴──────────────┐
                              │                              │
                        Is it Spark?                  Needs Hive/Presto/
                              │                       HBase/Flink on cluster?
                    ┌─────────┴─────────┐                    │
                    │                   │                  EMR
            Want Data Catalog    Pure Spark app          (Spot on
            integration, job     with custom deps?        TASK nodes)
            bookmarks, ETL              │
            connectors?          EMR SERVERLESS
                    │
              AWS GLUE ETL
                    │
            Is it streaming?
                    │
        ┌───────────┴────────────┐
    Simple enrich-and-land?   Windowed aggregation,
        │                     event-time, exactly-once?
   GLUE STREAMING                     │
                              MANAGED FLINK

    ⤷ No code at all, business analysts?  → GLUE DATABREW
    ⤷ Non-urgent and cost is king?        → GLUE FLEX
```

---

### TREE 4 — "Where do I store this?"

```
                    What shape is the data?
                              │
   ┌──────────┬───────────────┼──────────────┬──────────────┐
   │          │               │              │              │
 Files /   Key-value      Relational     Analytical      Documents
 objects   lookups        transactions   queries         / search
   │          │               │              │              │
  S3      DYNAMODB      AURORA / RDS     REDSHIFT      OPENSEARCH
   │       (+ DAX for
   │        microseconds)
   │
Does it need updates/deletes?
   │
┌──┴───┐
│      │
NO    YES
│      │
Plain  ICEBERG TABLES
Parquet (ACID, MERGE, time travel,
        row-level DELETE)
```

---

### TREE 5 — "Batch or streaming?"

```
              How fresh must the data be?
                        │
   ┌────────────┬───────┴────────┬──────────────┐
   │            │                │              │
 Sub-second   Seconds        Minutes         Hours / daily
   │            │                │              │
 KINESIS      KINESIS        AMAZON DATA      SCHEDULED BATCH
 DATA         DATA STREAMS   FIREHOSE         (Glue job +
 STREAMS      + MANAGED      or GLUE           EventBridge
 + MANAGED    FLINK          STREAMING         Scheduler)
 FLINK                       or ZERO-ETL

  ⚠️ Cost check: streaming bills CONTINUOUSLY.
     If data arrives once a day, streaming is waste.
```

---

### TREE 6 — "The cost question"

```
        What is the question optimizing?
                      │
   ┌──────────┬───────┴───────┬─────────────┐
   │          │               │             │
Storage    Query          Compute      Data transfer
   │          │               │             │
   │     Reduce data     Idle time        Same-region?
   │     SCANNED:        a problem?       VPC endpoints
   │     • Partition         │            avoid NAT and
   │     • Parquet      ┌────┴────┐       cross-AZ hops
   │     • Compress    YES        NO
   │     • SELECT cols  │          │
   │     • Workgroup   Serverless  Reserved
   │       limits      (Athena,    Instances /
   │                    Glue,      Savings Plans
   │                    EMR Svls,  (Redshift, EMR)
Access pattern known?   Redshift        │
   │                    Svls)      Spot on EMR
┌──┴───┐                            TASK nodes
│      │
YES   NO / it changes
│      │
LIFECYCLE   S3 INTELLIGENT-TIERING
POLICY      (unless billions of tiny
            objects — then compact first)
```

---

### TREE 7 — "How do I orchestrate this?"

```
                Does the team already use Airflow?
                              │
              ┌───────────────┴───────────────┐
             YES                             NO
              │                               │
            MWAA                    Are all the steps Glue?
     (only reason to pay                      │
      for an always-on          ┌─────────────┴─────────────┐
      environment)             YES                         NO
                                │                           │
                        GLUE WORKFLOWS            Is there branching,
                        (free)                    error handling, or
                                                  service integration?
                                                          │
                                            ┌─────────────┴──────────┐
                                           YES                      NO
                                            │                        │
                                   How long / how many?      EVENTBRIDGE
                                            │                 SCHEDULER
                                  ┌─────────┴─────────┐
                              < 5 min,            > 5 min or
                              very high volume    need exactly-once
                                  │                     │
                         STEP FUNCTIONS          STEP FUNCTIONS
                         EXPRESS                 STANDARD
```

---

### TREE 8 — "How do I secure this?"

```
                What are you protecting?
                          │
     ┌────────────┬───────┴────────┬──────────────┐
     │            │                │              │
  Access to   Access to        Encryption      Secrets /
  AWS APIs    lake data          keys         credentials
     │            │                │              │
    IAM           │              KMS              │
   (roles,        │        ┌──────┴──────┐   ┌────┴─────┐
    policies)     │    Need rotation,    │   │          │
                  │    audit, or     AWS-MANAGED  DB creds  Config
     ┌────────────┴──┐ cross-account?    KEY   needing    values
     │               │        │          (free) rotation?   │
 Whole table    Column, row,  │                  │      SSM PARAMETER
 or bucket      or cell       CUSTOMER-      SECRETS      STORE
 enough?        level?        MANAGED KEY    MANAGER    (free tier)
     │               │        (CMK, $1/mo)
 IAM + bucket   LAKE FORMATION
 policy         (LF-Tags + data filters)

  ⤷ Need to FIND sensitive data first?  → MACIE
  ⤷ Need an audit trail of object reads? → CLOUDTRAIL DATA EVENTS
  ⤷ Need a private network path?         → VPC ENDPOINT
       S3 / DynamoDB → GATEWAY (free)
       everything else → INTERFACE (PrivateLink, paid)
```

---

### TREE 9 — "Which S3 storage class?"

```
              How soon might you need it back?
                            │
   ┌───────────┬────────────┼─────────────┬──────────────┐
   │           │            │             │              │
Instantly,  Instantly,  Milliseconds  Minutes-hours   12+ hours
frequently  rarely      but archived  acceptable      acceptable
   │           │            │             │              │
STANDARD   STANDARD-IA   GLACIER      GLACIER        GLACIER
           (30-day min)  INSTANT      FLEXIBLE       DEEP ARCHIVE
                         RETRIEVAL    RETRIEVAL      (180-day min)
                         (90-day min) (90-day min)

  ⤷ Don't know the pattern, or it changes? → INTELLIGENT-TIERING
  ⤷ Reproducible data, want it cheaper?    → ONE ZONE-IA
  ⤷ Extremely high request rate, one AZ OK? → EXPRESS ONE ZONE
```

**The min-duration trap:** transitioning to IA after 7 days *costs
more*, because IA bills a 30-day minimum regardless.

---

### TREE 10 — "Which file format and compression?"

```
              Is this data being WRITTEN or READ?
                            │
              ┌─────────────┴─────────────┐
        Written (ingest,            Read (analytics,
        streaming, landing)          queries, BI)
              │                            │
      Schema changing often?         COLUMNAR
              │                            │
        ┌─────┴─────┐             ┌────────┴────────┐
       YES         NO         Hive-heavy       Everything
        │           │         legacy shop?      else
      AVRO      JSON/CSV           │                │
   (best schema (landing          ORC           PARQUET
    evolution)   only —                        + SNAPPY
                 convert                       (or ZSTD)
                 downstream)
```

```
              COMPRESSION
                    │
      Need splittability? (almost always YES)
                    │
        ┌───────────┴───────────┐
       YES                     NO
        │                       │
  SNAPPY (fastest)         GZIP (best ratio,
  ZSTD (better ratio)      small files only,
  inside Parquet/ORC        NOT splittable
                            standalone)
```

---

### TREE 11 — "Which table format?"

```
        Does the data ever need to CHANGE after it's written?
                            │
              ┌─────────────┴─────────────┐
             NO                          YES
              │                           │
      Append-only logs.          ┌────────┴─────────┐
      Plain Parquet in       Updates/       Streaming
      Hive-style layout      deletes/       upserts,
      is fine.               MERGE,         CDC-heavy?
                             time travel?        │
                                  │           HUDI
                             ICEBERG        (but AWS exams
                             ✅ default      prefer Iceberg)
                             in 2026

  ⤷ GDPR "delete this customer"      → ICEBERG row-level DELETE
  ⤷ "query as of last Tuesday"       → ICEBERG time travel
  ⤷ "change partitioning, no rewrite"→ ICEBERG partition evolution
  ⤷ "rename a column safely"         → ICEBERG schema evolution
```

---

### TREE 12 — "How do I move a database to AWS?"

```
              Is this one-time or ongoing?
                          │
            ┌─────────────┴─────────────┐
        One-time                    Ongoing replication
            │                             │
   Can the source go              Source and target
   offline during the             engine the same?
   migration?                            │
            │                  ┌─────────┴──────────┐
     ┌──────┴──────┐          YES                  NO
    YES           NO           │                    │
     │             │      Is source Aurora     DMS + SCT
  DMS FULL     DMS FULL    MySQL/PostgreSQL,   (SCT converts
  LOAD ONLY    LOAD + CDC   RDS MySQL, or       schema, procs,
               (minimal     DynamoDB, target    functions;
               downtime)    Redshift/           DMS moves data)
                            OpenSearch?
                                  │
                        ┌─────────┴─────────┐
                       YES                 NO
                        │                   │
                  ZERO-ETL             DMS with CDC
                  INTEGRATION
```

---

### TREE 13 — "Why is my pipeline slow or failing?"

```
              Where's the symptom?
                      │
    ┌─────────┬───────┴────────┬──────────────┬────────────┐
    │         │                │              │            │
 Kinesis    Glue            Redshift        Athena      Lambda
    │         │                │              │            │
IteratorAge  Which error?  Queries        Slow and     Throttles?
rising?         │          queuing?       expensive?      │
    │      ┌────┴────┐         │              │       Concurrency
Consumers  OOM    Slow but    Check:      Check:      limit — request
too slow:  │      succeeds     • WLM /     • Partitioned?  increase or
• more     │        │           auto-WLM   • Parquet?      add reserved
  consumers│    Data skew?     • Concurrency• Compressed?  concurrency
• enhanced │        │           scaling    • Small files?     │
  fan-out  │    Repartition,   • DISTKEY   • SELECT *?   Duration
• bigger   │    salt the        skew?          │         near 15 min?
  batch    │    hot key                    Fix the      → move to Glue
  size  Bigger                              FORMAT      or EMR
• more    worker
  shards  (G.2X+)

    ⤷ S3 403 AccessDenied? Check IN THIS ORDER:
      1. IAM identity policy        4. Lake Formation permissions
      2. S3 bucket policy           5. SCP (Organizations)
      3. KMS KEY POLICY ← most missed  6. VPC endpoint policy
```

---

### TREE 14 — "Who should be allowed to see this?"

```
              What granularity does the question describe?
                            │
   ┌────────────┬───────────┴─────────┬──────────────┐
   │            │                     │              │
 "This whole  "These columns"    "These rows"   "Everything in
  bucket"     / "not the SSN"    / "only their   this account"
   │            │                 region"            │
IAM + BUCKET  LAKE FORMATION    LAKE FORMATION     SCP
POLICY        column-level      row-level filter  (Organizations)
              permissions       / cell-level

  ⤷ Thousands of tables to manage?  → LF-TAGS (tag-based access control)
  ⤷ Another AWS account?            → LAKE FORMATION cross-account + RAM
  ⤷ Inside Redshift, not the lake?  → REDSHIFT RLS + dynamic data masking
  ⤷ Inside a QuickSight dashboard?  → QUICKSIGHT ROW-LEVEL SECURITY
```

---

### TREE 15 — "How do I monitor / audit this?"

```
              What question are you answering?
                            │
   ┌────────────┬───────────┴────────┬───────────────┐
   │            │                    │               │
"Is it       "WHO did          "Where is the    "Is it configured
 healthy?"    what, when?"      latency?"        correctly?"
   │            │                    │               │
CLOUDWATCH   CLOUDTRAIL           X-RAY          AWS CONFIG
metrics,        │
alarms,    ┌────┴─────┐
logs       │          │
       Bucket-level  Object-level
       API calls     reads/writes
           │              │
       Management    DATA EVENTS
       events        (OFF by default,
       (on by         costs extra)
        default)

  ⤷ "Alert me when a Glue job fails"  → EVENTBRIDGE RULE → SNS
  ⤷ "Search logs with SQL-like syntax"→ CLOUDWATCH LOGS INSIGHTS
  ⤷ "Are the VALUES in the data valid?"→ GLUE DATA QUALITY (DQDL)
  ⤷ "Does this data contain PII?"      → MACIE
```

---

### TREE 16 — "Which catalog / metadata layer?"

```
              What do you need the catalog to do?
                            │
   ┌────────────┬───────────┴──────────┬────────────────┐
   │            │                      │                │
"Tell engines  "Control who sees    "Let business    "We already run
 what the       which columns"       users discover   a Hive metastore"
 schema is"        │                 and request"         │
   │               │                      │          Migrate to GLUE
GLUE DATA     LAKE FORMATION       DATAZONE /         DATA CATALOG
CATALOG       (sits on top of      SAGEMAKER          (Hive-compatible)
              the Glue Catalog)    CATALOG            or point EMR at it

  Mental model:
    Glue Data Catalog  = WHAT the data is
    Lake Formation     = WHO may see which parts
    DataZone           = WHO OWNS it and how to request access
```

---

<a name="part-3"></a>
## PART 3 — 17 worked walkthroughs

Every option explained. These are constructed in DEA-C01 style to drill
the reasoning pattern — not reproductions of real exam items.

---

### WALKTHROUGH 1 — The Firehose/Streams fork

> A media company collects 200,000 clickstream events per second from
> its website. The events must be stored in Amazon S3 in Apache Parquet
> format for analysis by the analytics team. Data must be available
> within a few minutes. The company wants the **least operational
> overhead**.

**Constraint:** least operational overhead. **Latency budget:** "a few
minutes" = near real-time.

- **A. Kinesis Data Streams → Lambda consumer → convert to Parquet → write to S3.**
  ❌ Works, but you now own a Lambda function, its concurrency, its
  error handling, its DLQ, and shard management. That is the *opposite*
  of least operational overhead.
- **B. Amazon Data Firehose with record format conversion to Parquet, destination S3.** ✅
  **Correct.** Firehose does format conversion natively (using a Glue
  table for the schema), buffers, and delivers. Zero code, zero shards.
- **C. MSK → Kafka Connect S3 sink connector.**
  ❌ Highest operational overhead of all four. Only correct if the
  scenario mentioned existing Kafka.
- **D. Kinesis Data Streams → Managed Flink → S3.**
  ❌ Flink is for windowed computation. There's no aggregation
  requirement here, so this is over-engineering.

**Principle:** "Least operational overhead" + "few minutes" + "land in
S3" = Firehose, every time.

---

### WALKTHROUGH 2 — Same setup, one word changed

> Same scenario, but: "If a defect is found in the enrichment logic, the
> team must be able to **reprocess the previous 48 hours** of events."

- **B. Amazon Data Firehose.**
  ❌ **Now wrong.** Firehose has no retention and no replay. The winning
  answer in Walkthrough 1 is eliminated by a single new sentence.
- **A. Kinesis Data Streams with 48-hour+ retention, consumer writes to S3.** ✅
  **Correct.** Retention enables replay.

**Principle:** requirements *stack*. A later sentence can invalidate an
answer that satisfied every earlier sentence. Read the whole stem before
choosing.

---

### WALKTHROUGH 3 — Athena vs Redshift under concurrency

> A retail company stores 5 years of sales data as Parquet in Amazon S3.
> **400 business analysts** run interactive dashboards throughout the
> business day, with complex joins across 12 tables. Dashboards must
> refresh in **under 2 seconds**.

- **A. Athena with a Glue Data Catalog.**
  ❌ The reflex answer because the data is in S3 — and it's wrong.
  Athena has a concurrent query quota and per-query startup latency; it
  cannot sustain 400 users at sub-2-second response.
- **B. Amazon Redshift with the data loaded into RA3 nodes.** ✅
  **Correct.** MPP warehouse, materialized views, result caching, and
  concurrency scaling all target exactly this profile.
- **C. Athena with partition projection and CTAS.**
  ❌ Both are real optimizations, but they reduce *scan cost and
  planning latency* — they don't solve *concurrency*.
- **D. Amazon OpenSearch Service.**
  ❌ Search engine, not a join engine. Complex 12-table joins are not
  its model.

**Principle:** **data location does not decide the query engine.**
Access pattern does.

---

### WALKTHROUGH 4 — Same data, opposite access pattern

> Same 5 years of Parquet in S3. A **data scientist queries it roughly
> twice a month** for ad-hoc exploration. Minimize cost.

- **B. Redshift.**
  ❌ **Now wrong.** A provisioned cluster bills 24/7 for a workload
  measured in minutes per month.
- **A. Athena.** ✅ **Correct.** Zero idle cost; pay per TB scanned.

**Principle:** Walkthroughs 3 and 4 are the same question mirrored.
Learn the axis (access pattern), not the answer.

---

### WALKTHROUGH 5 — The zero-ETL question

> An e-commerce company runs its order system on **Amazon Aurora
> MySQL**. Analysts need to run reports on order data in Amazon Redshift
> with **near real-time** freshness. The company has a small team and
> wants to **avoid building and maintaining a pipeline**.

- **A. DMS with CDC → S3 → Glue job → Redshift COPY.**
  ❌ Correct architecture for a *different* source. Here it's three
  services and a schedule to maintain, when AWS offers a zero-service
  option.
- **B. Zero-ETL integration between Aurora MySQL and Amazon Redshift.** ✅
  **Correct.** Source is on the supported list, target is Redshift,
  latency is seconds, and there is literally no pipeline to maintain.
- **C. Nightly Glue job over a JDBC connection to Aurora.**
  ❌ Nightly ≠ near real-time. Also puts query load on the production
  OLTP database.
- **D. Aurora → Kinesis Data Streams → Firehose → Redshift.**
  ❌ Aurora doesn't natively emit to Kinesis without DMS or triggers.
  Maximum complexity, no benefit.

**Principle:** memorize the zero-ETL source list. When the source is on
it, every pipeline option becomes a distractor.

---

### WALKTHROUGH 6 — The zero-ETL boundary

> Same requirement, but the order system runs on **on-premises Microsoft
> SQL Server**.

- **B. Zero-ETL.**
  ❌ **Now wrong.** SQL Server is not a supported zero-ETL source.
- **A. DMS with full load + CDC, targeting S3 or Redshift.** ✅ **Correct.**

**Principle:** AWS tests boundaries, not just concepts. Knowing *what
zero-ETL supports* matters as much as knowing what it does.

---

### WALKTHROUGH 7 — Lambda's ceiling

> A company receives a **40 GB compressed file** each night. It must be
> decompressed, validated, transformed, and written to S3 as partitioned
> Parquet. The team wants a serverless solution.

- **A. AWS Lambda triggered by S3 event notification.**
  ❌ 15-minute timeout, 10 GB memory, 10 GB `/tmp`. A 40 GB file
  violates this on multiple axes.
- **B. AWS Glue ETL job triggered by an S3 event via EventBridge.** ✅
  **Correct.** Serverless, no runtime limit, native Parquet and
  partitioning, catalog integration.
- **C. EMR cluster launched nightly.**
  ❌ Not serverless; adds cluster lifecycle management. Would be
  defensible if the question said "existing Spark scripts."
- **D. Lambda that splits the file, then more Lambdas per chunk.**
  ❌ The splitter itself must read 40 GB inside 15 minutes. Also a
  custom-orchestration smell — AWS rarely rewards this.

**Principle:** check Lambda's three hard limits before selecting it.
"Serverless" in the stem does not automatically mean Lambda.

---

### WALKTHROUGH 8 — The Glue OOM

> A Glue ETL job processing 500 GB fails with
> `java.lang.OutOfMemoryError`. It uses 10 G.1X workers.

- **A. Increase the number of G.1X workers from 10 to 40.**
  ❌ More workers = more parallelism, **not more memory per executor**.
  If a single partition doesn't fit in 16 GB, it still won't.
- **B. Change the worker type to G.2X.** ✅
  **Correct — and the first thing to try.** G.2X doubles memory per
  worker to 32 GB.
- **C. Enable job bookmarks.**
  ❌ Bookmarks control *which data* is processed, not how much memory
  each executor has.
- **D. Convert the source data to CSV.**
  ❌ Actively harmful — CSV is larger, uncompressed, and not columnar.

**Follow-up AWS likes:** if G.2X also OOMs, the cause is **data skew**
— one partition is enormous. Fix by repartitioning or salting the key.

---

### WALKTHROUGH 9 — The gzipped CSV

> Athena queries over 200 GB of **gzip-compressed CSV** in S3 take 45
> minutes. Improve performance and reduce cost.

- **A. Increase the Athena workgroup's query concurrency limit.**
  ❌ Concurrency affects how many queries run at once, not how fast one
  query runs.
- **B. Convert to Parquet with Snappy compression and partition by date.** ✅
  **Correct.** Three wins: columnar (scan fewer columns), splittable
  (real parallelism), partitioned (prune whole days).
- **C. Compress the CSVs with BZIP2 instead.**
  ❌ BZIP2 *is* splittable, so it's a partial improvement — but it's the
  slowest codec and leaves you on a row-based text format. Classic
  "half-right" distractor.
- **D. Move the data to Standard-IA to reduce storage cost.**
  ❌ Addresses storage cost, not query cost or performance. Athena
  charges by data scanned regardless of storage class.

**Principle:** gzipped CSV is **not splittable** → one worker reads the
whole file → no amount of capacity helps. It's a format problem.

---

### WALKTHROUGH 10 — Crawler vs partition projection

> An Athena table has **4 million partitions** in `s3://bucket/year=/month=/day=/hour=/`.
> A Glue crawler runs hourly and now takes over an hour and costs
> significantly. Queries are also slow to plan.

- **A. Run the crawler daily instead of hourly.**
  ❌ Reduces cost but breaks freshness — new partitions won't be
  queryable for up to a day.
- **B. Enable Athena partition projection on the table.** ✅
  **Correct.** Partition locations are computed from the configured
  date pattern. No crawler, no catalog lookups, instant planning.
- **C. Run `MSCK REPAIR TABLE` after each load.**
  ❌ Scans all partition paths in S3 — even slower than the crawler at
  4 million partitions.
- **D. Reduce partition granularity from hourly to daily.**
  ❌ Plausible and sometimes good advice, but it changes query
  semantics and loses hour-level pruning. Projection solves the stated
  problem without that tradeoff.

---

### WALKTHROUGH 11 — The GDPR delete

> A company stores customer events as **Parquet in Hive-style
> partitions** in S3, queried by Athena. Under privacy regulation, it
> must delete all records for a specific customer within 30 days.
> Requests arrive several times per week.

- **A. A Glue job that rewrites every affected partition without the
  customer's rows.**
  ❌ Technically works — but it's expensive, slow, and error-prone at
  several requests per week, and creates consistency windows during
  rewrite.
- **B. Migrate the table to Apache Iceberg and use `DELETE FROM`.** ✅
  **Correct.** Iceberg supports row-level deletes natively with ACID
  guarantees. This is precisely the problem Iceberg was built for.
- **C. S3 lifecycle policy to expire objects.**
  ❌ Lifecycle deletes objects by **age**, not by content. It cannot
  target one customer's rows.
- **D. Store the data in DynamoDB and delete items by key.**
  ❌ Re-platforming an analytics workload onto an OLTP key-value store.
  Solves deletion, destroys the analytics use case.

---

### WALKTHROUGH 12 — The Redshift skew

> A Redshift fact table with 8 billion rows uses `DISTKEY(country_code)`.
> Three of ten nodes show far higher CPU than the rest, and joins are slow.

- **A. Add more nodes to the cluster.**
  ❌ Scaling out a skewed distribution just adds idle nodes. The three
  hot slices stay hot.
- **B. Change the distribution key to a high-cardinality column used in
  joins (e.g. `order_id`), or use `DISTSTYLE AUTO`.** ✅
  **Correct.** `country_code` has few distinct values, so KEY
  distribution concentrates rows on few slices. That *is* the skew.
- **C. Change to `DISTSTYLE ALL`.**
  ❌ ALL replicates the whole table to every node. On 8 billion rows
  that's catastrophic. ALL is for **small dimension tables**.
- **D. Add an interleaved sort key.**
  ❌ Sort keys address range-filter pruning, not data placement across
  slices. Wrong lever entirely.

**Principle:** DISTKEY = joins and placement. SORTKEY = range filters.
Skew is always a distribution problem.

---

### WALKTHROUGH 13 — The S3 403

> A Glue job fails with `AccessDenied` reading from S3. The job's IAM
> role has `s3:GetObject` and `s3:ListBucket` on the bucket, and the
> bucket policy explicitly allows the role. The bucket uses SSE-KMS
> with a customer-managed key.

- **A. Add `s3:*` to the IAM role.**
  ❌ The S3 permissions are already correct, and this violates least
  privilege.
- **B. Grant the Glue role `kms:Decrypt` (and `kms:GenerateDataKey` for
  writes) in the **KMS key policy**.** ✅
  **Correct.** SSE-KMS objects require **both** S3 permissions and KMS
  key access. This is the single most-tested troubleshooting item in
  Domain 4.
- **C. Disable bucket encryption.**
  ❌ Never the answer. Removes a security control to fix a permissions
  gap.
- **D. Make the bucket public.**
  ❌ Catastrophically wrong. Any "make it public" option is a distractor.

**Check order to memorize:** IAM → bucket policy → **KMS key policy** →
Lake Formation → SCP → VPC endpoint policy.

---

### WALKTHROUGH 14 — Column-level security

> Analysts must query a `customers` table in the data lake but must
> **not** see the `ssn` and `date_of_birth` columns. Other teams need
> full access. Minimize operational effort.

- **A. Create a second S3 copy of the table without those columns.**
  ❌ Data duplication, storage cost, and a synchronization problem
  forever. AWS never prefers copies for access control.
- **B. Use Lake Formation to grant column-level `SELECT` on all columns
  except `ssn` and `date_of_birth`.** ✅
  **Correct.** One grant, no data movement, enforced consistently
  across Athena, Redshift Spectrum, EMR, and Glue.
- **C. Write an IAM policy denying access to those columns.**
  ❌ **IAM has no concept of a column.** It operates on buckets,
  prefixes, and API actions.
- **D. Create an Athena view excluding the columns and grant access to
  the view.**
  ❌ Partially works, but analysts could query the underlying table
  directly unless separately denied — and it doesn't carry to other
  engines. Views are access *convenience*, not access *control*.

---

### WALKTHROUGH 15 — Orchestration overhead

> A pipeline runs six steps with conditional branching and needs
> automatic retries with exponential backoff. The team has **no Airflow
> experience** and wants the **least operational overhead**.

- **A. Amazon MWAA.**
  ❌ An always-on environment to size, patch, and version-upgrade — and
  the team doesn't know Airflow. Nothing in the stem justifies it.
- **B. AWS Step Functions Standard workflow.** ✅
  **Correct.** Serverless, native `Retry`/`Catch` with backoff,
  `Choice` states for branching, 200+ service integrations, full
  execution history.
- **C. A Lambda function that calls each step in sequence.**
  ❌ Custom orchestration code, plus the 15-minute ceiling on the
  orchestrator itself.
- **D. Cron on an EC2 instance.**
  ❌ Maximum operational overhead; single point of failure.

**Principle:** MWAA is *managed*, not *overhead-free*. It wins only on
"existing Airflow DAGs" or "complex Python dependencies."

---

### WALKTHROUGH 16 — The cost question with a known pattern

> Log files are queried heavily for 30 days, occasionally for the next
> 60 days, and then must be retained for 7 years for compliance with
> retrieval acceptable within 12 hours. Minimize cost.

- **A. S3 Intelligent-Tiering for all objects.**
  ❌ The access pattern is **explicitly stated**. Paying a per-object
  monitoring fee to discover a pattern you already know is waste.
- **B. Lifecycle policy: Standard → Standard-IA at 30 days → Glacier
  Deep Archive at 90 days, expire at 7 years.** ✅
  **Correct.** Matches every stated tier, and 12-hour retrieval is
  exactly Deep Archive's standard SLA.
- **C. Lifecycle to Glacier Instant Retrieval at 30 days.**
  ❌ GIR costs more than Deep Archive and buys millisecond retrieval
  the question never asked for.
- **D. Keep everything in S3 Standard and use lifecycle to delete at 7 years.**
  ❌ Pays hot-storage prices for 7 years of cold data.

**Principle:** known pattern → lifecycle. Unknown pattern →
Intelligent-Tiering. Then match retrieval SLA to class.

---

### WALKTHROUGH 17 — The multi-response question

> A streaming pipeline is dropping records during traffic spikes.
> `WriteProvisionedThroughputExceeded` is elevated. **Select TWO**
> actions that will address this.

- **A. Increase the number of shards in the stream.** ✅
  **Correct.** The metric is a *producer-side* throttle: ingest
  capacity is exceeded.
- **B. Switch the stream to on-demand capacity mode.** ✅
  **Correct.** On-demand auto-scales and removes shard planning
  entirely.
- **C. Enable enhanced fan-out.**
  ❌ EFO addresses **consumer** read throughput. This is a write-side
  problem.
- **D. Increase the consumer's batch size.**
  ❌ Also consumer-side. Would help `IteratorAge`, not write throttling.
- **E. Add a Lambda DLQ.**
  ❌ Handles *processing* failures downstream; does nothing about
  records rejected at ingest.

**Principle:** on multi-response items, identify the **side** of the
pipeline the metric belongs to. Three of these five options are
consumer-side distractors for a producer-side symptom. And selecting
three answers when it says TWO scores zero — no partial credit.

---

<a name="part-4"></a>
## PART 4 — Speed-run: all trees on one screen

```
INGEST      DB? → zero-ETL (Aurora/RDS-MySQL/DynamoDB) else DMS
            Stream? → land only = Firehose | replay/multi-consumer = Streams
                      existing Kafka = MSK
            Files? → DataSync | SFTP = Transfer Family | huge = Snowball
            SaaS? → AppFlow

TRANSFORM   <15 min = Lambda
            Spark + catalog = Glue | pure Spark = EMR Serverless
            Hive/Presto/HBase = EMR (Spot on TASK nodes)
            Windows/exactly-once = Managed Flink
            No code = DataBrew | cheap + non-urgent = Glue Flex

STORE       Objects = S3 | key-value = DynamoDB | OLTP = Aurora
            OLAP = Redshift | search = OpenSearch
            Needs updates? = Iceberg

QUERY       Occasional = Athena | concurrent BI = Redshift
            Spiky = Redshift Serverless | have cluster + S3 join = Spectrum

ORCHESTRATE Existing Airflow = MWAA | Glue-only = Glue Workflows
            Branching/retries = Step Functions (Express if <5min & high vol)
            Just a schedule = EventBridge Scheduler

SECURE      APIs = IAM | columns/rows = Lake Formation
            Keys = KMS CMK | rotation = Secrets Manager | config = Param Store
            Find PII = Macie | private path = VPC endpoint (gateway = free)

MONITOR     Health = CloudWatch | who did it = CloudTrail (DATA events for S3)
            Latency = X-Ray | config drift = Config | data validity = Glue DQ

COST        Known pattern = lifecycle | unknown = Intelligent-Tiering
            Query cost = partition + Parquet + compress + compact
            Compute = Spot (task nodes) or serverless or Reserved
```
