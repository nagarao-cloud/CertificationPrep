# AWS KMS

> Service file. Domain coverage: the core encryption-at-rest engine
> for **Domain 4, Task 4.3** (data encryption and masking), with
> constant cross-references in Domain 1 (encrypted ingestion targets)
> and Domain 2 (encrypted storage).
>
> One-line identity: **the key-management service every other AWS
> encryption feature (SSE-KMS, DSSE-KMS, EBS/RDS/Redshift encryption)
> is actually built on top of** — KMS itself never touches your raw
> data, it manages and protects the *keys* that do.

## CONTENTS

1. [8-step teaching pass](#steps)
2. [Per-service coverage checklist](#checklist)
3. [Key types — AWS-managed vs customer-managed vs SSE-C](#key-types)
4. [Three ways to control KMS access](#access-control)
5. [Automatic vs manual rotation](#rotation)
6. [Envelope encryption mechanics](#envelope)
7. [Cross-account key sharing](#cross-account)
8. [Multi-Region keys](#multi-region)
9. [Pricing](#pricing)
10. [Decision tree](#tree)
11. [Production architecture](#prod)
12. [Exam traps](#traps)
13. [Interview questions](#interview)
14. [Cheat sheet](#cheat)
15. [Mnemonics](#mnemonics)
16. [15 practice questions](#questions)

---

<a name="steps"></a>
## 1. 8-step teaching pass

### Step 1 — Explain like I'm 12

Imagine every important document in your house gets locked in its own
tiny safe before it's stored. KMS is the **master locksmith service**
that makes those safes' keys, keeps a master key locked in its own
giant vault that never leaves, and hands out a **fresh little key for
every single document** — so if a burglar somehow steals one
document's little key, they still can't open any of the others. The
locksmith also writes down, in a notebook nobody can erase, every
single time anyone asks to unlock something — so you can always prove
later exactly who opened what and when.

### Step 2 — Explain technically

AWS Key Management Service (KMS) is a managed service for creating and
controlling **cryptographic keys** (CMKs — "customer master keys," now
generally called "KMS keys") used to encrypt data across AWS. KMS
almost never encrypts your actual data directly with the KMS key
itself — instead it implements **envelope encryption**: each object
gets encrypted with a unique, locally-generated **data key**, and only
that (small) data key is encrypted by the KMS key and stored alongside
the ciphertext. This means the KMS key itself never has to leave KMS's
hardware security modules (HSMs), and decrypting one object's data key
provides no help decrypting any other object's data key. Every
`Encrypt`, `Decrypt`, and `GenerateDataKey` API call against a
customer-managed key is logged to **CloudTrail**, giving a
non-repudiable, per-call audit trail of key usage.

### Step 3 — Explain like a Senior AWS Data Engineer

A senior engineer's default instinct: the moment a scenario mentions
**compliance, audit trail, customer-controlled rotation, or
cross-account sharing of encrypted data**, the answer is **SSE-KMS
with a customer-managed key (CMK)** — full stop, this single pattern
covers the large majority of DEA-C01 encryption questions. The second
instinct is understanding that KMS access is a **dual-gate** system:
the caller's **IAM policy** must allow the KMS action, **and** the
key's own **key policy** must independently allow that principal — both
gates must open, and forgetting the key policy is the single most
common real-world cause of "IAM looks completely right but decrypt
still fails." The third instinct: **S3 Bucket Keys** are a pure cost
optimization, not a security feature — the moment KMS API costs become
the complaint in a scenario (not security), Bucket Keys are the lever,
reducing KMS request volume by generating one bucket-level data key
that's reused across many object operations instead of calling KMS
per object.

### Step 4 — Production architecture

See [section 11](#prod).

### Step 5 — Exam traps

See [section 12](#traps).

### Step 6 — Interview questions

See [section 13](#interview).

### Step 7 — Cheat sheet

See [section 14](#cheat).

### Step 8 — Memory tricks

See [section 15](#mnemonics).

---

<a name="checklist"></a>
## 2. Per-service coverage checklist — KMS

| Dimension | Detail |
|---|---|
| **Purpose** | Managed creation, storage, rotation, and access control of cryptographic keys used to encrypt data at rest across AWS services |
| **When to use** | Any encryption-at-rest requirement, especially where audit trail, customer-controlled rotation, or cross-account sharing of encrypted data is needed |
| **When NOT to use** | Encrypting data client-side before it ever reaches AWS with a zero-trust-in-provider requirement (client-side encryption, no KMS involvement); regulatory mandates requiring key material to **never** touch AWS infrastructure at all, even encrypted (SSE-C or fully external key management) |
| **Advantages** | FIPS 140-2 validated HSMs, envelope encryption (KMS key never leaves the service), fine-grained key policies, automatic annual rotation option, deep native integration across nearly every AWS storage/compute service, full CloudTrail audit trail per API call |
| **Limitations** | 4 KB direct `Encrypt`/`Decrypt` payload size limit (this is exactly why envelope encryption with data keys exists — to encrypt data of any size); regional service (a key created in one Region isn't usable in another unless it's a Multi-Region key); request-rate quotas per key (raisable, but can throttle very high-volume workloads without Bucket Keys or caching) |
| **Pricing** | **Per-key monthly fee** (~$1/month for customer-managed keys; AWS-managed keys are free) **plus per-API-request cost** (billed per 10,000 requests, order of magnitude) — S3 Bucket Keys reduce the request-cost side by up to ~99% |
| **Performance** | `GenerateDataKey`/`Decrypt` calls are millisecond-latency; high-throughput workloads should cache data keys or use Bucket Keys to avoid per-object KMS round trips |
| **Scaling** | Automatic; request-rate quotas apply per key per Region and can be raised, but are a real design constraint for extremely high-throughput encryption workloads without caching |
| **Security** | Dual-gate access (IAM policy **and** key policy must both allow); grants for temporary, fine-grained delegated access; key policies support conditions (encryption context, VPC endpoint, etc.) |
| **High availability** | Regional managed service, HSMs are redundant within the Region; Multi-Region keys provide the cross-Region continuity story |
| **Failure scenarios** | Accidentally scheduling deletion of a CMK still protecting live data (7–30 day waiting period exists specifically as a safety net, but data becomes permanently unrecoverable if deletion completes and no other copy of the data key exists); cross-account access failing due to a missing key-policy grant even though the bucket policy and IAM look correct |
| **Common mistakes** | Choosing an AWS-managed key for a requirement needing cross-account sharing (impossible — AWS-managed keys cannot be shared); not enabling S3 Bucket Keys on a high-request-volume bucket and being surprised by KMS request costs; forgetting that disabling or scheduling deletion of a key makes all data encrypted under it permanently unreadable |
| **Exam traps** | "Reduce KMS request costs" → S3 Bucket Keys, not switching encryption method; "cross-account encrypted data sharing" → customer-managed key required, AWS-managed key is a guaranteed wrong answer; "audit who decrypted this data" → CMK + CloudTrail, SSE-S3 has no such trail |
| **Enterprise example** | A healthcare claims processor encrypts its S3 data lake with a customer-managed KMS key, rotates it automatically every year, and uses CloudTrail data events plus KMS API call logs to produce, during a HIPAA audit, a complete record of every decrypt operation against patient data for the past 12 months — something SSE-S3 could never have provided |

---

<a name="key-types"></a>
## 3. Key types — AWS-managed vs customer-managed vs SSE-C

| Type | Who controls the key policy | Rotation | Cross-account sharing | Cost | Use when |
|---|---|---|---|---|---|
| **AWS owned key** | AWS (fully invisible to you — not a visible key resource in your account at all) | AWS-managed | ❌ | Free | Default encryption used transparently by some services when no other key is specified; not a customer-facing key you can reference |
| **AWS managed key** (e.g., `aws/s3`, `aws/redshift`) | AWS | Automatic, annual, not configurable | ❌ **Cannot be shared, ever** | Free (pay per API request only) | Reasonable default with no compliance requirement, no cross-account need |
| **Customer managed key (CMK)** | **You** — full key policy control | ✅ Optional automatic annual rotation, or manual on-demand rotation | ✅ **Shareable via key policy** | ~$1/month + per-request | **Compliance, audit trail, cross-account sharing, custom rotation cadence** — the exam-favorite default answer |
| **Imported key material (BYOK)** | You (external key material, generated outside AWS) | **Manual only** — AWS cannot automatically rotate key material it didn't generate | ✅ | ~$1/month + per-request | Regulatory requirement that AWS never generates the key material itself |
| **Customer-supplied key (SSE-C)** | **You entirely — the key never touches AWS KMS or AWS storage at all** | You manage completely, outside AWS | N/A (you manage distribution yourself) | Free (no KMS charge — there's no KMS key involved) | Strictest regulatory requirement: the encryption key must never be stored by AWS **in any form**, even encrypted; you supply the raw key with every S3 request and AWS discards it immediately after use |

**The critical distinction most candidates get wrong: SSE-C is not a
KMS key type at all.** With **SSE-C** (Server-Side Encryption with
Customer-provided Keys), there is **no KMS key object anywhere** — you
provide the raw AES-256 key directly with each S3 `PutObject`/`GetObject`
request over HTTPS, S3 uses it once to encrypt/decrypt, and then
**discards it immediately** without ever persisting it. This is the
answer specifically when a requirement says the key material must
**never be stored by AWS in any form**, not even as ciphertext
protected by another key — a stricter requirement than even a
customer-managed KMS key satisfies (a CMK's key material, while never
directly exposed to you, is still generated and held by AWS's HSMs).

⚠️ **Cross-account encrypted data access requires a customer-managed
key.** AWS-managed keys and AWS-owned keys cannot be shared to another
account under any circumstances — if a question mentions sharing
encrypted S3 objects, Redshift snapshots, or EBS volumes across
accounts, any AWS-managed-key option is automatically disqualified.

---

<a name="access-control"></a>
## 4. Three ways to control KMS access

KMS access is controlled through **three distinct, layered mechanisms**
— understanding which one to reach for is a recurring exam
discriminator.

| Mechanism | What it controls | Granularity | Typical use |
|---|---|---|---|
| **Key policy** | The resource-based policy attached directly to the KMS key itself; **every** KMS key must have one, and it is the ultimate authority over who can ever use the key | Whole-key (all API actions, or scoped by action/condition within the policy) | Default access, cross-account sharing, delegating administration of the key to specific principals |
| **IAM policy** | Identity-based policy attached to a user/role, granting `kms:*` actions — but **only effective if the key policy also allows it** (the default key policy that ships with a new CMK includes a statement enabling IAM policies in the same account to grant access — this can be removed for stricter control) | Per-principal, can reference specific key ARNs | The standard mechanism for granting your own account's roles/users access, layered on top of the key policy |
| **Grants** | A **temporary, narrowly-scoped delegation** of specific KMS permissions to a specific principal, created programmatically via the `CreateGrant` API, revocable, and often auto-expiring or tied to the lifetime of a resource | Very fine-grained — specific operations, specific encryption context conditions | Services that need short-lived, dynamically-provisioned access (e.g., an EBS volume attachment briefly needing decrypt access), fine-grained temporary delegation without editing the key policy itself |

```
   KMS Key
      |
      +-- Key Policy   -----------> the ROOT authority; nothing works
      |                              without this allowing it, directly
      |                              or by delegating to IAM
      |
      +-- IAM Policy (if key policy -> grants specific principals
      |    delegates to IAM)           kms:Decrypt/Encrypt/etc.,
      |                                 scoped like any IAM policy
      |
      +-- Grants  -----------------> temporary, narrow, often
                                       service-created delegated access
                                       (e.g., "this EBS attachment may
                                        decrypt for as long as it's
                                        attached")
```

**Senior engineer take.** The key policy is the mechanism most
candidates forget exists as a *separate* gate from IAM — decrypting or
encrypting through KMS requires **both** the caller's IAM policy **and**
the key's own key policy to independently allow the action. This
dual-gate design is exactly why "cross-account access not working even
though IAM looks completely correct" is a realistic scenario: the key
policy on the key owner's side is the piece that's almost always
missing.

---

<a name="rotation"></a>
## 5. Automatic vs manual rotation

| | Automatic rotation | Manual rotation |
|---|---|---|
| Applies to | Customer-managed keys, AWS-managed keys (rotation is mandatory/automatic and not configurable for AWS-managed keys) | Customer-managed keys, or imported key material |
| Frequency | **Annual (every 365 days)**, not configurable to a shorter interval for the default automatic feature | On demand, whenever you choose to create a new key version |
| Mechanism | AWS generates new cryptographic material for the key; **old key material is retained internally** so previously encrypted data remains decryptable without any re-encryption of existing ciphertext | You create an entirely new KMS key (or new imported key material) and update key aliases/references — old data encrypted under the previous key must still be accessible via the old key (or explicitly re-encrypted) |
| Data re-encryption required? | ❌ **No** — rotation only changes what encrypts *new* data going forward; old ciphertext remains decryptable via retained internal key material | Depends on approach — a full "rotate to a brand-new key" strategy typically means re-encrypting existing data if you want it under the new key, or maintaining both old and new keys long-term |
| Imported key material | ❌ Automatic rotation **not supported** — AWS cannot automatically regenerate key material it didn't generate | ✅ Only option for imported (BYOK) keys |
| Exam trigger | "customer-controlled but hands-off annual rotation" | "the compliance policy mandates rotation on a custom cadence shorter/different than annual," or "imported key material" |

**Senior engineer take.** A subtlety worth internalizing: automatic
rotation is remarkably low-friction precisely *because* AWS retains
old key material internally — you never have to re-encrypt existing
data or worry about "which key version encrypted this object," KMS
handles that transparently. The moment a requirement demands rotation
**more frequently than annually**, or rotation of **imported key
material**, automatic rotation cannot satisfy it and manual rotation
(a deliberate process you build) is required.

---

<a name="envelope"></a>
## 6. Envelope encryption mechanics

```
   1. Application requests a data key:
        Application --GenerateDataKey--> KMS
                                            |
                                   KMS returns TWO things:
                                            |
                          +-----------------+------------------+
                          |                                     |
                 Plaintext data key                   Encrypted data key
                 (used ONCE, in memory,                (encrypted by the KMS
                  never persisted)                      key; safe to store
                          |                              alongside the data)
                          v
   2. Application encrypts the actual object with the
      PLAINTEXT data key (fast, local, no KMS round-trip
      per byte of data), then DISCARDS the plaintext key
      from memory immediately.

   3. Application stores:
        [ Ciphertext of the object ]  +  [ Encrypted data key ]
        together (e.g., as S3 object + metadata)

   4. To DECRYPT later:
        Application sends the ENCRYPTED data key back to KMS
        --Decrypt--> KMS uses the KMS key (never left KMS) to
                       decrypt it, returns the PLAINTEXT data key
                       --> Application decrypts the object locally
                           with that plaintext data key, then
                           discards it again.
```

**Why this design exists, explained.** KMS keys are deliberately
**never allowed to leave the KMS service's HSMs** — there is no API
that returns a KMS key's raw material to you. Direct `Encrypt`/`Decrypt`
calls against a KMS key are also capped at **4 KB** of data, which
makes calling KMS directly for every byte of a large object completely
impractical. Envelope encryption solves both problems: a **unique data
key** is generated per object (or per batch), used locally to encrypt
data of any size at native (non-network-bound) speed, and only that
**small, encrypted data key** — not the actual data — is ever sent to
or from KMS. If an attacker somehow obtains one object's encrypted
data key and ciphertext, decrypting it still requires calling KMS
(and passing the dual-gate IAM + key-policy check); compromising one
object's data key provides zero help against any other object, because
each has its own independent data key.

**Where this is visible on the exam:** `GenerateDataKey` is the API
call name to recognize — services like S3 (SSE-KMS), EBS, and RDS all
call it under the hood on every object/volume, which is exactly why
KMS **request volume** (not data volume) is the actual cost driver for
high-object-count workloads, and why **S3 Bucket Keys** (reusing one
bucket-level data key across many objects instead of calling
`GenerateDataKey` per object) is the specific, correct cost lever.

---

<a name="cross-account"></a>
## 7. Cross-account key sharing via key policy

```
   Account A (key owner)                       Account B (consumer)
   +---------------------+                     +----------------------+
   | KMS Customer-Managed  |                     | IAM Role "ConsumerRole" |
   | Key                    |                     |                        |
   | Key Policy statement:   |                     |                        |
   |  Principal:             |<---kms:Decrypt------|                        |
   |   arn:aws:iam::         |    kms:GenerateDataKey                       |
   |   333333333333:role/    |                     |                        |
   |   ConsumerRole           |                     |                        |
   |  Action: kms:Decrypt,    |                     |                        |
   |   kms:GenerateDataKey    |                     |                        |
   +---------------------+                     +----------------------+
```

**Two separate grants are required for a full cross-account,
encrypted-data workflow, and missing either one breaks access:**

1. The **KMS key policy** in Account A must explicitly allow the
   principal (a specific role/user ARN, or the entire account) from
   Account B to call the needed KMS actions (`kms:Decrypt`,
   `kms:GenerateDataKey`, etc.).
2. If the encrypted data lives in **S3**, the **S3 bucket policy** in
   Account A must **separately** allow Account B's principal to call
   `s3:GetObject` — the KMS grant alone does not grant S3 access, and
   the S3 grant alone does not grant KMS decrypt access. Both gates
   must be satisfied independently.

A question describing "Account B has full S3 permissions granted but
still gets AccessDenied reading an encrypted object" wants the missing
**KMS key policy grant** as the answer — this is one of the most
frequently tested KMS scenarios on the exam.

---

<a name="multi-region"></a>
## 8. Multi-Region keys

**Purpose.** A **Multi-Region key** is a set of KMS keys in different
AWS Regions that share the **same key material** and the **same key
ID**, created as a linked set (one primary, one or more replicas).
Data encrypted with the key in one Region can be **decrypted directly
in another Region** using that Region's replica key, **without any
re-encryption or network round-trip back to the original Region**.

```
   us-east-1 (Primary MRK)  <---shares key material--->  eu-west-1 (Replica MRK)
        |                                                        |
   Encrypt object                                        Decrypt the SAME
   with primary key                                       object locally,
                                                            using the replica —
                                                            NO re-encryption,
                                                            NO cross-Region call
```

**Use case: this is not a substitute for actual data replication.**
Multi-Region keys solve the **key-availability** half of a
cross-Region DR or global-application story — if you're already
replicating encrypted data (S3 Cross-Region Replication, DynamoDB
Global Tables, database snapshots copied cross-Region), a Multi-Region
key means the replicated ciphertext can be decrypted **locally** in the
destination Region instead of requiring a network call back to the
original Region's key — lower latency and no single-Region dependency
for decryption. They do **not** replicate the encrypted data itself;
that's still a separate replication mechanism.

⚠️ **Exam trap.** A **regular, single-Region** customer-managed key
used to encrypt data that is then replicated to another Region
(e.g., via S3 CRR) **cannot** decrypt that replicated copy locally —
the destination Region has no access to a key that only exists in the
source Region without an explicit Multi-Region key setup (or a
separate KMS key configured specifically in the destination Region and
referenced by the replication configuration).

---

<a name="pricing"></a>
## 9. Pricing

| Cost component | Detail |
|---|---|
| **Monthly key fee** | ~$1/month per customer-managed key (AWS-managed keys: free) |
| **API request cost** | Billed per 10,000 requests (order of magnitude, exact figures not tested), covering `Encrypt`, `Decrypt`, `GenerateDataKey`, etc. |
| **S3 Bucket Keys** | Not a KMS feature billed separately — it's an **S3-side optimization** that reduces the *number* of KMS API calls generated per object operation, cutting the request-cost component by up to ~99% for high-object-count buckets |
| **Multi-Region keys** | Each replica key incurs its own monthly key fee, as if it were a separate key, in each Region it exists |

**The exam-relevant cost lever, stated once:** if a scenario says "we
use SSE-KMS but our KMS request costs have become too high," the
answer is **S3 Bucket Keys**, not switching away from SSE-KMS
entirely and not switching to an AWS-managed key (which doesn't
reduce request count, only removes the $1/month key fee while giving
up cross-account sharing and audit granularity).

---

<a name="tree"></a>
## 10. Decision tree

```
              Does the data need to be shared,
              decrypted, or audited ACROSS accounts?
                              |
                    +---------+---------+
                  YES                  NO
                    |                    |
        CUSTOMER-MANAGED KEY    Is there a compliance/audit
        (only type that can        requirement (CloudTrail
         be shared via key         key-usage trail, custom
         policy)                   rotation cadence)?
                                          |
                                +---------+---------+
                              YES                  NO
                                |                    |
                    CUSTOMER-MANAGED KEY      AWS-managed key or
                                              SSE-S3 (if no audit
                                               need at all) is fine


              Must the key material NEVER be stored
              by AWS, even encrypted?
                              |
                            YES
                              |
                        SSE-C (customer-supplied,
                        no KMS key object at all)


              Do you need decrypt access LOCALLY in
              multiple Regions without re-encrypting
              or calling back to the original Region?
                              |
                            YES
                              |
                        MULTI-REGION KEY


              Is the complaint specifically "too many
              KMS API calls / KMS costs too high" on
              an S3 workload using SSE-KMS?
                              |
                            YES
                              |
                        ENABLE S3 BUCKET KEYS
                        (not a key-type change)
```

---

<a name="prod"></a>
## 11. Production architecture

```
   +-------------------------------------------------------------+
   |  Account A — Data Platform                                    |
   |                                                                 |
   |  +------------------+        +---------------------------+     |
   |  | Glue Job Role      |------->| Customer-Managed KMS Key    |    |
   |  | (IAM policy allows  |        | Key Policy:                  |   |
   |  |  kms:GenerateDataKey|        |  - Account A admins: full    |   |
   |  |  kms:Decrypt)        |       |    key management             |  |
   |  +------------------+        |  - Glue Job Role: Decrypt/     |    |
   |          |                    |    GenerateDataKey             |   |
   |          v                    |  - Account B ConsumerRole:     |   |
   |  +------------------+         |    Decrypt only                |   |
   |  | S3 Data Lake        |       +---------------------------+    |
   |  | (SSE-KMS, Bucket     |                                        |
   |  |  Keys ENABLED)        |------(bucket policy also grants      |
   |  +------------------+        Account B's ConsumerRole            |
   |                                s3:GetObject on shared/*)         |
   +-------------------------------------------------------------+
                                          |
                                          v
   +-------------------------------------------------------------+
   |  Account B — Analytics Team                                   |
   |                                                                 |
   |  +------------------+                                          |
   |  | ConsumerRole        |--- assumes into own account, reads     |
   |  | (Redshift Spectrum   |    shared/* via S3 GetObject +         |
   |  |  or Athena)           |    KMS Decrypt (both gates satisfied) |
   |  +------------------+                                          |
   +-------------------------------------------------------------+

   +-------------------------------------------------------------+
   |  CloudTrail  (every Encrypt/Decrypt/GenerateDataKey call        |
   |               against the CMK, from either account, logged      |
   |               with caller identity, timestamp, and result)      |
   +-------------------------------------------------------------+
```

**Reading the diagram.** The **Glue Job Role** in Account A has both
an **IAM policy** allowing `kms:Decrypt`/`kms:GenerateDataKey` and is
separately named in the **key policy** — the dual gate this file has
emphasized. The **S3 bucket** uses SSE-KMS with **Bucket Keys enabled**,
which means most object operations reuse a bucket-level data key
instead of triggering a fresh `GenerateDataKey` call per object,
controlling cost at scale. Crucially, the **same key policy** also
names **Account B's ConsumerRole** directly — this is what makes
**cross-account sharing** work without copying any data: Account B's
role assumes into its own account, and when it reads a shared object,
it independently satisfies **two gates**: the **S3 bucket policy**
(also updated to allow Account B's principal `s3:GetObject`) and the
**KMS key policy** (allowing that principal `kms:Decrypt`). Every
single decrypt call from either account — Glue in Account A, or the
analytics role in Account B — lands in **CloudTrail**, producing the
complete, per-call audit trail that satisfies the "who decrypted this
and when" compliance requirement no SSE-S3 setup could ever provide.

---

<a name="traps"></a>
## 12. Exam traps

- ⚠️ Picking an **AWS-managed key** for any scenario mentioning
  cross-account sharing — AWS-managed keys **cannot** be shared under
  any circumstances; only a **customer-managed key** has a key policy
  you can edit.
- ⚠️ Assuming the **IAM policy alone** grants KMS access — the **key
  policy** is a separate, independent gate that must also allow the
  principal; this is the most common real "why is decrypt failing"
  root cause.
- ⚠️ Confusing **SSE-C** with a KMS key type — SSE-C involves **no
  KMS key at all**; the raw key is supplied by the caller per-request
  and never persisted by AWS in any form.
- ⚠️ Believing rotation requires **re-encrypting existing data** —
  automatic rotation does not; AWS retains old key material internally
  so previously encrypted objects remain decryptable transparently.
- ⚠️ Assuming **imported key material (BYOK)** supports automatic
  rotation — it does not; only manual rotation is possible since AWS
  didn't generate the material.
- ⚠️ Treating **S3 Bucket Keys** as a security feature rather than a
  **cost optimization** — they reduce KMS API call volume/cost, they
  do not change the underlying encryption strength or key model.
- ⚠️ Assuming a **single-Region key** allows decrypting a
  cross-Region-replicated copy of the data in the destination Region —
  it does not; a **Multi-Region key** (or a separate destination-Region
  key configured in the replication setup) is required.
- ⚠️ Picking KMS/CMK when the actual requirement is that the key must
  **never be stored by AWS at all, even encrypted** — that specific
  phrasing is the **SSE-C** trigger, a stricter requirement than any
  KMS key type satisfies.

---

<a name="interview"></a>
## 13. Interview questions

- *"Explain envelope encryption and why KMS doesn't just encrypt your
  data directly with the KMS key."* — KMS keys never leave the
  service's HSMs, and direct KMS `Encrypt` is capped at 4 KB; envelope
  encryption generates a unique, locally-used **data key** per
  object, encrypted at native speed, with only the small encrypted
  data key ever sent to/from KMS — limiting blast radius per object
  and enabling encryption of data of any size.
- *"A cross-account decrypt request fails even though both the
  requester's IAM policy and the S3 bucket policy explicitly allow
  it. What's the most likely cause?"* — The KMS **key policy** on the
  key owner's account doesn't name the requesting principal — a third,
  independent gate that both IAM and the bucket policy don't satisfy
  on its own.
- *"Why would you choose SSE-C over a customer-managed KMS key, given
  that a CMK already gives you full control over the key policy?"* —
  Only when the regulatory requirement is that AWS must **never
  possess the key material in any form**, even encrypted by AWS's own
  systems — a CMK's key material is still generated and held (though
  never exposed) by AWS's HSMs, which some strict regimes explicitly
  disallow.
- *"How do Multi-Region keys change a disaster-recovery design that
  already replicates encrypted S3 data cross-Region?"* — Without a
  Multi-Region key, decrypting the replicated copy in the destination
  Region requires either the source Region's key (network dependency,
  latency, and a single-Region point of failure for decryption) or a
  full re-encryption step; a Multi-Region key lets the destination
  Region decrypt locally using its own replica of the same key
  material, removing that dependency.

---

<a name="cheat"></a>
## 14. Cheat sheet

```
KMS ONE-LINERS
  cross-account sharing of encrypted data ............. CUSTOMER-MANAGED KEY (CMK), only option
  audit trail of every decrypt/encrypt call ........... CMK + CloudTrail (SSE-S3 has none)
  custom rotation cadence, or rotate NOW ............... CMK, manual rotation
  hands-off annual rotation, no re-encryption needed ... CMK, automatic rotation (or AWS-managed key)
  key material must NEVER touch AWS, even encrypted ... SSE-C (no KMS key object at all)
  reduce KMS API request COSTS on S3 ................... S3 Bucket Keys (not a key-type change)
  decrypt locally in multiple Regions, no re-encrypt ... Multi-Region key
  imported key material rotation ........................ MANUAL only, automatic not supported
  IAM policy allows it but decrypt still fails ......... Check the KEY POLICY (separate gate)
  encrypting large objects without hitting 4 KB limit .. Envelope encryption (data key locally)
  three ways to control KMS access ...................... Key policy, IAM policy, Grants
```

---

<a name="mnemonics"></a>
## 15. Mnemonics

- **"The KMS key never leaves the building."** Only the small,
  encrypted data key travels; the master key stays in KMS's HSMs.
- **"Two locks, two keys must both turn."** IAM policy AND key policy
  must both allow — the dual-gate design.
- **"SSE-C: the C is for 'Customer keeps custody, completely.'"** No
  KMS key object exists; AWS never stores it in any form.
- **"Rotation changes the lock, not the door."** Old ciphertext stays
  decryptable — rotation only affects what encrypts *new* data.
- **"AWS-managed = free, but yours alone. CMK = paid, but shareable."**
  The exact cross-account tradeoff in one line.

---

<a name="questions"></a>
## 16. Practice questions (15, scenario-style, every option explained)

**1.** A finance team needs to share an encrypted S3 dataset with a
partner's separate AWS account, and the partner must be able to
decrypt it directly. Which key type must be used?

- A) AWS-managed key (`aws/s3`)
- B) AWS owned key
- C) Customer-managed key (CMK), with the partner's principal added to
  the key policy **← correct**
- D) Any key type works as long as the S3 bucket policy allows it

*A and B are both automatically disqualified — neither AWS-managed nor
AWS-owned keys can ever be shared cross-account, regardless of any
other configuration. C is correct — only a customer-managed key has a
key policy you can edit to name an external account's principal. D is
wrong — the bucket policy alone is not sufficient; the KMS key policy
is a separate, required gate for decrypting the data itself.*

**2.** A high-throughput S3 workload using SSE-KMS is generating
unexpectedly high KMS costs due to request volume. What is the correct
fix?

- A) Switch to an AWS-managed key to eliminate per-request charges
- B) Enable S3 Bucket Keys to reduce the number of KMS API calls
  generated per object operation **← correct**
- C) Switch to SSE-S3, since it has no KMS cost at all
- D) Disable envelope encryption to reduce KMS round trips

*A is wrong — AWS-managed keys still incur per-request charges;
switching only removes the ~$1/month key fee, not the request-volume
cost. B is correct — this is the specific, named cost lever for
exactly this complaint: Bucket Keys reduce `GenerateDataKey` calls by
reusing a bucket-level data key. C would solve the cost problem but at
the expense of losing the audit trail, customer key control, and
rotation options SSE-KMS provides — not the intended fix when the
actual requirement still needs KMS-level control (only correct if the
scenario explicitly drops the audit/compliance requirement). D is not
a real, user-controllable toggle — envelope encryption is how KMS
works internally and isn't something you disable.*

**3.** Which statement accurately describes what a KMS "grant" is used
for?

- A) A grant is a permanent replacement for the key policy
- B) A grant provides temporary, narrowly-scoped, revocable delegated
  access to specific KMS operations, often created programmatically
  by a service for a resource's lifecycle **← correct**
- C) A grant is required before any IAM policy can reference a KMS key
- D) A grant automatically rotates the key it's attached to

*A is wrong — grants supplement, not replace, the key policy. B is
correct — grants are the third access-control mechanism, purpose-built
for fine-grained, often auto-expiring, programmatic delegation (e.g.,
an EBS volume attachment). C is false — IAM policies can reference key
ARNs directly without any grant, as long as the key policy delegates
to IAM. D is fabricated — grants have nothing to do with rotation.*

**4.** A company's compliance policy requires that AWS never store
their encryption key material in any form, even encrypted by AWS's own
systems. Which encryption approach satisfies this?

- A) SSE-KMS with a customer-managed key
- B) SSE-KMS with an imported (BYOK) key
- C) SSE-C (customer-provided key) **← correct**
- D) DSSE-KMS with automatic rotation disabled

*A is wrong — even a CMK's material is generated and held (though
never exposed in plaintext to you) by AWS's HSMs, which doesn't
satisfy "AWS never stores it in any form." B is also wrong — imported
key material is still stored within KMS after import, even though you
generated it externally. C is correct — SSE-C is the only option
where AWS never persists the key at all; it's supplied per-request and
discarded immediately after use. D still involves KMS-held key
material, same issue as A.*

**5.** An object was encrypted using a KMS key in `us-east-1` and then
replicated via S3 Cross-Region Replication to a bucket in `eu-west-1`.
Without any additional KMS configuration, can the replicated copy be
decrypted directly in `eu-west-1`?

- A) Yes, KMS keys are automatically global
- B) No — a single-Region key's material doesn't exist in `eu-west-1`;
  a Multi-Region key (or a separate destination-Region key configured
  in the replication setup) is required for local decryption **← correct**
- C) Yes, but only if S3 Bucket Keys are enabled
- D) No, cross-Region replication of KMS-encrypted objects is not
  possible under any configuration

*A is false — KMS keys are regional by default. B is correct — this
is the exact Multi-Region key use case described in this file;
without one, decrypting in the destination Region isn't directly
possible with the source Region's single-Region key. C is
unrelated — Bucket Keys are a cost optimization, not a cross-Region
capability. D overstates the limitation — cross-Region replication of
KMS-encrypted objects is fully supported, it just requires either a
Multi-Region key or an explicitly configured destination-Region key in
the replication rule, not "not possible under any configuration."*

**6.** Which of the following correctly completes the dual-gate KMS
access model?

- A) VPC security group rules and NACL rules
- B) The caller's IAM policy AND the key's own key policy must both
  independently allow the action **← correct**
