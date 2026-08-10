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
- This lab is the second-most expensive to leave running (after Lab 3)
  because it provisions **two** always-on database instances
  (`db-custom-4-16384` is a substantial machine type) — read Cost
  Estimate before you walk away from it.
- A KMS key ring/key already created if you intend to run the CMEK
  flag in step 1 as written — Cloud SQL will not create the key for
  you, and a missing key produces a permission-shaped error that's
  easy to misdiagnose (see Troubleshooting).

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

Cloud SQL instance creation is not instantaneous — expect this command
to take several minutes to return, longer for a `REGIONAL`
availability type than `ZONAL` since it's provisioning a standby in a
second zone as part of the same operation.

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

Note: a **read** replica is asynchronously replicated, by design — this
is why step 7's RPO measurement below can show a non-zero gap even
under normal, healthy operation. A synchronous option
(cross-region with tighter consistency) is not how standard Cloud SQL
read replicas work; if a scenario requires zero data loss on regional
failover, that's a signal pointing toward a different service
(Spanner) or a different pattern entirely, not a Cloud SQL replica
configuration change — worth remembering as a decision-matrix boundary,
not just this lab's mechanics.

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

## Verification

**1. The primary genuinely has regional HA, not just a regional instance**

```bash
gcloud sql instances describe prod-db --format="value(settings.availabilityType)"
```

Correct output: `REGIONAL`. Misconfiguration signal: `ZONAL` — a
common mistake is confusing the instance's `--region` flag (which
every Cloud SQL instance has, zonal or regional) with the
`--availability-type` flag (which specifically controls whether a
standby exists in a second zone). An instance can be created in
`us-central1` and still be zonal — the region flag alone does not
imply HA.

**2. The replica is actually replicating, not just created and idle**

```bash
gcloud sql instances describe prod-db-replica-east \
  --format="value(replicaConfiguration.mysqlReplicaConfiguration,masterInstanceName)"
```

More directly, check replication lag:

```bash
gcloud sql instances describe prod-db-replica-east \
  --format="value(replicaConfiguration)"
```

Correct signal: after step 3's write on the primary, the same row
appears in `drill_log` on the replica within a short delay (seconds to
low minutes, not hours) when queried with `psql -h REPLICA_IP`.
Misconfiguration signal: the row never appears, or replication status
shows an error state — usually means the replica's `--master-instance-name`
didn't match the primary exactly, or the replica was created before
the primary finished its own provisioning (replica creation against a
primary that isn't fully ready yet can fail or silently produce a
non-replicating instance depending on timing).

**3. The "regional failure" simulation actually removed the primary path, not a decoy**

```bash
gcloud compute backend-services describe app-backend \
  --format="value(backends)"
```

Correct output after step 4: the `us-central1-a` instance group is
absent from the backend list. Misconfiguration signal: it's still
listed — means step 4's `remove-backend` targeted the wrong backend
service name or instance-group zone, and traffic is silently still
being routed to the "failed" region, invalidating any RTO measurement
taken afterward (you'd be measuring the time to promote a replica
nobody was actually failing over to).

**4. The promoted replica is genuinely standalone, not still in a replica relationship**

```bash
gcloud sql instances describe prod-db-replica-east \
  --format="value(instanceType)"
```

Correct output after step 5: `CLOUD_SQL_INSTANCE` (a primary in its
own right). Misconfiguration signal: still shows `READ_REPLICA_INSTANCE`
— means the `promote-replica` operation either hasn't finished yet
(check `gcloud sql operations list --instance=prod-db-replica-east`
for an in-progress operation before concluding it failed) or genuinely
failed, in which case the instance is still read-only and writes from
the "failed-over" application will error out rather than silently
succeeding — this is actually a safer failure mode than it sounds,
since it prevents writes from being lost into a replica that isn't
really promoted, but it does mean the app is down until the promotion
actually completes.

**5. RPO measurement reflects real replication lag, not measurement error**

Compare the last `drill_log` row's timestamp on the replica (post-
promotion) against the last write actually issued on the primary
before step 4's traffic cutover — if you issued additional writes to
the primary *after* T0 but before actually cutting traffic in step 4
(easy to do accidentally if there's a gap between running the `psql`
command and the `backend-services remove-backend` command), your RPO
measurement will look worse than the system's real capability, because
you measured the gap between "last write recorded" and "last write
actually issued," not "last write replicated" and "last write the
application believed was durable." Keep T0 tightly coupled to the
actual traffic-cutover moment, not an earlier baseline write, for an
accurate RPO number.

