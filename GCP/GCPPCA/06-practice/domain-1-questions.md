# Practice Questions — Domain 1: Designing and Planning (~24% weight)

> 20 questions, every option explained (right and wrong), per this
> repo's CLAUDE.md §9 format. Answer key with full rationale follows
> each question immediately (not batched at the end) so review flows
> naturally question-by-question.

---

**Q1.** A retailer's e-commerce site currently runs in one GCP region.
Leadership states: "We're expanding to Europe and Asia next year, and
customers there complain about slow page loads." What should you
recommend first?

A. Migrate the database to Cloud Spanner immediately
B. Deploy the application to regions closer to the new customer bases, fronted by a Global External Application Load Balancer with Cloud CDN
C. Increase the machine type of the existing single-region deployment
D. Move to a multi-cloud strategy to get points of presence closer to customers

**Answer: B.**
- **A is wrong**: jumping straight to a global database before
  confirming the *application tier* even has regional presence is
  premature — Domain 1 §1.3 tests solving the compute/network layer
  first when the stated problem is latency from geographic distance,
  not data consistency.
- **B is correct**: the stated problem (slow loads for distant users)
  is a placement/latency problem — regional app deployment + global LB
  + CDN directly addresses it (Domain 1 §1.3 network topology,
  `04-architectures/pattern-multi-region-web-app.md`).
- **C is wrong**: a bigger machine in the same single region does
  nothing for users on the other side of the world — the bottleneck is
  geographic distance/network latency, not compute capacity.
- **D is wrong**: multi-cloud solves a vendor-lock-in concern, not a
  latency concern, and introduces unneeded complexity the scenario
  never asked for (over-engineering trap).

---

**Q2.** A scenario states: "Our compliance team requires that customer
data for our German clients never leaves German or EU jurisdiction."
Which mechanism enforces this at the infrastructure level?

A. IAM roles restricting who can access the data
B. A firewall rule blocking non-EU IP ranges
C. An Organization Policy constraint restricting resource locations, applied to the folder holding German-customer resources
D. Labeling all German-customer resources with `region:eu`

**Answer: C.**
- **A is wrong**: IAM controls *who* can access data, not *where* the
  data physically resides — doesn't satisfy a residency requirement.
- **B is wrong**: a firewall rule controls network traffic sources, not
  where data is stored — an EU-based attacker could still reach it, and
  a legitimate US-based admin call could still write data cross-region.
- **C is correct**: `constraints/gcp.resourceLocations` is exactly the
  mechanism for enforcing data residency at the infrastructure level
  (Domain 1 §1.1 business-requirements tradeoff table, Domain 3 §3.2).
- **D is wrong**: a label is metadata for humans/automation to read —
  it doesn't prevent a resource from being created outside the EU; it's
  not an enforcement mechanism.

---

**Q3.** A startup says: "We have very limited budget, our workload is
an internal tool used only during business hours, and occasional
downtime is fully acceptable." Which compute choice best fits?

A. Multi-region GKE Standard cluster, always running
B. Cloud Run, with default scale-to-zero behavior
C. Reserved Compute Engine instances sized for peak load, running 24/7
D. Cloud Spanner-backed globally distributed application

**Answer: B.**
- **A is wrong**: multi-region, always-on GKE is the highest-cost
  option here and directly contradicts the stated "very limited
  budget" and "internal tool" framing — over-engineering trap.
- **B is correct**: Cloud Run's scale-to-zero means zero cost outside
  business hours, matching both the budget constraint and the stated
  tolerance for downtime (Domain 1 §1.2 tradeoff table).
- **C is wrong**: reserved, always-on capacity for an internal,
  business-hours-only tool wastes money the entire rest of the time —
  the opposite of what "limited budget" calls for.
- **D is wrong**: Spanner is a database choice, not a compute choice,
  and even if paired with compute, it's wildly disproportionate to an
  internal tool with a stated tolerance for downtime.

---

**Q4.** Which best describes the difference between *availability* and
*resiliency* as tested on the PCA exam?

A. They are synonyms and can be used interchangeably
B. Availability measures uptime; resiliency measures the system's ability to recover from failure
C. Availability applies only to compute; resiliency applies only to storage
D. Resiliency is a subset of security, unrelated to availability

**Answer: B.**
- **A is wrong**: Domain 1 §1.2 explicitly distinguishes them — treating
  them as synonyms misses questions designed to test the distinction.
- **B is correct**: availability = percentage uptime (the SLA number);
  resiliency = the system's capacity to detect and recover from failure
  (retries, self-healing, failover) — a system can be "available"
  (responding) but not resilient (unable to gracefully handle a
  dependency failure).