- C) The S3 bucket policy AND the IAM policy, with no involvement from
  KMS itself
- D) MFA and a CloudTrail approval workflow

*A describes network-layer controls, unrelated to KMS's access model.
B is correct — this is the core dual-gate mechanic covered throughout
this file. C omits the key policy entirely, which is the actual
required second gate for KMS operations specifically. D describes
fabricated mechanisms not part of KMS's standard access model.*

**7.** A team wants a KMS key to automatically rotate every year
without needing to re-encrypt any existing data. Which approach
satisfies this with the least operational effort?

- A) Manual rotation, re-encrypting all existing objects annually
- B) Automatic rotation on a customer-managed key — AWS retains old
  key material internally so existing ciphertext remains decryptable
  without any re-encryption **← correct**
- C) Imported key material with automatic rotation enabled
- D) Switching to SSE-S3, which rotates automatically with no
  configuration

*A describes a valid but far higher-effort manual process, not the
"least operational effort" answer. B is correct — automatic rotation
on a CMK is exactly designed for this: no re-encryption needed, and
essentially zero ongoing operational effort once enabled. C is
wrong — imported key material explicitly does **not** support
automatic rotation. D is misleading — SSE-S3 keys are managed entirely
by AWS with no customer visibility or control, and while AWS handles
the underlying key lifecycle, this isn't a comparable "automatic
rotation" feature you configure or audit; it also loses the
audit-trail benefit central to most CMK-driven requirements.*

