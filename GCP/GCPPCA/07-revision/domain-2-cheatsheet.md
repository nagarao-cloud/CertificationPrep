# Domain 2 Cheat Sheet — Managing and Provisioning (~15%)

> Compressed by design. Full depth:
> `01-domains/DOMAIN-2-managing-provisioning.md`.

## Network provisioning one-liners

- Production VPC → custom-mode, never auto-mode
- Org-wide, override-proof firewall rule → hierarchical firewall policy (folder/org level)
- Private instance needs outbound internet → Cloud NAT (never self-managed NAT instance)
- Private cross-VPC service consumption, minimal exposure → Private Service Connect
- Hybrid DNS → forwarding/peering between Cloud DNS private zones and on-prem resolvers

## Storage provisioning one-liners

- Data cools over time → Cloud Storage Lifecycle rules
- Bucket IAM → Uniform bucket-level access (not legacy ACLs)
- Cloud SQL connection ceiling approaching → connection pooler (Auth Proxy/PgBouncer), not infinite `max_connections`
- Spanner scales → add compute capacity, no resharding needed

## Compute provisioning one-liners

- Compute Engine fleet → MIG (template + autoscaler + health check)
- GKE cluster shell → Terraform (`remove_default_node_pool=true` + explicit node pool resource)
- "Repeatable, reviewed" → Terraform in CI/CD, `plan` reviewed before `apply`
- K8s-native/GitOps team → Config Connector over plain Terraform
- Observability applied at provisioning time, not bolted on later → "observability by default"

## Landing zone pattern (memorize the shape)

```
Org → Folders (Production / Non-Prod / Shared Services) → Projects
```
Org Policy + hierarchical firewall applied at Folder level; IAM via
groups at Folder level; central log sink in Shared Services.

## Top traps

1. Console/manual steps for anything "repeatable" or "across many projects"
2. Auto-mode VPC in production
3. Confusing design (Domain 1: should it be X) with provisioning (Domain 2: how do we implement X)
