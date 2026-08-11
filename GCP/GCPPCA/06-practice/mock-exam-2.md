# Mock Exam 2 (40 questions, domain-weighted)

> Same weighting approach as Mock Exam 1: Domain 1 (10), Domain 2 (6),
> Domain 3 (8), Domain 4 (7), Domain 5 (4), Domain 6 (5), plus a
> case-study cluster covering Helicopter Racing League and TerramEarth.
> Different questions from Mock Exam 1 — don't skip this thinking it's
> a repeat.

---

### Section A — Domain 1 (Designing and Planning)

**Q1.** A scenario states a workload's data volume and write scale will
never exceed a single region's needs, but asks for the "most advanced"
database available. What should you recommend?

A. Cloud Spanner multi-region, because it's the most advanced option
B. Cloud SQL or a regional Spanner config, matched to the actual stated scale
C. Bigtable, regardless of access pattern
D. BigQuery, regardless of access pattern

**Answer: B.** Match the design to stated requirements, not to which
option "sounds" most advanced — the over-engineering trap (Domain 1
§1.3, `00-START-HERE/EXAM-TRAPS-AND-MNEMONICS.md` #1). A is the trap
itself. C and D don't fit a general OLTP access pattern without a
stated reason.

**Q2.** Which best translates "we can't lose customer data" into a
technical requirement?

A. 99.9% availability SLA
B. A specific, near-zero RPO target
C. A support-ticket SLA
D. A cost ceiling

**Answer: B.** "Can't lose data" is a data-loss-tolerance statement,
which maps to RPO, not availability/uptime (Domain 1 §1.1's
requirement-translation table). A addresses uptime, a different axis
entirely. C and D are unrelated translations.

**Q3.** A team says "we already have deep Kubernetes operational
expertise and need custom GPU node pools." Best compute fit?

A. GKE Autopilot
B. GKE Standard
C. Cloud Run
D. Cloud Functions

**Answer: B.** Standard preserves the node-level control (custom GPU
pools) the team's existing expertise wants to use (Domain 1 §1.3
Tree 1). A intentionally removes that control. C and D don't support
this level of node customization at all.

**Q4.** Which migration strategy fits "replace our self-hosted email
system with a mature SaaS provider"?

A. Rehost
B. Refactor
C. Repurchase
D. Retain

**Answer: C.** A mature SaaS replacement for a commodity capability is
the textbook Repurchase case (Domain 1 §1.4). A and B both assume the
existing system moves/changes rather than being replaced outright. D
contradicts the stated intent to replace it.

**Q5.** A scenario wants centralized network governance across many
teams that are comfortable sharing IP space under one administrative
umbrella. Best pattern?

A. 12 independent VPCs
B. Shared VPC
C. VPC Peering mesh
D. No network topology decision is needed

**Answer: B.** Matches Domain 1 §1.3 Pattern A directly — centralized
governance, shared IP space, decentralized project ownership. A gives
strong isolation the scenario doesn't ask for. C doesn't provide
centralized governance and doesn't scale. D ignores a real design
decision.

**Q6.** Which region-selection factor should override the others when
explicitly stated in a scenario?

A. Cost
B. Data residency/compliance
C. Marketing preference
D. Which region GCP announced most recently

