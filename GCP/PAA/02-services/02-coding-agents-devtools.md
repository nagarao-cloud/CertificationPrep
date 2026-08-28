# 02-services — Coding Agents & Developer Tooling

> **Covers (exam-guide §6 in-scope items):** Antigravity (CLI, SDK,
> App) · Agents CLI in Agent Platform · Google Kubernetes Engine (GKE)
> — **this facet only: GKE as a coding-agent sandbox**. Full GKE-as-
> deployment-target coverage is in `05-evaluation-deployment.md`; this
> file cross-references it rather than repeating it.
> **Also covers** (named in task bullets, not separately listed in §6):
> Claude Code on Google Cloud, Cloud Workstations.
>
> **Primary exam tasks supported:** 2.1 (Using coding agents
> effectively), 2.2 (Customizing coding agents for enterprise
> workflows). Section 2 is ~17% of the exam.
>
> **Currency reminder:** the exam guide names **Antigravity** and
> **Claude Code on Google Cloud** explicitly as the coding-agent
> examples for Section 2. It does not mention "Gemini Code Assist"
> anywhere — do not substitute that branding here.

---

## 1. Why this file exists

Section 2 is about a different kind of agent than Section 1's — not a
conversational agent serving end users, but a **coding agent** that
writes, refactors, and ships code on a developer's behalf. The exam
tests three things about this category: how you *configure* a coding
agent (tools, skills, sandboxing), how you *use* it day to day
(refactoring, runtime optimization, vulnerability patching), and how
you *customize/govern* it for a whole engineering organization rather
than one developer's laptop.

```
Coding agent (Antigravity or Claude Code on Google Cloud)
 ├─ configured with: MCP servers, custom skills, tool access   (2.1)
 ├─ executes inside: a secure sandbox                          (2.1)
 │    ├─ Cloud Workstations   (managed dev environment sandbox)
 │    └─ GKE                  (container-based sandbox)
 ├─ customized via: skills, plugins, extension hooks,
 │                  rules, subagents (Antigravity-specific)     (2.2)
 └─ governed/scaled via: Agents CLI                             (2.2)
```

---

## 2. Antigravity (CLI, SDK, App)

**What it is.** The exam guide's named coding-agent product, available
in three surfaces: a **CLI** (terminal-driven, scriptable, CI-friendly),
an **SDK** (embeddable in custom tooling/automation), and an **App**
(interactive developer-facing application). Antigravity is the exam's
primary example of a coding agent — an agent whose job is writing,
modifying, and reasoning about source code, as distinct from Section
1's conversational/business-workflow agents.

**Problem it solves.** Manually writing every line of refactor,
runtime-optimization, and vulnerability-patch work at enterprise scale
doesn't scale to the pace modern engineering orgs need. A coding agent
takes a natural-language or ticket-driven instruction ("refactor this
module to remove the deprecated client," "patch this SQL-injection
risk") and executes the actual code change, using tools (repo access,
test runners, linters, MCP-connected services) rather than just
suggesting a diff in a chat window.

**How it's configured — verbatim task 2.1/2.2 considerations:**
- **MCP servers**: connect the coding agent to external tools and data
  through the Model Context Protocol (see `04-orchestration-protocols.md`
  for the protocol itself) — e.g., a ticketing system, an internal API
  catalog, or a Google Cloud MCP server.
- **Custom skills**: packaged, reusable capabilities the agent can
  invoke — e.g., "run our internal lint suite," "generate a migration
  script in our house format."
- **Access to tools**: beyond MCP, direct tool wiring (shell execution,
  test runners, package managers) scoped to what the agent legitimately
  needs.
- **Plugins, extension hooks, rules, and subagents** (task 2.2,
  explicitly "using Antigravity"): plugins extend Antigravity's own
  capabilities; extension hooks let you intercept/customize points in
  its execution lifecycle (e.g., before a commit, after a test run);
  rules constrain behavior (coding standards, forbidden operations,
  required review gates); subagents let one Antigravity session
  delegate a bounded piece of work to another agent instance — the same
  general "smaller specialized agent handles a sub-task" pattern
  Section 3.3 covers for custom orchestration, applied here inside the
  coding-agent product itself.

