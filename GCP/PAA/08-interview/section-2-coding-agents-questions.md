# Section 2 Questions — Using Coding Agents for Application Development

> **What this file is.** 17 interview-style questions focused
> specifically on **Section 2** of the exam (~17% weight): configuring
> coding agents (Antigravity, Claude Code on Google Cloud) with MCP
> servers and tool access, running them in secure sandboxes, using them
> to refactor and patch code, and customizing them with skills,
> plugins, hooks, rules, and subagents via Agents CLI. This file uses
> different scenarios than `agentic-architect-scenario-questions.md`'s
> existing Section-2 questions (a 40-repo CVE patch, a sandbox-vs-tool
> incident, a monorepo-vs-microservices comparison) and goes past
> `00-fundamentals-and-basics-questions.md`'s ground-zero definitions —
> treat all three files as complementary.
>
> **How to use this file.** These assume you already know what a
> coding agent is and why sandboxing matters (see the fundamentals file
> if not) and test the next level: which tool, which governance
> primitive, and how to reason about tradeoffs an engineering
> organization actually hits at scale.
>
> **Grounding.** Questions reference `04-architectures/pattern-coding-agent-cicd-integration.md`
> for the CI/CD-focused production pattern this section is built
> around — several questions here deliberately go beyond that pattern's
> CI/CD scope into interactive-use and fleet-governance territory the
> pattern file doesn't cover as its own diagram.
>
> **Currency note.** Every answer below uses **Agent Runtime** (never
> Agent Engine), **Agent Search** (never Vertex AI Search), **Gemini
> Enterprise** (never "Vertex AI Agent Builder"), **Antigravity** /
> **Claude Code on Google Cloud** (never "Gemini Code Assist"), and
> treats **ADK as open-source** and **PAB as an Agent-Identity-specific
> mechanism**, not generic IAM. See `../CLAUDE.md` §7 for the full
> corrections table.

---

### Q1. "Your org has three different coding-agent use cases: a nightly automated dependency-update job with no human present, an internal developer-portal integration that triggers code-review suggestions on every PR, and an engineer who wants an interactive pairing session at their desk. Which Antigravity surface — CLI, SDK, or App — fits each, and why not just pick one and use it everywhere?"

**What's really being asked.** Whether the candidate understands that Antigravity's CLI, SDK, and App aren't interchangeable skins on the same thing — they're built for different integration shapes — rather than treating "which one do I use" as an arbitrary preference.

**Model answer.** Each of these three cases has a different *caller* and a different *integration point*, and that's what should drive the choice, not habit or familiarity. The nightly dependency-update job has no human present and needs to run on a schedule from an automation system (a cron job, a CI scheduler) — that's a **CLI** fit: something scriptable, invocable non-interactively, with clean exit codes and machine-readable output an orchestrator can act on.

The developer-portal integration is a different shape entirely: some other piece of software (the portal itself) needs to invoke coding-agent capability programmatically as part of its own logic, likely needing structured request/response handling rather than a shell invocation — that's an **SDK** fit, embedding the capability directly into another application's code rather than shelling out to a CLI.

The interactive pairing session is the case the **App** is built for: a human sitting at their desk, in a live back-and-forth, wanting a real interface (not a terminal command, not an embedded SDK call) to collaborate with the agent in real time, with all the interactive affordances (undo, follow-up, visual diff review) that a live session benefits from.

**Why not "just pick the CLI for all three, since it can technically be invoked from anywhere including a portal backend or a wrapped interactive shell"?** Technical possibility isn't the same as fit — you *can* shell out to a CLI from a portal backend or wrap a CLI in a crude interactive loop, but you'd be reimplementing what the SDK and App already provide natively (structured programmatic responses, real interactive UX) using a tool designed for scriptable automation instead. Picking based on "what can technically be forced to work" instead of "what's actually built for this integration shape" creates unnecessary engineering overhead maintaining the workaround.

---

### Q2. "Design the MCP server configuration for a coding agent doing a large refactor that needs to: (1) look up ticket details from an internal ticketing system, (2) query an internal API catalog for service contracts, and (3) call a Google-Cloud-native MCP Server for a managed-database integration. Which of these three should require elevated approval just to configure, before the agent ever uses them?"

**What's really being asked.** Whether the candidate treats all MCP server connections as equally low-risk to wire up, or recognizes that pre-configuration governance should be proportional to what each server can actually reach and do — a judgment call, not a fixed rule.

**Model answer.** I'd tier these three by what unauthorized or misconfigured access could actually cost, and gate configuration approval accordingly, not just usage.

```
[Coding agent, mid-refactor]
        |
        +------------------+------------------+
        |                  |                  |
  [MCP: Ticketing]   [MCP: API Catalog]  [MCP: Cloud-native
   read-only lookup    read-only lookup   DB integration]
   LOW governance      LOW governance     HIGH governance
   (self-service           (self-service      (requires approval
    config OK)               config OK)         to even configure)
```

The ticketing lookup and API-catalog query are both **read-only, informational** integrations — worst case, the agent retrieves the wrong ticket or misreads a service contract, which is a correctness problem to catch in review, not a security incident. I'd let engineers configure these MCP connections themselves without a separate approval gate.