**Answer: B.** Residency/compliance is a hard, non-negotiable
constraint once stated (Domain 1 §1.3's region-strategy ranking). A
is a real factor but subordinate when compliance is explicitly stated.
C and D are not legitimate architectural factors.

**Q7.** A scenario states "~2 million IoT devices reporting telemetry
continuously." Which storage tier does this scale signal point to?

A. Cloud SQL
B. Bigtable
C. Firestore alone
D. Memorystore alone

**Answer: B.** Matches the storage decision tree's scale-recognition
guidance (Tree 2) and the TerramEarth case study directly. A doesn't
fit this write-throughput/scale profile. C and D aren't designed for
this access pattern/scale as the primary system of record.

**Q8.** Which best describes when Domain 1's "future improvements"
subsection (§1.5) applies, versus §1.2 (technical requirements)?

A. They're the same thing
B. §1.2 is about meeting current stated requirements; §1.5 is about judgment-based recognition of when a design should evolve later
C. §1.5 only applies to security topics
D. §1.5 always requires an immediate re-architecture

**Answer: B.** Matches Domain 1's own structure. A conflates two
distinct subsections. C is too narrow. D misstates §1.5 — it's about
recognizing *when* to revisit, not mandating immediate change.

**Q9.** A scenario states a fixed launch date is non-negotiable, and the
application is stable and well-understood. Fastest, lowest-risk
migration approach?

A. Refactor
B. Rehost
C. Repurchase
D. Retire

**Answer: B.** Fastest, lowest-risk given a hard deadline and a
stable, well-understood app (Domain 1 §1.4). A is the slowest, highest
-risk option. C assumes an unstated SaaS replacement. D contradicts a
scenario about migrating (not decommissioning) the workload.

**Q10.** Which best captures the correct scope for a Domain 1 answer
addressing "our board is worried about single-vendor dependency"?

A. Abandon all managed services entirely
B. Favor open standards/portable technology (Kubernetes, Terraform, standard SQL) where a viable alternative exists, without abandoning managed infrastructure altogether
C. Ignore the concern — it's not a real architectural factor
D. Migrate to a different cloud provider immediately

**Answer: B.** Matches Domain 1 §1.1's portability tradeoff table —
balanced response, not an overcorrection. A is a disproportionate
response. C dismisses a real, stated business concern. D isn't what
the scenario is asking for (reducing dependency, not eliminating GCP
entirely).

---

### Section B — Domain 2 (Managing and Provisioning)

**Q11.** Which is the correct provisioning-time mechanism for blocking
a non-compliant Terraform change before it ever creates a resource?

A. A post-deployment audit
B. Org Policy constraints enforced in the CI/CD pipeline before apply (shift-left)
C. A manual code review with no automated check
D. Nothing — compliance is checked only after an incident

**Answer: B.** Matches Domain 2 §2.3's shift-left security principle
exactly. A and D are both reactive, after-the-fact approaches. C lacks
the automated enforcement the scenario implies is needed at scale.

**Q12.** A scenario describes provisioning a Cloud SQL instance that
will scale from tens to thousands of connections. Correct provisioning
addition?

A. Continuously raise `max_connections`
B. A connection pooler (Cloud SQL Auth Proxy/PgBouncer)
C. Switch immediately to Spanner regardless of consistency needs
D. Add read replicas to handle writes

**Answer: B.** The standard mitigation before hitting Cloud SQL's hard
connection ceilings (Domain 2 §2.2). A has a hard ceiling regardless.
C is disproportionate without a stated consistency/scale need. D
doesn't address write-connection scaling.

**Q13.** Which Cloud Storage setting simplifies IAM to a single,
auditable policy surface per bucket?

A. Legacy per-object ACLs
B. Uniform bucket-level access
C. No access control
D. Per-object individual IAM policies

**Answer: B.** The recommended production default (Domain 2 §2.2). A
and D fragment the policy surface. C is a security anti-pattern absent
an explicit public-content need.

**Q14.** A scenario wants monitoring dashboards and alert policies
created via the same pipeline as the compute resources they monitor.
What principle is this?

A. "Observability by default"
B. Manual post-incident configuration
C. Alerting cannot be defined as code
D. Observability is unrelated to provisioning

**Answer: A.** Directly from Domain 2 §2.3. B is the anti-pattern being
avoided. C is factually incorrect. D misses the entire point of the
principle.

**Q15.** Which GKE variant requires explicit node pool provisioning
(machine types, sizing) as part of the Terraform configuration?

A. GKE Autopilot
B. GKE Standard
C. Neither — both are fully managed with no node config
D. Both require identical provisioning

**Answer: B.** Matches `02-services/01-compute.md`'s comparison table.
A manages nodes invisibly. C is factually incorrect for Standard. D
is factually incorrect — they differ meaningfully in provisioning
surface.

**Q16.** Why is Auto-mode VPC generally the wrong choice for a
production network expecting future hybrid connectivity?

A. It has no downside at all
B. Its predetermined subnet ranges per region can conflict with on-prem address space or limit future design flexibility
C. It cannot have firewall rules
D. It costs more than custom-mode

**Answer: B.** Matches Domain 2 §2.1's stated concern. A contradicts
the domain's own guidance. C and D are factually incorrect.

---

### Section C — Domain 3 (Security and Compliance)

**Q17.** Which best matches the purpose of VPC Service Controls versus
firewall rules?

A. They solve the same problem and are interchangeable
B. VPC-SC stops exfiltration via API calls to the wrong destination (even by an authenticated identity); firewall rules control network-layer traffic — different threats, often both needed
C. Firewall rules are a superset of VPC-SC functionality
D. VPC-SC only applies to Compute Engine

**Answer: B.** Matches `03-comparisons/06-iam-security-models.md`'s
control-mechanism matrix exactly. A conflates two distinct threat
models. C reverses the actual relationship — neither is a superset of
the other. D is factually incorrect — VPC-SC applies to GCP
services/APIs broadly, not just Compute Engine.

**Q18.** A scenario needs org-wide "no service-account keys can ever be
created" enforcement, with zero exceptions, regardless of any
project's IAM grants. Correct mechanism?

A. IAM Conditions per project
B. Organization Policy constraint (`iam.disableServiceAccountKeyCreation`) at the org level
C. A firewall rule
D. Manual monthly audits of key creation events

**Answer: B.** The specific, purpose-built Org Policy constraint for
this exact rule (`02-services/04-security-iam.md`). A is per-project
and exception-prone, not org-wide/zero-exception. C is unrelated. D
is reactive, not preventive.

**Q19.** Which scenario correctly calls for CSEK or Cloud EKM rather
than CMEK?

A. "We want to rotate our own keys but don't mind Google hosting them"
B. "Key material must never touch Google's infrastructure at all"
C. "We're fine with Google's default encryption"
D. "We want the simplest possible encryption setup"

**Answer: B.** This is the specific, narrower requirement that
justifies CSEK/EKM's higher operational burden
(`02-services/04-security-iam.md`). A describes CMEK exactly. C
describes the Google-managed default. D also points away from
CSEK/EKM, which is the least "simple" option.

**Q20.** Which logging feed specifically shows Google personnel's own
access to customer content, distinct from customer-side activity?

A. Data Access logs
B. Access Transparency
C. System Event logs
D. Policy Denied logs

**Answer: B.** Purpose-built for exactly this visibility (Domain 3
§3.2). A, C, and D all record different categories of customer-side or
system-side activity, not Google-personnel access specifically.

**Q21.** A scenario wants to publish an internal microservice for
private consumption by a different business unit's VPC, with the
smallest possible network exposure. Correct mechanism?

A. Full VPC Peering
B. Private Service Connect
C. A public endpoint with an allowlist
D. Opening the service to 0.0.0.0/0 with a strong password

**Answer: B.** Smallest blast radius — exposes exactly one service
(`02-services/03-networking.md`). A exposes the whole network. C and D
both expose the service publicly, contradicting "smallest possible
exposure."

**Q22.** Which is the correct interpretation of IAM's grant model?

A. IAM supports rich, general-purpose deny rules as the primary mechanism
B. IAM is additive-only by default, with a narrower IAM Deny mechanism for specific org-wide guardrails — routine restriction is handled by Organization Policy instead
C. IAM and Organization Policy are the same mechanism
D. IAM bindings automatically expire after 90 days

**Answer: B.** Matches Domain 3 §3.1's IAM model description exactly.
A overstates IAM Deny's role — it's narrow, not the primary
restriction mechanism. C conflates two distinct mechanisms. D is
factually incorrect — no such default expiration exists.

**Q23.** A scenario requires securing a new generative-AI feature's
training data, which contains customer PII, before it reaches a
Vertex AI training job. What should happen first?

A. Train the model, then encrypt the resulting weights
B. Run Cloud DLP de-identification/tokenization on the training data before it reaches the training pipeline
C. Skip data protection since it's "just training data"
D. Rely solely on IAM restricting who can view the trained model

**Answer: B.** PII handling belongs before training-data export, per
the Securing AI guidance and the data-pipeline pattern in
`04-architectures/pattern-data-analytics-pipeline.md`. A protects the
wrong asset (weights, not the source PII) and doesn't prevent the PII
from being embedded in training. C dismisses a real compliance risk.
D doesn't address the underlying data-protection requirement at the
source.

**Q24.** Which best describes Assured Workloads' value proposition
compared to manually assembling equivalent controls?

A. It's always cheaper in every case
B. It's pre-mapped to a named compliance regime, providing a faster and more audit-defensible path to alignment
C. It replaces the need for IAM entirely
D. It only works for HIPAA specifically

**Answer: B.** Matches Domain 3 §3.2's tradeoff table. A isn't the
stated differentiator (speed/defensibility is). C is factually
incorrect — IAM still applies underneath. D is factually incorrect —
Assured Workloads supports multiple named regimes.

---

### Section D — Domain 4 (Analyzing and Optimizing)

**Q25.** A scenario says a Dataflow pipeline's cost is growing
unexpectedly. What should be checked first?

A. Autoscaling worker caps and windowing/trigger configuration
B. Immediately switching to an unrelated batch tool
C. Deleting the pipeline
D. Raising the budget alert threshold to silence the warning

**Answer: A.** Matches Domain 4 §4.3's Dataflow optimization guidance
— diagnose the actual driver first. B doesn't diagnose the cause. C
removes needed functionality. D masks the symptom rather than
addressing the cause.

**Q26.** Which correctly distinguishes toil from ordinary operational
work?

A. All operational work is toil
B. Toil is specifically recurring, manual work that should be automated once recognized
C. Toil only refers to security incidents
D. Toil is unavoidable and shouldn't be addressed

**Answer: B.** Matches Domain 4 §4.3's DevOps/SRE section exactly. A
over-generalizes. C is too narrow. D contradicts the SRE principle
being tested.

**Q27.** Which best describes the correct application of Committed Use
Discounts?

A. Apply to every workload regardless of load pattern
B. Apply specifically to steady, predictable baseline load
C. Apply only to Preemptible/Spot VMs
D. Never apply them — they're always worse than on-demand

**Answer: B.** Matches the cost-optimization table (Domain 4 §4.3). A
misapplies CUDs to workloads that don't benefit. C conflates two
distinct, non-overlapping discount mechanisms. D is factually
incorrect for the intended use case.

**Q28.** A scenario describes a repeatedly-run, expensive BigQuery
aggregation query. Best optimization?

A. Running it manually each time
B. A materialized view
C. Increasing the query timeout
D. Switching data warehouses entirely

**Answer: B.** Reduces both cost and latency for exactly this pattern
(`02-services/05-data-analytics-ai.md`). A doesn't optimize anything.
C addresses a different problem. D is disproportionate.

**Q29.** Which best matches Domain 4's "dual-constraint" framing of
cost questions?

A. Cost should always be minimized with no other consideration
B. Cost should be minimized subject to not violating a stated SLA/SLO or other hard constraint
C. Cost is untestable on this exam
D. The cheapest single service is always correct, regardless of fit

**Answer: B.** Matches Domain 4 exam trap #1 exactly. A, C, and D each
miss the dual-constraint nature this domain consistently tests.

**Q30.** A Vertex AI model's production accuracy has silently degraded
over time with no code changes. What should have caught this?

A. Cloud Armor
B. Vertex AI Model Monitoring
C. Terraform state drift detection
D. Cloud NAT

**Answer: B.** Purpose-built for training/serving skew and data drift
detection (`02-services/05-data-analytics-ai.md`). A and D are
unrelated services. C detects infrastructure config drift, a different
"drift" concept entirely — a common distractor pairing.

**Q31.** A scenario wants ongoing, automated discovery of idle/
unattached resources without a dedicated FinOps team. Best fit?

A. Recommender API
B. A manual quarterly spreadsheet audit
C. Deleting all disks preemptively without review
D. Ignoring idle resources

**Answer: A.** The automated, ongoing mechanism for exactly this
(`02-services/06-management-operations.md`). B is manual/infrequent. C
is destructive without verification. D ignores an addressable cost
driver.

---

### Section E — Domain 5 (Managing Implementation)

**Q32.** A scenario needs a declarative, human-reviewable diff before
every infrastructure change reaches production. Which capability is
being described?

A. Console's change history
B. `terraform plan` output
C. A verbal status update
D. Manually comparing two Console screenshots

**Answer: B.** Purpose-built for exactly this (Domain 5 §5.2, Tree 6).
A doesn't provide a structured pre-change diff. C and D are informal
and don't scale.

**Q33.** Which best fits "team wants a legacy monolith containerized
with minimal code change, not a full rewrite"?

A. Full microservices refactor
B. Containerize largely as-is (Replatform-style), deploy to Cloud Run/GKE
C. Rewrite from scratch in a new language
D. Refuse to migrate without rewrite funding

**Answer: B.** Matches Domain 5 §5.1's guidance and the "minimal
change" constraint directly. A and C both ignore the explicit
minimal-change constraint (over-engineering trap). D isn't a valid
recommendation.

**Q34.** What is the correct, fast rollback mechanism for a bad Cloud
Run deployment?

A. Rebuild and redeploy from scratch
B. Shift traffic back to the prior revision via traffic splitting
C. Delete and recreate the service
D. Manually edit files inside the running container

**Answer: B.** Revisions remain addressable — rollback is a fast
traffic-split change (Domain 5 §5.1, Domain 4 §4.3). A and C are
slower/unnecessary. D isn't appropriate for a managed serverless
platform.

**Q35.** Which tool-selection rule applies when a scenario states
"needs to be safe, reviewed, and repeatable across environments"?

A. Console/ClickOps
B. Terraform in CI/CD with plan review
C. Ad hoc `gcloud` commands by whoever is available
D. A shared manual-steps document

**Answer: B.** Matches Tree 6 and Domain 5 §5.2's decision rules
directly. A, C, and D each lack repeatability, review, or both.

---

### Section F — Domain 6 (Ensuring Reliability)

**Q36.** A Global External LB sits in front of a single-region
database. Does this alone deliver regional DR?

A. Yes, the LB alone is sufficient
B. No — the data layer must also be able to fail over for the pattern to work
C. Yes, because Cloud SQL is multi-region by default
D. Global load balancers don't exist in GCP

**Answer: B.** Matches Domain 6 exam trap #4 — LB and data tiers must
be designed together. A ignores the data layer. C is factually
incorrect. D is factually incorrect.

**Q37.** Which Dataflow concept correctly handles late-arriving,
out-of-order data without dropping it?

A. Ignoring timestamps
B. Windowing + watermarks + triggers tuned for late data
C. Switching to pure batch processing
D. Adding more Bigtable nodes

**Answer: B.** Matches Domain 6 §6.2 and the TerramEarth case study
directly. A would misprocess the data. C loses the real-time
capability likely still needed. D is unrelated to a Dataflow
windowing configuration issue.

**Q38.** Which best describes Compute Engine's default maintenance
behavior?

A. VMs are deleted for maintenance
B. Live migration to different hardware, transparently, for most machine types
C. VMs are stopped and must be manually restarted
D. No maintenance mechanism exists

**Answer: B.** Matches Domain 6 §6.2 exactly. A, C, and D all misstate
the actual default behavior.

**Q39.** A scenario needs long-term, tamper-evident log retention for a
multi-year compliance audit. Correct configuration?

A. Default Cloud Logging retention
B. Cloud Storage sink with a retention policy/Bucket Lock
C. No logging configuration needed
D. A log-based metric alone

**Answer: B.** Matches Domain 6 §6.1's sink-selection guidance. A's
default retention is time-limited. C ignores a stated requirement. D
produces a metric, not a retained record.

**Q40.** Which best matches the correct process for validating a DR
plan over time, rather than assuming it still works?

A. A one-time architecture review at design time only
B. Scheduled DR drills measuring actual RTO/RPO, feeding findings back into runbook updates
C. Trusting the architecture diagram without further verification
D. Waiting for a real disaster to test it for the first time

**Answer: B.** Matches Domain 4 §4.1's process guidance and Lab 5's
methodology — ongoing, measured drills. A, C, and D each substitute a
one-time or untested assumption for actual verification.

---

## Case-study cluster (embedded — Helicopter Racing League and TerramEarth)

**Q41 (Helicopter Racing League).** HRL provisions infrastructure sized
for race-day peak load and runs it at that size continuously, even
between events. What's the issue?

A. There is no issue — always-on peak capacity is the safest choice
B. It overspends significantly during the 90%+ of time between events, when scheduled/reactive autoscaling with scale-to-zero-capable tiers would fit HRL's bursty, event-driven load pattern
C. Race-day traffic is actually steady, not bursty, so this is correct
D. HRL has no cost constraints stated in its profile

**Answer: B.** The case study's signature "always-on capacity" trap
(`04-architectures/case-study-helicopter-racing-league.md`). A ignores
the cost-efficiency constraint central to this case study's profile. C
mischaracterizes HRL's load pattern, which is explicitly bursty/
event-driven. D is incorrect — cost efficiency between events is
listed among HRL's primary constraints.

**Q42 (TerramEarth).** A TerramEarth Dataflow pipeline uses default
windowing that drops any data arriving after a window closes. What's
the consequence, given TerramEarth's device fleet?

A. No consequence — all devices report on a perfectly reliable schedule
B. Data from the most disconnected, intermittently-connected devices is systematically lost — often the equipment most valuable to monitor for predictive maintenance
C. This only affects a negligible fraction of devices and can be safely ignored
D. Bigtable automatically recovers any data dropped by Dataflow

**Answer: B.** The case study's "steady-stream assumption" trap
(`04-architectures/case-study-terramearth.md`) — TerramEarth's defining
characteristic is intermittent connectivity, making late-arriving data
the normal case, not an edge case. A contradicts the case study's core
profile. C understates a systematic, not negligible, data-loss pattern.
D is factually incorrect — Bigtable has no mechanism to recover data
that Dataflow never wrote to it.

---

## Scoring guide

- **36–42 correct**: Exam-ready; compare weak spots against Mock Exam 1
  to confirm they aren't the same recurring gap.
- **28–35 correct**: Review every wrong answer's rationale, then revisit
  `03-comparisons/` for the specific matrices those questions drew on.
- **Below 28**: Return to `00-START-HERE/STUDY-PLAN.md` Days 20–23
  (case-study integration) before re-attempting either mock exam.
