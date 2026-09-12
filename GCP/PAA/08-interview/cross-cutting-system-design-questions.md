# Cross-Cutting System Design Questions — Professional Agentic Architect

> **What this file is.** 20 staff/senior-level synthesis questions that
> deliberately span multiple exam sections at once — the kind a real
> system-design interview actually asks: "design a complete platform
> from scratch," "here's a failing production system, diagnose it,"
> "walk me through one request's full lifecycle." Where the other
> `08-interview/` files each drill into one section or one theme, this
> file forces holding the *whole system* in your head at once. About a
> third of the questions extend the **Meridian Tools** capstone
> (`05-labs/lab-07-capstone-realtime-agentic-project.md`); the rest pose
> brand-new industries and scenarios, so this file doesn't just
> re-narrate the capstone under a different name.
>
> **How to use this file.** These are deliberately the longest, densest
> answers in the folder — every question includes a labeled ASCII
> diagram of the actual system being discussed, because at this level
> "describe the architecture" and "draw the architecture" are the same
> skill. For the 5 diagnose-style questions, the diagram also marks
> exactly where the failure sits.
>
> **Grounding.** Questions draw on all 6 `04-architectures/` patterns,
> the Meridian capstone, and this folder's other 6 `08-interview/`
> files' established scenarios — deliberately avoiding any duplicate
> question or scenario from those files.
>
> **Currency note.** Every answer below uses **Agent Runtime** (never
> Agent Engine), **Agent Search** (never Vertex AI Search), **Gemini
> Enterprise** (never "Vertex AI Agent Builder"), **Antigravity** /
> **Claude Code on Google Cloud** (never "Gemini Code Assist"), and
> treats **ADK as open-source** and **PAB as an Agent-Identity-specific
> mechanism**, not generic IAM. See `../CLAUDE.md` §7 for the full
> corrections table. Any invented number below is explicitly tagged
> **illustrative** — never presented as a measured fact.

---

### Q1. "Design a complete agent platform for a mid-size insurance company's claims-intake process — from document ingestion through deployment and governance, start to finish."

**What's really being asked.** A full, from-scratch, all-five-sections design — whether the candidate can hold the whole lifecycle in their head at once rather than describing one layer in isolation.

**Model answer.** I'd start from what actually varies in claims intake: some claims are simple and formulaic (a routine auto glass claim), others are complex and need judgment (a multi-party liability claim). That split drives the whole design.

```
[Claim submitted: doc + form]
        |
        v
[Gemini Enterprise + CX Agent Studio:
 intake triage — simple, well-formed
 claims handled low-code, end to end]
        |
        +--- COMPLEX claim ---> [Custom ADK agent: extracts claim
        |                        details via Agent Search-grounded
        |                        RAG over policy documents, calls
        |                        claims-management system via MCP
        |                        Server tool]
        |                                |
        |                                v
        |                        [PAB via Agent Identity: read-only
        |                         policy lookup + claim-status write,
        |                         NOTHING else]
        |                                |
        |                                v
        |                        [HITL gate: any payout above
        |                         threshold requires human adjuster
        |                         sign-off — mandatory, not optional,
        |                         given financial + regulatory stakes]
        v
[Agent Runtime deployment, staged
 rollout with canary — per
 pattern-evaluation-deployment-
 pipeline.md]
        |
        v
[Agent Gateway + Model Armor: every
 hop logged, PII in claim documents
 screened via Sensitive Data Protection]
```

The low-code/custom split (Section 1 vs. 3) tracks claim complexity, not an arbitrary line — simple claims are a state-machine shape (Section 1's strength), complex ones need real reasoning over unstructured policy documents and case-specific judgment (Section 3's strength). The mandatory HITL gate on payout isn't a nice-to-have here — insurance payouts above a threshold are exactly the "hard to reverse, real financial + regulatory consequence" case that warrants a hard approval gate rather than autonomous action. Evaluation (Section 4) needs a golden set built from real adjuster decisions, since "correct" here means "matches what a licensed adjuster would conclude," not a generic quality bar.

**Why not "build one single agent that handles every claim end-to-end with full autonomy, since that's the most impressive-sounding design"?** Full autonomy across every claim type ignores that claim complexity genuinely varies — forcing complex, judgment-heavy claims through a low-code state machine produces poor outcomes, while routing simple claims through an expensive custom-agent-plus-mandatory-human-review pipeline wastes both compute and adjuster time on cases that don't need it. The complexity-matched split is what actually serves both ends of the claim distribution well.

---

### Q2. "In a production multi-agent system, two agents keep handing work back and forth to each other and the conversation never terminates. Diagnose and redesign."

**What's really being asked.** A live, in-production infinite-handoff failure — distinct from a discovered-after-the-fact audit finding — testing real-time multi-agent diagnostic skill.

**Model answer.** This is a **circular handoff loop**: Agent A hands off to Agent B believing B can resolve the request, B hands back to A for the same reason, and neither has a termination condition recognizing "we've already tried this."

```
[Agent A] ---A2A handoff---> [Agent B]
    ^                             |
    |                             |
    +------A2A handoff back-------+
    (repeats indefinitely — NEITHER agent
     tracks "have we already looped on this
     request," so each handoff looks fresh
     to the receiving agent)
              [BROKEN: no loop
               detection, no
               termination condition]
```

The fix has two parts. First, **loop detection**: every handoff needs to carry a lightweight trace of the request's handoff history, so a receiving agent can recognize "this exact request already visited me" rather than treating each incoming handoff as novel. Second, a **hard termination condition**: after a small, fixed number of handoffs between the same two agents on the same request, the system needs an explicit fallback — escalate to a human, or route to a third, more capable agent — rather than allowing indefinite back-and-forth. This mirrors the single-agent reasoning-loop fix (a missing exit condition) but at the orchestration layer instead of within one agent's own tool-calling.

