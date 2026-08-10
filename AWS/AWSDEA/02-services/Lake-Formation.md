# AWS Lake Formation

> The **data-aware permission layer** that sits on top of the Glue
> Data Catalog and closes the gap IAM cannot close — column, row, and
> cell-level access control. This file covers LF-Tags (tag-based
> access control / TBAC), data filters, cross-account sharing, hybrid
> access mode, governed tables, and the single most-tested boundary on
> the exam: **Lake Formation vs. pure-IAM**. This file is
> cross-checked for consistency against `01-domains/DOMAIN-4-DATA-
> SECURITY.md`'s Lake Formation coverage (task 4.2.4 and 4.5.2) — the
> facts here should not contradict it.

## CONTENTS

- [1. Explain like I'm 12](#eli12)
- [2. Explain technically](#technical)
- [3. Explain like a Senior AWS Data Engineer](#senior)
- [4. Production architecture](#architecture)
- [5. The Lake Formation vs. pure-IAM permission model](#lfvsiam)
- [6. LF-Tags — tag-based access control (TBAC)](#lftags)
- [7. Data filters — row, column, and cell-level security](#datafilters)
- [8. Cross-account sharing](#crossaccount)
- [9. Hybrid access mode](#hybrid)
- [10. Governed tables](#governedtables)
- [11. Integration with Glue Catalog, Athena, Redshift, EMR](#integration)
- [12. When to use / when NOT to use](#whentouse)
- [13. Advantages and limitations](#advlim)
- [14. Pricing](#pricing)
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

Imagine the school library again, but this time it's one giant shared
bookshelf that every class uses. The librarian's ID-badge system
(IAM) can only say "you're allowed in the library or you're not" — it
has no idea that page 47 of one particular book has a student's home
address on it that only the school nurse should see. **Lake
Formation** is a second, smarter rule-book layered on top: it can say
"everyone can read this book, but only the nurse can see page 47," or
"the 5th-grade teacher can only see the rows about 5th graders." IAM
opens the library door; Lake Formation decides what you can actually
read once you're standing at the shelf.

<a name="technical"></a>
## 2. Explain technically

AWS Lake Formation is a managed service that layers **fine-grained,
data-aware authorization** — down to the database, table, column, row,
and cell level — on top of resources registered in the **AWS Glue Data
Catalog**. It does not replace IAM; it **adds a second, independent
permission check** specifically for catalog-registered data. When a
query engine (Athena, Redshift Spectrum, EMR with Lake Formation
integration, or a Glue job reading via the Catalog) accesses a table
governed by Lake Formation, the requesting principal must satisfy
**both** the standard IAM check (can this role call the underlying
service APIs at all) **and** the Lake Formation grant (does this
principal have a Lake Formation permission — `SELECT`, `DESCRIBE`,
etc. — on this specific database/table/column/row). Lake Formation
grants are managed centrally and can be expressed either as **named
resource grants** (grant on a specific table/database) or, at scale,
via **LF-Tags** (tag-based access control), avoiding grant-by-grant
sprawl across thousands of tables.

<a name="senior"></a>
## 3. Explain like a Senior AWS Data Engineer

A senior engineer's mental model is that Lake Formation is not "more
security," it's a **different kind of security** than IAM provides —
IAM answers "what API actions can this principal call," Lake Formation
answers "what data can this principal actually see, at the
column/row/cell level," and confusing the two is the single most
common failure mode on both real security reviews and this exam. The
first senior instinct: the moment a requirement uses the words
**"except column X"**, **"only rows where region = Y"**, or **"mask
this field for everyone except team Z,"** Lake Formation (or, if the
data lives in a warehouse rather than the lake, Redshift native
RLS/dynamic masking) is the only correct mechanism — IAM cannot
express any of these, full stop, because IAM has no concept of a
column. The second senior instinct: at scale (hundreds or thousands of
tables, dozens of teams), grant management should move from
**named-resource grants** (which don't scale — you'd be writing a
grant per table per principal) to **LF-Tags**, tagging both principals
and resources and letting access follow the tag automatically as new
tables are created. The third: know the **migration risk** — an
existing pipeline built entirely on IAM/S3 permissions can be
**locked out** if Lake Formation is turned on for those resources
without first using **hybrid access mode**, which is precisely why
hybrid mode exists as a deliberate, gradual on-ramp rather than a flag
you flip in production without a plan.

<a name="architecture"></a>
## 4. Production architecture

```
   ┌─────────────────────────────────────────────────────────┐
   │                 AWS Glue Data Catalog                      │
   │  Databases / Tables (schema, location, format metadata)    │
   └───────────────────────┬───────────────────────────────-─┘
                            │  Lake Formation governs permissions
                            │  on catalog-registered resources
                            v
   ┌─────────────────────────────────────────────────────────┐
   │                   AWS LAKE FORMATION                         │
   │                                                                 │
   │  LF-Tags (TBAC): Department=Finance, Sensitivity=PII            │
   │  Named grants: SELECT on db.table to role X                     │
   │  Data filters: row filter (region='us-east'), column filter      │
   │                 (exclude ssn), cell-level (combine both)          │
   │  Cross-account grants: via AWS RAM, to another account's          │
   │                 principal                                          │
   └───────┬────────────┬────────────┬────────────┬─────────-─┘
           │             │             │             │
           v             v             v             v
      ┌────────┐    ┌─────────┐   ┌────────┐   ┌────────┐
      │ Athena  │    │ Redshift │   │  EMR    │   │  Glue   │
      │ (LF-    │    │ Spectrum │   │ (LF-    │   │ jobs    │
      │ enforced│    │ (external│   │ enabled)│   │ (Catalog │
      │ at query│    │ tables,  │   │         │   │ reads    │
      │ time)    │    │ LF-aware)│   │         │   │ honor LF)│
      └────────┘    └─────────┘   └────────┘   └────────┘
           │             │             │             │
           └─────────────┴─────────────┴─────────────┘
                            │
                            v
              S3 — underlying data location
       (still has its own bucket policy / IAM permissions —
        LF grants are an ADDITIONAL gate, not a replacement)
```

Reading the diagram: Lake Formation governs permissions on resources
registered in the **Glue Data Catalog**, expressing them as **LF-Tags**
(scalable, tag-based grants), **named grants** (direct, per-resource),
and **data filters** (row/column/cell-level restriction). Four
consuming engines — **Athena**, **Redshift Spectrum**, **EMR** (with LF
integration enabled), and **Glue** jobs reading through the Catalog —
all enforce these grants at query/read time, meaning the same
governance rules apply consistently no matter which engine a user
queries through. Underneath everything, the actual bytes still live in
**S3**, which retains its **own separate IAM/bucket-policy
permissions** — Lake Formation grants are **additive**, not a
replacement for the underlying storage permissions, which is why a
principal can technically have both an IAM allow and a missing Lake
Formation grant (or vice versa) and be denied either way.

---

<a name="lfvsiam"></a>
## 5. The Lake Formation vs. pure-IAM permission model

**This is the favorite exam trap in this file — treat it as load-bearing.**

| | **Pure IAM** | **Lake Formation** |
|---|---|---|
| Grants access to | API actions on AWS resources (`s3:GetObject`, `glue:GetTable`) | Specific **data** within a catalog-registered table — down to column/row/cell |
| Finest granularity | Bucket / prefix / object (S3); whole table (Glue API) | **Column, row, and cell** |
| Awareness of data content | **None** — cannot see inside a Parquet file or know what a column represents | **Full** — understands schema, can filter by column name or row predicate |
| Who enforces it | The AWS service itself (S3, Glue) at the API call | The **query engine** (Athena, Redshift Spectrum, EMR, Glue), which asks Lake Formation for a permission decision |
| Governs cross-account sharing at what granularity | Whole bucket/object (bucket policy) | **Down to table/column**, via AWS RAM under the hood |
| Scales to thousands of tables how | Per-resource IAM policies — sprawls badly | **LF-Tags** — tag once, grants follow automatically |
| Required alongside the other? | **Yes — always.** Lake Formation adds a second check on top of, not instead of, IAM | **Yes — always.** A Lake Formation grant does not bypass the need for underlying IAM/S3 permissions in a non-hybrid setup |

**The exact rule to memorize:** a principal needs **both** an IAM
allow (to call the query engine's APIs and, depending on mode, to
reach the underlying S3 data) **and** a Lake Formation grant (to see
the specific database/table/column/row) to successfully read
governed data. Neither permission system substitutes for the other.
**"IAM allows full bucket access, but the analyst still can't see
column X"** is the textbook symptom of a **missing Lake Formation
grant** — because IAM genuinely has no mechanism to restrict a single
column in the first place, so "IAM already allows it" is never the
explanation for a column being visible; only a Lake Formation grant
(or its absence) explains column-level visibility.

⚠️ **Exam trap:** Redshift's **native** GRANT system (schema/table/
column grants inside the warehouse itself) is a **different
mechanism** from Lake Formation. A question about "who can query which
**native Redshift table**" is answered by Redshift's own GRANT system;
a question about "who can query which **S3-based external table**"
(Spectrum) is answered by Lake Formation.

<a name="lftags"></a>
## 6. LF-Tags — tag-based access control (TBAC)

LF-Tags are **key-value pairs** (e.g., `Department=Finance`,
`Sensitivity=PII`, `Region=EU`) that can be attached to **catalog
resources** (databases, tables, columns) and to **principals**
(IAM users/roles). A Lake Formation **TBAC grant** says, in effect,
"any principal tagged `Department=Finance` may `SELECT` on any
resource tagged `Department=Finance`" — access is computed
**automatically** from tag matching rather than requiring an explicit
grant statement per table.

```
   Principal: AnalystRole    tagged  Department=Finance
   Table:     q3_forecast     tagged  Department=Finance, Sensitivity=Internal
   Table:     payroll          tagged  Department=Finance, Sensitivity=PII

   TBAC grant: "Department=Finance" principals get SELECT on
               "Department=Finance" resources
        --> AnalystRole can query BOTH q3_forecast AND payroll,
            unless a SEPARATE, more restrictive grant/filter
            narrows Sensitivity=PII access specifically
```

**Why this scales where named grants don't:** with 5,000 tables and 50
teams, named-resource grants would require up to 250,000 individual
grant statements, and every new table would need its own grant added
by hand. With LF-Tags, a new table is simply **tagged** at creation
(`Department=Finance`), and every already-tagged principal
automatically inherits the correct access — **no new grant statement
is written**. This is the exam's textbook trigger for **"manage access
across a large, growing number of tables without editing thousands of
individual grants."**

⚠️ **Exam trap:** LF-Tags implement **ABAC** (attribute-based access
control), not RBAC — don't confuse a scenario calling for tag-based,
automatically-inherited access with a scenario calling for a fixed,
enumerated **role** (RBAC), which is what named-resource grants or
IAM roles alone provide.

<a name="datafilters"></a>
## 7. Data filters — row, column, and cell-level security

| Filter type | What it restricts | Example |
|---|---|---|
| **Column filter** | Which columns a principal can see (include-list or exclude-list) | Analyst sees all columns except `ssn` and `salary` |
| **Row filter** | Which rows a principal can see, via a filter expression | Regional manager sees only rows where `region = 'us-east'` |
| **Cell-level (combined)** | Both a column filter and a row filter applied together via the same data filter object | Regional manager sees all columns except `ssn`, and only for rows in their own region |

Data filters are attached to a **grant** on a table (as part of a
named grant or an LF-Tag-based grant), and are the concrete mechanism
that makes "except this column" or "only these rows" answers
possible — this is the single feature IAM has no equivalent for at
all, at any level. Multiple data filters can be layered for different
principals on the **same underlying table**, with **no data
duplication** — the same Parquet files in S3 serve different
"views" of themselves depending on who's querying, resolved at query
time by the engine honoring the Lake Formation grant.

**Enterprise example (consistent with Domain 4 coverage):** a retail
company gives regional managers row-level access to only their own
region's sales table, and masks the customer-loyalty-ID column for
everyone except the loyalty team — all via one set of LF-Tags and data
filters applied to a **single shared table**, with zero data
duplication or per-region table copies.

<a name="crossaccount"></a>
## 8. Cross-account sharing

Lake Formation supports **native cross-account data sharing** at the
database/table/column level, implemented under the hood via **AWS
Resource Access Manager (RAM)**. A producer account grants Lake
Formation permissions to a specific principal (or entire account) in a
consumer account; the consumer account then accepts the resource share
and can query the shared tables through Athena, Redshift Spectrum, or
EMR **without the data ever being copied** — the same zero-copy
philosophy as Redshift data sharing, but at the S3/Catalog layer
instead of the warehouse layer.

```
   Producer Account                     Consumer Account
   +------------------+                 +-------------------+
   | Glue Catalog table |  LF grant -->  | Principal receives   |
   | (finance.reports)   |  via AWS RAM   | RAM resource share    |
   +------------------+                 | Accepts share, queries  |
                                          | via Athena/Spectrum/EMR  |
                                          +-------------------+
```

**When to choose this over a plain S3 bucket policy:** the moment
fine-grained (column/row) filtering, or table-level (not whole-bucket)
granularity, or centralized governance across many consumer accounts
is required — a bucket policy is the coarsest, least governable
option and can't express column/row restriction at all.

<a name="hybrid"></a>
## 9. Hybrid access mode

**Hybrid access mode** lets a table be governed by **both** Lake
Formation permissions **and** the pre-existing IAM/S3 permissions
**simultaneously**, during a migration period — principals with only
IAM permissions (not yet migrated to Lake Formation grants) can
continue to work exactly as before, while new or migrated principals
can be governed by Lake Formation grants on the same table. This is
the deliberate, gradual on-ramp for adopting Lake Formation on an
**already-in-production** IAM/S3-permissioned data lake without a
disruptive cutover.

⚠️ **Exam trap:** enabling Lake Formation governance on a table that
existing production pipelines already access via pure IAM/S3
permissions, **without** first using hybrid access mode, can
**lock out** those pipelines the moment Lake Formation permissions
become the sole enforcement mechanism and no Lake Formation grant yet
exists for those principals. **Hybrid access mode is the specific,
correct answer** for "migrate an existing IAM-permissioned data lake
to Lake Formation governance without breaking currently working
pipelines."

<a name="governedtables"></a>
## 10. Governed tables

A **Lake Formation governed table** is a table type that adds
**ACID transaction support** (atomic, consistent, isolated, durable
reads/writes) directly to data stored in S3 and registered in the
Catalog — supporting concurrent readers and writers without the
manual coordination a plain Parquet-on-S3 table requires, along with
row-level governance features layered on top. In practice, for
**new** transactional lakehouse tables, **Apache Iceberg** (via S3
Tables or self-managed Iceberg-on-S3) has become the more commonly
tested and more broadly engine-compatible modern answer for
ACID/transactional lakehouse tables on this exam — governed tables
remain a valid Lake Formation-native concept to recognize, but should
not be confused with, or automatically preferred over, Iceberg when a
scenario emphasizes broad multi-engine ACID table support.

<a name="integration"></a>
## 11. Integration with Glue Catalog, Athena, Redshift, EMR

| Engine | How it honors Lake Formation |
|---|---|
| **Glue Data Catalog** | The resource Lake Formation actually governs — every LF permission is expressed against a catalog database/table/column |
| **Athena** | Enforces LF grants (including column/row filters) at query planning and execution time for any table registered in the Catalog |
| **Redshift Spectrum** | External tables (pointing at S3, registered in the Catalog) honor LF grants the same way Athena does |
| **EMR** | Requires **Lake Formation integration to be explicitly enabled** on the EMR cluster/notebook for Spark/Hive jobs to honor LF grants — not automatic by default the way Athena's is |
| **Glue ETL jobs** | Jobs reading tables via the Catalog (rather than a raw S3 path) respect LF grants for the job's role |

⚠️ **Exam trap:** don't assume **EMR automatically enforces Lake
Formation permissions** the moment a table is LF-governed — EMR
requires its Lake Formation integration to be turned on explicitly;
a scenario describing "EMR bypassed the intended column restriction"
is often pointing at this exact gap.

---

<a name="whentouse"></a>
## 12. When to use / when NOT to use

**Use Lake Formation when:** multiple teams/analysts need different,
fine-grained visibility (column, row, or cell) into the same
catalog-registered tables; you need centralized governance across
many tables without per-resource grant sprawl (LF-Tags); you need
native, governable cross-account data lake sharing at table/column
granularity; PII or other sensitive columns must be hidden or masked
from specific principals while remaining visible to others on the
same table.

**Do NOT use Lake Formation when:** the data isn't registered in the
Glue Data Catalog (Lake Formation only governs catalog-registered
resources); a simple, single-team, single-bucket scenario where a
plain IAM/bucket policy is sufficient and the added administrative
layer isn't justified; the requirement is really about **native
Redshift table** access (that's Redshift's own GRANT system, not
Lake Formation) or DynamoDB item-level access (that's IAM condition
keys, not Lake Formation).

<a name="advlim"></a>
## 13. Advantages and limitations

**Advantages:** column/row/cell-level filtering that IAM cannot
express at all; LF-Tags scale governance to thousands of tables
without per-table grant sprawl; native, table/column-granular
cross-account sharing via AWS RAM; consistent enforcement across
Athena, Redshift Spectrum, EMR, and Glue; centralizes data lake
governance instead of scattering it across many bucket policies.

**Limitations:** only governs catalog-registered resources — data not
in the Glue Data Catalog is outside its scope; adds a genuine second
layer of administration and design complexity (principals and
resources both need a coherent tagging strategy for TBAC to scale
well); migrating an existing pure-IAM lake requires careful planning
(hybrid access mode) to avoid lockout; EMR requires explicit
integration, it isn't automatic like Athena.

<a name="pricing"></a>
## 14. Pricing

There is **no separate Lake Formation service charge** for permission
management itself — you pay only for the underlying compute used to
query the data (Athena's per-TB-scanned pricing, Redshift's node-hour
or RPU-second billing, EMR's cluster cost, Glue's DPU-hour billing),
exactly as you would without Lake Formation governance layered on top.

<a name="perfscale"></a>
## 15. Performance, scaling, and high availability

Lake Formation is a fully managed, regional service with **no cluster
or infrastructure to provision**. Permission evaluation happens at
**query planning time**, adding negligible latency to the overall
query — the enforcement cost is dominated by the query engine's own
execution time, not by the Lake Formation permission check itself.
LF-Tags are specifically the mechanism that lets Lake Formation's
**administrative** scaling — thousands of tables, dozens of teams —
stay manageable without a proportional increase in the number of
individual grant statements an administrator must maintain.

<a name="security"></a>
## 16. Security

Every Lake Formation grant is **principal + resource + permission
level** (e.g., `SELECT`, `DESCRIBE`, `ALTER`) and is fully auditable.
Grants and grant changes can be tracked via **CloudTrail** for who
granted/revoked what and when. Lake Formation does **not** replace the
underlying S3 encryption (SSE-S3/SSE-KMS) or bucket policy — those
remain independently in force; Lake Formation is an **additional**
data-aware gate layered on top, not a substitute for infrastructure-
level security controls. Data filters (masking/row restriction) are
enforced by the query engine at query time — the underlying stored
bytes are unchanged; a principal with direct S3 access (bypassing the
query engine and Lake Formation entirely) would not be subject to
these restrictions, which is why underlying S3/IAM permissions must
also be correctly scoped, not left wide open on the assumption that
"Lake Formation will handle it."

<a name="failures"></a>
## 17. Failure scenarios and common mistakes

- **Enabling Lake Formation governance on a live IAM-permissioned
  table without hybrid access mode** — existing pipelines lose access
  because no Lake Formation grant yet exists for their principal.
- **Assuming IAM's broad bucket access implies column visibility** —
  IAM cannot express column-level restriction at all; the actual
  gatekeeper for a specific column is always the Lake Formation grant
  (or data filter), never the IAM policy.
- **Forgetting EMR needs explicit Lake Formation integration enabled**
  — a cluster can silently bypass intended column/row restrictions if
  the integration wasn't turned on.
- **Leaving underlying S3 permissions wide open**, assuming Lake
  Formation's query-time enforcement alone protects the data — a
  principal with direct S3 access bypasses Lake Formation entirely.
- **Using named-resource grants at large scale** instead of LF-Tags,
  producing unmanageable grant sprawl as the table count grows into
  the thousands.
- **Confusing Lake Formation with Redshift's native GRANT system** —
  they govern different layers (external/lake tables vs. native
  warehouse tables) and are not interchangeable.

<a name="examtraps"></a>
## 18. Exam traps

⚠️ **"IAM already allows full bucket access, why can't the analyst see
column X" = the missing piece is always a Lake Formation grant/data
filter** — IAM structurally cannot express column-level restriction.

⚠️ **Migrating an existing IAM-permissioned lake to Lake Formation
without breaking working pipelines = hybrid access mode.** This is the
specific named feature for exactly this scenario.

⚠️ **Managing access across thousands of tables without per-table
grants = LF-Tags (TBAC)**, not named-resource grants.

⚠️ **"Who can query this native Redshift table" is Redshift's own
GRANT system; "who can query this S3-based external table" (Spectrum)
is Lake Formation.** Do not swap these two.

⚠️ **EMR requires explicit Lake Formation integration** — it is not
automatically enforced the way Athena's is by default.

⚠️ **Lake Formation grants are additive to, not a replacement for,**
underlying S3/IAM permissions outside of hybrid mode — leaving S3 wide
open defeats the purpose even with perfect LF grants configured.

<a name="interview"></a>
## 19. Interview questions

- *"Why can't a bucket policy restrict access to a single column of a
  Parquet file?"* Strong answer: S3 has no concept of a column; it
  serves whole objects. Column awareness requires a query engine
  (Athena, Redshift Spectrum) plus a data-aware governance layer (Lake
  Formation) sitting between the engine and the Catalog.
- *"How would you design access so 50 teams, each owning different
  tables, get correct access automatically as new tables are created,
  without a central team manually granting each one?"* Strong answer:
  LF-Tags — tag principals and resources by team/department, define
  TBAC grants once per tag combination, and let new tables inherit
  correct access automatically by being tagged at creation.
- *"How do you migrate an existing production data lake, currently
  secured with IAM and bucket policies, to Lake Formation governance
  without breaking anything?"* Strong answer: hybrid access mode —
  govern the table with both IAM and Lake Formation simultaneously
  during migration, moving principals over to Lake Formation grants
  incrementally rather than cutting over all at once.
- *"A team shares curated tables with a partner account. What's the
  Lake Formation mechanism, and how is it different from a bucket
  policy?"* Strong answer: Lake Formation cross-account grants (via
  AWS RAM) at table/column granularity, versus a bucket policy's
  coarse whole-bucket/object granularity with no column/row
  filtering capability.

<a name="cheatsheet"></a>
## 20. Cheat sheet

| If the scenario says... | Reach for... |
|---|---|
| "except this column" / mask a specific column | Lake Formation column filter |
| "only rows where region = X" | Lake Formation row filter |
| both column and row restriction together | Lake Formation cell-level data filter |
| manage access across thousands of tables, no grant sprawl | LF-Tags (TBAC) |
| IAM allows the bucket, but a column must stay hidden | Missing Lake Formation grant — the answer, always |
| migrate existing IAM-permissioned lake without breaking pipelines | Hybrid access mode |
| share tables with a partner account, table/column level | Lake Formation cross-account grant (via AWS RAM) |
| who can query a native Redshift table | Redshift's own GRANT system, not Lake Formation |
| who can query an S3-based external table (Spectrum) | Lake Formation |
| EMR not respecting expected column restriction | Enable EMR's Lake Formation integration explicitly |
| ACID transactions on a lake table, broad engine support | Apache Iceberg (S3 Tables) — more commonly the current answer than governed tables |

<a name="mnemonics"></a>
## 21. Memory tricks

**"IAM opens the door, Lake Formation decides what's on the shelf."**
The one-line boundary between the two systems. **"Tag once, grant
forever"** — LF-Tags eliminate per-table grant sprawl. **"Hybrid before
you flip the switch"** — the migration safety rule for moving an
existing IAM-permissioned lake onto Lake Formation governance.
**"Both gates, always"** — IAM and Lake Formation are additive; neither
alone is sufficient for governed data.

---

<a name="practice"></a>
## 22. Practice questions (15)

**Q1.** An analyst's IAM role grants full `s3:GetObject` access to a
bucket, but the analyst still cannot see the `salary` column when
querying a table over that bucket in Athena. What is the most likely
explanation?

A) The IAM policy needs `s3:GetObject` explicitly listed for that column
B) A Lake Formation column-level data filter is restricting visibility of that column, independent of the IAM policy
C) Athena does not support column-level queries
D) The S3 bucket policy is denying the request

**Answer: B.** IAM structurally cannot express column-level
restriction — the actual gatekeeper for column visibility is a Lake
Formation grant/data filter. (A) is nonsensical — IAM has no
column-level construct to grant. (C) is false — Athena supports
column selection normally. (D) a bucket policy could deny at the
object level but wouldn't selectively hide one column while allowing
others — that specific behavior is a Lake Formation data filter.

**Q2.** A company wants to give access to catalog tables automatically
to any newly created table, based on a `Department` tag, without
writing a new grant statement for every table. Which Lake Formation
feature enables this?

A) Named-resource grants
B) LF-Tags (tag-based access control)
C) Hybrid access mode
D) Governed tables

**Answer: B.** LF-Tags implement TBAC — access follows the tag
automatically as new tagged resources appear, with no per-table grant
needed. (A) named grants require an explicit statement per resource,
the opposite of what's wanted. (C) hybrid access mode addresses
IAM/Lake Formation coexistence during migration, not tag-based
scaling. (D) governed tables add ACID transaction support, unrelated
to this scaling requirement.

**Q3.** A company is migrating an existing, actively-used data lake
from pure IAM/S3 permissions to Lake Formation governance. What should
they use to avoid breaking currently working pipelines during the
transition?

A) Enable Lake Formation governance immediately for all tables
B) Hybrid access mode
C) Delete all existing IAM policies first
D) Disable Lake Formation until every pipeline is manually rewritten