**8.** In envelope encryption, what happens to the plaintext data key
after an object is encrypted?

- A) It is stored alongside the ciphertext for faster future decryption
- B) It is discarded from memory immediately after use; only the
  KMS-encrypted version of the data key is retained **← correct**
- C) It is sent back to KMS and permanently stored there
- D) It is cached in the application for 24 hours to avoid future KMS
  calls

*A is exactly the security mistake envelope encryption avoids — storing
the plaintext data key would defeat the purpose of encrypting it in
the first place. B is correct — this is the described mechanic: use
once, discard immediately, retain only the encrypted form. C is
wrong — KMS returns the encrypted data key to the caller to store;
KMS doesn't retain a copy of every data key it ever generates tied to
external objects. D describes an insecure caching practice that
contradicts the entire point of using a fresh plaintext key per
encryption operation and then discarding it.*

**9.** Which scenario is the clearest trigger for choosing a
customer-managed key over an AWS-managed key, even without any
cross-account requirement?

- A) The workload has extremely low request volume
- B) A compliance requirement demands a full CloudTrail audit trail of
  every individual encrypt/decrypt call against the key, and/or a
  rotation cadence you control **← correct**
- C) The team wants to avoid paying the ~$1/month key fee
- D) The data is not considered sensitive

*A doesn't by itself require CMK-level control — an AWS-managed key
works fine for low-volume, low-sensitivity workloads. B is correct —
audit granularity and rotation control are the two defining CMK
advantages that apply even in a single-account context, not just
cross-account sharing. C is backwards — avoiding the fee actually
favors an AWS-managed key, the opposite of choosing a CMK. D is a
reason to prefer SSE-S3 or an AWS-managed key, not a CMK.*