## Troubleshooting

**1. Instance creation fails citing the CMEK key**

```
ERROR: (gcloud.sql.instances.create) HTTPError 400: Cloud SQL requires the Cloud KMS CryptoKey to grant the service agent the CryptoKey Encrypter/Decrypter role
```

Cloud SQL's own service agent
(`service-PROJECT_NUMBER@gcp-sa-cloud-sql.iam.gserviceaccount.com`)
needs `roles/cloudkms.cryptoKeyEncrypterDecrypter` on the specific key
referenced by `--disk-encryption-key` — this is a separate grant from
whatever permissions *you* have, and Cloud SQL does not grant it
automatically. If step 1 fails here, grant that role on the key first
(`gcloud kms keys add-iam-policy-binding prod-key --keyring=prod-ring
--location=us-central1 --member="serviceAccount:service-PROJECT_NUMBER@gcp-sa-cloud-sql.iam.gserviceaccount.com"
--role="roles/cloudkms.cryptoKeyEncrypterDecrypter"`) and retry.

**2. Replica creation fails or the replica silently never catches up**

```
ERROR: (gcloud.sql.instances.create) The replica's region does not support this configuration / operation still running
```

Two distinct causes present similarly: (a) not every machine
tier/region combination is available in every region — if
`db-custom-4-16384` isn't available in `us-east1` at the time you run
this, the create fails outright with a clearer error naming the
tier; (b) if the primary was still finishing its **own** creation
operation when you issued the replica-create command, the replica
create can be accepted but the replica ends up in a stuck or
never-synced state. Check `gcloud sql operations list --instance=prod-db`
for any still-`RUNNING` operation on the primary before assuming the
replica itself is broken.

**3. Regional quota blocks the second instance**

```
ERROR: (gcloud.sql.instances.create) Quota exceeded for quota metric 'CPUs' ...
```

`db-custom-4-16384` is a 4-vCPU/16GB instance, and running **two** of
them (primary + replica) plus regional HA's implicit standby (a third
underlying VM you don't directly manage) can push a fresh project past
default regional CPU quota. Downsizing the tier for lab purposes
(e.g. a smaller `db-custom-2-XXXX`) is a reasonable substitution if
you hit this and don't specifically need to observe performance at the
documented tier — the RTO/RPO mechanics this lab teaches don't depend
on the exact machine size.

**4. `promote-replica` appears to hang**

Promotion is not instantaneous — it involves the replica catching up
on any final replication lag, detaching from the primary, and
becoming independently writable, which can take longer than a quick
`psql` check expects, especially under load or if replication lag was
already non-trivial at the moment of promotion. Poll
`gcloud sql operations list --instance=prod-db-replica-east` rather
than assuming a command that hasn't returned yet has failed; only
investigate further if the operation itself reports an `ERROR` status,
not just because it's still `RUNNING`.

**5. Application can't connect to the promoted replica after step 6's "redirect"**

A commonly missed detail: the promoted instance has a **different
connection name / IP** than the primary
(`prod-app-001:us-east1:prod-db-replica-east` vs.
`prod-app-001:us-central1:prod-db`), and if the application or Cloud
SQL Auth Proxy configuration hardcodes the primary's connection
string anywhere (environment variable, deployed config file, IAM
binding scoped to the specific instance resource for
`roles/cloudsql.client`-style access), redirecting "the load balancer"
alone isn't sufficient — the app-tier config itself needs the new
instance's identity, and any instance-scoped IAM bindings for
database access need to exist on the replica too, not just the
primary (they are not inherited from the replica relationship once
promoted).

## Cost Estimate

This lab provisions two substantial, always-on database instances —
the second-most expensive lab here after Lab 3's GKE node pool, and
arguably worse to forget about since Cloud SQL instances don't have
GKE's "obviously a cluster" visual weight in casual Console browsing.
Rough order-of-magnitude for a full month left running, on-demand
pricing, using the exact tier in this lab's commands — treat as
planning-level, not a quote:

