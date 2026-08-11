# Practice Questions — Domain 2: Managing and Provisioning (~15% weight)

> 20 questions, every option explained.

---

**Q1.** A team needs to provision GCP infrastructure repeatably, with
peer review before any change reaches production. What should they use?

A. Console changes, documented afterward in a wiki
B. Terraform, with `plan` output reviewed in a pull request before `apply`
C. `gcloud` commands run ad hoc by whoever is on call
D. Cloud Shell scripts stored locally on each engineer's laptop

**Answer: B.** Terraform's plan/apply model with PR review is the
concrete answer to "repeatable + peer-reviewed" (Domain 2 §2.3). A is
wrong (no pre-change review, no diff). C is wrong (ad hoc, not
repeatable/reviewed). D is wrong (not centrally reviewable or shared).

---

**Q2.** Which VPC subnet mode should a production network use?

A. Auto-mode, for simplicity
B. Custom-mode, with explicitly chosen ranges and regions
C. No subnets at all — a flat network
D. Auto-mode, but with all default ranges deleted after creation

**Answer: B.** Custom-mode is the production default per Domain 2 §2.1
— full control over ranges/regions. A is wrong (fixed /20s, not a
production pattern). C is wrong (not how GCP VPCs work — subnets are
required for regional resources). D is wrong (deleting default ranges
doesn't grant the control custom-mode provides from the start, and
reworking an auto-mode network after the fact is unnecessary rework).

---

**Q3.** A private GKE cluster's nodes need to pull container images
from the public internet. What provisioning step is required?

A. Assign external IPs to all nodes
B. Provision Cloud NAT via a Cloud Router in the cluster's region
C. Open all inbound firewall ports
D. Use a self-managed NAT instance VM

**Answer: B.** Cloud NAT is the managed, exam-correct answer for
outbound-only internet access for private resources (Domain 2 §2.1). A
is wrong (defeats the purpose of a private cluster, and isn't the
minimal-exposure answer). C is wrong (inbound rules are irrelevant to
outbound image pulls, and opening all inbound is a security regression).
D is wrong (self-managed NAT instances are legacy toil the exam
disfavors versus the managed Cloud NAT service).

---

**Q4.** Which is the correct tool choice for a Kubernetes-native,
GitOps-first team that wants GCP resources managed in the same
reconciliation loop as their application manifests?

A. Terraform only
B. Config Connector
C. Manual Console configuration
D. Deployment Manager

**Answer: B.** Config Connector manages GCP resources as Kubernetes
CRDs, fitting directly into a GitOps loop already built around K8s
manifests (Domain 2 §2.3, Domain 5 §5.2). A is wrong given the
scenario's explicit K8s-native/GitOps framing (still a valid general
tool, just not the best fit here). C is wrong (not repeatable/
reviewable). D is wrong (legacy, not the modern IaC default this repo
assumes).

---

**Q5.** What is the primary reason to provision hierarchical firewall
policies at the folder level rather than per-VPC firewall rules alone?

A. They are cheaper
B. They enforce guardrails that individual project admins cannot override, enabling org-wide "no exceptions" rules
C. They are the only way to create any firewall rule in GCP
D. They only work with Auto-mode VPCs

**Answer: B.** Matches Domain 2 §2.1's tradeoff table exactly — the
override-proof nature is the deciding factor, not cost (A, not the
stated reason), and per-VPC rules remain fully valid and commonly used
(C is false), and hierarchical policies aren't tied to VPC mode (D is
false).

---

**Q6.** A scenario says storage needs change based on access age: hot
for 30 days, then rarely accessed. What provisioning mechanism
automates this without ongoing manual work?

A. A cron job that manually moves objects between buckets
B. Cloud Storage Lifecycle rules transitioning storage class by object age
C. Deleting objects after 30 days regardless of future need
D. Keeping everything in Standard class permanently

**Answer: B.** Lifecycle rules are the managed, ops-free mechanism for
this exact pattern (Domain 2 §2.2). A is wrong (manual, not automated,
contradicts the "without ongoing manual work" requirement). C is wrong
(destroys data that may still be needed, not what "rarely accessed"
implies). D is wrong (ignores the cost-optimization opportunity the
scenario is pointing at).

---

**Q7.** Which is the correct provisioning-time answer for an app that
will scale from tens to thousands of concurrent connections against a
Cloud SQL instance?

A. Continuously raise `max_connections` as load grows
B. Provision a connection pooler (Cloud SQL Auth Proxy or PgBouncer) alongside the app tier
C. Switch every workload immediately to Spanner regardless of consistency needs
D. Add more Cloud SQL read replicas to absorb write connections

