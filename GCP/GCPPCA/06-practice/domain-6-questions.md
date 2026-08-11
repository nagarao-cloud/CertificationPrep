# Practice Questions — Domain 6: Ensuring Reliability (~12% weight)

> 20 questions, every option explained.

---

**Q1.** Users report errors immediately after a new pod starts, before
it's fully warmed up, but the pod is never restarted. What should be
tuned?

A. The liveness probe threshold
B. The readiness probe threshold
C. The MIG autoscaler
D. The Cloud NAT configuration

**Answer: B.** Readiness controls traffic routing to a not-yet-ready
pod — exactly this symptom (Domain 6 §6.2, P.R.O.B.E. mnemonic). A is
the classic trap here — tightening liveness would cause restart-loops
instead of fixing the actual issue (traffic routing, not container
health). C and D are unrelated to this specific symptom.

---

**Q2.** A Bigtable cluster shows hotspotting on writes despite having
ample node capacity. What's the correct fix?

A. Add more Bigtable nodes
B. Redesign the row key (salt/hash/reverse) to distribute load
C. Switch to Cloud SQL
D. Increase the cluster's replication factor

**Answer: B.** Hotspotting is a key-design problem, not a capacity
problem (Domain 6 §6.2, S.A.L.T. mnemonic, Domain 6 exam trap #3). A
doesn't fix a hot key regardless of how many nodes exist. C is a
disproportionate response unrelated to the actual root cause. D adds
read scaling/DR capability, not a fix for write hotspotting.

---

**Q3.** A scenario needs automatic regional failover for a relational
database with strong consistency, not just zone-level HA. What should
be used?

A. Cloud SQL regional HA alone
B. Cloud Spanner (multi-region configuration)
C. A single-zone Cloud SQL instance
D. Memorystore

**Answer: B.** Cloud SQL regional HA only covers zone failure, not
automatic regional failover (Domain 6 §6.2's explicit gap). A misses
the "automatic regional failover" requirement. C is strictly worse
(no HA at all). D isn't a relational, durable system of record.

---

**Q4.** Which Cloud Monitoring alerting condition type is required to
catch a service that has stopped reporting metrics entirely (e.g.
crashed or network-partitioned)?

A. Threshold-based alert
B. Absence-of-signal alert
C. Rate-of-change alert
D. No alert type can catch this

**Answer: B.** A threshold alert never fires if there's no data to
threshold against — absence-of-signal is purpose-built for exactly
this gap (Domain 6 §6.1). A and C both require *some* signal to
evaluate against, which is precisely what's missing here. D is
factually incorrect.

---

**Q5.** Which HA/DR tier best fits a scenario stating "near-zero RTO
and RPO, globally, always available"?

A. Backup & Restore
B. Warm Standby
C. Active-Active (multi-region)
D. Active-Passive

**Answer: C.** Matches Tree 5 (`00-START-HERE/DECISION-TREES.md`)
exactly — near-zero RTO/RPO maps to Active-Active. A and B both have
RTO/RPO far looser than "near-zero." D is closer but still involves a
failover step with some (however small) delay/data-loss window,
not matching "always available" as tightly as Active-Active.

---

**Q6.** A Global External Application Load Balancer sits in front of a
single-region Cloud SQL database. Does this deliver regional DR?

A. Yes, the global LB alone provides full regional failover
B. No — the LB routes traffic globally, but the data layer must also be able to fail over for the pattern to actually work
C. Yes, because Cloud SQL is inherently multi-region by default
D. No, because global load balancers don't exist in GCP

**Answer: B.** Matches Domain 6 exam trap #4 exactly — LB and database
tiers must be designed together. A ignores the data layer entirely. C
is factually incorrect — Cloud SQL is regional by default. D is
factually incorrect — global LBs are a real, common GCP feature.

---

**Q7.** Which Dataflow concept correctly handles late-arriving,
out-of-order streaming data without dropping it?

A. Ignoring timestamps entirely
B. Windowing + watermarks + triggers configured for late data
C. Switching to a purely batch pipeline
D. Increasing Bigtable node count

**Answer: B.** Matches Domain 6 §6.2 and the TerramEarth case study's
core lesson (`04-architectures/case-study-terramearth.md`). A would
process data incorrectly/out of order. C loses the real-time
processing capability the scenario likely still needs. D is unrelated
to a Dataflow windowing/triggers problem.

---

**Q8.** What is Compute Engine's default behavior when the underlying
hardware needs maintenance?

A. The VM is deleted permanently
B. The VM is transparently live-migrated to different hardware for most machine types, without a required reboot
C. The VM is stopped and the customer must manually restart it
D. There is no maintenance mechanism; VMs run on the same hardware forever

**Answer: B.** Matches Domain 6 §6.2's maintenance/patching section —
live migration is on by default for most machine types. A, C, and D
each misstate this default behavior.

---

**Q9.** Which Cloud Logging sink is most appropriate for ad hoc SQL
analysis of log data across a long time range?

A. Pub/Sub sink
B. BigQuery sink
C. No sink — use the Cloud Logging console only
D. Cloud Storage sink with no further processing

**Answer: B.** Matches Domain 6 §6.1's sink-selection table — BigQuery
is the right destination when the need is SQL-based analysis. A is
built for real-time downstream processing, not ad hoc analysis. C
relies on default retention windows, not ideal for long-range
analysis. D is better suited to compliance archival than active
analysis.

---

**Q10.** A scenario describes sudden traffic spikes that consistently
outpace the autoscaler's reaction time. What mitigation fits?

A. Do nothing — autoscaling always reacts instantly
B. Add a capacity buffer (overprovisioning) or raise the `min instances` floor
C. Disable autoscaling entirely and run at a fixed size
D. Reduce the health check frequency

**Answer: B.** Matches Domain 6 §6.2's dynamic-scaling guidance
directly — a buffer absorbs the reactive-autoscaling latency gap. A is
factually incorrect — autoscaling has inherent reaction latency. C
removes elasticity entirely, a worse outcome. D is unrelated to the
stated scaling-latency problem.

---

**Q11.** Which best describes GKE's Cluster Autoscaler vs. Horizontal
Pod Autoscaler?

A. They are the same mechanism
B. HPA scales pod replica count based on metrics; Cluster Autoscaler scales the number of nodes to accommodate pending pods
C. HPA scales nodes; Cluster Autoscaler scales pods
D. Neither is relevant on GKE Autopilot

**Answer: B.** Matches Domain 6 §6.2's dynamic-scaling table exactly.
A conflates two distinct, complementary mechanisms. C reverses their
actual roles. D is wrong for HPA (still relevant on Autopilot — pods
still scale); Cluster Autoscaler specifically is invisible/managed on
Autopilot, but the underlying node-scaling behavior still occurs.

---

**Q12.** A scenario needs long-term, tamper-evident log retention for
a compliance audit spanning several years. What's correct?

A. Default Cloud Logging retention
B. Cloud Storage sink with a retention policy/Bucket Lock configured for the required duration
C. No logging configuration is needed for compliance
D. A log-based metric alone

**Answer: B.** Matches Domain 6 §6.1's tradeoff table — matches the
same reasoning as the Domain 3 compliance-logging question, applied
here from Domain 6's observability angle. A's default retention is
time-limited, not built for multi-year compliance archives. C ignores
a stated compliance requirement entirely. D produces a metric, not a
retained, auditable log record.

---

**Q13.** Which is the correct interpretation of "Cloud Run min
instances > 0"?

A. It guarantees zero cost regardless of traffic
B. It keeps a floor of warm instances running, eliminating cold starts for latency-sensitive services at the cost of paying for idle capacity
C. It disables autoscaling entirely
D. It is required for every Cloud Run service

**Answer: B.** Matches `02-services/01-compute.md`'s Cloud Run section
and Domain 6 §6.2's scaling guidance. A is factually incorrect — a
non-zero floor means non-zero baseline cost. C is factually incorrect
— autoscaling above the floor still functions normally. D overstates
its necessity — it's a fit-for-purpose setting, only needed when
cold-start latency conflicts with the stated SLO.

---

**Q14.** What does Cloud Trace provide that Cloud Monitoring's
infrastructure metrics do not?

A. CPU/memory utilization graphs
B. A cross-service latency breakdown showing where time is spent across a multi-hop request path
C. Cost breakdown by project
D. IAM policy auditing

**Answer: B.** Matches Domain 6 §6.1 and
`02-services/06-management-operations.md` — Trace's specific value is
cross-service latency visibility, distinct from per-resource infra
metrics. A is what Monitoring already provides. C and D are unrelated
capabilities (Billing export and Cloud Audit Logs, respectively).

---

**Q15.** A scenario states a company wants centralized backup
governance/reporting across a heterogeneous mix of Compute Engine,
Cloud SQL, and GKE workloads. What should they use?

A. Each service's own native backup feature, managed entirely
   separately with no central visibility
B. Backup and DR Service
C. Manual snapshots taken ad hoc by whoever remembers
D. No backup strategy is needed if Compute Engine has live migration

**Answer: B.** Matches `02-services/06-management-operations.md`'s
Backup and DR Service section — purpose-built for centralized,
cross-service backup governance. A lacks the "single pane of glass"
the scenario explicitly wants. C is unreliable and not centrally
governed. D conflates live migration (hardware-maintenance continuity)
with backup/recovery (an entirely different failure mode: data loss/
corruption, not hardware maintenance).

---

**Q16.** Which best describes the correct order of operations during a
DR failover drill, per Lab 5's guidance?

A. Promote the replica only — traffic redirection is unnecessary
B. Promote the replica, then redirect application traffic/routing to the newly-promoted instance, then verify data and measure actual RTO/RPO
C. Measure RTO/RPO before any failover action is taken
D. Skip measurement — the architecture diagram alone proves the DR plan works

**Answer: B.** Matches `05-labs/lab-05-dr-failover-cloud-sql.md`'s
step sequence exactly — failover isn't complete until traffic is
actually redirected, and only then can RTO/RPO be measured accurately.
A misses a required step (the common "DR is purely a data-layer
concern" gap flagged in that lab). C is out of order — RTO/RPO can
only be measured after the drill actually runs. D contradicts the
lab's entire premise — an undrilled DR plan is a documentation
exercise, not a verified control (Domain 4 §4.1 crossover).

---

**Q17.** What's the correct reason Cloud Storage object-name prefixes
matter at extreme request rates?

A. They never matter regardless of request rate
B. Sequential/incrementing prefixes can create hot ranges under very high-throughput write patterns, similar in principle to Bigtable row-key hotspotting
C. Object names must always be random for any workload
D. Cloud Storage does not support custom object names

**Answer: B.** Matches Domain 6 §6.2's data-integrity section — the
same hotspotting principle applied to Cloud Storage at extreme scale,
not just Bigtable. A understates a real (if narrower) concern. C
overstates the requirement — this only matters at very high throughput,
not for typical workloads. D is factually incorrect.

---

**Q18.** A scenario describes GKE surge upgrades during a rollout.
What is the purpose of `maxSurge`/`maxUnavailable`-equivalent settings
in this context?

A. They control IAM permissions during the rollout
B. They balance rollout speed against risk by controlling how many extra/unavailable pods are allowed during the update
C. They are unrelated to reliability
D. They only apply to Compute Engine, never GKE

**Answer: B.** Matches Domain 6 §6.2's maintenance/patching and
Domain 5 §5.2's parallel discussion — directly the rollout-tuning
mechanism. A is unrelated to IAM. C understates their reliability
relevance (rollout risk is a core reliability concern). D is factually
incorrect — GKE has its own analogous rolling-update controls.

---

**Q19.** Which best matches the correct use of GKE Autopilot's node
scaling behavior compared to GKE Standard's Cluster Autoscaler?

A. Autopilot requires manual node scaling configuration identical to Standard
B. Autopilot manages node-level scaling invisibly; Standard requires explicit Cluster Autoscaler configuration
C. Neither supports any form of autoscaling
D. Autopilot cannot scale below or above a fixed node count ever

**Answer: B.** Matches `02-services/01-compute.md`'s Standard vs.
Autopilot comparison directly. A is factually incorrect. C is
factually incorrect for both. D misstates Autopilot's actual behavior
— it does scale, just without exposing the node-level configuration
surface.

---

**Q20.** A scenario states a company wants to validate their DR plan
regularly rather than assume it still works. What process (not
technology) addresses this?

A. A one-time DR architecture review at initial design time only
B. Scheduled DR drills that measure actual RTO/RPO and feed findings back into runbook updates
C. Trusting the architecture diagram without further verification
D. Waiting for a real disaster to test the plan for the first time

**Answer: B.** Matches Domain 4 §4.1's process guidance and Lab 5's
drill methodology — regular, measured drills, not a one-time
architectural sign-off. A is a one-time action, not the ongoing
process the scenario describes. C is exactly the failure mode Domain 4
warns against — architecture on paper isn't a verified control. D is
the highest-risk option — the worst time to discover a DR plan doesn't
work is during an actual disaster.