**Answer: B.** Hybrid access mode lets a table be governed by both IAM
and Lake Formation simultaneously, allowing a gradual, non-disruptive
migration. (A) risks locking out pipelines with no Lake Formation
grant yet. (C) removes access outright before any replacement grant
exists. (D) is overly conservative and doesn't describe an actual
Lake Formation feature or migration path.

**Q4.** Which statement correctly describes the relationship between
IAM and Lake Formation for a catalog-registered, Lake Formation-
governed table?

A) Lake Formation replaces the need for any IAM permissions
B) A principal needs both an IAM allow and a Lake Formation grant — neither substitutes for the other
C) IAM is only relevant for EMR, not Athena or Redshift Spectrum
D) Lake Formation grants automatically override any conflicting IAM deny

**Answer: B.** Both systems must independently allow the access;
Lake Formation adds a second, data-aware gate on top of, not instead
of, IAM. (A) is false — this file and Domain 4 both emphasize Lake
Formation is additive. (C) is false — IAM is relevant across all
consuming engines. (D) is false — an explicit IAM deny is never
overridden by anything, including a Lake Formation allow.

**Q5.** A regional retail company wants regional managers to see only
their own region's rows in a shared `sales` table, and wants the
`customer_loyalty_id` column hidden from everyone except the loyalty
team — using one shared table, no data duplication. What Lake
Formation feature combination achieves this?

