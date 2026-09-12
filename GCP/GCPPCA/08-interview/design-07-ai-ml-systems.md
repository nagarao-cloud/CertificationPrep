# Design Interviews — AI and ML Systems

> Seventeen whiteboard questions on the *intelligence* axis: can you
> build systems that learn and reason, safely and affordably? This file
> exists because AI system design is now a routine part of a Cloud
> Architect interview rather than a specialism — a 2026 Staff or
> Principal loop will spend a meaningful share of the design
> conversation here. Answers deliberately favour durable patterns over
> product specifics, because the products in this area change faster
> than the architecture does.

**How to use this file:** read one question at a time and answer it out
loud before reading past the clarifying-questions block. Where a claim
is about an *architectural pattern* it is stated plainly; where it
would be a claim about a specific current product capability, quota or
model, it is either kept generic or flagged with "verify current
capability before relying on this" — say the same thing in the room.
A panel forgives "I'd check the current limit"; it does not forgive a
confidently invented feature. Cross-references point at
`02-services/05-data-analytics-ai.md` for the Vertex AI service surface
and at `03-comparisons/` for the underlying matrices; this file
deliberately does not restate them.

## Question index

| ID | Question | Band | Axis | Domain leaves |
|---|---|---|---|---|
| D7-Q01 | RAG assistant over internal documentation, end to end | Staff | intelligence | 1.3, 1.5, 3.1 |
| D7-Q02 | Vector store selection for retrieval at scale | Staff | intelligence | 1.3, 2.2 |
| D7-Q03 | LLM inference serving — accelerators, batching, p99 budget | Staff+ | intelligence | 1.2, 4.3 |
| D7-Q04 | AI gateway and multi-model routing with fallback | Staff+ | intelligence | 1.3, 5.1 |
| D7-Q05 | Agentic system with tool calling and human-in-the-loop | Staff+ | intelligence | 1.5, 3.1 |
| D7-Q06 | The LLM threat model — injection, exfiltration, jailbreak | Staff+ | intelligence | 3.1, 3.2 |
| D7-Q07 | MLOps pipeline from training to staged deployment | Staff | intelligence | 2.3, 4.1 |
| D7-Q08 | Drift and production model-quality monitoring | Staff | intelligence | 6.1, 4.3 |
| D7-Q09 | AI evaluation architecture before every release | Staff+ | intelligence | 4.1, 5.1 |
| D7-Q10 | Fine-tune, RAG, prompt, or just use the foundation model | Principal | intelligence | 1.1, 1.5 |
| D7-Q11 | Training-data governance, lineage, consent and erasure | Staff+ | intelligence | 3.2, 4.2 |
| D7-Q12 | Regulated-AI architecture — classification, oversight, evidence | Principal | intelligence | 3.2, 4.2 |
| D7-Q13 | AI cost architecture — what drives spend and which levers exist | Staff+ | intelligence | 4.2, 4.3 |
| D7-Q14 | Multi-tenant AI platform on shared model serving | Staff+ | intelligence | 1.2, 3.1 |
| D7-Q15 | Real-time personalization — the serving path and its latency budget | Staff | intelligence | 1.2, 6.1 |
| D7-Q16 | Accelerator capacity strategy for training and serving | Staff+ | intelligence | 2.3, 4.3 |
| D7-Q17 | Migrating an on-prem ML platform to Vertex AI | Staff+ | intelligence | 1.4, 5.1 |

---

### D7-Q01 — "Support wants an assistant that answers from our own documentation. Design the whole thing, ingestion to answer."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 1.3, 1.5, 3.1 |
| **Axis** | intelligence |
| **Whiteboard time** | 45–55 min |
| **Reads well after** | `D7-Q02` |

**What the interviewer is actually testing**

Whether you understand that retrieval-augmented generation is a
*retrieval* system with a language model on the end, and that almost
every failure in production is a retrieval failure, a permissions
failure, or a grounding failure — not a model failure. The tell is
whether you spend more of your whiteboard on the ingestion half than
on the prompt.

**Clarifying questions to ask before drawing anything**

- **Who is allowed to see which documents?** First question, not last.
  Per-document access control means retrieval must filter by the
  caller's entitlements at query time, which reshapes the index
  design. If the whole corpus is company-readable I get a far simpler
  system, and I'd say so rather than build for a permission model
  nobody asked for.
- **How big is the corpus, how often does it change, what formats?**
  A slow-changing wiki and a ticket system writing thousands of
  updates an hour are different ingestion problems; change rate
  decides batch versus streaming.
- **What happens when the assistant is wrong?** If a wrong answer
  costs a customer a bad refund, I need citations, confidence gating
  and a refusal path. If it costs thirty seconds, I can be far more
  permissive and ship sooner.
- **Is this answering questions, or taking actions?** The moment it
  can write to a ticket or issue a credit this becomes `D7-Q05`'s
  problem and the blast-radius conversation changes entirely.
- **What concurrency, and what answer latency is acceptable?**
  Reranking, query expansion and larger context all buy quality with
  time. I want the budget before I spend it.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Answers must come from our own content | Stated | — | Rules out a bare foundation model; retrieval is the architecture |
| Per-document access control exists | Assumed | "I'll assume some docs are restricted — if the whole corpus is company-readable, tell me, because it removes a whole layer" | Forces ACL-filtered retrieval and per-caller identity in the request path |
| Answers must be attributable to a source | Assumed | "Support agents won't trust an answer they can't verify, so I'm treating citations as a functional requirement" | Adds a grounding/citation check before the response is returned |
| Corpus is refreshed continuously | Assumed | "Docs change daily, so I'll design ingestion as an incremental pipeline, not a rebuild" | Change-feed-driven ingestion, idempotent upserts keyed by source ID |
| Everything stays inside our perimeter | Stated | — | Private model endpoint, no third-party egress of prompts or documents |

**The answer, out loud**

I'd draw this as two pipelines that share one contract, and I'd start
with the offline one, because that's where the quality comes from.

The ingestion pipeline starts at a change feed, not a crawler — a
webhook, a modified-since query, a database change stream — so that
ingestion is an upsert keyed by a stable source identifier rather than
a periodic full rebuild. That one decision keeps the index fresh
without re-embedding everything nightly, and it's what makes deletion
work: when a document disappears at the source, the same pipeline
removes its chunks.

Then parsing, normalisation and chunking, which is where I'd spend
real design time. Structure matters more than people expect, because
headings, tables and code blocks are what survive chunking badly — a
table split across two chunks is worse than useless, it's confidently
wrong. So I'd chunk on semantic boundaries rather than a fixed
character count, with modest overlap, carrying the document title and
heading path into every chunk so one retrieved in isolation still says
what it is. If I had to name the single thing that most often makes a
RAG system mediocre, it's character-count chunking on a corpus that
has real structure.

Every chunk gets metadata before embedding: source system, document
ID, version, last-modified, and — the important one — the
access-control identifiers governing the source document. That's what
retrieval filters on later, and it has to be captured at ingestion
because you cannot reconstruct it from the text. Embedding then writes
into a vector index, which I'd treat as a cache and never a system of
record: fully rebuildable from source, because embedding models get
upgraded and when they do every vector is stale at once. I'd plan that
cut-over on day one rather than discover it under pressure. Which
store, and why, is `D7-Q02`.

The serving path is where the permission model gets enforced. The
request arrives with the caller's identity, and retrieval executes
with a filter derived from that identity's entitlements — under the
caller's permissions, not the pipeline's service account. The
alternative, retrieve everything then filter the answer, leaks:
the model has already read the restricted content and a determined
user can get it to paraphrase what it saw.

Retrieval itself I'd make hybrid — vector similarity plus lexical
search, because product names, error codes and version strings are
exactly where pure embeddings are weakest — then rerank a larger
candidate set down to the few chunks that go in the prompt.
Retrieving twenty and reranking to five beats retrieving five for the
price of a cheap model call. Prompt assembly is templated and
versioned, and the context budget is enforced in code: over budget, I
drop the lowest-ranked chunks whole rather than truncate mid chunk,
because a half-chunk is a hallucination generator.

The model call goes to a private endpoint, consistent with the pattern
already established for AI commentary in the Helicopter Racing League
architecture: not reachable from the internet, project inside a VPC
Service Controls perimeter. The access surface — perimeter design,
egress rules, partner access — is `D4-Q09`'s territory and I'd defer
to it rather than redesign it here.

Last, the grounding check, which is the part teams skip. Before the
answer returns I verify its claims are supported by the retrieved
spans and attach citations pointing at documents the user can open.
Where support is weak I don't hedge — I return "I don't have that in
our documentation" plus the closest sources. A refusal is a correct
output; an assistant that never refuses hallucinates instead, and
support stops trusting it within a week.

**Architecture**

```
  ══ INGESTION (offline, incremental) ═════════════════════════════

   source systems ──► change feed ──► parse, normalise,
   (wiki, tickets,      ◄── (1)       semantic chunking   ◄── (2)
    PDFs, code)                              │
                                             ▼
    vector index ◄── embed ◄── attach metadata: source,
      ◄── (4)                  version, ACL identifiers   ◄── (3)

  ══ SERVING (online, per request) ════════════════════════════════

   user question + caller identity
        ▼
   AI gateway: authN, tenant context, quota, request log   ◄── (5)
        ▼
   query rewrite / expansion                               ◄── (6)
        ▼
   hybrid retrieval: vector + lexical, ACL-filtered by
   the CALLER's entitlements                               ◄── (7)
        ▼
   rerank candidates, assemble prompt under an enforced
   context budget                                          ◄── (8)
        ▼
   model call, private endpoint inside the perimeter       ◄── (9)
        ▼
   grounding + citation check                              ◄── (10)
        │                            │
        ▼ supported                  ▼ unsupported
   answer + citations         "not in our docs" + nearest sources

  Cross-cutting: the index is rebuildable from source at any time, so
  it is a cache and never a system of record (11); every request logs
  question, retrieved chunk IDs, prompt version and model version so an
  answer can be reproduced and evaluated later (12).
```

**Every arrow explained:**

1. **Change feed, not a crawler** — incremental signals keyed by a
   stable source ID make ingestion an upsert and make deletion work.
   Without it a deleted document keeps answering questions until the
   next full rebuild, which is also the expensive alternative.
2. **Parse, normalise, chunk on structure** — sections rather than
   character counts, with overlap and the heading path prepended;
   boilerplate and near-duplicates filtered out here because they
   crowd out genuine matches later. Without it, tables and procedures
   split mid structure and produce confidently wrong answers rather
   than missing ones.
3. **ACL identifiers captured at ingestion** — entitlement travels
   with the chunk. Without it you cannot filter at query time, because
   entitlement is not recoverable from the text.
4. **Embed into the vector index** — the step that pins you to a model
   version; an embedding upgrade is an index rebuild with a cut-over,
   never an in-place migration. Which product fills this box is
   `D7-Q02`, and the pipeline shape doesn't change with it.
5. **AI gateway** — authenticates the caller, attaches tenant context,
   enforces quota, writes the request log. Same gateway as `D7-Q04`;
   here it is the identity source for callout (7).
6. **Query rewrite** — resolves conversational context into a
   standalone query. Fallback: if rewriting fails or times out,
   retrieval proceeds on the raw question rather than blocking.
7. **ACL-filtered hybrid retrieval** — vector plus lexical, filtered
   by the caller's entitlements. The wrong alternative, filtering the
   generated answer, leaks: the model has already read the text.
8. **Rerank and assemble under a budget** — over-retrieve, rerank,
   keep the top few. When the budget binds, low-ranked chunks are
   dropped whole; nothing is truncated mid chunk.
9. **Private model endpoint** — no internet path, project inside a
   VPC-SC perimeter, consistent with the Helicopter Racing League
   commentary pattern. Perimeter design belongs to `D4-Q09`.
10. **Grounding check and the refusal branch** — claims map to
    retrieved spans and citations resolve to documents the caller can
    open; where support is weak the answer is withheld in favour of
    "not in our documentation" plus nearest sources. A system that
    never refuses hallucinates instead.
11. **Index as cache** — full rebuild from source must always be
    possible, because an embedding upgrade invalidates every vector at
    once.
12. **Reproducibility logging** — question, chunk IDs, prompt version,
    model version. Without those four an evaluation suite (`D7-Q09`)
    can't be built and a production complaint can't be investigated.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Chunking | Semantic, heading-aware, with overlap | Fixed-size character chunks | Preserves tables and procedures, which are where wrong answers come from | When the corpus is genuinely unstructured prose of uniform density — then fixed-size is simpler and loses nothing |
| Retrieval | Hybrid vector + lexical, then rerank | Pure vector similarity | Exact tokens — error codes, versions, product names — are where embeddings are weakest | When the corpus is conceptual prose with no identifiers users quote verbatim, and the lexical half never fires |
| Permission enforcement | Filter at retrieval, under the caller's identity | Retrieve broadly, filter the answer | The model never sees text the caller can't see, so there's nothing to leak | When the entire corpus is uniformly readable — then filtering is pure overhead and I'd say so rather than build it |
| Freshness | Change-feed incremental upserts | Scheduled full rebuild | Deletions propagate, and cost scales with change rate, not corpus size | When the corpus is small and changes rarely — a nightly rebuild is less machinery to own |
| Ungrounded output | Refuse with nearest sources | Answer anyway with a hedge | A refusal is verifiable; a hedge is a hallucination with a disclaimer | When the use case is ideation or drafting, where a plausible starting point is genuinely useful and the user is the check |

**What a weak answer sounds like**

- "We'd put the documents in a vector database and ask the model." —
  that's one box of about nine, and it skips every part where quality
  and safety actually live.
- "The model has a big context window, so we'd just send all the
  documentation." — cost and latency scale with what you send, recall
  degrades as irrelevant material crowds the context, and you've
  removed the permission filter entirely.
- "We'd fine-tune the model on our docs so it knows them." — a
  fine-tune teaches style and format far more reliably than it teaches
  facts, and it can't be updated when a document changes this
  afternoon. See `D7-Q10`.
- "We'd add a disclaimer that answers may be inaccurate." — a
  disclaimer is not a control. The panel is listening for the
  grounding check and the refusal path.

**Common wrong turns**

- **Designing the prompt first.** It's the visible part, so it draws
  attention, and it's the least load-bearing. Recover by saying "let
  me put the ingestion path up first — the prompt is the last thing I'd
  tune."
- **Treating permissions as a later phase.** Retrofitting ACL-filtered
  retrieval means re-ingesting the entire corpus to capture metadata
  you didn't keep. Recover by adding ACL identifiers to the chunk
  metadata box while you're still drawing it.
- **Ignoring the embedding-upgrade path.** Teams discover it when a
  better model ships and the index must be rebuilt with no plan.
  Recover by naming the index a rebuildable cache.
- **No refusal path.** Every question gets an answer, so quality looks
  great in the demo and collapses in production. Recover by adding the
  unsupported branch explicitly.

**Follow-up probes the interviewer asks next**

1. **"Retrieval returns the right document but the answer is still
   wrong. Where do you look?"** — chunk boundaries first: the usual
   cause is a right document chopped so the relevant table sits half
   in each of two chunks. Then rerank order, then the instructions.
   The logged chunk IDs from (12) are how I'd check rather than guess.
2. **"Ten thousand documents becomes ten million. What breaks?"** —
   not the shape. The re-embed window, ingestion throughput, and
   precision, because near-duplicates multiply. Deduplication at
   ingestion and a stronger reranker come well before a different
   architecture.
3. **"Escalate: a user gets an answer citing a document they
   shouldn't be able to read. What's the blast radius?"** — every
   restricted document retrieved for anyone, because one path served
   them all. It's a data-disclosure incident: freeze the endpoint,
   use the request log to enumerate which chunk IDs went to which
   identities, then fix the filter. Callout (12) exists to make that
   enumeration possible rather than theoretical.
4. **"Who owns this in two years?"** — the team that owns the
   documentation, with the platform team owning the pipeline. If the
   assistant's owner isn't the corpus's owner, "the AI is bad" becomes
   an unassignable complaint.
5. **"It's useless for ticket history but great for the wiki.
   Why?"** — chunking and metadata: a ticket thread has the problem in
   the first message and the answer in the last. Chunk threads as
   problem-plus-resolution pairs, not flat text.
6. **"How do you know it got better after a change?"** — an offline
   set of real questions with known good sources, scoring retrieval
   hit rate separately from answer quality. Most regressions are
   retrieval regressions and mixing the scores hides them. `D7-Q09`.

**Cross-references**

- `D7-Q02` for the deferred vector-store decision; `D7-Q09` for
  proving a change improved it; `D7-Q13` for what this path costs.
- `D4-Q09` owns the access surface — private endpoints, VPC-SC around
  model serving, egress controls. This question owns what happens
  *inside* the request, not what the perimeter looks like.
- `02-services/05-data-analytics-ai.md` — Vertex AI platform surface
  including grounding; `04-architectures/case-study-helicopter-racing-
  league.md` — the private, VPC-SC-wrapped endpoint pattern callout
  (9) reuses.

---

### D7-Q02 — "Where do the vectors live? Walk me through the options and pick one."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 1.3, 2.2 |
| **Axis** | intelligence |
| **Whiteboard time** | 30–40 min |
| **Reads well after** | `D7-Q01` |

**What the interviewer is actually testing**

Whether "vector database" is a category you reason about or a product
you've heard of. The skill is recognising that the deciding factors
are rarely about vectors at all — they're about filtering, freshness,
joins to operational data, and who operates the thing at 3am.

**Clarifying questions to ask before drawing anything**

- **Does retrieval need to filter on structured attributes, and how
  selective are those filters?** Highly selective per-user or
  per-tenant filters are the single biggest differentiator between
  these options. Filtered vector search is a genuinely harder problem
  than unfiltered nearest-neighbour, and a design that ignores it
  looks fine until the filters get narrow.
- **How fresh must a new document be — seconds, minutes, or
  overnight?** Near-real-time visibility of new vectors pushes toward
  a store where the write path and the index are the same thing.
