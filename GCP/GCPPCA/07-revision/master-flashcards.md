# Master Flashcards

> Compressed by design — terse Q/A pairs for final-day spaced
> repetition. Full explanations live in `01-domains/`, `02-services/`,
> `03-comparisons/`, and `04-architectures/`. Cover the answer, read the
> question, say the answer out loud before revealing it.

## Exam facts

Q: Questions / duration / cost / validity?
A: 50–60 questions / 2 hours / $200 / 2 years.

Q: How many domains, and their approximate weights?
A: 6 — Design&Plan 24%, Manage&Provision 15%, Security&Compliance 20%,
Analyze&Optimize 18%, Managing Implementation 11%, Reliability 12%.

Q: Case studies?
A: 4 total (EHR Healthcare, Helicopter Racing League, Mountkirk Games,
TerramEarth), 2 shown per exam, 20–30% of questions. Dress4Win is
retired, not current.

## Compute

Q: GKE Standard vs Autopilot — who picks which?
A: Standard = team wants node-level control. Autopilot = team wants
K8s API without ops burden.

Q: Fastest cold-start serverless container option?
A: Cloud Run.

Q: When is Compute Engine the right answer?
A: BYOL/licensing, custom kernel/drivers, sole-tenancy.

## Storage/DB

Q: Only GCP DB with both SQL semantics and global horizontal write
scale + strong consistency?
A: Cloud Spanner (multi-region config).

Q: Wide-column, IoT/time-series, huge throughput?
A: Bigtable — row-key design, not node count, is the main lever.

Q: Mobile app, offline sync, real-time listeners?
A: Firestore (native mode).

Q: Cloud SQL's blind spot?
A: Regional HA covers zone failure only, not automatic regional
failover.

## Networking

Q: VPC Peering's key limitation?
A: Not transitive; no shared quota.

Q: Many spokes, growing hybrid footprint — what avoids the peering
mesh problem?
A: Network Connectivity Center (hub-and-spoke).

Q: Publish one service privately with minimal exposure?
A: Private Service Connect (not full Peering).

Q: Outbound-only internet for private instances?
A: Cloud NAT (never a self-managed NAT instance).

Q: PGA vs PSC direction?
A: PGA = your VMs reach Google APIs. PSC = you can also publish your
own service for others to consume privately.

## Security

Q: 2026-era default over exported service-account keys?
A: Workload Identity Federation (external) / Workload Identity (GKE).

Q: Restrict a configuration org-wide, no exceptions?
A: Organization Policy constraint (not IAM).

Q: Stop exfiltration by a valid, authenticated identity?
A: VPC Service Controls.

Q: "We rotate our own keys, don't want to manage HSMs"?
A: CMEK via Cloud KMS.

Q: "Key material must never touch Google"?
A: CSEK / Cloud EKM.

Q: Prove Google-side (not customer-side) access to data?
A: Access Transparency.

Q: Fast path to a named compliance regime (FedRAMP, IL4)?
A: Assured Workloads.

## Cost/Optimization

Q: Steady, predictable load discount mechanism?
A: Committed Use Discounts.

Q: Fault-tolerant, interruptible workload discount mechanism?
A: Preemptible/Spot VMs.

Q: Ongoing, automated savings discovery without a FinOps team?
A: Recommender API.

Q: Cost-question framing on this exam?
A: Dual-constraint — minimize cost subject to not violating a stated
SLA/SLO.

## Release management

Q: Validate a change on a small % of real traffic first?
A: Canary (traffic splitting).

Q: Instant full-environment cutover, easy rollback, costs 2x during switch?
A: Blue/green.

## Reliability

Q: RTO~0/RPO~0 tier?
A: Active-Active multi-region.

Q: Liveness vs readiness probe — traffic routing?
A: Readiness controls traffic routing to a not-yet-ready pod. Liveness
triggers restarts. Errors right after pod start = tune readiness.

Q: Hotspotting fix?
A: Redesign the key (salt/hash/reverse), not "add more nodes."

Q: Catches a service with zero reported metrics?
A: Absence-of-signal alert (threshold alerts need data to threshold
against).

## Migration (6 R's)

Q: Order (increasing effort/commitment)?
A: Retire → Repurchase → Retain → Rehost → Replatform → Refactor.

Q: Hard deadline, stable app?
A: Rehost.

Q: High value, long life, time to invest?
A: Refactor.

## Mnemonics quick-fire

Q: WAF pillars mnemonic?
A: SCoPE + Ro — Security, Cost, operational excellence, Performance,
Efficiency/sustainability, Reliability.

Q: Migration R's mnemonic?
A: RRRRTR.

Q: Storage/DB picker mnemonic?
A: SODA BFF — Spanner, Object storage, Document(Firestore), Analytics
(BigQuery), Bigtable, File(Filestore), Fast cache(Memorystore).

Q: Compute picker mnemonic?
A: FARM CGV — Functions, App Engine, Run, Managed K8s(GKE), Compute
Engine, GPU/TPU, Vertex AI.

Q: HA vs DR mnemonic?
A: S.C.A.L.E. — Scope, Cost, Automation, Loss tolerance, Execution
time.

Q: Probe mnemonic?
A: P.R.O.B.E. — Purpose, Restart behavior, Outage risk, Backoff, Exam
tell.

Q: Hotspotting mnemonic?
A: S.A.L.T. — Shuffle/salt keys, Avoid monotonic keys, Load-spread
writes, Test with realistic distributions.

Q: Observability mnemonic?
A: M.A.P.S. — Monitoring, Alerting, Profiling/tracing, Sinks.

## Case study one-liners

Q: EHR Healthcare's #1 constraint?
A: Compliance/data residency — overrides cost and even some
availability tradeoffs. DR target must stay within the same
compliance boundary.

Q: Helicopter Racing League's #1 constraint?
A: Global low latency for live video — plus bursty, event-driven load
(pre-scale ahead of known race schedule, don't run peak capacity
always-on).

Q: Mountkirk Games' key lesson?
A: Not every subsystem needs the same consistency/latency tradeoff —
regional game-session servers for latency, global Spanner for
accounts/identity specifically.

Q: TerramEarth's key lesson?
A: Intermittent connectivity means late-arriving data is the *normal*
case — configure Dataflow watermarks/triggers for it, don't use naive
window-close-drops-late-data defaults.

## Top 5 cross-domain traps (say these before walking into the exam)

1. Over-engineering — don't pick the fanciest answer without a stated
   reason.
2. Security-only lens — security is a constraint to satisfy, not the
   only objective.
3. Ignoring operational reality/team capability stated in the scenario.
4. Confusing HA (zone-level, automatic) with DR (region-level, often
   involves data loss/RTO).
5. Multi-select questions ("choose two/three") — a single fully-correct
   answer scores zero if the question wants more than one.