A) Separate tables per region, secured with IAM
B) A cell-level data filter (combined row + column filter) applied via LF-Tag-based or named grants
C) S3 Object Lock on the shared table's prefix
D) DynamoDB Streams to fan out region-specific copies

**Answer: B.** A cell-level data filter combines row restriction
(region) and column restriction (loyalty ID) on the same shared table
without duplicating data. (A) creates unnecessary data duplication and
maintenance overhead. (C) Object Lock is a retention/WORM feature,
unrelated to access filtering. (D) DynamoDB Streams is unrelated to
S3/Catalog-based lake governance.

**Q6.** Which statement about EMR's enforcement of Lake Formation
permissions is accurate?

A) EMR automatically enforces Lake Formation grants with no configuration
B) EMR requires Lake Formation integration to be explicitly enabled for Spark/Hive jobs to honor LF grants
C) EMR cannot ever be integrated with Lake Formation
D) EMR enforces Lake Formation grants only for Presto, never for Spark

**Answer: B.** Unlike Athena, EMR requires explicit configuration to
honor Lake Formation permissions — a common exam trap and real-world
gap. (A) is the incorrect assumption the trap targets. (C) is false —
integration is supported, just not automatic. (D) misstates the
actual constraint, which is about integration being enabled, not
engine type within EMR.

