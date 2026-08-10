# Healthcare Architecture — HL7/FHIR, PHI, and Population Health Analytics

> Patient data ingestion from hospital systems, PHI discovery and
> masking, and a de-identified analytics layer for population health
> and clinical research. Built from the same service vocabulary as the
> rest of this repo — see `00-START-HERE/SERVICE-SELECTION-MATRIX.md`
> Part 0 for how exam questions are assembled from scenario →
> requirement → constraint.

## CONTENTS

1. [Business context](#context)
2. [End-to-end architecture](#architecture)
3. [Service-by-service rationale](#rationale)
4. [Security and governance — HIPAA controls](#security)
5. [Scaling at 10x and 100x](#scaling)
6. [Failure scenarios](#failure)
7. [Cost drivers and optimization](#cost)
8. [Real-company parallel](#company)
9. [Exam traps specific to healthcare scenarios](#traps)
10. [Practice questions](#questions)

---

<a name="context"></a>
## 1. Business context

Healthcare data is defined by two things that fight each other:
**heterogeneity** and **legal fragility**. A single hospital system
produces admission/discharge/transfer (ADT) messages, lab results, and
clinical observations in **HL7 v2** (a decades-old pipe-and-caret
delimited format, not JSON), newer systems and interoperability
mandates increasingly speak **FHIR** (JSON/XML over REST), imaging
systems produce DICOM metadata, and claims data arrives in yet another
shape (X12 837/835). None of it is a clean, uniform schema, and none of
it can be treated the way a retail clickstream is treated — every one
of these records can contain **Protected Health Information (PHI)**:
name, MRN, diagnosis, treatment, and dates that, combined, can
re-identify a patient even without a name attached. Under **HIPAA**,
mishandling PHI isn't a data-quality bug, it's a federal compliance
violation with real financial and legal consequences for the
organization — which means the "least operational overhead" lens this
exam usually applies gets a second, non-negotiable filter layered on
top: **is this PHI properly discovered, minimized, and access-
controlled at every stage**, not just encrypted at rest.

Volume and latency pressures differ by data type. Bedside monitoring
devices and lab result feeds arrive continuously and sometimes need
near-real-time delivery to a clinical alerting system (an abnormal
potassium result flagged within minutes, not hours). ADT feeds from the
hospital's core EHR (Epic, Cerner) are typically CDC-shaped —
continuous change capture off the EHR's underlying database or an
HL7 interface engine — rather than a clean streaming API. Research and
population-health analytics, by contrast, are explicitly **not**
latency-sensitive: a researcher studying diabetes readmission trends
across 2 million de-identified patient records cares about statistical
completeness and correctness, not sub-second delivery. This is a
scenario where the exam's usual instinct to reach for streaming
services is frequently a trap — most of the actual analytics workload
here is batch, against a curated, de-identified zone.

Data sovereignty and minimum-necessary-use are architectural
constraints, not afterthoughts. HIPAA's **minimum necessary standard**
means a researcher should never have query access to a fully identified
patient record when a de-identified or limited dataset satisfies the
research question — this is why the architecture below has a hard wall
between an **identified zone** (operational, tightly access-controlled,
used for clinical care) and a **de-identified/limited zone** (used for
research and population health, accessible to a much broader analyst
population). Getting this wall wrong — for example, exposing the
identified zone to a broad analytics team "because it's convenient" —
is the single most common way a healthcare architecture question is
designed to be answered incorrectly.

---

<a name="architecture"></a>
## 2. End-to-end architecture

```
   HOSPITAL EHR SYSTEMS              BEDSIDE / LAB DEVICES         CLAIMS / BILLING
 ┌───────────────────────┐        ┌────────────────────────┐   ┌─────────────────────┐
 │ Epic/Cerner core DB    │        │ HL7 v2 ADT & lab result │   │ X12 837/835 claims   │
 │ (patient, encounter)   │        │ feeds via interface eng.│   │ files from payers    │
 └───────────┬────────────┘        └────────────┬────────────┘   └──────────┬───────────┘
             │ (1)                              │ (2)                       │ (3)
             v                                  v                           v
    AWS DMS (CDC mode)                Kinesis Data Streams          AWS Transfer Family
     from EHR database                (HL7/FHIR message events)     (SFTP → S3)
             │                                  │                           │
             │                                  v                           │
             │                    Managed Service for Apache Flink          │
             │                    (critical-value lab alerting,             │
             │                     abnormal vital-sign detection)           │
             │                                  │                           │
             │                                  v                           │
             │                       SNS → clinical alerting system         │
             │                                  │                           │
             v                                  v                           v
 ┌──────────────────────────────────────────────────────────────────────────────────┐
 │              IDENTIFIED / RAW ZONE — Amazon S3, KMS CMK (SSE-KMS)                 │
 │        Tightly scoped IAM + Lake Formation grants — clinical/ops roles only       │
 └───────────────────────────────────┬────────────────────────────────────────────--┘
                                      │ (4)
                     AWS Glue ETL — HL7/FHIR parsing, schema conformance,
                     Amazon Macie PHI discovery scan runs alongside
                                      │
                                      v
 ┌────────────────────────────────────────────────────────────────────────────────--┐
 │        CURATED IDENTIFIED ZONE — Apache Iceberg on S3 (Parquet, encrypted)        │
 │              Cell-level security via Lake Formation for clinical use              │
 └───────────────────────────────────┬────────────────────────────────────────────--┘
                                      │ (5)
                    Glue ETL — de-identification pass (Safe Harbor /
                    Expert Determination method: strip/generalize the
                    18 HIPAA identifiers)
                                      │
                                      v
 ┌────────────────────────────────────────────────────────────────────────────────--┐
 │      DE-IDENTIFIED / RESEARCH ZONE — Iceberg on S3, broader analyst access        │
 └───────────────────────────────────┬────────────────────────────────────────────--┘
                                      │ (6)
                                      v
 ┌────────────────────────────────────────────────────────────────────────────────--┐
 │   GOLD / CONSUMPTION — Redshift (population health, readmission models) ·         │
 │   Athena (ad hoc research queries) · QuickSight (public-health dashboards)        │
 └────────────────────────────────────────────────────────────────────────────────--┘

        GOVERNANCE LAYER (wraps every zone above):
        Lake Formation (cell-level security — row + column together, so a
        clinician sees only their own patients' full records) ── Amazon
        Macie (continuous PHI discovery, evidence the de-identification
        pass actually worked) ── AWS KMS CMK per zone (separate keys for
        identified vs. de-identified data, so a compromised de-identified-
        zone key can't unlock identified data) ── CloudTrail data events
        (every read of an identified record logged) ── VPC interface
        endpoints (no PHI traverses the public internet)

        ORCHESTRATION LAYER:
        EventBridge (HL7 interface engine batch drops trigger a Step
        Functions execution) ──▶ Step Functions (parse → validate →
        de-identify → load, retries per stage) ──▶ SNS (failure alert to
        data governance team)
```

**Arrow-by-arrow explanation:**

**(1) EHR core database → AWS DMS (CDC mode).** The hospital's Epic/
Cerner database is never modified; DMS captures inserts/updates on
patient and encounter tables continuously. This is the ADT/demographic
backbone the rest of the pipeline joins against.

**(2) HL7/FHIR message feeds → Kinesis Data Streams.** Interface-engine
message traffic (HL7 v2 ADT, ORU lab results, or FHIR resource events)
lands in Kinesis because a subset of it — critical lab values, abnormal
vitals — needs **near-real-time clinical alerting**, and because
multiple independent consumers exist (the alerting pipeline and the
raw-zone archival path both read the same stream).

**Critical-value alerting path:** Kinesis feeds **Managed Service for
Apache Flink**, which parses the HL7 segment structure (or FHIR
resource) and evaluates threshold rules (a potassium result outside
normal range, a heart rate outside a clinical bound) in near real time,
publishing to **SNS**, which routes to the hospital's clinical alerting
system. This is the one place in the architecture where "real-time"
genuinely applies — everything else downstream of this diagram is
batch.

**(3) Claims/billing files → AWS Transfer Family.** Payers deliver X12
claims files over SFTP by industry convention; Transfer Family provides
a managed endpoint writing directly to S3.

**(4) All sources → identified/raw zone, then Glue ETL + Macie scan
running alongside.** Everything converges into an S3 zone holding fully
identified PHI, access-restricted via IAM and Lake Formation to
clinical/operations roles only. Glue ETL parses HL7's delimited segment
format and FHIR's nested JSON into a conformed schema. **Amazon Macie**
runs continuously against this zone — not to find PHI that shouldn't be
there (it's expected to be there), but to produce the audit evidence
that the organization knows exactly where its PHI lives, which HIPAA's
required risk-assessment process depends on.

**(5) Curated identified zone → de-identification pass → research
zone.** This is the architecture's most important arrow. A dedicated
Glue ETL job applies **Safe Harbor de-identification** — removing or
generalizing all 18 HIPAA-defined identifiers (names, exact dates
generalized to year, geographic subdivisions smaller than a state
removed, MRNs replaced with a research-only pseudonym) — before data
crosses into the research zone. This is a **one-way** transformation:
the research zone has no path back to re-identify a patient without a
separate, tightly controlled linkage key held outside the analytics
environment.

**(6) De-identified zone → gold/consumption.** Redshift serves
population-health modeling (readmission risk, chronic-disease cohort
analysis) at BI scale; Athena serves ad hoc researcher queries against
the same de-identified Iceberg tables without provisioning anything;
QuickSight serves public-health dashboards. Crucially, **none of these
consumption-layer services ever query the identified zone directly** —
that's a Lake Formation-enforced boundary, not just a convention.

---

<a name="rationale"></a>
## 3. Service-by-service rationale

| Layer | Service chosen | Why it won | Runner-up | Why the runner-up lost |
|---|---|---|---|---|
| EHR replication | **AWS DMS (CDC)** | No changes to the EHR vendor's database; continuous low-lag capture | Vendor-provided HL7 batch export | Batch exports are typically nightly, which fails the near-real-time alerting requirement for critical values tied to encounter/demographic context |
| HL7/FHIR message ingest | **Kinesis Data Streams** | Replay for reprocessing after alerting-logic changes, multiple consumers (alerting + archival) | Amazon Data Firehose | No replay — if a clinical alert rule is found to be miscalibrated, there's no way to reprocess the last 24 hours of messages against a corrected rule |
| Critical-value alerting | **Managed Service for Apache Flink** | Sub-second-to-second rule evaluation against a continuous message stream | AWS Lambda per-message | Workable for simple threshold checks, but loses to Flink once rules need any windowed context (e.g., "3 abnormal readings in 10 minutes") |
| Claims files | **AWS Transfer Family** | Managed SFTP matching payer conventions, no server to operate | Self-managed SFTP | Unnecessary patching/operational burden for a fully-managed alternative |
| PHI discovery | **Amazon Macie** | Automated, continuous, produces audit evidence for HIPAA risk assessments | Manual data classification | Doesn't scale to a growing multi-terabyte identified zone and produces no repeatable audit trail |
| Identified-zone access control | **Lake Formation cell-level security** | Combines row (this clinician's own patients) and column (no SSN for a billing analyst) filtering in one policy | IAM + separate per-role table copies | IAM alone can't express row+column combined filters; duplicating tables per role multiplies both storage and de-identification risk (more copies of PHI to track) |
| De-identification | **Glue ETL custom job implementing Safe Harbor rules** | Auditable, versioned, testable transformation logic that can be reviewed by compliance | A generic masking/tokenization service applied ad hoc per query | HIPAA de-identification is a defined legal standard (Safe Harbor's 18 identifiers, or Expert Determination) — it needs to be a documented, repeatable ETL step, not an inconsistent per-query mask |
| Population health analytics | **Amazon Redshift** | Complex multi-cohort joins across large de-identified tables for a standing research/BI team | Athena | Athena is the right complement for ad hoc queries, but a standing population-health BI workload with dashboards and recurring joins is Redshift's use case |
| Research ad hoc queries | **Amazon Athena** | Pay-per-query for unpredictable, occasional researcher access patterns against the de-identified zone | Provisioned Redshift for every researcher | Provisioning always-on compute for intermittent research querying wastes spend the exam consistently penalizes |
| Orchestration | **AWS Step Functions** | Explicit parse → validate → de-identify → load stages with per-stage retry and a visual audit trail compliance reviewers can inspect | Amazon MWAA | No existing Airflow investment in this scenario; Step Functions' native retry/branching is lower-ops for this shape |

---

<a name="security"></a>
## 4. Security and governance — HIPAA controls

| HIPAA requirement | AWS control |
|---|---|
| Access control — minimum necessary standard | **Lake Formation cell-level security**: clinicians see only their assigned patients' identified records; researchers see only the de-identified zone |
| Audit controls — who accessed PHI, when | **CloudTrail data events** on the identified-zone S3 bucket; every `GetObject` logged with principal and timestamp |
| Encryption at rest | **SSE-KMS with separate customer-managed CMKs per zone** — identified zone and de-identified zone use different keys, so a compromised de-identified-zone key (broader access population) cannot unlock the identified zone |
| Encryption in transit | TLS enforced via bucket/stream policy `aws:SecureTransport` condition on all S3, Kinesis, and Redshift endpoints |
| Transmission security — PHI never crosses the public internet | **VPC interface endpoints (PrivateLink)** for Glue, Kinesis, Redshift; **Gateway VPC endpoint** for S3 |
| PHI inventory / risk assessment evidence | **Amazon Macie** scheduled discovery jobs, with findings exported to Security Hub for the compliance team's periodic risk assessment |
| De-identification correctness | Glue ETL job outputs are **re-scanned by Macie** post-transformation — if Macie still finds identifier patterns in the "de-identified" zone, that's a pipeline defect caught before researchers ever see the data |
| Business Associate Agreement (BAA) coverage | All in-scope AWS services used for PHI must be BAA-eligible services (S3, Glue, Kinesis, Redshift, Lake Formation, KMS, Macie all qualify) — using a non-BAA-eligible service for PHI processing is itself a compliance violation regardless of how well it's encrypted |
| Credential hygiene for the EHR connection | **AWS Secrets Manager** with automatic rotation for the DMS source-endpoint credentials against the EHR database |
| Data sovereignty / regional residency | Pipeline and all storage pinned to a single approved AWS Region (or region set) via SCPs restricting resource creation outside approved regions — relevant when a health system operates across state or national boundaries with differing data-residency expectations |

⚠️ **BAA-eligibility is a HIPAA-specific filter this exam does not test
by name in most questions, but the underlying pattern — "use the
managed, encrypted, access-controlled AWS service, not a workaround" —
is exactly what BAA-eligibility maps to in the real world.** Treat any
option describing "export PHI to a third-party tool" or "process PHI
outside the documented pipeline" as an automatic wrong answer in a
HIPAA scenario, regardless of what technical benefit it claims.

---

<a name="scaling"></a>
## 5. Scaling considerations

**Baseline assumed:** a mid-size hospital system, ~500K HL7 messages/day,
~2M patient records under management.

**At 10x (a regional health network, ~5M messages/day, ~20M patients):**
- Kinesis moves to **on-demand mode** to absorb variable message volume
  across multiple hospitals feeding the same interface engine output.
- The de-identification Glue job needs **partitioned, parallelized
  execution** (increased DPU/worker count) to keep pace with a larger
  daily identified-zone volume without pushing the research zone's
  freshness out by hours.
- Lake Formation's cell-level policies scale from "per hospital"
  row-filters to **LF-Tag-based (TBAC)** policies, since manually
  managing per-clinician row grants across 20M patients and dozens of
  facilities becomes operationally unworkable.

**At 100x (a national health data network / HIE, ~50M messages/day,
~200M patient records):**
- A single Kinesis stream and single Flink application become a
  capacity and blast-radius concern; message traffic is sharded **by
  facility or region**, with a separate alerting Flink application per
  shard group to bound the impact of one facility's malformed message
  traffic.
- The de-identification pipeline becomes multi-stage with **incremental,
  bookmark-driven processing** rather than full daily reprocessing —
  full reprocessing of 200M patients' worth of history nightly is no
  longer viable.
- Redshift moves to a **data-sharing architecture** — a single ETL/write
  cluster, multiple read-only consumer clusters for different research
  institutions, so heavy analytical load from one institution's study
  doesn't degrade another's.
- Regional data-sovereignty requirements typically become mandatory
  rather than optional at this scale (multi-state or multi-country
  network), splitting the architecture into regional pipelines with a
  federated, aggregate-only reporting layer above them.

---

<a name="failure"></a>
## 6. Failure scenarios and tolerance

| Failure | Architecture's response |
|---|---|
| Flink alerting application crashes during a shift | Kinesis retention holds the message backlog; Flink resumes from its last checkpoint and processes the backlog — delayed alerting is logged and escalated, never silently dropped |
| DMS CDC replication falls behind during an EHR maintenance window | DMS resumes from its last captured change-log position automatically; the identified raw zone is unaffected, just temporarily stale |
| De-identification Glue job fails partway through | Job bookmarks prevent reprocessing already-committed files; critically, a **failed de-identification run must never allow partially de-identified data to reach the research zone** — the job writes to a staging location and only promotes on full success |
| Macie post-transformation scan finds residual identifiers in the "de-identified" zone | The promotion step is gated on a clean Macie scan — this is a hard stop, not a warning, given the compliance stakes of exposing PHI to the broader research population |
| A single AZ fails during business hours | Kinesis, RDS/Aurora metadata, and Redshift are Multi-AZ; S3 is regionally redundant — clinical alerting and ingestion continue without manual failover |
| A researcher's Athena query attempts to join the de-identified zone against an external dataset in a way that could re-identify patients | Architecturally out of Athena's control — this is why Lake Formation access boundaries plus organizational data-use agreements, not just technical controls, are part of a complete HIPAA answer |

---

<a name="cost"></a>
## 7. Cost drivers and optimization levers

**Top cost drivers:**
1. **Kinesis + Flink running continuously** for a workload where only a
   fraction of the message volume (critical values) actually needs
   real-time treatment — most HL7 traffic is informational, not
   alert-worthy.
2. **Separate KMS CMKs and redundant storage** across identified and
   de-identified zones, which is a deliberate security cost, not
   accidental waste.
3. **Redshift always-on compute** for a research workload that, unlike
   banking's monthly reporting cycle, has less predictable usage
   patterns tied to grant funding cycles and study timelines.

**Optimization levers:**
- **Route only alert-relevant HL7 message types (ORU lab results, key
  vital-sign observations) through the real-time Flink path**; route
  bulk ADT/administrative traffic through a cheaper batch Firehose-to-S3
  path — not every message needs the real-time treatment, and treating
  all of it as real-time is the most common over-engineering mistake in
  this vertical.
- **Redshift Serverless** for the research/population-health workload
  given its unpredictable, grant-cycle-driven usage pattern.
- **S3 Intelligent-Tiering** on the identified raw zone — clinical data
  older than the active-care window is accessed rarely but must be
  retained for HIPAA's minimum retention period, making it a strong
  Intelligent-Tiering (not lifecycle-to-Glacier, since occasional legal/
  audit retrieval needs to stay fast) candidate.

---

<a name="company"></a>
## 8. Real-company parallel

This mirrors how large health systems and health information exchanges
(HIEs) architect interoperability and research platforms on AWS: CDC
out of the EHR's operational database (rather than touching Epic/Cerner
application code), a Kinesis-or-similar real-time path reserved for
genuinely time-critical clinical alerting, and — the defining pattern
of this vertical — a hard, one-way de-identification boundary between
an operational/clinical zone and a research zone, mirroring how
academic medical centers and health-data networks structure IRB-
governed research access separately from clinical operations.

---

<a name="traps"></a>
## 9. Exam traps specific to healthcare scenarios

⚠️ **Not everything HL7-shaped is a streaming problem.** Population
health and research analytics are batch by nature — a question
describing "researchers analyze de-identified trends across the patient
population" that offers Kinesis Data Streams as the answer is testing
whether you default to streaming just because the source data
originated as streaming HL7 messages. The de-identified research zone
is batch-fed and batch-queried.

⚠️ **De-identification is a one-way, auditable ETL transformation, not
a query-time mask.** A question offering "apply a Lake Formation
column mask at query time" as equivalent to HIPAA de-identification is
conflating two different controls — column masking hides a column from
a role but the underlying identified data still exists in that table;
true de-identification removes identifiers from the data itself before
it's stored in the research zone.

⚠️ **"Least operational overhead" does not override BAA-eligibility or
encryption requirements.** As in banking, compliance constraints are a
floor in HIPAA scenarios, not one input to trade off against cost.

⚠️ **Timestream is recognize-only in this repo's material** (see
`01-domains/DOMAIN-2-DATA-STORE-MANAGEMENT.md`) — a healthcare vitals-
monitoring question describing "purpose-built time-series storage" may
still name Timestream as the textbook answer for recognition purposes,
but a "design a new pipeline" scenario in this architecture uses
Iceberg-on-S3, consistent with the rest of this repo's current
recommendation.

⚠️ **DMS full load vs. CDC** applies here exactly as in banking: "one-
time migration of historical patient records to the new lake" is full
load; "continuously replicate the EHR" is CDC — DMS does both, the
scenario language decides which.

---

<a name="questions"></a>
## 10. Practice questions

**Q1.** A hospital's Epic database must feed a new S3-based data lake
continuously, without any changes to Epic's application code. Which
service accomplishes this?

- A. A nightly Glue JDBC extract — **Wrong.** Full extracts on a schedule
  aren't continuous and don't capture individual changes with low lag.
- B. **AWS DMS in CDC mode** — **Correct.** Reads the database's native
  change log continuously with zero source-side code changes.
- C. Amazon AppFlow — **Wrong.** AppFlow integrates with named SaaS
  applications, not an arbitrary hospital EHR's underlying database.
- D. Kinesis Data Streams with a custom Epic-side producer — **Wrong.**
  Requires writing and deploying new code against Epic, which the
  scenario rules out.

**Q2.** A clinical alerting system must be notified within seconds when
a lab result crosses a critical threshold, evaluated against the
patient's last three readings. What computes this?

- A. Amazon Data Firehose with Lambda transform — **Wrong.** No
  stateful, multi-record windowed evaluation capability.
- B. **Amazon Managed Service for Apache Flink** — **Correct.** Native
  windowed, stateful stream processing evaluates the last-three-readings
  rule continuously with sub-second-to-second latency.
- C. Athena scheduled query every 5 minutes — **Wrong.** Batch query
  latency and cadence don't meet "within seconds," and re-querying at
  rest doesn't scale to continuous evaluation.
- D. DynamoDB Streams — **Wrong.** DynamoDB Streams reacts to table
  writes; it doesn't itself perform windowed threshold evaluation
  against a message stream from an interface engine.

**Q3.** Researchers need to study readmission trends but must never see
patient names, exact birthdates, or MRNs. What is the correct
architectural pattern?

- A. Grant researchers a Lake Formation column mask on the identified
  table that hides those specific columns — **Wrong.** Column masking
  hides fields at query time but leaves the underlying identified data
  intact in the table; it does not meet the Safe Harbor de-
  identification standard which requires the identifiers themselves be
  removed or generalized in the stored data.
- B. **A separate, one-way de-identification ETL pass producing a
  distinct research zone** — **Correct.** Applies the Safe Harbor
  standard (or Expert Determination) to physically strip/generalize the
  18 HIPAA identifiers before researchers ever query the data.
- C. Give researchers read access to the identified zone with an IAM
  policy — **Wrong.** IAM can't filter columns, and this exposes full
  PHI to a broader population than minimum-necessary allows.
- D. Encrypt the identified zone with a stronger KMS key for researcher
  access — **Wrong.** Encryption strength has no bearing on whether the
  data itself contains identifiers; this doesn't achieve de-
  identification at all.

**Q4.** The compliance team needs continuous, automated evidence of
exactly where PHI exists across a multi-terabyte, growing S3 data lake,
for a HIPAA risk assessment. What should they deploy?

- A. Annual manual audit — **Wrong.** Doesn't scale and produces no
  continuous evidence trail between reviews.
- B. **Amazon Macie scheduled discovery jobs** — **Correct.** Uses
  managed data identifiers to continuously find PHI-pattern data across
  S3 and reports findings for the risk assessment.
- C. AWS Config — **Wrong.** Evaluates resource configuration, not the
  content of data inside objects.
- D. S3 Inventory reports — **Wrong.** Lists objects and their metadata,
  not whether their content contains PHI.

**Q5.** A health system must ensure that a compromised key used for the
de-identified research zone cannot be used to decrypt the identified
clinical zone. What satisfies this?

- A. A single account-wide KMS key for all S3 buckets — **Wrong.** One
  shared key means a compromise anywhere compromises everything,
  exactly the opposite of the requirement.
- B. **Separate customer-managed KMS CMKs per zone** — **Correct.**
  Isolates blast radius; disabling or rotating the research-zone key has
  no effect on the identified zone's key.
- C. SSE-S3 for both zones — **Wrong.** AWS-managed keys give the
  organization no rotation or revocation control at all, in either zone.
- D. Client-side encryption using the same key material for both zones —
  **Wrong.** Same problem as option A — shared key material defeats the
  isolation requirement.

**Q6.** A hospital's HL7 interface engine occasionally sends malformed
messages that crash the alerting pipeline's parser. What design
prevents a full pipeline outage from this?

- A. Reject and drop malformed messages silently at the source — **Wrong.**
  Silent data loss is unacceptable for clinical data, and doesn't
  address the crash itself.
- B. **A dead-letter queue (SQS DLQ) capturing messages the Flink/Lambda
  parser can't process, with the main pipeline continuing** — **Correct.**
  Isolates poison messages so they don't halt processing of the rest of
  the stream, while preserving them for investigation.
- C. Stop the interface engine until the parser is fixed — **Wrong.**
  Halting the hospital's clinical message feed to fix a downstream bug
  is operationally unacceptable and unnecessary.
- D. Increase Kinesis shard count — **Wrong.** Shard count addresses
  throughput, not malformed-message handling; it doesn't fix a parser
  crash.

**Q7.** A national HIE serving 200M patient records needs its
population-health reporting to remain fast for one research institution
even while another institution runs a very heavy exploratory study
query. What Redshift pattern addresses this?

- A. One shared provisioned cluster for all institutions — **Wrong.**
  Exactly the contention scenario the question is describing; one
  institution's heavy query would degrade another's reporting.
- B. **Redshift data sharing — one producer cluster for ETL/writes, and
  separate read-only consumer clusters per institution** — **Correct.**
  Isolates each institution's query load onto its own compute while
  sharing the same underlying curated data with no copying.
- C. Move all reporting to Athena instead — **Wrong.** Athena helps with
  ad hoc isolation via workgroups but doesn't provide the always-on,
  concurrent BI dashboard performance a standing research reporting
  workload needs at this scale.
- D. Give every institution its own full copy of the data warehouse —
  **Wrong.** Massive duplication of PHI-adjacent data and additional
  de-identification/audit surface area to maintain, when data sharing
  achieves isolation without copying.

**Q8.** Which statement correctly distinguishes DMS full load from DMS
CDC in this healthcare architecture?

- A. Full load and CDC are the same operation with different names —
  **Wrong.** They're functionally distinct: full load takes a one-time
  snapshot, CDC streams ongoing changes.
- B. **Full load is used for the one-time historical migration of
  existing patient records into the lake; CDC is used for the ongoing,
  continuous replication of new changes from the EHR** — **Correct.**
  This matches DMS's actual dual capability, and both are typically used
  together (full load to seed history, then switch to CDC).
- C. CDC can only be used for claims data, never clinical data —
  **Wrong.** No such restriction exists; CDC works against any
  supported source database regardless of data type.
- D. Full load requires application code changes on the EHR; CDC does
  not — **Wrong.** Neither DMS mode requires source application code
  changes — that's precisely why DMS is chosen for the EHR replication
  requirement in the first place.

**Q9.** A question describes a service that must continuously ingest
sensor-driven bedside vital signs "with automatic time-series tiering,"
purely as a recognition-level question about what the service is for.
What is the intended answer, per this repo's currency guidance?

- A. Amazon Timestream — **Correct for recognition purposes.** This
  repo flags Timestream as recognize-only (AWS has been winding down
  Timestream for LiveAnalytics for new customers), but if a question is
  purely testing "what is this service for," Timestream remains the
  textbook match for purpose-built time-series storage with automatic
  tiering.
- B. Apache Iceberg on S3 — **Wrong for this specific recognition
  question, though it is the right choice for a "design a new pipeline"
  scenario.** The question as posed is asking what a described service
  is, not asking you to design a new system, so it's testing recall of
  Timestream's description, not a build recommendation.
- C. DynamoDB — **Wrong.** DynamoDB isn't purpose-built for time-series
  tiering; it's a general key-value/document store.
- D. Redshift — **Wrong.** Not a time-series-specialized store, and
  doesn't match "automatic tiering" as a defining feature.

**Q10.** A health system wants to guarantee that patient data collected
in the EU is stored and processed only within EU AWS regions, even as
the organization grows into new markets. What enforces this?

- A. A written internal policy with no technical enforcement — **Wrong.**
  Policy without enforcement doesn't prevent an engineer from
  accidentally provisioning resources in the wrong region.
- B. **Service Control Policies (SCPs) restricting resource creation to
  approved regions, applied at the AWS Organizations level** — **Correct.**
  Technically enforces regional residency across all accounts in the
  organization, not just as a guideline.
- C. S3 Cross-Region Replication to a US region for backup — **Wrong.**
  This actively violates the residency requirement by copying data
  outside the approved region.
- D. IAM permission boundaries — **Wrong.** Permission boundaries limit
  what actions a principal can grant to others; they don't restrict
  which AWS regions resources can be created in.
