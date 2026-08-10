# Amazon OpenSearch Service

> Domain alignment: **Domain 2 — Data Store Management (26%)** for
> architecture/index management, and **Domain 3 — Data Operations and
> Support (22%)** for log analytics and search-based troubleshooting.
> Appears throughout `SERVICE-SELECTION-MATRIX.md` as the reflex answer
> for "full-text search, log analytics, Kibana" (Part 1C) and in the
> Part 6 data store matrix.

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

Imagine a library where, instead of a card catalog that only tells you
which shelf a book is on, every single word inside every book has its
own index card pointing back to every page it appears on. Ask "which
books mention dragons on page 12 or later," and the librarian answers
instantly, without reading a single book cover to cover. That's what
OpenSearch does with data — it builds a giant word-to-location index
(an **inverted index**) so searching billions of log lines or documents
for a phrase, a pattern, or a fuzzy match is nearly instant, instead of
scanning everything from scratch like a database table scan would.

---

<a name="s2"></a>
## 2. Explain technically

**Amazon OpenSearch Service** is a managed deployment of **OpenSearch**
(the open-source fork of Elasticsearch, created after Elastic changed
its license — the exam's currency table explicitly renames "Amazon
Elasticsearch Service" to **Amazon OpenSearch Service**, see
`CLAUDE.md` Section 7). It's a distributed search and analytics engine
built around **inverted indices**, most commonly used for full-text
search, log analytics, and security analytics (SIEM-style use cases).

### 2.1 Cluster architecture — node types

```
┌──────────────────────────────────────────────────────────────────┐
│                     OpenSearch DOMAIN (managed cluster)              │
│                                                                        │
│   ┌───────────────┐                                                   │
│   │  MASTER NODES   │  Cluster state management: which nodes exist,   │
│   │  (dedicated,    │  index metadata, shard allocation decisions.    │
│   │   odd number,   │  Do NOT serve search/index requests directly    │
│   │   e.g. 3)       │  in a well-sized cluster (dedicated masters).   │
│   └───────┬───────┘                                                   │
│           │  coordinates                                              │
│           v                                                           │
│   ┌───────────────┐    ┌───────────────┐    ┌───────────────┐        │
│   │  DATA NODES     │    │  DATA NODES     │    │  DATA NODES     │  │
│   │  Store shards,  │    │  Store shards,  │    │  Store shards,  │  │
│   │  serve search   │    │  serve search   │    │  serve search   │  │
│   │  and indexing   │    │  and indexing   │    │  and indexing   │  │
│   │  requests       │    │  requests       │    │  requests       │  │
│   └───────────────┘    └───────────────┘    └───────────────┘        │
│           ▲                                                           │
│           │  optional, offloads parsing/enrichment                     │
│   ┌───────────────┐                                                   │
│   │  INGEST NODES   │  Pre-process documents (parse, enrich, transform│
│   │  (optional)     │  fields) before indexing — like a lightweight   │
│   │                 │  ETL step inside the cluster itself             │
│   └───────────────┘                                                   │
└──────────────────────────────────────────────────────────────────┘
```

- **Master nodes** — manage cluster state (which nodes are healthy,
  where shards live, index creation/deletion). Running **dedicated**
  master nodes (separate from data nodes) is a production best
  practice — an **odd number** (typically 3) avoids split-brain
  scenarios during leader election.
- **Data nodes** — where indices actually live, split into **shards**
  (a shard is the unit of horizontal scaling — each shard is itself a
  Lucene index) and replicated across nodes/AZs for durability and
  read throughput.
- **Ingest nodes** — an optional node role that runs **ingest
  pipelines** (parse, enrich, transform documents) before indexing,
  reducing the need for a separate upstream ETL step for basic
  transformations.
- **UltraWarm and Cold storage tiers** — for log-analytics use cases
  with large volumes of aging data, UltraWarm nodes serve
  less-frequently-queried indices from S3-backed storage at much lower
  cost than hot data-node storage, and Cold storage detaches indices
  entirely (not immediately queryable, cheapest, for long-term
  retention) — directly analogous to S3 storage-class tiering, applied
  to search indices.

### 2.2 OpenSearch Serverless

**OpenSearch Serverless** removes cluster/node management entirely —
you interact with **collections** (a logical grouping of indices) and
AWS handles capacity provisioning, scaling, and patching automatically,
billed on **OpenSearch Compute Units (OCUs)** consumed rather than
provisioned instance-hours.

| Attribute | **Provisioned OpenSearch** | **OpenSearch Serverless** |
|---|---|---|
| Node/shard management | Manual (you choose instance types, shard counts) | Fully automatic |
| Scaling | Manual or via Auto-Tune | Automatic, per collection |
| Cost model | Instance-hours + storage | OCU-hours, scales to workload |
| Cold start / idle cost | Runs continuously | Can scale down when idle (lower cost floor) |
| Best for | Predictable, steady, large-scale workloads with tuning needs | Unpredictable/spiky workloads, less ops overhead desired |
| Vector search support | ✅ (k-NN plugin) | ✅ |