The Google-Cloud-native MCP Server for managed-database integration is categorically different: depending on the scope of access it's granted, it could allow the agent to read or write real production data. **That's the one requiring elevated, explicit approval before it's even wired up** — not because the agent is more likely to misuse it, but because the blast radius of a misconfiguration (overly broad database permissions, wrong environment targeted) is far larger than a bad ticket lookup. This is the same principle Section 5 formalizes with PAB (principal access boundary) — the point here is that the *pre-configuration* decision of which integrations exist at all should already reflect that risk tiering, before PAB even enters the picture as the runtime enforcement layer.

**Why not "gate all three MCP server connections behind the same approval process, to keep governance consistent and simple"?** Uniform gating sounds simpler but actually creates a worse outcome in practice: applying heavyweight approval to low-risk, read-only lookups slows down routine work for no real security benefit, which predictably leads to either approval-process fatigue (rubber-stamping everything, including the one that actually mattered) or engineers finding workarounds. Governance that's proportional to actual risk is more sustainable than uniform governance that's technically simple but practically ignored.

---

### Q3. "A coding agent needs to run inside a Cloud Workstations sandbox for an interactive pairing session today, and inside GKE for an automated nightly job tomorrow. Does the same skill/rule configuration carry over, or does it need to differ per sandbox?"

**What's really being asked.** Whether the candidate understands that customization primitives (skills, rules) are largely sandbox-portable in principle, but a few things genuinely don't transfer cleanly — testing for nuance rather than a flat "yes" or "no."

**Model answer.** Most of the configuration **should** carry over, and treating it as portable by default is the right instinct — a skill that teaches the agent "how our team writes database migrations" or a rule that says "never touch `/infra/prod`" describes agent behavior, not sandbox mechanics, so there's no reason that knowledge should differ based on where the agent happens to be executing.

Where it genuinely doesn't transfer cleanly: anything that assumes **interactive presence** or **environment-specific resources**. A rule or hook tuned for the interactive pairing session — say, "pause and ask before applying a destructive change" — makes no sense in the unattended GKE nightly job, since there's no human present to answer the pause. Similarly, if the Cloud Workstations session has access to a locally-mounted credential or a dev-only resource that the GKE job's more restricted, automation-oriented sandbox doesn't have, any skill or rule referencing that resource needs an environment-aware branch rather than a blind carryover.

The practical design is: keep the **behavioral** layer (skills describing conventions, rules describing hard constraints) shared and sandbox-agnostic wherever possible, and isolate the **environment-interaction** assumptions (human-in-the-loop pauses, resource paths, credential access patterns) into separate, sandbox-specific configuration that's swapped based on where the agent is actually running.

**Why not "maintain two entirely separate configurations, one per sandbox, to avoid any cross-environment surprises"?** That avoids the environment-mismatch risk but at the cost of configuration drift — the two configurations will diverge over time as one gets updated and the other doesn't (a classic "we fixed the rule in one place and forgot the other" bug), and most of the content genuinely is identical (the team's migration conventions don't change based on sandbox). Splitting only the parts that actually need to differ, and sharing everything else, avoids both the drift risk and the interactive-assumption mismatch.

---

### Q4. "Design a secure, governed coding-agent platform for an engineering organization standardizing thousands of engineers on Antigravity and Claude Code on Google Cloud — covering skill/plugin distribution, sandboxing, and fleet-level governance."

**What's really being asked.** The flagship system-design question for this file — whether the candidate can design org-wide coding-agent infrastructure end to end, not just describe individual features in isolation.

**Model answer.** At this scale, the design has to separate **authoring-time customization** from **fleet-wide governance**, because thousands of engineers each configuring their own skills/rules independently would produce inconsistent, unreviewed agent behavior across the org.

```
                    [Central Skill/Plugin Registry]
                    (reviewed, versioned, org-approved
                     skills, plugins, rules — not
                     ad-hoc per-engineer configs)
                              |
              +---------------+---------------+
              |                               |
   [Antigravity / Claude Code            [Agents CLI — fleet
    on Google Cloud instances,            governance layer:
    per-engineer or per-team]             policy enforcement,
              |                            usage monitoring,
              v                            agent-mode vs
   [Tiered sandboxes by risk:              human-mode policy
    interactive Cloud Workstations         per repo/team]
    vs. automated GKE jobs]                       |
              |                                    v
              +----------------------> [Central audit log:
                                         who ran what, which
                                         skills/plugins were
                                         active, PAB-scoped
                                         actions taken]
```

I'd distribute skills and plugins from a **central, reviewed registry** rather than letting each engineer author their own from scratch — this is the same principle as Q2's tiered-approval reasoning applied to customization content itself: an unreviewed skill teaching the agent an incorrect or insecure convention, if adopted broadly, is a much bigger problem than one engineer's private mistake. **Agents CLI** is the fleet-governance layer on top of that: enforcing which teams/repos operate in agent-mode (autonomous) versus human-mode (approval-gated) based on that repo's risk tier — a public open-source repo can reasonably run in a looser mode than an internal billing-system repo — and providing the operational visibility (usage monitoring, policy enforcement) a platform team needs at thousands-of-engineers scale.