**Q7.** A company wants to share ten curated tables with a partner in
a different AWS account, restricting access to specific columns, and
wants the partner to query live data with no copying. What is the
correct mechanism?

A) A plain S3 bucket policy granting the partner account full bucket read access
B) Lake Formation cross-account sharing (via AWS RAM) with column-level grants
C) Copying the ten tables into the partner's account nightly via Glue
D) IAM cross-account role assumption with `s3:GetObject` on the whole bucket

**Answer: B.** Lake Formation's cross-account sharing provides
exactly this — table/column-granular, zero-copy sharing across
accounts. (A) and (D) both grant coarse, whole-bucket access with no
column-level restriction capability. (C) introduces unnecessary data
duplication and staleness, the opposite of "live data, no copying."

**Q8.** Which of the following correctly distinguishes Lake
Formation's governance from Redshift's native GRANT system?

A) They are the same mechanism under a different name
B) Lake Formation governs catalog-registered/external (e.g., Spectrum) tables; Redshift's native GRANT system governs tables stored natively inside the Redshift cluster
C) Redshift's native GRANT system is deprecated in favor of Lake Formation for all Redshift access
D) Lake Formation can only be used with Athena, never with Redshift

**Answer: B.** This is the exact boundary the exam tests — native
Redshift tables use Redshift's own GRANT system; external tables
queried via Spectrum are governed by Lake Formation. (A) conflates two
distinct systems. (C) is false — native Redshift GRANTs remain in
active use for native tables. (D) is false — Lake Formation governs
Redshift Spectrum's external tables directly.