| Resource | Approx. monthly cost if left running | Notes |
|---|---|---|
| `prod-db` (`db-custom-4-16384`, REGIONAL) | Roughly $400–500+/mo | Regional HA roughly doubles the base instance cost vs. zonal, since you're paying for the standby too — this is the single largest line item in the whole lab set across all 5 labs. |
| `prod-db-replica-east` (`db-custom-4-16384`, cross-region) | Roughly $200–250+/mo (zonal pricing, since a read replica by itself is a single-zone resource unless separately configured for HA) | Cross-region data transfer for replication traffic adds a smaller, usage-based charge on top. |
| Storage (both instances) | Modest, scales with allocated disk size and enabled auto-growth | Usually a minor fraction of the total next to the compute tier cost above. |
| CMEK / Cloud KMS | Cloud KMS key versions have a small per-version monthly charge; negligible at this scale | Not a meaningful driver of this lab's total cost. |

**Resource to watch:** both database instances, but especially
`prod-db` — a `db-custom-4-16384` REGIONAL instance is a genuinely
large line item (comparable to or larger than a small team's entire
monthly GCP spend on everything else) to leave running by accident
after a study session. If you want to keep the lab's artifacts around
between sessions without paying for compute, stop is **not** available
for Cloud SQL the way it is for Compute Engine VMs — Cloud SQL
instances bill while they exist, running or not, short of actual
deletion (or, for some configurations, exporting data and deleting the
instance to restore from later). Budget for full deletion between
sessions rather than assuming a "stop" option exists here the way it
does in Labs 2 and 3.

## Cleanup

```bash
# 1. Restore the backend-service state changed in step 4, if not
#    already reverted during the drill itself
gcloud compute backend-services add-backend app-backend \
  --instance-group=prod-mig-us-central1 \
  --instance-group-zone=us-central1-a

# 2. Delete the promoted replica (now a standalone primary instance —
#    delete it the same way you'd delete any Cloud SQL instance)
gcloud sql instances delete prod-db-replica-east --quiet

# 3. Delete the original primary
gcloud sql instances delete prod-db --quiet
```

Cloud SQL instance deletion is immediate and does **not** have the
30-day soft-delete/recovery window that project deletion has (Lab 1) —
if you need the data afterward, export it
(`gcloud sql export sql prod-db gs://BUCKET/backup.sql --database=appdb`)
before running the delete commands above, since there is no undo once
the instance is gone.

If you created the KMS key ring/key solely for this lab's CMEK step,
note that Cloud KMS key rings and keys themselves **cannot be deleted**
(this is a deliberate GCP design constraint, not a gap in this lab's
instructions) — you can only schedule individual key *versions* for
destruction (`gcloud kms keys versions destroy`) after a mandatory
waiting period. Budget for the key ring/key existing indefinitely (at
negligible cost) rather than expecting full teardown here.

## Why This Matters for the Exam

This lab is the hands-on version of **Domain 6 (~12%, Ensuring
solution and operations reliability) §6.2 — deployment/release
management and DR execution**, with a strong secondary tie into
**Domain 4 (~18%, Analyzing and optimizing) §4.1's** process-drilling
guidance and **Domain 1 (~24%) §1.1/§1.2's** RTO/RPO requirements
mapping:

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

**Scenario-question shape this prepares you for:** a question gives a
stated RPO (e.g. "no more than 5 minutes of data loss is acceptable")
and asks which Cloud SQL configuration satisfies it — the exam expects
you to know that regional HA alone (protects against zone failure,
synchronous within the region) does **not** by itself satisfy a
*regional*-failure RPO requirement, and that a cross-region read
replica's RPO is bounded by replication lag, not zero, because
replication is asynchronous. A distractor answer of "regional HA is
sufficient" is exactly the trap this lab's step 2 callout exists to
immunize against. A second common variant asks what happens to
*write* availability immediately after a regional failure and before
promotion completes — the correct answer is that the application is
write-unavailable during that gap (this lab's Verification check 4
demonstrates it directly: a replica that hasn't finished promoting
rejects writes rather than silently accepting and losing them), which
is the concrete basis for why RTO is measured as a real, non-zero
duration rather than assumed to be instantaneous.