**Task cross-reference.** 2.1 (configuration, sandboxed execution,
refactor/optimize/patch usage), 2.2 (skills/plugins/hooks/rules/
subagents customization, explicitly "using Antigravity").

---

## 3. Claude Code on Google Cloud

**What it is.** The exam guide's second named coding-agent example,
listed alongside Antigravity in task 2.1: "Configuring coding agents
with Model Context Protocol (MCP) servers, custom skills, and access to
tools (e.g., Antigravity and Claude Code on Google Cloud)." Treat this
as a first-class, separately-nameable coding agent this exam expects
you to recognize — not a variant or a rebrand of Antigravity, and not
"Gemini Code Assist" under a different name.

**Problem it solves.** Same class of problem as Antigravity — agent-
driven code writing, refactoring, and patching — offered as a distinct
named option so an architect can choose per-team, per-workload, or
per-integration-need rather than being locked to a single coding-agent
product.

**How it's configured.** The exam guide applies the *same* task-2.1
configuration considerations to both named tools jointly: MCP servers,
custom skills, and tool access apply to Claude Code on Google Cloud the
same way they apply to Antigravity. It also runs inside the same class
of secure sandboxes (GKE, Cloud Workstations) named in task 2.1.

**Task cross-reference.** 2.1, by name, alongside Antigravity.

**Decision note — Antigravity vs. Claude Code on Google Cloud.** The
guide names both as parenthetical examples of the *same* task-2.1
bullet points, the same pattern used for Agent Designer/CX Agent Studio
in Section 1 — a signal the exam does not expect a hard technical
distinction, just recognition that both are valid, named coding-agent
choices for this exam. Task 2.2's Antigravity-specific customization
language (skills, plugins, extension hooks, rules, subagents, augmented
by Agents CLI) is called out **only** for Antigravity, not for Claude
Code on Google Cloud — if a question is specifically about that
customization depth (plugins/hooks/rules/subagents), Antigravity is the
guide-aligned answer.

---

## 4. Agents CLI (in Agent Platform)

**What it is.** A command-line tool inside the broader **Agent
Platform** (the umbrella containing Agents CLI, Memory Bank, and
managed sessions — see `03-adk-custom-development.md` for the latter
two). Task 2.2 names it as the mechanism to "augment Antigravity to
build, scale, govern, and optimize deployed agents." Do not confuse
this with Antigravity's own CLI surface (§2 above) — Antigravity CLI is
one of *Antigravity's* three surfaces (CLI/SDK/App); Agents CLI is a
*separate*, Agent-Platform-level tool that operates on deployed agents
more broadly, including but not limited to ones built with Antigravity.

**Problem it solves.** An individual developer's coding-agent session
(Antigravity) is not the same problem as running a fleet of deployed
agents across an organization — that needs build/scale/govern/optimize
tooling at the platform level, callable from scripts and **CI/CD**
(continuous integration/continuous delivery — the automated pipelines
that build, test, and ship code changes without a human manually
running each step), not
just from an interactive coding session.

**How it's used.** Task 3.1 also names Agents CLI for "configuring
skills... (e.g., plugins and agent vs. human mode)" — meaning Agents
CLI configuration includes deciding whether a given interaction point
runs autonomously (agent mode) or requires a human in the loop (human
mode), and managing plugins at the platform level.

**Task cross-reference.** 2.2 (augmenting Antigravity to build/scale/
govern/optimize deployed agents), 3.1 (configuring skills, plugins,
agent-vs-human mode).

