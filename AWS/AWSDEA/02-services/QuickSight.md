# Amazon QuickSight

> AWS's serverless BI/dashboarding service — the last-mile consumption
> layer that sits on top of everything else in this exam (Redshift,
> Athena, S3, RDS). This file covers SPICE vs. direct query, row- and
> column-level security, embedded analytics, ML Insights, **Amazon Q
> in QuickSight** (generative BI / natural-language querying), the
> per-user vs. capacity pricing models, and the dataset → analysis →
> dashboard → template hierarchy.

## CONTENTS

- [1. Explain like I'm 12](#eli12)
- [2. Explain technically](#technical)
- [3. Explain like a Senior AWS Data Engineer](#senior)
- [4. Production architecture](#architecture)
- [5. SPICE vs. direct query](#spice)
- [6. Row-level and column-level security](#rlscls)
- [7. Embedded analytics](#embedded)
- [8. ML Insights — anomaly detection and forecasting](#mlinsights)
- [9. Amazon Q in QuickSight — generative BI](#amazonq)
- [10. Dataset vs. analysis vs. dashboard vs. template](#hierarchy)
- [11. Pricing — per-user vs. capacity pricing](#pricing)
- [12. When to use / when NOT to use](#whentouse)
- [13. Advantages and limitations](#advlim)
- [14. Performance, scaling, and high availability](#perfscale)
- [15. Security](#security)
- [16. Failure scenarios and common mistakes](#failures)
- [17. Exam traps](#examtraps)
- [18. Interview questions](#interview)
- [19. Cheat sheet](#cheatsheet)
- [20. Memory tricks](#mnemonics)
- [21. Practice questions (15)](#practice)

---

<a name="eli12"></a>
## 1. Explain like I'm 12

Imagine your family keeps mountains of receipts, and you want a big
poster on the wall that automatically shows "how much we spent on
groceries each month" as a colorful chart that updates itself.
**Amazon QuickSight** is the poster-maker: you point it at where your
data lives, drag and drop to build charts, and it either **memorizes**
a fast copy of the data in its own super-speedy memory (like taking a
photo of the receipts so it never has to dig through the box again)
or it can **peek at the live data** every time someone looks at the
poster, depending on what you choose. It can also notice things on its
own — "hey, groceries spiked weirdly last week" — and, with its newest
smart helper, you can just **type a question in plain English** and it
builds the chart for you.

<a name="technical"></a>
## 2. Explain technically

Amazon QuickSight is a fully managed, **serverless** business
intelligence service for building interactive dashboards, visualizing
data, and embedding analytics into applications. It connects to a wide
range of sources — S3, Athena, Redshift, RDS/Aurora, and third-party
databases — and offers two distinct query models: **SPICE** (Super-fast,
Parallel, In-memory Calculation Engine), an in-memory, columnar cache
that ingests a copy of the data for very fast, repeated querying
without hitting the source system, and **direct query**, which queries
the source live on every request. QuickSight organizes work into a
hierarchy — **datasets** (a defined, reusable data source
configuration), **analyses** (the interactive workspace where
visuals/charts are built against a dataset), **dashboards** (a
published, shareable, read-only snapshot of an analysis for
consumption), and **templates** (a reusable definition that can
recreate an analysis/dashboard's structure against a different
dataset, commonly used for embedded, multi-tenant analytics). Access
control includes **row-level security (RLS)** and **column-level
security (CLS)**, letting different users see different subsets of the
same underlying dataset.

<a name="senior"></a>
## 3. Explain like a Senior AWS Data Engineer

A senior engineer's first decision with QuickSight is **SPICE vs.
direct query**, and it's a genuine trade-off, not a "SPICE is always
better" default: SPICE delivers the fastest, most consistent dashboard
performance and completely isolates the source system from dashboard
query load (critical when the source is a production OLTP database or
a cost-metered engine like Athena/Redshift Spectrum where every dashboard
refresh would otherwise mean more scanned bytes billed), but it means
data is only as fresh as the last **SPICE refresh** — a scheduled or
manual re-ingestion. Direct query gives always-current data at the
cost of hitting the source on every view, which can both degrade
source performance under dashboard load and, for pay-per-query engines,
directly increase cost per dashboard view. The second senior instinct:
**row-level security is the answer whenever a requirement says
"different users should see only their own region/department's rows,"**
and it should be implemented via QuickSight's native RLS (backed by a
permissions dataset mapping users/groups to allowed row values) rather
than maintaining separate dashboards or separate datasets per team —
that duplication doesn't scale and drifts out of sync. Third: a senior
engineer treats **embedded analytics** as the answer whenever a
requirement says "expose dashboards inside our own SaaS product to
external customers" — QuickSight's embedding capability (with
per-reader session-based pricing) is purpose-built for exactly that
multi-tenant, external-facing use case, distinct from internal,
named-user dashboard consumption.

<a name="architecture"></a>
## 4. Production architecture

```
   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐
   │  S3         │  │  Athena     │  │  Redshift    │  │  RDS / Aurora  │
   │  (curated)  │  │             │  │             │  │                 │
   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬───────-─┘
        └──────────────┴──────────────┴──────────────┘
                              │
                              v
                  ┌───────────────────────┐
                  │   QuickSight DATASET      │
                  │   (query mode: SPICE or    │
                  │    direct query)             │
                  └──────────┬───────────-┘
                              │
                     ┌────────┴────────┐
                     v                 v
              SPICE (in-memory,   Direct Query
              scheduled refresh,  (always live,
              isolates source     hits source on
              from dashboard      every view)
              load)
                     │                 │
                     └────────┬────────┘
                              v
                  ┌───────────────────────┐
                  │   ANALYSIS (build visuals) │
                  │   RLS / CLS applied here     │
                  └──────────┬───────────-┘
                              │  publish
                              v
                  ┌───────────────────────┐
                  │   DASHBOARD (shared,       │
                  │   read-only)                  │
                  └──────┬─────────┬───────-┘
                         │         │
               Internal users   Embedded in a
               (per-user or     SaaS application
               capacity         (external readers,
               pricing)         session-based pricing)
                         │
                         v
               ML Insights: anomaly detection,
               forecasting  |  Amazon Q: natural-
               language querying, generative BI
```

Reading the diagram: QuickSight connects to any of several sources —
S3, Athena, Redshight, RDS/Aurora — through a **dataset**, which chooses
between **SPICE** (an in-memory cached copy, refreshed on a schedule,
that isolates the source from dashboard query load) and **direct
query** (always current, but hits the source live on every view). An
**analysis** is where visuals are built and where **RLS/CLS** are
applied to scope what each viewer can see; publishing produces a
**dashboard**, consumed either by **internal named users** (per-user or
capacity pricing) or via **embedded analytics** inside an external-
facing SaaS product (session-based pricing for anonymous/external
readers). On top of the visualized data, **ML Insights** surfaces
anomalies and forecasts automatically, and **Amazon Q in QuickSight**
lets any authorized user type a natural-language question and get a
generated visual/answer without building a chart manually.

---

<a name="spice"></a>
## 5. SPICE vs. direct query

| | **SPICE** | **Direct Query** |
|---|---|---|
| Data freshness | As of the last scheduled/manual **refresh** | Always current — queries the source live |
| Dashboard performance | Very fast, consistent (in-memory columnar engine) | Depends entirely on source system performance |
| Load on the source system | **None** after ingestion — SPICE fully isolates dashboard queries from the source | **Every** dashboard view/interaction hits the source |
| Cost implication for pay-per-query sources (Athena, Redshift Spectrum) | One ingestion cost per refresh, regardless of how many users view the dashboard afterward | **Each** dashboard view/filter can trigger a new billed query |
| Capacity | Per-account SPICE capacity limit (purchased/allocated, scalable) | No separate capacity limit — bound by the source system's own capacity |
| Best for | Dashboards viewed frequently by many users; sources where isolating query load matters (production OLTP, pay-per-scan engines) | Requirements for always-current, real-time data; low-frequency, ad hoc analysis where ingestion overhead isn't worth it |
| Exam favorite trigger | "many users viewing the same dashboard," "isolate the source from dashboard load," "minimize Athena/Redshift Spectrum scan cost" | "data must always be current/real-time," "infrequent, ad hoc queries" |

⚠️ **Exam trap:** "hundreds of analysts refresh an Athena-backed
dashboard throughout the day, and Athena costs have spiked" is the
textbook trigger for **switching to SPICE** — each direct-query
dashboard view against Athena is a separately billed scan; SPICE
ingests once per scheduled refresh and serves unlimited subsequent
views from memory at no additional source-side query cost.

<a name="rlscls"></a>
## 6. Row-level and column-level security

| | **Row-Level Security (RLS)** | **Column-Level Security (CLS)** |
|---|---|---|
| Restricts | Which **rows** a user/group can see | Which **columns** a user/group can see |
| Mechanism | A **permissions dataset** mapping users/groups to allowed values of a row-identifying column (e.g., `region`) | A rule set mapping users/groups to allowed/denied columns |
| Applied at | The dataset level, enforced for every analysis/dashboard built on it | The dataset level, same enforcement scope |
| Example | A regional sales manager only sees rows where `region = 'EMEA'` | An HR dashboard hides the `salary` column from everyone except HR-tagged users |
| Underlying data duplication | **None** — one dataset serves different "views" per viewer based on their identity | **None** — same underlying mechanism |

RLS and CLS in QuickSight are the **BI-layer equivalent** of Lake
Formation's row/column data filters, or Redshift's dynamic data masking
— the same governance concept ("different users, different visibility
into the same underlying data, no duplication"), implemented at the
**dashboard/BI presentation layer** instead of the data lake or
warehouse layer. This matters for the exam's layering questions: if the
requirement is about who sees what **in QuickSight dashboards**
specifically, QuickSight's own RLS/CLS is the direct answer; if the
requirement is about the underlying **data lake or warehouse** query
access itself (regardless of tool), Lake Formation or Redshift
RLS/masking is the answer instead.

⚠️ **Exam trap:** "different regional managers should see only their
own region's data **in the QuickSight dashboard**" points to
QuickSight's **native RLS**, not necessarily a Lake Formation row
filter on the underlying source — though both can be layered together
if the requirement spans multiple consumption tools, not just
QuickSight.

<a name="embedded"></a>
## 7. Embedded analytics

QuickSight supports **embedding** dashboards and visuals directly into
a company's own web or mobile application, for both **internal**
(authenticated, IAM/Identity-Center-tied) and **external/anonymous**
(session-based, no individual AWS identity required per viewer)
audiences. This is the standard pattern for a **SaaS company** that
wants to offer analytics **inside their own product** to their
customers, without giving those customers direct AWS account access or
building a custom charting layer from scratch. Embedded sessions for
external/anonymous readers are billed **per session** (reader pricing),
distinct from named internal QuickSight user licenses.

⚠️ **Exam trap:** "expose analytics dashboards to our external SaaS
customers inside our own application, without giving them AWS
credentials" is the specific trigger for **QuickSight embedded
analytics** with **session-based (reader) pricing**, not standard named
per-user licensing, which is the internal-employee model.

<a name="mlinsights"></a>
## 8. ML Insights — anomaly detection and forecasting

**ML Insights** brings machine-learning-powered analysis directly into
QuickSight dashboards without requiring the user to build or manage a
model themselves:

- **Anomaly detection** — automatically scans data for statistically
  unusual patterns (a sudden spike/drop that deviates from the
  expected pattern) and surfaces them as an insight, without a manual
  threshold being pre-defined by the analyst.
- **Forecasting** — projects future values along a time series based
  on historical data, directly within a visual, with confidence
  intervals, again without the user building/training a separate
  forecasting model.
- **Auto-narratives** — automatically generates plain-language text
  summaries of what a visual shows (e.g., "sales increased 12% month
  over month, driven primarily by the Northeast region").

**When it wins:** a business user wants "tell me if something unusual
happened in this data" or "what will next quarter look like" **without
involving a data scientist or a separate ML pipeline (SageMaker)** —
ML Insights is built directly into the BI layer for exactly this
self-service case. For genuinely custom, complex ML modeling needs
beyond what ML Insights' built-in algorithms cover, SageMaker remains
the answer.

<a name="amazonq"></a>
## 9. Amazon Q in QuickSight — generative BI

**Amazon Q in QuickSight** is the natural-language, generative-BI
capability that lets business users type a plain-English question
(e.g., "what were our top 5 products by revenue last quarter in the
Northeast?") and receive an automatically generated visual/answer,
**without** the user needing to know QuickSight's UI, build a chart
manually, or write any query language. It builds on QuickSight's
existing datasets and semantic understanding of the data model,
translating a natural-language question into the appropriate
visualization and underlying query.

⚠️ **Exam trap:** "business users with no BI/analytics tooling
experience need to ask ad hoc questions of the data in plain English
and get an instant visual answer" is the exact trigger for **Amazon Q
in QuickSight**, distinct from ML Insights (which surfaces automatic
anomalies/forecasts on existing visuals, rather than answering an
arbitrary typed question) and distinct from a general-purpose
Amazon Q or SageMaker-based approach.

<a name="hierarchy"></a>
## 10. Dataset vs. analysis vs. dashboard vs. template

```
   DATASET  ──>  ANALYSIS  ──>  DASHBOARD
      |               |               (published, read-only,
      |               |                shared with users/groups
      |               (interactive      or embedded)
      |                workspace,
      |                RLS/CLS
      |                applied here)
      |
      └── can be reused across many analyses

   TEMPLATE  (captures an analysis/dashboard's structure —
              visuals, layout, calculated fields — WITHOUT the
              underlying data; can recreate the same structure
              against a DIFFERENT dataset)
```

| Concept | What it is | Reusable? |
|---|---|---|
| **Dataset** | A defined, named data source configuration (SPICE or direct query, plus any joins/calculated fields) | ✅ Across many analyses |
| **Analysis** | The interactive workspace for building/editing visuals against a dataset | Not directly shared with end users — the working draft |
| **Dashboard** | A published, read-only, shareable snapshot of an analysis, distributed to users/groups | ✅ Shared with many viewers |
| **Template** | A reusable **definition** of an analysis/dashboard's structure, decoupled from any specific dataset | ✅ Reapplied to different datasets — the multi-tenant embedding pattern |

**Templates are the specific mechanism for multi-tenant embedded
analytics** — a SaaS provider builds one dashboard template once, then
programmatically applies it against **each customer's own dataset**,
producing a customer-specific dashboard instance without rebuilding the
visuals from scratch for every tenant.

---

<a name="pricing"></a>
## 11. Pricing — per-user vs. capacity pricing

| Model | How it's billed | Best for |
|---|---|---|
| **Per-user (named user) pricing** | A fixed monthly/annual cost per **named** QuickSight user (Author or Reader role), regardless of how much they use it | A known, relatively stable internal user base — analysts (Authors) building dashboards, employees (Readers) consuming them |
| **Session-based (capacity/reader) pricing** | Billed per **session** for anonymous/embedded readers, without requiring a named QuickSight user license per viewer | Embedded analytics for external customers, or a large/variable internal audience where per-named-user licensing doesn't fit |
| **SPICE capacity** | Billed separately, per GB of SPICE capacity provisioned/consumed | Any account using SPICE datasets, regardless of the user-pricing model chosen |

**QuickSight roles, relevant to per-user pricing:**

| Role | Can do |
|---|---|
| **Admin** | Manage the QuickSight account/subscription itself |
| **Author** | Build datasets, analyses, and dashboards |
| **Reader** | View and interact with published dashboards only, cannot build |

⚠️ **Exam trap:** "external customers viewing embedded dashboards,
potentially thousands of them, each infrequently" points to
**session-based (capacity) pricing**, not per-named-user licensing,
which would require licensing every external customer individually —
prohibitively expensive and operationally impractical at that scale.

<a name="whentouse"></a>
## 12. When to use / when NOT to use

**Use QuickSight when:** you need a serverless, managed BI/dashboarding
layer over S3/Athena/Redshift/RDS data; you need row/column-level
security so different users see different scoped views of the same
dashboard; you need to embed analytics inside your own product for
external customers; business users need self-service anomaly
detection, forecasting, or natural-language querying without a data
science team.

**Do NOT use QuickSight when:** the requirement is upstream data
transformation/ETL (that's Glue, EMR, DataBrew) rather than
visualization; you need a full custom-built, highly bespoke
application UI beyond what a BI/embedding tool reasonably supports; the
audience needs deep, ad hoc SQL exploration rather than curated
dashboards — Athena/Redshift query editors serve that more directly.

<a name="advlim"></a>
## 13. Advantages and limitations

**Advantages:** fully serverless, no infrastructure to manage; SPICE
delivers very fast, consistent dashboard performance while isolating
source systems from query load; native RLS/CLS avoid dataset
duplication for access control; embedded analytics supports external,
multi-tenant SaaS use cases with session-based pricing; ML Insights and
Amazon Q bring self-service anomaly detection, forecasting, and
natural-language querying without a separate ML pipeline.

**Limitations:** SPICE data is only as fresh as the last refresh — not
real-time by default; SPICE has a per-account capacity limit that must
be provisioned/managed; direct query can strain source systems or
increase pay-per-query costs (Athena/Redshift Spectrum) under heavy
dashboard traffic; per-user pricing doesn't scale cleanly to very large
or external audiences without switching to session-based pricing; not
a substitute for upstream ETL/transformation tooling.

<a name="perfscale"></a>
## 14. Performance, scaling, and high availability

QuickSight is fully managed and serverless — there is no cluster or
node capacity for the user to provision or scale manually. **SPICE**
capacity is the one dimension a user actively manages (how much
in-memory cache capacity is provisioned per account/dataset), and
refresh scheduling determines how current SPICE-backed dashboards are.
**Direct query** performance is bound entirely by the source system's
own capacity and concurrency — a dashboard hitting Redshift or Athena
directly is only as fast/scalable as that source allows under
concurrent dashboard load. High availability is inherent to the managed
service — no user-managed failover configuration is required.

<a name="security"></a>
## 15. Security

QuickSight integrates with **IAM** for account-level access and
resource permissions, and with **IAM Identity Center** for centralized
human-user authentication across an organization. **Row-level and
column-level security** are QuickSight-native, dataset-level controls
distinct from (and layered on top of) any Lake Formation or Redshift-
level access controls on the underlying source. Data in SPICE is
encrypted at rest; connections to sources (Redshift, RDS, Athena) use
TLS. For embedded analytics, **anonymous embedding** uses a scoped,
temporary session token rather than a persistent AWS identity for each
external viewer, keeping the embedding application in control of who's
allowed to generate a session in the first place.

<a name="failures"></a>
## 16. Failure scenarios and common mistakes

- **Using direct query against Athena for a dashboard viewed
  frequently by many users**, causing repeated, separately-billed
  scans and unexpectedly high Athena costs — SPICE would have ingested
  once and served unlimited subsequent views for free.
- **Assuming SPICE data is always current** — a stale SPICE refresh
  schedule can silently show outdated data to dashboard viewers who
  assume it's live.
- **Duplicating datasets/dashboards per team instead of using native
  RLS** — creates maintenance drift as the underlying data model
  evolves in multiple places instead of one.
- **Licensing external SaaS customers as named per-user QuickSight
  Readers** instead of using session-based embedded pricing — far more
  expensive and operationally impractical at scale.
- **Confusing QuickSight RLS with Lake Formation/Redshift RLS** — they
  operate at different layers (BI presentation vs. underlying data
  source); a requirement spanning multiple consumption tools may need
  both, not either/or.
- **Reaching for a custom-built ML pipeline (SageMaker) for basic
  anomaly detection/forecasting** that ML Insights already covers
  natively within the dashboard.

<a name="examtraps"></a>
## 17. Exam traps

⚠️ **"Many users, same dashboard, isolate the source, minimize
pay-per-query cost" = SPICE.** "Always-current, real-time data
required" = direct query. Don't default to one without checking which
constraint the scenario actually emphasizes.

⚠️ **"Different users see different rows/columns of the same
QuickSight dashboard" = native RLS/CLS**, not separate datasets or
dashboards per user group.

⚠️ **"Embed dashboards in our external SaaS product for customers, no
AWS credentials given to them" = embedded analytics with session-based
(reader) pricing**, not named per-user licensing.

⚠️ **"Business users ask ad hoc questions in plain English" = Amazon Q
in QuickSight.** "Automatically detect an anomaly or forecast a trend
on an existing visual" = ML Insights. These are two distinct
capabilities — don't swap them.

⚠️ **A template recreates structure, not data** — reapplying a
template against a different dataset is the multi-tenant embedding
pattern; a template alone does not carry any data with it.

<a name="interview"></a>
## 18. Interview questions

- *"How would you decide between SPICE and direct query for a new
  QuickSight dashboard?"* Strong answer: weigh data freshness
  requirements against source system load/cost — SPICE for
  frequently-viewed dashboards where isolating the source and
  minimizing pay-per-query cost (Athena/Redshift Spectrum) matters;
  direct query when the data must always be current and query volume/
  cost on the source is acceptable.
- *"How would you give 50 regional sales managers a single shared
  dashboard where each only sees their own region's numbers?"* Strong
  answer: one dataset and one dashboard, with QuickSight row-level
  security mapping each manager (or their group) to their allowed
  region value via a permissions dataset — no dataset/dashboard
  duplication needed.
- *"A SaaS company wants to offer analytics dashboards inside their own
  product to thousands of external customers. How would you price and
  architect this in QuickSight?"* Strong answer: embedded analytics
  with anonymous/session-based (reader) pricing, using a template
  applied per-customer dataset so each tenant sees their own scoped
  data through one shared dashboard structure.
- *"What's the difference between ML Insights and Amazon Q in
  QuickSight?"* Strong answer: ML Insights automatically surfaces
  anomalies/forecasts on existing visuals without a user asking
  anything; Amazon Q lets a user type an arbitrary natural-language
  question and get a generated visual/answer on demand — one is
  passive/automatic, the other is interactive/generative.

<a name="cheatsheet"></a>
## 19. Cheat sheet

| If the scenario says... | Reach for... |
|---|---|
| many users, same dashboard, isolate source load / cost | SPICE |
| data must always be current / real-time | Direct query |
| different users see different rows of the same dashboard | Row-level security (RLS) |
| hide a specific column from some users | Column-level security (CLS) |
| expose dashboards to external SaaS customers | Embedded analytics, session-based (reader) pricing |
| reuse one dashboard structure across many tenants/datasets | Template |
| automatic anomaly/spike detection on a visual | ML Insights — anomaly detection |
| project future values along a time series | ML Insights — forecasting |
| plain-English question, instant generated visual | Amazon Q in QuickSight |
| internal, known, stable user base | Per-user (named user) pricing |
| large/variable/external audience | Session-based (capacity) pricing |
| build/edit dashboards | Author role |
| view dashboards only | Reader role |

<a name="mnemonics"></a>
## 20. Memory tricks

**"SPICE is a snapshot, direct query is a phone call."** SPICE
serves from memory (as-of-last-refresh); direct query rings the source
live every time. **"RLS/CLS: same data, different windows."** One
dataset, many scoped views, no duplication. **"Q asks, Insights
tells."** Amazon Q answers a typed question; ML Insights proactively
surfaces anomalies/forecasts unasked. **"Template travels without its
luggage."** A template carries structure, never the underlying data.

---

<a name="practice"></a>
## 21. Practice questions (15)

**Q1.** A QuickSight dashboard backed by Athena is viewed by hundreds
of employees daily, and the team notices Athena costs have risen
sharply since the dashboard launched. What is the most direct fix?

A) Switch the dataset from direct query to SPICE
B) Increase the Athena workgroup's data-scanned limit
C) Add more QuickSight Author licenses
D) Enable ML Insights on the dashboard

**Answer: A.** SPICE ingests data once per scheduled refresh and
serves unlimited subsequent dashboard views from memory, eliminating
the per-view Athena scan cost that direct query incurs. (B) doesn't
reduce cost, it raises a limit. (C) licensing more authors doesn't
address query cost. (D) ML Insights is an analytical feature unrelated
to query cost.

**Q2.** A company wants 200 regional managers to view a single shared
QuickSight dashboard, with each manager seeing only their own region's
rows. What is the most maintainable approach?

A) Build 200 separate dashboards, one per manager
B) Duplicate the dataset 200 times, filtered per region
C) Use one dataset and one dashboard with row-level security mapping managers to their allowed region
D) Give each manager direct SQL access to the underlying Redshift table instead

**Answer: C.** RLS scopes visibility per user/group on a single shared
dataset and dashboard, avoiding duplication and drift. (A) and (B)
both create unsustainable maintenance overhead as the data model
evolves. (D) bypasses QuickSight's BI layer entirely and doesn't
address the requirement to view a QuickSight dashboard.

**Q3.** A SaaS company wants to expose QuickSight dashboards inside
their own product to thousands of external customers, without issuing
each customer an AWS/QuickSight user account. Which QuickSight
capability and pricing model fits?

A) Named per-user pricing with an Author role per customer
B) Embedded analytics with session-based (reader) pricing
C) Direct query with no dataset at all
D) SPICE with unlimited free external access

**Answer: B.** Embedded analytics with session-based pricing is
purpose-built for external, anonymous, high-volume audiences without
named licensing. (A) is prohibitively expensive and operationally
impractical for thousands of external users. (C) query mode doesn't
address the embedding/pricing requirement. (D) SPICE is a caching
mechanism, not a pricing/access model, and "unlimited free" isn't how
it's billed.

**Q4.** Which QuickSight feature automatically surfaces an unusual
spike or drop in a visual's data without the user manually defining a
threshold?

A) Amazon Q in QuickSight
B) ML Insights — anomaly detection
C) Row-level security
D) A template

**Answer: B.** Anomaly detection is a built-in ML Insights capability
that proactively flags statistically unusual patterns. (A) Amazon Q
answers typed natural-language questions on demand, rather than
proactively surfacing anomalies unasked. (C) RLS is an access-control
feature, unrelated to anomaly detection. (D) a template captures
structure, not analytical insight generation.

**Q5.** A business user with no BI tooling experience wants to type
"what were our top 5 products by revenue last quarter in the
Northeast?" and get an instant chart. Which QuickSight capability
directly supports this?

A) SPICE
B) Amazon Q in QuickSight
C) Column-level security
D) A published dashboard template

**Answer: B.** Amazon Q in QuickSight is the natural-language,
generative-BI capability that translates a typed question into a
generated visual. (A) SPICE is a caching/query-performance mechanism,
unrelated to natural-language querying. (C) CLS is an access-control
feature. (D) a template recreates dashboard structure; it doesn't
process natural-language questions.

**Q6.** Which of the following correctly distinguishes a QuickSight
**analysis** from a **dashboard**?

A) They are identical concepts with different names
B) An analysis is the interactive, editable workspace for building visuals; a dashboard is the published, read-only, shared snapshot of an analysis
C) A dashboard can be edited by any viewer; an analysis cannot
D) An analysis is always SPICE-backed; a dashboard is always direct query

