# S3 vs EFS vs FSx (Lustre / Windows File Server / NetApp ONTAP)

> On DEA-C01, **S3 is correct roughly 95% of the time** this comparison
> appears. This file exists for the other 5% — the specific, narrow
> signals that correctly pull the answer toward EFS or FSx instead, so
> you don't either (a) reflexively pick S3 when it's genuinely wrong or
> (b) get talked into EFS/FSx by a distractor when S3 was fine all along.

---

## 1. ELI12

**S3** is a warehouse with a robot that fetches any box you ask for by
its label, over the phone (an HTTPS API call). You never walk into the
warehouse yourself; you just describe what you want and the robot
brings it. Incredibly cheap, practically infinite, and works from
anywhere — but you can't "open a box a little and edit one page inside
it while someone else has it open too." Every request is a full
fetch-or-store of an object.

**EFS** is a shared office filing cabinet that multiple people in
different rooms can walk up to *at the same time*, open the same
drawer, and edit the same physical file together, exactly like a shared
network drive. That's POSIX file semantics — normal open/read/write/
close operations, byte-range locking, multiple simultaneous writers.

**FSx for Lustre** is a specialized, blazing-fast local workbench
built for one job: feeding data to compute at extreme speed (hundreds
of GB/s) for high-performance computing or ML training — and it can
link directly to an S3 bucket, lazily pulling files onto the fast
workbench only when a compute job actually touches them.

**FSx for Windows File Server / FSx for NetApp ONTAP** are the
enterprise-IT equivalent of a corporate shared drive with Windows-style
permissions (Active Directory, SMB) or NetApp's specific enterprise
features — for when the requirement is literally "this needs to look
and behave like a Windows file share" or "our existing NetApp workflows
need to keep working."

**The exam's real question:** does something need to **open, lock, and
write into the middle of a file that multiple processes touch
concurrently (POSIX)**, or does it just need to **fetch and store whole
objects (S3)?** Only cross into EFS/FSx territory when the scenario
explicitly demands POSIX/SMB semantics or Lustre-grade throughput.

---

## 2. Comparison matrix

| Attribute | **Amazon S3** | **Amazon EFS** | **FSx for Lustre** | **FSx for Windows File Server** | **FSx for NetApp ONTAP** |
|---|---|---|---|---|---|
| **Type** | Object storage | POSIX-compliant NFS file system (Linux) | Parallel file system (HPC/ML) | SMB file system (Windows) | Multi-protocol enterprise file system |
| **Access method** | HTTPS API (GET/PUT) | POSIX mount (NFS) | POSIX mount | SMB share | NFS/SMB/iSCSI |
| **Latency** | ~100ms typical first byte | Low milliseconds | **Sub-millisecond** | Low milliseconds | Low milliseconds |
| **Throughput** | Very high in aggregate (parallelized across many requests/prefixes) | Scales with file system size/throughput mode | **Hundreds of GB/s** — purpose-built for this | High | High |
| **Concurrent writers to the same file** | ❌ Not a native concept — objects are replaced whole | ✅ **Yes, native POSIX locking** | ✅ Yes | ✅ Yes (SMB locking) | ✅ Yes |
| **Multi-AZ** | ✅ (except One Zone-IA/Express One Zone) | ✅ | ⚠️ **Scratch = single-AZ**; Persistent deployment option = Multi-AZ | ✅ (Multi-AZ deployment option) | ✅ |
| **S3 integration** | Native (it IS S3) | ❌ None built-in | ✅ **Links directly to an S3 bucket, lazy-loads data on first access, can write results back** | ❌ | ⚠️ Limited |
| **Cost** | **Cheapest per GB by a wide margin** | ~3–8x S3 per GB | High — priced for extreme performance | High | High |
| **Best use case** | Data lake, archive, ETL landing/curated zones, anything an analytics engine reads | Shared POSIX storage across EC2/containers/Lambda — config, shared app state, small-scale shared writable storage | ML training data feeds, genomics, HPC simulations, render farms — throughput-critical compute | Lift-and-shift Windows applications needing Active Directory-integrated SMB shares | Enterprise workloads already standardized on NetApp ONTAP features (snapshots, cloning, multi-protocol) |
| **When NOT to use** | Something needs to lock/edit a file mid-write from multiple processes | Extreme throughput HPC workloads (use Lustre); cheap bulk data lake storage (use S3) | Workloads that aren't latency/throughput-critical — the cost isn't justified | Non-Windows/non-SMB workloads | When plain EFS or S3 already satisfies the need — ONTAP is for specific enterprise feature parity |
| **Exam favorite** | "durable, any format, cheapest," "data lake," "analytics engines read from here" | **"shared POSIX filesystem across instances/containers," "Lambda needs shared writable storage"** | **"HPC," "ML training," "genomics," "needs S3 data at sub-millisecond speed"** | **"Active Directory," "Windows file share," "SMB"** | "existing NetApp workflows," "enterprise file features" |