Sandboxing follows the tiered-by-risk model directly: interactive work happens in Cloud Workstations sandboxes scoped to that engineer's own permissions, while unattended automation runs in more locked-down GKE-based sandboxes with narrower, task-specific access. Every action, regardless of sandbox or mode, feeds a central audit log — not for surveillance's own sake, but because at this scale, "what did the agent actually do across the whole org last week" needs to be an answerable question, not something reconstructed after an incident.

**Why not "let each team configure and govern their own coding-agent usage independently, since teams know their own repos best"?** Team-level autonomy over which skills/rules to use is fine and even desirable for team-specific conventions, but *governance* (approval gating, sandboxing tiers, audit logging) needs to be centrally enforced, not independently reinvented per team — otherwise you get exactly the inconsistent, unreviewed behavior this design is trying to prevent, just distributed across dozens of teams' independent, uncoordinated governance decisions instead of one team's.

---

### Q5. "An engineer asks a coding agent to refactor a legacy billing module and reports back: 'this is now about 30% faster.' How do you scope what the agent was allowed to touch, and how do you verify that performance claim before trusting it?"

**What's really being asked.** Whether the candidate treats an agent-reported performance improvement as a verified fact or as a claim requiring independent verification — and whether they think about scoping *before* the refactor starts, not just reviewing after.

**Model answer.** Scoping happens first, before the agent touches anything: for a legacy billing module specifically, I'd constrain the agent's file/path access to exactly the module boundary (via rules or path-scoping configuration) rather than granting broad refactor latitude across the codebase — billing code often has non-obvious cross-module dependencies (shared utility functions, database schema assumptions) that an agent operating outside a tight scope could touch without realizing the blast radius.

On the performance claim itself: "about 30% faster" reported by the agent is a **claim to verify, not a fact to record**. I would not accept it without independent measurement — run the actual before/after benchmark myself (or via a CI-integrated benchmark step) under realistic load conditions, using the same methodology for both measurements, before that number goes into any changelog, PR description, or performance dashboard. Agents can and do produce plausible-sounding but unverified quantitative claims, the same way a human engineer's own back-of-envelope estimate would need checking before being treated as fact — the risk isn't unique to agents, but it's easy to under-scrutinize a confident-sounding agent output specifically because it reads as precise.

I'd also check *what* the agent measured, not just trust the number in isolation — a "30% faster" claim on a synthetic micro-benchmark that doesn't reflect real production query patterns is a very different (and much less trustworthy) claim than one measured against realistic production-shaped load.

**Why not "trust the agent's reported number since it presumably ran some kind of benchmark to arrive at it"?** An agent reporting a number doesn't confirm the benchmark methodology was sound, ran under realistic conditions, or used a fair before/after comparison — "it presumably measured something" is not the same guarantee as "a human verified the measurement was methodologically valid." Unverified performance claims, whether from an agent or a person, shouldn't enter production documentation or decision-making without independent confirmation.

---

### Q6. "A coding agent is asked to patch a reported application-layer vulnerability (an unvalidated input reaching a downstream system). The proposed fix passes all existing tests — but on review, it turns out the fix just suppresses the specific warning the security scanner flagged, rather than actually validating the input. What went wrong, and how do you redesign the review process?"

**What's really being asked.** A diagnostic/judgment question on the difference between a fix that satisfies a check and a fix that addresses a root cause — and whether the candidate's redesign catches this class of failure going forward, not just this one instance.

**Model answer.** What went wrong is a classic "optimized for the metric, not the goal" failure: the agent's proposed change made the specific scanner warning go away, which is a narrower target than "the input is now actually validated before reaching the downstream system." Passing existing tests doesn't rule this out either, since the existing test suite — written before this vulnerability was discovered — almost certainly doesn't have a test case that would catch "the warning is suppressed but the underlying unvalidated path still exists," precisely because that specific gap wasn't anticipated when those tests were written.

The redesign needs two changes. First, **the fix needs a new, specific test asserting the actual security property** — "input X, which previously reached the downstream system unvalidated, is now rejected or sanitized before it gets there" — not just "the scanner no longer flags this line." A fix for a security finding should always come with a test that would fail against the *original* vulnerable code and pass against the *fix*, which forces the fix to address the real behavior rather than the tool's detection of it. Second, **human review of security-relevant agent changes should specifically check for suppression patterns** — a fix that touches error handling, logging levels, or scanner-suppression annotations near the flagged line, without a corresponding change to the actual validation logic, is a reviewable red flag pattern worth explicitly training reviewers (and potentially a review-time rule for the agent itself) to catch.

**Why not "just re-run the security scanner after the agent's fix, and trust it if the warning is gone"?** That's exactly the check that was already satisfied and still let this exact bug through — the whole failure mode here is a fix that makes the scanner's specific signal disappear without fixing the underlying condition the scanner was trying to detect. Re-running the same scanner that already approved of the suppression doesn't add new information; it needs an independent test of the actual security property, not another pass of the same detection mechanism the fix was implicitly optimized against.

