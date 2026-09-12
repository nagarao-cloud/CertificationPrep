# Design Interviews — Security, Compliance and Isolation

> Seventeen whiteboard questions on the *threat and obligation* axis:
> can you satisfy an auditor and an attacker at once? Written for Staff
> and Principal Cloud Architect interviews in the 2026 market, not for
> exam prep. `design-01` owns the structure — hierarchy, folders,
> network topology, who can create what. This file owns what gets laid
> over that structure: perimeters, keys, classification, detection and
> evidence.

**How to use this file:** answer out loud before reading past the
clarifying-questions block. Security answers fail in interviews for a
specific reason — candidates list controls instead of selecting them,
and a list is not a design. The tradeoff table's last column is where
selection becomes visible: if you cannot say when your own control is
the wrong one, you named it rather than chose it. The org hierarchy,
naming and tenancy tiers referenced throughout are `design-01`'s; this
file assumes them and does not redesign them. Underlying control
matrices live in `03-comparisons/06-iam-security-models.md` and are
deliberately not restated here.

## Question index

| ID | Question | Band | Axis | Domain leaves |
|---|---|---|---|---|
| D4-Q01 | HIPAA posture for a multi-national health-records SaaS platform | Staff+ | threat + obligation | 3.2, 3.1 |
| D4-Q02 | PCI-DSS scope isolation when most of the platform isn't in scope | Staff | threat + obligation | 3.2, 3.1 |
| D4-Q03 | VPC Service Controls perimeter topology across 200 projects | Staff+ | threat + obligation | 3.1, 2.1 |
| D4-Q04 | Encryption-key architecture — default, CMEK, CSEK, EKM by data class | Staff | threat + obligation | 3.1, 3.2 |
| D4-Q05 | Secret distribution and rotation for 300 services, zero exported keys | Staff | threat + obligation | 3.1, 2.3 |
| D4-Q06 | Workload identity for on-prem workloads and third-party CI | Staff+ | threat + obligation | 3.1, 2.1 |
| D4-Q07 | Supply chain — provenance, Binary Authorization, and break-glass | Staff+ | threat + obligation | 3.1, 5.2 |
| D4-Q08 | Security Command Center as a detection layer that produces action | Staff+ | threat + obligation | 3.1, 6.1 |
| D4-Q09 | Access surface for an AI workload and a third-party AI partner | Staff+ | threat + obligation | 3.1, 3.2 |
| D4-Q10 | Data classification and DLP where teams create their own datasets | Staff | threat + obligation | 3.1, 3.2 |
| D4-Q11 | Audit-logging and evidence architecture that survives a real auditor | Staff+ | threat + obligation | 3.2, 6.1 |
| D4-Q12 | Zero-trust access to internal applications, replacing the VPN | Staff | threat + obligation | 3.1, 2.1 |
| D4-Q13 | Separation of duties — nobody both deploys and approves in production | Staff+ | threat + obligation | 3.1, 5.2 |
| D4-Q14 | Sovereign deployment for a government customer (Assured Workloads) | Staff+ | threat + obligation | 3.2, 1.3 |
| D4-Q15 | Containing a compromised service account in minutes | Staff+ | threat + obligation | 3.1, 6.1 |
| D4-Q16 | Vendor needs the data and must never touch the network | Staff | threat + obligation | 3.1, 3.2 |
| D4-Q17 | Guardrails versus gates — security engineers don't route around | Principal | threat + obligation | 3.1, 4.2 |

---

### D4-Q01 — "We're a SaaS platform holding protected health information for hospitals in three countries. Design the security and compliance posture."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 3.2, 3.1 |
| **Axis** | threat + obligation |
| **Whiteboard time** | 45–55 min |
| **Reads well after** | `D1-Q01`, `D1-Q10` |

**What the interviewer is actually testing**

Whether you can turn a regulation into controls without either
under-reading it (encryption and a policy document) or over-reading it
(every control everywhere, forever). The specific skill is scoping:
naming which systems are in the regulated boundary, which are
deliberately outside it, and what keeps the boundary from leaking.

**Clarifying questions to ask before drawing anything**

- **Which entity is the covered entity and which is the business
  associate?** We're almost certainly the business associate, and that
  changes what we owe — we inherit obligations by contract, per
  hospital, and I need to know whether those contracts are uniform or
  negotiated individually.
- **Does protected health information leave the production path at
  all?** Support tooling, analytics, model training and test fixtures
  are where regulated data actually leaks. If the answer is "sometimes,
  informally," that's the first thing I'd fix.
- **Are Germany and Japan residency obligations, or just customer
  preference?** Residency changes the design from one platform with
  regional storage to `design-01`'s T4 tier with region-pinned keys and
  a separate pipeline. Preference doesn't.
- **What has an auditor already asked us for, and did we pass?** A
  prior audit finding is the most reliable requirements document in the
  room and costs nothing to ask for.
- **Is there a breach-notification clock in any of these contracts?**
  A seventy-two-hour clock is an architecture requirement, not a legal
  one — it dictates how fast the evidence in `D4-Q11` can be queried.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| We are a business associate under contract | Assumed | "I'll assume we sign agreements with each hospital rather than being the covered entity ourselves" | Obligations arrive per-customer, so the boundary must be per-tenant-aware |
| Regulated data is confined to labelled projects | Assumed | "I want one data class that means regulated, and nothing regulated outside projects carrying it" | Makes the perimeter and key scope derivable rather than curated |
| Germany and Japan require in-region storage | Stated | — | Forces `design-01`'s T4 tier for those tenants, not a global pool |
| Access to records must be attributable to a person | Assumed | "I'll assume we must show which human read which record, not just which service" | Data Access logs on the record store become mandatory, not optional |
| Google personnel access must be visible | Assumed | "I'll assume the contract asks about vendor-side access too" | Access Transparency is in scope, not just our own audit logs |
| Breach notification inside seventy-two hours | Assumed | "I'll assume a hard clock — it sets the evidence-query requirement" | Evidence must be queryable in hours, which rules out cold archives only |

**The answer, out loud**

I'd start by drawing the boundary before drawing any control, because
the most expensive mistake here is treating the whole platform as
regulated. If every project is in scope, every engineer needs training,
every change needs evidence, and the compliance cost scales with the
company rather than with the regulated workload. So the first thing I
do is declare a data class — regulated — and commit that protected
health information exists only in projects carrying that label, which
is one of the mandatory labels the platform already enforces at
creation.

That declaration is worthless unless something enforces it, and that's
the second layer: a VPC Service Controls perimeter containing exactly
the regulated projects. The perimeter is what makes the boundary real
rather than aspirational, because it stops a legitimately authenticated
engineer with valid permissions from moving records into an unregulated
project. That's the threat I actually care about here — not an attacker
breaking authentication, but a developer copying a production table
into a debugging dataset because it was the fastest way to reproduce a
bug. IAM does not stop that, because the person genuinely has read
access. The perimeter does. Perimeter topology is `D4-Q03`.

Third is key custody. Regulated data gets customer-managed keys from
`prj-common-kms`, with a key ring per region, because the ability to
destroy a key is the only revocation mechanism that works after data
has already been replicated. For the German and Japanese tenants, the
key ring is in-region and the tenant sits in `design-01`'s T4 tier —
region-pinned resource locations, in-region key ring, separate deploy
pipeline. I would not reach for external key management here. It buys
the claim that key material never touches Google's infrastructure, and
no health-information regime I'd expect to meet actually asks for that;
it adds a network round trip to every cryptographic operation and a
new availability dependency I'd have to defend in the reliability
review. `D4-Q04` is the full key argument.

Fourth is evidence, and this is where most designs are thin. Admin
Activity logs are always on and that's the easy half. The hard half is
Data Access logs, which are opt-in, expensive at volume, and the only
thing that answers "who read this patient's record." I'd enable them on
the record store and the record-serving API specifically, and nowhere
else, because enabling them everywhere produces a bill nobody defends
and a haystack nobody searches. Access Transparency goes on for the
regulated projects so we can answer the vendor-access question in the
contract. All of it lands in `prj-common-logging` via an org sink the
workload teams cannot alter, with a locked retention bucket. That's
`D4-Q11`.

Fifth, and the part I'd raise unprompted: de-identification as an
architectural relief valve. Most of the demand to take records out of
the regulated boundary is legitimate — analytics, support reproduction,
testing. Rather than fighting each request, I'd build one supported
path that runs the data through de-identification and lands the output
in a non-regulated project. The tokenization technique matters here:
if analytics needs to join across records, a consistent token beats
redaction, because redaction breaks the join and teams then ask for the
raw data back. `D4-Q10` covers classification and the scanning that
verifies it.

What I'd flag as deliberately out of scope on day one: a formal
certification programme, and per-hospital control variation. The
platform gets one regulated posture that is at least as strict as the
strictest contract, and per-tenant variation only where a contract
names something the baseline genuinely doesn't cover. Negotiating
sixty different control sets is how a compliance programme becomes
unmaintainable within two years.

**Architecture**

```
        hospital tenants (US)   (DE)   (JP)
              │                 │       │
              ▼                 ▼       ▼
   ┌──────────────────────────────────────────────┐
   │  REGULATED PERIMETER  (VPC Service Controls)  │ ◄── (1)
   │                                                │
   │  prj-<t>-records-prod    prj-<t>-api-prod      │
   │   data-class=regulated    data-class=regulated │
   │        │                        │              │
   │        ▼                        ▼              │
   │  record store  ◄── (2)    record API  ◄── (3)  │
   │  CMEK, regional            Data Access logs ON │
   └───────┬─────────────────────────┬─────────────┘
           │ egress rule, one path   │
           ▼                         ▼
   ┌────────────────┐        ┌──────────────────┐
   │ de-identify    │ ◄──(4) │ prj-common-logging│ ◄── (5)
   │ (DLP, tokenize)│        │ locked retention  │
   └───────┬────────┘        └──────────────────┘
           ▼
   ┌────────────────────────────┐
   │ analytics / test fixtures   │ ◄── (6)
   │ data-class=internal         │
   │ OUTSIDE the perimeter       │
   └────────────────────────────┘

   Cross-cutting: DE and JP tenants run as design-01 T4 — resource
   locations pinned and an in-region key ring in prj-common-kms (7);
   Access Transparency enabled on every regulated project so
   vendor-side access is answerable (8); one org-level sink writes the
   evidence and no workload team holds a role that can change it (9).
```

**Every arrow explained:**

1. **The regulated perimeter** — membership is derived from the
   `data-class` label, not curated by hand. The wrong alternative is a
   perimeter someone maintains as a list, which drifts the first time a
   project is created on a Friday.
2. **CMEK on the record store** — customer-managed keys so revocation
   exists as a lever after replication. Default Google-managed keys
   would satisfy encryption-at-rest but leave no destruction control,
   which is what tenant offboarding actually needs.
3. **Data Access logs on the record API only** — the one place the
   "who read this record" question is answerable. Enabling them
   platform-wide is the common over-correction; it produces volume
   nobody queries and a cost nobody defends.
4. **De-identification as the only supported exit** — one path out of
   the perimeter, through transformation. Without it, teams invent
   their own exits and the perimeter becomes theatre.
5. **Evidence sink outside the perimeter's write path** — logs land in
   a project no workload team can touch, so a compromised regulated
   project cannot erase its own trail.
6. **Analytics deliberately outside** — keeping analytics unregulated
   is the point of de-identification. Dragging it inside the perimeter
   would double the scope for no risk reduction.
7. **T4 for DE and JP** — residency handled by the tenancy tier, not
   by a bespoke architecture per country; see `D1-Q10`.
8. **Access Transparency** — answers the contractual question about
   vendor personnel access, which our own audit logs structurally
   cannot.
9. **Immutable org sink** — defined above every project so that
   deleting a project does not delete its own evidence.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Regulated scope | One labelled class inside a perimeter | Treat the whole platform as in scope | Compliance cost scales with the regulated workload, not with headcount | When regulated data genuinely touches every service — then a uniform posture is cheaper than proving a boundary that isn't real |
| Key custody | CMEK in a regional key ring | External key management | Revocation and rotation control without a new latency and availability dependency | When a contract or sovereignty regime states key material must never reside in Google's infrastructure — then external key management is the only answer |
| Data Access logs | Enabled on the record store and API only | Enabled org-wide | Produces the one query an investigator needs without burying it | When an auditor has specifically required full data-access coverage across a defined estate, and the cost is already accepted |
| De-identification | A supported path out of the perimeter | Deny all extraction | Legitimate needs get a route, so the perimeter keeps its credibility | When the regime forbids derived data leaving the boundary at all — then analytics moves inside and pays the scope cost |
| Per-tenant control variation | One posture at the strictest level | Negotiate controls per hospital | One posture is provable; sixty are not maintainable | When a single very large tenant's contract mandates a control the baseline doesn't have — then that tenant is promoted to a dedicated tier |

**What a weak answer sounds like**

- "Everything is encrypted, and we have a compliance policy." —
  encryption at rest is on by default and is not the answer to any
  question a panel is asking; the missing content is scope, evidence
  and revocation.
- "We'd use Assured Workloads for HIPAA." — reaching for a compliance
  package before establishing what the boundary is. It's a reasonable
  tool for named sovereignty regimes (`D4-Q14`), and it does not
  substitute for knowing which projects hold records.
- "We restrict access with IAM roles." — IAM governs whether a
  credential may act, not where authorized data may travel. Saying this
  alone signals you haven't separated the two threat models.
- "Compliance is handled by the security team." — the panel wants an
  architecture, and this answer says there isn't one.

**Common wrong turns**

- **Listing controls instead of scoping them.** The answer becomes a
  services inventory. Recover by drawing the boundary first and then
  attaching exactly the controls that boundary needs.
- **Over-reaching to external key management.** It sounds maximally
  secure and costs latency, availability and operational burden.
  Recover by asking what the contract actually says about key material.
- **Forgetting the non-production copies.** Regulated data reaches
  staging through a restore or a test fixture more often than through
  an attack. Recover by naming the de-identification path explicitly.
- **Designing evidence last.** Audit logging is the one control that
  cannot be backfilled, because the evidence you needed is the evidence
  you didn't collect. Recover immediately if you notice mid-answer.

**Follow-up probes the interviewer asks next**

1. **"A hospital terminates. Prove their data is gone."** — per-tenant
   key destruction for a dedicated-tier tenant makes the ciphertext
   permanently unreadable, and the deletion certificate is the key
   destruction record plus the storage deletion log. For pooled
   tenants, it's row deletion plus the audit trail, which is a weaker
   claim, and I'd say so rather than overstate it (`D1-Q15`).
2. **"Escalate: our record API is compromised. What's the blast
   radius?"** — every record that identity could read, which is why
   the perimeter matters more than the credential: exfiltration to an
   outside project is blocked even with a valid token. Containment
   sequence is `D4-Q15`.
3. **"An engineer needs production data to debug a patient-facing
   bug at 2am."** — the de-identified path if it reproduces, and a
   break-glass grant with a clock and a page if it doesn't. What I
   won't do is grant standing production read to on-call.
4. **"Who owns this in two years?"** — a compliance engineering
   function jointly with platform, with the control-to-obligation
   mapping as the shared artifact. If security owns it alone the
   control set only grows; if platform owns it alone the obligations
   go unread.
5. **"Japan's regulator asks a question the German one never did.
   What breaks?"** — nothing structural, because residency is handled
   by the tenancy tier. What changes is evidence: I'd expect a new
   query, not a new architecture, and if it needs a new architecture
   then my classification was too coarse.
6. **"What would you cut with six weeks instead of six months?"** —
   the perimeter, the label enforcement, CMEK on the record store and
   the evidence sink. I'd defer de-identification tooling and run
   extraction requests manually, because that's the only piece that
   can be retrofitted without moving data.

**Cross-references**

- `04-architectures/case-study-ehr-healthcare.md` — the multi-national
  regulated SaaS profile and its constraint ranking; don't re-derive.
- `03-comparisons/06-iam-security-models.md` — the encryption control
  matrix backs the CMEK-over-external-key-management call.
- `D4-Q03` perimeter topology, `D4-Q04` keys, `D4-Q10`
  classification, `D4-Q11` evidence, `D1-Q10` residency.

---

### D4-Q02 — "We take card payments in one corner of the product. The rest of the platform has nothing to do with it. How do you keep PCI scope small?"

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 3.2, 3.1 |
| **Axis** | threat + obligation |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D4-Q01` |

**What the interviewer is actually testing**

Whether you understand that scope is a design variable. A weak
candidate secures the payment flow. A strong one shrinks the set of
systems that are subject to the standard at all, and can say exactly
which architectural decision moved a system out of scope and what
proves it stayed out.

**Clarifying questions to ask before drawing anything**

- **Do we ever hold the primary account number, or does a processor
  tokenize it before it reaches us?** This single answer determines
  whether we have a cardholder data environment or merely a system that
  handles tokens, and the difference is most of the compliance cost.
- **Does the card form render on our page or the processor's?** An
  embedded form the processor hosts keeps our web tier out of scope; a
  form we render and post pulls it in.
- **Who is the acquirer and what validation level are we?** The level
  determines whether we self-assess or face an external assessor, which
  determines how much evidence automation is worth building.
- **Is there any batch or reconciliation path that touches card
  numbers?** Reconciliation files are the classic quiet path that drags
  a data warehouse into scope after everyone declared the web tier
  clean.
- **Does support ever see a full card number?** If a support tool can
  display one, support tooling and the people using it are in scope,
  and that's usually a surprise.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Most of the platform is out of scope | Stated | — | The whole design is about making that claim provable |
| A processor tokenizes before we store | Assumed | "I'll assume we can push tokenization to the processor; if we can't, the design gets much heavier" | Determines whether a cardholder data environment exists at all |
| Card data never reaches analytics | Assumed | "I'll assume no card number in the warehouse, ever, and I'd enforce rather than trust that" | Drives an egress rule and a scanning check |
| Scope boundary must be demonstrable | Assumed | "An assessor will ask what prevents scope creep, not what our policy says" | Turns the boundary into a perimeter plus evidence |
| Segmentation must be tested | Assumed | "I'll assume periodic segmentation testing is required" | The boundary needs to be probeable from outside |

**The answer, out loud**

I'd open by saying the goal is not to secure the payment path — it's
to make the payment path the only thing that has to be secured to that
standard. Every system I can keep out of scope is a system that doesn't
need quarterly scanning, doesn't need its change control evidenced to
an assessor, and doesn't need its engineers in the compliance
programme. Scope minimisation is the design.

The single highest-leverage decision is whether we ever hold a primary
account number. If the processor's hosted form collects the card and
returns a token, our servers never see the number, and a large majority
of the platform falls out of scope by construction rather than by
control. I would push hard for that even at the cost of some checkout
customisation, because the alternative buys us a cardholder data
environment we then pay for forever. If the business insists on a
fully custom checkout, I'd say plainly that the decision costs us a
regulated enclave and I'd want that tradeoff recorded, not assumed.

Assuming we accept tokenization, there is still a small enclave: the
service that talks to the processor, the token vault mapping our
customer to the processor's token, and the reconciliation job. I'd put
that enclave in its own team folder under `fldr-prod` with its own
projects, its own service accounts, its own key ring, and its own VPC
Service Controls perimeter. Not a shared perimeter with the rest of
production — a separate one, because the entire value of the enclave is
that its membership is small enough to enumerate to an assessor on one
page.

The boundary has exactly two doorways and I'd defend both explicitly.
Inbound, the rest of the platform can call the payment service's API
and receive a token and a status, nothing else — no query interface,
no bulk export. Outbound, the enclave reaches the processor over a
single egress rule to a named destination and nothing else. Everything
else is denied by the perimeter. The reconciliation job runs inside the
enclave and publishes a de-identified summary outward, rather than
publishing raw files that the warehouse then has to be trusted not to
join against.

The part that fails in practice is scope creep through convenience. Six
months in, someone adds a support screen that displays a masked card,
and a year in someone unmasks it for a dispute. So I'd add two
enforcement points beyond the perimeter. First, a detection rule that
scans outbound datasets for card-number patterns and fires a finding —
that's `D4-Q08`'s routing, and it exists because a control that only
prevents cannot tell you that someone tried. Second, the enclave's IAM
is a separate group set with its own review cycle, so membership growth
is visible rather than inherited.

On evidence: I'd want the enclave's project membership, its perimeter
definition, its IAM bindings and its key inventory all generated from
code and queryable, because an assessor's real question is not "is this
secure today" but "show me this was the boundary for the last twelve
months." That's the same evidence architecture as `D4-Q11`, scoped to a
handful of projects, which is precisely why keeping the enclave small
was worth the effort.

**Architecture**

```
   ┌────────────────────────────────────────────────┐
   │  THE REST OF THE PLATFORM  (out of scope)       │
   │  web tier, product services, analytics          │
   └───────────────┬────────────────────────────────┘
                   │ (1) one API call in:
                   │     token + status out
                   ▼
   ╔════════════════════════════════════════════════╗
   ║  CARDHOLDER ENCLAVE — own perimeter  ◄── (2)    ║
   ║  fldr-prod-payments                             ║
   ║                                                 ║
   ║   prj-payments-svc-prod   prj-payments-vault-   ║
   ║          │                       prod           ║
   ║          │                        │             ║
   ║          ▼                        ▼             ║
   ║   payment service        token vault  ◄── (3)   ║
   ║          │               own key ring           ║
   ║          │                                      ║
   ║   reconciliation job ◄── (4)                    ║
   ║          │                                      ║
   ╚══════════╪═════════════════════╪════════════════╝
              │ (5) egress rule     │ (6) de-identified
              ▼  one destination    ▼  summary only
      ┌───────────────┐      ┌──────────────────┐
      │  processor    │      │  finance dataset  │
      └───────────────┘      │  out of scope     │
                             └──────────────────┘

   Cross-cutting: hosted payment form means the primary account number
   never reaches our web tier at all, which is what puts it out of
   scope by construction (7); a scanning rule on out-of-scope datasets
   detects card-pattern leakage and routes a finding (8); enclave IAM
   is its own group set with its own review cycle, so membership growth
   is visible (9).
```

**Every arrow explained:**

1. **One inbound API** — the rest of the platform gets a token and a
   status, never a query surface. The wrong alternative is exposing the
   vault's read API internally, which quietly pulls every caller into
   the conversation about scope.
2. **A separate perimeter, not a shared one** — the enclave's value is
   that its membership fits on a page. Folding it into the production
   perimeter makes every production project part of the assessor's
   question.
3. **Own key ring** — enclave keys are separate from the platform key
   ring so that key-level IAM and rotation evidence are scoped to the
   enclave rather than entangled with everything else (`D4-Q04`).
4. **Reconciliation inside** — the job that reads raw processor output
   runs in the enclave. Running it outside is the most common way a
   data warehouse silently enters scope.
5. **Single egress destination** — the perimeter permits the processor
   and nothing else, so a compromised payment service has nowhere to
   send data.
6. **De-identified summary outward** — finance gets amounts and
   statuses, not identifiers, so the finance dataset stays out of
   scope.
7. **Hosted form** — the decision that removes the web tier from scope
   entirely. Every control below it is cheaper because of this one
   choice.
8. **Leak detection on out-of-scope data** — prevention alone can't
   tell you someone tried; the finding is what starts the conversation
   before an assessor starts it for you.
9. **Separate IAM group set** — enclave access is granted, reviewed and
   revoked on its own cycle rather than inherited from a platform-wide
   role.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Card capture | Processor-hosted form, token returned | Custom checkout posting to our servers | Removes the entire web tier from scope by construction, not by control | When checkout conversion depends on a custom flow the processor cannot host — then accept the enclave and budget for it consciously |
| Enclave perimeter | Its own VPC-SC perimeter | Include the enclave in the production perimeter | Membership stays small enough to enumerate and prove | When the enclave has heavy legitimate traffic with the rest of production and bridge rules would outnumber the projects they connect |
| Reconciliation | Runs inside, publishes summaries | Raw files to the warehouse, masked later | Masking after landing means the warehouse already held the data | When the processor only delivers raw files to a location the enclave cannot reach — then the landing zone itself joins the enclave |
| Leak control | Perimeter plus pattern detection | Perimeter alone | Detection tells you about attempts and near misses the perimeter silently ate | When detection would surface so many false positives that the finding queue trains people to ignore it |
| Access model | Separate group set, own review cycle | Reuse platform roles with a condition | Membership is visible as a number someone can be asked about | When the enclave is operated by the same handful of people as everything else and a separate cycle is pure overhead |

**What a weak answer sounds like**

- "We'd encrypt card data and restrict access." — this is the answer
  to a different question. The panel is asking about scope, and this
  reply assumes we should hold card data at all.
- "We'd use a dedicated project for payments." — a project is not a
  boundary until something enforces what crosses it; without the
  perimeter and the two doorways it's a naming convention.
- "Compliance will tell us what's in scope." — the architect decides
  what's in scope by deciding where data flows. Outsourcing that is
  how the warehouse ends up in the assessment.
- "We'd mask card numbers in the warehouse." — masking after landing
  means the warehouse received them, and receipt is what puts it in
  scope.

**Common wrong turns**

- **Securing the flow instead of shrinking it.** Every control gets
  proposed and none of them reduce the assessed footprint. Recover by
  asking whether we need to hold the number at all.
- **One perimeter for all of production.** It feels tidier and it makes
  every production project part of the scope conversation. Recover by
  splitting the enclave out while still drawing.
- **Forgetting support tooling.** A screen that can display a full card
  number puts the tool and its users in scope. Recover by naming the
  support path explicitly and masking at the source.
- **Treating the boundary as permanent once drawn.** Scope creeps
  through small conveniences. Recover by adding the detection rule and
  the separate access review.

**Follow-up probes the interviewer asks next**

1. **"An assessor asks how you know the boundary held all year."** —
   the perimeter definition and enclave membership are in version
   control with history, the audit sink shows every IAM change on those
   projects, and the leak-detection findings show what was attempted.
   Point-in-time screenshots don't answer this question.
2. **"Escalate: the payment service is compromised. Now what?"** —
   the attacker has the enclave's reach, which is the processor and
   nothing else; they cannot pivot into the platform because the
   perimeter blocks it and cannot exfiltrate because the egress rule
   names one destination. Containment is `D4-Q15`.
3. **"Product wants a custom checkout for conversion. Your answer?"** —
   I'd quantify what it costs us qualitatively: a real cardholder data
   environment, our web tier in scope, and an ongoing assessment burden
   that grows with the team. Then it's a business decision with the
   price visible, not an engineering veto.
4. **"How does this interact with the org's other perimeters?"** — the
   enclave perimeter stands alone; I would not bridge it to the
   regulated health perimeter even though both are restrictive, because
   bridges are how two small boundaries become one large one.
5. **"Who signs off that something is out of scope?"** — a named risk
   owner in the business, with the architect providing the data-flow
   evidence. If the architect signs it alone, the first disputed case
   becomes an argument rather than a decision.

**Cross-references**

- `D4-Q03` for perimeter topology and why enclaves stay unbridged.
- `D4-Q10` for the classification and scanning that detect leakage
  into out-of-scope datasets.
- `D1-Q03` for how an enclave-shaped folder fits the tenancy model.
- `03-comparisons/06-iam-security-models.md` — VPC-SC versus IAM
  versus firewall positioning is authoritative there.

---

### D4-Q03 — "We have about 200 projects and real reasons to move data between some of them. Design the VPC Service Controls topology."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 3.1, 2.1 |
| **Axis** | threat + obligation |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D4-Q01`, `D1-Q04` |