---

## 3. Decision tree

```
┌────────────────────────────────────────────────────────────────┐
│ START: Does the workload need POSIX file semantics — open a     │
│ file, lock a byte range, write into the middle, multiple        │
│ processes touching the SAME file concurrently?                  │
└───────────────────────────────┬───────────────────────────────┘
                                 │
                ┌─────────────────┴─────────────────┐
               NO                                    YES
                │                                     │
          ┌─────▼─────┐                Does it need SMB / Windows /
          │    S3     │                Active Directory integration
          │ (default  │                specifically?
          │  answer   │                             │
          │  ~95% of  │              ┌────────────────┴────────────────┐
          │  the time)│             YES                                NO
          └───────────┘              │                                  │
                              ┌───────▼────────┐         Is EXTREME throughput
                              │  FSx for        │         (hundreds of GB/s) for
                              │  Windows File   │         HPC/ML training the
                              │  Server         │         driver, especially with
                              │  (or FSx for    │         data that also lives in S3?
                              │  NetApp ONTAP   │                      │
                              │  if existing     │         ┌─────────────┴─────────────┐
                              │  NetApp features │        YES                          NO
                              │  are needed)     │         │                             │
                              └──────────────────┘   ┌──────▼──────┐          ┌───────────▼───────────┐
                                                      │ FSx for     │          │         EFS            │
                                                      │ LUSTRE      │          │ (general shared POSIX  │
                                                      │(HPC/ML,     │          │  storage across EC2/   │
                                                      │ S3-linked,  │          │  containers/Lambda)    │
                                                      │ sub-ms)     │          └───────────────────────────┘
                                                      └──────────────┘
```

---

## 4. Worked scenarios

**Scenario A — A data lake ingests clickstream, log, and transactional
data in various formats, queried by Athena, Redshift Spectrum, and
Glue jobs.** *Winner: S3.* This is the default data-engineering pattern
— no process needs to lock or co-edit files, everything is
read-whole/write-whole by analytics engines. S3's cost and scale make
it the obvious and correct choice; there's no POSIX signal anywhere in
the scenario.

**Scenario B — A fleet of Lambda functions needs a shared, writable
directory where multiple concurrent invocations read and update a
common configuration/state file using normal file I/O calls.**
*Winner: EFS.* Lambda's `/tmp` is ephemeral and per-invocation; a
genuinely shared, persistent, concurrently-writable POSIX file system
across many Lambda invocations is exactly what EFS (mountable directly
into Lambda) is built for — S3 has no concept of concurrent in-place
file edits.

**Scenario C — An ML team trains large models against a multi-terabyte
dataset already stored in S3, and the training job needs to read
training batches at extremely high throughput (hundreds of GB/s) with
minimal latency, without permanently duplicating the entire dataset
onto expensive fast storage ahead of time.** *Winner: FSx for Lustre,
linked to the S3 bucket.* Lustre's S3 linking lazily pulls only the
objects the training job actually touches onto sub-millisecond-latency
storage, avoiding a wasteful full upfront copy while still delivering
the throughput plain S3 GET requests can't match at this scale.

