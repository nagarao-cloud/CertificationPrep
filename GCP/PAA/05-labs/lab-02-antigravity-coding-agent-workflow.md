# Lab 02 — Configuring a coding agent with Antigravity: MCP servers, custom skills, and a sandbox

> Covers exam tasks **2.1** (using coding agents effectively) and
> **2.2** (customizing coding agents for enterprise workflows).
> Companion reference: `01-domains/SECTION-2-coding-agents.md`,
> `02-services/02-coding-agents-devtools.md`.

---

## Honesty callout

> **This lab is illustrative, not console-verified.** This environment
> has no live access to Antigravity (CLI/SDK/App), Claude Code on
> Google Cloud, the Google Skills platform, GKE, or Cloud Workstations.
> Command names, flag names, config file formats, and exact console
> steps below are a best-effort reconstruction from the exam guide's
> stated capabilities plus general knowledge of how coding-agent tools
> of this shape are typically configured (MCP server configs, skill/
> plugin manifests, sandboxed execution). **Cross-check every exact
> command and file path against the real Antigravity docs/console
> before an actual exam attempt.**

---

## 0. What you're building, and why

You are a developer at the same fictional retail company from Lab 01.
Engineering wants a coding agent that can: (a) look up information
from the team's issue tracker via an MCP server, (b) follow the team's
own conventions for writing database-migration code via a custom
skill, and (c) run entirely inside an isolated sandbox so a bad
command can't touch production. You'll configure this using
**Antigravity**, then briefly repeat the same conceptual steps for
**Claude Code on Google Cloud** to reinforce that the exam treats both
as coequal examples of "a coding agent" (per
`01-domains/SECTION-2-coding-agents.md` §2.1.2) — a scenario question
naming either tool is testing the same underlying task 2.1/2.2
concepts.

### Vocabulary check before you start

