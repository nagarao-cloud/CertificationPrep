# Domain 6 Cheat Sheet — Ensuring Reliability (~12%)

> Compressed by design. Full depth:
> `01-domains/DOMAIN-6-ensuring-reliability.md`.

## HA/DR tier picker (Tree 5 summary)

```
RTO ~0, RPO ~0          → Active-Active (multi-region, e.g. Spanner)
RTO minutes, RPO sec-min → Active-Passive (hot standby, auto/fast promote)
RTO hrs, RPO hrs         → Warm Standby (scaled-down, scale up on failover)
RTO days, RPO ~day       → Backup & Restore
```
Match the tier to the **stated number**, not to how "important" the
workload sounds.

## Probe one-liners (P.R.O.B.E.)

- Liveness fails → restart. Readiness fails → stop routing traffic, no restart.
- Errors right after pod start, pod never restarts → tune **readiness**, not liveness (classic trap).

## Hotspotting one-liners (S.A.L.T.)

- Bigtable/Cloud Storage hot writes → redesign the key (salt/hash/reverse), not "add more nodes."
- Sequential/monotonic keys (timestamps, incrementing IDs) are the usual culprit.

## Observability one-liners (M.A.P.S.)

- External reachability check → Uptime checks (not just internal metrics)
- No signal at all (crash/partition) → Absence-of-signal alert (threshold alerts can't catch this)
- Cross-service latency breakdown → Cloud Trace
- Per-service CPU/memory root-cause → Cloud Profiler
- Long-term/compliance log retention → Cloud Storage sink + retention policy/Bucket Lock (not default Cloud Logging retention)

## Failover mechanics one-liners

- Global LB ≠ automatic regional DR by itself — the data layer must fail over too
- Cloud SQL regional HA = zone-failure protection only; regional failure needs a cross-region replica + manual promotion, or Spanner
- Live migration is Compute Engine's default maintenance behavior (most machine types) — not a DR mechanism, a hardware-maintenance one
- DR plans must be drilled (measure actual RTO/RPO), not just diagrammed

## Top traps

1. Assuming Cloud SQL regional HA covers regional failure
2. Tuning liveness for a readiness-shaped problem
3. Adding Bigtable nodes to fix a row-key design problem
4. Global LB alone assumed to deliver regional DR