**Answer: B.** This is the correct hierarchy — build in an analysis,
publish as a read-only dashboard for consumption. (A) conflates two
distinct concepts. (C) reverses the actual editability — dashboards
are read-only for viewers, analyses are the editable workspace. (D) is
fabricated — both can use either SPICE or direct query, that choice is
made at the dataset level, independent of analysis vs. dashboard.

**Q7.** What does a QuickSight **template** actually contain?

A) The underlying data itself, copied for reuse
B) The structure — visuals, layout, calculated fields — of an analysis/dashboard, decoupled from any specific dataset
C) A snapshot of user permissions only
D) A cached copy of SPICE data for faster loading

**Answer: B.** Templates capture structure/definition, not data —
they can be reapplied against a different dataset, which is exactly
what makes multi-tenant embedding practical. (A) is false — templates
explicitly do not carry the underlying data. (C) and (D) both
misdescribe what a template actually stores.

**Q8.** A dashboard requirement states that data shown must always
reflect the absolute latest state of the source system, with no
caching delay, even at some cost to the source system's query load.
What query mode should the dataset use?

A) SPICE with a daily refresh schedule
B) SPICE with an hourly refresh schedule
C) Direct query
D) SPICE with refresh disabled

**Answer: C.** Direct query always hits the source live, guaranteeing
current data at the cost of source-side load on every view. (A) and
(B) both introduce a caching delay (daily or hourly), violating the
"always latest" requirement. (D) disabling refresh would make SPICE
data permanently stale, the opposite of the requirement.