Serverless is the answer whenever a question emphasizes **"least
operational overhead"** for search/log-analytics workloads with
unpredictable traffic — the same "serverless vs. provisioned"
judgment pattern that recurs across the entire exam (see
`DOMAIN-3-DATA-OPERATIONS.md` section 3.2.5).

### 2.3 Index management — ISM policies and rollover

**Index State Management (ISM)** policies automate the lifecycle of
time-series indices (extremely common for log data, where a new index
is typically created per day/hour) through defined states:

```
   hot ──▶ warm ──▶ cold ──▶ delete
   (frequent      (aging,     (rarely     (past
    writes/reads,  moved to    queried,     retention —
    on hot data     UltraWarm,  moved to     removed)
    nodes)          cheaper)    Cold tier)

ROLLOVER: automatically create a new index once the current one
hits a size/age/doc-count threshold — prevents any single index
from growing unbounded and keeps shard sizes manageable.

Example ISM policy:
  - index age > 7 days   → move to warm
  - index age > 30 days  → move to cold
  - index age > 90 days  → delete
```

**Rollover** is the mechanism that creates a fresh index (e.g.,
`logs-2026.08.09` → `logs-2026.08.10`) once a threshold is crossed —
this is what keeps individual shard sizes from growing unbounded in a
continuously-ingesting log pipeline, directly analogous to the
"small-file problem" fix pattern (compaction, partitioning) elsewhere
in this exam, but applied to search indices instead of S3 objects.

### 2.4 Vector engine — semantic search

OpenSearch's **k-NN (k-nearest neighbor) vector engine** stores
high-dimensional embedding vectors alongside documents and supports
**approximate nearest-neighbor (ANN) search** — the foundation of
**semantic search** (finding conceptually similar content, not just
keyword matches) and **Retrieval-Augmented Generation (RAG)** patterns
for generative AI applications.

```
Document/text ──▶ Embedding model (e.g., Bedrock Titan Embeddings,
                   or a SageMaker-hosted model) ──▶ vector (e.g., 1536 dims)
                                                            │
                                                            v
                                          OpenSearch index (k-NN field type)
                                                            │
Query text ──▶ same embedding model ──▶ query vector ──▶ ANN search ──▶
                                                     top-k semantically
                                                     similar documents
```

| Attribute | **OpenSearch vector engine** | **pgvector (Aurora/RDS PostgreSQL)** | **Bedrock Knowledge Bases** |
|---|---|---|---|
| Purpose | Vector search inside a broader search/log-analytics platform | Vector search inside a relational database | Fully managed RAG orchestration (chunking, embedding, retrieval, all managed) |
| Setup effort | Moderate (index mapping, plugin config) | Low if already using Aurora/RDS | Lowest — managed end-to-end |
| Best for | Teams already using OpenSearch for search/logs, wanting to add semantic search on the same platform | Teams already using Postgres, want vectors alongside relational data with SQL | Teams wanting the fastest path to a working RAG pipeline with minimal custom code |
| Scale | Very large-scale ANN search, purpose-built | Good, but bound by Postgres extension limits at extreme scale | Delegates to a chosen vector store (can BE OpenSearch under the hood) |
| Exam framing | "Add semantic search to an existing log/search platform" | "Already using Aurora/RDS, want vectors alongside relational queries" | "Fully managed generative AI retrieval with minimal build" |

⚠️ Note that **Bedrock Knowledge Bases** commonly uses **OpenSearch
Serverless** as its underlying vector store — they are not always
competitors; OpenSearch is frequently the storage layer *underneath*
a Bedrock Knowledge Base, while also being usable directly for teams
wanting more control.

### 2.5 Use cases

| Use case | Why OpenSearch |
|---|---|
| **Log analytics** | Near-instant full-text search across huge log volumes; OpenSearch Dashboards (the OSS fork of Kibana) for visualization |
| **Full-text search** | Application/e-commerce search-as-you-type, fuzzy matching, relevance ranking (BM25 scoring) |
| **Security analytics / SIEM** | Correlate security events across log sources at scale, with built-in Security Analytics plugin features (detectors, alerting on suspicious patterns) |
| **Semantic/vector search** | RAG pipelines, "find similar" recommendations, natural-language search over unstructured content |
| **Operational dashboards** | Real-time visualization of application/infrastructure metrics ingested as documents |

### 2.6 OpenSearch vs. Kendra vs. Athena/CloudWatch Logs Insights for log/search queries

