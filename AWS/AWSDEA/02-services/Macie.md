# Amazon Macie

> A **discovery** service, not an **enforcement** service — the
> distinction the exam tests hardest. Macie uses machine learning and
> pattern matching to find sensitive data (PII, PHI, financial data,
> credentials) sitting in S3, and reports findings; it does not itself
> block access or transform data. This file covers scanning mechanics
> (sampling vs. full-bucket), sensitive data discovery jobs, detection
> categories, findings severity, the EventBridge automated-remediation
> pattern, the Lake Formation hand-off, pricing, and custom data
> identifiers.

## CONTENTS

- [1. Explain like I'm 12](#eli12)
- [2. Explain technically](#technical)
- [3. Explain like a Senior AWS Data Engineer](#senior)
- [4. Production architecture](#architecture)
- [5. How Macie scans S3 — sampling vs. full-bucket](#scanning)
- [6. Sensitive data discovery jobs](#discoveryjobs)
- [7. Detection categories — PII, PHI, financial data, credentials](#categories)
- [8. Custom data identifiers](#customidentifiers)
- [9. Findings and severity](#findings)
- [10. Integration with EventBridge for automated remediation](#eventbridge)
- [11. Integration with Lake Formation for access restriction](#lakeformation)
- [12. Pricing model](#pricing)
- [13. When to use / when NOT to use](#whentouse)
- [14. Advantages and limitations](#advlim)
- [15. Performance, scaling, and high availability](#perfscale)
- [16. Security](#security)
- [17. Failure scenarios and common mistakes](#failures)
- [18. Exam traps](#examtraps)
- [19. Interview questions](#interview)
- [20. Cheat sheet](#cheatsheet)
- [21. Memory tricks](#mnemonics)
- [22. Practice questions (15)](#practice)

---

<a name="eli12"></a>
## 1. Explain like I'm 12

Imagine a huge storage unit full of thousands of unlabeled boxes, and
somewhere in there might be boxes containing people's social security
numbers, medical records, or credit card numbers — but nobody
remembers which boxes. **Amazon Macie** is like a smart robot you send
in with a flashlight and a checklist: it opens boxes, checks the
contents against patterns it knows ("this looks like a social security
number," "this looks like a medical record number"), and hands you a
report: "box 4,502 has 30 social security numbers in it, box 8,901 has
none." Macie doesn't lock the boxes or move them — it just tells you
where the sensitive stuff is, so *you* (or an automated helper you set
up) can decide what to do about it.

<a name="technical"></a>
## 2. Explain technically

Amazon Macie is a fully managed **sensitive data discovery and
classification** service that uses **machine learning** and **pattern
matching** to scan objects in Amazon S3 and identify sensitive data —
personally identifiable information (PII), protected health
information (PHI), financial data, and credentials — without requiring
data to move or be copied out of S3. Macie continuously evaluates
S3 bucket-level **security and access posture** (public accessibility,
encryption status, sharing configuration) at no additional cost, and
separately runs **sensitive data discovery jobs** — either one-time or
scheduled — that actually inspect object *contents* and produce
**findings**, each with an assigned severity, published to the Macie
console and, critically, to **Amazon EventBridge** for automated
downstream action. Macie is explicitly a **discovery** tool: it
identifies and reports, it does not itself encrypt, mask, quarantine,
or restrict access to what it finds — those actions require a
separate response mechanism (typically Lambda, triggered via
EventBridge).

<a name="senior"></a>
## 3. Explain like a Senior AWS Data Engineer

A senior engineer's first instinct with Macie is **scope before you
scan** — running a full, unscoped sensitive-data discovery job across
an entire multi-petabyte data lake is both the most expensive and the
least useful way to use it, because Macie bills **per GB scanned**;
the senior pattern is to scope discovery jobs to buckets/prefixes that
plausibly contain sensitive data (new source onboarding, a raw/bronze
landing zone, a specific compliance-relevant dataset) rather than
"scan everything, always." The second senior instinct: Macie findings
are **inert on their own** unless wired to a response — a mature
setup treats every Macie finding as an **EventBridge event** that
triggers automated remediation (quarantine the object, tighten a
bucket policy, notify governance) or, more durably, feeds into a
**Lake Formation** access-restriction decision so the *table/column*
containing the flagged data gets a permanent, governed restriction
rather than a one-off manual fix. Third: a senior engineer knows
Macie's out-of-the-box **managed data identifiers** cover common
patterns (SSNs, credit cards, AWS credentials) but organization-
specific sensitive patterns — an internal employee ID format, a
proprietary account-number scheme — require a **custom data
identifier** (regex-based); relying only on managed identifiers and
assuming "Macie will catch everything sensitive" is a common and
costly misunderstanding.

<a name="architecture"></a>
## 4. Production architecture

```
        ┌──────────────────────────────┐
        │   S3 Data Lake (many buckets)  │
        │   - raw/bronze intake zone       │
        │   - curated zone                   │
        └──────────────┬───────────────-┘
                        │  continuous, no-cost:
                        │  bucket-level posture check
                        │  (public access, encryption)
                        v
        ┌──────────────────────────────┐
        │   AMAZON MACIE                  │
        │                                    │
        │  Managed data identifiers          │
        │  (SSN, credit card, AWS creds...)   │
        │  + Custom data identifiers (regex)   │
        │                                       │
        │  SENSITIVE DATA DISCOVERY JOB           │
        │  (scoped to specific buckets/prefixes,   │
        │   sampling % configurable, one-time or    │
        │   scheduled)                                │
        └──────────────┬───────────────────────-─┘
                        │  produces
                        v
        ┌──────────────────────────────┐
        │   FINDINGS  (severity: Low/Medium/  │
        │   High, type: SSN found, credentials │
        │   found, etc.)                          │
        └──────┬───────────────────┬───────-───┘
               │                   │
               v                   v
    ┌──────────────────┐   ┌─────────────────────┐
    │  EventBridge        │   │  Security/Governance   │
    │  rule matches         │   │  team dashboard          │
    │  finding pattern       │   │  (manual review)           │
    └────────┬─────────┘   └─────────────────────┘
             │
             v
    ┌──────────────────────────┐
    │  Lambda — automated          │
    │  remediation:                   │
    │  - quarantine the object          │
    │  - tighten bucket policy            │
    │  - notify security on-call           │
    │  - inform a Lake Formation             │
    │    grant/data-filter restriction         │
    └──────────────────────────┘
```

Reading the diagram: Macie continuously (and at no extra cost)
monitors S3 **bucket posture** — public access, encryption — while a
separately configured, **scoped** sensitive data discovery job
actually inspects object **content** against managed and custom data
identifiers. Every match produces a **finding** with a severity level,
published both to the console (for manual review) and to **EventBridge**
— the mechanism that turns a passive discovery report into an **active,
automated response**: a Lambda function that quarantines the flagged
object, tightens the bucket policy, pages the security team, or — the
more durable, governance-oriented outcome — informs a **Lake
Formation** grant or data filter that permanently restricts who can
query the table/column where the sensitive data was found.

---

<a name="scanning"></a>
## 5. How Macie scans S3 — sampling vs. full-bucket

| Scan type | What it covers | When to use |
|---|---|---|
| **Automated sensitive data discovery** | Continuously and automatically samples a **statistical subset** of objects across the account's S3 buckets, at low relative cost, to give an ongoing, broad-coverage sensitivity signal | Default, ongoing, low-cost visibility across an entire S3 estate without deliberately configuring individual jobs |
| **Sensitive data discovery job (full or sampled)** | A deliberately configured job scoped to specific buckets/prefixes, with a configurable **sampling depth** (from a percentage sample up to 100% / full-bucket inspection) | Deep, deliberate inspection of a specific dataset — e.g., a newly onboarded source, or a bucket under active compliance review |

**The trade-off that matters for the exam:** a **full-bucket** scan
(100% of objects) gives the most complete detection but costs the most
(billed per GB actually scanned) and takes the longest; a **sampled**
scan is cheaper and faster but can **miss** sensitive data sitting in
objects outside the sample. The senior-level judgment call, and a
realistic exam framing, is: "we need a low-cost, ongoing signal across
our entire lake" → automated discovery (broad, sampled, low-cost);
"we need a definitive, complete answer for this one specific
compliance-critical bucket before an audit" → a deliberately
configured job scoped to **100% coverage** of that bucket.

<a name="discoveryjobs"></a>
## 6. Sensitive data discovery jobs

A **discovery job** is a user-configured Macie job that scans a
specified scope (one or more buckets, optionally narrowed by prefix or
object tag) and can be run **one-time** or on a **recurring schedule**
(daily, weekly, monthly). Job configuration includes: which **managed**
and **custom** data identifiers to apply, the **sampling depth**, and
which S3 locations are in/out of scope. Results are written as
**findings**, and a job-level summary shows the overall sensitivity
posture of the scanned scope (e.g., "12% of scanned objects contain
detected sensitive data").

**Exam-relevant framing:** "continuously monitor a growing data lake
for newly introduced sensitive data" points to a **recurring, scheduled
discovery job** (or reliance on the always-on automated discovery
signal), not a one-time job that's never re-run — new objects landing
in a bucket after a one-time scan completed are simply never
inspected.

<a name="categories"></a>
## 7. Detection categories — PII, PHI, financial data, credentials

| Category | Examples of what Macie's managed identifiers detect |
|---|---|
| **PII (Personally Identifiable Information)** | Names, addresses, dates of birth, national ID/passport numbers, driver's license numbers, email addresses |
| **PHI (Protected Health Information)** | Medical record numbers, health insurance identifiers, diagnosis-related codes |
| **Financial data** | Credit card numbers, bank account/routing numbers |
| **Credentials** | AWS access keys and secret keys, other embedded credential-like patterns |

Managed data identifiers are **pre-built by AWS** and cover the common,
broadly-applicable patterns above out of the box, with no configuration
required to enable them for a discovery job. They are pattern- and
ML-based, so they can catch a credit card number even without an
explicit label like "credit_card" on the column/field.

<a name="customidentifiers"></a>
## 8. Custom data identifiers

**Custom data identifiers** are **regular-expression-based** patterns
you define yourself, for sensitive data that's **specific to your
organization** and therefore invisible to the managed identifiers —
an internal employee ID format (`EMP-\d{6}`), a proprietary account
number scheme, a partner-specific contract ID format, or an internal
project code that should never appear in a public-facing dataset.
Custom identifiers can be combined with managed identifiers in the
same discovery job, and can include a **keyword proximity** condition
(e.g., only flag the regex match if a keyword like "salary" or
"confidential" appears near it), reducing false positives.

⚠️ **Exam trap:** "Macie doesn't detect our proprietary internal
account number format" is not a Macie limitation to work around with a
different service — it's the specific trigger for configuring a
**custom data identifier**, which is a first-class Macie capability
built exactly for this gap.

<a name="findings"></a>
## 9. Findings and severity

Macie findings fall into two broad categories: **policy findings**
(about bucket-level security posture — e.g., "this bucket is publicly
accessible," "this bucket has no default encryption") and **sensitive
data findings** (about content — "this object contains detected
credit card numbers"). Each finding carries a **severity** (Low,
Medium, High) based on the type and volume of sensitive data detected
or the nature of the policy violation, and is retained and queryable
in the Macie console, with the option to export findings to S3 or feed
them into a SIEM/analytics pipeline for longer-term retention and
correlation.

<a name="eventbridge"></a>
## 10. Integration with EventBridge for automated remediation

Every Macie finding is published as an **EventBridge event**, which is
the mechanism that converts a passive discovery report into an
**active, automated response**. A typical rule matches on finding type
and severity (e.g., "High severity sensitive data finding") and
triggers a **Lambda function** that performs remediation: moving the
flagged object to a quarantine prefix, applying a restrictive bucket
policy or Object Lock, revoking public access, notifying the security/
governance team via SNS, or opening a ticket automatically. This
closed-loop pattern — **detect → event → automated action** — is what
makes Macie operationally useful at scale; without it, findings are
just a report someone has to remember to check manually.

⚠️ **Exam trap:** a scenario describing "we need sensitive data
findings to trigger automatic quarantine of the affected object" is
testing the **Macie → EventBridge → Lambda** pattern specifically —
Macie itself has no native "quarantine" action; the automation is
built on EventBridge and Lambda, not inside Macie.

<a name="lakeformation"></a>
## 11. Integration with Lake Formation for access restriction

Where EventBridge/Lambda handles **immediate, tactical** remediation
(quarantine, alert), the more **durable, governance-level** response to
a Macie finding is updating **Lake Formation** permissions — once
Macie identifies that a specific table or column contains PII/PHI, a
data governance team can add a Lake Formation **column filter** or
**LF-Tag**-based restriction so that column is permanently hidden from
principals who shouldn't see it, closing the loop between **detection**
(Macie) and **enforcement** (Lake Formation). Macie itself has no
mechanism to restrict *query-time* access to a column — that
enforcement capability belongs to Lake Formation (for the lake) or
Redshift RLS/masking (for the warehouse); Macie's role stops at
**finding and reporting** the sensitive data's location.

<a name="pricing"></a>
## 12. Pricing model

Macie's core cost driver is **billed per GB of data scanned** by
sensitive data discovery jobs, with the **first, full evaluation** of
a newly scanned bucket typically the most expensive pass; subsequent
scans of the same bucket can be scoped to **incremental** (only
new/changed objects since the last scan) at substantially lower cost.
The continuous, automated bucket-level security posture monitoring
(public access, encryption checks) and the low-cost automated
sensitive-data sampling signal are priced separately and much more
cheaply than a deliberately configured, deep discovery job. This
billing model is exactly why **scoping** discovery jobs (specific
buckets/prefixes, not "the whole lake") and preferring **incremental**
re-scans is the standard cost-control practice.

---

<a name="whentouse"></a>
## 13. When to use / when NOT to use

**Use Macie when:** you need to discover where PII/PHI/financial data/
credentials live across an S3 estate, for compliance (GDPR, HIPAA,
PCI-DSS) or pre-migration classification; you're onboarding a new,
unfamiliar data source and need to know its sensitivity profile before
deciding on access controls; you want continuous, low-cost visibility
into bucket-level security posture (public access, encryption) across
many buckets; you want sensitive-data findings to trigger automated
remediation via EventBridge.

**Do NOT use Macie when:** you need to **enforce** access restriction
in real time at query time — that's Lake Formation (lake) or Redshift
RLS/masking (warehouse), not Macie, which only discovers and reports;
you need to scan data stores **other than S3** — Macie does not
natively scan RDS, DynamoDB, or Redshift content directly; you need
inline blocking of an individual API call the moment sensitive data is
about to be written — Macie is an asynchronous, batch-style scanning
service, not a real-time inline gatekeeper.

<a name="advlim"></a>
## 14. Advantages and limitations

**Advantages:** no infrastructure to manage; combines ML-based and
pattern-based detection for broad coverage; managed identifiers cover
common PII/PHI/financial/credential patterns out of the box; custom
data identifiers close the gap for organization-specific patterns;
native EventBridge integration enables automated, closed-loop
remediation; continuous bucket-posture monitoring is low-cost and
always-on; organization-wide administration via a Macie
organization-wide administrator account for multi-account estates.

**Limitations:** S3-only — does not natively scan RDS, DynamoDB,
Redshift, or on-premises data; cost scales with GB scanned, so an
unscoped full-bucket scan on a very large, rarely accessed bucket can
be surprisingly expensive; asynchronous scanning, not real-time inline
inspection of individual writes; discovery only — no native
enforcement capability of its own; findings require a separate
mechanism (EventBridge/Lambda, or a human review process) to actually
act on them.

<a name="perfscale"></a>
## 15. Performance, scaling, and high availability

Macie is a fully managed, regional service — discovery jobs run
asynchronously and scale automatically to the configured scope without
any user-managed infrastructure. For multi-account organizations,
Macie supports designating an **organization-wide administrator
account** (via AWS Organizations integration), letting a central
security team manage discovery jobs and view findings across every
member account from one place, rather than configuring Macie
separately per account. There is no cluster or node concept to size or
fail over — availability is inherent to the managed service model.

<a name="security"></a>
## 16. Security

Macie's own **findings are themselves sensitive** (a finding literally
describes where PII lives) — access to Macie findings should be
restricted via IAM to only the security/governance principals who need
it. Macie reads S3 object content to perform detection but does not
persist the sensitive data itself outside of the finding's contextual
snippet; findings and job configurations are encrypted at rest.
Cross-account and organization-wide Macie administration relies on
**AWS Organizations** trust, not a separately managed credential
system. Macie's IAM permissions govern which buckets a given
discovery job is even allowed to read — a job's role needs
`s3:GetObject`/`s3:ListBucket` scoped to the buckets in its
configured scope.

<a name="failures"></a>
## 17. Failure scenarios and common mistakes

- **Running an unscoped, full-bucket discovery job across an entire
  multi-petabyte data lake** — generates an unexpectedly large bill for
  a task that could have been scoped to the buckets that plausibly
  contain sensitive data.
- **Treating a one-time discovery job as sufficient ongoing coverage**
  — new objects added after the job completed are never scanned unless
  the job (or automated discovery) is recurring.
- **Assuming managed data identifiers catch everything sensitive** —
  organization-specific formats (internal IDs, proprietary account
  numbers) require a custom data identifier; relying only on managed
  identifiers leaves a real detection gap.
- **Not wiring findings to any automated or human response** — Macie
  produces a report; without an EventBridge/Lambda action or a
  reviewed dashboard process, findings accumulate unread and unacted
  upon.
- **Picking Macie for a real-time, inline blocking requirement** —
  Macie is asynchronous discovery, not a synchronous gatekeeper for
  individual writes.
- **Expecting Macie to restrict access itself** — it has no native
  enforcement mechanism; the actual restriction has to be implemented
  via Lake Formation, a bucket policy, or another control triggered
  from a Macie finding.

<a name="examtraps"></a>
## 18. Exam traps

⚠️ **Macie discovers and reports; it does not enforce or block
access.** Any option describing Macie "restricting" or "blocking"
access directly, without an intermediate mechanism (Lake Formation,
Lambda-driven bucket policy change), misdescribes how Macie works.

⚠️ **Full-bucket scans are the most complete but most expensive; a
sampled/automated approach is cheaper but can miss data outside the
sample.** A "minimize cost" requirement paired with "must catch
everything" is a real tension the exam may test — full coverage costs
more, and that's an accepted trade-off, not a bug to work around.

⚠️ **Custom data identifiers are the answer for organization-specific
sensitive patterns** — don't pick "Macie can't detect this" as a
disqualifying limitation when a custom identifier solves it directly.

⚠️ **"Automatically quarantine/remediate on a sensitive data finding" =
Macie finding → EventBridge → Lambda**, not a Macie-native action.

⚠️ **Macie is S3-only.** A scenario about scanning RDS, DynamoDB, or
Redshift content directly for PII is not a Macie use case as described
— data would need to land in S3 first (e.g., via export/UNLOAD) for
Macie to scan it.

<a name="interview"></a>
## 19. Interview questions

- *"How would you design an automated response so that the moment
  Macie finds unmasked PII in a newly uploaded file, the file is
  quarantined and the security team is notified — all without a human
  checking the Macie console?"* Strong answer: configure an
  EventBridge rule matching Macie's sensitive-data finding events
  (filtered by severity/type), triggering a Lambda function that moves
  the object to a quarantine prefix, tightens its access, and
  publishes an SNS notification to the security on-call.
- *"Why would Macie miss an internal employee ID pattern even though
  it's clearly sensitive?"* Strong answer: Macie's managed data
  identifiers cover common, broadly-recognizable PII/PHI/financial/
  credential patterns; an organization-specific format requires a
  **custom data identifier** (regex-based) explicitly configured for
  that pattern.
- *"How do you control Macie's cost on a very large data lake?"*
  Strong answer: scope discovery jobs to specific buckets/prefixes
  rather than scanning everything, prefer incremental scans of
  already-scanned buckets, and rely on the low-cost automated
  sampling signal for broad ongoing visibility rather than deep,
  full-bucket jobs on every bucket continuously.
- *"What's the difference between what Macie does and what Lake
  Formation does, and how do they work together?"* Strong answer:
  Macie discovers and reports where sensitive data lives; Lake
  Formation enforces access restriction (column/row/cell) on
  catalog-registered tables. A mature pipeline uses Macie findings to
  inform which Lake Formation grants/filters need tightening — Macie
  finds the problem, Lake Formation fixes the access.

<a name="cheatsheet"></a>
## 20. Cheat sheet

| If the scenario says... | Reach for... |
|---|---|
| find where PII/PHI/financial data lives in S3 | Amazon Macie |
| detect an organization-specific sensitive pattern | Macie custom data identifier |
| automatically quarantine an object on a sensitive-data finding | Macie finding → EventBridge → Lambda |
| permanently restrict access to a flagged column | Macie finding informs a Lake Formation grant/data filter |
| minimize scan cost on a huge data lake | Scope the discovery job; prefer incremental scans |
| continuously monitor bucket public access / encryption posture | Macie automated, always-on posture monitoring (low/no extra cost) |
| centralized Macie management across many accounts | Macie organization-wide administrator account |
| scan RDS/DynamoDB/Redshift content directly | Not Macie — Macie is S3-only |
| Macie "blocks" or "restricts" access directly | Trap — Macie only discovers/reports, it does not enforce |

<a name="mnemonics"></a>
## 21. Memory tricks

**"Macie finds, it doesn't fence."** Discovery, not enforcement — the
single most important fact about this service. **"Managed catches the
common, custom catches the company's own."** The managed-vs-custom
data identifier distinction in one line. **"Finding without
EventBridge is just a report nobody reads."** The reason the
Macie→EventBridge→Lambda pattern exists. **"Full bucket, full bill."**
The cost/coverage trade-off between sampled and full-bucket scans.

---

<a name="practice"></a>
## 22. Practice questions (15)

**Q1.** A security team wants sensitive data findings from Amazon
Macie to automatically trigger quarantine of the affected S3 object,
with no human intervention. What is the correct architecture?

A) Macie has a native "quarantine object" setting that can be enabled directly
B) Macie publishes findings to EventBridge, which triggers a Lambda function that performs the quarantine
C) Macie automatically applies Object Lock to any object it scans
D) AWS Config remediates Macie findings directly with no other service involved

**Answer: B.** Macie itself only discovers and reports; automated
remediation requires the EventBridge → Lambda pattern. (A) and (C) are
fabricated — Macie has no native enforcement/quarantine action. (D)
AWS Config evaluates configuration compliance, not Macie's
content-based sensitive-data findings.

**Q2.** Which of the following would require a Macie **custom data
identifier** rather than relying on managed data identifiers alone?

A) Detecting standard U.S. Social Security Numbers
B) Detecting AWS access keys embedded in a file
C) Detecting an internal, company-specific employee ID format like `EMP-123456`
D) Detecting standard credit card number formats

**Answer: C.** Organization-specific formats aren't covered by AWS's
built-in managed identifiers and require a custom regex-based
identifier. (A), (B), and (D) are all standard patterns already
covered by Macie's managed data identifiers.

**Q3.** A company wants the lowest-cost way to get ongoing, broad
visibility into whether sensitive data exists anywhere across its
entire S3 estate, without configuring individual jobs. What should
they rely on?

A) A recurring full-bucket discovery job on every bucket, scheduled daily
B) Macie's continuous, automated sensitive data discovery (low-cost sampling across the account)
C) A manual quarterly review of every object
D) AWS Config rules checking for PII patterns

**Answer: B.** Automated discovery provides a low-cost, always-on
sampling-based signal across the account without deliberately
configuring and paying for full-bucket jobs. (A) is far more
expensive than necessary for "broad visibility," not "definitive
completeness." (C) doesn't scale and isn't automated. (D) AWS Config
evaluates resource configuration compliance, not object content for
sensitive data patterns.

**Q4.** Which statement accurately describes Macie's relationship to
access enforcement?

A) Macie can directly revoke IAM permissions when it finds sensitive data
B) Macie is a discovery and reporting tool; actual access enforcement requires a separate mechanism such as Lake Formation or an EventBridge-triggered remediation
C) Macie automatically applies row-level security once PII is detected
D) Macie enforces access by modifying the Glue Data Catalog schema

**Answer: B.** This is the core Macie boundary tested throughout this
file — discovery, not enforcement. (A), (C), and (D) all incorrectly
attribute native enforcement capability to Macie.

**Q5.** A data governance team wants a Macie finding about PII in a
specific column to result in a permanent, query-time restriction on
who can see that column going forward. What should they configure in
response?

A) A Macie automated remediation rule that hides the column
B) A Lake Formation column filter/grant restricting that column, informed by the Macie finding
C) An S3 lifecycle rule to delete the column
D) A CloudTrail data event filter

**Answer: B.** Query-time, durable column-level restriction is Lake
Formation's job; Macie's role ends at detection and reporting. (A) is
fabricated — Macie has no native column-hiding action. (C) a lifecycle
rule manages object transitions/expiration, not column-level query
restriction, and S3 has no "column" concept at all. (D) CloudTrail
data events log API activity; they don't restrict access.

**Q6.** What is the billing model for Macie sensitive data discovery
jobs?

A) A flat monthly fee regardless of data volume
B) Billed per GB of data actually scanned
C) Free for the first 12 months, then a flat annual license fee
D) Billed per number of S3 buckets in the account, regardless of size