**Scenario D — A company is lifting-and-shifting a legacy Windows
application that depends on an SMB file share and Active Directory-
based folder permissions.** *Winner: FSx for Windows File Server.*
The requirement is explicitly SMB + Active Directory — S3 and EFS
(NFS/Linux-oriented) don't natively provide this; FSx for Windows File
Server is purpose-built for exactly this lift-and-shift pattern.

---

## 5. Exam traps

| Trap | The correction |
|---|---|
| **Picking EFS just because "shared storage" appears** | "Shared" alone isn't the signal — S3 is also inherently shared/accessible from anywhere. The signal is **POSIX semantics: locking, concurrent in-place writes, normal file I/O calls (open/read/write/close)**. |
| **Assuming S3 can't be "high performance"** | S3 delivers very high *aggregate* throughput when requests are parallelized across many keys/prefixes. The FSx-for-Lustre signal is specifically about **sub-millisecond latency and hundreds of GB/s for a single compute-intensive job**, not "S3 is slow." |
| **Forgetting FSx for Lustre's S3 linking** | A common wrong answer duplicates the entire S3 dataset into Lustre manually. The purpose-built feature is **linking Lustre directly to the S3 bucket**, lazy-loading only what's accessed and optionally writing results back to S3. |
| **Choosing EFS for HPC/ML training throughput needs** | EFS provides POSIX semantics but not Lustre's extreme parallel throughput. If the scenario emphasizes raw throughput for compute-bound training/HPC, that's a Lustre signal, not an EFS one. |
| **Picking FSx for Windows when there's no Windows/SMB/AD signal** | FSx for Windows File Server should only be chosen when the scenario explicitly mentions Windows applications, SMB, or Active Directory integration — not just "file share" in the abstract. |
| **Treating FSx for Lustre's Scratch deployment as durable/Multi-AZ** | Scratch file systems are **single-AZ and not designed for long-term durability** — they're for transient, high-performance compute scratch space. Persistent deployment type is the Multi-AZ, durable option. |
| **Assuming EFS is cheap like S3** | EFS runs roughly 3–8x S3's per-GB cost. A "cheapest storage for a data lake" question should never land on EFS or FSx — those cost premiums exist because of the POSIX/performance capabilities, not despite them. |
| **Missing FSx for NetApp ONTAP as a distinct, valid option** | When a scenario specifically mentions existing NetApp ONTAP workflows, snapshots, or cloning features being migrated to AWS, that's the signal for ONTAP specifically — not generic EFS or FSx for Windows. |

---

## 6. Real-company examples

**S3 side — virtually every AWS-native data lake.** A streaming
media company lands petabytes of viewing-event data in S3 as
partitioned Parquet, queried directly by Athena and Redshift Spectrum
with no file-locking or POSIX requirement anywhere in the pipeline —
the standard, overwhelming-majority pattern for AWS data engineering.

**FSx for Lustre side — an autonomous vehicle company's ML training
pipeline.** Petabytes of sensor/video training data live durably and
cheaply in S3, but training jobs mount an FSx for Lustre file system
linked to that S3 bucket to get the sub-millisecond, hundreds-of-GB/s
throughput GPU training clusters need, without permanently paying
Lustre-tier storage costs for the entire dataset.

**EFS side — a content management platform's shared upload
processing.** Multiple EC2 instances and Lambda functions in an
image-processing pipeline mount the same EFS file system to
concurrently read and write intermediate working files during
multi-step processing, something S3's object-replace model can't do
mid-write.

---

## 7. Practice questions (12)

**Q1.** A data lake stores clickstream data in S3, queried by Athena
and Glue, with no need for concurrent in-place file editing. What
storage should be used?