| Attribute | **OpenSearch** | **Amazon Kendra** | **Athena** | **CloudWatch Logs Insights** |
|---|---|---|---|---|
| Purpose | General-purpose search + analytics engine you manage/tune | **Natural-language enterprise search** over documents (fully managed ML relevance) | Ad-hoc SQL over S3 data | Query CloudWatch Logs specifically |
| Query style | Full-text (Lucene DSL/query string), also SQL plugin, also vector | **Plain-English questions** ("what is our vacation policy?") | SQL | Purpose-built query language (`fields`/`filter`/`stats`) |
| Setup effort | You manage indices, mappings, ISM policies (or use Serverless) | Minimal — point at document sources (S3, SharePoint, Confluence, etc.), Kendra handles relevance | None — serverless SQL | None — built into CloudWatch |
| Data source | Documents you index yourself (from any pipeline) | Enterprise content repositories, connectors provided | S3 (via Glue Catalog) | CloudWatch Logs only |
| Best use case | Log analytics, application search, security analytics, semantic search at scale | Internal knowledge-base / document Q&A ("ask a question in plain English about our internal wiki") | Ad-hoc analysis of data already in S3 | Debugging application logs already in CloudWatch |
| When NOT to use | Simple document Q&A over static enterprise docs (Kendra is purpose-built and needs less tuning) | High-volume, low-latency operational log search (not its design point) | Data not in S3/not tabular | Data not in CloudWatch, or needing full-text relevance ranking |
| Exam favorite | "Kibana", "log analytics", "full-text search" | "natural language enterprise search", "internal knowledge base Q&A" | "ad-hoc SQL, pay per query" | "query application logs with SQL-like syntax" |

The distinguishing signal: if the question describes **"employees ask
plain-English questions and get answers from internal documents"** →
**Kendra**. If it describes **"search/analyze large volumes of logs
or build a full-text/semantic search feature you control"** →
**OpenSearch**. If it's **"the logs are already in CloudWatch and I
just need an ad-hoc query"** → **CloudWatch Logs Insights** (cheaper,
zero setup, but limited to CloudWatch-resident data). If it's
**"the data is already sitting in S3 as files and I need occasional
SQL"** → **Athena**.

---

<a name="s3"></a>
## 3. Explain like a senior AWS data engineer

A senior engineer's first filter for OpenSearch questions is
**"is this actually a search/relevance problem, or just a query-a-
log-store problem?"** A huge fraction of exam distractors offer
OpenSearch as the "impressive-sounding" answer to a question that
CloudWatch Logs Insights or Athena already solves more cheaply and
with less operational overhead — per `DOMAIN-3-DATA-OPERATIONS.md`'s
Part 0 dominant trap: "OpenSearch for a log search question that
CloudWatch Logs Insights already answers cheaper." OpenSearch earns
its place when the requirement genuinely needs **full-text relevance
ranking, fuzzy matching, complex aggregations across a search index,
or Kibana/OpenSearch Dashboards visualization** — not just "search my
CloudWatch logs occasionally."

Second, a senior engineer treats **shard sizing as a first-class
design decision**, not an afterthought. Too many small shards
(over-sharding) wastes cluster overhead on coordination; too few large
shards limits parallelism and can make individual shards slow to
recover after a node failure. The standard guidance is to size shards
in the tens-of-GB range (a commonly cited target is roughly 10–50 GB
per shard) and to use **rollover** (Section 2.3) so time-series
indices don't grow past that target as data accumulates — getting this
wrong is a common, hard-to-fix-after-the-fact production mistake,
since resharding an existing index typically requires reindexing.

Third: **dedicated master nodes** are not optional polish for a
production cluster of any real size — without them, master duties
compete with data-node workload for the same compute, and a cluster
under heavy indexing/query load can experience unstable cluster-state
management exactly when it matters most (during a node failure or
scaling event). The exam rewards recognizing "dedicated master nodes,
odd number" as the answer to "improve cluster stability" questions.

Fourth: **OpenSearch Serverless vs. provisioned** is the same
cost-vs-control tradeoff seen everywhere else in this exam (Redshift
Serverless vs. provisioned, EMR Serverless vs. EC2). A senior engineer
picks Serverless for unpredictable/spiky search or log-analytics
workloads and least operational overhead, and provisioned (with
Reserved Instance pricing where available) for steady, large, tunable
workloads where the extra control over shard allocation and instance
types pays for itself.

Finally, on **vector search**: a senior engineer recognizes OpenSearch
as one of several valid vector stores (alongside pgvector and native
Bedrock Knowledge Base storage), and picks it specifically when the
team is **already operating OpenSearch for search/logs** and wants to
consolidate semantic search onto the same platform, rather than
introducing a second specialized system — architectural consolidation,
not just raw vector-search capability, is usually the deciding signal
in an exam scenario.

---

