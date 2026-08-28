# Low-Code (Agent Designer / CX Agent Studio) vs. Custom Development (ADK)

**Exam mapping:** Task 1.1 (configuring agentic workflows and behavior
using low-code tools), Task 1.2 (connecting enterprise data to Gemini
Enterprise), and Task 3.1 (designing and building agentic workflows in
code). This file is the head-to-head the guide implicitly sets up by
putting "low-code tools" in its own ~13%-weighted section and "developing
custom agents" in its own ~33%-weighted section — the exam expects you to
know which one a scenario calls for, not just that both exist.

## 1. What each side actually is

**Low-code: Gemini Enterprise, built with Agent Designer and CX Agent
Studio.** Gemini Enterprise is the low-code agent platform named
throughout Section 1 of the guide — this is **not** "Vertex AI Agent
Builder" (that branding does not appear in the guide at all). Inside
Gemini Enterprise:
- **Agent Designer** and **CX Agent Studio** (Customer Experience Agent
  Studio) are the builder tools. Per task 1.1, you use them to configure
  **state-based workflows** — pages, transition routes, and event
  handlers — and to author **system instructions and in-console prompt
  templates** (few-shot, chain-of-thought) that steer agent behavior.
- Per task 1.2, these same tools connect an agent to enterprise
  proprietary data sources via Gemini Enterprise and **Agent Search**
  (the current name — never "Vertex AI Search," which is the retired
  name the guide itself parenthetically flags as superseded), and ingest
  unstructured multimodal data (video, audio, images) into the workflow.
- The build surface is a console: you configure states and transitions,
  you don't write an agent's control-flow logic as source code.

**Custom development: ADK (Agent Development Kit).** Per task 3.1, ADK
is explicitly described as an **open-source library** for building
custom agents in code. Task 3.1 also covers what custom development adds
on top of "just write Python": explicit **model selection** (LLM vs.
SLM, self-hosted vs. SaaS, OSS vs. proprietary — weighed against cost,
security, and agent architecture), **session and memory configuration**
(Agent Platform Memory Bank, managed sessions), and **skill
configuration via Agents CLI** (plugins, agent-mode vs. human-mode). The
build surface is a codebase: you write the agent's reasoning loop, tool
bindings, and control flow directly.

## 2. Head-to-head comparison table

| Dimension | Agent Designer / CX Agent Studio (low-code) | ADK custom development |
|---|---|---|
| Exam task | 1.1, 1.2 | 3.1, 3.2, 3.3 |
| Build surface | Console: pages, transition routes, event handlers | Code: open-source ADK library, arbitrary Python/agent logic |
| Behavior authoring | System instructions + in-console prompt templates (few-shot, chain-of-thought) | Full control over prompts, reasoning loop, tool orchestration, and control flow |
| Workflow model | State-based (explicit pages and transitions) | Whatever you implement — state machine, graph, sequential, parallel (task 3.3 patterns) |
| Model selection | Fixed to what Gemini Enterprise exposes | Full choice: LLM vs. SLM, self-hosted vs. SaaS, OSS vs. proprietary (task 3.1) |
| Data connection | Built-in: Gemini Enterprise + Agent Search connectors, multimodal ingestion (task 1.2) | You wire RAG pipelines, vector retrieval, embeddings/reranking yourself (task 3.2) |
| Session/memory | Handled by the platform implicitly | Explicitly configured — Agent Platform Memory Bank, managed sessions (task 3.1) |
| Extensibility | Limited to console-exposed configuration | Plugins, skills, hooks, subagents — full extensibility (Agents CLI, task 3.1/2.2) |
| Time to first working agent | Fast — hours to days for a conversational/state-based agent | Slower — requires writing and testing code, wiring integrations |
| Ceiling on complexity | Bounded by what pages/transitions/event handlers can express | Unbounded — arbitrary orchestration (parallel, sequential, graph) |
| Team skill required | Conversation designer / business analyst-adjacent skill set | Software engineering — Python, agent architecture, testing |
| Multi-agent orchestration | Not the target use case | Native fit — A2A, MCP, parallel/sequential/graph patterns (task 3.3) |
| Governance/security hooks | Inherits Gemini Enterprise's platform-level controls | You explicitly wire Agent Identity, PAB, Agent Gateway (Section 5) |
| Debugging | Console-level tracing of state transitions | Full code-level debugging, custom logging/tracing |
| Best-fit workload | Customer-facing conversational agents, FAQ/support flows, structured intake processes | Backend agentic systems, multi-agent pipelines, anything needing custom tool logic or non-conversational orchestration |

## 3. Decision tree

```
                     Need an agent — where do you build it?
                                    |
              +---------------------+---------------------+
              |                                             |
   Is the interaction primarily a                Does it need custom
   conversational / state-based flow              orchestration logic
   (pages, transitions, FAQ-style,                (parallel/sequential/graph,
   customer support intake)?                      task 3.3), custom tool code,
              |                                    or non-Gemini models (SLM,
             YES                                   OSS, self-hosted)?
              |                                             |
              v                                            YES
   Do you need custom multi-agent                           |
   coordination, non-Gemini models,                          v
   or bespoke RAG/embedding tuning?              --------------------------
              |                                    Build with ADK (custom
        +-----+-----+                              development, Section 3)
       NO           YES
        |             |
        v             v
  Use Agent      Hybrid: build the
  Designer /     conversational front
  CX Agent       end in Agent Designer/
  Studio         CX Agent Studio, hand
  (low-code,     off to an ADK-built
  Section 1)     backend agent for the
                 parts low-code can't
                 express (see §5)
```

