# LAB-05 — Amazon Data Firehose to S3 with Dynamic Partitioning

> **Day 2 anchor lab.** Filename says "Kinesis" for series-numbering
> consistency, but per the 10-Day Plan this lab is built around
> **Amazon Data Firehose** (the current name — never call it "Kinesis
> Data Firehose" on the exam), not Kinesis Data Streams directly.
> Firehose is where the ingestion-domain hands-on time is best spent
> for exam purposes: it's the fully-managed delivery service most
> "get streaming data into S3, partitioned, with zero servers"
> questions are actually about.

---

## 1. Objective

This lab builds hands-on muscle memory for:

- **Domain 1, Task 1.1** — streaming ingestion configuration,
  handling buffering/backpressure behavior, and understanding
  replayability limits of a delivery-only service (Firehose is not a
  replayable stream the way Kinesis Data Streams is — an important
  exam distinction you'll feel directly in this lab)
- **Domain 1, Task 1.2** — format conversion (JSON → Parquet) inline
  during ingestion, without a separate Glue job
- **Domain 2, Task 2.4** — **dynamic partitioning**, which writes
  incoming records into S3 prefixes based on values *inside* each
  record (e.g., `customer_id`, `event_type`) — contrast this with
  LAB-01/02 where partitions came from pre-existing S3 structure or a
  Glue job's derived columns
- Buffering hints (`buffer size` / `buffer interval`) as the
  fundamental latency-vs-file-size tradeoff knob for every
  micro-batching ingestion service on the exam

By the end you will have sent live test events into Firehose and
watched them land in S3 as **dynamically partitioned Parquet files**
within minutes — the exact architecture behind "IoT devices/clickstream
events land in S3 partitioned by device/event type with no code to
maintain" exam scenarios.

---

## 2. Prerequisites

- No prior labs required — this can be done standalone (though it
  pairs naturally as "Day 2" after LAB-01's Day-1 foundations).
- IAM permissions: create a Firehose delivery stream, create an IAM
  role for Firehose (S3 write + Glue Catalog read for the Parquet
  conversion), and either console access to the **Firehose test data
  generator** or CLI access to send test records.
- A Glue Data Catalog table describing the target Parquet schema
  (Firehose's JSON→Parquet conversion requires this — you'll create it
  as part of Step 1).

---

## 3. Estimated cost

| Resource | Cost driver | Estimate |
|---|---|---|
| Data Firehose | Billed per **GB ingested**, plus a small format-conversion charge | A few hundred KB of test records ≈ **fractions of a cent** |
| S3 | Storage for delivered files | Effectively $0 |
| Glue Data Catalog | One small table | $0 |
| **Total** | | **Under $0.10** |

**How to avoid surprise charges:**
- Firehose has no idle cost — a delivery stream sitting with no
  incoming records costs nothing beyond the trivial always-on resource
  existence (there is no per-hour charge for an idle stream, unlike
  Redshift Serverless in LAB-04).
- The main way to *accidentally* spend real money here is leaving a
  **script or load generator running in a loop** sending thousands of
  records unattended. This lab sends a small, finite, manually-
  triggered batch — don't wire it to a scheduled Lambda or an infinite
  `while True` loop "just to watch it work."
- Format conversion (JSON→Parquet) adds a small per-GB charge on top
  of ingestion — negligible at this lab's volume, but worth naming as
  a real cost line item for production sizing conversations.

---

## 4. Step-by-step instructions

### Step 1 — Create the target Glue Catalog table (schema for Parquet conversion)

Firehose's built-in record format conversion needs an existing Glue
table to know the target Parquet schema. Create one directly (no
crawler needed — you're defining it by hand since no data exists yet):

**Console:** **Glue → Data Catalog → Tables → Add table manually.**
- Database: `dea_lab05_db` (create new).
- Table name: `events`.
- Data store: **S3**, location `s3://dea-lab05-.../processed/`.
- Format: **Parquet**.
- Columns:
  | Column | Type |
  |---|---|
  | `event_id` | string |
  | `customer_id` | string |
  | `event_type` | string |
  | `event_time` | string |
  | `amount` | double |

(You will *not* add `event_type` or a date as a partition column here
— dynamic partitioning in Firehose manages the S3 prefix structure
independently of this table definition; this table exists purely to
tell Firehose's conversion engine the row schema.)

### Step 2 — Create the S3 bucket and prefixes

```
s3://dea-lab05-.../processed/     (successful, converted, partitioned output)
s3://dea-lab05-.../errors/        (records Firehose could not process)
```

### Step 3 — Create the Firehose delivery stream

**Console:** **Amazon Data Firehose → Create Firehose stream.**
1. Source: **Direct PUT**. Destination: **Amazon S3**.
2. Stream name: `dea-lab05-events-stream`.
3. **Transform and convert records**:
   - Record format conversion: **Enabled** → **Apache Parquet**.
   - Choose the Glue table: `dea_lab05_db.events` (from Step 1).
4. **Dynamic partitioning**: **Enabled**.
   - Enable **inline parsing for JSON**.
   - Add partitioning keys, e.g.:
     - Key name `event_type`, JQ expression `.event_type`
     - Key name `year`, JQ expression `.event_time | strftime("%Y")`
       *(if your Firehose console version supports JQ date functions;
       otherwise supply `year`/`month`/`day` directly as top-level
       fields in your test JSON records instead — simpler and less
       error-prone for a first lab, see the sample payload below)*
   - **S3 bucket prefix**:
     `processed/event_type=!{partitionKeyFromQuery:event_type}/year=!{partitionKeyFromQuery:year}/month=!{partitionKeyFromQuery:month}/`
   - **Error output prefix**: `errors/!{firehose:error-output-type}/`
5. **Buffer hints**: set **Buffer size = 1 MiB**, **Buffer interval =
   60 seconds** (the minimum practical values — small buffer/interval
   means you'll see data land in S3 quickly for lab purposes; note for
   the exam that production tuning usually pushes these *up* to reduce
   small-file counts, the opposite direction of what you want while
   learning).
6. **Destination S3 bucket**: `dea-lab05-...`, prefix as configured
   above.
7. **IAM role**: create new — Firehose needs S3 write access and Glue
   Catalog read access (for the schema lookup).
8. Create delivery stream.

**CLI equivalent** (abbreviated — dynamic partitioning config is
verbose in raw JSON; console is the practical path for a first lab):
```bash
aws firehose create-delivery-stream \
  --delivery-stream-name dea-lab05-events-stream \
  --delivery-stream-type DirectPut \
  --extended-s3-destination-configuration file://firehose-config.json
```

### Step 4 — Send test records

**Simplify by putting the partition-relevant fields as flat top-level
JSON keys** so the JQ expressions are trivial:

```json
{"event_id":"e1","customer_id":"C001","event_type":"purchase","year":"2024","month":"01","event_time":"2024-01-05T10:00:00Z","amount":49.99}
```

**Console (quick test):** **Firehose stream → Test with demo data**
(if available in your console) generates sample records automatically
— useful for a first smoke test, but switch to real test records next
so the partition values are ones you control and can validate.

**CLI (recommended — full control over test payloads):**
```bash
aws firehose put-record \
  --delivery-stream-name dea-lab05-events-stream \
  --record '{"Data":"eyJldmVudF9pZCI6ImUxIiwiY3VzdG9tZXJfaWQiOiJDMDAxIiwiZXZlbnRfdHlwZSI6InB1cmNoYXNlIiwieWVhciI6IjIwMjQiLCJtb250aCI6IjAxIiwiZXZlbnRfdGltZSI6IjIwMjQtMDEtMDVUMTA6MDA6MDBaIiwiYW1vdW50Ijo0OS45OX0="}'
```
(The `Data` field is base64-encoded JSON — `echo -n '<json>' | base64`
to produce it, or use `aws firehose put-record-batch` with the CLI's
`--cli-input-json` to send several at once with different
`event_type`/`month` values, which is more useful for proving
partitioning actually branches into separate prefixes.)

Send **at least 3 distinct combinations** — e.g.,
`event_type=purchase, month=01`, `event_type=purchase, month=02`,
`event_type=refund, month=01` — so Step 5's validation actually
demonstrates multi-key partitioning, not just one prefix.

### Step 5 — Wait for the buffer to flush, then inspect S3

Given the 60-second buffer interval from Step 3, wait **1–2 minutes**,
then check the S3 console:

```
s3://dea-lab05-.../processed/event_type=purchase/year=2024/month=01/...parquet
s3://dea-lab05-.../processed/event_type=purchase/year=2024/month=02/...parquet
s3://dea-lab05-.../processed/event_type=refund/year=2024/month=01/...parquet
```

### Step 6 — Catalog and query the delivered data

**Console:** Run a Glue crawler pointed at `s3://dea-lab05-.../processed/`
targeting `dea_lab05_db` (same pattern as LAB-01 Step 6), or manually
`ALTER TABLE events ADD PARTITION` for each combination if you want to
skip the crawler.

Then in Athena:
```sql
SELECT event_type, year, month, COUNT(*)
FROM dea_lab05_db.events
GROUP BY event_type, year, month
ORDER BY event_type, year, month;
```

**Validation:** counts match the number of test records you sent per
combination.

### Step 7 — Send one deliberately malformed record and observe error handling

```bash
aws firehose put-record \
  --delivery-stream-name dea-lab05-events-stream \
  --record '{"Data":"eyJub3RfdGhlX3JpZ2h0X3NjaGVtYSI6IHRydWV9"}'
```
(This decodes to `{"not_the_right_schema": true}` — missing
`event_type`, which dynamic partitioning needs.)

After the buffer flushes, check
`s3://dea-lab05-.../errors/!{firehose:error-output-type}/` — you
should find the malformed record preserved there rather than silently
dropped, with an error-type-specific prefix
(e.g., `.../errors/partitioning-failed/...`).

---

## 5. Validation checkpoints

| Checkpoint | How to verify | Expected result |
|---|---|---|
| Glue schema table exists | Glue → Tables → `events` | 5 columns as defined in Step 1 |
| Delivery stream active | Firehose console, stream status | `Active` |
| Records delivered | S3 console under `processed/` | Parquet files present, in `event_type=.../year=.../month=.../` prefixes |
| Multiple partition combinations present | S3 console, browse prefixes | At least 3 distinct `event_type=`/`month=` combinations from Step 4 |
| Format conversion worked | Download/inspect one output file, or query via Athena | File is Parquet (not raw JSON), columns match the Glue schema |
| Athena query matches sent record counts | `GROUP BY event_type, year, month` query | Counts equal what you sent per combination |
| Error handling works | Check `errors/` prefix after Step 7 | Malformed record present under an error-type prefix, not silently lost |

---

## 6. Common errors and fixes

1. **No files ever appear in `processed/`, and the Firehose console's
   monitoring tab shows 0 records delivered even after several
   minutes.**
   *Cause:* Records were sent to the wrong delivery stream name (typo),
   or `put-record` succeeded at the API level but the base64 payload
   was malformed JSON, causing every record to be silently routed to
   the `errors/` prefix instead — check there, not just `processed/`.
   *Fix:* Verify the stream name matches exactly, and validate your
   base64 decodes to well-formed JSON before sending
   (`echo '<base64>' | base64 -d`).

2. **Records land in `errors/` under a "format-conversion-failed"
   or similar prefix, even though the JSON looks correct.**
   *Cause:* A field type mismatch against the Glue table schema — most
   commonly `amount` sent as a JSON string (`"amount":"49.99"`) instead
   of a number (`"amount":49.99`), which the Parquet converter rejects
   against a `double` column definition. *Fix:* Match JSON value types
   exactly to the Glue table's column types, or relax the Glue column
   type to `string` if the mismatch is unavoidable upstream (then cast
   in downstream SQL).

3. **Dynamic partitioning error: records land under
   `errors/partitioning-failed/` because a JQ expression key wasn't
   found in the record.**
   *Cause:* A record is missing one of the fields your JQ partitioning
   expressions reference (e.g., no `event_type` key at all — this is
   Step 7's deliberate demo, but it can also happen by accident on
   real, inconsistent upstream data). *Fix:* For production pipelines,
   this is exactly why Firehose lets you configure a **default value**
   for a partitioning key or route to a catch-all prefix — for this
   lab, just confirm every "real" test record includes all the keys
   your JQ expressions need.

4. **IAM error creating the delivery stream: `Firehose is unable to
   assume role` or delivery stalls with an access-denied error visible
   in CloudWatch Logs (Firehose logs delivery errors there if enabled).**
   *Cause:* The Firehose service role's trust policy doesn't list
   `firehose.amazonaws.com`, or the role lacks `glue:GetTable` (needed
   for the Parquet schema lookup) in addition to S3 write permissions.
   *Fix:* Let the console-generated role handle the trust policy
   automatically (recommended for a first lab), and confirm both S3
   and Glue read/write permissions are attached.

5. **Data is delivered correctly, but as far more, much smaller files
   than expected — dozens of tiny Parquet files instead of a few
   reasonably sized ones.**
   *Cause:* This lab intentionally set **Buffer size = 1 MiB / interval
   = 60s** (the minimum) to make results appear quickly for learning
   purposes — at low record volume, this produces one small file per
   flush interval per partition combination, which is the textbook
   **small-file problem**. *Fix:* Not a bug for this lab, but note for
   the exam and for production: raising buffer size/interval (e.g., to
   128 MiB / 300s, or letting Firehose's newer **file size
   optimization** feature manage it) is the standard fix, trading
   ingestion latency for fewer, larger files.

---

## 7. Cleanup steps

1. **Delete the Firehose delivery stream:**
   ```bash
   aws firehose delete-delivery-stream --delivery-stream-name dea-lab05-events-stream
   ```
   Console: **Firehose → select stream → Delete**.
2. **Empty and delete the S3 bucket:**
   ```bash
   aws s3 rm s3://dea-lab05-nk-.../ --recursive
   aws s3api delete-bucket --bucket dea-lab05-nk-...
   ```
3. **Delete the Glue database/table:**
   ```bash
   aws glue delete-database --name dea_lab05_db
   ```
4. **Delete the crawler** if you created one in Step 6.
5. **IAM role**: delete the Firehose service role if not reused.
6. **Verify**: no `dea-lab05-*` resources remain in Firehose, S3, or
   Glue consoles.

---

## 8. What you learned

This lab directly reinforces:

- **1.1** — Firehose as a fully-managed, buffer-then-deliver streaming
  ingestion pattern, and the buffer-size/buffer-interval tradeoff that
  governs both latency and file size for every micro-batching service
  on the exam
- **1.2** — inline format conversion (JSON→Parquet) with zero separate
  ETL job, using an existing Glue table purely as a schema reference
- **2.4** — **dynamic partitioning** driven by record content (JQ
  expressions against incoming JSON fields), distinct from LAB-01's
  pre-existing S3 key structure and LAB-02's derived-column
  partitioning in a Glue job
- The exam's key Firehose-vs-Kinesis-Data-Streams distinction, felt
  directly here: Firehose is a **delivery** service (buffer → transform
  → land), not a **replayable, consumer-managed stream** — there's no
  shard iterator, no multiple independent consumers reading the same
  data at their own pace, and no manual retention/replay window the
  way Kinesis Data Streams offers. If a scenario needs multiple
  independent consumers replaying the same stream, that's Kinesis Data
  Streams (or MSK), not Firehose.

### Practice questions

**Q1.** A company ingests IoT sensor events and needs them landed in
S3, automatically converted to Parquet, and organized into prefixes by
`device_type` and date — with no custom code to maintain. Which
service best fits, and via which specific feature?

- A. Kinesis Data Streams with a custom KCL consumer application
  written to partition and convert records.
- B. Amazon Data Firehose, using built-in record format conversion
  (Parquet) and **dynamic partitioning** driven by JQ expressions
  against incoming record fields.
- C. AWS Glue streaming ETL job reading directly from the device fleet.
- D. AWS Lambda triggered on a schedule to poll devices and write files.

> **Answer: B.** This is precisely this lab's architecture — zero
> custom code, built-in conversion and dynamic partitioning. A
> requires writing and operating a consumer application — "no custom
> code" rules it out. C describes Glue streaming jobs consuming from a
> stream (Kinesis/MSK), not directly from a device fleet — and it's
> more operational overhead than Firehose for this exact use case. D
> is a poor architectural fit for continuous event ingestion — polling
> on a schedule adds latency and isn't how IoT event delivery works.

**Q2.** A test record sent into a Firehose stream with dynamic
partitioning enabled is missing a field referenced by one of the
partitioning JQ expressions. What happens to that record?

- A. Firehose silently drops the record with no trace.
- B. The entire delivery stream pauses until the issue is fixed.
- C. The record is routed to the configured error output prefix
  (e.g., under a `partitioning-failed` error type) rather than being
  silently discarded or blocking the stream.
- D. Firehose automatically supplies a null value for the missing
  field and delivers the record to a `partition=null` prefix.

> **Answer: C.** This is exactly Step 7's demonstrated behavior in the
> lab. A is false — Firehose preserves failed records for inspection/
> reprocessing rather than silently dropping them. B is false —
> Firehose continues processing other records; one bad record doesn't
> halt the stream. D is a plausible-sounding but incorrect behavior;
> Firehose does not auto-substitute null partition values by default —
> the record fails partitioning and routes to the error prefix (unless
> you've explicitly configured a default value for that key).

**Q3.** Why does this lab deliberately set Firehose's buffer size to
the minimum (1 MiB) and interval to 60 seconds, and what does the
lab's Common Error #5 say is the tradeoff of leaving those settings
unchanged in production?

- A. Minimum buffer settings are required for dynamic partitioning to
  function at all.
- B. Small buffer settings minimize latency (data appears in S3
  quickly, useful for this lab), but at low record volume they produce
  many small files per flush — production tuning typically increases
  buffer size/interval to trade latency for fewer, larger, more
  query-efficient files.
- C. Buffer size only affects cost, not file count or latency.
- D. Small buffer settings are Firehose's only supported configuration
  for JSON-to-Parquet conversion.

> **Answer: B.** This is the explicit lesson of Common Error #5 —
> minimum buffer settings were chosen purely so lab results appear
> quickly, at the direct cost of creating the small-file problem, which
> production deployments avoid by raising these values. A is false —
> dynamic partitioning works at any buffer setting. C is false — buffer
> size/interval directly govern both delivery latency and output file
> size/count, which is the entire point of the tradeoff. D is false —
> Firehose supports a wide range of buffer configurations for
> format-converted output.

**Q4.** A teammate says "Firehose is basically the same as Kinesis Data
Streams, just with S3 as a built-in destination." What is the most
accurate correction, based on the architectural distinction this lab's
"What you learned" section calls out?

- A. They are functionally identical; the only difference is naming.
- B. Firehose is a managed delivery pipeline (buffer, transform,
  land) with no independent consumer/replay model; Kinesis Data
  Streams is a replayable, shard-based stream that multiple
  independent consumers can read from at their own pace within a
  retention window — a materially different architecture, not just a
  destination convenience.
- C. Kinesis Data Streams cannot write to S3 at all, which is the only
  real difference.
- D. Firehose supports exactly-once delivery while Kinesis Data
  Streams only supports at-least-once, making Firehose strictly superior.

> **Answer: B.** This is the direct takeaway stated in Section 8 — the
> architectural difference (delivery-only vs replayable multi-consumer
> stream) matters far more than "which destinations are built in." A
> is false and is exactly the misconception this lab is designed to
> correct. C is false — Kinesis Data Streams data can absolutely reach
> S3, typically via a consumer application, Lambda, or by feeding a
> Firehose stream configured with a KDS source; it's just not a
> single-hop built-in destination the way Firehose's is. D
> mischaracterizes delivery guarantees and frames one service as
> strictly superior, which isn't how the exam expects these to be
> compared — they solve different problems.

**Q5.** In Step 6, why does the lab need to run a Glue crawler (or
manually add partitions) against the Firehose output prefix, rather
than the data being automatically queryable in Athena the moment it lands?

- A. Firehose writes data in a proprietary format that Athena cannot
  read without conversion.
- B. Landing data in S3 and registering it in the Glue Data Catalog are
  separate concerns — Firehose's job ends at writing correctly
  partitioned Parquet to S3; making new partitions visible to a query
  engine's metastore still requires a catalog-sync step (a crawler run,
  a manual `ADD PARTITION`, or, as in LAB-03, switching the query-side
  table to partition projection to avoid this step entirely).
- C. Athena requires a minimum of 24 hours after data lands before it
  becomes queryable, regardless of catalog state.
- D. Firehose automatically updates the Glue Catalog for every
  delivered record, but Step 6's crawler is only needed for the error
  records to also become queryable.

> **Answer: B.** This connects directly back to LAB-01's Common Error
> #5/Q5 (new S3 objects don't auto-register in the Catalog) and
> LAB-03's partition projection as the alternative fix. Firehose's
> scope is ingestion and delivery, not catalog maintenance. A is false
> — Firehose's format-conversion output is standard Parquet, fully
> Athena-compatible. C is false — there's no such fixed delay; the
> real requirement is catalog/partition registration, which can happen
> immediately once run. D is false — Firehose does not automatically
> update the Glue Catalog with new partitions on its own; that's
> precisely the gap this step fills.
