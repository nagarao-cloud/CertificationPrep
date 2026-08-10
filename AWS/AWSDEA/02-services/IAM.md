# AWS IAM

> Service file. Domain coverage: the backbone of **Domain 4** (Data
> Security and Governance, 18%) but referenced constantly across every
> other domain — nearly every service integration on this exam
> ("Glue assumes a role," "Redshift needs permission to read S3")
> is an IAM fact wearing a different service's clothes.
>
> One-line identity: **the identity and coarse-permission layer for
> every AWS API call** — IAM answers "who are you" and "what API
> actions can you call," but it has **no concept of a column, a row,
> or a cell**, which is the single most-tested boundary on this exam.

## CONTENTS

1. [8-step teaching pass](#steps)
2. [Per-service coverage checklist](#checklist)
3. [Users vs roles vs groups](#users-roles-groups)
4. [The full IAM policy evaluation order](#eval-order)
5. [Managed vs inline vs custom policies](#policy-types)
6. [Trust policies and cross-account roles](#trust)
7. [IAM Identity Center vs IAM users](#identity-center)
8. [Decision tree](#tree)
9. [Production architecture](#prod)
10. [Exam traps](#traps)
11. [Interview questions](#interview)
12. [Cheat sheet](#cheat)
13. [Mnemonics](#mnemonics)
14. [15 practice questions](#questions)

---

<a name="steps"></a>
## 1. 8-step teaching pass

### Step 1 — Explain like I'm 12

IAM is the school's front-office system for badges. A **user** is a
badge issued to one specific person that they keep forever until it's
taken away. A **role** is a badge kept in a drawer at the front desk
that *anyone approved* can borrow for the day and must return — nobody
owns it permanently. A **group** is a labeled bin of badges that all
get the same stickers (permissions) added at once, so the office
doesn't have to sticker each badge individually. A **policy** is the
actual list of stickers — "can open the gym," "cannot open the
server room." And just like a real school, some doors have their own
separate lock that even a badge with the right sticker still can't
open unless the *door itself* (not just the badge) also says that
person is allowed in — that's what a resource-based policy or a key
policy is.

### Step 2 — Explain technically

AWS Identity and Access Management (IAM) is the **global** (not
regional) service that authenticates principals (users, roles, federated
identities) and authorizes their API calls against **identity-based**
policies (attached to the principal) and **resource-based** policies
(attached to the resource, e.g., an S3 bucket policy or a KMS key
policy). Every policy is a JSON document composed of statements, each
with an `Effect` (`Allow`/`Deny`), `Action`(s), `Resource`(s), and
optional `Condition`(s). IAM has no native awareness of the *contents*
of a resource — it can grant or deny `s3:GetObject` on a bucket/prefix,
but it cannot express "this user may see every column except SSN,"
because that requires a data-aware layer (Lake Formation, Redshift
RLS) sitting on top of IAM, not inside it.

### Step 3 — Explain like a Senior AWS Data Engineer

A senior engineer's default posture is **roles over users, always**,
and **short-lived credentials over long-lived ones, everywhere**. The
number of standing IAM users with programmatic access keys in a
mature production account should trend toward zero — every AWS
service in a pipeline (Glue, Lambda, EMR, Redshift) **assumes its own
dedicated role**, scoped to exactly what that component needs, so a
compromise of one component can't pivot into another's permissions.
The second senior instinct is knowing IAM's **evaluation order** cold —
not as trivia, but because it explains *why* a request that "should
work" doesn't: an SCP ceiling silently blocking an otherwise-correct
identity policy, or a permissions boundary quietly capping what a
role can actually do regardless of how generous its attached policy
looks. The third instinct: reach for a **custom, least-privilege
policy** the instant a requirement says "only this prefix" or "read
but not delete" — an AWS-managed policy is almost always broader than
what a real production workload needs.

### Step 4 — Production architecture

See [section 9](#prod).

### Step 5 — Exam traps

See [section 10](#traps).

### Step 6 — Interview questions

See [section 11](#interview).

### Step 7 — Cheat sheet

See [section 12](#cheat).

### Step 8 — Memory tricks

See [section 13](#mnemonics).

---

<a name="checklist"></a>
## 2. Per-service coverage checklist — IAM

| Dimension | Detail |
|---|---|
| **Purpose** | Global identity and access management — authenticate principals, authorize API actions via policy evaluation |
| **When to use** | Every AWS API call, always — there is no opt-out. The design question is never "IAM or not," it's "role or user," "managed or custom policy," "identity-based or resource-based" |
| **When NOT to use** | Column/row/cell-level data filtering (Lake Formation, Redshift RLS); org-wide guardrails that must never be bypassable by any single account's IAM policy (AWS Organizations SCPs are the ceiling above IAM) |
| **Advantages** | Free, global, deeply integrated with every AWS service, supports fine-grained conditions (IP, MFA, time, tags, encryption context), federation (SAML, OIDC, IAM Identity Center) |
| **Limitations** | No native data-content awareness (no columns/rows); policy size limits (2 KB inline for users, 10 KB for roles/groups on managed policies — exact limits vary by policy type); up to 10 managed policies per principal (soft limit); complexity at scale without ABAC/tagging discipline |
| **Pricing** | **Free** — no charge for users, roles, groups, or policies themselves |
| **Performance** | Policy evaluation adds negligible latency to API calls; no capacity to provision |
| **Scaling** | Effectively unlimited principals/policies within soft quotas (raisable); ABAC/tag-based policies scale better than per-resource role sprawl |
| **Security** | MFA enforcement via policy condition, `aws:MultiFactorAuthPresent`; access keys should be rotated or eliminated entirely in favor of roles; IAM Access Analyzer flags unintended external access |
| **High availability** | Global service, no region to fail over — every region reads the same IAM data |
| **Failure scenarios** | Overly broad policy ("Resource": "*", "Action": "s3:*") left in place after a "temporary" fix; a role's trust policy misconfigured so the wrong principal can assume it; forgetting a resource-based policy is required in addition to the identity policy for cross-account access |
| **Common mistakes** | Attaching permissions to individual users instead of groups/roles; hardcoding access keys in code/environment variables; putting resource permissions in a trust policy (trust policies answer "who may assume this role," not "what may the role do") |
| **Exam traps** | Assuming IAM alone can restrict access to a single column (it cannot — Lake Formation/Redshift RLS); forgetting SCPs are a ceiling that even `AdministratorAccess` cannot override; picking an IAM policy fix for a scenario that's actually a KMS key policy problem |
| **Enterprise example** | A bank's Glue jobs each run under their own narrowly-scoped service role (one role per job, `Resource` limited to that job's specific S3 prefix and KMS key), so a security review can trace exactly which job touched which data, and a compromised job's blast radius is limited to its own prefix |

---

<a name="users-roles-groups"></a>
## 3. Users vs roles vs groups

| Principal type | What it is | Credential lifetime | Best for |
|---|---|---|---|
| **IAM User** | A permanent identity representing one person or application | **Long-lived** (password and/or access keys, until rotated/revoked) | Legacy human access; being phased out in favor of IAM Identity Center |
| **IAM Role** | A temporary identity that must be **assumed** (`sts:AssumeRole` or service-linked assumption) | **Short-lived** (STS tokens, auto-expiring, typically 15 min–12 hr) | **AWS services** (Glue, Lambda, EMR, Redshift — always), cross-account access, federated human access |
| **IAM Group** | A named collection of users, for bulk policy attachment | N/A — groups hold no credentials themselves | Bulk-managing permissions for humans; cannot be assumed by a service and cannot be referenced in a role's trust policy |

```
   IAM Role
       |
       +-- Trust Policy   -->  WHO/WHAT may assume this role
       |                       (e.g., Principal: glue.amazonaws.com,
       |                        or Principal: arn:aws:iam::222222222222:root)
       |
       +-- Permission Policy(ies)  -->  WHAT the role may DO once assumed
                                        (e.g., s3:GetObject on a specific prefix)
```

**The trust-policy/permission-policy split is the single most common
early-career mixup.** The **trust policy** (also called the
assume-role policy document) lives on the role and answers "who is
allowed to become me" — it names a `Principal` (an AWS service, another
account, a federated identity provider) and typically requires
`sts:AssumeRole`. The **permission policy** (attached separately,
managed/inline/custom) answers "once I'm assumed, what can I actually
call" — `s3:GetObject`, `dynamodb:PutItem`, etc. Putting S3 permissions
inside a trust policy, or putting a service principal inside a
permission policy's `Principal` field, simply doesn't work — they're
structurally different documents answering different questions, and
exam distractors routinely swap them.

**Only roles can be assumed by AWS services.** A Glue job, Lambda
function, EMR cluster, or Redshift cluster **always** runs under a
role, never a user — there is no mechanism for a user's long-lived
credentials to be "attached" to a running service the way a role is.
Any exam option describing a service using an IAM **user's** access
keys is the trap.

---

<a name="eval-order"></a>
## 4. The full IAM policy evaluation order

**This exact sequence matters — memorize it verbatim, not just the
general idea.**

```
1. Is there an EXPLICIT DENY anywhere in scope?             --> DENY. Stop immediately.
2. Does an SCP (AWS Organizations) allow the action?         --> If NO, DENY.
3. Does a resource-based policy allow the action?             --> If YES, may ALLOW
                                                                    (can short-circuit straight
                                                                     to allow for same-account
                                                                     or explicitly permitted
                                                                     cross-account principals).
4. Is the action within the permissions boundary (if set)?    --> If NO, DENY.
5. Does a session policy (if any) allow the action?            --> If NO, DENY.
6. Does an identity-based policy allow the action?             --> If YES, ALLOW.
7. If nothing explicitly allowed it                            --> IMPLICIT DENY.
```

**Reading this as the actual decision AWS makes on every single API
call:** the check starts by scanning **everywhere** — every applicable
SCP, resource-based policy, permissions boundary, session policy, and
identity-based policy — for **any explicit `Deny`**. If one exists,
the request is denied immediately and nothing else is evaluated;
**an explicit deny cannot be overridden by any allow, anywhere, ever.**
If there's no explicit deny, the evaluation narrows: an **SCP** first
acts as an account-wide **ceiling** — if the SCP doesn't allow the
action, the request is denied regardless of how permissive the
identity policy is (an SCP grants nothing by itself; it only *caps*
what identity/resource policies below it are allowed to grant). Next,
a **resource-based policy** (an S3 bucket policy, a KMS key policy, an
SQS queue policy) is checked — critically, a resource-based policy
**can grant access on its own**, even to a principal with **no**
identity-based policy at all, which is exactly the mechanism cross-account
sharing relies on. A **permissions boundary**, if attached to the
principal, acts as a second ceiling — it doesn't grant anything
itself, it only caps the *maximum* the identity-based policy can
grant. A **session policy** (passed when assuming a role, e.g. via
`sts:AssumeRole` with an inline session policy) similarly narrows what
that specific session may do. Finally, the **identity-based policy**
(attached directly to the user/role/group) is checked for an explicit
`Allow`. If nothing in the entire chain produced an explicit allow, the
request falls through to **implicit deny** — AWS's default posture is
deny-unless-explicitly-allowed.

**Mnemonic from this repo's house style:** *"Deny Stops Really Powerful
Session Identities"* — **D**eny, **S**CP, **R**esource-based,
**P**ermissions boundary, **S**ession policy, **I**dentity-based.

**Senior engineer take.** The two steps candidates most often forget
exist at all are **SCPs** and **permissions boundaries** — both are
**ceilings that grant nothing**, they only restrict. A role can have a
beautifully scoped, fully permissive identity-based policy and *still*
be denied if an SCP at the OU level doesn't allow that action, or if a
permissions boundary caps it out. This is why "the IAM policy looks
completely correct and access is still denied" is a realistic,
frequently tested scenario — the missing piece is almost always one of
these two ceiling mechanisms, or a resource-based policy (commonly a
KMS key policy) that was never updated.

---

<a name="policy-types"></a>
## 5. Managed vs inline vs custom policies

| | **AWS-managed policy** | **Customer-managed policy** | **Inline policy** |
|---|---|---|---|
| Who creates it | AWS | You | You |
| Reusable across principals | ✅ | ✅ | ❌ Tied to exactly one principal |
| Versioning | ✅ (AWS updates it) | ✅ Up to 5 versions kept | ❌ No version history |
| Editable by you | ❌ | ✅ | ✅ |
| Typical use case | Fast start, broad/standard permission sets (`AmazonS3ReadOnlyAccess`) | Reusable, org-specific least-privilege permission sets | One-off, tightly scoped exception permanently tied to a single role |
| Risk profile | Usually **broader** than a real least-privilege requirement | Best practice for anything reused | Easy to lose track of at scale (no central library) |
| Exam favorite trigger | "quick standard permission set" | "reusable custom least-privilege policy" | "strictly scoped to one resource, never reused elsewhere" |

**Custom policies are the default answer whenever "least privilege" is
in the stem.** AWS-managed policies (`AmazonS3FullAccess`,
`AmazonAthenaFullAccess`) are near-always broader than any genuine
production requirement — the moment a scenario says "only this
prefix," "read but not delete," or "this specific table," the managed
policy is disqualified. A custom, scoped `Action`/`Resource` pair is
what least privilege concretely looks like in JSON, not a description.

**Permissions boundary — a fourth concept, distinct from all three
policy types above.** A permissions boundary is a **managed policy**
(AWS-managed or customer-managed) attached to a **user or role
specifically to set the maximum permissions it can ever have**,
regardless of how permissive its identity-based policies are. It's the
mechanism for **delegated administration** — letting a team lead
create roles for their own team without being able to accidentally (or
maliciously) grant those roles more than the boundary allows, even if
they attach `AdministratorAccess` to the identity-based policy.

---

<a name="trust"></a>
## 6. Trust policies and cross-account roles

```
   Account A (222222222222)                    Account B (111111111111)
   +----------------------+                     +-----------------------+
   | IAM Role: "CrossAcct" |                     | IAM User/Role          |
   | Trust Policy:          |                     | "AnalystRole"          |
   |  Principal: arn:aws:   |<--sts:AssumeRole----|                        |
   |  iam::111111111111:    |                     |                        |
   |  role/AnalystRole      |                     |                        |
   | Permission Policy:     |                     |                        |
   |  s3:GetObject on       |                     |                        |
   |  lake/shared/*         |                     |                        |
   +----------------------+                     +-----------------------+
```

A **cross-account role** is a role in Account A whose **trust policy**
explicitly names a principal in Account B (a specific role/user ARN,
or the entire account root). Account B's principal calls
`sts:AssumeRole` against that role's ARN, receives short-lived STS
credentials scoped to whatever the role's **permission policy** allows,
and uses those temporary credentials to act in Account A — no
long-lived credentials ever cross the account boundary, and the access
is fully revocable by editing or deleting the trust relationship.

**External ID.** When a **third party** (not another account you
control) needs to assume a role into your account — a common SaaS
integration pattern — the trust policy should require an
**`sts:ExternalId`** condition, a shared secret string that prevents
the **confused deputy problem**: without it, if the third party's own
AWS account is ever tricked into assuming roles on behalf of other
customers, it could accidentally assume into your account too, because
role ARNs are not secret. The external ID acts as an extra shared
secret the trust policy demands, which the confused deputy wouldn't
know.

---

<a name="identity-center"></a>
## 7. IAM Identity Center vs IAM users

| Attribute | **IAM Identity Center** (formerly AWS SSO) | **IAM Users** |
|---|---|---|
| Scope | **Organization-wide** — one login for many accounts | Per-account |
| Credential model | Federated, **short-lived**, SSO-based (integrates with an external IdP: Okta, Azure AD, Google Workspace, or its own built-in directory) | Long-lived (password + optional access keys) unless manually rotated |
| Best practice status | ✅ **Current AWS best practice** for human access | ⚠️ Legacy; being actively discouraged for anything beyond a small number of break-glass/service accounts |
| Multi-account access | ✅ Native — one identity, permission sets mapped per account | ❌ A separate user needed per account (or role-assumption chains) |
| MFA | Centrally enforced at the identity provider | Must be configured per user |
| Exam favorite trigger | "centralized human access across multiple AWS accounts" | usually appears as the **legacy/wrong** option in a "best practice" question |

**Senior engineer take.** In a mature organization, the number of
standing IAM users with console or programmatic access should trend
toward **zero** — humans authenticate through **IAM Identity Center**
and assume roles scoped to their job function; AWS services and
applications use **roles**, never users. An IAM user with a long-lived
access key sitting in a Glue job's environment variables, or a
developer's laptop `~/.aws/credentials` file, is a routine finding in
real security audits (SOC 2, HIPAA) and typically requires a
documented remediation plan.

---

<a name="tree"></a>
## 8. Decision tree

```
                    WHO/WHAT needs access?
                              |
              +----------------+-----------------+
         A HUMAN                             AN AWS SERVICE
              |                              (Glue, Lambda, EMR, Redshift...)
     Single account or                              |
     multi-account org?                        ALWAYS AN IAM ROLE
              |                                (never a user — no exceptions)
      +-------+-------+
   Multi-acct        Single acct
      |                  |
  IAM IDENTITY      IAM Identity Center
  CENTER             preferred; legacy IAM
  (best practice)    User only for break-glass


                    Does the requirement say
                    "least privilege" / "only this
                    prefix" / "read but not delete"?
                              |
                      +-------+-------+
                    YES              NO
                      |                |
              CUSTOM POLICY      AWS-managed policy
              (managed if        may be acceptable
               reused elsewhere, (quick start, broad
               inline if truly    default)
               one-off)

                    Cross-account access needed?
                              |
                      +-------+-------+
                    YES              NO
                      |                |
          ROLE with a TRUST      Standard identity-based
          POLICY naming the      policy on the role/user
          other account's         in this account
          principal, + resource-
          based policy if the
          resource itself also
          needs to allow it
          (e.g. S3 bucket policy,
           KMS key policy)
                      |
          Third party (not an     Internal cross-account
          account you control)?   (both accounts yours)?
                      |                    |
              REQUIRE sts:ExternalId   ExternalId optional
              (confused deputy fix)    but still good practice
```

---

<a name="prod"></a>
## 9. Production architecture

```
   +---------------------------+
   |  AWS Organizations         |
   |  SCP: deny s3:PutObject     |
   |  outside approved regions   |  <-- account-wide CEILING, step 2 of eval order
   +-------------+---------------+
                 |  applies to every account/role below
                 v
   +----------------+        +-------------------+
   | Human (Naga)    |------->| IAM Identity Center |
   +----------------+        +---------+-----------+
                                        |  assumes a role scoped to job function
                                        v
                              +-------------------+
                              | AnalystRole         |
                              | permissions boundary:|  <-- CEILING, step 4
                              | max = ReadOnly on     |
                              | data lake prefixes     |
                              +---------+-----------+
                                        |
                          +-------------+-------------+
                          |                             |
                 +-----------------+          +-----------------------+
                 | Glue Job Role     |          | Redshift COPY Role      |
                 | trust: glue.amazon|          | trust: redshift.amazon |
                 | aws.com            |          | aws.com                 |
                 | policy: s3:GetObj  |          | policy: s3:GetObject     |
                 | on raw/* only       |          | on curated/* + kms:Decrypt|
                 +---------+---------+          +-----------+-----------+
                           |                                  |
                           v                                  v
                 +----------------------------------------------------+
                 |  S3 Data Lake (SSE-KMS)                              |
                 |  Bucket policy (RESOURCE-BASED, step 3 of eval order)|
                 |  KMS key policy (RESOURCE-BASED, separate gate)      |
                 +----------------------------------------------------+
```

**Reading top to bottom.** The **SCP** at the Organizations level is
the outermost ceiling — step 2 in the evaluation order — and no role
below it, however permissive, can exceed it. A **human user** never
holds standing credentials; they authenticate via **IAM Identity
Center** and assume a role. That role carries a **permissions
boundary** — step 4 — capping the maximum it can ever be granted, which
matters if this analyst is later given a broader identity policy by
mistake; the boundary still holds the ceiling. Every **AWS service** in
the pipeline — Glue, Redshift — runs under its **own dedicated role**
with a **trust policy** naming exactly that service as the principal
allowed to assume it, and a **permission policy** scoped to only the
prefix and actions it actually needs. Both roles ultimately touch the
**S3 data lake**, which carries its own **resource-based policies** —
the bucket policy and the KMS key policy — step 3 in the evaluation
order, evaluated independently of (and in addition to) each role's
identity-based policy. This is precisely why "the role's IAM policy
allows it, but access is still denied" is realistic: the missing piece
is almost always one of these resource-based gates, not the identity
policy itself.

---

<a name="traps"></a>
## 10. Exam traps

- ⚠️ Believing IAM alone can filter a **column, row, or cell** — it
  cannot; that always requires **Lake Formation** (data lake) or
  **Redshift RLS/dynamic masking** (warehouse).
- ⚠️ Forgetting the exact **evaluation order** — a resource-based
  policy `Allow` does **not** override an explicit `Deny` anywhere in
  scope, and an **SCP** grants nothing by itself, it only restricts.
- ⚠️ Assuming a **permissions boundary** grants permissions — it only
  **caps** what the identity-based policy can grant; it is never a
  source of `Allow` on its own.
- ⚠️ Putting resource permissions inside a **trust policy**, or a
  service principal inside a **permission policy's** `Principal`
  field — these are structurally different documents answering
  different questions ("who may assume me" vs. "what may I do").
- ⚠️ Picking an **IAM user with hardcoded access keys** for "simplicity"
  in any exam option — always wrong regardless of what other
  constraint the question mentions.
- ⚠️ Cross-account access failing even though the identity policy
  "looks right" — the missing piece is almost always the **resource-based
  policy** (bucket policy, KMS key policy) on the other account's side.
- ⚠️ Omitting **`sts:ExternalId`** in a trust policy for a **third-party**
  cross-account role — this is the specific fix for the confused
  deputy problem, not a generic best practice throwaway line.
- ⚠️ Choosing an **AWS-managed policy** when the stem says "least
  privilege" or "minimal access" — a **custom policy** is required.

---

<a name="interview"></a>
## 11. Interview questions

- *"Walk me through IAM's policy evaluation order and why the order
  matters, not just which policy types exist."* — Expect the exact
  sequence: explicit deny anywhere → SCP ceiling → resource-based
  policy (can allow independently) → permissions boundary ceiling →
  session policy → identity-based policy → implicit deny. The order
  matters because SCPs and boundaries are **ceilings that only
  restrict**, never grant, and an explicit deny short-circuits
  everything else regardless of how many allows exist elsewhere.
- *"A Glue job's role has full S3 access in its identity policy but
  still gets AccessDenied reading an encrypted object. What do you
  check first?"* — The KMS key policy (a resource-based policy) —
  decrypting requires both the caller's IAM policy **and** the key's
  own key policy to independently allow `kms:Decrypt`; the identity
  policy being correct says nothing about the key policy.
- *"Why does AWS recommend roles over users for service access, and
  what's the actual mechanism that makes roles safer?"* — Roles issue
  **short-lived STS credentials** that auto-expire, versus a user's
  long-lived access keys that persist until manually rotated/revoked;
  a leaked role-session credential has a small, bounded exposure
  window, while a leaked long-lived key remains valid indefinitely
  until someone notices and acts.
- *"How would you let a team lead create IAM roles for their own team
  without risking them granting more access than intended?"* — Attach
  a **permissions boundary** to any role the team lead creates,
  capping the maximum permissions regardless of what identity policy
  they attach — this is the standard delegated-administration pattern.

---

<a name="cheat"></a>
## 12. Cheat sheet

```
IAM ONE-LINERS
  AWS service needs access ........................... ALWAYS a role, never a user
  human, single account ............................... IAM Identity Center (legacy: IAM user)
  human, multi-account org ............................ IAM Identity Center
  "least privilege" / "only this prefix" .............. Custom policy, not AWS-managed
  reused across many principals ....................... Managed policy (customer-managed if custom)
  strictly one-off, tied to one principal ............. Inline policy
  cap the MAX a role can ever have .................... Permissions boundary
  org-wide ceiling, un-overridable ..................... SCP (AWS Organizations)
  cross-account access ................................. Trust policy naming the other account/role
  third-party cross-account (confused deputy fix) ..... sts:ExternalId in the trust policy
  encrypted cross-account data ......................... KMS key policy (resource-based), not just IAM
  who may assume this role? ............................ Trust policy
  what may this role DO once assumed? .................. Permission policy
  column/row/cell filtering ............................ NOT IAM — Lake Formation / Redshift RLS
  explicit deny anywhere ............................... Always wins, stops evaluation immediately
```

**Evaluation order, one more time, verbatim:**
```
Explicit Deny -> SCP -> Resource-based policy -> Permissions boundary
-> Session policy -> Identity-based policy -> Implicit Deny
```

---

<a name="mnemonics"></a>
## 13. Mnemonics

- **"Deny Stops Really Powerful Session Identities."** The evaluation
  order: **D**eny, **S**CP, **R**esource-based, **P**ermissions
  boundary, **S**ession policy, **I**dentity-based.
- **"Trust says WHO. Permission says WHAT."** Never confuse the two
  documents on a role.
- **"Boundaries and SCPs only take away, never give."** Both are pure
  ceilings — neither is a source of `Allow`.
- **"If it's a service, it's a role. Full stop."** No AWS service ever
  runs under a user's credentials in a correctly designed pipeline.

---

<a name="questions"></a>
## 14. Practice questions (15, scenario-style, every option explained)

**1.** Which principal type must an AWS Glue job always assume to
access S3, and why?

- A) An IAM user with an access key stored in the job's arguments
- B) An IAM role, because only roles issue short-lived, auto-expiring
  credentials to a running service **← correct**
- C) An IAM group, because groups can be attached directly to a
  running Glue job
- D) A root account credential, for guaranteed full access

*A is the classic hardcoded-credential trap and is never correct. B is
correct — this is a firm rule on this exam: every AWS service always
assumes a dedicated role, never a user, specifically because roles
provide temporary STS credentials rather than long-lived keys. C is
wrong — groups exist only to bundle policies for human users and
cannot be assumed by a service or attached to a running job. D is
both operationally wrong and a severe security anti-pattern.*

**2.** An SCP at the OU level denies `s3:PutObject` outside
`us-east-1`. A role in that OU has an identity-based policy explicitly
allowing `s3:PutObject` to any region, including `eu-west-1`. What
happens if that role tries to PutObject in `eu-west-1`?

- A) The action succeeds because the identity-based policy explicitly
  allows it
- B) The action is denied — the SCP is a ceiling the identity policy
  cannot exceed **← correct**
- C) The action succeeds because SCPs only apply to root-level
  accounts, not roles
- D) The result depends on which policy was created most recently

*A ignores that an SCP evaluation happens before/independently of the
identity policy and caps what it can grant — being "explicitly
allowed" at the identity layer never overrides an SCP-level restriction.
B is correct — this is the textbook demonstration that SCPs are a
ceiling, not a grant, and no identity-based `Allow` can push through
it. C misstates SCP scope — SCPs apply to every principal within the
OU/account they're attached to, not just "root-level" credentials. D
is not how policy evaluation works — there is no "most recent policy
wins" concept in IAM.*

**3.** A cross-account role in Account A has a correctly configured
trust policy naming a role in Account B, and a permission policy
granting `s3:GetObject` on `lake/shared/*`. Account B's role assumes
it successfully but still gets AccessDenied reading the objects. What
is the most likely missing piece?

- A) Account B's role needs its own separate IAM user
- B) The S3 bucket policy in Account A (a resource-based policy) does
  not also grant Account B's principal access, or the objects are
  KMS-encrypted and the key policy hasn't been updated **← correct**
- C) The trust policy needs a permissions boundary added
- D) Cross-account role assumption requires MFA to complete the second
  step of authorization

*A is irrelevant — the role was already successfully assumed; a
separate user adds nothing. B is correct — this is the standard "looks
right but isn't" scenario: even with a correct trust and permission
policy on the role, if the bucket also has a policy that must
independently allow the principal (or, more commonly, if the objects
are SSE-KMS encrypted, the KMS key policy is a separate resource-based
gate that must independently allow the principal) access is still
denied. C is a distractor — permissions boundaries cap identity
policies, they don't fix resource-based access gaps. D is
fabricated — successful role assumption does not have a silent
follow-up MFA step unless explicitly configured as a trust-policy
condition, which wasn't mentioned here.*

**4.** Which statement correctly distinguishes a permissions boundary
from an identity-based policy?

- A) A permissions boundary can grant access on its own, just like an
  identity-based policy
- B) A permissions boundary sets the maximum permissions a principal
  can ever have; it never grants access by itself, only restricts **← correct**
- C) A permissions boundary only applies to IAM groups, not roles or
  users
- D) A permissions boundary is evaluated after the identity-based
  policy and can override an explicit Allow

*A is incorrect — this is the most common misunderstanding; a
boundary is purely restrictive. B is correct — a boundary is a
ceiling: the *effective* permission is the intersection of what the
identity-based policy allows and what the boundary allows, and the
boundary alone grants nothing. C is wrong — boundaries attach to
users and roles, not groups. D reverses the evaluation order and
mischaracterizes what "override" means here — the boundary is checked
as a cap, not as a later step that overrides an allow.*

**5.** A third-party SaaS vendor needs to assume a role into a
customer's AWS account to read specific S3 data. What is the
recommended trust policy safeguard specific to this third-party
scenario?

- A) Require MFA on every assumption
- B) Require `sts:ExternalId` as a condition in the trust policy to
  prevent the confused deputy problem **← correct**
