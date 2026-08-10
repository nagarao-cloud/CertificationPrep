# IoT Telemetry Architecture — Massive Device Fleets, Out-of-Order Data, and Edge-to-Cloud Ingestion

> Device telemetry at massive device-count scale: IoT Core ingestion,
> handling out-of-order/late-arriving sensor data, storage decisions
> for time-series-shaped data, anomaly detection, and edge-to-cloud
> connectivity patterns. Built from the same service vocabulary as the
> rest of this repo — see `00-START-HERE/SERVICE-SELECTION-MATRIX.md`
> Part 0 for how exam questions are assembled from scenario →
> requirement → constraint.

## CONTENTS

1. [Business context](#context)
2. [End-to-end architecture](#architecture)
3. [Service-by-service rationale](#rationale)
4. [Security and governance — device identity and fleet management](#security)
5. [Scaling at 10x and 100x](#scaling)
6. [Failure scenarios](#failure)
7. [Cost drivers and optimization](#cost)
8. [Real-company parallel](#company)
9. [Exam traps specific to IoT scenarios](#traps)
10. [Practice questions](#questions)

---

<a name="context"></a>
## 1. Business context

IoT telemetry is defined by a scale axis none of this repo's other
verticals face in the same way: **device count**, not just event
volume. A single industrial site might have tens of thousands of
sensors; a connected-vehicle fleet or a smart-utility meter deployment
can mean **millions to tens of millions of individual devices**, each
publishing readings on its own schedule, over network conditions the
platform doesn't control. Individually, each device's data rate is
small — a temperature reading every 30 seconds, a GPS ping every
minute — but multiplied across millions of devices, aggregate ingest
volume rivals or exceeds the clickstream and media-engagement workloads
elsewhere in this repo, with a much higher connection-management burden
on top: each device needs a durable identity, a certificate, and a
managed connection lifecycle, none of which a web clickstream event
needs to worry about.

The data itself is genuinely messy in a way that's specific to this
vertical. Devices on cellular, LoRaWAN, or satellite backhaul lose
connectivity and buffer locally, meaning a batch of readings can arrive
**hours late and out of timestamp order** relative to when they were
actually generated — a temperature reading timestamped 9:00 AM might
not physically arrive at the cloud until 2:00 PM. This is a
fundamentally different problem from banking's or retail's "the event
arrived a few seconds late," and it means **event-time processing**
(windowing and aggregating by when the reading was actually taken, not
when it arrived) has to be a deliberate architectural choice, not an
afterthought — a naive pipeline that windows by arrival time will
silently produce wrong aggregates whenever a chunk of late data shows
up. Anomaly detection built on top of this data has to be explicitly
designed to tolerate and correctly reprocess late-arriving records
rather than assuming a clean, ordered stream.

Storage and query shape follow directly from what the data actually
looks like: extremely high write volume, narrow records (device ID,
timestamp, a handful of metric values), queried almost exclusively by
time range and device/device-group — the textbook definition of
time-series data. This repo flags **Amazon Timestream** as
recognize-only given AWS's wind-down of Timestream for LiveAnalytics
for new customers (see `01-domains/DOMAIN-2-DATA-STORE-MANAGEMENT.md`),
so the architecture below uses the pattern this repo's current
material actually recommends for a new build: **S3 + Apache Iceberg**,
partitioned and sorted to serve time-range, device-scoped queries
efficiently, which also has the material advantage of unifying
telemetry storage with the same lakehouse tooling (Athena, Redshift
Spectrum, Glue) used everywhere else in the platform, rather than a
separate specialized time-series database with its own query language
and operational surface.

---

<a name="architecture"></a>
## 2. End-to-end architecture

```
       EDGE / DEVICE LAYER                          FLEET MANAGEMENT
 ┌───────────────────────────────┐             ┌───────────────────────────┐
 │ Millions of sensors/devices —  │             │ Device registry, OTA       │
 │ MQTT over cellular/LoRaWAN/    │             │ firmware updates, cert      │
 │ Wi-Fi; some behind AWS IoT     │             │ rotation, fleet indexing    │
 │ Greengrass edge gateways       │             └──────────────┬────────────-┘
 └────────────────┬────────────────┘                            │
                   │ (1)                                        │
                   v                                             │
          AWS IoT Core                                           │
     (device gateway, MQTT broker,                                │
      X.509 cert-based auth, Device                               │
      Shadow for last-known-state) ◀────────────────────────────-┘
                   │ (2)
                   v
        IoT Core Rules Engine
     (routes by topic/payload to
      the right downstream target)
                   │
       ┌───────────┼─────────────────────┐
       │ (3)       │ (4)                  │ (5)
       v           v                      v
  Kinesis Data  Amazon Data           DynamoDB
  Streams       Firehose              (device shadow /
  (real-time    (bulk telemetry       latest-state lookups,
  anomaly path) landing in S3)        low-latency device queries)
       │              │
       v              │
 Managed Service       │
 for Apache Flink       │
 (event-time windowing, │
 late-data tolerance,   │
 anomaly scoring)        │
       │              │
       v              v
 ┌────────────────────────────────────────────────────────────────--─┐
 │              RAW / BRONZE ZONE — Amazon S3 (KMS-encrypted)          │
 │   Partitioned by ingest date; retains late-arriving data as-is      │
 └──────────────────────┬───────────────────────────────────────--─--┘
                         │ (6)
              Glue ETL (Spark) — reorder by EVENT time (not
              arrival time), dedup, compact small files
                         │
                         v
 ┌────────────────────────────────────────────────────────────────--─┐
 │     CURATED / SILVER ZONE — Apache Iceberg on S3, partitioned by    │
 │     event_date + device_group, sorted by device_id + event_time     │
 └──────────────────────┬───────────────────────────────────────--─--┘
                         │ (7)
                         v
 ┌────────────────────────────────────────────────────────────────--─┐
 │  GOLD ZONE — Athena (time-range/device queries, partition           │
 │  projection) · Redshift (fleet-wide trend/BI reporting) ·           │
 │  QuickSight (operations dashboards)                                 │
 └────────────────────────────────────────────────────────────────--─┘

        GOVERNANCE LAYER:
        AWS IoT Device Defender (fleet security posture, anomalous
        device behavior) ── X.509 certs + IoT Core policies (per-device
        least-privilege topic access) ── KMS (encrypt telemetry at
        rest) ── CloudTrail (audit control-plane changes to device
        policies/fleet configuration) ── VPC endpoints for internal
        service traffic

        ORCHESTRATION LAYER:
        EventBridge (schedule compaction, OTA campaign triggers) ──▶
        Step Functions (sequence Glue jobs, device provisioning
        workflows) ── IoT Core auto-scales to fleet size; Kinesis
        on-demand absorbs telemetry bursts (e.g., firmware-update-
        triggered simultaneous check-ins)
```

**Arrow-by-arrow explanation:**

**(1) Edge/device layer → AWS IoT Core.** Devices connect over MQTT
(the dominant IoT protocol, chosen for its low overhead on
constrained/battery-powered devices), authenticated with per-device
X.509 certificates. Devices with intermittent connectivity or that need
local processing/filtering before sending data upstream connect through
an **AWS IoT Greengrass** edge gateway, which can run inference or
aggregation locally and forward only what's needed to the cloud — this
is the "edge-to-cloud" pattern referenced in the file's scope. IoT Core
also maintains a **Device Shadow** — a persisted last-known-state
document per device — so applications can query a device's last
reported state even while the device itself is offline.

**(2) IoT Core → Rules Engine → three parallel downstream targets.**
The Rules Engine evaluates SQL-like rules against incoming MQTT topic/
payload data and routes accordingly, which is what lets one ingestion
layer serve three very different downstream needs without three
separate device-side integrations.

**(3) Rules Engine → Kinesis Data Streams → Managed Service for Apache
Flink (real-time anomaly path).** A subset of telemetry — the metrics
anomaly detection cares about — routes to Kinesis, then to **Flink**,
which is configured for **event-time windowing** (not processing-time),
meaning it windows and aggregates readings by the timestamp the device
recorded, not when the record arrived at the cloud. Flink's watermark
mechanism explicitly tolerates a bounded amount of lateness, correctly
incorporating a late-arriving reading into the right time window rather
than either dropping it or corrupting an already-closed window's
result — this is the specific mechanism that makes the architecture
tolerant of the out-of-order, delayed-backhaul data described in
Section 1.

**(4) Rules Engine → Amazon Data Firehose → bronze zone.** The bulk of
telemetry — the vast majority of readings that aren't individually
anomaly-relevant but are needed for historical analysis and model
training — routes through Firehose, which buffers, batches, and lands
data in S3 with format conversion to Parquet, avoiding the cost and
complexity of pushing every single reading through the real-time Flink
path when most of it doesn't need sub-second treatment.

**(5) Rules Engine → DynamoDB (device shadow/latest-state queries).**
Applications that need the **current** state of a device (a dashboard
showing "is this sensor online, what's its last reading") query
DynamoDB directly rather than scanning historical telemetry — this is a
distinct access pattern (point lookup by device ID) from the
time-range/device-group queries the analytical zone serves, and
DynamoDB's sub-millisecond key-value performance fits it specifically.

**(6) Bronze zone → Glue ETL reorders by event time.** This is the
architecture's answer to late-arriving data at the batch layer: rather
than assuming the bronze zone's ingest-time partitioning reflects the
true event timeline, the curated-zone build explicitly re-partitions
and sorts by **event time**, so a reading that physically arrived hours
late still lands in the correct logical time partition in the curated
zone.

**(7) Curated zone → gold consumption.** **Athena**, using **partition
projection** (critical at this device/partition count — a
crawler-maintained partition list becomes a bottleneck and a real cost
driver once the table has millions of device/date partition
combinations), serves time-range and device-group queries. **Redshift**
serves fleet-wide trend and BI reporting. **QuickSight** serves
operations dashboards for fleet health monitoring.

---

<a name="rationale"></a>
## 3. Service-by-service rationale

| Layer | Service chosen | Why it won | Runner-up | Why the runner-up lost |
|---|---|---|---|---|
| Device connectivity/gateway | **AWS IoT Core** | Purpose-built MQTT broker with per-device X.509 identity, Device Shadow, and a Rules Engine for routing — none of which a generic message broker provides out of the box | Self-managed MQTT broker (e.g., Mosquitto on EC2) | Standing infrastructure to patch, scale, and secure for a function IoT Core fully manages, including certificate lifecycle at fleet scale |
| Edge processing for intermittent-connectivity devices | **AWS IoT Greengrass** | Runs local inference/filtering/buffering on the edge gateway, reducing both bandwidth and cloud processing needs for constrained-connectivity sites | Custom edge software on generic hardware | Reinvents device-to-cloud sync, local Lambda execution, and OTA deployment management that Greengrass provides natively |
| Real-time anomaly detection | **Amazon Managed Service for Apache Flink** | Event-time windowing with native late-data/watermark handling, exactly what out-of-order sensor data requires | AWS Lambda per-record | Lambda has no built-in concept of event-time windows or watermarks — correctly handling late-arriving data would require reimplementing Flink's watermark logic from scratch |
| Bulk telemetry landing in S3 | **Amazon Data Firehose** | Automatic buffering, Parquet conversion, and dynamic partitioning for the high-volume, non-time-critical majority of telemetry | Kinesis Data Streams for all telemetry | Unnecessary cost and operational overhead to route every single low-priority reading through a replayable stream when only the anomaly-relevant subset needs that treatment |
| Latest device-state queries | **DynamoDB** | Sub-millisecond key-value lookup by device ID, matching the actual access pattern (point lookup, not time-range scan) | Querying the curated Iceberg zone for latest state | Iceberg/Athena is optimized for time-range analytical queries, not single-digit-millisecond point lookups an operations dashboard needs |
| Time-series-shaped storage for a new build | **S3 + Apache Iceberg**, partitioned by event date + device group, sorted by device ID + event time | Unifies telemetry storage with the same lakehouse tooling (Athena, Glue, Redshift Spectrum) used platform-wide, with native support for reordering by event time | Amazon Timestream | This repo flags Timestream as recognize-only given AWS's wind-down for new customers — current guidance is to use the Iceberg-on-S3 pattern for a new pipeline design |
| Historical/analytical queries at massive partition count | **Athena with partition projection** | Avoids the cost and latency of a Glue crawler maintaining millions of device/date partition entries in the Data Catalog | Standard Glue-crawler-maintained partitions | Crawler cost and latency scale poorly once partition count reaches the millions that a large device fleet's date × device-group scheme produces |
| Fleet-wide BI/trend reporting | **Amazon Redshift** | Complex fleet-wide joins and aggregations for operations/reliability engineering teams at BI scale | Athena for all reporting | Athena is the right complement for ad hoc/time-range queries, but a standing, always-on fleet-trend BI workload with recurring complex joins is Redshift's use case |
| Device security posture monitoring | **AWS IoT Device Defender** | Purpose-built for fleet-wide security auditing (detecting anomalous device behavior, policy violations) at IoT scale | Manual security review per device | Doesn't scale to a fleet of millions of devices at all |
| Orchestration | **AWS Step Functions** | Explicit sequencing/retry for compaction jobs and device-provisioning workflows | Amazon MWAA | No existing Airflow investment stated; Step Functions is lower-ops for this job shape |

---

<a name="security"></a>
## 4. Security and governance — device identity and fleet management

| Requirement | AWS control |
|---|---|
| Every device has a unique, verifiable identity | **X.509 certificates** per device, issued and managed through **AWS IoT Core**'s certificate lifecycle, avoiding shared credentials across the fleet |
| A compromised device can only publish/subscribe to its own authorized topics | **IoT Core policies** scoped per-device (or per-device-group via policy variables), enforcing least privilege at the MQTT topic level |
| Detect anomalous or compromised device behavior across the fleet | **AWS IoT Device Defender** — continuously audits device behavior against expected baselines and security best practices, alerting on deviations |
| Firmware/software updates are delivered securely and can be rolled back | **AWS IoT Device Management** OTA update jobs, with staged rollout and rollback capability |
| Telemetry encrypted at rest | **SSE-KMS** on the S3 bronze/curated zones and on DynamoDB (encryption at rest enabled by default, customer-managed CMK where stricter key control is required) |
| Telemetry encrypted in transit | TLS-secured MQTT connections enforced by IoT Core; no unencrypted device-to-cloud transport permitted |
| Audit trail for control-plane changes (who modified a device policy or fleet configuration) | **CloudTrail management events** on IoT Core API actions |
| Network isolation for internal processing (Flink to S3, Glue to Redshift) | **VPC interface endpoints (PrivateLink)** and **Gateway VPC endpoint** for S3 |
| Least-privilege credential management for any downstream service integrations | **AWS Secrets Manager** with automatic rotation |
| Revoking a compromised device's access instantly | Certificate revocation at IoT Core — deactivating a device's X.509 certificate immediately blocks its ability to connect, without needing a fleet-wide credential rotation |

⚠️ **Device identity, not network perimeter, is the primary security
boundary in IoT.** Unlike the other verticals in this repo where VPC
and network-layer controls dominate the governance conversation, IoT's
device fleet sits largely outside any AWS-controlled network — the
security model instead centers on per-device X.509 identity, scoped
IoT Core policies, and Device Defender's behavioral monitoring.

---

<a name="scaling"></a>
## 5. Scaling considerations

**Baseline assumed:** ~1M connected devices, ~10M readings/day.

**At 10x (~10M connected devices, ~100M readings/day):**
- IoT Core scales natively with device count and connection volume with
  no infrastructure to provision, but **Rules Engine rule complexity**
  and the downstream Firehose/Kinesis throughput both need explicit
  capacity review — a Rules Engine SQL statement that was fast at 1M
  devices can become a bottleneck at 10x message rate if it performs
  complex payload parsing per message.
- Kinesis (for the anomaly-detection subset) moves to **on-demand
  mode**, and the Flink application's **parallelism and checkpoint
  interval** need tuning as windowed state grows with 10x the device
  count reporting into the same windows.
- Athena's **partition projection** configuration (rather than a
  crawler-maintained catalog) becomes close to mandatory at this
  device/date partition combination count, where crawler run time and
  Data Catalog storage cost both start to matter.
- The curated Iceberg zone's **compaction job frequency** increases —
  10x the device count writing through Firehose's micro-batches
  produces a proportionally larger small-file problem if compaction
  cadence isn't adjusted upward.

**At 100x (~100M connected devices, ~1B readings/day — a large national
utility smart-meter deployment or a major connected-vehicle fleet):**
- Device connectivity management itself becomes a first-class scaling
  concern — **IoT Core's registry and Rules Engine at this device
  count** typically warrants segmenting devices into logical fleets
  (by region, device type, or utility service territory) with separate
  Rules Engine configurations, rather than one monolithic ruleset.
- The anomaly-detection Flink pipeline likely **shards by device
  group** rather than running as a single application against the full
  fleet's stream, both for throughput and to bound the blast radius of
  one region's anomalous traffic pattern.
- The curated zone's partition scheme (`event_date + device_group`)
  needs a second-level split — a single day's partition for 100M
  devices is too large for efficient pruning without the device-group
  sub-partition doing real work.
- Redshift moves to a **data-sharing architecture** — a producer
  cluster for ETL, separate read-only consumer clusters for different
  operations teams (regional reliability engineering vs. executive
  fleet-health reporting) so one team's heavy query load doesn't
  degrade another's.
- Edge processing via **Greengrass becomes load-bearing, not optional**
  at this scale — pushing meaningful pre-aggregation and filtering to
  the edge is often the only way to keep cloud-side ingest volume
  manageable when device count reaches the tens of millions.

---

<a name="failure"></a>
## 6. Failure scenarios and tolerance

| Failure | Architecture's response |
|---|---|
| A device loses connectivity for hours and then reconnects with a backlog of buffered readings | The Flink anomaly pipeline's **watermark/late-data tolerance** correctly incorporates the backlog into the right historical event-time windows rather than dropping it or misattributing it to "now"; the batch Glue job's event-time reordering (arrow 6) similarly places the backlog correctly in the curated zone |
| The Flink anomaly-detection application crashes | Kinesis retention holds the backlog of anomaly-relevant events; Flink resumes from its last checkpoint with exactly-once semantics on restart — no anomaly is permanently missed, only detected with delay |
| Firehose delivery to S3 fails for a batch of bulk telemetry | Firehose retries automatically and, on sustained failure, writes to an error/backup S3 prefix rather than dropping records |
| A compromised device begins publishing malicious or malformed payloads at high volume | **IoT Core policies** scope what topics the device can publish to in the first place; **Device Defender** flags the anomalous behavior; the compromised device's certificate can be revoked immediately, cutting off its connection without affecting the rest of the fleet |
| A single AZ fails during peak reporting hours | IoT Core, Kinesis, and DynamoDB are all Multi-AZ/regionally resilient by design; the pipeline continues without manual failover |
| The Glue event-time reordering job fails partway through a run | Job bookmarks prevent reprocessing already-committed files; the raw zone (untouched, immutable) remains available to safely reprocess from scratch if needed, without any risk to already-curated data since promotion happens only on full job success |

---

<a name="cost"></a>
## 7. Cost drivers and optimization levers

**Top cost drivers:**
1. **IoT Core connection and messaging charges at massive device
   count** — billed per connection-minute and per message, which scales
   directly and unavoidably with fleet size.
2. **Firehose/S3 PUT and storage costs** for the high-volume bulk
   telemetry path, especially if buffer intervals are tuned too short,
   producing more, smaller S3 objects than necessary.
3. **Kinesis/Flink running continuously** for the real-time anomaly
   path, sized for a subset of telemetry that, if scoped too broadly,
   unnecessarily inflates real-time processing cost for data that
   didn't need real-time treatment.

**Optimization levers:**
- **Push filtering/pre-aggregation to the edge via Greengrass** —
  reducing the volume of raw readings sent to the cloud at all is the
  single highest-leverage lever at large device-fleet scale, since
  every downstream service's cost scales with message volume.
- **Route only genuinely anomaly-relevant metrics through the real-time
  Kinesis/Flink path**, leaving the bulk of telemetry on the cheaper
  batched Firehose path — mirroring the same "not everything needs
  real-time treatment" lesson from the media and healthcare
  architectures in this repo.
- **Tune Firehose buffer size/interval and schedule regular Iceberg
  compaction** to avoid the small-file problem that both increases S3
  storage overhead and inflates Athena/Redshift Spectrum scan costs
  at this device count.

---

<a name="company"></a>
## 8. Real-company parallel

This mirrors how large industrial IoT and connected-device platforms
architect telemetry pipelines on AWS: AWS IoT Core as the device
gateway and identity boundary for a multi-million-device fleet, edge
gateways (Greengrass or similar) doing local filtering for
intermittently-connected sites, a stream-processing layer explicitly
built for event-time and late-data tolerance rather than assuming clean
ordered arrival, and a lakehouse (rather than a specialized time-series
database) serving historical analytics — the same pattern utility
companies use for smart-meter deployments and industrial equipment
manufacturers use for predictive-maintenance telemetry across globally
distributed connected-vehicle or connected-machinery fleets.

---

<a name="traps"></a>
## 9. Exam traps specific to IoT scenarios

⚠️ **"Time-series sensor data at scale" does not automatically mean
Amazon Timestream on this exam's current material.** As covered in
Domain 2, Timestream is recognize-only given AWS's wind-down for new
customers — a "design a new pipeline" IoT scenario should point to
S3 + Iceberg (or, for the recognition-only phrasing "which service
provides purpose-built time-series storage with automatic tiering,"
Timestream remains the textbook answer). Read carefully for which kind
of question is being asked.

⚠️ **Out-of-order/late-arriving data is an event-time vs. processing-
time problem, not a "just add more capacity" problem.** A question
describing sensor readings arriving hours late and producing incorrect
aggregates is testing whether you recognize the fix is **event-time
windowing with watermarks** (Managed Flink), not a throughput or
capacity fix.

⚠️ **Don't route all telemetry through a real-time stream by default.**
The exam frequently tests whether a candidate recognizes that only a
subset of IoT data (the anomaly-relevant subset) genuinely needs
Kinesis/Flink treatment, while the bulk volume is correctly served by
the cheaper, simpler Firehose-to-S3 batch path — reflexively reaching
for real-time everywhere is an over-engineering trap specific to
high-volume verticals like this one and media.

⚠️ **Device identity is the security answer, not VPC/network
controls, for anything involving the device fleet itself.** A question
asking "how do you ensure only authorized devices can publish
telemetry" is testing IoT Core's X.509-certificate-based device
identity and per-device policies — VPC security groups and network
ACLs don't apply to devices connecting over the public internet/
cellular network outside AWS's network boundary.

⚠️ **Athena partition projection, not crawler-maintained partitions, is
the exam-favorite answer once partition count reaches "millions."** A
scenario describing a Glue crawler that's slow or expensive to run
against a huge device/date partition scheme is testing whether you
know to replace it with partition projection.

---

<a name="questions"></a>
## 10. Practice questions

**Q1.** A fleet of 5 million connected sensors publishes readings over
MQTT. Each device must have a unique, revocable identity, and a
compromised device's access must be cut off without affecting the rest
of the fleet. What provides this?

- A. A single shared API key embedded in all device firmware —
  **Wrong.** A shared credential can't be revoked for one device
  without invalidating it for the entire fleet, and provides no
  per-device identity at all.
- B. **AWS IoT Core with per-device X.509 certificates and scoped IoT
  Core policies** — **Correct.** Each device has a unique, individually
  revocable certificate and least-privilege topic access, exactly
  matching the requirement.
- C. IAM users, one per device — **Wrong.** IAM users don't scale to
  millions of devices, aren't designed for device-oriented MQTT
  authentication, and would be an operational and cost disaster at
  this scale.
- D. VPC security groups scoped per device — **Wrong.** Devices connect
  over the public internet/cellular network outside any AWS-controlled
  VPC; security groups don't apply to this connection path.

**Q2.** Sensor readings occasionally arrive hours late due to
intermittent cellular backhaul, and the anomaly-detection pipeline has
been producing incorrect window aggregates as a result. What's the
correct fix?

- A. Increase Kinesis shard count — **Wrong.** Addresses throughput, not
  the actual problem, which is how late data is incorporated into time
  windows.
- B. **Configure the Managed Service for Apache Flink application for
  event-time processing with watermarks tolerating the expected
  lateness** — **Correct.** Event-time windowing with watermarks
  correctly incorporates late-arriving data into the right historical
  window instead of the window active when the data happened to arrive.
- C. Discard any reading that arrives more than 5 minutes after the
  current time — **Wrong.** Silently drops legitimate data, which is
  exactly the failure mode the architecture needs to avoid, not adopt.
- D. Switch from Kinesis to Amazon Data Firehose — **Wrong.** Firehose
  has no windowed processing capability at all; this doesn't address
  the event-time problem and removes real-time anomaly detection
  entirely.

**Q3.** Operations dashboards need to show a device's current online/
offline status and last reported reading with sub-10-millisecond
lookup latency. What should serve this specific query pattern?

- A. Athena against the curated Iceberg zone — **Wrong.** Optimized for
  time-range/analytical queries, not single-digit-millisecond point
  lookups.
- B. **DynamoDB, keyed by device ID, storing the latest reported
  state** — **Correct.** Matches the point-lookup-by-key access pattern
  with the required sub-millisecond latency.
- C. Redshift — **Wrong.** A data warehouse optimized for complex
  analytical joins, not a low-latency point-lookup service.
- D. Amazon S3 with one object per device — **Wrong.** S3 object
  retrieval latency and consistency model don't match the sub-10-ms
  point-lookup requirement as well as DynamoDB's purpose-built
  key-value performance.

**Q4.** A new IoT pipeline is being designed for time-series sensor
storage. Per this repo's current guidance, what should be used instead
of Amazon Timestream for a new build?

- A. DynamoDB with a composite sort key on timestamp — **Wrong.**
  Workable for simple lookups but not the recommended pattern for
  large-scale analytical time-range queries across a lakehouse platform.
- B. **Amazon S3 with Apache Iceberg tables, partitioned and sorted for
  time-range queries** — **Correct.** This repo's current guidance
  (Domain 2) flags Timestream as recognize-only given AWS's wind-down
  for new customers, and recommends the Iceberg-on-S3 pattern for new
  pipeline designs, unifying with the rest of the lakehouse.
- C. Amazon Timestream — **Wrong for a new-build design question.**
  This is the correct answer only for a pure recognition-level question
  about what Timestream is for, not for a "design a new pipeline"
  recommendation per this repo's currency guidance.
- D. Amazon Neptune — **Wrong.** Neptune is a graph database for
  relationship data, entirely unrelated to time-series telemetry
  storage.

**Q5.** A device fleet's Glue Data Catalog table has grown to millions
of device/date partition combinations, and the crawler now takes hours
to run and adds meaningful cost. What should replace crawler-maintained
partitions for Athena queries?

- A. Run the crawler less frequently — **Wrong.** Reduces crawler cost
  somewhat but doesn't solve the underlying scaling problem, and risks
  stale partition metadata.
- B. **Athena partition projection**, computing partition locations
  algorithmically from the query rather than maintaining them in the
  Data Catalog — **Correct.** Purpose-built for exactly this scenario —
  huge partition counts where crawler maintenance becomes a cost and
  latency bottleneck.
- C. Switch from Iceberg back to Hive-style partitioning — **Wrong.**
  Doesn't address the crawler cost/latency problem and loses Iceberg's
  schema evolution and upsert benefits.
- D. Merge all partitions into a single unpartitioned table — **Wrong.**
  Removes partition pruning entirely, making every query scan the full
  dataset — the opposite of what's needed at this scale.

**Q6.** Most of a device fleet's telemetry is low-priority and only
needed for historical trend analysis, but a small subset of metrics
needs sub-second anomaly detection. What's the most cost-effective
routing design?

- A. Route all telemetry through Kinesis and Flink — **Wrong.**
  Unnecessarily routes the bulk, non-time-critical majority of
  telemetry through real-time infrastructure, inflating cost without a
  corresponding benefit.
- B. **Use the IoT Core Rules Engine to route the anomaly-relevant
  subset to Kinesis/Flink and the bulk telemetry to the cheaper
  Firehose-to-S3 batch path** — **Correct.** Matches processing cost to
  actual latency need per metric type, avoiding the common
  over-engineering trap of treating everything as real-time.
- C. Route all telemetry through Firehose only, with no real-time path
  — **Wrong.** Fails the anomaly-detection latency requirement for the
  subset of metrics that genuinely need sub-second treatment.
- D. Store all telemetry in DynamoDB and run anomaly detection as a
  scheduled Lambda scan — **Wrong.** DynamoDB Scan doesn't scale well
  to this data volume, and a scheduled scan is inherently batch, not
  the sub-second detection the anomaly path requires.

**Q7.** A device on intermittent cellular connectivity needs to run
local anomaly filtering and only forward flagged events to the cloud,
to conserve bandwidth. What AWS service enables this?

- A. AWS Lambda in the cloud region — **Wrong.** Runs in AWS's cloud,
  not on the device itself; doesn't reduce the bandwidth this device
  uses to reach the cloud in the first place.
- B. **AWS IoT Greengrass**, running local processing/filtering at the
  edge — **Correct.** Purpose-built to run compute (including Lambda
  functions) locally on edge hardware, forwarding only the data that's
  actually needed to the cloud.
- C. Amazon Kinesis Data Streams — **Wrong.** A cloud-side streaming
  service; it doesn't run on or reduce bandwidth from the device.
- D. AWS IoT Device Defender — **Wrong.** A security-monitoring service,
  not a local compute/filtering runtime.

**Q8.** After the curated zone's Glue ETL job re-orders telemetry by
event time, an auditor wants to confirm the raw zone's original
ingest-time data was preserved unmodified, in case reprocessing is
ever needed. What architectural property guarantees this?

- A. The curated zone is periodically backed up to Glacier —
  **Wrong.** Backing up the curated (already-transformed) zone doesn't
  preserve the original raw, untransformed data.
- B. **The raw/bronze zone is written once and never modified in
  place** — **Correct.** This is the standard bronze-zone immutability
  pattern used throughout this repo's architectures — the ETL job reads
  from bronze and writes to a separate curated zone, never altering
  bronze itself, which is exactly what makes safe reprocessing possible.
- C. DynamoDB point-in-time recovery on the device-shadow table —
  **Wrong.** PITR applies to the device-shadow table's current-state
  data, not the historical raw telemetry archive in S3.
- D. Kinesis retention set to 365 days — **Wrong.** Retention on the
  in-stream Kinesis data doesn't guarantee the S3-resident raw zone
  itself was never modified after landing.

**Q9.** A utility company deploying 50 million smart meters needs to
send periodic firmware updates to devices in staged batches with
rollback capability if a batch shows failures. What should manage
this?

- A. Manually SSH/connect to each device and update firmware — **Wrong.**
  Completely unworkable at 50 million devices.
- B. **AWS IoT Device Management OTA update jobs**, with staged rollout
  and rollback — **Correct.** Purpose-built for exactly this fleet-scale
  firmware deployment pattern, including staged/canary rollout and
  rollback on failure detection.
- C. AWS Systems Manager Patch Manager — **Wrong.** Patch Manager targets
  EC2 instances and on-premises servers under SSM management, not
  IoT edge devices connected via MQTT.
- D. Re-provision every device with a new certificate to force a
  firmware refresh — **Wrong.** Certificates handle identity/
  authentication, not firmware delivery; this doesn't achieve the
  stated goal at all.

**Q10.** A telemetry pipeline's real-time anomaly-detection Flink
application crashes during a regional connectivity surge. What happens
to the events that arrived during the outage?

- A. They are permanently lost since Flink was down — **Wrong.**
  Kinesis retains events independently of consumer availability; a
  downed consumer doesn't cause data loss on a properly configured
  stream.
- B. **They remain in Kinesis (within the retention window) and are
  processed once Flink resumes from its last checkpoint** — **Correct.**
  Kinesis's durability plus Flink's checkpointing means the application
  catches up on the backlog rather than losing it, at the cost of some
  processing delay.
- C. IoT Core automatically re-delivers the events directly to a backup
  Lambda function — **Wrong.** IoT Core's Rules Engine routes messages
  once at ingest time; it doesn't independently track and re-deliver
  based on a downstream consumer's availability — that durability comes
  from Kinesis's retention, not IoT Core.
- D. The bulk Firehose path silently takes over anomaly detection
  duties — **Wrong.** Firehose has no processing/anomaly-detection
  capability; it only delivers data to S3.
