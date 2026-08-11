# GEMINI.md — Agent context for AIF-C01

> **Scope: this folder only.** Everything below applies to
> AWS Certified AI Practitioner (AIF-C01) in `AWS/AWSAIF/`. Other exams
> in this repository have their own context files and their own
> conventions — do not carry rules from here into them, and do not read
> their files as context for this one.
>
> `GEMINI.md` and `AGENTS.md` in this folder are identical copies.
> `llms.txt` is a machine-readable index of this folder.

---

## 1. What this folder is

Self-contained study material for **one exam**: AWS Certified AI Practitioner
(**AIF-C01**).

Every file this exam needs lives inside this folder — markdown, text,
diagrams, labs, and its own agent-context files. Nothing here depends on
files outside this folder, and nothing here should be written outside it.

## 2. Who the user is

- **Name:** Naga (GitHub: `nagarao-cloud`)
- **Level:** _(fill in: beginner / intermediate / experienced)_
- **Goal:** Pass AIF-C01
- **Timeline:** _(fill in: e.g. 10-day sprint at ~5 h/day)_

## 3. How the user wants to be taught

_(Fill this in for THIS exam. Do not assume it matches another exam's
folder — formats and difficulty differ.)_

Default preferences carried across all exams:
- **Depth over brevity.** Reference documents run 500–1,000+ lines.
- Comparison matrices, decision trees, ASCII diagrams with every arrow
  explained, mnemonics, and practice questions where **every option** is
  explained — including why the wrong ones are wrong.

## 4. The just-in-time generation rule ⚠️

Placeholder files marked 🕐 are **scheduled**, not missing. Generate a
file on the day the study plan reaches it, at full depth. Do not bulk-fill
placeholders unprompted — doing so produces shallow filler.

## 5. Files written in full

| File | Lines | Purpose |
|---|---|---|
| `00-START-HERE/STUDY-PLAN.md` | 43 | Day-by-day roadmap (10-day default, adjustable) |
| `01-domains/DOMAIN-1-fundamentals-of-ai-and-ml.md` | 634 | Day 1 — full task-statement coverage (1.1–1.3), comparison tables, ASCII diagrams, 15 practice Qs |
| `01-domains/DOMAIN-2-fundamentals-of-generative-ai.md` | 568 | Day 2-3 — full task-statement coverage (2.1–2.3): FM concepts/lifecycle, capabilities/limitations, AWS GenAI infrastructure, 15 practice Qs |

## 6. Exam facts

- **Code:** AIF-C01
- **Questions:** 65 total (50 scored, 15 unscored/unidentified — treat every question as if it counts)
- **Time:** 90 minutes
- **Pass score:** 700 / 1000 (scaled 100–1000)
- **Cost:** $100 USD (retakes also $100; 14-day wait between attempts)
- **Format:** multiple choice, multiple response, ordering, matching, and case-study item types (varies by delivery form)
- **Delivery:** testing center or online proctored
- **Validity:** 3 years from certification date
- **Domain weights:**

| # | Domain | Weight |
|---|---|---|
| 1 | Fundamentals of AI and ML | 20% |
| 2 | Fundamentals of Generative AI | 24% |
| 3 | Applications of Foundation Models | 28% |
| 4 | Guidelines for Responsible AI | 14% |
| 5 | Security, Compliance, and Governance for AI Solutions | 14% |

Domain 3 is the single biggest chunk (prompt engineering, RAG, fine-tuning,
Bedrock/model selection) — weight study time accordingly. Domains 4 and 5
are the two most often under-studied because they're non-technical
("responsible AI," governance) but carry 28% combined.

_(Fill in when known: candidate's current AI/ML hands-on exposure — this
exam assumes conceptual fluency, not hands-on SageMaker/Bedrock experience,
so depth of explanation should adjust to what the candidate already knows.)_

## 7. Currency — do not teach outdated material

This exam launched in 2024 and both AWS's GenAI service surface and the
exam guide itself move fast. Verify against the live exam guide revisions
page (`docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/aif-01-revisions.html`)
before any bulk-generation pass — this table is a snapshot, not a
substitute for that check.