- **C is wrong**: both concepts apply across compute, storage, and
  network layers — they aren't scoped to a single resource type.
- **D is wrong**: resiliency is a reliability/architecture concept
  (Domain 1/6), not a security concept (Domain 3) — conflating domains
  like this is a common wrong-answer pattern.

---

**Q5.** A company migrating off a data center closing in 45 days asks
for the fastest, lowest-risk migration approach for a stable,
well-understood application. What do you recommend?

A. Refactor into a cloud-native microservices architecture
B. Rehost via lift-and-shift to Compute Engine
C. Repurchase an equivalent SaaS product
D. Retain the application on-prem past the closure date

**Answer: B.**
- **A is wrong**: Refactor is the slowest, highest-risk option — directly
  contradicts the stated 45-day deadline (Domain 1 §1.4 tradeoff table,
  `03-comparisons/04-migration-strategies.md`).
- **B is correct**: Rehost is fastest and lowest-risk for a stable,
  well-understood app under a hard deadline — matches every stated
  constraint.
- **C is wrong**: nothing in the scenario suggests a SaaS replacement
  exists or is desired — Repurchase requires that specific condition,
  which isn't given.
- **D is wrong**: the data center is closing in 45 days — Retain isn't
  physically possible past that point; this ignores the stated
  constraint entirely.

---

**Q6.** A scenario states the business "cannot lose any completed
customer transaction, ever, even during a regional outage," but is
otherwise cost-sensitive. What database configuration fits?

A. Cloud SQL with a single-zone instance
B. Cloud Spanner in a multi-region configuration
C. Bigtable with single-cluster replication
D. Firestore in a single-region configuration

**Answer: B.**
- **A is wrong**: single-zone Cloud SQL has no regional failure
  protection at all — directly fails the "zero loss even during a
  regional outage" requirement.
