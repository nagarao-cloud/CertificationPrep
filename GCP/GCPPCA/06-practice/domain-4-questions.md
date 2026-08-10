# Practice Questions — Domain 4: Analyzing and Optimizing (~18% weight)

> 20 questions, every option explained.

---

**Q1.** A team wants to balance shipping velocity against reliability
using a defined, measurable policy. What mechanism should they adopt?

A. Ship features as fast as possible regardless of incident rate
B. An SLO with an error-budget policy that throttles feature velocity when the budget is burned
C. Freeze all releases permanently after any incident
D. Let each engineer decide individually when to slow down

**Answer: B.** Matches Domain 4 §4.1's error-budget-policy pattern
exactly — a measurable, pre-agreed mechanism, not an ad hoc or
all-or-nothing response. A ignores reliability entirely. C is an
overcorrection with no mechanism for recovery. D lacks the "defined,
measurable" property the question asks for.

---

**Q2.** Which is the correct automated mechanism for surfacing ongoing
cost-saving opportunities without a dedicated FinOps team constantly
watching bills?

A. A one-time manual cost review
B. Recommender API, combined with automated policies for low-risk suggestions
C. Ignoring cost until it becomes a problem
D. Manually inspecting every VM's utilization graph weekly

**Answer: B.** Matches Domain 4 §4.2 — turns cost optimization into an
ongoing automated process (Domain 4's "continuous improvement"
philosophy). A is one-time, not ongoing. C ignores the stated goal
entirely. D doesn't scale and isn't automated.

---

**Q3.** A scenario states a workload is fault-tolerant and
interruption-tolerant, with cost as the top priority. What compute
purchasing option fits?

A. On-demand pricing
B. Preemptible/Spot VMs
C. 3-year resource-based Committed Use Discount
D. Sole-tenant nodes

**Answer: B.** Matches Domain 4 §4.3's cost-optimization table — Spot
pricing is the deepest discount for genuinely interruption-tolerant
workloads. A leaves the largest discount opportunity unused. C assumes
steady, predictable load, not stated here, and locks in a commitment
inappropriate for a workload description that doesn't establish
steady baseline usage. D is for licensing/isolation needs, unrelated
to the stated cost priority.

---

**Q4.** Which release pattern best fits "validate a risky change on a
small percentage of real production traffic before full exposure"?

A. Big-bang rollout to 100% of traffic
B. Canary deployment with traffic splitting
C. Blue/green with an instant full cutover
D. Freezing all deployments until the next major version

**Answer: B.** Matches Domain 4 §4.3's release-management table
directly — canary limits blast radius to a small % of real traffic.
A is the opposite of the stated goal. C is a valid pattern but
switches all traffic at once rather than progressively, not matching
"small percentage... before full exposure." D doesn't address the
question of how to release safely at all.

---

**Q5.** What does the Carbon Footprint tool provide, and when is it
the correct exam answer?

A. Cost breakdown by team — use it for chargeback
B. Gross/net emissions reporting per project/service — use it whenever a scenario asks to report cloud carbon footprint
C. Security vulnerability scanning — use it for compliance audits
D. Autoscaling configuration — use it for performance tuning

**Answer: B.** Matches Domain 4 §4.2 and
`02-services/06-management-operations.md`. A, C, and D each describe
an unrelated capability (billing export/labels, Artifact Registry
scanning, and HPA/MIG autoscaler respectively).

---

**Q6.** A scenario mentions sustainability as a goal and gives latitude
on region choice, but also states a hard data-residency requirement.
What should the sustainability consideration do?

A. Override the residency requirement if the greener region is outside the required jurisdiction
B. Act only as a tiebreaker among regions that already satisfy the residency requirement
C. Be ignored entirely since residency was mentioned
D. Force a redesign of the residency requirement itself

**Answer: B.** Matches Domain 4 §4.2's tradeoff table — sustainability
is a legitimate tiebreaker, never an override of a harder constraint.
A directly violates the residency requirement (Domain 3 crossover). C
overcorrects — sustainability should still be applied where it doesn't
conflict. D isn't within the architect's authority — requirements are
given, not renegotiated by the design.

---

**Q7.** Which best distinguishes Domain 4's "technical processes"
(§4.1) from Domain 6's implementation of monitoring/alerting?

A. They are identical and interchangeable
B. Domain 4 defines the policy/cadence (what SLOs matter, error-budget policy, testing strategy); Domain 6 implements the specific Cloud Monitoring/Logging configuration
C. Domain 6 always precedes Domain 4 in every scenario
D. Domain 4 only concerns itself with pricing