**What the interviewer is actually testing**

Whether you can design a perimeter that survives contact with
legitimate traffic. Anyone can wrap everything in one perimeter;
the design work is deciding how many perimeters there are, what
crosses them, and how a team gets a new exception without the
security team becoming a ticket queue.

**Clarifying questions to ask before drawing anything**

- **What is the actual exfiltration threat we're defending against?**
  Insider with valid credentials, compromised workload identity, or a
  misconfigured integration. They need different rules, and answering
  "all of them" produces a perimeter nobody can operate.
- **Which cross-project data flows exist today and are legitimate?** I
  need the real list before drawing, because every one of them becomes
  an explicit rule and the count tells me whether my perimeter shape is
  right.
- **Is there an existing perimeter in enforced mode?** Introducing
  enforcement onto live traffic without a dry-run period is how you
  take an outage, and I'd want to know whether that mistake has already
  been made.
- **Do we have workloads that legitimately call out to the public
  internet or a partner API?** Those need egress rules, and pretending
  they don't is how teams end up disabling the perimeter.
- **Who can create a perimeter exception, and how fast?** If it's a
  weekly change window, teams will route around the perimeter within a
  quarter.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Exfiltration by a valid identity is the threat | Assumed | "I'll assume the concern is authorized-credential misuse, not unauthorized access" | That's the only threat VPC-SC addresses; IAM covers the other |
| Legitimate cross-project flows exist | Stated | — | Forces ingress/egress rules or bridges rather than one flat perimeter |
| Rollout must not break production | Assumed | "Every perimeter change goes through dry-run before enforcement" | Makes dry-run a required stage in the pipeline |
| Perimeter membership derives from labels | Assumed | "I want membership generated, not curated, or it drifts" | Couples the perimeter to project vending |
| Exceptions must be fast | Assumed | "Slow exceptions produce shadow paths, so the request path has to be self-service with review" | Determines the change workflow, not just the policy |

**The answer, out loud**

I'd start with the number, because it's the decision everything else
hangs off. The two failure modes are one perimeter around everything,
which blocks nothing useful because all the interesting traffic is
internal to it, and a perimeter per project, which produces a rule set
larger than the estate and an operations burden that guarantees someone
disables it. I'd land on a small number — four or five — drawn around
data sensitivity rather than around teams or environments.

Concretely: a regulated perimeter for projects carrying the regulated
data class, a separate enclave perimeter for the payment environment,
one broad production perimeter for everything else in `fldr-prod`, and
a non-production perimeter that deliberately excludes dev. Dev sits
outside every perimeter and is forbidden from holding production data
by classification, which is the cheaper control than trying to
perimeter-protect an environment whose whole purpose is experimentation.

Membership is derived, not curated. A project's labels decide which
perimeter it joins, the vending process applies them, and the perimeter
definition is generated from that. The alternative — a human-maintained
list of project numbers — is the thing that breaks, because a project
created outside the process is a project outside the perimeter and
nobody notices until the audit.

Then the rules, and this is where the real design is. Between
perimeters I'd prefer explicit ingress and egress rules over bridges,
because a bridge makes two perimeters mutually reachable for the
services it covers, while a rule names a direction, a service, an
identity and a resource. Bridges are the right tool when two perimeters
genuinely operate as one for a broad set of services — a shared
analytics estate, say. They are the wrong tool for "the payments
service needs to write one summary to finance," which is a single
egress rule, and reaching for a bridge there quietly doubles the
reachable surface.

Egress to the outside world is the part teams actually get stuck on.
Any workload calling a partner API, pulling a public package, or
reaching a third-party service needs an egress rule or the perimeter
blocks it. I'd treat that as a first-class catalogue rather than a
series of surprises: a known set of approved external destinations,
each with an owner and a review date, and a self-service request that
adds one. If that request takes a week, teams will move the workload to
dev, and then dev has production data in it, which is a worse outcome
than the egress I was trying to control.

On rollout: every perimeter starts in dry-run, and I'd hold it there
long enough to see a full business cycle including month-end batch,
because the traffic that breaks is the traffic that runs monthly. The
dry-run violations are the requirements document for the rule set. Only
after that queue is empty do I enforce, and I enforce one perimeter at
a time.

Finally, the failure mode worth naming out loud: a perimeter fails
closed. A missing rule looks exactly like an outage, and it will be
reported as one at three in the morning by someone who has never heard
of VPC Service Controls. So the platform needs a clearly documented
signal — the denial appears in the policy-denied logs with the
perimeter and the service named — and on-call needs to know how to read
it. A control whose failure mode nobody recognises gets disabled during
the first incident.

**Architecture**

```
                  perimeter membership derived from labels  ◄── (1)
                                   │
   ┌───────────────────────────────┼───────────────────────────────┐
   ▼                               ▼                               ▼
╔══════════════════╗   ╔═══════════════════════╗   ╔══════════════════╗
║  REGULATED        ║   ║  PRODUCTION (broad)    ║   ║  PAYMENTS        ║
║  data-class=      ║   ║  everything else in    ║   ║  ENCLAVE         ║
║  regulated        ║   ║  fldr-prod             ║   ║  ◄── (3)         ║
╚════════╤═════════╝   ╚═══════╤═══════════════╝   ╚════════╤════════╝
         │                      │                             │
         │ (2) egress rule:     │ (4) egress catalogue:       │ (5) one
         │ de-identify job only │ approved external dests     │ destination
         ▼                      ▼                             ▼
   de-identified          partner / package               processor
   analytics              endpoints, each owned

         ╔════════════════════════════╗
         ║  NON-PRODUCTION             ║   fldr-dev sits OUTSIDE every
         ║  fldr-nonprod only  ◄── (6) ║   perimeter, by design  ◄── (7)
         ╚════════════════════════════╝

   Cross-cutting: every perimeter change enters dry-run first and holds
   through a full month-end cycle before enforcement (8); denials
   surface in policy-denied logs with perimeter and service named, and
   on-call is trained to read them (9); bridges are used only where two
   perimeters genuinely operate as one, never to satisfy a single flow
   (10).
```

**Every arrow explained:**

1. **Derived membership** — labels decide the perimeter, vending
   applies the labels. A hand-maintained project list drifts the first
   time someone creates a project out of band.
2. **Regulated egress to the de-identification job only** — the single
   supported way data leaves the regulated boundary, which is what
   makes `D4-Q01`'s analytics path legitimate rather than a hole.
3. **Payments as its own perimeter** — deliberately unbridged to the
   others; see `D4-Q02` for why the enclave's small membership is the
   whole point.
4. **Egress catalogue for production** — approved external
   destinations, each with an owner and a review date. Without a
   catalogue, every external call becomes an incident.
5. **Single processor destination** — the enclave reaches exactly one
   place, so a compromise has nowhere to send data.
6. **Non-production perimeter over `fldr-nonprod` only** — staging
   often holds restored or realistic data and deserves a boundary.
7. **Dev outside every perimeter** — controlled by classification
   instead. Perimeter-protecting an experimentation environment costs
   more friction than it removes risk.
8. **Dry-run through a full cycle** — monthly batch is the traffic that
   breaks, and it only appears once a month.
9. **Readable denials** — a fail-closed control whose failure mode
   on-call cannot recognise gets switched off during the first
   incident.
10. **Bridges used sparingly** — a bridge widens reachability for a set
    of services in both directions; a rule names one direction, one
    service and one identity.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Number of perimeters | Four or five, drawn by data sensitivity | One perimeter around the whole org | A single perimeter contains all the interesting traffic internally and therefore blocks almost nothing | When the org is small and all sensitive data genuinely lives together — then one perimeter is honest and cheap |
| Cross-perimeter access | Explicit ingress/egress rules | Perimeter bridges | A rule names direction, service, identity and resource; a bridge widens both sides | When two perimeters operate as one estate for a broad service set and enumerating rules would be unmaintainable |
| Membership | Derived from labels at vending time | Curated list maintained by security | Curated lists drift silently and the drift is invisible until audit | When the estate is small and static enough that a list is genuinely reviewable at a glance |
| Dev environment | Outside all perimeters, controlled by classification | Inside a dev perimeter | Perimeter friction in an experimentation environment produces workarounds, not safety | When dev legitimately holds restored production data and classification alone has already failed |
| External egress | A catalogue of approved destinations | Case-by-case approval per request | Predictable, reviewable, and fast enough that teams don't route around it | When external calls are genuinely rare and one-off, making a catalogue more ceremony than the requests justify |

**Making it concrete**

```hcl
# Egress from the regulated perimeter: one job, one destination
# service, one direction. Not a bridge.
resource "google_access_context_manager_service_perimeter" "regulated" {
  parent = "accessPolicies/POLICY_ID"
  name   = "accessPolicies/POLICY_ID/servicePerimeters/regulated"
  status {
    resources = ["projects/PROJECT_NUMBER"]
    restricted_services = ["storage.googleapis.com", "bigquery.googleapis.com"]
    egress_policies {
      egress_from { identities = ["serviceAccount:sa-deid-runner@PROJECT_ID.iam.gserviceaccount.com"] }
      egress_to {
        resources = ["projects/ANALYTICS_PROJECT_NUMBER"]
        operations { service_name = "bigquery.googleapis.com" }
      }
    }
  }
}
```

The identity is named, the destination is named, and the service is
named. That is the difference between an exception and a hole, and it's
the shape every cross-perimeter flow in the estate should take.

**What a weak answer sounds like**

- "We'd put a perimeter around everything." — the traffic you care
  about is then internal to the perimeter, so the control does almost
  nothing while still taking the operational cost.
- "VPC Service Controls replaces our IAM work." — it doesn't; it stops
  authorized data reaching unauthorized destinations. Least privilege
  is still a separate obligation.
- "We'd enable it and fix breakages as they come." — an enforced
  perimeter on live traffic without dry-run is a self-inflicted outage,
  and the panel is listening for whether you know dry-run exists.
- "Each project gets its own perimeter for maximum isolation." — the
  rule count exceeds the estate, and the first month-end incident ends
  with someone disabling the whole thing.

**Common wrong turns**

- **Designing the perimeter before listing real data flows.** The rules
  end up being discovered in production. Recover by asking for the flow
  list before drawing anything.
- **Using a bridge to solve one flow.** It's the fastest fix and it
  widens the surface permanently. Recover by converting it to a
  directional rule while still at the whiteboard.
- **Forgetting egress to the public internet.** Package pulls and
  partner APIs break, teams blame the perimeter, and the perimeter
  loses credibility. Recover by naming the egress catalogue.
- **Not planning for the fail-closed signal.** On-call sees an outage,
  not a policy denial. Recover by describing what the denial looks like
  in logs and who reads it.

**Follow-up probes the interviewer asks next**

1. **"A team says the perimeter broke their pipeline. Walk me
   through the first five minutes."** — read the policy-denied log,
   identify the perimeter, service and identity, decide whether the
   flow is legitimate, and if so add a scoped egress rule through the
   normal change path. If it's urgent and legitimate, the break-glass
   variant is a time-boxed rule that auto-expires.
2. **"Escalate: an engineer's credentials are stolen. What does the
   perimeter buy you?"** — the attacker can read what that identity
   could read, but cannot move it to a project outside the perimeter,
   which converts a catastrophic exfiltration into a contained access
   incident. That is the entire value proposition.
3. **"How does this scale from 200 projects to 1,000?"** — the
   perimeter count doesn't grow, because it's drawn on sensitivity, not
   on projects. What grows is the rule set and the egress catalogue, so
   I'd invest in generating rules from declared dependencies well
   before then.
4. **"Who owns the egress catalogue in two years?"** — security
   architecture owns the review, platform owns the mechanism, and each
   destination has a named requesting team. A catalogue with no per-
   entry owner becomes an allow-list nobody can prune.
5. **"What would make you recommend against VPC Service Controls?"** —
   an estate where every workload legitimately talks to many external
   services and no data is especially sensitive. There the rule
   maintenance exceeds the risk reduction, and I'd spend the effort on
   classification and detection instead.
6. **"How do you prove to an auditor the perimeter was on?"** — the
   perimeter definition's version history plus the policy-denied log
   stream. Current state is not evidence of continuous state, and
   that's the distinction `D4-Q11` is built around.

**Cross-references**

- `02-services/04-security-iam.md` — VPC Service Controls
  configuration surface and dry-run behaviour.
- `03-comparisons/06-iam-security-models.md` — the VPC-SC versus IAM
  versus firewall near-miss table.
- `D1-Q04` for the underlying network topology these perimeters sit
  over; `D4-Q02` for the payments enclave; `D4-Q09` for the AI
  serving perimeter.

---

### D4-Q04 — "Design the encryption-key architecture. When is a Google-managed key enough, and when isn't it?"

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 3.1, 3.2 |
| **Axis** | threat + obligation |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D4-Q01` |

**What the interviewer is actually testing**

Whether you can resist the gravitational pull toward maximum key
control. The interesting answer is not "we use customer-managed keys
everywhere," it's a per-data-class mapping where most classes
deliberately stay on the default, and a clear statement of what each
escalation buys and what it costs in operations and availability.

**Clarifying questions to ask before drawing anything**

- **What does the obligation actually say about keys?** There's a large
  gap between "data must be encrypted at rest," which is already true
  by default, and "the customer must be able to revoke access to their
  data unilaterally," which is a real design requirement.
- **Is there a tenant-level revocation requirement?** If a customer can
  demand provable destruction, per-tenant keys become the mechanism and
  that shapes the key ring layout, not just the key choice.
- **How many regions, and are any of them residency-bound?** Key rings
  are regional; a residency obligation means an in-region key ring and
  that interacts with the tenancy tier.
- **Who operates key rotation today, and do they have an on-call?** Key
  management is an availability dependency. If nobody owns it at 3am,
  escalating key control is escalating outage risk.
- **Has anyone promised an auditor something about key material?** If a
  prior statement says keys never reside with the provider, that's a
  commitment and it narrows the options to one.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Data classes already exist | Assumed | "I'll assume the mandatory `data-class` label is in place; if not, that's prerequisite work" | The key mapping is per class, so classification must come first |
| Regulated data needs revocability | Assumed | "I'll assume we must be able to render data unreadable on demand" | Rules out relying on the default key for that class |
| Most data has no key requirement | Assumed | "I'll assume the majority of the estate has no obligation beyond encryption at rest" | Keeps the default as the default rather than an exception |
| Some tenants require dedicated keys | Stated | — | Per-tenant keys in the dedicated tier, not shared platform keys |
| Key operations must not be a single point of failure | Assumed | "Key availability becomes workload availability; I'd want that stated" | Drives regional key ring placement and the argument against external keys |

**The answer, out loud**

I'd frame this as four levels and make the case that most of the estate
should sit on level one, because every step up buys a specific control
and charges a specific operational tax.

Level one is Google-managed keys, which is the default and is already
strong encryption at rest. I'd use this for everything with no stated
key obligation — logs that aren't sensitive, build artifacts, internal
metrics, most application state. The reason to defend this actively is
that teams sometimes escalate out of habit, and every key we manage is
a key we have to rotate, monitor and keep available. The control we
give up is destruction-based revocation, which for this class we don't
need.

Level two is customer-managed keys through the key management service,
and this is where regulated and confidential data sits. What it buys is
three things: a rotation schedule we control, key-level access control
separate from data-level access control, and crypto-shredding —
destroying the key makes the ciphertext permanently unreadable, which
is the only deletion proof that survives replication and backups. That
last one is why `D1-Q15`'s tenant offboarding works at all. What it
costs is that the key becomes an availability dependency: if the key is
disabled or the key ring's region is unavailable, the data is
unreadable, which is precisely the property we asked for.

Level three is customer-supplied keys, where we hand the key material
with each operation and nothing is stored. I'd reach for this almost
never. It's narrow — a specific object or a specific export where the
key genuinely must not be retained anywhere — and the operational
burden is that every future read needs the key resupplied, which means
building key distribution ourselves. If a team asks for this, my first
question is whether customer-managed keys with tight key-level access
control satisfies the underlying requirement, and it usually does.

Level four is external key management, where the key material lives
outside the provider entirely and is referenced at use time. This is
the sovereignty answer and only the sovereignty answer: the requirement
is literally that key material must never reside in the provider's
infrastructure. It buys the strongest possible custody claim. It costs
a network round trip on cryptographic operations, an external key
system we now have to run at the availability level of the workloads
depending on it, and a new failure mode where our own key
infrastructure can take down production. I'd only propose it against a
written obligation, and I'd pair it with `D4-Q14`'s sovereign tier
because that's where such obligations live.

On layout: key rings live in `prj-common-kms`, one ring per region, and
keys are named by data class and tenant where tenancy applies. The
platform team holds the administrative role on the ring; workload
service accounts hold only the encrypt and decrypt role on their
specific key. That split is the actual security property — the person
who can use a key to read data is not the person who can destroy it,
and neither of them is the person who can grant that right to someone
else. Rotation is scheduled and automatic for level two; old key
versions stay available for decrypting existing ciphertext, so rotation
is not a re-encryption event.

One thing I'd say unprompted: a key hierarchy is a reliability design
as much as a security design. Before I finalise this I want to know
what happens if a key ring's region has a bad day, and I want that in
the disaster recovery plan rather than discovered during one.

**Architecture**

```
   data-class label on the project/dataset  ◄── (1)
            │
    ┌───────┼─────────────┬──────────────┬───────────────┐
    ▼       ▼             ▼              ▼               ▼
 public  internal    confidential    regulated     sovereign
    │       │             │              │               │
    ▼       ▼             ▼              ▼               ▼
┌────────────────┐  ┌──────────────────────────┐  ┌──────────────┐
│ Google-managed │  │  CMEK — prj-common-kms    │  │ external key │
│ default ◄── (2)│  │  keyring per region ◄─(3) │  │ manager ◄(4) │
└────────────────┘  │  key per class/tenant     │  └──────┬───────┘
                    └────────┬─────────────────┘         │
                             │                            │
             ┌───────────────┴──────────┐                 │
             ▼                          ▼                 ▼
   encrypt/decrypt role          admin role on ring   round trip on
   on ONE key, held by           held by platform     every operation
   the workload SA ◄── (5)       team only  ◄── (6)   ◄── (7)

   Cross-cutting: destroying a tenant key is the deletion proof that
   survives replicas and backups, which is what makes offboarding
   provable (8); rotation is scheduled and old versions stay readable,
   so rotation is not a re-encryption event (9); every key ring is a
   regional availability dependency and belongs in the DR plan (10).
```

**Every arrow explained:**

1. **Class drives the key choice** — the mapping is from data class to
   key model, so a new project inherits its key posture from its label
   rather than from whoever provisioned it.
2. **Default for most of the estate** — defended actively, because
   escalating out of habit creates rotation and availability work with
   no obligation behind it.
3. **One key ring per region in the shared KMS project** — regional by
   nature; a multi-region workload needs a deliberate decision, not an
   accident of where the first key was made.
4. **External key manager only for sovereign** — reached for against a
   written obligation that key material must never reside with the
   provider, never as a general hardening step.
5. **Workload holds encrypt/decrypt on one key** — narrow enough that a
   compromised workload can read its own data and nothing else, and
   cannot destroy anything.
6. **Platform holds ring administration** — the separation between
   using a key and destroying one is the actual control; collapsing
   them means a compromised workload can crypto-shred production.
7. **External key round trip** — a latency and availability cost on
   every cryptographic operation, which is why this level is a
   sovereignty answer rather than a security-maximalism answer.
8. **Key destruction as deletion proof** — the only claim that holds
   once data has been replicated into backups; see `D1-Q15`.
9. **Scheduled rotation, versions retained** — rotation without
   re-encryption, which is what makes an aggressive rotation policy
   operationally affordable.
10. **Key rings in the DR plan** — a key ring outage is a data outage,
    and it must be rehearsed rather than discovered.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Default posture | Google-managed keys for unregulated classes | Customer-managed keys everywhere | Avoids rotation, monitoring and availability burden with no obligation behind it | When a single uniform posture is simpler to evidence than a per-class mapping and the estate is small |
| Regulated data | Customer-managed keys in a regional ring | External key management | Revocation and rotation control without a new latency path and external availability dependency | When a written obligation states key material must never reside in the provider's infrastructure |
| Per-object key supply | Not used | Customer-supplied keys | Requires building key distribution and re-supply for every future read | When a specific export or object genuinely must leave no retained key anywhere, for a bounded set of objects |
| Key-to-tenant mapping | Per-tenant keys for dedicated tiers only | Per-tenant keys for every tenant | Pooled tenants share a key because their deletion story is row-level anyway | When every tenant contractually requires independent crypto-shredding — then per-tenant keys go all the way down |
| Role split | Use and destroy held by different principals | One key-admin role for the owning team | A compromised workload cannot destroy the data it can read | When the team is the only operator and the split creates an on-call dependency that delays incident response |

**Making it concrete**

```hcl
# One key per data class per region. The workload SA can use it;
# only the platform team's group can administer or destroy it.
resource "google_kms_crypto_key" "regulated" {
  key_ring        = "projects/PROJECT_ID/locations/europe-west3/keyRings/kr-regulated"
  name            = "key-regulated-records"
  rotation_period = "7776000s"
}

