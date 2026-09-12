# Section 1 Questions — Building Agents Using Low-Code Tools

> **What this file is.** 13 interview-style questions focused
> specifically on **Section 1** of the exam (~13% weight): Gemini
> Enterprise as the low-code agent platform, Agent Designer and CX
> Agent Studio as its builder tools, state-based workflow design, and
> connecting enterprise data via Agent Search. This file goes deeper
> and wider than `00-fundamentals-and-basics-questions.md`'s Section-1
> questions (which are ground-zero definitions) and uses different
> scenarios than `agentic-architect-scenario-questions.md`'s two
> existing Section-1 questions (a retailer chatbot and a multimodal
> diagnosis) — treat all three files as complementary, not overlapping.
>
> **How to use this file.** These assume you already know what
> low-code agent building is (see the fundamentals file if not) and
> test whether you can make the *next* level of judgment call: which
> builder tool, how to structure the workflow, where a design breaks
> down, and where low-code's real ceiling is.
>
> **Grounding.** Questions reference `04-architectures/pattern-low-code-cx-agent.md`
> for the production pattern this section is built around, and
> occasionally the **Meridian Tools** capstone
> (`05-labs/lab-07-capstone-realtime-agentic-project.md`) for a
> concrete worked example — but most scenarios here are new situations
> (a benefits-enrollment flow, a multi-brand deployment, a retail bank)
> so this file doesn't just re-narrate Meridian.
>
> **Currency note.** Every answer below uses **Agent Runtime** (never
> Agent Engine), **Agent Search** (never Vertex AI Search), **Gemini
> Enterprise** (never "Vertex AI Agent Builder"), **Antigravity** /
> **Claude Code on Google Cloud** (never "Gemini Code Assist"), and
> treats **ADK as open-source** and **PAB as an Agent-Identity-specific
> mechanism**, not generic IAM. See `../CLAUDE.md` §7 for the full
> corrections table.

---

### Q1. "Your company already has a Gemini Enterprise deployment. HR wants two things added to it: a benefits-enrollment flow that has to walk employees through a strict, ordered sequence of steps (dependent info, coverage tier, beneficiary designation, e-signature), and a general 'ask HR anything' Q&A agent for policy questions. Do these need two different builder tools, or one?"

**What's really being asked.** Whether the candidate treats "low-code" as one undifferentiated bucket, or correctly distinguishes Agent Designer from CX Agent Studio by what each is actually good at — and whether both can coexist under one Gemini Enterprise app.