**10.** A company imports its own AES-256 key material into KMS
(BYOK). What rotation options are available for this key?

- A) Automatic annual rotation, same as any customer-managed key
- B) Manual rotation only — automatic rotation is not supported for
  imported key material **← correct**
- C) No rotation is possible once key material is imported
- D) Automatic rotation every 90 days, a special BYOK-only cadence

*A is wrong — imported key material is specifically excluded from the
automatic rotation feature. B is correct — because AWS didn't generate
the material, it cannot automatically regenerate it on your behalf;
only manual rotation (importing new material or creating a new key) is
possible. C is too absolute — manual rotation remains available, it's
only automatic rotation that's unsupported. D describes a fabricated
special cadence that doesn't exist.*

**11.** Which of the following is true about S3 Bucket Keys?

- A) They replace the need for a KMS key entirely
- B) They are a cost-optimization feature that reduces the number of
  calls made to KMS by reusing a bucket-level data key across many
  object-level operations **← correct**
- C) They increase the strength of the underlying encryption algorithm
- D) They are only available with AWS-managed keys, not
  customer-managed keys

*A is false — a KMS key (of some type) is still required underneath;
Bucket Keys just change how often it's called. B is correct — this is
precisely the described mechanism and the exam-favorite trigger phrase
("KMS request costs have become too high"). C is false — encryption
strength is unchanged; this is purely an API-call-volume optimization.
D is false — Bucket Keys work with customer-managed keys as well as
AWS-managed keys.*