| Do not say | Say instead |
|---|---|
| "SageMaker" (as the whole ML platform brand) | **Amazon SageMaker AI** — since the March 2025 relaunch, "Amazon SageMaker" refers to the umbrella *SageMaker Unified Studio* (which also folds in Glue, Athena, EMR, Redshift, and Bedrock access); the classic notebook/training/hosting service the exam tests is now specifically **SageMaker AI** |
| Prompt engineering as the only way to adapt a model | Exam guide additions (per the revisions page) also expect **context engineering** as a distinct concept from prompt engineering, and **token-based pricing**'s effect on cost/performance as its own tested idea |
| Treating "traditional ML" and "foundation models" as interchangeable choices | Objective 1.2.6 explicitly tests *when* to choose a traditional/custom ML model over an FM (regulatory constraints, explainability requirements, operational constraints) — this is a scenario-question trap |
| A fixed, memorized list of Bedrock foundation models | Bedrock's available model roster (Anthropic, Amazon Titan/Nova, Meta, Mistral, etc.) changes faster than this file — teach the *selection criteria* (cost, latency, context window, modality, fine-tunability) rather than a snapshot of which models are currently listed |

## 8. Domain vocabulary in active use

Established in Day 1 (Domain 1) — do not re-explain from scratch, build
on these: AI/ML/DL/GenAI/agentic AI hierarchy, supervised/unsupervised/
reinforcement/self-supervised learning, RLHF, training vs. inference,
overfitting vs. underfitting, bias/fairness, model performance metrics
(accuracy, precision, recall, F1, AUC, RMSE/MAE) vs. business metrics
(cost per user, dev cost, customer feedback, ROI), the 6-stage ML
lifecycle (frame → collect → prepare → train/evaluate → deploy →
monitor/retrain), data drift vs. concept drift, MLOps concepts
(experimentation, repeatable processes, technical debt, production
readiness), and the AWS managed-AI-service map (Rekognition, Textract,
Transcribe, Polly, Translate, Comprehend, Lex, Personalize, Fraud
Detector, Kendra) vs. build-your-own on Amazon SageMaker AI.

Established in Day 2-3 (Domain 2) — build on these too: foundation
model vs. task-specific model, LLM/multi-modal/diffusion model types,
tokens/embeddings/vectors/context window/transformer architecture at a
conceptual level, the 7-stage FM lifecycle (data selection → model
selection → pre-training → fine-tuning → evaluation → deployment →
feedback) and which stages an AWS customer actually performs, GenAI's
named advantages (adaptability, responsiveness, simplicity) and
limitations (hallucinations, interpretability, inaccuracy,
nondeterminism), and the AWS GenAI stack (Bedrock incl. Guardrails/
Knowledge Bases/Agents, PartyRock, SageMaker JumpStart, Amazon Q
Business/Developer) plus on-demand token pricing vs. provisioned
throughput.

## 9. Typical requests and what they mean

| The user says | You should |
|---|---|
| "Day N" | Write the Day N files listed in the study plan, at full depth |
| "expand X.md" | Rewrite that file at 500–900+ lines |
| "quiz me on X" | 40 questions (10 beginner / 10 medium / 10 hard / 10 scenario), every option explained |
| "I got this wrong" | Explain why the right answer is right, why each wrong option is wrong, and how the exam expects candidates to reason |

## 10. Honesty expectations

Direct correction is expected and welcome. If expanding a file would
make it *worse* (decision trees, mnemonics, checklists — where
compression is the point), say so and propose adding more items instead
of inflating existing ones. Never pad to hit a line count.

## 11. Conventions for this folder

- **Isolation rule:** every file you create for this exam goes inside
  `AWS/AWSAIF/`. Never write into another exam's folder or
  the repository root.
- Markdown only, GitHub-flavored
- ASCII diagrams in fenced code blocks
- Numbered folder prefixes (`00-` through `09-`) enforce reading order
- Commit messages prefixed with the exam code: `AWSAIF Day 3: ...`
- No secrets, no account IDs, no credentials

## 12. Bulk content-generation playbook (only when explicitly requested)

