# Mock Exam 1 (40 questions, domain-weighted)

> Weighted approximately to RUNBOOK §3's domain weights: Domain 1 (10),
> Domain 2 (6), Domain 3 (8), Domain 4 (7), Domain 5 (4), Domain 6 (5).
> Includes two case-study question clusters (EHR Healthcare, Mountkirk
> Games), mirroring the real exam's 20–30% case-study weight. Every
> option explained. Score yourself, then review every wrong answer's
> full rationale before moving to Mock Exam 2.

---

### Section A — Domain 1 (Designing and Planning)

**Q1.** A global retailer wants to reduce checkout-page latency for
customers in Asia while keeping its US-based backend team's existing
workflow. What's the best first step?

A. Rewrite the entire backend in a new language
B. Deploy a regional presence (compute + CDN) near Asian users, fronted by a global LB
C. Ask Asian customers to use a VPN to the US region
D. Move the entire company to a single Asia-Pacific region

**Answer: B.** Directly addresses the latency problem via placement,
without disrupting the existing team's workflow. A is disproportionate
and unrelated to the latency cause. C shifts the burden to customers,
not a valid architecture answer. D abandons the US team/region without
justification — the scenario didn't ask to leave the US.

**Q2.** A scenario states "our RPO must be zero for financial
transactions, cost is secondary." Which database configuration fits?

A. Cloud SQL, single zone
B. Cloud Spanner, multi-region
C. Firestore, single region
D. Bigtable, single cluster

**Answer: B.** Matches the "explicit near-zero RPO overrides cost"
pattern (Domain 1 §1.1). A and C both have single-point-of-failure
exposure. D isn't the right data model for transactional financial
consistency.

**Q3.** Which migration strategy fits "we want to keep this system
exactly as-is due to a hardware-locked license, indefinitely"?

A. Refactor
B. Retain
C. Repurchase
D. Rehost

**Answer: B.** Textbook Retain — a real, durable, stated constraint
(Domain 1 §1.4). A and D both imply moving the workload, contradicting
"keep exactly as-is." C assumes a SaaS replacement exists, not stated.

**Q4.** A team wants to minimize vendor lock-in per a board directive
while still using managed Kubernetes. Best fit?

A. GKE Standard, open K8s APIs, avoiding unnecessary proprietary GCP APIs
B. App Engine Standard, proprietary datastore APIs throughout
C. A fully custom orchestration platform built from scratch
D. GKE Autopilot, heavy proprietary API usage throughout

**Answer: A.** Matches Domain 1 §1.1's portability tradeoff table. B
and D both lean into proprietary APIs, contradicting the stated
concern. C is a disproportionate response — abandoning all managed
services isn't required to reduce API-level lock-in.

**Q5.** Which best distinguishes availability from resiliency on this
exam?

A. They're synonyms
B. Availability = uptime percentage; resiliency = ability to recover from failure
C. Resiliency only applies to storage
D. Availability only applies to networking

**Answer: B.** Matches Domain 1 §1.2's explicit distinction. A, C, D
all misstate or over-narrow the concepts.

**Q6.** A company needs 12 independent business units strongly
isolated from each other with no shared resource plans. Best network
pattern?

A. One flat VPC
B. Shared VPC, all as service projects
C. 12 independent VPCs
D. Full-mesh VPC Peering across all 12

**Answer: C.** Matches Domain 1 §1.3 Pattern B — strongest isolation,
matches "no plan to share." A and B centralize/share, contradicting
isolation. D doesn't scale (near-quadratic connections) and Peering
isn't transitive.

**Q7.** Petabytes of data need to move to GCP, with a poor network
link. Best transfer method?

A. Storage Transfer Service over the existing link
B. Transfer Appliance
C. Manual file-by-file upload
D. BigQuery Data Transfer Service

**Answer: B.** Matches Domain 1 §1.4's data-transfer table — physical
shipping beats a poor link's transfer time at this scale. A is
bottlenecked by the poor link. C doesn't scale to petabytes. D is for
recurring SaaS-source transfers, not a one-time bulk migration.