**Q9.** What is the primary purpose of LF-Tags compared to
named-resource grants?

A) LF-Tags provide stronger encryption than named grants
B) LF-Tags let access scale to many resources via tag matching, avoiding a separate grant statement per table
C) LF-Tags are required before any table can be registered in the Glue Data Catalog
D) LF-Tags replace the need for IAM entirely

**Answer: B.** LF-Tags scale governance administratively — tag once,
and matching access follows automatically as new tagged resources
appear. (A) LF-Tags are an access-control mechanism, not an encryption
feature. (C) tagging is not a prerequisite for Catalog registration.
(D) IAM remains required alongside Lake Formation, always.

**Q10.** A data platform team wants ACID transaction support for a new
transactional lakehouse table that must be broadly compatible across
Athena, Redshift, EMR, and Glue, without vendor-specific table-type
lock-in concerns being a priority. What is the more commonly favored
current answer on this exam?

A) A Lake Formation governed table exclusively
B) Apache Iceberg, via an S3 Tables bucket or self-managed Iceberg-on-S3
C) A DynamoDB table with Streams enabled
D) A Redshift materialized view

**Answer: B.** Apache Iceberg (especially via S3 Tables) has become
the more broadly tested, multi-engine-compatible answer for
transactional lakehouse tables. (A) governed tables remain a valid
Lake Formation-native concept but are not the current default
preference the exam favors for this framing. (C) DynamoDB is an OLTP
key-value store, unrelated to lakehouse table formats. (D) a
materialized view pre-computes query results; it isn't a transactional
table format.

