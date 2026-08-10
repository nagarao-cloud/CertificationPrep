# AWS CloudTrail

> Domain alignment: primarily **Domain 4 — Data Security and Governance
> (18%)**, with a secondary role in **Domain 3 — Data Operations and
> Support (22%)** (3.3.5 "Use CloudTrail" and 3.3.1 "Extract logs for
> audits"). CloudTrail is the exam's answer to any "who did this, when,
> and from where" question stem.

## CONTENTS

- [1. Explain like I'm 12](#s1)
- [2. Explain technically](#s2)
- [3. Explain like a senior AWS data engineer](#s3)
- [4. Explain production architecture](#s4)
- [5. Explain exam traps](#s5)
- [6. Explain interview questions](#s6)
- [7. Cheat sheet](#s7)
- [8. Memory tricks](#s8)
- [9. Per-service coverage checklist](#s9)
- [10. Practice questions (15)](#s10)

---

<a name="s1"></a>
## 1. Explain like I'm 12

Imagine your house has an invisible security guard standing at every
door, every window, and every drawer — but instead of stopping anyone,
this guard just writes down in a notebook: *who* opened it, *when*,
and *where they were standing* when they did it. That notebook is
CloudTrail. It doesn't stop bad things from happening (that's a
different guard's job — IAM policies, Lake Formation, bucket
policies). It just makes sure that if something DID happen, you can
always answer "who did it and when," even months later.

Some of those "drawers" are big and important (creating a whole new
S3 bucket, deleting a Glue job) — the guard watches those by default,
for free. Other "drawers" are millions of tiny things happening
constantly (someone opening one specific book on one specific shelf —
i.e., reading one S3 object) — watching every single one of those
costs extra, so you have to specifically ask the guard to watch that
drawer too.

---

<a name="s2"></a>
## 2. Explain technically

**AWS CloudTrail** records API calls made against your AWS account —
console actions, CLI commands, SDK calls, and calls made by other AWS
services on your behalf — as JSON **event records**. Every AWS account
has CloudTrail **enabled by default** with a 90-day rolling **Event
history** you can view for free in the console, covering only
**management events**.

### 2.1 Management events vs data events

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLOUDTRAIL EVENT TYPES                       │
├───────────────────────────────┬───────────────────────────────────┤
│      MANAGEMENT EVENTS         │           DATA EVENTS              │
│   (control plane operations)   │      (resource / data plane ops)   │
├───────────────────────────────┼───────────────────────────────────┤
│ CreateBucket, DeleteTable,     │ GetObject, PutObject, DeleteObject │
│ RunJobFlow (EMR), StartJobRun  │ (S3 object-level)                  │
│ (Glue), CreateCluster (Redshift│ Invoke (Lambda function-level)     │
│ )                               │ BatchGetItem, PutItem (DynamoDB)   │
│                                 │ query/index ops (OpenSearch)       │
├───────────────────────────────┼───────────────────────────────────┤
│ ✅ Logged by default            │ ❌ NOT logged by default            │
│ ✅ Free                         │ 💲 Costs extra — billed per        │
│                                 │    100,000 events                  │
│ "Who created/deleted/modified  │ "Who READ or WROTE this SPECIFIC   │
│  this resource?"                │  object / record / invoked this    │
│                                 │  function?"                        │
└───────────────────────────────┴───────────────────────────────────┘
```

- **Management events** = control-plane operations on your AWS
  resources: creating a Redshift cluster, deleting a Glue job,
  modifying an IAM policy, starting an EMR cluster. These answer "who
  changed the *configuration* of my environment."
- **Data events** = data-plane operations happening *at high volume,
  inside* a resource: an S3 `GetObject`/`PutObject` call on one
  specific key, a Lambda function invocation, a DynamoDB item read.
  These are high-volume by nature (potentially millions per day) and
  **must be explicitly enabled per resource** (a specific bucket, a
  specific Lambda function, or all resources of that type) — and they
  **cost extra** because of that volume.

⚠️ The single most exam-tested fact in this file: **if a question asks
"who read/downloaded this S3 object" and the answer choices include
plain CloudTrail, the correct choice must specify enabling S3 *data
events*** — a plain "CloudTrail is already enabled" answer is a trap,
because management events alone never capture object-level reads.

### 2.2 Insights events (a third, optional category)

**CloudTrail Insights** automatically analyzes management event
volume and flags **unusual API call patterns** — e.g., a sudden burst
of `IAM.CreateUser` calls, or `RunInstances` calls at 3x the normal
rate — without you defining thresholds manually. This is anomaly
detection on the *audit log itself*, not a replacement for CloudWatch
Anomaly Detection on operational metrics (see `CloudWatch.md`).

### 2.3 Trails — persisting events beyond 90 days

Event history alone is temporary (90 days, console-only, management
events only). To retain events longer, query them at scale, or
receive data events, you create a **trail**:

```
   AWS API call (console, CLI, SDK, or AWS service)
            │
            v
   ┌─────────────────┐
   │   CloudTrail      │   ← always recording management events
   │   (event history) │      (90-day free rolling window)
   └────────┬──────────┘
            │  (a TRAIL persists + optionally adds data events)
            v
   ┌─────────────────┐        ┌──────────────────────┐
   │   S3 bucket       │──────▶│  Lifecycle → Glacier   │
   │  (log files, JSON  │       │  for long-term compliance│
   │  gzip, delivered   │       └──────────────────────┘
   │  every ~5 min)     │
   └────────┬──────────┘
            │  (optional, for near-real-time alerting)
            v
   ┌─────────────────────┐
   │ CloudWatch Logs group │──▶ metric filter ──▶ alarm ──▶ SNS
   └─────────────────────┘
```

A trail delivers log files to an **S3 bucket** (mandatory), can
optionally also stream to **CloudWatch Logs** (for near-real-time
alerting via metric filters/alarms — not for long-term storage, which
is what S3 is for), and can be scoped to **all regions** (recommended
default) or a single region.

### 2.4 Organization trails

For a multi-account AWS Organizations setup, an **organization trail**
created in the management account automatically applies to **every
member account**, centralizing all API activity from the entire
organization into a single S3 bucket (typically in a dedicated
log-archive account). Member accounts cannot disable or modify an
organization trail — this is deliberate, so no individual account
owner can quietly turn off auditing on themselves.

```
  Management Account
        │
        │ creates ORGANIZATION TRAIL
        v
  ┌─────────────────────────────────────────────┐
  │  Applies automatically to ALL member accounts │
  └─────────────────────────────────────────────┘
        │              │              │
        v              v              v
  Account A        Account B        Account C
  (Data Eng)       (Marketing)      (Finance)
        │              │              │
        └──────────────┴──────────────┘
                       │
                       v
        Centralized S3 bucket (log-archive account)
        Cannot be disabled by member-account admins
```

### 2.5 CloudTrail Lake

**CloudTrail Lake** is a managed, SQL-queryable **event data store**
that ingests CloudTrail events (management, data, and even non-AWS/
custom application events via the CloudTrail open-source SDK) and lets
you run **SQL queries directly against them** — no need to export to
Athena and build your own table/partitioning scheme, though a
CloudTrail Lake event data store can *also* be federated so Athena can
query it directly.

```
  Multiple accounts, multiple regions
        │        │        │
        v        v        v
  ┌───────────────────────────────┐
  │  CloudTrail Lake event data     │  ← centralized, immutable,
  │  store (up to 7 years retention)│    SQL-queryable
  └───────────────┬─────────────────┘
                   │
                   v
        SQL query: "SELECT * FROM
        event_data_store WHERE
        eventName = 'DeleteBucket'
        AND userIdentity.arn = ..."
```

Key CloudTrail Lake facts:
- Retention up to **7 years**, configurable per event data store.
- Supports **multi-account, multi-region aggregation** into one
  queryable store — the modern answer to "centralize audit logs across
  our whole organization and let the security team run SQL against
  them" without hand-building an Athena/Glue pipeline.
- Billed on **ingestion** (per GB) rather than per-query, unlike
  Athena's per-TB-scanned model.
- Can ingest **non-AWS events** (SaaS apps, on-prem systems) via the
  CloudTrail Lake `PutAuditEvents` API — useful for a single unified
  audit query surface spanning AWS and non-AWS systems.

### 2.6 Log file integrity validation

CloudTrail can **digitally sign** log files delivered to S3 using
SHA-256 hashing and public-key cryptography, and publish periodic
**digest files** that let you cryptographically verify a delivered log
file has **not been tampered with or deleted** after the fact. This is
the exam's specific answer to "prove our audit logs haven't been
altered" — a distinct capability from encryption (which protects
confidentiality, not tamper-evidence) or versioning (which protects
against accidental overwrite, not cryptographic proof of integrity).

```
CloudTrail log file (S3) ──▶ SHA-256 hash ──▶ digest file (separate,
                                                signed with CloudTrail's
                                                private key)

Later: aws cloudtrail validate-logs
       compares current hash of log file vs. hash recorded in digest
       → MISMATCH = tampering detected
```

### 2.7 EventBridge integration for near-real-time response

CloudTrail events don't just sit in S3 waiting to be queried later —
every management event (and, if enabled, data event) is also emitted
as a **near-real-time event** that **Amazon EventBridge** can match
against rules, enabling automated security response within seconds of
an API call rather than a human noticing it in a log hours later.

```
IAM.CreateAccessKey (unexpected, off-hours) called by user "intern-jdoe"
            │
            v
   CloudTrail records the event ──▶ EventBridge (near-real-time)
            │
            v
   EventBridge rule matches: eventName = "CreateAccessKey"
            │
            v
   ┌────────────────────┐
   │ Lambda: auto-revoke  │──▶ SNS: alert security team
   │ the new access key   │
   └────────────────────┘
```

This is the pattern behind "detect and automatically respond to a
suspicious API call within seconds" — a phrase that should trigger
**CloudTrail → EventBridge rule → Lambda/SNS**, not "review CloudTrail
logs periodically" (too slow) and not GuardDuty alone (GuardDuty is a
threat-detection *consumer* of CloudTrail/VPC Flow Logs/DNS logs, a
distinct managed service, not CloudTrail itself).

---

<a name="s3"></a>
## 3. Explain like a senior AWS data engineer

A senior data engineer treats CloudTrail as the answer to exactly one
question shape: **"who did X, when, and from where"** — never "is my
data quality good," never "is my pipeline healthy" (that's
CloudWatch), never "does this configuration violate our policy" (that's
AWS Config). Conflating CloudTrail with CloudWatch is the #1 junior
mistake, and the exam actively tests the distinction (see
`SERVICE-SELECTION-MATRIX.md` Part 16: "CloudWatch answers 'is it
healthy,' CloudTrail answers 'who did what'").

The second-order judgment a senior engineer makes is **cost discipline
around data events**. Turning on S3 data events for every bucket in an
account with heavy read/write traffic can produce a CloudTrail bill
that dwarfs the underlying storage cost — because data events are
billed per 100,000 events, and a busy data lake can generate tens of
millions of object reads per day. The senior answer is **scope data
events narrowly**: enable them only on the buckets that actually hold
regulated/sensitive data (PII, financial records, healthcare data)
that a compliance requirement explicitly demands be tracked at the
object level, not blanket-enabled across the account "just in case."

The third judgment: **CloudTrail is not a real-time alerting tool by
itself.** A trail delivering to S3 has up to a 15-minute delivery
latency for typical events. If the requirement is genuinely
"near-real-time," a senior engineer routes through **EventBridge**
(section 2.7), not "check the S3 bucket every few minutes with a
Lambda function polling it" — polling S3 for new CloudTrail log files
is both slower and more wasteful than subscribing to the event stream
CloudTrail already emits.

Finally, a senior engineer distinguishes **CloudTrail** (an audit log
of *actions taken*) from **Macie** (a service that scans *data content*
for sensitive information like PII patterns) and from **AWS Config**
(a service that tracks *resource configuration state over time*, e.g.
"was this S3 bucket ever made public"). All three sit in Domain 4 and
the exam pairs them constantly — CloudTrail answers "who," Macie
answers "what sensitive data exists where," Config answers "was this
resource ever configured out of compliance."

---

<a name="s4"></a>
## 4. Explain production architecture

A production-grade, compliance-ready CloudTrail deployment for a data
engineering organization looks like this:

```
┌────────────────────────────────────────────────────────────────────┐
│                     AWS ORGANIZATION (multi-account)                 │
│                                                                        │
│  Management Account                                                   │
│    └─ Organization Trail (all regions, all accounts, mandatory)       │
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │ Data Eng Acct │  │ Prod App Acct │  │  Sandbox Acct │  (many more) │
│  │ (S3 data      │  │ (Redshift,    │  │  (dev/test)   │              │
│  │  events ON    │  │  Glue events) │  │               │              │
│  │  for PII      │  │               │  │               │              │
│  │  buckets only)│  │               │  │               │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                │
│         │                  │                  │                        │
│         └──────────────────┴──────────────────┘                        │
│                             │                                          │
│                             v                                          │
│              Log-Archive Account (dedicated, locked down)              │
│         ┌─────────────────────────────────────────────┐               │
│         │  S3 bucket (Object Lock — compliance mode,    │               │
│         │  versioning, SSE-KMS customer-managed key,     │               │
│         │  bucket policy denies delete from any principal│               │
│         │  except a break-glass role)                    │               │
│         └───────────────┬─────────────────────────────┘               │
│                          │                                              │
│              ┌───────────┴────────────┐                                │
│              v                        v                                 │
│    Lifecycle → Glacier          CloudTrail Lake event data store        │
│    (7-year retention,            (SQL query surface, security team,     │
│     compliance archive)          incident investigation)                │
│                                                                          │
│         Parallel path: CloudTrail ──▶ EventBridge ──▶ Lambda/SNS        │
│         (near-real-time: e.g. root account login, IAM policy change,    │
│          S3 bucket made public — auto-remediate + alert)                │
└────────────────────────────────────────────────────────────────────┘
```

**Why each piece exists:**
- **Organization trail in the management account** — guarantees no
  member account can quietly disable auditing on itself; a single
  point of governance for the whole org.
- **Dedicated log-archive account** — separates "who can generate
  logs" (every account) from "who can read/delete logs" (a small,
  audited security team), so a compromised application account can't
  cover its tracks by deleting its own CloudTrail logs.
- **S3 Object Lock (compliance mode)** — makes the log bucket
  literally impossible to delete or overwrite, even by the account
  root user, until the retention period expires — the strongest
  tamper-resistance available.
- **SSE-KMS with a customer-managed key** — because audit logs
  themselves often contain sensitive metadata (IAM principal ARNs,
  resource names, source IPs); a CMK gives key-level access control
  and a CloudTrail-visible audit trail of *who accessed the key used to
  decrypt the audit logs* (recursive but real compliance requirement).
- **Selective data events** — only on buckets holding regulated data,
  to control cost.
- **CloudTrail Lake** — gives the security/compliance team a SQL
  interface without building custom Athena/Glue infrastructure.
- **EventBridge branch** — the near-real-time security-response path,
  running in parallel with (not instead of) the durable S3/Lake path.

---

<a name="s5"></a>
## 5. Explain exam traps

⚠️ **Trap 1 — "Who read this S3 object?" answered with plain
CloudTrail.** Management events never capture object-level reads. The
correct answer must explicitly enable **S3 data events** on that
bucket (or account-wide, if the question implies broad scope).

⚠️ **Trap 2 — CloudTrail as a performance/health monitoring tool.**
"The pipeline is running slowly, check CloudTrail" is always wrong.
CloudTrail has no concept of latency, throughput, or resource
utilization — that's CloudWatch. CloudTrail only knows *that an API
was called* and *by whom*, not how the underlying resource performed.

⚠️ **Trap 3 — Assuming CloudTrail is real-time.** Standard trail
delivery to S3 can lag up to 15 minutes. A requirement for
sub-minute/near-instant detection needs the **EventBridge** path, not
"just check CloudTrail more frequently."

⚠️ **Trap 4 — Confusing CloudTrail with AWS Config.** "Was this S3
bucket ever configured to be public?" is a **configuration history**
question → AWS Config, not CloudTrail (which shows the API call that
made it public, not a timeline of the resource's configuration state).
If a question asks for both "who did it" and "what did the
configuration look like before/after," you may need both services
together — that's a legitimate combined-answer pattern, not a trap.

⚠️ **Trap 5 — Believing member accounts in an org trail can opt out.**
They cannot, by design — a distractor answer that says "each account
can disable the organization trail for autonomy" is always wrong.

⚠️ **Trap 6 — Enabling data events account-wide "just to be safe."**
This is the wrong answer whenever the stem also emphasizes "cost-
effective" or "minimize CloudTrail costs" — the correct scope is the
specific resource(s) holding sensitive/regulated data, not blanket
enablement.

⚠️ **Trap 7 — Encryption vs integrity validation confusion.** SSE-KMS
on the log bucket protects **confidentiality** (can't be read without
the key). **Log file integrity validation** (digest files, SHA-256
signing) proves **the file wasn't tampered with** — these solve
different problems and a question asking to "prove logs weren't
altered" wants integrity validation specifically, not "we already
encrypt with KMS."

⚠️ **Trap 8 — CloudTrail Insights mistaken for CloudWatch anomaly
detection.** CloudTrail Insights flags unusual **API call volume/rate
patterns** (management-plane behavior); CloudWatch Anomaly Detection
flags unusual **metric values** (application/data behavior). Both use
statistical baselining, but on entirely different signal types.

---

<a name="s6"></a>
## 6. Explain interview questions

**Q: "A security audit needs to prove that nobody downloaded a
specific confidential file from S3 in the last quarter. How do you
answer that with certainty, retroactively?"**
A: If S3 data events were already enabled on that bucket before the
period in question, query CloudTrail (via CloudTrail Lake or an
Athena table over the exported logs) filtered on `eventName =
GetObject` and the object key. If data events were **not** enabled
during that window, the honest answer is that CloudTrail cannot
retroactively prove a negative — this is why compliance-critical
buckets need data events turned on proactively, before an incident,
not reactively after one is suspected.

**Q: "How would you detect and automatically respond to a root
account login within seconds?"**
A: Root logins are always captured as management events (specifically
`ConsoleLogin` with `userIdentity.type = Root`). Route CloudTrail
events through EventBridge with a rule matching that pattern, targeting
a Lambda function that immediately notifies security via SNS (and
optionally triggers automated remediation, like forcing an MFA
challenge or session revocation) — far faster than periodic log
review.

**Q: "How do you architect CloudTrail for a 40-account AWS
Organization so no individual account can tamper with its own audit
trail?"**
A: An organization trail created from the management account,
delivering to a centralized S3 bucket in a dedicated log-archive
account, with Object Lock in compliance mode and a bucket policy that
denies delete/overwrite to everyone except a tightly scoped
break-glass role. Member accounts cannot disable or redirect the
organization trail.

**Q: "Your CloudTrail costs jumped 10x last month — what's your first
diagnostic step?"**
A: Check whether S3 (or Lambda/DynamoDB) **data events** were recently
enabled broadly, since those are billed per 100,000 events and scale
with actual object/API traffic, unlike free management events. Narrow
data-event scope to only the specific resources that require
object-level auditing.

**Q: "What's the difference between querying CloudTrail via Athena
versus CloudTrail Lake?"**
A: Athena requires you to build and maintain your own S3 export,
Glue Catalog table, and partitioning scheme over the raw JSON log
files, and bills per TB scanned. CloudTrail Lake is a managed,
purpose-built event data store with native SQL querying, up to 7-year
retention, multi-account/region aggregation out of the box, and can
even ingest non-AWS application events — less setup, but a different
(ingestion-based) cost model.

---

<a name="s7"></a>
## 7. Cheat sheet

| Fact | Value |
|---|---|
| Enabled by default | ✅ Yes (management events, 90-day event history) |
| Default cost | Free for management events + Event history |
| Data events cost | Billed per 100,000 events; must be explicitly enabled |
| Insights events | Optional, extra cost, flags unusual API call volume |
| Trail delivery latency to S3 | Typically within 15 minutes |
| Log file format | JSON, gzip-compressed |
| Multi-region trail | Recommended default; captures all regions from one trail |
| Organization trail | Created in management account; applies to all member accounts; cannot be disabled by members |
| Log file integrity validation | SHA-256 digest files; proves tamper-free logs |
| CloudTrail Lake retention | Up to 7 years |
| CloudTrail Lake query language | SQL |
| Near-real-time response path | CloudTrail → EventBridge → Lambda/SNS |
| S3 data events cover | `GetObject`, `PutObject`, `DeleteObject`, etc. — per bucket or account-wide |
| Lambda data events cover | Function `Invoke` calls |
| DynamoDB data events cover | Item-level `GetItem`/`PutItem`/etc. |
| What CloudTrail does NOT do | Performance monitoring, resource config history, content/PII scanning |
| Answers | "Who did what, when, from where" |

### Quick decision table

| Need | Answer |
|---|---|
| "Who created/deleted this Glue job?" | CloudTrail management events (default, free) |
| "Who downloaded this specific S3 object?" | CloudTrail **data events** (must enable) |
| "Alert within seconds of a suspicious API call" | CloudTrail → **EventBridge** rule → Lambda/SNS |
| "Centralize audit logs across 40 accounts, SQL-queryable" | **Organization trail** + **CloudTrail Lake** |
| "Prove logs weren't tampered with" | **Log file integrity validation** (digest files) |
| "Is my pipeline healthy/fast?" | ❌ Not CloudTrail — CloudWatch |
| "Was this bucket ever publicly configured?" | ❌ Not CloudTrail alone — AWS Config |
| "Find PII inside my data" | ❌ Not CloudTrail — Amazon Macie |

---

<a name="s8"></a>
## 8. Memory tricks

- **"CloudTrail = the WHO. CloudWatch = the HOW."** If the question
  asks about a person/API call, it's CloudTrail. If it asks about
  latency, errors, or throughput, it's CloudWatch.
- **"Data events cost data-volume money."** Data events scale with
  actual data-plane traffic (potentially millions/day) — that's why
  they cost extra and aren't on by default, unlike the comparatively
  rare management events.
- **Mnemonic for the audit chain:** "**T**rail **L**ays **E**vents"
  → **T**rail (persist) → **L**ake (SQL query) → **E**ventBridge
  (real-time react). Three destinations for the same event stream.
- **"Org trail — can't opt out."** Just like a company-wide security
  camera policy, no individual branch office (member account) gets to
  turn off its own camera.
- **Digest files = tamper-proof seal**, like a wax seal on an envelope
  — it doesn't stop someone from reading the letter (that's
  encryption's job), it proves nobody swapped the letter inside.

---

<a name="s9"></a>
## 9. Per-service coverage checklist

**Purpose.** Record and retain a durable audit trail of API activity
(who, what, when, where) across an AWS account or organization, for
security investigation, compliance, and operational forensics.

**When to use.** Any requirement involving auditing, compliance
evidence, security incident investigation, "who changed/deleted/
accessed X," detecting anomalous account-level API behavior, or
building automated security response to specific API calls.

**When NOT to use.** Performance/health monitoring (CloudWatch);
resource configuration compliance drift over time (AWS Config);
scanning data content for PII (Macie); real-time application tracing
across microservices (X-Ray); as a substitute for access control
(CloudTrail records what happened, it does not prevent anything).

**Advantages.** Enabled by default at no cost for management events;
covers virtually every AWS API surface; near-real-time EventBridge
integration; cryptographic tamper-evidence; centralizes cleanly across
an entire organization; SQL-queryable via CloudTrail Lake without
custom pipeline-building.

**Limitations.** Data events not captured by default and cost extra
at volume; up to ~15-minute delivery latency to S3 (not truly
real-time on that path); does not scan or understand data *content*;
Event history (free tier) is capped at 90 days and management events
only; extremely high-volume data-event logging can become a
significant cost line item if scoped too broadly.

**Pricing considerations.** Management events and 90-day Event history
are free. Trails delivering to S3 incur standard S3 storage costs.
Data events and Insights events are billed per 100,000 events
ingested. CloudTrail Lake is billed on ingestion (per GB), not per
query. Long-term retention should route to S3 lifecycle → Glacier
rather than indefinite CloudWatch Logs retention, which is far more
expensive per GB at scale.

**Performance.** Not a performance concern for the workload being
monitored — CloudTrail is a passive, asynchronous logging layer; it
does not add latency to the API calls it records.

**Scaling.** Fully managed; scales automatically with API call volume
and account/organization size with no capacity planning required.

**Security.** Log files should be encrypted with SSE-KMS (ideally a
customer-managed key for compliance-grade access control and key-level
audit trail); the destination S3 bucket should use Object Lock and a
restrictive bucket policy; IAM policies should follow least privilege
for who can read/modify/delete trails.

**High availability.** Trails and event delivery are a fully managed,
regionally resilient AWS service; a multi-region trail captures events
even if a single region experiences issues, and delivery has built-in
retry.

**Failure scenarios.** A trail misconfigured to a single region misses
events from other regions; a trail without data events enabled
produces false confidence that "everything is logged" when object-
level activity is invisible; a log bucket without Object Lock/deny
policies can have its history deleted by a sufficiently privileged
(or compromised) principal, defeating the audit trail's purpose.

**Common mistakes.** Assuming CloudTrail captures object-level S3
reads by default; treating CloudTrail as a real-time alerting system
without wiring EventBridge; leaving the log bucket without lifecycle
policies (runaway storage cost); enabling data events account-wide
without considering cost; confusing CloudTrail with CloudWatch or AWS
Config in exam answer selection.

**Exam traps.** See Section 5 in full above.

**Real enterprise examples.** A bank uses an organization trail with
Object Lock compliance mode and a 7-year CloudTrail Lake retention
policy to satisfy financial regulatory audit requirements. A
healthcare company enables S3 data events specifically on the bucket
holding de-identified patient records (HIPAA audit requirement) while
leaving data events off on its much larger, non-regulated analytics
buckets to control cost. A retail company wires CloudTrail through
EventBridge to auto-revoke any IAM access key created outside business
hours by an automation account, closing a common attacker pattern
within seconds instead of during the next morning's log review.

---

<a name="s10"></a>
## 10. Practice questions (15)

**Q1.** A company must be able to prove, for any point in the past
year, exactly who deleted any Redshift cluster and when. No object-
level S3 access needs to be tracked. What is the minimum configuration
required?

A) Enable S3 data events account-wide
B) CloudTrail management events are sufficient — no additional
   configuration needed beyond ensuring a trail persists events past
   90 days (e.g., to S3)
C) Enable CloudTrail Insights
D) Deploy AWS Config with a custom rule

**Answer: B.** `DeleteCluster` is a management (control-plane) event,
captured by default. The only gap to close is retention beyond the
free 90-day Event history, which requires a trail delivering to S3.
A) is wrong — data events are for object/item-level access, not
cluster deletion. C) Insights detects unusual *volume* patterns, not
targeted retrieval of a specific historical event, and isn't required
here. D) AWS Config tracks configuration state over time, not "who
performed the deletion" — that's CloudTrail's job specifically.

**Q2.** A compliance team needs to know every time a specific
confidential object in S3 was downloaded over the past 6 months. The
bucket has had a multi-region trail enabled for a year, but data
events were never turned on for this bucket. What should the team be
told?

A) Query CloudTrail Lake — the data is there
B) Query CloudWatch Logs Insights — the data is there
C) The historical data does not exist; CloudTrail cannot retroactively
   report object-level reads that occurred while data events were
   disabled — going forward, data events must be enabled on this
   bucket
D) Enable data events now and back-query the last 6 months

**Answer: C.** Data events are only recorded from the moment they are
enabled forward — there is no retroactive capture. A) and B) are
wrong because the underlying data was simply never generated. D) is a
trap — enabling now does not retroactively populate 6 months of
history.

**Q3.** Which service call would be captured as a CloudTrail
**management** event rather than a data event?

A) `s3:GetObject`
B) `lambda:Invoke`
C) `glue:StartJobRun`
D) `dynamodb:PutItem`

**Answer: C.** Starting a Glue job is a control-plane operation on the
Glue *resource* itself — a management event, captured by default. A),
B), and D) are all high-volume, resource-content-level operations
classified as data events, requiring explicit enablement.

**Q4.** A security team wants to be paged within seconds whenever
anyone attaches an `AdministratorAccess` policy to an IAM user,
without writing a Lambda function that polls CloudTrail logs on a
timer. What is the correct architecture?

A) Schedule an hourly Lambda that scans the last hour of CloudTrail S3
   log files for `AttachUserPolicy` events
B) An EventBridge rule matching the `AttachUserPolicy` CloudTrail
   event, targeting an SNS topic
C) Enable CloudTrail Insights and check the console daily
D) Use CloudWatch Logs Insights to query CloudTrail logs every 5
   minutes via a scheduled query

**Answer: B.** CloudTrail events are emitted to EventBridge in near-
real-time; a matching rule can trigger SNS (or Lambda) within seconds
of the API call. A) and D) are both polling-based and introduce
unnecessary delay and cost. C) Insights is for aggregate anomaly
detection, not immediate per-event alerting, and checking daily
defeats "within seconds."

**Q5.** An organization with 60 AWS accounts under AWS Organizations
wants every account's CloudTrail activity centralized automatically,
with no individual account admin able to disable logging for their
own account. What should be configured?

A) A separate trail manually configured identically in each of the 60
   accounts
B) An organization trail created from the management account
C) CloudTrail Lake event data stores created independently per account
D) IAM policies denying `cloudtrail:StopLogging` in each account

**Answer: B.** An organization trail, created once from the management
account, automatically applies to and cannot be disabled by any member
account — purpose-built for this exact requirement. A) doesn't prevent
individual disablement and is high operational overhead (60 separate
configurations to maintain). C) doesn't centralize by itself and
doesn't address the "cannot disable" requirement. D) is a partial,
fragile workaround (could still be modified/removed by a sufficiently
privileged principal) rather than the purpose-built feature.

**Q6.** Which pair correctly matches the tool to the exact question it
answers?

A) CloudWatch → "who deleted this IAM user"; CloudTrail → "is Lambda
   throttling"
B) CloudTrail → "who deleted this IAM user"; CloudWatch → "is Lambda
   throttling"
C) AWS Config → "who deleted this IAM user"; CloudTrail → "was this
   bucket ever public"
D) CloudTrail → "is Lambda throttling"; AWS Config → "who deleted this
   IAM user"

**Answer: B.** CloudTrail answers who/what/when for API activity;
CloudWatch answers operational health/performance (like Lambda
throttling, captured via the `Throttles` metric). A), C), and D) swap
the services' actual responsibilities.

**Q7.** A finance company must retain audit logs for 7 years and
guarantee they cannot be deleted or modified by anyone, including a
compromised administrator account, before the retention period
expires. Which combination satisfies this?

A) CloudWatch Logs with a 7-year retention setting
B) S3 bucket with Object Lock in compliance mode, holding the trail's
   log files, with lifecycle rules to Glacier for cost efficiency
C) CloudTrail Lake with SQL query access for all engineers
D) A trail delivering only to CloudWatch Logs, no S3 destination

**Answer: B.** Object Lock in compliance mode is the specific feature
that makes objects genuinely undeletable/unmodifiable, even by the
root user, until the lock expires — combined with lifecycle transition
to Glacier for years-long cost-efficient storage. A) CloudWatch Logs
retention settings do not provide compliance-mode immutability. C)
CloudTrail Lake alone doesn't address the "guarantee cannot be
deleted" requirement without additional controls, and broad engineer
access works against a strict compliance posture. D) A trail requires
an S3 destination as its primary durable store; CloudWatch-only isn't
how trails are configured for long-term retention.

**Q8.** Why might enabling S3 data events account-wide unexpectedly
increase a company's AWS bill significantly?

A) Data events replicate the underlying S3 storage, doubling storage
   cost
B) Data events are billed per 100,000 events, and object-level S3
   activity (reads/writes) can reach millions of events per day across
   an active data lake
C) Enabling data events automatically enables Macie scanning on the
   same buckets
D) Data events require a dedicated EC2 instance to process

**Answer: B.** Data events bill on event volume, and object-level S3
traffic across a busy data lake is often orders of magnitude higher
than management-event volume — this is precisely why the exam
consistently frames "scope data events narrowly" as the cost-conscious
answer. A), C), and D) describe mechanisms CloudTrail data events do
not actually have.

**Q9.** A team needs to run ad-hoc SQL queries across CloudTrail
events spanning 12 AWS accounts and multiple regions, with up to 5
years of retention, and wants to avoid building and maintaining a
custom Glue Catalog/Athena partitioning scheme. What should they use?

A) Export logs to S3 and build a manual Athena table with a Glue
   crawler
B) CloudTrail Lake
C) CloudWatch Logs Insights across all 12 accounts
D) Amazon QuickSight connected directly to CloudTrail

**Answer: B.** CloudTrail Lake is purpose-built for exactly this:
multi-account, multi-region, SQL-queryable, managed retention up to 7
years, no custom pipeline required. A) works but requires the exact
manual setup the team wants to avoid. C) CloudWatch Logs Insights
doesn't natively aggregate across accounts without additional
cross-account log routing, and isn't a SQL query surface in the
relational sense. D) QuickSight is a BI visualization layer, not a
direct CloudTrail query engine.

**Q10.** What specifically does CloudTrail log file integrity
validation prove?

A) That the log file's contents are encrypted at rest
B) That the log file has not been modified or deleted since CloudTrail
   delivered it
C) That the account generating the logs has MFA enabled
D) That the S3 bucket storing the logs is versioned

**Answer: B.** Integrity validation uses SHA-256 digest files signed
by CloudTrail to cryptographically prove the delivered log file is
unchanged from what was originally written — a tamper-evidence
guarantee, distinct from encryption (A, a confidentiality control),
MFA (C, unrelated), or versioning (D, a different, non-cryptographic
protection against accidental overwrite).

**Q11.** A Lambda function's execution role calls
`dynamodb:BatchGetItem` thousands of times per minute as part of a
data pipeline. A security review wants full per-call audit records of
every item accessed. What must be true for this to be possible?

A) Nothing — DynamoDB item access is a management event, captured by
   default
B) DynamoDB data events must be explicitly enabled on the relevant
   table(s), and the team should expect and budget for a
   correspondingly high CloudTrail data-event bill
C) This is not possible with CloudTrail under any configuration
D) Enable CloudTrail Insights instead of data events

**Answer: B.** Item-level DynamoDB access is a data event and must be
explicitly enabled; given the described call volume, the team should
anticipate a real cost impact and consider scoping the requirement
(e.g., specific tables only) rather than blanket-enabling. A) is
wrong — item access is a data event, not free-by-default. C) is
false — CloudTrail data events do cover this. D) Insights doesn't
provide per-call audit detail; it flags anomalous volume trends.

**Q12.** Which of the following is the correct sequence in an
automated "detect and respond to a leaked/misused IAM access key"
architecture?

A) CloudWatch Logs Insights query run hourly → email report
B) CloudTrail records the suspicious API call → EventBridge rule
   matches the event pattern → Lambda disables the key and notifies
   via SNS
C) AWS Config detects the key was created → sends a weekly compliance
   report
D) Macie scans the key's usage pattern for anomalies

**Answer: B.** This is the canonical CloudTrail-to-EventBridge
near-real-time security automation pattern. A) is too slow (hourly)
for "detect and respond." C) AWS Config is about resource
configuration state, not real-time API-call response, and weekly is
far too slow. D) Macie scans data content for sensitive information,
not IAM key usage behavior.

**Q13.** A data engineering team enabled a trail in only `us-east-1`.
Six months later, an incident investigation into a Glue job created in
`eu-west-1` finds no corresponding CloudTrail record. What was
misconfigured?

A) Data events were not enabled
B) The trail should have been configured to apply to all regions
   (a multi-region trail), not just `us-east-1`
C) CloudTrail Lake was not used
D) CloudTrail Insights was disabled

**Answer: B.** A single-region trail only captures activity occurring
in (or global-service activity attributed to) that region; a
multi-region trail is the standard, recommended configuration to avoid
exactly this blind spot. A) is irrelevant — `StartJobRun`/`CreateJob`
are management events regardless of data-event settings. C) and D)
don't address the actual root cause (regional trail scope).

**Q14.** Which statement correctly distinguishes CloudTrail from AWS
Config?

A) CloudTrail tracks configuration drift over time; AWS Config logs API
   calls
B) CloudTrail logs the API calls that changed a resource (who, when);
   AWS Config tracks the resource's configuration state over time
   (what it looked like at any point, and whether it was ever
   non-compliant)
C) They are functionally identical and either can be used
   interchangeably for audit and compliance
D) AWS Config is a real-time event router; CloudTrail is a
   configuration snapshot service

**Answer: B.** This is the precise division of responsibility: action-
log (CloudTrail) versus state-history (Config). A) and D) reverse the
services' actual roles. C) is incorrect — many exam questions
specifically test that they are not interchangeable and are often used
together (CloudTrail shows who made a change; Config shows what state
resulted).

**Q15.** A company wants to minimize CloudTrail-related cost while
still satisfying a compliance requirement to audit access to one
specific S3 bucket containing customer PII, out of 200 buckets in the
account. What is the most cost-effective correct configuration?

A) Enable S3 data events for all 200 buckets, to be thorough
B) Enable S3 data events scoped to only the one bucket containing PII
C) Rely on management events only, since they are free
D) Disable CloudTrail entirely and use S3 server access logging
   instead

**Answer: B.** Scoping data events narrowly to the single bucket that
actually requires object-level audit satisfies the compliance
requirement while avoiding the cost of logging object-level activity
across 199 unrelated buckets. A) is the costly, unscoped mistake the
exam flags as a trap. C) fails the requirement outright — management
events never capture object-level S3 access. D) S3 server access logs
are a separate, less structured logging mechanism and don't integrate
with CloudTrail Lake/EventBridge the way data events do; it doesn't
satisfy "audit access" in the CloudTrail-native sense the requirement
implies.
