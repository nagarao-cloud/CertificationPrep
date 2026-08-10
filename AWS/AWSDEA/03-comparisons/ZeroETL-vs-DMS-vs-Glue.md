# Zero-ETL vs DMS vs Glue

> Three different answers to the same question: **"how does data get
> from an operational database into an analytics store?"** They are
> not tiers of the same thing — they trade away different amounts of
> flexibility for different amounts of "no pipeline to build." This
> file exists because the exam's favorite trap is a scenario that
> *looks* like a zero-ETL scenario right up until one sentence says
> "transform it during load" — and that single sentence disqualifies
> zero-ETL completely.

---

## 1. ELI12

Imagine three ways to get groceries from the store to your kitchen.

**Zero-ETL integration** is a magic pipe permanently connected between
the store's shelf and your fridge — whatever's on the shelf
automatically, continuously appears in your fridge, exactly as-is, no
truck, no driver, nothing for you to manage. It's incredible... but the
pipe only exists between *specific stores* and *specific fridges* that
the pipe manufacturer has already built and tested (specific AWS
source/target pairs). And it only moves groceries *as-is* — it cannot
chop your vegetables, combine two stores' groceries into one meal, or
skip the items you don't want on the way. If you need any of that,
the magic pipe is the wrong tool no matter how convenient it looks.

**AWS DMS** is a delivery truck that drives to almost *any* store —
including ones far outside the "matching pipe" network, including
stores that don't even sell the same brand of groceries as your fridge
(a different database engine entirely) — and it can either grab
*everything on the shelf right now* (full load) or *just keep driving
back every time something changes* (CDC), continuously. It does light
work: it can skip items you marked "don't need" (table/column filters)
or repackage a label (basic mapping). But it will not cook you a meal —
no joins, no aggregations, no business logic.

**AWS Glue** is your own kitchen, with a chef, and a recipe. It can take
groceries from anywhere, in any shape, combine multiple deliveries,
chop and cook and season, and produce a finished dish exactly to spec
— but you have to write the recipe (pipeline code, or visual ETL), and
you decide when the kitchen runs (schedule, trigger, or event).