- A. EFS — ✗ Adds unnecessary cost and complexity; no POSIX requirement exists in this scenario.
- B. FSx for Lustre — ✗ Overkill; no HPC/ML throughput requirement stated.
- C. **S3 — ✓** The default, correct, cheapest choice for a data-lake pattern with no POSIX need.
- D. FSx for Windows File Server — ✗ No Windows/SMB requirement present.

**Q2.** Multiple Lambda function invocations need to concurrently read
and update a shared, persistent configuration file using standard file
I/O (open/write/close), not object PUT/GET. What should be used?

- A. S3 with versioning — ✗ Versioning creates new object versions, not in-place concurrent file edits; doesn't provide POSIX semantics.
- B. **Amazon EFS, mounted directly into the Lambda functions — ✓** Purpose-built for shared, persistent, concurrently-writable POSIX storage accessible from Lambda.
- C. Lambda's /tmp directory shared across invocations — ✗ /tmp is ephemeral and local to each execution environment, not genuinely shared/persistent.
- D. FSx for Lustre — ✗ Built for HPC/ML throughput, not general-purpose shared Lambda config storage; unnecessary cost and complexity here.

**Q3.** An ML training job needs sub-millisecond latency and hundreds
of GB/s throughput reading a multi-terabyte dataset that already lives
durably in S3, without permanently duplicating the full dataset onto
expensive storage. Best fit?

- A. EFS — ✗ Provides POSIX semantics but not Lustre-grade extreme parallel throughput for HPC/ML training.
- B. **FSx for Lustre, linked to the S3 bucket — ✓** Lazy-loads only accessed objects at sub-millisecond latency and hundreds of GB/s, without a full upfront copy.
- C. S3 Transfer Acceleration — ✗ Speeds up transfer into/out of S3 over long distances; doesn't provide local sub-millisecond compute-attached latency.
- D. S3 Express One Zone — ✗ Improves S3 latency to single-digit milliseconds, still short of Lustre's sub-millisecond, hundreds-of-GB/s throughput for compute-attached training.

**Q4.** A legacy Windows application requires an SMB file share
integrated with the company's Active Directory. Which service satisfies
this directly?

- A. Amazon EFS — ✗ NFS-based, Linux-oriented; no native SMB/Active Directory integration.
- B. **FSx for Windows File Server — ✓** Purpose-built for SMB shares with native Active Directory integration.
- C. S3 with IAM policies — ✗ Object storage with HTTPS API access; not an SMB file share.
- D. FSx for Lustre — ✗ Built for HPC/ML throughput, not Windows/SMB file sharing.

**Q5.** Why is FSx for Lustre's Scratch deployment type unsuitable for
data that must survive an Availability Zone failure?

- A. Scratch deployments don't support S3 linking — ✗ False; S3 linking is available regardless of deployment type.
- B. **Scratch file systems are single-AZ and not designed for long-term durability — ✓** The Persistent deployment type is needed for Multi-AZ durability.
- C. Scratch deployments have a hard 24-hour data retention limit — ✗ Not the correct limitation; the issue is AZ-level durability, not a time-based retention cap.
- D. Scratch deployments can't be mounted by more than one compute instance — ✗ False; multiple instances can mount a Scratch file system.

**Q6.** What is the approximate cost relationship between EFS and S3
for storing the same volume of data?

- A. EFS is cheaper than S3 per GB — ✗ Backwards; EFS costs more.
- B. **EFS costs roughly 3–8x more per GB than S3 — ✓** Correct order-of-magnitude relationship tested on the exam.
- C. EFS and S3 cost approximately the same per GB — ✗ Not accurate; EFS carries a significant premium.
- D. EFS costs roughly 50x more than S3 — ✗ Overstated; the real multiplier is in the single-digit range.

**Q7.** A company uses existing NetApp ONTAP-based workflows
(snapshots, cloning, multi-protocol access) on-premises and wants to
migrate them to AWS with minimal feature loss. Best fit?