resource "google_kms_crypto_key_iam_member" "workload_use" {
  crypto_key_id = google_kms_crypto_key.regulated.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:sa-records-api@PROJECT_ID.iam.gserviceaccount.com"
}
```

The workload gets exactly one verb on exactly one key. Every incident
where a compromised service deleted the data it was meant to protect
traces back to a design that skipped this split.

**What a weak answer sounds like**

- "We'd use customer-managed keys for everything to be safe." — every
  key becomes rotation work and an availability dependency; the panel
  wants to hear you defend the default for most classes.
- "External key management is the most secure, so we'd use that." —
  it's the strongest custody claim and the worst latency and
  availability profile, and it answers a sovereignty requirement
  nobody in this question stated.
- "The keys are managed by the security team." — that's an ownership
  statement, not an architecture; the panel wants the ring layout and
  the role split.
- "Rotation means re-encrypting all the data." — it doesn't, and
  saying so suggests you've never operated key versions.

**Common wrong turns**

- **Escalating without an obligation.** Every level up is proposed
  because it sounds stronger. Recover by asking what the requirement
  literally says about key custody.
- **Collapsing use and administration into one role.** It's convenient
  and it means a compromised workload can destroy production data.
  Recover by splitting the roles while still drawing.
- **Ignoring the regional nature of key rings.** A multi-region
  workload pinned to a single-region key ring has an undiscovered
  single point of failure. Recover by naming the DR implication.
- **Forgetting the reliability conversation.** Key architecture is
  presented as pure security, and then the first key outage is a
  surprise. Recover by putting key rings in the DR plan explicitly.

**Follow-up probes the interviewer asks next**

1. **"A key is disabled by mistake. What happens?"** — every workload
   depending on it fails to read data immediately, which is the
   property we designed for. Recovery is re-enabling the key version;
   destruction, unlike disabling, is not recoverable, which is why the
   destroy right sits with a small group and is logged loudly.
2. **"Escalate: the shared KMS project is compromised. Blast
   radius?"** — an attacker with administrative rights there could
   destroy keys and render encrypted data unreadable across every class
   using it. That's the argument for narrow administrative membership,
   strong detection on key destruction events, and considering separate
   rings per sensitivity tier so one compromise isn't total.
3. **"A tenant asks for their own key. Do you grant it?"** — for a
   dedicated-tier tenant, yes, and it's already the design. For a
   pooled tenant, no, and I'd explain that a per-tenant key on shared
   storage gives them the paperwork without the property, which is
   worse than an honest answer about row-level deletion.
4. **"How do you evidence rotation to an auditor?"** — the key's
   version history and the rotation schedule in version control. A
   screenshot of the current version proves today, not the year.
5. **"Who owns key management in two years?"** — platform engineering
   with security architecture setting the class-to-key mapping. If
   security owns the operation, key rotation becomes a ticket; if
   platform owns the policy, the mapping drifts toward convenience.

**Cross-references**

- `03-comparisons/06-iam-security-models.md` — the encryption control
  matrix is authoritative on the four models; this answer adds the
  per-class mapping and the role split.
- `02-services/04-security-iam.md` — key ring, rotation and hardware-
  backed key configuration surface.
- `D4-Q14` for the sovereign tier that justifies external keys;
  `D1-Q15` for offboarding and crypto-shredding.

---

### D4-Q05 — "Three hundred services need credentials, and the org policy forbids exported service-account keys. Design secret distribution and rotation."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 3.1, 2.3 |
| **Axis** | threat + obligation |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D4-Q06` |

**What the interviewer is actually testing**

Whether you can separate two problems that get conflated: proving who a
workload is, which should never involve a secret at all, and holding
secrets that genuinely exist because a third party issued them. The
second is the real design work, and rotation is where most answers stop
short.

**Clarifying questions to ask before drawing anything**

- **How many of these credentials are for our own services versus
  external ones?** Internal service-to-service authentication should
  need no secret at all. If the answer is "most of them are internal,"
  the design mostly deletes secrets rather than storing them.
- **Which secrets can we rotate unilaterally, and which require a
  third party to act?** A database password we rotate on our own
  schedule is a different problem from a partner API key that requires
  a support ticket to their team.
- **Do any workloads run outside Google Cloud?** On-prem and
  third-party continuous integration change the identity story, which
  is `D4-Q06`, and they also change where secrets land.
- **What happens today when someone leaves the team?** If the answer
  involves rotating shared credentials by hand, the current blast
  radius is every service that shares them.
- **Is there a residency obligation on the secret material itself?**
  Replication policy for secrets is a real decision when a regulator
  cares where the bytes sit.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| No exported service-account keys anywhere | Stated | — | Internal authentication must be keyless; the policy is already enforced org-wide |
| Some third-party credentials are unavoidable | Assumed | "There will always be a partner key we didn't issue and can't federate" | Secret Manager exists for exactly this residue |
| Rotation must not require a deploy | Assumed | "If rotating a secret needs a release, it won't happen on schedule" | Forces runtime fetch or a two-version overlap |
| Access is per-secret, not per-project | Assumed | "A project-wide grant on all secrets is the same as one shared password" | Determines the binding granularity |
| Every access is attributable | Assumed | "We must be able to say which workload read which secret when" | Data access logging on the secret store |

**The answer, out loud**

The first move is to shrink the problem, because most of these three
hundred credentials shouldn't exist. Service-to-service authentication
inside the platform uses the workload's own identity — a service
account attached to the workload, with tokens minted at runtime and
never materialised as a file. On Kubernetes that's the pod-to-service-
account binding; on serverless runtimes it's the attached identity.
Nothing is stored, nothing rotates, nothing leaks. The org policy that
forbids exported keys is what makes this non-negotiable, and that
constraint lives in `design-01`'s baseline. If a team says they need a
key file, the answer is almost always that they need a different
identity mechanism, not a safer place to put a key.

What's left after that subtraction is the genuine residue: credentials
a third party issued to us. Payment processor keys, partner API tokens,
database passwords for systems that don't support identity-based
authentication, signing certificates. That's the population Secret
Manager is for, and it's typically a tenth the size of the original
number, which is itself the headline of the answer.

For that residue, the design has four properties. Access is per-secret,
never project-wide — a grant on all secrets in a project is
functionally a shared password. The binding is to the workload's
service account, so the audit trail says which workload read which
secret, not which human. Secrets are fetched at runtime rather than
baked into images or configuration, because a secret in an image is a
secret you cannot rotate without a rebuild. And replication is
user-managed where a residency obligation applies to the secret
material, automatic everywhere else.

Rotation is where designs usually get vague, so I'd be concrete. The
pattern is two live versions, always. Rotation creates a new version,
consumers begin reading the new one, and only when every consumer has
been observed using it does the old version get disabled — disabled
first, destroyed later, so a mistake is recoverable. This works because
the consumer reads at runtime; if consumers cached at deploy time, the
overlap window would be a release cycle rather than minutes.

The hard case is the credential we cannot rotate unilaterally. A
partner key that requires their team to issue a new one has a rotation
latency measured in days, and pretending otherwise is how a rotation
policy becomes a fiction. I'd handle those explicitly: they're
inventoried as a separate class, with a named owner, a documented
rotation procedure including the partner's process, and a rotation
cadence that matches reality rather than the policy. They also get the
tightest access scope, because a credential we can't rotate quickly is
a credential whose compromise we can't contain quickly.

The last piece is detection, because prevention here is incomplete by
construction. Someone will paste a credential into a configuration file
or a repository. So the pipeline scans for credential patterns before
merge, and the platform detects secret access from unexpected
identities. That detection routes through `D4-Q08`. The reason I raise
it is that a secrets architecture with no detection assumes everyone
followed it, and the whole point of this design is not having to assume
that.

**Architecture**

```
   ┌──────────────────────────────────────────────────────┐
   │  STEP 1 — DELETE THE PROBLEM                          │
   │  internal service → service: attached identity,       │
   │  runtime tokens, nothing stored  ◄── (1)              │
   └───────────────────────┬──────────────────────────────┘
                           │ what remains
                           ▼
   ┌──────────────────────────────────────────────────────┐
   │  SECRET MANAGER  (prj-common-kms platform instance,   │
   │  plus per-team secrets in team projects)              │
   │                                                       │
   │   secret: partner-api-token                           │
   │     ├── version 7  (disabled, retained)   ◄── (2)     │
   │     ├── version 8  (enabled, draining)                │
   │     └── version 9  (enabled, current)                 │
   │                                                       │
   │   IAM: accessor role on THIS secret, bound to         │
   │        sa-<app>-<purpose>            ◄── (3)          │
   └───────┬──────────────────────────────┬───────────────┘
           │ (4) runtime fetch            │ (5) every access
           ▼                              ▼  logged, attributable
   ┌────────────────┐            ┌──────────────────────┐
   │ workload       │            │ prj-common-logging    │
   │ no secret in   │            └──────────────────────┘
   │ image or env   │
   └────────────────┘
           ▲
           │ (6) rotation job: add version → observe adoption
           │     → disable old → destroy later
   ┌───────┴────────────────────────────────────────┐
   │ un-rotatable third-party credentials: separate  │
   │ inventory, named owner, real cadence  ◄── (7)   │
   └────────────────────────────────────────────────┘

   Cross-cutting: pre-merge scanning catches credentials pasted into
   source before they land (8); secret access from an unexpected
   identity is a routed finding, not a log line (9).
```

**Every arrow explained:**

1. **Delete the problem first** — internal authentication uses attached
   workload identity, so the majority of the three hundred credentials
   cease to exist rather than being stored more carefully.
2. **Two live versions, disable before destroy** — the overlap is what
   makes rotation safe, and disabling rather than destroying makes a
   bad rotation recoverable.
3. **Per-secret binding to a workload identity** — a project-wide grant
   is a shared password with extra steps, and binding to a human makes
   the audit trail useless.
4. **Runtime fetch** — a secret baked into an image cannot be rotated
   without a rebuild, which turns a minutes-long rotation into a
   release cycle.
5. **Attributable access logging** — the question after an incident is
   which workload read the secret and when; without data access logging
   on the secret store there is no answer.
6. **Observe adoption before disabling** — rotation that disables on a
   timer instead of on evidence is how a rotation takes an outage.
7. **Un-rotatable credentials as their own class** — a partner key with
   a multi-day rotation path gets the tightest scope precisely because
   containment will be slow.
8. **Pre-merge credential scanning** — prevention is incomplete by
   construction; someone will paste a token, and catching it before
   merge is far cheaper than after.
9. **Anomalous access as a routed finding** — a secrets design with no
   detection assumes compliance with itself.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Internal service authentication | Attached workload identity, no secret | A shared credential in the secret store | A secret that doesn't exist cannot leak, rotate, or expire at a bad time | When a legacy internal service genuinely cannot use token-based authentication — then it is a third-party-shaped problem and joins the residue |
| Secret retrieval | Fetched at runtime | Injected at deploy time | Rotation completes in minutes without a release | When the runtime has no network path to the secret store at startup and a deploy-time injection is the only workable route |
| Access binding | Per-secret, per-workload identity | Project-level secret accessor role | Blast radius of one compromised workload is one secret | When a team has a handful of secrets all consumed by the same service and per-secret bindings are pure ceremony |
| Rotation trigger | Scheduled, with adoption observed before disabling | Rotate on a fixed timer and disable immediately | Avoids the classic rotation-induced outage from a straggling consumer | When a credential is known compromised — then immediate disable is correct and the outage is the lesser harm |
| Un-rotatable credentials | Separate inventory with a realistic cadence | Same policy as everything else | A policy nobody can meet is a policy nobody follows | When the partner can in fact rotate quickly and the exception was assumed rather than verified |

**Making it concrete**

```bash
# Rotation: add, observe, then disable. Never destroy in the same step.
gcloud secrets versions add partner-api-token \
  --project=PROJECT_ID --data-file=-

# ...consumers pick up `latest` on next fetch; confirm adoption from
# the secret's data-access log before touching the old version.

gcloud secrets versions disable 8 \
  --secret=partner-api-token --project=PROJECT_ID
```

Disable is reversible and destroy is not, so the two steps are
deliberately separated by an observation window rather than chained in
one script. Every rotation outage I have seen came from collapsing them.

**What a weak answer sounds like**

- "We'd store everything in a secrets manager." — correct and
  insufficient; the panel is listening for the subtraction step that
  removes most credentials entirely.
- "We'd rotate every ninety days." — a cadence is not a mechanism, and
  the follow-up about the partner key that takes a week to reissue has
  nowhere to go.
- "Each project gets a secret accessor role." — that is a shared
  password with a management interface in front of it.
- "We encrypt secrets in our configuration repository." — now the
  encryption key is the secret, and it lives wherever the pipeline can
  reach, which is everywhere.

**Common wrong turns**

- **Treating identity and secrets as one problem.** The answer becomes
  a storage design for credentials that shouldn't exist. Recover by
  splitting the two out loud.
- **Baking secrets into images for startup speed.** It works and it
  makes rotation a release. Recover by naming the runtime fetch.
- **Destroying the old version immediately.** The rotation looks clean
  until a consumer with a long cache fails at 2am. Recover by
  separating disable from destroy.
- **Assuming every secret is rotatable on our schedule.** The policy
  then quietly excludes the riskiest credentials. Recover by naming the
  un-rotatable class.

**Follow-up probes the interviewer asks next**

1. **"A credential leaks into a public repository. First hour."** —
   disable the version immediately rather than waiting for a clean
   rotation, issue a new version, and then work out the blast radius
   from the secret's access log. For an un-rotatable partner key,
   containment is revoking the workload's access and calling the
   partner, which is exactly why those are scoped tightest.
2. **"Escalate: the platform secrets project is compromised. What can
   the attacker reach?"** — every secret in it, which is the argument
   for team-owned secrets living in team projects rather than
   everything centralised, and for per-secret bindings so the blast
   radius of the consuming side stays narrow.
3. **"How do you prove no exported keys exist anywhere?"** — the org
   policy prevents creation, and a periodic query for existing key
   material in the estate catches anything created before the policy
   landed. Prevention plus a sweep, because the policy is not
   retroactive.
4. **"Three hundred services, one platform team. Who does rotations?"**
   — the owning team, with the platform providing the mechanism and
   the detection for overdue rotations. Central rotation for three
   hundred services is a queue with a person at the front of it.
5. **"What breaks first as this scales?"** — the un-rotatable
   inventory, because it grows with every partner integration and each
   entry carries manual process. I'd want that list reviewed as part of
   vendor onboarding rather than discovered during an incident.

**Cross-references**

- `02-services/04-security-iam.md` — Secret Manager versioning,
  replication and per-secret access model.
- `03-comparisons/06-iam-security-models.md` — the credential
  mechanism matrix backs the keyless-first argument.
- `D4-Q06` for how workloads outside Google Cloud get an identity;
  `D4-Q15` for containment when a credential is compromised.

---

### D4-Q06 — "Our on-prem batch jobs and our third-party CI system both need to call Google Cloud APIs. No keys. How?"

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 3.1, 2.1 |
| **Axis** | threat + obligation |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D4-Q05` |

**What the interviewer is actually testing**

Whether you can explain a token exchange precisely enough that the
panel believes you've operated one, and whether you know where the
trust actually sits. The common failure is describing federation as
magic; the strong answer names the identity provider, the attribute
mapping, the condition that narrows it, and what an attacker who
controls the provider could do.

**Clarifying questions to ask before drawing anything**

- **What identity does the on-prem workload already have?** If there's
  an existing identity provider issuing tokens, we federate it. If the
  workloads have no identity at all, that's the first problem and
  federation is the second.
- **Which continuous-integration platform, and does it issue workload
  tokens with repository and branch claims?** Those claims are the
  whole basis for narrowing access, and a provider without them gives
  us nothing to condition on.
- **Can anyone reachable by these workloads change their identity
  claims?** If a developer can make the provider assert any repository
  they like, the attribute condition is decorative.
- **What is the most dangerous thing any of these callers needs to
  do?** That determines the target service account's permissions, and
  the answer is usually narrower than the request.
- **Is there a network path requirement as well as an identity one?**
  Federation grants credentials, not network reachability to a private
  endpoint, and confusing the two wastes a day.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| No exported keys, anywhere | Stated | — | Federation is the only remaining option for external callers |
| The external provider issues signed tokens with claims | Assumed | "I'll assume the provider issues OIDC tokens carrying attributes we can condition on" | Without claims there is nothing to narrow the trust with |
| Access must be narrower than "this provider" | Assumed | "Trusting a whole CI platform is too broad; I want repository and branch in the condition" | Drives attribute conditions, not just a pool |
| Short-lived credentials only | Assumed | "Every exchanged credential should expire in minutes" | Limits the window a stolen token is useful |
| Every exchange is auditable | Assumed | "We must be able to trace a call back to the external identity that obtained it" | Determines what we log and what we alert on |

**The answer, out loud**

I'd describe this as a trust chain with four links, and be specific
about what breaks at each one, because the design's strength is exactly
the weakest link.

The first link is the external identity provider. For the continuous
integration platform, that's the platform's own token issuer, which
signs a short-lived token asserting facts about the job: which
repository, which branch or tag, which workflow. For the on-prem
workloads, it's whatever identity system already exists there — if
there's a provider issuing signed assertions, we federate it; if not,
the honest answer is that we have to give those workloads an identity
before we can federate one.

The second link is the workload identity pool and its provider
configuration. This is where we declare which external issuer we trust
and, critically, how its claims map onto attributes we can write
conditions against. The mistake that matters here is configuring the
provider with a trust relationship as wide as the issuer itself. That
means any job on that continuous-integration platform, in anyone's
repository, could exchange a token for our credentials. The condition
has to pin the specific organisation and repository, and for production
deploys the specific branch, so a fork or a pull request from an
untrusted contributor cannot satisfy it.

The third link is the exchange itself. The caller presents its
provider-issued token, the security token service validates the
signature against the issuer, evaluates the attribute condition, and
returns a short-lived federated credential. That credential then
impersonates a target service account whose permissions are what the
caller actually gets. I'd emphasise that the service account is where
the authorisation lives — the federation decides *whether* you may
impersonate, and the service account decides *what you can then do*.
Those are two separate narrowing opportunities and weak designs use
only one.

The fourth link is the target service account's permissions, and I'd
keep them narrow and purpose-specific. One service account per external
caller purpose, never a shared federation identity. The continuous-
integration deploy identity can deploy to a specific project; it cannot
read the data plane. The on-prem batch identity can write to one
storage prefix; it cannot list the bucket.

What fails, in order of likelihood: a provider condition that is too
broad, which is the one I'd audit first; a target service account with
inherited project-level roles rather than explicit narrow ones; and
compromise of the external provider itself, which is the residual risk
you cannot engineer away and should say out loud. If the continuous
integration platform is breached, our deploy path is breached, and the
mitigations are narrow scope, deploy-time attestation from `D4-Q07`,
and detection on unusual exchange patterns.

The last thing I'd add is that federation grants credentials, not
network reachability. An on-prem job calling a private endpoint still
needs the hybrid path and private access configured. Teams solve
identity and then lose a day to connectivity, so I'd name it early.

**Architecture**

```
  ON-PREM JOB / THIRD-PARTY CI                    GOOGLE CLOUD
  ───────────────────────────                     ─────────────

   (1) job starts; the platform's
       issuer mints a short-lived
       token with claims:
       repo=org/app, ref=main
              │
              ▼
   (2) job presents that token to
       the security token service ──────────►  (3) validate signature
                                                   against the trusted
                                                   issuer of the pool's
                                                   provider
                                                        │
                                                        ▼
                                               (4) evaluate attribute
                                                   condition:
                                                   assertion.repository
                                                   == "org/app" AND
                                                   assertion.ref ==
                                                   "refs/heads/main"
                                                        │
                          ◄─────────────────────────────┘
   (5) receive short-lived                              │ pass
       federated credential                             ▼
              │                                 (6) impersonate
              ▼                                     sa-deploy-cicd
   (7) call the API. Authorisation                     │
       is the service account's,                       ▼
       not the pool's                           (8) narrow roles on
                                                    ONE project only

   Cross-cutting: a failure at (3) means the issuer isn't trusted — a
   configuration error, not an attack; a failure at (4) is the control
   working, and it is the line that stops a fork or an unrelated
   repository (9); every exchange is logged with the external identity,
   so an unusual repository or branch appearing is a routed finding
   (10).
```

**Every arrow explained:**

1. **Provider mints a claim-bearing token** — the claims are the entire
   basis for narrowing. A provider that issues opaque tokens with no
   job context gives us nothing to condition on and should be treated
   as untrusted.
2. **The job presents, it does not hold** — no credential is stored
   anywhere; the token exists for the life of the job.
3. **Signature validation against the configured issuer** — this link
   fails when the pool provider is misconfigured, which presents as a
   permission error and is a configuration bug, not an attack.
4. **Attribute condition** — the load-bearing line. Trusting the issuer
   without pinning organisation, repository and branch means any job on
   that platform can obtain our credentials.
5. **Short-lived federated credential** — minutes, not hours, bounding
   the value of a stolen token.
6. **Impersonation of a purpose-specific service account** — one per
   external caller purpose; a shared federation identity destroys both
   least privilege and attribution.
7. **Authorisation comes from the service account** — federation
   decides whether you may impersonate; the service account decides
   what you can then do. Two separate narrowing points.
8. **Narrow roles on one project** — the deploy identity deploys and
   cannot read the data plane.
9. **A blocked condition is the control working** — the first time it
   fires, someone will file it as a platform bug.
10. **Exchange logging as a detection source** — an exchange from an
    unexpected repository is one of the highest-signal findings the
    estate produces.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| External caller credentials | Federated short-lived tokens | An exported key stored in the external system | No long-lived material to steal, and every exchange is attributable to the originating job | When a legacy system genuinely cannot present a signed token and there is no proxy that can do it for it — then a key, tightly scoped and monitored, under a recorded exception |
| Trust scope | Attribute condition pinning org, repo and branch | Trust the identity provider broadly | Stops a fork, a pull request, or an unrelated repository from obtaining credentials | When the provider is a private, single-tenant issuer where the issuer itself is already the narrow boundary |
| Identity per caller | One service account per external purpose | One shared federation service account | Blast radius and attribution both scope to the purpose | When there is exactly one external caller and the extra identity is pure overhead |
| On-prem identity | Federate the existing provider | Run a proxy service in the cloud that authenticates on-prem callers | Keeps authorisation decisions in one place and avoids a bespoke gateway | When on-prem has no usable identity provider at all — then a narrow authenticating proxy is the pragmatic bridge |
| Deploy branch pinning | Required for production targets | Pin only the repository | Pull-request builds should never reach production credentials | When deploys are gated elsewhere by attestation and branch pinning would block a legitimate release-branch workflow |

**Making it concrete**

```hcl
# The attribute condition is the control. Without it, any job on the
# provider's platform can exchange a token for our credentials.
resource "google_iam_workload_identity_pool_provider" "ci" {
  project                            = "PROJECT_ID"
  workload_identity_pool_id          = "pool-external-ci"
  workload_identity_pool_provider_id = "prov-ci"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  attribute_condition = "attribute.repository == 'ORG/APP' && attribute.ref == 'refs/heads/main'"

  oidc { issuer_uri = "https://token.example-ci.invalid" }
}
```

Every review of a federation setup should start at
`attribute_condition`. A pool with a mapping and no condition is a
trust relationship with an entire platform.

**What a weak answer sounds like**

- "We'd use workload identity federation." — naming the mechanism is
  not the design; the panel wants the attribute condition and the
  target identity's scope.
- "We'd create a service account key and store it securely in the CI
  system." — the question forbade it, and storing it securely is what
  everyone believed before every key leak.
- "The pipeline authenticates with our identity provider, so it's
  trusted." — trusted to be that platform, not to be our repository on
  our branch, which is the distinction that matters.
- "Federation gives the pipeline access to our VPC." — it grants
  credentials, not network reachability; conflating the two shows the
  model isn't clear.

**Common wrong turns**

- **Configuring the pool without an attribute condition.** It works
  immediately, which is why it survives review. Recover by adding the
  condition before moving on.
- **One shared federation identity for all external callers.**
  Attribution and least privilege both collapse. Recover by splitting
  per purpose while drawing.
- **Granting the target service account project-level roles.** It
  removes a class of debugging and it means a compromised pipeline
  reads the data plane. Recover by naming explicit narrow roles.
- **Forgetting connectivity.** Identity is solved and the call still
  fails against a private endpoint. Recover by naming the hybrid path
  requirement out loud.

**Follow-up probes the interviewer asks next**

1. **"Someone forks the repository and runs the workflow. What
   happens?"** — the fork's token carries a different repository claim,
   the attribute condition fails, and no credential is issued. If the
   condition had only pinned the platform, the fork would have
   succeeded, which is the whole reason the condition exists.
2. **"Escalate: the continuous-integration platform itself is
   breached. Blast radius?"** — our deploy path, bounded by the target
   service account's roles and by deploy-time attestation from
   `D4-Q07`. This is residual risk that federation reduces but does not
   remove, and I'd say so rather than claim otherwise.
3. **"How do you detect misuse?"** — exchange events carry the external
   identity, so a token exchange from an unexpected repository, branch
   or time window is a high-signal finding and routes through
   `D4-Q08`. This is one of the few detections I'd page on.
4. **"A team wants federation for a partner's system. Same design?"** —
   same mechanism, different governance: a partner's issuer is outside
   our control, so the target identity is narrower still and the
   arrangement gets a review date. That's `D4-Q16`.
5. **"Who maintains the pool configuration in two years?"** — platform
   engineering owns the pools, the requesting team owns its provider's
   condition, and security architecture reviews conditions on a cycle.
   Nobody should be able to widen a condition without a review, because
   widening is invisible in behaviour until it's exploited.

**Cross-references**

- `03-comparisons/06-iam-security-models.md` — the credential
  mechanism matrix distinguishes federation from the cluster-native
  workload identity used for in-cluster callers.
- `02-services/04-security-iam.md` — pool and provider configuration
  surface.
- `D4-Q05` for the secrets that remain after federation; `D4-Q07` for
  the deploy-time gate that bounds a compromised pipeline.

---

### D4-Q07 — "How do you know the container running in production is the one your pipeline built? And what happens at 3am when the gate is wrong?"

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 3.1, 5.2 |
| **Axis** | threat + obligation |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D4-Q06` |

