# Domain 5 Cheat Sheet — Managing Implementation (~11%)

> Compressed by design. Full depth:
> `01-domains/DOMAIN-5-managing-implementation.md`.

## API management one-liners

- External partners, monetization/portal → Apigee
- Internal-only, simple → Cloud Endpoints
- Serverless → private VPC resource → Serverless VPC Access connector / direct VPC egress

## Tool selection (Tree 6 summary)

```
One-off/exploratory        → Console
Repeatable, peer-reviewed  → Terraform / Config Connector
App-embedded automation    → Client libraries / REST-RPC APIs
Scriptable glue/ops task   → gcloud/gsutil/bq CLI
```

## Decision rules (memorize verbatim-ish)

1. Deployment safety → traffic splitting
2. K8s YAML + GCP resources together → Config Connector
3. Scale & repeatability → `gcloud`/APIs/Terraform, not Console
4. Serverless → private VPC access → VPC Connector/PSC
5. Governance at scale → Org Policies + labeling + automation, not per-project manual config

## Implementation-time testing/rollback one-liners

- GKE version safety → release channel (Rapid/Regular/Stable), test in non-prod first
- Fast, low-risk rollback → traffic-split back to prior Cloud Run/Functions revision (not a rebuild)
- Legacy monolith, minimal code change → containerize as-is (Replatform-style), not a rewrite

## Top traps

1. Terraform by default even when the team is explicitly K8s-native/GitOps (→ Config Connector)
2. Console for anything recurring/automated/multi-project
3. Apigee by reflex without checking for an actual monetization/portal need
