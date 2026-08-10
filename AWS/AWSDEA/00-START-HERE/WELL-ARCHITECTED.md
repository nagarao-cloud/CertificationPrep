# Well-Architected Framework for Data Engineering

> DEA-C01 never asks "name the six pillars." It asks questions whose
> *correct answer* is a Well-Architected principle wearing a service
> name as a costume. "Least operational overhead" is the Operational
> Excellence pillar. "Fault-tolerant across an AZ failure" is the
> Reliability pillar. A question that makes you choose between a
> cheaper-but-fragile option and a slightly pricier managed one is
> testing Cost Optimization *against* Reliability, and AWS almost always
> wants the trade-off reasoned explicitly, not defaulted to "cheapest
> wins." This file exists so that reasoning is explicit instead of
> implicit — six pillars, each with pipeline-shaped examples and a
> direct translation table to the phrases the exam actually uses.

---

## The framework, one paragraph each

**Operational Excellence** — run and monitor systems to deliver
business value, and continuously improve supporting processes. In data
engineering: automation over manual steps, infrastructure as code,
observability built in from day one, and small reversible changes over
big risky ones.

**Security** — protect data, systems, and assets through risk
assessment and mitigation. Covered in full depth in
[`SECURITY.md`](SECURITY.md) and
[`01-domains/DOMAIN-4-DATA-SECURITY.md`](../01-domains/DOMAIN-4-DATA-SECURITY.md);
this file only maps it into the Well-Architected framing.

**Reliability** — a system that recovers from failure, scales to meet
demand, and mitigates disruption automatically. In data engineering:
no single point of failure in a pipeline, idempotent processing so a
retry doesn't corrupt data, and graceful degradation under partial
failure.

**Performance Efficiency** — use computing resources efficiently as
demand changes and technology evolves. In data engineering: matching
compute shape to workload shape (Serverless for spiky, provisioned for
steady), and choosing the right storage/query pattern so performance
doesn't require brute-force overprovisioning.

**Cost Optimization** — avoid unnecessary costs while still meeting
requirements. In data engineering: the requirement is load-bearing —
this pillar is explicitly about *not* under-spending on the reliability
or performance the workload actually needs, not about being cheap for
its own sake.

**Sustainability** — minimize the environmental impact of running
workloads. The newest pillar (added 2021) and the least directly tested
on DEA-C01, but it shows up as a tiebreaker reasoning pattern — "which
option uses fewer total resources for the same outcome."

---

## Pillar 1 — Operational Excellence

**Core question:** *does this reduce the operational burden of running
the system, or just move it around?*

| # | Pipeline example | Well-Architected principle applied |
|---|---|---|
| 1 | Replacing a hand-rolled Python retry loop inside a Lambda with Step Functions' native retry/backoff | Automate operations — a managed primitive replaces custom code nobody but its author fully understands |
| 2 | Deploying Glue jobs and Redshift schemas via CDK/CloudFormation instead of console click-ops | Infrastructure as code — every change is reviewable, repeatable, and rollback-able |
| 3 | A CloudWatch dashboard showing `IteratorAge`, Glue job success rate, and DMS replication lag on one screen before an incident happens | Build observability in from the start, not bolted on after the first outage |
| 4 | Choosing Amazon Data Firehose over a self-managed buffering/batching Lambda for the exact same "land a stream in S3" requirement | Prefer managed services that reduce operational surface when the functional outcome is identical |
| 5 | Running a small, reversible schema migration behind a feature flag before a full cutover, rather than one big-bang change | Make frequent, small, reversible changes — failure blast radius stays contained |

**Exam disguise:** "least operational overhead," "fully managed,"
"minimal ongoing maintenance," "reduce the need for the team to
manage infrastructure" — every one of these phrases is Operational
Excellence in disguise, and the correct answer is almost always the
more-managed option (Glue over EMR when either works; Firehose over a
custom buffering Lambda; Step Functions over hand-rolled orchestration
logic).

---

## Pillar 2 — Security

**Core question:** *is access least-privilege, is data encrypted in
both states, and is every access attributable after the fact?*

Full checklist and the two most-tested facts (IAM evaluation order,
Secrets Manager vs. Parameter Store) live in
[`SECURITY.md`](SECURITY.md) — not duplicated here. Three examples to
anchor the Well-Architected framing specifically:

