# EXAM-GUIDE.md — DEA-C01 (July 2026)

## CONTENTS

- [Part 1 — Exam format and logistics](#p1)
- [Part 2 — Scoring: what 720 actually means](#p2)
- [Part 3 — Domain weights and your hour budget](#p3)
- [Part 4 — Domain 1 in full (34%)](#p4)
- [Part 5 — Domain 2 in full (26%)](#p5)
- [Part 6 — Domain 3 in full (22%)](#p6)
- [Part 7 — Domain 4 in full (18%)](#p7)
- [Part 8 — In-scope service list](#p8)
- [Part 9 — Out-of-scope and low-yield](#p9)
- [Part 10 — Renamed and retired services](#p10)
- [Part 11 — Recommended candidate profile (and why you can ignore part of it)](#p11)
- [Part 12 — Self-assessment checklist](#p12)

---

<a name="p1"></a>
## PART 1 — Exam format and logistics

| Item | Value |
|---|---|
| Exam code | **DEA-C01** |
| Level | Associate |
| Questions | **65** (a subset are unscored pilot items — indistinguishable) |
| Time | **130 minutes** |
| Pace | ~2:00 per question |
| Question types | Multiple choice (1 of 4), multiple response (2+ of 5 or 6) |
| Scoring | Scaled **100–1000**, pass at **720** |
| Cost | **$150 USD** + tax |
| Delivery | Pearson VUE test center **or** online proctored |
| Languages | English, Japanese, Korean, Simplified Chinese (and others — check at booking) |
| Retake policy | **14-day** wait between attempts, no lifetime cap |
| Validity | 3 years |

### Logistics that actually cost people points

- **ESL accommodation.** If English is not your first language, you can
  request **+30 minutes** — free. It must be requested and approved
  **before** you book the exam, and approval is not instant. Do this
  today if it applies.
- **Online proctored setup.** Join **30 minutes early**. System checks,
  ID scanning, and room scans are the number-one cause of avoidable
  exam-day stress. Requirements: clear desk, closed door, no second
  monitor, no phone, no notes, nobody entering the room.
- **Test center.** Two forms of ID, one photo. Arrive 30 minutes early.
- **Book the date now.** A booked date stops the "one more day of
  studying" spiral, which is the most common failure mode of a 10-day
  sprint.

---

<a name="p2"></a>
## PART 2 — Scoring: what 720 actually means

```
   100 ─────────────────────────────────────────── 1000
                                    │
                                   720
                                  PASS
```

Three facts that reduce exam-day panic:

1. **Scoring is compensatory.** You do **not** need to pass each domain
   individually — only the total. A weak Domain 4 can be offset by a
   strong Domain 1. The per-domain feedback on your score report is
   diagnostic only.

2. **720/1000 is roughly 70–75% correct.** You can miss around 16–18
   questions and still pass comfortably. You are *allowed* not to know
   things.

3. **Some questions don't count.** A subset of the 65 are unscored
   pilot items being trialled for future exams. You cannot tell which.
   So when you hit a bizarre question that seems to test something
   obscure, there's a real chance it isn't even scored. Flag it, move on.

**There is no penalty for a wrong answer.** Never leave a question
blank. A blind guess on a 4-option question is 25%; an educated guess
after eliminating two options is 50%.

---

<a name="p3"></a>
## PART 3 — Domain weights and your hour budget

```
Domain 1: Data Ingestion and Transformation   ████████████████░  34%
Domain 2: Data Store Management               ████████████░░░░░  26%
Domain 3: Data Operations and Support         ██████████░░░░░░░  22%
Domain 4: Data Security and Governance        ████████░░░░░░░░░  18%
```

| Domain | Weight | Questions (of 65) | Hours (of 50) |
|---|---|---|---|
| 1 — Ingestion & Transformation | 34% | ~22 | **17 h** |
| 2 — Data Store Management | 26% | ~17 | **13 h** |
| 3 — Operations & Support | 22% | ~14 | **11 h** |
| 4 — Security & Governance | 18% | ~12 | **9 h** |

**The single biggest planning error** people make on this exam is
studying all four domains equally. Domain 1 is worth nearly twice
Domain 4. Glue, Kinesis/Firehose, DMS, and the orchestration services
deserve roughly a third of your total time.

---

<a name="p4"></a>
## PART 4 — Domain 1: Data Ingestion and Transformation (34%)

### Task statements

- **1.1 — Perform data ingestion**
- **1.2 — Transform and process data**
- **1.3 — Orchestrate data pipelines**
- **1.4 — Apply programming concepts**

### 1.1 Perform data ingestion

**Knowledge required:**
- Throughput and latency characteristics of every AWS ingestion service
- Batch vs streaming ingestion patterns and when each applies
- Replayability of data ingestion pipelines
- Stateful vs stateless data transactions
- Fan-in and fan-out patterns

**Skills required:**
- Read from and write to streaming sources (Kinesis Data Streams, MSK,
  Amazon Data Firehose, DynamoDB Streams, Managed Flink)
- Configure batch ingestion (Glue, EMR, DMS, AppFlow)
- Handle throttling, rate limits, and backpressure
- Implement replayability
- Configure scheduled vs event-driven ingestion

**Services to know cold:**
Kinesis Data Streams · **Amazon Data Firehose** · Amazon MSK · MSK
Connect · **AWS DMS** (+ SCT) · **zero-ETL integrations** · AppFlow ·
DataSync · Transfer Family · Snow Family · IoT Core · SQS · SNS ·
EventBridge · DynamoDB Streams

### 1.2 Transform and process data

**Knowledge required:**
- Creating ETL pipelines based on business requirements
- Volume, velocity, and variety tradeoffs
- Cloud vs on-premises transformation
- Data structure, format, and schema handling
- Optimizing container usage for performance

**Skills required:**
- Optimize container usage (EKS, ECS) for pipeline performance
- Connect to different data sources (JDBC, ODBC)
- Integrate data from multiple sources
- Optimize costs while processing
- Transform data between formats (CSV → Parquet)
- Troubleshoot and debug transformation failures
- Create data APIs to make data available to other systems

**Services:** AWS Glue (ETL jobs, Streaming, crawlers, bookmarks,
Studio, DataBrew, Flex) · Amazon EMR (EC2, Serverless, on EKS) ·
**Managed Service for Apache Flink** · AWS Lambda · Amazon Redshift
(COPY/UNLOAD) · Athena (CTAS)

### 1.3 Orchestrate data pipelines

**Knowledge required:**
- How to integrate AWS services into pipelines
- Event-driven architecture
- Configuring AWS services for scheduled vs event-driven work
- Serverless workflows

**Skills required:**
- Use orchestration services (Step Functions, MWAA, EventBridge, Glue
  workflows, Lambda) to build workflows
- Build pipelines for performance, availability, scalability,
  resiliency, and fault tolerance
- Implement and maintain serverless workflows
- Use notification services (SNS, SQS) for alerts

### 1.4 Apply programming concepts

**Knowledge required:**
- CI/CD (implementation, testing, deployment)
- SQL queries for transformations and data source interaction
- Infrastructure as code (CloudFormation, CDK, SAM)
- Distributed computing concepts
- Data structures and algorithms (graph and tree traversal, at a basic level)
- SQL query optimization

**Skills required:**
- Optimize code to reduce runtime for ingestion and transformation
- Configure Lambda for concurrency and performance
- Perform SQL queries (including window functions and CTEs)
- Structure SQL for transformations
- Use Git for version control
- Use SageMaker Studio / notebooks for data exploration
- Package and deploy serverless applications

### Concepts likely to appear as scenarios

Idempotency · exactly-once vs at-least-once · DLQs and poison messages
· retries with exponential backoff · data skew · the small-file problem
· schema evolution and drift · partition pruning and predicate pushdown
· ETL vs ELT · CDC patterns

---

<a name="p5"></a>
## PART 5 — Domain 2: Data Store Management (26%)

### Task statements

- **2.1 — Choose a data store**
- **2.2 — Understand data cataloging systems**
- **2.3 — Manage the lifecycle of data**
- **2.4 — Design data models and schema evolution**

### 2.1 Choose a data store

**Knowledge required:**
- Storage platforms and their characteristics
- Storage services and configurations for specific performance demands
- Data services and formats for each storage platform
- How to align data storage with data migration requirements
- How to determine the appropriate storage solution for specific access patterns
- How to manage locks to prevent access to data

**Skills required:**
- Implement the appropriate storage services for specific cost and
  performance requirements
- Configure the appropriate storage services for specific access patterns
- Apply storage services to appropriate use cases
- Integrate migration tools into data processing systems
- Implement data migration or remote access methods (Redshift federated
  query, Redshift data sharing, Athena federated query)

**Services:** S3 (all classes) · Redshift (RA3, Serverless, Spectrum,
data sharing) · Athena · DynamoDB (+ DAX) · Aurora / RDS · OpenSearch ·
DocumentDB · Neptune · Timestream · Keyspaces · MemoryDB · EFS · FSx

### 2.2 Understand data cataloging systems

**Knowledge required:**
- How to create a data catalog
- Data classification based on requirements

**Skills required:**
- Use data catalogs to consume data from the data source
- Build and reference a data catalog (Glue Data Catalog, Hive metastore)
- Discover schemas and use Glue **crawlers** to populate catalogs
- **Synchronize partitions** with a data catalog
- Create new source or target connections for cataloging

### 2.3 Manage the lifecycle of data

**Knowledge required:**
- Appropriate storage solutions for hot and cold data
- How to optimize the cost of storage based on the data lifecycle
- How to delete data to meet business and legal requirements
- Data retention policies and archiving strategies
- How to protect data with appropriate resiliency and availability

**Skills required:**
- Perform load and unload operations between S3 and Redshift
- Manage **S3 lifecycle policies** to change storage tiers
- Use lifecycle policies to expire data
- Manage S3 **versioning** and DynamoDB **TTL**

### 2.4 Design data models and schema evolution

**Knowledge required:**
- Data modeling concepts
- How to ensure accuracy and trustworthiness using data lineage
- Best practices for indexing, partitioning, compression
- How to model structured, semi-structured, and unstructured data
- Schema evolution techniques

**Skills required:**
- Design schemas for Redshift, DynamoDB, and Lake Formation
- Address changes to the characteristics of data
- Perform schema conversion (SCT, DMS Schema Conversion)
- Establish data lineage using AWS tools

**Concepts:** star vs snowflake schemas · fact and dimension tables ·
SCD Types 1/2/3 · normalization vs denormalization for analytics ·
**Apache Iceberg** / Hudi / Delta · columnar formats · compression ·
partitioning and bucketing · Glue Schema Registry

---

<a name="p6"></a>
## PART 6 — Domain 3: Data Operations and Support (22%)

### Task statements

- **3.1 — Automate data processing by using AWS services**
- **3.2 — Analyze data by using AWS services**
- **3.3 — Maintain and monitor data pipelines**
- **3.4 — Ensure data quality**

### 3.1 Automate data processing

**Knowledge required:**
- How to maintain and troubleshoot data processing for repeatable business outcomes
- API calls for data processing
- Which services accept scripting (EMR, Redshift, Glue)

**Skills required:**
- Orchestrate pipelines (MWAA, Step Functions)
- Troubleshoot Amazon-managed workflows
- Call SDKs to access Amazon features from code
- Use features of AWS services to process data (EMR, Redshift, Glue)
- Consume and maintain data APIs
- Prepare data transformation (DataBrew)
- Query data (Athena)
- Use IaC for repeatable deployments (CDK, CloudFormation)

### 3.2 Analyze data

**Knowledge required:**
- Tradeoffs between provisioned and serverless services
- SQL queries
- How to visualize data for analysis
- When and how to apply cleansing techniques
- Data aggregation, rolling average, grouping, pivoting

**Skills required:**
- Visualize data using AWS services and tools (**QuickSight**, Glue
  DataBrew)
- Verify and clean data
- Use Athena to query data or create views
- Use Athena notebooks with Apache Spark

### 3.3 Maintain and monitor pipelines

**Knowledge required:**
- How to log application data
- Best practices for performance tuning
- How to log access to AWS services
- Amazon Macie, CloudTrail, and CloudWatch

**Skills required:**
- Extract logs for audits
- Deploy logging and monitoring solutions to facilitate auditing and tracing
- Detect and troubleshoot performance issues
- Use **CloudWatch Logs** to log application data
- Use **CloudTrail** to track API calls
- Troubleshoot and maintain pipelines
- Use Amazon Macie, CloudTrail, and CloudWatch to monitor and audit

### 3.4 Ensure data quality

**Knowledge required:**
- Data sampling techniques
- How to implement data skew mechanisms
- Data validation (completeness, consistency, accuracy, integrity)
- Data profiling

**Skills required:**
- Run data quality checks while processing (empty fields, abnormal values)
- Define data quality rules (**AWS Glue DataBrew**, **Glue Data Quality / DQDL**)
- Investigate data consistency

**The metrics table** — know one signature metric per service. See
`SERVICE-SELECTION-MATRIX.md` Part 16.

---

<a name="p7"></a>
## PART 7 — Domain 4: Data Security and Governance (18%)

### Task statements

- **4.1 — Apply authentication mechanisms**
- **4.2 — Apply authorization mechanisms**
- **4.3 — Ensure data encryption and masking**
- **4.4 — Prepare logs for audit**
- **4.5 — Understand data privacy and governance**

### 4.1 Authentication

**Knowledge:** VPC security networking concepts · differences between
managed and unmanaged services · authentication methods (password-based,
certificate-based, role-based) · differences between **IAM roles and IAM
users**

**Skills:** update VPC security groups · create and update IAM
groups, roles, endpoints, and services · create and rotate credentials
with **Secrets Manager** · set up IAM roles for access · apply IAM
policies to roles, endpoints, and services

### 4.2 Authorization

**Knowledge:** authorization methods (ABAC, RBAC, policy-based) ·
methods to protect data from unauthorized access · which services apply
authorization

**Skills:** create custom IAM policies when a managed policy doesn't
fit · store application and database credentials (Secrets Manager,
Parameter Store) · provide database users, groups, and roles access ·
manage permissions through **Lake Formation** (Redshift, EMR, Athena,
S3)

### 4.3 Encryption and masking

**Knowledge:** data encryption options for analytics services ·
differences between **client-side and server-side** encryption ·
protecting sensitive data · data anonymization, masking, key salting

**Skills:** apply data masking and anonymization per compliance laws ·
use encryption keys to encrypt/decrypt (**KMS**) · configure encryption
across account boundaries · enable encryption in transit

### 4.4 Prepare logs for audit

**Knowledge:** how to log application data · how to log access to AWS
services · centralized AWS logs

**Skills:** use **CloudTrail** to track API calls · use **CloudWatch
Logs** to store application logs · use **AWS CloudTrail Lake** for
centralized logging queries · analyze logs with AWS services (Athena,
CloudWatch Logs Insights, OpenSearch) · integrate various AWS services
to perform logging · use **Amazon Macie** to detect sensitive data

### 4.5 Data privacy and governance

**Knowledge:** how to protect PII · data sovereignty

**Skills:** grant permissions for data sharing (Redshift data sharing) ·
implement PII identification (**Macie** with Lake Formation) · implement
data privacy strategies to prevent backups or replication to
unauthorized regions · manage configuration changes (**AWS Config**)

---

<a name="p8"></a>
## PART 8 — In-scope service list

Organized the way AWS groups them. Depth column: **★★★** = know cold,
**★★** = know the decision criteria, **★** = recognize what it does.

### Analytics
| Service | Depth |
|---|---|
| Amazon Athena | ★★★ |
| Amazon EMR | ★★★ |
| AWS Glue (ETL, Catalog, crawlers, DataBrew, Data Quality) | ★★★ |
| Amazon Kinesis Data Streams | ★★★ |
| Amazon Data Firehose | ★★★ |
| Amazon Managed Service for Apache Flink | ★★ |
| Amazon MSK | ★★ |
| Amazon OpenSearch Service | ★★ |
| Amazon QuickSight | ★★ |
| AWS Lake Formation | ★★★ |
| Amazon Redshift | ★★★ |
| AWS Data Exchange | ★ |
| Amazon DataZone | ★ |

### Application Integration
| Service | Depth |
|---|---|
| Amazon EventBridge | ★★★ |
| AWS Step Functions | ★★★ |
| Amazon MWAA | ★★ |
| Amazon SQS | ★★ |
| Amazon SNS | ★★ |
| Amazon AppFlow | ★★ |
| AWS Glue Workflows | ★★ |

### Compute
| Service | Depth |
|---|---|
| AWS Lambda | ★★★ |
| Amazon EC2 | ★ |
| AWS Batch | ★ |
| AWS Serverless Application Repository | ★ |

### Containers
| Service | Depth |
|---|---|
| Amazon ECS / EKS | ★ |
| AWS Fargate | ★ |

### Database
| Service | Depth |
|---|---|
| Amazon DynamoDB | ★★★ |
| Amazon RDS / Aurora | ★★ |
| Amazon Redshift (also analytics) | ★★★ |
| Amazon DocumentDB | ★ |
| Amazon Neptune | ★ |
| Amazon Keyspaces | ★ |
| Amazon MemoryDB | ★ |

### Developer Tools
| Service | Depth |
|---|---|
| AWS CDK / CloudFormation | ★★ |
| AWS CLI / SDKs | ★★ |
| AWS CodePipeline / CodeBuild / CodeDeploy | ★ |
| AWS Cloud9 | ★ |
| AWS X-Ray | ★★ |

### Machine Learning
| Service | Depth |
|---|---|
| Amazon SageMaker | ★ |
| Amazon Comprehend / Textract | ★ |

### Management and Governance
| Service | Depth |
|---|---|
| Amazon CloudWatch (metrics, Logs, Logs Insights, alarms) | ★★★ |
| AWS CloudTrail | ★★★ |
| AWS Config | ★★ |
| AWS Well-Architected Tool | ★ |
| AWS Budgets / Cost Explorer | ★★ |
| AWS Systems Manager (Parameter Store) | ★★ |
| AWS Organizations (SCPs) | ★★ |

### Migration and Transfer
| Service | Depth |
|---|---|
| AWS DMS (+ SCT) | ★★★ |
| AWS DataSync | ★★ |
| AWS Transfer Family | ★★ |
| AWS Snow Family | ★★ |
| AWS Application Discovery Service | ★ |

### Networking and Content Delivery
| Service | Depth |
|---|---|
| Amazon VPC (endpoints: gateway vs interface) | ★★★ |
| AWS PrivateLink | ★★ |
| Amazon Route 53 | ★ |
| Amazon CloudFront | ★ |
| AWS Direct Connect | ★ |

### Security, Identity, and Compliance
| Service | Depth |
|---|---|
| AWS IAM | ★★★ |
| AWS KMS | ★★★ |
| AWS Secrets Manager | ★★★ |
| Amazon Macie | ★★★ |
| AWS Lake Formation (also analytics) | ★★★ |
| AWS RAM | ★★ |
| AWS WAF / Shield | ★ |
| Amazon GuardDuty / Inspector | ★ |
| AWS Audit Manager | ★ |

### Storage
| Service | Depth |
|---|---|
| Amazon S3 (all classes, lifecycle, versioning, replication, Object Lock) | ★★★ |
| Amazon S3 Glacier | ★★★ |
| Amazon EFS | ★★ |
| Amazon FSx (Lustre, Windows, NetApp ONTAP, OpenZFS) | ★★ |
| Amazon EBS | ★ |
| AWS Backup | ★ |
| AWS Storage Gateway | ★ |

---

<a name="p9"></a>
## PART 9 — Out-of-scope and low-yield

**Explicitly out of scope** (from the exam guide's philosophy — these
are tasks a data engineer wouldn't own):

- Building ML models from scratch or tuning hyperparameters
- Front-end or full-stack application development
- Network engineering beyond VPC endpoints and security groups
- Designing an entire enterprise security posture
- Writing production Java/Scala Spark from memory

**Low-yield — do not spend a day here:**

- Deep IAM policy JSON syntax memorization. Know the **evaluation
  order** and the concepts; you will not be asked to write a policy
  document from scratch.
- SQL syntax minutiae. Recognize window functions and CTEs. You will
  not be asked to debug a 40-line query.
- Exact pricing figures. Know the **cost model** (per TB scanned, per
  DPU-hour, per shard-hour) and the **relative** ordering. Nobody is
  asked "what is the exact dollar cost."
- Neptune, Timestream, Keyspaces, DocumentDB internals. Recognize the
  one-line use case and move on.
- Kafka internals beyond partitions, consumer groups, and lag.

---

<a name="p10"></a>
## PART 10 — Renamed and retired services

If an option uses an old or dead name, it is almost always a distractor.

| Old name | Current name (2026) |
|---|---|
| Kinesis Data Firehose | **Amazon Data Firehose** |
| Kinesis Data Analytics | **Amazon Managed Service for Apache Flink** |
| Amazon Elasticsearch Service | **Amazon OpenSearch Service** |
| AWS Data Pipeline | **Retired** — answer is Step Functions / MWAA / Glue workflows |
| AWS Glue Elastic Views | **Discontinued** — never the answer |
| Redshift AQUA | Absorbed / deprecated — don't pick it |
| Amazon Kinesis Video Streams | Still exists, but out of scope for DEA-C01 |
| Lake Formation governed tables | Superseded by **Apache Iceberg** tables |

---

<a name="p11"></a>
## PART 11 — Recommended candidate profile

AWS suggests 2–3 years of data engineering experience and 1–2 years of
hands-on AWS. You may not have that. Here's the honest read:

**What that experience actually buys you** is *pattern recognition* —
having felt the pain of a skewed Spark job or a 3 a.m. Redshift queue
backup, so the scenario descriptions feel familiar rather than
abstract.

**You can substitute for it** by doing volume on scenario questions and
dissecting every wrong option. That's why the 10-day plan puts 75
minutes of practice questions in every single day. It is deliberately
building the pattern library that experience would otherwise have
given you.

**What you cannot substitute for** is understanding *why* AWS
recommends one service over another. Memorizing "Firehose = streaming"
gets you maybe 40%. Understanding "Firehose trades replay for zero
operational overhead" gets you the ones that matter.

---

<a name="p12"></a>
## PART 12 — Self-assessment checklist

Tick these off before Day 9's mock exam. If you can't do one from
memory, it goes straight onto your Weak Topics Dashboard.

**Domain 1**
- [ ] Compute shards needed from a records/sec + record-size figure
- [ ] State three things that eliminate Firehose from consideration
- [ ] Explain full load vs CDC vs full-load-plus-CDC in DMS
- [ ] List every zero-ETL source and target pair
- [ ] Name Lambda's three hard limits
- [ ] Explain what a Glue job bookmark does and how you'd reprocess history
- [ ] Say which EMR node type gets Spot and why
- [ ] Choose between Step Functions Standard and Express with a reason

**Domain 2**
- [ ] Choose between Athena and Redshift from an access-pattern description
- [ ] Explain when Spectrum beats Athena
- [ ] Name the four Redshift distribution styles and when each applies
- [ ] Explain sort key vs distribution key in one sentence each
- [ ] State the min-duration for IA, Glacier, and Deep Archive
- [ ] Explain Intelligent-Tiering vs lifecycle policy
- [ ] List four things Iceberg does that Hive tables can't
- [ ] Explain GSI vs LSI including the creation-time constraint

**Domain 3**
- [ ] Name the signature CloudWatch metric for six services
- [ ] Explain what a rising `IteratorAge` means and three fixes
- [ ] Distinguish CloudWatch vs CloudTrail vs X-Ray vs Config
- [ ] Describe the first three things you check on a failing Glue job
- [ ] Explain what Glue Data Quality does that Macie doesn't

**Domain 4**
- [ ] Recite the IAM policy evaluation order
- [ ] Explain why IAM cannot do column-level lake security
- [ ] List the six things to check on an S3 403, in order
- [ ] Explain when you need a customer-managed KMS key
- [ ] Distinguish Secrets Manager from Parameter Store in one sentence
- [ ] Say which VPC endpoints are free and for which services
- [ ] Explain why CloudTrail alone won't tell you who read an object