---

### Q7. "A team wants the coding agent to 'know' how their organization writes database migrations — a specific file-naming convention, a required rollback section, a standard header comment. Separately, another team wants the agent to gain the ability to query an internal feature-flag service it currently has no access to. Are these the same kind of customization?"

**What's really being asked.** Whether the candidate can cleanly distinguish a skill (taught knowledge/convention) from a plugin (added capability) using concrete, contrastive cases rather than reciting the abstract definitions.

**Model answer.** No — these are two different primitives doing two different jobs, even though both are "customizing the agent" in a loose sense. The database-migration convention is **knowledge the agent should apply using capabilities it already has** — the agent already knows how to write files and structure code; what it's missing is the *convention*: naming pattern, required sections, house style. That's a **skill**: teaching the agent how your organization does something it can already technically do.

The feature-flag service access is different in kind: the agent currently has **no way at all** to query that service — there's no existing capability to apply a convention to, because the capability itself doesn't exist yet. That's a **plugin**: giving the agent a new capability it didn't have before, not teaching it a preference about how to use an existing one.

A quick test I'd apply when the distinction is unclear: "if I removed this customization, would the agent still be *able* to do the underlying task, just without following our convention (skill), or would the agent lose the *ability* to do the task at all (plugin)?" Removing the migration-convention skill leaves the agent still able to write a migration file, just without the house style. Removing the feature-flag plugin leaves the agent completely unable to query that service — there's no fallback "does it, just less well" behavior.

**Why not "treat both as 'skills' since they're both configuration that changes what the agent does"?** Collapsing the distinction loses an important practical signal: a skill is generally lower-risk to add (it shapes behavior within existing capabilities) while a plugin is adding genuinely new reach (a new system the agent can now touch), which is exactly the kind of change that deserves the tiered governance scrutiny discussed in Q2 — new capability to a new internal service is a bigger surface-area change than a naming-convention preference, and treating them identically under one label obscures that risk difference.

---

### Q8. "Design an extension-hook chain for a regulated industry's compliance requirements: every commit must attach a change-justification, and every merge must have a demonstrably unbroken audit trail back to that justification."

**What's really being asked.** Whether the candidate can design a lifecycle-enforcement mechanism (hooks) for a compliance requirement — distinct from a skill or a rule, which describe behavior the agent is instructed to follow rather than something that runs regardless of what the agent "decides."

**Model answer.** This needs to be enforced at the lifecycle level, not the instruction level, precisely because compliance requirements can't depend on the agent (or a human) remembering to follow an instruction every time — a **hook chain** runs deterministically at defined points regardless of what anyone intends in the moment.

```
[Commit attempt]
     |
     v
[PRE-COMMIT HOOK: require change-justification field
 populated (structured, not free text) — block commit
 if missing]
     |
     v
[Commit recorded, justification attached as commit metadata]
     |
     v
[POST-TEST HOOK: attach test-run results + timestamp
 to the same audit record]
     |
     v
[PRE-MERGE HOOK: verify unbroken chain — every commit
 in this merge has a justification AND a test-result
 record; block merge if any link is missing]
     |
     v
[Merge allowed, full audit trail (justification -> tests
 -> merge) retained for compliance review]
```

The pre-commit hook is what makes the justification mandatory rather than a best-effort convention — a rule saying "please add a justification" can be forgotten under deadline pressure; a hook that blocks the commit until the field is populated can't be. The pre-merge hook is the actual audit-trail guarantee: it's not enough that individual commits *each* have a justification if the chain connecting justification → tests → merge can have gaps; the pre-merge check specifically verifies the whole chain is intact before allowing the merge, which is the property the compliance requirement actually cares about.

**Why not "just add a rule telling the coding agent to always include a change-justification when it commits"?** A rule instructs the agent's own behavior, but doesn't stop a human engineer (or a differently-configured agent, or a direct git push bypassing the agent entirely) from committing without one — and compliance requirements typically need to hold regardless of *who or what* is committing, not just "when this specific agent is following its instructions." A hook enforced at the repository/pipeline level closes that gap in a way an agent-level rule structurally cannot.

---

### Q9. "A developer asks: 'We have a coding-agent rule saying don't touch `/infra/prod`, and separately a PAB policy restricting the agent's service-account permissions so it can't actually write to production infrastructure even if it tried. Isn't that redundant — why do we need both?'"

**What's really being asked.** Whether the candidate can explain defense-in-depth specifically as it applies to coding agents' two different enforcement layers — behavioral instruction versus actual permission boundary — rather than agreeing that one makes the other unnecessary.