**Model answer.** These are two different *shapes* of problem wearing the same "low-code" label, so yes — two different builder tools, under the same Gemini Enterprise deployment. The enrollment flow is a **strict, ordered, stateful process**: every employee must pass through the same steps in the same order, each step has validation (a beneficiary designation can't be submitted before coverage tier is picked), and there's a hard completion state (e-signature). That's exactly what **Agent Designer**'s page/transition-route/event-handler model is built for — I'd model each step as its own page, use transition routes with explicit validation conditions to gate forward movement, and make the e-signature page a terminal state with its own completion event handler.

The "ask HR anything" agent is the opposite shape: **open-ended, conversational, grounded on a document corpus** (policy PDFs, benefits handbooks) rather than a fixed sequence. That's **CX Agent Studio**'s strength — it's built around conversational grounding via Agent Search and channel-aware behavior (live-agent escalation, conversation history) rather than rigid page sequencing. Forcing this into Agent Designer's page model would mean either a single giant catch-all page (losing CX Agent Studio's better-tuned retrieval and escalation handling) or an awkward multi-page tree trying to anticipate every possible HR question, which doesn't scale.

Both agents can live under the same Gemini Enterprise app and share the same underlying **Agent Search** corpus if the Q&A agent needs some of the same policy documents the enrollment flow references (e.g., a coverage-tier comparison page) — sharing the platform and even the data source doesn't mean sharing the builder tool, because the builder choice tracks the *conversation shape*, not the *department* asking for it.

**Why not "just build both in Agent Designer since it's more powerful and can technically do open-ended Q&A too"?** Agent Designer *can* technically approximate open-ended Q&A with a catch-all page and Agent Search-backed responses, but you'd be rebuilding CX Agent Studio's own strengths (conversation-shape-aware retrieval, escalation handling) by hand, inside a tool optimized for deterministic sequencing instead. "More powerful" isn't the right axis — the right axis is "which tool's default behavior matches this conversation's actual shape without extra engineering to compensate."

---

### Q2. "Design the page, transition-route, and event-handler structure for a returns/exchange flow: a customer can return an item for a refund, exchange it for a different size, or exchange it for a different item entirely — and at any point they might abandon the flow or ask an unrelated question."

**What's really being asked.** Whether the candidate can actually decompose a moderately complex conversation into Agent Designer's primitives correctly — not just name the primitives, but get the page boundaries, route priority, and event-handler placement right.

**Model answer.** I'd start from the branch point, not the entry point: the real complexity here is that "exchange for a different size" and "exchange for a different item" are structurally different flows (one needs inventory-availability check on a *variant* of the same SKU, the other needs a full product search), so they deserve separate pages even though a user might describe both as "I want to exchange this."

```
[Entry: "Return or Exchange?"]
        |
        |--- intent: refund -----------> [Refund: Reason + Condition] -> [Refund: Confirm] -> [Done]
        |
        |--- intent: exchange ---------> [Exchange: Same Item, New Size?]
        |                                        |
        |                                        |--- yes --> [Variant Availability Check] -> [Confirm] -> [Done]
        |                                        |
        |                                        |--- no ---> [Exchange: Product Search] -> [Confirm] -> [Done]
        |
   event handlers (attached at FLOW level, apply to every page above):
        |--- no-match / low-confidence (x2 in a row) --> [Live Agent Handoff]
        |--- explicit "cancel" / "never mind"          --> [Abandon: Save Progress?] -> [Done or Exit]
        |--- unrelated question ("what's your return policy window?") --> [Policy Q&A sub-flow, then RETURN to
              the page the user was on before the interruption]
```

The event handlers matter more than the happy-path pages here. I'd attach the no-match/low-confidence handler and the cancel handler at the **flow level** (so they apply uniformly across every page) rather than duplicating them per page — that's a common Agent Designer mistake that leads to inconsistent escalation behavior depending on which page a user happens to be on. The "unrelated question" handler is the trickiest one: it needs to route to a small Q&A sub-flow *and then return the user to their prior page state*, not restart the whole flow — losing a user's place because they asked "what's your return window" mid-flow is a real, common production complaint.

For transition-route priority, the "same item, new size?" branch is checked before the general product-search branch, because a size-only exchange is the higher-frequency, lower-friction case — if I put general product search first, a route-matching ambiguity (a user says "exchange for a different size" in a way that partially matches both routes) would risk sending simple size exchanges down the more expensive product-search path.

**Why not "just make the no-match handler a single global fallback that always jumps to a generic 'how can I help' page"?** That's a common shortcut that discards conversation state — jumping to a generic fallback page loses which specific flow (refund vs. exchange) the customer was in, forcing them to restate their entire request. A well-designed fallback should route to a handoff or Q&A sub-flow *without leaving the customer's current page context*, exactly like the diagram's "unrelated question" handler does by returning to the prior page.

---

### Q3. "You're building an eligibility-check bot that must reason through several conditional rules (income thresholds, household size, existing enrollment status) *and* emit a strict, fixed-shape JSON object at the end for a downstream system to consume. How do you structure the prompt template?"

**What's really being asked.** Whether the candidate understands that few-shot prompting and chain-of-thought aren't competing techniques — they solve different problems and often need to be combined in one template, and whether the candidate knows how to combine them without the reasoning leaking into the structured output.

**Model answer.** This needs both techniques doing two different jobs in the same template, not one technique chosen over the other. **Chain-of-thought** is what gets the multi-condition reasoning right — income threshold vs. household-size band vs. existing-enrollment exclusion isn't a single lookup, it's a small decision tree, and prompting the model to reason through the conditions explicitly ("first check X, then check Y given X's result...") measurably reduces the "skipped a condition" failure mode compared to asking for the answer directly. **Few-shot examples** are what pin down the exact JSON shape and field names — chain-of-thought reasoning tends to produce correct *logic* but inconsistent *formatting* if the output shape isn't separately anchored with concrete examples.

The structural trick is keeping them from bleeding into each other: I'd have the template instruct the model to reason step-by-step in one clearly delimited section, then emit *only* the JSON object after an explicit delimiter (e.g., "After your reasoning, output a line containing only `---JSON---`, then the JSON object and nothing else"), with 2-3 few-shot examples showing exactly that two-part shape — reasoning, delimiter, clean JSON. Without the delimiter and matching few-shot examples, chain-of-thought reasoning has a tendency to leak fragments into the JSON output ("the household size condition is met so eligible: true") which breaks a downstream parser expecting strict JSON.

**Why not "skip chain-of-thought and just give five few-shot examples covering different eligibility combinations, since that's simpler to build"?** Few-shot examples alone teach the model to pattern-match against the *specific combinations shown*, not to correctly generalize the underlying conditional logic to combinations not covered by an example. With three independent conditions (income, household size, enrollment status), the combination space is larger than five examples can safely cover, and a purely example-matched model is more likely to silently mis-classify an edge-case combination it wasn't shown. Chain-of-thought reasoning generalizes the *logic*; few-shot examples anchor the *format* — dropping the reasoning step to simplify the build trades reliability for a false sense of simplicity.

---

### Q4. "A production support bot has a broad 'general question' catch-all route and a narrow 'check my order status' route. After a recent update, most order-status questions are being answered by the general catch-all instead of the order-status route — even though the order-status route clearly still exists and works when tested in isolation. Diagnose it."

**What's really being asked.** Whether the candidate understands transition-route matching is priority-ordered and confidence-scored, not just "does a matching route exist" — a classic silent production regression in low-code flows.

**Model answer.** This is almost certainly a **route ordering or route-broadening regression**, not a broken route — the fact that it works in isolation confirms the order-status route's own matching logic is intact, so the bug is in how it competes against the catch-all at runtime. Two likely causes, and I'd check both:

First, I'd check whether the catch-all route's match conditions were recently broadened (a common "let's make the general Q&A route smarter" change) in a way that now scores confidently enough on order-status-shaped phrasing to win before the more specific route is evaluated. If routes are evaluated in a fixed priority order, a broadened catch-all placed *before* the order-status route in that order would start intercepting matches it previously didn't touch.

Second, I'd check whether the order-status route's match phrases are too narrow relative to how users are now actually phrasing the question (real phrasing drifts over time — "where's my order" vs. "order status" vs. "when will my package arrive" aren't all guaranteed to match the same trained phrases), which would mean the general route isn't "stealing" the match so much as winning it fairly because the specific route's own coverage regressed.

The fix in either case is the same principle: **more specific routes need to be evaluated before more general ones**, and a route's match confidence threshold and phrase coverage need periodic revalidation as real user phrasing data comes in — this isn't a "set once" configuration.

```
BEFORE (regression):                      AFTER (fixed):
[General Q&A catch-all]  ← evaluated 1st  [Order Status route]     ← evaluated 1st (specific)
[Order Status route]     ← evaluated 2nd  [General Q&A catch-all]  ← evaluated 2nd (broad fallback)
```

**Why not "just lower the general catch-all's confidence threshold so it matches less often"?** That's treating the symptom, not the structural cause — a lowered threshold might reduce false-positive matches today, but it doesn't fix the underlying priority-ordering problem, and the next broadening change to the catch-all (or the next phrasing drift on the specific route) will reproduce the same regression. The durable fix is making route specificity-ordering an explicit, reviewed part of any change to either route, not tuning a threshold number reactively each time it breaks.

---

### Q5. "Design a single Gemini Enterprise deployment that serves three different internal brands under one retail holding company, where each brand's support agent needs to answer questions from that brand's own product documentation only — no brand should ever see another brand's internal pricing or product data."

**What's really being asked.** Whether the candidate can extend "securely connect and query enterprise data" (task 1.2) from a single-corpus mental model to a multi-tenant, access-scoped one — a portfolio-scale version of the same task.

**Model answer.** The core design decision is **per-brand access scoping on a shared Agent Search deployment**, not three fully separate deployments — three separate Gemini Enterprise apps would work but throws away the operational benefit of shared platform management (one place to monitor, one place to roll out platform-level changes) for isolation that a properly-scoped shared deployment already provides.

```
                    [Gemini Enterprise — one deployment]
                             |
        +--------------------+--------------------+
        |                    |                     |
  [Brand A CX Agent]   [Brand B CX Agent]    [Brand C CX Agent]
        |                    |                     |
        v                    v                     v
  [Agent Search:       [Agent Search:        [Agent Search:
   Brand A corpus       Brand B corpus        Brand C corpus
   ONLY, access-        ONLY, access-         ONLY, access-
   scoped]              scoped]               scoped]
```

Each brand's agent is configured with an Agent Search data-source binding scoped to *only* that brand's ingested documents — the access boundary is enforced at the data-source-connection layer, not by trusting the agent's own prompt instructions to "only talk about Brand A." Relying on prompt instructions alone to enforce a data-visibility boundary is fragile — a sufficiently unusual user question, or a prompt-injection attempt, could induce the model to reference content it technically still has retrieval access to, even if instructed not to. The corpus-level scoping means there's no Brand B data available to leak in the first place, regardless of what the model is instructed to do.

I'd also flag this as a place to loop in the exam's Section 5 concerns even though this is a Section 1 design: per-brand access scoping is exactly the kind of boundary that should be periodically audited (who can modify which brand's data-source binding), even though the mechanism itself (Agent Search's connection-level scoping) is configured here in Section 1's tooling.

**Why not "one shared Agent Search corpus across all three brands, with the system instructions telling each brand's agent to only reference its own brand's documents"?** This is the fragile version described above — it works under normal conversation but has no hard guarantee against a model referencing cross-brand content under adversarial or unusual input, since the retrieval layer itself has access to everything. The corpus-level access boundary is what makes the isolation a structural guarantee instead of a behavioral hope.

---

### Q6. "A hard compliance rule — 'never discuss competitor products by name, redirect to a neutral comparison instead' — needs to apply across every single page of a 12-page CX Agent Studio flow. Where does that rule live?"

**What's really being asked.** Whether the candidate correctly places a cross-cutting governance constraint at the system-instruction level rather than duplicating it into every page's prompt template — a maintainability and reliability distinction, not just a style preference.

**Model answer.** A rule that must hold across *every* page, regardless of what that page is otherwise doing, belongs in the **system instructions** — the persistent instruction layer that applies to the entire agent's behavior — not repeated inside each of the 12 pages' individual prompt templates. System instructions are evaluated as standing context for every model call the agent makes, so putting the competitor-mention rule there means it's enforced uniformly by construction, and a future 13th page inherits the rule automatically without anyone remembering to copy it in.

Putting it in each page's prompt template instead creates two real risks: first, someone adding page 13 later has to remember to copy the rule in, and it's exactly the kind of easy-to-forget step that produces a compliance gap; second, even across the existing 12 pages, slightly different phrasings of "don't mention competitors" copied into each template independently can produce inconsistent enforcement strength — a subtly weaker phrasing on one page is a real compliance exposure, not just a style inconsistency.

Prompt templates, by contrast, are the right place for *page-specific* instructions — what this particular page is trying to accomplish, what parameters to collect, what tone shift (if any) is appropriate for this step. The distinction is standing/global vs. situational/local, and a hard compliance rule is definitionally the former.

**Why not "put it in the top-level entry page's instructions, since that's where every conversation starts"?** The entry page's instructions don't automatically propagate to every other page in the flow the way system instructions do — a rule placed only on the entry page is enforced for the entry page's own model calls, not for the other 11 pages downstream, which is exactly the gap this question is testing whether the candidate catches. System instructions, not any single page's instructions, are what apply agent-wide.

---

### Q7. "On the same order-tracking page, a user might ask 'what's your return policy for electronics?' (a documentation question) or 'where is my order #48213?' (a live-data question). Both come in as free text on the same page. How do you route each correctly, and what happens if someone asks both in one message?"

**What's really being asked.** Whether the candidate can tell the difference between a grounding-retrieval question and a webhook/live-data question at the intent level, and has a real answer for the harder case of a single turn needing both.

**Model answer.** These are two fundamentally different data-access patterns wearing the same "question on the order-tracking page" surface: the return-policy question is **static or slow-changing document content** — a good fit for **Agent Search** grounding against the policy documentation. The order-status question is **live, per-customer, frequently-changing data** that doesn't exist as ingestible documents at all — that has to go through a **fulfillment webhook** call against the order-management system, not a document retrieval.

I'd route based on intent classification at the page level: a return-policy-shaped question routes to an Agent-Search-grounded response; an order-status-shaped question (especially one containing an order number, a strong signal) routes to the webhook transition route. For the combined case — one message containing both — I would not try to force a single model turn to both call the webhook and produce a grounded document answer in one shot reliably; instead I'd have the page's handler recognize the compound intent, sequence the two: fire the webhook call for order status first (usually the more time-sensitive part), then follow with the grounded policy answer, and present both in one reply. This is more reliable than hoping a single combined prompt correctly triggers both an external call and a retrieval-grounded generation in the same pass.

```
User message on Order Tracking page
        |
        v
  [Intent classification]
        |
   +----+-------------------+
   |                        |
policy-shaped          order-number-shaped (or both)
   |                        |
   v                        v
[Agent Search:        [Fulfillment webhook call]
 return policy docs]         |
   |                         v
   |                  [order status result]
   +----------+--------------+
              v
     [Combined reply: status result, then policy answer]
```

**Why not "just let Agent Search try to answer everything, including order status, since it's already grounded on the site's help documentation"?** Order status for a specific order number isn't help documentation — it's live, per-customer transactional data that doesn't exist in any document corpus Agent Search could be grounded on. Attempting to answer it via document retrieval alone would either fail outright or, worse, hallucinate a plausible-looking but wrong status by pattern-matching against generic help content, which is a much worse failure mode than a clear "let me look that up" webhook call.

---

### Q8. "Design the ingestion pipeline for a support agent that needs to draw on two new unstructured sources: a library of ~2,000 recorded sales calls (audio) and a catalog of product photos with informal internal annotations. How do you verify the ingestion actually made this content usefully retrievable, rather than just 'technically present'?"

**What's really being asked.** Whether the candidate can design a real multimodal ingestion pipeline for two different modalities at once, and — critically — whether they build in verification rather than assuming ingestion success means retrieval usefulness.

**Model answer.** Audio and images need different preprocessing before they're usable by Agent Search's retrieval layer, so this is two ingestion paths converging on one corpus, not one generic "multimodal ingest" step.

```
[2,000 sales call recordings]           [Product photo catalog + annotations]
        |                                          |
        v                                          v
[Transcription pass]                     [Image + annotation pairing]
        |                                          |
        v                                          v
[Chunk transcripts by topic/turn,        [Index images with their annotation
 attach call metadata: date, product     text as the primary retrievable
 line discussed, call outcome]           signal; image itself as supporting
        |                                 context, not the retrieval key]
        v                                          v
        +--------------------+---------------------+
                             |
                             v
                  [Agent Search corpus, tagged
                   by source type + metadata]
                             |
                             v
                  [VERIFICATION LOOP: sample
                   real support questions, confirm
                   whether audio/image-sourced
                   content actually surfaces in
                   top results, not just text docs]
```

For the audio, transcription is the real ingestion step — Agent Search retrieves against text, so a recording is only useful once it's transcribed and chunked sensibly (by topic or conversational turn, not arbitrary time windows, so a retrieved chunk is coherent on its own). For the photos, the informal annotations are doing the retrieval work, not the raw pixels — I'd index the annotation text as the primary searchable signal and treat the image as supporting content returned alongside a match, since Agent Search's retrieval strength is text-semantic, not visual-semantic, matching.

The verification step is the part that's easy to skip and shouldn't be: I'd take a sample of real historical support questions that *should* be answerable from the newly-ingested audio and image content specifically, run them against the updated corpus, and confirm the new content is actually surfacing in top retrieval results — not just present in the index somewhere. Ingestion completing without errors is not the same claim as "this content is now genuinely improving answer quality," and the only way to know the difference is to test retrieval against realistic queries after ingestion, not just confirm the ingestion job's exit code.

**Why not "trust that once the files are uploaded and the ingestion job completes successfully, the content is retrievable"?** A successful ingestion job confirms the *pipeline ran without errors*, not that the resulting chunks are semantically well-formed enough to actually surface for relevant queries — poorly-chunked transcripts (e.g., split at arbitrary time boundaries mid-sentence) or annotation text that's too sparse to match real question phrasing can both "ingest successfully" while remaining functionally unretrievable. Verification against real queries is the only way to catch that gap before a customer does.

---

### Q9. "A support bot that answers a single, simple factual question ('what are your store hours?') was recently given heavy chain-of-thought prompting — 'think step by step about what the user is really asking, consider multiple interpretations, then reason toward an answer' — and now customers are complaining about slow responses to what should be an instant lookup. What's wrong, and what do you do?"

**What's really being asked.** The mirror image of Q3 — whether the candidate recognizes that chain-of-thought isn't free, and can identify when it's actively hurting rather than helping, not just when to add it.

**Model answer.** This is over-engineering a simple lookup with reasoning machinery it doesn't need. Chain-of-thought prompting earns its cost — additional generated tokens before the final answer, meaning additional latency — when a question genuinely requires multi-step reasoning to answer correctly (like Q3's eligibility check, which has real conditional logic to work through). "What are your store hours?" has no such reasoning requirement: it's a direct lookup against a single, unambiguous fact. Prompting the model to "consider multiple interpretations" of a question that doesn't have meaningfully different interpretations just generates wasted reasoning tokens that add latency without improving accuracy — the answer was already going to be correct with a direct, ungrounded-in-elaborate-reasoning prompt.

The fix is removing the chain-of-thought instruction for this class of simple, single-fact question and reserving it specifically for pages or intents where the underlying task actually has decision-tree-shaped complexity. This is a good argument for **not applying one prompting strategy uniformly across an entire flow** — different pages within the same agent can and should have different prompt-engineering treatments matched to their actual complexity, the same way Q1 argued for different *builder tools* matched to different conversation shapes.

**Why not "keep the chain-of-thought instruction, since more reasoning can only make the answer more reliable"?** More reasoning steps don't uniformly improve reliability — for a task with no real ambiguity or multi-step logic, added reasoning is just added latency and occasionally an opportunity for the model to talk itself into an incorrect answer by "finding" false ambiguity that isn't actually there (over-interpreting a simple question as more complex than it is). Reasoning effort should scale with genuine task complexity, not be applied as a blanket "more is always safer" default.

---

### Q10. "An internal HR agent and an internal IT agent were both built independently in CX Agent Studio. An employee starts a conversation with the HR agent about a laptop-related benefits question that's actually an IT issue, and needs to be handed to the IT agent — without losing the conversation context they've already built up. Can this be done in low-code alone?"

**What's really being asked.** Whether the candidate recognizes this as a genuine structural limit of the low-code/state-machine model rather than something that just needs more clever page design — and can correctly point to what actually solves it (Section 3's agent-to-agent orchestration).

**Model answer.** No — this is a real ceiling of the low-code model, not a configuration problem to solve with better pages. Agent Designer and CX Agent Studio are built around a **single agent's own page/state graph**; there's no native primitive in either tool for one independently-built agent to hand off an in-progress conversation, with its accumulated context, to a *different* independently-built agent and have that second agent resume meaningfully. Each low-code agent's conversation state lives inside its own flow.

What actually solves this is out of Section 1's scope: **structured agent-to-agent handoff**, which is what protocols like **A2A** exist for (Section 3's territory) — a mechanism for one agent to pass conversation context and control to another agent as a first-class operation, rather than the crude approximation available in low-code today (ending the HR conversation, telling the employee to go start a new conversation with the IT agent, and re-explaining their issue from scratch).