**The exam's one-line filter:** does the requirement include *any*
transformation, joining, aggregation, or business logic applied *during
the move*? If yes, zero-ETL and often plain DMS are both disqualified —
you need Glue. If no transformation is needed and it's just "keep this
here in sync with that," ask whether the source/target pair is on the
zero-ETL supported list; if yes, zero-ETL; if no (heterogeneous
engines, on-prem sources, needs S3/Kinesis/MSK as a target, or the pair
simply isn't supported), it's DMS.

---

## 2. Comparison matrix

| Attribute | **Zero-ETL integration** | **AWS DMS** | **AWS Glue ETL** |
|---|---|---|---|
| **Purpose** | Fully managed, near-real-time replication between specific AWS source/target pairs, no pipeline built or managed | Continuous replication/CDC (or one-time full load) between a broad range of sources and targets, including heterogeneous engines | Full-control extract-transform-load with joins, aggregation, business logic, and data quality checks |
| **Transformation capability** | ❌ **None** — data lands as-is at the target | ⚠️ **Light only** — table/column filtering, basic column mapping/renaming; no joins or business logic | ✅ **Full** — joins, aggregations, DQDL data quality rules, arbitrary Spark/Python logic |
| **Source/target flexibility** | ❌ **Narrow** — only specific, AWS-published supported pairs (e.g., Aurora MySQL/PostgreSQL → Redshift, RDS MySQL → Redshift, DynamoDB → Redshift/OpenSearch, Aurora → SageMaker Lakehouse) | ✅ **Broad** — relational/document sources (on-prem or cloud, homogeneous or heterogeneous engines) to a wide range of targets, including S3, Kinesis, MSK, Redshift, OpenSearch | ✅ **Broad** — JDBC, S3, streaming sources, and virtually any target reachable via a connector |
| **Infrastructure to manage** | ✅ **None** — AWS operates the replication internally | ⚠️ A **replication instance** (provisioned) or DMS Serverless (still a managed resource you configure) | ✅ **None for Glue jobs** (serverless Spark, DPU-based) |
| **Schema/DDL conversion (heterogeneous engines)** | N/A — not applicable, since supported pairs are pre-validated | ✅ **DMS Schema Conversion** handles structure (schema/DDL) for engine-to-engine migrations; DMS itself moves only data | N/A — Glue jobs assume the target schema already exists or is created by the job itself |
| **Latency** | ✅ Near-real-time, seconds | ✅ Near-real-time for CDC; full load is a one-time bulk operation | Scheduled/triggered batch (minutes to hours cadence), or near-real-time via Glue **streaming** ETL jobs |
| **CDC support** | ✅ Built in, continuous, fully managed | ✅ Native — reads the source transaction log continuously after an initial full load | ⚠️ Not native CDC capture — Glue *consumes* CDC output (e.g., from DMS or a stream) rather than capturing it itself |
| **Setup complexity** | ✅ **Lowest** — a few clicks, no pipeline code | ⚠️ Moderate — configure replication instance/serverless, source/target endpoints, table mappings | ⚠️ Highest — write/configure the job (script or visual), define schedule/trigger, handle bookmarks/retries |
| **Cost model** | Underlying compute cost shifts to the target (e.g., Redshift compute absorbs it); no separate replication-instance charge | Replication instance/DMS Serverless hourly cost, ongoing for as long as CDC runs | Glue DPU-hours per job run |
| **Monitoring** | Target-side metrics (e.g., Redshift integration status) | `CDCLatencySource`/`CDCLatencyTarget`, replication task status, validation task results | Job run status, bookmark state, CloudWatch job metrics |
| **Best use case** | "Sync this AWS-native source into this AWS-native analytics target, no transformation, least possible operational overhead" | "Continuously replicate/migrate from a broad or heterogeneous source, including on-prem, with no transformation logic required" | "Transform, join, aggregate, or apply business/data-quality logic to data as part of moving it" |
| **When NOT to use** | Any transformation requirement; unsupported source/target pair; on-prem sources | Complex transformation/business logic requirements | A simple, no-transform, fully-supported AWS-native sync where zero-ETL is available and would mean zero pipeline to build |
| **Exam favorite** | "no pipeline to build/manage," "near real-time sync," "least operational overhead," a named supported pair (Aurora→Redshift, DynamoDB→OpenSearch) | "continuously replicate an on-prem database," "heterogeneous migration," "CDC into S3/Kinesis," "verify migration completeness" (validation task) | "transform during load," "apply business logic," "join/aggregate before landing," "data quality rules," "scheduled batch job" |

---

## 3. Decision tree

```
┌────────────────────────────────────────────────────────────────┐
│ START: Does the requirement include ANY transformation applied    │
│ during the move — joins, aggregation, business logic, complex     │
│ column derivation, or data quality rule enforcement?               │
└───────────────────────────────┬───────────────────────────────┘
                                 │
                ┌─────────────────┴─────────────────┐
               YES                                   NO — just move/
                │                                     sync the data
          ┌─────▼─────┐                              as-is
          │    GLUE    │                                │
          │(the ONLY   │              Is the source/target pair on the
          │ option with│              zero-ETL SUPPORTED LIST (e.g.,
          │ real       │              Aurora MySQL/PostgreSQL, RDS MySQL,
          │ transform  │              or DynamoDB → Redshift/OpenSearch/
          │ capability;│              SageMaker Lakehouse), AND is "no
          │ zero-ETL   │              pipeline to build/manage" the
          │ and DMS are│              stated priority?
          │ disqualified│                          │
          │ immediately)│              ┌─────────────┴─────────────┐
          └─────────────┘             YES                          NO —
                                        │                     unsupported pair,
                                  ┌──────▼──────┐             on-prem source,
                                  │  ZERO-ETL    │             heterogeneous
                                  │ (least ops,  │             engines, or needs
                                  │ no pipeline, │             S3/Kinesis/MSK
                                  │ no infra to  │             as a target
                                  │ manage)      │                  │
                                  └─────────────┘          ┌──────────▼──────────┐
                                                             │        DMS           │
                                                             │ (broadest source/    │
                                                             │  target flexibility, │
                                                             │  full load + CDC,    │
                                                             │  + DMS Schema        │
                                                             │  Conversion if the   │
                                                             │  engines differ)     │
                                                             └───────────────────────┘

⚠️ THE TRAP: a scenario can look exactly like a zero-ETL case — same
source, same target, "near real-time" — right up until it adds
"…and enrich it with data from another table before it lands" or
"…apply a data quality rule during the sync." That single clause
routes the whole question to Glue, no matter how perfectly the
source/target pair otherwise matches zero-ETL's supported list.
```

---

## 4. Worked scenarios

**Scenario A — An Aurora MySQL database needs to feed a Redshift
warehouse in near-real time, exactly as-is, with the least possible
operational overhead — no replication instance, no pipeline code.**
*Winner: Zero-ETL integration.* Aurora MySQL → Redshift is a supported
pair, no transformation is requested, and "least operational overhead"
plus "no pipeline" are the textbook zero-ETL signals.

**Scenario B — The same Aurora MySQL → Redshift sync, but this time the
requirement adds: "join the incoming orders data against a existing
customer dimension table and compute a running lifetime-value
aggregate before it's queryable."** *Winner: Glue ETL.* This is
Scenario A with one added clause — and that clause (join + aggregation)
disqualifies zero-ETL immediately, no matter how well the source/target
pair otherwise fits. DMS is also disqualified — it doesn't perform
joins/aggregation either. Only Glue has the transformation capability
this now requires.

**Scenario C — An on-premises Oracle database must continuously feed
an S3-based data lake, including full history and all future changes,
with no transformation, and the target engine differs from the
source.** *Winner: DMS (full load + CDC) + DMS Schema Conversion.* Zero-
ETL is disqualified — Oracle-on-prem-to-S3 is not a zero-ETL supported
pair. No transformation is needed, so Glue's transformation capability
isn't the deciding factor; DMS's broad source/target flexibility and
native CDC are exactly what this needs, and DMS Schema Conversion
handles the structural (schema/DDL) side of the heterogeneous migration
since DMS itself moves only data.

**Scenario D — A DynamoDB table needs to feed an OpenSearch index for
search, updated continuously, with no custom enrichment logic, and the
team wants no pipeline to build or manage.** *Winner: Zero-ETL
integration* (DynamoDB → OpenSearch is a supported zero-ETL pair) —
*but* if the requirement instead needs custom routing logic, field
enrichment, or conditional processing per event, the correct mechanism
shifts to **DynamoDB Streams → Lambda** (see `CDC.md`), because that's
an event-driven custom-logic path, not a zero-transformation sync.

---

## 5. Exam traps

| Trap | The correction |
|---|---|
| **"Transform during load" appearing anywhere in a zero-ETL-shaped scenario** | Disqualifies zero-ETL immediately, regardless of how well the source/target pair otherwise matches — zero-ETL performs zero transformation, by definition. |
| **Assuming DMS can perform joins, aggregations, or business logic** | It cannot — DMS's transformation capability is limited to light column/table filtering and mapping. Any join/aggregation/business-logic requirement routes to Glue, not DMS. |
| **Assuming zero-ETL works for any source/target pair "because it's AWS-native"** | It only works for the specific, published supported pairs (e.g., Aurora MySQL/PostgreSQL → Redshift, RDS MySQL → Redshift, DynamoDB → Redshift/OpenSearch/SageMaker Lakehouse). An unsupported pair — even between two AWS services — falls back to DMS or a custom pipeline. |
| **Believing zero-ETL is "free"** | It isn't — there's no separate replication-instance line item, but the compute cost shifts to the target (e.g., Redshift absorbs the ingestion compute); "no pipeline to manage" is not the same claim as "no cost." |
| **Assuming every DMS migration needs DMS Schema Conversion** | Only heterogeneous migrations (different source/target database engines) need schema/DDL conversion. A homogeneous migration (e.g., on-prem MySQL → RDS MySQL) skips it entirely — DMS alone handles data movement. |
| **Forgetting DMS does not migrate schema, indexes, stored procedures, or functions on its own** | That division of labor — DMS Schema Conversion converts structure, DMS moves data — is one of the most tested facts in this whole comparison; don't pick "DMS" as a complete answer to a heterogeneous migration question without also naming DMS Schema Conversion for the structural side. |
| **Picking Glue for a simple, no-transform, fully-supported sync "to be safe"** | Overkill, and the wrong answer when the scenario stresses "least operational overhead" or "no pipeline to build" and the pair is zero-ETL-supported — Glue means writing and maintaining a job that a magic pipe would have made unnecessary. |
| **Treating "near real-time" as automatically meaning zero-ETL** | DMS CDC is also near-real-time; the deciding factor between zero-ETL and DMS is (1) whether transformation is needed and (2) whether the source/target pair is on the zero-ETL supported list — "near real-time" alone doesn't settle it. |

---

## 6. Real-company examples

**Zero-ETL side — a SaaS analytics startup syncing Aurora PostgreSQL
into Redshift.** The application database (Aurora PostgreSQL) is the
system of record for customer accounts and usage events; the BI team
needs near-real-time visibility in Redshift with zero engineering
overhead spent building or maintaining a sync pipeline. Because the
pair is a supported zero-ETL integration and no transformation is
needed before landing, the team enables it in minutes and retires a
previous, hand-rolled nightly Glue extract job entirely — one less
pipeline to monitor, patch, or debug.

**DMS side — a logistics company migrating an on-prem SQL Server fleet-
tracking database to AWS.** Because the target is PostgreSQL-compatible
(a heterogeneous engine change) and the source is on-prem (disqualifying
zero-ETL outright), the team uses **DMS Schema Conversion** to convert
schema/DDL/stored procedures first, then **DMS** to perform a full load
of historical tracking data followed by continuous CDC — with no
transformation requirement, DMS's broad source flexibility is exactly
what a zero-ETL integration could never have covered for an on-prem,
heterogeneous source.

**Glue side — a retail company enriching order events before they land
in the warehouse.** Incoming order events need to be joined against a
product catalog dimension table and have a computed margin field added
before landing in Redshift for finance reporting — a transformation
requirement that immediately rules out both zero-ETL and plain DMS.
**Glue ETL** (scheduled batch job with job bookmarks for incremental
pickup) performs the join, computes the derived field, and applies a
Glue Data Quality (DQDL) rule flagging any order with a negative margin
before it ever reaches the finance team's dashboards.

---

## 7. Practice questions (12)

**Q1.** An Aurora MySQL database needs to feed Redshift in near-real
time, exactly as-is, with no transformation and the least possible
operational overhead. What's the best fit?

- A. **Zero-ETL integration — ✓** Supported pair, no transformation
  needed, "least operational overhead" is the textbook zero-ETL signal.
- B. AWS DMS with a provisioned replication instance — ✗ Works
  technically but is the higher-operational-overhead distractor when
  zero-ETL is available for this exact pair.
- C. AWS Glue scheduled batch job — ✗ Unnecessary transformation
  infrastructure for a requirement with no transformation need, and
  batch cadence doesn't match "near real-time" as well as either
  streaming option.
- D. DMS Schema Conversion followed by DMS — ✗ Schema conversion is only
  needed for heterogeneous engine migrations; Aurora MySQL → Redshift
  isn't that, and this path adds unnecessary complexity for a zero-ETL-
  eligible pair.

**Q2.** The same Aurora MySQL → Redshift scenario as Q1, but now the
requirement adds "join the incoming data against a customer dimension
table and compute an aggregate before it's queryable." What changes?

- A. Nothing — zero-ETL still applies — ✗ Incorrect; transformation
  requirements disqualify zero-ETL regardless of source/target pair.
- B. **Zero-ETL and DMS are both disqualified; AWS Glue ETL is now
  required — ✓** Joins and aggregation are transformation capabilities
  only Glue provides among these three options.
- C. Only zero-ETL is disqualified; DMS can perform the join — ✗ DMS
  cannot perform joins or aggregations; it's limited to light
  filtering/mapping.
- D. Only DMS is disqualified; zero-ETL can perform the join — ✗
  Zero-ETL performs zero transformation by definition; it cannot join
  data either.

**Q3.** An on-premises Oracle database must continuously feed an S3
data lake, full history plus ongoing changes, target engine differs
from source, no transformation needed. What's the correct combination?

- A. Zero-ETL integration alone — ✗ On-prem sources and this
  source/target pair are not on the zero-ETL supported list.
- B. AWS Glue alone, scheduled nightly — ✗ No native CDC capture
  capability, and this requirement needs continuous replication, not
  batch extraction; also unnecessary since no transformation is needed.
- C. **DMS (full load + CDC) plus DMS Schema Conversion for the
  heterogeneous structural conversion — ✓** Matches every stated
  requirement: broad source flexibility, no transform needed, full
  load + CDC, heterogeneous engine handled by DMS Schema Conversion.
- D. DMS alone, with DMS also converting the schema — ✗ DMS does not
  convert schema/DDL/stored procedures on its own; that's DMS Schema
  Conversion's job specifically.

**Q4.** What is the single clause that most reliably disqualifies a
zero-ETL integration from an otherwise zero-ETL-shaped scenario?

- A. "Near real-time" — ✗ Zero-ETL is itself near-real-time; this
  phrase supports zero-ETL rather than disqualifying it.
- B. "Least operational overhead" — ✗ This phrase supports zero-ETL;
  it does not disqualify it.
- C. **Any mention of transformation, joining, aggregation, or business
  logic applied during the move — ✓** Zero-ETL performs zero
  transformation by definition; any such requirement rules it out
  immediately.
- D. "Supported source/target pair" — ✗ This phrase confirms zero-ETL
  eligibility; it does not disqualify it.

**Q5.** Which of these is a true statement about AWS DMS's
transformation capability?

- A. DMS can perform arbitrary joins and aggregations across tables —
  ✗ False; that level of transformation requires Glue.
- B. **DMS supports only light transformation — table/column filtering
  and basic column mapping/renaming, not joins or business logic — ✓**
  Correct and matches the comparison matrix directly.
- C. DMS cannot filter or map columns at all; it moves entire tables
  unmodified only — ✗ Understates DMS's actual (light) transformation
  capability.
- D. DMS's transformation capability matches Glue's exactly — ✗ False;
  Glue's transformation capability is substantially broader (joins,
  aggregation, arbitrary business logic, data quality rules).

