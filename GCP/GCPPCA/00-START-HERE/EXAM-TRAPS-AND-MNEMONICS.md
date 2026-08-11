# PCA Exam Traps and Mnemonics

## Top 15 cross-domain exam traps

1. **Over-engineering trap.** The scenario describes a small/simple
   workload; the tempting answer is the most sophisticated
   architecture (multi-region Spanner, global Anycast LB, full
   service mesh). If the stated scale/budget doesn't justify it,
   it's wrong — PCA rewards *right-sized*, not *most advanced*.
2. **Security-only-lens trap.** A question stem loaded with compliance
   language (HIPAA, PCI) tempts you to pick the most locked-down
   option even when it violates the stated *business* requirement
   (e.g. public API needed for partners). Security is a constraint to
   satisfy, not the only objective to maximize.
3. **"New shiny" bias.** Vertex AI / Gemini / the newest-sounding
   service is not automatically the right answer just because it's
   least familiar and most 2026-flavored — check it actually matches
   the stated need.
4. **Ignoring data gravity.** Compute placement should follow where the
   data already lives (region, on-prem) unless the scenario states data
   is also moving. A "low latency" answer that ignores where the
   dataset sits is wrong.
5. **Misreading scale indicators.** "2 million IoT devices" (TerramEarth)
   is a Bigtable/Pub&#8203;/Sub-scale signal, not a Cloud SQL signal — scan
   every number in the stem for what tier of service it implies.
6. **Forgetting operational reality.** An architecturally "correct"
   design that the team cannot operate (no Kubernetes experience, no
   on-call for a 24/7 stateful service) is still the wrong answer if the
   scenario states the team's capability constraint.
7. **Assuming global when regional suffices.** Global resources (global
   LB, multi-region Spanner) cost more and add complexity; only choose
   them when the stated user base or compliance requirement is actually
   multi-region.
8. **Over-relying on IAM conditions/complexity.** A simpler
   resource-hierarchy fix (move to a folder with the right Org Policy)
   often beats a complex custom IAM Condition — prefer the simpler
   control that achieves the same guarantee.
9. **Ignoring the business impact of a "technical" requirement.** A
   stated RTO/RPO is a business decision already made for you — don't
   second-guess it into a cheaper tier "because it's probably fine."
10. **Legacy bias.** Recommending Deployment Manager, App Engine
    Flexible, exported service-account key files, or classic
    VPC-network patterns when a modern managed equivalent exists and
    nothing in the scenario forces the legacy choice.
11. **Confusing HA with DR.** High availability (surviving a zone/node
    failure, automatic, seconds) is not the same guarantee as disaster
    recovery (surviving a regional/catastrophic failure, often
    involves data loss/RTO). A scenario asking for DR is not satisfied
    by a multi-zone-only design.
12. **Cost-optimization tunnel vision.** The cheapest answer that
    silently breaks the stated availability or compliance requirement
    is wrong — cost is one pillar of WAF, not the only one.
13. **Forgetting the org/resource-hierarchy layer.** Many "how do we
    enforce X across many projects" questions are Org Policy /
    resource-hierarchy questions in disguise, not per-resource IAM
    questions.
14. **Treating case-study text as flavor, not constraints.** Every
    sentence in a case study (team size, current pain point, stated
    priority) can be the deciding constraint for a specific question —
    re-read the relevant case-study paragraph before answering, don't
    answer from memory of "what EHR Healthcare is about" in general.
15. **Picking the multi-select question's "best single" answer.** Some
    questions are multiple-select — check the "(Choose two)"/"(Choose
    three)" instruction; a fully correct single answer to a
    two-answer question scores zero.

## Mnemonics

### WAF pillars — "SCoPE + Ro" (memory aid, not an official acronym)

- **S**ecurity
- **C**ost optimization
- **o**perational excellence
- **P**erformance optimization
- **E**fficiency/sustainability
- **Ro** = **R**eliability (kept separate to avoid double-counting with
  "R" already used for Refactor in the 6 R's below)

Say it as: *"Six pillars, one Framework — Security, Cost, Ops-excellence,
Performance, sustainability(Efficiency), Reliability."*

### Migration strategies — "RRRRTR" (the 6 R's, in effort-ascending order)

**Re**tire → **Re**purchase → **Re**tain → **Re**host → Re**p**latform →
**Re**factor

Read as increasing commitment: *retire it, buy it, keep it as-is, lift
it, tinker-then-shift it, or rebuild it.*

### Storage/DB picker — "SODA BFF"

- **S**panner — global relational, strong consistency
- **O**bject storage (Cloud Storage) — unstructured, any scale
- **D**ocument (Firestore) — mobile/web, offline sync
- **A**nalytics (BigQuery) — SQL over petabytes
- **B**igtable — wide-column, huge throughput
- **F**ile (Filestore) — POSIX NFS
- **F**ast cache (Memorystore) — in-memory, not system of record

### Compute picker — "FARM CGV"

- **F**unctions (Cloud Functions) — event-driven, smallest unit
- **A**pp Engine — legacy PaaS, sandboxed runtime
- **R**un (Cloud Run) — stateless containers, scale-to-zero
- **M**anaged K8s (GKE) — Standard (control) or Autopilot (no ops)
- **C**ompute Engine — full VM control
- **G**PU/TPU workloads — Vertex AI or Compute Engine w/ accelerators
- **V**ertex AI — ML training/serving specifically

### HA vs DR — "S.C.A.L.E."

- **S**cope: zone failure (HA) vs. region/catastrophic failure (DR)
- **C**ost: HA is baseline; DR tiers cost more as RTO/RPO shrink
- **A**utomation: HA failover is automatic; DR failover may be
  manual/orchestrated depending on tier
- **L**oss tolerance: map stated RPO to the tier (see Tree 5 in
  `DECISION-TREES.md`)
- **E**xecution time: map stated RTO to the tier

### Probe selection — "P.R.O.B.E."

- **P**urpose: liveness = "restart me if I'm stuck", readiness =
  "don't route to me if I'm not ready"
- **R**estart behavior: only liveness-probe failures trigger a restart
- **O**utage risk: aggressive liveness thresholds can cause
  restart-loops under load — this is a common exam trap
- **B**ackoff: readiness failures just pull traffic, no restart
- **E**xam tell: "users get errors during a deploy/slow-start" →
  readiness probe misconfiguration, not liveness

### Hotspotting prevention — "S.A.L.T."

- **S**huffle/salt row keys (Bigtable) to avoid sequential hot rows
- **A**void monotonically increasing keys (timestamps as a raw prefix)
- **L**oad-spread the write path (reversed timestamps, hashing)
- **T**est with realistic key distributions, not synthetic uniform load

### Observability layers — "M.A.P.S."

- **M**onitoring — metrics, uptime checks, SLOs
- **A**lerting — policies on top of monitoring signals
- **P**rofiling/tracing — Cloud Profiler / Cloud Trace for
  latency/resource root-cause
- **S**inks — Cloud Logging routing to BigQuery/Storage/Pub/Sub for
  long-term retention and analysis

## Quick "which case study is this" fingerprints

| If the stem mentions… | It's probably… |
|---|---|
| Hospitals, clinics, HIPAA, patient records | EHR Healthcare |
| Live streaming, drones/helicopters, real-time commentary | Helicopter Racing League |
| Multiplayer game, launch spikes, leaderboards | Mountkirk Games |
| Farm/construction equipment, 2M devices, intermittent connectivity | TerramEarth |

Full depth for each: `04-architectures/case-study-*.md`.