I'd say this plainly if asked in an interview, rather than trying to engineer around it: the honest answer is "this specific requirement — genuine cross-agent handoff preserving context — is the signal that you've outgrown what low-code alone can deliver, and it's a legitimate reason to bring in a custom, orchestrated multi-agent architecture for this specific interaction pattern, even if the rest of the platform stays low-code." Recognizing your own tool's boundary is itself part of the system-design judgment being tested here.

**Why not "build a shared 'router' page that both flows point to, which manually re-collects context and forwards it as parameters"?** This can approximate a *narrow, pre-anticipated* handoff (e.g., a fixed set of known reasons to transfer, with a small fixed set of parameters to carry over), but it doesn't generalize — it requires anticipating every possible handoff reason and manually engineering a parameter-passing scheme for each, and still doesn't give the receiving agent genuine conversational context (just a few forwarded fields), which is a much weaker guarantee than true agent-to-agent context handoff. It's a workaround for a narrow case, not a solution to the general problem.

---

### Q11. "Design a CX Agent Studio escalation flow that hands a frustrated customer to a live human agent — and, for compliance-audit purposes, must also preserve the full conversation transcript and a machine-readable reason code for why the escalation happened."

**What's really being asked.** Whether the candidate can extend a "basic escalation" design (already covered generically in the architecture pattern file) with a specific compliance/audit-trail requirement layered on top — a common real-world elaboration of a textbook pattern.