- **Coding agent** — an agent that operates at *development* time: it
  writes, refactors, tests, and patches source code, as opposed to a
  runtime agent (Section 3) that serves end users in production. Keep
  this distinction sharp — it's the first thing `01-domains/SECTION-2-
  coding-agents.md` §0 establishes, and it recurs throughout this lab.
- **MCP (Model Context Protocol)** — an open protocol that
  standardizes how an agent (the "client") connects to external tools
  and data sources (each exposed by an "MCP server"), instead of every
  agent needing a bespoke, one-off integration per tool.
- **Sandbox** — an isolated execution environment where an agent's
  actions (running commands, writing files, calling APIs) are
  contained, so a mistake or malicious instruction can't reach
  production systems.
- **CI/CD (continuous integration / continuous delivery)** — the
  automated pipeline that builds, tests, and deploys code changes,
  typically triggered whenever code is pushed to a repository. A
  coding agent's output (a patch, a refactor) usually needs to pass
  through the same CI checks a human's change would.

---

## 1. Prerequisites (illustrative)

- A code repository the coding agent will operate on (any small
  sample repo works for this lab — e.g., a toy service with a
  database-migration folder and an existing test suite).
- Antigravity installed and authenticated (CLI surface for this lab —
  see `01-domains/SECTION-2-coding-agents.md` §2.1.1 for the CLI / SDK
  / App surface comparison; CLI is the right surface here because
  we're automating/scripting, not doing interactive App-based work).
- Access to an issue tracker (any ticketing system) and a GKE or Cloud
  Workstations environment to sandbox the agent in.

---

## 2. Part A — configuring an MCP server connection

### 2.1 Why the agent needs an MCP server at all

Without MCP, "connect the coding agent to our issue tracker" would
mean writing custom glue code specific to that one tracker's API,
redone for every tool the agent needs and every coding agent product
you might use. MCP standardizes this: the issue tracker exposes an MCP
server once, and any MCP-compatible agent (Antigravity, Claude Code on
Google Cloud, or others) can connect to it the same way.

### 2.2 Configure the MCP server (illustrative config)

Most MCP-compatible coding agents read a configuration file (commonly
named something like `mcp.json` or a section inside the tool's own
config) listing the MCP servers available to the agent. A
representative shape:

```json
{
  "mcpServers": {
    "issue-tracker": {
      "command": "npx",
      "args": ["-y", "@example/issue-tracker-mcp-server"],
      "env": {
        "ISSUE_TRACKER_API_TOKEN": "${ISSUE_TRACKER_TOKEN}"
      }
    }
  }
}
```

**Reasoning, not just syntax:** the token is referenced via an
environment variable placeholder (`${ISSUE_TRACKER_TOKEN}`), not
hard-coded in the file — this repo's own conventions (see the root
`CLAUDE.md`: "no secrets, no credentials — anywhere") and general
security practice both point the same direction: a config file that
might be committed to source control should never contain a literal
secret. This is the same "don't embed long-lived static credentials"
principle you'll see again in Lab 06 for OAuth 2.0 agent-to-tool auth
— it applies just as much to a coding agent's dev-time tool access as
to a runtime agent's production tool access.

### 2.3 Register the MCP server with Antigravity (illustrative)

```bash
antigravity mcp add issue-tracker --config ./mcp.json
antigravity mcp list
```

Expected illustrative output of `mcp list` — a table showing the
server name, connection status, and the tools it exposes (e.g.
`create_ticket`, `search_tickets`, `update_ticket_status`). Confirming
the server is actually reachable *before* asking the agent to do real
work is a cheap sanity check that avoids a confusing failure later
where the agent "can't find" a tool that was simply never connected.

### 2.4 Scope what the agent can actually do with it

Per `01-domains/SECTION-2-coding-agents.md` §2.1.3's third component
("access to tools" — scoping what the agent is allowed to
call/execute), don't grant the coding agent the issue tracker's full
API surface if it only needs to search and comment on tickets. If the
MCP server exposes a scoped API token concept (many do, mirroring
OAuth-style scoping), request a token limited to read + comment,
**not** ticket deletion or admin actions — the same least-privilege
instinct that governs Agent Identity/PAB in Section 5 applies here at
dev-time too, just configured through the MCP server's own token
scoping rather than Agent Identity specifically (Agent Identity/PAB is
a Section 3.2/5.1 concept for custom *runtime* agents — see Lab 06 —
not the mechanism a coding agent's MCP tool access typically goes
through, though the underlying principle is identical).

---

## 3. Part B — creating a custom skill

### 3.1 What a skill is, and why prose instructions aren't enough

Recall from `01-domains/SECTION-2-coding-agents.md` §2.1.3 and §2.2.1:
a **skill** is a packaged, reusable unit of specialized capability or
instruction that teaches the agent how to perform a specific kind of
task the way *your* organization does it — as opposed to re-explaining
the same convention in every single prompt (which is brittle: easy to
forget, easy for the agent to partially ignore under a complex task,
and impossible to version/update in one place).

### 3.2 Author the skill (illustrative structure)

A skill is typically a small package: a manifest describing when the
skill applies, plus instructional content and (optionally) example
code the agent should follow.

```
skills/
  db-migration-conventions/
    SKILL.md
    example-migration.sql
```

`SKILL.md` (illustrative content):

```markdown
# Skill: Database Migration Conventions

## When to use this skill
Apply this skill whenever the coding agent is asked to create,
modify, or review a database migration file in this repository.

## Conventions
1. Every migration must have a matching "down" migration that
   reverses it — never write a migration with no rollback path.
2. Migration filenames follow `YYYYMMDDHHMM_short_description.sql`.
3. Never write a migration that drops a column without a prior
   migration (in an earlier release) that stopped writing to it —
   this avoids breaking a still-deploying previous version of the
   application that might still read/write that column.
4. Always run the migration against a scratch database in the
   sandbox before proposing it in a PR — see example-migration.sql
   for the standard test invocation.
