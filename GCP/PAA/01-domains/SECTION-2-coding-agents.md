# Section 2 — Using coding agents for application development (~17%)

> Source of truth: `00-START-HERE/RUNBOOK.md` §3, Section 2 (verbatim
> task bullets). Tasks covered: **2.1** (using coding agents
> effectively) and **2.2** (customizing coding agents for enterprise
> workflows).
>
> Currency reminder: the exam guide names **Antigravity** (CLI/SDK/App)
> and **Claude Code on Google Cloud** as its explicit coding-agent
> examples. **Gemini Code Assist is not named anywhere in the guide** —
> do not substitute it as "the" coding-agent tool this section tests.
> If you see "Gemini Code Assist" in other study material, that's
> outdated/wrong-product framing for this exam.

---

## 0. What "coding agents" means in this section, and how it differs from Section 3

Section 2 is about agents that act as **development-time collaborators**
— they write, refactor, test, and patch source code, running inside a
developer's workflow (a terminal, an IDE, a CI pipeline). This is a
different category from Section 3's custom **runtime** agents (agents
that run in production, answering end-user requests or executing
business tasks). Keep this distinction sharp — several exam questions
hinge on it:

```
Section 2: CODING agents                Section 3: CUSTOM (runtime) agents
─────────────────────────                ────────────────────────────────
Operate at DEVELOPMENT time               Operate at PRODUCTION/runtime
Write/refactor/patch source code          Execute business logic, answer
                                           user requests, call tools/APIs
Tools: Antigravity, Claude Code on        Built with: ADK (open-source),
  Google Cloud, Agents CLI                deployed to Agent Runtime
Sandboxes: GKE, Cloud Workstations        Orchestration: A2A, MCP,
                                           parallel/sequential/graph
```

**Don't use** Section 3's ADK/Agent Runtime vocabulary when a question
is actually asking about a coding agent's dev-time behavior (refactoring,
patching, sandboxed code execution) — that's Section 2. **Use** the
Section 2 tool set (Antigravity, Claude Code on Google Cloud, Agents
CLI, GKE/Cloud Workstations sandboxes) when the scenario is about
developers using an agent to build software, not about an agent
serving end users in production.

---

## 1. Task 2.1 — Using coding agents effectively

### 2.1.1 Antigravity: CLI, SDK, App

**Antigravity** is Google Cloud's coding-agent product, explicitly
named by the guide across both 2.1 and 2.2, and it ships in three
surfaces:

| Surface | What it is | Typical use |
|---|---|---|
| **CLI** | Command-line coding agent — invoked from a terminal, scriptable, good for CI/automation and headless workflows | Automating a repo task from a script or pipeline step |
| **SDK** | Programmatic library for embedding Antigravity's coding-agent capability into a custom tool or workflow | Building a custom internal dev-tool that needs coding-agent capability under the hood |
| **App** | The interactive, GUI/IDE-style application surface for a developer to work with the coding agent directly | A developer doing interactive refactoring, exploration, and iteration |