<a name="s4"></a>
## 4. Explain production architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    LOG ANALYTICS / SIEM PRODUCTION PATTERN              │
│                                                                            │
│  Application logs, VPC Flow Logs, CloudTrail, WAF logs                    │
│         │                                                                  │
│         v                                                                  │
│  ┌───────────────┐                                                        │
│  │ Amazon Data     │  buffers, batches, optionally transforms               │
│  │ Firehose        │  (Lambda) before delivery                              │
│  └───────┬────────┘                                                        │
│          v                                                                  │
│  ┌───────────────────────────────────────────────────────────────┐        │
│  │                  OpenSearch Domain (production)                    │        │
│  │                                                                       │        │
│  │  3x dedicated MASTER nodes (odd number, avoid split-brain)          │        │
│  │  N x DATA nodes across 3 AZs (Multi-AZ, zone awareness enabled)      │        │
│  │                                                                       │        │
│  │  ISM policy: hot (7 days, data nodes) → warm (30 days, UltraWarm)   │        │
│  │              → cold (1 year, Cold storage) → delete                  │        │
│  │                                                                       │        │
│  │  Rollover alias: logs-* creates a new index daily,                   │        │
│  │  keeping shard size in the healthy ~10-50 GB range                   │        │
│  └───────────────────────────┬───────────────────────────────────┘        │
│                                v                                             │
│                    OpenSearch Dashboards (Kibana fork)                       │
│                    — security analysts search/visualize                      │
│                                                                               │
│  Access control:                                                             │
│    VPC-only domain (no public endpoint) + fine-grained access control        │
│    (role-based, index-level and field-level permissions) + IAM               │
│    for service-to-service (Firehose → OpenSearch) authentication              │
└──────────────────────────────────────────────────────────────────────┘
```

**Why each piece exists:** logs land via **Amazon Data Firehose**
(rather than a hand-rolled ingestion pipeline) because Firehose
natively supports OpenSearch as a delivery destination, with built-in
buffering, retry, and optional Lambda-based transformation before
indexing. **Dedicated master nodes** in odd number protect cluster
stability under load. **Multi-AZ data nodes with zone awareness**
ensure a single AZ failure doesn't take down search availability — a
replica shard lives in a different AZ than its primary. The **ISM
policy with rollover** keeps costs down by moving aging log data to
progressively cheaper storage tiers automatically, without a human
managing index lifecycle by hand. A **VPC-only domain** with
**fine-grained access control** (not just network-level IAM) lets
different analyst teams see different indices/fields — e.g., a
security team sees WAF and VPC Flow Logs, while an app team is scoped
to only their own application's log indices.

---

<a name="s5"></a>
## 5. Explain exam traps

⚠️ **Trap 1 — OpenSearch chosen over cheaper CloudWatch Logs Insights
for occasional log search.** If the requirement is "search
CloudWatch-resident logs occasionally" with no mention of relevance
ranking, Kibana-style dashboards, or non-CloudWatch data sources,
Logs Insights is the leaner, cheaper answer. OpenSearch implies
standing up and operating a whole additional cluster/service.

⚠️ **Trap 2 — Confusing OpenSearch with Kendra.** "Employees ask
plain-English questions about internal documents" → **Kendra**, not
OpenSearch. OpenSearch requires you to build and tune the relevance/
search experience yourself; Kendra is purpose-built managed natural-
language enterprise search with minimal setup.

⚠️ **Trap 3 — Running master duties on data nodes at production
scale.** Without dedicated master nodes, cluster-state management
competes with indexing/query workload, risking instability exactly
during failure/scaling events — the exam rewards "add dedicated master
nodes" as the fix for stability questions, not simply "add more data
nodes."

⚠️ **Trap 4 — Not enabling zone awareness / Multi-AZ.** A cluster with
replica shards placed in the same AZ as their primary offers no
protection against an AZ failure — zone awareness must be explicitly
enabled to guarantee cross-AZ replica placement.

⚠️ **Trap 5 — Ever-growing single index with no rollover.** A
continuously-ingesting index with no rollover/ISM policy eventually
produces oversized shards, degrading performance — the fix is a
rollover alias plus an ISM lifecycle policy, not simply adding more
data nodes to a single unbounded index.

⚠️ **Trap 6 — Treating OpenSearch Serverless as strictly cheaper.**
Like all serverless-vs-provisioned tradeoffs on this exam, Serverless
is not universally cheaper — a steady, large, 24/7 workload can be
more cost-effective on provisioned/Reserved capacity. "Least
operational overhead" favors Serverless; "lowest cost at steady, high,
predictable volume" can favor provisioned.

⚠️ **Trap 7 — Public-facing OpenSearch domain "for simplicity."** A
question emphasizing security/compliance should point to a VPC-only
domain with fine-grained access control, not a public endpoint secured
only by an open or IP-restricted access policy.

⚠️ **Trap 8 — Assuming OpenSearch vector search and Bedrock Knowledge
Bases are mutually exclusive choices.** They frequently coexist —
Bedrock Knowledge Bases often use OpenSearch Serverless as the
underlying vector store. A question describing "fully managed RAG with
minimal build effort" points to Bedrock Knowledge Bases as the
higher-level answer, even though OpenSearch may be operating
underneath it.

---

<a name="s6"></a>
## 6. Explain interview questions

**Q: "Your OpenSearch cluster becomes unresponsive during a scaling
event, and you suspect cluster-state management is the bottleneck.
What's the architectural fix?"**
A: Add dedicated master nodes (an odd number, typically 3) so
cluster-state coordination doesn't compete with data-node indexing/
query workload — this is the standard production hardening step for
any cluster expected to handle real scale or churn.

**Q: "How do you keep a continuously-ingesting log index from growing
into a performance problem over time?"**
A: Use an index rollover alias so a new index is created automatically
once a size/age/doc-count threshold is hit, paired with an ISM policy
that moves aging indices through hot → warm (UltraWarm) → cold →
delete states — keeping individual shard sizes in a healthy range and
storage cost proportional to data value/recency.

**Q: "When would you pick Kendra over building search in
OpenSearch?"**
A: When the requirement is natural-language question-answering over
enterprise document repositories (wikis, SharePoint, S3 documents)
with minimal relevance tuning — Kendra's managed ML relevance model is
purpose-built for that, whereas OpenSearch requires you to design and
tune the search/relevance experience yourself, better suited to
log analytics or a custom search feature you want deep control over.

**Q: "How would you add semantic (not just keyword) search to an
application already using OpenSearch for full-text search?"**
A: Add a k-NN vector field to the index mapping, generate embeddings
for documents (e.g., via a Bedrock embedding model), index the
vectors alongside existing fields, and query using approximate
nearest-neighbor search — this can even be combined with keyword
search in a single hybrid query, without introducing a second,
separate vector database.

**Q: "How do you scope different teams to only see their own log
data in a shared OpenSearch cluster?"**
A: Fine-grained access control with role-based, index-level (and if
needed field-level) permissions mapped to IAM or SAML identities — a
security team's role can be scoped to WAF/VPC Flow Log indices, while
an application team's role is scoped only to that application's own
index pattern.

---

<a name="s7"></a>
## 7. Cheat sheet

| Fact | Value |
|---|---|
| What it is | Managed OpenSearch (Elasticsearch fork) — search + log analytics |
| Node types | Master (cluster state), Data (shards, search/index), Ingest (optional, pre-process) |
| Dedicated masters | Odd number (e.g., 3); avoids split-brain, stabilizes production clusters |
| Storage tiers | Hot (data nodes) → UltraWarm (S3-backed, cheaper) → Cold (detached, cheapest) |
| Serverless option | OpenSearch Serverless — OCU-based billing, no cluster management |
| Index lifecycle | ISM policies automate hot→warm→cold→delete transitions |
| Rollover | Auto-creates new index at size/age/doc-count threshold; controls shard size |
| Shard sizing target | Roughly 10–50 GB per shard (avoid over- or under-sharding) |
| Vector/semantic search | k-NN plugin; ANN search over embeddings; used for RAG, "find similar" |
| Visualization | OpenSearch Dashboards (Kibana fork) |
| Multi-AZ | Zone awareness must be explicitly enabled for cross-AZ replica placement |
| Ingestion pattern | Amazon Data Firehose → OpenSearch (native destination support) |
| Access control | VPC-only domain + fine-grained access control (role-based, index/field-level) |

### Decision table

| Requirement | Answer |
|---|---|
| "Log analytics, Kibana, full-text search" | OpenSearch Service |
| "Least operational overhead search cluster" | OpenSearch Serverless |
| "Employees ask plain-English questions about internal docs" | Amazon Kendra |
| "Occasional query of CloudWatch-resident logs" | CloudWatch Logs Insights |
| "Ad-hoc SQL over S3 data" | Athena |
| "Semantic/RAG search, fully managed end-to-end" | Bedrock Knowledge Bases (may use OpenSearch under the hood) |
| "Cluster unstable during scaling" | Add dedicated master nodes |
| "Index growing unbounded" | Rollover + ISM policy |
| "Security analytics/SIEM at scale" | OpenSearch (Security Analytics plugin) |

---

<a name="s8"></a>
## 8. Memory tricks

- **"M-D-I": Master decides, Data does, Ingest improves.** Master
  nodes decide cluster state, Data nodes do the actual work, Ingest
  nodes improve/enrich documents before they land.
- **"Odd masters avoid awkward ties."** An odd number of dedicated
  masters avoids split-brain during leader election — just like you
  need an odd number of judges to always get a majority verdict.
- **"Hot, warm, cold — just like your leftovers."** Hot = eat now
  (data nodes), warm = fridge (UltraWarm, cheaper, still reachable),
  cold = freezer (Cold storage, rarely touched, cheapest).
- **"Kendra answers questions, OpenSearch answers queries."** Kendra
  = plain English Q&A over documents. OpenSearch = you write the
  search/query logic yourself.
- **"Rollover = a fresh notebook page."** Once today's page (index)
  fills up, start a new one instead of cramming more onto the same
  page — keeps each page (shard) a manageable size.

---

<a name="s9"></a>
## 9. Per-service coverage checklist

**Purpose.** Managed, distributed search and analytics engine for
full-text search, log analytics, security analytics, and (via the
k-NN plugin) vector/semantic search.

**When to use.** Log analytics at scale with Kibana-style
visualization; application/e-commerce full-text search with relevance
ranking; security analytics/SIEM correlating events across many log
sources; semantic search or RAG retrieval when consolidating onto an
existing search platform.

**When NOT to use.** Occasional querying of data already resident in
CloudWatch Logs (Logs Insights is cheaper/simpler); ad-hoc SQL over S3
data with no search/relevance need (Athena); natural-language document
Q&A over enterprise content with minimal setup (Kendra); as a
system-of-record transactional database (it's a search/analytics
engine, not built for strict ACID transactional workloads).

**Advantages.** Near-instant full-text search at scale via inverted
indices; rich aggregation framework; native Kibana-compatible
dashboards (OpenSearch Dashboards); flexible storage tiering (hot/
warm/cold) for cost control on aging log data; vector search support
for modern semantic/RAG use cases; Serverless option removes cluster
management entirely.

**Limitations.** Requires real operational tuning at production scale
(shard sizing, node types, ISM policies) if self-managed on
provisioned clusters; not a transactional/relational database; data-
event-style question stems where CloudWatch/Athena/Kendra are simpler,
cheaper fits are common exam distractors; resharding an existing index
typically requires reindexing, making poor initial shard-sizing
decisions costly to fix later.

**Pricing considerations.** Provisioned: instance-hours per node type
plus EBS storage (and UltraWarm/Cold tier costs, which are
substantially cheaper per GB than hot data-node storage); Serverless:
billed on OCU consumption, scales with actual workload; data transfer
and snapshot storage (to S3) are additional considerations.

**Performance.** Search/index latency is typically single-digit to
tens of milliseconds at well-sized shard counts; performance degrades
with over-sized shards, over-sharding (too many small shards), or
insufficient replica distribution across nodes.

**Scaling.** Provisioned clusters scale by adding data nodes (and
resharding as needed) or by leveraging UltraWarm/Cold for aging data;
OpenSearch Serverless scales automatically with workload via OCUs.

**Security.** VPC-only domains avoid public internet exposure;
fine-grained access control provides role-based, index- and
field-level permissions on top of IAM/SAML identity; encryption at
rest (KMS) and in transit (TLS) should both be enabled; audit logging
tracks access at the cluster level.

**High availability.** Zone awareness distributes primary and replica
shards across multiple AZs; dedicated master nodes (odd count)
prevent split-brain and stabilize cluster-state management during
node failures or scaling events; automated snapshots to S3 provide
backup/restore capability.

**Failure scenarios.** A cluster without dedicated masters becomes
unstable under load exactly when scaling/failure recovery matters
most; a domain without zone awareness loses availability if a single
AZ fails; an unbounded, non-rolled-over index degrades query
performance as shard size grows past healthy limits; over-sharding
(many tiny indices/shards) wastes cluster overhead on coordination.

**Common mistakes.** Reaching for OpenSearch when a simpler/cheaper
tool (CloudWatch Logs Insights, Athena, Kendra) already answers the
requirement; skipping dedicated master nodes in production; leaving
zone awareness disabled; letting indices grow unbounded without
rollover/ISM; exposing a domain publicly instead of VPC-only with
fine-grained access control.

**Exam traps.** See Section 5 in full above.

**Real enterprise examples.** A ride-sharing company centralizes
application logs, VPC Flow Logs, and WAF logs into an OpenSearch
domain with an ISM policy moving data through hot/warm/cold tiers,
giving its security team near-real-time SIEM-style correlation
capability. An e-commerce retailer uses OpenSearch's full-text search
with relevance tuning to power its product search-as-you-type feature,
distinct from its transactional order data living in DynamoDB. A SaaS
company adds a k-NN vector field to its existing OpenSearch product
catalog index to power "find similar products" semantic search,
avoiding the operational cost of introducing a second, separate vector
database. A healthcare platform picks Kendra instead of building
custom OpenSearch relevance tuning, because its actual requirement was
plain-English Q&A over internal clinical policy documents, not
log/search analytics.

---

<a name="s10"></a>
## 10. Practice questions (15)

**Q1.** A company wants to occasionally search the last 30 days of
application logs that are already flowing into CloudWatch Logs, with
no need for Kibana-style dashboards or advanced relevance ranking.
What is the most cost-effective solution?

A) Stand up an OpenSearch domain and stream CloudWatch Logs into it
B) Use CloudWatch Logs Insights directly against the existing log
   groups
C) Use OpenSearch Serverless
D) Use Amazon Kendra

**Answer: B.** The data already lives in CloudWatch, and the
requirement is simple occasional search with no relevance ranking or
dashboarding need — Logs Insights answers this with zero additional
infrastructure. A) and C) introduce unnecessary operational and cost
overhead for a need CloudWatch already satisfies. D) Kendra is for
natural-language document Q&A, not structured log querying.

**Q2.** An OpenSearch cluster becomes unstable and slow to recover
whenever a node fails during a traffic spike. The cluster currently
runs master duties on the same nodes that handle data indexing and
queries. What is the recommended fix?

A) Add more data nodes only
B) Add dedicated master nodes, in an odd number (e.g., 3), separate
   from the data nodes
C) Disable zone awareness to reduce coordination overhead
D) Switch to a single, larger data node

**Answer: B.** Cluster-state management competing with data workload
on the same nodes is exactly the instability pattern dedicated master
nodes are designed to prevent; an odd count avoids split-brain during
leader election. A) doesn't address the root cause (master duties
still compete with indexing/query load). C) zone awareness protects
availability across AZs and disabling it would make things worse, not
better. D) reduces both resilience and parallelism.

**Q3.** A company's internal wiki, SharePoint site, and S3-stored PDFs
need to support employees asking plain-English questions like "what
is our expense reimbursement policy?" with minimal setup and tuning.
Which service best fits?

A) Amazon OpenSearch Service, with a custom relevance model
B) Amazon Kendra
C) Amazon Athena
D) CloudWatch Logs Insights

**Answer: B.** This is Kendra's purpose-built use case — natural-
language enterprise search over document repositories with managed ML
relevance and built-in connectors, requiring far less setup than
building the same experience in OpenSearch. A) would require
significant custom relevance tuning to achieve similar quality. C)
and D) are not natural-language document search tools at all.

**Q4.** A log-analytics OpenSearch cluster continuously ingests new
log data into a single index that has grown to an unhealthy shard
size, degrading query performance. What should be implemented?

A) Increase the number of replica shards
B) A rollover alias combined with an ISM policy to automatically
   create new indices at a size/age threshold and manage their
   lifecycle
C) Switch the cluster to OpenSearch Serverless
D) Delete the index and start over

**Answer: B.** Rollover plus ISM is the standard mechanism to prevent
unbounded index growth by automatically creating new indices at a
threshold and managing aging data through progressively cheaper
storage tiers. A) more replicas doesn't address oversized shards. C)
switching to Serverless doesn't inherently solve an indexing/rollover
design problem. D) is destructive and loses historical data
unnecessarily.

**Q5.** Which statement correctly distinguishes OpenSearch Serverless
from provisioned OpenSearch domains?

A) Serverless requires manual shard and node-type configuration;
   provisioned does not
B) Serverless automatically manages capacity and scaling via
   OpenSearch Compute Units (OCUs), removing cluster/node management;
   provisioned requires manual instance type, node count, and shard
   management
C) Provisioned domains cannot support vector/k-NN search;
   only Serverless can
D) Serverless is always cheaper than provisioned regardless of
   workload pattern

**Answer: B.** This correctly describes the operational and billing
distinction. A) reverses the actual roles. C) is false — both support
the k-NN vector engine. D) is the classic serverless-is-always-cheaper
trap; steady, large, predictable workloads can be cheaper on
provisioned capacity.

**Q6.** A production OpenSearch domain spans three data nodes but all
replica shards happen to land in the same Availability Zone as their
primary shard. What is missing from the configuration?

A) Dedicated master nodes
B) Zone awareness, which must be explicitly enabled to guarantee
   primary and replica shards are distributed across different
   Availability Zones
C) Ingest nodes
D) A rollover alias

**Answer: B.** Zone awareness is the specific setting controlling
cross-AZ shard placement; without it, an AZ failure can take down both
a primary and its replica simultaneously, defeating the purpose of
replication. A), C), and D) address different concerns (cluster
stability, document pre-processing, and index lifecycle, respectively).

**Q7.** A team wants to add "find visually/conceptually similar
products" search to an existing OpenSearch-powered product catalog,
without introducing a second specialized database. What capability
should they use?

A) OpenSearch SQL plugin
B) OpenSearch k-NN vector engine, indexing product embeddings and
   performing approximate nearest-neighbor search
C) A separate Amazon Aurora with pgvector
D) Amazon Kendra

**Answer: B.** Adding a k-NN vector field to the existing OpenSearch
index consolidates semantic search onto the platform the team already
operates, avoiding a second system. A) the SQL plugin supports
relational-style querying, not semantic similarity. C) works
technically but introduces exactly the second specialized system the
requirement wants to avoid. D) Kendra is document Q&A, not a general
vector-similarity search layer for a product catalog.

**Q8.** Which AWS service is most commonly used as the underlying
vector store for a fully managed Bedrock Knowledge Base, and how
should a candidate interpret a question emphasizing "fully managed RAG
with minimal build effort"?

A) DynamoDB; the answer is DynamoDB directly
B) OpenSearch Serverless is commonly used underneath Bedrock Knowledge
   Bases, but the higher-level, minimal-build answer to the question
   is Bedrock Knowledge Bases itself, not raw OpenSearch
C) Athena; the answer is Athena directly
D) RDS for PostgreSQL; the answer is RDS directly

**Answer: B.** Bedrock Knowledge Bases frequently use OpenSearch
Serverless as the vector store under the hood, but when a question
emphasizes minimal build effort and full management, the intended
top-level answer is the managed Bedrock Knowledge Bases service, not
manually building on raw OpenSearch. A), C), and D) are not the
standard vector-store pairing for this pattern.

**Q9.** What is the primary purpose of Ingest nodes in an OpenSearch
cluster?

A) They store the majority of index data
B) They manage cluster state and shard allocation
C) They run ingest pipelines to parse, enrich, or transform documents
   before indexing, offloading lightweight pre-processing from a
   separate upstream ETL step
D) They exclusively handle client-facing search API requests

**Answer: C.** Ingest nodes run pipelines that pre-process documents
before they're indexed — a lightweight, in-cluster transformation
step. A) describes data nodes. B) describes master nodes. D) is not
their defined role; data nodes serve search requests.

**Q10.** A financial services company must ensure its OpenSearch
domain, which holds transaction search indices, cannot be reached from
the public internet and enforces per-team, index-level access
restrictions. What should be configured?

A) A public endpoint with an IP-allowlist bucket policy
B) A VPC-only domain combined with fine-grained access control
   providing role-based, index-level permissions
C) OpenSearch Serverless with default network settings
D) IAM policies alone, with a public endpoint

**Answer: B.** VPC-only deployment removes public internet exposure
entirely, and fine-grained access control is the feature specifically
providing index-level (and field-level) role-based restrictions beyond
coarse IAM/network policy. A) and D) leave a public endpoint exposed,
which the requirement explicitly rules out. C) doesn't by itself
address either the network exposure or the index-level access
requirement without additional configuration.

**Q11.** Which of the following most accurately describes the
hot/warm/cold storage tiering in OpenSearch?

A) All three tiers cost the same; the distinction is purely
   organizational
B) Hot tier (data nodes) is for frequent read/write; UltraWarm
   (S3-backed) is cheaper for less-frequently-queried data; Cold
   storage is cheapest and detaches indices from active querying
   entirely, for long-term retention
C) Cold storage is the fastest and most expensive tier, reserved for
   the most frequently queried data
D) UltraWarm requires data to be re-ingested from source before it can
   be queried

**Answer: B.** This correctly describes the progressively
cost-optimized tiering, directly analogous to S3 storage class
tiering applied to search indices. A) is false — cost and access
characteristics differ significantly across tiers. C) inverts the
actual cost/performance relationship. D) UltraWarm data remains
queryable without re-ingestion, just at higher latency/lower cost than
hot storage.

**Q12.** A question describes a security team needing to correlate
authentication logs, VPC Flow Logs, and WAF logs across a large
organization to detect suspicious patterns, with a dashboard for
analysts to explore results interactively. Which service best fits?

A) Amazon Kendra
B) Amazon OpenSearch Service (with OpenSearch Dashboards and
   Security Analytics plugin capabilities)
C) Amazon Athena, queried manually each time
D) AWS Config

**Answer: B.** This is the canonical SIEM/security-analytics use case
OpenSearch is purpose-built for, including native dashboarding and
security-analytics plugin support for correlation and alerting. A)
Kendra is document Q&A, not log correlation. C) Athena could technically
query this data but lacks OpenSearch's purpose-built analytics/
dashboarding and interactive exploration experience for this use case.
D) AWS Config tracks resource configuration compliance, unrelated to
security log correlation.

**Q13.** What is the recommended approach to shard sizing in a
production OpenSearch index, and why does it matter?

A) Create as many small shards as possible for maximum parallelism,
   with no upper size concern
B) Target roughly 10–50 GB per shard; both over-sharding (too many
   small shards) and under-sharding (too-large shards) degrade
   performance, and resharding an existing index typically requires
   reindexing
C) Shard size is irrelevant as long as enough data nodes exist
D) Always use exactly one shard per index regardless of data volume

**Answer: B.** This captures both the target range and the operational
consequence — poor initial sizing is costly to fix later because it
usually requires a full reindex. A) over-sharding wastes coordination
overhead. C) understates the real performance impact of shard sizing.
D) a single shard per index caps parallelism regardless of node count
and doesn't scale for large or growing datasets.

**Q14.** Which delivery mechanism natively supports OpenSearch as a
destination, including built-in buffering, retry, and optional
Lambda-based transformation before indexing?

A) AWS DataSync
B) Amazon Data Firehose
C) AWS Transfer Family
D) AWS DMS

**Answer: B.** Amazon Data Firehose has native OpenSearch Service as
a supported delivery destination, commonly used for streaming log
ingestion pipelines. A) DataSync is for file/object transfer between
storage systems, not a log-streaming delivery mechanism to
OpenSearch. C) Transfer Family is for SFTP/FTPS file transfer. D) DMS
is for database migration/CDC, not log delivery to a search engine.

**Q15.** A company running a steady, 24/7, high-volume OpenSearch
workload with predictable traffic is evaluating Serverless versus
provisioned capacity purely on cost. What is the most likely correct
guidance?

A) OpenSearch Serverless is always cheaper regardless of workload
   pattern, so it should be chosen
B) For a steady, predictable, high-volume workload, provisioned
   capacity (potentially with Reserved Instance-style pricing where
   available) is often more cost-effective than Serverless's
   consumption-based OCU pricing, which carries a convenience premium
C) Cost is identical between the two options in all cases
D) Provisioned capacity cannot support workloads at this scale

**Answer: B.** This mirrors the same serverless-vs-provisioned
cost-tradeoff pattern tested elsewhere in the exam (e.g., Redshift
Serverless vs. provisioned): serverless convenience carries a premium
that isn't justified for steady, predictable, high-utilization
workloads, where provisioned capacity is typically the more
cost-effective choice. A) is the classic "serverless is always
cheaper" trap the exam specifically tests against. C) ignores real
pricing-model differences. D) is false — provisioned OpenSearch scales
to very large workloads.
