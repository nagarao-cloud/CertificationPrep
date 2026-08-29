# Section 2 — additional practice questions (18)

> Using coding agents for application development (~17% of the exam).
> These 18 questions are **additional** to the 16 already at the end of
> `01-domains/SECTION-2-coding-agents.md` — different scenarios, no
> wording overlap. Every option is explained inline.

**Q1.** A coding agent profiles a data-processing service and finds a
loop with quadratic time complexity that dominates response latency
under load. It rewrites the loop to a linear-time algorithm with
identical output. Which task 2.1 consideration does this best
illustrate?
A) Configuring MCP servers
B) Optimizing execution runtimes
C) Patching an application-layer vulnerability
D) Using a secure sandbox

*Answer: B.* Task 2.1 explicitly names "optimize execution runtimes"
as a distinct coding-agent activity from refactoring for
readability/structure or fixing security flaws — algorithmic
complexity improvement is a canonical example. (A) is a tool-access
configuration concern, unrelated to this activity. (C) is a different
named activity (security fixes), not a performance rewrite. (D) is an
execution-environment concern, not what the agent is doing to the
code.

**Q2.** A coding agent updates a dependency to a patched version after
identifying it was vulnerable to a known, published CVE. Which task
2.1 consideration is this?
A) Optimizing execution runtimes
B) Patching an application-layer vulnerability
C) Configuring a secure sandbox
D) Creating a subagent

*Answer: B.* This is explicitly "patch application-layer
vulnerabilities" from task 2.1 — a source/dependency-level security
fix. (A) is a performance activity, not a security fix. (C) is about
where code executes, not a fix the agent makes to code. (D) is an
unrelated customization primitive.

**Q3.** A team wants to give their coding agent the ability to run a
proprietary static-analysis tool as part of every task, adding a new
piece of reusable functionality the agent didn't have before. Which
Antigravity customization primitive best fits "adding new capability"
as opposed to "encoding a convention"?
A) A rule
B) A plugin
C) A subagent
D) A managed session

*Answer: B.* Plugins add modular capability the agent didn't
previously have; this is different from a skill (which packages a
reusable convention/how-to) or a rule (a constraint). (A) rules
constrain behavior, they don't add capability. (C) subagents delegate
scoped tasks to a worker, they don't add a tool capability to the
primary agent. (D) managed sessions are a Section 3 runtime-state
concept, unrelated to Antigravity customization.

**Q4.** A security-conscious team wants their coding agent's execution
environment to enforce fine-grained network policies (e.g., blocking
egress to all but an explicit allowlist of internal services) per
task, with full control over the isolation boundary. Which sandbox
option best fits, and why over the alternative?
A) Cloud Workstations, because it requires no operational overhead
B) GKE, because it offers the deeper infrastructure-level control
   (e.g., custom network policies) that a managed, ready-to-go
   environment like Cloud Workstations doesn't expose
C) Antigravity App, because sandboxing is irrelevant to that surface
D) Neither — fine-grained network policy isn't possible for coding
   agent sandboxes

*Answer: B.* This mirrors the GKE-vs-Cloud-Workstations tradeoff:
Cloud Workstations trades control for managed convenience, while GKE
gives deeper infrastructure control (like custom network policy
enforcement) at the cost of more operational overhead. (A) describes
Cloud Workstations' convenience but not why it's the wrong fit here.
(C) is false — the App surface still executes in some sandbox context.
(D) is false — this is exactly the kind of control GKE is chosen for.

**Q5.** A DevOps team wants coding-agent tasks triggered automatically
as a step in an existing CI pipeline, with no human watching an
interactive session. Which Antigravity surface fits?
A) App
B) CLI
C) SDK, used only for interactive chat
D) Agents CLI, exclusively, with Antigravity uninvolved

*Answer: B.* The CLI is the scriptable, automation-oriented,
headless-friendly surface — a natural fit for CI pipeline steps. (A)
App is interactive/human-driven, not the fit for unattended pipeline
automation. (C) mischaracterizes the SDK, which is for embedding
capability into other software, not "interactive chat only." (D) is a
different, complementary operational tool (build/scale/govern/optimize
deployed agents), not the pipeline-trigger surface for a dev-time
coding task.

**Q6.** A developer interactively explores an unfamiliar legacy
codebase, asking a coding agent follow-up questions and reviewing
suggested changes turn by turn before applying them. Which Antigravity
surface best matches this pattern?
A) CLI, used headlessly in a script
B) App, the interactive human-driven surface
C) SDK, embedded in another product with no human in the loop
D) None — this workflow isn't supported by any Antigravity surface

*Answer: B.* Turn-by-turn, human-reviewed interaction is exactly the
App surface's fit. (A) CLI is oriented toward scripted/automation use,
not this back-and-forth exploratory pattern. (C) the SDK is for
building coding-agent capability into other software, not a direct
end-user surface. (D) is false.

