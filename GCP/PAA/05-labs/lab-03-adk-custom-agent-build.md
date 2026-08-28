# Lab 03 — Building a custom agent with ADK: model selection, sessions/memory, and a RAG pipeline

> Covers exam task **3.1** (designing/building agentic workflows in
> code) and **3.2** (integrating enterprise domain knowledge). Section
> 3 is ~33% of the exam — the single heaviest section — so this lab
> and Lab 04 together carry the most exam-relevant weight of the whole
> `05-labs/` folder. Companion reference:
> `01-domains/SECTION-3-custom-agents.md`,
> `02-services/03-adk-custom-development.md`,
> `03-comparisons/01-low-code-vs-custom-development.md`.

---

## Honesty callout

> **This lab is illustrative, not console/SDK-verified.** This
> environment has no live access to ADK's actual Python (or other
> language) package, Agent Platform Memory Bank, managed sessions, RAG
> Engine, Vector Search 1.0 / Agent Retrieval, or any Google Cloud
> console. Code samples below are written in a realistic, idiomatic
> style consistent with how agent-framework SDKs of this shape
> typically expose these concepts, and with the exam guide's own
> stated capabilities — but exact class names, method signatures, and
> package names are **not** guaranteed to match the real ADK API.
> **Before an actual exam attempt, install the real ADK package and
> work through its own quickstart/reference docs to confirm exact
> syntax.**

---

## 0. Why this lab moves from console clicks to code

Labs 01–02 were entirely console/CLI-driven — you configured behavior
through forms and command flags. This lab is different in kind: you
are now writing an agent's actual logic in code, using **ADK (Agent
Development Kit)** — explicitly described in the exam guide as an
**open-source** library for building custom agents (a currency
correction worth restating here: do not describe ADK as closed-source
or Google-proprietary). This is the "full code" end of the spectrum
diagram in `01-domains/SECTION-3-custom-agents.md` §0 — you're no
longer configuring a pre-built low-code agent's behavior through
settings; you're defining the agent's core loop yourself.

### Why build in ADK at all, given Lab 01's low-code agent already worked?

This is a real design decision, not a foregone conclusion — restate
the tradeoff from `01-domains/SECTION-3-custom-agents.md` §1.2 before
writing any code: **don't use ADK when a low-code Gemini Enterprise
agent already meets the requirement** — that's unnecessary engineering
overhead. This lab's scenario specifically needs something Lab 01's
low-code agent can't do: **programmatic control over the retrieval
pipeline** (custom embedding model choice, custom chunking, explicit
reranking logic) and **custom multi-agent orchestration** (Lab 04).
Those are exactly the capabilities that justify reaching for ADK per
the domain file's guidance — this lab isn't rebuilding Lab 01's agent
in code for its own sake, it's building something with requirements
Lab 01's tool genuinely cannot satisfy.

### Vocabulary check before you start

- **Session** — state maintained *within* one ongoing interaction
  (a conversation or multi-step task) — what's been said, what
  parameters are filled, where the agent is in a multi-step process.
- **Memory** (as distinct from a session) — state that persists
  *across* separate interactions over time (e.g., a fact learned last
  month, still known today).
- **RAG (retrieval-augmented generation)** — a pattern where, before
  the LLM generates a response, a retrieval step first finds relevant
  content from a knowledge source and feeds it to the LLM as context,
  so the response is grounded in real, specific content rather than
  the model's general training.
- **Embedding / embedding model** — a model that converts text (or
  other content) into a dense numeric vector, positioning
  semantically similar content close together in vector space, so
  "similar meaning" becomes "nearby points" a computer can search
  efficiently.
- **Vector database** — a database purpose-built for storing
  embeddings and performing fast nearest-neighbor similarity search
  over them (as opposed to a relational database's exact-match/
  structured-query model).
- **Function-calling / tool-calling** — the mechanism by which an LLM
  can decide to invoke a defined function/tool (rather than just
  generate text), passing it structured arguments, and receive a
  result it can incorporate into its next response.

---

## 1. Scenario for this lab

Building on Labs 01–02's fictional retail company: engineering now
wants a **custom, code-built support-triage agent** that can retrieve
answers from a larger, evolving internal knowledge base (product
manuals, internal runbooks — not just the single returns-policy
document from Lab 01), remember customer context across separate
support interactions, and eventually (Lab 04) hand off to a specialist
agent for complex cases. This lab covers the foundation (3.1) and
knowledge integration (3.2); Lab 04 covers the orchestration layer
(3.3) on top of what you build here.