**Q9.** Which statement about QuickSight's Reader role is accurate?

A) Readers can build and edit new analyses and datasets
B) Readers can only view and interact with published dashboards, not build new content
C) Readers have full administrative control over the QuickSight account
D) Readers is not a real QuickSight role

**Answer: B.** The Reader role is scoped to consuming published
dashboards, not authoring. (A) describes the Author role. (C)
describes the Admin role. (D) is false — Reader is a genuine
QuickSight role, central to per-user pricing discussions.

**Q10.** A company's ML team wants to add a highly custom, complex
predictive model to a QuickSight-consumed dataset that goes well
beyond QuickSight's built-in forecasting algorithm. What is the
appropriate approach?

A) Build the custom model in SageMaker and surface its output as data QuickSight visualizes, rather than relying solely on ML Insights
B) Force ML Insights to support arbitrary custom models via a configuration flag
C) Use Amazon Q in QuickSight to write the custom model
D) This isn't possible on AWS

**Answer: A.** For genuinely custom modeling needs beyond ML Insights'
built-in algorithms, SageMaker remains the answer — QuickSight then
visualizes the model's output like any other data source. (B) ML
Insights doesn't support arbitrary custom model injection this way.
(C) Amazon Q answers natural-language questions over existing data; it
doesn't build custom predictive models. (D) is false — the
SageMaker-then-QuickSight pattern is a standard, well-supported
architecture.