Think of these three the way you'd think about any dev tool that
ships CLI + SDK + App: the CLI is for automation/scripting, the SDK is
for embedding into other software, and the App is for a human driving
interactively. The exam expects you to map a scenario ("automate a
nightly dependency-upgrade PR" vs. "a developer wants an interactive
assistant in their IDE") to the right surface.

### 2.1.2 Claude Code on Google Cloud

The guide's second explicit coding-agent example is **Claude Code on
Google Cloud** — Anthropic's Claude Code agent, offered/integrated in
a Google Cloud context. The exam treats this as a peer example to
Antigravity for task 2.1's "configuring coding agents with MCP
servers, custom skills, and access to tools" — i.e., both are valid
answers to "name a coding agent this exam covers," and a question may
ask you to configure either one with the same underlying concepts
(MCP servers, tool access, sandboxed execution).

**Don't assume** the guide favors one over the other — both Antigravity
and Claude Code on Google Cloud are named as coequal examples of "coding
agents." A question naming either tool by name is still testing the
same underlying task-2.1/2.2 concepts (MCP configuration, sandboxing,
skills/plugins/subagents), not a preference between products.

### 2.1.3 Configuring coding agents with MCP servers, custom skills, and tool access

Task 2.1's first bullet is explicit: **"Configuring coding agents with
Model Context Protocol (MCP) servers, custom skills, and access to
tools."** Break this into its three parts:

- **MCP (Model Context Protocol) servers** — MCP is an open protocol
  that standardizes how an agent (an MCP *client*) connects to external
  tools, data sources, and systems (each exposed by an MCP *server*).
  For a coding agent, an MCP server might expose your issue tracker,
  your internal package registry, your cloud project's resources, or a
  documentation search tool — all through one standard interface rather
  than a bespoke integration per tool. Configuring a coding agent with
  MCP servers means wiring it up to the specific external systems it
  needs to interact with as part of a development task (e.g., an MCP
  server that lets the agent open/update tickets, or one that lets it
  query your cloud infrastructure's current state before making a
  change).
- **Custom skills** — packaged, reusable units of specialized
  capability or instruction you attach to a coding agent so it knows
  how to perform a particular kind of task correctly and consistently
  (e.g., a skill for "how our team writes database migrations" or "how
  to run our specific test suite and interpret its output"). Skills are
  how you encode team/organization-specific conventions into the
  agent's behavior instead of re-explaining them in every **prompt**
  (the instructions and context you send the underlying model each time
  you ask it to do something).
- **Access to tools** — the broader configuration of what the agent is
  actually allowed to call/execute: shell commands, file writes,
  package managers, deployment commands, cloud APIs. Scoping tool
  access appropriately (least privilege for a coding agent, same as
  any automated principal) is a governance concern that resurfaces in
  Section 5.

```
        ┌───────────────────────────┐
        │   Developer / CI trigger   │
        └─────────────┬──────────────┘
                       │ 1. task request ("refactor module X",
                       │    "patch CVE-2026-xxxx")
                       ▼
        ┌───────────────────────────┐
        │  Coding agent (Antigravity │
        │  or Claude Code on GCP)    │
        └──┬─────────────┬───────────┘
           │ 2. tool call │ 3. skill invoked
           ▼              ▼
  ┌─────────────────┐  ┌────────────────────┐
  │ MCP server(s)    │  │ Custom skill        │
  │ (issue tracker,  │  │ (team conventions,  │
  │  registry, infra)│  │  test-suite runner) │
  └─────────────────┘  └────────────────────┘
           │                     │
           └──────────┬──────────┘
                       │ 4. code changes executed inside
                       ▼    a sandbox (GKE / Cloud Workstations)
        ┌───────────────────────────┐
        │  Sandbox execution env     │
        │  (isolated, scoped tool    │
        │   access, no prod blast    │
        │   radius)                  │
        └─────────────┬──────────────┘
                       │ 5. result: PR / patch / refactor diff
                       ▼
        ┌───────────────────────────┐
        │  Human review / CI gate    │
        └───────────────────────────┘
```

Diagram walkthrough: step 4 is the exam's other key emphasis in 2.1 —
**secure sandboxes**. A coding agent making live tool calls (MCP
servers) and running code should do so inside an isolated execution
environment, not directly against production, so that an agent error
(a bad refactor, a destructive command) has bounded blast radius.

### 2.1.4 Secure sandboxes: GKE, Cloud Workstations, Antigravity

The guide names three sandboxing options for running coding agents
securely:

| Sandbox option | What it provides | Best fit |
|---|---|---|
| **GKE (Google Kubernetes Engine)** | Containerized, isolated execution with fine-grained resource/network policy control | Teams that already run infra on GKE and want coding-agent execution to inherit the same isolation/policy model (namespaces, network policies, resource quotas) |
| **Cloud Workstations** | Managed, fully configured, isolated developer environments (VM-backed, browser-accessible) | Interactive developer use where you want a consistent, pre-provisioned, secured dev environment per developer/agent session |
| **Antigravity (as a sandbox)** | The coding-agent product's own built-in sandboxed execution mode | Simpler setups where you don't want to stand up/manage separate infrastructure just to isolate the agent |

**Don't use** an unsandboxed, direct-to-production coding agent
execution path — that's the single biggest security anti-pattern this
task bullet exists to prevent ("using coding agents in secure
sandboxes" is a named consideration, not incidental detail). **Use**
GKE or Cloud Workstations (or Antigravity's own sandbox mode) so a
runaway or malicious tool call is contained.

**Don't use** GKE-based sandboxing when the actual need is a
lightweight, pre-configured interactive dev environment for a human
developer working alongside the agent — that's more setup/ops overhead
than necessary. **Use** Cloud Workstations for that case, and reserve
GKE-based sandboxing for scenarios where you specifically want
Kubernetes-native isolation/policy controls (e.g., consistent with how
the rest of your infra is governed).

### 2.1.5 Refactoring, optimizing execution runtimes, patching vulnerabilities

Task 2.1's third bullet lists three concrete jobs coding agents do:

1. **Refactor source code** — restructuring code for readability,
   maintainability, or to match new conventions, without changing
   external behavior.
2. **Optimize execution runtimes** — improving performance
   characteristics: reducing latency, memory footprint, or compute
   cost of running code (this is a distinct concern from "correctness"
   — the agent is being asked to make working code run *better*, not
   just work).
3. **Patch application-layer vulnerabilities** — identifying and fixing
   security flaws in application code (e.g., a known CVE in a
   dependency, an injection vulnerability, unsafe deserialization) —
   this is application-layer (code-level) patching, distinct from
   infrastructure-layer security (which is more Section 5 territory —
   agent-to-tool auth, governance, guardrails).

**Don't use** a coding agent's refactor/patch output as automatically
production-ready — even a well-sandboxed agent's changes should pass
through human review/CI gates (see the diagram's step 5) before
merging, particularly for security patches where an incorrect fix can
be worse than the original vulnerability. **Use** the sandbox +
human-review-gate combination as the standard pattern, not agent
output landing directly in production.

---

## 2. Task 2.2 — Customizing coding agents for enterprise workflows

### 2.2.1 Skills, plugins, extensions, hooks, rules, and subagents (via Antigravity)

Task 2.2's first bullet: **"Creating skills, plugins, extensions
hooks, rules, and subagents using Antigravity."** Each of these is a
distinct customization primitive:

| Primitive | What it customizes |
|---|---|
| **Skills** | Packaged capability/knowledge for performing a specific kind of task correctly (as in 2.1.3) |
| **Plugins** | Modular add-on functionality that extends what the coding agent can do — a bundled, distributable unit of capability (tools, commands, integrations) |
| **Extensions hooks** | Points in the agent's execution lifecycle where custom logic can run (e.g., before a commit, after a tool call, before a task starts) — lets you inject validation, logging, or side effects at specific moments |
| **Rules** | Explicit constraints/policies that govern agent behavior (e.g., "never modify files under `/infra/prod`," "always run linter before finishing a task") |
| **Subagents** | Delegated, narrower-scoped agents spawned by a primary coding agent to handle a specific subtask (e.g., a subagent dedicated to writing tests, another dedicated to reviewing a diff) — decomposition of a larger task into specialized workers |

Together, these primitives are how an enterprise adapts a general
coding agent into one that reliably follows *that organization's*
specific engineering practices, rather than relying purely on prompt
instructions that can drift or be ignored under complex tasks.

```
                    ┌───────────────────────────┐
                    │   Primary coding agent      │
                    │      (Antigravity)           │
                    └──────────────┬────────────────┘
                                    │ governed by:
        ┌───────────────┬──────────┼──────────┬────────────────┐
        ▼               ▼          ▼          ▼                ▼
   ┌─────────┐    ┌──────────┐ ┌────────┐ ┌────────────┐ ┌────────────┐
   │ Skills   │    │ Plugins   │ │ Hooks   │ │ Rules       │ │ Subagents   │
   │ (how-to  │    │ (added    │ │ (run    │ │ (hard       │ │ (delegated, │
   │  conven- │    │  capa-    │ │  logic  │ │  constraints│ │  scoped     │
   │  tions)  │    │  bilities)│ │  at     │ │  on         │ │  workers,   │
   │          │    │           │ │  lifecycle│ behavior)   │ │  e.g. test  │
   │          │    │           │ │  points)│ │             │ │  writer)    │
   └─────────┘    └──────────┘ └────────┘ └────────────┘ └────────────┘
```

Diagram walkthrough: all five customization primitives attach to the
primary Antigravity coding agent and shape its behavior from different
angles — skills/plugins add *capability*, hooks add *lifecycle
control points*, rules add *hard constraints*, and subagents add
*task decomposition*. A single enterprise customization (e.g., "always
run our specific security linter before any commit, and delegate test
writing to a specialized subagent") typically composes more than one
of these primitives at once.

**Don't use** a single, ever-growing system prompt to encode every
team convention, constraint, and delegation pattern — that's brittle,
hard to maintain, and easy for the agent to partially ignore under a
complex task. **Use** the dedicated primitives (skills for
conventions, rules for hard constraints, hooks for lifecycle
enforcement, subagents for delegation) so each concern is scoped,
testable, and independently updatable.

### 2.2.2 Agents CLI: build, scale, govern, and optimize deployed agents

Task 2.2's second bullet: **"Augmenting Antigravity with Agents CLI to
build, scale, govern, and optimize deployed agents."** The **Agents
CLI** lives inside the broader **Agent Platform** (the umbrella that
also contains Memory Bank and managed sessions — see Section 3.1) and
provides a command-line interface for operational tasks around agents
that have moved beyond individual coding-agent use into deployed,
managed agent operations:

- **Build** — scaffolding, packaging, and preparing agents for
  deployment from the command line.
- **Scale** — adjusting deployed agent capacity/throughput.
- **Govern** — applying policy, access, and configuration controls to
  deployed agents (connects to Section 5's governance content: Agent
  Identity, PAB, Agent Registry).
- **Optimize** — tuning deployed agents for performance/cost, informed
  by observed runtime behavior.

Note the layering here for the exam: **Antigravity is the coding-agent
authoring/development surface; Agents CLI is the operational layer
that takes what Antigravity (or ADK, in Section 3) produced and
builds/scales/governs/optimizes it once it's a deployed agent.** The
guide phrases this as "augmenting Antigravity with Agents CLI" —
meaning these two tools are used together across the dev-to-ops
lifecycle, not as competing alternatives.

Task 2.2's parenthetical also calls out **"agent vs. human mode"** as
an Agents CLI configuration concept — i.e., the CLI (and the plugins
it configures) can be operated in a mode where an agent is driving
autonomously, versus a mode where a human is the one issuing/approving
commands through the same interface. This is a governance-relevant
toggle: agent-mode operations should generally carry tighter scoping
and audit expectations than human-mode operations, because there's no
human validating each individual action before it runs.

**Don't use** agent-mode operation for high-blast-radius actions
(e.g., production deploys, destructive infra changes) without
additional guardrails — treat agent mode as requiring the same or
stronger governance as any other autonomous principal (see Section
5's PAB/Agent Identity content). **Use** human mode, or agent mode
gated by explicit approval steps, when the action's consequences are
significant and hard to reverse.

**Don't use** Agents CLI as a substitute for Antigravity's dev-time
coding-agent capability (skills/plugins/hooks/rules/subagents) — Agents
CLI is the build/scale/govern/optimize operational layer, not the
authoring surface. **Use** Antigravity for creating/customizing the
coding agent itself, and Agents CLI for operating it once deployed.

---

## 3. Comparison: Antigravity vs. Claude Code on Google Cloud vs. Agents CLI

| Dimension | Antigravity | Claude Code on Google Cloud | Agents CLI |
|---|---|---|---|
| Primary role | Coding-agent authoring (CLI/SDK/App) + customization (skills/plugins/hooks/rules/subagents) | Coding agent (Anthropic's Claude Code), Google Cloud-integrated peer example | Operational layer: build/scale/govern/optimize deployed agents |
| When used | Development-time: writing, refactoring, patching code | Development-time: same category of tasks as Antigravity | Post-authoring: operating agents that are now deployed |
| Guide task | 2.1 and 2.2 | 2.1 | 2.2 |
| Sandboxing | GKE, Cloud Workstations, or its own sandbox mode | Same sandboxing options apply (GKE, Cloud Workstations) | N/A — operates on already-deployed agents |

**Don't use** Agents CLI when the task is "configure MCP servers and
tool access for a coding agent" — that's Antigravity/Claude Code on
Google Cloud territory (2.1). **Use** Agents CLI when the task is
"take a built agent and scale/govern/optimize it in production" (2.2).

---

## 4. Common exam scenario patterns for Section 2

1. **"A team wants to automate a scripted nightly dependency-upgrade
   task with no human in the loop, invoked from a cron job."** →
   Antigravity **CLI** surface (scriptable, non-interactive).

2. **"A developer wants an interactive assistant inside their normal
   working environment to explore a large unfamiliar codebase."** →
   Antigravity **App** surface (interactive).

3. **"An internal platform team wants to embed coding-agent capability
   into their own custom internal developer portal."** → Antigravity
   **SDK**.

4. **"A coding agent needs to look up and update tickets in the
   team's issue tracker as part of completing a task."** → configure
   an **MCP server** for the issue tracker.

5. **"The company wants the coding agent's code execution isolated so
   a bad automated change can't touch production infrastructure."** →
   secure sandbox: GKE or Cloud Workstations (or Antigravity's sandbox
   mode).

6. **"The team keeps re-explaining the same database-migration
   conventions in every prompt, and the agent still gets it wrong
   sometimes."** → package this as a **custom skill**, not a longer
   prompt.

7. **"We need every commit to run our proprietary security linter
   first, no exceptions, enforced structurally."** → an **extensions
   hook** (pre-commit lifecycle point) plus/or a **rule**.

8. **"A large refactor task should have a dedicated worker just for
   writing the accompanying tests."** → a **subagent** scoped to test
   writing.

9. **"Once an agent is built and deployed, the ops team wants to scale
   its throughput and enforce governance policy on it from the command
   line."** → **Agents CLI** (build/scale/govern/optimize).

10. **"Should an autonomous agent be allowed to push directly to
    production without a human approving each step?"** → this is the
    **agent vs. human mode** distinction; high-blast-radius actions
    should favor human mode or gated agent mode.

---

## 5. Section 2 practice questions (16)

**Q1.** Which two coding agents does the PAA exam guide name explicitly
in Section 2?
A) Gemini Code Assist and GitHub Copilot
B) Antigravity and Claude Code on Google Cloud
C) ADK and Agent Runtime
D) CX Agent Studio and Agent Designer

*Answer: B.* These are the guide's explicit Section 2 examples. (A) is
a currency trap — Gemini Code Assist does not appear in the guide at
all. (C) are Section 3 custom-agent/runtime concepts, not coding
agents. (D) are Section 1 low-code tools.

**Q2.** A platform engineering team wants to embed coding-agent
capability directly into their own internal CLI tool that developers
already use daily, rather than asking developers to switch to a new
interface. Which Antigravity surface fits best?
A) App
B) CLI (standalone)
C) SDK
D) Agents CLI