**Why not "just add a hard timeout on the overall conversation, so it eventually stops even if the loop continues"?** A timeout stops the *symptom* (the conversation eventually ends) without fixing the *cause* (neither agent recognizes the loop), so every future instance of the same underlying handoff-logic gap reproduces the identical failure, just capped at the timeout duration each time — wasted compute and a bad user experience recurring indefinitely, rather than actually being resolved. Loop detection with a real termination condition fixes the underlying orchestration logic; a timeout just contains the blast radius of a bug that's still there.

---

### Q3. "How would you evolve a low-code MVP into a custom multi-agent system, in general — and at what concrete signal would you actually make that call, rather than being tempted by 'custom is more powerful'?"

**What's really being asked.** A reusable decision framework, not a one-time narrative — testing whether the candidate can generalize the low-code-to-custom evolution question into something usable for any project.

**Model answer.** I'd resist treating "custom is more powerful" as a reason on its own — power without a corresponding need is just cost. The concrete signals I'd actually look for: **(1) a genuine multi-agent orchestration need** — the low-code platform's single-agent state-machine model can't express what's needed (e.g., a real requirement for parallel specialist agents with a merge step); **(2) retrieval/reasoning customization the platform's defaults can't provide** — a demonstrated, evidence-based gap in retrieval quality or reasoning depth that low-code's grounding and prompting tools have been tuned against and still can't close; **(3) an integration requirement low-code can't reach** — a need to call custom internal systems via MCP servers or protocols the low-code platform doesn't expose.

```
[Low-code MVP running in production]
        |
   Evidence review: has the MVP hit
   an ACTUAL, documented limit —
   not a hypothetical one?
        |
   +----+----+----+
   |    |    |
MULTI-  RETRIEVAL/  INTEGRATION
AGENT   REASONING   BEYOND
NEED    GAP         PLATFORM REACH
   |    |    |
   +----+----+
        |
        v
[Evolve to custom ADK — justified
 by a DEMONSTRATED gap, not a
 preference for "more powerful"]
```

The key discipline is requiring the trigger to be **evidence-based and already-hit**, not anticipated — the same "constrained scope beats speculative complexity" principle that runs throughout this folder's other design questions. A team that migrates to custom because they hit one of these three walls in production has a real justification; a team that migrates because custom "feels more serious" is paying real engineering cost for capability they may never use.

**Why not "migrate to custom proactively, early, to avoid the cost of a later migration once the platform is more entrenched"?** Migrating before any of the three concrete signals has actually appeared means paying custom-development cost and losing low-code's maintenance/iteration-speed benefits for a need that might never materialize — "avoid a future migration cost" is speculative, while "the MVP is currently working fine within low-code's actual limits" is the present, factual state that a premature migration discards for no demonstrated benefit.

---

### Q4. "Walk me through the full lifecycle of one employee's question entering Meridian's platform — every hop, every failure mode along the way."

**What's really being asked.** A single-request, runtime hop-by-hop trace — distinct from a build-phase-by-phase design walkthrough — testing whether the candidate can reason about one request's actual journey through an already-built system.

**Model answer.** I'd trace one concrete request end to end, naming the failure mode possible at each hop, not just the happy path.

```
[Employee asks a question]
        |
        v
[Agent Gateway: auth check] ---------- FAILURE MODE: expired/invalid
        |                               OAuth token, request rejected
        v                               before reaching any agent
[Triage/routing agent (SLM)]
        |                              FAILURE MODE: misrouted intent
        |                               classification — question sent
        |                               to the wrong specialist agent
        v
[A2A handoff to specialist
 agent (LLM)]                         FAILURE MODE: incomplete handoff
        |                              payload — specialist lacks
        |                              context to answer well
        v
[RAG retrieval via Agent
 Search / Vector Search 1.0]          FAILURE MODE: retrieval miss —
        |                              relevant document not surfaced,
        |                              or a stale/outdated document is
        v
[Response generation]                 FAILURE MODE: hallucination
        |                              despite correct retrieval, or
        |                              a correct answer poorly
        v                              communicated
[PAB-scoped action, if any
 (e.g., updating a ticket)]           FAILURE MODE: PAB denies an
        |                              action the user legitimately
        |                              needed, with no clear fallback
        v                              message explaining why
[Response returned to employee]
```

Each hop's failure mode requires a different diagnostic approach and a different fix — an auth failure is a Gateway/token issue, a misroute is a triage-agent tuning issue, a retrieval miss is an indexing/embedding issue, a hallucination is a generation/grounding issue, and a PAB denial needs either a policy adjustment (if the access was legitimately needed) or a clearer denial message (if it wasn't). Tracing the whole path this way is what makes an ambiguous "something went wrong" bug report actually diagnosable — knowing which hop to instrument and check first.

**Why not "just check the final response for correctness, and if it's wrong, look at the model/prompt first"?** Jumping straight to the generation layer skips five other hops where the actual defect might live — a wrong final answer could just as easily be a correct model faithfully working from a bad retrieval result, or a correctly-generated answer that never should have reached this specialist agent because triage misrouted it. Diagnosing from the final output backward, without tracing the full hop sequence, risks fixing the wrong layer entirely.

---

### Q5. "Design a single shared agent platform serving three business units with different data-sensitivity and PAB requirements, operated by one central platform team."

**What's really being asked.** A multi-tenant platform design spanning Sections 3 (architecture) and 5 (governance) — whether the candidate can design shared infrastructure with genuinely differentiated per-tenant policy, not just describe multi-tenancy abstractly.

**Model answer.** The pattern here is the same shared-infrastructure/differentiated-policy split used elsewhere in this folder's security questions, but at full platform-architecture scale: shared **Agent Runtime deployment infrastructure, Agent Gateway, and Agent Registry** for operational efficiency, with per-business-unit **PAB policies, Agent Search corpus scoping, and Model Armor tuning** reflecting each unit's actual data-sensitivity profile.

