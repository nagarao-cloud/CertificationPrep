# Section 2 Cheatsheet — Using coding agents for application development (~17%)

> Compressed by design (CLAUDE.md §10) — pure recall sheet. Full teaching
> content: `01-domains/SECTION-2-coding-agents.md`,
> `02-services/02-coding-agents-devtools.md`.

Tasks: **2.1** use coding agents effectively · **2.2** customize coding agents for enterprise workflows.

---

## Tool glossary (one line each)

| Tool | One-line definition |
|---|---|
| **Antigravity** | Google's coding-agent product, ships as **CLI, SDK, and App** — the guide's headline coding-agent name. NOT "Gemini Code Assist" — that branding never appears in the guide. |
| **Claude Code on Google Cloud** | The guide's other named coding-agent example, alongside Antigravity — explicitly called out for MCP-server/tool configuration in 2.1. |
| **Agents CLI** | Part of **Agent Platform** — used to *augment* Antigravity: build, scale, govern, and optimize deployed agents (task 2.2). Not a standalone coding-agent product on its own in this section. |
| **GKE (sandbox context)** | Here, task 2.1 names GKE as a **secure sandbox** for running coding agents during development — NOT the Section 4 production-deployment-target meaning. Same tool name, different job. |
| **Cloud Workstations** | Managed, secure dev environment — the other named sandbox alongside GKE and Antigravity itself for running coding agents safely. |

---

## 2.1 — Using coding agents effectively

- **Configure** coding agents with:
  - **MCP servers** (Model Context Protocol — lets the coding agent call external tools/data sources)
  - **Custom skills**
  - **Access to tools**
  - Named tools for this: **Antigravity** and **Claude Code on Google Cloud**.
- **Secure sandboxes** for running coding agents: **GKE, Cloud Workstations, Antigravity** (Antigravity itself ships sandboxing).
- **What coding agents are used for** (three verbs, memorize them):
  - **Refactor** source code
  - **Optimize** execution runtimes
  - **Patch** application-layer vulnerabilities

---

## 2.2 — Customizing coding agents for enterprise workflows

- Things you **create using Antigravity**: **skills, plugins, extensions, hooks, rules, subagents** — six nouns, all customization surfaces on top of the base coding agent.
- **Agents CLI** augments Antigravity for enterprise scale: **build, scale, govern, optimize** deployed agents — four verbs.
- Reading cue: 2.1 = *using* the coding agent day-to-day; 2.2 = *extending/governing* it as an enterprise capability.

---

## Quick facts

- Section weight: **~17%**, second-smallest.
- GKE appears in **two different exam contexts** — dev-time sandbox here (2.1) vs. production deployment target in Section 4 (4.2). Don't let the word "GKE" alone tell you which section a question is testing.
- MCP shows up here too (2.1, tool access) as well as in Section 3.3 (orchestration protocol) — here it's about the *coding agent's own* tool access, not inter-agent orchestration.
- "Skills" is used two different ways across the guide: Antigravity **skills** (2.2, coding-agent customization) vs. **Skill Registry** (Section 5, governed catalog of vetted skills). Related concept, different scope.

## 5-second recall

**Antigravity (CLI/SDK/App) + Claude Code on Google Cloud, wired to MCP servers/skills/tools, run inside GKE/Cloud Workstations sandboxes → refactor/optimize/patch code → Agents CLI + Antigravity's skills/plugins/hooks/rules/subagents scale and govern it enterprise-wide.**