| # | Pipeline example | Principle applied |
|---|---|---|
| 1 | A Glue job assumes a role scoped to exactly the S3 prefixes and Glue Catalog databases it touches, nothing broader | Least privilege by default |
| 2 | A shared analytics lake uses Lake Formation column-level filters so finance sees salary data and marketing doesn't, from the same physical table | Apply security at every layer, not just the network perimeter |
| 3 | CloudTrail data events are enabled specifically on the S3 prefix holding PII, so every read is attributable | Enable traceability — you can reconstruct "who did what" during an incident review |

**Exam disguise:** "least privilege," "fine-grained access control,"
"audit who accessed," "encrypt without managing keys yourself" — Security
pillar language, and the correct answer favors custom-scoped IAM
policies, Lake Formation for anything below table-level, and
SSE-KMS/CloudTrail data events over broader or unaudited alternatives.

---

## Pillar 3 — Reliability

**Core question:** *does this pipeline keep working — or fail safely
and recover on its own — through a partial failure?*

| # | Pipeline example | Principle applied |
|---|---|---|
| 1 | A Kinesis consumer processes records idempotently (keyed by an event ID, upserts not blind inserts) so an at-least-once redelivery after a crash doesn't double-count | Design for failure — retries are guaranteed to happen eventually, so the system must tolerate them |
| 2 | A Step Functions workflow routes failed records to a dead-letter queue instead of failing the entire execution | Graceful degradation — one bad record doesn't take down the whole pipeline |
| 3 | Redshift RA3 with Multi-AZ (or a read replica strategy) so a single AZ failure doesn't take analytics offline during business hours | Fault isolation across Availability Zones |
| 4 | Job bookmarks in Glue so a crashed job resumes from where it left off instead of reprocessing (or worse, skipping) data | Automatically recover from failure without manual intervention |
| 5 | An EMR cluster's Spot task nodes back off to on-demand capacity automatically via instance fleets when Spot pools tighten | Scale horizontally and tolerate component failure without a full outage |

**Exam disguise:** "fault-tolerant," "no single point of failure,"
"the pipeline should recover automatically," "exactly-once" or
"at-least-once" processing guarantees — Reliability pillar language.
The correct answer usually involves idempotent design, DLQs, retries
with backoff, or Multi-AZ, not "just alert someone and let them fix it
manually."

---

## Pillar 4 — Performance Efficiency

**Core question:** *is compute/storage shape matched to workload
shape, right now — not overprovisioned for a peak that rarely happens?*

| # | Pipeline example | Principle applied |
|---|---|---|
| 1 | Redshift Serverless for a workload with unpredictable, bursty query patterns instead of a fixed-size provisioned cluster sized for the worst case | Match resource shape to actual demand pattern |
| 2 | Partitioning and compressing S3 data (Parquet + Snappy/ZSTD) so Athena reads only the bytes a query actually needs | Use the right storage format/layout so the engine spends effort on relevant data, not brute-force scanning |
| 3 | Compound sort keys on a Redshift table matching the most common filter pattern, instead of leaving the table unsorted | Let the engine skip data (zone maps) rather than compensating with more compute |
| 4 | EMR Serverless for a job that runs for two hours a day instead of a 24/7 persistent cluster | Pay for compute shaped to the actual workload duration |
| 5 | Enhanced fan-out on Kinesis only for consumers that genuinely need dedicated throughput, not applied blanket to every consumer | Apply the performance feature where it's needed, not everywhere by default (over-applying also has a cost) |

**Exam disguise:** "handle unpredictable/spiky workloads," "minimize
query latency," "efficiently use compute resources," "scale
automatically with demand" — Performance Efficiency language. The
correct answer favors Serverless options for spiky/unpredictable
demand, and partitioning/sort-key/format optimization over "just add
more nodes."

---

## Pillar 5 — Cost Optimization

**Core question:** *is spend matched to the requirement — not
underspending on something the requirement actually needs, and not
overspending on headroom nobody's using?*