```
              [Shared: Agent Runtime, Agent Gateway,
               Agent Registry — one platform team operates]
                              |
        +---------------------+---------------------+
        |                     |                     |
[Business Unit A]      [Business Unit B]      [Business Unit C]
 low sensitivity         medium sensitivity      high sensitivity
 (e.g. general HR)       (e.g. sales ops)        (e.g. legal/finance)
        |                     |                     |
   PAB: broader          PAB: moderate          PAB: tightest scope
   read access            scope                  Model Armor: strictest
   Agent Search:                                 tier
   dept-scoped corpus
```

The platform team's job is maintaining the shared infrastructure and enforcing that each business unit's actual policy configuration matches its real sensitivity tier — not deciding what each unit's policy *should* be in isolation from that unit's own data-owners, who understand their own compliance requirements better than a central platform team would. I'd design an explicit per-tenant policy review process (echoing the risk-tiered registry review pattern) so onboarding a new business unit means deriving its policy from its actual data profile, not defaulting to the most permissive existing tenant's configuration for convenience.

**Why not "give the central platform team full authority to set one standard policy across all three units, for administrative simplicity"?** A single standard policy either over-restricts the low-sensitivity unit or under-restricts the high-sensitivity one — the entire value of multi-tenant design is that shared infrastructure doesn't require shared policy, and collapsing that distinction for administrative convenience recreates the uniform-policy risk this folder's other governance questions already argue against.

---

### Q6. "Six months post-launch, Meridian's monthly token spend is 5x the original estimate despite flat traffic. Diagnose the full chain of causes and redesign for cost."

**What's really being asked.** *(Illustrative figures throughout — no real Meridian financials exist.)* A cost-diagnosis-and-redesign question spanning Sections 3 and 4, testing whether the candidate can trace a multi-factor cost blowup rather than reaching for one single explanation.

**Model answer.** A 5x cost increase with flat traffic means the cost-per-request itself grew, and that's rarely one single cause — I'd investigate multiple contributing factors rather than stopping at the first plausible one.

```
[Flat request volume] -----> [5x monthly token spend]
        |                            ^
        |                            |
   Possible contributing factors,
   investigated together, not
   independently:
        |
   +----+----+----+----+
   |    |    |    |
PROMPT  REDUNDANT  MODEL   CONTEXT
BLOAT   RETRY      CHOICE  WINDOW
(system  CALLS     DRIFT   GROWTH
 instructions       (upgraded         (session
 grown              to a              history
 unchecked          costlier          accumulating
 over 6              model             unbounded
 months)             tier for          across
                     marginal          long-running
                     quality           conversations)
                     gain)
        |    |    |    |
        +----+----+----+
             v
   [ROOT CAUSE, typically several
    compounding, not one single
    factor — matches Q20's own
    "review the whole system"
    diagnostic instinct]
```

I'd audit each factor concretely: has the system-instruction length grown through incremental additions nobody's pruned (prompt bloat)? Is the bounded-retry pattern from the evaluation-file's own diagnosis re-running full expensive pipelines unnecessarily? Was a model upgrade adopted for a marginal quality gain that doesn't justify its cost delta at this volume? Is per-session context accumulating without a summarization or truncation strategy? A 5x increase against flat traffic is large enough that it's plausible several of these are compounding rather than one alone explaining the whole gap.

**Why not "assume it's the model choice, and immediately downgrade to a cheaper model to bring cost back down"?** Downgrading the model without first diagnosing the actual contributing factors risks degrading quality to fix a cost problem that may be substantially driven by prompt bloat or redundant retries — factors a cheaper model wouldn't fix at all, since they multiply against whatever model is in use. A real diagnosis identifies which factors are actually driving the 5x, so the fix targets the real cause instead of trading away quality for a partial, possibly wrong-cause fix.

---

### Q7. "Design a real-time fraud-flagging agent for a payments company: low-latency requirement, tool calls into external ledger/case-management systems, and mandatory human sign-off above a risk threshold."

**What's really being asked.** A latency-constrained, high-stakes design spanning Sections 3 and 5 — testing whether the candidate can reconcile "fast" and "safe" rather than treating them as automatically compatible.

**Model answer.** Low latency and mandatory human sign-off are in real tension here, so the design has to separate what needs to be fast from what needs to be safe, rather than applying one uniform speed target everywhere.

```
[Transaction stream]
        |
        v
[Low-latency SLM: real-time
 risk-scoring pass] ------- FAST PATH: must complete
        |                    within the payment's own
        |                    latency budget
        v
   Risk score above
   threshold?
        |
   NO -------> [Approve automatically,
        |       log for audit]
   YES ------> [HITL gate: route to human
                case reviewer — NOT on the
                fast path, deliberately
                allowed to take longer,
                since a flagged transaction's
                cost of delay is lower than
                the cost of an unreviewed
                high-risk approval]
                        |
                        v
                [Case-management system:
                 tool call to log/track
                 the flagged case]
```

The design principle: the **low-latency requirement applies to the scoring decision**, not to the human-review path once something is flagged — a transaction serious enough to warrant mandatory sign-off has already, by definition, earned a small delay in exchange for real human judgment, and trying to force that review to also meet the fast-path's latency budget would defeat the purpose of requiring it at all. I'd use a small, fast SLM for the initial scoring pass specifically because that's the leg with a genuine latency constraint, reserving a larger/more careful model or human judgment for the flagged, non-time-critical path.

**Why not "apply the same low-latency requirement to the entire pipeline, including the human sign-off step, to keep the user experience consistently fast"?** Forcing the human-review step to meet the fast-path's latency budget either pressures reviewers to rubber-stamp decisions without real scrutiny (defeating the point of mandatory sign-off) or is simply impossible for genuine human judgment to satisfy — the whole reason a risk threshold triggers human review is that the decision is important enough to warrant taking real time, and the design should reflect that rather than treating consistency of speed as more important than the review's actual integrity.

---

### Q8. "A legal-document review platform's agent has excellent evaluation scores, but outside counsel found it missed a contract clause that materially changed liability. Diagnose the evaluation gap and redesign the evaluation strategy for a hallucination-sensitive domain."