**Answer: B.** Macie's core cost driver is GB scanned by discovery
jobs, which is exactly why scoping jobs and using incremental scans
matters for cost control. (A), (C), and (D) all misstate the actual
usage-based pricing model.

**Q7.** Which data stores does Amazon Macie natively scan for
sensitive data content?

A) S3, RDS, and DynamoDB equally
B) Only Amazon S3
C) Only Amazon Redshift
D) Any AWS data store, including on-premises databases via Direct Connect

**Answer: B.** Macie is S3-focused; it does not natively scan RDS,
DynamoDB, Redshift, or on-premises stores directly. (A), (C), and (D)
all incorrectly extend Macie's scope beyond S3.

**Q8.** A company runs a one-time Macie discovery job on a bucket six
months ago and considers the bucket "covered" for compliance purposes
going forward. What is the flaw in this assumption?

A) Macie discovery jobs expire after 30 days and results become invalid
B) Objects added to the bucket after the one-time job ran have never been scanned
C) Macie only scans encrypted objects, so unencrypted new objects were never covered anyway
D) A one-time job scans only 1% of the bucket by design, regardless of configuration

**Answer: B.** A one-time job is a point-in-time snapshot of what
existed then; new objects added afterward require a recurring job or
reliance on automated discovery to be covered. (A) is fabricated —
findings don't expire this way. (C) is false — Macie scans regardless
of encryption status. (D) a one-time job's scan depth is configurable,
not fixed at 1%.