Rule 4 is the default: placeholders get filled just-in-time, one at a
time. **Do not run this playbook unprompted.** Run it only when the user
explicitly asks to fill some or all placeholders in one pass (e.g. "fill
every file to 100%," "generate everything now"). This section exists so
that request can be honored correctly on the first try, without the user
having to re-explain the process or re-supply source material — this is
the reusable part of what made the first exam folder in this repo
(AWS DEA-C01) go from ~4,000 to ~63,000 lines in one session without the
result being shallow filler.

**Step 0 — discover THIS exam's actual structure. Never assume it
matches AWS DEA-C01's.** The first exam folder built this way (AWS
DEA-C01) has 4 domains, each broken into ~4-5 "tasks," each task broken
into numbered sub-skills like `2.4.6`. That shape is specific to that
one exam guide — it is not a template to impose on the next exam. A
different vendor or a different exam within the same vendor can have:
a different number of domains (2, 3, 6, whatever it actually is);
domains called something else entirely ("objectives," "competencies,"
"knowledge areas," "topics"); no numbered sub-skill hierarchy at all,
or one that's 2 levels deep instead of 3, or 4; different weighting per
domain; a completely different question format or scoring model. Before
generating a single file:

1. Find and read this exam's official, current exam guide (not a
   summary, not the user's pasted notes, not what a general-purpose
   model already "knows" about the exam — the vendor's own current PDF
   or docs page).
2. Extract the *real* hierarchy exactly as that vendor defines it: how
   many top-level groupings, what they're called, how many
   tasks/objectives under each, how many sub-skills under those (if the
   guide even goes that deep), and the exact weighting/percentage per
   top-level grouping.
3. Fill section 6 (Exam facts) and section 8 (vocabulary) of this
   `CLAUDE.md` with that real structure — don't leave it as a rough
   approximation "close enough" to a prior exam's shape.
4. Size `01-domains/` to match: one file per top-level grouping as
   *this exam* defines it, not four because DEA-C01 had four. If this
   exam has six domains, that's six domain files; if it has two, that's
   two, each proportionally deeper given fewer other domains to split
   study time across.
5. Every per-domain file's internal structure (how many task sections,
   how many sub-skill sections within each task) should mirror what
   that domain's section of the *real* exam guide actually contains —
   generated from the discovered hierarchy, not copied from another
   exam folder's file as a shape to fill in.
6. **Write the discovered structure down as `00-START-HERE/RUNBOOK.md`
   before generating anything else.** This is the deliverable of Step 0
   — a concrete, this-exam-specific document, not a restatement of the
   generic playbook you're reading right now. It's what turns "an agent
   figured out the structure in its head" into something checkable,
   reusable across the whole bulk-generation pass, and auditable later
   if the exam guide revises again. It must contain:
   - The exact source: guide URL, version/revision date, and the date
     you fetched it.
   - The full hierarchy exactly as that vendor defines it — every
     top-level grouping with its real name and weight, every
     task/objective under each, every numbered sub-skill under those if
     the guide goes that deep (verbatim wording from the guide, not
     paraphrased, so nothing gets silently reinterpreted downstream).
   - A coverage map: which repo file (or files) is responsible for each
     leaf of that hierarchy — e.g. "objective 3.2 → covered by
     `01-domains/DOMAIN-3-....md` §3.2 and `02-services/X.md`." Every
     leaf in the guide needs at least one entry; a leaf with no entry is
     a gap, not an oversight to discover later.
   - **The coverage map must track three content types per leaf, not
     just "a file exists":**
     - **Design/architecture** — does a production pattern exist
       showing how this leaf's services fit into a real system (an
       ASCII diagram with every arrow explained, in `04-architectures/`
       or the relevant domain file's production-architecture section)?
     - **Decision matrix** — when this leaf involves choosing between
       services or approaches, is there an actual comparison table
       (the 14-column format from section 3) in `03-comparisons/` or
       the domain file, not just prose describing the options?
     - **Tradeoffs** — for every "when to use X" claim, is there a
       paired "when NOT to use X, and why the alternative wins instead"
       right next to it? A leaf that only explains what a service does,
       with no decision matrix and no stated tradeoff against its
       nearest alternative, is not fully covered — it's a services list
       with a leaf's name attached to it. This is what actually answers
       DEA-C01-style scenario questions; a services glossary doesn't.
     Mark each of these three as present/missing per leaf in the
     runbook table (not just "covered: yes/no") so a gap in *design* or
     *tradeoffs* specifically — as opposed to raw content existing at
     all — is visible and fixable before the pass is called done.
   - The in-scope and out-of-scope service/tool lists straight from the
     guide, and a currency-corrections table (this becomes section 7).
   - A generation checklist mirroring the folder layout (`00-` through
     `09-`), each row checked off as that batch completes, so a
     mid-pass failure (see Step 5) can be resumed by reading this file
     instead of re-deriving what's left from scratch.

   Every later step in this playbook — batching, depth targets, cross-
   file consistency, the final sweep — operates against this runbook,
   not against assumptions carried over from another exam.