- C) Attach a permissions boundary to the vendor's own IAM role in
  their account
- D) Use an IAM user instead of a role for the vendor's access

*A is a reasonable general hardening step but doesn't specifically
solve the confused-deputy risk this scenario describes. B is correct —
`sts:ExternalId` is the named, standard mitigation for third-party
cross-account role assumption, preventing the vendor's own AWS account
from being tricked into assuming into the wrong customer's role. C
governs the vendor's own account, not the customer's trust policy, and
doesn't address this specific risk. D reintroduces long-lived
credentials, which is the opposite of the intended pattern.*

**6.** Which of the following is true about AWS-managed policies
versus customer-managed policies for a "least privilege" requirement?

- A) AWS-managed policies should always be preferred because they're
  maintained by AWS
- B) AWS-managed policies are typically broader than a genuine
  least-privilege requirement; a custom (customer-managed) policy
  scoped to the specific `Action`/`Resource` pair is the correct
  choice **← correct**
- C) Customer-managed policies cannot be reused across multiple roles
- D) AWS-managed policies automatically update to narrow scope over
  time as your usage patterns change

*A ignores that "maintained by AWS" says nothing about how narrowly
scoped the policy is for your specific use case — most AWS-managed
policies are intentionally broad for general applicability. B is
correct — this is the recurring exam pattern: whenever "least
privilege," "minimal access," or "only this prefix" appears, a custom
policy is required. C is backwards — customer-managed policies are
explicitly designed to be reusable, unlike inline policies. D is
fabricated — AWS-managed policies do not adapt to your specific usage;
they remain fixed, broad permission sets.*