**What's really being asked.** A Section-4-centric diagnosis (with Section 3 implications) — whether the candidate recognizes that "excellent evaluation scores" and "safe for a high-stakes domain" aren't the same claim, and can redesign evaluation accordingly.

**Model answer.** Excellent aggregate scores passing while a materially important clause gets missed suggests the evaluation set's **coverage doesn't weight rare-but-critical cases** the way this domain actually requires — a generic evaluation approach optimized for overall accuracy can look excellent while still missing exactly the low-frequency, high-consequence clause types that matter most in legal review.

```
[General evaluation set: broad
 coverage, common clause types
 well-represented]
        |
        v
[Excellent aggregate score] <---- masks: RARE, high-liability
                                    clause types are UNDER-
                                    REPRESENTED in the eval set,
                                    so a miss on one doesn't move
                                    the aggregate score much
```

The redesign needs a **stratified evaluation approach**: instead of one aggregate accuracy number, evaluate separately against a curated set specifically of rare-but-materially-important clause types (indemnification triggers, liability caps, unusual termination conditions) sourced from actual legal expert review, with a much stricter pass bar for that stratum than for routine boilerplate clauses. For a hallucination-sensitive, high-liability domain, I'd also add a structured **human-expert-in-the-loop review layer** for any document flagged as containing this rare-but-critical clause category, rather than relying on the agent's own confidence signal alone to decide when a human should double-check.

**Why not "just add more general training/evaluation examples across the board, to raise overall accuracy further"?** More general coverage improves the aggregate score, which is already excellent and evidently not the metric that would have caught this specific miss — the actual gap is under-representation of a specific, high-consequence clause category, and broad general improvement doesn't specifically target that stratum any more effectively than the evaluation already (apparently) does.

---

### Q9. "Design an internal, non-diagnostic healthcare-operations support agent — scheduling, internal policy Q&A, explicitly not clinical decision support. Where would you deliberately choose a deterministic, non-agentic component instead of an agent?"

**What's really being asked.** A design question that specifically tests restraint — whether the candidate can identify where *not* to use agentic reasoning, spanning Sections 3 and 5.

**Model answer.** Scheduling logic is the clearest case for a **deterministic, non-agentic component**: checking a provider's actual calendar availability, applying scheduling rules (minimum gap between appointments, room/equipment conflicts), and confirming a booking are all well-defined, rule-based operations with no genuine ambiguity to reason about — an agent calling a deterministic scheduling service as a tool is the right shape, not an agent trying to reason its way through calendar logic itself.

```
[Employee: "can you schedule X with Dr. Y"]
        |
        v
[Low-code or ADK agent: understands the
 REQUEST via natural language]
        |
        v
[DETERMINISTIC scheduling service, called
 as a tool] --- NOT reasoned about by the
        |         agent — pure rule-based logic:
        |         availability check, conflict
        |         detection, booking confirmation
        v
[Agent Search: internal policy Q&A —
 THIS part is genuinely agentic/grounded,
 since policy questions are open-ended
 and benefit from retrieval + generation]
```

The line I'd draw generally: reserve agentic reasoning for genuinely **open-ended, language-understanding-dependent** tasks (understanding what the employee is asking, answering a policy question that requires synthesizing document content) and use deterministic components for anything that's actually a **well-defined rule or lookup** once the request is understood — scheduling conflict logic doesn't get better by being reasoned about probabilistically, it gets slower and less reliable.

**Why not "build the whole thing as one agentic system, including scheduling logic, since the agentic approach can technically handle deterministic tasks too"?** An agent *can* technically attempt scheduling-conflict reasoning, but doing so trades a fast, perfectly reliable deterministic operation for a slower, probabilistic one that could occasionally get calendar math wrong — there's no benefit gained by making a genuinely rule-based task agentic, only added latency and a new failure mode (the agent reasoning incorrectly about something that was never ambiguous in the first place).

---

### Q10. "Meridian's evaluation passed and the canary looked clean, but two weeks after full rollout, user satisfaction quietly dropped. Diagnose across the full lifecycle — evaluation, rollout, and production monitoring — why this wasn't caught earlier."

**What's really being asked.** *(Illustrative scenario.)* A diagnose-and-redesign question spanning both halves of Section 4 — pre-launch evaluation and post-launch monitoring — testing whether the candidate can trace a delayed-onset regression across the whole pipeline.

**Model answer.** A clean canary followed by a delayed, quiet degradation points at a **slow-onset failure mode that a short canary window and a point-in-time evaluation both structurally can't see** — something that only manifests with more usage history, more varied real traffic, or accumulated state than either check was designed to observe.

```
[Pre-launch eval] --- PASSED (point-in-time,
                        fixed golden set)
        |
        v
[Canary: SHORT window] --- CLEAN (too brief to
        |                    surface a slow-onset
        |                    effect)                    [BROKEN: no
        v                                                 gap between
[Full rollout] --------------------------------------->   short-term
        |                                                  checks and
        v                                                  the actual
[TWO WEEKS LATER: quiet                                    onset timeline
 satisfaction drop] <---- only visible now,               of the real
                           because the failure             regression]
                           mode needed more time
                           or accumulated state
                           to appear than either
                           the eval or the canary
                           window covered
```