**Answer: B.** Matches Domain 4 §4.1's explicit framing and Domain 6's
own introduction. A conflates two related but distinct domains. C
reverses no consistent ordering — process definition and
implementation can be discussed independently. D is far too narrow
— Domain 4 covers process/optimization broadly, not just pricing.

---

**Q8.** A Vertex AI model-serving endpoint has highly variable traffic
throughout the day. What's the correct cost/performance optimization?

A. A fixed, always-on replica count sized for peak
B. Autoscaling with tuned min/max replica counts
C. Shutting the endpoint down every night manually
D. Ignoring traffic patterns since Vertex AI billing is flat-rate

**Answer: B.** Matches Domain 4 §4.3's Vertex AI optimization table —
the same autoscaling principle applied to compute generally, applied
here to model serving specifically. A overspends at trough. C is
manual, error-prone, and risks availability during actual off-hours
demand. D is factually incorrect — Vertex AI serving is not flat-rate
billed regardless of usage.

---

**Q9.** What is "toil," and what's the correct Domain 4 response to
recognizing it in a scenario?

A. Toil is unavoidable and should be accepted as the cost of operations
B. Toil is recurring, manual operational work that should be automated once recognized
C. Toil only applies to security tasks
D. Toil is a synonym for technical debt with no distinct meaning

**Answer: B.** Matches Domain 4 §4.3's DevOps/SRE practices section —
recognizing repeated manual work is a signal to automate, not staff up
to do it faster. A contradicts the SRE principle being tested. C is
too narrow — toil applies to any recurring manual ops work. D
conflates two related-but-distinct SRE/engineering concepts.

---

**Q10.** Which billing/cost mechanism is the foundation for showback/
chargeback reporting joined against other operational data?

A. The built-in Billing console reports alone
B. Billing export to BigQuery, combined with resource labels
C. Manually tallying invoices each month
D. Recommender API alone

**Answer: B.** Matches Domain 4 §4.2 — export + labels is what enables
custom joins (cost per feature/team) beyond the built-in reports. A is
more limited — good for basic viewing, not custom analysis. C doesn't
scale and isn't the described mechanism. D finds savings opportunities
but isn't itself a showback/chargeback reporting mechanism.

---

**Q11.** A scenario describes Dataflow pipeline costs growing
unexpectedly. Which optimization should be checked first per Domain 4
§4.3?

A. Switching the entire pipeline to a batch tool unrelated to the actual issue
B. Autoscaling worker caps and windowing/trigger configuration tuned to avoid unnecessary reprocessing
C. Deleting the pipeline entirely
D. Increasing the Dataflow project's budget alert threshold to silence the warning

**Answer: B.** Matches Domain 4 §4.3's Dataflow optimization guidance
directly. A doesn't diagnose the actual cause. C removes needed
functionality rather than optimizing it. D masks the symptom (the
alert) without addressing the underlying cost driver — the opposite of
what a cost-optimization question is testing.

---

**Q12.** Which best describes when Committed Use Discounts should be
applied, per Domain 4 §4.3?

A. To every workload regardless of load pattern
B. To steady, predictable baseline load specifically — not to variable/spiky workloads
C. Only to Preemptible VMs
D. Never — they are always a worse deal than on-demand

**Answer: B.** Matches the cost-optimization table exactly. A
over-applies CUDs to workloads where they don't fit (variable load
doesn't benefit and risks paying for unused commitment). C is
incorrect — CUDs and Preemptible/Spot are different, non-overlapping
discount mechanisms. D is factually wrong for the intended use case
(steady load).

---

**Q13.** A scenario states an incident recurs repeatedly with the same
root cause each time. What does Domain 4's process-analysis guidance
recommend?

A. Continue responding manually each time it recurs
B. Conduct a blameless postmortem and invest in preventing the root cause, feeding back into technical-process design
C. Assign blame to the engineer on call during the most recent occurrence
D. Ignore it since it's "just" an incident, not a design problem

**Answer: B.** Matches Domain 4 §4.2's incident-management guidance
— recurring incidents are a signal to invest in prevention, closing
the loop with §4.1's technical-process design. A treats a systemic
issue as a one-off, missing the pattern. C contradicts the blameless-
postmortem principle central to mature incident management. D misses
that a recurring incident is exactly a design-level signal, not
something to dismiss.

---

**Q14.** Which technique reduces both cost and latency for a
repeatedly-run expensive BigQuery aggregation query?

A. Running the same query manually every time it's needed
B. A materialized view that incrementally maintains the precomputed result
C. Increasing the on-demand query timeout
D. Switching to a completely different data warehouse