**7.** A role's trust policy has `Principal: {"Service":
"glue.amazonaws.com"}` and `Action: "sts:AssumeRole"`. What does this
configuration actually control?

- A) What S3 buckets the Glue job can read once the role is assumed
- B) Which principal (in this case, the Glue service) is permitted to
  assume this role **← correct**
- C) The maximum session duration for any assumption of this role
- D) The KMS key this role is allowed to use for decryption

*A describes what the permission policy (a separate document) would
control, not the trust policy. B is correct — a trust policy answers
exactly one question: who/what may assume this role; here, it
authorizes the Glue service specifically. C is a real trust-policy-
adjacent setting (`MaxSessionDuration`) but isn't what this particular
statement snippet controls. D is a permission-policy or key-policy
concern, unrelated to trust.*

**8.** Why is an explicit `Deny` in any applicable policy always
decisive, regardless of how many `Allow` statements exist elsewhere?

- A) Because explicit denies are evaluated last, after all allows are
  collected
- B) Because IAM's evaluation logic treats an explicit deny as an
  immediate, non-overridable stop — no combination of allows anywhere
  in the evaluation chain can override it **← correct**
- C) Because explicit denies only apply to resource-based policies
- D) Because an explicit deny automatically triggers a permissions
  boundary review

*A reverses the actual mechanic — explicit deny is checked first, not
last, precisely so it can short-circuit everything else. B is correct
and is the core rule underlying the entire evaluation order: deny
always wins, everywhere, unconditionally. C is too narrow — an
explicit deny can appear in identity-based policies, resource-based
policies, SCPs, or permissions boundaries, and wins regardless of
source. D is a fabricated mechanism with no basis in how IAM works.*

**9.** A company wants a central security team to guarantee that no
account in an OU can ever disable CloudTrail logging, even if an
individual account's administrator tries to. What is the correct
enforcement mechanism?

- A) An identity-based policy denying `cloudtrail:StopLogging`,
  attached to every IAM user in every account
- B) An SCP at the OU level denying `cloudtrail:StopLogging`, which
  applies as an un-overridable ceiling across every account/role in
  the OU **← correct**
- C) A permissions boundary on the root user of each account
- D) A resource-based policy on the CloudTrail trail itself

*A is fragile — it requires flawless per-account, per-user policy
hygiene and can be bypassed by any role that lacks the deny, or by an
administrator attaching a conflicting allow at a higher-privilege
role. B is correct — this is precisely the SCP's role: an org-wide
ceiling that no account-level identity policy, however permissive
(including `AdministratorAccess`), can override. C is not
applicable — permissions boundaries don't attach to the root user
concept this way and aren't org-wide. D is not how CloudTrail access
control works, and doesn't provide the org-wide guarantee required.*

**10.** Which access model does AWS currently recommend for human
users who need access across multiple AWS accounts in an organization?

- A) One IAM user created independently in each account
- B) IAM Identity Center with permission sets mapped per account **← correct**
- C) A shared IAM user whose credentials are distributed to every team
  member
- D) Root account credentials shared among trusted administrators

*A creates management overhead and credential sprawl across accounts.
B is correct — IAM Identity Center is the current AWS best practice
for centralized, federated, multi-account human access with
short-lived credentials. C is a severe security anti-pattern (shared
credentials, no individual accountability). D is one of the most
serious anti-patterns possible — root credentials should never be
used for day-to-day access, shared or otherwise.*

**11.** In the IAM policy evaluation order, at what point is a
resource-based policy (such as an S3 bucket policy) checked relative
to the identity-based policy?

- A) After the identity-based policy, and only if the identity-based
  policy already allowed the action
- B) Before the identity-based policy, and it can independently grant
  access even to a principal with no identity-based policy allowing
  it at all **← correct**
- C) Resource-based policies are never evaluated for same-account
  access, only cross-account
- D) Resource-based policies are merged into the identity-based policy
  and evaluated as a single document

*A reverses the order and adds an incorrect dependency — the
resource-based check doesn't require the identity policy to have
already allowed anything. B is correct — this is what makes
resource-based policies powerful for cross-account sharing: they can
grant access on their own, and are checked earlier in the sequence
(step 3, after SCPs). C is false — resource-based policies apply
within the same account too, though same-account access is often also
covered by the identity policy. D misdescribes IAM's architecture —
they remain separate documents evaluated independently, not merged.*

**12.** A data engineer wants to grant a role read-only access to
exactly one S3 prefix and nothing else in the bucket. Which is the
correct policy approach?

- A) Attach `AmazonS3ReadOnlyAccess` (AWS-managed)
- B) Attach a custom policy with `s3:GetObject`/`s3:ListBucket` scoped
  to that specific prefix's ARN pattern **← correct**
- C) Attach `AmazonS3FullAccess` and rely on the application code to
  only read that prefix
- D) Create an IAM group with no policies and expect implicit access

*A grants read access to every bucket the principal can otherwise
reach, not scoped to one prefix — broader than required. B is
correct — a custom policy with the `Resource` ARN scoped to the exact
prefix is the concrete implementation of "exactly this prefix and
nothing else." C is a serious anti-pattern — relying on application
code discipline instead of IAM enforcement provides no real security
boundary. D is nonsensical — no policy means no access under IAM's
default-deny posture, and groups don't provide implicit access.*

**13.** Why does AWS discourage storing long-lived IAM user access
keys in application code or environment variables, even if the code
repository is private?

- A) Long-lived keys expire automatically after 24 hours regardless of
  storage location
- B) A leaked long-lived key remains valid indefinitely until manually
  rotated or revoked, unlike a role's short-lived STS credentials
  which auto-expire, bounding the exposure window **← correct**
- C) Environment variables cannot store credentials of any kind on AWS
- D) Access keys stored in code automatically trigger AWS to disable
  the account

*A is false — IAM user access keys do not auto-expire; they remain
valid until explicitly rotated or deleted, which is exactly the risk.
B is correct — this is the core reasoning behind "roles over users":
the blast radius of a leaked credential is fundamentally different
depending on whether it expires in minutes/hours (role/STS) or
persists indefinitely (long-lived user key). C is false — environment
variables can technically store anything, including keys; the concern
is a security practice, not a technical restriction. D is
fabricated — AWS does not automatically detect and disable accounts
for this.*

**14.** A permissions boundary attached to a role allows only
`s3:GetObject` and `s3:ListBucket`. The role's identity-based policy
separately grants `s3:*` (including delete and put) on the same
resources. What can the role actually do?

- A) Everything in `s3:*`, because the identity-based policy is more
  specific
- B) Only `s3:GetObject` and `s3:ListBucket` — the effective
  permission is the intersection of the identity policy and the
  boundary, and the boundary caps it **← correct**
- C) Nothing at all, because the two policies conflict and IAM
  defaults to full deny on any conflict
- D) Whichever policy was attached most recently takes precedence

*A misunderstands how boundaries work — "more specific" isn't the
deciding factor; the boundary is a hard ceiling regardless of what the
identity policy grants. B is correct — this is the exact mechanical
purpose of a permissions boundary: the effective permission set is
the intersection, never the union, of the identity policy and the
boundary. C incorrectly assumes any mismatch causes total denial —
IAM doesn't work that way; the intersection logic simply narrows what
is allowed. D is not how IAM evaluates boundaries and policies —
there's no "most recent wins" rule.*

**15.** Which scenario correctly illustrates why "the identity-based
policy is correct" is not sufficient to guarantee a request succeeds?

- A) The request also needs to pass network-layer checks like security
  groups, which are unrelated to IAM entirely
- B) An SCP ceiling, a permissions boundary ceiling, or a required
  resource-based policy (e.g., a KMS key policy) could each
  independently block the request even with a fully correct identity
  policy **← correct**
- C) Identity-based policies are advisory only and require a separate
  manual approval step to take effect
- D) IAM policies take up to 24 hours to propagate, so "correct" today
  may not be active yet

*A is a true but separate point (network reachability is indeed a
distinct concern from IAM) and doesn't address the IAM-internal
reasons a correct identity policy alone isn't sufficient. B is
correct — this file's entire evaluation-order discussion demonstrates
exactly this: SCPs, permissions boundaries, and resource-based
policies (like KMS key policies) are all independent gates that a
correct identity-based policy does not automatically satisfy. C is
false — identity-based policies are directly enforced, not advisory.
D is false — IAM policy changes are typically near-instant to a few
minutes at most for propagation, not 24 hours, and this isn't the
mechanism being tested by the scenario anyway.*