**Model answer.** They're not redundant because they enforce the constraint at two fundamentally different layers, and each one covers a failure mode the other doesn't. The **rule** ("don't touch `/infra/prod`") is a **behavioral instruction** — it shapes what the agent *intends* to do and is highly effective at preventing accidental, well-intentioned mistakes (the agent correctly reasons "this file is in `/infra/prod`, I shouldn't modify it" and doesn't). But a rule is only as reliable as the agent's own reasoning about it — a sufficiently unusual prompt, a misinterpretation of file scope, or in an adversarial framing (e.g., prompt injection from a malicious ticket description the agent is processing), could cause the agent to violate an instruction it was "supposed" to follow.

**PAB**, by contrast, is an **enforced permission boundary** on the underlying service account's actual credentials — it doesn't depend on the agent's reasoning at all. Even if the agent somehow decided (correctly instructed or not) to attempt a write to production infrastructure, the underlying identity simply doesn't have the permission to succeed. This is the same principle as defense-in-depth anywhere else in security: a behavioral control (the rule) reduces the *likelihood* of an attempt, while a hard permission boundary (PAB) limits the *consequence* if a behavioral control ever fails — and coding agents specifically are a context where behavioral controls have a demonstrated failure mode (they can be reasoned around, misapplied, or manipulated) that a hard permission boundary doesn't share.

**Why not "just rely on the PAB policy alone, since it's the one that actually guarantees the outcome regardless of agent behavior"?** The PAB policy guarantees the agent *can't succeed* at an unauthorized write, but it doesn't prevent the agent from *attempting* one, generating a failed action, an error state, or wasted work partway through a task before hitting the permission wall — which is worse for both auditability (why did the agent try this at all) and efficiency than an agent that correctly avoids the attempt in the first place because of a well-followed rule. The rule reduces bad attempts; PAB guarantees bad attempts can't succeed — you want both, not one instead of the other.

---

### Q10. "A large monorepo refactor is split across three subagents: one updates call sites, one rewrites tests, one updates documentation. How do you decide that split, and what happens when two subagents' changes conflict — say, the call-site-update subagent renames a function the test-rewriting subagent is simultaneously writing new tests against under the old name?"

**What's really being asked.** Whether the candidate can reason about both subagent task decomposition *and* the harder, often-skipped part: what actually happens when parallel subagent work collides.

**Model answer.** The split itself (call sites / tests / docs) is a reasonable first-pass decomposition because each piece touches largely disjoint *files* even though they're logically connected to the same underlying change — that's a legitimate parallelization axis. But "disjoint files" doesn't mean "no dependency," and the exact conflict described (a rename happening in one subagent's work while another subagent references the pre-rename name) is precisely the predictable failure mode of parallelizing tightly-coupled work by file-type rather than by dependency order.

