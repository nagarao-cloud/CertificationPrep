# Practice Questions — Domain 5: Managing Implementation (~11% weight)

> 20 questions, every option explained.

---

**Q1.** A team needs to publish a governed API for external partners
with monetization and a developer portal. What should they use?

A. Cloud Endpoints alone
B. Apigee
C. A raw, unmanaged HTTP endpoint
D. Cloud Armor

**Answer: B.** Apigee adds monetization, analytics, and developer-
portal capability beyond Cloud Endpoints (Domain 5 §5.1). A lacks the
monetization/portal features explicitly requested. C provides no API
management at all. D is a WAF/edge security tool, not an API
management platform.

---

**Q2.** A Cloud Run service occasionally needs to reach a private
Cloud SQL instance via its private IP. What's required?

A. Give Cloud SQL a public IP and allow all sources
B. Serverless VPC Access connector (or direct VPC egress) from Cloud Run
C. Nothing — Cloud Run can reach private IPs by default
D. Move Cloud SQL to Cloud Storage instead

**Answer: B.** Matches Domain 5 §5.1 and `02-services/01-compute.md` —
required to bridge Cloud Run's serverless environment into the VPC
where the private Cloud SQL instance lives. A exposes the database
publicly, a security regression (Domain 3 crossover). C is factually
incorrect — this connectivity must be explicitly configured. D isn't a
valid substitution (different service categories entirely).

---

**Q3.** For a recurring, scriptable automation task with a good audit
trail, which access method is most appropriate?

A. Console clicking
B. `gcloud`/`gsutil`/`bq` CLI, scripted and version-controlled
C. Asking a human to do it manually each time
D. A shared spreadsheet of instructions

**Answer: B.** Matches Tree 6 (`00-START-HERE/DECISION-TREES.md`) —
scriptable, repeatable, decent audit trail via shell history/source
control. A has no audit trail and isn't repeatable. C and D aren't
automation at all — they contradict "recurring... automation task."

---

**Q4.** A Kubernetes-native, GitOps-first team wants GCP resources
managed in the same reconciliation loop as their app manifests. What's
correct?

A. Terraform exclusively
B. Config Connector
C. Manual Console configuration
D. Deployment Manager

**Answer: B.** Matches Domain 5 §5.2's decision table directly —
fits the stated GitOps-centric workflow. A doesn't integrate with the
K8s reconciliation loop the same way. C isn't repeatable/reviewable.
D is legacy and not the modern default.

---

**Q5.** Which best fits "team wants to guide a legacy monolith into
containers with minimal code change, not a full microservices
rewrite"?

A. A full microservices refactor
B. Containerize the existing monolith largely as-is, deploy to Cloud Run or GKE (Replatform-style, per Domain 1 §1.4)
C. Rewrite the application from scratch in a new language
D. Refuse to migrate until a rewrite is funded

**Answer: B.** Matches Domain 5 §5.1's guidance on advising dev teams
— minimal-change containerization directly matches the stated
constraint. A and C both ignore "minimal code change" explicitly
stated in the scenario (over-engineering trap). D isn't a valid
architectural recommendation — it avoids answering the question.

---

**Q6.** Which GKE feature controls how aggressively a cluster
auto-upgrades to new Kubernetes minor versions?

A. Node pool machine type
B. Release channel (Rapid/Regular/Stable)
C. Workload Identity configuration
D. VPC-native networking mode

**Answer: B.** Matches `02-services/01-compute.md`'s GKE section —
release channels are exactly this control. A, C, and D each control an
unrelated aspect of the cluster (compute sizing, workload
authentication, and networking mode respectively).

---

**Q7.** What is the correct rollback mechanism for a Cloud Run service
after a bad deployment?

A. Rebuild and redeploy from scratch
B. Shift traffic back to the prior revision via traffic splitting
C. Delete the service entirely and recreate it
D. Manually SSH into the container and revert files