---

## 2. Part A — model selection (task 3.1, first bullet)

### 2.1 Work the three-axis decision framework, don't skip to an answer

Recall the three independent axes from
`01-domains/SECTION-3-custom-agents.md` §1.1: **size** (LLM vs. SLM),
**hosting** (self-hosted vs. SaaS), **licensing** (OSS vs.
proprietary). This lab's agent has two genuinely different sub-tasks
that pull toward different answers on the size axis — a realistic
situation, and exactly the kind of "vary one axis at a time" scenario
the domain file's §1.1.4 decision tree is built to handle:

1. **Ticket triage/classification** — sorting an incoming support
   message into a category (billing, technical, returns, other).
   Narrow, well-defined, high-volume, latency-sensitive → per
   §1.1.1's comparison table, this is the textbook **SLM** fit.
2. **Answer drafting** — synthesizing a helpful, nuanced response
   using retrieved knowledge-base content. Broader, open-ended
   reasoning over arbitrary employee/customer questions → this is the
   textbook **LLM** fit.

For hosting and licensing, this lab's fictional company has no
regulatory data-residency requirement and no in-house ML infra team —
walking the decision tree in §1.1.4 ("cost/latency OK with SaaS?" →
yes), **SaaS** is the right call for both models, using **Gemini
LLMs** (Google's proprietary, SaaS-delivered family, named explicitly
in the domain file's §1.1.4 as one of the two Google-Cloud-specific
names worth anchoring, alongside Model Garden) for the drafting model,
and a smaller SaaS-delivered model for classification.