**What the interviewer is actually testing**

Whether you can build a supply-chain control that is enforceable and
survivable. The second half of the question is the real one: a gate
with no designed bypass gets bypassed by someone improvising during an
incident, and the improvisation becomes the permanent path.

**Clarifying questions to ask before drawing anything**

- **What runs production — clusters, serverless containers, or virtual
  machines?** Deploy-time image attestation has enforcement points for
  container platforms; there is no equivalent built-in admission gate
  for raw machine images, and pretending otherwise leaves a hole.
- **Can anyone deploy to production today without going through the
  pipeline?** If yes, that path is the actual vulnerability and the
  gate is secondary to closing it.
- **Do we scan images, and does anything currently act on the
  results?** Scanning that produces a report nobody blocks on is
  detection, not prevention, and the gate is what converts one to the
  other.
- **What's the tolerated deploy latency during an incident?** This
  determines whether break-glass is a pre-approved path or an
  improvisation, and I'd rather design it than discover it.
- **Who would be on the other end of a blocked deploy at 3am?** If the
  answer is "nobody who can fix the policy," the gate will be disabled
  during its first incident.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Production images must be provably pipeline-built | Stated | — | Attestation, bound to a digest, is the only mechanism that proves it |
| Scanning exists in the pipeline | Assumed | "I'll assume vulnerability scanning runs; if not, that's prerequisite" | Scanning produces the signal an attestor signs on |
| Policy differs by environment | Assumed | "Development should not carry production's enforcement friction" | Per-environment policy, not one uniform rule |
| A break-glass path must exist | Assumed | "An unbypassable gate gets bypassed improvisationally, which is worse" | Makes the emergency path a designed artifact |
| Rollout must not block existing deploys | Assumed | "Audit-only mode first, until the violation queue is empty" | Determines the sequencing |

**The answer, out loud**

The property I want is that production only runs images our pipeline
produced and our checks passed, and that this is enforced at deploy
time by the platform rather than asserted by the pipeline about itself.
The distinction matters: "our pipeline is the only way to deploy"
is a claim about access control, and it fails the moment someone with
cluster permissions applies a manifest by hand.

The mechanism is Binary Authorization, which evaluates an admission
policy at deploy time against attestations bound to the image. Each
verification step in the pipeline gets an attestor,
which is effectively a signing authority for one claim. I'd define
three: built-by-pipeline, scanned-clean, and released — the last one
carrying whatever human or automated release approval the environment
requires. When an image passes a step, the pipeline signs an
attestation bound to the image digest, not to a tag. The digest binding
is the part I'd emphasise, because tags are mutable and a design that
attests tags can be defeated by repointing a tag after review.

Policy is per environment and deliberately uneven. Development requires
nothing, because enforcement friction in an environment whose purpose
is iteration produces workarounds rather than safety. Staging requires
built-by-pipeline and scanned-clean. Production requires all three.
That progression means promotion between environments is a real gate
rather than a copy, and it means the same image digest moves forward
rather than being rebuilt, which is what makes the attestation
meaningful in the first place.

Rollout goes through audit-only mode. The policy evaluates and logs
without blocking until the violation queue is empty, and the violations
are the requirements document — they tell you exactly which deploy
paths exist that nobody documented. Switching straight to enforcement
discovers those paths during a release.

Now the 3am case, which is where I'd spend real time. There are two
different emergencies and conflating them produces a bad design. The
first is "the gate is wrong" — a scanner outage, an attestor
misconfiguration, a policy that rejects a legitimate image. The second
is "we must ship something the policy correctly rejects" — a hotfix
built outside the normal path because the pipeline itself is down.

For the first, the right answer is not to bypass the gate; it's to fix
the signal. If the scanner is down and the policy requires
scanned-clean, the incident is the scanner, and I'd want a documented
fallback where an on-call security engineer can issue the attestation
manually for a specific digest. The image still has to be attested —
just by a human with a name attached.

For the second, break-glass is a designed path: a named group can
deploy a specific digest to a specific target with the policy's
emergency exemption, it pages security immediately, the exemption is
scoped to that digest rather than turning the policy off, and it
expires automatically. A retrospective is mandatory and covers not just
the incident but why the normal path couldn't carry it. The failure
mode I'm designing against is someone disabling policy enforcement on a
cluster at 3am and nobody re-enabling it for six weeks.

One thing I'd flag unprompted: this control governs container platforms
and does not cover machine-image deploys. If part of the estate runs on
virtual machines, that part needs its own image-provenance check in the
pipeline, and I'd rather name the gap than let the architecture diagram
imply coverage it doesn't have.

**Architecture**

```
   source merge
        │
        ▼
  ┌──────────────┐   (1) build in prj-common-cicd; the pipeline
  │ build + test │       identity is the only image publisher
  └──────┬───────┘
         ▼
  ┌──────────────────────────┐
  │ Artifact Registry         │  ◄── (2) images addressed by digest
  │ prj-common-registry       │
  └──────┬───────────────────┘
         │
   ┌─────┴───────┬───────────────┬──────────────────┐
   ▼             ▼               ▼                  ▼
 attestor:    attestor:      attestor:        (no attestor)
 built-by-    scanned-       released         ◄── (3)
 pipeline     clean          (approval)
   │             │               │
   └─────┬───────┴───────────────┘
         ▼  attestations bound to the DIGEST  ◄── (4)
  ┌────────────────────────────────────────────┐
  │  DEPLOY-TIME POLICY (Binary Authorization)  │
  │   dev      : no requirement      ◄── (5)    │
  │   staging  : built + scanned                │
  │   prod     : built + scanned + released     │
  └───────┬────────────────────────┬───────────┘
          │ pass                   │ blocked
          ▼                        ▼
   admitted to the           ┌──────────────────────────┐
   cluster / service         │ BREAK-GLASS  ◄── (6)      │
                             │ named group, ONE digest,  │
                             │ pages, auto-expires,      │
                             │ retrospective mandatory   │
                             └──────────────────────────┘

   Cross-cutting: rollout runs in audit-only mode until the violation
   queue is empty, because the violations are the undocumented deploy
   paths (7); a scanner outage is fixed by a human issuing the
   attestation for a named digest, not by disabling policy (8); machine-
   image workloads are NOT covered by this gate and need their own
   provenance check (9).
```

**Every arrow explained:**

1. **One publisher identity** — if anything else can push to the
   registry, the provenance claim is already weaker than the gate
   implies.
2. **Digest addressing throughout** — the whole chain refers to
   immutable digests so that "the image we reviewed" and "the image we
   ran" are the same object.
3. **No attestor for the image itself** — an unattested image is
   rejected at deploy, not at push: prevention lives at admission.
4. **Attestations bound to the digest, not the tag** — a tag-bound
   attestation can be defeated by repointing the tag after review.
5. **Per-environment policy** — development carries no requirement on
   purpose; uniform enforcement in an iteration environment buys
   friction, not safety.
6. **Break-glass as a designed artifact** — scoped to one digest,
   paging, expiring. The alternative is someone disabling enforcement
   on a cluster and nobody re-enabling it.
7. **Audit-only rollout** — the violation queue enumerates the deploy
   paths nobody wrote down.
8. **Scanner outage handled by attesting, not bypassing** — the human
   issuing the attestation puts a name on the decision, which a policy
   bypass does not.
9. **Named coverage gap** — virtual-machine deploys have no equivalent
   admission gate, and saying so is better than a diagram implying
   coverage.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Trust model | Deploy-time attestation checked by the platform | Restrict who can deploy via access control alone | Access control answers who deployed, not what was deployed | When the platform has no admission gate available and pipeline-only access is the strongest control obtainable |
| Attestation binding | Image digest | Image tag | Tags are mutable, so a tag-bound attestation can be repointed after review | Never for a security claim; tags remain fine as human-facing labels |
| Environment policy | Uneven by environment | One policy everywhere | Friction where it buys nothing produces workarounds that weaken the whole control | When a regulator requires uniform provenance across all environments including development |
| Emergency path | Scoped, paging, expiring break-glass | No bypass at all | An undesigned bypass gets invented during an incident and becomes permanent | When the workload's risk profile makes any unverified deploy unacceptable — then the emergency path is "fix the pipeline," and that must be resourced |
| Rollout | Audit-only until the violation queue empties | Enforce immediately | Surfaces undocumented deploy paths before they surface as a failed release | When an active compromise makes an immediately enforced gate the lesser risk |

**Making it concrete**

```hcl
# Production requires all three attestors. Development requires none —
# the unevenness is deliberate, not an oversight.
resource "google_binary_authorization_policy" "prod" {
  project = "PROJECT_ID"

  default_admission_rule {
    evaluation_mode  = "REQUIRE_ATTESTATION"
    enforcement_mode = "ENFORCED_BLOCK_AND_AUDIT_LOG"
    require_attestations_by = [
      "projects/REGISTRY_PROJECT_ID/attestors/built-by-pipeline",
      "projects/REGISTRY_PROJECT_ID/attestors/scanned-clean",
      "projects/REGISTRY_PROJECT_ID/attestors/released",
    ]
  }
}
```

During rollout the enforcement mode is the audit-only variant, and the
switch to blocking is a separate, reviewed change — so the day
enforcement begins is a decision with a date on it rather than a side
effect of a merge.

**What a weak answer sounds like**

- "Only our pipeline has permission to deploy." — that's access
  control, and it fails the moment someone with cluster rights applies
  a manifest directly.
- "We scan images in the pipeline." — scanning reports; it does not
  block. The gate is what turns the report into a control.
- "We sign the image tag." — tags are mutable, so this proves nothing
  after the tag moves.
- "There's no bypass, that's the point." — there is always a bypass;
  the only question is whether you designed it or someone invented it
  during an outage.

**Common wrong turns**

- **Enforcing everywhere including development.** It looks rigorous and
  it teaches teams that the gate is an obstacle. Recover by making
  policy per environment while drawing.
- **Rebuilding the image per environment.** Then the thing attested in
  staging is not the thing running in production. Recover by promoting
  the same digest.
- **Skipping audit-only.** The first blocked release is a customer
  incident. Recover by naming the audit-only stage and the empty-queue
  criterion.
- **Leaving break-glass undefined.** Someone disables enforcement on a
  cluster at 3am. Recover by specifying scope, paging and expiry.

**Follow-up probes the interviewer asks next**

1. **"The scanner is down and we have a production hotfix. Go."** —
   the incident is the scanner, so an on-call security engineer issues
   the scanned-clean attestation for that specific digest with their
   name on it. Policy stays enforced; the human takes the accountability
   the automation couldn't.
2. **"Escalate: the pipeline itself is compromised. Does this gate
   help?"** — partially and honestly not fully. An attacker who
   controls the pipeline can obtain legitimate attestations. What still
   helps is the released attestor requiring an approval the pipeline
   identity cannot self-issue, which is `D4-Q13`'s separation of
   duties, plus detection on unusual attestation patterns.
3. **"How many break-glass uses per quarter is too many?"** — more
   than a handful means the normal path is too slow, and the fix is the
   pipeline, not the gate. I'd report the count alongside incident
   counts so the trend is visible to leadership rather than to nobody.
4. **"How does this interact with third-party images?"** — base images
   and vendor containers get re-published through our registry and
   attested by our pipeline, so the provenance claim is about our
   verification rather than about their origin. Consuming vendor images
   directly at deploy time defeats the gate.
5. **"Who owns the attestors in two years?"** — platform owns the
   mechanism and the keys, security architecture owns which attestors
   production requires, and the release approval attestor is owned by
   whoever owns release management. Attestor key custody in one team's
   hands with no separation is a gap worth naming.

**Cross-references**

- `02-services/07-devops-cicd.md` — Binary Authorization attestor,
  policy and enforcement-mode configuration surface; don't re-derive.
- `03-comparisons/06-iam-security-models.md` — Binary Authorization
  versus VPC Service Controls near-miss row.
- `D4-Q13` for the approval separation that bounds a compromised
  pipeline; `D4-Q08` for routing attestation-failure findings.

---

### D4-Q08 — "We turned on security posture management and now there are forty thousand findings. Design the layer that turns that into action."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 3.1, 6.1 |
| **Axis** | threat + obligation |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D4-Q03`, `D1-Q06` |

**What the interviewer is actually testing**

Whether you understand that detection is an operational product, not a
procurement decision. Turning Security Command Center on is a
configuration change; making its output reach the person who can fix
the thing, with a clock, is the architecture. The failure mode being
probed is the dashboard nobody opens.

**Clarifying questions to ask before drawing anything**

- **Does every resource carry an owner attribute today?** Routing is
  the entire design, and it depends on labels. If ownership isn't in
  the resource metadata, the first work is labelling, not detection.
- **What is the current time-to-close on a security finding?** If
  nobody knows, that's the answer, and the first deliverable is making
  it measurable rather than adding detectors.
- **Is there an existing incident or ticketing system teams already
  live in?** Findings should arrive where work already happens. A new
  console is a new thing to ignore.
- **Which findings, if any, currently page someone?** The distinction
  between page, ticket and report should already exist for reliability,
  and I'd rather reuse that taxonomy than invent a parallel one.
- **Who is allowed to mute a finding, and is that recorded?** An
  unrecorded mute is indistinguishable from a fix, and muting is where
  posture programmes quietly die.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Findings must reach an owner | Assumed | "A finding with no owner is a dashboard row, so routing is the core requirement" | Depends on the mandatory `owner-group` label |
| Detection complements prevention | Assumed | "This layer does not replace Org Policy, perimeters or key controls" | Prevents the answer collapsing into 'posture management is our security' |
| Not everything deserves a page | Assumed | "Three response classes, matched to the reliability taxonomy already in use" | Determines the routing rules |
| Muting must be accountable | Assumed | "Every mute has an owner, a reason and an expiry" | Makes suppression a recorded decision, not an erasure |
| Findings feed policy, not just tickets | Assumed | "Recurring finding classes are evidence for promoting a guardrail" | Connects this to `D1-Q06`'s promotion mechanism |

**The answer, out loud**

The forty thousand findings are a routing failure, not a detection
failure. Almost every one of them has a resource, that resource has an
owning team, and the reason nobody acts is that the findings are in a
console the owning team never opens. So the design is a pipeline from
finding to owner to clock, and the detection product is the source, not
the system.

I'd start by being clear about what this layer is and isn't. Security
Command Center is asset inventory plus continuous evaluation plus
threat signals — it tells us what exists, what is currently
misconfigured, and what looks like an active attack, across every
project at once, exported from `prj-common-scc`. It is detective.
It does not block anything. Org Policy is what makes a bad
configuration impossible, perimeters are what stop exfiltration, the
deploy gate is what stops an unverified image, and key controls are
what bound the data. This layer's job is to tell us whether all of
those are actually working everywhere, which is a question none of them
can answer about themselves. I'd say that explicitly because the most
common failure is a programme that treats posture findings as the
security strategy.

The pipeline itself: findings export continuously to a topic in
`prj-common-scc`, and a router consumes them. The router does three
things. It resolves the owner by looking up the resource's
`owner-group` label — which exists because the platform makes labels
mandatory at creation, so this lookup is reliable rather than
best-effort. It assigns a response class. And it creates or updates one
item in the system that team already uses, deduplicated by finding
class and resource so a recurring misconfiguration is one item with a
count, not five hundred items.

Three response classes, matching the reliability taxonomy so nobody has
to learn a second one. Page: active threat indicators — anomalous
credential use, a token exchange from an unexpected source,
cryptomining signals, a key destruction nobody requested. These are few
and they wake people up. Ticket with a clock: misconfigurations with
real exposure — a publicly readable bucket holding a regulated data
class, an overly permissive rule at a network edge, a service account
with broad roles that hasn't been used in months. Severity sets the
clock and the clock is enforced by escalation, not by hope. Report:
everything else, aggregated into a monthly view per team, because a
finding with no exposure and no clock is information, not work.

Then the two mechanisms that decide whether this survives its first
year. The first is accountable muting. Teams will have findings that
are genuinely not applicable, and if muting is either impossible or
invisible, the queue becomes noise and people stop looking. So a mute
is a recorded object with an owner, a stated reason and an expiry, and
the set of active mutes is reviewable. An unrecorded mute is
indistinguishable from a fix, and the difference matters enormously
during an audit.

The second is the feedback loop into prevention. When a finding class
recurs across many teams, that is evidence that a guardrail should be
promoted — from advisory to detected, or detected to enforced, per
`D1-Q06`. Detection that never changes policy is a treadmill. The
number I'd actually put on a leadership dashboard is not the finding
count; it's time-to-close by severity and the count of finding classes
converted into prevention, because those two say whether the programme
is working while the raw count mostly says how many projects we have.

One last thing I'd name: access to findings is itself sensitive.
Findings describe exactly where we are weak. Broad read access to the
posture console is a reconnaissance gift, so the routing pipeline
matters partly because it delivers each team what it needs without
giving everyone the map.

**Architecture**

```
   SECURITY COMMAND CENTER  ◄── (1)
   asset inventory + detectors + threat signals
   (org-wide scope, prj-common-scc)
                    │
                    ▼  continuous export
          ┌────────────────────┐
          │  findings topic     │  ◄── (2)
          └─────────┬──────────┘
                    ▼
   ┌────────────────────────────────────────────┐
   │  ROUTER                                     │
   │   resolve owner from owner-group label ◄(3) │
   │   assign response class                     │
   │   dedupe by (finding class, resource) ◄─(4) │
   └───┬────────────┬─────────────────┬─────────┘
       ▼            ▼                 ▼
  ┌─────────┐  ┌──────────────┐  ┌──────────────┐
  │  PAGE    │  │ TICKET+CLOCK │  │   REPORT      │
  │ active   │  │ real exposure│  │ monthly, per  │
  │ threat   │  │ clock by     │  │ team  ◄── (6) │
  │ ◄── (5)  │  │ severity     │  └──────────────┘
  └─────────┘  └──────┬───────┘
                      │ not applicable
                      ▼
              ┌────────────────────────┐
              │ MUTE: owner, reason,    │ ◄── (7)
              │ expiry, reviewable      │
              └────────────────────────┘

   Cross-cutting: recurring finding classes are evidence to promote a
   guardrail from detected to enforced, per D1-Q06 (8); the leadership
   metric is time-to-close and classes converted to prevention, never
   the raw finding count (9); read access to findings is itself
   scoped, because findings map our weaknesses (10).
```

**Every arrow explained:**

1. **Detection is the source, not the system** — asset inventory,
   continuous misconfiguration evaluation and threat signals across
   every project. It answers whether the preventive controls are
   actually working everywhere; it blocks nothing itself.
2. **Continuous export rather than console review** — the console is
   for investigation; the pipeline is for work.
3. **Owner resolved from a mandatory label** — this only works because
   labels are enforced at project creation. Without that, routing
   degrades to a central team triaging everything.
4. **Deduplication by class and resource** — a recurring
   misconfiguration becomes one item with a count. Without this, forty
   thousand findings become forty thousand tickets, which is worse.
5. **Page reserved for active threat** — few, loud, and credible.
   Paging on misconfiguration trains people to ignore pages.
6. **Report class exists on purpose** — findings with no exposure and
   no clock are information; forcing them into a work queue devalues
   the queue.
7. **Accountable muting** — a mute with an owner, a reason and an
   expiry is a decision; a silent mute is indistinguishable from a fix.
8. **Feedback into prevention** — detection that never changes policy
   is a treadmill; recurrence is the evidence `D1-Q06`'s promotion
   mechanism runs on.
9. **The right metric** — time-to-close and conversions to prevention.
   Raw finding count mostly measures estate size.
10. **Findings access is scoped** — the finding set is a map of where
    we are weak, and broad read access hands that map to anyone.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Delivery | Route findings into the team's existing work system | Expect teams to review the security console | Work happens where teams already work; a second console is a second thing to ignore | When a dedicated security operations team genuinely owns triage for the whole estate and lives in that console daily |
| Ownership | Derived from mandatory resource labels | Central security team triages and assigns | Scales with the estate instead of with the security headcount | When labelling is not yet reliable — then central triage is the honest interim while labelling is fixed |
| Response classes | Three, mapped to the existing reliability taxonomy | Severity number alone drives the response | A severity without a defined response is a number; teams need to know whether to wake up | When the organisation has no existing taxonomy to borrow and inventing one alongside is unavoidable |
| Suppression | Recorded mutes with owner, reason and expiry | No muting allowed | Without a legitimate mute path the queue fills with non-applicable findings and everyone stops reading | When an auditor requires every finding to be explicitly remediated rather than accepted |
| Headline metric | Time-to-close and classes converted to prevention | Total open findings | Raw count tracks estate growth and rewards not looking | When the programme is new and the count genuinely is falling from a known baseline, making it a usable early signal |

**What a weak answer sounds like**

- "We'd enable it and review findings weekly." — a meeting is not a
  routing architecture, and forty thousand findings do not fit in one.
- "Security Command Center is our guardrail." — it's detective; it
  surfaces the problem and blocks nothing. Conflating detection with
  prevention is the exact distinction the panel is testing.
- "We'd fix the critical ones first." — severity without ownership and
  a clock means the critical ones sit unassigned alongside the rest.
- "We'd build a dashboard for leadership." — the question was how to
  produce action; a dashboard is how programmes produce the appearance
  of it.

**Common wrong turns**

- **Adding detectors before fixing routing.** The count goes up and
  action doesn't. Recover by declaring routing the first deliverable.
- **Paging on misconfiguration.** People stop reading pages, including
  the real ones. Recover by reserving paging for active threat signals.
- **Forbidding muting.** The queue fills with non-applicable findings
  and the whole surface loses credibility. Recover by making muting
  recorded rather than impossible.
- **Never converting findings into prevention.** The same class recurs
  forever. Recover by naming the promotion loop back to `D1-Q06`.

**Follow-up probes the interviewer asks next**

1. **"A team mutes a finding class permanently. What stops that?"** —
   mutes expire, and the active mute set is reviewed with the team's
   findings. A permanently muted class with a legitimate reason is
   evidence the detector is wrong for our estate, which is a detector
   change, not a silent mute.
2. **"Escalate: a threat finding says a workload identity is being
   used from an unexpected location. Walk me forward."** — that pages,
   and the containment sequence in `D4-Q15` starts. The finding is the
   trigger; the pre-built containment is what makes the response fast
   enough to matter.
3. **"How does this scale from 40 teams to 200?"** — routing scales
   because it is label-driven, and triage does not, so the thing to
   watch is the report class growing into noise. I'd invest in
   automated remediation for the highest-volume, lowest-judgment
   classes well before that point.
4. **"Who owns this programme in two years?"** — security operations
   owns the detectors and the router, each team owns its own queue, and
   security architecture owns the conversion of recurring classes into
   guardrails. If one team owns all three the queue becomes their
   backlog and nobody else's problem.
5. **"An auditor asks what you did about a finding from eight months
   ago."** — the item, its clock, its closure evidence or its recorded
   acceptance with an expiry. That's why closure has to produce an
   artifact rather than a status change nobody can reconstruct.
6. **"What would you turn off?"** — any detector whose findings are
   consistently muted across many teams. Keeping it running trains
   people that the queue contains noise, which costs more than the
   detector is worth.

**Cross-references**

- `03-comparisons/06-iam-security-models.md` — the detection and
  posture section, and the near-miss row separating posture findings
  from the audit-log record.
- `02-services/04-security-iam.md` — asset inventory, health analytics
  and threat detection surfaces, and the finding-export mechanism.
- `D1-Q06` for the guardrail tier promotion this feeds; `D4-Q11` for
  the evidence layer this is deliberately not a substitute for.

---

### D4-Q09 — "We host a model that reads regulated records, and an AI partner wants to run inference against it. Design the access surface."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 3.1, 3.2 |
| **Axis** | threat + obligation |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D4-Q01`, `D4-Q03` |

**What the interviewer is actually testing**

Whether a model endpoint changes your security reasoning or not. It
shouldn't change the primitives — this is still identity, perimeter,
private connectivity and egress control — but it does change what
"data leaving" looks like, because the interesting egress path is a
response body rather than a bulk export.

**Clarifying questions to ask before drawing anything**

- **Does the partner send us data, receive our data, or both?** Sending
  us their inputs is a different obligation from receiving inferences
  computed over our records, and the second is where a regulator has
  opinions.