*Answer: C.* The SDK is specifically for embedding coding-agent
capability into another piece of software. (A) is for direct
interactive human use, not embedding. (B) is a separate scriptable
surface, not an embeddable library. (D) Agents CLI is the
build/scale/govern/optimize operational layer for deployed agents, a
different tool entirely.

**Q3.** Why does the guide call out "using coding agents in secure
sandboxes" as its own named consideration under task 2.1, rather than
leaving sandboxing implicit?
A) Because sandboxing is optional and rarely used in practice
B) Because unsandboxed coding-agent execution (tool calls, code execution) against live/production systems is a real risk the exam expects candidates to actively design against
C) Because GKE cannot run any workload other than coding agents
D) Because sandboxes are only relevant to low-code tools

*Answer: B.* Naming it as an explicit consideration signals it's an
active design decision, not an afterthought — a coding agent making
real tool calls and running real code needs bounded blast radius. (A),
(C), (D) are all false.

**Q4.** A team is deciding between GKE and Cloud Workstations to
sandbox their coding agents. They want each individual developer to
get a consistent, pre-configured, isolated environment with minimal
Kubernetes-specific operational overhead. Which is the better fit?
A) GKE, because Kubernetes is always the more secure choice
B) Cloud Workstations, because it provides managed, pre-configured, isolated dev environments without requiring the team to operate Kubernetes-native infrastructure
C) Antigravity App, because sandboxing is irrelevant to the App surface
D) Neither — sandboxing isn't available for interactive developer use