**Q6.** A DynamoDB table needs to feed an OpenSearch index continuously,
with no custom enrichment logic and no pipeline to build or manage.
What's the best fit, assuming this specific pair is on the zero-ETL
supported list?

- A. **Zero-ETL integration — ✓** Supported pair, no transformation
  needed, "no pipeline to build or manage" is the zero-ETL signal.
- B. DynamoDB Streams plus Lambda — ✗ The correct answer only if custom
  enrichment/routing logic were needed; here, no such logic is
  requested, so the simpler zero-ETL path fits better.
- C. AWS Glue scheduled job — ✗ Unnecessary transformation
  infrastructure and batch cadence for a no-transform, continuous sync
  need.
- D. AWS DMS — ✗ Works technically but is the higher-operational-
  overhead distractor when a supported zero-ETL pair is available.

**Q7.** Now assume the DynamoDB-to-OpenSearch requirement adds "route
certain event types to a different index based on custom conditional
logic." What changes?

- A. Nothing — zero-ETL still applies — ✗ Custom conditional routing
  logic is a transformation-adjacent requirement zero-ETL cannot
  perform.
- B. **DynamoDB Streams → Lambda (custom logic) becomes the correct
  mechanism instead of zero-ETL — ✓** Custom routing/conditional
  processing per event requires an event-driven, code-based path, which
  is exactly what DynamoDB Streams + Lambda provides natively for a
  DynamoDB source. |