- **Does the model itself hold regulated data, or only read it at
  inference time?** A model fine-tuned on records is a regulated
  artifact in its own right, and the key and perimeter design has to
  cover the model, not just the data store.
- **Is the partner inside Google Cloud, in another cloud, or on their
  own infrastructure?** That decides whether private connectivity is
  even available or whether we're exposing a service publicly with
  identity controls only.
- **What is the maximum volume of inference the partner is entitled
  to?** Rate is a security control here, because unlimited inference
  over a regulated corpus is a slow bulk export.
- **Who reviews what the endpoint returns?** Response content
  governance is not my question — it belongs with the model threat
  model — but I need to know it has an owner or the access design ends
  up being asked to carry it.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| The endpoint must not be publicly reachable | Assumed | "I'll assume no public endpoint; if the partner can't reach a private one we have a different conversation" | Forces private connectivity plus a published service, not an open front door |
| The partner is outside our organization | Stated | — | External identity, so federation rather than a granted role on our domain |
| Regulated data is involved | Stated | — | The serving project joins the regulated perimeter |
| Partner access is scoped to one operation | Assumed | "Predict only — no model export, no training data access, no listing" | Determines the role, not just the network path |
| Every inference is attributable and rate-bounded | Assumed | "Unbounded inference over regulated records is an export with extra steps" | Adds quota and logging as security controls, not just operational ones |

**The answer, out loud**

I'd say up front that I'm designing the access surface — who can reach
the endpoint, over what path, with what identity, and what can leave.
What the model does with a malicious prompt, and whether an output can
be coaxed into revealing training data, is a different design with a
different owner, and I'd name that boundary rather than blur it.

The endpoint itself is private. The serving project sits inside the
regulated perimeter from `D4-Q01`, and the endpoint is reachable only
over private connectivity — no public address, no public ingress. For
our own internal callers that's straightforward: they're inside the
perimeter, they use private access, and the perimeter blocks any
attempt to move model outputs or the underlying corpus to a project
outside it.

The partner is the interesting half. I would not peer their network to
ours and I would not put them inside our perimeter. What they get is a
published service endpoint — a single service exposed to their
environment through a private connection, with no route to anything
else in our network. That's the key distinction I'd draw: network
peering makes two estates mutually reachable and then relies on
firewall rules to claw that back; publishing one service exposes
exactly one thing and nothing else exists from their side. For a party
outside our trust boundary, the second is the only defensible shape.

Identity is federated. The partner authenticates with their own
identity provider, exchanges for a short-lived credential, and
impersonates a service account we created for them — one identity, one
purpose, per `D4-Q06`'s handshake. Its permissions are the narrowest
role that permits the predict operation on one specific endpoint. Not
project-level, not a broad platform role. It cannot list our endpoints,
cannot export the model, cannot read the corpus the model was built
from. If the partner needs the model artifact itself, that's an
entirely different conversation involving a contract and probably a
different delivery mechanism.

Egress is where I'd spend the remaining time, because it's the control
people forget. The perimeter has an egress rule permitting the
partner's identity to reach exactly the one endpoint service. But the
subtler path is our own: if the serving workload can call out to the
partner or to any external service, then a compromised serving workload
can stream the corpus outward one request at a time. So the serving
project's outbound reach is restricted to what it genuinely needs,
which for an inference endpoint is usually nothing external at all.

Then the two controls that make this bounded rather than merely
authenticated. Rate limiting, treated as a security control: a partner
entitled to thousands of inferences a day who suddenly performs
millions is exfiltrating, and quota is what turns that from an
unbounded loss into a bounded one. And logging: every inference request
is attributable to the partner's federated identity, with volume and
pattern feeding the detection routing in `D4-Q08`. The finding I'd
actually want is "partner inference volume departed from its baseline,"
because that is what a data-extraction campaign looks like from the
access layer.

What I'd flag unprompted: if the model was fine-tuned on regulated
records, the model artifact is itself regulated. It gets the same key
treatment, the same perimeter membership, and the same handling rules
as the corpus. Teams routinely protect the training data carefully and
then store the resulting artifact in a general-purpose bucket, which
undoes the whole design.

**Architecture**

```
   PARTNER ENVIRONMENT                    OUR ORGANIZATION
   ───────────────────                    ─────────────────

   partner workload
        │
        │ (1) federated token exchange,
        │     partner's own IdP
        ▼
   short-lived credential
   impersonating sa-partner-inference
        │
        │ (2) private published service —
        │     ONE service exposed, no route
        │     to anything else
        ▼
   ╔═══════════════════════════════════════════════════════╗
   ║  REGULATED PERIMETER                                   ║
   ║                                                        ║
   ║   prj-<team>-serving-prod                              ║
   ║     private model endpoint  ◄── (3)                    ║
   ║       │                                                ║
   ║       │ reads at inference time                        ║
   ║       ▼                                                ║
   ║   regulated corpus (CMEK)  ◄── (4)                     ║
   ║                                                        ║
   ║   model artifact — also regulated if fine-tuned  ◄─(5) ║
   ║                                                        ║
   ║   serving workload outbound reach: none  ◄── (6)       ║
   ╚═══════════════════════════════════════════════════════╝
        │
        │ (7) every inference attributable; volume baselined
        ▼
   quota per partner identity  ◄── (8)

   Cross-cutting: no network peering with the partner and no partner
   project inside our perimeter (9); prompt-level and output-level
   threats are a separate design and are deliberately out of scope
   here (10).
```

**Every arrow explained:**

1. **Federated partner identity** — the partner authenticates with
   their own provider and impersonates an identity we own and can
   revoke unilaterally. Granting a role to their domain directly makes
   revocation their business as well as ours.
2. **One published service, not a peered network** — peering makes two
   estates mutually reachable and then relies on rules to take that
   back; publishing exposes exactly one service.
3. **Private endpoint** — no public address, so reachability is a
   property of the connection rather than of knowing the URL.
4. **Corpus read at inference time under customer-managed keys** — the
   data the model reads is still regulated data and keeps its key
   treatment from `D4-Q04`.
5. **Model artifact treated as regulated when fine-tuned on records** —
   the commonly missed step; a carefully protected corpus and a
   casually stored artifact is not a protected system.
6. **No outbound reach from the serving workload** — closes the slow
   exfiltration path where a compromised server streams the corpus out
   one request at a time.
7. **Attributable inference logging with a baseline** — the detection
   that matters is volume departing from the partner's normal pattern.
8. **Quota as a security control** — converts an unbounded extraction
   into a bounded one, which is the difference between an incident and
   a breach.
9. **No peering, no perimeter membership for the partner** — they are
   outside the trust boundary and the topology should say so.
10. **Prompt and output threats out of scope here** — a real and
    separate design; this diagram covers the access surface only.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Partner connectivity | One privately published service | Network peering with firewall rules | Peering makes two estates mutually reachable and then relies on rules to undo it | When the partner relationship is genuinely an extension of our own estate, such as a wholly owned subsidiary under the same controls |
| Partner identity | Federated, impersonating an identity we own | Grant a role directly to the partner's domain identities | We can revoke unilaterally and attribute precisely | When the partner is inside the same organization and domain restrictions already cover them |
| Endpoint exposure | Private only | Public endpoint with strong authentication | Reachability becomes a property of the connection, not of possessing a credential | When the consumer set is genuinely open-ended and cannot be enumerated — not the case with one named partner |
| Volume | Quota per partner identity | Unlimited within their contract | Unbounded inference over a regulated corpus is a slow bulk export | When inference volume is itself the product and a quota would break the commercial arrangement — then detection carries the load alone |
| Model artifact | Treated as regulated when fine-tuned on records | Treated as a build artifact | The artifact can carry what the corpus contained | When the model is trained only on public or synthetic data and carries no regulated content |

**What a weak answer sounds like**

- "We'd peer their VPC and firewall it down." — starts by making two
  estates mutually reachable and then tries to subtract, which is the
  wrong direction for a party outside the trust boundary.
- "We'd give them a service account key." — long-lived material held by
  a third party, revocable only if we notice, and forbidden by policy
  anyway.
- "It's a model endpoint, so it's a different security model." — it
  isn't; the primitives are identity, perimeter, private connectivity
  and egress, and saying otherwise suggests unfamiliarity with all
  four.
- "We'd rate limit for cost reasons." — rate is a security control
  here, and framing it as a billing concern misses that unbounded
  inference is extraction.

**Common wrong turns**

- **Protecting the corpus and forgetting the artifact.** The model
  carries what it learned. Recover by naming the artifact's
  classification while drawing.
- **Letting the serving workload keep general outbound access.** It's
  the default and it's the exfiltration path. Recover by restricting
  egress explicitly.
- **Drifting into prompt-injection defence.** It's a real problem and
  it's not this question. Recover by naming the boundary and handing it
  off.
- **Treating the partner as internal because the contract is signed.**
  A contract is not a control. Recover by putting them outside the
  perimeter in the drawing.

**Follow-up probes the interviewer asks next**

1. **"The partner's inference volume triples overnight. What
   happens?"** — quota caps the loss, the baseline deviation raises a
   finding, and the response is to suspend the partner identity while
   we ask them what changed. Suspension is one binding removal because
   the identity is ours, which is exactly why we federated instead of
   granting to their domain.
2. **"Escalate: the serving workload is compromised. What can the
   attacker reach?"** — the corpus the endpoint reads, which is
   serious, and nothing outside the perimeter, because both the
   perimeter and the absent outbound path block export. Containment
   runs through `D4-Q15`.
3. **"The partner wants the model weights instead of an endpoint."** —
   that's a data transfer, not an access design, and it moves the
   entire conversation to `D4-Q16`. My default answer is no for a
   model carrying regulated content, because once weights leave, every
   control we've discussed stops applying.
4. **"How does an auditor see who accessed records through the
   model?"** — inference logs attribute to the partner identity, and
   the endpoint's reads of the corpus appear in data access logs. The
   join between them is the evidence, and it only exists because we
   enabled data access logging on that store in `D4-Q01`.
5. **"Who owns this arrangement in two years?"** — the team owning the
   endpoint owns the technical controls, and the partner relationship
   needs a business owner who reviews the access on a cycle. Partner
   integrations outlive the person who set them up, and unowned partner
   access is the one that's still live after the contract ends.

**Cross-references**

- `design-07`'s model threat-model question owns prompt injection,
  output-based exfiltration and jailbreak defence; this question
  deliberately stops at the access surface.
- `03-comparisons/06-iam-security-models.md` — the worked scenario on
  third-party partner access to a private endpoint.
- `D4-Q03` perimeter topology, `D4-Q06` the federation handshake,
  `D4-Q16` for handing data rather than access.

---

### D4-Q10 — "Teams create their own datasets and nobody classifies anything. Design data classification and the enforcement behind it."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 3.1, 3.2 |
| **Axis** | threat + obligation |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D4-Q01` |

**What the interviewer is actually testing**

Whether you can design a classification scheme people will actually
apply. Most classification programmes fail the same way: too many
levels, applied by hand, verified by nobody, and therefore wrong within
a quarter. The strong answer makes the label cheap to apply, consequential,
and independently verified.

**Clarifying questions to ask before drawing anything**

- **How many classes do we actually need?** If the number of distinct
  control sets is three, the number of classes is three. Classes that
  produce identical controls are paperwork.
- **Is classification currently a person's judgment or a system's
  output?** Judgment-based classification decays; the design has to
  turn the label into something derived or defaulted.
- **Does a wrong label cause anything to happen?** If mislabelling has
  no consequence, the labels will be wrong. The consequence is what
  makes the label real.
- **Can we scan the data, or is that itself a privacy problem?**
  Scanning regulated content requires the scanner to be inside the
  boundary, which changes where the job runs.
- **What happens today when a team needs sensitive data for
  analytics?** If there's no supported path, they've already made
  copies, and discovery will find them.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| A small, fixed set of classes | Assumed | "I'd cap it at four; more classes than control sets is pure overhead" | Keeps the scheme applicable without training |
| The label is mandatory at creation | Assumed | "The platform already enforces mandatory labels, so classification rides that mechanism" | No new enforcement surface needed |
| The label has consequences | Assumed | "Perimeter membership, key choice and logging all derive from it" | Makes the label load-bearing rather than decorative |
| Labels are independently verified | Assumed | "A declared label that nothing checks is a guess" | Introduces content scanning as the verifier |
| A supported de-identification path exists | Assumed | "Without one, teams make their own copies" | Connects classification to a workflow people want |

**The answer, out loud**

I'd start with the number of classes, because scheme design is where
this usually goes wrong. Four: public, internal, confidential,
regulated. The test for whether a class earns its existence is whether
it produces a distinct control set. Public and internal differ in
whether the data can leave our boundary. Confidential adds
customer-managed keys and restricted access. Regulated adds perimeter
membership, data access logging and a defined retention obligation. If
two proposed classes produce the same controls, they're one class with
two names, and every extra class is a decision someone gets wrong.

Then the mechanism, which is that the label rides infrastructure that
already exists. `design-01`'s platform makes a fixed label set
mandatory at project creation, and `data-class` is one of those labels.
So the classification decision happens once, at the moment a project or
dataset is created, at the point where a team is already answering
questions. There is no separate classification exercise, no
spreadsheet, and no annual attestation campaign — those are the
programmes that decay.

The label has to be consequential or it will be wrong, so I'd wire it
to real controls. Perimeter membership derives from it, per `D4-Q03`.
Key model derives from it, per `D4-Q04`. Whether data access logging is
on derives from it, per `D4-Q11`. Retention derives from it. That means
mislabelling something as internal when it holds regulated content
isn't a documentation error, it's a control gap, which is precisely why
we then have to verify the label independently.

Verification is content scanning. A discovery job runs against storage
and analytical datasets and looks for the patterns that define our
regulated and confidential classes — health identifiers, card patterns,
national identifiers, whatever our obligations name. Its output is not
a label change; it's a finding routed to the owning team through
`D4-Q08`, saying the declared class and the observed content disagree.
I'd keep it as a finding rather than an automatic reclassification,
because auto-promoting a dataset to regulated can break a legitimate
pipeline instantly, and because a false positive that silently tightens
controls teaches teams to distrust the system.

The scan has two cost decisions I'd name. First, scan incrementally —
new and changed data — rather than rescanning everything on a cycle,
because full rescans of a large estate become the dominant cost and
then get switched off. Second, the highest-value scan target is not the
regulated estate, it's everything declared *not* regulated, because a
regulated dataset is already controlled and the risk is regulated
content sitting somewhere that thinks it's internal.

The last piece is the relief valve, and it's the difference between a
scheme people follow and one they route around. Teams need sensitive
data for analytics, testing and debugging, and if the only answer is
no, they make copies. So there's one supported transformation path:
de-identification that lands output in a lower class. The technique
matters — if analysts need to join across records, a consistent token
preserves the join while removing the identifier, whereas redaction
breaks the join and sends them back to asking for raw data. Getting
that choice wrong is why de-identification programmes get bypassed.

What I'd flag unprompted: classification is worth exactly as much as
its worst-labelled dataset, and the labels will be wrong in the
beginning. The programme's first year is measured by the gap between
declared and observed classes closing, not by coverage percentage,
because coverage is easy to fake and agreement is not.

**Architecture**

```
   project / dataset creation
           │
           ▼
   ┌──────────────────────────────────────┐
   │ mandatory label: data-class  ◄── (1)  │
   │   public | internal |                 │
   │   confidential | regulated            │
   └───────────────┬──────────────────────┘
                   │ the label DERIVES controls  ◄── (2)
   ┌───────────────┼───────────────┬────────────────┐
   ▼               ▼               ▼                ▼
 perimeter      key model     data access      retention
 membership     (D4-Q04)      logging          obligation
 (D4-Q03)                     (D4-Q11)

                   │
                   ▼
   ┌──────────────────────────────────────────────┐
   │ DISCOVERY SCAN — incremental, targeted at     │
   │ everything declared NOT regulated  ◄── (3)    │
   └───────────────┬──────────────────────────────┘
                   │ declared class ≠ observed content
                   ▼
   ┌──────────────────────────────────────────────┐
   │ FINDING to the owning team  ◄── (4)           │
   │ not an automatic reclassification  ◄── (5)    │
   └───────────────┬──────────────────────────────┘
                   │
                   ▼
   ┌──────────────────────────────────────────────┐
   │ SUPPORTED PATH DOWN: de-identify, tokenize    │
   │ to preserve joins, land in a lower class ◄(6) │
   └──────────────────────────────────────────────┘

   Cross-cutting: four classes because four distinct control sets
   exist — classes that produce identical controls are one class (7);
   the scan is incremental, because full rescans become the dominant
   cost and then get disabled (8); the first-year metric is the
   declared-versus-observed gap closing, not coverage (9).
```

**Every arrow explained:**

1. **Label applied at creation on existing rails** — classification
   happens where teams are already answering questions, not in a
   separate campaign that decays.
2. **The label derives real controls** — perimeter, keys, logging and
   retention all follow from it, which is what makes a wrong label a
   control gap rather than a typo.
3. **Scan what claims not to be regulated** — the regulated estate is
   already controlled; the risk lives in datasets that believe they're
   internal.
4. **Disagreement becomes a routed finding** — it reaches the owning
   team through the same pipeline as every other security finding
   rather than a separate channel.
5. **No automatic reclassification** — auto-tightening breaks
   legitimate pipelines instantly and a false positive that silently
   changes controls destroys trust in the scanner.
6. **One supported path down the classes** — tokenization preserves
   joins, which is what stops analysts asking for raw data again.
7. **Four classes, not seven** — every class is a decision someone can
   get wrong, so classes must earn their existence with distinct
   controls.
8. **Incremental scanning** — full rescans of a large estate become the
   dominant cost and are the first thing disabled under budget
   pressure.
9. **Agreement, not coverage, as the metric** — coverage is trivially
   satisfied by labelling everything internal.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Number of classes | Four, each with a distinct control set | A richer taxonomy matching the regulatory vocabulary | Fewer decisions means fewer wrong ones, and the controls stay memorable | When multiple regulators demand distinguishable handling that a single class genuinely cannot express |
| Labelling moment | At creation, on the mandatory label mechanism | A periodic classification review campaign | Campaigns decay between cycles; creation-time labels never go stale in the same way | When a large existing estate must be classified retroactively — then a campaign is unavoidable as a one-off, not as the ongoing mechanism |
| Scan response | Finding to the owner | Automatic reclassification | Auto-tightening breaks pipelines and false positives destroy trust in the scanner | When the class is regulated and the obligation makes an immediate control change mandatory regardless of breakage |
| Scan scope | Incremental, focused on lower-declared classes | Full periodic rescan of everything | Sustainable cost, and it looks where the risk actually is | When an assessor requires full-estate scanning evidence on a defined cycle |
| De-identification technique | Tokenization preserving joins | Redaction | Analysts keep their joins and stop asking for raw data | When the downstream use genuinely needs no referential consistency and redaction is the simpler, stronger option |

**What a weak answer sounds like**

- "We'd define a classification policy and train everyone." — a policy
  document with no derived controls and no verification produces labels
  that are wrong within a quarter.
- "We'd scan everything monthly for sensitive data." — cost grows with
  the estate, the scan gets disabled, and the programme quietly ends.
- "Teams know what their data is." — they do, and they won't label it
  consistently unless labelling is cheap and consequential.
- "We'd auto-classify based on the scan." — silently tightening
  controls on a false positive is how you take an outage and lose the
  scanner's credibility at the same time.

**Common wrong turns**

- **Too many classes.** Seven levels with overlapping controls, and
  nobody can tell two of them apart. Recover by collapsing to the
  number of distinct control sets.
- **Labels with no consequence.** The scheme is documentation. Recover
  by wiring the label to perimeter, key and logging decisions.
- **No verification.** Declared classification is self-reported and
  therefore optimistic. Recover by adding content discovery as a
  finding source.
- **No path down.** Teams need lower-class copies and make them
  themselves. Recover by naming the de-identification route.

**Follow-up probes the interviewer asks next**

1. **"The scan finds regulated content in an internal dataset. Walk me
   through the next hour."** — the finding routes to the owning team
   with a clock. The immediate question is not the label, it's who has
   had access to that dataset while it was mislabelled, which comes
   from its access logs. Then either the data is removed or the dataset
   is promoted and inherits the regulated controls.
2. **"Escalate: how bad can a mislabelled dataset get?"** — regulated
   content sitting outside the perimeter, under default keys, without
   data access logging, reachable by anyone with broad internal access.
   That is a breach with no evidence trail, which is why label
   verification is not optional.
3. **"How does this scale from 40 teams to 200?"** — labelling scales
   because it rides project creation. Scanning cost is what grows, so
   the incremental design and the targeting of lower-declared classes
   matter more at scale, not less.
4. **"Who owns classification in two years?"** — data governance owns
   the class definitions, platform owns the enforcement rails, and each
   team owns its own labels. If governance owns the labels themselves,
   they become a queue and the labels go stale.
5. **"An auditor asks how you know your classifications are
   accurate."** — the discovery scan results and the closure history of
   disagreement findings. Self-declared classification with no
   verification is not evidence, and I'd say so rather than present it
   as one.

**Cross-references**

- `02-services/04-security-iam.md` — detector types, de-identification
  techniques and where scanning integrates.
- `D4-Q01` for the regulated boundary the top class implies; `D4-Q04`
  for the key model per class; `D4-Q08` for the finding routing.
- `D1-Q08` for the mandatory label set this rides on.

---

### D4-Q11 — "An auditor is coming. Show me the logging and evidence architecture you'd want to have built two years ago."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 3.2, 6.1 |
| **Axis** | threat + obligation |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D4-Q01` |

**What the interviewer is actually testing**

Whether you know the difference between logging and evidence. Logging
is a pipeline. Evidence is a claim you can defend about a period of
time, which requires the log to be complete, immutable, attributable
and queryable — and each of those is a separate design decision that
cannot be retrofitted.

**Clarifying questions to ask before drawing anything**

- **What claims will we have to defend?** "Only authorized people
  accessed records," "this control was on all year," "we detected and
  responded within the notification window." Each claim needs a
  different log, and designing without the claims produces volume
  without evidence.
- **What is the retention obligation, and does it vary by data class?**
  Retention drives storage design and cost, and a uniform maximum
  retention is usually the expensive wrong answer.
- **Who currently has the ability to delete logs?** If a project owner
  can delete their own audit trail, we don't have evidence, we have a
  courtesy.
- **How fast must an investigation produce an answer?** A
  seventy-two-hour notification clock means hours-to-query, which rules
  out an architecture where evidence lives only in cold archive.
- **Has an auditor already asked us something we couldn't answer?**
  That question is the requirements document.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Evidence must survive project deletion | Assumed | "If a team can delete the project, they must not be able to delete its trail" | Org-level sink above every project |
| Retention varies by class | Assumed | "Uniform maximum retention is the expensive wrong default" | Two destinations with different lifetimes |
| Logs must be immutable for the retention period | Assumed | "Retention that an administrator can shorten is not retention" | Locked retention on the archival bucket |
| Investigation must complete in hours | Assumed | "A notification clock makes query latency a compliance property" | A queryable destination alongside the archive |
| Vendor-side access is in scope | Assumed | "I'll assume a contract asks about provider personnel access" | Access Transparency enabled where regulated data lives |

**The answer, out loud**

I'd organise this around four properties, because each one is a
separate decision and dropping any one of them turns evidence back into
logging.

Completeness first. Administrative activity logging is always on and
cannot be disabled by anyone, which is itself a control — no
privileged principal can erase the record that they changed something.
Data access logging is opt-in, expensive at volume, and the only thing
that answers "who read this." So it's enabled selectively, driven by
data class: on for regulated and confidential stores, off elsewhere.
Policy-denied logs are the ones people forget and they're the most
useful during an investigation, because they show what was attempted
and blocked, which is how you distinguish a probing attacker from a
misconfigured job. And Access Transparency where regulated data lives,
because "who at the provider touched our data" is a question our own
logs structurally cannot answer.

Immutability second. The sink is defined at the organization level,
above every project, writing into `prj-common-logging`, and no workload
team holds a role there. That's the property that makes evidence
survive a compromised or deleted project. Within that project there are
two destinations: an analytical dataset for querying, with a retention
matched to investigation needs, and an object store bucket with locked
retention for the full compliance period. Locked retention matters
specifically because retention an administrator can shorten is not
retention — during an incident, the person who can shorten it may be
the person under investigation.

Attributability third, and this is where designs quietly fail. A log
line saying a service account read a table is worthless if forty people
share that service account. So the evidence architecture depends on the
identity architecture: one service account per workload purpose, humans
never sharing a workload identity, and break-glass access granted to a
named individual rather than to a shared emergency account. If a panel
asks the hardest version of this question, it's usually here — the
answer to "who did this" comes from how identities were designed, not
from how logs were stored.

