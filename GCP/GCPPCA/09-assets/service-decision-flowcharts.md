# Service Decision Flowcharts — Quick Index

> The full, explained decision trees live in
> `00-START-HERE/DECISION-TREES.md` (6 trees) — this file is a
> condensed flowchart index for rapid pre-exam scanning, each entry
> pointing to its full tree.

## Tree map

```
"What compute should I use?"          → Tree 1 (Compute)
"What storage/database should I use?" → Tree 2 (Storage/DB)
"How do I connect on-prem to GCP?"    → Tree 3 (Hybrid connectivity)
"How do I migrate this workload?"     → Tree 4 (6 R's)
"What HA/DR tier fits this RTO/RPO?"  → Tree 5 (HA/DR)
"Console, CLI, API, or IaC?"          → Tree 6 (Tool selection)
```

## One-line flowchart summaries (say the full tree from memory, then
check against `00-START-HERE/DECISION-TREES.md`)

```
Tree 1: container? → K8s features needed? → GKE (Std=control,
        Autopilot=no ops) : event-driven single-purpose? → Functions :
        full app runtime, no containers? → App Engine : else → Cloud
        Run. Full VM/kernel control? → Compute Engine. ML training/
        serving? → Vertex AI.

Tree 2: unstructured? → Cloud Storage. POSIX fs? → Filestore.
        Relational + global strong consistency? → Spanner. Relational,
        single-region fit? → Cloud SQL. Document + mobile/offline? →
        Firestore. Wide-column/time-series/huge throughput? →
        Bigtable. Analytics/SQL over huge data? → BigQuery. Cache
        only? → Memorystore.

Tree 3: near-zero-latency, high availability need? → throughput >10Gbps
        sustained? → Dedicated Interconnect : else → Partner
        Interconnect (or Dedicated if colo already exists). Else,
        time-to-provision is binding? → Cloud VPN. Growing number of
        sites? → wrap in Network Connectivity Center regardless of
        which underlying link type is chosen.

Tree 4: sunsetting anyway? → Retire. SaaS replacement exists? →
        Repurchase. Must stay on-prem for a real reason? → Retain.
        High value + long life + team bandwidth to re-architect? →
        Refactor. Minor changes unlock managed-service benefit? →
        Replatform. Else, deadline-driven? → Rehost.

Tree 5: RPO~0 AND RTO~0? → Active-Active. RTO minutes, RPO sec-min? →
        Active-Passive. RTO hours, RPO hours? → Warm Standby. RTO
        days, RPO ~day? → Backup & Restore.

Tree 6: one-off/exploratory? → Console. Repeatable + reviewed? →
        Terraform/Config Connector (K8s-native team → Config
        Connector). App-embedded automation? → Client libraries/APIs.
        Scriptable glue task? → gcloud/gsutil/bq CLI.
```

## Self-test protocol

1. Cover the full trees in `00-START-HERE/DECISION-TREES.md`.
2. Read only the one-line summary above for a given tree.
3. Reconstruct the full branching logic from memory, including the
   "exam trap" callout at the bottom of each tree.
4. Check against the source file — any branch you got wrong or
   couldn't reconstruct is your next study-session target for that
   tree.