- C. DMS becomes the correct mechanism — ✗ DMS is not the native
  mechanism for DynamoDB's own change events, and doesn't support
  custom conditional routing logic either.
- D. Glue becomes mandatory and DynamoDB Streams becomes irrelevant — ✗
  DynamoDB Streams + Lambda is the more natural, lower-latency,
  purpose-built fit for this exact event-driven custom-logic pattern.

**Q8.** Which AWS component performs schema/DDL conversion in a
heterogeneous database migration, and which performs the data
movement?

- A. DMS does both — ✗ DMS does not convert schema, indexes, stored
  procedures, or functions.
- B. **DMS Schema Conversion converts schema/DDL/stored
  procedures/functions; DMS performs the actual full load and ongoing
  CDC data movement — ✓** Correct division of labor.
- C. Glue converts schema; DMS moves data — ✗ Names the wrong
  schema-conversion tool.
- D. DMS converts schema; DMS Schema Conversion moves data — ✗ Reverses
  the correct roles.

**Q9.** A retail company needs order events joined against a product
catalog and enriched with a computed margin field, with a data quality
rule flagging bad rows, before landing in a warehouse. Which service
uniquely satisfies this among the three covered in this file?

- A. Zero-ETL integration — ✗ Cannot join, compute derived fields, or
  apply data quality rules.