- **Does the vector lookup need to join operational data in the same
  query?** If the answer needs the user's entitlements, the document's
  current status and the vector match together, keeping vectors beside
  the relational data removes a whole class of consistency bugs.
- **What scale — thousands of vectors, or hundreds of millions?** This
  is the question people ask first and it matters least until you're
  well past the point where any of these work.
- **Who operates this, and do they already run a database?** A team
  that already runs PostgreSQL absorbs a vector extension almost for
  free. The same team standing up and tuning self-hosted index
  infrastructure is taking on a new on-call surface.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Retrieval filters by tenant and entitlement | Assumed | "I'll assume filters are narrow and per-caller, which is the hard case" | Filtered ANN behaviour becomes the primary selection criterion |
| New content must be searchable quickly | Assumed | "Minutes, not hours — tell me if overnight is acceptable, it changes the answer" | Favours stores where write and index are one path |
| The corpus is large but not extreme | Assumed | "Tens of millions of chunks, not billions" | Removes scale as the deciding factor and puts operability first |
| There is existing operational relational data | Stated | — | Makes co-locating vectors with that data a genuine option |
| Small platform team, existing PostgreSQL skills | Assumed | "I'll assume nobody wants a new datastore to operate" | Weighs heavily against self-hosting an index |

**The answer, out loud**

I'd frame this as four options and be explicit that I'm choosing on
operability and filtering, not on benchmark recall, because at the
scales most companies actually have, all four retrieve well enough.

The first option is a purpose-built managed vector index — Vertex AI
Vector Search. This is the right answer when the vector workload is
large, when it's the dominant access pattern, and when you want
someone else to own index build and serving. Its cost is that it's a
separate system: your vectors live apart from the data they describe,
so every filter attribute has to be duplicated into it, and every
consistency question between "the document" and "the vector for the
document" becomes yours. I'd reach for it when the corpus is large
enough that index management is a real job, and I'd be honest that
specific index types, filtering semantics and update latency in this
product move — verify the current capability before committing a
design to it in an interview or a review.

The second option is vectors inside PostgreSQL, which on Google Cloud
means AlloyDB with the `pgvector` extension. This is my default for
most enterprise RAG systems, and the reason is filtering and joins.
AlloyDB's established positioning in our own comparison material is a
PostgreSQL-compatible engine for demanding transactional workloads
with an analytical engine attached; adding vectors to that means a
single query can do the similarity search, the tenant filter, the
entitlement join and the freshness check in one place with normal
transactional semantics. A chunk and its metadata are written in the
same transaction, so there is no window where one exists without the
other. I'd hold the line that pgvector's index configuration matters —
you choose an index type and you trade recall against build time and
memory — and that this is a tuning exercise rather than a free
feature.

The third option is vector search inside BigQuery, right when the
vectors are an *analytical* asset rather than a serving one —
clustering support tickets, finding near-duplicate records, a nightly
similarity job over the warehouse. Doing that where the data already
lives avoids an export pipeline entirely. What I wouldn't do is put an
interactive per-request retrieval path in front of an engine built for
scanning rather than point lookups at conversational latency; that's
the same argument the storage comparison already makes, and vectors
don't change it.

The fourth option is self-hosting an open-source vector engine on GKE.
That's the exception needing a specific justification — an index type
you genuinely need and can't get otherwise, or a portability
requirement that forbids a managed service. Otherwise you've adopted a
stateful distributed system, with its own upgrade, backup, resharding
and on-call story, to solve a problem two managed options solve.

So my default is AlloyDB with `pgvector` for a retrieval system that
filters hard and sits next to operational data; Vector Search when the
corpus is large enough that index operations are the dominant cost and
filtering is coarse; BigQuery when the work is analytical and batch;
and self-hosted only with a named requirement that the others fail.

The thing I'd flag unprompted is the dimension nobody asks about:
re-embedding. Whatever store you choose, you will replace the
embedding model, and on that day every vector is stale at once. The
store that makes this easy is the one that lets you write a second
index alongside the first and cut over. I'd make that a selection
criterion, because it's the operation you'll perform under the most
pressure and the least planning.

**Architecture**

```
                        chunk + metadata + embedding
                                    │
        ┌───────────────┬───────────┴────────┬───────────────┐
        ▼               ▼                    ▼               ▼
  ┌───────────┐  ┌─────────────┐     ┌──────────────┐  ┌───────────┐
  │ Vertex AI │  │  AlloyDB    │     │  BigQuery    │  │ self-host │
  │  Vector   │  │ + pgvector  │     │ vector       │  │ on GKE    │
  │  Search   │  │             │     │ search       │  │           │
  └─────┬─────┘  └──────┬──────┘     └──────┬───────┘  └─────┬─────┘
        │               │                    │               │
     ◄── (1)         ◄── (2)              ◄── (3)         ◄── (4)
        │               │                    │               │
        ▼               ▼                    ▼               ▼
  separate store   same transaction    analytical scan   you own the
  from the data    as the metadata     over warehouse    index, the
  it describes     ◄── (5)             ◄── (6)           upgrade and
  ◄── (7)                                                the pager
                                                          ◄── (8)

        selection order, applied in this sequence:
        ┌──────────────────────────────────────────────┐
        │ 1. how selective are the filters?   ◄── (9)  │
        │ 2. how fresh must new vectors be?            │
        │ 3. does it join operational data?            │
        │ 4. only then: how many vectors?     ◄── (10) │
        └──────────────────────────────────────────────┘

  Cross-cutting: every option must support building a second index
  alongside the live one and cutting over, because an embedding-model
  upgrade invalidates all vectors simultaneously (11); the index is
  rebuildable from source in every case, so backup strategy is about
  rebuild time, not about data loss (12).
```

**Every arrow explained:**

1. **Vertex AI Vector Search** — managed index build and serving,
   strongest when the vector workload is the dominant access pattern
   and large. Specific index types, filter semantics and update
   latency are exactly the details that change release to release;
   verify current capability before relying on any of them.
2. **AlloyDB with `pgvector`** — my default. Vectors sit beside the
   relational data, so filters and entitlement joins are ordinary SQL
   and writes are transactional. AlloyDB's general positioning is
   established in `03-comparisons/02-storage-database-options.md`;
   this is that positioning extended to vectors, not a restatement.
3. **BigQuery vector search** — right when embeddings are analytical:
   clustering, deduplication, nightly similarity over the warehouse.
   Wrong as the interactive retrieval path for a conversational
   system.
4. **Self-hosted on GKE** — the exception. Justified by a specific
   index capability or portability requirement, not by preference.
5. **Transactional co-location** — chunk, metadata and vector written
   together means there is never a vector whose document has been
   deleted, which is otherwise a persistent source of ghost answers.
6. **Analytical scan model** — BigQuery's engine scans; that is its
   strength and the reason it's a poor fit for per-request retrieval
   at conversational latency.
7. **Separate-store consistency cost** — every filter attribute must
   be duplicated into the index and kept in sync. It's a real cost,
   and it's the main thing that makes a dedicated index feel heavy in
   a small system.
8. **Operational ownership** — self-hosting means owning upgrades,
   resharding, backups and the pager for a stateful distributed
   system. That's the whole tradeoff in one box.
9. **Filter selectivity first** — the ordering that matters. Narrow,
   per-caller filters are harder than raw scale and should decide the
   choice.
10. **Scale last** — the question everyone asks first. Below the point
    where index operations are a job, it shouldn't decide anything.
11. **Re-embed cut-over** — build alongside, evaluate, switch. Make it
    a selection criterion, because you will do it under pressure.
12. **Rebuildability** — the index is derived data, so the recovery
    objective is rebuild time, not durability. That simplifies DR here
    compared with a system of record.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Default store | AlloyDB with `pgvector` | Dedicated managed vector index | Filters, joins and transactional writes in one system the team already operates | When the corpus is large enough that index build and serving is a job in itself, and filters are coarse |
| Analytical embeddings | BigQuery vector search | Export to the serving index | Avoids an export pipeline for work that is batch by nature | When those same embeddings must also serve interactive requests — then serve from the operational store and keep BigQuery for analysis |
| Self-hosted engine | Avoid unless required | Run an open-source engine on GKE | Two managed options already cover the need without new on-call surface | When a specific index type or a hard portability requirement genuinely isn't available managed — name the requirement, don't assume it |
| Filtering strategy | Filter inside the retrieval query | Retrieve broadly, filter afterwards | Post-filtering silently destroys recall: you ask for ten and get two after filtering | When filters are almost never selective, so post-filtering removes nearly nothing — and even then, watch the tail |
| Index lifecycle | Rebuildable cache, cut-over on upgrade | In-place index migration | Embedding upgrades invalidate everything at once; in-place has no rollback | When the store genuinely supports versioned vectors side by side — verify that capability rather than assuming it |

**Making it concrete**

```bash
# Shape only: an AlloyDB cluster whose vectors live beside the rows
# they describe, so retrieval filters and entitlement joins are SQL.
gcloud alloydb clusters create rag-index \
  --project=PROJECT_ID --region=REGION --network=vpc-prod

# The extension is enabled per database; index type and its
# parameters are a recall-versus-build-time tuning exercise, and the
# available index types change — check current docs before fixing one.
psql -h ALLOYDB_HOST -U SERVICE_ACCOUNT_USER -d ragdb \
  -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

What the fragment is arguing is that there is no separate system in
this picture: the same database that holds the document metadata and
the entitlement tables holds the vectors, so the hard part of `D7-Q01`
— filtering retrieval by the caller's permissions — is a join rather
than a synchronisation problem.

**What a weak answer sounds like**

- "We'd use a vector database." — which one, and why, and what happens
  when the filter is narrow? The category isn't a decision.
- "It's about scale — how many vectors do we have?" — scale is the
  fourth question, not the first. Filtering and freshness decide this
  far more often.
- "We'll put them in BigQuery, all our data's there." — right for
  analytical similarity work, wrong as the interactive retrieval path;
  conflating the two is the specific mistake this question is probing.
- "Postgres with `pgvector` is basically free, just turn it on." —
  index type and parameters are a real tuning exercise with a recall
  cost if you get them wrong, and saying otherwise signals you haven't
  run it.

**Common wrong turns**

- **Choosing on benchmark recall.** Published benchmarks are
  unfiltered nearest-neighbour on synthetic data, which is not the
  workload. Recover by re-framing on filtered retrieval over your own
  corpus.
- **Forgetting post-filter recall collapse.** Asking for ten results
  and filtering afterwards can leave you with two. Recover by moving
  the filter into the query and saying why.
- **Treating the index as durable state.** It leads to backup and DR
  designs that protect derived data. Recover by naming it a cache with
  a rebuild-time objective.
- **Adopting a self-hosted engine for a feature nobody needs.**
  Recover by asking which specific capability is missing from the
  managed options — if the answer is vague, the requirement isn't
  real.

**Follow-up probes the interviewer asks next**

1. **"Filters are per-user and very narrow. Does your answer
   change?"** — it reinforces it. Narrow filters are where a
   co-located relational store is strongest, because the filter is an
   indexed predicate rather than something applied to an approximate
   result set.
2. **"The embedding model is being upgraded. Walk me through the
   day."** — build the new index alongside from source, run the
   retrieval evaluation set against both, cut reads over behind a
   flag, hold the old index for a full traffic cycle, then drop it.
   It's routine because callout (12) made the index derived data.
3. **"Escalate: the index and the source disagree — deleted documents
   are still being retrieved. How bad is that?"** — it's a disclosure
   incident, not a quality bug, because "deleted" often means
   "withdrawn for legal reasons." Blast radius is every caller who
   retrieved that chunk since deletion, which is why the request log
   from `D7-Q01` callout (12) is the first thing I'd query. The
   structural fix is transactional co-location or, failing that, a
   reconciliation job that treats source as truth.
4. **"Who owns the index — data team or application team?"** — the
   application team owns retrieval quality, the platform team owns the
   store. If the data team owns it because they own embeddings, nobody
   tunes it for the actual queries.
5. **"How would you know retrieval got worse after a change?"** — a
   fixed evaluation set scored on hit rate at a fixed k, run in CI,
   separate from any answer-quality score. Retrieval regressions are
   the most common and the easiest to catch, and mixing them into one
   blended quality number hides them.
6. **"What if the corpus is a hundred times bigger?"** — then index
   operations become a job: move to the managed index, accept the
   duplicate-metadata cost, pre-filter by partition before the vector
   search runs. I'd say that rather than defend the earlier choice.

**Cross-references**

- `03-comparisons/02-storage-database-options.md` — AlloyDB's
  positioning against Cloud SQL, Spanner and BigQuery; this question
  extends it to vectors and does not restate it.
- `D7-Q01` for the pipeline this store sits inside; `D7-Q13` for what
  the retrieval half contributes to overall cost.
- `02-services/05-data-analytics-ai.md` — BigQuery's analytical
  engine characteristics behind callout (6).

---

### D7-Q03 — "We serve our own model. Traffic is about to go up tenfold and p99 is already marginal. Design the serving tier."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 1.2, 4.3 |
| **Axis** | intelligence |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D7-Q04` |

**What the interviewer is actually testing**

Whether you know that generative inference is a fundamentally
different serving problem from ordinary request/response — variable
output length, sequential token generation, accelerator memory as the
binding constraint — and whether you can hold throughput and tail
latency apart instead of optimising one and reporting the other.

**Clarifying questions to ask before drawing anything**

- **Is the response streamed to a human, or consumed whole by another
  service?** Streaming makes time-to-first-token the number that
  matters and total generation time almost invisible. A
  service-to-service caller cares only about the total, which is a
  completely different optimisation.
- **What's the output-length distribution, not the average?** Serving
  capacity is set by the long tail — a workload where one request in
  fifty generates ten times the tokens will have its tail latency
  dictated by those, and averages will tell you nothing.
- **Is this one model or several, and must they be co-resident?**
  Accelerator memory is the scarce resource. Two models sharing a
  device is a different capacity plan from two pools.
- **Is any of this traffic actually batchable?** Work that doesn't need
  an answer this second belongs on a different path entirely, and
  moving it there is usually the largest single win available.
- **What is the real latency requirement, and who set it?** "As fast
  as possible" isn't a budget. I want a number tied to a user
  behaviour, because everything downstream — batching aggressiveness,
  quantization, how much headroom to hold — is a trade against it.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Tenfold traffic growth | Stated | — | Capacity model must be per-token, not per-request |
| Responses stream to end users | Assumed | "I'll optimise time-to-first-token; if a service consumes these whole, say so, it changes the batching" | Separates TTFT from total-generation objectives |
| A tail of very long outputs exists | Assumed | "Almost every generative workload has one — I'll design for it rather than the mean" | Forces output caps, admission control and tail-aware autoscaling |
| Some traffic is not interactive | Assumed | "Usually a third of it isn't — worth confirming, it's the cheapest win here" | Justifies splitting a batch path off the online tier |
| Accelerator supply is constrained | Assumed | "I'll assume we can't just add capacity on demand" | Makes utilisation and reservations a design concern (`D7-Q16`) |

**The answer, out loud**

The first thing I'd say is that the unit of capacity here isn't
requests per second, it's tokens per second, and those two only
correlate when output lengths are uniform, which they never are. So
the capacity model I'd build takes the input-token and output-token
distributions and derives concurrency from them, and everything else
follows from that.

Second, I'd split the traffic before I tune anything. Interactive
requests that a human is waiting on go to one tier with headroom and
conservative batching. Everything else — bulk summarisation,
backfills, offline enrichment — goes to a batch path that runs at high
utilisation and doesn't share a queue with the interactive tier.
Mixing them is the single most common cause of a tail-latency problem
that looks like a capacity problem: one large batch job fills the
queue and every interactive request behind it waits. Separating them
usually recovers more p99 than any accelerator change.

Third, batching, and this is where the intuition from ordinary
services misleads people. Generative inference wants requests batched
together on the device, because the alternative is an accelerator
mostly idle between sequential token steps. But naive fixed-size
batching — wait for N requests, then run — adds a queuing delay that
lands directly on p99. What you want is continuous batching, where
requests join and leave the running batch as they arrive and finish,
so nobody waits for a batch to fill and a long generation doesn't hold
short ones hostage. I'd treat "does the serving stack do continuous
batching" as a selection criterion, and I'd verify how the specific
managed or open serving stack implements it rather than assume.

Fourth, the accelerator. I'd choose on memory first, because the model
weights plus the per-request key-value cache have to fit, and the KV
cache is what actually limits concurrency — it grows with sequence
length times concurrent requests. Teams size for the weights, then
discover concurrency is capped far below what the device's raw
throughput suggested. After memory, I'd look at throughput per unit
cost for this specific model shape, measured on our own traffic, not
on a published benchmark. I'm deliberately not naming accelerator
generations here: the families and their availability change fast
enough that a specific recommendation ages badly, and I'd benchmark
the current options rather than quote one.

Fifth, quantization. Reducing weight precision buys memory and
throughput, and it costs some quality — how much depends entirely on
the model and the task, and it is not predictable from first
principles. So I'd treat it as an experiment gated by the evaluation
suite from `D7-Q09`, not as a configuration flag. The honest position
is that quantization is usually worth trying and sometimes worth
shipping, and that anyone who tells you the quality cost is negligible
without running your evaluation is guessing.

Sixth, autoscaling, which has to be driven by the queue, not by CPU.
Accelerator utilisation is a poor scaling signal because a saturated
device can still look busy at low throughput. I'd scale on pending
requests and on time-in-queue, with a floor sized to absorb the spike
that arrives while new capacity is still loading — and model load time
is long, so the scale-up lag is measured in minutes, not seconds. That
lag is the reason the floor exists and the reason predictive pre-scaling
matters for known traffic patterns, exactly as the Helicopter Racing
League architecture pre-scales ahead of a scheduled race rather than
reacting to it.

Last, admission control, because at ten times the traffic something
will eventually exceed capacity, and the choice is whether it degrades
or collapses. I'd cap maximum output tokens per request, enforce a
per-caller concurrency limit at the gateway, and shed load with a
clear retryable error rather than let the queue grow without bound. A
queue that grows without bound converts a capacity problem into a
timeout storm where every request fails after paying full cost.