## 4. Tradeoff writeups

### Use Agent Designer / CX Agent Studio when...
- The agent's job is fundamentally a **state-based conversational
  flow** — customer support, intake forms, FAQ deflection — that maps
  cleanly onto pages, transition routes, and event handlers.
- Prompt engineering (system instructions, few-shot/chain-of-thought
  templates) is enough to get the behavior you need, with no requirement
  for custom control-flow code.
- The data-connection need is "query our enterprise data securely" —
  something Gemini Enterprise + Agent Search already solve out of the
  box — rather than a hand-tuned RAG pipeline with custom embedding
  models, similarity scoring, and reranking (task 3.2 territory).
- Time-to-value matters more than architectural control, and the team
  building it is conversation designers or business analysts rather than
  software engineers.
- Multimodal ingestion (video/audio/image) is a matter of pointing the
  workflow at the right ingestion capability, not building a custom
  pipeline.

### Don't use Agent Designer / CX Agent Studio when ADK wins instead...
- The workflow needs **multi-agent orchestration** — parallel agents,
  sequential agents, or a graph workflow (task 3.3) — because low-code
  state-based pages don't natively express multi-agent handoffs the way
  a coded orchestration layer does.
- You need control over **model selection**: SLM vs. LLM for
  cost/latency reasons, a self-hosted or OSS model for data-residency or
  cost reasons, or a non-Gemini proprietary model. Low-code tooling
  binds you to what Gemini Enterprise exposes.
- The integration surface is custom: hitting internal APIs, wiring an
  MCP server that talks to third-party SaaS or remote servers, or
  building a custom integration layer for a managed database (task 3.2)
  — these are code-shaped problems.
- You need explicit, tunable **session and memory** behavior (Agent
  Platform Memory Bank configuration, managed sessions) rather than
  whatever the low-code platform does implicitly.
- The team needs to enforce fine-grained security (Agent Identity, PAB
  policies, Agent Gateway traffic monitoring — Section 5) at the code
  level rather than relying on platform defaults.

### Use ADK custom development when...
- The scenario names parallel/sequential/graph orchestration, A2A/MCP
  protocol usage, custom RAG pipeline tuning, or specific model-selection
  tradeoffs — these are all explicitly Section 3 (task 3.1–3.3)
  territory in the guide.
- You need extensibility — skills, plugins, hooks, subagents — beyond
  what a console can expose (task 3.1's "Configuring skills using Agents
  CLI").
- Cost, security, or architecture constraints require choosing a
  specific model type (SLM for latency/cost, self-hosted for data
  control, OSS to avoid vendor lock-in) rather than accepting a fixed
  managed-model default.

### Don't default to ADK when low-code is the better call...
- Building a full custom agent in code for a straightforward FAQ/support
  conversational flow is over-engineering — it costs more engineering
  time for a workflow shape that Agent Designer/CX Agent Studio already
  expresses natively with pages and transition routes, and it forfeits
  the built-in Agent Search / multimodal ingestion connectors task 1.2
  gives you for free.
- If the team lacks the software-engineering bandwidth to maintain a
  codebase, a low-code flow is more sustainable operationally, even if
  ADK could theoretically do more.

## 5. Hybrid approaches (the exam-realistic middle ground)

Real deployments rarely pick one side exclusively. The guide's own
structure — low-code (Section 1) and custom code (Section 3) as
separate, independently-weighted sections, with orchestration protocols
(A2A, MCP) called out in Section 3.3 — implies these are meant to
compose:

- **Low-code front end, custom back end.** A CX Agent Studio flow
  handles the conversational surface and simple state transitions, then
  hands off (via an agentic protocol — see
  `03-a2a-vs-mcp-vs-direct-integration.md`) to an ADK-built backend agent
  for anything requiring custom orchestration, a non-Gemini model, or
  bespoke tool logic.
- **Low-code for the pilot, ADK for the scale-out.** Start with Agent
  Designer to validate the conversational design and prompt behavior
  quickly, then re-platform the validated logic into ADK once the
  requirements grow past what pages/transitions can express (custom
  memory, multi-agent handoffs, fine-grained governance).
- **ADK agent registered as a capability low-code can call.** Task 3.2's
  Agent Registry ("prebuilt and custom capabilities") is the mechanism
  that lets a low-code-authored agent discover and invoke a
  custom-built ADK agent as one of its tools/capabilities, without the
  low-code layer needing to know how that capability is implemented.

## 6. Exam traps to watch for

- Don't assume "low-code" means "no governance." Gemini Enterprise
  agents still sit inside the same Agent Identity/PAB/Agent Gateway
  governance surface described in Section 5 — low-code affects *how you
  build the agent's behavior*, not whether security policy applies to
  it.
- Don't confuse "Agent Designer configures prompts" with "Agent Designer
  configures models." Task 1.1 is about **system instructions and
  prompt templates**, not model selection — model choice (LLM vs. SLM,
  self-hosted vs. SaaS, OSS vs. proprietary) is explicitly a task 3.1
  custom-development consideration.
- A scenario describing "parallel agents," "sequential agents," or
  "graph workflow" by name is a Section 3 (custom/ADK) question, never
  a low-code one — those pattern names only appear under task 3.3.
- Never write "Vertex AI Agent Builder" for the low-code platform on
  this exam — the guide's term is **Gemini Enterprise**.
