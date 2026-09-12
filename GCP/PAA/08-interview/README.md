# 08-interview — Interview Question Bank (173 Questions)

Nine files (~9,600 lines total), open-ended and judgment-based rather
than multiple-choice — model answers discuss tradeoffs, not a single
"correct" answer, mirroring both how the real exam's scenario questions
are constructed and how a real job interview for this role actually
goes. Basics through staff-level system design, organized so you can
work through it in order or jump to whichever section you need.

| File | Questions | Contents |
|---|---|---|
| `00-fundamentals-and-basics-questions.md` | 20 | Ground-zero concepts (agent vs. LLM, RAG, tool-calling, MCP, A2A, IAM/OAuth, HITL, low-code vs. custom) — read this first if any term elsewhere in this folder is new to you. |
| `agentic-architect-scenario-questions.md` | 20 | Architect-level design/diagnose scenarios ("a client wants X, walk me through your design"; "here's a failing production agent, diagnose it"), grounded in `../04-architectures/`'s patterns and the `../05-labs/` capstone's Meridian Tools scenario. Weighted toward Section 3. |
| `behavioral-and-tradeoff-questions.md` | 13 | Judgment/tradeoff questions (stakeholder pushback, cost triage, autonomy calibration, build-vs-buy) with model-answer discussions. |
| `section-1-low-code-tools-questions.md` | 13 | Section 1 (~13% weight) deep dive: Agent Designer vs. CX Agent Studio, state-machine workflow design, Agent Search grounding. |
| `section-2-coding-agents-questions.md` | 17 | Section 2 (~17% weight) deep dive: Antigravity/Claude Code on Google Cloud, MCP server governance, sandboxing tiers, Agents CLI fleet operations. |
| `section-3-custom-agents-questions.md` | 33 | Section 3 (~33% weight, the heaviest) deep dive: LLM/SLM selection, ADK, RAG pipelines, Agent Identity/Registry, A2A/MCP multi-agent orchestration. The largest file in the folder, matching the exam's own weighting. |
| `section-4-evaluation-deployment-questions.md` | 22 | Section 4 (~22% weight) deep dive: golden datasets, evaluation frameworks, deployment-runtime selection, and 6 production-troubleshooting scenarios (reasoning loops, latency, crashes, canary masking, rollback policy, test-integrity tampering). |
| `section-5-security-governance-questions.md` | 15 | Section 5 (~15% weight) deep dive: OAuth scoping, PAB policy design, Agent Gateway, Model Armor tuning, HITL fail-behavior, identity propagation, and 4 full-platform governance designs. |
| `cross-cutting-system-design-questions.md` | 20 | Staff-level synthesis questions spanning multiple sections at once: full from-scratch platform designs, diagnose-and-redesign scenarios, a full request-lifecycle trace, and a closing minimalism-first question. Every question includes a labeled ASCII diagram. |

**How to use this folder:** start with the fundamentals file if you're
new to any of the vocabulary, then either work through the 5
section-specific files in exam-weight order (Section 3 gets the most
depth, matching its ~33% exam weight) or jump straight to whichever
section you're currently studying in `01-domains/`. The two original
files (scenario and behavioral) and the cross-cutting file are best
saved for last — they assume you already know the underlying tools and
test whether you can reason about tradeoffs and full-system design
under realistic constraints.

Every file follows the same 4-part question format: an
interviewer-phrased question, a framing line naming what's really being
tested, a detailed model answer (with a labeled ASCII diagram for
system-design and diagnostic questions), and a closing section
explaining why a tempting-but-wrong answer fails. No two files
duplicate the same scenario.
