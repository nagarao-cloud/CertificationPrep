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
| Data layer example | Spanner multi-region, Firestore | Cloud SQL cross-region replica w/ promotion | Scaled-down replica/cluster | Scheduled Cloud SQL/Compute Engine backups |
| Compute layer example | Global LB + regional GKE/Cloud Run, all serving | Global LB + standby region at min capacity | Standby region scaled to near-zero, scaled up on trigger | No standing compute; restore from backup/image |
| Relative cost | Highest | High | Medium | Lowest |
| Best for | Mission-critical, "always on," global user base | Business-critical, tolerant of brief failover window | Cost-sensitive but needs a real DR path | Non-critical, cost-driven, tolerant of extended recovery |

## Tradeoff call-outs

- **Use Active-Active when** the scenario states near-zero RTO/RPO and
  a genuinely global, always-on requirement. **Don't use it when** the
  stated RTO/RPO tolerates minutes-to-hours — this tier's cost isn't
  justified without the near-zero requirement driving it (Domain 1 §1.1
  business-requirements tradeoff table).
- **Use Active-Passive when** the scenario needs fast, largely-automated
  failover but can tolerate a small, non-zero data-loss/downtime window.
  **Don't use it when** the workload can't tolerate *any* data loss —
  that pushes back to Active-Active's synchronous replication.
- **Use Warm Standby when** cost is a real constraint but the business
  still needs a defined, bounded RTO/RPO (not "eventually, somehow").
  **Don't use it when** the RTO the business needs is faster than a
  scale-up-on-trigger process can realistically deliver.
- **Use Backup & Restore when** the workload is explicitly described as
  non-critical or cost is the dominant constraint with a generous
  RTO/RPO tolerance. **Don't use it when** any availability language
  appears in the scenario ("customers expect," "cannot be down during
  business hours") — that's a signal the business actually wants more
  than pure backup/restore, even if they didn't use HA/DR vocabulary.

## Matching the RTO/RPO number to the tier

```
Stated tolerance                          Tier
"Zero data loss, always available"        Active-Active
"A few minutes of data loss/downtime OK"  Active-Passive
"Down for part of a business day OK"      Warm Standby
"A day of data loss/downtime OK"          Backup & Restore
```

## Common exam trap in this comparison

A scenario that *sounds* mission-critical (uses words like "critical,"
"important," "cannot fail") but states a generous, explicit RTO/RPO
number is testing whether you match the *design* to the *stated
number*, not to the emotional weight of the business description.
Conversely, a scenario that sounds modest ("small internal tool") but
states a near-zero RPO requirement (e.g. "payroll data, cannot lose any
record") should be answered with the strict tier despite the modest
framing. Read the number, not the adjectives.