| # | Pipeline example | Principle applied |
|---|---|---|
| 1 | Choosing S3 Lifecycle policies to transition cold Iceberg snapshots to Glacier Instant Retrieval instead of leaving everything in S3 Standard forever | Match storage class to actual access pattern |
| 2 | Compaction jobs on Firehose-delivered small files, reducing Athena's per-query data-scan cost (and therefore bill) as a side effect of a performance fix | Cost and performance fixes are frequently the same fix — data layout is the lever for both |
| 3 | A Savings Plan committed only against a workload with 3–6 months of demonstrated steady utilization, not against a workload about to be re-architected | Commit spend only where the utilization pattern is proven, not guessed |
| 4 | Athena workgroup data-usage limits preventing one runaway analyst query from scanning petabytes unnoticed | Cost guardrails as a preventive control, not just a monthly report after the fact |
| 5 | Reviewing whether a 24/7 EMR cluster running at 15% utilization should move to EMR Serverless or a scheduled transient cluster | Eliminate waste before committing to a discount — a discounted idle resource is still waste |

**Exam disguise:** "reduce cost," "cost-effective," "avoid overpaying
for unused capacity," "minimize storage costs while meeting retention
requirements" — Cost Optimization language, and the load-bearing word
is always the requirement attached to it. A correct answer that ignores
a stated durability, latency, or compliance requirement to save money
is a trap, not a win — this pillar optimizes cost *subject to* the
other five, not instead of them.

---

## Pillar 6 — Sustainability

**Core question:** *does this option achieve the same outcome using
fewer total resources?*

| # | Pipeline example | Principle applied |
|---|---|---|
| 1 | Consolidating three overlapping nightly Glue jobs that each read the same source table into one job with three downstream branches | Reduce redundant compute and redundant data reads |
| 2 | Choosing Graviton-based instance families for EMR/Redshift where workload compatibility allows | Use more efficient hardware for the same throughput |
| 3 | Right-sizing Glue worker counts/types instead of defaulting to the largest available "to be safe" | Avoid provisioning resources that go unused |
| 4 | Retention policies that actually delete or archive data past its useful life instead of keeping everything in S3 Standard indefinitely "just in case" | Minimize the total footprint of stored data over time |

**Exam disguise:** rarely tested directly, but shows up as a tiebreaker
between two otherwise-equal options — "which approach uses fewer
total compute resources for the same result" — and the answer tends to
overlap heavily with the Cost Optimization answer, since using fewer
resources is usually both cheaper and lower-impact.

---

## How DEA-C01 tests Well-Architected thinking implicitly

The exam never names a pillar in a question stem. It signals the
pillar through vocabulary. This table is the fast lookup:

| Phrase in the question | Pillar being tested | Typical correct-answer shape |
|---|---|---|
| "least operational overhead" / "fully managed" / "reduce maintenance" | Operational Excellence | The more-managed AWS service, even if marginally pricier |
| "least privilege" / "audit" / "encrypt" / "fine-grained access" | Security | Custom-scoped IAM, Lake Formation, KMS CMK, CloudTrail data events |
| "fault-tolerant" / "recover automatically" / "no single point of failure" | Reliability | Multi-AZ, idempotent design, DLQs, retries with backoff, bookmarks |
| "handle unpredictable load" / "minimize latency" / "scale automatically" | Performance Efficiency | Serverless variants, partitioning/sort keys, right format/compression |
| "cost-effective" / "minimize cost" / "avoid overpaying" | Cost Optimization | Lifecycle policies, Serverless for spiky load, Savings Plans for proven-steady load, guardrails |
| "efficient use of resources" / tiebreaker between equal options | Sustainability | Fewer/consolidated jobs, right-sized compute, Graviton where compatible |

**The trap to watch:** two pillars pulling in opposite directions in
the same question. A scenario emphasizing both "lowest cost" and
"must survive an AZ outage with zero data loss" is asking you to weigh
Cost Optimization against Reliability — and the exam's own scoring
philosophy (compensatory across domains, but each question has one
correct answer) means the stated **hard requirement** always wins over
the **soft optimization**. If the question says data loss is
unacceptable, the reliable-but-pricier option is correct even though a
cheaper option exists — cost optimization only applies *within* the
space of options that already satisfy the hard requirements.

---

## Cheat sheet — one line per pillar