**Decision note — Agents CLI vs. Antigravity's own CLI.** Use
Antigravity's CLI surface for the interactive/scriptable coding-agent
workflow itself — writing code, running an agent session against a
repo. Reach for Agents CLI when the task is about the deployed-agent
lifecycle across the organization: scaling instances, governance
policy, optimization of already-running agents, or agent-vs-human mode
configuration. If a scenario says "govern and scale agents already in
production," that's Agents CLI; if it says "have the coding agent fix
this bug," that's Antigravity (or Claude Code on Google Cloud).

---

## 5. Cloud Workstations

**What it is.** A managed, secure, cloud-hosted developer workstation
environment. Named in task 2.1 as one of the secure sandboxes coding
agents run in: "Using coding agents in secure sandboxes (e.g., Google
Kubernetes Engine [GKE], Cloud Workstations, and Antigravity)."

**Problem it solves.** Letting a coding agent execute arbitrary
commands, install dependencies, and run tests directly against a
developer's local machine or a shared production-adjacent environment
is a security and blast-radius risk. Cloud Workstations gives the agent
(and the human supervising it) a fully-managed, isolated,
policy-configurable development environment — consistent tooling,
network egress control, and no direct access to a developer's actual
laptop or to production infrastructure.

**How it's used.** A coding agent (Antigravity or Claude Code on Google
Cloud) is pointed at a Cloud Workstations instance as its execution
environment; the agent's tool calls (shell, file edits, test runs)
execute inside that sandbox rather than on unmanaged infrastructure.

**Task cross-reference.** 2.1, directly — named as a secure-sandbox
option.

---

## 6. GKE as a coding-agent sandbox

**What it is (this facet).** Google Kubernetes Engine, used here
specifically as a **secure execution sandbox for a coding agent's
tool calls** — container-isolated, ephemeral, horizontally scalable
execution environments the agent's actions run inside. **This is a
different facet of GKE than the deployment-target usage covered in
`05-evaluation-deployment.md` §GKE** (where GKE hosts the *finished
agent* serving production traffic). Same product, two different roles
in the agent lifecycle — sandboxing a coding agent's *development-time*
actions vs. hosting a *deployed* agent's runtime.

**Problem it solves.** Cloud Workstations sandboxes a whole developer
environment; GKE-as-sandbox is the containerized-execution alternative
— each coding-agent action (or session) runs in a tightly-scoped
container with its own resource limits, network policy, and lifecycle,
which suits highly parallel or programmatically-spun-up agent workloads
(e.g., a CI pipeline that spins up N short-lived sandboxed agent runs)
better than a persistent workstation model does.

**How it's used.** Task 2.1 names GKE alongside Cloud Workstations and
Antigravity as secure-sandbox options for coding-agent execution.
Configuration in this facet is about container isolation, resource/
network policy, and ephemeral lifecycle for agent-driven code
execution — not about serving production agent traffic (that's the
other facet, in `05-evaluation-deployment.md`).

**Task cross-reference.** 2.1, directly — named as a secure-sandbox
option, distinct from its 4.2 deployment-target role.

**Decision note — Cloud Workstations vs. GKE as sandbox.** Choose Cloud
Workstations when the coding agent needs a persistent, IDE-like
development environment a human is also actively working in alongside
the agent — consistent state across a session, familiar dev tooling.
Choose GKE when the sandbox need is ephemeral, highly parallel, or
programmatically orchestrated — e.g., CI/CD spinning up isolated
sandboxed containers per pull request or per agent task, with no
persistent human-facing workstation required.

---

## 7. How these tools fit together