**Q11.** Which access-control mechanism in QuickSight restricts which
specific columns of a dataset a given user or group can see?

A) Row-level security (RLS)
B) Column-level security (CLS)
C) SPICE capacity limits
D) IAM Identity Center group membership alone

**Answer: B.** CLS is specifically the column-restriction mechanism.
(A) RLS restricts rows, not columns. (C) SPICE capacity is a
performance/storage concern, unrelated to access control. (D) Identity
Center manages authentication/group membership but doesn't itself
implement column-level restriction inside QuickSight without CLS
configured.

**Q12.** A company has a small, stable group of 30 internal analysts
building and consuming dashboards. Which QuickSight pricing model is
most appropriate?

A) Session-based (capacity) reader pricing
B) Per-user (named user) pricing with a mix of Author and Reader roles
C) A flat, unlimited enterprise license with no per-user tracking at all
D) Pay only per SPICE GB, with no user-based cost at all

**Answer: B.** A small, known, stable internal user base is exactly
what named per-user pricing (Author/Reader roles) is designed for. (A)
session-based pricing is better suited to large/variable external
audiences, not this scenario. (C) is not an actual QuickSight pricing
model. (D) SPICE capacity is billed separately from, not instead of,
user-based pricing.

**Q13.** In the QuickSight dataset → analysis → dashboard → template
hierarchy, which statement is accurate?

