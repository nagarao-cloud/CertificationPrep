# Pattern — Coding Agent Integrated Into a CI/CD Pipeline

> **Pattern summary:** A coding agent (**Antigravity** or **Claude Code
> on Google Cloud**) wired directly into an organization's continuous
> integration / continuous delivery (**CI/CD** — the automated process
> that builds, tests, and ships code changes, usually triggered by a
> pull request or a merge) pipeline, executing inside a secure sandbox
> (**GKE** or **Cloud Workstations**), performing automated code review,
> refactoring, and vulnerability patching as a pipeline stage rather
> than an interactive developer session.
>
> **Primary exam tasks:** 2.1 (Using coding agents effectively), 2.2
> (Customizing coding agents for enterprise workflows). Section 2 is
> ~17% of the exam.
>
> **Currency reminders applied in this file:** the coding-agent tools
> are **Antigravity** and **Claude Code on Google Cloud** — never
> "Gemini Code Assist," which does not appear in the exam guide.
> Component names match `02-services/02-coding-agents-devtools.md`
> exactly — read that file first if any term below (Agents CLI,
> subagents, extension hooks) is unfamiliar.

---

## 1. What this pattern is, and when you reach for it

**Ground-zero framing first.** **CI/CD** stands for continuous
integration / continuous delivery: instead of a human manually
building, testing, and deploying every code change, an automated
pipeline does it every time code changes — typically triggered when a
developer opens a **pull request** (a proposed code change, submitted
for review before it's merged into the main codebase) or merges one. A
**coding agent** is a different category of agent from the
customer-facing support agent in `pattern-low-code-cx-agent.md`: its
"user" is source code itself, and its job is to read, write, test, and
modify code — refactoring (restructuring existing code without
changing its behavior), optimizing runtime performance, and patching
security vulnerabilities, per task 2.1's explicit list.

This pattern is what happens when you stop using a coding agent only
as an interactive assistant a developer chats with, and instead wire
it in as an **automated pipeline stage** — every pull request
automatically gets an agent-driven review pass, and specific triggers
(a new CVE disclosed against a dependency, a flagged security scan
result) can kick off an agent-driven patch attempt with no human
starting the work by hand.

**Reach for this pattern when:**
- The organization wants consistent, automated code review coverage on
  every change, not just when a human reviewer happens to have time.
- Vulnerability patching needs to happen fast and at scale — e.g., a
  new CVE affects a dependency used across dozens of repositories, and
  a human manually patching each one doesn't scale.
- The team wants a governed, auditable trail of what an agent changed
  and why, which fits naturally into existing PR review tooling.

**Don't reach for this pattern when** the work is a one-off,
interactive coding task better suited to a developer driving
Antigravity or Claude Code on Google Cloud directly in their own
session — this pattern is specifically about the *automated, pipeline-
triggered* use of a coding agent, not every use of one.

---

## 2. The building blocks, briefly (full detail lives in `02-services/02-coding-agents-devtools.md`)

| Block | One-line role in this pattern |
|---|---|
| **Antigravity** (CLI/SDK/App) or **Claude Code on Google Cloud** | The coding agent itself — in this pattern, invoked via its **CLI** or **SDK** surface (not the interactive App), since the trigger is a pipeline event, not a human sitting down to a session. |
| **MCP servers** | How the coding agent reaches tools beyond raw shell access — a ticketing system to file a follow-up issue, an internal API catalog, a Google Cloud MCP Server. |
| **Custom skills** | Packaged, reusable capabilities the agent invokes — "run our internal lint suite," "run our security scanner," "generate a changelog entry in house format." |
| **GKE** (sandbox facet) | The ephemeral, container-isolated execution environment for each pipeline-triggered agent run — this pattern's default sandbox, because CI/CD workloads are exactly the "highly parallel, programmatically spun-up" shape GKE-as-sandbox is built for (per `02-services/02-coding-agents-devtools.md` §6). |
| **Cloud Workstations** | The persistent, IDE-like sandbox alternative — used in this pattern only for the human-in-the-loop review step, not the automated agent run itself (see §3, §6). |
| **Agents CLI** | Agent-Platform-level tooling to build, scale, govern, and optimize the *population* of coding-agent runs this pipeline produces — distinct from Antigravity's own CLI, which drives one run. |
| **Extension hooks, rules, subagents** (Antigravity-specific) | Extension hooks intercept pipeline lifecycle points (before a commit, after a test run); rules constrain what the agent is allowed to do (forbidden operations, required gates); subagents let one agent session delegate a bounded sub-task (e.g., "just run the linter and report back") to another agent instance. |

---

## 3. Full production architecture

```
                    ┌───────────────────────────────────────┐
                    │   Source control (pull request opened,    │
                    │   merged, or a CVE feed triggers a job)     │
                    └───────────────────┬─────────────────────┘
                                        │ (1) CI/CD pipeline trigger
                                        ▼
                    ┌───────────────────────────────────────┐
                    │           CI/CD ORCHESTRATOR              │
                    │   (the pipeline system itself — decides     │
                    │    which stage runs next, gates merge on      │
                    │    stage results)                              │
                    └───────────────────┬─────────────────────┘
                                        │ (2) invoke coding-agent stage
                                        ▼
     ┌────────────────────────────────────────────────────────────────────┐
     │                    CODING AGENT (Antigravity CLI/SDK, or               │
     │                    Claude Code on Google Cloud), invoked                │
     │                    non-interactively for this pipeline run              │
     │   configured with: MCP servers · custom skills · rules ·                  │
     │   (Antigravity) extension hooks · subagents                              │
     └───────┬───────────────────────┬───────────────────────┬────────────┘
             │ (3) execution routed into a sandbox                │ (4) tool calls via MCP
             ▼                                                     ▼
  ┌─────────────────────────────────────┐              ┌──────────────────────────┐
  │                 GKE                     │              │       MCP servers          │
  │  ephemeral, container-isolated sandbox    │              │  (ticketing system,           │
  │  pod, spun up per pipeline run              │              │   internal API catalog,        │
  │  ┌─────────────────────────────────┐   │              │   Google Cloud MCP Server)      │
  │  │  Repo checkout + agent's toolchain │   │              └──────────────────────────┘
  │  │  (linters, test runners, package    │   │
  │  │   managers, security scanners)       │   │
  │  └─────────────────────────────────┘   │
  └───────────────────┬───────────────────┘
                      │ (5) code change, test results, patch produced
                      ▼
     ┌───────────────────────────────────────────────────────────────┐
     │                    Extension hooks fire                          │
     │   before-commit hook: enforce rules (e.g., no direct pushes       │
     │   to main, required test-pass threshold)                          │
     │   after-test-run hook: attach results to the PR                    │
     └───────────────────────────┬───────────────────────────────────┘
                                 │ (6) commit / PR update produced
                                 ▼
     ┌───────────────────────────────────────────────────────────────┐
     │                  Pull request updated                            │
     │   agent's diff, its reasoning/summary of the change, and           │
     │   test/scan results posted as PR comments                          │
     └──────────┬───────────────────────────────────────┬──────────────┘
                │ (7a) low-risk change,                    │ (7b) high-risk change or
                │      auto-approved per rules                  rule requires human sign-off
                ▼                                          ▼
     ┌─────────────────────────┐              ┌───────────────────────────────┐
     │   Merge proceeds            │              │   Human reviewer, using           │
     │   automatically                │              │   Cloud Workstations to           │
     └─────────────────────────┘              │   inspect/modify the agent's         │
                                                │   change interactively                │
                                                └──────────────┬─────────────────┘
                                                               │ (8) approve / reject / request changes
                                                               ▼
                                                     [ merge or send back to agent ]
                                                               │
                                                               ▼
     ┌───────────────────────────────────────────────────────────────┐
     │                        Agents CLI                                 │
     │   org-level: build/scale/govern/optimize the population of         │
     │   coding-agent pipeline runs; agent-vs-human mode policy             │
     │   (which repos/change types run fully autonomous vs. gated)          │
     └───────────────────────────────────────────────────────────────┘
```

---

## 4. Arrow-by-arrow walkthrough

1. **A CI/CD trigger fires.** Unlike the interactive coding-agent
   session task 2.1 also covers, this pattern is about a pipeline-
   driven trigger: a pull request opened or updated, a merge to a
   protected branch, or — for the vulnerability-patching use case a
   scheduled/event-driven trigger from a security-scanning feed (a new
   CVE disclosed against a dependency this codebase uses).
2. **The CI/CD orchestrator invokes the coding-agent stage.** This is
   the pipeline system itself (whatever CI/CD tooling the organization
   already runs) deciding that this stage should run next, and gating
   the eventual merge on its result.
3. **The coding agent — Antigravity or Claude Code on Google Cloud,
   called via its CLI or SDK surface rather than the interactive App —
   executes inside a sandbox.** Per task 2.1's secure-sandbox
   requirement, the agent doesn't run against a shared or
   production-adjacent environment; it runs in an isolated execution
   context. This pattern defaults to **GKE** as that sandbox
   specifically because CI/CD is the workload shape GKE-as-sandbox is
   built for: many short-lived, container-isolated runs spun up in
   parallel across many concurrent pull requests, each with its own
   resource limits and network policy, torn down when the run
   completes (see `02-services/02-coding-agents-devtools.md` §6's
   decision note — a persistent Cloud Workstations environment is the
   wrong shape here because there's no human co-present in the loop
   for this automated stage).
4. **The agent makes tool calls through MCP where its task needs
   something beyond raw code editing** — filing a follow-up ticket for
   a change too risky to auto-apply, querying an internal API catalog
   to check whether a refactor would break another team's integration,
   or reaching a Google Cloud MCP Server.
5. **Inside the sandbox, the agent produces the actual work product**:
   a code change (a refactor, an optimization, a security patch),
   run against the repo's own test suite and linters, with results
   captured.
6. **Extension hooks fire around key lifecycle points.** A
   before-commit hook enforces **rules** configured for this pipeline —
   e.g., "never push directly to the main branch," "a security-patch
   change must pass the full test suite before a commit is even
   created," "a change touching authentication code always requires
   human sign-off regardless of test results." An after-test-run hook
   attaches results to the pull request so reviewers (human or
   automated) see exactly what happened.
7. **The pull request is updated** with the agent's diff, a
   human-readable summary of its reasoning, and test/scan results —
   and then one of two paths follows, governed by the rules configured
   in step 6:
   - **(7a)** A low-risk, rule-qualifying change (e.g., a
     well-tested, narrowly-scoped dependency-version bump patching a
     known CVE, with all tests passing) is auto-approved and the merge
     proceeds without a human in the loop — this is task 3.1's
     "agent vs. human mode" concept, configured at the Agents CLI
     level (step 9), applied here at the pipeline-stage level.
   - **(7b)** A higher-risk change (touching sensitive code paths, a
     large refactor, or simply failing to meet an auto-approval rule)
     routes to a human reviewer, who uses **Cloud Workstations** — the
     persistent, IDE-like sandbox, appropriate here because a human is
     now actively working alongside what the agent produced — to
     inspect, test further, or modify the change interactively.
8. **The human reviewer approves, rejects, or requests changes.** A
   rejection or change request can loop back to the coding agent (a
   **subagent** can be dispatched to make just the requested
   adjustment, rather than re-running the whole task from scratch) or
   result in the change being abandoned.
9. **Agents CLI operates at the organizational level**, across every
   repository and every pipeline run this pattern produces — governing
   which repos/change types are eligible for fully autonomous (agent
   mode) handling versus requiring a human gate (human mode), scaling
   the number of concurrent sandboxed runs, and giving the platform
   team visibility and optimization levers across the whole
   coding-agent fleet, not just one pipeline.

---

## 5. Why the sandbox choice is a real design decision, not a formality

A beginner reading "coding agent runs in a sandbox" might assume any
sandbox is interchangeable. It isn't, and this pattern is a good place
to see why concretely: a coding agent executing autonomously in a
pipeline can run arbitrary shell commands, install dependencies, and
modify files — exactly the class of action that, if it went wrong
(a bad refactor deletes something it shouldn't, a dependency install
pulls in something malicious, an infinite test loop consumes
resources), should never be able to touch a developer's real laptop or
anything production-adjacent. GKE's ephemeral, per-run container
isolation means the blast radius of any single agent run is bounded to
that one throwaway container, torn down when the run ends — which is
exactly why this pattern places the *automated* stage there and
reserves the *persistent, human-supervised* Cloud Workstations
environment for the review step where a person is actually watching.

---

## 6. Design decisions and tradeoffs

### 6.1 GKE-as-sandbox vs. Cloud Workstations-as-sandbox for the automated stage

**Chosen here:** GKE for the automated pipeline stage (arrow 3);
Cloud Workstations only for the human review step (arrow 7b).

**Tradeoff.** Cloud Workstations gives a persistent, IDE-like
environment well suited to a human actively co-working with the agent
— but that persistence is wasted (and a needless standing cost) for a
pipeline stage that spins up, runs once, and tears down per pull
request. GKE's ephemeral model matches the CI/CD workload shape
directly: many parallel, short-lived, resource-bounded runs. An
organization running a low volume of pipeline triggers, or one that
wants a human reviewing every single agent run in real time rather
than after the fact, might reasonably choose Cloud Workstations for
the whole flow instead — the tradeoff is operational simplicity
(one sandbox model to reason about) against the parallelism and
isolation ephemeral containers give you at scale.

### 6.2 Fully autonomous (agent mode) vs. gated (human mode) merge

**Chosen here:** a rule-driven split (arrow 7a/7b) — low-risk changes
auto-merge, higher-risk changes gate on a human.

**Alternative:** require human review on every single agent-produced
change, with no auto-merge path at all.

**Tradeoff.** All-human-gated review gives maximum safety but defeats
much of the point of automating this pipeline stage in the first place
— if every change still needs a human to look at it before merging,
the organization hasn't actually reduced review burden, only added an
agent's draft on top of the existing review load. The rule-driven
split trades some autonomy risk (a bad rule definition could let a
genuinely risky change auto-merge) for real throughput gains on the
large volume of low-risk, mechanical changes (routine dependency
patches, well-tested small refactors) that don't need a human's
judgment every time. Task 3.1's "agent vs. human mode" language is
exactly this dial, and getting the rule thresholds right — not
turning autonomy on or off wholesale — is the actual design work.

### 6.3 This pattern vs. a purely interactive coding-agent workflow (no CI/CD integration)

**Alternative:** developers use Antigravity or Claude Code on Google
Cloud only interactively — chatting with the agent in their own
session, manually deciding when to invoke it, with no pipeline
triggers at all.

**Tradeoff.** Purely interactive use keeps a human in the loop for
every invocation by construction (simpler governance story) but
doesn't scale to organization-wide concerns like "patch every
repository affected by this newly disclosed CVE" or "run a consistent
automated review pass on every single pull request" — those need a
trigger that isn't "a developer happened to think to ask." This
pattern is the answer to task 2.1's "using coding agents to refactor
source code, optimize execution runtimes, and patch application-layer
vulnerabilities" read at an organizational, not individual, scale —
and task 2.2's Agents CLI language ("build, scale, govern, and
optimize deployed agents") only makes sense once there's a fleet of
pipeline-triggered runs to govern, not a single developer's
interactive session.

---

## 7. Common failure modes and how this design handles them

| Failure mode | What it looks like | How this architecture mitigates it |
|---|---|---|
| **A bad automated patch merges with no human review** | A rule threshold was set too permissively, and a change that should have needed sign-off auto-merges. | The rule set (§3 arrow 6, configured via Antigravity's rules/hooks) is the actual control surface here — this is a governance-tuning problem, not a platform limitation; a mature deployment starts rule thresholds conservative (favor human mode) and only loosens them as the agent's track record on a given change category earns trust. |
| **Sandbox escape / blast radius beyond the intended run** | A pipeline-triggered agent run somehow affects more than its own ephemeral container — e.g., by reaching production-adjacent infrastructure through an over-broad MCP tool connection. | This is exactly why the coding-agent's own tool access (MCP servers, custom skills) needs to be scoped per §2 — the sandbox isolates *compute*, but tool access still needs to be least-privilege; the sandbox alone doesn't bound what an over-permissioned MCP connection can reach. Full identity/access treatment is in `pattern-secure-governed-enterprise-agent-platform.md`. |
| **Agent produces a plausible-looking but incorrect vulnerability patch** | The agent "fixes" a CVE by suppressing a warning or working around the symptom rather than addressing the actual vulnerable code path. | The test-suite gate (arrow 5–6) catches behavioral regressions but not necessarily an incomplete security fix — this is why a security-sensitive change category is a strong candidate for a rule that always routes to human mode (arrow 7b) rather than relying on automated tests alone to validate correctness of a security fix. |
| **Runaway agent loop inside the sandbox** | The agent gets stuck repeating an edit-test-fail cycle without making progress, consuming pipeline resources indefinitely. | GKE's per-run resource limits and the pipeline orchestrator's own run-timeout bound this — an ephemeral, resource-capped sandbox fails safe (the run is killed and reported) rather than an unbounded process quietly consuming shared infrastructure. |
| **Reviewer fatigue / rubber-stamping** | Once agent-produced changes become routine, human reviewers in the gated (7b) path start approving without real scrutiny, undermining the whole point of the human-mode gate. | Not a purely technical failure mode — but the architecture's PR-comment summaries (arrow 7, "human-readable summary of its reasoning") are specifically meant to make review faster *and* more meaningful, not just present a raw diff; organizations should also periodically audit human-mode approval quality, not treat the gate as self-verifying once configured. |
| **Inconsistent behavior between Antigravity and Claude Code on Google Cloud if both are used** | Different teams standardize on different coding agents, and rule/hook behavior configured for one doesn't carry over to the other. | Per `02-services/02-coding-agents-devtools.md` §3's decision note, task 2.2's plugin/hook/rule/subagent customization depth is named specifically "using Antigravity" — a pipeline mixing both tools should expect that customization depth to differ, and design governance (Agents CLI policy) to account for that rather than assuming feature parity. |

---

## 8. Exam task mapping

| Task | How this pattern demonstrates it |
|---|---|
| **2.1** — Using coding agents effectively | The full pipeline: MCP-server tool access, GKE/Cloud Workstations sandbox choice, and refactor/optimize/patch usage (arrows 3–6). |
| **2.2** — Customizing coding agents for enterprise workflows | Rules, extension hooks, and subagents (arrow 6, arrow 8) plus Agents CLI governing the whole fleet of pipeline runs (arrow 9). |
| **5.1/5.2** (secondary) | The agent-vs-human mode gate (arrow 7a/7b) is a real governance control, though its full identity/access treatment belongs to `pattern-secure-governed-enterprise-agent-platform.md`. |

---

## 9. Exam traps specific to this pattern

- Naming "Gemini Code Assist" anywhere as the tool in this pipeline —
  it does not appear in the guide; this pattern uses Antigravity and/or
  Claude Code on Google Cloud.
- Treating GKE's role here (an ephemeral coding-agent sandbox) as the
  same as GKE's role in `pattern-evaluation-deployment-pipeline.md`
  (a production deployment target for a finished, serving agent) —
  same product, two distinct roles at two different lifecycle stages.
- Confusing Antigravity's own CLI surface with **Agents CLI** — this
  pattern uses both, but for different jobs: Antigravity's CLI drives
  one pipeline-triggered run; Agents CLI governs the fleet of runs at
  the organizational level.
- Assuming "agent vs. human mode" is a one-time, all-or-nothing setting
  rather than a rule-driven, per-change-category dial (§6.2) — the
  exam's framing treats this as a configuration decision with real
  tradeoffs, not a binary toggle.