**Answer: B.** Connection pooling is the standard mitigation before
hitting Cloud SQL's hard connection ceilings (Domain 2 §2.2). A is
wrong (there's a hard machine-type-tied ceiling that can't be raised
indefinitely). C is wrong (a disproportionate response without a
stated consistency/scale requirement justifying Spanner — see Domain 1
§1.3 exam trap). D is wrong (read replicas don't help with the
connection-count problem for writes, and conflates read scaling with
connection pooling).

---

**Q8.** What's the correct sizing lever for scaling Cloud Spanner
capacity without resharding?

A. Increasing compute capacity (nodes/processing units)
B. Manually resharding tables across new instances
C. Switching to a different database engine
D. Increasing the size of Persistent Disks attached to Spanner

**Answer: A.** Spanner scales by adding compute capacity without a
resharding step (Domain 2 §2.2) — this is one of Spanner's defining
features. B is wrong (not how Spanner scaling works — that's a
sharded-relational-database pattern, not Spanner's model). C is wrong
(a scale operation doesn't require an engine change). D is wrong
(Spanner doesn't expose Persistent Disk sizing as the scaling lever to
the user).

---

**Q9.** A CI/CD pipeline for infrastructure should apply Org Policy
guardrails at which point?

A. After resources are already created, as a periodic audit
B. Before `terraform apply` succeeds, blocking non-compliant changes proactively (shift-left)
C. Only when a security incident occurs
D. Org Policy cannot be integrated with CI/CD pipelines

**Answer: B.** Domain 2 §2.3 explicitly frames this as "shift-left
security" — blocking before creation, not just auditing after. A is
wrong (reactive, not preventive — a non-compliant resource already
exists by the time an audit catches it). C is wrong (guardrails should
be continuous, not incident-triggered). D is wrong (factually false —
policy-as-code validation in CI is a standard, described pattern).

---

**Q10.** Which best describes the relationship between Domain 1 and
Domain 2 questions on the exam?

A. They are unrelated and never appear together
B. Domain 1 decides "what" the architecture should be; Domain 2 tests "how" it gets provisioned/implemented
C. Domain 2 always overrides Domain 1's decisions
D. They are the same domain with two names

**Answer: B.** Domain 2 exam trap #1 states this explicitly — Domain 2
questions usually give you the design already decided (Domain 1's
output) and ask for the correct provisioning mechanism. A and D are
wrong (they're distinct but tightly related domains). C is wrong
(provisioning implements design decisions, it doesn't override them).

---

**Q11.** A scenario states many teams request new projects frequently,
each needing consistent baseline IAM/Org Policy/network configuration.
What pattern addresses this at scale?

A. Manually configuring each new project via Console every time
B. An automated "project factory" pattern — new-project creation, labeling, and baseline policy application done via IaC/pipeline
C. Giving every team Owner role so they can self-configure
D. Refusing new project requests to avoid the overhead

**Answer: B.** Domain 5 §5.2/Domain 2 crossover — automation is the
answer whenever "many," "frequently," or "at scale" appears (Domain 2
exam trap #2). A is wrong (doesn't scale, inconsistent results,
contradicts "frequently"). C is wrong (Owner is a primitive role and a
security anti-pattern — Domain 3 crossover). D is wrong (doesn't solve
the actual business need, just avoids it).

---

**Q12.** What differentiates GKE Autopilot provisioning from GKE
Standard provisioning, from a Domain 2 perspective?

A. Autopilot requires manually creating and sizing node pools; Standard does not
B. Standard requires explicit node pool provisioning (machine types, sizing); Autopilot manages nodes invisibly
C. They are provisioned identically in every respect
D. Only Standard supports Terraform provisioning

**Answer: B.** Matches `02-services/01-compute.md`'s Standard vs.
Autopilot table exactly. A reverses the actual relationship. C is
wrong (meaningfully different provisioning surface, especially around
node pools). D is wrong (both are Terraform-provisionable).

---

**Q13.** Why is Cloud NAT preferred over assigning external IPs to
private application instances that only need outbound access?

A. External IPs are more expensive in all cases
B. Cloud NAT provides outbound-only access without exposing instances to inbound traffic from the internet, matching a "no exposure needed" requirement
C. External IPs are deprecated and no longer functional
D. There is no difference in security posture between the two

**Answer: B.** Matches Domain 2 §2.1's tradeoff table. A is not the
deciding factor (security posture is). C is factually false. D is
wrong — this is precisely the deciding difference (inbound exposure
risk).

---

**Q14.** A scenario describes observability dashboards and alert
policies that should be created at the same time as the compute
resources they monitor, via the same pipeline. What principle does
this reflect?

A. "Observability by default" — treating monitoring/alerting as code, provisioned alongside the resource itself
B. Monitoring should always be configured manually after an incident
C. Alerting policies cannot be defined via Terraform
D. Observability is unrelated to provisioning

**Answer: A.** Directly from Domain 2 §2.3. B is wrong (reactive,
post-incident configuration is the anti-pattern being avoided). C is
factually false (`google_monitoring_alert_policy` is a real Terraform
resource). D is wrong — the whole point of this principle is that
they're provisioned together.

---

**Q15.** Which is the correct answer for provisioning a bucket that
must have exactly one consistent, auditable IAM policy surface, per
Domain 2 §2.2's Cloud Storage guidance?

A. Legacy per-object ACLs
B. Uniform bucket-level access
C. No access control at all, public by default
D. A separate IAM policy for every object individually

**Answer: B.** Uniform bucket-level access is the recommended default
for exactly this reason (Domain 2 §2.2). A is wrong (fragmented,
harder to audit). C is wrong (a serious security anti-pattern, never
correct absent an explicit public-content requirement). D is wrong
(unmanageable at scale and not how uniform access works).

---

**Q16.** Which of the following is the least appropriate justification
for choosing GKE Standard over Autopilot in a provisioning decision?

A. The workload requires specific GPU node configurations Autopilot doesn't support
B. The platform team wants full control over node-level configuration
C. "Standard sounds more production-grade than Autopilot" with no other stated reason
D. The team needs custom node taints/tolerations for workload isolation

**Answer: C.** This is the "sounds more sophisticated" trap — with no
stated technical requirement, this isn't a valid justification (Domain
1 exam trap #1, applies here too). A, B, and D are all legitimate,
requirement-driven reasons per `02-services/01-compute.md`.

---

**Q17.** A team wants a managed CD pipeline to GKE/Cloud Run with
built-in canary rollout support and approval gates, without building
custom rollout scripting. What should they provision?

A. Cloud Build alone
B. Cloud Deploy
C. A cron job triggering `kubectl apply` on a schedule
D. Manual `gcloud run deploy` commands run by an engineer each time

**Answer: B.** Cloud Deploy is purpose-built for exactly this (Domain
2 §2.3, `02-services/07-devops-cicd.md`). A is wrong (Cloud Build is
CI, not CD — it builds/tests, doesn't manage progressive delivery
targets/approval gates on its own). C and D are wrong (manual/ad hoc,
not the managed, gated pattern requested).

---

**Q18.** What is the risk of using Auto-mode VPCs in a production
environment with plans to add hybrid connectivity later?

A. There is no risk; Auto-mode is always production-appropriate
B. Auto-mode's predetermined subnet ranges per region can conflict with on-prem address space or limit future network design flexibility
C. Auto-mode VPCs cannot have firewall rules at all
D. Auto-mode VPCs are billed at a different rate than custom-mode

**Answer: B.** Matches Domain 2 §2.1's stated preference for
custom-mode in production, specifically flagging range flexibility as
a concern for evolving/hybrid network designs. A contradicts the
domain's own guidance. C is factually false. D is not a real
distinction between the two modes.

---

**Q19.** In the Terraform GKE provisioning pattern from Lab 3, why is
`remove_default_node_pool = true` combined with an explicitly defined
`google_container_node_pool` resource?

A. It's required by GCP and has no Terraform-specific rationale
B. The default node pool isn't independently Terraform-manageable in the same way; an explicit node pool resource gives full lifecycle control
C. It reduces cost to zero
D. It disables autoscaling permanently

**Answer: B.** Matches `05-labs/lab-03-gke-terraform-deployment.md`'s
explanation directly. A is an overstatement (it's a Terraform/IaC best
practice, not a hard GCP requirement). C is false (no automatic cost
reduction from this alone). D is false (autoscaling is configured
separately on the explicit node pool, not disabled by this pattern).

---

**Q20.** Which statement best summarizes when Config Connector is
preferred over Terraform for a specific provisioning task?

A. Always — Config Connector should replace Terraform entirely in every scenario
B. When the team's workflow is already Kubernetes/GitOps-centric and wants GCP resource lifecycle tied to the same reconciliation loop as app manifests
C. Never — Terraform is the only valid tool per this repo's conventions
D. Only for provisioning Compute Engine VMs

**Answer: B.** Matches the Domain 2/5 decision table exactly — it's a
fit-for-context choice, not a blanket replacement (A wrong) or
exclusion (C wrong), and it's not scoped to a specific resource type
like VMs (D wrong) — it's about workflow fit, not resource type.