```

**Reasoning behind rule 3 specifically:** this is the kind of
organization-specific, non-obvious convention that a generic coding
agent would never know to apply on its own — it's not a generic best
practice string it could infer from broad training, it's *this
company's* deployment-safety rule (avoiding a race between a schema
change and a still-rolling-out prior application version). This is
exactly the gap skills are built to close, per
`01-domains/SECTION-2-coding-agents.md` §2.2.1: "how an enterprise
adapts a general coding agent into one that reliably follows *that
organization's* specific engineering practices."

### 3.3 Register the skill and verify it triggers

```bash
antigravity skills add ./skills/db-migration-conventions
antigravity skills list
```

Test it by asking the agent (in the App or CLI interactive mode) to
"add a migration that drops the `legacy_notes` column from the
`orders` table," and confirm the agent's proposed change follows rule
3 above (i.e., it should push back, or add a preceding migration that
stops writing to the column first, rather than dropping it directly).
If it doesn't, the skill isn't being applied — check that the skill's
"when to use this skill" trigger condition actually matches the
request you gave it; a too-narrow trigger description is a common
first-time mistake.

### 3.4 Add a rule and a hook (the other two customization primitives)

Recall the full five-primitive set from
`01-domains/SECTION-2-coding-agents.md` §2.2.1: skills, plugins,
extension hooks, rules, subagents. You've now used a skill; add one
**rule** and one **hook** to see how they differ:

- **Rule** (a hard constraint, not a how-to): add a rule such as
  `"never modify files under /infra/prod"` to the agent's rules
  configuration. Unlike a skill, which teaches *how* to do a task
  well, a rule is a blanket constraint that should apply regardless of
  what task is being requested.
- **Hook**: configure a `pre-commit` extension hook that runs your
  team's linter automatically before the agent finalizes any commit.
  This is a lifecycle-point injection — logic that runs *at* a
  specific moment in the agent's execution, not a piece of knowledge
  the agent reasons about the way a skill is.

**Why not just fold the rule and the hook into the skill file?**
Because they answer different questions and should be independently
testable/updatable (per the "don't use a single, ever-growing system
prompt" guidance in `01-domains/SECTION-2-coding-agents.md` §2.2.1):
a rule is checked by asking "did the agent violate a hard constraint?"
a hook is verified by asking "did the lifecycle logic actually run at
the right moment?" — different failure modes, different debugging
paths, so keep them as separate, purpose-built primitives rather than
one large blended instruction blob.

---

## 4. Part C — running the agent inside a sandbox

### 4.1 Why an unsandboxed coding agent is the wrong default

Per `01-domains/SECTION-2-coding-agents.md` §2.1.4: running a coding
agent with direct, unsandboxed access to real infrastructure is
flagged as "the single biggest security anti-pattern this task bullet
exists to prevent." A coding agent that can execute shell commands and
call MCP tools should do so somewhere with bounded blast radius — if
it runs a destructive command by mistake (or is manipulated into one
via a prompt-injection-style attack hidden in a file it reads), the
damage should be contained to the sandbox, not production.

### 4.2 Choose GKE vs. Cloud Workstations for this scenario

Per the comparison table in `01-domains/SECTION-2-coding-agents.md`
§2.1.4: this lab's team is a small engineering group that wants a
consistent, pre-provisioned, isolated dev environment per developer
session, without standing up and managing their own Kubernetes
cluster topology just for this. That points at **Cloud Workstations**,
not GKE — the "don't use GKE-based sandboxing when the actual need is
a lightweight, pre-configured interactive dev environment" guidance
applies directly here. (If this were instead a large platform team
that already runs everything on GKE and wants coding-agent execution
to inherit the same namespace/network-policy model as the rest of
their infrastructure, GKE would be the better fit — the decision
depends on what infrastructure model the team is already standardized
on, not a universal "always pick X" answer.)

### 4.3 Launch the sandboxed session (illustrative)

```bash
antigravity sandbox create \
  --type cloud-workstations \
  --repo ./my-service \
  --mcp-config ./mcp.json \
  --skills ./skills/db-migration-conventions

antigravity sandbox run --task \
  "Refactor the order-validation module for readability, \
   without changing its external behavior. Run the existing \
   test suite after your changes and report the results."