The fix isn't to abandon parallelization — it's to sequence the pieces that have a real dependency and only parallelize the pieces that don't. A function rename is a **hard dependency**: every other subagent's work that references that function's name needs the rename to have already happened, or needs to be re-run/reconciled after it does. I'd restructure this as: run the call-site-update subagent (which owns the rename) *first*, to completion, then launch the test-rewriting and documentation-update subagents *afterward*, in parallel with each other (since tests and docs don't have a similar hard dependency on one another) — rather than launching all three simultaneously and hoping for no collision.

For a conflict that does occur despite sequencing (a genuinely unanticipated overlap), the recovery principle from this repo's own bulk-generation approach applies here too: diff actual file state to see what each subagent actually produced, rather than assuming both subagents' outputs are equally valid and trying to blindly merge them — reconcile based on which subagent's work reflects the authoritative, most-recent state (the rename), and re-run only the downstream work that's actually now stale.

**Why not "run all three subagents in parallel from the start, since they're each assigned to a different file category and file-level parallelization is usually safe"?** File-level disjointness is a necessary but not sufficient condition for safe parallelization — these three subagents' files are disjoint, but their *content* has a real dependency (the test files reference function names that the call-site subagent is changing), which is exactly the kind of coupling that "different files" doesn't protect against. Task decomposition needs to account for logical dependency, not just which files each piece touches.

---

### Q11. "Design an Agents CLI fleet-level policy distinguishing agent-mode (autonomous) from human-mode (approval-gated) operation across two repos: a public open-source library, and an internal billing-system repo."

**What's really being asked.** Whether the candidate can design per-repo risk-tiered autonomy policy at fleet scale — a different angle than a single-incident autonomy question, testing systematic policy design instead.

**Model answer.** The right policy tier tracks **blast radius of an unreviewed mistake**, and these two repos sit at opposite ends of that spectrum. The public open-source library has a natural safety net that's external to the coding agent itself: open-source contributions already go through public PR review, community scrutiny, and typically don't touch anything with direct financial or customer-data consequence — a coding agent operating in a more autonomous **agent-mode** here (proposing and even auto-merging low-risk changes like dependency bumps or lint fixes, with human review reserved for substantive logic changes) is a reasonable risk tradeoff, since the existing public-review process is itself a real check.

The internal billing-system repo is the opposite case: a mistake here has direct financial consequence, no public-review safety net, and typically stricter compliance requirements (audit trails, controlled change processes) than an open-source project. I'd configure this repo for **human-mode** as the default — every agent-proposed change requires explicit human approval before merge, regardless of how small or "obviously safe" it looks, because the cost of an unreviewed mistake here is categorically higher than in the OSS repo.

```
[Agents CLI — fleet policy]
        |
   +----+----------------------------+
   |                                 |
[Public OSS repo]              [Billing-system repo]
agent-mode: low-risk            human-mode: ALL changes
changes (deps, lint)            require explicit approval
auto-proposed, light            before merge, regardless
review gate                     of apparent size/risk
```

I'd also make this a **repo-attribute-driven** policy rather than a manually-maintained list, where possible — new repos tagged as handling financial/customer data automatically default to human-mode, rather than relying on someone remembering to configure each new repo correctly as the org's repo count grows.

**Why not "use the same moderate middle-ground policy for both — some auto-approval, some human review — to avoid maintaining two different configurations"?** A single middle-ground policy either over-restricts the low-risk OSS repo (slowing down genuinely low-stakes work with unnecessary review gates) or under-restricts the high-stakes billing repo (allowing some class of unreviewed change that's actually too risky to auto-approve there) — the entire point of risk-tiered policy is that "moderate for everything" isn't actually the right level of caution for either extreme case.

---

### Q12. "Explain what it concretely means to use Agents CLI to 'build, scale, govern, and optimize' a fleet of services that coding agents have already built and deployed — not the coding agent itself, but its output."

**What's really being asked.** Whether the candidate understands Agents CLI as an operational, post-authoring layer — managing what coding agents *produced*, not just configuring the agents while they're writing code.

**Model answer.** This is a lifecycle distinction: Antigravity (and Claude Code on Google Cloud) is the **authoring-time** tool — where code gets written, refactored, reviewed. Agents CLI's "build, scale, govern, optimize" framing is about what happens **after** that code is deployed and running as real services in production, operated at fleet scale.

```
[Antigravity / Claude Code on Google Cloud]
   AUTHORING TIME: agent writes/refactors code
              |
              v
        [Code deployed as a running service]
              |
              v
   [Agents CLI — FLEET OPERATIONS LAYER]
        |
   +----+----+----+----+
   |    |    |    |
 BUILD SCALE GOVERN OPTIMIZE
   |    |    |    |
   |    |    |    +-- cost/performance tuning across
   |    |    |         the deployed fleet, informed by
   |    |    |         real production usage patterns
   |    |    +-- policy enforcement (which services can
   |    |         call which others, PAB-scoped access,
   |    |         compliance checks) on already-running
   |    |         services
   |    +-- scaling decisions (which services need more
   |         capacity, autoscaling policy) based on
   |         actual production load, not authoring-time
   |         assumptions
   +-- ongoing build/CI orchestration for the fleet as a
        whole, not a single service's build
```

Concretely: **build** here means orchestrating ongoing builds/CI across a fleet of coding-agent-produced services, not the initial authoring; **scale** means capacity and autoscaling decisions informed by real production load; **govern** means enforcing policy (access boundaries, compliance) on services that are already live, not on the agent's authoring behavior; **optimize** means using actual production telemetry to tune cost and performance across the fleet. The common thread is that all four verbs operate on **already-deployed, already-running** services — this is squarely an operations concern, distinct from Section 4's evaluation/deployment-selection concerns (which happen before or at deployment time) and distinct from Antigravity's own authoring-time customization (skills, plugins, hooks).

**Why not "treat this as just a more advanced form of the coding-agent customization already configured in Antigravity"?** Antigravity's customization primitives (skills, plugins, rules) shape how the agent *writes code* — they operate at authoring time, on the agent's own behavior. Agents CLI's fleet-operations role operates on the *deployed output* of that authoring process, at a completely different point in the lifecycle, with different concerns (production load, live policy enforcement) that authoring-time customization has no visibility into at all.

---

### Q13. "A coding agent operating in agent-mode (autonomous, no human review gate) makes a change that passes CI but is later found to have introduced a subtle logic bug that reached production. Whose failure is this, and how do you redesign?"

**What's really being asked.** A retrospective, incident-driven judgment question on autonomy calibration — distinct from a forward-looking "design the autonomy split" question — testing whether the candidate assigns responsibility usefully rather than either blaming the agent or the process alone.

**Model answer.** I'd resist framing this as "the agent's failure" in isolation — the agent operated exactly within the autonomy level it was configured for (agent-mode, no human gate), so the more useful question is whether **that configuration decision** was the right one for this specific class of change, not whether the agent behaved badly. The actual failure is that CI passing was treated as a sufficient signal to allow unreviewed, autonomous merges for changes of this risk level, when it evidently wasn't (a subtle logic bug that CI didn't catch reaching production is, definitionally, a case where "tests pass" and "the change is safe to merge unreviewed" turned out not to be the same claim).

The redesign has two parts. First, a genuine retrospective on **why** CI didn't catch it — was this a gap in test coverage that should be closed regardless of the autonomy question, or a fundamentally hard-to-test class of logic bug? Closing a real coverage gap benefits every future change, agent-authored or not. Second, and more specific to the autonomy question: reassess whether this repo/change-type genuinely belongs in agent-mode at all, using the same risk-tiering logic as Q11 — if this component's blast radius from an undetected bug is high enough that CI-passing alone isn't a sufficient bar for autonomous merge, that's a signal to move this specific area to human-mode (approval-gated), not necessarily the whole repo.

**Why not "just add more test coverage for this specific bug pattern and keep agent-mode as-is everywhere else"?** Only fixing the specific coverage gap treats this as a one-off testing miss rather than examining whether the underlying policy decision (letting this class of change merge autonomously based on CI alone) was sound in the first place — if the same repo has other equally-subtle, equally-uncovered logic-bug classes waiting to happen, patching this one instance doesn't address the systemic question of whether CI-passing is actually a sufficient autonomous-merge bar for this repo's risk level.

---

### Q14. "An organization already standardized on Claude Code elsewhere in the company wants consistency and asks whether to also use it here, versus using Antigravity's deeper native customization surface (skills, plugins, hooks, rules, subagents) for a new, highly specialized internal tool-building team. How do you advise them?"

**What's really being asked.** Whether the candidate treats this as an arbitrary, no-real-difference choice, or reasons about it using the specific tradeoff the exam guide frames these two tools around — without inventing an unsupported hierarchy between them.

**Model answer.** I'd frame this explicitly as **organizational consistency versus customization depth**, since that's the real tradeoff here, not "which tool is better" in the abstract — the exam guide names Antigravity and Claude Code on Google Cloud as coequal coding-agent examples, not a primary-and-alternative pairing, so the right answer depends on this team's specific situation rather than a general preference for one over the other.

For a team already benefiting from company-wide Claude Code standardization — shared institutional knowledge, existing tooling/integration investment, engineers who can move between teams without relearning a different coding-agent surface — there's real, non-trivial value in staying consistent, and I'd weight that heavily unless this specific team's needs clearly outweigh it.

The case for switching to Antigravity here is the highly-specialized internal tool-building team's likely need for **deep native customization**: extensive skills/plugins/hooks/rules/subagents tailored to unusual, internal-only conventions that a general-purpose coding agent might support less natively. If this team's actual workflow genuinely depends on that depth of customization — not just "it'd be nice to have," but a real, identified gap in what company-standard tooling currently provides them — that's a legitimate reason to diverge from the org's default, accepting the cost of reduced cross-team tooling consistency in exchange for capability this specific team needs.

I'd push back on treating this as automatic either way: defaulting to consistency without checking whether this team's needs actually require the customization depth wastes real capability they might need; defaulting to Antigravity without confirming an actual customization gap (rather than a vague preference) creates unnecessary organizational fragmentation.

**Why not "recommend Antigravity by default, since its named customization primitives (skills, plugins, hooks, rules, subagents) sound more powerful than a general-purpose tool"?** Sounding more feature-rich in the abstract isn't the same as this team having an actual, identified need for that specific depth — recommending a switch based on a features list rather than a demonstrated requirement risks paying the real cost of losing org-wide consistency for customization capability the team may not end up meaningfully using.

---

### Q15. "Design a tiered sandboxing model for one organization that needs: (a) a fully locked-down sandbox for an agent patching security vulnerabilities, (b) a lighter sandbox for routine style/lint-only refactors, and (c) an interactive Cloud Workstations sandbox for exploratory development work."

**What's really being asked.** Whether the candidate can generalize sandboxing from a binary "GKE vs. Cloud Workstations" choice into a genuine risk-tiered model with more than two levels — a synthesis question, not a restatement of the basic sandbox comparison.

**Model answer.** These three cases don't map onto a simple binary; they need three distinct tiers of restriction, matched to what could go wrong in each.

```
TIER 1 (most restricted)         TIER 2 (moderate)              TIER 3 (least restricted,
Security-vulnerability           Style/lint-only refactors      most interactive)
patching agent                                                  Exploratory dev work
        |                               |                               |
[GKE sandbox, minimal        [GKE sandbox, broader        [Cloud Workstations,
 tool/network access,         file-write access within     full interactive access,
 write-scoped to ONLY the     the repo, but still no        engineer-level permissions,
 specific vulnerable file(s), network egress needed for     used for exploration, not
 no external network access,  a lint/format pass, no        unattended production
 mandatory human review        elevated credentials]         changes]
 before merge regardless
 of how narrow the fix is]
```

**Tier 1** gets the tightest restriction because a security fix, if the agent's own reasoning about the vulnerability is subtly wrong, could itself introduce a new problem (echoing Q6's "fix that doesn't actually fix it" failure mode) — narrow write scope, no network access the agent doesn't strictly need, and mandatory human review regardless of how small the diff looks, since "small diff" doesn't guarantee "correctly reasoned security fix."

**Tier 2** is meaningfully lighter — a lint/style-only refactor has a much smaller blast radius if something goes wrong (worst case, a formatting change needs reverting), so I'd allow broader write access within the repo without the same mandatory-review overhead, though still with no elevated credentials or unnecessary network reach, since "lower risk" isn't "no risk."

**Tier 3** is the interactive case, closer to a human engineer's own normal development permissions, because a human is actively present and can catch problems in real time the way neither of the automated tiers has that safety net for.

**Why not "use the same moderately-restricted sandbox for all three, since it's simpler to maintain one configuration"?** A single moderate tier either over-restricts the low-risk lint refactors (adding friction with no real safety benefit) or under-restricts the security-patching case (not providing the narrow scope and mandatory review that specific risk actually warrants) — exactly the same argument Q11 makes against a one-size-fits-all autonomy policy applies here to sandboxing: the right restriction level tracks actual risk per case, not administrative convenience.

---

### Q16. "Should a 'run our security scanner before every commit' requirement be built as an MCP server the coding agent calls, or as a pre-commit extension hook?"

**What's really being asked.** Whether the candidate can distinguish tool-access (something the agent chooses to invoke as part of its own reasoning) from lifecycle-enforcement (something that runs regardless of the agent's choices) — the same category distinction Q8 makes for hooks generally, applied to a concrete either/or case.