- B. AWS DMS — ✗ Cannot perform joins, aggregations, or Glue Data
  Quality (DQDL) rules either — limited to light filtering/mapping.
- C. **AWS Glue ETL — ✓** The only one of the three with full
  transformation capability (joins, computed fields) plus native Glue
  Data Quality (DQDL) rule support.
- D. Any of the three, since they're functionally interchangeable — ✗
  False; the three have meaningfully different transformation
  capabilities, which is this file's entire point.

**Q10.** True or false: zero-ETL integrations have no associated
compute cost because "there's no pipeline to manage."

- A. **False — ✓** "No pipeline to manage" refers to operational
  overhead, not cost; the underlying compute cost shifts to the target
  (e.g., Redshift absorbs the ingestion compute) rather than
  disappearing entirely.
- B. True, zero-ETL is entirely free — ✗ Incorrect; compute cost is
  real, just relocated to the target rather than billed as a separate
  replication-instance line item.
- C. False, but only because AWS charges a flat zero-ETL service fee
  unrelated to usage — ✗ Not how zero-ETL billing works; cost tracks
  target-side compute, not a flat fee.
- D. True, because the source absorbs all cost instead of the target —
  ✗ Incorrect; it's the target side (e.g., Redshift) that absorbs the
  ingestion compute cost, not the source.