Queryability fourth. Evidence nobody can query in hours is evidence
that fails during the incident it was collected for. So I'd want the
standard questions written as queries that already exist and are
periodically exercised: every access to this tenant's data in a window,
every IAM change on these projects, every policy denial for this
identity, every key operation for this key. Writing those during an
incident is how a seventy-two-hour clock gets missed.

The claim that separates a strong answer from an adequate one is
continuity. An auditor's real question is rarely "is this control on
today" — it's "was it on for the whole period, and how do you know."
Current state is trivially demonstrable and proves nothing. What proves
it is the configuration history in version control plus the log stream
showing continuous emission, and a gap in that stream is itself a
finding I'd want detected rather than discovered a year later by an
auditor.

The cost conversation I'd raise unprompted: data access logging on a
high-volume store is genuinely expensive, and the temptation is to
enable it everywhere for safety. That produces a bill nobody defends,
and the predictable end is someone disabling it broadly under budget
pressure — usually without a record of which coverage was lost. So I'd
rather make the class-driven decision explicitly, with the obligation
attached to it, than take a uniform position that gets silently
reversed.

**Architecture**

```
   every project in the org
        │  admin activity (always on)  ◄── (1)
        │  data access (on where data-class is regulated
        │    or confidential)          ◄── (2)
        │  policy denied               ◄── (3)
        │  Access Transparency (regulated projects)  ◄── (4)
        ▼
   ┌─────────────────────────────────────────────┐
   │  ORG-LEVEL SINK — defined above every        │
   │  project; no workload team holds a role ◄(5) │
   └──────────────┬──────────────────────────────┘
                  ▼
   ┌─────────────────────────────────────────────┐
   │  prj-common-logging                          │
   │                                              │
   │   analytical dataset  ◄── (6)                │
   │     investigation window, queryable in        │
   │     minutes                                   │
   │                                              │
   │   object store, LOCKED retention  ◄── (7)    │
   │     full compliance period, not shortenable   │
   │                                              │
   │   stream to the security operations pipeline  │
   └─────────────────────────────────────────────┘
                  │
                  ▼
   pre-written standing queries, exercised on a cycle  ◄── (8)

   Cross-cutting: attribution depends on one identity per workload
   purpose and named break-glass grants, not shared accounts (9); the
   auditable claim is continuity, evidenced by configuration history
   plus an unbroken log stream (10); a gap in emission is itself a
   detected finding, not something an auditor discovers later (11).
```

**Every arrow explained:**

1. **Administrative activity always on** — no principal, however
   privileged, can disable the record of configuration changes, which
   makes it the backbone of every continuity claim.
2. **Data access logging driven by class** — the only source that
   answers "who read this," enabled where the obligation exists rather
   than everywhere, because uniform enablement gets reversed under cost
   pressure without a record of what was lost.
3. **Policy-denied logs** — the most useful investigation source and
   the most commonly forgotten; they distinguish a probing attacker
   from a broken job.
4. **Access Transparency** — answers the vendor-personnel question our
   own logs cannot.
5. **Org-level sink above every project** — the property that makes
   evidence survive deletion of the project that generated it.
6. **Queryable destination** — an investigation with a clock cannot
   wait on a cold restore.
7. **Locked retention** — retention an administrator can shorten is not
   retention, and during an incident that administrator may be the
   subject.
8. **Standing queries exercised on a cycle** — a query written during
   an incident is a query debugged during an incident.
9. **Attribution comes from identity design** — shared identities make
   "who did this" unanswerable no matter how good the log pipeline is.
10. **Continuity is the claim** — current state is trivially
    demonstrable and proves nothing about the period under audit.
11. **Emission gaps detected** — a silent stop in logging is the one
    failure that destroys the claim retroactively.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Data access logging scope | Driven by data class | Enabled everywhere | An explicit, obligation-linked decision survives budget review; a blanket one gets silently reversed | When an auditor has mandated full coverage across a defined estate and the cost is already accepted |
| Retention | Two destinations, different lifetimes | One destination at maximum retention | Investigation needs speed, compliance needs duration, and one store optimised for both is expensive and slow | When retention obligations are short enough that a single queryable store covers both needs |
| Immutability | Locked retention on the archive | Access control preventing deletion | Access control is revocable by whoever holds the administrative role, including during an incident | When the retention obligation is short and the operational cost of an unmodifiable store outweighs the risk |
| Sink placement | Organization level, above all projects | Per-project sinks configured by each team | A project owner cannot delete their own trail, and coverage does not depend on per-team configuration | When teams have genuinely distinct retention obligations that an org sink cannot express — then org sink plus supplementary per-team sinks |
| Evidence readiness | Standing queries, exercised periodically | Write queries when the incident happens | Query latency becomes a compliance property when there's a notification clock | When incidents are rare and the estate is small enough that ad-hoc querying is genuinely fast |

**Making it concrete**

```hcl
# The sink is defined at the org node so no project owner can remove
# their own trail. Retention is locked, not merely policy-protected.
resource "google_logging_organization_sink" "audit" {
  name             = "org-audit-archive"
  org_id           = "ORG_ID"
  include_children = true
  destination      = "storage.googleapis.com/BUCKET_NAME"
  filter           = "logName:\"cloudaudit.googleapis.com\""
}

resource "google_storage_bucket" "audit_archive" {
  name                        = "BUCKET_NAME"
  project                     = "PROJECT_ID"
  uniform_bucket_level_access = true
  retention_policy {
    is_locked        = true
    retention_period = 220752000
  }
}
```

`is_locked` is the line that turns a retention setting into a retention
guarantee. Without it, the retention period is a preference held by
whoever currently holds the administrative role on the bucket.

**What a weak answer sounds like**

- "All our logs go to a central project." — that's a pipeline; the
  panel is asking about immutability, attribution, retention and
  queryability, none of which follow from centralisation.
- "We enable all audit logs everywhere." — expensive enough that it
  gets reversed, usually without a record of what coverage was lost.
- "We can query logs if we need to." — an untested query path is an
  untested query path, and the test happens during the incident.
- "The security team has access to the logs." — access is not the
  question; who *cannot* delete them is.

**Common wrong turns**

- **Designing volume instead of claims.** Everything is logged and no
  specific question is answerable quickly. Recover by naming the claims
  first and deriving the log set.
- **Per-project sinks.** Coverage depends on every team configuring
  correctly, and a deleted project takes its evidence with it. Recover
  by moving the sink to the org node.
- **Retention without locking.** It looks identical on a diagram and
  differs entirely under pressure. Recover by naming the lock.
- **Ignoring attribution.** Perfect logs about a shared identity answer
  nothing. Recover by tying evidence back to the identity design.

**Follow-up probes the interviewer asks next**

1. **"An auditor asks whether a control was on continuously for
   twelve months."** — configuration history in version control shows
   when it was defined and every change since, and the log stream shows
   continuous emission. Current state answers a different, easier
   question, and I'd say that rather than present it as the answer.
2. **"Escalate: an administrator with broad rights turns hostile.
   What survives?"** — administrative activity logs, because they
   cannot be disabled, and the locked archive, because retention cannot
   be shortened. What they could damage is the queryable copy, which is
   why the archive is separate and locked.
3. **"How do you keep this affordable at ten times the volume?"** —
   class-driven data access logging, exclusion filters on high-volume
   low-value entries, and tiering the archive. What I would not do is
   shorten retention below the obligation or silently drop coverage.
4. **"Who owns the evidence architecture in two years?"** — platform
   owns the pipeline, compliance owns which claims must be defensible,
   and security operations owns the standing queries. If platform owns
   all three, the claims drift out of date as obligations change.
5. **"A team asks for their own copy of the audit logs."** — they get
   a scoped view of their own projects' entries, not a copy of the
   stream, because a second copy with different access control is a
   second evidence store with none of these properties.
6. **"What's the first thing you'd test?"** — that a project owner
   deleting their project does not remove its trail, and that the
   standing tenant-access query returns in minutes. Both are cheap to
   rehearse and catastrophic to discover during an audit.

**Cross-references**

- `02-services/04-security-iam.md` — audit log types, Access
  Transparency positioning and the retention discussion.
- `03-comparisons/06-iam-security-models.md` — the audit-log versus
  posture-findings near-miss row; they are not substitutes.
- `D4-Q08` for detection, which this deliberately is not; `D4-Q10` for
  the class that drives data access logging; `D1-Q13` for the shared
  logging project's blast radius.

---

### D4-Q12 — "We want to retire the VPN. Engineers need internal applications from anywhere. Design it."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 3.1, 2.1 |
| **Axis** | threat + obligation |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D4-Q06` |

**What the interviewer is actually testing**

Whether you can replace a network control with an identity control
without leaving a quiet exception that keeps the network control alive
forever. The design is easy; the migration and the residue are the
interview.

**Clarifying questions to ask before drawing anything**

- **What actually lives behind the VPN today?** Web applications,
  administrative consoles, database clients, and legacy protocols are
  four different migration problems, and only the first is
  straightforward.
- **Is there a managed device fleet, or do people use anything?** If
  device posture can be asserted, it becomes part of the access
  decision. If it can't, identity and context carry the whole load and
  I should say so rather than pretend otherwise.
- **Do contractors and partners use the VPN too?** They're usually the
  reason the VPN survives its own retirement, and they need a designed
  path or they'll keep it alive.
- **What breaks if we get this wrong at 9am on a Monday?** Access
  infrastructure failure is a total work stoppage, so the rollout needs
  both paths live simultaneously for a period.
- **Are any of these applications reachable from the public internet
  today?** If some already are, the VPN was never the control we
  thought it was, and that's worth surfacing early.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Access from anywhere, no network tunnel | Stated | — | Identity-and-context becomes the control, not network position |
| Most internal apps are web-based | Assumed | "I'll assume the majority are HTTP; the remainder need a different path" | Splits the migration into two tracks |
| Device signal may be available | Assumed | "If we have a managed fleet, posture joins the decision; if not, say so" | Determines whether context is real or aspirational |
| Contractors need access too | Assumed | "They're why VPNs survive retirement, so they need a designed path" | Prevents the residual-VPN failure mode |
| Access decisions must be logged | Assumed | "Per-request authorization means per-request evidence" | Feeds the same evidence architecture as everything else |

**The answer, out loud**

The premise I'd state first is that the VPN's actual security value is
low and its perceived value is high. It authenticates you once, puts
you on a network, and from then on every internal application trusts
you because of where your packets come from. A stolen laptop or a
compromised contractor endpoint inherits that trust wholesale. What I
want instead is per-request authorization: every request to every
internal application is authorized on the identity making it, the
group memberships that identity holds, and whatever context we can
assert about the device and the connection.

Mechanically, internal web applications sit behind an identity-aware
proxy. The application has no public address of its own; the proxy is
the only ingress, and it authenticates the user, evaluates an access
policy, and forwards the request with the identity attached. The
application's own authorization still applies — the proxy decides
whether you may reach the application, not what you may do inside it,
and conflating those is how teams end up with a proxy protecting an
application that trusts any request that arrives.

The access policy is where context enters. At minimum, group
membership. Where a managed fleet exists, device posture — corporate
enrolment, disk encryption, screen lock — becomes a condition, and
sensitive applications require a stronger posture than ordinary ones.
Where relevant, geography or network origin can be a condition too,
though I'd use it carefully, because location-based conditions look
strong and break travel. If we have no device signal at all, I'd say so
plainly: this is then an identity-and-group control with strong
authentication, which is still substantially better than network
position, but it is not what most people mean by zero trust and I'd
rather set that expectation than oversell.

Administrative access is the second track. Shell access to machines and
database clients aren't HTTP, and they go through an identity-aware
tunnel — the same identity and policy evaluation, a different transport
— so administrative access also stops depending on network position.
That path matters more than the web one, because it's the path an
attacker actually wants.

The third track is the residue, and this is the part that decides
whether the VPN ever actually dies. There will be a handful of things
that fit neither path: a legacy protocol, an appliance, a vendor tool.
The failure mode is keeping the VPN alive for them indefinitely, which
means keeping the whole flat-network trust model alive for everyone who
still has credentials to it. So the residue gets an explicit decision
per item — modernise, front with a proxy, or accept on a dated
exception — and the VPN's remaining reachability is cut down to only
the residue, with everything else removed from it.

Migration runs both paths in parallel, application by application,
starting with something low-stakes and well-understood. For each
application, stand up proxy access, verify it, then remove the
application from the VPN-reachable range. Cutting the VPN first and
migrating under pressure is how access infrastructure causes a company-
wide outage. The VPN is decommissioned when its reachable set is empty,
which makes the decommission a consequence rather than an event.

One thing I'd flag: this design makes the proxy and the identity
provider the availability floor for all internal work. That is a real
concentration of failure and it deserves a reliability review, not just
a security one — the question "what happens when identity is down"
should have an answer before we retire the alternative.

**Architecture**

```
   engineer, anywhere, any network
            │
            ▼
   ┌───────────────────────────────────────────────┐
   │ IDENTITY PROVIDER: strong authentication ◄─(1) │
   └──────────────────┬────────────────────────────┘
                      ▼
   ┌───────────────────────────────────────────────┐
   │ ACCESS POLICY  ◄── (2)                         │
   │   group membership (always)                    │
   │   device posture (where a fleet exists) ◄──(3) │
   │   context conditions, used sparingly           │
   └────────┬───────────────────────┬──────────────┘
            │ web                   │ shell / db
            ▼                       ▼
   ┌─────────────────┐     ┌──────────────────────┐
   │ identity-aware  │     │ identity-aware tunnel │
   │ proxy  ◄── (4)  │     │ ◄── (5)               │
   └────────┬────────┘     └──────────┬───────────┘
            ▼                          ▼
   internal web apps            VMs, databases
   no public address            no public address
   app authorization            ◄── (6)
   still applies

   ┌────────────────────────────────────────────────┐
   │ RESIDUE: legacy protocols and appliances.       │
   │ Dated decision each: modernise, front, or       │
   │ accept. VPN reachability shrinks to this set    │
   │ only, then to empty.  ◄── (7)                   │
   └────────────────────────────────────────────────┘

   Cross-cutting: migration runs both paths in parallel per
   application; the VPN is decommissioned when its reachable set is
   empty, as a consequence rather than an event (8); every access
   decision is logged per request, which is evidence the VPN never
   produced (9); the proxy and identity provider become the
   availability floor for all internal work and need a reliability
   review (10).
```

**Every arrow explained:**

1. **Strong authentication at the identity provider** — the whole model
   rests on the identity being hard to forge, so phishing-resistant
   factors are a prerequisite, not an enhancement.
2. **Per-request policy evaluation** — the fundamental difference from
   a tunnel, which authorizes once and then trusts the network path
   indefinitely.
3. **Device posture where it can be asserted** — real signal where a
   managed fleet exists; without one, say plainly that this is identity
   and groups rather than implying a posture check that doesn't happen.
4. **Proxy as sole ingress for web applications** — the application has
   no public address, and the proxy decides reachability while the
   application still decides permissions.
5. **Tunnel for administrative access** — shell and database access
   matter more than the web tier, because that's the path an attacker
   wants.
6. **No public addresses on the targets** — otherwise the proxy is a
   preferred path rather than the only one, and the control is
   advisory.
7. **Residue handled explicitly with dates** — an indefinite VPN for a
   handful of legacy items keeps the flat-network trust model alive for
   everyone.
8. **Parallel migration, decommission by consequence** — cutting the
   tunnel first and migrating under pressure is a company-wide outage.
9. **Per-request access logs** — evidence the tunnel never produced,
   feeding the same architecture as `D4-Q11`.
10. **Concentrated availability dependency** — worth naming, because
    retiring the alternative removes the fallback.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Access model | Per-request identity and context authorization | Network tunnel granting broad reachability | A compromised endpoint inherits one application's access, not the whole internal network | When the applications genuinely cannot sit behind a proxy and rewriting them is out of scope — then a tunnel with tightly segmented reachability |
| Device posture | A condition where a managed fleet exists | Require managed devices for all access | Contractors and acquisitions always have unmanaged devices, and a hard requirement produces exceptions that outnumber the rule | When the data is sensitive enough that unmanaged access is unacceptable at any tier |
| Administrative access | Identity-aware tunnel, same policy | Keep administrative access on the VPN | The administrative path is the one an attacker wants, so it should be the best protected, not the exception | When an appliance genuinely accepts no identity-aware path — then it joins the residue with a dated decision |
| Migration | Parallel paths, per application | Cut the VPN and migrate under pressure | Access infrastructure failure is a total work stoppage | When the VPN is actively compromised — then the outage is the lesser harm and the cutover is an incident response |
| Context conditions | Groups and device, geography used sparingly | Rich location and network conditions | Location conditions look strong and break travel, producing exception traffic that erodes the policy | When a regulatory obligation genuinely restricts access to specific jurisdictions |

**What a weak answer sounds like**

- "We'd use a zero-trust product." — naming a category is not a design;
  the panel wants the policy inputs, the two transport paths and the
  migration.
- "Every internal app gets a public URL with single sign-on." — single
  sign-on authenticates, and without the proxy the application is
  directly reachable by anyone who finds it.
- "We'd require managed devices for everything." — contractors and
  acquisitions guarantee exceptions, and an exception path used daily
  is the real policy.
- "We'd turn off the VPN and see what breaks." — this is how access
  infrastructure causes a company-wide outage on a Monday morning.

**Common wrong turns**

- **Forgetting non-HTTP access.** The web tier migrates, administrative
  access stays on the tunnel, and the tunnel never dies. Recover by
  naming the second track.
- **Leaving public addresses on the targets.** The proxy becomes
  optional. Recover by removing direct reachability as part of each
  application's migration.
- **Treating the proxy as authorization.** Applications stop checking
  permissions because the proxy is in front. Recover by stating the
  split explicitly.
- **No plan for the residue.** The VPN persists for three things and
  everyone keeps their credentials. Recover by dating each residual
  item.

**Follow-up probes the interviewer asks next**

1. **"A laptop is stolen, unlocked. What does the attacker get?"** —
   whatever that identity is authorized for, on a device whose posture
   may still pass, until the session is revoked and the identity
   suspended. That's a far smaller radius than a VPN session, and the
   containment path is the same identity suspension as `D4-Q15`.
2. **"Escalate: the identity provider is unavailable. What
   happens?"** — nobody can reach anything internal, which is exactly
   the concentration I'd flag during the design. The mitigations are
   provider redundancy and a rehearsed break-glass path for a small
   named group, not keeping the VPN as a shadow fallback.
3. **"Contractors with unmanaged devices need access."** — a distinct
   group with a lower device requirement and a correspondingly narrower
   application set, with a dated review. What I won't do is keep the
   tunnel alive for them, because that preserves the model we're
   retiring.
4. **"How does this change the internal firewall design?"** — internal
   segmentation still matters for service-to-service traffic; this
   design addresses human access specifically. Believing the proxy
   replaces network segmentation is a common conflation.
5. **"Who owns access policy in two years?"** — security architecture
   owns the policy tiers, application owners map their application to a
   tier, and identity operations runs the mechanism. If application
   owners choose their own conditions freely, the tiers dissolve within
   a year.

**Cross-references**

- `02-services/04-security-iam.md` — IAM conditions and the context
  attributes an access policy can evaluate.
- `D4-Q06` for workload identity, which is the machine-side equivalent
  of this question's human-side design.
- `D4-Q11` for where per-request access decisions land as evidence;
  `D1-Q04` for the network topology this sits over.

---

### D4-Q13 — "Make it structurally impossible for one person to both write the change and approve it into production."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 3.1, 5.2 |
| **Axis** | threat + obligation |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D4-Q07` |

**What the interviewer is actually testing**

Whether you can find the person who can still do both. Every
separation-of-duties design has one, usually the platform engineer who
administers the pipeline, and the quality of the answer is whether you
name them unprompted or the interviewer has to.

**Clarifying questions to ask before drawing anything**

- **Is this a regulatory requirement or a risk decision?** Regulatory
  separation must be evidenced continuously and has no architecture
  exception path. A risk decision can be tuned against delivery speed.
- **How many people are on the smallest team in scope?** A three-person
  team cannot run two-person approval during a holiday without a
  designed fallback, and pretending otherwise produces a break-glass
  path used weekly.
- **Do humans have any standing write access to production today?** If
  yes, the pipeline is not the only deploy path and the separation is
  cosmetic until that's closed.
- **Who administers the pipeline itself?** That identity is the real
  concentration of power and is the answer to the question the panel
  will ask next.
- **What is the emergency path today?** If it's "an engineer with
  standing rights fixes it," the separation exists only on calm days.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| No human deploys to production directly | Assumed | "Humans approve; the pipeline deploys. Standing human write access is what I'd remove first" | Makes the pipeline identity the sole actor |
| Author and approver must differ | Stated | — | Enforced in the change system, not by convention |
| Small teams must still function | Assumed | "Cross-team approver pools, or a designed fallback, or the rule breaks weekly" | Determines the approver group design |
| The emergency path is designed | Assumed | "An undesigned emergency path becomes the normal one" | Break-glass with paging and expiry |
| Separation must be evidenced | Assumed | "An auditor asks for the period, not for today" | Every approval and deploy is an evidence record |

**The answer, out loud**

I'd build this from the deploy side backwards, because the usual
mistake is to design approval carefully while leaving a direct path to
production open beside it.

So first: no human has standing write access to production. Not
reduced, not conditional — none. The only principal that can change
production is the pipeline's service account, and it can only do so
when invoked by the pipeline. That single decision does most of the
work, because it converts "who is allowed to deploy" from an access
control question with many holders into a workflow question with one.

Second, the pipeline's authority is bounded by what it is deploying.
The deploy identity can apply a specific artifact to a specific target;
it is not a general administrator of that project. So a compromised
pipeline can ship a bad version of the thing it ships, which is bad,
and cannot rewrite the project's access controls or read the data
plane, which is much worse.

Third, approval is a separate act by a separate principal, recorded
separately. The change is authored in version control, review requires
an approver who is not the author, and the release approval — the thing
that lets an artifact into production — is an act the pipeline identity
cannot perform on its own behalf. In the deploy gate from `D4-Q07`,
that's the released attestation: the pipeline can produce the
built-by-pipeline and scanned-clean attestations because those are
statements about its own work, and it cannot produce the released one,
because that one is a statement about somebody else's decision. The
attestor key for release sits with a different group.

Fourth, the approver pools. Small teams break two-person rules, so the
pool for a given service is the owning team plus a named set of peers
from an adjacent team, so there is always somebody available who is not
the author. That is better than a break-glass path used weekly, because
a rule that routinely requires its own exception is not a rule.

Now the person I said I'd name unprompted: whoever administers the
pipeline. That identity can change what the pipeline does, and
therefore can cause a deploy without an approval, or grant themselves
the release attestor key. There is no way to make that person
nonexistent, so the design handles them three ways. Pipeline
configuration is itself code, in a repository with the same two-person
rule, so changing the pipeline is a reviewed change. Administrative
membership on the pipeline project is small, named, and reviewed.
And every action by that identity is logged into an evidence stream
they cannot alter, per `D4-Q11`. That converts an unconstrained power
into a constrained and visible one, which is the honest ceiling here.

Break-glass: a named group can obtain temporary elevated access,
time-boxed, paging on use, with a mandatory retrospective. The property
I care about is that using it is loud. Standing emergency access that
nobody notices being used is the same as no separation at all, and it
is what most organisations actually have while believing otherwise.

Finally, evidence. Separation of duties is an assertion about a period.
The record is: for every production change in the window, the author,
the approver, the release attestation and the deploying identity, with
the constraint that the first two are never the same person. That
should be a query, and if it can't be run as one, the assertion is a
policy statement rather than a control.

**Architecture**

```
   author commits change
        │
        ▼
   ┌─────────────────────────────────────────────┐
   │ REVIEW: approver ≠ author, enforced by the   │
   │ change system, not by convention  ◄── (1)    │
   └──────────────────┬──────────────────────────┘
                      ▼
   ┌─────────────────────────────────────────────┐
   │ PIPELINE (prj-common-cicd)                   │
   │   builds, tests, scans                       │
   │   signs: built-by-pipeline, scanned-clean    │
   │   CANNOT sign: released  ◄── (2)             │
   └──────────────────┬──────────────────────────┘
                      ▼
   ┌─────────────────────────────────────────────┐
   │ RELEASE APPROVAL — separate principal,       │
   │ separate attestor key, from the approver     │
   │ pool: owning team + named peers  ◄── (3)     │
   └──────────────────┬──────────────────────────┘
                      ▼
   ┌─────────────────────────────────────────────┐
   │ DEPLOY — pipeline SA is the ONLY principal   │
   │ with write access to prod  ◄── (4)           │
   │ scoped to this artifact and target  ◄── (5)  │
   └─────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────┐
   │ THE RESIDUAL POWER: pipeline administrators  │
   │  • pipeline config is code, same two-person  │
   │    rule  ◄── (6)                             │
   │  • membership small, named, reviewed         │
   │  • every action logged where they cannot     │
   │    alter it  ◄── (7)                         │
   └─────────────────────────────────────────────┘

   Cross-cutting: break-glass elevation is time-boxed, pages on use,
   and requires a retrospective — loudness is the property, not
   scarcity (8); the evidence claim is a query over the window showing
   author and approver never coincide (9).
```