**12.** A key policy for a customer-managed key does not include a
statement enabling the account's IAM policies to grant access. What is
the practical consequence?

- A) The key becomes completely unusable by anyone, including the
  account root
- B) Access must be granted directly in the key policy itself (or via
  grants) — IAM policies in the account alone cannot grant access to
  this key unless the key policy delegates that authority **← correct**
- C) The key automatically falls back to AWS-managed key behavior
- D) CloudTrail stops logging usage of this key

*A overstates the effect — the key policy itself, and the account
root by default inclusion, can still be used to manage/grant access
explicitly; it's not "completely unusable." B is correct — this
directly reflects the layered access model: the default CMK key policy
includes a statement delegating to IAM policies in the same account,
and if that statement is removed, IAM policies alone no longer suffice
— every grant must come through the key policy or explicit grants
instead. C is fabricated — key type doesn't change based on policy
content. D is false — CloudTrail logging of KMS API calls is
independent of key policy content.*

**13.** Which combination correctly describes the two independent
gates required for a cross-account read of an SSE-KMS-encrypted S3
object?

- A) VPC endpoint policy and NACL rules
- B) S3 bucket policy (or ACL) allowing the principal, AND the KMS key
  policy independently allowing the same principal to decrypt **← correct**
- C) IAM policy on the requester alone is sufficient; no other gate is
  needed
