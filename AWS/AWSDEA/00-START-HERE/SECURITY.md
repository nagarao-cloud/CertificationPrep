# Security Deep Dive — Cross-Cutting Guide

> This file is the **cross-cutting** companion to
> [`01-domains/DOMAIN-4-DATA-SECURITY.md`](../01-domains/DOMAIN-4-DATA-SECURITY.md)
> (18% of the exam, full 2000+ line treatment). Domain 4 covers every
> security task statement in depth with its own 8-step pass, decision
> trees, and 40-question bank. This file does something different: it
> takes security *out* of its own domain silo and walks it as a single
> thread running through an entire pipeline — because on the real exam,
> security questions rarely say "Domain 4" on them. They show up
> disguised inside Domain 1 ingestion questions ("least operational
> overhead to encrypt data in transit from an on-prem source"), Domain 2
> storage questions ("which storage class supports... and encrypts
> with..."), and Domain 3 operations questions ("which log source proves
> who read this object"). This guide is the checklist you run against
> *any* pipeline, plus the two facts (IAM evaluation order, Secrets
> Manager vs. Parameter Store) that are tested more than anything else
> in the domain — reproduced here to match Domain 4's canonical
> versions exactly, not as a competing definition.
>
> **Currency note:** AWS SCT (Schema Conversion Tool) was removed from
> DEA-C01 scope in the December 2025 revision — where schema conversion
> comes up below, the current answer is **DMS Schema Conversion**, not
> "SCT." AWS CodeCommit is also out of scope.

---

## 1. The end-to-end "secure this pipeline" checklist

Read this top to bottom against any architecture diagram — on the exam
or in real life. Every row maps to a specific AWS control, and the
order roughly follows data as it moves through a pipeline.

```
   SOURCE          INGEST          STORE           CATALOG        PROCESS         SERVE
 ┌────────┐   ┌────────────┐  ┌────────────┐  ┌────────────┐ ┌────────────┐ ┌────────────┐
 │ On-prem│──▶│ TLS in      │─▶│ SSE-KMS at │─▶│ Lake        │▶│ IAM role,  │▶│ Row/column │
 │ DB/API │   │ transit;    │  │ rest; S3   │  │ Formation   │ │ least-priv │ │ masking;   │
 │        │   │ Secrets Mgr │  │ Block      │  │ governs     │ │ VPC        │ │ audit trail│
 │        │   │ for creds   │  │ Public     │  │ fine-grained│ │ endpoint   │ │ on every   │
 │        │   │             │  │ Access     │  │ access      │ │ (no public │ │ read       │
 │        │   │             │  │            │  │             │ │ internet)  │ │            │
 └────────┘   └────────────┘  └────────────┘  └────────────┘ └────────────┘ └────────────┘
                    │                │               │              │              │
                    └────────────────┴───────────────┴──────────────┴──────────────┘
                                            │
                    IAM everywhere · KMS everywhere · CloudTrail on everything ·
                    SCP as the org-wide ceiling · least privilege by default
```

| # | Checklist item | Control | Notes / exam trap |
|---|---|---|---|
| 1 | Encryption **in transit**, source to ingest | TLS/HTTPS/SSL on every hop; DMS SSL endpoints for CDC | "In transit" ≠ "at rest" — the exam tests both independently in the same scenario |
| 2 | No hardcoded credentials anywhere in code or config | Secrets Manager (rotated) or Parameter Store SecureString | See §3 for the exact decision tree |
| 3 | Encryption **at rest** on every storage layer touched | SSE-S3 (default, no key mgmt) or SSE-KMS/DSSE-KMS (audit + rotation control) | Compliance/audit requirement in the scenario ⇒ KMS, not SSE-S3 |
| 4 | No public access on any data store | S3 Block Public Access (account + bucket level), private subnets for RDS/Redshift | Block Public Access is an account-level setting many candidates forget exists above the bucket level |
| 5 | Least-privilege IAM on every role that touches data | Custom, scoped IAM policy — not a managed `*FullAccess` policy | "Least privilege" in a question stem is a strong signal the correct answer is a custom policy, not a broad managed one |
| 6 | Fine-grained governance where access needs to vary by column/row/user | Lake Formation (LF-Tags at scale, data filters for column/row) | IAM cannot express "hide this column" — that's the single fastest tell it's a Lake Formation question |
| 7 | Network path stays off the public internet | VPC endpoints — **gateway** (S3, DynamoDB, no cost) vs. **interface**/PrivateLink (everything else, hourly + data cost) | Gateway endpoints are free and route-table-based; interface endpoints are ENIs with a per-hour cost — the exam tests which type per service |
| 8 | Every API call and every sensitive object read is attributable | CloudTrail **management events** (who changed what) + **data events** (who read/wrote a specific object, must be explicitly enabled) | Data events are opt-in and cost extra — the exam scenario "we need to know who read this specific S3 object" is *always* pointing at data events, not management events alone |
| 9 | PII/PHI doesn't leak into a zone that shouldn't have it | Amazon Macie (S3 discovery/classification) + masking/tokenization before it lands in a shared zone | Macie discovers; it doesn't remediate by itself — pair it with a masking step or Lake Formation restriction |
| 10 | Org-wide guardrails that no single account/role can override | SCPs (Service Control Policies) — region restriction, deny risky actions org-wide | SCP is a **ceiling**, never a grant — it can only take away or bound what IAM may otherwise allow |
| 11 | Configuration drift is caught, not just prevented | AWS Config rules + conformance packs | Config is *detective*, not *preventive* — a resource can be non-compliant for a window before remediation runs; don't confuse it with an SCP |
| 12 | Cross-account access is explicit and minimal | Resource policies (bucket/key policy) + AssumeRole, or RAM/Lake Formation sharing for governed data | Cross-account KMS access needs the *key policy* to name the other account, not just the caller's own IAM policy |

**The one-line version of this whole checklist:** encrypt both states
(rest and transit), never hardcode a secret, default to zero public
access and zero public network path, grant the least each principal
needs, reach for Lake Formation the moment access varies below the
table level, and log everything you'd need to reconstruct "who did
what" during an incident review.

---

## 2. IAM policy evaluation order

> **This section matches
> [`DOMAIN-4-DATA-SECURITY.md` §8, Tree 1](../01-domains/DOMAIN-4-DATA-SECURITY.md#8-decision-trees)
> exactly.** It's reproduced here rather than summarized because it's
> one of the single most-tested facts on the exam and paraphrasing it
> risks introducing a contradiction. If the two versions ever appear to
> diverge, Domain 4's is the canonical source — file an issue against
> this one.

This exact sequence is worth memorizing verbatim, not just the names in
some order:

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

**Mnemonic (same as Domain 4):** *"**D**eny **S**tops **R**eally
**P**owerful **S**ession **I**dentities"* — **D**eny, **S**CP,
**R**esource, Permission **B**oundary, **S**ession, **I**dentity.

**The exam trap this order defeats:** a question gives you a broad
`Allow *` identity policy and a bucket policy that also allows access,
then adds one throwaway detail — "a permission boundary limits this
role to read-only" or "an SCP denies this action for the OU." Candidates
who evaluate only the identity policy get it wrong. Whoever finds the
explicit deny or the tightest ceiling first gets it right — evaluation
order is a filter, not a vote.

---

## 3. Secrets Manager vs. Parameter Store

> **Matches [`DOMAIN-4-DATA-SECURITY.md` §8, Tree 2](../01-domains/DOMAIN-4-DATA-SECURITY.md#8-decision-trees)
> and §4.1.3 exactly** — same decision tree, same mnemonic.

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

**Mnemonic:** *"Rotate = Manager."* Anything needing scheduled rotation
goes to Secrets **Manager**; cheap and static goes to Parameter
**Store**.

| Dimension | Secrets Manager | Parameter Store |
|---|---|---|
| Purpose | Store + auto-rotate credentials and secrets | Store config values and secrets (SecureString) |
| Built-in rotation | Yes — native Lambda rotation for RDS/Aurora/Redshift/DocumentDB | No — rotation must be built manually if needed at all |
| Max value size | 64 KB | 4 KB (Standard, free) / 8 KB (Advanced, paid) |
| Cross-account sharing | Yes, via resource policy | Limited — not its primary use case |
| Cost | ~$0.40/secret/month + API calls | Standard tier free; Advanced tier has per-parameter and API cost |
| Encryption | Always KMS-encrypted, no opt-out | SecureString type uses KMS; String/StringList types are not encrypted |
| Typical use | DB passwords, API keys, OAuth tokens | Feature flags, non-sensitive config, and — via SecureString — smaller static secrets |
| Exam trap | Picking this for "lowest cost" scenarios — it's never the cheap answer | Forgetting SecureString still needs a KMS key; plain String/StringList do not encrypt |

---

## 4. VPC endpoints — gateway vs. interface

| | Gateway endpoint | Interface endpoint (PrivateLink) |
|---|---|---|
| Services | S3, DynamoDB only | Everything else (Glue, Kinesis, Secrets Manager, SNS, SQS, KMS, Athena, Redshift Data API, etc.) |
| How it works | Route table entry — traffic routes privately without leaving the VPC | An ENI with a private IP in your subnet; DNS resolves the service name to it |
| Cost | Free | Hourly charge per endpoint per AZ + data processing charge |
| Cross-VPC/on-prem access | No (VPC-local only) | Yes, when combined with PrivateLink/hybrid DNS |
| Exam tell | "S3 access with zero data-transfer cost, no NAT gateway" | "Private access to \[any service that isn't S3/DynamoDB] without traversing the internet" |

**Why this matters for a pipeline:** a Glue job in a VPC that reads
from S3 and calls Secrets Manager needs **two different endpoint
types** — a gateway endpoint for S3 (free) and an interface endpoint
for Secrets Manager (billed). A common exam trap offers "just add a NAT
gateway" as an option; it works, but it's neither the least-cost nor
the most private-by-design answer when VPC endpoints exist for the
exact service in question.

---

## 5. Encryption summary — at rest and in transit

| Layer | At rest | In transit |
|---|---|---|
| S3 | SSE-S3 (default, AWS-owned key) / SSE-KMS (customer/AWS-managed CMK, audit trail, rotation control) / DSSE-KMS (double envelope, compliance-driven) / SSE-C (customer-supplied key, rare) | HTTPS enforced via bucket policy `aws:SecureTransport` condition |
| Redshift | KMS encryption at cluster creation (cannot be added after the fact without a snapshot/restore) | SSL/TLS-enforced JDBC/ODBC connections |
| DynamoDB | Encryption at rest always on (AWS-owned by default, or KMS CMK for audit control) | TLS by default on the API |
| Kinesis/Amazon Data Firehose | Server-side encryption with KMS (optional but recommended) | TLS to producers and consumers |
| RDS/Aurora | KMS at creation time (same restriction as Redshift — can't retrofit without snapshot/restore) | SSL/TLS-enforced connections |
| Glue/EMR | S3 encryption applies to data at rest; EMR also supports at-rest encryption for local disks (LUKS) | In-transit encryption between nodes (TLS/EMRFS encryption) |

**Recurring exam trap:** "add encryption to an existing unencrypted
Redshift cluster / RDS instance" is **not** an in-place operation —
the answer path is snapshot → copy snapshot with encryption enabled →
restore from the encrypted snapshot. Picking an option that implies
toggling encryption on live is the wrong answer every time this comes
up.

---

## 6. Lake Formation governance, in one paragraph

Lake Formation adds a permissions layer **on top of** IAM for
databases/tables it governs — once a table is registered under Lake
Formation, direct IAM `s3:GetObject` access to the underlying data is
intentionally overridden, and access is controlled through Lake
Formation grants instead (table/column/row/cell level, or LF-Tags for
attribute-based access at scale). The most common real-world and exam
failure mode: a role has broad, correct-looking IAM permissions but is
still denied, because nobody granted that principal Lake Formation
access on the specific table — the fix is a Lake Formation grant, not
a wider IAM policy. See §2.4.2 (RBAC vs. ABAC vs. Lake Formation) in
Domain 4 for the full decision tree on when column/row filters versus
LF-Tags versus plain role-based grants is the right shape.

---

## 7. Audit logging — what proves "who did what"

| Question the scenario asks | Answer |
|---|---|
| "Who changed this resource's configuration?" | CloudTrail **management events** (on by default, 90-day console lookup, indefinite in an S3-delivered trail) |
| "Who read/wrote this specific S3 object / invoked this specific Lambda?" | CloudTrail **data events** — must be explicitly enabled per resource, costs extra |
| "Query years of audit history with SQL, no separate log pipeline" | **CloudTrail Lake** |
| "Search recent application logs interactively" | CloudWatch Logs Insights |
| "Full-text/dashboard search across logs long-term" | OpenSearch Service (ingest CloudWatch Logs into it) |
| "Detect PII drift into a bucket that shouldn't have it" | Amazon Macie, scheduled or continuous jobs |
| "Prove a resource's configuration was compliant at a point in time" | AWS Config (detective, with optional auto-remediation) |

---

## 8. Practice questions

**Q1.** A role has an identity-based policy allowing `s3:GetObject` on
a bucket, and no other policy exists. A teammate then attaches a
permission boundary to the role that does **not** mention S3 at all.
What happens on the next `GetObject` call?

A. Allowed — the permission boundary doesn't restrict anything not
mentioned
B. Denied — a permission boundary must explicitly allow every action
C. Allowed — permission boundaries only apply to resource policies
D. Denied — any permission boundary blocks all access by default

<details><summary>Answer</summary>

**B is correct.** A permission boundary is a *maximum* — it must
explicitly allow (or at least not exclude) an action for it to pass
through. If the boundary is silent on S3, S3 actions are effectively
outside what the boundary permits, so the request is denied at the
permission-boundary gate even though the identity policy alone would
have allowed it. **A** is wrong because it inverts how boundaries work
— they restrict by omission, not the other way round. **C** is wrong;
boundaries apply to identity-based access via the principal, not to
resource policies. **D** is wrong — boundaries aren't a blanket switch;
they define a scope, and other actions within that scope still work
normally.
</details>

**Q2.** A Glue job needs to read from S3 and retrieve a database
password from Secrets Manager, running inside a VPC with no NAT
gateway and no internet access. What's the minimum set of VPC endpoints
required?

A. One interface endpoint covering both S3 and Secrets Manager
B. A gateway endpoint for S3 and an interface endpoint for Secrets Manager
C. Two gateway endpoints, one per service
D. No endpoints needed — Glue jobs always have implicit AWS API access

<details><summary>Answer</summary>

**B is correct.** S3 only supports **gateway** endpoints (free,
route-table-based); Secrets Manager is not one of the two gateway-only
services (S3, DynamoDB) and requires an **interface** endpoint
(PrivateLink, billed hourly). **A** is wrong — S3 doesn't support
interface endpoints as its gateway mechanism; combining both into one
endpoint isn't how the feature works. **C** is wrong — Secrets Manager
has no gateway endpoint option. **D** is wrong — without NAT or
endpoints, a VPC-resident job has no path to any AWS API at all.
</details>

**Q3.** A compliance team requires that a specific S3 bucket's
encryption key can be rotated on a controlled schedule with a full
audit trail of every use. Which encryption option satisfies this with
the least operational overhead?

A. SSE-S3
B. SSE-KMS with a customer-managed key
C. SSE-C
D. Client-side encryption before upload

<details><summary>Answer</summary>

**B is correct.** A customer-managed KMS key gives control over
rotation policy and produces a CloudTrail record for every
`Encrypt`/`Decrypt` call, satisfying both audit and rotation-control
requirements without any custom code. **A** is wrong — SSE-S3 uses an
AWS-owned key with no customer rotation control or per-use audit
detail. **C** is wrong — SSE-C pushes key management entirely onto the
customer (supplying the key on every request), which is *more*
operational overhead, not less. **D** is wrong for the same reason —
it's the most operationally heavy option, requiring custom
encrypt/decrypt code in every producer and consumer.
</details>

**Q4.** A table is registered under Lake Formation. A data engineer's
IAM role has `AmazonS3FullAccess` attached. They query the table
through Athena and are denied. What is the most likely cause?

A. Athena doesn't support Lake Formation-governed tables
B. The engineer has no Lake Formation grant on the table
C. `AmazonS3FullAccess` is a deprecated policy
D. The bucket policy is blocking Athena's service role

<details><summary>Answer</summary>

**B is correct** — this is the single most common Lake Formation
exam trap. Once a table is Lake Formation-governed, direct IAM S3
access is superseded by Lake Formation's own permission model; broad
IAM S3 access does not grant Lake Formation table access. **A** is
wrong — Athena fully supports Lake Formation-governed tables; that's a
primary use case. **C** is wrong — the policy still exists and works
for plain S3 access, it's just irrelevant here. **D** is wrong — a
bucket policy denial would produce a different, S3-specific error
pattern, and the scenario's setup (broad S3 access, denied only through
Lake Formation) points specifically at a missing LF grant.
</details>

**Q5.** Which combination correctly matches "who read this specific
object" to its required configuration?

A. CloudTrail management events, enabled by default
B. CloudTrail data events, must be explicitly enabled per resource
C. AWS Config, enabled by default
D. VPC Flow Logs, enabled by default

<details><summary>Answer</summary>

**B is correct.** Object-level read/write auditing requires CloudTrail
**data events**, which are opt-in (per bucket, or account-wide) and
cost extra per event — unlike management events, they are not on by
default. **A** is wrong — management events cover control-plane
actions (bucket creation, policy changes), not individual object reads.
**C** is wrong — Config tracks resource configuration state and
compliance, not per-object access. **D** is wrong — Flow Logs capture
network traffic metadata, not application-level object access.
</details>

**Q6.** A team needs a config value used by multiple Lambda functions
that changes rarely, is not sensitive, and must not incur additional
cost. What's the right store?

A. Secrets Manager
B. Parameter Store, Standard tier, String type
C. Parameter Store, Advanced tier, SecureString type
D. DynamoDB table dedicated to configuration

<details><summary>Answer</summary>

**B is correct.** Non-sensitive, low-change-frequency config with a
zero-cost requirement is exactly Parameter Store's Standard tier —
free, and String type is appropriate since the value isn't sensitive
(SecureString would add unneeded KMS overhead for non-sensitive data).
**A** is wrong — Secrets Manager is billed per secret and is the wrong
tool for non-sensitive config regardless of rotation needs. **C** is
wrong — Advanced tier and SecureString both add cost/complexity not
justified by non-sensitive data. **D** is wrong — introduces
operational overhead (a table to manage, provisioned/on-demand
capacity) for a problem Parameter Store already solves for free.
</details>

**Q7.** An SCP at the OU level denies `s3:PutBucketReplication` for all
accounts in that OU. An account administrator within that OU attaches
an identity policy explicitly allowing `s3:PutBucketReplication` to
their own role. What happens?

A. Allowed — identity policies override SCPs for the account's own
resources
B. Denied — an SCP is a ceiling and cannot be overridden by any
identity policy beneath it
C. Allowed — only explicit denies at the identity level matter
D. It depends on whether MFA was used

<details><summary>Answer</summary>

**B is correct.** SCPs set the maximum possible permissions for every
principal in the OU/account; no identity-based policy, however
explicit, can grant back something an SCP has excluded. This is the
"SCP is the ceiling, IAM is the floor" relationship. **A** is wrong —
this misunderstands SCP precedence entirely; SCPs are evaluated before
and constrain identity policies, not the reverse. **C** is wrong —
explicit identity-level denies matter, but an SCP restriction isn't
an "explicit deny to be checked against"; it simply removes the action
from what's grantable in the first place. **D** is wrong — MFA is
unrelated to SCP evaluation.
</details>

**Q8.** A cross-account role needs to decrypt an object encrypted with
a customer-managed KMS key owned by a different account. The role's
own IAM policy allows `kms:Decrypt` on the key's ARN. The call still
fails. What's missing?

A. The role needs `kms:*` instead of `kms:Decrypt`
B. The key's key policy must also explicitly allow the calling account/role
C. KMS doesn't support cross-account access under any configuration
D. The S3 bucket policy must allow `kms:Decrypt` instead

<details><summary>Answer</summary>

**B is correct.** Cross-account KMS access requires **both** sides to
agree: the caller's IAM policy (already in place here) **and** the
key's own resource-based key policy naming the external account or
role. Without the key policy granting it, the caller-side IAM policy
alone is insufficient — this mirrors the general resource-policy layer
in the evaluation order. **A** is wrong — broader IAM permissions on
the caller's side don't fix a missing grant on the key's side. **C** is
wrong — cross-account KMS access is a standard, supported pattern, just
one that requires the key policy update. **D** is wrong — S3 bucket
policies control S3 access, not KMS decrypt permissions; the key policy
is the correct place for this grant.
</details>

**Q9.** Which service is the correct, least-effort answer for
discovering unclassified PII scattered across dozens of S3 buckets?

A. AWS Config
B. Amazon Macie
C. Manually scripted regex scans via Lambda
D. CloudTrail data events

<details><summary>Answer</summary>

**B is correct.** Macie is purpose-built for automated, ML-assisted
PII/sensitive-data discovery and classification across S3 at scale,
with essentially no custom code required. **A** is wrong — Config
tracks resource configuration compliance, not data content. **C** is
wrong — technically possible, but far higher operational overhead than
a managed service built for exactly this; the exam consistently favors
the managed answer when one exists. **D** is wrong — data events log
*access* to objects, not their *content*; they can't tell you what's
inside a file.
</details>

**Q10.** A pipeline scenario states: "the team needs the database
credential rotated automatically every 30 days with zero application
downtime, for an Aurora PostgreSQL instance." Which is correct?

A. Store it in Parameter Store SecureString and rotate manually every 30 days
B. Store it in Secrets Manager and use the built-in native rotation for Aurora
C. Hardcode it in an encrypted Lambda environment variable, refreshed via CI/CD
D. Store it in S3 with SSE-KMS and refresh via a scheduled Lambda

<details><summary>Answer</summary>

**B is correct** — this is the textbook Secrets Manager use case: a
credential (not config), needing scheduled rotation, for a service
(Aurora) with a native built-in rotation Lambda AWS already provides —
zero custom rotation logic required and no application downtime because
Secrets Manager updates the database password and the secret value
together. **A** is wrong — Parameter Store has no built-in rotation;
"manually every 30 days" is exactly the operational burden the
requirement says to avoid. **C** is wrong — hardcoding any credential,
even encrypted, in environment variables refreshed by CI/CD reintroduces
manual rotation logic and risk of desync. **D** is wrong — S3 is not
designed for credential storage/rotation and this reinvents Secrets
Manager badly.
</details>

---

## 9. Cross-reference index

| Topic | Full depth lives in |
|---|---|
| All five Domain 4 task statements, 40-question bank | `01-domains/DOMAIN-4-DATA-SECURITY.md` |
| RBAC vs. ABAC vs. Lake Formation column/row security tree | `01-domains/DOMAIN-4-DATA-SECURITY.md` §8, Tree 3 |
| Redshift dynamic data masking, data sharing security | `01-domains/DOMAIN-4-DATA-SECURITY.md` §4.5 |
| Production incident diagnostics for access-denial scenarios | `00-START-HERE/TROUBLESHOOTING.md` |
| Security questions framed as Well-Architected "Security pillar" | `00-START-HERE/WELL-ARCHITECTED.md` |