**Every arrow explained:**

1. **Approver is not the author, enforced by the system** — convention
   fails under deadline pressure, and an auditor cannot distinguish
   convention from compliance without a record.
2. **The pipeline cannot self-release** — it may attest to its own work
   and not to somebody else's decision. Holding all three attestor keys
   in the pipeline makes the gate a formality.
3. **Approver pool spans teams** — small teams otherwise break the rule
   during holidays, and a rule that requires weekly exceptions isn't a
   rule.
4. **One deploying principal** — removes the parallel path that makes
   most separation designs cosmetic.
5. **Bounded deploy authority** — the pipeline ships what it ships and
   is not a project administrator, so a compromise is bad rather than
   total.
6. **Pipeline configuration is reviewed code** — the only way to
   constrain the administrator without pretending they don't exist.
7. **Administrator actions logged beyond their reach** — converts
   unconstrained power into visible power, which is the honest ceiling.
8. **Loud break-glass** — quiet emergency access is indistinguishable
   from no separation.
9. **Separation as a query** — an assertion about a period that cannot
   be queried is a policy statement, not a control.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Production write access | Pipeline identity only, no standing human access | Reduced human access with conditions | A conditional human path is still a path, and it becomes the fast path under pressure | When the platform has no reliable pipeline for some legacy component — then conditional access with heavy logging, on a dated exception |
| Release approval | Separate principal holding a separate attestor key | The pipeline records approval and proceeds | An approval the pipeline can produce for itself is not an approval | When approval is genuinely automated on objective criteria and the criteria themselves are reviewed as code |
| Approver pool | Owning team plus named peers | Owning team only | Small teams otherwise break the rule every holiday | When the domain is specialised enough that a peer cannot meaningfully review, making a cross-team approval a rubber stamp |
| Pipeline administrators | Constrained by reviewed config and loud logging | A second approval layer on administrative actions | Adds friction where the work is infrequent, without pretending the power was eliminated | When a regulator specifically requires dual control over the deployment mechanism itself |
| Emergency access | Time-boxed, paging, retrospective | Standing on-call elevated access | Loud and rare beats quiet and available | When incident response speed genuinely cannot tolerate an elevation step and the risk is consciously accepted |

**Making it concrete**

```hcl
# Human access to production is read-only and time-bounded even then.
# The deploy role belongs to the pipeline identity alone.
resource "google_project_iam_member" "oncall_read" {
  project = "PROJECT_ID"
  role    = "roles/viewer"
  member  = "group:grp-payments-prod-operator@example.com"
  condition {
    title      = "business-hours-review-window"
    expression = "request.time < timestamp(\"2027-01-01T00:00:00Z\")"
  }
}
```

The expiry is the point. A binding with no end date is a binding nobody
revisits, and access reviews are far easier when most grants remove
themselves.

**What a weak answer sounds like**

- "We require pull-request reviews." — necessary and nowhere near
  sufficient; the panel is asking about the deploy path, not the code
  path.
- "Only the security team can deploy to production." — that's a
  bottleneck and a new concentration of power, not a separation.
- "We trust our engineers." — the control exists for the compromised
  account and the audit, not because anyone is suspected.
- "Break-glass is available to on-call." — standing emergency access
  used quietly is the absence of separation with a name attached.

**Common wrong turns**

- **Designing approval while leaving direct access open.** The approval
  is bypassable and the design is decorative. Recover by removing
  standing human write access first.
- **Letting the pipeline hold every attestor key.** The gate becomes a
  formality. Recover by moving the release key to a separate group.
- **Ignoring the pipeline administrator.** The panel will ask, and not
  having thought about it reads as not having finished. Recover by
  naming them yourself.
- **Two-person rules that small teams cannot satisfy.** The exception
  becomes the process. Recover by designing cross-team pools.

**Follow-up probes the interviewer asks next**

1. **"Who can still do both, after all this?"** — a pipeline
   administrator, if they modify the pipeline. The design constrains
   them with reviewed configuration and unalterable logs rather than
   claiming they don't exist, and I'd rather state that ceiling than
   assert a completeness the architecture doesn't have.
2. **"Escalate: the pipeline service account is compromised. What can
   it do?"** — deploy an artifact that satisfies the policy to the
   targets it owns. It cannot mint the release attestation and cannot
   administer the project, so the damage is a bad deployment rather
   than a takeover. Detection is unusual deploys outside change
   windows, routed through `D4-Q08`.
3. **"Show an auditor that separation held for six months."** — one
   query over the change window listing author, approver, release
   attestation and deploying identity per production change. If that
   query needs assembling by hand, the claim is weaker than it sounds.
4. **"An engineer says this slows them down by a day."** — if it does,
   the approver pool is too small or approval is manual where it could
   be criteria-based. The fix is the pool or the criteria, not the
   rule, and this is exactly the conversation `D4-Q17` is about.
5. **"How does this work in a five-person startup?"** — it mostly
   doesn't, and I'd say so. Below a certain size the honest design is
   full logging, loud alerting on production changes, and a documented
   acceptance that separation is not achievable yet.

**Cross-references**

- `D4-Q07` for the attestor split this relies on; `D4-Q15` for what
  containment looks like when the pipeline identity is compromised.
- `D1-Q07` for the group and role model the approver pools sit in.
- `03-comparisons/06-iam-security-models.md` — IAM role-type matrix
  behind the narrow deploy role.

---

### D4-Q14 — "A government customer requires their data and its operations stay inside one country, including who can touch it. Design that."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 3.2, 1.3 |
| **Axis** | threat + obligation |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D1-Q10`, `D4-Q04` |

**What the interviewer is actually testing**

Whether you can tell residency from sovereignty, and whether you'll
name what the organisation gives up. Sovereign deployments cost
velocity, feature availability and operational uniformity, and a
candidate who presents one as free has not run one.

**Clarifying questions to ask before drawing anything**

- **Is the requirement data residency, operational sovereignty, or
  both?** Data staying in-country is a resource-location constraint.
  Restricting which personnel can access it, and from where, is a much
  larger commitment.
- **Does the obligation cover support and incident response?** If our
  own engineers outside the country cannot assist, the on-call model
  changes, and that is usually the expensive part nobody costs.
- **Which services does the contract actually require?** Sovereign
  environments do not carry every service or every feature, and
  discovering that after the architecture is drawn forces a redesign.
- **Is there a named framework, or is this a bespoke contract?** A
  recognised framework has a pre-mapped control package. A bespoke
  contract means hand-assembly and a much heavier evidence burden.
- **How many such customers do we expect?** One justifies a bespoke
  arrangement. Five justifies making sovereignty a product tier rather
  than a project.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Data must remain in one country | Stated | — | Resource-location constraint pinned at the tenant folder |
| Personnel access is restricted | Stated | — | Support and operations model changes, not just storage |
| Key material in-country | Assumed | "I'll assume keys follow the data; if key material must sit outside the provider entirely, that's external key management" | In-region key ring, possibly external |
| Deployment pipeline is separate | Assumed | "A shared pipeline reaching in would break the isolation claim" | Separate pipeline per the sovereign tier's definition |
| Not every service is available | Assumed | "I'd validate service availability against the contract before designing" | Prevents a redesign after commitments are made |

**The answer, out loud**

The first thing I'd establish is which of three requirements we're
meeting, because they're routinely bundled and they cost very different
amounts. Data residency means the bytes stay in a country — a
resource-location constraint and a regional key ring, and it's largely
a configuration exercise. Operational sovereignty adds a restriction on
who may access the data and from where, which reaches into our support
model, our on-call rotation and the provider's own personnel access.
Software sovereignty, the strongest form, adds a requirement to run
without dependency on services outside the jurisdiction, and that one
constrains the architecture itself. I'd ask which we're signing up to
before drawing, because the third is a different company from the
first.

Assuming residency plus operational sovereignty, this maps onto the
existing tenancy model as the sovereign tier. That tier already means
three things in our platform: resource locations pinned by
organizational policy at the tenant folder, an in-region key ring, and
a separate deploy pipeline. I'd emphasise that this is a tier and not a
bespoke build, because the alternative — a hand-built environment for
one customer — is the thing that becomes unmaintainable and drifts out
of compliance within a year.

For the control package, my default is Assured Workloads rather than
hand-assembly, when the obligation maps to a recognised framework. It
wraps the tenant folder and pre-maps resource location, personnel
restriction and key management requirements to the framework, and the
audit defensibility argument is real: a named framework's control set,
provably applied, is far easier to evidence than an equivalent set we
assembled ourselves and must now argue is equivalent. Where I would
hand-assemble instead is a bespoke contract with unusual requirements
no framework covers, and there I'd be explicit that we're taking on a
continuing obligation to detect and close drift ourselves.

The provider-personnel half is the part candidates skip. Restricting
our own staff is IAM and group membership plus conditions on where
access can originate. Restricting the provider's staff is a different
mechanism — the compliance programme's personnel controls, plus
transparency logging so we can see and evidence any provider-side
access. Without that feed we cannot answer the contract's question
about vendor access at all, and it is not something our own audit logs
can produce.

Then the costs, which I'd raise unprompted because a panel will
otherwise assume I haven't hit them. Service availability is narrower
in a sovereign environment, so an architecture that works in our main
estate may not port directly. Feature lag is real — capabilities arrive
later. The separate pipeline means a change ships twice and can diverge,
so I'd want the sovereign deployment built from the same source with
different parameters rather than from a forked repository, because a
fork is where the drift starts. And on-call is restricted to eligible
personnel, which for a small company can mean a rotation of three
people, which is a reliability problem disguised as a compliance one.

The thing I'd insist on is that the sovereign tier is one-directional.
A tenant can be promoted into it and cannot be demoted out, because
once data has existed under a sovereign obligation, the claim that it
never left cannot be reconstructed after moving it. Designing for
demotion produces an ambiguity nobody can resolve during an audit.

**Architecture**

```
   fldr-tenants
        │
        ▼
   ┌───────────────────────────────────────────────────┐
   │  fldr-tenant-<tid>   — SOVEREIGN TIER  ◄── (1)     │
   │                                                    │
   │   Org Policy at THIS folder:                       │
   │     constraints/gcp.resourceLocations → one region  │
   │                                      ◄── (2)        │
   │                                                    │
   │   Assured Workloads wraps this folder:              │
   │     data location + personnel controls  ◄── (3)     │
   │                                                    │
   │   prj-<tid>-app-prod      prj-<tid>-data-prod       │
   │          │                       │                  │
   │          ▼                       ▼                  │
   │   in-region key ring     in-country storage         │
   │   ◄── (4)                                           │
   │                                                    │
   │   own perimeter, not bridged to the main estate     │
   │                                      ◄── (5)        │
   └────────────────┬──────────────────────────────────┘
                    ▲
                    │ (6) SEPARATE pipeline — same source,
                    │     different parameters, never a fork
   ┌────────────────┴──────────────────────────────────┐
   │ eligible-personnel on-call rotation  ◄── (7)       │
   │ provider-side access visible via transparency ◄(8) │
   └────────────────────────────────────────────────────┘

   Cross-cutting: promotion into this tier is one-directional, because
   "the data never left" cannot be reconstructed after a move (9);
   service and feature availability is narrower here and must be
   validated against the contract before committing an architecture
   (10).
```

**Every arrow explained:**

1. **A tier, not a bespoke build** — a hand-built environment for one
   customer drifts out of compliance within a year and cannot be
   reproduced for the second customer.
2. **Resource locations pinned at the tenant folder** — the constraint
   attaches once and inherits to every project underneath, which is why
   the folder, not the project, is the unit.
3. **Assured Workloads over hand-assembly** — pre-mapped
   controls are dramatically easier to evidence than an assembled set
   we must argue is equivalent.
4. **In-region key ring** — keys follow the data; a key ring in another
   region defeats the residency claim regardless of where the
   ciphertext sits.
5. **Own perimeter, unbridged** — bridging the sovereign tenant to the
   main estate reintroduces exactly the reachability the tier exists to
   remove.
6. **Separate pipeline from shared source** — separate so the isolation
   claim holds, shared source so the two deployments cannot silently
   diverge.
7. **Eligible-personnel rotation** — the operational cost most
   frequently omitted, and a genuine reliability risk at small scale.
8. **Transparency feed for provider access** — the only way to answer
   the contract's vendor-access question.
9. **One-directional promotion** — demotion creates a claim nobody can
   substantiate afterwards.
10. **Narrower service availability** — validate before committing an
    architecture, not after.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Control package | Assured Workloads for a named framework | Hand-assembled equivalent controls | Pre-mapped and provable, with the framework maintained as requirements evolve | When the contract is bespoke and no framework covers it — then hand-assembly, with the drift-detection burden accepted explicitly |
| Environment shape | A tenancy tier applied to a tenant folder | A separate organization for the customer | Keeps one policy plane, one evidence architecture and one platform to maintain | When the contract requires a legally distinct entity operating the environment, which no folder boundary can satisfy |
| Deployment | Separate pipeline, shared source | Fork the repository for the sovereign build | A fork diverges and the divergence is invisible until an audit | When the sovereign environment genuinely cannot run the same code and the difference is structural rather than configurational |
| Keys | In-region key ring under the tier | External key management outside the provider | Residency and revocability without a new external availability dependency | When the contract states key material must never reside in the provider's infrastructure — then external is the only answer |
| Tier direction | Promotion only | Allow demotion when a contract ends | A demoted tenant's history cannot be reconstructed to support the claim it was ever isolated | When the data is fully deleted on contract end and the tenant is a new tenant thereafter, not a demoted one |

**What a weak answer sounds like**

- "We'd deploy to a region in that country." — residency is the easy
  third of this; personnel access and operational restrictions are the
  rest.
- "We'd use the compliance product, so we're compliant." — it applies
  a control package and does not cover the workload-specific access
  design, the pipeline, or the on-call model.
- "It's the same architecture, just in a different region." — feature
  and service availability differ, and discovering that after
  commitments are made forces a redesign under contractual pressure.
- "We'd keep one pipeline and target the sovereign projects from it." —
  that breaks the isolation claim the customer is paying for.

**Common wrong turns**

- **Conflating residency with sovereignty.** The design meets the
  easiest interpretation and the contract meant the hardest. Recover by
  separating the three levels out loud.
- **Building it bespoke for the first customer.** It works and cannot
  be reproduced or maintained. Recover by making it a tier.
- **Forking the code.** The sovereign deployment diverges silently.
  Recover by parameterising instead.
- **Ignoring on-call eligibility.** The compliance design creates a
  reliability problem. Recover by naming the rotation constraint as a
  cost.

**Follow-up probes the interviewer asks next**

1. **"An engineer outside the country is the only one who can fix a
   production issue. Now what?"** — they cannot access it, and that is
   the control working as contracted. What must exist beforehand is an
   eligible on-call rotation deep enough to cover this, and if it isn't
   deep enough, that's a gap to raise before signing rather than during
   an outage.
2. **"Escalate: what's the blast radius if the sovereign tenant's
   environment is compromised?"** — bounded to that tenant, because the
   perimeter is unbridged and the pipeline is separate. That isolation
   is the return on the operational cost, and it's worth stating in
   exactly those terms.
3. **"How many of these can we support?"** — one is a project, several
   is a product. If we expect more, the eligible-personnel model and
   the pipeline parameterisation need to be built for the general case
   immediately, because retrofitting them while under multiple
   contracts is much harder.
4. **"Who owns this in two years?"** — platform owns the tier, a named
   compliance owner owns the framework mapping, and the customer
   relationship owns the contract's evolution. Sovereign environments
   decay quietly because nobody is looking at them, so a review cadence
   is part of the design.
5. **"The customer asks for a control the framework doesn't
   include."** — hand-add it, document it as an addition to the
   package, and evidence it separately. What I would not do is abandon
   the framework to hand-assemble everything, because the framework is
   carrying the defensibility of everything else.

**Cross-references**

- `03-comparisons/06-iam-security-models.md` — the compliance
  mechanism matrix on managed programme versus hand-assembly.
- `02-services/04-security-iam.md` — what the compliance programme
  automates and where it stops.
- `D1-Q10` for residency across many countries; `D4-Q04` for the key
  model; `D4-Q11` for the evidence the framework expects.

---

### D4-Q15 — "A service account is being used from somewhere it shouldn't be. Walk me through the next fifteen minutes."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 3.1, 6.1 |
| **Axis** | threat + obligation |
| **Whiteboard time** | 30–40 min |
| **Reads well after** | `D4-Q08` |

**What the interviewer is actually testing**

Whether containment is pre-built or improvised. Everything in a good
answer here had to exist before the incident: the query that finds the
blast radius, the group whose removal cuts access, the named humans who
can act at 3am. A candidate who describes what they would figure out
during the incident is describing an incident that goes badly.

**Clarifying questions to ask before drawing anything**

- **How do we know?** A posture finding, a partner report, and a bill
  spike are different confidence levels, and the first action differs
  because a false positive that halts production is its own incident.
- **Is the workload customer-facing right now?** Containment that
  breaks production during business hours needs a decision-maker, and
  that person should be identified before the incident, not summoned
  during it.
- **Do we know what that identity can reach?** If that takes an hour to
  determine, the first hour is reconnaissance instead of containment,
  which is the single biggest predictor of a bad outcome.
- **Is there any long-lived credential involved?** A federated
  short-lived token expires on its own; an exported key does not, and
  the containment steps diverge immediately.
- **Who is authorized to cut access without further approval?** If the
  answer is "nobody at 3am," the response time is set by a person's
  sleep schedule.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Containment in minutes, not hours | Stated | — | Every step must be pre-built; nothing can be authored during the incident |
| Blast radius is knowable immediately | Assumed | "A standing query listing an identity's bindings and recent activity" | Pre-written queries per `D4-Q11` |
| Someone can act without approval | Assumed | "A named on-call group with the authority to cut access, paged automatically" | Authority is part of the design |
| Evidence is preserved before change | Assumed | "Containment alters state; the record must be captured first" | Snapshot before revoke |
| Identities are narrow | Assumed | "One identity per workload purpose, or containment means breaking many things" | The design depends on `D4-Q05`'s identity model |

**The answer, out loud**

I'd say at the start that almost none of the fifteen minutes is
thinking. The reason this can be done in fifteen minutes is that five
things were built beforehand: the detection that fires, the standing
query that answers what the identity can reach, the narrow identity
design that makes revocation survivable, the named group with authority
to act, and the perimeter that already bounded the damage while we were
asleep. If any of those is missing, this becomes a two-hour incident
and I'd rather say that than pretend otherwise.

The sequence is: confirm, preserve, contain, scope, recover.

Confirm, because a false positive that halts production is its own
incident. The finding carries the identity, the resource, the source
and a time window. The quick check is whether the access pattern is
genuinely anomalous against that identity's baseline or whether a
legitimate job moved. Two minutes, not twenty.

Preserve, because containment changes state. Before revoking anything I
capture the identity's current bindings, its recent activity from the
audit stream, and the finding itself. This is one query, already
written, and it matters because after revocation we can no longer
reconstruct what the identity could have done, and that question is the
entire breach assessment.

Contain, and the specific action depends on the credential type. If
it's a federated identity, removing the workload identity pool binding
stops any new token exchange and existing tokens expire in minutes —
that is the single fastest cut available, which is one of the strongest
arguments for the keyless design in the first place. If an exported key
is involved, the key must be disabled explicitly, and until it is the
attacker retains access, which is why the org policy forbidding key
creation is a containment control and not only a hygiene one. In both
cases I also remove the identity's IAM bindings, disable the service
account, and — if data access is the concern and the identity's key
usage is implicated — consider disabling the key it uses, which is a
much bigger hammer because it takes out every workload sharing that
key.

Scope, using the preserved evidence. What could that identity read,
what did it actually touch in the window, and did anything leave the
perimeter. The last part is usually the good news: if the perimeter
held, the exfiltration path was blocked even though the credential was
valid, which turns a breach into an access incident. That distinction
is the difference between a notification obligation and an internal
finding, and it is the concrete return on `D4-Q03`.

Recover, which means a new identity for the workload rather than
re-enabling the old one, and a root cause. The two causes worth naming
are a leaked credential and an over-broad grant that made a routine
compromise catastrophic. The second is the more common and the more
fixable.

What I'd flag unprompted is the practice requirement. Every step above
is a runbook, and a runbook nobody has executed is a document. I'd run
this as a rehearsal on a non-production identity on a cadence, because
the first time anyone runs the containment query should not be during
the incident.

**Architecture**

```
  DETECT ──► CONFIRM ──► PRESERVE ──► CONTAIN ──► SCOPE ──► RECOVER

  (1) t+0   finding fires from the posture pipeline: identity,
            resource, source, window. Pages the named on-call group.
            FAILS IF: no owner label on the resource, so nothing routes.
               │
               ▼
  (2) t+2    confirm against the identity's baseline. Anomalous, or a
            legitimate job that moved?
            FAILS IF: no baseline exists, and every finding becomes a
            judgment call under time pressure.
               │
               ▼
  (3) t+4    PRESERVE FIRST: standing query captures current bindings,
            recent activity, the finding.
            FAILS IF: run after revocation — the evidence of what the
            identity could reach no longer exists.
               │
               ▼
  (4) t+6    CONTAIN, by credential type:
              federated  → remove the pool binding; live tokens expire
                           in minutes  ◄── the fast path
              exported key → disable the key explicitly, or access
                           continues
              plus: remove IAM bindings, disable the service account
            FAILS IF: the identity is shared across workloads — then
            containment is an outage and someone hesitates.
               │
               ▼
  (5) t+10   SCOPE from the preserved evidence: what could it read,
            what did it touch, did anything cross the perimeter?
            FAILS IF: data access logging was off for that store, and
            the answer is unknowable.
               │
               ▼
  (6) t+15   RECOVER: new identity, not the old one re-enabled. Root
            cause is either a leaked credential or an over-broad grant.
            FAILS IF: the grant is restored as-is and the next
            compromise is identical.

   Cross-cutting: the perimeter already bounded exfiltration before
   anyone woke up, which is what turns a breach into an access incident
   (7); every step above is a rehearsed runbook, exercised on a
   non-production identity on a cadence (8).
```

**Every arrow explained:**

1. **Detection routes and pages** — containment speed starts at the
   routing design, and an unrouted finding means the clock starts
   whenever somebody happens to look.
2. **Confirm against a baseline** — without one, every response is a
   judgment call made under time pressure, and false positives that
   halt production teach people to hesitate.
3. **Preserve before containing** — revocation destroys the evidence of
   what was reachable, which is the breach assessment itself.
4. **Containment differs by credential type** — federated bindings cut
   in minutes; exported keys must be disabled explicitly, which is the
   containment argument for the keyless policy.
5. **Scope from preserved evidence** — answerable only if data access
   logging was on for the stores involved, per `D4-Q11`.
6. **Recover with a new identity** — re-enabling the old one preserves
   the unknown, and restoring the same grant guarantees a repeat.
7. **The perimeter already worked** — it bounded exfiltration while
   everyone was asleep, which is the concrete return on `D4-Q03`.
8. **Rehearsal** — a runbook nobody has run is a document, and the
   first execution should not be the real one.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| First action | Preserve, then contain | Contain immediately | Revocation destroys the record of what was reachable, and that record is the breach assessment | When active exfiltration is confirmed and ongoing — then containment first and accept a thinner assessment |
| Containment scope | The single workload identity | Disable the key the workload uses | Narrow containment doesn't take out every workload sharing the key | When the key itself is implicated or data confidentiality outweighs availability for every dependent workload |
| Authority | Named on-call group acts without approval | Escalate to a decision-maker first | Approval chains at 3am set response time by a person's sleep schedule | When the containment action would halt a customer-facing service and the business impact genuinely needs an owner |
| Recovery | New identity | Re-enable the old one after investigation | The old identity's exposure is never fully knowable | When the identity is deeply embedded in configuration and reissuing it is a multi-day change — then rotate credentials and keep the identity, with the residual risk recorded |
| Rehearsal | Scheduled exercises on non-production identities | Rely on the runbook being correct | Runbooks drift; the query that worked last year references a schema that changed | When the team runs real incidents often enough that rehearsal adds nothing to their practice |

**Making it concrete**

```bash
# PRESERVE FIRST. This runs before anything is revoked, because after
# revocation the record of what the identity could reach is gone.
gcloud projects get-iam-policy PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:sa-suspect@PROJECT_ID.iam.gserviceaccount.com" \
  --format=json > /tmp/preserved-bindings.json