- D) CloudTrail approval and Config compliance status

*A describes unrelated network-layer controls. B is correct — this is
the exact two-gate requirement emphasized throughout this file for
cross-account encrypted S3 access: S3 access and KMS decrypt access
are governed by separate resource-based policies that must both
independently permit the requester. C is incomplete — the requester's
own IAM policy is necessary but not sufficient; the resource-side
policies (bucket and key) must also grant access. D describes
fabricated mechanisms not part of this access model.*

**14.** Why is direct `kms:Encrypt` on a KMS key limited to 4 KB of
data, and how does this shape real-world usage?

- A) It's an arbitrary quota that can be raised on request for any
  payload size
- B) KMS keys are designed for encrypting small amounts of data (like
  data keys), not large objects directly — which is why envelope
  encryption (encrypting the object locally with a data key, then
  encrypting only that small data key via KMS) is the standard pattern
  for objects of any size **← correct**
- C) The limit only applies to AWS-managed keys, not customer-managed
  keys
- D) The limit exists to reduce CloudTrail log volume

*A is wrong — this isn't a raisable soft quota; it's a hard design
constraint reflecting KMS's intended usage pattern. B is correct — this
directly explains *why* envelope encryption is the architecture every
AWS storage service actually uses under the hood, rather than calling
KMS `Encrypt` directly on full objects. C is false — the 4 KB limit
applies uniformly regardless of key type. D is an invented rationale
unrelated to the actual reason.*