- A. Amazon EFS — ✗ Doesn't provide NetApp-specific features like ONTAP snapshots/cloning.
- B. FSx for Windows File Server — ✗ SMB/AD-focused; doesn't replicate NetApp ONTAP-specific enterprise features.
- C. **FSx for NetApp ONTAP — ✓** Purpose-built to preserve NetApp-specific enterprise file features during migration.
- D. S3 with Storage Gateway — ✗ Provides file-gateway access to S3 but doesn't replicate ONTAP's native feature set.

**Q8.** Which statement correctly describes why S3 is not suited for a
workload needing concurrent in-place file edits from multiple
processes?

- A. S3 doesn't support files larger than 5GB — ✗ Irrelevant to this scenario, and also not quite accurate (5GB is a single PUT limit, not an overall object size limit which is much higher via multipart upload).
- B. **S3 objects are replaced as whole units on write; there's no native mechanism for byte-range locking or partial in-place edits the way POSIX file systems provide — ✓** Correct architectural reason.
- C. S3 requires all writes to go through a separate approval workflow — ✗ Not how S3 works; there is no such requirement.
- D. S3 is only accessible from within a single Availability Zone — ✗ False; S3 (aside from One Zone-IA/Express One Zone) is inherently Multi-AZ.

**Q9.** A genomics research team needs extremely high throughput
access to reference datasets stored in S3 for a batch of parallel HPC
jobs, and wants results written back to S3 automatically after
processing. What FSx for Lustre feature enables this?

- A. Lustre's built-in replication to Glacier — ✗ No such automatic archival-on-write feature exists in this context.
- B. **Lustre's direct S3 linking, which lazy-loads data from S3 and can export processed results back to the linked S3 bucket — ✓** Correct feature satisfying both read and write-back requirements.
- C. Cross-region replication configured on the Lustre file system — ✗ Not the relevant mechanism; the requirement is about S3 integration, not cross-region replication.
- D. FSx for Lustre requires manual data transfer via DataSync before and after every job — ✗ Unnecessary; native S3 linking handles this automatically.

**Q10.** Which of these scenarios correctly justifies choosing EFS over
plain S3?

- A. A data lake queried exclusively by Athena and Redshift Spectrum — ✗ No POSIX need; S3 is correct here.
- B. **A containerized application running across multiple ECS tasks that all need to read and write to the same shared directory concurrently using standard file system calls — ✓** A genuine POSIX/shared-writable-filesystem need that S3 doesn't provide.
- C. An archive of compliance documents accessed a few times a year — ✗ Classic S3 (with lifecycle to Glacier) use case; no POSIX need.
- D. A static website's image assets served to end users — ✗ Standard S3 static content hosting use case; no POSIX need.

**Q11.** True or false: FSx for Lustre is generally the most
cost-effective choice for a data lake with no HPC/ML throughput
requirements.

- A. True — ✗ Incorrect; Lustre is priced for extreme performance and is not cost-optimal for general data-lake storage.
- B. **False — ✓** S3 remains the cheapest and correct default for general data-lake storage absent an HPC/ML throughput requirement.
- C. True, but only for datasets under 1TB — ✗ Size doesn't change the fundamental cost/performance tradeoff; S3 remains cheaper regardless of dataset size for this use case.
- D. True, if S3 linking is enabled — ✗ S3 linking reduces duplication but doesn't make Lustre's per-GB storage cost cheaper than plain S3 for non-throughput-critical workloads.

**Q12.** What is the single strongest signal in an exam question that
should make a candidate consider EFS or FSx instead of the S3 default?

- A. The word "shared" appearing anywhere in the stem — ✗ Too broad; S3 is also inherently shared/accessible from anywhere.
- B. **An explicit requirement for POSIX file semantics (concurrent locking, in-place writes via open/write/close) or SMB/Windows/Active Directory integration or HPC-grade throughput — ✓** The precise, narrow signal that should pull the answer away from S3.
- C. The data volume exceeding 1TB — ✗ Not a relevant signal; S3 scales far beyond this without issue.
- D. The data being accessed by more than one AWS service — ✗ Common but not disqualifying for S3; many services read/write the same S3 objects without any POSIX requirement.