Likely candidates for what actually happened: a **context-accumulation issue** in longer-running sessions that only shows up after enough real usage history builds up (echoing the multi-turn edge-case reasoning from this folder's evaluation-questions file), or a **slow drift in real traffic patterns** the fixed golden set and short canary never exercised. The fix is extending post-launch monitoring with **ongoing, ambient quality signals** (not just canary-window metrics) that continue tracking real user satisfaction and behavior well past the initial rollout window, specifically to catch failure modes with a longer onset than a canary is built to observe.

**Why not "trust that a clean canary and a passing evaluation are sufficient sign-off, since both official gates were satisfied"?** Both gates are structurally time-bounded — a golden set frozen at one point and a canary window measured in a short period — and neither is designed to detect a failure mode whose onset genuinely takes longer to manifest than either check runs for. Treating "both gates passed" as proof of ongoing health ignores that passing a time-bounded check says nothing about behavior outside that time window.

---

### Q11. "Design a global customer-support agent platform operating across three regions with different data-residency requirements. How does that change your deployment-target and data-architecture choices?"

**What's really being asked.** A multi-region design spanning Sections 3, 4, and 5 — whether the candidate treats data residency as a hard architectural constraint rather than an afterthought layered on top of a single-region design.

**Model answer.** Data residency requirements mean this can't be one global deployment with data flowing freely between regions — the constraint shapes the architecture from the start, not as a compliance checkbox added after the fact.

```
[Region A]                [Region B]              [Region C]
Agent Runtime deployment  Agent Runtime deployment Agent Runtime deployment
(regional)                 (regional)                (regional)
        |                          |                          |
[Region A's own Agent      [Region B's own Agent    [Region C's own Agent
 Search corpus + vector     Search corpus + vector    Search corpus + vector
 index — customer data      index — customer data     index — customer data
 stays IN-REGION]           stays IN-REGION]           stays IN-REGION]
        |                          |                          |
        +-----------+--------------+--------------+-----------+
                     |
              [Shared, region-agnostic: skill/plugin
               registry definitions, evaluation
               framework configuration, platform
               monitoring dashboards — NONE of this
               contains actual customer data, so it
               CAN be shared/global]
```

Each region gets its own **Agent Runtime deployment and its own Agent Search corpus/vector index**, so customer data never has to cross a residency boundary to be retrieved or processed — this is a harder constraint than just "deploy the same thing in three places," since it means each region's retrieval and processing genuinely operates on data that never leaves that region. What *can* stay shared and centralized: platform-level configuration that doesn't touch actual customer data — the skill/plugin definitions, the evaluation framework setup, cross-region operational monitoring — none of which violates residency requirements since none of it is customer data itself.

**Why not "deploy one global agent with a single shared vector index, and add data-residency filtering logic on top to route requests appropriately"?** A single shared index inherently means the underlying data exists in one place, which typically defeats a genuine data-residency requirement regardless of how carefully filtering logic tries to route queries afterward — residency requirements are usually about where the data itself physically resides, not just about which queries can access which subset, so filtering on top of a shared store doesn't actually satisfy the constraint the way genuinely separate regional deployments do.

---

### Q12. "Walk me through migrating a live multi-agent system from GKE to Agent Runtime with no downtime — every step, every risk."

**What's really being asked.** A generalized migration scenario spanning Sections 3 and 4 — testing whether the candidate can sequence a zero-downtime infrastructure migration and name the real risks at each step, not just state the end state.

**Model answer.** Zero-downtime migration means running both environments in parallel during a transition window, with traffic shifted gradually rather than cut over all at once.

```
STEP 1: Deploy the SAME agent          RISK: subtle behavioral
 code/config to Agent Runtime,          differences between GKE's
 running IN PARALLEL with the           execution environment and
 existing GKE deployment                Agent Runtime's managed
        |                               runtime (resource limits,
        v                               startup behavior) surface
STEP 2: Route a SMALL percentage        only under real traffic
 of real traffic to Agent Runtime              |
 (canary-style), compare behavior              v
 against the GKE baseline               RISK: a monitoring gap —
        |                               if Agent Runtime's metrics
        v                               aren't wired into the same
STEP 3: Gradually increase Agent        dashboards as GKE's, a
 Runtime's traffic share while          regression on the new
 monitoring for ANY divergence          platform could go unnoticed
        |                               during the transition
        v
STEP 4: Once Agent Runtime carries      RISK: decommissioning GKE
 100% of traffic and has been           too early, before enough
 stable for a defined observation       real-traffic history has
 period, decommission the GKE           accumulated to be confident
 deployment                             the new platform is stable
```

The critical discipline is **not treating this as a single cutover event** — every step keeps the old deployment live and capable of absorbing traffic back if the new one shows any problem, and the traffic shift is gradual and monitored specifically to catch subtle environment differences (resource behavior, cold-start characteristics) that a lift-and-shift migration commonly reveals only under real production load, not in a pre-migration test.

**Why not "do a single scheduled cutover during a low-traffic maintenance window, to keep the migration simple and finish it in one step"?** A single cutover, even during low traffic, means the first real exposure of the new environment to production conditions happens all at once with no fallback already proven — if Agent Runtime's environment behaves subtly differently under real load than GKE did, a single cutover discovers that at full traffic with no gradual-rollback path already established, which is exactly the risk the staged, parallel-running approach is designed to avoid.

---

### Q13. "Design a predictive-maintenance agent for a manufacturing plant that ingests real-time sensor data via tool calls and can trigger an equipment shutdown. Where does HITL sit in this design, and why?"

**What's really being asked.** A safety-critical design spanning Sections 3 and 5 — testing whether the candidate places HITL correctly given the specific consequence profile of an automated shutdown action, rather than defaulting to either full automation or full manual gating.

**Model answer.** I'd split this by the actual asymmetry in consequences between a false positive and a false negative: an **unnecessary shutdown** (false positive) costs lost production time — expensive, but recoverable. A **missed failure that should have triggered a shutdown** (false negative) risks equipment damage or a safety incident — potentially far worse and not always recoverable.

```
[Real-time sensor data via tool calls]
        |
        v
[Agent: predictive-maintenance
 reasoning over sensor patterns]
        |
   Risk classification of the
   detected anomaly
        |
   LOW-TO-MODERATE risk -----> [HITL gate: alert a human
   (ambiguous signal, worth       operator, WAIT for confirmation
   a second look but not          before shutdown — false-positive
   clearly urgent)                 cost is tolerable to absorb
        |                          while a human checks]
        |
   HIGH risk, clear pattern -----> [AUTOMATED shutdown, human
   matching known failure            notified immediately, not
   signatures]                        gating the action — the
                                       cost of shutdown delay
                                       while waiting for a human
                                       could exceed the cost of
                                       an unnecessary shutdown]
```

For a **clear, high-confidence, known-dangerous pattern**, I'd allow automated shutdown without waiting for human confirmation — the cost of delay while paging a human could itself be the safety risk this system exists to prevent. For an **ambiguous or lower-confidence signal**, HITL gating is the right call — a human's judgment adds real value when the signal isn't clearly conclusive, and the cost of a brief delay is tolerable. This mirrors the earlier HITL-timeout-behavior reasoning: the right gate placement depends on the specific action's actual consequence profile, not one uniform rule for "any automated shutdown."

**Why not "always require human sign-off before any automated shutdown, since safety-critical actions should never happen without human review"?** For a clear, high-confidence, known-dangerous signal, mandatory human sign-off introduces exactly the delay that could turn a preventable incident into an actual one — the whole reason predictive maintenance exists is to act faster than a human noticing the same pattern manually would, and gating every shutdown on human confirmation regardless of signal clarity discards that speed advantage for the cases where it matters most.

---

### Q14. "You're handed nothing but 'build us an agent platform.' What are the first five questions you ask before naming a single Google Cloud tool, and what goes wrong if you skip them?"

**What's really being asked.** A requirements-first framework question — generalizing the capstone's own Phase 0 discipline into a reusable checklist, testing whether the candidate resists jumping straight to tool names.

**Model answer.** I'd ask, in this order, because each answer constrains the ones after it:

```
Q1: "What specific problem, for which specific users,
     are we actually solving?"
        |
        v (constrains scope — without this, every
        |  later choice is guesswork)
Q2: "What does success look like, concretely,
     and how would we measure it?"
        |
        v (without this, evaluation design in Q3
        |  has no target to build toward)
Q3: "What's the actual data/knowledge source,
     and who's authorized to access what?"
        |
        v (constrains security/governance design
        |  AND retrieval architecture)
Q4: "What's the required latency and scale —
     interactive real-time, or can it tolerate delay?"
        |
        v (constrains deployment runtime and
        |  model-size choices directly)
Q5: "What's the cost of a WRONG answer here,
     versus the cost of NO answer/a delay?"
        |
        v (directly determines HITL placement
           and autonomy calibration)
```

Skipping these and naming tools first (Gemini Enterprise, ADK, Agent Runtime) risks building technically competent infrastructure for the wrong problem — a fast, low-code chatbot for a use case that actually needed careful multi-step reasoning, or an over-engineered custom multi-agent system for a problem simple enough that a state machine would have served the actual users better and shipped faster.

**Why not "start with a quick technical spike using the most capable available tools, and refine the requirements based on what the spike reveals"?** A spike built before understanding the actual problem, users, data-access boundaries, latency needs, and error-cost profile risks anchoring the whole design around whatever the spike happened to demonstrate, rather than around what the real requirements actually call for — it's cheaper to ask five questions than to build and then unwind a technically-working but wrongly-scoped system.

---

### Q15. "A security audit finds that although PAB was correctly configured via Agent Identity, a legacy direct-integration path bypasses Agent Gateway entirely for one tool call. Diagnose how this could happen architecturally, and redesign so it can't recur."

**What's really being asked.** An architectural root-cause question distinct from a simple bypass-fix — testing whether the candidate can explain *how* a correctly-configured PAB and an ungoverned bypass coexisted, and design a structural prevention, not just a patch.

**Model answer.** PAB and Agent Gateway enforce different things, and this incident shows exactly why both matter independently: **PAB being "correctly configured"** means the agent's *permission boundary* is right — if it tried to use that tool through governed infrastructure, it would be correctly scoped. But a **legacy direct-integration path** means this specific tool call was wired *before* Agent Gateway existed as standard infrastructure, or was added by someone unaware Gateway was supposed to be the mandatory path — so it never went through Gateway's monitoring and policy enforcement at all, regardless of how correct the PAB policy governing that agent's *intended* access looks on paper.

```
[Agent] ---correctly PAB-scoped--- [Agent Identity: PAB
   |                                 policy — CORRECT]
   |
   +---LEGACY DIRECT PATH, predates
        Gateway adoption or was added
        without Gateway awareness -----> [Tool call]
                    [BROKEN: bypasses Agent
                     Gateway ENTIRELY — none
                     of Gateway's monitoring/
                     enforcement ever runs,
                     independent of PAB's
                     own correctness]
```

The architectural fix is a **standing inventory-and-enforcement discipline**, not a one-time patch: every tool integration, existing and new, needs to be verified as actually routing through Agent Gateway — I'd add this as a mandatory check in any new-integration review process (closing future recurrence) and run a full audit of *all* existing integrations specifically looking for legacy paths predating Gateway's adoption (closing the current gap). The root architectural lesson: PAB and Gateway are independent controls, and a correct PAB policy provides zero protection for traffic that never reaches the infrastructure PAB's enforcement assumes it's operating within.

**Why not "just close this one legacy bypass path once it's found, since the audit already caught it"?** Closing only the specific instance found leaves the actual root cause — no standing process verifying that every integration routes through Gateway — fully intact, meaning any other legacy or informally-added integration elsewhere in the platform could have the identical, currently-undiscovered gap. A one-off fix addresses this audit's finding; a standing inventory-and-enforcement process addresses why this class of gap can exist at all.

---

### Q16. "Design the shared evaluation-to-deployment-to-monitoring pipeline for a platform team operating 15 agents built by 8 different application teams. What's centralized, what's left to each team, and why?"

**What's really being asked.** A fleet-scale governance synthesis of Section 4 and 5 — testing whether the candidate can draw the centralize-vs-delegate line correctly at real scale, rather than either fully centralizing or fully delegating.

**Model answer.** I'd centralize the **infrastructure and standards**, and delegate the **domain-specific content**, because the platform team has visibility and expertise the application teams don't (cross-agent operational patterns, security posture), while each application team has domain knowledge the platform team doesn't (what "correct" actually means for their specific agent's use case).