**Architecture**

```
   callers (interactive)            callers (bulk/offline)
        │                                    │
        ▼                                    ▼
   AI gateway: per-caller quota,      batch submission API
   output-token cap, admission              │
   control                 ◄── (1)          ▼
        │                              queued batch jobs,
        ▼                              high utilisation,
   interactive serving pool            no shared queue with
   ┌──────────────────────────┐        the online tier   ◄── (2)
   │ continuous batching      │ ◄── (3)
   │ ├─ request joins/leaves  │
   │ │  the running batch     │
   │ └─ KV cache per request  │ ◄── (4)
   │ accelerator pool         │ ◄── (5)
   │ (chosen on memory first) │
   └───────────┬──────────────┘
               │
        ┌──────┴───────┐
        ▼              ▼
   stream first    autoscale on queue depth
   token to the    + time-in-queue, floor
   caller ◄── (6)  sized for load-time lag ◄── (7)

        overload path: shed with a retryable error
        rather than grow the queue           ◄── (8)

  Cross-cutting: capacity is modelled in tokens per second from the
  input/output length distributions, never in requests per second (9);
  quantization and any serving-stack change are gated by the evaluation
  suite in `D7-Q09` before they reach the interactive pool (10).
```

**Every arrow explained:**

1. **Gateway-enforced admission control** — per-caller concurrency
   limits and a hard cap on output tokens. Without the output cap, one
   pathological request occupies a slot for as long as it likes and
   the tail belongs to it. This is the same gateway as `D7-Q04`.
2. **Separate batch path** — bulk work runs at high utilisation on its
   own queue. The wrong alternative is one pool for everything, where
   a backfill job sets the interactive tier's p99.
3. **Continuous batching** — requests join and leave the running batch
   rather than waiting for a batch to fill. Fixed-size batching adds
   its wait directly to p99; verify how your chosen serving stack
   actually implements this rather than assuming it does.
4. **KV cache as the concurrency limit** — it grows with sequence
   length times concurrency, and it, not the weights, is usually what
   caps how many requests fit on a device.
5. **Accelerator chosen on memory first** — weights plus KV cache must
   fit before throughput matters. Deliberately not naming generations:
   families and availability move fast, so benchmark the current
   options on your own traffic rather than quoting a recommendation.
6. **Stream the first token** — for a human-facing caller, TTFT is the
   perceived latency and total generation time is nearly invisible.
   For a service-to-service caller none of this helps and the total is
   the only number.
7. **Queue-depth autoscaling with a floor** — accelerator utilisation
   is a poor signal; pending requests and time-in-queue are good ones.
   The floor exists because model load time makes scale-up lag
   minutes, so predictive pre-scaling beats reaction for known peaks.
8. **Shed, don't queue** — a bounded queue with a fast retryable
   rejection degrades; an unbounded one converts overload into a
   timeout storm where every request fails after paying full cost.
9. **Tokens-per-second capacity model** — requests per second only
   tracks capacity when output lengths are uniform, which they aren't.
10. **Evaluation gate on serving changes** — quantization, a stack
    upgrade or a batching change can move output quality. Gate them on
    the same suite that gates model changes.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Traffic split | Separate interactive and batch tiers | One pool, priority queue inside it | Physical separation is the only thing that reliably keeps a backfill out of the interactive tail | When batch volume is tiny and intermittent — then a priority queue costs less capacity than a second pool |
| Batching | Continuous batching | Fixed-size batch windows | Nobody waits for a batch to fill, and long generations don't hold short ones hostage | When requests are near-identical in length and arrive in bursts, where a fixed window is simpler and no worse |
| Accelerator selection | Memory first, then measured throughput | Fastest available device | KV cache, not raw compute, is what caps concurrency | When the model is small relative to any device's memory — then throughput per cost is the only axis that matters |
| Quantization | Try it, gate on evaluation | Ship it for the cost saving | Quality impact is model- and task-specific and not predictable in advance | When the task is highly tolerant — classification or routing rather than generation — and evaluation confirms no measurable loss |
| Overload behaviour | Bounded queue, shed with retryable error | Queue everything, let clients time out | Degradation stays legible and clients can back off | When requests are cheap and idempotent and the caller genuinely prefers waiting to retrying — rare in interactive paths |

**Making it concrete**

```hcl
# Shape only: the levers that matter are the autoscaling signal and
# the floor, not the machine type string. Accelerator families and the
# exact attribute names move — check current docs before copying.
resource "google_vertex_ai_endpoint" "inference" {
  name     = "inference-prod"
  project  = "PROJECT_ID"
  location = "REGION"
}

# Deployed model: a floor that absorbs the spike arriving while new
# replicas are still loading weights, not a floor sized for average
# load. Scale-up lag here is minutes, which is the whole argument.
# min_replica_count = <sized for the spike, not the mean>
# max_replica_count = <the budget guardrail from D7-Q13>
```

The comment is the point: in ordinary web serving a minimum replica
count is a cost decision, and here it's a latency decision, because
the thing you're hiding is model load time rather than container start
time.

**What a weak answer sounds like**

- "We'd autoscale on CPU." — accelerator workloads don't express
  saturation as CPU, and this scales late in both directions.
- "We'd use the biggest accelerator available." — capacity is bounded
  by memory for weights plus KV cache, and a device with more compute
  and the same memory changes very little.
- "We'd batch requests to improve throughput." — true and incomplete;
  which batching strategy is the entire question, and naive batching
  is a tail-latency regression sold as an optimisation.
- "Quantize it, the quality difference is negligible." — that's an
  empirical claim about a specific model and task, and stating it
  without an evaluation is the thing the panel is listening for.

**Common wrong turns**

- **Reporting the mean.** Averages hide exactly the behaviour that
  makes generative serving hard. Recover by asking for the output
  length distribution out loud.
- **One pool for interactive and batch.** It looks efficient and it
  imports the batch tail into the interactive path. Recover by
  splitting them on the whiteboard before tuning anything else.
- **Forgetting model load time.** Autoscaling policy that assumes
  seconds-to-ready under-provisions every spike. Recover by naming the
  floor as a latency decision.
- **Optimising the model before the queue.** Most tail-latency
  problems are queueing problems. Recover by fixing admission control
  and the batching strategy first, then touching the model.

**Follow-up probes the interviewer asks next**

1. **"p99 is bad but the accelerators are at 40% utilisation. What's
   happening?"** — almost certainly queueing from a batching strategy
   that waits, or head-of-line blocking behind long generations. Low
   utilisation with a bad tail is a scheduling problem, not a capacity
   one, and adding capacity won't fix it.
2. **"Ten times the traffic and you can't get more accelerators.
   What now?"** — in order: move everything batchable off the
   interactive path, cap output length harder, try quantization
   through the evaluation gate, then route the cheap task classes to a
   smaller model (`D7-Q04`). Capacity strategy itself is `D7-Q16`.
3. **"Escalate: the serving tier fails in one region. What's the blast
   radius and what do you do?"** — every interactive caller in that
   region, because endpoints are regional. The mitigation is a second
   regional deployment behind global routing with capacity headroom
   planned for the failover, and the honest cost is that headroom is
   idle accelerators. If we can't afford that, the real answer is a
   degraded mode — shorter outputs, a smaller model — not a promise of
   seamless failover.
4. **"Who owns the latency budget?"** — the product owner sets it, the
   serving team defends it, and it belongs in an SLO with an error
   budget like any other service. Without a named owner, "make it
   faster" is unbounded work.
5. **"How would you prove a serving change didn't hurt quality?"** —
   shadow the change on real traffic, score both outputs with the
   evaluation suite, then canary by traffic percentage. Serving
   changes get treated as model changes, because quantization and
   batching can both move outputs.
6. **"Would you self-host on GKE instead of a managed endpoint?"** —
   only for a specific reason: a serving stack the managed option
   doesn't support, or accelerator control I can't otherwise get. The
   default is managed, because self-hosting means owning model
   loading, batching, upgrades and the pager.

**Cross-references**

- `D7-Q04` for the gateway enforcing admission control here; `D7-Q13`
  for what this tier costs and which levers move it; `D7-Q16` for
  where the accelerators come from.
- `D6-Q11` owns Dataflow and general batch cost tuning — the batch
  path here is AI-specific and defers to it for the pipeline side.
- `02-services/05-data-analytics-ai.md` — Vertex AI endpoint
  behaviour, including regional scope and the provisioned-versus-batch
  cost shape.
- `04-architectures/case-study-helicopter-racing-league.md` — the
  pre-scale-ahead-of-a-known-event pattern behind callout (7).

---

### D7-Q04 — "We're calling three different models from six services. Design how that's governed."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 1.3, 5.1 |
| **Axis** | intelligence |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D7-Q03` |

**What the interviewer is actually testing**

Whether you recognise the shape of the problem — this is an egress
control point, the same pattern as an API gateway or a service mesh —
and whether you can resist making the gateway clever. The failure mode
at this level isn't missing the gateway; it's building routing magic
that nobody can reason about during an incident.

**Clarifying questions to ask before drawing anything**

- **Are all six services calling models for the same kind of work?**
  If some are doing classification and others are doing long-form
  generation, task class is a real routing dimension. If they're all
  doing the same thing, routing is just failover.
- **Is any model outside our perimeter?** A third-party foundation
  model reached over the internet changes the data-governance
  conversation completely, and that surface belongs to `D4-Q09`.
- **Who needs to see cost, and at what granularity?** Per-service is
  easy, per-tenant is a design constraint on the gateway's context
  handling, and per-feature usually means the callers have to send an
  attribution tag they'll forget to send unless it's mandatory.
- **What happens today when a model call fails?** If each service
  retries independently, there's a retry storm waiting to happen and
  centralising it is worth a lot on its own.
- **Do we need to change models without changing callers?** That's the
  strongest argument for the gateway, and if the answer is no, a
  shared client library may genuinely be enough.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Multiple models, multiple callers | Stated | — | Makes a single control point worth its operational cost |
| Cost must attribute to a team and a feature | Assumed | "Otherwise nobody can act on the bill" | Mandatory attribution tag on every request |
| A model version change must not require caller changes | Assumed | "This is usually the real reason a gateway pays for itself" | Version pinning and routing live in the gateway, not in callers |
| Prompts may contain regulated data | Assumed | "I'll assume yes until told otherwise, because the reverse assumption is unrecoverable" | Logging must be classified and redacted, not raw by default |
| There must be a way to stop everything | Assumed | "Every AI platform needs one switch someone can pull" | A kill switch and per-route disable are first-class features |

**The answer, out loud**

I'd build one gateway that every model call goes through, no
exceptions, and I'd fight hard for the no-exceptions part — a gateway
with a bypass is a logging system, not a control point.

What it does, in order of how much it's worth. First, identity and
attribution: it authenticates the calling workload, attaches the
tenant and feature tags, and rejects requests without them. That's
what makes `D7-Q13`'s cost story and `D7-Q14`'s tenant isolation
possible at all, and it's worth building even if the gateway did
nothing else.

Second, quota and rate limiting per caller, which is how one service's
runaway loop stops being everyone's outage. This is also where the
admission control from `D7-Q03` lives, because the gateway is the only
place that sees all the demand.

Third, routing by task class. I'd define a small set of named task
classes — classification, extraction, short generation, long-form
synthesis — and map each to a model, with the mapping in
configuration. A caller asks for a task class, not for a model. That
indirection is what lets us change models, run a comparison, or move a
class to a cheaper model without touching six services. And I'd
deliberately keep the routing table dumb: a static map, version
pinned, changed through code review. What I would not build is
automatic cost-aware routing that picks a model per request based on
predicted difficulty. It sounds appealing, it's very hard to evaluate,
and during an incident nobody can tell you which model served the
request that caused the complaint.

Fourth, fallback, and here I'd be careful. A fallback ladder — if the
primary errors or times out, try the secondary — is genuinely valuable
for availability, but it changes output quality silently, so every
response must carry which model actually served it, and the evaluation
suite has to cover the fallback path too. A fallback nobody evaluates
is an undetected quality regression that only fires during incidents,
which is exactly when you can least afford it. I'd also put a circuit
breaker in front of each route so a struggling model gets taken out
rather than retried into the ground.

Fifth, caching. Exact-response caching helps more than people expect
for repeated prompts — system-prompt-heavy classification traffic
especially — and it's a large lever in `D7-Q13`. Semantic caching,
where a similar-enough prompt returns a previous answer, I'd treat as
a per-use-case decision rather than a platform default, because
"similar enough" is a quality judgement and a wrong hit is a wrong
answer served fast.

Sixth, the guardrail hook: the gateway is where input and output
checks attach, so every caller gets them by default rather than by
diligence. What those checks are is `D7-Q06`.

And a kill switch — per route and global — that a single on-call
engineer can pull without a deploy. Every AI platform needs the
ability to stop, and if it requires a code change, it doesn't exist.

The tradeoff I'd name unprompted is that this gateway is now on the
critical path of six services, so it has to be boring: stateless,
horizontally scaled, minimal logic, its own SLO, and a client library
that fails fast rather than hanging. The failure I've seen is a
gateway that accretes features until it's the least reliable component
in a chain of otherwise reliable ones.

**Architecture**

```
   service A    service B    service C   ... six callers
       │            │            │
       └────────────┼────────────┘
                    ▼
   ┌─────────────────────────────────────────────┐
   │  AI GATEWAY (stateless, own SLO)            │
   │                                             │
   │  authN of the workload + mandatory          │
   │  tenant / feature attribution tags  ◄── (1) │
   │  per-caller quota + rate limit      ◄── (2) │
   │  guardrail hook (in and out)        ◄── (3) │
   │  exact-response cache               ◄── (4) │
   │  task-class → model routing table   ◄── (5) │
   │  circuit breaker + fallback ladder  ◄── (6) │
   │  kill switch, per route and global  ◄── (7) │
   └───────┬───────────────┬──────────────┬──────┘
           ▼               ▼              ▼
   private endpoint   private endpoint   a third-party
   model A (primary)  model B (cheap     foundation model
                      task classes)      via a governed
                                         egress path ◄── (8)

  Cross-cutting: every response carries which model and version served
  it, so a fallback is visible in the logs and in evaluation (9); the
  routing table is static configuration under code review, never a
  per-request prediction (10); classified request logging — redacted by
  default, raw only where a policy explicitly allows it (11).