# THEN contain.
gcloud iam service-accounts disable \
  sa-suspect@PROJECT_ID.iam.gserviceaccount.com --project=PROJECT_ID
```

Both commands exist in the runbook before the incident. Writing the
first one at 3am is how the preservation step gets skipped, and the
preservation step is the one that determines whether the breach
assessment is possible at all.

**What a weak answer sounds like**

- "We'd revoke the service account immediately." — correct instinct,
  wrong order; the evidence of what it could reach disappears with it.
- "We'd investigate to understand the scope first." — investigation
  before containment while exfiltration continues, and the scope work
  should already be one pre-written query anyway.
- "We'd escalate to the security team." — the panel is asking what
  happens in fifteen minutes, and an escalation with no defined
  authority is a delay.
- "We'd check the logs." — which logs, filtered how, and were they
  enabled for that store? The absence of specifics is the answer.

**Common wrong turns**

- **Containing before preserving.** The breach assessment becomes
  guesswork. Recover by making preservation step one in the runbook.
- **Discovering the blast radius during the incident.** The first hour
  becomes reconnaissance. Recover by pre-writing the query.
- **Shared identities.** Containment is an outage, so people hesitate,
  and hesitation is the actual damage. Recover by tying this back to
  the one-identity-per-purpose rule.
- **Never rehearsing.** The runbook references a query that no longer
  works. Recover by scheduling the exercise.

**Follow-up probes the interviewer asks next**

1. **"It turns out to be a legitimate job someone moved. What did
   your response cost?"** — an outage for that workload and some
   credibility. That's why confirm is a step, and why detections whose
   false-positive rate is high should route to a ticket rather than a
   page.
2. **"Escalate: it isn't one identity, it's the pipeline identity, and
   it has been deploying for two days."** — now every artifact deployed
   in the window is suspect, the deploy gate's attestation history
   becomes the scoping tool, and containment means stopping the
   pipeline as well as the identity. This is the scenario `D4-Q13`'s
   bounded deploy authority exists for.
3. **"How do you know exfiltration didn't succeed?"** — the perimeter's
   denial records and the data access logs for the stores involved.
   If data access logging was off for a store, the honest answer is
   that we cannot fully rule it out, and I'd say that rather than
   claim a certainty the evidence doesn't support.
4. **"Who has the authority to break production to contain?"** — a
   named on-call group, defined in advance, with the business impact
   threshold above which they call someone. Deciding this during an
   incident costs more time than any technical step.
5. **"How does this change at 200 teams?"** — containment stays fast
   because it is identity-scoped, but the paging routing and the
   authority model have to be per-domain rather than central, or the
   central group becomes the bottleneck in every incident.

**Cross-references**

- `D4-Q08` for the detection that starts this; `D4-Q11` for the
  evidence that makes scoping possible.
- `D4-Q03` for the perimeter that bounds exfiltration before anyone
  responds; `D4-Q05` and `D4-Q06` for the identity design containment
  depends on.
- `D1-Q11` for the break-glass mechanics this shares.

---

### D4-Q16 — "A partner needs our data to do their job. They must never get a route into our network. Design it."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 3.1, 3.2 |
| **Axis** | threat + obligation |
| **Whiteboard time** | 30–40 min |
| **Reads well after** | `D4-Q09` |

**What the interviewer is actually testing**

Whether you reach for connectivity when the requirement is data. The
instinctive answer to "a partner needs access" is a network path, and
the better answer is usually that they need a dataset, a file, or an
API result — none of which requires them to be reachable from our
network or us from theirs.

**Clarifying questions to ask before drawing anything**

- **What do they actually do with it?** Analysis over a dataset, a
  nightly file feed, and per-record lookups are three different
  deliveries, and only one of them looks anything like access.
- **Do they need it fresh, or is daily fine?** Freshness is what pushes
  a design from a shared dataset toward a live interface, and it's
  usually asserted rather than required.
- **What is the minimum field set?** Partners routinely ask for a table
  and need six columns of it. The narrowest deliverable is the whole
  design.
- **What happens contractually when the relationship ends?** If the
  answer involves asking them to delete their copy, I should prefer a
  delivery mechanism we can switch off rather than one we have to trust
  them to unwind.
- **Are they subject to the same obligations we are?** If our data is
  regulated, their handling of it is our exposure, and that shapes what
  we're willing to hand over at all.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| No network route in either direction | Stated | — | Rules out peering and any tunnel arrangement |
| They need data, not our systems | Assumed | "I'll assume the requirement is a dataset or a result, not reachability" | Reframes the problem from connectivity to delivery |
| Minimum field set only | Assumed | "I'd deliver a view, not a table" | Makes projection the primary control |
| Access must be revocable by us alone | Assumed | "One binding we remove, not a copy we ask them to delete" | Favours in-place sharing over file transfer |
| Their usage is visible to us | Assumed | "We should see what they read and how much" | Adds access logging and volume baselining |

**The answer, out loud**

I'd start by refusing the framing gently. "Access to our data" almost
always decomposes into a specific deliverable, and the design gets much
better once we name it. If they need to analyse a dataset, they need a
dataset. If they need to enrich records, they need an interface. If
they need a nightly reconciliation, they need a file. None of those
requires a network route, and a network route is the most expensive
thing we could give them because it's the hardest to reason about and
the hardest to withdraw.

My preferred shape is in-place sharing: the partner reads a curated
view of our data, in our estate, under an identity we control, without
a copy ever being made. The properties I care about are that we project
only the fields they need, that we can revoke by removing one binding
rather than by asking them to delete something, and that every read is
attributable to their identity. Compared to sending files, this is
categorically better on all three, because a file we sent is a file we
no longer control.

Identity is federated, exactly as in `D4-Q06`: the partner
authenticates against their own provider, exchanges for a short-lived
credential, and impersonates a service account we own. The important
detail is that the identity is ours. If we instead grant a role to
their domain identities, revocation and attribution both partly depend
on their identity management, and their offboarding becomes our
exposure.

The data they see is a view, never the base table. Projection removes
fields they don't need, and filtering removes rows outside their scope,
and both happen server-side so the narrowing is a property of what
exists for them rather than of what they promise to query. Where the
data is regulated, the view is de-identified through the same
transformation path as `D4-Q10`, which frequently means the partner
never receives identifying content at all — and that is usually
achievable, because their actual need is a pattern rather than a
person.

If the partner genuinely needs per-record lookups rather than bulk
analysis, then it's an interface rather than a dataset, and that's the
`D4-Q09` shape: a published service, one operation, no network route,
quota per identity. The quota matters for the same reason it did there
— per-record lookups performed a few million times are a bulk export
performed slowly.

The case I'd handle explicitly is the partner who insists on a file
into their own environment. Sometimes their tooling genuinely cannot do
anything else. Then it's a transfer, and the controls change shape: a
narrow export produced by a job we run, delivered to a destination they
control, encrypted, with a manifest recorded on our side saying exactly
what left and when. I'd be honest that this is a weaker design — once
the bytes are theirs, our controls end and we are relying on contract.
So I'd push for in-place sharing and accept transfer only against a
real constraint, with the reduced control stated rather than implied.

Offboarding is where this design earns itself. With in-place sharing,
ending the relationship is removing a binding, and the evidence that
access ended is the absence of further reads in the audit stream. With
a file transfer, ending the relationship is a request and a promise.
That difference is worth more than it sounds during the conversation
where a contract ends badly.

**Architecture**

```
   PARTNER                                  OUR ESTATE
   ───────                                  ──────────

   partner analyst / system
        │
        │ (1) federated token exchange with
        │     their own IdP → short-lived
        │     credential impersonating an
        │     identity WE own
        ▼
   ┌──────────────────────────────────────────────────┐
   │  CURATED VIEW  ◄── (2)                            │
   │   projection: only the fields they need           │
   │   filter: only the rows in their scope            │
   │   de-identified where the class requires  ◄── (3) │
   └───────────────┬──────────────────────────────────┘
                   │ reads in place — NO COPY  ◄── (4)
                   ▼
   ┌──────────────────────────────────────────────────┐
   │  base data stays inside our perimeter  ◄── (5)    │
   └──────────────────────────────────────────────────┘

   every read attributable + volume baselined  ◄── (6)

   ── if they truly cannot read in place ───────────────
   ┌──────────────────────────────────────────────────┐
   │ TRANSFER: narrow export, job we run, encrypted,   │
   │ manifest recorded of exactly what left  ◄── (7)   │
   │ weaker by design — controls end at the boundary   │
   └──────────────────────────────────────────────────┘

   Cross-cutting: no peering, no tunnel, no partner project inside any
   perimeter (8); offboarding is removing one binding, and the evidence
   it ended is the absence of further reads (9).
```

**Every arrow explained:**

1. **Federated to an identity we own** — revocation and attribution
   stay entirely ours rather than depending on the partner's identity
   management and offboarding discipline.
2. **A curated view, never the base table** — narrowing is a property
   of what exists for them, not of what they promise to query.
3. **De-identification where the class requires it** — partners usually
   need a pattern rather than a person, and discovering that removes
   most of the risk.
4. **Read in place, no copy** — a copy we sent is a copy we no longer
   control, which is the single biggest difference between these two
   designs.
5. **Base data stays inside the perimeter** — the partner reads a
   projection; the underlying store never becomes reachable.
6. **Attributable reads with a baseline** — the finding worth having is
   a partner's read volume departing from its normal pattern.
7. **Transfer as the weaker fallback** — legitimate when their tooling
   forces it, and stated as weaker rather than presented as equivalent.
8. **No network route in either direction** — the explicit requirement,
   and the thing a peering-based answer quietly violates.
9. **Offboarding as one binding removal** — with evidence, versus a
   request and a promise.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Delivery shape | In-place read of a curated view | File transfer into their environment | We keep projection, revocation and attribution; they get no copy | When their tooling genuinely cannot read in place — then a narrow, manifested, encrypted export with the weaker control stated |
| Identity | Federated into an identity we own | Grant roles directly to their domain identities | Revocation and attribution don't depend on their offboarding discipline | When the partner is effectively part of our organization and domain restrictions already cover them |
| Data shape | Projected and filtered view | Full table with a contractual restriction on use | A contract does not stop a query; a view does | When the partner's analysis genuinely requires the full field set and de-identification would destroy its value |
| Fresh data | Scheduled refresh of the view | A live interface per record | Simpler surface, no quota management, no request-path dependency | When they need per-record lookups in real time — then it becomes the published-service shape with a quota |
| Network | No route in either direction | Peering with firewall restrictions | The requirement was explicitly no route, and peering grants reachability first and subtracts afterwards | When the partner operates infrastructure on our behalf inside our trust boundary, which makes them an operator rather than a partner |

**What a weak answer sounds like**

- "We'd set up a tunnel and restrict it with firewall rules." — grants
  reachability and then subtracts, which is the wrong direction and the
  thing the question explicitly ruled out.
- "We'd export the data nightly to a shared location." — sometimes
  necessary and always weaker; proposing it first skips the design that
  keeps control.
- "We'd give them a read-only role on the dataset." — read-only on what
  exactly? Without projection and filtering they see fields and rows
  they have no need for.
- "The contract says they can only use it for the agreed purpose." — a
  contract is a remedy, not a control.

**Common wrong turns**

- **Hearing "access" and designing connectivity.** The answer becomes a
  network diagram for a data problem. Recover by asking what the
  deliverable actually is.
- **Sharing the table rather than a view.** It's faster and it hands
  over everything. Recover by projecting while still drawing.
- **Granting to their domain identities.** Offboarding becomes theirs
  to get right. Recover by federating into an identity we own.
- **Treating transfer as equivalent.** It isn't, and presenting it as
  such hides the loss of control. Recover by stating the difference.

**Follow-up probes the interviewer asks next**

1. **"The partner is acquired by a competitor. What do you do?"** —
   remove the binding, which ends access immediately with evidence. If
   we had been sending files, the answer would be a letter, and that
   difference is the whole argument for in-place sharing.
2. **"Escalate: the partner's environment is breached. Our
   exposure?"** — whatever their identity could read in the window,
   bounded by the view's projection and their quota, and visible in the
   read logs. If we had exported, the exposure is every file we ever
   sent, forever.
3. **"They say they need the raw data for their models."** — then we're
   in a contractual and classification conversation, not an access one.
   For regulated content my default is no, and the counter-offer is
   either a de-identified view or inference against our endpoint per
   `D4-Q09`.
4. **"How do you detect misuse?"** — read volume and query-shape
   deviation from their baseline. A partner whose analytical queries
   suddenly become full scans is extracting, not analysing.
5. **"Who owns this relationship in two years?"** — a named business
   owner with a review date, alongside the technical owner. The failure
   mode is partner access that outlives the contract because the person
   who set it up left, and a review date is the only thing that catches
   it.

**Cross-references**

- `D4-Q09` for the published-service shape when the partner needs an
  interface rather than a dataset.
- `D4-Q06` for the federation handshake; `D4-Q10` for the
  de-identification that usually makes this easy.
- `D4-Q03` for why no partner project joins a perimeter.

---

### D4-Q17 — "Your controls are being routed around. Design the system that makes the secure path the easy one."

| | |
|---|---|
| **Band** | Principal |
| **Primary domain leaves** | 3.1, 4.2 |
| **Axis** | threat + obligation |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D1-Q06`, `D1-Q11` |

**What the interviewer is actually testing**

Whether you can design a security operating model rather than a control
set. At the principal band the question is not which controls to
choose — it's how controls get chosen, enforced, excepted and retired
such that engineers comply because compliance is the path of least
resistance, not because they were told to. This absorbs the older
behavioural question about communicating security requirements, and
treats it as architecture, because persuasion doesn't scale and
architecture does.

**Clarifying questions to ask before drawing anything**

- **Where are people actually routing around today?** The specific
  bypasses are the requirements document. If nobody can name one,
  either the controls are working or nobody is looking.
- **How long does the compliant path take versus the bypass?** If
  compliant is slower by a factor people notice, no amount of
  communication fixes it, and the fix is latency, not messaging.
- **Who currently decides that something is a gate?** If it's whoever
  feels strongly, the catalogue grows monotonically and nobody can
  explain why any individual control exists.
- **Is there a record of exceptions, and does anyone read it?** The
  exception rate is the highest-quality feedback the system produces,
  and most organisations don't collect it.
- **What happened the last time a control caused an incident?** The
  answer tells me whether this organisation can demote a control, which
  determines whether the whole model is viable.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Engineers currently bypass some controls | Stated | — | The design target is the bypass, not the control |
| Guardrails and gates are different instruments | Assumed | "A guardrail shapes the default path; a gate stops and waits for a human" | Determines which controls qualify for which |
| Gates must be few | Assumed | "Every gate is a queue with a person at the front of it" | Forces an explicit budget on gates |
| Exception data feeds the catalogue | Assumed | "Exception rate is the evidence for promoting or demoting a control" | Couples this to `D1-Q11`'s register |
| Controls can be retired | Assumed | "A catalogue that only grows is a catalogue nobody believes" | Makes demotion a designed act |

**The answer, out loud**

I'd separate two instruments that get used interchangeably and
shouldn't be. A guardrail shapes the default path so the secure thing
happens without anyone choosing it — a project that arrives already
compliant, a module that already has the right settings, a policy that
makes the insecure configuration impossible to create. A gate stops
work and waits for a human decision. Guardrails scale; gates are
queues. Every gate has a person at the front of it, and the length of
that queue is the friction budget the whole security programme spends.

So the first design rule is that gates need a budget and guardrails
don't. I'd say out loud how many gates production has — a small number,
each individually defensible to an engineer who is annoyed by it — and
adding one should require removing one or making an explicit case for
raising the budget. Without a budget, every incident adds a gate and
none are ever removed, and within two years the compliant path is slow
enough that routing around it is rational behaviour.

The second rule is that the compliant path has to be the fastest path.
This is where security architecture becomes platform work. If the
supported way to get a database is a module that produces a compliant
one in minutes, and the bypass is provisioning by hand, nobody bypasses
— not because they were told not to, but because the compliant path is
less work. If the supported way takes three days and a ticket, people
route around it and the control is decorative regardless of how firmly
it is stated. When I find a bypass, my first question is what the
compliant path costs, and I fix that before I strengthen enforcement.

The third rule is that every gate has an exception path with a clock,
and every exception is data. That's the register in `D1-Q11`, and the
critical part is what we do with it. If one constraint accumulates
exceptions, that constraint is wrong or the platform has a gap, and
either the control gets demoted to detection or the platform builds the
capability people keep needing. If nothing ever moves in that
direction, the register is paperwork and engineers learn that the
exception process is a tax rather than a feedback channel.

The fourth rule is demotion, and it's the one organisations find
hardest. A control that has generated no findings in a year is either
perfectly effective or measuring nothing, and the only way to tell is
to examine it rather than leave it running. A control whose exception
rate is high is producing paperwork, not safety. I'd run a periodic
review of the catalogue with exception rate and finding rate attached,
and I'd expect controls to leave it. A catalogue that only grows tells
engineers that security never reconsiders anything, which is exactly
the belief that makes them route around it.

On the communication question that sits inside this one: I'd argue the
most effective communication is architecture. Telling teams why a
control exists helps at the margin. Making the compliant path the
fastest path works without anyone being told. Where communication does
matter is in two specific places — when a control is introduced, teams
need to know what it blocks and what the exception path is, or the
first denial reads as an outage; and when a control is demoted or
removed, saying so publicly is what makes the catalogue credible. The
security team that only ever announces new restrictions is heard as an
obstacle; the one that also announces removals is heard as an engineer.

The measurement I'd take to leadership is not control coverage. It's
the ratio of compliant-path usage to bypass usage, the exception rate
per control, and the time the compliant path takes compared with the
alternative. Coverage says how many rules exist. These three say
whether the rules are load-bearing.

**Architecture**

```
   a risk is identified
          │
          ▼
   ┌───────────────────────────────────────────────┐
   │ (1) CAN THE DEFAULT PATH ABSORB IT?            │
   │     a module, a vended default, a policy that  │
   │     makes the bad state impossible             │
   └───────┬───────────────────────────────┬───────┘
        yes│                            no │
           ▼                               ▼
   ┌────────────────────┐      ┌──────────────────────────┐
   │ GUARDRAIL  ◄── (2) │      │ (3) DOES A HUMAN NEED TO  │
   │ no queue, no human │      │     DECIDE, EVERY TIME?   │
   │ scales freely      │      └────┬─────────────┬────────┘
   └────────────────────┘        yes│          no │
                                    ▼             ▼
                          ┌──────────────┐  ┌──────────────┐
                          │ GATE ◄── (4) │  │ DETECTION    │
                          │ costs from a │  │ owner+clock  │
                          │ fixed budget │  │   ◄── (5)    │
                          └──────┬───────┘  └──────────────┘
                                 │
                                 ▼
                   ┌──────────────────────────────┐
                   │ EXCEPTION PATH, with a clock  │
                   │ (D1-Q11)  ◄── (6)             │
                   └──────────────┬───────────────┘
                                  ▼
                   ┌──────────────────────────────┐
                   │ EXCEPTION RATE = EVIDENCE     │
                   │  high rate → demote, or build │
                   │  the capability  ◄── (7)      │
                   └──────────────┬───────────────┘
                                  ▼
                   ┌──────────────────────────────┐
                   │ PERIODIC CATALOGUE REVIEW —   │
                   │ controls leave it  ◄── (8)    │
                   └──────────────────────────────┘

   Cross-cutting: the compliant path must be the fastest path; when a
   bypass is found, fix the path's latency before strengthening
   enforcement (9); removals are announced as loudly as additions, or
   the catalogue loses credibility (10); the leadership metric is
   compliant-versus-bypass usage and exception rate, never control
   count (11).
```

**Every arrow explained:**

1. **Default-path absorption is the first question** — most risks can
   be handled by changing what teams get by default, and that costs no
   friction at all.
2. **Guardrails scale** — no queue, no human in the loop, and the
   secure outcome happens without anyone choosing it.
3. **The gate test** — a human must decide *every time*, not merely
   *sometimes*. If the answer is sometimes, it's detection with an
   owner, not a gate.
4. **Gates draw from a fixed budget** — adding one means removing one
   or making the case to raise the budget; otherwise gates accumulate
   until the compliant path is irrational.
5. **Detection as the default home** — most controls belong here, per
   `D1-Q06`, because most have legitimate exceptions.
6. **Every gate has an exception path with a clock** — a gate without
   one produces shadow infrastructure rather than compliance.
7. **Exception rate as evidence** — the highest-quality feedback the
   system generates, and the input to demotion or platform investment.
8. **Controls leave the catalogue** — a catalogue that only grows
   teaches engineers that security never reconsiders, which is the
   belief behind routing around.
9. **Fix latency before enforcement** — when compliant is slower than
   the bypass, bypassing is rational and no messaging changes it.
10. **Announce removals** — the team that only announces restrictions
    is heard as an obstacle.
11. **Usage ratios over control counts** — coverage measures how many
    rules exist, not whether they hold.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Primary instrument | Guardrails shaping the default path | Gates requiring approval | Guardrails scale without a queue and produce compliance nobody had to choose | When a decision genuinely requires human judgment every time — a production data export, a new external egress destination |
| Gate count | Fixed budget, adding requires removing | Add a gate after each incident | Prevents the slow accumulation that makes the compliant path irrational | When a regulator mandates specific approval steps that cannot be traded against each other |
| Response to a discovered bypass | Fix the compliant path's latency first | Strengthen enforcement on the bypass | Bypassing a slow path is rational; closing it without fixing latency moves the workaround somewhere less visible | When the bypass is genuinely dangerous and immediate — then close it now and fix latency next, saying so explicitly |
| Exception handling | Clocked, recorded, and fed back into the catalogue | Case-by-case approval | Turns friction into evidence and makes demotion possible | When exception volume is so low that a register costs more than it informs |
| Persuasion | Architecture — make compliant fastest | Education and communication campaigns | Architecture works on people who never attended the session | When a control genuinely cannot be made frictionless and its rationale is non-obvious — then explaining it is the only lever left |

**What a weak answer sounds like**

- "We'd explain the risks so teams understand why the controls
  matter." — helps at the margin and does not survive contact with a
  deadline; the question is about the system, not the messaging.
- "We'd add approval steps for the risky operations." — every approval
  is a queue, and an unbudgeted set of queues is the thing that created
  the bypass.
- "Security policy is mandatory, so routing around it is a disciplinary
  issue." — treats a design failure as a behaviour failure, and
  guarantees the next bypass is better hidden.
- "We'd audit for violations quarterly." — detection with no owner, no
  clock and no feedback into the control set is an activity, not a
  control.

**Common wrong turns**

- **Making everything a gate.** It looks rigorous and it produces a
  permanent queue. Recover by applying the every-time test to each one.
- **Treating a bypass as non-compliance.** The investigation goes to
  the person instead of the path. Recover by asking what the compliant
  path costs.
- **Never removing a control.** The catalogue grows monotonically and
  loses credibility. Recover by putting the review cadence on the
  diagram.
- **Measuring coverage.** Leadership sees a rising number and believes
  it means safety. Recover by proposing the usage-ratio metric instead.

**Follow-up probes the interviewer asks next**

1. **"Give me a control you'd remove tomorrow."** — any gate whose
   approvals are approved every time. An approval with a hundred
   percent approval rate is a delay with a signature on it, and it
   should become a recorded notification or a detection.
2. **"Escalate: a bypass caused an incident. What changes?"** — the
   post-incident action is usually proposed as a new gate, and my job
   is to ask whether the default path could have absorbed it instead.
   If the honest answer is no, the gate is justified and something else
   leaves the budget.
3. **"How do you handle a security engineer who wants every control
   enforced?"** — with exception-rate and bypass data rather than
   opinion. The argument that wins is that an unbudgeted control set
   produces routing-around, which is less safe than a smaller set
   people follow. That's an evidence conversation, not a values one.
4. **"Who owns this model in two years?"** — security architecture owns
   the catalogue and the budget, platform owns the compliant paths, and
   engineering leadership owns accepting the residual risk. If security
   owns all three, the budget is never spent on velocity and the model
   collapses back into gates.
5. **"What does this look like when the company doubles?"** — the gate
   budget does not double; guardrails carry the growth, because they're
   the only instrument whose cost does not scale with the number of
   teams. If the gate count grows with headcount, the model has failed.
6. **"An auditor asks why a control was demoted."** — the exception
   register and the finding rate that justified it, recorded as a
   decision with a named owner. Demotion without that record is
   indistinguishable from a control quietly lapsing, and that's the
   difference between governance and drift.

**Cross-references**

- `D1-Q06` owns the enforced/detected/advisory tiering and the
  promotion mechanism; this question is the operating model around it.
- `D1-Q11` owns the exception path itself; this question owns what the
  exception data is used for.
- `D1-Q16` for the governance cadence this review runs inside;
  `D4-Q08` for the detection tier's routing.
