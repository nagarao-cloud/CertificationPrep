# Lab 5: DR Failover Drill — Cloud SQL Cross-Region Replica Promotion

> Implements Domain 6 §6.2's Active-Passive DR tier
> (`00-START-HERE/DECISION-TREES.md` Tree 5) and Domain 4 §4.1's
> "DR plans should be regularly drilled" process guidance.

## Objective

Provision a Cloud SQL primary with regional HA, add a cross-region read
replica, simulate a regional failure, promote the replica, and measure
the actual RTO/RPO achieved against a stated target — the kind of DR
drill Domain 4 expects as an ongoing process, not a one-time setup.

## Prerequisites

- A Cloud SQL instance (PostgreSQL) with regional HA already running,
  or create one in step 1.
- Sufficient IAM permissions for Cloud SQL Admin.

## Steps

### 1. Create a primary instance with regional HA

```bash
gcloud sql instances create prod-db \
  --database-version=POSTGRES_15 \
  --region=us-central1 \
  --availability-type=REGIONAL \
  --tier=db-custom-4-16384 \
  --disk-encryption-key=projects/prod-app-001/locations/us-central1/keyRings/prod-ring/cryptoKeys/prod-key
```

**Why `--availability-type=REGIONAL` and CMEK from the start:** regional
HA gives automatic zone-failure protection (Domain 6 §6.2); the CMEK
flag demonstrates the Domain 3 §3.1 pattern of applying encryption
control at provisioning time, not retrofitted later.

### 2. Add a cross-region read replica

```bash
gcloud sql instances create prod-db-replica-east \
  --master-instance-name=prod-db \
  --region=us-east1 \
  --tier=db-custom-4-16384
```

**Why cross-region, not just cross-zone:** the primary's regional HA
already covers zone failure; this replica exists specifically to
provide a *regional* DR target — the gap Domain 6 §6.2 flags explicitly
("Cloud SQL regional HA does not cover regional failure automatically").

### 3. Establish a baseline write and record a timestamp

```bash
psql -h PRIMARY_IP -U app_user -d appdb \
  -c "INSERT INTO drill_log (event, ts) VALUES ('pre-failover-write', now());"

date -u +%Y-%m-%dT%H:%M:%SZ   # record T0
```

### 4. Simulate a regional failure (do NOT actually delete the primary in a
   real environment with production data — this step is illustrative;
   in a real drill, use a maintenance window and a non-production or
   explicitly-scoped drill instance)

```bash
# Illustrative: stop application traffic to the primary region,
# e.g. by removing it from the load balancer backend, rather than
# destroying the instance.
gcloud compute backend-services remove-backend app-backend \
  --instance-group=prod-mig-us-central1 \
  --instance-group-zone=us-central1-a
```

### 5. Promote the replica

```bash
gcloud sql instances promote-replica prod-db-replica-east

date -u +%Y-%m-%dT%H:%M:%SZ   # record T1 — promotion complete
```

### 6. Redirect application traffic to the newly-promoted instance

```bash
# Update application connection config / Cloud SQL Auth Proxy target
# to point at prod-db-replica-east, and/or update DNS/LB backend
# configuration to route to the us-east1 application tier.
```

### 7. Verify data and measure actual RTO/RPO

```bash
psql -h REPLICA_IP -U app_user -d appdb \
  -c "SELECT * FROM drill_log ORDER BY ts DESC LIMIT 5;"
```

Compare:
- **RTO achieved** = T1 (promotion + traffic redirect complete) − T0
  (failure simulated) — compare against the scenario's stated RTO
  target (Domain 1 §1.1/§1.2).
- **RPO achieved** = timestamp of the last write present on the
  replica vs. the last write made on the primary before failure — since
  replication is asynchronous, some very recent writes may be missing;
  quantify how much, compare against the stated RPO target.

### 8. Document findings and update the runbook

Per Domain 4 §4.1's process guidance: record the actual RTO/RPO
achieved, note any manual steps that could be automated to improve
RTO next time (e.g. scripting the promotion + traffic-redirect steps
together), and schedule the next drill — a DR plan that's never
drilled is a documentation exercise, not a reliability control.

### 9. Clean up (restore normal operation)

```bash
gcloud compute backend-services add-backend app-backend \
  --instance-group=prod-mig-us-central1 \
  --instance-group-zone=us-central1-a

gcloud sql instances delete prod-db-replica-east
```

## What this lab demonstrates for the exam

- Cloud SQL's regional HA vs. cross-region replica distinction (Domain
  6 §6.2) stops being an abstract fact once you've actually promoted a
  replica and watched replication lag translate into a measurable RPO
  gap.
- Measuring actual RTO/RPO against a stated target — not just having a
  DR architecture on paper — is exactly what Domain 4 §4.1's "how do we
  ensure our runbook stays accurate" process question is testing.
- The traffic-redirect step (LB backend / DNS / app config) is as much
  a part of "failover" as the database promotion itself — a common
  exam gap is treating DR as purely a data-layer concern and forgetting
  the compute/routing layer has to fail over too.