**Q11.** A homogeneous migration (on-prem MySQL to Amazon RDS for
MySQL) needs full load plus ongoing CDC, with no transformation. Is DMS
Schema Conversion required here?

- A. Yes, DMS Schema Conversion is required for every DMS migration
  regardless of engine — ✗ False; it's only needed when source and
  target engines differ.
- B. **No — since source and target are the same engine (MySQL to
  MySQL), DMS alone handles the migration; DMS Schema Conversion is
  only needed for heterogeneous engine changes — ✓** Correct — this is
  a homogeneous migration, so schema conversion is unnecessary.
- C. No, because DMS never supports schema conversion under any
  circumstances — ✗ Overstated; DMS Schema Conversion exists precisely
  for the heterogeneous case, just not this one.
- D. Yes, because on-prem sources always require DMS Schema Conversion
  — ✗ The on-prem-vs-cloud distinction is irrelevant to whether schema
  conversion is needed; the engine-match is what matters.

**Q12.** Which phrase pairing in a question stem most reliably signals
"this is a Glue question, not a zero-ETL or plain-DMS question"?

- A. "Near real-time" and "no pipeline to manage" — ✗ These phrases
  point toward zero-ETL, not Glue.
- B. "Continuously replicate" and "on-premises source" — ✗ These
  phrases point toward DMS, not Glue.
- C. **"Apply business logic," "join," "aggregate," or "enforce a data
  quality rule" combined with "before it's queryable" or "during the
  load" — ✓** These are the direct transformation-requirement trigger
  phrases that only Glue, among the three, can satisfy.
- D. "Supported source/target pair" — ✗ This phrase confirms zero-ETL
  eligibility, the opposite signal from a Glue requirement.