*Answer: B.* Matches the comparison in §2.1.4 — Cloud Workstations is
the better fit when the goal is a managed, ready-to-go dev environment
without extra Kubernetes operational overhead. (A) overgeneralizes;
GKE isn't inherently "more secure," it's a different isolation model
with more operational surface. (C) and (D) are false.

**Q5.** Which of the following is an example of "patching an
application-layer vulnerability" as described in task 2.1, as opposed
to an infrastructure-layer security control?
A) Configuring a PAB policy via Agent Identity
B) Fixing a known CVE in an application dependency
C) Setting up Model Armor guardrails
D) Configuring Agent Gateway traffic monitoring

*Answer: B.* Application-layer vulnerability patching is source-code-
level (e.g., a dependency CVE, an injection flaw) — exactly what a
coding agent is described as doing in 2.1. (A), (C), (D) are all
Section 5 infrastructure/governance-layer security mechanisms, a
different layer entirely.

**Q6.** An organization wants its coding agent to reliably follow a
specific internal convention ("all new database migrations must
include a rollback script") across every task, without relying on the
convention being re-stated in every individual prompt. Which Antigravity
customization primitive is the best fit?
A) A subagent
B) A skill
C) An extensions hook fired only on deployment
D) Increasing the model's context window

*Answer: B.* A skill packages a specific, reusable convention/capability
so the agent applies it consistently without needing it restated
per-prompt — exactly matching this scenario. (A) subagents are for
task delegation/decomposition, not convention encoding. (C) hooks are
lifecycle trigger points, not where you'd encode a general convention
(though a hook could enforce a check, the primary fit here is a
skill). (D) is unrelated — context window size doesn't address
convention consistency.