**Model answer.** The escalation event itself is the easy part — a low-confidence or repeated-failure event handler routing to a live-agent transition. The compliance requirement is what needs deliberate design: **the transcript and reason code have to be captured and attached at the moment of escalation, not reconstructed afterward.**

```
[Any page in the flow]
        |
   event handler fires: low-confidence (x2) / explicit "talk to a human" / repeated-failure
        |
        v
[Escalation Handler page]
        |
        |--- capture FULL conversation transcript so far (every turn, this session)
        |--- capture REASON CODE (structured, not free text): e.g.
        |       LOW_CONFIDENCE_REPEATED | EXPLICIT_REQUEST | POLICY_EXCLUSION_HIT
        |--- capture page/state at time of escalation (which flow, which step)
        |
        v
[Live-agent handoff system: receives transcript + reason code + state
 as a structured payload, not just "customer wants help"]
        |
        v
[Audit log: escalation event, transcript reference, reason code,
 timestamp — retained per compliance retention policy]
```

The reason code should be a fixed, structured enumeration (not free-text the model generates in the moment) precisely because it needs to be machine-readable for audit reporting later — "why did escalations spike this month" is a question compliance will ask, and answering it requires reason codes that can be counted and categorized, not paraphrased free text that a human has to re-read and manually classify after the fact. I'd generate the reason code from the event-handler type that actually fired (which is already a known, finite set), not ask the model to freely describe why it's escalating.

