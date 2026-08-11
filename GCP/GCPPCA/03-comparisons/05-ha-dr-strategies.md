# Comparison: HA/DR Strategy Tiers

> Selection tree: `00-START-HERE/DECISION-TREES.md` Tree 5. Design
> guidance: Domain 6 §6.2.

## Full comparison matrix

| Dimension | Active-Active (multi-region) | Active-Passive (hot standby) | Warm Standby | Backup & Restore |
|---|---|---|---|---|
| RTO | Seconds | Minutes | Tens of minutes–hours | Hours–days |
| RPO | ~0 | Seconds–minutes | Minutes–hours | Hours–a day |
| Failover | Automatic, transparent | Automatic or fast manual promotion | Manual/automated scale-up trigger | Manual restore process |
| Standby capacity cost | Full duplicate capacity, always on | Full or near-full standby capacity | Minimal (scaled-down) standby | None (just stored backups) |
| Data layer example | Spanner multi-region, Firestore | Cloud SQL/AlloyDB cross-region replica w/ promotion | Scaled-down replica/cluster | Scheduled Cloud SQL/Compute Engine backups |
| Compute layer example | Global LB + regional GKE/Cloud Run, all serving | Global LB + standby region at min capacity | Standby region scaled to near-zero, scaled up on trigger | No standing compute; restore from backup/image |
| Relative cost | Highest | High | Medium | Lowest |
| Cost-model shape | Continuous double (or n-region) spend, always | Continuous near-double spend, standby often at reduced instance size but still running | Minimal continuous spend + burst cost only during an actual failover | Storage cost only, plus compute cost during a rare restore event |
| Monitoring/observability need | Cross-region SLO burn-rate monitoring, synthetic multi-region health checks | Standby-region health checks + failover-trigger monitoring | Standby-readiness checks (is the scaled-down environment actually still deployable/current) | Backup-job success/freshness monitoring is the *entire* observability surface — a silently failing backup job is the single biggest risk in this tier |
| IAM/security integration specifics | Identical IAM/security posture must be replicated and kept in sync across all active regions (drift between regions is a real risk) | Standby region's IAM/security config must be kept in lockstep with primary even though it's not serving traffic | Same lockstep requirement as Active-Passive, harder to catch drift since the standby is rarely exercised | Backup encryption (CMEK) and access to restore actions need their own tightly scoped IAM — a broadly-permissioned "restore" capability is itself a security risk |
| Typical failure mode | Split-brain or replication-lag edge cases under a network partition between regions; cost overrun if the "always on" duplicate capacity isn't actually needed | Failover tested rarely, so the promotion runbook silently rots and fails when actually needed | Scale-up-on-trigger takes longer than expected because the standby's deploy artifacts/config drifted from production | Backup job silently fails for weeks before anyone notices, discovered only during an actual disaster |
| Testing/validation practice | Continuous — every region is live and exercised by real traffic constantly (a structural advantage: you can't "forget" to test it) | Periodic failover drills required — an untested failover plan is not a validated one | Periodic scale-up drills required, ideally as often as Active-Passive drills | Periodic restore drills required — "we have backups" without a tested restore is not a validated DR plan |
| Migration/adoption friction (adopting this tier from a single-region baseline) | Highest — requires the data layer to natively support multi-region writes (Spanner, Firestore) or an application-level conflict-resolution strategy | Medium — requires setting up cross-region replication and a promotion runbook | Medium-low — requires a scaled-down standby environment and an automated scale-up trigger | Lowest — requires only a backup schedule and a documented restore procedure |
| Best for | Mission-critical, "always on," global user base | Business-critical, tolerant of brief failover window | Cost-sensitive but needs a real DR path | Non-critical, cost-driven, tolerant of extended recovery |

## Tradeoff call-outs

- **Use Active-Active when** the scenario states near-zero RTO/RPO and
  a genuinely global, always-on requirement. **Don't use it when** the
  stated RTO/RPO tolerates minutes-to-hours — this tier's cost isn't
  justified without the near-zero requirement driving it (Domain 1 §1.1
  business-requirements tradeoff table). **Edge case:** Active-Active
  also requires the data layer to actually *support* multi-region
  active writes (Spanner multi-region, Firestore) — proposing
  Active-Active compute in front of a data layer that can't do
  multi-region writes (e.g. a single Cloud SQL primary) doesn't
  actually deliver Active-Active semantics; it just adds compute
  redundancy on top of a single point of failure at the data layer, a
  design flaw the exam can test by describing exactly this mismatch.
- **Use Active-Passive when** the scenario needs fast, largely-automated
  failover but can tolerate a small, non-zero data-loss/downtime window.
  **Don't use it when** the workload can't tolerate *any* data loss —
  that pushes back to Active-Active's synchronous replication.
  **Near-miss trap vs. Warm Standby:** both have a "standby" region —
  the deciding signal is whether the standby runs at (near) full
  capacity ready for immediate promotion (Active-Passive) or at
  minimal/scaled-down capacity requiring a scale-up step before it can
  absorb full production load (Warm Standby). A scenario stating "RTO
  in minutes" fits Active-Passive; a scenario stating "RTO in tens of
  minutes to hours, cost-sensitive" fits Warm Standby even though both
  scenarios describe "a standby region."
- **Use Warm Standby when** cost is a real constraint but the business
  still needs a defined, bounded RTO/RPO (not "eventually, somehow").
  **Don't use it when** the RTO the business needs is faster than a
  scale-up-on-trigger process can realistically deliver. **Edge case:**
  a Warm Standby design is only as good as its *drilled* scale-up
  procedure — a scenario asking "how do you validate this design
  actually meets its stated RTO" is testing whether you'd propose
  periodic scale-up drills, not just trust the design on paper.
- **Use Backup & Restore when** the workload is explicitly described as
  non-critical or cost is the dominant constraint with a generous
  RTO/RPO tolerance. **Don't use it when** any availability language
  appears in the scenario ("customers expect," "cannot be down during
  business hours") — that's a signal the business actually wants more
  than pure backup/restore, even if they didn't use HA/DR vocabulary.
  **Edge case:** Backup & Restore's single biggest real-world failure
  mode is a backup job that silently stops succeeding — a scenario
  asking "what's missing from this DR plan" when only a backup schedule
  is described (no monitoring of backup-job success/freshness, no
  restore drill) is testing for exactly this gap.

## Near-miss traps summary (side-by-side pairs the exam expects you to separate)

| Pair | What makes them look similar | The actual deciding signal |
|---|---|---|
| Active-Active vs. Active-Passive | Both are "automatic failover," both keep a second region ready | RPO/RTO ≈ 0, all regions serve live traffic → Active-Active. Small non-zero RTO/RPO tolerance, standby not serving traffic → Active-Passive |
| Active-Passive vs. Warm Standby | Both have a non-serving standby region that gets promoted | Standby at (near) full capacity, minutes-level RTO → Active-Passive. Standby scaled down, requires a scale-up step, tens-of-minutes-to-hours RTO → Warm Standby |
| Warm Standby vs. Backup & Restore | Both are cost-conscious, both accept a slower RTO | A *standing* (even if minimal) environment exists and can be triggered → Warm Standby. No standing environment at all, purely stored data → Backup & Restore |
| "Sounds critical" vs. "states a generous RTO/RPO" | Both can appear in the same scenario | Emotional/business-criticality language ("mission-critical," "cannot fail") is a distractor — the stated RTO/RPO number is the actual answer key, every time |
| Multi-region HA vs. cross-region DR | Both involve more than one region | HA multi-region config folds failover into normal operation (e.g. Spanner) with no separate promotion step. DR-via-replica requires a distinct, explicit promotion action — conflating the two misrepresents how much manual intervention a design actually needs |

## Matching the RTO/RPO number to the tier

```
Stated tolerance                          Tier
"Zero data loss, always available"        Active-Active
"A few minutes of data loss/downtime OK"  Active-Passive
"Down for part of a business day OK"      Warm Standby
"A day of data loss/downtime OK"          Backup & Restore
```

## "Given this number/constraint in the scenario, which tier?" quick reference

```
"Global user base, cannot tolerate any downtime, financial
 transactions that must never be lost"                    → Active-Active
"Regional service, brief failover acceptable, automated
 promotion preferred over a manual runbook"                → Active-Passive
"Startup budget, but leadership wants a real DR story,
 can tolerate an hour or two of downtime"                  → Warm Standby
"Internal reporting tool, fine if it's down for most
 of a day during a rare disaster"                           → Backup & Restore
"Payroll data — small system, but zero record loss stated" → Active-Active or Active-Passive
 (despite modest-sounding system — the RPO number rules,
 not the system's apparent importance)
"'Mission-critical' language, but RTO of 4 hours stated"    → Warm Standby (not Active-Active — read the number)
"Compliance requires a documented, periodically-tested
 DR runbook"                                                → Any tier above Backup & Restore-only,
                                                                 paired with mandatory drill cadence
```

## RTO/RPO by architecture layer — a full design needs every layer covered

A scenario naming one overall RTO/RPO target implicitly requires *every*
layer of the architecture to meet it — a common exam trap is designing
Active-Active compute while leaving the data layer at a lower tier (or
vice versa), which silently caps the whole system's actual RTO/RPO at
its weakest layer.

| Layer | Active-Active equivalent | Active-Passive equivalent | Warm Standby equivalent | Backup & Restore equivalent |
|---|---|---|---|---|
| DNS/traffic routing | Global LB, automatic health-check-based failover | Global LB, automatic health-check-based failover | Global LB, redirected on trigger (may need a DNS/config change if not already load-balanced) | Manual DNS/config repointing during restore |
| Compute | All regions serving, autoscaled independently | Standby region running at or near production capacity, idle | Standby region scaled to near-zero, autoscaler triggered on promotion | No standing compute — provisioned fresh from IaC during restore |
| Data | Spanner multi-region / Firestore (native multi-region) | Cross-region read replica (Cloud SQL/AlloyDB), manually promoted | Scaled-down replica, promoted and scaled up together | Restore from the most recent backup — the RPO is bounded by backup frequency, not replication lag |
| Configuration/secrets | Replicated automatically alongside the active deployment | Kept in sync with the primary continuously (drift risk if not automated) | Kept in sync, but drift risk is higher since it's rarely exercised | Restored from IaC/config-management source of truth, not from a live secondary copy |
| Observability | Cross-region SLO/burn-rate dashboards, continuously exercised | Failover-readiness dashboards + periodic drill results | Scale-up-readiness dashboards + periodic drill results | Backup-job success/freshness alerting — the most important (and most often missing) signal in this tier |

## Common exam trap in this comparison

A scenario that *sounds* mission-critical (uses words like "critical,"
"important," "cannot fail") but states a generous, explicit RTO/RPO
number is testing whether you match the *design* to the *stated
number*, not to the emotional weight of the business description.
Conversely, a scenario that sounds modest ("small internal tool") but
states a near-zero RPO requirement (e.g. "payroll data, cannot lose any
record") should be answered with the strict tier despite the modest
framing. Read the number, not the adjectives.

## Worked scenario walkthroughs

**Scenario A — Helicopter Racing League, live broadcast platform.**
"During a live race broadcast, the platform cannot go down — any
outage during the broadcast window directly costs sponsorship revenue
and reputational damage; outside the broadcast window, a brief outage
is far less costly." Reasoning: this is a *time-varying* RTO/RPO
requirement, which the 4-tier framework doesn't natively express as a
single static tier — the exam-correct answer recognizes that HRL likely
needs Active-Active (or at minimum Active-Passive with a pre-validated,
drilled failover) specifically *during* live events, while a lower,
more cost-effective tier may be acceptable in between events. A
scenario like this is testing whether you'll propose a single static
answer or recognize that the stated requirement itself varies by time
window — architecture (and cost) can legitimately flex with it if the
platform supports dynamically scaling standby capacity up before each
broadcast.

**Scenario B — Mountkirk Games, regional launch.** "Mountkirk's new
title launches first in one region; leadership wants to keep costs
minimal during the initial launch phase but needs a documented plan for
what happens if the primary region has an outage during the first
critical weeks." Reasoning: "minimal cost" plus "documented plan" (not
"automatic, instant failover") points to **Warm Standby** — a
scaled-down standby region with a drilled scale-up procedure — rather
than Active-Active, which the stated cost sensitivity doesn't justify
this early in the launch, and rather than Backup & Restore alone, which
doesn't satisfy "documented plan for outage during critical weeks" as
strongly as a standing (if minimal) standby does.

## Backup and DR service vs. hand-rolled backup scripts

Google Cloud's managed **Backup and DR service** is the named product
this exam expects you to recognize for centralized backup/DR management
across Compute Engine, Cloud SQL, and other supported workloads — worth
distinguishing from simply "we wrote a cron job that snapshots things."

| Dimension | Backup and DR service | Hand-rolled backup scripts/cron jobs |
|---|---|---|
| Centralized policy management | Yes — one place to define retention/schedule across workload types | No — each script has its own logic, drifts independently |
| Application-consistent backups | Supported for compatible workloads | Depends entirely on what the script author implemented |
| Monitoring/alerting on backup health | Built-in | Must be custom-built, and is the piece most often skipped (see the "typical failure mode" row above) |
| Restore testing/orchestration | Built-in workflows | Manual, ad hoc, rarely exercised |
| Best for | A scenario naming multiple workload types needing consistent, auditable backup/DR governance | Rarely the exam-correct answer for a new design — recognize it as the legacy/anti-pattern a scenario may describe as the *current* state needing improvement |

**Tradeoff:** a scenario describing "each team manages its own backup
scripts, inconsistently, and leadership has no visibility into backup
health across the fleet" is describing the hand-rolled anti-pattern and
signaling the Backup and DR service as the fix — this is a Domain 6.2
"deployment and release management" pattern as much as a pure DR one,
since it's fundamentally an operational-governance gap.

## SLO burn-rate monitoring and error budgets (Domain 6.1 tie-in)

HA/DR tier selection and **error-budget-driven operations** are related
but distinct: the HA/DR tier determines what happens during an actual
regional/zonal failure, while SLO burn-rate monitoring determines how
quickly you *notice and respond* to degradation before or short of a
full failover event.

- **Fast burn-rate alerting** (consuming the error budget quickly, e.g.
  a spike of 5xx errors) should page immediately — relevant regardless
  of HA/DR tier, since even an Active-Active design can have a
  region-local degradation that burns the budget without triggering a
  full failover.
- **Slow burn-rate alerting** (a steady, low-level elevated error rate)
  is a signal to investigate before it becomes an incident, not
  necessarily to fail over — a scenario testing burn-rate reasoning
  wants you to distinguish "page now" from "file a ticket," which maps
  to fast vs. slow burn rate respectively, not to the HA/DR tier
  question at all.
- **A generous HA/DR tier does not substitute for SLO monitoring** — a
  scenario proposing Active-Active with no monitoring/alerting strategy
  is still an incomplete design per Domain 6.1; the tier limits how bad
  an outage *can* get, monitoring determines how fast you find out
  something is wrong in the first place.

## Worked scenario walkthroughs (continued)

**Scenario C — TerramEarth, internal analytics reporting.** "A monthly
internal report summarizing fleet telemetry trends is generated from a
data warehouse; if the warehouse were unavailable for a day, report
generation would simply run late with no material business impact."
Reasoning: explicitly stated tolerance for a day of unavailability with
"no material business impact" is the clean **Backup & Restore** signal
— proposing anything above this tier for a workload the scenario itself
frames as low-stakes and cost-driven would be over-engineering relative
to the stated requirement, the same trap pattern flagged throughout
this file's tradeoff call-outs.

## Case-study alignment at a glance

A quick sanity-check table — not a substitute for reading each
scenario's actual stated RTO/RPO, but a reminder that the "obvious"
tier per case study isn't always uniform across every subsystem within
it (see the RTO/RPO-by-layer table above for why a single case study
can legitimately mix tiers across its own components):

| Case study | Component most likely to need Active-Active/Active-Passive | Component more likely to fit Warm Standby/Backup & Restore |
|---|---|---|
| EHR Healthcare | Patient-record access during clinical hours | Historical/archival compliance reporting |
| Helicopter Racing League | Live broadcast ingest/streaming during race windows | Post-race analytics/highlight-generation pipeline |
| Mountkirk Games | Live matchmaking/gameplay during and after launch | Internal analytics dashboards, non-live leaderboards |
| TerramEarth | Real-time telemetry ingestion (fleet safety-relevant alerts) | Monthly/quarterly aggregate reporting |