**Q7.** What distinguishes an "extensions hook" from a "rule" in
Antigravity's customization model?
A) They are identical concepts with different names
B) A hook is a lifecycle execution point where custom logic runs; a rule is an explicit constraint/policy on agent behavior
C) Hooks only apply to subagents; rules only apply to the primary agent
D) Rules are configured via Agents CLI; hooks are configured via ADK

*Answer: B.* This is the core distinction from §2.2.1 — hooks are
about *when* logic runs (lifecycle points); rules are about
*constraints* on behavior (hard limits). (A), (C), (D) are fabricated
distinctions not supported by the guide.

**Q8.** A large refactoring task involves both rewriting core logic
and writing a comprehensive new test suite. The team wants a
dedicated, narrower-scoped agent to handle just the test-writing part.
Which customization primitive fits?
A) A rule
B) A plugin
C) A subagent
D) An MCP server

*Answer: C.* Subagents are exactly for delegating a scoped subtask to
a specialized worker — test writing is a textbook example. (A) rules
are constraints, not workers. (B) plugins add capability, not
delegated task ownership. (D) MCP servers connect to external
tools/data, not internal task delegation.

**Q9.** What is the correct relationship between Antigravity and
Agents CLI, per task 2.2's phrasing?
A) They are mutually exclusive competing products
B) Agents CLI augments Antigravity — Antigravity is used for
   authoring/customizing the coding agent; Agents CLI is used to
   build, scale, govern, and optimize it once deployed