```

**Why this specific task wording matters:** it explicitly scopes the
request to one of the three named coding-agent jobs from
`01-domains/SECTION-2-coding-agents.md` §2.1.5 — **refactoring**
("without changing its external behavior" is the refactor-specific
constraint, distinct from a feature change) — and it asks the agent to
self-verify with the existing test suite before reporting back, which
gives you a first, cheap correctness signal before a human even opens
the diff.

### 4.4 Human review gate before merge

Per §2.1.5's explicit guidance: **don't treat a sandboxed agent's
output as automatically production-ready.** Even though the sandbox
contained any *execution*-time risk, the resulting code change still
needs the same human review / CI gate any human-authored change would
go through — sandboxing solves the blast-radius problem, not the
correctness-review problem. Open the agent's proposed diff as a pull
request and have a human (or your normal CI pipeline) review it before
merge, exactly as the diagram in
`01-domains/SECTION-2-coding-agents.md` §2.1.3 depicts (step 5: "Human
review / CI gate" as the final stage after sandbox execution).

---

## 5. Part D — a quick pass with Claude Code on Google Cloud

Because the exam guide names Antigravity and Claude Code on Google
Cloud as **coequal** examples (not one preferred over the other — see
`01-domains/SECTION-2-coding-agents.md` §2.1.2), briefly repeat the
conceptual shape of §§2–4 above with Claude Code on Google Cloud in
mind, without redoing every step:

- The **same MCP server** you configured in §2 is, by design, usable
  by any MCP-compatible client — that's the point of the protocol
  being a standard rather than a bespoke integration. Configuring it
  for Claude Code on Google Cloud would follow the same conceptual
  steps (register the server, scope its access), even though the
  exact CLI syntax/config file location would differ from
  Antigravity's.
- The **same skill package** concept (a `SKILL.md`-style manifest
  describing when and how to apply an organization convention) is a
  portable idea even if the exact packaging format a given tool
  expects differs — the underlying task-2.1/2.2 concept being tested
  ("configure the agent with MCP servers, custom skills, tool access")
  is the same regardless of which coding agent product a question
  names.
- The **same sandboxing principle** (GKE or Cloud Workstations,
  chosen by the same "how much infra control do you actually need"
  reasoning from §4.2) applies unchanged.

**Exam-relevant takeaway:** don't over-invest in memorizing one
product's exact command syntax at the expense of the underlying
concepts — a question naming "Claude Code on Google Cloud" instead of
"Antigravity" is very likely testing the identical task 2.1/2.2
concept with a different product label attached.

---

## 6. Part E — Agents CLI: the operational layer (task 2.2)

Everything above happened at **development time** — an engineer
driving a coding agent to change source code. Task 2.2's second bullet
introduces a distinct, later-lifecycle concern: **Agents CLI**, used
to *build, scale, govern, and optimize* an agent once it's deployed
(`01-domains/SECTION-2-coding-agents.md` §2.2.2).

This lab's coding agent work doesn't itself get "deployed" the way a
Section 3 custom runtime agent does — but it's worth explicitly
naming the boundary now, since it's a common point of confusion on
this exam: **Antigravity is the authoring/development surface you
used in §§2–4; Agents CLI is a separate, operational-layer tool for
what happens after an agent (built via Antigravity, or via ADK in
Section 3) is deployed.** You'll use Agents CLI concepts for real in
Lab 03's session/skill configuration and in the capstone (Lab 07,
Phase 2/3). For this lab, the important thing is recognizing the
distinction, not yet operating the tool:

- **Don't** reach for Agents CLI to configure MCP servers or write a
  skill for a coding agent still under active development — that's
  Antigravity/Claude Code on Google Cloud territory (§§2–3 above).
- **Do** reach for Agents CLI once an agent has moved past
  development into a deployed, managed state and you need to
  scale/govern/optimize it — which also means Agents CLI is where
  the **agent-mode vs. human-mode** toggle (introduced conceptually
  here) actually gets configured for a deployed agent's autonomous
  actions, a topic Lab 06 covers in depth for a production runtime
  agent.

---

## 7. What you should be able to explain after this lab

- [ ] The difference between a coding agent (Section 2, dev-time) and
      a custom runtime agent (Section 3, production-time), and why
      that distinction matters for how a scenario question should be
      read.
- [ ] What MCP is, why it exists (avoiding bespoke per-tool
      integrations), and how to scope an MCP server's access instead
      of granting full API access by default.
- [ ] The difference between a skill, a rule, and a hook, with a
      concrete example of each from this lab, and why they're kept as
      separate primitives instead of one big prompt.
- [ ] Why an unsandboxed coding agent is a security anti-pattern, and
      how to choose between GKE and Cloud Workstations for a given
      team's needs.
- [ ] Why a sandboxed agent's output still needs a human review/CI
      gate before merge — sandboxing bounds execution risk, it doesn't
      certify correctness.
- [ ] Why Antigravity and Claude Code on Google Cloud are treated as
      coequal examples on this exam, not a preferred-vs-alternative
      pair.
- [ ] The boundary between Antigravity/Claude Code on Google Cloud
      (dev-time authoring) and Agents CLI (post-deployment
      build/scale/govern/optimize).
