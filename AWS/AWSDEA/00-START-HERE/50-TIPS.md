# 50-TIPS.md — audited and re-weighted for 2026

Your original list, with corrections marked. Tips are regrouped by
**leverage**, not by topic — do the Tier 1 items even if you do nothing
else.

---

## TIER 1 — Highest leverage (do these first)

1. **Learn *why* a service is chosen, not what it does.** ✅ Your #1 was
   already the best tip on the list. This exam tests selection, not trivia.
2. **Underline the constraint sentence in every question** before reading
   options. (Your #43, promoted.)
3. **Memorize the streaming matrix**: Kinesis Data Streams vs Amazon Data
   Firehose vs MSK vs Managed Flink. Highest-frequency comparison on the exam.
4. **Learn "near real-time" = Firehose, "real-time" = Data Streams.**
5. **Know zero-ETL integrations** (Aurora/RDS/DynamoDB → Redshift,
   DynamoDB → OpenSearch). ⚠️ *Missing from your original list.*
6. **Know AWS DMS full-load vs CDC.** ⚠️ *Missing from your original list —
   this is a guaranteed-questions gap.*
7. **Prefer Parquet + Snappy + partitioning** over CSV/JSON. (Your #12–13,
   merged and correct.)
8. **Know Apache Iceberg** for upserts, deletes, time travel, schema
   evolution. ⚠️ *Absent from your original 50.*
9. **Athena partition projection** vs crawlers. ⚠️ *Absent — and a
   favourite trap.*
10. **Lake Formation for column/row/cell-level security**; IAM cannot do it.
    (Your #8 and #33, sharpened.)

---

## TIER 2 — Core services (your list was right, just vague)

11. Master S3: storage classes, lifecycle, versioning, replication,
    Object Lock, Express One Zone. *(Your #2, #23–25 combined.)*
12. Know Glue end to end: ETL jobs, Streaming jobs, crawlers, **job
    bookmarks**, worker types, Studio, DataBrew. *(#3, #7, #32.)*
13. Understand Athena's limits: concurrency quotas, $/TB scanned,
    workgroup cost guardrails, CTAS/UNLOAD, federated query. *(#4.)*
14. Athena vs Redshift vs Redshift Spectrum — all three, not just two. *(#5, #16.)*
15. Redshift: RA3 + managed storage, **Serverless**, distribution styles,
    sort keys, WLM/auto-WLM, concurrency scaling, materialized views,
    data sharing. *(#14–15, expanded — Serverless was missing.)*
16. EMR: node types, **Spot on task nodes only**, EMR Serverless, EMR on
    EKS. *(#17.)*
17. Lambda's hard limits: 15 min, 10 GB memory, 10 GB `/tmp`. *(#18 — correct.)*
18. Step Functions Standard vs Express; MWAA only when Airflow already
    exists. *(#19–20.)*
19. DynamoDB: key design, GSI vs LSI, **Streams**, TTL, capacity modes,
    PITR, S3 export. ⚠️ *Under-covered in your list.*
20. OpenSearch for log/search analytics; QuickSight SPICE + row-level
    security. ⚠️ *Absent.*
21. **Glue Data Quality (DQDL)** and DataBrew profiling. *(#35, made concrete.)*
22. **EventBridge** rules, Scheduler, and Pipes; SQS vs SNS. *(#30, made concrete.)*
23. Kinesis shard math and resharding; on-demand mode. *(#28.)*
24. Glue Data Catalog as the shared metadata layer for Athena, Redshift
    Spectrum, EMR, and Lake Formation. *(#32.)*

---

## TIER 3 — Security, governance, operations

25. IAM policy evaluation order — explicit deny wins. *(#9.)*
26. IAM roles vs users; trust policies; cross-account assume-role. *(#39–40.)*
27. KMS key types: AWS-managed vs customer-managed vs imported; key
    policies vs grants; rotation. *(#10.)*
28. Encryption at rest (SSE-S3 / SSE-KMS / DSSE-KMS / SSE-C) and in
    transit. *(#38.)*
29. **Secrets Manager vs Parameter Store** — rotation is the differentiator.
    ⚠️ *Absent from your list.*
30. **Amazon Macie** for PII discovery. ⚠️ *Absent — and commonly tested.*
31. VPC endpoints: gateway (S3/DynamoDB, free) vs interface (PrivateLink,
    paid). *(#41.)*
32. CloudWatch: know **the one key metric per service** (Kinesis
    `IteratorAge`, Lambda throttles, Glue DPU usage, Redshift queue wait). *(#21.)*
33. CloudTrail management vs **data** events for S3 auditing. *(#22.)*
34. Troubleshooting playbooks: Glue OOM/skew, hot shards, Redshift queue
    backup, S3 403 (check the **KMS key policy**). *(#27.)*
35. Idempotency, at-least-once vs exactly-once, retries with backoff,
    DLQs. *(#36–37 — good tips, keep them.)*
36. Schema evolution and the Glue Schema Registry. *(#31.)*
37. Cost optimization: compression, partitioning, **file sizes**
    (small-file problem), storage classes, Spot, workgroup limits. *(#26.)*
38. S3 Intelligent-Tiering when the access pattern is **unknown**;
    lifecycle policy when it's known.
39. Well-Architected pillars as a tiebreaker lens. *(#42.)*
40. Data modeling: star vs snowflake, SCD types, denormalization for
    analytics. ⚠️ *Absent from your list; Domain 2 tests it.*

---

## TIER 4 — Exam technique (your #43–50 were solid)

41. Read the **last sentence first** — it holds the actual ask.
42. Eliminate two options before evaluating the final two. *(#44.)*
43. Flag and move on; don't fight a hard question in pass 1. *(#45.)*
44. ~2 minutes per question — **your #46 was correct** (65 questions /
    130 minutes). ✅
45. **Always guess.** No penalty for wrong answers. *(#47 — correct.)*
46. Multiple-response: wrong *count* = wrong answer, no partial credit.
    ⚠️ *Absent from your list.*
47. Scoring is **compensatory** — you don't need to pass each domain. ⚠️ *Absent.*
48. Study to the domain weights: **34 / 26 / 22 / 18**. ⚠️ *Absent — and
    it's the single biggest planning error people make.*
49. Practice questions from Day 2 onward, not just at the end. *(#48, sharpened.)*
50. Last 24 hours: matrices, mnemonics, and your own mistake list only —
    no new topics. *(#50 — correct and important.)*

---

## Removed from your original list

- **"Practice SQL on Athena" (#34)** — SQL syntax is barely tested.
  Knowing *when* to use Athena matters far more than writing the query.
  Keep window functions and CTEs at recognition level only.
- **"Practice IAM policy evaluation" (#9)** was over-weighted at Tier 1
  in your list — it's real, but it's a small slice of an 18% domain.
  Don't spend a day on it.