**Q8.** A scenario says "internal tool, business hours only, tight
budget, downtime tolerated." Best compute choice?

A. Multi-region GKE Standard, always on
B. Cloud Run with default scale-to-zero
C. Reserved Compute Engine sized for peak, 24/7
D. Cloud Spanner-backed global app

**Answer: B.** Matches the cost/tolerance profile exactly (Domain 1
§1.2). A and C are always-on and costly, contradicting the budget
constraint. D is a database choice, not compute, and disproportionate
regardless.

**Q9.** Which best captures why "multi-region by default" is a
recurring trap?

A. GCP doesn't support multi-region
B. It adds cost/complexity unjustified unless the scenario states a multi-region/global need
C. Multi-region is a Domain 6-only concept
D. Multi-region is always cheaper

**Answer: B.** Matches the over-engineering trap directly
(`00-START-HERE/EXAM-TRAPS-AND-MNEMONICS.md`). A and D are factually
wrong. C understates Domain 1's role in the initial design decision.

**Q10.** A scenario needs private, minimal-exposure consumption of
exactly one partner-provided service. Best fit?

A. Full VPC Peering
B. Private Service Connect
C. Public API + API key only
D. Cloud VPN

**Answer: B.** Purpose-built for exactly this (Domain 1 §1.3). A
over-exposes the network. C isn't private (public internet path). D is
a heavier hybrid-connectivity mechanism, not the standard
service-consumption pattern.

---

### Section B — Domain 2 (Managing and Provisioning)

**Q11.** A team wants repeatable, peer-reviewed infrastructure changes.
Best tool?

A. Console with after-the-fact documentation
B. Terraform, plan reviewed in a PR before apply
C. Ad hoc `gcloud` commands
D. Local, unshared Cloud Shell scripts

**Answer: B.** Matches Domain 2 §2.3 exactly — the reviewable-diff,
repeatable pattern. A, C, D all lack either repeatability or review.

**Q12.** What's the production-standard VPC subnet mode?

A. Auto-mode
B. Custom-mode
C. No subnets
D. Auto-mode with ranges deleted after creation

**Answer: B.** Matches Domain 2 §2.1 and exam trap #3. A's fixed /20
ranges aren't a production pattern. C isn't valid for regional
resources. D is unnecessary rework versus starting custom-mode.

**Q13.** Private GKE nodes need outbound internet for image pulls.
Correct provisioning step?

A. Assign external IPs to all nodes
B. Provision Cloud NAT via a Cloud Router
C. Open all inbound firewall ports
D. Self-managed NAT instance VM

**Answer: B.** The managed, exam-correct outbound-only mechanism
(Domain 2 §2.1). A defeats cluster privacy. C is unrelated/regressive.
D is legacy toil versus the managed service.

**Q14.** Which is the correct storage-cost-optimization mechanism for
data that cools off over time?

A. Manual periodic migration between buckets
B. Cloud Storage Lifecycle rules
C. Deleting data after a fixed period regardless of need
D. Leaving everything in Standard class permanently

**Answer: B.** The automated, ops-free mechanism (Domain 2 §2.2). A is
manual. C risks data loss. D wastes budget on cold data.

**Q15.** A GitOps-first, Kubernetes-native team wants GCP resources in
the same reconciliation loop as app manifests. Best tool?

A. Terraform only
B. Config Connector
C. Manual Console configuration
D. Deployment Manager

**Answer: B.** Fits the stated workflow directly (Domain 2 §2.3,
Domain 5 §5.2). A doesn't integrate the same way. C isn't repeatable.
D is legacy.

**Q16.** Why provision hierarchical firewall policies at the folder
level rather than relying on per-VPC rules alone?

A. They're cheaper
B. They can't be overridden by a lower-level project admin, enforcing org-wide guardrails
C. They're the only way to create firewall rules
D. They only work with Auto-mode

**Answer: B.** Matches Domain 2 §2.1's tradeoff table. A isn't the
deciding factor. C and D are factually incorrect.