**Answer: B.** Matches Domain 5 §5.1 and Domain 4 §4.3 — revisions
remain addressable, so rollback is a fast traffic-split change. A is
slower and unnecessary. C is destructive and unnecessary. D isn't
possible/appropriate for a managed serverless container platform.

---

**Q8.** A scenario describes many teams frequently requesting new
projects, each needing consistent baseline configuration applied
automatically. What pattern fits?

A. Manual Console setup per request
B. A "project factory" automation pattern (Domain 5 §5.2)
C. Granting broad Owner access so teams self-serve without guardrails
D. Declining new project requests

**Answer: B.** Matches Domain 5 §5.2's governance/automation guidance
directly. A doesn't scale or stay consistent. C removes governance
entirely — a security anti-pattern (Domain 3 crossover). D avoids
solving the actual stated business need.

---

**Q9.** Which tool-selection rule applies when a scenario says "we need
this GCP infrastructure change to be safe, reviewed, and repeatable
across environments"?

A. Console/ClickOps
B. Terraform in a CI/CD pipeline with plan review
C. Ad hoc `gcloud` commands typed by whoever is available
D. A shared document describing the steps to perform manually

**Answer: B.** Matches Tree 6's core logic and Domain 5 §5.2's stated
decision rules — repeatable + reviewed = IaC in CI/CD. A, C, and D
each lack either repeatability, review, or both.

---

**Q10.** What differentiates a liveness probe from a readiness probe,
and which Domain does that distinction primarily belong to alongside
Domain 5's testing/validation guidance?

A. They are the same thing; Domain 5 doesn't distinguish them
B. Liveness controls restarts; readiness controls traffic routing — implementation detail shared with Domain 6 §6.2
C. Liveness controls traffic routing; readiness controls restarts
D. Neither is relevant to GKE testing/validation strategy

**Answer: B.** Matches the P.R.O.B.E. mnemonic and Domain 6 §6.2,
referenced from Domain 5's testing/validation guidance as a shared
implementation concept. A conflates the two. C reverses their actual
roles. D understates their relevance — probe strategy is directly
part of testing/validation and reliability practice.

---

**Q11.** A scenario wants MIG rollout speed vs. safety tuned during a
patch/version rollout. What controls this?

A. `maxSurge`/`maxUnavailable` settings in the MIG update policy
B. Firewall rule priority
C. IAM role bindings
D. Cloud DNS TTL