**Don't** skip straight to "use Gemini for everything" without walking
this reasoning — a scenario question on the exam will change one of
these constraints (e.g., "the company handles regulated healthcare
data and cannot let any prompt content leave their infrastructure")
and expect you to re-walk the tree to a different answer (self-hosted,
here), not recite a memorized "always use the biggest model" default.

### 2.2 Illustrative ADK agent scaffold with model selection

```python
from adk import Agent, ModelConfig

triage_agent = Agent(
    name="ticket-triage-agent",
    model=ModelConfig(
        provider="gemini",
        model_name="gemini-flash",  # smaller/faster tier — SLM-class
        temperature=0.0,             # deterministic classification,
                                      # not creative generation
    ),
    system_instructions=(
        "Classify the incoming support message into exactly one "
        "category: billing, technical, returns, or other. "
        "Respond with only the category name."
    ),
)

drafting_agent = Agent(
    name="response-drafting-agent",
    model=ModelConfig(
        provider="gemini",
        model_name="gemini-pro",    # larger/broader-reasoning tier
        temperature=0.3,             # some latitude for natural,
                                      # well-phrased responses
    ),
    system_instructions=(
        "Draft a helpful, accurate support response using only "
        "the retrieved knowledge-base context provided to you. "
        "Cite the specific source document for any factual claim."
    ),
)
```

**Reasoning behind the two `temperature` values, not just the
numbers:** classification has one correct answer per input — you want
the model's output to be as deterministic and repeatable as possible,
so `temperature=0.0` (minimizing randomness) is the right choice.
Drafting a response benefits from a little more natural language
variation without sacrificing groundedness, so a low-but-nonzero
`temperature=0.3` is reasonable — this is a small illustrative
example of "considering cost, security, and agent architecture" (the
guide's own phrase for task 3.1's model-selection bullet) translating
into an actual code-level configuration choice, not just an abstract
comparison table.

---

## 3. Part B — sessions and memory (task 3.1, third bullet)

### 3.1 Configure a managed session for in-conversation state

Recall the distinction from `01-domains/SECTION-3-custom-agents.md`
§1.3: a **managed session** holds state *within* one ongoing
interaction; **Memory Bank** holds state that persists *across*
interactions. Get this right in code — it's the same distinction
tested in that file's Q4.

```python
from adk import Session

session = Session.create(
    agent=drafting_agent,
    session_id="ticket-48213-session",
)

# Turn 1
response_1 = session.send("My order hasn't arrived yet.")

# Turn 2 — the session remembers turn 1's context automatically;
# the calling code does NOT need to manually re-send prior turns.
response_2 = session.send("It was order #48213, placed 10 days ago.")
```

**Why this matters architecturally:** without a managed session, your
own application code would have to manually accumulate and re-send
the entire conversation history on every turn — error-prone (easy to
truncate or lose context) and wasteful (re-sending growing history on
every call). The managed session's whole purpose is to remove that
burden from you as the builder, per the domain file's framing:
"without the calling application having to manually thread all prior
turns through every request."

### 3.2 Configure Memory Bank for durable, cross-session facts

```python
from adk import MemoryBank

memory = MemoryBank(agent=drafting_agent)

# At the END of a session, selectively promote a durable fact —
# NOT every turn of the conversation.
memory.write(
    subject="customer:48213",
    fact="Prefers email contact over phone for follow-ups.",
)

# In a LATER, separate session (weeks later), the agent can recall it:
recalled = memory.read(subject="customer:48213")
# recalled includes: "Prefers email contact over phone for follow-ups."
```

**Why `memory.write` happens at the end of the session, and only for
one selective fact, not the whole transcript:** this is the direct
application of the domain file's don't-use/use guidance in §1.3 —
"don't use Memory Bank to store every turn of every conversation
indefinitely... selectively promote only meaningfully durable facts to
Memory Bank." Writing the full transcript to Memory Bank would bloat
future retrieval (the agent would have to sift through irrelevant
turn-by-turn chatter to find the one fact that matters), and raises
unnecessary privacy/retention exposure for content that didn't need to
be retained past the session's own lifetime.

### 3.3 A common beginner mistake to explicitly avoid

Don't write ordinary conversational content ("the customer said hello,
then asked about their order") into Memory Bank just because it's
technically possible. Ask, for each candidate fact: *would a future,
unrelated session meaningfully benefit from knowing this?* "Prefers
email contact" — yes, this will matter in every future interaction.
"Said hello at the start of the call" — no, this is transient session
noise. This filtering judgment is exactly what the domain file's
"selectively promote" language is asking you to exercise, and it's a
realistic design decision you'll have to make repeatedly when building
a real ADK agent, not a one-time setup step.

---

## 4. Part C — configuring skills via Agents CLI (task 3.1, fourth bullet)

Recall from `01-domains/SECTION-3-custom-agents.md` §1.4: this is the
*build-time* counterpart to Lab 02's Agents CLI coverage — here,
Agents CLI configures a **custom** agent's skills (plugins) and
**agent vs. human mode**, as you build it, distinct from Lab 02's
coding-agent-operational framing.

```bash
agents-cli skills attach \
  --agent ticket-triage-agent \
  --plugin knowledge-base-lookup

agents-cli mode set \
  --agent response-drafting-agent \
  --capability "kb_lookup" --mode agent \
  --capability "issue_refund" --mode human
```

**Reasoning:** per-capability mode configuration, not a single global
setting — the exact don't-use/use guidance restated from
`01-domains/SECTION-3-custom-agents.md` §1.4: `kb_lookup` (a read-only
retrieval action) runs in **agent mode** because it's low-stakes and
reversible (worst case, it retrieves the wrong document, which the
drafting agent's citation requirement and a human reviewer can catch);
`issue_refund` (a capability with real financial and customer-trust
consequences) runs in **human mode**, requiring a person to actually
drive or approve that specific action. Setting the whole agent to one
mode globally would either block useful autonomous work
(`kb_lookup` unnecessarily gated) or expose a real financial action to
ungated autonomy — both wrong, for different reasons.

---

## 5. Part D — building the RAG pipeline (task 3.2, first bullet)

This is the deepest part of this lab. Build the full pipeline
diagrammed in `01-domains/SECTION-3-custom-agents.md` §2.1: ingest →
embed → store → (at query time) embed the query → similarity search →
rerank → ground the LLM.

### 5.1 Ingest and chunk the knowledge base

```python
from adk.rag import Chunker, load_documents

docs = load_documents(source="gs://retail-co-kb/product-manuals/")
chunks = Chunker(
    strategy="semantic",   # chunk on natural topic boundaries,
                            # not a fixed character count that could
                            # split a policy rule mid-sentence
    max_chunk_tokens=512,
).split(docs)
```

**Why "semantic" chunking, not fixed-size chunking:** a naive
fixed-character chunker can slice a document exactly in the middle of
an important sentence or rule (e.g., splitting "Electronics require
original packaging" from the exception clause that follows it two
sentences later), which then gets retrieved and grounded on
*incompletely*. Chunking on natural topic/section boundaries keeps
each retrievable unit semantically whole, which is a design decision
that directly affects retrieval quality downstream — a beginner
mistake is treating chunking as a mechanical "just split every N
characters" step rather than a quality-affecting design choice.

### 5.2 Choose and apply an embedding model, consistently

```python
from adk.rag import EmbeddingModel, VectorStore

embedding_model = EmbeddingModel(name="text-embedding-005")

vector_store = VectorStore.create(
    backend="vector-search-1.0",   # Vector Search 1.0 / Agent
                                    # Retrieval — the custom-code
                                    # vector database, per
                                    # SECTION-3-custom-agents.md §2.2
    embedding_model=embedding_model,
)
vector_store.upsert(chunks)
```

**The single most important warning in this whole lab, restated from
the domain file's exam-trap coverage (§2.1, and Q5 in that file's
practice set):** whatever `embedding_model` you use at ingestion time
here, you **must** use the exact same model at query time (§5.4
below). If you ever "upgrade" to a newer embedding model, you must
re-embed the *entire existing corpus* with the new model — you cannot
mix vectors from two different embedding models in the same
similarity search and expect meaningful results, because different
embedding models don't share a common vector space. This failure mode
is dangerous precisely because it doesn't throw an error — it just
silently, gradually degrades retrieval quality, which is much harder
to diagnose after the fact than an outright crash.

### 5.3 Why Vector Search 1.0 / Agent Retrieval here, and not Cloud SQL/Firestore

Per `01-domains/SECTION-3-custom-agents.md` §2.2's decision table: the
product-manual/runbook content this agent retrieves needs *semantic*
similarity search ("find content related in meaning to this query"),
not exact-match/structured lookup. A relational or document database
isn't built for nearest-neighbor vector search at RAG's core — using
one here would be the flagged anti-pattern from that section. (If this
same agent also needed to look up a customer's exact order record by
order ID, *that* lookup would correctly go through a structured data
service like Cloud SQL or Firestore instead — the point isn't "vector
databases replace structured databases everywhere," it's "match the
data-access pattern to the right service.")

### 5.4 Query-time retrieval, similarity scoring, and reranking

```python
from adk.rag import Retriever, Reranker

retriever = Retriever(
    vector_store=vector_store,
    embedding_model=embedding_model,  # SAME model as §5.2 — this
                                       # is not optional
    top_k=20,                         # cast a moderately wide net
                                       # at the fast similarity-
                                       # search stage
)

reranker = Reranker(model="semantic-reranker-001", top_n=5)

def retrieve_context(query: str):
    candidates = retriever.search(query)     # step 5: similarity
                                              # scoring (e.g. cosine
                                              # similarity)
    reranked = reranker.rerank(query, candidates)  # step 6: rerank
    return reranked[:5]
```

**Reasoning behind `top_k=20` then reranking down to 5, instead of
just retrieving 5 directly:** this mirrors the two-stage pattern in
`01-domains/SECTION-3-custom-agents.md` §2.1 exactly — fast
approximate similarity search is good at surfacing a relevant
*candidate set* but not always the best at fine *ordering*. Casting a
slightly wider net (20 candidates) at the cheap similarity-scoring
stage, then applying the more expensive, more accurate reranking model
to reorder and trim down to the final 5, captures documents that a
narrower top-5-only similarity search might have ranked just outside
the cutoff on the first pass, but that the finer-grained reranker
correctly recognizes as highly relevant.

### 5.5 Should this specific pipeline use reranking? Yes — justify it explicitly

Per the don't-use/use guidance in
`01-domains/SECTION-3-custom-agents.md` §2.1: reranking trades latency
and cost for precision, so it's justified when answer precision
matters a lot, and skippable when latency is the dominant constraint
and the corpus is already reliably well-served by similarity search
alone. This lab's scenario — a support agent citing product-manual and
policy content back to customers — has real precision stakes (an
incorrect policy citation is a real cost, potentially a compliance or
trust problem), so **use reranking here**. Contrast this explicitly
with a hypothetical low-stakes internal tool (e.g., "suggest three
loosely related internal wiki pages") where skipping reranking to save
latency would be the right call instead — the decision is scenario-
dependent, not a blanket rule.

### 5.6 Wire retrieval into the drafting agent

```python
def handle_support_message(session: Session, message: str):
    context_chunks = retrieve_context(message)
    grounded_prompt = (
        f"User question: {message}\n\n"
        f"Retrieved context:\n"
        + "\n---\n".join(c.text for c in context_chunks)
    )
    return session.send(grounded_prompt)
```

---

## 6. Part E — Agent Identity for this agent's permissions (task 3.2, second bullet)

Recall from `01-domains/SECTION-3-custom-agents.md` §2.3: **Agent
Identity** is the mechanism for scoping what a given agent is
permitted to access. Configure it now, even in this lab-scale system,
rather than treating permission scoping as an afterthought once
something is "really" in production:

```python
from adk import AgentIdentity

drafting_agent.identity = AgentIdentity(
    allowed_data_sources=["gs://retail-co-kb/product-manuals/"],
    denied_data_sources=["gs://retail-co-internal/hr-records/"],
)
```

**Why explicitly deny HR records here, not just allow the product
manuals:** an explicit deny list, even when it looks redundant next to
an allow list, is a defense-in-depth habit — if a future change
accidentally widens the allow list (e.g., someone points the vector
store at a broader bucket by mistake), an explicit deny still blocks
access to clearly out-of-scope sensitive data. This is the same
least-privilege instinct from §2.3's don't-use/use guidance ("don't
use a single, maximally-privileged shared identity... use Agent
Identity to scope each agent's permissions to only what that specific
agent's task requires") applied concretely. Full PAB (principal access
boundary) policy depth is Lab 06's job — this lab only introduces
Agent Identity as the scoping mechanism.

---

## 7. Part F — registering the capability (task 3.2, third bullet)

Recall from `01-domains/SECTION-3-custom-agents.md` §2.4: rather than
hard-coding this agent's knowledge-base connection in a way no other
agent can discover or reuse, register it in **Agent Registry**:

```python
from adk import AgentRegistry

AgentRegistry.register_capability(
    name="retail-co-product-kb-lookup",
    backing_service="vector-search-1.0",
    exposed_via="google-cloud-mcp-server",  # or a custom MCP server,
                                              # if this were a
                                              # third-party SaaS tool
    owner_agent=drafting_agent.name,
)
```

**Why this matters for Lab 04:** this registration step is exactly
what will let a *different* agent (the specialist escalation agent
you'll build in Lab 04) discover and reuse this same knowledge-base
lookup capability instead of duplicating the whole RAG pipeline a
second time — the anti-pattern the domain file's §2.4 explicitly warns
against ("don't use ad hoc, agent-specific hard-coded tool
integrations duplicated across every agent that needs the same
capability").

---

## 8. What you should be able to explain after this lab

- [ ] Why this lab's scenario justified reaching for ADK instead of
      staying with Lab 01's low-code agent (task 3.1).
- [ ] How to walk the LLM-vs-SLM / self-hosted-vs-SaaS / OSS-vs-
      proprietary decision framework for a given scenario, and why
      this lab's two sub-tasks (triage vs. drafting) landed on
      different model sizes (task 3.1).
- [ ] The difference between a managed session and Memory Bank, with
      a concrete example of what belongs in each from this lab (task
      3.1).
- [ ] Why per-capability agent-vs-human mode configuration is correct
      and a single global setting is not (task 3.1).
- [ ] Every stage of the RAG pipeline in order — ingest, chunk, embed,
      store, query-embed, similarity search, rerank, ground — and why
      the query-time embedding model must match the ingestion-time
      embedding model exactly (task 3.2).
- [ ] Why this lab's scenario justified adding a reranking stage, and
      when you would skip reranking instead (task 3.2).
- [ ] Why Vector Search 1.0 / Agent Retrieval was the right store for
      this content, and when a structured database (Cloud SQL,
      Firestore) would be the better choice instead (task 3.2).
- [ ] What Agent Identity scopes for this agent, and why an explicit
      deny list adds real value even alongside an allow list (task
      3.2).
- [ ] Why the knowledge-base lookup capability was registered in
      Agent Registry rather than left as a private implementation
      detail of the drafting agent (task 3.2).