**Q9.** Which of the following is a **policy finding** (bucket-level
posture) rather than a **sensitive data finding** (content-based) in
Macie?

A) "Object contains a detected credit card number"
B) "Bucket is publicly accessible"
C) "Object contains a detected Social Security Number"
D) "Object matches a custom data identifier for internal employee IDs"

**Answer: B.** Bucket public accessibility is a posture/policy-level
finding about bucket configuration, not object content. (A), (C), and
(D) are all content-based sensitive data findings resulting from
scanning object contents.

**Q10.** A financial services company needs to know, before migrating
a legacy dataset into their data lake, which files contain unmasked
credit card numbers, so they can plan remediation before the migration
completes. What is the appropriate first step?

A) Migrate the data first, then run Macie afterward
B) Run a Macie sensitive data discovery job scoped to the legacy dataset's S3 location before migration
C) Enable Redshift dynamic data masking on the destination table
D) Configure a Lake Formation column filter before any data exists to filter

**Answer: B.** Discovery should happen before migration/remediation
planning — scanning the source data with Macie identifies exactly
which files need attention. (A) reverses the useful order — you'd
rather know before completing the migration. (C) masking is a
downstream control that doesn't help identify where the problem is
pre-migration. (D) a Lake Formation filter requires knowing which
column to restrict, which is what the Macie scan is meant to
determine first.