A) A dataset can only be used by exactly one analysis
B) A dashboard is created directly from a dataset, bypassing the analysis stage entirely
C) A dataset can be reused across multiple analyses, and dashboards are published, read-only versions of an analysis
D) Templates require their own dedicated SPICE capacity separate from any dataset

**Answer: C.** This is the correct relationship: datasets are reusable
across analyses, and a dashboard is a published snapshot of an
analysis. (A) is false — datasets are explicitly designed for reuse
across many analyses. (B) skips a real, required intermediate step —
dashboards are published from analyses, not created directly from raw
datasets. (D) templates don't have their own SPICE capacity — they
carry structure, not data or a query engine allocation.

**Q14.** Which requirement most directly disqualifies a pure direct-
query dataset design and instead argues for SPICE?

A) The dashboard is viewed once a month by two internal analysts
B) The dashboard is viewed hundreds of times daily by many users against a Redshift Spectrum table billed by data scanned
C) The data changes every few seconds and must always be shown live
D) The dataset has only ten rows of data

**Answer: B.** High-frequency viewing against a pay-per-scan source is
exactly where SPICE's one-time ingestion cost (versus repeated
per-view billed scans) and source-load isolation pay off. (A) and (D)
describe low-stakes, low-frequency, small-scale scenarios where either
mode works fine, with no strong case for SPICE specifically. (C)
actually argues the opposite — a true always-live requirement favors
direct query, not SPICE.

**Q15.** Which of the following best distinguishes QuickSight's
row-level security from Lake Formation's row-level data filters?

A) They are functionally and architecturally identical, differing only in name
B) QuickSight RLS operates at the BI/dashboard presentation layer; Lake Formation row filters operate at the underlying data lake/catalog query layer — both may be used together depending on which consumption tools need to be governed
C) Lake Formation row filters only work with QuickSight, not Athena or Redshift Spectrum
D) QuickSight RLS replaces the need for any underlying source-level access control

**Answer: B.** They enforce the same governance concept at different
layers of the stack, and a requirement spanning multiple tools (not
just QuickSight) may need both applied together. (A) glosses over the
real architectural difference in where enforcement happens. (C) is
false — Lake Formation row filters apply broadly across Athena,
Redshift Spectrum, and EMR, not just QuickSight. (D) is false —
QuickSight RLS governs only what's visible in QuickSight; it doesn't
restrict direct access to the underlying source through other tools.