- **B is correct**: multi-region Spanner is the one configuration that
  delivers strong consistency and automatic regional HA together — the
  requirement ("never, even during a regional outage") is explicit
  enough to justify the cost despite the stated cost sensitivity
  (Domain 1 §1.1's "the business already decided this number, don't
  second-guess it" principle).
- **C is wrong**: single-cluster Bigtable replication doesn't provide
  multi-region strong consistency out of the box the way this
  requirement needs, and Bigtable isn't the right data model for
  transactional consistency requirements phrased this way.
- **D is wrong**: single-region Firestore has the same regional-outage
  exposure as single-zone Cloud SQL — doesn't meet the stated
  requirement.

---

**Q7.** Which network pattern best fits an organization with 12
independent business units, each needing strong network isolation from
the others, with no plan to share resources between them?

A. One flat VPC shared by all business units
B. Shared VPC with all 12 units as service projects on one host network
C. 12 separate VPCs, each independently managed by its business unit
D. VPC Peering connecting all 12 VPCs in a full mesh

**Answer: C.**
- **A is wrong**: a flat shared VPC gives zero isolation between units
  that explicitly need strong separation — directly contradicts the
  stated requirement.
- **B is wrong**: Shared VPC centralizes network administration and
  shares IP space — appropriate for centralized governance, but the
  scenario specifically wants *strong isolation*, not shared network
  administration (Domain 1 §1.3 Pattern A vs. B distinction).
- **C is correct**: independent VPCs per business unit is the strongest
  isolation pattern (Domain 1 §1.3 Pattern B) — matches "no plan to
  share resources" and "strong isolation" directly.
- **D is wrong**: a full mesh of 12 VPCs via Peering is both
  unnecessary (no stated need for inter-unit connectivity) and doesn't
  scale — 12 VPCs would need up to 66 peering connections, and Peering
  isn't transitive, adding complexity with no stated benefit.

---

**Q8.** A team says: "We want to move fast, our engineers are
comfortable with managed services, and we don't want to manage
servers." For a new stateless HTTP API with unpredictable traffic,
what should you recommend?

A. Compute Engine with manually managed autoscaling scripts
B. GKE Standard with custom node pools
C. Cloud Run
D. A dedicated sole-tenant Compute Engine fleet

**Answer: C.**
- **A is wrong**: manually managed autoscaling scripts on Compute Engine
  directly contradicts "don't want to manage servers."
- **B is wrong**: GKE Standard still requires node-pool management —
  more operational burden than the team stated they want; Autopilot
  would be closer, but Cloud Run is an even better fit for stateless
  HTTP with unpredictable traffic given zero cluster concept needed at
  all.
- **C is correct**: Cloud Run directly matches every stated
  constraint — no servers, no clusters, fast to deploy, scales with
  unpredictable traffic automatically (Domain 1 §1.3,
  `03-comparisons/01-compute-options.md`).
- **D is wrong**: sole-tenant nodes are for licensing/compliance
  isolation needs, not a fit for "move fast, don't manage servers" —
  actually the opposite, since sole-tenancy adds infrastructure
  management overhead.

---

**Q9.** Which of the following is a valid business-continuity planning
concern that belongs in Domain 1 (as opposed to being implemented in
Domain 6)?

A. Configuring a specific Cloud Monitoring alerting policy threshold
B. Eliciting the required RTO/RPO numbers from stakeholders
C. Setting a GKE readiness probe threshold
D. Configuring Cloud SQL automated backup retention days

**Answer: B.**
- **A is wrong**: configuring a specific alerting *policy* is
  implementation — Domain 6 §6.1.
- **B is correct**: eliciting RTO/RPO numbers from the business is
  Domain 1's requirements-translation work (§1.1/§1.2) — Domain 6 then
  *implements* the failover pattern that hits those numbers.
- **C is wrong**: probe threshold tuning is an implementation detail —
  Domain 6 §6.2.
- **D is wrong**: backup retention configuration is implementation —
  Domain 6 §6.2 / Domain 2 §2.2.

---

**Q10.** A company wants to reduce vendor lock-in risk per a board-level
directive, while still needing a managed Kubernetes platform. Which
choice best balances this?

A. GKE Autopilot with heavy use of GCP-proprietary APIs throughout the application
B. GKE Standard, application built on open Kubernetes APIs and standard container images, avoiding unnecessary GCP-proprietary service dependencies
C. App Engine Standard, fully committing to its proprietary runtime APIs
D. A fully custom-built container orchestration system to avoid any managed service

**Answer: B.**
- **A is wrong**: heavy use of GCP-proprietary APIs undermines the
  stated portability goal even while using a portable orchestration
  layer (GKE) — contradicts the board directive.
- **B is correct**: Kubernetes itself is a portable, open standard;
  building on open APIs and standard containers while still using a
  managed control plane (GKE) is the practical balance between
  operational efficiency and the stated lock-in concern (Domain 1 §1.1
  tradeoff table).
- **C is wrong**: App Engine Standard's proprietary runtime APIs are
  among the least portable options on GCP — directly contradicts the
  requirement.
- **D is wrong**: building a fully custom orchestration system to avoid
  any managed service is a wildly disproportionate response to a
  portability concern — massive unnecessary engineering cost
  (over-engineering trap), and the board directive doesn't require
  abandoning managed services entirely, just reducing proprietary
  dependency.

---

**Q11.** A scenario states a new application must support "steady,
predictable load, 24/7, for the foreseeable future" on Compute Engine.
Which purchasing/configuration option minimizes cost without
sacrificing availability?

A. On-demand pricing with no autoscaling
B. Preemptible VMs for the entire fleet
C. Committed Use Discounts matched to the steady baseline, with regional MIG for zone-level HA
D. Autoscaling from zero to peak continuously

**Answer: C.**
- **A is wrong**: on-demand pricing leaves committed-use savings on the
  table for a workload explicitly described as steady and predictable.
- **B is wrong**: Preemptible VMs can be reclaimed at any time — wrong
  for a workload with no stated fault tolerance for interruption,
  especially one needing to run 24/7 reliably.
- **C is correct**: CUDs directly discount predictable, steady baseline
  load (Domain 1 §1.2 tradeoff table), and a regional MIG provides
  zone-level HA appropriate for a 24/7 service.
- **D is wrong**: autoscaling from zero solves a variability problem
  this workload doesn't have — steady load doesn't benefit from
  scale-to-zero behavior and this ignores the CUD savings opportunity.

---

**Q12.** Which statement about Cloud Storage Transfer Service vs.
Transfer Appliance is correct?

A. Transfer Appliance is always faster regardless of data volume or network conditions
B. Storage Transfer Service is for physical shipping of data; Transfer Appliance is for network-based transfer
C. Transfer Appliance is the better fit for petabyte-scale data with a poor or absent network link; Storage Transfer Service fits network-based, often recurring or scheduled transfers
D. Both services are identical in function and differ only in pricing

**Answer: C.**
- **A is wrong**: for small transfers over a good network link, Storage
  Transfer Service is faster — Transfer Appliance's advantage is
  specifically for very large data with poor connectivity (Domain 1
  §1.4).
- **B is wrong**: this reverses the two services' actual roles.
- **C is correct**: matches Domain 1 §1.4's data-transfer method table
  exactly — Transfer Appliance for large data/poor links, Storage
  Transfer Service for network-based (often scheduled/recurring)
  transfers.
- **D is wrong**: they solve different problems (physical vs.
  network-based transfer) with different tradeoffs, not just different
  pricing for the same function.

---

**Q13.** A team asks how to decide whether to re-evaluate an existing
architecture (Domain 1 §1.5) mid-lifecycle. Which is the best-practice
trigger?

A. Re-architect on a fixed calendar schedule regardless of any other signal
B. Re-evaluate when a genuine inflection point arrives — e.g. actual scale, cost trend, or compliance change — not preemptively
C. Never re-evaluate once an architecture is deployed, to avoid risk
D. Re-architect immediately whenever a new GCP service is announced

**Answer: B.**
- **A is wrong**: a fixed calendar schedule with no regard for actual
  signals risks re-architecting when nothing has actually changed —
  wasted effort.
- **B is correct**: Domain 1 §1.5 frames this as judgment-based —
  recognizing a genuine inflection point (the business has actually
  reached global scale, a new compliance regime applies, cost trends
  shifted meaningfully) rather than preemptive or reflexive change.
- **C is wrong**: never re-evaluating ignores real signals when they do
  arrive — the opposite failure mode from A.
- **D is wrong**: chasing every new service announcement without a
  driving business need is the "new shiny" bias flagged as an exam
  trap in `00-START-HERE/EXAM-TRAPS-AND-MNEMONICS.md`.

---

**Q14.** For a scenario needing point-to-point private connectivity to
consume exactly one partner-provided service, with minimal network
exposure, which is correct?

A. Full VPC Peering with the partner's VPC
B. Private Service Connect
C. A public internet API call secured only by an API key
D. Cloud VPN tunnel dedicated to this one service

**Answer: B.**
- **A is wrong**: full VPC Peering exposes far more network surface
  than needed for consuming one specific service — larger blast radius
  than the requirement calls for.
- **B is correct**: Private Service Connect is purpose-built for
  exactly this — private consumption of one specific service with
  minimal exposure (Domain 1 §1.3, `02-services/03-networking.md`).
- **C is wrong**: a public API call, even with an API key, doesn't meet
  a "private connectivity" requirement — traffic still traverses the
  public internet.
- **D is wrong**: a VPN tunnel is a heavier-weight hybrid-connectivity
  mechanism, not the standard pattern for private service consumption
  within/across GCP VPCs — PSC is purpose-built for this exact case.

---

**Q15.** Which best captures why a scenario describing "small team, no
dedicated DBA, needs a relational database" should avoid a self-managed
database on Compute Engine?

A. Compute Engine cannot run database software at all
B. Self-managed databases require the team to own patching, backups, and failover — Cloud SQL provides these as a managed service, better matching the stated team-capability constraint
C. Cloud SQL is always cheaper than any self-managed alternative
D. Self-managed databases are against GCP's terms of service

**Answer: B.**
- **A is wrong**: factually incorrect — Compute Engine can absolutely
  run database software; the issue is operational fit, not technical
  possibility.
- **B is correct**: matches Domain 1 §1.1's requirement-translation
  table — "small team, no dedicated ops" is a team-capability
  constraint favoring managed services.
- **C is wrong**: cost comparisons are workload/scale-dependent, not a
  universal truth — the deciding factor here is stated team capability,
  not a blanket cost claim.
- **D is wrong**: fabricated constraint — no such prohibition exists;
  don't invent constraints not stated in a scenario.

---

**Q16.** A scenario emphasizes "our board is concerned about relying on
too many single-vendor, proprietary managed services." Which pairing
best reflects a portability-conscious but still cloud-native design?

A. Cloud Spanner + Firestore + BigQuery ML, exclusively
B. Cloud SQL for PostgreSQL + GKE Standard + Terraform, avoiding unnecessary GCP-only APIs
C. App Engine Standard with heavy use of its proprietary datastore APIs
D. A single monolithic Compute Engine VM with everything installed manually

**Answer: B.**
- **A is wrong**: these are all deeply GCP-proprietary managed services
  — directly contradicts the stated lock-in concern.
- **B is correct**: PostgreSQL-compatible Cloud SQL, standard
  Kubernetes via GKE, and Terraform (multi-cloud-capable IaC) together
  minimize proprietary dependency while still being managed/cloud-native
  (Domain 1 §1.1 tradeoff table).
- **C is wrong**: App Engine's proprietary APIs are a classic
  high-lock-in choice.
- **D is wrong**: over-corrects into unnecessary operational burden
  (no managed services at all) — the board's concern is about
  proprietary APIs, not about using managed infrastructure in general;
  this response ignores the "move fast"/operational-efficiency
  expectations most scenarios also carry.

---

**Q17.** Given "the exam tests trade-off analysis, not memorization of
exact pricing," which study behavior is most aligned with Domain 1's
actual test format?

A. Memorizing exact per-GB storage prices for every storage class
B. Practicing translating business language into technical
   constraints and reasoning through decision trees under multiple
   stated constraints
C. Memorizing every `gcloud` command flag
D. Focusing exclusively on service feature lists without practicing scenario reasoning

**Answer: B.**
- **A is wrong**: per RUNBOOK §6, "detailed SKU-level pricing
  memorization" is explicitly de-emphasized.
- **B is correct**: matches this repo's own framing (RUNBOOK §1's
  access-note context and `00-START-HERE/STUDY-PLAN.md`'s daily loop) —
  the exam is scenario/trade-off reasoning, not recall.
- **C is wrong**: exact CLI syntax is a Domain 5 supporting detail, not
  the core skill Domain 1 tests.
- **D is wrong**: feature-list memorization without scenario practice
  is exactly the "services list with a leaf's name attached" failure
  mode this repo's CLAUDE.md §12 explicitly warns against.

---

**Q18.** A scenario describes a workload that must remain on-premises
indefinitely due to a hardware-embedded software license that cannot
be transferred, while other systems at the same company are moving to
GCP. What's the correct Domain 1 §1.4 classification and next action?

A. Retire the workload immediately
B. Retain the workload, and design hybrid connectivity so it can still integrate with the systems that are migrating
C. Force a Refactor to remove the licensing dependency regardless of cost
D. Ignore the workload since it isn't moving to GCP

**Answer: B.**
- **A is wrong**: nothing indicates the workload is being decommissioned
  — it's staying for a real, durable reason (licensing), which is
  Retain, not Retire.
- **B is correct**: this is the textbook Retain scenario (Domain 1 §1.4
  tradeoff table) — and because other systems are migrating, hybrid
  connectivity design (Domain 1 §1.3) becomes a real, related
  requirement, not an afterthought.
- **C is wrong**: forcing a Refactor to eliminate a licensing constraint
  the business hasn't asked to remove is scope creep beyond what the
  scenario states.
- **D is wrong**: ignoring the workload breaks the integration need with
  systems that ARE migrating — a real architectural gap, not a
  legitimate simplification.

---

**Q19.** Which best explains why "multi-region by default" is a
recurring PCA exam trap?

A. Multi-region architectures are always technically impossible to implement correctly
B. Multi-region adds cost and complexity that's only justified when the scenario actually states a multi-region/global requirement — applying it by default is over-engineering
C. GCP does not support multi-region deployments
D. Multi-region is only relevant to Domain 6, never Domain 1

**Answer: B.**
- **A is wrong**: factually false — multi-region architectures are
  common and well-supported; the issue is applying them without
  justification, not technical impossibility.
- **B is correct**: directly matches the over-engineering trap
  (`00-START-HERE/EXAM-TRAPS-AND-MNEMONICS.md` #1) and Domain 1 §1.3's
  tradeoff table — match architecture scope to the *stated* user base/
  compliance need, not to what sounds more sophisticated.
- **C is wrong**: factually false.
- **D is wrong**: multi-region decisions start in Domain 1 (design) and
  are executed/maintained in Domain 6 (reliability) — it spans both,
  not just one.

---

**Q20.** A scenario states: "We need this system available 99.99% of
the time; a few minutes of downtime per year is the maximum
acceptable." Which SLA target and general design tier does this map
to, per Domain 1 §1.2?

A. 99.9% target, single-zone deployment
B. 99.99% target (~52 minutes/year downtime budget), requiring a highly available, likely multi-zone or multi-region design appropriate to the stated scope
C. No SLA target needed — this is a Domain 6 concern only
D. 100% target, since "available" means no downtime is acceptable at all

**Answer: B.**
- **A is wrong**: 99.9% (~8.7 hours/year) is a looser target than what
  the scenario states — doesn't meet the stated requirement.
- **B is correct**: matches Domain 1 §1.2's SLA-mapping table exactly —
  99.99% corresponds to roughly 52 minutes/year, consistent with "a few
  minutes... maximum acceptable," and drives a high-availability design.
- **C is wrong**: translating the business statement into a technical
  SLA/SLO target is exactly Domain 1's job (§1.2) — Domain 6 then
  implements the mechanism, but the target-setting itself is Domain 1.
- **D is wrong**: 100% availability is not a realistic or standard SLA
  target in any real system — this misreads "a few minutes... maximum
  acceptable" (which explicitly allows *some* downtime) as zero
  tolerance.
