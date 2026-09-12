# Section 5 Questions — Securing and Governing Agentic Workflows

> **What this file is.** 15 judgment-heavy, defend-this-design
> questions focused specifically on **Section 5** of the exam (~15%
> weight): OAuth 2.0 agent-to-tool authentication, PAB policy design
> via Agent Identity, Agent Gateway, governance via Agent Registry and
> Model Armor, HITL guardrails, and identity propagation.
> `agentic-architect-scenario-questions.md` already has 3 Section-5
> questions (defense-in-depth for two sensitivity tiers, a
> prompt-injection-via-RAG-doc incident, HITL gating ahead of a future
> write phase) and `behavioral-and-tradeoff-questions.md` touches
> several security-adjacent judgment calls (defending overlapping tools
> to a CFO, a vendor RAG pitch, shipping despite a late security
> finding) — this file goes past all of that with new mechanisms and
> new angles, not a repeat.
>
> **How to use this file.** Like `behavioral-and-tradeoff-questions.md`,
> several of these ask you to defend a design decision, not just
> describe a mechanism — the judgment is in *why* a boundary is drawn
> where it is, not just naming the tool that draws it.
>
> **Grounding.** Questions reference `04-architectures/pattern-secure-governed-enterprise-agent-platform.md`
> for the reference architecture shape, and occasionally
> `05-labs/lab-07-capstone-realtime-agentic-project.md` Phase 6 (OAuth
> scoping, PAB formalization, Agent Gateway alerts, HITL action table,
> identity propagation) as a worked example — referenced, not
> re-narrated wholesale.
>
> **Currency note.** Every answer below uses **Agent Runtime** (never
> Agent Engine), **Agent Search** (never Vertex AI Search), **Gemini
> Enterprise** (never "Vertex AI Agent Builder"), **Antigravity** /
> **Claude Code on Google Cloud** (never "Gemini Code Assist"), and
> treats **ADK as open-source** and **PAB as an Agent-Identity-specific
> mechanism** (principal access boundary), not generic IAM. See
> `../CLAUDE.md` §7 for the full corrections table.

---

## A. OAuth 2.0 agent-to-tool authentication

### Q1. "Design OAuth 2.0 scoping for an agent that needs *write* access to a ticketing system — not just read. What scope, lifetime, and flow choices matter here, and what's the fallback if the token is compromised?"

**What's really being asked.** Whether the candidate applies meaningfully tighter scoping discipline to a write-capable integration than they would to a read-only one, and has a real answer for the compromise case.