**Answer: A.** Matches Domain 5 §5.2's resource-governance section
(and Domain 6 §6.2's parallel maintenance-strategy discussion) —
directly the mechanism for rollout speed/safety tuning. B, C, and D
each control an unrelated aspect of the system.

---

**Q12.** Which best distinguishes Cloud Endpoints from Apigee for API
management, per the Domain 5 comparison?

A. They are functionally identical in every respect
B. Cloud Endpoints suits simpler internal-external API management; Apigee adds monetization/analytics/developer-portal capability for more advanced needs
C. Apigee only works with Cloud Functions
D. Cloud Endpoints cannot handle authentication

**Answer: B.** Matches Domain 5 §5.1's tradeoff table exactly. A
ignores meaningful capability differences. C is factually incorrect —
Apigee isn't scoped to a single backend compute type. D is factually
incorrect — Cloud Endpoints does support authentication.

---

**Q13.** Why would recommending Apigee for a purely internal,
no-monetization API be a wrong exam answer?

A. Apigee cannot be used for internal APIs at all
B. It adds unused capability/cost/complexity relative to the stated need — Cloud Endpoints fits better
C. Internal APIs never need any management tooling
D. Apigee is being deprecated

**Answer: B.** Matches the exam trap in Domain 5's own traps section —
picking Apigee "by reflex" without checking whether the extra
capability is actually needed. A is factually incorrect (Apigee can
manage internal APIs too — the issue is fit, not capability). C
understates the value of API management even for internal APIs. D is
factually incorrect/fabricated.

---

**Q14.** What is the primary benefit of Config Connector's
namespace-scoped resource model in a multi-tenant cluster?

A. It removes the need for any IAM configuration
B. It aligns GCP resource lifecycle with a specific team/app's namespace, fitting a self-service multi-tenant pattern
C. It disables all GCP API access from the cluster
D. It is required for every GKE cluster regardless of use case

**Answer: B.** Matches Domain 5 §5.2's governed self-service platform
discussion. A is factually incorrect — IAM still applies underneath.
C is the opposite of Config Connector's purpose. D overstates its
applicability — it's a fit-for-context choice, not a universal
requirement.

---

**Q15.** A scenario states a specialized GPU batch workload needs to
run alongside standard application pods on the same GKE cluster
without interfering with each other. What mechanism fits?

A. Run everything on the same untainted node pool
B. Node pools with taints/tolerations isolating the GPU workload to dedicated nodes
C. Move the GPU workload to Cloud Functions
D. Disable autoscaling entirely

**Answer: B.** Matches `02-services/01-compute.md`'s GKE node-pool
guidance and Domain 5 §5.1's specialized-workload discussion. A risks
resource contention/interference, the exact problem stated. C is
infeasible — Cloud Functions doesn't support GPU-heavy batch workloads
this way. D is unrelated to workload isolation.

---

**Q16.** Which best captures the correct interpretation of "advising
development/operations teams" (Domain 5 §5.1) as an exam topic?

A. It's purely about writing application code yourself
B. It's about recommending sound application-development and deployment practices on GCP — best-practice guidance, not hands-on coding
C. It only applies to security topics
D. It has no relationship to containerization or testing strategy

**Answer: B.** Matches Domain 5 §5.1's framing directly — architect-
level guidance on practices, not implementation coding. A misstates
the architect's role on this exam. C is too narrow — §5.1 spans
app-dev practices broadly, including containerization/testing. D
directly contradicts §5.1's stated content (both topics are explicitly
covered there).

---

**Q17.** A scenario needs a declarative, drift-detecting, human-
reviewable diff before every infrastructure change. Which tool
property is being described?

A. Console's change history
B. `terraform plan`'s output
C. A verbal status update in a meeting
D. Manual comparison of two Console screenshots

**Answer: B.** `terraform plan` is purpose-built for exactly this
(Domain 5 §5.2, Tree 6). A doesn't provide a pre-change diff in the
same structured way. C and D are informal, error-prone, and not
scalable/repeatable.

---

**Q18.** Which of the following is the best exam-answer pattern for
"scale and repeatability matter" per Tree 6's decision rules?

A. Console
B. `gcloud`/APIs/Terraform — not Console
C. Asking a teammate to remember the steps
D. A one-time manual script never reused

**Answer: B.** Directly quotes Tree 6's Rule 3
(`00-START-HERE/DECISION-TREES.md`). A, C, and D all fail the
"repeatability at scale" test the rule is built around.

---

**Q19.** What's the correct interpretation of "governance at scale" per
Tree 6's Rule 5?

A. Combine Org Policies, resource labeling, and automation — not per-project manual configuration
B. Give every project admin equal, unrestricted access
C. Governance only matters for a single project, not many
D. Governance is unrelated to labeling

**Answer: A.** Directly quotes Tree 6's Rule 5. B contradicts
least-privilege/governance principles (Domain 3 crossover). C misses
the "at scale, across many projects" framing entirely. D ignores
labeling's role in automated governance (cost + policy targeting).

---

**Q20.** A scenario states testing should occur across environments
before reaching production, including automated GKE version
compatibility checks. What best matches Domain 5 §5.1's testing
guidance?

A. Test only in production, since staging doesn't reflect real traffic
B. Test against the target GKE release channel/version in a non-prod cluster before upgrading production
C. Skip testing for minor version bumps
D. Rely solely on manual QA sign-off with no automated checks

**Answer: B.** Matches Domain 5 §5.1's GKE-versioning testing guidance
exactly. A contradicts standard testing-strategy expectations (Domain
4 §4.1 crossover) and risks production incidents. C dismisses a real
risk (even minor versions can introduce breaking changes). D misses
the "automated" requirement stated in the scenario.
