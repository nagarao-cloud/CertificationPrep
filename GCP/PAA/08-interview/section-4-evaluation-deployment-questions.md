# Section 4 Questions — Evaluating and Deploying Agentic Workflows

> **What this file is.** 22 interview-style diagnostic and design
> questions focused specifically on **Section 4** of the exam (~22%
> weight): building test sets and evaluation pipelines, choosing
> evaluation frameworks, selecting a deployment runtime, and
> troubleshooting production issues (drift, latency, reasoning loops,
> system failures). `agentic-architect-scenario-questions.md` already
> has 4 Section-4 questions (eval-tool layering, drift diagnosis, a
> 3-way runtime choice, staged rollout) — this file goes past those
> with new scenarios and new sub-topics, not a repeat of that ground.
>
> **How to use this file.** More than half of these are "diagnose this
> failing production system" questions, because that's how Section 4
> is actually tested in a real interview — not "define evaluation,"
> but "here's a system behaving strangely, find the cause." Read each
> scenario and try to name the root cause before reading the model
> answer.
>
> **Grounding.** Questions reference `04-architectures/pattern-evaluation-deployment-pipeline.md`
> for the reference pipeline shape, and occasionally
> `05-labs/lab-07-capstone-realtime-agentic-project.md` Phases 4-5
> (including §5.3.3's reasoning-loop-hang incident) as a worked example
> — referenced, not re-narrated wholesale.
>
> **Currency note.** Every answer below uses **Agent Runtime** (never
> Agent Engine), **Agent Search** (never Vertex AI Search), **Gemini
> Enterprise** (never "Vertex AI Agent Builder"), **Antigravity** /
> **Claude Code on Google Cloud** (never "Gemini Code Assist"), and
> treats **ADK as open-source** and **PAB as an Agent-Identity-specific
> mechanism**, not generic IAM. See `../CLAUDE.md` §7 for the full
> corrections table.

---

## A. Building test sets, golden data, and edge cases

### Q1. "You're launching a brand-new agent with zero production history. Where does 'golden' evaluation data even come from before you have any real traffic to draw on?"

**What's really being asked.** A chicken-and-egg question: whether the candidate has a real answer for bootstrapping evaluation before the thing they'd normally draw golden data from (production traffic) exists yet.

**Model answer.** Golden data at launch has to come from **expert-curated seed cases**, not production logs that don't exist yet — I'd have subject-matter experts (the people who'd actually field these requests today, or who designed the agent's intended scope) write out a representative set of realistic prompts and their correct expected outputs, covering the agent's core intended use cases plus the failure modes they already know are likely (ambiguous requests, out-of-scope questions, missing required information). This is slower and more labor-intensive than mining logs, but it's the only source of truth available pre-launch.

I'd supplement expert-curated cases with **synthetic-but-verified** cases: using a model to generate plausible variations on the expert-written seed cases (different phrasings of the same underlying request), but with every synthetic case reviewed and corrected by a human before it enters the golden set — synthetic generation alone, unverified, risks baking in the generating model's own blind spots as if they were ground truth. Once the agent is live, I'd treat this seed set as a starting point to expand from with real traffic, not a one-time exercise — the golden set should grow and get harder as production reveals cases the original experts didn't anticipate.

```
[Expert-curated seed cases]         [Synthetic variations generated
 (SMEs write realistic               from seed cases]
 prompts + correct outputs)                   |
        |                                     v
        |                          [Human review/correction of
        |                           EVERY synthetic case before
        |                           it enters the golden set]
        +------------------+------------------+
                            v
                 [Pre-launch golden dataset]
                            |
                            v
              [Post-launch: expand with real
               production cases as they surface
               new patterns the seed set missed]
```

**Why not "just launch with a minimal eval and start pulling golden data from real production logs once we have some traffic"?** That's a first-mover trap — it means launching without any real evaluation coverage during exactly the period when the agent is least proven and most likely to have undiscovered gaps, and it delays discovering a fundamental design flaw until real users have already hit it. Waiting for production traffic to build your first golden set means your first real users are unwittingly doing the QA work that should have happened before launch.

---

### Q2. "You're designing edge cases for a new agent that fields ambiguous, multi-part customer requests. What categories of edge case are non-optional — not just 'whatever the QA team happens to think of'?"

**What's really being asked.** Whether the candidate has a structured mental model for edge-case coverage, rather than treating edge-case discovery as unstructured brainstorming.

**Model answer.** I'd insist on covering at least four structural categories, because ad hoc brainstorming reliably misses at least one of them: **(1) ambiguous intent** — a request that could reasonably be interpreted two different ways, testing whether the agent asks a clarifying question rather than guessing; **(2) partial/incomplete information** — a request missing a piece of information the agent needs to act, testing whether it recognizes the gap rather than proceeding on an assumption; **(3) out-of-scope requests** — something the agent has no business handling, testing whether it correctly declines/redirects rather than attempting a plausible-sounding but wrong answer; **(4) multi-part requests with an internal conflict** — a single message asking for two things that can't both be satisfied as stated, testing whether the agent surfaces the conflict rather than silently picking one and ignoring the other.

Each category tests a genuinely different failure mode, which is exactly why "whatever QA happens to think of" is unreliable — unstructured brainstorming tends to cluster around whichever category is most intuitively obvious (usually out-of-scope requests) and under-represent the others (multi-part internal conflicts are the one most often missed, in my experience, because they require imagining a specific kind of self-contradictory user message rather than just an unusual one).

**Why not "let the QA team generate edge cases based on their general testing experience, the same way they would for any other product feature"?** General QA testing experience is tuned for deterministic software (a given input reliably reproduces a given bug), not for probabilistic, language-understanding behavior — an experienced QA tester without a structured category framework specific to agentic systems will produce real edge cases, but with gaps that are hard to notice are missing, precisely because "I didn't think of that category" isn't visible the way "I didn't think of that specific test" would be with a checklist in hand.

---

### Q3. "An agent scores near-perfect on every pre-launch evaluation metric — then fails noticeably within days of real production traffic. Diagnose it."

**What's really being asked.** Whether the candidate correctly identifies an eval/production distribution mismatch — a day-one gap — rather than confusing it with drift (which is gradual) or assuming the evaluation tooling itself is broken.

**Model answer.** Near-perfect pre-launch scores combined with immediate real-world failure is a strong signal that the **evaluation set doesn't represent the real input distribution**, not that the model degraded (nothing has had time to drift yet) and not that the eval tooling malfunctioned (it presumably scored what it was given correctly — the problem is what it was given).

```
[Pre-launch eval set]                [Real production traffic]
  narrow, expert-curated,              broader phrasing, unexpected
  clean, well-formed prompts           request shapes, edge cases
        |                              the eval set never covered
        v                                       |
[Near-perfect score]                            v
                                       [Real failures within days]
        |                                       |
        +------------------+--------------------+
                            v
              GAP: eval set distribution ≠
              real traffic distribution
```

I'd investigate by sampling real production failures and checking whether they resemble *any* case in the golden set — if the failing real-world requests are structurally different from what the eval set tested (different phrasing patterns, request types, or complexity the eval set never included), that confirms a coverage gap rather than a scoring problem. The fix is expanding the golden set with real failure cases and reassessing what the original test-set-design process missed, echoing Q1's point that a pre-launch golden set is a starting point, not a finished artifact.

**Why not "the eval must be broken somehow — rerun it and see if the score holds"?** Rerunning an eval that scored correctly against the data it was given will just reproduce the same near-perfect score, because the evaluation mechanism isn't malfunctioning — it faithfully measured performance against an unrepresentative test set. Rerunning wastes a diagnostic cycle confirming something that was never actually broken, when the real question is about the *test set's* representativeness, not the eval process's correctness.

---

### Q4. "Design edge cases specifically for a multi-turn conversational agent — not single-turn prompts, but session-level failure modes."

**What's really being asked.** Whether the candidate recognizes that a fundamentally multi-turn agent needs edge cases that only exist *across* turns, distinct from single-turn prompt testing.

**Model answer.** Single-turn edge cases (Q2's categories) still matter, but they miss an entire class of failure that only shows up across a session: **topic-switching mid-conversation** (a user abruptly changes subject — does the agent correctly drop stale context, or does it confusingly blend the old and new topic?), **context accumulation errors** (does information from turn 2 get incorrectly carried into turn 8 after it's no longer relevant?), **conversation-length degradation** (does response quality or instruction-following noticeably decay in very long sessions?), and **contradictory statements across turns** (a user says one thing in turn 2 and something that conflicts with it in turn 6 — does the agent notice and flag the conflict, or silently act on stale information?).

```
[Turn 1] --> [Turn 2] --> [Turn 3: TOPIC SWITCH] --> [Turn 4] --> [Turn 8: references
                                    |                                turn-2 info that's
                                    v                                now stale/irrelevant]
                          Test: does agent drop
                          stale context cleanly,
                          or blend old + new topic
                          confusingly?
```

Designing these requires actually constructing multi-turn test conversations, not just a list of individual prompts — the edge case *is* the sequence, so the golden data for this category has to be a scripted conversation with an expected behavior at a specific later turn, not an isolated input/output pair.

**Why not "test single-turn prompts covering a wide variety of topics, since that gives broad coverage of what the agent might be asked"?** Single-turn breadth tells you nothing about session-level failure modes like context bleed or topic-switch confusion, because those failures are definitionally about *behavior across turns*, not about any individual turn's correctness in isolation — an agent could pass every single-turn prompt perfectly and still fail badly the moment a real multi-turn conversation exercises exactly the sequence-dependent behavior single-turn testing can't see.

---

## B. Continuous evaluation pipelines and tool-execution success criteria

### Q5. "Define tool-execution success criteria from scratch for an agent with several distinct tools — not just 'did it call a tool,' but what actually counts as success."

**What's really being asked.** Whether the candidate decomposes tool-execution correctness into its real component checks, rather than treating "a tool was called" as sufficient evidence of correctness.

**Model answer.** "Did it call a tool" is necessary but nowhere near sufficient — I'd define success as three distinct, separately-checkable conditions that all have to hold: **(1) right tool** — did the agent select the correct tool for this request, out of the tools available, rather than a plausible-but-wrong alternative; **(2) right arguments** — were the parameters passed to that tool actually correct (the right order ID, the right date range, correctly formatted), not just structurally valid; **(3) result correctly incorporated** — did the agent's final response actually reflect what the tool returned, rather than ignoring the result, misreading it, or blending it with a hallucinated detail.

```
[User request]
       |
       v
[Agent selects a tool] ---------> CHECK 1: right tool?
       |
       v
[Agent calls tool with args] ---> CHECK 2: right arguments?
       |
       v
[Tool returns a result]
       |
       v
[Agent incorporates result
 into final response] -----------> CHECK 3: result correctly
                                    incorporated into the answer?
```

Each check catches a different failure that the others miss: a right-tool, wrong-argument call still produces a wrong answer even though tool selection was correct; a right-tool, right-argument call whose result the agent then ignores or misstates is a different failure again, invisible if you only check that the call happened.

**Why not "score based on the final answer's text quality, and infer tool correctness indirectly from whether the final answer looks right"?** A final answer can look plausible and well-written while being built on a wrong tool call, wrong arguments, or a misread result — text-quality scoring alone can't distinguish "the agent reasoned well from correct data" from "the agent wrote confidently about incorrect or misapplied data," which is exactly the distinction tool-execution-specific checks are designed to catch.

---

### Q6. "Your evaluation pipeline runs continuously and reliably — but the golden dataset and edge cases it's testing against haven't been updated in months, even as the agent and its use cases evolved. Diagnose and fix."

**What's really being asked.** Whether the candidate distinguishes "the evaluation pipeline runs" from "the evaluation is still meaningful" — a meta-failure in the test data itself, not the pipeline mechanics.

**Model answer.** A pipeline that runs on schedule and a test set that stays representative are two different things, and this is a case where the first is healthy while the second has silently failed. As the agent's scope, tools, or typical requests evolve, a golden set frozen at an earlier point in time increasingly tests scenarios that no longer reflect what the agent actually needs to handle well today — the pipeline keeps reporting "still passing," but that's passing against an increasingly outdated bar, not evidence the agent is actually still doing well against current, real demands.

```
[Continuous eval pipeline] ---- runs on schedule, reports "passing" ---> still GREEN
        |
        v
[Golden dataset] ---- frozen months ago, doesn't reflect --------------> silently STALE
                       current agent scope/use cases
```

The fix is treating golden-dataset maintenance as its own standing discipline, not a one-time setup task: a periodic review cadence (say, quarterly, or triggered whenever the agent's scope changes materially) where someone actively checks whether the test set still reflects current real usage, adds new cases for new capabilities, and retires cases for deprecated ones. I'd also track a simple proxy metric — how long since the golden set was last meaningfully updated — as its own monitored signal, since staleness itself is otherwise invisible from the pipeline's own "still passing" output.

**Why not "the pipeline is continuous, so evaluation coverage is being maintained automatically"?** "Continuous" describes the *cadence of execution*, not the *currency of what's being tested* — running the same stale test set every hour is still continuous, and still tells you nothing new about how well the agent handles the requests it's actually getting today versus the requests it was getting when the test set was written.

---

## C. Choosing an evaluation framework and tooling

### Q7. "A team built their agent entirely in Gemini Enterprise / CX Agent Studio — low-code, no ADK. Is ADK evalset still usable for evaluating it? If not, what fills that gap?"

**What's really being asked.** Whether the candidate understands ADK evalset's actual scope (an ADK-specific tool) rather than assuming every evaluation framework named in the exam guide applies universally regardless of how the agent was built.

**Model answer.** No — **ADK evalset is built specifically around ADK's own agent structure and execution model**, so a low-code agent built entirely in Gemini Enterprise / CX Agent Studio, with no ADK code involved, isn't a natural fit for it. Forcing ADK evalset onto a non-ADK agent would mean either building an artificial ADK-shaped wrapper around a low-code agent purely to satisfy the tooling (real engineering overhead for no genuine benefit) or getting a poor, mismatched evaluation experience.

```
[ADK-built custom agent] -------> ADK evalset: natural fit,
                                    evaluates ADK's own
                                    execution structure directly

[Gemini Enterprise / CX Agent    -------> Agent Platform Gen AI
 Studio low-code agent]                    evaluation service,
                                            OR a custom autorater
                                            built around the
                                            agent's actual
                                            console-level behavior
```

The gap is filled by the **Agent Platform Gen AI evaluation service** (a more general-purpose evaluation offering not tied to ADK's specific structure) or a **custom autorater** built to assess the low-code agent's conversational output directly, independent of ADK's internals. The right choice between those two depends on how standard the evaluation need is (the Gen AI evaluation service for common, general-purpose quality checks) versus how specific/unusual the agent's success criteria are (a custom autorater when off-the-shelf scoring doesn't capture what "correct" means for this particular flow).

**Why not "use ADK evalset anyway, since it's the exam's named evaluation tool and presumably works for any agent"?** Assuming a tool works universally because it's named prominently in the exam scope is exactly the kind of surface-level tool-name matching this section tests against — the guide names ADK evalset specifically alongside ADK-based custom development (Section 3.1), and applying it outside that context ignores the actual technical coupling between the tool and the framework it's built to evaluate.

---

### Q8. "Evaluate a multi-agent system's trajectory across an A2A handoff — not one agent's tool calls in isolation, but the sequence spanning the handoff boundary itself. How does evalset-style trajectory checking extend across that boundary?"

**What's really being asked.** Whether the candidate can generalize single-agent trajectory evaluation to a multi-agent handoff, rather than evaluating each agent in isolation and missing handoff-specific bugs.

**Model answer.** Evaluating each agent in the handoff independently — "did Agent A behave correctly on its own, did Agent B behave correctly on its own" — can pass both halves while still missing the actual bug that only exists *at the handoff itself*: was the right context transferred, was it transferred completely, did Agent B correctly resume from where Agent A left off rather than restarting or misinterpreting the handoff payload.

```
[Agent A: triage/routing]
        |
        v
   trajectory checkpoint 1: did Agent A correctly
   decide to hand off, and to the right agent?
        |
        v
   [A2A HANDOFF] --- trajectory checkpoint 2: was the
        |             handoff payload complete and correctly
        |             formed (context, not just a bare intent)?
        v
[Agent B: specialist]
        |
        v
   trajectory checkpoint 3: did Agent B correctly resume
   using the handed-off context, producing a coherent
   continuation rather than a disjointed restart?
```

I'd extend evalset-style trajectory checking with explicit checkpoints that span the handoff boundary itself — not just "Agent A passed its eval" and "Agent B passed its eval" as two separate reports, but a trajectory record that traces one end-to-end request through both agents and the handoff between them, with a dedicated check at the handoff point for context completeness and correct resumption.

**Why not "evaluate each agent completely in isolation, and if both individually pass, trust that the combined system works correctly"?** This is precisely the gap being tested — two independently-correct agents can still produce a broken combined system if the handoff between them drops context, mis-formats the transfer, or triggers an incorrect resumption on the receiving side, none of which either agent's isolated evaluation would ever surface, since neither agent's own eval has visibility into what happens at the seam between them.

---

## D. Response quality vs. retrieval quality

### Q9. "Design a RAG agent's evaluation so that response quality and retrieval quality are genuinely separate, independently actionable metrics — not just conceptually distinct."

**What's really being asked.** Whether the candidate can operationalize the response/retrieval distinction into two concretely different, independently scored measurements, rather than a single holistic "was the answer good" judgment.

**Model answer.** I'd score these at two different points in the pipeline, with two different questions asked at each: **retrieval quality**, measured immediately after the retrieval step, asks "did the system fetch the right source documents for this query" (independent of what the model eventually does with them) — scored against a labeled set of query/correct-document-set pairs, using standard retrieval metrics (did the correct document appear, and how highly ranked). **Response quality**, measured at the final output, asks "given the documents that were actually retrieved, did the model produce a correct, well-grounded answer from them" — scored independently of whether retrieval itself was optimal, because a model can either faithfully use good retrieved documents or fail to use them well, and that's a separate failure mode from bad retrieval.

```
[Query] --> [Retrieval] --> TAP 1: retrieval quality
                              (right documents fetched?
                               scored independent of the
                               model's eventual response)
                |
                v
        [Model generates response
         from retrieved documents] --> TAP 2: response quality
                                        (given THESE documents,
                                         is the answer correct
                                         and well-grounded?)
```

Keeping the two taps separate is what makes the metrics *actionable*: if retrieval quality is low but response quality (conditioned on what was retrieved) is high, the fix is in the retrieval/indexing layer. If retrieval quality is high but response quality is low, the fix is in the prompt/generation layer. A single blended "was the answer good" score can't tell you which layer to actually go fix.

**Why not "have a rater read the final answer holistically and score it as good/bad, since that's ultimately what matters to the user"?** A holistic score does reflect user-facing outcome, but it collapses two independent failure modes into one number, so a low score gives you no actionable direction — you'd have to separately re-investigate whether the problem was retrieval or generation anyway, which is exactly the diagnostic work the two-tap design does automatically as part of scoring, not as an afterthought.

---

### Q10. "After an embedding-model upgrade, retrieval-quality scores silently degrade — but nobody re-embedded the existing vector index. Diagnose it."

**What's really being asked.** Whether the candidate recognizes an embedding-version mismatch between index-time and query-time embeddings, rather than assuming the new model is simply worse.

**Model answer.** This is very likely an **embedding-version mismatch**, not the new model being lower-quality: if the vector index was built using the *old* embedding model, and queries are now being embedded with the *new* model, similarity comparisons are happening between vectors produced by two different embedding spaces — which aren't guaranteed to be comparable at all, even if each model individually produces high-quality embeddings on its own.

```
[Vector index] --- built using OLD embedding model
       |
       v (similarity comparison across two
       |  DIFFERENT embedding spaces —
       |  not a valid comparison)
       ^
[New query] --- embedded using NEW embedding model
```

The fix is **re-embedding the entire existing index** with the new model before treating the new model as the query-time standard — index and query embeddings need to come from the same model (or at minimum, models explicitly designed to be compatible) for similarity scoring to mean anything. I'd verify this diagnosis before committing to the full re-embedding effort by testing a small sample: embed a few known documents with both models and confirm similarity scores against a matching query behave sensibly with the new model alone (same-model index and query) versus the mismatched pairing — if the mismatched pairing shows the degradation and the matched pairing doesn't, that confirms the version-mismatch diagnosis directly.

**Why not "conclude the new embedding model is simply worse and roll back to the old one"?** Rolling back without checking for index/query consistency risks reaching the wrong conclusion — the new model might be perfectly good or even better, and the actual defect is a re-embedding step that was skipped during the upgrade, not the model's inherent quality. Rolling back "fixes" the symptom by coincidence (returning to a consistent old-model index/old-model query pairing) without ever diagnosing what actually went wrong, leaving the team to repeat the same mistake on the next embedding upgrade.

---

## E. Deployment runtime selection

### Q11. "An experimental agent needs frequent, rapid redeploys during active iteration — multiple times a day. Does that change the Agent Runtime vs. Cloud Run calculus compared to a stable production agent?"

**What's really being asked.** Whether the candidate treats iteration velocity as its own independent decision input for runtime choice, rather than applying one blanket rule ("always Agent Runtime for anything agentic") regardless of the deployment's actual lifecycle stage.

**Model answer.** Yes, meaningfully — iteration velocity is a real, separate axis from the usual "is this an agentic workload" framing. **Cloud Run**'s deployment model (fast, lightweight container redeploys, generous request-driven scaling behavior) is well suited to a workload being redeployed many times a day during active experimentation, where deploy speed and low per-deploy friction matter more than the fully-managed agent-specific conveniences **Agent Runtime** provides for a settled, stable production workload.

```
[Iteration velocity: HIGH]          [Iteration velocity: LOW/stable]
 (multiple redeploys/day,            (mature, infrequently-changed
  active experimentation)             production agent)
        |                                      |
        v                                      v
  Cloud Run: fast, lightweight          Agent Runtime: managed
  redeploy cycle favors                 agent-specific conveniences
  experimentation speed                 favor a settled workload
```

This doesn't mean Agent Runtime is wrong for experimental workloads in every case, or that Cloud Run is wrong for stable ones — but a team defaulting to "always use the fully-managed agent-specific runtime" without considering deploy-cycle friction during an actively-iterating phase is missing a real, practical cost that shows up as slower experimentation, not a correctness problem.

**Why not "always use Agent Runtime for anything agentic, since it's the purpose-built option regardless of deployment stage"?** Treating runtime choice as fixed by "is this agentic" alone, ignoring iteration-velocity as its own decision input, optimizes for the steady-state production case at the cost of experimentation speed during the phase where deploy friction actually costs the most — a workload's *current lifecycle stage* is a legitimate, separate factor from its *category* (agentic vs. not).

---

### Q12. "A team has a genuine data-residency and custom-networking requirement forcing node-level infrastructure control — but the org has no prior Kubernetes experience at all. Does the lack of K8s familiarity rule out GKE here?"

**What's really being asked.** Whether the candidate recognizes GKE's real trigger conditions (hard infrastructure-level requirements) as independent of team familiarity, rather than ruling it out by default because "the team doesn't already know Kubernetes."

**Model answer.** No — a genuine, hard requirement for node-level control (specific data-residency guarantees, custom networking topology that only node-level infrastructure access can satisfy) is exactly the kind of trigger condition that makes **GKE** the right choice *regardless* of whether the team already has Kubernetes experience, because the requirement itself isn't optional or satisfiable by a higher-abstraction runtime.

```
[Hard requirement: data-residency +
 custom networking needing node-level
 control]
        |
        v
  Is this requirement satisfiable
  by Agent Runtime or Cloud Run's
  higher-abstraction model?
        |
       NO  --------> GKE is required, REGARDLESS of team's
                       prior Kubernetes familiarity — the
                       requirement is non-negotiable, the
                       skill gap is a cost to absorb, not
                       a reason to pick an incompatible runtime
```

The lack of Kubernetes experience is a real cost to plan for (training, hiring, or bringing in expertise), but it's a cost of *satisfying a genuine requirement*, not a valid reason to choose an infrastructure option that can't actually meet the requirement. I'd be explicit about this distinction with a stakeholder pushing back on GKE for team-familiarity reasons: "the requirement, not our comfort level, determines the runtime — the comfort gap is real and needs a plan, but it doesn't change what's technically required here."

**Why not "avoid GKE because the org has no Kubernetes experience, and find a workaround using Cloud Run or Agent Runtime instead"?** If the underlying requirement (data residency, custom networking) genuinely can't be satisfied by Cloud Run or Agent Runtime's abstraction level, no clever configuration of either makes the requirement go away — ruling out the only runtime that can actually meet a hard requirement, for team-comfort reasons, either fails to satisfy the requirement or forces an expensive, fragile workaround that a properly-scoped GKE deployment wouldn't have needed in the first place.

---

## F. Troubleshooting: drift, latency, reasoning loops, system failures

### Q13. "An agent gets stuck re-calling the same tool with cosmetically different arguments, over and over, never terminating. Walk the full diagnostic path and the fix."

**What's really being asked.** A full end-to-end reasoning-loop diagnosis — tracing the actual cause (a missing termination condition) rather than just treating the symptom.

**Model answer.** I'd start with **Cloud Trace**, looking for the repeated-span pattern this failure mode produces distinctively: the same tool-call span recurring many times in sequence, with only minor argument variation between calls — that pattern itself is close to a diagnostic signature for a reasoning loop, distinct from, say, a single slow call (Q14) or an outright crash (Q15).

```
[Cloud Trace: repeated span pattern]
   tool_call(args=A) -> tool_call(args=A') -> tool_call(args=A'') -> ... (never stops)
                |
                v
   Root cause: agent's reasoning has no explicit
   TERMINATION CONDITION for "this approach isn't
   working, stop retrying and escalate/fail gracefully"
                |
                v
   Fix: add an explicit bounded-retry policy with a
   hard cap + a distinct "give up and report" path,
   not just a longer timeout
```

The root cause is almost always a missing or insufficiently strict **termination condition** in the agent's own reasoning loop — nothing in its instructions or control flow tells it "if this hasn't worked after N attempts, stop and report failure" rather than "keep trying slightly different arguments indefinitely." The fix is an explicit, bounded retry policy with a hard attempt cap and a distinct fallback path (escalate to a human, or return a clear failure message) once that cap is hit — not simply extending how long the system will tolerate the loop before timing out.

**Why not "just raise the timeout or retry limit, so the agent has more attempts to eventually succeed"?** Raising the limit delays when the symptom becomes visible without addressing why the agent never had a real exit condition in the first place — it will still loop indefinitely (or up to the new, larger limit) on the same underlying reasoning gap, just burning more compute and taking longer to fail the same way. The actual fix is giving the agent a defined "stop and report" behavior, not a longer leash.

---

### Q14. "Tool-invocation latency is traced to a slow third-party dependency the team doesn't control. What mitigation options actually help, versus what doesn't?"

**What's really being asked.** Whether the candidate has concrete mitigation options for a latency source outside the team's own control, rather than defaulting to "add more compute."

**Model answer.** Since the bottleneck sits in a dependency the team can't directly speed up, the real options are about **managing around** the latency, not eliminating its root cause: **caching** results for requests likely to repeat (if the dependency's data doesn't change every call, a cache absorbs a meaningful share of the load without touching the dependency at all); **parallelizing independent calls** (if the agent needs results from this slow dependency alongside other, unrelated work, running them concurrently instead of sequentially hides the dependency's latency behind other useful work); **async/background execution** (for cases where the user doesn't need to wait synchronously — kick off the slow call, let the agent continue or respond partially, and surface the result when it's ready); and a **circuit breaker** (if the dependency becomes unreliable rather than just slow, failing fast with a clear degraded-mode response is better than every request hanging on a dependency that's currently unhealthy).

```
[Agent needs slow third-party dependency's result]
        |
   +----+----+----+----+
   |    |    |    |
CACHE  PARALLELIZE  ASYNC  CIRCUIT BREAKER
(if     (if other    (if user   (if dependency
 result  independent  doesn't    becomes
 reuse   work exists   need to    unreliable,
 is      to run        wait       fail fast
 valid)  alongside)    sync)      instead of hang)
```

**Why not "scale up the agent's own compute resources to compensate for the latency"?** The bottleneck is an external dependency's response time, not the agent's own processing capacity — adding more compute to the agent doesn't make the third-party call return any faster, so this "fix" spends money without addressing the actual latency source at all.

---

### Q15. "The agent crashes intermittently in production — but passed every pre-launch test. Walk the diagnostic path, and explain how it differs procedurally from a drift or reasoning-loop investigation."

**What's really being asked.** Whether the candidate has a distinct diagnostic procedure for an outright system failure, rather than treating every production problem with the same generic "check the model" instinct.

**Model answer.** An intermittent crash is fundamentally an **infrastructure/exception-level failure**, not a model-quality or reasoning problem, so the diagnostic path starts in a different place than a drift or reasoning-loop investigation would: I'd go to **Cloud Logging** first, specifically looking for the exception traces and stack information around the crash events, correlating crash timestamps with any pattern in request characteristics, load level, or a specific downstream dependency's health at that moment.

```
Drift/reasoning-loop investigation:        System-failure investigation:
   start with Cloud Trace (behavioral         start with Cloud Logging
   pattern over many requests, model            (exception traces, stack
   reasoning quality over time)                  info, crash-specific errors)
        |                                              |
        v                                              v
   "is the MODEL's output changing               "is the SYSTEM throwing an
    or looping in a bad way?"                      unhandled exception, and
                                                    under what conditions?"
```

This procedural distinction matters because the two investigations look for different signatures in different tools: drift and reasoning loops are about the *content* of the agent's behavior over time (best seen in trace/behavioral data), while an intermittent crash is about the *system* failing outright (best seen in logs and exception data) — starting a crash investigation by scrutinizing model output quality wastes time looking in the wrong layer entirely.

**Why not "treat this as probably a model-quality issue, since something's clearly going wrong with the agent's behavior"?** An intermittent crash isn't a behavior-quality problem at all — the agent isn't producing a bad answer, it's failing to produce any response because the underlying system threw an exception. Framing it as a model-quality issue points the investigation at the wrong layer (prompt engineering, model choice) when the actual defect is almost certainly in exception handling, an edge-case input triggering a code path bug, or an infrastructure condition — none of which model-quality tuning would ever fix.

---

### Q16. "A canary deployment's aggregate metrics look completely healthy, but the new version is quietly failing for one specific user segment, masked by the aggregate. Design canary evaluation to catch this."

**What's really being asked.** Whether the candidate recognizes a Simpson's-paradox-style masking effect and designs segment-aware canary evaluation, rather than trusting an aggregate pass/fail number alone.

**Model answer.** Aggregate metrics can hide a real regression when the affected segment is a minority of total traffic and its degradation is diluted by a majority segment performing normally or even better — the aggregate number genuinely looks fine while a specific group of users is having a materially worse experience.

```
[Canary traffic]
        |
   +----+----+
   |         |
Segment A  Segment B (smaller, e.g. 15% of traffic)
(85% of    |
 traffic,  v
 performing  REGRESSED — but its
 well)       impact is diluted
   |         in the blended
   v         aggregate metric
[AGGREGATE METRIC: looks healthy] <--- masks Segment B's
                                        real regression
```

The fix is designing canary evaluation to report metrics **segmented** by the dimensions most likely to reveal this kind of masking (user cohort, request type, geography, device — whatever segmentation is meaningful for this specific agent), not just one blended number, and setting rollout gates that require *every* meaningfully-sized segment to clear the bar, not just the aggregate. I'd pick segmentation dimensions deliberately based on where past regressions have hidden or where the agent's behavior is known to vary (e.g., segment by request complexity if that's historically where quality varies), rather than segmenting arbitrarily.

**Why not "trust the aggregate pass/fail threshold, and widen the rollout once it clears"?** An aggregate threshold, by construction, can be satisfied even while a real subgroup regression exists, precisely because averaging can dilute a localized problem below the detection threshold — trusting it alone means the canary gate provides false confidence for exactly the failure mode (a segment-specific regression) that segmented evaluation is designed to catch.

---

### Q17. "When should a deployment stage's metric-threshold breach trigger a fully automated rollback, versus pausing and paging a human?"

**What's really being asked.** Whether the candidate can reason about when full automation is appropriate versus risky for rollback decisions, rather than defaulting to either extreme uniformly.

**Model answer.** I'd automate rollback for breaches that are **unambiguous and low-judgment** — a clear, sharp spike in error rate or a hard-crash signal that has essentially no legitimate benign explanation — because waiting for a human to confirm the obvious just extends the blast radius of an already-confirmed-bad deployment. I'd route to a human pause-and-page for breaches that are **borderline or context-dependent** — a metric that's degraded but not catastrophically, where a human might recognize a benign explanation (a known seasonal traffic pattern, a concurrent unrelated incident affecting the baseline) that a purely threshold-based automated system can't distinguish from a genuine regression.

```
[Metric breach detected]
        |
   Is this breach UNAMBIGUOUS
   (sharp error spike, hard
   crash signal, no plausible
   benign explanation)?
        |
   YES ------> AUTOMATED ROLLBACK
        |       (waiting for human confirmation
        |        only extends the blast radius)
   NO  -------> PAUSE + PAGE HUMAN
                 (borderline signal, context-
                  dependent judgment call a
                  threshold alone can't make)
```

The dividing line is roughly "does correctly interpreting this signal require context the automated system doesn't have" — sharp, unambiguous failures don't need that context; borderline degradations often do.

**Why not "fully automate rollback for every threshold breach, to move as fast as possible" (or, the opposite, "manual-only for every breach, to avoid any risk of an incorrect automated rollback")?** Full automation for every signal, including genuinely ambiguous ones, risks rolling back a deployment over a benign, explainable blip a human would have recognized — a wasted rollback with its own disruption cost. Manual-only for every signal defeats the entire point of staged rollout's speed advantage, forcing a human bottleneck even for the sharpest, most unambiguous failures where automated response is both safe and clearly faster.

---

### Q18. "The deployed agent's actual behavior hasn't changed at all — but its evaluation test set silently drifted, because someone edited golden-data expected outputs to 'make tests pass' after a regression was found. Diagnose the actual problem here."

**What's really being asked.** A test-integrity failure distinct from Q6's staleness problem — this is about someone actively altering the test oracle to hide a real regression, not simply forgetting to update it.

**Model answer.** This is a **test-integrity failure**, and it's more serious than the staleness problem in Q6 because it's not neglect — it's someone actively changing what "correct" means in the golden dataset specifically to make a known-bad result look passing, which defeats the entire purpose of having an evaluation gate at all.

```
[Regression found: agent's actual                [Legitimate alternative:
 output changed for the worse]                     fix the actual regression
        |                                           in the AGENT]
        v
[Someone edits the GOLDEN DATA's
 expected output to match the new,
 regressed behavior]
        |
        v
[Pipeline now reports GREEN] <---- but the underlying
                                    regression was never
                                    actually fixed — only
                                    the test's definition
                                    of "correct" moved
```

The fix starts with treating this as a process-integrity issue, not just a data-quality one: golden-dataset changes need their own review and audit trail — who changed an expected output, when, and why — separate from ordinary code review, precisely because a golden-data edit can silently neutralize the evaluation gate's entire purpose without touching a single line of the agent's actual code. I'd also periodically audit golden-data change history looking for edits that correlate suspiciously with a recent test failure, which is close to a diagnostic signature for this exact pattern.

**Why not "treat a newly-green pipeline as proof the regression was fixed, since the tests are passing again"?** A green pipeline only proves the agent's output matches whatever the golden data currently says is correct — if the golden data itself was the thing that changed (rather than the agent's behavior improving), a green result is actively misleading, certifying a regression as acceptable rather than catching it, which is the opposite of what the evaluation gate exists to do.

---

## G. Monitoring, optimizing performance, reliability, and cost

### Q19. "Use Cloud Trace to attribute an end-to-end latency budget across pipeline stages — retrieval, a specific tool call, LLM inference — and decide which stage's optimization would actually move the needle."

**What's really being asked.** Whether the candidate can do stage-level latency attribution and prioritize based on where time is actually dominant, rather than optimizing whichever component is most visible or most recently touched.

**Model answer.** I'd use Cloud Trace to break the end-to-end request span into its labeled sub-stages and look at the **time-share** each stage actually consumes, not just whether each stage is individually "fast enough" in isolation.

```
[End-to-end request: 4.2s total]
        |
   +----+----+----+
   |    |    |
RETRIEVAL  TOOL CALL  LLM INFERENCE
 0.3s      0.4s        3.5s  <--- dominant stage,
 (7%)      (10%)       (83%)      here's where
                                   optimization
                                   actually matters
```

Whichever stage represents the dominant share of the total latency budget is where optimization effort should go first — in this example, LLM inference at 83% of total time dwarfs retrieval and the tool call combined, so speeding up retrieval by half wouldn't meaningfully move the end-to-end number, while even a modest improvement to inference latency (a faster model variant, prompt-length reduction, or streaming partial output to the user) would.

**Why not "optimize the most recently-changed component, or the one that feels most complex, since that's usually where problems hide"?** Recency or perceived complexity has no necessary relationship to actual time-share — optimizing based on intuition rather than measured stage attribution risks investing real engineering effort into a component contributing 7% of total latency while the 83%-dominant stage goes untouched, producing no meaningful improvement to what the user actually experiences.

---

### Q20. "A production agent's cost is climbing steadily — traced to a bounded retry loop that re-runs the same expensive retrieval-plus-LLM call on every retry attempt, not a runaway unbounded loop. Diagnose the cost driver."

**What's really being asked.** Whether the candidate connects a cost problem back to a control-flow inefficiency, rather than assuming rising cost automatically means "the model is too expensive" and reaching for a model swap.

**Model answer.** This is a **control-flow cost problem**, not a model-pricing problem: a bounded retry loop (say, capped at 3 attempts, so it's not the unbounded reasoning-loop failure from Q13) that re-executes the *entire* expensive retrieval-plus-LLM-call sequence on every single retry attempt is paying full price multiple times for what should often be a much cheaper retry.

```
[Attempt 1: retrieval + LLM call] --- fails, retry
        |
        v
[Attempt 2: retrieval + LLM call] --- fails, retry     <-- full expensive
        |                                                   pipeline re-run
        v                                                   on EVERY retry,
[Attempt 3: retrieval + LLM call] --- succeeds              even when only
                                                              part of it
Total cost: 3x full pipeline, when maybe                    actually needed
only the LLM step needed retrying, not                      to re-run
retrieval every time
```

The fix is examining *what actually needs to be retried* — if retrieval succeeded correctly on attempt 1 and only the LLM step's output was unsatisfactory, retries should re-run just the LLM step against the already-retrieved context, not re-run retrieval from scratch each time. This kind of control-flow inefficiency compounds quietly: it's bounded (so it doesn't look like the dramatic, obviously-broken reasoning loop from Q13), but it's still 2-3x more expensive per retried request than necessary, and at production volume that adds up to a real, climbing cost trend.

**Why not "switch to a cheaper model across the board to bring costs down"?** A global model downgrade addresses the symptom (per-call cost) without touching the actual driver (redundant, avoidable re-execution of expensive steps that didn't need to be redone) — it also risks degrading quality for the majority of requests that never hit the retry path at all, trading a real quality cost for a fix that doesn't address the actual source of the cost increase.

---

## H. Build-vs-buy for evaluation tooling

### Q21. "A regulated-industry team needs an evaluation record that satisfies a compliance audit trail requirement. Does the Agent Platform Gen AI evaluation service satisfy that on its own, or do they need something more?"

**What's really being asked.** Whether the candidate treats a named evaluation framework as automatically satisfying any downstream requirement (here, an audit-trail-grade compliance record), rather than checking whether its actual output format and retention meet that specific bar.

**Model answer.** Not necessarily on its own — a general-purpose evaluation service is built to answer "how well is this agent performing," which is a different requirement than "produce an immutable, compliance-grade record of every evaluation decision, retained and traceable in the specific way a regulator or internal audit function requires." Those can overlap significantly, but "the evaluation service exists and produces scores" doesn't automatically mean its output format, retention policy, and tamper-evidence properties meet a compliance bar that was never part of its original design brief.

```
[Agent Platform Gen AI evaluation service]
        |
   produces: performance scores, pass/fail
   signals, general quality metrics
        |
        v
   Does this ALSO satisfy: immutable audit
   trail, specific retention period, tamper-
   evident record-keeping, regulator-specific
   reporting format?
        |
       MAYBE — needs explicit verification,
       not an assumption
```

I'd verify explicitly what the evaluation service's own record-keeping guarantees actually are (retention length, immutability, exportability) against the specific compliance requirement's own language, rather than assuming a match — and if there's a genuine gap (say, the service doesn't retain records long enough, or doesn't produce output in the format an auditor requires), the team likely needs a **custom autorater or a custom harness layered on top**, specifically to capture and retain the compliance-required artifacts the general-purpose service wasn't built to guarantee.

**Why not "assume any named 'evaluation framework' in the exam's scope automatically satisfies a compliance audit-trail requirement, since evaluation and auditing are closely related concepts"?** Conceptual adjacency ("both are about checking correctness/quality") doesn't guarantee the specific technical properties (retention, immutability, format) a compliance audit trail actually requires — assuming a match without verifying is exactly the kind of surface-level reasoning that produces a real compliance gap discovered only during an actual audit, when it's much more costly to fix.

---

## I. Integrative closer

### Q22. "You inherit an agent that's already live in production, with zero evaluation pipeline and no deployment staging at all. Design the retrofit plan, in order, and justify the sequence."

**What's really being asked.** Whether the candidate can correctly prioritize retrofitting evaluation before deployment discipline — you can't safely stage a rollout of a change you have no baseline to evaluate against.

**Model answer.** I'd retrofit in this order, and the sequencing is the actual substance of the answer: **first, build a baseline evaluation** — even a minimal golden set (per Q1's bootstrapping approach, but now informed by real production traffic already available, unlike a true greenfield launch) — to establish what "currently performing correctly" even means for this agent, since none of that exists yet. **Second, add basic production monitoring** (Cloud Logging, Cloud Trace) if it isn't already present, so that any change made going forward is observable. **Third, and only once the first two exist, introduce staged deployment discipline** (canary, staged rollout with rollback gates) for any future change — because staging a rollout *compares* a new version against a baseline, and there's no meaningful baseline to compare against until step one exists.

```
STEP 1: BASELINE EVAL           STEP 2: MONITORING          STEP 3: STAGED DEPLOYMENT
Build golden data from          Ensure Trace/Logging          NOW introduce canary/
already-available real          are actually capturing        staged rollout gates for
production traffic —            what's happening in           future changes — they can
establish what "correct"        production today               finally be COMPARED
means for THIS agent                                            against a real baseline
        |                               |                              |
        +----------------->  sequence matters: can't  <----------------+
                              safely stage a change
                              with no baseline to
                              compare it against
```

**Why not "redeploy the agent through a full staged pipeline immediately, since staged rollout is the safer deployment practice"?** Staged rollout's entire value proposition is comparing a new version's metrics against an established baseline to decide whether to proceed or roll back — attempting that with no baseline evaluation in place means there's nothing meaningful to compare the new version against, so the "staged" process would just be going through rollout motions without the actual safety property staging is supposed to provide. Evaluation-baseline-first isn't optional caution here; it's a genuine prerequisite for staged deployment to mean anything.