| Pillar | One-line test |
|---|---|
| Operational Excellence | Would a smaller team, with less institutional knowledge, still be able to run this? |
| Security | Can you name, right now, exactly who can access this data and prove it after the fact? |
| Reliability | If one component fails at 3 a.m., does the pipeline recover without a human? |
| Performance Efficiency | Is compute/storage shape matched to the actual workload shape, not the worst-case guess? |
| Cost Optimization | Are you paying for exactly the durability/latency/availability the requirement states — no more, no less? |
| Sustainability | Same outcome, fewer total resources — the tiebreaker pillar |

**Memory hook — "OS-RPCS"** (say it as "oz-arpix"): **O**perational
Excellence, **S**ecurity, **R**eliability, **P**erformance Efficiency,
**C**ost Optimization, **S**ustainability — alphabetically awkward on
purpose, so it doesn't collapse into a more memorable but wrong order
in your head during the exam.

---

## Practice questions — pillar reasoning in disguise

Each question below is written the way DEA-C01 actually phrases these —
no pillar name ever appears in the stem. Identify the pillar being
tested as part of your reasoning, not just the service name.

**Q1.** A team runs a Glue job on a fixed daily schedule that
occasionally fails and requires a manual restart at 2 a.m. by whoever
is on call. Leadership asks for a solution that "keeps the team from
being paged for routine transient failures." What's the best fix?

A. Move the job to a larger worker type so it fails less often
B. Add native retry with exponential backoff via Step Functions
orchestrating the job
C. Ask the on-call engineer to check the job manually every morning
D. Disable failure notifications so the page stops firing

<details><summary>Answer</summary>

**B is correct** — this is Reliability *and* Operational Excellence
together: automatic recovery from a transient failure removes the
human from the loop entirely, which is exactly what "keeps the team
from being paged for routine failures" is asking for. **A** might
reduce failure *rate* but doesn't address recovery when a failure still
happens for an unrelated transient reason. **C** doesn't reduce
operational burden, it just moves it to a scheduled manual check — the
opposite of automation. **D** removes the symptom (the page) without
fixing the underlying reliability gap, which is a red flag any time an
option "solves" a monitoring complaint by turning off monitoring.
</details>

**Q2.** A Redshift cluster is sized for a rare quarterly reporting
spike and sits idle at low utilization the rest of the time. A
scenario asks for the option that "best matches cost to actual usage
pattern without sacrificing the ability to handle the spike." Which
option fits?

A. Keep the current fixed-size cluster year-round
B. Downsize permanently and accept slower quarterly reports
C. Redshift Serverless, or a smaller base cluster with concurrency scaling for the spike
D. Move entirely to Athena and drop Redshift

<details><summary>Answer</summary>