**Answer: B.** Matches `02-services/05-data-analytics-ai.md`'s
materialized views guidance, cited here as a Domain 4 optimization.
A doesn't reduce cost or latency at all. C addresses a different
problem (timeouts), not cost/performance. D is a disproportionate
response to a solvable optimization problem within the existing stack.

---

**Q15.** A scenario emphasizes DevOps maturity and asks how to reduce
manual toil in infrastructure changes specifically. What's the Domain
2/4 crossover answer?

A. Hire more engineers to perform the same manual changes faster
B. Automate infrastructure changes via IaC (Terraform) in a CI/CD pipeline, removing manual repetitive steps
C. Require every change to go through a lengthy manual approval chain regardless of risk
D. Avoid making infrastructure changes at all

**Answer: B.** Matches the toil-reduction principle (Domain 4 §4.3)
applied specifically to infrastructure changes (Domain 2 §2.3
crossover). A doesn't reduce toil, just its per-instance cost. C adds
process overhead without addressing the manual-repetition problem. D
isn't a realistic response to a business that needs to evolve its
infrastructure.

---

**Q16.** Which best captures the "dual-constraint" nature of most
Domain 4 cost questions?

A. Cost questions are pure minimization problems with no other factor
B. Cost should be minimized *subject to* not violating a stated SLA/SLO or other hard constraint
C. Cost is never actually tested on the exam
D. Cost optimization always means choosing the cheapest single service, regardless of fit

**Answer: B.** Matches Domain 4 exam trap #1 exactly. A misses the
dual-constraint framing this domain consistently tests. C is false —
Domain 4 is 18% of the exam and heavily cost-focused. D ignores fit-
for-purpose, a recurring theme across every comparison matrix in this
folder.

---

**Q17.** A scenario describes a Vertex AI model whose accuracy has
degraded in production over time without any code change. What
mechanism should have caught this?

A. Cloud Armor
B. Vertex AI Model Monitoring (training/serving skew and data drift detection)
C. Cloud NAT
D. Terraform state drift detection

**Answer: B.** Matches `02-services/05-data-analytics-ai.md`'s Model
Monitoring section directly — this is the ML-specific reliability/
optimization mechanism for exactly this symptom. A and C are
unrelated networking/security services. D detects infrastructure
configuration drift, not model accuracy drift — a common exam
distractor pairing similar-sounding "drift" concepts from different
domains.

---

**Q18.** Which best describes the relationship between rightsizing
recommendations and SLO/error-budget policy, per the cost/performance
feedback loop pattern in Domain 4?

A. Rightsizing recommendations should always be applied immediately regardless of reliability impact
B. Rightsizing recommendations should be validated against SLO headroom before being applied — don't rightsize below what the error-budget policy requires
C. SLOs and cost optimization are unrelated and evaluated independently
D. Rightsizing should never be applied to production systems

**Answer: B.** Matches the production architecture pattern in Domain 4
(`01-domains/DOMAIN-4-analyzing-optimizing.md`'s feedback-loop diagram)
exactly — the gating step is explicit. A skips the necessary safety
check. C misses the dual-constraint relationship (see Q16). D is an
overcorrection — rightsizing IS meant to apply to production, just with
the stated validation step.

---

**Q19.** A scenario states a company wants savings automatically
identified for idle/unattached resources. What should be provisioned?

A. Recommender API's idle-resource recommendations
B. A manual quarterly spreadsheet audit
C. Deleting all disks preemptively without review
D. Ignoring idle resources as immaterial

**Answer: A.** Matches `02-services/06-management-operations.md`'s
Recommender API table — the automated, ongoing mechanism for exactly
this. B is manual and infrequent, not automatic. C is destructive
without verification — could delete something still needed. D ignores
a real, addressable cost driver the scenario explicitly raised.

---

**Q20.** Which of the following is the best example of Domain 4's
"continuous improvement" philosophy, as opposed to a one-time fix?

A. Manually reviewing costs once after a budget overrun, then never again
B. An automated pipeline (Recommender API findings → SLO-headroom validation → Terraform PR) that surfaces and safely applies optimizations on an ongoing basis
C. Fixing a specific incident's root cause and considering the process complete
D. Setting a fixed budget and taking no further action once it's set

**Answer: B.** This is the concrete, ongoing-process version of Domain
4's philosophy (matches the production pattern in
`01-domains/DOMAIN-4-analyzing-optimizing.md`). A, C, and D are each a
one-time action, missing the "continuous" part of continuous
improvement that Domain 4 specifically tests for.