C) Agents CLI replaces Antigravity for all coding-agent use cases
D) Antigravity is a feature inside Agents CLI

*Answer: B.* The guide's own phrasing is "augmenting Antigravity with
Agents CLI" — they operate together across the dev-to-ops lifecycle,
not as alternatives. (A), (C), (D) all mischaracterize the
relationship.

**Q10.** What does "agent vs. human mode" refer to in the context of
Agents CLI, per task 2.2?
A) Whether the CLI's output is formatted for humans or machines
B) A configuration distinguishing autonomous agent-driven operation from human-driven/approved operation through the same interface
C) Whether Antigravity or Claude Code on Google Cloud is being used
D) A setting that only affects Cloud Workstations sandboxes

*Answer: B.* This is the governance-relevant toggle described in
§2.2.2 — agent mode runs autonomously; human mode has a human
issuing/approving actions. (A), (C), (D) are fabricated
mischaracterizations.

**Q11.** For a high-blast-radius action (e.g., a production
infrastructure change), what does exam-aligned best practice suggest
about agent-mode vs. human-mode operation?
A) Agent mode should always be preferred for speed
B) High-blast-radius, hard-to-reverse actions should favor human mode, or agent mode gated by explicit approval steps
C) Mode selection has no bearing on risk
D) Human mode should never be used with Agents CLI