```
              [PLATFORM TEAM: centralized]
        |                    |                    |
[Deployment           [Monitoring/            [Evaluation
 infrastructure         Agent Gateway/          FRAMEWORK/
 (Agent Runtime,        Registry — shared       TOOLING choice
 staged-rollout          across all 15           (ADK evalset vs
 tooling)]               agents]                  Gen AI eval
                                                    service, etc.)]
        |                    |                    |
        +--------------------+--------------------+
                              |
              [8 APPLICATION TEAMS: delegated]
                              |
                    Each team owns: their OWN
                    golden dataset / edge cases
                    (domain-specific correctness),
                    their agent's actual PAB scope
                    (derived from THEIR agent's job),
                    their own evaluation pass/fail
                    thresholds (what "good enough"
                    means for THEIR use case)
```

Centralizing deployment infrastructure and monitoring means every one of the 15 agents benefits from consistent staged-rollout discipline and shows up in one operational view, without each of the 8 teams reinventing that infrastructure independently. Delegating golden-dataset content and pass/fail thresholds to each team respects that "is this HR-policy agent's answer correct" and "is this finance-reporting agent's answer correct" require genuinely different domain judgment the platform team doesn't have and shouldn't try to centrally arbitrate.

**Why not "centralize everything, including each team's evaluation criteria, so there's one consistent bar across all 15 agents"?** A single centrally-defined evaluation bar, applied uniformly across 8 different domains, would need to either be so generic it fails to catch domain-specific correctness issues, or require the platform team to develop deep expertise in 8 unrelated domains to define meaningful criteria for each — both worse outcomes than letting each application team, who already has that domain expertise, own their own evaluation content within a shared, centrally-provided framework.

