# PCA Decision Trees

> Every tree here resolves a recurring "which service/pattern" question
> the exam asks in disguise, across many different scenario wordings.
> Work each tree top-to-bottom against the scenario's stated constraints
> — the exam almost always states the deciding constraint explicitly,
> the trap is picking a popular-sounding service that ignores it.

## Tree 1 — Compute service selection

```
Need to run code on GCP
        │
        ▼
Is it a container image?
        │
   ┌────┴────┐
   NO        YES
   │           │
   ▼           ▼
Need OS-level      Need K8s-native features
control (kernel,   (StatefulSets, custom
custom drivers,    schedulers, sidecars,
licensing BYOL)?   service mesh)?
   │                  │
 ┌─┴─┐              ┌─┴─┐
 YES  NO            YES  NO
 │     │             │     │
 ▼     ▼             ▼     ▼
Compute  Is it event-  GKE   Need scale-to-zero
Engine   driven, single      + per-request billing,
         responsibility,     no K8s complexity?
         short duration?        │
           │                  ┌─┴─┐
         ┌─┴─┐                YES  NO
         YES  NO                │    │
          │    │                ▼    ▼
          ▼    ▼             Cloud   Do you manage
       Cloud   Need full     Run     node pools /
       Functions app runtime            need GPUs/TPU
       (Gen2)   with routing,           node control?
                versions, no             │
                container mgmt?        ┌─┴─┐
                  │                    YES  NO
                ┌─┴─┐                   │    │
                YES  NO                 ▼    ▼
                 │    │              GKE    GKE
                 ▼    ▼              Standard Autopilot
              App Engine  Training/serving
              Standard    ML models specifically?
                             │
                           ┌─┴─┐
                           YES  NO
                            │    │
                            ▼    ▼
                        Vertex AI  (re-evaluate — probably
                                    Cloud Run or GKE)
```

**Exam trap:** a scenario that says "our team already knows Kubernetes
and wants deep control" is steering you to **GKE Standard**, not
Autopilot — Autopilot is the answer when the scenario emphasizes
*reducing ops burden*, not preserving existing K8s expertise.

## Tree 2 — Storage/database selection

```
What shape is the data, and what's the access pattern?
        │
        ▼
Unstructured blobs/files (images, backups, data lake)?
        │
   ┌────┴────┐
   YES        NO
   │           │
   ▼           ▼
Cloud       Needs POSIX filesystem semantics
Storage     (NFS mount for legacy app)?
(pick class    │
 by access   ┌─┴─┐
 frequency)  YES  NO
              │    │
              ▼    ▼
          Filestore  Structured/relational?
                        │
                      ┌─┴─┐
                      YES  NO
                       │    │
                       ▼    ▼
                 Needs global,     Document model with
                 horizontally-      mobile/web SDK +
                 scalable strong    offline sync?
                 consistency          │
                 (>single-region        ┌─┴─┐
                 write scale)?          YES  NO
                    │                    │    │
                  ┌─┴─┐                  ▼    ▼
                  YES  NO             Firestore  Wide-column,
                   │    │                        massive throughput,
                   ▼    ▼                        time-series/IoT,
                Cloud   Fits single-region        sub-10ms p99?
                Spanner  Cloud SQL limits?           │
                          (≤ ~64TB,                ┌─┴─┐
                          regional HA)?             YES  NO
                            │                        │    │
                          ┌─┴─┐                       ▼    ▼
                          YES  NO                  Bigtable  Analytics/
                           │    │                            SQL over
                           ▼    ▼                            huge read-
                        Cloud   (re-evaluate:                heavy data,
                        SQL      Spanner or                  ad hoc
                                 rethink schema)              queries?
                                                                 │
                                                               ┌─┴─┐
                                                               YES  NO
                                                                │    │
                                                                ▼    ▼
                                                            BigQuery  In-memory
                                                                      cache only?
                                                                       → Memorystore
```

**Exam trap:** "needs strong consistency AND global scale" is the
Spanner signal — candidates default to Cloud SQL with read replicas,
which gives eventual consistency on replicas, not the external
consistency the scenario demanded.

## Tree 3 — Hybrid connectivity selection

```
Need to connect on-prem/other-cloud to a VPC
        │
        ▼
Is >99.99% availability / very low, predictable
latency the stated requirement (e.g. real-time
trading, tightly-coupled hybrid app)?
        │
   ┌────┴────┐
   YES        NO
   │           │
   ▼           ▼
Need >10Gbps  Time-to-provision is the binding
sustained         constraint (need it THIS WEEK)?
throughput?          │
   │                ┌─┴─┐
 ┌─┴─┐               YES  NO
 YES  NO              │    │
  │    │               ▼    ▼
  ▼    ▼            Cloud   Bandwidth need ≤ a
Dedicated  Partner   VPN     few Gbps and a colo
Interconnect Interconnect   partner presence
(direct,             (encrypted            already exists?
 you supply           over public            │
 the cross-           internet,             ┌─┴─┐
 connect)             fastest to             YES  NO
                       stand up)              │    │
                                               ▼    ▼
                                          Partner   Dedicated
                                          Interconnect Interconnect
                                                        (or Cloud VPN
                                                        if speed to
                                                        deploy wins)
```