**Why not "just forward the conversation to the live agent and let them read through it themselves to figure out why it escalated"?** That satisfies the "human takes over" requirement but not the compliance requirement — without a structured, logged reason code captured at the moment of escalation, there's no efficient way to audit escalation patterns in aggregate later (how many escalations were policy exclusions vs. low-confidence failures), and relying on a human agent's after-the-fact interpretation of a raw transcript is neither consistent nor really "machine-readable" in the way an audit trail needs to be.

---

### Q12. "Your team wants to A/B test two different phrasings of the same prompt template on a high-traffic page — 'Let's find the right solution together' vs. a more direct 'How can I help?' — entirely within the low-code console, no custom code. What can you actually measure this way, and where's the ceiling?"

**What's really being asked.** Whether the candidate understands what's realistically configurable and measurable in-console versus where a requirement quietly needs to graduate to Section 4's dedicated evaluation tooling — a boundary-of-the-platform question, not a pure Section 1 build question.

**Model answer.** In-console, low-code tooling can reasonably support a **basic split test with surface-level engagement metrics**: routing some percentage of sessions to phrasing A versus phrasing B, and comparing simple, directly-observable signals like session completion rate, escalation rate, or average turns-to-resolution between the two variants. That's genuinely useful for a question like "does a warmer or more direct opening phrase lead to fewer immediate drop-offs."