**Q11.** Which statement about Lake Formation's effect on the
underlying S3 data is accurate?

A) Lake Formation encrypts the underlying S3 objects automatically
B) A principal with direct S3 access (bypassing the query engine) is not subject to Lake Formation's row/column filters
C) Lake Formation physically splits data into per-principal copies in S3
D) Lake Formation removes the need for S3 bucket policies entirely

**Answer: B.** Data filters are enforced by the query engine at query
time against the catalog/Lake Formation permission check; direct S3
access bypasses that enforcement path entirely, which is why
underlying S3/IAM permissions must still be correctly scoped. (A) Lake
Formation doesn't manage encryption — that remains SSE-S3/SSE-KMS
configuration. (C) no physical data duplication occurs; filtering is
logical, applied at query time. (D) bucket policies remain in force
independently.

**Q12.** Which scenario is the clearest, textbook trigger for using
Lake Formation data filters rather than an IAM policy?

A) Restricting which S3 bucket a role can list
B) Restricting a principal's ability to call the Glue `CreateTable` API
C) Hiding a specific column from a subset of users querying the same table via Athena
D) Restricting which VPC a Redshift cluster can be launched into

**Answer: C.** Column-level restriction on query results is exactly
what a Lake Formation data filter does and what IAM structurally
cannot express. (A), (B), and (D) are all standard IAM-scoped API/
resource-level permissions, not data-content-aware restrictions.