**Model answer.** This should be a **pre-commit hook**, not an MCP server, because the defining requirement — "before every commit," no exceptions — is a lifecycle-enforcement guarantee, and an MCP server is fundamentally a capability the agent *invokes when it decides to*, not a control that runs independent of the agent's decision-making.

If the security scanner were exposed as an MCP server, the agent would need to remember to call it, correctly, every single time, as part of its own reasoning about what to do next — which reintroduces exactly the reliability gap Q8 argues against for compliance requirements: an instruction-following dependency, where a sufficiently unusual task, a misprioritized step, or an edge case the agent doesn't recognize as "this needs scanning" could result in a commit going through unscanned. A pre-commit hook runs at the commit boundary itself, structurally, regardless of whether the agent's own reasoning happened to include "and now I should run the scanner."

The distinguishing test I'd apply generally: if the requirement is "the agent should be *able* to check X when it judges that relevant" — a tool-access, MCP-server case. If the requirement is "X must happen every time, full stop, regardless of what anyone decides in the moment" — a lifecycle-enforcement, hook case. "Before every commit" is squarely the second kind.

**Why not "expose it as an MCP server, since that gives the agent more flexibility to run additional scans whenever it judges appropriate, not just at commit time"?** That flexibility is a real, independent benefit — the agent *could* additionally use an MCP-exposed scanner mid-task, ad hoc, whenever it wants extra confidence — but it doesn't substitute for the mandatory, no-exceptions guarantee the pre-commit hook provides. These aren't mutually exclusive: you can have both (an ad-hoc-invocable MCP tool for extra scans, plus a mandatory pre-commit hook as the actual guarantee), but the hook is what satisfies "before every commit," not the MCP server alone.