---

### Section C — Domain 3 (Security and Compliance)

**Q17.** No project admin org-wide should be able to enable external
IPs, even with Owner role. Correct mechanism?

A. IAM Deny scoped to individuals
B. Organization Policy constraint at the org level
C. Per-project firewall rule
D. Remove all Owner bindings

**Answer: B.** Enforced below IAM, cannot be overridden even by Owner
(Domain 3 §3.1). A isn't the standard mechanism for this rule shape. C
controls traffic, not configuration existence. D is impractical and
doesn't address the actual configuration risk.

**Q18.** Correct 2026-era CI/CD-to-GCP credential mechanism?

A. Downloaded service-account JSON key as a CI secret
B. Workload Identity Federation
C. Personal user credentials
D. Shared key emailed between team members

**Answer: B.** No exported long-lived credential (Domain 3 §3.1,
RUNBOOK §7 currency correction). A, C, D are all static/shared-
credential anti-patterns.

**Q19.** Prevent an authenticated, validly-permissioned user from
copying sensitive data to the wrong project. Correct control?

A. IAM alone
B. VPC Service Controls perimeter
C. Stronger password policy
D. Block all outbound traffic via firewall

**Answer: B.** Purpose-built for this exact exfiltration threat model
(Domain 3 §3.1). A already permitted the access. C is irrelevant here.
D breaks legitimate traffic and doesn't address API-layer exfiltration.

**Q20.** "Rotate our own keys, don't want to manage physical HSMs."
Correct encryption choice?

A. Google-managed keys (default)
B. CMEK via Cloud KMS
C. Cloud EKM
D. CSEK for every operation

**Answer: B.** Customer controls rotation/lifecycle; Google still hosts
the backend (Domain 3 §3.1). A gives no customer control. C is a
stronger, unrequested requirement (key material never touching
Google). D has more operational burden than needed.

**Q21.** Fast, defensible path to FedRAMP-aligned infrastructure?

A. Manually assembling equivalent controls
B. Assured Workloads
C. Google-managed keys alone
D. A stronger firewall policy

**Answer: B.** Pre-mapped to the named regime (Domain 3 §3.2). A is
slower/harder to audit. C and D don't address compliance-framework
mapping.

**Q22.** Prove even Google support staff didn't access data without
cause. Correct mechanism?

A. Admin Activity logs
B. Access Transparency
C. VPC Service Controls
D. IAM Conditions

**Answer: B.** Specifically logs Google-side access (Domain 3 §3.2). A
logs customer actions. C and D address different threat models.

**Q23.** GKE pod needs GCP API access. Recommended pattern?

A. Mount a service-account key file
B. Workload Identity
C. Hard-code an API key
D. Broad node-level default service account

**Answer: B.** The keyless, least-privilege GKE pattern (Domain 3
§3.1). A and C are static-credential anti-patterns. D violates
least-privilege across all pods on the node.

**Q24.** Discover and de-identify PII before Vertex AI training. Correct
tool?

A. Cloud Armor
B. Cloud DLP
C. VPC Service Controls
D. Cloud NAT

**Answer: B.** Purpose-built for exactly this (Domain 3 §3.1). A, C, D
are each unrelated to data classification/de-identification.

---

### Section D — Domain 4 (Analyzing and Optimizing)

**Q25.** Balance shipping velocity against reliability with a
measurable policy. Correct mechanism?

A. Ship as fast as possible regardless of incidents
B. SLO + error-budget policy throttling velocity when burned
C. Freeze releases permanently after any incident
D. Individual engineer discretion

**Answer: B.** Matches Domain 4 §4.1's error-budget pattern. A ignores
reliability. C overcorrects with no recovery path. D lacks the
"measurable, defined" property required.

**Q26.** Fault-tolerant, interruption-tolerant workload, cost is top
priority. Best compute purchasing option?

A. On-demand
B. Preemptible/Spot VMs
C. 3-year resource-based CUD
D. Sole-tenant nodes