**15.** A team needs a Redshift cluster's automated snapshots,
encrypted with a customer-managed KMS key, to be usable for restoring
a cluster in a partner's separate AWS account. What must be configured?

- A) Nothing beyond enabling snapshot encryption — snapshots are
  automatically shareable regardless of key type
- B) The snapshot must be explicitly shared with the partner account,
  AND the KMS key policy must grant the partner account's principal
  the ability to use the key (since AWS-managed keys cannot be shared,
  a customer-managed key is required, as already specified) **← correct**
- C) Snapshot sharing across accounts is not supported for encrypted
  Redshift clusters under any circumstances
- D) Only the partner's IAM policy needs to allow `redshift:RestoreFromClusterSnapshot`;
  KMS is not involved in snapshot restoration

*A is wrong — sharing an encrypted snapshot cross-account still
requires the key to be shareable, which only a customer-managed key
supports; this isn't automatic. B is correct — both the snapshot-sharing
step and the KMS key policy grant to the partner account's principal
are required; this mirrors the general cross-account KMS pattern
applied to Redshift specifically. C is false — encrypted snapshot
sharing across accounts is fully supported, but only with a
customer-managed key. D is incomplete — restoring an encrypted
snapshot in another account absolutely requires that account's
principal to have KMS decrypt access to the key that encrypted it.*
