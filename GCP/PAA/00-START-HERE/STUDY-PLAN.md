# STUDY-PLAN — Professional Agentic Architect (PAA), beginner track

> Source of truth for every fact in this plan: `00-START-HERE/RUNBOOK.md`
> (exam structure, weights, tool list) and `CLAUDE.md` (audience,
> teaching conventions). If this plan ever seems to disagree with
> either file, those files win.

---

## 0. Methodology — read this before Day 1

**Section weights below are copied verbatim from the official exam
guide PDF** — 13% / 17% / 33% / 22% / 15%, summing to 100% (see
RUNBOOK.md §3, CLAUDE.md §6). They are **not** this plan's estimate.
Study-day and practice-question volume in this plan are allocated
**proportionally to those published weights**, not split evenly across
five sections.

**Why this plan runs ~9-11 weeks instead of a shorter "crash" schedule:**
PAA is a **brand-new beta exam** (registration opens 2026-09-03). There
is no third-party prep ecosystem, no dumps site, and — critically — **no
historical pass-rate or "average hours to pass" data to calibrate a
timeline against** (see CLAUDE.md §2's sourcing note). Compressing this
plan to fit an arbitrary short deadline would be inventing a number this
plan has no right to invent. Instead, length here is driven by three
things that *are* known:

1. **Content volume** — five sections, one (Section 3) nearly a third of
   the exam on its own, plus a required capstone project.
2. **True beginner starting point** — per CLAUDE.md §2, general AI/cloud
   vocabulary (LLM, agent, RAG, IAM, OAuth 2.0, CI/CD, etc.) is **not**
   assumed known. A ground-zero foundations phase has to come first, in
   full, before any PAA-specific content — bolting vocabulary onto
   Section 1 halfway through would leave gaps.
3. **PAA has two required, independently-graded components** — a
   proctored multiple-choice exam *and* a separate hands-on-labs
   component on the Google Skills platform (RUNBOOK.md §2). Most
   single-component certs only need one kind of readiness. PAA needs
   two, run in parallel, both to full readiness — see §8 below.

**Pace assumption:** ~5-6 active study sessions/week, with rest/buffer
days built in. All day numbers below are **Study Day N** (a study
session), not a calendar date — stretch or compress the week mapping in
§1 to fit your real schedule; the day-by-day *content* and its
proportional weighting is the part that shouldn't be compressed.

**On the placeholder files this plan points to:** per CLAUDE.md §4,
placeholder files in this folder are *scheduled*, not missing — this
plan **is** the schedule. When a day below says "generate/read file X,"
and X doesn't exist yet, that's expected: it gets written in full the
day the plan reaches it, not before.

---

## 1. Plan at a glance

| Wk | Study Days | Phase | Section weight | MC-track focus | Lab-readiness track (parallel, §8) |
|---|---|---|---|---|---|
| 1 | 1–6 | 0. Ground-Zero Foundations | — (prerequisite) | LLM/agent/RAG/IAM/OAuth/CI-CD vocabulary from scratch | Google Cloud console orientation (Day 6) |
| 2 | 7–11 | 1. Low-code tools | **13%** | `01-domains/SECTION-1`, `02-services/01` | `lab-01` (Agent Designer / CX Agent Studio) |
| 2–3 | 12–17 | 2. Coding agents | **17%** | `01-domains/SECTION-2`, `02-services/02` | `lab-02` (Antigravity coding-agent workflow) |
| 3–5 | 18–29 | 3. Custom agents | **33%** (heaviest) | `01-domains/SECTION-3`, `02-services/03`, `04`, `03-comparisons/01–03` | `lab-03` (ADK build), `lab-04` (A2A/MCP multi-agent) |
| 5–6 | 30–37 | 4. Evaluate & deploy | **22%** | `01-domains/SECTION-4`, `02-services/05`, `03-comparisons/04–05` | `lab-05` (evaluation & deployment) |
| 6–7 | 38–43 | 5. Secure & govern | **15%** | `01-domains/SECTION-5`, `02-services/06`, `03-comparisons/06` | `lab-06` (secure agent governance setup) |
| 7–9 | 44–51 | 6. Capstone (integrated) | cross-cutting | `05-labs/lab-07-capstone-realtime-agentic-project.md` | **is** the lab track this week |
| 9 | 52–57 | 7. Final review & mocks | cross-cutting | `06-practice/` mock exams, `07-revision/` cheatsheets | Full dry-run across all 6 section labs |

**57 study days total.** Proportionality check for Phase 1–5 (37
content-days, excluding foundations/capstone/review): 5/6/12/8/6 days ≈
13.5% / 16.2% / 32.4% / 21.6% / 16.2% — within rounding of the guide's
published 13/17/33/22/15%.

---

## 2. Phase 0 — Ground-Zero Foundations (Study Days 1–6, no exam weight)

**Why this phase exists and why it's first:** every later file in this
folder defines PAA-specific terms (ADK, A2A, MCP, PAB, Agent Runtime...)
assuming you already know the *general* AI/cloud concepts underneath
them. Per CLAUDE.md §2/§8, this plan treats none of that general
vocabulary as known. Skipping this phase means re-learning it piecemeal,
mid-sentence, inside Section 1 — worse for retention than front-loading
it once, deliberately.

| Day | Topic | What "done" looks like |
|---|---|---|
| 1 | **What is an LLM? What is a prompt?** A large language model is software trained on huge amounts of text to predict/generate plausible next text; a prompt is the instruction/question you give it. Understand: LLMs don't "look things up" by default — they generate from learned patterns, which is *why* grounding (Day 3) matters. | Can explain, in one sentence each, what an LLM is and why it can be wrong (hallucination) without any external help. |
| 2 | **What is an agent? Tool-calling / function-calling.** An agent = an LLM given (a) a goal, (b) the ability to take multi-step actions, and (c) access to **tools** — external functions/APIs it can call (send an email, query a database, run code) rather than just answer in text. Tool-calling/function-calling is the mechanism: the model outputs a structured request ("call function X with these arguments"), your system executes it, feeds the result back. This is the single idea the whole exam sits on top of. | Can distinguish "a chatbot that answers questions" from "an agent that can also *do* things" and explain what a "tool call" is. |
| 3 | **RAG, embeddings, vector databases.** Retrieval-Augmented Generation (RAG) = before answering, the system retrieves relevant documents/data and feeds them into the prompt, so the model answers grounded in your actual data instead of only what it memorized during training. An embedding is a numeric representation of text (a list of numbers) that captures meaning, so similar meanings end up as similar numbers. A vector database stores embeddings and finds the closest matches to a query fast. | Can explain, without jargon, why an internal-docs support agent needs RAG rather than just a bigger prompt. |
| 4 | **IAM, service accounts, OAuth 2.0.** IAM (Identity and Access Management) = the system that decides *who* (a person or a piece of software) can do *what* to *which* resource. A service account is an identity for a piece of software (not a human) — this matters because an agent acting on your behalf needs its own identity, not yours. OAuth 2.0 is a standard protocol for one system to get permission to act on another system's behalf without sharing a raw password — this is the exact mechanism Section 5 uses for agent-to-tool calls. | Can explain why an *agent* (not a person) needs its own service-account-style identity, foreshadowing Agent Identity/PAB in Section 5. |
| 5 | **CI/CD and containers, briefly.** CI/CD (Continuous Integration / Continuous Deployment) = automatically testing and shipping code changes instead of doing it by hand every time — relevant because Section 2 covers coding agents inside CI/CD-adjacent workflows. A container packages an application with everything it needs to run consistently anywhere; Cloud Run and GKE (both in scope, Section 4) are two different ways of running containers on Google Cloud. | Can explain, at a plain-English level, what a container is and why "serverless" (Cloud Run) and "full control" (GKE) are a tradeoff, not a strict better/worse. |
| 6 | **Review + self-check + start the lab track.** Re-explain all 10 terms above out loud, from memory, without notes — that's the real test, not re-reading them. Then: create/verify access to a Google Cloud console (free tier is fine), and spend 30–60 minutes just clicking around the console's layout — projects, navigation menu, IAM page — with no specific task. This is the first session of the parallel lab-readiness track (§8). | You can define all 10 terms unprompted, and you've physically seen the Google Cloud console at least once. |

---

## 3. Phase 1 — Section 1: Building agents using low-code tools (13%, Days 7–11)

Smallest section by weight, but tests exam-specific vocabulary
(Gemini Enterprise, Agent Designer, CX Agent Studio, Agent Search) that
general "I've used a chatbot builder before" intuition won't cover.

| Day | Task(s) | Files | Deliverable |
|---|---|---|---|
| 7 | 1.1 — state-based workflow config (pages, transition routes, event handlers) | `01-domains/SECTION-1-low-code-tools.md` §1 | Can sketch a 3-page state-based flow (page → transition → event handler) on paper |
| 8 | 1.1 — system instructions, few-shot & chain-of-thought prompt templates | `01-domains/SECTION-1-low-code-tools.md` §1 (cont.) | Can write one system instruction + one few-shot example for a sample agent |
| 9 | 1.2 — connecting enterprise data, Agent Search grounding | `01-domains/SECTION-1-low-code-tools.md` §2, `02-services/01-gemini-enterprise-low-code.md` | Can explain the Agent Search rename trap unprompted |
| 10 | 1.2 — multimodal ingestion (video/audio/image) | `01-domains/SECTION-1-low-code-tools.md` §2 (cont.) | Can list the three multimodal input types the guide names |
| 11 | Section 1 self-check + **lab-01** | `lab-01-agent-designer-cx-studio-walkthrough.md` | Walk through the Agent Designer / CX Agent Studio lab (best-effort, console-unverified per RUNBOOK §7 — flag anything that looks off if you have real console access) |

---

## 4. Phase 2 — Section 2: Using coding agents for application development (17%, Days 12–17)

| Day | Task(s) | Files | Deliverable |
|---|---|---|---|
| 12 | 2.1 — configuring coding agents (MCP servers, custom skills, tool access); Antigravity vs. Claude Code on Google Cloud | `01-domains/SECTION-2-coding-agents.md` §1 | Can name both named coding-agent tools without hesitating |
| 13 | 2.1 — secure sandboxes for coding agents (GKE, Cloud Workstations, Antigravity) | `01-domains/SECTION-2-coding-agents.md` §1 (cont.) | Can explain *why* a coding agent needs a sandbox at all |
| 14 | 2.1 — using coding agents to refactor, optimize runtimes, patch vulnerabilities | `01-domains/SECTION-2-coding-agents.md` §1 (cont.) | Can give one example each of refactor / optimize / patch |
| 15 | 2.2 — skills, plugins, extension hooks, rules, subagents via Antigravity | `01-domains/SECTION-2-coding-agents.md` §2, `02-services/02-coding-agents-devtools.md` | Can distinguish "skill" from "subagent" from "hook" |
| 16 | 2.2 — Agents CLI to build/scale/govern/optimize deployed agents | `01-domains/SECTION-2-coding-agents.md` §2 (cont.) | Can explain how Agents CLI relates to Antigravity (augments it, per the guide) |
| 17 | Section 2 self-check + **lab-02** | `lab-02-antigravity-coding-agent-workflow.md` | Walk through the Antigravity coding-agent lab |

---

## 5. Phase 3 — Section 3: Developing custom agents (33%, Days 18–29)

**This is the exam's largest section by a wide margin — nearly a third,
by itself, of the entire multiple-choice exam.** This plan gives it
12 study days, more than Sections 1, 2, and 5 combined (17 days). Do
not compress this phase to "catch up" on schedule; if anything runs
long, borrow days from Phase 7's review buffer, not from here.

| Day | Task(s) | Files | Deliverable |
|---|---|---|---|
| 18 | 3.1 — model selection: LLM vs. SLM, self-hosted vs. SaaS, OSS vs. proprietary | `01-domains/SECTION-3-custom-agents.md` §1 | Can name the three model-selection axes and one cost/security tradeoff for each |
| 19 | 3.1 — ADK fundamentals (open-source library for custom agents) | `01-domains/SECTION-3-custom-agents.md` §1 (cont.), `02-services/03-adk-custom-development.md` | Can state, unprompted, that ADK is open-source (currency trap) |
| 20 | 3.1 — sessions & memory (Agent Platform Memory Bank, managed sessions); skills via Agents CLI (plugins, agent vs. human mode) | `01-domains/SECTION-3-custom-agents.md` §1 (cont.) | Can explain the difference between a session and long-term memory |
| 21 | 3.2 — RAG pipelines & vector retrieval (embedding models, similarity scoring, reranking) | `01-domains/SECTION-3-custom-agents.md` §2, `02-services/03-adk-custom-development.md` | Can walk through the retrieve → score → rerank pipeline stages in order |
| 22 | 3.2 — vector databases: Agent Retrieval and Vector Search 1.0 | `01-domains/SECTION-3-custom-agents.md` §2 (cont.) | Can explain what a vector database adds on top of a plain database (from Phase 0 Day 3's foundation) |
| 23 | **lab-03** (ADK custom agent build) + 3.2 — Agent Identity permissions in this context | `lab-03-adk-custom-agent-build.md`, `01-domains/SECTION-3-custom-agents.md` §2 (cont.) | Working (or best-effort walked-through) minimal ADK agent |
| 24 | 3.2 — Agent Registry, Google Cloud MCP Servers, custom integration layers | `01-domains/SECTION-3-custom-agents.md` §2 (cont.) | Can explain the difference between "prebuilt capability via Agent Registry" and "hand-written custom integration" |
| 25 | 3.3 — agentic protocols: A2A vs. MCP vs. direct integration | `01-domains/SECTION-3-custom-agents.md` §3, `03-comparisons/03-a2a-vs-mcp-vs-direct-integration.md` | Can correctly classify 5 example scenarios as A2A / MCP / direct (self-test using the comparison file's decision tree) |
| 26 | 3.3 — orchestration patterns: parallel / sequential / graph workflow | `01-domains/SECTION-3-custom-agents.md` §3 (cont.), `03-comparisons/02-orchestration-pattern-options.md` | Can correctly classify 5 example workflow descriptions by pattern |
| 27 | Low-code vs. custom development — the Section 1 vs. Section 3 boundary | `03-comparisons/01-low-code-vs-custom-development.md` | Can answer "would you build this in Agent Designer or ADK?" for 5 mixed scenarios |
| 28 | **lab-04** (A2A/MCP multi-agent integration) | `lab-04-a2a-mcp-multi-agent-integration.md` | Walked through a multi-agent handoff scenario end to end |
| 29 | Section 3 full self-check (heaviest section — take this seriously) | `01-domains/SECTION-3-custom-agents.md` (full re-read) | Score yourself against Section 3's practice questions once `06-practice/` reaches this section; if not yet generated, write your own 10 scenario questions from the comparison-file decision trees |

---

## 6. Phase 4 — Section 4: Evaluating and deploying agentic workflows (22%, Days 30–37)

| Day | Task(s) | Files | Deliverable |
|---|---|---|---|
| 30 | 4.1 — creating test sets (golden data, prompts, edge cases) | `01-domains/SECTION-4-evaluate-deploy.md` §1 | Can write 3 golden-data test cases for a sample agent |
| 31 | 4.1 — continuous evaluation pipelines, tool-execution success criteria | `01-domains/SECTION-4-evaluate-deploy.md` §1 (cont.) | Can explain what makes an evaluation pipeline "continuous" vs. one-off |
| 32 | 4.1 — evaluation frameworks: ADK evalset vs. Agent Platform Gen AI evaluation service vs. custom autoraters | `03-comparisons/05-evaluation-approaches.md` | Can pick the right tool for 5 mixed evaluation scenarios |
| 33 | 4.1 — evaluating response & retrieval quality against a golden dataset (using ADK) | `01-domains/SECTION-4-evaluate-deploy.md` §1 (cont.) | Can distinguish "response quality" from "retrieval quality" as separate things being measured |
| 34 | 4.2 — deployment runtime selection: Agent Runtime vs. Cloud Run vs. GKE | `01-domains/SECTION-4-evaluate-deploy.md` §2, `03-comparisons/04-agent-hosting-deployment-options.md` | Can state, unprompted, "Agent Runtime, formerly Agent Engine" and pick the right runtime for 5 mixed scenarios |
| 35 | 4.2 — troubleshooting: drift, tool-invocation latency, reasoning loops, system failures | `01-domains/SECTION-4-evaluate-deploy.md` §2 (cont.) | Can define "agent drift" and "reasoning loop" in your own words |
| 36 | 4.2 — monitoring & optimizing: logic errors, latency bottlenecks, hallucinations; Google Cloud Observability | `01-domains/SECTION-4-evaluate-deploy.md` §2 (cont.), `02-services/05-evaluation-deployment.md` | Can name the two Observability tools (Cloud Logging, Cloud Trace) and what each is for |
| 37 | Section 4 self-check + **lab-05** | `lab-05-agent-evaluation-deployment.md` | Walked through an evaluation + deployment lab end to end |

---

## 7. Phase 5 — Section 5: Securing and governing agentic workflows (15%, Days 38–43)

| Day | Task(s) | Files | Deliverable |
|---|---|---|---|
| 38 | 5.1 — authentication & secure tool execution (OAuth 2.0 for agent-to-tool calls) | `01-domains/SECTION-5-secure-govern.md` §1 | Can trace OAuth 2.0 back to Phase 0 Day 4's definition |
| 39 | 5.1 — PAB (principal access boundary) via Agent Identity | `01-domains/SECTION-5-secure-govern.md` §1 (cont.) | Can state, unprompted, "PAB is not generic IAM — it's Agent-Identity-specific" |
| 40 | 5.1 — Agent Gateway (traffic monitoring, tracking); governance/policy enforcement (Agent Registry, Model Armor) | `01-domains/SECTION-5-secure-govern.md` §1 (cont.), `03-comparisons/06-security-governance-models.md` | Can place PAB / Agent Gateway / Model Armor on the three-layer stack (who's allowed → what's flowing → is it safe) |
| 41 | 5.2 — safety frameworks & guardrails: Agent Gateway, Model Armor, HITL | `01-domains/SECTION-5-secure-govern.md` §2 | Can explain what HITL adds that Model Armor alone doesn't |
| 42 | 5.2 — secure data access & identity propagation across multi-hop calls | `01-domains/SECTION-5-secure-govern.md` §2 (cont.), `02-services/06-security-governance.md` | Can explain why identity has to *propagate* across agent-to-agent hops, not just be checked once |
| 43 | Section 5 self-check + **lab-06** | `lab-06-secure-agent-governance-setup.md` | Walked through a security/governance setup lab end to end |

---

## 8. Parallel track — hands-on lab readiness (runs Days 7–51 alongside Phases 1–6)

**Why this gets its own track instead of being folded into the reading
plan:** PAA has **two required, independently graded components** — the
proctored MC exam and a separate hands-on-labs component on the Google
Skills platform (RUNBOOK.md §2). Passing the MC exam does not pass the
labs, and vice versa; **both are mandatory.** Most single-component
certification plans have no equivalent to this — treat lab readiness as
co-equal to MC prep, not a nice-to-have add-on squeezed in afterward.

| When | Lab file | Pairs with | Honesty flag |
|---|---|---|---|
| Day 6 | (console orientation, no lab file yet) | Phase 0 close-out | — |
| Days 9–11 | `lab-01-agent-designer-cx-studio-walkthrough.md` | Section 1 | best-effort |
| Days 15–17 | `lab-02-antigravity-coding-agent-workflow.md` | Section 2 | best-effort |
| Days 22–25 | `lab-03-adk-custom-agent-build.md` | Section 3 (3.1/3.2) | best-effort |
| Days 26–28 | `lab-04-a2a-mcp-multi-agent-integration.md` | Section 3 (3.3) | best-effort |
| Days 34–37 | `lab-05-agent-evaluation-deployment.md` | Section 4 | best-effort |
| Days 41–43 | `lab-06-secure-agent-governance-setup.md` | Section 5 | best-effort |
| Days 44–51 | `lab-07-capstone-realtime-agentic-project.md` | All sections (Phase 6) | best-effort |

**Every lab file in this folder is flagged best-effort/illustrative, not
console-verified** — this environment has no live access to the Google
Skills platform or any of Agent Designer/CX Agent Studio/Antigravity's
actual consoles (RUNBOOK.md §1, §7 last row). Treat each lab as a
structured walkthrough of what the tool *should* do based on the guide's
stated capabilities, and **cross-check against the live console** before
attempting the real hands-on exam component. If you have real console
access earlier than this plan reaches a given lab, do the real thing in
parallel and note any drift from the written walkthrough.

---

## 9. Phase 6 — Capstone: Internal Knowledge & Support Agent Platform (Days 44–51)

The required, end-to-end capstone (RUNBOOK.md §8) ties every section
together by building one realistic project across all five exam
sections in sequence. Full detail lives in
`05-labs/lab-07-capstone-realtime-agentic-project.md` (1,500–2,500+
lines, the folder's flagship file) — this phase just maps its phases to
days.

| Day | Capstone phase | Exam section(s) exercised |
|---|---|---|
| 44 | 0. Problem framing & requirements | scaffolding |
| 45 | 1. MVP via low-code (Gemini Enterprise + Agent Search) | Section 1 |
| 46–47 | 2. Extend with coding agents (Antigravity / Claude Code on Google Cloud, GKE/Cloud Workstations sandbox) | Section 2 |
| 48–49 | 3. Rebuild core as custom ADK agent (model selection, RAG, memory, A2A/MCP orchestration) | Section 3 |
| 50 | 4. Evaluate (golden datasets, evalset, Gen AI evaluation service, custom autoraters) | Section 4 (eval half) |
| 50 | 5. Deploy & operate (Agent Runtime vs. Cloud Run/GKE, Observability, troubleshooting) | Section 4 (deploy half) |
| 51 | 6. Secure & govern (OAuth 2.0, PAB, Agent Gateway, Model Armor, HITL) | Section 5 |
| 51 | 7. Retrospective / best practices, mapped back to §7's exam traps | cross-cutting review |

By the end of Day 51 you will have designed, built (on paper/console
walkthrough), evaluated, deployed, and secured one coherent system using
every in-scope tool from RUNBOOK.md §6 at least once.

---

## 10. Phase 7 — Final review, mock exams, weak-area remediation (Days 52–57)

| Day | Activity |
|---|---|
| 52 | Read `07-revision/` cheatsheets (once generated) for Sections 1–2; re-read `EXAM-TRAPS-AND-MNEMONICS.md` in full |
| 53 | Read `07-revision/` cheatsheets for Section 3 (spend proportionally more time here — it's a third of the exam) |
| 54 | Read `07-revision/` cheatsheets for Sections 4–5 |
| 55 | Full mock exam #1 (`06-practice/`, once generated) — 80 questions, timed at 3 hours, simulating real conditions |
| 56 | Review every wrong/guessed answer from mock #1 — for each, identify which of the 5 sections and which currency trap (if any) it came from; re-read that specific sub-section |
| 57 | Full mock exam #2, timed; final dry-run of all 6 section labs (§8) back-to-back to confirm hands-on readiness, since that component is graded separately and doesn't get a "retake the wrong questions" review the way MC prep does |

**If mock exam #1 (Day 55) shows a section scoring well below its
weight's expected difficulty** — especially Section 3, given its 33%
weight — insert extra remediation days here rather than moving on;
borrowing time from Phase 7's buffer is the intended way to absorb
schedule slippage, not compressing Phase 3.

---

## 11. Adjusting this plan

- **More available time per day** → compress days within a phase, not
  the phase's *proportional share* of total days. E.g. if you have 2x
  the daily hours, halve total days everywhere, but keep Section 3 at
  roughly 12/57 ≈ 21% of the shortened plan, not shrink it to match
  Section 1's day count.
- **Prior experience with LLMs/agents already** → Phase 0 can compress
  to 2–3 days (skim, don't skip — confirm you actually know each term
  unprompted before moving on), but do not skip it for PAA-specific
  vocabulary (ADK, A2A, MCP, PAB, Agent Runtime, Agent Search) — those
  are new regardless of general AI background.
- **No confirmed exam date yet** — this plan assumes none (CLAUDE.md
  §2). Once a date exists, count backward from it; if fewer than 57
  study days remain, compress Phase 7 last (mock-exam review is
  valuable but the least section-specific), and compress within-phase
  review days before compressing core content days.