```
                     ┌────────────────────────────────────────┐
                     │     Developer / CI trigger               │
                     │  ("refactor module X", "patch CVE-...")   │
                     └───────────────────┬────────────────────┘
                                         │ (1) instruction
                                         ▼
        ┌────────────────────────────────────────────────────────┐
        │      Coding agent: Antigravity  or  Claude Code           │
        │                    on Google Cloud                        │
        │   configured with: MCP servers · custom skills · tools    │
        │   (Antigravity only) plugins · extension hooks · rules ·  │
        │                     subagents                             │
        └───────────────────┬────────────────────────────────────┘
                            │ (2) execution routed into a sandbox
                 ┌──────────┴───────────┐
                 ▼                      ▼
     ┌───────────────────────┐  ┌───────────────────────────┐
     │   Cloud Workstations    │  │            GKE              │
     │  persistent, IDE-like    │  │  ephemeral, container-       │
     │  managed dev environment │  │  isolated sandbox pods       │
     └───────────────────────┘  └───────────────────────────┘
                 │ (3) code changes, test runs, patches produced
                 ▼
        [ commit / PR / pipeline artifact ]
                 │ (4) lifecycle management at the org level
                 ▼
        ┌────────────────────────────────────────────────────────┐
        │                       Agents CLI                          │
        │   build · scale · govern · optimize deployed agents;      │
        │   skills/plugins/agent-vs-human mode configuration        │
        └────────────────────────────────────────────────────────┘
```

**Arrow-by-arrow:**
1. A developer or a CI trigger issues an instruction to the coding
   agent — a natural-language ask or a ticket-driven task such as a
   refactor, a runtime optimization, or a vulnerability patch.
2. The coding agent (Antigravity or Claude Code on Google Cloud),
   configured with its MCP servers/skills/tool access, routes its
   actual execution into a secure sandbox — either a persistent Cloud
   Workstations environment or an ephemeral GKE-hosted container,
   depending on the workload shape (§6's decision note).
3. Inside the sandbox, the agent produces the actual work product: a
   code change, a passing test run, a patched vulnerability.
4. Beyond a single session, Agents CLI operates at the organizational
   level — building, scaling, governing, and optimizing the population
   of deployed agents this workflow produces, including configuring
   whether a given interaction point runs in agent mode or requires a
   human (task 3.1's "agent vs. human mode").

---

## 8. Quick-reference table

| Tool | Role | Primary task | Config surface | Don't confuse with |
|---|---|---|---|---|
| Antigravity | Coding agent (CLI/SDK/App) | 2.1, 2.2 | MCP servers, skills, tools; plugins/hooks/rules/subagents | Claude Code on Google Cloud (separate named product, same task-2.1 config pattern) |
| Claude Code on Google Cloud | Coding agent | 2.1 | Same MCP/skills/tools pattern as Antigravity | "Gemini Code Assist" (not named in the guide) |
| Agents CLI | Agent Platform CLI (org-level) | 2.2, 3.1 | Build/scale/govern/optimize deployed agents; skills/plugins/agent-vs-human mode | Antigravity's own CLI surface (a coding-agent interface, not an Agent Platform lifecycle tool) |
| Cloud Workstations | Sandbox (persistent) | 2.1 | Managed dev environment | GKE-as-sandbox (ephemeral, container-based) |
| GKE (sandbox facet) | Sandbox (ephemeral) | 2.1 | Container isolation, resource/network policy | GKE-as-deployment-target (see `05-evaluation-deployment.md`, task 4.2) |

---

## 9. Exam traps specific to this file

- Writing "Gemini Code Assist" as the coding-agent tool this exam
  covers — it does not appear anywhere in the guide; lead with
  Antigravity and Claude Code on Google Cloud.
- Treating Antigravity's own CLI surface and **Agents CLI** as the same
  tool — they are not. Antigravity CLI is one of Antigravity's three
  surfaces (CLI/SDK/App); Agents CLI is a separate Agent-Platform-level
  tool for the deployed-agent fleet.
- Assuming GKE's role in Section 2 (sandbox for a coding agent's
  execution) is the same as its role in Section 4 (deployment target
  for a finished, production-serving agent) — same product, two
  distinct exam-relevant roles; see `05-evaluation-deployment.md`.
- Assuming task 2.2's plugin/hook/rule/subagent customization language
  applies equally to Claude Code on Google Cloud — the guide names that
  customization depth specifically "using Antigravity."
