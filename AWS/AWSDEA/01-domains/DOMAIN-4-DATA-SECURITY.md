# Domain 4 — Data Security and Governance (18%)

> Task statements: **4.1** Apply authentication mechanisms · **4.2**
> Apply authorization mechanisms · **4.3** Ensure data encryption and
> masking · **4.4** Prepare logs for audit · **4.5** Understand data
> privacy and governance.
>
> Smallest domain by weight (18%, ~12 of 65 questions) but the one
> candidates most consistently under-study, because it *feels* like
> generic cloud security. It isn't — every question is anchored to a
> **data** scenario: who may see which columns of which table, how a
> credential got to a Glue job, whether a read of an S3 object shows up
> in an audit trail. Treat this domain as "IAM and KMS, but for a data
> lake and a warehouse," not as a general security cert refresher.

## CONTENTS

1. [Domain-level 8-step pass](#step-0)
2. [Master guard rails](#guardrails)
3. [Task 4.1 — Authentication](#t41)
4. [Task 4.2 — Authorization](#t42)
5. [Task 4.3 — Encryption and masking](#t43)
6. [Task 4.4 — Prepare logs for audit](#t44)
7. [Task 4.5 — Data privacy and governance](#t45)
8. [Decision trees](#trees)
9. [Mnemonics](#mnemonics)
10. [Domain 4 cheat sheet](#cheatsheet)
11. [Practice question bank — 40 questions](#questions)

---

<a name="step-0"></a>
## 1. Domain-level 8-step pass

### Step 1 — Explain like I'm 12

Imagine your data lake is a huge school library. **Authentication** is
the librarian checking your student ID at the door — *are you really
you?* **Authorization** is the librarian checking the rules — *even
though you're a real student, are you allowed in the restricted
reference section?* **Encryption** is putting the sensitive books in a
locked case so that even someone who breaks into the library at night
can't read them without the key. **Audit logs** are the sign-in sheet
that proves who walked in and which shelf they touched. **Governance**
is the school's overall policy for who's allowed to check out which
books, and making sure a book about a student in Texas never
accidentally gets shipped to a library in another country that isn't
allowed to have it.

### Step 2 — Explain technically

Domain 4 maps almost one-to-one onto the AWS shared responsibility
model as it applies to analytics workloads. AWS secures the
infrastructure (the library building); you secure identity
(authentication), permissions (authorization), data-at-rest and
in-transit protection (encryption), traceability (audit logging), and
regulatory placement of data (governance/sovereignty). Every AWS
analytics service — Glue, Redshift, Athena, EMR, Lake Formation — sits
on top of the same four primitives: **IAM** for identity and coarse
permissions, **KMS** for keys, **CloudTrail/CloudWatch** for
observability, and a **data-aware permission layer** (Lake Formation,
Redshift RLS/CLS, DynamoDB fine-grained access) for anything IAM alone
cannot express — namely column-, row-, and cell-level access.

### Step 3 — Explain like a Senior AWS Data Engineer

A senior engineer's mental model for this domain is a **stack of
gates**, not a single wall:

```
Network gate  ─▶  Identity gate  ─▶  Permission gate  ─▶  Data gate  ─▶  Audit gate
(SG / NACL /       (IAM auth:         (IAM authz:          (Lake Formation /   (CloudTrail /
 VPC endpoint)      who are you?)      what CAN you do?)     column/row/cell)    what DID you do?)
```

Every layer answers a different question, and a candidate who has only
memorized "IAM = security" fails the harder questions because IAM
genuinely cannot answer the data-gate question — **IAM has no concept
of a column**. The senior instinct is: reach for IAM for
service-to-service and coarse bucket/API access; reach for **Lake
Formation** (or Redshift's native RLS/column masking) the moment a
requirement mentions "except column X" or "only rows where region =
Y." A second senior instinct: **prefer roles over users, and
short-lived credentials over long-lived ones, everywhere** — an IAM
user with an access key sitting in a Glue job's environment variables
is treated as a finding in a real security review, not a style choice.

### Step 4 — Explain production architecture

```
                         +-------------------------+
                         |   AWS Organizations      |
                         |   (SCPs — org-wide deny) |
                         +------------+--------------+
                                      |
                        applies to all accounts below
                                      v
   +----------------+       +------------------+       +-------------------+
   | Human Users     | ---> | IAM Identity      | ---> | IAM Roles          |
   | (analysts, eng) |      | Center / IAM Users |      | (assumed, temp)    |
   +----------------+       +------------------+       +---------+----------+
                                                                   |
                                        assumed by services below  |
                                                                   v
   +----------------+     +----------------+     +----------------+     +----------------+
   | Glue Job Role   | --> | Redshift Role  | --> | Athena/Lake Fmn| --> | EMR Role        |
   +----------------+     +----------------+     +----------------+     +----------------+
            |                      |                      |                      |
            v                      v                      v                      v
   +---------------------------------------------------------------------------------+
   |                     S3 Data Lake (SSE-KMS, bucket policy, Object Lock)          |
   |             Lake Formation permissions: column / row / cell filters             |
   +---------------------------------------------------------------------------------+
            |
            v
   +----------------+     +----------------+     +----------------+
   | CloudTrail      | --> | CloudWatch     | --> | CloudTrail Lake /|
   | (API calls)     |     | Logs (app logs)|     | Athena (audit SQL)|
   +----------------+     +----------------+     +----------------+
```

Reading this top to bottom: **AWS Organizations SCPs** act as an
account-wide ceiling that no identity policy can exceed — they're
usually where "prevent replication to disallowed regions" gets
enforced. Human users authenticate through **IAM Identity Center**
(preferred over long-lived IAM users) and then **assume IAM roles**
scoped to a task. Every AWS service in the pipeline — Glue, Redshift,
Athena/Lake Formation, EMR — runs under its **own service role**, never
a shared one, so a compromised Glue job can't pivot into Redshift
credentials. All of those roles ultimately touch the **S3 data lake**,
which is protected by both **encryption** (SSE-KMS) and a
**data-aware permission layer** (Lake Formation) that IAM alone cannot
express. Finally, every layer emits events into the **audit chain**:
CloudTrail captures *who called which API*, CloudWatch Logs captures
*what the application itself logged*, and CloudTrail Lake / Athena let
you run SQL over both retroactively.

### Step 5 — Exam traps (domain-wide)

- ⚠️ Treating **IAM** as capable of column-level or row-level
  filtering. It cannot — the answer is always **Lake Formation** (data
  lake) or **Redshift RLS/dynamic data masking** (warehouse).
- ⚠️ Confusing **Security Groups** (stateful, attached to
  resources/ENIs) with **NACLs** (stateless, attached to subnets).
- ⚠️ Picking **SSE-S3** when the question says "audit key usage" or
  "customer-controlled rotation" — SSE-S3 has no CloudTrail key-usage
  trail and no customer control.
- ⚠️ Assuming **CloudTrail alone** shows who *read* an S3 object.
  Object-level reads require **data events**, off by default and
  billed separately.
- ⚠️ Picking **Secrets Manager** when the honest constraint is "lowest
  cost" and no rotation is needed — that's **Parameter Store**.
- ⚠️ Forgetting the **IAM policy evaluation order** — a resource-based
  policy allow does not override an explicit deny, and SCPs are a
  ceiling, never a grant.
- ⚠️ Picking a general **AWS-managed KMS key** for a requirement about
  cross-account sharing — only a **customer-managed key (CMK)** has a
  key policy you can share.

### Step 6 — Interview questions (domain-wide, senior-level)

- *"Walk me through what happens, security-wise, when a Glue job reads
  from an encrypted S3 bucket and writes to Redshift."* — Expect a
  candidate to trace: Glue assumes its IAM role → role's policy allows
  `s3:GetObject` on the prefix → KMS key policy + IAM policy both allow
  `kms:Decrypt` (both must agree) → role also must be granted through
  Lake Formation if LF governs that table → Redshift COPY assumes its
  own role for `s3:GetObject` and `kms:Decrypt` on write.
- *"Why can't you use a bucket policy to restrict access to a single
  column of a Parquet file?"* — Because S3 has no concept of a column;
  it serves objects. Column awareness requires a query engine (Athena,
  Redshift Spectrum) plus a governance layer (Lake Formation) sitting
  between the engine and the catalog.
- *"How would you prove, after the fact, which analyst downloaded a
  specific customer's PII from S3 last quarter?"* — CloudTrail **data
  events** for that bucket, queried retroactively via **CloudTrail
  Lake** (SQL) or Athena over the trail's S3 logs, cross-referenced
  with Lake Formation grant history if the read was mediated by Lake
  Formation-governed access.
- *"A team wants to share ten curated tables with a partner account
  without copying data. What are your options and how do you choose?"*
  — Lake Formation cross-account grants (table/column/row level, uses
  AWS RAM under the hood) versus Redshift data sharing (if the data
  lives in a warehouse) versus a plain S3 bucket policy (coarsest,
  least governable). Choice depends on whether fine-grained filtering
  is required and whether the data is in S3 or Redshift.

### Step 7 — Cheat sheet

See the [full Domain 4 cheat sheet](#cheatsheet) at the end of this
file — it consolidates every scenario-to-answer mapping from all five
task statements in one scannable block.

### Step 8 — Memory tricks

See the [dedicated mnemonics section](#mnemonics). The headline one:
**"AAEAG"** — **A**uthenticate, **A**uthorize, **E**ncrypt, **A**udit,
**G**overn — is the order the five task statements were written in,
and it's also the logical order a request flows through a secured
pipeline.

---

<a name="guardrails"></a>
## 2. Master guard rails

Run every Domain 4 question through these five filters, in order,
before reading the answer options.

```
#1 WHAT SECURITY LAYER IS THIS QUESTION ABOUT?
   Authentication (4.1) -> "who/what are you"
   Authorization  (4.2) -> "what are you allowed to do"
   Encryption     (4.3) -> "can someone read the raw bytes"
   Audit          (4.4) -> "prove who did what, when"
   Governance     (4.5) -> "PII, region, ownership, sharing policy"

#2 IDENTITY OR RESOURCE?
   Human access      -> IAM User (legacy) / IAM Identity Center (current best practice)
   Service access     -> IAM Role (always — never long-lived keys)
   Resource-based      -> S3 bucket policy / KMS key policy / Lake Formation grant

#3 TEMPORARY OR LONG-TERM?
   Default answer: prefer IAM Roles (temporary STS credentials)
   over IAM Users with long-lived access keys. If an option
   contains a hardcoded access key/secret key, it is the trap.

#4 WHAT STATE IS THE DATA IN?
   At rest       -> KMS (SSE-KMS / DSSE-KMS / customer-managed key)
   In transit    -> TLS / HTTPS / SSL
   Cross-account -> KMS key POLICY (grants), not IAM alone

#5 WHAT'S THE AUDIT REQUIREMENT?
   "Who called an API"          -> CloudTrail (management events)
   "Who read/wrote an object"   -> CloudTrail DATA events
   "Application-level logging"  -> CloudWatch Logs
   "Historical audit SQL query" -> CloudTrail Lake
   "Find sensitive data itself" -> Amazon Macie
```

---

<a name="t41"></a>
## 3. Task 4.1 — Apply authentication mechanisms

Authentication answers one question: **"are you really who/what you
claim to be?"** Everything downstream (authorization, encryption,
audit) assumes this step already happened correctly.

### 4.1.1 Update VPC security groups

**Purpose.** Security Groups (SGs) are **stateful, instance/ENI-level
virtual firewalls** that control inbound and outbound traffic for the
resources attached to them (EC2, RDS, Redshift, Lambda-in-VPC, EMR
nodes, Glue ENIs).

```
   [ Glue ENI ]  --SG allows outbound 5432--> [ RDS Security Group ]
        ^                                              |
        |------------- SG allows inbound 5432 ---------|
                    (return traffic auto-allowed: STATEFUL)
```

The arrow out of the Glue ENI is permitted because the Glue job's
security group has an **outbound rule** allowing port 5432 to the
RDS security group. The **inbound rule on the RDS security group**
must separately allow traffic *from* the Glue security group (SGs can
reference other SGs as the source, which is the standard pattern for
service-to-service access inside a VPC — cleaner than hardcoding CIDR
ranges). Because SGs are **stateful**, the *return* traffic from RDS
back to Glue is automatically allowed without a matching outbound rule
on the RDS side.

**Senior engineer take.** Referencing a security group ID as the
source/destination (instead of a CIDR block) is the production
pattern — it means the rule keeps working if the peer's IP changes
(autoscaling, replacement instances) and it self-documents *which*
service is allowed to talk to which. A common real mistake: opening
`0.0.0.0/0` on a database security group "temporarily" for testing and
forgetting to revert it — this is one of the most common findings in
AWS security audits at companies like retail and healthcare firms
running Redshift clusters inside a VPC.

**Exam traps.**
- ⚠️ SGs are **stateful**; **NACLs are stateless** and require explicit
  inbound *and* outbound rules, and are evaluated in numbered-rule
  order at the **subnet** boundary, not the instance boundary.
- ⚠️ SGs support **allow rules only** — there is no explicit deny in a
  security group (that's what NACLs are for).
- SG changes take effect **immediately**; there's no propagation delay
  to reason about like there sometimes is with IAM.

| Attribute | Security Group | Network ACL |
|---|---|---|
| Scope | Instance / ENI | Subnet |
| State | **Stateful** (return traffic auto-allowed) | **Stateless** (must allow both directions) |
| Rule type | Allow only | Allow **and** deny |
| Evaluation | All rules evaluated | **Numbered order**, first match wins |
| Default | Deny all inbound, allow all outbound | Allow all in/out (default NACL) |
| Exam favorite | "Glue/EMR/Lambda needs to reach RDS/Redshift" | "block a specific IP range at the subnet" |

### 4.1.2 Create and update IAM groups, roles, endpoints, and services

**Purpose.** These are the four building blocks of AWS identity for a
data pipeline: **IAM Groups** bundle human users for policy
management, **IAM Roles** are assumable identities (the correct choice
for anything that isn't a permanent human), **VPC Endpoints** give
private network paths to AWS services, and **service-linked
configuration** wires a specific AWS service (Glue, EMR, Redshift) to
the role/endpoint combination it needs.

| Principal type | IAM Group | IAM Role |
|---|---|---|
| Human users (analysts, engineers) | ✅ Standard use | ✅ Via IAM Identity Center (preferred over group + user) |
| AWS service (Glue, Lambda, EMR) | ❌ Not applicable | ✅ **Only** correct choice |
| Temporary/cross-account access | ❌ | ✅ `sts:AssumeRole` |
| Credential lifetime | Long-lived (attached user's keys) | **Short-lived** (STS tokens, auto-expiring) |

```
   IAM Role  ---(trust policy allows)--->  Lambda / Glue / EC2 / EMR
        |
        +--(permission policy attached)--> what the ROLE may do once assumed
```

The **trust policy** on a role answers "who/what may assume me" (e.g.,
`glue.amazonaws.com`); the **permission policy** answers "what may I
do once assumed" (e.g., `s3:GetObject` on a specific prefix). Mixing
these up — putting S3 permissions in the trust policy, for example —
is a common early-career mistake and shows up as a distractor option
on harder exam questions.

**Senior engineer take.** In production, the number of standing IAM
**users** with console/API access should trend toward zero for
anything programmatic. A senior engineer's checklist for a new
pipeline component always starts with "what role does this assume,"
never "what user does this run as." At a bank or healthcare company
under SOC 2 / HIPAA audit, IAM users with long-lived access keys are
routinely flagged and require a documented exception.

### 4.1.3 Create and rotate credentials with Secrets Manager

**Purpose.** AWS Secrets Manager stores, encrypts, and — critically —
**automatically rotates** credentials (database passwords, API keys,
OAuth tokens) on a schedule, without any application code change
beyond calling the Secrets Manager API/SDK.

```
   Application/Glue Job --GetSecretValue--> Secrets Manager --decrypt via--> KMS
                                                   |
                                          rotation Lambda (built-in
                                          for RDS/Aurora/Redshift/DocumentDB)
                                                   |
                                                   v
                                       updates the DB password AND
                                       the secret value, atomically
```

The application never sees or stores the raw password — it calls
`GetSecretValue` at runtime. Secrets Manager's **built-in rotation
Lambda** (AWS provides these for RDS, Aurora, Redshift, and DocumentDB
out of the box) changes the database-side password and the
Secrets-Manager-side value **together**, so there's no window where
they're out of sync. KMS decrypts the secret on retrieval — every
secret in Secrets Manager is encrypted at rest by KMS, no opt-out.

**Per-service checklist — Secrets Manager**

| Dimension | Detail |
|---|---|
| Purpose | Store + auto-rotate credentials and other secrets |
| When to use | DB credentials, API keys, anything needing scheduled rotation, cross-account secret sharing |
| When NOT to use | Static, non-sensitive config values (cost — use Parameter Store) |
| Advantages | Built-in rotation for RDS/Aurora/Redshift/DocumentDB, resource policies for cross-account, versioning, fine-grained IAM |
| Limitations | 64 KB max secret size; cost per secret per month + API calls |
| Pricing | ~$0.40/secret/month + $0.05 per 10,000 API calls (order of magnitude — exact figures not tested) |
| Performance | Millisecond retrieval; cache client-side (AWS SDK caching library) to avoid throttling on hot paths |
| Scaling | Scales automatically; watch API call volume on very high-frequency Lambda invocations |
| Security | KMS-encrypted always; resource policies enable cross-account access |
| HA | Multi-AZ by design (regional service) |
| Failure scenarios | Rotation Lambda fails mid-rotation → secret and DB can desync; monitor rotation failure alarms |
| Common mistakes | Not caching the secret client-side, causing throttling; rotating a secret used by many services simultaneously without staggering |
| Exam traps | Picking this for "lowest cost" scenarios — Secrets Manager is never the cheap answer |
| Enterprise example | A healthcare claims-processing pipeline rotates its Aurora PostgreSQL master password every 30 days automatically, with zero application downtime, satisfying HIPAA credential-rotation requirements |

### 4.1.4 Set up IAM roles for access

**Common role-assumption chains a data engineer builds:**

```
   API Gateway --invokes with--> Lambda Execution Role --> DynamoDB (read/write)
   EventBridge --triggers-->     Step Functions Role     --> Glue StartJobRun
   Glue Job    --assumes-->      Glue Service Role        --> S3 + KMS + Lake Formation
   Redshift    --assumes-->      Redshift COPY/UNLOAD Role --> S3
```

Each arrow represents a **role assumption**, not a hardcoded
credential. API Gateway never holds DynamoDB credentials — it invokes
Lambda, and Lambda's *execution role* (attached at function
configuration time, assumed automatically by the Lambda service) is
what actually has the DynamoDB permissions. The same pattern repeats
for every service in a pipeline: the **calling service never carries
the downstream permission itself** — it assumes a role that has it.

**Best practice, stated plainly:** never put an AWS access key ID /
secret access key into application code, a Glue job script, an
environment variable, or a config file checked into source control.
If an exam option describes hardcoding keys "for simplicity," it is
always the wrong answer, regardless of what other constraint the
question mentions.

### 4.1.5 Apply IAM policies to roles, endpoints, and services

**Purpose.** A policy is the JSON document that actually grants or
denies actions; it can be attached to a role, evaluated alongside a
VPC endpoint policy, or attached to a resource itself.

```
   IAM Policy (attached to Role) --> IAM Role --> S3 Bucket (specific prefix)
   VPC Endpoint Policy            --> Endpoint --> which S3 buckets are reachable AT ALL through this endpoint
```

The **IAM policy on the role** answers "can this principal call
`s3:GetObject`." The **endpoint policy on a VPC endpoint** is a
*separate, additional* gate that answers "can traffic to S3 even leave
through this network path" — both must allow the action for it to
succeed when traffic goes through an endpoint that has a restrictive
policy attached. This is a real exam trap: a role can have full S3
permissions and still fail if the VPC endpoint policy scopes access to
a different bucket.

| | Managed policy | Inline policy |
|---|---|---|
| Reusability | ✅ Attach to many principals | ❌ Tied to one principal |
| Versioning | ✅ Up to 5 versions kept | ❌ No version history |
| AWS-managed option | ✅ (e.g., `AmazonS3ReadOnlyAccess`) | N/A |
| Customer-managed option | ✅ Best practice for reusable custom policies | — |
| Best use case | Standard, repeated permission sets | One-off, tightly scoped exception |
| Exam favorite | "reusable across multiple roles" | "strictly scoped to one resource, never reused" |

### 4.1.6 Differences between managed and unmanaged services

**Purpose.** Understanding this distinction lets you correctly answer
"who's responsible for patching/scaling/HA" questions, which is a
recurring Domain 4 flavor even though it looks like a Domain 1
question.

| Managed | Unmanaged (self-run) | AWS example pair |
|---|---|---|
| AWS patches the OS/engine | You patch it | Glue vs. self-managed Spark on EC2 |
| Auto-scaling built in | You configure scaling | Redshift Serverless vs. self-hosted warehouse |
| No server to SSH into | You manage the server | Lambda vs. EC2 |
| AWS handles HA/failover | You architect HA yourself | DynamoDB vs. self-managed NoSQL cluster |

**Senior engineer take.** "Managed" doesn't mean "no security
responsibility" — it means the **line moves**. With a managed service,
AWS secures the infrastructure and the patching; you still own IAM
policy correctness, encryption key choice, and network placement (VPC
subnets, security groups). This is the shared responsibility model
applied at the service level, and it's exactly why Domain 4 questions
about "who configures X" show up paired with otherwise-Domain-1
services.

### 4.1.7 SageMaker Unified Studio domains, domain units, and projects

**Purpose.** This is AWS's newer governance hierarchy for collaborative
data/ML work, unifying what used to be split across SageMaker Studio
and Amazon DataZone.

```
   Enterprise Domain
        |
        +-- Domain Unit: Finance
        |         +-- Project: Q3 Forecasting  --> Users, data assets, compute
        |
        +-- Domain Unit: Marketing
                  +-- Project: Campaign Analytics --> Users, data assets, compute
```

A **Domain** is the top-level governance boundary for an organization
or business unit. **Domain Units** subdivide it (mirroring org
structure — Finance, Marketing, etc.), each with its own
administrators and default permissions. **Projects** are where actual
collaborative work happens — a project has its own IAM role, its own
scoped data-asset access, and its own member list. This hierarchy is
the mechanism for "give this team access only to their own data
assets and compute, managed by their own team lead, without a central
team provisioning every permission by hand" — the answer whenever a
question describes multi-team self-service data science governance at
scale.

**Exam trap.** Don't confuse a **Project** (a working unit with actual
member access) with a **Domain Unit** (an organizational grouping,
generally without direct data access itself).

---

<a name="t42"></a>
## 4. Task 4.2 — Apply authorization mechanisms

Authorization answers: **"now that we know who you are, what are you
allowed to do?"** This is where most of the domain's hardest questions
live, because IAM's limits become the whole point.

### 4.2.1 Create custom IAM policies when a managed policy doesn't fit

**When to use.** AWS-managed policies (`AmazonS3FullAccess`,
`AmazonAthenaFullAccess`, etc.) are almost always **broader** than any
real production requirement. The moment a scenario says "least
privilege," "only this prefix," "read but not delete," or "this
specific table," the managed policy is disqualified and a **custom
policy** is the answer.

```
   Custom Policy: { "Effect": "Allow",
                     "Action": ["s3:GetObject"],
                     "Resource": "arn:aws:s3:::lake/finance/*" }
        |
        v
   Attached to: Analyst Role
        |
        v
   Result: read-only access to ONE prefix, nothing else in the bucket
```

This policy grants exactly one action (`GetObject`, not
`PutObject`/`DeleteObject`) scoped to exactly one prefix
(`finance/*`), which is what "least privilege" concretely looks like
in JSON — not a description, an actual narrowed `Resource` ARN and
`Action` list.

**Senior engineer take.** In real production reviews, the very first
thing flagged is a role with `"Resource": "*"` and
`"Action": "s3:*"` attached "temporarily" that never got narrowed.
Writing the custom policy at the *start* of a project, even if it
takes ten extra minutes, avoids the retrofit — which in a regulated
environment (banking, healthcare) can require a full re-audit.

### 4.2.2 Store application and database credentials

This is one of the two or three most exam-favorite comparisons in the
entire certification. Give it the full table.

| Dimension | **Secrets Manager** | **Parameter Store — Standard** | **Parameter Store — Advanced** |
|---|---|---|---|
| Automatic rotation | ✅ Built-in for RDS/Aurora/Redshift/DocumentDB; custom Lambda for anything else | ❌ None (would need to build your own) | ❌ None |
| Cost | ~$0.40/secret/month + API calls | **Free** | ~$0.05/parameter/month |
| Max value size | 64 KB | 4 KB | 8 KB |
| Cross-account sharing | ✅ Resource-based policies | ❌ Not natively | ❌ Not natively |
| Encryption | ✅ KMS, always on | Optional (must choose `SecureString` type) | Optional (`SecureString`) |
| Versioning | ✅ Native, tracks staged labels (`AWSCURRENT`/`AWSPREVIOUS`) | ✅ Basic version history | ✅ Basic version history |
| Native RDS/Redshift integration | ✅ First-class, used directly by RDS console | ❌ Manual | ❌ Manual |
| Parameter policies (expiration, notification) | ❌ | ❌ | ✅ |
| Best use case | DB credentials, API keys needing rotation | Non-secret config values, cheap secure strings | Larger config blobs needing policies |
| Exam favorite trigger | "**automatically rotate** database credentials" | "**most cost-effective** way to store configuration" | rare — usually a distractor |

**The tiebreaker, stated once and for all:** if the question mentions
**rotation**, the answer is Secrets Manager, full stop, regardless of
cost framing elsewhere in the stem. If the question's *only* real
constraint is **cost** and rotation is never mentioned, the answer is
Parameter Store. If both rotation *and* cost-sensitivity appear
together as separate requirements for *different* pieces of data (a
DB password vs. a feature-flag value), the correct answer is often
"**use both**" — Secrets Manager for the credential, Parameter Store
for the config — and that combination itself is sometimes a correct
option on multi-select questions.

**Senior engineer take.** A subtlety worth internalizing: you *can*
technically store a database password in Parameter Store as a
`SecureString`, and it's encrypted at rest — but you get **no
automatic rotation**, meaning a human (or custom automation you build
and maintain) has to rotate it. Parameter Store isn't "insecure," it's
"rotation is your problem." That's the actual decision axis, more than
raw security.

### 4.2.3 Provide database users, groups, and roles access

**Redshift authorization architecture:**

```
   Users  -->  Groups  -->  (or)  Roles  -->  GRANT on Schema/Table
```

Redshift supports both the classic **users-in-groups** model
(`CREATE GROUP analysts; GRANT SELECT ON finance.orders TO GROUP
analysts;`) and a newer **role-based** model closer to standard RBAC,
where roles can be granted to users or other roles and can be mapped
to IAM roles for federated access. **Best practice: grant privileges
to groups/roles, never to individual users directly** — when someone
joins or leaves the analytics team, you change their group/role
membership once instead of re-granting or revoking a dozen individual
table permissions.

**Exam trap.** Redshift's native GRANT system operates at the
schema/table/column level *inside* the warehouse — it is a different
mechanism from **Lake Formation**, which governs access to data still
sitting in S3 that Redshift Spectrum or Athena queries externally. A
question about "who can query which Redshift table" is native
Redshift GRANTs; a question about "who can query which S3-based
external table" is Lake Formation.

### 4.2.4 Manage permissions through Lake Formation

**Purpose.** Lake Formation is the centralized, **data-aware**
permission layer that sits on top of the Glue Data Catalog and governs
what Athena, Redshift Spectrum, EMR, and Glue jobs may actually see —
down to the column, row, and cell.

```
   Lake Formation Permissions
        |
        +--> Athena       (query engine enforces LF grants at query time)
        +--> Redshift      (Spectrum honors LF grants on external tables)
        +--> EMR            (with LF integration enabled)
        +--> Glue           (jobs reading via the Catalog respect LF grants)
        |
        v
   Underlying S3 data location permissions
   (who may even register/point at this S3 path)
```

Lake Formation doesn't replace IAM — it **adds a second permission
check** specifically for catalog-registered data. A principal must
pass **both** the IAM check (can this role call the Glue/Athena APIs
at all) **and** the Lake Formation check (does this principal have a
grant on this specific database/table/column/row) to see data. This is
why "IAM allows it but the analyst still can't see the column" is a
realistic, testable scenario — Lake Formation is the missing grant.

**Per-service checklist — Lake Formation**

| Dimension | Detail |
|---|---|
| Purpose | Centralized, fine-grained (column/row/cell) governance over catalog-registered lake data |
| When to use | Multiple teams/analysts need different visibility into the same tables; column-level PII restriction; cross-account data lake sharing |
| When NOT to use | Data not registered in the Glue Data Catalog; simple single-team, single-bucket scenarios where a bucket policy suffices |
| Advantages | Column/row/cell filters, LF-Tags for tag-based access at scale, native cross-account sharing via AWS RAM, works across Athena/Redshift/EMR/Glue uniformly |
| Limitations | Only governs catalog-registered resources; adds a layer of complexity/administration; requires careful IAM + LF permission co-design (or hybrid mode during migration) |
| Pricing | No separate LF charge — pay for underlying compute (Athena scan, Redshift, EMR) as usual |
| Performance | Negligible query-time overhead; permission check happens at plan time |
| Scaling | LF-Tags scale to thousands of tables without per-table grant sprawl |
| Security | Grants are principal + resource + permission level (SELECT, DESCRIBE, etc.), auditable |
| HA | Regional managed service, no cluster to manage |
| Failure scenarios | Migrating from pure-IAM to LF without using hybrid access mode can lock out existing pipelines mid-migration |
| Common mistakes | Forgetting that LF grants are **additive to**, not a replacement for, underlying S3/IAM permissions in non-hybrid setups; granting at the table level when column-level was required |
| Exam traps | "IAM already allows full bucket access, why can't the analyst see column X" → because column-level security requires LF, IAM cannot do it |
| Enterprise example | A retail company gives regional managers row-level access to only their own region's sales table, and masks the customer-loyalty-ID column for everyone except the loyalty team — all via one set of LF-Tags applied to a single shared table, no data duplication |

### 4.2.5 Authorization methods — RBAC, ABAC, policy-based

| Method | Grants based on | Example | Best for |
|---|---|---|---|
| **RBAC** (Role-Based) | Job function / static role | "Analyst role" gets SELECT on curated tables; "Engineer role" gets DDL rights | Stable org structures, small number of well-defined roles |
| **ABAC** (Attribute-Based) | User/resource **tags/attributes** | `Department=Finance` principal automatically gets access to resources tagged `Department=Finance` | Large, dynamic orgs; scaling permissions without proliferating roles |
| **Policy-based (IAM/LF policies)** | Explicit JSON policy documents | Custom IAM policy scoped to one prefix | Precise, auditable, version-controlled permissions |

**Senior engineer take.** RBAC is simpler to reason about but doesn't
scale gracefully — every new team or data domain tends to spawn a new
role, and roles drift out of sync with reality. ABAC (in AWS: IAM
policies with `aws:PrincipalTag` conditions, or Lake Formation
LF-Tags) scales because you tag once and permissions follow the tag
automatically as new resources are created — this is *exactly* why
LF-Tags (Lake Formation's tag-based access control) are the answer for
"manage access across thousands of tables without editing thousands of
grants." A senior engineer picks ABAC/LF-Tags the moment the org has
more than a handful of teams or the data catalog is large and growing.

### 4.2.6 Principle of least privilege

```
   WRONG:  Role --> AdministratorAccess policy --> everything, everywhere
   RIGHT:  Role --> Custom policy: s3:GetObject on lake/finance/reports/* only
```

Least privilege is not a slogan, it's an operational default: **start
every new role with zero permissions and add exactly what's needed**,
rather than starting broad and narrowing later (which rarely actually
happens once a pipeline is "working"). On the exam, any option
containing `AdministratorAccess`, `*:*`, or "grant broad access for
simplicity" is a guaranteed distractor whenever "least privilege,"
"minimal access," or "restrict to only what's needed" appears in the
stem.

---

<a name="t43"></a>
## 5. Task 4.3 — Ensure data encryption and masking

### 4.3.1 Data masking, anonymization, tokenization, and key salting

| Technique | What happens | Reversible? | Example |
|---|---|---|---|
| **Masking** | Replace part of the value with a fixed character | ❌ (display-only, often reversible if original stored elsewhere) | `SSN: 123-45-6789` → `XXX-XX-6789` |
| **Anonymization** | Remove/generalize identifying fields entirely | ❌ Irreversible by design | Replace exact birthdate with birth year only |
| **Tokenization** | Replace sensitive value with a non-sensitive token that maps back via a secure vault | ✅ Reversible (via the vault) | `SSN: 123-45-6789` → `TOKEN-8f31a2` |
| **Key salting** | Add a random value ("salt") before hashing so identical inputs don't produce identical hashes | N/A (hashing, not encryption) | Two users with the same password get different hash outputs |

**Where this is applied on AWS for a DEA-C01 scenario:**
- **Glue DataBrew** and **Glue ETL transforms** can mask/tokenize columns
  during transformation (e.g., a `REDACT PII` recipe step in DataBrew).
- **Redshift dynamic data masking** applies masking **at query time**,
  based on the querying user's role, without altering the underlying
  stored data — the answer whenever the requirement is "different
  users see different masking of the same live column."
- **Lake Formation column filters** can present a masked or entirely
  hidden version of a column depending on the grant.

**Compliance driver.** These techniques exist to satisfy laws like
GDPR, HIPAA, and CCPA/CPRA, which require minimizing exposure of PII
and PHI. A healthcare claims company, for example, might tokenize
patient IDs in its analytics lake so that data engineers building
dashboards never see a real medical record number, while the
tokenization vault (a separate, tightly restricted service) can
re-identify a record only for authorized clinical staff.

**Exam trap.** ⚠️ Masking a column in a **query result** (Redshift
dynamic masking, LF column filter) does **not** encrypt the
underlying stored data — those are two independent controls. A
question describing "masked in reports but still encrypted at rest"
wants **both** a masking mechanism **and** SSE-KMS, not one or the
other.

### 4.3.2 Use encryption keys to encrypt and decrypt data (AWS KMS)

```
   Plaintext data --> [ KMS Key ] --> Ciphertext stored in S3/Redshift/DynamoDB
                            |
                    Key Policy determines WHO may use this key
                    (separate from the IAM policy on the caller)
```

Encrypting or decrypting through KMS requires **two independent
approvals**: the caller's **IAM policy** must allow `kms:Decrypt` /
`kms:GenerateDataKey`, **and** the **key's own key policy** must allow
that principal. This dual-gate design is exactly why cross-account
encryption "not working even though IAM looks right" is a realistic
scenario — the key policy is the piece that's usually missing.

**KMS key types — full comparison**

| Type | Who controls the key policy | Rotation | Cross-account sharing | Cost | Use when |
|---|---|---|---|---|---|
| **AWS owned key** | AWS (invisible to you) | AWS-managed | ❌ | Free | Default S3 SSE-S3-equivalent scenarios (not a real customer-facing key) |
| **AWS managed key** (e.g. `aws/s3`, `aws/redshift`) | AWS | Automatic, annual | ❌ Cannot be shared | Free (pay per API request only) | Good baseline default, no compliance need |
| **Customer managed key (CMK)** | **You** — full key policy control | ✅ Optional automatic annual, or manual on demand | ✅ Shareable via key policy | ~$1/month + per-request | **Compliance, audit trail, cross-account, custom rotation cadence** — exam favorite |
| **Imported key material (BYOK)** | You (external key material) | Manual only | ✅ | ~$1/month | Regulatory requirement that AWS never generates the key material |

⚠️ **Cross-account encrypted data access requires a customer-managed
key.** AWS-managed keys cannot be shared to another account under any
circumstances — if a question mentions sharing encrypted S3 data or
Redshift snapshots across accounts, an AWS-managed-key option is
automatically wrong.

**Encryption-at-rest options — the full picture, not just "KMS"**

| Method | Who manages the key | Rotation | CloudTrail key-usage audit trail | Cost | Use when |
|---|---|---|---|---|---|
| **SSE-S3** (AES-256) | AWS, entirely invisible | Automatic | ❌ **No key-level CloudTrail events** | **Free** | Default, no compliance/audit requirement on key usage |
| **SSE-KMS (AWS managed key)** | AWS | Automatic annual | ✅ | KMS request cost only | Reasonable default with some audit need |
| **SSE-KMS (customer managed key)** | **You** | ✅ Configurable | ✅ **Full** — every decrypt/encrypt call is a CloudTrail event | $1/mo/key + requests | **Compliance, audit, cross-account sharing** |
| **DSSE-KMS** (dual-layer) | You | ✅ | ✅ | Higher (two encryption layers) | Regulatory mandates requiring double encryption (e.g., certain government/defense workloads) |
| **SSE-C** (customer-provided key) | **You entirely — AWS never stores the key** | You manage | Partial | Free | Regulatory requirement that the key material never lives in AWS at all, even encrypted |
| **Client-side encryption** | You, before data ever leaves your systems | You | ❌ (AWS sees only ciphertext) | Free (AWS side) | Zero-trust-in-provider requirement; data must be unreadable to AWS itself |

**S3 Bucket Keys** — a cost optimization, not a security feature: they
reduce the number of calls made to KMS by generating a
bucket-level data key that's reused for many object-level operations,
cutting KMS API costs by up to ~99%. This is the answer whenever a
question says "we use SSE-KMS but our KMS request costs have become
too high."

**Senior engineer take.** In practice, SSE-S3 is fine for genuinely
non-sensitive data with no compliance driver, but the moment a
question mentions PII, PHI, financial data, "audit key usage," or
"customer control over rotation/access," the answer is **SSE-KMS with
a customer-managed key** — this single pattern (CMK + SSE-KMS) covers
the large majority of Domain 4 encryption questions.

### 4.3.3 Configure encryption across account boundaries

```
   Account A                          Account B
   +---------------+                  +----------------+
   | KMS CMK        | --key policy-->  | grants "Account B
   | (owned here)   |   allows          | root or specific role
   +---------------+   principal        | may kms:Decrypt"
        |
        v
   S3 object encrypted with this CMK, bucket policy in Account A
   also grants Account B's principal s3:GetObject
```

Two separate grants are required, on two separate resources, and
missing either one breaks cross-account access: **(1)** the **KMS key
policy** in Account A must explicitly allow the principal (user, role,
or entire account) from Account B; **(2)** the **S3 bucket policy** (or
object ACL, though bucket policy is preferred) in Account A must
separately allow Account B's principal to call `s3:GetObject`. A
question describing "Account B has full S3 permissions granted but
still gets access denied when reading an encrypted object" wants the
missing **KMS key policy grant** as the answer.

### 4.3.4 Enable encryption in transit

| Mechanism | Where it's used |
|---|---|
| **TLS/SSL** | JDBC/ODBC connections to Redshift, RDS, Aurora |
| **HTTPS** | All AWS API calls, S3 access, Athena queries |
| **VPC endpoint (PrivateLink/Gateway)** | Keeps traffic off the public internet entirely, in addition to TLS |

**The one-line DEA exam rule:** **at rest = KMS (or SSE variant);
in transit = TLS/HTTPS/SSL.** These are two independent controls and a
correct architecture needs both — a common scenario asks for "fully
encrypted end to end," which means SSE-KMS at rest **and** enforcing
TLS on every connection (e.g., Redshift's `require_ssl` parameter, or
an S3 bucket policy that denies non-HTTPS requests via
`aws:SecureTransport`).

---

<a name="t44"></a>
## 6. Task 4.4 — Prepare logs for audit

### 4.4.1 Use CloudTrail to track API calls

```
   Any AWS API call (console, CLI, SDK, another AWS service)
        |
        v
   AWS CloudTrail  --records-->  Who / What action / When / Source IP / Success or failure
        |
        v
   (optional) delivered to an S3 bucket as a trail, or streamed to CloudWatch Logs
```

CloudTrail is **on by default** for the last 90 days of **management
events** (control-plane actions: creating a bucket, changing an IAM
policy, launching a cluster) in the Event History view, at no charge.
For anything beyond 90 days, or for **data events** (S3 object-level
GET/PUT, Lambda invocations, DynamoDB item-level operations), you must
**explicitly create/configure a trail** — and data events are billed
per event and are **not on by default**.

**Per-service checklist — CloudTrail**

| Dimension | Detail |
|---|---|
| Purpose | Immutable record of API activity — the "who did what, when" audit trail |
| When to use | Any compliance/audit requirement about API-level actions; detecting unauthorized configuration changes; forensic investigation |
| When NOT to use | Capturing application-level business logic (that's CloudWatch Logs) |
| Advantages | Automatic, near-real-time, integrates with EventBridge for automated response to specific API calls |
| Limitations | Management events only by default; **object-level reads require data events, extra cost, and must be explicitly enabled** |
| Pricing | Management events: free (first copy). Data events: billed per 100,000 events |
| Performance | Near-real-time delivery (typically within 15 minutes for the S3-delivered trail) |
| Scaling | Handles any account activity volume automatically |
| Security | Trail logs can be encrypted with KMS; can enable log file integrity validation to detect tampering |
| HA | Multi-region trails available for org-wide coverage |
| Failure scenarios | Forgetting to enable data events, then being unable to answer "who read this file" during an incident |
| Common mistakes | Assuming CloudTrail shows object contents (it doesn't — it shows the API call metadata, not payload data) |
| Exam traps | "Prove who accessed a specific S3 object" without first confirming data events were enabled |
| Enterprise example | A bank enables S3 data events on its PII bucket specifically so that, during a regulatory audit, it can produce a complete list of every employee who read a specific customer's file in the past year |

### 4.4.2 Use CloudWatch Logs to store application logs

```
   Lambda / Glue job / EMR step / ECS task
        |
        v
   CloudWatch Logs  (log group per service, log stream per execution/instance)
        |
        v
   Metric filters --> Alarms   |   Logs Insights --> ad-hoc SQL-like queries
```

CloudWatch Logs is where **your code's own output** lands — `print`
statements, structured application logging, Spark driver/executor logs
from EMR, Glue job logs. This is distinct from CloudTrail, which never
sees your application's internal logic, only the AWS API calls it
made. A question phrased as "the application needs to log business
events like 'order validation failed'" wants CloudWatch Logs, not
CloudTrail.

**Per-service checklist — CloudWatch Logs**

| Dimension | Detail |
|---|---|
| Purpose | Centralized storage for application and service-generated log output |
| When to use | Debugging pipeline failures, application-level audit trails, alerting on log patterns |
| When NOT to use | AWS API-call auditing (CloudTrail); long-term cold-storage archival at very large scale without cost management (export to S3 + lifecycle instead) |
| Advantages | Native integration with nearly every AWS compute/analytics service; Logs Insights for fast ad-hoc queries; metric filters drive alarms |
| Limitations | Cost grows with volume and retention; unstructured logs are harder to query efficiently |
| Pricing | Ingestion per GB + storage per GB-month + Logs Insights query cost |
| Performance | Near-real-time ingestion; Logs Insights queries scan and can be slow/costly on very large groups without time-range scoping |
| Scaling | Automatic; watch for per-account throttling on extremely high-throughput log producers |
| Security | KMS encryption available per log group; IAM controls read/write access |
| HA | Regional, durable managed storage |
| Failure scenarios | Unbounded retention on a high-volume log group silently becoming a large recurring cost |
| Common mistakes | Never setting a retention policy (defaults to "never expire") |
| Exam traps | Using CloudWatch Logs where the requirement is really "who called this API" (that's CloudTrail) |
| Enterprise example | A ride-sharing company's EMR Spark jobs stream driver and executor logs to CloudWatch Logs, with a metric filter alarming the on-call engineer whenever an `OutOfMemoryError` pattern appears |

### 4.4.3 Use AWS CloudTrail Lake for centralized logging queries

**Purpose.** CloudTrail Lake is a **managed, queryable event data
store** for CloudTrail events — the answer whenever a question wants
**retroactive SQL-style analysis** across a long historical window
without you building your own Athena-over-S3 pipeline.

```
   CloudTrail events (management + data, multi-region, multi-account)
        |
        v
   CloudTrail Lake  (event data store)
        |
        v
   SQL query: "show all Delete* actions by IAM user X in the last 90 days"
```

**Per-service checklist — CloudTrail Lake**

| Dimension | Detail |
|---|---|
| Purpose | Centralized, SQL-queryable audit analytics across accounts/regions/time |
| When to use | "Audit analytics," compliance reporting across a long retention window, cross-account/cross-org audit consolidation |
| When NOT to use | Simple, occasional lookups over the last 90 days (Event History suffices, free) |
| Advantages | No infrastructure to build; up to 7-year retention; SQL against structured event schema |
| Limitations | Additional cost per GB ingested/retained beyond standard CloudTrail |
| Pricing | Ingestion + retention pricing, billed per GB |
| Performance | SQL-like query interface, seconds to minutes depending on window |
| Scaling | Handles org-wide, multi-account event volume |
| Security | Data encrypted; access controlled via IAM |
| HA | Fully managed regional service |
| Common mistakes | Building a custom Athena-over-S3-CloudTrail-logs pipeline when CloudTrail Lake already solves this natively |
| Exam traps | Picking "Athena over raw CloudTrail S3 logs" when the stem literally says "centralized audit query capability" — that phrase is the CloudTrail Lake trigger |
| Enterprise example | A multinational retailer consolidates CloudTrail events from 40 AWS accounts into one CloudTrail Lake event data store so its central security team can run one SQL query across the entire organization during an incident |

### 4.4.4 Analyze logs with AWS services

| Analysis need | Tool | Why |
|---|---|---|
| SQL over logs already exported to S3 | **Athena** | Ad-hoc, pay-per-query, no infrastructure |
| Interactive, fast log search/filtering | **CloudWatch Logs Insights** | Purpose-built query language for CloudWatch Logs, no export needed |
| Full-text search, dashboards over massive log volume | **Amazon OpenSearch Service** | Inverted index, Kibana-style visualization |
| Very large-scale, custom/complex log processing | **EMR** | When volume or transformation complexity exceeds the others |

```
   CloudWatch Logs --> (subscription filter) --> S3 --> Athena (SQL)
   CloudWatch Logs --> Logs Insights (query in place, no export needed)
   CloudWatch Logs --> (subscription filter/Firehose) --> OpenSearch (search + dashboards)
```

The top path is for **occasional, ad-hoc SQL** once logs are archived
to S3 — you pay per query and need no standing infrastructure. The
middle path, **Logs Insights**, is fastest for iterative debugging
directly against live CloudWatch Logs without ever exporting anything.
The bottom path, **OpenSearch**, is for teams that need **full-text
search and pre-built dashboards** (a security operations center
watching failed-login patterns in near-real-time, for example) rather
than occasional SQL.

### 4.4.5 Integrate various AWS services to perform logging

**Enterprise centralized-logging pattern:**

```
   Applications  --+
   CloudTrail    --+--> CloudWatch Logs / S3 --> Central Audit Account (S3 bucket)
   EMR logs      --+                                     |
   Glue logs     --+                                     v
                                              Athena / OpenSearch / CloudTrail Lake
                                              for org-wide analysis
```

At enterprise scale (multiple AWS accounts under AWS Organizations),
logs from every account are **routed to one dedicated logging/audit
account**, rather than each team querying their own account in
isolation. This centralization is what makes cross-account incident
response and compliance reporting tractable — a security team
investigating an incident does not need access to twenty production
accounts individually, only the one central log account.

**Amazon Macie's role in this task statement.** While Macie is covered
in depth under 4.5.2, it belongs in the logging/detection
conversation too: Macie can be configured to emit its sensitive-data
findings as **EventBridge events**, which can then trigger automated
remediation (quarantine the object, notify security, revoke public
access) — turning "detect sensitive data" into an integrated,
logged, auditable workflow rather than a one-off scan report.

---

<a name="t45"></a>
## 7. Task 4.5 — Understand data privacy and governance

### 4.5.1 Grant permissions for data sharing (Redshift data sharing)

**Purpose.** Redshift data sharing lets a **producer cluster** share
live data with **consumer clusters** — in the same account, a
different account, or even a different AWS Region — **without copying
or moving any data**.

```
   Producer Cluster (owns the data)
        |
        +-- creates a Datashare, adds schemas/tables to it
        |
        v
   Datashare  --grant-->  Consumer Cluster (Account B, or same account)
        |
        v
   Consumer queries the shared tables directly, live, no ETL, no copy
```

The producer defines exactly which schemas/tables go into the
datashare and to which consumer namespace it's granted — this is a
**grant-based** model, similar in spirit to Lake Formation but native
to Redshift rather than the S3/catalog layer. Because there's no data
movement, the consumer always sees **current** data with no
replication lag and no duplicate storage cost.

**Per-service checklist — Redshift data sharing**

| Dimension | Detail |
|---|---|
| Purpose | Live, zero-copy data sharing between Redshift clusters/accounts/regions |
| When to use | Multiple business units or partner accounts need the same live warehouse data without ETL duplication |
| When NOT to use | Consumer needs data in a completely different engine (use Lake Formation/S3 instead); consumer needs to modify the shared data (sharing is read-only) |
| Advantages | No data copy, no ETL lag, fine-grained (schema/table level) grants, cross-account and cross-region |
| Limitations | Both producer and consumer must be Redshift (RA3 node types or Serverless); read-only for the consumer |
| Pricing | Consumer pays for its own compute to query; no extra storage cost since no copy is made |
| Security | Grants are explicit and revocable; consumer cannot see anything not explicitly shared |
| Common mistakes | Assuming data sharing replaces the need for any encryption/IAM setup — the consumer cluster still needs its own IAM/network configuration |
| Exam traps | Picking DMS or Glue ETL for "share live data between two Redshift clusters, no duplication" — that phrase is the data-sharing trigger |
| Enterprise example | A media-streaming company's data platform team shares curated viewership tables from a central producer cluster with each regional business unit's own consumer cluster, so regional teams get live access without a nightly copy job |

### 4.5.2 Implement PII identification (Amazon Macie with Lake Formation)

```
   S3 Buckets (data lake)
        |
        v
   Amazon Macie  --scans for-->  PII / PHI / financial data patterns
        |                         (SSNs, credit cards, names+addresses,
        |                          credentials, custom regex identifiers)
        v
   Findings  --EventBridge-->  Automated remediation (quarantine, alert)
        |
        v
   Findings inform  --> Lake Formation grants (restrict access to
                          the specific tables/columns Macie flagged)
```

Macie scans object content **directly in S3** (it does not require
data to move) using both AWS-managed identifiers (patterns for SSNs,
credit card numbers, AWS credentials, common PII types) and
**custom data identifiers** you define with regex for organization-
specific sensitive patterns. Findings are automatically published as
**EventBridge events**, which is the mechanism that turns "we found
PII" into an **automated response** — commonly, a Lambda function that
tightens the S3 bucket policy or notifies the data governance team.
The last arrow is the closed loop the exam cares about: Macie's
findings inform which tables/columns get restricted via **Lake
Formation**, connecting detection to enforcement.

**Per-service checklist — Amazon Macie**

| Dimension | Detail |
|---|---|
| Purpose | Machine-learning-powered discovery and classification of sensitive data (PII, PHI, financial, credentials) in S3 |
| When to use | Compliance requirements to know where sensitive data lives; pre-migration data classification; continuous monitoring of a growing data lake |
| When NOT to use | Real-time inline blocking of individual API calls (Macie is a scanning/discovery service, not an inline gatekeeper); non-S3 data stores (Macie is S3-focused) |
| Advantages | No infrastructure to manage; managed + custom data identifiers; integrates with EventBridge for automated remediation; dashboard of bucket-level sensitivity scores |
| Limitations | S3-only (does not scan RDS, DynamoDB, or Redshift directly); cost scales with data volume scanned |
| Pricing | **Billed by GB scanned** — first scan of a bucket is the expensive one; ongoing incremental scans of new/changed objects cost less |
| Performance | Scans run asynchronously; not real-time per-request inspection |
| Scaling | Handles organization-wide, multi-account S3 estates via Macie's organization-wide administrator account feature |
| Security | Findings themselves are sensitive — restrict who can view Macie findings |
| HA | Fully managed, regional |
| Failure scenarios | Running a full-bucket scan on a very large, rarely accessed bucket without scoping — generates a large, avoidable bill |
| Common mistakes | Scanning everything by default instead of scoping to buckets that plausibly contain sensitive data; not wiring findings to any automated or human response, so scans produce reports nobody acts on |
| Exam traps | Picking Glue Data Quality or Lake Formation for "find PII" — those enforce/validate structure, they do not discover sensitive *content* the way Macie does |
| Enterprise example | An insurance company runs Macie continuously across its claims-intake S3 bucket; the moment Macie flags a newly uploaded document containing an unmasked SSN, an EventBridge rule triggers a Lambda that moves the object to a quarantine prefix and pages the data governance on-call |

### 4.5.3 Prevent backups/replication to unauthorized regions

```
   AWS Organizations
        |
        v
   Service Control Policy (SCP): Deny s3:PutBucketReplication
                                  unless destination region ∈ {allowed list}
        |
        v
   Applies to ALL accounts/roles in the OU — no identity policy can override
```

**SCPs** are the primary enforcement mechanism because they apply as a
**ceiling** across the entire organization or organizational unit —
even an account administrator with `AdministratorAccess` cannot
bypass an SCP-level deny. This is the correct tool specifically
*because* it cannot be accidentally (or maliciously) overridden by a
permissive IAM policy somewhere in one account. Complementary controls
that reinforce the same goal: **IAM policies with region-condition
keys** (`aws:RequestedRegion`) at the individual-role level, and
**AWS Backup** region-restricted backup plans / vaults that never
target a disallowed region.

**Exam trap.** ⚠️ An IAM policy alone is **not sufficient** to
guarantee org-wide region restriction, because a different, more
permissive policy elsewhere (or a future misconfiguration) could
override it for a specific role. Only an **SCP** provides the
account-independent, un-overridable ceiling — this is the reasoning
the exam wants when the stem says "guarantee across the entire
organization" rather than "for this one role."

### 4.5.4 Manage configuration changes (AWS Config)

```
   Resource change (SG rule edited, S3 bucket made public, IAM policy modified)
        |
        v
   AWS Config  --records-->  Configuration history + compliance evaluation
        |
        v
   Config Rule (managed or custom) --> COMPLIANT / NON_COMPLIANT
        |
        v
   (optional) EventBridge --> SNS/Lambda --> alert or auto-remediate
```

AWS Config continuously records **configuration state** (not API
calls — that's CloudTrail's job) for supported resource types, and
evaluates each change against **Config Rules** — either AWS-managed
(e.g., `s3-bucket-public-read-prohibited`) or custom (Lambda-backed).
The distinction from CloudTrail matters: CloudTrail tells you *someone
called `ModifySecurityGroupRules`*; Config tells you *the security
group's actual state drifted from compliant to non-compliant*, and can
show you the **exact before/after configuration diff**.

**Per-service checklist — AWS Config**

| Dimension | Detail |
|---|---|
| Purpose | Continuous configuration recording + compliance evaluation for AWS resources |
| When to use | "Configuration drift," compliance-as-code, "detect when a resource becomes non-compliant" |
| When NOT to use | API-call-level "who did it" auditing (CloudTrail); real-time blocking (Config is detective, not preventive, though it can trigger remediation) |
| Advantages | Point-in-time configuration history, pre-built compliance rule packs, automated remediation actions |
| Limitations | Detective control by default — a non-compliant resource exists until a rule/remediation catches it, not blocked at creation time |
| Pricing | Per configuration item recorded + per rule evaluation |
| Security | Read access to Config data should itself be restricted (reveals infrastructure detail) |
| Common mistakes | Treating Config as a preventive control equivalent to an SCP — it detects and can remediate, but a resource can exist non-compliant for a window before remediation runs |
| Exam traps | "Configuration drift" and "is this resource configured correctly" phrases → AWS Config, not CloudTrail |
| Enterprise example | A bank uses an AWS Config rule to continuously verify that every S3 bucket in its data lake has default encryption enabled, auto-remediating (enabling SSE-KMS) within minutes of any bucket losing that setting |

### 4.5.5 Maintain data sovereignty

**Definition.** Data sovereignty means data remains subject to, and
physically located within, the laws and jurisdiction of a specific
country or region — a common requirement in banking, healthcare, and
government workloads operating under regulations like GDPR (EU) or
data localization laws in specific countries.

**Controls that jointly enforce sovereignty:**

| Control | What it enforces |
|---|---|
| **Region restriction (SCP)** | No resource can be created outside the approved region(s) |
| **Lake Formation cross-account/cross-region grants** | Data sharing itself can be scoped to not cross a sovereignty boundary |
| **Encryption (KMS, region-scoped keys)** | Even if data physically leaves, it's unreadable without a key that never leaves the approved region |
| **AWS Config** | Continuously verifies no resource drifted outside the approved region/configuration |

**Senior engineer take.** Sovereignty is rarely satisfied by one
control alone — it's the **combination** of "can't create resources
elsewhere" (SCP), "can't grant access to consumers elsewhere" (Lake
Formation / Redshift data sharing scoping), and "even a leaked copy is
useless" (region-scoped KMS keys) that a senior engineer describes when
asked to design for it. A single-answer exam question usually wants
the **primary** enforcement mechanism (typically the SCP), but a
scenario question may ask you to identify which combination is
*missing*.

### 4.5.6 Manage access through SageMaker Catalog Projects

```
   SageMaker Domain --> Project --> Users --> Data Assets (governed, scoped)
```

This reuses the hierarchy from 4.1.7: a **Project** is the unit that
actually holds member access and data-asset references. For 4.5, the
governance angle is that Projects give each team **self-service,
delegated administration** — a project owner can add/remove their own
team's members and manage their own data-asset subscriptions without
filing a ticket to a central IAM team — while the **Domain**-level
administrators retain overall guardrails (which data can be published
at all, org-wide tagging standards). This is the modern answer for
"how do we let dozens of teams manage their own project access without
a central bottleneck, while still enforcing org-wide governance."

### 4.5.7 Governance framework and data sharing patterns

**The governance framework, as a checklist:**

```
   Ownership       -- who is accountable for this dataset's quality/access decisions
   Classification  -- public / internal / confidential / restricted (drives which controls apply)
   Lineage         -- where did this data come from, what transformed it
   Access control  -- IAM + Lake Formation + Redshift RLS/masking
   Retention       -- how long is it kept, when/how is it deleted
   Auditing        -- CloudTrail + CloudTrail Lake + Config
```

**The four data-sharing patterns, ranked by governance strength:**

| Pattern | Governance granularity | Data movement | Best for |
|---|---|---|---|
| **S3 cross-account bucket policy** | Bucket/prefix only | None (same objects) | Simple, coarse sharing; small number of consumers |
| **Lake Formation cross-account sharing (via AWS RAM)** | Column/row/cell | None | Fine-grained governed lake sharing, many consumers |
| **Redshift data sharing** | Schema/table | None | Live warehouse-to-warehouse sharing |
| **Data mesh** (domain-oriented, Lake Formation + DataZone/SageMaker Catalog underneath) | Column/row/cell, with a business/discovery layer on top | None | Large orgs with many independent data-producing domains, self-service discovery |

```
   Domain A (data producer)
        |
        +-- publishes a "Shared Data Product" (governed via LF-Tags)
        |
        v
   Domain B (data consumer)  --discovers and subscribes via catalog-->  queries live, governed data
```

**Senior engineer take.** A data mesh isn't a new AWS service — it's an
**organizational pattern** implemented using the same primitives
already covered in this domain: Lake Formation for fine-grained
governed access, a catalog (Glue Data Catalog + DataZone/SageMaker
Catalog) for discovery and self-service subscription, and each
producing team owning their own data product end-to-end rather than a
central team owning all pipelines. The exam signal for "data mesh" is
language like "each business domain owns and publishes its own data
products" combined with "other teams discover and subscribe" — that
combination, not any single service name, is the trigger.

---

<a name="trees"></a>
## 8. Decision trees

### Tree 1 — IAM policy evaluation order

This exact sequence is one of the single most-tested facts in Domain
4. Memorize the order, not just the names.

```
                    Is there an EXPLICIT DENY anywhere
                 (identity policy, resource policy, SCP,
                        permission boundary, session policy)?
                                    |
                          YES ------+------ NO
                           |                 |
                        DENY.              Does an SCP (Organizations)
                        STOP.               allow this action?
                                                    |
                                          NO --------+------- YES
                                           |                    |
                                        DENY.          Does a RESOURCE-BASED
                                        STOP.          policy allow it?
                                                                |
                                                      YES -------+------- NO
                                                       |                   |
                                                  (may ALLOW,      Is it within the
                                                   continue          PERMISSION BOUNDARY?
                                                   checking)                |
                                                                  NO --------+------- YES
                                                                   |                   |
                                                                DENY.        Does a SESSION POLICY
                                                                STOP.        (if any) allow it?
                                                                                       |
                                                                             NO --------+------- YES
                                                                              |                   |
                                                                           DENY.        Does an IDENTITY-BASED
                                                                           STOP.        policy allow it?
                                                                                                  |
                                                                                        YES --------+------- NO
                                                                                         |                    |
                                                                                      ALLOW.          IMPLICIT DENY.
```

Read top to bottom: an **explicit deny anywhere always wins
immediately** — no other policy can override it. Next, an **SCP** acts
purely as a **ceiling** — it can never grant anything by itself, only
permit or block what identity policies are later allowed to grant.
Then a **resource-based policy** (like an S3 bucket policy or KMS key
policy) can independently allow access even across accounts. The
**permission boundary** is a ceiling on a specific IAM principal (not
org-wide like an SCP). A **session policy** further restricts what a
temporary session (assumed role) may do below what the role's own
policy allows. Finally, the **identity-based policy** is the familiar
one most people think of first — but as this tree shows, it's actually
evaluated **last**, after five other gates. If nothing along the way
produced an explicit allow, the result is **implicit deny** — AWS
denies by default.

**Mnemonic:** *"**D**eny **S**tops **R**eally **P**owerful
**S**ession **I**dentities"* — **D**eny, **S**CP, **R**esource,
Permission **B**oundary, **S**ession, **I**dentity.

### Tree 2 — Secrets Manager vs Parameter Store

```
                Does this value need to be ROTATED
                    on a schedule automatically?
                              |
                    YES ------+------ NO
                     |                 |
              SECRETS MANAGER    Is it a genuine SECRET
              (built-in rotation  (credential/API key), or
               for RDS/Aurora/    just a CONFIG VALUE?
               Redshift/DocDB)          |
                              SECRET ----+---- CONFIG VALUE
                                |                    |
                     Need cross-account      PARAMETER STORE
                     sharing or >4KB?        (Standard tier — free)
                                |
                       YES ------+------ NO
                        |                 |
                 SECRETS MANAGER    PARAMETER STORE
                 (resource policy,  (SecureString type,
                  64 KB limit)       4KB Standard / 8KB Advanced)
```

### Tree 3 — RBAC vs ABAC vs Lake Formation column/row security

```
              Does the requirement mention a SPECIFIC COLUMN
                 or ROW filter within a table (e.g. "hide SSN",
                    "only rows where region = requester's region")?
                                    |
                          YES ------+------ NO
                           |                 |
                  LAKE FORMATION       Is access driven by a small,
                  (column/row/cell     STABLE set of job functions
                   filters, or         (Analyst, Engineer, Admin)?
                   LF-Tags at scale)          |
                                     YES -------+------- NO (dynamic
                                      |                   attributes,
                                    RBAC                  large/growing org)
                                  (IAM/Redshift                |
                                   role-based                ABAC
                                   GRANTs)                (tag-based —
                                                            IAM PrincipalTag
                                                            or LF-Tags)
```

---

<a name="mnemonics"></a>
## 9. Mnemonics

| Mnemonic | Unpacks to |
|---|---|
| **AAEAG** | **A**uthenticate → **A**uthorize → **E**ncrypt → **A**udit → **G**overn — the five task statements, in flow order |
| **"Deny Stops Really Powerful Session Identities"** | IAM evaluation order: **D**eny, **S**CP, **R**esource policy, Permission **B**oundary, **S**ession policy, **I**dentity policy |
| **"SSSS"** | **S**tateful **S**ecurity groups vs **S**tateless **S**ubnet NACLs — both start with S, but only one keeps *state* |
| **"Rotate = Manager"** | Anything needing **rotation** → Secrets **Manager**. Cheap and static → Parameter **Store** |
| **"IAM can't count columns"** | IAM has no concept of a column or row — reach for **Lake Formation** or **Redshift RLS/masking** the moment the question is that granular |
| **"Data events cost, management events don't"** | CloudTrail management events are free/default; **data events** (object-level reads) cost extra and must be turned on |
| **"CMK = Cross-account, Mandatory Key control"** | Cross-account encrypted sharing always needs a **customer-managed key**, never an AWS-managed one |
| **"Macie finds it, Lake Formation guards it"** | Macie **discovers** PII; Lake Formation **enforces** access to it — detection and enforcement are two different services |
| **"SCP is the ceiling, IAM is the floor"** | An SCP can only take away or bound what IAM identity policies may grant — it can never itself grant anything |
| **"Config watches state, CloudTrail watches actions"** | AWS Config = *is the resource configured correctly right now*; CloudTrail = *who called the API that changed it* |

---

<a name="cheatsheet"></a>
## 10. Domain 4 cheat sheet

| Scenario phrase | Answer |
|---|---|
| Temporary AWS access for a service | IAM Role |
| Automatic credential rotation | Secrets Manager |
| Most cost-effective config storage | Parameter Store (Standard) |
| Stateful firewall at the instance/ENI level | Security Group |
| Stateless firewall at the subnet level | Network ACL |
| Custom, tightly scoped permissions | Custom IAM Policy |
| Centralized column/row/cell data permissions | Lake Formation |
| Encrypt data at rest, need audit trail / rotation control | KMS customer-managed key + SSE-KMS |
| Encrypt data at rest, no compliance need | SSE-S3 |
| Reduce KMS API cost on S3 | S3 Bucket Keys |
| Encrypt in transit | TLS / HTTPS / SSL |
| API audit trail ("who called what") | CloudTrail (management events) |
| "Who read this object" | CloudTrail **data events** |
| Centralized, SQL-queryable historical audit | CloudTrail Lake |
| Application-level logs | CloudWatch Logs |
| Fast ad-hoc log search in place | CloudWatch Logs Insights |
| Full-text search + dashboards over logs | OpenSearch Service |
| PII/PHI discovery in S3 | Amazon Macie |
| Configuration drift / "is it configured correctly" | AWS Config |
| Live, zero-copy Redshift-to-Redshift sharing | Redshift data sharing |
| Dynamic, attribute-driven authorization at scale | ABAC / LF-Tags |
| Stable, small set of job-function roles | RBAC |
| Least-privilege access | Custom IAM Policy, scoped resource/action |
| Cross-account encrypted data access | Customer-managed KMS key + key policy grant |
| Governance/discovery catalog for business users | DataZone / SageMaker Catalog |
| Guarantee no resource created outside approved regions, org-wide | SCP with region condition |
| Prevent backups replicating to disallowed regions | SCP + region-scoped AWS Backup vaults |
| Row-level masking that varies by querying user | Redshift dynamic data masking |
| Database credential used natively by RDS/Aurora/Redshift with built-in rotation | Secrets Manager |
| Data mesh / domain-owned data products | Lake Formation + Glue Catalog + DataZone/SageMaker Catalog together |

**Most-tested comparisons in this domain:** IAM Role vs IAM User ·
Security Group vs NACL · Secrets Manager vs Parameter Store · RBAC vs
ABAC · CloudTrail vs CloudWatch Logs · CloudTrail vs CloudTrail Lake ·
KMS AWS-managed vs customer-managed key · Macie vs Lake Formation ·
Authentication vs Authorization · Encryption at rest vs in transit ·
IAM vs Lake Formation for fine-grained access.

---

<a name="questions"></a>
## 11. Practice question bank — 40 questions

Difficulty mix: 10 straightforward, 20 scenario-based, 10 hard /
multi-constraint. Every option is explained, including why the wrong
ones are wrong.

---

**Q1.** A data engineer needs a Glue job to read from an S3 bucket.
What should the job use to authenticate to AWS?

A. An IAM user with an access key stored as a job parameter
B. An IAM role attached to the Glue job
C. The root account's access key
D. A hardcoded username/password pair

**Answer: B.**
- A is wrong — long-lived access keys hardcoded into job parameters are
  a credential-leak risk and violate the "prefer roles" best practice.
- **B is correct** — Glue jobs assume an IAM role at runtime, getting
  short-lived STS credentials with exactly the permissions attached to
  that role.
- C is wrong — the root account should never be used for workload
  identity; it's reserved for account-level management tasks.
- D is wrong — AWS services don't authenticate via username/password;
  this isn't how any AWS service-to-service auth works.

---

**Q2.** Which AWS service is stateful, meaning return traffic is
automatically allowed without a matching rule?

A. Network ACL
B. Security Group
C. AWS WAF
D. Route table

**Answer: B.**
- A is wrong — NACLs are stateless; both inbound and outbound rules
  must be explicitly defined.
- **B is correct** — Security Groups automatically allow return traffic
  for any connection that matched an allow rule.
- C is wrong — WAF filters HTTP(S) requests based on rules; statefulness
  isn't the relevant concept for it.
- D is wrong — route tables direct traffic, they don't perform
  stateful/stateless filtering at all.

---

**Q3.** A company wants database credentials for its Aurora PostgreSQL
cluster automatically rotated every 30 days with zero code changes to
the rotation logic. Which service should they use?

A. Parameter Store Standard
B. Secrets Manager
C. KMS
D. IAM Access Analyzer

**Answer: B.**
- A is wrong — Parameter Store has no built-in automatic rotation
  mechanism.
- **B is correct** — Secrets Manager provides a built-in rotation
  Lambda for Aurora PostgreSQL out of the box, requiring no custom
  rotation code.
- C is wrong — KMS manages encryption keys, not database credentials.
- D is wrong — IAM Access Analyzer identifies overly permissive
  policies; it doesn't manage or rotate secrets.

---

**Q4.** Which encryption option provides AWS with zero visibility into
either the plaintext data or the encryption key?

A. SSE-S3
B. SSE-KMS with an AWS-managed key
C. SSE-C
D. SSE-KMS with a customer-managed key

**Answer: C.**
- A is wrong — AWS both manages the key and performs the encryption
  with SSE-S3; AWS controls the key material fully.
- B is wrong — the key material is AWS-managed even though it's a
  distinct KMS key from the account default.
- **C is correct** — with SSE-C, the customer supplies the encryption
  key with each request; AWS never stores it, only uses it transiently
  to encrypt/decrypt.
- D is wrong — even with a customer-managed key, the key material still
  resides in AWS KMS; AWS technically has access to it (governed by
  the key policy), unlike SSE-C.

---

**Q5.** What is the correct term for AWS's requirement that even an
account with `AdministratorAccess` cannot override an
organization-wide deny set via Service Control Policies?

A. Permission boundary
B. Session policy
C. SCP acting as a ceiling
D. Resource-based policy

**Answer: C.**
- A is wrong — permission boundaries constrain a specific IAM
  principal, not an entire organization.
- B is wrong — session policies apply only to a temporary assumed-role
  session, not org-wide.
- **C is correct** — SCPs apply organization- or OU-wide and act purely
  as a ceiling that no identity policy, including
  `AdministratorAccess`, can exceed.
- D is wrong — resource-based policies are attached to individual
  resources (like S3 buckets), not applied org-wide.

---

**Q6.** Which service natively discovers PII and PHI content within S3
objects using machine learning and managed data identifiers?

A. AWS Config
B. Amazon Macie
C. AWS Glue Data Quality
D. Amazon GuardDuty

**Answer: B.**
- A is wrong — AWS Config evaluates resource *configuration*, not the
  content of objects.
- **B is correct** — Macie is purpose-built to scan S3 object content
  and classify sensitive data types like PII and PHI.
- C is wrong — Glue Data Quality validates structural rules
  (completeness, uniqueness) defined in DQDL, not sensitive-content
  discovery.
- D is wrong — GuardDuty detects threats and anomalous account/network
  activity, not sensitive data content.

---

**Q7.** A question states that object-level reads of a specific S3
object need to be traceable for an audit. What must be enabled?

A. CloudWatch Logs
B. CloudTrail management events (default)
C. CloudTrail data events
D. AWS Config

**Answer: C.**
- A is wrong — CloudWatch Logs capture application output, not S3 API
  call details.
- B is wrong — management events cover control-plane actions (creating
  a bucket, changing a policy) but not individual object reads.
- **C is correct** — object-level GET/PUT operations require CloudTrail
  data events, which are off by default and billed separately.
- D is wrong — AWS Config tracks configuration state changes, not
  individual read/write API calls on objects.

---

**Q8.** Which storage option is the "free" default for encrypting
objects at rest in S3, but provides no CloudTrail key-usage audit
trail?

A. SSE-KMS with a customer-managed key
B. SSE-S3
C. DSSE-KMS
D. Client-side encryption with a customer key

**Answer: B.**
- A is wrong — SSE-KMS (any variant) does generate CloudTrail events
  for key usage, and it also incurs per-request KMS charges.
- **B is correct** — SSE-S3 is AWS's free default encryption, but
  because AWS manages the key invisibly, there's no key-level
  CloudTrail trail to audit.
- C is wrong — DSSE-KMS is the dual-layer KMS option and generates a
  key-usage audit trail like other KMS-based options.
- D is wrong — client-side encryption isn't the "free S3 default"; it
  requires the customer to implement encryption before upload.

---

**Q9.** What is the primary functional difference between RBAC and
ABAC?

A. RBAC grants access by resource type; ABAC grants access by region
B. RBAC grants by static job-function roles; ABAC grants by matching
   attributes/tags dynamically
C. RBAC is AWS-native; ABAC is not supported on AWS
D. RBAC and ABAC are identical, just different names

**Answer: B.**
- A is wrong — this isn't how either model is defined; resource type
  and region aren't the distinguishing axis.
- **B is correct** — RBAC assigns permissions to fixed roles tied to
  job function; ABAC evaluates tags/attributes on the principal and
  resource dynamically to determine access.
- C is wrong — AWS fully supports ABAC via IAM `PrincipalTag`
  conditions and Lake Formation LF-Tags.
- D is wrong — they are meaningfully different models with different
  scaling characteristics.

---

**Q10.** A team needs to detect when an S3 bucket's public access
settings drift from the organization's required baseline. Which
service is purpose-built for this?

A. CloudTrail
B. AWS Config
C. Macie
D. GuardDuty

**Answer: B.**
- A is wrong — CloudTrail records that an API call happened, not
  whether current configuration is compliant.
- **B is correct** — AWS Config continuously evaluates resource
  configuration against rules (like public-access prohibition) and
  flags drift.
- C is wrong — Macie scans for sensitive data content, not bucket
  configuration compliance.
- D is wrong — GuardDuty focuses on threat detection from network/API
  behavior patterns, not configuration-baseline compliance.

---

**Q11.** *(Scenario)* An analytics team at a retail company needs
analysts in each of five regions to see only their own region's rows
in a shared `sales` table stored in the data lake, while a
column containing customer loyalty IDs must be hidden from everyone
except the loyalty program team. Which service delivers both
requirements without duplicating the table?

A. S3 bucket policies per region
B. IAM policies with `Resource` conditions
C. AWS Lake Formation row-level filters and column permissions
D. Separate Redshift clusters per region

**Answer: C.**
- A is wrong — S3 bucket policies operate at the object/prefix level;
  they cannot filter rows or columns within a single Parquet/CSV
  object.
- B is wrong — IAM has no concept of a row or column; it can restrict
  API actions and resource ARNs, not filter within a table's contents.
- **C is correct** — Lake Formation supports both row-level filters
  (scoped to `region`) and column-level permissions (hiding
  `loyalty_id`) applied to the same underlying table for different
  principals.
- D is wrong — duplicating clusters per region is expensive, creates
  data staleness/duplication risk, and the question explicitly wants
  no duplication.

---

**Q12.** *(Scenario)* A healthcare company's data engineering team
needs to share ten Redshift tables with a partner health-insurance
company's own Redshift cluster in a different AWS account, without
copying the data and while keeping the data always current. What
should they use?

A. AWS DMS full load, scheduled nightly
B. Redshift data sharing
C. S3 export + cross-account bucket policy
D. Glue ETL job writing to the partner's S3 bucket

**Answer: B.**
- A is wrong — DMS full load is a one-time or periodic copy mechanism;
  it duplicates data and introduces staleness between runs, which
  contradicts "always current."
- **B is correct** — Redshift data sharing grants live, zero-copy
  access between clusters/accounts; the consumer always sees current
  data with no ETL lag.
- C is wrong — this requires converting the warehouse data into S3
  objects and rebuilding query access on the partner side, adding
  complexity and duplication the question wants avoided.
- D is wrong — a Glue ETL job writing to a partner bucket is a
  duplication/copy pattern, not zero-copy live sharing, and introduces
  a scheduling lag.

---

**Q13.** *(Scenario)* A financial services company must prove, during
a regulatory audit, that a specific employee downloaded a specific
customer's file from S3 on a specific date. The company currently has
only default CloudTrail settings. What is missing?

A. Nothing — default CloudTrail already captures this
B. CloudWatch Logs for the S3 service
C. CloudTrail data events for the bucket, enabled in advance
D. AWS Config rules for S3

**Answer: C.**
- A is wrong — default CloudTrail only captures management (control
  plane) events; object-level GET requests are not recorded unless
  data events are turned on.
- B is wrong — CloudWatch Logs capture application-emitted logs, not
  S3 object access by default; S3 itself doesn't push access logs
  there automatically.
- **C is correct** — CloudTrail data events, which must be explicitly
  enabled (and were not, in this scenario, going forward) before the
  read occurs, are the only way to capture object-level GET history.
- D is wrong — AWS Config tracks resource configuration state, not
  individual file download events.

---

**Q14.** *(Scenario)* A retail company wants to store a database
connection string containing only non-secret configuration (host name,
port, database name — no password) at the lowest possible cost. Which
service should they use?

A. Secrets Manager
B. Parameter Store Standard tier
C. KMS
D. Parameter Store Advanced tier

**Answer: B.**
- A is wrong — Secrets Manager costs more per item and offers rotation
  capability that's unnecessary for non-secret config values.
- **B is correct** — Parameter Store Standard tier is free and
  perfectly suited for non-secret configuration values under 4 KB.
- C is wrong — KMS manages encryption keys, not configuration value
  storage.
- D is wrong — Advanced tier has a per-parameter monthly cost that
  Standard tier avoids; nothing in the scenario needs Advanced's larger
  size limit or parameter policies.

---

**Q15.** *(Scenario)* A company's data lake pipeline runs a Glue job
that reads from an S3 bucket encrypted with a customer-managed KMS
key. The Glue job's IAM role has full `s3:GetObject` permission on the
bucket, but the job still fails to read the data. What is the most
likely cause?

A. The Glue job needs more DPUs
B. The KMS key policy does not grant the Glue role `kms:Decrypt`
C. The S3 bucket versioning is disabled
D. The Glue job bookmark is stale

**Answer: B.**
- A is wrong — DPU sizing affects performance/OOM issues, not
  authorization failures.
- **B is correct** — accessing SSE-KMS-encrypted objects requires both
  the S3 permission AND a separate KMS key policy grant for
  `kms:Decrypt`; having only the S3 permission is insufficient.
- C is wrong — versioning affects object history retention, not
  read authorization.
- D is wrong — job bookmarks control incremental processing state, not
  encryption/decryption permissions.

---

**Q16.** *(Scenario)* A media company wants a policy to automatically
extend read access to any S3 object tagged `Team=Analytics` for any
IAM principal also tagged `Team=Analytics`, without editing a policy
each time a new object or user is added. What authorization model does
this describe?

A. RBAC
B. ABAC
C. Discretionary access control via bucket ACLs
D. Policy-based access limited to a single resource

**Answer: B.**
- A is wrong — RBAC would require a static role mapped to specific
  resources; it doesn't automatically extend as new tagged objects
  appear.
- **B is correct** — this is a textbook ABAC pattern: access follows
  matching tags/attributes dynamically (`aws:PrincipalTag` /
  `aws:ResourceTag` conditions), scaling without policy edits.
- C is wrong — bucket ACLs are a legacy, coarse mechanism and don't
  support tag-matching logic.
- D is wrong — the scenario explicitly wants access to scale
  automatically across many resources, the opposite of a single-
  resource-scoped policy.

---

**Q17.** *(Scenario)* An e-commerce company needs to guarantee, at the
organizational level, that no engineer in any account can ever launch
a Redshift cluster outside two approved regions — even if an
individual account's IAM policies are misconfigured to allow it. What
should they implement?

A. IAM policy on each Redshift admin role with a region condition
B. A Service Control Policy denying `redshift:CreateCluster` outside
   the approved regions
C. AWS Config rule that deletes non-compliant clusters
D. S3 bucket policy restricting region

**Answer: B.**
- A is wrong — an IAM policy on individual roles can be bypassed by a
  different, more permissive policy elsewhere, or a new role created
  without the same restriction; it's not an org-wide guarantee.
- **B is correct** — an SCP applies to every account/role in the OU and
  cannot be overridden by any identity-based policy, which is exactly
  the "even if IAM is misconfigured" guarantee requested.
- C is wrong — Config is detective, not preventive; it would only catch
  and remediate after a non-compliant cluster is already created, not
  guarantee it can never happen.
- D is wrong — S3 bucket policies have no bearing on Redshift cluster
  creation at all.

---

**Q18.** *(Scenario)* A logistics company needs an ad-hoc SQL
capability to search across a year of exported CloudTrail logs sitting
in S3, but only occasionally — a few times per month. Which is the
most cost-appropriate approach?

A. Stand up an EMR cluster running continuously
B. Athena queries directly over the S3-exported CloudTrail logs
C. CloudTrail Lake with continuous ingestion
D. CloudWatch Logs Insights

**Answer: B.**
- A is wrong — a continuously running EMR cluster is far more expensive
  than needed for a few queries per month.
- **B is correct** — Athena's pay-per-query, serverless model is ideal
  for infrequent, ad-hoc SQL over data already sitting in S3.
- C is wrong — CloudTrail Lake is better suited to frequent, ongoing
  centralized audit queries; for occasional use, its ingestion/
  retention cost is less justified than Athena's pure pay-per-query
  model over already-exported data.
- D is wrong — CloudWatch Logs Insights queries CloudWatch Logs
  directly, not S3-exported archives; the logs described are already
  in S3.

---

**Q19.** *(Scenario)* A gaming company wants developers to see masked
credit card numbers (`****-****-****-1234`) in Redshift query results,
while the fraud team sees the full number — without maintaining two
copies of the table. Which feature satisfies this?

A. Redshift dynamic data masking
B. S3 Object Lock
C. Two separate Redshift tables with different data
D. KMS key policy per user

**Answer: A.**
- **A is correct** — Redshift dynamic data masking applies masking
  rules at query time based on the querying user's role/grant, showing
  different views of the same live column to different users without
  duplicating data.
- B is wrong — Object Lock is a WORM (write-once-read-many) retention
  control, unrelated to masking.
- C is wrong — this duplicates the table, which the question explicitly
  wants avoided.
- D is wrong — KMS key policies control who can decrypt data entirely;
  they can't apply partial, role-dependent masking to specific
  characters within a value.

---

**Q20.** *(Scenario)* A startup wants the absolute lowest operational
overhead for storing feature-flag configuration values, with no need
for rotation, cross-account sharing, or values larger than 2 KB. What
should they choose?

A. Secrets Manager
B. Parameter Store Standard
C. DynamoDB table
D. KMS

**Answer: B.**
- A is wrong — Secrets Manager's rotation and cost overhead are
  unjustified when none of its defining features (rotation,
  cross-account, large size) are needed.
- **B is correct** — Parameter Store Standard tier is free, requires no
  infrastructure, and comfortably handles 2 KB values.
- C is wrong — a DynamoDB table is unnecessary infrastructure and cost
  for simple key-value config that Parameter Store already handles
  natively.
- D is wrong — KMS stores encryption keys, not arbitrary configuration
  values.

---

**Q21.** Which two of the following are required for a principal in
Account B to read a customer-managed-KMS-encrypted S3 object owned by
Account A? (Select TWO)

A. The KMS key policy in Account A must grant the Account B principal
   `kms:Decrypt`
B. The S3 bucket policy (or equivalent) in Account A must grant Account
   B `s3:GetObject`
C. Account B must create its own copy of the KMS key
D. Account A must disable the bucket's default encryption

**Answer: A and B.**
- **A is correct** — cross-account decryption requires the key owner's
  key policy to explicitly grant the requesting account/principal.
- **B is correct** — the S3-level permission is a separate, independent
  requirement; both must be satisfied.
- C is wrong — KMS keys cannot be "copied" across accounts in this way;
  cross-account access is granted via the key policy, not duplication.
- D is wrong — disabling encryption is neither necessary nor
  appropriate; the goal is granting access to the encrypted object
  while keeping it encrypted.

---

**Q22.** *(Scenario)* A pharmaceutical company's compliance team asks
the data engineering team to demonstrate exactly what a specific
Glue crawler's IAM role permissions were six months ago, before a
policy update. Which service provides this historical configuration
detail?

A. CloudTrail Event History (default 90-day view)
B. AWS Config configuration history
C. CloudWatch Logs
D. Amazon Macie

**Answer: B.**
- A is wrong — default CloudTrail Event History only retains 90 days,
  and even a full trail records API call events, not point-in-time
  resource configuration snapshots.
- **B is correct** — AWS Config maintains configuration history and can
  show the exact state of a resource (like an IAM role's attached
  policies) at any point in its recorded history, well beyond 90 days
  if retention is configured.
- C is wrong — CloudWatch Logs store application/service log output,
  not IAM resource configuration snapshots.
- D is wrong — Macie discovers sensitive data content, unrelated to IAM
  configuration history.

---

**Q23.** *(Scenario)* An IoT company ingests device telemetry into S3
and wants near-real-time automated action the moment Macie detects
unmasked personal data in a newly landed file — specifically, moving
the file to a quarantine prefix. What's the best mechanism to wire
this together?

A. A scheduled Lambda that polls Macie's console daily
B. Macie findings published to EventBridge, triggering a Lambda function
C. CloudTrail data events triggering CloudWatch alarms
D. Manual review of the Macie dashboard

**Answer: B.**
- A is wrong — daily polling is not near-real-time and adds unnecessary
  operational complexity when an event-driven option exists.
- **B is correct** — Macie natively publishes findings as EventBridge
  events, which can directly trigger a Lambda for automated
  remediation like quarantining the object.
- C is wrong — CloudTrail data events record API activity, not Macie's
  sensitive-data findings; this doesn't achieve the described goal.
- D is wrong — manual review is neither automated nor near-real-time.

---

**Q24.** Which statement about Security Groups vs Network ACLs is
correct?

A. Both are stateful
B. Security Groups operate at the subnet level; NACLs at the instance
   level
C. NACLs support explicit deny rules; Security Groups support allow
   rules only
D. Security Groups are evaluated in numbered order, first match wins

**Answer: C.**
- A is wrong — only Security Groups are stateful; NACLs are stateless.
- B is wrong — this reverses the actual scopes: Security Groups are
  instance/ENI-level, NACLs are subnet-level.
- **C is correct** — NACLs can explicitly allow or deny; Security
  Groups can only allow (there is no explicit deny in a Security
  Group).
- D is wrong — numbered-order, first-match evaluation describes NACLs,
  not Security Groups (all Security Group rules are evaluated
  together).

---

**Q25.** *(Scenario)* A banking data platform team is designing IAM
for a new pipeline and wants to confirm their understanding of
evaluation order. If a resource-based policy explicitly allows a
principal, but that principal has an explicit deny in their identity-
based policy, what is the result?

A. Allow, because resource-based policies take precedence
B. Deny, because an explicit deny anywhere always wins
C. It depends on which policy was created first
D. AWS resolves this via a "most permissive wins" rule

**Answer: B.**
- A is wrong — resource-based policy allows do not override an explicit
  deny found elsewhere in the evaluation chain.
- **B is correct** — an explicit deny, wherever it appears in the
  policy evaluation chain, always wins immediately and stops
  evaluation; this is the first check performed.
- C is wrong — creation order/timestamp has no bearing on policy
  evaluation.
- D is wrong — AWS IAM does not use "most permissive wins" logic;
  explicit deny always overrides any allow.

---

**Q26.** *(Scenario, hard/multi-constraint)* A global insurance company
must satisfy three simultaneous requirements for its claims data lake:
(1) analysts in the EU must never see claims from US customers and
vice versa, enforced centrally and unable to be bypassed by any single
account's IAM misconfiguration; (2) all claims data at rest must be
encrypted with keys the company controls and can audit; (3) any read
of an individual claim file must be provable after the fact. Which
combination of controls satisfies all three?

A. IAM policies with region conditions on every role + SSE-S3 +
   CloudWatch Logs
B. SCP-enforced region restriction (or Lake Formation region-scoped
   grants) + SSE-KMS with a customer-managed key + CloudTrail data
   events on the claims bucket
C. S3 bucket policies only, with no encryption changes and default
   CloudTrail
D. AWS Config rules alone, retroactively deleting non-compliant reads

**Answer: B.**
- A is wrong — IAM-only region restriction can be bypassed by a
  misconfigured or overly permissive policy elsewhere, failing
  requirement 1's "unable to be bypassed" condition; SSE-S3 fails
  requirement 2 (no customer key control/audit); CloudWatch Logs alone
  doesn't capture object-level reads, failing requirement 3.
- **B is correct** — an SCP (or Lake Formation region-scoped sharing
  grants) provides the un-bypassable organizational ceiling for
  requirement 1; a customer-managed KMS key with SSE-KMS gives
  customer-controlled, auditable encryption for requirement 2;
  CloudTrail data events on the specific bucket satisfy the
  provable-read requirement 3.
- C is wrong — bucket policies alone don't address encryption key
  control, and default CloudTrail lacks the object-level data events
  needed for requirement 3.
- D is wrong — Config is a detective/remediation tool for configuration
  drift; it cannot retroactively "delete" a read that already happened,
  and doesn't address encryption key control at all.

---

**Q27.** *(Scenario)* A retail analytics team's Athena queries against
a Lake-Formation-governed database are failing with a permissions
error, even though the querying IAM role has `AmazonAthenaFullAccess`
and full `s3:GetObject` on the underlying bucket. What is the most
likely missing piece?

A. The role needs `s3:ListBucket` too
B. A Lake Formation grant (SELECT/DESCRIBE) on the specific database/
   table for that principal
C. The Athena workgroup needs more DPUs
D. The S3 bucket needs SSE-S3 instead of SSE-KMS

**Answer: B.**
- A is wrong — while `ListBucket` can matter for some access patterns,
  it doesn't explain an LF-governed table access failure when broad S3
  and Athena IAM access already exist.
- **B is correct** — Lake Formation enforces a second, independent
  permission layer on top of IAM for catalog-registered tables; broad
  IAM/S3 access is not sufficient without an explicit LF grant.
- C is wrong — Athena doesn't use "DPUs" (that's a Glue concept), and
  compute sizing wouldn't cause a permissions error.
- D is wrong — switching encryption types is unrelated to a Lake
  Formation permission gap.

---

**Q28.** Which of the following correctly matches encryption-in-
transit with its typical AWS analytics mechanism?

A. KMS customer-managed keys
B. TLS/SSL/HTTPS
C. SSE-S3
D. S3 Bucket Keys

**Answer: B.**
- A is wrong — KMS keys are an at-rest encryption mechanism, not an
  in-transit one.
- **B is correct** — TLS/SSL/HTTPS is the standard mechanism protecting
  data as it moves between clients, applications, and AWS services.
- C is wrong — SSE-S3 encrypts data at rest in S3, not while it's
  moving over the network.
- D is wrong — S3 Bucket Keys are a cost-optimization for at-rest KMS
  usage, unrelated to transit encryption.

---

**Q29.** *(Scenario)* A logistics company's security team wants to
ensure that even if an engineer's IAM user credentials are
compromised, the blast radius is minimized because credentials expire
automatically within an hour. Which authentication approach achieves
this by design?

A. IAM user with a long-lived access key
B. IAM role assumed via STS, generating temporary credentials
C. A shared service account password
D. A hardcoded API key rotated manually every 90 days

**Answer: B.**
- A is wrong — IAM user access keys are long-lived by default and don't
  expire automatically.
- **B is correct** — assuming an IAM role via STS produces temporary
  credentials with a bounded, configurable expiration (commonly up to
  an hour or a few hours), inherently limiting blast radius if leaked.
- C is wrong — shared passwords are long-lived and don't provide
  automatic expiration or per-session scoping.
- D is wrong — manual 90-day rotation still leaves a 90-day window of
  exposure if compromised, far longer than STS's short-lived tokens.

---

**Q30.** *(Scenario)* A media streaming company needs its data
governance team to discover which S3 buckets across 30 AWS accounts
contain unmasked PII, from one central place, without deploying
scanning infrastructure per account. What Macie capability supports
this?

A. Macie must be run separately and manually in each of the 30
   accounts
B. Macie's organization-wide administrator account feature, managing
   member accounts centrally
C. Macie doesn't support multi-account use
D. Export each account's S3 inventory to a spreadsheet manually

**Answer: B.**
- A is wrong — this is exactly the operational burden the organization-
  wide feature is designed to eliminate.
- **B is correct** — Macie supports designating an administrator
  account (typically the security/audit account) that centrally
  manages and views findings across all member accounts in an AWS
  Organization.
- C is wrong — Macie explicitly supports this multi-account
  organizational model.
- D is wrong — this is a manual, error-prone, non-scalable approach
  when a native managed capability exists.

---

**Q31.** *(Scenario)* A company's Redshift cluster admin wants new
analysts, when hired, to automatically inherit the correct table
permissions without the admin re-granting privileges individually
each time. What's the recommended pattern?

A. Grant permissions to each user individually as they're hired
B. Grant permissions to a Redshift group/role, then add new users to
   that group/role
C. Give every new analyst `AdministratorAccess`
D. Create a new schema per analyst

**Answer: B.**
- A is wrong — this doesn't scale and is exactly the repetitive manual
  work the question wants to avoid.
- **B is correct** — Redshift best practice is to grant privileges to
  groups/roles and manage access by changing group/role membership,
  not per-user grants.
- C is wrong — this is a severe least-privilege violation, granting far
  more than any analyst should have, and is unrelated to Redshift
  access anyway (`AdministratorAccess` is an IAM concept, not a
  Redshift privilege).
- D is wrong — creating a schema per analyst adds unnecessary
  complexity and doesn't address the group-based permission-inheritance
  goal.

---

**Q32.** Which statement correctly distinguishes AWS Config from
CloudTrail?

A. Config records API calls; CloudTrail records resource configuration
   state
B. Config records resource configuration state and evaluates
   compliance; CloudTrail records API call activity
C. They are functionally identical, just branded differently
D. Config is for encryption; CloudTrail is for authentication

**Answer: B.**
- A is wrong — this reverses their actual functions.
- **B is correct** — Config focuses on "is this resource configured
  correctly right now / has it drifted," while CloudTrail focuses on
  "who called which API, when."
- C is wrong — they serve genuinely different, complementary purposes.
- D is wrong — neither service is specifically about encryption or
  authentication; those are separate concerns (KMS, IAM).

---

**Q33.** *(Scenario)* A hospital system's data engineering team must
ensure patient record backups never replicate to a region outside the
country due to healthcare data residency law, enforced regardless of
which AWS account within their organization creates the backup. What
is the strongest control?

A. A Lambda function that checks backup destinations nightly and
   deletes non-compliant ones
B. A Service Control Policy denying backup/replication API calls to
   any region outside the approved one
C. Documentation in a wiki instructing engineers not to replicate
   cross-region
D. IAM policy on the backup admin role only

**Answer: B.**
- A is wrong — this is reactive (data may already have left the
  approved region and been read before deletion) rather than
  preventive, and deleting patient data has its own risk implications.
- **B is correct** — an SCP provides a preventive, org-wide,
  un-bypassable block on the underlying API calls that would create
  cross-region backups/replication, regardless of which account
  attempts it.
- C is wrong — documentation is not a technical control and relies on
  human compliance, which is not acceptable for a regulatory
  requirement.
- D is wrong — restricting only the backup admin role leaves the
  requirement unenforced for any other role or account that might
  configure replication.

---

**Q34.** *(Scenario)* An engineering team needs to grant a Lambda
function permission to read from DynamoDB. Which two components must
both be correctly configured? (Select TWO)

A. The Lambda function's execution role's identity-based policy
   allowing `dynamodb:GetItem`
B. The Lambda function's trust policy, allowing `lambda.amazonaws.com`
   to assume the role
C. A DynamoDB table-level "trust policy"
D. An S3 bucket policy

**Answer: A and B.**
- **A is correct** — the execution role must have a permission policy
  granting the specific DynamoDB actions needed.
- **B is correct** — separately, the role's trust policy must allow the
  Lambda service to assume it in the first place; without this, the
  function can't even obtain the role's credentials.
- C is wrong — DynamoDB tables don't have a "trust policy" concept;
  that's specific to IAM roles.
- D is wrong — an S3 bucket policy is irrelevant to a DynamoDB access
  scenario.

---

**Q35.** *(Scenario, hard)* A multinational bank's audit team wants a
single SQL-queryable view across CloudTrail events from all 50 of its
AWS accounts, retained for 5 years to satisfy a regulatory
requirement, without building custom ETL. What should they implement?

A. Export each account's CloudTrail logs to a local Athena setup per
   account
B. CloudTrail Lake, aggregating events from all 50 accounts via an
   organization trail into one queryable event data store
C. CloudWatch Logs Insights across all 50 accounts
D. AWS Config aggregator

**Answer: B.**
- A is wrong — this is exactly the fragmented, per-account setup the
  bank wants to avoid, and doesn't inherently give a single unified
  view or handle 5-year retention cleanly.
- **B is correct** — CloudTrail Lake is purpose-built for centralized,
  SQL-queryable, long-retention (up to 7 years) audit analytics across
  an entire AWS Organization via an organization-level event data
  store, with no custom ETL needed.
- C is wrong — CloudWatch Logs Insights queries CloudWatch Logs, not
  CloudTrail's structured event store, and doesn't natively provide
  5-year retention or org-wide aggregation this cleanly.
- D is wrong — AWS Config aggregator consolidates configuration
  compliance data, not CloudTrail API event history.

---

**Q36.** *(Scenario)* Which combination correctly matches masking-at-
query-time to Lake-Formation-governed data versus native Redshift
data?

A. Lake Formation column filters for S3-based catalog tables; Redshift
   dynamic data masking for native Redshift tables
B. Both use S3 Object Lock
C. Both require duplicating the table
D. Neither is possible on AWS

**Answer: A.**
- **A is correct** — Lake Formation's column permissions/filters govern
  data still registered in the Glue Catalog (queried via Athena/
  Spectrum/EMR); Redshift's own dynamic data masking feature governs
  data stored natively inside Redshift tables. They're parallel
  mechanisms for their respective storage layers.
- B is wrong — Object Lock is a WORM retention control, unrelated to
  column masking.
- C is wrong — both mechanisms explicitly avoid duplicating data; that's
  their main value proposition.
- D is wrong — both capabilities exist and are commonly tested.

---

**Q37.** *(Scenario)* A company migrating off long-lived IAM user
access keys wants to identify every IAM user in the account still
using access keys older than 90 days, as part of a security
remediation project. Which AWS capability most directly supports
this?

A. Amazon Macie
B. IAM credential report / IAM Access Analyzer findings
C. AWS Config alone with no rules
D. Redshift system tables

**Answer: B.**
- A is wrong — Macie scans S3 for sensitive data content, not IAM
  credential age.
- **B is correct** — IAM's credential report lists every user's access
  key age and last-used timestamp, purpose-built for exactly this
  audit; IAM Access Analyzer can complement this with broader
  permission analysis.
- C is wrong — AWS Config without a specific IAM-access-key-age rule
  configured provides no relevant signal on its own.
- D is wrong — Redshift system tables have no relationship to IAM
  credential auditing.

---

**Q38.** *(Scenario, hard/multi-constraint)* A biotech company's data
lake pipeline must satisfy: (a) a Glue job reads raw genomic files from
an SSE-KMS-encrypted S3 bucket using a customer-managed key; (b) the
same job writes curated output to a different bucket in a partner's
AWS account; (c) the partner must be able to decrypt and query that
output; (d) the company must be able to prove exactly which employee's
role wrote each output file. List all controls needed.

A. IAM role for the Glue job with S3 + KMS decrypt permissions on the
   source; a cross-account KMS key policy grant plus destination bucket
   policy allowing the partner account; CloudTrail data events on the
   destination bucket
B. Only an S3 bucket policy on the source bucket
C. Only IAM permissions on the Glue role, nothing else
D. SSE-S3 on both buckets to simplify cross-account access

**Answer: A.**
- **A is correct** — this is the complete chain: the Glue role needs
  read+decrypt on the source (its own account's CMK), the destination
  bucket's cross-account sharing requires both a KMS key policy grant
  to the partner account and a bucket policy granting them
  `s3:GetObject`, and proving "which role wrote each file" requires
  CloudTrail data events capturing the `PutObject` calls with the
  calling role's identity.
- B is wrong — a source-only bucket policy addresses none of the
  cross-account destination sharing or the audit requirement.
- C is wrong — IAM permissions on the Glue role alone don't grant the
  partner account decrypt access (that needs a KMS key policy grant)
  or provide the write-level audit trail (that needs CloudTrail data
  events).
- D is wrong — switching to SSE-S3 would actually make **customer-
  controlled** cross-account sharing harder/impossible in the way the
  scenario implies (SSE-S3's AWS-managed key can't be shared at all),
  and it contradicts requirement (a)'s "customer-managed key."

---

**Q39.** Which statement about VPC endpoints and encryption is
correct in the context of a private, encrypted connection from a Glue
job to S3?

A. A VPC endpoint alone provides encryption in transit; SSE-KMS is
   unnecessary
B. A Gateway VPC endpoint keeps S3 traffic off the public internet
   (network path), while SSE-KMS separately encrypts data at rest —
   these are independent controls that both matter
C. VPC endpoints and KMS are mutually exclusive; you can only use one
D. SSE-KMS makes VPC endpoints unnecessary

**Answer: B.**
- A is wrong — a VPC endpoint controls the network path, not whether
  the data itself is encrypted at rest; TLS on the connection (which
  AWS API calls use by default) handles in-transit encryption
  regardless of the endpoint.
- **B is correct** — network path privacy (VPC endpoint) and
  data-at-rest protection (SSE-KMS) are two independent, complementary
  controls; a well-architected pipeline typically uses both together.
- C is wrong — they are frequently and correctly used together, not
  mutually exclusive.
- D is wrong — SSE-KMS says nothing about whether traffic transits the
  public internet or stays private; that's the endpoint's job.

---

**Q40.** *(Scenario, hard)* A retail data platform team is asked: "How
would you design authorization so that a data mesh of 15 independent
business-unit teams can each publish their own governed data products,
have other teams discover and subscribe to them, and have PII columns
automatically hidden from any subscriber who isn't on an approved
list — all without a central team manually granting every permission?"
Which combination best satisfies this?

A. One central S3 bucket with IAM policies manually maintained by a
   central team for every subscriber
B. Lake Formation LF-Tags for scalable tag-based (ABAC-style) grants
   and column filters, combined with a catalog (Glue Data Catalog +
   DataZone/SageMaker Catalog) for self-service discovery and
   subscription per business unit
C. A single Redshift cluster shared by all 15 teams with no additional
   governance layer
D. Giving every team `AdministratorAccess` and trusting them to self-
   police

**Answer: B.**
- A is wrong — this is precisely the manual, central-bottleneck model
  the question wants eliminated, and it doesn't scale to per-column
  PII enforcement gracefully.
- **B is correct** — LF-Tags provide ABAC-style, tag-driven grants that
  scale across many tables/teams without per-object manual grants,
  column filters handle the automatic PII hiding, and a catalog layer
  (Glue Data Catalog for technical metadata, DataZone/SageMaker Catalog
  for business discovery/subscription) is exactly the data-mesh
  self-service publish/subscribe pattern the question describes.
- C is wrong — a shared cluster with no governance layer provides no
  mechanism for per-team ownership, discovery, or PII column hiding.
- D is wrong — this is a severe security anti-pattern that grants full
  administrative access instead of scoped, governed permissions.

---

**End of Domain 4.** Cross-reference the [SERVICE-SELECTION-MATRIX.md](../00-START-HERE/SERVICE-SELECTION-MATRIX.md)
Parts 13–16 for the condensed governance/encryption/secrets/monitoring
matrices, and [DECISION-TREES.md](../00-START-HERE/DECISION-TREES.md)
for additional worked walkthroughs that touch security scenarios
embedded in Domain 1–3 questions.