**Q11.** In a multi-account AWS Organization, what feature lets a
central security team manage Macie discovery jobs and view findings
across all member accounts from one place?

A) A Macie organization-wide administrator account
B) IAM Identity Center exclusively
C) A shared S3 bucket containing all Macie configuration
D) AWS Config aggregator

**Answer: A.** Macie supports designating an organization-wide
administrator account via AWS Organizations integration, centralizing
job management and findings visibility. (B) IAM Identity Center
manages human access/SSO, not Macie job administration specifically.
(C) is not how Macie's cross-account administration works. (D) a
Config aggregator centralizes AWS Config compliance data, not Macie
findings.

**Q12.** Which of the following best describes the trade-off between a
sampled Macie discovery job and a full-bucket (100%) discovery job?

A) Sampled scans are always more accurate than full scans
B) Full-bucket scans give the most complete detection but cost more and take longer; sampled scans are cheaper/faster but can miss data outside the sample
C) There is no cost or time difference between sampled and full scans
D) Full-bucket scans are free, while sampled scans incur additional charges

**Answer: B.** This coverage-vs-cost trade-off is central to
configuring Macie discovery jobs appropriately for the scenario's
requirements. (A) is backwards — full scans provide more complete
coverage, not sampled ones. (C) and (D) both misstate the actual
cost/time relationship, which scales with GB scanned.