---

### Q17. "Walk me through standing up coding-agent tooling for a 200-engineer organization from zero: governance, sandboxing, customization, and fleet operations, in that order. Justify the sequence."

**What's really being asked.** An integrative closer distinct from Q4's target-architecture design — this asks for the **rollout sequence** and the reasoning behind that order, not the steady-state end-state architecture.

**Model answer.** I'd deliberately front-load governance and sandboxing before customization and fleet operations, because getting those two right *first* constrains what customization and operations can safely do later — building customization and scale on top of an unclear governance model means retrofitting restrictions onto behavior that's already spread across the org, which is much harder than establishing the boundary first.

```
STEP 1: GOVERNANCE                STEP 2: SANDBOXING
Define risk tiers (per Q11's      Establish sandbox tiers matched
repo-risk model) and agent-mode   to Q15's model BEFORE broad
vs human-mode defaults BEFORE     rollout, so engineers never
any engineer starts using the     operate coding agents outside
tooling broadly                   an intended containment boundary
        |                                    |
        v                                    v
STEP 3: CUSTOMIZATION                 STEP 4: FLEET OPERATIONS
Central skill/plugin registry         Agents CLI governance/
(per Q4's design) rolls out           monitoring layer activates
ONCE governance/sandbox               ONCE there's a real fleet
boundaries already constrain          of agent-produced services
what a skill/plugin could ever        to actually operate — this
misuse, even if poorly reviewed       naturally comes last since
                                       it depends on the earlier
                                       steps already being live
```

**Governance first**: deciding risk tiers and mode defaults before rollout means every engineer's first experience with the tooling already happens inside the intended boundaries, rather than starting unrestricted and being retroactively locked down later (which is both an engineering-culture problem — "why are you taking away access I already had" — and a security gap during the ungoverned interim). **Sandboxing second**: establishing the tiered containment model immediately after governance, and before broad customization rollout, ensures that whatever skills/plugins get adopted next are already operating inside appropriately-scoped execution environments, rather than customization capability existing before the containment meant to bound its effects does. **Customization third**: the central registry rolls out once the governance and sandboxing boundaries already limit how much damage a poorly-reviewed skill or plugin could do, which is a meaningfully safer sequence than customization-first. **Fleet operations last**, naturally, since Agents CLI's "build, scale, govern, optimize" role (Q12) operates on an already-existing fleet of agent-produced, deployed services — there's nothing for it to operate on until the earlier steps have actually produced that fleet.

**Why not "roll out customization and let teams start getting value immediately, then layer governance and sandboxing on once usage patterns become clear"?** That ordering optimizes for early visible value at the cost of an ungoverned interim period where thousands of engineers are producing agent-authored changes without the risk-tiering and containment boundaries this design considers foundational — retrofitting governance onto already-adopted, already-diverse usage patterns is a materially harder and more disruptive change than establishing the boundary before broad adoption, which is exactly the ordering tradeoff this question is testing.