**Answer: B.** Deepest discount for genuinely interruption-tolerant
work (Domain 4 §4.3). A leaves savings unused. C assumes steady load,
not stated. D is for licensing/isolation, unrelated to the stated
priority.

**Q27.** Validate a risky change on a small % of real traffic before
full exposure. Correct pattern?

A. Big-bang rollout
B. Canary deployment with traffic splitting
C. Blue/green instant cutover
D. Deployment freeze until next major version

**Answer: B.** Matches Domain 4 §4.3 directly. A is the opposite. C
switches all traffic at once, not gradually. D doesn't address the
question.

**Q28.** Report cloud carbon footprint without custom tooling. Correct
service?

A. Billing export to BigQuery
B. Carbon Footprint tool
C. Cloud Armor
D. Recommender API

**Answer: B.** Purpose-built for exactly this (Domain 4 §4.2). A is a
cost-analysis foundation, not emissions reporting. C is a WAF tool. D
finds savings, not emissions data.

**Q29.** Sustainability is a stated goal, but a hard data-residency
requirement also exists. What should sustainability do?

A. Override residency if the greener region is outside the required jurisdiction
B. Act only as a tiebreaker among regions already satisfying residency
C. Be ignored entirely
D. Force a redesign of the residency requirement

**Answer: B.** Sustainability is a tiebreaker, never an override
(Domain 4 §4.2 tradeoff table). A violates a harder constraint. C
overcorrects. D isn't within the architect's authority.

**Q30.** Vertex AI endpoint traffic is highly variable through the day.
Correct optimization?

A. Fixed always-on replica count sized for peak
B. Autoscaling with tuned min/max replicas
C. Manual nightly shutdown
D. Ignore — Vertex AI is flat-rate

**Answer: B.** Matches Domain 4 §4.3's Vertex AI optimization guidance.
A overspends at trough. C is manual/error-prone. D is factually
incorrect.

**Q31.** Recurring incident, same root cause each time. Correct
process response?

A. Keep responding manually each time
B. Blameless postmortem, invest in preventing the root cause
C. Blame the most recent on-call engineer
D. Ignore it as "just an incident"

**Answer: B.** Matches Domain 4 §4.2's incident-management guidance —
a recurring incident is a design-level signal. A treats a systemic
issue as one-off. C contradicts blameless-postmortem principles. D
misses the pattern entirely.

---

### Section E — Domain 5 (Managing Implementation)

**Q32.** External partners need a governed, monetized API with a
developer portal. Correct tool?

A. Cloud Endpoints alone
B. Apigee
C. Raw unmanaged HTTP endpoint
D. Cloud Armor

**Answer: B.** Adds monetization/portal capability Endpoints lacks
(Domain 5 §5.1). A misses the monetization/portal requirement. C
provides no management at all. D is unrelated (edge security tool).

**Q33.** Cloud Run occasionally needs to reach a private Cloud SQL
instance. Required configuration?

A. Public IP on Cloud SQL, all sources allowed
B. Serverless VPC Access connector / direct VPC egress
C. Nothing needed by default
D. Move Cloud SQL to Cloud Storage

**Answer: B.** Required to bridge Cloud Run into the private VPC
(Domain 5 §5.1). A is a security regression. C is factually incorrect.
D isn't a valid substitution.

**Q34.** Recurring, scriptable automation task needing an audit trail.
Best access method?

A. Console clicking
B. Scripted, version-controlled CLI
C. Manual human action each time
D. A shared instructions document

**Answer: B.** Matches Tree 6 — repeatable, auditable via source
control (Domain 5 §5.2). A, C, D each lack repeatability, an audit
trail, or both.

**Q35.** Many teams frequently request new projects needing consistent
baseline configuration. Best pattern?

A. Manual Console setup per request
B. Automated "project factory" pattern
C. Broad Owner access for self-service without guardrails
D. Decline new requests

**Answer: B.** Scales consistently (Domain 5 §5.2). A doesn't scale.
C removes governance (Domain 3 crossover). D avoids the actual need.

---

### Section F — Domain 6 (Ensuring Reliability)