*Answer: B.* This is the governance-aligned tradeoff stated in
§2.2.2 — significant, hard-to-reverse actions warrant tighter human
oversight. (A) inverts the correct guidance. (C) and (D) are false.

**Q12.** A coding agent's refactor of a critical authentication module
passes all automated tests inside its sandbox. Should it be merged to
production directly by the agent, per the exam's implied best
practice?
A) Yes, passing automated tests is sufficient for any change
B) No — even sandboxed, tested output should typically pass through
   human review/CI gates before merging, especially for
   security-sensitive changes
C) Yes, but only if using Claude Code on Google Cloud specifically
D) No, coding agents should never be allowed to touch authentication code

*Answer: B.* §2.1.5 explicitly recommends human-review/CI gates before
merging agent output, particularly for security-sensitive changes,
regardless of passing sandboxed tests. (A) overstates what automated
tests alone guarantee. (C) is a fabricated tool-specific carve-out.
(D) is too absolute — coding agents can touch such code, just not
without review gates.

**Q13.** Which statement correctly separates Section 2 (coding
agents) from Section 3 (custom/runtime agents)?
A) Section 2 covers production runtime agents; Section 3 covers dev-time tools
B) Section 2 covers development-time agents that write/refactor/patch code; Section 3 covers agents built and deployed to serve production runtime workloads
C) They cover identical content with different tool names
D) Section 2 is low-code; Section 3 is entirely no-code

*Answer: B.* This is the framing distinction laid out in §0. (A)
reverses it. (C) is false — different concerns entirely (dev-time
tooling vs. runtime agent architecture). (D) is wrong on both counts —
neither section is accurately described that way.