The ceiling shows up quickly once the question gets more rigorous than that. If the team wants **statistical significance testing**, **controlled evaluation against a labeled golden dataset** (did variant A actually produce *more correct* answers, not just more engagement), or **automated regression detection** (did this variant quietly get worse over the last two weeks), that's not something low-code console metrics are built to provide — that's squarely Section 4's territory: proper evaluation pipelines, golden datasets, and evaluation tooling (ADK evalset / Agent Platform Gen AI evaluation service) exist precisely because "measure it in the console" tops out at basic engagement comparison and doesn't give you rigorous correctness or quality measurement.

I'd frame this plainly to a stakeholder asking for a "quick A/B test": what you can get for free in-console is a decent first signal on engagement; what you can't get without moving to dedicated evaluation tooling is confidence that one variant is actually *more correct*, not just more engaging in a way that might not hold up under a wider sample.

**Why not "just eyeball the two variants' conversation transcripts side by side to judge which reads better"?** Manual side-by-side reading doesn't scale past a handful of example conversations and is exactly the kind of subjective, unsystematic evaluation that a real evaluation pipeline (golden dataset, consistent scoring criteria, enough sample size for statistical confidence) is designed to replace. It might catch an obviously bad variant, but it can't reliably detect a modest quality difference the way structured evaluation tooling can — and it doesn't scale as a repeatable process for the next A/B test.