```

**Every arrow explained:**

1. **Workload identity and mandatory attribution** — no tag, no
   service. This is the foundation of tenant isolation (`D7-Q14`) and
   of cost attribution (`D7-Q13`); retrofitting it means a period
   where the bill can't be explained.
2. **Per-caller quota** — one service's runaway loop stops being
   everyone's outage, and this is where `D7-Q03`'s admission control
   is enforced, because only the gateway sees total demand.
3. **Guardrail hook** — input and output checks attach once and apply
   to every caller by default. What they check is `D7-Q06`.
4. **Exact-response cache** — repeated prompts, especially
   system-prompt-heavy classification, return without a model call.
   Semantic caching is a per-use-case decision, not a default: a wrong
   hit is a wrong answer served quickly.
5. **Task-class routing table** — callers ask for a task class; the
   map to a model is static, version-pinned configuration. The wrong
   alternative is per-request predicted routing, which is unevaluable
   and unexplainable during an incident.
6. **Circuit breaker and fallback ladder** — takes a struggling route
   out rather than retrying into it, then falls back. What falls back:
   quality, silently, which is why (9) exists.
7. **Kill switch** — per route and global, operable by one on-call
   engineer without a deploy. If it needs a code change, it isn't a
   kill switch.
8. **Governed egress to a third-party model** — kept generic
   deliberately; the access surface, egress controls and partner
   governance are `D4-Q09`'s, not this question's.
9. **Model and version on every response** — makes fallback visible in
   logs and lets evaluation cover the fallback path rather than only
   the primary.
10. **Static routing under review** — a change to which model serves a
    task class is a reviewable change with an evaluation run attached.
11. **Classified logging** — prompts may contain regulated data, so
    redaction is the default and raw retention is an explicit,
    policy-backed exception (`D7-Q11`, `D7-Q12`).

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Control point | A gateway every call must traverse | A shared client library | A library is advisory; a gateway is enforceable, and quota and kill switch need a choke point | When there is exactly one calling service and one model — then a library is less machinery for the same effect |
| Routing logic | Static task-class map, version pinned | Per-request cost-aware model selection | Explainable during an incident and testable before one | When you have a mature evaluation harness and routing decisions can be replayed and scored offline — rare, and it's a platform product, not a feature |
| Fallback | Ladder plus circuit breaker, model reported | Fail fast to the caller | Availability without hiding what happened | When quality variance is unacceptable — a regulated decision path should fail rather than silently answer from a different model |
| Caching | Exact-match by default, semantic per use case | Semantic caching platform-wide | A wrong semantic hit is a wrong answer, and it's invisible | When the use case is tolerant and repetitive — FAQ-style traffic where near-duplicate questions genuinely deserve one answer |
| Gateway scope | Deliberately boring and minimal | A rich AI platform layer with orchestration | It's on six services' critical path and must be the most reliable component, not the least | When it genuinely becomes the product — then split orchestration into its own service and keep the gateway thin anyway |

**What a weak answer sounds like**

- "Each service can call the model directly, we'll standardise the
  client library." — nothing enforces quota, nothing attributes cost,
  and there's no switch to pull at 2am.
- "We'd route each request to the cheapest model that can handle it."
  — that's a research project presented as a config option; ask how
  it's evaluated and the answer is usually silence.
- "Fallback to the backup model automatically." — fine, but if the
  response doesn't say which model answered, you've built a silent
  quality regression triggered by incidents.
- "We'd log all prompts and responses for debugging." — into what,
  with what retention, classified how? This is the sentence that shows
  up later in a compliance finding.

**Common wrong turns**

- **Making the gateway smart.** Every clever feature is latency and
  failure modes on six services' critical path. Recover by moving
  orchestration out and leaving policy in.
- **Allowing a bypass "just for this one service."** The exception
  becomes the norm and the control point stops being one. Recover by
  making the exception a routing entry instead.
- **Skipping attribution tags at launch.** They can't be backfilled,
  so the first cost question is unanswerable. Recover by making the
  tag mandatory on day one, even if nobody reads it yet.
- **Treating fallback as free availability.** Recover by putting the
  fallback path into the evaluation suite and reporting the serving
  model on every response.

**Follow-up probes the interviewer asks next**

1. **"The gateway is down. What happens?"** — every AI feature in six
   services is down, which is why it's stateless, multi-zone, has its
   own SLO and a fail-fast client. I'd also make sure each caller
   degrades to a non-AI path where one exists, rather than blocking on
   a hanging call.
2. **"A team says the gateway adds latency they can't afford."** — I'd
   measure it, because the number is usually small relative to
   generation time, and if it genuinely isn't, the fix is making the
   gateway thinner rather than granting a bypass.
3. **"Escalate: someone routes a regulated workload to the third-party
   model by editing the routing table. How far does that go?"** —
   potentially every request of that task class, exported outside our
   perimeter, before anyone notices. So the routing table is
   policy-controlled code with review, routes are labelled by the data
   classes they may carry, and the gateway rejects a request whose
   data class isn't permitted on its route. That last check is the
   control; review alone is a process, not a control.
4. **"Who owns this gateway?"** — the platform team, with an
   explicitly named product owner, because routing changes are
   product decisions with cost and quality consequences and shouldn't
   be made by whoever is on call.
5. **"How do you roll out a new model version?"** — as a routing
   change behind a percentage split, with the evaluation suite run
   beforehand and quality metrics compared in production afterwards.
   Same discipline as any deployment; the gateway is what makes it a
   deployment rather than a code change in six repositories.
6. **"What would you cut if you had two weeks?"** — attribution,
   quota, kill switch, and the routing indirection. I'd drop caching,
   the fallback ladder and the guardrail hook, because those can be
   added behind an interface that already exists.

**Cross-references**

- `D7-Q03` for the admission control this gateway enforces; `D7-Q06`
  for what the guardrail hook actually checks; `D7-Q13` for the cost
  levers the gateway makes possible; `D7-Q14` for tenant context.
- `D4-Q09` owns the access surface, including how a third-party AI
  partner is reached and governed — callout (8) defers to it.
- `01-domains/DOMAIN-5-managing-implementation.md` §5.1 — API
  management patterns behind the gateway shape.

---

### D7-Q05 — "Make it an agent — it should actually do the work, not just answer. Design that."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 1.5, 3.1 |
| **Axis** | intelligence |
| **Whiteboard time** | 45–55 min |
| **Reads well after** | `D7-Q01` |

**What the interviewer is actually testing**

Whether you treat an agent as a distributed system that happens to be
driven by a model — with identity, authorisation, idempotency, budgets
and a trace — or as a prompt with tools attached. The specific thing
being probed is blast radius: the moment a model's output becomes an
action, every weakness in the model becomes a weakness in your
production systems.

**Clarifying questions to ask before drawing anything**

- **Which actions are reversible, and which aren't?** This single
  classification drives the whole design. Reversible actions can run
  autonomously; irreversible ones need approval or a compensating
  path. If nobody has classified the tools, that's the first work.
- **Whose authority does the agent act with?** Acting as the user
  bounds the damage to what that user could do anyway. Acting as a
  powerful service account means a prompt injection reaches everything
  that account can touch.
- **What does "done" look like, and who decides?** An agent without a
  termination condition and a step budget will loop, and the loop is
  expensive in both cost and blast radius.
- **How often is a human genuinely available?** Human-in-the-loop that
  nobody staffs becomes a queue that gets bulk-approved, which is
  worse than no gate at all because it manufactures evidence of
  oversight.
- **Is this one agent or several cooperating?** Multi-agent designs are
  fashionable and they multiply failure modes; I'd want a specific
  reason before drawing more than one.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| The agent takes real actions | Stated | — | Every model weakness becomes a production-system weakness |
| Some actions are irreversible | Assumed | "I'll assume refunds, external messages and deletions are in scope" | Forces an approval gate and a reversibility classification |
| Actions must be attributable to a person | Assumed | "Audit will ask who authorised this; 'the agent' isn't an answer" | Agent identity derived per-session, linked to the initiating user |
| Tools are existing internal APIs | Assumed | "I'd rather wrap existing APIs than build agent-specific ones" | Tool authorisation is enforced by the API, not by the prompt |
| There must be a stop | Assumed | "A running agent needs an abort that works mid-task" | Session kill switch and step/time/cost budgets |

**The answer, out loud**

I'd start by drawing the loop, because everyone draws the model and
forgets that the loop is the system: the agent proposes a tool call,
something executes it, the result is observed, and the loop repeats
until a termination condition. Everything interesting is in the
"something executes it" box.

The first design decision is identity. The agent runs under a
per-session identity derived from the initiating user, holding the
intersection of that user's permissions and the permissions the task
requires — never a standing, powerful service account. That's what
turns a successful prompt injection from a platform compromise into a
scoped one, and it's the reason auditors can answer "who authorised
this." It also means a tool call that the user couldn't have made
directly fails at the API, not at the prompt, which is where you want
authorisation decided.

Second, tools are ordinary APIs with their own authorisation, their
own validation, and their own rate limits. The tool description that
the model sees is documentation, not a security boundary — the model
will occasionally call things in ways the description didn't
anticipate, so every tool must be safe when called wrongly. I'd wrap
existing internal APIs rather than build agent-specific endpoints,
precisely because the existing ones already have authorisation and
validation that has survived contact with reality.

Third, the policy check between proposal and execution, which is the
part that makes this design defensible. Before any tool call runs, a
deterministic policy layer evaluates it: is this tool allowed in this
session, are the arguments within bounds, does this action's
reversibility class require approval, has the budget been exceeded?
That layer is code, not a prompt, because a guardrail implemented as
an instruction to the model is a suggestion.

Fourth, reversibility classification. I'd sort every tool into three
buckets and treat them differently. Read-only runs freely. Reversible
writes run autonomously but are recorded with enough detail to undo.
Irreversible actions — money leaving, messages to customers, deletions
— require either human approval or a compensating transaction that
genuinely works. And I'd insist the approval be meaningful: the
approver sees the proposed action, the reasoning and the evidence, in
a form they can actually evaluate, with a rate low enough that they're
still reading by the hundredth one. An approval queue that gets
bulk-approved is worse than nothing, because it produces an audit
trail suggesting oversight that didn't happen.

Fifth, budgets and termination. Every session gets a step budget, a
wall-clock budget and a cost budget, enforced outside the model. When
one is exceeded the session stops and escalates rather than
continuing. Loops are the characteristic agent failure: the agent
tries something, it fails in a way it doesn't understand, and it tries
again forever.

Sixth, idempotency. Retries happen — the model retries, the framework
retries, the operator retries — so every tool call carries an
idempotency key derived from the session and the step, and the
underlying API honours it. Without that, "retry the failed step"
becomes "issue the refund twice."

Seventh, state and the trace. Session state — the goal, the steps
taken, the observations, the current plan — lives in a durable store
outside the model context, so a session can survive a restart, be
inspected mid-flight, and be replayed afterwards. The full trace is
the audit artifact, and it's also the debugging artifact; agents fail
in ways that are impossible to diagnose from an output alone.

On multi-agent: I'd default to one agent with several tools. Splitting
into cooperating agents adds a coordination protocol, a failure mode
where they disagree, and a trace that's much harder to follow. I'd do
it when sub-tasks genuinely need different tool permissions — which is
a real reason, because it lets each sub-agent hold a smaller identity.

**Architecture**

```
   user goal + user identity
        ▼
   session start: derive a scoped session identity
   (user's permissions ∩ task's needs), open a trace   ◄── (1)
        ▼
   ┌───────────────── AGENT LOOP ─────────────────────────┐
   │                                                      │
   │  plan / next step  ◄── model call via the gateway     │
   │        ▼                                    ◄── (2)  │
   │  proposed tool call                                   │
   │        ▼                                              │
   │  POLICY LAYER (deterministic code, not a prompt)      │
   │   ├─ tool allowed in this session?          ◄── (3)   │
   │   ├─ arguments within bounds?                         │
   │   ├─ reversibility class → approval needed? ◄── (4)   │
   │   └─ step / time / cost budget left?        ◄── (5)   │
   │        │                     │                        │
   │        │ approved            │ needs a human          │
   │        ▼                     ▼                        │
   │  tool = existing API,   approval queue: action,        │
   │  its own authZ, its     reasoning and evidence         │
   │  own validation,        shown to a named approver      │
   │  idempotency key ◄──(6) ◄── (7)                        │
   │        │                     │                        │
   │        ▼                     ▼ approved / rejected     │
   │  observation ────────────────┘                         │
   │        │                                               │
   │        └──► durable session state + trace   ◄── (8)    │
   └──────────────────────────────────────────────────────┘
        ▼ termination condition met, budget exhausted,
          or kill switch pulled                   ◄── (9)
   result + full trace handed back

  Cross-cutting: the agent never holds a standing privileged service
  account; every action is attributable to the initiating user (10);
  tool descriptions are documentation, never a security boundary —
  every tool must be safe when called wrongly (11).
```

**Every arrow explained:**

1. **Scoped per-session identity** — the intersection of the user's
   permissions and the task's needs, minted per session and expiring
   with it. This is what converts a successful injection from a
   platform compromise into a scoped one.
2. **Model call through the gateway** — the agent is a caller like any
   other, so quota, attribution, guardrails and the kill switch from
   `D7-Q04` apply without special-casing.
3. **Deterministic policy layer** — allow-lists and argument bounds in
   code. A guardrail expressed as an instruction to the model is a
   suggestion; this is the control.
4. **Reversibility gate** — read-only runs free, reversible writes run
   autonomously with an undo record, irreversible actions require
   approval or a compensating transaction that actually works.
5. **Budgets** — step, wall-clock and cost, enforced outside the
   model. Exceeding one stops the session and escalates. Without
   these, the characteristic failure is an infinite retry loop.
6. **Tools as existing APIs with idempotency keys** — authorisation
   and validation are enforced by the API. The key derives from
   session plus step, so a retry doesn't issue the refund twice.
7. **Meaningful approval queue** — the approver sees the action, the
   reasoning and the evidence at a rate they can actually read. A
   queue that gets bulk-approved manufactures evidence of oversight
   that didn't happen, which is worse than no gate.
8. **Durable state and trace outside the model context** — sessions
   survive restarts, can be inspected mid-flight, and can be replayed.
   The trace is simultaneously the audit and the debugging artifact.
9. **Termination and kill switch** — the session ends on a condition,
   a budget, or a human stopping it mid-task. An agent you can't stop
   mid-task is an agent you shouldn't have started.
10. **No standing privilege** — every action attributable to the
    initiating user, which is the answer auditors need and the bound
    on the damage.
11. **Tool descriptions are documentation** — the model will call
    tools in ways the description didn't anticipate; safety lives in
    the tool, not in the text describing it.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Agent identity | Per-session, derived from the user, least privilege | A single agent service account | Bounds injection damage and makes actions attributable | When the agent operates on no user's behalf — a back-office automation — then a dedicated account with a narrow role is correct |
| Guardrails | Deterministic policy layer in code | Instructions in the system prompt | Instructions are suggestions; code is a control | Never as the only layer — but prompt-level instruction is still worth adding on top as a cheap first filter |
| Irreversible actions | Human approval or a real compensating path | Let the agent act, monitor afterwards | Detection after an irreversible action is a postmortem, not a control | When the action's cost is genuinely trivial and bounded, and the approval friction exceeds the expected loss |
| Topology | One agent, many tools | Several cooperating agents | One trace, one failure mode, one thing to debug | When sub-tasks need genuinely different permissions — then splitting lets each hold a smaller identity, which is a security win, not a capability one |
| State | Durable store outside the model context | Keep the conversation as the state | Survives restarts, can be inspected mid-flight and replayed | When sessions are short, stateless and cheap to restart from scratch |

**What a weak answer sounds like**

- "We give the agent an API key and a list of tools." — that's the
  design where one injected instruction reaches everything the key can
  do, and nothing in the trace says who authorised it.
- "We'll tell it in the system prompt not to do anything dangerous." —
  a prompt is not a control boundary; the panel is waiting to hear the
  deterministic layer.
- "A human reviews every action." — until there are four hundred a
  day, and then a human approves them in batches without reading. Say
  how the queue stays small enough to be real.
- "We'd use several specialised agents that talk to each other." —
  possible, but justify it with permissions rather than with elegance,
  and admit the debugging cost.

**Common wrong turns**

- **Designing the prompt and the tool list first.** It's the visible
  part and it's not the system. Recover by drawing the loop and the
  policy layer before anything else.
- **Giving the agent a powerful standing identity for convenience.**
  Everything works immediately and the blast radius is unbounded.
  Recover by deriving the session identity from the user.
- **No idempotency.** The first duplicated side effect is how teams
  find out. Recover by putting the key on the tool-call contract while
  you're still drawing it.
- **Treating human-in-the-loop as a checkbox.** Recover by naming the
  approval rate and what happens when it exceeds what a person can
  read — usually, the agent's autonomy is reduced rather than the
  reviewer's attention stretched.

**Follow-up probes the interviewer asks next**

1. **"The agent reads a document that contains instructions. What
   happens?"** — it will sometimes follow them, which is why retrieved
   content is untrusted input and the policy layer, not the model,
   decides what executes. The injection mechanics and the defences are
   `D7-Q06`; the structural answer here is that a successful injection
   still can't call a tool the session identity lacks.
2. **"How do you test this?"** — replayable traces plus a scenario
   suite that asserts on the sequence of tool calls, not on the text.
   Agent regressions show up as a changed action sequence long before
   they show up as a bad-looking output.
3. **"Escalate: the agent has been issuing incorrect refunds for six
   hours. Walk me through it."** — kill switch first, then enumerate
   from the trace every action in the window, use the undo records for
   the reversible ones and a reconciliation for the rest. Blast radius
   is bounded by the session identity's permissions and the per-session
   budgets — which is the argument for both. Then the harder question:
   was the policy layer wrong, or was the tool safe-when-called-wrongly
   assumption wrong?
4. **"Who is accountable for what the agent does?"** — the team that
   owns the tools, not the team that owns the model. If the model team
   is accountable for a refund, nobody is, because they can't change
   the refund API's rules.
5. **"When would you not build an agent?"** — when the task is a fixed
   sequence. If the steps are known in advance, a workflow with a
   model call inside one step is cheaper, faster, testable and
   auditable. Most "agent" requirements are workflows, and saying so
   is usually the most valuable thing in the room.
6. **"What does this cost?"** — multiples of a single call, because
   every step is a call plus growing context. The step budget is a
   cost control as much as a safety control, which is why it appears
   in `D7-Q13` too.

**Cross-references**

- `D7-Q06` for the injection threat model this design assumes;
  `D7-Q04` for the gateway every agent model call goes through;
  `D7-Q09` for scenario-based evaluation of tool-call sequences.
- `D4-Q09` owns the access surface around model serving; this question
  owns what the agent is allowed to *do* once inside.
- `02-services/05-data-analytics-ai.md` — the Vertex AI surface for
  grounding and agent tooling; capability boundaries there move, so
  verify current behaviour before designing around a specific feature.

---

### D7-Q06 — "Assume someone is trying to abuse this assistant. What's your threat model and what do you actually build?"

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 3.1, 3.2 |
| **Axis** | intelligence |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D7-Q01`, `D7-Q05` |

**What the interviewer is actually testing**

Whether you can name the threats specific to a model-driven system —
rather than reciting general application security — and whether you
understand the structural point: the model cannot reliably distinguish
instructions from data, so the defences that matter are the ones
outside it.

**Clarifying questions to ask before drawing anything**

- **Does the system ingest content the attacker can write?** Retrieved
  documents, ticket text, web pages, tool results. If yes, indirect
  injection is the primary threat and the user isn't the attacker —
  the content is.
- **Can the model's output cause anything to happen?** Rendered
  markdown, a followed link, a tool call, a downstream parser. Every
  one of those is an exfiltration channel, and if the output is only
  ever read by a human, the threat model shrinks a lot.
- **What's in the context that the user shouldn't see?** System
  prompts, other tenants' data, retrieved documents beyond the
  caller's entitlement. Anything in the context can end up in the
  output.
- **Who are we defending against — curious users, or a motivated
  adversary?** Employees probing an internal tool and an
  internet-facing assistant with a bug bounty need different budgets.
- **What's the worst thing a successful attack achieves?** If it's a
  rude answer, that's reputational. If it's reading another customer's
  records or moving money, the design changes completely.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Retrieved content is attacker-influenced | Assumed | "Anyone who can file a ticket can put text in our retrieval corpus" | Makes indirect injection the primary threat, not user prompts |
| Output is rendered in a UI | Assumed | "If markdown is rendered, links and images are an exfiltration channel" | Forces output-side egress control, not just input filtering |
| Context contains data the caller can't see | Stated | — | Any context content is potential output; entitlement must be enforced before retrieval |
| Some callers are external | Assumed | "I'll assume at least partner access eventually" | Raises the adversary model and the monitoring budget |
| Model behaviour cannot be guaranteed | Assumed | "No prompt makes a model reliably refuse; I'll design as if it can be talked into anything" | Every control that matters sits outside the model |

**The answer, out loud**

I'd open with the structural claim, because it determines everything
else: the model sees one undifferentiated stream of text, and
"instructions" versus "data" is a convention it follows most of the
time and not always. So I design as if any text that reaches the
context can become an instruction, and I put the controls where that
assumption doesn't matter.

The threats I'd name, in order of how much they actually happen.
Indirect prompt injection first: an attacker puts instructions in
content the system will later retrieve — a ticket, a document, a page,
a tool result — and the model acts on them. This is the dominant
threat because it doesn't require access to the interface at all.
Second, exfiltration through the output channel: the model is induced
to encode sensitive context into something that leaves — a URL in a
rendered link or image, an argument to a tool that calls out, or just
text the attacker later reads. Third, direct jailbreaking to get
prohibited content. Fourth, sensitive-data disclosure that isn't an
attack at all — the context simply contained something the caller
shouldn't see. Fifth, denial of wallet: an attacker who can trigger
expensive generations turns your budget into the target.