**C is correct** — this is Performance Efficiency and Cost
Optimization working together: matching compute shape to the actual
(mostly low, occasionally spiky) demand pattern, without giving up
spike capability. **A** ignores Cost Optimization entirely — you're
paying quarterly-peak price every day of the quarter. **B** violates
the stated requirement ("without sacrificing the ability to handle the
spike") by trading away performance for cost. **D** is a bigger
architectural change than the requirement calls for and may not
support the concurrency/latency profile the quarterly reports need —
picking the most extreme option isn't the same as picking the
well-architected one.
</details>

**Q3.** A pipeline scenario states data loss during a single-AZ failure
is unacceptable for a specific financial reporting table, but the team
also wants to minimize cost everywhere else in the same architecture.
Which approach is correct?

A. Apply the cheapest option uniformly across the entire architecture
B. Apply Multi-AZ/durable design specifically to the financial table's
storage and pipeline path, and optimize cost elsewhere
C. Accept the risk of data loss to keep costs uniformly low
D. Ask the business to lower the durability requirement instead

<details><summary>Answer</summary>

**B is correct** — this is the classic "hard requirement wins over
soft optimization, but only where the requirement actually applies"
pattern. Cost Optimization operates *within* the space of options that
already satisfy stated reliability requirements — it doesn't override
them, and it also doesn't need to be sacrificed everywhere just because
one component has a strict requirement. **A** and **C** both violate
the explicit "unacceptable" durability requirement for the sake of
uniform cost savings. **D** inverts the relationship between
requirements and design — the requirement is given, not up for
negotiation by the engineer implementing it.
</details>

**Q4.** Three teams each run a separate nightly Glue job that reads
the same 2 TB source table independently to produce three different
downstream outputs. A scenario asks for the option that best "reduces
total resource consumption for equivalent business outcomes." What's
the right move?

A. Give each team a bigger worker type so their individual jobs run faster
B. Consolidate into one job that reads the source once and branches into three outputs
C. Schedule the three jobs at different times so they don't compete for cluster resources
D. Leave the jobs as-is since they belong to different teams

<details><summary>Answer</summary>

**B is correct** — this is Sustainability (and, as a direct side
effect, Cost Optimization): the same business outcome achieved with
roughly a third of the redundant reads against the source table.
**A** makes each individual job faster but doesn't address the
redundant total consumption the question is actually asking about.
**C** avoids resource contention but still reads the 2 TB table three
times — total consumption is unchanged. **D** ignores the question
entirely; "different teams own them" is an organizational fact, not a
technical reason the redundant reads must remain.
</details>

**Q5.** A scenario describes a data pipeline where a single Lambda
function transforms records and writes them to DynamoDB, but a bug
that crashes mid-batch has, in the past, left some records written and
others not, corrupting downstream aggregates. What's the correct fix,
and which pillar does it belong to?

A. Increase the Lambda timeout so it's less likely to crash mid-batch
B. Make the write operation idempotent and process records so a retry
after a partial failure produces a correct end state
C. Reduce the batch size to one record per invocation
D. Add a manual reconciliation script run weekly

<details><summary>Answer</summary>

**B is correct** — Reliability. The actual problem isn't crash
*frequency*, it's that a crash mid-batch leaves the system in an
inconsistent state; idempotent, retry-safe design is what guarantees a
retry after any partial failure converges on the correct result,
regardless of when the crash happens. **A** reduces the *chance* of a
crash but does nothing about the consequence when one still occurs —
treating a symptom, not the design flaw. **C** shrinks the blast radius
of a single crash but doesn't eliminate the risk of partial writes
within even a batch of one record if the write itself isn't atomic
against downstream state. **D** is a manual, after-the-fact workaround
— it doesn't prevent the corruption, it schedules a periodic cleanup
for damage the design allows in the first place.
</details>

**Q6.** Which of the following best exercises "least operational
overhead" as a decision criterion between two functionally equivalent
options?

A. Choosing a self-managed Kafka cluster over Amazon MSK because it's
marginally cheaper at very large scale
B. Choosing Amazon MSK over a self-managed Kafka cluster for a team
without deep, current Kafka operations experience
C. Choosing the option with more configuration knobs, on the theory
that more control is always better
D. Choosing whichever option the team already has documentation for,
regardless of ongoing burden

<details><summary>Answer</summary>

**B is correct** — Operational Excellence specifically favors the
option that reduces ongoing operational burden (patching, scaling,
failure recovery) when the functional requirement is met either way.
**A** trades a small cost saving for materially higher operational
burden — a Cost Optimization move made at Operational Excellence's
expense, which the framework doesn't recommend doing by default.
**C** conflates "more control" with "better" — Well-Architected
explicitly favors managed simplicity unless the extra control solves a
real, named requirement. **D** optimizes for short-term familiarity
over long-term operational cost, the same trap Senior-Level interview
question analysis (see `08-interview/Senior-Level.md` Q1) calls out
directly.
</details>

**Q7.** A scenario asks which logging configuration change is needed to
satisfy an auditor's request to "prove exactly which principal read a
specific confidential object in the last 90 days." Which pillar is
being tested, and what's the answer?

A. Reliability — enable Multi-AZ on the bucket's underlying storage
B. Security — enable CloudTrail data events for the bucket (or prefix)
in question
C. Performance Efficiency — enable S3 Transfer Acceleration
D. Cost Optimization — switch the bucket to S3 Intelligent-Tiering

<details><summary>Answer</summary>

**B is correct** — this is the Security pillar's traceability
principle in its most literal exam form: proving "who did what" to a
specific object requires CloudTrail **data events**, which are opt-in
and must be enabled specifically for this to be answerable at all.
**A**, **C**, and **D** are all real AWS features but address
availability, transfer speed, and storage cost respectively — none of
them produce an audit trail of object-level reads, and picking one is
a sign of matching a familiar-sounding S3 feature to the wrong pillar
instead of reading what the requirement actually asks for.
</details>

---