**Exam trap:** "we need it live by Friday" always beats "cheapest at
scale" — Cloud VPN provisions in hours, Interconnect (either flavor)
takes days-to-weeks even with a partner. Read the timeline constraint
before the throughput number.

## Tree 4 — Migration strategy (the "6 R's")

```
Assess the workload against 4 questions:
 1. Is the app itself changing, or just where it runs?
 2. Is there a SaaS replacement that meets the need?
 3. Is this workload staying on-prem for a real reason
    (data residency, licensing, sunset-soon)?
 4. How much re-architecture effort is justified by
    the workload's business value / lifespan?

        │
        ▼
Sunsetting within the migration window anyway?
   │
 ┌─┴─┐
 YES  NO
  │    │
  ▼    ▼
RETIRE   A commercial SaaS already does this
         (e.g. move self-hosted email to
         Workspace/M365)?
            │
          ┌─┴─┐
          YES  NO
           │    │
           ▼    ▼
      REPURCHASE  Must stay on-prem for a real,
                   durable constraint?
                      │
                    ┌─┴─┐
                    YES  NO
                     │    │
                     ▼    ▼
                  RETAIN  High business value AND
                  (hybrid) long lifespan AND team has
                           bandwidth to re-architect
                           for cloud-native benefits?
                              │
                            ┌─┴─┐
                            YES  NO
                             │    │
                             ▼    ▼
                         REFACTOR  Needs minor changes
                         (rebuild  to run well on cloud
                          cloud-   (e.g. swap self-managed
                          native)  DB for Cloud SQL) but
                                   not a full rewrite?
                                      │
                                    ┌─┴─┐
                                    YES  NO
                                     │    │
                                     ▼    ▼
                                REPLATFORM  REHOST
                                ("lift,     (lift-and-
                                 tinker,     shift, fastest,
                                 shift")     least benefit)
```

**Exam trap:** "fastest migration, minimal risk" scenarios point to
**Rehost**, not Refactor — candidates over-index on "cloud-native is
always the right long-term answer" and pick Refactor even when the
scenario's stated constraint is migration speed, not long-term TCO.

## Tree 5 — HA vs. DR strategy (RTO/RPO driven)

```
What RTO/RPO does the scenario state (explicitly
or via business-impact language like "cannot lose
more than a few minutes of data")?
        │
        ▼
RPO ≈ 0 AND RTO ≈ 0 (near-zero, "always on")?
   │
 ┌─┴─┐
 YES  NO
  │    │
  ▼    ▼
Active-Active   RTO minutes, RPO seconds-to-
multi-region    minutes ("fast failover
(highest cost,   acceptable, some data loss
 e.g. Spanner    tolerable")?
 multi-region,      │
 global LB)       ┌─┴─┐
                   YES  NO
                    │    │
                    ▼    ▼
                Active-Passive  RTO hours, RPO hours
                (hot standby,   ("can be down part of
                 automated       a business day")?
                 failover,          │
                 e.g. Cloud SQL   ┌─┴─┐
                 cross-region     YES  NO
                 replica +          │    │
                 promote)           ▼    ▼
                                 Warm    RTO days, RPO
                                 Standby  a day ("just
                                 (scaled- need the data
                                 down      back eventually")
                                 replica,     │
                                 scale up      ▼
                                 on failover) Backup &
                                              Restore
                                              (cheapest,
                                               slowest)
```

**Exam trap:** cost-sensitive scenarios ("startup," "limited budget,"
"non-critical workload") that also mention *any* availability
requirement are testing whether you'll over-provision Active-Active
when Warm Standby or even Backup & Restore satisfies the stated RTO/RPO
at a fraction of the cost. Match the tier to the number, not to how
important the workload *sounds*.

## Tree 6 — Console vs. CLI vs. API vs. IaC (Domain 5.2)

```
Is this a one-off, exploratory, or first-time-ever action?
        │
   ┌────┴────┐
   YES        NO
   │           │
   ▼           ▼
Console      Does it need to be repeatable, version-
(fastest      controlled, and peer-reviewed (the
 for a        production-infra answer almost always)?
 human,          │
 zero            ┌─┴─┐
 audit           YES  NO
 trail)           │    │
                   ▼    ▼
              Terraform /  Is it inside a script/pipeline
              Config       calling GCP programmatically,
              Connector    not human-typed?
              (declarative,  │
               state-driven, ┌─┴─┐
               team review)  YES  NO
                               │    │
                               ▼    ▼
                          Client       gcloud/gsutil/bq CLI
                          libraries /  (scriptable, human-
                          REST/RPC     readable, good for
                          APIs         glue/automation scripts
                          (app-        that aren't full IaC)
                          embedded
                          automation)
```

**Exam trap:** "the team already runs Kubernetes and wants GitOps" is
the Config Connector signal over plain Terraform — it's testing whether
you recognize a K8s-native declarative-management shop, not just
"IaC = Terraform" by default.