Now the defences, and I'd organise them as layers because no single
one holds.

At ingestion, I'd treat all retrieved content as untrusted data and
mark it structurally in the prompt — clearly delimited, labelled as
reference material, with instructions stated before it and the
standing rule that content inside it is never an instruction. I'd be
honest that this is mitigation, not prevention: it reduces success
rates and does not eliminate them. Anyone claiming their delimiter
scheme is a boundary is overselling it.

At the input, a classifier screening for known injection and jailbreak
patterns, applied at the gateway so every caller gets it. Same honesty
applies — pattern-based screening catches the unsophisticated majority
and misses novel attacks, so it buys noise reduction and telemetry,
not safety.

Identity and authorisation are where the real defence is, and they're
the reason `D7-Q01` filters retrieval by the caller's entitlements and
`D7-Q05` gives the agent a scoped session identity. If the model can
only ever see what the caller could see, injection can't disclose what
the caller couldn't already read. If a tool call requires permissions
the session doesn't hold, a successful injection still fails at the
API. That's a control, not a mitigation, and it's where I'd spend
first.

On the output side, the controls people skip. I'd apply a data-loss
check to outbound text for the classes that matter — secrets,
identifiers, other tenants' data. I'd enforce an egress allow-list for
anything the renderer will fetch or link: no remote images loaded from
model-supplied URLs at all, and links restricted to known domains,
because a rendered image URL is the cleanest exfiltration channel in
this whole design and it requires no user interaction. I'd verify
citations resolve to documents the caller is entitled to. And any tool
call the output implies goes through the deterministic policy layer,
never straight to execution.

Around all of it, detection and containment: per-caller rate and cost
limits so denial of wallet is bounded, canary strings placed in system
prompts and sensitive documents so that a leak is detectable when it
appears somewhere it shouldn't, full request logging under the
classification rules from `D7-Q11`, and the gateway kill switch.

I'd also say clearly what I'm *not* covering here. The network and
identity surface — private endpoints, VPC Service Controls around the
serving project, egress controls, how a third-party AI partner is
reached — is `D4-Q09`'s. My layer assumes that perimeter exists and
defends the content flowing through it. The two answers compose: their
perimeter stops the attacker reaching the endpoint, mine assumes the
attacker is already talking to it through a legitimate path.

**Architecture**

```
   attacker-writable content ──┐        end user request
   (tickets, docs, web, tool   │              │
    results)                   ▼              ▼
                        retrieval corpus   input screen:
                        (untrusted data)   injection/jailbreak
                              │            classifier      ◄── (1)
                              ▼                  │
   ENTITLEMENT FILTER: retrieval runs under the  │
   caller's permissions — context can never hold │
   what the caller couldn't read      ◄── (2)    │
                              └────────┬─────────┘
                                       ▼
                        prompt assembly: instructions first,
                        retrieved content delimited and
                        labelled as reference data  ◄── (3)
                                       ▼
                        model call (private endpoint)
                                       ▼
                        ┌──── OUTPUT CONTROLS ──────────────┐
                        │ data-loss scan on outbound text   │ ◄── (4)
                        │ egress allow-list: no model-       │
                        │ supplied remote images, links      │
                        │ restricted to known domains        │ ◄── (5)
                        │ citations must resolve, and to a   │
                        │ document this caller may read      │ ◄── (6)
                        │ implied tool calls → policy layer  │ ◄── (7)
                        └───────────────┬───────────────────┘
                                        ▼
                          response, or blocked + logged  ◄── (8)

  Cross-cutting: per-caller rate and cost limits bound denial-of-wallet
  attacks (9); canary strings in system prompts and sensitive documents
  make a leak detectable after the fact (10); the network and perimeter
  surface belongs to `D4-Q09` — this design assumes it and defends the
  content crossing it (11).
```

**Every arrow explained:**

1. **Input screening at the gateway** — catches the unsophisticated
   majority and generates telemetry. What falls back: a flagged
   request is refused with a generic message rather than an
   explanation that teaches the attacker what tripped. Honest
   limitation: pattern screening misses novel attacks and must never
   be the only layer.
2. **Entitlement-filtered retrieval** — the strongest control in the
   picture. If context can only hold what the caller could read,
   injection cannot disclose what they couldn't. This is `D7-Q01`
   callout (7), and it is why that design puts the filter in the query
   rather than after generation.
3. **Structural separation in the prompt** — instructions first,
   retrieved content delimited and labelled as reference data. What
   this is: a mitigation that lowers success rates. What it is not: a
   boundary. Do not present it as one.
4. **Outbound data-loss scan** — secrets, identifiers and
   cross-tenant markers checked on the way out. What's filtered: the
   response is blocked entirely rather than redacted in place, because
   partial redaction leaks structure.
5. **Output egress allow-list** — no remote images fetched from
   model-supplied URLs, links limited to known domains. A rendered
   image URL exfiltrates silently and needs no user action; this is
   the highest-value output control and the most commonly missing one.
6. **Citation verification** — every citation must resolve to a real
   document the caller is entitled to read. Catches both fabrication
   and the case where entitlement filtering failed upstream.
7. **Implied tool calls routed to the policy layer** — output never
   executes directly; `D7-Q05` callout (3) decides.
8. **Blocked-and-logged path** — a blocked response is a security
   event with the full request retained under the classification
   rules, not a silent failure.
9. **Rate and cost limits per caller** — bounds denial of wallet,
   enforced at the `D7-Q04` gateway because it's the only component
   that sees all demand.
10. **Canary strings** — planted in system prompts and sensitive
    documents so that a leak is detectable when the string appears
    outside. Detection after the fact is worth having when prevention
    is probabilistic.
11. **Perimeter deferred to `D4-Q09`** — private endpoints, VPC-SC,
    egress controls and partner access. The two designs compose:
    theirs keeps the attacker off the endpoint, mine assumes they
    reached it legitimately.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Primary defence | Entitlement-filtered context and scoped identity | Better prompts and stronger instructions | Controls outside the model hold when the model is talked into anything | Never as a substitute — but instruction-level hardening is still worth adding as a cheap extra layer |
| Input filtering | Classifier at the gateway, treated as telemetry | Rely on the model's own refusal behaviour | Centralised, observable, and doesn't depend on model behaviour staying constant across versions | When latency budget is extremely tight and the threat is low — then rely on output-side controls and accept more input noise |
| Output links and images | Deny remote fetch, allow-list domains | Render model output as-is | Rendered image URLs are a silent, zero-click exfiltration channel | When output is never rendered as rich content — a plain-text service-to-service consumer doesn't need this |
| Blocked responses | Refuse generically, log fully | Explain what was blocked and why | Detailed refusals teach the attacker the filter's shape | When users are internal and the support cost of opaque refusals exceeds the adversary risk |
| Scope of this design | Content-layer threats; perimeter deferred | One combined AI security answer | Two owners, two review cadences, no gap pretending to be coverage | When there is no separate security design — then say explicitly that you're covering both and name the perimeter controls too |

**Making it concrete**

```hcl
# The control that survives a successful injection is the identity,
# not the prompt. Blocking service-account key creation and pinning
# the serving project inside a perimeter are org-level, not app-level.
resource "google_folder_organization_policy" "no_sa_keys" {
  folder     = "folders/FOLDER_ID"      # folder holding AI workloads
  constraint = "constraints/iam.disableServiceAccountKeyCreation"
  boolean_policy { enforced = true }
}
```

The fragment is deliberately unglamorous: the highest-value control in
an AI threat model is the same least-privilege plumbing as everywhere
else, applied to identities that now take instructions from text.

**What a weak answer sounds like**

- "We'd add instructions telling the model to ignore injected
  commands." — a mitigation described as a control; the panel is
  waiting for what happens when it doesn't work.
- "We'd filter the input for malicious prompts." — necessary, far from
  sufficient, and it says nothing about the output channel, which is
  where the data actually leaves.
- "The model is hosted privately, so we're fine." — private hosting
  defends the endpoint, not the content. Indirect injection arrives
  through your own legitimate ingestion path.
- "We'd have a human review outputs." — at what volume, and reviewing
  for what? Exfiltration hidden in a URL is invisible to a reviewer
  reading for tone.

**Common wrong turns**

- **Defending only the input.** Most of the value is on the output
  side, because that's where data leaves. Recover by drawing the
  output controls box explicitly.
- **Treating delimiters as a boundary.** It's a mitigation with a
  success rate. Recover by saying so and pointing at the entitlement
  filter as the actual control.
- **Forgetting rendered content.** Markdown images and links are the
  cleanest exfiltration path in most assistants. Recover by adding the
  egress allow-list; it's cheap and it closes a zero-click channel.
- **Conflating this with the network perimeter.** It produces an
  answer that sounds broad and leaves the content layer undefended.
  Recover by naming the split and referencing `D4-Q09`.

**Follow-up probes the interviewer asks next**

1. **"Someone files a ticket containing instructions. The assistant
   later retrieves it. Walk me through what happens."** — the model
   may follow them. It cannot disclose anything outside the caller's
   entitlement because retrieval was filtered, it cannot call a tool
   the session identity lacks, and it cannot exfiltrate through a link
   because the egress allow-list blocks it. It can still produce a
   wrong or manipulated answer, and that's the residual risk I'd state
   rather than claim I'd eliminated it.
2. **"How do you know an injection succeeded?"** — canary strings,
   anomaly detection on output patterns, blocked-response telemetry,
   and user reports. I'd be honest that detection here is weaker than
   in most security domains, which is an argument for containment over
   detection.
3. **"Escalate: you find the assistant has been leaking another
   tenant's data for a week. What's the blast radius and what
   changes?"** — every request in the window, enumerable from the
   request log by tenant and chunk ID. The structural fix isn't a
   better filter — it's that shared context should never have held
   another tenant's data, which is `D7-Q14`'s isolation model. I'd
   also expect this to force a tenancy-tier conversation, because the
   customers involved will ask for dedicated serving.
4. **"Who owns AI security — the security team or the AI team?"** —
   the security team owns the threat model and the controls' design;
   the AI team owns implementing them in the request path. If security
   owns implementation they become a bottleneck, and if the AI team
   owns the threat model it drifts toward what's convenient.
5. **"The business wants to skip output scanning for latency. What do
   you say?"** — I'd separate the controls: the egress allow-list and
   citation check are microseconds and non-negotiable, the data-loss
   scan is the expensive one, and I'd scope it to the data classes
   present in that route's context rather than run it on everything.
6. **"How does this change if we adopt an agent?"** — the output
   channel becomes an action channel and the blast radius goes from
   disclosure to state change. Everything in `D7-Q05`'s policy layer
   becomes part of this threat model, and human approval on
   irreversible actions becomes a security control, not just an
   operational one.

**Cross-references**

- `D4-Q09` owns the AI workload's access surface — private endpoints,
  VPC-SC around model serving, third-party AI partner access, egress
  controls. This question owns the prompt and model threat model; the
  two are designed to compose and each should reference the other.
- `D7-Q01` callout (7) for entitlement-filtered retrieval; `D7-Q05`
  for the policy layer; `D7-Q14` for tenant isolation in context.
- `01-domains/DOMAIN-3-security-compliance.md` §3.1 — the securing-AI
  focus area this question expands; `02-services/05-data-analytics-ai.md`
  for the platform's own governance surface.

---

### D7-Q07 — "Draw me the path a model takes from a training run to production, and how it gets rolled back."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 2.3, 4.1 |
| **Axis** | intelligence |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D7-Q09` |

**What the interviewer is actually testing**

Whether you can apply deployment discipline to an artifact that isn't
code. The specific difficulty is that a model's correctness is
statistical, so "it passed the tests" means something weaker than it
does for software, and the pipeline has to compensate with staged
exposure and fast reversal.

**Clarifying questions to ask before drawing anything**

- **How often does this model change — weekly, or twice a year?** A
  weekly cadence justifies real automation; twice a year means the
  pipeline will be stale each time it runs, and I'd optimise for
  reproducibility over speed.
- **Is retraining triggered by schedule, by drift, or by a human?**
  Each implies a different trigger surface and a different
  approval point.
- **Can we compare against production before shipping — shadow or
  replay?** If yes, promotion becomes evidence-based. If not, the
  first real signal arrives after exposure and the canary has to carry
  much more weight.
- **How quickly does ground truth arrive?** Immediate feedback allows
  automated promotion gates; a label that arrives in ninety days means
  production quality is measured long after the decision.
- **Who is allowed to promote to production, and is that a person or a
  policy?** This is an organisational question disguised as a
  technical one, and the answer determines whether the pipeline is a
  pipeline or a ticket queue.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Models retrain regularly | Assumed | "I'll assume at least monthly — if it's yearly, I'd build less automation" | Justifies a pipeline rather than a documented procedure |
| Every production model must be reproducible | Stated | — | Data version, code version and config are pinned into the registry entry |
| Rollback must be fast | Assumed | "Minutes, and without a retrain" | Previous version stays deployed and serving-capable, not archived |
| Evaluation gates promotion | Assumed | "Otherwise the registry is a filing cabinet" | Evaluation results are an attribute of the registry entry |
| Training data may be regulated | Assumed | "Which makes lineage a compliance artifact, not a nicety" | Lineage capture is mandatory, not best-effort (`D7-Q11`) |

**The answer, out loud**

I'd draw it as five stages with two gates, and the thing I'd emphasise
is that the registry sits in the middle and is the only way into
production.

Stage one is the training pipeline, and its non-negotiable property is
reproducibility. Every run pins a data version, a code version, a
container image and a hyperparameter set, and emits them as metadata.
If a model in production can't be traced to the exact inputs that
produced it, then every compliance question and every debugging
question later is unanswerable. This is also where lineage capture
happens for `D7-Q11`'s purposes — recording which datasets, and
therefore which consent scope, contributed to this model.

Stage two is evaluation, and it's a gate rather than a report. The
candidate is scored on a held-out set, on slices that matter — by
segment, by cohort, by the cases we've been burned on — and against
the currently deployed model, not against an absolute threshold. The
question is "is this better than what's live," and slice scores matter
more than the aggregate, because an aggregate improvement that hides a
regression on a specific customer segment is exactly the failure that
reaches a regulator. For generative models the evaluation is a
different shape, and that's `D7-Q09`.

Stage three is the registry, which I'd treat as the equivalent of an
artifact repository with attestation. A model version exists in the
registry with its lineage, its evaluation results, its approval
status, and its deployment history. Nothing reaches production that
isn't a registry entry, the same way nothing reaches production
without passing through the artifact registry and Binary Authorization
on the container side. That symmetry is worth stating out loud because
it makes the ML pipeline legible to platform people who don't know ML.

Stage four is staged deployment. Shadow first where the model can be
called on real traffic without its output being used — that gives
production-distribution evidence at zero user risk, and it's the
cheapest confidence available. Then a canary on a small traffic slice
with quality and business metrics compared, then a progressive
rollout. I'd keep the previous version deployed and warm throughout,
because rollback that requires redeploying a model is measured in
whatever the model load time is, and that's the wrong thing to
discover during an incident.

Stage five is production monitoring, which is `D7-Q08`, and I'd draw
the arrow from it back to the training trigger, because that's the
loop: drift detected, retrain triggered, pipeline runs, gates
evaluate. Whether that loop closes automatically depends on how
quickly ground truth arrives — with fast feedback I'd let drift
trigger a training run automatically but never an automatic promotion.
Automated promotion is the line I wouldn't cross without a very mature
evaluation suite, because the failure mode is a bad model promoted
overnight on a metric that looked fine.

The one thing I'd flag unprompted: two artifacts have to be versioned
together and usually aren't. The model and the preprocessing or
feature transformation that feeds it are one unit. Deploying a model
against a different transformation than it was trained with is a
training/serving skew bug, it doesn't produce an error, and it's one
of the most common real ML outages. So they're one registry entry and
they're promoted together.

**Architecture**

```
   trigger: schedule | drift signal | human        ◄── (1)
        ▼
   TRAINING PIPELINE
   pins data version + code version + image +
   hyperparameters; emits lineage                  ◄── (2)
        ▼
   EVALUATION GATE
   held-out set, slice scores, compared against
   the CURRENTLY DEPLOYED model                    ◄── (3)
        │ pass                    │ fail
        ▼                         └──► stop, artifacts retained
   MODEL REGISTRY                      for comparison   ◄── (4)
   version + lineage + eval results + approval
   + deployment history; the only door to prod    ◄── (5)
        ▼
   STAGED DEPLOYMENT
   ├─ shadow on real traffic, output unused       ◄── (6)
   ├─ canary on a small traffic slice             ◄── (7)
   └─ progressive rollout, previous version kept
      warm and serving-capable                    ◄── (8)
        ▼
   PRODUCTION  ──► monitoring (`D7-Q08`) ──┐
        ▲                                   │
        └────────── retrain trigger ────────┘      ◄── (9)

  Cross-cutting: the model and its preprocessing/feature transformation
  are ONE versioned unit, promoted together (10); rollback is a traffic
  shift to the warm previous version, never a redeploy (11).
