# LAB-06 — Lake Formation Column-Level Grant and Verified Denial

> **Day 8 anchor lab.** The only lab in this series where the
> *expected, successful outcome* is a query that **fails**. If nothing
> gets denied, the lab hasn't worked — read that twice before you start.

---

## 1. Objective

This lab builds hands-on muscle memory for:

- **Domain 4, Task 4.2** — authorization mechanisms, specifically
  managing permissions through **Lake Formation** rather than raw IAM/
  S3 bucket policies, and the practical difference between the two
  models
- **Domain 4, Task 4.1** — IAM roles as the identity Lake Formation
  grants are attached to, and the trust-policy plumbing needed for a
  second principal to test denial
- The single most exam-relevant Lake Formation mechanic: **column-level
  and row-level fine-grained access control** enforced transparently
  through Athena/Redshift Spectrum — a capability plain S3 bucket
  policies and IAM alone cannot deliver, because IAM/S3 permissions are
  all-or-nothing at the object level, not the column level

By the end you will have two IAM identities querying the *same* Athena
table — one that can see a sensitive column, one that cannot — and
you'll have watched the denial happen for yourself instead of taking
it on faith.

---

## 2. Prerequisites

- **LAB-01 completed** (or equivalent): an S3 dataset with a Glue
  Catalog table. This lab reuses that `orders` table pattern, extended
  with one sensitive-looking column (`customer_email`).
- **Lake Formation must be the account's active permission model** for
  the target database/table — if your account still has the legacy
  "IAM Access Control Only" default enabled for the Glue Catalog
  (common on older accounts), Lake Formation grants have no effect
  until you switch it (Step 1 covers this).
- Ability to create a **second IAM role/user** for testing denial —
  you cannot verify a deny with only one identity that already has
  admin access.
- IAM permissions: Lake Formation admin rights (to register the S3
  location and grant permissions), IAM permissions to create a role/
  user.

---

## 3. Estimated cost

| Resource | Cost driver | Estimate |
|---|---|---|
| Lake Formation | No charge for the service itself — permissions and tagging are free | $0 |
| Athena queries (both identities) | $5/TB scanned, 10 MB minimum | A few cents |
| S3 / Glue Catalog | Reused/minimal new data | Effectively $0 |
| **Total** | | **Under $0.20** |

**How to avoid surprise charges:** this is one of the cheapest labs in
the series — the only real cost is trivial Athena query scanning.
The thing to be careful about instead is **not accidentally granting
broad "Super" permissions to test principals** while troubleshooting a
denial that isn't working as expected — that's a security hygiene
issue, not a cost issue, but it defeats the point of the lab if you
"fix" a denial by over-granting rather than understanding why it
happened.

---

## 4. Step-by-step instructions

### Step 1 — Confirm/switch to Lake Formation permission model

**Console:** **Lake Formation → Administration → Data catalog
settings.**
- Check whether **"Use only IAM access control for new databases and
  tables"** is checked. If it is, Lake Formation grants on new
  resources will be bypassed entirely (IAM alone governs access) —
  **uncheck it** for this lab so Lake Formation permissions actually
  apply to the database you'll use.
- Under the same settings page, add yourself (your current IAM
  principal) as a **Lake Formation administrator** if not already
  listed — required to register locations and grant permissions in
  the next steps.

### Step 2 — Register the S3 location with Lake Formation

