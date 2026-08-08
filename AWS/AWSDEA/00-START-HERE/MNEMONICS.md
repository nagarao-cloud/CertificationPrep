# MNEMONICS.md

---

## Service one-liners

| Service | Hook |
|---|---|
| **S3** | **S**tore, **S**cale, **S**imple — the gravity well everything falls into |
| **Glue** | Glue **sticks** your data together — and the Catalog is the label on the jar |
| **Athena** | **A**sk SQL directly on S3. Goddess of wisdom, asks questions, owns nothing |
| **Redshift** | **Red = fast**. A warehouse with the lights always on (you pay for them) |
| **Spectrum** | Redshift's **telescope** — looks *out* at S3 without moving the data |
| **Kinesis** | **Kinetic** = motion. Data in motion, shard by shard |
| **Firehose** | A firehose only points **one way** — no replay, no going back |
| **MSK** | **M**anaged **S**treaming for **K**afka — you already speak Kafka |
| **DMS** | **D**atabase **M**oving **S**ervice — full load then CDC keeps chasing |
| **Lake Formation** | **Lake** security. The lifeguard who decides which columns you may swim in |
| **Macie** | **M**achine finds **A**ll **C**onfidential **I**nformation **E**verywhere |
| **Iceberg** | Most of it is **under the surface** — snapshots, history, time travel |
| **Step Functions** | **Steps** in a flowchart, drawn by AWS, retried by AWS |
| **MWAA** | **M**anaged **W**orkflows **A**lready **A**irflow — bring your DAGs |
| **DataBrew** | **Brew** without cooking — no code, analysts only |
| **EMR** | **E**lastic **M**apReduce — the cluster you actually control (and pay Spot for) |

---

## The pipeline spine: **"SITS PG"**

**S**ource → **I**ngest → **T**ransform → **S**tore → **P**resent → **G**overn

Every architecture question maps onto these six. Find the stage first,
and 2 of the 4 options usually disappear.

---

## Ingestion picker: **"F-R-E-D"**

- **F**irehose → **F**ire-and-forget, least ops, ~60 s
- **R**eplay needed → Kinesis Data **S**treams (think *R*ewind)
- **E**xisting Kafka → MSK
- **D**atabase source → DMS (or zero-ETL if Aurora/DynamoDB → Redshift)

---

## Redshift distribution styles: **"KEA"** (like the parrot)

- **K**EY → big fact tables joined on a high-cardinality key
- **E**VEN → no obvious join key
- **A**LL → small dimension tables (copied to **A**ll nodes)

*(and AUTO when the question says "least operational overhead")*

---

## File format choice: **"PACJ"** — "Pack J"

- **P**arquet → analytics default ✅
- **A**vro → schema evolution, streaming writes
- **C**SV → landing only
- **J**SON → landing only

**Columnar for Consumption, Row for Receiving.**

---

## Compression: **"Snappy is Speedy, GZIP is Greedy"**

Snappy = fast, splittable inside Parquet → default.
GZIP = smaller files, but **not splittable standalone** → kills parallelism.

---

## S3 storage classes ladder: **"Sit In Glacier Deep"**

**S**tandard → **I**ntelligent-Tiering → **I**A / One Zone-IA →
**G**lacier Instant → Glacier Flexible → **D**eep Archive

Hot to cold, cheap-to-store gets expensive-to-retrieve.

---

## IAM policy evaluation: **"Deny Beats Everything"**

1. Explicit **DENY** anywhere → denied. Full stop.
2. **S**CP must allow
3. **R**esource policy
4. **P**ermission boundary
5. **I**dentity policy
6. Default = **implicit deny**

*"**D**eny **S**tops **R**eally **P**owerful **I**dentities."*

---

## Troubleshooting S3 403: **"I Been Kicked Loose, Seriously"**

**I**AM policy → **B**ucket policy → **K**MS key policy →
**L**ake Formation → **S**CP

The KMS one is the most commonly forgotten. Check it third, always.

---

## Well-Architected pillars: **"SCROPS"**

**S**ecurity, **C**ost optimization, **R**eliability,
**O**perational excellence, **P**erformance efficiency,
**S**ustainability

---

## Domain weights: **"34-26-22-18"**

Say it as a phone number. Ingestion gets a **third** of the exam —
study it like it does.

---

## The exam-day mantra

> **"Read the constraint before the options."**

Every DEA-C01 question has a constraint sentence — *least operational
overhead*, *lowest cost*, *near real-time*, *existing Kafka*. Find it,
underline it, and let it kill two options before you evaluate anything.