```

**Every arrow explained:**

1. **Trigger** — schedule, drift signal, or a human. Drift may trigger
   training automatically; it must never trigger promotion
   automatically, because the failure is a bad model promoted
   overnight on a metric that looked fine.
2. **Reproducible training run** — data, code, image and
   hyperparameters pinned and emitted. Without this, every later
   compliance and debugging question is unanswerable, and lineage for
   `D7-Q11` doesn't exist.
3. **Evaluation as a gate, compared to what's live** — slice scores
   over aggregate, because an aggregate win hiding a segment
   regression is the failure that reaches a regulator.
4. **Failed candidates retained** — the artifacts and scores stay, so
   the next attempt has a baseline and the failure is analysable.
5. **Registry as the only door** — the ML equivalent of an artifact
   registry with attestation; nothing deploys that isn't an entry with
   lineage, evaluation and approval attached.
6. **Shadow on real traffic** — production distribution, zero user
   risk, and the cheapest confidence available before exposure.
7. **Canary** — small traffic slice with quality and business metrics
   compared. What fails here: metrics that only move at volume, which
   is why progressive rollout follows rather than a jump to full.
8. **Previous version kept warm** — rollback is a traffic shift. If it
   requires a redeploy, recovery time includes model load time, and
   that's the wrong discovery to make mid-incident.
9. **Monitoring closing the loop** — drift detection feeds the trigger.
   How tight that loop is depends on how fast ground truth arrives.
10. **Model plus transformation as one unit** — deploying a model
    against a different transformation than it trained on is a skew
    bug that produces no error and is a common real outage.
11. **Rollback by traffic shift** — the reason for (8), stated as the
    property the design must preserve at every stage.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Promotion authority | Automated gates, human approval to production | Fully automated promotion on metric pass | Statistical correctness plus a human on the irreversible step | When retraining is very frequent, evaluation is mature, and rollback is genuinely instant — a recommender, not a credit decision |
| Evaluation baseline | Against the currently deployed model | Against a fixed absolute threshold | Prevents shipping a technically-passing regression | When there is no deployed model yet, or the threshold is externally mandated by a regulator |
| Pre-production evidence | Shadow, then canary | Canary only | Shadow gives production-distribution evidence at zero user risk | When the model has side effects that can't be shadowed — a call that writes, or a costly generation |
| Rollback | Warm previous version, traffic shift | Redeploy the prior registry entry | Recovery time excludes model load, which dominates | When models are small, load quickly, and the cost of idle warm capacity is not worth minutes of recovery |
| Model and transformation | One versioned unit | Version independently for flexibility | Eliminates a silent skew class that produces no error | When the transformation is genuinely shared across many models and is itself versioned and contract-tested |

**Making it concrete**

```bash
# The shape that matters: a registry entry carries lineage and
# evaluation, and deployment references the entry — never a file path
# in a bucket that someone can overwrite.
gcloud ai models list --project=PROJECT_ID --region=REGION

# Promotion is a traffic split against an endpoint that already has
# the previous version deployed and warm, so rollback is the same
# command with the percentages reversed.
# gcloud ai endpoints deploy-model ENDPOINT_ID \
#   --model=MODEL_ID --traffic-split=0=90,NEW=10
```

The commented rollback is the whole argument: if reversing a bad
promotion isn't the same operation with different numbers, the
pipeline has a recovery-time problem it hasn't measured.

**What a weak answer sounds like**

- "We'd retrain and redeploy the new model." — no gate, no registry,
  no staged exposure, and rollback is another retrain.
- "The data scientist hands over the model file." — a file has no
  lineage, no evaluation record and no reproducibility, and it will be
  in production for years.
- "We'd automate the whole thing end to end." — promotion included?
  That's the sentence to be careful with; automated training is good,
  automated promotion needs an evaluation suite most teams don't have.
- "We validate accuracy before deploying." — aggregate accuracy on
  which slices, against which baseline? The aggregate is where
  regressions hide.

**Common wrong turns**

- **Versioning the model but not the transformation.** Silent skew,
  no error, hard to diagnose. Recover by making them one registry
  entry while drawing.
- **Treating the registry as storage.** It's a policy surface: lineage,
  evaluation and approval are attributes, not attachments. Recover by
  naming what a registry entry must carry.
- **Rollback by redeploy.** Nobody measures it until the incident.
  Recover by keeping the previous version warm.
- **Skipping shadow because canary exists.** Shadow is the only stage
  with production distribution and zero risk. Recover by adding it;
  it's usually cheap.

**Follow-up probes the interviewer asks next**

1. **"Ground truth arrives ninety days late. Does the pipeline still
   work?"** — the stages do; the loop doesn't close on quality. I'd
   lean far harder on proxy signals and slice-level input monitoring
   (`D7-Q08`), keep more versions comparable for a retrospective, and
   accept that promotion decisions are made on weaker evidence — and
   say so rather than pretend the metric is timely.
2. **"A model passes every gate and is clearly worse in
   production."** — that's an evaluation-set problem, not a pipeline
   problem. I'd take the production failures into the evaluation set
   permanently, which is how the suite earns its coverage over time.
3. **"Escalate: a model has been making biased decisions for a month
   before anyone noticed. What broke and how far does it reach?"** —
   every decision in the window, and the reach includes downstream
   systems that consumed those decisions, which is usually worse than
   the model itself. What broke is slice monitoring: the aggregate
   looked fine. The fixes are slice-level gates before promotion and
   slice-level monitoring after, plus retained lineage so the affected
   population can actually be identified rather than estimated.
4. **"Who approves production promotion?"** — a named owner
   accountable for the model's business outcome, not the person who
   trained it and not a rotating on-call. If nobody's name is on it,
   promotion becomes whoever is available.
5. **"How would this look different for a fine-tuned generative
   model?"** — the same five stages, but the evaluation gate changes
   completely: no held-out accuracy, instead the evaluation suite from
   `D7-Q09`. The registry, staged deployment and warm rollback are
   unchanged, which is the point of drawing it this way.
6. **"What would you cut with half the time?"** — the shadow stage and
   the automation around triggers. I'd keep reproducibility, the
   registry, the evaluation gate and warm rollback, because those four
   are what make the system recoverable.

**Cross-references**

- `D7-Q08` for the monitoring that closes the loop; `D7-Q09` for what
  the evaluation gate contains for generative models; `D7-Q11` for
  what lineage capture is compliance-load-bearing for.
- `D3-Q11` owns the feature store's data side — offline/online split,
  freshness and training/serving skew. Callout (10) is the deployment
  consequence of that skew, not a restatement of it.
- `02-services/05-data-analytics-ai.md` — Vertex AI Pipelines, Model
  Registry and Model Monitoring surfaces; `01-domains/DOMAIN-4-
  analyzing-optimizing.md` §4.1 for the surrounding SDLC framing.

---

### D7-Q08 — "The model is up and serving. How do you know it's still any good?"

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 6.1, 4.3 |
| **Axis** | intelligence |
| **Whiteboard time** | 30–40 min |
| **Reads well after** | `D7-Q07` |

**What the interviewer is actually testing**

Whether you can distinguish "the service is healthy" from "the model
is correct" — they're different systems with different signals — and
whether you'll commit to a paging policy. Most candidates list metrics;
few say which one wakes someone up, and that's the question.

**Clarifying questions to ask before drawing anything**

- **How long until we know an individual prediction was right?**
  Seconds, days, or never. This one answer determines whether quality
  monitoring is direct or entirely proxy-based.
- **What business metric does this model actually move?** If nobody can
  name it, the model has no failure definition, and everything else is
  statistics without consequence.
- **Is there a non-model baseline to compare against?** A holdout that
  gets the previous model or a rule-based path is the cleanest way to
  detect degradation, and it costs a slice of traffic.
- **What does the model do when it's wrong — fail loudly or quietly?**
  A recommender degrades invisibly; a fraud model degrades into
  customer complaints. The second one has a free signal.
- **Who is on call for this, and what can they do at 3am?** If the only
  remediation is retraining, then paging on drift is pointless — the
  page should fire on things a human can act on now.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Ground truth is delayed | Assumed | "Assume days, not seconds — say if it's immediate, it changes the paging policy" | Proxy signals carry the alerting load |
| A business metric exists | Assumed | "If we can't name it, we can't define failure" | Anchors the top of the signal hierarchy |
| Rollback is available | Stated | — | Makes paging actionable: the 3am action is a traffic shift |
| Slices matter, not just aggregate | Assumed | "Aggregate metrics hide exactly the failures that matter most" | Monitoring is per-segment from day one |
| On-call is generalist, not ML | Assumed | "Nobody retrains a model at 3am" | Only actionable signals page; drift files a ticket |

**The answer, out loud**

I'd separate the signals into four layers and be explicit that only
two of them page.

The bottom layer is service health — latency, error rate, saturation,
availability. This is ordinary SRE and it pages, because a broken
endpoint is a broken endpoint and the on-call action is obvious.
Nothing about this is ML-specific except that saturation is measured
in tokens or queue depth rather than CPU (`D7-Q03`).

The second layer is input monitoring: is the data arriving at the
model shaped like the data it was trained on? Feature distributions,
null rates, category cardinality, and for a generative system the
distribution of request types and input lengths. This is the earliest
available warning and it's the one that catches the most common real
failure, which isn't the model degrading at all — it's an upstream
pipeline change. A renamed field, a units change, a new enum value.
That's a pipeline incident wearing a model costume, and input
monitoring finds it in minutes rather than weeks.

The third layer is output monitoring: prediction distribution drift,
confidence distribution, refusal rate, and for generative systems the
signals specific to that shape — groundedness scores on a sample,
citation-resolution failure rate, guardrail block rate, response
length distribution, and the fallback rate from `D7-Q04` which tells
you when you're quietly serving a different model than you think.

The fourth layer is outcome: the business metric, plus ground-truth
accuracy whenever labels arrive, plus human feedback signals — thumbs,
escalation rate, agent overrides. This is the only layer that measures
what you actually care about, and it's the slowest.

Now the paging policy, which is the part the question is really about.
Service health pages. A sharp break in the business metric pages,
because the on-call action is real: shift traffic back to the previous
version. Everything else files a ticket with an owner and an SLA.
Drift does not page, because at 3am nobody can act on it — and a page
nobody can act on trains people to ignore pages. I'd rather have a
drift dashboard that gets reviewed on a schedule and a drift threshold
that automatically opens a retraining ticket.

On thresholds, I'd resist static ones. Distributions move seasonally
and a fixed threshold either fires constantly or never. I'd compare
against a trailing baseline and alert on sustained deviation rather
than instantaneous, the same way a good SLO alert uses burn rate over
a window rather than a single bad minute.

Everything is computed per slice, not just in aggregate, because the
aggregate is precisely where a serious failure hides — a model that
degrades badly for one customer segment while overall metrics stay
flat is both the most damaging failure and the least visible one.

And I'd insist on one thing that isn't a metric: a fixed set of
canary inputs run against production continuously, with outputs
compared to known-good. For a generative system especially, this is
the cheapest way to notice that behaviour changed — because the
provider updated something, because a configuration drifted, because
the fallback route is active. It's a synthetic check for model
behaviour, and it's the closest thing to an uptime check that a model
has.

**Architecture**

```
   production traffic
        │
        ├──────────────► L1 SERVICE HEALTH
        │                latency, errors, saturation,
        │                queue depth                      ◄── (1)  [PAGE]
        │
        ├──────────────► L2 INPUT MONITORING
        │                feature distributions, null rate,
        │                cardinality, request mix          ◄── (2)  [ticket]
        │
        ├──────────────► L3 OUTPUT MONITORING
        │                prediction/confidence drift,
        │                refusal + guardrail block rate,
        │                groundedness on a sample,
        │                fallback rate from the gateway    ◄── (3)  [ticket]
        │
        └──────────────► L4 OUTCOME
                         business metric, ground truth
                         when labels arrive, human
                         feedback + override rate          ◄── (4)  [PAGE
                                                                   on break]
   synthetic canary inputs ──► production ──► compare to
   known-good outputs, continuously                        ◄── (5)  [PAGE]

   every signal computed PER SLICE, not only in aggregate   ◄── (6)
   thresholds are trailing-baseline deviation, sustained
   over a window — never a fixed absolute number            ◄── (7)

   sustained L2/L3 deviation ──► retraining ticket ──► `D7-Q07`
                                                            ◄── (8)

  Cross-cutting: only signals with a 3am action page — the action is a
  traffic shift to the warm previous version, never "retrain" (9); a
  model can be perfectly healthy at L1 and badly wrong at L4, which is
  why these are four systems and not one dashboard (10).
```

**Every arrow explained:**

1. **Service health** — ordinary SRE signals, pages like any service.
   The only ML-specific part is that saturation is queue depth and
   tokens rather than CPU (`D7-Q03` callout 7).
2. **Input monitoring** — the earliest warning, and the one that
   catches the most common real failure: an upstream pipeline change,
   not model degradation. A renamed field or a units change is a
   pipeline incident wearing a model costume.
3. **Output monitoring** — distributions, refusal and guardrail block
   rates, sampled groundedness, and the gateway's fallback rate, which
   is how you learn you've been serving a different model than you
   thought.
4. **Outcome layer** — the only signals that measure what you care
   about, and the slowest. A sharp break pages because the action is
   real: shift traffic back.
5. **Synthetic canary inputs** — fixed inputs run continuously against
   production and compared to known-good outputs. The nearest thing a
   model has to an uptime check, and the cheapest detector of "the
   behaviour changed and nothing in our config did."
6. **Per-slice computation** — the aggregate is where the most damaging
   failures hide. A segment-level collapse with flat overall metrics
   is both the worst outcome and the least visible.
7. **Trailing-baseline thresholds** — distributions move seasonally.
   Fixed thresholds either fire constantly or never; sustained
   deviation over a window is the analogue of SLO burn-rate alerting.
8. **Drift opens a ticket, not a page** — with an owner and an SLA,
   feeding the retraining trigger in `D7-Q07` callout (1).
9. **Actionability rule** — a page with no 3am action trains people to
   ignore pages, which then costs you the pages that mattered.
10. **Four systems, not one dashboard** — healthy at L1 and wrong at
    L4 is the normal state of a failing model, and a combined view
    hides it.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| What pages | Service health, business-metric break, canary failure | Page on drift too | Pages must have a 3am action; drift's action is retraining, which isn't one | When the team runs a fully automated retrain-and-canary loop that a human genuinely triggers at any hour |
| Thresholds | Trailing baseline, sustained deviation | Fixed absolute thresholds | Distributions move seasonally; fixed numbers fire constantly or never | When there's a regulatory floor — then the absolute threshold is the requirement, and you alert on both |
| Granularity | Per-slice from day one | Aggregate first, slice later | Segment collapse under a flat aggregate is the most damaging and least visible failure | When slices are so numerous that per-slice alerting is pure noise — then alert on aggregate and review slices on a schedule |
| Quality signal | Proxies plus sampled evaluation, labels when they come | Wait for ground truth | Delayed labels mean degradation runs for the label period before you see it | When labels arrive within minutes — then measure directly and treat proxies as secondary |
| Behaviour change detection | Continuous synthetic canaries | Rely on production metrics | Catches provider-side and configuration changes that production metrics average away | When outputs are so variable that canary comparison is meaningless — then invest in sampled evaluation instead |

**What a weak answer sounds like**

- "We'd monitor accuracy in production." — with which labels, arriving
  when? For most systems this sentence describes something that
  doesn't exist yet.
- "We'd alert on data drift." — page or ticket? If the answer is page,
  ask what the on-call does with it at 3am.
- "Cloud Monitoring gives us all the metrics." — it gives you L1. The
  other three layers are things you have to define and emit.
- "Users will tell us if it gets worse." — sometimes true and always
  late, and for a recommender it's never true because nobody reports
  a slightly worse recommendation.

**Common wrong turns**

- **Monitoring the aggregate only.** Everything looks fine while one
  segment collapses. Recover by adding the slice dimension
  immediately; it's a labelling decision, not new infrastructure.
- **Paging on drift.** It feels responsible and it desensitises the
  rotation. Recover by moving drift to a ticket with an owner.
- **Assuming degradation means the model.** Most often it's upstream
  data. Recover by putting input monitoring before output monitoring
  in the answer, which is also the order they fire in.
- **No baseline to compare against.** Without a holdout or a previous
  version, "worse" has no referent. Recover by proposing a small
  holdout slice and naming its cost.

**Follow-up probes the interviewer asks next**

1. **"Drift fires but the business metric is fine. What do you do?"** —
   nothing urgent. Drift is a leading indicator, not a failure; the
   world changed and the model still works. I'd note it, watch the
   slices, and let it inform retraining cadence rather than trigger an
   incident.
2. **"The business metric drops and no model signal moved."** — then
   it's probably not the model, and the fastest way to prove it is the
   holdout slice: if the non-model path dropped too, the cause is
   elsewhere. That's the single strongest argument for keeping a
   holdout.
3. **"Escalate: the model has been degraded for three weeks and the
   first signal was a customer complaint. How bad?"** — every decision
   in three weeks, including downstream systems that consumed them,
   and a credibility cost that outlives the fix. Structurally it means
   L2 and L3 either weren't instrumented or weren't reviewed, and the
   fix is a scheduled review with a named owner — an unreviewed
   dashboard is the same as no dashboard.
4. **"Who owns model quality?"** — the team that owns the business
   outcome, with the platform team owning the instrumentation. If
   quality is owned by whoever trained it, ownership evaporates when
   they change teams.
5. **"How do you monitor a generative system where there's no
   accuracy?"** — groundedness and citation-resolution on a sample,
   refusal and guardrail-block rates, human feedback and escalation
   rate, canary inputs, and an offline evaluation suite run on
   production samples. It's more proxies and more sampling, and the
   honest version is that you're measuring the shape of behaviour
   rather than correctness.
6. **"What's the first thing you'd instrument on a new model?"** —
   input distributions and the business metric. One is the earliest
   warning and the other is the only thing that matters; everything
   else fills in between them.

**Cross-references**

- `D7-Q07` for the retraining loop this feeds; `D7-Q09` for the
  offline evaluation suite that sampled scoring reuses; `D7-Q04` for
  the fallback-rate signal in callout (3).
- `D3-Q11` owns training/serving skew on the data side; this question
  owns detecting its symptoms in production.
- `01-domains/DOMAIN-6-ensuring-reliability.md` §6.1 — SLO and
  burn-rate alerting patterns that callout (7) borrows from;
  `02-services/05-data-analytics-ai.md` for Model Monitoring's surface.

---

### D7-Q09 — "How do you know a prompt change made things better? There's no accuracy number."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 4.1, 5.1 |
| **Axis** | intelligence |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D7-Q01` |

**What the interviewer is actually testing**

Whether you can build a release gate for something whose output is
free text. The skill is decomposing "quality" into properties that can
each be checked, and being honest that the hardest ones are checked by
a noisy judge rather than measured.