**Q36.** Errors occur immediately after a new pod starts, before it's
warmed up; the pod never restarts. What should be tuned?

A. Liveness probe threshold
B. Readiness probe threshold
C. MIG autoscaler
D. Cloud NAT

**Answer: B.** Readiness controls traffic routing to a not-yet-ready
pod (Domain 6 §6.2, P.R.O.B.E.). A would cause restart-loops instead.
C and D are unrelated to this symptom.

**Q37.** Bigtable hotspotting despite ample node capacity. Correct fix?

A. Add more nodes
B. Redesign the row key (salt/hash/reverse)
C. Switch to Cloud SQL
D. Increase replication factor

**Answer: B.** A key-design problem, not a capacity problem (Domain 6
§6.2, S.A.L.T., exam trap #3). A doesn't fix a hot key. C is
disproportionate. D adds DR/read capability, not a write-hotspot fix.

**Q38.** Need automatic regional failover for a relational DB with
strong consistency, not just zone-level HA. Correct choice?

A. Cloud SQL regional HA alone
B. Cloud Spanner multi-region
C. Single-zone Cloud SQL
D. Memorystore

**Answer: B.** Cloud SQL regional HA doesn't cover regional failure
automatically (Domain 6 §6.2's explicit gap). A misses the automatic-
regional-failover requirement. C is strictly worse. D isn't a
durable relational system of record.

**Q39.** A service stops reporting metrics entirely (crashed/network-
partitioned). Which alert type catches this?

A. Threshold-based
B. Absence-of-signal
C. Rate-of-change
D. None can catch this

**Answer: B.** Threshold/rate-of-change alerts need *some* data to
evaluate — absence-of-signal is built for exactly this gap (Domain 6
§6.1). D is factually incorrect.

**Q40.** Sudden traffic spikes consistently outpace autoscaler reaction
time. Correct mitigation?

A. Nothing — autoscaling always reacts instantly
B. Add a capacity buffer / raise the `min instances` floor
C. Disable autoscaling, run fixed size
D. Reduce health check frequency

**Answer: B.** Matches Domain 6 §6.2's scaling guidance — a buffer
absorbs the reactive-autoscaling latency gap. A is factually
incorrect. C removes elasticity entirely. D is unrelated to the
scaling-latency problem.

---

## Case-study cluster (embedded — questions drawn from two case studies)

**Q41 (EHR Healthcare).** EHR Healthcare needs to fail over a clinical
system serving EU customers during a regional outage. Which failover
target is correct?

A. The nearest US region, regardless of data residency
B. A region within the same compliance/residency boundary as the primary
C. No failover — accept the outage
D. A region chosen purely by lowest cost

**Answer: B.** Residency overrides availability convenience for this
case study (`04-architectures/case-study-ehr-healthcare.md`'s exam
trap). A violates the EU residency requirement. C ignores the stated
availability need for clinical systems. D ignores the binding
compliance constraint.

**Q42 (Mountkirk Games).** Mountkirk Games routes both gameplay actions
and account/leaderboard updates through the same global Spanner
instance for "consistency." What's the issue?

A. There is no issue — this is the correct design
B. It reintroduces cross-region latency into the low-latency gameplay path that regional game-session design was meant to avoid
C. Spanner cannot be used for account data
D. This design is cheaper than any alternative

**Answer: B.** The case study's signature trap — not every subsystem
needs the same consistency/latency tradeoff
(`04-architectures/case-study-mountkirk-games.md`). A misses the real
architectural cost. C is factually incorrect — Spanner is well-suited
to account data specifically. D is not established and isn't the
deciding issue regardless.

---

## Scoring guide

- **36–42 correct**: Exam-ready on breadth; focus remaining time on
  timing drills.
- **28–35 correct**: Solid foundation; review every wrong answer's full
  rationale and revisit that domain's file in `01-domains/`.
- **Below 28**: Return to `00-START-HERE/STUDY-PLAN.md` and work through
  domains sequentially before attempting Mock Exam 2.