**Console:** **Lake Formation → Administration → Data lake locations →
Register location.**
- Amazon S3 path: `s3://dea-lab06-.../` (create this bucket first if
  starting fresh, or point at your existing LAB-01 bucket's path).
- IAM role: use the default `AWSServiceRoleForLakeFormationDataAccess`
  or a custom registration role with S3 access to this path.

**CLI equivalent:**
```bash
aws lakeformation register-resource \
  --resource-arn arn:aws:s3:::dea-lab06-nk-.../ \
  --use-service-linked-role
```

### Step 3 — Create the database and table with a sensitive column

If reusing LAB-01's `orders` table, add a column via **Glue → Tables →
orders → Edit schema** → add `customer_email` (type `string`). If
building fresh, create a small CSV with this schema and crawl it (same
pattern as LAB-01 Steps 2–6):

```csv
order_id,customer_id,customer_email,order_date,amount,status
1001,C001,alice@example.com,2024-01-05,129.99,SHIPPED
1002,C002,bob@example.com,2024-01-12,54.50,SHIPPED
```

Database: `dea_lab06_db`, table: `orders`.

**Important:** once a database is under Lake Formation governance
(Step 1), even the **table creator/owner** needs explicit Lake
Formation grants to query it going forward — this trips people up
immediately, so don't be surprised if your own queries start failing
here too until Step 4/5 grant you access explicitly.

### Step 4 — Create a second IAM role to test denial

**Console:** **IAM → Roles → Create role.**
- Trusted entity: your own AWS account (so you can assume it via
  `sts assume-role` or console role-switching for testing).
- Name: `dea-lab06-restricted-analyst`.
- Attach `AmazonAthenaFullAccess` (needed to *run* Athena queries at
  all — this is separate from and does not grant Lake Formation
  *data* access) and S3 access to the Athena query-results bucket only
  (not the data bucket — Lake Formation, not S3 permissions, will
  govern data access for this role).

**Trust policy** (so you personally can assume it for testing):
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"AWS": "arn:aws:iam::<account-id>:root"},
    "Action": "sts:AssumeRole"
  }]
}
```

### Step 5 — Grant column-level Lake Formation permissions

**Console:** **Lake Formation → Data lake permissions → Grant.**
- Principal: `dea-lab06-restricted-analyst` role.
- LF-Tags or named resource: named resource → database
  `dea_lab06_db`, table `orders`.
- **Columns**: choose **"Include columns"** and select everything
  **except** `customer_email` (or choose **"Exclude columns"** and
  list just `customer_email` — same result, opposite selection
  method).
- Table permissions: **Select**.
- Grant.

**CLI equivalent:**
```bash
aws lakeformation grant-permissions \
  --principal DataLakePrincipal={DataLakePrincipalIdentifier=arn:aws:iam::<account-id>:role/dea-lab06-restricted-analyst} \
  --resource '{
    "TableWithColumns": {
      "DatabaseName": "dea_lab06_db",
      "Name": "orders",
      "ColumnWildcard": {"ExcludedColumnNames": ["customer_email"]}
    }
  }' \
  --permissions "SELECT"
```

Also grant this role `DESCRIBE` on the database itself (**Lake
Formation → Grant → database-level → Describe**) — without it, the
role can't even see the database exists in Athena's catalog browser.

### Step 6 — Query as the restricted role and confirm partial access

**Console:** Switch role (IAM console → your username → **Switch
role** → account ID + role name `dea-lab06-restricted-analyst`), or
assume it via CLI:
```bash
aws sts assume-role \
  --role-arn arn:aws:iam::<account-id>:role/dea-lab06-restricted-analyst \
  --role-session-name lab06-test