**Clarifying questions to ask before drawing anything**

- **What does a wrong answer cost?** The whole evaluation budget
  follows from this. A drafting assistant and a system informing a
  clinical or financial decision deserve very different rigour.
- **Do we have real user questions, or would we be inventing them?**
  An evaluation set made of questions the team imagined tests the
  team's imagination. Real traffic, including the complaints, is the
  only good source.
- **Is there a reference answer, or only a judgement?** Where a correct
  answer exists you can check deterministically, which is far cheaper
  and far more trustworthy than any judge.
- **How often do we ship?** Daily prompt changes need an automated
  suite in CI; a quarterly release can afford substantial human
  review.
- **Who arbitrates disagreement about quality?** If nobody owns the
  definition, every release becomes an argument about taste.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Prompts and models change frequently | Assumed | "If it's frequent, the suite must run in CI, not in a review meeting" | Automation is a requirement, not a nicety |
| Real production traffic is available | Assumed | "Otherwise we're testing our imagination" | Evaluation set is built from logged traffic (`D7-Q01` callout 12) |
| Some properties are objectively checkable | Stated | — | Deterministic checks carry the load; the judge handles the residue |
| A human-reviewed golden set exists or can be built | Assumed | "A few hundred human-labelled cases; that's a real but affordable cost" | Needed to calibrate the judge, which otherwise measures nothing |
| Regression matters more than absolute score | Assumed | "The gate is 'not worse than live', not 'above 0.8'" | Comparative evaluation against the deployed configuration |

**The answer, out loud**

I'd build this as three tiers, cheapest and most trustworthy first,
and I'd resist the instinct to start with a model-based judge.

Tier one is deterministic checks, and far more of "quality" lives here
than people expect. Does the output parse as the schema we asked for?
Do all citations resolve to real documents? Is every cited document one
the caller was entitled to see? Does the answer stay within length
limits? Did any guardrail fire? Did the system refuse when the
retrieval returned nothing? These are pass/fail, they're fast, they
run on every change, and they catch the majority of real regressions.
If a change breaks JSON output, no judge is needed to tell you.

Tier two is retrieval evaluation, scored separately from generation.
For a set of questions with known relevant documents, measure whether
retrieval surfaced them. I separate this because most quality
regressions in a grounded system are retrieval regressions, they're
cheap to measure, and blending them into one overall score hides both
the problem and its fix. A chunking change that drops retrieval hit
rate shows up here immediately and unambiguously.

Tier three is generation quality, and that's where a model-based judge
earns its place — scoring an output on named properties: is it
grounded in the provided context, does it answer the question asked,
does it follow the required format and tone, does it avoid content we
prohibit. I'd insist on several things about the judge. It scores one
property at a time with an explicit rubric, because a single "quality"
score is uninterpretable. It sees the context and the question, so
groundedness is checkable rather than a guess. And — the part teams
skip — the judge itself is validated against human labels on a golden
set, with the agreement rate measured and tracked. A judge nobody
calibrated is a random number generator with good manners. I'd also
keep the judge's configuration pinned and versioned, because changing
the judge silently rescales every historical score.

The comparison mode matters as much as the metrics. Absolute scores
drift with the judge and mean little; pairwise comparison against the
currently deployed configuration is far more stable, and the gate is
"not worse," which is also the question the release actually needs
answered.

Where the evaluation set comes from is the part that determines
whether any of this works. It starts from real logged traffic,
stratified across the query types that matter, and it grows by a
standing rule: every production complaint and every incident becomes a
permanent case. That's how the suite accumulates coverage of the
failures you actually have instead of the ones you imagined. And I'd
hold a portion back from the people tuning prompts, because a suite
everyone optimises against stops predicting production.

Then the release gate. Deterministic checks and retrieval metrics run
on every change in CI and block on failure. Judge-scored generation
quality runs on the full set before a release, and a regression on any
tracked property blocks. Human review is reserved for the cases the
judge is least reliable on and for anything in a high-cost category.
And after release, a sample of production traffic is scored
continuously, which is the hook into `D7-Q08` — offline evaluation
tells you whether to ship, production sampling tells you whether
shipping worked.

The honest caveat I'd give unprompted: this measures a lot and proves
nothing. A passing suite means no known regression on properties we
thought to check. That's genuinely valuable and it's weaker than a
test suite for deterministic software, which is exactly why staged
rollout in `D7-Q07` isn't optional here.

**Architecture**

```
   production traffic logs ──► stratified sampling ──► EVALUATION SET
   production complaints ────► permanent cases   ◄── (1)     │
   human-labelled golden set ─────────────────────────► ◄── (2)
                                                              │
   ┌──────────────────────── candidate change ────────────────┘
   │ (prompt, model version, retrieval config, quantization)
   ▼
  TIER 1 — deterministic checks                        ◄── (3)
   schema, citations resolve, entitlement of cited docs,
   length, guardrail fired, refused-when-empty
   │ fail → block in CI
   ▼
  TIER 2 — retrieval metrics, scored separately        ◄── (4)
   hit rate at k on questions with known relevant docs
   │ regression → block in CI
   ▼
  TIER 3 — model-based judge, one property at a time   ◄── (5)
   grounded? answers the question? format? prohibited?
   pairwise vs the DEPLOYED configuration              ◄── (6)
   judge calibrated against the golden set, agreement
   rate tracked, judge version pinned                  ◄── (7)
   │ regression on any property → block release
   ▼
  human review: only high-cost categories and low-judge-
  agreement cases                                      ◄── (8)
   ▼
  staged rollout (`D7-Q07`) ──► production sampling scored
  continuously (`D7-Q08`)                              ◄── (9)

  Cross-cutting: a held-back slice of the set is never shown to the
  people tuning prompts, or the suite stops predicting production (10);
  a passing suite means "no known regression on properties we thought
  to check" — it is not proof, which is why staged rollout stays (11).
```

**Every arrow explained:**

1. **Set built from real traffic and complaints** — stratified across
   query types, and every production complaint becomes a permanent
   case. An imagined set tests the team's imagination.
2. **Human-labelled golden set** — a few hundred cases, expensive and
   unavoidable: without it the judge is uncalibrated and its scores
   measure nothing.
3. **Deterministic tier** — schema, citation resolution, entitlement of
   cited documents, length, guardrail firing, refusal on empty
   retrieval. Fast, pass/fail, and catches most real regressions.
4. **Retrieval scored separately** — most regressions in a grounded
   system are retrieval regressions; blending them into one score
   hides both the problem and its fix.
5. **Judge scores one property at a time** — with an explicit rubric
   and the context in view. A single blended "quality" score is
   uninterpretable and moves for unexplainable reasons.
6. **Pairwise against the deployed configuration** — absolute scores
   drift with the judge; "not worse than live" is both more stable and
   the question the release actually asks.
7. **Judge calibration and pinning** — agreement with human labels is
   measured and tracked, and the judge's version is pinned, because
   changing it silently rescales every historical score.
8. **Human review, narrowly scoped** — high-cost categories and the
   cases where judge-human agreement is weakest. Reviewing everything
   doesn't scale; reviewing nothing leaves the judge unchecked.
9. **Production sampling** — offline evaluation says whether to ship;
   production sampling says whether shipping worked. The hook into
   `D7-Q08` callout (3).
10. **Held-back slice** — a suite everyone optimises against stops
    predicting production, the same failure as overfitting a test set.
11. **Honest limitation** — no known regression is not proof of
    correctness, which is precisely why the staged rollout in
    `D7-Q07` remains mandatory.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Primary gate | Deterministic checks first, judge last | Model-based judging as the main signal | Cheap, fast, unambiguous, and it catches most real regressions | When outputs are genuinely open-ended with no checkable structure — then the judge carries more, and so does human review |
| Score type | Pairwise against the deployed config | Absolute score with a threshold | Stable under judge changes and answers the release question directly | When an external standard mandates an absolute bar — a regulator's accuracy floor is a threshold, not a comparison |
| Retrieval metrics | Scored separately from generation | One blended quality score | Separates the most common regression from the hardest one to fix | When there's no retrieval step at all — a pure generation feature has nothing to separate |
| Judge validation | Calibrated against human labels, tracked | Trust the judge's scores | Otherwise the scores have no known relationship to quality | When the judged property is trivially objective — format compliance needs a rule, not a calibrated judge |
| Evaluation set | Real traffic plus every complaint | Curated question set written by the team | Covers the failures you have rather than the ones you imagined | When the product hasn't launched — then a curated set is all there is, and replacing it with real traffic is week-one work |

**What a weak answer sounds like**

- "We'd have the model grade its own output." — without calibration
  against human labels, that's a number with no known relationship to
  quality, and it tends to like its own style.
- "We'd A/B test it in production." — eventually yes, but shipping a
  regression to half your users as the first detection mechanism is an
  expensive way to learn.
- "The team reviews the outputs before release." — doesn't scale, isn't
  repeatable, and quietly becomes "someone skimmed ten examples."
- "We track a quality score over time." — composed of what, judged by
  which version of what judge? A single blended score moves for
  reasons nobody can explain.

**Common wrong turns**

- **Starting with the judge.** It's the interesting part and the least
  reliable. Recover by listing the deterministic checks first — there
  are always more than people expect.
- **One blended quality number.** It hides which property regressed.
  Recover by decomposing into named properties with separate rubrics.
- **Letting the evaluation set become the training target.** Prompt
  tuning against the full visible set inflates every score. Recover by
  holding a slice back.
- **Never re-validating the judge.** Judge drift silently rescales
  history. Recover by pinning the judge version and tracking
  agreement as a monitored metric.

**Follow-up probes the interviewer asks next**

1. **"The suite passes and users say it got worse. What happened?"** —
   the regression is on a property nobody defined, or on a query type
   the set under-samples. Both are fixed the same way: the complaints
   become permanent cases, and the new property gets a rubric.
2. **"How big should the evaluation set be?"** — big enough that the
   smallest regression you care about is distinguishable from noise on
   the slices you care about, which usually means hundreds per
   important slice rather than thousands overall. I'd size it from the
   slice requirement rather than pick a round number.
3. **"Escalate: a prompt change ships and produces harmful outputs for
   a day. What's the blast radius and what changes?"** — every request
   in the window, plus anything downstream that stored an output. The
   gate that should have caught it is the prohibited-content property,
   so the fix is that category becoming a blocking deterministic check
   where possible rather than a judged one, plus tighter staged
   rollout. And the failing cases become permanent evaluation cases —
   that's the only mechanism that makes the suite improve.
4. **"Who owns the definition of quality?"** — the product owner, in
   writing, as the rubrics. If engineering owns it, quality becomes
   what's easy to measure; if nobody owns it, every release is a
   debate about taste.
5. **"Can the judge run on production traffic?"** — yes, on a sample,
   and that's how offline and online quality connect. It costs a model
   call per sampled request, which is a `D7-Q13` budget line and worth
   naming rather than discovering.
6. **"What if we can't afford human labels?"** — then the judge is
   uncalibrated and I'd say so plainly, lean much harder on tiers one
   and two, and treat the judge's output as a change-detector rather
   than a quality measure. That's a defensible position; pretending
   the judge is calibrated is not.

**Cross-references**

- `D7-Q07` for the pipeline gate this fills; `D7-Q08` for production
  sampling; `D7-Q01` callout (12) for the logging this set is built
  from; `D7-Q03` for why serving changes need this gate too.
- `01-domains/DOMAIN-4-analyzing-optimizing.md` §4.1 — testing and QA
  process framing this extends to non-deterministic outputs.

---

### D7-Q10 — "Leadership wants us to fine-tune a model on our data. Should we?"

| | |
|---|---|
| **Band** | Principal |
| **Primary domain leaves** | 1.1, 1.5 |
| **Axis** | intelligence |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D7-Q01` |

**What the interviewer is actually testing**

Whether you'll commit to a recommendation and defend it against a
senior stakeholder's preference, and whether you understand what each
technique actually changes about a model. At this band the panel is
also testing whether you can say "no, and here's what we'd do instead"
without it sounding like risk aversion.

**Clarifying questions to ask before drawing anything**

- **What problem are we solving that the current approach doesn't?**
  "Fine-tune" is a solution; I want the deficiency. Wrong facts, wrong
  format, wrong tone and too slow are four different problems with
  four different answers.
- **Is the gap about knowledge or about behaviour?** Knowledge the
  model lacks is a retrieval problem. Behaviour we want consistently
  is where fine-tuning is genuinely strong. Conflating them is the
  single most common expensive mistake in this area.
- **Do we have training examples, and who would label them?** A
  fine-tune needs a curated set of input-output pairs that represent
  what good looks like. If nobody has budgeted the labelling, the
  project doesn't exist yet.
- **How often does the underlying content change?** Weekly-changing
  facts can't be fine-tuned in; the model would be stale between runs.
- **What's the real driver — capability, cost, latency, or
  differentiation?** A cost or latency driver points at a smaller
  model, possibly distilled. A differentiation driver is a business
  argument that deserves an honest answer about whether weights are
  actually the moat.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| A specific quality gap exists | Assumed | "I want the failing examples before I choose a technique" | Technique follows diagnosis; without examples there's nothing to diagnose |
| Content changes regularly | Assumed | "If facts change weekly, they can't live in weights" | Rules fine-tuning out as a knowledge mechanism |
| Labelled examples would need creating | Assumed | "Assume we have none and someone has to make them" | Makes labelling cost the dominant cost, not compute |
| An evaluation suite exists | Stated | — | Without it, no option can be compared and the decision is taste |
| Leadership expects an answer, not options | Assumed | "At this level, 'it depends' is the failure" | Forces a recommendation with a named revisit trigger |

**The answer, out loud**

I'd answer the question directly and then show the work: probably not
yet, and here's the order I'd try things in and what would change my
mind.

Start with the diagnosis, because "fine-tune" is a proposed solution
to an unstated problem. I'd ask for twenty real failures and sort them
into four buckets. Wrong facts or missing knowledge. Wrong format or
structure. Wrong tone, style or persona. Wrong reasoning on hard
cases. Those four route to different answers and the routing is the
whole value I add here.

Prompt engineering first, and I mean it seriously rather than as a
starting formality: a well-structured prompt with clear instructions,
explicit output schema and a handful of examples in context fixes
format, tone and much of reasoning-quality. It's reversible in
minutes, costs nothing to try, and it's evaluable with the suite we
already have. The reason to start here isn't that it's best, it's that
it's the only option whose cost of being wrong is an afternoon.

Retrieval second, for anything that's a knowledge gap. If the failures
are "it doesn't know our policy" or "it invented a product detail,"
that is categorically not a fine-tuning problem — facts in weights go
stale, can't be updated when a document changes this afternoon, can't
be cited, and can't be scoped to what a caller is entitled to see.
Retrieval fixes all four properties. This is the argument I'd make
most firmly, because "fine-tune it on our documents" is the single
most common expensive mistake in this space and it's usually proposed
with confidence.

Fine-tuning third, and genuinely valuable for a narrow set of things:
a consistent output format that prompting keeps missing, a domain
style or vocabulary, a specialised task where a much smaller model
fine-tuned on it matches a much larger general one — which is a real
cost and latency lever — and behaviour that's hard to specify but easy
to demonstrate. The honest cost isn't the training compute, it's
everything around it: a curated labelled dataset that someone has to
produce and maintain, a versioned artifact in the pipeline from
`D7-Q07`, an evaluation burden that now includes checking you haven't
degraded general capability, and a recurring obligation to redo it
when the base model you tuned from is superseded. That last one is the
cost people never price. And it couples you to a base model's
lifecycle in a way prompting doesn't.

Fourth, using a foundation model as-is with none of the above — worth
naming explicitly as a real option, because for many features the
generic capability is sufficient and everything else is
over-engineering.

So my recommendation would be: prompt and retrieval first, with the
evaluation suite measuring each step, and fine-tuning reconsidered
when a specific condition is met. I'd write the condition down: when
prompting plus retrieval plateaus on a named metric, and the residual
failures are behavioural rather than factual, and we have or can build
a few thousand representative examples, and the volume is high enough
that a smaller tuned model's cost or latency advantage is material.
Naming the trigger is what turns "no" into "not yet," and it's what
stops the question being re-litigated monthly.

On the differentiation argument, I'd be direct: fine-tuned weights are
rarely the moat. The proprietary data, the retrieval quality, the
evaluation suite and the product surface are durable; a tuned
checkpoint on a base model that will be superseded is not. If the
strategic argument is "we need our own model," I'd want that argued on
its merits rather than smuggled in as a technical choice.

**Architecture**

```
   "we should fine-tune"
        ▼
   COLLECT 20 REAL FAILURES — no examples, no decision   ◄── (1)
        ▼
   ┌── classify each failure ──────────────────────────┐
   │                                                    │
   ▼                ▼                ▼                  ▼
  wrong facts   wrong format    wrong tone /       wrong reasoning
  / missing     / structure     vocabulary         on hard cases
  knowledge         │                │                  │
   ◄── (2)          ▼                ▼                  ▼
     │         PROMPT ENGINEERING FIRST: instructions,
     │         schema, in-context examples      ◄── (3)
     │              │ plateau?
     ▼              ▼
  RETRIEVAL    ┌──────────────────────────────────┐
  (`D7-Q01`)   │ FINE-TUNE only if ALL hold:      │
   ◄── (4)     │  • plateau on a named metric     │
     │         │  • residual failures behavioural │  ◄── (5)
     │         │  • examples exist or are funded  │
     │         │  • volume makes a smaller model  │
     │         │    materially cheaper or faster  │
     │         └──────────────┬───────────────────┘
     │                        ▼
     │              fine-tuned model enters the same
     │              pipeline, registry and gates      ◄── (6)
     ▼                        │
   evaluate every step with the SAME suite (`D7-Q09`)  ◄── (7)
                              ▼
   also a valid outcome: foundation model as-is,
   nothing added                                       ◄── (8)

  Cross-cutting: facts in weights go stale, can't be cited, can't be
  updated today and can't be scoped to a caller's entitlement — which
  is why knowledge gaps route to retrieval, not tuning (9); a tuned
  checkpoint inherits its base model's lifecycle, and redoing it on
  each base-model change is the cost nobody prices (10).