**Q14.** An MCP server configured for a coding agent in this section's
context would most likely expose which kind of capability?
A) A vector database for RAG retrieval in a production agent
B) An internal issue tracker, package registry, or infrastructure query tool the coding agent needs during development tasks
C) A CX Agent Studio state machine
D) An Agent Runtime deployment target

*Answer: B.* This matches the dev-time tool-access framing in §2.1.3 —
MCP servers connect a coding agent to the specific systems it needs
during development work. (A) is a Section 3.2 RAG-pipeline concept.
(C) and (D) are unrelated low-code/deployment concepts.

**Q15.** True or False: Antigravity and Claude Code on Google Cloud
are positioned in the exam guide as mutually exclusive — an
organization must choose only one.
A) True — the guide states only one may be used per organization
B) False — both are named as coequal examples of coding agents covered by task 2.1; the guide does not state they're mutually exclusive
C) True — Claude Code on Google Cloud can only be used inside Antigravity
D) False — Antigravity is deprecated in favor of Claude Code on Google Cloud

*Answer: B.* Both are simply named as examples of "coding agents" this
task covers; nothing in the guide suggests exclusivity or deprecation
between them. (A), (C), (D) are all fabricated claims not supported by
the source material.

**Q16.** A regulated enterprise wants its coding agent's every commit
to be blocked unless a proprietary compliance linter passes, with no
way for a developer or the agent to bypass this. Which combination of
primitives best enforces this structurally?
A) A skill alone
B) A subagent alone
C) An extensions hook at the pre-commit lifecycle point combined with a rule prohibiting bypass
D) A system-level prompt instruction asking the agent to "remember to lint"

*Answer: C.* A hook provides the structural lifecycle enforcement
point (pre-commit), and a rule provides the hard constraint preventing
bypass — this combination is the deterministic enforcement mechanism.
(A) a skill alone doesn't structurally block a commit. (B) subagents
are about delegation, not gating. (D) relies on unreliable
instruction-following, exactly the failure mode structural primitives
exist to avoid (same anti-pattern flagged in §2.2.1's "don't use a
single ever-growing system prompt").

---

## 6. Quick-reference recap

| Concept | One-line definition | Don't confuse with |
|---|---|---|
| Antigravity | Google Cloud's coding-agent product (CLI/SDK/App) | Claude Code on Google Cloud (a peer example, not the same product) |
| Claude Code on Google Cloud | Anthropic's coding agent, Google Cloud-integrated | "Gemini Code Assist" (not named in the guide at all) |
| CLI surface | Scriptable, automation-oriented coding-agent use | App surface (interactive) |
| App surface | Interactive human-driven coding-agent use | CLI (scripted/headless) |
| SDK surface | Embedding coding-agent capability into other software | CLI/App (direct-use surfaces) |
| MCP server (dev-time) | Connects a coding agent to external dev tools/systems | Agent Search (Section 1 grounding) or RAG retrieval (Section 3.2) |
| Secure sandbox (GKE/Cloud Workstations) | Isolated execution environment bounding a coding agent's blast radius | Unsandboxed direct production execution (anti-pattern) |
| Skill | Packaged, reusable task-specific capability/convention | Rule (a constraint, not a capability) |
| Plugin | Modular add-on functionality/capability | Skill (skills are more about how-to; plugins about added capability) |
| Extensions hook | Lifecycle execution point for custom logic | Rule (hooks are "when," rules are "what's forbidden") |
| Rule | Explicit hard constraint on agent behavior | Hook (rules constrain; hooks trigger) |
| Subagent | Delegated, scoped worker for a subtask | The primary coding agent itself |
| Agents CLI | Operational layer: build/scale/govern/optimize deployed agents | Antigravity (authoring/dev-time customization layer) |
| Agent vs. human mode | Autonomous vs. human-driven/approved operation | A sandboxing concept (it's a governance/operation-mode concept) |