**Q13.** In IAM policy evaluation terms, how does a Lake Formation
grant relate to an explicit IAM Deny on the same action?

A) A Lake Formation grant overrides an explicit IAM Deny
B) An explicit IAM Deny still wins — Lake Formation grants do not override an explicit deny anywhere in the IAM evaluation chain
C) Lake Formation and IAM Deny statements are evaluated as a merged single policy
D) Lake Formation grants are evaluated before SCPs

**Answer: B.** An explicit IAM Deny is decisive and unconditional
regardless of what any other permission layer, including Lake
Formation, grants — this is consistent with the IAM evaluation order
covered elsewhere in this repo (explicit deny always wins). (A)
reverses the actual precedence. (C) misdescribes the architecture —
they remain separate, independently evaluated permission systems. (D)
Lake Formation grants are not part of the SCP evaluation step at all.

**Q14.** Which of the following is NOT a valid Lake Formation data
filter type?

A) Column filter
B) Row filter
C) Cell-level filter (combined row + column)
D) Network-layer filter restricting source IP ranges

**Answer: D.** Lake Formation data filters operate on data content
(columns/rows), not network-layer IP restriction — that's a security
group/VPC concept, unrelated to Lake Formation. (A), (B), and (C) are
all genuine Lake Formation data filter types.

**Q15.** A company's Athena queries against a Lake Formation-governed
table correctly enforce column restrictions, but the same restriction
is not being honored when the same table is queried from an EMR
Spark job. What is the most likely cause?

A) EMR does not support the Parquet file format
B) The EMR cluster does not have Lake Formation integration explicitly enabled
C) Athena and EMR cannot query the same underlying table
D) The Glue Data Catalog table needs to be duplicated for EMR

**Answer: B.** Unlike Athena, EMR requires Lake Formation integration
to be explicitly turned on for Spark/Hive jobs to honor LF
permissions — this is the specific, well-known gap the exam tests.
(A) is false and unrelated to the governance issue described. (C) is
false — both engines can query the same Catalog-registered table. (D)
is unnecessary; no duplication is required for EMR to read the same
catalog table.