---

### Q17. "Two companies just merged. Each already runs its own agent platform — one low-code-heavy, one custom-ADK-heavy, on different deployment targets. Design the consolidation plan."

**What's really being asked.** An M&A platform-rationalization question spanning all 5 sections via a build-vs-keep-vs-migrate lens — testing whether the candidate can design a consolidation plan rather than picking one company's stack and discarding the other's wholesale.

**Model answer.** I would not assume one platform simply "wins" and the other gets migrated wholesale — the right approach is evaluating each platform's agents individually against their own fit, since a low-code-heavy company likely has genuinely low-code-shaped use cases (where their platform choice was correct) and the ADK-heavy company likely has genuinely custom-shaped ones.

```
[Company A: low-code-heavy]        [Company B: ADK-heavy]
        |                                    |
   For EACH existing agent,             For EACH existing agent,
   assess: is this agent's              assess: does this agent
   actual shape genuinely               genuinely need custom/
   low-code-appropriate?                ADK-level capability?
        |                                    |
   YES: KEEP on low-code,                YES: KEEP on custom ADK,
   consolidate onto ONE shared          consolidate onto ONE shared
   Gemini Enterprise deployment          Agent Runtime/GKE deployment
        |                                    |
   NO: this agent was over-              NO: this agent was over-
   simplified for low-code —             engineered for custom when
   candidate for migration to            low-code would have served
   custom                                it fine — candidate for
        |                                migration to low-code
        +------------------+-------------------+
                            v
              [Shared: ONE Agent Gateway, ONE
               Agent Registry, ONE evaluation
               framework — regardless of which
               build approach each agent uses]
```

Consolidation happens at the **shared infrastructure and governance layer** first (one Agent Gateway, one Registry, one evaluation approach, one deployment target where feasible) — that's where duplicate operational overhead is pure waste with no offsetting benefit. The **build-approach choice per agent** (low-code vs. custom) stays driven by that specific agent's actual requirements, assessed fresh rather than inherited from "which company built it" — some of Company A's low-code agents may genuinely need to become custom, some of Company B's custom agents may genuinely be over-engineered for what they do, and consolidation is the moment to correct both, not just to standardize on one company's prior choices wholesale.

**Why not "standardize on whichever company's platform is larger/more mature, and migrate the other company's agents onto it wholesale"?** Migrating every agent onto one company's platform regardless of fit ignores that build-approach should track each agent's actual shape, not organizational history — an agent that was correctly built low-code doesn't become better by being forced into a custom ADK rebuild just because the "winning" platform is custom-heavy, and vice versa; wholesale migration optimizes for organizational simplicity at the cost of correctness for individual agents.

---

### Q18. "Design and defend, end to end, an AI research-assistant platform for a scientific research organization: literature RAG, tool-calling into lab-data systems, multi-agent specialist routing for different research domains, evaluation against a domain-expert panel, and governance for unpublished/sensitive research data."

**What's really being asked.** A full from-scratch design across all five sections in a genuinely different industry from Meridian — the file's other "hold the whole system in your head" closer, testing the same synthesis skill against unfamiliar domain constraints.

**Model answer.** I'd design this around the fact that "research assistant" spans genuinely different specialist domains (say, chemistry, biology, materials science), which drives a multi-agent structure from the start rather than one generalist agent trying to cover everything.

```
[Researcher query]
        |
        v
[Triage/routing agent: identifies
 research domain]
        |
   +----+----+----+
   |    |    |
[Chemistry    [Biology       [Materials
 specialist    specialist     science
 agent]        agent]         specialist agent]
   |    |    |
   v    v    v
[Literature RAG: Agent Search over
 published literature corpus, EACH
 specialist scoped to its own
 relevant literature subset]
   |    |    |
   v    v    v
[Tool calls into lab-data systems
 via MCP Servers — READ-ONLY by
 default, PAB-scoped per specialist's
 actual authorized datasets]
   |    |    |
   v    v    v
[Sensitive Data Protection +
 Agent Identity: UNPUBLISHED/
 sensitive research data gets its
 own tighter PAB tier + Model
 Armor screening, distinct from
 published-literature access]
        |
        v
[Evaluation: golden set curated
 WITH a domain-expert panel per
 specialty — general-purpose eval
 can't judge chemistry-specific
 correctness, mirrors Q8's
 rare-critical-case reasoning
 applied here as domain expertise
 rather than rarity]
```