**Q7.** A platform team writes a reusable document describing "how our
internal API authentication works and the exact code pattern to use
when calling it," intending every coding-agent task involving that API
to apply this consistently without re-explaining it each time. Which
primitive is this?
A) A rule
B) A skill
C) An extensions hook
D) A subagent

*Answer: B.* Packaging a specific, reusable how-to/convention so it's
applied consistently across tasks is a skill's defining purpose. (A)
rules are hard constraints/prohibitions, not how-to guidance. (C)
hooks are lifecycle trigger points for custom logic, not a knowledge
package. (D) subagents are delegated workers, not a knowledge/pattern
artifact.

**Q8.** A team configures logic that automatically runs a suite of
security scans immediately after every code-generation step completes,
before any commit is allowed. Which Antigravity primitive is this
example of?
A) A skill
B) An extensions hook, at the post-generation/pre-commit lifecycle
   point
C) A subagent
D) The App surface

*Answer: B.* This is a lifecycle execution point where custom logic
runs automatically at a defined moment — the defining characteristic
of an extensions hook. (A) skills package how-to knowledge, they don't
themselves trigger automatically at a lifecycle point. (C) subagents
are delegated task workers, not lifecycle triggers. (D) is a surface
for human interaction, not an automation mechanism.

**Q9.** An organization defines: "no coding agent task may modify any
file under `/infrastructure/production/` without explicit human
sign-off, under any circumstances." Which primitive expresses this
kind of hard, non-negotiable constraint?
A) A skill
B) A rule
C) A plugin
D) An SDK configuration

*Answer: B.* Rules are explicit hard constraints/policies on agent
behavior — exactly this kind of non-negotiable boundary. (A) skills
encode how-to conventions, not prohibitions. (C) plugins add
capability, they don't constrain it. (D) is a surface for embedding
capability into other software, not a behavior-constraint mechanism.

**Q10.** A large task involves both generating comprehensive API
documentation and performing an independent security-focused code
review of the same change set. The team wants each handled by a
narrower, dedicated agent rather than one generalist agent trying to
do both well. Which primitive fits both needs?
A) One plugin covering both tasks
B) Two subagents — one scoped to documentation generation, one scoped
   to security review
C) A single rule listing both requirements
D) The Antigravity App surface alone

*Answer: B.* Subagents are exactly for delegating distinct, scoped
subtasks to specialized workers — using two of them here matches the
"narrower, dedicated" requirement precisely. (A) a plugin adds
capability, it doesn't decompose work into scoped delegated workers.
(C) a rule constrains behavior, it doesn't perform or delegate tasks.
(D) is a UI surface, not a task-decomposition mechanism.

**Q11.** An engineering leadership team wants visibility and control
over coding-agent usage across the whole organization — scaling
adoption, governing which teams can do what, and optimizing overall
spend — once agents are already being used day to day. Which tool is
this operational layer?
A) Antigravity's App surface
B) Agents CLI
C) A single, very large system instruction
D) An MCP server

*Answer: B.* Task 2.2 explicitly describes "augmenting Antigravity
with Agents CLI to build, scale, govern, and optimize deployed
agents" — this org-wide operational layer is Agents CLI's role. (A) is
an individual-developer interaction surface, not an org-wide
governance layer. (C) doesn't provide governance/scaling controls at
all. (D) connects an agent to a specific external tool/data source,
unrelated to fleet-wide governance.

**Q12.** A coding agent is configured with an MCP server that exposes
the team's internal issue-tracking system, so the agent can
automatically file a ticket when it identifies a bug it can't safely
auto-fix. What does this best illustrate?
A) A production RAG retrieval pipeline
B) A dev-time MCP server connecting the coding agent to an internal
   tool it needs during development work
C) An A2A handoff between two coding agents
D) Agent Runtime deployment configuration

*Answer: B.* This matches task 2.1's framing of MCP servers giving
coding agents access to the specific systems/tools needed during
development tasks — an issue tracker is a textbook example. (A) is a
Section 3.2 production-agent RAG concept, unrelated here. (C) A2A is
agent-to-agent coordination, not this single agent-to-tool connection.
(D) is a Section 4 production runtime-deployment concept.

**Q13.** A coding agent is given direct, standing credentials to the
production database with full read/write access, and runs tasks
unsandboxed directly against it "to save setup time." What is the
concern here, per task 2.1's secure-sandbox consideration?
A) There is no concern — direct production access is the recommended
   default for speed
B) This removes the bounded blast radius a secure sandbox provides;
   an unintended or unsafe agent action could directly affect
   production data with no isolation layer in between
C) This is only a concern if the coding agent is Claude Code on
   Google Cloud specifically
D) Concern only applies to read access, not write access

*Answer: B.* This is exactly the risk task 2.1 calls out by naming
secure sandboxes (GKE, Cloud Workstations, Antigravity) as their own
consideration — unsandboxed, standing production access removes the
isolation boundary meant to bound the impact of agent actions. (A) is
the anti-pattern itself, not a defense of it. (C) is a fabricated
tool-specific carve-out. (D) understates the risk — write access to
production is the higher-severity half of this concern, not an
exception to it.