---

### Q13. "A retail bank wants one Gemini Enterprise deployment to serve three lines of business: retail banking (simple FAQ — hours, fees, card replacement), wealth management (complex multi-step onboarding with compliance sign-offs), and small-business banking (a mix of both). Each line has different data-access needs and different tone/compliance requirements. Design it."

**What's really being asked.** An integrative closer that forces the candidate to apply Section 1.1 and 1.2's full surface — builder-tool choice, system instructions, and Agent Search access-scoping — in one coherent design, across genuinely different complexity levels within the same platform.

**Model answer.** I'd treat this the same way as Q1's HR case but at bank-wide scale: **builder tool choice tracks conversation shape, not organizational line**, so retail banking's simple FAQ shape gets **CX Agent Studio** (conversational, Agent-Search-grounded against public rate/fee/hours documentation), while wealth management's strict, compliance-gated onboarding sequence gets **Agent Designer** (explicit pages for each onboarding step, with compliance sign-off as a hard gate before advancing — this cannot be a "the model decided this looks complete" judgment call, it needs an explicit confirmation page). Small-business banking, being a genuine mix, gets **both**: a CX Agent Studio front door for general questions, with an Agent-Designer-built sub-flow for anything resembling formal onboarding (e.g., opening a business checking account).

```
                        [Gemini Enterprise — one bank-wide deployment]
                                        |
        +-------------------------------+-------------------------------+
        |                               |                               |
[Retail Banking]                [Wealth Management]           [Small Business Banking]
CX Agent Studio                  Agent Designer                CX Agent Studio (general)
(FAQ, fees, hours)               (multi-step onboarding,       + Agent Designer sub-flow
        |                        compliance gate pages)         (formal account opening)
        v                               |                               |
[Agent Search:                          v                               v
 public rate/fee docs]          [System instructions:            [Agent Search: SMB-specific
                                  strict compliance tone,          docs] + [Agent Designer:
                                  no informal language,            onboarding gate pages]
                                  mandatory disclosures]
```

System instructions differ meaningfully by line: wealth management's instructions need to enforce a formal, compliance-conscious tone and mandatory disclosure language on every relevant turn (a system-instruction-level concern, per Q6's reasoning), while retail's can be more conversational. Data access is scoped per line the same way as Q5's multi-brand design — wealth management's Agent Search corpus (if any document grounding is used for general wealth FAQs) should not surface retail-tier product terms, and vice versa, enforced at the data-source-connection level, not by instruction alone.

**Why not "build three fully separate Gemini Enterprise deployments, one per line of business, to keep things simplest to reason about"?** That avoids any cross-line data-boundary design work, but at the cost of three times the platform-level operational overhead (monitoring, updates, governance) for isolation that a single deployment with proper per-line access scoping already achieves safely — the same tradeoff Q5 already worked through. "Simpler to reason about upfront" isn't the same as "cheaper to operate long-term," and a bank-wide platform is exactly the scale where shared operational overhead matters.