The specialist-per-domain structure exists because literature RAG grounded in chemistry papers isn't automatically useful for a biology question, and forcing one generalist agent to retrieve across all domains risks diluted, less relevant retrieval for each. Governance for unpublished/sensitive data gets its own tier, deliberately separate from published-literature access, because the consequence of a leak or misuse is categorically different — published literature is already public; unpublished research data often has real competitive, safety, or ethical sensitivity attached.

**Why not "build one generalist research agent covering all domains with one shared literature corpus, to keep the architecture simpler"?** A single shared corpus and one generalist agent dilutes retrieval quality for every domain — chemistry-relevant documents compete for retrieval ranking against biology and materials-science documents that aren't relevant to a chemistry question, degrading grounding quality precisely because the corpus isn't scoped to what each specific query actually needs, which the specialist-per-domain design avoids by construction.

---

### Q19. "A specialist agent in a production multi-agent system starts timing out intermittently under load that used to be fine. Trace the request lifecycle end to end and name every layer that could be the actual bottleneck."

**What's really being asked.** A full-lifecycle latency-diagnosis question spanning orchestration, deployment, and observability — testing whether the candidate can enumerate every plausible bottleneck layer rather than guessing at one.

**Model answer.** "Used to be fine, now intermittent under the same load" points at something that degrades non-linearly with load or has changed recently, so I'd trace every layer the request passes through and check each independently.

```
[Request arrives]
        |
        v
[Agent Gateway] --------------- LAYER 1: is Gateway itself
        |                        under load and adding queueing
        v                        delay before routing?         [?]
[Triage/routing agent]
        |
        v
[A2A handoff to specialist] --- LAYER 2: is the specialist
        |                        agent's own deployment
        |                        (Agent Runtime/GKE) under-
        v                        provisioned for current load,   [?]
[Specialist agent processing]    causing scaling lag or
        |                        resource contention?
        v
[Tool call(s) the specialist    LAYER 3: is a DOWNSTREAM
 makes] -------------------      dependency (a database, an
        |                        external API) the actual
        v                        bottleneck, only surfacing      [?]
[RAG retrieval, if applicable]   under higher concurrent load?
        |
        v                       LAYER 4: is retrieval/vector
[Response returned]              search itself degrading under
                                  load (index contention, query    [?]
                                  volume exceeding provisioned
                                  capacity)?
```

I'd instrument each layer with Cloud Trace specifically to see which one's latency actually correlates with the intermittent timeouts under load — "intermittent, load-correlated" is a strong signal that whatever's happening is a **contention or scaling** issue at one specific layer (a resource that's adequate at normal load but insufficiently provisioned or improperly configured for concurrent scaling), not a uniform, always-present slowness that a simple single-request test would have already caught.

**Why not "assume it's the specialist agent's own model/prompt getting slower, since that's the layer closest to where the timeout is observed"?** The timeout being observed "at" the specialist agent doesn't mean the specialist agent's own processing is the actual bottleneck — the delay could originate at Gateway, at a downstream tool/dependency the specialist calls, or at the retrieval layer, all of which would still manifest as "the specialist agent timed out" from the outside even though the specialist's own reasoning was never the slow part. Tracing every layer, rather than assuming the layer where the symptom is observed is also the layer where the cause lives, is what actually finds load-dependent bottlenecks.

---

### Q20. "A candidate tells you 'multi-agent orchestration, RAG, and full security tooling are always the right default for any new agent project.' As the interviewer, you disagree — walk through a scenario where the right architecture is deliberately minimal, and explain what signal would tell you to add each piece of complexity back in."

**What's really being asked.** A closing synthesis question forcing minimalism-first reasoning across all five sections — the mirror image of every other design question in this file, testing restraint as explicitly as the others test depth.

**Model answer.** I'd take a concrete, deliberately small scenario: an internal agent that answers a handful of frequently-asked, well-documented facilities questions ("what are the building hours," "how do I book a conference room") for a single office location.

```
[MINIMAL starting architecture]
        |
[Single low-code CX Agent Studio
 agent, ONE small, well-curated
 document set, NO custom code,
 NO multi-agent orchestration,
 NO elaborate security tooling
 beyond standard platform auth]
        |
        v
   SIGNAL to add RAG/Agent Search:
   the document set grows large or
   frequently-changing enough that
   manually keeping prompt-embedded
   content current becomes unreliable
        |
        v
   SIGNAL to add multi-agent
   orchestration: a genuinely
   distinct second domain emerges
   (e.g., the same agent is asked to
   also handle IT helpdesk requests,
   a different domain the facilities
   agent's tuning doesn't fit)
        |
        v
   SIGNAL to add elaborate security
   tooling (Model Armor tiers, PAB
   beyond basic scoping): the agent
   starts touching genuinely sensitive
   data or gains a WRITE capability
   it didn't have when it was purely
   informational
```

Each piece of complexity earns its place only when a **specific, concrete signal** appears — not because "a mature agentic system generally has these things." A facilities-FAQ agent with a small, stable document set, no write access, and one clear domain genuinely doesn't need multi-agent orchestration or heavyweight security tooling; adding them preemptively is pure cost (engineering time, operational overhead, more surface area to secure and maintain) with no corresponding benefit until the system's actual requirements grow into needing them.

**Why not "build in multi-agent orchestration, full RAG, and complete security tooling from day one regardless of current scope, since the requirements will probably grow into needing them eventually"?** Building for anticipated future requirements that haven't materialized yet means paying real complexity cost now for a benefit that may never arrive, or may arrive in a different shape than anticipated — this is the same "evidence-based trigger, not speculative future-proofing" principle argued throughout this file's other design questions (Q3's low-code-to-custom signal, in particular), applied here as the closing, most general statement of it: match architecture to demonstrated need, add complexity when a concrete signal appears, not preemptively on the assumption that a system will eventually need everything a more mature one has.