**Model answer.** Write access changes the stakes considerably compared to a read-only integration — a compromised read-only token exposes data; a compromised write-capable token can *change* data, which is a materially worse failure mode. I'd scope the token as narrowly as the ticketing system's own permission model allows: ideally a scope that permits only the specific write operations this agent actually needs (e.g., "create ticket" and "update ticket status" if that's the real requirement) rather than a broad "full write access" grant, and I'd favor the **shortest lifetime the workflow can tolerate**, refreshed as needed, rather than a long-lived token that sits valid for months regardless of use.

```
[Agent] --- OAuth 2.0, narrowly-scoped
             (create/update ticket ONLY,
              not full admin write),
             short lifetime, refreshed
             as needed ---> [Ticketing system]
```

For the compromise case, I'd design for **fast, low-blast-radius revocation**: the token's narrow scope already limits what a compromised credential could do even before revocation happens, and the short lifetime bounds how long a compromised-but-undetected token remains valid even if revocation is delayed. I'd also want write actions logged with enough detail (which token, what action, when) to distinguish legitimate agent activity from suspicious activity quickly if a compromise is suspected.

**Why not "grant a broad admin-level scope, to avoid having to request additional permissions later as the agent's use cases grow"?** Broad upfront scoping optimizes for avoiding a future permission-request conversation at the cost of a much larger blast radius if that token is ever compromised — "avoid asking again later" is a convenience tradeoff, not a security one, and it's exactly the kind of over-provisioning that turns a contained incident into a much bigger one.

---

### Q2. "An audit finds a production tool integration using a long-lived, broadly-scoped OAuth token that hasn't been rotated in months. What's the remediation, and what process gap let this happen?"

**What's really being asked.** Whether the candidate treats this as a one-time fix versus recognizing and addressing the standing process gap that allowed it.

**Model answer.** The immediate remediation is straightforward: revoke the existing broad, stale token, and reissue a properly narrow-scoped, appropriately-lived replacement per Q1's design principles. But stopping there only fixes this one instance — the more important question is **why this token existed unrotated and over-scoped in the first place**, which points at a missing standing practice, not a one-off mistake.

```
[Immediate fix: revoke stale token,          [Process gap: WHY did this
 reissue narrow-scoped replacement]           token exist unrotated for
                                               months with nobody noticing?]
                                                       |
                                                       v
                                        [No standing scope/lifetime
                                         REVIEW CADENCE — tokens get
                                         issued once and never
                                         revisited unless an audit
                                         happens to catch them]
```

I'd establish a **periodic token/scope review process** — a recurring audit (not a one-time cleanup) that checks every production integration's token scope and age against what's actually still needed, so the next over-broad or stale token gets caught by a routine review rather than by chance during an unrelated audit.

**Why not "rotate the token once, since that resolves the immediate finding"?** Rotating once addresses this specific token but leaves the underlying gap — no standing process for catching scope creep or staleness — fully intact, meaning the same finding is likely to recur on a different integration the next time someone happens to audit. The finding is a symptom; the missing review cadence is the actual defect.

---

## B. PAB policy design via Agent Identity

### Q3. "How do you decide what to put in a new agent's PAB policy before it's ever run in production — walk through the actual reasoning process, not just the concept."

**What's really being asked.** A methodology question testing whether the candidate has a real process for deriving a PAB boundary, rather than reciting "least privilege" as an abstract principle.

**Model answer.** I'd start from the agent's **actual, specific job** — the concrete list of actions it needs to take and resources it needs to touch to do exactly what it's being built for — and derive the PAB boundary directly from that list, rather than starting from a broad default and narrowing down. In practice this means walking through the agent's intended workflows one by one and asking, for each step, "what's the minimum permission this specific action requires," then union-ing those minimums into the policy — not asking "what permissions might this agent conceivably need someday."

```
[Agent's intended workflows,
 listed concretely: "look up
 order status," "issue refund
 under $50," "escalate to human"]
        |
        v
[For EACH workflow step: minimum
 permission that action requires]
        |
        v
[PAB policy = union of those
 minimums — NOT a broad starting
 grant later narrowed down]
```

An important, easy-to-miss point: an **empty or near-empty boundary is often the correct starting answer**, not a sign something's misconfigured — if an agent's job is purely conversational (answering questions from already-public documentation, no write actions, no sensitive-data access), a minimal PAB policy reflecting that narrow reality is correct, not incomplete.

**Why not "start from a peer agent's existing PAB policy that seems roughly similar, and adjust from there"?** Cloning a "roughly similar" peer's policy imports whatever scope that peer actually needed — which is very unlikely to be an exact match for this new agent's specific job — and tends to accumulate permissions across successive clones that nobody individually re-derives from first principles, which is exactly the "policy sprawl" failure mode Q4 describes.

---

### Q4. "A governance review finds that PAB policies across the organization were all cloned from one shared template months ago, and now every agent's boundary includes access that none of them individually need. No incident has happened. Diagnose and fix."

**What's really being asked.** Whether the candidate treats unexploited over-permissioning as a real problem worth fixing, rather than only reacting to it once something has actually gone wrong.

**Model answer.** This is **PAB policy sprawl** — a template-cloning pattern where convenience at policy-creation time (start from an existing template rather than deriving from scratch, per Q3's reasoning) has quietly produced a fleet of agents each holding more access than their actual job requires, discovered by a proactive governance review rather than by any single access-denial incident.

```
[Original template PAB policy]
        |
   cloned, cloned, cloned...
        |
        v
[Agent A, Agent B, Agent C, ...]
 each holds the TEMPLATE's full
 scope, even though each agent's
 ACTUAL job only needs a subset
```

The fix is a **re-derivation pass**, applying Q3's per-agent methodology retroactively: for each agent currently running on the cloned template, walk its actual workflows and derive what its PAB policy *should* be from first principles, then narrow its actual policy down to that minimum — not just patch the shared template going forward while leaving already-deployed agents over-scoped. I'd also treat "no incident has happened yet" as irrelevant to whether this is worth fixing: an unnecessarily broad boundary is a standing risk regardless of whether it's been exploited, the same way an unlocked door is a real risk whether or not anyone has walked through it yet.

**Why not "leave it as-is since no incident has happened, and the shared template is clearly not actively causing harm"?** Least-privilege risk is about *exposure*, not about whether that exposure has been exploited yet — the fact that nothing bad has happened doesn't mean the broader-than-necessary access isn't a real, standing liability the moment any of those over-scoped agents is compromised, misused, or simply makes a reasoning mistake within its (unnecessarily wide) granted access.

---

## C. Agent Gateway

### Q5. "Design what should actually trigger an alert from Agent Gateway for a brand-new agent platform, before any incident has ever happened."

**What's really being asked.** A proactive design question — choosing meaningful anomaly signals up front, rather than reactively tuning alerts only after a real incident reveals what should have been monitored.

**Model answer.** I'd design around a small set of genuinely anomalous signals rather than trying to alert on everything: **volume spikes** (a sudden, sharp increase in call volume from a given agent, well outside its normal baseline — a strong signal of either a malfunction, a reasoning loop, or misuse); **unexpected destinations** (a tool call reaching an endpoint or service this agent has never called before, or isn't expected to call at all — often the first visible sign of a misconfiguration or a compromised credential being used somewhere unintended); and **PAB denials** (an agent attempting an action its own permission boundary rejects — individually not alarming, since PAB is working as designed, but a *pattern* of repeated denials from one agent is a meaningful signal that something is either misconfigured or being probed).

```
[Agent Gateway checkpoint]
        |
   +----+----+----+
   |    |    |
VOLUME  UNEXPECTED  PAB DENIAL
SPIKE   DESTINATION  PATTERN
   |    |    |
   v    v    v
[Alert: anomaly worth investigating]
```

I'd deliberately choose these three (or a similarly small, high-signal set) *before* any incident has happened, using knowledge of what a well-behaved agent's normal traffic pattern should look like, rather than waiting to see what an actual incident later reveals was worth watching — proactive design here means reasoning from "what would meaningfully deviate from expected behavior," not reverse-engineering alert rules from a postmortem.

**Why not "alert on every single call, for maximum visibility into everything the agent is doing"?** Alerting on every call produces overwhelming noise that drowns out the genuinely anomalous signals this design is trying to surface — a security team facing thousands of routine alerts a day will predictably start ignoring or filtering them wholesale, which defeats the purpose of alerting at all. Fewer, higher-signal alert conditions that actually indicate something worth investigating are more useful than maximum raw visibility nobody can act on.

---

### Q6. "Agent Gateway is correctly configured — but a specific tool integration was wired with a direct network path that bypasses it entirely. None of Gateway's checks ever ran for that integration. Diagnose it."

**What's really being asked.** Whether the candidate recognizes that Agent Gateway's protection only covers traffic actually routed through it — a configuration/wiring gap, not a Gateway malfunction.

**Model answer.** Agent Gateway being "correctly configured" describes the checks it performs on traffic that reaches it — it says nothing about whether *all* of an agent's traffic actually reaches it. A direct network path wired around Gateway means that specific integration's calls never hit any of Gateway's monitoring, policy enforcement, or anomaly detection at all, regardless of how well those checks would have performed had the traffic actually flowed through them.

```
[Agent] ------ correctly routed through -----> [Agent Gateway] -----> [Tool A]
   |                                                (checks run,
   |                                                 monitored,
   |                                                 policy-enforced)
   |
   +------ DIRECT PATH, bypassing Gateway -------------------------> [Tool B]
            (NONE of Gateway's checks
             ever see this traffic at all)
```

The fix is an **inventory-and-close** pass: enumerate every tool integration this agent (and ideally every agent on the platform) actually has, and verify each one's network path genuinely routes through Agent Gateway rather than assuming it does because Gateway exists somewhere in the architecture. Any direct path found needs to be re-wired through Gateway, and I'd add this check (does every integration's traffic actually route through Gateway) as a standing item in new-integration review, not just a one-time cleanup.

**Why not "assume Agent Gateway's presence in the platform automatically protects every agent's traffic, since that's what it's there for"?** Gateway's protection is a function of actual traffic routing, not platform-wide intent — an integration wired with a direct network path is architecturally invisible to Gateway regardless of Gateway's own correctness, so "it's there for that purpose" doesn't guarantee coverage without explicitly verifying every integration's actual path.

---

## D. Governance via Agent Registry and Model Armor

### Q7. "Design a skill/capability review workflow for Agent Registry and Skill Registry. Who reviews, what's checked, and does every registration need the same level of review?"

**What's really being asked.** Whether the candidate applies risk-tiered review rather than uniform heavyweight review for every registration — echoing the same proportional-governance principle from earlier design questions, applied here to capability registration specifically.

**Model answer.** I'd tier review depth by what the skill or capability actually grants access to or lets an agent do, not apply one uniform process to every registration regardless of risk. A skill that's purely informational (teaches an agent a formatting convention, adds no new external reach) can go through a **lightweight review** — a quick correctness check by a peer, not a full security review board. A capability that grants new access to an external system, sensitive data, or a write-capable action needs a **heavier review**, involving whoever owns security/governance sign-off for that class of access.

```
[New skill/capability submission]
        |
   Does this grant NEW external
   reach, write access, or
   sensitive-data access?
        |
   NO ------> Lightweight peer review
        |      (correctness check)
   YES ------> Heavier review (security/
                governance sign-off,
                proportional to what's
                being granted)
```

Risk-tiering the review process is what keeps the registry usable at scale — treating every submission identically at the heaviest review level creates a bottleneck that predictably pushes people toward informal workarounds (skipping registration, using an unregistered ad hoc configuration) just to get ordinary, low-risk work done.

**Why not "require identical, heavyweight review for every submission, to guarantee nothing risky slips through unreviewed"?** Uniform heavyweight review for genuinely low-risk submissions creates exactly the bottleneck-and-workaround dynamic described above — when the registry's process is too slow or heavy for routine low-risk changes, people find ways around it entirely, which produces *less* actual oversight than a risk-tiered process that people are willing to actually use.

---

### Q8. "Design a tiered Model Armor policy: different content-safety screening intensity for customer-facing user input versus internally-ingested RAG source content. Should these get the same policy?"

**What's really being asked.** Whether the candidate recognizes these as genuinely different threat models — adversarial live input versus potentially-poisoned ingested content — deserving different tuning, rather than one uniform screening policy.

**Model answer.** No, these are different threat models and deserve different tuning. **Customer-facing input** is adversarial in a specific way: a live user actively trying to manipulate the agent in real time (prompt injection attempts, jailbreak-style phrasing), so screening here needs to catch manipulation patterns and inappropriate requests in the moment, tuned for the phrasing patterns of live adversarial attempts. **Ingested RAG source content**, by contrast, is a different threat: the risk isn't a live user manipulating a conversation, it's a **poisoned document** — content injected into the corpus (deliberately or by an upstream compromise) designed to manipulate the agent's behavior when that document is later retrieved and fed into a prompt.

```
[Customer-facing live input] ------> Model Armor: tuned for
                                       adversarial PROMPTING
                                       patterns, real-time
                                       manipulation attempts

[Ingested RAG source content] ------> Model Armor: tuned for
                                       POISONED DOCUMENT patterns
                                       — content designed to
                                       manipulate the agent when
                                       later retrieved, not a
                                       live conversational attack
```

Applying the same policy tuned only for one threat model to both input paths risks under-screening the other — a policy tuned entirely for live conversational jailbreak patterns may not catch an injected instruction buried in an ingested document's text, and vice versa.

**Why not "apply one uniform Model Armor policy everywhere, since both are ultimately 'unsafe content' screening"?** Treating both as the same generic "unsafe content" problem obscures that they're actually different attack surfaces with different characteristic patterns — a policy generalized across both risks being well-tuned for neither, catching the more obvious cases of each while missing the threat-specific patterns a purpose-tuned policy for each path would catch.

---

### Q9. "Model Armor is blocking a legitimate, common business request as a false positive, frustrating real users. How do you fix this without just weakening the control wholesale?"

**What's really being asked.** Whether the candidate can tune a specific overbroad rule precisely, rather than either accepting ongoing false positives or disabling protection broadly to make the immediate complaint go away.

**Model answer.** I'd start by identifying **exactly which rule or pattern** within Model Armor's policy is triggering on this legitimate request — false positives are almost always traceable to a specific overly-broad pattern (a keyword match too loosely defined, a heuristic that doesn't distinguish a legitimate phrasing from a superficially similar unsafe one), not a sign that content-safety screening in general is miscalibrated.

```
[Legitimate request] ---> [Model Armor: specific
                            OVERBROAD rule triggers]
                                    |
                                    v
                          [False positive block]

Fix: narrow THAT SPECIFIC rule's
pattern to exclude this legitimate
case, without touching the rest
of the policy
```

Once the specific triggering rule is identified, the fix is **narrowing that rule's pattern** to correctly exclude the legitimate case while still catching the genuinely unsafe content it was originally designed to catch — this requires understanding what distinguishes the legitimate request from the actually-unsafe pattern the rule exists for, and encoding that distinction into a more precise rule, not just loosening the rule generally.

**Why not "disable Model Armor for this entire request category, since that's the fastest way to stop the complaints"?** Disabling the whole category to fix one specific false-positive pattern reopens the door to the genuinely unsafe content that category-level screening was protecting against in the first place — it solves the immediate complaint by discarding real protection, when the actual fix (narrowing the specific overbroad rule) preserves the protection while removing the false-positive trigger.

---

## E. Safety guardrails and HITL

### Q10. "When a HITL approval request times out with no human response, should the system fail-open (proceed anyway) or fail-closed (block the action)? Does the answer depend on what action is being gated?"

**What's really being asked.** A design question about the gate's own failure behavior — distinct from most HITL questions, which focus on *when* to require approval rather than what happens when the approval process itself breaks down.

**Model answer.** Yes, it genuinely depends on the action's own stakes, and a single global timeout policy is the wrong design. For a **high-stakes, hard-to-reverse action** (a financial transaction above a threshold, a production infrastructure change, anything with real consequence if wrong), I'd fail-closed on timeout — the absence of a human response is not the same as approval, and proceeding without it defeats the entire reason the action was gated in the first place. For a **low-stakes, easily-reversible action** where the HITL gate exists more as a convenience check than a hard safety requirement, fail-open might be reasonable if delay itself has a real cost (a time-sensitive customer-facing response, for instance) and the downside of proceeding without approval is genuinely small and correctable.

```
[HITL approval request times out, no human response]
        |
   How reversible/high-stakes is
   the gated action?
        |
   HIGH STAKES -------> FAIL-CLOSED (block; silence
    (financial,          is not consent)
    infrastructure,
    hard to reverse)
        |
   LOW STAKES ---------> FAIL-OPEN may be acceptable
    (easily reversible,   if delay has its own real cost
    low consequence)
```

The design principle is that the fail-behavior should be configured per gated-action-type, based on its actual consequence profile, not set once globally for every HITL gate in the system regardless of what's being approved.

**Why not "pick one global fail-open-for-speed policy, applied uniformly, so the system never gets stuck waiting on a human who might not respond quickly"?** A uniform fail-open policy optimizes for speed at the cost of exactly the protection HITL gating exists to provide for high-stakes actions — treating "avoid getting stuck" as more important than "don't take an unreviewed high-consequence action" inverts the actual priority for the cases where a HITL gate matters most.

---

## F. Secure data access and identity propagation

### Q11. "Is identity propagation always 'pass the original user's exact scope through untouched, hop by hop,' or are there legitimate cases for a narrowly-scoped system identity at a specific hop instead?"

**What's really being asked.** A judgment question testing whether the candidate treats identity propagation as an absolute rule or recognizes a real, narrow, still-least-privilege exception.

**Model answer.** Strict pass-through of the original user's exact scope is the right *default*, but it's not an absolute rule without exception — there are legitimate cases where a specific hop's actual job requires something the user's own scope doesn't (and shouldn't) grant. A concrete example: an **aggregation step** that needs to read non-sensitive summary data across multiple users' records to compute something like an anonymized trend or a system-wide count — no individual user's own scope includes "read other users' records," and it shouldn't, but the aggregation itself is a legitimate function that a narrowly-scoped **system identity**, granted only the specific cross-user read needed for that aggregation and nothing more, can perform correctly.

```
[User's own identity] --- propagated hop to hop --- [Most hops: exact
                                                       user scope,
                                                       unchanged]
                                                              |
                                                              v
                                             [Aggregation hop: NARROW
                                              system identity, scoped
                                              ONLY to the specific
                                              cross-user read this
                                              step needs — NOT a
                                              broad admin identity]
```

The key qualifier is that this system identity still has to be **narrowly scoped to exactly what that hop's legitimate function requires** — it's still a least-privilege boundary, just a different one than the user's own, not a blanket exception that opens the door to arbitrary elevated access whenever it's convenient.

**Why not "treat 'never use a system identity, always propagate the user's exact scope' as an absolute, unconditional rule"?** Treating it as absolute would make certain legitimate system functions (genuine cross-user aggregation, for instance) either impossible to implement correctly or force an awkward workaround that grants the user's own identity broader scope than their actual job needs, just to route around the rule — a narrow, purpose-built system identity for a specific legitimate function is the more disciplined design, not a violation of least-privilege, provided it's scoped as tightly as the function actually requires.

---

## G. Full enterprise-platform security and governance design

### Q12. "Design the security and governance model for a brand-new enterprise agent platform — before a single agent has been built."

**What's really being asked.** A greenfield, proactive design question spanning Section 5's mechanisms together, contrasted with reactive incident-response questions — testing whether the candidate designs governance in from the start rather than bolting it on later.

**Model answer.** I'd establish the full governance stack as foundational infrastructure *before* the first agent is built, precisely so every agent that follows inherits it by default rather than needing retrofitting later (echoing the same "governance before broad adoption" sequencing argued for coding-agent rollout elsewhere in this repo, applied here to the full agentic platform).

```
[Auth Manager: OAuth 2.0]
        |
        v
[Agent Gateway: traffic monitoring,
 anomaly alerting]
        |
        v
[Agent Identity + PAB: per-agent
 permission boundaries, derived
 per Q3's methodology from day one]
        |
        v
[Skill Registry / Agent Registry:
 risk-tiered capability review,
 per Q7's design]
        |
        v
[Model Armor + Sensitive Data
 Protection: tiered content
 screening per Q8's design]
        |
        v
[HITL gates: configured per
 action-type consequence, per
 Q10's design]
        |
        v
[FIRST AGENT is built ON TOP OF
 this already-established stack —
 not built first, governed later]
```

Every mechanism here is one this file has already designed individually (OAuth scoping, PAB derivation, Gateway alerting, registry review tiers, Model Armor tuning, HITL fail-behavior) — the greenfield design task is assembling them as standing infrastructure *before* any agent exists, so the first (and every subsequent) agent is built against an already-governed platform rather than being an early, under-governed exception that later needs retrofitting.

**Why not "get the first agent built and into production quickly, and add security/governance mechanisms once it's closer to launch"?** Building first and governing later means the first agent — and any agent built alongside it before governance catches up — operates without the permission boundaries, monitoring, and review processes this design establishes, and retrofitting governance onto an already-live agent is a materially harder, more disruptive change than building the agent against infrastructure that already has these guarantees in place from day one.

---

### Q13. "A multi-tenant agent platform serves several business units with different risk tolerances — say, a marketing agent and a finance agent — sharing one Agent Gateway and Agent Registry. Design per-tenant isolation within that shared central governance."

**What's really being asked.** Whether the candidate can design differentiated policy per tenant on top of genuinely shared infrastructure, rather than either full isolation (no shared governance) or one uniform policy that ignores real risk differences between tenants.

**Model answer.** The infrastructure layer — Agent Gateway, Agent Registry — stays **shared** across tenants, since duplicating that infrastructure per business unit would forfeit the operational benefit of centralized monitoring and review without buying any real additional safety. What differs **per tenant** is the policy configuration layered on top of that shared infrastructure: the finance agent's PAB policy, HITL gating thresholds, and Model Armor tuning should reflect its genuinely higher-stakes risk profile, while the marketing agent's policy can be correspondingly lighter, matched to its lower-stakes profile.

```
[Shared: Agent Gateway, Agent Registry]
        |
   +----+----+
   |         |
[Marketing agent]          [Finance agent]
 PAB: lighter scope         PAB: tighter scope,
 HITL: fewer gates          more gates on write actions
 Model Armor: standard      Model Armor: stricter tuning
 tier                       tier for financial content
```

This gives the platform team one place to monitor and audit traffic across every tenant (the shared Gateway/Registry), while each business unit's actual risk exposure is governed by policy tuned to its own real stakes, rather than either tenant inheriting a policy calibrated for the other's risk level.

**Why not "apply one uniform PAB/HITL policy to every business unit, for consistency across the shared platform"?** Uniform policy across genuinely different risk profiles either over-restricts the lower-risk marketing agent (unnecessary friction with no real safety benefit) or under-restricts the higher-risk finance agent (insufficient scrutiny for a materially more consequential workload) — "consistency" as a goal in itself ignores that the tenants' actual risk profiles are not the same, and policy that ignores that difference is calibrated correctly for neither.

---

### Q14. "Following an acquisition, you need to absorb another company's existing, ungoverned agents into your Agent Registry, Agent Gateway, and PAB regime. Design the onboarding sequence — what do you check first?"

**What's really being asked.** Whether the candidate designs a review-before-trust onboarding sequence, rather than registering acquired agents into shared infrastructure with default trust.

**Model answer.** I would not register the acquired agents into the shared platform with default trust — an agent built under a different organization's (likely different, and unverified) governance standards could have permission scopes, tool integrations, or behaviors that wouldn't pass this organization's own review if it were being onboarded fresh. The sequence starts with a **baseline review before integration**, not integration followed by review.

```
[Acquired company's agents]
        |
        v
[REVIEW GATE: audit each agent's
 actual permissions, tool
 integrations, and behavior
 against THIS org's governance
 baseline — BEFORE granting
 access to shared infrastructure]
        |
   Does it pass baseline review
   (PAB scope reasonable, no
   ungoverned direct paths per
   Q6, Model Armor coverage
   adequate)?
        |
   NO -------> Remediate FIRST (narrow scope,
        |       close bypasses, add missing
        |       screening) before proceeding
   YES ------> THEN onboard into shared Agent
                Registry/Gateway/PAB regime
```

Concretely, I'd check each acquired agent's actual PAB scope against what its real job requires (the same derivation Q3 describes, applied retroactively), verify there are no direct network paths bypassing what would become its Agent Gateway coverage (per Q6's failure mode), and confirm Model Armor/HITL coverage exists where this organization's standards would require it — remediating anything that doesn't meet baseline *before* the agent gains access to shared platform infrastructure, not after.

**Why not "register the acquired agents into the shared registry immediately with default trust, and review them on a normal ongoing cadence like any other agent"?** Immediate registration with default trust extends this organization's shared infrastructure's trust boundary to agents that were never built or reviewed against this organization's own governance standards — an ordinary ongoing review cadence assumes a baseline of trust that hasn't actually been established yet for these specific agents, which is exactly the gap a pre-integration baseline review is designed to close before any shared-infrastructure exposure occurs.

---

### Q15. "A security audit of a mature enterprise agent deployment finds gaps simultaneously across PAB scoping, Model Armor coverage, and Agent Gateway routing (some traffic bypasses it entirely). Design one coherent remediation plan and its priority order — not three unrelated fixes."

**What's really being asked.** An integrative closer testing whether the candidate can prioritize across multiple simultaneous findings by actual risk, rather than fixing whichever is most visible first or treating the three findings independently.

**Model answer.** I'd prioritize the **Agent Gateway bypass first**, because it's the finding that undermines visibility into the other two — if some traffic is bypassing Gateway entirely (per Q6's failure mode), that traffic isn't being monitored *at all*, which means the full extent of any PAB over-scoping or Model Armor coverage gaps on that specific bypassed traffic can't even be reliably assessed until the routing gap is closed. Fixing PAB scoping or Model Armor coverage first, while a blind spot in monitoring still exists, risks missing exactly the traffic where those other gaps matter most.

```
PRIORITY 1: Close the Gateway bypass
  (per Q6's fix) — restores VISIBILITY
  into all traffic, a prerequisite for
  correctly assessing the other findings
        |
        v
PRIORITY 2: Re-derive PAB scoping
  (per Q3/Q4's methodology) across
  affected agents, now that full
  traffic visibility exists to inform
  the review
        |
        v
PRIORITY 3: Tune Model Armor coverage
  (per Q8/Q9's approach) — informed by
  what the now-complete traffic
  visibility actually reveals about
  real content patterns needing coverage
```

Sequencing matters here specifically because visibility is a prerequisite for correctly diagnosing the scope of the other two problems — closing the routing gap first isn't just "fix the most severe finding," it's fixing the finding that determines how well you can actually assess and remediate the remaining two.

**Why not "fix the most visible or most embarrassing gap first — say, the PAB over-scoping, since that's the easiest to explain to leadership"?** Prioritizing by optics rather than by actual risk-and-dependency structure risks spending the first remediation effort on a finding whose true scope can't even be fully assessed yet, because the Gateway bypass means some of the relevant traffic was never visible in the first place — a remediation plan ordered by what's easiest to explain, rather than by what unblocks accurate assessment of the rest, produces a less coherent and less effective fix.