**Q13.** Which statement about who should have access to Macie
findings is accurate?

A) Findings should be broadly visible to all IAM principals for transparency
B) Findings themselves are sensitive (they describe where PII/PHI lives) and access should be restricted via IAM to only security/governance principals
C) Macie findings cannot be restricted via IAM under any configuration
D) Findings are automatically public within the AWS account by default with no IAM control

**Answer: B.** Because a finding effectively points to where sensitive
data lives, findings access itself needs to be tightly scoped. (A) and
(D) both describe an inappropriate, overly broad exposure of sensitive
metadata. (C) is false — IAM governs access to Macie findings like any
other AWS resource.

**Q14.** A healthcare company wants Macie to detect protected health
information such as medical record numbers in its claims-intake S3
bucket. Which Macie capability is most directly responsible for this
detection?

A) Bucket-level public access monitoring
B) Managed data identifiers covering PHI patterns
C) S3 Object Lock
D) VPC endpoint policies

**Answer: B.** Macie's managed data identifiers include PHI-related
patterns (medical record numbers, health insurance identifiers) out of
the box. (A) posture monitoring is unrelated to content detection. (C)
Object Lock is a retention/WORM feature, unrelated to detection. (D)
VPC endpoint policies control network reachability, not content
scanning.

**Q15.** Which requirement, if present in a scenario, most strongly
disqualifies Amazon Macie as the sole solution?

A) "Identify all S3 objects containing unmasked SSNs across our data lake"
B) "Automatically block, in real time, any individual write to a database that contains a credit card number, before the write completes"
C) "Classify newly onboarded S3 data by sensitivity before granting analyst access"
D) "Detect an internal employee ID format not covered by standard PII patterns"

**Answer: B.** Real-time, inline, pre-write blocking is outside
Macie's model — Macie is an asynchronous, batch-style S3 content
scanner, not a synchronous inline gatekeeper for individual database
writes (and it doesn't scan databases directly at all). (A), (C), and
(D) are all standard, well-fit Macie use cases (discovery, sensitivity
classification, and custom identifiers respectively).
