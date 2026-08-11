# PCA Study Plan

> Timeline is a placeholder until Naga confirms a target date (see
> `CLAUDE.md` §2). This plan is written as a **6-domain-proportional
> sprint** — allocate more days to heavier domains, and re-scale the
> whole plan by a multiplier if the real timeline is shorter or longer
> than the illustrative one below.

## How the allocation was derived

Days per domain are proportional to exam weight (from
`00-START-HERE/RUNBOOK.md` §3), with a floor of 1 day so no domain gets
zero dedicated time, plus fixed days for setup, case-study integration,
and mock exams.

```
Domain            Weight   Proportional days (18-day core pool)
1 Designing/Plan    24%    4.3 → 4
2 Managing/Provis    15%    2.7 → 3
3 Security/Compl    20%    3.6 → 4
4 Analyze/Optim     18%    3.2 → 3
5 Managing Impl     11%    2.0 → 2
6 Reliability       12%    2.2 → 2
                    ---    ----
                    100%   18 days
```

## Illustrative 26-day sprint (rescale freely)

| Day(s) | Focus | Output expected |
|---|---|---|
| 1 | Orientation | Read `RUNBOOK.md`, `SERVICE-MATRIX.md`; skim all 4 case studies in `04-architectures/` |
| 2–5 | Domain 1 — Designing and planning | `01-domains/DOMAIN-1-designing-planning.md`, `03-comparisons/01-compute-options.md`, `03-comparisons/02-storage-database-options.md`, `03-comparisons/04-migration-strategies.md`, `06-practice/domain-1-questions.md` |
| 6–8 | Domain 2 — Managing and provisioning | `01-domains/DOMAIN-2-managing-provisioning.md`, `03-comparisons/03-networking-connectivity.md`, `05-labs/lab-02-vpc-shared-network-design.md`, `05-labs/lab-03-gke-terraform-deployment.md`, `06-practice/domain-2-questions.md` |
| 9–12 | Domain 3 — Security and compliance | `01-domains/DOMAIN-3-security-compliance.md`, `03-comparisons/06-iam-security-models.md`, `05-labs/lab-01-org-iam-policy-foundation.md`, `06-practice/domain-3-questions.md` |
| 13–15 | Domain 4 — Analyzing and optimizing | `01-domains/DOMAIN-4-analyzing-optimizing.md`, `06-practice/domain-4-questions.md` |
| 16–17 | Domain 5 — Managing implementation | `01-domains/DOMAIN-5-managing-implementation.md`, `05-labs/lab-04-cicd-cloud-build-deploy.md`, `06-practice/domain-5-questions.md` |
| 18–19 | Domain 6 — Ensuring reliability | `01-domains/DOMAIN-6-ensuring-reliability.md`, `03-comparisons/05-ha-dr-strategies.md`, `05-labs/lab-05-dr-failover-cloud-sql.md`, `06-practice/domain-6-questions.md` |
| 20–23 | Case-study integration | All four files in `04-architectures/case-study-*.md` — this is where domains 1–6 recombine into the scenario-question skill the exam actually tests |
| 24 | Mock exam 1 | `06-practice/mock-exam-1.md`, review every wrong answer's full explanation |
| 25 | Gap-fill + revision | `07-revision/` cheat sheets for weakest 2 domains from mock 1 |
| 26 | Mock exam 2 + final review | `06-practice/mock-exam-2.md`, `07-revision/master-flashcards.md` |

## Daily loop (any day)

```
 read domain/service file(s)
        |
        v
 study 03-comparisons matrix for
 anything the domain file references  ──► resolves "which service" questions
        |
        v
 do that day's 06-practice question set
        |
        v
 got something wrong?
   ├── yes → CLAUDE.md §9 "I got this wrong" flow: explain right answer,
   │         explain every wrong option, note the exam-reasoning pattern
   │         used, add it to 07-revision cheat sheet if it's a recurring trap
   └── no  → move to next file
```

## Case-study-first mindset

PCA is unusual among associate/pro certs: 20–30% of the exam is 2 of the
4 case studies in `04-architectures/`, asked as a cluster of 4–8
questions each. Read all four case studies **before** the mock exams
(Day 1, lightly; Days 20–23, deeply) — they are not optional supplementary
material, they are load-bearing for roughly a quarter of the real exam.
For each case study, be able to answer without looking: "what is this
company's #1 constraint, and what would the exam consider an
over-engineered wrong answer for it?"

## Signals you're ready

- Score ≥ 80% on both mock exams in `06-practice/`, with every wrong
  answer's underlying reasoning pattern understood (not just the right
  letter memorized).
- Can state, for any of the 4 case studies, its primary technical
  constraint and 2 architecture decisions it forces, from memory.
- Can complete every decision tree in `DECISION-TREES.md` without
  looking at the answer branch first.