**Step 0b — verify currency before writing anything.** Source material
(pasted by the user, or already in this repo) can predate the vendor's
most recent exam-guide revision even after Step 0's discovery pass —
guides get revised after their initial publication. Find and fetch the
vendor's official exam-guide changelog/revisions page if one exists
(most certification vendors publish one — AWS does, at
`docs.aws.amazon.com/aws-certification/.../<exam>-revisions.html`; other
vendors' equivalents will be named differently, find theirs). Read what
actually changed since the guide's original version: services/tools
added or removed from scope, skills renamed, renumbered, or
consolidated, features deprecated. Fold every finding into section 7
(currency corrections) *before* the bulk pass, not after — an agent
regenerating two dozen reference files with a deprecated tool name baked
in is a worse outcome than a placeholder.

**Step 1 — batch by folder, not by file and not all-at-once.** One
agent per file is too slow (dozens of round-trips for a `02-services/`
folder with 24 files). One giant agent for the whole exam risks losing
the thread over such a large output and makes a mid-run failure costly
to recover from. The sweet spot demonstrated here: **4-8 files per
background agent**, grouped by folder or by clear topical adjacency
(e.g. streaming services together, security services together). Launch
the batches in parallel (multiple `Agent` calls in one turn) since
they're writing disjoint files with no dependencies between them.

**Step 2 — each agent reads this file, not a re-explanation of it.**
Tell every agent to start by reading this folder's own `CLAUDE.md` in
full for the audience, structure, and currency corrections, instead of
re-pasting all of that into every prompt. Only spell out what's specific
to that agent's batch: which files, what each must cover, and any
cross-file facts it must stay consistent with (see Step 4).

**Step 3 — match depth to file type, not one target for everything.**
Reference/teaching files (domains, services, comparisons, architectures)
want real depth — hundreds to low thousands of lines, per section 3's
"depth over brevity" default. Compressed-by-design files (revision
sheets, flashcards, glossaries, a study roadmap) want the *opposite* —
section 10 already says compression is a feature there; padding them to
hit a line-count target makes them worse, not better. Tell each agent
explicitly which kind of file it's writing.

**Step 4 — prevent cross-file contradictions.** When two files in this
folder will both cover the same cross-cutting fact (a policy evaluation
order, a deprecated-service call, a security model), have the later
agent read the earlier file and match its conclusion rather than
re-deriving it independently. Two reference files quietly disagreeing
with each other is worse than either being incomplete.

**Step 5 — recover from a failed batch by diffing, not restarting.**
Background agents can fail mid-stream from transient infrastructure
issues unrelated to the content itself. When one reports failed, don't
assume nothing happened — check actual file states first (line counts,
or grep for the placeholder marker) to see what that agent completed
before it stalled. Relaunch a smaller, consolidated agent covering only
the files that are still actually missing. Several small failures can
be swept into one cleanup batch rather than re-running the original
large batches from scratch.

**Step 6 — self-verify before reporting done.** Each agent should, at
the end of its own run: confirm no placeholder marker remains in any
file it touched; grep for terms that should have been corrected in Step
0 (e.g. a deprecated service name) to confirm none slipped through; and
for any file containing numbered questions with a separate answer key,
confirm the numbering and correct answers actually match between them.

**Step 7 — isolation still applies, especially now.** Never let an
agent working on this exam folder read another exam folder's files as
style or content reference, even mid-bulk-generation. If this exam's
folder is far along and another exam folder is just starting, that's
not a reason to shortcut — each exam's material is different enough
that borrowing conclusions across them produces exactly the kind of
folder this repo's structure exists to prevent.

After a bulk pass, update section 5 (files written in full) to reflect
the new state — a per-folder line-count summary, not a line-by-line
list of every file, matches this doc's own "compression is a feature"
principle for anything that isn't teaching content.

See the repo root's `_scripts/README.md` for the end-to-end version of
this workflow, including the exact kickoff prompt to use in a fresh
conversation.