**Q14.** A vendor's marketing material describes "Gemini Code Assist"
as the coding-agent tool this exam covers. Is this accurate?
A) Yes — Gemini Code Assist is the primary coding agent named in the
   exam guide
B) No — the guide names Antigravity (CLI/SDK/App) and Claude Code on
   Google Cloud explicitly in Section 2; Gemini Code Assist does not
   appear in the guide at all
C) Yes, but only as a synonym for Antigravity
D) No — the correct name is Agents CLI

*Answer: B.* This is a direct currency correction: Gemini Code Assist
is not named anywhere in the guide, and substituting it as "the" tool
is a trap. (A) and (C) both incorrectly validate the wrong branding.
(D) is also wrong — Agents CLI is a real, related, but distinct
operational tool, not a rename of "Gemini Code Assist."

**Q15.** A production custom agent (built with ADK, per Section 3) is
deployed to run on GKE. A separate team also uses GKE to sandbox their
coding agents during development. What's the correct way to think
about these two uses of GKE?
A) They are the same use case and should be conflated in exam answers
B) They are different use cases sharing the same underlying compute
   platform — GKE as a Section 2 dev-time coding-agent sandbox versus
   GKE as a Section 4 production agent-deployment runtime option
C) GKE can only be used for one of these purposes, never both
D) Using GKE for coding-agent sandboxing means Agent Runtime is no
   longer needed for production deployment

*Answer: B.* GKE is a general-purpose platform that appears in two
different task contexts in the guide — a sandbox environment (task
2.1) and a deployment runtime option (task 4.2) — and an exam question
testing GKE should be read for which context applies. (A) risks
answering a task-2.1 sandboxing question with task-4.2 deployment
reasoning or vice versa. (C) is a fabricated restriction. (D) is a non
sequitur — sandbox usage during development has no bearing on which
runtime a separate, already-built production agent is deployed to.

**Q16.** A coding agent is tasked with generating internal
documentation comments for a well-tested, low-risk internal utility
library, with no production or customer-facing impact. Per the
agent-vs-human-mode principle, what's the appropriate default?
A) Human mode, requiring approval for every generated comment
B) Agent mode is appropriate here — low-stakes, easily reversible work
   doesn't need the tighter oversight reserved for high-blast-radius
   actions
C) The task cannot be performed by a coding agent at all
D) Mode configuration doesn't apply to documentation tasks

*Answer: B.* This is the flip side of the "high-blast-radius actions
favor human mode" guidance — low-stakes, reversible, non-production
work is exactly where autonomous agent mode's efficiency benefit
applies without meaningful added risk. (A) over-applies oversight
where it isn't warranted, the same over-correction flagged elsewhere in
this folder. (C) is false. (D) is false — mode configuration is a
general governance toggle, not limited to certain task types.

**Q17.** A team configures both a pre-commit extensions hook that
scans for hardcoded credentials and a rule prohibiting any commit that
the scan flags, with no override path for the agent or the developer.
What does combining these two primitives accomplish that either alone
would not?
A) Nothing — a hook or a rule alone would be equally effective
B) The hook provides the structural lifecycle point where the scan
   actually runs, and the rule provides the hard, non-bypassable
   constraint that blocks the commit on a flagged result — together
   they create deterministic enforcement neither provides alone
C) This combination is redundant and unsupported by Antigravity
D) Only a subagent, not a hook+rule combination, can enforce this

*Answer: B.* A hook alone would run the scan but not necessarily block
anything; a rule alone has nothing to trigger it at the right moment —
together they form a complete, structural enforcement mechanism. (A)
understates what each primitive individually lacks. (C) is false — this
is a supported, sensible combination. (D) misdirects to an unrelated
primitive (subagents delegate tasks, they don't enforce policy gates).

**Q18.** Which statement correctly describes the scope of coding
agents covered by the PAA exam guide's Section 2, per its own named
examples?
A) Only Google-built tools are in scope; third-party coding agents are
   never named
B) The guide names both a Google Cloud product (Antigravity) and a
   third-party product (Claude Code on Google Cloud) as coequal
   examples of in-scope coding agents
C) Only open-source coding agents are in scope
D) Coding agents are entirely out of scope for this exam; Section 2 is
   about low-code tools only

*Answer: B.* The guide explicitly names both Antigravity and Claude
Code on Google Cloud in task 2.1 — the exam's coding-agent scope is
not limited to Google's own product. (A) is contradicted directly by
Claude Code on Google Cloud's explicit inclusion. (C) is unsupported —
neither named tool is described as required to be open-source (compare
with ADK, which the guide does explicitly call open-source). (D)
confuses Section 2 (coding agents) with Section 1 (low-code tools) —
two entirely different sections.