```

**Every arrow explained:**

1. **Twenty real failures before any decision** — technique follows
   diagnosis. Without examples there is nothing to diagnose and the
   conversation is preference against preference.
2. **Knowledge gaps branch away immediately** — "it doesn't know our
   policy" is never a tuning problem, and separating this branch early
   is most of the value of the whole flow.
3. **Prompt engineering first** — not because it's best, but because
   the cost of being wrong is an afternoon and it's evaluable with the
   suite that already exists.
4. **Retrieval for knowledge** — updatable today, citable, and
   scopeable to entitlement. Three properties weights cannot provide.
5. **Four conditions, all required** — plateau on a named metric,
   behavioural residual, funded examples, and material cost or latency
   benefit. Writing them down converts "no" into "not yet" and stops
   monthly re-litigation.
6. **Tuned models use the same pipeline** — registry, lineage,
   evaluation gate and staged rollout from `D7-Q07`. A fine-tune is an
   artifact, not an experiment that skips the gates.
7. **One evaluation suite across all options** — otherwise each option
   is measured on its own terms and the comparison is meaningless.
8. **"Do nothing more" is a real outcome** — for many features generic
   capability is sufficient, and naming this prevents the flow from
   being a machine that always produces work.
9. **Why knowledge never goes in weights** — stale, uncitable,
   un-updatable, unscopeable. The four-property argument is the one to
   have ready, because this proposal arrives with confidence.
10. **Base-model lifecycle coupling** — the recurring cost of redoing
    the tune when the base is superseded, which is the line item
    missing from most fine-tuning business cases.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| First technique | Prompt engineering | Fine-tune immediately | Reversible in minutes, costs nothing to try, evaluable today | When the required behaviour is already known to be unpromptable from prior attempts with evidence — then skip ahead rather than repeat the experiment |
| Knowledge gaps | Retrieval | Fine-tune on the documents | Updatable, citable, entitlement-scopeable; weights are none of those | Effectively never for changing facts — the narrow exception is stable domain vocabulary, which is behaviour, not knowledge |
| Cost or latency driver | Smaller model, tuned for the task | Prompt-engineer the large model harder | A tuned small model can match a large general one on a narrow task at materially lower cost | When volume is low — the labelling and maintenance cost then exceeds any inference saving |
| Differentiation claim | Data, retrieval and evaluation as the moat | Proprietary weights as the moat | Those assets are durable; a checkpoint is superseded with its base model | When the domain is genuinely unlike anything in general training data and the data can't be retrieved at inference time |
| Decision form | A recommendation plus a written revisit trigger | Present options and let leadership pick | At principal level, unowned options become the loudest voice's choice | When the decision is genuinely a business risk appetite question — then frame the options and say which you'd pick anyway |

**What a weak answer sounds like**

- "Yes, fine-tuning will make it understand our business." — the
  sentence that starts most expensive AI projects; ask which failures
  it fixes and the specificity collapses.
- "It depends on the use case." — at principal band this is the
  failure. The panel wants a recommendation and a defence.
- "Fine-tuning is expensive, so no." — compute is the smallest cost
  here; leading with it shows you haven't done one.
- "We'd fine-tune and use retrieval and prompt engineering." — doing
  everything is not a decision, and it triples the surface you have to
  evaluate.

**Common wrong turns**

- **Accepting the framing.** The question is "should we fine-tune,"
  the answer is about the failures. Recover by asking for examples
  before answering.
- **Arguing cost instead of mechanism.** Leadership discounts cost
  arguments. Recover by explaining that facts in weights can't be
  updated or cited — a mechanism argument survives the meeting.
- **Saying no without a trigger.** It reads as obstruction and returns
  next month. Recover by writing the four conditions down.
- **Forgetting maintenance.** A tuned model is a permanent artifact
  with a permanent evaluation burden. Recover by pricing the redo when
  the base model changes.

**Follow-up probes the interviewer asks next**

1. **"Leadership has already announced it publicly. Now what?"** — I'd
   run it as a time-boxed experiment with a pre-registered success
   metric against the prompt-plus-retrieval baseline, and I'd make
   sure the baseline is genuinely strong so the comparison is fair.
   Then the data decides, and if it wins I was wrong cheaply.
2. **"What if a vendor says their tuning service makes this easy?"** —
   the training run was never the hard part. The labelled dataset, the
   evaluation burden and the base-model refresh obligation are, and
   none of those move because the training is managed.
3. **"Escalate: what's the worst outcome of tuning on our own
   data?"** — the model memorises something it shouldn't and emits it
   to a user who shouldn't see it, which is a disclosure incident with
   no clean remediation because you can't reliably remove a fact from
   weights. That's `D7-Q11`, and it's the strongest single argument
   for keeping sensitive knowledge in retrieval where entitlement is
   enforced per request.
4. **"Who decides this in two years?"** — a documented decision with a
   named owner and a revisit trigger, reviewed by whatever
   architecture forum exists (`D1-Q16`). Otherwise it gets re-decided
   by whoever is most recently frustrated.
5. **"Would distillation change your answer?"** — it's the strongest
   version of the cost argument: use a large model to generate
   training data for a small one on a narrow task. I'd still want the
   volume to justify the maintenance, and I'd verify current tuning
   and distillation support rather than assume a specific capability
   is available today.
6. **"What if the answer is that we need all three?"** — then sequence
   them and evaluate after each, because shipping all three at once
   means you can't attribute the improvement and can't roll back the
   one that hurt.

**Cross-references**

- `D7-Q01` for the retrieval option; `D7-Q09` for the suite that makes
  every branch comparable; `D7-Q07` for the pipeline a tuned model
  must enter; `D7-Q11` for the memorisation risk in probe 3.
- `D7-Q13` for the cost model behind the smaller-model argument.
- `01-domains/DOMAIN-1-designing-planning.md` §1.1 — the
  business-requirement translation framing this decision sits in.

---

### D7-Q11 — "Legal asks which customer data trained this model, and whether we can delete one customer's data from it. Answer them."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 3.2, 4.2 |
| **Axis** | intelligence |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D7-Q07` |

**What the interviewer is actually testing**

Whether you know that deletion from a trained model is not a solved
operation, and whether you'll say so rather than promise something
undeliverable. The design skill is arranging the system so that the
question can be answered without needing the impossible operation.

**Clarifying questions to ask before drawing anything**

- **What exactly was the customer promised?** Deletion of their data,
  or that their data is no longer used? Those are very different
  obligations, and the second is achievable with a retrain while the
  first may not be.
- **Is the model trained on customer content, or only on our own?**
  If our own, most of this problem disappears and I'd confirm it
  loudly rather than build machinery nobody needs.
- **Was there a lawful basis and a consent scope for training use?**
  Data lawfully collected to deliver a service is not automatically
  lawful to train on, and that distinction is where most of the real
  exposure sits.
- **How long do we keep prompts and responses, and are they training
  data?** Inference logs quietly becoming a training set is the most
  common accidental violation I've seen.
- **What's the retrain cadence and cost?** It determines whether "we
  remove you and retrain" is a routine operation or a six-figure
  special project.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Deletion requests will arrive | Stated | — | The pipeline must support exclusion and re-derivation |
| Training data includes customer content | Assumed | "If it doesn't, this problem is much smaller — worth confirming first" | Drives lineage, consent scoping and retrain-on-exclusion |
| Consent scope varies by customer and region | Assumed | "Assume some customers never consented to training use" | Consent becomes a filter at dataset construction, not a review step |
| Inference logs are retained | Assumed | "And are therefore a dataset with its own basis and retention" | Logs need classification, retention limits and an explicit training flag |
| A regulator may ask for evidence | Assumed | "Evidence means artifacts, not assertions" | Lineage must be queryable and retained beyond the model's life |

**The answer, out loud**

I'd answer legal's two questions separately, because one is an
engineering question and the other is partly a science question.

Which data trained this model is answerable, and it's answerable
because the pipeline in `D7-Q07` pins a dataset version into every
registry entry. So the chain is: this deployed model came from this
training run, which consumed this dataset version, which was
constructed from these sources filtered by this consent scope at this
time. If that chain doesn't exist, nothing else in this answer works,
and rebuilding it retroactively is usually impossible — which is why
lineage is mandatory capture rather than best-effort documentation.

Can we delete one customer's data from the model is the harder one,
and the honest answer is that you cannot reliably remove a specific
contribution from trained weights. Techniques for approximate
unlearning exist and are an active research area; I would not promise
a regulator that one of them works, and I'd flag clearly that anyone
asserting a production-grade unlearning capability should be asked for
their evidence. So I design so the question doesn't need that
operation. Three mechanisms.

First, exclusion at the source. The consent scope is a property of the
data, evaluated when the dataset version is constructed, and a
customer who withdraws is excluded from every subsequent dataset
automatically. That's the mechanism that makes "your data is no longer
used" true going forward without touching existing weights.

Second, re-derivation on a known cadence. If models are retrained
regularly, then a withdrawal is satisfied by the next scheduled
retrain, and the commitment we make externally is bounded by that
cadence — "within one training cycle, and here's what that period is."
That's a commitment we can actually keep, and it's why retrain
frequency becomes a compliance parameter rather than only a quality
one.

Third, and most important architecturally: keep sensitive and
customer-specific knowledge out of weights in the first place. If it
lives in the retrieval corpus, deletion is a delete — the chunks go,
the index updates, and the caller can no longer retrieve them. That
property is the strongest practical argument for retrieval over
fine-tuning on customer data, and it's a governance argument rather
than a quality one, which makes it the version legal understands. It's
also the point `D7-Q10` routes to.

Then the parts people forget. Inference logs are training data the
moment someone uses them for training, so I'd make that an explicit,
flagged decision with its own lawful basis, its own retention period
and its own consent scope — never an implicit consequence of keeping
logs. Personal data gets classified and, where possible,
de-identified before it enters a training set, because a training set
containing identifiers is a permanent liability once a model has read
it. And derived artifacts carry the same obligations as their source:
embeddings computed from personal data are personal data, and a vector
index is in scope for deletion exactly like the documents it came
from. Teams routinely delete the documents and leave the embeddings.

Finally, evidence. Every dataset version, its construction query, the
consent filter applied, and the models derived from it are retained as
an auditable record — retained beyond the model's own lifetime,
because the question arrives after decommissioning as often as before.
Evidence is artifacts, not assertions.

**Architecture**

```
   source data ──► CONSENT + LAWFUL-BASIS FILTER, evaluated at
   (customer      dataset construction time              ◄── (1)
    content,           │
    logs, our     ┌────┴─────┐
    own docs)     │ excluded │ retained record of WHY    ◄── (2)
                  └──────────┘
                       ▼
   DATASET VERSION (immutable, queryable construction record)
        │                                               ◄── (3)
        ▼
   training run ──► MODEL REGISTRY ENTRY carries the dataset
                    version, not a copy of the data      ◄── (4)
        ▼
   deployed model ──────────────────────────────┐
                                                │
   ── deletion request arrives ────────────────┐│
        ▼                                      ││
   1. remove from source + all future datasets ││ ◄── (5)
   2. remove from the RETRIEVAL corpus AND the ││
      derived vector index — derived artifacts ││ ◄── (6)
      inherit the obligation                   ││
   3. weights: NOT reliably removable; satisfied││
      by exclusion + the next scheduled retrain ││ ◄── (7)
   4. inference logs: separate basis, separate  ││
      retention, explicit training flag         ││ ◄── (8)
        ▼                                       ▼▼
   evidence pack: dataset versions, construction queries,
   consent filters, derived models — retained beyond the
   model's own life                                     ◄── (9)

  Cross-cutting: sensitive and customer-specific knowledge belongs in
  retrieval, not in weights, because retrieval deletion is a delete and
  weight deletion is not a solved operation (10); external commitments
  are bounded by retrain cadence — say "within one training cycle" and
  mean it, rather than promising immediate removal (11).
```

**Every arrow explained:**

1. **Consent filter at construction time** — a property of the data
   evaluated when the dataset is built, not a review meeting. This is
   the mechanism that makes withdrawal effective for every future
   model without touching existing weights.
2. **Exclusion records retained** — why a record was excluded is
   itself evidence, and a regulator asking "how do you know" needs the
   negative case as much as the positive one.
3. **Immutable dataset version with a queryable construction record** —
   the object the entire lineage chain hangs from. Rebuilt
   retroactively it is almost always impossible, which is why capture
   is mandatory in `D7-Q07` callout (2).
4. **Registry entry references the dataset version** — the model
   points at the dataset, so "which data trained this" is a lookup
   rather than an investigation.
5. **Removal from source and all future datasets** — the going-forward
   guarantee, and the one that is actually deliverable.
6. **Derived artifacts inherit the obligation** — embeddings from
   personal data are personal data. Deleting documents and leaving the
   vector index is a routine and serious mistake.
7. **Weights are not reliably editable** — approximate unlearning is
   an active research area; I would not promise a regulator it works,
   and I'd ask anyone claiming a production capability for their
   evidence. Exclusion plus scheduled retrain is the deliverable
   answer.
8. **Inference logs as a separate dataset** — with their own lawful
   basis, retention and an explicit flag before they can be used for
   training. Logs quietly becoming a training set is the most common
   accidental violation.
9. **Evidence pack outliving the model** — the question arrives after
   decommissioning as often as before. Evidence is artifacts, not
   assertions.
10. **Sensitive knowledge in retrieval, not weights** — a governance
    argument for the `D7-Q10` recommendation, and the version legal
    finds persuasive.
11. **Commitments bounded by retrain cadence** — makes retrain
    frequency a compliance parameter, and makes the external promise
    one you can actually keep.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Where sensitive knowledge lives | Retrieval corpus | Fine-tuned into weights | Deletion is a delete, and entitlement is enforced per request | When the knowledge is non-personal domain style or vocabulary — behaviour, not facts about people |
| Deletion commitment | "Excluded immediately, absent from models within one training cycle" | "Deleted from the model" | It's true, deliverable and auditable | When the model can be retrained on demand cheaply — then the cycle is short enough to promise tighter, but the wording still shouldn't claim weight-level removal |
| Consent enforcement | Filter at dataset construction | Review and approval before each training run | Automatic, repeatable, and produces evidence as a by-product | When data sources are few and stable and a documented review is genuinely cheaper than a filter nobody maintains |
| Inference logs | Separate basis, separate retention, explicit training flag | Retain logs and treat them as available training data | Prevents the most common accidental violation in this whole area | When logs are fully synthetic or non-personal — then the flag is ceremony, and say so |
| Evidence | Artifacts retained beyond the model's life | Documentation describing the process | Regulators ask for records of what happened, not descriptions of intent | When there is no regulatory exposure at all — rare, and the artifacts are useful for debugging anyway |

**What a weak answer sounds like**

- "We'd delete their data from the training set and retrain." — right
  direction, but it skips whether retraining is affordable and what
  you tell the customer about the model serving today.
- "We can remove their influence from the model." — this is the
  sentence that becomes a regulatory problem. Don't say it without
  evidence you can show.
- "The data was anonymised, so it's fine." — anonymisation is a
  spectrum and a claim that needs testing, especially for free text
  that people wrote about themselves.
- "We keep logs for debugging, that's separate." — until someone
  trains on them, which happens without a decision unless there's a
  flag and an owner.

**Common wrong turns**

- **Promising unlearning.** Recover immediately and reframe as
  exclusion plus retrain cadence; this one is much cheaper to correct
  mid-answer than in a regulatory response.
- **Forgetting derived artifacts.** Embeddings, caches and evaluation
  sets all carry the obligation. Recover by naming them explicitly.
- **Treating consent as a review step.** It doesn't survive contact
  with a monthly pipeline. Recover by making it a filter in dataset
  construction.
- **No lineage from day one.** It cannot be reconstructed later.
  Recover by tying it to the registry entry, which the pipeline
  already produces.

**Follow-up probes the interviewer asks next**

1. **"A customer wants proof their data isn't in the current
   model."** — the dataset version's construction record shows the
   consent filter applied and the exclusion record shows their data
   was removed. That's evidence about the process and the inputs; I'd
   be explicit that it isn't a measurement of the weights, because
   overstating it is how this becomes a second problem.
2. **"Retraining costs a lot and takes weeks. Does your answer
   change?"** — the commitment changes, not the mechanism: the
   external promise is bounded by the real cadence and stated
   honestly. If the cadence is too slow for the obligation, that's a
   business decision about retrain frequency, and it should be made
   deliberately rather than discovered during a request.
3. **"Escalate: we discover a dataset included data we had no basis to
   use. What now?"** — scope it from lineage: which dataset versions,
   which models, which of those are deployed. Then the hard call,
   which is whether deployed models built on that dataset keep serving
   while a clean retrain runs. I'd expect legal to decide with
   engineering providing the blast radius, and I'd want the lineage
   good enough that the blast radius is a query rather than an
   estimate. Without lineage, the only safe answer is to withdraw
   every model that might be affected.
4. **"Who owns this?"** — a named data owner per source with legal as
   the policy authority and the platform team enforcing it in the
   pipeline. If the ML team owns consent decisions, they'll be made by
   whoever needs the data.
5. **"Does this apply to the vector index?"** — yes, and it's the most
   commonly missed part. Embeddings derived from personal data are
   personal data, and deleting the documents while leaving the index
   means retrieval still serves them.
6. **"What about a third-party foundation model we call through the
   gateway?"** — then the question is what happens to prompts we send:
   retention, whether they're used for training, and where they're
   processed. That's a contractual and egress question owned by
   `D4-Q09`, and the gateway is where the control is enforced.

**Cross-references**

- `D7-Q07` callout (2) for the lineage capture this depends on;
  `D7-Q10` for the routing decision this argument supports; `D7-Q12`
  for the wider regulated-AI evidence obligations.
- `D4-Q09` for third-party model egress and partner data handling.
- `01-domains/DOMAIN-3-security-compliance.md` §3.2 — data-residency,
  retention and audit-logging patterns this builds on.

---
