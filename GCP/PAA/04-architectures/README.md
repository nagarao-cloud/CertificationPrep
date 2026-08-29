# 04-architectures — Production Agentic Architecture Patterns

Six full production-architecture reference documents. Each covers a
distinct pattern this exam expects an architect to recognize, design,
and reason the tradeoffs of — a full ASCII diagram with every arrow
explained, a request/data-flow walkthrough, tradeoffs against at least
one named alternative, common failure modes and mitigations, and the
exam task(s) it demonstrates.

| File | Pattern | Primary exam task(s) |
|---|---|---|
| `pattern-low-code-cx-agent.md` | Customer-facing support agent — Gemini Enterprise + Agent Designer/CX Agent Studio + Agent Search | 1.1, 1.2 |
| `pattern-coding-agent-cicd-integration.md` | Coding agent (Antigravity / Claude Code on Google Cloud) integrated into a CI/CD pipeline, GKE/Cloud Workstations sandboxed | 2.1, 2.2 |
| `pattern-custom-multi-agent-adk.md` | Custom ADK agent with RAG (RAG Engine + Vector Search 1.0 + Agent Retrieval), Memory Bank sessions, Agents CLI-managed skills | 3.1, 3.2 |
| `pattern-multi-agent-a2a-mcp-orchestration.md` | Multi-agent system — Agent Registry + Agent Runtime + A2A + MCP, parallel/sequential/graph orchestration | 3.3 |
| `pattern-evaluation-deployment-pipeline.md` | ADK evalset → Agent Platform Gen AI evaluation service → staged Agent Runtime rollout, Observability-instrumented | 4.1, 4.2 |
| `pattern-secure-governed-enterprise-agent-platform.md` | OAuth2 tool auth, PAB via Agent Identity, Agent Gateway, Model Armor, HITL | 5.1, 5.2 |

Read in the order listed above for a natural build-up: low-code →
coding agents → single custom agent → multi-agent orchestration →
evaluate/deploy → secure/govern. The last two patterns are meant to
wrap around every pattern before them, not stand alone.

Currency corrections applied throughout (see `../CLAUDE.md` §7):
**Agent Runtime** (never Agent Engine), **Agent Search** (never Vertex
AI Search), **Gemini Enterprise** (never Vertex AI Agent Builder),
**Antigravity** / **Claude Code on Google Cloud** (never Gemini Code
Assist), **PAB** as an Agent-Identity-specific mechanism (never
generic IAM), **ADK** as open-source.