```
Export the returned temporary credentials, then open Athena (or run
`aws athena start-query-execution` with those credentials).

Run:
```sql
SELECT order_id, customer_id, amount, status FROM dea_lab06_db.orders;
```
**Expected:** succeeds, returns rows.

### Step 7 — Attempt to query the restricted column and confirm denial

```sql
SELECT * FROM dea_lab06_db.orders;
```
**Expected:** this **fails** — either the query errors outright citing
insufficient permissions on `customer_email`, or (depending on Athena
engine behavior) the column is simply excluded from what the query
planner will allow, producing a permissions error rather than
returning masked/null data. Also explicitly try:
```sql
SELECT customer_email FROM dea_lab06_db.orders;
```
**Expected:** explicit access-denied error naming the column.

This denial **is the successful outcome of the lab.** If this query
instead succeeds and returns email addresses, something upstream is
wrong — go to Common Errors below before continuing.

### Step 8 — Confirm your own (admin) identity still sees everything

Switch back to your primary identity and re-run
`SELECT * FROM dea_lab06_db.orders;` — should return all columns
including `customer_email`, proving the restriction is scoped to the
specific principal, not the table globally.

---

## 5. Validation checkpoints

| Checkpoint | How to verify | Expected result |
|---|---|---|
| Lake Formation governs the database | Data catalog settings | "IAM access control only" unchecked for this database |
| S3 location registered | Lake Formation → Data lake locations | Bucket path listed |
| Table exists with sensitive column | Glue → Tables → `orders` | Includes `customer_email` |
| Restricted role created | IAM → Roles | `dea-lab06-restricted-analyst` exists with correct trust policy |
| Column-level grant applied | Lake Formation → Permissions | Role shown with `SELECT` on all columns except `customer_email` |
| Restricted role: allowed columns query | Step 6 query as restricted role | Succeeds, returns rows without `customer_email` |
| Restricted role: denied column query | Step 7 query as restricted role | **Fails** with an access-denied / insufficient-permissions error naming the column or table |
| Admin identity unaffected | Step 8 query as primary identity | Full row including `customer_email` returned |

---

## 6. Common errors and fixes

1. **Restricted role's query in Step 6 fails entirely, even for the
   permitted columns, with "Insufficient permissions to execute the
   query" or "Permission denied on database."**
   *Cause:* Missing the **database-level `DESCRIBE`** grant mentioned
   at the end of Step 5 — Select on the table isn't enough if the
   principal can't even resolve the database in the catalog. *Fix:*
   Grant `DESCRIBE` at the database level to the restricted role in
   addition to the column-level `SELECT`.

2. **Step 7's `SELECT *` unexpectedly *succeeds* and returns
   `customer_email` data to the restricted role — the "should fail"
   step doesn't fail.**
   *Cause (most common):* "Use only IAM access control" was still
   checked for this database (Step 1 not applied correctly), so Lake
   Formation grants are bypassed entirely and the role's broad
   `AmazonAthenaFullAccess`/underlying S3 permissions govern access
   instead. *Fix:* Revisit **Data catalog settings**, uncheck IAM-only
   access control for `dea_lab06_db` specifically (per-database
   override is also possible under **Databases → Edit**), then re-test.
   *Cause (secondary):* the restricted role also has a broad IAM
   policy (e.g., `AmazonS3FullAccess`) attached that grants direct S3
   access to the underlying data files, which lets Athena (in some
   configurations) or direct S3 access bypass Lake Formation's
   column filtering. *Fix:* Remove broad S3 permissions from the
   restricted role; it should rely entirely on Lake Formation's
   own request-time credential vending, not standing IAM S3 access.

3. **`AccessDeniedException: User is not authorized to perform:
   lakeformation:GrantPermissions`** when trying to grant in Step 5.
   *Cause:* Your own principal isn't registered as a Lake Formation
   administrator (Step 1's second bullet was skipped). *Fix:* Add
   yourself under **Administrative roles and tasks** in Lake Formation
   settings, then retry the grant.

4. **Switching roles in Step 6 fails with "You must be logged in as
   an IAM user or role to switch roles" or the trust policy rejects
   the assume-role call.**
   *Cause:* The trust policy in Step 4 has a typo in the account ID,
   or you're attempting to switch from a role that isn't itself an IAM
   user/role with permission to `sts:AssumeRole` on the target.
   *Fix:* Double-check the account ID in the trust policy exactly, and
   confirm your primary identity has `sts:AssumeRole` allowed (either
   via an explicit policy statement or because you're an account-root/
   admin identity for which this is typically unrestricted).

5. **The registration step (Step 2) fails with `Amazon S3 location is
   already registered with a different role` or similar.**
   *Cause:* The bucket (or a parent/child prefix of it) was already
   registered — often left over from an earlier, incomplete attempt at
   this lab. *Fix:* **Lake Formation → Data lake locations** → find
   the existing registration → deregister it, then register fresh with
   the intended role.

---

## 7. Cleanup steps

1. **Revoke Lake Formation grants** (optional if deleting the database
   next, but tidy):
   ```bash
   aws lakeformation revoke-permissions \
     --principal DataLakePrincipal={DataLakePrincipalIdentifier=arn:aws:iam::<account-id>:role/dea-lab06-restricted-analyst} \
     --resource '{"TableWithColumns":{"DatabaseName":"dea_lab06_db","Name":"orders","ColumnWildcard":{"ExcludedColumnNames":["customer_email"]}}}' \
     --permissions "SELECT"
   ```
2. **Delete the IAM test role:**
   ```bash
   aws iam delete-role --role-name dea-lab06-restricted-analyst
   ```
   (Detach any managed policies first if deletion fails.)
3. **Deregister the S3 location:** **Lake Formation → Data lake
   locations → select → Deregister.**
4. **Delete the Glue database/table:**
   ```bash
   aws glue delete-database --name dea_lab06_db
   ```
5. **Empty and delete the S3 bucket:**
   ```bash
   aws s3 rm s3://dea-lab06-nk-.../ --recursive
   aws s3api delete-bucket --bucket dea-lab06-nk-...
   ```
6. **Optional — restore prior catalog settings:** if you unchecked
   "IAM access control only" purely for this lab and your account
   normally relies on it elsewhere, consider whether to re-check it
   (understand the blast radius first — it affects new databases/
   tables account-wide, not just this lab's database, depending on
   scope settings).
7. **Verify:** attempt to assume `dea-lab06-restricted-analyst` again
   — should fail (role no longer exists), confirming cleanup completed.

---

## 8. What you learned

This lab directly reinforces:

- **4.2** — Lake Formation as a **data-level** authorization layer
  distinct from and layered on top of IAM identity permissions;
  column-level and (by extension) row/cell-level access control that
  plain S3 bucket policies structurally cannot express (S3 permissions
  are object-level, not column-level — there is no way to give
  someone half a Parquet file via S3 policy alone)
  

- **4.1** — the practical mechanics of testing authorization with a
  second, deliberately limited IAM role rather than assuming your own
  admin access represents what a real restricted user experiences
- The exam trap this lab reproduces directly in Common Error #2:
  Lake Formation grants are **silently ignored** if the database/table
  is still under **"IAM access control only"** — a scenario the exam
  loves to describe as "we set up Lake Formation permissions but users
  can still see everything" and expects you to diagnose as the
  IAM-access-control-only setting, not a grant syntax error

### Practice questions

**Q1.** A company configures Lake Formation column-level permissions
to hide a `salary` column from most analysts, but testing reveals
every analyst can still see the column when querying via Athena. What
is the most likely root cause?

- A. Lake Formation column-level permissions are not supported in
  Athena, only in Redshift Spectrum.
- B. The database/table is still under "Use only IAM access control,"
  which causes Lake Formation grants to be bypassed in favor of the
  underlying IAM/S3 permissions.
- C. The analysts' IAM roles have MFA disabled, which is a Lake
  Formation grant prerequisite.
- D. Column-level permissions require the table to be in Apache
  Iceberg format; plain Parquet tables ignore column grants.

> **Answer: B.** This is exactly Common Error #2 of the lab — the
> single most common reason Lake Formation grants appear to have no
> effect. A is false — column-level permissions are fully supported in
> Athena; that's the core mechanism this lab demonstrates. C is a
> fabricated requirement; MFA is unrelated to Lake Formation grant
> enforcement. D is false — Lake Formation column filtering works on
> standard Hive-style Parquet/CSV/ORC tables, not just Iceberg.

**Q2.** Why does this lab require creating a *second* IAM role rather
than testing the denial using the same identity that created the
table and granted the permissions?

- A. Lake Formation grants only take effect for roles created after
  the grant, so a pre-existing identity could never be restricted.
- B. The table creator/owner's identity typically retains broad or
  administrative access; testing a restriction meaningfully requires a
  principal that has been granted *only* the narrower permission set
  you intend to verify, otherwise you cannot distinguish "the
  restriction works" from "I happen to have access anyway."
- C. AWS technically prevents the same IAM identity from being both a
  Lake Formation grantor and grantee.
- D. Athena requires a distinct IAM role per query for caching reasons
  unrelated to Lake Formation.

> **Answer: B.** This is a basic but frequently-skipped testing
> discipline point — you can't validate a deny with an identity that
> has other paths to access. A is false — grant timing relative to
> role creation isn't the mechanism; it's about what permissions the
> testing identity actually holds. C is false — no such restriction
> exists; an admin can grant permissions to themselves. D is
> fabricated and unrelated to Lake Formation.

**Q3.** In Step 5, the grant excludes `customer_email` via
`ColumnWildcard` with `ExcludedColumnNames`. What would happen instead
if the grant had been made at the **table level with full `SELECT`**
(no column restriction) rather than column-level?

- A. Nothing different — Lake Formation always enforces column-level
  security by default regardless of grant scope.
- B. The restricted role would be able to see all columns including
  `customer_email`, since a table-level SELECT grant with no column
  restriction imposes no column-level filtering.
- C. A table-level grant is invalid syntax and Lake Formation would
  reject the grant request outright.
- D. Table-level grants only work for Redshift Spectrum, not Athena.

> **Answer: B.** Column-level restriction is opt-in via explicitly
> scoping the grant to specific columns (include or exclude list) —
> without that scoping, a table-level SELECT grant is exactly what it
> sounds like: full column access. A is false — column filtering isn't
> automatic; it must be explicitly configured as this lab did. C is
> false — table-level grants are a completely standard, valid Lake
> Formation permission type. D is false — table-level grants work
> identically for both Athena and Redshift Spectrum consumers.

**Q4.** A restricted analyst reports that `SELECT customer_id, amount
FROM orders` works fine, but `SELECT * FROM orders` fails. Why is this
the expected and correct behavior given this lab's grant configuration?

- A. `SELECT *` is categorically unsupported by Lake Formation
  regardless of permissions.
- B. `SELECT *` attempts to retrieve every column including the
  excluded `customer_email`, which the principal has no grant for; an
  explicit column list that only names permitted columns succeeds
  because it never references the restricted column at all.
- C. This indicates a misconfiguration — both queries should behave
  identically under Lake Formation.
- D. `SELECT *` fails only due to an unrelated Athena engine version
  limitation, not the Lake Formation grant.

> **Answer: B.** This is exactly Steps 6–7's observed behavior and the
> intuitive mental model for column-level grants: an explicit column
> list respecting the grant boundary works; a wildcard that would
> cross that boundary is rejected. A is false — `SELECT *` is normal,
> supported SQL; it just triggers the restriction because of which
> columns it resolves to. C is false — this is the *expected*,
> correctly-working behavior, not a misconfiguration. D is a
> distractor introducing an unrelated, fabricated cause.

**Q5.** Why can't the same outcome (hiding `customer_email` from
specific users) be achieved reliably using only an S3 bucket policy
that restricts access to the underlying Parquet/CSV objects?

- A. S3 bucket policies cannot reference IAM role ARNs as principals.
- B. S3 permissions operate at the object (file) level, not inside a
  file's column structure — an S3 policy can grant or deny access to
  an entire object, but has no mechanism to permit reading some
  columns of a file while denying others; that granularity requires a
  layer (Lake Formation) that understands table/column schema, not
  just object keys.
- C. S3 bucket policies are deprecated and no longer enforced for
  Athena-queried data.
- D. Athena ignores S3 bucket policies entirely, making them
  irrelevant to this scenario regardless of granularity.

> **Answer: B.** This is the core conceptual reason Lake Formation
> exists as a distinct authorization layer above raw S3/IAM — it's
> schema-aware, S3 is not. A is false — S3 bucket policies routinely
> reference IAM role ARNs as principals; that's standard usage. C is
> false — S3 bucket policies are fully supported and commonly used
> today. D is false — Athena's underlying data access does interact
> with S3 permissions (via Lake Formation's temporary credential
> vending or direct IAM, depending on configuration); the point isn't
> that S3 policies are ignored, it's that they're the wrong tool for
> column-level granularity.
